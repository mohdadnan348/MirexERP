import {Types} from "mongoose";
import Enquiry from "./enquiry.model";
import Admission from "./admissions.model";
import AdmissionSettings from "./admission-settings.model";
import Session from "../sessions/sessions.model";
import Class from "../classes/classes.model";
import Employee from "../employees/employees.model";
import {AppError} from "../../utils/AppError";

type Actor={schoolId:string;userId:string};
const oid=(v:string)=>{if(!Types.ObjectId.isValid(v)) throw new AppError("Invalid identifier",400); return new Types.ObjectId(v);};
async function ensureStaff(userId:string|undefined,schoolId:Types.ObjectId){
 if(!userId)return undefined;
 const staff=await Employee.findOne({userId:oid(userId),schoolId,status:"ACTIVE",isDeleted:false}).select("_id");
 if(!staff)throw new AppError("Assigned staff member does not belong to this school or is inactive",400);
 return oid(userId);
}
export async function listEnquiries(query:any,a:Actor){
 const page=Math.max(1,Number(query.page)||1),limit=Math.min(100,Math.max(1,Number(query.limit)||10));
 const f:any={schoolId:oid(a.schoolId),isDeleted:false};
 if(query.sessionId) f.sessionId=oid(query.sessionId);
 if(query.status) f.status=query.status;
 if(query.source) f.source=query.source;
 if(query.classSought) f.classSought=oid(query.classSought);
 if(query.from||query.to) f.createdAt={...(query.from?{$gte:new Date(query.from)}:{}),...(query.to?{$lte:new Date(query.to)}:{})};
 if(query.search){const r=new RegExp(String(query.search).replace(/[.*+?^\${}()|[\]\\]/g,"\\$&"),"i");f.$or=[{childName:r},{parentName:r},{parentPhone:r}];}
 const [items,total]=await Promise.all([Enquiry.find(f).sort({createdAt:-1}).skip((page-1)*limit).limit(limit).populate("classSought","name").lean(),Enquiry.countDocuments(f)]);
 return {items,pagination:{page,limit,total,totalPages:Math.ceil(total/limit),hasNextPage:page<Math.ceil(total/limit),hasPreviousPage:page>1}};
}
export async function createEnquiry(data:any,a:Actor){
 if(!data.sessionId) throw new AppError("Academic session is required",400);
 if(!String(data.childName||"").trim()||!String(data.parentName||"").trim()) throw new AppError("Child name and parent name are required",400);
 if(!/^[0-9]{10,15}$/.test(String(data.parentPhone||""))) throw new AppError("Enter a valid parent phone number",400);
 if(data.dateOfBirth && new Date(data.dateOfBirth)>new Date()) throw new AppError("Date of birth cannot be in the future",400);
 const session=await Session.findOne({_id:oid(data.sessionId),schoolId:oid(a.schoolId),isActive:true,isDeleted:false,isClosed:{$ne:true}}).select("_id");
 if(!session) throw new AppError("Active academic session not found in this school",400);
 if(data.classSought){const cls=await Class.findOne({_id:oid(data.classSought),schoolId:oid(a.schoolId),sessionId:session._id,isDeleted:false,isActive:true}).select("_id");if(!cls)throw new AppError("Class does not belong to the selected school session",400);}
 const assignedTo=await ensureStaff(data.assignedTo,oid(a.schoolId));
 return Enquiry.create({childName:data.childName,parentName:data.parentName,parentPhone:data.parentPhone,source:data.source||"Other",notes:data.notes,dateOfBirth:data.dateOfBirth?new Date(data.dateOfBirth):undefined,status:"NEW",schoolId:oid(a.schoolId),sessionId:oid(data.sessionId),classSought:data.classSought?oid(data.classSought):undefined,assignedTo,createdBy:oid(a.userId)});
}
export async function updateEnquiry(id:string,data:any,a:Actor){
 const item=await Enquiry.findOne({_id:oid(id),schoolId:oid(a.schoolId),isDeleted:false}); if(!item) throw new AppError("Enquiry not found",404);
 for(const key of ["childName","dateOfBirth","parentName","parentPhone","source","notes"]) if(data[key]!==undefined)(item as any)[key]=data[key];
 if(data.status!==undefined){if(!["NEW","CONTACTED","INTERESTED","CLOSED"].includes(data.status))throw new AppError("Enquiry status can only be changed to NEW, CONTACTED, INTERESTED or CLOSED",400);item.status=data.status;}
 if(data.assignedTo!==undefined)item.assignedTo=await ensureStaff(data.assignedTo,oid(a.schoolId)) as any;
 if(data.classSought!==undefined){if(data.classSought){const cls=await Class.findOne({_id:oid(data.classSought),schoolId:oid(a.schoolId),sessionId:item.sessionId,isDeleted:false}).select("_id");if(!cls)throw new AppError("Class does not belong to this enquiry session",400);item.classSought=cls._id as any;}else item.classSought=undefined;}
 item.updatedBy=oid(a.userId); await item.save(); return item;
}
export async function deleteEnquiry(id:string,a:Actor){
 const item=await Enquiry.findOneAndUpdate({_id:oid(id),schoolId:oid(a.schoolId),isDeleted:false},{$set:{isDeleted:true,updatedBy:oid(a.userId)}},{new:true});
 if(!item) throw new AppError("Enquiry not found",404); return item;
}
export async function addEnquiryFollowUp(id:string,data:any,a:Actor){
 const item=await Enquiry.findOne({_id:oid(id),schoolId:oid(a.schoolId),isDeleted:false}); if(!item) throw new AppError("Enquiry not found",404);
 if(["CLOSED","CONVERTED"].includes(item.status))throw new AppError("Follow-ups cannot be added to a closed or converted enquiry",400);
 const assignedTo=await ensureStaff(data.assignedTo,oid(a.schoolId));
 const date=new Date(data.date); if(Number.isNaN(date.getTime()))throw new AppError("Valid follow-up date is required",400);
 item.followUps.push({date,time:data.time?String(data.time):undefined,notes:String(data.notes||"").trim(),status:"SCHEDULED",assignedTo,createdBy:oid(a.userId)} as any);
 item.status=item.status==="NEW"?"CONTACTED":item.status; await item.save(); return item;
}
export async function updateFollowUp(id:string,followUpId:string,data:any,a:Actor){
 const item=await Enquiry.findOne({_id:oid(id),schoolId:oid(a.schoolId),isDeleted:false}); if(!item) throw new AppError("Enquiry not found",404);
 const f=(item.followUps as any).id(followUpId); if(!f) throw new AppError("Follow-up not found",404);
 const safe:any={}; if(data.notes!==undefined)safe.notes=String(data.notes).trim(); if(data.time!==undefined)safe.time=String(data.time);
 if(data.status!==undefined){if(!["SCHEDULED","COMPLETED","CANCELLED"].includes(data.status))throw new AppError("Invalid follow-up status",400);safe.status=data.status;}
 if(data.assignedTo!==undefined)safe.assignedTo=await ensureStaff(data.assignedTo,oid(a.schoolId));
 if(data.date){const date=new Date(data.date);if(Number.isNaN(date.getTime()))throw new AppError("Invalid follow-up date",400);safe.date=date;}
 Object.assign(f,safe); if(data.status==="COMPLETED") f.completedAt=new Date(); await item.save(); return item;
}
export async function getAdmissionReports(query:any,a:Actor){
 const match:any={schoolId:oid(a.schoolId),isDeleted:false};
 if(query.sessionId) match.sessionId=oid(query.sessionId);
 if(query.classId) match.appliedClassId=oid(query.classId);
 if(query.status) match.status=query.status;
 if(query.from||query.to) match.applicationDate={...(query.from?{$gte:new Date(query.from)}:{}),...(query.to?{$lte:new Date(query.to)}:{})};
 const enquiryMatch:any={schoolId:oid(a.schoolId),isDeleted:false,...(query.sessionId?{sessionId:oid(query.sessionId)}:{})};
 if(query.from||query.to) enquiryMatch.createdAt={...(query.from?{$gte:new Date(query.from)}:{}),...(query.to?{$lte:new Date(query.to)}:{})};
 const [status,byClass,source,enquiries,registered]=await Promise.all([
  Admission.aggregate([{$match:match},{$group:{_id:"$status",count:{$sum:1}}}]),
  Admission.aggregate([{$match:{...match,status:{$in:["CONVERTED","REGISTERED"]}}},{$group:{_id:"$appliedClassId",count:{$sum:1}}},{$lookup:{from:"classes",localField:"_id",foreignField:"_id",as:"class"}},{$unwind:{path:"$class",preserveNullAndEmptyArrays:true}},{$project:{className:"$class.name",count:1}}]),
  Enquiry.aggregate([{$match:enquiryMatch},{$group:{_id:"$source",count:{$sum:1}}}]),
  Enquiry.countDocuments(enquiryMatch),
  Admission.countDocuments({...match,status:{$in:["CONVERTED","REGISTERED"]}})
 ]);
 return {applicationsByStatus:status,classWiseAdmissions:byClass,enquiriesBySource:source,enquiryCount:enquiries,registeredCount:registered,conversionPercentage:enquiries?Number((registered/enquiries*100).toFixed(2)):0,conversionFormula:"registered applications / total enquiries * 100"};
}
export async function getOrCreateAdmissionSettings(a:Actor){
 return AdmissionSettings.findOneAndUpdate({schoolId:oid(a.schoolId)},{$setOnInsert:{schoolId:oid(a.schoolId)}},{new:true,upsert:true});
}
export async function updateAdmissionSettings(data:any,a:Actor){
 const schoolId=oid(a.schoolId);
 const sources=Array.isArray(data.sources)?[...new Set(data.sources.map((x:any)=>String(x).trim()).filter((x:string)=>x.length>0&&x.length<=80))]:undefined;
 const ageCriteria=Array.isArray(data.ageCriteria)?data.ageCriteria:undefined;
 const requiredDocuments=Array.isArray(data.requiredDocuments)?data.requiredDocuments:undefined;
 const admissionFee=Array.isArray(data.admissionFee)?data.admissionFee:undefined;
 for(const rule of ageCriteria||[]){
  const cls=await Class.findOne({_id:oid(String(rule.classId)),schoolId,isDeleted:false}).select("_id");
  if(!cls)throw new AppError("Age eligibility class is outside this school",400);
  if((rule.minAge!=null&&(!Number.isFinite(Number(rule.minAge))||Number(rule.minAge)<0))||(rule.maxAge!=null&&(!Number.isFinite(Number(rule.maxAge))||Number(rule.maxAge)<0))||(rule.minAge!=null&&rule.maxAge!=null&&Number(rule.minAge)>Number(rule.maxAge)))throw new AppError("Invalid age eligibility range",400);
 }
 for(const rule of requiredDocuments||[]){
  const cls=await Class.findOne({_id:oid(String(rule.classId)),schoolId,isDeleted:false}).select("_id");
  if(!cls)throw new AppError("Required-document class is outside this school",400);
  if(!Array.isArray(rule.documentTypes)||rule.documentTypes.some((x:any)=>typeof x!=="string"||!x.trim()||x.length>80))throw new AppError("Invalid required document list",400);
 }
 for(const fee of admissionFee||[]){
  const [cls,session]=await Promise.all([Class.findOne({_id:oid(String(fee.classId)),schoolId,isDeleted:false}).select("_id"),Session.findOne({_id:oid(String(fee.sessionId)),schoolId,isDeleted:false}).select("_id")]);
  if(!cls||!session||!Number.isFinite(Number(fee.amount))||Number(fee.amount)<0)throw new AppError("Invalid admission fee class, session or amount",400);
 }
 const update:any={updatedBy:oid(a.userId)};
 if(sources)update.sources=sources;
 if(ageCriteria)update.ageCriteria=ageCriteria;
 if(requiredDocuments)update.requiredDocuments=requiredDocuments;
 if(admissionFee)update.admissionFee=admissionFee;
 return AdmissionSettings.findOneAndUpdate({schoolId},{$set:update,$setOnInsert:{schoolId}},{new:true,upsert:true,runValidators:true});
}

export async function transitionApplication(id:string,newStatus:string,remarks:string|undefined,a:Actor){
 const allowed:Record<string,string[]>={SUBMITTED:["DRAFT","APPLIED"],UNDER_REVIEW:["SUBMITTED","APPLIED","DOCUMENTS_PENDING"],VERIFIED:["UNDER_REVIEW"],DOCUMENTS_PENDING:["UNDER_REVIEW","SUBMITTED"],WAITLISTED:["VERIFIED","UNDER_REVIEW"],WITHDRAWN:["DRAFT","SUBMITTED","APPLIED","UNDER_REVIEW","VERIFIED","WAITLISTED"]};
 const doc=await Admission.findOne({_id:oid(id),schoolId:oid(a.schoolId),isDeleted:false});
 if(!doc) throw new AppError("Application not found",404);
 if(doc.convertedStudentId||["CONVERTED","REGISTERED"].includes(doc.status)) throw new AppError("Registered applications cannot change status",409);
 if(!allowed[newStatus]||!allowed[newStatus].includes(doc.status)) throw new AppError(`Invalid transition from ${doc.status} to ${newStatus}`,400);
 if(newStatus==="VERIFIED") {
  if((doc.documents||[]).some((d:any)=>!d.verified&&!d.isDeleted)) throw new AppError("All uploaded documents must be verified before verifying the application",400);
  const settings:any=await AdmissionSettings.findOne({schoolId:oid(a.schoolId)}).lean();
  const required=settings?.requiredDocuments?.find((x:any)=>String(x.classId)===String(doc.appliedClassId))?.documentTypes||[];
  const missing=required.filter((type:string)=>!(doc.documents||[]).some((d:any)=>d.documentType===type&&d.verified&&!d.isDeleted));
  if(missing.length)throw new AppError(`Required documents are missing or unverified: ${missing.join(", ")}`,400);
 }
 const old=doc.status; doc.status=newStatus as any; doc.statusHistory ||= [];
 doc.statusHistory.push({previousStatus:old,newStatus,changedBy:oid(a.userId),changedAt:new Date(),remarks} as any);
 if(newStatus==="REJECTED") doc.rejectionReason=remarks;
 doc.updatedBy=oid(a.userId); await doc.save(); return doc;
}

export async function listFollowUps(query:any,a:Actor){
 const now=new Date(),start=new Date(now);start.setHours(0,0,0,0);const end=new Date(start);end.setDate(end.getDate()+1);
 const match:any={schoolId:oid(a.schoolId),isDeleted:false};
 if(query.sessionId)match.sessionId=oid(query.sessionId);
 const bucket=String(query.bucket||"upcoming");
 const pipeline:any[]=[{$match:match},{$unwind:"$followUps"}];
 if(bucket==="today")pipeline.push({$match:{"followUps.date":{$gte:start,$lt:end},"followUps.status":"SCHEDULED"}});
 else if(bucket==="overdue")pipeline.push({$match:{"followUps.date":{$lt:start},"followUps.status":"SCHEDULED"}});
 else if(bucket==="completed")pipeline.push({$match:{"followUps.status":"COMPLETED"}});
 else if(bucket==="upcoming")pipeline.push({$match:{"followUps.date":{$gte:end},"followUps.status":"SCHEDULED"}});
 pipeline.push({$sort:{"followUps.date":1}},{$project:{enquiryId:"$_id",childName:1,parentName:1,parentPhone:1,followUp:"$followUps"}});
 return Enquiry.aggregate(pipeline);
}
