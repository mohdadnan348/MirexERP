import { createHmac, timingSafeEqual } from "node:crypto";
import { Types } from "mongoose";
import { AppError } from "../../utils/AppError";
import { FeeInvoice } from "./fees.model";
import { collectFeePaymentService } from "./fees.service";

type GatewayActor = { userId: string; schoolId: string };
type RazorpayOrderResponse = { id?: string; amount?: number; currency?: string; status?: string; error?: { description?: string } };
type RazorpayPaymentResponse = { id?: string; order_id?: string; amount?: number; currency?: string; status?: string; error?: { description?: string } };

const credentials = () => {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) throw new AppError("Online fee payment is not configured. Add Razorpay credentials to the backend environment.", 503);
  return { keyId, keySecret, authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}` };
};

const razorpayRequest = async <T>(path: string, authorization: string, method: "GET"|"POST", body?: Record<string, unknown>): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`https://api.razorpay.com/v1${path}`, {
      method,
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new AppError("Unable to reach the payment provider. Please retry.", 502);
  }
  const payload = await response.json() as T & { error?: { description?: string } };
  if (!response.ok) throw new AppError(payload.error?.description || "Payment provider rejected the request", 502);
  return payload;
};

export const createRazorpayFeeOrderService = async (
  invoiceId: string,
  requestedAmount: unknown,
  actor: GatewayActor
) => {
  if (!Types.ObjectId.isValid(invoiceId) || !Types.ObjectId.isValid(actor.schoolId)) throw new AppError("Invalid invoice context", 400);
  const { keyId, keySecret, authorization } = credentials();
  const invoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId: new Types.ObjectId(actor.schoolId), isDeleted: false });
  if (!invoice) throw new AppError("Fee invoice not found", 404);
  if (invoice.status === "CANCELLED" || invoice.balanceAmount <= 0) throw new AppError("This invoice has no payable balance", 409);
  const amount = requestedAmount === undefined ? invoice.balanceAmount : Number(requestedAmount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > invoice.balanceAmount) throw new AppError("Payment amount must be greater than zero and cannot exceed the invoice balance", 400);
  const amountInPaise = Math.round(amount * 100);
  if (Math.abs(amountInPaise / 100 - amount) > 0.000001) throw new AppError("Payment amount supports up to two decimal places", 400);
  const order = await razorpayRequest<RazorpayOrderResponse>("/orders", authorization, "POST", {
    amount: amountInPaise,
    currency: "INR",
    receipt: invoice.invoiceNumber.slice(0, 40),
    notes: { schoolId: actor.schoolId, invoiceId: String(invoice._id), initiatedBy: actor.userId },
  });
  if (!order.id) throw new AppError("Payment provider did not return an order ID", 502);
  invoice.gatewayOrderId = order.id;
  invoice.gatewayOrderAmountPaise = amountInPaise;
  await invoice.save();
  return {
    provider: "RAZORPAY",
    keyId,
    orderId: order.id,
    amount: Number(order.amount || amountInPaise),
    currency: order.currency || "INR",
    invoiceId: String(invoice._id),
    invoiceNumber: invoice.invoiceNumber,
  };
};

export const verifyRazorpayFeePaymentService = async (
  input: { invoiceId: string; razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string },
  actor: GatewayActor
) => {
  if (!Types.ObjectId.isValid(input.invoiceId) || !Types.ObjectId.isValid(actor.schoolId)) throw new AppError("Invalid invoice context", 400);
  const { keySecret, authorization } = credentials();
  const expected = createHmac("sha256", keySecret).update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(input.razorpaySignature, "hex");
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    throw new AppError("Payment signature verification failed", 400);
  }

  const invoice = await FeeInvoice.findOne({
    _id: input.invoiceId,
    schoolId: new Types.ObjectId(actor.schoolId),
    gatewayOrderId: input.razorpayOrderId,
    isDeleted: false,
  });
  if (!invoice) throw new AppError("Payment order does not match this school invoice", 404);

  const payment = await razorpayRequest<RazorpayPaymentResponse>(
    `/payments/${encodeURIComponent(input.razorpayPaymentId)}`,
    authorization,
    "GET"
  );
  if (payment.order_id !== input.razorpayOrderId || payment.status !== "captured" || payment.currency !== "INR" || !payment.amount || Number(payment.amount) !== Number(invoice.gatewayOrderAmountPaise)) {
    throw new AppError("Payment has not been captured for the expected order", 409);
  }
  const amount = Number(payment.amount) / 100;
  if (amount <= 0 || amount > invoice.balanceAmount) throw new AppError("Captured amount does not match the outstanding invoice balance", 409);

  return collectFeePaymentService({
    invoiceId: String(invoice._id),
    amount,
    paymentMethod: "RAZORPAY",
    transactionReference: input.razorpayPaymentId,
    gatewayOrderId: input.razorpayOrderId,
    gatewayPaymentId: input.razorpayPaymentId,
    idempotencyKey: `razorpay-${input.razorpayPaymentId}`,
    paymentDate: new Date(),
  }, actor);
};

export const getRazorpayConfigurationStatus = () => ({
  provider: "RAZORPAY",
  configured: Boolean(process.env.RAZORPAY_KEY_ID?.trim() && process.env.RAZORPAY_KEY_SECRET?.trim()),
  webhookConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET?.trim()),
  currency: "INR",
});


export const processRazorpayWebhookService = async (payload: Record<string, unknown>) => {
  const event = String(payload.event || "");
  if (event !== "payment.captured") {
    return { ignored: true, event };
  }
  const eventPayload = payload.payload as { payment?: { entity?: RazorpayPaymentResponse } } | undefined;
  const paymentEntity = eventPayload?.payment?.entity;
  if (!paymentEntity?.id || !paymentEntity.order_id || paymentEntity.status !== "captured" || !paymentEntity.amount) {
    throw new AppError("Webhook does not contain a captured payment", 400);
  }
  const { authorization } = credentials();
  const order = await razorpayRequest<RazorpayOrderResponse & { notes?: Record<string, string> }>(
    `/orders/${encodeURIComponent(paymentEntity.order_id)}`,
    authorization,
    "GET"
  );
  const notes = order.notes || {};
  const invoiceId = notes.invoiceId;
  const schoolId = notes.schoolId;
  const userId = notes.initiatedBy;
  if (!invoiceId || !schoolId || !userId || !Types.ObjectId.isValid(invoiceId) || !Types.ObjectId.isValid(schoolId) || !Types.ObjectId.isValid(userId)) {
    throw new AppError("Payment order is missing valid school invoice metadata", 400);
  }
  const invoice = await FeeInvoice.findOne({
    _id: invoiceId, schoolId: new Types.ObjectId(schoolId),
    gatewayOrderId: paymentEntity.order_id, isDeleted: false,
  });
  if (!invoice) throw new AppError("Payment order does not match a school invoice", 404);
  const amount = Number(paymentEntity.amount) / 100;
  if (paymentEntity.currency !== "INR" || amount <= 0 || amount > invoice.balanceAmount || Number(paymentEntity.amount) !== Number(order.amount)) {
    throw new AppError("Captured payment amount is invalid for this invoice", 409);
  }
  const payment = await collectFeePaymentService({
    invoiceId: String(invoice._id), amount, paymentMethod: "RAZORPAY",
    transactionReference: paymentEntity.id,
    gatewayOrderId: paymentEntity.order_id,
    gatewayPaymentId: paymentEntity.id,
    idempotencyKey: `razorpay-${paymentEntity.id}`,
    paymentDate: new Date(),
  }, { userId, schoolId });
  return { ignored: false, payment };
};
