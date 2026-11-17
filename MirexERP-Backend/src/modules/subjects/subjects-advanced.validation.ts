import { z } from "zod";
const id=z.string().regex(/^[0-9a-fA-F]{24}$/);
export const mappingSchema=z.object({sessionId:id,classId:id,subjectId:id,requirement:z.enum(["COMPULSORY","ELECTIVE","ACTIVITY"]),electiveLimit:z.coerce.number().int().min(1).max(30).optional(),effectiveFrom:z.coerce.date().optional()}).superRefine((v,c)=>{if(v.requirement==="ELECTIVE"&&!v.electiveLimit)c.addIssue({code:z.ZodIssueCode.custom,message:"Elective limit is required",path:["electiveLimit"]});});
export const teacherAssignmentSchema=z.object({sessionId:id,classId:id,sectionId:id.nullable().optional(),subjectId:id,teacherId:id});
export const electiveSchema=z.object({sessionId:id,classId:id,studentId:id,subjectIds:z.array(id).min(1).max(30)});
export const syllabusSchema=z.object({sessionId:id,classId:id,subjectId:id,title:z.string().trim().min(1).max(160),description:z.string().trim().max(2000).optional(),fileUrl:z.string().trim().max(500).optional(),fileName:z.string().trim().max(255).optional(),mimeType:z.string().trim().max(100).optional(),fileSize:z.coerce.number().int().nonnegative().max(15*1024*1024).optional()});
export const advancedFilters=z.object({sessionId:id.optional(),classId:id.optional(),subjectId:id.optional(),teacherId:id.optional(),sectionId:id.optional()});
export const advancedId=z.object({id});

export const updateSyllabusSchema=z.object({title:z.string().trim().min(1).max(160).optional(),description:z.string().trim().max(2000).nullable().optional(),fileUrl:z.string().trim().max(500).optional(),fileName:z.string().trim().max(255).optional(),mimeType:z.string().trim().max(100).optional(),fileSize:z.coerce.number().int().nonnegative().max(15*1024*1024).optional()}).refine(v=>Object.keys(v).length>0,{message:"At least one syllabus field is required"});
