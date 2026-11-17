"use client";
import {useEffect,useState} from "react";
import {admissionEnquiriesApi} from "@/lib/api/admissions";
import {api} from "@/lib/api/client";
import "./page.css";
export default function AdmissionReportsPage(){
 const [data,setData]=useState<any>(null),[sessions,setSessions]=useState<any[]>([]),[sessionId,setSessionId]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(false);
 useEffect(()=>{api.get("/sessions",{params:{limit:100}}).then((r:any)=>{const v=r?.data?.data??r?.data;setSessions(Array.isArray(v)?v:v?.items??[])}).catch(()=>{});},[]);
 const load=async()=>{setLoading(true);setError("");try{setData(await admissionEnquiriesApi.reports({sessionId:sessionId||undefined}));}catch(e:any){setError(e?.response?.data?.message||"Unable to load reports");}finally{setLoading(false);}};
 useEffect(()=>{void load();},[sessionId]);
 const rows=(data?.applicationsByStatus||[]),sources=(data?.enquiriesBySource||[]),classes=(data?.classWiseAdmissions||[]);
 return <main className="adm-report"><header><div><small>ADMISSION MANAGEMENT / ANALYTICS</small><h1>Admission Reports</h1><p>Live reports calculated from this school's admission and enquiry records.</p></div><select value={sessionId} onChange={e=>setSessionId(e.target.value)}><option value="">All sessions</option>{sessions.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}</select></header>{error&&<p className="ar-error">{error}</p>}{loading?<p>Loading reports…</p>:data&&<><section className="ar-kpis"><article><span>Total enquiries</span><b>{data.enquiryCount}</b></article><article><span>Registered students</span><b>{data.registeredCount}</b></article><article><span>Conversion rate</span><b>{data.conversionPercentage}%</b></article></section><section className="ar-grid"><article><h2>Enquiries by source</h2>{sources.length?sources.map((x:any)=><p key={x._id}><span>{x._id}</span><b>{x.count}</b></p>):<p>No enquiry data</p>}</article><article><h2>Applications by status</h2>{rows.length?rows.map((x:any)=><p key={x._id}><span>{x._id}</span><b>{x.count}</b></p>):<p>No application data</p>}</article><article><h2>Class-wise admissions</h2>{classes.length?classes.map((x:any,i:number)=><p key={i}><span>{x.className||"Unassigned class"}</span><b>{x.count}</b></p>):<p>No registration data</p>}</article></section><p className="ar-formula">Conversion = registered applications ÷ total enquiries × 100. Zero enquiries returns 0%.</p></>}</main>;
}
