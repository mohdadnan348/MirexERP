import mongoose from "mongoose";
import {connectDatabase,disconnectDatabase} from "../src/database/connection";

/**
 * One-time migration for the versioned timetable model.
 * Drops only the legacy unique slot index that prevented multiple draft/history versions.
 */
async function main(){
 await connectDatabase();
 const timetable=mongoose.connection.collection("timetables");
 const indexes=await timetable.indexes();
 const legacy=indexes.find((index:any)=>index.unique&&index.key?.schoolId===1&&index.key?.sessionId===1&&index.key?.classId===1&&index.key?.sectionId===1&&index.key?.dayOfWeek===1&&index.key?.periodNumber===1&&!index.key?.versionId);
 if(legacy?.name){await timetable.dropIndex(legacy.name);process.stdout.write(`Dropped legacy unique index ${legacy.name}\\n`);}
 await timetable.createIndex({schoolId:1,sessionId:1,classId:1,sectionId:1,dayOfWeek:1,periodNumber:1,versionId:1},{name:"timetable_version_slot_lookup"});
 const versions=mongoose.connection.collection("timetable_versions");
 await versions.createIndex({schoolId:1,sessionId:1,classId:1,sectionId:1,version:1},{unique:true,name:"timetable_version_sequence_unique"});
 await versions.createIndex({schoolId:1,sessionId:1,classId:1,sectionId:1,status:1},{unique:true,partialFilterExpression:{status:"PUBLISHED"},name:"timetable_one_published_version"});
 process.stdout.write("Timetable v2 indexes are ready.\\n");
}
main().catch(error=>{process.stderr.write(`${error instanceof Error?error.stack:String(error)}\\n`);process.exitCode=1;}).finally(async()=>{await disconnectDatabase();});
