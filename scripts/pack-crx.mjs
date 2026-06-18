// pack-crx.mjs — Create a CRX3 file from an extension directory + PEM key
//
// Usage: node scripts/pack-crx.mjs <ext-dir> <key.pem> <output.crx>
//
// CRX3 format (little-endian):
//   4 bytes  magic "Cr24"
//   4 bytes  version (uint32 LE) = 3
//   4 bytes  header length (uint32 LE)
//   N bytes  protobuf CrxFileHeader
//   ...      ZIP of extension files

import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { join, basename } from "node:path";
import { execSync } from "node:child_process";

// ── CLI args ─────────────────────────────────────────────────────────
const [,, extDir, keyPath, outPath] = process.argv;
if (!extDir || !keyPath || !outPath) {
  console.error("Usage: node scripts/pack-crx.mjs <ext-dir> <key.pem> <output.crx>");
  process.exit(1);
}

// ── Load key ─────────────────────────────────────────────────────────
const pem = readFileSync(keyPath, "utf-8");
const privateKey = createPrivateKey({ key: pem, format: "pem" });
const publicKeyDer = createPublicKey(privateKey).export({ type: "spki", format: "der" });

// ── ZIP the extension directory ──────────────────────────────────────
const extName = basename(extDir);
const parentDir = join(extDir, "..");
const zipPath = outPath.replace(/\.crx$/, ".zip");

// Use system `zip` for deterministic output (available on ubuntu-latest)
execSync(`cd "${parentDir}" && zip -qr "${zipPath}" "${extName}"`, { encoding: "utf-8" });
const zipData = readFileSync(zipPath);

// ── Sign ─────────────────────────────────────────────────────────────
// 1. Compute SHA-256 of ZIP body
const zipHash = createHash("sha256").update(zipData).digest();

// 2. Serialize SignedData protobuf: field 1 (sha256_hash) = zipHash
const signedData = pbBytes(1, zipHash);

// 3. Sign the SignedData bytes with RSA-SHA256
const signatureBytes = sign("RSA-SHA256", signedData, privateKey);

// ── Build CrxFileHeader protobuf ─────────────────────────────────────
//   repeated AsymmetricKeyProof sha256_with_rsa = 2;
//     bytes public_key  = 1;
//     bytes signature   = 2;
//   bytes signed_header_data = 10000;
const keyProof = Buffer.concat([
  pbBytes(1, publicKeyDer),
  pbBytes(2, signatureBytes),
]);
const crxHeader = Buffer.concat([
  pbBytes(2, keyProof),          // sha256_with_rsa
  pbBytes(10000, signedData),    // signed_header_data
]);

// ── Write CRX3 file ──────────────────────────────────────────────────
const magic = Buffer.from("Cr24", "ascii");
const ver = Buffer.alloc(4);  ver.writeUInt32LE(3, 0);
const hdrLen = Buffer.alloc(4); hdrLen.writeUInt32LE(crxHeader.length, 0);

const crx = Buffer.concat([magic, ver, hdrLen, crxHeader, zipData]);
writeFileSync(outPath, crx);
console.log("CRX written: %s (%s KB)", outPath, (crx.length / 1024).toFixed(1));

// Clean up temp ZIP
try { unlinkSync(zipPath); } catch (_) { /* ok */ }

// ── Protobuf helper ──────────────────────────────────────────────────
// Encode a length-delimited bytes field: tag | len | payload
function pbBytes(fieldNum, data) {
  const tag = varint((fieldNum << 3) | 2);     // wire type 2
  const len = varint(data.length);
  return Buffer.concat([tag, len, data]);
}

// Encode a uint32 as a protobuf varint
function varint(n) {
  const buf = [];
  while (n > 0x7f) { buf.push(0x80 | (n & 0x7f)); n >>>= 7; }
  buf.push(n);
  return Buffer.from(buf);
}
