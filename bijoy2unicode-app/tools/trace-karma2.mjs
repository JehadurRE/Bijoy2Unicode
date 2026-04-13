// Debug what happens to "Kg©" through each pass.
// Replicate the relevant maps inline.

const HALANT = "\u09CD";

function isBanglaBanjonborno(c) {
  return (
    "কখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ".includes(c) ||
    c === "\u09DC" || c === "\u09DD" || c === "\u09DF" ||
    c === "ৎ" || c === "ং" || c === "ঃ" || c === "ঁ"
  );
}
function isBanglaHalant(c) { return c === HALANT; }

const input = "Kg©";
console.log("input bytes:", JSON.stringify(input));
// After conversionMap: K→ক, g→ম, ©→র্ (which is র + ্)
const afterMap = "ক" + "ম" + "র" + "\u09CD";
console.log("after single-byte map:", JSON.stringify(afterMap));
for (const c of afterMap) console.log("  ", JSON.stringify(c), "U+" + c.codePointAt(0).toString(16));

// Now run my new rule manually.
let str = afterMap;
let i = 0;
while (i < str.length - 1) {
  const cur = str[i];
  const next = str[i + 1];
  const prev = str[i - 1];
  const prev2 = str[i - 2];
  const after = str[i + 2];
  console.log(`\ni=${i} cur=${JSON.stringify(cur)} next=${JSON.stringify(next)} prev=${JSON.stringify(prev)} prev2=${JSON.stringify(prev2)} after=${JSON.stringify(after)}`);

  const condA = cur === "র";
  const condB = isBanglaHalant(next);
  const condC = i > 0;
  const condD = isBanglaBanjonborno(prev);
  const condE = !isBanglaHalant(prev2);
  const condF = !isBanglaBanjonborno(after);
  console.log("  conds:", condA, condB, condC, condD, condE, condF);
  if (condA && condB && condC && condD && condE && condF) {
    console.log("  RULE FIRES");
    let j = 1;
    while (true) {
      if (i - j - 1 < 0) break;
      if (isBanglaBanjonborno(str[i - j - 1]) && isBanglaHalant(str[i - j])) {
        j += 2;
      } else break;
    }
    console.log("  j =", j);
    str = str.slice(0, i - j) + cur + next + str.slice(i - j, i) + str.slice(i + 2);
    console.log("  new str:", JSON.stringify(str));
    i += 2;
    continue;
  }
  i += 1;
}
console.log("\nfinal:", JSON.stringify(str));
