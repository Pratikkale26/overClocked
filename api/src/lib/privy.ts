import "dotenv/config";
import { PrivyClient } from "@privy-io/server-auth";

const privyAppId = process.env.PRIVY_APP_ID ?? "";
const privyAppSecret = process.env.PRIVY_APP_SECRET ?? "";

if (!privyAppId || !privyAppSecret) {
    throw new Error(
        "Missing PRIVY_APP_ID or PRIVY_APP_SECRET in api/.env. " +
        "Set both and restart the API server."
    );
}

export const privyClient = new PrivyClient(privyAppId, privyAppSecret);
