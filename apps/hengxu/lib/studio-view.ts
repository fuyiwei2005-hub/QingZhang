import type { Entry, StudioData } from "./studio-domain";

export type LedgerFilters = {
  search: string;
  type: string;
  projectId: string;
  month: string;
};

export const defaultLedgerFilters: LedgerFilters = {
  search: "", type: "all", projectId: "", month: "all",
};

export function filterEntries(data: StudioData, filters: LedgerFilters) {
  const query = filters.search.trim().toLocaleLowerCase();
  return data.entries
    .filter(entry => !entry.deletedAt &&
      (filters.type === "all" || entry.type === filters.type) &&
      (!filters.projectId || (filters.projectId === "daily" ? !entry.projectId : entry.projectId === filters.projectId)) &&
      (filters.month === "all" || entry.date.startsWith(filters.month)) &&
      `${entry.note} ${entry.category} ${entry.account}`.toLocaleLowerCase().includes(query))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function entryTotals(entries: Entry[]) {
  let income = 0, expense = 0;
  for (const entry of entries) {
    if (entry.type === "income") income += entry.amountCents;
    else expense += entry.amountCents;
  }
  return { income, expense, balance: income - expense };
}

// Keep the exported scope identical to the list and neutralize spreadsheet formulas.
export function entriesCsv(entries: Entry[], data: StudioData) {
  const cell = (value: string) => `"${(/^[\s]*[=+@\-]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
  const rows = [["日期", "收支", "项目", "分类", "金额（元）", "账户", "备注"],
    ...entries.map(entry => [entry.date, entry.type === "income" ? "收入" : "支出",
      data.projects.find(project => project.id === entry.projectId)?.title || "日常经营",
      entry.category, (entry.amountCents / 100).toFixed(2), entry.account, entry.note])];
  return "\ufeff" + rows.map(row => row.map(cell).join(",")).join("\r\n");
}
