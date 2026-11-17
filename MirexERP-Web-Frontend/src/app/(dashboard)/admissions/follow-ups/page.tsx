"use client";
import {useEffect,useState} from "react";
import {admissionEnquiriesApi} from "@/lib/api/admissions";
import "./page.css";
const buckets=["today","upcoming","overdue","completed"];
export default function AdmissionFollowUpsPage(){
 const [bucket,setBucket]=useState("today"),[items,setItems]=useState<any[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(false);
 const load=async()=>{setLoading(true);setError("");try{setItems(await admissionEnquiriesApi.followUps(bucket));}catch(e:any){setError(e?.response?.data?.message||"Unable to load follow-ups");}finally{setLoading(false);}};
 useEffect(()=>{void load();},[bucket]);
 return <main className="adm-followups"><small>ADMISSION MANAGEMENT / FOLLOW-UP TRACKER</small><h1>Follow-up Schedule</h1><p>Today's, upcoming, overdue and completed parent follow-ups.</p><nav>{buckets.map(b=><button className={bucket===b?"active":""} onClick={()=>setBucket(b)} key={b}>{b.replaceAll("_"," ")}</button>)}</nav>{error&&<p className="af-error">{error}</p>}{loading?<p>Loading…</p>:items.length?<section>{items.map((x:any,i:number)=><article key={`${x.enquiryId}-${x.followUp?._id||i}`}><div><b>{x.childName}</b><span>{x.parentName} · {x.parentPhone}</span><p>{x.followUp?.notes}</p></div><time>{x.followUp?.date?new Date(x.followUp.date).toLocaleString():"—"}</time><small>{x.followUp?.status}</small>{x.followUp?.status==="SCHEDULED"&&<div className="af-actions"><button onClick={async()=>{await admissionEnquiriesApi.updateEnquiryFollowUp(x.enquiryId,x.followUp._id,{status:"COMPLETED"});await load();}}>Complete</button><button onClick={async()=>{const date=window.prompt("New follow-up date/time (YYYY-MM-DDTHH:mm)");if(date){await admissionEnquiriesApi.updateEnquiryFollowUp(x.enquiryId,x.followUp._id,{date});await load();}}}>Reschedule</button><button onClick={async()=>{await admissionEnquiriesApi.updateEnquiryFollowUp(x.enquiryId,x.followUp._id,{status:"CANCELLED"});await load();}}>Cancel</button></div>}</article>)}</section>:<div className="af-empty">No {bucket} follow-ups found.</div>}</main>;
}
