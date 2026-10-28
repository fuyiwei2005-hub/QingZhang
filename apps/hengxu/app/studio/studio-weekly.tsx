"use client";
import { useState } from "react";
import { Copy, Download } from "lucide-react";
import { todayChina } from "../../lib/ledger-domain";
import { weeklyReport } from "../../lib/studio-weekly";
import { type StudioData, moneyCents as money } from "../../lib/studio-domain";

export default function StudioWeekly({data, projectId: initialProject="", demo}:{data:StudioData;projectId?:string;demo:boolean}) {
  const [end,setEnd]=useState(todayChina()), [projectId,setProject]=useState(initialProject), [message,setMessage]=useState("");
  const report=weeklyReport(data,end,projectId);
  function download(){const url=URL.createObjectURL(new Blob([report.text],{type:"text/plain;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=`衡序经营周报-${end}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  return <section className="st-panel st-weekly"><div className="st-panel-heading"><div><h3>经营周报</h3><p>{demo?"示例数据 · ":""}系统计算 · 不消耗 AI 次数</p></div></div>
    <div className="st-form-grid"><label className="st-field"><span>近7日的结束日期</span><input type="date" min="1900-01-15" max={todayChina()} value={end} onChange={e=>{if(e.target.validity.valid&&e.target.value){setEnd(e.target.value);setMessage("");}}}/></label><label className="st-field"><span>统计范围</span><select value={projectId} onChange={e=>{setProject(e.target.value);setMessage("");}}><option value="">全部经营记录</option>{data.projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label></div>
    <div className="st-filter-summary"><span>收入 <b>{money(report.totals.income)}</b></span><span>支出 <b>{money(report.totals.expense)}</b></span><span>结余 <b>{money(report.totals.balance)}</b></span></div>
    <pre className="st-report-text">{report.text}</pre><div className="st-settings-actions"><button className="st-button primary" onClick={async()=>{try{await navigator.clipboard.writeText(report.text);setMessage("周报已复制");}catch{setMessage("暂时无法复制，可下载文本或选中文字复制");}}}><Copy size={16}/>复制周报</button><button className="st-button secondary" onClick={download}><Download size={16}/>下载文本</button></div>{message&&<p role="status" className="st-help">{message}</p>}
  </section>;
}
