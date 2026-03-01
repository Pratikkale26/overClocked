import { prisma } from "../db.js";
import { privyClient } from "../lib/privy.js";

interface LinkedAccounts {
    walletAddress?: string;
    twitterHandle?: string;
    email?: string;
}

/**
 * Fetch linked accounts from Privy and extract wallet, X handle, email.
 */
export async function syncPrivyAccounts(privyId: string): Promise<LinkedAccounts> {
    try {
        const privyUser = await privyClient.getUser(privyId);
        const linked: LinkedAccounts = {};

        // Solana wallet
        const wallet = privyUser.linkedAccounts.find(
            (a: any) => a.type === "wallet" && a.chainType === "solana"
        ) as any;
        if (wallet?.address) {
            linked.walletAddress = wallet.address;
        }

        // X / Twitter
        const twitter = privyUser.linkedAccounts.find(
            (a: any) => a.type === "twitter_oauth"
        ) as any;
        if (twitter?.username) {
            linked.twitterHandle = twitter.username;
        }

        // Email (direct or Google OAuth)
        const email = privyUser.linkedAccounts.find(
            (a: any) => a.type === "email" || a.type === "google_oauth"
        ) as any;
        if (email?.address) {
            linked.email = email.address;
        } else if (email?.email) {
            linked.email = email.email;
        }

        return linked;
    } catch (err) {
        console.error("[syncPrivyAccounts] Failed to fetch Privy user:", err);
        return {};
    }
}

/**
 * Upsert a User record with the latest data from Privy linked accounts.
 */
export async function loginOrCreateUser(privyId: string) {
    const linked = await syncPrivyAccounts(privyId);

    const user = await prisma.user.upsert({
        where: { privyId },
        update: {
            ...(linked.walletAddress && { walletAddress: linked.walletAddress }),
            ...(linked.twitterHandle && { twitterHandle: linked.twitterHandle }),
            ...(linked.email && { email: linked.email }),
        },
        create: {
            privyId,
            walletAddress: linked.walletAddress ?? null,
            twitterHandle: linked.twitterHandle ?? null,
            email: linked.email ?? null,
        },
        include: { org: true },
    });

    return user;
}
