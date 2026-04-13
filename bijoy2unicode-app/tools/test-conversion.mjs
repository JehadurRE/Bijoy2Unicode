// Quick conversion smoke-test for specific Bijoy strings.
import { convertBijoyToUnicode } from "../src/lib/bijoy-to-unicode.ts";

const samples = [
  // The user's sample
  { in: "†gvt b~iæj nvmvb dwi`x", expected: "মোঃ নূরুল হাসান ফরিদী" },
  { in: "b~iæj", expected: "নূরুল" },
  { in: "iæ", expected: "রু" },
  { in: "æ", expected: "ু" },
  // New samples reported as broken
  { in: "(†iKW©)", expected: "(রেকর্ড)" },
  { in: "we¯ÍvwiZ", expected: "বিস্তারিত" },
  { in: "msµvšÍ", expected: "সংক্রান্ত" },
  { in: "Z_¨mg~nt", expected: "তথ্যসমূহঃ" },
  { in: "msµvšÍ Z_¨mg~nt", expected: "সংক্রান্ত তথ্যসমূহঃ" },
  // Other common Bangla phrases that should still pass
  { in: "Avgvi †mvbvi evsjv", expected: "আমার সোনার বাংলা" },
  { in: "evsjv", expected: "বাংলা" },
  { in: "wkÿv", expected: "শিক্ষা" },
  { in: "wek¦we`¨vjq", expected: "বিশ্ববিদ্যাল\u09DF" },
  { in: "cÖavbgš¿x", expected: "প্রধানমন্ত্রী" },
  { in: "K…wlweÁvb", expected: "কৃষিবিজ্ঞান" },
  // Multi-char sequences (Mø, cø, etc.)
  { in: "evMøv‡`k", expected: "বাগ্লাদেশ" }, // synthetic test for Mø
  // Bijoy ru variants
  { in: "iæcv", expected: "রুপা" },
  { in: "wmiæc", expected: "সিরুপ" },
  { in: "dwi`x", expected: "ফরিদী" },
];

let pass = 0;
for (const s of samples) {
  const got = convertBijoyToUnicode(s.in);
  const ok = got === s.expected;
  console.log(ok ? "PASS" : "FAIL");
  console.log("  in      :", JSON.stringify(s.in));
  console.log("  expected:", JSON.stringify(s.expected));
  console.log("  got     :", JSON.stringify(got));
  if (ok) pass++;
}
console.log(`\n${pass}/${samples.length}`);
