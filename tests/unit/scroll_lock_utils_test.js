const fs = require("fs");
const path = require("path");
const assert = require("assert");

const sourcePath = path.join(__dirname, "..", "..", "links-guard.js");
const source = fs.readFileSync(sourcePath, "utf8");

const match = source.match(
  /const computeScrollLockPadding = \([^)]*\) => \{[\s\S]*?\n\s*};/
);

if (!match) {
  throw new Error("Funzione computeScrollLockPadding non trovata in links-guard.js");
}

const computeScrollLockPadding = new Function(
  `${match[0]}; return computeScrollLockPadding;`
)();

assert.strictEqual(computeScrollLockPadding(0, 0), 0);
assert.strictEqual(computeScrollLockPadding(12, 8), 20);
assert.strictEqual(computeScrollLockPadding(12, -4), 12);
assert.strictEqual(computeScrollLockPadding(-2, 10), 10);
assert.strictEqual(
  computeScrollLockPadding(4, Number.NaN),
  4,
  "Valori NaN non devono alterare il padding di base"
);

console.log("scroll_lock_utils_test: tutti i casi superati");
