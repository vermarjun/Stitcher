import User from "../model/user.model";

import { Request, Response, NextFunction } from "express";

export const refreshCredits = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // If credits expired. `expiresAt === null` means "never expires" (free
        // signup grants + purchased credits both set null). Without this guard,
        // `null < new Date()` is true in JS, so a brand-new user's signup credits
        // get wiped to 0 on their very first authenticated request.
        if (user.credits.expiresAt && user.credits.expiresAt < new Date()) {
            user.credits.generation = 0;
            user.credits.editing = 0;
            // So that the calculation is not done everytime
            user.credits.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

            await user.save();
        }

        next();
    } catch (err) {
        console.error("Credit refresh error:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};
