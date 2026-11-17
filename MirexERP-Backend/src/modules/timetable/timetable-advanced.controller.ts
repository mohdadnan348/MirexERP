import {Request,Response} from "express";
import {asyncHandler} from "../../utils/asyncHandler";
import {AppError} from "../../utils/AppError";
import {sendCreated,sendSuccess,sendDeleted} from "../../utils/apiResponse";
import * as service from "./timetable-advanced.service";
import {generateAndSendPdf} from "../../utils/pdf";
import Employee from "../employees/employees.model";
const actor=(req:Request)=>{if(!req.user?.id||!req.user.schoolId)throw new AppError("Authenticated school user not found",401);return {userId:req.user.id,schoolId:req.user.schoolId};};
const id=(req:Request)=>{const v=req.params.id;if(typeof v!=="string")throw new AppError("Valid ID is required",400);return v;};
export const createVersion=asyncHandler(async(req:Request,res:Response)=>sendCreated(res,"Draft timetable version created",await service.createTimetableVersion(actor(req),req.body)));
export const publishVersion=asyncHandler(async(req:Request,res:Response)=>sendSuccess(res,"Timetable version published",await service.publishTimetableVersion(actor(req),id(req))));
export const archiveVersion=asyncHandler(async(req:Request,res:Response)=>sendSuccess(res,"Timetable version archived",await service.archiveTimetableVersion(actor(req),id(req))));
export const versionHistory=asyncHandler(async(req:Request,res:Response)=>sendSuccess(res,"Timetable version history fetched",await service.getTimetableVersionHistory(actor(req).schoolId,id(req))));
export const getPeriods=asyncHandler(async(req:Request,res:Response)=>sendSuccess(res,"Timetable periods fetched",await service.listPeriods(actor(req).schoolId,typeof req.query.sessionId==="string"?req.query.sessionId:undefined)));
export const createPeriod=asyncHandler(async(req:Request,res:Response)=>sendCreated(res,"Timetable period created",await service.savePeriod(actor(req),req.body)));
export const updatePeriod=asyncHandler(async(req:Request,res:Response)=>sendSuccess(res,"Timetable period updated",await service.savePeriod(actor(req),req.body,id(req))));
export const deletePeriod=asyncHandler(async(req:Request,res:Response)=>{await service.removePeriod(actor(req).schoolId,id(req));return sendDeleted(res,"Timetable period deactivated");});
export const getRooms=asyncHandler(async(req:Request,res:Response)=>sendSuccess(res,"Timetable rooms fetched",await service.listRooms(actor(req).schoolId)));
export const createRoom=asyncHandler(async(req:Request,res:Response)=>sendCreated(res,"Timetable room created",await service.saveRoom(actor(req),req.body)));
export const updateRoom=asyncHandler(async(req:Request,res:Response)=>sendSuccess(res,"Timetable room updated",await service.saveRoom(actor(req),req.body,id(req))));
export const deleteRoom=asyncHandler(async(req:Request,res:Response)=>{await service.removeRoom(actor(req).schoolId,id(req));return sendDeleted(res,"Timetable room deactivated");});
export const checkConflicts=asyncHandler(async(req:Request,res:Response)=>sendSuccess(res,"Timetable conflict check completed",await service.checkTimetableConflicts(actor(req).schoolId,req.body,actor(req).userId)));

export const printVersion=asyncHandler(async(req:Request,res:Response)=>{
 const currentActor=actor(req);const data=await service.getVersionForPrint(currentActor.schoolId,id(req));
 if(req.user?.role==="TEACHER"){
  const employee=await Employee.findOne({schoolId:currentActor.schoolId,userId:currentActor.userId,isActive:true,isDeleted:false}).select("_id").lean();
  if(!employee||data.entries.some((e:any)=>String(e.teacherId?._id||e.teacherId)!==employee._id.toString()))throw new AppError("You can only print timetable versions containing your own assigned periods",403);
 }
 const v:any=data.version;const school:any=v.schoolId;const session:any=v.sessionId;const cls:any=v.classId;const section:any=v.sectionId;
 return generateAndSendPdf(res,doc=>{
  doc.fontSize(18).font("Helvetica-Bold").text(school?.name||"MIREX ERP SCHOOL",{align:"center"});
  doc.moveDown(0.3);doc.fontSize(14).text("CLASS TIMETABLE",{align:"center"});doc.moveDown(0.4);
  doc.fontSize(10).font("Helvetica").text(`Academic Session: ${session?.name||"—"}     Class: ${cls?.name||"—"}     Section: ${section?.name||"—"}`);
  doc.text(`Version: ${v.version}     Status: ${v.status}     Published: ${v.publishedAt?new Date(v.publishedAt).toLocaleDateString():"Not published"}`);doc.moveDown();
  const days=["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];
  const periods=Array.from(new Set(data.entries.map((e:any)=>e.periodNumber))).sort((a:any,b:any)=>a-b);
  const left=36,top=doc.y,width=doc.page.width-72,periodW=44,timeW=82,dayW=(width-periodW-timeW)/7,rowH=42;
  const cell=(x:number,y:number,w:number,h:number,text:string,bold=false)=>{doc.rect(x,y,w,h).strokeColor("#b9b2c5").stroke();doc.font(bold?"Helvetica-Bold":"Helvetica").fontSize(7).fillColor("#282334").text(text,x+3,y+4,{width:w-6,height:h-7,ellipsis:true});};
  let y=top;cell(left,y,periodW,28,"Period",true);cell(left+periodW,y,timeW,28,"Time",true);days.forEach((d,i)=>cell(left+periodW+timeW+i*dayW,y,dayW,28,d.slice(0,3),true));y+=28;
  periods.forEach((p:any)=>{const row=data.entries.filter((e:any)=>e.periodNumber===p);const first=row[0];if(y+rowH>doc.page.height-48){doc.addPage({layout:"landscape",size:"A4",margins:{top:36,bottom:36,left:36,right:36}});y=36;}cell(left,y,periodW,rowH,String(p),true);cell(left+periodW,y,timeW,rowH,first?`${first.startTime}-${first.endTime}`:"—");days.forEach((d,i)=>{const e=row.find((x:any)=>x.dayOfWeek===d);let content="—";if(e){content=e.isBreak?(e.breakName||"BREAK"):`${e.subjectId?.name||"Subject"}\n${e.teacherId?.fullName||[e.teacherId?.firstName,e.teacherId?.lastName].filter(Boolean).join(" ")||"Teacher"}\n${e.roomId?.roomNumber||e.roomNumber||""}`;}cell(left+periodW+timeW+i*dayW,y,dayW,rowH,content,!!e?.isBreak);});y+=rowH;});
 },`timetable-version-${v.version}.pdf`,{title:"Class Timetable",pageSize:"A4",landscape:true,margins:{top:36,bottom:36,left:36,right:36}});
});
