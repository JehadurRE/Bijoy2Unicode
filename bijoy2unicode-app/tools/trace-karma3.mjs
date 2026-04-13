// Trace each pass through the rearrange manually for Kg©KZ©v.
import { convertBijoyToUnicode } from "../src/lib/bijoy-to-unicode.ts";

const inputs = ["Kg©", "Kg©K", "Kg©KZ©v", "Kg©KZ©vi"];
for (const x of inputs) {
  console.log(JSON.stringify(x), "→", JSON.stringify(convertBijoyToUnicode(x)));
}
