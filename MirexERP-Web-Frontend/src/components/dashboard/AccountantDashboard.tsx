"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  Clock3,
  IndianRupee,
  Receipt,
  RefreshCw,
  Wallet,
} from "lucide-react";
import "./AccountantDashboard.css";

type AnyRecord = Record<string, any>;

const unwrap = (response: any): any =>
  response?.data?.data ?? response?.data ?? response;

const money = (value: any) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const dateISO = (date: Date) => {
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
};

const rows = (value: any): AnyRecord[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.records)) return value.records;
  if (Array.isArray(value?.payments)) return value.payments;
  if (Array.isArray(value?.data)) return value.data;
  return [];
};

const getRecordDate = (record: AnyRecord) =>
  record.paymentDate ??
  record.paidAt ??
  record.transactionDate ??
  record.createdAt ??
  record.date ??
  null;

export function AccountantDashboard() {
  const [fee, setFee] = useState<AnyRecord>({});
  const [finance, setFinance] = useState<AnyRecord>({});
  const [todayFinance, setTodayFinance] = useState<AnyRecord>({});
  const [todayCollectionReport, setTodayCollectionReport] = useState<AnyRecord>({});
  const [monthCollectionReport, setMonthCollectionReport] = useState<AnyRecord>({});
  const [monthPayments, setMonthPayments] = useState<AnyRecord[]>([]);
  const [todayExpenses, setTodayExpenses] = useState<AnyRecord[]>([]);
  const [monthExpenses, setMonthExpenses] = useState<AnyRecord[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<AnyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const today = useMemo(() => dateISO(new Date()), []);
  const monthStart = useMemo(() => {
    const current = new Date();
    return dateISO(new Date(current.getFullYear(), current.getMonth(), 1));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const results = await Promise.allSettled([
        api.get("/fees/dashboard"),
        api.get("/finance/dashboard", {
          params: { startDate: monthStart, endDate: today },
        }),
        api.get("/finance/dashboard", {
          params: { startDate: today, endDate: today },
        }),
        api.get("/fees/reports/collection", {
          params: { startDate: today, endDate: today },
        }),
        api.get("/fees/reports/collection", {
          params: { startDate: monthStart, endDate: today },
        }),
        api.get("/fees/payments", {
          params: { startDate: monthStart, endDate: today, limit: 100 },
        }),
        api.get("/finance/expenses", {
          params: { startDate: today, endDate: today, limit: 100 },
        }),
        api.get("/finance/expenses", {
          params: { startDate: monthStart, endDate: today, limit: 100 },
        }),
        api.get("/fees/invoices", { params: { limit: 100 } }),
      ]);

      const get = (index: number) =>
        results[index].status === "fulfilled"
          ? unwrap((results[index] as PromiseFulfilledResult<any>).value)
          : null;

      const feeData = get(0) || {};
      const financeData = get(1) || {};
      const todayFinanceData = get(2) || {};
      const todayReportData = get(3) || {};
      const monthReportData = get(4) || {};
      const paymentData = get(5);
      const todayExpenseData = get(6);
      const monthExpenseData = get(7);
      const invoiceData = get(8);

      setFee(feeData);
      setFinance(financeData);
      setTodayFinance(todayFinanceData);
      setTodayCollectionReport(todayReportData);
      setMonthCollectionReport(monthReportData);
      setMonthPayments(rows(paymentData));
      setTodayExpenses(rows(todayExpenseData));
      setMonthExpenses(rows(monthExpenseData));
      setPendingInvoices(
        rows(invoiceData).filter((invoice) =>
          ["PENDING", "PARTIAL", "OVERDUE"].includes(
            String(invoice.status || "").toUpperCase()
          )
        )
      );

      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length === results.length) {
        setError(
          "Accountant dashboard data could not be loaded. Check your role permissions and API connection."
        );
      } else if (failures.length) {
        setError(
          "Some dashboard figures are unavailable because one or more finance endpoints could not be loaded."
        );
      }
    } catch (exception: any) {
      setError(
        exception?.response?.data?.message ||
          exception?.message ||
          "Dashboard data could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [monthStart, today]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const sum = (list: AnyRecord[], key = "amount") =>
    list.reduce((total, item) => total + (Number(item?.[key]) || 0), 0);

  const successful = (list: AnyRecord[]) =>
    list.filter(
      (item) =>
        !item.paymentStatus ||
        String(item.paymentStatus).toUpperCase() === "SUCCESS"
    );

  // Derive today's payments from the month payment list.
  // This avoids referencing an undeclared todayPayments variable and
  // does not require an additional API request.
  const todayPayments = monthPayments.filter((payment: AnyRecord) => {
    const paymentDate = getRecordDate(payment);
    return paymentDate ? dateISO(new Date(paymentDate)) === today : false;
  });

  const todayCollection = sum(successful(todayPayments));
  const monthCollection = sum(successful(monthPayments));

  const summary = finance?.summary || {};
  const totalCollected =
    Number(fee?.payments?.totalCollected ?? summary?.totalCollected) || 0;
  const pendingFees = Number(fee?.invoices?.pendingAmount) || 0;
  const defaulters = Number(fee?.invoices?.overdue) || 0;
  const todayExpense = sum(todayExpenses);
  const monthExpense = sum(monthExpenses);
  const netIncome = monthCollection - monthExpense;

  const recent: AnyRecord[] = [
    ...monthPayments.map((item: AnyRecord) => ({ ...item, _kind: "Fee payment" })),
    ...monthExpenses.map((item: AnyRecord) => ({
      ...item,
      _kind: "Expense",
      amount: item.amount,
      paymentDate: item.expenseDate || item.createdAt,
    })),
  ]
    .sort(
      (a, b) =>
        new Date(getRecordDate(b) || 0).getTime() -
        new Date(getRecordDate(a) || 0).getTime()
    )
    .slice(0, 8);

  const cards = [
    [
      "Today's Fee Collection",
      money(todayCollection),
      "Successful fee payments today",
      IndianRupee,
      "green",
    ],
    [
      "Monthly Fee Collection",
      money(monthCollection),
      "Successful payments this month",
      Wallet,
      "blue",
    ],
    [
      "Total Fees Collected",
      money(totalCollected),
      `${Number(fee?.payments?.totalPayments) || 0} successful payments`,
      Receipt,
      "violet",
    ],
    [
      "Pending Fees",
      money(pendingFees),
      `${pendingInvoices.length} pending invoices in current page`,
      Clock3,
      "amber",
    ],
    ["Total Defaulters", String(defaulters), "Overdue fee invoices", AlertCircle, "red"],
    [
      "Today's Expenses",
      money(todayExpense),
      `${todayExpenses.length} expense records today`,
      ArrowDownRight,
      "orange",
    ],
    [
      "Monthly Expenses",
      money(monthExpense),
      `${monthExpenses.length} expense records this month`,
      Banknote,
      "blue",
    ],
    [
      "Net Income",
      money(netIncome),
      "Month collection minus expenses",
      ArrowUpRight,
      "green",
    ],
  ] as const;

  return (
    <main className="accountant-dashboard">
      <header className="acc-hero">
        <div>
          <span className="acc-eyebrow">MIREXERP / FINANCE WORKSPACE</span>
          <h1>Accountant Dashboard</h1>
          <p>Fee collection, outstanding dues and school expenses at a glance.</p>
        </div>
        <button
          className="acc-refresh"
          onClick={() => void fetchData()}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "acc-spin" : ""} />
          {loading ? "Loading" : "Refresh data"}
        </button>
      </header>

      {error && (
        <div className="acc-alert">
          <AlertCircle size={17} />
          {error}
        </div>
      )}

      <section className="acc-card-grid">
        {cards.map(([label, value, note, Icon, tone]) => (
          <article className={`acc-stat ${tone}`} key={label}>
            <div className="acc-stat-top">
              <span>{label}</span>
              <i>
                <Icon size={19} />
              </i>
            </div>
            <strong>{loading ? "—" : value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>

      <section className="acc-lower-grid">
        <article className="acc-panel">
          <div className="acc-panel-head">
            <div>
              <span>PAYMENT ACTIVITY</span>
              <h2>Recent Transactions</h2>
            </div>
            <Activity size={19} />
          </div>

          {loading ? (
            <p className="acc-empty">Loading transactions…</p>
          ) : recent.length ? (
            <div className="acc-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>Payment mode</th>
                    <th>Amount</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((item: AnyRecord, index: number) => (
                    <tr key={item._id || index}>
                      <td>
                        <span
                          className={`acc-pill ${
                            item._kind === "Expense" ? "expense" : "paid"
                          }`}
                        >
                          {item._kind}
                        </span>
                      </td>
                      <td>
                        {item.receiptNumber ||
                          item.voucherNumber ||
                          item.title ||
                          "—"}
                      </td>
                      <td>{item.paymentMethod || "—"}</td>
                      <td>{money(item.amount)}</td>
                      <td>
                        {getRecordDate(item)
                          ? new Date(getRecordDate(item)).toLocaleDateString("en-IN")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="acc-empty">No transactions found for this month.</p>
          )}
        </article>

        <article className="acc-panel">
          <div className="acc-panel-head">
            <div>
              <span>ACTION REQUIRED</span>
              <h2>Pending Payments</h2>
            </div>
            <AlertCircle size={19} />
          </div>

          {loading ? (
            <p className="acc-empty">Loading pending invoices…</p>
          ) : pendingInvoices.length ? (
            <div className="acc-pending-list">
              {pendingInvoices.slice(0, 7).map((item: AnyRecord, index: number) => (
                <div key={item._id || index}>
                  <span>
                    <b>{item.invoiceNumber || "Fee invoice"}</b>
                    <small>
                      {item.studentName || item.studentId || "Student record"} ·{" "}
                      {item.dueDate
                        ? new Date(item.dueDate).toLocaleDateString("en-IN")
                        : "Due date not set"}
                    </small>
                  </span>
                  <strong>{money(item.balanceAmount ?? item.totalAmount)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="acc-empty">
              No pending invoice records returned by the server.
            </p>
          )}
        </article>
      </section>

      <footer className="acc-foot">
        <CalendarDays size={15} />
        Figures are calculated from available school-scoped finance and fee records.{" "}
        {loading ? "Refreshing…" : "Last loaded just now."}
      </footer>
    </main>
  );
}
