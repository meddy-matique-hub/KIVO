/**
 * KIVO MATIQUE — Document Templates Engine
 * 5 professional templates based on reference designs + gallery system
 * Does NOT create a second Supabase instance.
 */

window.KivoTemplates = {

  // ── Template Registry ────────────────────────────────────────────────
  builtIn: [
    { id: 'classic',     name: 'Classic Pro',      desc: 'Sobre et professionnel'     },
    { id: 'modern',      name: 'Modern Accent',    desc: 'Accents colorés dynamiques' },
    { id: 'minimal',     name: 'Minimal Clean',    desc: 'Design épuré minimaliste'   },
    { id: 'professional',name: 'Corporate',        desc: 'Style corporate sérieux'    },
    { id: 'creative',    name: 'Creative',         desc: 'Mise en page créative'      },
    { id: 'elegant',     name: 'Elegant Premium',  desc: 'Style élégant premium'      },
    { id: 'green-clean', name: 'Green Clean',      desc: 'Signature verte, tableau coloré' },
    { id: 'corp-blue',   name: 'Corporate Blue',   desc: 'Bandeau bleu navy bold'     },
    { id: 'corp-light',  name: 'Corporate Light',  desc: 'Logo cercle, accent teal'   },
    { id: 'bold-blue',   name: 'Bold Blue',        desc: 'Table colorée, footer bleu' },
    { id: 'wave-french', name: 'Devis Pro Wave',   desc: 'Vague déco, format officiel français' },
  ],

  /** Returns true if this template replaces the entire paper HTML */
  isFullHtml: function (id) {
    return ['green-clean', 'corp-blue', 'corp-light', 'bold-blue', 'wave-french'].includes(id);
  },

  // ── Helpers ──────────────────────────────────────────────────────────

  fmt: function (n, currency) {
    return (n || 0).toLocaleString('fr-FR') + ' ' + (currency || 'FCFA');
  },

  logoHtml: function (biz, size, shape) {
    const sz = size || '60px';
    const br = shape === 'circle' ? '50%' : (shape === 'none' ? '0' : '6px');
    if (biz && biz.logoUrl) {
      return `<img src="${biz.logoUrl}" style="width:${sz};height:${sz};object-fit:contain;border-radius:${br};" alt="Logo">`;
    }
    const txt = (biz && biz.logoText) || (biz && biz.name ? biz.name.substring(0, 2).toUpperCase() : 'KM');
    const bg  = (biz && biz.logoBg)  || 'linear-gradient(135deg,#4F46E5,#7C3AED)';
    return `<div style="width:${sz};height:${sz};border-radius:${br};background:${bg};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:calc(${sz} * 0.36);flex-shrink:0;">${txt}</div>`;
  },

  rows: function (items, currency, accBg) {
    if (!items || items.length === 0)
      return `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:14px;font-size:11px;">Aucun article saisi</td></tr>`;
    return items.map((it, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'};">
        <td style="padding:8px 10px;font-size:11px;border-bottom:1px solid #f1f5f9;">${it.name}</td>
        <td style="padding:8px 10px;font-size:11px;text-align:center;border-bottom:1px solid #f1f5f9;">${it.quantity}</td>
        <td style="padding:8px 10px;font-size:11px;text-align:right;border-bottom:1px solid #f1f5f9;">${this.fmt(it.price, currency)}</td>
        <td style="padding:8px 10px;font-size:11px;text-align:right;font-weight:600;border-bottom:1px solid #f1f5f9;${accBg ? 'background:' + accBg + ';' : ''}">${this.fmt(it.total, currency)}</td>
      </tr>`).join('');
  },

  collectData: function (state) {
    const biz = (state && state.business) || {};
    const get = id => { const el = document.getElementById(id); return el ? el.value : ''; };

    const clientId = get('builder-doc-client-select');
    const client = (state && state.clients) ? (state.clients.find(c => c.id === clientId) || {}) : {};

    const items = []; let subtotal = 0;
    document.querySelectorAll('#builder-items-tbody tr').forEach(tr => {
      const name  = (tr.querySelector('.item-name')  || {}).value || '';
      const qty   = parseFloat((tr.querySelector('.item-qty')   || {}).value) || 1;
      const price = parseFloat((tr.querySelector('.item-price') || {}).value) || 0;
      if (name) { subtotal += qty * price; items.push({ name, quantity: qty, price, total: qty * price }); }
    });

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
      issueDate: get('builder-issue-date')   || '',
      dueDate:   get('builder-due-date')     || '',
      status:    get('builder-doc-status')   || 'sent',
      notes:     get('builder-notes')        || '',
      terms:     get('builder-terms')        || 'Paiement à réception.',
      client:    { name: client.name || 'Client', company: client.company || '', phone: client.phone || '', email: client.email || '', address: client.address || '', taxId: client.taxId || '' },
      items, subtotal, discount, taxRate, taxAmount, grandTotal, currency,
      primaryColor:   (document.getElementById('builder-color-primary')   || {}).value || biz.primaryColor   || '#4F46E5',
      secondaryColor: (document.getElementById('builder-color-secondary') || {}).value || biz.secondaryColor || '#6366F1',
    };
  },

  // ── Gallery Mini-Previews ─────────────────────────────────────────────
  miniPreview: function (id, c) {
    c = c || '#4F46E5';
    const map = {
      'classic':      `<div style="background:#fff;padding:6px;height:80px;"><div style="background:${c};height:12px;border-radius:2px;margin-bottom:4px;"></div><div style="background:#f1f5f9;height:5px;border-radius:2px;margin-bottom:3px;"></div><div style="background:#f1f5f9;height:5px;border-radius:2px;width:70%;margin-bottom:3px;"></div><div style="background:${c};height:8px;border-radius:2px;width:40%;margin-left:auto;margin-top:8px;"></div></div>`,
      'modern':       `<div style="background:#fff;padding:6px;height:80px;"><div style="display:flex;justify-content:space-between;margin-bottom:5px;"><div style="background:${c};height:14px;width:38%;border-radius:2px;"></div><div style="background:${c};height:14px;width:22%;border-radius:2px;opacity:0.35;"></div></div><div style="background:#f8fafc;height:4px;border-radius:2px;margin-bottom:2px;"></div><div style="background:#f8fafc;height:4px;border-radius:2px;width:75%;margin-bottom:6px;"></div><div style="background:${c};height:9px;border-radius:2px;width:32%;margin-left:auto;"></div></div>`,
      'minimal':      `<div style="background:#fff;padding:6px;height:80px;"><div style="border-bottom:2px solid ${c};padding-bottom:4px;margin-bottom:5px;display:flex;justify-content:space-between;"><div style="background:#0f172a;height:9px;width:28%;border-radius:2px;"></div><div style="background:${c};height:9px;width:18%;border-radius:2px;"></div></div><div style="background:#f8fafc;height:4px;border-radius:2px;margin-bottom:2px;"></div><div style="background:#f8fafc;height:4px;border-radius:2px;width:70%;"></div></div>`,
      'professional': `<div style="background:#fff;padding:6px;height:80px;"><div style="display:flex;justify-content:space-between;border-bottom:2px solid ${c};padding-bottom:4px;margin-bottom:5px;"><div style="background:#0f172a;height:11px;width:33%;border-radius:2px;"></div><div style="background:${c};height:11px;width:18%;border-radius:2px;"></div></div><div style="background:#f8fafc;height:4px;border-radius:2px;margin-bottom:2px;"></div><div style="background:#f8fafc;height:4px;border-radius:2px;width:78%;margin-bottom:6px;"></div><div style="background:${c};height:8px;border-radius:2px;width:28%;margin-left:auto;"></div></div>`,
      'creative':     `<div style="background:#fff;height:80px;overflow:hidden;border-radius:4px;"><div style="background:linear-gradient(135deg,${c},${c}88);height:24px;padding:6px;"><div style="background:rgba(255,255,255,0.5);height:8px;width:42%;border-radius:8px;"></div></div><div style="padding:5px 6px;"><div style="background:#f8fafc;height:4px;border-radius:2px;margin-bottom:2px;"></div><div style="background:#f8fafc;height:4px;border-radius:2px;width:70%;margin-bottom:4px;"></div><div style="background:${c};height:8px;border-radius:2px;width:26%;margin-left:auto;"></div></div></div>`,
      'elegant':      `<div style="background:#0f172a;height:80px;padding:6px;border-radius:4px;"><div style="border-bottom:1px solid ${c};padding-bottom:4px;margin-bottom:5px;display:flex;justify-content:space-between;"><div style="background:rgba(255,255,255,0.15);height:9px;width:28%;border-radius:2px;"></div><div style="background:${c};height:9px;width:18%;border-radius:2px;"></div></div><div style="background:rgba(255,255,255,0.07);height:4px;border-radius:2px;margin-bottom:2px;"></div><div style="background:rgba(255,255,255,0.07);height:4px;border-radius:2px;width:65%;margin-bottom:6px;"></div><div style="background:${c};height:8px;border-radius:2px;width:26%;margin-left:auto;"></div></div>`,
      'green-clean':  `<div style="background:#fff;height:80px;overflow:hidden;border-radius:4px;"><div style="display:flex;justify-content:space-between;padding:5px;"><div style="background:#e2e8f0;height:9px;width:18%;border-radius:2px;"></div><div style="background:#16a34a;height:9px;width:22%;border-radius:2px;"></div></div><div style="background:#16a34a;height:13px;margin:0 5px 4px;border-radius:2px;"></div><div style="background:#f0fdf4;height:4px;margin:0 5px 2px;border-radius:2px;"></div><div style="background:#f0fdf4;height:4px;margin:0 5px;width:calc(75% - 10px);border-radius:2px;"></div><div style="display:flex;justify-content:flex-end;padding:4px 5px 0;"><div style="background:#16a34a;height:9px;width:32%;border-radius:2px;"></div></div></div>`,
      'corp-blue':    `<div style="background:#fff;height:80px;overflow:hidden;border-radius:4px;"><div style="background:#1e3a5f;height:30px;padding:6px;"><div style="background:rgba(255,255,255,0.3);height:8px;width:38%;border-radius:2px;"></div><div style="background:rgba(255,255,255,0.15);height:5px;width:55%;border-radius:2px;margin-top:3px;"></div></div><div style="padding:4px 5px;"><div style="background:#f1f5f9;height:4px;border-radius:2px;margin-bottom:2px;"></div><div style="background:#f1f5f9;height:4px;border-radius:2px;width:68%;"></div><div style="background:#1e3a5f;height:7px;border-radius:2px;width:32%;margin-left:auto;margin-top:5px;"></div></div></div>`,
      'corp-light':   `<div style="background:#fff;padding:6px;height:80px;border-radius:4px;"><div style="display:flex;gap:4px;margin-bottom:4px;"><div style="background:${c};height:14px;width:14px;border-radius:50%;flex-shrink:0;"></div><div><div style="background:#0f172a;height:6px;width:28%;border-radius:2px;"></div><div style="background:#94a3b8;height:4px;width:18%;border-radius:2px;margin-top:2px;"></div></div></div><div style="background:#f8fafc;height:4px;border-radius:2px;margin-bottom:2px;"></div><div style="background:#f8fafc;height:4px;border-radius:2px;width:68%;margin-bottom:4px;"></div><div style="background:${c};height:8px;border-radius:2px;width:28%;margin-left:auto;"></div></div>`,
      'bold-blue':    `<div style="background:#fff;height:80px;overflow:hidden;border-radius:4px;"><div style="padding:4px 5px;display:flex;justify-content:space-between;"><div style="background:#2563eb;height:7px;width:22%;border-radius:2px;"></div><div style="background:#1e40af;height:9px;width:18%;border-radius:2px;"></div></div><div style="background:#2563eb;height:13px;margin:0 5px 4px;border-radius:2px;"></div><div style="background:#eff6ff;height:4px;margin:0 5px 2px;border-radius:2px;"></div><div style="background:#eff6ff;height:4px;margin:0 5px;width:calc(62% - 10px);border-radius:2px;"></div><div style="background:#2563eb;height:11px;margin-top:4px;border-radius:0;"></div></div>`,
      'wave-french':  `<div style="background:#fff;height:80px;overflow:hidden;border-radius:4px;"><div style="display:flex;padding:4px 5px;"><div style="background:#e2e8f0;height:14px;width:14px;border-radius:2px;margin-right:4px;"></div><div style="background:linear-gradient(135deg,#bae6fd,#7dd3fc);height:14px;flex:1;border-radius:0 3px 3px 0;"></div></div><div style="padding:0 5px;"><div style="background:#f1f5f9;height:4px;border-radius:2px;margin-bottom:2px;"></div><div style="background:#7dd3fc;height:12px;border-radius:2px;margin-bottom:2px;"></div><div style="background:#f0f9ff;height:4px;border-radius:2px;width:68%;"></div><div style="background:#f0f9ff;height:4px;border-radius:2px;margin-top:2px;"></div></div></div>`,
    };
    return `<div style="border-radius:6px;overflow:hidden;border:1px solid #e2e8f0;">${map[id] || map['classic']}</div>`;
  },

  // ══════════════════════════════════════════════════════════════
  // TEMPLATE 1: GREEN CLEAN (Image 1 — vert, tableau header coloré)
  // ══════════════════════════════════════════════════════════════
  renderGreenClean: function (d) {
    const ac = d.primaryColor || '#16a34a';
    const lbl = d.docType === 'quote' ? 'DEVIS' : 'FACTURE';
    return `<div style="background:#fff;font-family:Inter,Arial,sans-serif;padding:32px;min-height:1050px;position:relative;color:#1e293b;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;">
    <div>${this.logoHtml(d.biz,'70px','square')}</div>
    <div style="text-align:right;"><div style="font-size:28px;font-weight:900;color:${ac};letter-spacing:2px;">${lbl}</div><div style="color:#64748b;font-size:10px;margin-top:2px;">${d.biz.name||'KIVO MATIQUE'}</div></div>
  </div>
  <div style="border-top:2px solid #e2e8f0;border-bottom:2px solid #e2e8f0;padding:9px 0;margin-bottom:16px;display:flex;gap:20px;font-size:10px;color:#64748b;">
    <div><strong style="color:#1e293b;display:block;font-size:9px;text-transform:uppercase;letter-spacing:1px;">N° Document</strong>${d.docNum}</div>
    <div><strong style="color:#1e293b;display:block;font-size:9px;text-transform:uppercase;letter-spacing:1px;">Émission</strong>${d.issueDate||'--'}</div>
    <div><strong style="color:#1e293b;display:block;font-size:9px;text-transform:uppercase;letter-spacing:1px;">Échéance</strong>${d.dueDate||'--'}</div>
    <div style="margin-left:auto;text-align:right;"><strong style="color:#1e293b;display:block;font-size:9px;text-transform:uppercase;letter-spacing:1px;">Facturé à</strong><span style="font-weight:700;font-size:12px;">${d.client.name}</span></div>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;">
    <div><div style="font-size:9px;text-transform:uppercase;color:#64748b;letter-spacing:1px;margin-bottom:2px;">Total à payer</div><div style="font-size:26px;font-weight:900;color:${ac};">${this.fmt(d.grandTotal,d.currency)}</div></div>
    <div style="text-align:right;font-size:10px;color:#64748b;line-height:1.7;">${d.client.phone?`📞 ${d.client.phone}<br>`:''} ${d.client.email?`✉ ${d.client.email}<br>`:''} ${d.client.address||''}</div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:11px;">
    <thead><tr style="background:${ac};color:#fff;">
      <th style="padding:9px 10px;text-align:left;">Description</th>
      <th style="padding:9px 10px;text-align:center;width:12%;">Qté</th>
      <th style="padding:9px 10px;text-align:right;width:20%;">Prix U.</th>
      <th style="padding:9px 10px;text-align:right;width:20%;">Total</th>
    </tr></thead>
    <tbody>${this.rows(d.items,d.currency)}</tbody>
  </table>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:10px;">
    <div style="font-size:10px;color:#64748b;max-width:48%;"><strong style="display:block;margin-bottom:3px;color:#1e293b;">Conditions de règlement</strong>${d.terms||d.notes||'Paiement à réception.'}</div>
    <div style="min-width:210px;">
      <div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 0;"><span>Sous-total HT</span><span>${this.fmt(d.subtotal,d.currency)}</span></div>
      ${d.taxRate>0?`<div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 0;"><span>TVA (${d.taxRate}%)</span><span>${this.fmt(d.taxAmount,d.currency)}</span></div>`:''}
      ${d.discount>0?`<div style="display:flex;justify-content:space-between;font-size:10px;padding:3px 0;color:#ef4444;"><span>Réduction</span><span>-${this.fmt(d.discount,d.currency)}</span></div>`:''}
      <div style="background:${ac};color:#fff;display:flex;justify-content:space-between;font-size:11px;font-weight:700;padding:7px 10px;border-radius:4px;margin-top:4px;"><span>Total TTC</span><span>${this.fmt(d.grandTotal,d.currency)}</span></div>
    </div>
  </div>
  <div style="margin-top:22px;text-align:right;font-size:10px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:10px;"><div style="font-style:italic;font-size:14px;font-family:Georgia,serif;color:#1e293b;margin-bottom:2px;">${d.biz.owner||d.biz.name||''}</div><div>Signature autorisée</div></div>
  <div style="position:absolute;bottom:18px;left:32px;right:32px;border-top:1px solid #e2e8f0;padding-top:6px;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;">
    <div>${d.biz.address||''} ${d.biz.phone?'· '+d.biz.phone:''} ${d.biz.email?'· '+d.biz.email:''}</div>
    <div style="font-weight:700;color:${ac};">${d.biz.name||'KIVO MATIQUE'}</div>
  </div>
</div>`;
  },

  // ══════════════════════════════════════════════════════════════
  // TEMPLATE 2: CORPORATE BLUE (Image 2 — bandeau navy pleine largeur)
  // ══════════════════════════════════════════════════════════════
  renderCorpBlue: function (d) {
    const ac = d.primaryColor || '#1e3a5f';
    const lbl = d.docType === 'quote' ? 'DEVIS' : 'INVOICE';
    return `<div style="background:#fff;font-family:Inter,Arial,sans-serif;min-height:1050px;position:relative;color:#1e293b;">
  <div style="background:${ac};padding:22px 28px;display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">${this.logoHtml(d.biz,'38px','square')}<div><div style="color:#fff;font-weight:800;font-size:14px;">${d.biz.name||'KIVO MATIQUE'}</div><div style="color:rgba(255,255,255,0.5);font-size:9px;">${d.biz.address||''}</div></div></div>
      <div style="color:#fff;font-size:19px;font-weight:900;letter-spacing:1px;line-height:1.2;">${d.docType==='quote'?'PROPOSITION COMMERCIALE':'DIGITAL MARKETING &amp; BUSINESS'}</div>
    </div>
    <div style="text-align:right;">
      <div style="color:rgba(255,255,255,0.7);font-size:11px;font-weight:700;margin-bottom:6px;">${d.client.name}</div>
      <div style="color:rgba(255,255,255,0.5);font-size:9px;line-height:1.6;">${d.client.phone||''}<br>${d.client.email||''}</div>
      <div style="color:#fff;font-weight:900;font-size:22px;margin-top:8px;">${lbl}</div>
    </div>
  </div>
  <div style="padding:20px 28px;">
    <div style="display:flex;justify-content:space-between;font-size:10px;color:#64748b;margin-bottom:14px;"><div>PROJET : ${d.notes?d.notes.substring(0,60):(d.docType==='quote'?'PROPOSITION COMMERCIALE':'PRESTATION DE SERVICE')}</div><div style="font-weight:700;color:#1e293b;">N° ${d.docNum} · ${d.issueDate||'--'}</div></div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:10px;">
      <thead><tr style="background:${ac};color:#fff;">
        <th style="padding:8px 10px;text-align:left;width:6%;">N°</th>
        <th style="padding:8px 10px;text-align:left;">Description</th>
        <th style="padding:8px 10px;text-align:right;width:18%;">Prix</th>
        <th style="padding:8px 10px;text-align:center;width:12%;">Qté</th>
        <th style="padding:8px 10px;text-align:right;width:18%;">Total</th>
      </tr></thead>
      <tbody>${d.items.length===0?`<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:14px;">Aucun article</td></tr>`:d.items.map((it,i)=>`<tr style="background:${i%2===0?'#fff':'#f8fafc'};"><td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;">${i+1}.</td><td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;">${it.name}</td><td style="padding:7px 10px;text-align:right;border-bottom:1px solid #f1f5f9;">${this.fmt(it.price,d.currency)}</td><td style="padding:7px 10px;text-align:center;border-bottom:1px solid #f1f5f9;">${it.quantity}</td><td style="padding:7px 10px;text-align:right;font-weight:600;border-bottom:1px solid #f1f5f9;">${this.fmt(it.total,d.currency)}</td></tr>`).join('')}</tbody>
    </table>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:8px;">
      <div><div style="font-size:9px;text-transform:uppercase;color:#64748b;letter-spacing:1px;">Total à régler</div><div style="font-size:24px;font-weight:900;color:${ac};">${this.fmt(d.grandTotal,d.currency)}</div></div>
      <div style="min-width:190px;font-size:10px;">
        <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Sous-total :</span><span>${this.fmt(d.subtotal,d.currency)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>TVA (${d.taxRate}%) :</span><span>${this.fmt(d.taxAmount,d.currency)}</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:700;padding:5px 0;border-top:1px solid #e2e8f0;margin-top:3px;"><span>Total TTC :</span><span>${this.fmt(d.grandTotal,d.currency)}</span></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:20px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:9px;color:#64748b;">
      <div><strong style="color:#1e293b;display:block;margin-bottom:3px;font-size:10px;">Informations de paiement</strong>${d.terms||'Paiement à réception.'}</div>
      <div><strong style="color:#1e293b;display:block;margin-bottom:3px;font-size:10px;">Conditions</strong>${d.notes||'Merci pour votre confiance.'}</div>
      <div style="text-align:right;"><strong style="color:#1e293b;display:block;margin-bottom:3px;font-size:10px;">Responsable compte</strong><div style="font-style:italic;font-family:Georgia,serif;font-size:13px;color:#1e293b;">${d.biz.owner||d.biz.name||''}</div><div>${d.biz.email||''}</div></div>
    </div>
    ${d.biz.phone||d.biz.email?`<div style="margin-top:14px;background:${ac};padding:7px 14px;border-radius:4px;display:flex;gap:14px;font-size:9px;color:#fff;">${d.biz.phone?`<span>📞 ${d.biz.phone}</span>`:''} ${d.biz.email?`<span>✉ ${d.biz.email}</span>`:''} ${d.biz.address?`<span>📍 ${d.biz.address}</span>`:''}</div>`:''}
  </div>
</div>`;
  },

  // ══════════════════════════════════════════════════════════════
  // TEMPLATE 3: CORPORATE LIGHT (Image 3 — logo cercle, accent teal)
  // ══════════════════════════════════════════════════════════════
  renderCorpLight: function (d) {
    const ac = d.primaryColor || '#0e7490';
    const lbl = d.docType === 'quote' ? 'DEVIS' : 'INVOICE';
    return `<div style="background:#fff;font-family:Inter,Arial,sans-serif;padding:28px;min-height:1050px;position:relative;color:#1e293b;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;">
    <div style="display:flex;gap:10px;align-items:flex-start;">${this.logoHtml(d.biz,'46px','circle')}<div><div style="font-weight:800;font-size:14px;">${d.biz.name||'KIVO MATIQUE'}</div><div style="font-size:9px;color:#64748b;line-height:1.6;">${d.biz.address||''}<br>${d.biz.phone||''}<br>${d.biz.email||''}</div></div></div>
    <div style="text-align:right;"><div style="font-size:21px;font-weight:900;letter-spacing:2px;">${lbl}</div><div style="font-size:9px;color:#64748b;margin-top:3px;">DATE : ${d.issueDate||'--'}</div></div>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;">
    <div><div style="font-size:9px;text-transform:uppercase;color:#64748b;letter-spacing:1px;margin-bottom:3px;">Projet</div><div style="font-size:18px;font-weight:900;line-height:1.2;">${d.docType==='quote'?'PROPOSITION<br>COMMERCIALE':'PRESTATION<br>DE SERVICE'}</div></div>
    <div style="text-align:right;font-size:10px;"><div style="font-size:9px;text-transform:uppercase;color:#64748b;letter-spacing:1px;margin-bottom:3px;">Facturé à</div><div style="font-weight:700;font-size:13px;">${d.client.name}</div><div style="color:#64748b;line-height:1.6;">${d.client.address||''}<br>${d.client.phone||''}</div></div>
  </div>
  <div style="border-top:2px solid ${ac};border-bottom:1px solid #e2e8f0;padding:5px 0;margin-bottom:10px;display:flex;justify-content:space-between;font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:1px;"><span>Détail des prestations</span><span style="font-weight:700;color:#0f172a;">N° ${d.docNum}</span></div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:10px;">
    <thead><tr style="border-bottom:1px solid #e2e8f0;">
      <th style="padding:7px 0;text-align:left;color:#64748b;font-weight:600;width:6%;">N°</th>
      <th style="padding:7px 0;text-align:left;color:#64748b;font-weight:600;">Description</th>
      <th style="padding:7px 0;text-align:right;color:#64748b;font-weight:600;width:18%;">Prix</th>
      <th style="padding:7px 0;text-align:center;color:#64748b;font-weight:600;width:12%;">Qté</th>
      <th style="padding:7px 0;text-align:right;background:${ac};color:#fff;padding-left:8px;padding-right:8px;width:18%;">Total</th>
    </tr></thead>
    <tbody>${d.items.length===0?`<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:14px;">Aucun article</td></tr>`:d.items.map((it,i)=>`<tr><td style="padding:6px 0;border-bottom:1px solid #f1f5f9;">${i+1}.</td><td style="padding:6px 0;border-bottom:1px solid #f1f5f9;">${it.name}</td><td style="padding:6px 0;text-align:right;border-bottom:1px solid #f1f5f9;">${this.fmt(it.price,d.currency)}</td><td style="padding:6px 0;text-align:center;border-bottom:1px solid #f1f5f9;">${it.quantity}</td><td style="padding:6px 8px;text-align:right;font-weight:700;border-bottom:1px solid #f1f5f9;background:#f0fdfa;">${this.fmt(it.total,d.currency)}</td></tr>`).join('')}</tbody>
  </table>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;">
    <div><div style="font-size:9px;text-transform:uppercase;color:#64748b;">Total à régler</div><div style="font-size:22px;font-weight:900;font-style:italic;">${this.fmt(d.grandTotal,d.currency)}</div></div>
    <div style="min-width:195px;font-size:10px;">
      <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Sous-total :</span><span>${this.fmt(d.subtotal,d.currency)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:2px 0;"><span>TVA (${d.taxRate}%) :</span><span>${d.taxRate>0?this.fmt(d.taxAmount,d.currency):'0'}</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:700;padding:5px 0;border-top:2px solid ${ac};margin-top:3px;"><span>Total TTC :</span><span style="color:${ac};">${this.fmt(d.grandTotal,d.currency)}</span></div>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:9px;color:#64748b;">
    <div><strong style="color:#1e293b;display:block;margin-bottom:3px;font-size:10px;">Informations de paiement</strong>${d.terms||'Paiement à réception.'}</div>
    <div><strong style="color:#1e293b;display:block;margin-bottom:3px;font-size:10px;">Conditions</strong>${d.notes||'Merci pour votre confiance.'}</div>
    <div style="text-align:right;"><strong style="color:#1e293b;display:block;margin-bottom:3px;font-size:10px;">Responsable compte</strong><div style="font-style:italic;font-family:Georgia,serif;font-size:14px;color:#1e293b;">${d.biz.owner||d.biz.name||''}</div><div>${d.biz.owner||''}</div></div>
  </div>
  <div style="text-align:center;font-size:9px;color:#94a3b8;margin-top:18px;border-top:1px solid #f1f5f9;padding-top:7px;">${d.biz.address||''} ${d.biz.phone?'· '+d.biz.phone:''} ${d.biz.email?'· '+d.biz.email:''}</div>
</div>`;
  },

  // ══════════════════════════════════════════════════════════════
  // TEMPLATE 4: BOLD BLUE (Image 4 — table colorée, footer bleu)
  // ══════════════════════════════════════════════════════════════
  renderBoldBlue: function (d) {
    const ac = d.primaryColor || '#2563eb';
    const lbl = d.docType === 'quote' ? 'DEVIS' : 'INVOICE';
    return `<div style="background:#fff;font-family:Inter,Arial,sans-serif;padding:26px 26px 0;min-height:1050px;position:relative;color:#1e293b;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
    <div style="display:flex;gap:8px;align-items:center;">${this.logoHtml(d.biz,'42px','square')}</div>
    <div style="text-align:right;"><div style="font-size:24px;font-weight:900;color:${ac};">${lbl}</div><div style="font-size:9px;color:#64748b;line-height:1.8;">N° : ${d.docNum}<br>Échéance : ${d.dueDate||'--'}<br>Émission : ${d.issueDate||'--'}</div></div>
  </div>
  <div style="margin-bottom:14px;"><div style="font-size:10px;color:#64748b;">Facturé à :</div><div style="font-size:15px;font-weight:800;color:${ac};">${d.client.name}</div><div style="font-size:10px;color:#64748b;line-height:1.6;">${d.client.phone?`Tél : ${d.client.phone}<br>`:''} ${d.client.email?`Email : ${d.client.email}<br>`:''} ${d.client.address?`Adresse : ${d.client.address}`:''}</div></div>
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:10px;">
    <thead><tr style="background:${ac};color:#fff;">
      <th style="padding:8px 10px;text-align:left;width:6%;">N°</th>
      <th style="padding:8px 10px;text-align:left;">Description</th>
      <th style="padding:8px 10px;text-align:right;width:18%;">Prix U.</th>
      <th style="padding:8px 10px;text-align:center;width:12%;">Qté</th>
      <th style="padding:8px 10px;text-align:right;width:18%;">Total</th>
    </tr></thead>
    <tbody>${d.items.length===0?`<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:14px;">Aucun article</td></tr>`:d.items.map((it,i)=>`<tr style="border-bottom:1px solid #e2e8f0;background:${i%2===0?'#fff':'#eff6ff'};"><td style="padding:7px 10px;">${i+1}</td><td style="padding:7px 10px;">${it.name}</td><td style="padding:7px 10px;text-align:right;">${this.fmt(it.price,d.currency)}</td><td style="padding:7px 10px;text-align:center;">${it.quantity}</td><td style="padding:7px 10px;text-align:right;font-weight:600;">${this.fmt(it.total,d.currency)}</td></tr>`).join('')}</tbody>
  </table>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
    <div style="max-width:46%;">
      <div style="font-size:11px;font-weight:700;color:${ac};margin-bottom:3px;">Informations de paiement :</div>
      <div style="font-size:10px;color:#64748b;line-height:1.6;">${d.terms||'Paiement à réception.'}</div>
      <div style="font-size:11px;font-weight:700;color:${ac};margin-top:8px;margin-bottom:3px;">Conditions :</div>
      <div style="font-size:10px;color:#64748b;">${d.notes||'Merci pour votre confiance.'}</div>
    </div>
    <div style="min-width:200px;">
      <div style="font-size:10px;color:#64748b;margin-bottom:3px;">Sous-total : <span style="color:#0f172a;font-weight:600;">${this.fmt(d.subtotal,d.currency)}</span></div>
      ${d.discount>0?`<div style="font-size:10px;color:#ef4444;margin-bottom:3px;">Réduction : -${this.fmt(d.discount,d.currency)}</div>`:''}
      <div style="font-size:10px;color:#64748b;margin-bottom:8px;">TVA (${d.taxRate}%) : <span style="color:#0f172a;font-weight:600;">${this.fmt(d.taxAmount,d.currency)}</span></div>
      <div style="background:#0f172a;color:#fff;padding:8px 12px;border-radius:4px;font-size:11px;font-weight:700;">Total TTC : ${this.fmt(d.grandTotal,d.currency)}</div>
      <div style="font-size:9px;color:#64748b;text-align:right;margin-top:5px;"><span style="font-style:italic;font-family:Georgia,serif;font-size:12px;color:#1e293b;">${d.biz.owner||''}</span><br>Signature autorisée</div>
    </div>
  </div>
  <div style="background:${ac};padding:9px 14px;display:flex;flex-wrap:wrap;gap:12px;font-size:9px;color:#fff;margin:0 -26px;border-radius:0 0 6px 6px;">
    ${d.biz.phone?`<span>📞 ${d.biz.phone}</span>`:''}
    ${d.biz.email?`<span>✉ ${d.biz.email}</span>`:''}
    ${d.biz.address?`<span>📍 ${d.biz.address}</span>`:''}
    ${d.biz.taxId?`<span>N° Fiscal: ${d.biz.taxId}</span>`:''}
  </div>
</div>`;
  },

  // ══════════════════════════════════════════════════════════════
  // TEMPLATE 5: WAVE FRENCH (Image 5 — vague déco, format devis FR)
  // ══════════════════════════════════════════════════════════════
  renderWaveFrench: function (d) {
    const lbl = d.docType === 'quote' ? 'Devis' : 'Facture';
    return `<div style="background:#fff;font-family:Inter,Arial,sans-serif;padding:26px;min-height:1050px;position:relative;color:#1e293b;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
    <div style="border:2px solid #1e293b;padding:5px;">${this.logoHtml(d.biz,'46px','none')}</div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
      <svg width="150" height="36" viewBox="0 0 150 36" fill="none"><path d="M0 18 Q18 4 36 18 Q54 32 72 18 Q90 4 108 18 Q126 32 144 18" stroke="#7dd3fc" stroke-width="2.5" fill="none" opacity="0.8"/><path d="M0 26 Q18 12 36 26 Q54 40 72 26 Q90 12 108 26 Q126 40 144 26" stroke="#bae6fd" stroke-width="1.5" fill="none" opacity="0.5"/></svg>
      <div style="font-size:24px;font-weight:900;">${lbl}</div>
    </div>
  </div>
  <div style="font-size:11px;font-weight:700;margin-bottom:2px;">${d.biz.name||'KIVO MATIQUE'}</div>
  <div style="font-size:9px;color:#64748b;line-height:1.7;margin-bottom:10px;">${d.biz.address||''}<br>${d.biz.phone||''}<br>${d.biz.email||''}<br>${d.biz.taxId?`N° SIRET/NINEA : ${d.biz.taxId}`:''}</div>
  <div style="border-top:1px solid #1e293b;border-bottom:1px solid #e2e8f0;padding:8px 0;margin-bottom:12px;display:flex;justify-content:space-between;">
    <div style="font-size:9px;color:#64748b;"><strong style="color:#1e293b;text-transform:uppercase;font-size:8px;letter-spacing:1px;display:block;margin-bottom:3px;">Informations additionnelles</strong>N° ${d.docType==='quote'?'du devis':'de facture'} : ${d.docNum}<br>Date : ${d.issueDate||'--'}<br>${d.dueDate?`Validité / Échéance : ${d.dueDate}`:''}</div>
    <div style="text-align:right;font-size:9px;color:#64748b;"><strong style="color:#1e293b;display:block;margin-bottom:3px;">${d.client.name}</strong>${d.client.address||''}<br>${d.client.email||''}<br>${d.client.phone||''}</div>
  </div>
  ${d.notes?`<div style="font-size:10px;color:#1e293b;margin-bottom:10px;"><strong>Objet</strong> : ${d.notes}</div>`:''}
  <table style="width:100%;border-collapse:collapse;margin-bottom:10px;font-size:10px;">
    <thead><tr style="background:#93c5fd;color:#1e293b;">
      <th style="padding:7px 10px;text-align:left;font-weight:600;">Description</th>
      <th style="padding:7px 10px;text-align:center;font-weight:600;width:14%;">Quantité</th>
      <th style="padding:7px 10px;text-align:right;font-weight:600;width:18%;">Prix HT</th>
      <th style="padding:7px 10px;text-align:right;font-weight:600;width:18%;">Total HT</th>
    </tr></thead>
    <tbody>${d.items.length===0?`<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:14px;">Aucun article</td></tr>`:d.items.map(it=>`<tr style="border:1px solid #e2e8f0;"><td style="padding:7px 10px;">${it.name}</td><td style="padding:7px 10px;text-align:center;">${it.quantity}</td><td style="padding:7px 10px;text-align:right;">${this.fmt(it.price,d.currency)}</td><td style="padding:7px 10px;text-align:right;font-weight:600;">${this.fmt(it.total,d.currency)}</td></tr>`).join('')}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end;margin-bottom:14px;">
    <table style="border-collapse:collapse;font-size:10px;min-width:230px;">
      <tr style="border-top:1px solid #e2e8f0;"><td style="padding:4px 10px;color:#64748b;">Total Hors Taxe</td><td style="padding:4px 10px;text-align:right;font-weight:600;">${this.fmt(d.subtotal,d.currency)}</td></tr>
      <tr><td style="padding:4px 10px;color:#64748b;">TVA (${d.taxRate}%)</td><td style="padding:4px 10px;text-align:right;">${this.fmt(d.taxAmount,d.currency)}</td></tr>
      ${d.discount>0?`<tr><td style="padding:4px 10px;color:#ef4444;">Réduction</td><td style="padding:4px 10px;text-align:right;color:#ef4444;">-${this.fmt(d.discount,d.currency)}</td></tr>`:''}
      <tr style="background:#dbeafe;font-weight:700;"><td style="padding:6px 10px;border-top:2px solid #93c5fd;">Total TTC</td><td style="padding:6px 10px;text-align:right;border-top:2px solid #93c5fd;">${this.fmt(d.grandTotal,d.currency)}</td></tr>
    </table>
  </div>
  <div style="font-size:9px;color:#1e293b;line-height:1.7;margin-bottom:18px;">${d.terms||'Je reste à votre disposition pour toute information complémentaire. Cordialement.'}<br>${d.docType==='quote'?'Si ce devis vous convient, veuillez le retourner signé précédé de la mention : « BON POUR ACCORD ET EXÉCUTION »':''}<div style="margin-top:10px;display:flex;justify-content:space-between;"><div>Date : ___________</div><div>Signature : ___________</div></div></div>
  <div style="position:absolute;bottom:14px;left:26px;right:26px;border-top:1px solid #e2e8f0;padding-top:6px;font-size:8px;color:#94a3b8;text-align:center;">${d.biz.taxId?`N° SIRET/NINEA : ${d.biz.taxId}`:''} ${d.biz.name?'· '+d.biz.name:''}</div>
</div>`;
  },

  // ── Main render dispatcher ────────────────────────────────────────────
  render: function (templateId, data) {
    switch (templateId) {
      case 'green-clean':  return this.renderGreenClean(data);
      case 'corp-blue':    return this.renderCorpBlue(data);
      case 'corp-light':   return this.renderCorpLight(data);
      case 'bold-blue':    return this.renderBoldBlue(data);
      case 'wave-french':  return this.renderWaveFrench(data);
      default:             return null; // handled by existing CSS-based system
    }
  }
};

console.log('[KivoTemplates] ✅', window.KivoTemplates.builtIn.length, 'templates disponibles.');
