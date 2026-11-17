"use client";
import {useState} from "react";
import {api} from "@/lib/api/client";
export function ParentAccountLinkWorkspace(){
 const [parentId,setParentId]=useState(""),[userId,setUserId]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const submit=async()=>{setBusy(true);setMessage("");try{await api.post("/parents/link-account",{parentId,userId});setMessage("Existing PARENT login linked. Password setup/reset remains in the current Auth flow.");setParentId("");setUserId("");}catch(e:any){setMessage(e?.response?.data?.message||"Unable to link parent account.");}finally{setBusy(false);}};
 return <main style={{padding:24,maxWidth:800,display:"grid",gap:16}}><h1 style={{fontSize:26,fontWeight:750}}>Link Parent Login</h1><p style={{color:"#777084"}}>Connect an existing PARENT user account to a school parent profile. No duplicate user or parent record is created.</p><section style={{padding:18,background:"#fff",border:"1px solid #e8e3ef",borderRadius:12,display:"grid",gap:12}}><label>Parent record ID<input value={parentId} onChange={e=>setParentId(e.target.value)} placeholder="Parent MongoDB ID"/></label><label>Existing User ID<input value={userId} onChange={e=>setUserId(e.target.value)} placeholder="User MongoDB ID (role PARENT)"/></label><button disabled={busy||!parentId||!userId} onClick={submit}>{busy?"Linking…":"Link parent account"}</button>{message&&<p>{message}</p>}</section></main>;
}
