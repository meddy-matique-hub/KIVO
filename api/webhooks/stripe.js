/**
 * KIVO MATIQUE — Webhook Stripe (/api/webhooks/stripe)
 * Idempotence garantie & Vérification de signature.
 */

const { StripeAdapter, savePaymentRecord, activateSubscriptionFromPayment } = require('../_lib/payments');
const { supabaseFetch } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Lecture du raw body pour la vérification de signature cryptographique HMAC SHA256
  let rawBody = req.body;
  if (typeof rawBody === 'object') {
    rawBody = JSON.stringify(rawBody);
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Si webhookSecret est configuré, la signature est obligatoirement vérifiée
  if (webhookSecret && !StripeAdapter.verifyWebhookSignature(rawBody, sig)) {
    console.warn('[Webhook Stripe] Signature invalide rejetée.');
    return res.status(401).json({ error: 'Signature invalide' });
  }

  let event = {};
  try {
    event = typeof req.body === 'object' ? req.body : JSON.parse(rawBody);
  } catch (err) {
    return res.status(400).json({ error: 'Payload JSON invalide' });
  }

  const eventType = event.type;
  console.log(`[Webhook Stripe] Événement reçu : ${eventType}`);

  if (eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded') {
    const session = event.data?.object || {};
    const providerRef = session.id;
    const metadata = session.metadata || {};
    const userId = session.client_reference_id || metadata.kivo_user_id;
    const plan = metadata.kivo_plan;
    const cycle = metadata.kivo_cycle || 'monthly';
    const extraSeats = parseInt(metadata.kivo_extra_seats || 0, 10);
    const amount = session.amount_total ? Math.round(session.amount_total) : (session.amount ? Math.round(session.amount) : 0);

    if (!userId || !plan) {
      return res.status(200).json({ received: true, note: 'Ignoré (pas de metadata KIVO)' });
    }

    // ── VÉRIFICATION D'IDEMPOTENCE ──────────────────────────────────────────
    // Un webhook rejoué ne doit pas réactiver une deuxième fois
    try {
      const existing = await supabaseFetch(`/activities?user_id=eq.${encodeURIComponent(userId)}&type=eq.payment_succeeded&select=details`);
      if (existing.status === 200 && Array.isArray(existing.data)) {
        const alreadyProcessed = existing.data.some(a => a.details && a.details.provider_ref === providerRef);
        if (alreadyProcessed) {
          console.log(`[Webhook Stripe] Événement déjà traité pour provider_ref=${providerRef}`);
          return res.status(200).json({ received: true, idempotent: true });
        }
      }
    } catch (_) {}

    const paymentRecord = {
      id: metadata.kivo_payment_id || ('pay_' + providerRef),
      userId,
      plan,
      cycle,
      amount,
      currency: 'FCFA',
      provider: 'stripe',
      providerRef,
      status: 'succeeded',
      type: extraSeats > 0 ? 'extra_seat' : 'subscription',
      extraSeats,
      rawPayload: event
    };

    await savePaymentRecord(paymentRecord);
    await activateSubscriptionFromPayment(paymentRecord);
  }

  return res.status(200).json({ received: true });
};

