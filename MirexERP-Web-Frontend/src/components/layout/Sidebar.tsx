"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, School, UserRound, GraduationCap, CalendarCheck, Wallet,
  BookOpen, Bus, Settings, X, Users, ClipboardList, Briefcase, Clock3,
  ClipboardCheck, Receipt, Banknote, Library, Package, MessageSquare,
  Award, CalendarDays, BarChart3, CreditCard, BookMarked, CalendarRange, History,
  ClipboardSignature, AlertCircle, ReceiptText, FileText, CircleDollarSign, HandCoins, UsersRound, Bell, MapPinned,
} from "lucide-react";
import "./Sidebar.css";

type SidebarProps = { open: boolean; onClose: () => void };

const schoolGroups = [
  { title: "OVERVIEW", links: [["Dashboard", "/dashboard", LayoutDashboard]] },
  { title: "SCHOOL MANAGEMENT", links: [["Schools", "/schools", School], ["Admissions", "/admissions", ClipboardList], ["Admission Enquiries", "/admissions/enquiries", ClipboardSignature], ["Admission Follow-ups", "/admissions/follow-ups", CalendarRange], ["Admission Reports", "/admissions/reports", BarChart3], ["Admission Settings", "/admissions/settings", Settings], ["Students", "/students", GraduationCap], ["Parents & Guardians", "/parents", Users], ["Guardian Access", "/guardian-relationships", UsersRound], ["Parent Requests", "/parent-requests", MessageSquare], ["Classes & Sections", "/class-section-management", BookOpen], ["Classes", "/classes", BookOpen], ["Sections", "/sections", BookOpen], ["Student Allocation", "/student-allocation", GraduationCap], ["Class/Section Transfer", "/class-section-transfers", GraduationCap], ["Student Promotion", "/student-promotion", GraduationCap], ["Subject Teachers", "/subject-teacher-assignments", BookMarked], ["Class/Section Reports", "/class-section-reports", BarChart3], ["Academic Sessions", "/sessions", CalendarRange], ["Session Preparation", "/sessions/preparation", CalendarRange], ["Session Promotion", "/sessions/promotion", GraduationCap], ["Session Reports", "/sessions/reports", BarChart3], ["Previous Sessions", "/sessions/history", History], ["Detained Students", "/sessions/detained", AlertCircle], ["Session Audit History", "/sessions/audit-history", ClipboardSignature], ["Subjects", "/subjects", BookMarked], ["Subject Class Mapping", "/subjects/class-mapping", BookMarked], ["Subject Teacher Assignments", "/subjects/teacher-assignments", Users], ["Elective Selection", "/subjects/electives", GraduationCap], ["Syllabus Management", "/subjects/syllabus", BookOpen], ["Subject Reports", "/subjects/reports", BarChart3]] },
  { title: "ACADEMICS", links: [["Attendance", "/attendance", CalendarCheck], ["Timetable", "/timetable", Clock3], ["Homework", "/homework", ClipboardCheck], ["Study Materials", "/study-materials", FileText], ["Examinations", "/exams", BookOpen], ["Certificates", "/certificates", Award], ["Events", "/events", CalendarDays]] },
  { title: "ADMINISTRATION", links: [["Employees", "/employees", Briefcase], ["Employee Performance", "/employee-performance", Award], ["Fees & Invoices", "/fees", Wallet], ["Finance", "/finance", Banknote], ["Payroll", "/payroll", Receipt], ["Transport", "/transport", Bus], ["Library", "/library", Library], ["Inventory", "/inventory", Package]] },
  { title: "COMMUNICATION & INSIGHTS", links: [["Communication", "/communication", MessageSquare], ["Reports", "/reports", BarChart3], ["Subscriptions", "/subscriptions", CreditCard], ["Student Portal", "/student-portal", UserRound], ["Settings", "/settings", Settings]] },
] as const;
const schoolAdminGroups = [
  { title: "OVERVIEW", links: [["Dashboard", "/dashboard", LayoutDashboard]] },
  { title: "SCHOOL SETUP", links: [
    ["School Profile & Branches", "/school-profile", School],
    ["School Settings", "/settings", Settings],
    ["Academic Sessions", "/sessions", CalendarRange],
    ["Session Preparation", "/sessions/preparation", CalendarRange],
    ["Session Promotion", "/sessions/promotion", GraduationCap],
    ["Session Reports", "/sessions/reports", BarChart3],
    ["Previous Sessions", "/sessions/history", History],
    ["Detained Students", "/sessions/detained", AlertCircle],
    ["Session Audit History", "/sessions/audit-history", ClipboardSignature],
    ["Classes & Sections", "/classes", BookOpen],
    ["Subjects", "/subjects", BookMarked],
    ["Subject Class Mapping", "/subjects/class-mapping", BookMarked],
    ["Subject Teacher Assignments", "/subjects/teacher-assignments", Users],
    ["Elective Selection", "/subjects/electives", GraduationCap],
    ["Syllabus Management", "/subjects/syllabus", BookOpen],
    ["Subject Reports", "/subjects/reports", BarChart3],
    ["Academic Calendar & Holidays", "/holidays", CalendarDays],
  ] },
  { title: "STUDENT MANAGEMENT", links: [
    ["Admissions", "/admissions", ClipboardList],
    ["Admission Enquiries", "/admissions/enquiries", ClipboardSignature],
    ["Admission Follow-ups", "/admissions/follow-ups", CalendarRange],
    ["Admission Reports", "/admissions/reports", BarChart3],
    ["Admission Settings", "/admissions/settings", Settings],
    ["Students", "/students", GraduationCap],
    ["Parents & Guardians", "/parents", Users],
  ] },
  { title: "ACADEMICS", links: [
    ["Attendance", "/attendance", CalendarCheck],
    ["Timetable", "/timetable", Clock3],
    ["Homework", "/homework", ClipboardCheck],
    ["Examinations", "/exams", BookOpen],
    ["Certificates", "/certificates", Award],
    ["Events & Calendar", "/events", CalendarDays],
  ] },
  { title: "STAFF & ADMINISTRATION", links: [
    ["Employees", "/employees", Briefcase],
    ["HR & Payroll", "/payroll", Receipt],
    ["Leave Management", "/leaves", ClipboardCheck],
    ["Fees Management", "/fees", Wallet],
    ["Finance & Expenses", "/finance", Banknote],
    ["Expense Records", "/expenses", Receipt],
    ["Transport", "/transport", Bus],
    ["Library", "/library", Library],
    ["Inventory", "/inventory", Package],
  ] },
  { title: "COMMUNICATION & CONTROL", links: [
    ["Communication", "/communication", MessageSquare],
    ["Reports & Analytics", "/reports", BarChart3],
    ["Audit Logs", "/audit-logs", ClipboardSignature],
    ["Subscription", "/subscriptions", CreditCard],
  ] },
] as const;


const accountantGroups = [
  { title: "FINANCIAL OVERVIEW", links: [["Dashboard", "/dashboard", LayoutDashboard]] },
  { title: "STUDENT & FEES", links: [
    ["Student Directory", "/students", GraduationCap],
    ["Academic Sessions", "/sessions", CalendarRange],
    ["Session Fee Preparation", "/sessions/preparation", CalendarRange],
    ["Fees Management", "/fees", Wallet],
    ["Fee Invoices", "/fee-invoices", FileText],
    ["Fee Collection", "/fee-collection", HandCoins],
    ["Receipts", "/receipts", ReceiptText],
    ["Pending Fees", "/pending-fees", Clock3],
    ["Defaulters", "/defaulters", AlertCircle],
    ["Discounts & Fines", "/discounts-fines", CircleDollarSign],
    ["Refunds", "/refunds", Receipt],
  ] },
  { title: "SCHOOL FINANCE", links: [
    ["Finance & Expenses", "/finance", Banknote],
    ["Expense Records", "/expenses", Receipt],
    ["Vendors", "/vendors", UsersRound],
    ["Cashbook", "/cashbook", Wallet],
    ["Financial Reports", "/financial-reports", BarChart3],
  ] },
  { title: "ACCOUNT", links: [["Notifications", "/notifications", Bell]] },
] as const;


const receptionistGroups = [
  { title: "FRONT DESK", links: [
    ["Dashboard", "/dashboard", LayoutDashboard],
    ["Admissions", "/admissions", ClipboardList],
    ["Admission Enquiries", "/admissions/enquiries", ClipboardSignature],
    ["Admission Follow-ups", "/admissions/follow-ups", CalendarRange],
    ["Students", "/students", GraduationCap],
    ["Parents & Guardians", "/parents", Users],
  ] },
  { title: "COMMUNICATION", links: [
    ["Notifications", "/notifications", Bell],
  ] },
] as const;


const librarianGroups = [
  { title: "OVERVIEW", links: [["Dashboard", "/dashboard", LayoutDashboard]] },
  { title: "LIBRARY", links: [
    ["All Books", "/library", Library],
    ["Add Book", "/library?mode=create", BookOpen],
    ["Categories & Authors", "/library", BookMarked],
  ] },
  { title: "TRANSACTIONS", links: [
    ["Issue & Return", "/library?tab=transactions", ClipboardList],
    ["Renewals & Issue History", "/library?tab=transactions", CalendarRange],
  ] },
  { title: "MEMBERS & RECORDS", links: [
    ["Students & Teachers", "/library?tab=members", Users],
    ["Issued & Overdue Books", "/library?tab=transactions", Clock3],
    ["Lost / Damaged Records", "/library?tab=inventory", AlertCircle],
  ] },
  { title: "FINANCE & REPORTS", links: [
    ["Library Fines", "/library?tab=fines", CircleDollarSign],
    ["Book & Issue Reports", "/library?tab=reports", BarChart3],
  ] },
  { title: "ACCOUNT", links: [["Notifications", "/notifications", Bell]] },
] as const;


const inventoryManagerGroups = [
  { title: "OVERVIEW", links: [["Dashboard", "/dashboard", LayoutDashboard]] },
  { title: "INVENTORY", links: [
    ["Inventory Items", "/inventory", Package],
    ["Categories", "/inventory", BookMarked],
    ["Low-stock Alerts", "/inventory", AlertCircle],
  ] },
  { title: "PROCUREMENT", links: [
    ["Vendors", "/inventory", Briefcase],
    ["Purchase Orders", "/inventory", ReceiptText],
    ["Goods Receipt & Payments", "/inventory", Wallet],
  ] },
  { title: "REPORTS", links: [["Stock Ledger", "/inventory", BarChart3]] },
  { title: "ACCOUNT", links: [["Notifications", "/notifications", Bell]] },
] as const;

const transportManagerGroups = [
  { title: "OVERVIEW", links: [["Dashboard", "/dashboard", LayoutDashboard]] },
  { title: "FLEET", links: [
    ["All Vehicles", "/transport", Bus],
    ["Add Vehicle", "/transport?mode=create", Bus],
    ["Vehicle Documents", "/transport?tab=documents", FileText],
  ] },
  { title: "ROUTES", links: [
    ["All Routes", "/transport?tab=routes", MapPinned],
    ["Create Route", "/transport?mode=create", MapPinned],
    ["Route Stops", "/transport?tab=stops", MapPinned],
  ] },
  { title: "ASSIGNMENTS", links: [
    ["Student Assignments", "/transport?tab=assignments", Users],
    ["Assign Student", "/transport?tab=assignments", UserRound],
  ] },
  { title: "STAFF", links: [
    ["Drivers", "/transport?tab=drivers", Briefcase],
    ["Helpers", "/transport?tab=drivers", UsersRound],
  ] },
  { title: "FINANCE", links: [
    ["Transport Fee Records", "/transport?tab=fees", Wallet],
    ["Pending Fees", "/transport?tab=fees", Clock3],
  ] },
  { title: "MAINTENANCE", links: [
    ["Service Records", "/transport?tab=maintenance", Settings],
    ["Expiry Alerts", "/transport?tab=documents", AlertCircle],
  ] },
  { title: "REPORTS & ACCOUNT", links: [
    ["Transport Reports", "/transport?tab=reports", BarChart3],
    ["Notifications", "/notifications", Bell],
    ["Profile", "/settings", UserRound],
  ] },
] as const;

const principalGroups = [
  { title: "OVERVIEW", links: [["Dashboard", "/dashboard", LayoutDashboard]] },
  { title: "SCHOOL & STUDENTS", links: [["Admissions & Approvals", "/admissions", ClipboardList], ["Admission Enquiries", "/admissions/enquiries", ClipboardSignature], ["Admission Follow-ups", "/admissions/follow-ups", CalendarRange], ["Admission Reports", "/admissions/reports", BarChart3], ["Students", "/students", GraduationCap], ["Parents", "/parents", Users], ["Classes & Sections", "/class-section-management", BookOpen], ["Classes", "/classes", BookOpen], ["Sections", "/sections", BookOpen], ["Student Allocation", "/student-allocation", GraduationCap], ["Class/Section Transfer", "/class-section-transfers", GraduationCap], ["Student Promotion", "/student-promotion", GraduationCap], ["Subject Teachers", "/subject-teacher-assignments", BookMarked], ["Class/Section Reports", "/class-section-reports", BarChart3], ["Academic Sessions", "/sessions", CalendarRange], ["Session Preparation", "/sessions/preparation", CalendarRange], ["Session Promotion", "/sessions/promotion", GraduationCap], ["Session Reports", "/sessions/reports", BarChart3], ["Previous Sessions", "/sessions/history", History], ["Detained Students", "/sessions/detained", AlertCircle], ["Session Audit History", "/sessions/audit-history", ClipboardSignature], ["Subjects", "/subjects", BookMarked], ["Subject Class Mapping", "/subjects/class-mapping", BookMarked], ["Subject Teacher Assignments", "/subjects/teacher-assignments", Users], ["Elective Selection", "/subjects/electives", GraduationCap], ["Syllabus Management", "/subjects/syllabus", BookOpen], ["Subject Reports", "/subjects/reports", BarChart3]] },
  { title: "ACADEMICS", links: [["Attendance", "/attendance", CalendarCheck], ["Timetable", "/timetable", Clock3], ["Homework", "/homework", ClipboardCheck], ["Examinations & Results", "/exams", BookOpen], ["Academic Calendar & Holidays", "/holidays", CalendarDays], ["Certificates", "/certificates", Award], ["Events", "/events", CalendarDays]] },
  { title: "STAFF & OPERATIONS", links: [["Employees", "/employees", Briefcase], ["Leave Approvals", "/leaves", ClipboardCheck], ["Fees Overview", "/fees", Wallet], ["Transport", "/transport", Bus], ["Library", "/library", Library], ["Inventory", "/inventory", Package]] },
  { title: "INSIGHTS", links: [["Reports & Analytics", "/reports", BarChart3], ["Communication", "/communication", MessageSquare]] },
] as const;

const mobileRoleGroups = [
  { title: "MOBILE APP ACCOUNT", links: [["Portal", "/student-portal", UserRound]] },
] as const;

const platformGroups = [
  { title: "PLATFORM OVERVIEW", links: [["Dashboard", "/dashboard", LayoutDashboard]] },
  { title: "PLATFORM MANAGEMENT", links: [["Schools", "/schools", School], ["Plans & Subscriptions", "/subscriptions", CreditCard], ["Payments & Revenue", "/platform-revenue", Wallet], ["Platform Users", "/platform-users", Users], ["Roles & Permissions", "/roles-permissions", Settings], ["Support Tickets", "/support-tickets", Briefcase], ["Platform Settings", "/platform-settings", Settings], ["Audit Logs", "/audit-logs", ClipboardSignature]] },
  { title: "SCHOOL OPERATIONS · SELECT A SCHOOL", links: [
    ["School Profile & Settings", "/settings", School], ["Academic Sessions", "/sessions", CalendarRange],
    ["Admissions", "/admissions", ClipboardList], ["Students", "/students", GraduationCap], ["Parents & Guardians", "/parents", Users],
    ["Classes", "/classes", BookOpen], ["Sections", "/sections", BookOpen], ["Subjects", "/subjects", BookMarked],
    ["Attendance", "/attendance", CalendarCheck], ["Timetable", "/timetable", Clock3], ["Homework", "/homework", ClipboardCheck],
    ["Examinations", "/exams", BookOpen], ["Certificates", "/certificates", Award], ["Academic Calendar & Holidays", "/holidays", CalendarDays],
    ["Employees", "/employees", Briefcase], ["Leave Management", "/leaves", ClipboardCheck], ["Fees & Invoices", "/fees", Wallet],
    ["Finance & Expenses", "/finance", Banknote], ["Payroll", "/payroll", Receipt], ["Transport", "/transport", Bus],
    ["Library", "/library", Library], ["Inventory", "/inventory", Package], ["Communication", "/communication", MessageSquare],
    ["Events", "/events", CalendarDays], ["Reports", "/reports", BarChart3], ["Student Portal", "/student-portal", UserRound],
  ] },
  { title: "PLATFORM INSIGHTS", links: [["Audit Logs", "/audit-logs", ClipboardList], ["Reports & Analytics", "/reports", BarChart3]] },
] as const;

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  let user: { role?: string; schoolName?: string; name?: string } = {};

  if (typeof window !== "undefined") {
    try {
      user = JSON.parse(sessionStorage.getItem("mirexerp_user") || "{}");
    } catch {
      user = {};
    }
  }

  const role = String(user.role || "").toUpperCase().replaceAll(" ", "_");
  const isSuperAdmin = role === "SUPER_ADMIN";
  const isSchoolAdmin = role === "SCHOOL_ADMIN";
  const isPrincipal = role === "PRINCIPAL";
  const isAccountant = role === "ACCOUNTANT";
  const isReceptionist = role === "RECEPTIONIST";
  const isLibrarian = role === "LIBRARIAN";
  const isTransportManager = role === "TRANSPORT_MANAGER";
  const isInventoryManager = role === "INVENTORY_MANAGER";
  const isMobileRole = ["PARENT", "TEACHER", "STUDENT"].includes(role);
  const workspaceName = isSuperAdmin ? "Platform Workspace" : user.schoolName || "School Workspace";
  const groups = isSuperAdmin ? platformGroups : isSchoolAdmin ? schoolAdminGroups : isPrincipal ? principalGroups : isAccountant ? accountantGroups : isReceptionist ? receptionistGroups : isLibrarian ? librarianGroups : isTransportManager ? transportManagerGroups : isInventoryManager ? inventoryManagerGroups : isMobileRole ? mobileRoleGroups : schoolGroups;

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        className={`sidebar-overlay ${open ? "show" : ""}`}
        onClick={onClose}
      />
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <img className="sidebar-logo" src="/brand/mirexerp-app-icon.png" alt="MirexERP" />
          <div className="sidebar-brand-copy">
            <strong>MirexERP</strong>
            <small>School Management</small>
          </div>
          <button type="button" className="sidebar-close" onClick={onClose} aria-label="Close sidebar">
            <X size={19} />
          </button>
        </div>

        <div className="school-switch">
          <span className="school-avatar">{role === "SUPER_ADMIN" ? "M" : "S"}</span>
          <span className="school-switch-copy">
            <b>{workspaceName}</b>
            <small>{role ? role.replaceAll("_", " ") : "Management Portal"}</small>
          </span>
        </div>

        <nav className="sidebar-nav">
          {groups.map((group) => (
            <section className="nav-group" key={group.title}>
              <p className="nav-group-title">{group.title}</p>
              <div className="nav-group-links">
                {group.links.map(([label, href, Icon]) => {
                  const hrefPath = href.split("?")[0];
                  const active = pathname === hrefPath || (hrefPath !== "/dashboard" && pathname.startsWith(`${hrefPath}/`));
                  return (
                    <Link
                      key={`${label}-${href}`}
                      href={href}
                      onClick={onClose}
                      className={`nav-link ${active ? "active" : ""}`}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon size={18} strokeWidth={1.9} />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <span className="sidebar-status-dot" />
          <span>MirexERP</span>
          <span className="sidebar-version">v1.0.0</span>
        </div>
      </aside>
    </>
  );
}
