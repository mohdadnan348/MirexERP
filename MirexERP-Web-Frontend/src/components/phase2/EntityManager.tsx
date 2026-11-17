"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { AlertCircle, Edit2, FileDown, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import "./EntityManager.css";

export type FieldOption = { label: string; value: string };
export type EntityField = {
  name: string; label: string; required?: boolean; type?: "text" | "email" | "tel" | "date" | "number" | "select" | "textarea";
  options?: FieldOption[]; source?: string; optionLabel?: string; optionValue?: string;
  placeholder?: string; min?: number; step?: string; help?: string;
};
export type EntityColumn = { key: string; label: string };
export type EntityConfig = {
  title: string; description: string; endpoint: string; singular: string;
  fields: EntityField[]; columns: EntityColumn[]; searchPlaceholder?: string;
  canDelete?: boolean; pageSize?: number; immutableOnUpdate?: string[]; downloadSuffix?: string; detailLink?: boolean; detailPath?: string;
};

type Row = Record<string, unknown> & { _id: string; id?: string };
type ApiResponse = { data?: { data?: unknown; pagination?: { total?: number; totalPages?: number } } };
type ApiRecord = Record<string, unknown>;
const unwrap = (response: unknown): unknown => {
  const root = response as ApiResponse;
  return root?.data?.data ?? root?.data ?? response;
};
const getPath = (value: unknown, path: string): unknown => path.split(".").reduce<unknown>((item, key) => {
  if (!item || typeof item !== "object") return undefined;
  return (item as ApiRecord)[key];
}, value);
const setPath = (target: Record<string, unknown>, path: string, value: unknown) => {
  const keys = path.split(".");
  let cursor: Record<string, unknown> = target;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) cursor[key] = value;
    else {
      const existing = cursor[key];
      if (!existing || typeof existing !== "object" || Array.isArray(existing)) cursor[key] = {};
      cursor = cursor[key] as Record<string, unknown>;
    }
  });
};
const labelValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") {
    const record = value as ApiRecord;
    return String(record.name || record.fullName || record.firstName || record.code || record._id || "—");
  }
  return String(value);
};
const errorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const response = (error as ApiRecord).response as ApiRecord | undefined;
    const data = response?.data as ApiRecord | undefined;
    return String(data?.message || (data?.error as ApiRecord | undefined)?.message || fallback);
  }
  return fallback;
};

export default function EntityManager({ config }: { config: EntityConfig }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [options, setOptions] = useState<Record<string, FieldOption[]>>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Row | null>(null);
  const [modal, setModal] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await api.get(config.endpoint, { params: { page, limit: config.pageSize || 10, ...(search.trim() ? { search: search.trim() } : {}) } });
      const payload = unwrap(response);
      const record = payload && typeof payload === "object" ? payload as ApiRecord : {};
      const list = Array.isArray(payload) ? payload : Array.isArray(record.items) ? record.items : Array.isArray(record.data) ? record.data : [];
      setRows(list.filter((item): item is Row => !!item && typeof item === "object" && typeof (item as ApiRecord)._id === "string") as Row[]);
      const responseRoot = response as ApiResponse;
      const pagination = responseRoot.data?.pagination || (record.pagination as ApiRecord | undefined);
      setTotal(Number(pagination?.total ?? list.length));
      setTotalPages(Math.max(1, Number(pagination?.totalPages ?? 1)));
    } catch (err: unknown) { setError(errorMessage(err, `Unable to load ${config.title.toLowerCase()}.`)); }
    finally { setLoading(false); }
  }, [config.endpoint, config.pageSize, config.title, page, search]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let active = true;
    const refs = [...new Set(config.fields.filter((field) => field.source).map((field) => field.source as string))];
    Promise.all(refs.map(async (source) => {
      try {
        const response = await api.get(source, { params: { page: 1, limit: 100 } });
        const payload = unwrap(response);
        const record = payload && typeof payload === "object" ? payload as ApiRecord : {};
        const list: unknown[] = Array.isArray(payload) ? payload : Array.isArray(record.items) ? record.items : Array.isArray(record.data) ? record.data : [];
        return [source, list.map((entry) => {
          const item = entry as ApiRecord;
          const personName = [item.firstName, item.lastName].filter(Boolean).join(" ");
          return { label: String(item.name || item.fullName || personName || item.code || item.admissionNumber || "Record"), value: String(item._id || item.id || "") };
        }).filter((item) => item.value)] as const;
      } catch { return [source, []] as const; }
    })).then((entries) => { if (active) setOptions(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [config.fields]);

  const openCreate = () => { setEditing(null); setForm({}); setError(""); setModal(true); };
  const openEdit = (row: Row) => {
    const values: Record<string, string> = {};
    config.fields.forEach((field) => {
      const value = getPath(row, field.name);
      if (Array.isArray(value)) {
        values[field.name] = value.map((entry) => entry && typeof entry === "object" ? String((entry as ApiRecord)._id || (entry as ApiRecord).id || "") : String(entry)).filter(Boolean).join(",");
      } else if (value && typeof value === "object") {
        values[field.name] = String((value as ApiRecord)._id || (value as ApiRecord).id || "");
      } else if (value instanceof Date) values[field.name] = value.toISOString().slice(0, 10);
      else values[field.name] = value ? String(value).slice(0, field.type === "date" ? 10 : undefined) : "";
    });
    setEditing(row); setForm(values); setError(""); setModal(true);
  };
  const buildPayload = () => {
    const payload: Record<string, unknown> = {};
    config.fields.forEach((field) => {
      const raw = form[field.name]?.trim();
      if (!raw) return;
      let value: unknown = raw;
      if (field.type === "number") value = Number(raw);
      if (raw === "true" || raw === "false") value = raw === "true";
      if (["studentIds", "subjects", "sectionIds", "strengths", "improvements"].includes(field.name)) value = raw.split(",").map((part) => part.trim()).filter(Boolean);
      setPath(payload, field.name, value);
    });
    return payload;
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const payload = buildPayload();
      if (editing && config.immutableOnUpdate?.length) {
        config.immutableOnUpdate.forEach((field) => { delete payload[field]; });
      }
      if (editing) await api.patch(`${config.endpoint}/${editing._id}`, payload);
      else await api.post(config.endpoint, payload);
      setModal(false); setNotice(`${config.singular} ${editing ? "updated" : "created"} successfully.`);
      await load();
    } catch (err: unknown) { setError(errorMessage(err, "Unable to save record.")); }
    finally { setSaving(false); }
  };
  const download = async (row: Row) => {
    if (!config.downloadSuffix) return;
    try {
      const response = await api.get(`${config.endpoint}/${row._id}${config.downloadSuffix}`, { responseType: "blob" });
      const objectUrl = URL.createObjectURL(response.data as Blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${String(row.admissionNumber || row._id)}-id-card.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err: unknown) { setError(errorMessage(err, "Unable to download this document.")); }
  };

  const remove = async (row: Row) => {
    const name = labelValue(row.name || row.fullName || row.admissionNumber || row.employeeId || row.code || row._id);
    if (!window.confirm(`Delete ${config.singular.toLowerCase()} ${name}? This action may be recorded in the audit log.`)) return;
    try { await api.delete(`${config.endpoint}/${row._id}`); setNotice(`${config.singular} deleted.`); await load(); }
    catch (err: unknown) { setError(errorMessage(err, "Unable to delete this record.")); }
  };
  const visibleCount = useMemo(() => rows.length, [rows]);

  return <section className="entity-page">
    <div className="entity-heading"><div><div className="entity-eyebrow">MIREXERP · SCHOOL OPERATIONS</div><h1>{config.title}</h1><p>{config.description}</p></div><button className="entity-primary" onClick={openCreate}><Plus size={17}/> Add {config.singular}</button></div>
    <div className="entity-stats"><div><span>Total records</span><strong>{total}</strong></div><div><span>Showing</span><strong>{visibleCount}</strong></div><div><span>Current page</span><strong>{page} / {totalPages}</strong></div></div>
    <div className="entity-toolbar"><label className="entity-search"><Search size={17}/><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={config.searchPlaceholder || `Search ${config.title.toLowerCase()}...`}/></label><button className="entity-secondary" onClick={() => void load()}><RefreshCw size={16}/> Refresh</button></div>
    {notice && <div className="entity-notice">{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15}/></button></div>}
    {error && !modal && <div className="entity-error"><AlertCircle size={17}/>{error}</div>}
    <div className="entity-table-wrap"><table className="entity-table"><thead><tr>{config.columns.map((column) => <th key={column.key}>{column.label}</th>)}<th className="entity-actions-head">Actions</th></tr></thead><tbody>
      {loading ? <tr><td colSpan={config.columns.length + 1} className="entity-empty">Loading records…</td></tr> : rows.length === 0 ? <tr><td colSpan={config.columns.length + 1} className="entity-empty"><div className="entity-empty-icon"><Search size={22}/></div><strong>No {config.title.toLowerCase()} found</strong><span>Create your first record or change the search.</span></td></tr> : rows.map((row) => <tr key={row._id}>{config.columns.map((column) => <td key={column.key}>{labelValue(getPath(row, column.key))}</td>)}<td><div className="entity-row-actions">{config.downloadSuffix && <button title="Download ID card" onClick={() => void download(row)}><FileDown size={15}/></button>}{config.detailLink && <a title="Student profile" href={`${config.detailPath || "/students"}/${row._id}`} className="entity-row-detail">View</a>}<button title="Edit" onClick={() => openEdit(row)}><Edit2 size={15}/></button>{config.canDelete !== false && <button title="Delete" className="danger" onClick={() => void remove(row)}><Trash2 size={15}/></button>}</div></td></tr>)}
    </tbody></table></div>
    <div className="entity-pagination"><span>{total} records</span><div><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button><span>{page} / {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next</button></div></div>
    {modal && <div className="entity-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(false); }}><form className="entity-modal" onSubmit={submit}><div className="entity-modal-head"><div><span>{editing ? "UPDATE RECORD" : "NEW RECORD"}</span><h2>{editing ? `Edit ${config.singular}` : `Add ${config.singular}`}</h2></div><button type="button" onClick={() => setModal(false)} aria-label="Close"><X/></button></div><div className="entity-form-grid">{config.fields.map((field) => <label className={field.type === "textarea" ? "entity-field full" : "entity-field"} key={field.name}><span>{field.label}{field.required && <b> *</b>}</span>{field.type === "textarea" ? <textarea required={field.required} value={form[field.name] || ""} placeholder={field.placeholder} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}/> : field.type === "select" ? <select required={field.required} value={form[field.name] || ""} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}><option value="">Select {field.label}</option>{(field.options || options[field.source || ""] || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input required={field.required} type={field.type || "text"} min={field.min} step={field.step} value={form[field.name] || ""} placeholder={field.placeholder} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.value }))}/ >}{field.help && <small>{field.help}</small>}</label>)}</div>{error && <div className="entity-error"><AlertCircle size={16}/>{error}</div>}<div className="entity-modal-actions"><button type="button" className="entity-secondary" onClick={() => setModal(false)}>Cancel</button><button className="entity-primary" type="submit" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : `Create ${config.singular}`}</button></div></form></div>}
  </section>;
}
