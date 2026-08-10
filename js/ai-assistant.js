/**
 * KIVO MATIQUE - Intelligent Text Parser & Smart Reminders Engine
 */

window.KivoAI = {
  /**
   * Parses natural text input into structured invoice/quote items and metadata
   * Example input: "Vidéo promo pour Restaurant La Paix, 150 000 FCFA avec 2 flyers à 15 000 FCFA chacun, TVA 18%"
   */
  parseTextToDocument: function (textInput, availableClients = [], defaultCurrency = "FCFA", defaultTaxRate = 18) {
    if (!textInput || textInput.trim().length === 0) {
      return null;
    }

    const text = textInput.trim();
    let detectedClient = null;
    let matchedClientId = null;

    // 1. Try to detect client from input text
    for (const client of availableClients) {
      const name = client.name.toLowerCase();
      const company = (client.company || "").toLowerCase();
      const contact = (client.contactName || "").toLowerCase();
      const textLower = text.toLowerCase();

      if (
        textLower.includes(name) ||
        (company && textLower.includes(company)) ||
        (contact && textLower.includes(contact))
      ) {
        detectedClient = client.name;
        matchedClientId = client.id;
        break;
      }
    }

    // If client wasn't found in existing list, check common "pour [Client]" regex
    if (!detectedClient) {
      const clientMatch = text.match(/(?:pour|chez|client)\s+([A-Z0-9À-ÖØ-öø-ÿ\s'-]{2,30})/i);
      if (clientMatch && clientMatch[1]) {
        detectedClient = clientMatch[1].replace(/,\s*|\.\s*$/, "").trim();
      }
    }

    // 2. Detect VAT / Tax rate in text
    let taxRate = defaultTaxRate;
    const vatMatch = text.match(/(?:tva|taxe)\s*(\d{1,2})\s*%/i);
    if (vatMatch) {
      taxRate = parseFloat(vatMatch[1]) || 0;
    } else if (/sans tva|exonéré|ht/i.test(text)) {
      taxRate = 0;
    }

    // 3. Parse Line Items and Prices
    const items = [];
    const segments = text.split(/,|\+|\n| et /i);

    for (let segment of segments) {
      segment = segment.trim();
      if (!segment) continue;

      let price = 0;
      const priceMatch = segment.match(/(\d+[\d\s.,]*)\s*(?:fcfa|f cfa|cfa|f|€|\$|k)/i);
      
      if (priceMatch) {
        let rawPriceStr = priceMatch[1].replace(/\s+|\./g, "").replace(",", ".");
        if (/k$/i.test(segment)) {
          rawPriceStr = (parseFloat(rawPriceStr) * 1000).toString();
        }
        price = parseFloat(rawPriceStr) || 0;
      } else {
        const simpleDigit = segment.match(/(\d{4,9})/);
        if (simpleDigit) {
          price = parseFloat(simpleDigit[1]);
        }
      }

      let qty = 1;
      const qtyMatch = segment.match(/^(\d+)\s*(?:x|\*|fois|articles?|exemplaires?|visuels?|flyers?)/i) || 
                       segment.match(/(\d+)\s*(?:x|\*|à|a)/i);
      if (qtyMatch) {
        qty = parseInt(qtyMatch[1], 10) || 1;
      }

      let title = segment
        .replace(/(\d+[\d\s.,]*)\s*(?:fcfa|f cfa|cfa|f|€|\$|k)/gi, "")
        .replace(/(?:pour|chez|client)\s+([A-Z0-9À-ÖØ-öø-ÿ\s'-]{2,30})/gi, "")
        .replace(/^(\d+)\s*(?:x|\*|fois)\s*/gi, "")
        .replace(/^j'ai fait|création|facture|devis|fourniture/gi, "")
        .replace(/(?:tva|taxe)\s*\d{1,2}\s*%/gi, "")
        .trim();

      if (title.length > 2) {
        title = title.charAt(0).toUpperCase() + title.slice(1);
        title = title.replace(/\s+(à|a|pour|avec)$/i, "");

        if (price > 0 || items.length === 0) {
          const unitPrice = (qty > 1 && price > 1000) ? Math.round(price / qty) : (price || 25000);
          items.push({
            name: title || "Prestation de service",
            description: "Service structuré via KIVO MATIQUE AI",
            quantity: qty,
            price: unitPrice,
            total: unitPrice * qty
          });
        }
      }
    }

    if (items.length === 0) {
      items.push({
        name: "Service / Prestation créative",
        description: text.length > 60 ? text.substring(0, 60) + "..." : text,
        quantity: 1,
        price: 50000,
        total: 50000
      });
    }

    let suggestedDueDateDays = 7;
    if (/vendredi/i.test(text)) suggestedDueDateDays = 5;
    if (/fin de mois|30 jours/i.test(text)) suggestedDueDateDays = 30;
    if (/immédiat|comptant|aujourd'hui/i.test(text)) suggestedDueDateDays = 1;

    const dueDateObj = new Date();
    dueDateObj.setDate(dueDateObj.getDate() + suggestedDueDateDays);
    const dueDateStr = dueDateObj.toISOString().split('T')[0];

    return {
      clientName: detectedClient || "",
      clientId: matchedClientId || "",
      items: items,
      taxRate: taxRate,
      suggestedDueDate: dueDateStr,
      notes: `Généré via KIVO MATIQUE AI Assistant. Context: "${text}"`,
      confidence: detectedClient ? "high" : "medium"
    };
  },

  /**
   * Generates a smart French reminder message for overdue or pending invoices
   */
  generateReminder: function (doc, tone = "courtois", businessName = "MD Creative Studio") {
    const docNum = doc.number || `FAC-${doc.id}`;
    const amountStr = (doc.total || 0).toLocaleString("fr-FR") + " " + (doc.currency || "FCFA");
    const clientName = doc.clientName || "Cher client";
    const publicUrl = `${window.location.origin}${window.location.pathname}#public-doc?id=${doc.id}`;

    let message = "";

    switch (tone) {
      case "amical":
        message = `Bonjour ${clientName} 😊\n\nJ'espère que vous allez bien ! Petit rappel amical concernant la facture ${docNum} d'un montant de ${amountStr}.\n\nVous pouvez la consulter et la régler en un clic par Carte bancaire (Stripe) ou Mobile Money via ce lien :\n👉 ${publicUrl}\n\nN'hésitez pas si vous avez la moindre question.\nExcellente journée,\n${businessName}`;
        break;

      case "formel":
        message = `Bonjour ${clientName},\n\nSauf erreur ou omission de notre part, nous constatons que la facture N° ${docNum} datée du ${doc.issueDate} d'un montant de ${amountStr} est toujours en attente de paiement.\n\nNous vous prions de bien vouloir procéder au règlement via notre lien sécurisé :\n👉 ${publicUrl}\n\nRestant à votre disposition,\nBien cordialement,\n${businessName}`;
        break;

      case "urgent":
        message = `⚠️ RAPPEL DE PAIEMENT EN RETARD\n\nBonjour ${clientName},\n\nMalgré nos relances précédentes, la facture N° ${docNum} (${amountStr}) arrivée à échéance le ${doc.dueDate} demeure impayée.\n\nAfin d'éviter toute pénalité ou interruption de nos services, nous vous demandons de régulariser la situation immédiatement via ce lien :\n👉 ${publicUrl}\n\nMerci de nous transmettre la confirmation de paiement.\n${businessName}`;
        break;

      case "courtois":
      default:
        message = `Bonjour ${clientName} 👋\n\nNous vous rappelons que la facture ${docNum} d'un montant de ${amountStr} est actuellement en attente de règlement.\n\nVous pouvez consulter le détail et effectuer le paiement sécurisé par Carte (Stripe) ou Mobile Money ici :\n👉 ${publicUrl}\n\nMerci pour votre confiance,\n${businessName}`;
        break;
    }

    return {
      text: message,
      whatsappUrl: `https://wa.me/${(doc.clientPhone || "").replace(/[^0-9]/g, "")}?text=${encodeURIComponent(message)}`,
      emailSubject: `Rappel de paiement - Facture ${docNum} (${businessName})`,
      emailBody: message
    };
  }
};

