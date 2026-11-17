"use client";
import {FormEvent,useCallback,useEffect,useMemo,useState} from "react";
import {api} from "@/lib/api/client";
import {AlertCircle,RefreshCw,Save,Trash2} from "lucide-react";
import "./SubjectWorkspace.css";
type Row=Record<string,any>&{_id:string};
type Mode="mapping"|"teachers"|"electives"|"syllabus"|"reports";
const unwrap=(r:any)=>r?.data?.data??r?.data??r;
const list=(r:any):Row[]=>{const x=unwrap(r);return Array.isArray(x)?x:Array.isArray(x?.items)?x.items:Array.isArray(x?.data)?x.data:[]};
const msg=(e:any)=>e?.response?.data?.message||e?.message||"Request failed";
function ReportTable({rows}:{rows:Row[]}){if(!rows.length)return <p className="sw-empty">No report data available.</p>;const keys=Object.keys(rows[0]).filter(k=>k!=="_id");return <div className="sw-table-wrap"><table><thead><tr>{keys.map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r._id||i}>{keys.map(k=><td key={k}>{String(r[k]??"—")}</td>)}</tr>)}</tbody></table></div>;}
export default function SubjectWorkspace({mode}:{mode:Mode}){
 const [sessions,setSessions]=useState<Row[]>([]),[classes,setClasses]=useState<Row[]>([]),[subjects,setSubjects]=useState<Row[]>([]),[teachers,setTeachers]=useState<Row[]>([]),[sections,setSections]=useState<Row[]>([]),[selectedElectives,setSelectedElectives]=useState<Row[]>([]),[students,setStudents]=useState<Row[]>([]);
 const [rows,setRows]=useState<Row[]>([]),[classReports,setClassReports]=useState<Row[]>([]),[teacherReports,setTeacherReports]=useState<Row[]>([]),[form,setForm]=useState<Record<string,string>>({}),[selectedFile,setSelectedFile]=useState<File|null>(null),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const endpoint=useMemo(()=>({mapping:"/subjects/class-mappings",teachers:"/subjects/teacher-assignments",electives:"/subjects/electives/available",syllabus:"/subjects/syllabus",reports:"/subjects/reports/summary"}[mode]),[mode]);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const [ss,cc,sub]=await Promise.all([api.get("/sessions",{params:{limit:100}}),api.get("/classes",{params:{limit:100}}),api.get("/subjects",{params:{limit:100}})]);
   setSessions(list(ss));setClasses(list(cc));setSubjects(list(sub));
   if(mode==="teachers"){
    const t=await api.get("/employees",{params:{limit:100,employeeType:"TEACHING"}});
    setTeachers(list(t).filter(x=>x.employeeType==="TEACHING"&&x.isActive!==false));
    if(form.classId){const sec=await api.get("/sections",{params:{limit:100,classId:form.classId}});setSections(list(sec));}else setSections([]);
   }
   if(mode==="electives"){
    const st=await api.get("/students",{params:{limit:100}});setStudents(list(st));
    if(form.studentId&&form.sessionId){const chosen=await api.get(`/subjects/electives/student/${form.studentId}`,{params:{sessionId:form.sessionId,classId:form.classId}});setSelectedElectives(list(chosen));}else setSelectedElectives([]);
   }
   if(mode==="reports"){
    const params={...(form.sessionId?{sessionId:form.sessionId}:{})};
    const [summary,classWise,teacherWise]=await Promise.all([api.get(endpoint,{params}),api.get("/subjects/reports/class-wise",{params}),api.get("/subjects/reports/teacher-wise",{params})]);
    const summaryPayload=unwrap(summary);setRows(summaryPayload?[summaryPayload]:[]);
    setClassReports(list(classWise));setTeacherReports(list(teacherWise));
   }else{
    const r=await api.get(endpoint,{params:{...(form.sessionId?{sessionId:form.sessionId}:{}),...(form.classId?{classId:form.classId}:{})}});
    const payload=unwrap(r);setRows(Array.isArray(payload)?payload:payload?[payload]:[]);
   }
  }catch(e){setError(msg(e));}finally{setLoading(false);}
 },[endpoint,form.sessionId,form.classId,form.studentId,mode]);
 useEffect(()=>{void load();},[load]);
 const set=(k:string,v:string)=>setForm(p=>({...p,[k]:v}));
 const submit=async(e:FormEvent)=>{
  e.preventDefault();setSaving(true);setError("");setNotice("");
  try{
   if(mode==="mapping")await api.post(endpoint,{sessionId:form.sessionId,classId:form.classId,subjectId:form.subjectId,requirement:form.requirement||"COMPULSORY",...(form.requirement==="ELECTIVE"?{electiveLimit:Number(form.electiveLimit||1)}:{}),...(form.effectiveFrom?{effectiveFrom:form.effectiveFrom}:{})});
   if(mode==="teachers")await api.post(endpoint,{sessionId:form.sessionId,classId:form.classId,sectionId:form.sectionId||null,subjectId:form.subjectId,teacherId:form.teacherId});
   if(mode==="electives")await api.post("/subjects/electives/select",{sessionId:form.sessionId,classId:form.classId,studentId:form.studentId,subjectIds:(form.subjectIds||"").split(",").map(x=>x.trim()).filter(Boolean)});
   if(mode==="syllabus"){
    if(selectedFile){
     if(selectedFile.size>15*1024*1024)throw new Error("Syllabus file must be 15 MB or smaller");
     const data=new FormData();data.append("sessionId",form.sessionId);data.append("classId",form.classId);data.append("subjectId",form.subjectId);data.append("title",form.title);if(form.description)data.append("description",form.description);data.append("file",selectedFile);
     await api.post("/subjects/syllabus/upload",data,{headers:{"Content-Type":"multipart/form-data"}});
    }else{
     await api.post(endpoint,{sessionId:form.sessionId,classId:form.classId,subjectId:form.subjectId,title:form.title,description:form.description,fileUrl:form.fileUrl||undefined,fileName:form.fileName||undefined,mimeType:form.mimeType||undefined,fileSize:form.fileSize?Number(form.fileSize):undefined});
    }
   }
   setSelectedFile(null);
   setNotice("Saved successfully.");setForm(p=>({...p,subjectId:"",teacherId:"",subjectIds:"",title:"",description:"",fileUrl:""}));await load();
  }catch(err){setError(msg(err));}finally{setSaving(false);}
 };
 const remove=async(id:string)=>{if(!window.confirm("Are you sure you want to remove this record?"))return;try{await api.delete(`${endpoint}/${id}`);setNotice("Record removed.");await load();}catch(e){setError(msg(e));}};
 const download=async(id:string)=>{try{const response=await api.get(`/subjects/syllabus/${id}/download`,{responseType:"blob"});const url=URL.createObjectURL(response.data);const anchor=document.createElement("a");anchor.href=url;anchor.download="syllabus";anchor.click();URL.revokeObjectURL(url);}catch(e){setError(msg(e));}};
 const removeElective=async(id:string)=>{if(!window.confirm("Remove this elective selection?"))return;try{await api.delete(`/subjects/electives/${id}`);setNotice("Elective selection removed; history retained.");await load();}catch(e){setError(msg(e));}};
 const title={mapping:"Class-wise Subject Mapping",teachers:"Subject Teacher Assignments",electives:"Student Elective Selection",syllabus:"Syllabus Management",reports:"Subject Reports"}[mode];
 return <main className="subject-workspace">
  <header><div><p className="eyebrow">ACADEMIC MANAGEMENT</p><h1>{title}</h1><p>Session-specific subject operations using existing school, class, student and employee records.</p></div><button className="sw-secondary" onClick={()=>void load()}><RefreshCw size={16}/> Refresh</button></header>
  {error&&<div className="sw-alert"><AlertCircle size={17}/>{error}</div>}{notice&&<div className="sw-notice">{notice}</div>}
  {mode==="reports"?<><div className="sw-report-filter"><label>Academic Session<select value={form.sessionId||""} onChange={e=>set("sessionId",e.target.value)}><option value="">All sessions</option>{sessions.map(x=><option key={x._id} value={x._id}>{x.name||x.code}</option>)}</select></label></div><section className="sw-grid">{Object.entries(rows[0]||{}).filter(([k])=>!["_id","id"].includes(k)).map(([k,v])=><article className="sw-card" key={k}><span>{k.replace(/([A-Z])/g," $1")}</span><strong>{String(v)}</strong></article>)}</section><section className="sw-list"><h2>Class-wise Subject Distribution</h2><ReportTable rows={classReports}/></section><section className="sw-list"><h2>Teacher-wise Subject Assignments</h2><ReportTable rows={teacherReports}/></section></>:<>
   <form className="sw-form" onSubmit={submit}>
    <label>Academic Session<select required value={form.sessionId||""} onChange={e=>set("sessionId",e.target.value)}><option value="">Select session</option>{sessions.map(x=><option key={x._id} value={x._id}>{x.name||x.code}</option>)}</select></label>
    <label>Class<select required value={form.classId||""} onChange={e=>set("classId",e.target.value)}><option value="">Select class</option>{classes.filter(x=>!form.sessionId||String(x.sessionId?._id||x.sessionId)===form.sessionId).map(x=><option key={x._id} value={x._id}>{x.name||x.code}</option>)}</select></label>
    {mode!=="electives"&&<label>Subject<select required value={form.subjectId||""} onChange={e=>set("subjectId",e.target.value)}><option value="">Select subject</option>{subjects.map(x=><option key={x._id} value={x._id}>{x.name} ({x.code})</option>)}</select></label>}
    {mode==="mapping"&&<><label>Requirement<select value={form.requirement||"COMPULSORY"} onChange={e=>set("requirement",e.target.value)}><option value="COMPULSORY">Compulsory</option><option value="ELECTIVE">Elective</option><option value="ACTIVITY">Activity</option></select></label>{form.requirement==="ELECTIVE"&&<label>Maximum electives per student<input type="number" min="1" max="30" required value={form.electiveLimit||"1"} onChange={e=>set("electiveLimit",e.target.value)}/></label>}<label>Effective from<input type="date" value={form.effectiveFrom||""} onChange={e=>set("effectiveFrom",e.target.value)}/></label></>}
    {mode==="teachers"&&<><label>Section (optional)<select value={form.sectionId||""} onChange={e=>set("sectionId",e.target.value)}><option value="">All sections / class-level</option>{sections.map(x=><option key={x._id} value={x._id}>{x.name||x.code}</option>)}</select></label><label>Teacher<select required value={form.teacherId||""} onChange={e=>set("teacherId",e.target.value)}><option value="">Select teacher</option>{teachers.map(x=><option key={x._id} value={x._id}>{x.fullName||x.employeeId}</option>)}</select></label></>}
    {mode==="electives"&&<><label>Student<select required value={form.studentId||""} onChange={e=>set("studentId",e.target.value)}><option value="">Select student</option>{students.map(x=><option key={x._id} value={x._id}>{x.fullName||x.admissionNumber||x._id}</option>)}</select></label><div className="sw-choice-list"><strong>Available elective subjects</strong>{rows.length===0?<p className="sw-empty">Select a session and class to load mapped electives.</p>:rows.map(item=>{const sub=item.subjectId||{};const subjectId=String(sub._id||item.subjectId||"");const selected=(form.subjectIds||"").split(",").filter(Boolean);return <label key={subjectId}><input type="checkbox" checked={selected.includes(subjectId)} onChange={e=>set("subjectIds",e.target.checked?[...selected,subjectId].join(","):selected.filter(x=>x!==subjectId).join(","))}/>{sub.name||"Subject"} ({sub.code||subjectId})</label>;})}</div></>}
    {mode==="syllabus"&&<><label>Syllabus Title<input required value={form.title||""} onChange={e=>set("title",e.target.value)}/></label><label>Description<input value={form.description||""} onChange={e=>set("description",e.target.value)}/></label><label>Upload syllabus file (max 15 MB)<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp" onChange={e=>setSelectedFile(e.target.files?.[0]||null)}/></label><label>Or external HTTPS file URL<input type="url" value={form.fileUrl||""} onChange={e=>set("fileUrl",e.target.value)}/></label></>}
    <button className="sw-primary" disabled={saving}><Save size={16}/>{saving?"Saving…":"Save"}</button>
   </form>
   {mode==="electives"&&<section className="sw-list"><h2>Selected Electives for Student</h2>{selectedElectives.length===0?<p className="sw-empty">No elective subjects selected for this student in this session.</p>:selectedElectives.map(item=><div className="sw-selected-elective" key={item._id}><span>{item.subjectId?.name||"Subject"} ({item.subjectId?.code||"—"})</span><button className="sw-icon" onClick={()=>void removeElective(item._id)} aria-label="Remove elective"><Trash2 size={15}/></button></div>)}</section>}
   <section className="sw-list"><div className="sw-list-head"><h2>Existing Records</h2><span>{rows.length} records</span></div>{loading?<p>Loading records…</p>:rows.length===0?<p className="sw-empty">No records found for the selected filters.</p>:<div className="sw-table-wrap"><table><thead><tr>{Object.keys(rows[0]).filter(k=>!k.startsWith("__")).slice(0,8).map(k=><th key={k}>{k}</th>)}<th>Action</th></tr></thead><tbody>{rows.map(r=><tr key={r._id}><>{Object.keys(rows[0]).filter(k=>!k.startsWith("__")).slice(0,8).map(k=><td key={k}>{typeof r[k]==="object"?r[k]?.name||r[k]?.fullName||r[k]?._id||"—":String(r[k]??"—")}</td>)}</><td>{mode==="syllabus"&&<button className="sw-secondary" onClick={()=>void download(r._id)}>Download</button>}{mode!=="electives"&&<button className="sw-icon" onClick={()=>void remove(r._id)} aria-label="Remove"><Trash2 size={15}/></button>}</td></tr>)}</tbody></table></div>}</section>
  </>}
 </main>;
}
