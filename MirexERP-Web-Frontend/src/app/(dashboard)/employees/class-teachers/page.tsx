"use client";
import EntityManager,{type EntityConfig} from "@/components/phase2/EntityManager";
const config:EntityConfig={title:"Class Teacher Assignments",singular:"Class Teacher",endpoint:"/employees/class-teachers",description:"Assign one active teaching employee as the class teacher for an academic session. Reassignment updates the existing Class record.",canDelete:false,fields:[{name:"sessionId",label:"Academic session ID",required:true},{name:"classId",label:"Class ID",required:true},{name:"teacherId",label:"Teacher employee ID",required:true}],columns:[{key:"name",label:"Class"},{key:"code",label:"Class Code"},{key:"sessionId",label:"Session"},{key:"classTeacherId",label:"Class Teacher"}]};
export default function ClassTeachersPage(){return <EntityManager config={config}/>;}
