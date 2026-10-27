export type TransactionFilter = { query: string; type: string; category: string; account: string; from: string; to: string; min: string; max: string };
export const emptyFilter: TransactionFilter = { query: "", type: "", category: "", account: "", from: "", to: "", min: "", max: "" };
type Searchable = { type: string; category: string; account: string; note: string; occurredAt: string; amount: number };
export function filterTransactions<T extends Searchable>(rows: T[], filter: TransactionFilter): T[] {
  const query = filter.query.trim().toLocaleLowerCase();
  return rows.filter((row) => {
    const date = row.occurredAt.slice(0, 10);
    return (!query || `${row.note} ${row.category} ${row.account}`.toLocaleLowerCase().includes(query))
      && (!filter.type || row.type === filter.type) && (!filter.category || row.category === filter.category)
      && (!filter.account || row.account === filter.account) && (!filter.from || date >= filter.from)
      && (!filter.to || date <= filter.to) && (!filter.min || row.amount >= Number(filter.min))
      && (!filter.max || row.amount <= Number(filter.max));
  });
}
