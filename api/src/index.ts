import express from "express";
import cors from "cors";

// Prisma returns BigInt for lamport fields — make them JSON-serializable globally
(BigInt.prototype as any).toJSON = function () { return this.toString(); };

import { authRouter } from "./routes/auth.js";
import { orgsRouter } from "./routes/orgs.js";
import { campaignsRouter } from "./routes/campaigns.js";
import { donationsRouter } from "./routes/donations.js";
import { webhookRouter } from "./routes/webhook.js";
import { milestonesRouter } from "./routes/milestones.js";

const app = express();
const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

// Razorpay signature verification needs the exact raw request body.
app.use("/api/donations/upi-webhook", express.raw({ type: "application/json" }));
app.use(
    cors({
        origin: true, // Dynamically allow the requesting origin
        credentials: true,
    })
);
app.use(express.json({ limit: "5mb" }));

app.get("/health", (_req, res) => {
    res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/orgs", orgsRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/donations", donationsRouter);
app.use("/api/webhook", webhookRouter);
app.use("/api/milestones", milestonesRouter);

app.use((req, res) => {
    res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

const PORT = Number(process.env.PORT ?? 8080);
app.listen(PORT, () => {
    console.log(`API is running on port ${PORT}`);
});
