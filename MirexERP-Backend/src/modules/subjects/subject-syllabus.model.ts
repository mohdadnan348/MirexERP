import mongoose,{Schema,Types,Document} from "mongoose";
export interface ISubjectSyllabus extends Document {
 schoolId:Types.ObjectId;sessionId:Types.ObjectId;classId:Types.ObjectId;subjectId:Types.ObjectId;title:string;description?:string;
 fileUrl?:string;fileName?:string;mimeType?:string;fileSize?:number;uploadedBy:Types.ObjectId;isDeleted:boolean;createdAt:Date;updatedAt:Date;
}
const schema=new Schema<ISubjectSyllabus>({
 schoolId:{type:Schema.Types.ObjectId,ref:"School",required:true,index:true},sessionId:{type:Schema.Types.ObjectId,ref:"Session",required:true,index:true},
 classId:{type:Schema.Types.ObjectId,ref:"Class",required:true,index:true},subjectId:{type:Schema.Types.ObjectId,ref:"Subject",required:true,index:true},
 title:{type:String,required:true,trim:true,maxlength:160},description:{type:String,trim:true,maxlength:2000},
 fileUrl:{type:String,trim:true},fileName:{type:String,trim:true,maxlength:255},mimeType:{type:String,trim:true},fileSize:{type:Number,min:0},
 uploadedBy:{type:Schema.Types.ObjectId,ref:"User",required:true},isDeleted:{type:Boolean,default:false,index:true}
},{timestamps:true,versionKey:false,collection:"subject_syllabi"});
schema.index({schoolId:1,sessionId:1,classId:1,subjectId:1,isDeleted:1});
export default mongoose.models.SubjectSyllabus || mongoose.model<ISubjectSyllabus>("SubjectSyllabus",schema);
