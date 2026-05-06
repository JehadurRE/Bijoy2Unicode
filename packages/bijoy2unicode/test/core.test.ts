import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  convertBijoyToUnicode,
  hasBengaliUnicode,
  looksLikeBijoy,
  shouldConvertAsBijoy,
  scanUnmapped,
  isSuspiciousLeftover,
} from "../src/core.ts";

const cases: Array<[string, string]> = [
  // Classics
  ["Avgvi †mvbvi evsjv", "আমার সোনার বাংলা"],
  ["evsjv", "বাংলা"],
  // Reph (©)
  ["(†iKW©)", "(রেকর্ড)"],
  ["Kg©KZ©vi", "কর্মকর্তার"],
  // Í alternate (alternative em-dash for ন্ত / স্ত)
  ["we¯ÍvwiZ", "বিস্তারিত"],
  ["msµvšÍ", "সংক্রান্ত"],
  ["msµvšÍ Z_¨mg~nt", "সংক্রান্ত তথ্যসমূহঃ"],
  // i + æ → রু
  ["†gvt b~iæj", "মোঃ নূরুল"],
  ["iæcv", "রুপা"],
  // ÿ → ক্ষ
  ["wkÿv", "শিক্ষা"],
  ["ÿgZv", "ক্ষমতা"],
  // Conjunct-heavy
  ["wek¦we`¨vjq", "বিশ্ববিদ্যাল\u09DF"],
  ["cÖavbgš¿x", "প্রধানমন্ত্রী"],
  ["K…wlweÁvb", "কৃষিবিজ্ঞান"],
  // Empty / falsy passes through
  ["", ""],
];

for (const [input, expected] of cases) {
  test(`convertBijoyToUnicode: ${JSON.stringify(input)}`, () => {
    assert.equal(convertBijoyToUnicode(input), expected);
  });
}

test("hasBengaliUnicode detects Bengali characters", () => {
  assert.equal(hasBengaliUnicode("Hello world"), false);
  assert.equal(hasBengaliUnicode("Avgvi"), false);
  assert.equal(hasBengaliUnicode("আমার"), true);
});

test("looksLikeBijoy detects high-byte chars", () => {
  assert.equal(looksLikeBijoy("Hello"), false);
  assert.equal(looksLikeBijoy("Avgvi †mvbvi"), true);
  assert.equal(looksLikeBijoy("আমার"), false);
});

test("shouldConvertAsBijoy combines hints correctly", () => {
  // Pure English – never
  assert.equal(shouldConvertAsBijoy("Hello world"), false);
  // Pure Bijoy with high-byte chars – yes
  assert.equal(shouldConvertAsBijoy("Avgvi †mvbvi evsjv"), true);
  // Already Unicode Bangla – never
  assert.equal(shouldConvertAsBijoy("আমার বাংলা"), false);
  // Explicit hint overrides
  assert.equal(shouldConvertAsBijoy("Hello", true), true);
  assert.equal(shouldConvertAsBijoy("Avgvi", false), false);
});

test("scanUnmapped returns counts of suspicious chars", () => {
  const out = scanUnmapped("পরিচিতি বিস্তারিত");
  assert.equal(out.size, 0);
  const out2 = scanUnmapped("partial ÿ test ÿ ‡");
  assert.ok(out2.size > 0);
  assert.equal(out2.get("ÿ"), 2);
  assert.equal(out2.get("‡"), 1);
});

test("isSuspiciousLeftover: ASCII and Bengali pass", () => {
  assert.equal(isSuspiciousLeftover("a"), false);
  assert.equal(isSuspiciousLeftover("ক"), false);
  assert.equal(isSuspiciousLeftover(" "), false);
  assert.equal(isSuspiciousLeftover("।"), false);
});

test("isSuspiciousLeftover: Latin extended is suspicious", () => {
  assert.equal(isSuspiciousLeftover("ÿ"), true);
  assert.equal(isSuspiciousLeftover("‡"), true);
  assert.equal(isSuspiciousLeftover("§"), true);
});
