import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/category-options.ts", import.meta.url), "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { categoryOptions, availableCategoryValue, createCategoryRequestGate, isCategoryLists } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
const data = {
  expenses: ["交通", "居住", "餐饮"],
  incomes: ["奖金", "工资", "兼职"],
  accounts: ["储蓄账户", "微信", "支付宝"],
  hidden: { expense: ["居住"], income: ["工资"], account: ["微信"] },
};

// New transactions and type switches respect both hidden choices and saved order.
assert.deepEqual(categoryOptions(data, "income"), ["奖金", "兼职"]);
assert.equal(availableCategoryValue(data, "income", "工资"), "奖金");
assert.equal(availableCategoryValue(data, "expense", "居住"), "交通");
assert.equal(availableCategoryValue(data, "account", "微信"), "储蓄账户");
assert.equal(availableCategoryValue(data, "account", "支付宝"), "支付宝");
assert.equal(availableCategoryValue(data, "expense", "餐饮"), "餐饮");

// Existing records can retain hidden or legacy names without making them available for new records.
assert.deepEqual(categoryOptions(data, "income", "工资"), ["奖金", "工资", "兼职"]);
assert.deepEqual(categoryOptions(data, "account", "旧银行卡"), ["储蓄账户", "支付宝", "旧银行卡"]);
assert.equal(availableCategoryValue(data, "account", "旧银行卡"), "储蓄账户");
assert.deepEqual(categoryOptions({ ...data, hidden: undefined }, "expense"), data.expenses);
assert.deepEqual(categoryOptions({ ...data, hidden: {} }, "account"), data.accounts);

// Corrupt or incomplete per-account caches cannot enable an unusable form.
assert.equal(isCategoryLists(data), true);
assert.equal(isCategoryLists(JSON.parse(JSON.stringify(data))), true);
for (const invalid of [null, {}, { ...data, accounts: [] }, { ...data, incomes: [1] }, { ...data, accounts: ["微信", "微信"] }, { ...data, expenses: [""] }, { ...data, hidden: [] }, { ...data, hidden: { account: ["不存在"] } }, { ...data, hidden: { account: data.accounts } }]) {
  assert.equal(isCategoryLists(invalid), false);
}

// Delayed reads cannot overwrite a completed save; focus reads wait during a mutation.
const gate = createCategoryRequestGate();
let visible = "initial";
let resolveRead;
const delayedRead = new Promise(resolve => { resolveRead = resolve; });
const readRequest = gate.read();
const read = delayedRead.then(value => { if (gate.current(readRequest)) visible = value; });
const saveRequest = gate.write();
assert.equal(gate.read(), null);
if (gate.current(saveRequest)) visible = "saved";
gate.finishWrite();
resolveRead("old server snapshot");
await read;
assert.equal(visible, "saved");
const olderFocus = gate.read();
const newerFocus = gate.read();
assert.equal(gate.current(olderFocus), false);
assert.equal(gate.current(newerFocus), true);
gate.invalidate();
assert.equal(gate.current(newerFocus), false);

console.log("Category order, hidden and historical options, cache validation and stale-response protection passed");
