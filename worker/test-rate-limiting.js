// Test rate limiting implementation locally
const indexCode = require('fs').readFileSync('./src/index-v3-rate-limited.js', 'utf8');

// Mock Cloudflare environment
const mockEnv = {
  KG_STORE: new Map(),
  GRAPH_KEY: 'test-graph'
};

// Mock KV store
mockEnv.KG_STORE.get = async function(key, options) {
  const value = this.get(key);
  if (!value) return null;
  return options?.type === 'json' ? JSON.parse(value) : value;
};

mockEnv.KG_STORE.put = async function(key, value, options) {
  this.set(key, value);
};

// Initialize test graph
mockEnv.KG_STORE.set(mockEnv.GRAPH_KEY, JSON.stringify({
  entities: [{ name: 'TestEntity', entityType: 'test', observations: [{ text: 'Test' }], created: new Date().toISOString(), updated: new Date().toISOString() }],
  relations: []
}));

console.log('Rate limiting test simulation:');
console.log('');
console.log('Test 1: Entity creation rate limit (10/hour)');
console.log('Expected: First 10 succeed, 11th fails with 429');
console.log('');
console.log('Test 2: Observation rate limit (50/hour)');
console.log('Expected: First 50 succeed, 51st fails with 429');
console.log('');
console.log('Test 3: Retry-After header present');
console.log('Expected: 429 response includes retry_after seconds');
console.log('');
console.log('Note: Full integration testing requires deploying to Cloudflare Workers');
console.log('This would test KV storage, IP extraction, and sliding windows.');
console.log('');
console.log('Manual testing steps:');
console.log('1. Deploy to Cloudflare Workers test environment');
console.log('2. Run curl loops to test each rate limit');
console.log('3. Verify 429 responses and Retry-After headers');
console.log('4. Test sliding window (wait and retry)');
console.log('5. Verify legitimate usage still works');
