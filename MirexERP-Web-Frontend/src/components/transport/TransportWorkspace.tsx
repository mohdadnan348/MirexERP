"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api/client";
import { AlertCircle, Bus, CheckCircle2, Clock3, Edit3, Plus, RefreshCw, Search, Trash2, Users, X } from "lucide-react";
import "./TransportWorkspace.css";

type Stop = { _id?: string; stopName: string; address: string; pickupTime: string; dropTime: string; monthlyFee: number };
type Vehicle = {
  _id: string; vehicleNumber: string; vehicleType: string; vehicleName: string; capacity: number;
  driverId?: any; driverName: string; driverPhone: string; routeName: string; stops: Stop[];
  status: "ACTIVE"|"INACTIVE"|"MAINTENANCE"; insuranceExpiry?: string; fitnessExpiry?: string; permitExpiry?: string;
  assignedStudents?: any[];
  studentAssignments?: Array<{studentId:any;stopId:string;assignedAt?:string}>;
};
type Employee = {_id:string;firstName?:string;lastName?:string;phone?:string;employeeId?:string};
type Student = {_id:string;firstName?:string;lastName?:string;admissionNumber?:string};
const unwrap=(r:any)=>r?.data?.data??r?.data??r;
const list=(v:any)=>Array.isArray(v)?v:Array.isArray(v?.items)?v.items:[];
const emptyStop=():Stop=>({stopName:"",address:"",pickupTime:"07:00",dropTime:"15:00",monthlyFee:0});
const emptyForm=()=>({vehicleNumber:"",vehicleType:"BUS",vehicleName:"",capacity:40,driverId:"",driverName:"",driverPhone:"",routeName:"",status:"ACTIVE" as const,insuranceExpiry:"",fitnessExpiry:"",permitExpiry:"",stops:[emptyStop()]});

export function TransportWorkspace(){
 const params=useSearchParams(); const [vehicles,setVehicles]=useState<Vehicle[]>([]);
 const [employees,setEmployees]=useState<Employee[]>([]); const [students,setStudents]=useState<Student[]>([]);
 const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState(""); const [notice,setNotice]=useState("");
 const [search,setSearch]=useState(""); const [modal,setModal]=useState(false); const [editing,setEditing]=useState<string|null>(null);
 const [form,setForm]=useState<any>(emptyForm()); const [summary,setSummary]=useState<any>(null); const [assignVehicle,setAssignVehicle]=useState(""); const [studentId,setStudentId]=useState(""); const [stopId,setStopId]=useState("");
 const tab=params.get("tab")||"vehicles";
 const load=useCallback(async()=>{setLoading(true);setError("");try{
   const [v,e,s,d]=await Promise.all([
     api.get("/transport",{params:{page:1,limit:100}}),
     api.get("/employees",{params:{page:1,limit:100}}).catch(()=>({data:[]})),
     api.get("/students",{params:{page:1,limit:100}}).catch(()=>({data:[]})),
     api.get("/transport/dashboard").catch(()=>null),
   ]);
   setVehicles(list(unwrap(v)));setEmployees(list(unwrap(e)));setStudents(list(unwrap(s)));setSummary(d?unwrap(d):null);
 }catch(err:any){setError(err?.response?.data?.message||err?.message||"Transport records could not be loaded.");}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{if(params.get("mode")==="create"){setEditing(null);setForm(emptyForm());setModal(true);}},[params]);
 const filtered=useMemo(()=>vehicles.filter(v=>[v.vehicleNumber,v.vehicleName,v.routeName,v.driverName].join(" ").toLowerCase().includes(search.toLowerCase())),[vehicles,search]);
 const openCreate=()=>{setEditing(null);setForm(emptyForm());setModal(true);setError("");};
 const openEdit=(v:Vehicle)=>{setEditing(v._id);setForm({...v,driverId:typeof v.driverId==="object"?v.driverId?._id||"":v.driverId||"",insuranceExpiry:v.insuranceExpiry?.slice(0,10)||"",fitnessExpiry:v.fitnessExpiry?.slice(0,10)||"",permitExpiry:v.permitExpiry?.slice(0,10)||"",stops:v.stops?.length?v.stops.map(x=>({...x})): [emptyStop()]});setModal(true);setError("");};
 const updateStop=(idx:number,key:string,value:any)=>setForm((old:any)=>({...old,stops:old.stops.map((st:Stop,i:number)=>i===idx?{...st,[key]:value}:st)}));
 const save=async(e:any)=>{e.preventDefault();setSaving(true);setError("");setNotice("");try{
   const payload={...form,capacity:Number(form.capacity),stops:form.stops.map((st:Stop)=>({...st,monthlyFee:Number(st.monthlyFee)})),insuranceExpiry:form.insuranceExpiry||null,fitnessExpiry:form.fitnessExpiry||null,permitExpiry:form.permitExpiry||null};
   if(editing) await api.patch(`/transport/${editing}`,payload); else await api.post("/transport",payload);
   setModal(false);setNotice(editing?"Vehicle updated successfully.":"Vehicle created successfully.");await load();
 }catch(err:any){setError(err?.response?.data?.message||err?.message||"Could not save vehicle.");}finally{setSaving(false);}};
 const remove=async(v:Vehicle)=>{if(!window.confirm(`Deactivate vehicle ${v.vehicleNumber}?`))return;try{await api.delete(`/transport/${v._id}`);setNotice("Vehicle deactivated.");await load();}catch(e:any){setError(e?.response?.data?.message||"Could not deactivate vehicle.");}};
 const assign=async(e:any)=>{e.preventDefault();setSaving(true);setError("");try{await api.post(`/transport/${assignVehicle}/assign`,{studentId,stopId});setNotice("Student transport assigned.");setStudentId("");setStopId("");await load();}catch(err:any){setError(err?.response?.data?.message||"Assignment failed.");}finally{setSaving(false);}};
 const unassign=async(v:Vehicle,id:string)=>{try{await api.delete(`/transport/${v._id}/assign/${id}`,{data:{studentId:id}});setNotice("Student assignment removed.");await load();}catch(e:any){setError(e?.response?.data?.message||"Could not remove assignment.");}};
 const chosen=vehicles.find(v=>v._id===assignVehicle);
 const title=tab==="assignments"?"Student Assignments":tab==="routes"||tab==="stops"?"Routes & Stops":tab==="drivers"?"Drivers":tab==="fees"?"Transport Fee Records":tab==="maintenance"?"Maintenance":tab==="documents"?"Vehicle Documents":tab==="reports"?"Transport Reports":"Vehicle Fleet";
 return <main className="tw-page">
  <header className="tw-hero"><div><span className="tw-kicker">MIREXERP / TRANSPORT</span><h1>{title}</h1><p>Manage your school's fleet, routes and student transport assignments.</p></div><div className="tw-actions"><button className="tw-ghost" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/> Refresh</button><button className="tw-primary" onClick={openCreate}><Plus size={16}/> Add vehicle</button></div></header>
  {summary&&<section className="tw-summary"><article><small>Vehicles</small><b>{summary.totalVehicles??vehicles.length}</b></article><article><small>Active</small><b>{summary.activeVehicles??0}</b></article><article><small>Routes</small><b>{summary.totalRoutes??0}</b></article><article><small>Assigned students</small><b>{summary.totalAssignedStudents??vehicles.reduce((n,v)=>n+(v.assignedStudents||[]).length,0)}</b></article><article><small>Maintenance</small><b>{summary.vehiclesUnderMaintenance??0}</b></article><article><small>Available capacity</small><b>{summary.availableCapacity??0}</b></article></section>}
  {(error||notice)&&<div className={error?"tw-alert":"tw-notice"}>{error?<AlertCircle size={17}/>:<CheckCircle2 size={17}/>}<span>{error||notice}</span><button onClick={()=>{setError("");setNotice("");}}><X size={15}/></button></div>}
  {tab==="assignments"? <section className="tw-panel"><h2>Assign student to a vehicle route</h2><p>Choose an active vehicle, student and pickup stop.</p>
    <form className="tw-assign-form" onSubmit={assign}><label>Vehicle<select required value={assignVehicle} onChange={e=>{setAssignVehicle(e.target.value);setStopId("");}}><option value="">Select vehicle</option>{vehicles.filter(v=>v.status==="ACTIVE").map(v=><option key={v._id} value={v._id}>{v.vehicleNumber} · {v.routeName}</option>)}</select></label>
    <label>Student<select required value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">Select student</option>{students.map(s=><option key={s._id} value={s._id}>{s.admissionNumber||""} · {s.firstName} {s.lastName}</option>)}</select></label>
    <label>Pickup stop<select required value={stopId} onChange={e=>setStopId(e.target.value)}><option value="">Select stop</option>{chosen?.stops?.map(st=><option key={st._id} value={st._id}>{st.stopName} · {st.pickupTime}</option>)}</select></label><button className="tw-primary" disabled={saving||!chosen?.stops?.length}>{saving?"Assigning…":"Assign student"}</button></form>
    <h3>Current assignments</h3>{vehicles.map(v=>(v.studentAssignments?.length?v.studentAssignments:(v.assignedStudents||[]).map((studentId:any)=>({studentId,stopId:""}))).map((a:any)=>{const st=a.studentId||{};const sid=typeof st==="string"?st:st._id;const stop=v.stops?.find(x=>x._id===a.stopId);return <div className="tw-assignment" key={`${v._id}-${sid}`}><span><b>{st.firstName?`${st.firstName} ${st.lastName||""}`:"Student"}</b><small>{st.admissionNumber||sid} · {v.vehicleNumber} · {v.routeName} · Pickup: {stop?.stopName||(a.stopId?"Stop not found":"Not recorded on legacy assignment")}</small></span><button onClick={()=>unassign(v,sid)}>Remove</button></div>}))}{!vehicles.some(v=>(v.studentAssignments?.length||(v.assignedStudents||[]).length)>0)&&<p className="tw-empty">No student assignments found.</p>}</section>
  : tab==="fees"?<section className="tw-panel"><h2>Stop-wise transport charges</h2><p>Monthly charges are configured against each route stop. Actual payment collection remains in the Accountant panel.</p>{vehicles.map(v=><div className="tw-row" key={v._id}><div><b>{v.routeName}</b><small>{v.vehicleNumber}</small></div><span>{v.stops?.map(s=><em key={s._id||s.stopName}>{s.stopName}: ₹{Number(s.monthlyFee||0).toLocaleString("en-IN")}/month</em>)}</span></div>)}</section>
  : tab==="maintenance"||tab==="documents"?<section className="tw-panel"><h2>{tab==="documents"?"Expiry & vehicle documents":"Vehicle maintenance overview"}</h2><p>Expiry dates currently supported by the transport record. Uploadable document files and service logs are not exposed by the existing backend.</p>{vehicles.map(v=><div className="tw-row" key={v._id}><div><b>{v.vehicleNumber} · {v.vehicleName}</b><small>{v.routeName}</small></div><span><em>Insurance: {v.insuranceExpiry?new Date(v.insuranceExpiry).toLocaleDateString("en-IN"):"Not set"}</em><em>Fitness: {v.fitnessExpiry?new Date(v.fitnessExpiry).toLocaleDateString("en-IN"):"Not set"}</em><em>Permit / PUC: {v.permitExpiry?new Date(v.permitExpiry).toLocaleDateString("en-IN"):"Not set"}</em></span></div>)}</section>
  : tab==="drivers"?<section className="tw-panel"><h2>Drivers assigned to vehicles</h2><p>Driver information is stored on each transport record and linked to an employee.</p>{vehicles.map(v=><div className="tw-row" key={v._id}><div><b>{v.driverName||"Driver not set"}</b><small>{v.driverPhone||"No phone"} · {v.vehicleNumber}</small></div><span><em>{v.routeName}</em><em>{typeof v.driverId==="object"?v.driverId?.employeeId||"Employee":""}</em></span></div>)}</section>
  :<section className="tw-panel"><div className="tw-panel-head"><div><h2>{tab==="routes"||tab==="stops"?"Routes and route stops":"Vehicle records"}</h2><p>{filtered.length} records · live from Transport API</p></div><label className="tw-search"><Search size={16}/><input placeholder="Search vehicle, route or driver" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
    {loading?<p className="tw-empty">Loading transport records…</p>:filtered.length?<div className="tw-table-wrap"><table><thead><tr><th>Vehicle</th><th>Route & Stops</th><th>Driver</th><th>Capacity</th><th>Students</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(v=><tr key={v._id}><td><b>{v.vehicleNumber}</b><small>{v.vehicleName} · {v.vehicleType}</small></td><td><b>{v.routeName}</b><small>{(v.stops||[]).map(s=>s.stopName).join(" → ")||"No stops"}</small></td><td>{v.driverName}<small>{v.driverPhone}</small></td><td>{(v.assignedStudents||[]).length}/{v.capacity}</td><td>{(v.assignedStudents||[]).length}</td><td><span className={`tw-status ${v.status.toLowerCase()}`}>{v.status}</span></td><td><button className="tw-icon-btn" title="Edit" onClick={()=>openEdit(v)}><Edit3 size={16}/></button><button className="tw-icon-btn danger" title="Deactivate" onClick={()=>void remove(v)}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div>:<p className="tw-empty">No transport records found. Add your first vehicle to get started.</p>}
  </section>}
  <footer className="tw-foot">Records are loaded from the signed-in school's transport API. School-level tenant scope is enforced by the backend.</footer>
  {modal&&<div className="tw-modal-backdrop"><form className="tw-modal" onSubmit={save}><header><div><span className="tw-kicker">FLEET MANAGEMENT</span><h2>{editing?"Edit vehicle":"Add vehicle & route"}</h2></div><button type="button" className="tw-icon-btn" onClick={()=>setModal(false)}><X size={18}/></button></header>
    <div className="tw-form-grid">
      <label>Registration number *<input required value={form.vehicleNumber} onChange={e=>setForm({...form,vehicleNumber:e.target.value})}/></label>
      <label>Vehicle name *<input required value={form.vehicleName} onChange={e=>setForm({...form,vehicleName:e.target.value})}/></label>
      <label>Vehicle type<select value={form.vehicleType} onChange={e=>setForm({...form,vehicleType:e.target.value})}>{["BUS","MINI_BUS","VAN","CAB"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Seating capacity *<input type="number" min="1" required value={form.capacity} onChange={e=>setForm({...form,capacity:e.target.value})}/></label>
      <label>Driver / Employee *<select required value={form.driverId} onChange={e=>{const emp=employees.find(x=>x._id===e.target.value);setForm({...form,driverId:e.target.value,driverName:emp?`${emp.firstName||""} ${emp.lastName||""}`.trim():form.driverName,driverPhone:emp?.phone||form.driverPhone});}}><option value="">Select employee</option>{employees.map(e=><option key={e._id} value={e._id}>{e.employeeId||e._id} · {e.firstName} {e.lastName}</option>)}</select></label>
      <label>Driver phone *<input required value={form.driverPhone} onChange={e=>setForm({...form,driverPhone:e.target.value})}/></label>
      <label>Route name *<input required value={form.routeName} onChange={e=>setForm({...form,routeName:e.target.value})}/></label>
      <label>Status<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{["ACTIVE","INACTIVE","MAINTENANCE"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>Insurance expiry<input type="date" value={form.insuranceExpiry} onChange={e=>setForm({...form,insuranceExpiry:e.target.value})}/></label>
      <label>Fitness expiry<input type="date" value={form.fitnessExpiry} onChange={e=>setForm({...form,fitnessExpiry:e.target.value})}/></label>
      <label>Permit / PUC expiry<input type="date" value={form.permitExpiry} onChange={e=>setForm({...form,permitExpiry:e.target.value})}/></label>
    </div>
    <div className="tw-stop-head"><h3>Route stops</h3><button type="button" className="tw-ghost" onClick={()=>setForm({...form,stops:[...form.stops,emptyStop()]})}><Plus size={14}/> Add stop</button></div>
    {form.stops.map((st:Stop,i:number)=><div className="tw-stop-grid" key={i}><label>Stop name *<input required value={st.stopName} onChange={e=>updateStop(i,"stopName",e.target.value)}/></label><label>Address *<input required minLength={2} value={st.address} onChange={e=>updateStop(i,"address",e.target.value)}/></label><label>Pickup *<input type="time" required value={st.pickupTime} onChange={e=>updateStop(i,"pickupTime",e.target.value)}/></label><label>Drop *<input type="time" required value={st.dropTime} onChange={e=>updateStop(i,"dropTime",e.target.value)}/></label><label>Monthly fee (₹)<input type="number" min="0" value={st.monthlyFee} onChange={e=>updateStop(i,"monthlyFee",e.target.value)}/></label><button type="button" className="tw-icon-btn danger" onClick={()=>setForm({...form,stops:form.stops.filter((_:any,j:number)=>j!==i)})} disabled={form.stops.length===1}><Trash2 size={15}/></button></div>)}
    <footer><button type="button" className="tw-ghost" onClick={()=>setModal(false)}>Cancel</button><button className="tw-primary" disabled={saving}>{saving?"Saving…":editing?"Save changes":"Create vehicle"}</button></footer>
  </form></div>}
 </main>;
}
