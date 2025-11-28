/**
 * Sapling Note Decryption - Pure Node.js Implementation
 * 
 * This module implements the cryptographic primitives needed to decrypt
 * Sapling shielded transaction outputs using a viewing key.
 * 
 * References:
 * - Zcash Protocol Specification: https://zips.z.cash/protocol/protocol.pdf
 * - ZIP 212: Shielded Coinbase
 * - ZIP 32: Key derivation
 */

import { blake2b } from "@noble/hashes/blake2b";
import { chacha20poly1305, chacha20 } from "@noble/ciphers/chacha.js";
import crypto from "crypto";

// ============================================================
// CONSTANTS
// ============================================================

/** Sapling uses a 512-bit memo field */
const MEMO_SIZE = 512;

/** Size of the compact ciphertext (first 52 bytes of enc_ciphertext) */
const COMPACT_CIPHERTEXT_SIZE = 52;

/** Note plaintext components */
const NOTE_PLAINTEXT_SIZE = 564;

/** ChaCha20-Poly1305 tag size */
const TAG_SIZE = 16;

/** Diversifier size */
const DIVERSIFIER_SIZE = 11;

/** Value size (amount in zatoshis) */
const VALUE_SIZE = 8;

/** Rcm size (randomness) */
const RCM_SIZE = 32;

// KDF personalization strings
const KDF_SAPLING_PERSONALIZATION = Buffer.from("Zcash_SaplingKDF");
const PRF_OCK_PERSONALIZATION = Buffer.from("Zcash_Derive_ock");

// ============================================================
// TYPES
// ============================================================

export interface SaplingOutput {
  cmu: Buffer;
  ephemeralKey: Buffer;
  ciphertext: Buffer;
}

export interface DecryptedNote {
  /** Diversifier (11 bytes) */
  diversifier: Buffer;
  /** Value in zatoshis */
  value: bigint;
  /** Note commitment randomness */
  rcm: Buffer;
  /** Memo field (512 bytes) */
  memo: Buffer;
  /** Decoded memo as string */
  memoText: string;
}

export interface IncomingViewingKey {
  /** The 32-byte incoming viewing key */
  ivk: Buffer;
}

// ============================================================
// JUBJUB CURVE OPERATIONS
// ============================================================

/**
 * The Jubjub curve is a twisted Edwards curve defined over the BLS12-381 scalar field.
 * Curve parameters:
 *   a = -1
 *   d = -(10240/10241)
 *   Base field: F_q where q is the BLS12-381 scalar field order
 */

// BLS12-381 scalar field order (Fr)
const FR_MODULUS = BigInt("0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001");

// Jubjub curve order
const JUBJUB_ORDER = BigInt("0x0e7db4ea6533afa906673b0101343b00a6682093ccc81082d0970e5ed6f72cb7");

// Jubjub curve parameter d
const JUBJUB_D = BigInt("0x2a9318e74bfa2b48f5fd9207e6bd7fd4292d7f6d37579d2601065fd6d6343eb1");

// Jubjub -1 coefficient
const JUBJUB_A = FR_MODULUS - BigInt(1);

/**
 * Point on the Jubjub curve in extended coordinates
 */
interface JubjubPoint {
  x: bigint;
  y: bigint;
}

/**
 * Modular arithmetic helpers
 */
function mod(n: bigint, p: bigint): bigint {
  const result = n % p;
  return result >= 0n ? result : result + p;
}

function modInverse(a: bigint, p: bigint): bigint {
  let [old_r, r] = [a, p];
  let [old_s, s] = [1n, 0n];
  
  while (r !== 0n) {
    const quotient = old_r / r;
    [old_r, r] = [r, old_r - quotient * r];
    [old_s, s] = [s, old_s - quotient * s];
  }
  
  return mod(old_s, p);
}

/**
 * Decompress a point from its y-coordinate and sign bit
 */
function decompressPoint(compressed: Buffer): JubjubPoint | null {
  if (compressed.length !== 32) return null;
  
  // The compressed format is: y-coordinate with the sign of x in the top bit
  const bytes = Buffer.from(compressed);
  const signBit = (bytes[31] & 0x80) !== 0;
  bytes[31] &= 0x7f;
  
  // Read y-coordinate (little-endian)
  let y = 0n;
  for (let i = 0; i < 32; i++) {
    y += BigInt(bytes[i]) << BigInt(i * 8);
  }
  
  if (y >= FR_MODULUS) return null;
  
  // Solve for x^2: x^2 = (y^2 - 1) / (d * y^2 - a)
  const y2 = mod(y * y, FR_MODULUS);
  const numerator = mod(y2 - 1n, FR_MODULUS);
  const denominator = mod(JUBJUB_D * y2 - JUBJUB_A, FR_MODULUS);
  
  if (denominator === 0n) return null;
  
  const x2 = mod(numerator * modInverse(denominator, FR_MODULUS), FR_MODULUS);
  
  // Compute sqrt(x2) using Tonelli-Shanks
  let x = modSqrt(x2, FR_MODULUS);
  if (x === null) return null;
  
  // Adjust sign if needed
  const xIsOdd = (x & 1n) === 1n;
  if (xIsOdd !== signBit) {
    x = mod(-x, FR_MODULUS);
  }
  
  return { x, y };
}

/**
 * Tonelli-Shanks modular square root
 */
function modSqrt(n: bigint, p: bigint): bigint | null {
  if (n === 0n) return 0n;
  
  // Check if n is a quadratic residue
  const legendre = modPow(n, (p - 1n) / 2n, p);
  if (legendre !== 1n) return null;
  
  // For p ≡ 3 (mod 4), use simple formula
  if (mod(p, 4n) === 3n) {
    return modPow(n, (p + 1n) / 4n, p);
  }
  
  // Tonelli-Shanks for general case
  let q = p - 1n;
  let s = 0n;
  while (mod(q, 2n) === 0n) {
    q /= 2n;
    s++;
  }
  
  // Find a non-residue
  let z = 2n;
  while (modPow(z, (p - 1n) / 2n, p) !== p - 1n) {
    z++;
  }
  
  let m = s;
  let c = modPow(z, q, p);
  let t = modPow(n, q, p);
  let r = modPow(n, (q + 1n) / 2n, p);
  
  while (true) {
    if (t === 1n) return r;
    
    let i = 1n;
    let temp = mod(t * t, p);
    while (temp !== 1n && i < m) {
      temp = mod(temp * temp, p);
      i++;
    }
    
    if (i === m) return null;
    
    const b = modPow(c, 1n << (m - i - 1n), p);
    m = i;
    c = mod(b * b, p);
    t = mod(t * c, p);
    r = mod(r * b, p);
  }
}

function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base = base % mod;
  
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % mod;
    }
    exp = exp / 2n;
    base = (base * base) % mod;
  }
  
  return result;
}

/**
 * Scalar multiplication on Jubjub curve (simplified for key agreement)
 */
function scalarMult(scalar: Buffer, point: JubjubPoint): JubjubPoint {
  // Convert scalar to bigint (little-endian)
  let k = 0n;
  for (let i = 0; i < 32; i++) {
    k += BigInt(scalar[i]) << BigInt(i * 8);
  }
  k = mod(k, JUBJUB_ORDER);
  
  // Double-and-add algorithm on twisted Edwards curve
  let result: JubjubPoint = { x: 0n, y: 1n }; // Identity
  let current = point;
  
  while (k > 0n) {
    if ((k & 1n) === 1n) {
      result = pointAdd(result, current);
    }
    current = pointDouble(current);
    k >>= 1n;
  }
  
  return result;
}

/**
 * Point addition on twisted Edwards curve: a*x^2 + y^2 = 1 + d*x^2*y^2
 */
function pointAdd(p1: JubjubPoint, p2: JubjubPoint): JubjubPoint {
  const { x: x1, y: y1 } = p1;
  const { x: x2, y: y2 } = p2;
  
  const x1x2 = mod(x1 * x2, FR_MODULUS);
  const y1y2 = mod(y1 * y2, FR_MODULUS);
  const dx1x2y1y2 = mod(JUBJUB_D * x1x2 * y1y2, FR_MODULUS);
  
  const x3num = mod(x1 * y2 + y1 * x2, FR_MODULUS);
  const x3den = mod(1n + dx1x2y1y2, FR_MODULUS);
  
  const y3num = mod(y1y2 - JUBJUB_A * x1x2, FR_MODULUS);
  const y3den = mod(1n - dx1x2y1y2, FR_MODULUS);
  
  const x3 = mod(x3num * modInverse(x3den, FR_MODULUS), FR_MODULUS);
  const y3 = mod(y3num * modInverse(y3den, FR_MODULUS), FR_MODULUS);
  
  return { x: x3, y: y3 };
}

/**
 * Point doubling on twisted Edwards curve
 */
function pointDouble(p: JubjubPoint): JubjubPoint {
  return pointAdd(p, p);
}

// ============================================================
// KEY DERIVATION FUNCTIONS
// ============================================================

/**
 * Derive the symmetric key from shared secret using Blake2b
 * KDF^Sapling(shared_secret, epk)
 */
function kdfSapling(sharedSecret: Buffer, ephemeralKey: Buffer): Buffer {
  const input = Buffer.concat([sharedSecret, ephemeralKey]);
  return Buffer.from(blake2b(input, { 
    dkLen: 32,
    personalization: KDF_SAPLING_PERSONALIZATION 
  }));
}

/**
 * Parse an incoming viewing key from its serialized form
 * Sapling IVK is 32 bytes
 */
export function parseIncomingViewingKey(ivkHex: string): IncomingViewingKey {
  const ivk = Buffer.from(ivkHex, "hex");
  if (ivk.length !== 32) {
    throw new Error(`Invalid IVK length: expected 32 bytes, got ${ivk.length}`);
  }
  return { ivk };
}

// ============================================================
// NOTE DECRYPTION
// ============================================================

/**
 * Attempt to decrypt a Sapling note output using an incoming viewing key
 * 
 * The process:
 * 1. Decompress ephemeral key to get point on curve
 * 2. Compute shared secret: [ivk] * epk
 * 3. Derive symmetric key using KDF
 * 4. Decrypt the ciphertext using ChaCha20-Poly1305
 * 5. Parse the note plaintext
 */
export function tryDecryptNote(
  output: SaplingOutput,
  ivk: IncomingViewingKey
): DecryptedNote | null {
  try {
    // 1. Decompress ephemeral key
    const epk = decompressPoint(output.ephemeralKey);
    if (!epk) {
      return null; // Invalid ephemeral key
    }
    
    // 2. Compute shared secret: [ivk] * epk
    const sharedPoint = scalarMult(ivk.ivk, epk);
    
    // Encode shared secret as 32 bytes (just use u-coordinate / x)
    const sharedSecret = encodePointX(sharedPoint);
    
    // 3. Derive symmetric key
    const key = kdfSapling(sharedSecret, output.ephemeralKey);
    
    // 4. Decrypt using ChaCha20-Poly1305
    // The compact ciphertext is the first 52 bytes
    // Full ciphertext would be 580 bytes (564 plaintext + 16 tag)
    // But compact blocks only have 52 bytes
    
    // For compact ciphertext, we try to decrypt what we have
    // The note plaintext format is:
    // [1 byte: lead_byte] [11 bytes: diversifier] [8 bytes: value] [32 bytes: rcm] [512 bytes: memo]
    
    // With only 52 bytes of compact ciphertext:
    // [1 byte: lead_byte] [11 bytes: diversifier] [8 bytes: value] [32 bytes: partial data]
    // We can't get the full memo, but we can detect if decryption worked
    
    const nonce = Buffer.alloc(12, 0); // Zero nonce for note encryption
    
    // For full notes, we'd need the complete ciphertext
    // For compact blocks, we do trial decryption on compact ciphertext
    if (output.ciphertext.length < COMPACT_CIPHERTEXT_SIZE) {
      return null;
    }
    
    // Try decryption (this will fail if key is wrong)
    const cipher = chacha20poly1305(key, nonce);
    
    // For compact ciphertext, we need different handling
    // The compact ciphertext doesn't include the poly1305 tag
    // We need to use raw ChaCha20 stream cipher
    const decrypted = decryptCompactCiphertext(key, output.ciphertext);
    if (!decrypted) {
      return null;
    }
    
    // 5. Parse the note plaintext
    return parseNotePlaintext(decrypted);
    
  } catch (error) {
    // Decryption failed - this is expected for outputs not meant for us
    return null;
  }
}

/**
 * Decrypt compact ciphertext using ChaCha20 stream cipher
 * (No authentication tag for compact ciphertext)
 */
function decryptCompactCiphertext(key: Buffer, ciphertext: Buffer): Buffer | null {
  try {
    // ChaCha20 with zero nonce and counter 1 (as per Zcash spec)
    const nonce = Buffer.alloc(12, 0);
    
    // Use Node's built-in crypto for ChaCha20
    const cipher = crypto.createDecipheriv('chacha20', key, nonce);
    cipher.setAutoPadding(false);
    
    let decrypted = cipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, cipher.final()]);
    
    // Check lead byte (should be 0x01 for valid Sapling notes after ZIP 212)
    if (decrypted[0] !== 0x01 && decrypted[0] !== 0x02) {
      return null;
    }
    
    return decrypted;
  } catch {
    return null;
  }
}

/**
 * Encode a Jubjub point's x-coordinate as 32 bytes (little-endian)
 */
function encodePointX(point: JubjubPoint): Buffer {
  const buf = Buffer.alloc(32);
  let x = point.x;
  for (let i = 0; i < 32; i++) {
    buf[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return buf;
}

/**
 * Parse decrypted note plaintext
 */
function parseNotePlaintext(plaintext: Buffer): DecryptedNote | null {
  if (plaintext.length < 52) {
    return null; // Too short even for compact
  }
  
  let offset = 0;
  
  // Lead byte (1 byte) - skip
  offset += 1;
  
  // Diversifier (11 bytes)
  const diversifier = plaintext.subarray(offset, offset + DIVERSIFIER_SIZE);
  offset += DIVERSIFIER_SIZE;
  
  // Value (8 bytes, little-endian)
  let value = 0n;
  for (let i = 0; i < VALUE_SIZE; i++) {
    value += BigInt(plaintext[offset + i]) << BigInt(i * 8);
  }
  offset += VALUE_SIZE;
  
  // For compact ciphertext, we don't have rcm or memo
  // We'll fill with placeholders
  const rcm = plaintext.length > offset + RCM_SIZE 
    ? plaintext.subarray(offset, offset + RCM_SIZE)
    : Buffer.alloc(RCM_SIZE);
  offset += RCM_SIZE;
  
  // Memo (512 bytes) - only if we have full ciphertext
  let memo: Buffer;
  let memoText: string;
  
  if (plaintext.length >= offset + MEMO_SIZE) {
    memo = plaintext.subarray(offset, offset + MEMO_SIZE);
    memoText = decodeMemo(memo);
  } else {
    // For compact ciphertext, memo is not available
    memo = Buffer.alloc(MEMO_SIZE);
    memoText = "[Memo not available in compact block - need full transaction]";
  }
  
  return {
    diversifier,
    value,
    rcm,
    memo,
    memoText,
  };
}

/**
 * Decode a memo field to UTF-8 string
 * Memos are null-padded, and may use the convention of 0xF6 prefix for text
 */
function decodeMemo(memo: Buffer): string {
  // Check for text memo marker (0xF6 prefix indicates proprietary/text)
  let startIdx = 0;
  if (memo[0] === 0xf6) {
    startIdx = 1;
  }
  
  // Find the end of the text (first null byte or 0xF5 marker)
  let endIdx = memo.length;
  for (let i = startIdx; i < memo.length; i++) {
    if (memo[i] === 0x00) {
      endIdx = i;
      break;
    }
  }
  
  // Decode as UTF-8
  return memo.subarray(startIdx, endIdx).toString("utf-8").trim();
}

// ============================================================
// FULL NOTE DECRYPTION (for RawTransaction)
// ============================================================

/**
 * Decrypt a full Sapling note with authentication
 * Used when we have the complete transaction, not just compact block
 */
export function decryptFullNote(
  encCiphertext: Buffer,
  ephemeralKey: Buffer,
  ivk: IncomingViewingKey
): DecryptedNote | null {
  try {
    // Expected size: 580 bytes (564 plaintext + 16 tag)
    if (encCiphertext.length !== 580) {
      return null;
    }
    
    // 1. Decompress ephemeral key
    const epk = decompressPoint(ephemeralKey);
    if (!epk) {
      return null;
    }
    
    // 2. Compute shared secret
    const sharedPoint = scalarMult(ivk.ivk, epk);
    const sharedSecret = encodePointX(sharedPoint);
    
    // 3. Derive symmetric key
    const key = kdfSapling(sharedSecret, ephemeralKey);
    
    // 4. Decrypt with ChaCha20-Poly1305
    const nonce = Buffer.alloc(12, 0);
    const cipher = chacha20poly1305(key, nonce);
    
    const plaintext = cipher.decrypt(encCiphertext);
    
    // 5. Parse note
    return parseNotePlaintext(Buffer.from(plaintext));
    
  } catch {
    return null;
  }
}

