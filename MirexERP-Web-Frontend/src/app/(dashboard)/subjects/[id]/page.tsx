"use client";
import {useParams} from "next/navigation";
import {useEffect,useState} from "react";
import Link from "next/link";
import {api} from "@/lib/api/client";
import {ArrowLeft,BookOpen,Users,FileText} from "lucide-react";
type Data=Record<string,any>;
const unwrap=(r:any)=>r?.data?.data??r?.data??r;
const rows=(r:any)=>{const v=unwrap(r);return Array.isArray(v)?v:[];};
export default function SubjectDetailsPage(){
 const params=useParams<{id:string}>();const [subject,setSubject]=useState<Data|null>(null),[mappings,setMappings]=useState<Data[]>([]),[teachers,setTeachers]=useState<Data[]>([]),[syllabi,setSyllabi]=useState<Data[]>([]),[error,setError]=useState("");
 useEffect(()=>{if(!params.id)return;Promise.all([api.get(`/subjects/${params.id}`),api.get("/subjects/class-mappings",{params:{subjectId:params.id}}),api.get("/subjects/teacher-assignments",{params:{subjectId:params.id}}),api.get("/subjects/syllabus",{params:{subjectId:params.id}})]).then(([s,m,t,y])=>{setSubject(unwrap(s));setMappings(rows(m));setTeachers(rows(t));setSyllabi(rows(y));}).catch(e=>setError(e?.response?.data?.message||"Unable to load subject details"));},[params.id]);
 if(error)return <main style={{padding:24}} role="alert">{error}</main>;if(!subject)return <main style={{padding:24}}>Loading subject details…</main>;
 return <main style={{padding:24}}><Link href="/subjects" style={{display:"inline-flex",gap:8,alignItems:"center",marginBottom:18}}><ArrowLeft size={16}/>Back to Subjects</Link><h1 style={{fontSize:26,fontWeight:700}}>{subject.name}</h1><p style={{color:"#64748b"}}>{subject.code} · {subject.category} · {subject.subjectType}</p><section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:14,margin:"20px 0"}}>{[["Description",subject.description||"—"],["Status",subject.isActive?"Active":"Inactive"],["Created",subject.createdAt?new Date(subject.createdAt).toLocaleDateString():"—"],["Remarks",subject.remarks||"—"]].map(([k,v])=><article key={k} style={{border:"1px solid #e2e8f0",borderRadius:12,padding:16}}><small>{k}</small><p>{v}</p></article>)}</section><section style={{marginTop:24}}><h2><BookOpen size={18} style={{display:"inline",marginRight:8}}/>Mapped Classes ({mappings.length})</h2><ul>{mappings.map(x=><li key={x._id}>{x.classId?.name||"Class"} — {x.sessionId?.name||"Session"} — {x.requirement}</li>)}</ul></section><section style={{marginTop:24}}><h2><Users size={18} style={{display:"inline",marginRight:8}}/>Assigned Teachers ({teachers.length})</h2><ul>{teachers.map(x=><li key={x._id}>{x.teacherId?.fullName||x.teacherId?.employeeId||"Teacher"} — {x.classId?.name||"Class"}</li>)}</ul></section><section style={{marginTop:24}}><h2><FileText size={18} style={{display:"inline",marginRight:8}}/>Syllabus ({syllabi.length})</h2><ul>{syllabi.map(x=><li key={x._id}>{x.title} — {x.classId?.name||"Class"}</li>)}</ul></section></main>;
}
