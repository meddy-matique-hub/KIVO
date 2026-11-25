/**
 * KIVO MATIQUE — API Configuration SasPay (/api/payments/config)
 * Renvoie uniquement { enabled: true/false } selon SASPAY_ROLLOUT et le pays du compte.
 */

const { authenticateUser, supabaseFetch } = require('../_lib/supabase');
const { isUserEnabledForSasPay } = require('../_lib/saspay');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const auth = await authenticateUser(req);
  if (!auth || !auth.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  let country = '';
  try {
    const bRes = await supabaseFetch(
      `/business_settings?user_id=eq.${encodeURIComponent(auth.user.id)}&order=created_at.desc&limit=1&select=country`
    );
    if (bRes.status === 200 && Array.isArray(bRes.data) && bRes.data.length > 0) {
      country = bRes.data[0].country || '';
    }
  } catch (_) {}

  const enabled = isUserEnabledForSasPay(auth.user.email, country);
  return res.status(200).json({ enabled });
};

