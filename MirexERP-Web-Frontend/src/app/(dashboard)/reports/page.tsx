"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { BarChart3, RefreshCw, Users, IndianRupee, CalendarCheck, FileText, AlertCircle } from "lucide-react";
import "./page.css";
const unwrap=(r:any)=>r?.data?.data??r?.data??r;
export default function ReportsPage(){
 const [dashboard,setDashboard]=useState<any>(null);const [catalog,setCatalog]=useState<any[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 const load=useCallback(async()=>{setLoading(true);setError("");try{const [d,c]=await Promise.all([api.get("/reports/analytics-dashboard"),api.get("/reports/catalog")]);setDashboard(unwrap(d));setCatalog(unwrap(c)?.reports||[]);}catch(e:any){setError(e?.response?.data?.message||e?.message||"Reports could not be loaded.");}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 return <main className="reports-hub"><header><div><span>MIREXERP / INSIGHTS</span><h1>Reports & Analytics</h1><p>Tenant-scoped summaries from the live school records. SaaS subscription invoices are excluded from school fee and finance reports.</p></div><button onClick={()=>void load()}><RefreshCw size={16}/> Refresh</button></header>
 {error&&<div className="reports-error"><AlertCircle size={17}/>{error}</div>}{loading?<div className="reports-empty">Loading live report data…</div>:<>
 <section className="reports-stats"><article><FileText/><span>Available report families</span><strong>{dashboard?.totalAvailableReports??catalog.length}</strong></article><article><CalendarCheck/><span>Generated today</span><strong>{dashboard?.generatedToday??0}</strong></article><article><BarChart3/><span>Generated this month</span><strong>{dashboard?.generatedThisMonth??0}</strong></article><article><FileText/><span>Failed exports</span><strong>{dashboard?.failedExports??0}</strong></article></section>
 {dashboard?.schoolSummary&&<section className="reports-stats"><article><Users/><span>Active students</span><strong>{dashboard.schoolSummary.students?.active??0}</strong></article><article><Users/><span>Active employees</span><strong>{dashboard.schoolSummary.employees?.active??0}</strong></article><article><IndianRupee/><span>Student fees collected</span><strong>₹{Number(dashboard.schoolSummary.fees?.collected||0).toLocaleString("en-IN")}</strong></article><article><IndianRupee/><span>Student fees pending</span><strong>₹{Number(dashboard.schoolSummary.fees?.pending||0).toLocaleString("en-IN")}</strong></article></section>}
 <section className="reports-panel"><h2>Available report catalog</h2><p>Only reports backed by existing database services are listed. Unsupported report types are not presented as completed features.</p><div className="reports-grid">{catalog.map((r:any)=><article key={r.reportKey}><span>{r.module}</span><h3>{r.name}</h3><p>{r.description}</p><div className="reports-meta">Filters: {(r.filters||[]).join(", ")||"None"}</div><code>{r.endpoint}</code></article>)}</div></section>
 <section className="reports-panel"><h2>Recent report exports</h2>{dashboard?.recentExports?.length?<div className="reports-table-wrap"><table><thead><tr><th>Report</th><th>Format</th><th>Status</th><th>Rows</th><th>Created</th></tr></thead><tbody>{dashboard.recentExports.map((r:any)=><tr key={r._id}><td>{r.title||r.reportType}</td><td>{r.format}</td><td>{r.status}</td><td>{r.recordCount}</td><td>{new Date(r.createdAt).toLocaleString("en-IN")}</td></tr>)}</tbody></table></div>:<div className="reports-empty">No export history has been recorded yet. Existing report endpoints currently return live JSON summaries.</div>}</section>
 </>}
 </main>
}
