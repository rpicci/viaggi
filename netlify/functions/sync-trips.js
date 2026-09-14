const { viaggiStore } = require('./_blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  if (event.headers['x-app-secret'] !== process.env.APP_SECRET) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Bad JSON' };
  }
  if (!Array.isArray(payload)) {
    return { statusCode: 400, body: 'Expected an array of trips' };
  }

  const store = viaggiStore();
  await store.setJSON('trips', payload);

  return { statusCode: 200, body: JSON.stringify({ ok: true, viaggi: payload.length }) };
};
