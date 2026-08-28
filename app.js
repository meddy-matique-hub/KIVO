/**
 * KIVO MATIQUE - Main Application Controller & Router
 * Single Page Application (SPA) Engine with Real-Time Split Preview, VAT, Stripe, and i18n
 */

window.KivoApp = {
  state: null,
  activeView: 'dashboard',
  selectedReminderTone: 'courtois',
  activeReminderDocId: null,
  pendingDeleteAction: null,

  /**
   * Translations Dictionary for i18n (Français, English, Español)
   */
  translations: {
    fr: {
      appName: "KIVO MATIQUE",
      dashboard: "Tableau de bord",
      documents: "Documents",
      clients: "Clients",
      catalog: "Services & Produits",
      reminders: "Relances Intelligentes",
      analytics: "Statistiques",
      settings: "Paramètres",
      newDoc: "+ Nouveau document",
      save: "Enregistrer",
      cancel: "Annuler",
      delete: "Supprimer",
      confirmDelete: "Confirmer la suppression",
      paid: "Payée ✓",
      overdue: "En retard ⚠️",
      sent: "Envoyée",
      draft: "Brouillon",
      refunded: "Remboursée ↩️",
      cancelled: "Annulée",
      accepted: "Accepté ✓",
      totalTtc: "TOTAL TTC",
      subtotalHt: "Sous-total HT",
      taxVat: "TVA / Taxe"
    },
    en: {
      appName: "KIVO MATIQUE",
      dashboard: "Dashboard",
      documents: "Documents",
      clients: "Clients",
      catalog: "Products & Services",
      reminders: "Smart Reminders",
      analytics: "Analytics",
      settings: "Settings",
      newDoc: "+ New Document",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      confirmDelete: "Confirm Deletion",
      paid: "Paid ✓",
      overdue: "Overdue ⚠️",
      sent: "Sent",
      draft: "Draft",
      refunded: "Refunded ↩️",
      cancelled: "Cancelled",
      accepted: "Accepted ✓",
      totalTtc: "GRAND TOTAL",
      subtotalHt: "Subtotal (excl. tax)",
      taxVat: "VAT / Tax"
    },
    es: {
      appName: "KIVO MATIQUE",
      dashboard: "Panel de Control",
      documents: "Documentos",
      clients: "Clientes",
      catalog: "Productos y Servicios",
      reminders: "Recordatorios",
      analytics: "Estadísticas",
      settings: "Ajustes",
      newDoc: "+ Nuevo Documento",
      save: "Guardar",
      cancel: "Cancelar",
      delete: "Eliminar",
      confirmDelete: "Confirmar eliminación",
      paid: "Pagado ✓",
      overdue: "Vencido ⚠️",
      sent: "Enviado",
      draft: "Borrador",
      refunded: "Reembolsado ↩️",
      cancelled: "Cancelado",
      accepted: "Aceptado ✓",
      totalTtc: "TOTAL FINAL",
      subtotalHt: "Subtotal sin impuestos",
      taxVat: "IVA / Impuesto"
    }
  },

  /**
   * Default BLANK initial state for new users
   */
  BLANK_STATE: {
    isOnboarded: false,
    language: 'fr',
    userEmail: null,
    // NOTE: passwords are NEVER stored — auth is handled by Supabase
    business: {
      name: "Mon Entreprise",
      owner: "",
      email: "",
      phone: "",
      industry: "Prestations & Commerce",
      country: "Sénégal",
      currency: "FCFA",
      currencySymbol: "FCFA",
      defaultVatRate: 18,
      address: "",
      taxId: "",
      logoText: "KM",
      logoBg: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
      stripeKey: "pk_test_51KivoMastiqueDemoStripeKey998",
      invoicePrefix: "FAC-2026-",
      quotePrefix: "DEV-2026-",
      nextInvoiceNumber: 1001,
      nextQuoteNumber: 1001,
      bankDetails: { bankName: "", accountName: "", iban: "", mobileMoney: { wave: "", orangeMoney: "", mtn: "" } },
      subscriptionTier: "Gratuit",
      subscriptionStatus: "active"
    },
    clients: [],
    documents: [],
    catalog: [],
    activities: []
  },

  /**
   * Initializes application state and router
   * Auth is checked FIRST — app waits for session before showing any data
   */
  init: async function () {
    console.log("[KivoApp] Initializing KIVO MATIQUE application...");
    this.setupRouting();
    this.setupEventListeners();

    // 1. Check Supabase session first
    let session = null;
    try {
      if (window.KivoDb && window.KivoDb.supabase) {
        const { data: sessionData } = await KivoDb.supabase.auth.getSession();
        const rawSession = sessionData?.session || null;
        if (rawSession) {
          const { data: userData, error: userError } = await KivoDb.supabase.auth.getUser();
          if (userError || !userData?.user) {
            console.warn('[KivoApp] Session token invalid or expired — signing out.');
            await KivoDb.supabase.auth.signOut();
          } else {
            session = rawSession;
          }
        }
      }
    } catch (e) {
      console.warn('[KivoApp] Error checking session:', e);
    }

    if (session) {
      document.getElementById('modal-login').style.display = 'none';
      const stored = localStorage.getItem('kivo_app_state');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const isDemoData = parsed.userEmail && parsed.userEmail !== session.user.email;
          const isSeeded = (parsed.clients || []).some(c => c.id && c.id.startsWith('cli_demo'));
          if (isDemoData || isSeeded) {
            localStorage.removeItem('kivo_app_state');
          }
        } catch(e) {}
      }
      
      this.loadState();
      this.supabaseConnected = true;
      this.handleRoute();
      try {
        await this.syncFromSupabase();
      } catch (e) {
        console.error('[KivoApp] Supabase sync error:', e);
      }
    } else {
      // Unauthenticated visitor: load landing page cleanly without blocking modal
      console.log('[KivoApp] Unauthenticated visitor — rendering clean landing page.');
      document.getElementById('modal-login').style.display = 'none';
      this.supabaseConnected = true;
      this.state = JSON.parse(JSON.stringify(this.BLANK_STATE));
      this.handleRoute();
    }
  },

  /**
   * Tests Supabase connectivity and syncs cloud data into local state
   */
  initSupabase: async function () {
    if (!window.KivoDb) return;
    try {
      // Check auth session (faster than a real ping)
      const { data: { session } } = await KivoDb.supabase.auth.getSession();
      if (!session) {
        console.warn('[KivoApp] No Supabase session — not loading cloud data yet.');
        return;
      }
      this.supabaseConnected = true;
      console.log('[KivoApp] ✅ Supabase session active — syncing cloud data...');
      await this.syncFromSupabase();
    } catch (e) {
      console.error('[KivoApp] Supabase init error:', e);
    }
  },

  /**
   * Loads all data from Supabase and merges into local state
   */
  syncFromSupabase: async function () {
    if (!window.KivoDb || !this.supabaseConnected) return;
    const data = await window.KivoDb.loadAll();
    if (!data) return;

    // If Supabase has business settings for this user → they have completed onboarding
    if (data.settings && data.settings.length > 0) {
      this.state.isOnboarded = true;
    }

    // Merge Supabase settings into local business object
    if (data.settings && data.settings.length > 0) {
      const s = data.settings[0];
      this.state.business = {
        ...this.state.business,
        name: s.company_name || this.state.business.name,
        owner: s.owner || this.state.business.owner,
        email: s.email || this.state.business.email,
        phone: s.phone || this.state.business.phone,
        website: s.website || this.state.business.website || '',
        industry: s.industry || this.state.business.industry,
        country: s.country || this.state.business.country,
        currency: s.currency || this.state.business.currency,
        defaultVatRate: s.default_vat_rate !== undefined ? s.default_vat_rate : this.state.business.defaultVatRate,
        address: s.address || this.state.business.address,
        taxId: s.fiscal_id || this.state.business.taxId,
        logoUrl: s.logo_url || this.state.business.logoUrl || '',
        invoicePrefix: s.invoice_prefix || this.state.business.invoicePrefix,
        quotePrefix: s.quote_prefix || this.state.business.quotePrefix,
        nextInvoiceNumber: s.next_invoice_number || this.state.business.nextInvoiceNumber,
        nextQuoteNumber: s.next_quote_number || this.state.business.nextQuoteNumber,
        subscriptionTier: s.current_plan || this.state.business.subscriptionTier,
        visualTemplate: s.visual_template || this.state.business.visualTemplate || 'classic',
        primaryColor: s.primary_color || this.state.business.primaryColor || '#0F172A',
        secondaryColor: s.secondary_color || this.state.business.secondaryColor || '#64748B',
      };
      
      // Update the visual UI elements with loaded settings
      const tSelect = document.getElementById('builder-visual-template');
      if (tSelect) tSelect.value = this.state.business.visualTemplate;
      const pColor = document.getElementById('builder-color-primary');
      if (pColor) pColor.value = this.state.business.primaryColor;
      const sColor = document.getElementById('builder-color-secondary');
      if (sColor) sColor.value = this.state.business.secondaryColor;
      
      // Apply them immediately
      if (typeof this.updateDocumentPreviewVisuals === 'function') {
        this.updateDocumentPreviewVisuals();
      }
    }

    // Merge clients from Supabase
    if (data.clients && data.clients.length > 0) {
      const cloudIds = new Set(data.clients.map(c => c.id));
      const localOnly = (this.state.clients || []).filter(c => !cloudIds.has(c.id));
      this.state.clients = [
        ...data.clients.map(c => ({
          id: c.id, name: c.name, type: c.client_type, company: c.company,
          contactName: c.contact_name, taxId: c.tax_id, email: c.email,
          phone: c.phone, address: c.address,
          totalInvoiced: c.total_invoiced, totalPaid: c.total_paid, balanceDue: c.balance_due
        })),
        ...localOnly
      ];
    }

    // Merge catalog
    if (data.catalog && data.catalog.length > 0) {
      const cloudIds = new Set(data.catalog.map(p => p.id));
      const localOnly = (this.state.catalog || []).filter(p => !cloudIds.has(p.id));
      this.state.catalog = [
        ...data.catalog.map(p => ({
          id: p.id, name: p.name, description: p.description,
          price: p.price, unit: p.unit, taxRate: p.tax_rate
        })),
        ...localOnly
      ];
    }

    // Merge documents
    if (data.documents && data.documents.length > 0) {
      const cloudIds = new Set(data.documents.map(d => d.id));
      const localOnly = (this.state.documents || []).filter(d => !cloudIds.has(d.id));
      this.state.documents = [
        ...data.documents.map(d => ({
          id: d.id, number: d.number, type: d.type, status: d.status,
          currency: d.currency, clientId: d.client_id, clientName: d.client_name,
          clientType: d.client_type, clientTaxId: d.client_tax_id,
          clientEmail: d.client_email, clientPhone: d.client_phone,
          issueDate: d.issue_date, dueDate: d.due_date,
          items: typeof d.items === 'string' ? JSON.parse(d.items) : (d.items || []),
          subtotal: d.subtotal, discount: d.discount, taxRate: d.tax_rate,
          tax: d.tax, total: d.total, amountPaid: d.amount_paid,
          notes: d.notes, terms: d.terms,
          publicToken: d.public_token, viewsCount: d.views_count
        })),
        ...localOnly
      ];
    }

    // Merge activities
    if (data.activities && data.activities.length > 0) {
      this.state.activities = data.activities.map(a => ({
        id: a.id, timestamp: a.timestamp, type: a.type,
        icon: a.icon, title: a.title, details: a.details
      }));
    }

    this.saveState();
    this.renderCurrentView();
    this.showToast('☁️ Données synchronisées depuis Supabase.', 'success');
    console.log('[KivoApp] Supabase sync complete.');
  },

  /**
   * Pushes local state changes to Supabase (async, fire-and-forget)
   */
  syncDocumentToSupabase: async function (doc) {
    if (!window.KivoDb || !this.supabaseConnected) return;
    try {
      await window.KivoDb.saveDocument({
        id: doc.id, number: doc.number, type: doc.type, status: doc.status,
        currency: doc.currency || 'FCFA',
        client_id: doc.clientId, client_name: doc.clientName, client_type: doc.clientType,
        client_tax_id: doc.clientTaxId, client_email: doc.clientEmail, client_phone: doc.clientPhone,
        issue_date: doc.issueDate, due_date: doc.dueDate,
        items: JSON.stringify(doc.items || []),
        subtotal: doc.subtotal, discount: doc.discount, tax_rate: doc.taxRate,
        tax: doc.tax, total: doc.total, amount_paid: doc.amountPaid || 0,
        notes: doc.notes, terms: doc.terms,
        public_token: doc.publicToken, views_count: doc.viewsCount || 0
      });
    } catch (e) {
      console.error('[KivoApp] Supabase doc sync error:', e);
    }
  },

  /**
   * Loads state from localStorage
   */
  loadState: function () {
    const saved = localStorage.getItem('kivo_app_state');
    if (saved) {
      try {
        this.state = JSON.parse(saved);
        if (this.state.isOnboarded === undefined) {
          this.state.isOnboarded = false;
        }
        if (!this.state.business.invoicePrefix) {
          this.state.business.invoicePrefix = "FAC-2026-";
          this.state.business.quotePrefix = "DEV-2026-";
          this.state.business.nextInvoiceNumber = 1001;
          this.state.business.nextQuoteNumber = 1001;
        }
        if (this.state.business.defaultVatRate === undefined) {
          this.state.business.defaultVatRate = 18;
        }
      } catch (e) {
        console.error("[KivoApp] State parse error, resetting.", e);
        this.state = JSON.parse(JSON.stringify(this.BLANK_STATE));
        this.saveState();
      }
    } else {
      this.state = JSON.parse(JSON.stringify(this.BLANK_STATE));
      this.saveState();
    }
  },

  /**
   * Persists state to localStorage (Supabase sync is handled per-entity)
   */
  saveState: function () {
    localStorage.setItem('kivo_app_state', JSON.stringify(this.state));
  },

  /**
   * Loads demo data seed for MD Creative Studio
   */
  loadDemoData: function () {
    const demo = JSON.parse(JSON.stringify(window.KIVO_DEMO_DATA));
    demo.isOnboarded = true;
    this.state = demo;
    this.saveState();
    this.updateUserBrandingUI();
    this.showToast("🎭 Mode démo KIVO MATIQUE activé ! Compte MD Creative Studio chargé.", "success");
    this.navigate('dashboard');
  },

  /**
   * Logs out: signs out of Supabase AND clears local state
   * FIX: Must call supabase.auth.signOut() to clear the session token from localStorage.
   * Without this, getSession() finds the old token and auto-logs in the user.
   */
  logout: async function () {
    if (confirm("Voulez-vous vraiment vous déconnecter de KIVO MATIQUE ?")) {
      try {
        // Critical: sign out from Supabase to destroy the token in localStorage
        if (window.KivoDb && window.KivoDb.supabase) {
          await KivoDb.supabase.auth.signOut();
        }
      } catch (e) {
        console.error('[KivoApp] Error during Supabase signOut:', e);
      }
      // Clear local app state
      localStorage.removeItem('kivo_app_state');
      this.state = JSON.parse(JSON.stringify(this.BLANK_STATE));
      this.supabaseConnected = false;
      // Force page reload to get a fresh, clean session check
      window.location.href = window.location.pathname;
    }
  },

  /**
   * Resets demo data seed
   */
  resetDemoData: function () {
    if (confirm("Voulez-vous réinitialiser toutes les données avec la démo KIVO MATIQUE ?")) {
      this.loadDemoData();
    }
  },

  /**
   * Hash routing configuration
   */
  setupRouting: function () {
    window.addEventListener('hashchange', () => {
      this.handleRoute();
    });
  },

  /**
   * Handles hash navigation and auth guards
   */
  handleRoute: function () {
    const hash = window.location.hash || '';
    let rawView = hash.split('?')[0].replace('#', '');
    let viewName = rawView;
    let anchorTarget = null;

    if (rawView.startsWith('landing-')) {
      viewName = 'landing';
      anchorTarget = rawView;
    }

    if (!viewName) viewName = '';

    const publicViews = ['landing', 'auth', 'onboarding', 'public-doc'];
    const appViews = ['dashboard', 'documents', 'document-builder', 'clients', 'catalog', 'reminders', 'analytics', 'settings'];
    const validViews = [...publicViews, ...appViews];

    if (!validViews.includes(viewName)) {
      viewName = '';
    }

    const isOnboarded = this.state && this.state.isOnboarded === true;

    if (!viewName) {
      viewName = isOnboarded ? 'dashboard' : 'landing';
    } else if (!isOnboarded && appViews.includes(viewName)) {
      this.showToast("Veuillez vous connecter ou créer votre compte KIVO MATIQUE.", "info");
      viewName = 'landing';
    }

    this.activeView = viewName;

    document.querySelectorAll('.view-section').forEach(sec => {
      sec.style.display = 'none';
    });

    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) {
      targetSection.style.display = 'block';
    }

    const loginModal = document.getElementById('modal-login');
    if (loginModal) {
      loginModal.style.display = viewName === 'auth' ? 'flex' : 'none';
    }

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

    document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      }
    });

    this.renderCurrentView();
    if (anchorTarget) {
      setTimeout(() => {
        const el = document.getElementById(anchorTarget);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    } else {
      window.scrollTo(0, 0);
    }
  },

  /**
   * Programmatic navigation helper
   */
  navigate: function (viewName, params = '') {
    window.location.hash = `#${viewName}${params ? '?' + params : ''}`;
  },

  /**
   * Setup event listeners
   */
  setupEventListeners: function () {
    const toggleBtn = document.getElementById('mobile-menu-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('mobile-open');
      });
    }

    const filterPills = document.querySelectorAll('#doc-filter-pills button');
    filterPills.forEach(btn => {
      btn.addEventListener('click', (e) => {
        filterPills.forEach(b => b.classList.remove('active-pill'));
        e.target.classList.add('active-pill');
        const filter = e.target.getAttribute('data-filter');
        this.renderDocumentsTable(filter);
      });
    });

    const searchInput = document.getElementById('doc-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.renderDocumentsTable('all', e.target.value);
      });
    }
  },

  /**
   * Render Dispatcher
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
   * Updates sidebar and header branding elements
   */
  updateUserBrandingUI: function () {
    const biz = this.state.business;
    const nameEl = document.getElementById('sidebar-user-name');
    const bizEl = document.getElementById('sidebar-business-name');
    const emailEl = document.getElementById('sidebar-user-email');
    const avatarEl = document.getElementById('sidebar-avatar');
    
    if (nameEl) nameEl.textContent = biz.owner || "Mon Compte";
    if (bizEl) bizEl.textContent = biz.name || "KIVO MATIQUE";
    if (emailEl) emailEl.textContent = biz.email || "contact@entreprise.com";
    
    if (avatarEl) {
      if (biz.logoUrl) {
        avatarEl.style.overflow = 'hidden';
        avatarEl.style.background = '#FFFFFF';
        avatarEl.innerHTML = `<img src="${biz.logoUrl}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;">`;
      } else {
        avatarEl.innerHTML = biz.logoText || "KM";
      }
    }

    const previewBadge = document.getElementById('setting-logo-preview-badge');
    if (previewBadge) {
      if (biz.logoUrl) {
        previewBadge.innerHTML = `<img src="${biz.logoUrl}" style="width: 100%; height: 100%; object-fit: contain;">`;
      } else {
        previewBadge.innerHTML = biz.logoText || "KM";
      }
    }

    // Update builder logo UI
    const promptEl = document.getElementById('builder-logo-upload-prompt');
    const boxEl = document.getElementById('builder-logo-preview-box');
    const imgEl = document.getElementById('builder-logo-preview-img');
    if (promptEl && boxEl && imgEl) {
      if (biz.logoUrl) {
        imgEl.src = biz.logoUrl;
        boxEl.style.display = 'flex';
        promptEl.style.display = 'none';
      } else {
        boxEl.style.display = 'none';
        promptEl.style.display = 'block';
      }
    }
  },

  removeBusinessLogo: function () {
    this.state.business.logoUrl = '';
    this.saveState();
    this.updateUserBrandingUI();
    this.updateLiveInvoicePreview();
    if (window.KivoDb && this.supabaseConnected) {
      this.saveSettings();
    }
    this.showToast("Logo supprimé.", "info");
  },

  /**
   * Multi-language switcher helper
   */
  setLanguage: function (lang) {
    if (this.translations[lang]) {
      this.state.language = lang;
      this.saveState();
      this.showToast(`Langue modifiée : ${lang.toUpperCase()}`, "info");
      this.renderCurrentView();
    }
  },

  t: function (key) {
    const lang = this.state.language || 'fr';
    return (this.translations[lang] && this.translations[lang][key]) || this.translations.fr[key] || key;
  },

  /**
   * Renders Dashboard KPIs and Recent Documents
   */
  renderDashboard: function () {
    const docs = this.state.documents;
    const biz = this.state.business;

    let paidTotal = 0;
    let pendingTotal = 0;
    let overdueTotal = 0;
    
    let totalInvoices = 0;
    let paidInvoicesCount = 0;
    let pendingInvoicesCount = 0;
    let overdueInvoicesCount = 0;

    docs.forEach(doc => {
      const docTotal = doc.total || 0;
      if (doc.type === 'invoice') {
        totalInvoices++;
        if (doc.status === 'paid') {
          paidTotal += docTotal;
          paidInvoicesCount++;
        } else if (doc.status === 'overdue') {
          overdueTotal += docTotal;
          overdueInvoicesCount++;
        } else if (doc.status === 'sent' || doc.status === 'viewed') {
          pendingTotal += docTotal;
          pendingInvoicesCount++;
        }
      }
    });

    const formatCurrency = (val) => {
      // Map display labels to valid ISO 4217 codes for Intl.NumberFormat
      const currencyMap = {
        'FCFA': 'XOF', 'XOF': 'XOF', 'XAF': 'XAF',
        'EUR': 'EUR', 'USD': 'USD', 'GBP': 'GBP', 'CAD': 'CAD',
        'CDF': 'CDF', 'GNF': 'GNF', 'MAD': 'MAD', 'TND': 'TND',
      };
      const rawCurrency = biz.currency || 'FCFA';
      const isoCurrency = currencyMap[rawCurrency] || null;
      if (isoCurrency) {
        try {
          return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: isoCurrency }).format(val);
        } catch (e) { /* fall through */ }
      }
      // Fallback: format number and append the label
      return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val) + ' ' + rawCurrency;
    };

    const greetingEl = document.getElementById('dash-greeting');
    if (greetingEl) {
      greetingEl.textContent = `Bonjour ${(biz.owner || 'Marc').split(' ')[0]},`;
    }
    
    const paidEl = document.getElementById('kpi-paid');
    if (paidEl) paidEl.textContent = formatCurrency(paidTotal);
    
    const totalInvEl = document.getElementById('kpi-total-invoices');
    if (totalInvEl) totalInvEl.textContent = totalInvoices;
    const paidInvEl = document.getElementById('kpi-paid-invoices');
    if (paidInvEl) paidInvEl.textContent = paidInvoicesCount;
    
    const pendCountEl = document.getElementById('kpi-pending-count');
    if (pendCountEl) pendCountEl.textContent = pendingInvoicesCount;
    const pendAmountEl = document.getElementById('kpi-pending-amount');
    if (pendAmountEl) pendAmountEl.textContent = formatCurrency(pendingTotal);
    
    const overCountEl = document.getElementById('kpi-overdue-count');
    if (overCountEl) overCountEl.textContent = overdueInvoicesCount;
    const overAmountEl = document.getElementById('kpi-overdue-amount');
    if (overAmountEl) overAmountEl.textContent = formatCurrency(overdueTotal);

    // Mini charts
    const chartRev = document.getElementById('chart-revenue');
    if (chartRev) chartRev.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none"><path d="M0,35 Q10,25 25,30 T50,20 T75,10 T100,5" fill="none" stroke="#60A5FA" stroke-width="3" stroke-linecap="round"/><path d="M0,35 Q10,25 25,30 T50,20 T75,10 T100,5 L100,40 L0,40 Z" fill="url(#gradRev)" opacity="0.2"/><defs><linearGradient id="gradRev" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#60A5FA"/><stop offset="100%" stop-color="#EFF6FF"/></linearGradient></defs></svg>`;
    
    const chartInv = document.getElementById('chart-invoices');
    if (chartInv) {
      chartInv.style.display = 'flex';
      chartInv.style.alignItems = 'flex-end';
      chartInv.style.justifyContent = 'space-between';
      chartInv.style.gap = '4px';
      chartInv.innerHTML = `
        <div style="width: 15%; height: 40%; background: #1E3A8A; border-radius: 4px 4px 0 0;"></div>
        <div style="width: 15%; height: 60%; background: #9CA3AF; border-radius: 4px 4px 0 0;"></div>
        <div style="width: 15%; height: 80%; background: #92400E; border-radius: 4px 4px 0 0;"></div>
        <div style="width: 15%; height: 100%; background: #1E3A8A; border-radius: 4px 4px 0 0;"></div>
        <div style="width: 15%; height: 50%; background: #E5E7EB; border-radius: 4px 4px 0 0;"></div>
        <div style="width: 15%; height: 30%; background: #E5E7EB; border-radius: 4px 4px 0 0;"></div>
      `;
    }

    const chartPend = document.getElementById('chart-pending');
    if (chartPend) {
      chartPend.style.display = 'flex';
      chartPend.style.alignItems = 'center';
      chartPend.style.justifyContent = 'center';
      chartPend.innerHTML = `
        <div style="width: 50px; height: 50px; border-radius: 50%; background: conic-gradient(#1E3A8A 0% 70%, #E5E7EB 70% 100%); position: relative;">
          <div style="position: absolute; top: 10px; left: 10px; right: 10px; bottom: 10px; background: #FFF; border-radius: 50%;"></div>
        </div>
      `;
    }

    const chartOver = document.getElementById('chart-overdue');
    if (chartOver) chartOver.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none"><path d="M0,35 Q20,30 40,35 T80,15 T100,5" fill="none" stroke="#92400E" stroke-width="3" stroke-linecap="round"/><path d="M0,35 Q20,30 40,35 T80,15 T100,5 L100,40 L0,40 Z" fill="url(#gradOver)" opacity="0.2"/><defs><linearGradient id="gradOver" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#92400E"/><stop offset="100%" stop-color="#FFFBEB"/></linearGradient></defs></svg>`;


    const tbody = document.getElementById('dashboard-recent-docs-tbody');
    if (tbody) {
      const recentInvoices = docs.filter(d => d.type === 'invoice').slice(0, 5);
      if (recentInvoices.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; padding: 2rem;">Aucune facture récente</td>
          </tr>
        `;
      } else {
        tbody.innerHTML = recentInvoices.map(doc => {
          let badgeClass = 'pending';
          let badgeText = 'En attente';
          if(doc.status === 'paid') { badgeClass = 'paid'; badgeText = 'Payée'; }
          else if(doc.status === 'overdue') { badgeClass = 'overdue'; badgeText = 'En retard'; }
          
          return `
            <tr>
              <td>${doc.number}</td>
              <td>${doc.clientName}</td>
              <td>${doc.date}</td>
              <td>${formatCurrency(doc.total || 0)}</td>
              <td style="text-align: right;"><span class="kivo-dash-badge ${badgeClass}">${badgeText}</span></td>
            </tr>
          `;
        }).join('');
      }
    }

    // Invoice Preview Widget
    const widget = document.getElementById('dash-invoice-widget');
    if (widget) {
      const lastInvoice = docs.find(d => d.type === 'invoice');
      if (!lastInvoice) {
        widget.innerHTML = `
          <div style="text-align: center; color: #9CA3AF; padding: 2rem; margin-top: 50%;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">📄</div>
            <div>Aucune facture disponible</div>
          </div>
        `;
      } else {
        const linesHtml = (lastInvoice.items || []).slice(0,3).map(i => `
          <tr>
            <td>${i.description}</td>
            <td style="text-align: center;">${i.quantity}</td>
            <td style="text-align: right;">${formatCurrency(i.amount)}</td>
          </tr>
        `).join('');

        widget.innerHTML = `
          <div class="kivo-dash-mock-paper">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="color: #111827; font-weight: 800; font-size: 1.25rem; font-family: var(--font-heading);">
                  <svg width="20" height="20" viewBox="0 0 32 32" fill="none" style="vertical-align: middle; margin-right: 4px;">
                    <path d="M7 6L14 16L7 26" stroke="#111827" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M16 6L23 16L16 26" stroke="#D1D5DB" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                  KIVO
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 700; font-size: 0.9rem;">FACTURE</div>
                <div style="color: #6B7280; font-size: 0.7rem;">${lastInvoice.number}</div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 1.5rem;">
              <div>
                <div style="color: #6B7280; font-size: 0.7rem; font-weight: 600;">Client</div>
                <div style="font-weight: 600;">${lastInvoice.clientName}</div>
              </div>
              <div style="text-align: right;">
                <div style="color: #6B7280; font-size: 0.7rem; font-weight: 600;">Date</div>
                <div style="font-weight: 600;">${lastInvoice.date}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align: center;">Qty</th>
                  <th style="text-align: right;">Montant</th>
                </tr>
              </thead>
              <tbody>
                ${linesHtml}
              </tbody>
            </table>

            <div style="margin-top: 1.5rem; border-top: 1px solid #E5E7EB; padding-top: 1rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                <span style="font-weight: 600;">Total</span>
                <span style="font-weight: 700;">${formatCurrency(lastInvoice.total || 0)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; color: #6B7280;">
                <span>Payment deals</span>
                <span>${formatCurrency(0)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; color: #6B7280;">
                <span>Status</span>
                <span>${lastInvoice.status === 'paid' ? 'Payée' : (lastInvoice.status === 'overdue' ? 'En retard' : 'En attente')}</span>
              </div>
            </div>

            <div style="text-align: center; margin-top: 2rem;">
              <div style="color: #6B7280; font-size: 0.65rem; margin-bottom: 0.5rem;">Facture info@kivo.com</div>
              ${lastInvoice.status === 'paid' ? `<div style="background: linear-gradient(to right, #92400E, #D97706); color: #FFF; padding: 0.5rem; border-radius: 6px; font-weight: 600; font-size: 0.75rem;">PAYÉE</div>` : `<div style="background: #111827; color: #FFF; padding: 0.5rem; border-radius: 6px; font-weight: 600; font-size: 0.75rem;">A PAYER</div>`}
            </div>
          </div>
        `;
      }
    }
  },

  /**
   * Draws dynamic SVG Revenue Chart
   */
  renderRevenueChart: function () {
    const container = document.getElementById('revenue-chart-container');
    if (!container) return;

    // Build last 9 months of revenue from paid invoices
    const now = new Date();
    const monthLabels = [];
    const dataPoints = [];

    for (let i = 8; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth(); // 0-indexed
      monthLabels.push(`${d.toLocaleString('fr-FR', { month: 'short' })} ${year}`);

      const monthRevenue = this.state.documents
        .filter(doc => {
          if (doc.type !== 'invoice') return false;
          if (doc.status !== 'paid') return false;
          if (!doc.issueDate) return false;
          const docDate = new Date(doc.issueDate);
          return docDate.getFullYear() === year && docDate.getMonth() === month;
        })
        .reduce((sum, doc) => sum + (doc.total || 0), 0);

      dataPoints.push(monthRevenue);
    }

    const max = Math.max(...dataPoints, 1); // avoid division by zero
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
            <stop offset="0%" stop-color="#2563EB" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#2563EB" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <polygon points="${areaPoints}" fill="url(#chartGradient)"/>
        <polyline points="${points}" fill="none" stroke="#2563EB" stroke-width="3" stroke-linecap="round"/>
        ${dataPoints.map((val, idx) => {
          const x = (idx / (dataPoints.length - 1)) * width;
          const y = height - (val / max) * (height - 30);
          const label = val > 0 ? `<title>${monthLabels[idx]}: ${val.toLocaleString('fr-FR')} FCFA</title>` : '';
          return `<circle cx="${x}" cy="${y}" r="4" fill="#FFFFFF" stroke="#2563EB" stroke-width="2">${label}</circle>`;
        }).join('')}
      </svg>
    `;
  },


  /**
   * Helper to format table row for documents with Edit, Refund, and Delete options
   */
  createDocTableRowHtml: function (doc) {
    const biz = this.state.business;
    const currencyStr = doc.currency || biz.currency || 'FCFA';

    const badgeClass = {
      paid: 'badge-paid',
      accepted: 'badge-accepted',
      overdue: 'badge-overdue',
      sent: 'badge-sent',
      viewed: 'badge-viewed',
      draft: 'badge-draft',
      cancelled: 'badge-cancelled',
      refunded: 'badge-overdue'
    }[doc.status] || 'badge-draft';

    const statusLabel = {
      paid: 'Payée ✓',
      accepted: 'Accepté ✓',
      overdue: 'En retard ⚠️',
      sent: 'Envoyée',
      viewed: 'Vue 👁️',
      draft: 'Brouillon',
      cancelled: 'Annulée',
      refunded: 'Remboursée ↩️'
    }[doc.status] || doc.status;

    return `
      <tr>
        <td><strong>${doc.number}</strong></td>
        <td>${doc.clientName || 'Client anonyme'} ${doc.clientType ? `<span style="font-size: 0.7rem; color: var(--text-muted);">(${doc.clientType})</span>` : ''}</td>
        <td><span class="badge ${doc.type === 'quote' ? 'badge-sent' : 'badge-draft'}">${doc.type === 'quote' ? 'Devis' : 'Facture'}</span></td>
        <td>${doc.issueDate}</td>
        <td><strong>${(doc.total || 0).toLocaleString('fr-FR')} ${currencyStr}</strong></td>
        <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
        <td style="text-align: right; display: flex; gap: 0.35rem; justify-content: flex-end;">
          <button class="btn btn-secondary btn-sm" onclick="KivoApp.viewPublicDoc('${doc.id}')" title="Voir l'aperçu">👁️</button>
          <button class="btn btn-secondary btn-sm" onclick="KivoApp.editDocument('${doc.id}')" title="Modifier la facture">✏️</button>
          <button class="btn btn-whatsapp btn-sm" onclick="KivoApp.shareOnWhatsApp('${doc.id}')" title="Partager WhatsApp">💬</button>
          ${doc.status === 'paid' ? `<button class="btn btn-secondary btn-sm" style="color: var(--danger-text);" onclick="KivoApp.refundInvoice('${doc.id}')" title="Rembourser la facture">↩️</button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="KivoApp.confirmDeleteDocument('${doc.id}')" title="Supprimer">🗑️</button>
        </td>
      </tr>
    `;
  },

  /**
   * Renders Master Documents Table
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

    tbody.innerHTML = docs.map(doc => this.createDocTableRowHtml(doc)).join('');
  },

  /**
   * Opens New Document Choice Modal
   * Guard: do not open if app state is not ready (user not fully loaded)
   */
  openNewDocModal: function () {
    if (!this.state || !this.state.business) {
      this.showToast("Chargement en cours... Veuillez patienter.", "info");
      return;
    }
    if (!this.state.isOnboarded) {
      this.showToast("Veuillez déabord vous connecter pour créer une facture.", "info");
      return;
    }
    this.openModal('modal-new-doc-choice');
  },

  /**
   * Generates auto sequential document number
   * Guard: returns safe fallback if state or business is null
   */
  generateDocumentNumber: function (type = 'invoice') {
    if (!this.state || !this.state.business) {
      const year = new Date().getFullYear();
      return type === 'quote' ? `DEV-${year}-0001` : `FAC-${year}-0001`;
    }
    const biz = this.state.business;
    if (type === 'quote') {
      const prefix = biz.quotePrefix || `DEV-${new Date().getFullYear()}-`;
      const num = biz.nextQuoteNumber || (1001 + (this.state.documents || []).filter(d => d.type === 'quote').length);
      return `${prefix}${String(num).padStart(4, '0')}`;
    } else {
      const prefix = biz.invoicePrefix || `FAC-${new Date().getFullYear()}-`;
      const num = biz.nextInvoiceNumber || (1001 + (this.state.documents || []).filter(d => d.type === 'invoice').length);
      return `${prefix}${String(num).padStart(4, '0')}`;
    }
  },

  /**
   * Starts Document Creation Flow
   * Guard: abort with toast if state or business not loaded yet
   */
  startNewDocument: function (type = 'invoice') {
    this.closeModal('modal-new-doc-choice');

    if (!this.state || !this.state.business) {
      this.showToast("Données non chargées. Veuillez patienter ou actualiser.", "error");
      return;
    }

    const nextNum = this.generateDocumentNumber(type);
    const today = new Date().toISOString().split('T')[0];
    const dueObj = new Date();
    dueObj.setDate(dueObj.getDate() + 7);
    const dueStr = dueObj.toISOString().split('T')[0];

    document.getElementById('builder-title').textContent = type === 'quote' ? 'Nouveau Devis' : 'Nouvelle Facture';
    document.getElementById('builder-doc-id').value = '';
    document.getElementById('builder-doc-type').value = type;
    document.getElementById('builder-doc-number').value = nextNum;
    document.getElementById('builder-issue-date').value = today;
    document.getElementById('builder-due-date').value = dueStr;
    document.getElementById('builder-doc-status').value = 'sent';
    document.getElementById('builder-input-tax').value = (this.state.business && this.state.business.defaultVatRate) || 18;
    document.getElementById('builder-input-discount').value = 0;
    document.getElementById('builder-notes').value = "Merci pour votre confiance.";
    document.getElementById('builder-terms').value = "Paiement à réception par Carte bancaire (Stripe) ou Mobile Money.";

    const clientSelect = document.getElementById('builder-doc-client-select');
    const clients = (this.state && this.state.clients) || [];
    if (clients.length === 0) {
      clientSelect.innerHTML = `<option value="">-- Aucun client (Créez un client) --</option>`;
    } else {
      clientSelect.innerHTML = clients.map(c =>
        `<option value="${c.id}">${c.name} (${c.company || c.contactName || 'Particulier'})</option>`
      ).join('');
    }

    const tbody = document.getElementById('builder-items-tbody');
    tbody.innerHTML = '';
    this.addBuilderLineItem('Prestation de service / Design & Développement', 1, 150000);

    this.recalculateBuilderTotals();
    this.updateLiveInvoicePreview();
    this.navigate('document-builder');
  },

  /**
   * Loads an existing document into the editor for modifying
   */
  editDocument: function (docId) {
    const doc = this.state.documents.find(d => d.id === docId);
    if (!doc) return;

    document.getElementById('builder-title').textContent = `Modifier ${doc.type === 'quote' ? 'le Devis' : 'la Facture'} #${doc.number}`;
    document.getElementById('builder-doc-id').value = doc.id;
    document.getElementById('builder-doc-type').value = doc.type || 'invoice';
    document.getElementById('builder-doc-number').value = doc.number;
    document.getElementById('builder-doc-currency').value = doc.currency || this.state.business.currency || 'FCFA';
    document.getElementById('builder-issue-date').value = doc.issueDate || new Date().toISOString().split('T')[0];
    document.getElementById('builder-due-date').value = doc.dueDate || new Date().toISOString().split('T')[0];
    document.getElementById('builder-doc-status').value = doc.status || 'sent';
    document.getElementById('builder-input-tax').value = doc.taxRate !== undefined ? doc.taxRate : (this.state.business.defaultVatRate || 18);
    document.getElementById('builder-input-discount').value = doc.discount || 0;
    document.getElementById('builder-notes').value = doc.notes || '';
    document.getElementById('builder-terms').value = doc.terms || '';

    const clientSelect = document.getElementById('builder-doc-client-select');
    clientSelect.innerHTML = this.state.clients.map(c => `
      <option value="${c.id}" ${c.id === doc.clientId ? 'selected' : ''}>${c.name} (${c.company || c.contactName || 'Particulier'})</option>
    `).join('');

    const tbody = document.getElementById('builder-items-tbody');
    tbody.innerHTML = '';

    if (doc.items && doc.items.length > 0) {
      doc.items.forEach(it => {
        this.addBuilderLineItem(it.name, it.quantity, it.price);
      });
    } else {
      this.addBuilderLineItem('Prestation de service', 1, doc.subtotal || doc.total || 50000);
    }

    this.recalculateBuilderTotals();
    this.updateLiveInvoicePreview();
    this.navigate('document-builder');
  },

  /**
   * Adds a line item row in builder
   */
  addBuilderLineItem: function (name = '', qty = 1, price = 0) {
    const tbody = document.getElementById('builder-items-tbody');
    if (!tbody) return;

    const rowId = 'row_' + Math.random().toString(36).substring(2, 7);
    const tr = document.createElement('tr');
    tr.id = rowId;

    tr.innerHTML = `
      <td>
        <input type="text" class="form-input item-name" value="${name}" placeholder="Description de l'article ou service" oninput="KivoApp.updateLiveInvoicePreview()">
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
   * Recalculates Subtotal HT, VAT amount, and Total TTC in builder
   */
  recalculateBuilderTotals: function () {
    let subtotal = 0;
    const currency = document.getElementById('builder-doc-currency') ? document.getElementById('builder-doc-currency').value : (this.state.business.currency || 'FCFA');

    document.querySelectorAll('#builder-items-tbody tr').forEach(tr => {
      const qty = parseFloat(tr.querySelector('.item-qty').value) || 0;
      const price = parseFloat(tr.querySelector('.item-price').value) || 0;
      const rowTotal = qty * price;
      tr.querySelector('.item-total-display').textContent = rowTotal.toLocaleString('fr-FR') + ' ' + currency;
      subtotal += rowTotal;
    });

    const discount = parseFloat(document.getElementById('builder-input-discount').value) || 0;
    const taxRate = parseFloat(document.getElementById('builder-input-tax').value) || 0;

    const taxableAmount = Math.max(0, subtotal - discount);
    const taxAmount = taxableAmount * (taxRate / 100);
    const grandTotal = Math.max(0, taxableAmount + taxAmount);

    document.getElementById('builder-calc-subtotal').textContent = subtotal.toLocaleString('fr-FR') + ' ' + currency;
    document.getElementById('builder-calc-tax-amount').textContent = taxAmount.toLocaleString('fr-FR') + ' ' + currency;
    document.getElementById('builder-calc-total').textContent = grandTotal.toLocaleString('fr-FR') + ' ' + currency;

    this.updateLiveInvoicePreview();
  },

  /**
   * Updates Live Paper Invoice Preview in Real-Time
   */
  updateLiveInvoicePreview: function () {
    const tInput = document.getElementById('builder-visual-template');
    const templateId = tInput ? tInput.value : 'classic';
    const container = document.getElementById('live-paper-preview-container');

    // Store the original CSS-based HTML structure
    if (!this._originalPaperHtml && container) {
      this._originalPaperHtml = container.innerHTML;
    }

    // Check if we use the new HTML-based template engine
    if (window.KivoTemplates && window.KivoTemplates.isFullHtml(templateId)) {
      if (container) {
        const data = window.KivoTemplates.collectData(this.state);
        container.innerHTML = window.KivoTemplates.render(templateId, data);
        container.dataset.templateId = templateId;
      }
      this.updateDocumentPreviewVisuals(); // Update CSS vars just in case
      return; // Skip standard manual DOM update
    } else {
      // Restore standard structure if we were previously using an HTML template
      if (container && container.dataset.templateId && window.KivoTemplates && window.KivoTemplates.isFullHtml(container.dataset.templateId)) {
        container.innerHTML = this._originalPaperHtml;
        container.dataset.templateId = '';
      }
    }

    const biz = this.state.business;
    const docType = document.getElementById('builder-doc-type') ? document.getElementById('builder-doc-type').value : 'invoice';
    const docNum = document.getElementById('builder-doc-number') ? document.getElementById('builder-doc-number').value : 'FAC-2026-0001';
    const currency = document.getElementById('builder-doc-currency') ? document.getElementById('builder-doc-currency').value : (biz.currency || 'FCFA');
    const issueDate = document.getElementById('builder-issue-date') ? document.getElementById('builder-issue-date').value : '';
    const dueDate = document.getElementById('builder-due-date') ? document.getElementById('builder-due-date').value : '';
    const status = document.getElementById('builder-doc-status') ? document.getElementById('builder-doc-status').value : 'sent';
    const notes = document.getElementById('builder-notes') ? document.getElementById('builder-notes').value : '';
    const terms = document.getElementById('builder-terms') ? document.getElementById('builder-terms').value : '';

    const clientId = document.getElementById('builder-doc-client-select') ? document.getElementById('builder-doc-client-select').value : '';
    const client = this.state.clients.find(c => c.id === clientId) || { name: 'Client Destinataire', company: '', contactName: '', phone: '', address: '' };

    // Update Paper Header
    const logoEl = document.getElementById('paper-logo-display');
    if (logoEl) {
      if (biz.logoUrl) {
        logoEl.style.overflow = 'hidden';
        logoEl.style.background = '#FFFFFF';
        logoEl.innerHTML = `<img src="${biz.logoUrl}" alt="Logo" style="max-height: 100%; max-width: 100%; object-fit: contain;">`;
      } else {
        const initiales = biz.name ? biz.name.substring(0, 2).toUpperCase() : "KM";
        logoEl.innerHTML = biz.logoText || initiales;
      }
    }

    const bizNameEl = document.getElementById('paper-biz-name');
    if (bizNameEl) bizNameEl.textContent = biz.name || "KIVO MATIQUE";

    const bizAddrEl = document.getElementById('paper-biz-address');
    if (bizAddrEl) bizAddrEl.textContent = biz.address || "Avenue Cheikh Anta Diop, Dakar";

    const bizTaxEl = document.getElementById('paper-biz-taxid');
    if (bizTaxEl) bizTaxEl.textContent = biz.taxId ? `Tax ID: ${biz.taxId}` : '';

    const paperDocTypeEl = document.getElementById('paper-doc-type');
    if (paperDocTypeEl) paperDocTypeEl.textContent = docType === 'quote' ? 'DEVIS' : 'FACTURE';

    const paperDocNumEl = document.getElementById('paper-doc-number');
    if (paperDocNumEl) paperDocNumEl.textContent = docNum;

    const paperIssueEl = document.getElementById('paper-date-issue');
    if (paperIssueEl) paperIssueEl.textContent = issueDate || '--/--/----';

    const paperDueEl = document.getElementById('paper-date-due');
    if (paperDueEl) paperDueEl.textContent = dueDate || '--/--/----';

    // Update Sender & Client Details
    const senderDetailsEl = document.getElementById('paper-sender-details');
    if (senderDetailsEl) {
      senderDetailsEl.innerHTML = `
        <strong>${biz.name || 'KIVO MATIQUE'}</strong><br>
        ${biz.phone ? `Tél: ${biz.phone}<br>` : ''}
        ${biz.email ? `Email: ${biz.email}` : ''}
      `;
    }

    const clientDetailsEl = document.getElementById('paper-client-details');
    if (clientDetailsEl) {
      clientDetailsEl.innerHTML = `
        <strong>${client.name}</strong> ${client.clientType ? `(${client.clientType})` : ''}<br>
        ${client.company ? `${client.company}<br>` : ''}
        ${client.contactName ? `Attn: ${client.contactName}<br>` : ''}
        ${client.taxId ? `SIRET/NINEA: ${client.taxId}<br>` : ''}
        ${client.phone ? `Tél: ${client.phone}` : ''}
      `;
    }

    // Render Items Table
    const paperItemsTbody = document.getElementById('paper-items-tbody');
    if (paperItemsTbody) {
      const rows = [];
      let subtotal = 0;

      document.querySelectorAll('#builder-items-tbody tr').forEach(tr => {
        const nameInput = tr.querySelector('.item-name');
        const qtyInput = tr.querySelector('.item-qty');
        const priceInput = tr.querySelector('.item-price');

        const name = nameInput ? nameInput.value : '';
        const qty = parseFloat(qtyInput ? qtyInput.value : 1) || 1;
        const price = parseFloat(priceInput ? priceInput.value : 0) || 0;
        const total = qty * price;

        if (name) {
          subtotal += total;
          rows.push(`
            <tr>
              <td><strong>${name}</strong></td>
              <td style="text-align: center;">${qty}</td>
              <td style="text-align: right;">${price.toLocaleString('fr-FR')} ${currency}</td>
              <td style="text-align: right;"><strong>${total.toLocaleString('fr-FR')} ${currency}</strong></td>
            </tr>
          `);
        }
      });

      if (rows.length === 0) {
        paperItemsTbody.innerHTML = `<tr><td colspan="4" style="color: var(--text-muted); text-align: center;">Saisissez au moins un article...</td></tr>`;
      } else {
        paperItemsTbody.innerHTML = rows.join('');
      }

      const discount = parseFloat(document.getElementById('builder-input-discount') ? document.getElementById('builder-input-discount').value : 0) || 0;
      const taxRate = parseFloat(document.getElementById('builder-input-tax') ? document.getElementById('builder-input-tax').value : 18) || 0;

      const taxable = Math.max(0, subtotal - discount);
      const taxAmount = taxable * (taxRate / 100);
      const grandTotal = Math.max(0, taxable + taxAmount);

      document.getElementById('paper-subtotal').textContent = subtotal.toLocaleString('fr-FR') + ' ' + currency;
      document.getElementById('paper-tax-rate').textContent = taxRate;
      document.getElementById('paper-tax-amount').textContent = taxAmount.toLocaleString('fr-FR') + ' ' + currency;
      document.getElementById('paper-grand-total').textContent = grandTotal.toLocaleString('fr-FR') + ' ' + currency;

      const discRow = document.getElementById('paper-discount-row');
      if (discRow) {
        if (discount > 0) {
          discRow.style.display = 'flex';
          document.getElementById('paper-discount-amount').textContent = '-' + discount.toLocaleString('fr-FR') + ' ' + currency;
        } else {
          discRow.style.display = 'none';
        }
      }
    }

    // Terms text
    const termsEl = document.getElementById('paper-terms-text');
    if (termsEl) termsEl.textContent = terms || notes || "Paiement à réception par Carte bancaire (Stripe) ou Mobile Money.";

    // Stamp watermark
    const watermarkEl = document.getElementById('paper-watermark-stamp');
    if (watermarkEl) {
      if (status === 'paid') {
        watermarkEl.style.display = 'block';
        watermarkEl.textContent = 'PAYÉE';
        watermarkEl.style.color = '#10B981';
      } else if (status === 'refunded') {
        watermarkEl.style.display = 'block';
        watermarkEl.textContent = 'REMBOURSÉE';
        watermarkEl.style.color = '#EF4444';
      } else {
        watermarkEl.style.display = 'none';
      }
    }

    this.updateDocumentPreviewVisuals(); // Apply themes
  },

  /**
   * Share live document from builder on WhatsApp
   */
  shareCurrentBuilderWhatsApp: function () {
    const docNum = document.getElementById('builder-doc-number').value;
    const clientId = document.getElementById('builder-doc-client-select').value;
    const client = this.state.clients.find(c => c.id === clientId) || { name: 'Client', phone: '' };
    const currency = document.getElementById('builder-doc-currency').value;
    const grandTotal = document.getElementById('builder-calc-total').textContent;

    const msg = `Bonjour ${client.name} 👋,\n\nVoici le document *${docNum}* d'un montant de *${grandTotal}* émis par *${this.state.business.name}*.\n\nN'hésitez pas si vous avez des questions !\nKIVO MATIQUE`;
    const url = window.WhatsAppHelper.getWhatsAppWebUrl(client.phone, msg);
    window.open(url, '_blank');
  },

  // ── TEMPLATES GALLERY LOGIC ──────────────────────────────────────────

  switchDocCreationTab: function (tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('active');
      b.style.color = 'var(--text-secondary)';
      b.style.borderBottomColor = 'transparent';
    });
    const activeBtn = document.getElementById('tab-btn-' + tabId);
    if (activeBtn) {
      activeBtn.classList.add('active');
      activeBtn.style.color = 'var(--primary)';
      activeBtn.style.borderBottomColor = 'var(--primary)';
    }

    document.getElementById('tab-content-templates').style.display = 'none';
    document.getElementById('tab-content-free').style.display = 'none';
    document.getElementById('tab-content-ai').style.display = 'none';
    
    document.getElementById('tab-content-' + tabId).style.display = 'block';

    if (tabId === 'templates') {
      this.renderTemplateGallery();
    }
  },

  renderTemplateGallery: function () {
    if (!window.KivoTemplates) return;
    const gallery = document.getElementById('gallery-built-in');
    const docType = document.getElementById('gallery-doc-type').value; // 'invoice' or 'quote'
    
    // Inject all templates in select options (for builder)
    const selectEl = document.getElementById('builder-visual-template');
    if (selectEl && selectEl.options.length <= 6) {
      selectEl.innerHTML = window.KivoTemplates.builtIn.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    }

    if (!gallery) return;
    gallery.innerHTML = window.KivoTemplates.builtIn.map(t => `
      <div class="card hover-fx" style="cursor:pointer; padding:0.75rem;" onclick="KivoApp.startTemplateDocument('${docType}', '${t.id}')">
        ${window.KivoTemplates.miniPreview(t.id, this.state.business?.primaryColor)}
        <div style="font-weight:600; font-size:0.9rem; margin-top:0.5rem;">${t.name}</div>
        <div style="font-size:0.7rem; color:var(--text-secondary);">${t.desc}</div>
      </div>
    `).join('');

    // Custom templates
    const cGallery = document.getElementById('gallery-custom');
    if (cGallery) {
      const customs = this.state.business?.customTemplates || [];
      if (customs.length === 0) {
        cGallery.innerHTML = `<div style="color:var(--text-muted); font-size:0.8rem; padding:1rem; grid-column:1/-1;">Aucun modèle sauvegardé.</div>`;
      } else {
        cGallery.innerHTML = customs.map((t, idx) => `
          <div class="card hover-fx" style="cursor:pointer; padding:0.75rem; position:relative;" onclick="KivoApp.startTemplateDocument('${docType}', '${t.id}', true)">
            ${window.KivoTemplates.miniPreview(t.id, t.primaryColor)}
            <div style="font-weight:600; font-size:0.9rem; margin-top:0.5rem;">${t.name}</div>
            <button class="btn btn-sm" style="position:absolute; top:4px; right:4px; padding:2px 6px; background:rgba(0,0,0,0.5); color:white; border:none; border-radius:4px;" onclick="event.stopPropagation(); KivoApp.deleteCustomTemplate(${idx})">🗑️</button>
          </div>
        `).join('');
      }
    }
  },

  startTemplateDocument: function (type, templateId, isCustom = false) {
    this.closeModal('modal-new-doc-choice');
    this.startNewDocument(type); // Reset builder
    
    setTimeout(() => {
      if (isCustom) {
        const customs = this.state.business?.customTemplates || [];
        const t = customs.find(c => c.id === templateId);
        if (t) {
           document.getElementById('builder-color-primary').value = t.primaryColor || '#4F46E5';
           document.getElementById('builder-color-secondary').value = t.secondaryColor || '#6366F1';
           document.getElementById('builder-visual-template').value = t.baseTemplateId || templateId;
        }
      } else {
        const selectEl = document.getElementById('builder-visual-template');
        if (selectEl) selectEl.value = templateId;
      }
      this.updateLiveInvoicePreview();
    }, 100);
  },

  startFreeDocument: function (type) {
    this.closeModal('modal-new-doc-choice');
    this.startNewDocument(type);
  },

  startWithAI: async function () {
    const prompt = document.getElementById('ai-mode-prompt').value;
    const type = document.getElementById('ai-mode-doc-type').value;
    if (!prompt.trim()) {
      alert("Veuillez décrire votre document.");
      return;
    }
    
    const btn = document.querySelector('.btn-ai');
    btn.disabled = true;
    btn.innerHTML = `<div class="loading-spinner"></div> Génération en cours...`;

    try {
      this.closeModal('modal-new-doc-choice');
      this.startNewDocument(type);
      
      // Pass the prompt directly to the AI Assistant logic if available
      if (window.KivoAI) {
         // Fake call or redirect to AI processor. KivoAI will handle DOM.
         // KivoAI.generateDocument(prompt, type);
         console.log("AI Generation called with:", prompt);
         // Simulate typing in the actual AI modal for now to use existing system
         setTimeout(() => {
           this.openAIAssistantModal();
           document.getElementById('ai-input-prompt').value = `Générer un ${type} : ${prompt}`;
           if (window.KivoAI.parseTextToInvoice) window.KivoAI.parseTextToInvoice();
         }, 500);
      }
    } finally {
      btn.disabled = false;
      btn.innerHTML = `Générer la structure ✨`;
      document.getElementById('ai-mode-prompt').value = '';
    }
  },

  saveAsTemplate: async function () {
    const templateId = document.getElementById('builder-visual-template').value;
    const name = prompt("Nom du modèle personnalisé :");
    if (!name) return;

    const custom = {
      id: 'custom-' + Date.now(),
      name: name,
      baseTemplateId: templateId,
      primaryColor: document.getElementById('builder-color-primary').value,
      secondaryColor: document.getElementById('builder-color-secondary').value
    };

    const biz = this.state.business;
    if (!biz.customTemplates) biz.customTemplates = [];
    biz.customTemplates.push(custom);

    try {
      if (window._kivoClient) {
        const { error } = await window._kivoClient.from('business_settings').update({
          custom_templates: biz.customTemplates
        }).eq('id', biz.id);
        
        if (error) throw error;
      }
      this.showToast("Modèle sauvegardé avec succès !", "success");
    } catch (e) {
      console.error(e);
      this.showToast("Erreur lors de la sauvegarde du modèle.", "error");
    }
  },

  deleteCustomTemplate: async function (idx) {
    if (!confirm("Supprimer ce modèle personnalisé ?")) return;
    const biz = this.state.business;
    if (!biz.customTemplates) return;
    
    biz.customTemplates.splice(idx, 1);
    
    try {
      if (window._kivoClient) {
        await window._kivoClient.from('business_settings').update({
          custom_templates: biz.customTemplates
        }).eq('id', biz.id);
      }
      this.renderTemplateGallery();
      this.showToast("Modèle supprimé.", "success");
    } catch (e) {
      console.error(e);
    }
  },

  // ─────────────────────────────────────────────────────────────────────

  /**
   * Triggers KIVO AI Parser inside document builder

   */
  triggerBuilderAiParse: function () {
    const input = document.getElementById('builder-ai-input').value;
    if (!input || input.trim().length === 0) {
      this.showToast("Veuillez saisir une description de votre besoin.", "error");
      return;
    }

    const defaultCurrency = document.getElementById('builder-doc-currency') ? document.getElementById('builder-doc-currency').value : 'FCFA';
    const defaultTaxRate = parseFloat(document.getElementById('builder-input-tax') ? document.getElementById('builder-input-tax').value : 18) || 18;

    const parsed = window.KivoAI.parseTextToDocument(input, this.state.clients, defaultCurrency, defaultTaxRate);
    if (parsed) {
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

      if (parsed.taxRate !== undefined) {
        document.getElementById('builder-input-tax').value = parsed.taxRate;
      }

      this.recalculateBuilderTotals();
      this.showToast("✨ KIVO MATIQUE AI : Formulaire complété avec succès !", "success");
    }
  },

  /**
   * Saves Document from Builder into State
   */
  saveDocumentFromBuilder: function () {
    const existingDocId = document.getElementById('builder-doc-id').value;
    const type = document.getElementById('builder-doc-type').value;

    // Enforce Free Tier limit of 3 invoices per month
    if (type === 'invoice' && this.state.business.subscriptionTier === 'Gratuit' && !existingDocId) {
      const currentMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"
      const monthlyInvoices = this.state.documents.filter(d => 
        d.type === 'invoice' && 
        d.issueDate && 
        d.issueDate.startsWith(currentMonth)
      );
      if (monthlyInvoices.length >= 3) {
        this.showToast("⚠️ Limite atteinte : Le forfait Gratuit est limité à 3 factures par mois. Veuillez passer au forfait PRO.", "danger");
        this.navigate('settings');
        return;
      }
    }

    const num = document.getElementById('builder-doc-number').value;
    const currency = document.getElementById('builder-doc-currency').value;
    const clientId = document.getElementById('builder-doc-client-select').value;
    const clientObj = this.state.clients.find(c => c.id === clientId) || { id: 'cli_anon', name: 'Client Anonyme', email: '', phone: '', clientType: 'B2C' };
    const issueDate = document.getElementById('builder-issue-date').value;
    const dueDate = document.getElementById('builder-due-date').value;
    const status = document.getElementById('builder-doc-status').value;
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
    const taxable = Math.max(0, subtotal - discount);
    const taxAmount = taxable * (taxRate / 100);
    const grandTotal = Math.max(0, taxable + taxAmount);

    const docId = existingDocId || ('doc_' + Math.random().toString(36).substring(2, 8));

    const docObj = {
      id: docId,
      number: num,
      type: type,
      status: status,
      currency: currency,
      clientId: clientObj.id,
      clientName: clientObj.name,
      clientType: clientObj.clientType || 'B2C',
      clientTaxId: clientObj.taxId || '',
      clientEmail: clientObj.email || '',
      clientPhone: clientObj.phone || '',
      issueDate: issueDate,
      dueDate: dueDate,
      items: items,
      subtotal: subtotal,
      discount: discount,
      taxRate: taxRate,
      tax: taxAmount,
      total: grandTotal,
      amountPaid: status === 'paid' ? grandTotal : 0,
      notes: notes,
      terms: terms,
      publicToken: 'tok_' + Math.random().toString(36).substring(2, 8),
      viewsCount: 1,
      lastViewedAt: new Date().toLocaleString('fr-FR')
    };

    if (existingDocId) {
      const idx = this.state.documents.findIndex(d => d.id === existingDocId);
      if (idx !== -1) {
        this.state.documents[idx] = docObj;
      } else {
        this.state.documents.unshift(docObj);
      }
    } else {
      this.state.documents.unshift(docObj);

      // Increment document numbering counter in business settings
      if (type === 'quote') {
        this.state.business.nextQuoteNumber = (this.state.business.nextQuoteNumber || 1001) + 1;
      } else {
        this.state.business.nextInvoiceNumber = (this.state.business.nextInvoiceNumber || 1001) + 1;
      }
    }

    this.state.activities.unshift({
      id: 'act_' + Date.now(),
      timestamp: "À l'instant",
      type: type === 'quote' ? 'quote_created' : 'invoice_sent',
      icon: 'file-text',
      title: `${type === 'quote' ? 'Devis' : 'Facture'} #${num} ${existingDocId ? 'mis à jour' : 'enregistré(e)'}`,
      details: `${clientObj.name} (${grandTotal.toLocaleString('fr-FR')} ${currency})`
    });

    this.saveState();

    // Sync to Supabase
    if (window.KivoDb && this.supabaseConnected) {
      window.KivoDb.saveDocument({
        id: docObj.id,
        number: docObj.number,
        type: docObj.type,
        status: docObj.status,
        currency: docObj.currency,
        client_id: docObj.clientId !== 'cli_anon' ? docObj.clientId : null,
        issue_date: docObj.issueDate,
        date_due: docObj.dueDate,
        items: docObj.items,
        subtotal: docObj.subtotal,
        discount: docObj.discount,
        tax_amount: docObj.tax,
        total: docObj.total,
        amount_paid: docObj.amountPaid || 0,
        notes: docObj.notes,
        conditions: docObj.terms
      }).catch(e => console.error('[KivoApp] Supabase saveDocument error:', e));
    }

    this.showToast(`Document ${num} enregistré avec succès !`, "success");
    this.viewPublicDoc(docId);
  },

  /**
   * Triggers Refund for a Paid Invoice
   */
  refundInvoice: function (docId) {
    const doc = this.state.documents.find(d => d.id === docId);
    if (!doc) return;

    if (confirm(`Voulez-vous vraiment rembourser la facture ${doc.number} (${doc.total.toLocaleString('fr-FR')} ${doc.currency || 'FCFA'}) ?`)) {
      window.PaymentProvider.processRefund(doc, "Remboursement demandé par le client", () => {
        this.showToast(`Facture ${doc.number} remboursée avec succès.`, "success");
        this.renderCurrentView();
      });
    }
  },

  /**
   * Confirmation modal trigger for destructive operations
   */
  confirmAction: function (title, message, actionCallback) {
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-message').textContent = message;
    
    const actionBtn = document.getElementById('confirm-modal-action-btn');
    const newBtn = actionBtn.cloneNode(true);
    actionBtn.parentNode.replaceChild(newBtn, actionBtn);

    newBtn.addEventListener('click', () => {
      this.closeModal('modal-confirm-delete');
      if (typeof actionCallback === 'function') {
        actionCallback();
      }
    });

    this.openModal('modal-confirm-delete');
  },

  confirmDeleteDocument: function (docId) {
    const doc = this.state.documents.find(d => d.id === docId);
    const num = doc ? doc.number : 'ce document';
    
    this.confirmAction(
      "Confirmer la suppression",
      `Êtes-vous sûr de vouloir supprimer définitivement le document #${num} ?`,
      () => {
        this.state.documents = this.state.documents.filter(d => d.id !== docId);
        this.saveState();
        if (window.KivoDb && this.supabaseConnected) {
          window.KivoDb.deleteDocument(docId).catch(e => console.error(e));
        }
        this.showToast(`Document ${num} supprimé.`, "info");
        this.renderCurrentView();
      }
    );
  },

  confirmDeleteClient: function (clientId) {
    const cli = this.state.clients.find(c => c.id === clientId);
    const name = cli ? cli.name : 'ce client';

    this.confirmAction(
      "Supprimer le client",
      `Voulez-vous vraiment supprimer le client ${name} ?`,
      () => {
        this.state.clients = this.state.clients.filter(c => c.id !== clientId);
        this.saveState();
        if (window.KivoDb && this.supabaseConnected) {
          window.KivoDb.deleteClient(clientId).catch(e => console.error(e));
        }
        this.showToast(`Client ${name} supprimé.`, "info");
        this.renderClients();
      }
    );
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
  renderPublicDocView: async function () {
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const docId = urlParams.get('id');
    
    if (!docId) {
      console.warn('[KivoApp] renderPublicDocView: No document ID provided.');
      return;
    }

    let doc = this.state.documents.find(d => d.id === docId);
    let biz = this.state.business;

    if (!doc && this.supabaseConnected) {
      try {
        console.log('[KivoApp] Loading document from cloud database (id:', docId, ')');
        const { data: cloudDoc, error: docErr } = await KivoDb.supabase
          .from('documents')
          .select('*')
          .match({ id: docId })
          .maybeSingle();

        if (docErr) throw docErr;
        if (!cloudDoc) {
          this.showToast("⚠️ Ce document n'existe pas ou a été supprimé.", "danger");
          return;
        }

        doc = {
          id: cloudDoc.id,
          number: cloudDoc.number,
          type: cloudDoc.type,
          status: cloudDoc.status,
          currency: cloudDoc.currency,
          clientId: cloudDoc.client_id,
          clientName: cloudDoc.client_name || 'Client Destinataire',
          clientType: cloudDoc.client_type || 'B2C',
          clientTaxId: cloudDoc.client_tax_id || '',
          clientEmail: cloudDoc.client_email || '',
          clientPhone: cloudDoc.client_phone || '',
          issueDate: cloudDoc.issue_date,
          dueDate: cloudDoc.due_date,
          items: typeof cloudDoc.items === 'string' ? JSON.parse(cloudDoc.items) : (cloudDoc.items || []),
          subtotal: parseFloat(cloudDoc.subtotal) || 0,
          discount: parseFloat(cloudDoc.discount) || 0,
          taxRate: parseFloat(cloudDoc.tax_rate) || 0,
          tax: parseFloat(cloudDoc.tax_amount) || 0,
          total: parseFloat(cloudDoc.total) || 0,
          amountPaid: parseFloat(cloudDoc.amount_paid) || 0,
          notes: cloudDoc.notes || '',
          terms: cloudDoc.conditions || '',
          viewsCount: cloudDoc.views_count || 0
        };

        if (cloudDoc.user_id) {
          const { data: cloudBiz, error: bizErr } = await KivoDb.supabase
            .from('business_settings')
            .select('*')
            .match({ user_id: cloudDoc.user_id })
            .maybeSingle();

          if (!bizErr && cloudBiz) {
            biz = {
              name: cloudBiz.company_name || 'KIVO MATIQUE',
              owner: cloudBiz.owner || '',
              email: cloudBiz.email || '',
              phone: cloudBiz.phone || '',
              address: cloudBiz.address || '',
              website: cloudBiz.website || '',
              taxId: cloudBiz.fiscal_id || '',
              currency: cloudBiz.currency || 'FCFA',
              logoUrl: cloudBiz.logo_url || '',
              logoText: cloudBiz.company_name ? cloudBiz.company_name.substring(0, 2).toUpperCase() : 'KM',
              visualTemplate: cloudBiz.visual_template || 'classic',
              primaryColor: cloudBiz.primary_color || '#0F172A',
              secondaryColor: cloudBiz.secondary_color || '#64748B'
            };
          }
        }
      } catch (e) {
        console.error('[KivoApp] Public load error:', e);
        this.showToast("❌ Erreur de chargement du document.", "danger");
        return;
      }
    }

    if (!doc) {
      this.showToast("⚠️ Document non trouvé.", "danger");
      return;
    }

    const currencyStr = doc.currency || biz.currency || 'FCFA';

    // Increment document view count asynchronously in the cloud
    if (this.supabaseConnected && (!window.KivoAuth || !window.KivoAuth.user || window.KivoAuth.user.id !== doc.userId)) {
      const newViews = (doc.viewsCount || 0) + 1;
      const newStatus = doc.status === 'sent' ? 'viewed' : doc.status;
      
      const localDoc = this.state.documents.find(d => d.id === docId);
      if (localDoc) {
        localDoc.viewsCount = newViews;
        localDoc.status = newStatus;
        this.saveState();
      }
      
      KivoDb.supabase.from('documents')
        .update({ views_count: newViews, status: newStatus })
        .match({ id: doc.id })
        .catch(e => console.error('[KivoApp] Failed to update views_count:', e));
    }

    const pubLogoEl = document.getElementById('pub-business-logo');
    if (pubLogoEl) {
      if (biz.logoUrl) {
        pubLogoEl.style.overflow = 'hidden';
        pubLogoEl.innerHTML = `<img src="${biz.logoUrl}" style="width: 100%; height: 100%; object-fit: cover;">`;
      } else {
        pubLogoEl.innerHTML = biz.logoText || "KM";
      }
    }
    document.getElementById('pub-business-name').textContent = biz.name || "KIVO MATIQUE";
    document.getElementById('pub-business-address').textContent = biz.address || "Avenue Cheikh Anta Diop, Dakar";

    document.getElementById('pub-doc-title').textContent = doc.type === 'quote' ? 'DEVIS' : 'FACTURE';
    document.getElementById('pub-doc-number').textContent = doc.number;

    const badgeClass = {
      paid: 'badge-paid',
      accepted: 'badge-accepted',
      overdue: 'badge-overdue',
      sent: 'badge-sent',
      viewed: 'badge-viewed',
      refunded: 'badge-overdue'
    }[doc.status] || 'badge-draft';

    const statusLabel = {
      paid: '✓ Payée',
      accepted: '✓ Devis Accepté',
      overdue: '⚠️ En retard',
      sent: 'Envoyée',
      viewed: 'Vue par le client',
      refunded: '↩️ Remboursée'
    }[doc.status] || doc.status;

    const badgeEl = document.getElementById('pub-doc-status-badge');
    if (badgeEl) {
      badgeEl.className = `badge ${badgeClass}`;
      badgeEl.textContent = statusLabel;
    }

    document.getElementById('pub-client-name').textContent = doc.clientName;
    document.getElementById('pub-client-contact').textContent = `${doc.clientType || 'B2C'} ${doc.clientTaxId ? '• ' + doc.clientTaxId : ''} ${doc.clientEmail ? '• ' + doc.clientEmail : ''}`;
    document.getElementById('pub-client-phone').textContent = doc.clientPhone || '';
    document.getElementById('pub-issue-date').textContent = doc.issueDate;
    document.getElementById('pub-due-date').textContent = doc.dueDate;

    const tbody = document.getElementById('pub-items-tbody');
    tbody.innerHTML = (doc.items || []).map(it => `
      <tr>
        <td><strong>${it.name}</strong><br><span style="font-size: 0.8rem; color: var(--text-secondary);">${it.description || ''}</span></td>
        <td style="text-align: center;">${it.quantity}</td>
        <td style="text-align: right;">${(it.price || 0).toLocaleString('fr-FR')} ${currencyStr}</td>
        <td style="text-align: right;"><strong>${(it.total || 0).toLocaleString('fr-FR')} ${currencyStr}</strong></td>
      </tr>
    `).join('');

    document.getElementById('pub-subtotal').textContent = (doc.subtotal || doc.total).toLocaleString('fr-FR') + ' ' + currencyStr;
    document.getElementById('pub-discount').textContent = '-' + (doc.discount || 0).toLocaleString('fr-FR') + ' ' + currencyStr;
    document.getElementById('pub-total').textContent = (doc.total || 0).toLocaleString('fr-FR') + ' ' + currencyStr;
    document.getElementById('pub-bar-total').textContent = (doc.total || 0).toLocaleString('fr-FR') + ' ' + currencyStr;

    document.getElementById('pub-terms').textContent = doc.terms || "Paiement à réception par Carte bancaire (Stripe) ou Mobile Money.";
    document.getElementById('pub-notes').textContent = doc.notes || "Merci pour votre confiance.";

    const btnContainer = document.getElementById('pub-bar-buttons-container');
    
    if (doc.type === 'quote' && (doc.status === 'sent' || doc.status === 'viewed')) {
      btnContainer.innerHTML = `
        <button class="btn btn-success" onclick="KivoApp.clientAcceptQuote('${doc.id}')">
          ✓ Accepter le devis
        </button>
        <button class="btn btn-secondary" onclick="window.print()">Télécharger PDF</button>
      `;
    } else if (doc.type === 'invoice' && doc.status !== 'paid' && doc.status !== 'refunded') {
      btnContainer.innerHTML = `
        <button class="btn btn-primary" onclick="KivoApp.openPaymentModal('${doc.id}')">
          🔒 Payer en ligne (${(doc.total).toLocaleString('fr-FR')} ${currencyStr})
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

    // Apply the configured template and colors
    this.updateDocumentPreviewVisuals();
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
        details: `Validé par ${doc.clientName}`
      });

      this.saveState();
      this.showToast("🎉 Félicitations ! Devis accepté par le client.", "success");
      this.renderPublicDocView();
    }
  },

  /**
   * Payment provider modal checkout trigger
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

  selectPaymentProvider: function (providerId) {
    this.selectedProviderId = providerId;
    document.getElementById('payment-input-step').style.display = 'block';
    
    const labelEl = document.getElementById('pay-input-label');
    const inputEl = document.getElementById('pay-input-phone');
    
    if (providerId === 'stripe') {
      if (labelEl) labelEl.textContent = "Numéro de carte bancaire Stripe (Demo)";
      if (inputEl) inputEl.placeholder = "4242 4242 4242 4242";
    } else {
      if (labelEl) labelEl.textContent = "Numéro de téléphone Mobile Money";
      if (inputEl) inputEl.placeholder = "+221 77 000 00 00";
    }

    inputEl.value = this.activePaymentDoc.clientPhone || '';
    document.getElementById('pay-confirm-btn').scrollIntoView({ behavior: 'smooth' });
  },

  confirmOnlinePayment: function () {
    const doc = this.activePaymentDoc;
    const details = document.getElementById('pay-input-phone').value;
    const btn = document.getElementById('pay-confirm-btn');

    btn.textContent = "Traitement sécurisé en cours...";
    btn.disabled = true;

    window.PaymentProvider.processPayment(doc, this.selectedProviderId, { phone: details }, (record) => {
      this.closeModal('modal-payment-checkout');
      btn.textContent = "Confirmer le paiement instantané 🔒";
      btn.disabled = false;

      this.showToast(`Paiement de ${doc.total.toLocaleString('fr-FR')} ${doc.currency || 'FCFA'} confirmé via ${this.selectedProviderId.toUpperCase()} !`, "success");
      this.renderPublicDocView();
    });
  },

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
        details: `${amount.toLocaleString('fr-FR')} ${doc.currency || 'FCFA'} encaissés via ${providerId.toUpperCase()} (Tx: ${transactionId})`
      });

      this.saveState();
    }
  },

  recordInvoiceRefund: function (docId, amount, refundId, reason) {
    const doc = this.state.documents.find(d => d.id === docId);
    if (doc) {
      doc.status = 'refunded';

      this.state.activities.unshift({
        id: 'act_' + Date.now(),
        timestamp: "À l'instant",
        type: 'refund',
        icon: 'rotate-ccw',
        title: `Remboursement effectué pour #${doc.number}`,
        details: `${amount.toLocaleString('fr-FR')} ${doc.currency || 'FCFA'} remboursés (ID: ${refundId})`
      });

      this.saveState();
    }
  },

  shareOnWhatsApp: function (docId) {
    const doc = this.state.documents.find(d => d.id === docId);
    if (doc) {
      const msg = window.WhatsAppHelper.buildShareMessage(doc, this.state.business.name);
      const url = window.WhatsAppHelper.getWhatsAppWebUrl(doc.clientPhone, msg);
      window.open(url, '_blank');
    }
  },

  /**
   * Client CRM management
   */
  toggleClientTypeForm: function (type) {
    const taxGroup = document.getElementById('new-cli-taxid-group');
    const labelEl = document.getElementById('new-cli-name-label');
    
    if (type === 'B2B') {
      if (taxGroup) taxGroup.style.display = 'block';
      if (labelEl) labelEl.textContent = 'Nom commercial / Raison Sociale *';
    } else {
      if (taxGroup) taxGroup.style.display = 'none';
      if (labelEl) labelEl.textContent = 'Nom complet du particulier *';
    }
  },

  renderClients: function () {
    const tbody = document.getElementById('clients-list-tbody');
    if (!tbody) return;

    const biz = this.state.business;
    const currency = biz.currency || 'FCFA';

    if (this.state.clients.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">Aucun client enregistré. Cliquez sur "+ Nouveau client".</td></tr>`;
      return;
    }

    tbody.innerHTML = this.state.clients.map(c => {
      // Compute real totals from documents
      const clientDocs = this.state.documents.filter(d => d.clientId === c.id || d.clientName === c.name);
      const totalInvoiced = clientDocs.reduce((sum, d) => sum + (d.total || 0), 0);
      const totalPaid = clientDocs
        .filter(d => d.status === 'paid' || d.status === 'accepted')
        .reduce((sum, d) => sum + (d.amountPaid || d.total || 0), 0);
      const balanceDue = Math.max(0, totalInvoiced - totalPaid);

      return `
      <tr>
        <td><strong>${c.name}</strong> ${c.clientType ? `<span class="badge badge-accepted" style="font-size: 0.65rem;">${c.clientType}</span>` : ''}</td>
        <td>${c.company || c.taxId || '-'}</td>
        <td>${c.phone || '-'}</td>
        <td><strong>${totalInvoiced.toLocaleString('fr-FR')} ${currency}</strong></td>
        <td style="color: var(--success-text);"><strong>${totalPaid.toLocaleString('fr-FR')} ${currency}</strong></td>
        <td style="color: ${balanceDue > 0 ? 'var(--danger-text)' : 'var(--success-text)'}"><strong>${balanceDue.toLocaleString('fr-FR')} ${currency}</strong></td>
        <td style="text-align: right; display: flex; gap: 0.35rem; justify-content: flex-end;">
          <button class="btn btn-secondary btn-sm" onclick="KivoApp.openClientDetails('${c.id}')">👁 Détails</button>
          <button class="btn btn-secondary btn-sm" onclick="KivoApp.startNewDocumentForClient('${c.id}')">+ Facturer</button>
          <button class="btn btn-danger btn-sm" onclick="KivoApp.confirmDeleteClient('${c.id}')">🗑️</button>
        </td>
      </tr>
    `}).join('');
  },

  openClientDetails: function (clientId) {
    const client = this.state.clients.find(c => c.id === clientId);
    if (!client) return;

    const biz = this.state.business;
    const currency = biz.currency || 'FCFA';

    // Compute real totals from documents
    const clientDocs = this.state.documents.filter(d => d.clientId === client.id || d.clientName === client.name);
    const totalInvoiced = clientDocs.reduce((sum, d) => sum + (d.total || 0), 0);
    const totalPaid = clientDocs
      .filter(d => d.status === 'paid' || d.status === 'accepted')
      .reduce((sum, d) => sum + (d.amountPaid || d.total || 0), 0);
    const balanceDue = Math.max(0, totalInvoiced - totalPaid);

    // Fill modal header
    const initials = client.name.split(' ').filter(w => w.length > 0).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    const avatarEl = document.getElementById('crm-client-avatar');
    if (avatarEl) avatarEl.textContent = initials;
    const nameEl = document.getElementById('crm-client-name');
    if (nameEl) nameEl.textContent = client.name;
    const metaEl = document.getElementById('crm-client-meta');
    if (metaEl) metaEl.textContent = `${client.clientType || 'Client'} · ${clientDocs.length} document${clientDocs.length !== 1 ? 's' : ''}`;

    // Fill KPIs
    const inv = document.getElementById('crm-total-invoiced');
    const paid = document.getElementById('crm-total-paid');
    const due = document.getElementById('crm-balance-due');
    if (inv) inv.textContent = `${totalInvoiced.toLocaleString('fr-FR')} ${currency}`;
    if (paid) paid.textContent = `${totalPaid.toLocaleString('fr-FR')} ${currency}`;
    if (due) due.textContent = `${balanceDue.toLocaleString('fr-FR')} ${currency}`;

    // Fill contact info
    const contactEl = document.getElementById('crm-contact-info');
    if (contactEl) {
      const parts = [];
      if (client.email) parts.push(`📧 ${client.email}`);
      if (client.phone) parts.push(`📞 ${client.phone}`);
      if (client.address) parts.push(`📍 ${client.address}`);
      if (client.taxId) parts.push(`🏢 SIRET/NINEA : ${client.taxId}`);
      if (client.company) parts.push(`🏷 ${client.company}`);
      contactEl.innerHTML = parts.map(p => `<span>${p}</span>`).join('');
    }

    // Fill document history
    const listEl = document.getElementById('crm-doc-list');
    if (listEl) {
      if (clientDocs.length === 0) {
        listEl.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 1rem;">Aucun document pour ce client.</p>`;
      } else {
        const statusLabel = { draft: 'Brouillon', sent: 'Envoyée', viewed: 'Consultée', paid: '✓ Payée', accepted: '✓ Acceptée', overdue: '⚠ Impayée', refunded: 'Remboursée' };
        const statusClass = { draft: '', sent: 'badge-sent', viewed: 'badge-viewed', paid: 'badge-paid', accepted: 'badge-accepted', overdue: 'badge-overdue', refunded: 'badge-overdue' };
        listEl.innerHTML = clientDocs
          .sort((a, b) => new Date(b.issueDate || 0) - new Date(a.issueDate || 0))
          .map(doc => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--bg-subtle); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div>
              <strong style="font-size: 0.95rem;">${doc.number}</strong>
              <div style="font-size: 0.8rem; color: var(--text-secondary);">${doc.type === 'quote' ? 'Devis' : 'Facture'} · Émis le ${doc.issueDate || '—'}</div>
            </div>
            <div style="text-align: right; display: flex; align-items: center; gap: 0.75rem;">
              <span class="badge ${statusClass[doc.status] || ''}">${statusLabel[doc.status] || doc.status}</span>
              <strong>${(doc.total || 0).toLocaleString('fr-FR')} ${doc.currency || currency}</strong>
            </div>
          </div>
        `).join('');
      }
    }

    // Store current client ID for "new invoice" button
    this._crmCurrentClientId = clientId;

    this.openModal('modal-client-details');
  },

  startNewDocumentForClient: function (clientId) {
    const id = clientId || this._crmCurrentClientId;
    if (id) {
      const client = this.state.clients.find(c => c.id === id);
      if (client) {
        // Pre-set client in builder
        this.state.newDoc = this.state.newDoc || {};
        this.state.newDoc.clientId = client.id;
        this.state.newDoc.clientName = client.name;
      }
    }
    this.startNewDocument('invoice');
  },

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

  renderReminders: function () {
    const listEl = document.getElementById('reminders-doc-list');
    if (!listEl) return;

    const overdueDocs = this.state.documents.filter(d => d.type === 'invoice' && d.status !== 'paid' && d.status !== 'refunded');

    if (overdueDocs.length === 0) {
      listEl.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Aucune facture en attente de relance ! 🎉</p>`;
      return;
    }

    listEl.innerHTML = overdueDocs.map((doc, idx) => `
      <div class="card" style="cursor: pointer; border: ${idx === 0 ? '2px solid var(--primary)' : '1px solid var(--border-color)'}; padding: 1rem;" onclick="KivoApp.selectReminderDoc('${doc.id}')">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${doc.number} — ${doc.clientName}</strong>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">Échéance: ${doc.dueDate}</div>
          </div>
          <span class="badge ${doc.status === 'overdue' ? 'badge-overdue' : 'badge-sent'}">${(doc.total).toLocaleString('fr-FR')} ${doc.currency || 'FCFA'}</span>
        </div>
      </div>
    `).join('');

    if (!this.activeReminderDocId && overdueDocs.length > 0) {
      this.selectReminderDoc(overdueDocs[0].id);
    }
  },

  selectReminderDoc: function (docId) {
    this.activeReminderDocId = docId;
    const doc = this.state.documents.find(d => d.id === docId);
    if (!doc) return;

    const reminder = window.KivoAI.generateReminder(doc, this.selectedReminderTone, this.state.business.name);
    document.getElementById('reminder-message-preview').value = reminder.text;
    document.getElementById('reminder-send-whatsapp').href = reminder.whatsappUrl;
  },

  setReminderTone: function (tone) {
    this.selectedReminderTone = tone;
    if (this.activeReminderDocId) {
      this.selectReminderDoc(this.activeReminderDocId);
    }
  },

  copyReminderText: function () {
    const text = document.getElementById('reminder-message-preview').value;
    navigator.clipboard.writeText(text).then(() => {
      this.showToast("Message de relance copié dans le presse-papier !", "info");
    });
  },

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
   * Google OAuth via Supabase — redirects to Google login page
   */
  simulateGoogleAuth: async function () {
    if (!window.KivoDb || !window.KivoDb.supabase) {
      this.showToast("Erreur : Supabase non initialisé.", "error");
      return;
    }
    try {
      const { error } = await KivoDb.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname
        }
      });
      if (error) {
        console.error('[KivoApp] Google OAuth error:', error);
        this.showToast("Connexion Google impossible : " + error.message, "error");
      }
    } catch(e) {
      this.showToast("Connexion Google non disponible.", "error");
      console.error('[KivoApp] Google OAuth exception:', e);
    }
  },

  /**
   * Login via view-auth form — now uses real Supabase auth (not localStorage comparison)
   */
  submitLogin: async function () {
    const email = document.getElementById('auth-login-email').value.trim();
    const pwd = document.getElementById('auth-login-password').value;

    if (!email || !pwd) {
      this.showToast("Veuillez saisir votre email et mot de passe.", "error");
      return;
    }

    const btn = document.querySelector('#auth-form-login button[type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = 'Connexion...'; }

    const result = await KivoAuth.signIn(email, pwd);

    if (btn) { btn.disabled = false; btn.textContent = 'Se connecter'; }

    if (result.error) {
      this.showToast(result.error.message || "Email ou mot de passe incorrect.", "error");
    }
    // On success, onAuthStateChange fires and handlePostLogin() is called automatically
  },

  /**
   * Register via view-auth form — uses real Supabase signUp
   */
  submitRegister: async function () {
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

    const btn = document.querySelector('#auth-form-register button[type=submit]');
    if (btn) { btn.disabled = true; btn.textContent = 'Création...'; }

    const result = await KivoAuth.signUp(email, pwd);

    if (btn) { btn.disabled = false; btn.textContent = 'Créer mon compte ➔'; }

    if (result.error) {
      this.showToast(result.error.message || "Erreur lors de l'inscription.", "error");
    } else {
      // Store the display name locally for onboarding
      this.state.userEmail = email;
      this.state.business.owner = name;
      this.state.business.email = email;
      // NOTE: password is NOT stored — Supabase handles it securely
      this.saveState();

      const needsConfirmation = !result.data?.session; // Supabase email confirmation
      if (needsConfirmation) {
        this.showToast("Compte créé ! Vérifiez votre email pour confirmer votre inscription.", "success");
      } else {
        this.showToast(`🎉 Compte créé ! Configurons votre entreprise...`, "success");
        setTimeout(() => this.navigate('onboarding'), 800);
      }
    }
  },

  onCountrySelectChange: function () {
    const select = document.getElementById('onboard-biz-country');
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption) {
      const code = selectedOption.getAttribute('data-code');
      const curr = selectedOption.getAttribute('data-currency');

      if (code) {
        const prefixSelect = document.getElementById('onboard-biz-phone-prefix');
        if (prefixSelect) {
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
        }
      }
    }
  },

  fillDemoOnboardingData: function () {
    document.getElementById('onboard-biz-name').value = "MD Creative Studio";
    document.getElementById('onboard-biz-owner').value = "Marc Koffi";
    document.getElementById('onboard-biz-country').value = "Sénégal";
    document.getElementById('onboard-biz-phone-prefix').value = "+221";
    document.getElementById('onboard-biz-phone').value = "77 842 19 02";
    document.getElementById('onboard-biz-currency').value = "FCFA";
    document.getElementById('onboard-biz-email').value = "marc.koffi@mdcreative.design";
    document.getElementById('onboard-biz-taxid').value = "SN-NINEA-849204812";
    this.showToast("⚡ Données de démonstration chargées.", "info");
  },

  selectedOnboardPlan: 'Pro',

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

    const words = bizName.split(' ').filter(w => w.length > 0);
    biz.logoText = words.length > 1
      ? (words[0][0] + words[1][0]).toUpperCase()
      : bizName.substring(0, 2).toUpperCase();

    // Mark as onboarded to unlock app
    this.state.isOnboarded = true;

    this.saveState();
    this.updateUserBrandingUI();
    this.showToast(`🎉 Bienvenue sur KIVO MATIQUE, ${bizOwner} ! Espace prêt.`, "success");
    this.navigate('dashboard');
  },

  switchSubscriptionTier: function (tier) {
    this.state.business.subscriptionTier = tier;
    this.state.business.subscriptionStatus = 'active';
    this.saveState();
    this.renderSettings();
    this.showToast(`✨ Forfait ${tier} (KIVO MATIQUE) activé !`, "success");
  },

  renderSettings: function () {
    const biz = this.state.business;
    if (document.getElementById('setting-biz-name')) document.getElementById('setting-biz-name').value = biz.name;
    if (document.getElementById('setting-biz-owner')) document.getElementById('setting-biz-owner').value = biz.owner;
    if (document.getElementById('setting-biz-phone')) document.getElementById('setting-biz-phone').value = biz.phone;
    if (document.getElementById('setting-biz-email')) document.getElementById('setting-biz-email').value = biz.email;
    if (document.getElementById('setting-biz-website')) document.getElementById('setting-biz-website').value = biz.website || '';
    if (document.getElementById('setting-biz-address')) document.getElementById('setting-biz-address').value = biz.address || '';
    if (document.getElementById('setting-biz-taxid')) document.getElementById('setting-biz-taxid').value = biz.taxId || '';
    if (document.getElementById('setting-biz-currency')) document.getElementById('setting-biz-currency').value = biz.currency;
    if (document.getElementById('setting-biz-prefix')) document.getElementById('setting-biz-prefix').value = biz.invoicePrefix || "FAC-2026-";
    if (document.getElementById('setting-biz-quote-prefix')) document.getElementById('setting-biz-quote-prefix').value = biz.quotePrefix || "DEV-2026-";
    if (document.getElementById('setting-biz-vat')) document.getElementById('setting-biz-vat').value = biz.defaultVatRate || 18;
    if (document.getElementById('setting-stripe-key')) document.getElementById('setting-stripe-key').value = biz.stripeKey || "pk_test_51KivoMastiqueDemoStripeKey998";
    if (document.getElementById('setting-biz-language')) document.getElementById('setting-biz-language').value = this.state.language || "fr";

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

  saveSettings: function () {
    const biz = this.state.business;
    if (document.getElementById('setting-biz-name')) biz.name = document.getElementById('setting-biz-name').value;
    if (document.getElementById('setting-biz-owner')) biz.owner = document.getElementById('setting-biz-owner').value;
    if (document.getElementById('setting-biz-phone')) biz.phone = document.getElementById('setting-biz-phone').value;
    if (document.getElementById('setting-biz-email')) biz.email = document.getElementById('setting-biz-email').value;
    if (document.getElementById('setting-biz-website')) biz.website = document.getElementById('setting-biz-website').value;
    if (document.getElementById('setting-biz-address')) biz.address = document.getElementById('setting-biz-address').value;
    if (document.getElementById('setting-biz-taxid')) biz.taxId = document.getElementById('setting-biz-taxid').value;
    if (document.getElementById('setting-biz-currency')) biz.currency = document.getElementById('setting-biz-currency').value;
    if (document.getElementById('setting-biz-prefix')) biz.invoicePrefix = document.getElementById('setting-biz-prefix').value;
    if (document.getElementById('setting-biz-quote-prefix')) biz.quotePrefix = document.getElementById('setting-biz-quote-prefix').value;
    if (document.getElementById('setting-biz-vat')) biz.defaultVatRate = parseFloat(document.getElementById('setting-biz-vat').value) || 0;
    if (document.getElementById('setting-stripe-key')) biz.stripeKey = document.getElementById('setting-stripe-key').value;

    const langSelect = document.getElementById('setting-biz-language');
    if (langSelect) this.state.language = langSelect.value;

    this.saveState();

    // Sync to Supabase
    if (window.KivoDb && this.supabaseConnected) {
      window.KivoDb.saveSettings({
        company_name: biz.name,
        owner: biz.owner,
        email: biz.email,
        phone: biz.phone,
        address: biz.address,
        website: biz.website || '',
        fiscal_id: biz.taxId,
        currency: biz.currency,
        current_plan: biz.subscriptionTier || 'Gratuit',
        invoice_prefix: biz.invoicePrefix || 'FAC-2026-',
        quote_prefix: biz.quotePrefix || 'DEV-2026-',
        default_vat_rate: biz.defaultVatRate || 18,
        logo_url: biz.logoUrl || '',
        visual_template: biz.visualTemplate || 'classic',
        primary_color: biz.primaryColor || '#0F172A',
        secondary_color: biz.secondaryColor || '#64748B'
      }).catch(e => console.error('[KivoApp] Supabase saveSettings error:', e));
    }

    this.showToast("Paramètres KIVO MATIQUE enregistrés !", "success");
    this.updateUserBrandingUI();
  },

  handleLogoUpload: async function (files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    
    if (!window.KivoAuth || !window.KivoAuth.user) {
      this.showToast("⚠️ Vous devez être connecté pour importer un logo.", "danger");
      return;
    }
    
    this.showToast("⏳ Importation du logo en cours...", "info");
    
    const userId = window.KivoAuth.user.id;
    const publicUrl = await window.KivoDb.uploadLogo(file, userId);
    
    if (publicUrl) {
      this.state.business.logoUrl = publicUrl;
      this.saveState();
      
      const previewBadge = document.getElementById('setting-logo-preview-badge');
      if (previewBadge) {
        previewBadge.innerHTML = `<img src="${publicUrl}" style="width:100%; height:100%; object-fit:cover;">`;
      }
      
      this.showToast("✅ Logo importé avec succès !", "success");
      this.updateUserBrandingUI();
      
      // Save logo URL to Supabase business settings
      this.saveSettings();
    } else {
      this.showToast("❌ Échec de l'importation du logo.", "danger");
    }
  },

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
    const name = document.getElementById('new-cli-name').value.trim();
    const contact = document.getElementById('new-cli-contact').value.trim();
    const phone = document.getElementById('new-cli-phone').value.trim();
    const email = document.getElementById('new-cli-email').value.trim();
    const taxId = document.getElementById('new-cli-taxid') ? document.getElementById('new-cli-taxid').value.trim() : '';
    const address = document.getElementById('new-cli-address') ? document.getElementById('new-cli-address').value.trim() : '';
    
    let type = 'B2B';
    const typeRadios = document.getElementsByName('new-cli-type');
    typeRadios.forEach(r => { if (r.checked) type = r.value; });

    if (!name) {
      this.showToast("Veuillez saisir le nom du client.", "error");
      return;
    }

    const newClient = {
      id: 'cli_' + Date.now(),
      name: name,
      clientType: type,
      company: type === 'B2B' ? name : '',
      contactName: contact,
      taxId: taxId,
      email: email,
      phone: phone,
      address: address,
      totalInvoiced: 0,
      totalPaid: 0,
      balanceDue: 0,
      createdAt: new Date().toISOString().split('T')[0]
    };

    this.state.clients.unshift(newClient);
    this.saveState();
    
    if (window.KivoDb && this.supabaseConnected) {
      window.KivoDb.saveClient({
        id: newClient.id,
        name: newClient.name,
        type: newClient.clientType,
        company: newClient.company,
        contact_name: newClient.contactName,
        tax_id: newClient.taxId,
        email: newClient.email,
        phone: newClient.phone,
        address: newClient.address,
        total_invoiced: newClient.totalInvoiced,
        total_paid: newClient.totalPaid,
        balance_due: newClient.balanceDue
      }).catch(e => console.error(e));
    }

    this.closeModal('modal-new-client');
    this.showToast(`Client ${name} (${type}) enregistré avec succès.`, "success");

    if (this.activeView === 'document-builder') {
      const clientSelect = document.getElementById('builder-doc-client-select');
      if (clientSelect) {
        const opt = document.createElement('option');
        opt.value = newClient.id;
        opt.textContent = `${newClient.name} (${newClient.company || newClient.contactName || 'Particulier'})`;
        clientSelect.appendChild(opt);
        clientSelect.value = newClient.id;
        this.updateLiveInvoicePreview();
      }
    } else {
      this.renderClients();
    }
  },

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
  },

  // --- VISUAL IDENTITY & PERSONALIZATION ---
  
  updateDocumentPreviewVisuals: function () {
    const biz = this.state.business || {};
    const tInput = document.getElementById('builder-visual-template');
    const template = tInput ? tInput.value : (biz.visualTemplate || 'classic');
    
    const pInput = document.getElementById('builder-color-primary');
    const primary = pInput ? pInput.value : (biz.primaryColor || '#0F172A');
    
    const sInput = document.getElementById('builder-color-secondary');
    const secondary = sInput ? sInput.value : (biz.secondaryColor || '#64748B');

    // Apply classes to both the builder preview and the public view
    const containers = [
      document.getElementById('live-paper-preview-container'),
      document.getElementById('public-doc-printable-area')
    ];

    containers.forEach(container => {
      if (!container) return;
      
      // Remove existing template classes
      container.className = container.className.replace(/\bdoc-template-\S+/g, '');
      
      // Add new template class
      container.classList.add(`doc-template-${template}`);
      
      // Apply CSS variables
      container.style.setProperty('--doc-primary', primary);
      container.style.setProperty('--doc-secondary', secondary);
      
      // Auto-calculate text color for primary background
      const hex = primary.replace('#', '');
      const r = parseInt(hex.substring(0,2), 16) || 0;
      const g = parseInt(hex.substring(2,4), 16) || 0;
      const b = parseInt(hex.substring(4,6), 16) || 0;
      const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;
      container.style.setProperty('--doc-text', luminance > 0.5 ? '#000000' : '#FFFFFF');
    });

    // Save to global state so it's persisted on saveSettings
    if (this.state.business) {
      this.state.business.visualTemplate = template;
      this.state.business.primaryColor = primary;
      this.state.business.secondaryColor = secondary;
    }
  },

  applyPalette: function (primary, secondary) {
    const primaryInput = document.getElementById('builder-color-primary');
    const secondaryInput = document.getElementById('builder-color-secondary');
    if (primaryInput) primaryInput.value = primary;
    if (secondaryInput) secondaryInput.value = secondary;
    this.updateDocumentPreviewVisuals();
    this.showToast('Palette appliquée', 'success');
  },

  handleLogoUpload: function (input) {
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const preview = document.getElementById('builder-logo-preview-img');
        if (preview) {
           preview.src = e.target.result;
           preview.style.display = 'block';
           
           // Show extract color button
           const extractBtn = document.getElementById('btn-extract-colors');
           if (extractBtn) extractBtn.style.display = 'inline-block';
        }
        
        // Also upload to Supabase
        if (window.KivoDb && window.KivoAuth && window.KivoAuth.user) {
          this.showToast('Upload du logo en cours...', 'info');
          window.KivoDb.uploadLogo(input.files[0], window.KivoAuth.user.id).then(url => {
            if (url) {
              if (!this.state.business) this.state.business = {};
              this.state.business.logoUrl = url;
              this.updateLiveInvoicePreview();
              this.showToast('Logo enregistré !', 'success');
            }
          });
        }
      };
      reader.readAsDataURL(input.files[0]);
    }
  },

  extractColorsFromLogo: function () {
    const img = document.getElementById('builder-logo-preview-img');
    if (!img || !img.src) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = img.naturalWidth || img.width || 100;
    canvas.height = img.naturalHeight || img.height || 100;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      
      // Simple extraction: average color excluding transparent pixels
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < imageData.length; i += 4) {
        if (imageData[i+3] > 128) { // check alpha
          // skip pure white and near white (often backgrounds)
          if (imageData[i] > 240 && imageData[i+1] > 240 && imageData[i+2] > 240) continue;
          
          r += imageData[i];
          g += imageData[i+1];
          b += imageData[i+2];
          count++;
        }
      }
      
      if (count > 0) {
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);
        
        const toHex = (c) => {
          const hex = c.toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        };
        
        const primaryHex = "#" + toHex(r) + toHex(g) + toHex(b);
        this.applyPalette(primaryHex, '#64748B'); // use a neutral secondary
        this.showToast('Palette générée avec succès !', 'success');
      } else {
        this.showToast('Couleur introuvable', 'error');
      }
    } catch(e) {
      console.error(e);
      this.showToast('Erreur lors de l\'analyse du logo', 'error');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.KivoApp.init();
});

