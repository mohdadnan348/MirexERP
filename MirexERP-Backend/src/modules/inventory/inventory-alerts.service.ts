import { Types } from "mongoose";
import { InventoryLowStockAlert } from "./inventory-alert.model";
import UserModel from "../auth/auth.model";
import { create as createCommunication, publish as publishCommunication } from "../communication/communication.service";

export async function syncInventoryLowStockAlert(item:any, actor:{schoolId:string;userId:string}) {
  try {
    const schoolId=new Types.ObjectId(actor.schoolId);
    const low=Number(item.availableQuantity)<=Number(item.minimumStockLevel);
    const open=await InventoryLowStockAlert.findOne({schoolId,itemId:item._id,status:"OPEN"});
    if(!low){if(open){open.status="RESOLVED";open.resolvedAt=new Date();await open.save();}return null;}
    if(open){open.availableQuantity=Number(item.availableQuantity);open.minimumStockLevel=Number(item.minimumStockLevel);await open.save();return open;}
    const alert=await InventoryLowStockAlert.create({schoolId,itemId:item._id,status:"OPEN",availableQuantity:Number(item.availableQuantity),minimumStockLevel:Number(item.minimumStockLevel)});
    const recipients=await UserModel.find({schoolId,role:"INVENTORY_MANAGER",isActive:true,isDeleted:false}).select("_id").lean();
    if(recipients.length){try{const communication=await createCommunication({schoolId:actor.schoolId},{title:`Low stock: ${item.name}`,message:`Available stock for ${item.name} (${item.itemCode}) is ${item.availableQuantity}, at or below the configured minimum of ${item.minimumStockLevel}. Please review replenishment.`,type:"NOTICE",audiences:["INDIVIDUAL"],recipientIds:recipients.map((x:any)=>String(x._id)),channels:["IN_APP"],priority:"HIGH"},actor.userId);const published=await publishCommunication({schoolId:actor.schoolId},String(communication._id),actor.userId);alert.communicationId=published._id;await alert.save();}catch{/* keep the alert visible if delivery queueing fails */}}
    return alert;
  } catch {
    // Stock movements must not be rolled back because an optional alert service is unavailable.
    return null;
  }
}
