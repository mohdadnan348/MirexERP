import mongoose, { Schema, Types, Model, Document } from "mongoose";
export interface IEmployeeDepartment extends Document { schoolId: Types.ObjectId; name: string; code: string; description?: string; isActive: boolean; createdBy: Types.ObjectId; }
const schema = new Schema<IEmployeeDepartment>({ schoolId:{type:Schema.Types.ObjectId,ref:"School",required:true,index:true}, name:{type:String,required:true,trim:true,maxlength:100}, code:{type:String,required:true,trim:true,uppercase:true,maxlength:20}, description:{type:String,trim:true,maxlength:500}, isActive:{type:Boolean,default:true}, createdBy:{type:Schema.Types.ObjectId,ref:"User",required:true} },{timestamps:true,versionKey:false,collection:"employee_departments"});
schema.index({schoolId:1,code:1},{unique:true});
schema.index({schoolId:1,name:1},{unique:true});
const EmployeeDepartment:Model<IEmployeeDepartment>=mongoose.models.EmployeeDepartment||mongoose.model<IEmployeeDepartment>("EmployeeDepartment",schema);
export default EmployeeDepartment;
