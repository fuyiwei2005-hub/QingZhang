"use client";
import { Children, ReactNode, isValidElement, useEffect, useState } from "react";

export function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => { const media = matchMedia("(max-width: 767px)"); const update = () => setPhone(media.matches); update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []);
  return phone;
}
export function MobileSections({ children, labels, className = "", active, onActive, initial = 0 }: { children: ReactNode; labels: string[]; className?: string; initial?: number; active?: number; onActive?: (index: number) => void }) {
  const [current, setCurrent] = useState(initial);
  const parts = Children.toArray(children).filter(child => isValidElement(child));
  const selected = Math.min(active ?? current, Math.max(0, parts.length - 1));
  return <div className={`mobile-sections ${className}`}><div className="phone-section-switch" role="group" aria-label="页面内容切换">{parts.map((_, index) => <button key={index} type="button" aria-pressed={selected === index} onClick={() => { setCurrent(index); onActive?.(index); }}>{labels[index] || `第 ${index + 1} 项`}</button>)}</div>{parts.map((part, index) => <div key={index} className={`mobile-section ${selected === index ? "is-active" : ""}`}>{part}</div>)}</div>;
}
export function MobileList<T>({ items, render, size = 3 }: { items: T[]; render: (item: T) => ReactNode; size?: number }) {
  const phone = usePhone(); const [page, setPage] = useState(0);
  const count = Math.max(1, Math.ceil(items.length / size)); const current = Math.min(page, count - 1);
  return <>{(phone ? items.slice(current * size, (current + 1) * size) : items).map(render)}{phone && count > 1 && <PageButtons page={current} count={count} onPage={setPage}/>}</>;
}
export function PageButtons({page, count, onPage}: {page: number; count: number; onPage: (page: number) => void}) {
  return <nav className="phone-pages" aria-label="内容分页"><button type="button" disabled={page === 0} onClick={() => onPage(page - 1)}>上一页</button><span aria-live="polite">{page + 1} / {count}</span><button type="button" disabled={page + 1 >= count} onClick={() => onPage(page + 1)}>下一页</button></nav>;
}
