"use client";
import EntityManager, { type EntityConfig } from "@/components/phase2/EntityManager";
const config: EntityConfig = {
 title:"Study Materials", singular:"Study Material", endpoint:"/student-portal/materials",
 description:"Share subject-wise resources with students in the selected class and sections.",
 columns:[{key:"title",label:"Title"},{key:"fileName",label:"File"},{key:"status",label:"Status"}],
 fields:[
  {name:"sessionId",label:"Academic session ID",required:true},
  {name:"classId",label:"Class ID",required:true},
  {name:"sectionIds",label:"Section IDs (comma-separated)",type:"textarea",placeholder:"[]"},
  {name:"subjectId",label:"Subject ID",required:true},
  {name:"title",label:"Title",required:true},
  {name:"description",label:"Description",type:"textarea"},
  {name:"fileUrl",label:"Stored file URL",required:true},
  {name:"fileName",label:"File name",required:true},
  {name:"mimeType",label:"MIME type",required:true},
 ]
};
export default function Page(){return <EntityManager config={config}/>;}
