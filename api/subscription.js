/**
 * KIVO MATIQUE — API Abonnement (/api/subscription)
 * Lecture de l'abonnement actif, dates, statut, historique et annulation fin de période.
 */

const { authenticateUser, supabaseFetch } = require('./_lib/supabase');
const { getUserSubscription, countMonthlyDocuments, countClients, countTeamMembers } = require('./_lib/quota');
const plansConfig = require('../js/plans.config');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await authenticateUser(req);
  if (!auth || !auth.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  const userId = auth.user.id;

  // ── GET : Détail complet de l'abonnement ─────────────────────────────────
  if (req.method === 'GET') {
    const sub = await getUserSubscription(userId);
    const monthlyDocs = await countMonthlyDocuments(userId);
    const clientsCount = await countClients(userId);
    const membersCount = await countTeamMembers(userId);

    // Déterminer le pays de l'utilisateur pour filtrer les passerelles
    let userCountry = 'CG';
    try {
      const bRes = await supabaseFetch(`/business_settings?user_id=eq.${encodeURIComponent(userId)}&select=country`);
      if (bRes.status === 200 && Array.isArray(bRes.data) && bRes.data.length > 0) {
        userCountry = bRes.data[0].country || 'CG';
      }
    } catch (_) {}

    const gateways = plansConfig.getGatewaysForCountry(userCountry);

    // Historique des paiements depuis activities ou table payments
    let paymentsHistory = [];
    try {
      const actRes = await supabaseFetch(
        `/activities?user_id=eq.${encodeURIComponent(userId)}&type=like.payment_*&order=created_at.desc&limit=20`
      );
      if (actRes.status === 200 && Array.isArray(actRes.data)) {
        paymentsHistory = actRes.data.map(a => ({
          id: a.id,
          date: a.created_at,
          type: a.type,
          details: a.details
        }));
      }
    } catch (_) {}

    return res.status(200).json({
      plan: sub.planDef.id,
      planName: sub.planDef.name,
      planCode: sub.planDef.code,
      cycle: sub.cycle,
      status: sub.status,
      isExpired: sub.isExpired,
      isPastDue: sub.isPastDue,
      isInGracePeriod: sub.isInGracePeriod,
      graceDaysLeft: sub.graceDaysLeft,
      periodStart: sub.periodStart,
      periodEnd: sub.periodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      extraSeats: sub.extraSeats,
      totalSeats: sub.planDef.id === 'business' ? (5 + sub.extraSeats) : 1,
      currentSeats: membersCount,
      usage: {
        documentsThisMonth: monthlyDocs,
        documentsLimit: sub.planDef.limits.docsPerMonth,
        clientsCount: clientsCount,
        clientsLimit: sub.planDef.limits.maxClients
      },
      availableGateways: gateways,
      paymentsHistory,
      sandbox: (process.env.KIVO_PAYMENT_SANDBOX || 'true').toLowerCase() === 'true'
    });
  }

  // ── POST : Actions (annulation fin de période ou downgrade) ─────────────
  if (req.method === 'POST') {
    const { action } = req.body || {};

    if (action === 'cancel_at_period_end') {
      const sub = await getUserSubscription(userId);
      if (!sub.settingsId) {
        return res.status(400).json({ error: 'Aucun abonnement payant actif à annuler.' });
      }

      await supabaseFetch(`/business_settings?id=eq.${sub.settingsId}`, {
        method: 'PATCH',
        body: {
          cancel_at_period_end: true,
          updated_at: new Date().toISOString()
        }
      });

      return res.status(200).json({
        success: true,
        message: "Votre abonnement sera résilié à la fin de la période en cours. Vous conserverez vos accès jusqu'à cette date.",
        periodEnd: sub.periodEnd
      });
    }

    return res.status(400).json({ error: 'Action non reconnue' });
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
};
