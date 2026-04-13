// Count Bijoy bigrams in the leftover fragments.
const BIJOY_BIGRAMS = new Set([
  "wP","wW","wb","wK","wL","wM","wN","wm","wk","wQ","wU","wf","wR","wS","wT","wj","wp","wq","wn","wH","wY","wv","wc","wd",
  "Kg","Kv","Lv","Mv","Nv","Pv","Qv","Sv","Uv","Vv","Wv","Xv","Zv","_v","av","bv","cv","dv","ev","fv","gv","hv","iv","jv","kv","lv","mv","nv","ov","pv","qv","rv",
  "eQ","eR","eK","eM","eP","eL","eN","eU","eV","eY","eZ","ej",
  "Qi","Mz","Mª","Mš","Kª","Pª","Zª","ed",
  "©K","©M","©Z","©c","©e","©g","©h","©i","©k","©l","©m",
  "GwW","GwK","GwM","Gw",
  "Ñ","Œ","‹","‡","ª","Ö","Š",
]);
function countBigrams(s) {
  let n = 0;
  for (let i = 0; i < s.length - 1; i++) {
    if (BIJOY_BIGRAMS.has(s.slice(i, i + 2))) n++;
  }
  return n;
}
const cases = [
  "cwiwPwZ bs",
  "cwiwPwZ",
  "bs",
  "bvg",
  "cwiwPwZ bs ",
];
for (const c of cases) {
  console.log(JSON.stringify(c), "bigrams =", countBigrams(c));
  for (let i = 0; i < c.length - 1; i++) {
    if (BIJOY_BIGRAMS.has(c.slice(i, i + 2))) console.log("  hit at", i, JSON.stringify(c.slice(i, i + 2)));
  }
}
