/**
 * KIVO MATIQUE — API Vérification Serveur de Paiement (/api/payments/verify)
 */

const { authenticateUser } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const auth = await authenticateUser(req);
  if (!auth || !auth.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  return res.status(501).json({ error: 'Vérification de paiement en cours de configuration.' });
};
