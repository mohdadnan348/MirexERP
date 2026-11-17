"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { AlertCircle, RefreshCw } from "lucide-react";
import "./AcademicSessionWorkspace.css";
const unwrap = (r:any) => r?.data?.data ?? r?.data ?? r;
const dateText = (v?:string|null, timezone?:string) => v ? new Intl.DateTimeFormat("en-IN",{timeZone:timezone||"Asia/Kolkata",day:"2-digit",month:"short",year:"numeric"}).format(new Date(v)) : "—";
export function AcademicSessionDetails() {
 const params=useParams<{id:string}>(); const [data,setData]=useState<any>(null); const [error,setError]=useState(""); const [loading,setLoading]=useState(true);
 const load=useCallback(async()=>{setLoading(true);try{setData(unwrap(await api.get(`/sessions/${params.id}/details`)));setError("");}catch(e:any){setError(e?.response?.data?.message||"Session details could not be loaded.");}finally{setLoading(false);}},[params.id]);
 useEffect(()=>{void load();},[load]);
 const s=data?.session, m=data?.metrics||{};
 return <main className="academic-sessions"><header className="as-header"><div><span className="as-eyebrow">MIREXERP / SESSION DETAILS</span><h1>{s?.name||"Academic session details"}</h1><p>Session-specific metrics and lifecycle audit information.</p></div><div className="as-header-actions"><button className="as-btn as-btn-light" onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button><Link className="as-btn as-btn-light" href="/sessions">Back to sessions</Link></div></header>
 {error&&<div className="as-alert as-error"><AlertCircle size={17}/>{error}</div>}
 {loading?<div className="as-loading">Loading session details…</div>:s&&<><section className="as-table-panel"><div className="as-table-heading"><div><h2>Session information</h2><p>{s.description||"No description provided."}</p></div><span className={`as-pill ${(s.status||"").toLowerCase()}`}>{s.status|| (s.isClosed?"CLOSED":s.isActive?"ACTIVE":"UPCOMING")}</span></div><div className="as-progress-list">
 {[["Session name",s.name],["Session code",s.code],["Start date",dateText(s.startDate,data.schoolTimezone)],["End date",dateText(s.endDate,data.schoolTimezone)],["Created at",dateText(s.createdAt,data.schoolTimezone)],["Activated at",dateText(s.activatedAt,data.schoolTimezone)],["Activated by",s.activatedBy?.name || s.activatedBy?.email || s.activatedBy || "—"],["Closed at",dateText(s.closedAt,data.schoolTimezone)],["Closed by",s.closedBy?.name || s.closedBy?.email || s.closedBy || "—"]].map(([k,v]:any)=><div className="as-progress-row" key={k}><span>{k}</span><strong>{v}</strong></div>)}
 </div></section><section className="as-cards">
 {[[ "Classes",m.classCount],["Students",m.studentCount],["Fee structures",m.feeStructureCount],["Promoted",m.promotedStudents],["Detained",m.detainedStudents]].map(([k,v]:any)=><article className="as-card" key={k}><div><small>{k}</small><strong>{v??0}</strong></div></article>)}
 </section><section className="as-table-panel"><div className="as-table-heading"><div><h2>Lifecycle history</h2><p>Creation, updates, activation, closure and preparation events.</p></div></div>{s.auditHistory?.length?<div className="as-table-scroll"><table><thead><tr><th>Action</th><th>Date</th><th>Performed by</th><th>Details</th></tr></thead><tbody>{[...s.auditHistory].reverse().map((x:any,i:number)=><tr key={i}><td>{x.action}</td><td>{dateText(x.performedAt,data.schoolTimezone)}</td><td>{x.performedBy?.name || x.performedBy?.email || String(x.performedBy)}</td><td>{x.details||"—"}</td></tr>)}</tbody></table></div>:<div className="as-empty">No lifecycle history found.</div>}</section></>}
 </main>;
}
