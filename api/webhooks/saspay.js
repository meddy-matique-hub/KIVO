/**
 * KIVO MATIQUE — Webhook SasPay (/api/webhooks/saspay)
 * Vérifie X-Webhook-Timestamp (<= 300s) et X-Webhook-Signature (HMAC-SHA256 sur corps brut).
 */

const { supabaseFetch } = require('../_lib/supabase');
const { verifyWebhookSignature, verifyAndFulfillPayment } = require('../_lib/saspay');

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    if (Buffer.isBuffer(req.body)) return resolve(req.body);
    if (typeof req.body === 'string') return resolve(Buffer.from(req.body, 'utf8'));
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function findPaymentFromWebhookData(data) {
  if (!data || typeof data !== 'object') return null;

  const ref = data.metadata && data.metadata.payment_ref;
  if (ref) {
    const r = await supabaseFetch(`/subscription_payments?id=eq.${encodeURIComponent(String(ref))}&limit=1`);
    if (r.status === 200 && Array.isArray(r.data) && r.data[0]) return r.data[0];
  }

  const sessionCandidates = [data.session_id, data.checkout_session_id, data.provider_session_id, data.id].filter(Boolean);
  for (const sid of sessionCandidates) {
    const r = await supabaseFetch(`/subscription_payments?provider_session_id=eq.${encodeURIComponent(String(sid))}&limit=1`);
    if (r.status === 200 && Array.isArray(r.data) && r.data[0]) return r.data[0];
  }

  const payCandidates = [data.payment_id, data.id].filter(Boolean);
  for (const pid of payCandidates) {
    const r = await supabaseFetch(`/subscription_payments?provider_payment_id=eq.${encodeURIComponent(String(pid))}&limit=1`);
    if (r.status === 200 && Array.isArray(r.data) && r.data[0]) return r.data[0];
  }

  return null;
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (_) {
    return res.status(400).json({ error: 'Corps invalide' });
  }

  const signature = req.headers['x-webhook-signature'];
  const timestamp = req.headers['x-webhook-timestamp'];

  if (!verifyWebhookSignature(rawBody, signature, timestamp)) {
    return res.status(401).json({ error: 'Signature invalide' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (_) {
    return res.status(400).json({ error: 'JSON invalide' });
  }

  const eventName = String(payload?.event || req.headers['x-webhook-event'] || '');
  const data = payload?.data || {};

  if (eventName === 'transaction.success') {
    try {
      const payment = await findPaymentFromWebhookData(data);
      if (payment) {
        await verifyAndFulfillPayment(payment, supabaseFetch);
      } else {
        // Fallback : revérifier tous les paiements pending des dernières 24h auprès de SasPay
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const pendingRes = await supabaseFetch(
          `/subscription_payments?status=eq.pending&created_at=gte.${encodeURIComponent(since)}&limit=50`
        );
        if (pendingRes.status === 200 && Array.isArray(pendingRes.data)) {
          for (const row of pendingRes.data) {
            await verifyAndFulfillPayment(row, supabaseFetch);
          }
        }
      }
    } catch (err) {
      console.error('[Webhook SasPay] Erreur traitement transaction.success:', err.message);
    }
    return res.status(200).json({ received: true });
  }

  if (eventName === 'transaction.failed') {
    try {
      const payment = await findPaymentFromWebhookData(data);
      if (payment && String(payment.status).toLowerCase() === 'pending') {
        await supabaseFetch(`/subscription_payments?id=eq.${encodeURIComponent(payment.id)}&status=eq.pending`, {
          method: 'PATCH',
          body: { status: 'failed', updated_at: new Date().toISOString() }
        });
      }
    } catch (err) {
      console.error('[Webhook SasPay] Erreur traitement transaction.failed:', err.message);
    }
    return res.status(200).json({ received: true });
  }

  // Autres événements (ex: webhook.test, settlement.*) -> 200 sans action
  return res.status(200).json({ received: true });
}

handler.config = {
  api: {
    bodyParser: false
  }
};

module.exports = handler;

