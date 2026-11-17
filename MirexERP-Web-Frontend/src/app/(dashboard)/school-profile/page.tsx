"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Building2, Plus, RefreshCw, Save, Upload, MapPin, FileText } from "lucide-react";
import { api } from "@/lib/api/client";
import "./page.css";

type SchoolProfile = { _id: string; name: string; code: string; email: string; phone: string; timezone?: string; currency?: string; address?: { city?: string; state?: string; postalCode?: string }; affiliation?: { board?: string; affiliationNumber?: string } };
type Branch = { _id: string; name: string; code: string; status: string; address: { city: string; state: string } };
type SchoolDoc = { _id: string; title: string; category: string; originalName: string; size: number; createdAt: string };
type ApiResult<T> = { data?: T };
const unwrap = <T,>(v: unknown): T => { const root = v as ApiResult<unknown>; const value = root?.data ?? v; return ((value as ApiResult<T>)?.data ?? value) as T; };

export default function SchoolProfilePage() {
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [documents, setDocuments] = useState<SchoolDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [branchForm, setBranchForm] = useState({ name: "", code: "", city: "", state: "", postalCode: "" });
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentCategory, setDocumentCategory] = useState("AFFILIATION_CERTIFICATE");
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setMessage("");
    try {
      const [p, b, d] = await Promise.all([api.get("/school-management/profile"), api.get("/school-management/branches"), api.get("/school-management/documents")]);
      setProfile(unwrap<SchoolProfile>(p));
      const branchPayload = unwrap<unknown>(b) as { data?: Branch[] } | Branch[];
      setBranches(Array.isArray(branchPayload) ? branchPayload : branchPayload.data ?? []);
      setDocuments(unwrap<SchoolDoc[]>(d));
    } catch (e) { setMessage((e as Error).message || "Unable to load school profile"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!profile) return;
    setSaving(true); setMessage("");
    try { const response = await api.patch("/school-management/profile", { name: profile.name, phone: profile.phone, address: profile.address, affiliation: profile.affiliation, timezone: profile.timezone, currency: profile.currency }); setProfile(unwrap<SchoolProfile>(response)); setMessage("School profile updated successfully."); }
    catch (e) { setMessage((e as Error).message || "Unable to save profile"); }
    finally { setSaving(false); }
  };

  const addBranch = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage("");
    try { await api.post("/school-management/branches", { name: branchForm.name, code: branchForm.code, address: { city: branchForm.city, state: branchForm.state, postalCode: branchForm.postalCode, country: "India" } }); setBranchForm({ name: "", code: "", city: "", state: "", postalCode: "" }); await load(); setMessage("Branch created successfully."); }
    catch (e) { setMessage((e as Error).message || "Unable to create branch"); }
    finally { setSaving(false); }
  };

  const uploadDocument = async (event: FormEvent) => {
    event.preventDefault(); if (!documentFile) return;
    const form = new FormData(); form.append("file", documentFile); form.append("title", documentTitle); form.append("category", documentCategory);
    setSaving(true); setMessage("");
    try { await api.post("/school-management/documents", form, { headers: { "Content-Type": "multipart/form-data" } }); setDocumentTitle(""); setDocumentFile(null); setMessage("Document uploaded successfully."); }
    catch (e) { setMessage((e as Error).message || "Unable to upload document"); }
    finally { setSaving(false); }
  };

  if (loading) return <main className="school-profile-page"><p>Loading school profile…</p></main>;
  if (!profile) return <main className="school-profile-page"><p role="alert">{message || "School profile is unavailable."}</p><button onClick={() => void load()}><RefreshCw size={16}/> Retry</button></main>;

  return <main className="school-profile-page">
    <header className="school-profile-heading"><div><span className="school-profile-kicker">SCHOOL SETUP</span><h1><Building2 size={25}/> School Profile & Branches</h1><p>Manage your tenant profile, campus branches and official documents.</p></div><button onClick={() => void load()} className="school-profile-refresh"><RefreshCw size={16}/> Refresh</button></header>
    {message && <div className="school-profile-message" role="status">{message}</div>}
    <section className="school-profile-card"><h2>School information</h2><form onSubmit={save} className="school-profile-grid">
      <label>School name<input required minLength={2} value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })}/></label>
      <label>School code<input value={profile.code} disabled/></label>
      <label>Timezone<input value={profile.timezone ?? "Asia/Kolkata"} onChange={e => setProfile({ ...profile, timezone: e.target.value })}/></label>
      <label>Currency<input maxLength={3} value={profile.currency ?? "INR"} onChange={e => setProfile({ ...profile, currency: e.target.value.toUpperCase() })}/></label>
      <label>Email<input value={profile.email} disabled/></label>
      <label>Phone<input required value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })}/></label>
      <label>City<input value={profile.address?.city ?? ""} onChange={e => setProfile({ ...profile, address: { ...profile.address, city: e.target.value } })}/></label>
      <label>State<input value={profile.address?.state ?? ""} onChange={e => setProfile({ ...profile, address: { ...profile.address, state: e.target.value } })}/></label>
      <label>Board<input value={profile.affiliation?.board ?? ""} onChange={e => setProfile({ ...profile, affiliation: { ...profile.affiliation, board: e.target.value } })}/></label>
      <label>Affiliation number<input value={profile.affiliation?.affiliationNumber ?? ""} onChange={e => setProfile({ ...profile, affiliation: { ...profile.affiliation, affiliationNumber: e.target.value } })}/></label>
      <div className="school-profile-actions"><button disabled={saving} type="submit"><Save size={16}/> {saving ? "Saving…" : "Save profile"}</button></div>
    </form></section>
    <section className="school-profile-card"><h2><MapPin size={19}/> Branch management</h2><form onSubmit={addBranch} className="school-profile-grid">
      <label>Branch name<input required value={branchForm.name} onChange={e => setBranchForm({ ...branchForm, name: e.target.value })}/></label><label>Branch code<input required value={branchForm.code} onChange={e => setBranchForm({ ...branchForm, code: e.target.value })}/></label><label>City<input required value={branchForm.city} onChange={e => setBranchForm({ ...branchForm, city: e.target.value })}/></label><label>State<input required value={branchForm.state} onChange={e => setBranchForm({ ...branchForm, state: e.target.value })}/></label><label>6-digit pincode<input required pattern="[0-9]{6}" value={branchForm.postalCode} onChange={e => setBranchForm({ ...branchForm, postalCode: e.target.value })}/></label><div className="school-profile-actions"><button disabled={saving} type="submit"><Plus size={16}/> Add branch</button></div>
    </form><div className="school-profile-branch-list">{branches.length ? branches.map(branch => <article key={branch._id}><strong>{branch.name}</strong><span>{branch.code} · {branch.address.city}, {branch.address.state}</span><small>{branch.status}</small></article>) : <p>No branches have been added.</p>}</div></section>
    <section className="school-profile-card"><h2><FileText size={19}/> School documents</h2><form onSubmit={uploadDocument} className="school-profile-grid"><label>Document title<input required value={documentTitle} onChange={e => setDocumentTitle(e.target.value)}/></label><label>Category<select value={documentCategory} onChange={e => setDocumentCategory(e.target.value)}><option value="AFFILIATION_CERTIFICATE">Affiliation certificate</option><option value="REGISTRATION_CERTIFICATE">Registration certificate</option><option value="RECOGNITION_CERTIFICATE">Recognition certificate</option><option value="OTHER">Other</option></select></label><label>File<input required type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xlsx" onChange={e => setDocumentFile(e.target.files?.[0] ?? null)}/></label><div className="school-profile-actions"><button disabled={saving || !documentFile} type="submit"><Upload size={16}/> Upload document</button></div></form><div className="school-profile-branch-list">{documents.length ? documents.map(doc => <article key={doc._id}><strong>{doc.title}</strong><span>{doc.category.replaceAll("_", " ")} · {doc.originalName}</span><small>{new Date(doc.createdAt).toLocaleDateString()}</small><button type="button" onClick={async () => { const result = await api.get(`/school-management/documents/${doc._id}/download`, { responseType: "blob" }); const url = URL.createObjectURL(result.data); const anchor = document.createElement("a"); anchor.href = url; anchor.download = doc.originalName; anchor.click(); URL.revokeObjectURL(url); }}>Download</button></article>) : <p>No documents uploaded yet.</p>}</div><p className="school-profile-note">Documents are stored as private school records and require authenticated access to download.</p></section>
  </main>;
}
