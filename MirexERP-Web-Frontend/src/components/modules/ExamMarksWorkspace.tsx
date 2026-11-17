"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import { AlertCircle, CheckCircle2, ClipboardList, RefreshCw, Save } from "lucide-react";
import "./ExamMarksWorkspace.css";

type MarkRow = {
  _id?: string;
  studentId?: { admissionNumber?: string; firstName?: string; lastName?: string } | string;
  subjectId?: { name?: string; code?: string; subjectName?: string; subjectCode?: string } | string;
  marksObtained: number;
  remarks?: string;
  isAbsent?: boolean;
};
type ResultRow = {
  student?: { admissionNumber?: string; firstName?: string; lastName?: string };
  totalObtained: number;
  totalMaximum: number;
  percentage: number;
  result: "PASS" | "FAIL";
};

const example = "[]";

export function ExamMarksWorkspace() {
  const [examId, setExamId] = useState("");
  const [json, setJson] = useState(example);
  const [marks, setMarks] = useState<MarkRow[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [dashboard, setDashboard] = useState<Record<string, number>>({});
  const [feeHeadId, setFeeHeadId] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [feeDueDate, setFeeDueDate] = useState("");
  const [feeStatus, setFeeStatus] = useState<Record<string, unknown> | null>(null);

  useEffect(() => { api.get("/exams/dashboard/summary").then(response => setDashboard(response.data?.data || {})).catch(() => undefined); }, []);

  const loadMarks = async () => {
    if (!examId.trim()) { setError("Enter an examination ID first."); return; }
    setLoading(true); setError(""); setNotice(""); setResults([]);
    try {
      const response = await api.get(`/exams/${examId}/marks`, { params: { page: 1, limit: 100 } });
      const payload = response.data?.data;
      setMarks(Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : []);
    } catch (cause) {
      const err = cause as { response?: { data?: { message?: string } }; message?: string };
      setError(err.response?.data?.message || err.message || "Unable to load marks.");
      setMarks([]);
    } finally { setLoading(false); }
  };

  const saveMarks = async () => {
    if (!examId.trim()) { setError("Enter an examination ID first."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const parsed: unknown = JSON.parse(json);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Marks JSON must be a non-empty array.");
      await api.put(`/exams/${examId}/marks`, { marks: parsed });
      setNotice("Marks saved. Reload the marks list to verify persisted records.");
      await loadMarks();
    } catch (cause) {
      const err = cause as { response?: { data?: { message?: string } }; message?: string };
      setError(err.response?.data?.message || err.message || "Unable to save marks.");
    } finally { setSaving(false); }
  };

  const loadResults = async () => {
    if (!examId.trim()) { setError("Enter an examination ID first."); return; }
    setLoading(true); setError(""); setNotice("");
    try {
      const response = await api.get(`/exams/${examId}/results`);
      const payload = response.data?.data;
      setResults(Array.isArray(payload) ? payload : []);
    } catch (cause) {
      const err = cause as { response?: { data?: { message?: string } }; message?: string };
      setError(err.response?.data?.message || err.message || "Results are unavailable until published.");
      setResults([]);
    } finally { setLoading(false); }
  };


  const runWorkflow = async (action: "submit" | "verify" | "approve" | "publish") => {
    if (!examId.trim()) { setError("Enter an examination ID first."); return; }
    setWorkflowBusy(true); setError(""); setNotice("");
    try {
      await api.patch(`/exams/${examId}/workflow/${action}`);
      setNotice(`Result workflow action '${action}' completed successfully.`);
      await loadMarks();
    } catch (cause) {
      const err = cause as { response?: { data?: { message?: string } }; message?: string };
      setError(err.response?.data?.message || err.message || `Unable to ${action} results.`);
    } finally { setWorkflowBusy(false); }
  };


  const createExamFees = async () => {
    if (!examId.trim() || !feeHeadId.trim() || !feeAmount || !feeDueDate) { setError("Exam ID, fee head ID, amount and due date are required."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await api.post(`/fees/exams/${examId}/invoices`, { feeHeadId, amount: Number(feeAmount), dueDate: feeDueDate });
      setNotice(`Exam fee invoices created: ${response.data?.data?.created ?? 0}.`);
      const status = await api.get(`/fees/exams/${examId}/status`);
      setFeeStatus(status.data?.data || null);
    } catch (cause) {
      const err = cause as { response?: { data?: { message?: string } }; message?: string };
      setError(err.response?.data?.message || err.message || "Unable to generate examination fee invoices.");
    } finally { setSaving(false); }
  };

  const studentName = (value: MarkRow["studentId"]) => typeof value === "object" && value ? `${value.firstName || ""} ${value.lastName || ""}`.trim() : String(value || "—");
  const subjectName = (value: MarkRow["subjectId"]) => typeof value === "object" && value ? value.subjectName || value.name || value.subjectCode || value.code || "—" : String(value || "—");

  return <section className="exam-marks">
    <header><div><span className="exam-marks-kicker">ASSESSMENT WORKFLOW</span><h2><ClipboardList size={20}/> Marks entry & results</h2><p>Enter an exam ID to load marks, save bulk entries, and run the controlled result approval workflow.</p></div></header>
    <div className="exam-marks-dashboard">{[["Total exams",dashboard.totalExaminations],["Upcoming",dashboard.upcoming],["Ongoing",dashboard.ongoing],["Completed",dashboard.completed],["Pending verification",dashboard.resultsPendingVerification],["Pending approval",dashboard.resultsPendingApproval],["Published",dashboard.publishedResults]].map(([label,value])=><article key={String(label)}><span>{label}</span><strong>{Number(value)||0}</strong></article>)}</div>
    <div className="exam-marks-controls"><label>Examination ID<input value={examId} onChange={event => setExamId(event.target.value)} placeholder="MongoDB examination ID"/></label><button onClick={loadMarks} disabled={loading}><RefreshCw size={15}/> Load marks</button><button className="secondary" onClick={loadResults} disabled={loading}>Published results</button></div>
    {error && <div className="exam-marks-alert error"><AlertCircle size={16}/>{error}</div>}
    {notice && <div className="exam-marks-alert success"><CheckCircle2 size={16}/>{notice}</div>}
    <div className="exam-marks-fees"><strong>Examination fee integration</strong><div><input value={feeHeadId} onChange={e=>setFeeHeadId(e.target.value)} placeholder="Examination fee head ID"/><input type="number" min="0.01" step="0.01" value={feeAmount} onChange={e=>setFeeAmount(e.target.value)} placeholder="Amount (₹)"/><input type="date" value={feeDueDate} onChange={e=>setFeeDueDate(e.target.value)}/><button onClick={()=>void createExamFees()} disabled={saving}>Generate student invoices</button><button className="secondary" onClick={async()=>{try{const r=await api.get(`/fees/exams/${examId}/status`);setFeeStatus(r.data?.data||null);setError("");}catch(e:any){setError(e?.response?.data?.message||"Unable to load exam fee status.");}}}>Fee status</button></div>{feeStatus&&<pre>{JSON.stringify(feeStatus.totals||feeStatus,null,2)}</pre>}</div>
    <div className="exam-marks-workflow"><strong>Result workflow</strong><div><button onClick={()=>void runWorkflow("submit")} disabled={workflowBusy}>Submit marks</button><button onClick={()=>void runWorkflow("verify")} disabled={workflowBusy}>Verify</button><button onClick={()=>void runWorkflow("approve")} disabled={workflowBusy}>Approve</button><button onClick={()=>void runWorkflow("publish")} disabled={workflowBusy}>Publish results</button></div><small>Each action is validated by the backend; approval locks marks and publication is separate.</small></div>
    <div className="exam-marks-editor"><label>Bulk marks JSON<textarea spellCheck={false} value={json} onChange={event => setJson(event.target.value)}/></label><button onClick={saveMarks} disabled={saving}><Save size={15}/>{saving ? "Saving..." : "Save marks"}</button><small>Each entry requires studentId, subjectId and marksObtained. Set isAbsent:true with marksObtained:0 for an absent student. Missing entries remain distinct from absent.</small></div>
    {loading && <p className="exam-marks-empty">Loading examination data...</p>}
    {marks.length > 0 && <div className="exam-marks-table"><h3>Saved marks ({marks.length})</h3><table><thead><tr><th>Student</th><th>Subject</th><th>Marks</th><th>Remarks</th></tr></thead><tbody>{marks.map((row, index) => <tr key={row._id || index}><td>{studentName(row.studentId)}</td><td>{subjectName(row.subjectId)}</td><td>{row.isAbsent ? "Absent" : row.marksObtained}</td><td>{row.remarks || "—"}</td></tr>)}</tbody></table></div>}
    {results.length > 0 && <div className="exam-marks-table"><h3>Published results ({results.length})</h3><table><thead><tr><th>Student</th><th>Total</th><th>Percentage</th><th>Result</th></tr></thead><tbody>{results.map((row, index) => <tr key={index}><td>{row.student?.admissionNumber || `${row.student?.firstName || ""} ${row.student?.lastName || ""}`}</td><td>{row.totalObtained}/{row.totalMaximum}</td><td>{row.percentage}%</td><td><strong className={row.result === "PASS" ? "pass" : "fail"}>{row.result}</strong></td></tr>)}</tbody></table></div>}
  </section>;
}
