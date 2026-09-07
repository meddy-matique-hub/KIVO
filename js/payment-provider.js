/**
 * KIVO MATIQUE - Payment Provider & Billing Engine Layer
 * Supports Stripe (Visa/Mastercard), Wave Mobile Money, Orange Money, MTN MoMo, and Wire Transfer.
 */

window.PaymentProvider = {
  providers: [
    {
      id: "stripe",
      name: "Stripe & Carte Bancaire (Visa / Mastercard)",
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,
      badge: "International",
      color: "#6366F1",
      description: "Paiement sécurisé par carte bancaire avec Stripe Checkout."
    },
    {
      id: "wave",
      name: "Wave Mobile Money",
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1DC0F2" stroke-width="2"><path d="M2 12c3-5 7-5 10 0s7 5 10 0"/></svg>`,
      badge: "0% frais",
      color: "#1DC0F2",
      description: "Paiement instantané par QR Code ou numéro Wave."
    },
    {
      id: "orange_money",
      name: "Orange Money",
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FF6600" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
      badge: "Populaire",
      color: "#FF6600",
      description: "Paiement sécurisé via code USSD ou app Orange Money."
    },
    {
      id: "mtn_momo",
      name: "MTN Mobile Money",
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EAB308" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 10l4-4 4 4"/></svg>`,
      badge: "Afrique de l'Ouest & Centrale",
      color: "#FFCC00",
      description: "Paiement direct depuis votre compte MTN MoMo."
    },
    {
      id: "bank_wire",
      name: "Virement Bancaire / RIB",
      icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2"><line x1="3" y1="21" x2="21" y2="21"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="12 3 2 10 22 10"/><line x1="6" y1="10" x2="6" y2="21"/><line x1="10" y1="10" x2="10" y2="21"/><line x1="14" y1="10" x2="14" y2="21"/><line x1="18" y1="10" x2="18" y2="21"/></svg>`,
      badge: "Classique",
      color: "#0F172A",
      description: "Virement bancaire direct sur le compte de l'entreprise."
    }
  ],

  /**
   * Process simulated payment transaction for an invoice (Stripe or Mobile Money)
   */
  processPayment: function (document, providerId, paymentDetails, onSuccess, onError) {
    console.log(`[PaymentProvider] Initiating payment for ${document.number} via ${providerId}`);

    // Simulated processing delay (1.2s)
    setTimeout(() => {
      const transactionId = (providerId === 'stripe' ? 'ch_stripe_' : 'txn_') + Math.random().toString(36).substring(2, 9).toUpperCase();
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
    }, 1200);
  },

  /**
   * Process a refund for a paid invoice
   */
  processRefund: function (document, reason, onSuccess) {
    console.log(`[PaymentProvider] Processing refund for document ${document.number}`);

    setTimeout(() => {
      const refundId = "re_stripe_" + Math.random().toString(36).substring(2, 9).toUpperCase();
      const refundRecord = {
        refundId: refundId,
        documentId: document.id,
        documentNumber: document.number,
        amount: document.amountPaid || document.total,
        currency: document.currency || "FCFA",
        reason: reason || "Demande de remboursement client",
        refundedAt: new Date().toISOString(),
        status: "REFUNDED"
      };

      window.PaymentProvider.simulateWebhookEvent({
        event: "invoice.refund.succeeded",
        data: refundRecord
      });

      if (typeof onSuccess === "function") {
        onSuccess(refundRecord);
      }
    }, 1000);
  },

  /**
   * Simulates Webhook callback from payment gateway to update state asynchronously
   */
  simulateWebhookEvent: function (payload) {
    console.log("[PaymentProvider Webhook] Received webhook payload:", payload);

    if (!payload || !window.KivoApp) return;

    if (payload.event === "invoice.payment.succeeded") {
      const data = payload.data;
      window.KivoApp.recordInvoicePayment(data.documentId, data.amount, data.provider, data.transactionId);
    } else if (payload.event === "invoice.refund.succeeded") {
      const data = payload.data;
      window.KivoApp.recordInvoiceRefund(data.documentId, data.amount, data.refundId, data.reason);
    }
  }
};

