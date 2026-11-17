import mongoose, { Schema, Types } from "mongoose";
export interface IEnquiry extends mongoose.Document {
  schoolId: Types.ObjectId; sessionId: Types.ObjectId; childName: string; dateOfBirth?: Date;
  classSought?: Types.ObjectId; parentName: string; parentPhone: string; source: string; notes?: string;
  status: string; assignedTo?: Types.ObjectId; followUps: Array<{date: Date; time?: string; notes: string; status: string; assignedTo?: Types.ObjectId; completedAt?: Date; createdBy: Types.ObjectId}>;
  convertedApplicationId?: Types.ObjectId; isDeleted: boolean; createdBy: Types.ObjectId; updatedBy?: Types.ObjectId;
}
const FollowUp = new Schema({date:{type:Date,required:true},time:String,notes:{type:String,required:true,maxlength:1000},status:{type:String,enum:["SCHEDULED","COMPLETED","CANCELLED"],default:"SCHEDULED"},assignedTo:{type:Schema.Types.ObjectId,ref:"User"},completedAt:Date,createdBy:{type:Schema.Types.ObjectId,ref:"User",required:true}},{timestamps:true});
const schema = new Schema<IEnquiry>({
 schoolId:{type:Schema.Types.ObjectId,ref:"School",required:true,index:true},sessionId:{type:Schema.Types.ObjectId,ref:"Session",required:true,index:true},
 childName:{type:String,required:true,trim:true,maxlength:150},dateOfBirth:Date,classSought:{type:Schema.Types.ObjectId,ref:"Class"},
 parentName:{type:String,required:true,trim:true,maxlength:150},parentPhone:{type:String,required:true,trim:true},
 source:{type:String,required:true,trim:true,default:"Other"},notes:{type:String,trim:true,maxlength:2000},
 status:{type:String,enum:["NEW","CONTACTED","INTERESTED","CONVERTED","CLOSED"],default:"NEW",index:true},assignedTo:{type:Schema.Types.ObjectId,ref:"User"},
 followUps:{type:[FollowUp],default:[]},convertedApplicationId:{type:Schema.Types.ObjectId,ref:"Admission"},
 isDeleted:{type:Boolean,default:false,index:true},createdBy:{type:Schema.Types.ObjectId,ref:"User",required:true},updatedBy:{type:Schema.Types.ObjectId,ref:"User"}
},{timestamps:true});
schema.index({schoolId:1,sessionId:1,status:1,createdAt:-1});
schema.index({schoolId:1,parentPhone:1});
schema.index({schoolId:1,childName:1,dateOfBirth:1});
export default mongoose.models.AdmissionEnquiry || mongoose.model<IEnquiry>("AdmissionEnquiry",schema);
