/**
 * KIVO MATIQUE - WhatsApp Integration & Helper Module
 * Messages préformatés officiels et intégration WhatsApp Web / wa.me
 */

window.WhatsAppHelper = {
  /**
   * Construit le message préformaté WhatsApp pour le partage de documents
   * @param {Object} document - Objet facture ou devis
   * @param {string} businessName - Nom de l'entreprise émettrice
   * @param {string} shareUrl - URL de partage sécurisée construite avec window.location.origin
   * @param {string} messageType - 'invoice' | 'quote' | 'reminder' (auto si non spécifié)
   */
  buildShareMessage: function (document, businessName = "", shareUrl = "", messageType = "") {
    if (!document) return "";

    const isQuote = document.type === "quote" || document.type === "devis";
    const docNum = document.number || (isQuote ? `DEV-${document.id}` : `FAC-${document.id}`);
    const currencyStr = document.currency || (window.KivoApp && window.KivoApp.state && window.KivoApp.state.business && window.KivoApp.state.business.currency) || "FCFA";
    const totalAmount = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(document.total || 0)) + " " + currencyStr;

    // URL de partage : toujours construite avec window.location.origin
    const token = document.publicToken || document.public_token || "";
    const publicUrl = shareUrl || `${window.location.origin}/#public-doc?token=${token}`;

    const bizName = (businessName && businessName.trim())
      || (document.bizName && document.bizName.trim())
      || (window.KivoApp ? window.KivoApp.getBusinessName() : "")
      || "Notre Entreprise";

    // {prenom} = premier mot du nom du client si c'est un particulier ; si société ou vide : "Bonjour,"
    const clientType = (document.clientType || document.client_type || '').toUpperCase();
    const isB2B = clientType === 'B2B' || (!clientType && !document.clientName);
    const rawClientName = (document.clientName || '').trim();
    const prenom = (!isB2B && rawClientName) ? rawClientName.split(/\s+/)[0] : '';
    const salutation = prenom ? `Bonjour ${prenom},` : 'Bonjour,';

    // Échéance
    let echeance = document.dueDate || document.due_date || document.echeance || '';
    if (!echeance || echeance === 'undefined') {
      echeance = document.date || document.issueDate || 'immédiatement';
    } else {
      try {
        const dt = new Date(echeance);
        if (!isNaN(dt.getTime())) {
          echeance = dt.toLocaleDateString('fr-FR');
        }
      } catch (_) {}
    }

    const type = messageType || (document.status === 'overdue' ? 'reminder' : (isQuote ? 'quote' : 'invoice'));

    if (type === 'reminder') {
      return `${salutation}\n\nPetit rappel : la facture ${docNum} de *${totalAmount}* était à régler le *${echeance}*.\n\n📄 ${publicUrl}\n\nPouvez-vous me confirmer la date de votre règlement ? Merci !\n${bizName}`;
    }

    if (isQuote || type === 'quote') {
      return `${salutation}\n\n${bizName} vous propose le devis ${docNum} de *${totalAmount}*.\n\n📄 Consultez-le ici :\n${publicUrl}\n\nValable jusqu'au *${echeance}*. Répondez à ce message pour le valider ou l'ajuster.\n\n${bizName}`;
    }

    // Facture
    return `${salutation}\n\nVotre facture ${docNum} de *${totalAmount}* est prête chez ${bizName}.\n\n📄 Voir et télécharger en un clic :\n${publicUrl}\n\nÀ régler avant le *${echeance}*. Une question ? Répondez simplement à ce message.\n\nMerci pour votre confiance !\n${bizName}`;
  },

  /**
   * Génère l'URL cliquable https://wa.me/
   */
  getWhatsAppWebUrl: function (phoneNumber, messageText) {
    const cleanPhone = (phoneNumber || "").replace(/[^0-9]/g, "");
    const encodedMsg = encodeURIComponent(messageText);
    if (cleanPhone) {
      return `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
    } else {
      return `https://wa.me/?text=${encodedMsg}`;
    }
  }
};

