import mongoose,{Schema,Types,Document,Model} from "mongoose";
export interface IEmployeeAudit extends Document {schoolId:Types.ObjectId;employeeId:Types.ObjectId;action:string;changedFields:string[];performedBy:Types.ObjectId;details?:string;createdAt:Date;}
const schema=new Schema<IEmployeeAudit>({schoolId:{type:Schema.Types.ObjectId,ref:"School",required:true,index:true},employeeId:{type:Schema.Types.ObjectId,ref:"Employee",required:true,index:true},action:{type:String,required:true,trim:true,maxlength:80},changedFields:{type:[String],default:[]},performedBy:{type:Schema.Types.ObjectId,ref:"User",required:true},details:{type:String,trim:true,maxlength:500}},{timestamps:{createdAt:true,updatedAt:false},versionKey:false,collection:"employee_audit_logs"});
schema.index({schoolId:1,employeeId:1,createdAt:-1});
const EmployeeAudit:Model<IEmployeeAudit>=mongoose.models.EmployeeAudit||mongoose.model<IEmployeeAudit>("EmployeeAudit",schema);export default EmployeeAudit;
