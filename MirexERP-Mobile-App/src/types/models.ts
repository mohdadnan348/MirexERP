export interface StudentSummary { id: string; name: string; className: string; section: string; admissionNo?: string; }
export interface AttendanceSummary { present: number; absent: number; percentage: number; }
export interface HomeworkItem { id: string; title: string; subject: string; dueDate: string; status: "pending" | "submitted" | "evaluated"; }
export interface FeeSummary { total: number; paid: number; balance: number; dueDate?: string; }
export interface Notice { id: string; title: string; message: string; createdAt: string; }
