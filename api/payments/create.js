/**
 * KIVO MATIQUE — API Initialisation de Paiement (/api/payments/create)
 */

const { authenticateUser } = require('../_lib/supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  const auth = await authenticateUser(req);
  if (!auth || !auth.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }

  return res.status(501).json({ error: 'Passerelle de paiement en cours de configuration.' });
};
