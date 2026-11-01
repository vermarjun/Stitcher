import { OAuth2Client } from "google-auth-library";
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "../config";

/**
 * Returns an OAuth2 client for the "postmessage" (popup code) flow, or null
 * when Google sign-in is not configured.
 */
export function getOAuth2Client(): OAuth2Client | null {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return null;
    return new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, "postmessage");
}
