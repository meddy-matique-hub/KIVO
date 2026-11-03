/**
 * KIVO MATIQUE — Webhook CinetPay (/api/webhooks/cinetpay)
 * Traitement des notifications Wave / Orange / MTN / Moov via CinetPay.
 */

const { savePaymentRecord, activateSubscriptionFromPayment } = require('../_lib/payments');
const { supabaseFetch } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body || {};
  const cpmTransId = body.cpm_trans_id;
  const cpmSiteId = body.cpm_site_id;

  if (!cpmTransId) {
    return res.status(400).json({ error: 'cpm_trans_id manquant' });
  }

  // Vérifier le site ID configuré si présent
  const expectedSiteId = process.env.CINETPAY_SITE_ID;
  if (expectedSiteId && String(cpmSiteId) !== String(expectedSiteId)) {
    return res.status(401).json({ error: 'Site ID invalide' });
  }

  // Idempotence : vérifier si transaction déjà traitée
  try {
    const existing = await supabaseFetch(`/activities?type=eq.payment_succeeded&select=details`);
    if (existing.status === 200 && Array.isArray(existing.data)) {
      const alreadyProcessed = existing.data.some(a => a.details && a.details.provider_ref === cpmTransId);
      if (alreadyProcessed) {
        return res.status(200).json({ received: true, idempotent: true });
      }
    }
  } catch (_) {}

  // En production, CinetPay recommande de ré-interroger leur API check pour confirmer le statut
  const paymentRecord = {
    id: 'pay_' + cpmTransId,
    userId: body.cpm_custom,
    plan: body.cpm_designation?.includes('BUSINESS') ? 'business' : 'pro',
    cycle: 'monthly',
    amount: parseInt(body.cpm_amount || 0, 10),
    currency: body.cpm_currency || 'XOF',
    provider: 'cinetpay',
    providerRef: cpmTransId,
    status: body.cpm_result === '00' ? 'succeeded' : 'failed',
    rawPayload: body
  };

  await savePaymentRecord(paymentRecord);

  if (paymentRecord.status === 'succeeded' && paymentRecord.userId) {
    await activateSubscriptionFromPayment(paymentRecord);
  }

  return res.status(200).json({ received: true });
};
