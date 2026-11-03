/**
 * KIVO MATIQUE — API Clients (/api/clients)
 * Contrôle des limites de clients côté serveur.
 */

const { authenticateUser, supabaseFetch } = require('./_lib/supabase');
const { checkQuota } = require('./_lib/quota');
const crypto = require('crypto');

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

  if (req.method === 'POST') {
    const client = req.body || {};
    const name = (client.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Le nom du client est obligatoire' });
    }

    const clientId = client.id;
    let isExisting = false;
    if (clientId) {
      const check = await supabaseFetch(`/clients?id=eq.${encodeURIComponent(clientId)}&user_id=eq.${encodeURIComponent(userId)}&select=id`);
      if (check.status === 200 && Array.isArray(check.data) && check.data.length > 0) {
        isExisting = true;
      }
    }

    // Si nouveau client -> Vérification de la limite côté serveur
    if (!isExisting) {
      const quotaCheck = await checkQuota(userId, 'client');
      if (!quotaCheck.allowed) {
        return res.status(403).json(quotaCheck.error);
      }
    }

    const rawType = (client.type || client.clientType || 'B2B').toString().toUpperCase();
    const dbType = (rawType === 'B2C' || rawType === 'INDIVIDUAL' || rawType === 'PARTICULIER' || rawType === 'PERSON')
      ? 'Particulier'
      : 'Entreprise';

    const payload = {
      id: clientId || crypto.randomUUID(),
      user_id: userId,
      name: name,
      type: dbType,
      company: client.company || '',
      contact_name: client.contact_name || client.contactName || '',
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || ''
    };

    const saveRes = await supabaseFetch('/clients', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: payload
    });

    if (saveRes.status < 200 || saveRes.status >= 300) {
      return res.status(saveRes.status || 500).json({
        error: 'Erreur lors de la sauvegarde du client',
        details: saveRes.data
      });
    }

    return res.status(200).json({
      success: true,
      client: Array.isArray(saveRes.data) ? saveRes.data[0] : payload
    });
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
};
