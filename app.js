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
      catalog: "Modèles",
      reminders: "Relances Intelligentes",
      analytics: "Statistiques",
      settings: "Paramètres",
      newDoc: "+ Nouveau document",
      save: "Enregistrer",
      cancel: "Annuler",
      delete: "Supprimer",
      confirmDelete: "Confirmer la suppression",
      paid: "Payée",
      overdue: "En retard",
      sent: "Envoyée",
      draft: "Brouillon",
      refunded: "Remboursée",
      cancelled: "Annulée",
      accepted: "Accepté",
      totalTtc: "TOTAL TTC",
      subtotalHt: "Sous-total HT",
      taxVat: "TVA / Taxe"
    },
    en: {
      appName: "KIVO MATIQUE",
      dashboard: "Dashboard",
      documents: "Documents",
      clients: "Clients",
      catalog: "Templates",
      reminders: "Smart Reminders",
      analytics: "Analytics",
      settings: "Settings",
      newDoc: "+ New Document",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      confirmDelete: "Confirm Deletion",
      paid: "Paid",
      overdue: "Overdue",
      sent: "Sent",
      draft: "Draft",
      refunded: "Refunded",
      cancelled: "Cancelled",
      accepted: "Accepted",
      totalTtc: "GRAND TOTAL",
      subtotalHt: "Subtotal (excl. tax)",
      taxVat: "VAT / Tax"
    },
    es: {
      appName: "KIVO MATIQUE",
      dashboard: "Panel de Control",
      documents: "Documentos",
      clients: "Clientes",
      catalog: "Plantillas",
      reminders: "Recordatorios",
      analytics: "Estadísticas",
      settings: "Ajustes",
      newDoc: "+ Nuevo Documento",
      save: "Guardar",
      cancel: "Cancelar",
      delete: "Eliminar",
      confirmDelete: "Confirmar eliminación",
      paid: "Pagado",
      overdue: "Vencido",
      sent: "Enviado",
      draft: "Borrador",
      refunded: "Reembolsado",
      cancelled: "Cancelado",
      accepted: "Aceptado",
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
   * Returns a user-scoped localStorage key.
   * Each user's data is isolated under their own key to prevent data bleed.
   */
  getUserStorageKey: function () {
    const userId = window.KivoAuth?.user?.id || null;
    return userId ? `kivo_app_state_${userId}` : 'kivo_app_state_guest';
  },

  /**
   * Initializes application state and router
   * Centralized single source of truth for boot & routing
   */
  init: async function () {
    console.log("[KivoApp] Initializing KIVO MATIQUE application...");
    this.setupRouting();
    this.setupEventListeners();

    // 1. Check if returning from Google OAuth (URL hash contains access_token or query contains code)
    const hasOAuthCallback = window.location.hash.includes('access_token=') || window.location.search.includes('code=');

    // 2. Initialize Auth client
    if (window.KivoAuth && typeof window.KivoAuth.init === 'function') {
      await window.KivoAuth.init();
    }

    // 3. Check Supabase session
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
            if (window.KivoAuth) {
              KivoAuth.session = session;
              KivoAuth.user = userData.user;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[KivoApp] Error checking session:', e);
    }

    // If returning from OAuth, clean URL hash/query smoothly without breaking router
    if (hasOAuthCallback && session) {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }

    if (session && session.user) {
      const loginModal = document.getElementById('modal-login');
      if (loginModal) loginModal.style.display = 'none';
      localStorage.removeItem('kivo_app_state'); // Purge legacy unscoped state
      this.state.userEmail = session.user.email || '';
      this.loadState();
      this.supabaseConnected = true;

      // Sync user data from Supabase to evaluate real onboarding status
      try {
        await this.syncFromSupabase();
      } catch (e) {
        console.error('[KivoApp] Supabase sync error on boot:', e);
      }

      // If user is not onboarded yet, pre-fill form with OAuth/signup metadata
      if (!this.state.isOnboarded) {
        this.prefillOnboardingWithAuthUser(session.user);
      }

      this.handleRoute();
    } else {
      // Unauthenticated visitor: start with clean blank state, no fake data
      console.log('[KivoApp] Visitor session — rendering public landing view.');
      const loginModal = document.getElementById('modal-login');
      if (loginModal) loginModal.style.display = 'none';
      this.supabaseConnected = false;
      this.state = JSON.parse(JSON.stringify(this.BLANK_STATE));
      this.state.isOnboarded = false;
      this.handleRoute();
    }
  },

  /**
   * Central callback when a user authenticates (via email form or OAuth)
   */
  onUserAuthenticated: async function (user) {
    if (!user) return;
    console.log('[KivoApp] onUserAuthenticated for:', user.email);
    this.state.userEmail = user.email || '';
    this.supabaseConnected = true;
    this.loadState();

    try {
      await this.syncFromSupabase();
    } catch (e) {
      console.error('[KivoApp] syncFromSupabase error:', e);
    }

    if (this.state.isOnboarded) {
      this.showToast("Connexion réussie.", "success");
      this.navigate('dashboard');
    } else {
      this.prefillOnboardingWithAuthUser(user);
      this.showToast("Bienvenue ! Configurez votre entreprise pour commencer.", "info");
      this.navigate('onboarding');
    }
  },

  /**
   * Pre-fills onboarding form with the real authenticated user's details
   */
  prefillOnboardingWithAuthUser: function (user) {
    if (!user) return;
    const emailEl = document.getElementById('onboard-biz-email');
    if (emailEl) {
      emailEl.value = user.email || '';
    }
    const ownerEl = document.getElementById('onboard-biz-owner');
    if (ownerEl && !ownerEl.value) {
      const metaName = user.user_metadata?.full_name || user.user_metadata?.name || '';
      ownerEl.value = metaName || (user.email ? user.email.split('@')[0] : '');
    }
  },

  /**
   * Tests Supabase connectivity and syncs cloud data into local state
   */
  initSupabase: async function () {
    if (!window.KivoDb) return;
    try {
      const { data: { session } } = await KivoDb.supabase.auth.getSession();
      if (!session) {
        return;
      }
      this.supabaseConnected = true;
      await this.syncFromSupabase();
    } catch (e) {
      console.error('[KivoApp] Supabase init error:', e);
    }
  },

  /**
   * Loads all data from Supabase and merges into local state.
   * A user is strictly considered onboarded ONLY if they have a business_settings record
   * with a non-empty company_name and owner!
   */
  syncFromSupabase: async function () {
    if (!window.KivoDb || !this.supabaseConnected) return;
    const data = await window.KivoDb.loadAll();
    if (!data) return;

    const s = (data.settings && data.settings.length > 0) ? data.settings[0] : null;
    const hasValidProfile = !!(s && s.company_name && s.company_name.trim() !== '' && s.owner && s.owner.trim() !== '');

    if (!hasValidProfile) {
      // Brand new or unconfigured account — strictly not onboarded!
      this.state.isOnboarded = false;
      const authUser = window.KivoAuth?.user;
      this.state.business = JSON.parse(JSON.stringify(this.BLANK_STATE.business));
      this.state.business.owner = authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || '';
      this.state.business.email = authUser?.email || '';
      this.state.clients = [];
      this.state.documents = [];
      this.state.catalog = [];
      this.state.activities = [];
    } else {
      // Existing user — merge cloud settings
      this.state.isOnboarded = true;
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
        primaryColor: s.primary_color || this.state.business.primaryColor || '#4F46E5',
        secondaryColor: s.secondary_color || this.state.business.secondaryColor || '#7C3AED',
        logoSize: s.logo_size !== undefined ? s.logo_size : (this.state.business.logoSize || 100),
        logoPosition: s.logo_position || this.state.business.logoPosition || 'right',
        invoicePageSize: s.invoice_page_size || this.state.business.invoicePageSize || 'a4',
      };

      // Update the visual UI elements with loaded settings
      const tSelect = document.getElementById('builder-visual-template');
      if (tSelect) tSelect.value = this.state.business.visualTemplate;
      const pColor = document.getElementById('builder-color-primary');
      if (pColor) pColor.value = this.state.business.primaryColor;
      const sColor = document.getElementById('builder-color-secondary');
      if (sColor) sColor.value = this.state.business.secondaryColor;
      if (typeof this.updateDocumentPreviewVisuals === 'function') {
        this.updateDocumentPreviewVisuals();
      }

      // Replace (not merge) clients — only cloud truth, new user = []
      this.state.clients = (data.clients || []).map(c => ({
        id: c.id, name: c.name, type: c.client_type, company: c.company,
        contactName: c.contact_name, taxId: c.tax_id, email: c.email,
        phone: c.phone, address: c.address,
        totalInvoiced: c.total_invoiced, totalPaid: c.total_paid, balanceDue: c.balance_due
      }));

      // Replace catalog
      this.state.catalog = (data.catalog || []).map(p => ({
        id: p.id, name: p.name, description: p.description,
        price: p.price, unit: p.unit, taxRate: p.tax_rate
      }));

      // Replace documents
      this.state.documents = (data.documents || []).map(d => ({
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
      }));

      // Activities
      if (data.activities && data.activities.length > 0) {
        this.state.activities = data.activities.map(a => ({
          id: a.id, timestamp: a.timestamp, type: a.type,
          icon: a.icon, title: a.title, details: a.details
        }));
      }
    }

    this.saveState();
    this.renderCurrentView();
    console.log('[KivoApp] Supabase sync complete. isOnboarded:', this.state.isOnboarded);
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
    const key = this.getUserStorageKey();
    const saved = localStorage.getItem(key);
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
    const key = this.getUserStorageKey();
    localStorage.setItem(key, JSON.stringify(this.state));
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
    this.showToast("Mode démo KIVO MATIQUE activé ! Compte MD Creative Studio chargé.", "success");
    this.navigate('dashboard');
  },

  /**
   * Logs out: signs out of Supabase AND clears local state
   * FIX: Must call supabase.auth.signOut() to clear the session token from localStorage.
   * Without this, getSession() finds the old token and auto-logs in the user.
   */
  logout: async function () {
    try {
      if (window.KivoAuth) {
        window.KivoAuth.user = null;
        window.KivoAuth.session = null;
      }
      this.supabaseConnected = false;
      const key = this.getUserStorageKey();
      localStorage.removeItem(key);
      localStorage.removeItem('kivo_app_state');
      this.state = JSON.parse(JSON.stringify(this.BLANK_STATE));
      
      if (window.KivoDb && window.KivoDb.supabase) {
        await KivoDb.supabase.auth.signOut();
      }
    } catch (e) {
      console.error('[KivoApp] Error during logout:', e);
    }
    window.location.hash = 'landing';
    window.location.reload();
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

    const publicViews = ['landing', 'auth', 'public-doc', 'pricing'];
    const appViews = ['dashboard', 'documents', 'document-builder', 'clients', 'catalog', 'reminders', 'analytics', 'settings', 'ai', 'team', 'integrations'];
    const validViews = [...publicViews, ...appViews, 'onboarding'];

    if (!validViews.includes(viewName)) {
      viewName = '';
    }

    const isAuthenticated = !!(window.KivoAuth && window.KivoAuth.user);
    const isOnboarded = this.state && this.state.isOnboarded === true;

    // Single Central Decision Logic:
    if (!isAuthenticated) {
      // 1. VISITOR: strictly public views only. No fake accounts, no demo bypass.
      if (!publicViews.includes(viewName)) {
        viewName = 'landing';
      }
    } else if (!isOnboarded) {
      // 2. AUTHENTICATED BUT ONBOARDING INCOMPLETE:
      // Mandatory onboarding before accessing dashboard or document management
      if (viewName !== 'onboarding' && viewName !== 'public-doc') {
        viewName = 'onboarding';
      }
    } else {
      // 3. AUTHENTICATED AND ONBOARDED:
      // Redirect from landing, auth, or onboarding to dashboard. Keep active subviews (documents, clients, etc.)
      if (!viewName || viewName === 'landing' || viewName === 'auth' || viewName === 'onboarding') {
        viewName = 'dashboard';
      }
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

    // Keep sidebar and app layout active for authenticated users visiting pricing
    const isFullWidthView = !isAuthenticated ? publicViews.includes(viewName) : (viewName === 'landing' || viewName === 'public-doc');
    const sidebar = document.getElementById('sidebar');
    const mobileBottomNav = document.querySelector('.mobile-bottom-nav');
    const mobileHeader = document.querySelector('.mobile-header');

    if (sidebar) sidebar.style.display = isFullWidthView ? 'none' : 'flex';
    if (mobileBottomNav) mobileBottomNav.style.display = isFullWidthView ? 'none' : 'flex';
    if (mobileHeader) mobileHeader.style.display = isFullWidthView ? 'none' : 'flex';

    const pricingTopbar = document.querySelector('.pricing-topbar');
    if (pricingTopbar) {
      pricingTopbar.style.display = isAuthenticated ? 'none' : 'flex';
    }

    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      if (isFullWidthView) {
        mainContent.style.marginLeft = '0';
        mainContent.style.maxWidth = '100vw';
        mainContent.style.padding = '0';
      } else if (viewName === 'ai') {
        mainContent.style.marginLeft = '';
        mainContent.style.maxWidth = '';
        mainContent.style.padding = '0';
      } else {
        mainContent.style.marginLeft = '';
        mainContent.style.maxWidth = '';
        mainContent.style.padding = '';
      }
    }

    document.querySelectorAll('.nav-item, .mobile-nav-item, .nav-sub-item').forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('data-view') === viewName) {
        item.classList.add('active');
      }
    });

    // Auto-expand and highlight Billing group when in documents or document-builder
    const billingGroup = document.getElementById('nav-group-billing-items');
    const billingTrigger = document.querySelector('[data-group="billing"]');
    const billingChevron = document.getElementById('chevron-billing');
    if (viewName === 'documents' || viewName === 'document-builder') {
      if (billingGroup) billingGroup.classList.add('open');
      if (billingChevron) billingChevron.style.transform = 'rotate(180deg)';
      if (billingTrigger) billingTrigger.classList.add('group-active');
    } else {
      if (billingTrigger) billingTrigger.classList.remove('group-active');
    }

    // Auto-expand and highlight Settings group when in settings/pricing/team/integrations
    const settingsGroup = document.getElementById('nav-group-settings-items');
    const settingsTrigger = document.querySelector('[data-group="settings"]');
    const settingsChevron = document.getElementById('chevron-settings');
    const settingsViews = ['settings', 'pricing', 'team', 'integrations'];
    if (settingsViews.includes(viewName)) {
      if (settingsGroup) settingsGroup.classList.add('open');
      if (settingsChevron) settingsChevron.style.transform = 'rotate(180deg)';
      if (settingsTrigger) settingsTrigger.classList.add('group-active');
    } else {
      if (settingsTrigger) settingsTrigger.classList.remove('group-active');
    }

    // Auto close mobile drawer on view navigation
    if (sidebar && sidebar.classList.contains('mobile-open')) {
      sidebar.classList.remove('mobile-open');
    }

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
   * Toggles the sidebar visibility with smooth animation
   */
  toggleSidebar: function () {
    const sidebar = document.getElementById('sidebar');
    const reopenBtn = document.getElementById('sidebar-reopen-btn');
    if (sidebar) {
      if (sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open');
        return;
      }
      sidebar.classList.toggle('collapsed');
      const isCollapsed = sidebar.classList.contains('collapsed');
      if (reopenBtn) {
        reopenBtn.style.display = isCollapsed ? 'flex' : 'none';
      }
    }
  },

  /**
   * Toggles a collapsible nav group (e.g. Facturation)
   */
  toggleNavGroup: function (groupId) {
    const groupItems = document.getElementById(`nav-group-${groupId}-items`);
    const chevron = document.getElementById(`chevron-${groupId}`);
    if (groupItems) {
      groupItems.classList.toggle('open');
      const isOpen = groupItems.classList.contains('open');
      if (chevron) {
        chevron.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
      }
    }
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
      case 'analytics':
        this.renderAnalytics();
        break;
      case 'public-doc':
        this.renderPublicDocView();
        break;
      case 'settings':
        this.renderSettings();
        break;
      case 'ai':
        this.renderAiPage();
        break;
      case 'pricing':
        this.renderPricingPage();
        break;
      default:
        break;
    }
  },

  /**
   * Updates sidebar and header branding elements
   */
  updateUserBrandingUI: function () {
    // Ensure state exists before accessing business data
    if (!this.state) {
      this.state = JSON.parse(JSON.stringify(this.BLANK_STATE));
    }
    const biz = (this.state && this.state.business) || {};
    const bizEl = document.getElementById('sidebar-business-name');
    if (bizEl) bizEl.textContent = biz.name || 'KIVO MATIQUE';
    
    const teamOwnerName = document.getElementById('team-owner-name');
    const teamOwnerEmail = document.getElementById('team-owner-email');
    if (teamOwnerName) teamOwnerName.textContent = biz.owner || 'Propriétaire';
    if (teamOwnerEmail) teamOwnerEmail.textContent = biz.email || '';


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

  formatCurrency: function (val, customCurrency = null) {
    const rawCurrency = customCurrency || (this.state && this.state.business && this.state.business.currency) || 'FCFA';
    const num = parseFloat(val) || 0;
    const currencyMap = {
      'FCFA': 'XOF', 'XOF': 'XOF', 'XAF': 'XAF',
      'EUR': 'EUR', 'USD': 'USD', 'GBP': 'GBP', 'CAD': 'CAD',
      'CDF': 'CDF', 'GNF': 'GNF', 'MAD': 'MAD', 'TND': 'TND',
    };
    const iso = currencyMap[rawCurrency];
    if (iso && iso !== 'XOF' && iso !== 'XAF') {
      try {
        return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: iso }).format(num);
      } catch (e) {}
    }
    return new Intl.NumberFormat('fr-FR').format(Math.round(num)) + ' ' + rawCurrency;
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
      const firstName = (biz.owner || '').split(' ')[0] || 'vous';
      greetingEl.textContent = `Bonjour ${firstName},`;
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

    // ── Mini Charts basés sur les vraies données ──────────────────────────
    // Calcul des revenus des 6 derniers mois
    const now = new Date();
    const monthlyRevenue = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        label: d.toLocaleString('fr-FR', { month: 'short' }),
        paid: 0, total: 0
      };
    });
    docs.forEach(doc => {
      if (doc.type !== 'invoice') return;
      const docDate = new Date(doc.issueDate || doc.createdAt);
      if (isNaN(docDate)) return;
      const diffMonths = (now.getFullYear() - docDate.getFullYear()) * 12 + (now.getMonth() - docDate.getMonth());
      if (diffMonths >= 0 && diffMonths < 6) {
        const idx = 5 - diffMonths;
        monthlyRevenue[idx].total += doc.total || 0;
        if (doc.status === 'paid') monthlyRevenue[idx].paid += doc.total || 0;
      }
    });

    // Chart Revenus (sparkline SVG dynamique)
    const chartRev = document.getElementById('chart-revenue');
    if (chartRev) {
      const maxRev = Math.max(...monthlyRevenue.map(m => m.paid), 1);
      const hasRevData = monthlyRevenue.some(m => m.paid > 0);
      if (!hasRevData) {
        chartRev.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.7rem;opacity:0.6;">Aucune donnée</div>`;
      } else {
        const pts = monthlyRevenue.map((m, i) => `${(i / 5) * 100},${40 - (m.paid / maxRev) * 36}`).join(' ');
        const polyPts = pts + ` 100,40 0,40`;
        chartRev.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
          <defs><linearGradient id="gradRev2" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#60A5FA"/><stop offset="100%" stop-color="rgba(96,165,250,0)"/></linearGradient></defs>
          <polygon points="${polyPts}" fill="url(#gradRev2)" opacity="0.25"/>
          <polyline points="${pts}" fill="none" stroke="#60A5FA" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          ${monthlyRevenue.map((m, i) => m.paid > 0 ? `<circle cx="${(i/5)*100}" cy="${40-(m.paid/maxRev)*36}" r="2.5" fill="#60A5FA"/>` : '').join('')}
        </svg>`;
      }
    }

    // Chart Factures (barres par mois — volumes)
    const chartInv = document.getElementById('chart-invoices');
    if (chartInv) {
      chartInv.style.display = 'flex';
      chartInv.style.alignItems = 'flex-end';
      chartInv.style.justifyContent = 'space-between';
      chartInv.style.gap = '4px';
      const maxVol = Math.max(...monthlyRevenue.map(m => m.total), 1);
      const hasVolData = monthlyRevenue.some(m => m.total > 0);
      if (!hasVolData) {
        chartInv.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.7rem;opacity:0.6;">Aucune donnée</div>`;
      } else {
        chartInv.innerHTML = monthlyRevenue.map(m => {
          const pct = Math.max((m.total / maxVol) * 100, 4);
          const color = m.total > 0 ? 'var(--primary)' : 'var(--border-color)';
          return `<div title="${m.label}: ${formatCurrency(m.total)}" style="flex:1;height:${pct}%;background:${color};border-radius:3px 3px 0 0;min-height:3px;transition:height 0.3s;"></div>`;
        }).join('');
      }
    }

    // Chart En attente (donut proportionnel aux statuts réels)
    const chartPend = document.getElementById('chart-pending');
    if (chartPend) {
      chartPend.style.display = 'flex';
      chartPend.style.alignItems = 'center';
      chartPend.style.justifyContent = 'center';
      const grandTotal = paidTotal + pendingTotal + overdueTotal;
      if (grandTotal === 0) {
        chartPend.innerHTML = `<div style="width:50px;height:50px;border-radius:50%;background:var(--border-color);display:flex;align-items:center;justify-content:center;"><div style="width:30px;height:30px;background:var(--bg-card);border-radius:50%;"></div></div>`;
      } else {
        const paidDeg = Math.round((paidTotal / grandTotal) * 360);
        const pendDeg = Math.round((pendingTotal / grandTotal) * 360);
        const ovDeg = 360 - paidDeg - pendDeg;
        chartPend.innerHTML = `
          <div style="width:52px;height:52px;border-radius:50%;background:conic-gradient(#10B981 0deg ${paidDeg}deg,#F59E0B ${paidDeg}deg ${paidDeg+pendDeg}deg,#EF4444 ${paidDeg+pendDeg}deg 360deg);position:relative;">
            <div style="position:absolute;top:10px;left:10px;right:10px;bottom:10px;background:var(--bg-card);border-radius:50%;"></div>
          </div>`;
      }
    }

    // Chart En retard (sparkline dynamique)
    const chartOver = document.getElementById('chart-overdue');
    if (chartOver) {
      const hasOverData = monthlyRevenue.some(m => m.total > 0);
      if (!hasOverData) {
        chartOver.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.7rem;opacity:0.6;">Aucune donnée</div>`;
      } else {
        const maxV = Math.max(...monthlyRevenue.map(m => m.total), 1);
        const pts2 = monthlyRevenue.map((m, i) => `${(i / 5) * 100},${40 - (m.total / maxV) * 36}`).join(' ');
        const poly2 = pts2 + ` 100,40 0,40`;
        chartOver.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
          <defs><linearGradient id="gradOver2" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#F59E0B"/><stop offset="100%" stop-color="rgba(245,158,11,0)"/></linearGradient></defs>
          <polygon points="${poly2}" fill="url(#gradOver2)" opacity="0.25"/>
          <polyline points="${pts2}" fill="none" stroke="#F59E0B" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      }
    }


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
          
          let docDate = doc.date;
          if (!docDate || docDate === 'undefined') {
            docDate = doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('fr-FR') : 'N/A';
          }
          
          return `
            <tr>
              <td>${doc.number}</td>
              <td>${doc.clientName}</td>
              <td>${docDate}</td>
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
            <div style="margin-bottom: 0.5rem;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
            <div>Aucune facture disponible</div>
          </div>
        `;
      } else {
        const linesHtml = (lastInvoice.items || []).slice(0,3).map(i => {
          const name = i.name || i.description || 'Item';
          const qty = i.quantity || i.qty || 1;
          const total = i.total || i.amount || (i.price ? i.price * qty : 0);
          return `
            <tr>
              <td style="padding-top: 0.5rem; font-size: 0.85rem;">${name}</td>
              <td style="text-align: center; padding-top: 0.5rem; font-size: 0.85rem;">${qty}</td>
              <td style="text-align: right; padding-top: 0.5rem; font-size: 0.85rem;">${formatCurrency(total)}</td>
            </tr>
          `;
        }).join('');

        let docDate = lastInvoice.date;
        if (!docDate || docDate === 'undefined') {
          docDate = lastInvoice.createdAt ? new Date(lastInvoice.createdAt).toLocaleDateString('fr-FR') : 'N/A';
        }

        widget.innerHTML = `
          <div style="background: #FFF; border-radius: 12px; padding: 2rem; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); width: 100%; border: 1px solid #E5E7EB; transform: scale(0.95); transform-origin: top center;">
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
                <div style="font-weight: 600; font-size: 0.85rem;">${lastInvoice.clientName}</div>
              </div>
              <div style="text-align: right;">
                <div style="color: #6B7280; font-size: 0.7rem; font-weight: 600;">Date</div>
                <div style="font-weight: 600; font-size: 0.85rem;">${docDate}</div>
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr>
                  <th style="text-align: left; font-size: 0.8rem; color: #6B7280; font-weight: 600; border-bottom: 1px solid #E5E7EB; padding-bottom: 0.5rem;">Item</th>
                  <th style="text-align: center; font-size: 0.8rem; color: #6B7280; font-weight: 600; border-bottom: 1px solid #E5E7EB; padding-bottom: 0.5rem;">Qty</th>
                  <th style="text-align: right; font-size: 0.8rem; color: #6B7280; font-weight: 600; border-bottom: 1px solid #E5E7EB; padding-bottom: 0.5rem;">Montant</th>
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
      paid: 'Payée',
      accepted: 'Accepté',
      overdue: 'En retard',
      sent: 'Envoyée',
      viewed: 'Vue',
      draft: 'Brouillon',
      cancelled: 'Annulée',
      refunded: 'Remboursée'
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
          <button class="btn btn-secondary btn-sm" onclick="KivoApp.viewPublicDoc('${doc.id}')" title="Voir l'aperçu"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button class="btn btn-secondary btn-sm" onclick="KivoApp.editDocument('${doc.id}')" title="Modifier la facture"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="btn btn-whatsapp btn-sm" onclick="KivoApp.shareOnWhatsApp('${doc.id}')" title="Partager WhatsApp"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg></button>
          ${doc.status === 'paid' ? `<button class="btn btn-secondary btn-sm" style="color: var(--danger-text);" onclick="KivoApp.refundInvoice('${doc.id}')" title="Rembourser la facture"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></button>` : ''}
          <button class="btn btn-danger btn-sm" onclick="KivoApp.confirmDeleteDocument('${doc.id}')" title="Supprimer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
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
  openNewDocModal: function (type = 'invoice') {
    if (!this.state) this.state = {};
    if (!this.state.business) this.state.business = JSON.parse(JSON.stringify(this.BLANK_STATE.business));
    const gSelect = document.getElementById('gallery-doc-type');
    if (gSelect) gSelect.value = type;
    const aiSelect = document.getElementById('ai-mode-doc-type');
    if (aiSelect) aiSelect.value = type;
    this.openModal('modal-new-doc-choice');
    this.switchDocCreationTab('templates');
    if (typeof this.renderTemplateGallery === 'function') {
      this.renderTemplateGallery();
    }
  },

  /**
   * Called when document type changes between invoice and quote inside the editor
   */
  updateBuilderTypeState: function () {
    const typeSelect = document.getElementById('builder-doc-type');
    const docType = typeSelect ? typeSelect.value : 'invoice';
    const titleEl = document.getElementById('builder-page-title');
    if (titleEl) {
      titleEl.textContent = (docType === 'quote') ? 'Créer un devis' : 'Créer une facture';
    }
    const docIdEl = document.getElementById('builder-doc-id');
    // If creating a fresh document (not editing an existing one), refresh the sequential number
    if (!docIdEl || !docIdEl.value) {
      const numEl = document.getElementById('builder-doc-number');
      if (numEl) {
        numEl.value = this.generateDocumentNumber(docType);
      }
    }
    this.updateLiveInvoicePreview();
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
    dueObj.setDate(dueObj.getDate() + 30);
    const dueStr = dueObj.toISOString().split('T')[0];

    // Core fields
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('builder-doc-id', '');
    setVal('builder-doc-type', type);
    setVal('builder-doc-number', nextNum);
    setVal('builder-issue-date', today);
    setVal('builder-due-date', dueStr);
    setVal('builder-doc-status', 'draft');
    setVal('builder-notes', '');
    setVal('builder-terms', 'Net 30 days');
    setVal('builder-payment-method', 'Virement bancaire');
    setVal('builder-doc-currency', this.state.business.currency || 'FCFA');
    setVal('builder-visual-template', this.state.business.visualTemplate || 'minimalist');
    const titleEl = document.getElementById('builder-page-title');
    if (titleEl) titleEl.textContent = (type === 'quote') ? 'Créer un devis' : 'Créer une facture';

    // Enterprise fields from business settings
    const biz = this.state.business;
    setVal('builder-biz-name', biz.name || '');
    setVal('builder-biz-address', biz.address || '');
    setVal('builder-biz-phone', biz.phone || '');
    setVal('builder-biz-email', biz.email || '');

    // Client select
    const clientSelect = document.getElementById('builder-doc-client-select');
    const clients = (this.state && this.state.clients) || [];
    if (clientSelect) {
      if (clients.length === 0) {
        clientSelect.innerHTML = `<option value="">-- Aucun client (Créez un client) --</option>`;
      } else {
        clientSelect.innerHTML = `<option value="">-- Sélectionner un client --</option>` + clients.map(c =>
          `<option value="${c.id}">${c.name} (${c.company || c.contactName || 'Particulier'})</option>`
        ).join('');
      }
    }

    // Clear client overrides
    setVal('builder-client-address', '');
    setVal('builder-client-phone', '');

    // Logo from business settings or builder session
    this.builderCustomLogoUrl = biz.logoUrl || null;
    if (this.builderCustomLogoUrl) {
      const logoImg = document.getElementById('builder-logo-preview-img');
      const previewBox = document.getElementById('builder-logo-preview-box');
      const uploadPrompt = document.getElementById('builder-logo-upload-prompt');
      if (logoImg) { logoImg.src = this.builderCustomLogoUrl; logoImg.style.display = 'block'; }
      if (previewBox) previewBox.style.display = 'flex';
      if (uploadPrompt) uploadPrompt.style.display = 'none';
    } else {
      const previewBox = document.getElementById('builder-logo-preview-box');
      const uploadPrompt = document.getElementById('builder-logo-upload-prompt');
      if (previewBox) previewBox.style.display = 'none';
      if (uploadPrompt) uploadPrompt.style.display = 'block';
    }

    // Items - Pre-populate realistic business items so invoice looks full and complete
    const tbody = document.getElementById('builder-items-tbody');
    if (tbody) tbody.innerHTML = '';
    this.addBuilderLineItem('Conseil & Stratégie Digitale', 1, 180000, 18);
    this.addBuilderLineItem('Développement Web & Intégration KIVO', 1, 320000, 18);
    this.addBuilderLineItem('Maintenance & Support Mensuel', 1, 65000, 18);

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

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const titleEl = document.getElementById('builder-page-title');
    if (titleEl) titleEl.textContent = (doc.type === 'quote') ? 'Modifier le devis' : 'Modifier la facture';
    setVal('builder-doc-id', doc.id);
    setVal('builder-doc-type', doc.type || 'invoice');
    setVal('builder-doc-number', doc.number);
    setVal('builder-doc-currency', doc.currency || this.state.business.currency || 'FCFA');
    setVal('builder-issue-date', doc.issueDate || new Date().toISOString().split('T')[0]);
    setVal('builder-due-date', doc.dueDate || new Date().toISOString().split('T')[0]);
    setVal('builder-doc-status', doc.status || 'sent');
    setVal('builder-notes', doc.notes || '');
    setVal('builder-terms', doc.terms || '');
    setVal('builder-payment-method', doc.paymentMethod || 'Virement bancaire');

    // Enterprise fields from business settings
    const biz = this.state.business;
    setVal('builder-biz-name', biz.name || '');
    setVal('builder-biz-address', biz.address || '');
    setVal('builder-biz-phone', biz.phone || '');
    setVal('builder-biz-email', biz.email || '');

    // Client select
    const clientSelect = document.getElementById('builder-doc-client-select');
    if (clientSelect) {
      clientSelect.innerHTML = `<option value="">-- Sélectionner un client --</option>` + this.state.clients.map(c => `
        <option value="${c.id}" ${c.id === doc.clientId ? 'selected' : ''}>${c.name} (${c.company || c.contactName || 'Particulier'})</option>
      `).join('');
    }

    // Client override fields
    setVal('builder-client-address', doc.clientAddress || '');
    setVal('builder-client-phone', doc.clientPhone || '');

    // Logo restoration
    this.builderCustomLogoUrl = doc.logoUrl !== undefined ? doc.logoUrl : (biz.logoUrl || null);
    const logoImg = document.getElementById('builder-logo-preview-img');
    const previewBox = document.getElementById('builder-logo-preview-box');
    const uploadPrompt = document.getElementById('builder-logo-upload-prompt');
    if (this.builderCustomLogoUrl) {
      if (logoImg) { logoImg.src = this.builderCustomLogoUrl; logoImg.style.display = 'block'; }
      if (previewBox) previewBox.style.display = 'flex';
      if (uploadPrompt) uploadPrompt.style.display = 'none';
    } else {
      if (previewBox) previewBox.style.display = 'none';
      if (uploadPrompt) uploadPrompt.style.display = 'block';
    }

    // Color restoration
    if (doc.primaryColor && document.getElementById('builder-color-primary')) {
      document.getElementById('builder-color-primary').value = doc.primaryColor;
      if (document.getElementById('builder-color-primary-text')) {
        document.getElementById('builder-color-primary-text').value = doc.primaryColor;
      }
    }
    if (doc.secondaryColor && document.getElementById('builder-color-secondary')) {
      document.getElementById('builder-color-secondary').value = doc.secondaryColor;
      if (document.getElementById('builder-color-secondary-text')) {
        document.getElementById('builder-color-secondary-text').value = doc.secondaryColor;
      }
    }

    const tbody = document.getElementById('builder-items-tbody');
    if (tbody) tbody.innerHTML = '';

    if (doc.items && doc.items.length > 0) {
      doc.items.forEach(it => {
        this.addBuilderLineItem(it.name, it.quantity, it.price, it.taxRate || 18);
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
  addBuilderLineItem: function (name = 'Prestation / Article', qty = 1, price = 50000, tax = 18) {
    const tbody = document.getElementById('builder-items-tbody');
    if (!tbody) return;

    const rowId = 'row_' + Math.random().toString(36).substring(2, 7);
    const tr = document.createElement('tr');
    tr.id = rowId;

    tr.innerHTML = `
      <td style="padding-bottom: 0.5rem; padding-right: 0.5rem;">
        <input type="text" class="form-input item-name" value="${name}" placeholder="Désignation du service ou produit" oninput="KivoApp.updateLiveInvoicePreview()" style="width: 100%; padding: 0.6rem; border-radius: 6px; border: 1px solid #CBD5E1; font-size: 0.85rem; outline: none; font-family: 'Inter', sans-serif;">
      </td>
      <td style="padding-bottom: 0.5rem; padding-right: 0.5rem;">
        <input type="number" class="form-input item-qty" value="${qty}" min="1" oninput="KivoApp.recalculateBuilderTotals()" style="width: 100%; padding: 0.6rem; border-radius: 6px; border: 1px solid #CBD5E1; font-size: 0.85rem; outline: none; font-family: 'Inter', sans-serif; text-align: center;">
      </td>
      <td style="padding-bottom: 0.5rem; padding-right: 0.5rem;">
        <input type="number" class="form-input item-price" value="${price}" min="0" oninput="KivoApp.recalculateBuilderTotals()" style="width: 100%; padding: 0.6rem; border-radius: 6px; border: 1px solid #CBD5E1; font-size: 0.85rem; outline: none; font-family: 'Inter', sans-serif; text-align: right;">
      </td>
      <td style="padding-bottom: 0.5rem; padding-right: 0.5rem;">
        <select class="form-select item-tax" onchange="KivoApp.recalculateBuilderTotals()" style="width: 100%; padding: 0.6rem; border-radius: 6px; border: 1px solid #CBD5E1; font-size: 0.85rem; outline: none; font-family: 'Inter', sans-serif;">
          <option value="18" ${tax == 18 ? 'selected' : ''}>18%</option>
          <option value="20" ${tax == 20 ? 'selected' : ''}>20%</option>
          <option value="10" ${tax == 10 ? 'selected' : ''}>10%</option>
          <option value="5" ${tax == 5 ? 'selected' : ''}>5%</option>
          <option value="0" ${tax == 0 ? 'selected' : ''}>0%</option>
        </select>
      </td>
      <td style="text-align: right; vertical-align: middle; padding-bottom: 0.5rem;">
        <strong class="item-total-display" style="font-size: 0.85rem; color: #0F172A;">${(qty * price).toLocaleString('fr-FR')} FCFA</strong>
      </td>
      <td style="text-align: center; vertical-align: middle; padding-bottom: 0.5rem;">
        <button class="btn btn-danger btn-sm" onclick="this.closest('tr').remove(); KivoApp.recalculateBuilderTotals(); KivoApp.updateLiveInvoicePreview();" style="background: transparent; border: none; color: #EF4444; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 4px;" title="Supprimer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </td>
    `;

    tbody.appendChild(tr);
    this.recalculateBuilderTotals();
    this.updateLiveInvoicePreview();
  },

  /**
   * Recalculates Subtotal HT, VAT amount, and Total TTC in builder
   */
  recalculateBuilderTotals: function () {
    let subtotal = 0;
    let totalTaxAmount = 0;
    const currency = document.getElementById('builder-doc-currency') ? document.getElementById('builder-doc-currency').value : (this.state.business.currency || 'FCFA');

    document.querySelectorAll('#builder-items-tbody tr').forEach(tr => {
      const qty = parseFloat(tr.querySelector('.item-qty').value) || 0;
      const price = parseFloat(tr.querySelector('.item-price').value) || 0;
      const taxRate = parseFloat(tr.querySelector('.item-tax').value) || 0;
      
      const rowTotalHT = qty * price;
      const rowTaxAmount = rowTotalHT * (taxRate / 100);
      
      tr.querySelector('.item-total-display').textContent = rowTotalHT.toLocaleString('fr-FR') + ' ' + currency;
      
      subtotal += rowTotalHT;
      totalTaxAmount += rowTaxAmount;
    });

    const grandTotal = Math.max(0, subtotal + totalTaxAmount);

    const subtotalEl = document.getElementById('builder-calc-subtotal');
    if (subtotalEl) subtotalEl.textContent = subtotal.toLocaleString('fr-FR') + ' ' + currency;
    
    const taxAmtEl = document.getElementById('builder-calc-tax-amount');
    if (taxAmtEl) taxAmtEl.textContent = totalTaxAmount.toLocaleString('fr-FR') + ' ' + currency;
    
    const totalEl = document.getElementById('builder-calc-total');
    if (totalEl) totalEl.textContent = grandTotal.toLocaleString('fr-FR') + ' ' + currency;

    this.updateLiveInvoicePreview();
  },

  /**
   * Updates Live Paper Invoice Preview in Real-Time
   */
  updateLiveInvoicePreview: function () {
    const biz = this.state.business || {};
    const tSelect = document.getElementById('builder-visual-template');
    const templateId = (tSelect && tSelect.value) ? tSelect.value : (biz.visualTemplate || 'minimalist');

    // Dynamic template engine integration
    if (window.KivoTemplates && typeof window.KivoTemplates.render === 'function') {
      const data = window.KivoTemplates.collectData(this.state);
      data.templateId = templateId;
      const renderedHtml = window.KivoTemplates.render(templateId, data);
      if (renderedHtml) {
        const previewContainer = document.getElementById('live-paper-preview-container');
        if (previewContainer) {
          previewContainer.innerHTML = renderedHtml;
          previewContainer.style.padding = '0';
          previewContainer.style.overflow = 'hidden';
          previewContainer.style.background = (templateId === 'premium') ? '#181A20' : '#FFFFFF';
        }
        const pubArea = document.getElementById('public-doc-printable-area');
        if (pubArea) {
          pubArea.innerHTML = renderedHtml;
          pubArea.style.padding = '0';
          pubArea.style.overflow = 'hidden';
          pubArea.style.background = (templateId === 'premium') ? '#181A20' : '#FFFFFF';
        }
        return;
      }
    }
    
    const docType = document.getElementById('builder-doc-type') ? document.getElementById('builder-doc-type').value : 'invoice';
    const docNum = document.getElementById('builder-doc-number') ? document.getElementById('builder-doc-number').value : 'FAC-2026-0001';
    const currency = document.getElementById('builder-doc-currency') ? document.getElementById('builder-doc-currency').value : (biz.currency || 'FCFA');
    const issueDate = document.getElementById('builder-issue-date') ? document.getElementById('builder-issue-date').value : '';
    const dueDate = document.getElementById('builder-due-date') ? document.getElementById('builder-due-date').value : '';
    const status = document.getElementById('builder-doc-status') ? document.getElementById('builder-doc-status').value : 'sent';
    const notes = document.getElementById('builder-notes') ? document.getElementById('builder-notes').value : '';
    const terms = document.getElementById('builder-terms') ? document.getElementById('builder-terms').value : '';
    const paymentMethod = document.getElementById('builder-payment-method') ? document.getElementById('builder-payment-method').value : '';
    
    // Enterprise overwrites
    const bizName = document.getElementById('builder-biz-name') ? document.getElementById('builder-biz-name').value : biz.name;
    const bizAddress = document.getElementById('builder-biz-address') ? document.getElementById('builder-biz-address').value : biz.address;
    const bizPhone = document.getElementById('builder-biz-phone') ? document.getElementById('builder-biz-phone').value : biz.phone;
    const bizEmail = document.getElementById('builder-biz-email') ? document.getElementById('builder-biz-email').value : biz.email;

    // Client overwrites
    const clientId = document.getElementById('builder-doc-client-select') ? document.getElementById('builder-doc-client-select').value : '';
    const client = this.state.clients.find(c => c.id === clientId) || { name: 'Client Destinataire' };
    
    const clientAddress = document.getElementById('builder-client-address') && document.getElementById('builder-client-address').value 
      ? document.getElementById('builder-client-address').value 
      : (client.address || '');
    const clientPhone = document.getElementById('builder-client-phone') && document.getElementById('builder-client-phone').value 
      ? document.getElementById('builder-client-phone').value 
      : (client.phone || '');

    // 1. HEADER
    const logoEl = document.getElementById('paper-logo-display');
    const logoText = document.getElementById('paper-logo-text');
    if (biz.logoUrl) {
      if(logoEl) {
        logoEl.src = biz.logoUrl;
        logoEl.style.display = 'block';
        logoEl.style.maxHeight = (biz.logoSize || 100) + 'px';
      }
      if(logoText) logoText.style.display = 'none';
      
      const headerRight = document.querySelector('#live-paper-preview-container div[style*="text-align: right"]');
      if (headerRight) {
        const pos = biz.logoPosition || 'right';
        if (pos === 'left') headerRight.style.textAlign = 'left';
        else if (pos === 'center') headerRight.style.textAlign = 'center';
        else headerRight.style.textAlign = 'right';
      }
    } else {
      if(logoEl) logoEl.style.display = 'none';
      if(logoText) {
        logoText.style.display = 'block';
        logoText.textContent = bizName ? bizName.substring(0, 8) : 'KIVO';
      }
    }

    const bizNameEl = document.getElementById('paper-biz-name');
    if (bizNameEl) bizNameEl.textContent = bizName || "KIVO MATIQUE";

    const bizAddrEl = document.getElementById('paper-biz-address');
    if (bizAddrEl) bizAddrEl.textContent = bizAddress || "";
    
    const bizPhoneEl = document.getElementById('paper-biz-phone');
    if (bizPhoneEl) bizPhoneEl.textContent = bizPhone || "";
    
    const bizEmailEl = document.getElementById('paper-biz-email');
    if (bizEmailEl) bizEmailEl.textContent = bizEmail || "";

    const paperDocTypeEl = document.getElementById('paper-doc-type');
    if (paperDocTypeEl) paperDocTypeEl.textContent = docType === 'quote' ? 'DEVIS' : 'FACTURE';

    const paperDocNumEl = document.getElementById('paper-doc-number');
    if (paperDocNumEl) paperDocNumEl.textContent = docNum;

    const paperIssueEl = document.getElementById('paper-date-issue');
    if (paperIssueEl) paperIssueEl.textContent = issueDate || '--/--/----';

    const paperDueEl = document.getElementById('paper-date-due');
    if (paperDueEl) paperDueEl.textContent = dueDate || '--/--/----';

    // 2. CLIENT
    const clientNameEl = document.getElementById('paper-client-name');
    if (clientNameEl) clientNameEl.textContent = client.name || "Client Destinataire";
    
    const clientAddrEl = document.getElementById('paper-client-address');
    if (clientAddrEl) clientAddrEl.textContent = clientAddress;
    
    const clientPhoneEl = document.getElementById('paper-client-phone');
    if (clientPhoneEl) clientPhoneEl.textContent = clientPhone;

    // 3. TABLE ITEMS
    const paperItemsTbody = document.getElementById('paper-items-tbody');
    if (paperItemsTbody) {
      const rows = [];
      let subtotal = 0;
      let totalTax = 0;

      document.querySelectorAll('#builder-items-tbody tr').forEach(tr => {
        const nameInput = tr.querySelector('.item-name');
        const qtyInput = tr.querySelector('.item-qty');
        const priceInput = tr.querySelector('.item-price');
        const taxSelect = tr.querySelector('.item-tax');

        const name = nameInput ? nameInput.value : '';
        const qty = parseFloat(qtyInput ? qtyInput.value : 1) || 1;
        const price = parseFloat(priceInput ? priceInput.value : 0) || 0;
        const taxRate = parseFloat(taxSelect ? taxSelect.value : 0) || 0;
        
        const totalHT = qty * price;
        const taxAmount = totalHT * (taxRate / 100);

        // Always push even if name is blank — so freshly-added rows appear immediately
        subtotal += totalHT;
        totalTax += taxAmount;
        rows.push(`
          <tr>
            <td style="padding: 0.75rem 0; font-size: 0.85rem; color: #475569; border-bottom: 1px solid #E2E8F0;">${name || 'Nouvelle prestation'}</td>
            <td style="text-align: center; padding: 0.75rem 0; font-size: 0.85rem; color: #475569; border-bottom: 1px solid #E2E8F0;">${qty}</td>
            <td style="text-align: right; padding: 0.75rem 0; font-size: 0.85rem; color: #475569; border-bottom: 1px solid #E2E8F0;">${price.toLocaleString('fr-FR')} ${currency}</td>
            <td style="text-align: center; padding: 0.75rem 0; font-size: 0.85rem; color: #475569; border-bottom: 1px solid #E2E8F0;">${taxRate}%</td>
            <td style="text-align: right; padding: 0.75rem 0; font-size: 0.85rem; color: #0F172A; font-weight: 600; border-bottom: 1px solid #E2E8F0;">${totalHT.toLocaleString('fr-FR')} ${currency}</td>
          </tr>
        `);
      });

      if (rows.length === 0) {
        paperItemsTbody.innerHTML = `<tr><td colspan="5" style="color: var(--text-muted); text-align: center; padding: 1rem;">Saisissez au moins un article...</td></tr>`;
      } else {
        paperItemsTbody.innerHTML = rows.join('');
      }

      const grandTotal = Math.max(0, subtotal + totalTax);

      const subtotalEl = document.getElementById('paper-subtotal');
      if (subtotalEl) subtotalEl.textContent = subtotal.toLocaleString('fr-FR') + ' ' + currency;
      
      const taxAmtEl = document.getElementById('paper-tax-amount');
      if (taxAmtEl) taxAmtEl.textContent = totalTax.toLocaleString('fr-FR') + ' ' + currency;
      
      const totalEl = document.getElementById('paper-grand-total');
      if (totalEl) totalEl.textContent = grandTotal.toLocaleString('fr-FR') + ' ' + currency;
    }

    // 4. BOTTOM NOTES & TERMS
    const methodEl = document.getElementById('paper-payment-method');
    if (methodEl) methodEl.textContent = paymentMethod || "Virement bancaire";
    
    const termsEl = document.getElementById('paper-terms-text');
    if (termsEl) termsEl.textContent = terms || "Net 30 days";
    
    const notesEl = document.getElementById('paper-notes-text');
    if (notesEl) {
      if (notes) {
        notesEl.style.display = 'block';
        notesEl.textContent = notes;
      } else {
        notesEl.style.display = 'none';
      }
    }

    // Stamp watermark
    const watermarkEl = document.getElementById('paper-watermark-stamp');
    if (watermarkEl) {
      if (status === 'paid') {
        watermarkEl.style.display = 'block';
        watermarkEl.textContent = 'PAYÉE';
        watermarkEl.style.color = '#10B981';
        watermarkEl.style.borderColor = '#10B981';
      } else if (status === 'refunded') {
        watermarkEl.style.display = 'block';
        watermarkEl.textContent = 'REMBOURSÉE';
        watermarkEl.style.color = '#EF4444';
        watermarkEl.style.borderColor = '#EF4444';
      } else {
        watermarkEl.style.display = 'none';
      }
    }

    // Update visuals if template is selected (if functionality exists)
    if (typeof this.updateDocumentPreviewVisuals === 'function') {
      try {
        this.updateDocumentPreviewVisuals();
      } catch(e) {}
    }
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

    const msg = `Bonjour ${client.name},\n\nVoici le document *${docNum}* d'un montant de *${grandTotal}* émis par *${this.state.business.name}*.\n\nN'hésitez pas si vous avez des questions !\nKIVO MATIQUE`;
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
      <div class="kivo-template-card" data-template="${t.id}" style="cursor:pointer;" onclick="KivoApp.startTemplateDocument('${docType}', '${t.id}')">
        <div class="kivo-template-card-preview" style="height: 140px; padding: 0.75rem 1rem 0 1rem;">
          ${window.KivoTemplates.miniPreview(t.id, this.state.business?.primaryColor)}
        </div>
        <div class="kivo-template-card-body" style="padding: 1rem;">
          <h3 class="kivo-template-card-title" style="font-size:0.9rem; margin-bottom:0.25rem;">${t.name}</h3>
          <p class="kivo-template-card-desc" style="font-size:0.75rem; margin-bottom:0;">${t.desc}</p>
        </div>
      </div>
    `).join('');

    // Custom templates
    const cGallery = document.getElementById('gallery-custom');
    if (cGallery) {
      const customs = this.state.business?.customTemplates || [];
      if (customs.length === 0) {
        cGallery.innerHTML = `<div style="color:var(--text-muted); font-size:0.8rem; padding:1rem; grid-column:1/-1;">Aucun modèle personnalisé sauvegardé.</div>`;
      } else {
        cGallery.innerHTML = customs.map((t, idx) => `
          <div class="kivo-template-card" style="cursor:pointer; position:relative;" onclick="KivoApp.startTemplateDocument('${docType}', '${t.id}', true)">
            <div class="kivo-template-card-preview" style="height: 140px; padding: 0.75rem 1rem 0 1rem;">
              ${window.KivoTemplates.miniPreview(t.id, t.primaryColor)}
            </div>
            <div class="kivo-template-card-body" style="padding: 1rem;">
              <h3 class="kivo-template-card-title" style="font-size:0.9rem; margin-bottom:0.25rem;">${t.name}</h3>
              <p class="kivo-template-card-desc" style="font-size:0.75rem; margin-bottom:0;">Modèle personnalisé</p>
            </div>
            <button class="btn btn-sm" style="position:absolute; top:8px; right:8px; padding:4px 8px; background:rgba(0,0,0,0.6); color:white; border:none; border-radius:4px; z-index: 10;" onclick="event.stopPropagation(); KivoApp.deleteCustomTemplate(${idx})">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            </button>
          </div>
        `).join('');
      }
    }
  },

  openTemplateModal: function () {
    this.openModal('modal-new-doc-choice');
    this.switchDocCreationTab('templates');
  },

  openAIMenu: function () {
    this.openModal('modal-new-doc-choice');
    this.switchDocCreationTab('ai');
  },

  startTemplateDocument: function (type, templateId, isCustom = false) {
    this.closeModal('modal-new-doc-choice');
    
    // If not in builder yet, start new document
    const builderSection = document.getElementById('view-document-builder');
    const isAlreadyInBuilder = builderSection && builderSection.style.display !== 'none';
    if (!isAlreadyInBuilder) {
      this.startNewDocument(type);
    }

    const selectEl = document.getElementById('builder-visual-template');
    if (selectEl) selectEl.value = templateId;

    if (!this.state.business) this.state.business = {};
    this.state.business.visualTemplate = templateId;

    if (isCustom) {
      const customs = this.state.business?.customTemplates || [];
      const t = customs.find(c => c.id === templateId);
      if (t) {
        const cp = document.getElementById('builder-color-primary');
        if (cp) cp.value = t.primaryColor || '#4F46E5';
        const cs = document.getElementById('builder-color-secondary');
        if (cs) cs.value = t.secondaryColor || '#6366F1';
      }
    }

    this.navigate('document-builder');
    this.onBuilderTemplateChange(templateId);
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
      btn.innerHTML = `Générer la structure`;
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
      this.showToast("KIVO MATIQUE AI : Formulaire complété avec succès !", "success");
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
        this.showToast("Limite atteinte : Le forfait Gratuit est limité à 3 factures par mois. Veuillez passer au forfait PRO.", "danger");
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
    let totalTaxAmount = 0;
    document.querySelectorAll('#builder-items-tbody tr').forEach(tr => {
      const name = tr.querySelector('.item-name').value;
      const qty = parseFloat(tr.querySelector('.item-qty').value) || 1;
      const price = parseFloat(tr.querySelector('.item-price').value) || 0;
      const taxRate = parseFloat(tr.querySelector('.item-tax') ? tr.querySelector('.item-tax').value : 18) || 0;
      const totalHT = qty * price;
      const taxAmount = totalHT * (taxRate / 100);
      if (name) {
        items.push({ name, quantity: qty, price, taxRate, total: totalHT + taxAmount, totalHT });
        subtotal += totalHT;
        totalTaxAmount += taxAmount;
      }
    });

    const grandTotal = Math.max(0, subtotal + totalTaxAmount);
    const discount = 0;
    const taxRate = 0; // Per-line taxes used instead

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
      tax: totalTaxAmount,
      total: grandTotal,
      amountPaid: status === 'paid' ? grandTotal : 0,
      notes: notes,
      terms: terms,
      logoUrl: this.builderCustomLogoUrl !== undefined ? this.builderCustomLogoUrl : (this.state.business && this.state.business.logoUrl) || null,
      primaryColor: document.getElementById('builder-color-primary') ? document.getElementById('builder-color-primary').value : null,
      secondaryColor: document.getElementById('builder-color-secondary') ? document.getElementById('builder-color-secondary').value : null,
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
          this.showToast("Ce document n'existe pas ou a été supprimé.", "danger");
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
        this.showToast("Erreur de chargement du document.", "danger");
        return;
      }
    }

    if (!doc) {
      this.showToast("Document non trouvé.", "danger");
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
      paid: 'Payée',
      accepted: 'Devis Accepté',
      overdue: 'En retard',
      sent: 'Envoyée',
      viewed: 'Vue par le client',
      refunded: 'Remboursée'
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
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:5px;"><polyline points="20 6 9 17 4 12"/></svg>
          Accepter le devis
        </button>
        <button class="btn btn-secondary" onclick="KivoApp.downloadPdf()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:middle; margin-right:5px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Télécharger PDF
        </button>
      `;
    } else if (doc.type === 'invoice' && doc.status !== 'paid' && doc.status !== 'refunded') {
      btnContainer.innerHTML = `
        <button class="btn btn-primary" onclick="KivoApp.openPaymentModal('${doc.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:middle; margin-right:5px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Payer en ligne (${(doc.total).toLocaleString('fr-FR')} ${currencyStr})
        </button>
        <button class="btn btn-secondary" onclick="KivoApp.downloadPdf()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:middle; margin-right:5px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Télécharger PDF
        </button>
        <button class="btn btn-secondary" onclick="KivoApp.printPdf()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:middle; margin-right:5px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Imprimer
        </button>
        <button class="btn btn-whatsapp" onclick="KivoApp.shareOnWhatsApp('${doc.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block; vertical-align:middle; margin-right:5px;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          WhatsApp
        </button>
      `;
    } else {
      btnContainer.innerHTML = `
        <button class="btn btn-secondary" onclick="KivoApp.downloadPdf()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:middle; margin-right:5px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Télécharger PDF
        </button>
        <button class="btn btn-secondary" onclick="KivoApp.printPdf()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:middle; margin-right:5px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Imprimer
        </button>
        <button class="btn btn-whatsapp" onclick="KivoApp.shareOnWhatsApp('${doc.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block; vertical-align:middle; margin-right:5px;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          WhatsApp
        </button>
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
        title: `Devis #${doc.number} accepté`,
        details: `Validé par ${doc.clientName}`
      });

      this.saveState();
      this.showToast("Félicitations ! Devis accepté par le client.", "success");
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
          <span style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px;">${p.icon}</span>
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
      btn.textContent = "Confirmer le paiement instantané";
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
          <button class="btn btn-secondary btn-sm" onclick="KivoApp.openClientDetails('${c.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="10" r="3"/></svg> Détails</button>
          <button class="btn btn-secondary btn-sm" onclick="KivoApp.startNewDocumentForClient('${c.id}')">+ Facturer</button>
          <button class="btn btn-danger btn-sm" onclick="KivoApp.confirmDeleteClient('${c.id}')" title="Supprimer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
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
      if (client.email) parts.push(`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> ${client.email}`);
      if (client.phone) parts.push(`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> ${client.phone}`);
      if (client.address) parts.push(`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${client.address}`);
      if (client.taxId) parts.push(`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> SIRET/NINEA : ${client.taxId}`);
      if (client.company) parts.push(`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> ${client.company}`);
      contactEl.innerHTML = parts.map(p => `<span style="display:inline-flex;align-items:center;gap:4px;">${p}</span>`).join('');
    }

    // Fill document history
    const listEl = document.getElementById('crm-doc-list');
    if (listEl) {
      if (clientDocs.length === 0) {
        listEl.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 1rem;">Aucun document pour ce client.</p>`;
      } else {
        const statusLabel = { draft: 'Brouillon', sent: 'Envoyée', viewed: 'Consultée', paid: 'Payée', accepted: 'Acceptée', overdue: 'Impayée', refunded: 'Remboursée' };
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
    const container = document.getElementById('templates-grid-kivo');
    if (!container) return;

    const currentTmpl = this.state.business?.visualTemplate || 'minimalist';

    if (window.KivoTemplates && KivoTemplates.builtIn) {
      container.innerHTML = KivoTemplates.builtIn.map(tmpl => {
        const isActive = tmpl.id === currentTmpl;
        return `
          <div class="kivo-template-card ${isActive ? 'active-card' : ''}" data-template="${tmpl.id}">
            <div class="kivo-template-card-preview">
              ${KivoTemplates.miniPreview(tmpl.id)}
            </div>
            <div class="kivo-template-card-body">
              <h3 class="kivo-template-card-title">${tmpl.name}</h3>
              <p class="kivo-template-card-desc">${tmpl.desc}</p>
              <button class="kivo-template-card-btn ${isActive ? 'active-template-btn' : ''}" onclick="KivoApp.useTemplate('${tmpl.id}')">
                ${isActive ? 'Modèle actif' : 'Utiliser ce modèle'}
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
    
    // Setup tabs logic if not already setup
    if (!this._templatesTabsSetup) {
      document.querySelectorAll('.kivo-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          document.querySelectorAll('.kivo-tab').forEach(t => t.classList.remove('active'));
          e.currentTarget.classList.add('active');
          
          const tabId = e.currentTarget.getAttribute('data-tab');
          document.querySelectorAll('.kivo-templates-grid').forEach(grid => grid.style.display = 'none');
          
          const activeGrid = document.getElementById(`templates-grid-${tabId}`);
          if (activeGrid) activeGrid.style.display = 'grid';
        });
      });
      this._templatesTabsSetup = true;
    }
  },

  useTemplate: function (templateId) {
    // 1. Update business template in state
    this.state.business = this.state.business || {};
    this.state.business.visualTemplate = templateId;
    
    // Set appropriate colors based on template selection
    const colorMap = {
      minimalist: '#0F172A',
      corporate:  '#1E3A5F',
      elegant:    '#B8860B',
      modern:     '#8B5CF6',
      clean:      '#0E7490',
      editorial:  '#EF4444',
      premium:    '#C87D55'
    };
    if (colorMap[templateId]) {
      this.state.business.primaryColor = colorMap[templateId];
    }
    
    // 2. Save implicitly to localStorage (and Supabase if connected)
    this.saveState();
    
    const tmplObj = window.KivoTemplates?.builtIn?.find(t => t.id === templateId);
    const tmplName = tmplObj ? tmplObj.name : templateId;
    this.showToast(`Modèle "${tmplName}" sélectionné et appliqué !`, 'success');

    // 3. Re-render catalog so active checkmark updates immediately
    this.renderCatalog();

    // 4. Open invoice document with this template applied
    this.startNewDocument('invoice');
  },

  onBuilderTemplateChange: function (templateId) {
    this.state.business = this.state.business || {};
    this.state.business.visualTemplate = templateId;
    this.saveState();
    this.updateLiveInvoicePreview();
    const tmplObj = window.KivoTemplates?.builtIn?.find(t => t.id === templateId);
    if (tmplObj) {
      this.showToast(`Modèle "${tmplObj.name}" appliqué à cette facture`, 'success');
    }
  },

  openTemplateEditor: function () {
    // Basic interaction for "Créer mon modèle"
    this.showToast("L'éditeur de modèles personnalisés sera bientôt disponible.", 'info');
  },

  renderReminders: function () {
    const listEl = document.getElementById('reminders-doc-list');
    if (!listEl) return;

    const overdueDocs = this.state.documents.filter(d => d.type === 'invoice' && d.status !== 'paid' && d.status !== 'refunded');

    if (overdueDocs.length === 0) {
      listEl.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">Aucune facture en attente de relance !</p>`;
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

  renderAnalytics: function () {
    const container = document.getElementById('analytics-content');
    if (!container) return;

    const docs = (this.state && this.state.documents) || [];

    if (docs.length === 0) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 4.5rem 2rem; max-width: 640px; margin: 2rem auto; border: 1px dashed var(--border-color); border-radius: 16px; background: var(--bg-card);">
          <div style="width: 64px; height: 64px; border-radius: 16px; background: rgba(79, 70, 229, 0.08); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; color: var(--primary);">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
          </div>
          <h3 style="font-size: 1.3rem; font-weight: 700; margin-bottom: 0.6rem; color: var(--text-primary); font-family: var(--font-heading);">
            Aucune donnée statistique pour l'instant
          </h3>
          <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.6; max-width: 480px; margin: 0 auto 2rem;">
            Créez et émettez vos premiers devis et factures. Vos statistiques de chiffre d'affaires, taux de recouvrement, conversion et top clients apparaîtront ici automatiquement.
          </p>
          <button class="btn btn-primary" onclick="KivoApp.openNewDocModal('invoice')" style="padding: 0.75rem 1.75rem; font-size: 0.95rem; display: inline-flex; align-items: center; gap: 0.5rem; margin: 0 auto;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Créer mon premier document</span>
          </button>
        </div>
      `;
      return;
    }

    // Calculations
    const invoices = docs.filter(d => d.type === 'invoice');
    const quotes = docs.filter(d => d.type === 'quote');

    let paidTotal = 0;
    let pendingTotal = 0;
    let overdueTotal = 0;
    let paidCount = 0;

    invoices.forEach(doc => {
      const tot = doc.total || 0;
      if (doc.status === 'paid') {
        paidTotal += tot;
        paidCount++;
      } else if (doc.status === 'overdue') {
        overdueTotal += tot;
      } else if (doc.status === 'sent' || doc.status === 'viewed') {
        pendingTotal += tot;
      }
    });

    const totalInvoiced = paidTotal + pendingTotal + overdueTotal;
    const recoveryRate = totalInvoiced > 0 ? Math.round((paidTotal / totalInvoiced) * 100) : 0;

    const acceptedQuotesCount = quotes.filter(q => q.status === 'accepted' || q.status === 'converted').length;
    const quoteAcceptanceRate = quotes.length > 0 ? Math.round((acceptedQuotesCount / quotes.length) * 100) : 0;

    // Top clients
    const clientRevenueMap = {};
    docs.forEach(d => {
      const cName = d.clientName || 'Client divers';
      if (!clientRevenueMap[cName]) {
        clientRevenueMap[cName] = { total: 0, docCount: 0, paidTotal: 0 };
      }
      clientRevenueMap[cName].total += (d.total || 0);
      clientRevenueMap[cName].docCount += 1;
      if (d.status === 'paid') {
        clientRevenueMap[cName].paidTotal += (d.total || 0);
      }
    });

    const topClients = Object.entries(clientRevenueMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const maxClientTotal = topClients.length > 0 ? topClients[0].total : 1;

    // Last 6 months revenues
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const now = new Date();
    const monthlyStats = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const y = d.getFullYear();
      const label = `${monthNames[mIdx]} ${y.toString().slice(-2)}`;
      
      let mPaid = 0;
      let mInvoiced = 0;

      invoices.forEach(inv => {
        if (!inv.issueDate) return;
        const invDate = new Date(inv.issueDate);
        if (invDate.getFullYear() === y && invDate.getMonth() === mIdx) {
          mInvoiced += (inv.total || 0);
          if (inv.status === 'paid') {
            mPaid += (inv.total || 0);
          }
        }
      });

      monthlyStats.push({ label, paid: mPaid, invoiced: mInvoiced });
    }

    const maxMonthlyVal = Math.max(...monthlyStats.map(m => Math.max(m.invoiced, m.paid)), 1);

    container.innerHTML = `
      <!-- KPI Cards Row -->
      <div class="kpi-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.25rem; margin-bottom: 2rem;">
        <div class="card kpi-card" style="padding: 1.35rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <span class="kpi-title" style="color: var(--text-muted); font-size: 0.85rem; font-weight: 500;">CA Encaissé</span>
            <span style="display: inline-flex; padding: 4px; border-radius: 8px; background: rgba(16, 185, 129, 0.1); color: #10B981;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
          </div>
          <div class="kpi-value" style="font-size: 1.6rem; font-weight: 700; color: #10B981; font-family: var(--font-heading); margin-bottom: 0.25rem;">
            ${this.formatCurrency(paidTotal)}
          </div>
          <span class="kpi-subtext" style="font-size: 0.8rem; color: var(--text-muted);">${paidCount} facture(s) réglée(s)</span>
        </div>

        <div class="card kpi-card" style="padding: 1.35rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <span class="kpi-title" style="color: var(--text-muted); font-size: 0.85rem; font-weight: 500;">En attente de règlement</span>
            <span style="display: inline-flex; padding: 4px; border-radius: 8px; background: rgba(245, 158, 11, 0.1); color: #F59E0B;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </span>
          </div>
          <div class="kpi-value" style="font-size: 1.6rem; font-weight: 700; color: #F59E0B; font-family: var(--font-heading); margin-bottom: 0.25rem;">
            ${this.formatCurrency(pendingTotal + overdueTotal)}
          </div>
          <span class="kpi-subtext" style="font-size: 0.8rem; color: var(--text-muted);">${overdueTotal > 0 ? `${this.formatCurrency(overdueTotal)} en retard` : 'Aucun retard critique'}</span>
        </div>

        <div class="card kpi-card" style="padding: 1.35rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <span class="kpi-title" style="color: var(--text-muted); font-size: 0.85rem; font-weight: 500;">Taux de recouvrement</span>
            <span style="display: inline-flex; padding: 4px; border-radius: 8px; background: rgba(79, 70, 229, 0.1); color: var(--primary);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </span>
          </div>
          <div class="kpi-value" style="font-size: 1.6rem; font-weight: 700; color: var(--text-primary); font-family: var(--font-heading); margin-bottom: 0.25rem;">
            ${recoveryRate}%
          </div>
          <span class="kpi-subtext" style="font-size: 0.8rem; color: var(--text-muted);">Sur ${this.formatCurrency(totalInvoiced)} facturé</span>
        </div>

        <div class="card kpi-card" style="padding: 1.35rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <span class="kpi-title" style="color: var(--text-muted); font-size: 0.85rem; font-weight: 500;">Acceptation des Devis</span>
            <span style="display: inline-flex; padding: 4px; border-radius: 8px; background: rgba(99, 102, 241, 0.1); color: #6366F1;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </span>
          </div>
          <div class="kpi-value" style="font-size: 1.6rem; font-weight: 700; color: var(--text-primary); font-family: var(--font-heading); margin-bottom: 0.25rem;">
            ${quotes.length > 0 ? `${quoteAcceptanceRate}%` : '—'}
          </div>
          <span class="kpi-subtext" style="font-size: 0.8rem; color: var(--text-muted);">${acceptedQuotesCount} sur ${quotes.length} devis accepté(s)</span>
        </div>
      </div>

      <!-- Charts & Top Clients Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        
        <!-- Monthly Revenue Evolution -->
        <div class="card" style="padding: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <div>
              <h3 style="margin: 0; font-size: 1.05rem; font-weight: 600;">Évolution mensuelle</h3>
              <p style="margin: 2px 0 0; font-size: 0.8rem; color: var(--text-muted);">Facturation et encaissements des 6 derniers mois</p>
            </div>
            <div style="display: flex; gap: 1rem; font-size: 0.75rem;">
              <span style="display: flex; align-items: center; gap: 0.35rem; color: var(--text-muted);"><span style="width: 8px; height: 8px; border-radius: 2px; background: #10B981;"></span> Encaissé</span>
              <span style="display: flex; align-items: center; gap: 0.35rem; color: var(--text-muted);"><span style="width: 8px; height: 8px; border-radius: 2px; background: #E0E7FF;"></span> Émis</span>
            </div>
          </div>

          <div style="height: 190px; display: flex; align-items: flex-end; justify-content: space-between; gap: 0.75rem; padding-top: 1rem; border-bottom: 1px solid var(--border-color);">
            ${monthlyStats.map(m => {
              const billedPct = maxMonthlyVal > 0 ? Math.max(8, Math.round((m.invoiced / maxMonthlyVal) * 100)) : 8;
              const paidPct = maxMonthlyVal > 0 ? Math.max(4, Math.round((m.paid / maxMonthlyVal) * 100)) : 4;
              return `
                <div style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end;">
                  <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 4px; font-weight: 500;">
                    ${m.paid > 0 ? this.formatCurrency(m.paid) : (m.invoiced > 0 ? this.formatCurrency(m.invoiced) : '-')}
                  </div>
                  <div style="width: 100%; max-width: 38px; display: flex; gap: 3px; align-items: flex-end; height: 130px;">
                    <div style="flex: 1; height: ${billedPct}%; background: #E0E7FF; border-radius: 4px 4px 0 0;" title="Total émis: ${this.formatCurrency(m.invoiced)}"></div>
                    <div style="flex: 1; height: ${paidPct}%; background: #10B981; border-radius: 4px 4px 0 0;" title="Encaissé: ${this.formatCurrency(m.paid)}"></div>
                  </div>
                  <span style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px;">${m.label}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Top Clients -->
        <div class="card" style="padding: 1.5rem;">
          <div style="margin-bottom: 1.5rem;">
            <h3 style="margin: 0; font-size: 1.05rem; font-weight: 600;">Top Clients</h3>
            <p style="margin: 2px 0 0; font-size: 0.8rem; color: var(--text-muted);">Répartition du volume d'affaires par client</p>
          </div>

          ${topClients.length === 0 ? `
            <p style="color: var(--text-muted); font-size: 0.9rem; text-align: center; padding: 2rem 0;">Aucun client enregistré.</p>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
              ${topClients.map((client, idx) => {
                const pct = maxClientTotal > 0 ? Math.round((client.total / maxClientTotal) * 100) : 0;
                return `
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                      <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="width: 22px; height: 22px; border-radius: 50%; background: #F3F4F6; color: var(--text-secondary); font-size: 0.75rem; display: flex; align-items: center; justify-content: center; font-weight: 600;">${idx + 1}</span>
                        <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">${client.name}</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted);">(${client.docCount} doc${client.docCount > 1 ? 's' : ''})</span>
                      </div>
                      <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary); font-family: var(--font-heading);">
                        ${this.formatCurrency(client.total)}
                      </span>
                    </div>
                    <div style="height: 6px; width: 100%; background: #F3F4F6; border-radius: 999px; overflow: hidden;">
                      <div style="height: 100%; width: ${pct}%; background: var(--primary); border-radius: 999px;"></div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

      </div>
    `;
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
      const rawMsg = result.error.message || '';
      let friendlyMsg = "Email ou mot de passe incorrect.";
      if (rawMsg.includes('Email not confirmed')) {
        friendlyMsg = "Votre email n'a pas encore été confirmé. Vérifiez votre boîte mail.";
      } else if (rawMsg.includes('Too many requests')) {
        friendlyMsg = "Trop de tentatives. Veuillez patienter quelques minutes.";
      } else if (rawMsg.includes('User not found') || rawMsg.includes('user not found')) {
        friendlyMsg = "Aucun compte trouvé avec cet email.";
      }
      this.showToast(friendlyMsg, "error");
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

    // Pass full_name so it's stored in Supabase user metadata & prefilled in onboarding
    const result = await KivoAuth.signUp(email, pwd, name);

    if (btn) { btn.disabled = false; btn.textContent = 'Créer mon compte'; }

    if (result.error) {
      this.showToast(result.error.message || "Erreur lors de l'inscription.", "error");
    } else {
      // Store the display name locally for onboarding prefill
      this.state.userEmail = email;
      this.state.business.owner = name;
      this.state.business.email = email;
      this.saveState();

      const needsConfirmation = !result.data?.session; // Supabase email confirmation required
      if (needsConfirmation) {
        this.showToast("Compte créé ! Vérifiez votre boîte email pour confirmer votre inscription, puis revenez vous connecter.", "success");
      } else {
        this.showToast(`Compte créé ! Configurons votre entreprise...`, "success");
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
            opt.textContent = `${code}`;
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
    // NEUTRALIZED: no more fake accounts. Pre-fill from real auth user instead.
    this.prefillOnboardingWithAuthUser(window.KivoAuth?.user || null);
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

    // Sync to Supabase immediately after onboarding
    if (window.KivoDb && this.supabaseConnected) {
      window.KivoDb.saveSettings({
        company_name: bizName,
        owner: bizOwner,
        email: bizEmail,
        phone: fullPhone,
        industry: bizIndustry,
        country: bizCountry,
        currency: bizCurrency,
        fiscal_id: bizTaxId,
        current_plan: this.selectedOnboardPlan || 'Gratuit',
        invoice_prefix: biz.invoicePrefix || 'FAC-2026-',
        quote_prefix: biz.quotePrefix || 'DEV-2026-',
        default_vat_rate: biz.defaultVatRate || 18,
        logo_url: biz.logoUrl || '',
        visual_template: biz.visualTemplate || 'classic',
        primary_color: biz.primaryColor || '#4F46E5',
        secondary_color: biz.secondaryColor || '#7C3AED'
      }).catch(e => console.error('[KivoApp] Supabase onboarding saveSettings error:', e));
    }

    this.showToast(`Bienvenue sur KIVO MATIQUE, ${bizOwner} ! Espace prêt.`, "success");
    this.navigate('dashboard');
  },

  switchSubscriptionTier: function (tier) {
    this.state.business.subscriptionTier = tier;
    this.state.business.subscriptionStatus = 'active';
    this.saveState();
    this.renderSettings();
    this.showToast(`Forfait ${tier} (KIVO MATIQUE) activé !`, "success");
  },

  renderSettings: function () {
    const biz = this.state.business;
    if (document.getElementById('setting-biz-name')) document.getElementById('setting-biz-name').value = biz.name || '';
    if (document.getElementById('setting-biz-owner')) document.getElementById('setting-biz-owner').value = biz.owner || '';
    if (document.getElementById('setting-biz-phone')) document.getElementById('setting-biz-phone').value = biz.phone || '';
    if (document.getElementById('setting-biz-email')) document.getElementById('setting-biz-email').value = biz.email || '';
    if (document.getElementById('setting-biz-pro-email')) document.getElementById('setting-biz-pro-email').value = biz.proEmail || biz.email || '';
    if (document.getElementById('setting-biz-website')) document.getElementById('setting-biz-website').value = biz.website || '';
    if (document.getElementById('setting-biz-address')) document.getElementById('setting-biz-address').value = biz.address || '';
    if (document.getElementById('setting-biz-taxid')) document.getElementById('setting-biz-taxid').value = biz.taxId || '';
    if (document.getElementById('setting-biz-currency')) document.getElementById('setting-biz-currency').value = biz.currency || 'FCFA';
    if (document.getElementById('setting-biz-prefix')) document.getElementById('setting-biz-prefix').value = biz.invoicePrefix || "FAC-2026-";
    if (document.getElementById('setting-biz-quote-prefix')) document.getElementById('setting-biz-quote-prefix').value = biz.quotePrefix || "DEV-2026-";
    if (document.getElementById('setting-biz-vat')) document.getElementById('setting-biz-vat').value = biz.defaultVatRate || 18;
    if (document.getElementById('setting-stripe-key')) document.getElementById('setting-stripe-key').value = biz.stripeKey || "pk_test_51KivoMastiqueDemoStripeKey998";
    if (document.getElementById('setting-biz-language')) document.getElementById('setting-biz-language').value = this.state.language || "fr";

    // ── Profile Identity Card (Column 1) ─────────────────────────────────
    const displayName = biz.owner || biz.name || 'Mon Compte';
    const displayEmail = biz.email || 'contact@entreprise.com';

    const nameDisplay = document.getElementById('profile-id-name-display');
    const emailDisplay = document.getElementById('profile-id-email-display');
    if (nameDisplay) nameDisplay.textContent = displayName;
    if (emailDisplay) emailDisplay.textContent = displayEmail;

    // Restore logo in avatar circle
    const avatarSvg = document.getElementById('profile-avatar-svg');
    const avatarImg = document.getElementById('profile-avatar-img');
    if (avatarSvg && avatarImg) {
      if (biz.logoUrl) {
        avatarSvg.style.display = 'none';
        avatarImg.src = biz.logoUrl;
        avatarImg.style.display = 'block';
      } else {
        avatarSvg.style.display = '';
        avatarImg.style.display = 'none';
      }
    }

    // Restore logo in the upload box
    const previewArea = document.getElementById('profile-logo-preview');
    if (previewArea && biz.logoUrl) {
      previewArea.innerHTML = `<img src="${biz.logoUrl}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;" alt="Logo">`;
    }

    // Status badge — show subscription tier
    const tier = biz.subscriptionTier || 'Pro';
    const statusBadge = document.getElementById('profile-status-badge');
    if (statusBadge) {
      statusBadge.textContent = 'Compte Actif';
    }

    const badgeEl = document.getElementById('settings-current-plan-badge');
    if (badgeEl) {
      badgeEl.textContent = `Forfait Actif : ${tier.toUpperCase()}`;
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
    if (document.getElementById('setting-biz-pro-email')) biz.proEmail = document.getElementById('setting-biz-pro-email').value;
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
        primary_color: biz.primaryColor || '#4F46E5',
        secondary_color: biz.secondaryColor || '#7C3AED',
        logo_size: biz.logoSize || 100,
        logo_position: biz.logoPosition || 'right',
        invoice_page_size: biz.invoicePageSize || 'a4'
      }).catch(e => console.error('[KivoApp] Supabase saveSettings error:', e));
    }

    this.showToast("Paramètres KIVO MATIQUE enregistrés !", "success");
    this.updateUserBrandingUI();
  },

  // ── Profile Page: Security & Logo Functions ──────────────────────────────

  /**
   * Opens the Change Password modal and resets its form
   */
  openChangePasswordModal: function () {
    const form = document.getElementById('form-change-password');
    if (form) form.reset();
    const errEl = document.getElementById('profile-password-error');
    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    this.openModal('modal-change-password');
  },

  /**
   * Opens the Connected Accounts modal and populates the user's email
   */
  openConnectedAccountsModal: function () {
    const emailEl = document.getElementById('modal-conn-email-text');
    if (emailEl) {
      const userEmail = (this.state && this.state.business && this.state.business.email)
        || (window.KivoAuth && window.KivoAuth.currentUser && window.KivoAuth.currentUser.email)
        || 'Compte principal KIVO';
      emailEl.textContent = userEmail;
    }
    this.openModal('modal-connected-accounts');
  },

  /**
   * Submits a password change via Supabase Auth
   */
  submitPasswordChange: async function () {
    const newPwd = (document.getElementById('profile-new-password') || {}).value || '';
    const confirmPwd = (document.getElementById('profile-confirm-password') || {}).value || '';
    const errEl = document.getElementById('profile-password-error');
    const btn = document.getElementById('btn-submit-pwd-change');

    const showError = (msg) => {
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
    };

    if (!newPwd || newPwd.length < 6) {
      return showError('Le mot de passe doit contenir au moins 6 caractères.');
    }
    if (newPwd !== confirmPwd) {
      return showError('Les mots de passe ne correspondent pas.');
    }

    if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
    if (btn) { btn.disabled = true; btn.textContent = 'Mise à jour…'; }

    try {
      if (window.KivoDb && window.KivoDb.supabase) {
        const { error } = await window.KivoDb.supabase.auth.updateUser({ password: newPwd });
        if (error) throw error;
      }
      this.closeModal('modal-change-password');
      this.showToast('Mot de passe mis à jour avec succès !', 'success');
    } catch (err) {
      showError(err.message || 'Erreur lors de la mise à jour du mot de passe.');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Mettre à jour'; }
    }
  },

  /**
   * Handles logo file upload from the profile page logo upload box.
   * Shows a live preview in both the upload box and the avatar circle.
   */
  handleProfileLogoUpload: function (files) {
    if (!files || !files[0]) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      this.showToast('Veuillez sélectionner un fichier image.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;

      // Store in state
      this.state.business.logoUrl = dataUrl;
      this.saveState();

      // Update the logo upload box preview
      const previewArea = document.getElementById('profile-logo-preview');
      if (previewArea) {
        previewArea.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;" alt="Logo">`;
      }

      // Update the avatar circle in the identity card
      const avatarSvg = document.getElementById('profile-avatar-svg');
      const avatarImg = document.getElementById('profile-avatar-img');
      if (avatarSvg) avatarSvg.style.display = 'none';
      if (avatarImg) { avatarImg.src = dataUrl; avatarImg.style.display = 'block'; }

      // Update sidebar branding
      this.updateUserBrandingUI();

      // Sync to Supabase if connected
      if (window.KivoDb && this.supabaseConnected) {
        this.saveSettings();
      }

      this.showToast('Logo importé avec succès !', 'success');
    };
    reader.readAsDataURL(file);
  },

  // handleLogoUpload is defined below (FileReader + extractColors version)

  openModal: function (modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('active');
  },

  closeModal: function (modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('active');
  },


  // ===========================
  // PAGE « CRÉATION AVEC L'IA »
  // ===========================

  /** Holds the last document generated via the AI page */
  _aiGeneratedDoc: null,

  /**
   * Called by renderCurrentView when activeView === 'ai'.
   * Initialises the live preview tablet with placeholder invoice data.
   */
  renderAiPage: function () {
    this._renderAiTabletPreview(this._aiGeneratedDoc || null);
  },

  /**
   * Renders the glass-tablet invoice preview inside the AI page.
   * @param {Object|null} doc  - Parsed invoice doc or null for default demo.
   */
  _renderAiTabletPreview: function (doc) {
    const paper = document.getElementById('ai-tablet-paper');
    if (!paper) return;

    const biz = (this.state && this.state.business) || {};
    const logoUrl = biz.logoUrl || null;
    const bizName = biz.name || 'KIVO MATIQUE';
    const bizAddress = biz.address || 'Plateau, Abidjan';
    const bizPhone = biz.phone || '+225 07 48 12 34 56';
    const bizEmail = biz.email || 'contact@kivo.com';
    const bizOwner = biz.owner || '';
    const primaryColor = biz.primaryColor || '#0B132B';
    const currency = (doc && doc.currency) || biz.currency || 'FCFA';

    const todayObj = new Date();
    const defaultDueObj = new Date(Date.now() + 14 * 86400000);
    const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };

    let docNum = `FAC-${todayObj.getFullYear()}-0042`;
    let clientName = 'Cabinet Martin & Associés';
    let clientAddress = '200 Boulevard de la République\nPlateau, Abidjan';
    let clientPhone = '+225 05 12 34 56 78';
    let issuedDate = todayObj.toLocaleDateString('fr-FR', dateOptions);
    let dueDate = defaultDueObj.toLocaleDateString('fr-FR', dateOptions);
    let taxRate = typeof (biz.taxRate) === 'number' ? biz.taxRate : 18;

    const isEuro = /€|eur/i.test(currency);
    const isUsd = /\$|usd/i.test(currency);
    const mult = (isEuro || isUsd) ? 1 : 450;

    let lineItems = [
      { desc: 'Développement & Intégration Web', qty: 1, price: 650 * mult },
      { desc: 'Direction Artistique & Design UI/UX', qty: 1, price: 350 * mult },
      { desc: 'Hébergement & Maintenance Serveur', qty: 1, price: 180 * mult }
    ];

    if (doc) {
      docNum = doc.docNumber || docNum;
      if (doc.clientName) clientName = doc.clientName;
      else if (doc.client && doc.client.name) clientName = doc.client.name;

      if (doc.clientAddress) clientAddress = doc.clientAddress;
      else if (doc.client && doc.client.address) clientAddress = doc.client.address;

      if (doc.clientPhone) clientPhone = doc.clientPhone;
      else if (doc.client && doc.client.phone) clientPhone = doc.client.phone;

      if (doc.issueDate) {
        try { issuedDate = new Date(doc.issueDate).toLocaleDateString('fr-FR', dateOptions); } catch (e) {}
      }
      if (doc.dueDate || doc.suggestedDueDate) {
        try { dueDate = new Date(doc.dueDate || doc.suggestedDueDate).toLocaleDateString('fr-FR', dateOptions); } catch (e) {}
      }
      if (typeof doc.taxRate === 'number') taxRate = doc.taxRate;

      if (doc.items && doc.items.length) {
        lineItems = doc.items.map(it => ({
          desc: it.name || it.description || 'Prestation de service',
          qty: it.quantity || it.qty || 1,
          price: it.price || it.unitPrice || 0
        }));
      }
    }

    const subtotal = lineItems.reduce((s, it) => s + (it.qty * it.price), 0);
    const taxAmt = subtotal * taxRate / 100;
    const total = subtotal + taxAmt;
    const fmt = (n) => this.formatCurrency(n, currency);

    const logoHtml = logoUrl
      ? `<img src="${logoUrl}" style="height:32px; max-width:110px; object-fit:contain;" alt="${bizName}">`
      : `<span style="font-family:'Outfit',sans-serif;font-size:1.15rem;font-weight:900;color:${primaryColor};letter-spacing:-0.02em;">${bizName}</span>`;

    const badgeLetter = bizName.charAt(0).toUpperCase();

    paper.innerHTML = `
      <!-- Invoice header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.1rem;">
        <div>${logoHtml}</div>
        <div style="width:34px;height:34px;border-radius:50%;background:${primaryColor};display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.15);">
          <span style="color:#FFF;font-weight:800;font-size:0.9rem;font-family:'Outfit',sans-serif;">${badgeLetter}</span>
        </div>
      </div>

      <!-- Sender + Invoice meta -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1.2rem;gap:1rem;">
        <div style="font-size:0.68rem;color:#475569;line-height:1.55;max-width:55%;">
          <div style="font-size:0.58rem;text-transform:uppercase;letter-spacing:0.06em;color:#94A3B8;font-weight:700;margin-bottom:0.2rem;">Destinataire</div>
          <div style="font-weight:700;color:#0F172A;font-size:0.8rem;margin-bottom:0.15rem;">${clientName}</div>
          <div>${clientAddress.replace(/\n/g,'<br>')}</div>
          ${clientPhone ? `<div>${clientPhone}</div>` : ''}
        </div>
        <div style="text-align:right;font-size:0.68rem;color:#475569;line-height:1.6;">
          <div style="font-weight:800;color:#0F172A;font-size:0.92rem;margin-bottom:0.25rem;">${docNum}</div>
          <div><span style="color:#94A3B8;">Date d'émission :</span> <strong>${issuedDate}</strong></div>
          <div><span style="color:#94A3B8;">Échéance :</span> <strong>${dueDate}</strong></div>
          <div style="margin-top:0.3rem;"><span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:#ECFDF5;color:#047857;font-size:0.62rem;font-weight:700;">En attente de paiement</span></div>
        </div>
      </div>

      <!-- Line items table -->
      <table style="width:100%;border-collapse:collapse;font-size:0.68rem;margin-bottom:1rem;">
        <thead>
          <tr style="background:${primaryColor};color:#FFF;">
            <th style="padding:0.45rem 0.55rem;text-align:center;font-weight:600;border-radius:4px 0 0 4px;width:30px;">N°</th>
            <th style="padding:0.45rem 0.55rem;text-align:left;font-weight:600;">Description</th>
            <th style="padding:0.45rem 0.55rem;text-align:center;font-weight:600;width:40px;">Qté</th>
            <th style="padding:0.45rem 0.55rem;text-align:right;font-weight:600;width:95px;">Prix Unit.</th>
            <th style="padding:0.45rem 0.55rem;text-align:right;font-weight:600;border-radius:0 4px 4px 0;width:100px;">Total HT</th>
          </tr>
        </thead>
        <tbody>
          ${lineItems.map((it, i) => `
            <tr style="border-bottom:1px solid #F1F5F9;">
              <td style="padding:0.4rem 0.55rem;color:#64748B;text-align:center;font-weight:500;">${i + 1}</td>
              <td style="padding:0.4rem 0.55rem;color:#0F172A;font-weight:500;">${it.desc}</td>
              <td style="padding:0.4rem 0.55rem;text-align:center;color:#64748B;">${it.qty}</td>
              <td style="padding:0.4rem 0.55rem;text-align:right;color:#64748B;">${fmt(it.price)}</td>
              <td style="padding:0.4rem 0.55rem;text-align:right;font-weight:600;color:#0F172A;">${fmt(it.qty * it.price)}</td>
            </tr>`).join('')}
        </tbody>
      </table>

      <!-- Totals -->
      <div style="display:flex;justify-content:flex-end;margin-bottom:1rem;">
        <div style="min-width:210px;font-size:0.68rem;">
          <div style="display:flex;justify-content:space-between;padding:0.25rem 0;border-bottom:1px solid #F1F5F9;">
            <span style="color:#64748B;">Total Hors Taxe (HT)</span>
            <span style="font-weight:600;color:#0F172A;">${fmt(subtotal)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:0.25rem 0;border-bottom:1px solid #F1F5F9;">
            <span style="color:#64748B;">TVA (${taxRate}%)</span>
            <span style="font-weight:600;color:#0F172A;">${taxRate > 0 ? fmt(taxAmt) : 'Exonéré (0%)'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:0.45rem 0.65rem;background:${primaryColor};color:#FFF;border-radius:6px;margin-top:0.35rem;box-shadow:0 3px 10px rgba(0,0,0,0.12);">
            <span style="font-weight:700;">TOTAL TTC</span>
            <span style="font-weight:800;font-size:0.78rem;">${fmt(total)}</span>
          </div>
        </div>
      </div>

      <!-- Signature & Certification -->
      <div style="margin-bottom:0.25rem;font-size:0.6rem;color:#94A3B8;font-weight:500;">Bon pour accord & certification KIVO MATIQUE</div>
      <div style="font-family:'Dancing Script',cursive,Georgia,serif;font-size:1.35rem;color:#0F172A;line-height:1;margin-bottom:0.85rem;">${bizOwner}</div>

      <!-- Footer -->
      <div style="border-top:1px solid #E2E8F0;padding-top:0.6rem;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:0.6rem;color:#64748B;">${bizName} · ${bizPhone} · ${bizEmail}</div>
        <div style="width:20px;height:20px;border-radius:50%;background:${primaryColor};display:flex;align-items:center;justify-content:center;">
          <span style="color:#FFF;font-weight:800;font-size:0.55rem;">${badgeLetter}</span>
        </div>
      </div>
    `;
  },

  /**
   * Triggered when user clicks "Générer ma facture".
   * Parses the prompt and updates the tablet preview.
   */
  generateWithAiPage: function () {
    const promptEl = document.getElementById('ai-custom-prompt');
    if (!promptEl) return;
    const promptText = promptEl.value.trim();
    if (!promptText) {
      this.showToast('Décrivez votre facture dans la zone de texte.', 'info');
      return;
    }

    const btn = document.getElementById('ai-generate-btn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:6px;opacity:0.7;"><path d="M12 2l2.4 7.2L21.6 12l-7.2 2.4L12 21.6l-2.4-7.2L2.4 12l7.2-2.4z"/></svg> Génération en cours…';
    }

    setTimeout(() => {
      const clients = (this.state && this.state.clients) || [];
      const currency = (this.state && this.state.business && this.state.business.currency) || 'FCFA';
      const taxRate = (this.state && this.state.business && this.state.business.taxRate) || 18;

      const doc = window.KivoAI ? window.KivoAI.parseTextToDocument(promptText, clients, currency, taxRate) : null;
      this._aiGeneratedDoc = doc;
      this._renderAiTabletPreview(doc);

      // Show action toolbar
      const toolbar = document.getElementById('ai-action-toolbar');
      if (toolbar) toolbar.style.display = 'flex';

      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:6px;"><path d="M12 2l2.4 7.2L21.6 12l-7.2 2.4L12 21.6l-2.4-7.2L2.4 12l7.2-2.4z"/></svg> Générer ma facture';
      }
      this.showToast('Facture structurée avec succès !', 'success');
    }, 600);
  },

  /**
   * Applies a preset style/prompt and regenerates the preview.
   * @param {string} type - 'minimalist' | 'premium' | 'corporate' | 'my-colors' | 'my-template'
   */
  applyAiPreset: function (type) {
    const promptEl = document.getElementById('ai-custom-prompt');
    if (!promptEl) return;

    const currency = (this.state && this.state.business && this.state.business.currency) || 'FCFA';
    const isEur = /€|eur/i.test(currency);
    const p1 = isEur ? '450 €' : '450 000 FCFA';
    const p2 = isEur ? '250 €' : '250 000 FCFA';
    const p3 = isEur ? '1 200 €' : '1 200 000 FCFA';
    const p4 = isEur ? '850 €' : '850 000 FCFA';

    const presets = {
      minimalist: `Facture minimaliste pour Cabinet Alpha : Audit de conformité ${p1}, Rédaction des actes ${p2}. TVA 18%.`,
      premium: `Facture premium pour Studio Luxe : Identité de marque complète ${p3}, Pack supports digitaux & print ${p4}. TVA 18%.`,
      corporate: `Facture corporate pour Entreprise Global Tech : Mission de conseil stratégique ${p3}, Formation des équipes ${p4}. TVA 18%.`,
      'my-colors': `Facture pour Boutique Éléganza avec mes couleurs de marque : Développement boutique e-commerce ${p4}, Maintenance annuelle ${p2}. TVA 18%.`,
      'my-template': `Facture pour Médias Plus : Campagne digitale réseaux sociaux ${p2}, Production vidéo publicitaire ${p1}. TVA 18%.`
    };

    const promptText = presets[type] || '';
    promptEl.value = promptText;

    // Auto-generate after 150ms so user sees the text appear first
    setTimeout(() => {
      this.generateWithAiPage();
    }, 150);

    // Highlight the selected preset card
    document.querySelectorAll('.ai-preset-card').forEach(card => {
      card.classList.remove('active');
    });
    const activeCard = document.querySelector(`.ai-preset-card[data-preset="${type}"]`);
    if (activeCard) activeCard.classList.add('active');
  },

  /**
   * Switches the carousel dot indicator.
   * @param {number} index
   */
  setAiSlide: function (index) {
    document.querySelectorAll('.ai-carousel-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  },

  /**
   * Transfers the AI-generated invoice to the builder view for editing.
   */
  transferAiInvoiceToBuilder: function () {
    if (!this._aiGeneratedDoc) {
      this.showToast('Générez d\'abord une facture avec l\'IA.', 'info');
      return;
    }
    const doc = this._aiGeneratedDoc;

    // Navigate to builder with a new document
    this.startNewDocument('invoice');
    this.navigate('document-builder');

    setTimeout(() => {
      // Pre-fill items
      if (doc.items && doc.items.length) {
        const lineBody = document.getElementById('line-items-body');
        if (lineBody) {
          lineBody.innerHTML = '';
          doc.items.forEach((item) => {
            const desc = item.name || item.description || 'Prestation';
            const qty = item.quantity || item.qty || 1;
            const price = item.price || item.unitPrice || 0;
            this.addLineItem(desc, qty, price);
          });
        }
      }
      // Pre-fill client
      const clientName = doc.clientName || (doc.client && doc.client.name) || '';
      if (clientName) {
        const clientInput = document.getElementById('builder-client-name');
        if (clientInput) clientInput.value = clientName;
      }
      this.updateLiveInvoicePreview();
      this.showToast('Facture IA chargée dans l\'éditeur !', 'success');
    }, 300);
  },

  /**
   * Saves the AI-generated invoice directly to Supabase / Local storage.
   */
  saveAiInvoiceDirectly: async function () {
    if (!this._aiGeneratedDoc) {
      this.showToast('Générez d\'abord une facture avec l\'IA.', 'info');
      return;
    }

    const doc = this._aiGeneratedDoc;
    const biz = (this.state && this.state.business) || {};
    const taxRate = typeof doc.taxRate === 'number' ? doc.taxRate : (biz.taxRate || 18);
    const currency = doc.currency || biz.currency || 'FCFA';
    const items = (doc.items || []).map(it => {
      const q = it.quantity || it.qty || 1;
      const p = it.price || it.unitPrice || 0;
      return {
        description: it.name || it.description || 'Prestation',
        qty: q,
        unit_price: p,
        total: q * p
      };
    });
    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const taxAmt = subtotal * taxRate / 100;
    const total = subtotal + taxAmt;

    const clientName = doc.clientName || (doc.client && doc.client.name) || 'Client Entreprise';
    const clientAddress = doc.clientAddress || (doc.client && doc.client.address) || '';

    const newDoc = {
      id: 'doc_ai_' + Date.now(),
      type: 'invoice',
      status: 'draft',
      docNumber: doc.docNumber || this._generateDocNumber('invoice'),
      client: clientName,
      clientAddress: clientAddress,
      items: items,
      subtotal: subtotal,
      taxRate: taxRate,
      tax: taxAmt,
      total: total,
      currency: currency,
      dueDate: doc.dueDate || doc.suggestedDueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      notes: '[Créé par IA]',
      issuedAt: new Date().toISOString().split('T')[0]
    };

    // Save to local state
    if (!this.state.documents) this.state.documents = [];
    this.state.documents.unshift(newDoc);
    this.saveState();

    // Save to Supabase if connected
    if (window.KivoDb && this.supabaseConnected) {
      try {
        await window.KivoDb.saveDocument(newDoc);
        this.showToast('Facture enregistrée dans Supabase !', 'success');
      } catch (e) {
        console.error('Supabase save error:', e);
        this.showToast('Facture sauvegardée localement (Supabase indisponible).', 'success');
      }
    } else {
      this.showToast('Facture enregistrée localement !', 'success');
    }
  },

  openAiModal: function () {
    // Legacy alias: now navigates to the dedicated AI page
    this.navigate('ai');
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

    const iconSvg = type === 'success'
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>`
      : (type === 'error' || type === 'danger')
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span style="display:inline-flex;align-items:center;flex-shrink:0;">${iconSvg}</span>
      <span style="font-weight:500;">${message}</span>
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

  /**
   * Invoice-specific logo upload: updates only this builder session and document,
   * without mutating the company profile logo in Mon profil or Supabase.
   */
  handleLogoUpload: function (inputOrFiles) {
    let file = null;
    if (inputOrFiles instanceof FileList && inputOrFiles.length > 0) {
      file = inputOrFiles[0];
    } else if (inputOrFiles && inputOrFiles.files && inputOrFiles.files.length > 0) {
      file = inputOrFiles.files[0];
    } else if (inputOrFiles && inputOrFiles instanceof File) {
      file = inputOrFiles;
    }
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showToast('Veuillez sélectionner un fichier image valide.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      
      // Store strictly for this builder document session
      this.builderCustomLogoUrl = dataUrl;

      // Update builder preview elements
      const preview = document.getElementById('builder-logo-preview-img');
      const previewBox = document.getElementById('builder-logo-preview-box');
      const uploadPrompt = document.getElementById('builder-logo-upload-prompt');
      if (preview) {
        preview.src = dataUrl;
        preview.style.display = 'block';
      }
      if (previewBox) previewBox.style.display = 'flex';
      if (uploadPrompt) uploadPrompt.style.display = 'none';

      // Automatically extract logo color and update live invoice preview
      setTimeout(() => {
        this.extractColorsFromLogo();
        this.updateLiveInvoicePreview();
      }, 60);

      this.showToast('Logo appliqué à la facture.', 'success');
    };
    reader.readAsDataURL(file);
  },

  /**
   * Payment terms dropdown selector handler
   */
  onBuilderTermsChange: function (val) {
    const customInput = document.getElementById('builder-terms');
    if (!customInput) return;
    if (val === 'custom') {
      customInput.style.display = 'block';
      customInput.focus();
    } else {
      customInput.style.display = 'none';
      customInput.value = val;
    }
    this.updateLiveInvoicePreview();
  },

  /**
   * Color picker change handler
   */
  onBuilderColorChange: function () {
    const pPicker = document.getElementById('builder-color-primary');
    const sPicker = document.getElementById('builder-color-secondary');
    const pText = document.getElementById('builder-color-primary-text');
    const sText = document.getElementById('builder-color-secondary-text');

    if (pPicker && pText) pText.value = pPicker.value;
    if (sPicker && sText) sText.value = sPicker.value;

    this.updateLiveInvoicePreview();
  },

  /**
   * Color text input change handler
   */
  onBuilderColorTextInput: function (type, hex) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
    if (type === 'primary') {
      const pPicker = document.getElementById('builder-color-primary');
      if (pPicker) pPicker.value = hex;
    } else {
      const sPicker = document.getElementById('builder-color-secondary');
      if (sPicker) sPicker.value = hex;
    }
    this.updateLiveInvoicePreview();
  },

  /**
   * Set builder colors from preset swatches
   */
  setBuilderPresetColors: function (primary, secondary) {
    const pPicker = document.getElementById('builder-color-primary');
    const sPicker = document.getElementById('builder-color-secondary');
    const pText = document.getElementById('builder-color-primary-text');
    const sText = document.getElementById('builder-color-secondary-text');

    if (pPicker) pPicker.value = primary;
    if (pText) pText.value = primary;
    if (sPicker) sPicker.value = secondary;
    if (sText) sText.value = secondary;

    this.updateLiveInvoicePreview();
  },

  /**
   * Real currency exchange rates reference matrix
   */
  currencyRates: {
    FCFA: 1,
    XOF: 1,
    XAF: 1,
    EUR: 655.957,
    USD: 605,
    GBP: 770,
    CAD: 445
  },

  /**
   * Real currency conversion: converts unit prices, subtotal, and tax
   */
  onBuilderCurrencyChange: function (newCurrency) {
    const oldCurrency = this.builderCurrentCurrency || (this.state.business && this.state.business.currency) || 'FCFA';
    this.builderCurrentCurrency = newCurrency;

    if (oldCurrency !== newCurrency) {
      const rateOld = this.currencyRates[oldCurrency] || 1;
      const rateNew = this.currencyRates[newCurrency] || 1;
      const factor = rateOld / rateNew;

      document.querySelectorAll('#builder-items-tbody tr').forEach(tr => {
        const priceInput = tr.querySelector('.item-price');
        if (priceInput) {
          const currentPrice = parseFloat(priceInput.value) || 0;
          if (currentPrice > 0) {
            const isFcfa = (newCurrency === 'FCFA' || newCurrency === 'XOF' || newCurrency === 'XAF');
            const converted = isFcfa
              ? Math.round(currentPrice * factor)
              : Math.round((currentPrice * factor) * 100) / 100;
            priceInput.value = converted;
          }
        }
      });

      this.showToast(`Devise modifiée : 1 ${oldCurrency} = ${(1 * factor).toFixed(4)} ${newCurrency}. Prix convertis.`, 'info');
    }

    this.recalculateBuilderTotals();
    this.updateLiveInvoicePreview();
  },

  extractColorsFromLogo: function () {
    const img = document.getElementById('builder-logo-preview-img');
    const logoSrc = (img && img.src) || (this.state.business && this.state.business.logoUrl);
    if (!logoSrc) return;

    const tempImg = new Image();
    tempImg.crossOrigin = "Anonymous";
    tempImg.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = Math.min(tempImg.naturalWidth || 100, 200);
        canvas.height = Math.min(tempImg.naturalHeight || 100, 200);
        ctx.drawImage(tempImg, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < imageData.length; i += 4) {
          const a = imageData[i+3];
          const pr = imageData[i];
          const pg = imageData[i+1];
          const pb = imageData[i+2];
          // Filter out transparent and pure white/black background pixels
          if (a > 120 && !(pr > 235 && pg > 235 && pb > 235) && !(pr < 25 && pg < 25 && pb < 25)) {
            r += pr; g += pg; b += pb; count++;
          }
        }
        if (count > 0) {
          r = Math.floor(r / count);
          g = Math.floor(g / count);
          b = Math.floor(b / count);
          const toHex = (c) => { const h = c.toString(16); return h.length === 1 ? '0' + h : h; };
          const primaryHex = '#' + toHex(r) + toHex(g) + toHex(b);
          this.state.business = this.state.business || {};
          this.state.business.primaryColor = primaryHex;
          const pInput = document.getElementById('builder-color-primary');
          if (pInput) pInput.value = primaryHex;
          this.saveState();
          this.updateLiveInvoicePreview();
          this.showToast(`Couleur détectée du logo (${primaryHex}) et appliquée !`, 'success');
        }
      } catch (e) {
        console.warn('Auto color extraction warning:', e);
      }
    };
    tempImg.src = logoSrc;
  },

  /**
   * Selection d'un client dans le constructeur
   */
  onBuilderClientSelect: function (clientId) {
    if (!clientId) return;
    const client = (this.state.clients || []).find(c => c.id === clientId);
    if (!client) return;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    setVal('builder-client-name', client.name || client.company || '');
    setVal('builder-client-address', client.address || '');
    setVal('builder-client-phone', client.phone || '');
    setVal('builder-client-email', client.email || '');

    this.updateLiveInvoicePreview();
  },

  /**
   * Slider taille du logo (30px - 180px)
   */
  onLogoSizeChange: function (val) {
    const size = parseInt(val) || 70;
    const displayEl = document.getElementById('logo-size-display');
    if (displayEl) displayEl.textContent = size + 'px';
    if (!this.state.business) this.state.business = {};
    this.state.business.logoSize = size;
    this.saveState();
    this.updateLiveInvoicePreview();
  },

  /**
   * Selecteur position du logo (left, center, right)
   */
  onLogoPositionChange: function (pos) {
    if (!this.state.business) this.state.business = {};
    this.state.business.logoPosition = pos;
    this.saveState();
    this.updateLiveInvoicePreview();
  },

  /**
   * Telechargement PDF reel via html2pdf.js - GARANTI SUR 1 SEULE PAGE A4
   * Utilise un conteneur sandbox isole sans decalage de scroll ni debordement
   */
  downloadPdf: function () {
    const docNum = (document.getElementById('builder-doc-number') || document.getElementById('pub-doc-number'));
    const filename = ((docNum ? docNum.value || docNum.textContent : '') || 'facture_KIVO').trim().replace(/[^a-zA-Z0-9-_]/g, '_') + '.pdf';

    let element = document.getElementById('live-paper-preview-container');
    if (!element || element.offsetParent === null) {
      element = document.getElementById('public-doc-printable-area');
    }
    if (!element) {
      this.showToast('Aucun document à télécharger.', 'error');
      return;
    }

    if (typeof html2pdf === 'undefined') {
      this.showToast('Bibliothèque PDF non chargée — réessayez dans quelques secondes.', 'error');
      return;
    }

    this.showToast('Génération du PDF (1 page A4)...', 'info');

    // Create an isolated sandbox to avoid any viewport scroll offsets or outer margin overflows
    const sandbox = document.createElement('div');
    sandbox.style.position = 'fixed';
    sandbox.style.top = '0';
    sandbox.style.left = '-9999px';
    sandbox.style.width = '794px';
    sandbox.style.height = '1122px';
    sandbox.style.maxHeight = '1122px';
    sandbox.style.overflow = 'hidden';
    sandbox.style.background = '#FFFFFF';
    sandbox.style.boxSizing = 'border-box';
    sandbox.style.zIndex = '-9999';

    const clone = element.cloneNode(true);
    clone.style.width = '100%';
    clone.style.height = '100%';
    clone.style.maxHeight = '1122px';
    clone.style.overflow = 'hidden';
    clone.style.margin = '0';
    clone.style.padding = '28px 32px';
    clone.style.boxSizing = 'border-box';
    clone.style.boxShadow = 'none';
    clone.style.transform = 'none';

    // Remove decorative mock paper curl or stack shadows
    clone.querySelectorAll('.paper-curl-corner, .mock-paper-stack').forEach(el => el.remove());

    sandbox.appendChild(clone);
    document.body.appendChild(sandbox);

    const opt = {
      margin: 0,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794,
        windowHeight: 1122
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
        compress: true
      },
      pagebreak: { mode: 'avoid-all' }
    };

    html2pdf()
      .set(opt)
      .from(sandbox)
      .save()
      .then(() => {
        if (sandbox.parentNode) document.body.removeChild(sandbox);
        this.showToast('Facture téléchargée sur 1 page A4 !', 'success');
      })
      .catch(e => {
        if (sandbox.parentNode) document.body.removeChild(sandbox);
        console.error('[KivoApp] Erreur PDF:', e);
        this.showToast('Erreur PDF : ' + e.message, 'error');
      });
  },

  /**
   * Impression via fenetre du navigateur (1 seule page A4)
   */
  printPdf: function () {
    window.print();
  },

  /**
   * Renders / refreshes the Pricing & Subscriptions page
   */
  renderPricingPage: function () {
    // Update user avatar/name from state
    const biz = (this.state && this.state.business) || {};
    const ownerName = biz.owner || 'Mon Compte';
    const nameEl = document.getElementById('pricing-user-name');
    if (nameEl) nameEl.textContent = ownerName;

    const photoEl = document.getElementById('pricing-user-photo');
    const avatarEl = document.getElementById('pricing-user-avatar');
    if (biz.logoUrl && avatarEl) {
      avatarEl.innerHTML = `<img src="${biz.logoUrl}" style="width:100%;height:100%;object-fit:contain;border-radius:50%;" alt="Logo">`;
    } else if (photoEl) {
      // Keep default placeholder photo
    }

    // Highlight current subscription tier button
    const defaultTexts = {
      'Gratuit': 'Commencer gratuitement',
      'Pro': 'Passer à Pro',
      'Business': 'Passer à Business'
    };
    const currentTier = (biz.subscriptionTier || 'Gratuit').toLowerCase();
    document.querySelectorAll('.pricing-btn[data-tier]').forEach(btn => {
      btn.classList.remove('pricing-btn-current');
      btn.disabled = false;
      const tier = btn.getAttribute('data-tier');
      if (tier && tier.toLowerCase() === currentTier) {
        btn.textContent = 'Votre forfait actuel';
        btn.classList.add('pricing-btn-current');
        btn.disabled = true;
      } else if (tier && defaultTexts[tier]) {
        btn.textContent = defaultTexts[tier];
      }
    });

    // Default monthly toggle
    this.togglePricingBilling('monthly');
  },

  /**
   * Toggles monthly / annual billing display on the pricing page
   */
  togglePricingBilling: function (billingType) {
    const monthlyBtn = document.getElementById('toggle-billing-monthly');
    const annualBtn = document.getElementById('toggle-billing-annual');
    const priceValFree = document.getElementById('price-val-free');
    const pricePeriodFree = document.getElementById('price-period-free');
    const priceValPro = document.getElementById('price-val-pro');
    const pricePeriodPro = document.getElementById('price-period-pro');
    const priceConvPro = document.getElementById('price-conv-pro');
    const priceValBiz = document.getElementById('price-val-biz');
    const pricePeriodBiz = document.getElementById('price-period-biz');
    const priceConvBiz = document.getElementById('price-conv-biz');

    if (!monthlyBtn || !annualBtn) return;

    if (billingType === 'monthly') {
      monthlyBtn.classList.add('active');
      annualBtn.classList.remove('active');
      if (priceValFree) priceValFree.textContent = '0 FCFA';
      if (pricePeriodFree) pricePeriodFree.textContent = '/ mois';
      if (priceValPro) priceValPro.textContent = '3 990 FCFA';
      if (pricePeriodPro) pricePeriodPro.textContent = '/ mois';
      if (priceConvPro) priceConvPro.textContent = '≈ 6 € / mois';
      if (priceValBiz) priceValBiz.textContent = '9 990 FCFA';
      if (pricePeriodBiz) pricePeriodBiz.textContent = '/ mois';
      if (priceConvBiz) priceConvBiz.textContent = '5 sièges inclus · +1 500 FCFA/membre sup.';
    } else {
      annualBtn.classList.add('active');
      monthlyBtn.classList.remove('active');
      if (priceValFree) priceValFree.textContent = '0 FCFA';
      if (pricePeriodFree) pricePeriodFree.textContent = '/ an';
      // PRO ANNUEL: 38 380 FCFA / an (soit 3 190 FCFA / mois · -20%)
      if (priceValPro) priceValPro.textContent = '38 380 FCFA';
      if (pricePeriodPro) pricePeriodPro.textContent = '/ an';
      if (priceConvPro) priceConvPro.textContent = 'soit 3 190 FCFA / mois (-20%)';
      // BUSINESS ANNUEL: 95 880 FCFA / an (soit 7 990 FCFA / mois · -20%)
      if (priceValBiz) priceValBiz.textContent = '95 880 FCFA';
      if (pricePeriodBiz) pricePeriodBiz.textContent = '/ an';
      if (priceConvBiz) priceConvBiz.textContent = 'soit 7 990 FCFA / mois (-20%) · +1 500 FCFA/membre sup.';
    }
  },

  /**
   * Switch subscription tier (saves in state & shows toast)
   */
  switchSubscriptionTier: function (tier) {
    if (!this.state) this.state = JSON.parse(JSON.stringify(this.BLANK_STATE));
    if (!this.state.business) this.state.business = {};
    this.state.business.subscriptionTier = tier;
    this.saveState();

    const labels = { 'Gratuit': 'Free', 'Pro': 'Pro', 'Business': 'Business' };
    const label = labels[tier] || tier;
    this.showToast(`Forfait ${label} activé ! Bienvenue dans KIVO MATIQUE ${label}.`, 'success');

    // Log activity
    if (!this.state.activities) this.state.activities = [];
    this.state.activities.unshift({
      id: Date.now().toString(),
      type: 'subscription',
      text: `Forfait changé vers ${label}`,
      date: new Date().toISOString()
    });
    this.saveState();
    this.renderPricingPage();
  },

  /**
   * Opens WhatsApp to contact enterprise support
   */
  contactEnterpriseSupport: function () {
    const msg = encodeURIComponent("Bonjour, je suis intéressé par l'offre Enterprise KIVO MATIQUE. Pouvez-vous me contacter ?");
    window.open(`https://wa.me/221778421902?text=${msg}`, '_blank');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.KivoApp.init();
});

