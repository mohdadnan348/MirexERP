import { Request, Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { sendSuccess } from "../../utils/apiResponse";
import { processRazorpayWebhookService } from "./payment-gateway.service";
import { processSubscriptionPaymentWebhook } from "../subscriptions/student-billing.gateway.service";

export const razorpayWebhook = asyncHandler(async (req: Request, res: Response) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) throw new AppError("Razorpay webhook is not configured", 503);
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const signature = req.header("x-razorpay-signature") || "";
  if (!rawBody || !signature) throw new AppError("Missing webhook body or signature", 400);
  if (!/^[a-fA-F0-9]{64}$/.test(signature)) throw new AppError("Malformed Razorpay webhook signature", 400);
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(signature, "hex");
  if (expectedBuffer.length !== receivedBuffer.length || !timingSafeEqual(expectedBuffer, receivedBuffer)) {
    throw new AppError("Invalid Razorpay webhook signature", 401);
  }
  const subscriptionResult = await processSubscriptionPaymentWebhook(req.body as Record<string, any>);
  if (!("ignored" in subscriptionResult) || !subscriptionResult.ignored) return sendSuccess(res, "Razorpay SaaS subscription webhook processed", subscriptionResult);
  const result = await processRazorpayWebhookService(req.body as Record<string, unknown>);
  return sendSuccess(res, "Razorpay fee payment webhook processed", result);
});
