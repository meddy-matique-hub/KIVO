/**
 * KIVO MATIQUE — Cron Job (/api/cron/check-subscriptions)
 * Tâche planifiée quotidienne pour la gestion du cycle de vie des abonnements :
 * - Détection des échéances
 * - Application de la période de grâce (3 jours, statut 'past_due')
 * - Rétrogradation au Forfait Gratuit à expiration
 * - Suspension des membres excédentaires en cas de rétrogradation Business -> Gratuit/Pro
 */

const { supabaseFetch } = require('../_lib/supabase');
const plansConfig = require('../../js/plans.config');

module.exports = async function handler(req, res) {
  // Sécurisation optionnelle par CRON_SECRET (Vercel Cron Header)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Non autorisé' });
    }
  }

  const now = new Date();
  console.log(`[Cron check-subscriptions] Exécution au ${now.toISOString()}`);

  let updatedCount = 0;
  let suspendedMembersCount = 0;

  try {
    // 1. Récupérer tous les business_settings ayant un plan payant
    const resSettings = await supabaseFetch(
      `/business_settings?current_plan=neq.gratuit&select=id,user_id,current_plan,plan_period_end,plan_expires_at,subscription_status`
    );

    const accounts = (resSettings.status === 200 && Array.isArray(resSettings.data)) ? resSettings.data : [];

    for (const acc of accounts) {
      const evaluation = plansConfig.evaluateSubscriptionStatus({
        plan: acc.current_plan,
        period_end: acc.plan_expires_at || acc.plan_period_end,
        status: acc.subscription_status
      });

      // Cas 1 : Dans la période de grâce (statut 'past_due')
      if (evaluation.isPastDue && acc.subscription_status !== 'past_due') {
        await supabaseFetch(`/business_settings?id=eq.${acc.id}`, {
          method: 'PATCH',
          body: {
            subscription_status: 'past_due',
            updated_at: now.toISOString()
          }
        });
        updatedCount++;
      }

      // Cas 2 : Période de grâce terminée -> Expiré -> Rétrogradation en 'gratuit'
      if (evaluation.isExpired && acc.current_plan !== 'gratuit') {
        await supabaseFetch(`/business_settings?id=eq.${acc.id}`, {
          method: 'PATCH',
          body: {
            current_plan: 'gratuit',
            subscription_tier: 'gratuit',
            subscription_status: 'expired',
            updated_at: now.toISOString()
          }
        });
        updatedCount++;

        // Si l'ancien plan était Business et qu'il y a des membres d'équipe :
        // SUSPENDRE les membres (sans les supprimer)
        if (acc.current_plan === 'business') {
          const memRes = await supabaseFetch(
            `/team_members?user_id=eq.${encodeURIComponent(acc.user_id)}&status=neq.suspended`
          );
          if (memRes.status === 200 && Array.isArray(memRes.data) && memRes.data.length > 0) {
            for (const m of memRes.data) {
              await supabaseFetch(`/team_members?id=eq.${m.id}`, {
                method: 'PATCH',
                body: {
                  status: 'suspended',
                  updated_at: now.toISOString()
                }
              });
              suspendedMembersCount++;
            }
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      processed: accounts.length,
      updated: updatedCount,
      suspendedMembers: suspendedMembersCount,
      timestamp: now.toISOString()
    });
  } catch (err) {
    console.error('[Cron check-subscriptions Error]:', err);
    return res.status(500).json({ error: err.message });
  }
};

