/**
 * KIVO MATIQUE — Document Templates Engine
 * 8 professional templates based on reference designs + gallery system
 * Fully reactive to all builder inputs, line items, and logo customizations.
 */

window.KivoTemplates = {

  // ── Template Registry (8 models matching reference designs) ───────────
  builtIn: [
    { id: 'minimalist', name: 'Minimalist',   desc: 'Clair et concis, design épuré officiel KIVO.' },
    { id: 'corporate',  name: 'Corporate',    desc: 'Formel, bandeau bleu marine et structure nette.' },
    { id: 'elegant',    name: 'Elegant',      desc: 'Raffiné, dorure subtile et typographie noble.' },
    { id: 'modern',     name: 'Modern',       desc: 'Vibrant, dégradé coloré et badges arrondis.' },
    { id: 'clean',      name: 'Modern Clean', desc: 'Clair, précis, liseré cyan et lisibilité optimale.' },
    { id: 'editorial',  name: 'Editorial',    desc: 'Typographie forte, contraste noir et rouge.' },
    { id: 'premium',    name: 'Premium',      desc: 'Édition exclusive sombre avec bande cuivre brossé.' },
    { id: 'emerald',    name: 'Emerald',      desc: 'Moderne géométrique avec bandeau biseauté et total mis en valeur.' }
  ],

  isFullHtml: function () {
    return true;
  },

  // ── Helpers ──────────────────────────────────────────────────────────

  fmt: function (n, currency) {
    return (n || 0).toLocaleString('fr-FR') + ' ' + (currency || 'FCFA');
  },

  // ── 1. CONTRASTE (WCAG 2.1 AA min 4.5:1) ──────────────────────────────
  hexToRgb: function (hex) {
    if (!hex || typeof hex !== 'string') return { r: 17, g: 24, b: 39 };
    let c = hex.replace('#', '').trim();
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    if (c.length !== 6) return { r: 17, g: 24, b: 39 };
    return {
      r: parseInt(c.slice(0, 2), 16) || 0,
      g: parseInt(c.slice(2, 4), 16) || 0,
      b: parseInt(c.slice(4, 6), 16) || 0
    };
  },

  rgbToHex: function (r, g, b) {
    const toHex = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  },

  relativeLuminance: function (r, g, b) {
    const a = [r, g, b].map(v => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  },

  contrastRatio: function (hex1, hex2) {
    const rgb1 = this.hexToRgb(hex1);
    const rgb2 = this.hexToRgb(hex2);
    const lum1 = this.relativeLuminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = this.relativeLuminance(rgb2.r, rgb2.g, rgb2.b);
    const l1 = Math.max(lum1, lum2);
    const l2 = Math.min(lum1, lum2);
    return (l1 + 0.05) / (l2 + 0.05);
  },

  readableOn: function (bgHex) {
    if (!bgHex) return '#FFFFFF';
    const ratioWhite = this.contrastRatio(bgHex, '#FFFFFF');
    const ratioDark  = this.contrastRatio(bgHex, '#111827');
    const chosen = ratioWhite >= ratioDark ? '#FFFFFF' : '#111827';
    const bestRatio = Math.max(ratioWhite, ratioDark);
    console.log(`[KivoTemplates/readableOn] bg=${bgHex} -> ${chosen} (ratio: ${bestRatio.toFixed(2)}:1, vsWhite=${ratioWhite.toFixed(2)}, vsDark=${ratioDark.toFixed(2)})`);
    return chosen;
  },

  textOnWhite: function (colorHex) {
    if (!colorHex) return '#111827';
    let rgb = this.hexToRgb(colorHex);
    let currentHex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
    let ratio = this.contrastRatio(currentHex, '#FFFFFF');
    if (ratio >= 4.5) {
      console.log(`[KivoTemplates/textOnWhite] color=${colorHex} already compliant (ratio: ${ratio.toFixed(2)}:1)`);
      return currentHex;
    }
    let steps = 0;
    while (ratio < 4.5 && steps < 20) {
      rgb.r = Math.round(rgb.r * 0.9);
      rgb.g = Math.round(rgb.g * 0.9);
      rgb.b = Math.round(rgb.b * 0.9);
      currentHex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
      ratio = this.contrastRatio(currentHex, '#FFFFFF');
      steps++;
    }
    console.log(`[KivoTemplates/textOnWhite] color=${colorHex} darkened in ${steps} steps -> ${currentHex} (ratio: ${ratio.toFixed(2)}:1)`);
    return currentHex;
  },

  // ── 3. DATES (dd/mm/yyyy, Africa/Brazzaville) ─────────────────────────
  fmtDate: function (dateStr) {
    if (!dateStr) return '';
    try {
      const s = String(dateStr).trim();
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const parts = s.split('T')[0].split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      const d = (dateStr instanceof Date) ? dateStr : new Date(dateStr);
      if (isNaN(d.getTime())) return s;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (_) {
      return String(dateStr || '');
    }
  },

  // ── 5. TÉLÉPHONES (Congo: 05 518 1314) ───────────────────────────────
  fmtPhone: function (rawVal, countryOrPrefix) {
    if (!rawVal) return '';
    const trimmed = String(rawVal).trim();
    if (!trimmed || trimmed === '+') return '';

    let prefix = '242';
    const cop = String(countryOrPrefix || '').toUpperCase().trim();
    if (cop === 'CG' || (cop.includes('CONGO') && !cop.includes('RDC') && !cop.includes('KINSHASA'))) prefix = '242';
    else if (cop === 'SN' || cop.includes('SENEGAL')) prefix = '221';
    else if (cop === 'CI' || cop.includes('IVOIRE')) prefix = '225';
    else if (cop === 'CD' || cop.includes('RDC') || cop.includes('KINSHASA')) prefix = '243';
    else if (cop === 'FR' || cop.includes('FRANCE')) prefix = '33';
    else if (cop === 'CM' || cop.includes('CAMEROUN')) prefix = '237';
    else if (cop === 'BJ' || cop.includes('BENIN')) prefix = '229';
    else if (cop === 'US' || cop === 'CA') prefix = '1';
    else if (/^\+?\d+$/.test(cop)) prefix = cop.replace(/\D/g, '');

    let digits = trimmed.replace(/\D/g, '');
    if (trimmed.startsWith('+242') || digits.startsWith('242')) {
      prefix = '242';
      if (digits.startsWith('242')) digits = digits.slice(3);
    } else if (trimmed.startsWith('+221') || (digits.startsWith('221') && digits.length > 9)) {
      prefix = '221';
      if (digits.startsWith('221')) digits = digits.slice(3);
    } else if (trimmed.startsWith('+33') || (digits.startsWith('33') && digits.length > 9)) {
      prefix = '33';
      if (digits.startsWith('33')) digits = digits.slice(2);
    }

    if (!digits) return trimmed;

    // Congo (+242) -> "05 518 1314"
    if (prefix === '242') {
      if (digits.startsWith('0')) {
        const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 9)].filter(Boolean);
        return parts.join(' ');
      } else {
        if (digits.length === 8) {
          const parts = ['0' + digits.slice(0, 1), digits.slice(1, 4), digits.slice(4, 8)].filter(Boolean);
          return parts.join(' ');
        }
        const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 9)].filter(Boolean);
        return parts.join(' ');
      }
    }

    // Senegal (+221) -> "77 123 45 67"
    if (prefix === '221') {
      const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean);
      return parts.join(' ');
    }

    // France (+33) -> "01 23 45 67 89"
    if (prefix === '33') {
      const d = digits.startsWith('0') ? digits : ('0' + digits);
      const parts = [];
      for (let i = 0; i < Math.min(d.length, 10); i += 2) parts.push(d.slice(i, i + 2));
      return parts.join(' ');
    }

    // RDC (+243) -> "81 234 5678"
    if (prefix === '243') {
      const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 9)].filter(Boolean);
      return parts.join(' ');
    }

    // Cote d'Ivoire / Benin -> 10 digits
    if (prefix === '225' || prefix === '229') {
      const parts = [];
      for (let i = 0; i < Math.min(digits.length, 10); i += 2) parts.push(digits.slice(i, i + 2));
      return parts.join(' ');
    }

    const parts = [];
    for (let i = 0; i < digits.length; i += 2) parts.push(digits.slice(i, i + 2));
    return parts.join(' ');
  },

  // ── 9. LOGO (Drop shadow only when contrast is low on dark background) ──
  logoHtml: function (biz, defaultSize, shape, fallbackDark = false, bgHex = null) {
    if (!biz || !biz.logoUrl) return '';
    const szVal = (biz && biz.logoSize) ? biz.logoSize : (defaultSize || 70);
    const sz = typeof szVal === 'number' ? `${szVal}px` : szVal;
    const br = shape === 'circle' ? '50%' : (shape === 'none' ? '0' : '6px');

    let filterStyle = '';
    if (fallbackDark) {
      filterStyle = 'filter:drop-shadow(0 1px 3px rgba(0,0,0,0.55));';
    } else if (bgHex) {
      const ratioOnBg = this.contrastRatio(bgHex, '#FFFFFF');
      if (ratioOnBg < 2.5) {
        filterStyle = 'filter:drop-shadow(0 1px 3px rgba(0,0,0,0.25));';
      }
    }

    return `<span style="display:inline-flex;align-items:center;justify-content:center;border-radius:${br};">
      <img src="${biz.logoUrl}" style="max-height:${sz};max-width:220px;height:auto;object-fit:contain;border-radius:${br};display:block;${filterStyle}" alt="Logo">
    </span>`;
  },

  // ── Colgroup HTML (colonnes fixes pour table-layout:fixed) ────────────
  tableColgroup: function () {
    return `<colgroup>
      <col style="width:auto;min-width:120px;">
      <col style="width:75px;">
      <col style="width:120px;">
      <col style="width:75px;">
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
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\n\n/g, '\n')
      .replace(/\n/g, '<br>');
  },

  // ── 2. TABLEAU DES ARTICLES (Lignes texte #1F2937 min 13px, unité #475569) ──
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
      return `<tr><td colspan="5" style="text-align:center;color:${isDark ? '#94A3B8' : '#475569'};padding:18px;font-size:13px;">Aucun article saisi</td></tr>`;
    }
    const showVat = d.showVat !== false;
    const filtered = list.filter(it => {
      const hasName = it.name && String(it.name).trim().length > 0;
      const hasAmount = Number(it.totalHT || it.total || it.price || 0) > 0;
      return hasName || hasAmount;
    });
    if (filtered.length === 0) {
      return `<tr><td colspan="5" style="text-align:center;color:${isDark ? '#94A3B8' : '#475569'};padding:18px;font-size:13px;">Aucun article saisi</td></tr>`;
    }
    return filtered.map((it, i) => {
      const unitStr = it.unit ? `\u00a0<span style="font-size:12px;color:${isDark ? '#94A3B8' : '#475569'};font-weight:400;">${it.unit}</span>` : '';
      const discStr = (it.discount && Number(it.discount) > 0) ? `<div style="font-size:11px;color:#EF4444;font-weight:700;white-space:nowrap;">-${it.discount}%</div>` : '';
      const taxStr = showVat ? ((it.taxRate !== undefined && it.taxRate !== '' && it.taxRate !== null) ? it.taxRate + '\u00a0%' : '-') : '-';
      const descHtml = this.cleanDesc(it.name || 'Article sans désignation');
      const rowBg = isDark ? (i % 2 === 0 ? '#1E222B' : '#181A20') : (i % 2 === 0 ? '#FFFFFF' : '#F8FAFC');
      const border = `1px solid ${isDark ? '#2D323F' : '#E2E8F0'}`;
      const textColor = isDark ? '#E2E8F0' : '#1F2937';
      const subduedColor = isDark ? '#94A3B8' : '#475569';

      return `
      <tr style="background:${rowBg};page-break-inside:avoid;break-inside:avoid;">
        <td style="padding:10px 12px;font-size:13px;vertical-align:top;border-bottom:${border};color:${textColor};white-space:normal;overflow-wrap:anywhere;word-break:break-word;line-height:1.45;">
          <strong style="color:${textColor};font-weight:700;">${descHtml}</strong>
        </td>
        <td style="padding:10px 12px;font-size:13px;text-align:center;vertical-align:top;border-bottom:${border};color:${subduedColor};font-weight:500;white-space:nowrap;">${it.quantity}${unitStr}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:right;vertical-align:top;border-bottom:${border};color:${textColor};font-weight:500;white-space:nowrap;">${this.fmt(it.price, currency)}${discStr}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:center;vertical-align:top;border-bottom:${border};color:${subduedColor};font-weight:500;white-space:nowrap;">${taxStr}</td>
        <td style="padding:10px 12px;font-size:13px;text-align:right;vertical-align:top;font-weight:700;border-bottom:${border};${accBg ? 'background:' + accBg + ';' : ''}color:${textColor};white-space:nowrap;">${this.fmt(it.totalHT || it.total, currency)}</td>
      </tr>`;
    }).join('');
  },

  // ── Collecteur de données du builder & profil ─────────────────────────
  collectData: function (state) {
    const biz = (state && state.business) || (window.KivoApp && window.KivoApp.state && window.KivoApp.state.business) || {};
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
      legal:        get('builder-biz-legal')   || biz.legal   || '',
      rccm:         biz.rccm || '',
      niu:          biz.niu  || '',
      taxId:        biz.taxId || '',
      country:      biz.country || '',
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
        country: clientFound.country           || '',
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
      terms:               get('builder-terms')                  || 'À réception',
      paymentMethod:       get('builder-payment-method')         || 'Virement bancaire',
      paymentDetails:      get('builder-payment-details')        || '',
      showPaymentMethods:  getChecked('builder-toggle-payment-methods'),
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
      lang: (window.KivoApp && KivoApp.state && KivoApp.state.language) || 'fr',
    };
  },

  // ── Header Renderer Helper (Supports Logo Left, Center, Right) ─────────
  renderHeader: function (d, titleColor, subtitleColor, isDark = false, bgHex = null) {
    const _t = (key) => (window.KivoI18n ? KivoI18n.t(key, d.lang || 'fr') : key);
    const defaultLbl = d.docType === 'quote' ? _t('doc_quote') : _t('doc_invoice');
    const lbl = (d.docTitleText && d.docTitleText.trim()) ? d.docTitleText.trim() : defaultLbl;
    const pos = (d.biz && d.biz.logoPosition) || 'right';
    const showLogo = d.showLogo !== false;
    const logo = showLogo ? this.logoHtml(d.biz, 70, 'square', isDark, bgHex) : '';
    const bizDisplayName = (d.biz && d.biz.name) ? d.biz.name : ((d.biz && d.biz.owner) || 'Mon Entreprise');
    const legalText = this.getLegalMentions(d.biz);
    const bizLegal = legalText ? `<div style="font-size:11px;color:${subtitleColor};margin-top:2px;">${legalText}</div>` : '';

    // Dates formatted via fmtDate (dd/mm/yyyy)
    const formattedIssueDate = this.fmtDate(d.issueDate);
    const formattedDueDate = d.dueDate ? this.fmtDate(d.dueDate) : '';

    // Phone formatted
    const bizCountry = (d.biz && d.biz.country) || 'CG';
    const bizPhoneFormatted = d.biz && d.biz.phone ? this.fmtPhone(d.biz.phone, bizCountry) : '';

    // Colored texts on white: ensure WCAG AA contrast (>= 4.5:1)
    const safeTitleColor = bgHex ? titleColor : (isDark ? titleColor : this.textOnWhite(titleColor));

    const subjectHtml = (d.showSubject !== false && d.subject && d.subject.trim())
      ? `<div style="margin-top:10px;font-size:13px;font-weight:700;color:${isDark ? '#E2E8F0' : '#1F2937'};background:${isDark ? '#232733' : '#F1F5F9'};padding:4px 10px;border-radius:4px;display:inline-block;"><span style="color:${subtitleColor};font-weight:500;">Objet :</span> ${d.subject.trim()}</div>`
      : '';

    const paidBadge = (d.status === 'paid' && d.docType !== 'quote') ? `
      <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 14px;background:#ECFDF5;border:1.5px solid #10B981;border-radius:20px;font-size:11px;font-weight:800;color:#047857;letter-spacing:0.04em;text-transform:uppercase;margin-top:6px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="display:inline-block;"><polyline points="20 6 9 17 4 12"/></svg>
        ${_t('doc_paid_badge')}
      </div>` : (d.status === 'refunded' ? `
      <div style="display:inline-flex;align-items:center;gap:6px;padding:4px 14px;background:#FEF2F2;border:1.5px solid #EF4444;border-radius:20px;font-size:11px;font-weight:800;color:#B91C1C;letter-spacing:0.04em;text-transform:uppercase;margin-top:6px;">
        ${_t('doc_refunded_badge')}
      </div>` : '');

    if (pos === 'left') {
      return `
        <div style="margin-bottom:24px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div style="display:flex;align-items:flex-start;gap:16px;">
              ${logo}
              <div>
                <div style="font-size:19px;font-weight:900;color:${safeTitleColor};">${bizDisplayName}</div>
                <div style="font-size:13px;color:${subtitleColor};line-height:1.5;margin-top:3px;">
                  ${d.biz.address ? d.biz.address + '<br>' : ''}
                  ${bizPhoneFormatted ? 'Tél. : ' + bizPhoneFormatted + '<br>' : ''}
                  ${d.biz.email ? d.biz.email + '<br>' : ''}
                  ${bizLegal}
                </div>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:26px;font-weight:900;color:${safeTitleColor};letter-spacing:-0.02em;">${lbl}</div>
              <div style="font-size:14px;font-weight:800;color:${safeTitleColor};margin-top:3px;">${d.docNum || ''}</div>
              ${paidBadge ? `<div style="margin-top:3px;">${paidBadge}</div>` : ''}
              ${formattedIssueDate ? `<div style="font-size:12px;color:${subtitleColor};margin-top:5px;">${_t('doc_issue_date_label')} <strong>${formattedIssueDate}</strong></div>` : ''}
              ${formattedDueDate ? `<div style="font-size:12px;color:${subtitleColor};">${_t('doc_due_date_label')} <strong>${formattedDueDate}</strong></div>` : ''}
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
          <div style="font-size:22px;font-weight:900;color:${safeTitleColor};">${lbl}${d.docNum ? ` · ${d.docNum}` : ''}</div>
          ${paidBadge ? `<div style="margin:4px 0;">${paidBadge}</div>` : ''}
          <div style="font-size:13px;font-weight:700;color:${safeTitleColor};margin-top:3px;">${bizDisplayName}</div>
          <div style="font-size:12px;color:${subtitleColor};margin-top:3px;">
            ${[d.biz.address, bizPhoneFormatted ? ('Tél. : ' + bizPhoneFormatted) : '', d.biz.email].filter(Boolean).join(' · ')}
            ${bizLegal}
          </div>
          ${(formattedIssueDate || formattedDueDate) ? `
          <div style="font-size:12px;color:${subtitleColor};margin-top:5px;">
            ${formattedIssueDate ? `${_t('doc_issue_date_label')} <strong>${formattedIssueDate}</strong>` : ''} ${formattedDueDate ? `· ${_t('doc_due_date_label')} <strong>${formattedDueDate}</strong>` : ''}
          </div>` : ''}
          ${subjectHtml}
        </div>
      `;
    }

    // Default: 'right'
    return `
      <div style="margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-size:26px;font-weight:900;color:${safeTitleColor};letter-spacing:-0.02em;margin-bottom:4px;">${lbl}</div>
            <div style="font-size:15px;font-weight:800;color:${safeTitleColor};">${bizDisplayName}</div>
            <div style="font-size:13px;color:${subtitleColor};line-height:1.5;margin-top:3px;">
              ${d.biz.address ? d.biz.address + '<br>' : ''}
              ${bizPhoneFormatted ? 'Tél. : ' + bizPhoneFormatted + '<br>' : ''}
              ${d.biz.email ? d.biz.email + '<br>' : ''}
              ${bizLegal}
            </div>
          </div>
          <div style="text-align:right;">
            ${logo ? `<div style="display:flex;justify-content:flex-end;margin-bottom:10px;">${logo}</div>` : ''}
            <div style="font-size:15px;font-weight:800;color:${safeTitleColor};">${d.docNum || ''}</div>
            ${paidBadge ? `<div style="margin-top:3px;">${paidBadge}</div>` : ''}
            ${formattedIssueDate ? `<div style="font-size:12px;color:${subtitleColor};margin-top:5px;">${_t('doc_issue_date_label')} <span style="color:${safeTitleColor};font-weight:600;">${formattedIssueDate}</span></div>` : ''}
            ${formattedDueDate ? `<div style="font-size:12px;color:${subtitleColor};">${_t('doc_due_date_label')} <span style="color:${safeTitleColor};font-weight:600;">${formattedDueDate}</span></div>` : ''}
          </div>
        </div>
        ${subjectHtml}
      </div>
    `;
  },

  // ── 4. Client Box Renderer Helper (Champs vides masqués, Tél formaté) ──
  renderClient: function (d, titleColor, subtitleColor, isDark = false) {
    const _t = (key) => (window.KivoI18n ? KivoI18n.t(key, d.lang || 'fr') : key);
    const hasClient = d.client && (d.client.name || d.client.company);
    const clientName = hasClient ? (d.client.name || d.client.company) : '';
    const secColor = d.secondaryColor || (isDark ? '#94A3B8' : '#64748B');
    const borderStyle = isDark ? '#2D323F' : '#E2E8F0';
    const taxIdVal = (d.client && (d.client.taxId || d.clientTaxId));

    // Client phone formatted using client country or sender country (Congo: 05 518 1314)
    const clientCountry = (d.client && d.client.country) || (d.biz && d.biz.country) || 'CG';
    const clientPhoneFormatted = d.client && d.client.phone ? this.fmtPhone(d.client.phone, clientCountry) : '';
    const clientEmail = (d.client && d.client.email && d.client.email.trim()) ? d.client.email.trim() : '';

    return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;background:${isDark ? '#222631' : '#F8FAFC'};padding:14px 18px;border-radius:8px;border:1px solid ${borderStyle};border-left:3px solid ${secColor};">
        <div>
          <div style="font-size:11px;text-transform:uppercase;color:${subtitleColor};font-weight:700;letter-spacing:0.5px;">${_t('doc_billed_to')}</div>
          <div style="font-size:15px;font-weight:800;color:${titleColor};margin-top:3px;">${clientName ? clientName : '<span style="font-size:12px;font-weight:400;color:' + subtitleColor + ';font-style:italic;">' + _t('doc_select_client') + '</span>'}</div>
          ${(d.client.address || clientPhoneFormatted || taxIdVal) ? `
          <div style="font-size:13px;color:${subtitleColor};line-height:1.4;margin-top:3px;">
            ${d.client.address ? d.client.address + '<br>' : ''}
            ${clientPhoneFormatted ? 'Tél. : ' + clientPhoneFormatted + '<br>' : ''}
            ${taxIdVal ? '<span style="font-weight:600;">' + (d.client.legalFieldName || 'N° Fiscal / Registre') + ' :</span> ' + taxIdVal : ''}
          </div>` : ''}
        </div>
        ${clientEmail ? `
        <div style="text-align:right;">
          <div style="font-size:11px;text-transform:uppercase;color:${subtitleColor};font-weight:700;letter-spacing:0.5px;">${_t('doc_contact')}</div>
          <div style="font-size:13px;font-weight:600;color:${titleColor};margin-top:3px;">${clientEmail}</div>
        </div>` : ''}
      </div>
    `;
  },

  // ── 8. Mentions légales par pays (Congo: RCCM + NIU) ───────────────────
  getLegalLabel: function (biz) {
    if (!biz) return 'N° d\'enregistrement / Identifiant fiscal';
    const c = (biz.country || '').toUpperCase();
    if (c === 'CG' || (c.includes('CONGO') && !c.includes('RDC'))) return 'RCCM / NIU';
    if (c === 'CD' || c.includes('RDC') || c.includes('KINSHASA')) return 'RCCM / Id. Nat. / NIF';
    if (c === 'SN' || c.includes('SENEGAL')) return 'NINEA / RCCM';
    if (c === 'FR' || c.includes('FRANCE')) return 'SIRET';
    if (c === 'CI' || c.includes('IVOIRE')) return 'RCCM / CC';
    return (biz.legalFieldName && biz.legalFieldName !== 'N° Fiscal') ? biz.legalFieldName : 'N° d\'enregistrement / Identifiant fiscal';
  },

  getLegalMentions: function (biz) {
    if (!biz) return '';
    const parts = [];
    const c = (biz.country || '').toUpperCase();

    // Récupération des identifiants officiels du profil
    if (c === 'CG' || (c.includes('CONGO') && !c.includes('RDC') && !c.includes('KINSHASA'))) {
      if (biz.rccm) parts.push(`RCCM : <strong>${biz.rccm}</strong>`);
      if (biz.niu)  parts.push(`NIU : <strong>${biz.niu}</strong>`);
    } else if (c === 'SN' || c.includes('SENEGAL')) {
      if (biz.niu)  parts.push(`NINEA : <strong>${biz.niu}</strong>`);
      if (biz.rccm) parts.push(`RCCM : <strong>${biz.rccm}</strong>`);
    } else if (c === 'CI' || c.includes('IVOIRE')) {
      if (biz.rccm) parts.push(`RCCM : <strong>${biz.rccm}</strong>`);
      if (biz.niu)  parts.push(`CC : <strong>${biz.niu}</strong>`);
    } else if (c === 'CD' || c.includes('RDC') || c.includes('KINSHASA')) {
      if (biz.rccm)  parts.push(`RCCM : <strong>${biz.rccm}</strong>`);
      if (biz.taxId) parts.push(`Id. Nat. : <strong>${biz.taxId}</strong>`);
      if (biz.niu)   parts.push(`NIF : <strong>${biz.niu}</strong>`);
    } else if (c === 'FR' || c.includes('FRANCE')) {
      const s = biz.taxId || biz.siret || biz.niu;
      if (s) parts.push(`SIRET : <strong>${s}</strong>`);
    } else {
      if (biz.rccm) parts.push(`RCCM : <strong>${biz.rccm}</strong>`);
      if (biz.niu)  parts.push(`NIU : <strong>${biz.niu}</strong>`);
    }

    if (parts.length === 0 && biz.taxId) {
      parts.push(`${this.getLegalLabel(biz)} : <strong>${biz.taxId}</strong>`);
    }

    if (biz.legal && typeof biz.legal === 'string') {
      const cleanLegal = biz.legal.trim();
      if (cleanLegal && !parts.some(p => cleanLegal.includes(p.replace(/<[^>]+>/g, '')))) {
        parts.push(cleanLegal);
      }
    }

    return parts.join(' · ');
  },

  // ── 7. BLOC TOTAL (Sous le tableau, fond plein couleur, readableOn, 20px) ─
  renderTotals: function (d, ac, isDark = false) {
    const _t = (key) => (window.KivoI18n ? KivoI18n.t(key, d.lang || 'fr') : key);
    const lblSubtotal = d.lblSubtotal || _t('doc_subtotal_ht');
    const lblTax = d.lblTax || _t('doc_vat_calc');

    // Libellé : 'Total à payer' si TVA=0 ou désactivée, 'Total TTC' sinon.
    // Ne jamais écraser les libellés personnalisés de l'utilisateur.
    const isVatActive = d.showVat !== false && Number(d.taxAmount || 0) > 0;
    let lblTotal = d.lblTotal;
    if (!lblTotal || lblTotal === 'Total TTC' || lblTotal === 'Total à payer') {
      lblTotal = isVatActive ? 'Total TTC' : 'Total à payer';
    }

    const showVat = d.showVat !== false;
    const showDiscount = d.showDiscount !== false && (d.discount > 0);
    const showDeposit = d.showDeposit !== false && (d.deposit > 0);
    const depositAmount = showDeposit ? (d.deposit || 0) : 0;
    const balanceDue = Math.max(0, (d.grandTotal || 0) - depositAmount);

    const textOnPrimary = this.readableOn(ac);
    const textDark = isDark ? '#E2E8F0' : '#0F172A';
    const mutedDark = isDark ? '#94A3B8' : '#475569';

    return `
      <!-- Totals Block: Directement sous le tableau -->
      <div style="display:flex;justify-content:flex-end;margin-top:12px;margin-bottom:20px;break-inside:avoid;page-break-inside:avoid;">
        <div style="width:320px;font-size:13px;">
          <div style="display:flex;justify-content:space-between;padding:4px 0;color:${mutedDark};">
            <span>${lblSubtotal}</span><strong style="color:${textDark};">${this.fmt(d.subtotal, d.currency)}</strong>
          </div>
          ${showDiscount ? `
            <div style="display:flex;justify-content:space-between;padding:4px 0;color:#EF4444;font-weight:600;">
              <span>Remise</span><strong>-${this.fmt(d.discount, d.currency)}</strong>
            </div>` : ''}
          ${showVat ? `
            <div style="display:flex;justify-content:space-between;padding:4px 0;color:${mutedDark};">
              <span>${lblTax}</span><strong style="color:${textDark};">${this.fmt(d.taxAmount, d.currency)}</strong>
            </div>` : ''}

          <!-- Grand Total Box avec fond plein et texte contrasté via readableOn() -->
          <div style="background:${ac};color:${textOnPrimary};padding:10px 14px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;margin-top:8px;box-shadow:0 2px 6px rgba(0,0,0,0.08);">
            <span style="font-size:13px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;">${lblTotal}</span>
            <span style="font-size:20px;font-weight:800;letter-spacing:-0.01em;">${this.fmt(d.grandTotal, d.currency)}</span>
          </div>

          ${showDeposit ? `
            <div style="display:flex;justify-content:space-between;padding:5px 0;color:#059669;font-size:12px;margin-top:6px;font-weight:600;">
              <span>${d.lblDeposit || 'Acompte déjà versé'}</span><strong>-${this.fmt(depositAmount, d.currency)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:15px;font-weight:800;color:#D97706;border-top:1px dashed ${isDark ? '#475569' : '#CBD5E1'};padding-top:6px;margin-top:4px;">
              <span>${d.lblBalance || 'Solde net à payer'}</span><span>${this.fmt(balanceDue, d.currency)}</span>
            </div>` : ''}
        </div>
      </div>
    `;
  },

  // ── 6 & 8. Paiements, Remerciements & Footer (Poussés en bas via margin-top:auto) ──
  renderBottom: function (d, ac, isDark = false) {
    const _t = (key) => (window.KivoI18n ? KivoI18n.t(key, d.lang || 'fr') : key);
    const legalText = this.getLegalMentions(d.biz);
    const clientLegal = (d.client && d.client.taxId) ? `Client : ${d.client.name || ''} · ${d.client.legalFieldName || 'N° Fiscal'} : <strong>${d.client.taxId}</strong>` : '';

    const showPay = d.showPaymentMethods !== false && (d.paymentMethod || d.paymentDetails);
    const showNotes = d.showNotes !== false && d.notes && d.notes.trim();

    // Biz contact parts without empty values
    const bizCountry = (d.biz && d.biz.country) || 'CG';
    const bizPhoneFormatted = d.biz && d.biz.phone ? this.fmtPhone(d.biz.phone, bizCountry) : '';
    const bizParts = [
      (d.biz && d.biz.name) || (d.biz && d.biz.owner) || 'Mon Entreprise',
      d.biz && d.biz.address,
      bizPhoneFormatted ? ('Tél. : ' + bizPhoneFormatted) : '',
      d.biz && d.biz.email
    ].filter(Boolean);

    const textDark = isDark ? '#E2E8F0' : '#0F172A';
    const mutedDark = isDark ? '#94A3B8' : '#475569';
    const footerColor = isDark ? '#94A3B8' : '#4B5563';

    return `
      <div style="margin-top:auto;padding-top:16px;border-top:1.5px solid ${isDark ? '#2D323F' : '#E2E8F0'};break-inside:avoid;page-break-inside:avoid;">
        
        <!-- Payment Info & Notes -->
        ${(showPay || showNotes) ? `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;background:${isDark ? '#222631' : '#F8FAFC'};padding:12px 16px;border-radius:8px;font-size:12px;color:${mutedDark};margin-bottom:14px;">
          <div>
            ${showPay ? `
              <strong style="color:${textDark};display:block;margin-bottom:4px;">${_t('doc_payment_title')}</strong>
              ${d.paymentMethod ? `<div>${_t('doc_mode')} <span style="font-weight:600;color:${textDark};">${d.paymentMethod}</span></div>` : ''}
              ${d.terms ? `<div>${_t('doc_terms')} <span style="font-weight:600;color:${textDark};">${d.terms}</span></div>` : ''}
              ${d.paymentDetails ? `<div style="margin-top:4px;white-space:pre-wrap;font-size:12px;color:${isDark ? '#CBD5E1' : '#334155'};">${d.paymentDetails}</div>` : ''}
            ` : ''}
          </div>
          <div>
            ${showNotes ? `
              <strong style="color:${textDark};display:block;margin-bottom:4px;">${_t('doc_notes')}</strong>
              <div style="white-space:pre-wrap;">${d.notes}</div>
            ` : ''}
          </div>
        </div>` : ''}

        <!-- Thank-you note -->
        ${(d.showThankYou !== false && d.thankYouText && d.thankYouText.trim()) ? `
          <div style="text-align:center;font-size:13px;font-weight:700;color:${this.textOnWhite(ac)};margin:8px 0 10px 0;letter-spacing:0.02em;">
            ${d.thankYouText.trim()}
          </div>` : ''}

        <!-- Footer / Mentions légales (TOUJOURS LE DERNIER BLOC DANS LE FLUX, min 12px, #4B5563) -->
        ${d.showLegalNotices !== false ? `
        <div style="text-align:center;font-size:12px;color:${footerColor};padding-top:10px;border-top:1px solid ${isDark ? '#2D323F' : '#E2E8F0'};line-height:1.6;">
          <div>${bizParts.join(' · ')}</div>
          ${(d.legalNotices && d.legalNotices.trim()) ? `<div style="margin-top:4px;font-size:12px;color:${footerColor};">${d.legalNotices.trim()}</div>` : ''}
          ${legalText ? `<div style="font-size:12px;color:${footerColor};margin-top:3px;">${legalText}</div>` : ''}
          ${clientLegal ? `<div style="font-size:12px;color:${footerColor};margin-top:3px;">${clientLegal}</div>` : ''}
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
              <div style="padding:2px 3px;font-size:4.8px;color:#1E3A5F;background:#EFF6FF;display:flex;">
                <div style="flex:2;">Audit SI</div><div style="width:14px;text-align:center;">1</div><div style="width:14px;text-align:center;">18%</div><div style="width:26px;text-align:right;">150k</div>
              </div>
            </div>
            <div style="margin-top:auto;background:#1E3A5F;color:#fff;padding:3px 4px;border-radius:2px;display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:4.8px;">TOTAL TTC</span>
              <span style="font-size:6px;font-weight:800;">177 000 FCFA</span>
            </div>
          </div>
        </div>`, '#fff'),

      elegant: () => wrap(`
        <div style="background:#FFFDF7;height:100%;display:flex;flex-direction:column;box-sizing:border-box;font-family:Georgia,serif;border:3px solid #F6F1E5;padding:7px;">
          <div style="text-align:center;border-bottom:1px solid #C9A84C;padding-bottom:4px;margin-bottom:5px;">
            <div style="font-size:9px;font-weight:900;letter-spacing:1px;color:#C9A84C;">KIVO</div>
            <div style="font-size:5px;color:#6B5C2A;letter-spacing:0.5px;">MAISON DE CONSEIL</div>
          </div>
          <div style="font-size:5px;color:#6B5C2A;margin-bottom:4px;">
            <span style="font-style:italic;">Destinataire :</span> Maison Blanche SARL
          </div>
          <div style="border-bottom:1px solid #C9A84C;padding-bottom:2px;margin-bottom:2px;display:flex;font-size:4.8px;font-weight:700;color:#C9A84C;">
            <div style="flex:2;">Prestation</div><div style="width:14px;text-align:center;">TVA</div><div style="width:26px;text-align:right;">Honoraires</div>
          </div>
          <div style="padding:2px 0;font-size:4.8px;color:#2D241E;display:flex;">
            <div style="flex:2;">Accompagnement</div><div style="width:14px;text-align:center;">18%</div><div style="width:26px;text-align:right;">450k</div>
          </div>
          <div style="margin-top:auto;border-top:1.5px solid #C9A84C;padding-top:3px;display:flex;justify-content:space-between;font-size:6px;font-weight:900;color:#2D241E;">
            <span>TOTAL TTC</span>
            <span style="color:#C9A84C;">531 000 FCFA</span>
          </div>
        </div>`, '#FFFDF7'),

      modern: () => wrap(`
        <div style="background:#fff;height:100%;display:flex;flex-direction:column;box-sizing:border-box;font-family:Inter,sans-serif;padding:7px;">
          <div style="height:3px;background:linear-gradient(90deg,#7C3AED,#EC4899);border-radius:2px;margin-bottom:5px;"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
            <span style="font-size:9px;font-weight:900;color:#7C3AED;">KIVO</span>
            <span style="background:#F5F3FF;color:#7C3AED;font-size:5px;font-weight:700;padding:1px 4px;border-radius:4px;">INV-001</span>
          </div>
          <div style="background:#F8FAFC;border-radius:3px;padding:3px;margin-bottom:4px;font-size:5px;color:#475569;">
            Client : FinTech Solutions
          </div>
          <div style="border-radius:3px;overflow:hidden;margin-bottom:3px;">
            <div style="background:#7C3AED;color:#fff;padding:2px 3px;font-size:4.8px;font-weight:700;display:flex;">
              <div style="flex:2;">Service</div><div style="width:14px;text-align:center;">Qté</div><div style="width:24px;text-align:right;">Prix</div>
            </div>
            <div style="padding:2px 3px;font-size:4.8px;color:#334155;background:#F5F3FF;display:flex;">
              <div style="flex:2;">API Integration</div><div style="width:14px;text-align:center;">1</div><div style="width:24px;text-align:right;">180k</div>
            </div>
          </div>
          <div style="margin-top:auto;background:linear-gradient(90deg,#7C3AED,#EC4899);color:#fff;padding:3px 5px;border-radius:3px;display:flex;justify-content:space-between;font-size:6px;font-weight:800;">
            <span>TOTAL TTC</span>
            <span>212 400 FCFA</span>
          </div>
        </div>`, '#fff'),

      clean: () => wrap(`
        <div style="background:#fff;height:100%;display:flex;flex-direction:column;box-sizing:border-box;font-family:Inter,sans-serif;border-top:3px solid #0E7490;padding:7px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5px;">
            <div>
              <div style="font-size:8px;font-weight:900;color:#0E7490;">KIVO</div>
              <div style="font-size:5px;color:#64748B;">CLEAN DESIGN</div>
            </div>
            <span style="font-size:5px;color:#0E7490;font-weight:700;">#FAC-008</span>
          </div>
          <div style="font-size:5px;color:#334155;margin-bottom:4px;padding-left:3px;border-left:2px solid #0E7490;">
            Client : Nexus Corp
          </div>
          <div style="border:1px solid #CCFBF1;border-radius:2px;overflow:hidden;margin-bottom:3px;">
            <div style="background:#0E7490;color:#fff;padding:2px 3px;font-size:4.8px;display:flex;">
              <div style="flex:2;">Ligne</div><div style="width:14px;text-align:center;">TVA</div><div style="width:24px;text-align:right;">Montant</div>
            </div>
            <div style="padding:2px 3px;font-size:4.8px;color:#0E7490;background:#F0FDFA;display:flex;">
              <div style="flex:2;">Maintenance</div><div style="width:14px;text-align:center;">18%</div><div style="width:24px;text-align:right;">95k</div>
            </div>
          </div>
          <div style="margin-top:auto;border-top:1px solid #CCFBF1;padding-top:2px;display:flex;justify-content:space-between;font-size:6px;font-weight:800;color:#0E7490;">
            <span>TOTAL TTC</span>
            <span>112 100 FCFA</span>
          </div>
        </div>`, '#fff'),

      editorial: () => wrap(`
        <div style="background:#fff;height:100%;display:flex;flex-direction:column;box-sizing:border-box;font-family:Inter,sans-serif;">
          <div style="background:#111;padding:5px 7px;display:flex;justify-content:space-between;align-items:center;">
            <div style="color:#fff;font-size:8px;font-weight:900;">KIVO</div>
            <div style="color:#EF4444;font-size:6px;font-weight:800;">FACTURE</div>
          </div>
          <div style="padding:6px 7px;flex:1;display:flex;flex-direction:column;">
            <div style="font-size:5px;color:#111;margin-bottom:4px;font-weight:700;">
              CLIENT : EDITIONS K.
            </div>
            <div style="border:1px solid #111;margin-bottom:3px;">
              <div style="background:#111;color:#fff;padding:2px 3px;font-size:4.5px;display:flex;font-weight:800;">
                <div style="flex:2;">ARTICLE</div><div style="width:24px;text-align:right;background:#EF4444;">TOTAL</div>
              </div>
              <div style="padding:2px 3px;font-size:4.8px;color:#111;display:flex;">
                <div style="flex:2;">Direction Artistique</div><div style="width:24px;text-align:right;font-weight:700;">320k</div>
              </div>
            </div>
            <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center;background:#111;color:#fff;padding:3px 5px;">
              <span style="font-size:5px;font-weight:800;">TOTAL TTC</span>
              <span style="font-size:6.5px;font-weight:900;color:#EF4444;">377 600 FCFA</span>
            </div>
          </div>
        </div>`, '#fff'),

      premium: () => wrap(`
        <div style="background:#181A20;height:100%;display:flex;flex-direction:column;box-sizing:border-box;font-family:Inter,sans-serif;padding:7px;color:#F1F5F9;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <span style="font-size:9px;font-weight:900;color:#D49B7A;">KIVO</span>
            <span style="font-size:5px;color:#B87352;letter-spacing:1px;">EXCLUSIVE</span>
          </div>
          <div style="height:2px;background:linear-gradient(90deg,#D49B7A,#fff,#B87352);margin-bottom:5px;"></div>
          <div style="background:#222631;border-radius:2px;padding:3px;margin-bottom:4px;font-size:5px;color:#94A3B8;">
            Client : Luxe & Partners
          </div>
          <div style="border:1px solid #2D323F;border-radius:2px;overflow:hidden;margin-bottom:3px;">
            <div style="background:#222631;color:#D49B7A;padding:2px 3px;font-size:4.5px;display:flex;">
              <div style="flex:2;">Service</div><div style="width:24px;text-align:right;">Montant</div>
            </div>
            <div style="padding:2px 3px;font-size:4.8px;color:#F1F5F9;background:#2A221E;display:flex;">
              <div style="flex:2;">Branding Premium</div><div style="width:24px;text-align:right;color:#D49B7A;">600k</div>
            </div>
          </div>
          <div style="margin-top:auto;border-top:1px solid #D49B7A;padding-top:2px;display:flex;justify-content:space-between;font-size:6px;font-weight:900;color:#D49B7A;">
            <span>TOTAL TTC</span>
            <span>708 000 FCFA</span>
          </div>
        </div>`, '#181A20'),

      emerald: () => wrap(`
        <div style="background:#fff;height:100%;display:flex;flex-direction:column;box-sizing:border-box;font-family:Inter,sans-serif;">
          <div style="height:3px;display:flex;width:100%;">
            <div style="flex:1;background:#0F766E;"></div>
            <div style="width:30px;background:#00A884;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px;">
            <span style="font-size:7px;font-weight:900;color:#0F172A;">KIVO</span>
            <div style="background:#00A884;color:#fff;font-size:6px;font-weight:800;padding:2px 6px;border-radius:2px 0 0 2px;">FACTURE</div>
          </div>
          <div style="padding:0 6px 4px;flex:1;display:flex;flex-direction:column;">
            <div style="font-size:4.8px;color:#475569;margin-bottom:3px;text-align:right;">
              <strong>Client :</strong> Studio Pulse SARL
            </div>
            <div style="border-radius:2px;overflow:hidden;margin-bottom:3px;">
              <div style="display:flex;background:#00A884;color:#fff;padding:2px 3px;font-size:4.5px;font-weight:700;">
                <div style="width:10px;">#</div><div style="flex:2;">Article</div><div style="width:16px;text-align:right;">Total</div>
              </div>
              <div style="padding:2px 3px;font-size:4.5px;color:#334155;background:#fff;display:flex;">
                <div style="width:10px;color:#00A884;">01</div><div style="flex:2;">Prestation UI</div><div style="width:16px;text-align:right;">250k</div>
              </div>
              <div style="padding:2px 3px;font-size:4.5px;color:#334155;background:#F0FAF8;display:flex;">
                <div style="width:10px;color:#00A884;">02</div><div style="flex:2;">Audit Design</div><div style="width:16px;text-align:right;">139k</div>
              </div>
            </div>
            <div style="margin-top:auto;display:flex;justify-content:flex-end;">
              <div style="background:#00A884;color:#fff;padding:2px 6px;border-radius:2px;display:flex;gap:6px;align-items:center;">
                <span style="font-size:4.5px;opacity:0.9;">Total TTC</span>
                <span style="font-size:6px;font-weight:900;">389 400</span>
              </div>
            </div>
          </div>
          <div style="background:#00A884;height:6px;width:100%;"></div>
        </div>`, '#fff'),
    };

    const fn = templates[id] || templates['minimalist'];
    return fn();
  },

  // ══════════════════════════════════════════════════════════════
  // FULL INVOICE RENDERERS (GARANTIS FLEX COLUMN, TOTAL SOUS TABLEAU)
  // ══════════════════════════════════════════════════════════════

  // 1. MINIMALIST (Design épuré officiel KIVO)
  renderMinimalist: function (d) {
    const ac = d.primaryColor || '#0F172A';
    return `
      <div class="kivo-invoice-sheet" style="background:#FFFFFF;font-family:Inter,Arial,sans-serif;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;padding:34px 40px;color:#1E293B;position:relative;break-inside:auto;page-break-inside:auto;">
        <div>
          ${this.renderHeader(d, ac, '#475569')}
          ${this.renderClient(d, '#0F172A', '#475569')}

          <table style="width:100%;border-collapse:collapse;margin-bottom:0;font-size:13px;table-layout:fixed;break-inside:auto;page-break-inside:auto;">
            ${this.tableColgroup()}
            <thead>
              <tr style="border-bottom:2px solid ${ac};">
                <th style="padding:9px 12px;text-align:left;color:#0F172A;font-weight:700;">${d.colDesc || 'Description'}</th>
                <th style="padding:9px 12px;text-align:center;color:#0F172A;font-weight:700;">${d.colQty || 'Quantité'}</th>
                <th style="padding:9px 12px;text-align:right;color:#0F172A;font-weight:700;">${d.colPrice || 'Prix Unitaire'}</th>
                <th style="padding:9px 12px;text-align:center;color:#0F172A;font-weight:700;">${d.colTax || 'TVA'}</th>
                <th style="padding:9px 12px;text-align:right;color:#0F172A;font-weight:700;">${d.colTotal || 'Total'}</th>
              </tr>
            </thead>
            <tbody>${this.rows(d.items, d.currency, null, false, d)}</tbody>
          </table>

          ${this.renderTotals(d, ac, false)}
        </div>

        ${this.renderBottom(d, ac, false)}
      </div>
    `;
  },

  // 2. CORPORATE (Bandeau et en-tête pleins)
  renderCorporate: function (d) {
    const ac = d.primaryColor || '#1E3A5F';
    const textOnHeader = this.readableOn(ac);
    return `
      <div class="kivo-invoice-sheet" style="background:#FFFFFF;font-family:Inter,Arial,sans-serif;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;color:#1E293B;position:relative;break-inside:auto;page-break-inside:auto;">
        <div>
          <div style="background:${ac};padding:22px 40px;color:${textOnHeader};margin-bottom:22px;">
            ${this.renderHeader(d, textOnHeader, textOnHeader === '#FFFFFF' ? 'rgba(255,255,255,0.8)' : '#374151', false, ac)}
          </div>
          <div style="padding:0 40px;">
            ${this.renderClient(d, '#0F172A', '#475569')}

            <table style="width:100%;border-collapse:collapse;margin-bottom:0;font-size:13px;table-layout:fixed;break-inside:auto;page-break-inside:auto;">
              ${this.tableColgroup()}
              <thead>
                <tr style="background:${ac};color:${this.readableOn(ac)};">
                  <th style="padding:9px 12px;text-align:left;font-weight:700;">${d.colDesc || 'Description'}</th>
                  <th style="padding:9px 12px;text-align:center;font-weight:700;">${d.colQty || 'Quantité'}</th>
                  <th style="padding:9px 12px;text-align:right;font-weight:700;">${d.colPrice || 'Prix Unitaire'}</th>
                  <th style="padding:9px 12px;text-align:center;font-weight:700;">${d.colTax || 'TVA'}</th>
                  <th style="padding:9px 12px;text-align:right;font-weight:700;">${d.colTotal || 'Total'}</th>
                </tr>
              </thead>
              <tbody>${this.rows(d.items, d.currency, '#EFF6FF', false, d)}</tbody>
            </table>

            ${this.renderTotals(d, ac, false)}
          </div>
        </div>

        <div style="padding:0 40px 28px 40px;margin-top:auto;">
          ${this.renderBottom(d, ac, false)}
        </div>
      </div>
    `;
  },

  // 3. ELEGANT (Dorure et typographie noble)
  renderElegant: function (d) {
    const ac = d.primaryColor || '#C9A84C';
    const textAc = this.textOnWhite(ac);
    return `
      <div class="kivo-invoice-sheet" style="background:#FFFDF7;font-family:Georgia,serif;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;padding:32px 38px;color:#2D241E;border:6px solid #F6F1E5;position:relative;break-inside:auto;page-break-inside:auto;">
        <div>
          ${this.renderHeader(d, textAc, '#6B5C2A')}
          ${this.renderClient(d, '#2D241E', '#6B5C2A')}

          <table style="width:100%;border-collapse:collapse;margin-bottom:0;font-size:13px;table-layout:fixed;break-inside:auto;page-break-inside:auto;">
            ${this.tableColgroup()}
            <thead>
              <tr style="border-bottom:2px solid ${ac};color:${textAc};">
                <th style="padding:9px 12px;text-align:left;font-weight:700;">${d.colDesc || 'Description'}</th>
                <th style="padding:9px 12px;text-align:center;font-weight:700;">${d.colQty || 'Quantité'}</th>
                <th style="padding:9px 12px;text-align:right;font-weight:700;">${d.colPrice || 'Prix Unitaire'}</th>
                <th style="padding:9px 12px;text-align:center;font-weight:700;">${d.colTax || 'TVA'}</th>
                <th style="padding:9px 12px;text-align:right;font-weight:700;">${d.colTotal || 'Montant'}</th>
              </tr>
            </thead>
            <tbody>${this.rows(d.items, d.currency, '#FDF9EF', false, d)}</tbody>
          </table>

          ${this.renderTotals(d, ac, false)}
        </div>

        ${this.renderBottom(d, ac, false)}
      </div>
    `;
  },

  // 4. MODERN (Liseré dégradé et badges)
  renderModern: function (d) {
    const ac = d.primaryColor || '#7C3AED';
    const sec = d.secondaryColor || '#EC4899';
    return `
      <div class="kivo-invoice-sheet" style="background:#FFFFFF;font-family:Inter,sans-serif;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;padding:32px 40px;position:relative;break-inside:auto;page-break-inside:auto;">
        <div>
          <div style="height:6px;background:linear-gradient(90deg,${ac},${sec});border-radius:3px;margin-bottom:20px;"></div>
          ${this.renderHeader(d, this.textOnWhite(ac), '#475569')}
          ${this.renderClient(d, '#0F172A', '#475569')}

          <table style="width:100%;border-collapse:collapse;margin-bottom:0;font-size:13px;table-layout:fixed;break-inside:auto;page-break-inside:auto;">
            ${this.tableColgroup()}
            <thead>
              <tr style="background:${ac};color:${this.readableOn(ac)};">
                <th style="padding:9px 12px;text-align:left;font-weight:700;border-radius:4px 0 0 4px;">${d.colDesc || 'Description'}</th>
                <th style="padding:9px 12px;text-align:center;font-weight:700;">${d.colQty || 'Quantité'}</th>
                <th style="padding:9px 12px;text-align:right;font-weight:700;">${d.colPrice || 'Prix Unitaire'}</th>
                <th style="padding:9px 12px;text-align:center;font-weight:700;">${d.colTax || 'TVA'}</th>
                <th style="padding:9px 12px;text-align:right;font-weight:700;border-radius:0 4px 4px 0;">${d.colTotal || 'Total'}</th>
              </tr>
            </thead>
            <tbody>${this.rows(d.items, d.currency, '#F5F3FF', false, d)}</tbody>
          </table>

          ${this.renderTotals(d, ac, false)}
        </div>

        ${this.renderBottom(d, ac, false)}
      </div>
    `;
  },

  // 5. CLEAN (Modern Clean)
  renderClean: function (d) {
    const ac = d.primaryColor || '#0E7490';
    return `
      <div class="kivo-invoice-sheet" style="background:#FFFFFF;font-family:Inter,sans-serif;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;padding:32px 40px;border-top:6px solid ${ac};position:relative;break-inside:auto;page-break-inside:auto;">
        <div>
          ${this.renderHeader(d, this.textOnWhite(ac), '#475569')}
          ${this.renderClient(d, '#0F172A', '#475569')}

          <table style="width:100%;border-collapse:collapse;margin-bottom:0;font-size:13px;table-layout:fixed;break-inside:auto;page-break-inside:auto;">
            ${this.tableColgroup()}
            <thead>
              <tr style="background:${ac};color:${this.readableOn(ac)};">
                <th style="padding:9px 12px;text-align:left;font-weight:700;">${d.colDesc || 'Description'}</th>
                <th style="padding:9px 12px;text-align:center;font-weight:700;">${d.colQty || 'Quantité'}</th>
                <th style="padding:9px 12px;text-align:right;font-weight:700;">${d.colPrice || 'Prix Unitaire'}</th>
                <th style="padding:9px 12px;text-align:center;font-weight:700;">${d.colTax || 'TVA'}</th>
                <th style="padding:9px 12px;text-align:right;font-weight:700;">${d.colTotal || 'Total'}</th>
              </tr>
            </thead>
            <tbody>${this.rows(d.items, d.currency, '#F0FDFA', false, d)}</tbody>
          </table>

          ${this.renderTotals(d, ac, false)}
        </div>

        ${this.renderBottom(d, ac, false)}
      </div>
    `;
  },

  // 6. EDITORIAL (Contraste noir et accent)
  renderEditorial: function (d) {
    const ac = d.primaryColor || '#EF4444';
    return `
      <div class="kivo-invoice-sheet" style="background:#FFFFFF;font-family:Inter,sans-serif;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;color:#111;position:relative;break-inside:auto;page-break-inside:auto;">
        <div>
          <div style="background:#111;padding:20px 40px;color:#FFFFFF;margin-bottom:22px;">
            ${this.renderHeader(d, '#FFFFFF', '#9CA3AF', false, '#111')}
          </div>
          <div style="padding:0 40px;">
            ${this.renderClient(d, '#111', '#4B5563')}

            <table style="width:100%;border-collapse:collapse;margin-bottom:0;font-size:13px;table-layout:fixed;break-inside:auto;page-break-inside:auto;">
              ${this.tableColgroup()}
              <thead>
                <tr style="background:#111;color:#FFFFFF;">
                  <th style="padding:9px 12px;text-align:left;font-weight:800;">${(d.colDesc || 'DESCRIPTION').toUpperCase()}</th>
                  <th style="padding:9px 12px;text-align:center;font-weight:800;">${(d.colQty || 'QTÉ').toUpperCase()}</th>
                  <th style="padding:9px 12px;text-align:right;font-weight:800;">${(d.colPrice || 'P.U').toUpperCase()}</th>
                  <th style="padding:9px 12px;text-align:center;font-weight:800;">${(d.colTax || 'TVA').toUpperCase()}</th>
                  <th style="padding:9px 12px;text-align:right;font-weight:800;background:${ac};color:${this.readableOn(ac)};">${(d.colTotal || 'TOTAL').toUpperCase()}</th>
                </tr>
              </thead>
              <tbody>${this.rows(d.items, d.currency, '#FEE2E2', false, d)}</tbody>
            </table>

            ${this.renderTotals(d, ac, false)}
          </div>
        </div>

        <div style="padding:0 40px 26px 40px;margin-top:auto;">
          ${this.renderBottom(d, ac, false)}
        </div>
      </div>
    `;
  },

  // 7. PREMIUM (Sombre avec bande métallique)
  renderPremium: function (d) {
    const ac = d.primaryColor || '#D49B7A';
    const sec = d.secondaryColor || '#B87352';
    return `
      <div class="kivo-invoice-sheet" style="background:#181A20;font-family:Inter,sans-serif;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;padding:32px 40px;color:#F1F5F9;position:relative;break-inside:auto;page-break-inside:auto;">
        <div>
          ${this.renderHeader(d, ac, '#94A3B8', true, '#181A20')}
          <div style="height:8px;background:linear-gradient(90deg,${ac} 0%,#FFFFFF 50%,${sec} 100%);border-radius:2px;margin-bottom:20px;box-shadow:0 3px 10px rgba(0,0,0,0.3);"></div>
          ${this.renderClient(d, '#FFFFFF', '#94A3B8', true)}

          <table style="width:100%;border-collapse:collapse;margin-bottom:0;font-size:13px;table-layout:fixed;break-inside:auto;page-break-inside:auto;">
            ${this.tableColgroup()}
            <thead>
              <tr style="background:#222631;color:${ac};border-bottom:1.5px solid ${ac};">
                <th style="padding:9px 12px;text-align:left;font-weight:700;">${d.colDesc || 'Description'}</th>
                <th style="padding:9px 12px;text-align:center;font-weight:700;">${d.colQty || 'Quantité'}</th>
                <th style="padding:9px 12px;text-align:right;font-weight:700;">${d.colPrice || 'Prix Unitaire'}</th>
                <th style="padding:9px 12px;text-align:center;font-weight:700;">${d.colTax || 'TVA'}</th>
                <th style="padding:9px 12px;text-align:right;font-weight:700;">${d.colTotal || 'Total'}</th>
              </tr>
            </thead>
            <tbody>${this.rows(d.items, d.currency, '#2A221E', true, d)}</tbody>
          </table>

          ${this.renderTotals(d, ac, true)}
        </div>

        ${this.renderBottom(d, ac, true)}
      </div>
    `;
  },

  // 8. EMERALD (Bandeau biseauté, Total mis en valeur 20px, Flex column)
  renderEmerald: function (d) {
    const _t = (key) => (typeof KivoI18n !== 'undefined' ? KivoI18n.t(key, d.lang || 'fr') : (window.KivoI18n ? window.KivoI18n.t(key, d.lang || 'fr') : key));

    // Colors: Respect user choice, fallback to reference default #00A884 and #0F766E
    const ac = (d.primaryColor && d.primaryColor !== '#000000' && d.primaryColor !== '#000') ? d.primaryColor : '#00A884';
    const sec = (d.secondaryColor && d.secondaryColor !== '#000000' && d.secondaryColor !== '#000') ? d.secondaryColor : '#0F766E';

    // Contrast helpers
    const contrastAc = this.readableOn(ac);
    const textOnWhiteAc = this.textOnWhite(ac);

    const getSoftTint = (hex, factor = 0.94) => {
      const rgb = this.hexToRgb(hex);
      const nr = Math.round(rgb.r + (255 - rgb.r) * factor);
      const ng = Math.round(rgb.g + (255 - rgb.g) * factor);
      const nb = Math.round(rgb.b + (255 - rgb.b) * factor);
      return `rgb(${nr}, ${ng}, ${nb})`;
    };

    const softRowBg = getSoftTint(ac, 0.94);
    const softBoxBg = getSoftTint(ac, 0.96);

    // Document title
    const defaultTitle = d.docType === 'quote' ? _t('doc_quote') : _t('doc_invoice');
    const docTitle = (d.docTitleText && d.docTitleText.trim()) ? d.docTitleText.trim() : defaultTitle;

    // Dates formatted via fmtDate (dd/mm/yyyy)
    const formattedIssueDate = this.fmtDate(d.issueDate);
    const formattedDueDate = d.dueDate ? this.fmtDate(d.dueDate) : '';

    // Phones formatted (Congo: 05 518 1314)
    const bizCountry = (d.biz && d.biz.country) || 'CG';
    const clientCountry = (d.client && d.client.country) || bizCountry;
    const bizPhoneFormatted = d.biz && d.biz.phone ? this.fmtPhone(d.biz.phone, bizCountry) : '';
    const clientPhoneFormatted = d.client && d.client.phone ? this.fmtPhone(d.client.phone, clientCountry) : '';

    // Logo & Business
    const showLogo = d.showLogo !== false;
    const logo = showLogo ? this.logoHtml(d.biz, 70, 'square', false) : '';
    const bizName = (d.biz && d.biz.name) ? d.biz.name : ((d.biz && d.biz.owner) || 'Mon Entreprise');
    const legalText = this.getLegalMentions(d.biz);
    const bizLegal = legalText ? `<div style="font-size:12px;color:#475569;margin-top:2px;">${legalText}</div>` : '';

    // Badges
    const paidBadge = (d.status === 'paid' && d.docType !== 'quote') ? `
      <div style="display:inline-flex;align-items:center;gap:6px;padding:3px 12px;background:#ECFDF5;border:1.5px solid #10B981;border-radius:20px;font-size:11px;font-weight:800;color:#047857;letter-spacing:0.04em;text-transform:uppercase;margin-top:4px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        ${_t('doc_paid_badge')}
      </div>` : (d.status === 'refunded' ? `
      <div style="display:inline-flex;align-items:center;gap:6px;padding:3px 12px;background:#FEF2F2;border:1.5px solid #EF4444;border-radius:20px;font-size:11px;font-weight:800;color:#B91C1C;letter-spacing:0.04em;text-transform:uppercase;margin-top:4px;">
        ${_t('doc_refunded_badge')}
      </div>` : '');

    // Items list
    let list = d.items;
    if (list && typeof list === 'object' && !Array.isArray(list) && Array.isArray(list.lines)) list = list.lines;
    else if (typeof list === 'string') {
      try { const p = JSON.parse(list); list = Array.isArray(p) ? p : (p && Array.isArray(p.lines) ? p.lines : []); } catch (_) { list = []; }
    }
    const filteredItems = (list && Array.isArray(list)) ? list.filter(it => (it.name && String(it.name).trim().length > 0) || Number(it.totalHT || it.total || it.price || 0) > 0) : [];

    const showVat = d.showVat !== false;

    // Table rows rendering (texte #1F2937, min 13px, unité #475569)
    let rowsHtml = '';
    if (filteredItems.length === 0) {
      rowsHtml = `<tr><td colspan="${showVat ? 6 : 5}" style="text-align:center;color:#475569;padding:18px;font-size:13px;">Aucun article saisi</td></tr>`;
    } else {
      rowsHtml = filteredItems.map((it, i) => {
        const rowBg = i % 2 === 1 ? softRowBg : '#FFFFFF';
        const itemNum = (i + 1 < 10 ? '0' : '') + (i + 1);
        const unitStr = it.unit ? ` <span style="font-size:12px;color:#475569;font-weight:400;">${it.unit}</span>` : '';
        const discStr = (it.discount && Number(it.discount) > 0) ? `<div style="font-size:11px;color:#EF4444;font-weight:700;white-space:nowrap;">-${it.discount}%</div>` : '';
        const descHtml = this.cleanDesc(it.name || 'Article sans désignation');
        const priceVal = this.fmt(it.price || 0, d.currency);
        const totalVal = this.fmt(it.totalHT || 0, d.currency);
        const taxVal = showVat ? ((it.taxRate !== undefined && it.taxRate !== '' && it.taxRate !== null) ? it.taxRate + ' %' : '-') : '';

        return `
          <tr style="background:${rowBg};break-inside:avoid;page-break-inside:avoid;">
            <td style="padding:10px 8px;vertical-align:top;border-bottom:1px solid #E2E8F0;text-align:center;font-weight:700;color:${textOnWhiteAc};font-size:13px;">${itemNum}</td>
            <td style="padding:10px 12px;vertical-align:top;border-bottom:1px solid #E2E8F0;font-size:13px;line-height:1.45;color:#1F2937;overflow-wrap:anywhere;"><strong style="color:#1F2937;font-weight:700;">${descHtml}</strong></td>
            <td style="padding:10px 12px;vertical-align:top;border-bottom:1px solid #E2E8F0;font-size:13px;color:#1F2937;text-align:right;white-space:nowrap;">${priceVal}</td>
            <td style="padding:10px 8px;vertical-align:top;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;text-align:center;white-space:nowrap;">${it.quantity}${unitStr}</td>
            ${showVat ? `<td style="padding:10px 8px;vertical-align:top;border-bottom:1px solid #E2E8F0;font-size:13px;color:#475569;text-align:center;white-space:nowrap;">${taxVal}</td>` : ''}
            <td style="padding:10px 12px;vertical-align:top;border-bottom:1px solid #E2E8F0;font-size:13px;font-weight:700;color:#1F2937;text-align:right;white-space:nowrap;">
              ${totalVal}
              ${discStr}
            </td>
          </tr>
        `;
      }).join('');
    }

    // Payment Info block
    const showPay = d.showPaymentMethods !== false && (d.paymentMethod || d.paymentDetails);
    const payBlockHtml = showPay ? `
      <div style="margin-top:16px;background:${softBoxBg};border:1px solid rgba(0,0,0,0.06);border-left:3px solid ${ac};border-radius:4px;padding:8px 12px;font-size:12px;line-height:1.5;">
        <div style="font-size:11px;font-weight:800;color:${textOnWhiteAc};letter-spacing:0.04em;text-transform:uppercase;margin-bottom:3px;">
          ${_t('doc_payment_info') || 'INFOS DE RÈGLEMENT'}
        </div>
        ${d.paymentMethod ? `<div style="color:#1F2937;"><strong>Mode :</strong> ${d.paymentMethod}</div>` : ''}
        ${d.paymentDetails ? `<div style="color:#475569;margin-top:2px;">${d.paymentDetails.replace(/\n/g, '<br>')}</div>` : ''}
      </div>` : '';

    // Client box (champs vides masqués, aucun '--' affiché)
    const clientName = (d.client && (d.client.company || d.client.name)) || '';
    const clientAddress = (d.client && d.client.address) ? d.client.address.replace(/\n/g, '<br>') : '';
    const clientContact = [clientPhoneFormatted ? ('Tél. : ' + clientPhoneFormatted) : '', d.client && d.client.email].filter(Boolean).join(' · ');
    const clientTaxId = (d.client && d.client.taxId) ? `<div style="font-size:11px;color:#475569;margin-top:2px;">${d.client.legalFieldName || 'N° Fiscal'} : ${d.client.taxId}</div>` : '';

    const clientBlockHtml = clientName ? `
      <div style="margin-top:16px;text-align:right;">
        <div style="font-size:11px;font-weight:800;color:${textOnWhiteAc};letter-spacing:0.06em;text-transform:uppercase;margin-bottom:3px;">
          ${_t('doc_bill_to') || 'FACTURÉ À'}
        </div>
        <div style="font-size:14px;font-weight:800;color:#0F172A;">${clientName}</div>
        ${clientAddress ? `<div style="font-size:12px;color:#475569;margin-top:2px;line-height:1.4;">${clientAddress}</div>` : ''}
        ${clientContact ? `<div style="font-size:12px;color:#475569;margin-top:2px;">${clientContact}</div>` : ''}
        ${clientTaxId}
      </div>` : '';

    // Subject / Reference
    const subjectHtml = (d.showSubject !== false && d.subject && d.subject.trim())
      ? `<div style="font-size:12px;color:#1F2937;margin-top:3px;"><span style="color:#475569;font-weight:600;">Objet :</span> <strong>${d.subject.trim()}</strong></div>`
      : '';

    // Totals calculations & Grand Total box
    const subtotalFormatted = this.fmt(d.subtotal || 0, d.currency);
    const taxFormatted = this.fmt(d.taxAmount || 0, d.currency);
    const grandTotalFormatted = this.fmt(d.grandTotal || 0, d.currency);

    const isVatActive = d.showVat !== false && Number(d.taxAmount || 0) > 0;
    let totalLabel = d.lblTotal;
    if (!totalLabel || totalLabel === 'Total TTC' || totalLabel === 'Total à payer') {
      totalLabel = isVatActive ? 'Total TTC' : 'Total à payer';
    }

    const discountRow = (d.showDiscount && d.discount > 0) ? `
      <div style="display:flex;justify-content:space-between;padding:3px 0;color:#EF4444;font-size:12px;font-weight:600;">
        <span>Remise globale :</span>
        <span>- ${this.fmt(d.discount, d.currency)}</span>
      </div>` : '';

    const depositRow = (d.showDeposit && d.deposit > 0) ? `
      <div style="display:flex;justify-content:space-between;padding:3px 0;color:#059669;font-size:12px;border-top:1px dashed #CBD5E1;margin-top:6px;padding-top:6px;font-weight:600;">
        <span>${d.lblDeposit || 'Acompte déjà versé'} :</span>
        <span>- ${this.fmt(d.deposit, d.currency)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;color:#D97706;font-size:14px;font-weight:800;">
        <span>${d.lblBalance || 'Solde net à payer'} :</span>
        <span>${this.fmt(d.balanceDue, d.currency)}</span>
      </div>` : '';

    return `
      <div class="kivo-invoice-sheet" style="background:#FFFFFF;font-family:Inter,sans-serif;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;position:relative;color:#0F172A;margin:0 auto;break-inside:auto;page-break-inside:auto;">
        
        <!-- Haut du document -->
        <div>
          <!-- Liseré bi-couleur tout en haut -->
          <div style="height:8px;display:flex;width:100%;">
            <div style="flex:1;background:#1E293B;"></div>
            <div style="width:360px;background:${sec};"></div>
            <div style="width:200px;background:${ac};"></div>
          </div>

          <!-- Section En-tête -->
          <div style="padding:24px 36px 14px 36px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;">
              
              <!-- Gauche : Logo + Émetteur + Infos de règlement -->
              <div style="flex:1;max-width:48%;">
                ${logo ? `<div style="margin-bottom:10px;">${logo}</div>` : ''}
                <div style="font-family:'Outfit',Inter,sans-serif;font-size:20px;font-weight:900;color:${textOnWhiteAc};letter-spacing:-0.02em;">
                  ${bizName}
                </div>
                <div style="font-size:12px;color:#475569;line-height:1.45;margin-top:4px;">
                  ${d.biz.address ? d.biz.address + '<br>' : ''}
                  ${bizPhoneFormatted ? 'Tél. : ' + bizPhoneFormatted + '<br>' : ''}
                  ${d.biz.email ? d.biz.email + '<br>' : ''}
                  ${bizLegal}
                </div>
                ${payBlockHtml}
              </div>

              <!-- Droite : Titre angulaire & Métadonnées & Client -->
              <div style="flex:1;max-width:48%;display:flex;flex-direction:column;align-items:flex-end;">
                
                <!-- Bandeau biseauté INVOICE / FACTURE -->
                <div style="display:flex;align-items:stretch;height:54px;margin-bottom:14px;">
                  <svg width="40" height="54" viewBox="0 0 40 54" style="display:block;flex-shrink:0;">
                    <polygon points="40,0 40,54 0,54" fill="${ac}" />
                  </svg>
                  <div style="background:${ac};color:${contrastAc};padding:0 28px 0 16px;display:flex;align-items:center;justify-content:center;font-family:'Outfit',Inter,sans-serif;font-size:24px;font-weight:900;letter-spacing:0.06em;text-transform:uppercase;">
                    ${docTitle}
                  </div>
                </div>

                <!-- Métadonnées N°, Dates -->
                <div style="text-align:right;font-size:12px;line-height:1.6;color:#475569;">
                  <div><span style="color:#475569;">N° :</span> <strong style="color:${textOnWhiteAc};font-size:13px;">${d.docNum || ''}</strong></div>
                  ${formattedIssueDate ? `<div><span style="color:#475569;">${_t('doc_issue_date_label')} :</span> <strong style="color:#0F172A;">${formattedIssueDate}</strong></div>` : ''}
                  ${formattedDueDate ? `<div><span style="color:#475569;">${_t('doc_due_date_label')} :</span> <strong style="color:#0F172A;">${formattedDueDate}</strong></div>` : ''}
                  ${subjectHtml}
                  ${paidBadge ? `<div style="margin-top:4px;">${paidBadge}</div>` : ''}
                </div>

                <!-- Facturé à (Client) -->
                ${clientBlockHtml}
              </div>

            </div>
          </div>

          <!-- Tableau des Articles -->
          <div style="padding:10px 36px 14px 36px;">
            <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:0;break-inside:auto;page-break-inside:auto;">
              <colgroup>
                <col style="width:40px;">
                <col style="width:auto;min-width:140px;">
                <col style="width:115px;">
                <col style="width:65px;">
                ${showVat ? '<col style="width:60px;">' : ''}
                <col style="width:125px;">
              </colgroup>
              <thead>
                <tr style="background:${ac};color:${contrastAc};">
                  <th style="padding:10px 8px;text-align:center;font-size:12px;font-weight:800;letter-spacing:0.04em;">NO</th>
                  <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;">${d.colDesc || 'Description'}</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;">${d.colPrice || 'Prix unitaire'}</th>
                  <th style="padding:10px 8px;text-align:center;font-size:12px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;">${d.colQty || 'Qté'}</th>
                  ${showVat ? `<th style="padding:10px 8px;text-align:center;font-size:12px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;">${d.colTax || 'TVA'}</th>` : ''}
                  <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;">${d.colTotal || 'Total'}</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>

          <!-- Totaux & Récapitulatif : Directement sous le tableau -->
          <div style="padding:4px 36px 16px 36px;break-inside:avoid;page-break-inside:avoid;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:30px;">
              
              <!-- Gauche : Remerciements & Conditions & Remarques -->
              <div style="flex:1;max-width:55%;">
                ${(d.showThankYou !== false && d.thankYouText && d.thankYouText.trim()) ? `
                  <div style="margin-bottom:12px;">
                    <div style="font-size:11px;font-weight:800;color:${textOnWhiteAc};letter-spacing:0.06em;text-transform:uppercase;margin-bottom:3px;">
                      ${_t('doc_thank_you_title') || 'MERCI POUR VOTRE CONFIANCE'}
                    </div>
                    <div style="font-size:12px;color:#475569;line-height:1.45;">${d.thankYouText.trim()}</div>
                  </div>` : ''}

                ${(d.showNotes !== false && d.notes && d.notes.trim()) ? `
                  <div style="margin-bottom:12px;">
                    <div style="font-size:11px;font-weight:800;color:${textOnWhiteAc};letter-spacing:0.06em;text-transform:uppercase;margin-bottom:3px;">
                      ${_t('doc_notes') || 'Notes & Remarques'}
                    </div>
                    <div style="font-size:12px;color:#475569;line-height:1.45;">${d.notes.trim().replace(/\n/g, '<br>')}</div>
                  </div>` : ''}

                ${(d.terms && d.terms.trim()) ? `
                  <div style="font-size:12px;color:#475569;line-height:1.4;">
                    <strong style="color:#1F2937;">Conditions :</strong> ${d.terms.trim()}
                  </div>` : ''}
              </div>

              <!-- Droite : Récapitulatif Sous-total, TVA, Grand Total mis en valeur 20px, Signature -->
              <div style="width:280px;flex-shrink:0;">
                <div style="border-bottom:1px solid #E2E8F0;padding-bottom:6px;margin-bottom:6px;">
                  <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;color:#475569;">
                    <span>${d.lblSubtotal || 'Sous-total HT'} :</span>
                    <span style="font-weight:600;color:#0F172A;">${subtotalFormatted}</span>
                  </div>
                  ${discountRow}
                  ${showVat ? `
                    <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;color:#475569;">
                      <span>${d.lblTax || 'TVA'} :</span>
                      <span style="font-weight:600;color:#0F172A;">${taxFormatted}</span>
                    </div>` : ''}
                </div>

                <!-- Grand Total Box pleine couleur avec montant 20px gras -->
                <div style="background:${ac};color:${contrastAc};padding:10px 14px;border-radius:4px;display:flex;justify-content:space-between;align-items:center;font-family:'Outfit',Inter,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,0.08);">
                  <span style="font-size:13px;font-weight:800;letter-spacing:0.03em;text-transform:uppercase;">${totalLabel}</span>
                  <span style="font-size:20px;font-weight:800;">${grandTotalFormatted}</span>
                </div>

                ${depositRow}

                <!-- Signature -->
                <div style="margin-top:24px;text-align:center;">
                  <div style="width:140px;margin-left:auto;border-top:1px solid #CBD5E1;padding-top:4px;font-size:11px;color:#475569;font-weight:600;">
                    Signature
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <!-- Bas du document : Mentions légales puis Bandeau Pied de page (poussé en bas via margin-top:auto) -->
        <div style="margin-top:auto;break-inside:avoid;page-break-inside:avoid;">
          <div style="padding:0 36px 10px 36px;font-size:12px;color:#4B5563;line-height:1.5;text-align:center;">
            ${(d.showLegalNotices !== false && d.legalNotices && d.legalNotices.trim()) ? `<div style="margin-bottom:3px;">${d.legalNotices.trim().replace(/\n/g, ' · ')}</div>` : ''}
            ${(d.showLegalNotices !== false && legalText) ? `<div>${legalText}</div>` : ''}
          </div>

          <!-- Footer bandeau plein couleur d'accent -->
          <div style="background:${ac};color:${contrastAc};padding:10px 36px;display:flex;justify-content:space-between;align-items:center;font-size:12px;box-sizing:border-box;">
            <div style="display:flex;align-items:center;gap:6px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <span>${d.biz.email || ''}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <span>${bizPhoneFormatted}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>${d.biz.address ? d.biz.address.split('\n')[0] : ''}</span>
            </div>
          </div>
        </div>

      </div>
    `;
  },

  // ── Main render dispatcher ────────────────────────────────────────────
  render: function (templateId, data) {
    const d = data || this.collectData();
    let html = '';
    switch (templateId) {
      case 'minimalist':  html = this.renderMinimalist(d); break;
      case 'corporate':   html = this.renderCorporate(d); break;
      case 'elegant':     html = this.renderElegant(d); break;
      case 'modern':      html = this.renderModern(d); break;
      case 'clean':       html = this.renderClean(d); break;
      case 'editorial':   html = this.renderEditorial(d); break;
      case 'premium':     html = this.renderPremium(d); break;
      case 'emerald':     html = this.renderEmerald(d); break;
      default:            html = this.renderMinimalist(d); break;
    }

    return html;
  }
};

console.log('[KivoTemplates]', window.KivoTemplates.builtIn.length, 'templates disponibles.');
