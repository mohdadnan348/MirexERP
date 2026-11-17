import mongoose,{Types} from "mongoose";
import Employee from "./employees.model";
import User from "../auth/auth.model";
import Class from "../classes/classes.model";
import Section from "../sections/sections.model";
import Session from "../sessions/sessions.model";
import SubjectTeacherAssignment from "../class-section/subject-teacher-assignment.model";
import SubstituteAssignment from "./substitute-assignment.model";
import EmployeeDepartment from "./employee-department.model";
import EmployeeDesignation from "./employee-designation.model";
import Timetable from "../timetable/timetable.model";
import EmployeeAudit from "./employee-audit.model";
import Attendance from "../attendance/attendance.model";
import {AppError} from "../../utils/AppError";
import {ACCOUNT_STATUS} from "../../config/constants";

const oid=(id:string,label:string)=>{if(!Types.ObjectId.isValid(id))throw new AppError(`Invalid ${label}`,400);return new Types.ObjectId(id);};
const getEmployee=async(id:string,schoolId:string)=>{const e=await Employee.findOne({_id:oid(id,"employee ID"),schoolId,isDeleted:false});if(!e)throw new AppError("Employee not found",404);return e;};
const actorId=(id:string)=>oid(id,"user ID");

export async function getDashboard(schoolId:string){
 const match={schoolId:oid(schoolId,"school ID"),isDeleted:false};
 const [total,active,inactive,onLeave,teaching,nonTeaching,partTime,recent,byDepartment,byDesignation,byEmploymentType,awaitingProfile,assignments]=await Promise.all([
 Employee.countDocuments(match),Employee.countDocuments({...match,status:"ACTIVE"}),Employee.countDocuments({...match,status:"INACTIVE"}),Employee.countDocuments({...match,status:"ON_LEAVE"}),Employee.countDocuments({...match,employeeType:"TEACHING"}),Employee.countDocuments({...match,employeeType:{$ne:"TEACHING"}}),Employee.countDocuments({...match,employmentType:"PART_TIME"}),Employee.find(match).sort({joiningDate:-1}).limit(6).select("employeeId firstName lastName employeeType designation joiningDate status").lean(),
 Employee.aggregate([{$match:match},{$group:{_id:"$department",count:{$sum:1}}},{$sort:{count:-1}}]),
 Employee.aggregate([{$match:match},{$group:{_id:"$designation",count:{$sum:1}}},{$sort:{count:-1}}]),
 Employee.aggregate([{$match:match},{$group:{_id:"$employmentType",count:{$sum:1}}}]),
 Employee.countDocuments({...match,$or:[{profileImage:{$exists:false}},{profileImage:""},{email:{$exists:false}},{email:""}]}),
 SubjectTeacherAssignment.countDocuments({schoolId:match.schoolId,isActive:true})
 ]);
 return {total,active,inactive,onLeave,teaching,nonTeaching,partTime,recent,byDepartment,byDesignation,byEmploymentType,awaitingProfile,assignments};
}
export async function updateQualifications(id:string,schoolId:string,items:any[],actor:string){
 const e=await getEmployee(id,schoolId);
 for(const q of items){if(!q.qualificationName?.trim())throw new AppError("Qualification name is required",400);if(q.passingYear!==undefined&&(!Number.isInteger(q.passingYear)||q.passingYear<1900||q.passingYear>new Date().getFullYear()+1))throw new AppError("Invalid passing year",400);}
 e.qualifications=items as any;e.updatedBy=actorId(actor);await e.save();await EmployeeAudit.create({schoolId:oid(schoolId,"school ID"),employeeId:e._id,action:"QUALIFICATIONS_UPDATED",changedFields:["qualifications"],performedBy:actorId(actor)});return e.qualifications;
}
export async function updateExperience(id:string,schoolId:string,items:any[],actor:string){
 const e=await getEmployee(id,schoolId);
 const intervals:Array<[number,number]>=[];
 for(const x of items){const start=new Date(x.startDate);if(!x.current&&!x.endDate)throw new AppError("Provide an end date or mark the experience as current",400);const end=x.current?new Date():new Date(x.endDate);if(!x.organization?.trim()||!x.designation?.trim()||Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||start>end)throw new AppError("Invalid experience record or date range",400);intervals.push([start.getTime(),end.getTime()]);}
 intervals.sort((a,b)=>a[0]-b[0]);let totalMs=0;let current: [number,number]|null=null;
 for(const interval of intervals){if(!current)current=[...interval];else if(interval[0]<=current[1])current[1]=Math.max(current[1],interval[1]);else{totalMs+=current[1]-current[0];current=[...interval];}}
 if(current)totalMs+=current[1]-current[0];
 e.experienceHistory=items as any;e.experienceYears=Math.round((totalMs/(365.25*24*60*60*1000))*100)/100;e.updatedBy=actorId(actor);await e.save();await EmployeeAudit.create({schoolId:oid(schoolId,"school ID"),employeeId:e._id,action:"EXPERIENCE_UPDATED",changedFields:["experienceHistory","experienceYears"],performedBy:actorId(actor)});return e.experienceHistory;
}
export async function updateSalary(id:string,schoolId:string,data:any,actor:string){
 const e=await getEmployee(id,schoolId);
 const basic=Number(data.basic),hra=Number(data.hra||0),allowances=Number(data.allowances||0),deductions=Number(data.deductions||0);
 if([basic,hra,allowances,deductions].some(n=>!Number.isFinite(n)||n<0))throw new AppError("Salary components must be valid non-negative numbers",400);
 const gross=basic+hra+allowances;
 if(deductions>gross)throw new AppError("Deductions cannot exceed gross salary",400);
 const effectiveDate=new Date(data.effectiveDate);
 if(Number.isNaN(effectiveDate.getTime()))throw new AppError("Valid salary effective date is required",400);
 (e.salaryHistory as any[]).push({basic,hra,allowances,deductions,gross,effectiveDate,paymentFrequency:data.paymentFrequency||"MONTHLY",remarks:data.remarks,changedBy:actorId(actor)});
 e.salary={basic,hra,allowances,deductions,grossSalary:gross,netSalary:gross-deductions,currency:"INR"} as any;
 e.updatedBy=actorId(actor);await e.save();await EmployeeAudit.create({schoolId:oid(schoolId,"school ID"),employeeId:e._id,action:"SALARY_UPDATED",changedFields:["salary","salaryHistory"],performedBy:actorId(actor)});return {salary:e.salary,history:e.salaryHistory};
}
export async function listDepartments(schoolId:string){return EmployeeDepartment.find({schoolId}).sort({name:1}).lean();}
export async function saveDepartment(schoolId:string,actor:string,data:any,id?:string){
 const filter:any={schoolId:oid(schoolId,"school ID")};
 if(id){const d=await EmployeeDepartment.findOneAndUpdate({_id:oid(id,"department ID"),...filter},{name:data.name,code:data.code?.toUpperCase(),description:data.description,isActive:data.isActive!==false},{new:true,runValidators:true});if(!d)throw new AppError("Department not found",404);return d;}
 try{return await EmployeeDepartment.create({...filter,...data,code:data.code.toUpperCase(),createdBy:actorId(actor)});}catch(e:any){if(e?.code===11000)throw new AppError("Department name or code already exists",409);throw e;}
}
export async function createSubstitute(schoolId:string,actor:string,data:any){
 const sid=oid(schoolId,"school ID");
 const session=await Session.findOne({_id:oid(data.sessionId,"session ID"),schoolId:sid,isDeleted:false,isClosed:{$ne:true}}).select("_id startDate endDate");
 if(!session)throw new AppError("Academic session is closed or unavailable",409);
 if(!data.sectionId||!data.period)throw new AppError("Section and period are required for a date-specific substitute assignment",400);
 const [regular,substitute,cls]=await Promise.all([
  Employee.findOne({_id:oid(data.regularTeacherId,"regular teacher ID"),schoolId:sid,isDeleted:false,isActive:true,status:"ACTIVE",employeeType:"TEACHING"}),
  Employee.findOne({_id:oid(data.substituteTeacherId,"substitute teacher ID"),schoolId:sid,isDeleted:false,isActive:true,status:"ACTIVE",employeeType:"TEACHING"}),
  Class.findOne({_id:oid(data.classId,"class ID"),schoolId:sid,sessionId:oid(data.sessionId,"session ID"),isDeleted:false})
 ]);
 if(!regular||!substitute)throw new AppError("Both regular and substitute teachers must be active teaching employees",400);
 if(!cls)throw new AppError("Class does not belong to the selected school and session",400);
 if(data.sectionId){const section=await Section.findOne({_id:oid(data.sectionId,"section ID"),schoolId:sid,classId:cls._id,sessionId:cls.sessionId,isDeleted:false});if(!section)throw new AppError("Section does not belong to selected class and session",400);}
 if(data.subjectId){
  const assigned=await SubjectTeacherAssignment.exists({schoolId:sid,sessionId:cls.sessionId,classId:cls._id,subjectId:oid(data.subjectId,"subject ID"),teacherId:regular._id,isActive:true,$or:[{sectionId:data.sectionId?oid(data.sectionId,"section ID"):null},{sectionId:null}]});
  if(!assigned)throw new AppError("Regular teacher is not assigned to this class/section subject",400);
 }
 const date=new Date(data.date);if(Number.isNaN(date.getTime()))throw new AppError("Valid substitute date is required",400);
 if(date<session.startDate||date>session.endDate)throw new AppError("Substitute date must fall inside the selected academic session",400);
 if(data.period){
  const dayOfWeek=["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"][date.getDay()];
  const timetableFilter:any={schoolId:sid,sessionId:cls.sessionId,classId:cls._id,dayOfWeek,periodNumber:data.period,isActive:true,isBreak:false};
  if(data.sectionId)timetableFilter.sectionId=oid(data.sectionId,"section ID");
  const timetableRows=await Timetable.find(timetableFilter).lean();
  const originalEntry=timetableRows.find(row=>row.teacherId.toString()===regular._id.toString()&&(!data.subjectId||row.subjectId.toString()===data.subjectId));
  if(!originalEntry)throw new AppError("Regular teacher is not assigned to this timetable period",400);
  const conflict=await Timetable.findOne({schoolId:sid,sessionId:cls.sessionId,teacherId:substitute._id,dayOfWeek,isActive:true,isBreak:false,startTime:{$lt:originalEntry.endTime},endTime:{$gt:originalEntry.startTime}});
  if(conflict)throw new AppError("Substitute teacher already has an overlapping timetable assignment for this date",409);
  const existingCover=await SubstituteAssignment.find({schoolId:sid,date, status:"ACTIVE",substituteTeacherId:substitute._id}).lean();
  for(const cover of existingCover){
   const coveredEntry=await Timetable.findOne({schoolId:sid,sessionId:cls.sessionId,classId:cover.classId,sectionId:cover.sectionId,teacherId:cover.regularTeacherId,dayOfWeek,isActive:true,isBreak:false,periodNumber:cover.period}).select("startTime endTime").lean();
   if(coveredEntry&&Number(originalEntry.startTime.replace(":",""))<Number(coveredEntry.endTime.replace(":",""))&&Number(originalEntry.endTime.replace(":",""))>Number(coveredEntry.startTime.replace(":","")))throw new AppError("Substitute teacher already has another overlapping substitute assignment",409);
  }
  const duplicate=existingCover.find(cover=>cover.period===data.period);
  if(duplicate)throw new AppError("Substitute teacher already has an assignment for this class, date and period",409);
 }
 try{return await SubstituteAssignment.create({...data,schoolId:sid,regularTeacherId:regular._id,substituteTeacherId:substitute._id,date,createdBy:actorId(actor)});}
 catch(error:any){if(error?.code===11000)throw new AppError("Substitute teacher already has an active assignment for this date and period",409);throw error;}
}
export async function listSubstitutes(schoolId:string){return SubstituteAssignment.find({schoolId}).populate("classId","name code").populate("sectionId","name").populate("subjectId","name code").populate("regularTeacherId","fullName employeeId").populate("substituteTeacherId","fullName employeeId").sort({date:-1}).lean();}
export async function exitEmployee(id:string,schoolId:string,actor:string,data:any){
 const e=await getEmployee(id,schoolId);const sid=oid(schoolId,"school ID");
 const [classTeacherClasses,activeAssignments,timetableAssignments,substituteAssignments]=await Promise.all([
  Class.find({schoolId:sid,classTeacherId:e._id,isDeleted:false}).select("_id name code").lean(),
  SubjectTeacherAssignment.find({schoolId:sid,teacherId:e._id,isActive:true}).select("_id classId sectionId subjectId sessionId").lean(),
  Timetable.find({schoolId:sid,teacherId:e._id,isActive:true,isBreak:false}).select("_id classId sectionId subjectId sessionId").lean(),
  SubstituteAssignment.find({schoolId:sid,$or:[{regularTeacherId:e._id},{substituteTeacherId:e._id}],status:"ACTIVE"}).select("_id classId date period").lean()
 ]);
 if(classTeacherClasses.length||activeAssignments.length||timetableAssignments.length||substituteAssignments.length)throw new AppError(`Employee still has ${classTeacherClasses.length} class-teacher responsibility/responsibilities, ${activeAssignments.length} active subject assignment(s), ${timetableAssignments.length} timetable period(s), and ${substituteAssignments.length} active substitute assignment(s). Reassign or explicitly close them before exit.`,409);
 const exitDate=new Date(data.exitDate);if(Number.isNaN(exitDate.getTime())||exitDate<e.joiningDate)throw new AppError("Exit date must be valid and cannot precede joining date",400);
 e.exitHistory=(e.exitHistory||[]) as any;e.exitHistory.push({exitDate,reason:data.reason,remarks:data.remarks,handoverNotes:data.handoverNotes,approvedBy:actorId(actor),createdBy:actorId(actor)});
 e.exitDetails={exitDate,reason:data.reason};e.status=data.reason==="RESIGNATION"?"RESIGNED":"TERMINATED";e.isActive=false;e.resignationDate=exitDate;e.updatedBy=actorId(actor);await e.save();
 await EmployeeAudit.create({schoolId:sid,employeeId:e._id,action:"EMPLOYEE_EXITED",changedFields:["status","isActive","exitHistory","exitDetails"],performedBy:actorId(actor),details:String(data.reason)});
 if(e.userId){
  await User.updateOne({_id:e.userId,schoolId:sid},{$set:{isActive:false,status:ACCOUNT_STATUS.SUSPENDED,passwordResetToken:null,passwordResetExpires:null}});
  await mongoose.connection.collection("authsessions").updateMany({userId:e.userId,revokedAt:null},{$set:{revokedAt:new Date(),updatedAt:new Date()}});
 }
 return {employee:e,loginDeactivated:Boolean(e.userId),refreshSessionsRevoked:Boolean(e.userId),classTeacherClasses,activeAssignments,timetableAssignments,substituteAssignments};
}
export async function getAssignmentsForEmployee(id:string,schoolId:string){
 const e=await getEmployee(id,schoolId);
 const [subjectAssignments,substitutes,classTeacherClasses,timetableAssignments]=await Promise.all([
  SubjectTeacherAssignment.find({schoolId,teacherId:e._id}).populate("sessionId","name").populate("classId","name code").populate("sectionId","name").populate("subjectId","name code").sort({createdAt:-1}).lean(),
  SubstituteAssignment.find({schoolId,$or:[{regularTeacherId:e._id},{substituteTeacherId:e._id}]}).populate("classId","name code").populate("subjectId","name code").sort({date:-1}).lean(),
  Class.find({schoolId,classTeacherId:e._id,isDeleted:false}).populate("sessionId","name").select("name code sessionId").lean(),
  Timetable.find({schoolId,teacherId:e._id,isActive:true,isBreak:false}).populate("sessionId","name").populate("classId","name code").populate("sectionId","name").populate("subjectId","name code").lean()
 ]);
 return {subjectAssignments,substitutes,classTeacherClasses,timetableAssignments};
}

export async function setClassTeacher(schoolId:string,actor:string,data:any){
 const sid=oid(schoolId,"school ID");
 const session=await Session.findOne({_id:oid(data.sessionId,"session ID"),schoolId:sid,isDeleted:false,isClosed:{$ne:true}}).select("_id");
 if(!session)throw new AppError("Academic session is closed or unavailable",409);
 const cls=await Class.findOne({_id:oid(data.classId,"class ID"),schoolId:sid,sessionId:oid(data.sessionId,"session ID"),isDeleted:false});
 if(!cls)throw new AppError("Class does not belong to selected school and session",400);
 const teacher=await Employee.findOne({_id:oid(data.teacherId,"teacher ID"),schoolId:sid,isDeleted:false,isActive:true,status:"ACTIVE",employeeType:"TEACHING"});
 if(!teacher)throw new AppError("Class teacher must be an active teaching employee",400);
 const existing=await Class.findOne({schoolId:sid,sessionId:cls.sessionId,classTeacherId:teacher._id,isDeleted:false,_id:{$ne:cls._id}});
 if(existing)throw new AppError("This teacher is already a class teacher for another class in the selected session",409);
 const now=new Date();
 cls.classTeacherHistory=(cls.classTeacherHistory||[]) as any;
 if(cls.classTeacherId?.toString()!==teacher._id.toString()){
  const activeHistory=(cls.classTeacherHistory as any[]).find(entry=>!entry.effectiveTo);
  if(activeHistory)activeHistory.effectiveTo=now;
  (cls.classTeacherHistory as any[]).push({teacherId:teacher._id,effectiveFrom:now,effectiveTo:null,assignedBy:actorId(actor)});
 }
 cls.classTeacherId=teacher._id;cls.updatedBy=actorId(actor);await cls.save();return cls.populate("classTeacherId","fullName employeeId designation");
}
export async function getOwnEmployeeProfile(userId:string,schoolId:string){
 const e=await Employee.findOne({userId:oid(userId,"user ID"),schoolId,isDeleted:false}).select("-salary -salaryHistory -panNumber -documents");
 if(!e)throw new AppError("Employee profile is not linked to this login account",404);
 return e;
}

export async function listDesignations(schoolId:string){return EmployeeDesignation.find({schoolId}).sort({name:1}).lean();}
export async function saveDesignation(schoolId:string,actor:string,data:any,id?:string){
 const filter:any={schoolId:oid(schoolId,"school ID")};
 if(id){const d=await EmployeeDesignation.findOneAndUpdate({_id:oid(id,"designation ID"),...filter},{name:data.name,code:data.code?.toUpperCase(),department:data.department,isActive:data.isActive!==false},{new:true,runValidators:true});if(!d)throw new AppError("Designation not found",404);return d;}
 try{return await EmployeeDesignation.create({...filter,...data,code:data.code.toUpperCase(),createdBy:actorId(actor)});}catch(e:any){if(e?.code===11000)throw new AppError("Designation name or code already exists",409);throw e;}
}

export async function listEmployeeAudit(id:string,schoolId:string){const e=await getEmployee(id,schoolId);return EmployeeAudit.find({schoolId,employeeId:e._id}).populate("performedBy","name email").sort({createdAt:-1}).limit(100).lean();}

export async function updateSubstitute(schoolId:string,id:string,data:any){
 const item=await SubstituteAssignment.findOne({_id:oid(id,"substitute assignment ID"),schoolId:oid(schoolId,"school ID"),status:"ACTIVE"});
 if(!item)throw new AppError("Active substitute assignment not found",404);
 if(data.date){const date=new Date(data.date);if(Number.isNaN(date.getTime()))throw new AppError("Invalid substitute date",400);item.date=date;}
 if(data.period!==undefined)item.period=data.period;
 if(data.reason!==undefined)item.reason=data.reason;
 if(data.status!==undefined)item.status=data.status;
 if(item.status!=="ACTIVE"){await item.save();return item;}
 const teacherId=data.substituteTeacherId||item.substituteTeacherId.toString();
 const teacher=await Employee.findOne({_id:oid(teacherId,"substitute teacher ID"),schoolId:oid(schoolId,"school ID"),isDeleted:false,isActive:true,status:"ACTIVE",employeeType:"TEACHING"});
 if(!teacher)throw new AppError("Substitute teacher must be an active teaching employee",400);
 item.substituteTeacherId=teacher._id;
 if(item.period){
  const dayOfWeek=["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"][item.date.getDay()];
  const originalEntry=await Timetable.findOne({schoolId:item.schoolId,sessionId:item.sessionId,classId:item.classId,sectionId:item.sectionId,teacherId:item.regularTeacherId,dayOfWeek,periodNumber:item.period,isActive:true,isBreak:false}).select("startTime endTime").lean();
  if(!originalEntry)throw new AppError("Original teacher has no matching timetable entry for this date and period",400);
  const conflict=await Timetable.findOne({schoolId:item.schoolId,sessionId:item.sessionId,teacherId:teacher._id,dayOfWeek,isActive:true,isBreak:false,startTime:{$lt:originalEntry.endTime},endTime:{$gt:originalEntry.startTime}});
  if(conflict)throw new AppError("Substitute teacher has an overlapping timetable conflict",409);
  const duplicate=await SubstituteAssignment.findOne({_id:{$ne:item._id},schoolId:item.schoolId,date:item.date,period:item.period,substituteTeacherId:teacher._id,status:"ACTIVE"});
  if(duplicate)throw new AppError("Substitute teacher already has an active assignment for this date and period",409);
 }
 try{await item.save();}catch(error:any){if(error?.code===11000)throw new AppError("Substitute teacher already has an active assignment for this date and period",409);throw error;}return item;
}

export async function getEmployeeAttendanceSummary(id:string,schoolId:string){
 const e=await getEmployee(id,schoolId);
 const filter={schoolId:oid(schoolId,"school ID"),employeeId:e._id,attendanceType:"EMPLOYEE",isDeleted:false};
 const [byStatus,total,recent]=await Promise.all([
  Attendance.aggregate([{$match:filter},{$group:{_id:"$status",count:{$sum:1}}}]),
  Attendance.countDocuments(filter),
  Attendance.find(filter).sort({attendanceDate:-1}).limit(10).select("attendanceDate status checkInTime checkOutTime lateByMinutes").lean()
 ]);
 return {total,byStatus,recent};
}

export async function listClassTeachers(schoolId:string,sessionId?:string){
 const query:any={schoolId:oid(schoolId,"school ID"),isDeleted:false,classTeacherId:{$exists:true,$ne:null}};
 if(sessionId)query.sessionId=oid(sessionId,"session ID");
 return Class.find(query).populate("sessionId","name").populate("classTeacherId","fullName employeeId designation department").populate("classTeacherHistory.teacherId","fullName employeeId").sort({numericLevel:1,name:1}).lean();
}
