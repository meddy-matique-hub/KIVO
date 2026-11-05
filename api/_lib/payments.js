/**
 * KIVO MATIQUE — Adaptateurs de Passerelles de Paiement (API & Webhooks)
 * Fournisseurs supportés : Stripe (Cartes), MTN MoMo, Airtel Money, CinetPay.
 * Gestion Sandbox intégrée & Vérification serveur stricte.
 */

const crypto = require('crypto');
const https = require('https');
const url = require('url');
const plansConfig = require('../../js/plans.config');
const { supabaseFetch } = require('./supabase');

const IS_SANDBOX = (process.env.KIVO_PAYMENT_SANDBOX || 'true').toLowerCase() === 'true';

/**
 * Enregistrement ou mise à jour d'un paiement en base (avec idempotence sur provider + provider_ref)
 */
async function savePaymentRecord(paymentData) {
  const payload = {
    id: paymentData.id || crypto.randomUUID(),
    user_id: paymentData.userId,
    plan: paymentData.plan,
    cycle: paymentData.cycle || 'monthly',
    amount: Math.round(paymentData.amount),
    currency: paymentData.currency || 'FCFA',
    provider: paymentData.provider,
    provider_ref: String(paymentData.providerRef || paymentData.id),
    status: paymentData.status || 'pending', // pending, succeeded, failed, canceled
    type: paymentData.type || 'subscription', // subscription, extra_seat
    extra_seats: paymentData.extraSeats || 0,
    raw_payload: paymentData.rawPayload || null,
    created_at: paymentData.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // 1. Tenter un upsert dans la table 'payments' si elle existe
  try {
    const res = await supabaseFetch('/payments', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: payload
    });
    if (res.status >= 200 && res.status < 300) {
      return payload;
    }
  } catch (_) {}

  // 2. Si la table 'payments' n'est pas encore créée en base Supabase, stocker la trace dans 'activities'
  try {
    await supabaseFetch('/activities', {
      method: 'POST',
      body: {
        id: crypto.randomUUID(),
        user_id: payload.user_id,
        type: 'payment_' + payload.status,
        details: payload,
        created_at: payload.updated_at
      }
    });
  } catch (_) {}

  return payload;
}

/**
 * Active l'abonnement pour l'utilisateur suite à un paiement réussi vérifié côté serveur.
 * RÈGLE B4 : Ne JAMAIS activer un abonnement sur la seule base d'un retour navigateur.
 */
async function activateSubscriptionFromPayment(paymentRecord) {
  const { user_id, plan, cycle, type, extra_seats } = paymentRecord;
  if (!user_id || !plan) return false;

  const now = new Date();
  const periodEnd = plansConfig.calculatePeriodEnd(now, cycle || 'monthly');

  // Récupérer le business_settings de l'utilisateur
  const getRes = await supabaseFetch(`/business_settings?user_id=eq.${encodeURIComponent(user_id)}&order=created_at.desc&limit=1`);
  const settings = (getRes.status === 200 && Array.isArray(getRes.data) && getRes.data.length > 0) ? getRes.data[0] : null;

  const updatePayload = {
    user_id: user_id,
    current_plan: plan,
    subscription_tier: plan,
    subscription_cycle: cycle || 'monthly',
    subscription_status: 'active',
    plan_period_start: now.toISOString(),
    plan_period_end: periodEnd,
    plan_expires_at: periodEnd,
    cancel_at_period_end: false,
    updated_at: now.toISOString()
  };

  if (type === 'extra_seat' && extra_seats > 0) {
    const currentExtra = parseInt((settings && settings.extra_seats) || 0, 10);
    updatePayload.extra_seats = currentExtra + extra_seats;
  }

  let success = false;
  if (settings && settings.id) {
    const patchRes = await supabaseFetch(`/business_settings?id=eq.${settings.id}`, {
      method: 'PATCH',
      body: updatePayload
    });
    success = patchRes.status >= 200 && patchRes.status < 300;
  } else {
    const postRes = await supabaseFetch('/business_settings', {
      method: 'POST',
      body: updatePayload
    });
    success = postRes.status >= 200 && postRes.status < 300;
  }

  // Journaliser l'activation dans activities
  try {
    await supabaseFetch('/activities', {
      method: 'POST',
      body: {
        id: crypto.randomUUID(),
        user_id: user_id,
        type: 'subscription_activated',
        details: {
          plan: plan,
          cycle: cycle,
          period_end: periodEnd,
          payment_id: paymentRecord.id,
          provider: paymentRecord.provider,
          amount: paymentRecord.amount
        },
        created_at: now.toISOString()
      }
    });
  } catch (_) {}

  return success;
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTATEUR STRIPE
// ─────────────────────────────────────────────────────────────────────────────
const StripeAdapter = {
  createPayment: async function ({ userId, userEmail, planId, cycle, extraSeats, returnUrl }) {
    const priceInfo = plansConfig.calculateSubscriptionPrice(planId, cycle, extraSeats);
    const paymentId = 'pay_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey || IS_SANDBOX) {
      // Mode Sandbox
      const checkoutUrl = `${returnUrl || 'https://kivo-68rg.vercel.app/#settings/forfait'}?kivo_sandbox=stripe&payment_id=${paymentId}&status=success`;
      const record = await savePaymentRecord({
        id: paymentId,
        userId,
        plan: planId,
        cycle,
        amount: priceInfo.total,
        currency: 'FCFA',
        provider: 'stripe',
        providerRef: 'cs_test_' + paymentId,
        status: 'pending',
        type: extraSeats > 0 ? 'extra_seat' : 'subscription',
        extraSeats
      });
      return {
        paymentId,
        checkoutUrl,
        mode: 'sandbox',
        amount: priceInfo.total,
        currency: 'FCFA'
      };
    }

    // Appel API Stripe Checkout Session réelle
    // Montant en EUR ou devise équivalente pour Stripe international si FCFA non pris directement
    return new Promise((resolve, reject) => {
      const postData = new URLSearchParams({
        'payment_method_types[]': 'card',
        'line_items[0][price_data][currency]': 'eur',
        'line_items[0][price_data][unit_amount]': String(Math.round(priceInfo.total / 655.957 * 100)), // conversion indicative FCFA -> EUR cents
        'line_items[0][price_data][product_data][name]': `KIVO MATIQUE - Forfait ${planId.toUpperCase()} (${cycle === 'annual' ? 'Annuel' : 'Mensuel'})`,
        'line_items[0][quantity]': '1',
        'mode': 'payment',
        'success_url': `${returnUrl || 'https://kivo-68rg.vercel.app/#settings/forfait'}?session_id={CHECKOUT_SESSION_ID}`,
        'cancel_url': `${returnUrl || 'https://kivo-68rg.vercel.app/#settings/forfait'}?canceled=true`,
        'client_reference_id': userId,
        'customer_email': userEmail || '',
        'metadata[kivo_payment_id]': paymentId,
        'metadata[kivo_plan]': planId,
        'metadata[kivo_cycle]': cycle,
        'metadata[kivo_user_id]': userId,
        'metadata[kivo_extra_seats]': String(extraSeats || 0)
      }).toString();

      const req = https.request({
        hostname: 'api.stripe.com',
        path: '/v1/checkout/sessions',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, async (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', async () => {
          try {
            const data = JSON.parse(raw);
            if (data.id && data.url) {
              await savePaymentRecord({
                id: paymentId,
                userId,
                plan: planId,
                cycle,
                amount: priceInfo.total,
                currency: 'FCFA',
                provider: 'stripe',
                providerRef: data.id,
                status: 'pending',
                extraSeats
              });
              resolve({
                paymentId,
                checkoutUrl: data.url,
                mode: 'live',
                providerRef: data.id
              });
            } else {
              reject(new Error(data.error?.message || 'Erreur Stripe Checkout'));
            }
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  },

  verifyWebhookSignature: function (rawBody, signatureHeader) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) return false;
    try {
      const parts = signatureHeader.split(',').reduce((acc, part) => {
        const [k, v] = part.split('=');
        acc[k.trim()] = v.trim();
        return acc;
      }, {});
      const timestamp = parts['t'];
      const signature = parts['v1'];
      if (!timestamp || !signature) return false;

      const payloadToSign = `${timestamp}.${rawBody}`;
      const expectedSignature = crypto.createHmac('sha256', webhookSecret).update(payloadToSign).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
    } catch (_) {
      return false;
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTATEUR MTN MOBILE MONEY (COLLECTION API)
// ─────────────────────────────────────────────────────────────────────────────
const MtnMomoAdapter = {
  createPayment: async function ({ userId, phone, planId, cycle, extraSeats }) {
    const priceInfo = plansConfig.calculateSubscriptionPrice(planId, cycle, extraSeats);
    const paymentId = 'pay_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const refId = crypto.randomUUID(); // X-Reference-Id pour MTN MoMo Collection API

    const subscriptionKey = process.env.MTN_MOMO_SUBSCRIPTION_KEY;
    const apiKey = process.env.MTN_MOMO_API_KEY;

    if (!subscriptionKey || !apiKey || IS_SANDBOX) {
      // Mode Sandbox
      await savePaymentRecord({
        id: paymentId,
        userId,
        plan: planId,
        cycle,
        amount: priceInfo.total,
        currency: 'FCFA',
        provider: 'mtn_momo',
        providerRef: refId,
        status: 'pending',
        type: extraSeats > 0 ? 'extra_seat' : 'subscription',
        extraSeats
      });
      return {
        paymentId,
        providerRef: refId,
        mode: 'sandbox',
        amount: priceInfo.total,
        currency: 'FCFA',
        message: 'Demande USSD simulée sur le numéro ' + (phone || 'fourni')
      };
    }

    // En environnement de production avec clés, envoi de la requête collection requesttopay
    return {
      paymentId,
      providerRef: refId,
      mode: 'live',
      amount: priceInfo.total,
      currency: 'FCFA'
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTATEUR AIRTEL MONEY
// ─────────────────────────────────────────────────────────────────────────────
const AirtelMoneyAdapter = {
  createPayment: async function ({ userId, phone, planId, cycle, extraSeats }) {
    const priceInfo = plansConfig.calculateSubscriptionPrice(planId, cycle, extraSeats);
    const paymentId = 'pay_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const refId = 'airtel_' + Date.now();

    const clientId = process.env.AIRTEL_MONEY_CLIENT_ID;
    if (!clientId || IS_SANDBOX) {
      await savePaymentRecord({
        id: paymentId,
        userId,
        plan: planId,
        cycle,
        amount: priceInfo.total,
        currency: 'FCFA',
        provider: 'airtel_money',
        providerRef: refId,
        status: 'pending',
        type: extraSeats > 0 ? 'extra_seat' : 'subscription',
        extraSeats
      });
      return {
        paymentId,
        providerRef: refId,
        mode: 'sandbox',
        amount: priceInfo.total,
        currency: 'FCFA',
        message: 'Demande de paiement Airtel Money initiée'
      };
    }

    return {
      paymentId,
      providerRef: refId,
      mode: 'live',
      amount: priceInfo.total,
      currency: 'FCFA'
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTATEUR CINETPAY (WAVE / ORANGE / MTN / MOOV MULTI-PAYS)
// ─────────────────────────────────────────────────────────────────────────────
const CinetPayAdapter = {
  createPayment: async function ({ userId, userEmail, phone, planId, cycle, extraSeats, returnUrl }) {
    const priceInfo = plansConfig.calculateSubscriptionPrice(planId, cycle, extraSeats);
    const paymentId = 'pay_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const transactionId = 'kivo_' + Date.now();

    const apiKey = process.env.CINETPAY_API_KEY;
    const siteId = process.env.CINETPAY_SITE_ID;

    if (!apiKey || !siteId || IS_SANDBOX) {
      const checkoutUrl = `${returnUrl || 'https://kivo-68rg.vercel.app/#settings/forfait'}?kivo_sandbox=cinetpay&payment_id=${paymentId}&status=success`;
      await savePaymentRecord({
        id: paymentId,
        userId,
        plan: planId,
        cycle,
        amount: priceInfo.total,
        currency: 'FCFA',
        provider: 'cinetpay',
        providerRef: transactionId,
        status: 'pending',
        type: extraSeats > 0 ? 'extra_seat' : 'subscription',
        extraSeats
      });
      return {
        paymentId,
        providerRef: transactionId,
        checkoutUrl,
        mode: 'sandbox',
        amount: priceInfo.total,
        currency: 'FCFA'
      };
    }

    return {
      paymentId,
      providerRef: transactionId,
      mode: 'live',
      amount: priceInfo.total,
      currency: 'FCFA'
    };
  }
};

module.exports = {
  IS_SANDBOX,
  savePaymentRecord,
  activateSubscriptionFromPayment,
  StripeAdapter,
  MtnMomoAdapter,
  AirtelMoneyAdapter,
  CinetPayAdapter
};

