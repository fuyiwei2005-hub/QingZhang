import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { shiftMonth, todayChina } from "../../lib/ledger-domain";
import { moneyCents as money, studioSummary, type StudioData } from "../../lib/studio-domain";
import StudioMetric from "./studio-metric";

export default function StudioOverview({ data, name, month, onMonthChange }: {
  data: StudioData; name: string; month: string; onMonthChange: (month: string) => void;
}) {
  const thisMonth = todayChina().slice(0, 7);
  const summary = studioSummary(data, month);
  const period = month === thisMonth ? "本月" : "所选月";
  const history = Array.from({ length: 6 }, (_, index) => {
    const key = shiftMonth(month, index - 5);
    return { key, ...studioSummary(data, key) };
  });
  const chartMax = Math.max(1, ...history.flatMap(row => [row.income, row.expense]));
  const hasHistory = history.some(row => row.income || row.expense);

  return <>
    <div className="st-overview-hero">
      <div className="st-hero-copy">
        <p className="st-eyebrow"><span className="st-status-light" /> HENGXU <span className="st-hero-subtitle">· BUSINESS INTELLIGENCE</span></p>
        <p className="st-hero-greeting">你好，{name}</p>
        <h2>经营全局，<br />尽在<span>掌握。</span></h2>
        <p>以实际收支为依据，清晰呈现资金流向与经营表现。</p>
      </div>
      <div className="st-hero-art" aria-hidden="true">
        <div className="st-art-orbit" /><div className="st-art-orbit inner" />
        <div className="st-art-platform" />
        <div className="st-art-pillar pillar-back"><i /><span /></div>
        <div className="st-art-pillar pillar-middle"><i /><span /></div>
        <div className="st-art-pillar pillar-front"><i /><span /></div>
        <div className="st-art-seal">H<span>HENGXU</span></div>
      </div>
      <div className="st-hero-period">
        <span>经营视角 / 按月查看</span>
        <div className="st-period-control">
          <button className="st-icon-button" aria-label="上个月" onClick={() => onMonthChange(shiftMonth(month, -1))}><ChevronLeft size={16} /></button>
          <label className="st-month"><CalendarClock size={16} /><input type="month" aria-label="总览月份" max={thisMonth} value={month} onChange={event => {
            if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value) && event.target.value <= thisMonth) onMonthChange(event.target.value);
          }} /></label>
          <button className="st-icon-button" aria-label="下个月" disabled={month >= thisMonth} onClick={() => onMonthChange(shiftMonth(month, 1))}><ChevronRight size={16} /></button>
        </div>
        {month !== thisMonth && <button className="st-period-today" onClick={() => onMonthChange(thisMonth)}>回到本月</button>}
      </div>
    </div>
    <div className="st-metrics">
      <StudioMetric label={`${period}实际收入`} value={summary.income} foot={`${month} · 已登记到账`} kind="income" />
      <StudioMetric label={`${period}实际支出`} value={summary.expense} foot={`${month} · 项目成本与经营支出`} />
      <StudioMetric label={`${period}收支结余`} value={summary.balance} foot="实际收入 − 实际支出" />
      <StudioMetric label="项目待收款" value={summary.remaining} foot={summary.overdue ? `截至今天 · 其中逾期 ${money(summary.overdue)}` : "截至今天 · 全部项目未到账款项"} kind="highlight" />
    </div>
    <section className="st-panel st-overview-chart">
      <div className="st-panel-heading"><div><h3>收支节奏</h3><p>{history[0].key} — {month} · 实际现金流</p></div><div className="st-chart-key"><span><i />收入</span><span><i />支出</span></div></div>
      <div className="st-chart-plot"><div className="st-chart-scale" aria-hidden="true"><span>{money(hasHistory?chartMax:0)}</span><span>{money(hasHistory?Math.round(chartMax/2):0)}</span><span>0</span></div><div className="st-cash-chart">{history.map(row => <div key={row.key}>
        <div className="st-chart-bars" role="img" aria-label={`${row.key}收入${money(row.income)}支出${money(row.expense)}`} title={`${row.key} 收入${money(row.income)} · 支出${money(row.expense)}`}>
          <span style={{ height: `${Math.max(1, row.income / chartMax * 100)}%` }}>{row.income > 0 && <b className="st-chart-value">{money(row.income)}</b>}</span>
          <span style={{ height: `${Math.max(1, row.expense / chartMax * 100)}%` }} />
        </div><small>{Number(row.key.slice(5))}月</small>
      </div>)}</div></div>
      <div className="st-chart-note"><span>{hasHistory ? "按实际发生日期统计，未到账款项不计入" : "这段时间还没有收支记录，登记后会自动生成趋势"}</span></div>
    </section>
  </>;
}
