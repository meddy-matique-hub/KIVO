/**
 * KIVO MATIQUE — API Documents (/api/documents)
 * Contrôle des quotas côté serveur & persistance.
 */

const { authenticateUser, supabaseFetch } = require('./_lib/supabase');
const { checkQuota, countMonthlyDocuments, getUserSubscription } = require('./_lib/quota');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Authentification
  const auth = await authenticateUser(req);
  if (!auth || !auth.user) {
    return res.status(401).json({ error: 'Non authentifié' });
  }
  const userId = auth.user.id;

  // ── GET /api/documents : Récupère les stats d'usage du mois ──────────────
  if (req.method === 'GET') {
    const sub = await getUserSubscription(userId);
    const count = await countMonthlyDocuments(userId);
    return res.status(200).json({
      plan: sub.planDef.id,
      monthlyDocsCount: count,
      limit: sub.planDef.limits.docsPerMonth,
      remaining: sub.planDef.limits.docsPerMonth === Infinity ? 'unlimited' : Math.max(0, sub.planDef.limits.docsPerMonth - count),
      isLimitReached: sub.planDef.limits.docsPerMonth !== Infinity && count >= sub.planDef.limits.docsPerMonth
    });
  }

  // ── POST /api/documents : Création ou finalisation d'un document ─────────
  if (req.method === 'POST') {
    const doc = req.body || {};
    const clientName = (doc.clientName || doc.client_name || '').trim();

    // RÈGLE B2 : Un document n'est comptabilisé que s'il est enregistré avec un nom de client
    const isNamedClient = !!(clientName && clientName !== 'Client sans nom');

    // Vérifier si c'est une modification d'un document existant (dans ce cas, on n'incrémente pas)
    const docId = doc.id;
    let isExisting = false;
    if (docId) {
      const checkRes = await supabaseFetch(`/documents?id=eq.${encodeURIComponent(docId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,client_name`);
      if (checkRes.status === 200 && Array.isArray(checkRes.data) && checkRes.data.length > 0) {
        isExisting = true;
      }
    }

    // Si nouveau document ET client nommé -> Vérification du quota côté serveur
    if (!isExisting && isNamedClient) {
      const quotaCheck = await checkQuota(userId, 'document');
      if (!quotaCheck.allowed) {
        return res.status(403).json(quotaCheck.error);
      }
    }

    // Insertion ou Upsert du document dans Supabase
    const payload = {
      id: docId || crypto.randomUUID(),
      user_id: userId,
      number: doc.number || ('FAC-' + Date.now().toString().slice(-6)),
      type: doc.type || 'invoice',
      status: doc.status || 'draft',
      client_name: clientName,
      client_id: doc.clientId || doc.client_id || null,
      client_email: doc.clientEmail || doc.client_email || '',
      client_phone: doc.clientPhone || doc.client_phone || '',
      client_type: doc.clientType || doc.client_type || 'B2B',
      date_issued: doc.issueDate || doc.date_issued || new Date().toISOString().split('T')[0],
      date_due: doc.dueDate || doc.date_due || null,
      items: doc.items || [],
      subtotal: Number(doc.subtotal) || 0,
      tax_amount: Number(doc.taxAmount !== undefined ? doc.taxAmount : (doc.tax || 0)) || 0,
      total: Number(doc.total) || 0,
      amount_paid: Number(doc.amountPaid || doc.amount_paid) || 0,
      notes: doc.notes || '',
      conditions: doc.conditions || doc.terms || ''
    };

    const saveRes = await supabaseFetch('/documents', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: payload
    });

    if (saveRes.status < 200 || saveRes.status >= 300) {
      return res.status(saveRes.status || 500).json({
        error: 'Erreur lors de la sauvegarde du document',
        details: saveRes.data
      });
    }

    // Si nouveau document avec client nommé : enregistrer l'activité 'document_created'
    // Garantit que même si le document est supprimé plus tard, la suppression ne décrémente pas le compteur mensuel
    if (!isExisting && isNamedClient) {
      try {
        await supabaseFetch('/activities', {
          method: 'POST',
          body: {
            id: crypto.randomUUID(),
            user_id: userId,
            type: 'document_created',
            details: {
              document_id: payload.id,
              number: payload.number,
              client_name: clientName,
              created_at: new Date().toISOString()
            }
          }
        });
      } catch (_) {}
    }

    return res.status(200).json({
      success: true,
      document: Array.isArray(saveRes.data) ? saveRes.data[0] : payload
    });
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
};

