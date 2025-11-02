import { Request, Response } from "express";
import RazorPayInstance from "../util/razorpay.util";
import { RZP_KEY_SECRET } from "../config";
import crypto from "crypto";
import User from "../model/user.model";

// All are in rupees
const PACKS = {
    basic: 600,
    plus: 3000,
    max: 8000,
};

// Credits per plan
const PLAN_CREDITS = {
    basic: { generation: 50, editing: 100 },
    plus: { generation: 200, editing: 400 },
    max: { generation: 500, editing: 1000 }
};

interface RequestProps {
    pack: "basic" | "plus" | "max";
    currency: string;
}

interface AuthRequest extends Request {
    userId?: string;
}

export const createOrder = async (req: AuthRequest, res: Response) => {
    const { pack, currency }: RequestProps = req.body;
    const userId = req.userId;

    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    if (!pack || !PACKS[pack]) {
        return res.status(400).json({ message: "Invalid pack" });
    }

    const amount = PACKS[pack];

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const options = {
            amount: amount * 100, // Convert amount to smallest currency unit
            currency: currency || 'INR',
            receipt: `receipt_${Date.now()}`,
            notes: {
                userId: userId,
                pack: pack,
                email: user.email
            }
        };

        const order = await RazorPayInstance.orders.create(options);

        // Save order to user's payment history with 'created' status
        user.payments.push({
            razorpayOrderId: order.id,
            razorpayPaymentId: '',
            plan: pack,
            amount: amount,
            createdAt: new Date(),
            status: 'created'
        } as any);

        await user.save();

        res.status(200).json({
            success: true,
            order: {
                id: order.id,
                amount: order.amount,
                currency: order.currency
            }
        });
    } catch (error) {
        console.error("Error creating RazorPay order:", error);
        res.status(500).json({ 
            success: false,
            message: 'Error creating RazorPay order' 
        });
    }
};

export const verifyPayment = async (req: AuthRequest, res: Response) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const userId = req.userId;

    if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ 
            success: false, 
            message: "Missing payment details" 
        });
    }

    try {
        // Verify signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", RZP_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ 
                success: false, 
                message: "Invalid signature" 
            });
        }

        // Update user's payment record and upgrade plan
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: "User not found" 
            });
        }

        // Find the payment record
        const paymentIndex = user.payments.findIndex(
            (p: any) => p.razorpayOrderId === razorpay_order_id
        );

        if (paymentIndex === -1) {
            return res.status(404).json({ 
                success: false, 
                message: "Payment record not found" 
            });
        }

        // Update payment record
        user.payments[paymentIndex].razorpayPaymentId = razorpay_payment_id;
        user.payments[paymentIndex].status = 'paid' as any;

        // Get the plan from payment record
        const plan = user.payments[paymentIndex].plan as "basic" | "plus" | "max";

        // Upgrade user plan and add credits
        user.plan = plan;
        user.credits.generation += PLAN_CREDITS[plan].generation;
        user.credits.editing += PLAN_CREDITS[plan].editing;
        user.credits.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        await user.save();

        return res.status(200).json({ 
            success: true,
            message: "Payment verified successfully",
            plan: user.plan,
            credits: user.credits
        });
    } catch (error) {
        console.error("Error verifying payment:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Error verifying payment" 
        });
    }
};

// Webhook handler for automatic payment updates
export const handleWebhook = async (req: Request, res: Response) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'] as string;

    if (webhookSecret) {
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(JSON.stringify(req.body))
            .digest('hex');

        if (expectedSignature !== signature) {
            return res.status(400).json({ message: 'Invalid signature' });
        }
    }

    const event = req.body.event;
    const paymentEntity = req.body.payload.payment.entity;

    try {
        if (event === 'payment.failed') {
            // Update payment status to failed
            const orderId = paymentEntity.order_id;
            const user = await User.findOne({ 'payments.razorpayOrderId': orderId });
            
            if (user) {
                const payment = user.payments.find((p: any) => p.razorpayOrderId === orderId);
                if (payment) {
                    payment.status = 'failed' as any;
                    await user.save();
                }
            }
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ success: false });
    }
};