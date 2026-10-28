import { CalendarClock, ReceiptText, TrendingUp, Wallet } from "lucide-react";
import { moneyCents } from "../../lib/studio-domain";

export default function StudioMetric({ label, value, foot, kind = "" }: {
  label: string; value: number; foot: string; kind?: string;
}) {
  const Icon = label.includes("待收") || label.includes("逾期") ? CalendarClock
    : label.includes("支出") ? ReceiptText : label.includes("结余") ? Wallet : TrendingUp;
  return <article className={`st-metric ${kind}`}>
    <div className="st-metric-top"><span>{label}</span><span className="st-metric-symbol"><Icon size={18} /></span></div>
    <strong>{moneyCents(value)}</strong><small>{foot}</small>
  </article>;
}
