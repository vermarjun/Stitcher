import { Router } from 'express';
import authMiddleware from '../middleware/auth.middleware'; 
import { createOrder, verifyPayment, handleWebhook } from '../controller/payment.controller';

const router = Router();

// Webhook route (no auth needed, verified by signature)
router.post("/webhook", handleWebhook);

// Protected routes
router.post("/create-order", authMiddleware, createOrder);
router.post("/verify", authMiddleware, verifyPayment);

export default router;