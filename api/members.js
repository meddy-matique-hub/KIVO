/**
 * KIVO MATIQUE — API Membres d'Équipe (/api/members)
 * Contrôle des sièges et rôles côté serveur (Plan Business).
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
    const body = req.body || {};
    const email = (body.email || '').toLowerCase().trim();
    const role = (body.role || 'member').toLowerCase().trim();

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Adresse email invalide' });
    }

    // Vérification du quota côté serveur (Plan Business + sièges)
    const quotaCheck = await checkQuota(userId, 'member');
    if (!quotaCheck.allowed) {
      return res.status(403).json(quotaCheck.error);
    }

    const inviteToken = crypto.randomUUID().replace(/-/g, '');
    const payload = {
      id: crypto.randomUUID(),
      user_id: userId,
      email: email,
      role: role === 'admin' ? 'admin' : 'member',
      status: 'invited',
      invite_token: inviteToken,
      invited_at: new Date().toISOString()
    };

    const saveRes = await supabaseFetch('/team_members', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: payload
    });

    if (saveRes.status < 200 || saveRes.status >= 300) {
      return res.status(saveRes.status || 500).json({
        error: "Erreur lors de l'enregistrement de l'invitation",
        details: saveRes.data
      });
    }

    return res.status(200).json({
      success: true,
      member: Array.isArray(saveRes.data) ? saveRes.data[0] : payload,
      inviteToken
    });
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
};
