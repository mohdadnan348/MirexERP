import mongoose, { Schema, Types, Document } from "mongoose";
export interface IClassSubjectMapping extends Document {
 schoolId: Types.ObjectId; sessionId: Types.ObjectId; classId: Types.ObjectId; subjectId: Types.ObjectId;
 requirement: "COMPULSORY"|"ELECTIVE"|"ACTIVITY"; electiveLimit?: number; effectiveFrom: Date;
 isActive: boolean; createdBy: Types.ObjectId; updatedBy?: Types.ObjectId; createdAt: Date; updatedAt: Date;
}
const schema=new Schema<IClassSubjectMapping>({
 schoolId:{type:Schema.Types.ObjectId,ref:"School",required:true,index:true},
 sessionId:{type:Schema.Types.ObjectId,ref:"Session",required:true,index:true},
 classId:{type:Schema.Types.ObjectId,ref:"Class",required:true,index:true},
 subjectId:{type:Schema.Types.ObjectId,ref:"Subject",required:true,index:true},
 requirement:{type:String,enum:["COMPULSORY","ELECTIVE","ACTIVITY"],default:"COMPULSORY",required:true},
 electiveLimit:{type:Number,min:1,max:30},
 effectiveFrom:{type:Date,default:Date.now,required:true},
 isActive:{type:Boolean,default:true,index:true},
 createdBy:{type:Schema.Types.ObjectId,ref:"User",required:true},
 updatedBy:{type:Schema.Types.ObjectId,ref:"User"}
},{timestamps:true,versionKey:false,collection:"class_subject_mappings"});
schema.index({schoolId:1,sessionId:1,classId:1,subjectId:1},{unique:true});
schema.index({schoolId:1,sessionId:1,classId:1,isActive:1});
export default mongoose.models.ClassSubjectMapping || mongoose.model<IClassSubjectMapping>("ClassSubjectMapping",schema);
