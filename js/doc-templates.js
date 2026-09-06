/**
 * KIVO MATIQUE — Document Templates Engine
 * 7 professional templates based on reference designs + gallery system
 * Fully reactive to all builder inputs, line items, and logo color extraction.
 */

window.KivoTemplates = {

  // ── Template Registry (7 models matching reference design) ───────────
  builtIn: [
    { id: 'minimalist', name: 'Minimalist',   desc: 'Clair et concis pour vos factures.' },
    { id: 'corporate',  name: 'Corporate',    desc: 'Formal, accent pour vos factures.' },
    { id: 'elegant',    name: 'Elegant',      desc: 'Refined, fonts pour vos factures.' },
    { id: 'modern',     name: 'Modern',       desc: 'Vibrant, modern pour vos factures.' },
    { id: 'clean',      name: 'Modern Clean', desc: 'Clair et précis pour vos factures.' },
    { id: 'editorial',  name: 'Editorial',    desc: 'Dynamic, striking header typography.' },
    { id: 'premium',    name: 'Premium',      desc: 'Exclusive look, deep copper and dark tones.' }
  ],

  isFullHtml: function (id) {
    return true;
  },

  // ── Helpers ──────────────────────────────────────────────────────────

  fmt: function (n, currency) {
    return (n || 0).toLocaleString('fr-FR') + ' ' + (currency || 'FCFA');
  },

  logoHtml: function (biz, size, shape, fallbackDark = false) {
    const sz = size || '60px';
    const br = shape === 'circle' ? '50%' : (shape === 'none' ? '0' : '6px');
    if (biz && biz.logoUrl) {
      return `<img src="${biz.logoUrl}" style="max-height:${sz};max-width:180px;height:auto;object-fit:contain;border-radius:${br};display:inline-block;" alt="Logo">`;
    }
    const txt = (biz && biz.logoText) || (biz && biz.name ? biz.name.substring(0, 2).toUpperCase() : 'KM');
    const bg  = fallbackDark ? 'linear-gradient(135deg,#D49B7A,#B87352)' : ((biz && biz.logoBg) || 'linear-gradient(135deg,#4F46E5,#7C3AED)');
    return `<div style="width:${sz};height:${sz};border-radius:${br};background:${bg};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:calc(${sz} * 0.36);flex-shrink:0;">${txt}</div>`;
  },

  rows: function (items, currency, accBg, isDark = false) {
    if (!items || items.length === 0) {
      return `<tr><td colspan="4" style="text-align:center;color:${isDark ? '#64748B' : '#94a3b8'};padding:14px;font-size:11px;">Aucun article saisi</td></tr>`;
    }
    return items.map((it, i) => `
      <tr style="background:${isDark ? (i % 2 === 0 ? '#1E222B' : '#181A20') : (i % 2 === 0 ? '#fff' : '#f8fafc')};">
        <td style="padding:10px 12px;font-size:11px;border-bottom:1px solid ${isDark ? '#2D323F' : '#f1f5f9'};color:${isDark ? '#E2E8F0' : '#1E293B'};">
          <strong>${it.name || 'Article sans désignation'}</strong>
        </td>
        <td style="padding:10px 12px;font-size:11px;text-align:center;border-bottom:1px solid ${isDark ? '#2D323F' : '#f1f5f9'};color:${isDark ? '#94A3B8' : '#64748B'};">${it.quantity}</td>
        <td style="padding:10px 12px;font-size:11px;text-align:right;border-bottom:1px solid ${isDark ? '#2D323F' : '#f1f5f9'};color:${isDark ? '#E2E8F0' : '#1E293B'};">${this.fmt(it.price, currency)}</td>
        <td style="padding:10px 12px;font-size:11px;text-align:right;font-weight:600;border-bottom:1px solid ${isDark ? '#2D323F' : '#f1f5f9'};${accBg ? 'background:' + accBg + ';' : ''}color:${isDark ? '#F5D0B5' : '#0F172A'};">${this.fmt(it.total, currency)}</td>
      </tr>`).join('');
  },

  collectData: function (state) {
    const biz = (state && state.business) || {};
    const get = id => { const el = document.getElementById(id); return el ? el.value : ''; };

    // Capture live logo from preview element or state
    const logoImg = document.getElementById('builder-logo-preview-img');
    const liveLogoUrl = (logoImg && logoImg.src && logoImg.style.display !== 'none') ? logoImg.src : (biz.logoUrl || '');
    const activeBiz = Object.assign({}, biz, { logoUrl: liveLogoUrl });

    const clientId = get('builder-doc-client-select');
    const client = (state && state.clients) ? (state.clients.find(c => c.id === clientId) || {}) : {};

    const items = [];
    let subtotal = 0;
    let totalTaxAmount = 0;

    // Read ALL rows in the table even if freshly added
    const itemRows = document.querySelectorAll('#builder-items-tbody tr');
    itemRows.forEach(tr => {
      const nameInput = tr.querySelector('.item-name');
      const qtyInput  = tr.querySelector('.item-qty');
      const priceInput= tr.querySelector('.item-price');
      const taxInput  = tr.querySelector('.item-tax');

      const name  = nameInput ? nameInput.value : '';
      const qty   = qtyInput ? (parseFloat(qtyInput.value) || 1) : 1;
      const price = priceInput ? (parseFloat(priceInput.value) || 0) : 0;
      const taxRate = taxInput ? (parseFloat(taxInput.value) || 18) : 18;

      const itemTotal = qty * price;
      const itemTax = itemTotal * (taxRate / 100);

      subtotal += itemTotal;
      totalTaxAmount += itemTax;

      // Always push the row even if name is blank so preview shows the new row immediately
      items.push({
        name: name || 'Nouvelle prestation',
        quantity: qty,
        price: price,
        taxRate: taxRate,
        total: itemTotal
      });
    });

    // Default populated items if no rows exist
    if (items.length === 0) {
      items.push(
        { name: 'Conseil & Stratégie Digitale', quantity: 1, price: 180000, taxRate: 18, total: 180000 },
        { name: 'Développement Web & Intégration KIVO', quantity: 1, price: 320000, taxRate: 18, total: 320000 },
        { name: 'Maintenance & Support Mensuel', quantity: 1, price: 65000, taxRate: 18, total: 65000 }
      );
      subtotal = 565000;
      totalTaxAmount = 565000 * 0.18;
    }

    const discount   = parseFloat(get('builder-input-discount')) || 0;
    const taxable    = Math.max(0, subtotal - discount);
    const grandTotal = Math.max(0, taxable + totalTaxAmount);
    const currency   = get('builder-doc-currency') || biz.currency || 'FCFA';

    return {
      biz: activeBiz,
      docType:   get('builder-doc-type')    || 'invoice',
      docNum:    get('builder-doc-number')   || 'FAC-2026-0042',
      issueDate: get('builder-issue-date')   || new Date().toISOString().split('T')[0],
      dueDate:   get('builder-due-date')     || '',
      status:    get('builder-doc-status')   || 'sent',
      notes:     get('builder-notes')        || '',
      terms:     get('builder-terms')        || 'Paiement à 30 jours par virement bancaire ou Mobile Money.',
      client: {
        name:    client.name || get('builder-client-name') || 'M. Alex Diop',
        company: client.company || 'Studio Pulse SARL',
        phone:   client.phone || get('builder-client-phone') || '+221 77 123 45 67',
        email:   client.email || get('builder-client-email') || 'alex@studiopulse.com',
        address: client.address || get('builder-client-address') || 'Almadies, Dakar - Sénégal',
        taxId:   client.taxId || ''
      },
      items, subtotal, discount, taxRate: 18, taxAmount: totalTaxAmount, grandTotal, currency,
      primaryColor:   (document.getElementById('builder-color-primary')   || {}).value || biz.primaryColor   || '#0F172A',
      secondaryColor: (document.getElementById('builder-color-secondary') || {}).value || biz.secondaryColor || '#64748B',
    };
  },

  // ── Gallery Mini-Previews (Miniatures avec "KIVO" et contenu complet) ──
  miniPreview: function (id) {
    const wrap = (inner, bg) =>
      `<div class="tmpl-mini-wrap" style="background:${bg || '#fff'};width:155px;height:195px;position:relative;display:flex;flex-direction:column;box-shadow:0 12px 26px -4px rgba(0,0,0,0.22);overflow:hidden;box-sizing:border-box;">
        ${inner}
      </div>`;

    const templates = {

      // ── MINIMALIST: Épuré blanc, titre "KIVO" noir en sérif, contenu complet
      minimalist: () => wrap(`
        <div style="padding:9px;background:#fff;height:100%;display:flex;flex-direction:column;box-sizing:border-box;font-family:Inter,sans-serif;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;border-bottom:1px solid #E2E8F0;padding-bottom:5px;">
            <div>
              <div style="font-size:7px;font-weight:900;color:#0F172A;letter-spacing:0.5px;">KIVO MATIQUE</div>
              <div style="font-size:5px;color:#94A3B8;">Dakar, Sénégal</div>
            </div>
            <div style="text-align:right;">
              <div style="font-family:serif;font-size:11px;font-weight:900;color:#0F172A;line-height:1;">KIVO</div>
              <div style="font-size:5px;color:#64748B;margin-top:1px;">FAC-2026-0042</div>
            </div>
          </div>
          <div style="margin-bottom:5px;font-size:5.5px;color:#475569;line-height:1.3;">
            <span style="font-weight:700;color:#0F172A;">Client :</span> Studio Pulse (A. Diop)<br>
            <span style="font-size:5px;color:#94A3B8;">Émission : 15/09/2026</span>
          </div>
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:2px;overflow:hidden;margin-bottom:4px;">
            <div style="display:flex;background:#F1F5F9;padding:2px 3px;font-size:5px;font-weight:700;color:#334155;">
              <div style="flex:2;">Prestation</div><div style="width:16px;text-align:center;">Qté</div><div style="width:28px;text-align:right;">Total</div>
            </div>
            <div style="padding:2px 3px;font-size:4.8px;color:#475569;border-bottom:1px solid #F1F5F9;display:flex;">
              <div style="flex:2;">Dev Web UI</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;">250k</div>
            </div>
            <div style="padding:2px 3px;font-size:4.8px;color:#475569;border-bottom:1px solid #F1F5F9;display:flex;">
              <div style="flex:2;">Cloud SaaS</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;">80k</div>
            </div>
            <div style="padding:2px 3px;font-size:4.8px;color:#475569;display:flex;">
              <div style="flex:2;">Maintenance</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;">50k</div>
            </div>
          </div>
          <div style="margin-top:auto;border-top:1px solid #E2E8F0;padding-top:3px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:5px;color:#10B981;font-weight:800;">✓ PAYÉE</span>
            <div style="text-align:right;font-size:6.5px;font-weight:900;color:#0F172A;">380 000 FCFA</div>
          </div>
        </div>`, '#fff'),

      // ── CORPORATE: bandeau bleu nuit navy, logo, "KIVO", tableau corporate
      corporate: () => wrap(`
        <div style="background:#fff;height:100%;display:flex;flex-direction:column;box-sizing:border-box;font-family:Inter,sans-serif;">
          <div style="background:#1E3A5F;padding:6px 8px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="color:#fff;font-size:7px;font-weight:800;">KIVO MATIQUE</div>
              <div style="color:rgba(255,255,255,0.6);font-size:4.8px;">Entreprise B2B</div>
            </div>
            <div style="color:#fff;font-size:10px;font-weight:900;letter-spacing:0.5px;">KIVO</div>
          </div>
          <div style="padding:6px 8px;flex:1;display:flex;flex-direction:column;">
            <div style="display:flex;justify-content:space-between;font-size:5px;color:#64748B;margin-bottom:4px;">
              <div><strong>FAC-2026-0042</strong></div><div>Échéance : 30j</div>
            </div>
            <div style="background:#EFF6FF;border-radius:2px;padding:3px;margin-bottom:4px;font-size:5px;color:#1E3A5F;">
              <strong>Client :</strong> Studio Pulse SARL (Dakar)
            </div>
            <div style="border:1px solid #DBEAFE;border-radius:2px;overflow:hidden;margin-bottom:4px;">
              <div style="display:flex;background:#1E3A5F;color:#fff;padding:2px 3px;font-size:4.8px;font-weight:700;">
                <div style="flex:2;">Article</div><div style="width:16px;text-align:center;">Qté</div><div style="width:28px;text-align:right;">Total</div>
              </div>
              <div style="padding:2px 3px;font-size:4.8px;color:#334155;border-bottom:1px solid #EFF6FF;display:flex;">
                <div style="flex:2;">Prestation UI</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;">250k</div>
              </div>
              <div style="padding:2px 3px;font-size:4.8px;color:#334155;border-bottom:1px solid #EFF6FF;display:flex;">
                <div style="flex:2;">Intégration API</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;">80k</div>
              </div>
              <div style="padding:2px 3px;font-size:4.8px;color:#334155;display:flex;">
                <div style="flex:2;">Support Cloud</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;">50k</div>
              </div>
            </div>
            <div style="margin-top:auto;background:#1E3A5F;color:#fff;padding:3px 6px;border-radius:2px;display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:4.8px;opacity:0.8;">Total TTC</span>
              <span style="font-size:6.5px;font-weight:900;">380 000 FCFA</span>
            </div>
          </div>
        </div>`, '#fff'),

      // ── ELEGANT: Fond ivoire, bordure dorée, "KIVO" en italique noble
      elegant: () => wrap(`
        <div style="background:#FFFDF7;height:100%;display:flex;flex-direction:column;border:2px solid #E8D5A0;box-sizing:border-box;padding:7px;font-family:Georgia,serif;">
          <div style="text-align:center;border-bottom:1px solid #C9A84C;padding-bottom:4px;margin-bottom:5px;">
            <div style="font-size:11px;color:#C9A84C;font-weight:700;font-style:italic;letter-spacing:1px;">KIVO</div>
            <div style="font-size:4.8px;color:#A68B3A;">Maison KIVO MATIQUE · FAC-2026-0042</div>
          </div>
          <div style="font-size:5px;color:#6B5C2A;margin-bottom:4px;line-height:1.2;">
            <strong>Destinataire :</strong> Studio Pulse SARL<br>
            <span style="color:#A68B3A;">Échéance : 15/10/2026</span>
          </div>
          <div style="border:1px solid #E8D5A0;border-radius:2px;overflow:hidden;margin-bottom:4px;">
            <div style="display:flex;background:#FDF9EF;color:#C9A84C;padding:2px 3px;font-size:4.8px;font-weight:700;border-bottom:1px solid #E8D5A0;">
              <div style="flex:2;">Prestation</div><div style="width:16px;text-align:center;">Qté</div><div style="width:28px;text-align:right;">Montant</div>
            </div>
            <div style="padding:2px 3px;font-size:4.8px;color:#4A3B22;border-bottom:1px solid #FDF9EF;display:flex;">
              <div style="flex:2;">Création Visuelle</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;">250k</div>
            </div>
            <div style="padding:2px 3px;font-size:4.8px;color:#4A3B22;border-bottom:1px solid #FDF9EF;display:flex;">
              <div style="flex:2;">Direction Art</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;">80k</div>
            </div>
            <div style="padding:2px 3px;font-size:4.8px;color:#4A3B22;display:flex;">
              <div style="flex:2;">Conseil Brand</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;">50k</div>
            </div>
          </div>
          <div style="margin-top:auto;border-top:1px solid #C9A84C;padding-top:3px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:5px;color:#A68B3A;font-style:italic;">Signé & Approuvé</span>
            <span style="font-size:6.5px;font-weight:900;color:#C9A84C;">380 000 FCFA</span>
          </div>
        </div>`, '#FFFDF7'),

      // ── MODERN: Bandeau gradient magenta/violet, "KIVO", badge payée
      modern: () => wrap(`
        <div style="background:#fff;height:100%;display:flex;flex-direction:column;box-sizing:border-box;font-family:Inter,sans-serif;">
          <div style="height:5px;background:linear-gradient(90deg,#6366F1,#8B5CF6,#EC4899);"></div>
          <div style="padding:6px 8px;flex:1;display:flex;flex-direction:column;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <div>
                <div style="font-size:7px;font-weight:900;color:#1E1B4B;">KIVO MATIQUE</div>
                <div style="font-size:4.8px;color:#8B5CF6;">FAC-2026-0042</div>
              </div>
              <div style="text-align:right;">
                <div style="font-size:10px;font-weight:900;color:#7C3AED;">KIVO</div>
                <div style="background:#EDE9FE;color:#7C3AED;padding:1px 4px;border-radius:6px;font-size:4.5px;font-weight:800;display:inline-block;">✓ PAYÉE</div>
              </div>
            </div>
            <div style="background:#F5F3FF;border-radius:2px;padding:2px 4px;margin-bottom:4px;font-size:5px;color:#4C1D95;">
              <strong>Client :</strong> Studio Pulse SARL
            </div>
            <div style="border:1px solid #EDE9FE;border-radius:2px;overflow:hidden;margin-bottom:4px;">
              <div style="display:flex;background:#8B5CF6;color:#fff;padding:2px 3px;font-size:4.8px;font-weight:700;">
                <div style="flex:2;">Prestation</div><div style="width:16px;text-align:center;">Qté</div><div style="width:28px;text-align:right;">Total</div>
              </div>
              <div style="padding:2px 3px;font-size:4.8px;color:#334155;border-bottom:1px solid #F5F3FF;display:flex;">
                <div style="flex:2;">Dev Web App</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;">250k</div>
              </div>
              <div style="padding:2px 3px;font-size:4.8px;color:#334155;border-bottom:1px solid #F5F3FF;display:flex;">
                <div style="flex:2;">Intégration KIVO</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;">80k</div>
              </div>
              <div style="padding:2px 3px;font-size:4.8px;color:#334155;display:flex;">
                <div style="flex:2;">Abonnement Pro</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;">50k</div>
              </div>
            </div>
            <div style="margin-top:auto;background:linear-gradient(90deg,#6366F1,#8B5CF6);color:#fff;padding:3px 6px;border-radius:2px;display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:4.8px;opacity:0.85;">Total TTC</span>
              <span style="font-size:6.5px;font-weight:900;">380 000 FCFA</span>
            </div>
          </div>
        </div>`, '#fff'),

      // ── MODERN CLEAN: Barre sarcelle, "KIVO", clarté et précision
      clean: () => wrap(`
        <div style="background:#fff;height:100%;display:flex;flex-direction:column;border-top:3.5px solid #0E7490;box-sizing:border-box;padding:6px 8px;font-family:Inter,sans-serif;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <div>
              <div style="font-size:7px;font-weight:900;color:#0E7490;">KIVO MATIQUE</div>
              <div style="font-size:4.8px;color:#64748B;">FAC-2026-0042</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:10px;font-weight:900;color:#0E7490;">KIVO</div>
              <div style="font-size:4.5px;color:#94A3B8;">15/09/2026</div>
            </div>
          </div>
          <div style="background:#F0FDFA;border-left:2px solid #0E7490;padding:2px 4px;margin-bottom:4px;font-size:5px;color:#134E4A;">
            <strong>Client :</strong> Studio Pulse SARL
          </div>
          <div style="border:1px solid #CCFBF1;border-radius:2px;overflow:hidden;margin-bottom:4px;">
            <div style="display:flex;background:#0E7490;color:#fff;padding:2px 3px;font-size:4.8px;font-weight:700;">
              <div style="flex:2;">Prestation</div><div style="width:16px;text-align:center;">Qté</div><div style="width:28px;text-align:right;">Total</div>
            </div>
            <div style="padding:2px 3px;font-size:4.8px;color:#334155;border-bottom:1px solid #F0FDFA;display:flex;">
              <div style="flex:2;">Prestation Tech</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;">250k</div>
            </div>
            <div style="padding:2px 3px;font-size:4.8px;color:#334155;border-bottom:1px solid #F0FDFA;display:flex;">
              <div style="flex:2;">Config Serveurs</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;">80k</div>
            </div>
            <div style="padding:2px 3px;font-size:4.8px;color:#334155;display:flex;">
              <div style="flex:2;">Audit Sécurité</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;">50k</div>
            </div>
          </div>
          <div style="margin-top:auto;background:#0E7490;color:#fff;padding:3px 6px;border-radius:2px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:4.8px;">Total TTC</span>
            <span style="font-size:6.5px;font-weight:900;">380 000 FCFA</span>
          </div>
        </div>`, '#fff'),

      // ── EDITORIAL: Header noir avec accent rouge vermillon, "KIVO", contraste fort
      editorial: () => wrap(`
        <div style="background:#fff;height:100%;display:flex;flex-direction:column;box-sizing:border-box;font-family:Inter,sans-serif;">
          <div style="background:#111;padding:6px 8px;display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:3px;">
              <div style="width:8px;height:8px;background:#EF4444;border-radius:1px;"></div>
              <div style="color:#fff;font-size:7px;font-weight:900;">KIVO</div>
            </div>
            <div style="color:#EF4444;font-size:9px;font-weight:900;letter-spacing:1px;">KIVO</div>
          </div>
          <div style="padding:6px 8px;flex:1;display:flex;flex-direction:column;">
            <div style="border-bottom:1.5px solid #111;padding-bottom:3px;margin-bottom:4px;display:flex;justify-content:space-between;font-size:5px;">
              <div><strong>CLIENT :</strong> Studio Pulse SARL</div>
              <div style="color:#EF4444;font-weight:800;">FAC-2026-0042</div>
            </div>
            <div style="border:1px solid #111;border-radius:2px;overflow:hidden;margin-bottom:4px;">
              <div style="display:flex;background:#111;color:#fff;padding:2px 3px;font-size:4.8px;font-weight:800;">
                <div style="flex:2;">DESCRIPTION</div><div style="width:16px;text-align:center;">QTÉ</div><div style="width:28px;text-align:right;">TOTAL</div>
              </div>
              <div style="padding:2px 3px;font-size:4.8px;color:#111;border-bottom:1px solid #F1F5F9;display:flex;">
                <div style="flex:2;">Direction Studio</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;">250k</div>
              </div>
              <div style="padding:2px 3px;font-size:4.8px;color:#111;border-bottom:1px solid #F1F5F9;display:flex;">
                <div style="flex:2;">Motion Design</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;">80k</div>
              </div>
              <div style="padding:2px 3px;font-size:4.8px;color:#111;display:flex;">
                <div style="flex:2;">Shooting Vidéo</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;">50k</div>
              </div>
            </div>
            <div style="margin-top:auto;border:1.5px solid #111;padding:2px 5px;display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:4.8px;font-weight:800;color:#111;">TOTAL TTC</span>
              <span style="font-size:6.5px;font-weight:900;color:#EF4444;">380 000 FCFA</span>
            </div>
          </div>
        </div>`, '#fff'),

      // ── PREMIUM: Feuille sombre mate #181A20 avec bande métallique cuivre brillante
      premium: () => wrap(`
        <div style="background:#181A20;height:100%;display:flex;flex-direction:column;box-sizing:border-box;font-family:Inter,sans-serif;color:#F1F5F9;padding:6px 8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
            <div>
              <div style="font-size:7px;font-weight:900;color:#F8FAFC;">KIVO MATIQUE</div>
              <div style="font-size:4.8px;color:#94A3B8;">FAC-2026-0042</div>
            </div>
            <div style="font-family:serif;font-size:10px;font-weight:900;color:#F5D0B5;letter-spacing:1px;">KIVO</div>
          </div>
          <!-- Bande métallique cuivrée / or rose identique à l'Image 2 -->
          <div style="height:10px;background:linear-gradient(90deg,#D49B7A 0%,#F5D0B5 50%,#B87352 100%);border-radius:2px;margin-bottom:4px;display:flex;align-items:center;padding:0 4px;box-shadow:0 2px 8px rgba(212,155,122,0.3);">
            <div style="font-size:4.5px;font-weight:800;color:#1E1B18;">PREMIUM EDITION</div>
          </div>
          <div style="background:#222631;border:1px solid #2D323F;border-radius:2px;padding:2px 4px;margin-bottom:4px;font-size:5px;color:#F5D0B5;">
            <strong>Client :</strong> Studio Pulse SARL
          </div>
          <div style="border:1px solid #2D323F;border-radius:2px;overflow:hidden;margin-bottom:4px;">
            <div style="display:flex;background:#222631;color:#F5D0B5;padding:2px 3px;font-size:4.8px;font-weight:700;border-bottom:1px solid #D49B7A;">
              <div style="flex:2;">Service</div><div style="width:16px;text-align:center;">Qté</div><div style="width:28px;text-align:right;">Total</div>
            </div>
            <div style="padding:2px 3px;font-size:4.8px;color:#E2E8F0;border-bottom:1px solid #222631;display:flex;">
              <div style="flex:2;">Executive Advisory</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;color:#F5D0B5;">250k</div>
            </div>
            <div style="padding:2px 3px;font-size:4.8px;color:#E2E8F0;border-bottom:1px solid #222631;display:flex;">
              <div style="flex:2;">Private Cloud SaaS</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;color:#F5D0B5;">80k</div>
            </div>
            <div style="padding:2px 3px;font-size:4.8px;color:#E2E8F0;display:flex;">
              <div style="flex:2;">VIP Support 24/7</div><div style="width:16px;text-align:center;">1</div><div style="width:28px;text-align:right;color:#F5D0B5;">50k</div>
            </div>
          </div>
          <div style="margin-top:auto;background:#222631;border:1px solid #D49B7A;color:#fff;padding:2px 5px;border-radius:2px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:4.8px;color:#94A3B8;">Total TTC</span>
            <span style="font-size:6.5px;font-weight:900;color:#F5D0B5;">380 000 FCFA</span>
          </div>
        </div>`, '#181A20'),
    };

    const fn = templates[id] || templates['minimalist'];
    return fn();
  },

  // ══════════════════════════════════════════════════════════════
  // FULL INVOICE RENDERERS (RÉACTIFS À TOUTES LES MODIFICATIONS)
  // ══════════════════════════════════════════════════════════════

  // 1. MINIMALIST
  renderMinimalist: function (d) {
    const lbl = d.docType === 'quote' ? 'DEVIS' : 'FACTURE';
    const ac = d.primaryColor || '#0F172A';
    return `
      <div style="background:#fff;font-family:Inter,Arial,sans-serif;padding:40px;min-height:950px;position:relative;color:#1e293b;box-sizing:border-box;display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">
          <div>
            ${this.logoHtml(d.biz, '60px', 'square')}
            <div style="font-weight:800;font-size:16px;color:#0F172A;margin-top:8px;">${d.biz.name || 'KIVO MATIQUE'}</div>
            <div style="font-size:11px;color:#64748b;line-height:1.6;margin-top:4px;">
              ${d.biz.address || ''}<br>
              ${d.biz.phone ? '📞 ' + d.biz.phone : ''} ${d.biz.email ? '✉ ' + d.biz.email : ''}
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:serif;font-size:32px;font-weight:800;color:${ac};letter-spacing:1px;line-height:1;">${lbl}</div>
            <div style="font-size:13px;font-weight:700;color:#334155;margin-top:6px;">N° ${d.docNum}</div>
            <div style="font-size:11px;color:#64748b;margin-top:4px;">Date d'émission : ${d.issueDate || '--/--/----'}</div>
            ${d.dueDate ? `<div style="font-size:11px;color:#64748b;">Échéance : ${d.dueDate}</div>` : ''}
          </div>
        </div>

        <div style="border-top:1.5px solid #E2E8F0;border-bottom:1.5px solid #E2E8F0;padding:14px 0;margin-bottom:24px;display:flex;justify-content:space-between;">
          <div>
            <div style="font-size:10px;text-transform:uppercase;color:#94A3B8;letter-spacing:1px;font-weight:700;margin-bottom:4px;">Facturé à</div>
            <div style="font-size:15px;font-weight:700;color:#0F172A;">${d.client.name}</div>
            <div style="font-size:11px;color:#64748b;line-height:1.6;margin-top:2px;">
              ${d.client.company ? d.client.company + '<br>' : ''}
              ${d.client.address ? d.client.address + '<br>' : ''}
              ${d.client.phone ? '📞 ' + d.client.phone : ''} ${d.client.email ? '✉ ' + d.client.email : ''}
            </div>
          </div>
          <div style="text-align:right;align-self:flex-end;">
            <div style="font-size:10px;text-transform:uppercase;color:#94A3B8;letter-spacing:1px;font-weight:700;">Total à régler</div>
            <div style="font-size:26px;font-weight:900;color:${ac};margin-top:2px;">${this.fmt(d.grandTotal, d.currency)}</div>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px;">
          <thead>
            <tr style="border-bottom:2px solid ${ac};">
              <th style="padding:10px 12px;text-align:left;color:#0F172A;">Description</th>
              <th style="padding:10px 12px;text-align:center;width:12%;color:#0F172A;">Qté</th>
              <th style="padding:10px 12px;text-align:right;width:20%;color:#0F172A;">Prix Unitaire</th>
              <th style="padding:10px 12px;text-align:right;width:20%;color:#0F172A;">Total</th>
            </tr>
          </thead>
          <tbody>${this.rows(d.items, d.currency)}</tbody>
        </table>

        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:auto;padding-top:20px;border-top:1px solid #E2E8F0;">
          <div style="max-width:50%;font-size:11px;color:#64748b;">
            <div style="font-weight:700;color:#0F172A;margin-bottom:4px;">Modalités & Règlement</div>
            <div>${d.terms || 'Paiement à 30 jours par virement bancaire ou Mobile Money.'}</div>
            ${d.notes ? `<div style="margin-top:6px;"><strong>Note :</strong> ${d.notes}</div>` : ''}
          </div>
          <div style="min-width:230px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;color:#64748b;">
              <span>Sous-total HT :</span><span style="font-weight:600;color:#0F172A;">${this.fmt(d.subtotal, d.currency)}</span>
            </div>
            ${d.taxAmount > 0 ? `
              <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;color:#64748b;">
                <span>Total TVA :</span><span style="color:#0F172A;">${this.fmt(d.taxAmount, d.currency)}</span>
              </div>` : ''}
            ${d.discount > 0 ? `
              <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;color:#EF4444;">
                <span>Réduction :</span><span>-${this.fmt(d.discount, d.currency)}</span>
              </div>` : ''}
            <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:800;color:${ac};border-top:2px solid ${ac};padding-top:8px;margin-top:6px;">
              <span>Total TTC :</span><span>${this.fmt(d.grandTotal, d.currency)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // 2. CORPORATE
  renderCorporate: function (d) {
    const ac = d.primaryColor || '#1E3A5F';
    const lbl = d.docType === 'quote' ? 'DEVIS' : 'FACTURE';
    return `
      <div style="background:#fff;font-family:Inter,Arial,sans-serif;min-height:950px;position:relative;color:#1e293b;box-sizing:border-box;display:flex;flex-direction:column;">
        <div style="background:${ac};padding:24px 36px;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:14px;">
            ${this.logoHtml(d.biz, '52px', 'square')}
            <div>
              <div style="color:#fff;font-weight:800;font-size:18px;">${d.biz.name || 'KIVO MATIQUE'}</div>
              <div style="color:rgba(255,255,255,0.7);font-size:10px;">${d.biz.address || ''}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="color:#fff;font-weight:900;font-size:24px;letter-spacing:1px;">${lbl}</div>
            <div style="color:rgba(255,255,255,0.85);font-size:12px;font-weight:600;">N° ${d.docNum}</div>
          </div>
        </div>

        <div style="padding:28px 36px;flex:1;display:flex;flex-direction:column;">
          <div style="display:flex;justify-content:space-between;margin-bottom:24px;background:#F8FAFC;padding:16px;border-radius:6px;border:1px solid #E2E8F0;">
            <div>
              <div style="font-size:10px;text-transform:uppercase;color:#64748B;font-weight:700;">Destinataire</div>
              <div style="font-size:14px;font-weight:700;color:#0F172A;margin-top:2px;">${d.client.name}</div>
              <div style="font-size:11px;color:#64748B;">${d.client.phone || ''} · ${d.client.email || ''}</div>
              <div style="font-size:10px;color:#94A3B8;">${d.client.address || ''}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:11px;color:#64748B;">Date d'émission : <strong style="color:#0F172A;">${d.issueDate || '--'}</strong></div>
              <div style="font-size:11px;color:#64748B;margin-top:2px;">Échéance : <strong style="color:#0F172A;">${d.dueDate || '--'}</strong></div>
            </div>
          </div>

          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px;">
            <thead>
              <tr style="background:${ac};color:#fff;">
                <th style="padding:10px 12px;text-align:left;">Description</th>
                <th style="padding:10px 12px;text-align:center;width:12%;">Qté</th>
                <th style="padding:10px 12px;text-align:right;width:20%;">Prix U.</th>
                <th style="padding:10px 12px;text-align:right;width:20%;">Total</th>
              </tr>
            </thead>
            <tbody>${this.rows(d.items, d.currency)}</tbody>
          </table>

          <div style="display:flex;justify-content:flex-end;margin-top:auto;margin-bottom:20px;">
            <div style="width:240px;">
              <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px;color:#64748B;"><span>Sous-total HT :</span><span>${this.fmt(d.subtotal, d.currency)}</span></div>
              <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px;color:#64748B;"><span>Total TVA :</span><span>${this.fmt(d.taxAmount, d.currency)}</span></div>
              <div style="background:${ac};color:#fff;display:flex;justify-content:space-between;font-size:14px;font-weight:700;padding:8px 12px;border-radius:4px;margin-top:6px;">
                <span>Total TTC :</span><span>${this.fmt(d.grandTotal, d.currency)}</span>
              </div>
            </div>
          </div>

          <div style="border-top:1px solid #E2E8F0;padding-top:12px;font-size:10px;color:#64748B;display:flex;justify-content:space-between;">
            <div>Conditions : ${d.terms || 'Paiement à réception.'}</div>
            <div>${d.biz.phone ? '📞 ' + d.biz.phone : ''} ${d.biz.email ? '✉ ' + d.biz.email : ''}</div>
          </div>
        </div>
      </div>
    `;
  },

  // 3. ELEGANT
  renderElegant: function (d) {
    const lbl = d.docType === 'quote' ? 'Devis' : 'Facture';
    const ac = d.primaryColor || '#C9A84C';
    return `
      <div style="background:#FFFDF7;font-family:Georgia,serif;padding:40px;min-height:950px;position:relative;color:#2D241E;border:12px solid #F6F1E5;box-sizing:border-box;display:flex;flex-direction:column;">
        <div style="text-align:center;border-bottom:2px solid ${ac};padding-bottom:18px;margin-bottom:24px;">
          <div style="display:flex;justify-content:center;margin-bottom:8px;">${this.logoHtml(d.biz, '50px', 'circle')}</div>
          <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#A68B3A;margin-bottom:4px;">MAISON &amp; COMMERCE</div>
          <div style="font-size:32px;font-weight:700;color:${ac};font-style:italic;">${lbl}</div>
          <div style="font-size:12px;color:#6B5C2A;margin-top:4px;">N° ${d.docNum} · Émise le ${d.issueDate || '--'}</div>
        </div>

        <div style="display:flex;justify-content:space-between;margin-bottom:28px;font-size:12px;line-height:1.6;">
          <div>
            <strong style="color:${ac};text-transform:uppercase;font-size:10px;letter-spacing:1px;display:block;">Émetteur</strong>
            <div style="font-size:14px;font-weight:700;color:#1E1B18;">${d.biz.name || 'KIVO MATIQUE'}</div>
            <div style="color:#6B5C2A;">${d.biz.address || ''}<br>${d.biz.phone || ''}</div>
          </div>
          <div style="text-align:right;">
            <strong style="color:${ac};text-transform:uppercase;font-size:10px;letter-spacing:1px;display:block;">Destinataire</strong>
            <div style="font-size:14px;font-weight:700;color:#1E1B18;">${d.client.name}</div>
            <div style="color:#6B5C2A;">${d.client.address || ''}<br>${d.client.phone || ''}</div>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px;">
          <thead>
            <tr style="border-bottom:2px solid ${ac};color:${ac};">
              <th style="padding:8px 10px;text-align:left;font-weight:600;">Description</th>
              <th style="padding:8px 10px;text-align:center;width:12%;font-weight:600;">Qté</th>
              <th style="padding:8px 10px;text-align:right;width:20%;font-weight:600;">Prix U.</th>
              <th style="padding:8px 10px;text-align:right;width:20%;font-weight:600;">Montant</th>
            </tr>
          </thead>
          <tbody>${this.rows(d.items, d.currency, '#FDF9EF')}</tbody>
        </table>

        <div style="display:flex;justify-content:flex-end;margin-top:auto;border-top:1px solid #E8D5A0;padding-top:14px;">
          <div style="width:240px;font-size:12px;">
            <div style="display:flex;justify-content:space-between;padding:2px 0;color:#6B5C2A;"><span>Sous-total :</span><span>${this.fmt(d.subtotal, d.currency)}</span></div>
            <div style="display:flex;justify-content:space-between;padding:2px 0;color:#6B5C2A;"><span>Total TVA :</span><span>${this.fmt(d.taxAmount, d.currency)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;color:${ac};border-top:2px solid ${ac};padding-top:6px;margin-top:4px;">
              <span>Total TTC :</span><span>${this.fmt(d.grandTotal, d.currency)}</span>
            </div>
          </div>
        </div>

        <div style="margin-top:24px;text-align:center;font-size:10px;color:#A68B3A;border-top:1px solid #E8D5A0;padding-top:10px;font-style:italic;">
          Merci infiniment pour votre confiance.
        </div>
      </div>
    `;
  },

  // 4. MODERN
  renderModern: function (d) {
    const lbl = d.docType === 'quote' ? 'DEVIS' : 'FACTURE';
    const ac = d.primaryColor || '#7C3AED';
    return `
      <div style="background:#fff;font-family:Inter,sans-serif;padding:36px;min-height:950px;position:relative;box-sizing:border-box;display:flex;flex-direction:column;">
        <div style="height:6px;background:linear-gradient(90deg,${ac},#8B5CF6,#EC4899);border-radius:3px;margin-bottom:24px;"></div>
        
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">
          <div>
            ${this.logoHtml(d.biz, '52px', 'square')}
            <div style="font-size:18px;font-weight:800;color:#1E1B4B;margin-top:8px;">${d.biz.name || 'KIVO MATIQUE'}</div>
            <div style="font-size:11px;color:#64748B;">${d.biz.address || ''}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:28px;font-weight:900;color:${ac};">${lbl}</div>
            <div style="font-size:13px;font-weight:700;color:#475569;margin-top:2px;">N° ${d.docNum}</div>
            <div style="background:#EDE9FE;color:${ac};padding:3px 10px;border-radius:12px;font-size:10px;font-weight:700;display:inline-block;margin-top:6px;">
              ${d.status === 'paid' ? 'PAYÉE' : 'EN ATTENTE'}
            </div>
          </div>
        </div>

        <div style="background:#F5F3FF;border-radius:8px;padding:16px 20px;margin-bottom:24px;display:flex;justify-content:space-between;">
          <div>
            <div style="font-size:10px;color:${ac};font-weight:700;text-transform:uppercase;">Facturé à</div>
            <div style="font-size:14px;font-weight:700;color:#1E1B4B;margin-top:2px;">${d.client.name}</div>
            <div style="font-size:11px;color:#64748B;">${d.client.email || ''} ${d.client.phone ? '· ' + d.client.phone : ''}</div>
          </div>
          <div style="text-align:right;font-size:11px;color:#64748B;">
            <div>Émission : <strong style="color:#1E1B4B;">${d.issueDate || '--'}</strong></div>
            <div>Échéance : <strong style="color:#1E1B4B;">${d.dueDate || '--'}</strong></div>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px;">
          <thead>
            <tr style="background:${ac};color:#fff;">
              <th style="padding:10px 12px;text-align:left;border-radius:4px 0 0 4px;">Description</th>
              <th style="padding:10px 12px;text-align:center;width:12%;">Qté</th>
              <th style="padding:10px 12px;text-align:right;width:20%;">Prix U.</th>
              <th style="padding:10px 12px;text-align:right;width:20%;border-radius:0 4px 4px 0;">Total</th>
            </tr>
          </thead>
          <tbody>${this.rows(d.items, d.currency, '#FDF2F8')}</tbody>
        </table>

        <div style="margin-top:auto;display:flex;justify-content:flex-end;">
          <div style="background:linear-gradient(135deg,${ac},#8B5CF6);color:#fff;padding:16px 24px;border-radius:8px;width:250px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;opacity:0.85;"><span>Sous-total :</span><span>${this.fmt(d.subtotal, d.currency)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:11px;opacity:0.85;margin-top:2px;"><span>Total TVA :</span><span>${this.fmt(d.taxAmount, d.currency)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;border-top:1px solid rgba(255,255,255,0.25);padding-top:8px;margin-top:8px;">
              <span>Total :</span><span>${this.fmt(d.grandTotal, d.currency)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // 5. CLEAN (Modern Clean)
  renderClean: function (d) {
    const lbl = d.docType === 'quote' ? 'DEVIS' : 'FACTURE';
    const ac = d.primaryColor || '#0E7490';
    return `
      <div style="background:#fff;font-family:Inter,sans-serif;padding:36px;min-height:950px;position:relative;color:#1E293B;border-top:8px solid ${ac};box-sizing:border-box;display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">
          <div>
            ${this.logoHtml(d.biz, '48px', 'square')}
            <div style="font-size:20px;font-weight:800;color:${ac};margin-top:8px;">${d.biz.name || 'KIVO MATIQUE'}</div>
            <div style="font-size:11px;color:#64748B;margin-top:3px;">${d.biz.address || ''}<br>${d.biz.phone || ''}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:26px;font-weight:900;color:${ac};">${lbl}</div>
            <div style="font-size:12px;font-weight:700;color:#334155;">N° ${d.docNum}</div>
            <div style="font-size:11px;color:#64748B;">Date : ${d.issueDate || '--'}</div>
          </div>
        </div>

        <div style="background:#F0FDFA;border-left:4px solid ${ac};padding:12px 16px;margin-bottom:24px;">
          <div style="font-size:10px;text-transform:uppercase;color:${ac};font-weight:700;">Client Facturé</div>
          <div style="font-size:14px;font-weight:700;color:#0F172A;margin-top:2px;">${d.client.name}</div>
          <div style="font-size:11px;color:#64748B;">${d.client.address || ''} · ${d.client.phone || ''}</div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px;">
          <thead>
            <tr style="background:${ac};color:#fff;">
              <th style="padding:9px 12px;text-align:left;">Description</th>
              <th style="padding:9px 12px;text-align:center;width:12%;">Qté</th>
              <th style="padding:9px 12px;text-align:right;width:20%;">P.U</th>
              <th style="padding:9px 12px;text-align:right;width:20%;">Total</th>
            </tr>
          </thead>
          <tbody>${this.rows(d.items, d.currency, '#F0FDFA')}</tbody>
        </table>

        <div style="margin-top:auto;display:flex;justify-content:flex-end;">
          <div style="width:230px;font-size:12px;">
            <div style="display:flex;justify-content:space-between;padding:3px 0;color:#64748B;"><span>Sous-total :</span><span>${this.fmt(d.subtotal, d.currency)}</span></div>
            <div style="display:flex;justify-content:space-between;padding:3px 0;color:#64748B;"><span>Total TVA :</span><span>${this.fmt(d.taxAmount, d.currency)}</span></div>
            <div style="background:${ac};color:#fff;display:flex;justify-content:space-between;font-size:14px;font-weight:700;padding:8px 12px;border-radius:4px;margin-top:6px;">
              <span>Total TTC :</span><span>${this.fmt(d.grandTotal, d.currency)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // 6. EDITORIAL
  renderEditorial: function (d) {
    const lbl = d.docType === 'quote' ? 'DEVIS' : 'FACTURE';
    const ac = d.primaryColor || '#EF4444';
    return `
      <div style="background:#fff;font-family:Inter,sans-serif;min-height:950px;position:relative;color:#111;box-sizing:border-box;display:flex;flex-direction:column;">
        <div style="background:#111;padding:24px 36px;display:flex;justify-content:space-between;align-items:center;">
          <div style="display:flex;align-items:center;gap:12px;">
            ${this.logoHtml(d.biz, '44px', 'square')}
            <div>
              <div style="color:#fff;font-size:18px;font-weight:900;letter-spacing:1px;">${d.biz.name || 'KIVO MATIQUE'}</div>
              <div style="color:#9CA3AF;font-size:10px;margin-top:2px;">${d.biz.address || ''}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:26px;font-weight:900;color:${ac};letter-spacing:2px;">${lbl}</div>
            <div style="color:#fff;font-size:12px;font-weight:700;">N° ${d.docNum}</div>
          </div>
        </div>

        <div style="padding:28px 36px;flex:1;display:flex;flex-direction:column;">
          <div style="border-bottom:3px solid #111;padding-bottom:14px;margin-bottom:24px;display:flex;justify-content:space-between;">
            <div>
              <div style="font-size:9px;text-transform:uppercase;color:${ac};font-weight:900;letter-spacing:1px;">CLIENT</div>
              <div style="font-size:18px;font-weight:900;color:#111;margin-top:2px;">${d.client.name}</div>
              <div style="font-size:11px;color:#4B5563;">${d.client.phone || ''} ${d.client.email ? '· ' + d.client.email : ''}</div>
            </div>
            <div style="text-align:right;font-size:11px;color:#4B5563;">
              <div>Date d'émission : <strong style="color:#111;">${d.issueDate || '--'}</strong></div>
              <div>Échéance : <strong style="color:#111;">${d.dueDate || '--'}</strong></div>
            </div>
          </div>

          <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px;">
            <thead>
              <tr style="background:#111;color:#fff;">
                <th style="padding:10px 12px;text-align:left;">DESCRIPTION</th>
                <th style="padding:10px 12px;text-align:center;width:12%;">QTÉ</th>
                <th style="padding:10px 12px;text-align:right;width:20%;">P.U</th>
                <th style="padding:10px 12px;text-align:right;width:20%;background:${ac};">TOTAL</th>
              </tr>
            </thead>
            <tbody>${this.rows(d.items, d.currency, '#FEE2E2')}</tbody>
          </table>

          <div style="margin-top:auto;display:flex;justify-content:flex-end;">
            <div style="width:250px;border:2px solid #111;padding:12px 16px;">
              <div style="display:flex;justify-content:space-between;font-size:11px;color:#4B5563;"><span>Sous-total HT :</span><span>${this.fmt(d.subtotal, d.currency)}</span></div>
              <div style="display:flex;justify-content:space-between;font-size:11px;color:#4B5563;margin-top:2px;"><span>Total TVA :</span><span>${this.fmt(d.taxAmount, d.currency)}</span></div>
              <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:900;color:#111;border-top:2px solid #111;padding-top:6px;margin-top:6px;">
                <span>Total TTC :</span><span style="color:${ac};">${this.fmt(d.grandTotal, d.currency)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // 7. PREMIUM (Copper Metallic & Dark Matte)
  renderPremium: function (d) {
    const lbl = d.docType === 'quote' ? 'DEVIS' : 'FACTURE';
    return `
      <div style="background:#181A20;font-family:Inter,sans-serif;min-height:950px;position:relative;color:#F1F5F9;padding:36px;box-sizing:border-box;display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
          <div>
            ${this.logoHtml(d.biz, '52px', 'square', true)}
            <div style="font-size:20px;font-weight:800;color:#F8FAFC;margin-top:8px;letter-spacing:0.5px;">${d.biz.name || 'KIVO MATIQUE'}</div>
            <div style="font-size:11px;color:#94A3B8;margin-top:2px;">${d.biz.address || ''}<br>${d.biz.phone || ''}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:28px;font-weight:800;color:#F5D0B5;letter-spacing:2px;font-family:serif;">${lbl}</div>
            <div style="font-size:13px;font-weight:700;color:#D49B7A;margin-top:2px;">N° ${d.docNum}</div>
            <div style="font-size:11px;color:#94A3B8;margin-top:4px;">Date : ${d.issueDate || '--'}</div>
          </div>
        </div>

        <!-- Glowing metallic copper/rose gold band matching Image 2 -->
        <div style="height:18px;background:linear-gradient(90deg,#D49B7A 0%,#F5D0B5 50%,#B87352 100%);border-radius:4px;margin-bottom:24px;box-shadow:0 4px 14px rgba(212,155,122,0.35);"></div>

        <div style="background:#222631;border:1px solid #2D323F;border-radius:8px;padding:16px 20px;margin-bottom:24px;display:flex;justify-content:space-between;">
          <div>
            <div style="font-size:10px;text-transform:uppercase;color:#D49B7A;font-weight:700;letter-spacing:1px;">Client Destinataire</div>
            <div style="font-size:15px;font-weight:700;color:#FFFFFF;margin-top:2px;">${d.client.name}</div>
            <div style="font-size:11px;color:#94A3B8;">${d.client.address || ''} · ${d.client.phone || ''}</div>
          </div>
          <div style="text-align:right;font-size:11px;color:#94A3B8;">
            <div>Échéance de règlement : <strong style="color:#F5D0B5;">${d.dueDate || 'Paiement immédiat'}</strong></div>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px;">
          <thead>
            <tr style="background:#222631;color:#F5D0B5;border-bottom:1.5px solid #D49B7A;">
              <th style="padding:10px 12px;text-align:left;">Description</th>
              <th style="padding:10px 12px;text-align:center;width:12%;">Qté</th>
              <th style="padding:10px 12px;text-align:right;width:20%;">Prix U.</th>
              <th style="padding:10px 12px;text-align:right;width:20%;">Total</th>
            </tr>
          </thead>
          <tbody>${this.rows(d.items, d.currency, '#2A221E', true)}</tbody>
        </table>

        <div style="margin-top:auto;display:flex;justify-content:flex-end;">
          <div style="background:#222631;border:1px solid #D49B7A;border-radius:8px;padding:16px 24px;width:260px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#94A3B8;"><span>Sous-total HT :</span><span style="color:#F1F5F9;">${this.fmt(d.subtotal, d.currency)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#94A3B8;margin-top:2px;"><span>Total TVA :</span><span style="color:#F1F5F9;">${this.fmt(d.taxAmount, d.currency)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;color:#F5D0B5;border-top:1px solid #3A3530;padding-top:8px;margin-top:8px;">
              <span>Total TTC :</span><span>${this.fmt(d.grandTotal, d.currency)}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // ── Main render dispatcher ────────────────────────────────────────────
  render: function (templateId, data) {
    const d = data || this.collectData();
    switch (templateId) {
      case 'minimalist':  return this.renderMinimalist(d);
      case 'corporate':   return this.renderCorporate(d);
      case 'elegant':      return this.renderElegant(d);
      case 'modern':       return this.renderModern(d);
      case 'clean':        return this.renderClean(d);
      case 'editorial':    return this.renderEditorial(d);
      case 'premium':      return this.renderPremium(d);
      default:             return this.renderMinimalist(d);
    }
  }
};

console.log('[KivoTemplates] ✅', window.KivoTemplates.builtIn.length, 'templates disponibles.');
