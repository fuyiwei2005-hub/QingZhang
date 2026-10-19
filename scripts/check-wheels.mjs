import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = readFileSync(new URL("../lib/wheel.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { wheelInput, randomWheelIndex } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
assert.deepEqual(wheelInput({ title: " 晚餐 ", options: [" 面条 ", "米饭"] }), { title: "晚餐", options: ["面条", "米饭"] });
for (const value of [null, {}, { title: " ", options: ["A", "B"] }, { title: "A", options: ["A"] }, { title: "A", options: ["A", " "] }, { title: "A", options: [1, "B"] }, { title: "A", options: Array(41).fill("A") }, { title: "A", options: ["A".repeat(61), "B"] }]) assert.equal(wheelInput(value), null);
assert.ok(wheelInput({ title: "A", options: Array(40).fill("选项") }));
// Force a rejected value first, then verify the retry and resulting index.
const original = globalThis.crypto;
let calls = 0;
Object.defineProperty(globalThis, "crypto", { configurable: true, value: { getRandomValues: array => { array[0] = calls++ === 0 ? 0xffffffff : 8; return array; } } });
assert.equal(randomWheelIndex(3), 2);
assert.equal(calls, 2);
Object.defineProperty(globalThis, "crypto", { configurable: true, value: original });
for (let count = 2; count <= 40; count++) {
 for (let i = 0; i < 100; i++) {
  const selected = randomWheelIndex(count);
  assert.ok(selected >= 0 && selected < count);
  const rotation = (360 - (selected + .5) * 360 / count) % 360;
  const pointer = (360 - rotation) % 360;
  assert.equal(Math.floor(pointer / (360 / count)), selected);
 }
}
assert.throws(() => randomWheelIndex(1));
assert.throws(() => randomWheelIndex(41));
console.log("Wheel validation, unbiased selection and pointer alignment passed");
