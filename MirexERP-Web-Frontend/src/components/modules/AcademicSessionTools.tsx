"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api/client";
import { RefreshCw, AlertCircle, CheckCircle2, BookOpen, Wallet, BarChart3, History, Users, ArrowRight, Search } from "lucide-react";
import "./AcademicSessionWorkspace.css";

const unwrap = (r: any) => r?.data?.data ?? r?.data ?? r;
const rows = (v: any): any[] => Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : Array.isArray(v?.sessions) ? v.sessions : Array.isArray(v?.data) ? v.data : [];
const dateText = (v?: string | null) => v ? new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
type SessionOption = { _id: string; name: string; status?: string; isActive?: boolean; isClosed?: boolean };

export function AcademicSessionPreparation() {
  const search = useSearchParams();
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [destinationId, setDestinationId] = useState(search.get("sessionId") || "");
  const [status, setStatus] = useState<any>(null);
  const [feeDrafts, setFeeDrafts] = useState<any[]>([]);
  const [editingFee, setEditingFee] = useState<any>(null);
  const [feeName, setFeeName] = useState("");
  const [feeAmounts, setFeeAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadSessions = useCallback(async () => {
    try { const result = unwrap(await api.get("/sessions", { params: { page: 1, limit: 100 } })); const list = rows(result); setSessions(list); if (!sourceId) setSourceId(list.find(s => s.isActive)?._id || list[0]?._id || ""); if (!destinationId) setDestinationId(list.find(s => !s.isActive && !s.isClosed)?._id || ""); }
    catch (e: any) { setError(e?.response?.data?.message || "Could not load sessions."); }
  }, [sourceId, destinationId]);
  const loadStatus = useCallback(async () => {
    if (!destinationId) { setStatus(null); return; }
    try { setStatus(unwrap(await api.get(`/sessions/${destinationId}/preparation`))); }
    catch (e: any) { setError(e?.response?.data?.message || "Preparation status could not be loaded."); }
  }, [destinationId]);
  const loadFeeDrafts = useCallback(async () => {
    if (!destinationId) { setFeeDrafts([]); return; }
    try { const result = unwrap(await api.get("/fees/structures", { params: { sessionId: destinationId, isActive: "false", page: 1, limit: 100 } })); setFeeDrafts(rows(result)); }
    catch (e: any) { setError(e?.response?.data?.message || "Fee drafts could not be loaded."); }
  }, [destinationId]);
  useEffect(() => { void loadSessions(); }, [loadSessions]);
  useEffect(() => { void loadStatus(); void loadFeeDrafts(); }, [loadStatus, loadFeeDrafts]);
  const run = async (kind: "classes" | "fees") => {
    if (!sourceId || !destinationId || sourceId === destinationId) { setError("Select different source and destination sessions."); return; }
    const label = kind === "classes" ? "Preparing classes and sections…" : "Cloning fee structures…";
    setBusy(kind); setError(""); setNotice("");
    try {
      const response = unwrap(await api.post(kind === "classes" ? "/sessions/prepare/classes" : "/sessions/prepare/fees", { sourceSessionId: sourceId, destinationSessionId: destinationId }));
      setNotice(kind === "classes" ? `${response.createdClasses} classes and ${response.createdSections} sections prepared.` : `${response.clonedCount} fee structures cloned as inactive drafts.`);
      await loadStatus();
      if (kind === "fees") await loadFeeDrafts();
    } catch (e: any) { setError(e?.response?.data?.message || `${kind} preparation failed.`); }
    finally { setBusy(""); }
  };
  const editFee = (fee: any) => {
    setEditingFee(fee); setFeeName(fee.name || "");
    const amounts: Record<string, string> = {};
    (fee.items || []).forEach((item: any) => { amounts[String(item.feeHeadId?._id || item.feeHeadId)] = String(item.amount ?? 0); });
    setFeeAmounts(amounts);
  };
  const saveFeeDraft = async () => {
    if (!editingFee) return;
    setBusy("fee-save"); setError(""); setNotice("");
    try {
      const items = (editingFee.items || []).map((item: any) => ({ feeHeadId: String(item.feeHeadId?._id || item.feeHeadId), amount: Number(feeAmounts[String(item.feeHeadId?._id || item.feeHeadId)] ?? item.amount) }));
      await api.patch(`/fees/structures/${editingFee._id}`, { name: feeName, items });
      setNotice("Fee structure draft updated. Review it before activation."); setEditingFee(null); await loadFeeDrafts(); await loadStatus();
    } catch (e:any) { setError(e?.response?.data?.message || "Fee draft could not be updated."); }
    finally { setBusy(""); }
  };
  const activateFee = async (fee: any) => {
    if (!window.confirm(`Activate fee structure ${fee.name}? This is a separate explicit action from academic session activation.`)) return;
    setBusy(`fee-${fee._id}`); setError(""); setNotice("");
    try {
      await api.patch(`/sessions/prepare/fees/${fee._id}/activate`, { confirmation: "ACTIVATE_FEE_STRUCTURE" });
      setNotice(`${fee.name} is active for its session.`); await loadFeeDrafts(); await loadStatus();
    } catch (e:any) { setError(e?.response?.data?.message || "Fee structure activation failed."); }
    finally { setBusy(""); }
  };
  const progress = status?.progress || {};
  const source = sessions.find(s => s._id === sourceId), destination = sessions.find(s => s._id === destinationId);
  return <main className="academic-sessions">
    <header className="as-header"><div><span className="as-eyebrow">MIREXERP / SESSION LIFECYCLE</span><h1>Next Session Preparation</h1><p>Prepare destination classes, sections, student promotion and fee structures before activating the new academic year.</p></div><Link className="as-btn as-btn-light" href="/sessions">Back to sessions</Link></header>
    {notice && <div className="as-alert as-success"><CheckCircle2 size={17}/>{notice}</div>}{error && <div className="as-alert as-error"><AlertCircle size={17}/>{error}</div>}
    <section className="as-table-panel"><div className="as-table-heading"><div><h2>Preparation source and destination</h2><p>Choose an existing session to copy setup from and an open inactive session to prepare.</p></div></div>
      <div className="as-form-grid as-select-grid"><label>Source session<select value={sourceId} onChange={e => setSourceId(e.target.value)}><option value="">Select source session</option>{sessions.map(s => <option key={s._id} value={s._id}>{s.name}{s.isActive ? " · Active" : ""}</option>)}</select></label>
      <label>Destination session<select value={destinationId} onChange={e => setDestinationId(e.target.value)}><option value="">Select destination session</option>{sessions.map(s => <option key={s._id} value={s._id} disabled={s.isClosed || s.isActive}>{s.name}{s.isClosed ? " · Closed" : s.isActive ? " · Active" : ""}</option>)}</select></label></div>
      {source && destination && <div className="as-pair"><span>{source.name}</span><ArrowRight size={18}/><strong>{destination.name}</strong></div>}
    </section>
    <section className="as-prep-grid">
      <article className="as-prep-card"><BookOpen size={22}/><h3>Session-wise classes & sections</h3><p>Copy the source session's class structure and sections. Class subjects are retained; teacher assignments are intentionally not copied.</p><button className="as-btn as-btn-primary" disabled={!sourceId || !destinationId || !!busy} onClick={() => void run("classes")}>{busy === "classes" ? "Preparing…" : "Prepare classes & sections"}</button></article>
      <article className="as-prep-card"><Wallet size={22}/><h3>Session-wise fee structures</h3><p>Clone fee heads and amounts into inactive drafts. Student assignments, invoices and payment transactions are never copied.</p><button className="as-btn as-btn-primary" disabled={!sourceId || !destinationId || !!busy} onClick={() => void run("fees")}>{busy === "fees" ? "Cloning…" : "Clone fee structures"}</button></article>
    </section>
    <section className="as-table-panel"><div className="as-table-heading"><div><h2>Preparation progress</h2><p>Live counts from the destination session.</p></div><button className="as-btn as-btn-light" onClick={() => void loadStatus()}><RefreshCw size={15}/> Refresh</button></div>
      {!destinationId ? <div className="as-empty">Select a destination session to view preparation progress.</div> : <div className="as-progress-list">
        {[["Classes prepared", progress.classes || 0], ["Sections prepared", progress.sections || 0], ["Fee structures cloned", progress.feeStructures || 0], ["Fee drafts awaiting activation", progress.draftFeeStructures || 0], ["Active fee structures", progress.activeFeeStructures || 0], ["Student enrollments", progress.activeStudents || 0], ["Detained students", progress.detainedStudents || 0]].map(([label, value]: any) => <div className="as-progress-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>}
      <div className="as-warning-note">Preparation does not activate the academic session. Review destination classes, student promotions and fee drafts first, then activate the session explicitly from the Academic Sessions dashboard.</div>
      {destinationId && <div className="as-tool-links"><Link href={`/sessions/promotion?sourceSessionId=${sourceId}&destinationSessionId=${destinationId}`}>Review student promotion <ArrowRight size={15}/></Link><Link href={`/classes?sessionId=${destinationId}`}>Review classes <ArrowRight size={15}/></Link></div>}
    </section>
    {destinationId && <section className="as-table-panel"><div className="as-table-heading"><div><h2>Fee structure drafts</h2><p>Review cloned amounts. These drafts are inactive until individually confirmed.</p></div><button className="as-btn as-btn-light" onClick={() => void loadFeeDrafts()}><RefreshCw size={15}/> Refresh</button></div>
      {feeDrafts.length ? <div className="as-table-scroll"><table><thead><tr><th>Fee structure</th><th>Frequency</th><th>Items</th><th>Total amount</th><th>Actions</th></tr></thead><tbody>{feeDrafts.map((fee:any) => <tr key={fee._id}><td><strong>{fee.name}</strong><small>{fee.code}</small></td><td>{fee.frequency}</td><td>{fee.items?.length || 0}</td><td>₹{Number(fee.totalAmount || 0).toLocaleString("en-IN")}</td><td><div className="as-actions"><button onClick={() => editFee(fee)}>Review / edit</button><button onClick={() => void activateFee(fee)} disabled={!!busy}>{busy === `fee-${fee._id}` ? "Activating…" : "Activate"}</button></div></td></tr>)}</tbody></table></div> : <div className="as-empty">No inactive fee drafts found for this destination session. Clone source fee structures to begin.</div>}
      {editingFee && <div className="as-fee-editor"><h3>Review {editingFee.code}</h3><label>Structure name<input value={feeName} onChange={e => setFeeName(e.target.value)}/></label>{(editingFee.items || []).map((item:any) => { const key=String(item.feeHeadId?._id || item.feeHeadId); return <label key={key}>{item.name}<input type="number" min="0" value={feeAmounts[key] ?? String(item.amount)} onChange={e => setFeeAmounts(old => ({...old,[key]:e.target.value}))}/></label>; })}<div className="as-form-actions"><button className="as-btn as-btn-light" onClick={() => setEditingFee(null)}>Cancel</button><button className="as-btn as-btn-primary" disabled={busy==="fee-save"} onClick={() => void saveFeeDraft()}>{busy==="fee-save"?"Saving…":"Save draft changes"}</button></div></div>}
    </section>}
  </main>;
}

export function AcademicSessionReports() {
  const [items, setItems] = useState<any[]>([]), [sessions, setSessions] = useState<SessionOption[]>([]);
  const [sessionId, setSessionId] = useState(""), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const loadSessions = useCallback(async () => { try { setSessions(rows(unwrap(await api.get("/sessions", { params: { page: 1, limit: 100 } })))); } catch (e:any) { setError(e?.response?.data?.message || "Session filters could not be loaded."); } }, []);
  const load = useCallback(async () => { setLoading(true); try { setItems(rows(unwrap(await api.get("/sessions/reports", { params: sessionId ? { sessionId } : {} })))); setError(""); } catch (e: any) { setError(e?.response?.data?.message || "Reports could not be loaded."); } finally { setLoading(false); } }, [sessionId]);
  useEffect(() => { void loadSessions(); }, [loadSessions]);
  useEffect(() => { void load(); }, [load]);
  return <main className="academic-sessions"><header className="as-header"><div><span className="as-eyebrow">MIREXERP / REPORTS</span><h1>Academic Session Reports</h1><p>Session-wise student, class, promotion, detention and fee-structure summaries.</p></div><Link className="as-btn as-btn-light" href="/sessions">Back to sessions</Link></header>
    {error && <div className="as-alert as-error"><AlertCircle size={17}/>{error}</div>}
    <section className="as-table-panel"><div className="as-form-grid as-select-grid"><label>Filter by session<select value={sessionId} onChange={e => setSessionId(e.target.value)}><option value="">All sessions</option>{sessions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select></label><button className="as-btn as-btn-light as-align-end" onClick={() => void load()}><RefreshCw size={15}/> Refresh</button></div>
      <div className="as-table-heading"><div><h2>Session summary</h2><p>Active-session counts use current Student records; historical counts use StudentEnrollment history.</p></div></div>
      {loading ? <div className="as-loading">Loading report data…</div> : items.length ? <div className="as-table-scroll"><table><thead><tr><th>Session</th><th>Classes</th><th>Active students</th><th>Completed</th><th>Promoted</th><th>Detained</th><th>Fee structures</th><th>Draft fees</th><th>Active fees</th></tr></thead><tbody>{items.map((r:any) => <tr key={r.session._id}><td><strong>{r.session.name}</strong><small>{r.session.status || (r.session.isClosed ? "CLOSED" : r.session.isActive ? "ACTIVE" : "UPCOMING")}</small></td><td>{r.classCount}</td><td>{r.activeStudents}</td><td>{r.completedStudents}</td><td>{r.promotedStudents}</td><td>{r.detainedStudents}</td><td>{r.feeStructureCount}</td><td>{r.draftFeeStructures}</td><td>{r.activeFeeStructures}</td></tr>)}</tbody></table></div> : <div className="as-empty">No session report data available.</div>}
    </section></main>;
}

export function AcademicSessionHistory() {
  const [items, setItems] = useState<any[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); try { setItems(rows(unwrap(await api.get("/sessions/previous")))); setError(""); } catch (e: any) { setError(e?.response?.data?.message || "Previous sessions could not be loaded."); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  return <main className="academic-sessions"><header className="as-header"><div><span className="as-eyebrow">MIREXERP / ARCHIVE</span><h1>Previous Academic Sessions</h1><p>Historical sessions remain available for reference after closure.</p></div><Link className="as-btn as-btn-light" href="/sessions">Back to sessions</Link></header>
    {error && <div className="as-alert as-error"><AlertCircle size={17}/>{error}</div>}
    <section className="as-table-panel"><div className="as-table-heading"><div><h2>Previous sessions</h2><p>Original dates, class and enrollment counts, and closure date.</p></div><button className="as-btn as-btn-light" onClick={() => void load()}><RefreshCw size={15}/> Refresh</button></div>
      {loading ? <div className="as-loading">Loading previous sessions…</div> : items.length ? <div className="as-table-scroll"><table><thead><tr><th>Session</th><th>Start date</th><th>End date</th><th>Status</th><th>Students</th><th>Classes</th><th>Closed on</th></tr></thead><tbody>{items.map((s:any) => <tr key={s._id}><td><strong>{s.name}</strong><small>{s.code}</small></td><td>{dateText(s.startDate)}</td><td>{dateText(s.endDate)}</td><td><span className="as-pill closed">{s.status || "CLOSED"}</span></td><td>{s.studentCount}</td><td>{s.classCount}</td><td>{dateText(s.closedAt)}</td></tr>)}</tbody></table></div> : <div className="as-empty">No previous sessions found.</div>}
    </section></main>;
}

export function AcademicSessionAuditHistory() {
  const [items, setItems] = useState<any[]>([]), [sessions, setSessions] = useState<SessionOption[]>([]);
  const [sessionId, setSessionId] = useState(""), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const loadSessions = useCallback(async () => { try { setSessions(rows(unwrap(await api.get("/sessions", { params: { page: 1, limit: 100 } })))); } catch (e:any) { setError(e?.response?.data?.message || "Session filters could not be loaded."); } }, []);
  const load = useCallback(async () => { setLoading(true); try { setItems(rows(unwrap(await api.get("/sessions/history", { params: sessionId ? { sessionId } : {} })))); setError(""); } catch (e:any) { setError(e?.response?.data?.message || "Session audit history could not be loaded."); } finally { setLoading(false); } }, [sessionId]);
  useEffect(() => { void loadSessions(); }, [loadSessions]);
  useEffect(() => { void load(); }, [load]);
  return <main className="academic-sessions"><header className="as-header"><div><span className="as-eyebrow">MIREXERP / AUDIT</span><h1>Session History</h1><p>Creation, edits, activation, deactivation, preparation and closure events.</p></div><Link className="as-btn as-btn-light" href="/sessions">Back to sessions</Link></header>
    {error && <div className="as-alert as-error"><AlertCircle size={17}/>{error}</div>}
    <section className="as-table-panel"><div className="as-form-grid as-select-grid"><label>Filter by session<select value={sessionId} onChange={e => setSessionId(e.target.value)}><option value="">All sessions</option>{sessions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select></label><button className="as-btn as-btn-light as-align-end" onClick={() => void load()}><RefreshCw size={15}/> Refresh</button></div>
      <div className="as-table-heading"><div><h2>Audit events</h2><p>Events are retained on their original academic session.</p></div></div>
      {loading ? <div className="as-loading">Loading audit history…</div> : items.length ? <div className="as-table-scroll"><table><thead><tr><th>Session</th><th>Action</th><th>Performed at</th><th>Performed by</th><th>Details</th></tr></thead><tbody>{items.map((x:any,i:number) => <tr key={`${x.sessionId}-${x.performedAt}-${i}`}><td>{x.sessionName}</td><td><span className="as-pill">{x.action}</span></td><td>{dateText(x.performedAt)} {new Date(x.performedAt).toLocaleTimeString("en-IN")}</td><td>{x.performedBy?.name || x.performedBy?.email || String(x.performedBy || "—")}</td><td>{x.details || "—"}</td></tr>)}</tbody></table></div> : <div className="as-empty">No audit events found.</div>}
    </section></main>;
}

export function AcademicSessionDetained() {
  const [sessions, setSessions] = useState<SessionOption[]>([]), [sessionId, setSessionId] = useState(""), [items, setItems] = useState<any[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const loadSessions = useCallback(async () => { try { setSessions(rows(unwrap(await api.get("/sessions", { params: { page: 1, limit: 100 } })))); } catch (e:any) { setError(e?.response?.data?.message || "Sessions could not be loaded."); } }, []);
  useEffect(() => { void loadSessions(); }, [loadSessions]);
  const load = async () => { if (!sessionId) return; setLoading(true); setError(""); try { setItems(rows(unwrap(await api.get(`/sessions/${sessionId}/detained`)))); } catch (e:any) { setError(e?.response?.data?.message || "Detained students could not be loaded."); } finally { setLoading(false); } };
  return <main className="academic-sessions"><header className="as-header"><div><span className="as-eyebrow">MIREXERP / PROMOTION</span><h1>Detained / Not Promoted Students</h1><p>Students remain associated with their source session; no destination enrollment is created.</p></div><Link className="as-btn as-btn-light" href="/sessions">Back to sessions</Link></header>
    {error && <div className="as-alert as-error"><AlertCircle size={17}/>{error}</div>}
    <section className="as-table-panel"><div className="as-form-grid as-select-grid"><label>Academic session<select value={sessionId} onChange={e => setSessionId(e.target.value)}><option value="">Select session</option>{sessions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select></label><button className="as-btn as-btn-primary as-align-end" onClick={() => void load()} disabled={!sessionId || loading}>{loading ? "Loading…" : "Load detained students"}</button></div>
      {loading ? <div className="as-loading">Loading detained students…</div> : items.length ? <div className="as-table-scroll"><table><thead><tr><th>Admission no.</th><th>Student</th><th>Class</th><th>Section</th><th>Detained date</th><th>Reason</th></tr></thead><tbody>{items.map((x:any) => { const s=x.studentId || {}; return <tr key={x._id}><td>{s.admissionNumber || "—"}</td><td>{[s.firstName,s.middleName,s.lastName].filter(Boolean).join(" ")}</td><td>{x.classId?.name || "—"}</td><td>{x.sectionId?.name || "—"}</td><td>{dateText(x.detainedAt || x.endedAt)}</td><td>{x.detentionReason || "—"}</td></tr>; })}</tbody></table></div> : sessionId ? <div className="as-empty">No detained students for this session.</div> : <div className="as-empty">Select a session to view detained students.</div>}
    </section></main>;
}

export function AcademicSessionPromotion() {
  const search = useSearchParams();
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [sourceId, setSourceId] = useState(search.get("sourceSessionId") || "");
  const [destinationId, setDestinationId] = useState(search.get("destinationSessionId") || "");
  const [preview, setPreview] = useState<any>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [structure, setStructure] = useState<any>(null);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [detained, setDetained] = useState<string[]>([]);
  const [reason, setReason] = useState("Not promoted by academic decision");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadSessions = useCallback(async () => { try { setSessions(rows(unwrap(await api.get("/sessions", { params: { page: 1, limit: 100 } })))); } catch (e:any) { setError(e?.response?.data?.message || "Sessions could not be loaded."); } }, []);
  useEffect(() => { void loadSessions(); }, [loadSessions]);
  const loadPreview = async (pageNumber = 1) => {
    if (!sourceId || !destinationId || sourceId === destinationId) { setError("Select different source and destination sessions."); return; }
    setBusy(true); setError(""); setPreview(null);
    try {
      const [p, r] = await Promise.all([
        api.get("/sessions/promotion/preview", { params: { sourceSessionId: sourceId, destinationSessionId: destinationId, page: pageNumber, limit: 100 } }),
        api.get("/class-section/reports", { params: { sessionId: destinationId } }),
      ]);
      setPreview(unwrap(p)); setPreviewPage(pageNumber); setStructure(unwrap(r)); setSelected([]); setDetained([]);
      setClassId(""); setSectionId("");
    } catch (e:any) { setError(e?.response?.data?.message || "Promotion preview failed."); }
    finally { setBusy(false); }
  };
  const sections = useMemo(() => (structure?.sections || []).filter((s:any) => String(s.classId) === classId), [structure, classId]);
  const toggle = (id: string, isDetained: boolean) => {
    if (isDetained) { setDetained(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]); setSelected(old => old.filter(x => x !== id)); }
    else { setSelected(old => old.includes(id) ? old.filter(x => x !== id) : [...old, id]); setDetained(old => old.filter(x => x !== id)); }
  };
  const submitPromotion = async () => {
    if (!selected.length && !detained.length) { setError("Select students to promote or mark as detained."); return; }
    if (selected.length && (!classId || !sectionId)) { setError("Select destination class and section for promoted students."); return; }
    if (!window.confirm(`Process ${selected.length} promotion(s) and ${detained.length} detention decision(s)?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const promotions = [
        ...selected.map(studentId => ({ studentId, classId, sectionId, status: "PROMOTED" })),
        ...detained.map(studentId => ({ studentId, status: "DETAINED", reason })),
      ];
      const result = unwrap(await api.post("/sessions/promotion/execute", { fromSessionId: sourceId, toSessionId: destinationId, promotions }));
      setNotice(`${result.promoted || 0} promoted · ${result.detained || 0} detained.`);
      await loadPreview(previewPage);
    } catch (e:any) { setError(e?.response?.data?.message || "Promotion could not be processed."); }
    finally { setBusy(false); }
  };
  const eligible = preview?.eligibleStudents || [];
  const destinationClasses = structure?.classes || [];
  return <main className="academic-sessions"><header className="as-header"><div><span className="as-eyebrow">MIREXERP / STUDENT MOVEMENT</span><h1>Session-wise Student Promotion</h1><p>Preview source-session eligibility, select destination class/section, and record detained decisions without overwriting previous enrollment.</p></div><Link className="as-btn as-btn-light" href="/sessions">Back to sessions</Link></header>
    {notice && <div className="as-alert as-success"><CheckCircle2 size={17}/>{notice}</div>}{error && <div className="as-alert as-error"><AlertCircle size={17}/>{error}</div>}
    <section className="as-table-panel"><div className="as-form-grid as-select-grid"><label>Source session<select value={sourceId} onChange={e => setSourceId(e.target.value)}><option value="">Select source session</option>{sessions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select></label><label>Destination session<select value={destinationId} onChange={e => setDestinationId(e.target.value)}><option value="">Select destination session</option>{sessions.map(s => <option key={s._id} value={s._id} disabled={s.isClosed || s.isActive}>{s.name}</option>)}</select></label><button className="as-btn as-btn-primary as-align-end" disabled={busy} onClick={() => void loadPreview()}>{busy ? "Loading…" : "Preview eligible students"}</button></div>
      {preview && <div className="as-inline-stats"><span>Total active: <b>{preview.counts?.totalActive ?? 0}</b></span><span>Eligible on this page: <b>{preview.counts?.eligibleOnPage ?? 0}</b></span><span>Excluded on this page: <b>{preview.counts?.excludedOnPage ?? 0}</b></span></div>}
    </section>
    {preview && <>
      <section className="as-table-panel"><div className="as-table-heading"><div><h2>Destination placement</h2><p>One destination class and section can be applied to the selected promotion batch. For different destinations, run separate batches.</p></div></div>
        <div className="as-form-grid as-select-grid"><label>Destination class<select value={classId} onChange={e => { setClassId(e.target.value); setSectionId(""); }}><option value="">Select class</option>{destinationClasses.map((c:any) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></label><label>Destination section<select value={sectionId} onChange={e => setSectionId(e.target.value)}><option value="">Select section</option>{sections.map((s:any) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></label></div>
      </section>
      <section className="as-table-panel"><div className="as-table-heading"><div><h2>Eligible students</h2><p>Tick students to promote or mark as detained.</p></div><span>{selected.length} promote · {detained.length} detain</span></div>
        {eligible.length ? <div className="as-table-scroll"><table><thead><tr><th>Promote</th><th>Detain</th><th>Admission no.</th><th>Student</th><th>Previous class</th><th>Previous section</th></tr></thead><tbody>{eligible.map((s:any) => <tr key={s._id}><td><input type="checkbox" checked={selected.includes(s._id)} onChange={() => toggle(s._id,false)}/></td><td><input type="checkbox" checked={detained.includes(s._id)} onChange={() => toggle(s._id,true)}/></td><td>{s.admissionNumber}</td><td>{[s.firstName,s.middleName,s.lastName].filter(Boolean).join(" ")}</td><td>{s.classId?.name || "—"}</td><td>{s.sectionId?.name || "—"}</td></tr>)}</tbody></table></div> : <div className="as-empty">No eligible students found.</div>}
        {preview.pagination?.pages > 1 && <div className="as-pagination"><span>Page {preview.pagination.page} of {preview.pagination.pages} · {preview.pagination.total} source students</span><div><button disabled={busy || preview.pagination.page <= 1} onClick={() => void loadPreview(preview.pagination.page - 1)}>Previous</button><button disabled={busy || preview.pagination.page >= preview.pagination.pages} onClick={() => void loadPreview(preview.pagination.page + 1)}>Next</button></div></div>}
        {detained.length > 0 && <label className="as-reason">Detention reason<input value={reason} onChange={e => setReason(e.target.value)} maxLength={500}/></label>}
        <div className="as-form-actions"><button className="as-btn as-btn-primary" disabled={busy || (!selected.length && !detained.length)} onClick={() => void submitPromotion()}>{busy ? "Processing…" : "Process selected students"}</button></div>
      </section>
    </>}
  </main>;
}
