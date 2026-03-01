import "dotenv/config";
import {
    S3Client,
    type ObjectCannedACL,
    PutObjectCommand,
    GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const AWS_REGION = process.env.AWS_REGION ?? "us-east-1";
const RAW_AWS_ENDPOINT = process.env.AWS_ENDPOINT;
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const AWS_SECRET_KEY = process.env.AWS_SECRET_KEY;
const BUCKET = process.env.AWS_S3_BUCKET ?? process.env.AWS_BUCKET ?? "";
const AWS_PUBLIC_BASE_URL = process.env.AWS_PUBLIC_BASE_URL;
const S3_OBJECT_ACL = process.env.S3_OBJECT_ACL as ObjectCannedACL | undefined;

if (!BUCKET) {
    throw new Error("Missing AWS_S3_BUCKET (or AWS_BUCKET) in api/.env");
}
if (!AWS_ACCESS_KEY || !AWS_SECRET_KEY) {
    throw new Error("Missing AWS_ACCESS_KEY or AWS_SECRET_KEY in api/.env");
}

function normalizeS3Endpoint(rawEndpoint: string | undefined, bucket: string): string | undefined {
    if (!rawEndpoint) return undefined;
    try {
        const url = new URL(rawEndpoint);
        const bucketPrefix = `${bucket.toLowerCase()}.`;
        if (url.hostname.toLowerCase().startsWith(bucketPrefix)) {
            url.hostname = url.hostname.slice(bucketPrefix.length);
        }
        return url.toString().replace(/\/+$/, "");
    } catch {
        return rawEndpoint;
    }
}

const S3_CLIENT_ENDPOINT = normalizeS3Endpoint(RAW_AWS_ENDPOINT, BUCKET);

const s3 = new S3Client({
    region: AWS_REGION,
    endpoint: S3_CLIENT_ENDPOINT, // e.g. https://sgp1.digitaloceanspaces.com
    forcePathStyle: process.env.AWS_FORCE_PATH_STYLE === "true",
    credentials: {
        accessKeyId: AWS_ACCESS_KEY,
        secretAccessKey: AWS_SECRET_KEY,
    },
});

function joinUrl(base: string, path: string): string {
    return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/**
 * Generate a 15-minute presigned PUT URL for direct browser uploads.
 * Returns the upload URL and the resulting public URL.
 */
export async function getPresignedUploadUrl(
    key: string,
    contentType: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: contentType,
        ...(S3_OBJECT_ACL ? { ACL: S3_OBJECT_ACL } : {}),
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15 min

    // Prefer explicit public CDN/base URL when configured.
    if (AWS_PUBLIC_BASE_URL) {
        return { uploadUrl, publicUrl: joinUrl(AWS_PUBLIC_BASE_URL, key) };
    }

    // Fallback URL from endpoint (DigitalOcean Spaces, MinIO gateway, etc.).
    if (RAW_AWS_ENDPOINT) {
        return { uploadUrl, publicUrl: joinUrl(RAW_AWS_ENDPOINT, key) };
    }

    // AWS S3 regional endpoint fallback.
    return { uploadUrl, publicUrl: `https://${BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}` };
}

/**
 * Generate a presigned GET URL for private files (e.g. verification docs).
 * Default 1-hour expiry.
 */
export async function getPresignedDownloadUrl(
    key: string,
    expiresIn = 3600
): Promise<string> {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(s3, command, { expiresIn });
}
