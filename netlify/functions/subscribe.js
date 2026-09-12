const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  if (event.headers['x-app-secret'] !== process.env.APP_SECRET) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  let sub;
  try {
    sub = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Bad JSON' };
  }
  if (!sub || !sub.endpoint) {
    return { statusCode: 400, body: 'Invalid subscription' };
  }

  const store = getStore('viaggi-data');
  let subs = [];
  try {
    const existing = await store.get('subscriptions', { type: 'json' });
    if (Array.isArray(existing)) subs = existing;
  } catch (e) {
    // nessuna sottoscrizione precedente
  }

  if (!subs.some((s) => s.endpoint === sub.endpoint)) {
    subs.push(sub);
    await store.setJSON('subscriptions', subs);
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true, totale: subs.length }) };
};
