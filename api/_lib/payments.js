/**
 * KIVO MATIQUE — Configuration sécurité paiements
 * Le mode sandbox est désactivé par défaut et interdit en production.
 */

const IS_SANDBOX = (process.env.KIVO_PAYMENT_SANDBOX === 'true') && (process.env.VERCEL_ENV !== 'production');

module.exports = {
  IS_SANDBOX
};
