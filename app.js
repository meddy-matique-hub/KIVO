/**
 * KIVO SaaS - Main Application Controller & Router
 * Modern Vanilla JS Single Page Application (SPA) Engine
 */

window.KivoApp = {
  state: null,
  activeView: 'dashboard',
  selectedReminderTone: 'courtois',
  activeReminderDocId: null,

  /**
   * BLANK initial state for a brand-new user who just signed up
   * No demo data here — user must fill everything in onboarding
   */
  BLANK_STATE: {
    isOnboarded: false,
    userEmail: null,
    userPassword: null, // hashed in real app, plain for MVP
    business: {
      name: "",
      owner: "",
      email: "",
      phone: "",
      industry: "",
      country: "",
      currency: "FCFA",
      currencySymbol: "FCFA",
      address: "",
      taxId: "",
      logoText: "KV",
      logoBg: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
      bankDetails: { bankName: "", accountName: "", iban: "", mobileMoney: { wave: "", orangeMoney: "", mtn: "" } },
      documentPrefix: "KVO-",
      templateStyle: "modern",
      subscriptionTier: "Gratuit",
      subscriptionStatus: "active"
    },
    clients: [],
    documents: [],
    catalog: []
  },

  /**
   * Initializes application state and event listeners
   */
  init: function () {
    console.log("[KivoApp] Initializing KIVO application...");
    this.loadState();
    this.setupRouting();
    this.setupEventListeners();
    this.handleRoute();
  },

  /**
   * Loads state from localStorage.
   * If no session exists, starts with a completely BLANK state — user must register.
   */
  loadState: function () {
    const saved = localStorage.getItem('kivo_app_state');
    if (saved) {
      try {
        this.state = JSON.parse(saved);
        // Migrate old demo states that weren't created by real onboarding
        if (this.state.isOnboarded === undefined) {
          this.state.isOnboarded = false;
        }
      } catch (e) {
        console.error("[KivoApp] State parse error, resetting.", e);
        this.state = JSON.parse(JSON.stringify(this.BLANK_STATE));
        this.saveState();
      }
    } else {
      // Brand new visitor — start completely blank
      this.state = JSON.parse(JSON.stringify(this.BLANK_STATE));
      this.saveState();
    }
  },

  /**
   * Persists state back to localStorage
   */
  saveState: function () {
    localStorage.setItem('kivo_app_state', JSON.stringify(this.state));
  },

  /**
   * Loads the demo data so the user can explore KIVO with realistic data
   */
  loadDemoData: function () {
    const demo = JSON.parse(JSON.stringify(window.KIVO_DEMO_DATA));
    demo.isOnboarded = true;
    this.state = demo;
    this.saveState();
    this.updateUserBrandingUI();
    this.showToast("🎭 Mode démo activé ! Compte MD Creative Studio chargé.", "success");
    this.navigate('dashboard');
  },

  /**
   * Logs out and clears the session
   */
  logout: function () {
    if (confirm("Voulez-vous vraiment vous déconnecter ?")) {
      localStorage.removeItem('kivo_app_state');
      this.state = JSON.parse(JSON.stringify(this.BLANK_STATE));
      this.saveState();
      this.navigate('landing');
      this.showToast("Vous avez été déconnecté.", "info");
    }
  },

  /**
   * Resets data to initial blank state
   */
  resetDemoData: function () {
    if (confirm("Voulez-vous vraiment réinitialiser les données avec le compte de démonstration ?")) {
      this.loadDemoData();
    }
  },

  /**
   * Sets up hash change routing
   */
  setupRouting: function () {
    window.addEventListener('hashchange', () => {
      this.handleRoute();
    });
  },

  /**
   * Handles hash routes and view switching
   * Includes authentication guard — unauthenticated users go to landing
   */
  handleRoute: function () {
    const hash = window.location.hash || '';
    let viewName = hash.split('?')[0].replace('#', '');
    if (!viewName) viewName = '';

    // Public-access views (no auth required)
    const publicViews = ['landing', 'auth', 'onboarding', 'public-doc'];
    const appViews = ['dashboard', 'documents', 'document-builder', 'clients', 'catalog', 'reminders', 'analytics', 'settings'];
    const validViews = [...publicViews, ...appViews];

    if (!validViews.includes(viewName)) {
      viewName = '';
    }

    // ─── AUTH GUARD ───────────────────────────────────────────────────────────
    // If no view or app view requested, check if user is onboarded
    const isOnboarded = this.state && this.state.isOnboarded === true;

    if (!viewName) {
      // No hash → send new users to landing, returning users to dashboard
      viewName = isOnboarded ? 'dashboard' : 'landing';
    } else if (!isOnboarded && appViews.includes(viewName)) {
      // Trying to access app without having registered → redirect to landing
      this.showToast("Veuillez créer votre compte pour accéder à KIVO.", "info");
      viewName = 'landing';
    }
    // ─────────────────────────────────────────────────────────────────────────

    this.activeView = viewName;

    // Update visibility of view sections
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.style.display = 'none';
    });

    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) {
      targetSection.style.display = 'block';
    }

    // Hide sidebar & bottom nav for public / full-width views
    const isFullWidthView = publicViews.includes(viewName);
    const sidebar = document.getElementById('sidebar');
    const mobileBottomNav = document.querySelector('.mobile-bottom-nav');
    const mobileHeader = document.querySelector('.mobile-header');

    if (sidebar) sidebar.style.display = isFullWidthView ? 'none' : 'flex';
    if (mobileBottomNav) mobileBottomNav.style.display = isFullWidthView ? 'none' : 'flex';
    if (mobileHeader) mobileHeader.style.display = isFullWidthView ? 'none' : 'flex';

    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      if (isFullWidthView) {
        mainContent.style.marginLeft = '0';
        mainContent.style.maxWidth = '100vw';
        mainContent.style.padding = '0';
      } else {
        mainContent.style.marginLeft = '';
        mainContent.style.maxWidth = '';
        mainContent.style.padding = '';
      }
    }

    // Update Nav Highlights
    document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      }
    });

    // Render View Content
    this.renderCurrentView();

    // Scroll to top
    window.scrollTo(0, 0);
  },

  /**
   * Navigates programmatically to a view
   */
  navigate: function (viewName, params = '') {
    window.location.hash = `#${viewName}${params ? '?' + params : ''}`;
  },

  /**
   * Set up global interactive event listeners
   */
  setupEventListeners: function () {
    // Mobile menu toggle
    const toggleBtn = document.getElementById('mobile-menu-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('mobile-open');
      });
    }

    // Document Filter Buttons
    const filterPills = document.querySelectorAll('#doc-filter-pills button');
    filterPills.forEach(btn => {
      btn.addEventListener('click', (e) => {
        filterPills.forEach(b => b.classList.remove('active-pill'));
        e.target.classList.add('active-pill');
        const filter = e.target.getAttribute('data-filter');
        this.renderDocumentsTable(filter);
      });
    });

    // Document Search Input
    const searchInput = document.getElementById('doc-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.renderDocumentsTable('all', e.target.value);
      });
    }
  },

  /**
   * Main Render Dispatcher based on activeView
   */
  renderCurrentView: function () {
    this.updateUserBrandingUI();

    switch (this.activeView) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'documents':
        this.renderDocumentsTable('all');
        break;
      case 'clients':
        this.renderClients();
        break;
      case 'catalog':
        this.renderCatalog();
        break;
      case 'reminders':
        this.renderReminders();
        break;
      case 'public-doc':
        this.renderPublicDocView();
        break;
      case 'settings':
        this.renderSettings();
        break;
      default:
        break;
    }
  },

  /**
   * Updates sidebar branding labels
   */
  updateUserBrandingUI: function () {
    const biz = this.state.business;
    const nameEl = document.getElementById('sidebar-user-name');
    const bizEl = document.getElementById('sidebar-business-name');
    const avatarEl = document.getElementById('sidebar-avatar');
    
    if (nameEl) nameEl.textContent = biz.owner;
    if (bizEl) bizEl.textContent = biz.name;
    if (avatarEl) avatarEl.textContent = biz.logoText || "KD";
  },

  /**
   * Renders Dashboard KPIs, SVG Revenue Chart, Recent Activity, and Recent Docs Table
   */
  renderDashboard: function () {
    const docs = this.state.documents;
    const biz = this.state.business;

    // 1. Calculate KPIs
    let paidTotal = 0;
    let pendingTotal = 0;
    let overdueTotal = 0;
    let pendingQuotesCount = 0;

    docs.forEach(doc => {
      const docTotal = doc.total || 0;
      if (doc.type === 'invoice') {
        if (doc.status === 'paid') {
          paidTotal += docTotal;
        } else if (doc.status === 'overdue') {
          overdueTotal += docTotal;
        } else if (doc.status === 'sent' || doc.status === 'viewed') {
          pendingTotal += docTotal;
        }
      } else if (doc.type === 'quote') {
        if (doc.status === 'sent' || doc.status === 'viewed' || doc.status === 'draft') {
          pendingQuotesCount++;
        }
      }
    });

    const formatCurrency = (val) => val.toLocaleString('fr-FR') + ' ' + biz.currency;

    document.getElementById('dash-greeting').textContent = `Bonjour, ${biz.owner.split(' ')[0]} 👋`;
    document.getElementById('kpi-paid').textContent = formatCurrency(paidTotal);
    document.getElementById('kpi-pending').textContent = formatCurrency(pendingTotal);
    document.getElementById('kpi-overdue').textContent = formatCurrency(overdueTotal);
    document.getElementById('kpi-quotes-count').textContent = pendingQuotesCount;

    // 2. Render SVG Revenue Chart
    this.renderRevenueChart();

    // 3. Render Activity Feed
    const activityFeed = document.getElementById('activity-feed-list');
    if (activityFeed) {
      activityFeed.innerHTML = (this.state.activities || []).slice(0, 4).map(act => `
        <div style="display: flex; gap: 0.75rem; align-items: flex-start; font-size: 0.85rem;">
          <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 0.75rem;">
            ⚡
          </div>
          <div>
            <strong style="display: block; color: var(--text-primary);">${act.title}</strong>
            <span style="color: var(--text-secondary); font-size: 0.75rem;">${act.details} • ${act.timestamp}</span>
          </div>
        </div>
      `).join('');
    }

    // 4. Render Recent Documents Table in Dashboard
    const tbody = document.getElementById('dashboard-recent-docs-tbody');
    if (tbody) {
      const recentDocs = docs.slice(0, 5);
      tbody.innerHTML = recentDocs.map(doc => this.createDocTableRowHtml(doc)).join('');
    }
  },

  /**
   * Draws dynamic responsive SVG Area Chart for Revenue Trend
   */
  renderRevenueChart: function () {
    const container = document.getElementById('revenue-chart-container');
    if (!container) return;

    const dataPoints = [120000, 250000, 180000, 320000, 450000, 680000, 850000, 1200000, 1450000];
    const max = Math.max(...dataPoints);
    const width = 500;
    const height = 180;

    const points = dataPoints.map((val, idx) => {
      const x = (idx / (dataPoints.length - 1)) * width;
      const y = height - (val / max) * (height - 30);
      return `${x},${y}`;
    }).join(' ');

    const areaPoints = `0,${height} ${points} ${width},${height}`;

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: 100%; overflow: visible;">
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#4F46E5" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#4F46E5" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <polygon points="${areaPoints}" fill="url(#chartGradient)"/>
        <polyline points="${points}" fill="none" stroke="#4F46E5" stroke-width="3" stroke-linecap="round"/>
        ${dataPoints.map((val, idx) => {
          const x = (idx / (dataPoints.length - 1)) * width;
          const y = height - (val / max) * (height - 30);
          return `<circle cx="${x}" cy="${y}" r="4" fill="#FFFFFF" stroke="#4F46E5" stroke-width="2"/>`;
        }).join('')}
      </svg>
    `;
  },

  /**
   * Helper to create table row HTML for documents
   */
  createDocTableRowHtml: function (doc) {
    const biz = this.state.business;
    const badgeClass = {
      paid: 'badge-paid',
      accepted: 'badge-accepted',
      overdue: 'badge-overdue',
      sent: 'badge-sent',
      viewed: 'badge-viewed',
      draft: 'badge-draft',
      cancelled: 'badge-cancelled'
    }[doc.status] || 'badge-draft';

    const statusLabel = {
      paid: 'Payée ✓',
      accepted: 'Accepté ✓',
      overdue: 'En retard ⚠️',
      sent: 'Envoyée',
      viewed: 'Vue 👁️',
      draft: 'Brouillon',
      cancelled: 'Annulée'
    }[doc.status] || doc.status;

    const docTypeLabel = doc.type === 'quote' ? 'Devis' : 'Facture';

    return `
      <tr>
        <td><strong>${doc.number}</strong></td>
        <td>${doc.clientName || 'Client anonyme'}</td>
        <td><span class="badge ${doc.type === 'quote' ? 'badge-sent' : 'badge-draft'}">${docTypeLabel}</span></td>
        <td>${doc.issueDate}</td>
        <td><strong>${(doc.total || 0).toLocaleString('fr-FR')} ${biz.currency}</strong></td>
        <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-sm" onclick="KivoApp.viewPublicDoc('${doc.id}')">
            🔗 Aperçu
          </button>
          <button class="btn btn-whatsapp btn-sm" onclick="KivoApp.shareOnWhatsApp('${doc.id}')">
            💬 WhatsApp
          </button>
        </td>
      </tr>
    `;
  },

  /**
   * Renders Master Documents Table with filtering and search
   */
  renderDocumentsTable: function (filter = 'all', searchQuery = '') {
    const tbody = document.getElementById('documents-list-tbody');
    if (!tbody) return;

    let docs = this.state.documents;

    if (filter !== 'all') {
      if (filter === 'invoice' || filter === 'quote') {
        docs = docs.filter(d => d.type === filter);
      } else {
        docs = docs.filter(d => d.status === filter);
      }
    }

    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      docs = docs.filter(d => 
        (d.number || '').toLowerCase().includes(q) ||
        (d.clientName || '').toLowerCase().includes(q)
      );
    }

    if (docs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">Aucun document trouvé.</td></tr>`;
      return;
    }

    const biz = this.state.business;

    tbody.innerHTML = docs.map(doc => {
      const badgeClass = {
        paid: 'badge-paid',
        accepted: 'badge-accepted',
        overdue: 'badge-overdue',
        sent: 'badge-sent',
        viewed: 'badge-viewed',
        draft: 'badge-draft'
      }[doc.status] || 'badge-draft';

      const statusLabel = {
        paid: 'Payée ✓',
        accepted: 'Accepté ✓',
        overdue: 'En retard ⚠️',
        sent: 'Envoyée',
        viewed: 'Vue 👁️',
        draft: 'Brouillon'
      }[doc.status] || doc.status;

      return `
        <tr>
          <td><strong>${doc.number}</strong></td>
          <td>${doc.clientName}</td>
          <td><span class="badge badge-draft">${doc.type === 'quote' ? 'Devis' : 'Facture'}</span></td>
          <td>${doc.issueDate}</td>
          <td>${doc.dueDate}</td>
          <td><strong>${(doc.total || 0).toLocaleString('fr-FR')} ${biz.currency}</strong></td>
          <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-sm" onclick="KivoApp.viewPublicDoc('${doc.id}')">Voir</button>
            <button class="btn btn-whatsapp btn-sm" onclick="KivoApp.shareOnWhatsApp('${doc.id}')">💬</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  /**
   * Opens New Document Type Choice Modal
   */
  openNewDocModal: function () {
    this.openModal('modal-new-doc-choice');
  },

  /**
   * Starts Document Creation Flow
   */
  startNewDocument: function (type = 'invoice') {
    this.closeModal('modal-new-doc-choice');
    
    // Set builder form defaults
    const nextNum = 'KVO-' + (1024 + this.state.documents.length + 1);
    const today = new Date().toISOString().split('T')[0];
    const dueObj = new Date();
    dueObj.setDate(dueObj.getDate() + 7);
    const dueStr = dueObj.toISOString().split('T')[0];

    document.getElementById('builder-doc-id').value = '';
    document.getElementById('builder-doc-type').value = type;
    document.getElementById('builder-doc-number').value = nextNum;
    document.getElementById('builder-issue-date').value = today;
    document.getElementById('builder-due-date').value = dueStr;
    document.getElementById('builder-notes').value = "Merci pour votre confiance. Envoi sous 5 jours.";
    document.getElementById('builder-terms').value = "Paiement à réception par Wave, Mobile Money ou Virement.";

    // Populate Clients Selector
    const clientSelect = document.getElementById('builder-doc-client-select');
    clientSelect.innerHTML = this.state.clients.map(c => `
      <option value="${c.id}">${c.name} (${c.company || c.contactName})</option>
    `).join('');

    // Set initial 1 empty row
    const tbody = document.getElementById('builder-items-tbody');
    tbody.innerHTML = '';
    this.addBuilderLineItem('Identité visuelle / Prestation créative', 1, 150000);

    this.recalculateBuilderTotals();
    this.navigate('document-builder');
  },

  /**
   * Adds a row item to the builder
   */
  addBuilderLineItem: function (name = '', qty = 1, price = 0) {
    const tbody = document.getElementById('builder-items-tbody');
    if (!tbody) return;

    const rowId = 'row_' + Math.random().toString(36).substring(2, 7);
    const tr = document.createElement('tr');
    tr.id = rowId;

    tr.innerHTML = `
      <td>
        <input type="text" class="form-input item-name" value="${name}" placeholder="Nom de l'article ou service">
      </td>
      <td>
        <input type="number" class="form-input item-qty" value="${qty}" min="1" oninput="KivoApp.recalculateBuilderTotals()">
      </td>
      <td>
        <input type="number" class="form-input item-price" value="${price}" min="0" oninput="KivoApp.recalculateBuilderTotals()">
      </td>
      <td>
        <strong class="item-total-display">${(qty * price).toLocaleString('fr-FR')} FCFA</strong>
      </td>
      <td style="text-align: center;">
        <button class="btn btn-danger btn-sm" onclick="this.closest('tr').remove(); KivoApp.recalculateBuilderTotals();">✕</button>
      </td>
    `;

    tbody.appendChild(tr);
    this.recalculateBuilderTotals();
  },

  /**
   * Recalculates Subtotal, Tax, Discount and Grand Total in builder
   */
  recalculateBuilderTotals: function () {
    let subtotal = 0;
    document.querySelectorAll('#builder-items-tbody tr').forEach(tr => {
      const qty = parseFloat(tr.querySelector('.item-qty').value) || 0;
      const price = parseFloat(tr.querySelector('.item-price').value) || 0;
      const rowTotal = qty * price;
      tr.querySelector('.item-total-display').textContent = rowTotal.toLocaleString('fr-FR') + ' FCFA';
      subtotal += rowTotal;
    });

    const discount = parseFloat(document.getElementById('builder-input-discount').value) || 0;
    const taxRate = parseFloat(document.getElementById('builder-input-tax').value) || 0;

    const taxAmount = (subtotal - discount) * (taxRate / 100);
    const grandTotal = Math.max(0, subtotal - discount + taxAmount);

    const biz = this.state.business;
    document.getElementById('builder-calc-subtotal').textContent = subtotal.toLocaleString('fr-FR') + ' ' + biz.currency;
    document.getElementById('builder-calc-total').textContent = grandTotal.toLocaleString('fr-FR') + ' ' + biz.currency;
  },

  /**
   * Triggers KIVO AI Parser inside document builder
   */
  triggerBuilderAiParse: function () {
    const input = document.getElementById('builder-ai-input').value;
    if (!input || input.trim().length === 0) {
      this.showToast("Veuillez saisir une description de votre besoin.", "error");
      return;
    }

    const parsed = window.KivoAI.parseTextToDocument(input, this.state.clients, this.state.business.currency);
    if (parsed) {
      // Clear line items
      const tbody = document.getElementById('builder-items-tbody');
      tbody.innerHTML = '';

      parsed.items.forEach(it => {
        this.addBuilderLineItem(it.name, it.quantity, it.price);
      });

      if (parsed.clientId) {
        document.getElementById('builder-doc-client-select').value = parsed.clientId;
      }

      if (parsed.suggestedDueDate) {
        document.getElementById('builder-due-date').value = parsed.suggestedDueDate;
      }

      this.recalculateBuilderTotals();
      this.showToast("✨ IA : Document généré automatiquement avec succès !", "success");
    }
  },

  /**
   * Saves Document from Builder into State
   */
  saveDocumentFromBuilder: function () {
    const type = document.getElementById('builder-doc-type').value;
    const num = document.getElementById('builder-doc-number').value;
    const clientId = document.getElementById('builder-doc-client-select').value;
    const clientObj = this.state.clients.find(c => c.id === clientId) || this.state.clients[0];
    const issueDate = document.getElementById('builder-issue-date').value;
    const dueDate = document.getElementById('builder-due-date').value;
    const notes = document.getElementById('builder-notes').value;
    const terms = document.getElementById('builder-terms').value;

    const items = [];
    let subtotal = 0;
    document.querySelectorAll('#builder-items-tbody tr').forEach(tr => {
      const name = tr.querySelector('.item-name').value;
      const qty = parseFloat(tr.querySelector('.item-qty').value) || 1;
      const price = parseFloat(tr.querySelector('.item-price').value) || 0;
      const total = qty * price;
      if (name) {
        items.push({ name, quantity: qty, price, total });
        subtotal += total;
      }
    });

    const discount = parseFloat(document.getElementById('builder-input-discount').value) || 0;
    const taxRate = parseFloat(document.getElementById('builder-input-tax').value) || 0;
    const taxAmount = (subtotal - discount) * (taxRate / 100);
    const grandTotal = Math.max(0, subtotal - discount + taxAmount);

    const docId = 'doc_' + Math.random().toString(36).substring(2, 8);

    const newDoc = {
      id: docId,
      number: num,
      type: type,
      status: 'sent',
      clientId: clientObj.id,
      clientName: clientObj.name,
      clientEmail: clientObj.email,
      clientPhone: clientObj.phone,
      issueDate: issueDate,
      dueDate: dueDate,
      items: items,
      subtotal: subtotal,
      discount: discount,
      tax: taxAmount,
      total: grandTotal,
      amountPaid: 0,
      notes: notes,
      terms: terms,
      publicToken: 'tok_' + Math.random().toString(36).substring(2, 8),
      viewsCount: 0,
      lastViewedAt: null
    };

    this.state.documents.unshift(newDoc);

    // Add activity log
    this.state.activities.unshift({
      id: 'act_' + Date.now(),
      timestamp: "À l'instant",
      type: type === 'quote' ? 'quote_created' : 'invoice_sent',
      icon: 'file-text',
      title: `${type === 'quote' ? 'Devis' : 'Facture'} #${num} créé(e)`,
      details: `Destinataire : ${clientObj.name} (${grandTotal.toLocaleString('fr-FR')} ${this.state.business.currency})`
    });

    this.saveState();
    this.showToast(`Document ${num} enregistré avec succès !`, "success");
    this.viewPublicDoc(docId);
  },

  /**
   * Navigates to Public Document View
   */
  viewPublicDoc: function (docId) {
    this.navigate('public-doc', `id=${docId}`);
  },

  /**
   * Renders Public Client View (`/invoice/xxxxx` or `/quote/xxxxx`)
   */
  renderPublicDocView: function () {
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const docId = urlParams.get('id') || this.state.documents[0].id;
    const doc = this.state.documents.find(d => d.id === docId) || this.state.documents[0];
    const biz = this.state.business;

    // Track view
    doc.viewsCount = (doc.viewsCount || 0) + 1;
    doc.lastViewedAt = new Date().toLocaleString('fr-FR');
    if (doc.status === 'sent') doc.status = 'viewed';
    this.saveState();

    document.getElementById('pub-business-logo').textContent = biz.logoText || "KD";
    document.getElementById('pub-business-name').textContent = biz.name;
    document.getElementById('pub-business-address').textContent = biz.address;

    document.getElementById('pub-doc-title').textContent = doc.type === 'quote' ? 'DEVIS' : 'FACTURE';
    document.getElementById('pub-doc-number').textContent = doc.number;

    const badgeClass = {
      paid: 'badge-paid',
      accepted: 'badge-accepted',
      overdue: 'badge-overdue',
      sent: 'badge-sent',
      viewed: 'badge-viewed'
    }[doc.status] || 'badge-draft';

    const statusLabel = {
      paid: '✓ Payée',
      accepted: '✓ Devis Accepté',
      overdue: '⚠️ En retard',
      sent: 'Envoyée',
      viewed: 'Vue par le client'
    }[doc.status] || doc.status;

    const badgeEl = document.getElementById('pub-doc-status-badge');
    badgeEl.className = `badge ${badgeClass}`;
    badgeEl.textContent = statusLabel;

    document.getElementById('pub-client-name').textContent = doc.clientName;
    document.getElementById('pub-client-contact').textContent = doc.clientEmail;
    document.getElementById('pub-client-phone').textContent = doc.clientPhone;
    document.getElementById('pub-issue-date').textContent = doc.issueDate;
    document.getElementById('pub-due-date').textContent = doc.dueDate;

    // Render items table
    const tbody = document.getElementById('pub-items-tbody');
    tbody.innerHTML = (doc.items || []).map(it => `
      <tr>
        <td><strong>${it.name}</strong><br><span style="font-size: 0.8rem; color: var(--text-secondary);">${it.description || ''}</span></td>
        <td style="text-align: center;">${it.quantity}</td>
        <td style="text-align: right;">${(it.price || 0).toLocaleString('fr-FR')} ${biz.currency}</td>
        <td style="text-align: right;"><strong>${(it.total || 0).toLocaleString('fr-FR')} ${biz.currency}</strong></td>
      </tr>
    `).join('');

    document.getElementById('pub-subtotal').textContent = (doc.subtotal || doc.total).toLocaleString('fr-FR') + ' ' + biz.currency;
    document.getElementById('pub-discount').textContent = '-' + (doc.discount || 0).toLocaleString('fr-FR') + ' ' + biz.currency;
    document.getElementById('pub-total').textContent = (doc.total || 0).toLocaleString('fr-FR') + ' ' + biz.currency;
    document.getElementById('pub-bar-total').textContent = (doc.total || 0).toLocaleString('fr-FR') + ' ' + biz.currency;

    document.getElementById('pub-terms').textContent = doc.terms || "Paiement à réception.";
    document.getElementById('pub-notes').textContent = doc.notes || "Merci pour votre confiance.";

    // Render Sticky Action Bar Buttons
    const btnContainer = document.getElementById('pub-bar-buttons-container');
    
    if (doc.type === 'quote' && (doc.status === 'sent' || doc.status === 'viewed')) {
      btnContainer.innerHTML = `
        <button class="btn btn-success" onclick="KivoApp.clientAcceptQuote('${doc.id}')">
          ✓ Accepter le devis
        </button>
        <button class="btn btn-secondary" onclick="window.print()">Télécharger PDF</button>
      `;
    } else if (doc.type === 'invoice' && doc.status !== 'paid') {
      btnContainer.innerHTML = `
        <button class="btn btn-primary" onclick="KivoApp.openPaymentModal('${doc.id}')">
          🔒 Payer en ligne (${(doc.total).toLocaleString('fr-FR')} ${biz.currency})
        </button>
        <button class="btn btn-secondary" onclick="window.print()">Télécharger PDF</button>
        <button class="btn btn-whatsapp" onclick="KivoApp.shareOnWhatsApp('${doc.id}')">💬 WhatsApp</button>
      `;
    } else {
      btnContainer.innerHTML = `
        <button class="btn btn-secondary" onclick="window.print()">Télécharger / Imprimer PDF</button>
        <button class="btn btn-whatsapp" onclick="KivoApp.shareOnWhatsApp('${doc.id}')">💬 WhatsApp</button>
      `;
    }
  },

  /**
   * Client accepts quote online
   */
  clientAcceptQuote: function (docId) {
    const doc = this.state.documents.find(d => d.id === docId);
    if (doc) {
      doc.status = 'accepted';
      this.state.activities.unshift({
        id: 'act_' + Date.now(),
        timestamp: "À l'instant",
        type: 'quote_accepted',
        icon: 'check-circle',
        title: `Devis #${doc.number} accepté 🎉`,
        details: `Accepté en ligne par ${doc.clientName}`
      });

      this.saveState();
      this.showToast("🎉 Félicitations ! Devis accepté par le client.", "success");
      this.renderPublicDocView();
    }
  },

  /**
   * Opens Payment Provider Checkout Modal
   */
  openPaymentModal: function (docId) {
    const doc = this.state.documents.find(d => d.id === docId);
    if (!doc) return;

    this.activePaymentDoc = doc;
    document.getElementById('pay-modal-doc-num').textContent = doc.number;
    document.getElementById('pay-modal-amount').textContent = (doc.total).toLocaleString('fr-FR') + ' ' + (doc.currency || 'FCFA');

    const providersListEl = document.getElementById('payment-providers-list');
    providersListEl.innerHTML = window.PaymentProvider.providers.map(p => `
      <div class="card" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1rem;" onclick="KivoApp.selectPaymentProvider('${p.id}')">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.5rem;">${p.icon}</span>
          <div>
            <strong style="display: block; font-size: 0.9rem;">${p.name}</strong>
            <span style="font-size: 0.75rem; color: var(--text-secondary);">${p.description}</span>
          </div>
        </div>
        <span class="badge badge-accepted">${p.badge}</span>
      </div>
    `).join('');

    document.getElementById('payment-input-step').style.display = 'none';
    this.openModal('modal-payment-checkout');
  },

  /**
   * Selects payment provider in checkout modal
   */
  selectPaymentProvider: function (providerId) {
    this.selectedProviderId = providerId;
    document.getElementById('payment-input-step').style.display = 'block';
    document.getElementById('pay-input-phone').value = this.activePaymentDoc.clientPhone || '';
    document.getElementById('pay-confirm-btn').scrollIntoView({ behavior: 'smooth' });
  },

  /**
   * Confirms payment execution and handles webhook callback
   */
  confirmOnlinePayment: function () {
    const doc = this.activePaymentDoc;
    const phone = document.getElementById('pay-input-phone').value;
    const btn = document.getElementById('pay-confirm-btn');

    btn.textContent = "Traitement sécurisé en cours...";
    btn.disabled = true;

    window.PaymentProvider.processPayment(doc, this.selectedProviderId, { phone }, (record) => {
      this.closeModal('modal-payment-checkout');
      btn.textContent = "Confirmer le paiement instantané 🔒";
      btn.disabled = false;

      this.showToast(`Paiement de ${doc.total.toLocaleString('fr-FR')} FCFA confirmé via Wave/Mobile Money !`, "success");
      this.renderPublicDocView();
    });
  },

  /**
   * Internal webhook callback handler triggered when invoice payment completes
   */
  recordInvoicePayment: function (docId, amount, providerId, transactionId) {
    const doc = this.state.documents.find(d => d.id === docId);
    if (doc) {
      doc.status = 'paid';
      doc.amountPaid = (doc.amountPaid || 0) + amount;

      this.state.activities.unshift({
        id: 'act_' + Date.now(),
        timestamp: "À l'instant",
        type: 'payment',
        icon: 'dollar-sign',
        title: `Paiement reçu pour #${doc.number}`,
        details: `${amount.toLocaleString('fr-FR')} ${this.state.business.currency} encaissés via ${providerId.toUpperCase()} (Tx: ${transactionId})`
      });

      this.saveState();
    }
  },

  /**
   * Shares document link formatted on WhatsApp
   */
  shareOnWhatsApp: function (docId) {
    const doc = this.state.documents.find(d => d.id === docId);
    if (doc) {
      const msg = window.WhatsAppHelper.buildShareMessage(doc, this.state.business.name);
      const url = window.WhatsAppHelper.getWhatsAppWebUrl(doc.clientPhone, msg);
      window.open(url, '_blank');
    }
  },

  /**
   * Renders Clients CRM View
   */
  renderClients: function () {
    const tbody = document.getElementById('clients-list-tbody');
    if (!tbody) return;

    const biz = this.state.business;

    tbody.innerHTML = this.state.clients.map(c => `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td>${c.company || '-'}</td>
        <td>${c.phone || '-'}</td>
        <td><strong>${(c.totalInvoiced || 0).toLocaleString('fr-FR')} ${biz.currency}</strong></td>
        <td style="color: var(--success-text);"><strong>${(c.totalPaid || 0).toLocaleString('fr-FR')} ${biz.currency}</strong></td>
        <td style="color: var(--danger-text);"><strong>${(c.balanceDue || 0).toLocaleString('fr-FR')} ${biz.currency}</strong></td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-sm" onclick="KivoApp.startNewDocument('invoice')">+ Facturer</button>
        </td>
      </tr>
    `).join('');
  },

  /**
   * Renders Catalog Library View
   */
  renderCatalog: function () {
    const container = document.getElementById('catalog-grid');
    if (!container) return;

    const biz = this.state.business;

    container.innerHTML = this.state.catalog.map(cat => `
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <span class="badge badge-accepted">${cat.unit}</span>
          <h3 style="margin: 0.5rem 0 0.25rem 0;">${cat.name}</h3>
          <p style="color: var(--text-secondary); font-size: 0.85rem;">${cat.description}</p>
        </div>
        <div style="margin-top: 1.5rem; display: flex; align-items: center; justify-content: space-between;">
          <div style="font-family: var(--font-heading); font-weight: 700; font-size: 1.2rem; color: var(--primary);">
            ${cat.price.toLocaleString('fr-FR')} ${biz.currency}
          </div>
          <button class="btn btn-secondary btn-sm" onclick="KivoApp.startNewDocument('invoice')">Utiliser</button>
        </div>
      </div>
    `).join('');
  },

  /**
   * Renders Smart Reminders View
   */
  renderReminders: function () {
    const listEl = document.getElementById('reminders-doc-list');
    if (!listEl) return;

    const overdueDocs = this.state.documents.filter(d => d.type === 'invoice' && d.status !== 'paid');

    if (overdueDocs.length === 0) {
      listEl.innerHTML = `<p style="color: var(--text-muted);">Aucune facture en attente de relance ! 🎉</p>`;
      return;
    }

    listEl.innerHTML = overdueDocs.map((doc, idx) => `
      <div class="card" style="cursor: pointer; border: ${idx === 0 ? '2px solid var(--primary)' : '1px solid var(--border-color)'}; padding: 1rem;" onclick="KivoApp.selectReminderDoc('${doc.id}')">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${doc.number} — ${doc.clientName}</strong>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">Échéance: ${doc.dueDate}</div>
          </div>
          <span class="badge ${doc.status === 'overdue' ? 'badge-overdue' : 'badge-sent'}">${(doc.total).toLocaleString('fr-FR')} FCFA</span>
        </div>
      </div>
    `).join('');

    if (!this.activeReminderDocId && overdueDocs.length > 0) {
      this.selectReminderDoc(overdueDocs[0].id);
    }
  },

  /**
   * Selects active reminder document and triggers KIVO AI message generator
   */
  selectReminderDoc: function (docId) {
    this.activeReminderDocId = docId;
    const doc = this.state.documents.find(d => d.id === docId);
    if (!doc) return;

    const reminder = window.KivoAI.generateReminder(doc, this.selectedReminderTone, this.state.business.name);
    document.getElementById('reminder-message-preview').value = reminder.text;
    document.getElementById('reminder-send-whatsapp').href = reminder.whatsappUrl;
  },

  /**
   * Sets Reminder AI tone
   */
  setReminderTone: function (tone) {
    this.selectedReminderTone = tone;
    if (this.activeReminderDocId) {
      this.selectReminderDoc(this.activeReminderDocId);
    }
  },

  /**
   * Copies reminder message text to clipboard
   */
  copyReminderText: function () {
    const text = document.getElementById('reminder-message-preview').value;
    navigator.clipboard.writeText(text).then(() => {
      this.showToast("Message copié dans le presse-papier !", "info");
    });
  },

  /**
   * Switches Auth Tab (Login vs Register)
   */
  switchAuthTab: function (tab) {
    document.getElementById('auth-tab-login').classList.remove('active-pill');
    document.getElementById('auth-tab-register').classList.remove('active-pill');
    
    if (tab === 'login') {
      document.getElementById('auth-tab-login').classList.add('active-pill');
      document.getElementById('auth-form-login').style.display = 'block';
      document.getElementById('auth-form-register').style.display = 'none';
    } else {
      document.getElementById('auth-tab-register').classList.add('active-pill');
      document.getElementById('auth-form-login').style.display = 'none';
      document.getElementById('auth-form-register').style.display = 'block';
    }
  },

  /**
   * Google Authentication Simulation
   */
  simulateGoogleAuth: function () {
    this.showToast("Connexion Google réussie ! Welcome Marc Koffi 👋", "success");
    this.navigate('dashboard');
  },

  /**
   * Login Submission — validates credentials against stored state
   */
  submitLogin: function () {
    const email = document.getElementById('auth-login-email').value.trim();
    const pwd = document.getElementById('auth-login-password').value;

    if (!email || !pwd) {
      this.showToast("Veuillez saisir votre email et mot de passe.", "error");
      return;
    }

    // Check if account exists
    if (!this.state.userEmail) {
      this.showToast("Aucun compte trouvé. Veuillez créer un compte d'abord.", "error");
      return;
    }

    if (this.state.userEmail === email && this.state.userPassword === pwd) {
      if (this.state.isOnboarded) {
        this.showToast(`Bienvenue ${this.state.business.owner} ! 👋`, "success");
        this.navigate('dashboard');
      } else {
        this.showToast("Compte trouvé ! Finalisons la configuration de votre entreprise.", "info");
        this.navigate('onboarding');
      }
    } else {
      this.showToast("Email ou mot de passe incorrect.", "error");
    }
  },

  /**
   * Register Submission — saves credentials and sends to onboarding
   */
  submitRegister: function () {
    const name = document.getElementById('auth-reg-name').value.trim();
    const email = document.getElementById('auth-reg-email').value.trim();
    const pwd = document.getElementById('auth-reg-password').value;
    const pwd2 = document.getElementById('auth-reg-password2') ? document.getElementById('auth-reg-password2').value : pwd;

    if (!name || !email || !pwd) {
      this.showToast("Veuillez remplir tous les champs obligatoires.", "error");
      return;
    }
    if (pwd !== pwd2) {
      this.showToast("Les mots de passe ne correspondent pas.", "error");
      return;
    }
    if (pwd.length < 6) {
      this.showToast("Le mot de passe doit contenir au moins 6 caractères.", "error");
      return;
    }

    // Save credentials in state (MVP — plaintext, would be hashed in production)
    this.state.userEmail = email;
    this.state.userPassword = pwd;
    this.state.userName = name;
    this.state.business.owner = name;
    this.state.business.email = email;
    this.saveState();

    this.showToast(`🎉 Compte créé pour ${name} ! Configurons votre entreprise...`, "success");
    setTimeout(() => this.navigate('onboarding'), 1000);
  },

  /**
   * Automatically updates Phone Code & Currency when Country selection changes
   */
  onCountrySelectChange: function () {
    const select = document.getElementById('onboard-biz-country');
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption) {
      const code = selectedOption.getAttribute('data-code');
      const curr = selectedOption.getAttribute('data-currency');

      if (code) {
        const prefixSelect = document.getElementById('onboard-biz-phone-prefix');
        if (prefixSelect) {
          // If code exists in options set it, else add it dynamically
          prefixSelect.value = code;
          if (prefixSelect.value !== code) {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = `${code} 🌐`;
            prefixSelect.appendChild(opt);
            prefixSelect.value = code;
          }
        }
      }

      if (curr) {
        const currSelect = document.getElementById('onboard-biz-currency');
        if (currSelect) {
          currSelect.value = curr;
          if (currSelect.value !== curr) {
            const opt = document.createElement('option');
            opt.value = curr;
            opt.textContent = `${curr}`;
            currSelect.appendChild(opt);
            currSelect.value = curr;
          }
        }
      }
    }
  },

  /**
   * 1-Click quick demo fill for Onboarding
   */
  fillDemoOnboardingData: function () {
    document.getElementById('onboard-biz-name').value = "MD Creative Studio";
    document.getElementById('onboard-biz-owner').value = "Marc Koffi";
    document.getElementById('onboard-biz-country').value = "Sénégal";
    document.getElementById('onboard-biz-phone-prefix').value = "+221";
    document.getElementById('onboard-biz-phone').value = "77 842 19 02";
    document.getElementById('onboard-biz-currency').value = "FCFA";
    document.getElementById('onboard-biz-email').value = "marc.koffi@mdcreative.design";
    document.getElementById('onboard-biz-taxid').value = "SN-NINEA-849204812";
    this.showToast("⚡ Données de démo chargées dans le formulaire.", "info");
  },

  selectedOnboardPlan: 'Pro',

  /**
   * Selects subscription tier card in Onboarding wizard
   */
  selectOnboardingPlan: function (tier) {
    this.selectedOnboardPlan = tier;
    const cards = ['free', 'pro', 'business'];
    cards.forEach(c => {
      const el = document.getElementById(`onboard-plan-${c}`);
      if (el) {
        el.style.border = '2px solid var(--border-color)';
        el.style.background = 'var(--bg-card)';
        const titleEl = el.querySelector('h4');
        if (titleEl) titleEl.style.color = 'var(--text-primary)';
      }
    });

    const activeEl = document.getElementById(`onboard-plan-${tier.toLowerCase()}`);
    if (activeEl) {
      activeEl.style.border = '2px solid var(--primary)';
      activeEl.style.background = 'var(--primary-light)';
      const titleEl = activeEl.querySelector('h4');
      if (titleEl) titleEl.style.color = 'var(--primary)';
    }
  },

  /**
   * Completes onboarding flow and saves new business profile
   * Sets isOnboarded = true so the auth guard allows access to app views
   */
  completeOnboarding: function () {
    const bizName = document.getElementById('onboard-biz-name').value.trim();
    const bizOwner = document.getElementById('onboard-biz-owner').value.trim();
    const bizIndustry = document.getElementById('onboard-biz-industry').value;
    const bizCountry = document.getElementById('onboard-biz-country').value;
    const bizCurrency = document.getElementById('onboard-biz-currency').value;
    const phonePrefix = document.getElementById('onboard-biz-phone-prefix').value;
    const rawPhone = document.getElementById('onboard-biz-phone').value.trim();
    const bizEmail = document.getElementById('onboard-biz-email').value.trim();
    const bizTaxId = document.getElementById('onboard-biz-taxid').value.trim();

    if (!bizName || !bizOwner || !rawPhone || !bizEmail) {
      this.showToast("Veuillez remplir tous les champs obligatoires (*).", "error");
      return;
    }

    const fullPhone = `${phonePrefix} ${rawPhone}`;

    const biz = this.state.business;
    biz.name = bizName;
    biz.owner = bizOwner;
    biz.industry = bizIndustry;
    biz.country = bizCountry;
    biz.currency = bizCurrency;
    biz.phone = fullPhone;
    biz.email = bizEmail;
    biz.taxId = bizTaxId;
    biz.subscriptionTier = this.selectedOnboardPlan || 'Gratuit';
    biz.subscriptionStatus = 'active';

    // Generate logo initials from business name
    const words = bizName.split(' ').filter(w => w.length > 0);
    biz.logoText = words.length > 1
      ? (words[0][0] + words[1][0]).toUpperCase()
      : bizName.substring(0, 2).toUpperCase();

    // ✔ Mark as onboarded — this is the key flag that unlocks the app
    this.state.isOnboarded = true;

    this.saveState();
    this.updateUserBrandingUI();
    this.showToast(`🎉 Bienvenue sur KIVO, ${bizOwner} ! Votre espace est prêt.`, "success");
    this.navigate('dashboard');
  },

  /**
   * Switches Subscription Tier live in Settings
   */
  switchSubscriptionTier: function (tier) {
    this.state.business.subscriptionTier = tier;
    this.state.business.subscriptionStatus = 'active';
    this.saveState();
    this.renderSettings();
    this.showToast(`✨ Forfait ${tier} activé avec succès pour votre entreprise !`, "success");
  },

  /**
   * Renders Settings View Form
   */
  renderSettings: function () {
    const biz = this.state.business;
    document.getElementById('setting-biz-name').value = biz.name;
    document.getElementById('setting-biz-owner').value = biz.owner;
    document.getElementById('setting-biz-phone').value = biz.phone;
    document.getElementById('setting-biz-email').value = biz.email;
    document.getElementById('setting-biz-currency').value = biz.currency;
    document.getElementById('setting-biz-prefix').value = biz.documentPrefix;

    // Update Subscription UI Badge & Card highlights
    const tier = biz.subscriptionTier || 'Pro';
    const badgeEl = document.getElementById('settings-current-plan-badge');
    if (badgeEl) {
      badgeEl.textContent = `✓ Forfait Actif : ${tier.toUpperCase()}`;
    }

    const plans = ['gratuit', 'pro', 'business'];
    plans.forEach(p => {
      const cardEl = document.getElementById(`setting-plan-card-${p}`);
      if (cardEl) {
        if (p === tier.toLowerCase()) {
          cardEl.style.border = '2px solid var(--primary)';
          cardEl.style.background = 'var(--primary-light)';
        } else {
          cardEl.style.border = '1px solid var(--border-color)';
          cardEl.style.background = 'var(--bg-card)';
        }
      }
    });
  },

  /**
   * Saves Settings back to state
   */
  saveSettings: function () {
    const biz = this.state.business;
    biz.name = document.getElementById('setting-biz-name').value;
    biz.owner = document.getElementById('setting-biz-owner').value;
    biz.phone = document.getElementById('setting-biz-phone').value;
    biz.email = document.getElementById('setting-biz-email').value;
    biz.currency = document.getElementById('setting-biz-currency').value;
    biz.documentPrefix = document.getElementById('setting-biz-prefix').value;

    this.saveState();
    this.showToast("Paramètres mis à jour avec succès !", "success");
    this.updateUserBrandingUI();
  },

  /**
   * Modals handling
   */
  openModal: function (modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('active');
  },

  closeModal: function (modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
  },

  openAiModal: function () {
    this.openModal('modal-ai-prompt');
  },

  executeStandaloneAiParse: function () {
    const promptText = document.getElementById('modal-ai-textarea').value;
    if (!promptText) return;

    this.closeModal('modal-ai-prompt');
    this.startNewDocument('invoice');
    document.getElementById('builder-ai-input').value = promptText;
    this.triggerBuilderAiParse();
  },

  openNewClientModal: function () {
    this.openModal('modal-new-client');
  },

  saveNewClient: function () {
    const name = document.getElementById('new-cli-name').value;
    const contact = document.getElementById('new-cli-contact').value;
    const phone = document.getElementById('new-cli-phone').value;
    const email = document.getElementById('new-cli-email').value;

    if (!name) {
      this.showToast("Veuillez remplir le nom du client.", "error");
      return;
    }

    const newClient = {
      id: 'cli_' + Date.now(),
      name: name,
      company: name,
      contactName: contact,
      email: email,
      phone: phone,
      totalInvoiced: 0,
      totalPaid: 0,
      balanceDue: 0,
      createdAt: new Date().toISOString().split('T')[0]
    };

    this.state.clients.unshift(newClient);
    this.saveState();
    this.closeModal('modal-new-client');
    this.showToast(`Client ${name} ajouté avec succès.`, "success");
    this.renderClients();
  },

  /**
   * Toast notification display helper
   */
  showToast: function (message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 4000);
  }
};

// Initialize application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.KivoApp.init();
});
