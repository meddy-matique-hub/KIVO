/**
 * KIVO SaaS - Payment Provider Abstraction Layer
 * Supports Wave Mobile Money, Orange Money, MTN MoMo, Card (Stripe/Flutterwave) and Wire Transfer.
 */

window.PaymentProvider = {
  providers: [
    {
      id: "wave",
      name: "Wave Mobile Money",
      icon: "🌊",
      badge: "0% frais",
      color: "#1DC0F2",
      description: "Paiement instantané par QR Code ou numéro Wave."
    },
    {
      id: "orange_money",
      name: "Orange Money",
      icon: "🍊",
      badge: "Populaire",
      color: "#FF6600",
      description: "Paiement sécurisé via code USSD ou app Orange Money."
    },
    {
      id: "mtn_momo",
      name: "MTN Mobile Money",
      icon: "🟡",
      badge: "Afrique de l'Ouest & Centrale",
      color: "#FFCC00",
      description: "Paiement direct depuis votre compte MTN MoMo."
    },
    {
      id: "card",
      name: "Carte Bancaire (Visa / Mastercard)",
      icon: "💳",
      badge: "International",
      color: "#4F46E5",
      description: "Paiement sécurisé crypté SSL 256-bit par Carte bancaire."
    },
    {
      id: "bank_wire",
      name: "Virement Bancaire / RIB",
      icon: "🏦",
      badge: "Classique",
      color: "#0F172A",
      description: "Virement bancaire direct sur le compte de l'entreprise."
    }
  ],

  /**
   * Process simulated payment transaction for an invoice
   */
  processPayment: function (document, providerId, paymentDetails, onSuccess, onError) {
    console.log(`[PaymentProvider] Initiating payment for ${document.number} via ${providerId}`);

    // Simulated network processing latency (1.5 seconds)
    setTimeout(() => {
      const transactionId = "TXN_" + Math.random().toString(36).substring(2, 9).toUpperCase();
      const paidAmount = document.total - (document.amountPaid || 0);

      const paymentRecord = {
        transactionId: transactionId,
        documentId: document.id,
        documentNumber: document.number,
        provider: providerId,
        amount: paidAmount,
        currency: document.currency || "FCFA",
        paidAt: new Date().toISOString(),
        customerPhone: paymentDetails.phone || document.clientPhone || "",
        status: "COMPLETED"
      };

      // Trigger Webhook Event Simulation
      window.PaymentProvider.simulateWebhookEvent({
        event: "invoice.payment.succeeded",
        data: paymentRecord
      });

      if (typeof onSuccess === "function") {
        onSuccess(paymentRecord);
      }
    }, 1500);
  },

  /**
   * Simulates Webhook callback from payment gateway to update state asynchronously
   */
  simulateWebhookEvent: function (payload) {
    console.log("[PaymentProvider Webhook] Received webhook payload:", payload);

    if (payload && payload.event === "invoice.payment.succeeded" && window.KivoApp) {
      const data = payload.data;
      window.KivoApp.recordInvoicePayment(data.documentId, data.amount, data.provider, data.transactionId);
    }
  }
};
