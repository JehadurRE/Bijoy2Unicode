import { convertBijoyToUnicode } from "../src/lib/bijoy-to-unicode.ts";

console.log(convertBijoyToUnicode("Kg©"));   // expect কর্ম
console.log(convertBijoyToUnicode("Kg©KZ©v")); // expect কর্মকর্তা
console.log(convertBijoyToUnicode("Kg©KZ©vi")); // expect কর্মকর্তার
