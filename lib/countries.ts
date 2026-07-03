// Pemetaan nama negara -> kode ISO 3166-1 alpha-2 (untuk bendera flagcdn.com)
// Mencakup peserta & kandidat World Cup 2026.
const NAME_TO_ISO2: Record<string, string> = {
  Argentina: "ar", Australia: "au", Austria: "at", Belgium: "be", Brazil: "br",
  Cameroon: "cm", Canada: "ca", Chile: "cl", Colombia: "co", "Costa Rica": "cr",
  Croatia: "hr", Denmark: "dk", Ecuador: "ec", Egypt: "eg", England: "gb-eng",
  France: "fr", Germany: "de", Ghana: "gh", Greece: "gr", Iran: "ir",
  Italy: "it", "Ivory Coast": "ci", "Côte d'Ivoire": "ci", Japan: "jp",
  "South Korea": "kr", "Korea Republic": "kr", Mexico: "mx", Morocco: "ma",
  Netherlands: "nl", "New Zealand": "nz", Nigeria: "ng", Norway: "no",
  Panama: "pa", Paraguay: "py", Peru: "pe", Poland: "pl", Portugal: "pt",
  Qatar: "qa", "Saudi Arabia": "sa", Scotland: "gb-sct", Senegal: "sn",
  Serbia: "rs", "South Africa": "za", Spain: "es", Sweden: "se",
  Switzerland: "ch", Tunisia: "tn", Turkey: "tr", "Türkiye": "tr",
  Ukraine: "ua", "United States": "us", USA: "us", Uruguay: "uy",
  Wales: "gb-wls", Algeria: "dz", Jordan: "jo", Uzbekistan: "uz",
  "Cape Verde": "cv", "Cabo Verde": "cv", Jamaica: "jm", Honduras: "hn",
  Bolivia: "bo", Venezuela: "ve", "Curaçao": "cw", Haiti: "ht", Curacao: "cw",
  Angola: "ao", "DR Congo": "cd", "Democratic Republic of Congo": "cd",
  "Congo DR": "cd", "Bosnia and Herzegovina": "ba", "Bosnia-Herzegovina": "ba",
  "Bosnia & Herzegovina": "ba",
  Ireland: "ie", Slovakia: "sk", Slovenia: "si", "Czech Republic": "cz",
  Czechia: "cz", Romania: "ro", Hungary: "hu", Albania: "al", Iraq: "iq",
  "United Arab Emirates": "ae", Oman: "om", Bahrain: "bh", Palestine: "ps",
  China: "cn", Thailand: "th", "New Caledonia": "nc",
};

export function isoCode(teamName: string): string | undefined {
  return NAME_TO_ISO2[teamName.trim()];
}

// URL bendera 4:3 dari flagcdn (fallback ketika API tidak menyediakan crest)
export function flagUrl(teamName: string): string | undefined {
  const iso = isoCode(teamName);
  return iso ? `https://flagcdn.com/w320/${iso}.png` : undefined;
}
