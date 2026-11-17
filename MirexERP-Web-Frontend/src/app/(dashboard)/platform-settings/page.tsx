"use client";
import { useCallback, useEffect, useState } from "react";
import { Save, RefreshCw, AlertCircle } from "lucide-react";
import { api } from "@/lib/api/client";
export default function PlatformSettingsPage() {
 const [values,setValues]=useState<Record<string,any>>({});
 const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState(""); const [message,setMessage]=useState("");
 const load=useCallback(async()=>{setLoading(true);setError("");try{const r=await api.get("/platform/settings");setValues(r?.data?.data??r?.data??{});}catch(e:any){setError(e?.response?.data?.message||e?.message||"Settings could not be loaded.");}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 const save=async()=>{setSaving(true);setError("");setMessage("");try{await api.patch("/platform/settings",{values});setMessage("Platform settings saved.");}catch(e:any){setError(e?.response?.data?.message||e?.message||"Settings could not be saved.");}finally{setSaving(false);}};
 return <main style={{padding:24,maxWidth:1100}}><header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16}}><div><small style={{letterSpacing:2,color:"#16865a",fontWeight:800}}>MIREXERP / PLATFORM CONTROL</small><h1>Platform Settings</h1><p>Manage global platform configuration as JSON values.</p></div><button onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> Refresh</button></header>
 {error&&<p role="alert" style={{color:"#b42318"}}><AlertCircle size={16}/> {error}</p>}{message&&<p style={{color:"#087a52"}}>{message}</p>}
 <section style={{background:"#fff",padding:20,border:"1px solid #eaecf0",borderRadius:14,marginTop:18}}><label htmlFor="platform-settings-json">Global settings JSON</label><textarea id="platform-settings-json" value={JSON.stringify(values,null,2)} onChange={e=>{try{setValues(JSON.parse(e.target.value));setError("");}catch{setError("JSON syntax is incomplete or invalid. Finish editing valid JSON before saving.");}}} rows={18} spellCheck={false} style={{width:"100%",fontFamily:"monospace",padding:14,border:"1px solid #d0d5dd",borderRadius:8,marginTop:10}} disabled={loading}/><button onClick={()=>void save()} disabled={loading||saving} style={{marginTop:12,padding:"10px 16px",borderRadius:9,background:"#137b50",color:"#fff"}}><Save size={16}/> {saving?"Saving…":"Save settings"}</button></section></main>;
}
