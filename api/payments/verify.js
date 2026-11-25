/**
 * KIVO MATIQUE — API Vérification Paiement SasPay (/api/payments/verify)
 * Interroge SasPay puis appelle fulfill_subscription_payment côté base.
 */

const { authenticateUser, supabaseFetch } = require('../_lib/supabase');
const { verifyAndFulfillPayment } = require('../_lib/saspay');

// Anti-spam en mémoire : 1 vérification SasPay max toutes les 3 secondes par paiement
const lastVerifyByPayment = new Map();

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const auth = await authenticateUser(req);
  if (!auth || !auth.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  const userId = auth.user.id;

  const { ref } = req.body || {};
  if (!ref || typeof ref !== 'string') {
    return res.status(400).json({ error: 'Référence de paiement manquante.' });
  }

  const pRes = await supabaseFetch(
    `/subscription_payments?id=eq.${encodeURIComponent(ref)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`
  );
  if (pRes.status !== 200 || !Array.isArray(pRes.data) || pRes.data.length === 0) {
    return res.status(404).json({ error: 'Paiement introuvable.' });
  }

  const payment = pRes.data[0];
  const currentStatus = String(payment.status || '').toLowerCase();

  if (currentStatus === 'succeeded' || currentStatus === 'success') {
    const bRes = await supabaseFetch(
      `/business_settings?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=1&select=plan_expires_at,plan_period_end`
    );
    const periodEnd = (bRes.status === 200 && Array.isArray(bRes.data) && bRes.data[0])
      ? (bRes.data[0].plan_expires_at || bRes.data[0].plan_period_end || null)
      : null;
    return res.status(200).json({ status: 'SUCCESS', periodEnd });
  }

  if (currentStatus === 'failed') {
    return res.status(200).json({ status: 'FAILED' });
  }

  // Limite 1 appel toutes les 3 secondes par paiement
  const now = Date.now();
  const lastCall = lastVerifyByPayment.get(payment.id) || 0;
  const dbUpdated = payment.updated_at ? Date.parse(payment.updated_at) : 0;
  if ((now - lastCall < 3000) || (dbUpdated && (now - dbUpdated < 3000))) {
    return res.status(200).json({ status: 'PENDING' });
  }
  lastVerifyByPayment.set(payment.id, now);

  const result = await verifyAndFulfillPayment(payment, supabaseFetch);

  if (result.outcome === 'SUCCESS') {
    const bRes = await supabaseFetch(
      `/business_settings?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=1&select=plan_expires_at,plan_period_end`
    );
    const periodEnd = (bRes.status === 200 && Array.isArray(bRes.data) && bRes.data[0])
      ? (bRes.data[0].plan_expires_at || bRes.data[0].plan_period_end || null)
      : null;
    return res.status(200).json({ status: 'SUCCESS', periodEnd });
  }

  return res.status(200).json({ status: result.outcome });
};
