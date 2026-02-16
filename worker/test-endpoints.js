#!/usr/bin/env node

/**
 * Test /attest and /verify endpoints locally with Wrangler
 * Run: npm install -g wrangler && wrangler dev --local
 * Then: node test-endpoints.js
 */

import * as secp from '@noble/secp256k1';
import { bytesToHex } from './src/crypto-utils.js';

const API_BASE = 'http://localhost:8787';

// Test utilities
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${message}`);
}

async function testAttest() {
  console.log('\n=== Test 1: /attest endpoint ===');

  // Generate test keypair
  const privateKey = secp.utils.randomSecretKey();
  const privateKeyHex = bytesToHex(privateKey);

  const observation = {
    entity_id: 'TestAgent',
    attribute: 'status',
    value: 'operational',
    observed_at: new Date().toISOString(),
    source: 'orac.eth',
    confidence: 0.95
  };

  const response = await fetch(`${API_BASE}/attest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ observation, privateKey: privateKeyHex })
  });

  assert(response.ok, 'Attest request returns 200');

  const data = await response.json();
  assert(data.signature, 'Response includes signature');
  assert(data.signature.algorithm === 'ECDSA-secp256k1', 'Signature algorithm is correct');
  assert(data.signature.public_key, 'Signature includes public key (address)');
  assert(data.signature.signature_hex, 'Signature includes hex signature');
  assert(data.signature.message_hash, 'Signature includes message hash');

  console.log(`  Signer: ${data.signature.public_key}`);
  console.log(`  Message hash: ${data.signature.message_hash}`);

  return { observation, signature: data.signature };
}

async function testVerify(observation, signature) {
  console.log('\n=== Test 2: /verify endpoint (valid signature) ===');

  const response = await fetch(`${API_BASE}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ observation, signature })
  });

  assert(response.ok, 'Verify request returns 200');

  const data = await response.json();
  assert(data.valid === true, 'Signature is valid');
  assert(data.signer, 'Signer address is returned');
  assert(data.signer === signature.public_key, 'Signer matches signature public key');

  console.log(`  Valid: ${data.valid}`);
  console.log(`  Signer: ${data.signer}`);
  console.log(`  Authorized: ${data.authorized}`);
}

async function testVerifyTampered(observation, signature) {
  console.log('\n=== Test 3: /verify endpoint (tampered observation) ===');

  const tamperedObs = { ...observation, value: 'different-value' };

  const response = await fetch(`${API_BASE}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ observation: tamperedObs, signature })
  });

  assert(response.ok, 'Verify request returns 200');

  const data = await response.json();
  assert(data.valid === false, 'Tampered observation fails verification');
  assert(data.error, 'Error message is provided');

  console.log(`  Valid: ${data.valid}`);
  console.log(`  Error: ${data.error}`);
}

async function testMissingFields() {
  console.log('\n=== Test 4: /attest with missing fields ===');

  const response = await fetch(`${API_BASE}/attest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ observation: { entity_id: 'Test' }, privateKey: '0x1234' })
  });

  assert(response.status === 400, 'Missing fields returns 400');

  const data = await response.json();
  assert(data.error, 'Error message is provided');

  console.log(`  Error: ${data.error}`);
}

async function testRootEndpoint() {
  console.log('\n=== Test 5: Root endpoint API docs ===');

  const response = await fetch(`${API_BASE}/`);
  assert(response.ok, 'Root endpoint returns 200');

  const data = await response.json();
  assert(data.version === '4.0.0-phase1', 'Version is 4.0.0-phase1');
  assert(data.api.rest['POST /attest'], '/attest is documented');
  assert(data.api.rest['POST /verify'], '/verify is documented');

  console.log(`  Version: ${data.version}`);
  console.log(`  /attest: ${data.api.rest['POST /attest']}`);
  console.log(`  /verify: ${data.api.rest['POST /verify']}`);
}

// Run tests
(async () => {
  try {
    const { observation, signature } = await testAttest();
    await testVerify(observation, signature);
    await testVerifyTampered(observation, signature);
    await testMissingFields();
    await testRootEndpoint();

    console.log('\n=== All Tests Passed! ===\n');
    console.log('✅ /attest endpoint works');
    console.log('✅ /verify endpoint works');
    console.log('✅ Tamper detection works');
    console.log('✅ Validation works');
    console.log('✅ API documentation updated');
    console.log('\n🎉 OKG v4.0 Phase 1 attestation signatures ready!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
})();
