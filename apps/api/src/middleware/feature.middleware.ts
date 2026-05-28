import { Request, Response, NextFunction } from "express";
import { FEATURES } from "../config";

// Gate a route behind a feature flag. When the feature is off the route
// responds 404 so the API surface behaves as if the endpoint doesn't exist.
export function requireFeature(feature: keyof typeof FEATURES) {
    return (_req: Request, res: Response, next: NextFunction) => {
        if (!FEATURES[feature]) {
            return res.status(404).json({
                error: { message: "Not found", code: "feature_disabled" },
            });
        }
        next();
    };
}
