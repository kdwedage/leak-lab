// Loads Leak Lab's chart logic from index.html and exports solver-ready ranges for each postflop spot.
// Usage: node ranges.js  -> writes spots.json
const fs = require('fs');
const html = fs.readFileSync('C:/Users/kevin/Desktop/Leak Lab/index.html', 'utf8');
const js = html.split('<script>')[1].split('</script>')[0];
const core = js.split('// ================= rendering helpers')[0];
const pre = js.slice(js.indexOf('const after='), js.indexOf('const deadBlinds'));
const api = new Function('localStorage', core + '\n' + pre + `
  return {rfiSet, villFlatSet, call3bSet, rng, setCombos, CFG};`)({ getItem: () => null, setItem: () => {} });
const str = s => [...s].join(',');
const open = 2.5, sbOpen = 3;
// Each spot: who is out of position, both ranges, pot and stack in big blinds, and who raised preflop.
const spots = {
  BTN_BB: { label: 'BTN open, BB call', pfr: 'ip', oop: 'BB', ip: 'BTN',
    oopRange: api.villFlatSet('BTN', 'BB'), ipRange: api.rfiSet('BTN'), pot: 2 * open + 0.5, stack: 100 - open },
  CO_BB: { label: 'CO open, BB call', pfr: 'ip', oop: 'BB', ip: 'CO',
    oopRange: api.villFlatSet('CO', 'BB'), ipRange: api.rfiSet('CO'), pot: 2 * open + 0.5, stack: 100 - open },
  UTG_BB: { label: 'UTG open, BB call', pfr: 'ip', oop: 'BB', ip: 'UTG',
    oopRange: api.villFlatSet('UTG', 'BB'), ipRange: api.rfiSet('UTG'), pot: 2 * open + 0.5, stack: 100 - open },
  SB_BB: { label: 'SB open, BB call', pfr: 'oop', oop: 'SB', ip: 'BB',
    oopRange: api.rfiSet('SB'), ipRange: api.villFlatSet('SB', 'BB'), pot: 2 * sbOpen, stack: 100 - sbOpen },
  BB3_BTN: { label: 'BB 3-bets BTN, BTN calls', pfr: 'oop', oop: 'BB', ip: 'BTN',
    oopRange: api.rng('3bet_vs.BTN'), ipRange: api.call3bSet('BTN', 'BB', 4), pot: 2 * 10 + 0.5, stack: 90 },
  BTN3_CO: { label: 'BTN 3-bets CO, CO calls', pfr: 'ip', oop: 'CO', ip: 'BTN',
    oopRange: api.call3bSet('CO', 'BTN', 3), ipRange: api.rng('3bet_vs.CO'), pot: 2 * 7.5 + 1.5, stack: 92.5 },
};
const out = {};
for (const [k, s] of Object.entries(spots)) {
  out[k] = { ...s, oopRange: str(s.oopRange), ipRange: str(s.ipRange) };
  console.log(k.padEnd(8), 'oop', api.setCombos(s.oopRange), 'combos · ip', api.setCombos(s.ipRange), 'combos · pot', s.pot, 'bb · stack', s.stack);
}
fs.writeFileSync(__dirname + '/spots.json', JSON.stringify(out, null, 1));
