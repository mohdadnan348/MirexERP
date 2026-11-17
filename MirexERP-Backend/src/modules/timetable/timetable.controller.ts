
import { Request, Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import Employee from "../employees/employees.model";
import Student from "../students/students.model";
import { Parent } from "../parents/parents.model";
import ParentChildRelationship from "../parents/parent-child-relationship.model";
import StudentPortal from "../student-portal/student-portal.model";
import Timetable from "./timetable.model";
import {SchoolSettings} from "../settings/settings.model";
import Holiday from "../holidays/holidays.model";
import {
  sendSuccess,
  sendCreated,
  sendPaginatedSuccess,
  sendDeleted,
} from "../../utils/apiResponse";

import {
  createTimetableService,
  getTimetablesService,
  getTimetableByIdService,
  updateTimetableService,
  deleteTimetableService,
  getClassTimetableService,
  getTeacherTimetableService,
  addSubstituteTeachers,
  getSubjectTimetableService,
  getSubstituteTeacherTimetableEntries,
} from "./timetable.service";

const getActor = (req: Request) => {
  if (!req.user?.id || !req.user.schoolId) {
    throw new AppError("Authenticated school user not found", 401);
  }

  return {
    userId: req.user.id,
    schoolId: req.user.schoolId,
    role: req.user.role,
  };
};

const getId = (req: Request): string => {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError("Valid timetable ID is required", 400);
  }

  return id;
};

/**
 * Create timetable
 * POST /api/timetable
 */
export const createTimetable = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const timetable = await createTimetableService(
      actor,
      req.body
    );

    return sendCreated(
      res,
      "Timetable created successfully",
      timetable
    );
  }
);

/**
 * Get all timetables
 * GET /api/timetable
 */
export const getTimetables = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const page = Math.max(
      1,
      Number(req.query.page) || 1
    );

    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 10)
    );

    let teacherId: string | undefined;
    if (actor.role === "TEACHER") {
      const employee = await Employee.findOne({ schoolId: actor.schoolId, userId: actor.userId, isActive: true, isDeleted: false, employeeType: "TEACHING" }).select("_id").lean();
      if (!employee) throw new AppError("Teacher profile is not linked to this account", 403);
      teacherId = employee._id.toString();
    }
    const result = await getTimetablesService(
      actor.schoolId,
      {
        teacherId,
        page,
        limit,
        classId:
          typeof req.query.classId === "string"
            ? req.query.classId
            : undefined,
        sectionId:
          typeof req.query.sectionId === "string"
            ? req.query.sectionId
            : undefined,
        sessionId:
          typeof req.query.sessionId === "string"
            ? req.query.sessionId
            : undefined,
        dayOfWeek:
          typeof req.query.dayOfWeek === "string"
            ? req.query.dayOfWeek
            : undefined,
        date: typeof req.query.date === "string" ? req.query.date : undefined,
      }
    );

    const items = Array.isArray(result)
      ? result
      : result.items;

    const total = Array.isArray(result)
      ? result.length
      : result.total;

    const totalPages = Math.ceil(total / limit);

    return sendPaginatedSuccess(
      res,
      "Timetables fetched successfully",
      items,
      {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      }
    );
  }
);

/**
 * Get timetable by ID
 * GET /api/timetable/:id
 */
export const getTimetableById = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const timetable = await getTimetableByIdService(actor.schoolId, getId(req));
    if (actor.role === "TEACHER") {
      const employee = await Employee.findOne({ schoolId: actor.schoolId, userId: actor.userId, isActive: true, isDeleted: false }).select("_id").lean();
      if (!employee || String((timetable as any).teacherId?._id || (timetable as any).teacherId) !== employee._id.toString()) throw new AppError("You can only view your own timetable entries", 403);
    }

    return sendSuccess(
      res,
      "Timetable fetched successfully",
      timetable
    );
  }
);

/**
 * Update timetable
 * PATCH /api/timetable/:id
 */
export const updateTimetable = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const timetable = await updateTimetableService(
      actor.schoolId,
      getId(req),
      {
        ...req.body,
        updatedBy: actor.userId,
      }
    );

    return sendSuccess(
      res,
      "Timetable updated successfully",
      timetable
    );
  }
);

/**
 * Delete timetable
 * DELETE /api/timetable/:id
 */
export const deleteTimetable = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    await deleteTimetableService(
      actor.schoolId,
      getId(req)
    );

    return sendDeleted(
      res,
      "Timetable deleted successfully"
    );
  }
);

/**
 * Get class timetable
 * GET /api/timetable/class/:classId
 */
export const getClassTimetable = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const classId = req.params.classId;

    if (typeof classId !== "string" || !classId.trim()) {
      throw new AppError("Valid class ID is required", 400);
    }

    let timetable = await getClassTimetableService(
      actor.schoolId, classId,
      typeof req.query.sectionId === "string" ? req.query.sectionId : undefined,
      typeof req.query.sessionId === "string" ? req.query.sessionId : undefined,
      typeof req.query.date === "string" ? req.query.date : undefined
    );
    if (actor.role === "TEACHER") {
      const employee = await Employee.findOne({ schoolId: actor.schoolId, userId: actor.userId, isActive: true, isDeleted: false }).select("_id").lean();
      if (!employee) throw new AppError("Teacher profile is not linked to this account", 403);
      timetable = timetable.filter((item: any) => String(item.teacherId?._id || item.teacherId) === employee._id.toString());
    }

    return sendSuccess(
      res,
      "Class timetable fetched successfully",
      timetable
    );
  }
);

/**
 * Get teacher timetable
 * GET /api/timetable/teacher/:teacherId
 */
export const getTeacherTimetable = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const teacherId = req.params.teacherId;

    if (
      typeof teacherId !== "string" ||
      !teacherId.trim()
    ) {
      throw new AppError("Valid teacher ID is required", 400);
    }

    if (actor.role === "TEACHER") {
      const employee = await Employee.findOne({ schoolId: actor.schoolId, userId: actor.userId, isActive: true, isDeleted: false }).select("_id").lean();
      if (!employee || employee._id.toString() !== teacherId) throw new AppError("You can only view your own timetable", 403);
    }
    const timetable = await getTeacherTimetableService(actor.schoolId, teacherId, typeof req.query.dayOfWeek === "string" ? req.query.dayOfWeek : undefined);

    return sendSuccess(
      res,
      "Teacher timetable fetched successfully",
      timetable
    );
  }
);


/** Authenticated role-scoped timetable endpoint used by Expo. */
export const getMyTimetable = asyncHandler(async (req: Request, res: Response) => {
  const actor = getActor(req);
  let filter: Record<string, unknown> = { schoolId: actor.schoolId, isActive: true };
  if (actor.role === "TEACHER") {
    const employee = await Employee.findOne({ schoolId: actor.schoolId, userId: actor.userId, isActive: true, isDeleted: false, employeeType: "TEACHING" }).select("_id").lean();
    if (!employee) throw new AppError("Teacher profile is not linked to this account", 403);
    filter.teacherId = employee._id;
  } else if (actor.role === "STUDENT") {
    let portal = await StudentPortal.findOne({ schoolId: actor.schoolId, userId: actor.userId }).select("studentId").lean();
    if (!portal && req.user?.email) {
      const linkedStudents = await Student.find({ email: String(req.user.email).toLowerCase(), schoolId: actor.schoolId, isDeleted: false, isActive: true, status: "ACTIVE" }).select("_id").limit(2).lean();
      if (linkedStudents.length === 1) {
        portal = await StudentPortal.findOneAndUpdate({ schoolId: actor.schoolId, studentId: linkedStudents[0]._id }, { $set: { userId: actor.userId } }, { new: true, upsert: true, setDefaultsOnInsert: true }).select("studentId").lean() as any;
      }
    }
    if (!portal?.studentId) throw new AppError("Student portal login is not linked to a student record", 403);
    const student = await Student.findOne({ _id: portal.studentId, schoolId: actor.schoolId, isDeleted: false, isActive: true, status: "ACTIVE" }).select("classId sectionId sessionId").lean();
    if (!student) throw new AppError("Student profile is not active", 403);
    filter.classId = student.classId; filter.sectionId = student.sectionId;
    if (typeof req.query.sessionId === "string" && req.query.sessionId !== String(student.sessionId)) throw new AppError("Students can only view their linked academic session", 403);
    filter.sessionId = student.sessionId;
  } else if (actor.role === "PARENT") {
    const parent = await Parent.findOne({ schoolId: actor.schoolId, userId: actor.userId, isActive: true }).select("_id studentIds").lean();
    if (!parent) throw new AppError("Parent profile is not linked to this account", 403);
    const childId = typeof req.query.childId === "string" ? req.query.childId : "";
    if (!childId || !Types.ObjectId.isValid(childId)) throw new AppError("Select a valid child linked to your parent account", 403);
    const mapping = await ParentChildRelationship.findOne({ schoolId: actor.schoolId, parentId: parent._id, studentId: childId }).select("status permissions").lean();
    const permitted = mapping
      ? mapping.status === "ACTIVE" && mapping.permissions?.timetable === true
      : parent.studentIds.some((id: any) => id.toString() === childId);
    if (!permitted) throw new AppError("You do not have timetable access for this child", 403);
    const child = await Student.findOne({ _id: childId, schoolId: actor.schoolId, isDeleted: false, isActive: true }).select("classId sectionId sessionId").lean();
    if (!child) throw new AppError("Linked student not found", 404);
    filter.classId = child.classId; filter.sectionId = child.sectionId;
    if (typeof req.query.sessionId === "string" && req.query.sessionId !== String(child.sessionId)) throw new AppError("You can only view the child's linked academic session", 403);
    filter.sessionId = child.sessionId;
  } else throw new AppError("Your role cannot access this timetable endpoint", 403);
  const schoolSettings = await SchoolSettings.findOne({schoolId:actor.schoolId}).select("academic.currentSessionId").lean();
  const sessionId = filter.sessionId || (typeof req.query.sessionId === "string" ? req.query.sessionId : schoolSettings?.academic?.currentSessionId?.toString());
  if (!sessionId) throw new AppError("Select an academic session to view the timetable", 400);
  filter.sessionId = sessionId;
  let holidayName: string | undefined;
  if (typeof req.query.date === "string") {
    const date = new Date(`${req.query.date}T12:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw new AppError("Invalid timetable date", 400);
    const start = new Date(date); start.setUTCHours(0,0,0,0); const end = new Date(date); end.setUTCHours(23,59,59,999);
    const holiday = await Holiday.findOne({schoolId:actor.schoolId,sessionId,isActive:true,isDeleted:false,startDate:{$lte:end},endDate:{$gte:start},applicableTo:actor.role==="TEACHER"?{$in:["EMPLOYEES","BOTH"]}:{$in:["STUDENTS","BOTH"]}}).select("name holidayType").lean();
    holidayName = holiday?.name;
  }
  const items = await Timetable.find(filter).populate("classId", "name code").populate("sectionId", "name code").populate("subjectId", "name code").populate("teacherId", "firstName lastName fullName employeeId").populate("roomId", "name roomNumber").populate("periodId", "name periodNumber").populate("sessionId", "name").sort({ dayOfWeek: 1, periodNumber: 1 }).lean();
  const withSubstitutes = await addSubstituteTeachers(actor.schoolId, items, typeof req.query.date === "string" ? req.query.date : undefined);
  if(actor.role==="TEACHER"&&typeof req.query.date==="string"){
    const substituteEntries=await getSubstituteTeacherTimetableEntries(actor.schoolId,sessionId,String(filter.teacherId),req.query.date);
    withSubstitutes.push(...substituteEntries);
    withSubstitutes.sort((a:any,b:any)=>a.dayOfWeek.localeCompare(b.dayOfWeek)||a.periodNumber-b.periodNumber);
  }
  return sendSuccess(res, "My timetable fetched successfully", {isHoliday:Boolean(holidayName),holidayName,timetable:withSubstitutes});
});

export const getSubjectTimetable = asyncHandler(async(req:Request,res:Response)=>{
 const actor=getActor(req);const subjectId=req.params.subjectId;if(typeof subjectId!=="string")throw new AppError("Valid subject ID is required",400);
 let items=await getSubjectTimetableService(actor.schoolId,subjectId,typeof req.query.sessionId==="string"?req.query.sessionId:undefined);
 if(actor.role==="TEACHER"){
  const employee=await Employee.findOne({schoolId:actor.schoolId,userId:actor.userId,isActive:true,isDeleted:false}).select("_id").lean();
  if(!employee)throw new AppError("Teacher profile is not linked to this account",403);
  items=items.filter((item:any)=>String(item.teacherId?._id||item.teacherId)===employee._id.toString());
 }
 return sendSuccess(res,"Subject timetable fetched successfully",items);
});
