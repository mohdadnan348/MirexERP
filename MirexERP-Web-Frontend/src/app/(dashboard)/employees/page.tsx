"use client";
import EntityManager, { type EntityConfig } from "@/components/phase2/EntityManager";
import EmployeeDashboard from "@/components/modules/EmployeeDashboard";
const config: EntityConfig = {
 title:"Teacher & Employee Management",singular:"Employee",endpoint:"/employees",
 description:"Manage teaching and non-teaching staff, employment details, assignments and employee records.",
 canDelete:false,detailLink:true,detailPath:"/employees",downloadSuffix:"/id-card",
 fields:[
  {name:"firstName",label:"First name",required:true},{name:"middleName",label:"Middle name"},{name:"lastName",label:"Last name",required:true},
  {name:"email",label:"Personal email",type:"email"},{name:"phone",label:"Mobile number",type:"tel",required:true},{name:"alternatePhone",label:"Alternate mobile",type:"tel"},
  {name:"gender",label:"Gender",type:"select",required:true,options:["MALE","FEMALE","OTHER"].map(v=>({label:v,value:v}))},
  {name:"dateOfBirth",label:"Date of birth",type:"date"},{name:"bloodGroup",label:"Blood group",type:"select",options:["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(v=>({label:v,value:v}))},
  {name:"employeeType",label:"Employee type",type:"select",required:true,options:["TEACHING","NON_TEACHING","ADMINISTRATIVE","SUPPORT","OTHER"].map(v=>({label:v,value:v}))},
  {name:"designation",label:"Designation",required:true},{name:"department",label:"Department"},{name:"employmentType",label:"Employment type",type:"select",required:true,options:["PERMANENT","PART_TIME","CONTRACT","TEMPORARY","SUBSTITUTE"].map(v=>({label:v,value:v}))},
  {name:"qualification",label:"Highest qualification"},{name:"specialization",label:"Specialization"},{name:"experienceYears",label:"Experience (years)",type:"number",min:0},
  {name:"joiningDate",label:"Joining date",type:"date",required:true},
  {name:"workEmail",label:"Work email",type:"email"},{name:"workMobile",label:"Work mobile",type:"tel"},{name:"panNumber",label:"PAN (optional)"},
  {name:"address.city",label:"City"},{name:"address.state",label:"State"},{name:"address.postalCode",label:"Pincode"}
 ],
 columns:[{key:"employeeId",label:"Employee Code"},{key:"fullName",label:"Employee Name"},{key:"employeeType",label:"Type"},{key:"designation",label:"Designation"},{key:"department",label:"Department"},{key:"employmentType",label:"Employment"},{key:"joiningDate",label:"Joining Date"},{key:"assignedClassCount",label:"Assigned Classes"},{key:"status",label:"Status"}]
};
export default function EmployeesPage(){return <><EmployeeDashboard/><EntityManager config={config}/></>}
