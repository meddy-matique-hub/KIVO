/**
 * KIVO MATIQUE — API Initialisation de Paiement SasPay (/api/payments/create)
 */

const crypto = require('crypto');
const { authenticateUser, supabaseFetch } = require('../_lib/supabase');
const { getUserSubscription } = require('../_lib/quota');
const { getServerPrice, isUserEnabledForSasPay, createCheckoutSession } = require('../_lib/saspay');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const auth = await authenticateUser(req);
  if (!auth || !auth.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  const userId = auth.user.id;
  const userEmail = auth.user.email || '';

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Configuration serveur incomplète.' });
  }

  const { planId, cycle } = req.body || {};
  const price = getServerPrice(planId, cycle);
  if (!price) {
    return res.status(400).json({ error: 'Forfait ou période invalide.' });
  }

  // Lire pays et nom depuis business_settings
  let country = '';
  let customerName = userEmail.split('@')[0] || 'Client KIVO';
  try {
    const bRes = await supabaseFetch(
      `/business_settings?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=1&select=country,owner,company_name`
    );
    if (bRes.status === 200 && Array.isArray(bRes.data) && bRes.data.length > 0) {
      country = bRes.data[0].country || '';
      customerName = bRes.data[0].owner || bRes.data[0].company_name || customerName;
    }
  } catch (_) {}

  if (!isUserEnabledForSasPay(userEmail, country)) {
    return res.status(403).json({ error: 'Le paiement en ligne n\'est pas encore disponible pour votre compte.' });
  }

  // Refuser si le compte a déjà un Business actif et demande Pro
  try {
    const sub = await getUserSubscription(userId);
    if (sub.planId === 'business' && !sub.isExpired && price.planId === 'pro') {
      return res.status(400).json({ error: 'Vous disposez déjà d\'un forfait Business actif.' });
    }
  } catch (_) {}

  // Réutiliser un paiement pending de moins de 10 minutes pour le même forfait et cycle
  try {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const existingRes = await supabaseFetch(
      `/subscription_payments?user_id=eq.${encodeURIComponent(userId)}&plan=eq.${encodeURIComponent(price.planId)}&cycle=eq.${encodeURIComponent(price.cycle)}&status=eq.pending&created_at=gte.${encodeURIComponent(tenMinAgo)}&order=created_at.desc&limit=1&select=id,checkout_url`
    );
    if (existingRes.status === 200 && Array.isArray(existingRes.data) && existingRes.data.length > 0) {
      const existing = existingRes.data[0];
      if (existing.checkout_url) {
        return res.status(200).json({ checkoutUrl: existing.checkout_url, ref: existing.id });
      }
    }
  } catch (_) {}

  const paymentId = crypto.randomUUID();
  const appUrl = (process.env.APP_URL || 'https://kivo-68rg.vercel.app').replace(/\/+$/, '');
  const feeMode = process.env.SASPAY_FEE_MODE || 'DEDUCTED';

  // Insérer la ligne pending avant d'appeler SasPay
  const insertRes = await supabaseFetch('/subscription_payments', {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: {
      id: paymentId,
      user_id: userId,
      plan: price.planId,
      cycle: price.cycle,
      amount: price.amountNum,
      currency: price.currency,
      status: 'pending'
    }
  });

  if (insertRes.status < 200 || insertRes.status >= 300) {
    return res.status(500).json({ error: 'Impossible d\'initier le paiement.' });
  }

  try {
    const cycleLabel = price.cycle === 'annual' ? 'Annuel' : 'Mensuel';
    const session = await createCheckoutSession({
      amount: price.amountStr,
      currency: price.currency,
      country: 'CG',
      customer_email: userEmail,
      customer_name: customerName,
      description: `KIVO MATIQUE — Forfait ${price.label} (${cycleLabel})`,
      return_url: `${appUrl}/?ref=${encodeURIComponent(paymentId)}#subscription-return`,
      metadata: {
        payment_ref: paymentId,
        user_id: userId,
        plan: price.planId,
        cycle: price.cycle
      },
      fee_charge_mode: feeMode
    });

    const checkoutUrl = session?.checkout_url;
    const providerSessionId = session?.id;

    if (!checkoutUrl || !providerSessionId) {
      throw new Error('INVALID_SASPAY_RESPONSE');
    }

    await supabaseFetch(`/subscription_payments?id=eq.${encodeURIComponent(paymentId)}`, {
      method: 'PATCH',
      body: {
        provider_session_id: String(providerSessionId),
        checkout_url: String(checkoutUrl),
        updated_at: new Date().toISOString()
      }
    });

    return res.status(200).json({ checkoutUrl, ref: paymentId });
  } catch (err) {
    console.error('[SasPay Create] Échec initialisation:', err.message);
    await supabaseFetch(`/subscription_payments?id=eq.${encodeURIComponent(paymentId)}&status=eq.pending`, {
      method: 'PATCH',
      body: { status: 'failed', updated_at: new Date().toISOString() }
    }).catch(() => {});
    return res.status(502).json({ error: 'Le service de paiement est momentanément indisponible. Veuillez réessayer.' });
  }
};
