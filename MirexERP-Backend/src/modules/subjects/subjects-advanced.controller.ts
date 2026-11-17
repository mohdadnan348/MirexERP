import {Request,Response} from "express";
import {asyncHandler} from "../../utils/asyncHandler";
import {AppError} from "../../utils/AppError";
import {sendCreated,sendDeleted,sendSuccess} from "../../utils/apiResponse";
import {getValidatedData} from "../../middleware/validate";
import {getRelativeFilePath,deleteUploadedFile} from "../../utils/fileStorage";
import {env} from "../../config/env";
import path from "path";
import fs from "fs";
import * as service from "./subjects-advanced.service";
import {mappingSchema,teacherAssignmentSchema,electiveSchema,syllabusSchema,updateSyllabusSchema,advancedFilters,advancedId} from "./subjects-advanced.validation";
const actor=(req:Request)=>{if(!req.user?.userId||!req.user.schoolId)throw new AppError("Authenticated school user is required",401);return {userId:req.user.userId,schoolId:req.user.schoolId};};
export const subjectAdvancedSummary=asyncHandler(async(req:Request,res:Response)=>{const a=actor(req);const q=getValidatedData<{sessionId?:string;classId?:string}>(res,"query");return sendSuccess(res,"Subject summary fetched",await service.getSubjectAdvancedSummary(a.schoolId,q.sessionId,q.classId));});
export const subjectMappings=asyncHandler(async(req:Request,res:Response)=>{const a=actor(req);const q=getValidatedData<any>(res,"query");const rows=q.classId&&q.sessionId?await service.listSubjectsForClass(a.schoolId,q.sessionId,q.classId):await service.listMappings(a.schoolId,q);return sendSuccess(res,"Class subject mappings fetched",rows);});
export const createSubjectMapping=asyncHandler(async(req:Request,res:Response)=>{const item=await service.saveClassMapping(getValidatedData<any>(res,"body"),actor(req));return sendCreated(res,"Subject mapped to class",item);});
export const updateSubjectMapping=asyncHandler(async(req:Request,res:Response)=>{const a=actor(req);const params=getValidatedData<{id:string}>(res,"params");const item=await service.saveClassMapping(getValidatedData<any>(res,"body"),a,params.id);return sendSuccess(res,"Subject mapping updated",item);});
export const deleteSubjectMapping=asyncHandler(async(req:Request,res:Response)=>{const a=actor(req);const params=getValidatedData<{id:string}>(res,"params");await service.removeClassMapping(params.id,a);return sendDeleted(res,"Subject mapping removed");});
export const teacherAssignments=asyncHandler(async(req:Request,res:Response)=>{const a=actor(req);return sendSuccess(res,"Teacher assignments fetched",await service.listTeacherAssignments(a.schoolId,getValidatedData<any>(res,"query")));});
export const createTeacherAssignment=asyncHandler(async(req:Request,res:Response)=>{const item=await service.saveTeacherAssignment(getValidatedData<any>(res,"body"),actor(req));return sendCreated(res,"Teacher assigned to subject",item);});
export const updateTeacherAssignment=asyncHandler(async(req:Request,res:Response)=>{const a=actor(req);const params=getValidatedData<{id:string}>(res,"params");const item=await service.saveTeacherAssignment(getValidatedData<any>(res,"body"),a,params.id);return sendSuccess(res,"Teacher assignment updated",item);});
export const deleteTeacherAssignment=asyncHandler(async(req:Request,res:Response)=>{const a=actor(req);const params=getValidatedData<{id:string}>(res,"params");await service.removeTeacherAssignment(params.id,a);return sendDeleted(res,"Teacher assignment removed");});
export const availableElectives=asyncHandler(async(req:Request,res:Response)=>{const a=actor(req);const q=getValidatedData<any>(res,"query");return sendSuccess(res,"Available elective subjects fetched",await service.availableElectives(a.schoolId,q.sessionId,q.classId));});
export const studentElectives=asyncHandler(async(req:Request,res:Response)=>{const a=actor(req);const params=getValidatedData<{studentId:string}>(res,"params");const q=getValidatedData<any>(res,"query");return sendSuccess(res,"Student elective selections fetched",await service.getStudentElectives(a.schoolId,q.sessionId,params.studentId,q.classId));});
export const selectStudentElectives=asyncHandler(async(req:Request,res:Response)=>{const item=await service.selectElectives(getValidatedData<any>(res,"body"),actor(req));return sendSuccess(res,"Elective subjects selected",item);});
export const subjectSyllabi=asyncHandler(async(req:Request,res:Response)=>{const a=actor(req);return sendSuccess(res,"Syllabus records fetched",await service.listSyllabi(a.schoolId,getValidatedData<any>(res,"query")));});
export const createSubjectSyllabus=asyncHandler(async(req:Request,res:Response)=>{const item=await service.createSyllabus(getValidatedData<any>(res,"body"),actor(req));return sendCreated(res,"Syllabus record created",item);});
export const deleteSubjectSyllabus=asyncHandler(async(req:Request,res:Response)=>{const a=actor(req);const params=getValidatedData<{id:string}>(res,"params");await service.deleteSyllabus(params.id,a);return sendDeleted(res,"Syllabus record archived");});

export const uploadSubjectSyllabus=asyncHandler(async(req:Request,res:Response)=>{
 const a=actor(req); const file=(req as Request & {file?:Express.Multer.File}).file;
 if(!file)throw new AppError("Syllabus file is required",400);
 try{
  const body={...req.body,fileUrl:getRelativeFilePath(file.path),fileName:file.originalname,mimeType:file.mimetype,fileSize:file.size};
  const data=syllabusSchema.parse(body);
  const item=await service.createSyllabus(data,a);
  return sendCreated(res,"Syllabus uploaded successfully",item);
 }catch(error){await deleteUploadedFile(file.path);throw error;}
});
export const downloadSubjectSyllabus=asyncHandler(async(req:Request,res:Response)=>{
 const a=actor(req);const params=getValidatedData<{id:string}>(res,"params");
 const doc=await service.getSyllabusFileRecord(params.id,a.schoolId);
 if(!doc.fileUrl||/^https:\/\//i.test(doc.fileUrl))throw new AppError("This syllabus uses an external file URL",404);
 const root=path.resolve(process.cwd(),env.UPLOAD_DIR);const filePath=path.resolve(root,doc.fileUrl);
 if(!filePath.startsWith(`${root}${path.sep}`)||!fs.existsSync(filePath))throw new AppError("Syllabus file is unavailable",404);
 return res.download(filePath,doc.fileName||"syllabus");
});

export const subjectClassWiseReport=asyncHandler(async(req:Request,res:Response)=>{const a=actor(req);const q=getValidatedData<any>(res,"query");return sendSuccess(res,"Class-wise subject report fetched",await service.subjectClassWiseReport(a.schoolId,q.sessionId));});
export const subjectTeacherWiseReport=asyncHandler(async(req:Request,res:Response)=>{const a=actor(req);const q=getValidatedData<any>(res,"query");return sendSuccess(res,"Teacher-wise subject report fetched",await service.subjectTeacherWiseReport(a.schoolId,q.sessionId));});

export const removeStudentElective=asyncHandler(async(req:Request,res:Response)=>{const a=actor(req);const params=getValidatedData<{id:string}>(res,"params");await service.removeStudentElectiveSelection(params.id,a);return sendDeleted(res,"Elective selection removed; historical selection retained");});

export const myTeacherSubjectAssignments=asyncHandler(async(req:Request,res:Response)=>{return sendSuccess(res,"Your subject assignments fetched",await service.getMyTeacherSubjectAssignments(actor(req)));});

export const updateSubjectSyllabus=asyncHandler(async(req:Request,res:Response)=>{const a=actor(req);const params=getValidatedData<{id:string}>(res,"params");const item=await service.updateSyllabus(params.id,getValidatedData<any>(res,"body"),a);return sendSuccess(res,"Syllabus updated successfully",item);});
export const replaceSubjectSyllabusFile=asyncHandler(async(req:Request,res:Response)=>{
 const a=actor(req);const params=getValidatedData<{id:string}>(res,"params");const file=(req as Request & {file?:Express.Multer.File}).file;
 if(!file)throw new AppError("Replacement syllabus file is required",400);
 try{const item=await service.updateSyllabus(params.id,{fileUrl:getRelativeFilePath(file.path),fileName:file.originalname,mimeType:file.mimetype,fileSize:file.size},a);return sendSuccess(res,"Syllabus file replaced successfully",item);}
 catch(error){await deleteUploadedFile(file.path);throw error;}
});

export const myTeacherSyllabi=asyncHandler(async(req:Request,res:Response)=>{return sendSuccess(res,"Your subject syllabi fetched",await service.getMyTeacherSyllabi(actor(req)));});
