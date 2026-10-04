// Solves one spot + flop with TexasSolver, then follows the main line street by street:
//   flop: raiser c-bets 33% or 75%; caller responds
//   turn: after a 33% c-bet is called, two turn cards (a blank and an action card); raiser bets 50% or 100%; caller responds
//   river: after the raiser's most-used turn bet is called, one blank river; raiser bets 75% or all-in; caller responds
// Turn and river solves start from the ranges that actually reach that street: each hand class is weighted by how often
// its combos took the line (TexasSolver accepts weights per class, not per combo, so suits are averaged within a class).
// Usage: node solve.js SPOT FLOP   (e.g. node solve.js BTN_BB Ks7d2c). Depth from LEAK_DEPTH (default 100).
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const SOLVER = 'C:/Users/kevin/TexasSolver/TexasSolver-v0.2.0-Windows/console_solver.exe';
const WORK = __dirname;
const DEPTH = +(process.env.LEAK_DEPTH || 100), SUF = DEPTH === 100 ? '' : String(DEPTH);   // stack depth in big blinds
const OUTDIR = 'out' + SUF;
const spots = JSON.parse(fs.readFileSync(path.join(WORK, `spots${SUF ? '-' + SUF : ''}.json`), 'utf8'));
const R = '23456789TJQKA', SUITS = 'shdc';

// Runs one solver job. Chips are tenths of a big blind (the solver rounds bets to whole chips).
function run(tag, board, ipRange, oopRange, pot, stack, sizes) {
  const L = [`set_pot ${Math.round(pot * 10)}`, `set_effective_stack ${Math.round(stack * 10)}`, `set_board ${board.match(/../g).join(',')}`,
    `set_range_ip ${ipRange}`, `set_range_oop ${oopRange}`, ...sizes, 'set_allin_threshold 0.67', 'build_tree', 'set_thread_num 12',
    'set_accuracy 1', 'set_max_iteration 150', 'set_print_interval 10', 'set_use_isomorphism 1', 'start_solve', 'set_dump_rounds 1',
    `dump_result ${path.join(WORK, 'raw.json').replace(/\\/g, '/')}`];
  fs.mkdirSync(path.join(WORK, 'in'), { recursive: true });
  const inFile = path.join(WORK, 'in', tag + '.txt'); fs.writeFileSync(inFile, L.join('\n') + '\n');
  const logFile = path.join(WORK, 'current.log'), fd = fs.openSync(logFile, 'w');
  const t0 = Date.now();
  const r = spawnSync(SOLVER, ['-i', inFile.replace(/\\/g, '/')], { cwd: path.dirname(SOLVER), stdio: ['ignore', fd, fd] });
  fs.closeSync(fd);
  if (r.status !== 0) throw new Error(`solver exited ${r.status} on ${tag}`);
  const expl = (fs.readFileSync(logFile, 'utf8').match(/Total exploitability ([\d.]+)/g) || []).pop();
  const j = JSON.parse(fs.readFileSync(path.join(WORK, 'raw.json'), 'utf8')); fs.unlinkSync(path.join(WORK, 'raw.json'));
  return { j, secs: (Date.now() - t0) / 1000, expl: expl ? parseFloat(expl.split(' ').pop()) : null };
}
const pack = n => (n && n.strategy && n.strategy.strategy ? { actions: n.strategy.actions, strategy: n.strategy.strategy } : null);
// The raiser's decision node (after the caller checks if the raiser is in position) and the caller's responses to each bet.
function decisionNodes(j, pfr) {
  const node = pfr === 'ip' ? j.childrens && j.childrens.CHECK : j, res = { pfr: pack(node), vs: {} };
  if (!res.pfr) return res;
  for (const a of node.strategy.actions) { const p = node.childrens && pack(node.childrens[a]); if (a.startsWith('BET') && p) res.vs[a] = p; }
  return res;
}
// Class weights for the hands that took an action: start weight x average frequency of the action over the class's combos.
const card = c => R.indexOf(c[0]) * 4 + SUITS.indexOf(c[1]);
function comboClass(k) {
  const a = card(k.slice(0, 2)), b = card(k.slice(2)); let r1 = a >> 2, r2 = b >> 2; if (r1 < r2) [r1, r2] = [r2, r1];
  return r1 === r2 ? R[r1] + R[r1] : R[r1] + R[r2] + ((a & 3) === (b & 3) ? 's' : 'o');
}
function narrowed(rangeStr, node, action) {
  const base = {}; rangeStr.split(',').forEach(t => { const [c, w] = t.split(':'); base[c] = w ? +w : 1; });
  const i = node.actions.indexOf(action), acc = {};
  for (const [k, f] of Object.entries(node.strategy)) { const c = comboClass(k); if (!(c in base)) continue; const a = acc[c] || (acc[c] = [0, 0]); a[0] += f[i]; a[1]++; }
  return Object.entries(acc).map(([c, [s, n]]) => [c, base[c] * s / n]).filter(([, w]) => w >= 0.02).map(([c, w]) => `${c}:${w.toFixed(2)}`).join(',');
}
// Turn and river cards: a blank (low, unpaired, a suit not on board when possible) and an action card
// (a third card of the flop's suit on two-tone flops, otherwise an overcard, otherwise one that pairs the middle card).
function pickCards(board, n) {
  const cards = board.match(/../g), used = new Set(cards), ranks = cards.map(c => c[0]), cnt = {};
  cards.forEach(c => cnt[c[1]] = (cnt[c[1]] || 0) + 1);
  const major = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
  let blank = null;
  for (const pass of [0, 1]) { for (const r of '2345678') { for (const s of SUITS) { const c = r + s;
    if (!used.has(c) && !ranks.includes(r) && s !== major && (pass || !cnt[s])) { blank = c; break; } } if (blank) break; } if (blank) break; }
  if (n === 1) return [blank];
  const top = Math.max(...ranks.map(r => R.indexOf(r)));
  let action = null;
  if (cnt[major] === 2) for (const r of 'AKQJT98765432') { const c = r + major; if (!used.has(c) && !ranks.includes(r) && c !== blank) { action = c; break; } }
  if (!action) for (const r of 'AKQJ') { if (R.indexOf(r) <= top) continue; for (const s of SUITS) { const c = r + s; if (!used.has(c) && s !== major) { action = c; break; } } if (action) break; }
  if (!action) for (const s of SUITS) { const c = ranks[1] + s; if (!used.has(c)) { action = c; break; } }
  return [blank, action];
}
const flopSizes = s => { const pfr = s.pfr, caller = pfr === 'ip' ? 'oop' : 'ip';
  const L = [`set_bet_sizes ${pfr},flop,bet,33,75`, `set_bet_sizes ${pfr},flop,raise,60`, `set_bet_sizes ${caller},flop,raise,60`];
  if (pfr === 'oop') L.push('set_bet_sizes ip,flop,bet,50');
  for (const p of ['oop', 'ip']) L.push(`set_bet_sizes ${p},turn,bet,75`, `set_bet_sizes ${p},river,bet,75`, `set_bet_sizes ${p},turn,allin`, `set_bet_sizes ${p},river,allin`);
  return L.concat('set_bet_sizes oop,river,donk,75'); };
const turnSizes = s => { const pfr = s.pfr, caller = pfr === 'ip' ? 'oop' : 'ip';
  const L = [`set_bet_sizes ${pfr},turn,bet,50,100`, `set_bet_sizes ${pfr},turn,raise,60`, `set_bet_sizes ${caller},turn,raise,60`];
  if (pfr === 'oop') L.push('set_bet_sizes ip,turn,bet,75');
  for (const p of ['oop', 'ip']) L.push(`set_bet_sizes ${p},turn,allin`, `set_bet_sizes ${p},river,bet,75`, `set_bet_sizes ${p},river,allin`);
  return L; };
const riverSizes = s => { const pfr = s.pfr, caller = pfr === 'ip' ? 'oop' : 'ip';
  const L = [`set_bet_sizes ${pfr},river,bet,75`, `set_bet_sizes ${pfr},river,allin`, `set_bet_sizes ${caller},river,allin`];
  if (pfr === 'oop') L.push('set_bet_sizes ip,river,bet,75');
  return L; };
// Follows "raiser bets, caller calls" into the next street: new pot, stacks and narrowed ranges.
function nextStreet(s, nodes, betAction, pot, stack, ipRange, oopRange) {
  const bet = parseFloat(betAction.split(' ')[1]) / 10, pfrIp = s.pfr === 'ip';
  const pfrR = narrowed(pfrIp ? ipRange : oopRange, nodes.pfr, betAction), calR = narrowed(pfrIp ? oopRange : ipRange, nodes.vs[betAction], 'CALL');
  return { pot: pot + 2 * bet, stack: stack - bet, ipRange: pfrIp ? pfrR : calR, oopRange: pfrIp ? calR : pfrR };
}
// The smallest bet (pickSmall) or the bet the raiser uses most often, by average frequency over its combos.
const mainBet = (n, pickSmall) => {
  const bets = n.actions.map((a, i) => [a, Object.values(n.strategy).reduce((t, f) => t + f[i], 0)]).filter(([a, w]) => a.startsWith('BET') && w > 0);
  if (!bets.length) return null;
  bets.sort((a, b) => pickSmall ? parseFloat(a[0].split(' ')[1]) - parseFloat(b[0].split(' ')[1]) : b[1] - a[1]);
  return bets[0][0]; };

function solve(spotKey, board) {
  const s = spots[spotKey], tag = `${spotKey}_${board}`, t0 = Date.now();
  fs.mkdirSync(path.join(WORK, OUTDIR), { recursive: true });
  const flop = run(tag, board, s.ipRange, s.oopRange, s.pot, s.stack, flopSizes(s)), fn = decisionNodes(flop.j, s.pfr);
  const res = { spot: spotKey, board, depth: DEPTH, pot: s.pot, potChips: Math.round(s.pot * 10), stackChips: Math.round(s.stack * 10), stack: s.stack, pfr: s.pfr,
    exploitability: flop.expl, cbet: fn.pfr, vsBet: fn.vs, turns: [] };
  const small = fn.pfr && mainBet(fn.pfr, true);
  if (small && fn.vs[small]) {
    const t = nextStreet(s, fn, small, s.pot, s.stack, s.ipRange, s.oopRange);
    for (const tc of pickCards(board, 2)) try {
      const tb = board + tc, tr = run(`${tag}_${tc}`, tb, t.ipRange, t.oopRange, t.pot, t.stack, turnSizes(s)), tn = decisionNodes(tr.j, s.pfr);
      const turn = { card: tc, line: small, pot: t.pot, potChips: Math.round(t.pot * 10), stackChips: Math.round(t.stack * 10), expl: tr.expl, pfr: tn.pfr, vs: tn.vs, river: null };
      if (!tn.pfr) continue;
      const tbet = mainBet(tn.pfr, false);
      if (tbet && tn.vs[tbet]) try {
        const rv = nextStreet(s, tn, tbet, t.pot, t.stack, t.ipRange, t.oopRange), rc = pickCards(tb, 1)[0];
        const rr = run(`${tag}_${tc}${rc}`, tb + rc, rv.ipRange, rv.oopRange, rv.pot, rv.stack, riverSizes(s)), rn = decisionNodes(rr.j, s.pfr);
        if (rn.pfr) turn.river = { card: rc, line: tbet, pot: rv.pot, potChips: Math.round(rv.pot * 10), stackChips: Math.round(rv.stack * 10), expl: rr.expl, pfr: rn.pfr, vs: rn.vs };
      } catch (e) { turn.riverError = e.message; }
      res.turns.push(turn);
    } catch (e) { res.turnErrors = (res.turnErrors || []).concat(`${tc}: ${e.message}`); }   // keep the flop result
  }
  res.secs = (Date.now() - t0) / 1000;
  fs.writeFileSync(path.join(WORK, OUTDIR, tag + '.json'), JSON.stringify(res));
  return res;
}

if (require.main === module) {
  const r = solve(process.argv[2], process.argv[3]);
  console.log(`${r.spot} ${r.board}: ${r.secs.toFixed(0)}s, flop expl ${r.exploitability}% · ` +
    r.turns.map(t => `turn ${t.card} ${t.expl}%` + (t.river ? `, river ${t.river.card} ${t.river.expl}%` : '')).join(' · '));
}
module.exports = { solve };
