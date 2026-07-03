// Akses Firestore untuk fitur Tebak Skor.
// Struktur: koleksi "guesses", ID dokumen `${matchId}_${uid}` sehingga
// satu user hanya punya satu tebakan per laga (setDoc = upsert).
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";

export interface GuessDoc {
  matchId: string;
  uid: string;
  name: string; // nama tampilan dari akun Google
  photo: string | null; // URL avatar Google
  home: number;
  away: number;
}

export type GuessMap = Record<string, GuessDoc>; // key = matchId

const COL = "guesses";

// Berlangganan tebakan milik satu user (realtime). Mengembalikan fungsi unsubscribe.
export function subscribeMyGuesses(uid: string, cb: (guesses: GuessMap) => void) {
  if (!db) return () => {};
  const q = query(collection(db, COL), where("uid", "==", uid));
  return onSnapshot(q, (snap) => {
    const map: GuessMap = {};
    snap.forEach((d) => {
      const g = d.data() as GuessDoc;
      map[g.matchId] = g;
    });
    cb(map);
  });
}

export async function saveGuess(user: User, matchId: string, home: number, away: number) {
  if (!db) throw new Error("Firebase belum dikonfigurasi");
  await setDoc(doc(db, COL, `${matchId}_${user.uid}`), {
    matchId,
    uid: user.uid,
    name: user.displayName ?? "Anonim",
    photo: user.photoURL ?? null,
    home,
    away,
    updatedAt: serverTimestamp(),
  });
}

export async function removeGuess(uid: string, matchId: string) {
  if (!db) throw new Error("Firebase belum dikonfigurasi");
  await deleteDoc(doc(db, COL, `${matchId}_${uid}`));
}

// Semua tebakan untuk satu laga — dipakai panel "tebakan user lain".
// (Tanpa orderBy di query agar tidak butuh composite index; diurutkan di klien.)
export async function fetchMatchGuesses(matchId: string): Promise<GuessDoc[]> {
  if (!db) return [];
  const q = query(collection(db, COL), where("matchId", "==", matchId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => d.data() as GuessDoc)
    .sort((a, b) => a.name.localeCompare(b.name));
}
