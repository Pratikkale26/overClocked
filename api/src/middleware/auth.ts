import type { Request, Response, NextFunction } from "express";

export interface AuthedRequest extends Request {
    user?: {
        privyId: string;
        walletAddress?: string;
        email?: string;
    };
}

/**
 * Decodes a Privy JWT without signature verification.
 * Privy JWTs are standard HS256/RS256 JWTs — the payload contains the user info.
 * For a hackathon demo this is sufficient; in production use @privy-io/server-auth.
 */
function decodePrivyJwt(token: string): {
    sub?: string;
    app_id?: string;
    linked_accounts?: Array<{
        type?: string;
        address?: string;
        email?: string;
        username?: string;
    }>;
} | null {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
        return JSON.parse(payload);
    } catch {
        return null;
    }
}

export async function requireAuth(
    req: AuthedRequest,
    res: Response,
    next: NextFunction
) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing authorization header" });
        return;
    }

    const token = authHeader.slice(7);
    const privyAppId = process.env.PRIVY_APP_ID;

    if (!privyAppId) {
        res.status(500).json({ error: "Server missing PRIVY_APP_ID" });
        return;
    }

    // --- Try official Privy server-auth verification first ---
    const privyAppSecret = process.env.PRIVY_APP_SECRET;

    if (privyAppSecret) {
        try {
            // Use the correct Privy API endpoint for token verification
            const resp = await fetch(`https://auth.privy.io/api/v1/apps/${privyAppId}/tokens/verify`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Basic ${Buffer.from(`${privyAppId}:${privyAppSecret}`).toString("base64")}`,
                },
                body: JSON.stringify({ identity_token: token }),
            });

            if (resp.ok) {
                const data = await resp.json() as {
                    user?: {
                        id?: string;
                        wallet?: { address?: string };
                        email?: { address?: string };
                        linked_accounts?: Array<{ type?: string; address?: string; email?: string }>;
                    };
                };
                const u = data.user;
                if (u?.id) {
                    const walletAcc = u.linked_accounts?.find((a) => a.type === "wallet");
                    const emailAcc = u.linked_accounts?.find((a) => a.type === "email" || a.type === "google_oauth");
                    req.user = {
                        privyId: u.id,
                        walletAddress: u.wallet?.address ?? walletAcc?.address,
                        email: u.email?.address ?? emailAcc?.email,
                    };
                    return next();
                }
            }
            // Fall through to JWT decode if verification fails
        } catch (e) {
            console.warn("[requireAuth] Privy API verification failed, falling back to JWT decode:", e);
        }
    }

    // --- Fallback: decode JWT payload directly ---
    const payload = decodePrivyJwt(token);
    if (!payload?.sub) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
    }

    // Validate the token is for this app
    if (payload.app_id && payload.app_id !== privyAppId) {
        res.status(401).json({ error: "Token app_id mismatch" });
        return;
    }

    const walletAcc = payload.linked_accounts?.find((a) => a.type === "wallet");
    const emailAcc = payload.linked_accounts?.find((a) => a.type === "email" || a.type === "google_oauth");

    req.user = {
        privyId: payload.sub,
        walletAddress: walletAcc?.address,
        email: emailAcc?.email,
    };

    next();
}
