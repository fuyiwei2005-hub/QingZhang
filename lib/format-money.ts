const formatter = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function money(value: number) { return `¥ ${formatter.format(value)}`; }
