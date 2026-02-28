import { PrivyClient } from "@privy-io/server-auth";
import dotenv from "dotenv";

dotenv.config();

const privyAppId = process.env.PRIVY_APP_ID;
const privyAppSecret = process.env.PRIVY_APP_SECRET;

if (!privyAppId || !privyAppSecret) {
    console.warn("⚠️ Missing PRIVY_APP_ID or PRIVY_APP_SECRET in environment variables.");
}

export const privyClient = new PrivyClient(
    privyAppId || "",
    privyAppSecret || ""
);
