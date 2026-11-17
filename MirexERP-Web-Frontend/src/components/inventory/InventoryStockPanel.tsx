"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import { RefreshCw, ArrowDownToLine, ArrowUpFromLine, History } from "lucide-react";
import "./InventoryStockPanel.css";

type Item = { _id:string; name:string; itemCode:string; category:string; quantity:number; unit?:string; minimumStockLevel?:number; status?:string };
type Tx = { _id:string; transactionType:string; quantity:number; previousQuantity:number; newQuantity:number; reason?:string; createdAt:string; issuedToName?:string };
const unwrap=(r:any)=>r?.data?.data??r?.data??r;
const list=(v:any):any[]=>Array.isArray(v)?v:Array.isArray(v?.items)?v.items:[];
export function InventoryStockPanel(){
 const [items,setItems]=useState<Item[]>([]),[summary,setSummary]=useState<any>(null),[selected,setSelected]=useState(""),[operation,setOperation]=useState("ADD"),[quantity,setQuantity]=useState("1"),[reason,setReason]=useState(""),[movementKey,setMovementKey]=useState(""),[transactions,setTransactions]=useState<Tx[]>([]),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{try{const [r,d]=await Promise.all([api.get("/inventory",{params:{page:1,limit:100}}),api.get("/inventory/dashboard").catch(()=>null)]);const rows=list(unwrap(r));setItems(rows);setSummary(d?unwrap(d):null);if(!selected&&rows[0])setSelected(rows[0]._id);}catch(e:any){setError(e?.response?.data?.message||"Unable to load inventory stock.");}},[selected]);
 useEffect(()=>{void load();},[load]);
 const loadHistory=async(id:string)=>{if(!id)return;try{const r=await api.get(`/inventory/${id}/transactions`,{params:{page:1,limit:30}});setTransactions(list(unwrap(r)));}catch(e:any){setError(e?.response?.data?.message||"Unable to load stock history.");}};
 useEffect(()=>{void loadHistory(selected);},[selected]);
 const submit=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError("");setNotice("");try{const key=movementKey||`STOCK-${Date.now()}-${Math.random().toString(36).slice(2)}`;setMovementKey(key);await api.post(`/inventory/${selected}/adjust-stock`,{quantity:Number(quantity),operation,reason,idempotencyKey:key});setMovementKey("");setNotice(`Stock ${operation==="ADD"?"inward":"outward"} recorded successfully.`);setQuantity("1");setReason("");await load();await loadHistory(selected);}catch(e:any){setError(e?.response?.data?.message||"Stock movement failed.");}finally{setBusy(false);}};
 const current=items.find(i=>i._id===selected);
 return <section className="inventory-stock-panel">
  {summary&&<div className="isp-metrics"><article><small>Items</small><b>{summary.totalItems??items.length}</b></article><article><small>Low stock</small><b>{summary.lowStockItems??0}</b></article><article><small>Out of stock</small><b>{summary.outOfStockItems??0}</b></article><article><small>Vendors</small><b>{summary.totalVendors??0}</b></article><article><small>Pending POs</small><b>{summary.pendingPurchaseOrders??0}</b></article><article><small>Stock valuation</small><b>₹{Number(summary.stock?.value||0).toLocaleString("en-IN")}</b></article></div>}
  <header><div><span>INVENTORY CONTROL</span><h2>Stock In / Stock Out</h2><p>Record actual stock movements and inspect the item transaction history.</p></div><button onClick={()=>void load()}><RefreshCw size={15}/> Refresh</button></header>
  {error&&<p className="isp-error">{error}</p>}{notice&&<p className="isp-notice">{notice}</p>}
  <div className="isp-grid">
   <form onSubmit={submit} className="isp-card"><h3>New stock movement</h3><label>Inventory item<select required value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Select item</option>{items.map(i=><option key={i._id} value={i._id}>{i.itemCode} · {i.name}</option>)}</select></label><div className="isp-current"><span>Available quantity</span><b>{current?`${current.availableQuantity ?? current.quantity} ${current.unit||"units"}`:"—"}</b><small>{current?`Minimum stock: ${current.minimumStockLevel??0}`:"Select an item"}</small></div><label>Movement type<select value={operation} onChange={e=>setOperation(e.target.value)}><option value="ADD">Stock In</option><option value="REMOVE">Stock Out</option></select></label><label>Quantity<input type="number" min="0.01" step="0.01" required value={quantity} onChange={e=>setQuantity(e.target.value)}/></label><label>Reason<input required minLength={2} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Purchase, damaged, correction…"/></label><button className="isp-submit" disabled={busy||!selected}>{busy?"Saving movement…":operation==="ADD"?"Record Stock In":"Record Stock Out"}</button></form>
   <div className="isp-card"><h3><History size={17}/> Recent stock movements</h3>{transactions.length?<div className="isp-history">{transactions.map(t=><article key={t._id}><div className={t.transactionType==="PURCHASE"||t.transactionType==="RETURN"?"in":"out"}>{t.transactionType==="PURCHASE"||t.transactionType==="RETURN"?<ArrowDownToLine size={16}/>:<ArrowUpFromLine size={16}/>}</div><section><b>{t.transactionType.replaceAll("_"," ")}</b><small>{t.reason||t.issuedToName||"Stock movement"} · {new Date(t.createdAt).toLocaleString("en-IN")}</small></section><strong>{t.transactionType==="PURCHASE"||t.transactionType==="RETURN"?"+":"−"}{t.quantity}</strong><small>{t.previousQuantity} → {t.newQuantity}</small></article>)}</div>:<p className="isp-empty">No stock movement history for this item yet.</p>}</div>
  </div>
 </section>;
}
