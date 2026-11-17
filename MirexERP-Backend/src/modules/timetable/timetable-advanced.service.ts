import { Types } from "mongoose";
import Timetable,{DayOfWeek} from "./timetable.model";
import TimetablePeriod from "./timetable-period.model";
import TimetableRoom from "./timetable-room.model";
import TimetableVersion from "./timetable-version.model";
import Session from "../sessions/sessions.model";
import Class from "../classes/classes.model";
import Section from "../sections/sections.model";
import Employee from "../employees/employees.model";
import Subject from "../subjects/subjects.model";
import ClassSubjectMapping from "../subjects/class-subject-mapping.model";
import SubjectTeacherAssignment from "../class-section/subject-teacher-assignment.model";
import { SchoolSettings } from "../settings/settings.model";
import {Communication,CommunicationDelivery,CommunicationSettings} from "../communication/communication.model";
import {Parent} from "../parents/parents.model";
import Student from "../students/students.model";
import { AppError } from "../../utils/AppError";

const oid=(id:string,label:string)=>{if(!Types.ObjectId.isValid(id))throw new AppError(`Invalid ${label}`,400);return new Types.ObjectId(id);};
const mins=(v:string)=>{const [h,m]=v.split(":").map(Number);return h*60+m;};
const overlaps=(a:{startTime:string;endTime:string},b:{startTime:string;endTime:string})=>mins(a.startTime)<mins(b.endTime)&&mins(a.endTime)>mins(b.startTime);
const validTime=(start:string,end:string)=>{if(mins(end)<=mins(start))throw new AppError("Period end time must be after start time",400);};
const days=Object.values(DayOfWeek);

export 
function validateCombinedGroups(entries:any[]){
 const groups=new Map<string,any[]>();
 for(const entry of entries){if(entry.entryType==="LAB"&&!entry.combinedGroupId)throw new AppError("Lab timetable entries require a combined-period group ID",400);if(entry.combinedGroupId)groups.set(entry.combinedGroupId,[...(groups.get(entry.combinedGroupId)||[]),entry]);}
 for(const [groupId,group] of groups){
  if(group.length<2)throw new AppError(`Combined period group ${groupId} must contain at least two periods`,400);
  const sorted=[...group].sort((a,b)=>a.periodNumber-b.periodNumber);
  for(let i=0;i<sorted.length;i++){
   const item=sorted[i];if(item.isBreak)throw new AppError("Break periods cannot be included in a combined teaching block",400);
   if(item.dayOfWeek!==sorted[0].dayOfWeek||item.classId.toString()!==sorted[0].classId.toString()||item.sectionId.toString()!==sorted[0].sectionId.toString()||item.teacherId.toString()!==sorted[0].teacherId.toString()||item.subjectId.toString()!==sorted[0].subjectId.toString()||String(item.roomId||item.roomNumber||"")!==String(sorted[0].roomId||sorted[0].roomNumber||""))throw new AppError("Combined periods must share day, class, section, subject, teacher and room",400);
   if(i>0&&(item.periodNumber!==sorted[i-1].periodNumber+1||mins(item.startTime)!==mins(sorted[i-1].endTime)))throw new AppError("Combined lab periods must be consecutive and contiguous",400);
  }
 }
}

export async function validateEntry(schoolId:string, sessionId:string, entry:any, actorId:string){
  if(!days.includes(entry.dayOfWeek))throw new AppError("Invalid timetable weekday",400);
  validTime(entry.startTime,entry.endTime);
  const [session,cls,section,settings]=await Promise.all([
    Session.findOne({_id:sessionId,schoolId,isDeleted:false,isClosed:{$ne:true}}).select("_id startDate endDate"),
    Class.findOne({_id:entry.classId,schoolId,sessionId,isDeleted:false,isActive:true}).select("_id subjects"),
    Section.findOne({_id:entry.sectionId,schoolId,sessionId,classId:entry.classId,isDeleted:false,isActive:true}).select("_id capacity"),
    SchoolSettings.findOne({schoolId}).select("academic")
  ]);
  if(!session)throw new AppError("Academic session is closed or unavailable",409);
  if(!cls)throw new AppError("Class does not belong to this school and academic session",400);
  if(!section)throw new AppError("Section does not belong to the selected class and academic session",400);
  const workingDays=settings?.academic?.workingDays?.length?settings.academic.workingDays:days.filter(d=>d!=="SUNDAY");
  if(!workingDays.includes(entry.dayOfWeek))throw new AppError("Cannot schedule a normal timetable on a non-working day",400);
  if(settings?.academic?.schoolStartTime&&mins(entry.startTime)<mins(settings.academic.schoolStartTime))throw new AppError("Period starts before school opening time",400);
  if(settings?.academic?.schoolEndTime&&mins(entry.endTime)>mins(settings.academic.schoolEndTime))throw new AppError("Period ends after school closing time",400);
  if(entry.periodId){
    const period=await TimetablePeriod.findOne({_id:entry.periodId,schoolId,isActive:true, $or:[{sessionId:null},{sessionId}]});
    if(!period)throw new AppError("Selected period is inactive or unavailable",400);
    if(entry.isBreak ? ["REGULAR","ACTIVITY"].includes(period.type) : !["REGULAR","ACTIVITY"].includes(period.type))throw new AppError("Selected period type does not match teaching/break entry",400);
    if(period.periodNumber!==entry.periodNumber)throw new AppError("Timetable entry period number must match the configured period",400);
    if(period.startTime!==entry.startTime||period.endTime!==entry.endTime)throw new AppError("Timetable entry timing must match the configured period",400);
    if(!period.applicableDays.includes(entry.dayOfWeek))throw new AppError("Selected period is not configured for this weekday",400);
  }
  if(entry.isBreak){
    if(entry.subjectId||entry.teacherId||entry.roomId||entry.roomNumber)throw new AppError("Break slots cannot contain subject, teacher or room assignments",400);
    return;
  }
  if(!entry.subjectId||!entry.teacherId)throw new AppError("Subject and teacher are required for teaching periods",400);
  const [subject,teacher,mapping,legacyMapping,teacherMapping]=await Promise.all([
    Subject.findOne({_id:entry.subjectId,schoolId,isDeleted:false,isActive:true}).select("_id"),
    Employee.findOne({_id:entry.teacherId,schoolId,isDeleted:false,isActive:true,status:"ACTIVE",employeeType:"TEACHING"}).select("_id employeeType"),
    ClassSubjectMapping.exists({schoolId,sessionId,classId:entry.classId,subjectId:entry.subjectId,isActive:true,effectiveFrom:{$lte:new Date()}}),
    Class.findOne({_id:entry.classId,schoolId,sessionId,isDeleted:false,subjects:entry.subjectId}).select("_id"),
    SubjectTeacherAssignment.exists({schoolId,sessionId,classId:entry.classId,subjectId:entry.subjectId,teacherId:entry.teacherId,isActive:true,$or:[{sectionId:entry.sectionId},{sectionId:null}]})
  ]);
  if(!subject)throw new AppError("Subject is inactive or unavailable in this school",400);
  if(!teacher)throw new AppError("Teacher must be an active teaching employee of this school",400);
  if(!mapping&&!legacyMapping)throw new AppError("Subject is not mapped to this class and session",400);
  if(!teacherMapping)throw new AppError("Teacher is not assigned to this class/section subject",400);
  if(entry.roomId){
    const room=await TimetableRoom.findOne({_id:entry.roomId,schoolId,isActive:true}).select("_id capacity");
    if(!room)throw new AppError("Room is inactive or belongs to another school",400);
    const enrolledStrength=await Student.countDocuments({schoolId,classId:entry.classId,sectionId:entry.sectionId,isDeleted:false,isActive:true,status:"ACTIVE"});
    const requiredCapacity=enrolledStrength||section.capacity;
    if(room.capacity&&requiredCapacity&&room.capacity<requiredCapacity)throw new AppError(`Room capacity (${room.capacity}) is below the section strength (${requiredCapacity})`,400);
  }
  if(entry.roomNumber&&!entry.roomId){
    const room=await TimetableRoom.findOne({schoolId,roomNumber:entry.roomNumber,isActive:true}).select("_id");
    if(room)entry.roomId=room._id;
  }
}

export async function validateNoConflicts(schoolId:string, sessionId:string, entries:any[], excludeVersionId?:Types.ObjectId, excludeEntryId?:Types.ObjectId){
  for(let i=0;i<entries.length;i++){
    const current=entries[i];
    for(let j=i+1;j<entries.length;j++){
      const other=entries[j];if(other.dayOfWeek!==current.dayOfWeek)continue;
      if(current.sectionId.toString()===other.sectionId.toString()&&(current.periodNumber===other.periodNumber||overlaps(current,other)))throw new AppError("Section has duplicate or overlapping timetable periods",409);
      if(current.isBreak||other.isBreak||!overlaps(current,other))continue;
      if(current.teacherId.toString()===other.teacherId.toString())throw new AppError("Teacher is assigned to overlapping periods",409);
      if(String(current.roomId||current.roomNumber||"")&&String(current.roomId||current.roomNumber||"")===String(other.roomId||other.roomNumber||""))throw new AppError("Room is assigned to overlapping periods",409);
    }
    if(current.isBreak)continue;
    const skipIds=excludeVersionId?{versionId:{$ne:excludeVersionId}}:{};
    const base:any={schoolId,sessionId,dayOfWeek:current.dayOfWeek,isActive:true,isBreak:false,...skipIds};if(excludeEntryId)base._id={$ne:excludeEntryId};
    const [teacherConflict,roomConflict]=await Promise.all([
      Timetable.findOne({...base,teacherId:current.teacherId,startTime:{$lt:current.endTime},endTime:{$gt:current.startTime},sectionId:{$ne:current.sectionId}}).select("_id"),
      current.roomId?Timetable.findOne({...base,roomId:current.roomId,startTime:{$lt:current.endTime},endTime:{$gt:current.startTime},sectionId:{$ne:current.sectionId}}).select("_id"):current.roomNumber?Timetable.findOne({...base,roomNumber:current.roomNumber,startTime:{$lt:current.endTime},endTime:{$gt:current.startTime},sectionId:{$ne:current.sectionId}}).select("_id"):null
    ]);
    if(teacherConflict)throw new AppError("Teacher already has another class during this time",409);
    if(roomConflict)throw new AppError("Room is already occupied during this time",409);
  }
}

export async function createTimetableVersion(actor:{schoolId:string;userId:string},data:any){
  const schoolId=oid(actor.schoolId,"school ID"),sessionId=oid(data.sessionId,"session ID"),classId=oid(data.classId,"class ID"),sectionId=oid(data.sectionId,"section ID");
  if(!Array.isArray(data.entries)||!data.entries.length)throw new AppError("At least one timetable entry is required",400);
  if(data.entries.length>300)throw new AppError("A timetable version cannot exceed 300 entries",400);
  const entries=data.entries.map((e:any)=>({...e,classId,sectionId}));
  for(const e of entries)await validateEntry(String(schoolId),String(sessionId),e,actor.userId);
  validateCombinedGroups(entries);
  await validateNoConflicts(String(schoolId),String(sessionId),entries);
  const last=await TimetableVersion.findOne({schoolId,sessionId,classId,sectionId}).sort({version:-1}).select("version");
  const previous=await TimetableVersion.findOne({schoolId,sessionId,classId,sectionId,status:"PUBLISHED"}).select("_id");
  const version=await TimetableVersion.create({schoolId,sessionId,classId,sectionId,version:(last?.version||0)+1,status:"DRAFT",entryIds:[],previousVersionId:previous?._id||null,changeSummary:data.changeSummary,createdBy:oid(actor.userId,"user ID")});
  try{
    const docs=await Timetable.insertMany(entries.map((e:any)=>({...e,schoolId,sessionId,classId,sectionId,versionId:version._id,isActive:false,createdBy:oid(actor.userId,"user ID")})));
    version.entryIds=docs.map(d=>d._id);await version.save();
    return TimetableVersion.findById(version._id).populate("entryIds").lean();
  }catch(error){await TimetableVersion.deleteOne({_id:version._id});throw error;}
}

async function queueTimetableNotification(version:any,actorId:string){
 try{
  if(version.notificationCommunicationId)return;
  const [settings,entries,students]=await Promise.all([
   CommunicationSettings.findOne({schoolId:version.schoolId}).lean(),
   Timetable.find({_id:{$in:version.entryIds},schoolId:version.schoolId}).select("teacherId").lean(),
   Student.find({schoolId:version.schoolId,classId:version.classId,sectionId:version.sectionId,isDeleted:false}).select("parentId").lean()
  ]);
  if(settings?.inAppEnabled===false)return;
  const employeeIds=[...new Set(entries.map((e:any)=>String(e.teacherId)).filter(Boolean))];
  const employees=await Employee.find({_id:{$in:employeeIds},schoolId:version.schoolId,isActive:true}).select("userId").lean();
  const teacherUsers=settings?.teacherNotifications===false?[]:employees.map((e:any)=>e.userId).filter(Boolean);
  const parentIds=[...new Set(students.map((s:any)=>s.parentId?.toString()).filter(Boolean))];
  const parents=settings?.parentNotifications===false?[]:await Parent.find({_id:{$in:parentIds},schoolId:version.schoolId,isActive:true}).select("userId").lean();
  const recipientIds=[...new Set([...teacherUsers,...parents.map((p:any)=>p.userId).filter(Boolean)].map((v:any)=>String(v)))].map((v)=>new Types.ObjectId(v));
  if(!recipientIds.length)return;
  const communication=await Communication.create({schoolId:version.schoolId,title:"Timetable published or updated",message:`A new timetable version ${version.version} has been published for your class/section. Please review your updated schedule.`,type:"GENERAL",audiences:["INDIVIDUAL"],classIds:[version.classId],sectionIds:[version.sectionId],recipientIds,channels:["IN_APP"],status:"PUBLISHED",priority:"NORMAL",publishedAt:new Date(),createdBy:new Types.ObjectId(actorId)});
  await CommunicationDelivery.insertMany(recipientIds.map((recipientId)=>({schoolId:version.schoolId,communicationId:communication._id,recipientId,channel:"IN_APP",status:"QUEUED"})),{ordered:false});
  version.notificationCommunicationId=communication._id;await version.save();
 }catch(error){/* Notification failure must never roll back timetable publishing. */}
}

export async function publishTimetableVersion(actor:{schoolId:string;userId:string},versionId:string){
  const schoolId=oid(actor.schoolId,"school ID"),id=oid(versionId,"version ID");
  const version=await TimetableVersion.findOne({_id:id,schoolId,status:"DRAFT"});if(!version)throw new AppError("Draft timetable version not found",404);
  const entries=await Timetable.find({_id:{$in:version.entryIds},schoolId,versionId:version._id}).lean();
  if(!entries.length)throw new AppError("Draft timetable has no entries",400);
  for(const e of entries)await validateEntry(String(schoolId),String(version.sessionId),e,actor.userId);
  validateCombinedGroups(entries);
  await validateNoConflicts(String(schoolId),String(version.sessionId),entries,version._id);
  const previous=await TimetableVersion.findOne({schoolId,sessionId:version.sessionId,classId:version.classId,sectionId:version.sectionId,status:"PUBLISHED"});
  const previousActiveEntries=await Timetable.find({schoolId,sessionId:version.sessionId,classId:version.classId,sectionId:version.sectionId,isActive:true,versionId:{$ne:version._id}}).select("_id").lean();
  if(previous){previous.status="ARCHIVED";await previous.save();}
  if(previousActiveEntries.length)await Timetable.updateMany({_id:{$in:previousActiveEntries.map((e:any)=>e._id)},schoolId},{ $set:{isActive:false} });
  try{
    version.status="PUBLISHED";version.publishedBy=oid(actor.userId,"user ID");version.publishedAt=new Date();await version.save();
    await Timetable.updateMany({_id:{$in:version.entryIds},schoolId},{ $set:{isActive:true} });
  }catch(error){const alreadyPublished=await TimetableVersion.exists({schoolId,sessionId:version.sessionId,classId:version.classId,sectionId:version.sectionId,status:"PUBLISHED"});if(previous&&!alreadyPublished){previous.status="PUBLISHED";await previous.save();await Timetable.updateMany({_id:{$in:previousActiveEntries.map((e:any)=>e._id)},schoolId},{ $set:{isActive:true} });}throw error;}
  await queueTimetableNotification(version,actor.userId);
  return TimetableVersion.findById(version._id).populate("entryIds").lean();
}

export async function getTimetableVersionHistory(schoolId:string,versionId:string){
 const id=oid(versionId,"version ID"),current=await TimetableVersion.findOne({_id:id,schoolId});if(!current)throw new AppError("Timetable version not found",404);
 return TimetableVersion.find({schoolId,sessionId:current.sessionId,classId:current.classId,sectionId:current.sectionId}).populate("createdBy","name email").populate("publishedBy","name email").sort({version:-1}).lean();
}

export async function listPeriods(schoolId:string,sessionId?:string){return TimetablePeriod.find({schoolId,isActive:true,...(sessionId?{$or:[{sessionId},{sessionId:null}]}:{})}).sort({periodNumber:1,startTime:1}).lean();}
export async function savePeriod(actor:{schoolId:string;userId:string},data:any,id?:string){
 const schoolId=oid(actor.schoolId,"school ID");validTime(data.startTime,data.endTime);
 const start=mins(data.startTime),end=mins(data.endTime);
 const query:any={schoolId,isActive:true,applicableDays:{$in:data.applicableDays||days}};if(data.sessionId)query.$or=[{sessionId:data.sessionId},{sessionId:null}];
 const existing=await TimetablePeriod.find(query).lean();if(existing.some(p=>(!id||p._id.toString()!==id)&&mins(p.startTime)<end&&mins(p.endTime)>start))throw new AppError("Period timing overlaps another configured period",409);
 if(id){
  const existingPeriod=await TimetablePeriod.findOne({_id:oid(id,"period ID"),schoolId});if(!existingPeriod)throw new AppError("Period not found",404);
  const used=await Timetable.exists({schoolId,periodId:existingPeriod._id,isActive:true});
  if(used&&(["startTime","endTime","periodNumber","type","applicableDays","sessionId"].some(key=>data[key]!==undefined&&JSON.stringify(data[key])!==JSON.stringify((existingPeriod as any)[key]))))throw new AppError("A period used by a published timetable cannot have its timing or structure changed; create a new period instead",409);
  const item=await TimetablePeriod.findOneAndUpdate({_id:existingPeriod._id,schoolId},{$set:{...data,updatedBy:oid(actor.userId,"user ID")}},{new:true,runValidators:true});if(!item)throw new AppError("Period not found",404);return item;
 }
 return TimetablePeriod.create({...data,schoolId,createdBy:oid(actor.userId,"user ID")});
}
export async function removePeriod(schoolId:string,id:string){const period=await TimetablePeriod.findOne({_id:oid(id,"period ID"),schoolId});if(!period)throw new AppError("Period not found",404);const used=await Timetable.exists({schoolId,periodId:period._id,isActive:true});if(used)throw new AppError("Period is used by an active timetable and cannot be removed",409);period.isActive=false;await period.save();return period;}
export async function listRooms(schoolId:string){return TimetableRoom.find({schoolId,isActive:true}).sort({roomNumber:1}).lean();}
export async function saveRoom(actor:{schoolId:string;userId:string},data:any,id?:string){const schoolId=oid(actor.schoolId,"school ID");if(id){const item=await TimetableRoom.findOneAndUpdate({_id:oid(id,"room ID"),schoolId},{$set:{...data,updatedBy:oid(actor.userId,"user ID")}},{new:true,runValidators:true});if(!item)throw new AppError("Room not found",404);return item;}return TimetableRoom.create({...data,schoolId,createdBy:oid(actor.userId,"user ID")});}
export async function removeRoom(schoolId:string,id:string){const room=await TimetableRoom.findOne({_id:oid(id,"room ID"),schoolId});if(!room)throw new AppError("Room not found",404);const used=await Timetable.exists({schoolId,roomId:room._id,isActive:true});if(used)throw new AppError("Room is used by an active timetable and cannot be removed",409);room.isActive=false;await room.save();return room;}
export async function checkTimetableConflicts(schoolId:string,data:any,actorId:string){const entries=(data.entries||[]).map((entry:any)=>({...entry,classId:oid(data.classId,"class ID"),sectionId:oid(data.sectionId,"section ID")}));for(const entry of entries)await validateEntry(schoolId,data.sessionId,entry,actorId);validateCombinedGroups(entries);await validateNoConflicts(schoolId,data.sessionId,entries);return {valid:true,conflicts:[]};}

export async function getVersionForPrint(schoolId:string,versionId:string){
 const id=oid(versionId,"version ID");const version=await TimetableVersion.findOne({_id:id,schoolId}).populate("schoolId","name logo").populate("sessionId","name").populate("classId","name code").populate("sectionId","name code").lean();
 if(!version)throw new AppError("Timetable version not found",404);
 const entries=await Timetable.find({_id:{$in:version.entryIds},schoolId}).populate("subjectId","name code").populate("teacherId","firstName lastName fullName").populate("roomId","name roomNumber").sort({dayOfWeek:1,periodNumber:1}).lean();
 return {version,entries};
}

export async function archiveTimetableVersion(actor:{schoolId:string;userId:string},versionId:string){
 const schoolId=oid(actor.schoolId,"school ID"),id=oid(versionId,"version ID");
 const version=await TimetableVersion.findOne({_id:id,schoolId,status:"PUBLISHED"});if(!version)throw new AppError("Published timetable version not found",404);
 version.status="ARCHIVED";await version.save();await Timetable.updateMany({_id:{$in:version.entryIds},schoolId},{ $set:{isActive:false} });return version;
}
