const { viaggiStore } = require('./_blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  if (event.headers['x-app-secret'] !== process.env.APP_SECRET) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Bad JSON' };
  }
  if (!body || !body.endpoint) {
    return { statusCode: 400, body: 'Missing endpoint' };
  }

  const store = viaggiStore();
  let subs = [];
  try {
    const existing = await store.get('subscriptions', { type: 'json' });
    if (Array.isArray(existing)) subs = existing;
  } catch (e) {}

  const filtered = subs.filter((s) => s.endpoint !== body.endpoint);
  await store.setJSON('subscriptions', filtered);

  return { statusCode: 200, body: JSON.stringify({ ok: true, totale: filtered.length }) };
};
