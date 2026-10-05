import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
const nativeRequire = createRequire(import.meta.url);

// Execute the actual TypeScript route handlers with isolated auth/provider
// boundaries and a PostgreSQL engine, never production accounts or services.
function harness(db) {
  const state = { userId: 'alice', providerCalls: 0, failProvider: false };
  const cache = new Map();
  const sql = async (strings, ...values) => {
    const query = strings.reduce((out, text, i) => out + (i ? `$${i}` : '') + text, '');
    return (await db.query(query, values)).rows;
  };
  const openai = class {
    chat = { completions: { create: async () => {
      state.providerCalls++;
      if (state.failProvider) throw new Error('private-provider-details');
      return { choices: [{ message: { content: 'Example ad' } }] };
    } } };
  };
  function load(file) {
    file = path.resolve(file);
    if (cache.has(file)) return cache.get(file).exports;
    const loadedModule = { exports: {} };
    cache.set(file, loadedModule);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const localRequire = (name) => {
      if (name === '@/app/lib/db') return { sql };
      if (name === '@clerk/nextjs/server') return { auth: async () => ({ userId: state.userId }) };
      if (name === 'openai') return openai;
      if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
      return nativeRequire(name);
    };
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return { load, state };
}
const jsonRequest = (body, extra = {}) => new Request('https://example.com/api/generate', {
  method: 'POST', headers: { 'content-type': 'application/json', ...extra }, body: JSON.stringify(body),
});
async function database() {
  const db = new PGlite();
  await db.exec(`CREATE TABLE users (clerk_user_id TEXT PRIMARY KEY, ads_used INTEGER NOT NULL DEFAULT 0, ads_limit INTEGER NOT NULL DEFAULT 10);
    CREATE TABLE ads (id SERIAL PRIMARY KEY, brand_name TEXT, product TEXT, audience TEXT, benefit TEXT, website TEXT, tone TEXT, ad_type TEXT, ad_count INTEGER, generated_ads TEXT, created_at TIMESTAMPTZ DEFAULT NOW());`);
  return db;
}

test('private ad listing/deletion cannot access another owner or legacy records', async () => {
  const db = await database();
  try {
    const { load, state } = harness(db);
    const route = load('app/api/ads/route.ts');
    state.userId = null;
    assert.equal((await route.GET()).status, 401);
    assert.equal((await route.DELETE(new Request('https://example.com/api/ads?id=1', { method: 'DELETE' }))).status, 401);
    state.userId = 'alice';
    await route.GET(); // applies additive migration
    await db.exec(`INSERT INTO ads (clerk_user_id, product) VALUES ('alice','Alice private'), ('bob','Bob private'), (NULL,'Legacy private');`);
    const response = await route.GET();
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual((await response.json()).map(ad => ad.product), ['Alice private']);
    for (const id of [2,3,999]) {
      assert.equal((await route.DELETE(new Request(`https://example.com/api/ads?id=${id}`, { method: 'DELETE' }))).status, 404);
    }
    assert.equal((await route.DELETE(new Request('https://example.com/api/ads?id=1', { method: 'DELETE', headers: { origin: 'https://evil.example' } }))).status, 403);
    assert.equal((await route.DELETE(new Request('https://example.com/api/ads?id=1', { method: 'DELETE' }))).status, 200);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM ads')).rows[0].n, 2);
  } finally { await db.close(); }
});

test('parallel text requests reserve the last credit once and save with server-derived ownership', async () => {
  const db = await database();
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-only';
  try {
    await db.exec(`INSERT INTO users VALUES ('alice', 0, 1)`);
    const { load, state } = harness(db);
    const { POST } = load('app/api/generate/route.ts');
    const responses = await Promise.all(Array.from({ length: 4 }, () => POST(jsonRequest({ product: 'Coffee', audience: 'Readers', clerk_user_id: 'bob' }))));
    assert.equal(responses.filter(r => r.status === 200).length, 1);
    assert.equal(responses.filter(r => r.status === 403).length, 3);
    assert.equal(state.providerCalls, 1);
    assert.deepEqual((await db.query('SELECT clerk_user_id FROM ads')).rows, [{ clerk_user_id: 'alice' }]);
    assert.equal((await db.query('SELECT ads_used FROM users')).rows[0].ads_used, 1);
  } finally { if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; await db.close(); }
});

test('invalid/oversized/cross-origin input makes no provider calls; failure refunds credit without exposing details', async () => {
  const db = await database();
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-only';
  try {
    const { load, state } = harness(db);
    const { POST } = load('app/api/generate/route.ts');
    const details = { product: 'Coffee', audience: 'Readers' };
    state.userId = null;
    assert.equal((await POST(jsonRequest(details))).status, 401);
    state.userId = 'alice';
    assert.equal((await POST(jsonRequest(details, { origin: 'https://evil.example' }))).status, 403);
    assert.equal((await POST(jsonRequest({ ...details, website: 'javascript:alert(1)' }))).status, 400);
    assert.equal((await POST(jsonRequest({ ...details, product: {} }))).status, 400);
    assert.equal((await POST(jsonRequest({ ...details, adCount: 1000 }))).status, 400);
    assert.equal((await POST(jsonRequest({ ...details, product: 'x'.repeat(20000) }))).status, 413);
    assert.equal(state.providerCalls, 0);
    state.failProvider = true;
    const failure = await POST(jsonRequest(details));
    assert.equal(failure.status, 503);
    assert.equal((await failure.text()).includes('private-provider-details'), false);
    assert.equal((await db.query('SELECT ads_used FROM users')).rows[0].ads_used, 0);
  } finally { if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; await db.close(); }
});

test('rate limit is shared, atomic, and isolated by user', async () => {
  const db = await database();
  try {
    const { load } = harness(db);
    const { allowRequest } = load('app/lib/ad-security.ts');
    const result = await Promise.all(Array.from({ length: 10 }, () => allowRequest('alice', 'generation', 5)));
    assert.equal(result.filter(Boolean).length, 5);
    assert.equal(await allowRequest('bob', 'generation', 5), true);
    await db.exec(`UPDATE request_limits SET window_start = NOW() - INTERVAL '2 minutes'`);
    assert.equal(await allowRequest('alice', 'generation', 5), true);
  } finally { await db.close(); }
});

test('payment credits apply once, failed writes can retry, and cancellation does not refill free credits', async () => {
  const db = await database();
  try {
    const { load } = harness(db);
    const { applyCreditEvent } = load('app/lib/billing-security.ts');
    await Promise.all(Array.from({ length: 5 }, () => applyCreditEvent('stripe', 'invoice:1', 'alice', true)));
    await db.exec(`UPDATE users SET ads_used = 7 WHERE clerk_user_id = 'alice'`);
    await applyCreditEvent('stripe', 'invoice:1', 'alice', true);
    assert.equal((await db.query('SELECT ads_used FROM users')).rows[0].ads_used, 7);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM billing_credit_events')).rows[0].n, 1);
    await applyCreditEvent('stripe', 'cancel:1', 'alice', false);
    assert.deepEqual((await db.query('SELECT ads_used, ads_limit FROM users')).rows[0], { ads_used: 7, ads_limit: 10 });
    await db.exec(`ALTER TABLE users ADD CONSTRAINT reject_bob CHECK (clerk_user_id <> 'bob')`);
    await assert.rejects(applyCreditEvent('paypal', 'sale:2', 'bob', true));
    assert.equal((await db.query("SELECT * FROM billing_credit_events WHERE event_id = 'sale:2'")).rows.length, 0);
    await db.exec('ALTER TABLE users DROP CONSTRAINT reject_bob');
    await applyCreditEvent('paypal', 'sale:2', 'bob', true);
    assert.equal((await db.query("SELECT ads_limit FROM users WHERE clerk_user_id = 'bob'")).rows[0].ads_limit, 1000);
  } finally { await db.close(); }
});

test('Stripe requires a valid signature and paid invoice; duplicate delivery cannot refill usage', async () => {
  const db = await database();
  const previousKey = process.env.STRIPE_SECRET_KEY;
  const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_only';
  try {
    const { load } = harness(db);
    const { POST } = load('app/api/stripe/webhook/route.ts');
    const Stripe = nativeRequire('stripe');
    const stripe = new Stripe('sk_test_placeholder');
    const invoice = { id: 'in_test', status: 'paid', amount_paid: 1999, parent: { subscription_details: { metadata: { clerk_user_id: 'alice' } } } };
    const event = { id: 'evt_test', type: 'invoice.paid', data: { object: invoice } };
    async function deliver(payload) {
      const body = JSON.stringify(payload);
      return POST(new Request('https://example.com/api/stripe/webhook', {
        method: 'POST', body,
        headers: { 'stripe-signature': stripe.webhooks.generateTestHeaderString({ payload: body, secret: 'whsec_test_only' }) },
      }));
    }
    assert.equal((await POST(new Request('https://example.com/api/stripe/webhook', { method: 'POST', body: JSON.stringify(event) }))).status, 400);
    assert.equal((await deliver({ ...event, type: 'checkout.session.completed' })).status, 200);
    assert.equal((await db.query('SELECT * FROM users')).rows.length, 0);
    assert.equal((await deliver({ ...event, data: { object: { ...invoice, amount_paid: 0 } } })).status, 200);
    assert.equal((await db.query('SELECT * FROM users')).rows.length, 0);
    assert.equal((await deliver(event)).status, 200);
    await db.exec(`UPDATE users SET ads_used = 20`);
    assert.equal((await deliver({ ...event, id: 'evt_another_delivery' })).status, 200);
    assert.equal((await db.query('SELECT ads_used FROM users')).rows[0].ads_used, 20);
    const paypal = load('app/api/paypal/webhook/route.ts');
    assert.equal((await paypal.POST(new Request('https://example.com/api/paypal/webhook', { method: 'POST', body: '{}' }))).status, 400);
  } finally {
    if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY; else process.env.STRIPE_SECRET_KEY = previousKey;
    if (previousSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET; else process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
    await db.close();
  }
});
