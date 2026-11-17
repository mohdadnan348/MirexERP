"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";

type AnyRecord = Record<string, any>;
const payload = (r: any) => r?.data?.data ?? r?.data ?? r;
const list = (r: any): AnyRecord[] => { const p = payload(r); return Array.isArray(p) ? p : p?.items ?? p?.classes ?? p?.sessions ?? p?.data ?? []; };
export default function ClassSectionManagementPage() {
  const [sessions, setSessions] = useState<AnyRecord[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [report, setReport] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/sessions", { params: { limit: 100 } }).then(r => { const rows = list(r); setSessions(rows); const active = rows.find(x => x.isActive); setSessionId(active?._id || rows[0]?._id || ""); }).catch(() => setError("Unable to load academic sessions.")); }, []);
  useEffect(() => { if (!sessionId) return; setLoading(true); setError(""); api.get("/class-section/reports", { params: { sessionId } }).then(r => setReport(payload(r))).catch((e: any) => setError(e?.response?.data?.message || "Unable to load class and section report.")).finally(() => setLoading(false)); }, [sessionId]);
  const summary = report?.summary || {};
  return <main className="space-y-6 p-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Class & Section Management</h1><p className="text-sm text-gray-500">Session-wise classes, capacity, allocations and teacher assignments.</p></div>
      <select className="rounded-lg border p-2" value={sessionId} onChange={e => setSessionId(e.target.value)}><option value="">Select academic session</option>{sessions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}</select>
    </header>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[["Total Classes",summary.totalClasses],["Total Sections",summary.totalSections],["Allocated Students",summary.totalAllocatedStudents],["Available Seats",summary.availableSeats],["Full Sections",summary.fullSections]].map(([label,value]) => <div key={String(label)} className="rounded-xl border bg-white p-4"><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-2xl font-semibold">{loading ? "…" : value ?? "—"}</p></div>)}</div>
    <div className="flex flex-wrap gap-2"><a className="rounded-lg bg-blue-600 px-4 py-2 text-white" href="/classes">Manage Classes</a><a className="rounded-lg border px-4 py-2" href="/sections">Manage Sections</a><a className="rounded-lg border px-4 py-2" href="/student-allocation">Student Allocation</a><a className="rounded-lg border px-4 py-2" href="/subject-teacher-assignments">Subject Teachers</a><a className="rounded-lg border px-4 py-2" href="/class-section-reports">Reports</a></div>
    <section className="rounded-xl border bg-white p-4"><h2 className="mb-3 text-lg font-semibold">Class-wise strength and sections</h2>{loading ? <p>Loading report…</p> : !report?.classes?.length ? <p className="text-gray-500">No classes found for this academic session.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="p-2">Class</th><th className="p-2">Sections</th><th className="p-2">Students</th><th className="p-2">Status</th></tr></thead><tbody>{report.classes.map((c: AnyRecord) => <tr className="border-b" key={c._id}><td className="p-2 font-medium">{c.name}</td><td className="p-2">{c.sections?.length || 0}</td><td className="p-2">{c.totalStudents || 0}</td><td className="p-2">{c.isActive ? "Active" : "Inactive"}</td></tr>)}</tbody></table></div>}</section>
    <section className="rounded-xl border bg-white p-4"><h2 className="mb-3 text-lg font-semibold">Section capacity</h2>{!report?.sections?.length ? <p className="text-gray-500">No sections found.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="p-2">Section</th><th className="p-2">Class</th><th className="p-2">Capacity</th><th className="p-2">Enrolled</th><th className="p-2">Available</th><th className="p-2">Class Teacher</th></tr></thead><tbody>{report.sections.map((s: AnyRecord) => <tr className="border-b" key={s._id}><td className="p-2">{s.name}</td><td className="p-2">{s.classId?.name || "—"}</td><td className="p-2">{s.capacity ?? "No limit"}</td><td className="p-2">{s.enrolledStudents}</td><td className="p-2">{s.availableSeats ?? "—"}</td><td className="p-2">{s.classTeacherId?.fullName || [s.classTeacherId?.firstName,s.classTeacherId?.lastName].filter(Boolean).join(" ") || "Unassigned"}</td></tr>)}</tbody></table></div>}</section>
  </main>;
}
