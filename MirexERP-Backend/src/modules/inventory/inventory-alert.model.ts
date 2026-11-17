import { Schema, model, models } from "mongoose";
const schema=new Schema({schoolId:{type:Schema.Types.ObjectId,ref:"School",required:true,index:true},itemId:{type:Schema.Types.ObjectId,ref:"InventoryItem",required:true},status:{type:String,enum:["OPEN","RESOLVED"],default:"OPEN",index:true},availableQuantity:{type:Number,required:true,min:0},minimumStockLevel:{type:Number,required:true,min:0},openedAt:{type:Date,default:Date.now},resolvedAt:Date,communicationId:{type:Schema.Types.ObjectId,ref:"Communication"}},{timestamps:true});
schema.index({schoolId:1,itemId:1,status:1},{unique:true,partialFilterExpression:{status:"OPEN"}});
export const InventoryLowStockAlert=models.InventoryLowStockAlert||model("InventoryLowStockAlert",schema);
