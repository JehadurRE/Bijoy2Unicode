import { convertBijoyToUnicode } from "../src/lib/bijoy-to-unicode.ts";

const got = convertBijoyToUnicode("wek¦we`¨vjq");
const expected = "বিশ্ববিদ্যালয়";

console.log("got     :", JSON.stringify(got));
console.log("expected:", JSON.stringify(expected));
console.log("got len  =", got.length, "expected len =", expected.length);
for (let i = 0; i < Math.max(got.length, expected.length); i++) {
  const g = got[i] || "";
  const e = expected[i] || "";
  if (g !== e) {
    console.log(`  @${i}: got=U+${g ? g.codePointAt(0).toString(16) : "?"}  expected=U+${e ? e.codePointAt(0).toString(16) : "?"}`);
  }
}
