// Builds a TexasSolver console input for one spot + flop, runs it, and keeps only the two decision nodes the app needs.
// Usage: node solve.js SPOT FLOP   (e.g. node solve.js BTN_BB Ks7d2c)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const SOLVER = 'C:/Users/kevin/TexasSolver/TexasSolver-v0.2.0-Windows/console_solver.exe';
const WORK = __dirname;
const spots = JSON.parse(fs.readFileSync(path.join(WORK, 'spots.json'), 'utf8'));

function input(s, board, outFile) {
  const pfr = s.pfr, caller = pfr === 'ip' ? 'oop' : 'ip';
  // Chips are tenths of a big blind: the solver rounds bets to whole chips.
  const L = [`set_pot ${Math.round(s.pot * 10)}`, `set_effective_stack ${Math.round(s.stack * 10)}`, `set_board ${board}`,
    `set_range_ip ${s.ipRange}`, `set_range_oop ${s.oopRange}`];
  // Flop: preflop raiser c-bets 33% or 75%; the caller never leads into the raiser (no donk bets).
  L.push(`set_bet_sizes ${pfr},flop,bet,33,75`, `set_bet_sizes ${pfr},flop,raise,60`, `set_bet_sizes ${caller},flop,raise,60`);
  if (pfr === 'oop') L.push('set_bet_sizes ip,flop,bet,50');          // IP stabs when the OOP raiser checks
  for (const p of ['oop', 'ip']) {
    L.push(`set_bet_sizes ${p},turn,bet,75`, `set_bet_sizes ${p},river,bet,75`,
      `set_bet_sizes ${p},turn,allin`, `set_bet_sizes ${p},river,allin`);
  }
  L.push('set_bet_sizes oop,river,donk,75', 'set_allin_threshold 0.67', 'build_tree', 'set_thread_num 12',
    'set_accuracy 1', 'set_max_iteration 150', 'set_print_interval 10', 'set_use_isomorphism 1', 'start_solve',
    'set_dump_rounds 1', `dump_result ${outFile}`);
  return L.join('\n') + '\n';
}

// Extract: the raiser's c-bet decision, and the caller's response to each c-bet size.
function extract(s, j) {
  const pfrIsIp = s.pfr === 'ip';
  // In TexasSolver output, the root player is OOP. If the raiser is IP, its c-bet node is after OOP checks.
  const cbetNode = pfrIsIp ? j.childrens.CHECK : j;
  const pack = n => ({ actions: n.strategy.actions, strategy: n.strategy.strategy });
  const res = { cbet: pack(cbetNode), vsBet: {} };
  for (const a of cbetNode.strategy.actions) if (a.startsWith('BET')) res.vsBet[a] = pack(cbetNode.childrens[a]);
  return res;
}

function solve(spotKey, board) {
  const s = spots[spotKey];
  const tag = `${spotKey}_${board}`, inFile = path.join(WORK, 'in', tag + '.txt'), raw = path.join(WORK, 'raw.json');
  fs.mkdirSync(path.join(WORK, 'in'), { recursive: true }); fs.mkdirSync(path.join(WORK, 'out'), { recursive: true });
  const b = board.match(/../g).join(',');
  fs.writeFileSync(inFile, input(s, b, raw.replace(/\\/g, '/')));
  const t0 = Date.now();
  // Solver output goes to current.log so progress can be watched while it runs.
  const logFile = path.join(WORK, 'current.log');
  const fd = fs.openSync(logFile, 'w');
  const run = require('child_process').spawnSync(SOLVER, ['-i', inFile.replace(/\\/g, '/')], { cwd: path.dirname(SOLVER), stdio: ['ignore', fd, fd] });
  fs.closeSync(fd);
  if (run.status !== 0) throw new Error(`solver exited ${run.status} on ${tag}`);
  const log = fs.readFileSync(logFile, 'utf8');
  const expl = (log.match(/Total exploitability ([\d.]+)/g) || []).pop();
  const j = JSON.parse(fs.readFileSync(raw, 'utf8'));
  const res = { spot: spotKey, board, pot: s.pot, potChips: Math.round(s.pot * 10), stack: s.stack, pfr: s.pfr, secs: (Date.now() - t0) / 1000,
    exploitability: expl ? parseFloat(expl.split(' ').pop()) : null, ...extract(s, j) };
  fs.writeFileSync(path.join(WORK, 'out', tag + '.json'), JSON.stringify(res));
  fs.unlinkSync(raw);
  return res;
}

if (require.main === module) {
  const r = solve(process.argv[2], process.argv[3]);
  console.log(`${r.spot} ${r.board}: ${r.secs.toFixed(0)}s, exploitability ${r.exploitability}% · cbet actions ${r.cbet.actions.join(' / ')}`);
}
module.exports = { solve };
