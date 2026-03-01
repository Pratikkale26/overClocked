import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const source = resolve(projectRoot, "node_modules/ws/lib/subprotocol.js");
const target = resolve(
  projectRoot,
  "node_modules/@walletconnect/jsonrpc-ws-connection/node_modules/ws/lib/subprotocol.js"
);

if (existsSync(target)) {
  process.exit(0);
}

if (!existsSync(source)) {
  console.warn(`[ensure-ws-subprotocol] Source file not found: ${source}`);
  process.exit(0);
}

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`[ensure-ws-subprotocol] Restored missing file: ${target}`);
