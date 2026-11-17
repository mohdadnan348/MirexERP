"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity, Building2, CheckCircle2, Clock3, CreditCard, IndianRupee,
  RefreshCw, ShieldAlert, Users, Wallet, GraduationCap,
} from "lucide-react";
import { api } from "@/lib/api/client";
import "./SuperAdminDashboard.css";

type AnyRecord = Record<string, any>;
const unwrap = (r: any): any => r?.data?.data ?? r?.data ?? r;
const fmt = (n: any) => new Intl.NumberFormat("en-IN").format(Number(n) || 0);
const money = (n: any) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n) || 0);

export function SuperAdminDashboard() {
  const [overview, setOverview] = useState<AnyRecord>({});
  const [schoolsStats, setSchoolsStats] = useState<AnyRecord>({});
  const [revenue, setRevenue] = useState<AnyRecord>({});
  const [activities, setActivities] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const requests = await Promise.allSettled([
      api.get("/dashboard/super-admin/overview"),
      api.get("/dashboard/super-admin/schools-statistics"),
      api.get("/dashboard/super-admin/revenue-statistics"),
      api.get("/dashboard/super-admin/recent-activities", { params: { page: 1, limit: 8 } }),
    ]);
    const get = (index: number) => requests[index].status === "fulfilled"
      ? unwrap((requests[index] as PromiseFulfilledResult<any>).value) : null;
    setOverview(get(0) || {});
    setSchoolsStats(get(1) || {});
    setRevenue(get(2) || {});
    const activityData = get(3);
    setActivities(Array.isArray(activityData) ? activityData : activityData?.items || []);
    const failed = requests.filter(x => x.status === "rejected").length;
    if (failed === 4) setError("Super Admin dashboard APIs could not be loaded. Verify the backend and Super Admin token.");
    else if (failed) setError(`${failed} dashboard API request(s) failed. Some figures may be unavailable.`);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const statusRows: AnyRecord[] = Array.isArray(schoolsStats.byStatus) ? schoolsStats.byStatus : [];
  const cards = [
    { label: "Registered schools", value: fmt(overview.totalSchools), hint: "All non-deleted schools", icon: Building2, tone: "violet" },
    { label: "Active schools", value: fmt(overview.activeSchools), hint: "Currently active", icon: CheckCircle2, tone: "green" },
    { label: "Suspended / inactive", value: fmt(overview.inactiveSchools), hint: "Not currently active", icon: ShieldAlert, tone: "amber" },
    { label: "Platform users", value: fmt(overview.totalUsers), hint: "Registered user accounts", icon: Users, tone: "blue" },
    { label: "Active subscriptions", value: fmt(overview.activeSubscriptions), hint: "Active school subscriptions", icon: CreditCard, tone: "green" },
    { label: "Platform students", value: fmt(overview.totalStudents), hint: "Active student records", icon: GraduationCap, tone: "violet" },
    { label: "Total collected revenue", value: money(revenue.totalRevenue), hint: "Subscriptions marked PAID", icon: IndianRupee, tone: "green" },
    { label: "Trial subscriptions", value: fmt(revenue.trialSubscriptions), hint: "Current trial records", icon: Clock3, tone: "blue" },
  ];

  return (
    <main className="sa-dashboard">
      <header className="sa-hero">
        <div><span className="sa-kicker">MIREXERP / PLATFORM CONTROL</span><h1>Super Admin Dashboard</h1><p>Monitor schools, subscriptions and platform operations from one place.</p></div>
        <button onClick={() => { setRefreshing(true); void load(); }} disabled={loading || refreshing}><RefreshCw size={16} />{refreshing ? "Refreshing" : "Refresh data"}</button>
      </header>
      {error && <div className="sa-error" role="alert">{error}</div>}
      <section className="sa-stats">
        {cards.map(card => <article className={`sa-card ${card.tone}`} key={card.label}>
          <div className="sa-card-top"><span>{card.label}</span><i><card.icon size={19}/></i></div>
          <strong>{loading ? "—" : card.value}</strong><small>{card.hint}</small>
        </article>)}
      </section>
      <section className="sa-grid">
        <article className="sa-panel">
          <div className="sa-panel-head"><div><span>PLATFORM DIRECTORY</span><h2>School status distribution</h2><p>Live counts from the platform statistics API.</p></div><Building2/></div>
          {loading ? <p className="sa-muted">Loading school statistics…</p> : statusRows.length ? <div className="sa-school-list">
            {statusRows.map((row, i) => <div className="sa-school-row" key={String(row._id || i)}><div className="sa-school-avatar">{String(row._id || "?").slice(0,1)}</div><div><b>{String(row._id || "Unknown").replaceAll("_"," ")}</b><small>Schools in this status</small></div><span className="sa-status">{fmt(row.count)}</span></div>)}
          </div> : <p className="sa-muted">No school status records returned.</p>}
        </article>
        <article className="sa-panel">
          <div className="sa-panel-head"><div><span>PLATFORM OPERATIONS</span><h2>Recent platform activities</h2><p>Latest school and user registration events.</p></div><Activity/></div>
          {loading ? <p className="sa-muted">Loading activities…</p> : activities.length ? <div className="sa-school-list">
            {activities.map((item, i) => <div className="sa-school-row" key={`${item.type || "event"}-${i}`}><div className="sa-school-avatar"><Activity size={16}/></div><div><b>{item.title || item.type || "Platform activity"}</b><small>{item.description || "Activity details unavailable"} · {item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN") : "Date unavailable"}</small></div></div>)}
          </div> : <p className="sa-muted">No recent activities returned.</p>}
        </article>
      </section>
      <section className="sa-grid">
        <article className="sa-panel"><div className="sa-panel-head"><div><span>REVENUE SUMMARY</span><h2>Subscription revenue</h2><p>Based on paid subscription records.</p></div><Wallet/></div>
          <div className="sa-school-list"><div className="sa-school-row"><div><b>Total paid revenue</b><small>All records marked PAID</small></div><strong>{loading ? "—" : money(revenue.totalRevenue)}</strong></div><div className="sa-school-row"><div><b>Monthly recurring revenue (MRR)</b><small>Recurring plans normalized to a monthly amount</small></div><strong>{loading ? "—" : money(revenue.activeSubscriptionValue)}</strong></div></div>
        </article>
        <article className="sa-panel"><div className="sa-panel-head"><div><span>MANAGEMENT SHORTCUTS</span><h2>Platform controls</h2><p>Open platform management modules.</p></div><CreditCard/></div>
          <div className="sa-shortcuts"><a href="/schools"><Building2/>Manage schools <b>→</b></a><a href="/subscriptions"><CreditCard/>Plans & subscriptions <b>→</b></a><a href="/platform-revenue"><Wallet/>Payments & revenue <b>→</b></a><a href="/platform-users"><Users/>Platform users <b>→</b></a><a href="/roles-permissions"><ShieldAlert/>Roles & permissions <b>→</b></a><a href="/support-tickets"><Activity/>Support tickets <b>→</b></a><a href="/platform-settings"><Clock3/>Platform settings <b>→</b></a><a href="/audit-logs"><Activity/>Audit logs <b>→</b></a></div>
        </article>
      </section>
      <p className="sa-footnote">Live figures are read from platform APIs. Revenue currently represents subscription records marked PAID, not a payment-gateway settlement report.</p>
    </main>
  );
}
