import test from "node:test";
import assert from "node:assert/strict";
import { calculateStudentBillingAmounts } from "../src/modules/subscriptions/billing-calculation";

test("monthly student-wise examples use exact paise totals", () => {
  const cases = [[100, 10, 1000], [250, 10, 2500], [500, 10, 5000], [500, 15, 7500], [500, 20, 10000], [1000, 15, 15000], [2000, 20, 40000]];
  for (const [count, rate, expected] of cases) {
    const result = calculateStudentBillingAmounts({ studentCount: count, monthlyRatePaise: rate * 100, cycle: "MONTHLY" });
    assert.equal(result.baseAmountPaise / 100, expected);
    assert.equal(result.totalPaise, result.baseAmountPaise);
  }
});

test("yearly discount and tax are calculated on the discounted yearly base", () => {
  const result = calculateStudentBillingAmounts({ studentCount: 500, monthlyRatePaise: 1500, yearlyDiscountBps: 1000, taxRateBps: 1800, cycle: "YEARLY" });
  assert.equal(result.baseAmountPaise / 100, 81000);
  assert.equal(result.discountPaise / 100, 9000);
  assert.equal(result.taxPaise / 100, 14580);
  assert.equal(result.totalPaise / 100, 95580);
});

test("rejects non-integer or negative monetary inputs", () => {
  assert.throws(() => calculateStudentBillingAmounts({ studentCount: -1, monthlyRatePaise: 1000, cycle: "MONTHLY" }));
  assert.throws(() => calculateStudentBillingAmounts({ studentCount: 10, monthlyRatePaise: 1.25, cycle: "MONTHLY" }));
});
