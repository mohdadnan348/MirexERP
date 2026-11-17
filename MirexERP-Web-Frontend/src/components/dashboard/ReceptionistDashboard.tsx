"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ClipboardList, GraduationCap, Users, RefreshCw, ArrowUpRight, Clock3 } from "lucide-react";
import { admissionsApi, type Admission } from "@/lib/api/admissions";
import "./ReceptionistDashboard.css";

const fullName = (item: Admission) => item.fullName || [item.firstName, item.lastName].filter(Boolean).join(" ");
const dateLabel = (value?: string) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function ReceptionistDashboard() {
  const [items, setItems] = useState<Admission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await admissionsApi.list({ page: 1, limit: 100, sortBy: "createdAt", sortOrder: "desc" });
      setItems(result.admissions || []);
      setTotal(result.pagination?.total ?? result.admissions.length);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Could not load admission applications.");
      setItems([]); setTotal(0);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const pending = items.filter((item) => ["APPLIED", "UNDER_REVIEW", "DOCUMENTS_PENDING"].includes(item.status));
  const documentsPending = items.filter((item) => item.status === "DOCUMENTS_PENDING").length;
  const converted = items.filter((item) => item.status === "CONVERTED").length;

  return <main className="receptionist-dashboard">
    <header className="rec-hero">
      <div><span className="rec-eyebrow">MIREXERP / FRONT DESK WORKSPACE</span><h1>Receptionist Dashboard</h1><p>Manage admission applications, applicant details and parent information.</p></div>
      <button className="rec-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? "rec-spin" : ""}/>{loading ? "Loading" : "Refresh data"}</button>
    </header>

    {error && <div className="rec-alert"><AlertCircle size={17}/><span>{error}</span><button onClick={() => void load()}>Retry</button></div>}

    <section className="rec-stats">
      <article><span className="rec-icon purple"><ClipboardList size={19}/></span><small>Total applications</small><strong>{loading ? "—" : total.toLocaleString("en-IN")}</strong><em>All applications returned by the school API</em></article>
      <article><span className="rec-icon amber"><Clock3 size={19}/></span><small>Applications needing attention</small><strong>{loading ? "—" : pending.length.toLocaleString("en-IN")}</strong><em>From the latest 100 loaded applications</em></article>
      <article><span className="rec-icon rose"><AlertCircle size={19}/></span><small>Documents pending</small><strong>{loading ? "—" : documentsPending.toLocaleString("en-IN")}</strong><em>From the latest 100 loaded applications</em></article>
      <article><span className="rec-icon green"><GraduationCap size={19}/></span><small>Converted to students</small><strong>{loading ? "—" : converted.toLocaleString("en-IN")}</strong><em>From the latest 100 loaded applications</em></article>
    </section>

    <section className="rec-quick-grid">
      <Link href="/admissions"><span className="rec-quick-icon"><ClipboardList size={20}/></span><div><b>Admission Management</b><small>Create applications, update applicant details and track status</small></div><ArrowUpRight size={17}/></Link>
      <Link href="/students"><span className="rec-quick-icon blue"><GraduationCap size={20}/></span><div><b>Student Directory</b><small>Search and view student records permitted to your role</small></div><ArrowUpRight size={17}/></Link>
      <Link href="/parents"><span className="rec-quick-icon orange"><Users size={20}/></span><div><b>Parents & Guardians</b><small>Find parent contacts and linked student information</small></div><ArrowUpRight size={17}/></Link>
    </section>

    <section className="rec-panel">
      <div className="rec-panel-head"><div><span>RECENT RECORDS</span><h2>Latest admission applications</h2></div><Link href="/admissions">View all applications <ArrowUpRight size={14}/></Link></div>
      {loading ? <div className="rec-empty">Loading admission records…</div> : items.length ? <div className="rec-table-wrap"><table><thead><tr><th>Applicant</th><th>Application no.</th><th>Class</th><th>Applied on</th><th>Status</th></tr></thead><tbody>{items.slice(0, 8).map((item) => <tr key={item._id}><td><b>{fullName(item)}</b><small>{item.phone || item.guardians?.[0]?.phone || "No phone recorded"}</small></td><td>{item.applicationNumber || "—"}</td><td>{typeof item.appliedClassId === "object" ? item.appliedClassId?.name || "—" : "—"}</td><td>{dateLabel(item.applicationDate || item.createdAt)}</td><td><span className={`rec-status ${item.status.toLowerCase()}`}>{item.status.replaceAll("_", " ")}</span></td></tr>)}</tbody></table></div> : <div className="rec-empty">No admission applications found. Create a new application from Admission Management.</div>}
      <p className="rec-note">Dashboard figures are calculated from live admission API results. Attention, document-pending and converted counts reflect the latest 100 loaded applications; total applications uses the API pagination total.</p>
    </section>
  </main>;
}
