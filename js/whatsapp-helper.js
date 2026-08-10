/**
 * KIVO MATIQUE - WhatsApp Integration & Helper Module
 * Pre-formatted message builders and Meta WhatsApp Business API integration
 */

window.WhatsAppHelper = {
  /**
   * Builds pre-formatted WhatsApp message for sharing a Quote or Invoice
   */
  buildShareMessage: function (document, businessName = "MD Creative Studio") {
    const isQuote = document.type === "quote";
    const docTitle = isQuote ? "votre devis" : "votre facture";
    const docNum = document.number || `FAC-${document.id}`;
    const currencyStr = document.currency || "FCFA";
    const totalAmount = (document.total || 0).toLocaleString("fr-FR") + " " + currencyStr;
    const publicUrl = `${window.location.origin}${window.location.pathname}#public-doc?id=${document.id}`;

    let message = `Bonjour ${document.clientName || "Cher client"} 👋,\n\n`;
    
    if (isQuote) {
      message += `Votre devis *${docNum}* d'un montant de *${totalAmount}* émis par *${businessName}* est prêt.\n\n`;
      message += `Vous pouvez le consulter et l'accepter directement en ligne ici :\n👉 ${publicUrl}\n\n`;
      message += `Restant à votre entière disposition.\nKIVO MATIQUE | Business, simplified.`;
    } else {
      message += `Votre facture *${docNum}* d'un montant de *${totalAmount}* émise par *${businessName}* est disponible.\n\n`;
      message += `Vous pouvez la consulter, la télécharger et la régler en un clic par Carte bancaire (Stripe) ou Mobile Money :\n👉 ${publicUrl}\n\n`;
      message += `Merci pour votre confiance !\nKIVO MATIQUE`;
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

