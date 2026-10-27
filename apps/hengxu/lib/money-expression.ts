/** Evaluates a small arithmetic expression without executing JavaScript. Amounts are rounded to cents. */
export function parseMoneyExpression(input: string): number | null {
  const source = input.trim().normalize("NFKC").replace(/[×xX＊]/g, "*").replace(/[÷／]/g, "/").replace(/[−－]/g, "-").replace(/[＋]/g, "+").replace(/[=＝]\s*$/, "").replace(/\s+/g, "");
  if (!source || source.length > 100 || /[^0-9.+*/()\-]/.test(source)) return null;
  let position = 0;
  function number(): number {
    if (source[position] === "+") { position++; return number(); }
    if (source[position] === "-") { position++; return -number(); }
    if (source[position] === "(") { position++; const value = expression(); if (source[position++] !== ")") throw Error("missing parenthesis"); return value; }
    const match = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(source.slice(position));
    if (!match) throw Error("invalid number");
    position += match[0].length;
    return Number(match[0]);
  }
  function product(): number {
    let value = number();
    while (source[position] === "*" || source[position] === "/") { const operator = source[position++]; const next = number(); if (operator === "/" && next === 0) throw Error("division by zero"); value = operator === "*" ? value * next : value / next; }
    return value;
  }
  function expression(): number {
    let value = product();
    while (source[position] === "+" || source[position] === "-") { const operator = source[position++]; const next = product(); value = operator === "+" ? value + next : value - next; }
    return value;
  }
  try { const result = expression(); if (position !== source.length || !Number.isFinite(result)) return null; const cents = Math.round((result + Number.EPSILON) * 100); return cents > 0 && cents <= 1_000_000_000_00 ? cents / 100 : null; } catch { return null; }
}
