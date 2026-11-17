"use client";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, AlertCircle, Building2, CreditCard, CalendarClock, Layers3 } from "lucide-react";
import { api } from "@/lib/api/client";

type CountRow = { _id: string; count: number };
type Renewal = { _id: string; endDate: string; amount: number; currency: string; status: string; schoolId?: { name?: string; code?: string }; planId?: { name?: string } };
type Overview = { schoolCounts: CountRow[]; subscriptionCounts: CountRow[]; upcomingRenewals: Renewal[]; activePlans: number; paidRevenue: { _id: string; amount: number; count: number }[] };

const card: React.CSSProperties = { background: "#fff", border: "1px solid #eaecf0", borderRadius: 14, padding: 18 };
const label: React.CSSProperties = { color: "#667085", fontSize: 13, margin: 0 };
const value: React.CSSProperties = { fontSize: 27, fontWeight: 750, margin: "8px 0 0", color: "#101828" };

export default function Page() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await api.get("/platform/overview");
      setData((response?.data?.data ?? response?.data ?? response) as Overview);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setError(err.response?.data?.message || err.message || "Could not load SaaS overview.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const totalSchools = data?.schoolCounts.reduce((sum, row) => sum + row.count, 0) ?? 0;
  const totalSubscriptions = data?.subscriptionCounts.reduce((sum, row) => sum + row.count, 0) ?? 0;
  const paid = data?.paidRevenue.reduce((sum, row) => sum + row.amount, 0) ?? 0;
  const cards = [
    { title: "Schools", amount: totalSchools, icon: Building2 },
    { title: "Subscriptions", amount: totalSubscriptions, icon: CreditCard },
    { title: "Active plans", amount: data?.activePlans ?? 0, icon: Layers3 },
    { title: "Recorded paid revenue", amount: paid.toLocaleString("en-IN"), icon: CalendarClock },
  ];
  return <main style={{ padding: 24, background: "#f8fafc", minHeight: "100%" }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 22 }}>
      <div><small style={{ letterSpacing: 2, color: "#6941c6", fontWeight: 800 }}>MIREXERP / SAAS</small><h1 style={{ fontSize: 28, margin: "8px 0" }}>SaaS Platform Overview</h1><p style={{ color: "#667085", margin: 0 }}>Live school, subscription and renewal data from the platform API.</p></div>
      <button onClick={() => void load()} disabled={loading} style={{ padding: "10px 14px", border: "1px solid #d0d5dd", borderRadius: 10, background: "#fff", display: "flex", gap: 8, alignItems: "center" }}><RefreshCw size={16}/>Refresh</button>
    </header>
    {error && <div role="alert" style={{ ...card, color: "#b42318", marginBottom: 16 }}><AlertCircle size={16}/> {error}</div>}
    {loading ? <p>Loading platform data…</p> : !data ? <section style={card}>No platform overview data was returned.</section> : <>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginBottom: 20 }}>
        {cards.map(({ title, amount, icon: Icon }) => <article key={title} style={card}><div style={{ display: "flex", justifyContent: "space-between", color: "#6941c6" }}><span style={label}>{title}</span><Icon size={19}/></div><p style={value}>{amount}</p></article>)}
      </section>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
        <article style={card}><h2 style={{ fontSize: 17, marginTop: 0 }}>Schools by status</h2>{data.schoolCounts.length ? data.schoolCounts.map(row => <p key={row._id} style={{ display: "flex", justifyContent: "space-between" }}><span>{row._id}</span><strong>{row.count}</strong></p>) : <p style={label}>No school records.</p>}</article>
        <article style={card}><h2 style={{ fontSize: 17, marginTop: 0 }}>Subscriptions by status</h2>{data.subscriptionCounts.length ? data.subscriptionCounts.map(row => <p key={row._id} style={{ display: "flex", justifyContent: "space-between" }}><span>{row._id}</span><strong>{row.count}</strong></p>) : <p style={label}>No subscription records.</p>}</article>
      </section>
      <section style={{ ...card, marginTop: 16 }}><h2 style={{ fontSize: 17, marginTop: 0 }}>Upcoming renewals — next 30 days</h2>
        {data.upcomingRenewals.length ? <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><thead><tr>{["School", "Plan", "Amount", "Renewal date", "Status"].map(x => <th key={x} style={{ textAlign: "left", padding: 10, background: "#f8fafc" }}>{x}</th>)}</tr></thead><tbody>{data.upcomingRenewals.map(item => <tr key={item._id}><td style={{ padding: 11, borderBottom: "1px solid #eee" }}>{item.schoolId?.name || item.schoolId?.code || "School"}</td><td style={{ padding: 11, borderBottom: "1px solid #eee" }}>{item.planId?.name || "—"}</td><td style={{ padding: 11, borderBottom: "1px solid #eee" }}>{item.currency} {item.amount.toLocaleString("en-IN")}</td><td style={{ padding: 11, borderBottom: "1px solid #eee" }}>{new Date(item.endDate).toLocaleDateString("en-IN")}</td><td style={{ padding: 11, borderBottom: "1px solid #eee" }}>{item.status}</td></tr>)}</tbody></table></div> : <p style={label}>No active or trial subscriptions expire in the next 30 days.</p>}
      </section>
      <p style={{ color: "#667085", fontSize: 12, marginTop: 14 }}>Revenue is grouped by recorded subscription currency; amounts in different currencies should not be added for accounting or settlement totals.</p>
    </>}
  </main>;
}
