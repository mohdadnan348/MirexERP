"use client";
import EntityManager, { type EntityConfig } from "@/components/phase2/EntityManager";
const config: EntityConfig = {
 title:"Employee Performance Reviews", singular:"Performance Review", endpoint:"/employees/performance",
 description:"Create and review employee performance records. Only authorized school management roles can manage reviews.",
 columns:[{key:"employeeId",label:"Employee"},{key:"rating",label:"Rating"},{key:"reviewPeriodStart",label:"Review start"},{key:"status",label:"Status"}],
 fields:[
  {name:"employeeId",label:"Employee ID",required:true},
  {name:"reviewPeriodStart",label:"Review period start",type:"date",required:true},
  {name:"reviewPeriodEnd",label:"Review period end",type:"date",required:true},
  {name:"rating",label:"Rating (1–5)",type:"number",required:true,min:1,step:"1"},
  {name:"feedback",label:"Feedback",type:"textarea"},
  {name:"strengths",label:"Strengths (comma-separated)",type:"textarea",placeholder:"[]"},
  {name:"improvements",label:"Areas for improvement (comma-separated)",type:"textarea",placeholder:"[]"},
  {name:"status",label:"Status",type:"select",options:[{label:"Draft",value:"DRAFT"},{label:"Published",value:"PUBLISHED"}]},
 ]
};
export default function Page(){return <EntityManager config={config}/>;}
