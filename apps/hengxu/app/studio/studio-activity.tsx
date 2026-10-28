"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/client-api";
import { moneyCents, type StudioData } from "../../lib/studio-domain";

type Snapshot=Record<string,string|number|null>;
type Activity={id:number;entity:string;recordId:string;action:string;before:Snapshot|null;after:Snapshot;createdAt:string};
type Page={rows:Activity[];next:number|null};
const entities:Record<string,string>={client:"客户",project:"项目",stage:"回款分期",entry:"收支",task:"交付事项"};
const labels:Record<string,string>={name:"名称",contact:"联系方式",note:"备注",client_id:"关联客户",title:"名称",description:"说明",contract_cents:"约定金额",due_date:"约定日期",status:"项目状态",project_id:"关联项目",amount_cents:"金额",stage_id:"对应分期",type:"收支类型",date:"发生日期",category:"分类",account:"账户",deleted_at:"回收站状态",done:"完成状态"};
export default function StudioActivity({data,demo}:{data:StudioData;demo:boolean}) {
  const [entity,setEntity]=useState(""),[rows,setRows]=useState<Activity[]>([]),[next,setNext]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const generation=useRef(0);
  const load=useCallback(async(cursor:number|null=null)=>{if(demo)return;const token=++generation.current;setBusy(true);setError("");try{const page=await api<Page>(`/api/studio/activity?entity=${entity}${cursor?`&before=${cursor}`:""}`);if(token===generation.current){setRows(old=>cursor?[...old,...page.rows]:page.rows);setNext(page.next);}}catch{if(token===generation.current)setError("修改记录暂时无法加载，请重试");}finally{if(token===generation.current)setBusy(false);}},[entity,demo]);
  useEffect(()=>{setRows([]);setNext(null);void load();return()=>{generation.current++;};},[load]);
  function value(key:string,v:Snapshot[string]) {
    if(key==="deleted_at")return v?"已移入回收站":"有效记录";
    if(key==="done")return v?"已完成":"未完成";
    if(v===null||v==="")return "未填写";
    if(key.endsWith("_cents"))return moneyCents(Number(v));
    if(key==="project_id")return data.projects.find(p=>p.id===v)?.title||"原关联项目";
    if(key==="client_id")return data.clients.find(c=>c.id===v)?.name||"原关联客户";
    if(key==="stage_id")return data.stages.find(s=>s.id===v)?.title||"原关联分期";
    if(key==="status")return ({active:"进行中",delivered:"已交付",archived:"已归档"} as Record<string,string>)[String(v)]||String(v);
    if(key==="type")return v==="income"?"收入":"支出";
    return String(v);
  }
  return <section className="st-panel st-activity"><div className="st-panel-heading"><div><h3>修改记录</h3><p>从此功能上线起记录；仅当前账号可见。关联名称显示当前名称。</p></div><label className="st-field"><span className="sr-only">记录类型</span><select aria-label="修改记录类型" disabled={busy} value={entity} onChange={e=>setEntity(e.target.value)}><option value="">全部类型</option>{Object.entries(entities).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label></div>
    {demo?<div className="st-small-empty"><p>示例体验不写入修改记录。登录后，实际操作会自动留痕。</p></div>:<>
      {rows.map(row=><details className="st-activity-row" key={row.id}><summary><span><strong>{({create:"新建",update:"修改",delete:"移入回收站",restore:"恢复"} as Record<string,string>)[row.action]} · {entities[row.entity]}</strong><small>{String(row.after.title||row.after.name||row.after.note||row.after.category||entities[row.entity])}</small></span><time dateTime={row.createdAt}>{new Intl.DateTimeFormat("zh-CN",{timeZone:"Asia/Shanghai",dateStyle:"short",timeStyle:"medium"}).format(new Date(row.createdAt))}</time></summary><dl>{Object.keys(row.after).filter(key=>labels[key]&&(!row.before||row.before[key]!==row.after[key])).map(key=><div key={key}><dt>{labels[key]}</dt><dd>{row.before&&<><span className="st-before">{value(key,row.before[key])}</span><span aria-label="改为"> → </span></>}{value(key,row.after[key])}</dd></div>)}</dl></details>)}
      {error&&<p role="alert" className="st-error">{error}</p>}{!busy&&!error&&!rows.length&&<div className="st-small-empty"><p>还没有相关修改记录。新建、修改和收支删除恢复后，会在这里显示。</p></div>}
      <div className="st-activity-actions"><button className="st-button secondary" disabled={busy} onClick={()=>void load()}>{busy?"加载中…":"刷新记录"}</button>{next&&<button className="st-button secondary" disabled={busy} onClick={()=>void load(next)}>加载更早记录</button>}</div>
    </>}
  </section>;
}
