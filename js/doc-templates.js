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

  // ── Helpers ──────────────────────────────────────────────────────────

  fmt: function (n, currency) {
    return (n || 0).toLocaleString('fr-FR') + ' ' + (currency || 'FCFA');
  },

  logoHtml: function (biz, defaultSize, shape, fallbackDark = false) {
    const szVal = (biz && biz.logoSize) ? biz.logoSize : (defaultSize || 60);
    const sz = typeof szVal === 'number' ? `${szVal}px` : szVal;
    const br = shape === 'circle' ? '50%' : (shape === 'none' ? '0' : '6px');

    if (biz && biz.logoUrl) {
      return `<img src="${biz.logoUrl}" style="max-height:${sz};max-width:220px;height:auto;object-fit:contain;border-radius:${br};display:inline-block;" alt="Logo">`;
    }
    const txt = (biz && biz.logoText) || (biz && biz.name ? biz.name.substring(0, 4).toUpperCase() : 'KIVO');
    const bg  = fallbackDark ? 'linear-gradient(135deg,#D49B7A,#B87352)' : ((biz && biz.logoBg) || 'linear-gradient(135deg,#4F46E5,#7C3AED)');
    return `<div style="height:${sz};min-width:${sz};padding:0 12px;border-radius:${br};background:${bg};display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:calc(${sz} * 0.38);letter-spacing:0.5px;flex-shrink:0;">${txt}</div>`;
  },

  rows: function (items, currency, accBg, isDark = false) {
    if (!items || items.length === 0) {
      return `<tr><td colspan="5" style="text-align:center;color:${isDark ? '#64748B' : '#94a3b8'};padding:14px;font-size:11px;">Aucun article saisi</td></tr>`;
    }
    return items.map((it, i) => `
      <tr style="background:${isDark ? (i % 2 === 0 ? '#1E222B' : '#181A20') : (i % 2 === 0 ? '#fff' : '#f8fafc')};">
        <td style="padding:7px 10px;font-size:11px;border-bottom:1px solid ${isDark ? '#2D323F' : '#f1f5f9'};color:${isDark ? '#E2E8F0' : '#1E293B'};">
          <strong>${it.name || 'Article sans désignation'}</strong>
        </td>
        <td style="padding:7px 10px;font-size:11px;text-align:center;border-bottom:1px solid ${isDark ? '#2D323F' : '#f1f5f9'};color:${isDark ? '#94A3B8' : '#64748B'};">${it.quantity}</td>
        <td style="padding:7px 10px;font-size:11px;text-align:right;border-bottom:1px solid ${isDark ? '#2D323F' : '#f1f5f9'};color:${isDark ? '#E2E8F0' : '#1E293B'};">${this.fmt(it.price, currency)}</td>
        <td style="padding:7px 10px;font-size:11px;text-align:center;border-bottom:1px solid ${isDark ? '#2D323F' : '#f1f5f9'};color:${isDark ? '#94A3B8' : '#64748B'};">${it.taxRate !== undefined && it.taxRate !== '' ? it.taxRate + ' %' : '-'}</td>
        <td style="padding:7px 10px;font-size:11px;text-align:right;font-weight:700;border-bottom:1px solid ${isDark ? '#2D323F' : '#f1f5f9'};${accBg ? 'background:' + accBg + ';' : ''}color:${isDark ? '#F5D0B5' : '#0F172A'};">${this.fmt(it.total, currency)}</td>
      </tr>`).join('');
  },

  collectData: function (state) {
    const biz = (state && state.business) || {};
    const get = id => { const el = document.getElementById(id); return el ? el.value : ''; };

    // Capture live logo from preview element or state
    const logoImg = document.getElementById('builder-logo-preview-img');
    const liveLogoUrl = (logoImg && logoImg.src && logoImg.style.display !== 'none') ? logoImg.src : (biz.logoUrl || '');
    
    // Logo size & position
    const sizeInput = document.getElementById('builder-logo-size');
    const posSelect = document.getElementById('builder-logo-position');
    const liveLogoSize = sizeInput ? parseInt(sizeInput.value) : (biz.logoSize || 70);
    const liveLogoPos  = posSelect ? posSelect.value : (biz.logoPosition || 'right');

    const activeBiz = Object.assign({}, biz, {
      name:         get('builder-biz-name')    || biz.name    || 'KIVO Inc.',
      address:      get('builder-biz-address') || biz.address || '2833 Minimalist',
      phone:        get('builder-biz-phone')   || biz.phone   || '+23 457 78 79',
      email:        get('builder-biz-email')   || biz.email   || 'kivo@kivoexample.com',
      logoUrl:      liveLogoUrl,
      logoSize:     liveLogoSize,
      logoPosition: liveLogoPos
    });

    const clientId = get('builder-doc-client-select');
    const clientFound = (state && state.clients) ? (state.clients.find(c => c.id === clientId) || {}) : {};

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
      const taxRate = taxInput ? (parseFloat(taxInput.value) || 0) : 18;

      const itemTotal = qty * price;
      const itemTax = itemTotal * (taxRate / 100);

      subtotal += itemTotal;
      totalTaxAmount += itemTax;

      items.push({
        name: name || 'Prestation de service',
        quantity: qty,
        price: price,
        taxRate: taxRate,
        total: itemTotal
      });
    });

    // Default populated items matching reference image if no rows exist
    if (items.length === 0) {
      items.push(
        { name: 'Abonnement SaaS KIVO - Plan Premium (10 licences)', quantity: 1, price: 350000, taxRate: 30, total: 350000 },
        { name: "Intégration d'API Personnalisée", quantity: 2, price: 150000, taxRate: 10, total: 300000 },
        { name: 'Totales lignes de services', quantity: 1, price: 150000, taxRate: 18, total: 150000 },
        { name: 'Une service', quantity: 1, price: 20000, taxRate: 0, total: 20000 }
      );
      subtotal = 820000;
      totalTaxAmount = (350000 * 0.30) + (300000 * 0.10) + (150000 * 0.18);
    }

    const discount   = parseFloat(get('builder-input-discount')) || 0;
    const taxable    = Math.max(0, subtotal - discount);
    const grandTotal = Math.max(0, taxable + totalTaxAmount);
    const currency   = get('builder-doc-currency') || biz.currency || 'FCFA';

    return {
      biz: activeBiz,
      docType:        get('builder-doc-type')        || 'invoice',
      docNum:         get('builder-doc-number')      || 'K-2026-0001',
      issueDate:      get('builder-issue-date')      || '22/06/2026',
      dueDate:        get('builder-due-date')        || '25/08/2026',
      status:         get('builder-doc-status')      || 'sent',
      paymentMethod:  get('builder-payment-method')  || 'Virement bancaire',
      terms:          get('builder-terms')           || 'À réception',
      notes:          get('builder-notes')           || '',
      client: {
        name:    get('builder-client-name')    || clientFound.name    || clientFound.company || 'CLIENT PRO SOLUTIONS',
        company: clientFound.company           || '',
        phone:   get('builder-client-phone')   || clientFound.phone   || '+23 456-8439',
        email:   get('builder-client-email')   || clientFound.email   || 'email@trustprosolution.com',
        address: get('builder-client-address') || clientFound.address || '3223 Nimmakst',
        taxId:   clientFound.taxId || ''
      },
      items, subtotal, discount, taxAmount: totalTaxAmount, grandTotal, currency,
      primaryColor:   (document.getElementById('builder-color-primary')   || {}).value || biz.primaryColor   || '#0F172A',
      secondaryColor: (document.getElementById('builder-color-secondary') || {}).value || biz.secondaryColor || '#64748B',
    };
  },

  // ── Header Renderer Helper (Supports Logo Left, Center, Right) ─────────
  renderHeader: function (d, titleColor, subtitleColor, isDark = false) {
    const lbl = d.docType === 'quote' ? 'DEVIS' : 'FACTURE';
    const pos = (d.biz && d.biz.logoPosition) || 'right';
    const logo = this.logoHtml(d.biz, 65, 'square', isDark);

    if (pos === 'left') {
      return `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
          <div style="display:flex;align-items:flex-start;gap:14px;">
            ${logo}
            <div>
              <div style="font-size:18px;font-weight:900;color:${titleColor};">${d.biz.name}</div>
              <div style="font-size:11px;color:${subtitleColor};line-height:1.5;margin-top:3px;">
                ${d.biz.address ? d.biz.address + '<br>' : ''}
                ${d.biz.phone ? 'Tél.: ' + d.biz.phone + '<br>' : ''}
                ${d.biz.email || ''}
              </div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:26px;font-weight:900;color:${titleColor};letter-spacing:-0.02em;">${lbl}</div>
            <div style="font-size:13px;font-weight:700;color:${titleColor};margin-top:3px;">${d.docNum}</div>
            <div style="font-size:11px;color:${subtitleColor};margin-top:3px;">Date d'émission : <strong>${d.issueDate}</strong></div>
            ${d.dueDate ? `<div style="font-size:11px;color:${subtitleColor};">Date d'échéance : <strong>${d.dueDate}</strong></div>` : ''}
          </div>
        </div>
      `;
    }

    if (pos === 'center') {
      return `
        <div style="text-align:center;margin-bottom:20px;border-bottom:1px solid ${isDark ? '#2D323F' : '#E2E8F0'};padding-bottom:16px;">
          <div style="margin-bottom:8px;">${logo}</div>
          <div style="font-size:20px;font-weight:900;color:${titleColor};">${lbl} · ${d.docNum}</div>
          <div style="font-size:12px;font-weight:700;color:${titleColor};margin-top:2px;">${d.biz.name}</div>
          <div style="font-size:10px;color:${subtitleColor};margin-top:2px;">
            ${d.biz.address} · ${d.biz.phone} · ${d.biz.email}
          </div>
          <div style="font-size:11px;color:${subtitleColor};margin-top:4px;">
            Date d'émission : <strong>${d.issueDate}</strong> ${d.dueDate ? `· Échéance : <strong>${d.dueDate}</strong>` : ''}
          </div>
        </div>
      `;
    }

    // Default: 'right' (Matches reference image)
    return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
        <div>
          <div style="font-size:26px;font-weight:900;color:${titleColor};letter-spacing:-0.02em;margin-bottom:4px;">${lbl}</div>
          <div style="font-size:14px;font-weight:800;color:${titleColor};">${d.biz.name}</div>
          <div style="font-size:11px;color:${subtitleColor};line-height:1.5;margin-top:2px;">
            ${d.biz.address ? d.biz.address + '<br>' : ''}
            ${d.biz.phone ? 'Tél.: ' + d.biz.phone + '<br>' : ''}
            ${d.biz.email || ''}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
            ${logo}
          </div>
          <div style="font-size:14px;font-weight:800;color:${titleColor};">${d.docNum}</div>
          <div style="font-size:11px;color:${subtitleColor};margin-top:3px;">Date d'émission : <span style="color:${titleColor};font-weight:600;">${d.issueDate}</span></div>
          ${d.dueDate ? `<div style="font-size:11px;color:${subtitleColor};">Date d'échéance : <span style="color:${titleColor};font-weight:600;">${d.dueDate}</span></div>` : ''}
        </div>
      </div>
    `;
  },

  // ── Client Box Renderer Helper ────────────────────────────────────────
  renderClient: function (d, titleColor, subtitleColor, isDark = false) {
    return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;background:${isDark ? '#222631' : '#F8FAFC'};padding:12px 14px;border-radius:6px;border:1px solid ${isDark ? '#2D323F' : '#E2E8F0'};">
        <div>
          <div style="font-size:10px;text-transform:uppercase;color:${subtitleColor};font-weight:700;letter-spacing:0.5px;">Client / Facturé à</div>
          <div style="font-size:14px;font-weight:800;color:${titleColor};margin-top:2px;">${d.client.name}</div>
          <div style="font-size:11px;color:${subtitleColor};line-height:1.4;margin-top:2px;">
            ${d.client.address ? d.client.address + '<br>' : ''}
            ${d.client.phone ? 'Tél.: ' + d.client.phone : ''}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:10px;text-transform:uppercase;color:${subtitleColor};font-weight:700;letter-spacing:0.5px;">Contact &amp; Email</div>
          <div style="font-size:12px;font-weight:600;color:${titleColor};margin-top:2px;">${d.client.email || '--'}</div>
          ${d.client.taxId ? `<div style="font-size:10px;color:${subtitleColor};margin-top:2px;">NINEA / SIRET : ${d.client.taxId}</div>` : ''}
        </div>
      </div>
    `;
  },

  // ── Totals, Payments & Footer Helper ──────────────────────────────────
  renderBottom: function (d, ac, isDark = false) {
    return `
      <div style="margin-top:auto;padding-top:14px;border-top:1.5px solid ${isDark ? '#2D323F' : '#E2E8F0'};">
        <!-- Totals Block -->
        <div style="display:flex;justify-content:flex-end;margin-bottom:16px;">
          <div style="width:260px;font-size:12px;">
            <div style="display:flex;justify-content:space-between;padding:3px 0;color:${isDark ? '#94A3B8' : '#64748B'};">
              <span>Sous-total HT :</span><strong style="color:${isDark ? '#E2E8F0' : '#0F172A'};">${this.fmt(d.subtotal, d.currency)}</strong>
            </div>
            <div style="display:flex;justify-content:space-between;padding:3px 0;color:${isDark ? '#94A3B8' : '#64748B'};">
              <span>Calcul de TVA :</span><strong style="color:${isDark ? '#E2E8F0' : '#0F172A'};">${this.fmt(d.taxAmount, d.currency)}</strong>
            </div>
            ${d.discount > 0 ? `
              <div style="display:flex;justify-content:space-between;padding:3px 0;color:#EF4444;">
                <span>Réduction :</span><strong>-${this.fmt(d.discount, d.currency)}</strong>
              </div>` : ''}
            <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900;color:${isDark ? '#F5D0B5' : ac};border-top:2px solid ${ac};padding-top:8px;margin-top:6px;">
              <span>Total :</span><span>${this.fmt(d.grandTotal, d.currency)}</span>
            </div>
          </div>
        </div>

        <!-- Payment Info & Notes -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;background:${isDark ? '#222631' : '#F8FAFC'};padding:10px 14px;border-radius:6px;font-size:11px;color:${isDark ? '#94A3B8' : '#475569'};margin-bottom:12px;">
          <div>
            <strong style="color:${isDark ? '#E2E8F0' : '#0F172A'};display:block;margin-bottom:3px;">Paiement</strong>
            <div>Règlement : <span style="font-weight:600;color:${isDark ? '#E2E8F0' : '#0F172A'};">${d.paymentMethod}</span></div>
            <div>Conditions : <span style="font-weight:600;color:${isDark ? '#E2E8F0' : '#0F172A'};">${d.terms}</span></div>
          </div>
          <div>
            ${d.notes ? `<strong style="color:${isDark ? '#E2E8F0' : '#0F172A'};display:block;margin-bottom:3px;">Notes / Mentions</strong><div>${d.notes}</div>` : ''}
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align:center;font-size:10px;color:${isDark ? '#64748B' : '#94A3B8'};padding-top:6px;border-top:1px solid ${isDark ? '#2D323F' : '#F1F5F9'};">
          ${[d.biz.name, d.biz.address, d.biz.taxId].filter(Boolean).join(' · ')}
        </div>
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
    return `
      <div style="background:#FFFFFF;font-family:Inter,Arial,sans-serif;height:100%;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;padding:28px 34px;color:#1E293B;position:relative;">
        <div>
          ${this.renderHeader(d, ac, '#475569')}
          ${this.renderClient(d, '#0F172A', '#475569')}

          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
            <thead>
              <tr style="border-bottom:2px solid ${ac};">
                <th style="padding:7px 10px;text-align:left;color:#0F172A;font-weight:700;">Description</th>
                <th style="padding:7px 10px;text-align:center;width:10%;color:#0F172A;font-weight:700;">Quantité</th>
                <th style="padding:7px 10px;text-align:right;width:18%;color:#0F172A;font-weight:700;">Prix Unitaire</th>
                <th style="padding:7px 10px;text-align:center;width:12%;color:#0F172A;font-weight:700;">TVA</th>
                <th style="padding:7px 10px;text-align:right;width:18%;color:#0F172A;font-weight:700;">Total</th>
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
    return `
      <div style="background:#FFFFFF;font-family:Inter,Arial,sans-serif;height:100%;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;color:#1E293B;position:relative;">
        <div>
          <div style="background:${ac};padding:18px 34px;color:#FFFFFF;margin-bottom:20px;">
            ${this.renderHeader(d, '#FFFFFF', 'rgba(255,255,255,0.75)')}
          </div>
          <div style="padding:0 34px;">
            ${this.renderClient(d, '#0F172A', '#64748B')}

            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
              <thead>
                <tr style="background:${ac};color:#FFFFFF;">
                  <th style="padding:7px 10px;text-align:left;font-weight:700;">Description</th>
                  <th style="padding:7px 10px;text-align:center;width:10%;font-weight:700;">Quantité</th>
                  <th style="padding:7px 10px;text-align:right;width:18%;font-weight:700;">Prix Unitaire</th>
                  <th style="padding:7px 10px;text-align:center;width:12%;font-weight:700;">TVA</th>
                  <th style="padding:7px 10px;text-align:right;width:18%;font-weight:700;">Total</th>
                </tr>
              </thead>
              <tbody>${this.rows(d.items, d.currency, '#EFF6FF')}</tbody>
            </table>
          </div>
        </div>

        <div style="padding:0 34px 24px 34px;">
          ${this.renderBottom(d, ac)}
        </div>
      </div>
    `;
  },

  // 3. ELEGANT (No "MAISON & COMMERCE" - Luxury Serif)
  renderElegant: function (d) {
    const ac = d.primaryColor || '#C9A84C';
    return `
      <div style="background:#FFFDF7;font-family:Georgia,serif;height:100%;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;padding:26px 32px;color:#2D241E;border:6px solid #F6F1E5;position:relative;">
        <div>
          ${this.renderHeader(d, ac, '#6B5C2A')}
          ${this.renderClient(d, '#2D241E', '#6B5C2A')}

          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
            <thead>
              <tr style="border-bottom:2px solid ${ac};color:${ac};">
                <th style="padding:7px 10px;text-align:left;font-weight:700;">Description</th>
                <th style="padding:7px 10px;text-align:center;width:10%;font-weight:700;">Quantité</th>
                <th style="padding:7px 10px;text-align:right;width:18%;font-weight:700;">Prix Unitaire</th>
                <th style="padding:7px 10px;text-align:center;width:12%;font-weight:700;">TVA</th>
                <th style="padding:7px 10px;text-align:right;width:18%;font-weight:700;">Montant</th>
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
    return `
      <div style="background:#FFFFFF;font-family:Inter,sans-serif;height:100%;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;padding:26px 34px;position:relative;">
        <div>
          <div style="height:6px;background:linear-gradient(90deg,${ac},#8B5CF6,#EC4899);border-radius:3px;margin-bottom:18px;"></div>
          ${this.renderHeader(d, '#1E1B4B', '#64748B')}
          ${this.renderClient(d, '#1E1B4B', '#64748B')}

          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
            <thead>
              <tr style="background:${ac};color:#FFFFFF;">
                <th style="padding:7px 10px;text-align:left;font-weight:700;border-radius:4px 0 0 4px;">Description</th>
                <th style="padding:7px 10px;text-align:center;width:10%;font-weight:700;">Quantité</th>
                <th style="padding:7px 10px;text-align:right;width:18%;font-weight:700;">Prix Unitaire</th>
                <th style="padding:7px 10px;text-align:center;width:12%;font-weight:700;">TVA</th>
                <th style="padding:7px 10px;text-align:right;width:18%;font-weight:700;border-radius:0 4px 4px 0;">Total</th>
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
    return `
      <div style="background:#FFFFFF;font-family:Inter,sans-serif;height:100%;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;padding:26px 34px;border-top:6px solid ${ac};position:relative;">
        <div>
          ${this.renderHeader(d, ac, '#64748B')}
          ${this.renderClient(d, '#0F172A', '#64748B')}

          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
            <thead>
              <tr style="background:${ac};color:#FFFFFF;">
                <th style="padding:7px 10px;text-align:left;font-weight:700;">Description</th>
                <th style="padding:7px 10px;text-align:center;width:10%;font-weight:700;">Quantité</th>
                <th style="padding:7px 10px;text-align:right;width:18%;font-weight:700;">Prix Unitaire</th>
                <th style="padding:7px 10px;text-align:center;width:12%;font-weight:700;">TVA</th>
                <th style="padding:7px 10px;text-align:right;width:18%;font-weight:700;">Total</th>
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
    return `
      <div style="background:#FFFFFF;font-family:Inter,sans-serif;height:100%;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;color:#111;position:relative;">
        <div>
          <div style="background:#111;padding:16px 34px;color:#FFFFFF;margin-bottom:18px;">
            ${this.renderHeader(d, '#FFFFFF', '#9CA3AF')}
          </div>
          <div style="padding:0 34px;">
            ${this.renderClient(d, '#111', '#4B5563')}

            <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
              <thead>
                <tr style="background:#111;color:#FFFFFF;">
                  <th style="padding:7px 10px;text-align:left;font-weight:800;">DESCRIPTION</th>
                  <th style="padding:7px 10px;text-align:center;width:10%;font-weight:800;">QTÉ</th>
                  <th style="padding:7px 10px;text-align:right;width:18%;font-weight:800;">P.U</th>
                  <th style="padding:7px 10px;text-align:center;width:12%;font-weight:800;">TVA</th>
                  <th style="padding:7px 10px;text-align:right;width:18%;font-weight:800;background:${ac};">TOTAL</th>
                </tr>
              </thead>
              <tbody>${this.rows(d.items, d.currency, '#FEE2E2')}</tbody>
            </table>
          </div>
        </div>

        <div style="padding:0 34px 20px 34px;">
          ${this.renderBottom(d, ac)}
        </div>
      </div>
    `;
  },

  // 7. PREMIUM (Copper Metallic & Dark Matte)
  renderPremium: function (d) {
    return `
      <div style="background:#181A20;font-family:Inter,sans-serif;height:100%;min-height:100%;width:100%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;padding:26px 34px;color:#F1F5F9;position:relative;">
        <div>
          ${this.renderHeader(d, '#F5D0B5', '#94A3B8', true)}
          <div style="height:8px;background:linear-gradient(90deg,#D49B7A 0%,#F5D0B5 50%,#B87352 100%);border-radius:2px;margin-bottom:18px;box-shadow:0 3px 10px rgba(212,155,122,0.3);"></div>
          ${this.renderClient(d, '#FFFFFF', '#94A3B8', true)}

          <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px;">
            <thead>
              <tr style="background:#222631;color:#F5D0B5;border-bottom:1.5px solid #D49B7A;">
                <th style="padding:7px 10px;text-align:left;font-weight:700;">Description</th>
                <th style="padding:7px 10px;text-align:center;width:10%;font-weight:700;">Quantité</th>
                <th style="padding:7px 10px;text-align:right;width:18%;font-weight:700;">Prix Unitaire</th>
                <th style="padding:7px 10px;text-align:center;width:12%;font-weight:700;">TVA</th>
                <th style="padding:7px 10px;text-align:right;width:18%;font-weight:700;">Total</th>
              </tr>
            </thead>
            <tbody>${this.rows(d.items, d.currency, '#2A221E', true)}</tbody>
          </table>
        </div>

        ${this.renderBottom(d, '#D49B7A', true)}
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
      default:            html = this.renderMinimalist(d); break;
    }

    // Inlay professional "PAYÉE" background watermark if status is paid
    if (d.status === 'paid' && d.docType !== 'quote') {
      const stamp = `
        <div class="invoice-paid-watermark" style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%) rotate(-24deg); z-index:0; pointer-events:none; border:6px solid #10B981; border-radius:18px; padding:12px 42px; opacity:0.09; user-select:none; display:flex; align-items:center; justify-content:center;">
          <div style="font-family:'Outfit',sans-serif; font-size:68px; font-weight:900; letter-spacing:0.35em; color:#10B981; text-transform:uppercase; line-height:1;">
            PAYÉE
          </div>
        </div>
      `;
      if (html.includes('position:relative;')) {
        html = html.replace(/(<div[^>]*position:relative;[^>]*>)/i, `$1${stamp}`);
      } else {
        html = `<div style="position:relative;width:100%;height:100%;">${stamp}${html}</div>`;
      }
    }

    return html;
  }
};

console.log('[KivoTemplates]', window.KivoTemplates.builtIn.length, 'templates disponibles.');

