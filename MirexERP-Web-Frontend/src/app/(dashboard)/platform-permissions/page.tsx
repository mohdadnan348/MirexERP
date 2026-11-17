"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { AlertCircle, Check, Plus, RefreshCw, Save, ShieldCheck, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";

type PlatformRole = {
  _id: string;
  name: string;
  code: string;
  description?: string;
  scope: "PLATFORM" | "SCHOOL";
  permissions: string[];
  isSystem?: boolean;
  isActive?: boolean;
  createdAt?: string;
};

const PERMISSION_GROUPS: Record<string, string[]> = {
  "Platform & Schools": ["schools.read", "schools.create", "schools.update", "schools.approve", "schools.delete"],
  "Users & Security": ["users.read", "users.create", "users.update", "users.delete", "roles.read", "roles.create", "roles.update", "audit-logs.read"],
  "Academics": ["sessions.read", "sessions.create", "sessions.update", "sessions.activate", "classes.read", "classes.create", "classes.update", "subjects.read", "subjects.create", "subjects.update"],
  "Students & Admissions": ["students.read", "students.create", "students.update", "students.delete", "admissions.read", "admissions.create", "admissions.approve"],
  "Attendance & Exams": ["attendance.read", "attendance.mark", "attendance.correct", "exams.read", "exams.create", "exams.marks.enter", "exams.approve"],
  "Fees & Finance": ["fees.read", "fees.create", "fees.collect", "fees.refund", "fees.approve", "fees.update", "finance.read", "finance.create", "finance.update"],
  "Reports & Settings": ["reports.read", "reports.export", "settings.read", "settings.update"],
};

function extractItems(payload: any): PlatformRole[] {
  const data = payload?.data?.data ?? payload?.data ?? payload;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.records)) return data.records;
  return [];
}

export default function Page() {
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", description: "", scope: "SCHOOL" as "PLATFORM" | "SCHOOL", permissions: [] as string[] });

  const selected = useMemo(() => roles.find((role) => role._id === selectedId) ?? null, [roles, selectedId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/platform/roles", { params: { page: 1, limit: 100 } });
      const nextRoles = extractItems(response);
      setRoles(nextRoles);
      setSelectedId((current) => nextRoles.some((role) => role._id === current) ? current : nextRoles[0]?._id ?? "");
    } catch (cause: any) {
      setError(cause?.response?.data?.message || cause?.message || "Could not load roles. Sign in as Super Admin and retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const updatePermissions = async () => {
    if (!selected) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await api.put(`/platform/roles/${selected._id}/permissions`, { permissions: selected.permissions });
      setNotice(`Permissions saved for ${selected.name}.`);
      await load();
    } catch (cause: any) {
      setError(cause?.response?.data?.message || cause?.message || "Could not save permissions.");
    } finally { setSaving(false); }
  };

  const createRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await api.post("/platform/roles", { ...form, code: form.code.trim().toUpperCase() });
      const created = response?.data?.data?.data ?? response?.data?.data;
      setShowCreate(false);
      setForm({ name: "", code: "", description: "", scope: "SCHOOL", permissions: [] });
      await load();
      if (created?._id) setSelectedId(created._id);
      setNotice("Role created successfully.");
    } catch (cause: any) {
      setError(cause?.response?.data?.message || cause?.message || "Could not create role.");
    } finally { setSaving(false); }
  };

  const togglePermission = (permission: string) => {
    if (!selected) return;
    const permissions = selected.permissions.includes(permission)
      ? selected.permissions.filter((item) => item !== permission)
      : [...selected.permissions, permission];
    setRoles((current) => current.map((role) => role._id === selected._id ? { ...role, permissions } : role));
  };

  return <main style={{ padding: 24, display: "grid", gap: 18, color: "#25213b" }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <div><small style={{ letterSpacing: 2, color: "#7651c9", fontWeight: 800 }}>MIREXERP / SECURITY</small><h1 style={{ fontSize: 28, margin: "8px 0" }}>Roles & Permissions</h1><p style={{ color: "#77748b", margin: 0 }}>Manage trusted API permissions for platform and school roles.</p></div>
      <div style={{ display: "flex", gap: 8 }}><button onClick={() => void load()} disabled={loading} style={buttonStyle}><RefreshCw size={15}/> Refresh</button><button onClick={() => setShowCreate(true)} style={{ ...buttonStyle, background: "#6541c8", color: "white", borderColor: "#6541c8" }}><Plus size={15}/> Create role</button></div>
    </header>
    {error && <div role="alert" style={alertStyle}><AlertCircle size={17}/>{error}</div>}
    {notice && <div role="status" style={{ ...alertStyle, background: "#eefbf4", borderColor: "#ccebd9", color: "#167447" }}><Check size={17}/>{notice}</div>}
    <section style={{ display: "grid", gridTemplateColumns: "minmax(240px, 310px) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
      <aside style={panelStyle}>
        <h2 style={{ fontSize: 15, margin: "0 0 14px" }}>Configured roles <span style={{ color: "#999", fontWeight: 500 }}>({roles.length})</span></h2>
        {loading ? <p style={muted}>Loading roles…</p> : roles.length ? roles.map((role) => <button key={role._id} onClick={() => setSelectedId(role._id)} style={{ display: "grid", width: "100%", textAlign: "left", gap: 5, padding: 12, marginBottom: 7, borderRadius: 10, border: selectedId === role._id ? "1px solid #9c83e4" : "1px solid #eeeaf5", background: selectedId === role._id ? "#f6f2ff" : "#fff", cursor: "pointer" }}><strong style={{ fontSize: 13, color: "#302a49" }}>{role.name}</strong><span style={{ color: "#817b95", fontSize: 11 }}>{role.code} · {role.scope}</span><span style={{ color: "#8b849d", fontSize: 10 }}>{role.permissions?.length ?? 0} permissions {role.isSystem ? "· System" : ""}</span></button>) : <p style={muted}>No roles configured yet.</p>}
      </aside>
      <section style={panelStyle}>
        {selected ? <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap", paddingBottom: 15, borderBottom: "1px solid #f0edf5" }}><div><div style={{ display: "flex", gap: 8, alignItems: "center" }}><ShieldCheck size={19} color="#7450c7"/><h2 style={{ fontSize: 17, margin: 0 }}>{selected.name}</h2></div><p style={{ color: "#89839a", fontSize: 11, margin: "7px 0 0" }}>{selected.description || "No description"} · {selected.scope} scope</p></div><button onClick={() => void updatePermissions()} disabled={saving || selected.isSystem} style={{ ...buttonStyle, background: "#6541c8", color: "white", borderColor: "#6541c8", opacity: selected.isSystem ? .55 : 1 }}><Save size={15}/>{saving ? "Saving…" : "Save permissions"}</button></div>
          {selected.isSystem && <p style={muted}>System role permission changes are locked.</p>}
          <div style={{ display: "grid", gap: 17, paddingTop: 16 }}>
            {Object.entries(PERMISSION_GROUPS).map(([group, permissions]) => <div key={group}><h3 style={{ fontSize: 12, margin: "0 0 9px", color: "#4b4561" }}>{group}</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>{permissions.map((permission) => <label key={permission} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", border: "1px solid #f0edf5", borderRadius: 9, color: "#615b73", fontSize: 11 }}><input type="checkbox" checked={selected.permissions.includes(permission)} disabled={selected.isSystem || saving} onChange={() => togglePermission(permission)}/><code>{permission}</code></label>)}</div></div>)}
          </div>
          <p style={{ ...muted, marginTop: 16 }}>Permission checks are performed by the API using the authenticated user and database role configuration. Hiding a menu item in the web app is not a security boundary.</p>
        </> : <div style={{ minHeight: 260, display: "grid", placeContent: "center", textAlign: "center" }}><ShieldCheck size={30} color="#9b8bd0"/><h2 style={{ fontSize: 15 }}>Select a role</h2><p style={muted}>Choose a configured role to inspect its permission matrix.</p></div>}
      </section>
    </section>
    {showCreate && <div role="presentation" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#17132b88", display: "grid", placeItems: "center", padding: 18 }}><form onSubmit={createRole} style={{ ...panelStyle, width: "min(520px,100%)", display: "grid", gap: 12 }}><h2 style={{ margin: 0, fontSize: 18 }}>Create role</h2><label style={fieldStyle}>Role name<input required minLength={2} maxLength={80} value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} style={inputStyle}/></label><label style={fieldStyle}>Role code<input required pattern="[A-Za-z0-9_-]+" maxLength={50} value={form.code} onChange={(e) => setForm((v) => ({ ...v, code: e.target.value.toUpperCase() }))} style={inputStyle} placeholder="e.g. TEACHER"/></label><label style={fieldStyle}>Scope<select value={form.scope} onChange={(e) => setForm((v) => ({ ...v, scope: e.target.value as "PLATFORM" | "SCHOOL" }))} style={inputStyle}><option value="SCHOOL">School</option><option value="PLATFORM">Platform</option></select></label><label style={fieldStyle}>Description<textarea maxLength={500} value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} style={{ ...inputStyle, minHeight: 70 }}/></label><footer style={{ display: "flex", justifyContent: "end", gap: 8 }}><button type="button" onClick={() => setShowCreate(false)} style={buttonStyle}>Cancel</button><button disabled={saving} style={{ ...buttonStyle, background: "#6541c8", color: "white", borderColor: "#6541c8" }}>{saving ? "Creating…" : "Create role"}</button></footer></form></div>}
  </main>;
}

const buttonStyle: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid #e6e1ef", borderRadius: 9, padding: "9px 12px", background: "#fff", color: "#554d6b", fontSize: 12, fontWeight: 700, cursor: "pointer" };
const panelStyle: CSSProperties = { background: "#fff", border: "1px solid #ece9f2", borderRadius: 14, padding: 17, boxShadow: "0 5px 20px #2c1c4b08" };
const muted: CSSProperties = { color: "#89839a", fontSize: 11, lineHeight: 1.6 };
const alertStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 9, border: "1px solid #f2d0ce", borderRadius: 10, padding: 12, background: "#fff5f4", color: "#ad4039", fontSize: 12 };
const fieldStyle: CSSProperties = { display: "grid", gap: 6, color: "#625b73", fontSize: 12 };
const inputStyle: CSSProperties = { width: "100%", border: "1px solid #e6e1ef", borderRadius: 8, padding: "10px 11px", outlineColor: "#8b6bd4", color: "#302a49", background: "#fff", font: "inherit" };
