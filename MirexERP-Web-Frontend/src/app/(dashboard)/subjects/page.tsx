"use client";
import {useEffect,useState} from "react";
import {api} from "@/lib/api/client";
import EntityManager,{type EntityConfig} from "@/components/phase2/EntityManager";
import {BookOpen,GraduationCap,Users,Layers} from "lucide-react";
import Link from "next/link";
const config:EntityConfig={title:"Subject Management",singular:"Subject",endpoint:"/subjects",description:"Maintain the school's subject catalogue, categories, codes and status.",fields:[
{name:"name",label:"Subject name",required:true},{name:"code",label:"Subject code",required:true},{name:"displayName",label:"Display name"},
{name:"category",label:"Category",type:"select",required:true,options:["CORE","ELECTIVE","ACTIVITY"].map(v=>({label:v,value:v}))},
{name:"subjectType",label:"Subject type",type:"select",required:true,options:["CORE","ELECTIVE","OPTIONAL","LANGUAGE","PRACTICAL"].map(v=>({label:v,value:v}))},
{name:"isOptional",label:"Optional subject",type:"select",options:[{label:"No",value:"false"},{label:"Yes",value:"true"}]},
{name:"description",label:"Description",type:"textarea"},{name:"remarks",label:"Remarks",type:"textarea"}],
detailLink:true,detailPath:"/subjects",columns:[{key:"name",label:"Subject"},{key:"code",label:"Code"},{key:"category",label:"Category"},{key:"subjectType",label:"Type"},{key:"mappedClasses",label:"Mapped Classes"},{key:"assignedTeachers",label:"Assigned Teachers"},{key:"syllabusStatus",label:"Syllabus"},{key:"isActive",label:"Active"},{key:"createdAt",label:"Created Date"}]};
export default function SubjectsPage(){
 const [summary,setSummary]=useState<Record<string,number>>({});
 const [error,setError]=useState("");
 useEffect(()=>{api.get("/subjects/reports/summary").then(r=>setSummary(r.data?.data||{})).catch(e=>setError(e?.response?.data?.message||"Unable to load subject summary"));},[]);
 const cards=[["Total Subjects",summary.total,BookOpen],["Active",summary.active,GraduationCap],["Inactive",summary.inactive,Layers],["Core",summary.core,BookOpen],["Elective",summary.elective,Users],["Activity",summary.activity,BookOpen],["Class Mappings",summary.classMappings,Layers],["Teacher Assignments",summary.teacherAssignments,Users]] as const;
 return <><section style={{padding:"22px 24px 0"}}><h1 style={{fontSize:24,fontWeight:700}}>Subject Dashboard</h1><p style={{color:"#64748b",margin:"5px 0 16px"}}>Live school subject catalogue and academic assignments.</p>{error&&<p role="alert">{error}</p>}<div className="sw-grid">{cards.map(([label,value,Icon])=><article className="sw-card" key={label}><span>{label}</span><strong>{value??"—"}</strong></article>)}</div><nav style={{display:"flex",flexWrap:"wrap",gap:10,margin:"18px 0"}}>{[["Class Mapping","class-mapping"],["Teacher Assignments","teacher-assignments"],["Elective Selection","electives"],["Syllabus","syllabus"],["Reports","reports"]].map(([label,path])=><Link key={path} href={`/subjects/${path}`} style={{padding:"9px 13px",border:"1px solid #cbd5e1",borderRadius:8,textDecoration:"none"}}>{label}</Link>)}</nav></section><EntityManager config={config}/></>;
}
