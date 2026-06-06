import { Request, Response } from "express";
import RazorPayInstance from "../util/razorpay.util";
import { RZP_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET } from "../config";
import crypto from "crypto";
import User from "../model/user.model";

// All amounts in rupees (INR). One-time credit packs — credits never expire.
const PACKS = {
    starter: 299,
    creator: 799,
    pro: 1999,
} as const;

// Generation credits (videos) granted per pack.
const PLAN_CREDITS = {
    starter: { generation: 25 },
    creator: { generation: 75 },
    pro: { generation: 250 },
} as const;

type Pack = keyof typeof PACKS;

interface RequestProps {
    pack: Pack;
    currency: string;
}

interface AuthRequest extends Request {
    userId?: string;
}

/**
 * Idempotently mark an order paid and grant its credits.
 *
 * A single atomic conditional update does the work: $elemMatch selects the
 * payment sub-doc by razorpayOrderId AND status != "paid", and the positional
 * `$` updates exactly that element. If the order was already credited — by the
 * synchronous /verify call OR the payment.captured webhook, whichever arrives
 * first — no sub-doc matches and nothing is granted. This makes the
 * verify + webhook double-path safe with zero risk of double credits.
 *
 * Returns { ok:false } only when the order is genuinely unknown.
 */
async function grantCreditsForOrder(
    orderId: string,
    paymentId: string
): Promise<{
    ok: boolean;
    plan?: Pack;
    alreadyGranted?: boolean;
    credits?: unknown;
    reason?: string;
}> {
    // Resolve which pack this order was for (recorded at create-order time).
    const owner = await User.findOne({ "payments.razorpayOrderId": orderId }).select("payments");
    if (!owner) return { ok: false, reason: "user_not_found" };

    const record = owner.payments.find((p: any) => p.razorpayOrderId === orderId);
    if (!record) return { ok: false, reason: "order_not_found" };

    const plan = record.plan as Pack;
    if (!plan || !PLAN_CREDITS[plan]) return { ok: false, reason: "invalid_plan" };

    const generationCredits = PLAN_CREDITS[plan].generation;

    const updated = await User.findOneAndUpdate(
        {
            _id: owner._id,
            payments: { $elemMatch: { razorpayOrderId: orderId, status: { $ne: "paid" } } },
        },
        {
            $set: {
                "payments.$.status": "paid",
                "payments.$.razorpayPaymentId": paymentId,
                plan,
                "credits.expiresAt": null,
            },
            $inc: { "credits.generation": generationCredits },
        },
        { new: true }
    ).select("plan credits");

    // No match → the order was already paid. Idempotent no-op.
    if (!updated) return { ok: true, plan, alreadyGranted: true };

    return { ok: true, plan, alreadyGranted: false, credits: updated.credits };
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
            amount: amount * 100, // smallest currency unit (paise)
            currency: currency || "INR",
            receipt: `receipt_${Date.now()}`,
            notes: {
                userId: userId,
                pack: pack,
                email: user.email,
            },
        };

        const order = await RazorPayInstance.orders.create(options);

        // Record the pending order so /verify and the webhook can resolve the
        // pack and credit the right user.
        user.payments.push({
            razorpayOrderId: order.id,
            razorpayPaymentId: "",
            plan: pack,
            amount: amount,
            createdAt: new Date(),
            status: "created",
        } as any);

        await user.save();

        res.status(200).json({
            success: true,
            order: {
                id: order.id,
                amount: order.amount,
                currency: order.currency,
            },
        });
    } catch (error) {
        console.error("Error creating RazorPay order:", error);
        res.status(500).json({
            success: false,
            message: "Error creating RazorPay order",
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
            message: "Missing payment details",
        });
    }

    try {
        // Verify the checkout signature: HMAC-SHA256 of "order_id|payment_id"
        // keyed with the Razorpay key_secret.
        const expectedSignature = crypto
            .createHmac("sha256", RZP_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: "Invalid signature",
            });
        }

        const result = await grantCreditsForOrder(razorpay_order_id, razorpay_payment_id);
        if (!result.ok) {
            return res.status(404).json({
                success: false,
                message: "Payment record not found",
            });
        }

        // Return the current balance (whether we granted now or the webhook beat
        // us to it) so the client can refresh the displayed credits immediately.
        const user = await User.findById(userId).select("plan credits");

        return res.status(200).json({
            success: true,
            message: "Payment verified successfully",
            plan: user?.plan ?? result.plan,
            credits: user?.credits,
        });
    } catch (error) {
        console.error("Error verifying payment:", error);
        return res.status(500).json({
            success: false,
            message: "Error verifying payment",
        });
    }
};

// Webhook handler — Razorpay's server-to-server notification, and the
// reliability backstop: if the buyer closes the tab before the browser /verify
// call runs, payment.captured still credits them here. The signature is
// verified against the RAW request bytes (req.rawBody, captured in index.ts)
// using the dashboard webhook secret — re-stringifying req.body would not
// reproduce the exact bytes Razorpay signed.
export const handleWebhook = async (req: Request & { rawBody?: Buffer }, res: Response) => {
    const signature = req.headers["x-razorpay-signature"] as string | undefined;

    if (RAZORPAY_WEBHOOK_SECRET) {
        const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
        const expectedSignature = crypto
            .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
            .update(raw)
            .digest("hex");

        if (!signature || expectedSignature !== signature) {
            console.warn("[webhook] invalid Razorpay signature — rejecting");
            return res.status(400).json({ message: "Invalid signature" });
        }
    } else {
        console.warn(
            "[webhook] RAZORPAY_WEBHOOK_SECRET not set — skipping signature verification (dev only)"
        );
    }

    const event: string | undefined = req.body?.event;
    const paymentEntity = req.body?.payload?.payment?.entity;

    try {
        switch (event) {
            case "payment.captured": {
                // Money received & settled — grant credits (idempotent alongside /verify).
                const orderId: string | undefined = paymentEntity?.order_id;
                const paymentId: string | undefined = paymentEntity?.id;
                if (orderId) {
                    const result = await grantCreditsForOrder(orderId, paymentId ?? "");
                    if (result.ok && !result.alreadyGranted) {
                        console.log(
                            `[webhook] payment.captured credited order ${orderId} (${result.plan})`
                        );
                    }
                }
                break;
            }
            case "payment.failed": {
                const orderId: string | undefined = paymentEntity?.order_id;
                if (orderId) {
                    await User.updateOne(
                        {
                            payments: {
                                $elemMatch: { razorpayOrderId: orderId, status: { $ne: "paid" } },
                            },
                        },
                        { $set: { "payments.$.status": "failed" } }
                    );
                }
                break;
            }
            default:
                // Disputes, refunds, settlements, authorizations, etc. —
                // acknowledged with 200 so Razorpay stops retrying; no action.
                break;
        }

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("[webhook] processing error:", error);
        // A 5xx asks Razorpay to retry — correct for transient DB errors.
        return res.status(500).json({ success: false });
    }
};
