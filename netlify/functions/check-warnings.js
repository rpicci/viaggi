const webpush = require('web-push');
const { viaggiStore } = require('./_blobs');

function inferCancellazioneIso(shortDate, tripDataIso) {
  // shortDate arriva nel formato "gg.mm" (senza anno); lo deduciamo dal
  // contesto del viaggio, assumendo che la cancellazione cada sempre
  // entro i 12 mesi precedenti alla data del viaggio.
  if (!shortDate || !tripDataIso) return null;
  const m = /^(\d{1,2})\.(\d{1,2})$/.exec(String(shortDate).trim());
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const tripYear = parseInt(tripDataIso.slice(0, 4), 10);
  const pad = (n) => String(n).padStart(2, '0');
  let candidate = `${tripYear}-${pad(month)}-${pad(day)}`;
  if (candidate > tripDataIso) {
    candidate = `${tripYear - 1}-${pad(month)}-${pad(day)}`;
  }
  return candidate;
}

function romeHourNow() {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false });
  return parseInt(fmt.format(new Date()), 10);
}
function romeTodayIso() {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
  return fmt.format(new Date());
}
function daysBetween(aIso, bIso) {
  const a = new Date(aIso + 'T00:00:00Z');
  const b = new Date(bIso + 'T00:00:00Z');
  return Math.round((a - b) / 86400000);
}

exports.handler = async () => {
  // La funzione gira ogni ora; agisce solo se in Italia sono le 10:00
  // (calcolato dinamicamente, quindi già corretto per l'ora legale).
  const hour = romeHourNow();
  if (hour !== 10) {
    return { statusCode: 200, body: 'Non sono le 10 in Italia, nessuna azione.' };
  }

  const store = viaggiStore();
  const today = romeTodayIso();

  let lastRun = null;
  try {
    lastRun = await store.get('last-warning-run', { type: 'text' });
  } catch (e) {
    // prima esecuzione
  }
  if (lastRun === today) {
    return { statusCode: 200, body: 'Già eseguito oggi.' };
  }
  await store.set('last-warning-run', today);

  let trips = [];
  try {
    const t = await store.get('trips', { type: 'json' });
    if (Array.isArray(t)) trips = t;
  } catch (e) {}

  let subs = [];
  try {
    const s = await store.get('subscriptions', { type: 'json' });
    if (Array.isArray(s)) subs = s;
  } catch (e) {}

  if (!trips.length || !subs.length) {
    return { statusCode: 200, body: 'Nessun dato o nessuna sottoscrizione attiva.' };
  }

  const warnings = [];
  trips.forEach((trip) => {
    (trip.hotels || []).forEach((h) => {
      const iso = inferCancellazioneIso(h.cancellazione, trip.dataIso);
      if (!iso) return;
      const days = daysBetween(iso, today);
      if (days >= 1 && days <= 3) {
        warnings.push({ hotel: h.nome, days, destinazione: trip.arrivo });
      }
    });
  });

  if (!warnings.length) {
    return { statusCode: 200, body: 'Nessuna cancellazione hotel in scadenza.' };
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const body = warnings.length === 1
    ? `${warnings[0].hotel} (${warnings[0].destinazione}): cancellazione gratuita entro ${warnings[0].days} giorno/i`
    : warnings.map(w => `${w.hotel}: ${w.days}gg`).join(' · ');

  const payload = JSON.stringify({
    title: 'Viaggi — scadenza cancellazione hotel',
    body,
  });

  const results = await Promise.allSettled(
    subs.map((sub) => webpush.sendNotification(sub, payload))
  );

  // rimuovi sottoscrizioni non più valide (410 Gone / 404)
  const stillValid = subs.filter((_, i) => {
    const r = results[i];
    if (r.status === 'fulfilled') return true;
    const code = r.reason && r.reason.statusCode;
    return code !== 404 && code !== 410;
  });
  if (stillValid.length !== subs.length) {
    await store.setJSON('subscriptions', stillValid);
  }

  return { statusCode: 200, body: JSON.stringify({ inviate: subs.length, warnings }) };
};
