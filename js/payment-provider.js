/**
 * KIVO MATIQUE - Payment Provider Layer
 * Les paiements simulés côté client sont désactivés pour des raisons de sécurité.
 */

window.PaymentProvider = {
  providers: [],

  processPayment: function (_document, _providerId, _paymentDetails, _onSuccess, onError) {
    if (typeof onError === 'function') {
      onError(new Error('Le paiement en ligne des factures est temporairement indisponible.'));
    }
  },

  processRefund: function () {},

  simulateWebhookEvent: function () {}
};
