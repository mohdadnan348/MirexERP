export type StudentBillingCycle = "MONTHLY" | "YEARLY";
export interface BillingAmounts { perStudentRatePaise: number; baseAmountPaise: number; discountPaise: number; taxPaise: number; totalPaise: number; }

/** Pure integer-paise billing calculation; safe to test without a database. */
export function calculateStudentBillingAmounts(input: {
  studentCount: number;
  monthlyRatePaise: number;
  yearlyRatePaise?: number | null;
  yearlyDiscountBps?: number;
  taxRateBps?: number;
  cycle: StudentBillingCycle;
}): BillingAmounts {
  const { studentCount, monthlyRatePaise, yearlyRatePaise, cycle } = input;
  const discountBps = Number(input.yearlyDiscountBps || 0);
  const taxRateBps = Number(input.taxRateBps || 0);
  if (!Number.isSafeInteger(studentCount) || studentCount < 0) throw new Error("Invalid billable student count");
  if (!Number.isSafeInteger(monthlyRatePaise) || monthlyRatePaise < 0) throw new Error("Invalid monthly per-student rate");
  if (yearlyRatePaise != null && (!Number.isSafeInteger(yearlyRatePaise) || yearlyRatePaise < 0)) throw new Error("Invalid yearly per-student rate");
  if (!Number.isInteger(discountBps) || discountBps < 0 || discountBps > 10000 || !Number.isInteger(taxRateBps) || taxRateBps < 0 || taxRateBps > 10000) throw new Error("Invalid discount or tax basis points");
  const monthlyBase = studentCount * monthlyRatePaise;
  const yearlyRate = yearlyRatePaise == null ? Math.round(monthlyRatePaise * 12 * (1 - discountBps / 10000)) : yearlyRatePaise;
  const perStudentRatePaise = cycle === "MONTHLY" ? monthlyRatePaise : yearlyRate;
  const baseAmountPaise = cycle === "MONTHLY" ? monthlyBase : studentCount * yearlyRate;
  const discountPaise = cycle === "YEARLY" ? Math.max(0, studentCount * monthlyRatePaise * 12 - baseAmountPaise) : 0;
  const taxPaise = Math.round(baseAmountPaise * taxRateBps / 10000);
  const totalPaise = baseAmountPaise + taxPaise;
  if (![monthlyBase, perStudentRatePaise, baseAmountPaise, discountPaise, taxPaise, totalPaise].every(Number.isSafeInteger)) throw new Error("Billing amount exceeds safe integer range");
  return { perStudentRatePaise, baseAmountPaise, discountPaise, taxPaise, totalPaise };
}
