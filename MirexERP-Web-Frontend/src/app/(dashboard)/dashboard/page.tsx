"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertCircle, BookOpen, CalendarDays, CheckCircle2, Clock3,
  IndianRupee, RefreshCw, School, Users, Wallet, ArrowUpRight,
  GraduationCap, ClipboardCheck, FileCheck2, BarChart3,
} from "lucide-react";
import { api } from "@/lib/api/client";
import "./page.css";
import { SuperAdminDashboard } from "@/components/dashboard/SuperAdminDashboard";
import { AccountantDashboard } from "@/components/dashboard/AccountantDashboard";
import { ReceptionistDashboard } from "@/components/dashboard/ReceptionistDashboard";
import { LibrarianDashboard } from "@/components/dashboard/LibrarianDashboard";
import { TransportManagerDashboard } from "@/components/dashboard/TransportManagerDashboard";

type Overview = {
  totalStudents?: number;
  activeStudents?: number;
  inactiveStudents?: number;
  totalEmployees?: number;
  pendingAdmissions?: number;
  fees?: { totalAmount?: number; collectedAmount?: number; pendingAmount?: number };
};
type Attendance = {
  total?: number;
  summary?: Record<string, number>;
  startDate?: string;
  endDate?: string;
};
type Fees = {
  totals?: { invoiceCount?: number; totalAmount?: number; paidAmount?: number; balanceAmount?: number };
  byStatus?: Array<{ _id?: string; count?: number; amount?: number }>;
};
type ActivityItem = {
  type?: string;
  title?: string;
  description?: string;
  createdAt?: string;
};

const unwrap = <T,>(response: { data?: { data?: T } | T }): T => {
  const payload = response?.data as { data?: T } | T | undefined;
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data?: T }).data as T;
  }
  return payload as T;
};

const money = (value?: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const number = (value?: number) =>
  new Intl.NumberFormat("en-IN").format(Number(value) || 0);

const dateLabel = (value?: string) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
};

const getErrorMessage = (error: unknown) => {
  const err = error as {
    response?: { status?: number; data?: { message?: string } };
    message?: string;
  };
  if (err.response?.status === 429) {
    return "Server is receiving too many requests. Please wait a moment, then refresh.";
  }
  return err.response?.data?.message || err.message || "Dashboard data could not be loaded.";
};

function SchoolDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [fees, setFees] = useState<Fees | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [startDateInput, setStartDateInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setError("");
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const params = appliedStartDate && appliedEndDate
      ? { startDate: appliedStartDate, endDate: appliedEndDate }
      : {};

    // Requests are deliberately sequenced instead of firing four requests at once.
    // This avoids unnecessary bursts against the API rate limiter.
    try {
      const overviewResponse = await api.get("/dashboard/overview");
      setOverview(unwrap<Overview>(overviewResponse));

      const attendanceResponse = await api.get("/dashboard/attendance", { params });
      setAttendance(unwrap<Attendance>(attendanceResponse));

      const feesResponse = await api.get("/dashboard/fees", { params });
      setFees(unwrap<Fees>(feesResponse));

      const activityResponse = await api.get("/dashboard/activities", {
        params: { page: 1, limit: 8 },
      });
      const activityData = unwrap<{ items?: ActivityItem[] } | ActivityItem[]>(activityResponse);
      setActivities(Array.isArray(activityData) ? activityData : activityData?.items ?? []);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
      inFlight.current = false;
    }
  }, [appliedStartDate, appliedEndDate]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const applyDateRange = () => {
    if (startDateInput && endDateInput && startDateInput > endDateInput) {
      setError("Start date cannot be after end date.");
      return;
    }
    setAppliedStartDate(startDateInput);
    setAppliedEndDate(endDateInput);
  };

  const clearDateRange = () => {
    setStartDateInput("");
    setEndDateInput("");
    setAppliedStartDate("");
    setAppliedEndDate("");
  };

  const statCards = useMemo(() => [
    {
      label: "Total students",
      value: number(overview?.totalStudents),
      note: `${number(overview?.activeStudents)} active students`,
      icon: Users,
      tone: "violet",
    },
    {
      label: "Teachers & staff",
      value: number(overview?.totalEmployees),
      note: "Registered school employees",
      icon: School,
      tone: "blue",
    },
    {
      label: "Monthly fee collection",
      value: money(overview?.fees?.collectedAmount),
      note: `${money(overview?.fees?.pendingAmount)} pending`,
      icon: Wallet,
      tone: "green",
    },
    {
      label: "Pending approvals & admissions",
      value: number(overview?.pendingAdmissions),
      note: "Admissions awaiting decision",
      icon: BookOpen,
      tone: "amber",
    },
  ], [overview]);

  const attendanceEntries = Object.entries(attendance?.summary ?? {});
  const attendanceTotal = attendance?.total || 0;
  const presentCount = attendance?.summary?.PRESENT || 0;
  const presentPercent = attendanceTotal
    ? Math.round((presentCount / attendanceTotal) * 100)
    : 0;
  const feeTotals = fees?.totals;
  const collectionPercent = feeTotals?.totalAmount
    ? Math.min(100, ((feeTotals.paidAmount || 0) / feeTotals.totalAmount) * 100)
    : 0;

  return (
    <main className="mirex-dashboard">
      <section className="dash-hero">
        <div className="dash-heading-copy">
          <div className="dash-kicker"><span className="kicker-dot" /> MIREXERP <span>/</span> OVERVIEW</div>
          <h1>School dashboard</h1>
          <p>Your school at a glance. Key numbers and activity from your workspace.</p>
        </div>

        <div className="dash-toolbar">
          <div className="dash-date-group">
            <label className="date-filter">
              <CalendarDays size={16} />
              <input
                aria-label="Start date"
                type="date"
                value={startDateInput}
                max={endDateInput || undefined}
                onChange={(event) => setStartDateInput(event.target.value)}
              />
            </label>
            <span className="date-separator">to</span>
            <label className="date-filter">
              <input
                aria-label="End date"
                type="date"
                value={endDateInput}
                min={startDateInput || undefined}
                onChange={(event) => setEndDateInput(event.target.value)}
              />
            </label>
            <button className="dash-apply" type="button" onClick={applyDateRange}>Apply</button>
            {(appliedStartDate || appliedEndDate) && (
              <button className="dash-clear" type="button" onClick={clearDateRange}>Clear</button>
            )}
          </div>
          <button className="dash-refresh" type="button" onClick={() => void loadDashboard(true)} disabled={refreshing || loading}>
            <RefreshCw size={16} className={refreshing ? "spin" : ""} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </section>

      {error && (
        <div className="dash-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button type="button" onClick={() => void loadDashboard(true)} disabled={refreshing}>Try again</button>
        </div>
      )}

      <section className="dash-stat-grid" aria-label="School statistics">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <article className={`dash-stat-card ${card.tone}`} key={card.label}>
              <div className="stat-card-head">
                <span>{card.label}</span>
                <span className="stat-icon"><Icon size={20} /></span>
              </div>
              <strong>{loading ? "—" : card.value}</strong>
              <small>{card.note}</small>
              <span className="stat-card-glow" />
            </article>
          );
        })}
      </section>

      <section className="dash-main-grid">
        <article className="dash-panel attendance-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-eyebrow">STUDENT OVERVIEW</span>
              <h2>Attendance summary</h2>
              <p>Attendance records for the selected period</p>
            </div>
            <span className="panel-heading-icon"><Activity size={19} /></span>
          </div>
          {loading ? <div className="dash-skeleton" /> : (
            <>
              <div className="attendance-highlight">
                <div
                  className="attendance-ring"
                  style={{ background: `conic-gradient(#6755d9 ${presentPercent * 3.6}deg, #eeedf5 0deg)` }}
                >
                  <div><b>{presentPercent}%</b><span>Present</span></div>
                </div>
                <div className="attendance-total">
                  <strong>{number(attendanceTotal)}</strong>
                  <span>Total attendance records</span>
                  <small><CheckCircle2 size={14} /> {number(presentCount)} students present</small>
                </div>
              </div>
              <div className="attendance-breakdown">
                {attendanceEntries.length ? attendanceEntries.map(([key, value]) => (
                  <div className="attendance-item" key={key}>
                    <span className={`attendance-marker marker-${key.toLowerCase()}`} />
                    <span>{key.replaceAll("_", " ").toLowerCase()}</span>
                    <b>{number(value)}</b>
                  </div>
                )) : <p className="empty-copy">No attendance records found for this period.</p>}
              </div>
            </>
          )}
        </article>

        <article className="dash-panel fees-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-eyebrow">FINANCE</span>
              <h2>Fee overview</h2>
              <p>Invoice collection and outstanding balance</p>
            </div>
            <span className="panel-heading-icon green-icon"><IndianRupee size={19} /></span>
          </div>
          {loading ? <div className="dash-skeleton" /> : (
            <>
              <div className="fee-total">
                <span>Total invoiced</span>
                <strong>{money(feeTotals?.totalAmount ?? overview?.fees?.totalAmount)}</strong>
                <small>{number(feeTotals?.invoiceCount)} invoices generated</small>
              </div>
              <div className="fee-progress" aria-label={`${Math.round(collectionPercent)} percent collected`}>
                <span style={{ width: `${collectionPercent}%` }} />
              </div>
              <div className="fee-progress-caption">
                <span>{Math.round(collectionPercent)}% collected</span>
                <span>{Math.max(0, 100 - Math.round(collectionPercent))}% remaining</span>
              </div>
              <div className="fee-rows">
                <div><span><i className="fee-dot collected" />Collected</span><b>{money(feeTotals?.paidAmount ?? overview?.fees?.collectedAmount)}</b></div>
                <div><span><i className="fee-dot pending" />Outstanding</span><b>{money(feeTotals?.balanceAmount ?? overview?.fees?.pendingAmount)}</b></div>
              </div>
              {!!fees?.byStatus?.length && (
                <div className="fee-statuses">
                  {fees.byStatus.map((item) => (
                    <span key={item._id || "unknown"}>
                      {(item._id || "Other").replaceAll("_", " ")} <b>{item.count || 0}</b>
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </article>
      </section>

      <section className="dash-panel recent-panel">
        <div className="panel-heading recent-heading">
          <div>
            <span className="panel-eyebrow">LATEST UPDATES</span>
            <h2>Recent activity</h2>
            <p>Latest school updates and admission records</p>
          </div>
          <span className="activity-count">{activities.length} activities</span>
        </div>
        {loading ? <div className="dash-skeleton activity-skeleton" /> : activities.length ? (
          <div className="activity-list">
            {activities.map((item, index) => (
              <div className="activity-row" key={`${item.type || "activity"}-${item.createdAt || index}-${index}`}>
                <span className="activity-symbol"><Clock3 size={16} /></span>
                <div className="activity-content">
                  <b>{item.title || "Activity update"}</b>
                  <p>{item.description || "No additional details"}</p>
                </div>
                <time>{dateLabel(item.createdAt)}</time>
              </div>
            ))}
          </div>
        ) : (
          <div className="activity-empty">
            <Activity size={24} />
            <b>No recent activity</b>
            <span>New student and admission updates will appear here.</span>
          </div>
        )}
      </section>

      <footer className="dash-footer">
        <span>Live information from your MirexERP workspace</span>
        <span><span className="live-dot" /> {loading ? "Loading dashboard" : refreshing ? "Syncing" : "Dashboard ready"}</span>
      </footer>
    </main>
  );
}



type PrincipalOverview = {
  totalStudents?: number;
  totalTeachers?: number;
  totalEmployees?: number;
  totalClasses?: number;
  todayAttendanceRecords?: number;
};
type PrincipalAcademic = {
  totalExams?: number;
  publishedExams?: number;
  upcomingExams?: number;
  results?: { note?: string } | Record<string, unknown>;
};
type PrincipalApprovals = {
  pendingAdmissions?: number;
  unpublishedExams?: number;
  pendingCertificates?: number;
  [key: string]: unknown;
};

function PrincipalDashboard() {
  const [overview, setOverview] = useState<PrincipalOverview | null>(null);
  const [academic, setAcademic] = useState<PrincipalAcademic | null>(null);
  const [approvals, setApprovals] = useState<PrincipalApprovals | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [partialErrors, setPartialErrors] = useState<string[]>([]);

  const loadDashboard = useCallback(async (refresh = false) => {
    setError("");
    setPartialErrors([]);
    refresh ? setRefreshing(true) : setLoading(true);

    const requests = await Promise.allSettled([
      api.get("/dashboard/principal/overview"),
      api.get("/dashboard/principal/academic-statistics"),
      api.get("/dashboard/principal/pending-approvals"),
    ]);

    const labels = ["Overview", "Academic statistics", "Pending approvals"];
    const values = requests.map((result) =>
      result.status === "fulfilled" ? unwrap<any>(result.value) : null
    );

    setOverview(values[0] || null);
    setAcademic(values[1] || null);
    setApprovals(values[2] || null);

    const failures = requests
      .map((result, index) => result.status === "rejected" ? labels[index] : null)
      .filter((value): value is string => Boolean(value));

    setPartialErrors(failures);
    if (failures.length === requests.length) {
      const firstFailure = requests.find((item) => item.status === "rejected");
      setError(firstFailure?.status === "rejected"
        ? getErrorMessage(firstFailure.reason)
        : "Principal dashboard data could not be loaded.");
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const cards = [
    { label: "Total students", value: number(overview?.totalStudents), icon: Users, tone: "violet" },
    { label: "Teachers", value: number(overview?.totalTeachers), icon: GraduationCap, tone: "blue" },
    { label: "Total employees", value: number(overview?.totalEmployees), icon: School, tone: "green" },
    { label: "Classes", value: number(overview?.totalClasses), icon: BookOpen, tone: "amber" },
    { label: "Today's attendance records", value: number(overview?.todayAttendanceRecords), icon: CalendarDays, tone: "blue" },
    { label: "Total exams", value: number(academic?.totalExams), icon: ClipboardCheck, tone: "violet" },
    { label: "Published exams", value: number(academic?.publishedExams), icon: FileCheck2, tone: "green" },
    { label: "Upcoming exams", value: number(academic?.upcomingExams), icon: BarChart3, tone: "amber" },
  ];

  const approvalItems = [
    { label: "Pending admissions", value: approvals?.pendingAdmissions },
    { label: "Unpublished exams", value: approvals?.unpublishedExams },
    { label: "Pending certificates", value: approvals?.pendingCertificates },
  ].filter((item) => item.value !== undefined);

  return (
    <main className="mirex-dashboard principal-dashboard">
      <section className="dash-hero">
        <div className="dash-heading-copy">
          <div className="dash-kicker"><span className="kicker-dot" /> MIREXERP <span>/</span> PRINCIPAL</div>
          <h1>Principal Dashboard</h1>
          <p>Academic performance, school overview and pending approvals.</p>
        </div>
        <div className="dash-toolbar">
          <button className="dash-refresh" type="button" onClick={() => void loadDashboard(true)} disabled={loading || refreshing}>
            <RefreshCw size={16} className={refreshing ? "spin" : ""} />
            {refreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </section>

      {error && (
        <div className="dash-error" role="alert">
          <AlertCircle size={18} /><span>{error}</span>
          <button type="button" onClick={() => void loadDashboard(true)} disabled={refreshing}>Try again</button>
        </div>
      )}
      {!error && partialErrors.length > 0 && (
        <div className="dash-error" role="status">
          <AlertCircle size={18} />
          <span>Some sections could not be loaded: {partialErrors.join(", ")}. Other available figures are shown.</span>
          <button type="button" onClick={() => void loadDashboard(true)} disabled={refreshing}>Retry</button>
        </div>
      )}

      <section className="dash-stat-grid" aria-label="Principal dashboard statistics">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article className={`dash-stat-card ${card.tone}`} key={card.label}>
              <div className="stat-card-head">
                <span>{card.label}</span>
                <span className="stat-icon"><Icon size={20} /></span>
              </div>
              <strong>{loading ? "—" : card.value}</strong>
              <small>Live data from principal dashboard API</small>
              <span className="stat-card-glow" />
            </article>
          );
        })}
      </section>

      <section className="dash-main-grid">
        <article className="dash-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-eyebrow">APPROVAL WORKFLOW</span>
              <h2>Pending approvals</h2>
              <p>Items that may need principal review.</p>
            </div>
            <span className="panel-heading-icon"><ClipboardCheck size={19} /></span>
          </div>
          {loading ? <div className="dash-skeleton" /> : approvalItems.length ? (
            <div className="principal-approval-list">
              {approvalItems.map((item) => (
                <div className="principal-approval-row" key={item.label}>
                  <span>{item.label}</span><strong>{number(Number(item.value))}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-copy">No approval counts were returned by the API.</p>
          )}
        </article>

        <article className="dash-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-eyebrow">ACADEMIC INSIGHT</span>
              <h2>Exam & result information</h2>
              <p>Academic statistics returned by the current backend.</p>
            </div>
            <span className="panel-heading-icon green-icon"><BarChart3 size={19} /></span>
          </div>
          {loading ? <div className="dash-skeleton" /> : (
            <div className="principal-academic-note">
              {typeof academic?.results?.note === "string"
                ? academic.results.note
                : "Exam statistics loaded. Result/pass-rate details depend on the backend response."}
            </div>
          )}
        </article>
      </section>

      <footer className="dash-footer">
        <span>Live information from your MirexERP school workspace</span>
        <span><span className="live-dot" /> {loading ? "Loading dashboard" : refreshing ? "Syncing" : "Dashboard ready"}</span>
      </footer>
    </main>
  );
}


export default function DashboardPage() {
  const [role, setRole] = useState("");
  const [checked, setChecked] = useState(false);
  useEffect(() => { try { const u = JSON.parse(sessionStorage.getItem("mirexerp_user") || "{}"); setRole(String(u.role || "").toUpperCase().replaceAll(" ", "_")); } catch { setRole(""); } finally { setChecked(true); } }, []);
  if (!checked) return <div className="dash-skeleton" />;
  switch (role) {
    case "SUPER_ADMIN":
      return <SuperAdminDashboard />;
    case "SCHOOL_ADMIN":
    case "SCHOOLADMIN":
      return <SchoolDashboard />;
    case "PRINCIPAL":
      return <PrincipalDashboard />;
    case "ACCOUNTANT":
      return <AccountantDashboard />;
    case "RECEPTIONIST":
      return <ReceptionistDashboard />;
    case "LIBRARIAN":
      return <LibrarianDashboard />;
    case "TRANSPORT_MANAGER":
    case "TRANSPORTMANAGER":
      return <TransportManagerDashboard />;
    case "PARENT":
    case "TEACHER":
    case "STUDENT":
      return (
        <main className="dashboard-role-notice">
          <h1>MirexERP Mobile App</h1>
          <p>This account is configured for the Parent, Teacher or Student mobile application. School administration pages are not available for this role.</p>
        </main>
      );
    default:
      return (
        <main className="dashboard-role-notice" role="alert">
          <h1>Dashboard access unavailable</h1>
          <p>Your account role could not be identified. Please sign in again or contact your school administrator.</p>
        </main>
      );
  }
}
