export type CategoryKind = "expense" | "income" | "account";
export type CategoryLists = {
  accounts: string[];
  expenses: string[];
  incomes: string[];
  hidden?: Partial<Record<CategoryKind, string[]>>;
};

export function isCategoryLists(value: unknown): value is CategoryLists {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  if (data.hidden !== undefined && (!data.hidden || typeof data.hidden !== "object" || Array.isArray(data.hidden))) return false;
  for (const [kind, key] of [["account", "accounts"], ["expense", "expenses"], ["income", "incomes"]] as const) {
    const names = data[key];
    if (!Array.isArray(names) || !names.length || names.some(name => typeof name !== "string" || !name.trim() || name.length > 20) || new Set(names).size !== names.length) return false;
    const hidden = (data.hidden as Record<string, unknown> | undefined)?.[kind];
    if (hidden !== undefined && (!Array.isArray(hidden) || hidden.some(name => !names.includes(name)) || new Set(hidden).size !== hidden.length || hidden.length >= names.length)) return false;
  }
  return true;
}

// A current value is supplied only when editing an existing record.
export function categoryOptions(data: CategoryLists, type: CategoryKind, current?: string) {
  const names = type === "account" ? data.accounts : type === "income" ? data.incomes : data.expenses;
  const visible = names.filter(name => name === current || !data.hidden?.[type]?.includes(name));
  return current && !visible.includes(current) ? [...visible, current] : visible;
}

export function availableCategoryValue(data: CategoryLists, type: CategoryKind, value?: string) {
  const names = categoryOptions(data, type);
  return value && names.includes(value) ? value : names[0] || "";
}

// A focus refresh must never replace a later save with an older response.
export function createCategoryRequestGate() {
  let revision = 0;
  let writing = 0;
  return {
    read: () => writing ? null : ++revision,
    write: () => { writing++; return ++revision; },
    finishWrite: () => { writing--; },
    current: (request: number) => request === revision,
    invalidate: () => { revision++; },
  };
}
