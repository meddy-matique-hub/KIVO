/**
 * KIVO MATIQUE — Document Templates Engine
 * 7 professional templates based on reference designs + gallery system
 * Does NOT create a second Supabase instance.
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
      return `<img src="${biz.logoUrl}" style="width:${sz};height:${sz};object-fit:contain;border-radius:${br};" alt="Logo">`;
    }
    const txt = (biz && biz.logoText) || (biz && biz.name ? biz.name.substring(0, 2).toUpperCase() : 'KM');
    const bg  = fallbackDark ? 'linear-gradient(135deg,#D49B7A,#B87352)' : ((biz && biz.logoBg) || 'linear-gradient(135deg,#4F46E5,#7C3AED)');
    return `<div style="width:${sz};height:${sz};border-radius:${br};background:${bg};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:calc(${sz} * 0.36);flex-shrink:0;">${txt}</div>`;
  },

  rows: function (items, currency, accBg, isDark = false) {
    if (!items || items.length === 0)
      return `<tr><td colspan="4" style="text-align:center;color:${isDark ? '#64748B' : '#94a3b8'};padding:14px;font-size:11px;">Aucun article saisi</td></tr>`;
    return items.map((it, i) => `
      <tr style="background:${isDark ? (i % 2 === 0 ? '#1E222B' : '#181A20') : (i % 2 === 0 ? '#fff' : '#f8fafc')};">
        <td style="padding:10px 12px;font-size:11px;border-bottom:1px solid ${isDark ? '#2D323F' : '#f1f5f9'};color:${isDark ? '#E2E8F0' : '#1E293B'};">${it.name}</td>
        <td style="padding:10px 12px;font-size:11px;text-align:center;border-bottom:1px solid ${isDark ? '#2D323F' : '#f1f5f9'};color:${isDark ? '#94A3B8' : '#64748B'};">${it.quantity}</td>
        <td style="padding:10px 12px;font-size:11px;text-align:right;border-bottom:1px solid ${isDark ? '#2D323F' : '#f1f5f9'};color:${isDark ? '#E2E8F0' : '#1E293B'};">${this.fmt(it.price, currency)}</td>
        <td style="padding:10px 12px;font-size:11px;text-align:right;font-weight:600;border-bottom:1px solid ${isDark ? '#2D323F' : '#f1f5f9'};${accBg ? 'background:' + accBg + ';' : ''}color:${isDark ? '#F5D0B5' : '#0F172A'};">${this.fmt(it.total, currency)}</td>
      </tr>`).join('');
  },

  collectData: function (state) {
    const biz = (state && state.business) || {};
    const get = id => { const el = document.getElementById(id); return el ? el.value : ''; };

    const clientId = get('builder-doc-client-select');
    const client = (state && state.clients) ? (state.clients.find(c => c.id === clientId) || {}) : {};

    const items = [];
    let subtotal = 0;
    document.querySelectorAll('#builder-items-tbody tr').forEach(tr => {
      const name  = (tr.querySelector('.item-name')  || {}).value || '';
      const qty   = parseFloat((tr.querySelector('.item-qty')   || {}).value) || 1;
      const price = parseFloat((tr.querySelector('.item-price') || {}).value) || 0;
      if (name) {
        const itemTotal = qty * price;
        subtotal += itemTotal;
        items.push({ name, quantity: qty, price, total: itemTotal });
      }
    });

    if (items.length === 0) {
      items.push({ name: 'Prestation de service & Développement', quantity: 1, price: 150000, total: 150000 });
      subtotal = 150000;
    }

    const discount   = parseFloat(get('builder-input-discount')) || 0;
    const taxRate    = parseFloat(get('builder-input-tax'))      || 18;
    const taxable    = Math.max(0, subtotal - discount);
    const taxAmount  = taxable * (taxRate / 100);
    const grandTotal = Math.max(0, taxable + taxAmount);
    const currency   = get('builder-doc-currency') || biz.currency || 'FCFA';

    return {
      biz,
      docType:   get('builder-doc-type')    || 'invoice',
      docNum:    get('builder-doc-number')   || 'FAC-2026-0001',
      issueDate: get('builder-issue-date')   || new Date().toISOString().split('T')[0],
      dueDate:   get('builder-due-date')     || '',
      status:    get('builder-doc-status')   || 'sent',
      notes:     get('builder-notes')        || '',
      terms:     get('builder-terms')        || 'Paiement à réception.',
      client: {
        name:    client.name || get('builder-client-name') || 'Client Destinataire',
        company: client.company || '',
        phone:   client.phone || get('builder-client-phone') || '',
        email:   client.email || get('builder-client-email') || '',
        address: client.address || get('builder-client-address') || '',
        taxId:   client.taxId || ''
      },
      items, subtotal, discount, taxRate, taxAmount, grandTotal, currency,
      primaryColor:   (document.getElementById('builder-color-primary')   || {}).value || biz.primaryColor   || '#0F172A',
      secondaryColor: (document.getElementById('builder-color-secondary') || {}).value || biz.secondaryColor || '#64748B',
    };
  },

  // ── Gallery Mini-Previews (Realistic A4 Thumbnails Matching Image 2) ──
  miniPreview: function (id) {
    const wrap = (inner, bg) =>
      `<div class="tmpl-mini-wrap" style="background:${bg || '#fff'};width:155px;height:195px;font-size:0;line-height:0;position:relative;display:flex;flex-direction:column;box-shadow:0 12px 26px -4px rgba(0,0,0,0.22);">
        ${inner}
      </div>`;

    const lineBlock = (w, h, bg, mb, extra) =>
      `<div style="width:${w};height:${h}px;background:${bg};margin-bottom:${mb || 2}px;border-radius:2px;${extra || ''}"></div>`;

    const tableRows = (accentBg, textBg, n) => {
      let r = '';
      for (let i = 0; i < (n || 4); i++) {
        r += `<div style="display:flex;gap:3px;margin-bottom:2px;padding:2px 0;border-bottom:1px solid rgba(0,0,0,0.05);">
          <div style="flex:3;height:5px;background:${i % 2 === 0 ? textBg : 'rgba(0,0,0,0.06)'};border-radius:1px;"></div>
          <div style="flex:1;height:5px;background:${accentBg};border-radius:1px;"></div>
          <div style="flex:1;height:5px;background:${accentBg};border-radius:1px;"></div>
        </div>`;
      }
      return r;
    };

    const templates = {

      // ── MINIMALIST: crisp white sheet, logo left, serif INVOICE right, elegant dividers
      minimalist: () => wrap(`
        <div style="padding:10px;background:#fff;height:100%;display:flex;flex-direction:column;box-sizing:border-box;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
            <div>
              <div style="width:24px;height:24px;background:#CBD5E1;border-radius:4px;margin-bottom:4px;"></div>
              ${lineBlock('55px', 4, '#94A3B8', 2)}
              ${lineBlock('40px', 3, '#CBD5E1', 0)}
            </div>
            <div style="text-align:right;">
              <div style="font-family:serif;font-size:9px;font-weight:700;color:#1E293B;line-height:1.2;margin-bottom:3px;">INVOICE</div>
              ${lineBlock('50px', 3, '#E2E8F0', 2)}
              ${lineBlock('42px', 3, '#E2E8F0', 0)}
            </div>
          </div>
          <div style="border-top:1.5px solid #E2E8F0;padding-top:4px;margin-bottom:6px;">
            ${lineBlock('45%', 4, '#0F172A', 2)}
            ${lineBlock('60%', 3, '#94A3B8', 0)}
          </div>
          <div style="background:#F1F5F9;border-radius:2px;padding:3px 4px;margin-bottom:3px;display:flex;gap:3px;">
            <div style="flex:3;height:4px;background:#64748B;border-radius:1px;"></div>
            <div style="flex:1;height:4px;background:#64748B;border-radius:1px;"></div>
            <div style="flex:1;height:4px;background:#64748B;border-radius:1px;"></div>
          </div>
          ${tableRows('rgba(0,0,0,0.08)', 'rgba(0,0,0,0.07)', 4)}
          <div style="margin-top:auto;display:flex;justify-content:flex-end;">
            <div style="text-align:right;">
              ${lineBlock('50px', 3, '#94A3B8', 2)}
              ${lineBlock('70px', 5, '#0F172A', 0)}
            </div>
          </div>
        </div>`, '#fff'),

      // ── CORPORATE: navy blue header band, white text & logo, clean professional table
      corporate: () => wrap(`
        <div style="background:#fff;height:100%;display:flex;flex-direction:column;box-sizing:border-box;">
          <div style="background:#1E3A5F;padding:8px 10px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="width:20px;height:20px;background:rgba(255,255,255,0.25);border-radius:3px;margin-bottom:2px;"></div>
              ${lineBlock('48px', 3, 'rgba(255,255,255,0.7)', 0)}
            </div>
            <div style="color:#fff;font-size:9px;font-weight:800;font-family:sans-serif;letter-spacing:0.5px;">INVOICE</div>
          </div>
          <div style="padding:6px 10px;flex:1;display:flex;flex-direction:column;">
            <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
              <div>${lineBlock('45px', 3, '#94A3B8', 2)}${lineBlock('60px', 4, '#1E3A5F', 0)}</div>
              <div style="text-align:right;">${lineBlock('40px', 3, '#94A3B8', 2)}${lineBlock('50px', 4, '#0F172A', 0)}</div>
            </div>
            <div style="background:#EFF6FF;border-radius:2px;padding:3px 4px;display:flex;gap:3px;margin-bottom:3px;">
              <div style="flex:3;height:4px;background:#1E3A5F;border-radius:1px;"></div>
              <div style="flex:1;height:4px;background:#1E3A5F;border-radius:1px;"></div>
              <div style="flex:1;height:4px;background:#1E40AF;border-radius:1px;"></div>
            </div>
            ${tableRows('rgba(30,58,95,0.15)', 'rgba(0,0,0,0.06)', 4)}
            <div style="margin-top:auto;border-top:1px solid #E2E8F0;padding-top:4px;display:flex;justify-content:flex-end;">
              <div style="background:#1E3A5F;height:14px;width:75px;border-radius:2px;display:flex;align-items:center;justify-content:center;">
                ${lineBlock('55px', 3, 'rgba(255,255,255,0.9)', 0)}
              </div>
            </div>
          </div>
        </div>`, '#fff'),

      // ── ELEGANT: warm champagne paper, gold border, refined serif italic "Invoice"
      elegant: () => wrap(`
        <div style="background:#FFFDF7;height:100%;display:flex;flex-direction:column;border:1.5px solid #E8D5A0;box-sizing:border-box;">
          <div style="padding:8px 10px 4px;border-bottom:1.5px solid #C9A84C;text-align:center;">
            <div style="font-size:11px;color:#C9A84C;font-style:italic;font-family:serif;font-weight:600;margin-bottom:2px;">Invoice</div>
            <div style="display:flex;justify-content:center;gap:4px;">
              ${lineBlock('45px', 2, '#C9A84C', 0)}
              ${lineBlock('30px', 2, '#E8D5A0', 0)}
            </div>
          </div>
          <div style="padding:6px 10px;flex:1;display:flex;flex-direction:column;">
            <div style="margin-bottom:5px;">${lineBlock('40%', 3, '#C9A84C', 2)}${lineBlock('55%', 3, '#6B5C2A', 0)}</div>
            <div style="border:1px solid #E8D5A0;border-radius:2px;overflow:hidden;margin-bottom:3px;">
              <div style="background:#F7EAC8;padding:3px 4px;display:flex;gap:3px;">
                <div style="flex:3;height:4px;background:#A68B3A;border-radius:1px;"></div>
                <div style="flex:1;height:4px;background:#C9A84C;border-radius:1px;"></div>
                <div style="flex:1;height:4px;background:#C9A84C;border-radius:1px;"></div>
              </div>
              <div style="padding:2px 4px;">${tableRows('#C9A84C', 'rgba(0,0,0,0.05)', 3)}</div>
            </div>
            <div style="margin-top:auto;text-align:center;border-top:1px solid #E8D5A0;padding-top:4px;">
              ${lineBlock('60%', 2, '#C9A84C', 0, 'margin:0 auto;')}
            </div>
          </div>
        </div>`, '#FFFDF7'),

      // ── MODERN: vibrant crimson/purple gradient top bar, modern table & pill badge
      modern: () => wrap(`
        <div style="background:#fff;height:100%;display:flex;flex-direction:column;box-sizing:border-box;">
          <div style="height:6px;background:linear-gradient(90deg,#7C3AED,#EC4899,#F59E0B);"></div>
          <div style="padding:7px 10px;display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px;">
            <div>
              <div style="width:20px;height:20px;background:linear-gradient(135deg,#7C3AED,#EC4899);border-radius:4px;margin-bottom:3px;"></div>
              ${lineBlock('45px', 3, '#1E1B4B', 0)}
            </div>
            <div style="text-align:right;">
              <div style="font-size:8px;font-weight:900;color:#7C3AED;font-family:sans-serif;letter-spacing:1px;margin-bottom:2px;">INVOICE</div>
              <div style="background:#EDE9FE;color:#7C3AED;padding:1px 5px;border-radius:10px;font-size:6px;font-weight:700;display:inline-block;">EN ATTENTE</div>
            </div>
          </div>
          <div style="padding:0 10px 6px;flex:1;display:flex;flex-direction:column;">
            <div style="background:#F5F3FF;border-radius:2px;padding:3px 4px;display:flex;gap:3px;margin-bottom:3px;">
              <div style="flex:3;height:4px;background:#7C3AED;border-radius:1px;"></div>
              <div style="flex:1;height:4px;background:#EC4899;border-radius:1px;"></div>
              <div style="flex:1;height:4px;background:#7C3AED;border-radius:1px;"></div>
            </div>
            ${tableRows('#A78BFA', 'rgba(124,58,237,0.07)', 4)}
            <div style="margin-top:auto;background:linear-gradient(90deg,#7C3AED,#EC4899);height:15px;border-radius:2px;display:flex;align-items:center;justify-content:space-between;padding:0 6px;">
              ${lineBlock('30px', 2, 'rgba(255,255,255,0.7)', 0)}${lineBlock('38px', 3, 'rgba(255,255,255,0.95)', 0)}
            </div>
          </div>
        </div>`, '#fff'),

      // ── CLEAN: dark teal top line, clean structured corporate lines
      clean: () => wrap(`
        <div style="background:#fff;height:100%;display:flex;flex-direction:column;box-sizing:border-box;">
          <div style="border-top:3.5px solid #0E7490;padding:7px 10px 4px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="width:18px;height:18px;background:#0E7490;border-radius:3px;margin-bottom:2px;"></div>
                ${lineBlock('45px', 3, '#0E7490', 0)}
              </div>
              <div style="text-align:right;">
                <div style="font-size:8px;font-weight:800;color:#0E7490;font-family:sans-serif;">INVOICE</div>
                ${lineBlock('38px', 2, '#94A3B8', 0)}
              </div>
            </div>
          </div>
          <div style="padding:4px 10px 6px;flex:1;display:flex;flex-direction:column;">
            <div style="margin-bottom:4px;">${lineBlock('55%', 3, '#0F172A', 1)}${lineBlock('35%', 2, '#94A3B8', 0)}</div>
            <div style="background:#F0FDFA;border-radius:2px;padding:3px 4px;display:flex;gap:3px;margin-bottom:3px;">
              <div style="flex:3;height:4px;background:#0E7490;border-radius:1px;"></div>
              <div style="flex:1;height:4px;background:#0E7490;border-radius:1px;"></div>
              <div style="flex:1;height:4px;background:#0E7490;border-radius:1px;"></div>
            </div>
            ${tableRows('rgba(14,116,144,0.15)', 'rgba(0,0,0,0.06)', 4)}
            <div style="margin-top:auto;border-top:1px solid #CCFBF1;padding-top:3px;display:flex;justify-content:flex-end;">
              <div style="background:#0E7490;color:#fff;padding:1px 6px;border-radius:2px;font-size:6px;font-weight:700;">TOTAL</div>
            </div>
          </div>
        </div>`, '#fff'),

      // ── EDITORIAL: bold black header with red accent, high-impact typography
      editorial: () => wrap(`
        <div style="background:#fff;height:100%;display:flex;flex-direction:column;box-sizing:border-box;">
          <div style="background:#111;padding:7px 10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="display:flex;gap:2px;margin-bottom:2px;">
                  <div style="width:14px;height:14px;background:#EF4444;border-radius:2px;"></div>
                  <div style="width:14px;height:14px;background:rgba(255,255,255,0.2);border-radius:2px;"></div>
                </div>
                ${lineBlock('45px', 3, 'rgba(255,255,255,0.85)', 0)}
              </div>
              <div style="text-align:right;">
                <div style="font-size:8px;font-weight:900;color:#EF4444;font-family:sans-serif;letter-spacing:1px;">INVOICE</div>
                ${lineBlock('38px', 2, 'rgba(255,255,255,0.5)', 0)}
              </div>
            </div>
          </div>
          <div style="padding:6px 10px;flex:1;display:flex;flex-direction:column;">
            ${lineBlock('70%', 4, '#111', 2)}
            ${lineBlock('50%', 3, '#6B7280', 4)}
            <div style="background:#111;padding:3px 4px;display:flex;gap:3px;margin-bottom:3px;border-radius:2px;">
              <div style="flex:3;height:4px;background:rgba(255,255,255,0.7);border-radius:1px;"></div>
              <div style="flex:1;height:4px;background:#EF4444;border-radius:1px;"></div>
              <div style="flex:1;height:4px;background:rgba(255,255,255,0.7);border-radius:1px;"></div>
            </div>
            ${tableRows('rgba(239,68,68,0.2)', 'rgba(0,0,0,0.06)', 4)}
            <div style="margin-top:auto;border-top:1.5px solid #111;padding-top:3px;display:flex;justify-content:flex-end;">
              ${lineBlock('60px', 4, '#EF4444', 0)}
            </div>
          </div>
        </div>`, '#fff'),

      // ── PREMIUM: dark charcoal matte sheet with glowing metallic copper foil band
      premium: () => wrap(`
        <div style="background:#181A20;height:100%;display:flex;flex-direction:column;box-sizing:border-box;">
          <div style="padding:8px 10px 6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="width:18px;height:18px;background:linear-gradient(135deg,#D49B7A,#B87352);border-radius:3px;margin-bottom:2px;"></div>
                ${lineBlock('45px', 3, '#94A3B8', 0)}
              </div>
              <div style="text-align:right;">
                <div style="font-size:8px;font-weight:800;color:#F5D0B5;font-family:serif;letter-spacing:1.5px;">INVOICE</div>
                ${lineBlock('35px', 2, '#64748B', 0)}
              </div>
            </div>
          </div>
          <!-- Metallic copper/rose gold band matching Image 2 reference -->
          <div style="height:12px;background:linear-gradient(90deg,#D49B7A 0%,#F5D0B5 50%,#B87352 100%);margin-bottom:6px;display:flex;align-items:center;padding:0 6px;">
            ${lineBlock('40px', 2, 'rgba(0,0,0,0.4)', 0)}
          </div>
          <div style="padding:0 10px 6px;flex:1;display:flex;flex-direction:column;">
            <div style="margin-bottom:4px;">${lineBlock('45%', 3, '#94A3B8', 1)}${lineBlock('60%', 3, '#E2E8F0', 0)}</div>
            <div style="border:1px solid #2D323F;border-radius:2px;overflow:hidden;margin-bottom:3px;">
              <div style="background:#222631;padding:3px 4px;display:flex;gap:3px;">
                <div style="flex:3;height:4px;background:#F5D0B5;border-radius:1px;"></div>
                <div style="flex:1;height:4px;background:#D49B7A;border-radius:1px;"></div>
                <div style="flex:1;height:4px;background:#D49B7A;border-radius:1px;"></div>
              </div>
              <div style="padding:2px 4px;">
                <div style="display:flex;gap:3px;margin-bottom:2px;"><div style="flex:3;height:4px;background:rgba(255,255,255,0.15);"></div><div style="flex:1;height:4px;background:rgba(212,155,122,0.3);"></div><div style="flex:1;height:4px;background:rgba(212,155,122,0.3);"></div></div>
                <div style="display:flex;gap:3px;margin-bottom:2px;"><div style="flex:3;height:4px;background:rgba(255,255,255,0.1);"></div><div style="flex:1;height:4px;background:rgba(212,155,122,0.2);"></div><div style="flex:1;height:4px;background:rgba(212,155,122,0.2);"></div></div>
              </div>
            </div>
            <div style="margin-top:auto;background:#222631;border:1px solid #D49B7A;height:16px;border-radius:2px;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;">
              ${lineBlock('42px', 3, '#F5D0B5', 0)}
            </div>
          </div>
        </div>`, '#181A20'),
    };

    const fn = templates[id] || templates['minimalist'];
    return fn();
  },

  // ══════════════════════════════════════════════════════════════
  // FULL INVOICE RENDERERS FOR LIVE PREVIEW & EXPORT
  // ══════════════════════════════════════════════════════════════

  // 1. MINIMALIST
  renderMinimalist: function (d) {
    const lbl = d.docType === 'quote' ? 'DEVIS' : 'FACTURE';
    return `
      <div style="background:#fff;font-family:Inter,Arial,sans-serif;padding:40px;min-height:950px;position:relative;color:#1e293b;box-sizing:border-box;display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">
          <div>
            ${this.logoHtml(d.biz, '52px', 'square')}
            <div style="font-weight:800;font-size:16px;color:#0F172A;margin-top:8px;">${d.biz.name || 'KIVO MATIQUE'}</div>
            <div style="font-size:11px;color:#64748b;line-height:1.6;margin-top:4px;">
              ${d.biz.address || ''}<br>
              ${d.biz.phone ? '📞 ' + d.biz.phone : ''} ${d.biz.email ? '✉ ' + d.biz.email : ''}
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:serif;font-size:32px;font-weight:800;color:#0F172A;letter-spacing:1px;line-height:1;">${lbl}</div>
            <div style="font-size:13px;font-weight:700;color:#334155;margin-top:6px;">N° ${d.docNum}</div>
            <div style="font-size:11px;color:#64748b;margin-top:4px;">Émission : ${d.issueDate || '--/--/----'}</div>
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
            <div style="font-size:26px;font-weight:900;color:#0F172A;margin-top:2px;">${this.fmt(d.grandTotal, d.currency)}</div>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px;">
          <thead>
            <tr style="border-bottom:2px solid #0F172A;">
              <th style="padding:10px 12px;text-align:left;color:#0F172A;">Description</th>
              <th style="padding:10px 12px;text-align:center;width:12%;color:#0F172A;">Qté</th>
              <th style="padding:10px 12px;text-align:right;width:20%;color:#0F172A;">Prix U.</th>
              <th style="padding:10px 12px;text-align:right;width:20%;color:#0F172A;">Total</th>
            </tr>
          </thead>
          <tbody>${this.rows(d.items, d.currency)}</tbody>
        </table>

        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:auto;padding-top:20px;border-top:1px solid #E2E8F0;">
          <div style="max-width:50%;font-size:11px;color:#64748b;">
            <div style="font-weight:700;color:#0F172A;margin-bottom:4px;">Modalités & Règlement</div>
            <div>${d.terms || 'Paiement à réception.'}</div>
            ${d.notes ? `<div style="margin-top:6px;"><strong>Note :</strong> ${d.notes}</div>` : ''}
          </div>
          <div style="min-width:230px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;color:#64748b;">
              <span>Sous-total HT :</span><span style="font-weight:600;color:#0F172A;">${this.fmt(d.subtotal, d.currency)}</span>
            </div>
            ${d.taxRate > 0 ? `
              <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;color:#64748b;">
                <span>TVA (${d.taxRate}%) :</span><span style="color:#0F172A;">${this.fmt(d.taxAmount, d.currency)}</span>
              </div>` : ''}
            ${d.discount > 0 ? `
              <div style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;color:#EF4444;">
                <span>Réduction :</span><span>-${this.fmt(d.discount, d.currency)}</span>
              </div>` : ''}
            <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:800;color:#0F172A;border-top:2px solid #0F172A;padding-top:8px;margin-top:6px;">
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
            ${this.logoHtml(d.biz, '48px', 'square')}
            <div>
              <div style="color:#fff;font-weight:800;font-size:18px;">${d.biz.name || 'KIVO MATIQUE'}</div>
              <div style="color:rgba(255,255,255,0.7);font-size:10px;">${d.biz.address || ''}</div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="color:#fff;font-weight:900;font-size:24px;letter-spacing:1px;">${lbl}</div>
            <div style="color:rgba(255,255,255,0.8);font-size:12px;font-weight:600;">N° ${d.docNum}</div>
          </div>
        </div>

        <div style="padding:28px 36px;flex:1;display:flex;flex-direction:column;">
          <div style="display:flex;justify-content:space-between;margin-bottom:24px;background:#F8FAFC;padding:16px;border-radius:6px;border:1px solid #E2E8F0;">
            <div>
              <div style="font-size:10px;text-transform:uppercase;color:#64748B;font-weight:700;">Destinataire</div>
              <div style="font-size:14px;font-weight:700;color:#0F172A;margin-top:2px;">${d.client.name}</div>
              <div style="font-size:11px;color:#64748B;">${d.client.phone || ''} · ${d.client.email || ''}</div>
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
                <th style="padding:10px 12px;text-align:right;width:20%;">Prix</th>
                <th style="padding:10px 12px;text-align:right;width:20%;">Total</th>
              </tr>
            </thead>
            <tbody>${this.rows(d.items, d.currency)}</tbody>
          </table>

          <div style="display:flex;justify-content:flex-end;margin-top:auto;margin-bottom:20px;">
            <div style="width:240px;">
              <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px;color:#64748B;"><span>Sous-total HT :</span><span>${this.fmt(d.subtotal, d.currency)}</span></div>
              <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px;color:#64748B;"><span>TVA (${d.taxRate}%) :</span><span>${this.fmt(d.taxAmount, d.currency)}</span></div>
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
    return `
      <div style="background:#FFFDF7;font-family:Georgia,serif;padding:40px;min-height:950px;position:relative;color:#2D241E;border:12px solid #F6F1E5;box-sizing:border-box;display:flex;flex-direction:column;">
        <div style="text-align:center;border-bottom:2px solid #C9A84C;padding-bottom:18px;margin-bottom:24px;">
          <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#A68B3A;margin-bottom:4px;">MAISON &amp; COMMERCE</div>
          <div style="font-size:32px;font-weight:700;color:#C9A84C;font-style:italic;">${lbl}</div>
          <div style="font-size:12px;color:#6B5C2A;margin-top:4px;">N° ${d.docNum} · Émise le ${d.issueDate || '--'}</div>
        </div>

        <div style="display:flex;justify-content:space-between;margin-bottom:28px;font-size:12px;line-height:1.6;">
          <div>
            <strong style="color:#C9A84C;text-transform:uppercase;font-size:10px;letter-spacing:1px;display:block;">Émetteur</strong>
            <div style="font-size:14px;font-weight:700;color:#1E1B18;">${d.biz.name || 'KIVO MATIQUE'}</div>
            <div style="color:#6B5C2A;">${d.biz.address || ''}<br>${d.biz.phone || ''}</div>
          </div>
          <div style="text-align:right;">
            <strong style="color:#C9A84C;text-transform:uppercase;font-size:10px;letter-spacing:1px;display:block;">Client Destinataire</strong>
            <div style="font-size:14px;font-weight:700;color:#1E1B18;">${d.client.name}</div>
            <div style="color:#6B5C2A;">${d.client.address || ''}<br>${d.client.phone || ''}</div>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px;">
          <thead>
            <tr style="border-bottom:2px solid #C9A84C;color:#C9A84C;">
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
            <div style="display:flex;justify-content:space-between;padding:2px 0;color:#6B5C2A;"><span>TVA (${d.taxRate}%) :</span><span>${this.fmt(d.taxAmount, d.currency)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;color:#C9A84C;border-top:2px solid #C9A84C;padding-top:6px;margin-top:4px;">
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
    return `
      <div style="background:#fff;font-family:Inter,sans-serif;padding:36px;min-height:950px;position:relative;box-sizing:border-box;display:flex;flex-direction:column;">
        <div style="height:6px;background:linear-gradient(90deg,#6366F1,#8B5CF6,#EC4899);border-radius:3px;margin-bottom:24px;"></div>
        
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">
          <div>
            ${this.logoHtml(d.biz, '48px', 'square')}
            <div style="font-size:18px;font-weight:800;color:#1E1B4B;margin-top:8px;">${d.biz.name || 'KIVO MATIQUE'}</div>
            <div style="font-size:11px;color:#64748B;">${d.biz.address || ''}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:28px;font-weight:900;background:linear-gradient(135deg,#6366F1,#8B5CF6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">${lbl}</div>
            <div style="font-size:13px;font-weight:700;color:#475569;margin-top:2px;">N° ${d.docNum}</div>
            <div style="background:#EDE9FE;color:#7C3AED;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:700;display:inline-block;margin-top:6px;">
              ${d.status === 'paid' ? 'PAYÉE' : 'EN ATTENTE'}
            </div>
          </div>
        </div>

        <div style="background:#F5F3FF;border-radius:8px;padding:16px 20px;margin-bottom:24px;display:flex;justify-content:space-between;">
          <div>
            <div style="font-size:10px;color:#7C3AED;font-weight:700;text-transform:uppercase;">Facturé à</div>
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
            <tr style="background:#8B5CF6;color:#fff;">
              <th style="padding:10px 12px;text-align:left;border-radius:4px 0 0 4px;">Description</th>
              <th style="padding:10px 12px;text-align:center;width:12%;">Qté</th>
              <th style="padding:10px 12px;text-align:right;width:20%;">Prix U.</th>
              <th style="padding:10px 12px;text-align:right;width:20%;border-radius:0 4px 4px 0;">Total</th>
            </tr>
          </thead>
          <tbody>${this.rows(d.items, d.currency, '#FDF2F8')}</tbody>
        </table>

        <div style="margin-top:auto;display:flex;justify-content:flex-end;">
          <div style="background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;padding:16px 24px;border-radius:8px;width:250px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;opacity:0.85;"><span>Sous-total :</span><span>${this.fmt(d.subtotal, d.currency)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:11px;opacity:0.85;margin-top:2px;"><span>TVA (${d.taxRate}%) :</span><span>${this.fmt(d.taxAmount, d.currency)}</span></div>
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
    return `
      <div style="background:#fff;font-family:Inter,sans-serif;padding:36px;min-height:950px;position:relative;color:#1E293B;border-top:8px solid #0E7490;box-sizing:border-box;display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">
          <div>
            <div style="font-size:22px;font-weight:800;color:#0E7490;">${d.biz.name || 'KIVO MATIQUE'}</div>
            <div style="font-size:11px;color:#64748B;margin-top:3px;">${d.biz.address || ''}<br>${d.biz.phone || ''}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:26px;font-weight:900;color:#0E7490;">${lbl}</div>
            <div style="font-size:12px;font-weight:700;color:#334155;">N° ${d.docNum}</div>
            <div style="font-size:11px;color:#64748B;">Date : ${d.issueDate || '--'}</div>
          </div>
        </div>

        <div style="background:#F0FDFA;border-left:4px solid #0E7490;padding:12px 16px;margin-bottom:24px;">
          <div style="font-size:10px;text-transform:uppercase;color:#0E7490;font-weight:700;">Client Facturé</div>
          <div style="font-size:14px;font-weight:700;color:#0F172A;margin-top:2px;">${d.client.name}</div>
          <div style="font-size:11px;color:#64748B;">${d.client.address || ''} · ${d.client.phone || ''}</div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px;">
          <thead>
            <tr style="background:#0E7490;color:#fff;">
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
            <div style="display:flex;justify-content:space-between;padding:3px 0;color:#64748B;"><span>TVA (${d.taxRate}%) :</span><span>${this.fmt(d.taxAmount, d.currency)}</span></div>
            <div style="background:#0E7490;color:#fff;display:flex;justify-content:space-between;font-size:14px;font-weight:700;padding:8px 12px;border-radius:4px;margin-top:6px;">
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
    return `
      <div style="background:#fff;font-family:Inter,sans-serif;min-height:950px;position:relative;color:#111;box-sizing:border-box;display:flex;flex-direction:column;">
        <div style="background:#111;padding:24px 36px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:20px;height:20px;background:#EF4444;border-radius:3px;"></div>
              <div style="color:#fff;font-size:18px;font-weight:900;letter-spacing:1px;">${d.biz.name || 'KIVO MATIQUE'}</div>
            </div>
            <div style="color:#9CA3AF;font-size:10px;margin-top:3px;">${d.biz.address || ''}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:26px;font-weight:900;color:#EF4444;letter-spacing:2px;">${lbl}</div>
            <div style="color:#fff;font-size:12px;font-weight:700;">N° ${d.docNum}</div>
          </div>
        </div>

        <div style="padding:28px 36px;flex:1;display:flex;flex-direction:column;">
          <div style="border-bottom:3px solid #111;padding-bottom:14px;margin-bottom:24px;display:flex;justify-content:space-between;">
            <div>
              <div style="font-size:9px;text-transform:uppercase;color:#EF4444;font-weight:900;letter-spacing:1px;">CLIENT</div>
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
                <th style="padding:10px 12px;text-align:right;width:20%;background:#EF4444;">TOTAL</th>
              </tr>
            </thead>
            <tbody>${this.rows(d.items, d.currency, '#FEE2E2')}</tbody>
          </table>

          <div style="margin-top:auto;display:flex;justify-content:flex-end;">
            <div style="width:250px;border:2px solid #111;padding:12px 16px;">
              <div style="display:flex;justify-content:space-between;font-size:11px;color:#4B5563;"><span>Sous-total HT :</span><span>${this.fmt(d.subtotal, d.currency)}</span></div>
              <div style="display:flex;justify-content:space-between;font-size:11px;color:#4B5563;margin-top:2px;"><span>TVA (${d.taxRate}%) :</span><span>${this.fmt(d.taxAmount, d.currency)}</span></div>
              <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:900;color:#111;border-top:2px solid #111;padding-top:6px;margin-top:6px;">
                <span>Total TTC :</span><span style="color:#EF4444;">${this.fmt(d.grandTotal, d.currency)}</span>
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
            ${this.logoHtml(d.biz, '48px', 'square', true)}
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
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#94A3B8;margin-top:2px;"><span>TVA (${d.taxRate}%) :</span><span style="color:#F1F5F9;">${this.fmt(d.taxAmount, d.currency)}</span></div>
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
