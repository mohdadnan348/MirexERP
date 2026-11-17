import { Types } from "mongoose";
import { AppError } from "../../utils/AppError";
import Subject from "./subjects.model";
import ClassSubjectMapping from "./class-subject-mapping.model";
import StudentElectiveSelection from "./student-elective-selection.model";
import SubjectSyllabus from "./subject-syllabus.model";
import SubjectTeacherAssignment from "../class-section/subject-teacher-assignment.model";
import Class from "../classes/classes.model";
import Section from "../sections/sections.model";
import Session from "../sessions/sessions.model";
import Employee from "../employees/employees.model";
import StudentEnrollment from "../class-section/student-enrollment.model";
import { deleteUploadedFile } from "../../utils/fileStorage";
import path from "path";
import { env } from "../../config/env";

export interface SubjectActor { userId:string; schoolId:string; }
const oid=(id:string,label:string)=>{if(!Types.ObjectId.isValid(id)) throw new AppError(`Invalid ${label}`,400);return new Types.ObjectId(id);};
async function activeSession(sessionId:string,schoolId:string) {
 const session=await Session.findOne({_id:oid(sessionId,"session ID"),schoolId,isDeleted:false,isClosed:{$ne:true}}).lean();
 if(!session) throw new AppError("Academic session not found or closed",404); return session;
}
async function classInSession(classId:string,sessionId:string,schoolId:string) {
 const cls=await Class.findOne({_id:oid(classId,"class ID"),schoolId,sessionId,isDeleted:false}).lean();
 if(!cls) throw new AppError("Class does not belong to the selected school and academic session",400); return cls;
}
async function subjectInSchool(subjectId:string,schoolId:string,active=true) {
 const subject=await Subject.findOne({_id:oid(subjectId,"subject ID"),schoolId,isDeleted:false,...(active?{isActive:true}:{})}).lean();
 if(!subject) throw new AppError("Subject not found, inactive, or not owned by this school",404); return subject;
}
export async function getSubjectAdvancedSummary(schoolId:string,sessionId?:string,classId?:string) {
 const subjectFilter:any={schoolId,isDeleted:false};
 const mappingFilter:any={schoolId,...(sessionId?{sessionId}:{}),...(classId?{classId}:{})};
 const [total,active,inactive,core,elective,activity,mappings,teachers]=await Promise.all([
  Subject.countDocuments(subjectFilter),Subject.countDocuments({...subjectFilter,isActive:true}),Subject.countDocuments({...subjectFilter,isActive:false}),
  Subject.countDocuments({...subjectFilter,$or:[{category:"CORE"},{category:{$exists:false}}]}),Subject.countDocuments({...subjectFilter,category:"ELECTIVE"}),Subject.countDocuments({...subjectFilter,category:"ACTIVITY"}),
  ClassSubjectMapping.countDocuments({...mappingFilter,isActive:true}),SubjectTeacherAssignment.countDocuments({...mappingFilter,isActive:true})
 ]);
 return {total,active,inactive,core,elective,activity,classMappings:mappings,teacherAssignments:teachers};
}
export async function listMappings(schoolId:string,filters:any={}) {
 const q:any={schoolId,isActive:true}; if(filters.sessionId)q.sessionId=oid(filters.sessionId,"session ID"); if(filters.classId)q.classId=oid(filters.classId,"class ID"); if(filters.subjectId)q.subjectId=oid(filters.subjectId,"subject ID");
 return ClassSubjectMapping.find(q).populate("sessionId","name").populate("classId","name code").populate("subjectId","name code category subjectType").sort({createdAt:-1}).lean();
}
export async function saveClassMapping(data:any,actor:SubjectActor,id?:string) {
 await activeSession(data.sessionId,actor.schoolId);
 const cls=await classInSession(data.classId,data.sessionId,actor.schoolId);
 const subject=await subjectInSchool(data.subjectId,actor.schoolId);
 if(data.requirement==="ELECTIVE" && (!Number.isInteger(data.electiveLimit)||data.electiveLimit<1)) throw new AppError("Configure an elective selection limit of at least 1",400);
 const filter={schoolId:oid(actor.schoolId,"school ID"),sessionId:oid(data.sessionId,"session ID"),classId:cls._id,subjectId:subject._id};
 let mapping;
 if(id) {
  mapping=await ClassSubjectMapping.findOneAndUpdate({_id:oid(id,"mapping ID"),...filter},{requirement:data.requirement,electiveLimit:data.electiveLimit,effectiveFrom:data.effectiveFrom?new Date(data.effectiveFrom):undefined,updatedBy:oid(actor.userId,"user ID")},{new:true,runValidators:true});
  if(!mapping)throw new AppError("Class subject mapping not found",404);
 } else {
  const existing=await ClassSubjectMapping.findOne(filter);
  if(existing) {
   existing.requirement=data.requirement; existing.electiveLimit=data.electiveLimit; existing.effectiveFrom=data.effectiveFrom?new Date(data.effectiveFrom):existing.effectiveFrom; existing.isActive=true; existing.updatedBy=oid(actor.userId,"user ID"); await existing.save(); mapping=existing;
  } else {
   try { mapping=await ClassSubjectMapping.create({...filter,requirement:data.requirement,electiveLimit:data.electiveLimit,effectiveFrom:data.effectiveFrom?new Date(data.effectiveFrom):new Date(),createdBy:oid(actor.userId,"user ID")}); }
   catch(e:any){if(e?.code===11000)throw new AppError("This subject is already mapped to the class in this session",409);throw e;}
  }
 }
 // Keep legacy class.subjects synchronized for timetable/exam APIs that already consume it.
 await Class.updateOne({_id:cls._id,schoolId:actor.schoolId},{$addToSet:{subjects:subject._id}});
 return mapping;
}
export async function removeClassMapping(id:string,actor:SubjectActor) {
 const mapping=await ClassSubjectMapping.findOne({_id:oid(id,"mapping ID"),schoolId:actor.schoolId,isActive:true});
 if(!mapping)throw new AppError("Class subject mapping not found",404);
 await activeSession(mapping.sessionId.toString(),actor.schoolId);
 const [teacherCount,syllabusCount,selectionCount]=await Promise.all([
  SubjectTeacherAssignment.countDocuments({schoolId:actor.schoolId,sessionId:mapping.sessionId,classId:mapping.classId,subjectId:mapping.subjectId,isActive:true}),
  SubjectSyllabus.countDocuments({schoolId:actor.schoolId,sessionId:mapping.sessionId,classId:mapping.classId,subjectId:mapping.subjectId,isDeleted:false}),
  StudentElectiveSelection.countDocuments({schoolId:actor.schoolId,sessionId:mapping.sessionId,classId:mapping.classId,subjectId:mapping.subjectId,status:"ACTIVE"})
 ]);
 if(teacherCount||syllabusCount||selectionCount)throw new AppError("Mapping is in use by teacher assignments, syllabus or student selections. Deactivate those records first.",409);
 mapping.isActive=false; await mapping.save();
 await Class.updateOne({_id:mapping.classId,schoolId:actor.schoolId},{$pull:{subjects:mapping.subjectId}});
 return {id,deleted:true};
}
export async function listTeacherAssignments(schoolId:string,filters:any={}) {
 const q:any={schoolId,isActive:true}; for(const k of ["sessionId","classId","sectionId","subjectId","teacherId"])if(filters[k])q[k]=oid(filters[k],k);
 return SubjectTeacherAssignment.find(q).populate("sessionId","name").populate("classId","name code").populate("sectionId","name").populate("subjectId","name code").populate("teacherId","fullName employeeId designation").sort({createdAt:-1}).lean();
}
export async function saveTeacherAssignment(data:any,actor:SubjectActor,id?:string) {
 await activeSession(data.sessionId,actor.schoolId); await classInSession(data.classId,data.sessionId,actor.schoolId);
 await subjectInSchool(data.subjectId,actor.schoolId);
 const [mapped,legacyClass]=await Promise.all([
  ClassSubjectMapping.exists({schoolId:actor.schoolId,sessionId:data.sessionId,classId:data.classId,subjectId:data.subjectId,isActive:true}),
  Class.findOne({_id:data.classId,schoolId:actor.schoolId,sessionId:data.sessionId,isDeleted:false}).select("subjects").lean()
 ]);
 if(!mapped&&!legacyClass?.subjects.some(item=>item.toString()===data.subjectId))throw new AppError("Map this subject to the selected class before assigning a teacher",400);
 if(data.sectionId){const sec=await Section.findOne({_id:oid(data.sectionId,"section ID"),schoolId:actor.schoolId,classId:data.classId,isDeleted:false}).lean();if(!sec)throw new AppError("Section does not belong to selected class",400);}
 const teacher=await Employee.findOne({_id:oid(data.teacherId,"teacher ID"),schoolId:actor.schoolId,isDeleted:false,isActive:true,status:"ACTIVE",employeeType:"TEACHING"}).lean();
 if(!teacher)throw new AppError("Teacher must be an active teaching employee of this school",400);
 const filter:any={schoolId:actor.schoolId,sessionId:data.sessionId,classId:data.classId,sectionId:data.sectionId||null,subjectId:data.subjectId};
 if(id){const old=await SubjectTeacherAssignment.findOne({_id:oid(id,"assignment ID"),schoolId:actor.schoolId,isActive:true});if(!old)throw new AppError("Teacher assignment not found",404);old.isActive=false;old.endedAt=new Date();await old.save();}
 try{return await SubjectTeacherAssignment.create({...filter,teacherId:teacher._id,assignedBy:oid(actor.userId,"user ID")});}
 catch(e:any){if(e?.code===11000)throw new AppError("An active teacher is already assigned to this class/section subject",409);throw e;}
}
export async function removeTeacherAssignment(id:string,actor:SubjectActor){
 const item=await SubjectTeacherAssignment.findOne({_id:oid(id,"assignment ID"),schoolId:actor.schoolId,isActive:true});
 if(!item)throw new AppError("Teacher assignment not found",404); await activeSession(item.sessionId.toString(),actor.schoolId);
 item.isActive=false;item.endedAt=new Date();await item.save();return {id,deleted:true};
}
export async function availableElectives(schoolId:string,sessionId:string,classId:string){
 await activeSession(sessionId,schoolId); await classInSession(classId,sessionId,schoolId);
 return ClassSubjectMapping.find({schoolId,sessionId,classId,isActive:true,requirement:"ELECTIVE"}).populate("subjectId","name code category").lean();
}
export async function getStudentElectives(schoolId:string,sessionId:string,studentId:string,classId?:string){
 return StudentElectiveSelection.find({schoolId,sessionId,studentId,status:"ACTIVE",...(classId?{classId}:{})}).populate("subjectId","name code category").populate("classId","name code").lean();
}
export async function selectElectives(data:any,actor:SubjectActor){
 await activeSession(data.sessionId,actor.schoolId); await classInSession(data.classId,data.sessionId,actor.schoolId);
 const enrollment=await StudentEnrollment.findOne({schoolId:actor.schoolId,sessionId:data.sessionId,classId:data.classId,studentId:oid(data.studentId,"student ID"),status:"ACTIVE"}).lean();
 if(!enrollment)throw new AppError("Student is not actively enrolled in the selected class and session",400);
 const ids=[...new Set(data.subjectIds as string[])]; if(ids.length!==data.subjectIds.length)throw new AppError("Duplicate elective subjects are not allowed",400);
 const mappings=await ClassSubjectMapping.find({schoolId:actor.schoolId,sessionId:data.sessionId,classId:data.classId,subjectId:{$in:ids},requirement:"ELECTIVE",isActive:true}).lean();
 if(mappings.length!==ids.length)throw new AppError("Every selected subject must be an elective mapped to this class",400);
 const limits=mappings.map(m=>m.electiveLimit||0);
 if(limits.some(limit=>limit<1))throw new AppError("Configure the elective selection limit for every elective subject before student selection",409);
 const totalLimit=Math.min(...limits);
 const existing=await StudentElectiveSelection.find({schoolId:actor.schoolId,sessionId:data.sessionId,classId:data.classId,studentId:data.studentId,status:"ACTIVE"}).select("subjectId").lean();
 const existingIds=new Set(existing.map(x=>x.subjectId.toString()));
 const creates=ids.filter(id=>!existingIds.has(id));
 if(existingIds.size+creates.length>totalLimit)throw new AppError("Elective selection exceeds the configured class selection limit",400);
 try {
  for(const subjectId of creates) await StudentElectiveSelection.updateOne(
   {schoolId:actor.schoolId,sessionId:data.sessionId,studentId:data.studentId,subjectId,status:"ACTIVE"},
   {$setOnInsert:{schoolId:oid(actor.schoolId,"school ID"),sessionId:oid(data.sessionId,"session ID"),classId:oid(data.classId,"class ID"),studentId:oid(data.studentId,"student ID"),subjectId:oid(subjectId,"subject ID"),selectedBy:oid(actor.userId,"user ID"),selectedAt:new Date(),status:"ACTIVE"}},
   {upsert:true}
  );
 } catch(error:any) { if(error?.code!==11000)throw error; }
 return StudentElectiveSelection.find({schoolId:actor.schoolId,sessionId:data.sessionId,studentId:data.studentId,status:"ACTIVE"}).populate("subjectId","name code").lean();
}
export async function listSyllabi(schoolId:string,filters:any={}) {
 const q:any={schoolId,isDeleted:false};for(const k of ["sessionId","classId","subjectId"])if(filters[k])q[k]=oid(filters[k],k);
 return SubjectSyllabus.find(q).populate("sessionId","name").populate("classId","name code").populate("subjectId","name code").sort({createdAt:-1}).lean();
}
export async function createSyllabus(data:any,actor:SubjectActor){
 await activeSession(data.sessionId,actor.schoolId); await classInSession(data.classId,data.sessionId,actor.schoolId); await subjectInSchool(data.subjectId,actor.schoolId);
 const [mapped,legacyClass]=await Promise.all([
  ClassSubjectMapping.exists({schoolId:actor.schoolId,sessionId:data.sessionId,classId:data.classId,subjectId:data.subjectId,isActive:true}),
  Class.findOne({_id:data.classId,schoolId:actor.schoolId,sessionId:data.sessionId,isDeleted:false}).select("subjects").lean()
 ]);
 if(!mapped&&!legacyClass?.subjects.some(item=>item.toString()===data.subjectId))throw new AppError("Syllabus subject must be mapped to the selected class",400);
 if(data.fileUrl && !/^https:\/\//i.test(data.fileUrl) && (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9._-]+)*$/.test(data.fileUrl) || data.fileUrl.split("/").includes("..")))throw new AppError("Invalid syllabus file reference",400);
 return SubjectSyllabus.create({...data,schoolId:oid(actor.schoolId,"school ID"),subjectId:oid(data.subjectId,"subject ID"),classId:oid(data.classId,"class ID"),sessionId:oid(data.sessionId,"session ID"),uploadedBy:oid(actor.userId,"user ID")});
}
export async function deleteSyllabus(id:string,actor:SubjectActor){
 const doc=await SubjectSyllabus.findOne({_id:oid(id,"syllabus ID"),schoolId:actor.schoolId,isDeleted:false});if(!doc)throw new AppError("Syllabus not found",404);
 await activeSession(doc.sessionId.toString(),actor.schoolId);
 if(doc.fileUrl && !/^https:\/\//i.test(doc.fileUrl)) await deleteUploadedFile(path.resolve(process.cwd(),env.UPLOAD_DIR,doc.fileUrl));
 doc.isDeleted=true;await doc.save();return {id,deleted:true};
}
export async function listSubjectsForClass(schoolId:string,sessionId:string,classId:string){
 const cls=await Class.findOne({_id:oid(classId,"class ID"),schoolId,sessionId,isDeleted:false}).populate("subjects","name code category isActive").lean();
 if(!cls)throw new AppError("Class does not belong to the selected school and academic session",400);
 // Idempotently surface legacy Module 5 class.subjects in the new session-specific mapping registry.
 for(const subject of (cls.subjects as any[]||[])){
  if(!subject || subject.isActive===false)continue;
  const requirement=subject.category==="ELECTIVE"?"ELECTIVE":subject.category==="ACTIVITY"?"ACTIVITY":"COMPULSORY";
  await ClassSubjectMapping.updateOne(
   {schoolId,sessionId,classId,subjectId:subject._id},
   {$setOnInsert:{createdBy:cls.createdBy,effectiveFrom:cls.createdAt||new Date()},$set:{requirement,isActive:true}},
   {upsert:true}
  );
 }
 return ClassSubjectMapping.find({schoolId,sessionId,classId,isActive:true}).populate("subjectId","name code category subjectType isOptional isActive").lean();
}

export async function getSyllabusFileRecord(id:string,schoolId:string){
 const doc=await SubjectSyllabus.findOne({_id:oid(id,"syllabus ID"),schoolId,isDeleted:false}).lean();
 if(!doc)throw new AppError("Syllabus not found",404);
 return doc;
}

export async function subjectClassWiseReport(schoolId:string,sessionId?:string){
 const match:any={schoolId:new Types.ObjectId(schoolId),isActive:true};if(sessionId)match.sessionId=oid(sessionId,"session ID");
 return ClassSubjectMapping.aggregate([
  {$match:match},{$group:{_id:{sessionId:"$sessionId",classId:"$classId"},subjectCount:{$sum:1},compulsory:{$sum:{$cond:[{$eq:["$requirement","COMPULSORY"]},1,0]}},elective:{$sum:{$cond:[{$eq:["$requirement","ELECTIVE"]},1,0]}},activity:{$sum:{$cond:[{$eq:["$requirement","ACTIVITY"]},1,0]}}}},
  {$lookup:{from:"classes",localField:"_id.classId",foreignField:"_id",as:"class"}},{$unwind:"$class"},{$lookup:{from:"sessions",localField:"_id.sessionId",foreignField:"_id",as:"session"}},{$unwind:"$session"},
  {$project:{_id:0,classId:"$_id.classId",className:"$class.name",sessionId:"$_id.sessionId",sessionName:"$session.name",subjectCount:1,compulsory:1,elective:1,activity:1}},{$sort:{sessionName:1,className:1}}
 ]);
}
export async function subjectTeacherWiseReport(schoolId:string,sessionId?:string){
 const match:any={schoolId:new Types.ObjectId(schoolId),isActive:true};if(sessionId)match.sessionId=oid(sessionId,"session ID");
 return SubjectTeacherAssignment.aggregate([
  {$match:match},{$group:{_id:"$teacherId",assignmentCount:{$sum:1},subjects:{$addToSet:"$subjectId"},classes:{$addToSet:"$classId"}}},
  {$lookup:{from:"employees",localField:"_id",foreignField:"_id",as:"teacher"}},{$unwind:"$teacher"},
  {$project:{_id:0,teacherId:"$_id",teacherName:"$teacher.fullName",employeeId:"$teacher.employeeId",assignmentCount:1,subjectCount:{$size:"$subjects"},classCount:{$size:"$classes"}}},{$sort:{teacherName:1}}
 ]);
}

export async function removeStudentElectiveSelection(id:string,actor:SubjectActor){
 const selection=await StudentElectiveSelection.findOne({_id:oid(id,"elective selection ID"),schoolId:actor.schoolId,status:"ACTIVE"});
 if(!selection)throw new AppError("Active elective selection not found",404);
 await activeSession(selection.sessionId.toString(),actor.schoolId);
 selection.status="REMOVED";selection.removedAt=new Date();selection.removedBy=oid(actor.userId,"user ID");await selection.save();
 return {id,removed:true};
}

export async function getMyTeacherSubjectAssignments(actor:SubjectActor){
 const employee=await Employee.findOne({schoolId:actor.schoolId,userId:oid(actor.userId,"user ID"),isDeleted:false,isActive:true,employeeType:"TEACHING"}).select("_id").lean();
 if(!employee)throw new AppError("Active teaching employee profile not found",404);
 return listTeacherAssignments(actor.schoolId,{teacherId:employee._id.toString()});
}

export async function updateSyllabus(id:string,data:any,actor:SubjectActor){
 const doc=await SubjectSyllabus.findOne({_id:oid(id,"syllabus ID"),schoolId:actor.schoolId,isDeleted:false});
 if(!doc)throw new AppError("Syllabus not found",404);
 await activeSession(doc.sessionId.toString(),actor.schoolId);
 if(data.fileUrl && !/^https:\/\//i.test(data.fileUrl) && (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9._-]+)*$/.test(data.fileUrl)||data.fileUrl.split("/").includes("..")))throw new AppError("Invalid syllabus file reference",400);
 const previous=doc.fileUrl;
 if(data.title!==undefined)doc.title=data.title;
 if(data.description!==undefined)doc.description=data.description??undefined;
 if(data.fileUrl!==undefined)doc.fileUrl=data.fileUrl;
 if(data.fileName!==undefined)doc.fileName=data.fileName;
 if(data.mimeType!==undefined)doc.mimeType=data.mimeType;
 if(data.fileSize!==undefined)doc.fileSize=data.fileSize;
 await doc.save();
 if(previous&&data.fileUrl&&previous!==data.fileUrl&&!/^https:\/\//i.test(previous)){
  try{await deleteUploadedFile(path.resolve(process.cwd(),env.UPLOAD_DIR,previous));}catch{/* Keep the new syllabus reference valid; stale file cleanup can be retried by operations. */}
 }
 return doc;
}

export async function getMyTeacherSyllabi(actor:SubjectActor){
 const employee=await Employee.findOne({schoolId:actor.schoolId,userId:oid(actor.userId,"user ID"),isDeleted:false,isActive:true,employeeType:"TEACHING"}).select("_id").lean();
 if(!employee)throw new AppError("Active teaching employee profile not found",404);
 const assignments=await SubjectTeacherAssignment.find({schoolId:actor.schoolId,teacherId:employee._id,isActive:true}).select("sessionId classId subjectId").lean();
 if(!assignments.length)return [];
 return SubjectSyllabus.find({schoolId:actor.schoolId,isDeleted:false,$or:assignments.map(item=>({sessionId:item.sessionId,classId:item.classId,subjectId:item.subjectId}))}).populate("sessionId","name").populate("classId","name code").populate("subjectId","name code").lean();
}
