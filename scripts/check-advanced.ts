import assert from "node:assert/strict";
import { occurrenceDates, shiftMonth, validDate, entryInput } from "../lib/ledger-domain";
assert.equal(validDate("2026-02-30"), false);
assert.equal(validDate("2024-02-29"), true);
assert.equal(shiftMonth("2026-01", -1), "2025-12");
assert.deepEqual(occurrenceDates("2026-01-31", "monthly", "2026-03-31"), ["2026-01-31", "2026-02-28", "2026-03-31"]);
assert.deepEqual(occurrenceDates("2024-02-29", "yearly", "2028-02-29"), ["2024-02-29", "2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"]);
assert.deepEqual(occurrenceDates("2026-10-01", "weekly", "2026-10-31", "2026-10-15"), ["2026-10-01", "2026-10-08", "2026-10-15"]);
console.log("PASS: recurring month-end/leap-year/week schedules and date validation");
