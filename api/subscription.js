/**
 * KIVO MATIQUE — API Abonnement (/api/subscription)
 * Lecture seule du forfait actif depuis la base de données.
 */

const { authenticateUser, supabaseFetch } = require('./_lib/supabase');
const { getUserSubscription, countMonthlyDocuments, countClients, countTeamMembers } = require('./_lib/quota');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée. Lecture seule.' });
  }

  const auth = await authenticateUser(req);
  if (!auth || !auth.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  const userId = auth.user.id;

  const sub = await getUserSubscription(userId);
  const monthlyDocs = await countMonthlyDocuments(userId);
  const clientsCount = await countClients(userId);
  const membersCount = await countTeamMembers(userId);

  let paymentsHistory = [];
  try {
    const payRes = await supabaseFetch(
      `/subscription_payments?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=20`
    );
    if (payRes.status === 200 && Array.isArray(payRes.data)) {
      paymentsHistory = payRes.data;
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
    paymentsHistory
  });
};
