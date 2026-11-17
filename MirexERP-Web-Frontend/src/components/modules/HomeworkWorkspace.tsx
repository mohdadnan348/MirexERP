"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import styles from "./HomeworkWorkspace.module.css";

type Row = Record<string, any>;
const listData = (response: any): Row[] => {
  const data = response?.data?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.records)) return data.records;
  return [];
};
const oneData = (response: any) => response?.data?.data ?? null;
const idOf = (row: Row) => String(row?._id || row?.id || "");
const label = (row: Row) => row?.name || row?.displayName || row?.title || [row?.firstName, row?.lastName].filter(Boolean).join(" ") || row?.employeeId || idOf(row);
const dateText = (value: any) => value ? new Date(value).toLocaleDateString("en-IN") : "—";
const errorText = (e: any) => e?.response?.data?.message || e?.message || "Something went wrong.";

export function HomeworkWorkspace() {
  const [role, setRole] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Row>({});
  const [reports, setReports] = useState<{ classWise: Row[]; subjectWise: Row[]; late: Row[]; evaluations: Row[] }>({ classWise: [], subjectWise: [], late: [], evaluations: [] });
  const [classes, setClasses] = useState<Row[]>([]);
  const [sections, setSections] = useState<Row[]>([]);
  const [subjects, setSubjects] = useState<Row[]>([]);
  const [sessions, setSessions] = useState<Row[]>([]);
  const [teachers, setTeachers] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [submissions, setSubmissions] = useState<Row[]>([]);
  const [pending, setPending] = useState<Row[]>([]);
  const [pendingSearch, setPendingSearch] = useState("");
  const [pendingStatus, setPendingStatus] = useState("");
  const [activeTab, setActiveTab] = useState<"submissions" | "pending">("submissions");
  const [selectedSubmission, setSelectedSubmission] = useState<Row | null>(null);
  const [evaluationHistory, setEvaluationHistory] = useState<Row[]>([]);
  const [evaluation, setEvaluation] = useState({ marksObtained: "", feedback: "", requestResubmission: false });
  const [childId, setChildId] = useState("");
  const [answer, setAnswer] = useState("");
  const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
  const [filters, setFilters] = useState({ sessionId: "", classId: "", sectionId: "", subjectId: "", teacherId: "", status: "", startDate: "", endDate: "" });

  const canManage = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"].includes(role);
  const isParent = role === "PARENT";

  useEffect(() => {
    try { setRole(String(JSON.parse(sessionStorage.getItem("mirexerp_user") || "{}").role || "").toUpperCase()); }
    catch { setRole(""); }
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params: Row = { page: 1, limit: 100, search: search || undefined };
      if (canManage) {
        if (filters.sessionId) params.academicSessionId = filters.sessionId;
        if (filters.classId) params.classId = filters.classId;
        if (filters.sectionId) params.sectionId = filters.sectionId;
        if (filters.subjectId) params.subjectId = filters.subjectId;
        if (filters.teacherId) params.teacherId = filters.teacherId;
        if (filters.status) params.status = filters.status;
        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate) params.endDate = filters.endDate;
      }
      const [homeworkResponse, summaryResponse, classResponse, subjectResponse, lateResponse, evaluationResponse] = await Promise.all([
        api.get("/homework", { params }),
        canManage ? api.get("/homework/reports/summary") : Promise.resolve({ data: { data: {} } }),
        canManage ? api.get("/homework/reports/class-wise") : Promise.resolve({ data: { data: [] } }),
        canManage ? api.get("/homework/reports/subject-wise") : Promise.resolve({ data: { data: [] } }),
        canManage ? api.get("/homework/reports/late-submissions") : Promise.resolve({ data: { data: [] } }),
        canManage ? api.get("/homework/reports/evaluations", { params: { page: 1, limit: 20 } }) : Promise.resolve({ data: { data: [] } }),
      ]);
      setRows(listData(homeworkResponse));
      setSummary(oneData(summaryResponse) || {});
      setReports({ classWise: listData(classResponse), subjectWise: listData(subjectResponse), late: listData(lateResponse), evaluations: listData(evaluationResponse) });
    } catch (e: any) { setError(errorText(e)); setRows([]); }
    finally { setLoading(false); }
  }, [search, canManage, filters]);
  useEffect(() => { if (role) load(); }, [role, load]);

  useEffect(() => {
    if (!canManage) return;
    Promise.all([
      api.get("/classes", { params: { limit: 100 } }),
      api.get("/sections", { params: { limit: 200 } }),
      api.get("/subjects", { params: { limit: 200 } }),
      api.get("/sessions", { params: { limit: 100 } }),
      role === "TEACHER" ? Promise.resolve({ data: { data: [] } }) : api.get("/employees", { params: { limit: 200, employeeType: "TEACHING" } }),
      role === "TEACHER" ? api.get("/subjects/teacher/my-assignments") : Promise.resolve({ data: { data: [] } }),
    ]).then(([c, s, sub, ses, t, assignmentsResponse]) => {
      if (role === "TEACHER") {
        const assignments = listData(assignmentsResponse);
        const unique = (values: Row[]) => Array.from(new Map<string, Row>(values.map((value) => [idOf(value), value] as [string, Row])).values());
        setClasses(unique(assignments.map((assignment) => assignment.classId).filter(Boolean)));
        setSections(unique(assignments.map((assignment) => assignment.sectionId).filter(Boolean)));
        setSubjects(unique(assignments.map((assignment) => assignment.subjectId).filter(Boolean)));
        setSessions(unique(assignments.map((assignment) => assignment.sessionId).filter(Boolean)));
        setTeachers([]);
      } else {
        setClasses(listData(c)); setSections(listData(s)); setSubjects(listData(sub)); setSessions(listData(ses)); setTeachers(listData(t));
      }
    }).catch(() => undefined);
  }, [canManage, role]);

  const rowStatus = (row: Row) => {
    if (canManage) return row.status || "—";
    if (isParent && !childId) return "Select child";
    const submission = row.mySubmission || row.childSubmissions?.find((entry: Row) => String(entry.studentId) === childId)?.submission;
    return submission?.status || (new Date(row.dueDate) < new Date() ? "OVERDUE" : "PENDING");
  };

  const openCreate = () => { setEditing(null); setShowForm(true); setNotice(""); setError(""); };
  const openEdit = (row: Row) => { setEditing(row); setShowForm(true); setNotice(""); setError(""); };

  const saveHomework = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    const form = new FormData(event.currentTarget);
    const body = new FormData();
    ["academicSessionId", "classId", "subjectId", "teacherId", "title", "description", "instructions", "assignedDate", "dueDate", "totalMarks", "status"].forEach((key) => {
      const value = form.get(key);
      if (value !== null && value !== "") body.append(key, String(value));
    });
    ["allowSubmission", "allowLateSubmission", "allowResubmission"].forEach((key) => body.append(key, form.get(key) === "true" ? "true" : "false"));
    const selectedSections = form.getAll("sectionIds").map(String).filter(Boolean);
    body.append("sectionIds", JSON.stringify(selectedSections));
    form.getAll("attachments").forEach((value) => { if (value instanceof File && value.size > 0) body.append("attachments", value); });
    try {
      if (editing) await api.patch(`/homework/${idOf(editing)}`, body, { headers: { "Content-Type": "multipart/form-data" } });
      else await api.post("/homework", body, { headers: { "Content-Type": "multipart/form-data" } });
      setShowForm(false); setNotice(editing ? "Homework updated." : "Homework created."); await load();
    } catch (e: any) { setError(errorText(e)); }
    finally { setSaving(false); }
  };

  const openDetails = async (row: Row) => {
    setError(""); setNotice("");
    try {
      if (isParent && !childId) throw new Error("Please select the child whose homework you want to open.");
      const response = await api.get(`/homework/${idOf(row)}`, { params: isParent ? { studentId: childId } : undefined });
      const detail = oneData(response); setSelected(detail);
      if (canManage) {
        const [subResponse, pendingResponse] = await Promise.all([
          api.get(`/homework/${idOf(row)}/submissions`, { params: { page: 1, limit: 100 } }),
          api.get(`/homework/${idOf(row)}/pending`),
        ]);
        setSubmissions(listData(subResponse)); setPending(oneData(pendingResponse)?.items || []);
      }
    } catch (e: any) { setError(errorText(e)); }
  };

  const changeLifecycle = async (row: Row, action: "publish" | "archive") => {
    try {
      await api.patch(`/homework/${idOf(row)}/${action}`);
      setNotice(action === "publish" ? "Homework published." : "Homework archived.");
      await load();
    } catch (e: any) { setError(errorText(e)); }
  };

  const openEvaluation = async (submission: Row) => {
    setSelectedSubmission(submission);
    setEvaluation({ marksObtained: submission.marksObtained == null ? "" : String(submission.marksObtained), feedback: submission.feedback || "", requestResubmission: false });
    setEvaluationHistory([]);
    try {
      const response = await api.get(`/homework/submissions/${idOf(submission)}/history`);
      setEvaluationHistory(oneData(response)?.evaluationHistory || []);
    } catch (e: any) { setError(errorText(e)); }
  };

  const saveEvaluation = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || !selectedSubmission) return;
    setSaving(true); setError("");
    try {
      await api.patch(`/homework/${idOf(selected)}/submissions/${idOf(selectedSubmission)}/evaluate`, {
        marksObtained: evaluation.marksObtained === "" ? undefined : Number(evaluation.marksObtained),
        feedback: evaluation.feedback,
        requestResubmission: evaluation.requestResubmission,
      });
      setNotice("Evaluation saved.");
      const response = await api.get(`/homework/${idOf(selected)}/submissions`, { params: { page: 1, limit: 100 } });
      setSubmissions(listData(response)); setSelectedSubmission(null);
    } catch (e: any) { setError(errorText(e)); }
    finally { setSaving(false); }
  };

  const submitAnswer = async (homework: Row) => {
    setSaving(true); setError(""); setNotice("");
    const body = new FormData();
    body.append("answer", answer);
    if (isParent && childId) body.append("studentId", childId);
    submissionFiles.forEach((file) => body.append("attachments", file));
    try {
      await api.post(`/homework/${idOf(homework)}/submit`, body, { headers: { "Content-Type": "multipart/form-data" } });
      setAnswer(""); setSubmissionFiles([]); setNotice("Homework submitted successfully.");
      await load();
      if (selected) await openDetails(selected);
    } catch (e: any) { setError(errorText(e)); }
    finally { setSaving(false); }
  };

  const downloadFile = async (url: string, name: string) => {
    try {
      const response = await api.get(url.replace(/^\/api\/v1/, ""), { responseType: "blob" });
      const blob = new Blob([response.data]);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a"); anchor.href = objectUrl; anchor.download = name; anchor.click(); URL.revokeObjectURL(objectUrl);
    } catch (e: any) { setError(errorText(e)); }
  };

  return <div className={styles.workspace}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}>MIREXERP / ACADEMICS</span><h1>Homework & Assignments</h1><p>Create assignments, collect student work and track evaluation.</p></div>
      <div className={styles.headerActions}><button className={styles.secondary} onClick={load}>Refresh</button>{canManage && <button className={styles.primary} onClick={openCreate}>+ Create homework</button>}</div>
    </header>

    {error && <div className={styles.error}>{error}</div>}
    {notice && <div className={styles.notice}>{notice}</div>}

    {canManage && <div className={styles.stats}>
      {[["Total homework", summary.total], ["Published", summary.published], ["Pending students", summary.pending], ["Submitted", summary.submitted], ["Late", summary.late], ["Evaluated", summary.evaluated], ["Overdue", summary.overdue]].map(([name, value]) =>
        <div className={styles.stat} key={String(name)}><span>{name}</span><strong>{Number(value || 0).toLocaleString("en-IN")}</strong></div>)}
    </div>}

    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search homework..." />
        {canManage && <>
          <select value={filters.sessionId} onChange={(e) => setFilters((v) => ({ ...v, sessionId: e.target.value }))}><option value="">All sessions</option>{sessions.map((x) => <option key={idOf(x)} value={idOf(x)}>{label(x)}</option>)}</select>
          <select value={filters.classId} onChange={(e) => setFilters((v) => ({ ...v, classId: e.target.value, sectionId: "" }))}><option value="">All classes</option>{classes.map((c) => <option key={idOf(c)} value={idOf(c)}>{label(c)}</option>)}</select>
          <select value={filters.sectionId} onChange={(e) => setFilters((v) => ({ ...v, sectionId: e.target.value }))}><option value="">All sections</option>{sections.filter((x) => !filters.classId || String(x.classId?._id || x.classId) === filters.classId).map((x) => <option key={idOf(x)} value={idOf(x)}>{label(x)}</option>)}</select>
          <select value={filters.subjectId} onChange={(e) => setFilters((v) => ({ ...v, subjectId: e.target.value }))}><option value="">All subjects</option>{subjects.map((s) => <option key={idOf(s)} value={idOf(s)}>{label(s)}</option>)}</select>
          {role !== "TEACHER" && <select value={filters.teacherId} onChange={(e) => setFilters((v) => ({ ...v, teacherId: e.target.value }))}><option value="">All teachers</option>{teachers.map((t) => <option key={idOf(t)} value={idOf(t)}>{label(t)}</option>)}</select>}
          <input type="date" aria-label="Due from" value={filters.startDate} onChange={(e) => setFilters((v) => ({ ...v, startDate: e.target.value }))} />
          <input type="date" aria-label="Due to" value={filters.endDate} onChange={(e) => setFilters((v) => ({ ...v, endDate: e.target.value }))} />
          <select value={filters.status} onChange={(e) => setFilters((v) => ({ ...v, status: e.target.value }))}><option value="">All statuses</option>{["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"].map((v) => <option key={v}>{v}</option>)}</select>
        </>}
      </div>
      {isParent && rows.some((r) => r.childSubmissions?.length) && <div className={styles.childSelect}><label>Child</label><select value={childId} onChange={(e) => setChildId(e.target.value)}><option value="">Choose linked child when submitting</option>{Array.from(new Map<string, Row>(rows.flatMap((r) => (r.childSubmissions || []).map((x: Row) => [String(x.studentId), x] as [string, Row]))).values()).map((x: Row) => <option key={String(x.studentId)} value={String(x.studentId)}>{x.studentName}</option>)}</select></div>}
      {loading ? <div className={styles.empty}>Loading homework...</div> : rows.length === 0 ? <div className={styles.empty}>No homework records found.</div> :
        <div className={styles.tableWrap}><table className={styles.table}><thead><tr>{["Homework", "Class / Section", "Subject", "Teacher", "Assigned", "Due date", "Submissions", "Pending", "Status", "Action"].map((x) => <th key={x}>{x}</th>)}</tr></thead><tbody>
          {rows.map((row) => <tr key={idOf(row)}>
            <td><strong>{row.title}</strong><small>{row.description}</small></td>
            <td>{row.classId?.name || row.classId}<small>{row.sectionIds?.length ? row.sectionIds.map(label).join(", ") : row.sectionId?.name || "All sections"}</small></td>
            <td>{row.subjectId?.name || row.subjectId}</td><td>{row.teacherId?.fullName || [row.teacherId?.firstName, row.teacherId?.lastName].filter(Boolean).join(" ") || "—"}</td>
            <td>{dateText(row.assignedDate)}</td><td>{dateText(row.dueDate)}</td><td>{canManage ? row.totalSubmissions ?? 0 : "—"}</td><td>{canManage ? row.pendingSubmissions ?? 0 : "—"}</td><td><span className={`${styles.status} ${styles[String(rowStatus(row)).toLowerCase()] || ""}`}>{rowStatus(row)}</span></td>
            <td><div className={styles.actions}><button onClick={() => openDetails(row)}>View</button>{canManage && <><button onClick={() => openEdit(row)}>Edit</button>{row.status === "DRAFT" && <button onClick={() => changeLifecycle(row, "publish")}>Publish</button>}{row.status === "PUBLISHED" && <button onClick={() => changeLifecycle(row, "archive")}>Archive</button>}</>}</div></td>
          </tr>)}
        </tbody></table></div>}
    </section>

    {canManage && <section className={styles.panel}>
      <h2 className={styles.reportHeading}>Homework reports</h2>
      <div className={styles.reportGrid}>
        <div><h3>Class-wise</h3>{reports.classWise.length ? reports.classWise.map((r, i) => <p key={String(r._id || i)}>{r.name || String(r._id)} <strong>{r.homeworkCount}</strong> · overdue {r.overdueCount}</p>) : <small>No class report data.</small>}</div>
        <div><h3>Subject-wise</h3>{reports.subjectWise.length ? reports.subjectWise.map((r, i) => <p key={String(r._id || i)}>{r.name || String(r._id)} <strong>{r.homeworkCount}</strong> · overdue {r.overdueCount}</p>) : <small>No subject report data.</small>}</div>
        <div><h3>Late submissions</h3>{reports.late.length ? reports.late.slice(0, 8).map((r, i) => <p key={idOf(r) || i}>{r.studentId?.firstName} {r.studentId?.lastName} · {r.homeworkId?.title} <strong>{dateText(r.submittedAt)}</strong></p>) : <small>No late submissions.</small>}</div>
        <div><h3>Evaluation report</h3>{reports.evaluations.length ? reports.evaluations.slice(0, 8).map((r, i) => <p key={idOf(r) || i}>{r.studentId?.firstName} {r.studentId?.lastName} · {r.homeworkId?.title} <strong>{r.marksObtained ?? "—"} / {r.homeworkId?.totalMarks ?? "—"}</strong></p>) : <small>No evaluated submissions.</small>}</div>
      </div>
    </section>}

    {showForm && <div className={styles.overlay}><section className={styles.modal}>
      <div className={styles.modalHeader}><h2>{editing ? "Edit homework" : "Create homework"}</h2><button onClick={() => setShowForm(false)}>×</button></div>
      <form onSubmit={saveHomework} className={styles.form}>
        <div className={styles.formGrid}>
          <label>Academic session<select name="academicSessionId" required defaultValue={editing?.academicSessionId?._id || editing?.academicSessionId || sessions.find((x) => x.isActive)?._id || ""}><option value="">Select session</option>{sessions.map((x) => <option key={idOf(x)} value={idOf(x)}>{label(x)}</option>)}</select></label>
          <label>Class<select name="classId" required defaultValue={editing?.classId?._id || editing?.classId || ""}><option value="">Select class</option>{classes.map((x) => <option key={idOf(x)} value={idOf(x)}>{label(x)}</option>)}</select></label>
          <label>Section(s)<select name="sectionIds" multiple defaultValue={(editing?.sectionIds || (editing?.sectionId ? [editing.sectionId] : [])).map((x: any) => String(x?._id || x))}>{sections.map((x) => <option key={idOf(x)} value={idOf(x)}>{label(x)}</option>)}</select><small>Use Ctrl/Cmd to select multiple sections. Leave empty for the whole class.</small></label>
          <label>Subject<select name="subjectId" required defaultValue={editing?.subjectId?._id || editing?.subjectId || ""}><option value="">Select subject</option>{subjects.map((x) => <option key={idOf(x)} value={idOf(x)}>{label(x)}</option>)}</select></label>
          {role !== "TEACHER" && <label>Assigned teacher<select name="teacherId" required defaultValue={editing?.teacherId?._id || editing?.teacherId || ""}><option value="">Select teacher</option>{teachers.map((x) => <option key={idOf(x)} value={idOf(x)}>{label(x)}</option>)}</select></label>}
          <label>Title<input name="title" required minLength={3} maxLength={200} defaultValue={editing?.title || ""} /></label>
          <label>Assigned date<input type="date" name="assignedDate" defaultValue={editing?.assignedDate ? new Date(editing.assignedDate).toISOString().slice(0,10) : ""} /></label>
          <label>Due date<input type="date" name="dueDate" required defaultValue={editing?.dueDate ? new Date(editing.dueDate).toISOString().slice(0,10) : ""} /></label>
          <label>Maximum marks (optional)<input type="number" name="totalMarks" min="0" step="0.5" defaultValue={editing?.totalMarks ?? ""} /></label>
          <label className={styles.full}>Description<textarea name="description" required rows={3} defaultValue={editing?.description || ""} /></label>
          <label className={styles.full}>Instructions<textarea name="instructions" rows={2} defaultValue={editing?.instructions || ""} /></label>
          <label className={styles.full}>Attachments (max 10 MB each)<input type="file" name="attachments" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,.xls,.xlsx" /></label>
          <label className={styles.check}><input type="checkbox" name="allowSubmission" value="true" defaultChecked={editing?.allowSubmission !== false} /> Allow student submissions</label>
          <label className={styles.check}><input type="checkbox" name="allowLateSubmission" value="true" defaultChecked={editing?.allowLateSubmission === true} /> Allow late submissions</label>
          <label className={styles.check}><input type="checkbox" name="allowResubmission" value="true" defaultChecked={editing?.allowResubmission === true} /> Allow resubmission (after teacher request)</label>
          <label>Status<select name="status" defaultValue={editing?.status || "DRAFT"}><option value="DRAFT">Draft</option><option value="PUBLISHED">Publish now</option></select></label>
        </div>
        <div className={styles.modalFooter}><button type="button" className={styles.secondary} onClick={() => setShowForm(false)}>Cancel</button><button disabled={saving} className={styles.primary}>{saving ? "Saving..." : editing ? "Save changes" : "Create homework"}</button></div>
      </form>
    </section></div>}

    {selected && <div className={styles.overlay}><section className={`${styles.modal} ${styles.wide}`}>
      <div className={styles.modalHeader}><div><h2>{selected.title}</h2><p>{selected.subjectId?.name || "Subject"} · Due {dateText(selected.dueDate)}</p></div><button onClick={() => { setSelected(null); setSelectedSubmission(null); }}>×</button></div>
      <p className={styles.description}>{selected.description}</p>
      {selected.instructions && <p>{selected.instructions}</p>}
      <div className={styles.attachments}>{(selected.attachments || []).map((file: Row, i: number) => <button key={file._id || i} onClick={() => downloadFile(file.url, file.name)}>Download {file.name}</button>)}</div>
      {canManage ? <>
        <div className={styles.tabs}><button className={activeTab === "submissions" ? styles.activeTab : ""} onClick={() => setActiveTab("submissions")}>Submissions ({submissions.length})</button><button className={activeTab === "pending" ? styles.activeTab : ""} onClick={() => setActiveTab("pending")}>Pending ({pending.length})</button></div>
        {activeTab === "submissions" ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Student</th><th>Admission no.</th><th>Submitted</th><th>Status</th><th>Marks</th><th>Action</th></tr></thead><tbody>{submissions.map((s) => <tr key={idOf(s)}><td>{s.studentId?.firstName} {s.studentId?.lastName}</td><td>{s.studentId?.admissionNumber}</td><td>{dateText(s.submittedAt)}</td><td>{s.status}</td><td>{s.marksObtained ?? "—"} / {selected.totalMarks ?? "—"}</td><td><button onClick={() => openEvaluation(s)}>Evaluate</button></td></tr>)}</tbody></table></div> : <>
          <div className={styles.toolbar}><input value={pendingSearch} onChange={(e) => setPendingSearch(e.target.value)} placeholder="Search student or admission number..." /><select value={pendingStatus} onChange={(e) => setPendingStatus(e.target.value)}><option value="">All pending statuses</option>{["PENDING", "OVERDUE", "RESUBMISSION_REQUESTED", "LATE"].map((value) => <option key={value}>{value}</option>)}</select></div>
          <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Student</th><th>Admission no.</th><th>Section</th><th>Due date</th><th>Status</th><th>Late</th></tr></thead><tbody>{pending.filter((s) => (!pendingSearch || `${s.studentName} ${s.admissionNumber}`.toLowerCase().includes(pendingSearch.toLowerCase())) && (!pendingStatus || (pendingStatus === "LATE" ? s.isLate : s.status === pendingStatus))).map((s) => <tr key={String(s.studentId)}><td>{s.studentName}</td><td>{s.admissionNumber}</td><td>{s.section}</td><td>{dateText(s.dueDate)}</td><td>{s.status}</td><td>{s.isLate ? "Yes" : "No"}</td></tr>)}</tbody></table></div></>}
        {selectedSubmission && <form onSubmit={saveEvaluation} className={styles.evaluation}><h3>Evaluate: {selectedSubmission.studentId?.firstName} {selectedSubmission.studentId?.lastName}</h3><p>{selectedSubmission.answer || "No text answer submitted."}</p><div className={styles.attachments}>{(selectedSubmission.attachments || []).map((file: Row, i: number) => <button type="button" key={file._id || i} onClick={() => downloadFile(file.url, file.name)}>Download {file.name}</button>)}</div><div className={styles.history}><strong>Evaluation history</strong>{evaluationHistory.length ? evaluationHistory.map((entry, i) => <p key={entry._id || i}>{entry.action} · {dateText(entry.evaluatedAt)} · {entry.marksObtained ?? "No marks"} · {entry.feedback || "No feedback"}</p>) : <small>No previous evaluation history.</small>}</div><label>Marks<input type="number" min="0" max={selected.totalMarks ?? undefined} step="0.5" value={evaluation.marksObtained} onChange={(e) => setEvaluation((v) => ({ ...v, marksObtained: e.target.value }))} /></label><label>Feedback<textarea rows={3} value={evaluation.feedback} onChange={(e) => setEvaluation((v) => ({ ...v, feedback: e.target.value }))} /></label><label className={styles.check}><input type="checkbox" checked={evaluation.requestResubmission} onChange={(e) => setEvaluation((v) => ({ ...v, requestResubmission: e.target.checked }))} /> Request resubmission</label><button className={styles.primary} disabled={saving}>{saving ? "Saving..." : "Save evaluation"}</button></form>}
      </> : <div className={styles.studentSubmit}>
        {(selected.mySubmission || selected.childSubmissions?.length) && <p>Submission status: <strong>{selected.mySubmission?.status || selected.childSubmissions?.find((x: Row) => x.studentId === childId)?.submission?.status || "Pending"}</strong></p>}
        {selected.mySubmission?.marksObtained !== undefined && <p>Marks: {selected.mySubmission.marksObtained} / {selected.totalMarks} · {selected.mySubmission.feedback}</p>}
        {selected.allowSubmission !== false && <><label>Your answer<textarea rows={5} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Write your answer..." /></label><label>Attach files (10 MB max each)<input type="file" multiple onChange={(e) => setSubmissionFiles(Array.from(e.target.files || []))} /></label><button className={styles.primary} disabled={saving || (!answer.trim() && !submissionFiles.length) || (isParent && !childId)} onClick={() => submitAnswer(selected)}>{saving ? "Submitting..." : "Submit homework"}</button></>}
      </div>}
    </section></div>}
  </div>;
}
