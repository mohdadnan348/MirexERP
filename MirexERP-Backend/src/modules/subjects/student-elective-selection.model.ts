import mongoose,{Schema,Types,Document} from "mongoose";
export interface IStudentElectiveSelection extends Document {
 schoolId:Types.ObjectId;sessionId:Types.ObjectId;studentId:Types.ObjectId;classId:Types.ObjectId;subjectId:Types.ObjectId;
 status:"ACTIVE"|"REMOVED";selectedAt:Date;selectedBy:Types.ObjectId;removedAt?:Date;removedBy?:Types.ObjectId;
}
const schema=new Schema<IStudentElectiveSelection>({
 schoolId:{type:Schema.Types.ObjectId,ref:"School",required:true,index:true},sessionId:{type:Schema.Types.ObjectId,ref:"Session",required:true,index:true},
 studentId:{type:Schema.Types.ObjectId,ref:"Student",required:true,index:true},classId:{type:Schema.Types.ObjectId,ref:"Class",required:true,index:true},
 subjectId:{type:Schema.Types.ObjectId,ref:"Subject",required:true,index:true},status:{type:String,enum:["ACTIVE","REMOVED"],default:"ACTIVE",index:true},
 selectedAt:{type:Date,default:Date.now},selectedBy:{type:Schema.Types.ObjectId,ref:"User",required:true},removedAt:Date,removedBy:{type:Schema.Types.ObjectId,ref:"User"}
},{timestamps:true,versionKey:false,collection:"student_elective_selections"});
schema.index({schoolId:1,sessionId:1,studentId:1,classId:1,subjectId:1},{unique:true,partialFilterExpression:{status:"ACTIVE"}});
schema.index({schoolId:1,sessionId:1,studentId:1,status:1});
export default mongoose.models.StudentElectiveSelection || mongoose.model<IStudentElectiveSelection>("StudentElectiveSelection",schema);
