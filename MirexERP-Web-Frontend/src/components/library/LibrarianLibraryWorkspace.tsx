"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import { BookOpen, RefreshCw, Search, Plus, ArrowLeftRight, RotateCcw, AlertCircle } from "lucide-react";
import "./LibrarianLibraryWorkspace.css";

type Book = { _id: string; title: string; author: string; isbn?: string; category: string; totalQuantity: number; availableQuantity: number; issuedQuantity: number; publisher?: string; edition?: string; shelfNumber?: string; rackNumber?: string; price?: number };
type Issue = { _id: string; bookId?: Book | string; memberId: string; memberType: string; issueDate: string; dueDate: string; returnDate?: string; fineAmount?: number; finePaid?: number; status: string; remarks?: string };
const unwrap = (r:any) => r?.data?.data ?? r?.data ?? r;
const rows = (v:any) => Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : [];
const errText = (e:any) => e?.response?.data?.message || e?.message || "Request failed. Check your role and school connection.";
const today = () => new Date().toISOString().slice(0,10);

export function LibrarianLibraryWorkspace() {
  const [tab,setTab] = useState("books");
  const [books,setBooks] = useState<Book[]>([]);
  const [dashboard,setDashboard] = useState<any>(null);
  const [availableCopies,setAvailableCopies] = useState<any[]>([]);
  const [copyForm,setCopyForm] = useState({bookId:"",barcode:"",accessionNumber:""});
  const [issues,setIssues] = useState<Issue[]>([]);
  const [search,setSearch] = useState("");
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [showBook,setShowBook] = useState(false);
  const [editingBook,setEditingBook] = useState<string|null>(null);
  const [showIssue,setShowIssue] = useState(false);
  const [saving,setSaving] = useState(false);
  const [bookForm,setBookForm] = useState({title:"",author:"",isbn:"",publisher:"",edition:"",category:"",totalQuantity:"1",publicationYear:"",shelfNumber:"",rackNumber:"",price:""});
  const [issueForm,setIssueForm] = useState({bookId:"",copyId:"",memberId:"",memberType:"STUDENT",dueDate:"",remarks:""});
  const [fineForm,setFineForm] = useState({fineAmount:"0",finePaid:"0",remarks:"",condition:"GOOD"});
  const [returning,setReturning] = useState<Issue|null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [b,i,d] = await Promise.all([
        api.get("/library/books",{params:{page:1,limit:100,search:search||undefined}}),
        api.get("/library/issues/all",{params:{page:1,limit:100}}),
        api.get("/library/dashboard").catch(()=>null)
      ]);
      setBooks(rows(unwrap(b))); setIssues(rows(unwrap(i))); setDashboard(d?unwrap(d):null);
    } catch(e:any) { setError(errText(e)); }
    finally { setLoading(false); }
  },[search]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{let active=true;if(!issueForm.bookId){setAvailableCopies([]);return;}api.get("/library/copies",{params:{bookId:issueForm.bookId,status:"AVAILABLE"}}).then(r=>{if(active)setAvailableCopies(rows(unwrap(r)));}).catch(()=>{if(active)setAvailableCopies([]);});return()=>{active=false;};},[issueForm.bookId]);
  useEffect(()=>{const requested=new URLSearchParams(window.location.search).get("tab");if(requested&&["transactions","overdue","fines"].includes(requested))setTab(requested);},[]);

  const filteredIssues = useMemo(()=>issues.filter(i=>tab==="overdue"?i.status==="OVERDUE" || (i.status==="ISSUED" && new Date(i.dueDate)<new Date()):tab==="fines"?(Number(i.fineAmount||0)>0):true),[issues,tab]);
  const overdueCount = issues.filter(i=>i.status==="OVERDUE" || (i.status==="ISSUED" && new Date(i.dueDate)<new Date())).length;
  const pendingFine = issues.reduce((n,i)=>n+Math.max(0,Number(i.fineAmount||0)-Number(i.finePaid||0)),0);

  const createCopy = async(e:FormEvent) => { e.preventDefault(); setSaving(true); setError(""); try { await api.post("/library/copies",{bookId:copyForm.bookId,copies:[{barcode:copyForm.barcode,accessionNumber:copyForm.accessionNumber||undefined}]}); setNotice("Physical book copy registered."); setCopyForm({bookId:copyForm.bookId,barcode:"",accessionNumber:""}); await load(); } catch(err:any) { setError(errText(err)); } finally { setSaving(false); } };

  const createBook = async(e:FormEvent) => {
    e.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const body:any={...bookForm,totalQuantity:Number(bookForm.totalQuantity)};
      ["publicationYear","price"].forEach(k=>{if(body[k])body[k]=Number(body[k]);else delete body[k];});
      Object.keys(body).forEach(k=>{if(body[k]==="")delete body[k];});
      if(editingBook) await api.patch(`/library/books/${editingBook}`,body); else await api.post("/library/books",body);
      setShowBook(false);setEditingBook(null);setBookForm({title:"",author:"",isbn:"",publisher:"",edition:"",category:"",totalQuantity:"1",publicationYear:"",shelfNumber:"",rackNumber:"",price:""});
      setNotice("Book added to this school's library.");await load();
    } catch(e:any){setError(errText(e));} finally{setSaving(false);}
  };
  const issueBook = async(e:FormEvent) => {
    e.preventDefault();setSaving(true);setError("");setNotice("");
    try {
      await api.post(`/library/issue`,{bookId:issueForm.bookId,copyId:issueForm.copyId||undefined,memberId:issueForm.memberId,memberType:issueForm.memberType,dueDate:issueForm.dueDate,remarks:issueForm.remarks||undefined});
      setShowIssue(false);setIssueForm({bookId:"",copyId:"",memberId:"",memberType:"STUDENT",dueDate:"",remarks:""});
      setNotice("Book issued successfully.");await load();
    } catch(e:any){setError(errText(e));} finally{setSaving(false);}
  };
  const returnBook = async(e:FormEvent) => {
    e.preventDefault();if(!returning)return;setSaving(true);setError("");setNotice("");
    try {
      await api.patch(`/library/return/${returning._id}`,{fineAmount:Number(fineForm.fineAmount||0),finePaid:Number(fineForm.finePaid||0),remarks:fineForm.remarks||undefined,condition:fineForm.condition});
      setReturning(null);setNotice("Book return recorded. Fine balance remains visible for Accountant collection.");await load();
    } catch(e:any){setError(errText(e));} finally{setSaving(false);}
  };
  const bookName=(i:Issue)=>typeof i.bookId==="object"&&i.bookId?i.bookId.title:"Book record";
  const date=(v?:string)=>v?new Date(v).toLocaleDateString("en-IN"):"—";

  return <main className="lib-workspace">
    <header className="lib-hero"><div><span className="lib-kicker">MIREXERP / LIBRARY WORKSPACE</span><h1>Library Management</h1><p>Manage your school's catalogue, book circulation and return records.</p></div><button className="lib-refresh" onClick={()=>void load()}><RefreshCw size={16}/> Refresh data</button></header>
    <section className="lib-metrics">
      <article><span>Book titles</span><b>{dashboard?.totalBooks??books.length}</b><small>Catalogue records</small></article>
      <article><span>Total copies</span><b>{dashboard?.totalCopies??books.reduce((n,b)=>n+Number(b.totalQuantity||0),0)}</b><small>Registered copies</small></article>
      <article><span>Available copies</span><b>{dashboard?.availableCopies??books.reduce((n,b)=>n+Number(b.availableQuantity||0),0)}</b><small>Ready to issue</small></article>
      <article><span>Issued copies</span><b>{dashboard?.issuedCopies??books.reduce((n,b)=>n+Number(b.issuedQuantity||0),0)}</b><small>Currently outside library</small></article>
      <article><span>Overdue records</span><b>{dashboard?.overdueBooks??overdueCount}</b><small>Due date has passed</small></article>
      <article><span>Pending fine balance</span><b>₹{pendingFine.toLocaleString("en-IN")}</b><small>Collection remains with configured finance workflow</small></article>
    </section>
    <nav className="lib-tabs">
      {[["books","All Books"],["transactions","Issue / Return"],["overdue","Overdue Books"],["fines","Fine Records"]].map(([id,label])=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}>{label}</button>)}
    </nav>
    {notice&&<div className="lib-notice">{notice}</div>}
    {error&&<div className="lib-error"><AlertCircle size={17}/>{error}</div>}
    {tab==="books"&&<section className="lib-panel">
      <form className="lib-copy-form" onSubmit={createCopy}><b>Register physical copy</b><select required value={copyForm.bookId} onChange={e=>setCopyForm(v=>({...v,bookId:e.target.value}))}><option value="">Select title</option>{books.map(b=><option key={b._id} value={b._id}>{b.title}</option>)}</select><input required placeholder="Barcode (unique)" value={copyForm.barcode} onChange={e=>setCopyForm(v=>({...v,barcode:e.target.value}))}/><input placeholder="Accession number" value={copyForm.accessionNumber} onChange={e=>setCopyForm(v=>({...v,accessionNumber:e.target.value}))}/><button disabled={saving||!copyForm.bookId}>Add copy</button></form>
      <div className="lib-panel-head"><div><h2>Book catalogue</h2><p>Books are stored within the signed-in school's data scope.</p></div><button className="lib-primary" onClick={()=>{setEditingBook(null);setBookForm({title:"",author:"",isbn:"",publisher:"",edition:"",category:"",totalQuantity:"1",publicationYear:"",shelfNumber:"",rackNumber:"",price:""});setShowBook(true);}}><Plus size={16}/> Add new book</button></div>
      <div className="lib-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search title, author, ISBN or category"/></div>
      {loading?<p className="lib-state">Loading live library records…</p>:<div className="lib-table-wrap"><table><thead><tr><th>Book</th><th>ISBN</th><th>Category</th><th>Copies</th><th>Available</th><th>Location</th><th>Actions</th></tr></thead><tbody>{books.map(b=><tr key={b._id}><td><b>{b.title}</b><small>{b.author}</small></td><td>{b.isbn||"—"}</td><td>{b.category}</td><td>{b.totalQuantity}</td><td><span className="lib-pill">{b.availableQuantity}</span></td><td>{[b.shelfNumber,b.rackNumber].filter(Boolean).join(" / ")||"—"}</td><td><button className="lib-text-button" onClick={()=>{setEditingBook(b._id);setBookForm({title:b.title,author:b.author,isbn:b.isbn||"",publisher:b.publisher||"",edition:b.edition||"",category:b.category,totalQuantity:String(b.totalQuantity),publicationYear:"",shelfNumber:b.shelfNumber||"",rackNumber:b.rackNumber||"",price:b.price?String(b.price):""});setShowBook(true);}}>Edit</button> <button className="lib-text-button" onClick={async()=>{if(window.confirm("Remove this book from the active catalogue?")){try{await api.delete(`/library/books/${b._id}`);setNotice("Book archived.");await load();}catch(e:any){setError(errText(e));}}}}>Remove</button></td></tr>)}{!books.length&&<tr><td colSpan={7} className="lib-state">No book records found.</td></tr>}</tbody></table></div>}
    </section>}
    {tab!=="books"&&<section className="lib-panel">
      <div className="lib-panel-head"><div><h2>{tab==="transactions"?"Issue & return register":tab==="overdue"?"Overdue books":"Library fine records"}</h2><p>Live circulation records returned by the Library API.</p></div>{tab==="transactions"&&<button className="lib-primary" onClick={()=>setShowIssue(true)}><ArrowLeftRight size={16}/> Issue a book</button>}</div>
      {loading?<p className="lib-state">Loading transactions…</p>:<div className="lib-table-wrap"><table><thead><tr><th>Book</th><th>Member ID</th><th>Type</th><th>Issue date</th><th>Due date</th><th>Status</th><th>Fine due</th>{tab==="transactions"&&<th>Action</th>}</tr></thead><tbody>{filteredIssues.map(i=><tr key={i._id}><td><b>{bookName(i)}</b></td><td>{i.memberId}</td><td>{i.memberType}</td><td>{date(i.issueDate)}</td><td>{date(i.dueDate)}</td><td><span className="lib-pill">{i.status}</span></td><td>₹{Math.max(0,Number(i.fineAmount||0)-Number(i.finePaid||0)).toLocaleString("en-IN")}</td>{tab==="transactions"&&<td>{["ISSUED","OVERDUE"].includes(i.status)&&<button className="lib-text-button" onClick={()=>{setReturning(i);setFineForm({fineAmount:String(i.fineAmount||0),finePaid:String(i.finePaid||0),remarks:"",condition:"GOOD"});}}>Record return</button>}</td>}</tr>)}{!filteredIssues.length&&<tr><td colSpan={tab==="transactions"?8:7} className="lib-state">No matching records found.</td></tr>}</tbody></table></div>}
    </section>}
    {showBook&&<div className="lib-modal-backdrop"><form className="lib-modal" onSubmit={createBook}><div className="lib-modal-head"><h2>{editingBook?"Edit book":"Add a book"}</h2><button type="button" onClick={()=>setShowBook(false)}>×</button></div><div className="lib-form-grid">
      {([["title","Book title"],["author","Author"],["isbn","ISBN"],["publisher","Publisher"],["edition","Edition"],["category","Category"],["totalQuantity","Total quantity"],["publicationYear","Publication year"],["shelfNumber","Shelf number"],["rackNumber","Rack number"],["price","Book price"]] as const).map(([key,label])=><label key={key}>{label}<input required={["title","author","category","totalQuantity"].includes(key)} type={["totalQuantity","publicationYear","price"].includes(key)?"number":"text"} min={key==="totalQuantity"?"1":key==="price"?"0":undefined} value={bookForm[key]} onChange={e=>setBookForm(v=>({...v,[key]:e.target.value}))}/></label>)}
    </div><footer><button type="button" className="lib-cancel" onClick={()=>setShowBook(false)}>Cancel</button><button className="lib-primary" disabled={saving}>{saving?"Saving…":editingBook?"Update book":"Save book"}</button></footer></form></div>}
    {showIssue&&<div className="lib-modal-backdrop"><form className="lib-modal" onSubmit={issueBook}><div className="lib-modal-head"><h2>Issue a book</h2><button type="button" onClick={()=>setShowIssue(false)}>×</button></div><div className="lib-form-grid"><label>Book<select required value={issueForm.bookId} onChange={e=>setIssueForm(v=>({...v,bookId:e.target.value}))}><option value="">Select available book</option>{books.filter(b=>b.availableQuantity>0).map(b=><option key={b._id} value={b._id}>{b.title} ({b.availableQuantity} available)</option>)}</select></label>{availableCopies.length>0&&<label>Physical copy<select required value={issueForm.copyId} onChange={e=>setIssueForm(v=>({...v,copyId:e.target.value}))}><option value="">Select barcode</option>{availableCopies.map(c=><option key={c._id} value={c._id}>{c.barcode}{c.accessionNumber?` · ${c.accessionNumber}`:""}</option>)}</select></label>}<label>Member type<select value={issueForm.memberType} onChange={e=>setIssueForm(v=>({...v,memberType:e.target.value}))}><option>STUDENT</option><option>TEACHER</option><option>EMPLOYEE</option></select></label><label className="lib-span">Student / Teacher / Employee ID<input required value={issueForm.memberId} onChange={e=>setIssueForm(v=>({...v,memberId:e.target.value}))} placeholder="MongoDB member ID"/></label><label>Due date<input required type="date" min={today()} value={issueForm.dueDate} onChange={e=>setIssueForm(v=>({...v,dueDate:e.target.value}))}/></label><label className="lib-span">Remarks<input value={issueForm.remarks} onChange={e=>setIssueForm(v=>({...v,remarks:e.target.value}))}/></label></div><footer><button type="button" className="lib-cancel" onClick={()=>setShowIssue(false)}>Cancel</button><button className="lib-primary" disabled={saving}>{saving?"Issuing…":"Confirm issue"}</button></footer></form></div>}
    {returning&&<div className="lib-modal-backdrop"><form className="lib-modal" onSubmit={returnBook}><div className="lib-modal-head"><h2>Record book return</h2><button type="button" onClick={()=>setReturning(null)}>×</button></div><div className="lib-form-grid"><label>Fine amount<input type="number" min="0" value={fineForm.fineAmount} onChange={e=>setFineForm(v=>({...v,fineAmount:e.target.value}))}/></label><label>Fine already paid<input type="number" min="0" value={fineForm.finePaid} onChange={e=>setFineForm(v=>({...v,finePaid:e.target.value}))}/></label><label>Returned condition<select value={fineForm.condition} onChange={e=>setFineForm(v=>({...v,condition:e.target.value}))}><option value="GOOD">Good</option><option value="DAMAGED">Damaged</option><option value="LOST">Lost</option></select></label><label className="lib-span">Remarks<input value={fineForm.remarks} onChange={e=>setFineForm(v=>({...v,remarks:e.target.value}))}/></label></div><p className="lib-hint">This records fine status only. Actual payment collection remains with the Accountant's finance workflow.</p><footer><button type="button" className="lib-cancel" onClick={()=>setReturning(null)}>Cancel</button><button className="lib-primary" disabled={saving}>{saving?"Saving…":"Confirm return"}</button></footer></form></div>}
  </main>;
}
