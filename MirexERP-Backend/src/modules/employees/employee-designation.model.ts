import mongoose,{Schema,Types,Document,Model} from "mongoose";
export interface IEmployeeDesignation extends Document {schoolId:Types.ObjectId;name:string;code:string;department?:string;isActive:boolean;createdBy:Types.ObjectId;}
const schema=new Schema<IEmployeeDesignation>({schoolId:{type:Schema.Types.ObjectId,ref:"School",required:true,index:true},name:{type:String,required:true,trim:true,maxlength:100},code:{type:String,required:true,trim:true,uppercase:true,maxlength:20},department:{type:String,trim:true,maxlength:100},isActive:{type:Boolean,default:true},createdBy:{type:Schema.Types.ObjectId,ref:"User",required:true}},{timestamps:true,versionKey:false,collection:"employee_designations"});
schema.index({schoolId:1,code:1},{unique:true});schema.index({schoolId:1,name:1},{unique:true});
const EmployeeDesignation:Model<IEmployeeDesignation>=mongoose.models.EmployeeDesignation||mongoose.model<IEmployeeDesignation>("EmployeeDesignation",schema);export default EmployeeDesignation;
