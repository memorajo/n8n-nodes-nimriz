#!/usr/bin/env node
/**
 * Production contract e2e for the Nimriz n8n node.
 *
 * This exercises the exact HTTP endpoint matrix that nodes/Nimriz/*.ts call,
 * against the live API, using a real workspace API key. It is the automated
 * companion to the manual "npm link into a local n8n" smoke test — it proves
 * every operation's path/method/body/response contract works end to end.
 *
 * Usage:
 *   NIMRIZ_TEST_API_KEY=<workspace api key> node test/e2e.mjs
 * Optional:
 *   NIMRIZ_TEST_DOMAIN_ID=<domain uuid>   (default: first domain from /api/v1/domains)
 *   NIMRIZ_TEST_CONNECTIONS=1             (also exercise Connection create/update/test/delete)
 *
 * Never commit a key. Use the Review Sandbox key and rotate after use.
 */

const API_BASE = process.env.NIMRIZ_API_BASE || 'https://api.nimriz.com';
const API_KEY = process.env.NIMRIZ_TEST_API_KEY;

if (!API_KEY) {
	console.error('NIMRIZ_TEST_API_KEY is required.');
	process.exit(2);
}

const redact = (s) => String(s).split(API_KEY).join('***');
let passed = 0;
let failed = 0;
const created = { linkId: null, endpointId: null, connectionId: null };

async function req(method, path, { body, qs } = {}) {
	const url = new URL(`${API_BASE}${path}`);
	if (qs) for (const [k, v] of Object.entries(qs)) if (v !== undefined) url.searchParams.set(k, String(v));
	const res = await fetch(url, {
		method,
		headers: {
			Authorization: `Bearer ${API_KEY}`,
			...(body ? { 'Content-Type': 'application/json' } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await res.text();
	let json;
	try {
		json = text ? JSON.parse(text) : {};
	} catch {
		json = { _raw: text };
	}
	return { status: res.status, json };
}

async function step(name, fn) {
	try {
		const note = await fn();
		passed++;
		console.log(`  ✓ ${name}${note ? ` — ${redact(note)}` : ''}`);
	} catch (err) {
		failed++;
		console.log(`  ✗ ${name} — ${redact(err.message)}`);
	}
}

function assert(cond, msg) {
	if (!cond) throw new Error(msg);
}

(async () => {
	console.log('Nimriz n8n node — production contract e2e\n');

	let domainId = process.env.NIMRIZ_TEST_DOMAIN_ID || null;

	await step('whoami → account_id', async () => {
		const { status, json } = await req('GET', '/api/v1/whoami');
		assert(status === 200 && json.account_id, `unexpected ${status} ${JSON.stringify(json)}`);
		return `workspace ${json.workspace_name ?? json.account_id}`;
	});

	await step('list domains', async () => {
		const { status, json } = await req('GET', '/api/v1/domains');
		assert(status === 200 && Array.isArray(json.domains), `unexpected ${status}`);
		if (!domainId && json.domains[0]) domainId = json.domains[0].id;
		return `${json.domains.length} domain(s)`;
	});

	await step('list links (limit 3)', async () => {
		const { status, json } = await req('GET', '/api/v1/links', { qs: { limit: 3 } });
		assert(status === 200 && Array.isArray(json.links), `unexpected ${status}`);
		return `${json.links.length} link(s)`;
	});

	const slug = `n8n-e2e-${Date.now().toString(36)}`;

	await step('check slug availability', async () => {
		assert(domainId, 'no domain available');
		const { status, json } = await req('POST', '/api/check-slug', { body: { domain_id: domainId, slug } });
		assert(status === 200 && typeof json.available === 'boolean', `unexpected ${status} ${JSON.stringify(json)}`);
		return `available=${json.available}`;
	});

	await step('create link', async () => {
		assert(domainId, 'no domain available');
		const { status, json } = await req('POST', '/api/shorten', {
			body: { domain_id: domainId, long_url: 'https://example.com/n8n-e2e', custom_slug: slug, redirect_status_code: 302 },
		});
		assert(status >= 200 && status < 300, `unexpected ${status} ${JSON.stringify(json)}`);
		created.linkId = json.url_id || json.id;
		assert(created.linkId, `no url_id in response ${JSON.stringify(json)}`);
		return `url_id ${created.linkId}`;
	});

	await step('get link by id', async () => {
		assert(created.linkId, 'no link created');
		const { status, json } = await req('GET', `/api/v1/links/${encodeURIComponent(created.linkId)}`);
		assert(status === 200 && json.link, `unexpected ${status} ${JSON.stringify(json)}`);
	});

	await step('find link by short_url', async () => {
		assert(created.linkId, 'no link created');
		const { status, json } = await req('GET', '/api/v1/links/find', {
			qs: { short_url: `https://rix.to/${slug}` },
		});
		// 404 is acceptable if the chosen domain is not rix.to; contract is what we assert.
		assert(status === 200 || status === 404, `unexpected ${status} ${JSON.stringify(json)}`);
		return `status ${status}`;
	});

	await step('update slug', async () => {
		assert(created.linkId, 'no link created');
		const { status, json } = await req('PUT', '/api/update-slug', {
			body: { url_id: created.linkId, new_slug: `${slug}-x` },
		});
		assert(status >= 200 && status < 300, `unexpected ${status} ${JSON.stringify(json)}`);
	});

	await step('update destination', async () => {
		const { status, json } = await req('PUT', '/api/update-destination', {
			body: { url_id: created.linkId, long_url: 'https://example.com/n8n-e2e-2' },
		});
		assert(status >= 200 && status < 300, `unexpected ${status} ${JSON.stringify(json)}`);
	});

	await step('update password (set then clear)', async () => {
		let r = await req('PUT', '/api/update-password', { body: { url_id: created.linkId, password: 'n8n-e2e-pw' } });
		// set may be plan-gated; clear must always work
		const clear = await req('PUT', '/api/update-password', { body: { url_id: created.linkId, password: null } });
		assert(clear.status >= 200 && clear.status < 300, `clear failed ${clear.status} ${JSON.stringify(clear.json)}`);
		return `set=${r.status} clear=${clear.status}`;
	});

	await step('update expiration (set future)', async () => {
		const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
		const { status, json } = await req('PUT', '/api/update-expiration', {
			body: { url_id: created.linkId, expires_at: future },
		});
		assert(status >= 200 && status < 300, `unexpected ${status} ${JSON.stringify(json)}`);
	});

	await step('get analytics (short_link_click)', async () => {
		const { status, json } = await req('GET', `/api/v1/links/${encodeURIComponent(created.linkId)}/analytics`, {
			qs: { touch_type: 'short_link_click', range_days: 30, include_bots: '0' },
		});
		assert(status === 200, `unexpected ${status} ${JSON.stringify(json)}`);
	});

	// Trigger lifecycle: subscribe then unsubscribe a webhook endpoint.
	await step('webhook subscribe (trigger create)', async () => {
		const { status, json } = await req('POST', '/api/webhooks/endpoints', {
			body: { endpoint_url: 'https://example.com/n8n-e2e-webhook', name: 'n8n: link.created', subscriptions: ['link.created'] },
		});
		assert(status >= 200 && status < 300, `unexpected ${status} ${JSON.stringify(json)}`);
		created.endpointId = json.endpoint?.id;
		assert(created.endpointId, `no endpoint.id in response ${JSON.stringify(json)}`);
		return `endpoint ${created.endpointId}`;
	});

	await step('webhook unsubscribe (trigger delete)', async () => {
		assert(created.endpointId, 'no endpoint created');
		const { status } = await req('DELETE', `/api/webhooks/endpoints/${encodeURIComponent(created.endpointId)}`);
		assert(status >= 200 && status < 300, `unexpected ${status}`);
		created.endpointId = null;
	});

	await step('list connections', async () => {
		const { account_id } = (await req('GET', '/api/v1/whoami')).json;
		const { status, json } = await req('GET', '/api/integrations/destinations', { qs: { account_id } });
		assert(status === 200 && Array.isArray(json.destinations), `unexpected ${status} ${JSON.stringify(json)}`);
		return `${json.destinations.length} connection(s)`;
	});

	if (process.env.NIMRIZ_TEST_CONNECTIONS === '1') {
		const { account_id } = (await req('GET', '/api/v1/whoami')).json;
		await step('connection create → test → delete', async () => {
			const create = await req('POST', '/api/integrations/destinations', {
				body: {
					account_id,
					name: `n8n-e2e-${Date.now().toString(36)}`,
					type: 'generic_http',
					credentials: { url: 'https://example.com/n8n-e2e-destination' },
					enabled: true,
				},
			});
			assert(create.status >= 200 && create.status < 300, `create ${create.status} ${JSON.stringify(create.json)}`);
			created.connectionId = create.json.destination?.id;
			assert(created.connectionId, `no destination id ${JSON.stringify(create.json)}`);
			const test = await req('POST', `/api/integrations/destinations/${created.connectionId}/test-send`, { body: {} });
			const del = await req('DELETE', `/api/integrations/destinations/${created.connectionId}`);
			assert(del.status >= 200 && del.status < 300, `delete ${del.status}`);
			return `create=${create.status} test=${test.status} delete=${del.status}`;
		});
	}

	// Best-effort cleanup of the created link.
	if (created.linkId) {
		await step('cleanup: delete test link', async () => {
			const { status } = await req('POST', '/api/delete-link', { body: { url_id: created.linkId } });
			assert(status >= 200 && status < 300, `delete-link ${status}`);
		});
	}

	console.log(`\n${passed} passed, ${failed} failed`);
	process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
	console.error(redact(err.stack || err.message));
	process.exit(1);
});
