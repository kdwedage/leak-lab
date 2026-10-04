// Packs finished solves (out/*.json) into the app's solver-data.json.
// Each node stores its actions and one fixed-width record per combo: 4 chars of cards + one digit per action,
// where the digit is the frequency in quarters (0 = never … 4 = always).
const fs = require('fs'), path = require('path');
const DEPTH = +(process.env.LEAK_DEPTH || 100), SUF = DEPTH === 100 ? '' : String(DEPTH);   // stack depth in big blinds

const OUT = path.join(__dirname, 'out' + SUF);
fs.mkdirSync(OUT, { recursive: true });
const DEST = `C:/Users/kevin/Desktop/Leak Lab/solver-data${SUF ? '-' + SUF : ''}.json`;
const spotsMeta = {
  BTN_BB: { label: 'BTN open, BB call', pot: 'srp', opener: 'BTN', caller: 'BB', open: 2.5 },
  CO_BB: { label: 'CO open, BB call', pot: 'srp', opener: 'CO', caller: 'BB', open: 2.5 },
  UTG_BB: { label: 'UTG open, BB call', pot: 'srp', opener: 'UTG', caller: 'BB', open: 2.5 },
  SB_BB: { label: 'SB open, BB call', pot: 'srp', opener: 'SB', caller: 'BB', open: 3 },
  BB3_BTN: { label: 'BB 3-bets BTN, BTN calls', pot: 'tbp', opener: 'BTN', threeBettor: 'BB', open: 2.5, threeBet: 10 },
  BTN3_CO: { label: 'BTN 3-bets CO, CO calls', pot: 'tbp', opener: 'CO', threeBettor: 'BTN', open: 2.5, threeBet: 7.5 },
};
// Nodes with no strategy (an empty range reached them) are skipped.
const pack = n => {
  if (!n || !n.strategy || !n.actions) return null;
  let s = '';
  for (const [combo, p] of Object.entries(n.strategy)) s += combo + p.map(x => Math.round(x * 4)).join('');
  return { a: n.actions, s };
};
const data = {
  meta: { solver: 'TexasSolver v0.2.0', generated: new Date().toISOString().slice(0, 10), stackBB: DEPTH, rake: 'none',
    tree: 'Flop: raiser c-bets 33% or 75%, caller raises 60% or all-in, no donk bets. Turn (after a called 33% c-bet, 2 cards): raiser bets 50% or 100%. River (after the main turn bet is called, 1 card): 75% or all-in. Turn and river ranges are the hands that took the line, weighted per hand class. Accuracy 1% of pot.' },
  spots: {}, boards: {},
};
for (const f of fs.readdirSync(OUT).filter(f => f.endsWith('.json'))) {
  const r = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
  data.spots[r.spot] = { ...spotsMeta[r.spot], pfr: r.pfr, potBB: r.pot, potChips: r.potChips, stackBB: r.stack };
  const vs = {};
  for (const [a, n] of Object.entries(r.vsBet)) { const p = pack(n); if (p) vs[a] = p; }
  const packStreet = x => { const v = {}; for (const [a, n] of Object.entries(x.vs || {})) { const p = pack(n); if (p) v[a] = p; } const pf = pack(x.pfr); if (!pf) return null; return { c: x.card, line: x.line, potChips: x.potChips, stackChips: x.stackChips, expl: x.expl, pfr: pack(x.pfr), vs: v }; };
  const turns = (r.turns || []).map(t => { const p = packStreet(t); return p ? { ...p, river: t.river ? packStreet(t.river) : null } : null; }).filter(Boolean);
  data.boards[`${r.spot}|${r.board}`] = { expl: r.exploitability, stackChips: r.stackChips, cbet: pack(r.cbet), vs, turns };
}
fs.writeFileSync(DEST, JSON.stringify(data));
console.log(`${Object.keys(data.boards).length} solved boards → ${path.basename(DEST)} (${(fs.statSync(DEST).size / 1024).toFixed(0)} KB)`);
