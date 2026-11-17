"use client";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import { moduleConfigs, type FieldConfig, type ModuleConfig } from "@/config/modules";
import { Search, Plus, RefreshCw, Pencil, Trash2, X, AlertCircle, Database, ChevronLeft, ChevronRight, FileDown, CheckCircle2, XCircle, Send } from "lucide-react";
import "./ModuleWorkspace.css";

type RowData = Record<string, unknown> & { _id?: string; id?: string };
const getId = (row:RowData) => String(row._id || row.id || "");
const unwrap = (response:any):any => response?.data?.data ?? response?.data ?? response;
const getRows = (payload:any):RowData[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.records)) return payload.records;
  return [];
};
const humanize = (value:string) => value.replace(/([A-Z])/g," $1").replace(/[_-]/g," ").replace(/^./,s=>s.toUpperCase());
const display = (value:unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};
function FormInput({field,value,onChange}:{field:FieldConfig;value:string;onChange:(v:string)=>void}) {
  if(field.type==="textarea" || field.type==="json") return <textarea required={field.required} value={value} onChange={e=>onChange(e.target.value)} placeholder={field.placeholder || (field.type==="json"?"Enter valid JSON":"")} rows={field.type==="json"?5:3}/>;
  if(field.type==="select") {
    const choices = field.name==="type" ? ["NOTICE","ANNOUNCEMENT","EVENT","FEE_REMINDER","ATTENDANCE_ALERT","EXAM_UPDATE","GENERAL"] : field.name==="category" ? ["ACADEMIC","CULTURAL","SPORTS","CELEBRATION","MEETING","WORKSHOP","HOLIDAY","OTHER"] : field.name==="priority" ? ["LOW","NORMAL","HIGH","URGENT"] : field.name==="condition" ? ["NEW","GOOD","FAIR","DAMAGED","LOST"] : field.name==="status" && field.options ? field.options : field.name==="gender" ? ["MALE","FEMALE","OTHER"] : field.name==="status" ? ["ACTIVE","INACTIVE","PRESENT","ABSENT","LATE","HALF_DAY","LEAVE","PENDING","APPROVED","REJECTED","PAID","PARTIAL","OVERDUE"] : field.name==="attendanceType" ? ["STUDENT","EMPLOYEE"] : field.name==="employeeType" ? ["TEACHING","NON_TEACHING","ADMINISTRATIVE","SUPPORT"] : field.name==="employmentType" ? ["PERMANENT","CONTRACT","PART_TIME","TEMPORARY"] : field.name==="dayOfWeek" ? ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"] : field.name==="relation" ? ["FATHER","MOTHER","GUARDIAN","GRANDFATHER","GRANDMOTHER","OTHER"] : field.name==="paymentMethod" ? ["CASH","UPI","CARD","NET_BANKING","CHEQUE","BANK_TRANSFER","OTHER"] : field.name==="discountType" ? ["FIXED","PERCENTAGE"] : field.name==="attendanceStatus" ? ["PRESENT","ABSENT","LATE","HALF_DAY","LEAVE"] : field.name==="holidayType" ? ["NATIONAL","STATE","RELIGIOUS","SCHOOL","OPTIONAL","OTHER"] : field.name==="applicableTo" ? ["STUDENTS","EMPLOYEES","BOTH"] : field.name==="applicantType" ? ["STUDENT","EMPLOYEE"] : field.name==="leaveType" ? ["CASUAL","SICK","EARNED","UNPAID","MATERNITY","PATERNITY","OTHER"] : field.name==="examType" ? ["UNIT_TEST","PERIODIC_TEST","MID_TERM","FINAL","PRACTICAL","OTHER"] : field.name==="status" ? ["PRESENT","ABSENT","LATE","HALF_DAY","LEAVE","HOLIDAY","DRAFT","SCHEDULED","ONGOING","COMPLETED","CANCELLED","PUBLISHED","PENDING","APPROVED","REJECTED"] : ["OPTION_A","OPTION_B"];
    return <select required={field.required} value={value} onChange={e=>onChange(e.target.value)}><option value="">Select {field.label}</option>{(field.options||choices).map(v=><option key={v} value={v}>{humanize(v)}</option>)}</select>;
  }
  return <input required={field.required} type={field.type==="number"?"number":field.type==="date"?"date":field.type==="email"?"email":"text"} value={value} onChange={e=>onChange(e.target.value)} placeholder={field.placeholder || field.label} />;
}
const ROLE_WRITE_MODULES: Record<string, string[]> = {
  SUPER_ADMIN: ["*"],
  SCHOOL_ADMIN: ["*"],
  PRINCIPAL: ["admissions", "students", "parents", "classes", "sections", "sessions", "subjects", "attendance", "timetable", "homework", "exams", "certificates", "events", "employees", "leaves", "holidays", "fees", "finance", "payroll", "transport", "library", "inventory", "communication", "reports", "settings"],
  ACCOUNTANT: ["fees", "feeCollection", "discountsFines", "refunds", "finance", "expenses", "cashbook", "payroll"],
  RECEPTIONIST: ["admissions", "students", "parents"],
  LIBRARIAN: ["library"],
  TRANSPORT_MANAGER: ["transport"],
  INVENTORY_MANAGER: ["inventory"],
  TEACHER: ["attendance", "timetable", "homework", "exams", "leaves", "communication"],
  PARENT: [],
  STUDENT: [],
};

export function ModuleWorkspace({moduleKey}:{moduleKey:string}) {
  const config:ModuleConfig = moduleConfigs[moduleKey] || {title:humanize(moduleKey),description:"Live records from the MirexERP backend.",endpoint:`/${moduleKey}`,readOnly:true};
  const [roleReadOnly, setRoleReadOnly] = useState(true);
  useEffect(() => {
    try {
      const role = String(JSON.parse(sessionStorage.getItem("mirexerp_user") || "{}").role || "").toUpperCase().replaceAll(" ", "_");
      const allowedModules = ROLE_WRITE_MODULES[role] || [];
      setRoleReadOnly(!allowedModules.includes("*") && !allowedModules.includes(moduleKey));
    } catch { setRoleReadOnly(true); }
  }, [moduleKey]);
  const isReadOnly = Boolean(config.readOnly || roleReadOnly);
  const [rows,setRows]=useState<RowData[]>([]);
  const [payload,setPayload]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [search,setSearch]=useState("");
  const [page,setPage]=useState(1);
  const [modal,setModal]=useState(false);
  const [editing,setEditing]=useState<RowData|null>(null);
  const [values,setValues]=useState<Record<string,string>>({});
  const [rawDetails,setRawDetails]=useState<any>(null);
  const fields=config.fields||[];
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try {
      const response=await api.get(config.endpoint,{params:{page,limit:20,search:search||undefined}});
      const data=unwrap(response);const envelope=response?.data||{};const normalized=Array.isArray(data)?{items:data,pagination:envelope.pagination}:data;setPayload(normalized);setRows(getRows(normalized));
      if(isReadOnly && !getRows(data).length) setRawDetails(data);
      else setRawDetails(null);
    } catch(e:any) { setError(e?.response?.data?.message || e?.message || "Unable to load records. Check API URL and permissions.");setRows([]);setPayload(null); }
    finally {setLoading(false);}
  },[config.endpoint,isReadOnly,page,search]);
  useEffect(()=>{load();},[load]);
  const openCreate=()=>{setEditing(null);setValues({});setModal(true);setNotice("");};
  const openEdit=(row:RowData)=>{setEditing(row);const next:Record<string,string>={};fields.forEach(f=>{const v=row[f.name];next[f.name]=v && typeof v==="object"?JSON.stringify(v,null,2):v==null?"":String(v);});setValues(next);setModal(true);setNotice("");};
  const submit=async(e:FormEvent)=>{
    e.preventDefault();setSaving(true);setError("");setNotice("");
    try {
      const body:Record<string,unknown>={};
      fields.forEach(field=>{const raw=values[field.name];if(raw===undefined||raw==="")return;
        if(field.type==="json"){body[field.name]=JSON.parse(raw);}
        else if(field.type==="number")body[field.name]=Number(raw);
        else body[field.name]=raw;
      });
      if(editing) await api.patch(`${config.updateEndpoint||config.endpoint}/${getId(editing)}`,body);
      else await api.post(config.createEndpoint||config.endpoint,body);
      setModal(false);setNotice(editing?"Record updated successfully.":"Record created successfully.");await load();
    } catch(e:any) {setError(e?.response?.data?.message || e?.message || "Save failed. Verify required fields and permissions.");}
    finally {setSaving(false);}
  };
  const downloadCertificate = async (row:RowData) => {
    try {
      const response = await api.get(`/certificates/${getId(row)}/pdf`, { responseType: "blob" });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `certificate-${String(row.certificateNumber || getId(row))}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e:any) {
      setError(e?.response?.data?.message || "Certificate PDF could not be downloaded.");
    }
  };
  const certificateAction=async(row:RowData,action:"submit"|"approve"|"reject"|"issue")=>{
    try{
      const endpoint=`/certificates/${getId(row)}/${action}`;
      const body=action==="reject"?{reason:window.prompt("Enter rejection reason")||""}:{};
      if(action==="reject"&&!body.reason)return;
      await api.post(endpoint,body);
      setNotice(`Certificate ${action} action completed.`);await load();
    }catch(e:any){setError(e?.response?.data?.message||`Certificate ${action} failed.`);}
  };
  const remove=async(row:RowData)=>{
    if(!window.confirm("Remove this record? The backend may retain it as an audited soft delete."))return;
    try{await api.delete(`${config.endpoint}/${getId(row)}`);setNotice("Record deleted successfully.");await load();}
    catch(e:any){setError(e?.response?.data?.message||"Delete failed. Your role may not have permission.");}
  };
  const columns=useMemo(()=>config.columns?.length?config.columns:(rows[0]?Object.keys(rows[0]).filter(k=>!["_id","__v","updatedAt","isDeleted"].includes(k)).slice(0,6):[]),[config.columns,rows]);
  const pagination=(payload as any)?.pagination;
  const total= pagination?.total ?? rows.length;
  return <div className="module-workspace">
    <header className="mw-header"><div><span className="mw-eyebrow">MIREXERP / MANAGEMENT</span><h1>{config.title}</h1><p>{config.description}</p></div><div className="mw-head-actions"><button className="mw-secondary" onClick={load} title="Refresh"><RefreshCw size={16}/> Refresh</button>{!isReadOnly&&fields.length>0&&<button className="mw-primary" onClick={openCreate}><Plus size={17}/> Add {config.title.replace(/s$/,"")}</button>}</div></header>
    {notice&&<div className="mw-notice">{notice}</div>}
    {error&&<div className="mw-error"><AlertCircle size={17}/><span>{error}</span><button onClick={()=>setError("")}><X size={15}/></button></div>}
    <section className="mw-toolbar"><div className="mw-search"><Search size={17}/><input value={search} onChange={e=>{setPage(1);setSearch(e.target.value);}} placeholder={`Search ${config.title.toLowerCase()}...`}/></div><div className="mw-count"><Database size={15}/>{total} records</div></section>
    <section className="mw-table-card">
      {loading?<div className="mw-state"><span className="mw-spinner"/>Loading live records...</div>:rows.length>0?<><div className="mw-table-wrap"><table><thead><tr>{columns.map(c=><th key={c}>{humanize(c)}</th>)}{!isReadOnly&&<th>Actions</th>}</tr></thead><tbody>{rows.map((row,i)=><tr key={getId(row)||i}>{columns.map(c=><td key={c}><span className={c.toLowerCase().includes("status")?"mw-status":""}>{display(row[c])}</span></td>)}{!isReadOnly&&<td><div className="mw-row-actions">{moduleKey==="certificates"&&<><button onClick={()=>void downloadCertificate(row)} aria-label="Download certificate PDF" title="Download PDF"><FileDown size={15}/></button>{row.approvalStatus==="PENDING"&&<><button onClick={()=>void certificateAction(row,"approve")} title="Approve certificate"><CheckCircle2 size={15}/></button><button onClick={()=>void certificateAction(row,"reject")} title="Reject certificate"><XCircle size={15}/></button></>}{row.approvalStatus==="REJECTED"&&<button onClick={()=>void certificateAction(row,"submit")} title="Resubmit certificate"><Send size={15}/></button>}{row.approvalStatus==="APPROVED"&&!row.issuedAt&&<button onClick={()=>void certificateAction(row,"issue")} title="Issue certificate"><CheckCircle2 size={15}/></button>}</>}<button onClick={()=>openEdit(row)} aria-label="Edit"><Pencil size={15}/></button><button onClick={()=>remove(row)} aria-label="Delete"><Trash2 size={15}/></button></div></td>}</tr>)}</tbody></table></div><div className="mw-pagination"><span>Showing {rows.length} records · Page {page}</span><div><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={16}/></button><button disabled={!pagination?.hasNextPage && (pagination?page>=pagination.totalPages:rows.length<20)} onClick={()=>setPage(p=>p+1)}><ChevronRight size={16}/></button></div></div></>:isReadOnly&&rawDetails?<div className="mw-json"><h3>Live backend response</h3><pre>{JSON.stringify(rawDetails,null,2)}</pre></div>:<div className="mw-state"><div className="mw-empty-icon"><Database size={23}/></div><h3>No records found</h3><p>{search?"Try a different search term.":"Records will appear here when available in the connected backend."}</p>{!isReadOnly&&fields.length>0&&<button className="mw-primary" onClick={openCreate}><Plus size={16}/> Create first record</button>}</div>}
    </section>
    {modal&&<div className="mw-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false);}}><section className="mw-modal"><header><div><span className="mw-eyebrow">{editing?"UPDATE RECORD":"NEW RECORD"}</span><h2>{editing?"Edit":"Add"} {config.title}</h2></div><button className="mw-close" onClick={()=>setModal(false)}><X size={19}/></button></header><form onSubmit={submit}><div className="mw-form-grid">{fields.map(field=><label key={field.name} className={field.type==="json"||field.type==="textarea"?"mw-span-2":""}><span>{field.label}{field.required&&<b> *</b>}</span><FormInput field={field} value={values[field.name]||""} onChange={v=>setValues(old=>({...old,[field.name]:v}))}/></label>)}</div><footer><button type="button" className="mw-secondary" onClick={()=>setModal(false)}>Cancel</button><button className="mw-primary" disabled={saving}>{saving?"Saving...":editing?"Save changes":"Create record"}</button></footer></form></section></div>}
  </div>;
}
