/**
 * KIVO MATIQUE - WhatsApp Integration & Helper Module
 * Pre-formatted message builders and Meta WhatsApp Business API integration
 */

window.WhatsAppHelper = {
  /**
   * Builds pre-formatted WhatsApp message for sharing a Quote or Invoice
   */
  buildShareMessage: function (document, businessName = "") {
    const isQuote = document.type === "quote";
    const docNum = document.number || (isQuote ? `DEV-${document.id}` : `FAC-${document.id}`);
    const currencyStr = document.currency || "FCFA";
    const totalAmount = (document.total || 0).toLocaleString("fr-FR") + " " + currencyStr;
    const token = document.publicToken || document.public_token || document.id;
    const publicUrl = `${window.location.origin}${window.location.pathname}#public-doc?token=${token}`;

    const bizName = (businessName && businessName.trim())
      || (document.bizName && document.bizName.trim())
      || (window.KivoApp ? window.KivoApp.getBusinessName() : "")
      || "Notre Entreprise";

    let message = `Bonjour ${document.clientName || "Cher client"},\n\n`;
    
    if (isQuote) {
      message += `Votre devis *${docNum}* d'un montant de *${totalAmount}* émis par *${bizName}* est prêt.\n\n`;
      message += `Vous pouvez le consulter et l'accepter directement en ligne ici :\n${publicUrl}\n\n`;
      message += `Restant à votre entière disposition,\n${bizName}`;
    } else {
      message += `Votre facture *${docNum}* d'un montant de *${totalAmount}* émise par *${bizName}* est disponible.\n\n`;
      message += `Vous pouvez la consulter et la télécharger ici :\n${publicUrl}\n\n`;
      message += `Merci pour votre confiance !\n${bizName}`;
    }

    return message;
  },

  /**
   * Generates clickable https://wa.me/ URL
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

