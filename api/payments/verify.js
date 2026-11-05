/**
 * KIVO MATIQUE — API Vérification Serveur de Paiement (/api/payments/verify)
 * Vérifie auprès de la passerelle ou du stockage sécurisé et active l'abonnement.
 */

const { authenticateUser, supabaseFetch } = require('../_lib/supabase');
const { IS_SANDBOX, activateSubscriptionFromPayment, savePaymentRecord } = require('../_lib/payments');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const auth = await authenticateUser(req);
  if (!auth || !auth.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  const userId = auth.user.id;

  const { paymentId, provider, providerRef } = req.body || {};
  if (!paymentId && !providerRef) {
    return res.status(400).json({ error: 'Identifiant de paiement manquant' });
  }

  // 1. Chercher l'enregistrement de paiement existant
  let paymentRecord = null;
  try {
    const filter = paymentId ? `id=eq.${encodeURIComponent(paymentId)}` : `provider_ref=eq.${encodeURIComponent(providerRef)}`;
    const r = await supabaseFetch(`/payments?${filter}&limit=1`);
    if (r.status === 200 && Array.isArray(r.data) && r.data.length > 0) {
      paymentRecord = r.data[0];
    }
  } catch (_) {}

  // 2. Si pas trouvé dans 'payments', chercher dans 'activities'
  if (!paymentRecord) {
    try {
      const act = await supabaseFetch(`/activities?user_id=eq.${encodeURIComponent(userId)}&type=eq.payment_pending&order=created_at.desc&limit=10`);
      if (act.status === 200 && Array.isArray(act.data)) {
        const found = act.data.find(a => (a.details && (a.details.id === paymentId || a.details.providerRef === providerRef)));
        if (found) paymentRecord = found.details;
      }
    } catch (_) {}
  }

  // Si toujours introuvable et mode Sandbox activé
  if (!paymentRecord && IS_SANDBOX) {
    paymentRecord = {
      id: paymentId || 'pay_sandbox',
      user_id: userId,
      plan: req.body.planId || 'pro',
      cycle: req.body.cycle || 'monthly',
      amount: req.body.amount || 3990,
      currency: 'FCFA',
      provider: provider || 'stripe',
      provider_ref: providerRef || 'sandbox_ref',
      status: 'pending'
    };
  }

  if (!paymentRecord) {
    return res.status(404).json({ error: 'Enregistrement de paiement introuvable.' });
  }

  // Vérification de sécurité : l'enregistrement doit appartenir à cet utilisateur
  if (paymentRecord.user_id !== userId) {
    return res.status(403).json({ error: 'Accès interdit.' });
  }

  // Si déjà réussi : renvoyer succès
  if (paymentRecord.status === 'succeeded') {
    return res.status(200).json({
      success: true,
      status: 'succeeded',
      message: 'Abonnement déjà actif.',
      plan: paymentRecord.plan
    });
  }

  // En mode Sandbox ou confirmation webhook :
  // En mode Sandbox, la vérification confirme la réussite
  if (IS_SANDBOX) {
    paymentRecord.status = 'succeeded';
    await savePaymentRecord(paymentRecord);
    await activateSubscriptionFromPayment(paymentRecord);
    return res.status(200).json({
      success: true,
      status: 'succeeded',
      mode: 'sandbox',
      message: 'Paiement sandbox validé côté serveur avec succès.',
      plan: paymentRecord.plan
    });
  }

  // En mode live, le statut dépend de la confirmation webhook
  return res.status(200).json({
    success: paymentRecord.status === 'succeeded',
    status: paymentRecord.status,
    message: paymentRecord.status === 'succeeded' ? 'Paiement confirmé.' : 'En attente de confirmation par la passerelle de paiement.'
  });
};

