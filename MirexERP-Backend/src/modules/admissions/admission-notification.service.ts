import AdmissionNotification from "./admission-notification.model";
import {Types} from "mongoose";
export async function notifyAdmissionParent(input:{schoolId:Types.ObjectId;applicationId:Types.ObjectId;event:string;phone:string;childName:string;applicationNumber:string}){
 const channel=(process.env.ADMISSION_NOTIFICATION_CHANNEL||"SMS").toUpperCase()==="WHATSAPP"?"WHATSAPP":"SMS";
 const endpoint=process.env.ADMISSION_NOTIFICATION_PROVIDER_URL;
 const token=process.env.ADMISSION_NOTIFICATION_API_TOKEN;
 const record=await AdmissionNotification.create({schoolId:input.schoolId,applicationId:input.applicationId,event:input.event,channel,recipient:input.phone,status:"PENDING"});
 if(!endpoint||!token){record.status="FAILED";record.error="Notification provider is not configured (ADMISSION_NOTIFICATION_PROVIDER_URL / ADMISSION_NOTIFICATION_API_TOKEN).";await record.save();return record;}
 try{
  const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({channel,to:input.phone,event:input.event,message:`${input.event.replaceAll("_"," ")}: ${input.childName} (${input.applicationNumber})`})});
  const body=await response.text(); record.providerResponse=body.slice(0,3000);
  if(!response.ok){record.status="FAILED";record.error=`Provider returned HTTP ${response.status}`;}else{record.status="SENT";record.sentAt=new Date();}
 }catch(error){record.status="FAILED";record.error=error instanceof Error?error.message:"Unknown provider error";}
 await record.save();return record;
}
