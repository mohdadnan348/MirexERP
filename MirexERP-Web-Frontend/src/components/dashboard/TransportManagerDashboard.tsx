"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {api} from "@/lib/api/client";
import {AlertCircle,ArrowUpRight,Bus,CheckCircle2,Clock3,RefreshCw,Route,Users} from "lucide-react";
import "./TransportManagerDashboard.css";
type Vehicle={_id:string;vehicleNumber:string;vehicleName:string;routeName:string;capacity:number;status:string;assignedStudents?:any[];insuranceExpiry?:string;fitnessExpiry?:string;permitExpiry?:string;stops?:any[]};
const unwrap=(r:any)=>r?.data?.data??r?.data??r;const rows=(v:any)=>Array.isArray(v)?v:Array.isArray(v?.items)?v.items:[];
export function TransportManagerDashboard(){
 const [vehicles,setVehicles]=useState<Vehicle[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
 const load=useCallback(async()=>{setLoading(true);setError("");try{const r=await api.get("/transport",{params:{page:1,limit:100}});setVehicles(rows(unwrap(r)));}catch(e:any){setError(e?.response?.data?.message||e?.message||"Transport dashboard could not load.");}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 const active=vehicles.filter(v=>v.status==="ACTIVE").length,assigned=vehicles.reduce((n,v)=>n+(v.assignedStudents?.length||0),0),routes=new Set(vehicles.map(v=>v.routeName).filter(Boolean)).size;
 const soon=(d?:string)=>!!d&&new Date(d).getTime()>=Date.now()&&new Date(d).getTime()<=Date.now()+30*86400000;
 const expired=(d?:string)=>!!d&&new Date(d).getTime()<Date.now();
 const alerts=vehicles.filter(v=>[v.insuranceExpiry,v.fitnessExpiry,v.permitExpiry].some(d=>soon(d)||expired(d)));
 const cards=[["Total vehicles",vehicles.length,Bus],["Active vehicles",active,CheckCircle2],["Total routes",routes,Route],["Assigned students",assigned,Users],["Maintenance vehicles",vehicles.filter(v=>v.status==="MAINTENANCE").length,AlertCircle],["Pending assignments","N/A",Clock3]];
 return <main className="tmd-page"><header className="tmd-hero"><div><span>MIREXERP / TRANSPORT</span><h1>Transport Dashboard</h1><p>Fleet, routes and student transport at a glance.</p></div><button onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> {loading?"Refreshing":"Refresh"}</button></header>
 {error&&<div className="tmd-error"><AlertCircle size={17}/>{error}</div>}
 <section className="tmd-grid">{cards.map(([label,value,Icon]:any)=><article key={label}><i><Icon size={19}/></i><small>{label}</small><b>{loading?"—":typeof value==="number"?value.toLocaleString("en-IN"):value}</b></article>)}</section>
 <section className="tmd-content"><article className="tmd-panel"><div className="tmd-heading"><div><h2>Fleet status</h2><p>Current vehicle records</p></div><Link href="/transport">Manage fleet <ArrowUpRight size={14}/></Link></div>
 {loading?<p className="tmd-empty">Loading…</p>:vehicles.length?vehicles.slice(0,7).map(v=><div className="tmd-vehicle" key={v._id}><span className="tmd-bus"><Bus size={17}/></span><div><b>{v.vehicleNumber} · {v.vehicleName}</b><small>{v.routeName} · {(v.assignedStudents||[]).length}/{v.capacity} students</small></div><em className={v.status.toLowerCase()}>{v.status}</em></div>):<p className="tmd-empty">No vehicles added yet.</p>}</article>
 <article className="tmd-panel"><div className="tmd-heading"><div><h2>Maintenance & expiry alerts</h2><p>Insurance, fitness and permit dates</p></div><AlertCircle size={18}/></div>
 {alerts.length?alerts.map(v=><div className="tmd-alert-row" key={v._id}><b>{v.vehicleNumber}</b><small>{[["Insurance",v.insuranceExpiry],["Fitness",v.fitnessExpiry],["Permit / PUC",v.permitExpiry]].filter(([,d]:any)=>soon(d)||expired(d)).map(([n,d]:any)=>`${n}: ${expired(d)?"Expired":"Due soon"} (${new Date(d).toLocaleDateString("en-IN")})`).join(" · ")}</small></div>):<p className="tmd-empty">{loading?"Loading alerts…":"No upcoming expiry alerts in the next 30 days."}</p>}
 <Link className="tmd-link" href="/transport?tab=documents">View vehicle documents <ArrowUpRight size={14}/></Link></article></section>
 <section className="tmd-shortcuts"><Link href="/transport?mode=create"><Bus size={18}/> Add vehicle</Link><Link href="/transport?tab=routes"><Route size={18}/> Manage routes</Link><Link href="/transport?tab=assignments"><Users size={18}/> Assign students</Link><Link href="/transport?tab=maintenance"><Clock3 size={18}/> Maintenance</Link></section>
 <footer>Live vehicle and assignment counts from your school's Transport API. Today's pickup/drop status is not currently recorded by the backend.</footer></main>;
}
