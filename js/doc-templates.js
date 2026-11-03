/**
 * KIVO MATIQUE — Document Templates Engine
 * 7 professional templates based on reference designs + gallery system
 * Fully reactive to all builder inputs, line items, and logo customizations (size, position, color extraction).
 */

window.KivoTemplates = {

  // ── Template Registry (7 models matching reference design) ───────────
  builtIn: [
    { id: 'minimalist', name: 'Minimalist',   desc: 'Clair et concis, design épuré officiel KIVO.' },
    { id: 'corporate',  name: 'Corporate',    desc: 'Formel, bandeau bleu marine et structure nette.' },
    { id: 'elegant',    name: 'Elegant',      desc: 'Raffiné, dorure subtile et typographie noble.' },
    { id: 'modern',     name: 'Modern',       desc: 'Vibrant, dégradé coloré et badges arrondis.' },
    { id: 'clean',      name: 'Modern Clean', desc: 'Clair, précis, liseré cyan et lisibilité optimale.' },
    { id: 'editorial',  name: 'Editorial',    desc: 'Typographie forte, contraste noir et rouge.' },
    { id: 'premium',    name: 'Premium',      desc: 'Édition exclusive sombre avec bande cuivre brossé.' }
  ],

  isFullHtml: function () {
    return true;
  },

  // ── Universal Text & Formatting Helpers (A1, A4, A5) ──────────────────
  cleanText: function (str) {
    if (str === null || str === undefined) return null;
    const s = String(str).trim();
    if (!s || s === '--' || s === '-' || s === 'undefined' || s === 'null') return null;
    return s;
  },

  formatPhoneNumber: function (phone) {
    if (phone === null || phone === undefined) return null;
    const s = String(phone).trim();
    if (!s || s === '--' || s === '-' || s === 'undefined' || s === 'null') return null;
    const rawDigits = s.replace(/[^\d+]/g, '');
    if (rawDigits.startsWith('+242')) {
      const rest = rawDigits.slice(4).replace(/^0+/, '');
      if (rest.length === 9) {
        return `+242 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5, 7)} ${rest.slice(7, 9)}`;
      } else if (rest.length === 8) {
        return `+242 0${rest.slice(0, 1)} ${rest.slice(1, 4)} ${rest.slice(4, 6)} ${rest.slice(6, 8)}`;
      }
      return `+242 ${rest}`;
    } else if (rawDigits.startsWith('242') && rawDigits.length >= 11) {
      const rest = rawDigits.slice(3);
      return `+242 ${rest.slice(0, 2)} ${rest.slice(2, 5)} ${rest.slice(5, 7)} ${rest.slice(7, 9)}`;
    } else if (/^0[4-6]\d{7}$/.test(rawDigits)) {
      return `+242 ${rawDigits.slice(0, 2)} ${rawDigits.slice(2, 5)} ${rawDigits.slice(5, 7)} ${rawDigits.slice(7, 9)}`;
    }
    return s;
  },

  formatDocDate: function (isoStr) {
    if (!isoStr) return '';
    const parts = String(isoStr).split('-');
    if (parts.length === 3) {
      const d = new Date(+parts[0], +parts[1] - 1, +parts[2], 12, 0, 0);
      return d.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Africa/Brazzaville'
      });
    }
    const d = new Date(isoStr);
    return isNaN(d.getTime()) ? String(isoStr) : d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Africa/Brazzaville'
    });
  },

  /**
   * Fonction universelle A1 : "Donnée vide = rien d'affiché"
   * Produit les données affichables pour Aperçu, PDF, Excel, CSV et WhatsApp.
   */
  buildDocumentView: function (docOrData, state) {
    const self = this;
    const raw = docOrData || {};
    const st = state || (window.KivoApp && window.KivoApp.state) || {};
    const biz = (st && st.business) || raw.biz || {};

    const clean = (s) => self.cleanText(s);
    const fmtPhone = (p) => self.formatPhoneNumber(p);
    const fmtDate = (d) => self.formatDocDate(d);

    // 1. Émetteur
    const rawBiz = raw.biz || biz || {};
    const bizName = (rawBiz.name || rawBiz.company_name || rawBiz.owner || 'Mon Entreprise').trim();
    const bizOwner = (rawBiz.owner || '').trim();
    const bizAddress = clean(rawBiz.address);
    const bizPhone = fmtPhone(rawBiz.phone);
    const bizEmail = clean(rawBiz.email);
    const bizWebsite = clean(rawBiz.website);
    const bizRccm = clean(rawBiz.rccm || (st.business && st.business.rccm));
    const bizNiu = clean(rawBiz.niu || (st.business && st.business.niu));
    const bizTaxId = clean(rawBiz.taxId || rawBiz.fiscal_id || (st.business && st.business.taxId));
    const bizLegal = clean(rawBiz.legal || (st.business && st.business.legal));

    // 2. Client
    let rawClient = raw.client || {};
    if (!rawClient.name && raw.clientName) {
      rawClient = {
        name: raw.clientName,
        company: raw.clientCompany || '',
        phone: raw.clientPhone || '',
        email: raw.clientEmail || '',
        address: raw.clientAddress || '',
        taxId: raw.clientTaxId || ''
      };
    }
    const clientName = clean(rawClient.name || raw.clientName) || 'Client Destinataire';
    const clientCompany = clean(rawClient.company);
    const clientAddress = clean(rawClient.address);
    const clientPhone = fmtPhone(rawClient.phone);
    const clientEmail = clean(rawClient.email);
    const clientTaxId = clean(rawClient.taxId || raw.clientTaxId);
    const clientHasContact = !!(clientEmail || clientPhone);

    // 3. Dates & Statut
    const issueDateIso = clean(raw.issueDate || raw.date || raw.date_issued) || new Date().toISOString().slice(0, 10);
    const dueDateIso = clean(raw.dueDate || raw.due_date);
    const issueDateFormatted = fmtDate(issueDateIso);
    const dueDateFormatted = dueDateIso ? fmtDate(dueDateIso) : null;

    const STATUS_MAP = {
      draft: 'Brouillon', brouillon: 'Brouillon',
      sent: 'Envoyée', 'envoyée': 'Envoyée',
      paid: 'Payée', 'payée': 'Payée',
      overdue: 'En retard', 'en retard': 'En retard',
      cancelled: 'Annulée', 'annulée': 'Annulée',
      refunded: 'Remboursée', 'remboursée': 'Remboursée'
    };
    const statusKey = String(raw.status || 'draft').toLowerCase().trim();
    const statusLabel = STATUS_MAP[statusKey] || 'Brouillon';

    // 4. Numéro & Type
    const isQuote = raw.docType === 'quote' || raw.type === 'quote' || raw.type === 'devis';
    const docType = isQuote ? 'quote' : 'invoice';
    const docTypeLabel = isQuote ? 'Devis' : 'Facture';
    const docNum = clean(raw.docNum || raw.number) || (isQuote ? 'DEV-2026-0001' : 'FAC-2026-0001');
    const currency = clean(raw.currency) || rawBiz.currency || 'FCFA';

    // 5. Items
    let rawItems = [];
    if (Array.isArray(raw.items)) rawItems = raw.items;
    else if (typeof raw.items === 'string') {
      try { rawItems = JSON.parse(raw.items); } catch (_) { rawItems = []; }
    }
    const items = rawItems.map((it, idx) => {
      const qty = Number(it.quantity || it.qty) || 1;
      const price = Number(it.price || it.unit_price) || 0;
      const taxRate = Number(it.taxRate || it.tax_rate) || 0;
      const discount = Number(it.discount) || 0;
      let lineHT = Number(it.totalHT);
      if (isNaN(lineHT)) {
        lineHT = qty * price;
        if (discount > 0) lineHT = Math.max(0, lineHT - (lineHT * (discount / 100)));
      }
      const lineTax = lineHT * (taxRate / 100);
      return {
        num: idx + 1,
        description: clean(it.name || it.description) || 'Article',
        quantity: qty,
        unit: clean(it.unit) || '',
        price: price,
        taxRate: taxRate,
        discount: discount,
        totalHT: lineHT,
        totalTTC: lineHT + lineTax
      };
    });

    // 6. Totaux
    const subtotal = Number(raw.subtotal !== undefined ? raw.subtotal : (raw.totalHT || items.reduce((s, i) => s + i.totalHT, 0))) || 0;
    const rawDisc = Number(raw.discount !== undefined ? raw.discount : (raw.globalDiscount || 0)) || 0;
    const discountVal = rawDisc > 0 ? rawDisc : null;
    const rawTax = Number(raw.taxAmount !== undefined ? raw.taxAmount : (raw.totalTax || 0)) || 0;
    const taxAmountVal = rawTax > 0 ? rawTax : null;
    const grandTotal = Number(raw.grandTotal !== undefined ? raw.grandTotal : (raw.total || 0)) || (subtotal - (discountVal || 0) + (taxAmountVal || 0));
    const rawDep = Number(raw.deposit !== undefined ? raw.deposit : (raw.depositAmount || 0)) || 0;
    const depositVal = rawDep > 0 ? rawDep : null;
    const balanceDue = Number(raw.balanceDue !== undefined ? raw.balanceDue : (grandTotal - (depositVal || 0))) || 0;

    // 7. Conditions de règlement (A3)
    let terms = clean(raw.terms);
    if (terms === 'Net 7 jours' || terms === 'À réception') {
      if (issueDateIso && dueDateIso && issueDateIso !== dueDateIso) {
        if (terms === 'Net 7 jours') terms = null;
      }
    }

    // 8. Moyens de paiement (A2)
    let paymentMethods = [];
    const showPayment = raw.showPaymentMethods !== false;
    let selectedKeys = [];
    if (Array.isArray(raw.selectedPaymentMethods)) {
      selectedKeys = raw.selectedPaymentMethods;
    } else if (Array.isArray(raw.selectedPaymentMethodIds)) {
      selectedKeys = raw.selectedPaymentMethodIds;
    }

    const pConfig = raw.paymentConfig || (window.KivoApp && typeof window.KivoApp.getPaymentConfig === 'function' ? window.KivoApp.getPaymentConfig() : null) || (rawBiz && rawBiz.paymentConfig) || {};

    if (showPayment && selectedKeys.length > 0) {
      selectedKeys.forEach(k => {
        if (k === 'bank' && pConfig.bank) {
          const b = pConfig.bank;
          let bankName = clean(b.bankName);
          let accountHolder = clean(b.accountHolder);
          const accountNumber = clean(b.accountNumber);
          const iban = clean(b.iban);
          const swift = clean(b.swift || b.bic);

          // Correction bug : si bankName est identique au propriétaire ou au titulaire,
          // ne jamais l'afficher sous "Banque" !
          if (bankName && (bankName === bizOwner || bankName === bizName || bankName === accountHolder)) {
            if (!accountHolder) accountHolder = bankName;
            bankName = null;
          }

          // Migration A2 : si moyen virement mais aucune coordonnée, ignorer
          const hasCoords = !!(bankName || accountNumber || iban || swift);
          if (hasCoords) {
            const fields = [];
            if (bankName) fields.push({ label: 'Banque', value: bankName });
            if (accountHolder) fields.push({ label: 'Titulaire du compte', value: accountHolder });
            if (accountNumber && accountNumber !== iban) fields.push({ label: 'Numéro de compte', value: accountNumber });
            if (iban) fields.push({ label: 'IBAN / N° de compte', value: iban });
            if (swift) fields.push({ label: 'BIC', value: swift });
            paymentMethods.push({
              type: 'bank',
              title: 'Virement bancaire',
              icon: '💳',
              fields: fields
            });
          }
        } else if (k === 'momo' || k.startsWith('momo')) {
          const accounts = (pConfig.momo && Array.isArray(pConfig.momo.accounts)) ? pConfig.momo.accounts : [];
          accounts.forEach(m => {
            const phone = fmtPhone(m.phone);
            const op = clean(m.operator) || 'Wave';
            const holder = clean(m.holder);
            if (phone || holder) {
              const fields = [];
              fields.push({ label: 'Opérateur', value: op });
              if (holder) fields.push({ label: 'Titulaire', value: holder });
              if (phone) fields.push({ label: 'Numéro', value: phone });
              paymentMethods.push({
                type: 'momo',
                title: `Mobile Money (${op})`,
                icon: '📱',
                fields: fields
              });
            }
          });
        } else if (k === 'cash' && pConfig.cash) {
          paymentMethods.push({
            type: 'cash',
            title: 'Espèces',
            icon: '💵',
            fields: [{ label: 'Mention', value: 'Paiement en espèces' }]
          });
        } else if (k === 'check' && pConfig.check) {
          const chk = pConfig.check;
          const payable = clean(chk.payableTo);
          const addr = clean(chk.address);
          if (payable || addr) {
            const fields = [];
            if (payable) fields.push({ label: 'À l\'ordre de', value: payable });
            if (addr) fields.push({ label: 'Adresse d\'envoi', value: addr });
            paymentMethods.push({
              type: 'check',
              title: 'Chèque',
              icon: '📝',
              fields: fields
            });
          }
        } else if (k === 'card' && pConfig.card) {
          const crd = pConfig.card;
          const prov = clean(crd.provider) || 'Paiement en ligne';
          const url = clean(crd.paymentUrl);
          const fields = [{ label: 'Fournisseur', value: prov }];
          if (url) fields.push({ label: 'Lien', value: url });
          paymentMethods.push({
            type: 'card',
            title: 'Carte bancaire / Paiement en ligne',
            icon: '🌐',
            fields: fields
          });
        }
      });
    }

    return {
      issuer: {
        name: bizName,
        owner: bizOwner,
        address: bizAddress,
        phone: bizPhone,
        email: bizEmail,
        website: bizWebsite,
        rccm: bizRccm,
        niu: bizNiu,
        taxId: bizTaxId,
        legal: bizLegal,
        logoUrl: rawBiz.logoUrl || null,
        logoSize: rawBiz.logoSize || 70,
        logoPosition: rawBiz.logoPosition || 'right'
      },
      client: {
        name: clientName,
        company: clientCompany,
        address: clientAddress,
        phone: clientPhone,
        email: clientEmail,
        taxId: clientTaxId,
        hasContact: clientHasContact
      },
      doc: {
        type: docType,
        typeLabel: docTypeLabel,
        num: docNum,
        issueDate: issueDateIso,
        issueDateFormatted: issueDateFormatted,
        dueDate: dueDateIso,
        dueDateFormatted: dueDateFormatted,
        status: statusKey,
        statusLabel: statusLabel,
        terms: terms,
        subject: clean(raw.subject),
        notes: clean(raw.notes),
        thankYouText: clean(raw.thankYouText),
        legalNotices: clean(raw.legalNotices),
        primaryColor: raw.primaryColor || '#4F46E5',
        secondaryColor: raw.secondaryColor || '#64748B',
        bgColor: raw.bgColor || '#FFFFFF'
      },
      items: items,
      totals: {
        currency: currency,
        subtotal: subtotal,
        discount: discountVal,
        taxAmount: taxAmountVal,
        grandTotal: grandTotal,
        deposit: depositVal,
        balanceDue: balanceDue
      },
      payment: {
        methods: paymentMethods,
        hasPayment: paymentMethods.length > 0
      },
      // Rétrocompatibilité avec les renderers existants
      biz: Object.assign({}, rawBiz, {
        name: bizName,
        owner: bizOwner,
        address: bizAddress,
        phone: bizPhone,
        email: bizEmail,
        rccm: bizRccm,
        niu: bizNiu,
        taxId: bizTaxId
      }),
      currency: currency,
      subtotal: subtotal,
      discount: discountVal || 0,
      showDiscount: discountVal !== null && discountVal > 0,
      taxAmount: taxAmountVal || 0,
      showVat: taxAmountVal !== null && taxAmountVal > 0,
      grandTotal: grandTotal,
      deposit: depositVal || 0,
      showDeposit: depositVal !== null && depositVal > 0,
      balanceDue: balanceDue,
      issueDate: issueDateIso,
      dueDate: dueDateIso,
      issueDateFormatted: issueDateFormatted,
      dueDateFormatted: dueDateFormatted,
      docNum: docNum,
      docType: docType,
      status: statusKey,
      statusLabel: statusLabel,
      terms: terms,
      subject: clean(raw.subject),
      notes: clean(raw.notes),
      thankYouText: clean(raw.thankYouText),
      legalNotices: clean(raw.legalNotices),
      primaryColor: raw.primaryColor || '#4F46E5',
      secondaryColor: raw.secondaryColor || '#64748B',
      bgColor: raw.bgColor || '#FFFFFF',
      paymentMethods: paymentMethods,
      showPaymentMethods: paymentMethods.length > 0
    };
  },

  // ── Helpers ──────────────────────────────────────────────────────────

  fmt: function (n, currency) {
    return (n || 0).toLocaleString('fr-FR') + ' ' + (currency || 'FCFA');
  },

  logoHtml: function (biz, defaultSize, shape, fallbackDark = false) {
    if (!biz || !biz.logoUrl) return '';
    const szVal = (biz && biz.logoSize) ? biz.logoSize : (defaultSize || 70);
    const sz = typeof szVal === 'number' ? `${szVal}px` : szVal;
    const br = shape === 'circle' ? '50%' : (shape === 'none' ? '0' : '6px');
    // Point 3 fix: NO background box behind the logo — zero carré, zero fond coloré.
    // The logo renders transparently on whatever template background it sits on.
    // A subtle drop-shadow ensures visibility on both dark and light templates.
    const shadow = fallbackDark
      ? 'drop-shadow(0 1px 3px rgba(0,0,0,0.55))'   // dark header → stronger shadow
      : 'drop-shadow(0 1px 4px rgba(0,0,0,0.25))';   // light header → soft shadow
    return `<span style="display:inline-flex;align-items:center;justify-content:center;border-radius:${br};">
      <img src="${biz.logoUrl}" style="max-height:${sz};max-width:220px;height:auto;object-fit:contain;border-radius:${br};display:block;filter:${shadow};" alt="Logo">
    </span>`;
  },


  // ── Colgroup HTML (colonnes fixes pour table-layout:fixed) ────────────
  tableColgroup: function () {
    // Ordre colonnes : Description (flex), Quantité 70px, Prix 120px, TVA 70px, Total 130px
    return `<colgroup>
      <col style="width:auto;min-width:120px;">
      <col style="width:70px;">
      <col style="width:120px;">
      <col style="width:70px;">
      <col style="width:130px;">
    </colgroup>`;
  },

  // ── Nettoyage description multilignes ─────────────────────────────────
  cleanDesc: function (str) {
    if (!str) return '';
    return str
      .trim()
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')     // au plus 2 sauts consécutifs
      .replace(/\n\n/g, '\n')          // puis normalise en 1 saut
      .replace(/\n/g, '<br>');
  },

  rows: function (items, currency, accBg, isDark = false, d = {}) {
    let list = items;
    if (list && typeof list === 'object' && !Array.isArray(list) && Array.isArray(list.lines)) {
      list = list.lines;
    } else if (typeof list === 'string') {
      try {
        const parsed = JSON.parse(list);
        list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.lines) ? parsed.lines : []);
      } catch (e) {
        list = [];
      }
    }
    if (!list || !Array.isArray(list) || list.length === 0) {
      return `<tr><td colspan="5" style="text-align:center;color:${isDark ? '#64748B' : '#94a3b8'};padding:14px;font-size:12px;">Aucun article saisi</td></tr>`;
    }
    const showVat = d.showVat !== false;
    // Filtrer les lignes sans désignation ET sans montant
    const filtered = list.filter(it => {
      const hasName = it.name && String(it.name).trim().length > 0;
      const hasAmount = Number(it.totalHT || it.total || it.price || 0) > 0;
      return hasName || hasAmount;
    });
    if (filtered.length === 0) {
      return `<tr><td colspan="5" style="text-align:center;color:${isDark ? '#64748B' : '#94a3b8'};padding:14px;font-size:12px;">Aucun article saisi</td></tr>`;
    }
    return filtered.map((it, i) => {
      const unitStr = it.unit ? `\u00a0<span style="font-size:11px;color:${isDark ? '#94A3B8' : '#64748B'};">${it.unit}</span>` : '';
      const discStr = (it.discount && Number(it.discount) > 0) ? `<div style="font-size:11px;color:#EF4444;font-weight:600;white-space:nowrap;">-${it.discount}%</div>` : '';
      const taxStr = showVat ? ((it.taxRate !== undefined && it.taxRate !== '') ? it.taxRate + '\u00a0%' : '-') : '-';
      const descHtml = this.cleanDesc(it.name || 'Article sans désignation');
      const rowBg = isDark ? (i % 2 === 0 ? '#1E222B' : '#181A20') : (i % 2 === 0 ? '#fff' : '#f8fafc');
      const border = `1px solid ${isDark ? '#2D323F' : '#f1f5f9'}`;
      return `
      <tr style="background:${rowBg};page-break-inside:avoid;break-inside:avoid;">
        <td style="padding:8px 12px;font-size:13px;vertical-align:top;border-bottom:${border};color:${isDark ? '#E2E8F0' : '#1E293B'};white-space:normal;overflow-wrap:anywhere;word-break:break-word;">
          <strong>${descHtml}</strong>
        </td>
        <td style="padding:8px 12px;font-size:13px;text-align:center;vertical-align:top;border-bottom:${border};color:${isDark ? '#94A3B8' : '#64748B'};white-space:nowrap;">${it.quantity}${unitStr}</td>
        <td style="padding:8px 12px;font-size:13px;text-align:right;vertical-align:top;border-bottom:${border};color:${isDark ? '#E2E8F0' : '#1E293B'};white-space:nowrap;">${this.fmt(it.price, currency)}${discStr}</td>
        <td style="padding:8px 12px;font-size:13px;text-align:center;vertical-align:top;border-bottom:${border};color:${isDark ? '#94A3B8' : '#64748B'};white-space:nowrap;">${taxStr}</td>
        <td style="padding:8px 12px;font-size:13px;text-align:right;vertical-align:top;font-weight:700;border-bottom:${border};${accBg ? 'background:' + accBg + ';' : ''}color:${isDark ? '#F5D0B5' : '#0F172A'};white-space:nowrap;">${this.fmt(it.totalHT || it.total, currency)}</td>
      </tr>`;
    }).join('');
  },

  collectData: function (state) {
    const biz = (state && state.business) || {};
    const get = id => { const el = document.getElementById(id); return el ? el.value : ''; };
    const getChecked = id => { const el = document.getElementById(id); return el ? el.checked : true; };

    // Capture live logo from preview element or state — with explicit deletion check
    const isLogoRemoved = window.KivoApp && window.KivoApp._invoiceLogoRemoved;
    const showLogo = getChecked('builder-toggle-logo');
    const logoImg = document.getElementById('builder-logo-preview-img');
    const previewBox = document.getElementById('builder-logo-preview-box');
    let liveLogoUrl = '';
    if (!isLogoRemoved && showLogo) {
      if (logoImg && logoImg.src && previewBox && previewBox.style.display !== 'none' && !logoImg.src.endsWith('/')) {
        liveLogoUrl = logoImg.src;
      } else if (window.KivoApp && window.KivoApp.builderCustomLogoUrl) {
        liveLogoUrl = window.KivoApp.builderCustomLogoUrl;
      } else if (biz.logoUrl) {
        liveLogoUrl = biz.logoUrl;
      }
    }
    
    // Logo size & position
    const sizeInput = document.getElementById('builder-logo-size');
    const posSelect = document.getElementById('builder-logo-position');
    const liveLogoSize = sizeInput ? parseInt(sizeInput.value) : (biz.logoSize || 70);
    const liveLogoPos  = posSelect ? posSelect.value : (biz.logoPosition || 'right');

    const activeBiz = Object.assign({}, biz, {
      name:         get('builder-biz-name')    || biz.name    || biz.owner || 'Mon Entreprise',
      address:      get('builder-biz-address') || biz.address || '',
      phone:        get('builder-biz-phone')   || biz.phone   || '',
      email:        get('builder-biz-email')   || biz.email   || '',
      legal:        get('builder-biz-legal')   || '',
      logoUrl:      liveLogoUrl,
      logoSize:     liveLogoSize,
      logoPosition: liveLogoPos
    });

    const clientId = get('builder-doc-client-select');
    const clientFound = (state && state.clients) ? (state.clients.find(c => String(c.id) === String(clientId)) || {}) : {};

    const items = [];
    let subtotal = 0;
    let totalTaxAmount = 0;
    const showVat = getChecked('builder-toggle-vat');

    // Read ALL rows/cards in the items container
    const itemRows = document.querySelectorAll('#builder-items-tbody .builder-item-card, #builder-items-tbody tr');
    itemRows.forEach(tr => {
      const nameInput = tr.querySelector('.item-name');
      const qtyInput  = tr.querySelector('.item-qty');
      const unitInput = tr.querySelector('.item-unit');
      const priceInput= tr.querySelector('.item-price');
      const taxInput  = tr.querySelector('.item-tax');
      const discInput = tr.querySelector('.item-discount');

      const name  = nameInput ? nameInput.value.trim() : '';
      const qty   = qtyInput ? (parseFloat(qtyInput.value) || 1) : 1;
      const unit  = unitInput ? unitInput.value.trim() : '';
      const price = priceInput ? (parseFloat(priceInput.value) || 0) : 0;
      const taxRate = (showVat && taxInput) ? (parseFloat(taxInput.value) || 0) : 0;
      const rowDiscount = discInput ? (parseFloat(discInput.value) || 0) : 0;

      if (name || price > 0) {
        let itemTotal = qty * price;
        if (rowDiscount > 0) {
          itemTotal = Math.max(0, itemTotal - (itemTotal * (rowDiscount / 100)));
        }
        const itemTax = showVat ? itemTotal * (taxRate / 100) : 0;

        subtotal += itemTotal;
        totalTaxAmount += itemTax;

        items.push({
          name: name || 'Article',
          quantity: qty,
          unit: unit,
          price: price,
          taxRate: taxRate,
          discount: rowDiscount,
          totalHT: itemTotal,
          total: itemTotal + itemTax
        });
      }
    });

    // Discount calculations
    const showDiscount = getChecked('builder-toggle-discount');
    const discountVal  = parseFloat(get('builder-discount-value')) || 0;
    const discountType = get('builder-discount-type') || 'amount';
    let discount = 0;
    if (showDiscount && discountVal > 0) {
      if (discountType === 'percent') {
        discount = subtotal * (discountVal / 100);
      } else {
        discount = discountVal;
      }
    }
    discount = Math.min(discount, subtotal);

    // Deposit calculations
    const showDeposit = getChecked('builder-toggle-deposit');
    const deposit = showDeposit ? (parseFloat(get('builder-deposit-amount')) || 0) : 0;

    const taxable    = Math.max(0, subtotal - discount);
    const grandTotal = Math.max(0, taxable + (showVat ? totalTaxAmount : 0));
    const balanceDue = Math.max(0, grandTotal - deposit);
    const currency   = get('builder-doc-currency') || biz.currency || 'FCFA';

    return {
      biz: activeBiz,
      docTitleText:   get('builder-doc-title-text')  || '',
      docType:        get('builder-doc-type')        || 'invoice',
      docNum:         get('builder-doc-number')      || '',
      issueDate:      get('builder-issue-date')      || new Date().toISOString().split('T')[0],
      dueDate:        get('builder-due-date')        || '',
      status:         get('builder-doc-status')      || 'draft',
      subject:        get('builder-doc-subject')     || '',
      showSubject:    getChecked('builder-toggle-subject'),
      showLogo:       showLogo,
      client: {
        name:    get('builder-client-name')    || clientFound.name    || clientFound.company || '',
        company: clientFound.company           || '',
        phone:   get('builder-client-phone')   || clientFound.phone   || '',
        email:   get('builder-client-email')   || clientFound.email   || '',
        address: get('builder-client-address') || clientFound.address || '',
        taxId:   get('builder-client-taxid')   || clientFound.taxId   || '',
        legalFieldName: clientFound.legalFieldName || ''
      },
      colDesc:     get('builder-col-desc')     || 'Description',
      colQty:      get('builder-col-qty')      || 'Quantité',
      colUnit:     get('builder-col-unit')     || 'Unité',
      colPrice:    get('builder-col-price')    || 'Prix Unitaire',
      colTax:      get('builder-col-tax')      || 'TVA',
      colDiscount: get('builder-col-discount') || 'Remise',
      colTotal:    get('builder-col-total')    || 'Total HT',
      lblSubtotal: get('builder-lbl-subtotal') || 'Sous-total HT',
      lblTax:      get('builder-lbl-tax')      || 'TVA',
      lblTotal:    get('builder-lbl-total')    || 'Total TTC',
      lblDeposit:  get('builder-lbl-deposit')  || 'Acompte déjà versé',
      lblBalance:  get('builder-lbl-balance')  || 'Solde net à payer',
      items, subtotal, discount, showDiscount, showVat,
      taxAmount: showVat ? totalTaxAmount : 0,
      grandTotal, deposit, showDeposit, balanceDue, currency,
      terms:               get('builder-terms')                  || '',
      paymentMethod:       get('builder-payment-method')         || '',
      paymentDetails:      get('builder-payment-details')        || '',
      showPaymentMethods:  getChecked('builder-toggle-payment-methods'),
      selectedPaymentMethods: (window.KivoApp && typeof window.KivoApp.getSelectedPaymentMethodsFromBuilder === 'function')
        ? window.KivoApp.getSelectedPaymentMethodsFromBuilder()
        : [],
      paymentConfig: (window.KivoApp && typeof window.KivoApp.getPaymentConfig === 'function')
        ? window.KivoApp.getPaymentConfig()
        : (biz.paymentConfig || null),
      notes:               get('builder-notes')                  || '',
      showNotes:           getChecked('builder-toggle-notes'),
      thankYouText:        get('builder-thankyou')               || '',
      showThankYou:        getChecked('builder-toggle-thankyou'),
      legalNotices:        get('builder-legal-notices')          || '',
      showLegalNotices:    getChecked('builder-toggle-legal'),
      primaryColor: (() => {
        const c = (document.getElementById('builder-color-primary') || {}).value || biz.primaryColor;
        return (!c || c === '#000000' || c === '#000') ? '#4F46E5' : c;
      })(),
      secondaryColor: (() => {
        const c = (document.getElementById('builder-color-secondary') || {}).value || biz.secondaryColor;
        return (!c || c === '#000000' || c === '#000') ? '#64748B' : c;
      })(),
      bgColor: (() => {
        const c = (document.getElementById('builder-color-bg') || {}).value || biz.docBgColor || '#FFFFFF';
        return (!c || c === '#000000' || c === '#000') ? '#FFFFFF' : c;
      })(),
      lang: (window.KivoApp && KivoApp.state && KivoApp.state.language) || 'fr',
    };
  },

  // ── Header Renderer Helper (Supports Logo Left, Center, Right) ─────────
  renderHeader: function (d, titleColor, subtitleColor, isDark = false) {
    const _t = (key) => (window.KivoI18n ? KivoI18n.t(key, d.lang || 'fr') : key);
    const defaultLbl = d.docType === 'quote' ? _t('doc_quote') : _t('doc_invoice');
    const lbl = (d.docTitleText && d.docTitleText.trim()) ? d.docTitleText.trim() : defaultLbl;
    const pos = (d.biz && d.biz.logoPosition) || 'right';
    const showLogo = d.showLogo !== false;
    const logo = showLogo ? this.logoHtml(d.biz, 70, 'square', isDark) : '';
    const bizDisplayName = (d.biz && d.biz.name) ? d.biz.name : ((d.biz && d.biz.owner) || 'Mon Entreprise');
    const textMuted = isDark ? '#94A3B8' : '#6B7280';
    const docAccent = d.primaryColor || (isDark ? '#F5D0B5' : '#4F46E5');
    const bizLegal = (d.biz && d.biz.legal) ? `<div style="font-size:11px;color:${textMuted};margin-top:2px;">${d.biz.legal}</div>` : '';
    const subjectHtml = (d.showSubject !== false && d.subject && d.subject.trim())
      ? `<div style="margin-top:10px;font-size:13px;font-weight:700;color:${titleColor};background:${isDark ? '#232733' : '#F1F5F9'};padding:4px 10px;border-radius:4px;display:inline-block;"><span style="color:${textMuted};font-weight:500;">Objet :</span> ${d.subject.trim()}</div>`
      : '';

    const paidBadge = (d.status === 'paid' && d.docType !== 'quote') ? `
      <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 14px;background:#ECFDF5;border:1.5px solid #10B981;border-radius:20px;font-size:11px;font-weight:800;color:#047857;letter-spacing:0.04em;text-transform:uppercase;margin-top:6px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="display:inline-block;"><polyline points="20 6 9 17 4 12"/></svg>
        ${_t('doc_paid_badge')}
      </div>` : (d.status === 'refunded' ? `
      <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 14px;background:#FEF2F2;border:1.5px solid #EF4444;border-radius:20px;font-size:11px;font-weight:800;color:#B91C1C;letter-spacing:0.04em;text-transform:uppercase;margin-top:6px;">
        ${_t('doc_refunded_badge')}
      </div>` : '');

    const issueDateStr = d.issueDateFormatted || this.formatDocDate(d.issueDate);
    const dueDateStr = d.dueDateFormatted || (d.dueDate ? this.formatDocDate(d.dueDate) : '');
    const bizPhoneFmt = d.biz && d.biz.phone ? (this.formatPhoneNumber(d.biz.phone) || d.biz.phone) : '';

    if (pos === 'left') {
      return `
        <div style="margin-bottom:24px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div style="display:flex;align-items:flex-start;gap:16px;">
              ${logo}
              <div>
                <div style="font-size:15px;font-weight:700;color:${titleColor};">${bizDisplayName}</div>
                <div style="font-size:12px;font-weight:400;color:${textMuted};line-height:1.5;margin-top:3px;">
                  ${d.biz && d.biz.address ? d.biz.address + '<br>' : ''}
                  ${bizPhoneFmt ? 'Tél. : ' + bizPhoneFmt + '<br>' : ''}
                  ${(d.biz && d.biz.email) ? d.biz.email + '<br>' : ''}
                  ${bizLegal}
                </div>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:28px;font-weight:700;color:${titleColor};letter-spacing:0.5px;">${lbl}</div>
              <div style="font-size:16px;font-weight:700;color:${docAccent};margin-top:3px;">${d.docNum}</div>
              ${paidBadge ? `<div style="margin-top:3px;">${paidBadge}</div>` : ''}
              <div style="font-size:12px;font-weight:400;color:${textMuted};margin-top:5px;">${_t('doc_issue_date_label')} <strong style="color:${titleColor};font-weight:700;">${issueDateStr}</strong></div>
              ${dueDateStr ? `<div style="font-size:12px;font-weight:400;color:${textMuted};">${_t('doc_due_date_label')} <strong style="color:${titleColor};font-weight:700;">${dueDateStr}</strong></div>` : ''}
            </div>
          </div>
          ${subjectHtml}
        </div>
      `;
    }

    if (pos === 'center') {
      return `
        <div style="text-align:center;margin-bottom:24px;border-bottom:1px solid ${isDark ? '#2D323F' : '#E2E8F0'};padding-bottom:18px;">
          ${logo ? `<div style="margin-bottom:10px;">${logo}</div>` : ''}
          <div style="font-size:28px;font-weight:700;color:${titleColor};letter-spacing:0.5px;">${lbl}</div>
          <div style="font-size:16px;font-weight:700;color:${docAccent};margin-top:2px;">${d.docNum}</div>
          ${paidBadge ? `<div style="margin:4px 0;">${paidBadge}</div>` : ''}
          <div style="font-size:15px;font-weight:700;color:${titleColor};margin-top:4px;">${bizDisplayName}</div>
          <div style="font-size:12px;font-weight:400;color:${textMuted};margin-top:3px;">
            ${[d.biz && d.biz.address, bizPhoneFmt, d.biz && d.biz.email].filter(Boolean).join(' · ')}
            ${bizLegal}
          </div>
          <div style="font-size:12px;font-weight:400;color:${textMuted};margin-top:5px;">
            ${_t('doc_issue_date_label')} <strong style="color:${titleColor};font-weight:700;">${issueDateStr}</strong> ${dueDateStr ? `· ${_t('doc_due_date_label')} <strong style="color:${titleColor};font-weight:700;">${dueDateStr}</strong>` : ''}
          </div>
          ${subjectHtml}
        </div>
      `;
    }

    // Default: 'right' (Matches reference image)
    return `
      <div style="margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-size:28px;font-weight:700;color:${titleColor};letter-spacing:0.5px;margin-bottom:4px;">${lbl}</div>
            <div style="font-size:15px;font-weight:700;color:${titleColor};">${bizDisplayName}</div>
            <div style="font-size:12px;font-weight:400;color:${textMuted};line-height:1.5;margin-top:3px;">
              ${d.biz && d.biz.address ? d.biz.address + '<br>' : ''}
              ${bizPhoneFmt ? 'Tél. : ' + bizPhoneFmt + '<br>' : ''}
              ${(d.biz && d.biz.email) ? d.biz.email + '<br>' : ''}
              ${bizLegal}
            </div>
          </div>
          <div style="text-align:right;">
            ${logo ? `<div style="display:flex;justify-content:flex-end;margin-bottom:10px;">${logo}</div>` : ''}
            <div style="font-size:16px;font-weight:700;color:${docAccent};">${d.docNum}</div>
            ${paidBadge ? `<div style="margin-top:3px;">${paidBadge}</div>` : ''}
            <div style="font-size:12px;font-weight:400;color:${textMuted};margin-top:5px;">${_t('doc_issue_date_label')} <strong style="color:${titleColor};font-weight:700;">${issueDateStr}</strong></div>
            ${dueDateStr ? `<div style="font-size:12px;font-weight:400;color:${textMuted};">${_t('doc_due_date_label')} <strong style="color:${titleColor};font-weight:700;">${dueDateStr}</strong></div>` : ''}
          </div>
        </div>
        ${subjectHtml}
      </div>
    `;
  },

  // ── Client Box Renderer Helper ────────────────────────────────────────
  renderClient: function (d, titleColor, subtitleColor, isDark = false) {
    const _t = (key) => (window.KivoI18n ? KivoI18n.t(key, d.lang || 'fr') : key);
    const hasClient = d.client && d.client.name;
    const secColor = d.secondaryColor || (isDark ? '#94A3B8' : '#64748B');
    const borderStyle = isDark ? '#2D323F' : (d.secondaryColor || '#E2E8F0');
    const textMuted = isDark ? '#94A3B8' : '#6B7280';
    const taxIdVal = (d.client && (d.client.taxId || d.clientTaxId));
    const phoneVal = (d.client && d.client.phone) ? (this.formatPhoneNumber(d.client.phone) || d.client.phone) : '';
    const emailVal = (d.client && d.client.email && d.client.email !== '--' && d.client.email !== '-') ? d.client.email : '';
    const hasContact = !!(phoneVal || emailVal);

    if (!hasContact) {
      // Pleine largeur si aucun contact (pas de colonne CONTACT vide et aucun "--")
      return `
        <div style="margin-bottom:20px;background:${isDark ? '#222631' : '#F8FAFC'};padding:14px 18px;border-radius:8px;border:1px solid ${borderStyle};border-left:3px solid ${secColor};">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${textMuted};">${_t('doc_billed_to')}</div>
          <div style="font-size:14px;font-weight:700;color:${titleColor};margin-top:3px;">${hasClient ? d.client.name : '<span style="font-size:12px;font-weight:400;color:' + textMuted + ';font-style:italic;">' + _t('doc_select_client') + '</span>'}</div>
          ${(d.client && (d.client.address || taxIdVal)) ? `
          <div style="font-size:12px;font-weight:400;color:${textMuted};line-height:1.4;margin-top:3px;">
            ${d.client.address ? d.client.address + '<br>' : ''}
            ${taxIdVal ? '<span style="font-weight:600;">N° Fiscal / Registre :</span> ' + taxIdVal : ''}
          </div>` : ''}
        </div>
      `;
    }

    return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;background:${isDark ? '#222631' : '#F8FAFC'};padding:14px 18px;border-radius:8px;border:1px solid ${borderStyle};border-left:3px solid ${secColor};">
        <div>
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${textMuted};">${_t('doc_billed_to')}</div>
          <div style="font-size:14px;font-weight:700;color:${titleColor};margin-top:3px;">${hasClient ? d.client.name : '<span style="font-size:12px;font-weight:400;color:' + textMuted + ';font-style:italic;">' + _t('doc_select_client') + '</span>'}</div>
          ${(d.client && (d.client.address || taxIdVal)) ? `
          <div style="font-size:12px;font-weight:400;color:${textMuted};line-height:1.4;margin-top:3px;">
            ${d.client.address ? d.client.address + '<br>' : ''}
            ${taxIdVal ? '<span style="font-weight:600;">N° Fiscal / Registre :</span> ' + taxIdVal : ''}
          </div>` : ''}
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${textMuted};">${_t('doc_contact')}</div>
          <div style="font-size:12px;font-weight:400;color:${textMuted};margin-top:3px;line-height:1.4;">
            ${emailVal ? `<div>${emailVal}</div>` : ''}
            ${phoneVal ? `<div>${phoneVal}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  },

  getLegalLabel: function (biz) {
    if (!biz) return 'N° d\'enregistrement / Identifiant fiscal';
    const c = (biz.country || '').toUpperCase();
    if (c === 'CG') return 'RCCM / NIU';
    if (c === 'CD') return 'RCCM / Id. Nat. / NIF';
    if (c === 'SN') return 'NINEA';
    if (c === 'FR') return 'SIRET';
    if (c === 'CI') return 'RCCM';
    return (biz.legalFieldName && biz.legalFieldName !== 'N° Fiscal') ? biz.legalFieldName : 'N° d\'enregistrement / Identifiant fiscal';
  },

  // ── Conditional Payment Section Renderer (A1 & A2) ─────────────────────
  renderPaymentSection: function (d, ac, isDark = false) {
    if (d.showPaymentMethods === false) return '';

    const _t = (key) => (window.KivoI18n ? KivoI18n.t(key, d.lang || 'fr') : key);
    const titleColor = isDark ? '#E2E8F0' : '#0F172A';
    const valColor = isDark ? '#E2E8F0' : '#1E293B';
    const borderColor = isDark ? '#2D323F' : '#E2E8F0';

    // 1. Si une liste normalisée de moyens existe (buildDocumentView)
    if (d.payment && Array.isArray(d.payment.methods)) {
      if (d.payment.methods.length === 0) return '';
      const blocks = d.payment.methods.map(m => `
        <div style="margin-top:8px;padding-top:8px;border-top:1px dashed ${borderColor};">
          <div style="font-weight:700;font-size:12.5px;color:${titleColor};margin-bottom:3px;display:flex;align-items:center;gap:6px;">
            <span>${m.icon || '💳'}</span> <span>${m.title}</span>
          </div>
          <div style="font-size:12.5px;line-height:1.55;color:${valColor};">
            ${m.fields.map(f => `<div><strong>${f.label} :</strong> ${f.value}</div>`).join('')}
          </div>
        </div>
      `);

      const termsHtml = (d.terms && d.terms.trim()) ? `
        <div style="font-size:12.5px;color:${valColor};margin-bottom:6px;">
          <strong>${_t('doc_terms')} :</strong> ${d.terms}
        </div>` : '';

      return `
        <div>
          <strong style="color:${titleColor};display:block;margin-bottom:4px;font-size:13px;font-weight:700;">${_t('doc_payment_title')}</strong>
          ${termsHtml}
          ${blocks.join('')}
        </div>
      `;
    }

    // 2. Sinon, extraction directe depuis les données du document
    const cfg = d.paymentConfig || (d.biz && d.biz.paymentConfig) || (window.KivoApp && typeof window.KivoApp.getPaymentConfig === 'function' ? window.KivoApp.getPaymentConfig() : null);

    let selectedKeys = [];
    if (Array.isArray(d.selectedPaymentMethods) && d.selectedPaymentMethods.length > 0) {
      selectedKeys = d.selectedPaymentMethods.map(m => typeof m === 'string' ? m : (m.id || m.type || ''));
    } else if (d.selectedPaymentMethodIds && Array.isArray(d.selectedPaymentMethodIds)) {
      selectedKeys = d.selectedPaymentMethodIds;
    }
    selectedKeys = selectedKeys.filter(Boolean);

    const blocksHtml = [];

    if (selectedKeys.length > 0 && cfg) {
      const bizOwner = (d.biz && d.biz.owner) || '';
      const bizName = (d.biz && d.biz.name) || '';

      selectedKeys.forEach(key => {
        if (key === 'bank' && cfg.bank) {
          const b = cfg.bank;
          let bName = (b.bankName || '').trim();
          let bHolder = (b.accountHolder || '').trim();
          const bNum = (b.accountNumber || '').trim();
          const bIban = (b.iban || '').trim();
          const bSwift = (b.swift || b.bic || '').trim();

          // Éliminer nom de personne sous Banque
          if (bName && (bName === bizOwner || bName === bizName || bName === bHolder)) {
            if (!bHolder) bHolder = bName;
            bName = '';
          }

          if (bName || bNum || bIban || bSwift) {
            blocksHtml.push(`
              <div style="margin-top:8px;padding-top:8px;border-top:1px dashed ${borderColor};">
                <div style="font-weight:700;font-size:12.5px;color:${titleColor};margin-bottom:3px;display:flex;align-items:center;gap:6px;">
                  <span>💳</span> <span>Virement bancaire</span>
                </div>
                <div style="font-size:12.5px;line-height:1.55;color:${valColor};">
                  ${bName ? `<div><strong>Banque :</strong> ${bName}</div>` : ''}
                  ${bHolder ? `<div><strong>Titulaire du compte :</strong> ${bHolder}</div>` : ''}
                  ${(bNum && bNum !== bIban) ? `<div><strong>Numéro de compte :</strong> ${bNum}</div>` : ''}
                  ${bIban ? `<div><strong>RIB / IBAN :</strong> ${bIban}</div>` : ''}
                  ${bSwift ? `<div><strong>Code SWIFT / BIC :</strong> ${bSwift}</div>` : ''}
                </div>
              </div>
            `);
          }
        } else if (key.startsWith('momo') && cfg.momo && Array.isArray(cfg.momo.accounts)) {
          let momoList = key === 'momo' ? cfg.momo.accounts : [cfg.momo.accounts[parseInt(key.replace('momo_', ''), 10)]].filter(Boolean);
          momoList.forEach(m => {
            const phone = m && m.phone ? (this.formatPhoneNumber(m.phone) || m.phone) : '';
            if (phone || (m && m.holder)) {
              blocksHtml.push(`
                <div style="margin-top:8px;padding-top:8px;border-top:1px dashed ${borderColor};">
                  <div style="font-weight:700;font-size:12.5px;color:${titleColor};margin-bottom:3px;display:flex;align-items:center;gap:6px;">
                    <span>📱</span> <span>Mobile Money${m.operator ? ` (${m.operator})` : ''}</span>
                  </div>
                  <div style="font-size:12.5px;line-height:1.55;color:${valColor};">
                    ${m.operator ? `<div><strong>Opérateur :</strong> ${m.operator}</div>` : ''}
                    ${m.holder ? `<div><strong>Titulaire :</strong> ${m.holder}</div>` : ''}
                    ${phone ? `<div><strong>Numéro :</strong> ${phone}</div>` : ''}
                  </div>
                </div>
              `);
            }
          });
        } else if (key === 'cash' && cfg.cash) {
          blocksHtml.push(`
            <div style="margin-top:8px;padding-top:8px;border-top:1px dashed ${borderColor};">
              <div style="font-weight:700;font-size:12.5px;color:${titleColor};margin-bottom:3px;display:flex;align-items:center;gap:6px;">
                <span>💵</span> <span>Espèces</span>
              </div>
              <div style="font-size:12.5px;line-height:1.55;color:${valColor};font-style:italic;">
                Paiement en espèces à la livraison ou au comptoir
              </div>
            </div>
          `);
        } else if (key === 'check' && cfg.check) {
          const chk = cfg.check;
          if (chk.payableTo || chk.address) {
            blocksHtml.push(`
              <div style="margin-top:8px;padding-top:8px;border-top:1px dashed ${borderColor};">
                <div style="font-weight:700;font-size:12.5px;color:${titleColor};margin-bottom:3px;display:flex;align-items:center;gap:6px;">
                  <span>📝</span> <span>Chèque</span>
                </div>
                <div style="font-size:12.5px;line-height:1.55;color:${valColor};">
                  ${chk.payableTo ? `<div><strong>À l'ordre de :</strong> ${chk.payableTo}</div>` : ''}
                  ${chk.address ? `<div><strong>Adresse d'envoi :</strong> ${chk.address}</div>` : ''}
                </div>
              </div>
            `);
          }
        } else if (key === 'card' && cfg.card) {
          const crd = cfg.card;
          blocksHtml.push(`
            <div style="margin-top:8px;padding-top:8px;border-top:1px dashed ${borderColor};">
              <div style="font-weight:700;font-size:12.5px;color:${titleColor};margin-bottom:3px;display:flex;align-items:center;gap:6px;">
                <span>💳</span> <span>Carte bancaire / Paiement en ligne</span>
              </div>
              <div style="font-size:12.5px;line-height:1.55;color:${valColor};">
                ${crd.paymentUrl ? `<div><strong>Lien :</strong> <a href="${crd.paymentUrl}" target="_blank" rel="noopener noreferrer" style="color:${ac};text-decoration:underline;">Payer en ligne</a></div>` : ''}
                ${crd.provider ? `<div><strong>Fournisseur :</strong> ${crd.provider}</div>` : ''}
              </div>
            </div>
          `);
        }
      });
    }

    // Si aucun moyen n'est sélectionné ou renseigné : ne rien afficher du tout !
    if (blocksHtml.length === 0) {
      return '';
    }

    const termsHtml = (d.terms && d.terms.trim()) ? `
      <div style="font-size:12.5px;color:${valColor};margin-bottom:6px;">
        <strong>${_t('doc_terms')} :</strong> ${d.terms}
      </div>` : '';

    return `
      <div>
        <strong style="color:${titleColor};display:block;margin-bottom:4px;font-size:13px;font-weight:700;">${_t('doc_payment_title')}</strong>
        ${termsHtml}
        ${blocksHtml.join('')}
      </div>
    `;
  },

  // ── Totals, Payments & Footer Helper ──────────────────────────────────
  renderBottom: function (d, ac, isDark = false) {
    const _t = (key) => (window.KivoI18n ? KivoI18n.t(key, d.lang || 'fr') : key);
    const lblSubtotal = d.lblSubtotal || _t('doc_subtotal_ht');
    const lblTax = d.lblTax || _t('doc_vat_calc');
    const lblTotal = d.lblTotal || _t('doc_total_ttc');
    const showVat = d.showVat !== false;
    const showDiscount = d.showDiscount !== false && (d.discount > 0);
    const showDeposit = d.showDeposit !== false && (d.deposit > 0);
    const depositAmount = showDeposit ? (d.deposit || 0) : 0;
    const balanceDue = Math.max(0, (d.grandTotal || 0) - depositAmount);

    const paymentHtml = this.renderPaymentSection(d, ac, isDark);
    const hasNotes = (d.showNotes !== false && d.notes && d.notes.trim());

    let paymentNotesGrid = '';
    if (paymentHtml && hasNotes) {
      paymentNotesGrid = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;background:${isDark ? '#222631' : '#F8FAFC'};padding:12px 16px;border-radius:8px;font-size:12.5px;color:${isDark ? '#94A3B8' : '#475569'};margin-bottom:14px;border:1px solid ${isDark ? '#2D323F' : '#E2E8F0'};">
          <div>${paymentHtml}</div>
          <div>
            <strong style="color:${isDark ? '#E2E8F0' : '#0F172A'};display:block;margin-bottom:4px;font-size:13px;font-weight:700;">${_t('doc_notes')}</strong>
            <div style="white-space:pre-wrap;font-size:12.5px;line-height:1.5;">${d.notes}</div>
          </div>
        </div>
      `;
    } else if (paymentHtml) {
      paymentNotesGrid = `
        <div style="background:${isDark ? '#222631' : '#F8FAFC'};padding:12px 16px;border-radius:8px;font-size:12.5px;color:${isDark ? '#94A3B8' : '#475569'};margin-bottom:14px;border:1px solid ${isDark ? '#2D323F' : '#E2E8F0'};">
          ${paymentHtml}
        </div>
      `;
    } else if (hasNotes) {
      paymentNotesGrid = `
        <div style="background:${isDark ? '#222631' : '#F8FAFC'};padding:12px 16px;border-radius:8px;font-size:12.5px;color:${isDark ? '#94A3B8' : '#475569'};margin-bottom:14px;border:1px solid ${isDark ? '#2D323F' : '#E2E8F0'};">
          <strong style="color:${isDark ? '#E2E8F0' : '#0F172A'};display:block;margin-bottom:4px;font-size:13px;font-weight:700;">${_t('doc_notes')}</strong>
          <div style="white-space:pre-wrap;font-size:12.5px;line-height:1.5;">${d.notes}</div>
        </div>
      `;
    }

    return `
      <div style="margin-top:auto;padding-top:16px;border-top:1.5px solid ${isDark ? '#2D323F' : '#E2E8F0'};">
        <!-- Totals Block -->
        <div style="display:flex;justify-content:flex-end;margin-bottom:18px;">
          <div style="width:300px;">
            <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;font-weight:400;color:${isDark ? '#94A3B8' : '#64748B'};">
              <span>${lblSubtotal}</span><strong style="color:${isDark ? '#E2E8F0' : '#0F172A'};font-weight:600;">${this.fmt(d.subtotal, d.currency)}</strong>
            </div>
            ${showDiscount ? `
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#EF4444;">
                <span>Remise</span><strong>-${this.fmt(d.discount, d.currency)}</strong>
              </div>` : ''}
            ${showVat ? `
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;font-weight:400;color:${isDark ? '#94A3B8' : '#64748B'};">
                <span>${lblTax}</span><strong style="color:${isDark ? '#E2E8F0' : '#0F172A'};font-weight:600;">${this.fmt(d.taxAmount, d.currency)}</strong>
              </div>` : ''}
            <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:18px;font-weight:700;color:${isDark ? '#F5D0B5' : ac};border-top:2.5px solid ${ac};padding-top:10px;margin-top:8px;">
              <span>${lblTotal}</span><span>${this.fmt(d.grandTotal, d.currency)}</span>
            </div>
            ${showDeposit ? `
              <div style="display:flex;justify-content:space-between;padding:5px 0;color:#059669;font-size:12px;margin-top:4px;">
                <span>${d.lblDeposit || 'Acompte déjà versé'}</span><strong>-${this.fmt(depositAmount, d.currency)}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:14px;font-weight:800;color:#D97706;border-top:1px dashed ${isDark ? '#475569' : '#CBD5E1'};padding-top:6px;margin-top:4px;">
                <span>${d.lblBalance || 'Solde net à payer'}</span><span>${this.fmt(balanceDue, d.currency)}</span>
              </div>` : ''}
          </div>
        </div>

        <!-- Payment Info & Notes -->
        ${paymentNotesGrid}

        <!-- Thank-you note -->
        ${(d.showThankYou !== false && d.thankYouText) ? `
          <div style="text-align:center;font-size:13px;font-weight:700;color:${ac};margin:8px 0 10px 0;letter-spacing:0.02em;">
            ${d.thankYouText}
          </div>` : ''}

        <!-- Footer / Mentions légales -->
        ${d.showLegalNotices !== false ? `
        <div style="text-align:center;font-size:11px;font-weight:400;color:${isDark ? '#94A3B8' : '#6B7280'};padding-top:10px;border-top:1px solid ${isDark ? '#2D323F' : '#E2E8F0'};line-height:1.6;">
          <div>${[(d.biz && d.biz.name) || (d.biz && d.biz.owner) || 'Mon Entreprise', d.biz && d.biz.address, d.biz && d.biz.phone, d.biz && d.biz.email].filter(Boolean).join(' · ')}</div>
          ${d.legalNotices ? `<div style="margin-top:4px;font-size:11px;color:${isDark ? '#94A3B8' : '#6B7280'};">${d.legalNotices}</div>` : ''}
          ${(() => {
            const legals = [];
            if (d.biz && d.biz.rccm) legals.push(`RCCM : <strong>${d.biz.rccm}</strong>`);
            if (d.biz && d.biz.niu) legals.push(`NIU : <strong>${d.biz.niu}</strong>`);
            if (legals.length === 0 && d.biz && d.biz.taxId) legals.push(`${this.getLegalLabel(d.biz)} : <strong>${d.biz.taxId}</strong>`);
            return legals.length > 0 ? `<div style="font-size:11px;color:${isDark ? '#94A3B8' : '#6B7280'};margin-top:2px;">${legals.join(' · ')}</div>` : '';
          })()}
          ${(d.client && d.client.taxId) ? `<div style="font-size:11px;color:${isDark ? '#94A3B8' : '#6B7280'};margin-top:2px;">Client : ${d.client.name || ''} · ${d.client.legalFieldName || 'N° Fiscal'} : <strong>${d.client.taxId}</strong></div>` : ''}
        </div>` : ''}
      </div>
    `;
  },

  // ── Gallery Mini-Previews (Miniatures avec "KIVO" et contenu complet) ──
  miniPreview: function (id) {
    const wrap = (inner, bg) =>
      `<div class="tmpl-mini-wrap" style="background:${bg || '#fff'};width:155px;height:195px;position:relative;display:flex;flex-direction:column;box-shadow:0 12px 26px -4px rgba(0,0,0,0.22);overflow:hidden;box-sizing:border-box;">
        ${inner}
      </div>`;

    const templates = {
      minimalist: () => wrap(`
        <div style="padding:9px;background:#fff;height:100%;display:flex;flex-direction:column;box-sizing:border-box;font-family:Inter,sans-serif;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;border-bottom:1px solid #E2E8F0;padding-bottom:5px;">
            <div>
              <div style="font-size:7px;font-weight:900;color:#0F172A;letter-spacing:0.5px;">KIVO MATIQUE</div>
              <div style="font-size:5px;color:#94A3B8;">Dakar, Sénégal</div>
            </div>
            <div style="text-align:right;">
              <div style="font-family:serif;font-size:11px;font-weight:900;color:#0F172A;line-height:1;">KIVO</div>
              <div style="font-size:5px;color:#64748B;margin-top:1px;">K-2026-0001</div>
            </div>
          </div>
          <div style="margin-bottom:5px;font-size:5.5px;color:#475569;line-height:1.3;">
            <span style="font-weight:700;color:#0F172A;">Client :</span> Studio Pulse (A. Diop)<br>
            <span style="font-size:5px;color:#94A3B8;">Émission : 22/06/2026</span>
          </div>
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:2px;overflow:hidden;margin-bottom:4px;">
            <div style="display:flex;background:#F1F5F9;padding:2px 3px;font-size:5px;font-weight:700;color:#334155;">
              <div style="flex:2;">Prestation</div><div style="width:14px;text-align:center;">Qté</div><div style="width:14px;text-align:center;">TVA</div><div style="width:26px;text-align:right;">Total</div>
            </div>
            <div style="padding:2px 3px;font-size:4.8px;color:#475569;border-bottom:1px solid #F1F5F9;display:flex;">
              <div style="flex:2;">Dev Web UI</div><div style="width:14px;text-align:center;">1</div><div style="width:14px;text-align:center;">18%</div><div style="width:26px;text-align:right;">250k</div>
            </div>
            <div style="padding:2px 3px;font-size:4.8px;color:#475569;display:flex;">
              <div style="flex:2;">Cloud SaaS</div><div style="width:14px;text-align:center;">1</div><div style="width:14px;text-align:center;">18%</div><div style="width:26px;text-align:right;">80k</div>
            </div>
          </div>
          <div style="margin-top:auto;border-top:1px solid #E2E8F0;padding-top:3px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:5px;color:#10B981;font-weight:800;">TOTAL TTC</span>
            <div style="text-align:right;font-size:6.5px;font-weight:900;color:#0F172A;">389 400 FCFA</div>
          </div>
        </div>`, '#fff'),

      corporate: () => wrap(`
        <div style="background:#fff;height:100%;display:flex;flex-direction:column;box-sizing:border-box;font-family:Inter,sans-serif;">
          <div style="background:#1E3A5F;padding:6px 8px;display:flex;justify-content:space-between;align-items:center;">
            <div style="color:#fff;font-size:7px;font-weight:800;">KIVO MATIQUE</div>
            <div style="color:#fff;font-size:10px;font-weight:900;">KIVO</div>
          </div>
          <div style="padding:6px 8px;flex:1;display:flex;flex-direction:column;">
            <div style="background:#EFF6FF;border-radius:2px;padding:3px;margin-bottom:4px;font-size:5px;color:#1E3A5F;">
              <strong>Client :</strong> Studio Pulse SARL
            </div>
            <div style="border:1px solid #DBEAFE;border-radius:2px;overflow:hidden;margin-bottom:4px;">
              <div style="display:flex;background:#1E3A5F;color:#fff;padding:2px 3px;font-size:4.8px;font-weight:700;">
                <div style="flex:2;">Article</div><div style="width:14px;text-align:center;">Qté</div><div style="width:14px;text-align:center;">TVA</div><div style="width:26px;text-align:right;">Total</div>
              </div>
              <div style="padding:2px 3px;font-size:4.8px;color:#334155;border-bottom:1px solid #EFF6FF;display:flex;">
                <div style="flex:2;">Prestation UI</div><div style="width:14px;text-align:center;">1</div><div style="width:14px;text-align:center;">18%</div><div style="width:26px;text-align:right;">250k</div>
              </div>
            </div>
            <div style="margin-top:auto;background:#1E3A5F;color:#fff;padding:3px 6px;border-radius:2px;display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:4.8px;opacity:0.8;">Total TTC</span>
              <span style="font-size:6.5px;font-weight:900;">389 400 FCFA</span>
            </div>
          </div>
        </div>`, '#fff'),

      elegant: () => wrap(`
        <div style="background:#FFFDF7;height:100%;display:flex;flex-direction:column;border:2px solid #E8D5A0;box-sizing:border-box;padding:7px;font-family:Georgia,serif;">
          <div style="text-align:center;border-bottom:1px solid #C9A84C;padding-bottom:4px;margin-bottom:5px;">
            <div style="font-size:11px;color:#C9A84C;font-weight:700;font-style:italic;">KIVO</div>
            <div style="font-size:4.8px;color:#A68B3A;">Édition Haute Facturation · K-2026-0001</div>
          </div>
          <div style="font-size:5px;color:#6B5C2A;margin-bottom:4px;">
            <strong>Destinataire :</strong> Studio Pulse SARL
          </div>
          <div style="border:1px solid #E8D5A0;border-radius:2px;overflow:hidden;margin-bottom:4px;">
            <div style="display:flex;background:#FDF9EF;color:#C9A84C;padding:2px 3px;font-size:4.8px;font-weight:700;">
              <div style="flex:2;">Prestation</div><div style="width:14px;text-align:center;">Qté</div><div style="width:14px;text-align:center;">TVA</div><div style="width:26px;text-align:right;">Total</div>
            </div>
            <div style="padding:2px 3px;font-size:4.8px;color:#4A3B22;display:flex;">
              <div style="flex:2;">Création Visuelle</div><div style="width:14px;text-align:center;">1</div><div style="width:14px;text-align:center;">18%</div><div style="width:26px;text-align:right;">250k</div>
            </div>
          </div>
          <div style="margin-top:auto;border-top:1px solid #C9A84C;padding-top:3px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:5px;color:#A68B3A;font-style:italic;">Total TTC</span>
            <div style="font-size:6.5px;font-weight:900;color:#C9A84C;">389 400 FCFA</div>
          </div>
        </div>`, '#FFFDF7'),

      modern: () => wrap(`
        <div style="background:#fff;height:100%;display:flex;flex-direction:column;box-sizing:border-box;font-family:Inter,sans-serif;padding:7px;">
          <div style="height:3px;background:linear-gradient(90deg,#7C3AED,#EC4899);border-radius:2px;margin-bottom:4px;"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:7px;font-weight:900;color:#7C3AED;">KIVO</span>
            <span style="font-size:5px;color:#7C3AED;font-weight:700;background:#F5F3FF;padding:1px 4px;border-radius:6px;">PAYÉE</span>
          </div>
          <div style="background:#F5F3FF;border-radius:2px;padding:3px;margin-bottom:4px;font-size:5px;color:#4338CA;">
            <strong>Client :</strong> Studio Pulse SARL
          </div>
          <div style="margin-top:auto;background:linear-gradient(135deg,#7C3AED,#8B5CF6);color:#fff;padding:3px 6px;border-radius:3px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:4.8px;opacity:0.9;">Total TTC</span>
            <span style="font-size:6.5px;font-weight:900;">389 400 FCFA</span>
          </div>
        </div>`, '#fff'),

      clean: () => wrap(`
        <div style="background:#fff;height:100%;display:flex;flex-direction:column;border-top:3px solid #0E7490;box-sizing:border-box;padding:7px;font-family:Inter,sans-serif;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
            <span style="font-size:8px;font-weight:900;color:#0E7490;">KIVO</span>
            <span style="font-size:5px;color:#64748B;">K-2026-0001</span>
          </div>
          <div style="border-left:2px solid #0E7490;padding-left:4px;margin-bottom:5px;font-size:5px;color:#334155;">
            <strong>Client :</strong> Studio Pulse SARL
          </div>
          <div style="margin-top:auto;background:#0E7490;color:#fff;padding:3px 6px;border-radius:2px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:4.8px;">Total TTC</span>
            <span style="font-size:6.5px;font-weight:900;">389 400 FCFA</span>
          </div>
        </div>`, '#fff'),

      editorial: () => wrap(`
        <div style="background:#fff;height:100%;display:flex;flex-direction:column;box-sizing:border-box;font-family:Inter,sans-serif;">
          <div style="background:#111;padding:5px 7px;display:flex;justify-content:space-between;align-items:center;">
            <span style="color:#fff;font-size:7px;font-weight:900;">KIVO</span>
            <span style="color:#EF4444;font-size:7px;font-weight:900;">FACTURE</span>
          </div>
          <div style="padding:6px;flex:1;display:flex;flex-direction:column;">
            <div style="font-size:5px;color:#111;margin-bottom:4px;border-bottom:1px solid #111;padding-bottom:2px;">
              <strong>CLIENT :</strong> Studio Pulse SARL
            </div>
            <div style="margin-top:auto;border:1.5px solid #111;padding:2px 5px;display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:4.8px;font-weight:800;color:#111;">TOTAL TTC</span>
              <span style="font-size:6.5px;font-weight:900;color:#EF4444;">389 400 FCFA</span>
            </div>
          </div>
        </div>`, '#fff'),

      premium: () => wrap(`
        <div style="background:#181A20;height:100%;display:flex;flex-direction:column;box-sizing:border-box;font-family:Inter,sans-serif;color:#F1F5F9;padding:6px 8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
            <span style="font-size:7px;font-weight:900;color:#F8FAFC;">KIVO</span>
            <span style="font-size:4.8px;color:#D49B7A;">K-2026-0001</span>
          </div>
          <div style="height:4px;background:linear-gradient(90deg,#D49B7A,#F5D0B5,#B87352);border-radius:1px;margin-bottom:4px;"></div>
          <div style="background:#222631;border:1px solid #2D323F;border-radius:2px;padding:2px 4px;margin-bottom:4px;font-size:5px;color:#F5D0B5;">
            <strong>Client :</strong> Studio Pulse SARL
          </div>
          <div style="margin-top:auto;background:#222631;border:1px solid #D49B7A;color:#fff;padding:2px 5px;border-radius:2px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:4.8px;color:#94A3B8;">Total TTC</span>
            <span style="font-size:6.5px;font-weight:900;color:#F5D0B5;">389 400 FCFA</span>
          </div>
        </div>`, '#181A20'),
    };

    const fn = templates[id] || templates['minimalist'];
    return fn();
  },

  // ══════════════════════════════════════════════════════════════
  // FULL INVOICE RENDERERS (GARANTIS SUR 1 PAGE A4 AVEC TOTAL)
  // ══════════════════════════════════════════════════════════════

  // 1. MINIMALIST (Exact reproduction of reference image)
  renderMinimalist: function (d) {
    const ac = d.primaryColor || '#0F172A';
    const bg = d.bgColor || '#FFFFFF';
    return `
      <div class="kivo-invoice-sheet" style="background:${bg};font-family:Inter,Arial,sans-serif;height:100%;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;padding:34px 40px;color:#1E293B;position:relative;">
        <div>
          ${this.renderHeader(d, ac, '#475569')}
          ${this.renderClient(d, '#0F172A', '#475569')}

          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;table-layout:fixed;">
            ${this.tableColgroup()}
            <thead>
              <tr style="border-bottom:2px solid ${ac};">
                <th style="padding:9px 12px;text-align:left;color:#0F172A;font-weight:700;">Description</th>
                <th style="padding:9px 12px;text-align:center;color:#0F172A;font-weight:700;">Quantité</th>
                <th style="padding:9px 12px;text-align:right;color:#0F172A;font-weight:700;">Prix Unitaire</th>
                <th style="padding:9px 12px;text-align:center;color:#0F172A;font-weight:700;">TVA</th>
                <th style="padding:9px 12px;text-align:right;color:#0F172A;font-weight:700;">Total</th>
              </tr>
            </thead>
            <tbody>${this.rows(d.items, d.currency)}</tbody>
          </table>
        </div>

        ${this.renderBottom(d, ac)}
      </div>
    `;
  },

  // 2. CORPORATE
  renderCorporate: function (d) {
    const ac = d.primaryColor || '#1E3A5F';
    const bg = d.bgColor || '#FFFFFF';
    return `
      <div class="kivo-invoice-sheet" style="background:${bg};font-family:Inter,Arial,sans-serif;height:100%;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;color:#1E293B;position:relative;">
        <div>
          <div style="background:${ac};padding:22px 40px;color:#FFFFFF;margin-bottom:22px;">
            ${this.renderHeader(d, '#FFFFFF', 'rgba(255,255,255,0.75)')}
          </div>
          <div style="padding:0 40px;">
            ${this.renderClient(d, '#0F172A', '#64748B')}

            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;table-layout:fixed;">
              ${this.tableColgroup()}
              <thead>
                <tr style="background:${ac};color:#FFFFFF;">
                  <th style="padding:9px 12px;text-align:left;font-weight:700;">Description</th>
                  <th style="padding:9px 12px;text-align:center;font-weight:700;">Quantité</th>
                  <th style="padding:9px 12px;text-align:right;font-weight:700;">Prix Unitaire</th>
                  <th style="padding:9px 12px;text-align:center;font-weight:700;">TVA</th>
                  <th style="padding:9px 12px;text-align:right;font-weight:700;">Total</th>
                </tr>
              </thead>
              <tbody>${this.rows(d.items, d.currency, '#EFF6FF')}</tbody>
            </table>
          </div>
        </div>

        <div style="padding:0 40px 28px 40px;">
          ${this.renderBottom(d, ac)}
        </div>
      </div>
    `;
  },

  // 3. ELEGANT
  renderElegant: function (d) {
    const ac = d.primaryColor || '#C9A84C';
    const bg = d.bgColor || '#FFFDF7';
    return `
      <div class="kivo-invoice-sheet" style="background:${bg};font-family:Georgia,serif;height:100%;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;padding:32px 38px;color:#2D241E;border:6px solid #F6F1E5;position:relative;">
        <div>
          ${this.renderHeader(d, ac, '#6B5C2A')}
          ${this.renderClient(d, '#2D241E', '#6B5C2A')}

          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;table-layout:fixed;">
            ${this.tableColgroup()}
            <thead>
              <tr style="border-bottom:2px solid ${ac};color:${ac};">
                <th style="padding:9px 12px;text-align:left;font-weight:700;">Description</th>
                <th style="padding:9px 12px;text-align:center;font-weight:700;">Quantité</th>
                <th style="padding:9px 12px;text-align:right;font-weight:700;">Prix Unitaire</th>
                <th style="padding:9px 12px;text-align:center;font-weight:700;">TVA</th>
                <th style="padding:9px 12px;text-align:right;font-weight:700;">Montant</th>
              </tr>
            </thead>
            <tbody>${this.rows(d.items, d.currency, '#FDF9EF')}</tbody>
          </table>
        </div>

        ${this.renderBottom(d, ac)}
      </div>
    `;
  },

  // 4. MODERN
  renderModern: function (d) {
    const ac = d.primaryColor || '#7C3AED';
    const sec = d.secondaryColor || '#EC4899';
    const bg = d.bgColor || '#FFFFFF';
    return `
      <div class="kivo-invoice-sheet" style="background:${bg};font-family:Inter,sans-serif;height:100%;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;padding:32px 40px;position:relative;">
        <div>
          <div style="height:6px;background:linear-gradient(90deg,${ac},${sec});border-radius:3px;margin-bottom:20px;"></div>
          ${this.renderHeader(d, ac, '#64748B')}
          ${this.renderClient(d, ac, '#64748B')}

          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;table-layout:fixed;">
            ${this.tableColgroup()}
            <thead>
              <tr style="background:${ac};color:#FFFFFF;">
                <th style="padding:9px 12px;text-align:left;font-weight:700;border-radius:4px 0 0 4px;">Description</th>
                <th style="padding:9px 12px;text-align:center;font-weight:700;">Quantité</th>
                <th style="padding:9px 12px;text-align:right;font-weight:700;">Prix Unitaire</th>
                <th style="padding:9px 12px;text-align:center;font-weight:700;">TVA</th>
                <th style="padding:9px 12px;text-align:right;font-weight:700;border-radius:0 4px 4px 0;">Total</th>
              </tr>
            </thead>
            <tbody>${this.rows(d.items, d.currency, '#F5F3FF')}</tbody>
          </table>
        </div>

        ${this.renderBottom(d, ac)}
      </div>
    `;
  },

  // 5. CLEAN (Modern Clean)
  renderClean: function (d) {
    const ac = d.primaryColor || '#0E7490';
    const bg = d.bgColor || '#FFFFFF';
    return `
      <div class="kivo-invoice-sheet" style="background:${bg};font-family:Inter,sans-serif;height:100%;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;padding:32px 40px;border-top:6px solid ${ac};position:relative;">
        <div>
          ${this.renderHeader(d, ac, '#64748B')}
          ${this.renderClient(d, '#0F172A', '#64748B')}

          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;table-layout:fixed;">
            ${this.tableColgroup()}
            <thead>
              <tr style="background:${ac};color:#FFFFFF;">
                <th style="padding:9px 12px;text-align:left;font-weight:700;">Description</th>
                <th style="padding:9px 12px;text-align:center;font-weight:700;">Quantité</th>
                <th style="padding:9px 12px;text-align:right;font-weight:700;">Prix Unitaire</th>
                <th style="padding:9px 12px;text-align:center;font-weight:700;">TVA</th>
                <th style="padding:9px 12px;text-align:right;font-weight:700;">Total</th>
              </tr>
            </thead>
            <tbody>${this.rows(d.items, d.currency, '#F0FDFA')}</tbody>
          </table>
        </div>

        ${this.renderBottom(d, ac)}
      </div>
    `;
  },

  // 6. EDITORIAL
  renderEditorial: function (d) {
    const ac = d.primaryColor || '#EF4444';
    const bg = d.bgColor || '#FFFFFF';
    return `
      <div class="kivo-invoice-sheet" style="background:${bg};font-family:Inter,sans-serif;height:100%;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;color:#111;position:relative;">
        <div>
          <div style="background:#111;padding:20px 40px;color:#FFFFFF;margin-bottom:22px;">
            ${this.renderHeader(d, '#FFFFFF', '#9CA3AF')}
          </div>
          <div style="padding:0 40px;">
            ${this.renderClient(d, '#111', '#4B5563')}

            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;table-layout:fixed;">
              ${this.tableColgroup()}
              <thead>
                <tr style="background:#111;color:#FFFFFF;">
                  <th style="padding:9px 12px;text-align:left;font-weight:800;">DESCRIPTION</th>
                  <th style="padding:9px 12px;text-align:center;font-weight:800;">QTÉ</th>
                  <th style="padding:9px 12px;text-align:right;font-weight:800;">P.U</th>
                  <th style="padding:9px 12px;text-align:center;font-weight:800;">TVA</th>
                  <th style="padding:9px 12px;text-align:right;font-weight:800;background:${ac};">TOTAL</th>
                </tr>
              </thead>
              <tbody>${this.rows(d.items, d.currency, '#FEE2E2')}</tbody>
            </table>
          </div>
        </div>

        <div style="padding:0 40px 26px 40px;">
          ${this.renderBottom(d, ac)}
        </div>
      </div>
    `;
  },

  // 7. PREMIUM (Copper Metallic & Dark Matte)
  renderPremium: function (d) {
    const ac = d.primaryColor || '#D49B7A';
    const sec = d.secondaryColor || '#B87352';
    return `
      <div class="kivo-invoice-sheet" style="background:#181A20;font-family:Inter,sans-serif;height:100%;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;padding:32px 40px;color:#F1F5F9;position:relative;">
        <div>
          ${this.renderHeader(d, ac, '#94A3B8', true)}
          <div style="height:8px;background:linear-gradient(90deg,${ac} 0%,#FFFFFF 50%,${sec} 100%);border-radius:2px;margin-bottom:20px;box-shadow:0 3px 10px rgba(0,0,0,0.3);"></div>
          ${this.renderClient(d, '#FFFFFF', '#94A3B8', true)}

          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;table-layout:fixed;">
            ${this.tableColgroup()}
            <thead>
              <tr style="background:#222631;color:${ac};border-bottom:1.5px solid ${ac};">
                <th style="padding:9px 12px;text-align:left;font-weight:700;">Description</th>
                <th style="padding:9px 12px;text-align:center;font-weight:700;">Quantité</th>
                <th style="padding:9px 12px;text-align:right;font-weight:700;">Prix Unitaire</th>
                <th style="padding:9px 12px;text-align:center;font-weight:700;">TVA</th>
                <th style="padding:9px 12px;text-align:right;font-weight:700;">Total</th>
              </tr>
            </thead>
            <tbody>${this.rows(d.items, d.currency, '#2A221E', true)}</tbody>
          </table>
        </div>

        ${this.renderBottom(d, ac, true)}
      </div>
    `;
  },

  // ── Main render dispatcher ────────────────────────────────────────────
  render: function (templateId, data) {
    const rawData = data || this.collectData();
    const d = (typeof this.buildDocumentView === 'function')
      ? this.buildDocumentView(rawData)
      : rawData;
    let html = '';
    switch (templateId) {
      case 'minimalist':  html = this.renderMinimalist(d); break;
      case 'corporate':   html = this.renderCorporate(d); break;
      case 'elegant':     html = this.renderElegant(d); break;
      case 'modern':      html = this.renderModern(d); break;
      case 'clean':       html = this.renderClean(d); break;
      case 'editorial':   html = this.renderEditorial(d); break;
      case 'premium':     html = this.renderPremium(d); break;
      default:            html = this.renderMinimalist(d); break;
    }

    return html;
  }
};

// Exposition globale universelle (A1)
window.buildDocumentView = function (docOrData, state) {
  if (window.KivoTemplates && typeof window.KivoTemplates.buildDocumentView === 'function') {
    return window.KivoTemplates.buildDocumentView(docOrData, state);
  }
  return docOrData || {};
};

console.log('[KivoTemplates]', window.KivoTemplates.builtIn.length, 'templates disponibles.');

