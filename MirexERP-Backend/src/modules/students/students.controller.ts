
import { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { generateAndSendPdf } from "../../utils/pdf";
import School from "../schools/schools.model";
import StudentRecord from "./student-records.model";
import fs from "fs";
import path from "path";
import { env } from "../../config/env";

import {
  sendCreated,
  sendDeleted,
  sendPaginatedSuccess,
  sendSuccess,
} from "../../utils/apiResponse";

import { getValidatedData } from "../../middleware/validate";

import {
  createStudentService,
  getStudentsService,
  getStudentByIdService,
  updateStudentService,
  deleteStudentService,
} from "./students.service";

import {
  CreateStudentInput,
  UpdateStudentInput,
  GetStudentsQuery,
} from "./students.validation";

interface StudentActor {
  userId: string;
  schoolId: string;
  role: string;
}

const getActor = (req: Request): StudentActor => {
  if (!req.user) {
    throw new AppError("Authentication required", 401);
  }

  const user = req.user as typeof req.user & {
    role?: string;
  };

  if (!user.schoolId) {
    throw new AppError("School context is required", 400);
  }

  if (!user.role) {
    throw new AppError("User role is required", 403);
  }

  return {
    userId: user.userId,
    schoolId: user.schoolId,
    role: user.role,
  };
};

const getStudentId = (req: Request): string => {
  const id = req.params.id;

  if (typeof id !== "string" || !id.trim()) {
    throw new AppError("Valid student ID is required", 400);
  }

  return id;
};

// CREATE STUDENT
export const createStudent = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const data = getValidatedData<CreateStudentInput>(
      res,
      "body"
    );

    const student = await createStudentService(
      data as Record<string, unknown>,
      actor
    );

    return sendCreated(
      res,
      "Student created successfully",
      student
    );
  }
);

// GET ALL STUDENTS
export const getAllStudents = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const query = getValidatedData<GetStudentsQuery>(
      res,
      "query"
    );

    const result = await getStudentsService(
      actor,
      query
    );

    return sendPaginatedSuccess(
      res,
      "Students fetched successfully",
      result.items,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.page < result.totalPages,
        hasPreviousPage: result.page > 1,
      }
    );
  }
);

// GET STUDENT BY ID
export const getStudentById = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const student = await getStudentByIdService(
      getStudentId(req),
      actor
    );

    return sendSuccess(
      res,
      "Student fetched successfully",
      student
    );
  }
);

// UPDATE STUDENT
export const updateStudent = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const data = getValidatedData<UpdateStudentInput>(
      res,
      "body"
    );

    const student = await updateStudentService(
      getStudentId(req),
      data as Record<string, unknown>,
      actor
    );

    return sendSuccess(
      res,
      "Student updated successfully",
      student
    );
  }
);

// UPDATE STUDENT STATUS
export const updateStudentStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    const data = getValidatedData<UpdateStudentInput>(
      res,
      "body"
    );

    if (!data.status) {
      throw new AppError("Student status is required", 400);
    }

    const student = await updateStudentService(
      getStudentId(req),
      { status: data.status },
      actor
    );

    return sendSuccess(
      res,
      "Student status updated successfully",
      student
    );
  }
);

// DELETE STUDENT (SOFT DELETE)
export const deleteStudent = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);

    await deleteStudentService(
      getStudentId(req),
      actor
    );

    return sendDeleted(
      res,
      "Student deleted successfully"
    );
  }
);


// Generate a school-scoped student identity card PDF.
export const downloadStudentIdCard = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = getActor(req);
    const student = await getStudentByIdService(getStudentId(req), actor);
    const fullName = [student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ");
    const school: any = await School.findById(actor.schoolId).select("name code address logo").lean();
    const photo: any = await StudentRecord.findOne({ schoolId: actor.schoolId, studentId: student._id, recordType: "DOCUMENT", "details.category": "PHOTO", isDeleted: false }).select("+storagePath").lean();
    const photoPath = photo?.storagePath && path.resolve(photo.storagePath).startsWith(`${path.resolve(process.cwd(), env.UPLOAD_DIR)}${path.sep}`) && fs.existsSync(photo.storagePath) ? photo.storagePath : undefined;
    return generateAndSendPdf(
      res,
      (doc) => {
        doc.roundedRect(36, 36, 360, 250, 16).lineWidth(1).strokeColor("#5b45b5").stroke();
        doc.fillColor("#34206f").fontSize(16).font("Helvetica-Bold").text(String(school?.name || "School"), 54, 50, { width: 324, align: "center" });
        doc.fillColor("#596276").fontSize(8).font("Helvetica").text(String(school?.code || ""), 54, 69, { width: 324, align: "center" });
        doc.moveTo(54, 86).lineTo(378, 86).strokeColor("#d9d2f2").stroke();
        if (photoPath) doc.image(photoPath, 58, 101, { fit: [70, 86], align: "center", valign: "center" });
        const infoX = photoPath ? 142 : 58;
        const infoWidth = photoPath ? 225 : 310;
        doc.fillColor("#18213b").fontSize(14).font("Helvetica-Bold").text(fullName, infoX, 99, { width: infoWidth });
        doc.fillColor("#596276").fontSize(8).font("Helvetica");
        doc.text(`Admission No: ${student.admissionNumber}`, infoX, 126);
        doc.text(`Class: ${String((student.classId as any)?.name || "—")}   Section: ${String((student.sectionId as any)?.name || "—")}`, infoX, 143);
        doc.text(`Roll No: ${String(student.rollNumber || "—")}`, infoX, 160);
        doc.text(`Date of Birth: ${new Date(student.dateOfBirth).toLocaleDateString("en-IN")}`, infoX, 177);
        doc.text(`Blood Group: ${String(student.bloodGroup || "—")}`, infoX, 194);
        doc.text(`Parent Contact: ${String((student.parentId as any)?.phone || student.phone || "—")}`, infoX, 211);
        doc.text(`Academic Session: ${String((student.sessionId as any)?.name || "—")}`, infoX, 228);
        doc.fillColor("#6b46c1").fontSize(8).text("Keep this card safe. If found, please return it to the school office.", 58, 264, { width: 310, align: "center" });
      },
      `student-${student.admissionNumber}-id-card.pdf`,
      { title: `Student ID - ${fullName}`, subject: "Student identity card", pageSize: "A6", margins: { top: 10, bottom: 10, left: 10, right: 10 } }
    );
  }
);
