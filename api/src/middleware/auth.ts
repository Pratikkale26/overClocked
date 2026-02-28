import type { Request, Response, NextFunction } from "express";
import type { User } from "@privy-io/server-auth";
import { privyClient } from "../lib/privy.js";

export interface AuthedRequest extends Request {
    user?: {
        privyId: string;
        walletAddress?: string;
        email?: string;
        twitterHandle?: string;
    };
}

function getWalletAddress(user: User): string | undefined {
    const directWallet = user.wallet?.address;
    if (directWallet) return directWallet;

    const linkedWallet = user.linkedAccounts.find((a) => a.type === "wallet");
    return linkedWallet?.address;
}

function getEmailAddress(user: User): string | undefined {
    const directEmail = user.email?.address;
    if (directEmail) return directEmail;

    for (const account of user.linkedAccounts) {
        if (account.type === "email" && "address" in account && account.address) {
            return account.address;
        }
        if (account.type === "google_oauth" && "email" in account && account.email) {
            return account.email;
        }
    }

    return undefined;
}

function getTwitterHandle(user: User): string | undefined {
    const directTwitter = user.twitter?.username;
    if (directTwitter) return directTwitter;

    const linkedTwitter = user.linkedAccounts.find((a) => a.type === "twitter_oauth");
    return linkedTwitter?.username ?? undefined;
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
    if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
        res.status(500).json({ error: "Server missing Privy credentials" });
        return;
    }

    try {
        const claims = await privyClient.verifyAuthToken(token);
        let user: User | null = null;
        try {
            user = await privyClient.getUser(claims.userId);
        } catch (userErr) {
            // Keep request auth valid even if user profile fetch is rate-limited/transient.
            console.warn("[requireAuth] Failed to fetch full Privy user profile:", userErr);
        }

        req.user = {
            privyId: claims.userId,
            walletAddress: user ? getWalletAddress(user) : undefined,
            email: user ? getEmailAddress(user) : undefined,
            twitterHandle: user ? getTwitterHandle(user) : undefined,
        };

        next();
    } catch (err) {
        console.error("[requireAuth] Privy token verification failed:", err);
        res.status(401).json({ error: "Invalid or expired token" });
    }
}
