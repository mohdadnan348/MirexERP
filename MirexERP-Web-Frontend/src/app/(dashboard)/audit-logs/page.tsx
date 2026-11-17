"use client";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, AlertCircle } from "lucide-react";
import { api } from "@/lib/api/client";

export default function Page() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await api.get("/platform/audit-logs", { params: { page: 1, limit: 50 } });
      setData(response?.data?.data ?? response?.data ?? response);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Could not load audit logs.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const items = Array.isArray(data) ? data : data?.items || data?.records || [];
  return <main style={{padding:24}}>
    <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
      <div><small style={{letterSpacing:2,color:"#16865a",fontWeight:800}}>MIREXERP / PLATFORM</small><h1 style={{fontSize:28,margin:"8px 0"}}>Audit Logs</h1><p style={{color:"#667085",margin:0}}>Live records from /platform/audit-logs.</p></div>
      <button onClick={() => void load()} disabled={loading} style={{padding:"10px 14px",border:"1px solid #d0d5dd",borderRadius:10,background:"#fff",display:"flex",gap:8,alignItems:"center"}}><RefreshCw size={16}/>Refresh</button>
    </header>
    {error && <div role="alert" style={{padding:12,background:"#fff1f0",color:"#b42318",borderRadius:10,marginBottom:16}}><AlertCircle size={16}/> {error}</div>}
    <section style={{background:"#fff",border:"1px solid #eaecf0",borderRadius:14,padding:18}}>
      {loading ? <p>Loading records…</p> : items.length ? <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr><th style={{textAlign:"left",padding:10,background:"#f8fafc"}}>Record</th><th style={{textAlign:"left",padding:10,background:"#f8fafc"}}>Details</th><th style={{textAlign:"left",padding:10,background:"#f8fafc"}}>Status</th><th style={{textAlign:"left",padding:10,background:"#f8fafc"}}>Created</th></tr></thead><tbody>{items.map((item:any,i:number)=><tr key={item._id || i}><td style={{padding:12,borderBottom:"1px solid #eee"}}>{item.name || item.subject || item.ticketNumber || item.action || item._id || "Record"}</td><td style={{padding:12,borderBottom:"1px solid #eee"}}>{item.email || item.description || item.entity || item.code || item.role || "—"}</td><td style={{padding:12,borderBottom:"1px solid #eee"}}>{item.status || item.priority || item.actorRole || "—"}</td><td style={{padding:12,borderBottom:"1px solid #eee"}}>{item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN") : "—"}</td></tr>)}</tbody></table></div> : <p>No records returned by the API.</p>}
    </section>
  </main>;
}
