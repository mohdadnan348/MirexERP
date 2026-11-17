export const endpoints = {
  auth: { login: "/auth/login", refresh: "/auth/refresh-token", logout: "/auth/logout" },
  dashboard: "/dashboard",
  schools: "/schools", admissions: "/admissions", students: "/students",
  classes: "/classes", sections: "/sections", sessions: "/sessions", subjects: "/subjects",
  employees: "/employees", attendance: "/attendance", timetable: "/timetable",
  homework: "/homework", exams: "/exams", fees: "/fees", finance: "/finance",
  payroll: "/payroll", parents: "/parents", transport: "/transport",
  library: "/library", inventory: "/inventory", communication: "/communication",
  certificates: "/certificates", events: "/events", reports: "/reports",
  settings: "/settings", subscriptions: "/subscriptions"
} as const;
