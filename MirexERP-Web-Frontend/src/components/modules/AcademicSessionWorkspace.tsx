"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { AlertCircle, CalendarRange, CheckCircle2, Clock3, Plus, RefreshCw, XCircle, Pencil, LockKeyhole, BookOpen, Wallet, BarChart3, History } from "lucide-react";
import "./AcademicSessionWorkspace.css";

type SessionRow = {
  _id: string; name: string; code: string; startDate: string; endDate: string;
  status?: string; isActive: boolean; isClosed: boolean; activatedAt?: string | null; closedAt?: string | null;
  classCount?: number; studentCount?: number; description?: string;
};
type Dashboard = { schoolTimezone?: string; summary?: { totalSessions: number; activeSession: SessionRow | null; upcomingSession: SessionRow | null; closedSessions: number; activeSessionStudents: number; studentsPendingPromotion: number }; sessions?: SessionRow[] };
const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;
const dateText = (v?: string | null, timezone?: string) => v ? new Intl.DateTimeFormat("en-IN", { timeZone: timezone || "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }).format(new Date(v)) : "—";
const dateInput = (v: string, timezone?: string) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(v));

export default function AcademicSessionWorkspace() {
  const [data, setData] = useState<Dashboard>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<SessionRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ name: "", code: "", startDate: "", endDate: "", description: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setData(unwrap(await api.get("/sessions/dashboard")) || {}); }
    catch (e: any) { setError(e?.response?.data?.message || "Academic sessions could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const sessions = data.sessions || [];
  const filteredSessions = useMemo(() => sessions.filter(row => {
    const search = searchText.trim().toLowerCase();
    const matchesSearch = !search || `${row.name} ${row.code}`.toLowerCase().includes(search);
    const status = row.status || (row.isClosed ? "CLOSED" : row.isActive ? "ACTIVE" : new Date(row.startDate) > new Date() ? "UPCOMING" : "DRAFT");
    return matchesSearch && (statusFilter === "ALL" || status === statusFilter);
  }), [sessions, searchText, statusFilter]);
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const visibleSessions = filteredSessions.slice((page - 1) * pageSize, page * pageSize);
  const summary = data.summary || { totalSessions: 0, activeSession: null, upcomingSession: null, closedSessions: 0, activeSessionStudents: 0, studentsPendingPromotion: 0 };
  const openCreate = () => { setEditing(null); setForm({ name: "", code: "", startDate: "", endDate: "", description: "" }); setModal(true); setNotice(""); setError(""); };
  const openEdit = (row: SessionRow) => { setEditing(row); setForm({ name: row.name, code: row.code, startDate: dateInput(row.startDate, data.schoolTimezone), endDate: dateInput(row.endDate, data.schoolTimezone), description: row.description || "" }); setModal(true); setNotice(""); setError(""); };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const payload = { ...form, startDate: form.startDate, endDate: form.endDate };
      if (editing) await api.patch(`/sessions/${editing._id}`, payload);
      else await api.post("/sessions", payload);
      setModal(false); setNotice(editing ? "Academic session updated." : "Academic session created."); await load();
    } catch (e: any) { setError(e?.response?.data?.message || "Unable to save academic session."); }
    finally { setSaving(false); }
  };
  const activate = async (row: SessionRow) => {
    if (!window.confirm(`Activate ${row.name}? This will deactivate the currently active session.`)) return;
    setError(""); setNotice("");
    try { await api.patch(`/sessions/${row._id}/activate`, { confirmation: "ACTIVATE_SESSION" }); setNotice(`${row.name} is now active.`); await load(); }
    catch (e: any) { setError(e?.response?.data?.message || "Session activation failed."); }
  };
  const close = async (row: SessionRow) => {
    if (!window.confirm(`WARNING: Closing ${row.name} is irreversible. Historical data will remain readable, but normal transactions and allocations will be blocked. Continue?`)) return;
    const confirmation = window.prompt(`Type CLOSE_SESSION to permanently close ${row.name}.`);
    if (confirmation !== "CLOSE_SESSION") return;
    setError(""); setNotice("");
    try { await api.patch(`/sessions/${row._id}/close`, { confirmation }); setNotice(`${row.name} was permanently closed.`); await load(); }
    catch (e: any) { setError(e?.response?.data?.message || "Session closure failed."); }
  };

  const cards = [
    { label: "Total sessions", value: summary.totalSessions, icon: CalendarRange },
    { label: "Active session students", value: summary.activeSessionStudents, icon: CheckCircle2 },
    { label: "Students pending promotion", value: summary.studentsPendingPromotion, icon: Clock3 },
    { label: "Closed sessions", value: summary.closedSessions, icon: LockKeyhole },
  ];

  return <main className="academic-sessions">
    <header className="as-header">
      <div><span className="as-eyebrow">MIREXERP / SCHOOL SETUP</span><h1>Academic Session Management</h1><p>Create academic years, manage activation and closure, prepare the next session, and preserve previous records.</p></div>
      <div className="as-header-actions"><button className="as-btn as-btn-light" onClick={() => void load()}><RefreshCw size={16}/> Refresh</button><button className="as-btn as-btn-primary" onClick={openCreate}><Plus size={17}/> Create session</button></div>
    </header>
    {notice && <div className="as-alert as-success"><CheckCircle2 size={17}/>{notice}<button onClick={() => setNotice("")}><XCircle size={16}/></button></div>}
    {error && <div className="as-alert as-error"><AlertCircle size={17}/>{error}<button onClick={() => setError("")}><XCircle size={16}/></button></div>}
    <section className="as-cards">{cards.map(card => <article className="as-card" key={card.label}><span className="as-card-icon"><card.icon size={19}/></span><div><small>{card.label}</small><strong>{loading ? "—" : card.value}</strong></div></article>)}</section>
    <section className="as-current-grid">
      <article className="as-current-card"><div className="as-section-title"><span>Current active session</span><span className="as-pill active">ACTIVE</span></div>
        {summary.activeSession ? <><h2>{summary.activeSession.name}</h2><p>{dateText(summary.activeSession.startDate, data.schoolTimezone)} — {dateText(summary.activeSession.endDate, data.schoolTimezone)}</p><Link href={`/sessions/${summary.activeSession._id}/details`}>View session details</Link></> : <div className="as-empty-small">No active academic session configured.</div>}
      </article>
      <article className="as-current-card"><div className="as-section-title"><span>Next session</span><span className="as-pill upcoming">UPCOMING</span></div>
        {summary.upcomingSession ? <><h2>{summary.upcomingSession.name}</h2><p>{dateText(summary.upcomingSession.startDate, data.schoolTimezone)} — {dateText(summary.upcomingSession.endDate, data.schoolTimezone)}</p><Link href={`/sessions/preparation?sessionId=${summary.upcomingSession._id}`}>Continue preparation</Link></> : <div className="as-empty-small">No upcoming session found. Create one to begin preparation.</div>}
      </article>
    </section>
    <nav className="as-shortcuts">
      <Link href="/sessions/preparation"><BookOpen size={17}/> Next session preparation</Link>
      <Link href="/sessions/promotion"><CalendarRange size={17}/> Student promotion</Link>
      <Link href="/sessions/reports"><BarChart3 size={17}/> Session reports</Link>
      <Link href="/sessions/history"><History size={17}/> Previous sessions</Link><Link href="/sessions/audit-history"><History size={17}/> Audit history</Link>
      <Link href="/sessions/detained"><AlertCircle size={17}/> Detained students</Link>
      <Link href="/fees"><Wallet size={17}/> Fee structures</Link>
    </nav>
    <section className="as-table-panel">
      <div className="as-table-heading"><div><h2>Academic sessions</h2><p>All sessions belonging to the selected school.</p></div><span>{filteredSessions.length} sessions</span></div>
      <div className="as-list-toolbar"><input aria-label="Search sessions" placeholder="Search by session name or code…" value={searchText} onChange={e => { setSearchText(e.target.value); setPage(1); }}/><select aria-label="Filter by status" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}><option value="ALL">All statuses</option><option value="DRAFT">Draft</option><option value="UPCOMING">Upcoming</option><option value="ACTIVE">Active</option><option value="CLOSED">Closed</option></select></div>
      {loading ? <div className="as-loading">Loading academic sessions…</div> : filteredSessions.length ? <div className="as-table-scroll"><table><thead><tr><th>Session</th><th>Academic period</th><th>Status</th><th>Students</th><th>Classes</th><th>Closed on</th><th>Actions</th></tr></thead><tbody>
        {visibleSessions.map(row => { const rowStatus = row.status || (row.isClosed ? "CLOSED" : row.isActive ? "ACTIVE" : new Date(row.startDate) > new Date() ? "UPCOMING" : "DRAFT"); return <tr key={row._id}><td><strong>{row.name}</strong><small>{row.code}</small></td><td>{dateText(row.startDate, data.schoolTimezone)} – {dateText(row.endDate, data.schoolTimezone)}</td><td><span className={`as-pill ${rowStatus.toLowerCase()}`}>{rowStatus}</span></td><td>{row.studentCount ?? 0}</td><td>{row.classCount ?? 0}</td><td>{dateText(row.closedAt, data.schoolTimezone)}</td><td><div className="as-actions">
          <Link href={`/sessions/${row._id}/details`}>Details</Link>
          {!row.isClosed && !row.isActive && !row.activatedAt && <button onClick={() => openEdit(row)}>Edit</button>}
          {!row.isClosed && !row.isActive && <button onClick={() => void activate(row)}>Activate</button>}
          {!row.isClosed && !row.isActive && <button className="danger" onClick={() => void close(row)}>Close</button>}
          {!row.isClosed && row.isActive && <span className="as-action-hint">Close after switching session</span>}
        </div></td></tr>; })}
      </tbody></table></div> : <div className="as-empty">{searchText || statusFilter !== "ALL" ? "No sessions match the selected search or filter." : "No academic sessions created yet. Create the first session to start setup."}</div>}
      {!loading && filteredSessions.length > pageSize && <div className="as-pagination"><span>Page {page} of {pageCount}</span><div><button disabled={page <= 1} onClick={() => setPage(v => v - 1)}>Previous</button><button disabled={page >= pageCount} onClick={() => setPage(v => v + 1)}>Next</button></div></div>}
    </section>
    {modal && <div className="as-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(false); }}><section className="as-modal"><header><div><span className="as-eyebrow">{editing ? "EDIT SESSION" : "NEW ACADEMIC YEAR"}</span><h2>{editing ? "Update academic session" : "Create academic session"}</h2></div><button onClick={() => setModal(false)} aria-label="Close"><XCircle size={20}/></button></header>
      <form onSubmit={submit}><div className="as-form-grid">
        <label>Session name<input required minLength={3} maxLength={100} value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))} placeholder="2026-27"/></label>
        <label>Session code<input required minLength={2} maxLength={30} value={form.code} onChange={e => setForm(v => ({ ...v, code: e.target.value.toUpperCase() }))} placeholder="2026-27"/></label>
        <label>Start date<input required type="date" value={form.startDate} onChange={e => setForm(v => ({ ...v, startDate: e.target.value }))}/></label>
        <label>End date<input required type="date" min={form.startDate || undefined} value={form.endDate} onChange={e => setForm(v => ({ ...v, endDate: e.target.value }))}/></label>
        <label className="full">Description / notes<textarea rows={3} maxLength={500} value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))}/></label>
      </div><p className="as-form-note">The backend checks duplicate names/codes and overlapping date ranges within this school. A new session is not activated automatically.</p><footer><button type="button" className="as-btn as-btn-light" onClick={() => setModal(false)}>Cancel</button><button disabled={saving} className="as-btn as-btn-primary">{saving ? "Saving…" : editing ? "Save changes" : "Create session"}</button></footer></form>
    </section></div>}
  </main>;
}
