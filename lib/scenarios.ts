import { Match } from "./types";
import { isRealTeam } from "./simulate";

// ===========================================================================
//  Kalkulator Skenario Lolos (fase grup, format 48 tim)
//  - Posisi 2 besar per grup: ENUMERASI EKSAK semua permutasi sisa laga
//    (maks 3^6 = 729 per grup — murah)
//  - Peringkat-3 terbaik (lintas 12 grup): probabilistik via Monte Carlo,
//    KECUALI seluruh fase grup selesai -> tabel peringkat-3 dihitung eksak
//  - Engine tidak pernah bilang "pasti" saat hasil tergantung selisih gol:
//    tie poin hanya di-resolve eksak jika kedua tim sudah tanpa sisa laga
// ===========================================================================

export type QualStatus =
  | "LOLOS_PASTI" // pasti finis 2 besar, apa pun hasil sisanya
  | "LOLOS_BERSYARAT" // 2 besar masih mungkin; lihat kondisi
  | "HANYA_PERINGKAT_3" // 2 besar mustahil; masih bisa finis ke-3
  | "TERSINGKIR"; // tidak mungkin finis 3 besar

export interface ScenarioCondition {
  text: string;
  certainty: "PASTI" | "TERGANTUNG_SELISIH_GOL";
}

export interface TeamScenario {
  team: string;
  crest?: string;
  group: string;
  currentPoints: number;
  currentRank: number;
  currentGd: number;
  currentGf: number;
  bestRank: number; // terbaik yang masih bisa dicapai
  worstRank: number; // terburuk yang mungkin terjadi
  status: QualStatus;
  headline: string; // kalimat utama siap render
  conditions: ScenarioCondition[];
  thirdPlacePossible: boolean;
  thirdPlaceOdds?: number; // % lolos dari simulasi (jika tersedia)
  remainingOwnMatches: { opponent: string; utcDate: string }[];
}

export interface GroupScenarios {
  group: string;
  decided: boolean; // seluruh laga grup ini sudah selesai
  remainingMatches: number;
  teams: TeamScenario[]; // urut peringkat saat ini
}

interface TeamState {
  team: string;
  crest?: string;
  pts: number;
  gd: number;
  gf: number;
  remaining: number; // sisa laga tim ini
}

interface PendingMatch {
  home: string;
  away: string;
  utcDate: string;
}

export function computeScenarios(
  matches: Match[],
  opts?: { thirdPlaceOdds?: Map<string, number> }
): GroupScenarios[] {
  const groupMatches = matches.filter(
    (m) => m.group && m.stage === "GROUP_STAGE" && isRealTeam(m.home.name) && isRealTeam(m.away.name)
  );
  const groupNames = [...new Set(groupMatches.map((m) => m.group!))].sort();
  if (groupNames.length === 0) return [];

  const results = groupNames.map((g) =>
    analyzeGroup(g, groupMatches.filter((m) => m.group === g), opts?.thirdPlaceOdds)
  );

  // Seluruh fase grup selesai -> nasib peringkat-3 dihitung eksak lintas grup
  if (results.every((r) => r.decided)) resolveThirdPlacesExactly(results);

  return results;
}

// ---------------------------------------------------------------------------

function analyzeGroup(
  group: string,
  ms: Match[],
  thirdPlaceOdds?: Map<string, number>
): GroupScenarios {
  const state = new Map<string, TeamState>();
  const ensure = (team: string, crest?: string) => {
    if (!state.has(team)) state.set(team, { team, crest, pts: 0, gd: 0, gf: 0, remaining: 0 });
    return state.get(team)!;
  };

  const pending: PendingMatch[] = [];
  for (const m of ms) {
    const h = ensure(m.home.name, m.home.crest);
    const a = ensure(m.away.name, m.away.crest);
    if (m.status === "FINISHED" && m.score.home !== null && m.score.away !== null) {
      const hg = m.score.home, ag = m.score.away;
      h.gd += hg - ag; a.gd += ag - hg;
      h.gf += hg; a.gf += ag;
      if (hg > ag) h.pts += 3;
      else if (ag > hg) a.pts += 3;
      else { h.pts += 1; a.pts += 1; }
    } else if (m.status !== "CANCELLED") {
      pending.push({ home: m.home.name, away: m.away.name, utcDate: m.utcDate });
      h.remaining++;
      a.remaining++;
    }
  }

  const teams = [...state.values()];
  const currentOrder = [...teams].sort(
    (x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.team.localeCompare(y.team)
  );
  const currentRank = new Map(currentOrder.map((t, i) => [t.team, i + 1]));

  const scenarios: TeamScenario[] =
    pending.length === 0
      ? decidedGroupScenarios(group, currentOrder, thirdPlaceOdds)
      : enumerateGroup(group, teams, currentOrder, pending, thirdPlaceOdds);

  scenarios.sort((a, b) => currentRank.get(a.team)! - currentRank.get(b.team)!);
  return { group, decided: pending.length === 0, remainingMatches: pending.length, teams: scenarios };
}

// --- Grup yang seluruh laganya sudah selesai: status langsung dari tabel ---

function decidedGroupScenarios(
  group: string,
  order: TeamState[],
  thirdPlaceOdds?: Map<string, number>
): TeamScenario[] {
  return order.map((t, i) => {
    const rank = i + 1;
    const base = {
      team: t.team,
      crest: t.crest,
      group,
      currentPoints: t.pts,
      currentRank: rank,
      currentGd: t.gd,
      currentGf: t.gf,
      bestRank: rank,
      worstRank: rank,
      conditions: [] as ScenarioCondition[],
      thirdPlacePossible: rank === 3,
      thirdPlaceOdds: rank === 3 ? thirdPlaceOdds?.get(t.team) : undefined,
      remainingOwnMatches: [],
    };
    if (rank === 1)
      return { ...base, status: "LOLOS_PASTI" as const, headline: `Lolos sebagai juara ${group}.` };
    if (rank === 2)
      return { ...base, status: "LOLOS_PASTI" as const, headline: `Lolos sebagai runner-up ${group}.` };
    if (rank === 3) {
      // nasib final diputuskan lintas grup oleh resolveThirdPlacesExactly()
      // (jika semua grup selesai) — default sementara: masih menunggu
      const odds = thirdPlaceOdds?.get(t.team);
      return {
        ...base,
        status: "HANYA_PERINGKAT_3" as const,
        headline:
          odds !== undefined
            ? `Menunggu hasil grup lain — peluang lolos sebagai peringkat 3 terbaik: ${Math.round(odds)}% (via simulasi).`
            : "Menunggu hasil grup lain — bisa lolos sebagai salah satu dari 8 peringkat 3 terbaik.",
      };
    }
    return { ...base, status: "TERSINGKIR" as const, headline: "Tersingkir dari turnamen." };
  });
}

// --- Grup dengan sisa laga: enumerasi eksak semua permutasi ---

function enumerateGroup(
  group: string,
  teams: TeamState[],
  currentOrder: TeamState[],
  pending: PendingMatch[],
  thirdPlaceOdds?: Map<string, number>
): TeamScenario[] {
  const names = teams.map((t) => t.team);
  const idx = new Map(names.map((n, i) => [n, i]));
  const basePts = teams.map((t) => t.pts);
  const R = pending.length;
  const total = Math.pow(3, R);

  // pts final tiap tim untuk tiap permutasi + interval rank per tim
  // outcome digit: 0 = tuan rumah menang, 1 = seri, 2 = tim tandang menang
  interface PermRanks { best: number[]; worst: number[]; pts: number[] }
  const perms: PermRanks[] = [];

  for (let code = 0; code < total; code++) {
    const pts = [...basePts];
    let c = code;
    for (let k = 0; k < R; k++) {
      const o = c % 3;
      c = (c - o) / 3;
      const hi = idx.get(pending[k].home)!;
      const ai = idx.get(pending[k].away)!;
      if (o === 0) pts[hi] += 3;
      else if (o === 1) { pts[hi] += 1; pts[ai] += 1; }
      else pts[ai] += 3;
    }

    const best: number[] = [], worst: number[] = [];
    for (let ti = 0; ti < teams.length; ti++) {
      let above = 0, ambiguous = 0, below = 0;
      for (let si = 0; si < teams.length; si++) {
        if (si === ti) continue;
        if (pts[si] > pts[ti]) above++;
        else if (pts[si] < pts[ti]) below++;
        else {
          // tie poin: eksak hanya jika KEDUA tim tanpa sisa laga di dunia nyata
          // (gd/gf mereka tidak berubah oleh permutasi mana pun)
          if (teams[ti].remaining === 0 && teams[si].remaining === 0) {
            const t = teams[ti], s = teams[si];
            if (s.gd > t.gd || (s.gd === t.gd && s.gf > t.gf)) above++;
            else if (s.gd < t.gd || (s.gd === t.gd && s.gf < t.gf)) below++;
            else ambiguous++;
          } else ambiguous++;
        }
      }
      best.push(1 + above);
      worst.push(1 + above + ambiguous);
    }
    perms.push({ best, worst, pts });
  }

  return teams.map((t) => {
    const ti = idx.get(t.team)!;
    let minBest = Infinity, maxWorst = 0, canBeThird = false;
    for (const p of perms) {
      if (p.best[ti] < minBest) minBest = p.best[ti];
      if (p.worst[ti] > maxWorst) maxWorst = p.worst[ti];
      if (p.best[ti] <= 3 && p.worst[ti] >= 3) canBeThird = true;
    }

    const status: QualStatus =
      maxWorst <= 2
        ? "LOLOS_PASTI"
        : minBest > 3
        ? "TERSINGKIR"
        : minBest > 2
        ? "HANYA_PERINGKAT_3"
        : "LOLOS_BERSYARAT";

    const ownMatches = pending
      .map((p, k) => ({ ...p, k }))
      .filter((p) => p.home === t.team || p.away === t.team);

    const { headline, conditions } = deriveConditions(
      status, t, ti, perms, pending, ownMatches, canBeThird, thirdPlaceOdds
    );

    return {
      team: t.team,
      crest: t.crest,
      group,
      currentPoints: t.pts,
      currentRank: currentOrder.findIndex((o) => o.team === t.team) + 1,
      currentGd: t.gd,
      currentGf: t.gf,
      bestRank: minBest,
      worstRank: maxWorst,
      status,
      headline,
      conditions,
      thirdPlacePossible: canBeThird,
      thirdPlaceOdds: canBeThird ? thirdPlaceOdds?.get(t.team) : undefined,
      remainingOwnMatches: ownMatches.map((m) => ({
        opponent: m.home === t.team ? m.away : m.home,
        utcDate: m.utcDate,
      })),
    };
  });
}

// --- Derivasi kondisi berbahasa Indonesia -------------------------------

type OwnResult = "W" | "D" | "L";

function ownResultInPerm(code: number, k: number, isHome: boolean): OwnResult {
  const o = Math.floor(code / Math.pow(3, k)) % 3;
  if (o === 1) return "D";
  if ((o === 0 && isHome) || (o === 2 && !isHome)) return "W";
  return "L";
}

function deriveConditions(
  status: QualStatus,
  t: TeamState,
  ti: number,
  perms: { best: number[]; worst: number[] }[],
  pending: PendingMatch[],
  ownMatches: (PendingMatch & { k: number })[],
  canBeThird: boolean,
  thirdPlaceOdds?: Map<string, number>
): { headline: string; conditions: ScenarioCondition[] } {
  const conditions: ScenarioCondition[] = [];
  const thirdNote = (): ScenarioCondition | null => {
    if (!canBeThird || status === "LOLOS_PASTI") return null;
    const odds = thirdPlaceOdds?.get(t.team);
    return {
      text:
        odds !== undefined
          ? `Masih bisa lolos sebagai peringkat 3 terbaik (peluang lolos grup: ${Math.round(odds)}% via simulasi).`
          : "Masih bisa lolos sebagai salah satu dari 8 peringkat 3 terbaik — lihat halaman Simulasi.",
      certainty: "PASTI",
    };
  };

  if (status === "LOLOS_PASTI") {
    return { headline: "Sudah pasti lolos 2 besar grup, apa pun hasil sisa laga.", conditions };
  }
  if (status === "TERSINGKIR") {
    return { headline: "Sudah pasti tersingkir dari turnamen.", conditions };
  }
  if (status === "HANYA_PERINGKAT_3") {
    const tn = thirdNote();
    if (tn) conditions.push(tn);
    return {
      headline: "Posisi 2 besar sudah tidak mungkin — satu-satunya jalan lewat jalur peringkat 3 terbaik.",
      conditions,
    };
  }

  // LOLOS_BERSYARAT — cari syarat paling sederhana yang menjamin 2 besar.
  // safe = pasti 2 besar; soft = 2 besar masih mungkin (tergantung selisih gol)
  const isHomeAt = new Map(ownMatches.map((m) => [m.k, m.home === t.team]));
  const matchPerm = (code: number, profile: OwnResult): boolean =>
    ownMatches.every((m) => {
      const r = ownResultInPerm(code, m.k, isHomeAt.get(m.k)!);
      return profile === "W" ? r === "W" : r === "W" || r === "D";
    });

  const check = (filter: (code: number) => boolean) => {
    let all = true, soft = true, any = false, exists = false;
    for (let code = 0; code < perms.length; code++) {
      if (!filter(code)) continue;
      exists = true;
      const safe = perms[code].worst[ti] <= 2;
      const possible = perms[code].best[ti] <= 2;
      if (!safe) all = false;
      if (!possible) soft = false;
      if (possible) any = true;
    }
    return { all: exists && all, soft: exists && soft, any: exists && any, exists };
  };

  const winLabel = ownMatches.length > 1 ? "menang di semua sisa laga" : "menang";
  const unbeatLabel = ownMatches.length > 1 ? "tidak kalah di semua sisa laga" : "tidak kalah (menang atau seri)";

  const anyPerm = check(() => true);
  const win = check((c) => matchPerm(c, "W"));
  const unbeaten = check((c) => matchPerm(c, "D"));

  let headline = "";
  if (anyPerm.all) {
    headline = "Sudah pasti lolos 2 besar grup."; // seharusnya tertangkap LOLOS_PASTI, jaga-jaga
  } else if (unbeaten.all) {
    headline = `Pasti lolos jika ${unbeatLabel}.`;
  } else if (win.all) {
    headline = `Pasti lolos jika ${winLabel}.`;
  } else if (win.soft) {
    headline = `Lolos jika ${winLabel} — tinggal soal selisih gol.`;
    conditions.push({
      text: `Dengan ${winLabel}, nasib 2 besar ditentukan selisih gol.`,
      certainty: "TERGANTUNG_SELISIH_GOL",
    });
  } else if (win.any || ownMatches.length === 0) {
    // butuh bantuan hasil laga lain: cari SATU kondisi penolong yang cukup
    const helper = findHelperCondition(t, ti, perms, pending, ownMatches, matchPerm);
    if (helper) {
      headline = ownMatches.length > 0 ? `Lolos jika ${winLabel} DAN ${helper.text}` : `Lolos jika ${helper.text}`;
      if (helper.certainty === "TERGANTUNG_SELISIH_GOL")
        conditions.push({ text: "Sebagian skenario masih tergantung selisih gol.", certainty: "TERGANTUNG_SELISIH_GOL" });
    } else {
      headline =
        ownMatches.length > 0
          ? `Wajib ${winLabel}, plus kombinasi hasil laga lain yang menguntungkan — lihat simulasi.`
          : "Nasib sepenuhnya ditentukan hasil laga tim lain.";
    }
  } else {
    headline = "Peluang 2 besar sangat tipis — butuh keajaiban kombinasi hasil.";
  }

  const tn = thirdNote();
  if (tn) conditions.push(tn);
  return { headline, conditions };
}

// Cari satu kondisi di laga lain yang — dikombinasikan dengan kemenangan tim —
// menjamin finis 2 besar. Dites dari kondisi paling sederhana.
function findHelperCondition(
  t: TeamState,
  ti: number,
  perms: { best: number[]; worst: number[] }[],
  pending: PendingMatch[],
  ownMatches: (PendingMatch & { k: number })[],
  matchPerm: (code: number, profile: OwnResult) => boolean
): ScenarioCondition | null {
  const ownKs = new Set(ownMatches.map((m) => m.k));
  const others = pending.map((p, k) => ({ ...p, k })).filter((p) => !ownKs.has(p.k));

  // set hasil yang diuji per laga lain, dengan frasa Indonesianya
  const outcomeSets: { test: (o: number) => boolean; phrase: (h: string, a: string) => string }[] = [
    { test: (o) => o === 0, phrase: (h, a) => `${h} menang atas ${a}` },
    { test: (o) => o === 2, phrase: (h, a) => `${a} menang atas ${h}` },
    { test: (o) => o === 1, phrase: (h, a) => `${h} vs ${a} berakhir seri` },
    { test: (o) => o !== 0, phrase: (h, a) => `${h} tidak menang atas ${a}` },
    { test: (o) => o !== 2, phrase: (h, a) => `${a} tidak menang atas ${h}` },
    { test: (o) => o !== 1, phrase: (h, a) => `${h} vs ${a} tidak berakhir seri` },
  ];

  const baseFilter = (code: number) => (ownMatches.length === 0 ? true : matchPerm(code, "W"));

  for (const om of others) {
    for (const os of outcomeSets) {
      let all = true, soft = true, exists = false;
      for (let code = 0; code < perms.length; code++) {
        if (!baseFilter(code)) continue;
        const o = Math.floor(code / Math.pow(3, om.k)) % 3;
        if (!os.test(o)) continue;
        exists = true;
        if (perms[code].worst[ti] > 2) all = false;
        if (perms[code].best[ti] > 2) { soft = false; break; }
      }
      if (!exists) continue;
      if (all) return { text: `${os.phrase(om.home, om.away)}.`, certainty: "PASTI" };
      if (soft)
        return {
          text: `${os.phrase(om.home, om.away)} (tergantung selisih gol).`,
          certainty: "TERGANTUNG_SELISIH_GOL",
        };
    }
  }
  return null;
}

// --- Seluruh fase grup selesai: peringkat-3 dihitung eksak lintas grup ---

function resolveThirdPlacesExactly(results: GroupScenarios[]) {
  const thirds = results
    .map((g) => ({ g, s: g.teams.find((t) => t.currentRank === 3 && t.status === "HANYA_PERINGKAT_3") }))
    .filter((x): x is { g: GroupScenarios; s: TeamScenario } => !!x.s);
  if (thirds.length === 0) return;

  const sorted = [...thirds].sort(
    (a, b) =>
      b.s.currentPoints - a.s.currentPoints ||
      b.s.currentGd - a.s.currentGd ||
      b.s.currentGf - a.s.currentGf ||
      a.s.team.localeCompare(b.s.team)
  );

  // tie persis di batas ke-8/ke-9 (pts, gd, gf semua sama) -> fair play,
  // di luar data yang kita punya
  const sameKey = (a: TeamScenario, b: TeamScenario) =>
    a.currentPoints === b.currentPoints && a.currentGd === b.currentGd && a.currentGf === b.currentGf;

  sorted.forEach((x, i) => {
    const cutTied =
      (i === 7 && sorted[8] && sameKey(sorted[8].s, x.s)) ||
      (i === 8 && sameKey(sorted[7].s, x.s));

    if (i < 8 && !cutTied) {
      x.s.status = "LOLOS_PASTI";
      x.s.headline = `Lolos sebagai salah satu dari 8 peringkat 3 terbaik (urutan ke-${i + 1}).`;
      x.s.conditions = [];
    } else if (i >= 8 && !cutTied) {
      x.s.status = "TERSINGKIR";
      x.s.headline = `Tersingkir — hanya peringkat ke-${i + 1} dari 12 tim posisi 3 (batas: 8 terbaik).`;
      x.s.conditions = [];
    } else {
      x.s.headline = "Tepat di garis batas 8 peringkat 3 terbaik — penentuan lewat kriteria gol/fair play.";
      x.s.conditions = [{ text: "Posisi di batas kelolosan, menunggu tiebreaker resmi.", certainty: "TERGANTUNG_SELISIH_GOL" }];
    }
  });
}
