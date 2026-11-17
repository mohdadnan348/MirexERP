
/**
 * MirexERP module registry.
 *
 * Central list of all ERP modules.
 * This registry can be used for module management,
 * documentation and platform-level configuration.
 */

export interface ERPModule {
  key: string;
  name: string;
  description: string;
  basePath: string;
}

export const ERP_MODULES = [
  {
    key: "admissions",
    name: "Admissions",
    description: "Manage student admission applications.",
    basePath: "/admissions",
  },
  {
    key: "attendance",
    name: "Attendance",
    description: "Manage student and employee attendance.",
    basePath: "/attendance",
  },
  {
    key: "auth",
    name: "Authentication",
    description: "Manage login, logout and authentication.",
    basePath: "/auth",
  },
  {
    key: "certificates",
    name: "Certificates",
    description: "Generate and manage student certificates.",
    basePath: "/certificates",
  },
  {
    key: "classes",
    name: "Classes",
    description: "Manage classes, sections and class assignments.",
    basePath: "/classes",
  },
  {
    key: "communication",
    name: "Communication",
    description: "Manage announcements and notifications.",
    basePath: "/communication",
  },
  {
    key: "dashboard",
    name: "Dashboard",
    description: "Provide role-based dashboard information.",
    basePath: "/dashboard",
  },
  {
    key: "employees",
    name: "Employees",
    description: "Manage school employees and staff.",
    basePath: "/employees",
  },
  {
    key: "events",
    name: "Events",
    description: "Manage school events and activities.",
    basePath: "/events",
  },
  {
    key: "exams",
    name: "Examinations",
    description: "Manage exams, marks and results.",
    basePath: "/exams",
  },
  {
    key: "fees",
    name: "Fees",
    description: "Manage fee structures, payments and receipts.",
    basePath: "/fees",
  },
  {
    key: "finance",
    name: "Finance",
    description: "Manage school financial transactions.",
    basePath: "/finance",
  },
  {
    key: "health",
    name: "Health",
    description: "Provide API health and system status checks.",
    basePath: "/health",
  },
  {
    key: "homework",
    name: "Homework",
    description: "Manage homework and student submissions.",
    basePath: "/homework",
  },
  {
    key: "inventory",
    name: "Inventory",
    description: "Manage school stock and inventory.",
    basePath: "/inventory",
  },
  {
    key: "library",
    name: "Library",
    description: "Manage books, issue and return records.",
    basePath: "/library",
  },
  {
    key: "parents",
    name: "Parents",
    description: "Manage parent accounts and student relationships.",
    basePath: "/parents",
  },
  {
    key: "payroll",
    name: "Payroll",
    description: "Manage employee salaries and payroll.",
    basePath: "/payroll",
  },
  {
    key: "reports",
    name: "Reports",
    description: "Generate school management reports.",
    basePath: "/reports",
  },
  {
    key: "sections",
    name: "Sections",
    description: "Manage class sections, capacity and teacher assignments.",
    basePath: "/sections",
  },
  {
    key: "schools",
    name: "Schools",
    description: "Manage school tenants and school profiles.",
    basePath: "/schools",
  },
  {
    key: "school-management",
    name: "School Management",
    description: "Manage tenant profile, branches, branding and school documents.",
    basePath: "/school-management",
  },
  {
    key: "sessions",
    name: "Academic Sessions",
    description: "Manage academic years and sessions.",
    basePath: "/sessions",
  },
  {
    key: "settings",
    name: "Settings",
    description: "Manage school and system configurations.",
    basePath: "/settings",
  },
  {
    key: "student-portal",
    name: "Student Portal",
    description: "Provide student portal functionality.",
    basePath: "/student-portal",
  },
  {
    key: "students",
    name: "Students",
    description: "Manage student profiles and records.",
    basePath: "/students",
  },
  {
    key: "subjects",
    name: "Subjects",
    description: "Manage subjects and academic assignments.",
    basePath: "/subjects",
  },
  {
    key: "subscriptions",
    name: "Subscriptions",
    description: "Manage SaaS plans and school subscriptions.",
    basePath: "/subscriptions",
  },
  {
    key: "timetable",
    name: "Timetable",
    description: "Manage class schedules and periods.",
    basePath: "/timetable",
  },
  {
    key: "transport",
    name: "Transport",
    description: "Manage school vehicles, routes and transport.",
    basePath: "/transport",
  },
] as const satisfies readonly ERPModule[];

/**
 * Total number of registered ERP modules.
 */
export const TOTAL_ERP_MODULES = ERP_MODULES.length;

/**
 * Find a module using its unique key.
 */
export const getERPModule = (key: string) => {
  return ERP_MODULES.find((module) => module.key === key);
};

/**
 * Check whether a module exists.
 */
export const isERPModule = (key: string): boolean => {
  return ERP_MODULES.some((module) => module.key === key);
};