/**
 * KIVO MATIQUE — Gestion des Quotas & Cycle de Vie Serveur
 */

const { supabaseFetch } = require('./supabase');
const plansConfig = require('../../js/plans.config');

/**
 * Récupère les informations d'abonnement actives pour un utilisateur
 */
async function getUserSubscription(userId) {
  // 1. Lire business_settings pour cet utilisateur
  const res = await supabaseFetch(`/business_settings?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=1`);
  const settings = (res.status === 200 && Array.isArray(res.data) && res.data.length > 0) ? res.data[0] : null;

  const rawPlan = (settings && (settings.current_plan || settings.subscription_tier)) || 'gratuit';
  const planId = plansConfig.normalizePlanId(rawPlan);
  const cycle = (settings && settings.subscription_cycle) || 'monthly';
  const periodStart = (settings && settings.plan_period_start) || (settings && settings.created_at) || null;
  const periodEnd = (settings && (settings.plan_expires_at || settings.plan_period_end)) || null;
  const cancelAtPeriodEnd = !!(settings && settings.cancel_at_period_end);
  const extraSeats = parseInt((settings && settings.extra_seats) || 0, 10);

  const evaluation = plansConfig.evaluateSubscriptionStatus({
    plan: planId,
    period_end: periodEnd,
    status: (settings && settings.subscription_status) || 'active'
  });

  const effectivePlanDef = plansConfig.getPlan(evaluation.effectivePlan);

  return {
    rawPlan,
    planId: evaluation.effectivePlan,
    planDef: effectivePlanDef,
    cycle,
    status: evaluation.status,
    isExpired: evaluation.isExpired,
    isPastDue: evaluation.isPastDue,
    isInGracePeriod: evaluation.isInGracePeriod,
    graceDaysLeft: evaluation.graceDaysLeft || 0,
    periodStart,
    periodEnd,
    cancelAtPeriodEnd,
    extraSeats,
    settingsId: settings ? settings.id : null
  };
}

/**
 * Compte les documents créés par un utilisateur dans le mois calendaire en cours (fuseau Africa/Brazzaville).
 * RÈGLE B2 :
 * - Calendaire, fuseau Africa/Brazzaville
 * - Un document est compté dès qu'il est enregistré avec un nom de client non vide
 * - La suppression ne décrémente pas (nous vérifions à la fois la table documents ET les activités de création archivées)
 */
async function countMonthlyDocuments(userId) {
  const bounds = plansConfig.getCurrentBrazzavilleMonthBounds();

  // 1. Requête sur les documents actuels créés ce mois-ci avec un nom de client
  const docRes = await supabaseFetch(
    `/documents?user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(bounds.startIso)}&created_at=lt.${encodeURIComponent(bounds.endIso)}&select=id,client_name`
  );
  const liveDocs = (docRes.status === 200 && Array.isArray(docRes.data)) ? docRes.data : [];
  const validLiveDocs = liveDocs.filter(d => d.client_name && d.client_name.trim() !== '' && d.client_name !== 'Client sans nom');
  const liveDocIds = new Set(validLiveDocs.map(d => d.id));

  // 2. Requête sur les activités 'document_created' du mois pour cet utilisateur (permet de ne pas décrémenter à la suppression)
  let deletedCount = 0;
  try {
    const actRes = await supabaseFetch(
      `/activities?user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(bounds.startIso)}&created_at=lt.${encodeURIComponent(bounds.endIso)}&type=eq.document_created&select=id,details`
    );
    if (actRes.status === 200 && Array.isArray(actRes.data)) {
      // Pour chaque activité de création d'un document qui n'est plus dans liveDocIds
      actRes.data.forEach(act => {
        const docIdInAct = act.details && act.details.document_id;
        if (docIdInAct && !liveDocIds.has(docIdInAct)) {
          deletedCount++;
        }
      });
    }
  } catch (_) {}

  return liveDocIds.size + deletedCount;
}

/**
 * Compte les clients existants pour un utilisateur
 */
async function countClients(userId) {
  const res = await supabaseFetch(
    `/clients?user_id=eq.${encodeURIComponent(userId)}&select=id`
  );
  if (res.status === 200 && Array.isArray(res.data)) {
    return res.data.length;
  }
  return 0;
}

/**
 * Compte les membres d'équipe (1 propriétaire + membres actifs)
 */
async function countTeamMembers(userId) {
  const res = await supabaseFetch(
    `/team_members?user_id=eq.${encodeURIComponent(userId)}&status=neq.suspended&select=id`
  );
  const members = (res.status === 200 && Array.isArray(res.data)) ? res.data.length : 0;
  return 1 + members; // 1 propriétaire + membres
}

/**
 * Vérifie l'éligibilité d'une création compte tenu du plan et des quotas
 */
async function checkQuota(userId, resourceType, payload = {}) {
  const sub = await getUserSubscription(userId);
  const plan = sub.planDef;

  // 1. Quota de documents par mois
  if (resourceType === 'document') {
    const maxDocs = plan.limits.docsPerMonth;
    if (maxDocs !== Infinity) {
      const current = await countMonthlyDocuments(userId);
      if (current >= maxDocs) {
        return {
          allowed: false,
          error: {
            code: 'PLAN_LIMIT_REACHED',
            limit: maxDocs,
            current: current,
            plan: plan.id,
            resource: 'document',
            message: `Vous avez atteint la limite de ${maxDocs} documents par mois du forfait ${plan.name}. Passez au forfait Pro pour créer des documents en illimité.`
          }
        };
      }
    }
    return { allowed: true, plan, subscription: sub };
  }

  // 2. Quota de clients
  if (resourceType === 'client') {
    const maxClients = plan.limits.maxClients;
    if (maxClients !== Infinity) {
      const current = await countClients(userId);
      if (current >= maxClients) {
        return {
          allowed: false,
          error: {
            code: 'PLAN_LIMIT_REACHED',
            limit: maxClients,
            current: current,
            plan: plan.id,
            resource: 'client',
            message: `Vous avez atteint la limite de ${maxClients} clients du forfait ${plan.name}. Passez au forfait Pro pour une gestion illimitée de clients.`
          }
        };
      }
    }
    return { allowed: true, plan, subscription: sub };
  }

  // 3. Quota d'invitation d'équipe / sièges
  if (resourceType === 'member') {
    if (!plan.limits.team) {
      return {
        allowed: false,
        error: {
          code: 'PLAN_LIMIT_REACHED',
          limit: 1,
          current: 1,
          plan: plan.id,
          resource: 'member',
          message: `L'espace équipe et la collaboration multi-utilisateurs sont réservés au forfait Business.`
        }
      };
    }

    const totalSeats = 5 + (sub.extraSeats || 0);
    const current = await countTeamMembers(userId);
    if (current >= totalSeats) {
      return {
        allowed: false,
        error: {
          code: 'PLAN_LIMIT_REACHED',
          limit: totalSeats,
          current: current,
          plan: plan.id,
          resource: 'member',
          message: `Tous vos sièges sont occupés (${current} / ${totalSeats}). Ajoutez un siège supplémentaire (+1 500 FCFA/mois) pour inviter ce collaborateur.`
        }
      };
    }
    return { allowed: true, plan, subscription: sub, totalSeats, currentSeats: current };
  }

  return { allowed: true, plan, subscription: sub };
}

module.exports = {
  getUserSubscription,
  countMonthlyDocuments,
  countClients,
  countTeamMembers,
  checkQuota
};

