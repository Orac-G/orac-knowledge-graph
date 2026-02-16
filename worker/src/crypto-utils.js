/**
 * Crypto utilities for OKG v4.0 attestation signatures
 * Uses @noble/secp256k1 for Ethereum-compatible ECDSA signing
 * Uses @noble/hashes for Keccak-256 hashing
 */

import * as secp from '@noble/secp256k1';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';

// Configure SHA-256 for secp256k1 library
secp.hashes.sha256 = (message) => {
  return sha256(message);
};

secp.hashes.hmacSha256 = (key, message) => {
  return hmac(sha256, key, message);
};

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex) {
  if (hex.startsWith('0x')) hex = hex.slice(2);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes) {
  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Keccak-256 hash (Ethereum-compatible)
 */
export function keccak256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hash = keccak_256(data);
  return bytesToHex(hash);
}

/**
 * Derive Ethereum address from public key
 */
export function publicKeyToAddress(publicKeyBytes) {
  // Remove 0x04 prefix if present (uncompressed key)
  const key = publicKeyBytes[0] === 4 ? publicKeyBytes.slice(1) : publicKeyBytes;

  // Hash public key with Keccak-256
  const hash = keccak_256(key);

  // Take last 20 bytes as address
  const address = hash.slice(-20);

  return '0x' + Array.from(address)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create message to sign from observation fields
 */
export function createSignableMessage(observation) {
  const { entity_id, attribute, value, observed_at, source, confidence } = observation;
  return `${entity_id}|${attribute}|${value}|${observed_at}|${source}|${confidence}`;
}

/**
 * Generate ECDSA signature for observation
 *
 * @param {Object} observation - Observation object to sign
 * @param {string} privateKeyHex - Hex-encoded private key (with or without 0x prefix)
 * @returns {Object} Signature object with algorithm, public_key, signature_hex, message_hash
 */

/**
 * Verify ECDSA signature on observation
 *
 * @param {Object} observation - Observation object that was signed
 * @param {Object} signature - Signature object from signObservation
 * @returns {Object} { valid: boolean, signer: string|null, error: string|null }
 */
export async function verifySignature(observation, signature) {
  try {
    // Reconstruct message
    const message = createSignableMessage(observation);

    // Hash message
    const messageHash = keccak256(message);

    // Verify message hash matches
    if (messageHash !== signature.message_hash) {
      return {
        valid: false,
        signer: null,
        error: 'Message hash mismatch'
      };
    }

    // Verify signature structure
    if (!signature.public_key || !signature.signature_hex || !signature.algorithm) {
      return {
        valid: false,
        signer: null,
        error: 'Invalid signature structure'
      };
    }

    // Parse signature
    const sigBytes = hexToBytes(signature.signature_hex);
    const hashBytes = hexToBytes(messageHash);

    // Verify using secp256k1
    // Note: We can't easily recover address without recovery byte,
    // so we just verify the signature is valid for the message
    const publicKeyBytes = hexToBytes(signature.public_key_full);
    const isValid = secp.verify(sigBytes, hashBytes, publicKeyBytes);

    if (!isValid) {
      return {
        valid: false,
        signer: null,
        error: 'Invalid signature'
      };
    }

    return {
      valid: true,
      signer: signature.public_key,
      error: null
    };
  } catch (error) {
    return {
      valid: false,
      signer: null,
      error: error.message
    };
  }
}

/**
 * Check if entity is authorized to attest for a given source
 *
 * For now, simple check: signer address must match source
 * In production, would check ERC-8004 token ownership or delegation
 */
export function isAuthorizedSource(signerAddress, source) {
  // If source is an Ethereum address, must match signer
  if (source.startsWith('0x')) {
    return signerAddress.toLowerCase() === source.toLowerCase();
  }

  // If source is a domain (e.g., "orac.eth"), would need ENS resolution
  // For now, accept if signer is provided
  return signerAddress && signerAddress.length === 42 && signerAddress.startsWith('0x');
}
export async function signObservation(observation, privateKeyHex) {
  // Remove 0x prefix if present and convert to bytes
  const privateKeyClean = privateKeyHex.startsWith('0x') ? privateKeyHex.slice(2) : privateKeyHex;
  const privateKeyBytes = hexToBytes('0x' + privateKeyClean);

  // Create signable message
  const message = createSignableMessage(observation);

  // Hash the message
  const messageHash = keccak256(message);
  const messageHashBytes = hexToBytes(messageHash);

  // Sign with secp256k1
  const signature = await secp.signAsync(messageHashBytes, privateKeyBytes);

  // Get public key
  const publicKey = secp.getPublicKey(privateKeyBytes, false); // uncompressed
  const address = publicKeyToAddress(publicKey);
  const publicKeyHex = bytesToHex(publicKey);

  return {
    algorithm: 'ECDSA-secp256k1',
    public_key: address,
    public_key_full: publicKeyHex,  // Full public key for verification
    signature_hex: bytesToHex(signature),
    message_hash: messageHash
  };
}
