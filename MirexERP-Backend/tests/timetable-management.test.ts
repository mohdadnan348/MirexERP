import test from "node:test";
import assert from "node:assert/strict";
import {createVersionSchema,periodSchema,roomSchema,conflictSchema} from "../src/modules/timetable/timetable-advanced.validation";
import {createTimetableSchema} from "../src/modules/timetable/timetable.validation";
const id="64b000000000000000000001";

test("timetable period definitions reject overlapping clock ranges",()=>{
 const valid=periodSchema.safeParse({body:{name:"Period 1",periodNumber:1,startTime:"08:00",endTime:"08:45",type:"REGULAR"}});
 const invalid=periodSchema.safeParse({body:{name:"Period 1",periodNumber:1,startTime:"09:00",endTime:"08:45",type:"REGULAR"}});
 assert.equal(valid.success,true);assert.equal(invalid.success,false);
});

test("timetable entry rejects an end time before its start time",()=>{
 const valid=createTimetableSchema.safeParse({body:{sessionId:id,classId:id,sectionId:id,dayOfWeek:"MONDAY",periodNumber:1,startTime:"08:00",endTime:"08:45",subjectId:id,teacherId:id}});
 const invalid=createTimetableSchema.safeParse({body:{sessionId:id,classId:id,sectionId:id,dayOfWeek:"MONDAY",periodNumber:1,startTime:"09:00",endTime:"08:45",subjectId:id,teacherId:id}});
 assert.equal(valid.success,true);assert.equal(invalid.success,false);
});

test("version creation requires entries and valid section/session identifiers",()=>{
 const result=createVersionSchema.safeParse({body:{sessionId:id,classId:id,sectionId:id,entries:[{dayOfWeek:"MONDAY",periodNumber:1,startTime:"08:00",endTime:"08:45",subjectId:id,teacherId:id}]}});
 assert.equal(result.success,true);
});

test("break entries require a name and cannot omit their time bounds",()=>{
 const valid=createTimetableSchema.safeParse({body:{sessionId:id,classId:id,sectionId:id,dayOfWeek:"MONDAY",periodNumber:1,startTime:"10:00",endTime:"10:15",isBreak:true,breakName:"Morning Break"}});
 const invalid=createTimetableSchema.safeParse({body:{sessionId:id,classId:id,sectionId:id,dayOfWeek:"MONDAY",periodNumber:1,startTime:"10:00",endTime:"10:15",isBreak:true}});
 assert.equal(valid.success,true);assert.equal(invalid.success,false);
});

test("room management requires a school room number and valid type",()=>{
 const valid=roomSchema.safeParse({body:{name:"Science Lab",roomNumber:"LAB-01",roomType:"SCIENCE_LAB",capacity:35}});
 const invalid=roomSchema.safeParse({body:{name:"Science Lab",roomNumber:"",roomType:"UNKNOWN"}});
 assert.equal(valid.success,true);assert.equal(invalid.success,false);
});

test("conflict-check request is scoped to a valid academic session and entries",()=>{
 const result=conflictSchema.safeParse({body:{sessionId:id,entries:[{dayOfWeek:"MONDAY",periodNumber:1,startTime:"08:00",endTime:"08:45",subjectId:id,teacherId:id}]}});
 assert.equal(result.success,true);
});
