// Sekali jalan: node scripts/generate-icons.mjs (butuh devDep `sharp`).
// Hasil PNG di-commit; sharp boleh di-uninstall setelahnya.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const BG = "#0d1210";
const LINE = "#2a332e";
const GOLD = "#f5c518";

const digits = `
  <g fill="none" stroke="${GOLD}" stroke-width="44" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 108 200 C 108 130 232 130 232 200 C 232 244 196 272 112 368 H 240"/>
    <path d="M 384 152 C 320 196 282 250 280 314"/>
    <circle cx="342" cy="314" r="62"/>
  </g>`;

// Icon biasa: rounded square + border tipis.
const regular = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${BG}"/>
  <rect x="6" y="6" width="500" height="500" rx="106" fill="none" stroke="${LINE}" stroke-width="8"/>
  ${digits}
</svg>`;

// Maskable: full-bleed, konten diskalakan ke safe zone 70%.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BG}"/>
  <g transform="translate(76.8 76.8) scale(0.7)">${digits}</g>
</svg>`;

// Apple touch: full-bleed (iOS membulatkan sendiri), konten 82%.
const apple = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BG}"/>
  <g transform="translate(46 46) scale(0.82)">${digits}</g>
</svg>`;

await mkdir("public/icons", { recursive: true });

const jobs = [
  [regular, 192, "public/icons/icon-192.png"],
  [regular, 512, "public/icons/icon-512.png"],
  [maskable, 192, "public/icons/icon-maskable-192.png"],
  [maskable, 512, "public/icons/icon-maskable-512.png"],
  [apple, 180, "public/apple-touch-icon.png"],
];

for (const [svg, size, out] of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(out);
  console.log(`✓ ${out} (${size}x${size})`);
}
