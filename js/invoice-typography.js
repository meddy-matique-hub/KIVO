/**
 * KIVO MATIQUE — Échelle Typographique Définitive des Factures & Devis
 * Centralisation stricte des tailles, graisses et couleurs pour le PDF et l'aperçu HTML en temps réel.
 *
 * Spécification stricte KIVO MATIQUE :
 * - Titre "FACTURE" / "DEVIS" : 28px, bold, letter-spacing 0.5px
 * - Nom de l'entreprise (émetteur) : 15px, bold
 * - Adresse / téléphone / email entreprise : 12px, regular, couleur #6B7280
 * - Numéro de document (ex: FAC-2026-1004) : 16px, bold, couleur accent
 * - Dates (émission/échéance) : 12px, regular, avec valeur en bold
 * - Labels de section ("CLIENT / FACTURÉ À", "CONTACT") : 11px, bold, uppercase, letter-spacing 0.5px, couleur #6B7280
 * - Nom du client : 14px, bold
 * - En-têtes de colonnes du tableau : 12px, bold, uppercase
 * - Corps du tableau (lignes d'articles) : 13px, regular (nom d'article en bold 13px)
 * - Ligne "Sous-total HT" : 13px, regular
 * - Ligne "Total TTC" : 18px, bold, couleur accent
 * - Bloc "Paiement & Règlement" - titre : 13px, bold
 * - Bloc "Paiement & Règlement" - contenu : 12.5px, regular (labels en bold inline)
 * - Footer / mentions légales : 11px, regular, couleur #6B7280 (WCAG AA)
 */

(function () {
  const KivoInvoiceTypography = {
    // 1. Titre principal (FACTURE / DEVIS)
    docTitle: {
      fontSize: '28px',
      fontWeight: '700',
      letterSpacing: '0.5px',
      lineHeight: '1.2'
    },

    // 2. Émetteur (Entreprise)
    issuerName: {
      fontSize: '15px',
      fontWeight: '700',
      lineHeight: '1.3'
    },
    issuerMeta: {
      fontSize: '12px',
      fontWeight: '400',
      color: '#6B7280',
      lineHeight: '1.5'
    },

    // 3. Métadonnées du document
    docNumber: {
      fontSize: '16px',
      fontWeight: '700',
      lineHeight: '1.3'
    },
    dates: {
      fontSize: '12px',
      fontWeight: '400',
      color: '#6B7280',
      lineHeight: '1.5'
    },

    // 4. Client / Destinataire
    sectionLabel: {
      fontSize: '11px',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      color: '#6B7280'
    },
    clientName: {
      fontSize: '14px',
      fontWeight: '700',
      lineHeight: '1.3'
    },
    clientMeta: {
      fontSize: '12px',
      fontWeight: '400',
      color: '#6B7280',
      lineHeight: '1.5'
    },

    // 5. Tableau d'articles
    tableHeader: {
      fontSize: '12px',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '0.3px',
      lineHeight: '1.4'
    },
    tableBody: {
      fontSize: '13px',
      fontWeight: '400',
      lineHeight: '1.45'
    },
    tableItemName: {
      fontSize: '13px',
      fontWeight: '700',
      lineHeight: '1.4'
    },

    // 6. Totaux
    subtotalLine: {
      fontSize: '13px',
      fontWeight: '400',
      lineHeight: '1.5'
    },
    totalLine: {
      fontSize: '18px',
      fontWeight: '700',
      lineHeight: '1.3'
    },
    depositLine: {
      fontSize: '12px',
      fontWeight: '600',
      lineHeight: '1.4'
    },
    balanceLine: {
      fontSize: '14px',
      fontWeight: '700',
      lineHeight: '1.4'
    },

    // 7. Bloc Paiement & Règlement
    paymentTitle: {
      fontSize: '13px',
      fontWeight: '700',
      lineHeight: '1.4'
    },
    paymentBody: {
      fontSize: '12.5px',
      fontWeight: '400',
      lineHeight: '1.5'
    },

    // 8. Footer & Mentions Légales
    footerLegal: {
      fontSize: '11px',
      fontWeight: '400',
      color: '#6B7280',
      lineHeight: '1.6'
    },

    // Helper CSS string generator
    toCss: function (tokenKey, extraStyles = '') {
      const token = this[tokenKey] || {};
      const parts = [];
      if (token.fontSize) parts.push(`font-size:${token.fontSize}`);
      if (token.fontWeight) parts.push(`font-weight:${token.fontWeight}`);
      if (token.letterSpacing) parts.push(`letter-spacing:${token.letterSpacing}`);
      if (token.lineHeight) parts.push(`line-height:${token.lineHeight}`);
      if (token.textTransform) parts.push(`text-transform:${token.textTransform}`);
      if (token.color) parts.push(`color:${token.color}`);
      if (extraStyles) parts.push(extraStyles);
      return parts.join(';') + ';';
    }
  };

  if (typeof window !== 'undefined') {
    window.KivoInvoiceTypography = KivoInvoiceTypography;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KivoInvoiceTypography;
  }
})();
