import assert from "node:assert/strict";
import { emptyFilter, filterTransactions } from "../lib/transaction-filter";
const rows = [
  { type: "expense", amount: 12.35, category: "餐饮", account: "微信", note: "早餐", occurredAt: "2026-10-01T12:00:00Z" },
  { type: "expense", amount: 30, category: "交通", account: "现金", note: "Taxi", occurredAt: "2026-10-31T12:00:00Z" },
  { type: "income", amount: 5000, category: "工资", account: "银行卡", note: "月薪", occurredAt: "2026-11-01T12:00:00Z" },
];
assert.equal(filterTransactions(rows, emptyFilter).length, 3);
assert.deepEqual(filterTransactions(rows, { ...emptyFilter, from: "2026-10-01", to: "2026-10-31", min: "12.35", max: "30", type: "expense" }), rows.slice(0, 2));
assert.deepEqual(filterTransactions(rows, { ...emptyFilter, query: "  TAXI  ", account: "现金", category: "交通" }), [rows[1]]);
assert.equal(filterTransactions(rows, { ...emptyFilter, query: "早餐", type: "income" }).length, 0);
assert.equal(filterTransactions(rows, { ...emptyFilter, min: "31", max: "30" }).length, 0);
assert.equal(filterTransactions(rows, { ...emptyFilter, from: "2026-11-01", to: "2026-10-01" }).length, 0);
assert.deepEqual(filterTransactions(rows, { ...emptyFilter, max: "12.35" }), [rows[0]]);
console.log("PASS: combined filters, inclusive dates and decimals, case-insensitive search, empty and invalid ranges");
