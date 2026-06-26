#!/usr/bin/env node
/*
 * Restore a full backup created by backup-blobs.js — re-uploads every saved blob
 * (image bytes AND state JSON) to its original path in the Vercel Blob store.
 *
 * Usage:
 *   node scripts/restore-blobs.js backups/full-2026-06-27T12-00-00
 *   node scripts/restore-blobs.js <dir> uploads/manolea-the-cat   # only this prefix
 *   node scripts/restore-blobs.js <dir> --missing-only            # only paths absent from the store
 *
 * Reads BLOB_READ_WRITE_TOKEN from the environment or from .env.local.
 */
const fs = require("fs");
const path = require("path");
const { put, list } = require("@vercel/blob");

function loadToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const envPath = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(envPath)) {
    const line = fs.readFileSync(envPath, "utf8").split("\n").find((l) => l.startsWith("BLOB_READ_WRITE_TOKEN="));
    if (line) return line.slice("BLOB_READ_WRITE_TOKEN=".length).trim().replace(/^"|"$/g, "");
  }
  throw new Error("BLOB_READ_WRITE_TOKEN not found (env or .env.local)");
}

async function existingSet() {
  let cursor;
  const set = new Set();
  do {
    const res = await list({ limit: 1000, cursor });
    res.blobs.forEach((b) => set.add(b.pathname));
    cursor = res.cursor;
  } while (cursor);
  return set;
}

(async () => {
  process.env.BLOB_READ_WRITE_TOKEN = loadToken();
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith("--"));
  const missingOnly = args.includes("--missing-only");
  const prefix = args.find((a) => !a.startsWith("--") && a !== dir);
  if (!dir) throw new Error("Usage: node scripts/restore-blobs.js <backup-dir> [prefix] [--missing-only]");

  const root = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  let files = manifest.files;
  if (prefix) files = files.filter((f) => f.pathname.startsWith(prefix));

  const existing = missingOnly ? await existingSet() : null;
  if (missingOnly) files = files.filter((f) => !existing.has(f.pathname));

  console.log(`Restoring ${files.length} blobs from ${dir}${missingOnly ? " (missing only)" : ""}`);
  let done = 0;
  for (const f of files) {
    const buf = fs.readFileSync(path.join(root, f.pathname));
    await put(f.pathname, buf, {
      access: "private",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: f.contentType || "application/octet-stream",
      cacheControlMaxAge: 31536000,
    });
    done += 1;
    if (done % 25 === 0) console.log(`  ${done}/${files.length} ...`);
  }
  console.log(`\nDone: restored ${done} blobs.`);
})().catch((error) => {
  console.error("Restore failed:", error.message);
  process.exit(1);
});
