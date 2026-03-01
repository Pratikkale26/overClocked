import type { Request, Response, NextFunction } from "express";
import { privyClient } from "../lib/privy.js";
import { loginOrCreateUser, syncPrivyAccounts } from "../services/user.service.js";
import { prisma } from "../db.js";

export interface AuthedRequest extends Request {
    user?: {
        privyId: string;
        walletAddress?: string | null;
        email?: string | null;
        twitterHandle?: string | null;
    };
}

/**
 * Auth middleware — verifies Privy access token using the official SDK.
 * Extracts / creates User in DB and attaches req.user.
 */
export async function requireAuth(
    req: AuthedRequest,
    res: Response,
    next: NextFunction
) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            res.status(401).json({ error: "Missing authorization header" });
            return;
        }

        const token = authHeader.slice(7);

        // Verify access token with Privy SDK
        let verifiedClaims;
        try {
            verifiedClaims = await privyClient.verifyAuthToken(token);
        } catch (err) {
            console.warn("[requireAuth] Token verification failed:", err);
            res.status(401).json({ error: "Invalid or expired token" });
            return;
        }

        const privyId = verifiedClaims.userId;

        // Look up user in DB
        let user = await prisma.user.findUnique({
            where: { privyId },
            select: {
                id: true,
                privyId: true,
                walletAddress: true,
                email: true,
                twitterHandle: true,
            },
        });

        // First login — create user with Privy data
        if (!user) {
            user = await loginOrCreateUser(privyId);
        }
        // Existing user but missing wallet or twitter — re-sync from Privy
        else if (!user.walletAddress || !user.twitterHandle) {
            const linked = await syncPrivyAccounts(privyId);

            const shouldUpdate =
                (!user.walletAddress && linked.walletAddress) ||
                (!user.twitterHandle && linked.twitterHandle) ||
                (!user.email && linked.email);

            if (shouldUpdate) {
                user = await prisma.user.update({
                    where: { privyId },
                    data: {
                        ...(linked.walletAddress && !user.walletAddress && { walletAddress: linked.walletAddress }),
                        ...(linked.twitterHandle && !user.twitterHandle && { twitterHandle: linked.twitterHandle }),
                        ...(linked.email && !user.email && { email: linked.email }),
                    },
                    select: {
                        id: true,
                        privyId: true,
                        walletAddress: true,
                        email: true,
                        twitterHandle: true,
                    },
                });
            }
        }

        req.user = {
            privyId: user.privyId,
            walletAddress: user.walletAddress,
            email: user.email,
            twitterHandle: (user as any).twitterHandle ?? null,
        };

        next();
    } catch (err) {
        console.error("[requireAuth] Unexpected error:", err);
        res.status(500).json({ error: "Internal auth error" });
    }
}
