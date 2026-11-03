/**
 * KIVO MATIQUE — Source Unique de Vérité des Forfaits & Abonnements
 * Ce fichier est la référence unique pour les prix, limites, fonctionnalités et passerelles.
 * Compatible à la fois avec le navigateur (window.KivoPlans) et Node.js (module.exports).
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.KivoPlans = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Calcul du prix annuel documenté :
   * - Pro mensuel : 3 990 FCFA * 12 = 47 880 FCFA. Remise -20% = 38 304 FCFA -> arrondi à 100 FCFA = 38 300 FCFA.
   * - Business mensuel : 9 990 FCFA * 12 = 119 880 FCFA. Remise -20% = 95 904 FCFA -> arrondi à 100 FCFA = 95 900 FCFA.
   * - Siège supplémentaire Business : 1 500 FCFA / mois.
   * Tous les montants FCFA sont des entiers stricts (FCFA sans décimales).
   */
  const PLANS = {
    gratuit: {
      id: 'gratuit',
      name: 'Gratuit',
      code: 'FREE',
      tagline: 'Pour découvrir KIVO',
      description: '3 documents par mois, 3 clients, 1 utilisateur et modèles essentiels.',
      pricing: {
        currency: 'FCFA',
        monthly: 0,
        annual: 0,
        monthlyEquivalentAnnual: 0,
        discountPercent: 0
      },
      limits: {
        docsPerMonth: 3,
        maxClients: 3,
        maxUsers: 1,
        allowedTemplates: ['minimalist', 'corporate'],
        allTemplates: false,
        advancedStyle: false,
        fullStats: false,
        team: false,
        autosave: false,
        exportCsv: true,
        exportExcel: false,
        ai: 'soon',
        multiCurrency: 'soon',
        refunds: 'soon',
        api: 'soon',
        notificationsEmail: false
      }
    },
    pro: {
      id: 'pro',
      name: 'Pro',
      code: 'PRO',
      tagline: 'Pour les indépendants et petites entreprises',
      description: 'Documents et clients illimités, tous les modèles professionnels, statistiques complètes et export Excel.',
      pricing: {
        currency: 'FCFA',
        monthly: 3990,
        annual: 38300,
        monthlyEquivalentAnnual: 3192,
        discountPercent: 20
      },
      limits: {
        docsPerMonth: Infinity,
        maxClients: Infinity,
        maxUsers: 1,
        allowedTemplates: null, // Tous les modèles
        allTemplates: true,
        advancedStyle: true,
        fullStats: true,
        team: false,
        autosave: true,
        exportCsv: true,
        exportExcel: true,
        ai: 'soon',
        multiCurrency: 'soon',
        refunds: 'soon',
        api: 'soon',
        notificationsEmail: false
      }
    },
    business: {
      id: 'business',
      name: 'Business',
      code: 'BUSINESS',
      tagline: 'Pour les entreprises qui veulent automatiser leur facturation',
      description: 'Tout le forfait Pro + 5 sièges inclus, gestion d’équipe, rôles et collaboration multi-utilisateurs.',
      pricing: {
        currency: 'FCFA',
        monthly: 9990,
        annual: 95900,
        monthlyEquivalentAnnual: 7992,
        discountPercent: 20,
        extraSeatMonthly: 1500,
        extraSeatAnnual: 14400 // 1 500 * 12 * 0.8
      },
      limits: {
        docsPerMonth: Infinity,
        maxClients: Infinity,
        maxUsers: 5,
        allowedTemplates: null, // Tous les modèles
        allTemplates: true,
        advancedStyle: true,
        fullStats: true,
        team: true,
        autosave: true,
        exportCsv: true,
        exportExcel: true,
        ai: 'soon',
        multiCurrency: 'soon',
        refunds: 'soon',
        api: 'soon',
        notificationsEmail: 'soon'
      }
    }
  };

  /**
   * Couverture par pays des passerelles de paiement (Afrique & International)
   * N'affiche à l'utilisateur QUE les moyens réellement opérationnels dans son pays.
   */
  const PAYMENT_GATEWAYS = {
    stripe: {
      id: 'stripe',
      name: 'Carte Bancaire (Visa / Mastercard)',
      type: 'card',
      currencies: ['FCFA', 'EUR', 'USD', 'CAD', 'GBP', 'XOF', 'XAF'],
      countries: ['ALL'], // Disponible internationalement
      badge: 'International',
      icon: 'credit-card',
      description: 'Paiement sécurisé par carte bancaire avec Stripe'
    },
    mtn_momo: {
      id: 'mtn_momo',
      name: 'MTN Mobile Money',
      type: 'mobile_money',
      operator: 'MTN',
      currencies: ['XAF', 'XOF'],
      countries: ['CG', 'CM', 'CI', 'BJ', 'GH', 'UG'], // Congo, Cameroun, Côte d'Ivoire, Bénin, etc.
      badge: 'Afrique Centrale & Ouest',
      icon: 'phone',
      description: 'Paiement direct depuis votre compte MTN MoMo'
    },
    airtel_money: {
      id: 'airtel_money',
      name: 'Airtel Money',
      type: 'mobile_money',
      operator: 'Airtel',
      currencies: ['XAF'],
      countries: ['CG', 'GA', 'CD', 'TD'], // Congo, Gabon, RDC, Tchad
      badge: 'Afrique Centrale',
      icon: 'phone',
      description: 'Paiement direct depuis votre compte Airtel Money'
    },
    cinetpay: {
      id: 'cinetpay',
      name: 'Mobile Money (Wave / Orange / Moov / MTN)',
      type: 'aggregator',
      currencies: ['XOF', 'XAF', 'CDF', 'GNF'],
      countries: ['SN', 'CI', 'CM', 'ML', 'BF', 'TG', 'BJ', 'NE', 'CD'],
      badge: 'Wave / Orange / MTN',
      icon: 'smartphone',
      description: 'Agrégateur sécurisé multi-opérateurs'
    }
  };

  /**
   * Fuseau horaire officiel du projet (Règle KIVO)
   */
  const TIMEZONE = 'Africa/Brazzaville';

  /**
   * Jours de grâce après fin de période avant suspension/dégradation
   */
  const GRACE_PERIOD_DAYS = 3;

  /**
   * Normalise un identifiant de plan
   */
  function normalizePlanId(rawId) {
    if (!rawId) return 'gratuit';
    const s = String(rawId).toLowerCase().trim();
    if (s === 'free' || s === 'gratuit') return 'gratuit';
    if (s === 'pro') return 'pro';
    if (s === 'business') return 'business';
    return 'gratuit';
  }

  /**
   * Retourne la définition complète d'un plan
   */
  function getPlan(planId) {
    const id = normalizePlanId(planId);
    return PLANS[id] || PLANS.gratuit;
  }

  /**
   * Retourne les passerelles disponibles pour un code pays donné (ISO alpha-2, ex: 'CG', 'SN', 'CI')
   */
  function getGatewaysForCountry(countryCode) {
    const cc = (countryCode || 'CG').toUpperCase();
    return Object.values(PAYMENT_GATEWAYS).filter(gw => {
      if (gw.countries.includes('ALL')) return true;
      return gw.countries.includes(cc);
    });
  }

  /**
   * Calcule le prix d'un plan en fonction du cycle et du nombre de sièges (FCFA entier)
   */
  function calculateSubscriptionPrice(planId, cycle = 'monthly', extraSeats = 0) {
    const plan = getPlan(planId);
    if (plan.id === 'gratuit') {
      return { total: 0, basePrice: 0, seatsPrice: 0, currency: 'FCFA' };
    }
    const isAnnual = cycle === 'annual';
    const basePrice = isAnnual ? plan.pricing.annual : plan.pricing.monthly;
    let seatsPrice = 0;
    if (plan.id === 'business' && extraSeats > 0) {
      const seatUnit = isAnnual ? (plan.pricing.extraSeatAnnual || 14400) : (plan.pricing.extraSeatMonthly || 1500);
      seatsPrice = extraSeats * seatUnit;
    }
    return {
      total: Math.round(basePrice + seatsPrice),
      basePrice: Math.round(basePrice),
      seatsPrice: Math.round(seatsPrice),
      currency: 'FCFA'
    };
  }

  /**
   * Retourne la date de fin de période (+1 mois ou +12 mois à partir de startDate)
   */
  function calculatePeriodEnd(startDate, cycle = 'monthly') {
    const d = startDate ? new Date(startDate) : new Date();
    if (isNaN(d.getTime())) return null;
    const end = new Date(d);
    if (cycle === 'annual') {
      end.setFullYear(end.getFullYear() + 1);
    } else {
      end.setMonth(end.getMonth() + 1);
    }
    return end.toISOString();
  }

  /**
   * Retourne les dates début/fin du mois calendaire en cours pour Africa/Brazzaville
   */
  function getCurrentBrazzavilleMonthBounds(refDate = new Date()) {
    // Calcul de l'année et du mois dans le fuseau Africa/Brazzaville (UTC+1)
    const formatter = new Intl.DateTimeFormat('fr-FR', {
      timeZone: TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const parts = formatter.formatToParts(refDate);
    const year = parseInt(parts.find(p => p.type === 'year').value, 10);
    const month = parseInt(parts.find(p => p.type === 'month').value, 10); // 1..12

    // Début : 1er du mois à 00:00:00 UTC+1 (Brazzaville est sans heure d'été, toujours UTC+1)
    const startStr = `${year}-${String(month).padStart(2, '0')}-01T00:00:00+01:00`;
    // Fin du mois
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const endStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+01:00`;

    return {
      year,
      month,
      startIso: new Date(startStr).toISOString(),
      endIso: new Date(endStr).toISOString(),
      monthKey: `${year}-${String(month).padStart(2, '0')}`
    };
  }

  /**
   * Vérifie le statut d'un abonnement compte tenu de sa date de fin et de la période de grâce
   */
  function evaluateSubscriptionStatus(sub) {
    if (!sub || !sub.plan || sub.plan === 'gratuit') {
      return {
        effectivePlan: 'gratuit',
        status: 'active',
        isExpired: false,
        isPastDue: false,
        isInGracePeriod: false
      };
    }

    const now = new Date();
    const periodEnd = sub.period_end ? new Date(sub.period_end) : null;
    if (!periodEnd || isNaN(periodEnd.getTime())) {
      return {
        effectivePlan: normalizePlanId(sub.plan),
        status: sub.status || 'active',
        isExpired: false,
        isPastDue: false,
        isInGracePeriod: false
      };
    }

    // Grâce : 3 jours après period_end
    const graceEnd = new Date(periodEnd.getTime() + (GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000));

    if (now <= periodEnd) {
      return {
        effectivePlan: normalizePlanId(sub.plan),
        status: sub.status || 'active',
        isExpired: false,
        isPastDue: false,
        isInGracePeriod: false
      };
    } else if (now <= graceEnd) {
      return {
        effectivePlan: normalizePlanId(sub.plan),
        status: 'past_due',
        isExpired: false,
        isPastDue: true,
        isInGracePeriod: true,
        graceDaysLeft: Math.max(0, Math.ceil((graceEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
      };
    } else {
      // Expiré après période de grâce dépassée -> retour immédiat au plan Gratuit
      return {
        effectivePlan: 'gratuit',
        originalPlan: normalizePlanId(sub.plan),
        status: 'expired',
        isExpired: true,
        isPastDue: false,
        isInGracePeriod: false
      };
    }
  }

  return {
    PLANS,
    PAYMENT_GATEWAYS,
    TIMEZONE,
    GRACE_PERIOD_DAYS,
    normalizePlanId,
    getPlan,
    getGatewaysForCountry,
    calculateSubscriptionPrice,
    calculatePeriodEnd,
    getCurrentBrazzavilleMonthBounds,
    evaluateSubscriptionStatus
  };
});
