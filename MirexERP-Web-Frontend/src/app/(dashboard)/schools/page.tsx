"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, Building2, Check, ChevronLeft, ChevronRight, Clock3,
  Database, Edit3, Eye, Filter, MapPin, Plus, RefreshCw, Search,
  ShieldCheck, Trash2, X,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { schoolAdminApi } from "@/lib/api/school-admin";
import "./page.css";

type SchoolStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING" | "EXPIRED";
type SchoolType = "PUBLIC" | "PRIVATE" | "GOVERNMENT" | "OTHER";

type School = {
  _id: string;
  name: string;
  code: string;
  slug: string;
  email: string;
  phone: string;
  address: {
    street?: string;
    area?: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  contact: {
    phone: string;
    alternatePhone?: string;
    email: string;
    website?: string;
  };
  principal?: { name?: string; email?: string; phone?: string };
  affiliation?: { board?: string; affiliationNumber?: string; recognitionNumber?: string };
  schoolType: SchoolType;
  establishedYear?: number;
  status: SchoolStatus;
  isVerified: boolean;
  createdAt?: string;
};

type SchoolForm = {
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
  adminConfirmPassword: string;
  name: string;
  code: string;
  slug: string;
  email: string;
  phone: string;
  street: string;
  area: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  contactPhone: string;
  contactAlternatePhone: string;
  contactEmail: string;
  contactWebsite: string;
  principalName: string;
  principalEmail: string;
  principalPhone: string;
  board: string;
  affiliationNumber: string;
  recognitionNumber: string;
  schoolType: SchoolType;
  establishedYear: string;
};

const emptyForm: SchoolForm = {
  adminName: "", adminEmail: "", adminPhone: "", adminPassword: "", adminConfirmPassword: "",
  name: "", code: "", slug: "", email: "", phone: "",
  street: "", area: "", city: "", state: "", country: "India", postalCode: "",
  contactPhone: "", contactAlternatePhone: "", contactEmail: "", contactWebsite: "",
  principalName: "", principalEmail: "", principalPhone: "",
  board: "", affiliationNumber: "", recognitionNumber: "",
  schoolType: "PRIVATE", establishedYear: "",
};

const statusOptions: SchoolStatus[] = ["PENDING", "ACTIVE", "INACTIVE", "SUSPENDED", "EXPIRED"];

function unwrap<T>(response: unknown): T {
  const root = response as { data?: unknown };
  let value = root?.data ?? response;
  if (value && typeof value === "object" && "data" in (value as object)) {
    value = (value as { data?: unknown }).data ?? value;
  }
  return value as T;
}

function errorMessage(error: unknown) {
  const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
  if (err.response?.status === 429) return "Too many requests. Please wait a moment before trying again.";
  return err.response?.data?.message || err.message || "Something went wrong. Please try again.";
}

function makeSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function mapSchoolToForm(school: School): SchoolForm {
  return {
    adminName: "", adminEmail: "", adminPhone: "", adminPassword: "", adminConfirmPassword: "",
    name: school.name || "", code: school.code || "", slug: school.slug || "",
    email: school.email || "", phone: school.phone || "",
    street: school.address?.street || "", area: school.address?.area || "",
    city: school.address?.city || "", state: school.address?.state || "",
    country: school.address?.country || "India", postalCode: school.address?.postalCode || "",
    contactPhone: school.contact?.phone || "", contactAlternatePhone: school.contact?.alternatePhone || "",
    contactEmail: school.contact?.email || "", contactWebsite: school.contact?.website || "",
    principalName: school.principal?.name || "", principalEmail: school.principal?.email || "",
    principalPhone: school.principal?.phone || "", board: school.affiliation?.board || "",
    affiliationNumber: school.affiliation?.affiliationNumber || "",
    recognitionNumber: school.affiliation?.recognitionNumber || "",
    schoolType: school.schoolType || "PRIVATE",
    establishedYear: school.establishedYear ? String(school.establishedYear) : "",
  };
}

function buildPayload(form: SchoolForm) {
  return {
    name: form.name.trim(),
    code: form.code.trim().toUpperCase(),
    slug: form.slug.trim().toLowerCase(),
    email: form.email.trim().toLowerCase(),
    phone: form.phone.trim(),
    address: {
      ...(form.street.trim() ? { street: form.street.trim() } : {}),
      ...(form.area.trim() ? { area: form.area.trim() } : {}),
      city: form.city.trim(),
      state: form.state.trim(),
      country: form.country.trim() || "India",
      postalCode: form.postalCode.trim(),
    },
    contact: {
      phone: form.contactPhone.trim(),
      ...(form.contactAlternatePhone.trim() ? { alternatePhone: form.contactAlternatePhone.trim() } : {}),
      email: form.contactEmail.trim().toLowerCase(),
      ...(form.contactWebsite.trim() ? { website: form.contactWebsite.trim() } : {}),
    },
    ...(form.principalName || form.principalEmail || form.principalPhone ? {
      principal: {
        ...(form.principalName.trim() ? { name: form.principalName.trim() } : {}),
        ...(form.principalEmail.trim() ? { email: form.principalEmail.trim().toLowerCase() } : {}),
        ...(form.principalPhone.trim() ? { phone: form.principalPhone.trim() } : {}),
      },
    } : {}),
    ...(form.board || form.affiliationNumber || form.recognitionNumber ? {
      affiliation: {
        ...(form.board.trim() ? { board: form.board.trim() } : {}),
        ...(form.affiliationNumber.trim() ? { affiliationNumber: form.affiliationNumber.trim() } : {}),
        ...(form.recognitionNumber.trim() ? { recognitionNumber: form.recognitionNumber.trim() } : {}),
      },
    } : {}),
    schoolType: form.schoolType,
    ...(form.establishedYear ? { establishedYear: Number(form.establishedYear) } : {}),
  };
}

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<School | null>(null);
  const [viewing, setViewing] = useState<School | null>(null);
  const [form, setForm] = useState<SchoolForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState("");
  const [formError, setFormError] = useState("");

  const loadSchools = useCallback(async (refresh = false) => {
    setError("");
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const response = await api.get("/schools", {
        params: {
          page,
          limit: 10,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
        },
      });
      const payload = unwrap<unknown>(response) as {
        items?: School[]; schools?: School[]; pagination?: { total?: number; totalPages?: number };
        meta?: { total?: number; totalPages?: number };
      } | School[];
      const list = Array.isArray(payload)
        ? payload
        : payload?.schools ?? payload?.items ?? [];
      const pagination = !Array.isArray(payload) ? payload.pagination ?? payload.meta : undefined;
      setSchools(list);
      setTotal(pagination?.total ?? list.length);
      setTotalPages(Math.max(1, pagination?.totalPages ?? 1));
    } catch (err) {
      setError(errorMessage(err));
      setSchools([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSchools(), search ? 350 : 0);
    return () => window.clearTimeout(timer);
  }, [loadSchools, search]);

  const stats = useMemo(() => ({
    active: schools.filter((school) => school.status === "ACTIVE").length,
    pending: schools.filter((school) => school.status === "PENDING").length,
    verified: schools.filter((school) => school.isVerified).length,
  }), [schools]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (school: School) => {
    setEditing(school);
    setForm(mapSchoolToForm(school));
    setFormError("");
    setModalOpen(true);
  };

  const setField = (field: keyof SchoolForm, value: string) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "name" && !editing && !current.slug) next.slug = makeSlug(value);
      return next;
    });
  };

  const saveSchool = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    if (form.establishedYear && (Number(form.establishedYear) < 1800 || Number(form.establishedYear) > new Date().getFullYear())) {
      setFormError("Please enter a valid established year.");
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(form);
      if (editing) {
        await api.patch(`/schools/${editing._id}`, payload);
      } else {
        if (form.adminPassword !== form.adminConfirmPassword) {
          setFormError("Admin passwords do not match.");
          setSaving(false);
          return;
        }
        const schoolResponse = await api.post("/schools", payload);
        const responseBody = (schoolResponse as { data?: unknown })?.data ?? schoolResponse;
        const envelope = responseBody as { data?: unknown };
        const schoolResult = (envelope?.data ?? responseBody) as { _id?: string; id?: string; school?: { _id?: string } };
        const createdSchoolId = schoolResult?._id || schoolResult?.id || schoolResult?.school?._id;
        if (!createdSchoolId) {
          throw new Error("School was created, but its ID was not returned by the Schools API. Admin account was not created.");
        }
        await schoolAdminApi.create({
          name: form.adminName.trim(),
          email: form.adminEmail.trim().toLowerCase(),
          phone: form.adminPhone.trim() || undefined,
          password: form.adminPassword,
          confirmPassword: form.adminConfirmPassword,
          schoolId: createdSchoolId,
        });
      }
      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await loadSchools(true);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (school: School, status: SchoolStatus) => {
    setActionId(school._id);
    setError("");
    try {
      await api.patch(`/schools/${school._id}/status`, { status });
      await loadSchools(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActionId("");
    }
  };

  const deleteSchool = async (school: School) => {
    if (!window.confirm(`Delete ${school.name}? This will soft-delete the school.`)) return;
    setActionId(school._id);
    setError("");
    try {
      await api.delete(`/schools/${school._id}`);
      await loadSchools(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setActionId("");
    }
  };

  return (
    <main className="schools-page">
      <header className="schools-hero">
        <div>
          <div className="schools-kicker"><span /> MIREXERP <i>/</i> MANAGEMENT</div>
          <h1>Schools</h1>
          <p>Manage registered schools, their details and operational status.</p>
        </div>
        <div className="schools-hero-actions">
          <button className="schools-button secondary" type="button" onClick={() => void loadSchools(true)} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? "schools-spin" : ""} /> Refresh
          </button>
          <button className="schools-button primary" type="button" onClick={openCreate}>
            <Plus size={17} /> Add school
          </button>
        </div>
      </header>

      <section className="schools-summary">
        <div className="schools-summary-card"><span className="summary-icon purple"><Building2 size={18} /></span><div><small>Records on this page</small><strong>{number(total)}</strong></div></div>
        <div className="schools-summary-card"><span className="summary-icon green"><Check size={18} /></span><div><small>Active on this page</small><strong>{number(stats.active)}</strong></div></div>
        <div className="schools-summary-card"><span className="summary-icon amber"><Clock3 size={18} /></span><div><small>Pending on this page</small><strong>{number(stats.pending)}</strong></div></div>
        <div className="schools-summary-card"><span className="summary-icon blue"><ShieldCheck size={18} /></span><div><small>Verified on this page</small><strong>{number(stats.verified)}</strong></div></div>
      </section>

      {error && <div className="schools-alert" role="alert"><AlertCircle size={17} /><span>{error}</span><button type="button" onClick={() => void loadSchools(true)}>Retry</button></div>}

      <section className="schools-toolbar">
        <label className="schools-search"><Search size={17} /><input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Search by school, code, email or city..." /></label>
        <label className="schools-filter"><Filter size={15} /><select value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }}><option value="">All statuses</option>{statusOptions.map((status) => <option key={status} value={status}>{status.charAt(0) + status.slice(1).toLowerCase()}</option>)}</select></label>
        <div className="schools-record-count"><Database size={15} /> {number(total)} records</div>
      </section>

      <section className="schools-table-card">
        {loading ? (
          <div className="schools-loading"><span className="schools-loader" />Loading schools...</div>
        ) : schools.length ? (
          <>
            <div className="schools-table-wrap">
              <table className="schools-table">
                <thead><tr><th>School</th><th>Contact</th><th>Location</th><th>Type</th><th>Status</th><th>Verified</th><th className="actions-heading">Actions</th></tr></thead>
                <tbody>{schools.map((school) => (
                  <tr key={school._id}>
                    <td><div className="school-name-cell"><span className="school-avatar">{(school.name || "S").slice(0, 1).toUpperCase()}</span><div><strong>{school.name}</strong><small>{school.code} · {school.email}</small></div></div></td>
                    <td><strong className="cell-main">{school.phone}</strong><small className="cell-sub">{school.contact?.email || "—"}</small></td>
                    <td><span className="location-cell"><MapPin size={13} />{[school.address?.city, school.address?.state].filter(Boolean).join(", ") || "—"}</span></td>
                    <td><span className="type-pill">{(school.schoolType || "OTHER").toLowerCase()}</span></td>
                    <td><span className={`status-pill status-${school.status?.toLowerCase()}`}>{school.status?.toLowerCase() || "unknown"}</span></td>
                    <td><span className={`verified-pill ${school.isVerified ? "is-verified" : ""}`}>{school.isVerified ? "Verified" : "Not verified"}</span></td>
                    <td><div className="school-row-actions">
                      <button type="button" title="View details" onClick={() => setViewing(school)}><Eye size={15} /></button>
                      <button type="button" title="Edit school" onClick={() => openEdit(school)}><Edit3 size={15} /></button>
                      <select aria-label={`Change status for ${school.name}`} value={school.status} disabled={actionId === school._id} onChange={(event) => void changeStatus(school, event.target.value as SchoolStatus)}>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select>
                      <button type="button" className="delete-action" title="Delete school" disabled={actionId === school._id} onClick={() => void deleteSchool(school)}><Trash2 size={15} /></button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="schools-pagination"><span>Page {page} of {totalPages} · {number(total)} total records</span><div><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16} /> Previous</button><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next <ChevronRight size={16} /></button></div></div>
          </>
        ) : (
          <div className="schools-empty">
            <span className="schools-empty-icon"><Building2 size={25} /></span>
            <h2>{search || statusFilter ? "No matching schools" : "No schools registered yet"}</h2>
            <p>{search || statusFilter ? "Try changing your search or status filter." : "Create your first school to start managing its profile, contact information and status."}</p>
            {search || statusFilter ? <button className="schools-button secondary" type="button" onClick={() => { setSearch(""); setStatusFilter(""); setPage(1); }}>Clear filters</button> : <button className="schools-button primary" type="button" onClick={openCreate}><Plus size={16} /> Create first school</button>}
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="schools-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModalOpen(false); }}>
          <section className="schools-modal" role="dialog" aria-modal="true" aria-labelledby="school-modal-title">
            <header className="schools-modal-header"><div><span className="schools-kicker"><span /> SCHOOL MANAGEMENT</span><h2 id="school-modal-title">{editing ? "Edit school" : "Register a school"}</h2><p>Enter the school details below. Fields marked * are required.</p></div><button type="button" className="modal-close" onClick={() => setModalOpen(false)} disabled={saving}><X size={19} /></button></header>
            <form onSubmit={saveSchool}>
              {formError && <div className="schools-alert form-alert"><AlertCircle size={16} /><span>{formError}</span></div>}
              <div className="form-section"><h3>Basic information</h3><div className="school-form-grid">
                <label className="wide-field">School name *<input required minLength={2} maxLength={150} value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="e.g. Mirex Public School" /></label>
                <label>School code *<input required minLength={2} maxLength={30} pattern="[A-Za-z0-9_-]+" value={form.code} onChange={(e) => setField("code", e.target.value)} placeholder="MPS-001" /></label>
                <label>URL slug *<input required minLength={2} maxLength={180} pattern="[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*" value={form.slug} onChange={(e) => setField("slug", e.target.value)} placeholder="mirex-public-school" /></label>
                <label>Email address *<input required type="email" maxLength={150} value={form.email} onChange={(e) => setField("email", e.target.value)} placeholder="school@example.com" /></label>
                <label>Phone number *<input required pattern="[+]?[0-9 -]{7,20}" value={form.phone} onChange={(e) => setField("phone", e.target.value)} placeholder="+91 9876543210" /></label>
                <label>School type<select value={form.schoolType} onChange={(e) => setField("schoolType", e.target.value)}><option value="PRIVATE">Private</option><option value="PUBLIC">Public</option><option value="GOVERNMENT">Government</option><option value="OTHER">Other</option></select></label>
                <label>Established year<input type="number" min="1800" max={new Date().getFullYear()} value={form.establishedYear} onChange={(e) => setField("establishedYear", e.target.value)} placeholder="e.g. 2010" /></label>
              </div></div>
              {!editing && <div className="form-section admin-account-section"><h3>School Admin login <small>Required for school access</small></h3><p className="admin-form-note">This creates an active SCHOOL_ADMIN account linked to the school. The admin can log in immediately after creation.</p><div className="school-form-grid">
                <label>Admin full name *<input required minLength={2} maxLength={100} value={form.adminName} onChange={(e) => setField("adminName", e.target.value)} placeholder="School administrator name" /></label>
                <label>Admin email *<input required type="email" value={form.adminEmail} onChange={(e) => setField("adminEmail", e.target.value)} placeholder="admin@school.com" /></label>
                <label>Admin mobile number<input pattern="[+]?[0-9]{10,15}" value={form.adminPhone} onChange={(e) => setField("adminPhone", e.target.value)} placeholder="+919876543210" /></label>
                <label>Create password *<input required type="password" minLength={12} maxLength={128} value={form.adminPassword} onChange={(e) => setField("adminPassword", e.target.value)} placeholder="Minimum 12 characters" /></label>
                <label>Confirm password *<input required type="password" minLength={12} maxLength={128} value={form.adminConfirmPassword} onChange={(e) => setField("adminConfirmPassword", e.target.value)} placeholder="Enter password again" /></label>
              </div><p className="admin-form-note">Password must contain uppercase, lowercase, number and special character.</p></div>}
              <div className="form-section"><h3>Address</h3><div className="school-form-grid">
                <label>Street<input value={form.street} onChange={(e) => setField("street", e.target.value)} /></label><label>Area<input value={form.area} onChange={(e) => setField("area", e.target.value)} /></label>
                <label>City *<input required value={form.city} onChange={(e) => setField("city", e.target.value)} /></label><label>State *<input required value={form.state} onChange={(e) => setField("state", e.target.value)} /></label>
                <label>Country *<input required value={form.country} onChange={(e) => setField("country", e.target.value)} /></label><label>Postal code *<input required minLength={4} maxLength={12} pattern="[0-9A-Za-z -]{4,12}" value={form.postalCode} onChange={(e) => setField("postalCode", e.target.value)} /></label>
              </div></div>
              <div className="form-section"><h3>Primary contact</h3><div className="school-form-grid">
                <label>Contact phone *<input required pattern="[+]?[0-9 -]{7,20}" value={form.contactPhone} onChange={(e) => setField("contactPhone", e.target.value)} /></label><label>Alternate phone<input pattern="[+]?[0-9 -]{7,20}" value={form.contactAlternatePhone} onChange={(e) => setField("contactAlternatePhone", e.target.value)} /></label>
                <label>Contact email *<input required type="email" value={form.contactEmail} onChange={(e) => setField("contactEmail", e.target.value)} /></label><label>Website<input type="url" value={form.contactWebsite} onChange={(e) => setField("contactWebsite", e.target.value)} placeholder="https://example.com" /></label>
              </div></div>
              <div className="form-section"><h3>Principal & affiliation <small>Optional</small></h3><div className="school-form-grid">
                <label>Principal name<input value={form.principalName} onChange={(e) => setField("principalName", e.target.value)} /></label><label>Principal email<input type="email" value={form.principalEmail} onChange={(e) => setField("principalEmail", e.target.value)} /></label>
                <label>Principal phone<input value={form.principalPhone} onChange={(e) => setField("principalPhone", e.target.value)} /></label><label>Education board<input value={form.board} onChange={(e) => setField("board", e.target.value)} placeholder="CBSE / ICSE / State Board" /></label>
                <label>Affiliation number<input value={form.affiliationNumber} onChange={(e) => setField("affiliationNumber", e.target.value)} /></label><label>Recognition number<input value={form.recognitionNumber} onChange={(e) => setField("recognitionNumber", e.target.value)} /></label>
              </div></div>
              <footer className="schools-modal-footer"><button className="schools-button secondary" type="button" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button><button className="schools-button primary" type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Create school"}</button></footer>
            </form>
          </section>
        </div>
      )}

      {viewing && (
        <div className="schools-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewing(null); }}>
          <section className="schools-modal school-details-modal" role="dialog" aria-modal="true" aria-labelledby="school-details-title">
            <header className="schools-modal-header"><div><span className="schools-kicker"><span /> SCHOOL PROFILE</span><h2 id="school-details-title">{viewing.name}</h2><p>{viewing.code} · {viewing.slug}</p></div><button type="button" className="modal-close" onClick={() => setViewing(null)}><X size={19} /></button></header>
            <div className="school-details-grid">
              <div><small>Email</small><strong>{viewing.email}</strong></div><div><small>Phone</small><strong>{viewing.phone}</strong></div>
              <div><small>Address</small><strong>{[viewing.address?.street, viewing.address?.area, viewing.address?.city, viewing.address?.state, viewing.address?.postalCode, viewing.address?.country].filter(Boolean).join(", ")}</strong></div>
              <div><small>Contact</small><strong>{viewing.contact?.email} · {viewing.contact?.phone}</strong></div>
              <div><small>Principal</small><strong>{viewing.principal?.name || "Not provided"}</strong></div><div><small>Board</small><strong>{viewing.affiliation?.board || "Not provided"}</strong></div>
              <div><small>Type</small><strong>{viewing.schoolType}</strong></div><div><small>Status</small><strong>{viewing.status}</strong></div>
            </div>
            <footer className="schools-modal-footer"><button className="schools-button secondary" type="button" onClick={() => setViewing(null)}>Close</button><button className="schools-button primary" type="button" onClick={() => { setViewing(null); openEdit(viewing); }}><Edit3 size={15} /> Edit school</button></footer>
          </section>
        </div>
      )}
    </main>
  );
}

function number(value: number) {
  return new Intl.NumberFormat("en-IN").format(value || 0);
}
