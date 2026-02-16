#!/usr/bin/env node

/**
 * Test suite for OKG v4.0 attestation signatures
 */

import * as secp from '@noble/secp256k1';
import {
  hexToBytes,
  bytesToHex,
  keccak256,
  publicKeyToAddress,
  createSignableMessage,
  signObservation,
  verifySignature,
  isAuthorizedSource
} from './src/crypto-utils.js';

// Test utilities
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`❌ FAILED: ${message}`);
    console.error(`  Expected: ${expected}`);
    console.error(`  Got: ${actual}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

//===================
// Test 1: Hex conversion
//===================
console.log('\n=== Test 1: Hex Conversion ===');

const testBytes = new Uint8Array([0x12, 0x34, 0xab, 0xcd]);
const testHex = bytesToHex(testBytes);
assertEqual(testHex, '0x1234abcd', 'bytesToHex converts correctly');

const parsedBytes = hexToBytes(testHex);
assert(parsedBytes.length === 4, 'hexToBytes returns correct length');
assertEqual(parsedBytes[0], 0x12, 'hexToBytes parses first byte');
assertEqual(parsedBytes[3], 0xcd, 'hexToBytes parses last byte');

//===================
// Test 2: Keccak-256 hashing
//===================
console.log('\n=== Test 2: Keccak-256 Hashing ===');

const message1 = 'Hello, Ethereum!';
const hash1 = keccak256(message1);
assert(hash1.startsWith('0x'), 'Hash has 0x prefix');
assertEqual(hash1.length, 66, 'Hash is 32 bytes (66 chars with 0x)');

// Same message should produce same hash
const hash2 = keccak256(message1);
assertEqual(hash1, hash2, 'Same message produces same hash');

// Different message should produce different hash
const hash3 = keccak256('Different message');
assert(hash1 !== hash3, 'Different messages produce different hashes');

//===================
// Test 3: Public key to address
//===================
console.log('\n=== Test 3: Public Key to Address ===');

// Generate test keypair
const privateKey = secp.utils.randomSecretKey();
const publicKey = secp.getPublicKey(privateKey, false); // uncompressed

const address = publicKeyToAddress(publicKey);
assert(address.startsWith('0x'), 'Address has 0x prefix');
assertEqual(address.length, 42, 'Address is 20 bytes (42 chars with 0x)');

//===================
// Test 4: Signable message creation
//===================
console.log('\n=== Test 4: Signable Message Creation ===');

const observation = {
  entity_id: 'Aineko',
  attribute: 'created_project',
  value: 'graph-memory-toolkit',
  observed_at: '2026-02-15T10:00:00Z',
  source: 'orac.eth',
  confidence: 0.95
};

const signableMessage = createSignableMessage(observation);
const expected = 'Aineko|created_project|graph-memory-toolkit|2026-02-15T10:00:00Z|orac.eth|0.95';
assertEqual(signableMessage, expected, 'Signable message format is correct');

//===================
// Test 5: Sign and verify observation
//===================
console.log('\n=== Test 5: Sign and Verify Observation ===');

// Sign observation
const signature = await signObservation(observation, bytesToHex(privateKey));

assert(signature.algorithm === 'ECDSA-secp256k1', 'Signature has correct algorithm');
assert(signature.public_key.startsWith('0x'), 'Signature has public key (address)');
assert(signature.signature_hex.startsWith('0x'), 'Signature has hex signature');
assert(signature.message_hash.startsWith('0x'), 'Signature has message hash');

console.log(`  Signer address: ${signature.public_key}`);
console.log(`  Message hash: ${signature.message_hash}`);

// Verify signature
const verification = await verifySignature(observation, signature);

assert(verification.valid === true, 'Signature verification succeeds');
assertEqual(verification.signer, signature.public_key, 'Recovered signer matches');
assert(verification.error === null, 'No error in verification');

//===================
// Test 6: Detect tampered observations
//===================
console.log('\n=== Test 6: Detect Tampered Observations ===');

// Modify observation after signing
const tamperedObs = { ...observation, value: 'different-project' };
const tamperedVerification = await verifySignature(tamperedObs, signature);

assert(tamperedVerification.valid === false, 'Tampered observation fails verification');
assert(tamperedVerification.error !== null, 'Error message provided for tampering');

console.log(`  Error: ${tamperedVerification.error}`);

//===================
// Test 7: Detect invalid signatures
//===================
console.log('\n=== Test 7: Detect Invalid Signatures ===');

// Invalid signature structure
const invalidSig1 = {
  algorithm: 'ECDSA-secp256k1',
  public_key: signature.public_key,
  // Missing signature_hex
  message_hash: signature.message_hash
};

const invalidVerif1 = await verifySignature(observation, invalidSig1);
assert(invalidVerif1.valid === false, 'Missing signature_hex fails verification');

// Wrong message hash
const invalidSig2 = {
  ...signature,
  message_hash: '0x' + 'a'.repeat(64)
};

const invalidVerif2 = await verifySignature(observation, invalidSig2);
assert(invalidVerif2.valid === false, 'Wrong message hash fails verification');

//===================
// Test 8: Source authorization
//===================
console.log('\n=== Test 8: Source Authorization ===');

// Ethereum address as source - must match signer
const ethAddress = signature.public_key;
assert(isAuthorizedSource(ethAddress, ethAddress), 'Matching address is authorized');
assert(!isAuthorizedSource(ethAddress, '0x' + '1'.repeat(40)), 'Non-matching address is not authorized');

// Domain name as source - accept if valid address provided
assert(isAuthorizedSource(ethAddress, 'orac.eth'), 'Valid address authorized for domain');
assert(!isAuthorizedSource('invalid', 'orac.eth'), 'Invalid address not authorized');

//===================
// Test 9: Multiple signatures on same observation
//===================
console.log('\n=== Test 9: Multiple Signatures ===');

// Sign with different private key
const privateKey2 = secp.utils.randomSecretKey();
const signature2 = await signObservation(observation, bytesToHex(privateKey2));

assert(signature2.public_key !== signature.public_key, 'Different signers have different addresses');
assert(signature2.signature_hex !== signature.signature_hex, 'Different signatures');

// Both should verify
const verif1 = await verifySignature(observation, signature);
const verif2 = await verifySignature(observation, signature2);

assert(verif1.valid && verif2.valid, 'Both signatures verify independently');

//===================
// Test 10: Signature with confidence changes
//===================
console.log('\n=== Test 10: Confidence Changes ===');

// Observations with different confidence scores are different messages
const obs1 = { ...observation, confidence: 0.9 };
const obs2 = { ...observation, confidence: 0.95 };

const sig1 = await signObservation(obs1, bytesToHex(privateKey));
const sig2 = await signObservation(obs2, bytesToHex(privateKey));

assert(sig1.message_hash !== sig2.message_hash, 'Different confidence produces different hash');

// sig1 should not verify obs2
const crossVerif = await verifySignature(obs2, sig1);
assert(crossVerif.valid === false, 'Signature for different confidence fails');

//===================
console.log('\n=== All Tests Passed! ===\n');
console.log('✅ Hex conversion works');
console.log('✅ Keccak-256 hashing works');
console.log('✅ Public key to address derivation works');
console.log('✅ Signable message creation works');
console.log('✅ Sign and verify workflow works');
console.log('✅ Tamper detection works');
console.log('✅ Invalid signature detection works');
console.log('✅ Source authorization works');
console.log('✅ Multiple signatures work');
console.log('✅ Confidence changes are detected');
console.log('\n🎉 All signature functionality verified!\n');
