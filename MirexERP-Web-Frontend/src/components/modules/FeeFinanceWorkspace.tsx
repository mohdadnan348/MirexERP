"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import {
  Activity, AlertCircle, ArrowDownLeft, ArrowUpRight, BadgeIndianRupee,
  BookOpen, CheckCircle2, ChevronLeft, ChevronRight, CircleDollarSign,
  ClipboardList, FileText, Plus, RefreshCw, Search, ShieldCheck, Wallet,
  XCircle,
} from "lucide-react";
import "./FeeFinanceWorkspace.css";

type Row = Record<string, unknown> & { _id?: string; id?: string };
type RazorpayCheckoutResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayCheckoutOptions = {
  key: string; amount: number; currency: string; name: string; description: string; order_id: string;
  handler: (response: RazorpayCheckoutResponse) => void | Promise<void>;
  modal?: { ondismiss?: () => void };
};
type RazorpayCheckoutInstance = { open: () => void };

type Field = { name: string; label: string; type?: "text"|"number"|"date"|"select"|"textarea"|"json"; required?: boolean; options?: string[]; wide?: boolean };
type Section = {
  key: string; label: string; endpoint: string; columns: string[];
  fields?: Field[]; createEndpoint?: string; readOnly?: boolean;
  action?: "cancel-invoice"|"download-invoice"|"download-receipt"|"approve-discount"|"reject-discount"|"approve-refund"|"reject-refund"|"process-refund";
};

const idField=(name:string,label:string,required=true):Field=>({name,label,required});
const textField=(name:string,label:string,required=true):Field=>({name,label,required});
const numberField=(name:string,label:string,required=true):Field=>({name,label,type:"number",required});
const dateField=(name:string,label:string,required=true):Field=>({name,label,type:"date",required});
const jsonField=(name:string,label:string,required=true):Field=>({name,label,type:"json",required,wide:true});
const selectField=(name:string,label:string,options:string[],required=true):Field=>({name,label,type:"select",options,required});

const sections:Section[]=[
  {key:"overview",label:"Overview",endpoint:"/finance/dashboard",columns:[],readOnly:true},
  {key:"fee-heads",label:"Fee Heads",endpoint:"/fees/heads",columns:["name","code","isOptional","isRefundable","isActive"],fields:[textField("name","Fee head name"),textField("code","Code"),textField("description","Description",false),{name:"isOptional",label:"Optional (true/false)"},{name:"isRefundable",label:"Refundable (true/false)"}]},
  {key:"structures",label:"Fee Structures",endpoint:"/fees/structures",columns:["name","code","frequency","totalAmount","classIds","isActive"],fields:[idField("sessionId","Academic session ID"),textField("name","Structure name"),textField("code","Structure code"),selectField("frequency","Frequency",["ONE_TIME","MONTHLY","QUARTERLY","HALF_YEARLY","ANNUALLY","CUSTOM"]),jsonField("classIds","Class IDs JSON array",false),jsonField("items","Fee items JSON [{feeHeadId,amount}]"),numberField("dueDay","Due day (1–28)",false),selectField("lateFineType","Late fine type",["NONE","FLAT","PER_DAY"],false),numberField("lateFineAmount","Late fine amount",false),numberField("graceDays","Grace days",false),textField("description","Description",false)]},
  {key:"assignments",label:"Student Assignments",endpoint:"/fees/assignments",columns:["studentId","sessionId","feeStructureId","assignedAmount","isActive"],fields:[idField("sessionId","Academic session ID"),idField("studentId","Student ID"),idField("feeStructureId","Fee structure ID"),jsonField("customItems","Custom items JSON array",false)]},
  {key:"invoices",label:"Invoices",endpoint:"/fees/invoices",columns:["invoiceNumber","studentId","totalAmount","paidAmount","balanceAmount","dueDate","status"],fields:[idField("sessionId","Academic session ID"),idField("studentId","Student ID"),idField("feeAssignmentId","Fee assignment ID",false),jsonField("items","Invoice items JSON (optional)",false),dateField("dueDate","Due date"),textField("remarks","Remarks",false)],action:"cancel-invoice"},
  {key:"payments",label:"Collections",endpoint:"/fees/payments",columns:["receiptNumber","studentId","invoiceId","amount","paymentMethod","paymentStatus","paymentDate"],fields:[idField("invoiceId","Invoice ID"),numberField("amount","Payment amount"),selectField("paymentMethod","Payment method",["CASH","UPI","CARD","NET_BANKING","CHEQUE","BANK_TRANSFER","RAZORPAY"]),textField("transactionReference","Transaction reference",false),textField("idempotencyKey","Idempotency key (unique per retry)",false),dateField("paymentDate","Payment date",false),textField("remarks","Remarks",false)]},
  {key:"discounts",label:"Discounts",endpoint:"/fees/discounts",columns:["name","studentId","discountType","value","discountAmount","isApproved"],fields:[idField("sessionId","Academic session ID"),idField("studentId","Student ID"),idField("invoiceId","Invoice ID",false),textField("name","Discount name"),selectField("discountType","Discount type",["FIXED","PERCENTAGE"]),numberField("value","Discount value"),textField("reason","Reason")],action:"approve-discount"},
  {key:"refunds",label:"Refunds",endpoint:"/fees/refunds",columns:["refundNumber","studentId","paymentId","amount","status","reason"],fields:[idField("paymentId","Original payment ID"),numberField("amount","Refund amount"),textField("reason","Refund reason")],action:"approve-refund"},
  {key:"vendors",label:"Vendors",endpoint:"/finance/vendors",columns:["name","code","contactPerson","phone","email","gstin","isActive"],fields:[textField("name","Vendor name"),textField("code","Vendor code"),textField("contactPerson","Contact person",false),textField("phone","Phone",false),textField("email","Email",false),textField("address","Address",false),textField("gstin","GSTIN",false),textField("pan","PAN",false),textField("notes","Notes",false)]},
  {key:"categories",label:"Finance Categories",endpoint:"/finance/categories",columns:["name","code","type","isActive"],fields:[textField("name","Category name"),textField("code","Category code"),selectField("type","Category type",["INCOME","EXPENSE"]),textField("description","Description",false)]},
  {key:"income",label:"Other Income",endpoint:"/finance/income",columns:["receiptNumber","title","categoryId","amount","receivedFrom","paymentMethod","receivedDate"],fields:[idField("categoryId","Income category ID"),textField("title","Title"),numberField("amount","Amount"),selectField("paymentMethod","Payment method",["CASH","UPI","CARD","NET_BANKING","CHEQUE","BANK_TRANSFER","OTHER"],false),textField("transactionReference","Reference",false),textField("receivedFrom","Received from"),dateField("receivedDate","Received date",false),textField("remarks","Remarks",false)]},
  {key:"expenses",label:"Expenses",endpoint:"/finance/expenses",columns:["voucherNumber","title","categoryId","amount","paidTo","paymentMethod","expenseDate"],fields:[idField("categoryId","Expense category ID"),idField("vendorId","Vendor ID",false),textField("title","Title"),numberField("amount","Amount"),selectField("paymentMethod","Payment method",["CASH","UPI","CARD","NET_BANKING","CHEQUE","BANK_TRANSFER","OTHER"],false),textField("transactionReference","Reference",false),textField("paidTo","Paid to"),dateField("expenseDate","Expense date",false),textField("remarks","Remarks",false)]},
  {key:"ledger",label:"Cashbook / Ledger",endpoint:"/finance/transactions",columns:["transactionNumber","type","title","amount","paymentMethod","transactionDate","status"],readOnly:true},
];

const unwrap=(r:any)=>r?.data?.data??r?.data??r;
const rowsFrom=(v:any):Row[]=>Array.isArray(v)?v:Array.isArray(v?.items)?v.items:Array.isArray(v?.results)?v.results:[];
const money=(v:unknown)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number(v)||0);
const cell=(v:unknown)=>v==null||v===""?"—":typeof v==="object"?String((v as any).name||(v as any).firstName?`${(v as any).firstName||""} ${(v as any).lastName||""}`.trim():JSON.stringify(v)):typeof v==="boolean"?(v?"Yes":"No"):String(v);
const getId=(r:Row)=>String(r._id||r.id||"");

export function FeeFinanceWorkspace(){
  const [active,setActive]=useState("overview");
  const [rows,setRows]=useState<Row[]>([]);
  const [summary,setSummary]=useState<Record<string,any>>({});
  const [pagination,setPagination]=useState<any>(null);
  const [page,setPage]=useState(1);
  const [search,setSearch]=useState("");
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [modal,setModal]=useState(false);
  const [editing,setEditing]=useState<Row|null>(null);
  const [values,setValues]=useState<Record<string,string>>({});
  const current=sections.find(s=>s.key===active)||sections[0];

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      if(active==="overview"){
        const [finance,fees,gateway]=await Promise.all([
          api.get("/finance/dashboard"),
          api.get("/fees/dashboard"),
          api.get("/fees/gateway/status"),
        ]);
        setSummary({finance:unwrap(finance),fees:unwrap(fees),gateway:unwrap(gateway)});
        setRows([]);setPagination(null);
      }else if(active==="ledger"){
        const transactionsResponse=await api.get("/finance/transactions",{params:{page,limit:20,search:search||undefined}});
        const data=unwrap(transactionsResponse);
        setRows(rowsFrom(data));
        setPagination(transactionsResponse?.data?.pagination||data?.pagination||null);
      }else{
        const response=await api.get(current.endpoint,{params:{page,limit:20,search:search||undefined}});
        const data=unwrap(response);
        setRows(rowsFrom(data));
        setPagination(response?.data?.pagination||data?.pagination||null);
      }
    }catch(cause:any){
      setError(cause?.response?.data?.message||cause?.message||"Unable to load finance records.");
      setRows([]);setSummary({});
    }finally{setLoading(false);}
  },[active,current.endpoint,page,search]);
  useEffect(()=>{void load();},[load]);

  const create=async(e:FormEvent)=>{
    e.preventDefault();setSaving(true);setError("");setNotice("");
    try{
      const body:Record<string,unknown>={};
      for(const field of current.fields||[]){
        const raw=values[field.name];
        if(raw===undefined||raw==="")continue;
        if(field.type==="json")body[field.name]=JSON.parse(raw);
        else if(field.type==="number")body[field.name]=Number(raw);
        else if(["isOptional","isRefundable"].includes(field.name))body[field.name]=raw.toLowerCase()==="true";
        else body[field.name]=raw;
      }
      if(active==="payments"&&!body.idempotencyKey)body.idempotencyKey=`web-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
      if(editing) await api.patch(`${current.endpoint}/${getId(editing)}`,body);
      else await api.post(current.createEndpoint||current.endpoint,body);
      setModal(false);setEditing(null);setValues({});setNotice(`${current.label} record ${editing?"updated":"created"} successfully.`);await load();
    }catch(cause:any){setError(cause?.response?.data?.message||cause?.message||"Unable to save record. Check IDs and required fields.");}
    finally{setSaving(false);}
  };

  const downloadPdf=async(url:string,filename:string)=>{
    try{
      const response=await api.get(url,{responseType:"blob"});
      const blob=new Blob([response.data],{type:"application/pdf"});
      const objectUrl=URL.createObjectURL(blob);
      const anchor=document.createElement("a");
      anchor.href=objectUrl;anchor.download=filename;anchor.click();
      URL.revokeObjectURL(objectUrl);
      setNotice("PDF downloaded.");
    }catch(cause:any){setError(cause?.response?.data?.message||cause?.message||"Unable to download PDF.");}
  };

  const startOnlinePayment=async(row:Row)=>{
    const invoiceId=getId(row);
    try{
      const orderResponse=await api.post("/fees/gateway/orders",{invoiceId,amount:Number(row.balanceAmount)});
      const order=unwrap(orderResponse);
      const scriptUrl="https://checkout.razorpay.com/v1/checkout.js";
      if(!document.querySelector(`script[src="${scriptUrl}"]`)){
        await new Promise<void>((resolve,reject)=>{
          const script=document.createElement("script");script.src=scriptUrl;script.async=true;
          script.onload=()=>resolve();script.onerror=()=>reject(new Error("Unable to load Razorpay Checkout."));
          document.body.appendChild(script);
        });
      }
      const Razorpay=(window as unknown as {Razorpay?:new(options:RazorpayCheckoutOptions)=>RazorpayCheckoutInstance}).Razorpay;
      if(!Razorpay)throw new Error("Razorpay Checkout is not available in this browser.");
      const checkout=new Razorpay({
        key:order.keyId,amount:Number(order.amount),currency:String(order.currency||"INR"),
        name:"MirexERP School Fees",description:`Fee invoice ${String(order.invoiceNumber||"")}`,
        order_id:String(order.orderId),
        handler:async(payment)=>{
          try{
            await api.post("/fees/gateway/verify",{invoiceId,razorpayOrderId:payment.razorpay_order_id,razorpayPaymentId:payment.razorpay_payment_id,razorpaySignature:payment.razorpay_signature});
            setNotice("Online payment verified and recorded successfully.");await load();
          }catch(cause:any){setError(cause?.response?.data?.message||cause?.message||"Payment verification failed. Contact the school accountant with your payment ID.");}
        },
        modal:{ondismiss:()=>setNotice("Payment checkout closed. No payment was recorded by this action.")},
      });
      checkout.open();
    }catch(cause:any){setError(cause?.response?.data?.message||cause?.message||"Unable to start online payment.");}
  };

  const applyLateFines=async()=>{
    try{
      const response=await api.post("/fees/invoices/apply-late-fines",{});
      const result=unwrap(response);
      setNotice(`Late fines updated on ${result?.updatedInvoices ?? 0} overdue invoices.`);
      await load();
    }catch(cause:any){setError(cause?.response?.data?.message||cause?.message||"Unable to apply late fines.");}
  };

  const runAction=async(row:Row,action:string)=>{
    const id=getId(row);if(!id)return;
    try{
      if(action==="cancel-invoice")await api.patch(`/fees/invoices/${id}/cancel`,{});
      if(action==="approve-discount")await api.patch(`/fees/discounts/${id}/approve`,{});
      if(action==="reject-discount")await api.patch(`/fees/discounts/${id}/reject`,{});
      if(action==="approve-refund")await api.patch(`/fees/refunds/${id}/approve`,{});
      if(action==="reject-refund")await api.patch(`/fees/refunds/${id}/reject`,{remarks:"Rejected from finance workspace"});
      if(action==="process-refund")await api.patch(`/fees/refunds/${id}/process`,{});
      setNotice("Workflow action completed.");await load();
    }catch(cause:any){setError(cause?.response?.data?.message||cause?.message||"Workflow action failed.");}
  };

  const financeSummary=summary.finance?.summary||{};
  const feeSummary=summary.fees||{};
  const columns=useMemo(()=>current.columns,[current]);
  const canCreate=Boolean(current.fields?.length)&&active!=="ledger"&&active!=="overview";
  const editableSections=["fee-heads","structures","invoices","categories","vendors","income","expenses"];
  const deletableSections=["fee-heads","structures","categories","vendors","income","expenses"];
  const canEdit=editableSections.includes(active);
  const canDelete=deletableSections.includes(active);
  const openCreate=()=>{setEditing(null);setValues({});setModal(true);};
  const openEdit=(row:Row)=>{
    const next:Record<string,string>={};
    for(const field of current.fields||[]){
      const value=row[field.name];
      if(value==null) next[field.name]="";
      else if(Array.isArray(value)) next[field.name]=JSON.stringify(value.map((item)=>item&&typeof item==="object"&&"_id" in item&&!("amount" in item)?String((item as {_id:unknown})._id):item),null,2);
      else if(typeof value==="object"&&"_id" in value) next[field.name]=String((value as {_id:unknown})._id);
      else if(typeof value==="object") next[field.name]=JSON.stringify(value,null,2);
      else next[field.name]=String(value);
    }
    setEditing(row);setValues(next);setModal(true);
  };
  const removeRecord=async(row:Row)=>{
    if(!window.confirm(`Deactivate or remove this ${current.label.toLowerCase()} record?`))return;
    try{await api.delete(`${current.endpoint}/${getId(row)}`);setNotice("Record deactivated or cancelled successfully.");await load();}
    catch(cause:any){setError(cause?.response?.data?.message||cause?.message||"Unable to remove this record.");}
  };

  return <main className="ff-workspace">
    <header className="ff-header"><div><span className="ff-eyebrow">MIREXERP · PHASE 4 FINANCE</span><h1>Fees & Finance</h1><p>Manage student dues, collections, refunds, school income and expenses using live school records.</p></div><button className="ff-refresh" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> Refresh</button></header>
    <nav className="ff-tabs" aria-label="Fees and finance sections">{sections.map(s=><button key={s.key} className={active===s.key?"active":""} onClick={()=>{setActive(s.key);setPage(1);setSearch("");setError("");setNotice("");}}>{s.label}</button>)}</nav>
    {notice&&<div className="ff-message success"><CheckCircle2 size={16}/>{notice}</div>}
    {error&&<div className="ff-message error"><AlertCircle size={16}/>{error}</div>}
    {active==="overview"?<>
      <section className="ff-stat-grid">
        <article><span><ArrowDownLeft size={17}/> Other income</span><strong>{money(financeSummary.otherIncome)}</strong><small>Non-fee income entries</small></article>
        <article><span><ArrowUpRight size={17}/> Expenses</span><strong>{money(financeSummary.totalExpenses)}</strong><small>Expense entries recorded</small></article>
        <article><span><Wallet size={17}/> Net finance balance</span><strong>{money(financeSummary.netBalance)}</strong><small>Other income less expenses</small></article>
        <article><span><BadgeIndianRupee size={17}/> Fee collection</span><strong>{money(financeSummary.feeCollection ?? feeSummary.payments?.totalCollected)}</strong><small>{feeSummary.payments?.totalPayments ?? 0} successful fee payments</small></article>
        <article><span><FileText size={17}/> Pending fee balance</span><strong>{money(feeSummary.invoices?.pendingAmount)}</strong><small>Outstanding invoice balance</small></article>
        <article><span><ShieldCheck size={17}/> Online payment gateway</span><strong>{summary.gateway?.configured?"Configured":"Not configured"}</strong><small>{summary.gateway?.webhookConfigured?"Webhook ready":"Webhook secret required"}</small></article>
      </section>
      <section className="ff-overview-grid">
        <article><h3><CircleDollarSign size={18}/> Fee management</h3><p>Fee heads, class fee structures, student assignments, invoices, partial collections, discounts and refund approvals.</p><button onClick={()=>setActive("invoices")}>Open fee invoices</button></article>
        <article><h3><Activity size={18}/> Finance operations</h3><p>Income and expense vouchers, categories, transaction ledger, cashbook and profit/loss reports.</p><button onClick={()=>setActive("categories")}>Manage categories</button></article>
      </section>
      <section className="ff-report-actions"><h3>Live reports</h3><button onClick={async()=>{try{const r=await api.post("/finance/reconciliation/source-postings");setSummary(v=>({...v,reconciliation:unwrap(r)}));setNotice("Finance source-posting reconciliation completed.");}catch(e:any){setError(e?.response?.data?.message||"Reconciliation failed.");}}}><RefreshCw size={15}/> Reconcile fee/payroll postings</button><button onClick={async()=>{try{const r=await api.get("/fees/reports/collection");setSummary(v=>({...v,report:unwrap(r)}));setNotice("Fee collection report loaded.");}catch(e:any){setError(e?.response?.data?.message||"Report unavailable.");}}}><FileText size={15}/> Fee collection</button><button onClick={async()=>{try{const r=await api.get("/fees/reports/outstanding");setSummary(v=>({...v,report:unwrap(r)}));setNotice("Outstanding fee report loaded.");}catch(e:any){setError(e?.response?.data?.message||"Report unavailable.");}}}><ClipboardList size={15}/> Outstanding fees</button><button onClick={async()=>{try{const r=await api.get("/finance/reports/profit-loss");setSummary(v=>({...v,report:unwrap(r)}));setNotice("Profit & loss report loaded.");}catch(e:any){setError(e?.response?.data?.message||"Report unavailable.");}}}><BookOpen size={15}/> Profit & loss</button></section>
      {summary.report&&<pre className="ff-report-json">{JSON.stringify(summary.report,null,2)}</pre>}
    </>:<>
      <section className="ff-toolbar"><div><h2>{current.label}</h2><p>Connected endpoint: <code>{current.endpoint}</code></p></div><div className="ff-toolbar-actions"><label className="ff-search"><Search size={16}/><input value={search} onChange={e=>{setPage(1);setSearch(e.target.value);}} placeholder={`Search ${current.label.toLowerCase()}`}/></label>{current.key==="invoices"&&<button className="ff-secondary-action" onClick={()=>void applyLateFines()}>Apply overdue fines</button>}{canCreate&&<button onClick={openCreate}><Plus size={16}/> Add {current.label.replace(/s$/,"")}</button>}</div></section>
      <section className="ff-table-card">{loading?<div className="ff-empty">Loading live records…</div>:rows.length?<>
        <div className="ff-table-wrap"><table><thead><tr>{columns.map(c=><th key={c}>{c.replace(/([A-Z])/g," $1")}</th>)}{(current.action||canEdit||canDelete)&&<th>Actions</th>}</tr></thead><tbody>{rows.map((row,index)=><tr key={getId(row)||index}>{columns.map(c=><td key={c}>{c.toLowerCase().includes("amount")||c==="totalAmount"||c==="paidAmount"||c==="balanceAmount"?money(row[c]):cell(row[c])}</td>)}{(current.action||canEdit||canDelete)&&<td><div className="ff-row-actions">
          {canEdit&&<button onClick={()=>openEdit(row)}>Edit</button>}
          {canDelete&&<button className="danger" onClick={()=>void removeRecord(row)}>Deactivate</button>}
          {current.action==="cancel-invoice"&&<><button onClick={()=>void downloadPdf(`/fees/invoices/${getId(row)}/pdf`, `fee-invoice-${getId(row)}.pdf`)}>Invoice PDF</button>{Number(row.balanceAmount)>0&&row.status!=="CANCELLED"&&<button onClick={()=>void startOnlinePayment(row)}>Pay online</button>}{row.status!=="CANCELLED"&&<button className="danger" onClick={()=>void runAction(row,"cancel-invoice")}>Cancel</button>}</>}
          {current.action==="download-receipt"&&<button onClick={()=>void downloadPdf(`/fees/payments/${getId(row)}/receipt.pdf`, `fee-receipt-${getId(row)}.pdf`)}>Receipt PDF</button>}
          {current.action==="approve-discount"&&!row.isApproved&&<><button onClick={()=>void runAction(row,"approve-discount")}>Approve</button><button className="danger" onClick={()=>void runAction(row,"reject-discount")}>Reject</button></>}
          {current.action==="approve-refund"&&row.status==="PENDING"&&<><button onClick={()=>void runAction(row,"approve-refund")}>Approve</button><button className="danger" onClick={()=>void runAction(row,"reject-refund")}>Reject</button></>}
          {current.action==="approve-refund"&&row.status==="APPROVED"&&<button onClick={()=>void runAction(row,"process-refund")}>Mark processed</button>}
        </div></td>}</tr>)}</tbody></table></div>
        <footer className="ff-pagination"><span>{rows.length} records · Page {page}{pagination?.total?` of ${pagination.totalPages}`:""}</span><div><button disabled={page<=1} onClick={()=>setPage(v=>v-1)}><ChevronLeft size={16}/></button><button disabled={pagination?!pagination.hasNextPage:rows.length<20} onClick={()=>setPage(v=>v+1)}><ChevronRight size={16}/></button></div></footer>
      </>:<div className="ff-empty"><FileText size={24}/><strong>No {current.label.toLowerCase()} records</strong><span>Data will appear after it is created in this school.</span>{canCreate&&<button onClick={openCreate}><Plus size={15}/> Create first record</button>}</div>}</section>
    </>}
    {modal&&<div className="ff-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false);}}><section className="ff-modal"><header><div><span className="ff-eyebrow">{editing?"UPDATE RECORD":"NEW RECORD"}</span><h2>{editing?"Edit":"Add"} {current.label}</h2></div><button className="ff-close" onClick={()=>setModal(false)}><XCircle size={20}/></button></header><form onSubmit={create}><div className="ff-form-grid">{(current.fields||[]).map(field=><label key={field.name} className={field.wide||field.type==="textarea"||field.type==="json"?"wide":""}><span>{field.label}{field.required&&" *"}</span>{field.type==="select"?<select required={field.required} value={values[field.name]||""} onChange={e=>setValues(v=>({...v,[field.name]:e.target.value}))}><option value="">Select {field.label}</option>{(field.options||[]).map(o=><option key={o} value={o}>{o}</option>)}</select>:field.type==="textarea"||field.type==="json"?<textarea required={field.required} rows={field.type==="json"?5:3} value={values[field.name]||""} onChange={e=>setValues(v=>({...v,[field.name]:e.target.value}))} placeholder={field.type==="json"?"Enter valid JSON":"Optional notes"}/>:<input required={field.required} type={field.type==="number"?"number":field.type==="date"?"date":"text"} step={field.type==="number"?"0.01":undefined} value={values[field.name]||""} onChange={e=>setValues(v=>({...v,[field.name]:e.target.value}))} placeholder={field.label}/>}</label>)}</div><footer><button type="button" className="ff-cancel" onClick={()=>setModal(false)}>Cancel</button><button type="submit" disabled={saving}>{saving?"Saving…":editing?"Save changes":"Save record"}</button></footer></form></section></div>}
  </main>;
}
