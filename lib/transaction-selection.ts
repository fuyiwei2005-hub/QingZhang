type Row = { id: number; type: "income" | "expense"; amount: number };

export function selectedTotals(rows: Row[], selected: ReadonlySet<number>) {
  let income = 0, expense = 0, count = 0;
  const seen = new Set<number>();
  for (const row of rows) {
    if (!selected.has(row.id) || seen.has(row.id)) continue;
    seen.add(row.id); count++;
    const cents = Math.round(row.amount * 100);
    if (row.type === "income") income += cents; else expense += cents;
  }
  return { count, income: income / 100, expense: expense / 100, balance: (income - expense) / 100 };
}
