"use client";

import { useCallback, useEffect, useState } from "react";
import { ModuleWorkspace } from "@/components/modules/ModuleWorkspace";
import { api } from "@/lib/api/client";

type Correction = {
  _id: string;
  previousStatus: string;
  requestedStatus: string;
  reason: string;
  decision: string;
  attendanceId?: { attendanceDate?: string; studentId?: { firstName?: string; lastName?: string; admissionNumber?: string } };
  requestedBy?: { name?: string; email?: string };
};

export default function Page() {
  const [items, setItems] = useState<Correction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/attendance/corrections", { params: { decision: "PENDING" } });
      const payload = response?.data?.data ?? response?.data;
      setItems(Array.isArray(payload) ? payload : []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Unable to load correction requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const review = async (id: string, decision: "APPROVED" | "REJECTED") => {
    const reviewRemarks = decision === "REJECTED" ? window.prompt("Reason for rejection (optional):") || "" : "";
    setBusy(id);
    try {
      await api.patch(`/attendance/corrections/${id}/review`, { decision, reviewRemarks });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Unable to review this correction.");
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <ModuleWorkspace moduleKey="attendance" />
      <section className="mx-6 mb-8 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Attendance Correction Approval</h2>
            <p className="text-sm text-gray-500">Review requests with mandatory reasons. Only School Admin and Principal can approve or reject.</p>
          </div>
          <button type="button" onClick={load} className="rounded-lg border px-3 py-2 text-sm">Refresh</button>
        </div>
        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
        {loading ? <p className="text-sm text-gray-500">Loading requests…</p> : items.length === 0 ? <p className="text-sm text-gray-500">No pending correction requests.</p> : (
          <div className="space-y-3">
            {items.map((item) => {
              const student = item.attendanceId?.studentId;
              return (
                <article key={item._id} className="flex flex-wrap items-start justify-between gap-4 rounded-lg border p-4">
                  <div className="min-w-0">
                    <p className="font-medium">{student ? [student.firstName, student.lastName].filter(Boolean).join(" ") : "Employee attendance"} {student?.admissionNumber ? `(${student.admissionNumber})` : ""}</p>
                    <p className="text-sm text-gray-600">{item.previousStatus} → {item.requestedStatus} · {item.attendanceId?.attendanceDate ? new Date(item.attendanceId.attendanceDate).toLocaleDateString() : "Date unavailable"}</p>
                    <p className="mt-1 text-sm">Reason: {item.reason}</p>
                    <p className="text-xs text-gray-500">Requested by {item.requestedBy?.name || item.requestedBy?.email || "School user"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button disabled={busy === item._id} onClick={() => review(item._id, "APPROVED")} className="rounded-lg bg-green-700 px-3 py-2 text-sm text-white disabled:opacity-50">Approve</button>
                    <button disabled={busy === item._id} onClick={() => review(item._id, "REJECTED")} className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50">Reject</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
