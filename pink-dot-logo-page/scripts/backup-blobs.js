#!/usr/bin/env node
/*
 * Full backup of the Vercel Blob store — INCLUDING the image bytes, not just the
 * state JSON. Downloads every blob (state + uploads) into backups/full-<ts>/ with
 * the original path structure, plus a manifest.json. Restore with restore-blobs.js.
 *
 * Usage:
 *   node scripts/backup-blobs.js                 # back up everything
 *   node scripts/backup-blobs.js uploads/manolea-the-cat clients/manolea-the-cat
 *                                                # only blobs under these prefixes
 *
 * Reads BLOB_READ_WRITE_TOKEN from the environment or from .env.local.
 */
const fs = require("fs");
const path = require("path");
const { list, get } = require("@vercel/blob");

function loadToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const envPath = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(envPath)) {
    const line = fs.readFileSync(envPath, "utf8").split("\n").find((l) => l.startsWith("BLOB_READ_WRITE_TOKEN="));
    if (line) return line.slice("BLOB_READ_WRITE_TOKEN=".length).trim().replace(/^"|"$/g, "");
  }
  throw new Error("BLOB_READ_WRITE_TOKEN not found (env or .env.local)");
}

async function streamToBuffer(stream) {
  const reader = stream.getReader();
  const chunks = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

async function listAll() {
  let cursor;
  let all = [];
  do {
    const res = await list({ limit: 1000, cursor });
    all = all.concat(res.blobs);
    cursor = res.cursor;
  } while (cursor);
  return all;
}

(async () => {
  process.env.BLOB_READ_WRITE_TOKEN = loadToken();
  const prefixes = process.argv.slice(2);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(__dirname, "..", "backups", `full-${stamp}`);

  const blobs = (await listAll()).filter((b) => !prefixes.length || prefixes.some((p) => b.pathname.startsWith(p)));
  console.log(`Backing up ${blobs.length} blobs -> backups/full-${stamp}/`);

  const manifest = [];
  let done = 0;
  let bytes = 0;
  for (const blob of blobs) {
    const result = await get(blob.pathname, { access: "private", useCache: false });
    if (!result || !result.stream) {
      console.warn(`  SKIP (no stream): ${blob.pathname}`);
      continue;
    }
    const buf = await streamToBuffer(result.stream);
    const dest = path.join(outDir, blob.pathname);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    const contentType = result.headers.get("content-type") || result.blob?.contentType || "application/octet-stream";
    manifest.push({ pathname: blob.pathname, size: buf.length, contentType });
    done += 1;
    bytes += buf.length;
    if (done % 25 === 0) console.log(`  ${done}/${blobs.length} ...`);
  }

  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify({ createdAt: new Date().toISOString(), count: manifest.length, files: manifest }, null, 2));
  console.log(`\nDone: ${done} files, ${(bytes / 1048576).toFixed(1)} MB`);
  console.log(`Backup at: ${outDir}`);
  console.log(`Restore with: node scripts/restore-blobs.js backups/full-${stamp}`);
})().catch((error) => {
  console.error("Backup failed:", error.message);
  process.exit(1);
});
