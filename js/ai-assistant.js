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
    let detectedAddress = "Dakar, Sénégal";
    let detectedPhone = "+221 77 000 00 00";
    let detectedEmail = "";

    // 1. Try to detect client from input text
    for (const client of availableClients) {
      const name = (client.name || "").toLowerCase();
      const company = (client.company || "").toLowerCase();
      const contact = (client.contactName || "").toLowerCase();
      const textLower = text.toLowerCase();

      if (
        (name && textLower.includes(name)) ||
        (company && textLower.includes(company)) ||
        (contact && textLower.includes(contact))
      ) {
        detectedClient = client.name || client.company;
        matchedClientId = client.id;
        if (client.address) detectedAddress = client.address;
        if (client.phone) detectedPhone = client.phone;
        if (client.email) detectedEmail = client.email;
        break;
      }
    }

    // Check common "pour [Client]" or "client: [Client]" regex
    if (!detectedClient) {
      const clientMatch = text.match(/(?:pour|chez|client\s*:?|société|entreprise)\s+([A-Z0-9À-ÖØ-öø-ÿ\s'-]{2,35})/i);
      if (clientMatch && clientMatch[1]) {
        let rawClient = clientMatch[1].split(/,|\n|avec|tva|pour|\.|:/i)[0].trim();
        if (rawClient.length > 2 && !/^(la|le|les|un|une|des|mon|ma)$/i.test(rawClient)) {
          detectedClient = rawClient.charAt(0).toUpperCase() + rawClient.slice(1);
        }
      }
    }

    if (!detectedClient) {
      detectedClient = "Société Martin & Associés";
    }

    // Detect phone or email in prompt if provided
    const phoneMatch = text.match(/(?:\+?\d{2,3}[\s.-]?)?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}[\s.-]?\d{2}/);
    if (phoneMatch) detectedPhone = phoneMatch[0];
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) detectedEmail = emailMatch[0];

    // 2. Detect VAT / Tax rate in text
    let taxRate = defaultTaxRate;
    const vatMatch = text.match(/(?:tva|taxe)\s*(\d{1,2})\s*%/i);
    if (vatMatch) {
      taxRate = parseFloat(vatMatch[1]) || 0;
    } else if (/sans tva|exonéré|ht|hors taxe/i.test(text)) {
      taxRate = 0;
    }

    // 3. Parse Line Items and Prices
    const items = [];
    // Split by newlines, semicolons, or commas with price indicators
    const segments = text.split(/\n|;|\band\b|\bet\b|\+|\bavec\b/i);

    for (let segment of segments) {
      segment = segment.trim();
      if (!segment || segment.length < 3) continue;

      // Ignore client intro segment
      if (/^(pour|chez|client|facture pour|devis pour)\s+[A-Z0-9]/i.test(segment) && !/\d{3,}/.test(segment)) {
        continue;
      }

      let price = 0;
      const priceMatch = segment.match(/(\d+[\d\s.,]*)\s*(?:fcfa|f cfa|cfa|f|€|eur|\$|usd|cad|gbp|£|k\b)/i);

      if (priceMatch) {
        let rawPriceStr = priceMatch[1].replace(/\s+/g, "").replace(",", ".");
        if (/k\b/i.test(segment)) {
          rawPriceStr = (parseFloat(rawPriceStr) * 1000).toString();
        }
        price = parseFloat(rawPriceStr) || 0;
      } else {
        const simpleDigit = segment.match(/(?:^|\s)(\d{3,9})(?:\s|$|[.,])/);
        if (simpleDigit) {
          price = parseFloat(simpleDigit[1]) || 0;
        }
      }

      let qty = 1;
      const qtyMatch = segment.match(/^(\d+)\s*(?:x|\*|fois|articles?|exemplaires?|visuels?|jours?|heures?|h\b)/i) ||
                       segment.match(/(\d+)\s*(?:x|\*|à|a)\b/i);
      if (qtyMatch) {
        qty = parseInt(qtyMatch[1], 10) || 1;
      }

      let title = segment
        .replace(/(\d+[\d\s.,]*)\s*(?:fcfa|f cfa|cfa|f|€|eur|\$|usd|cad|gbp|£|k\b)/gi, "")
        .replace(/(?:pour|chez|client\s*:?|société)\s+([A-Z0-9À-ÖØ-öø-ÿ\s'-]{2,30})/gi, "")
        .replace(/^(\d+)\s*(?:x|\*|fois|jours?|heures?)\s*/gi, "")
        .replace(/^(j'ai fait|création de|création|facture de|facture|devis|fourniture de|fourniture|prestation de|prestation)\s*/gi, "")
        .replace(/(?:tva|taxe)\s*\d{1,2}\s*%/gi, "")
        .replace(/[.,:;]+$/, "")
        .trim();

      if (title.length > 2) {
        title = title.charAt(0).toUpperCase() + title.slice(1);
        title = title.replace(/\s+(à|a|pour|avec)$/i, "").trim();

        // Default prices if not detected (in FCFA or EUR)
        const isEuro = /€|eur/i.test(defaultCurrency);
        const defaultBasePrice = isEuro ? 450 : 150000;
        const unitPrice = price > 0 ? (qty > 1 && price > (isEuro ? 100 : 10000) ? Math.round(price / qty) : price) : defaultBasePrice;

        items.push({
          name: title,
          description: title,
          quantity: qty,
          qty: qty,
          price: unitPrice,
          unitPrice: unitPrice,
          unit_price: unitPrice,
          total: unitPrice * qty
        });
      }
    }

    // If no specific line items parsed (e.g. user gave a visual style prompt), create high-grade realistic business lines
    if (items.length === 0) {
      const isEuro = /€|eur/i.test(defaultCurrency);
      const isUsd = /\$|usd/i.test(defaultCurrency);
      const mult = (isEuro || isUsd) ? 1 : 450;
      const p1 = 650 * mult;
      const p2 = 350 * mult;
      const p3 = 180 * mult;

      items.push({
        name: "Développement & Intégration Plateforme",
        description: "Développement & Intégration Plateforme",
        quantity: 1,
        qty: 1,
        price: p1,
        unitPrice: p1,
        unit_price: p1,
        total: p1
      });
      items.push({
        name: "Direction Artistique & Design UI/UX",
        description: "Direction Artistique & Design UI/UX",
        quantity: 1,
        qty: 1,
        price: p2,
        unitPrice: p2,
        unit_price: p2,
        total: p2
      });
      items.push({
        name: "Maintenance, Hébergement & Support Dédié",
        description: "Maintenance, Hébergement & Support Dédié",
        quantity: 1,
        qty: 1,
        price: p3,
        unitPrice: p3,
        unit_price: p3,
        total: p3
      });
    }

    let suggestedDueDateDays = 14;
    if (/vendredi/i.test(text)) suggestedDueDateDays = 5;
    if (/fin de mois|30 jours/i.test(text)) suggestedDueDateDays = 30;
    if (/immédiat|comptant|aujourd'hui/i.test(text)) suggestedDueDateDays = 1;

    const dueDateObj = new Date();
    dueDateObj.setDate(dueDateObj.getDate() + suggestedDueDateDays);
    const dueDateStr = dueDateObj.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];

    const currentYear = new Date().getFullYear();
    const randNum = String(Math.floor(Math.random() * 900) + 100);
    const docNumber = `FAC-${currentYear}-${randNum}`;

    return {
      docNumber: docNumber,
      client: {
        name: detectedClient,
        address: detectedAddress,
        phone: detectedPhone,
        email: detectedEmail
      },
      clientName: detectedClient,
      clientId: matchedClientId || "",
      clientAddress: detectedAddress,
      clientPhone: detectedPhone,
      clientEmail: detectedEmail,
      items: items,
      currency: defaultCurrency || "FCFA",
      taxRate: taxRate,
      issueDate: todayStr,
      dueDate: dueDateStr,
      suggestedDueDate: dueDateStr,
      notes: `Facture structurée via KIVO MATIQUE AI Assistant.`,
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
        message = `Bonjour ${clientName},\n\nJ'espère que vous allez bien ! Petit rappel amical concernant la facture ${docNum} d'un montant de ${amountStr}.\n\nVous pouvez la consulter et la régler en un clic par Carte bancaire (Stripe) ou Mobile Money via ce lien :\nLien direct : ${publicUrl}\n\nN'hésitez pas si vous avez la moindre question.\nExcellente journée,\n${businessName}`;
        break;

      case "formel":
        message = `Bonjour ${clientName},\n\nSauf erreur ou omission de notre part, nous constatons que la facture N° ${docNum} datée du ${doc.issueDate} d'un montant de ${amountStr} est toujours en attente de paiement.\n\nNous vous prions de bien vouloir procéder au règlement via notre lien sécurisé :\nLien direct : ${publicUrl}\n\nRestant à votre disposition,\nBien cordialement,\n${businessName}`;
        break;

      case "urgent":
        message = `RAPPEL DE PAIEMENT EN RETARD\n\nBonjour ${clientName},\n\nMalgré nos relances précédentes, la facture N° ${docNum} (${amountStr}) arrivée à échéance le ${doc.dueDate} demeure impayée.\n\nAfin d'éviter toute pénalité ou interruption de nos services, nous vous demandons de régulariser la situation immédiatement via ce lien :\nLien direct : ${publicUrl}\n\nMerci de nous transmettre la confirmation de paiement.\n${businessName}`;
        break;

      case "courtois":
      default:
        message = `Bonjour ${clientName},\n\nNous vous rappelons que la facture ${docNum} d'un montant de ${amountStr} est actuellement en attente de règlement.\n\nVous pouvez consulter le détail et effectuer le paiement sécurisé par Carte (Stripe) ou Mobile Money ici :\nLien direct : ${publicUrl}\n\nMerci pour votre confiance,\n${businessName}`;
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

