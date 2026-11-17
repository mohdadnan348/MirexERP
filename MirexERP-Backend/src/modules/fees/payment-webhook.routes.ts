import { Router } from "express";
import { razorpayWebhook } from "./payment-webhook.controller";
const router = Router();
router.post("/razorpay", razorpayWebhook);
export default router;
