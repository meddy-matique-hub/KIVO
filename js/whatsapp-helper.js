/**
 * KIVO SaaS - WhatsApp Integration & Helper Module
 * Pre-formatted message builders and Meta WhatsApp Business API architecture ready
 */

window.WhatsAppHelper = {
  /**
   * Builds pre-formatted WhatsApp message for sharing a Quote or Invoice
   */
  buildShareMessage: function (document, businessName = "MD Creative Studio") {
    const isQuote = document.type === "quote";
    const docTitle = isQuote ? "votre devis" : "votre facture";
    const docNum = document.number || `KVO-${document.id}`;
    const totalAmount = (document.total || 0).toLocaleString("fr-FR") + " " + (document.currency || "FCFA");
    const publicUrl = `${window.location.origin}${window.location.pathname}#public-view?id=${document.id}`;

    let message = `Bonjour ${document.clientName || "Cher client"} 👋,\n\n`;
    
    if (isQuote) {
      message += `Votre devis *${docNum}* d'un montant de *${totalAmount}* émis par *${businessName}* est prêt.\n\n`;
      message += `Vous pouvez le consulter et l'accepter directement en ligne ici :\n👉 ${publicUrl}\n\n`;
      message += `Restant à votre disposition pour toute question.\nExcellente journée !`;
    } else {
      message += `Votre facture *${docNum}* d'un montant de *${totalAmount}* émise par *${businessName}* est disponible.\n\n`;
      message += `Vous pouvez la consulter, la télécharger et la régler en un clic via notre lien sécurisé :\n👉 ${publicUrl}\n\n`;
      message += `Merci pour votre confiance !`;
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
  },

  /**
   * Meta WhatsApp Business API Architecture Payload Builder (For backend node/python integration)
   */
  buildMetaApiPayload: function (phoneNumber, templateName, documentData) {
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: (phoneNumber || "").replace(/[^0-9]/g, ""),
      type: "template",
      template: {
        name: templateName || "kivo_document_notification",
        language: { code: "fr" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: documentData.clientName || "Client" },
              { type: "text", text: documentData.number || "KVO-0000" },
              { type: "text", text: `${documentData.total} FCFA` },
              { type: "text", text: `${window.location.origin}/#public-view?id=${documentData.id}` }
            ]
          }
        ]
      }
    };
  }
};
