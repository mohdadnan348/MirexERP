import { createHmac, timingSafeEqual } from "node:crypto";
import { Types } from "mongoose";
import { SubscriptionBillingInvoice, SubscriptionBillingPayment } from "./student-billing.model";
import { AppError } from "../../utils/AppError";

type Actor = { userId: string; schoolId: string; role: string };
const credentials = () => { const keyId = process.env.RAZORPAY_KEY_ID?.trim(); const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim(); if (!keyId || !keySecret) throw new AppError("Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.", 503); return { keyId, keySecret, authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}` }; };
const request = async (path: string, authorization: string, method: "GET"|"POST", body?: Record<string, unknown>): Promise<any> => { let response: Response; try { response = await fetch(`https://api.razorpay.com/v1${path}`, { method, headers: { Authorization: authorization, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); } catch { throw new AppError("Unable to reach Razorpay. Please retry.", 502); } const data = await response.json() as any; if (!response.ok) throw new AppError(data?.error?.description || "Razorpay rejected the request", 502); return data; };
const objectId = (v: string) => { if (!Types.ObjectId.isValid(v)) throw new AppError("Invalid identifier", 400); return new Types.ObjectId(v); };
export async function createSubscriptionPaymentOrder(invoiceId: string, actor: Actor) {
 const invoice = await SubscriptionBillingInvoice.findOne({ _id: objectId(invoiceId), schoolId: objectId(actor.schoolId) }); if (!invoice) throw new AppError("SaaS subscription invoice not found", 404);
 if (invoice.paymentStatus === "PAID") throw new AppError("This invoice is already paid", 409);
 if (invoice.currency !== "INR") throw new AppError("Razorpay checkout is currently configured for INR subscription invoices only", 409);
 const { keyId, authorization } = credentials(); const amount = Number(invoice.totalPaise);
 if (!Number.isSafeInteger(amount) || amount <= 0) throw new AppError("Invoice amount must be greater than zero", 409);
 const order = await request("/orders", authorization, "POST", { amount, currency: invoice.currency, receipt: invoice.invoiceNumber.slice(0, 40), notes: { kind: "SAAS_SUBSCRIPTION", invoiceId: String(invoice._id), schoolId: actor.schoolId, initiatedBy: actor.userId } });
 if (!order.id) throw new AppError("Razorpay did not return an order ID", 502);
 invoice.gatewayOrderId = order.id; invoice.gatewayOrderAmountPaise = amount; await invoice.save();
 return { provider: "RAZORPAY", keyId, orderId: order.id, amount, currency: invoice.currency, invoiceId: String(invoice._id), invoiceNumber: invoice.invoiceNumber };
}
async function settleCapturedPayment(input: { invoiceId: string; schoolId: string; userId: string; orderId: string; paymentId: string; amountPaise: number; currency: string }) {
 const invoice = await SubscriptionBillingInvoice.findOne({ _id: objectId(input.invoiceId), schoolId: objectId(input.schoolId), gatewayOrderId: input.orderId });
 if (!invoice) throw new AppError("Razorpay order does not match a SaaS invoice", 404);
 if (input.amountPaise !== invoice.totalPaise || input.amountPaise !== invoice.gatewayOrderAmountPaise || input.currency !== invoice.currency) throw new AppError("Captured payment amount or currency does not match the invoice", 409);
 const existing = await SubscriptionBillingPayment.findOne({ gatewayPaymentId: input.paymentId });
 if (!existing) {
   try { await SubscriptionBillingPayment.create({ schoolId: invoice.schoolId, invoiceId: invoice._id, gateway: "RAZORPAY", gatewayOrderId: input.orderId, gatewayPaymentId: input.paymentId, amountPaise: input.amountPaise, currency: input.currency, status: "CAPTURED", verifiedAt: new Date(), initiatedBy: objectId(input.userId) }); }
   catch (error: any) { if (error?.code !== 11000) throw error; }
 }
 await SubscriptionBillingInvoice.updateOne({ _id: invoice._id, paymentStatus: { $ne: "PAID" } }, { $set: { paymentStatus: "PAID", paymentReference: input.paymentId } });
 return { alreadyProcessed: Boolean(existing), invoiceId: String(invoice._id), invoiceNumber: invoice.invoiceNumber, paymentId: input.paymentId, paymentStatus: "PAID" };
}
export async function verifySubscriptionPayment(input: { invoiceId: string; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }, actor: Actor) {
 const invoice = await SubscriptionBillingInvoice.findOne({ _id: objectId(input.invoiceId), schoolId: objectId(actor.schoolId), gatewayOrderId: input.razorpayOrderId }); if (!invoice) throw new AppError("Invoice or payment order not found", 404);
 const { keySecret, authorization } = credentials(); const expected = createHmac("sha256", keySecret).update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`).digest("hex"); const a = Buffer.from(expected, "hex"); const b = Buffer.from(input.razorpaySignature || "", "hex");
 if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError("Razorpay payment signature verification failed", 401);
 const payment = await request(`/payments/${encodeURIComponent(input.razorpayPaymentId)}`, authorization, "GET");
 if (payment.status !== "captured" || payment.order_id !== input.razorpayOrderId) throw new AppError("Razorpay payment is not captured for this order", 409);
 return settleCapturedPayment({ invoiceId: input.invoiceId, schoolId: actor.schoolId, userId: actor.userId, orderId: input.razorpayOrderId, paymentId: input.razorpayPaymentId, amountPaise: Number(payment.amount), currency: String(payment.currency) });
}
export async function processSubscriptionPaymentWebhook(payload: Record<string, any>) {
 const event = String(payload.event || ""); if (event !== "payment.captured") return { ignored: true, event };
 const entity = payload.payload?.payment?.entity; if (!entity?.id || !entity?.order_id || entity.status !== "captured") throw new AppError("Webhook does not contain a captured payment", 400);
 const { authorization } = credentials(); const order = await request(`/orders/${encodeURIComponent(entity.order_id)}`, authorization, "GET"); const notes = order.notes || {};
 if (notes.kind !== "SAAS_SUBSCRIPTION" || !notes.invoiceId || !notes.schoolId || !notes.initiatedBy) return { ignored: true, reason: "Not a SaaS subscription order" };
 return settleCapturedPayment({ invoiceId: String(notes.invoiceId), schoolId: String(notes.schoolId), userId: String(notes.initiatedBy), orderId: String(entity.order_id), paymentId: String(entity.id), amountPaise: Number(entity.amount), currency: String(entity.currency) });
}
