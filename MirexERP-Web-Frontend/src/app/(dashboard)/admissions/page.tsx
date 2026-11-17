"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle, Search, Plus, RefreshCw, Eye, Edit3, Trash2, X,
  Users, Clock3, CheckCircle2, XCircle, FileText, Filter, GraduationCap,
  ChevronLeft, ChevronRight, ClipboardCheck,
} from "lucide-react";
import { admissionsApi, admissionEnquiriesApi, type Admission, type AdmissionPayload, type AdmissionStatus, type AdmissionSummary } from "@/lib/api/admissions";
import { api } from "@/lib/api/client";
import "./page.css";

type Option = { _id: string; name: string; code?: string; isActive?: boolean };
type Guardian = {
  name: string;
  relationship: "FATHER" | "MOTHER" | "GUARDIAN";
  phone: string;
  alternatePhone: string;
  email: string;
  occupation: string;
  isPrimaryContact: boolean;
};
type FormState = {
  sessionId: string; applicationNumber: string; firstName: string; middleName: string;
  lastName: string; dateOfBirth: string; gender: "MALE" | "FEMALE" | "OTHER";
  bloodGroup: string; nationality: string; religion: string; category: string;
  motherTongue: string; email: string; phone: string; addressLine1: string;
  addressLine2: string; city: string; state: string; country: string; postalCode: string;
  appliedClassId: string; appliedSectionId: string; previousSchool: string;
  previousClass: string; previousBoard: string; previousSchoolTcNumber: string; parentDeclaration: boolean; guardians: Guardian[];
};
const emptyGuardian = (): Guardian => ({
  name: "", relationship: "FATHER", phone: "", alternatePhone: "", email: "",
  occupation: "", isPrimaryContact: true,
});
const emptyForm: FormState = {
  sessionId: "", applicationNumber: "", firstName: "", middleName: "", lastName: "",
  dateOfBirth: "", gender: "MALE", bloodGroup: "", nationality: "Indian", religion: "",
  category: "", motherTongue: "", email: "", phone: "", addressLine1: "", addressLine2: "",
  city: "", state: "", country: "India", postalCode: "", appliedClassId: "",
  appliedSectionId: "", previousSchool: "", previousClass: "", previousBoard: "",
  previousSchoolTcNumber: "", parentDeclaration: false,
  guardians: [emptyGuardian()],
};
const statuses: AdmissionStatus[] = ["DRAFT","SUBMITTED","APPLIED","UNDER_REVIEW","DOCUMENTS_PENDING","VERIFIED","APPROVED","WAITLISTED","REJECTED","WITHDRAWN","CANCELLED","CONVERTED"];

function unwrap<T>(response: any): T {
  let value = response?.data ?? response;
  if (value && typeof value === "object" && "data" in value) value = value.data ?? value;
  return value as T;
}
function listFrom(response: any): Option[] {
  const value = unwrap<any>(response);
  if (Array.isArray(value)) return value;
  return value?.items ?? value?.sessions ?? value?.classes ?? value?.data ?? [];
}
function messageOf(error: any) {
  return error?.response?.data?.message || error?.message || "Something went wrong. Please try again.";
}
function dateLabel(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function idOf(value: any): string {
  if (!value) return "";
  return typeof value === "string" ? value : value._id || value.id || "";
}
function nameOf(value: any): string {
  if (!value) return "—";
  return typeof value === "string" ? value : value.name || value.fullName || value.code || "—";
}

export default function AdmissionsPage() {
  const [items, setItems] = useState<Admission[]>([]);
  const [sessions, setSessions] = useState<Option[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [summary, setSummary] = useState<AdmissionSummary | null>(null);
  const [sessionFilter, setSessionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Admission | null>(null);
  const [viewing, setViewing] = useState<Admission | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [isReceptionist, setIsReceptionist] = useState(false);
  const [documents,setDocuments]=useState<any[]>([]);
  const [documentBusy,setDocumentBusy]=useState(false);
  const [documentError,setDocumentError]=useState("");

  useEffect(() => {
    try { setIsReceptionist(String(JSON.parse(sessionStorage.getItem("mirexerp_user") || "{}").role || "").toUpperCase().replaceAll(" ", "_") === "RECEPTIONIST"); }
    catch { setIsReceptionist(false); }
  }, []);

  const loadOptions = useCallback(async () => {
    try {
      const [sessionRes, classRes] = await Promise.all([api.get("/sessions", { params: { limit: 100 } }), api.get("/classes", { params: { limit: 100 } })]);
      setSessions(listFrom(sessionRes));
      setClasses(listFrom(classRes));
    } catch {
      // The page remains usable; IDs can be selected once the related endpoints are available.
    }
  }, []);

  const load = useCallback(async (refresh = false) => {
    setError("");
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const result = await admissionsApi.list({
        page, limit: 10, ...(search.trim() ? { search: search.trim() } : {}),
        ...(statusFilter ? { status: statusFilter as AdmissionStatus } : {}),
        ...(sessionFilter ? { sessionId: sessionFilter } : {}),
      });
      setItems(result.admissions);
      setTotal(result.pagination?.total ?? result.admissions.length);
      setTotalPages(Math.max(1, result.pagination?.totalPages ?? 1));

      // Summary is restricted to School Admin and Principal in the current backend.
      // A Receptionist can read the admission list, so a 403 from summary must
      // not hide the list or turn the entire page into an error state.
      try {
        const stats = await admissionsApi.summary(sessionFilter || undefined);
        setSummary(stats);
      } catch {
        setSummary(null);
      }
    } catch (err) {
      setError(messageOf(err));
      setItems([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search, statusFilter, sessionFilter]);

  useEffect(() => { void loadOptions(); }, [loadOptions]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), search ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [load, search]);

  useEffect(()=>{
    if(!viewing){setDocuments([]);setDocumentError("");return;}
    admissionEnquiriesApi.documents(viewing._id).then(setDocuments).catch((e:any)=>setDocumentError(e?.response?.data?.message||"Unable to load documents"));
  },[viewing?._id]);

  const uploadDocument=async(file?:File)=>{
    if(!file||!viewing)return; const documentType=window.prompt("Enter document type (e.g. Birth Certificate, Photo, Transfer Certificate):","Birth Certificate"); if(!documentType?.trim())return; setDocumentBusy(true);setDocumentError("");
    try{await admissionEnquiriesApi.uploadDocument(viewing._id,file,documentType.trim());setDocuments(await admissionEnquiriesApi.documents(viewing._id));}
    catch(e:any){setDocumentError(e?.response?.data?.message||"Document upload failed");}
    finally{setDocumentBusy(false);}
  };
  const downloadDocument=async(doc:any)=>{
    try{const response=await api.get(`/admissions/${viewing?._id}/documents/${doc._id}/download`,{responseType:"blob"});const url=URL.createObjectURL(response.data);const a=document.createElement("a");a.href=url;a.download=doc.documentName||"admission-document";a.click();URL.revokeObjectURL(url);}
    catch(e:any){setDocumentError(e?.response?.data?.message||"Document download failed");}
  };
  const verifyDocument=async(doc:any,verified:boolean)=>{
    if(!viewing)return;setDocumentBusy(true);
    try{await api.patch(`/admissions/${viewing._id}/documents/${doc._id}/verify`,{verified,remarks:verified?"Verified by reviewer":"Verification rejected"});setDocuments(await admissionEnquiriesApi.documents(viewing._id));}
    catch(e:any){setDocumentError(e?.response?.data?.message||"Document verification failed");}
    finally{setDocumentBusy(false);}
  };

  const setValue = (key: keyof FormState, value: any) => setForm((current) => ({ ...current, [key]: value }));
  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, sessionId: sessions.find((s) => s.isActive)?._id || sessions[0]?._id || "", appliedClassId: classes[0]?._id || "", applicationNumber: `ADM-${Date.now().toString().slice(-8)}` });
    setFormError("");
    setModal(true);
  };
  const openEdit = (item: Admission) => {
    setEditing(item);
    setForm({
      ...emptyForm,
      sessionId: idOf(item.sessionId), applicationNumber: item.applicationNumber,
      firstName: item.firstName || "", middleName: item.middleName || "", lastName: item.lastName || "",
      dateOfBirth: item.dateOfBirth ? new Date(item.dateOfBirth).toISOString().slice(0, 10) : "",
      gender: item.gender || "MALE", bloodGroup: item.bloodGroup || "", nationality: item.nationality || "Indian",
      religion: item.religion || "", category: item.category || "", motherTongue: item.motherTongue || "",
      email: item.email || "", phone: item.phone || "", addressLine1: item.address?.addressLine1 || "",
      addressLine2: item.address?.addressLine2 || "", city: item.address?.city || "", state: item.address?.state || "",
      country: item.address?.country || "India", postalCode: item.address?.postalCode || "",
      appliedClassId: idOf(item.appliedClassId), appliedSectionId: idOf(item.appliedSectionId),
      previousSchool: item.previousSchool || "", previousClass: item.previousClass || "", previousBoard: item.previousBoard || "", previousSchoolTcNumber: item.previousSchoolTcNumber || "",
      parentDeclaration: Boolean(item.parentDeclaration),
      guardians: (item.guardians?.length ? item.guardians : [emptyGuardian()]).map((g: any) => ({
        name: g.name || "", relationship: g.relationship || "FATHER", phone: g.phone || "",
        alternatePhone: g.alternatePhone || "", email: g.email || "", occupation: g.occupation || "",
        isPrimaryContact: Boolean(g.isPrimaryContact),
      })),
    });
    setFormError("");
    setModal(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    if (!form.guardians.length || form.guardians.some((g) => !g.name.trim() || !/^[0-9]{10,15}$/.test(g.phone.trim()))) {
      setFormError("Enter at least one guardian with a valid 10–15 digit phone number.");
      return;
    }
    if (form.guardians.filter((g) => g.isPrimaryContact).length > 1) {
      setFormError("Only one guardian can be selected as primary contact.");
      return;
    }
    const payload: AdmissionPayload = {
      ...(editing ? {} : { sessionId: form.sessionId, applicationNumber: form.applicationNumber.trim().toUpperCase() }),
      firstName: form.firstName.trim(), ...(form.middleName.trim() ? { middleName: form.middleName.trim() } : {}),
      lastName: form.lastName.trim(), dateOfBirth: form.dateOfBirth, gender: form.gender,
      ...(form.bloodGroup ? { bloodGroup: form.bloodGroup } : {}), nationality: form.nationality.trim() || "Indian",
      ...(form.religion.trim() ? { religion: form.religion.trim() } : {}),
      ...(form.category.trim() ? { category: form.category.trim() } : {}),
      ...(form.motherTongue.trim() ? { motherTongue: form.motherTongue.trim() } : {}),
      ...(form.email.trim() ? { email: form.email.trim().toLowerCase() } : {}),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      address: {
        addressLine1: form.addressLine1.trim(), ...(form.addressLine2.trim() ? { addressLine2: form.addressLine2.trim() } : {}),
        city: form.city.trim(), state: form.state.trim(), country: form.country.trim() || "India", postalCode: form.postalCode.trim(),
      },
      guardians: form.guardians.map((g) => ({
        name: g.name.trim(), relationship: g.relationship, phone: g.phone.trim(),
        ...(g.alternatePhone.trim() ? { alternatePhone: g.alternatePhone.trim() } : {}),
        ...(g.email.trim() ? { email: g.email.trim().toLowerCase() } : {}),
        ...(g.occupation.trim() ? { occupation: g.occupation.trim() } : {}),
        isPrimaryContact: g.isPrimaryContact,
      })),
      ...(editing ? {} : { appliedClassId: form.appliedClassId }),
      ...(form.appliedSectionId ? { appliedSectionId: form.appliedSectionId } : {}),
      ...(form.previousSchool.trim() ? { previousSchool: form.previousSchool.trim() } : {}),
      ...(form.previousClass.trim() ? { previousClass: form.previousClass.trim() } : {}),
      ...(form.previousBoard.trim() ? { previousBoard: form.previousBoard.trim() } : {}),
      ...(form.previousSchoolTcNumber.trim() ? { previousSchoolTcNumber: form.previousSchoolTcNumber.trim() } : {}),
      parentDeclaration: form.parentDeclaration,
    };
    if (!editing && (!form.sessionId || !form.appliedClassId)) {
      setFormError("Please select an academic session and applied class.");
      return;
    }
    if (!form.parentDeclaration) {
      setFormError("Parent declaration is required before submitting the application.");
      return;
    }
    setSaving(true);
    try {
      if (editing) await admissionsApi.update(editing._id, payload);
      else await admissionsApi.create(payload as AdmissionPayload);
      setModal(false);
      setEditing(null);
      await load(true);
    } catch (err) {
      setFormError(messageOf(err));
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: string, action: () => Promise<any>) => {
    setActionBusy(id); setError("");
    try { await action(); await load(true); }
    catch (err) { setError(messageOf(err)); }
    finally { setActionBusy(""); }
  };

  const stats = useMemo(() => summary || {
    total, applied: 0, underReview: 0, documentsPending: 0, approved: 0, rejected: 0, cancelled: 0, converted: 0,
  }, [summary, total]);

  return (
    <main className="admissions-page">
      <header className="admissions-heading">
        <div><span className="admissions-kicker">MIREXERP / STUDENT MANAGEMENT</span><h1>Admissions</h1><p>{isReceptionist ? "Register applicants, update application details and track admission progress. Final decisions remain with the Principal or School Admin." : "Manage applications, review documents and convert approved applicants into students."}</p></div>
        <div className="admissions-head-actions">
          <button className="adm-btn adm-light" onClick={() => void load(true)} disabled={refreshing}><RefreshCw size={15} className={refreshing ? "adm-spin" : ""}/> Refresh</button>
          <button className="adm-btn adm-primary" onClick={openCreate}><Plus size={16}/> New admission</button>
        </div>
      </header>

      <section className="admissions-stats">
        <Stat icon={<Users size={18}/>} label="Total applications" value={stats.total}/>
        <Stat icon={<Clock3 size={18}/>} label="Applied" value={stats.applied}/>
        <Stat icon={<ClipboardCheck size={18}/>} label="Under review" value={stats.underReview}/>
        <Stat icon={<CheckCircle2 size={18}/>} label="Converted to students" value={stats.converted}/>
      </section>

      {error && <div className="adm-alert"><AlertCircle size={17}/><span>{error}</span><button onClick={() => void load(true)}>Retry</button></div>}

      <section className="admissions-toolbar">
        <label className="adm-search"><Search size={16}/><input value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} placeholder="Search applicant, application no., phone or email"/></label>
        <label className="adm-filter"><Filter size={15}/><select value={sessionFilter} onChange={(e) => { setPage(1); setSessionFilter(e.target.value); }}><option value="">All sessions</option>{sessions.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}</select></label>
        <label className="adm-filter"><select value={statusFilter} onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}><option value="">All statuses</option>{statuses.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></label>
        <span className="adm-count">{total} applications</span>
      </section>

      <section className="admissions-table-card">
        {loading ? <div className="adm-loading">Loading admissions...</div> : items.length ? <>
          <div className="adm-table-scroll"><table className="adm-table"><thead><tr><th>Applicant</th><th>Application no.</th><th>Class</th><th>Applied on</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{items.map((item) => <tr key={item._id}>
              <td><div className="adm-person"><span>{(item.fullName || item.firstName || "A").slice(0,1).toUpperCase()}</span><div><strong>{item.fullName || `${item.firstName} ${item.lastName}`}</strong><small>{item.phone || item.email || "No contact"}</small></div></div></td>
              <td><strong>{item.applicationNumber}</strong></td>
              <td>{nameOf(item.appliedClassId)}</td><td>{dateLabel(item.applicationDate || item.createdAt)}</td>
              <td><span className={`adm-status status-${item.status.toLowerCase()}`}>{item.status.replaceAll("_", " ")}</span></td>
              <td><div className="adm-actions">
                <button title="View details" onClick={() => setViewing(item)}><Eye size={15}/></button>
                {!isReceptionist || ["APPLIED","UNDER_REVIEW","DOCUMENTS_PENDING"].includes(item.status) ? <button title="Add follow-up" disabled={actionBusy===item._id || ["CONVERTED","CANCELLED","REJECTED"].includes(item.status)} onClick={() => {
                  const note = window.prompt("Enter follow-up note (minimum 3 characters):");
                  if (note && note.trim().length >= 3) {
                    const outcome = window.prompt("Outcome (optional):") || undefined;
                    const nextFollowUpDate = window.prompt("Next follow-up date YYYY-MM-DD (optional):") || undefined;
                    void runAction(item._id, () => admissionsApi.addFollowUp(item._id, { note: note.trim(), ...(outcome ? { outcome } : {}), ...(nextFollowUpDate ? { nextFollowUpDate } : {}) }));
                  }
                }}><Clock3 size={15}/></button> : null}
                <button title="Edit application" disabled={["APPROVED","REJECTED","CANCELLED","CONVERTED"].includes(item.status)} onClick={() => openEdit(item)}><Edit3 size={15}/></button>
                {isReceptionist && ["APPLIED","UNDER_REVIEW","DOCUMENTS_PENDING"].includes(item.status) && <button title="Verify documents and send for approval" disabled={actionBusy===item._id} onClick={() => void runAction(item._id, () => admissionsApi.review(item._id, { documentsVerified: true, reviewRemarks: "Documents checked by Receptionist" }))}><ClipboardCheck size={15}/></button>}
                {!isReceptionist && ["APPLIED","UNDER_REVIEW","DOCUMENTS_PENDING"].includes(item.status) && <button title="Verify documents and mark application verified" disabled={actionBusy===item._id} onClick={() => void runAction(item._id, () => admissionsApi.review(item._id, { documentsVerified: true, reviewRemarks: "Verified by authorized reviewer" }))}><ClipboardCheck size={15}/></button>}
                {!isReceptionist && item.status==="VERIFIED" && <button title="Approve application" disabled={actionBusy===item._id} onClick={() => void runAction(item._id, () => admissionsApi.approve(item._id, { remarks: "Approved after application verification" }))}><CheckCircle2 size={15}/></button>}
                {!isReceptionist && item.status==="APPROVED" && <button title="Register approved student" disabled={actionBusy===item._id} onClick={() => {
                  const date=window.prompt("Admission date (YYYY-MM-DD)",new Date().toISOString().slice(0,10)); if(!date)return;
                  const sectionId=idOf(item.appliedSectionId)||window.prompt("Enter section ID:");
                  if(!sectionId||!/^[0-9a-fA-F]{24}$/.test(sectionId.trim())){window.alert("A valid section ID is required.");return;}
                  void runAction(item._id,()=>admissionsApi.register(item._id,{admissionDate:date,appliedClassId:idOf(item.appliedClassId),appliedSectionId:sectionId.trim()}));
                }}><GraduationCap size={15}/></button>}
                {!isReceptionist && ["APPLIED","UNDER_REVIEW","DOCUMENTS_PENDING","APPROVED"].includes(item.status) && <button title="Reject application" disabled={actionBusy===item._id} onClick={() => {
                  const reason = window.prompt("Enter rejection reason (minimum 5 characters):");
                  if (reason && reason.trim().length >= 5) void runAction(item._id, () => admissionsApi.reject(item._id, { rejectionReason: reason.trim() }));
                }}><XCircle size={15}/></button>}
                {!isReceptionist && <button title="Delete application" disabled={actionBusy===item._id || item.status==="CONVERTED"} onClick={() => {
                  if (window.confirm(`Delete application ${item.applicationNumber}?`)) void runAction(item._id, () => admissionsApi.remove(item._id));
                }}><Trash2 size={15}/></button>}
              </div></td>
            </tr>)}</tbody></table></div>
          <div className="adm-pagination"><span>Page {page} of {totalPages}</span><div><button disabled={page<=1} onClick={() => setPage((v)=>Math.max(1,v-1))}><ChevronLeft size={15}/> Previous</button><button disabled={page>=totalPages} onClick={() => setPage((v)=>Math.min(totalPages,v+1))}>Next <ChevronRight size={15}/></button></div></div>
        </> : <div className="adm-empty"><FileText size={30}/><h2>No admission applications found</h2><p>Create a new application or change your search and filters.</p><button className="adm-btn adm-primary" onClick={openCreate}><Plus size={15}/> New admission</button></div>}
      </section>

      {modal && <div className="adm-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget&&!saving)setModal(false);}}>
        <section className="adm-modal" role="dialog" aria-modal="true">
          <header className="adm-modal-head"><div><span className="admissions-kicker">ADMISSION FORM</span><h2>{editing ? "Update application" : "New admission application"}</h2><p>Fill in applicant, guardian and academic information.</p></div><button className="adm-close" type="button" onClick={()=>setModal(false)}><X size={18}/></button></header>
          <form onSubmit={submit}>
            {formError && <div className="adm-alert"><AlertCircle size={16}/>{formError}</div>}
            <div className="adm-form-section"><h3>Academic information</h3><div className="adm-form-grid">
              {!editing && <label>Academic session *<select required value={form.sessionId} onChange={(e)=>setValue("sessionId",e.target.value)}><option value="">Select session</option>{sessions.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}</select></label>}
              {!editing && <label>Application number *<input required value={form.applicationNumber} onChange={(e)=>setValue("applicationNumber",e.target.value.toUpperCase())}/></label>}
              <label>Applying for class *<select required value={form.appliedClassId} onChange={(e)=>setValue("appliedClassId",e.target.value)}><option value="">Select class</option>{classes.map(c=><option key={c._id} value={c._id}>{c.name}{c.code?` (${c.code})`:""}</option>)}</select></label>
              <label>Section ID (optional until approval)<input value={form.appliedSectionId} onChange={(e)=>setValue("appliedSectionId",e.target.value)} placeholder="MongoDB section ID"/></label>
            </div></div>
            <div className="adm-form-section"><h3>Applicant details</h3><div className="adm-form-grid">
              <label>First name *<input required minLength={2} value={form.firstName} onChange={(e)=>setValue("firstName",e.target.value)}/></label>
              <label>Middle name<input value={form.middleName} onChange={(e)=>setValue("middleName",e.target.value)}/></label>
              <label>Last name *<input required value={form.lastName} onChange={(e)=>setValue("lastName",e.target.value)}/></label>
              <label>Date of birth *<input required type="date" max={new Date().toISOString().slice(0,10)} value={form.dateOfBirth} onChange={(e)=>setValue("dateOfBirth",e.target.value)}/></label>
              <label>Gender *<select value={form.gender} onChange={(e)=>setValue("gender",e.target.value)}><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></label>
              <label>Blood group<select value={form.bloodGroup} onChange={(e)=>setValue("bloodGroup",e.target.value)}><option value="">Select</option>{["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(v=><option key={v}>{v}</option>)}</select></label>
              <label>Nationality<input value={form.nationality} onChange={(e)=>setValue("nationality",e.target.value)}/></label>
              <label>Religion<input value={form.religion} onChange={(e)=>setValue("religion",e.target.value)}/></label>
              <label>Category<input value={form.category} onChange={(e)=>setValue("category",e.target.value)} placeholder="General / OBC / SC / ST"/></label>
              <label>Mother tongue<input value={form.motherTongue} onChange={(e)=>setValue("motherTongue",e.target.value)}/></label>
              <label>Email<input type="email" value={form.email} onChange={(e)=>setValue("email",e.target.value)}/></label>
              <label>Phone<input inputMode="numeric" pattern="[0-9]{10,15}" value={form.phone} onChange={(e)=>setValue("phone",e.target.value.replace(/\D/g,"").slice(0,15))}/></label>
            </div></div>
            <div className="adm-form-section"><h3>Address</h3><div className="adm-form-grid">
              <label className="adm-wide">Address line 1 *<input required minLength={3} value={form.addressLine1} onChange={(e)=>setValue("addressLine1",e.target.value)}/></label>
              <label className="adm-wide">Address line 2<input value={form.addressLine2} onChange={(e)=>setValue("addressLine2",e.target.value)}/></label>
              <label>City *<input required value={form.city} onChange={(e)=>setValue("city",e.target.value)}/></label><label>State *<input required value={form.state} onChange={(e)=>setValue("state",e.target.value)}/></label>
              <label>Country *<input required value={form.country} onChange={(e)=>setValue("country",e.target.value)}/></label><label>Postal code *<input required minLength={4} maxLength={12} value={form.postalCode} onChange={(e)=>setValue("postalCode",e.target.value)}/></label>
            </div></div>
            <div className="adm-form-section"><div className="adm-section-title"><h3>Parent / guardian details *</h3><button type="button" className="adm-link-btn" onClick={()=>setForm(v=>({...v,guardians:[...v.guardians,{...emptyGuardian(),isPrimaryContact:false}]}))}><Plus size={14}/> Add guardian</button></div>
              {form.guardians.map((g,i)=><div className="adm-guardian-card" key={i}><div className="adm-guardian-title"><strong>Guardian {i+1}</strong>{form.guardians.length>1&&<button type="button" onClick={()=>setForm(v=>({...v,guardians:v.guardians.filter((_,n)=>n!==i)}))}>Remove</button>}</div><div className="adm-form-grid">
                <label>Name *<input required minLength={2} value={g.name} onChange={e=>setForm(v=>({...v,guardians:v.guardians.map((x,n)=>n===i?{...x,name:e.target.value}:x)}))}/></label>
                <label>Relationship *<select value={g.relationship} onChange={e=>setForm(v=>({...v,guardians:v.guardians.map((x,n)=>n===i?{...x,relationship:e.target.value as Guardian["relationship"]}:x)}))}><option value="FATHER">Father</option><option value="MOTHER">Mother</option><option value="GUARDIAN">Guardian</option></select></label>
                <label>Mobile number *<input required inputMode="numeric" pattern="[0-9]{10,15}" value={g.phone} onChange={e=>setForm(v=>({...v,guardians:v.guardians.map((x,n)=>n===i?{...x,phone:e.target.value.replace(/\D/g,"").slice(0,15)}:x)}))}/></label>
                <label>Alternate phone<input inputMode="numeric" pattern="[0-9]{10,15}" value={g.alternatePhone} onChange={e=>setForm(v=>({...v,guardians:v.guardians.map((x,n)=>n===i?{...x,alternatePhone:e.target.value.replace(/\D/g,"").slice(0,15)}:x)}))}/></label>
                <label>Email<input type="email" value={g.email} onChange={e=>setForm(v=>({...v,guardians:v.guardians.map((x,n)=>n===i?{...x,email:e.target.value}:x)}))}/></label>
                <label>Occupation<input value={g.occupation} onChange={e=>setForm(v=>({...v,guardians:v.guardians.map((x,n)=>n===i?{...x,occupation:e.target.value}:x)}))}/></label>
                <label className="adm-checkbox"><input type="checkbox" checked={g.isPrimaryContact} onChange={e=>setForm(v=>({...v,guardians:v.guardians.map((x,n)=>({...x,isPrimaryContact:n===i?e.target.checked:false}))}))}/> Primary contact</label>
              </div></div>)}
            </div>
            <div className="adm-form-section"><h3>Previous school (optional)</h3><div className="adm-form-grid">
              <label>Previous school<input value={form.previousSchool} onChange={e=>setValue("previousSchool",e.target.value)}/></label>
              <label>Previous class<input value={form.previousClass} onChange={e=>setValue("previousClass",e.target.value)}/></label>
              <label>Previous board<input value={form.previousBoard} onChange={e=>setValue("previousBoard",e.target.value)}/></label><label>Previous school TC number<input value={form.previousSchoolTcNumber} onChange={e=>setValue("previousSchoolTcNumber",e.target.value)}/></label>
            </div></div>
            <label className="adm-checkbox adm-parent-declaration"><input type="checkbox" checked={form.parentDeclaration} onChange={e=>setValue("parentDeclaration",e.target.checked)}/> I confirm that the information provided is accurate and I am authorized to submit this application.</label>
            <footer className="adm-modal-footer"><button type="button" className="adm-btn adm-light" onClick={()=>setModal(false)} disabled={saving}>Cancel</button><button type="submit" className="adm-btn adm-primary" disabled={saving}>{saving?"Saving...":editing?"Update application":"Create application"}</button></footer>
          </form>
        </section>
      </div>}

      {viewing && <div className="adm-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setViewing(null);}}><section className="adm-modal adm-details" role="dialog" aria-modal="true">
        <header className="adm-modal-head"><div><span className="admissions-kicker">APPLICATION DETAILS</span><h2>{viewing.fullName}</h2><p>{viewing.applicationNumber} · {viewing.status.replaceAll("_"," ")}</p></div><button className="adm-close" onClick={()=>setViewing(null)}><X size={18}/></button></header>
        <div className="adm-detail-grid">
          <Detail label="Date of birth" value={dateLabel(viewing.dateOfBirth)}/><Detail label="Gender" value={viewing.gender}/><Detail label="Phone" value={viewing.phone}/><Detail label="Email" value={viewing.email}/>
          <Detail label="Class" value={nameOf(viewing.appliedClassId)}/><Detail label="Session" value={nameOf(viewing.sessionId)}/><Detail label="Application date" value={dateLabel(viewing.applicationDate)}/>
          <Detail label="Address" value={[viewing.address?.addressLine1,viewing.address?.city,viewing.address?.state,viewing.address?.postalCode].filter(Boolean).join(", ")}/>
          {viewing.guardians?.map((g,i)=><Detail key={i} label={`Guardian ${i+1} (${g.relationship})`} value={`${g.name} · ${g.phone}${g.isPrimaryContact?" · Primary":""}`}/>)}
          <Detail label="Review remarks" value={viewing.reviewRemarks}/><Detail label="Rejection reason" value={viewing.rejectionReason}/><Detail label="Parent declaration" value={viewing.parentDeclaration?"Confirmed":"Not confirmed"}/><Detail label="Previous school TC number" value={viewing.previousSchoolTcNumber}/>
          {viewing.followUps?.map((followUp, index) => <Detail key={followUp._id || index} label={`Follow-up ${index + 1} · ${dateLabel(followUp.followUpDate)}`} value={`${followUp.note}${followUp.outcome ? ` · ${followUp.outcome}` : ""}${followUp.nextFollowUpDate ? ` · Next: ${dateLabel(followUp.nextFollowUpDate)}` : ""}`}/>)}
        </div>
        <section className="adm-documents"><div><h3>Admission documents</h3><label className="adm-btn adm-light">{documentBusy?"Uploading…":"Upload document"}<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" hidden disabled={documentBusy} onChange={e=>{void uploadDocument(e.target.files?.[0]);e.currentTarget.value="";}}/></label></div>{documentError&&<p className="adm-error">{documentError}</p>}{documents.length?documents.map((doc:any)=><div className="adm-document" key={doc._id}><span><b>{doc.documentName}</b><small>{doc.documentType} · {doc.verified?"Verified":"Pending verification"}</small></span><button className="adm-btn adm-light" onClick={()=>void downloadDocument(doc)}>Download</button>{!doc.verified&&<><button className="adm-btn adm-light" disabled={documentBusy} onClick={()=>void verifyDocument(doc,true)}>Verify</button><button className="adm-btn adm-light" disabled={documentBusy} onClick={()=>void verifyDocument(doc,false)}>Reject</button></>}</div>):<p>No uploaded documents.</p>}</section>
        <footer className="adm-modal-footer"><button className="adm-btn adm-light" onClick={()=>setViewing(null)}>Close</button>{viewing.status!=="CONVERTED"&&<button className="adm-btn adm-primary" onClick={()=>{setViewing(null);openEdit(viewing);}}>Edit application</button>}</footer>
      </section></div>}
    </main>
  );
}

function Stat({icon,label,value}:{icon:React.ReactNode;label:string;value:number}) {
  return <div className="adm-stat"><span>{icon}</span><div><small>{label}</small><strong>{value.toLocaleString("en-IN")}</strong></div></div>;
}
function Detail({label,value}:{label:string;value?:string}) {
  return <div><small>{label}</small><strong>{value || "—"}</strong></div>;
}
