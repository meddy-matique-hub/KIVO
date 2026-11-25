/**
 * KIVO MATIQUE — Client SasPay Serveur (https://api.saspay.me/api/v1)
 * Aucun secret dans les logs ni les réponses. Montants en chaînes décimales.
 */

const crypto = require('crypto');

const SASPAY_BASE_URL = 'https://api.saspay.me/api/v1';
const REQUEST_TIMEOUT_MS = 10000;

const SERVER_PRICES = {
  pro: {
    monthly: '3990.00',
    annual: '38280.00',
    label: 'Pro'
  },
  business: {
    monthly: '9990.00',
    annual: '95880.00',
    label: 'Business'
  }
};

function getServerPrice(planId, cycle) {
  const p = String(planId || '').toLowerCase().trim();
  const c = cycle === 'annual' ? 'annual' : (cycle === 'monthly' ? 'monthly' : null);
  if (!SERVER_PRICES[p] || !c) return null;
  return {
    planId: p,
    cycle: c,
    amountStr: SERVER_PRICES[p][c],
    amountNum: Number(SERVER_PRICES[p][c]),
    currency: 'XAF',
    label: SERVER_PRICES[p].label
  };
}

function isCountryCongo(country) {
  const c = String(country || '').trim().toLowerCase();
  return c === 'cg' || c === 'congo' || c === 'congo-brazzaville' || c === 'république du congo' || c === 'republique du congo';
}

function isEmailInRollout(email) {
  const rollout = (process.env.SASPAY_ROLLOUT || '').trim();
  if (!rollout) return false;
  if (rollout === '*') return true;
  const userEmail = String(email || '').trim().toLowerCase();
  if (!userEmail) return false;
  const allowed = rollout.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(userEmail);
}

function isUserEnabledForSasPay(email, country) {
  return isEmailInRollout(email) && isCountryCongo(country);
}

async function saspayRequest(method, path, body = null) {
  const apiKey = process.env.SASPAY_API_KEY;
  if (!apiKey) {
    throw new Error('SASPAY_API_KEY_MISSING');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json'
    };
    const fetchOpts = {
      method,
      headers,
      signal: controller.signal
    };
    if (body !== null) {
      headers['Content-Type'] = 'application/json';
      fetchOpts.body = JSON.stringify(body);
    }

    const res = await fetch(`${SASPAY_BASE_URL}${path}`, fetchOpts);
    const text = await res.text();
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch (_) {
        parsed = null;
      }
    }

    if (!res.ok) {
      const err = new Error(`SASPAY_HTTP_${res.status}`);
      err.status = res.status;
      throw err;
    }

    return (parsed && parsed.data !== undefined) ? parsed.data : parsed;
  } finally {
    clearTimeout(timer);
  }
}

async function createCheckoutSession(payload) {
  return saspayRequest('POST', '/checkout-sessions/', payload);
}

async function getCheckoutSessionStatus(sessionId) {
  return saspayRequest('GET', `/checkout-sessions/${encodeURIComponent(sessionId)}/status/`);
}

async function verifyPayment(paymentId) {
  return saspayRequest('GET', `/payments/${encodeURIComponent(paymentId)}/verify/`);
}

function verifyWebhookSignature(rawBodyBuffer, signatureHeader, timestampHeader) {
  const secret = process.env.SASPAY_WEBHOOK_SECRET;
  if (!secret || !signatureHeader || !timestampHeader || !rawBodyBuffer) {
    return false;
  }

  const tsNum = Number(timestampHeader);
  if (!Number.isFinite(tsNum)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > 300) {
    return false;
  }

  const sig = String(signatureHeader).trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sig)) {
    return false;
  }

  const prefix = Buffer.from(`${timestampHeader}.`, 'utf8');
  const bodyBuf = Buffer.isBuffer(rawBodyBuffer) ? rawBodyBuffer : Buffer.from(String(rawBodyBuffer), 'utf8');
  const signedPayload = Buffer.concat([prefix, bodyBuf]);
  const expectedHex = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex').toLowerCase();

  const sigBuf = Buffer.from(sig, 'hex');
  const expBuf = Buffer.from(expectedHex, 'hex');
  if (sigBuf.length !== expBuf.length) return false;

  return crypto.timingSafeEqual(sigBuf, expBuf);
}

/**
 * Vérifie un paiement auprès de SasPay et appelle fulfill_subscription_payment si SUCCESS.
 * Retourne { outcome: 'SUCCESS'|'PENDING'|'FAILED', periodEnd?: string }
 */
async function verifyAndFulfillPayment(paymentRow, supabaseFetch) {
  if (!paymentRow) return { outcome: 'FAILED' };

  const currentStatus = String(paymentRow.status || '').toLowerCase();
  if (currentStatus === 'succeeded' || currentStatus === 'success') {
    return { outcome: 'SUCCESS' };
  }
  if (currentStatus === 'failed') {
    return { outcome: 'FAILED' };
  }

  const sessionId = paymentRow.provider_session_id;
  if (!sessionId) {
    return { outcome: 'PENDING' };
  }

  let sessionData = null;
  try {
    sessionData = await getCheckoutSessionStatus(sessionId);
  } catch (err) {
    if (err && (err.status === 404 || err.status === 410)) {
      return { outcome: 'FAILED' };
    }
    return { outcome: 'PENDING' };
  }

  let statusRaw = String(sessionData?.status || '').toUpperCase();
  let providerPaymentId = sessionData?.payment_id || sessionData?.payment?.id || sessionData?.transaction_id || null;
  let charged = sessionData?.charged ?? null;
  let netAmount = sessionData?.net_amount ?? null;
  let remoteAmount = sessionData?.amount ?? null;
  let remoteCurrency = sessionData?.currency ?? null;

  if (providerPaymentId) {
    try {
      const verifyData = await verifyPayment(providerPaymentId);
      if (verifyData) {
        if (verifyData.status) statusRaw = String(verifyData.status).toUpperCase();
        if (verifyData.charged !== undefined) charged = verifyData.charged;
        if (verifyData.net_amount !== undefined) netAmount = verifyData.net_amount;
        if (verifyData.amount !== undefined) remoteAmount = verifyData.amount;
        if (verifyData.currency !== undefined) remoteCurrency = verifyData.currency;
      }
    } catch (_) {
      // Conserver les données de session si verify échoue temporairement
    }
  }

  if (statusRaw === 'SUCCESS') {
    const expectedAmount = Number(paymentRow.amount);
    if (remoteAmount !== null && remoteAmount !== undefined && Number(remoteAmount) !== expectedAmount) {
      return { outcome: 'FAILED' };
    }
    if (remoteCurrency && String(remoteCurrency).toUpperCase() !== String(paymentRow.currency || 'XAF').toUpperCase()) {
      return { outcome: 'FAILED' };
    }

    const rpcRes = await supabaseFetch('/rpc/fulfill_subscription_payment', {
      method: 'POST',
      body: {
        p_payment_id: paymentRow.id,
        p_provider_payment_id: providerPaymentId ? String(providerPaymentId) : String(sessionId),
        p_charged: charged !== null && charged !== undefined ? String(charged) : String(paymentRow.amount),
        p_net: netAmount !== null && netAmount !== undefined ? String(netAmount) : String(paymentRow.amount)
      }
    });

    if (rpcRes.status >= 200 && rpcRes.status < 300) {
      return { outcome: 'SUCCESS' };
    }
    return { outcome: 'PENDING' };
  }

  if (statusRaw === 'FAILED' || statusRaw === 'CANCELLED' || statusRaw === 'EXPIRED') {
    await supabaseFetch(`/subscription_payments?id=eq.${encodeURIComponent(paymentRow.id)}&status=eq.pending`, {
      method: 'PATCH',
      body: { status: 'failed', updated_at: new Date().toISOString() }
    });
    return { outcome: 'FAILED' };
  }

  return { outcome: 'PENDING' };
}

module.exports = {
  SERVER_PRICES,
  getServerPrice,
  isCountryCongo,
  isEmailInRollout,
  isUserEnabledForSasPay,
  createCheckoutSession,
  getCheckoutSessionStatus,
  verifyPayment,
  verifyWebhookSignature,
  verifyAndFulfillPayment
};

