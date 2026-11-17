import mongoose, { Document, Schema, Types } from "mongoose";

export type TimetableSlotType = "REGULAR" | "BREAK" | "LUNCH" | "ASSEMBLY" | "ACTIVITY" | "OTHER";
export interface ITimetablePeriod extends Document {
  schoolId: Types.ObjectId; sessionId?: Types.ObjectId | null; name: string; periodNumber: number;
  startTime: string; endTime: string; type: TimetableSlotType; applicableDays: string[]; isActive: boolean;
  createdBy: Types.ObjectId; updatedBy?: Types.ObjectId;
}
const schema = new Schema<ITimetablePeriod>({
  schoolId:{type:Schema.Types.ObjectId,ref:"School",required:true,index:true},
  sessionId:{type:Schema.Types.ObjectId,ref:"Session",default:null},
  name:{type:String,required:true,trim:true,maxlength:60},
  periodNumber:{type:Number,required:true,min:1},
  startTime:{type:String,required:true,match:/^([01]\d|2[0-3]):[0-5]\d$/},
  endTime:{type:String,required:true,match:/^([01]\d|2[0-3]):[0-5]\d$/},
  type:{type:String,enum:["REGULAR","BREAK","LUNCH","ASSEMBLY","ACTIVITY","OTHER"],default:"REGULAR"},
  applicableDays:{type:[String],default:["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"]},
  isActive:{type:Boolean,default:true},createdBy:{type:Schema.Types.ObjectId,ref:"User",required:true},updatedBy:{type:Schema.Types.ObjectId,ref:"User"}
},{timestamps:true,versionKey:false,collection:"timetable_periods"});
schema.index({schoolId:1,sessionId:1,periodNumber:1,applicableDays:1});
schema.pre("validate",function(){const m=(v:string)=>{const [h,n]=v.split(":").map(Number);return h*60+n;};if(m(this.endTime)<=m(this.startTime))this.invalidate("endTime","End time must be after start time");});
export default mongoose.models.TimetablePeriod || mongoose.model<ITimetablePeriod>("TimetablePeriod",schema);
