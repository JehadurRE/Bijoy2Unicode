// Standalone heuristic test for `looksLikeEnglish`. Pure JS, no imports.
// Mirrors the version used inside src/lib/format-converters.ts so we can
// quickly evaluate edge cases without rebuilding the app.
//
// Run: node tools/test-classify.mjs

const BIJOY_BIGRAMS = new Set([
  "wP","wW","wb","wK","wL","wM","wN","wm","wk","wQ","wU","wf","wR","wS","wT","wj","wp","wq","wn","wH","wY","wv","wc","wd",
  "Kg","Kv","Lv","Mv","Nv","Pv","Qv","Sv","Uv","Vv","Wv","Xv","Zv","_v","av","bv","cv","dv","ev","fv","gv","hv","iv","jv","kv","lv","mv","nv","ov","pv","qv","rv",
  "eQ","eR","eK","eM","eP","eL","eN","eU","eV","eY","eZ","ej",
  "Qi","Mz","Mª","Mš","Kª","Pª","Zª","ed",
  "©K","©M","©Z","©c","©e","©g","©h","©i","©k","©l","©m",
  "GwW","GwK","GwM","Gw",
  "Ñ","Œ","‹","‡","ª","Ö","Š",
]);

function hasBijoyBigram(s) {
  for (let i = 0; i < s.length - 1; i++) {
    if (BIJOY_BIGRAMS.has(s.slice(i, i + 2))) return true;
  }
  return false;
}

const ENGLISH_HINT_WORDS = new Set([
  "the","of","and","to","in","is","was","are","be","by","for","on","at","with","from","this","that",
  "as","or","if","an","a","it","its","but","not","you","your","my","our","their","they","i","we",
  "name","date","age","year","month","day","sir","madam","mr","mrs","ms","dr","prof","mister",
  "born","father","mother","spouse","son","daughter","family","address","village","district",
  "thana","upazila","division","country","email","phone","mobile","cell","office","home","present",
  "permanent","yes","no","male","female","married","unmarried","single","total","page",
  "education","school","college","university","degree","class","subject","department","branch",
  "designation","post","position","rank","grade","officer","officers","service","duty","duties",
  "joining","retirement","passport","number","reg","regd","cert","certificate","training",
  "experience","english","bangla","bengali","national","government","ministry","secretariat",
  "honorable","honourable","please","kindly","thank","thanks","regards","yours","faithfully",
  "sincerely","whatsapp","telephone",
  "bio","data","cv","resume","photo","page","of","total","sl","sn","ref","subject","date",
  "ddg","adg","ig","sp","asp","gen","brig","col","lt","capt","major","maj","cmdr","cmdt",
]);

function looksLikeEnglish(text) {
  const t = text.trim();
  if (!t) return false;
  if (/`/.test(t)) return false;
  if (/[~^][A-Za-z]/.test(t)) return false;
  if (/[A-Za-z]&/.test(t)) return false;
  if (/\d[A-Za-z]/.test(t)) return false;
  if (hasBijoyBigram(t)) return false;
  if (/[bcdfghjklmnpqrstvwxzBCDFGHJKLMNPQRSTVWXZ]{3,}/.test(t)) return false;
  const lower = t.toLowerCase();
  const tokens = lower.match(/[a-z][a-z']*/g) || [];
  for (const tok of tokens) if (ENGLISH_HINT_WORDS.has(tok)) return true;
  const letters = lower.replace(/[^a-z]/g, "");
  if (letters.length === 0) return true;
  if (letters.length < 4) return tokens.every((t) => ENGLISH_HINT_WORDS.has(t));
  let vowels = 0;
  for (const c of letters) if ("aeiouy".includes(c)) vowels++;
  const ratio = vowels / letters.length;
  if (ratio < 0.35) return false;
  let earlyVowel = false;
  for (let i = 0; i < Math.min(4, letters.length); i++) {
    if ("aeiouy".includes(letters[i])) {
      earlyVowel = true;
      break;
    }
  }
  return earlyVowel;
}

const cases = [
  " eQi ",
  "eQi",
  "cwiwPwZ bs",
  "GwWG",
  "0 eQi 5gvm 17w`b",
  "bvg",
  "wcZvi bvg",
  "Hello world",
  "Name",
  "Date of Birth",
  "Sir",
  "Mr",
  "5",
  "abcd",
  "Official Visit/Training/FAT/Workshop/Duty",
  "Type of visit",
  "Official/Private",
  "Official",
  "Visit With Karate Team-2018",
  "Foreign",
  "FAT",
  "Workshop",
  "Duty",
  "Calibri",
];
for (const c of cases) {
  console.log(JSON.stringify(c).padEnd(50), "→", looksLikeEnglish(c));
}
