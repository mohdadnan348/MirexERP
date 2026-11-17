"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { BookOpen, BookCheck, Clock3, RotateCcw, RefreshCw, ArrowUpRight, AlertCircle } from "lucide-react";
import "./LibrarianDashboard.css";
type Book={_id:string;title:string;totalQuantity:number;availableQuantity:number;issuedQuantity:number};
type Issue={_id:string;bookId?:{title?:string}|string;memberType:string;dueDate:string;status:string;fineAmount?:number;finePaid?:number};
const unwrap=(r:any)=>r?.data?.data??r?.data??r;
const rows=(v:any)=>Array.isArray(v)?v:Array.isArray(v?.items)?v.items:[];
export function LibrarianDashboard(){
 const [books,setBooks]=useState<Book[]>([]);const [issues,setIssues]=useState<Issue[]>([]);
 const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 const load=useCallback(async()=>{setLoading(true);setError("");try{const [b,i]=await Promise.all([api.get("/library/books",{params:{page:1,limit:100}}),api.get("/library/issues/all",{params:{page:1,limit:100}})]);setBooks(rows(unwrap(b)));setIssues(rows(unwrap(i)));}catch(e:any){setError(e?.response?.data?.message||e?.message||"Library data could not be loaded.");}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 const total=books.reduce((n,b)=>n+Number(b.totalQuantity||0),0),available=books.reduce((n,b)=>n+Number(b.availableQuantity||0),0),issued=books.reduce((n,b)=>n+Number(b.issuedQuantity||0),0);
 const overdue=issues.filter(i=>i.status==="OVERDUE"||(i.status==="ISSUED"&&new Date(i.dueDate)<new Date())).length;
 const pending=issues.filter(i=>i.status==="ISSUED"||i.status==="OVERDUE").length;
 const cards=[["Total books",total,BookOpen],["Available copies",available,BookCheck],["Issued copies",issued,ArrowUpRight],["Overdue books",overdue,AlertCircle],["Pending returns",pending,Clock3]];
 return <main className="librarian-dash"><header className="ld-hero"><div><span className="ld-kicker">MIREXERP / LIBRARY</span><h1>Library Dashboard</h1><p>Today's view of your school's library and book circulation.</p></div><button onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> {loading?"Refreshing":"Refresh"}</button></header>
 {error&&<div className="ld-error"><AlertCircle size={17}/>{error}</div>}
 <section className="ld-cards">{cards.map(([label,value,Icon]:any)=><article key={label}><span className="ld-icon"><Icon size={19}/></span><small>{label}</small><b>{loading?"—":Number(value).toLocaleString("en-IN")}</b></article>)}</section>
 <section className="ld-main-grid"><article className="ld-panel"><div className="ld-panel-title"><div><h2>Library activity</h2><p>Latest issue and return records</p></div><Link href="/library?tab=transactions">View all <ArrowUpRight size={14}/></Link></div>
 {loading?<p className="ld-empty">Loading library activity…</p>:issues.length?<div className="ld-activity">{issues.slice(0,6).map(i=><div className="ld-activity-row" key={i._id}><span className="ld-book-icon"><BookOpen size={17}/></span><div><b>{typeof i.bookId==="object"&&i.bookId?i.bookId.title:"Library book"}</b><small>{i.memberType} · Due {new Date(i.dueDate).toLocaleDateString("en-IN")}</small></div><em>{i.status}</em></div>)}</div>:<p className="ld-empty">No book issue records yet.</p>}</article>
 <article className="ld-panel ld-shortcuts"><h2>Quick actions</h2><p>Common librarian tasks</p><Link href="/library"><BookOpen size={18}/> Browse & add books <ArrowUpRight size={15}/></Link><Link href="/library?tab=transactions"><ArrowUpRight size={18}/> Issue or return a book <ArrowUpRight size={15}/></Link><Link href="/library?tab=overdue"><Clock3 size={18}/> Review overdue books <ArrowUpRight size={15}/></Link><Link href="/library?tab=fines"><RotateCcw size={18}/> View fine records <ArrowUpRight size={15}/></Link></article></section>
 <footer className="ld-foot">Live records are loaded from the Library API and scoped to the signed-in school.</footer></main>;
}
