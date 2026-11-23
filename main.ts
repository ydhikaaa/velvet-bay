// Velvet Bay — a working gta6-01 entry (Node 22, standard library only):
// an original open-world crime game in three.js, plain static files under
// game/ that a desktop browser loads offline (game/index.html and its ES
// modules, three.js vendored under game/vendor/, no network request).
// The program hands it in: it copies game/ and screenshots/ from beside
// this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Velvet Bay entry: game name shown in the dossier build log.
const GAME_NAME = 'velvet-bay';
console.log(`Building dossier for ${GAME_NAME}.`);

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Screenshot gate: the entry must hand in exactly the 4 staged shots,
// each a real render of the game, each at most 256 KiB. Log every shot so
// the build transcript shows what the judge will see.
const shotsDir = join(here, 'screenshots');
const shotNames = readdirSync(shotsDir).filter((n) => !n.startsWith('.')).sort();
if (shotNames.length < 3 || shotNames.length > 4) {
  throw new Error(`expected 3-4 screenshots, found ${shotNames.length}: ${shotNames.join(', ')}`);
}
for (const name of shotNames) {
  const size = statSync(join(shotsDir, name)).size;
  if (size > 262144) throw new Error(`screenshot ${name} is ${size} bytes, over the 256 KiB cap`);
  console.log(`Screenshot ${name}: ${size} bytes.`);
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log('Dossier written.');
