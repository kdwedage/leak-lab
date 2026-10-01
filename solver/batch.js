// Solves every spot on every flop, round-robin by flop so partial results cover all spots evenly.
// Resumable: finished solves in out/ are skipped. Progress goes to batch.log.
const fs = require('fs'), path = require('path');
const { solve } = require('./solve.js');
const SPOTS = ['BTN_BB', 'CO_BB', 'SB_BB', 'BB3_BTN', 'BTN3_CO', 'UTG_BB'];
// 20 flops covering the main textures: high/low, dry/connected, rainbow/two-tone/monotone, paired.
const FLOPS = ['Ks7d2c', 'As7d2c', 'Qh9c4d', 'Jh8d3s', 'Td6c2h', '9s8h4c', '7c5d2h', '6h5s4d', 'AhKd5s', 'KsQd7h',
  'QhJd9c', 'Ts9s5d', '8h7h3c', 'Ad9d3c', 'KhKd6c', '7s7d3h', '9c6c3c', 'AhJh6h', '5s4s2d', 'JcTd2c'];
const LOG = path.join(__dirname, 'batch.log');
const log = m => fs.appendFileSync(LOG, `${new Date().toISOString().slice(11, 19)} ${m}\n`);
const jobs = FLOPS.flatMap(f => SPOTS.map(s => [s, f]));
let done = 0;
log(`start: ${jobs.length} solves`);
for (const [s, f] of jobs) {
  done++;
  if (fs.existsSync(path.join(__dirname, 'out', `${s}_${f}.json`))) continue;
  try { const r = solve(s, f); log(`${done}/${jobs.length} ${s} ${f} ${r.secs.toFixed(0)}s expl ${r.exploitability}%`); }
  catch (e) { log(`${done}/${jobs.length} ${s} ${f} FAILED ${e.message}`); }
}
log('all done');
