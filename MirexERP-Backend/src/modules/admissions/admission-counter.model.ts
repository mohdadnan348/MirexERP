import mongoose,{Schema,Types} from "mongoose";
const schema=new Schema({schoolId:{type:Schema.Types.ObjectId,ref:"School",required:true},year:{type:Number,required:true},sequence:{type:Number,default:0}},{timestamps:true});
schema.index({schoolId:1,year:1},{unique:true});
export default mongoose.models.AdmissionCounter || mongoose.model("AdmissionCounter",schema);
