/**
 * KIVO MATIQUE — API Initialisation de Paiement (/api/payments/create)
 * Utilise les adaptateurs Stripe, MTN MoMo, Airtel Money, CinetPay.
 */

const { authenticateUser } = require('../_lib/supabase');
const { StripeAdapter, MtnMomoAdapter, AirtelMoneyAdapter, CinetPayAdapter } = require('../_lib/payments');
const plansConfig = require('../../js/plans.config');

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
  const userEmail = auth.user.email;

  const { planId, cycle, provider, phone, extraSeats, returnUrl } = req.body || {};
  const normPlan = plansConfig.normalizePlanId(planId);
  const normCycle = (cycle === 'annual') ? 'annual' : 'monthly';

  if (!provider) {
    return res.status(400).json({ error: 'Passerelle de paiement non spécifiée' });
  }

  try {
    let result = null;
    const params = {
      userId,
      userEmail,
      planId: normPlan,
      cycle: normCycle,
      phone,
      extraSeats: parseInt(extraSeats || 0, 10),
      returnUrl
    };

    switch (provider) {
      case 'stripe':
        result = await StripeAdapter.createPayment(params);
        break;
      case 'mtn_momo':
        result = await MtnMomoAdapter.createPayment(params);
        break;
      case 'airtel_money':
        result = await AirtelMoneyAdapter.createPayment(params);
        break;
      case 'cinetpay':
        result = await CinetPayAdapter.createPayment(params);
        break;
      default:
        return res.status(400).json({ error: `Passerelle ${provider} non supportée.` });
    }

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('[API Payments Create Error]:', err);
    return res.status(500).json({
      error: err.message || "Erreur lors de l'initialisation du paiement."
    });
  }
};

