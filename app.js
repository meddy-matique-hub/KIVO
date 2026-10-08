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
   * Hides the full-screen loading overlay with a smooth fade.
   * Must be called AFTER handleRoute() to guarantee no content flash.
   */
  _hideLoadingOverlay: function () {
    const overlay = document.getElementById('app-loading-overlay');
    if (!overlay) return;
    // Cancel the CSS safety-timeout animation so it doesn't interfere
    overlay.style.animation = 'none';
    overlay.style.opacity = '0';
    overlay.style.visibility = 'hidden';
    overlay.style.pointerEvents = 'none';
    // Remove from layout after transition
    setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 400);
  },

  /**
   * Shows the full-screen loading overlay (used during auth transitions).
   */
  _showLoadingOverlay: function () {
    const overlay = document.getElementById('app-loading-overlay');
    if (!overlay) return;
    overlay.style.opacity = '1';
    overlay.style.visibility = 'visible';
    overlay.style.pointerEvents = 'all';
  },

  /**
   * Génère un UUID v4 valide compatible avec le type uuid de PostgreSQL/Supabase.
   * Utilise crypto.randomUUID() natif si disponible, sinon un fallback RFC 4122.
   */
  generateUUID: function () {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    // Fallback RFC 4122 v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

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
      defaultVatRate: 0,
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
    this.isSessionLoading = true;

    // Safety net: force-hide the overlay after 8 s in case any await hangs silently.
    // Normal path resolves in < 2 s; this guarantees the app is never permanently blocked.
    const _overlayTimeout = setTimeout(() => {
      console.warn('[KivoApp] Safety timeout: force-hiding loading overlay after 8 s.');
      this._hideLoadingOverlay();
    }, 8000);
    // Clear the safety timeout once we finish (called at every exit point below)
    const _clearOverlayTimeout = () => clearTimeout(_overlayTimeout);

    if (!this.state) {
      this.state = JSON.parse(JSON.stringify(this.BLANK_STATE));
    }
    this.setupRouting();
    this.setupEventListeners();

    // 1. Check if returning from Google OAuth (URL hash contains access_token or query contains code)
    const hasOAuthCallback = window.location.hash.includes('access_token=') || window.location.search.includes('code=');

    // 2. Initialize Auth client (KivoAuth.init validates session with server)
    if (window.KivoAuth && typeof window.KivoAuth.init === 'function') {
      await window.KivoAuth.init();
    }

    const session = window.KivoAuth?.session || null;
    const user = window.KivoAuth?.user || null;

    // If returning from OAuth, clean URL hash/query smoothly without breaking router
    if (hasOAuthCallback && session) {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }

    if (user) {
      localStorage.removeItem('kivo_app_state'); // Purge legacy unscoped state
      this.loadState();
      this.state.userEmail = user.email || '';
      this.supabaseConnected = true;

      // Sync user data from Supabase to evaluate real onboarding status
      try {
        await this.syncFromSupabase();
      } catch (e) {
        console.error('[KivoApp] Supabase sync error on boot:', e);
      }

      // If user is not onboarded yet, pre-fill form with OAuth/signup metadata
      if (!this.state.isOnboarded) {
        this.prefillOnboardingWithAuthUser(user);
      }

      this.isSessionLoading = false;
      _clearOverlayTimeout();
      this.handleRoute();
      this._hideLoadingOverlay();
    } else {
      // Unauthenticated visitor: start with clean blank state, no fake data
      console.log('[KivoApp] Visitor session — rendering public landing view.');
      this.supabaseConnected = false;
      this.state = JSON.parse(JSON.stringify(this.BLANK_STATE));
      this.state.isOnboarded = false;
      this.isSessionLoading = false;
      _clearOverlayTimeout();
      this.handleRoute();
      this._hideLoadingOverlay();
    }
  },

  /**
   * Central callback when a user authenticates (via email form or OAuth)
   */
  onUserAuthenticated: async function (user) {
    if (!user) return;
    if (this._isAuthenticating) return;
    this._isAuthenticating = true;
    this.isSessionLoading = true;
    this._showLoadingOverlay(); // Block all UI until session + settings resolved

    try {
      console.log('[KivoApp] onUserAuthenticated for:', user.email);
      this.loadState();
      this.state.userEmail = user.email || '';
      this.supabaseConnected = true;

      try {
        await this.syncFromSupabase();
      } catch (e) {
        console.error('[KivoApp] syncFromSupabase error:', e);
      }

      this.isSessionLoading = false;

      if (this.state.isOnboarded) {
        this.showToast(this._t('toast_login_success'), "success");
        this.navigate('dashboard');
      } else {
        this.prefillOnboardingWithAuthUser(user);
        this.showToast(this._t('toast_welcome_setup'), "info");
        this.navigate('onboarding');
      }
      this._hideLoadingOverlay();
    } finally {
      this.isSessionLoading = false;
      this._isAuthenticating = false;
    }
  },

  /**
   * Pre-fills wizard fields with the real authenticated user's details.
   * Called after OAuth/email sign-in when onboarding is needed.
   */
  prefillOnboardingWithAuthUser: function (user) {
    if (!user) return;
    // Legacy hidden compat fields
    const emailEl = document.getElementById('onboard-biz-email');
    if (emailEl) emailEl.value = user.email || '';
    const ownerEl = document.getElementById('onboard-biz-owner');
    if (ownerEl && !ownerEl.value) {
      const metaName = user.user_metadata?.full_name || user.user_metadata?.name || '';
      ownerEl.value = metaName || (user.email ? user.email.split('@')[0] : '');
    }
    // Wizard fields
    const wzEmail = document.getElementById('wz-email');
    if (wzEmail && !wzEmail.value) wzEmail.value = user.email || '';
    const wzOwner = document.getElementById('wz-owner');
    if (wzOwner && !wzOwner.value) {
      const metaName = user.user_metadata?.full_name || user.user_metadata?.name || '';
      wzOwner.value = metaName || (user.email ? user.email.split('@')[0] : '');
    }
    // Init wizard state if not already set
    if (!this._wizard) this.wizardInit();
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
   * A user is considered onboarded if they have a business_settings record with a non-empty owner.
   * company_name is OPTIONAL (independants/particuliers may not have one).
   */
  syncFromSupabase: async function () {
    if (!window.KivoDb || !this.supabaseConnected) return;
    const data = await window.KivoDb.loadAll();
    if (!data) return;

    const s = (data.settings && data.settings.length > 0) ? data.settings[0] : null;
    const isCompleted = !!(s && (s.onboarding_completed === true || (s.onboarding_completed === undefined && s.owner && s.owner.trim() !== '' && !s.onboarding_answers?.step)));

    this.state.isOnboarded = isCompleted;

    if (s && s.onboarding_answers && !isCompleted) {
      this._cloudWizardProgress = s.onboarding_answers;
      console.log('[KivoApp] Cloud onboarding progress detected:', s.onboarding_answers);
    }

    if (s) {
      // Existing cloud settings
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
    } else {
      const authUser = window.KivoAuth?.user;
      if (authUser) {
        this.state.business.owner = this.state.business.owner || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || '';
        this.state.business.email = this.state.business.email || authUser.email || '';
      }
    }

    // Update UI elements with current settings
    const tSelect = document.getElementById('builder-visual-template');
    if (tSelect) tSelect.value = this.state.business.visualTemplate;
    const pColor = document.getElementById('builder-color-primary');
    if (pColor) pColor.value = this.state.business.primaryColor;
    const sColor = document.getElementById('builder-color-secondary');
    if (sColor) sColor.value = this.state.business.secondaryColor;
    if (typeof this.updateDocumentPreviewVisuals === 'function') {
      this.updateDocumentPreviewVisuals();
    }

    // 1. Sync & Merge Clients (Cloud + local un-synced)
    const cloudClients = (data.clients || []).map(c => {
      // Normalize DB type back to KIVO internal representation
      // DB stores 'Particulier' or 'Entreprise' (French, enforced by CHECK constraint)
      const rawDbType = (c.type || '').toLowerCase();
      const kivoType = (rawDbType === 'particulier' || rawDbType === 'individual' || rawDbType === 'person' || rawDbType === 'b2c')
        ? 'B2C' : 'B2B';
      return {
        id: c.id,
        name: c.name,
        type: kivoType,
        clientType: kivoType,
        company: c.company || '',
        contactName: c.contact_name || '',
        taxId: c.tax_id || '',
        email: c.email || '',
        phone: c.phone || '',
        address: c.address || '',
        totalInvoiced: Number(c.total_invoiced) || 0,
        totalPaid: Number(c.total_paid) || 0,
        balanceDue: Number(c.balance_due) || 0
      };
    });
    const cloudClientIds = new Set(cloudClients.map(c => c.id));
    const pendingLocalClients = (this.state.clients || []).filter(c => c && c.id && !cloudClientIds.has(c.id));
    this.state.clients = [...cloudClients, ...pendingLocalClients];

    // Background push any pending local clients to Supabase
    if (pendingLocalClients.length > 0 && window.KivoDb && typeof window.KivoDb.saveClient === 'function') {
      pendingLocalClients.forEach(c => {
        window.KivoDb.saveClient(c).catch(e => console.warn('[KivoApp] Background sync client error:', e));
      });
    }

    // 2. Sync & Merge Catalog / Services & Prestations
    const cloudCatalog = (data.catalog || []).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description || '',
      price: Number(p.price) || 0,
      unit: p.unit || 'unité',
      taxRate: p.tax_rate !== undefined ? Number(p.tax_rate) : 18
    }));
    const cloudCatalogIds = new Set(cloudCatalog.map(p => p.id));
    const pendingLocalCatalog = (this.state.catalog || []).filter(p => p && p.id && !cloudCatalogIds.has(p.id));
    this.state.catalog = [...cloudCatalog, ...pendingLocalCatalog];

    // 3. Sync & Merge Documents
    const cloudDocs = (data.documents || []).map(d => {
      let parsedItems = d.items || [];
      let storedIssueDate = d.issue_date || (d.created_at ? d.created_at.split('T')[0] : '') || '';
      let storedDueDate = d.date_due || d.due_date || '';
      let storedCurrency = d.currency || 'FCFA';

      let storedPrimaryColor = null;
      let storedSecondaryColor = null;
      let storedTemplateId = null;

      if (typeof parsedItems === 'string') {
        try {
          const wrapper = JSON.parse(parsedItems);
          if (wrapper && !Array.isArray(wrapper) && Array.isArray(wrapper.lines)) {
            parsedItems = wrapper.lines;
            storedIssueDate = wrapper.issueDate || storedIssueDate;
            storedDueDate = wrapper.dueDate || storedDueDate;
            storedCurrency = wrapper.currency || storedCurrency;
            storedPrimaryColor = wrapper.primaryColor || null;
            storedSecondaryColor = wrapper.secondaryColor || null;
            storedTemplateId = wrapper.templateId || null;
          } else if (Array.isArray(wrapper)) {
            parsedItems = wrapper;
          } else {
            parsedItems = [];
          }
        } catch (_) { parsedItems = []; }
      } else if (parsedItems && !Array.isArray(parsedItems) && Array.isArray(parsedItems.lines)) {
        storedIssueDate = parsedItems.issueDate || storedIssueDate;
        storedDueDate = parsedItems.dueDate || storedDueDate;
        storedCurrency = parsedItems.currency || storedCurrency;
        storedPrimaryColor = parsedItems.primaryColor || null;
        storedSecondaryColor = parsedItems.secondaryColor || null;
        storedTemplateId = parsedItems.templateId || null;
        parsedItems = parsedItems.lines;
      }

      return {
        id: d.id,
        number: d.number,
        type: d.type || 'invoice',
        status: d.status || 'draft',
        currency: storedCurrency,
        clientId: d.client_id,
        clientName: d.client_name,
        clientType: d.client_type,
        clientTaxId: d.client_tax_id,
        clientEmail: d.client_email,
        clientPhone: d.client_phone,
        issueDate: storedIssueDate,
        dueDate: storedDueDate,
        items: parsedItems,
        subtotal: parseFloat(d.subtotal) || 0,
        discount: parseFloat(d.discount) || 0,
        taxRate: parseFloat(d.tax_rate) || 0,
        tax: parseFloat(d.tax_amount) || 0,
        total: parseFloat(d.total) || 0,
        amountPaid: parseFloat(d.amount_paid) || 0,
        notes: d.notes || '',
        terms: d.conditions || d.terms || '',
        publicToken: d.public_token,
        viewsCount: d.views_count || 0,
        primaryColor: storedPrimaryColor,
        secondaryColor: storedSecondaryColor,
        templateId: storedTemplateId || 'minimalist',
        visualTemplate: storedTemplateId || 'minimalist'
      };
    });

    // Deduplicate orphan draft sessions: if multiple drafts exist with the same document number, keep only the latest one and purge stale duplicates
    const seenDraftNumbers = new Map();
    const deduplicatedCloudDocs = [];
    const duplicateDraftIdsToPurge = [];

    // Sort descending by created_at / issueDate so most recent draft comes first
    cloudDocs.sort((a, b) => new Date(b.created_at || b.issueDate || 0) - new Date(a.created_at || a.issueDate || 0));

    cloudDocs.forEach(d => {
      const isDraft = d.status === 'draft' || d.status === 'brouillon';
      if (isDraft && d.number) {
        const key = `${d.type || 'invoice'}_${String(d.number).trim().toUpperCase()}`;
        if (seenDraftNumbers.has(key)) {
          duplicateDraftIdsToPurge.push(d.id);
          return;
        }
        seenDraftNumbers.set(key, d.id);
      }
      deduplicatedCloudDocs.push(d);
    });

    if (duplicateDraftIdsToPurge.length > 0 && window.KivoDb && typeof window.KivoDb.deleteDocument === 'function') {
      duplicateDraftIdsToPurge.forEach(dupId => {
        window.KivoDb.deleteDocument(dupId).catch(err => console.warn('[KivoApp] Cleaned duplicate draft:', dupId, err));
      });
    }

    const cloudDocIds = new Set(deduplicatedCloudDocs.map(d => d.id));
    const pendingLocalDocs = (this.state.documents || []).filter(d => d && d.id && !cloudDocIds.has(d.id));
    this.state.documents = [...deduplicatedCloudDocs, ...pendingLocalDocs];

    // Background push any pending local documents to Supabase
    if (pendingLocalDocs.length > 0 && window.KivoDb && typeof window.KivoDb.saveDocument === 'function') {
      pendingLocalDocs.forEach(d => {
        window.KivoDb.saveDocument(d).catch(e => console.warn('[KivoApp] Background sync doc error:', e));
      });
    }

    // 4. Activities
    if (data.activities && data.activities.length > 0) {
      this.state.activities = data.activities.map(a => ({
        id: a.id, timestamp: a.timestamp, type: a.type,
        icon: a.icon, title: a.title, details: a.details
      }));
    }

    this.saveState();
    if (this.activeView && this.activeView !== 'landing' && this.activeView !== 'auth') {
      this.renderCurrentView();
    }
    console.log('[KivoApp] Supabase sync complete. isOnboarded:', this.state.isOnboarded, 'Clients:', this.state.clients.length, 'Docs:', this.state.documents.length);
  },

  /**
   * Pushes local state changes to Supabase (async, fire-and-forget)
   */
  syncDocumentToSupabase: async function (doc) {
    if (!window.KivoDb || !this.supabaseConnected) return;
    try {
      await window.KivoDb.saveDocument({
        id: doc.id, number: doc.number, type: doc.type, status: doc.status,
        currency: doc.currency || (this.state && this.state.business && this.state.business.currency) || 'FCFA',
        clientId: doc.clientId,       // saveDocument maps these internally
        clientName: doc.clientName,
        clientType: doc.clientType,
        clientTaxId: doc.clientTaxId,
        clientEmail: doc.clientEmail,
        clientPhone: doc.clientPhone,
        issueDate: doc.issueDate, dueDate: doc.dueDate,
        items: doc.items,             // saveDocument wraps this in {lines:[...]}
        subtotal: doc.subtotal, discount: doc.discount, taxRate: doc.taxRate,
        taxAmount: doc.tax,           // saveDocument maps taxAmount → tax_amount
        total: doc.total, amountPaid: doc.amountPaid || 0,
        notes: doc.notes,
        conditions: doc.terms,        // saveDocument uses conditions as primary
        publicToken: doc.publicToken, viewsCount: doc.viewsCount || 0
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
          this.state.business.defaultVatRate = 0;
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
    this.applyLanguage(this.state.language || 'fr');
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
    this.showToast(this._t('toast_demo_activated'), "success");
    this.navigate('dashboard');
  },

  /**
   * Logs out: signs out of Supabase AND clears local state
   * FIX: Must call supabase.auth.signOut() to clear the session token from localStorage.
   * Without this, getSession() finds the old token and auto-logs in the user.
   */
  logout: async function (confirmed = false) {
    if (!confirmed) {
      const sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('mobile-open') && typeof this.toggleMobileSidebar === 'function') {
        this.toggleMobileSidebar(false);
      }
      this.openModal('modal-confirm-logout');
      return;
    }
    this.closeModal('modal-confirm-logout');

    console.log('[KivoApp] Logging out...');
    this.isSessionLoading = false;
    this._isAuthenticating = false;
    if (window.KivoAuth) {
      window.KivoAuth._isLoggingIn = false;
    }

    try {
      // 1. Capture user-scoped storage key BEFORE clearing user object
      const userKey = this.getUserStorageKey();
      if (userKey) localStorage.removeItem(userKey);
      localStorage.removeItem('kivo_app_state');
      localStorage.removeItem('kivo_app_state_guest');

      // 2. Explicitly purge all Supabase auth tokens from localStorage
      // to ensure no stale token can re-authenticate the user on page refresh
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('sb-') || k.startsWith('supabase.') || k.includes('auth-token'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      // 3. Clear session and user references in memory
      if (window.KivoAuth) {
        window.KivoAuth.user = null;
        window.KivoAuth.session = null;
      }
      this.supabaseConnected = false;
      this.state = JSON.parse(JSON.stringify(this.BLANK_STATE));
      this.state.isOnboarded = false;

      // 4. Perform Supabase SDK signOut with catch guard
      if (window.KivoDb && window.KivoDb.supabase) {
        try {
          await KivoDb.supabase.auth.signOut();
        } catch (authErr) {
          console.warn('[KivoApp] Supabase signOut non-blocking error:', authErr);
        }
      }
    } catch (e) {
      console.error('[KivoApp] Error during logout:', e);
    }

    // 5. Clean URL and navigate to landing cleanly
    this.navigate('landing');
    this.showToast(this._t('toast_logout_success'), 'info');
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
    if (this.isSessionLoading) {
      console.log('[KivoApp] handleRoute deferred — session loading in progress.');
      return;
    }

    const hash = window.location.hash || '';
    let rawView = hash.split('?')[0].replace('#', '');
    let viewName = rawView;
    let anchorTarget = null;

    if (rawView.startsWith('landing-')) {
      viewName = 'landing';
      anchorTarget = rawView;
    }

    const publicViews = ['landing', 'auth', 'public-doc', 'pricing'];
    const appViews = ['dashboard', 'documents', 'document-builder', 'clients', 'services', 'products-services', 'catalog', 'reminders', 'analytics', 'settings', 'ai', 'team', 'integrations'];
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
        if (window.location.hash && window.location.hash !== '#landing' && window.location.hash !== '#') {
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', '#landing');
          } else {
            window.location.hash = '#landing';
          }
        }
      }
    } else if (!isOnboarded) {
      // 2. AUTHENTICATED BUT ONBOARDING INCOMPLETE:
      // Mandatory onboarding before accessing dashboard or document management
      if (viewName !== 'onboarding' && viewName !== 'public-doc') {
        viewName = 'onboarding';
        if (window.location.hash !== '#onboarding') {
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', '#onboarding');
          } else {
            window.location.hash = '#onboarding';
          }
        }
      }
    } else {
      // 3. AUTHENTICATED AND ONBOARDED:
      // Redirect from landing, auth, or onboarding to dashboard. Keep active subviews (documents, clients, etc.)
      if (!viewName || viewName === 'landing' || viewName === 'auth' || viewName === 'onboarding') {
        viewName = 'dashboard';
      }

      // Restrict AI view to Pro/Business plans only
      if (viewName === 'ai') {
        const tier = (this.state && this.state.business && this.state.business.subscriptionTier) || 'Gratuit';
        const isPaid = (tier === 'Pro' || tier === 'Business');
        if (!isPaid) {
          viewName = 'dashboard';
          // Show toast after render cycle
          setTimeout(() => {
            this.showToast(this._t('toast_ai_pro_required'), 'info', 5000);
          }, 100);
        }
      }
    }

    this.activeView = viewName;

    // Purge any lingering or stale toast elements when navigating
    const tc = document.getElementById('toast-container');
    if (tc) tc.innerHTML = '';

    document.querySelectorAll('.view-section').forEach(sec => {
      sec.style.display = 'none';
    });

    let targetSectionId = `view-${viewName}`;
    if (viewName === 'services' || viewName === 'products-services') {
      targetSectionId = 'view-services';
    }
    const targetSection = document.getElementById(targetSectionId);
    if (targetSection) {
      targetSection.style.display = 'block';
    }

    // Handle view-auth tab selection based on hash query param
    if (viewName === 'auth') {
      const queryPart = hash.includes('?') ? hash.split('?')[1] : '';
      const params = new URLSearchParams(queryPart);
      const tab = params.get('tab');
      if (tab === 'register' || tab === 'signup') {
        this.switchAuthTab('register');
      } else if (tab === 'forgot') {
        this.switchAuthTab('forgot');
      } else {
        this.switchAuthTab('login');
      }
    }

    // public-doc and onboarding are ALWAYS fullwidth — no sidebar, no account chrome — regardless of auth state
    const alwaysFullWidth = ['public-doc', 'onboarding', 'landing', 'auth'];
    const isFullWidthView = alwaysFullWidth.includes(viewName) || (!isAuthenticated && viewName === 'pricing');
    document.body.classList.toggle('full-width-view', isFullWidthView);

    const sidebar = document.getElementById('sidebar');
    const mobileBottomNav = document.querySelector('.mobile-bottom-nav');
    const mobileHeader = document.querySelector('.mobile-header');

    if (sidebar) {
      if (isFullWidthView) {
        sidebar.style.display = 'none';
      } else {
        sidebar.style.display = 'flex';
      }
    }
    if (mobileBottomNav) mobileBottomNav.style.display = isFullWidthView ? 'none' : '';
    if (mobileHeader) {
      if (isFullWidthView) {
        mobileHeader.style.display = 'none';
      } else {
        mobileHeader.style.display = window.innerWidth <= 1024 ? 'flex' : '';
      }
    }

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
      const itemDataView = item.getAttribute('data-view');
      if (itemDataView === viewName || ((viewName === 'documents' || viewName === 'document-builder') && itemDataView === 'documents') || ((viewName === 'services' || viewName === 'products-services') && itemDataView === 'services')) {
        item.classList.add('active');
      }
    });

    // Show/hide AI nav item and related buttons based on subscription plan
    {
      const tier = (this.state && this.state.business && this.state.business.subscriptionTier) || 'Gratuit';
      const isPaid = (tier === 'Pro' || tier === 'Business');
      // Sidebar / mobile nav items pointing to AI
      document.querySelectorAll('[data-view="ai"]').forEach(el => {
        el.style.display = isPaid ? '' : 'none';
      });
      // "Voir la page IA" button inside new-doc-choice modal
      const modalAiBtn = document.getElementById('modal-new-doc-ai-btn');
      if (modalAiBtn) modalAiBtn.style.display = isPaid ? '' : 'none';
    }

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

    // Auto close mobile drawer on view navigation (also clears backdrop + body scroll lock)
    // NOTE: We skip the auto-close if the sidebar is already being closed by a touch handler
    // (i.e. within 200ms of a touch-initiated close) to avoid race conditions.
    if (sidebar && sidebar.classList.contains('mobile-open')) {
      const msSinceLastToggle = Date.now() - (this._lastToggleMobileSidebarTime || 0);
      if (msSinceLastToggle > 200) {
        this.toggleMobileSidebar(false);
      }
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
    const targetHash = `#${viewName}${params ? '?' + params : ''}`;
    if (window.location.hash === targetHash) {
      this.handleRoute();
    } else {
      window.location.hash = targetHash;
    }
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

  _lastToggleMobileSidebarTime: 0,

  /**
   * Toggle mobile sidebar drawer (open/close)
   * @param {boolean|undefined} forceState - true=open, false=close, undefined=toggle
   */
  toggleMobileSidebar: function (forceState) {
    const now = Date.now();
    // Guard against rapid duplicate trigger on touch devices (e.g. touchend + click within 350ms)
    if (forceState === undefined && now - this._lastToggleMobileSidebarTime < 350) {
      return;
    }
    this._lastToggleMobileSidebarTime = now;

    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar) return;

    const isCurrentlyOpen = sidebar.classList.contains('mobile-open');
    const shouldOpen = (typeof forceState === 'boolean') ? forceState : !isCurrentlyOpen;

    if (shouldOpen) {
      sidebar.style.display = 'flex';
      sidebar.classList.add('mobile-open');
      if (backdrop) backdrop.classList.add('active');
      document.body.style.overflow = 'hidden'; // prevent background scroll
      // Record open time for backdrop guard (prevents immediate close from synthetic click)
      this._lastToggleMobileSidebarTime = now;

      // Auto-expand navigation groups so user sees all choices immediately on mobile
      const billingGroup = document.getElementById('nav-group-billing-items');
      const settingsGroup = document.getElementById('nav-group-settings-items');
      const billingChevron = document.getElementById('chevron-billing');
      const settingsChevron = document.getElementById('chevron-settings');
      if (billingGroup) billingGroup.classList.add('open');
      if (settingsGroup) settingsGroup.classList.add('open');
      if (billingChevron) billingChevron.style.transform = 'rotate(180deg)';
      if (settingsChevron) settingsChevron.style.transform = 'rotate(180deg)';
    } else {
      sidebar.classList.remove('mobile-open');
      if (backdrop) backdrop.classList.remove('active');
      document.body.style.overflow = '';
      // Remove inline display style so CSS media queries resume control
      // Desktop: sidebar remains visible via CSS; Mobile: hidden by default (no .mobile-open)
      if (window.innerWidth <= 1024) {
        sidebar.style.display = '';
      }
    }
  },

  /**
   * Switch between Formulaire and Aperçu tabs in mobile Document Builder
   * @param {'form'|'preview'} tabName
   */
  switchBuilderMobileTab: function (tabName) {
    const container = document.querySelector('.builder-view-container');
    if (!container) return;

    // Update container mode class
    container.classList.remove('mobile-mode-form', 'mobile-mode-preview');
    container.classList.add(tabName === 'preview' ? 'mobile-mode-preview' : 'mobile-mode-form');

    // Update toggle button active states
    document.querySelectorAll('.builder-mobile-toggle-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtns = document.querySelectorAll(`.builder-mobile-toggle-btn[data-tab="${tabName}"]`);
    activeBtns.forEach(btn => btn.classList.add('active'));

    // Re-render live preview to guarantee fresh data and precise scale calculation
    if (tabName === 'preview') {
      requestAnimationFrame(() => {
        this.updateLiveInvoicePreview();
      });
    }

    // Scroll to top of the visible panel
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    // 1. Mobile menu toggle button
    // Strategy: on touch devices, we listen to `touchend` only and call preventDefault()
    // to prevent the subsequent synthetic `click` from firing a second toggle.
    // On non-touch devices (desktop), `click` fires normally.
    const toggleBtn = document.getElementById('mobile-menu-toggle');
    if (toggleBtn && !toggleBtn.dataset.bound) {
      toggleBtn.dataset.bound = 'true';
      let _touchHandled = false;
      let _tbStartX = 0, _tbStartY = 0, _tbIsScroll = false;
      toggleBtn.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length > 0) {
          _tbStartX = e.touches[0].clientX;
          _tbStartY = e.touches[0].clientY;
        }
        _tbIsScroll = false;
      }, { passive: true });
      toggleBtn.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches.length > 0) {
          if (Math.abs(e.touches[0].clientX - _tbStartX) > 8 || Math.abs(e.touches[0].clientY - _tbStartY) > 8) {
            _tbIsScroll = true;
          }
        }
      }, { passive: true });
      toggleBtn.addEventListener('touchend', (e) => {
        if (_tbIsScroll) return; // User was scrolling, ignore
        e.preventDefault(); // Stops synthetic click generation
        e.stopPropagation();
        _touchHandled = true;
        this.toggleMobileSidebar();
        setTimeout(() => { _touchHandled = false; }, 400);
      }, { passive: false });
      toggleBtn.addEventListener('click', (e) => {
        if (_touchHandled) { return; } // Swallow synthetic click after touchend
        e.stopPropagation();
        this.toggleMobileSidebar();
      });
    }

    // 2. Sidebar drawer mobile close button (X)
    const closeBtn = document.querySelector('.sidebar-mobile-close-btn');
    if (closeBtn && !closeBtn.dataset.bound) {
      closeBtn.dataset.bound = 'true';
      let _cbTouchHandled = false;
      let _cbStartX = 0, _cbStartY = 0, _cbIsScroll = false;
      closeBtn.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length > 0) {
          _cbStartX = e.touches[0].clientX;
          _cbStartY = e.touches[0].clientY;
        }
        _cbIsScroll = false;
      }, { passive: true });
      closeBtn.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches.length > 0) {
          if (Math.abs(e.touches[0].clientX - _cbStartX) > 8 || Math.abs(e.touches[0].clientY - _cbStartY) > 8) {
            _cbIsScroll = true;
          }
        }
      }, { passive: true });
      closeBtn.addEventListener('touchend', (e) => {
        if (_cbIsScroll) return;
        e.preventDefault();
        e.stopPropagation();
        _cbTouchHandled = true;
        this.toggleMobileSidebar(false);
        setTimeout(() => { _cbTouchHandled = false; }, 400);
      }, { passive: false });
      closeBtn.addEventListener('click', (e) => {
        if (_cbTouchHandled) { return; }
        e.stopPropagation();
        this.toggleMobileSidebar(false);
      });
    }

    // 3. Sidebar backdrop overlay
    // Guard: ignore any event fired within 400ms of the sidebar opening
    // to prevent the trailing synthetic click from immediately closing it.
    const backdropEl = document.getElementById('sidebar-backdrop');
    if (backdropEl && !backdropEl.dataset.bound) {
      backdropEl.dataset.bound = 'true';
      let _bdTouchHandled = false;
      let _bdStartX = 0, _bdStartY = 0, _bdIsScroll = false;
      const handleBackdrop = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        // Guard: sidebar was just opened — ignore trailing event
        const now = Date.now();
        if (now - this._lastToggleMobileSidebarTime < 400) { return; }
        this.toggleMobileSidebar(false);
      };
      backdropEl.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length > 0) {
          _bdStartX = e.touches[0].clientX;
          _bdStartY = e.touches[0].clientY;
        }
        _bdIsScroll = false;
      }, { passive: true });
      backdropEl.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches.length > 0) {
          if (Math.abs(e.touches[0].clientX - _bdStartX) > 8 || Math.abs(e.touches[0].clientY - _bdStartY) > 8) {
            _bdIsScroll = true;
          }
        }
      }, { passive: true });
      backdropEl.addEventListener('touchend', (e) => {
        if (_bdIsScroll) return; // User was scrolling, do not close menu
        e.preventDefault();
        e.stopPropagation();
        _bdTouchHandled = true;
        const now = Date.now();
        if (now - this._lastToggleMobileSidebarTime < 400) { return; }
        this.toggleMobileSidebar(false);
        setTimeout(() => { _bdTouchHandled = false; }, 400);
      }, { passive: false });
      backdropEl.addEventListener('click', (e) => {
        if (_bdTouchHandled) { return; }
        handleBackdrop(e);
      });
    }

    // 4. Robust navigation handler for all sidebar links on mobile and desktop
    // On iOS/Android, we fire navigation on touchend ONLY IF it was a true tap (not a scroll).
    // The subsequent 'click' event is swallowed to prevent double-fire.
    const sidebarNavLinks = document.querySelectorAll('.sidebar-nav a, .sidebar-footer-section a');
    sidebarNavLinks.forEach(link => {
      // Apply touch-action: manipulation to remove 300ms click delay on mobile
      link.style.touchAction = 'manipulation';

      let _linkTouchFired = false;
      let _linkStartX = 0, _linkStartY = 0, _linkIsScroll = false;

      const doNavigate = (e) => {
        const customOnClick = link.getAttribute('onclick');
        const view = link.getAttribute('data-view');
        const href = link.getAttribute('href');

        if (!customOnClick && (view || (href && href.startsWith('#')))) {
          e.preventDefault();
          const targetView = view || href.replace('#', '');
          this.navigate(targetView);
        } else if (customOnClick) {
          // For links with inline onclick (like 'Devis'), let the onclick run
          // but still close the sidebar
        }

        if (window.innerWidth <= 1024) {
          // Small delay so the view transition starts before the drawer closes
          setTimeout(() => this.toggleMobileSidebar(false), 80);
        }
      };

      link.addEventListener('touchstart', (e) => {
        // Track start position to distinguish scroll gesture from intentional tap
        if (e.touches && e.touches.length > 0) {
          _linkStartX = e.touches[0].clientX;
          _linkStartY = e.touches[0].clientY;
        }
        _linkIsScroll = false;
        _linkTouchFired = false;
      }, { passive: true });

      link.addEventListener('touchmove', (e) => {
        // If movement exceeds threshold, user is scrolling the drawer, NOT tapping
        if (e.touches && e.touches.length > 0) {
          const dx = Math.abs(e.touches[0].clientX - _linkStartX);
          const dy = Math.abs(e.touches[0].clientY - _linkStartY);
          if (dx > 8 || dy > 8) {
            _linkIsScroll = true;
          }
        }
      }, { passive: true });

      link.addEventListener('touchend', (e) => {
        if (_linkIsScroll) {
          // User was scrolling the sidebar, do not navigate or close drawer!
          return;
        }
        // Fire navigation immediately on deliberate tap (before synthetic click)
        e.preventDefault(); // Prevents the 300ms delayed synthetic click
        _linkTouchFired = true;
        doNavigate(e);
        setTimeout(() => { _linkTouchFired = false; }, 500);
      }, { passive: false });

      link.addEventListener('click', (e) => {
        if (_linkTouchFired) {
          // Touch already handled this, swallow the synthetic click
          e.preventDefault();
          return;
        }
        doNavigate(e);
      });
    });

    const userCard = document.querySelector('.sidebar-user-card');
    if (userCard) {
      userCard.addEventListener('click', () => {
        if (window.innerWidth <= 1024) {
          this.toggleMobileSidebar(false);
        }
      });
    }

    const filterPills = document.querySelectorAll('#doc-filter-pills button');
    filterPills.forEach(btn => {
      btn.addEventListener('click', (e) => {
        filterPills.forEach(b => b.classList.remove('active-pill'));
        const targetBtn = e.currentTarget;
        targetBtn.classList.add('active-pill');
        const filter = targetBtn.getAttribute('data-filter');
        const searchVal = document.getElementById('doc-search-input')?.value || '';
        this.renderDocumentsTable(filter, searchVal);
      });
    });

    const searchInput = document.getElementById('doc-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const activeFilter = document.querySelector('#doc-filter-pills button.active-pill')?.getAttribute('data-filter') || 'all';
        this.renderDocumentsTable(activeFilter, e.target.value);
      });
    }

    // 5. Smart mobile header — hides on scroll-down, reappears on scroll-up
    this._setupSmartMobileHeader();

    // 6. Phone formatting & prefix selectors
    this.setupPhoneInputs();
  },

  /**
   * Country ISO to phone prefix map
   */
  _countryPhonePrefixMap: {
    SN: '+221', CG: '+242', CD: '+243', CM: '+237', CI: '+225',
    ML: '+223', BF: '+226', TG: '+228', BJ: '+229', GN: '+224',
    GA: '+241', NE: '+227', TD: '+235', CF: '+236', MG: '+261',
    MR: '+222', FR: '+33',  BE: '+32',  CH: '+41',  CA: '+1',
    MA: '+212', TN: '+216', DZ: '+213', RW: '+250', KE: '+254',
    NG: '+234', GH: '+233'
  },

  /**
   * Formats a raw phone string into standardized spaced groups according to country prefix
   */
  formatPhoneNumber: function (rawVal, prefix) {
    if (!rawVal) return '';
    const digits = String(rawVal).replace(/\D/g, '');
    if (!digits) return '';

    const cleanPrefix = (prefix || '').replace(/\D/g, '');

    // France (+33)
    if (cleanPrefix === '33') {
      if (digits.startsWith('0')) {
        const parts = [];
        for (let i = 0; i < Math.min(digits.length, 10); i += 2) {
          parts.push(digits.slice(i, i + 2));
        }
        return parts.join(' ');
      } else {
        const parts = [digits.slice(0, 1)];
        for (let i = 1; i < Math.min(digits.length, 9); i += 2) {
          parts.push(digits.slice(i, i + 2));
        }
        return parts.join(' ');
      }
    }

    // Congo-Brazzaville (+242): ex prompt: "06 812 3456"
    if (cleanPrefix === '242') {
      if (digits.startsWith('0')) {
        const parts = [
          digits.slice(0, 2),
          digits.slice(2, 5),
          digits.slice(5, 9)
        ].filter(Boolean);
        return parts.join(' ');
      } else {
        if (digits.length <= 8) {
          const parts = [
            digits.slice(0, 1),
            digits.slice(1, 4),
            digits.slice(4, 8)
          ].filter(Boolean);
          return parts.join(' ');
        } else {
          const parts = [
            digits.slice(0, 2),
            digits.slice(2, 5),
            digits.slice(5, 9)
          ].filter(Boolean);
          return parts.join(' ');
        }
      }
    }

    // Senegal (+221): ex: 77 123 45 67
    if (cleanPrefix === '221') {
      const parts = [
        digits.slice(0, 2),
        digits.slice(2, 5),
        digits.slice(5, 7),
        digits.slice(7, 9)
      ].filter(Boolean);
      return parts.join(' ');
    }

    // Cameroon (+237): ex: 6 77 12 34 56
    if (cleanPrefix === '237') {
      if (digits.length >= 9) {
        const parts = [
          digits.slice(0, 1),
          digits.slice(1, 3),
          digits.slice(3, 5),
          digits.slice(5, 7),
          digits.slice(7, 9)
        ].filter(Boolean);
        return parts.join(' ');
      }
    }

    // Ivory Coast (+225) & Benin (+229): 10 digits in pairs (07 12 34 56 78)
    if (cleanPrefix === '225' || cleanPrefix === '229') {
      const parts = [];
      for (let i = 0; i < Math.min(digits.length, 10); i += 2) {
        parts.push(digits.slice(i, i + 2));
      }
      return parts.join(' ');
    }

    // DR Congo (+243): ex: 81 234 5678
    if (cleanPrefix === '243') {
      const parts = [
        digits.slice(0, 2),
        digits.slice(2, 5),
        digits.slice(5, 9)
      ].filter(Boolean);
      return parts.join(' ');
    }

    // USA / Canada (+1): ex: 202 555 0123
    if (cleanPrefix === '1') {
      const parts = [
        digits.slice(0, 3),
        digits.slice(3, 6),
        digits.slice(6, 10)
      ].filter(Boolean);
      return parts.join(' ');
    }

    // 8-digit African countries (Mali 223, Burkina 226, Togo 228, Niger 227, etc.)
    if (['223', '226', '228', '227', '235', '236', '222'].includes(cleanPrefix)) {
      const parts = [];
      for (let i = 0; i < Math.min(digits.length, 8); i += 2) {
        parts.push(digits.slice(i, i + 2));
      }
      return parts.join(' ');
    }

    // Belgium (+32) / Switzerland (+41)
    if (cleanPrefix === '32' || cleanPrefix === '41') {
      const parts = [];
      for (let i = 0; i < Math.min(digits.length, 10); i += 2) {
        parts.push(digits.slice(i, i + 2));
      }
      return parts.join(' ');
    }

    // General fallback
    if (digits.length <= 8) {
      const parts = [];
      for (let i = 0; i < digits.length; i += 2) {
        parts.push(digits.slice(i, i + 2));
      }
      return parts.join(' ');
    } else {
      const parts = [
        digits.slice(0, 2),
        digits.slice(2, 5),
        digits.slice(5, 7),
        digits.slice(7, 10)
      ].filter(Boolean);
      return parts.join(' ');
    }
  },

  /**
   * Helper to format an input element value and keep cursor position intact
   */
  formatPhoneInput: function (inputEl, prefix) {
    if (!inputEl) return;
    let raw = inputEl.value;
    if (!raw) return;

    // Detect pasted international prefix
    const prefixMatch = raw.match(/^\s*(\+\d{1,4})/);
    if (prefixMatch) {
      const detected = prefixMatch[1];
      const group = inputEl.closest('.phone-input-group');
      const select = group ? group.querySelector('.phone-prefix-select') : null;
      if (select) {
        for (let i = 0; i < select.options.length; i++) {
          if (select.options[i].value === detected) {
            select.selectedIndex = i;
            prefix = detected;
            break;
          }
        }
      } else {
        prefix = detected;
      }
      raw = raw.replace(prefixMatch[0], '');
    }

    const formatted = this.formatPhoneNumber(raw, prefix);
    if (formatted !== inputEl.value) {
      const oldLen = inputEl.value.length;
      const oldPos = inputEl.selectionStart || 0;
      inputEl.value = formatted;
      const newPos = Math.max(0, oldPos + (formatted.length - oldLen));
      inputEl.setSelectionRange(newPos, newPos);
    }
  },

  /**
   * Parses a phone string like "+33 6 12 34 56 78" into prefix and number
   */
  parsePhoneAndPrefix: function (phoneStr) {
    if (!phoneStr) return { prefix: '+221', number: '' };
    const trimmed = String(phoneStr).trim();
    const prefixes = [
      '+243', '+242', '+241', '+237', '+229', '+228', '+227', '+226', '+225',
      '+224', '+223', '+222', '+221', '+216', '+213', '+212', '+254', '+250',
      '+234', '+233', '+33', '+32', '+41', '+1'
    ];
    for (const p of prefixes) {
      if (trimmed.startsWith(p)) {
        return {
          prefix: p,
          number: trimmed.slice(p.length).trim()
        };
      }
    }
    return { prefix: '+221', number: trimmed };
  },

  /**
   * Attaches auto-spacing and prefix synchronization to all phone inputs
   */
  setupPhoneInputs: function () {
    const bindPhone = (inputId, selectId) => {
      const input = document.getElementById(inputId);
      const select = selectId ? document.getElementById(selectId) : null;
      if (!input) return;

      if (!input.dataset.phoneBound) {
        input.dataset.phoneBound = 'true';

        const getPrefix = () => select ? select.value : '';

        input.addEventListener('input', () => {
          this.formatPhoneInput(input, getPrefix());
        });

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Backspace') {
            const pos = input.selectionStart;
            if (pos > 1 && input.value[pos - 1] === ' ') {
              e.preventDefault();
              const val = input.value;
              const newVal = val.slice(0, pos - 2) + val.slice(pos);
              input.value = newVal;
              input.setSelectionRange(pos - 2, pos - 2);
              input.dispatchEvent(new Event('input'));
            }
          }
        });
      }

      if (select && !select.dataset.phoneBound) {
        select.dataset.phoneBound = 'true';
        select.addEventListener('change', () => {
          this.formatPhoneInput(input, select.value);
        });
      }
    };

    // 1. Wizard phone
    bindPhone('wz-phone', 'wz-phone-prefix');
    // 2. Client modal phone
    bindPhone('new-cli-phone', 'new-cli-phone-prefix');
    // 3. Settings business phone
    bindPhone('setting-biz-phone', 'setting-biz-phone-prefix');
    // 4. Builder phones
    bindPhone('builder-biz-phone', null);
    bindPhone('builder-client-phone', null);

    // Initialise les sélecteurs personnalisés d'indicatifs téléphoniques avec drapeaux (PC Windows & Mobile)
    this.initCustomPhonePrefixPickers();
  },

  /**
   * Custom phone prefix pickers with country flag images
   * Solves Windows native select emoji bug while ensuring mobile compatibility
   */
  initCustomPhonePrefixPickers: function () {
    const prefixSelects = document.querySelectorAll('.phone-prefix-select');
    prefixSelects.forEach(selectEl => {
      if (!selectEl || selectEl.dataset.customPickerInit === 'true') return;
      selectEl.dataset.customPickerInit = 'true';

      // Hide original select visually while keeping it accessible in DOM
      selectEl.style.display = 'none';

      // Parse options
      const options = Array.from(selectEl.options).map(opt => {
        const text = opt.textContent.trim();
        const match = text.match(/\(([A-Z]{2})/);
        const countryCode = match ? match[1].toLowerCase() : 'sn';
        return {
          value: opt.value,
          text: text,
          code: countryCode,
          flagUrl: `https://flagcdn.com/20x15/${countryCode}.png`
        };
      });

      const getSelectedOpt = () => {
        const currentVal = selectEl.value;
        return options.find(o => o.value === currentVal) || options[0] || { value: '+221', text: '+221', code: 'sn', flagUrl: 'https://flagcdn.com/20x15/sn.png' };
      };

      const wrap = document.createElement('div');
      wrap.className = 'phone-prefix-custom-picker';
      wrap.id = `custom-picker-${selectEl.id}`;

      const initialOpt = getSelectedOpt();
      wrap.innerHTML = `
        <button type="button" class="phone-prefix-btn" aria-haspopup="listbox" aria-expanded="false" title="Choisir l'indicatif téléphonique">
          <div class="phone-prefix-selected">
            <img class="phone-flag-img" src="${initialOpt.flagUrl}" alt="${initialOpt.code}" onerror="this.style.display='none'">
            <span class="phone-prefix-label">${initialOpt.value}</span>
          </div>
          <svg class="phone-prefix-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
        <div class="phone-prefix-dropdown-list" role="listbox">
          ${options.map(opt => `
            <div class="phone-prefix-option ${opt.value === selectEl.value ? 'active' : ''}" data-value="${opt.value}" role="option">
              <img class="phone-flag-img" src="${opt.flagUrl}" alt="${opt.code}" onerror="this.style.display='none'">
              <span>${opt.text}</span>
            </div>
          `).join('')}
        </div>
      `;

      selectEl.parentNode.insertBefore(wrap, selectEl);

      const btn = wrap.querySelector('.phone-prefix-btn');
      const dropdown = wrap.querySelector('.phone-prefix-dropdown-list');
      const flagImg = wrap.querySelector('.phone-prefix-selected .phone-flag-img');
      const label = wrap.querySelector('.phone-prefix-selected .phone-prefix-label');

      const updateDisplay = (opt) => {
        if (!opt) return;
        flagImg.src = opt.flagUrl;
        flagImg.style.display = 'inline-block';
        label.textContent = opt.value;
        wrap.querySelectorAll('.phone-prefix-option').forEach(el => {
          el.classList.toggle('active', el.dataset.value === opt.value);
        });
      };

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const isOpen = wrap.classList.contains('open');
        document.querySelectorAll('.phone-prefix-custom-picker.open').forEach(p => {
          if (p !== wrap) p.classList.remove('open');
        });
        wrap.classList.toggle('open', !isOpen);
      });

      wrap.querySelectorAll('.phone-prefix-option').forEach(optEl => {
        optEl.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const val = optEl.dataset.value;
          selectEl.value = val;
          const opt = options.find(o => o.value === val);
          updateDisplay(opt);
          wrap.classList.remove('open');
          selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        });
      });

      selectEl.addEventListener('change', () => {
        updateDisplay(getSelectedOpt());
      });

      const observer = new MutationObserver(() => {
        updateDisplay(getSelectedOpt());
      });
      observer.observe(selectEl, { attributes: true, attributeFilter: ['value'] });
    });

    if (!window._phonePrefixDocClickBound) {
      window._phonePrefixDocClickBound = true;
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.phone-prefix-custom-picker')) {
          document.querySelectorAll('.phone-prefix-custom-picker.open').forEach(p => p.classList.remove('open'));
        }
      });
    }
  },

  /**
   * Smart sticky mobile header: hides when scrolling down, shows when scrolling up.
   * Only active on mobile (<= 1024px). Uses rAF for 60fps performance.
   */
  _setupSmartMobileHeader: function () {
    const mobileHeader = document.querySelector('.mobile-header');
    if (!mobileHeader) return;

    let lastScrollY = window.scrollY;
    let rafId = null;
    let ticking = false;

    const updateHeader = () => {
      if (window.innerWidth > 1024) {
        // Desktop: always show, no classes
        mobileHeader.classList.remove('mobile-header--hidden', 'mobile-header--scrolled');
        ticking = false;
        return;
      }

      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;

      if (currentScrollY > 8) {
        mobileHeader.classList.add('mobile-header--scrolled');
      } else {
        mobileHeader.classList.remove('mobile-header--scrolled');
      }

      if (delta > 4 && currentScrollY > 60) {
        // Scrolling down significantly — hide header
        mobileHeader.classList.add('mobile-header--hidden');
      } else if (delta < -4 || currentScrollY <= 10) {
        // Scrolling up or near top — show header
        mobileHeader.classList.remove('mobile-header--hidden');
      }

      lastScrollY = currentScrollY;
      ticking = false;
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        rafId = requestAnimationFrame(updateHeader);
      }
    }, { passive: true });

    // Re-show header whenever a new view is navigated to
    const origNavigate = this.navigate ? this.navigate.bind(this) : null;
    if (origNavigate) {
      this.navigate = function (...args) {
        mobileHeader.classList.remove('mobile-header--hidden');
        return origNavigate(...args);
      };
    }
  },

  /**
   * Render Dispatcher
   */
  renderCurrentView: function () {
    this.updateUserBrandingUI();

    switch (this.activeView) {
      case 'onboarding':
        this.wizardInit();
        break;
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'documents':
        this.renderDocumentsTable('all');
        break;
      case 'clients':
        this.renderClients();
        break;
      case 'services':
      case 'products-services':
        this.renderServices();
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
      case 'team':
        this.renderTeam();
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
      case 'document-builder':
        // Reset mobile tab to "form" view each time builder is opened
        this.switchBuilderMobileTab('form');
        this.populateBuilderCatalogDropdown();
        this.updateLiveInvoicePreview();
        break;
      default:
        break;
    }
  },

  /**
   * Helper pour obtenir le nom commercial ou personnel de l'utilisateur
   */
  getBusinessName: function () {
    const biz = (this.state && this.state.business) || {};
    return biz.company_name || biz.name || biz.owner || (window.KivoAuth?.user?.user_metadata?.full_name) || 'Mon Entreprise';
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
    if (bizEl) bizEl.textContent = this.getBusinessName();
    
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

    // Update mobile header avatar initials
    const mobileInitialsEl = document.getElementById('mobile-user-initials');
    if (mobileInitialsEl) {
      const owner = biz.owner || biz.name || '';
      const initials = owner.split(' ').filter(w => w.length > 0).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'KM';
      mobileInitialsEl.textContent = initials;
    }

    // Update sidebar user card
    const sidebarUserName = document.getElementById('sidebar-user-name');
    const sidebarUserEmail = document.getElementById('sidebar-user-email');
    const sidebarUserAvatarEl = document.getElementById('sidebar-user-avatar');
    if (sidebarUserName) sidebarUserName.textContent = biz.owner || biz.name || 'Mon compte';
    if (sidebarUserEmail) sidebarUserEmail.textContent = biz.email || (window.KivoAuth && window.KivoAuth.user ? window.KivoAuth.user.email : '');
    if (sidebarUserAvatarEl) {
      const owner2 = biz.owner || biz.name || '';
      const initials2 = owner2.split(' ').filter(w => w.length > 0).slice(0, 2).map(w => w[0].toUpperCase()).join('') || 'KM';
      sidebarUserAvatarEl.textContent = initials2;
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
    this.showToast(this._t('toast_logo_deleted'), "info");
  },

  /**
   * Supprime le logo uniquement de la facture en cours d'édition
   * Ne touche PAS au logo du profil d'entreprise
   */
  removeBuilderLogo: function () {
    this.builderCustomLogoUrl = null;
    this._invoiceLogoRemoved = true;
    const logoImg = document.getElementById('builder-logo-preview-img');
    const previewBox = document.getElementById('builder-logo-preview-box');
    const uploadPrompt = document.getElementById('builder-logo-upload-prompt');
    if (logoImg) { logoImg.src = ''; logoImg.style.display = 'none'; }
    if (previewBox) previewBox.style.display = 'none';
    if (uploadPrompt) uploadPrompt.style.display = 'block';
    this.updateLiveInvoicePreview();
    this.showToast(this._t('toast_logo_removed_invoice'), 'info');
  },

  /**
   * Multi-language switcher helper
   */
  setLanguage: function (lang) {
    const targetLang = (this.translations && this.translations[lang]) ? lang : 'fr';
    this.state.language = targetLang;
    this.saveState();
    this.applyLanguage(targetLang);

    if (window.KivoDb && this.supabaseConnected) {
      window.KivoDb.saveSettings({ language: targetLang }).catch(() => {});
    }

    const langNames = { fr: 'Français', en: 'English', es: 'Español' };
    this.showToast(this._t('toast_lang_applied').replace('{lang}', langNames[targetLang] || targetLang.toUpperCase()), "success");
    this.renderCurrentView();
  },

  applyLanguage: function (lang) {
    const l = lang || (this.state && this.state.language) || 'fr';
    const dict = {
      fr: {
        dashboard: 'Tableau de bord',
        documents: 'Facturation',
        clients: 'Clients',
        services: 'Services / Prestations',
        catalog: 'Modèles',
        ai: 'Création avec IA',
        analytics: 'Rapports',
        settings: 'Paramètres',
        profile: 'Mon profil',
        pricing: 'Abonnement & Paiement',
        team: 'Équipe',
        integrations: 'Intégrations',
        newDoc: '+ Nouveau document'
      },
      en: {
        dashboard: 'Dashboard',
        documents: 'Billing & Invoices',
        clients: 'Clients & CRM',
        services: 'Services & Items',
        catalog: 'Templates',
        ai: 'AI Assistant',
        analytics: 'Reports & Analytics',
        settings: 'Settings',
        profile: 'My Profile',
        pricing: 'Plans & Billing',
        team: 'Team Members',
        integrations: 'Integrations',
        newDoc: '+ New Document'
      },
      es: {
        dashboard: 'Panel de Control',
        documents: 'Facturación',
        clients: 'Clientes y CRM',
        services: 'Servicios y Artículos',
        catalog: 'Plantillas',
        ai: 'Asistente IA',
        analytics: 'Informes y Estadísticas',
        settings: 'Ajustes',
        profile: 'Mi Perfil',
        pricing: 'Suscripciones y Pagos',
        team: 'Equipo',
        integrations: 'Integraciones',
        newDoc: '+ Nuevo Documento'
      }
    };

    const t = dict[l] || dict.fr;

    // Update sidebar navigation items
    const navMap = {
      dashboard: t.dashboard,
      documents: t.documents,
      clients: t.clients,
      services: t.services,
      catalog: t.catalog,
      ai: t.ai,
      analytics: t.analytics,
      settings: t.profile,
      pricing: t.pricing,
      team: t.team,
      integrations: t.integrations
    };

    Object.keys(navMap).forEach(view => {
      const el = document.querySelector(`.nav-item[data-view="${view}"] .nav-label, .nav-sub-item[data-view="${view}"] .nav-label`);
      if (el) el.textContent = navMap[view];
    });

    const settingsTrigger = document.querySelector('.nav-group-trigger[data-group="settings"] .nav-label');
    if (settingsTrigger) settingsTrigger.textContent = t.settings;

    const langSelect = document.getElementById('setting-biz-language');
    if (langSelect && langSelect.value !== l) {
      langSelect.value = l;
    }

    document.documentElement.lang = l;

    // Sync the new i18n engine so all KivoI18n.t() calls use the same language
    if (window.KivoI18n) window.KivoI18n.setLang(l);
    this.translateModals();
  },

  /**
   * Primary translation shorthand helper for KivoApp.
   * Delegates to window.KivoI18n.t() with fallback to legacy dict.
   */
  _t: function (key) {
    if (window.KivoI18n && typeof window.KivoI18n.t === 'function') {
      return window.KivoI18n.t(key, (this.state && this.state.language) || 'fr');
    }
    return this.t(key);
  },

  /**
   * Synchronizes all modal headers, titles, and static elements to active language
   */
  translateModals: function () {
    const setText = (selector, key) => {
      const el = document.querySelector(selector);
      if (el) el.textContent = this._t(key);
    };

    setText('#confirm-modal-title', 'modal_confirm_delete_title');
    setText('#modal-confirm-logout h2', 'modal_confirm_logout_title');
    setText('#modal-confirm-logout p', 'modal_confirm_logout_body');
    setText('#confirm-logout-action-btn span', 'modal_confirm_logout_btn');
    setText('#modal-new-client .modal-header h2', 'modal_new_client_title');
    setText('#modal-invite-member .modal-title', 'modal_invite_member_title');
    setText('#modal-new-doc-choice .modal-header h2', 'modal_new_doc_title');
    setText('#modal-payment-checkout .modal-header h2', 'modal_payment_checkout_title');
    setText('#modal-payment-checkout h4', 'modal_payment_title');
    setText('#modal-change-password .modal-header h2', 'modal_change_password_title');
    setText('#modal-catalog-title', 'modal_catalog_title');
    setText('#modal-connected-accounts .modal-header h2', 'modal_connected_accounts_title');
  },

  t: function (key) {
    const lang = (this.state && this.state.language) || 'fr';
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
    let totalQuotes = 0;

    docs.forEach(doc => {
      const docTotal = doc.total || 0;
      const rawType = (doc.type || 'invoice').toLowerCase().trim();
      const isInvoice = rawType === 'invoice' || rawType === 'facture';
      const isQuote = rawType === 'quote' || rawType === 'devis';

      if (isInvoice) {
        totalInvoices++;
        const s = (doc.status || '').toLowerCase().trim();
        const isDocPaid = s === 'paid' || s === 'payée' || s === 'payee';
        if (isDocPaid) {
          paidTotal += docTotal;
          paidInvoicesCount++;
        } else if (s === 'overdue') {
          overdueTotal += docTotal;
          overdueInvoicesCount++;
        } else if (s === 'sent' || s === 'viewed') {
          pendingTotal += docTotal;
          pendingInvoicesCount++;
        }
      } else if (isQuote) {
        totalQuotes++;
      }
    });

    // Update total documents counter (invoices + quotes)
    const totalDocs = totalInvoices + totalQuotes;
    const totalDocsEl = document.getElementById('kpi-total-docs');
    if (totalDocsEl) totalDocsEl.textContent = totalDocs;

    // Segmented bar (Invoices in blue #3B82F6, Quotes in purple #8B5CF6)
    const barInv = document.getElementById('kpi-bar-invoices');
    const barQuotes = document.getElementById('kpi-bar-quotes');
    if (barInv && barQuotes) {
      if (totalDocs > 0) {
        const invPct = Math.round((totalInvoices / totalDocs) * 100);
        const quotePct = 100 - invPct;
        barInv.style.width = invPct + '%';
        barQuotes.style.width = quotePct + '%';
      } else {
        barInv.style.width = '0%';
        barQuotes.style.width = '0%';
      }
    }

    const docsLegendEl = document.getElementById('kpi-docs-legend');
    if (docsLegendEl) {
      docsLegendEl.textContent = `${totalInvoices} facture${totalInvoices > 1 ? 's' : ''} · ${totalQuotes} devis`;
    }

    // Format currency with Intl.NumberFormat('fr-FR')
    const formatCurrency = (val) => {
      const rawCurrency = (biz && biz.currency) || 'FCFA';
      return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(val || 0)) + ' ' + rawCurrency;
    };

    const greetingEl = document.getElementById('dash-greeting');
    if (greetingEl) {
      const firstName = (biz.owner || '').split(' ')[0] || '';
      if (window.KivoI18n) {
        greetingEl.textContent = KivoI18n.getGreeting(firstName || null, this.state.language || 'fr');
      } else {
        greetingEl.textContent = `Bonjour ${firstName || 'vous'},`;
      }
    }
    
    // Revenue calculations: current month vs. previous month
    const now = new Date();
    const currY = now.getFullYear();
    const currM = now.getMonth();
    const prevDate = new Date(currY, currM - 1, 1);
    const prevY = prevDate.getFullYear();
    const prevM = prevDate.getMonth();

    let currMonthPaid = 0;
    let prevMonthPaid = 0;
    let hasPrevMonthDocs = false;

    docs.forEach(doc => {
      const rawType = (doc.type || 'invoice').toLowerCase().trim();
      if (rawType !== 'invoice' && rawType !== 'facture') return;
      const rawDate = doc.issueDate || doc.date_issued || doc.createdAt;
      if (!rawDate) return;
      const dt = new Date(rawDate);
      if (isNaN(dt.getTime())) return;
      const s = (doc.status || '').toLowerCase().trim();
      const isPaid = s === 'paid' || s === 'payée' || s === 'payee';

      if (dt.getFullYear() === currY && dt.getMonth() === currM) {
        if (isPaid) currMonthPaid += (doc.total || 0);
      } else if (dt.getFullYear() === prevY && dt.getMonth() === prevM) {
        hasPrevMonthDocs = true;
        if (isPaid) prevMonthPaid += (doc.total || 0);
      } else if (dt < prevDate) {
        hasPrevMonthDocs = true;
      }
    });

    let trendHtml = '';
    if (hasPrevMonthDocs && prevMonthPaid > 0) {
      const diffPct = Math.round(((currMonthPaid - prevMonthPaid) / prevMonthPaid) * 100);
      if (diffPct > 0) {
        trendHtml = ` · <span style="color:#10B981; font-weight:700;">▲ +${diffPct} % vs. dernier mois</span>`;
      } else if (diffPct < 0) {
        trendHtml = ` · <span style="color:#EF4444; font-weight:700;">▼ ${diffPct} % vs. dernier mois</span>`;
      } else {
        trendHtml = ` · <span style="color:#6B7280; font-weight:600;">= 0 % vs. dernier mois</span>`;
      }
    } else if (hasPrevMonthDocs && prevMonthPaid === 0 && currMonthPaid > 0) {
      trendHtml = ` · <span style="color:#10B981; font-weight:700;">▲ +100 % vs. dernier mois</span>`;
    }

    const paidEl = document.getElementById('kpi-paid');
    if (paidEl) paidEl.textContent = formatCurrency(paidTotal);
    
    const paidInvEl = document.getElementById('kpi-paid-invoices');
    if (paidInvEl) {
      paidInvEl.textContent = `${paidInvoicesCount} facture${paidInvoicesCount > 1 ? 's' : ''} payée${paidInvoicesCount > 1 ? 's' : ''}`;
    }
    const paidTrendEl = document.getElementById('kpi-paid-trend');
    if (paidTrendEl) {
      if (trendHtml) {
        paidTrendEl.innerHTML = trendHtml;
        paidTrendEl.style.display = 'inline';
      } else {
        paidTrendEl.innerHTML = '';
        paidTrendEl.style.display = 'none';
      }
    }
    
    const pendCountEl = document.getElementById('kpi-pending-count');
    if (pendCountEl) pendCountEl.textContent = `${pendingInvoicesCount} facture${pendingInvoicesCount > 1 ? 's' : ''}`;
    const pendAmountEl = document.getElementById('kpi-pending-amount');
    if (pendAmountEl) {
      if (pendingInvoicesCount > 0) {
        pendAmountEl.textContent = formatCurrency(pendingTotal);
      } else {
        pendAmountEl.innerHTML = `<span style="color:#9CA3AF; font-size:14px; font-style:italic;">Aucune facture en attente</span>`;
      }
    }
    
    const overCountEl = document.getElementById('kpi-overdue-count');
    if (overCountEl) overCountEl.textContent = `${overdueInvoicesCount} facture${overdueInvoicesCount > 1 ? 's' : ''}`;
    const overAmountEl = document.getElementById('kpi-overdue-amount');
    if (overAmountEl) {
      if (overdueInvoicesCount > 0) {
        overAmountEl.textContent = formatCurrency(overdueTotal);
      } else {
        overAmountEl.innerHTML = `<span style="color:#9CA3AF; font-size:14px; font-style:italic;">Aucune facture en retard</span>`;
      }
    }


    const tbody = document.getElementById('dashboard-recent-docs-tbody');
    if (tbody) {
      const recentInvoices = docs.filter(d => d.type === 'invoice').slice(0, 5);
      const _t = window.KivoI18n ? (k) => KivoI18n.t(k, this.state.language || 'fr') : (k) => k;
      if (recentInvoices.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; padding: 2rem;">${_t('dash_no_recent_invoices') || 'Aucune facture récente'}</td>
          </tr>
        `;
      } else {
        tbody.innerHTML = recentInvoices.map(doc => {
          let badgeClass = 'pending';
          const rawSt = (doc.status || '').toLowerCase().trim();
          const isDocPaid = rawSt === 'paid' || rawSt === 'payée' || rawSt === 'payee';
          const statusKey = isDocPaid ? 'status_paid' : (rawSt === 'overdue' ? 'status_overdue' : 'status_sent');
          let badgeText = _t(statusKey);
          if (isDocPaid) badgeClass = 'paid';
          else if (rawSt === 'overdue') badgeClass = 'overdue';

          let docDate = doc.date;
          if (!docDate || docDate === 'undefined') {
            docDate = doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('fr-FR') : 'N/A';
          }

          return `
            <tr onclick="KivoApp.viewPublicDoc('${doc.id}')" style="cursor: pointer;" title="${_t('btn_edit')} ${doc.number}">
              <td><strong style="color: var(--primary); font-weight: 600;">${doc.number}</strong></td>
              <td>${doc.clientName || 'Client'}</td>
              <td style="color: var(--text-secondary);">${docDate}</td>
              <td><strong>${formatCurrency(doc.total || 0)}</strong></td>
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
   * Helper to format table row for documents with modern SaaS layout and discrete kebab menu
   */
  createDocTableRowHtml: function (doc) {
    const biz = this.state.business || {};
    const currencyStr = doc.currency || biz.currency || 'FCFA';

    const isQuote = doc.type === 'quote';
    const rawStatus = (doc.status || 'draft').toLowerCase().trim();

    // Determine semantic status & visual row tint matching reference design
    const isDraft = rawStatus === 'draft' || rawStatus === 'brouillon';
    const isPaid = rawStatus === 'paid' || rawStatus === 'payée' || rawStatus === 'payee';
    const isOverdue = rawStatus === 'overdue';
    const isRefunded = rawStatus === 'refunded';
    const isArchived = rawStatus === 'archived' || rawStatus === 'archive' || rawStatus === 'cancelled' || rawStatus === 'rejected';
    const isProspect = rawStatus === 'prospect' || (isQuote && (rawStatus === 'sent' || rawStatus === 'viewed' || rawStatus === 'pending'));

    let rowStatusClass = 'doc-row-status-draft';
    let statusBadgeHtml = '';

    if (isDraft) {
      rowStatusClass = 'doc-row-status-draft';
      statusBadgeHtml = `
        <span class="badge badge-doc-status badge-status-draft">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 9.5-9.5z"/></svg>
          Brouillon
        </span>
      `;
    } else if (isPaid) {
      rowStatusClass = 'doc-row-status-paid';
      statusBadgeHtml = `
        <span class="badge badge-doc-status badge-status-paid">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><polyline points="20 6 9 17 4 12"/></svg>
          Payée
        </span>
      `;
    } else if (isQuote && isArchived) {
      rowStatusClass = 'doc-row-status-archived';
      statusBadgeHtml = `
        <span class="badge badge-doc-status badge-status-archived">
          Devis (Archivé)
        </span>
      `;
    } else if (isQuote && isProspect) {
      rowStatusClass = 'doc-row-status-prospect';
      statusBadgeHtml = `
        <span class="badge badge-doc-status badge-status-prospect">
          Devis (Prospect)
        </span>
      `;
    } else if (isQuote) {
      rowStatusClass = 'doc-row-status-quote-blue';
      statusBadgeHtml = `
        <span class="badge badge-doc-status badge-status-quote-blue">
          Devis
        </span>
      `;
    } else if (isOverdue) {
      rowStatusClass = 'doc-row-status-overdue';
      statusBadgeHtml = `
        <span class="badge badge-doc-status badge-status-overdue">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          En retard
        </span>
      `;
    } else if (isRefunded) {
      rowStatusClass = 'doc-row-status-refunded';
      statusBadgeHtml = `
        <span class="badge badge-doc-status badge-status-refunded">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          Remboursée
        </span>
      `;
    } else {
      rowStatusClass = 'doc-row-status-sent';
      const label = rawStatus === 'viewed' ? 'Consultée' : 'Envoyée';
      statusBadgeHtml = `
        <span class="badge badge-doc-status badge-status-sent">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          ${label}
        </span>
      `;
    }

    const typeBadgeHtml = isQuote
      ? `<span class="badge badge-type-quote">Devis</span>`
      : `<span class="badge badge-type-invoice">Facture</span>`;

    return `
      <tr class="doc-table-row ${rowStatusClass}" onclick="KivoApp.viewPublicDoc('${doc.id}')">
        <td class="col-doc-num"><strong style="color: var(--text-primary); font-size: 0.88rem; font-weight: 600;">${doc.number}</strong></td>
        <td class="col-doc-client">
          <div style="font-weight: 600; color: var(--text-primary); line-height: 1.25;">${doc.clientName || 'Client anonyme'}</div>
          ${doc.clientType ? `<span style="font-size: 0.72rem; color: var(--text-muted);">${doc.clientType}</span>` : ''}
        </td>
        <td class="col-doc-type">${typeBadgeHtml}</td>
        <td class="col-doc-issue-date" style="color: var(--text-secondary); font-size: 0.88rem;">${doc.issueDate || '-'}</td>
        <td class="col-doc-due-date" style="color: var(--text-secondary); font-size: 0.88rem;">${doc.dueDate || '-'}</td>
        <td class="col-doc-total"><strong style="color: var(--text-primary); font-size: 0.95rem;">${(doc.total || 0).toLocaleString('fr-FR')} ${currencyStr}</strong></td>
        <td class="col-doc-status">${statusBadgeHtml}</td>
        <td class="col-doc-action" style="text-align: right;" onclick="event.stopPropagation();">
          <div style="display: inline-flex; align-items: center; gap: 0.35rem; justify-content: flex-end;">
            ${(!isPaid && !isQuote && !isRefunded && !isDraft) ? `
              <button class="btn-row-action btn-action-pay" onclick="KivoApp.markInvoiceAsPaid('${doc.id}')" title="Marquer comme payée" style="color: #059669; border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.08);">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            ` : ''}
            <button class="btn-row-action" onclick="KivoApp.editDocument('${doc.id}')" title="Modifier">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-row-action" onclick="KivoApp.downloadPdf('${doc.id}')" title="Télécharger PDF">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </button>
            <button class="btn-row-action" onclick="KivoApp.toggleDocRowMenu(event, '${doc.id}')" title="Plus d'actions" aria-label="Actions">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  },

  /**
   * Action menu dropdown anchored to the kebab button
   */
  toggleDocRowMenu: function (e, docId) {
    e.stopPropagation();
    const existing = document.getElementById('kivo-doc-action-menu');
    if (existing) {
      const prevId = existing.dataset.docId;
      existing.remove();
      if (prevId === docId) return;
    }

    const doc = (this.state.documents || []).find(d => d.id === docId);
    if (!doc) return;

    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const rawSt = (doc.status || 'draft').toLowerCase().trim();
    const isDocPaid = rawSt === 'paid' || rawSt === 'payée' || rawSt === 'payee';

    const menu = document.createElement('div');
    menu.id = 'kivo-doc-action-menu';
    menu.dataset.docId = docId;
    menu.className = 'doc-action-popup-menu';
    menu.style.position = 'fixed';
    // Clamp so menu never overflows viewport on small mobile screens
    const menuWidth = 200;
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const rawLeft = Math.max(10, rect.right - menuWidth);
    const clampedLeft = Math.min(rawLeft, vw - menuWidth - 8);
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${Math.max(8, clampedLeft)}px`;
    menu.style.zIndex = '9999';

    menu.innerHTML = `
      <div class="action-menu-item" onclick="KivoApp.viewPublicDoc('${doc.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        <span>Aperçu complet</span>
      </div>
      <div class="action-menu-item" onclick="KivoApp.editDocument('${doc.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        <span>Modifier</span>
      </div>
      ${(!isDocPaid && doc.type === 'invoice' && doc.status !== 'refunded') ? `
        <div class="action-menu-item" style="color: #059669; font-weight: 600;" onclick="KivoApp.markInvoiceAsPaid('${doc.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span>Marquer comme payée</span>
        </div>
      ` : ''}
      <div class="action-menu-item" onclick="KivoApp.downloadPdf('${doc.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>Télécharger PDF (A4)</span>
      </div>
      <div class="action-menu-item" onclick="KivoApp.shareOnWhatsApp('${doc.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        <span>Partager WhatsApp</span>
      </div>
      ${isDocPaid ? `
        <div class="action-menu-item" onclick="KivoApp.refundInvoice('${doc.id}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          <span>Marquer remboursée</span>
        </div>
      ` : ''}
      <div class="action-menu-divider"></div>
      <div class="action-menu-item text-danger" onclick="KivoApp.confirmDeleteDocument('${doc.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        <span>Supprimer</span>
      </div>
    `;

    document.body.appendChild(menu);

    const closeMenu = () => {
      menu.remove();
      document.removeEventListener('click', closeHandler);
      window.removeEventListener('scroll', closeHandler, true);
    };

    menu.querySelectorAll('.action-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        setTimeout(closeMenu, 40);
      });
    });

    const closeHandler = (evt) => {
      if (!menu.contains(evt.target) && evt.target !== btn && !btn.contains(evt.target)) {
        closeMenu();
      }
    };
    setTimeout(() => {
      document.addEventListener('click', closeHandler);
      window.addEventListener('scroll', closeHandler, true);
    }, 10);
  },

  /**
   * Renders Master Documents Table
   */
  renderDocumentsTable: function (filter = 'all', searchQuery = '') {
    const tbody = document.getElementById('documents-list-tbody');
    if (!tbody) return;

    let docs = this.state.documents || [];

    if (filter !== 'all') {
      if (filter === 'invoice' || filter === 'quote') {
        docs = docs.filter(d => d.type === filter);
      } else if (filter === 'draft') {
        docs = docs.filter(d => (d.status || '').toLowerCase() === 'draft' || (d.status || '').toLowerCase() === 'brouillon');
      } else if (filter === 'overdue') {
        docs = docs.filter(d => (d.status || '').toLowerCase() === 'overdue');
      } else if (filter === 'paid') {
        docs = docs.filter(d => {
          const s = (d.status || '').toLowerCase().trim();
          return s === 'paid' || s === 'payée' || s === 'payee';
        });
      } else {
        docs = docs.filter(d => (d.status || '').toLowerCase() === filter.toLowerCase());
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
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2.5rem; background: var(--bg-card, #FFF); border-radius: 8px;">Aucun document trouvé.</td></tr>`;
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
    const year = new Date().getFullYear();
    const isQuote = type === 'quote';
    const biz = (this.state && this.state.business) || {};
    const prefix = isQuote 
      ? (biz.quotePrefix || `DEV-${year}-`) 
      : (biz.invoicePrefix || `FAC-${year}-`);

    // Scan all existing documents (both drafts and finalized) to find the maximum existing sequence number
    let maxFound = 0;
    const docs = (this.state && Array.isArray(this.state.documents)) ? this.state.documents : [];
    
    docs.forEach(d => {
      if (!d || d.type !== type || !d.number) return;
      const numStr = String(d.number).trim();
      const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const prefixRegex = new RegExp(`^${escapedPrefix}(\\d+)$`, 'i');
      const match = numStr.match(prefixRegex);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxFound) maxFound = val;
      } else {
        const genericMatch = numStr.match(/(\d+)$/);
        if (genericMatch) {
          const val = parseInt(genericMatch[1], 10);
          if (!isNaN(val) && val > maxFound) maxFound = val;
        }
      }
    });

    const configuredNext = isQuote 
      ? (parseInt(biz.nextQuoteNumber, 10) || 1001) 
      : (parseInt(biz.nextInvoiceNumber, 10) || 1001);

    // Guaranteed strictly unique: strictly greater than the highest allocated number AND >= configuredNext
    const nextSeq = Math.max(maxFound + 1, configuredNext, 1001);
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  },

  /**
   * Starts Document Creation Flow
   * Guard: abort with toast if state or business not loaded yet
   */
  startNewDocument: function (type = 'invoice') {
    this.closeModal('modal-new-doc-choice');

    if (!this.state || !this.state.business) {
      this.showToast(this._t('toast_data_not_loaded'), "error");
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
    // FIX point2: reset and pre-generate stable draft IDs for each new document session.
    // _currentDraftDocId persists the local draft key; _cloudDraftId is the fixed Supabase UUID.
    // Both must be reset here so stale values from a previous session never bleed into a new doc.
    this._currentDraftDocId = null;
    this._cloudDraftId = this.generateUUID(); // generate NOW — same UUID for all subsequent autosaves
    setVal('builder-doc-type', type);
    setVal('builder-doc-number', nextNum);
    setVal('builder-issue-date', today);
    setVal('builder-due-date', dueStr);
    setVal('builder-doc-status', 'sent');
    setVal('builder-notes', '');
    setVal('builder-terms', 'À réception');
    setVal('builder-terms-select', 'À réception');
    const termsCustomInput = document.getElementById('builder-terms');
    if (termsCustomInput) termsCustomInput.style.display = 'none';
    setVal('builder-payment-method', 'Virement bancaire');
    setVal('builder-doc-currency', this.state.business.currency || 'FCFA');
    setVal('builder-visual-template', this.state.business.visualTemplate || 'minimalist');
    const initPrimaryColor = this.state.business.primaryColor || '#4F46E5';
    const initSecondaryColor = this.state.business.secondaryColor || '#7C3AED';
    setVal('builder-color-primary', initPrimaryColor);
    setVal('builder-color-primary-text', initPrimaryColor);
    setVal('builder-color-secondary', initSecondaryColor);
    setVal('builder-color-secondary-text', initSecondaryColor);
    const titleEl = document.getElementById('builder-page-title');
    if (titleEl) titleEl.textContent = (type === 'quote') ? 'Créer un devis' : 'Créer une facture';

    // Enterprise fields from business settings (defaults never modify profile)
    const biz = this.state.business;
    setVal('builder-biz-name', biz.name || '');
    setVal('builder-biz-address', biz.address || '');
    setVal('builder-biz-phone', biz.phone || '');
    setVal('builder-biz-email', biz.email || '');
    setVal('builder-biz-legal', biz.legal || '');

    // Reset document header and custom fields
    setVal('builder-doc-title-text', '');
    setVal('builder-doc-subject', '');
    const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
    setChk('builder-toggle-subject', true);
    setChk('builder-toggle-logo', true);

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
    setVal('builder-client-name', '');
    setVal('builder-client-email', '');
    setVal('builder-client-address', '');
    setVal('builder-client-phone', '');
    setVal('builder-client-taxid', '');

    // Reset column and totals labels to default values
    setVal('builder-col-desc', 'Description');
    setVal('builder-col-qty', 'Quantité');
    setVal('builder-col-unit', 'Unité');
    setVal('builder-col-price', 'Prix Unitaire');
    setVal('builder-col-tax', 'TVA');
    setVal('builder-col-discount', 'Remise');
    setVal('builder-col-total', 'Total HT');
    setVal('builder-lbl-subtotal', 'Sous-total HT');
    setVal('builder-lbl-tax', 'TVA');
    setVal('builder-lbl-total', 'Total TTC');
    setVal('builder-lbl-deposit', 'Acompte déjà versé');
    setVal('builder-lbl-balance', 'Solde net à payer');

    // Reset invoice logo state for new document session
    this._invoiceLogoRemoved = false;
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

    // Totals options & toggles
    const defaultVat = this.state.business?.defaultVatRate !== undefined ? this.state.business.defaultVatRate : (this.state.business?.taxRate !== undefined ? this.state.business.taxRate : 0);
    setChk('builder-toggle-vat', defaultVat > 0);
    setChk('builder-toggle-discount', false);
    setVal('builder-discount-value', '0');
    setVal('builder-discount-type', 'percent');
    setChk('builder-toggle-deposit', false);
    setVal('builder-deposit-amount', '0');
    this.onBuilderDiscountToggle();
    this.onBuilderDepositToggle();

    // Footer options & toggles
    setChk('builder-toggle-payment-methods', true);
    setVal('builder-payment-details', biz.paymentDetails || '');
    setChk('builder-toggle-notes', true);
    setChk('builder-toggle-thankyou', true);
    setVal('builder-thankyou', biz.thankYouText || 'Merci pour votre confiance !');
    setChk('builder-toggle-legal', true);
    setVal('builder-legal-notices', biz.legalNotices || biz.legal || '');

    // Reset lock state (Draft is always unlocked)
    this.setBuilderLockState(false);

    // Items - Clean state: 1 blank row ready for input
    const tbody = document.getElementById('builder-items-tbody');
    if (tbody) tbody.innerHTML = '';
    this.addBuilderLineItem('', 1, 0, defaultVat, '', 0);
    this.populateBuilderCatalogDropdown();

    this.recalculateBuilderTotals();
    this.updateLiveInvoicePreview();
    this.navigate('document-builder');
    this.checkForBuilderDraft(false);
  },

  /**
   * Loads an existing document into the editor for modifying
   */
  editDocument: function (docId) {
    const doc = this.state.documents.find(d => d.id === docId);
    if (!doc) return;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val !== undefined && val !== null ? val : ''; };
    const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
    const titleEl = document.getElementById('builder-page-title');
    if (titleEl) titleEl.textContent = (doc.type === 'quote') ? 'Modifier le devis' : 'Modifier la facture';
    setVal('builder-doc-id', doc.id);
    this._cloudDraftId = doc.id;
    this._currentDraftDocId = doc.id;
    setVal('builder-doc-type', doc.type || 'invoice');
    setVal('builder-doc-number', doc.number);
    setVal('builder-doc-currency', doc.currency || this.state.business.currency || 'FCFA');
    setVal('builder-issue-date', doc.issueDate || new Date().toISOString().split('T')[0]);
    setVal('builder-due-date', doc.dueDate || new Date().toISOString().split('T')[0]);
    const rawDocStatus = (doc.status || 'sent').toLowerCase().trim();
    const normalizedStatus = (rawDocStatus === 'payée' || rawDocStatus === 'payee') ? 'paid' : (doc.status || 'sent');
    setVal('builder-doc-status', normalizedStatus);

    // Point B: Locking rule — Draft is editable, Sent/Paid/Overdue is locked with reopen banner
    const isDraft = (normalizedStatus === 'draft' || normalizedStatus === 'brouillon');
    this.setBuilderLockState(!isDraft, normalizedStatus);

    const meta = (doc.items && typeof doc.items === 'object' && !Array.isArray(doc.items)) ? doc.items : {};

    // Header & Subject
    setVal('builder-doc-title-text', doc.docTitleText || meta.docTitleText || '');
    setVal('builder-doc-subject', doc.subject || meta.subject || '');
    setChk('builder-toggle-subject', doc.showSubject !== undefined ? !!doc.showSubject : (meta.showSubject !== undefined ? !!meta.showSubject : true));
    setChk('builder-toggle-logo', doc.showLogo !== undefined ? !!doc.showLogo : (meta.showLogo !== undefined ? !!meta.showLogo : true));

    // Enterprise fields (default from doc/meta, never alters profile)
    const biz = this.state.business;
    setVal('builder-biz-name', doc.issuerName || meta.issuerName || doc.bizName || biz.name || '');
    setVal('builder-biz-address', doc.issuerAddress || meta.issuerAddress || biz.address || '');
    setVal('builder-biz-phone', doc.issuerPhone || meta.issuerPhone || biz.phone || '');
    setVal('builder-biz-email', doc.issuerEmail || meta.issuerEmail || biz.email || '');
    setVal('builder-biz-legal', doc.issuerLegal || meta.issuerLegal || biz.legal || '');

    // Client select & fields
    const clientSelect = document.getElementById('builder-doc-client-select');
    if (clientSelect) {
      clientSelect.innerHTML = `<option value="">-- Sélectionner un client --</option>` + (this.state.clients || []).map(c => `
        <option value="${c.id}" ${String(c.id) === String(doc.clientId) ? 'selected' : ''}>${c.name} (${c.company || c.contactName || 'Particulier'})</option>
      `).join('');
      if (doc.clientId) clientSelect.value = doc.clientId;
    }

    setVal('builder-client-name', doc.clientName || '');
    setVal('builder-client-email', doc.clientEmail || '');
    setVal('builder-client-address', doc.clientAddress || meta.clientAddress || '');
    setVal('builder-client-phone', doc.clientPhone || '');
    setVal('builder-client-taxid', doc.clientTaxId || meta.clientTaxId || (doc.client && doc.client.taxId) || '');

    // Column labels
    const colLabels = doc.columnLabels || meta.columnLabels || {};
    setVal('builder-col-desc', colLabels.desc || 'Description');
    setVal('builder-col-qty', colLabels.qty || 'Quantité');
    setVal('builder-col-unit', colLabels.unit || 'Unité');
    setVal('builder-col-price', colLabels.price || 'Prix Unitaire');
    setVal('builder-col-tax', colLabels.tax || 'TVA');
    setVal('builder-col-discount', colLabels.discount || 'Remise');
    setVal('builder-col-total', colLabels.total || 'Total HT');

    // Totals labels
    const totLabels = doc.labels || meta.labels || {};
    setVal('builder-lbl-subtotal', totLabels.subtotal || 'Sous-total HT');
    setVal('builder-lbl-tax', totLabels.tax || 'TVA');
    setVal('builder-lbl-total', totLabels.total || 'Total TTC');
    setVal('builder-lbl-deposit', totLabels.deposit || 'Acompte déjà versé');
    setVal('builder-lbl-balance', totLabels.balance || 'Solde net à payer');

    // Totals & options
    const hasVat = doc.showVat !== undefined ? !!doc.showVat : (meta.showVat !== undefined ? !!meta.showVat : ((Number(doc.tax) || Number(doc.tax_amount) || Number(doc.taxRate)) > 0));
    setChk('builder-toggle-vat', hasVat);

    const hasDiscount = doc.showDiscount !== undefined ? !!doc.showDiscount : (meta.showDiscount !== undefined ? !!meta.showDiscount : ((Number(doc.discount) || 0) > 0));
    setChk('builder-toggle-discount', hasDiscount);
    setVal('builder-discount-value', doc.discountVal !== undefined ? doc.discountVal : (meta.discountVal !== undefined ? meta.discountVal : (doc.discount || 0)));
    setVal('builder-discount-type', doc.discountType || meta.discountType || 'percent');
    this.onBuilderDiscountToggle();

    const hasDeposit = doc.showDeposit !== undefined ? !!doc.showDeposit : (meta.showDeposit !== undefined ? !!meta.showDeposit : ((Number(doc.depositAmount) || Number(meta.depositAmount) || 0) > 0));
    setChk('builder-toggle-deposit', hasDeposit);
    setVal('builder-deposit-amount', doc.depositAmount !== undefined ? doc.depositAmount : (meta.depositAmount !== undefined ? meta.depositAmount : 0));
    this.onBuilderDepositToggle();

    // Payment terms & details
    const knownTerms = ['À réception', 'Net 7 jours', 'Net 15 jours', 'Net 30 jours', 'Net 45 jours', 'Net 60 jours'];
    const docTerms = doc.terms || doc.conditions || meta.terms || 'À réception';
    const termsSelectEl = document.getElementById('builder-terms-select');
    const termsInputEl = document.getElementById('builder-terms');
    if (termsSelectEl) {
      if (knownTerms.includes(docTerms)) {
        termsSelectEl.value = docTerms;
        if (termsInputEl) { termsInputEl.value = docTerms; termsInputEl.style.display = 'none'; }
      } else {
        termsSelectEl.value = 'custom';
        if (termsInputEl) { termsInputEl.value = docTerms; termsInputEl.style.display = 'block'; }
      }
    } else {
      setVal('builder-terms', docTerms);
    }

    setVal('builder-payment-method', doc.paymentMethod || meta.paymentMethod || 'Virement bancaire');
    setChk('builder-toggle-payment-methods', doc.showPaymentMethods !== undefined ? !!doc.showPaymentMethods : (meta.showPaymentMethods !== undefined ? !!meta.showPaymentMethods : true));
    setVal('builder-payment-details', doc.paymentDetails || meta.paymentDetails || '');

    setVal('builder-notes', doc.notes || meta.notes || '');
    setChk('builder-toggle-notes', doc.showNotes !== undefined ? !!doc.showNotes : (meta.showNotes !== undefined ? !!meta.showNotes : true));

    setChk('builder-toggle-thankyou', doc.showThankYou !== undefined ? !!doc.showThankYou : (meta.showThankYou !== undefined ? !!meta.showThankYou : true));
    setVal('builder-thankyou', doc.thankYouText || meta.thankYouText || 'Merci pour votre confiance !');

    setChk('builder-toggle-legal', doc.showLegalNotices !== undefined ? !!doc.showLegalNotices : (meta.showLegalNotices !== undefined ? !!meta.showLegalNotices : true));
    setVal('builder-legal-notices', doc.legalNoticesText || meta.legalNoticesText || doc.legalNotices || meta.legalNotices || (this.state.business?.legal || ''));

    // Logo restoration
    const restoredLogoUrl = doc.logoUrl !== undefined ? doc.logoUrl : (meta.logoUrl !== undefined ? meta.logoUrl : biz.logoUrl);
    if (restoredLogoUrl === null) {
      this.builderCustomLogoUrl = null;
      this._invoiceLogoRemoved = true;
    } else if (restoredLogoUrl) {
      this.builderCustomLogoUrl = restoredLogoUrl;
      this._invoiceLogoRemoved = false;
    } else {
      this.builderCustomLogoUrl = biz.logoUrl || null;
      this._invoiceLogoRemoved = !biz.logoUrl;
    }
    const logoImg = document.getElementById('builder-logo-preview-img');
    const previewBox = document.getElementById('builder-logo-preview-box');
    const uploadPrompt = document.getElementById('builder-logo-upload-prompt');
    if (this.builderCustomLogoUrl && !this._invoiceLogoRemoved) {
      if (logoImg) { logoImg.src = this.builderCustomLogoUrl; logoImg.style.display = 'block'; }
      if (previewBox) previewBox.style.display = 'flex';
      if (uploadPrompt) uploadPrompt.style.display = 'none';
    } else {
      if (logoImg) { logoImg.src = ''; logoImg.style.display = 'none'; }
      if (previewBox) previewBox.style.display = 'none';
      if (uploadPrompt) uploadPrompt.style.display = 'block';
    }

    // Colors & Template
    const templateVal = doc.templateId || doc.visualTemplate || meta.templateId || biz.visualTemplate || 'minimalist';
    setVal('builder-visual-template', templateVal);
    const primColor = doc.primaryColor || meta.primaryColor || biz.primaryColor || '#4F46E5';
    const secColor = doc.secondaryColor || meta.secondaryColor || biz.secondaryColor || '#7C3AED';
    setVal('builder-color-primary', primColor);
    setVal('builder-color-primary-text', primColor);
    setVal('builder-color-secondary', secColor);
    setVal('builder-color-secondary-text', secColor);

    // Items table rows
    const tbody = document.getElementById('builder-items-tbody');
    if (tbody) tbody.innerHTML = '';

    let lines = [];
    if (Array.isArray(doc.items)) {
      lines = doc.items;
    } else if (doc.items && Array.isArray(doc.items.lines)) {
      lines = doc.items.lines;
    }
    if (lines.length > 0) {
      lines.forEach(it => {
        this.addBuilderLineItem(it.name, it.quantity, it.price, it.taxRate !== undefined ? it.taxRate : 0, it.unit || '', it.discount || 0);
      });
    } else {
      this.addBuilderLineItem('', 1, 0, 0, '', 0);
    }

    this.populateBuilderCatalogDropdown();
    this.recalculateBuilderTotals();
    this.updateLiveInvoicePreview();
    this.navigate('document-builder');
    this.checkForBuilderDraft(true);
  },

  /**
   * Adds a line item row in builder with multiline designation, unit, discount %, and row reordering
   */
  addBuilderLineItem: function (name = '', qty = 1, price = '', tax = 0, unit = '', discount = 0) {
    const tbody = document.getElementById('builder-items-tbody');
    if (!tbody) return;

    const rowId = 'row_' + Math.random().toString(36).substring(2, 7);
    const tr = document.createElement('tr');
    tr.id = rowId;

    const lockedClass = this._isBuilderLocked ? ' builder-input-locked' : '';
    const lockedDisabled = this._isBuilderLocked ? ' disabled' : '';

    tr.innerHTML = `
      <td style="padding-bottom: 0.5rem; padding-right: 0.5rem;">
        <textarea class="form-input item-name${lockedClass}" rows="1" placeholder="Désignation du service ou produit (supporte plusieurs lignes)" oninput="KivoApp.updateLiveInvoicePreview()" style="width: 100%; padding: 0.55rem; border-radius: 6px; border: 1px solid #CBD5E1; font-size: 0.85rem; outline: none; font-family: 'Inter', sans-serif; resize: vertical; box-sizing: border-box;"${lockedDisabled}>${name}</textarea>
      </td>
      <td style="padding-bottom: 0.5rem; padding-right: 0.5rem; width: 9%;">
        <input type="number" class="form-input item-qty${lockedClass}" value="${qty}" min="0.01" step="any" oninput="KivoApp.recalculateBuilderTotals()" style="width: 100%; padding: 0.55rem; border-radius: 6px; border: 1px solid #CBD5E1; font-size: 0.85rem; outline: none; font-family: 'Inter', sans-serif; text-align: center; box-sizing: border-box;"${lockedDisabled}>
      </td>
      <td style="padding-bottom: 0.5rem; padding-right: 0.5rem; width: 9%;">
        <input type="text" class="form-input item-unit${lockedClass}" value="${unit || ''}" placeholder="j, h, u..." oninput="KivoApp.updateLiveInvoicePreview()" style="width: 100%; padding: 0.55rem; border-radius: 6px; border: 1px solid #CBD5E1; font-size: 0.85rem; outline: none; font-family: 'Inter', sans-serif; text-align: center; box-sizing: border-box;"${lockedDisabled}>
      </td>
      <td style="padding-bottom: 0.5rem; padding-right: 0.5rem; width: 16%;">
        <input type="number" class="form-input item-price${lockedClass}" value="${price}" min="0" step="any" oninput="KivoApp.recalculateBuilderTotals()" style="width: 100%; padding: 0.55rem; border-radius: 6px; border: 1px solid #CBD5E1; font-size: 0.85rem; outline: none; font-family: 'Inter', sans-serif; text-align: right; box-sizing: border-box;"${lockedDisabled}>
      </td>
      <td style="padding-bottom: 0.5rem; padding-right: 0.5rem; width: 9%;">
        <select class="form-select item-tax${lockedClass}" onchange="KivoApp.recalculateBuilderTotals()" style="width: 100%; padding: 0.55rem; border-radius: 6px; border: 1px solid #CBD5E1; font-size: 0.85rem; outline: none; font-family: 'Inter', sans-serif; box-sizing: border-box;"${lockedDisabled}>
          <option value="0" ${tax == 0 ? 'selected' : ''}>0%</option>
          <option value="18" ${tax == 18 ? 'selected' : ''}>18%</option>
          <option value="20" ${tax == 20 ? 'selected' : ''}>20%</option>
          <option value="10" ${tax == 10 ? 'selected' : ''}>10%</option>
          <option value="5" ${tax == 5 ? 'selected' : ''}>5%</option>
        </select>
      </td>
      <td style="padding-bottom: 0.5rem; padding-right: 0.5rem; width: 9%;">
        <input type="number" class="form-input item-discount${lockedClass}" value="${discount || 0}" min="0" max="100" placeholder="0%" oninput="KivoApp.recalculateBuilderTotals()" style="width: 100%; padding: 0.55rem; border-radius: 6px; border: 1px solid #CBD5E1; font-size: 0.85rem; outline: none; font-family: 'Inter', sans-serif; text-align: center; box-sizing: border-box;"${lockedDisabled}>
      </td>
      <td style="text-align: right; vertical-align: middle; padding-bottom: 0.5rem; width: 14%;">
        <strong class="item-total-display" style="font-size: 0.85rem; color: #0F172A;">0 FCFA</strong>
      </td>
      <td style="text-align: center; vertical-align: middle; padding-bottom: 0.5rem; width: 10%;">
        <div style="display: inline-flex; align-items: center; gap: 2px;">
          <button type="button" class="btn-line-action" onclick="KivoApp.moveBuilderLineItem(this, -1)" title="Monter la ligne"${lockedDisabled}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button type="button" class="btn-line-action" onclick="KivoApp.moveBuilderLineItem(this, 1)" title="Descendre la ligne"${lockedDisabled}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <button type="button" class="btn-line-action btn-line-delete" onclick="KivoApp.removeBuilderLineItem(this)" title="Supprimer la ligne"${lockedDisabled}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
    this.recalculateBuilderTotals();
    this.updateLiveInvoicePreview();
  },

  /**
   * Reorders a line item up or down
   */
  moveBuilderLineItem: function (btn, direction) {
    if (this._isBuilderLocked) return;
    const tr = btn.closest('tr');
    if (!tr) return;
    if (direction === -1 && tr.previousElementSibling) {
      tr.parentNode.insertBefore(tr, tr.previousElementSibling);
    } else if (direction === 1 && tr.nextElementSibling) {
      tr.parentNode.insertBefore(tr.nextElementSibling, tr);
    }
    this.recalculateBuilderTotals();
  },

  /**
   * Deletes a line item row
   */
  removeBuilderLineItem: function (btn) {
    if (this._isBuilderLocked) return;
    const tr = btn.closest('tr');
    if (tr) {
      tr.remove();
      this.recalculateBuilderTotals();
    }
  },

  /**
   * Toggles custom column and totals labels panel
   */
  toggleColumnLabelsCustomizer: function () {
    const p = document.getElementById('builder-column-labels-panel');
    if (p) p.style.display = (p.style.display === 'none' || !p.style.display) ? 'block' : 'none';
  },

  /**
   * Resets all custom column and totals labels to system defaults
   */
  resetBuilderLabels: function () {
    const setV = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setV('builder-col-desc', 'Description');
    setV('builder-col-qty', 'Quantité');
    setV('builder-col-unit', 'Unité');
    setV('builder-col-price', 'Prix Unitaire');
    setV('builder-col-tax', 'TVA');
    setV('builder-col-discount', 'Remise');
    setV('builder-col-total', 'Total HT');
    setV('builder-lbl-subtotal', 'Sous-total HT');
    setV('builder-lbl-tax', 'TVA');
    setV('builder-lbl-total', 'Total TTC');
    setV('builder-lbl-deposit', 'Acompte déjà versé');
    setV('builder-lbl-balance', 'Solde net à payer');
    this.updateLiveInvoicePreview();
    this.showToast('Libellés réinitialisés par défaut', 'info');
  },

  /**
   * Controls builder lock state (read-only for Sent/Paid/Overdue, editable for Draft)
   */
  setBuilderLockState: function (locked, status = 'sent') {
    this._isBuilderLocked = !!locked;
    const banner = document.getElementById('builder-locked-banner');
    const statusTextEl = document.getElementById('builder-locked-status-text');
    if (banner) {
      banner.style.display = locked ? 'flex' : 'none';
      if (statusTextEl) {
        const readableStatus = (status === 'paid' || status === 'payée') ? 'Payé' : (status === 'overdue' ? 'En retard' : 'Envoyé');
        statusTextEl.textContent = `Ce document est ${readableStatus}. Les modifications directes sont verrouillées pour préserver l'historique comptable.`;
      }
    }
    const formPanel = document.querySelector('.builder-form-panel') || document.querySelector('.builder-editor-scroll') || document.getElementById('view-document-builder');
    if (formPanel) {
      const inputs = formPanel.querySelectorAll('input:not(#builder-unlock-btn), select, textarea, button:not(#builder-unlock-btn):not(.btn-back-dashboard):not(#btn-save-builder-doc)');
      inputs.forEach(el => {
        if (el.id === 'builder-unlock-btn') return;
        el.disabled = locked;
        if (locked) {
          el.classList.add('builder-input-locked');
        } else {
          el.classList.remove('builder-input-locked');
        }
      });
    }
    const saveBtn = document.getElementById('btn-save-builder-doc');
    if (saveBtn) {
      saveBtn.disabled = locked;
      saveBtn.style.opacity = locked ? '0.5' : '1';
      saveBtn.style.cursor = locked ? 'not-allowed' : 'pointer';
    }
  },

  /**
   * Reopens document in draft mode and unlocks all fields while keeping the exact document number
   */
  unlockCurrentBuilderDoc: function () {
    const statusSelect = document.getElementById('builder-doc-status');
    if (statusSelect) statusSelect.value = 'draft';
    this.setBuilderLockState(false);
    this.showToast('Document rouvert en mode Brouillon. Vous pouvez le modifier.', 'info');
    this.recalculateBuilderTotals();
  },

  /**
   * Handles toggle discount visibility
   */
  onBuilderDiscountToggle: function () {
    const chk = document.getElementById('builder-toggle-discount');
    const row = document.getElementById('builder-discount-inputs-row');
    if (row && chk) {
      row.style.display = chk.checked ? 'flex' : 'none';
    }
    this.recalculateBuilderTotals();
  },

  /**
   * Handles toggle deposit visibility
   */
  onBuilderDepositToggle: function () {
    const chk = document.getElementById('builder-toggle-deposit');
    const row = document.getElementById('builder-deposit-inputs-row');
    if (row && chk) {
      row.style.display = chk.checked ? 'flex' : 'none';
    }
    this.recalculateBuilderTotals();
  },

  /**
   * Recalculates Subtotal HT, line discounts, global discount, VAT amount, deposit, and Total TTC in builder
   */
  recalculateBuilderTotals: function () {
    let subtotal = 0;
    let totalTaxAmount = 0;
    const currency = document.getElementById('builder-doc-currency') ? document.getElementById('builder-doc-currency').value : (this.state.business.currency || 'FCFA');
    const showVat = document.getElementById('builder-toggle-vat') ? document.getElementById('builder-toggle-vat').checked : true;

    document.querySelectorAll('#builder-items-tbody tr').forEach(tr => {
      const qty = parseFloat(tr.querySelector('.item-qty')?.value) || 0;
      const price = parseFloat(tr.querySelector('.item-price')?.value) || 0;
      const taxRate = showVat ? (parseFloat(tr.querySelector('.item-tax')?.value) || 0) : 0;
      const rowDiscount = parseFloat(tr.querySelector('.item-discount')?.value) || 0;
      
      let rowTotalHT = qty * price;
      if (rowDiscount > 0) {
        rowTotalHT = Math.max(0, rowTotalHT - (rowTotalHT * (rowDiscount / 100)));
      }
      const rowTaxAmount = showVat ? rowTotalHT * (taxRate / 100) : 0;
      
      const totDisp = tr.querySelector('.item-total-display');
      if (totDisp) totDisp.textContent = rowTotalHT.toLocaleString('fr-FR') + ' ' + currency;
      
      subtotal += rowTotalHT;
      totalTaxAmount += rowTaxAmount;
    });

    // Global discount
    const chkDiscount = document.getElementById('builder-toggle-discount');
    const showDiscount = chkDiscount ? chkDiscount.checked : false;
    const discountVal = parseFloat(document.getElementById('builder-discount-value')?.value) || 0;
    const discountType = document.getElementById('builder-discount-type')?.value || 'amount';
    let globalDiscount = 0;
    if (showDiscount && discountVal > 0) {
      if (discountType === 'percent') {
        globalDiscount = subtotal * (discountVal / 100);
      } else {
        globalDiscount = discountVal;
      }
      globalDiscount = Math.min(globalDiscount, subtotal);
    }

    const taxableAmount = Math.max(0, subtotal - globalDiscount);
    const grandTotal = Math.max(0, taxableAmount + (showVat ? totalTaxAmount : 0));

    // Deposit
    const chkDeposit = document.getElementById('builder-toggle-deposit');
    const showDeposit = chkDeposit ? chkDeposit.checked : false;
    const depositAmt = showDeposit ? (parseFloat(document.getElementById('builder-deposit-amount')?.value) || 0) : 0;
    const balanceDue = Math.max(0, grandTotal - depositAmt);

    // Update UI elements
    const subtotalEl = document.getElementById('builder-calc-subtotal');
    if (subtotalEl) subtotalEl.textContent = subtotal.toLocaleString('fr-FR') + ' ' + currency;

    const discRow = document.getElementById('builder-calc-discount-row');
    const discAmtEl = document.getElementById('builder-calc-discount-amount');
    if (discRow && discAmtEl) {
      if (showDiscount && globalDiscount > 0) {
        discRow.style.display = 'flex';
        discAmtEl.textContent = '-' + globalDiscount.toLocaleString('fr-FR') + ' ' + currency;
      } else {
        discRow.style.display = 'none';
      }
    }

    const taxRow = document.getElementById('builder-calc-tax-row');
    const taxAmtEl = document.getElementById('builder-calc-tax-amount');
    if (taxRow && taxAmtEl) {
      taxRow.style.display = showVat ? 'flex' : 'none';
      taxAmtEl.textContent = totalTaxAmount.toLocaleString('fr-FR') + ' ' + currency;
    }

    const totalEl = document.getElementById('builder-calc-total');
    if (totalEl) totalEl.textContent = grandTotal.toLocaleString('fr-FR') + ' ' + currency;

    const depRow = document.getElementById('builder-calc-deposit-row');
    const depEl = document.getElementById('builder-calc-deposit-display');
    if (depRow && depEl) {
      if (showDeposit && depositAmt > 0) {
        depRow.style.display = 'flex';
        depEl.textContent = '-' + depositAmt.toLocaleString('fr-FR') + ' ' + currency;
      } else {
        depRow.style.display = 'none';
      }
    }

    const balRow = document.getElementById('builder-calc-balance-row');
    const balEl = document.getElementById('builder-calc-balance-display');
    if (balRow && balEl) {
      if (showDeposit && depositAmt > 0) {
        balRow.style.display = 'flex';
        balEl.textContent = balanceDue.toLocaleString('fr-FR') + ' ' + currency;
      } else {
        balRow.style.display = 'none';
      }
    }

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
          // Compute scale for true A4 miniature ratio (1 : 1.4142) on mobile & desktop
          const containerW = previewContainer.clientWidth || previewContainer.offsetWidth || (previewContainer.parentElement ? previewContainer.parentElement.clientWidth : 0) || window.innerWidth;
          const scale = containerW >= 794 ? 1 : Math.max(0.2, containerW / 794);
          previewContainer.style.setProperty('--paper-scale', scale.toFixed(4));
          previewContainer.style.height = Math.round((794 * 1.4142) * scale) + 'px';
        }
        const pubArea = document.getElementById('public-doc-printable-area');
        if (pubArea) {
          pubArea.innerHTML = renderedHtml;
          pubArea.style.padding = '0';
          pubArea.style.overflow = 'hidden';
          pubArea.style.background = (templateId === 'premium') ? '#181A20' : '#FFFFFF';
        }
        this.triggerBuilderAutoSave();
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
    if (bizNameEl) bizNameEl.textContent = bizName || this.getBusinessName();

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
    if (termsEl) termsEl.textContent = terms || "À réception";
    
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

    this.triggerBuilderAutoSave();
  },

  /**
   * Share live document from builder on WhatsApp
   */
  shareCurrentBuilderWhatsApp: function () {
    const existingDocId = document.getElementById('builder-doc-id')?.value;
    const docType = document.getElementById('builder-doc-type')?.value || 'invoice';
    const isQuote = docType === 'quote';
    const warnMsg = isQuote
      ? this._t('toast_doc_cannot_share_draft_quote')
      : this._t('toast_doc_cannot_share_draft');

    // 1. If not saved yet
    if (!existingDocId) {
      this.showToast(warnMsg, "warning");
      return;
    }

    // 2. Check current builder form items & total
    let hasValidItems = false;
    document.querySelectorAll('#builder-items-tbody tr').forEach(tr => {
      const name = (tr.querySelector('.item-name')?.value || '').trim();
      const qty = parseFloat(tr.querySelector('.item-qty')?.value) || 0;
      const price = parseFloat(tr.querySelector('.item-price')?.value) || 0;
      if (name && qty > 0 && price > 0) hasValidItems = true;
    });

    const calcTotalEl = document.getElementById('builder-calc-total');
    const totalVal = calcTotalEl ? parseFloat(calcTotalEl.textContent.replace(/[^0-9.-]/g, '')) || 0 : 0;
    const statusVal = document.getElementById('builder-doc-status')?.value || 'draft';

    if (!hasValidItems || totalVal <= 0 || statusVal === 'draft' || statusVal === 'brouillon') {
      this.showToast(warnMsg, "warning");
      return;
    }

    // 3. Check corresponding saved document in state
    const savedDoc = (this.state.documents || []).find(d => String(d.id) === String(existingDocId));
    if (!savedDoc) {
      this.showToast(warnMsg, "warning");
      return;
    }

    const isDocDraft = savedDoc.status === 'draft' || savedDoc.status === 'brouillon';
    const docHasNoItems = !Array.isArray(savedDoc.items) || savedDoc.items.length === 0;
    const docHasZeroTotal = !savedDoc.total || parseFloat(savedDoc.total) <= 0;

    if (isDocDraft || docHasNoItems || docHasZeroTotal) {
      this.showToast(warnMsg, "warning");
      return;
    }

    // 4. Delegate to unified shareOnWhatsApp
    this.shareOnWhatsApp(existingDocId);
  },

  // ─────────────────────────────────────────────────────────────
  // AUTO-SAVE DRAFT SYSTEM (Debounce 6s, reprise et suppression)
  // ─────────────────────────────────────────────────────────────

  _draftTimer: null,
  _isDraftFinalizing: false,
  _currentDraftDocId: null,

  getDraftStorageKey: function () {
    const userId = (window.KivoAuth && window.KivoAuth.user && window.KivoAuth.user.id) || 'guest';
    return `kivo_builder_draft_${userId}`;
  },

  triggerBuilderAutoSave: function () {
    if (this.activeView !== 'document-builder' || this._isDraftFinalizing) return;

    // Critère : un client sélectionné/saisi OU au moins un article avec désignation
    const clientSelect = document.getElementById('builder-doc-client-select');
    const clientId = clientSelect ? clientSelect.value : '';
    const customClientName = (document.getElementById('builder-client-name')?.value || '').trim();

    let hasNamedItem = false;
    document.querySelectorAll('#builder-items-tbody tr').forEach(tr => {
      const name = (tr.querySelector('.item-name')?.value || '').trim();
      if (name) hasNamedItem = true;
    });

    const isEligible = Boolean(clientId || customClientName || hasNamedItem);
    const indicator = document.getElementById('builder-draft-indicator');
    const dot = document.getElementById('builder-draft-dot');
    const text = document.getElementById('builder-draft-text');

    if (!isEligible) {
      if (indicator) indicator.style.display = 'none';
      return;
    }

    if (indicator) {
      indicator.style.display = 'inline-flex';
      if (dot) dot.style.background = '#F59E0B'; // Ambre : modifications en cours
      if (text) text.textContent = 'Enregistrement automatique...';
    }

    if (this._draftTimer) clearTimeout(this._draftTimer);
    this._draftTimer = setTimeout(() => {
      this.executeBuilderDraftSave();
    }, 6000); // 6 secondes de debounce (conforme : 5-10s)
  },

  executeBuilderDraftSave: async function (isSync = false) {
    if (this.activeView !== 'document-builder' || this._isDraftFinalizing) return;

    const getVal = id => (document.getElementById(id) ? document.getElementById(id).value : '');
    const docId = getVal('builder-doc-id') || this._currentDraftDocId || ('draft_' + Date.now());
    this._currentDraftDocId = docId;

    const clientId = getVal('builder-doc-client-select');
    const clientObj = this.state.clients.find(c => c.id === clientId) || {
      id: clientId || 'cli_anon',
      name: getVal('builder-client-name') || 'Client sans nom',
      email: getVal('builder-client-email') || '',
      phone: getVal('builder-client-phone') || '',
      address: getVal('builder-client-address') || ''
    };

    const items = [];
    let subtotal = 0;
    let totalTaxAmount = 0;
    document.querySelectorAll('#builder-items-tbody tr').forEach(tr => {
      const name = (tr.querySelector('.item-name')?.value || '').trim();
      const qty = parseFloat(tr.querySelector('.item-qty')?.value) || 1;
      const price = parseFloat(tr.querySelector('.item-price')?.value) || 0;
      const taxRate = parseFloat(tr.querySelector('.item-tax')?.value !== undefined ? tr.querySelector('.item-tax').value : 0) || 0;
      const totalHT = qty * price;
      const taxAmount = totalHT * (taxRate / 100);
      items.push({ name, quantity: qty, price, taxRate, total: totalHT + taxAmount, totalHT });
      if (name) {
        subtotal += totalHT;
        totalTaxAmount += taxAmount;
      }
    });

    const rawSelectedStatus = (getVal('builder-doc-status') || '').toLowerCase().trim();
    const existingDoc = (this.state.documents || []).find(d => d && d.id === docId);
    let resolvedStatus = rawSelectedStatus || (existingDoc ? existingDoc.status : 'draft');
    if (resolvedStatus === 'payée' || resolvedStatus === 'payee') resolvedStatus = 'paid';
    if (!resolvedStatus) resolvedStatus = 'draft';

    const grandDraftTotal = Math.max(0, subtotal + totalTaxAmount);
    const resolvedAmountPaid = (resolvedStatus === 'paid') ? grandDraftTotal : ((existingDoc && existingDoc.amountPaid) || 0);

    const draftData = {
      id: docId,
      number: getVal('builder-doc-number') || 'BROUILLON',
      type: getVal('builder-doc-type') || 'invoice',
      status: resolvedStatus,
      currency: getVal('builder-doc-currency') || 'FCFA',
      visualTemplate: getVal('builder-visual-template') || 'minimalist',
      clientId: clientId,
      clientName: clientObj.name,
      clientEmail: clientObj.email,
      clientPhone: clientObj.phone,
      clientAddress: clientObj.address,
      issueDate: getVal('builder-issue-date') || '',
      dueDate: getVal('builder-due-date') || '',
      items: items,
      subtotal: subtotal,
      tax: totalTaxAmount,
      total: grandDraftTotal,
      amountPaid: resolvedAmountPaid,
      notes: getVal('builder-notes') || '',
      terms: getVal('builder-terms') || 'À réception',
      paymentMethod: getVal('builder-payment-method') || 'Virement bancaire',
      savedAt: new Date().toISOString()
    };

    // 1. Sauvegarde locale persistante
    try {
      localStorage.setItem(this.getDraftStorageKey(), JSON.stringify(draftData));
    } catch (e) {
      console.warn('[KivoApp] Failed to save local draft:', e);
    }

    // 2. Sauvegarde Supabase en arrière-plan en préservant le vrai statut si connecté
    if (window.KivoDb && this.supabaseConnected && window.KivoAuth?.user) {
      try {
        // FIX point2: _cloudDraftId is pre-generated in startNewDocument for new docs.
        // For existing docs (docId is a real UUID), we use docId directly (upsert updates it).
        // We never generate a new UUID lazily here to prevent duplicate rows.
        if (!this._cloudDraftId) {
          this._cloudDraftId = (docId && !docId.startsWith('draft_')) ? docId : this.generateUUID();
        }
        const cloudDocId = this._cloudDraftId;
        draftData.cloudId = cloudDocId;
        const cloudPayload = {
          id: cloudDocId,
          number: draftData.number,
          type: draftData.type,
          status: resolvedStatus,
          currency: draftData.currency,
          client_id: clientId && clientId !== 'cli_anon' ? clientId : null,
          client_name: draftData.clientName,
          client_email: draftData.clientEmail,
          client_phone: draftData.clientPhone,
          issueDate: draftData.issueDate,
          dueDate: draftData.dueDate,
          items: draftData.items,
          subtotal: draftData.subtotal,
          taxRate: 0,
          taxAmount: draftData.tax,
          total: draftData.total,
          amountPaid: resolvedAmountPaid,
          notes: draftData.notes,
          conditions: draftData.terms
        };
        window.KivoDb.saveDocument(cloudPayload).catch(e => console.warn('[KivoApp] Cloud draft push warning:', e));
      } catch (e) {
        console.warn('[KivoApp] Supabase draft auto-save error:', e);
      }
    }

    // 3. Indicateur visuel temps réel
    const indicator = document.getElementById('builder-draft-indicator');
    const dot = document.getElementById('builder-draft-dot');
    const text = document.getElementById('builder-draft-text');
    if (indicator) {
      indicator.style.display = 'inline-flex';
      if (dot) dot.style.background = '#10B981'; // Vert : sauvegardé avec succès
      const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      if (text) text.textContent = `Brouillon auto-sauvegardé (${timeStr})`;
    }
  },

  checkForBuilderDraft: function (isExistingDoc = false) {
    const banner = document.getElementById('builder-draft-resume-banner');
    if (!banner) return;

    if (isExistingDoc) {
      banner.style.display = 'none';
      return;
    }

    try {
      const raw = localStorage.getItem(this.getDraftStorageKey());
      if (!raw) {
        banner.style.display = 'none';
        return;
      }
      const draft = JSON.parse(raw);
      if (!draft || (!draft.clientName && (!draft.items || draft.items.length === 0))) {
        banner.style.display = 'none';
        return;
      }

      // Si le builder édite déjà précisément ce document
      const currentDocId = (document.getElementById('builder-doc-id') || {}).value;
      if (currentDocId && currentDocId === draft.id) {
        banner.style.display = 'none';
        return;
      }

      const timeEl = document.getElementById('builder-draft-banner-time');
      if (timeEl && draft.savedAt) {
        const d = new Date(draft.savedAt);
        const dateStr = d.toLocaleDateString('fr-FR') + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const clientStr = (draft.clientName && draft.clientName !== 'Client sans nom') ? `pour « ${draft.clientName} »` : '';
        const totalStr = draft.total ? `(${draft.total.toLocaleString('fr-FR')} ${draft.currency || 'FCFA'})` : '';
        timeEl.textContent = `Enregistré le ${dateStr} ${clientStr} ${totalStr}`.trim();
      }

      banner.style.display = 'flex';
    } catch (e) {
      console.warn('[KivoApp] checkForBuilderDraft error:', e);
      banner.style.display = 'none';
    }
  },

  restoreBuilderDraft: function () {
    try {
      const raw = localStorage.getItem(this.getDraftStorageKey());
      if (!raw) return;
      const draft = JSON.parse(raw);

      const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
      setVal('builder-doc-id', draft.id || '');
      setVal('builder-doc-type', draft.type || 'invoice');
      setVal('builder-doc-number', draft.number || '');
      setVal('builder-doc-currency', draft.currency || 'FCFA');
      setVal('builder-visual-template', draft.visualTemplate || 'minimalist');
      setVal('builder-issue-date', draft.issueDate || '');
      setVal('builder-due-date', draft.dueDate || '');
      setVal('builder-notes', draft.notes || '');
      setVal('builder-terms', draft.terms || 'À réception');
      setVal('builder-payment-method', draft.paymentMethod || 'Virement bancaire');

      // Client
      const clientSelect = document.getElementById('builder-doc-client-select');
      if (clientSelect && draft.clientId) {
        clientSelect.value = draft.clientId;
      }
      setVal('builder-client-name', draft.clientName || '');
      setVal('builder-client-email', draft.clientEmail || '');
      setVal('builder-client-phone', draft.clientPhone || '');
      setVal('builder-client-address', draft.clientAddress || '');

      // Articles
      const tbody = document.getElementById('builder-items-tbody');
      if (tbody) {
        tbody.innerHTML = '';
        if (draft.items && draft.items.length > 0) {
          draft.items.forEach(it => {
            this.addBuilderLineItem(it.name || '', it.quantity || 1, it.price || '', it.taxRate !== undefined ? it.taxRate : 0);
          });
        } else {
          this.addBuilderLineItem('', 1, 0);
        }
      }

      this._currentDraftDocId = draft.id;
      const banner = document.getElementById('builder-draft-resume-banner');
      if (banner) banner.style.display = 'none';

      this.recalculateBuilderTotals();
      this.updateLiveInvoicePreview();
      this.showToast(this._t('toast_draft_restored'), 'success');
    } catch (e) {
      console.error('[KivoApp] restoreBuilderDraft error:', e);
      this.showToast(this._t('toast_draft_restore_error'), 'danger');
    }
  },

  discardBuilderDraft: function () {
    try {
      localStorage.removeItem(this.getDraftStorageKey());
    } catch (e) {}
    this._currentDraftDocId = null;
    const banner = document.getElementById('builder-draft-resume-banner');
    if (banner) banner.style.display = 'none';
    const indicator = document.getElementById('builder-draft-indicator');
    if (indicator) indicator.style.display = 'none';
    this.showToast(this._t('toast_draft_deleted'), 'info');
  },

  clearBuilderDraftOnFinalize: function () {
    this._isDraftFinalizing = true;
    if (this._draftTimer) {
      clearTimeout(this._draftTimer);
      this._draftTimer = null;
    }
    try {
      localStorage.removeItem(this.getDraftStorageKey());
    } catch (e) {}
    this._currentDraftDocId = null;
    this._cloudDraftId = null; // FIX point2: reset cloud draft ID on finalize
    const banner = document.getElementById('builder-draft-resume-banner');
    if (banner) banner.style.display = 'none';
    const indicator = document.getElementById('builder-draft-indicator');
    if (indicator) indicator.style.display = 'none';
    setTimeout(() => {
      this._isDraftFinalizing = false;
    }, 1200);
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
      this.showToast(this._t('toast_template_saved'), "success");
    } catch (e) {
      console.error(e);
      this.showToast(this._t('toast_template_save_error'), "error");
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
      this.showToast(this._t('toast_template_deleted'), "success");
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
      this.showToast(this._t('toast_doc_ai_required'), "error");
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
      this.showToast(this._t('toast_doc_ai_filled'), "success");
    }
  },

  /**
   * Saves Document from Builder into State
   */
  saveDocumentFromBuilder: function () {
    const existingDocId = document.getElementById('builder-doc-id').value;
    const type = document.getElementById('builder-doc-type').value;

    // Enforce Free Tier limit of 3 documents (factures + devis) per month (seuls les documents finalisés comptent)
    const currentTier = (this.state.business?.subscriptionTier || 'Gratuit').toLowerCase();
    if (currentTier === 'gratuit' && !existingDocId) {
      const currentMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"
      const monthlyDocs = (this.state.documents || []).filter(d => 
        d.issueDate && 
        d.issueDate.startsWith(currentMonth) &&
        d.status !== 'draft' && d.status !== 'brouillon'
      );
      if (monthlyDocs.length >= 3) {
        this.showToast(this._t('toast_doc_free_limit'), "danger");
        this.navigate('pricing');
        return;
      }
    }

    const num = document.getElementById('builder-doc-number').value;
    const currency = document.getElementById('builder-doc-currency').value;
    const clientId = document.getElementById('builder-doc-client-select')?.value || '';
    const customClientName = (document.getElementById('builder-client-name')?.value || '').trim();
    const customClientEmail = (document.getElementById('builder-client-email')?.value || '').trim();
    const customClientPhone = (document.getElementById('builder-client-phone')?.value || '').trim();
    const customClientAddress = (document.getElementById('builder-client-address')?.value || '').trim();
    const customClientTaxId = (document.getElementById('builder-client-taxid')?.value || '').trim();

    const clientObj = (this.state.clients || []).find(c => String(c.id) === String(clientId)) || {
      id: clientId || 'cli_anon',
      name: customClientName || 'Client Destinataire',
      email: customClientEmail,
      phone: customClientPhone,
      address: customClientAddress,
      taxId: customClientTaxId,
      clientType: 'B2C'
    };
    const issueDate = document.getElementById('builder-issue-date').value;
    const dueDate = document.getElementById('builder-due-date').value;
    const rawBuilderStatus = (document.getElementById('builder-doc-status')?.value || 'draft').toLowerCase().trim();
    const isStatusPaid = rawBuilderStatus === 'paid' || rawBuilderStatus === 'payée' || rawBuilderStatus === 'payee';
    const status = isStatusPaid ? 'paid' : (rawBuilderStatus || 'draft');

    // Point B: Custom header and issuer fields (stored per-document, NEVER modifies state.business profile)
    const docTitleText = (document.getElementById('builder-doc-title-text')?.value || '').trim();
    const subject = (document.getElementById('builder-doc-subject')?.value || '').trim();
    const showSubject = document.getElementById('builder-toggle-subject') ? document.getElementById('builder-toggle-subject').checked : true;
    const showLogo = document.getElementById('builder-toggle-logo') ? document.getElementById('builder-toggle-logo').checked : true;
    const logoSize = parseInt(document.getElementById('builder-logo-size')?.value) || 70;
    const logoPosition = document.getElementById('builder-logo-position')?.value || 'right';
    const issuerName = (document.getElementById('builder-biz-name')?.value || '').trim() || this.getBusinessName();
    const issuerAddress = (document.getElementById('builder-biz-address')?.value || '').trim();
    const issuerPhone = (document.getElementById('builder-biz-phone')?.value || '').trim();
    const issuerEmail = (document.getElementById('builder-biz-email')?.value || '').trim();
    const issuerLegal = (document.getElementById('builder-biz-legal')?.value || '').trim();

    // Column custom labels
    const columnLabels = {
      desc: (document.getElementById('builder-col-desc')?.value || '').trim() || 'Description',
      qty: (document.getElementById('builder-col-qty')?.value || '').trim() || 'Quantité',
      unit: (document.getElementById('builder-col-unit')?.value || '').trim() || 'Unité',
      price: (document.getElementById('builder-col-price')?.value || '').trim() || 'Prix Unitaire',
      tax: (document.getElementById('builder-col-tax')?.value || '').trim() || 'TVA',
      discount: (document.getElementById('builder-col-discount')?.value || '').trim() || 'Remise',
      total: (document.getElementById('builder-col-total')?.value || '').trim() || 'Total HT'
    };

    // Totals custom labels
    const labels = {
      subtotal: (document.getElementById('builder-lbl-subtotal')?.value || '').trim() || 'Sous-total HT',
      tax: (document.getElementById('builder-lbl-tax')?.value || '').trim() || 'TVA',
      total: (document.getElementById('builder-lbl-total')?.value || '').trim() || 'Total TTC',
      deposit: (document.getElementById('builder-lbl-deposit')?.value || '').trim() || 'Acompte déjà versé',
      balance: (document.getElementById('builder-lbl-balance')?.value || '').trim() || 'Solde net à payer'
    };

    // Toggles & options
    const showVat = document.getElementById('builder-toggle-vat') ? document.getElementById('builder-toggle-vat').checked : true;
    const showDiscount = document.getElementById('builder-toggle-discount') ? document.getElementById('builder-toggle-discount').checked : false;
    const discountVal = parseFloat(document.getElementById('builder-discount-value')?.value) || 0;
    const discountType = document.getElementById('builder-discount-type')?.value || 'percent';

    const showDeposit = document.getElementById('builder-toggle-deposit') ? document.getElementById('builder-toggle-deposit').checked : false;
    const depositAmount = showDeposit ? (parseFloat(document.getElementById('builder-deposit-amount')?.value) || 0) : 0;

    const terms = document.getElementById('builder-terms')?.value || 'À réception';
    const paymentMethod = document.getElementById('builder-payment-method')?.value || 'Virement bancaire';
    const showPaymentMethods = document.getElementById('builder-toggle-payment-methods') ? document.getElementById('builder-toggle-payment-methods').checked : true;
    const paymentDetails = (document.getElementById('builder-payment-details')?.value || '').trim();

    const notes = (document.getElementById('builder-notes')?.value || '').trim();
    const showNotes = document.getElementById('builder-toggle-notes') ? document.getElementById('builder-toggle-notes').checked : true;

    const thankYouText = (document.getElementById('builder-thankyou')?.value || '').trim() || 'Merci pour votre confiance !';
    const showThankYou = document.getElementById('builder-toggle-thankyou') ? document.getElementById('builder-toggle-thankyou').checked : true;

    const legalNoticesText = (document.getElementById('builder-legal-notices')?.value || '').trim();
    const showLegalNotices = document.getElementById('builder-toggle-legal') ? document.getElementById('builder-toggle-legal').checked : true;

    // Items table read
    const items = [];
    let subtotal = 0;
    let totalTaxAmount = 0;
    document.querySelectorAll('#builder-items-tbody tr').forEach(tr => {
      const name = (tr.querySelector('.item-name')?.value || '').trim();
      const qty = parseFloat(tr.querySelector('.item-qty')?.value) || 1;
      const unit = (tr.querySelector('.item-unit')?.value || '').trim();
      const price = parseFloat(tr.querySelector('.item-price')?.value) || 0;
      const taxRate = (showVat && tr.querySelector('.item-tax')) ? (parseFloat(tr.querySelector('.item-tax').value) || 0) : 0;
      const rowDiscount = parseFloat(tr.querySelector('.item-discount')?.value) || 0;
      let totalHT = qty * price;
      if (rowDiscount > 0) {
        totalHT = Math.max(0, totalHT - (totalHT * (rowDiscount / 100)));
      }
      const taxAmount = showVat ? totalHT * (taxRate / 100) : 0;
      if (name || price > 0) {
        items.push({ name, quantity: qty, unit, price, taxRate, discount: rowDiscount, total: totalHT + taxAmount, totalHT });
        subtotal += totalHT;
        totalTaxAmount += taxAmount;
      }
    });

    if (items.length === 0) {
      this.showToast(this._t('toast_doc_no_items'), "warning");
      return;
    }

    let globalDiscount = 0;
    if (showDiscount && discountVal > 0) {
      if (discountType === 'percent') {
        globalDiscount = subtotal * (discountVal / 100);
      } else {
        globalDiscount = discountVal;
      }
      globalDiscount = Math.min(globalDiscount, subtotal);
    }

    const taxableAmount = Math.max(0, subtotal - globalDiscount);
    const grandTotal = Math.max(0, taxableAmount + (showVat ? totalTaxAmount : 0));
    const finalAmountPaid = isStatusPaid ? grandTotal : (showDeposit && depositAmount > 0 ? Math.min(depositAmount, grandTotal) : 0);

    const docId = existingDocId || this.generateUUID();

    const docObj = {
      id: docId,
      number: num,
      type: type,
      status: status,
      currency: currency,
      docTitleText: docTitleText,
      subject: subject,
      showSubject: showSubject,
      showLogo: showLogo,
      logoSize: logoSize,
      logoPosition: logoPosition,
      bizName: issuerName,
      issuerName: issuerName,
      issuerAddress: issuerAddress,
      issuerPhone: issuerPhone,
      issuerEmail: issuerEmail,
      issuerLegal: issuerLegal,
      clientId: clientObj.id,
      clientName: customClientName || clientObj.name || 'Client Destinataire',
      clientType: clientObj.clientType || 'B2C',
      clientTaxId: customClientTaxId || clientObj.taxId || '',
      clientLegalFieldName: clientObj.legalFieldName || '',
      clientEmail: customClientEmail || clientObj.email || '',
      clientPhone: customClientPhone || clientObj.phone || '',
      clientAddress: customClientAddress || clientObj.address || '',
      issueDate: issueDate,
      dueDate: dueDate,
      columnLabels: columnLabels,
      labels: labels,
      items: items,
      subtotal: subtotal,
      discount: globalDiscount,
      showDiscount: showDiscount,
      discountVal: discountVal,
      discountType: discountType,
      showVat: showVat,
      taxRate: 0, // Per-line taxes used
      tax: showVat ? totalTaxAmount : 0,
      total: grandTotal,
      showDeposit: showDeposit,
      depositAmount: depositAmount,
      amountPaid: finalAmountPaid,
      notes: notes,
      showNotes: showNotes,
      terms: terms,
      paymentMethod: paymentMethod,
      paymentDetails: paymentDetails,
      showPaymentMethods: showPaymentMethods,
      thankYouText: thankYouText,
      showThankYou: showThankYou,
      legalNoticesText: legalNoticesText,
      showLegalNotices: showLegalNotices,
      visualTemplate: document.getElementById('builder-visual-template') ? document.getElementById('builder-visual-template').value : ((this.state.business && this.state.business.visualTemplate) || 'minimalist'),
      templateId: document.getElementById('builder-visual-template') ? document.getElementById('builder-visual-template').value : ((this.state.business && this.state.business.visualTemplate) || 'minimalist'),
      logoUrl: this._invoiceLogoRemoved ? null : (this.builderCustomLogoUrl !== undefined && this.builderCustomLogoUrl !== null ? this.builderCustomLogoUrl : ((this.state.business && this.state.business.logoUrl) || null)),
      primaryColor: document.getElementById('builder-color-primary') ? document.getElementById('builder-color-primary').value : null,
      secondaryColor: document.getElementById('builder-color-secondary') ? document.getElementById('builder-color-secondary').value : null,
      publicToken: 'tok_' + Math.random().toString(36).substring(2, 8),
      viewsCount: 1,
      lastViewedAt: new Date().toLocaleString('fr-FR')
    };

    // Ensure unique number for new document if colliding with an existing document
    if (!existingDocId) {
      const docs = this.state.documents || [];
      const isTaken = docs.some(d => d && d.id !== docId && d.type === type && String(d.number).trim().toUpperCase() === String(num).trim().toUpperCase());
      if (isTaken) {
        num = this.generateDocumentNumber(type);
        docObj.number = num;
      }
    }

    if (existingDocId) {
      const idx = this.state.documents.findIndex(d => d.id === existingDocId);
      if (idx !== -1) {
        this.state.documents[idx] = docObj;
      } else {
        this.state.documents.unshift(docObj);
      }
    } else {
      this.state.documents.unshift(docObj);

      // Increment document numbering counter in business settings based on allocated number
      const currentDigits = parseInt(String(num).replace(/\D+/g, '').slice(-4), 10) || 0;
      if (type === 'quote') {
        this.state.business.nextQuoteNumber = Math.max((this.state.business.nextQuoteNumber || 1001), currentDigits + 1);
      } else {
        this.state.business.nextInvoiceNumber = Math.max((this.state.business.nextInvoiceNumber || 1001), currentDigits + 1);
      }

      // Sync sequence counter to Supabase settings
      if (window.KivoDb && this.supabaseConnected) {
        window.KivoDb.saveSettings({
          next_invoice_number: this.state.business.nextInvoiceNumber,
          next_quote_number: this.state.business.nextQuoteNumber
        }).catch(e => console.warn('[KivoApp] Cloud sequence counter sync warning:', e));
      }
    }

    this.state.activities.unshift({
      id: this.generateUUID(),
      timestamp: "À l'instant",
      type: type === 'quote' ? 'quote_created' : 'invoice_sent',
      icon: 'file-text',
      title: `${type === 'quote' ? 'Devis' : 'Facture'} #${num} ${existingDocId ? 'mis à jour' : 'enregistré(e)'}`,
      details: `${clientObj.name} (${grandTotal.toLocaleString('fr-FR')} ${currency})`
    });

    this.saveState();

    // Sync to Supabase with full custom payload wrapped in items column
    if (window.KivoDb && this.supabaseConnected) {
      window.KivoDb.saveDocument(docObj).catch(e => {
        console.error('[KivoApp] Supabase saveDocument error:', e);
        this.showToast(this.friendlySupabaseError(e, this._t('toast_doc_cloud_fail')), "warning");
      });
    }

    // Clear auto-saved draft: a finalized document is no longer a draft
    this.clearBuilderDraftOnFinalize();

    this.showToast(this._t('toast_doc_saved').replace('{num}', num), "success");
    this.viewPublicDoc(docId);
  },

  /**
   * Marque une facture comme Payée instantanément (1-clic)
   * Met à jour l'état local, l'activité, et synchronise avec Supabase
   */
  markInvoiceAsPaid: async function (docId) {
    const doc = (this.state && Array.isArray(this.state.documents))
      ? this.state.documents.find(d => d.id === docId)
      : null;
    if (!doc) return;

    doc.status = 'paid';
    doc.amountPaid = Number(doc.total) || 0;

    // Activité enregistrée
    const currencyStr = doc.currency || (this.state.business && this.state.business.currency) || 'FCFA';
    this.state.activities = this.state.activities || [];
    this.state.activities.unshift({
      id: this.generateUUID(),
      timestamp: "À l'instant",
      type: 'payment',
      icon: 'check-circle',
      title: `Facture #${doc.number} payée`,
      details: `${(doc.total || 0).toLocaleString('fr-FR')} ${currencyStr} encaissés`
    });

    this.saveState();

    this.showToast(`Facture ${doc.number} marquée comme payée !`, "success");

    // Rafraîchir la vue active
    if (this.activeView === 'documents') {
      this.renderDocumentsTable();
    } else if (this.activeView === 'dashboard') {
      this.renderDashboard();
    } else if (this.activeView === 'public-doc') {
      this.renderPublicDocView();
    } else {
      this.renderCurrentView();
    }

    // Synchronisation Supabase en arrière-plan
    if (window.KivoDb && this.supabaseConnected) {
      try {
        const { error } = await window.KivoDb.supabase
          .from('documents')
          .update({
            status: 'paid',
            amount_paid: doc.amountPaid
          })
          .eq('id', doc.id);
        if (error) console.warn('[KivoApp] markInvoiceAsPaid cloud sync warning:', error);
      } catch (err) {
        console.warn('[KivoApp] markInvoiceAsPaid cloud error:', err);
      }
    }
  },

  /**
   * Triggers Refund for a Paid Invoice
   */
  refundInvoice: function (docId) {
    const doc = this.state.documents.find(d => d.id === docId);
    if (!doc) return;

    if (confirm(`Voulez-vous vraiment rembourser la facture ${doc.number} (${doc.total.toLocaleString('fr-FR')} ${doc.currency || 'FCFA'}) ?`)) {
      window.PaymentProvider.processRefund(doc, "Remboursement demandé par le client", () => {
        this.showToast(this._t('toast_doc_refunded').replace('{num}', doc.number), "success");
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
      this._t('modal_confirm_delete_title'),
      `${this._t('btn_delete')} #${num} ?`,
      () => {
        this.state.documents = this.state.documents.filter(d => d.id !== docId);
        this.saveState();
        if (window.KivoDb && this.supabaseConnected) {
          window.KivoDb.deleteDocument(docId).catch(e => {
            console.error('[KivoApp] deleteDocument error:', e);
            this.showToast(this.friendlySupabaseError(e, this._t('toast_doc_delete_error')), "error");
          });
        }
        this.showToast(this._t('toast_doc_deleted').replace('{num}', num), "info");
        this.renderCurrentView();
      }
    );
  },

  confirmDeleteClient: function (clientId) {
    const cli = this.state.clients.find(c => c.id === clientId);
    const name = cli ? cli.name : 'ce client';

    this.confirmAction(
      this._t('modal_delete_client_title'),
      this._t('modal_delete_client_msg').replace('{name}', name),
      () => {
        this.state.clients = this.state.clients.filter(c => c.id !== clientId);
        this.saveState();
        if (window.KivoDb && this.supabaseConnected) {
          window.KivoDb.deleteClient(clientId).catch(e => {
            console.error('[KivoApp] deleteClient error:', e);
            this.showToast(this.friendlySupabaseError(e, this._t('toast_client_delete_error')), "error");
          });
        }
        this.showToast(this._t('toast_client_deleted').replace('{name}', name), "info");
        this.renderClients();
      }
    );
  },

  /**
   * Navigates to Public Document View
   */
  viewPublicDoc: function (docId) {
    const doc = (this.state && Array.isArray(this.state.documents)) ? this.state.documents.find(d => d.id === docId || d.publicToken === docId) : null;
    const token = (doc && doc.publicToken) ? doc.publicToken : docId;
    this.navigate('public-doc', `token=${token}`);
  },

  /**
   * Renders Public Client View (`/invoice/xxxxx` or `/quote/xxxxx`)
   */
  renderPublicDocView: async function () {
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const token = urlParams.get('token') || urlParams.get('id');
    
    if (!token) {
      console.warn('[KivoApp] renderPublicDocView: No document ID or token provided.');
      return;
    }

    let doc = (this.state && Array.isArray(this.state.documents)) 
      ? this.state.documents.find(d => d.id === token || d.publicToken === token) 
      : null;
    let biz = (this.state && this.state.business) ? this.state.business : {};

    if (!doc && window.KivoDb && window.KivoDb.supabase) {
      try {
        console.log('[KivoApp] Loading document via secure public RPC (token:', token, ')');
        let cloudDoc = null;

        // 1. Appel sécurisé via fonction Postgres SECURITY DEFINER get_public_document
        const { data: rpcData, error: rpcErr } = await KivoDb.supabase.rpc('get_public_document', { p_token: token });
        if (rpcErr) {
          console.warn('[KivoApp] get_public_document RPC error:', rpcErr);
        }
        if (rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
          cloudDoc = rpcData[0];
        } else if (rpcData && !Array.isArray(rpcData)) {
          cloudDoc = rpcData;
        }

        // 2. Si non trouvé par token et que l'utilisateur est connecté, tentative de lecture propriétaire par UUID
        if (!cloudDoc) {
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
          if (isUUID) {
            const { data: ownDoc } = await KivoDb.supabase.from('documents').select('*').eq('id', token).maybeSingle();
            if (ownDoc) cloudDoc = ownDoc;
          }
        }

        if (!cloudDoc) {
          this.showToast(this._t('toast_doc_not_found'), "danger");
          return;
        }

        // Parse items — stored as {lines:[], issueDate, dueDate, currency} wrapper
        let pubItems = cloudDoc.items || [];
        let pubIssueDate = cloudDoc.date_issued || cloudDoc.issue_date || '';
        let pubDueDate = cloudDoc.date_due || cloudDoc.due_date || '';
        let pubCurrency = cloudDoc.currency || 'FCFA';
        if (typeof pubItems === 'string') {
          try {
            const w = JSON.parse(pubItems);
            if (w && !Array.isArray(w) && Array.isArray(w.lines)) {
              pubItems = w.lines;
              pubIssueDate = w.issueDate || pubIssueDate;
              pubDueDate = w.dueDate || pubDueDate;
              pubCurrency = w.currency || pubCurrency;
            } else if (Array.isArray(w)) {
              pubItems = w;
            } else {
              pubItems = [];
            }
          } catch (_) { pubItems = []; }
        } else if (pubItems && !Array.isArray(pubItems) && Array.isArray(pubItems.lines)) {
          pubIssueDate = pubItems.issueDate || pubIssueDate;
          pubDueDate = pubItems.dueDate || pubDueDate;
          pubCurrency = pubItems.currency || pubCurrency;
          pubItems = pubItems.lines;
        }

        const rawSub = parseFloat(cloudDoc.subtotal) || 0;
        const rawDisc = parseFloat(cloudDoc.discount) || 0;
        const rawRate = parseFloat(cloudDoc.tax_rate) || 0;
        let rawTax = parseFloat(cloudDoc.tax_amount) || 0;
        let rawTot = parseFloat(cloudDoc.total) || 0;

        let calcSub = rawSub;
        if (calcSub === 0 && Array.isArray(pubItems) && pubItems.length > 0) {
          calcSub = pubItems.reduce((acc, it) => acc + (parseFloat(it.total) || (parseFloat(it.price) * parseFloat(it.quantity)) || 0), 0);
        }
        if (rawTax === 0 && rawRate > 0 && calcSub > 0) {
          rawTax = Math.round((calcSub - rawDisc) * (rawRate / 100));
        }
        if (rawTot === 0 && calcSub > 0) {
          rawTot = Math.max(0, calcSub - rawDisc + rawTax);
        }

        doc = {
          id: cloudDoc.id,
          number: cloudDoc.number,
          type: cloudDoc.type,
          status: cloudDoc.status,
          currency: pubCurrency,
          clientId: cloudDoc.client_id,
          clientName: cloudDoc.client_name || 'Client Destinataire',
          clientType: cloudDoc.client_type || 'B2C',
          clientTaxId: cloudDoc.client_tax_id || '',
          clientEmail: cloudDoc.client_email || '',
          clientPhone: cloudDoc.client_phone || '',
          issueDate: pubIssueDate,
          dueDate: pubDueDate,
          items: pubItems,
          subtotal: calcSub,
          discount: rawDisc,
          taxRate: rawRate,
          tax: rawTax,
          total: rawTot,
          amountPaid: parseFloat(cloudDoc.amount_paid) || 0,
          notes: cloudDoc.notes || '',
          terms: cloudDoc.conditions || '',
          viewsCount: cloudDoc.views_count || 0
        };

        if (cloudDoc.user_id) {
          const { data: cloudBiz, error: bizErr } = await KivoDb.supabase
            .from('business_settings')
            .select('*')
            .eq('user_id', cloudDoc.user_id)
            .maybeSingle();

          if (!bizErr && cloudBiz) {
            biz = {
              name: cloudBiz.company_name || cloudBiz.owner || 'Mon Entreprise',
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
        this.showToast(this._t('toast_doc_load_error'), "danger");
        return;
      }
    }

    if (!doc) {
      this.showToast(this._t('toast_doc_not_found_short'), "danger");
      return;
    }

    // Ensure fallback totals for local docs if missing
    if (doc) {
      if ((!doc.subtotal || doc.subtotal === 0) && Array.isArray(doc.items) && doc.items.length > 0) {
        doc.subtotal = doc.items.reduce((acc, it) => acc + (parseFloat(it.total) || (parseFloat(it.price) * parseFloat(it.quantity)) || 0), 0);
      }
      if ((!doc.tax || doc.tax === 0) && doc.taxRate && doc.subtotal) {
        doc.tax = Math.round(((doc.subtotal || 0) - (doc.discount || 0)) * ((doc.taxRate || 0) / 100));
      }
      if ((!doc.total || doc.total === 0) && doc.subtotal) {
        doc.total = Math.max(0, (doc.subtotal || 0) - (doc.discount || 0) + (doc.tax || 0));
      }
    }

    this._currentPublicDoc = doc;
    this._currentPublicBiz = biz;

    const isAuth = !!(window.KivoAuth && window.KivoAuth.user);

    // Toggle back button visibility (only for authenticated users)
    const pubBackBtn = document.getElementById('pub-back-btn');
    if (pubBackBtn) {
      pubBackBtn.style.display = isAuth ? 'inline-flex' : 'none';
    }

    // Marketing CTA (propose creating an account at bottom of public invoice — only for anonymous visitors)
    const marketingCta = document.getElementById('pub-kivo-marketing-cta');
    if (marketingCta) {
      marketingCta.style.display = isAuth ? 'none' : 'block';
    }

    // ── Simple flèche "←" claire et grande positionnée à gauche du logo KIVO → liste des documents
    const backBtnContainer = document.getElementById('pub-back-btn');
    if (backBtnContainer) {
      backBtnContainer.innerHTML = isAuth ? `
        <button type="button" class="pub-arrow-back-btn" onclick="KivoApp.navigate('documents')"
          title="Retour aux documents" aria-label="Retour aux documents">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>` : '';
    }

    // Top action bar (right side) — edit, download, WhatsApp, mark as paid
    const topActions = document.getElementById('pub-top-actions');
    const rawPubStatus = (doc.status || '').toLowerCase().trim();
    const isDocPaid = rawPubStatus === 'paid' || rawPubStatus === 'payée' || rawPubStatus === 'payee';

    if (topActions) {
      topActions.innerHTML = `
        ${(isAuth && doc.type === 'invoice' && !isDocPaid && doc.status !== 'refunded') ? `
          <button class="btn btn-success btn-sm" onclick="KivoApp.markInvoiceAsPaid('${doc.id}')" style="display: inline-flex; align-items: center; gap: 5px; font-weight: 600;" title="Marquer comme payée">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Marquer payée</span>
          </button>
        ` : ''}
        ${isAuth ? `
          <button class="btn btn-secondary btn-sm" onclick="KivoApp.editDocument('${doc.id}')" style="display: inline-flex; align-items: center; gap: 5px;" title="Modifier le document">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span>Modifier</span>
          </button>
        ` : ''}
        <button class="btn btn-secondary btn-sm" onclick="KivoApp.downloadPdf('${doc.id}')" style="display: inline-flex; align-items: center; gap: 5px;" title="Télécharger le PDF">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>PDF</span>
        </button>
      `;
    }

    const currencyStr = doc.currency || biz.currency || 'FCFA';

    // Increment document view count asynchronously in the cloud
    // NOTE: Supabase v2 builders are NOT Promises until awaited — must use async IIFE, no .catch() on builder
    if (this.supabaseConnected && (!window.KivoAuth || !window.KivoAuth.user || window.KivoAuth.user.id !== doc.userId)) {
      const newViews = (doc.viewsCount || 0) + 1;
      const newStatus = doc.status === 'sent' ? 'viewed' : doc.status;
      
      const localDoc = (this.state && Array.isArray(this.state.documents)) ? this.state.documents.find(d => d.id === doc.id) : null;
      if (localDoc) {
        localDoc.viewsCount = newViews;
        localDoc.status = newStatus;
        this.saveState();
      }
      
      // Async IIFE — fire & forget, does NOT block rendering
      ;(async () => {
        try {
          const { error } = await KivoDb.supabase
            .from('documents')
            .update({ views_count: newViews, status: newStatus })
            .eq('id', doc.id);
          if (error) console.warn('[KivoApp] views_count update warning:', error.message);
        } catch (e) {
          console.warn('[KivoApp] Failed to update views_count:', e.message || e);
        }
      })();
    }

    // Unify rendering with builder and PDF via KivoTemplates.render
    const { renderedHtml, templateId } = this._getDocForRender(doc);
    const pubArea = document.getElementById('public-doc-printable-area');
    if (pubArea && renderedHtml) {
      pubArea.innerHTML = renderedHtml;
      pubArea.style.padding = '0';
      pubArea.style.overflow = (window.innerWidth <= 1024) ? 'visible' : 'hidden';
      pubArea.style.background = (templateId === 'premium') ? '#181A20' : '#FFFFFF';
    }

    const pubBarTotal = document.getElementById('pub-bar-total');
    if (pubBarTotal) {
      pubBarTotal.textContent = (doc.total || 0).toLocaleString('fr-FR') + ' ' + currencyStr;
    }

    const btnContainer = document.getElementById('pub-bar-buttons-container');
    
    if (doc.type === 'quote' && (doc.status === 'sent' || doc.status === 'viewed')) {
      btnContainer.innerHTML = `
        <button class="btn btn-success" onclick="KivoApp.clientAcceptQuote('${doc.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:5px;"><polyline points="20 6 9 17 4 12"/></svg>
          Accepter le devis
        </button>
        <button class="btn btn-secondary" onclick="KivoApp.downloadPdf('${doc.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:middle; margin-right:5px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Télécharger PDF
        </button>
      `;
    } else if (doc.type === 'invoice' && !isDocPaid && doc.status !== 'refunded') {
      btnContainer.innerHTML = `
        ${isAuth ? `
          <button class="btn btn-success" onclick="KivoApp.markInvoiceAsPaid('${doc.id}')" style="display:inline-flex; align-items:center; gap:6px; font-weight:600;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            Marquer comme payée
          </button>
        ` : `
          <button class="btn btn-primary" onclick="KivoApp.openPaymentModal('${doc.id}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline-block; vertical-align:middle; margin-right:5px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Payer en ligne (${(doc.total).toLocaleString('fr-FR')} ${currencyStr})
          </button>
        `}
        <button class="btn btn-secondary" onclick="KivoApp.downloadPdf('${doc.id}')">
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
        <button class="btn btn-secondary" onclick="KivoApp.downloadPdf('${doc.id}')">
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
        id: this.generateUUID(),
        timestamp: "À l'instant",
        type: 'quote_accepted',
        icon: 'check-circle',
        title: `Devis #${doc.number} accepté`,
        details: `Validé par ${doc.clientName}`
      });

      this.saveState();
      this.showToast(this._t('toast_doc_quote_accepted'), "success");
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

      this.showToast(
        this._t('toast_payment_confirmed')
          .replace('{amount}', doc.total.toLocaleString('fr-FR'))
          .replace('{currency}', doc.currency || 'FCFA')
          .replace('{provider}', this.selectedProviderId.toUpperCase()),
        "success"
      );
      this.renderPublicDocView();
    });
  },

  recordInvoicePayment: function (docId, amount, providerId, transactionId) {
    const doc = this.state.documents.find(d => d.id === docId);
    if (doc) {
      doc.status = 'paid';
      doc.amountPaid = (doc.amountPaid || 0) + amount;

      this.state.activities.unshift({
        id: this.generateUUID(),
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
        id: this.generateUUID(),
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
    const doc = (this.state.documents || []).find(d => String(d.id) === String(docId));
    if (!doc) return;

    const isQuote = doc.type === 'quote';
    const warnMsg = isQuote
      ? this._t('toast_doc_cannot_share_draft_quote')
      : this._t('toast_doc_cannot_share_draft');

    const isDraft = doc.status === 'draft' || doc.status === 'brouillon';
    const hasNoItems = !Array.isArray(doc.items) || doc.items.length === 0;
    const hasZeroTotal = !doc.total || parseFloat(doc.total) <= 0;

    if (isDraft || hasNoItems || hasZeroTotal) {
      this.showToast(warnMsg, "warning");
      return;
    }

    const bizName = this.getBusinessName();
    const msg = window.WhatsAppHelper.buildShareMessage(doc, bizName);

    // PC et Mobile : ouverture directe de WhatsApp via https://wa.me/?text=<message encodé>
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
    this.showToast(this._t('toast_whatsapp_opening'), 'success');
  },

  // Legacy — kept as no-op in case called from old HTML; modal-whatsapp-share is no longer used
  confirmWhatsAppShare: function () {
    this.closeModal('modal-whatsapp-share');
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
        <td><strong style="cursor: pointer; color: var(--primary);" onclick="KivoApp.openClientDetails('${c.id}')" title="Voir les détails et factures de ce client">${c.name}</strong> ${c.clientType ? `<span class="badge badge-accepted" style="font-size: 0.65rem;">${c.clientType}</span>` : ''}</td>
        <td>${c.company || c.taxId || '-'}</td>
        <td>${c.phone || '-'}</td>
        <td><strong>${totalInvoiced.toLocaleString('fr-FR')} ${currency}</strong></td>
        <td style="color: var(--success-text);"><strong>${totalPaid.toLocaleString('fr-FR')} ${currency}</strong></td>
        <td style="color: ${balanceDue > 0 ? 'var(--danger-text)' : 'var(--success-text)'}"><strong>${balanceDue.toLocaleString('fr-FR')} ${currency}</strong></td>
        <td style="text-align: right; display: flex; gap: 0.35rem; justify-content: flex-end;">
          <button class="btn btn-secondary btn-sm" onclick="KivoApp.openClientDetails('${c.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="10" r="3"/></svg> Détails</button>
          <button class="btn btn-secondary btn-sm" onclick="KivoApp.openEditClientModal('${c.id}')" title="Modifier ce client"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Modifier</button>
          <button class="btn btn-secondary btn-sm" onclick="KivoApp.startNewDocumentForClient('${c.id}')">+ Facturer</button>
          <button class="btn btn-danger btn-sm" onclick="KivoApp.confirmDeleteClient('${c.id}')" title="Supprimer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </td>
      </tr>
    `}).join('');
  },

  /**
   * Point 1 fix: Open the client creation modal pre-filled with existing data for editing.
   */
  openEditClientModal: function (clientId) {
    const c = this.state.clients.find(cl => cl.id === clientId);
    if (!c) return;

    // Reset form first (clear fields)
    const form = document.getElementById('modal-new-client');
    if (!form) return;

    // Set hidden ID so saveNewClient knows it's an edit
    const idEl = document.getElementById('new-cli-id');
    if (idEl) idEl.value = c.id;

    // Modal title
    const titleEl = document.getElementById('modal-new-client-title');
    if (titleEl) titleEl.textContent = 'Modifier le client';

    // Type radio
    const typeRadios = document.getElementsByName('new-cli-type');
    typeRadios.forEach(r => { r.checked = (r.value === (c.clientType || 'B2B')); });
    this.toggleClientTypeForm(c.clientType || 'B2B');

    // Fields
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    set('new-cli-name', c.name);
    set('new-cli-contact', c.contactName);
    set('new-cli-email', c.email);
    set('new-cli-taxid', c.taxId);
    set('new-cli-address', c.address);
    set('new-cli-country', c.country || 'SN');

    // Phone: try to split prefix from number
    if (c.phone) {
      const prefixMatch = c.phone.match(/^(\+\d{1,4})\s(.+)$/);
      if (prefixMatch) {
        set('new-cli-phone-prefix', prefixMatch[1]);
        set('new-cli-phone', prefixMatch[2]);
      } else {
        set('new-cli-phone', c.phone);
      }
    } else {
      set('new-cli-phone', '');
    }

    // Trigger country change to update legalname label
    if (typeof this.onClientCountryChange === 'function') this.onClientCountryChange();

    this.openModal('modal-new-client');
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
      if (client.taxId) parts.push(`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> ${client.legalFieldName || 'NINEA / SIRET'} : ${client.taxId}`);
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
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--bg-subtle); border-radius: var(--radius-md); border: 1px solid var(--border-color); cursor: pointer; transition: all 0.15s ease;" onmouseover="this.style.borderColor='var(--primary)';this.style.background='var(--primary-light)'" onmouseout="this.style.borderColor='var(--border-color)';this.style.background='var(--bg-subtle)'" onclick="KivoApp.closeModal('modal-client-details'); KivoApp.viewPublicDoc('${doc.id}');" title="Afficher cette facture">
            <div>
              <strong style="font-size: 0.95rem; color: var(--primary);">${doc.number}</strong>
              <div style="font-size: 0.8rem; color: var(--text-secondary);">${doc.type === 'quote' ? 'Devis' : 'Facture'} · Émis le ${doc.issueDate || '—'}</div>
            </div>
            <div style="text-align: right; display: flex; align-items: center; gap: 0.75rem;">
              <span class="badge ${statusClass[doc.status] || ''}">${statusLabel[doc.status] || doc.status}</span>
              <strong>${(doc.total || 0).toLocaleString('fr-FR')} ${doc.currency || currency}</strong>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>
        `).join('');
      }
    }

    // Store current client ID for "new invoice" button
    this._crmCurrentClientId = clientId;

    this.openModal('modal-client-details');
  },

  filterInvoicesByClient: function (clientName) {
    const name = clientName || (this._crmCurrentClientId ? (this.state.clients.find(c => c.id === this._crmCurrentClientId)?.name) : '');
    this.closeModal('modal-client-details');
    this.navigate('billing');
    const searchInput = document.getElementById('search-docs-input');
    if (searchInput && name) {
      searchInput.value = name;
    }
    this.renderDocumentsTable('all', name || '');
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

  // ── Services & Prestations (Catalogue Articles & Prestations) ───────────

  /**
   * Rend la liste des articles et prestations du catalogue
   */
  renderServices: function () {
    const tbody = document.getElementById('services-list-tbody');
    if (!tbody) return;

    const catalog = (this.state && this.state.catalog) || [];
    const currency = this.state?.business?.currency || 'FCFA';

    if (catalog.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem 1.5rem;">
            <div style="font-size: 1rem; font-weight: 600; color: var(--text-primary); margin-bottom: 0.5rem;">Votre liste de services &amp; prestations est vide</div>
            <p style="font-size: 0.85rem; margin-bottom: 1rem;">Ajoutez vos prestations ou produits pour les insérer directement dans vos factures et devis.</p>
            <button class="btn btn-primary btn-sm" onclick="KivoApp.openNewCatalogItemModal()">+ Ajouter votre premier service / prestation</button>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = catalog.map(item => {
      const priceFmt = Number(item.price || 0).toLocaleString('fr-FR') + ' ' + currency;
      const taxLabel = (item.taxRate !== undefined && item.taxRate !== null && item.taxRate !== '') 
        ? `${item.taxRate} %` 
        : '-';
      const unitLabel = item.unit || 'unité';

      return `
        <tr>
          <td>
            <strong style="color: var(--text-primary); font-size: 0.95rem;">${item.name || 'Article sans nom'}</strong>
          </td>
          <td style="color: var(--text-muted); font-size: 0.85rem; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${item.description || '<span style="opacity: 0.5;">—</span>'}
          </td>
          <td style="text-align: right; font-weight: 700; color: var(--text-primary);">
            ${priceFmt}
          </td>
          <td style="text-align: center;">
            <span class="badge" style="background: var(--bg-subtle); color: var(--text-secondary); border: 1px solid var(--border-color); font-size: 0.75rem; text-transform: uppercase;">
              ${unitLabel}
            </span>
          </td>
          <td style="text-align: center; font-size: 0.85rem; color: var(--text-secondary);">
            ${taxLabel}
          </td>
          <td style="text-align: right;">
            <div style="display: flex; gap: 0.35rem; justify-content: flex-end;">
              <button class="btn btn-secondary btn-sm" onclick="KivoApp.openEditCatalogItemModal('${item.id}')" title="Modifier cet article" style="padding: 4px 8px; font-size: 0.8rem;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                <span>Modifier</span>
              </button>
              <button class="btn btn-danger btn-sm" onclick="KivoApp.confirmDeleteCatalogItem('${item.id}')" title="Supprimer cet article" style="padding: 4px 8px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  /**
   * Ouvre la modale d'ajout d'un nouvel article dans le catalogue
   */
  openNewCatalogItemModal: function () {
    const title = document.getElementById('modal-catalog-title');
    if (title) title.textContent = this._t('modal_catalog_title');

    const idInput = document.getElementById('item-modal-id');
    const nameInput = document.getElementById('item-modal-name');
    const descInput = document.getElementById('item-modal-desc');
    const priceInput = document.getElementById('item-modal-price');
    const unitSelect = document.getElementById('item-modal-unit');
    const taxInput = document.getElementById('item-modal-tax');

    if (idInput) idInput.value = '';
    if (nameInput) nameInput.value = '';
    if (descInput) descInput.value = '';
    if (priceInput) priceInput.value = '';
    if (unitSelect) unitSelect.value = 'unité';

    const defaultVat = this.state.business?.defaultVatRate !== undefined 
      ? this.state.business.defaultVatRate 
      : (this.state.business?.taxRate !== undefined ? this.state.business.taxRate : 0);
    if (taxInput) taxInput.value = defaultVat;

    this.openModal('modal-catalog-item');
    if (nameInput) setTimeout(() => nameInput.focus(), 100);
  },

  /**
   * Ouvre la modale de modification d'un article existant
   */
  openEditCatalogItemModal: function (itemId) {
    const item = (this.state.catalog || []).find(it => String(it.id) === String(itemId));
    if (!item) return;

    const title = document.getElementById('modal-catalog-title');
    if (title) title.textContent = this._t('modal_catalog_edit_title');

    const idInput = document.getElementById('item-modal-id');
    const nameInput = document.getElementById('item-modal-name');
    const descInput = document.getElementById('item-modal-desc');
    const priceInput = document.getElementById('item-modal-price');
    const unitSelect = document.getElementById('item-modal-unit');
    const taxInput = document.getElementById('item-modal-tax');

    if (idInput) idInput.value = item.id;
    if (nameInput) nameInput.value = item.name || '';
    if (descInput) descInput.value = item.description || '';
    if (priceInput) priceInput.value = (item.price !== undefined && item.price !== null) ? item.price : '';
    if (unitSelect) unitSelect.value = item.unit || 'unité';
    if (taxInput) {
      taxInput.value = (item.taxRate !== undefined && item.taxRate !== null && item.taxRate !== '')
        ? item.taxRate
        : (this.state.business?.defaultVatRate !== undefined ? this.state.business.defaultVatRate : 0);
    }

    this.openModal('modal-catalog-item');
    if (nameInput) setTimeout(() => nameInput.focus(), 100);
  },

  /**
   * Enregistre un article (ajout ou modification) dans le state et Supabase
   */
  saveCatalogItemForm: async function () {
    const nameEl = document.getElementById('item-modal-name');
    const priceEl = document.getElementById('item-modal-price');
    const descEl = document.getElementById('item-modal-desc');
    const unitEl = document.getElementById('item-modal-unit');
    const taxEl = document.getElementById('item-modal-tax');
    const idEl = document.getElementById('item-modal-id');

    const name = nameEl ? nameEl.value.trim() : '';
    if (!name) {
      this.showToast(this._t('toast_item_name_required'), "error");
      if (nameEl) nameEl.focus();
      return;
    }

    const priceRaw = priceEl ? priceEl.value : '';
    const price = parseFloat(priceRaw);
    if (isNaN(price) || price < 0) {
      this.showToast(this._t('toast_item_price_required'), "error");
      if (priceEl) priceEl.focus();
      return;
    }

    const desc = descEl ? descEl.value.trim() : '';
    const unit = unitEl ? unitEl.value : 'unité';
    let taxRate = parseFloat(taxEl ? taxEl.value : 0);
    if (isNaN(taxRate)) {
      taxRate = this.state.business?.defaultVatRate !== undefined 
        ? this.state.business.defaultVatRate 
        : (this.state.business?.taxRate !== undefined ? this.state.business.taxRate : 0);
    }

    const existingId = idEl ? idEl.value : '';
    const itemId = existingId || this.generateUUID();

    const itemObj = {
      id: itemId,
      name: name,
      description: desc,
      price: price,
      unit: unit,
      taxRate: taxRate
    };

    this.state.catalog = this.state.catalog || [];
    const existingIdx = this.state.catalog.findIndex(it => String(it.id) === String(itemId));
    if (existingIdx >= 0) {
      this.state.catalog[existingIdx] = itemObj;
    } else {
      this.state.catalog.unshift(itemObj);
    }

    this.saveState();

    // Synchronisation Supabase via saveCatalogItem (table catalog)
    if (window.KivoDb && this.supabaseConnected) {
      window.KivoDb.saveCatalogItem({
        id: itemObj.id,
        name: itemObj.name,
        description: itemObj.description,
        price: itemObj.price,
        unit: itemObj.unit,
        tax_rate: itemObj.taxRate
      }).catch(e => {
        console.error('[KivoApp] Supabase saveCatalogItem error:', e);
        this.showToast(this.friendlySupabaseError(e, this._t('toast_item_save_error')), "warning");
      });
    }

    this.closeModal('modal-catalog-item');
    this.populateBuilderCatalogDropdown();
    this.renderServices();
    this.showToast(this._t('toast_item_saved').replace('{name}', name), "success");
  },

  /**
   * Supprime un article/prestation du catalogue
   */
  confirmDeleteCatalogItem: async function (itemId) {
    const item = (this.state.catalog || []).find(it => String(it.id) === String(itemId));
    const itemName = item ? item.name : 'cette prestation';

    if (!confirm(this._t('modal_delete_item_confirm').replace('{name}', itemName))) {
      return;
    }

    this.state.catalog = (this.state.catalog || []).filter(it => String(it.id) !== String(itemId));
    this.saveState();

    if (window.KivoDb && this.supabaseConnected) {
      window.KivoDb.deleteCatalogItem(itemId).catch(e => {
        console.error('[KivoApp] Supabase deleteCatalogItem error:', e);
        this.showToast(this.friendlySupabaseError(e, this._t('toast_item_delete_error')), "error");
      });
    }

    this.populateBuilderCatalogDropdown();
    this.renderServices();
    this.showToast(this._t('toast_item_deleted').replace('{name}', itemName), "info");
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
    // Note: Ne jamais écraser automatiquement this.state.business.primaryColor
    // Le choix du modèle change uniquement la mise en page.
    
    // 2. Save implicitly to localStorage (and Supabase if connected)
    this.saveState();
    
    const tmplObj = window.KivoTemplates?.builtIn?.find(t => t.id === templateId);
    const tmplName = tmplObj ? tmplObj.name : templateId;
    this.showToast(this._t('toast_template_applied').replace('{name}', tmplName), 'success');

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
      this.showToast(this._t('toast_template_applied_invoice').replace('{name}', tmplObj.name), 'success');
    }
  },

  applyTemplateDefaultColors: function () {
    const tSelect = document.getElementById('builder-visual-template');
    const templateId = (tSelect && tSelect.value) ? tSelect.value : (this.state.business?.visualTemplate || 'minimalist');
    const defaultPaletteMap = {
      minimalist: { primary: '#0F172A', secondary: '#475569' },
      corporate:  { primary: '#1E3A5F', secondary: '#2563EB' },
      elegant:    { primary: '#C9A84C', secondary: '#6B5C2A' },
      modern:     { primary: '#7C3AED', secondary: '#EC4899' },
      clean:      { primary: '#0E7490', secondary: '#06B6D4' },
      editorial:  { primary: '#EF4444', secondary: '#111827' },
      premium:    { primary: '#D49B7A', secondary: '#B87352' }
    };
    const palette = defaultPaletteMap[templateId] || defaultPaletteMap.minimalist;
    this.setBuilderPresetColors(palette.primary, palette.secondary);
    this.showToast(this._t('toast_template_colors_applied'), 'info');
  },

  openTemplateEditor: function () {
    // Basic interaction for "Créer mon modèle"
    this.showToast(this._t('toast_template_editor_soon'), 'info');
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
      this.showToast(this._t('toast_reminder_copied'), "info");
    });
  },

  // ─────────────────────────────────────────────────────────────
  // TEAM MANAGEMENT (Business Plan — 5 sièges, Directeur/Membre)
  // Toutes les opérations passent par KivoDb (Supabase) — AUCUNE écriture directe côté invité.
  // ─────────────────────────────────────────────────────────────────────────────────────────

  // Cache local des membres chargés depuis Supabase
  _teamMembers: [],

  openInviteMemberModal: async function () {
    const tier = (this.state.business && this.state.business.subscriptionTier) || 'Gratuit';
    if (tier !== 'Business') {
      this.showToast('Cette fonctionnalité est réservée au plan Business.', 'info');
      this.navigate('settings');
      return;
    }
    // Charger les membres depuis Supabase pour vérifier le quota réel
    await this.loadTeamMembers();
    // 1 directeur + max 4 membres = 5 sièges
    const activeCount = this._teamMembers.filter(m => m.status === 'active').length;
    const pendingCount = this._teamMembers.filter(m => m.status === 'pending').length;
    if (activeCount + pendingCount >= 4) {
      this.showToast('Quota atteint : 4 membres max (+ 1 Directeur = 5 sièges). Retirez un membre pour en ajouter un autre.', 'info');
      return;
    }
    const emailInput = document.getElementById('invite-member-email');
    if (emailInput) emailInput.value = '';
    this.openModal('modal-invite-member');
  },

  sendMemberInvite: async function () {
    const email = ((document.getElementById('invite-member-email') || {}).value || '').trim();
    const role  = (document.getElementById('invite-member-role')  || {}).value || 'membre';
    if (!email || !email.includes('@')) {
      this.showToast('Adresse e-mail invalide.', 'error');
      return;
    }

    const user = window.KivoAuth && window.KivoAuth.user;
    if (!user) { this.showToast('Non authentifié.', 'error'); return; }

    // Vérifier doublon en base
    const existing = this._teamMembers.find(m => m.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      this.showToast('Ce collaborateur est déjà invité ou membre.', 'error');
      return;
    }

    const inviteToken = this.generateUUID();
    const row = {
      id:           this.generateUUID(),
      user_id:      user.id,
      email:        email.toLowerCase(),
      role:         role,
      name:         email.split('@')[0],
      status:       'pending',
      invite_token: inviteToken,
      invited_at:   new Date().toISOString()
    };

    // Insérer dans team_members (propriétaire uniquement — RLS garantit user_id = auth.uid())
    const _kivoClient = window.KivoDb && window.KivoDb.supabase;
    if (!_kivoClient) { this.showToast('Erreur de connexion Supabase.', 'error'); return; }

    const { error: insertErr } = await _kivoClient.from('team_members').insert(row);
    if (insertErr) {
      this.showToast('Erreur lors de l'invitation : ' + (insertErr.message || 'inconnue'), 'error');
      return;
    }

    // Envoyer l'e-mail d'invitation via Supabase Auth (magic link vers accept-invite.html)
    const siteBase = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');
    const acceptUrl = `${siteBase}/accept-invite.html?token=${encodeURIComponent(inviteToken)}&email=${encodeURIComponent(email)}`;


    try {
      // Envoyer un magic link vers accept-invite.html (non bloquant)
      await _kivoClient.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: acceptUrl,
          shouldCreateUser: true,
          data: { invite_token: inviteToken, invited_by: user.email }
        }
      });
    } catch (_) { /* non bloquant — l'invitation est deja en base */ }


    this.closeModal('modal-invite-member');
    this.showToast(`Invitation envoyée à ${email}. Le lien est valable 24 h.`, 'success');

    // Rafraîchir la liste
    await this.loadTeamMembers();
    this.renderTeam();
  },

  loadTeamMembers: async function () {
    const user = window.KivoAuth && window.KivoAuth.user;
    if (!user) { this._teamMembers = []; return; }
    const _kivoClient = window.KivoDb && window.KivoDb.supabase;
    if (!_kivoClient) return;
    const { data, error } = await _kivoClient
      .from('team_members')
      .select('id, email, role, name, status, invited_at, accepted_at, member_user_id, invite_token')
      .eq('user_id', user.id)
      .order('invited_at', { ascending: true });
    this._teamMembers = (error || !data) ? [] : data;
  },

  renderTeam: async function () {
    const biz = this.state.business || {};
    const owner      = biz.owner || biz.name || 'Propriétaire';
    const ownerEmail = biz.email || (window.KivoAuth && window.KivoAuth.user ? window.KivoAuth.user.email : '');

    // Charger depuis Supabase si le cache est vide
    if (!this._teamMembers || this._teamMembers.length === 0) {
      await this.loadTeamMembers();
    }
    const members = this._teamMembers;
    const activeCount = members.filter(m => m.status === 'active').length;
    const totalSeats  = 1 + members.length; // 1 directeur + membres

    // ── KPIs ────────────────────────────────────────────────────────────────
    const seatsEl = document.getElementById('team-kpi-seats');
    if (seatsEl) seatsEl.innerHTML =
      `${totalSeats} <span style="font-size:1rem;color:var(--text-muted);font-weight:normal;">/ 5 (Plan Business)</span>`;
    const countEl = document.getElementById('team-active-count');
    if (countEl) countEl.textContent = `${1 + activeCount} actif${(1 + activeCount) > 1 ? 's' : ''}`;

    // ── Ligne propriétaire ───────────────────────────────────────────────────
    const ownerAvatarEl = document.getElementById('team-owner-avatar');
    const ownerNameEl   = document.getElementById('team-owner-name');
    const ownerEmailEl  = document.getElementById('team-owner-email');
    const initOwner = owner.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() || 'KM';
    if (ownerAvatarEl) ownerAvatarEl.textContent = initOwner;
    if (ownerNameEl)   ownerNameEl.textContent   = owner;
    if (ownerEmailEl)  ownerEmailEl.textContent  = ownerEmail;

    // ── Tableau des membres ──────────────────────────────────────────────────
    const tbody = document.getElementById('team-members-tbody');
    if (tbody) {
      const ownerRow = tbody.querySelector('tr');
      tbody.innerHTML = '';
      if (ownerRow) tbody.appendChild(ownerRow);

      if (members.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem;font-size:0.9rem;">
          Aucun collaborateur invité pour l'instant.
        </td>`;
        tbody.appendChild(tr);
      } else {
        members.forEach(m => {
          const tr = document.createElement('tr');
          const initials = (m.name || m.email).split(/[ @]/)[0].substring(0, 2).toUpperCase();
          const dateLabel = m.invited_at
            ? new Date(m.invited_at).toLocaleDateString('fr-FR')
            : '—';
          const statusBadge = m.status === 'active'
            ? `<span class="badge badge-paid">Actif</span>`
            : `<span class="badge" style="background:#FFF7ED;color:#C2410C;">En attente</span>`;
          const roleBadge = m.role === 'directeur'
            ? `<span class="badge" style="background:#EEF2FF;color:#4F46E5;">Directeur</span>`
            : `<span class="badge" style="background:#F0FDF4;color:#166534;">Membre</span>`;
          const avatarBg  = m.status === 'active' ? '#F0FDF4' : '#FFF7ED';
          const avatarCol = m.status === 'active' ? '#166534' : '#C2410C';
          tr.innerHTML = `
            <td>
              <div style="display:flex;align-items:center;gap:0.75rem;">
                <div class="avatar" style="width:34px;height:34px;font-size:0.85rem;background:${avatarBg};color:${avatarCol};font-weight:600;">${initials}</div>
                <div>
                  <div style="font-weight:600;color:var(--text-primary);">${m.email}</div>
                  <div style="font-size:0.8rem;color:var(--text-muted);">Invité le ${dateLabel}</div>
                </div>
              </div>
            </td>
            <td>${roleBadge}</td>
            <td>${statusBadge}</td>
            <td style="color:var(--text-muted);font-size:0.85rem;">
              <button class="btn btn-danger btn-sm"
                onclick="KivoApp.confirmRemoveMember('${m.id}', '${m.email}')"
                style="font-size:0.75rem;padding:0.25rem 0.6rem;">Retirer</button>
            </td>`;
          tbody.appendChild(tr);
        });
      }
    }

    // ── Brouillons membres ───────────────────────────────────────────────────
    const memberEmails = members.filter(m => m.status === 'active').map(m => m.email);
    const drafts = (this.state.documents || []).filter(d =>
      d.status === 'draft' && d.memberEmail && memberEmails.includes(d.memberEmail)
    );
    const draftsCard = document.getElementById('team-drafts-card');
    const draftsList = document.getElementById('team-drafts-list');
    if (draftsCard) draftsCard.style.display = drafts.length > 0 ? 'block' : 'none';
    if (draftsList) {
      draftsList.innerHTML = drafts.length === 0
        ? '<span style="color:var(--text-muted);font-size:0.85rem;">Aucun brouillon en cours.</span>'
        : drafts.map(d => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem 0;border-bottom:1px solid var(--border-color);">
            <div>
              <strong>${d.number}</strong> — ${d.clientName || 'Client non défini'}
              <div style="font-size:0.8rem;color:var(--text-muted);">Par ${d.memberEmail}</div>
            </div>
            <span class="badge badge-draft">Brouillon</span>
          </div>`).join('');
    }
  },

  confirmRemoveMember: function (memberId, memberEmail) {
    if (!confirm(`Retirer ${memberEmail} de l'équipe ? Cette action est irréversible.`)) return;
    this.removeMember(memberId);
  },

  removeMember: async function (memberId) {
    const user = window.KivoAuth && window.KivoAuth.user;
    if (!user) return;
    const _kivoClient = window.KivoDb && window.KivoDb.supabase;
    if (!_kivoClient) return;

    const { error } = await _kivoClient
      .from('team_members')
      .delete()
      .eq('id', memberId)
      .eq('user_id', user.id); // RLS double-check

    if (error) {
      this.showToast('Erreur lors de la suppression : ' + (error.message || 'inconnue'), 'error');
      return;
    }
    this.showToast('Membre retiré de l'équipe.', 'info');
    this._teamMembers = this._teamMembers.filter(m => m.id !== memberId);
    this.renderTeam();
  },

  /**
   * Auto-save builder as draft (debounced 1.5s) for collaborative workflows
   * The draft is flagged with status:'draft' and the member's email for Director visibility
   */
  _autoSaveDraftTimer: null,
  scheduleDraftAutoSave: function () {
    clearTimeout(this._autoSaveDraftTimer);
    this._autoSaveDraftTimer = setTimeout(() => {
      const userEmail = window.KivoAuth && window.KivoAuth.user ? window.KivoAuth.user.email : null;
      const role = this.state.business && this.state.business.teamMembers
        ? (this.state.business.teamMembers.find(m => m.email === userEmail) || {}).role
        : 'directeur';
      // Only auto-save members' work as drafts (Directors save explicitly)
      if (role !== 'membre') return;

      const num = (document.getElementById('builder-doc-number') || {}).value;
      if (!num) return;

      const existingId = (document.getElementById('builder-doc-id') || {}).value;
      // Reuse _currentDraftDocId so we never create duplicate rows across auto-saves
      if (!this._currentDraftDocId && !existingId) {
        this._currentDraftDocId = 'draft_' + Date.now();
      }
      const draftDoc = {
        id: existingId || this._currentDraftDocId,
        number: num,
        type: (document.getElementById('builder-doc-type') || {}).value || 'invoice',
        status: 'draft',
        memberEmail: userEmail,
        clientName: (() => {
          const sel = document.getElementById('builder-doc-client-select');
          if (!sel || !sel.value) return (document.getElementById('builder-client-name') || {}).value || '';
          const client = this.state.clients.find(c => c.id === sel.value);
          return client ? client.name : '';
        })(),
        total: (() => {
          const ttcEl = document.getElementById('builder-calc-total');
          return parseFloat((ttcEl ? ttcEl.textContent : '0').replace(/[^0-9.]/g, '')) || 0;
        })(),
        issueDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString()
      };

      const idx = this.state.documents.findIndex(d => d.id === draftDoc.id);
      if (idx !== -1) {
        this.state.documents[idx] = { ...this.state.documents[idx], ...draftDoc };
      } else {
        this.state.documents.unshift(draftDoc);
      }
      this.saveState();
    }, 1500);
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
    const tabLogin = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');
    const formLogin = document.getElementById('auth-form-login');
    const formRegister = document.getElementById('auth-form-register');
    const formForgot = document.getElementById('auth-form-forgot');
    const tabsBar = document.getElementById('auth-tabs-bar');
    const googleBtn = document.getElementById('auth-google-btn');
    const divider = document.getElementById('auth-divider');
    const msgBox = document.getElementById('auth-status-message');

    // Reset status message
    if (msgBox) {
      msgBox.style.display = 'none';
      msgBox.innerHTML = '';
    }

    if (tab === 'forgot') {
      if (tabLogin) tabLogin.classList.remove('active-pill');
      if (tabRegister) tabRegister.classList.remove('active-pill');
      if (tabsBar) tabsBar.style.display = 'none';
      if (googleBtn) googleBtn.style.display = 'none';
      if (divider) divider.style.display = 'none';
      if (formLogin) formLogin.style.display = 'none';
      if (formRegister) formRegister.style.display = 'none';
      if (formForgot) {
        formForgot.style.display = 'block';
        const loginEmail = document.getElementById('auth-login-email')?.value?.trim();
        const forgotEmail = document.getElementById('auth-forgot-email');
        if (forgotEmail) {
          if (loginEmail) forgotEmail.value = loginEmail;
          setTimeout(() => forgotEmail.focus(), 60);
        }
      }
      return;
    }

    // Regular tabs: login or register
    if (tabsBar) tabsBar.style.display = 'flex';
    if (googleBtn) googleBtn.style.display = 'flex';
    if (divider) divider.style.display = 'flex';
    if (formForgot) formForgot.style.display = 'none';

    if (tab === 'register') {
      if (tabLogin) tabLogin.classList.remove('active-pill');
      if (tabRegister) tabRegister.classList.add('active-pill');
      if (formLogin) formLogin.style.display = 'none';
      if (formRegister) formRegister.style.display = 'block';
    } else {
      if (tabLogin) tabLogin.classList.add('active-pill');
      if (tabRegister) tabRegister.classList.remove('active-pill');
      if (formLogin) formLogin.style.display = 'block';
      if (formRegister) formRegister.style.display = 'none';
    }
  },

  /**
   * Display inline message inside the unified auth card
   */
  showAuthMessage: function (msg, type = 'error') {
    const isError = (type === 'error' || type === 'danger');
    const safeMsg = isError ? this.friendlySupabaseError(msg, typeof msg === 'string' ? msg : "Une erreur est survenue.") : msg;
    const box = document.getElementById('auth-status-message');
    if (box) {
      box.style.display = 'block';
      box.style.padding = '0.85rem 1rem';
      box.style.marginBottom = '1.25rem';
      box.style.borderRadius = 'var(--radius-md)';
      box.style.fontSize = '0.875rem';
      box.style.lineHeight = '1.4';
      box.style.textAlign = 'center';
      if (isError) {
        box.style.background = 'rgba(239, 68, 68, 0.08)';
        box.style.border = '1px solid rgba(239, 68, 68, 0.25)';
        box.style.color = 'var(--danger-text, #DC2626)';
      } else {
        box.style.background = 'rgba(16, 185, 129, 0.08)';
        box.style.border = '1px solid rgba(16, 185, 129, 0.25)';
        box.style.color = '#059669';
      }
      box.textContent = safeMsg;
    }
    this.showToast(safeMsg, type);
  },

  /**
   * Google OAuth via Supabase — initiates real Google sign-in
   */
  signInWithGoogle: async function () {
    if (window.KivoAuth && typeof window.KivoAuth.signInWithGoogle === 'function') {
      const res = await window.KivoAuth.signInWithGoogle();
      if (res && res.error) {
        this.showAuthMessage("Connexion Google impossible. Veuillez réessayer ou utiliser un autre mode de connexion.", "error");
        console.error('[KivoApp] Google sign-in error:', res.error);
      }
    } else {
      this.showAuthMessage("Le service de connexion Google n'est pas disponible.", "error");
    }
  },

  /**
   * Alias for backwards compatibility
   */
  simulateGoogleAuth: function () {
    return this.signInWithGoogle();
  },

  /**
   * Login via unified view-auth form
   */
  submitLogin: async function () {
    const email = document.getElementById('auth-login-email')?.value?.trim();
    const pwd = document.getElementById('auth-login-password')?.value;

    if (!email || !pwd) {
      this.showAuthMessage("Veuillez saisir votre adresse email et votre mot de passe.", "error");
      return;
    }

    const btn = document.querySelector('#auth-form-login button[type=submit]');
    const originalText = btn ? btn.textContent : 'Se connecter';
    if (btn) { btn.disabled = true; btn.textContent = 'Connexion en cours...'; }

    const result = await KivoAuth.signIn(email, pwd);

    if (btn) { btn.disabled = false; btn.textContent = originalText; }

    if (result.error) {
      this.showAuthMessage(this.friendlySupabaseError(result.error, "Email ou mot de passe incorrect."), "error");
    }
    // On success, onAuthStateChange fires and handlePostLogin() runs automatically
  },

  /**
   * Register via unified view-auth form
   */
  submitRegister: async function () {
    const name = document.getElementById('auth-reg-name')?.value?.trim();
    const email = document.getElementById('auth-reg-email')?.value?.trim();
    const pwd = document.getElementById('auth-reg-password')?.value;
    const pwd2 = document.getElementById('auth-reg-password2') ? document.getElementById('auth-reg-password2').value : pwd;

    if (!name || !email || !pwd) {
      this.showAuthMessage("Veuillez remplir tous les champs obligatoires.", "error");
      return;
    }

    if (pwd.length < 6) {
      this.showAuthMessage("Le mot de passe doit comporter au moins 6 caractères.", "error");
      return;
    }

    if (pwd !== pwd2) {
      this.showAuthMessage("Les mots de passe ne correspondent pas.", "error");
      return;
    }

    const btn = document.querySelector('#auth-form-register button[type=submit]');
    const originalText = btn ? btn.textContent : 'Créer mon compte';
    if (btn) { btn.disabled = true; btn.textContent = 'Création en cours...'; }

    const result = await KivoAuth.signUp(email, pwd, name);

    if (btn) { btn.disabled = false; btn.textContent = originalText; }

    if (result.error) {
      this.showAuthMessage(this.friendlySupabaseError(result.error, "Erreur lors de la création du compte."), "error");
    } else {
      this.state.userEmail = email;
      this.state.business.owner = name;
      this.state.business.email = email;
      this.saveState();

      const needsConfirmation = !result.data?.session;
      if (needsConfirmation) {
        this.showAuthMessage("Compte créé avec succès ! Un email de confirmation vous a été envoyé. Cliquez sur le lien pour valider votre inscription, puis connectez-vous.", "success");
      } else {
        this.showAuthMessage("Compte créé avec succès ! Redirection en cours...", "success");
        setTimeout(() => this.navigate('onboarding'), 800);
      }
    }
  },

  /**
   * Submit inline forgot password form (no native prompt)
   */
  submitForgotPassword: async function () {
    const emailInput = document.getElementById('auth-forgot-email');
    const email = emailInput?.value?.trim() || '';

    if (!email) {
      this.showAuthMessage("Veuillez saisir votre adresse email.", "error");
      return;
    }

    if (!window.KivoDb || !window.KivoDb.supabase) {
      this.showAuthMessage("Service d'authentification indisponible. Réessayez plus tard.", "error");
      return;
    }

    const btn = document.getElementById('btn-submit-forgot');
    const originalText = btn ? btn.textContent : 'Envoyer le lien';
    if (btn) { btn.disabled = true; btn.textContent = 'Envoi en cours...'; }

    try {
      const { error } = await KivoDb.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
      });

      if (error) {
        console.error('[KivoApp] resetPasswordForEmail error:', error);
        this.showAuthMessage(this.friendlySupabaseError(error, "Impossible d'envoyer l'email de réinitialisation."), "error");
      } else {
        this.showAuthMessage("Lien de réinitialisation envoyé ! Vérifiez votre boîte de réception (et vos spams).", "success");
        if (emailInput) emailInput.value = '';
      }
    } catch (e) {
      console.error('[KivoApp] submitForgotPassword exception:', e);
      this.showAuthMessage("Une erreur inattendue est survenue. Veuillez réessayer.", "error");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = originalText; }
    }
  },

  /**
   * Helper switching to forgot password form
   */
  handleForgotPassword: function () {
    this.switchAuthTab('forgot');
  },

  /**
   * Afficher / masquer un mot de passe
   */
  togglePasswordVisibility: function (inputId, btnId) {
    const input = document.getElementById(inputId);
    const btn = document.getElementById(btnId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    if (btn) {
      btn.innerHTML = isPassword
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    }
  },

  /**
   * Évaluation en direct de la force du mot de passe
   */
  checkResetPasswordStrength: function (pwd) {
    const p = pwd || '';
    const hasLen = p.length >= 8;
    const hasDigit = /[0-9]/.test(p);
    const hasUpper = /[A-Z]/.test(p);

    const updateRule = (id, valid) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.color = valid ? '#10B981' : 'var(--text-muted)';
      const icon = el.querySelector('.pwd-rule-icon');
      if (icon) icon.textContent = valid ? '✅' : '⚪';
    };

    updateRule('pwd-rule-len', hasLen);
    updateRule('pwd-rule-digit', hasDigit);
    updateRule('pwd-rule-upper', hasUpper);

    const score = (hasLen ? 1 : 0) + (hasDigit ? 1 : 0) + (hasUpper ? 1 : 0);
    const b1 = document.getElementById('pwd-strength-bar-1');
    const b2 = document.getElementById('pwd-strength-bar-2');
    const b3 = document.getElementById('pwd-strength-bar-3');
    const label = document.getElementById('pwd-strength-label');

    const colors = {
      empty: '#E2E8F0',
      red: '#EF4444',
      yellow: '#F59E0B',
      green: '#10B981'
    };

    if (score === 0) {
      if (b1) b1.style.background = colors.empty;
      if (b2) b2.style.background = colors.empty;
      if (b3) b3.style.background = colors.empty;
      if (label) { label.textContent = 'Non renseigné'; label.style.color = 'var(--text-muted)'; }
    } else if (score === 1) {
      if (b1) b1.style.background = colors.red;
      if (b2) b2.style.background = colors.empty;
      if (b3) b3.style.background = colors.empty;
      if (label) { label.textContent = 'Faible'; label.style.color = colors.red; }
    } else if (score === 2) {
      if (b1) b1.style.background = colors.yellow;
      if (b2) b2.style.background = colors.yellow;
      if (b3) b3.style.background = colors.empty;
      if (label) { label.textContent = 'Moyen'; label.style.color = colors.yellow; }
    } else {
      if (b1) b1.style.background = colors.green;
      if (b2) b2.style.background = colors.green;
      if (b3) b3.style.background = colors.green;
      if (label) { label.textContent = 'Fort & Sécurisé'; label.style.color = colors.green; }
    }

    this.checkResetPasswordMatch();
  },

  /**
   * Vérifie la concordance des deux mots de passe
   */
  checkResetPasswordMatch: function () {
    const p1 = document.getElementById('reset-new-password')?.value || '';
    const p2 = document.getElementById('reset-confirm-password')?.value || '';
    const matchEl = document.getElementById('pwd-match-indicator');
    if (!matchEl) return;

    if (!p2) {
      matchEl.style.display = 'none';
      return;
    }

    matchEl.style.display = 'block';
    if (p1 === p2) {
      matchEl.style.color = '#10B981';
      matchEl.textContent = '✓ Les mots de passe correspondent.';
    } else {
      matchEl.style.color = '#EF4444';
      matchEl.textContent = '✗ Les mots de passe ne correspondent pas.';
    }
  },

  /**
   * Affichage de la vue de saisie du nouveau mot de passe
   */
  showResetPasswordView: function () {
    // Hide all view sections
    document.querySelectorAll('.view-section').forEach(sec => sec.style.display = 'none');

    const resetSec = document.getElementById('view-reset-password');
    if (resetSec) {
      resetSec.style.display = 'block';
      const newPwdInput = document.getElementById('reset-new-password');
      if (newPwdInput) {
        newPwdInput.value = '';
        newPwdInput.focus();
      }
      const confirmPwdInput = document.getElementById('reset-confirm-password');
      if (confirmPwdInput) confirmPwdInput.value = '';
      const msgEl = document.getElementById('reset-password-msg');
      if (msgEl) msgEl.style.display = 'none';
      this.checkResetPasswordStrength('');
    }
  },

  /**
   * Validation et soumission du nouveau mot de passe
   */
  submitPasswordReset: async function () {
    const p1 = document.getElementById('reset-new-password')?.value || '';
    const p2 = document.getElementById('reset-confirm-password')?.value || '';
    const msgEl = document.getElementById('reset-password-msg');

    if (p1.length < 8) {
      this.showToast(this._t('toast_password_too_short'), "error");
      return;
    }
    if (!/[0-9]/.test(p1)) {
      this.showToast(this._t('toast_password_no_digit'), "error");
      return;
    }
    if (!/[A-Z]/.test(p1)) {
      this.showToast(this._t('toast_password_no_upper'), "error");
      return;
    }
    if (p1 !== p2) {
      this.showToast(this._t('toast_password_mismatch'), "error");
      return;
    }

    const btn = document.getElementById('btn-reset-password-submit');
    if (btn) { btn.disabled = true; btn.textContent = "Enregistrement en cours..."; }

    try {
      if (window.KivoDb && window.KivoDb.supabase) {
        const { error } = await KivoDb.supabase.auth.updateUser({ password: p1 });
        if (error) {
          console.error('[KivoApp] updateUser password error:', error);
          const friendlyMsg = this.friendlySupabaseError(error, "Une erreur est survenue lors de la mise à jour du mot de passe.");
          this.showToast(friendlyMsg, "error");
          if (msgEl) {
            msgEl.style.display = 'block';
            msgEl.style.background = '#FEF2F2';
            msgEl.style.border = '1px solid #FCA5A5';
            msgEl.style.color = '#B91C1C';
            msgEl.textContent = friendlyMsg;
          }
          return;
        }
      }

      this.showToast(this._t('toast_password_updated'), "success");
      if (msgEl) {
        msgEl.style.display = 'block';
        msgEl.style.background = '#ECFDF5';
        msgEl.style.border = '1px solid #6EE7B7';
        msgEl.style.color = '#047857';
        msgEl.textContent = "✓ Mot de passe réinitialisé avec succès ! Redirection vers votre tableau de bord dans 2 secondes...";
      }

      // Redirection automatique vers le dashboard après 2 secondes
      setTimeout(() => {
        const resetSec = document.getElementById('view-reset-password');
        if (resetSec) resetSec.style.display = 'none';
        this.navigate('dashboard');
      }, 2000);

    } catch (err) {
      console.error('[KivoApp] submitPasswordReset exception:', err);
      this.showToast(this._t('toast_password_update_error'), "error");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Enregistrer le nouveau mot de passe"; }
    }
  },

  // --- Legacy compat (kept for references elsewhere) ---
  onCountrySelectChange: function () { /* superseded by wizardOnCountryChange */ },
  fillDemoOnboardingData: function () { this.prefillOnboardingWithAuthUser(window.KivoAuth?.user || null); },
  selectedOnboardPlan: 'Gratuit',
  selectOnboardingPlan: function (tier) { this.selectedOnboardPlan = tier; },
  completeOnboarding: async function () { await this.wizardFinish(); },

  // ─── ONBOARDING WIZARD ENGINE ─────────────────────────────────────────────

  /**
   * Initializes wizard state. Called when navigating to onboarding view.
   * Steps 1-11 map to wz-step-1 through wz-step-11.
   * Step 9 (company number) is skipped for Independant profiles.
   */
  _getWizardStorageKey: function () {
    const userId = window.KivoAuth?.user?.id || this.state?.userEmail || 'guest';
    return `kivo_wizard_progress_${userId}`;
  },

  /**
   * Persists the current wizard step and partial answers to localStorage and Supabase.
   * Runs non-blockingly at every step change.
   */
  _wizardPersistProgress: async function () {
    const w = this._wizard;
    if (!w || w.step >= 11) return;
    const progressData = {
      step: w.step,
      data: JSON.parse(JSON.stringify(w.data)),
      updatedAt: new Date().toISOString()
    };

    // 1. Immediate synchronous localStorage backup
    try {
      localStorage.setItem(this._getWizardStorageKey(), JSON.stringify(progressData));
      localStorage.setItem('kivo_wizard_progress_latest', JSON.stringify(progressData));
    } catch (e) {
      console.warn('[KivoWizard] localStorage save error:', e);
    }

    // 2. Cloud backup in Supabase if user is authenticated
    if (window.KivoDb && this.supabaseConnected && window.KivoAuth?.user) {
      try {
        await window.KivoDb.saveSettings({
          company_name: w.data.bizName || '',
          owner: w.data.owner || '',
          email: w.data.email || '',
          phone: `${w.data.phonePrefix || '+221'} ${w.data.phone || ''}`.trim(),
          industry: w.data.industry || 'Prestations de services',
          country: w.data.country || 'Senegal',
          currency: w.data.currency || 'FCFA',
          fiscal_id: w.data.taxId || '',
          current_plan: 'Gratuit',
          onboarding_completed: false,
          onboarding_answers: progressData
        });
        console.log(`[KivoWizard] Cloud progress saved at step ${w.step}.`);
      } catch (cloudErr) {
        console.warn('[KivoWizard] Non-blocking cloud progress save warning:', cloudErr);
      }
    }
  },

  /**
   * Retrieves any existing in-progress wizard state from cloud or localStorage
   */
  _wizardGetSavedProgress: function () {
    // 1. Cloud progress loaded by syncFromSupabase
    if (this._cloudWizardProgress && this._cloudWizardProgress.step && this._cloudWizardProgress.step > 1) {
      return this._cloudWizardProgress;
    }
    // 2. User-scoped localStorage
    try {
      const userScoped = localStorage.getItem(this._getWizardStorageKey());
      if (userScoped) {
        const parsed = JSON.parse(userScoped);
        if (parsed && parsed.step && parsed.step > 1) return parsed;
      }
      const generic = localStorage.getItem('kivo_wizard_progress_latest');
      if (generic) {
        const parsed = JSON.parse(generic);
        if (parsed && parsed.step && parsed.step > 1) return parsed;
      }
    } catch (e) {
      console.warn('[KivoWizard] Error parsing saved progress:', e);
    }
    return null;
  },

  /**
   * Applies restored wizard data to DOM inputs
   */
  _applyWizardDataToForm: function () {
    const w = this._wizard;
    if (!w) return;
    const d = w.data;
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null) el.value = val;
    };

    setVal('wz-biz-name', d.bizName);
    setVal('wz-owner', d.owner);
    setVal('wz-industry', d.industry);
    setVal('wz-country', d.country);
    setVal('wz-phone-prefix', d.phonePrefix);
    setVal('wz-phone', d.phone);
    setVal('wz-currency', d.currency);
    setVal('wz-email', d.email);
    setVal('wz-taxid', d.taxId);
    setVal('wz-volume', d.volume || '6-20');

    if (d.profileType) {
      this.wizardSelectType(d.profileType, false); // false = don't persist on populate
    }

    if (Array.isArray(d.goals)) {
      ['wz-goal-invoices', 'wz-goal-quotes', 'wz-goal-clients', 'wz-goal-stats', 'wz-goal-other'].forEach(id => {
        const cb = document.getElementById(id);
        if (cb) cb.checked = d.goals.includes(cb.value);
      });
    }
  },

  /**
   * Displays an unobtrusive banner when progress is resumed with a reset link
   */
  _renderResumeBanner: function (visible, step = 1) {
    let banner = document.getElementById('wz-resume-banner');
    if (!banner) {
      const card = document.querySelector('#view-onboarding .wz-step')?.parentElement;
      if (card) {
        banner = document.createElement('div');
        banner.id = 'wz-resume-banner';
        card.insertBefore(banner, card.firstChild);
      }
    }
    if (!banner) return;

    if (!visible || step <= 1 || step >= 11) {
      banner.style.display = 'none';
      return;
    }

    banner.style.display = 'flex';
    banner.style.alignItems = 'center';
    banner.style.justifyContent = 'space-between';
    banner.style.gap = '0.75rem';
    banner.style.padding = '0.65rem 0.95rem';
    banner.style.marginBottom = '1.25rem';
    banner.style.background = 'rgba(37, 99, 235, 0.08)';
    banner.style.border = '1px solid rgba(37, 99, 235, 0.25)';
    banner.style.borderRadius = 'var(--radius-md)';
    banner.style.fontSize = '0.82rem';
    banner.style.color = 'var(--text-primary)';

    banner.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <span style="font-size:1.1rem; line-height:1;">🔄</span>
        <span>Progression reprise (<strong>Étape ${step} sur 11</strong>)</span>
      </div>
      <button type="button" onclick="KivoApp.wizardInit(true)" style="background:none; border:none; color:var(--primary); font-weight:600; text-decoration:underline; cursor:pointer; font-size:0.8rem; padding:0;">
        Recommencer
      </button>
    `;
  },

  /**
   * Initializes wizard state. Called when navigating to onboarding view.
   * Auto-restores saved progress from cloud or localStorage if present.
   */
  wizardInit: function (forceReset = false) {
    const authUser = window.KivoAuth?.user;
    const metaName = authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || '';
    const defOwner = metaName || (authUser?.email ? authUser.email.split('@')[0] : '') || '';
    const defEmail = authUser?.email || '';

    this._wizard = {
      step: 1,
      totalSteps: 11,
      data: {
        profileType: null,   // 'Entreprise' | 'Independant'
        bizName: '',
        owner: defOwner,
        industry: 'Prestations de services',
        country: 'Senegal',
        phonePrefix: '+221',
        phone: '',
        currency: 'FCFA',
        email: defEmail,
        taxId: '',
        goals: [],
        volume: '6-20'
      }
    };

    if (forceReset) {
      try {
        localStorage.removeItem(this._getWizardStorageKey());
        localStorage.removeItem('kivo_wizard_progress_latest');
        this._cloudWizardProgress = null;
      } catch (_) {}
      this._applyWizardDataToForm();
      this._wizardRender();
      this._renderResumeBanner(false);
      this.showToast(this._t('toast_wizard_reset'), 'info');
      return;
    }

    // Check for previous progress to restore
    const saved = this._wizardGetSavedProgress();
    if (saved && saved.step && saved.step > 1 && saved.step <= 10) {
      console.log(`[KivoWizard] Restoring saved progress at step ${saved.step}`, saved.data);
      if (saved.data) {
        this._wizard.data = { ...this._wizard.data, ...saved.data };
      }
      this._wizard.step = saved.step;
      this._applyWizardDataToForm();
      this._wizardRender();
      this._renderResumeBanner(true, saved.step);
      return;
    }

    this._applyWizardDataToForm();
    this._wizardRender();
    this._renderResumeBanner(false);
  },

  /** Returns the ordered list of visible step numbers based on wizard data */
  _wizardSteps: function () {
    const w = this._wizard;
    const base = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11];
    if (!w || !w.data.profileType || w.data.profileType === 'Entreprise') {
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    }
    return base;
  },

  /** Updates progress bar and labels */
  _wizardRender: function () {
    const w = this._wizard;
    if (!w) return;
    const steps = this._wizardSteps();
    const idx = steps.indexOf(w.step);
    const position = idx + 1;
    const total = steps.length;
    const pct = Math.round(((position - 1) / (total - 1)) * 100) || 0;

    const labelEl = document.getElementById('wizard-step-label');
    const pctEl = document.getElementById('wizard-pct-label');
    const fillEl = document.getElementById('wizard-progress-fill');
    if (labelEl) labelEl.textContent = `Etape ${position} sur ${total}`;
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (fillEl) fillEl.style.width = `${pct}%`;

    // Show/hide step panels
    for (let i = 1; i <= 11; i++) {
      const el = document.getElementById(`wz-step-${i}`);
      if (el) el.style.display = (i === w.step) ? '' : 'none';
    }

    // Navigation buttons
    const backBtn = document.getElementById('wz-btn-back');
    const nextBtn = document.getElementById('wz-btn-next');
    const skipBtn = document.getElementById('wz-btn-skip');
    const skipAllWrap = document.getElementById('wizard-skip-all-wrap');
    const nextLabel = document.getElementById('wz-btn-next-label');

    if (backBtn) backBtn.style.display = (idx > 0 && w.step !== 11) ? '' : 'none';
    if (nextBtn) nextBtn.style.display = (w.step !== 11) ? 'flex' : 'none';
    if (skipBtn) skipBtn.style.display = (w.step > 1 && w.step !== 11) ? '' : 'none';
    if (skipAllWrap) skipAllWrap.style.display = (w.step !== 11) ? 'block' : 'none';
    if (nextLabel) {
      if (w.step === 10) nextLabel.textContent = 'Finaliser';
      else nextLabel.textContent = 'Suivant';
    }

    // Pre-fill email on step 8
    if (w.step === 8) {
      const wzEmail = document.getElementById('wz-email');
      if (wzEmail && !wzEmail.value) {
        const authUser = window.KivoAuth?.user;
        if (authUser) wzEmail.value = authUser.email || '';
      }
    }
  },

  /** Validates the current step; returns true if OK */
  _wizardValidate: function () {
    const w = this._wizard;
    if (!w) return true;
    ['wz-err-1','wz-err-3','wz-err-6','wz-err-8'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    if (w.step === 1) {
      if (!w.data.profileType) {
        const err = document.getElementById('wz-err-1');
        if (err) err.style.display = '';
        return false;
      }
    }
    if (w.step === 3) {
      const v = (document.getElementById('wz-owner')?.value || '').trim();
      if (!v) {
        const err = document.getElementById('wz-err-3');
        if (err) err.style.display = '';
        return false;
      }
    }
    if (w.step === 6) {
      const v = (document.getElementById('wz-phone')?.value || '').trim();
      if (!v) {
        const err = document.getElementById('wz-err-6');
        if (err) err.style.display = '';
        return false;
      }
    }
    if (w.step === 8) {
      const v = (document.getElementById('wz-email')?.value || '').trim();
      if (!v || !v.includes('@')) {
        const err = document.getElementById('wz-err-8');
        if (err) err.style.display = '';
        return false;
      }
    }
    return true;
  },

  /** Saves current step fields into wizard data */
  _wizardSave: function () {
    const w = this._wizard;
    if (!w) return;
    const g = (id) => document.getElementById(id);
    if (w.step === 2) w.data.bizName = g('wz-biz-name')?.value.trim() || '';
    if (w.step === 3) w.data.owner = g('wz-owner')?.value.trim() || '';
    if (w.step === 4) w.data.industry = g('wz-industry')?.value || '';
    if (w.step === 5) w.data.country = g('wz-country')?.value || '';
    if (w.step === 6) {
      w.data.phonePrefix = g('wz-phone-prefix')?.value || '+221';
      w.data.phone = g('wz-phone')?.value.trim() || '';
    }
    if (w.step === 7) w.data.currency = g('wz-currency')?.value || 'FCFA';
    if (w.step === 8) w.data.email = g('wz-email')?.value.trim() || '';
    if (w.step === 9) w.data.taxId = g('wz-taxid')?.value.trim() || '';
    if (w.step === 10) {
      w.data.goals = ['wz-goal-invoices','wz-goal-quotes','wz-goal-clients','wz-goal-stats','wz-goal-other']
        .filter(id => g(id)?.checked)
        .map(id => g(id).value);
      w.data.volume = g('wz-volume')?.value || '6-20';
    }
  },

  /** Advance to the next step */
  wizardNext: function () {
    if (!this._wizard) this.wizardInit();
    if (!this._wizardValidate()) return;
    this._wizardSave();
    const steps = this._wizardSteps();
    const idx = steps.indexOf(this._wizard.step);
    if (idx < steps.length - 1) {
      this._wizard.step = steps[idx + 1];
      if (this._wizard.step === 11) {
        this._wizardCommit();
        return;
      }
      this._wizardPersistProgress();
      this._wizardRender();
    }
  },

  /** Go back one step */
  wizardBack: function () {
    if (!this._wizard) return;
    const steps = this._wizardSteps();
    const idx = steps.indexOf(this._wizard.step);
    if (idx > 0) {
      this._wizard.step = steps[idx - 1];
      this._wizardPersistProgress();
      this._wizardRender();
    }
  },

  /** Skip current step */
  wizardSkip: function () {
    if (!this._wizard) return;
    this._wizardSave();
    const steps = this._wizardSteps();
    const idx = steps.indexOf(this._wizard.step);
    if (idx < steps.length - 1) {
      this._wizard.step = steps[idx + 1];
      if (this._wizard.step === 11) {
        this._wizardCommit();
        return;
      }
      this._wizardPersistProgress();
      this._wizardRender();
    }
  },

  /** Skip entire onboarding and launch dashboard immediately with clean defaults */
  wizardSkipAll: async function () {
    if (!this._wizard) this.wizardInit();
    const w = this._wizard;
    const authUser = window.KivoAuth?.user;
    const metaName = authUser?.user_metadata?.full_name || authUser?.user_metadata?.name || '';
    const defOwner = metaName || (authUser?.email ? authUser.email.split('@')[0] : '') || 'Utilisateur';

    if (!w.data.profileType) w.data.profileType = 'Indépendant';
    if (!w.data.owner) w.data.owner = defOwner;
    if (!w.data.bizName) w.data.bizName = w.data.owner ? `${w.data.owner} Studio` : 'Mon Entreprise';
    if (!w.data.email) w.data.email = authUser?.email || '';
    if (!w.data.country) w.data.country = 'Sénégal';
    if (!w.data.currency) w.data.currency = 'FCFA';

    await this._wizardCommit();
    this.wizardFinish();
  },

  /** Handle profile type card selection */
  wizardSelectType: function (type, persist = true) {
    if (!this._wizard) this.wizardInit();
    this._wizard.data.profileType = type;

    // Style cards
    ['wz-type-entreprise', 'wz-type-independant'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.style.borderColor = 'var(--border-color, #E2E8F0)';
        el.style.background = 'var(--bg-card, #FFFFFF)';
        el.style.boxShadow = 'none';
        el.style.transform = 'none';
        const check = el.querySelector('.wz-card-check');
        if (check) check.style.display = 'none';
      }
    });

    const activeId = type === 'Entreprise' ? 'wz-type-entreprise' : 'wz-type-independant';
    const activeEl = document.getElementById(activeId);
    if (activeEl) {
      activeEl.style.borderColor = 'var(--primary, #4F46E5)';
      activeEl.style.background = 'rgba(79, 70, 229, 0.08)';
      activeEl.style.boxShadow = '0 6px 16px rgba(79, 70, 229, 0.16)';
      activeEl.style.transform = 'translateY(-2px)';
      const check = activeEl.querySelector('.wz-card-check');
      if (check) check.style.display = 'flex';
    }

    const err = document.getElementById('wz-err-1');
    if (err) err.style.display = 'none';

    if (persist) {
      this._wizardPersistProgress();
    }
  },

  /** Visual toggle for wizard goal checkboxes */
  toggleGoalCheckboxStyle: function (cb) {
    const parent = cb.closest('.wz-goal-card');
    if (!parent) return;
    if (cb.checked) {
      parent.style.borderColor = 'var(--primary, #4F46E5)';
      parent.style.background = 'rgba(79, 70, 229, 0.06)';
      parent.style.boxShadow = '0 2px 8px rgba(79, 70, 229, 0.12)';
    } else {
      parent.style.borderColor = 'var(--border-color, #E2E8F0)';
      parent.style.background = 'transparent';
      parent.style.boxShadow = 'none';
    }
  },

  /** Update phone prefix and currency when country changes in wizard */
  wizardOnCountryChange: function () {
    const select = document.getElementById('wz-country');
    if (!select) return;
    const opt = select.options[select.selectedIndex];
    if (!opt) return;
    const code = opt.getAttribute('data-code');
    const curr = opt.getAttribute('data-currency');
    if (code) {
      const prefixSel = document.getElementById('wz-phone-prefix');
      if (prefixSel) {
        prefixSel.value = code;
        if (prefixSel.value !== code) {
          const o = document.createElement('option');
          o.value = code; o.textContent = code;
          prefixSel.appendChild(o);
          prefixSel.value = code;
        }
      }
      const wzPhone = document.getElementById('wz-phone');
      if (wzPhone && wzPhone.value) {
        this.formatPhoneInput(wzPhone, code);
      }
    }
    if (curr) {
      const currSel = document.getElementById('wz-currency');
      if (currSel) currSel.value = curr;
    }
  },

  /**
   * Commits wizard data to Supabase + state, then renders step 11 (completion screen).
   * Called after step 10 validation.
   */
  _wizardCommit: async function () {
    const w = this._wizard;
    if (!w) return;
    const d = w.data;
    const bizName = d.bizName || '';
    const bizOwner = d.owner || '';
    const fullPhone = `${d.phonePrefix} ${d.phone}`.trim();

    if (!this.state) this.state = JSON.parse(JSON.stringify(this.BLANK_STATE));
    if (!this.state.business) this.state.business = JSON.parse(JSON.stringify(this.BLANK_STATE.business));

    const biz = this.state.business;
    biz.name = bizName || bizOwner || 'Mon Entreprise';
    biz.owner = bizOwner;
    biz.industry = d.industry;
    biz.country = d.country;
    biz.currency = d.currency;
    biz.phone = fullPhone;
    biz.email = d.email;
    biz.taxId = d.taxId;
    biz.subscriptionTier = 'Gratuit';
    biz.subscriptionStatus = 'active';

    if (bizName) {
      const words = bizName.split(' ').filter(w => w.length > 0);
      biz.logoText = words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : bizName.substring(0, 2).toUpperCase();
    } else if (bizOwner) {
      biz.logoText = bizOwner.substring(0, 2).toUpperCase();
    }

    this.state.isOnboarded = true;
    this.saveState();
    this.updateUserBrandingUI();

    if (window.KivoDb && this.supabaseConnected) {
      try {
        await window.KivoDb.saveSettings({
          company_name: bizName,
          owner: bizOwner,
          email: d.email,
          phone: fullPhone,
          industry: d.industry,
          country: d.country,
          currency: d.currency,
          fiscal_id: d.taxId,
          current_plan: 'Gratuit',
          onboarding_completed: true,
          onboarding_answers: { step: 11, data: d, completedAt: new Date().toISOString() },
          invoice_prefix: biz.invoicePrefix || 'FAC-2026-',
          quote_prefix: biz.quotePrefix || 'DEV-2026-',
          default_vat_rate: biz.defaultVatRate !== undefined ? biz.defaultVatRate : 0,
          logo_url: biz.logoUrl || '',
          visual_template: biz.visualTemplate || 'classic',
          primary_color: biz.primaryColor || '#4F46E5',
          secondary_color: biz.secondaryColor || '#7C3AED'
        });
        console.log('[KivoWizard] Completed onboarding settings saved to Supabase.');
      } catch (e) {
        console.error('[KivoWizard] Supabase save error:', e);
      }
    }

    // Clean up in-progress cache
    try {
      localStorage.removeItem(this._getWizardStorageKey());
      localStorage.removeItem('kivo_wizard_progress_latest');
      this._cloudWizardProgress = null;
    } catch (_) {}

    // Show completion screen (step 11)
    w.step = 11;
    this._renderResumeBanner(false);
    const readyMsg = document.getElementById('wz-ready-msg');
    if (readyMsg) readyMsg.textContent = `Bienvenue, ${bizOwner || bizName || 'sur KIVO MATIQUE'} ! Votre espace est configuré.`;
    this._wizardRender();
  },

  /** Final button on step 11: navigate to dashboard */
  wizardFinish: function () {
    this.showToast(this._t('toast_workspace_ready'), 'success');
    this.navigate('dashboard');
  },

  switchSubscriptionTier: function (tier) {
    this.state.business.subscriptionTier = tier;
    this.state.business.subscriptionStatus = 'active';
    this.saveState();
    this.renderSettings();
    this.showToast(this._t('toast_plan_activated').replace('{plan}', tier), "success");
  },

  renderSettings: function () {
    const biz = this.state.business;
    if (document.getElementById('setting-biz-name')) document.getElementById('setting-biz-name').value = biz.name || '';
    if (document.getElementById('setting-biz-owner')) document.getElementById('setting-biz-owner').value = biz.owner || '';
    
    // Parse biz.phone into prefix + local number
    const phoneInput = document.getElementById('setting-biz-phone');
    const prefixSel = document.getElementById('setting-biz-phone-prefix');
    if (phoneInput) {
      if (prefixSel) {
        const parsed = this.parsePhoneAndPrefix(biz.phone || '');
        prefixSel.value = parsed.prefix;
        phoneInput.value = this.formatPhoneNumber(parsed.number, parsed.prefix);
      } else {
        phoneInput.value = biz.phone || '';
      }
    }
    this.setupPhoneInputs();
    if (document.getElementById('setting-biz-email')) document.getElementById('setting-biz-email').value = biz.email || '';
    if (document.getElementById('setting-biz-pro-email')) document.getElementById('setting-biz-pro-email').value = biz.proEmail || biz.email || '';
    if (document.getElementById('setting-biz-website')) document.getElementById('setting-biz-website').value = biz.website || '';
    if (document.getElementById('setting-biz-address')) document.getElementById('setting-biz-address').value = biz.address || '';
    if (document.getElementById('setting-biz-taxid')) document.getElementById('setting-biz-taxid').value = biz.taxId || '';
    if (document.getElementById('setting-biz-currency')) document.getElementById('setting-biz-currency').value = biz.currency || 'FCFA';
    if (document.getElementById('setting-biz-prefix')) document.getElementById('setting-biz-prefix').value = biz.invoicePrefix || "FAC-2026-";
    if (document.getElementById('setting-biz-quote-prefix')) document.getElementById('setting-biz-quote-prefix').value = biz.quotePrefix || "DEV-2026-";
    if (document.getElementById('setting-biz-vat')) document.getElementById('setting-biz-vat').value = biz.defaultVatRate !== undefined ? biz.defaultVatRate : 0;
    if (document.getElementById('setting-biz-language')) document.getElementById('setting-biz-language').value = this.state.language || "fr";

    // Restore brand colors
    const primCol = biz.primaryColor || '#4F46E5';
    const secCol = biz.secondaryColor || '#7C3AED';
    if (document.getElementById('setting-biz-primary-color')) document.getElementById('setting-biz-primary-color').value = primCol;
    if (document.getElementById('setting-biz-primary-color-text')) document.getElementById('setting-biz-primary-color-text').value = primCol;
    if (document.getElementById('setting-biz-secondary-color')) document.getElementById('setting-biz-secondary-color').value = secCol;
    if (document.getElementById('setting-biz-secondary-color-text')) document.getElementById('setting-biz-secondary-color-text').value = secCol;

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
    const profileSizeControls = document.getElementById('profile-logo-size-controls');
    const profileSizeDisplay = document.getElementById('profile-logo-size-display');
    if (previewArea && biz.logoUrl) {
      previewArea.innerHTML = `<img src="${biz.logoUrl}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;" alt="Logo">`;
      if (profileSizeControls) profileSizeControls.style.display = 'flex';
      if (profileSizeDisplay) profileSizeDisplay.textContent = (biz.logoSize || 70) + 'px';
    } else if (profileSizeControls) {
      profileSizeControls.style.display = 'none';
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
    const settingPhoneInput = document.getElementById('setting-biz-phone');
    const settingPrefixSel = document.getElementById('setting-biz-phone-prefix');
    if (settingPhoneInput) {
      const rawVal = settingPhoneInput.value.trim();
      if (!rawVal) {
        biz.phone = '';
      } else if (rawVal.startsWith('+')) {
        biz.phone = rawVal;
      } else if (settingPrefixSel && settingPrefixSel.value) {
        biz.phone = `${settingPrefixSel.value} ${rawVal}`.trim();
      } else {
        biz.phone = rawVal;
      }
    }
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

    const primSetting = document.getElementById('setting-biz-primary-color');
    const secSetting = document.getElementById('setting-biz-secondary-color');
    if (primSetting) biz.primaryColor = primSetting.value;
    if (secSetting) biz.secondaryColor = secSetting.value;

    // Sync to builder if present
    const builderP = document.getElementById('builder-color-primary');
    const builderS = document.getElementById('builder-color-secondary');
    if (builderP && primSetting) {
      builderP.value = primSetting.value;
      const builderPT = document.getElementById('builder-color-primary-text');
      if (builderPT) builderPT.value = primSetting.value;
    }
    if (builderS && secSetting) {
      builderS.value = secSetting.value;
      const builderST = document.getElementById('builder-color-secondary-text');
      if (builderST) builderST.value = secSetting.value;
    }

    const langSelect = document.getElementById('setting-biz-language');
    if (langSelect) {
      this.state.language = langSelect.value;
      // Sync KivoI18n engine first, then apply language (which also syncs via applyLanguage)
      if (window.KivoI18n) KivoI18n.setLang(this.state.language);
      this.applyLanguage(this.state.language);
    }

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
        default_vat_rate: biz.defaultVatRate !== undefined ? biz.defaultVatRate : 0,
        logo_url: biz.logoUrl || '',
        visual_template: biz.visualTemplate || 'classic',
        primary_color: biz.primaryColor || '#4F46E5',
        secondary_color: biz.secondaryColor || '#7C3AED',
        logo_size: biz.logoSize || 100,
        logo_position: biz.logoPosition || 'right',
        invoice_page_size: biz.invoicePageSize || 'a4',
        next_invoice_number: biz.nextInvoiceNumber || 1001,
        next_quote_number: biz.nextQuoteNumber || 1001
      }).catch(e => {
        console.error('[KivoApp] Supabase saveSettings error:', e);
        this.showToast(this.friendlySupabaseError(e, this._t('toast_settings_cloud_fail')), "warning");
      });
    }

    this.showToast(this._t('toast_settings_saved'), "success");
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
      this.showToast(this._t('toast_password_updated'), 'success');
    } catch (err) {
      console.error('[KivoApp] submitChangePassword error:', err);
      showError(this.friendlySupabaseError(err, 'Une erreur est survenue. Réessayez ou contactez le support.'));
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
      this.showToast(this._t('toast_logo_select_file'), 'warning');
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
      const profileSizeControls = document.getElementById('profile-logo-size-controls');
      const profileSizeDisplay = document.getElementById('profile-logo-size-display');
      if (previewArea) {
        previewArea.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;" alt="Logo">`;
      }
      if (profileSizeControls) {
        profileSizeControls.style.display = 'flex';
      }
      if (profileSizeDisplay) {
        profileSizeDisplay.textContent = (this.state.business?.logoSize || 70) + 'px';
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

      this.showToast(this._t('toast_logo_imported'), 'success');
    };
    reader.readAsDataURL(file);
  },

  // handleLogoUpload is defined below (FileReader + extractColors version)

  openModal: function (modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.add('active');
      el.style.display = 'flex';
      el.style.visibility = 'visible';
    }
  },

  closeModal: function (modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.remove('active');
      el.style.display = '';
      el.style.visibility = '';
    }
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
    const bizName = this.getBusinessName();
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
      <div style="margin-bottom:0.25rem;font-size:0.6rem;color:#94A3B8;font-weight:500;">Bon pour accord</div>
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
      this.showToast(this._t('toast_ai_describe_first'), 'info');
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
      this.showToast(this._t('toast_ai_structured'), 'success');
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
      this.showToast(this._t('toast_ai_generate_first'), 'info');
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
      this.showToast(this._t('toast_ai_loaded_in_editor'), 'success');
    }, 300);
  },

  /**
   * Saves the AI-generated invoice directly to Supabase / Local storage.
   */
  saveAiInvoiceDirectly: async function () {
    if (!this._aiGeneratedDoc) {
      this.showToast(this._t('toast_ai_generate_first'), 'info');
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
      id: this.generateUUID(),
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
        this.showToast(this._t('toast_doc_supabase_saved'), 'success');
      } catch (e) {
        console.error('Supabase save error:', e);
        this.showToast(this._t('toast_doc_local_saved'), 'success');
      }
    } else {
      this.showToast(this._t('toast_doc_local_only'), 'success');
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
    this.setupPhoneInputs();
    const phoneInput = document.getElementById('new-cli-phone');
    if (phoneInput) phoneInput.value = '';
    const countryEl = document.getElementById('new-cli-country');
    const prefixSel = document.getElementById('new-cli-phone-prefix');
    if (countryEl && prefixSel) {
      const code = countryEl.value || 'SN';
      prefixSel.value = this._countryPhonePrefixMap[code] || '+221';
    }
  },

  /**
   * Country-to-legal-field mapping for client registration
   */
  _countryLegalMap: {
    SN:    { label: 'NINEA',        full: 'NINEA (Numéro d\'Identification Nationale des Entreprises)', placeholder: 'Ex: SN-NINEA-8849201' },
    CG:    { label: 'RCCM / NIU',   full: 'RCCM + NIU (Congo-Brazzaville)',                             placeholder: 'Ex: RCCM CG/BZV-2024-B-00123 / NIU 0012345' },
    CD:    { label: 'RCCM',         full: 'RCCM (RD Congo)',                                             placeholder: 'Ex: CD/KIN-2024-M-12345' },
    CM:    { label: 'RCCM / NIU',   full: 'RCCM + NIU (Cameroun)',                                      placeholder: 'Ex: RC 2023/B/00456 / NIU P012T0000012345' },
    CI:    { label: 'RCCM',         full: 'RCCM (Côte d\'Ivoire)',                                    placeholder: 'Ex: CI-ABJ-2023-B-12345' },
    ML:    { label: 'RCCM',         full: 'RCCM (Mali)',                                                 placeholder: 'Ex: ML/BAM-2023-B-00789' },
    BF:    { label: 'RCCM',         full: 'RCCM (Burkina Faso)',                                         placeholder: 'Ex: BF/OUA-2023-B-01234' },
    TG:    { label: 'RCCM',         full: 'RCCM (Togo)',                                                 placeholder: 'Ex: TG/LOM-2023-B-00567' },
    BJ:    { label: 'RCCM',         full: 'RCCM (Bénin)',                                              placeholder: 'Ex: BJ/COT-2023-B-01111' },
    GN:    { label: 'RCCM / NIF',   full: 'RCCM + NIF (Guinée)',                                       placeholder: 'Ex: RCCM GN-CON-2023-B-0001' },
    FR:    { label: 'SIRET',        full: 'SIRET (France)',                                              placeholder: 'Ex: 123 456 789 00012' },
    BE:    { label: 'BCE',          full: 'Numéro BCE (Belgique)',                                     placeholder: 'Ex: BE 0123.456.789' },
    CH:    { label: 'IDE',          full: 'Numéro IDE / CHE (Suisse)',                                  placeholder: 'Ex: CHE-123.456.789' },
    CA:    { label: 'NE',           full: 'Numéro d\'entreprise (Canada)',                              placeholder: 'Ex: 123456789' },
    MA:    { label: 'RC / IF',      full: 'RC + Identifiant Fiscal (Maroc)',                              placeholder: 'Ex: RC 12345 / IF 12345678' },
    TN:    { label: 'MF',           full: 'Matricule Fiscal (Tunisie)',                                  placeholder: 'Ex: 1234567/A/P/000' },
    DZ:    { label: 'NIF',          full: 'NIF (Algérie)',                                             placeholder: 'Ex: 001234567890123' },
    OTHER: { label: 'N° Registre', full: 'Numéro de registre / identification légale',              placeholder: 'Numéro d\'enregistrement officiel' }
  },

  /**
   * Update legal ID label/placeholder when country changes in client modal
   */
  onClientCountryChange: function () {
    const countryEl = document.getElementById('new-cli-country');
    const labelEl   = document.getElementById('new-cli-taxid-label');
    const inputEl   = document.getElementById('new-cli-taxid');
    const hiddenEl  = document.getElementById('new-cli-country-legalname');
    if (!countryEl) return;

    const code = countryEl.value || 'SN';
    const info = this._countryLegalMap[code] || this._countryLegalMap['OTHER'];

    if (labelEl) labelEl.textContent = info.full;
    if (inputEl) inputEl.placeholder = info.placeholder;
    if (hiddenEl) hiddenEl.value = info.label;

    const prefix = this._countryPhonePrefixMap[code];
    if (prefix) {
      const prefixSel = document.getElementById('new-cli-phone-prefix');
      if (prefixSel) prefixSel.value = prefix;
      const phoneInput = document.getElementById('new-cli-phone');
      if (phoneInput && phoneInput.value) {
        this.formatPhoneInput(phoneInput, prefix);
      }
    }
  },

  saveNewClient: function () {
    const name = document.getElementById('new-cli-name').value.trim();
    const contact = document.getElementById('new-cli-contact').value.trim();
    const rawPhone = document.getElementById('new-cli-phone').value.trim();
    const phonePrefix = document.getElementById('new-cli-phone-prefix')?.value || '';
    let phone = rawPhone;
    if (rawPhone && !rawPhone.startsWith('+') && phonePrefix) {
      phone = `${phonePrefix} ${rawPhone}`.trim();
    }
    const email = document.getElementById('new-cli-email').value.trim();
    const taxId = document.getElementById('new-cli-taxid') ? document.getElementById('new-cli-taxid').value.trim() : '';
    const address = document.getElementById('new-cli-address') ? document.getElementById('new-cli-address').value.trim() : '';
    const country = document.getElementById('new-cli-country') ? document.getElementById('new-cli-country').value : 'SN';
    const legalFieldName = document.getElementById('new-cli-country-legalname') ? document.getElementById('new-cli-country-legalname').value : 'NINEA';
    
    let type = 'B2B';
    const typeRadios = document.getElementsByName('new-cli-type');
    typeRadios.forEach(r => { if (r.checked) type = r.value; });

    if (!name) {
      this.showToast(this._t('toast_client_name_required'), "error");
      return;
    }

    // Point 1 fix: if editing an existing client, reuse its id
    const existingId = (document.getElementById('new-cli-id') || {}).value || '';
    const isEdit = !!existingId;

    const newClient = {
      id: isEdit ? existingId : this.generateUUID(),
      name: name,
      clientType: type,
      company: type === 'B2B' ? name : '',
      contactName: contact,
      taxId: taxId,
      legalFieldName: legalFieldName,
      country: country,
      email: email,
      phone: phone,
      address: address,
      totalInvoiced: 0,
      totalPaid: 0,
      balanceDue: 0,
      createdAt: new Date().toISOString().split('T')[0]
    };

    if (isEdit) {
      // Replace existing client in state
      const idx = this.state.clients.findIndex(c => c.id === existingId);
      if (idx !== -1) {
        // Preserve fields not in the form (e.g. createdAt)
        newClient.createdAt = this.state.clients[idx].createdAt || newClient.createdAt;
        this.state.clients[idx] = newClient;
      }
    } else {
      this.state.clients.unshift(newClient);
    }

    // Reset hidden id field for next "new client" opening
    const idEl = document.getElementById('new-cli-id');
    if (idEl) idEl.value = '';
    const titleEl = document.getElementById('modal-new-client-title');
    if (titleEl) titleEl.textContent = 'Nouveau Client';

    this.saveState();
    
    if (window.KivoDb && this.supabaseConnected) {
      window.KivoDb.saveClient({
        id: newClient.id,
        name: newClient.name,
        type: newClient.clientType,
        company: newClient.company,
        contact_name: newClient.contactName,
        email: newClient.email,
        phone: newClient.phone,
        address: newClient.address
        // NOTE: tax_id / total_invoiced / total_paid / balance_due
        // ne sont pas des colonnes Supabase valides → exclus volontairement
      }).catch(e => {
        console.error('[KivoApp] saveClient error:', e);
        this.showToast(this.friendlySupabaseError(e, this._t('toast_client_save_error')), 'error');
      });
    }

    this.closeModal('modal-new-client');
    this.showToast(this._t('toast_client_saved').replace('{name}', name).replace('{type}', type), "success");

    if (this.activeView === 'document-builder') {
      const clientSelect = document.getElementById('builder-doc-client-select');
      if (clientSelect) {
        let opt = clientSelect.querySelector(`option[value="${newClient.id}"]`);
        if (!opt) {
          opt = document.createElement('option');
          opt.value = newClient.id;
          clientSelect.appendChild(opt);
        }
        opt.textContent = `${newClient.name} (${newClient.company || newClient.contactName || 'Particulier'})`;
        clientSelect.value = newClient.id;
      }
      this.onBuilderClientSelect(newClient.id);
    } else {
      this.renderClients();
    }
  },

  /**
   * Centralized mapping of any Supabase / PostgreSQL / Network error into a French user-friendly message.
   * Prevents raw technical messages (RLS, constraint names, SQL codes) from ever reaching the user.
   */
  friendlySupabaseError: function (err, fallback) {
    if (!err) return fallback || "Une erreur est survenue. Veuillez réessayer.";

    let raw = '';
    let code = '';
    if (typeof err === 'string') {
      raw = err.trim();
    } else if (typeof err === 'object') {
      code = (err.code || err.statusCode || err.status || '').toString();
      raw = (err.message || err.error_description || err.details || err.hint || (err.error && err.error.message) || '').toString().trim();
      if (!raw && typeof err.toString === 'function') {
        const s = err.toString();
        if (s !== '[object Object]') raw = s.trim();
      }
    }

    if (!raw || raw === 'undefined' || raw === 'null' || raw === '[object Object]' || raw === '{}') {
      return fallback || "Une erreur est survenue. Veuillez réessayer.";
    }

    const lower = (raw + ' ' + code).toLowerCase();

    // 1. RLS / Permissions
    if (lower.includes('row-level security') || lower.includes('42501') || lower.includes('permission denied') || lower.includes('not authorized')) {
      return "Accès refusé par les règles de sécurité. Reconnectez-vous pour actualiser vos autorisations.";
    }

    // 2. Constraints: Check constraint
    if (lower.includes('check constraint') || lower.includes('23514')) {
      return "Certaines informations ne respectent pas le format attendu. Vérifiez vos saisies.";
    }

    // 3. Constraints: Unique constraint / duplicates
    if (lower.includes('duplicate key') || lower.includes('unique constraint') || lower.includes('23505') || lower.includes('already exists')) {
      return "Cet élément existe déjà dans votre compte.";
    }

    // 4. Constraints: Foreign key
    if (lower.includes('foreign key') || lower.includes('23503')) {
      return "Action impossible : cet élément est lié à d'autres données existantes.";
    }

    // 5. Constraints: Not null
    if (lower.includes('not-null') || lower.includes('null value') || lower.includes('23502')) {
      return "Veuillez renseigner tous les champs obligatoires.";
    }

    // 6. Auth errors
    if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
      return "Adresse email ou mot de passe incorrect.";
    }
    if (lower.includes('email not confirmed') || lower.includes('email_not_confirmed')) {
      return "Votre compte n'est pas encore confirmé. Vérifiez vos emails pour valider votre compte.";
    }
    if (lower.includes('user already registered') || lower.includes('user_already_exists') || lower.includes('already registered')) {
      return "Un compte existe déjà avec cette adresse email. Veuillez vous connecter.";
    }
    if (lower.includes('auth session missing') || lower.includes('jwt expired') || lower.includes('token is expired') || lower.includes('session_not_found') || lower.includes('pgrst301')) {
      return "Votre session a expiré. Veuillez vous reconnecter.";
    }
    if (lower.includes('password should be at least') || lower.includes('password is too short')) {
      return "Le mot de passe doit comporter au moins 6 caractères.";
    }
    if (lower.includes('user not found')) {
      return "Aucun compte trouvé avec ces identifiants.";
    }
    if (lower.includes('invalid email') || lower.includes('invalid_email')) {
      return "Veuillez entrer une adresse email valide.";
    }

    // 7. Rate limits
    if (lower.includes('too many requests') || lower.includes('rate limit') || lower.includes('429')) {
      return "Trop de requêtes. Veuillez patienter un instant avant de réessayer.";
    }

    // 8. Network errors
    if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network request failed') || lower.includes('err_connection')) {
      return "Erreur de connexion. Vérifiez votre connexion internet.";
    }

    // 9. Database / Query syntax or internal errors
    if (
      lower.includes('pgrst') ||
      lower.includes('relation') ||
      lower.includes('column') ||
      lower.includes('syntax error') ||
      lower.includes('schema cache') ||
      lower.includes('internal server error') ||
      lower.includes('500') ||
      lower.includes('[object object]')
    ) {
      return fallback || "Une erreur est survenue lors de l'opération sur le serveur. Veuillez réessayer.";
    }

    // If message is already a clean French string without code artifacts, keep it
    if (/^[A-ZÀ-Ÿ0-9][a-zà-ÿA-Z0-9\s'’.,!?:;()\-éèêëàâäôöîïùûüçÉÈÊËÀÂÄÔÖÎÏÙÛÜÇ]+$/.test(raw.trim()) && !/[{}_=<>$\\/]/.test(raw)) {
      return raw.trim();
    }

    return fallback || "Une erreur est survenue. Veuillez réessayer.";
  },

  showToast: function (message, type = 'info') {
    if (message === undefined || message === null) return;
    let cleanMsg = '';
    const isErrorType = type === 'error' || type === 'danger' || type === 'warning';
    if (typeof message === 'object') {
      cleanMsg = this.friendlySupabaseError(message, isErrorType ? "Une erreur est survenue lors de l'opération." : "Opération effectuée.");
    } else {
      const str = String(message).trim();
      if (!str || str === 'undefined' || str === 'null' || str === '[object Object]') return;
      if (
        str.includes('violates') ||
        str.includes('constraint') ||
        str.includes('row-level security') ||
        str.includes('permission denied') ||
        str.includes('JWT') ||
        str.includes('PGRST') ||
        str.includes('Failed to fetch') ||
        str.includes('[object Object]') ||
        (isErrorType && (str.includes('{') || str.includes('Error') || str.includes('column') || str.includes('relation')))
      ) {
        cleanMsg = this.friendlySupabaseError(str, "Une erreur est survenue lors de l'opération.");
      } else {
        cleanMsg = str;
      }
    }
    if (!cleanMsg || cleanMsg === 'undefined' || cleanMsg === 'null' || cleanMsg === '[object Object]' || cleanMsg.trim() === '') return;

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
      <span style="font-weight:500;">${cleanMsg}</span>
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
    this.showToast(this._t('toast_palette_applied'), 'success');
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
      this.showToast(this._t('toast_logo_file_invalid'), 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      
      // Store strictly for this builder document session
      this.builderCustomLogoUrl = dataUrl;
      this._invoiceLogoRemoved = false;

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

      this.showToast(this._t('toast_logo_applied'), 'success');
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

      this.showToast(this._t('toast_currency_changed').replace('{old}', oldCurrency).replace('{rate}', (1 * factor).toFixed(4)).replace('{new}', newCurrency), 'info');
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
          this.showToast(this._t('toast_logo_color_applied').replace('{color}', primaryHex), 'success');
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
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || '';
    };

    if (!clientId) {
      setVal('builder-client-name', '');
      setVal('builder-client-address', '');
      setVal('builder-client-phone', '');
      setVal('builder-client-email', '');
      this.updateLiveInvoicePreview();
      return;
    }

    const client = (this.state && this.state.clients ? this.state.clients : []).find(c => String(c.id) === String(clientId));
    if (!client) return;

    setVal('builder-client-name', client.name || client.company || client.contactName || '');
    setVal('builder-client-address', client.address || '');
    setVal('builder-client-phone', client.phone || '');
    setVal('builder-client-email', client.email || '');

    this.updateLiveInvoicePreview();
  },

  /**
   * Peuple le menu déroulant du catalogue dans le constructeur de facture
   */
  populateBuilderCatalogDropdown: function () {
    const select = document.getElementById('builder-catalog-select');
    if (!select) return;
    const catalog = (this.state && this.state.catalog) || [];
    const currency = this.state?.business?.currency || 'FCFA';
    if (catalog.length === 0) {
      select.innerHTML = '<option value="">+ Aucun article au catalogue</option>';
      select.disabled = true;
    } else {
      select.disabled = false;
      select.innerHTML = `<option value="">+ Ajouter depuis le catalogue (${catalog.length})...</option>` +
        catalog.map(it => `<option value="${it.id}">${it.name} — ${Number(it.price || 0).toLocaleString('fr-FR')} ${currency}</option>`).join('');
    }
  },

  /**
   * Ajout direct d'un article du catalogue dans les lignes du constructeur
   */
  onBuilderCatalogSelect: function (itemId) {
    if (!itemId) return;
    const item = (this.state.catalog || []).find(it => String(it.id) === String(itemId));
    if (!item) return;

    // Si la seule ligne existante est vide (placeholder initial), la remplacer
    const tbody = document.getElementById('builder-items-tbody');
    if (tbody) {
      const rows = tbody.querySelectorAll('tr');
      if (rows.length === 1) {
        const nameInput = rows[0].querySelector('.item-name');
        const priceInput = rows[0].querySelector('.item-price');
        if (nameInput && !nameInput.value.trim() && priceInput && parseFloat(priceInput.value) === 0) {
          rows[0].remove();
        }
      }
    }

    const defaultVat = this.state.business?.defaultVatRate !== undefined ? this.state.business.defaultVatRate : (this.state.business?.taxRate !== undefined ? this.state.business.taxRate : 0);
    const tax = (item.taxRate !== undefined && item.taxRate !== null) ? Number(item.taxRate) : defaultVat;
    this.addBuilderLineItem(item.name || 'Article', 1, Number(item.price) || 0, tax);
    this.showToast(this._t('toast_item_added_to_doc').replace('{name}', item.name), 'success');
  },

  /**
   * Ajuste la taille du logo par pas de +/- delta (ex: +10 ou -10)
   */
  adjustLogoSize: function (delta) {
    const currentSize = (this.state.business && this.state.business.logoSize) ? parseInt(this.state.business.logoSize) : 70;
    const newSize = currentSize + delta;
    this.onLogoSizeChange(newSize);
  },

  /**
   * Slider / Boutons taille du logo (40px - 200px)
   */
  onLogoSizeChange: function (val) {
    let size = parseInt(val) || 70;
    if (size < 40) size = 40;
    if (size > 200) size = 200;

    const displayEl = document.getElementById('logo-size-display');
    if (displayEl) displayEl.textContent = size + 'px';
    const badgeEl = document.getElementById('builder-logo-size-badge');
    if (badgeEl) badgeEl.textContent = size + 'px';
    const profileDisplay = document.getElementById('profile-logo-size-display');
    if (profileDisplay) profileDisplay.textContent = size + 'px';
    const rangeInput = document.getElementById('builder-logo-size');
    if (rangeInput) rangeInput.value = size;

    if (!this.state.business) this.state.business = {};
    this.state.business.logoSize = size;
    this.saveState();

    // Persist to Supabase business_settings.logo_size
    if (window.KivoDb && window.KivoAuth && window.KivoAuth.user) {
      window.KivoDb.saveSettings({ logo_size: size }).catch(err => {
        console.error('[KivoApp] Erreur sauvegarde logo_size cloud:', err);
      });
    }

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
   * Telechargement PDF reel via html2pdf.js — generation directe depuis KivoTemplates
   * Fonctionne meme sur mobile ou quand l'apercu est cache (offsetParent===null)
   * Pas de zIndex negatif, pas de canvas blanc, garantit 1 page A4 exacte
   */
  /**
   * Telechargement PDF reel via html2pdf.js — generation directe depuis KivoTemplates
   * Fonctionne pour le builder et pour tout document existant (vue publique ou liste)
   * Pas de canvas blanc, capture fidèlement 1 page A4 complète
   */
  /**
   * Résout les données et le HTML de rendu pour un document
   * Sans argument : état courant du builder (y compris avant sauvegarde ou généré par l'IA)
   * Avec un id / doc : le document correspondant dans le state
   */
  _getDocForRender: function (targetDocOrId) {
    const biz = this._currentPublicBiz || this.state.business || {};
    let targetDoc = null;
    let templateId = (document.getElementById('builder-visual-template') || {}).value || biz.visualTemplate || 'minimalist';

    if (targetDocOrId && typeof targetDocOrId === 'object') {
      targetDoc = targetDocOrId;
    } else if (typeof targetDocOrId === 'string' && targetDocOrId.trim()) {
      targetDoc = (this.state.documents || []).find(d => d.id === targetDocOrId || d.number === targetDocOrId);
      if (!targetDoc && this._currentPublicDoc && (this._currentPublicDoc.id === targetDocOrId || this._currentPublicDoc.number === targetDocOrId)) {
        targetDoc = this._currentPublicDoc;
      }
    }

    if (targetDoc) {
      templateId = targetDoc.templateId || targetDoc.visualTemplate || templateId;
      const currencyStr = targetDoc.currency || biz.currency || 'FCFA';

      let rawDocItems = targetDoc.items;
      let meta = {};
      if (rawDocItems && typeof rawDocItems === 'object' && !Array.isArray(rawDocItems) && Array.isArray(rawDocItems.lines)) {
        meta = rawDocItems;
        rawDocItems = rawDocItems.lines;
      } else if (typeof rawDocItems === 'string') {
        try {
          const parsed = JSON.parse(rawDocItems);
          if (Array.isArray(parsed)) {
            rawDocItems = parsed;
          } else if (parsed && Array.isArray(parsed.lines)) {
            meta = parsed;
            rawDocItems = parsed.lines;
          } else {
            rawDocItems = [];
          }
        } catch (_) {
          rawDocItems = [];
        }
      }
      if (!Array.isArray(rawDocItems)) rawDocItems = [];

      const defaultBizName = targetDoc.issuerName || meta.issuerName || targetDoc.bizName || biz.name || biz.owner || (window.KivoAuth?.user?.user_metadata?.full_name) || 'Mon Entreprise';
      const docBiz = Object.assign({}, biz, {
        name: defaultBizName,
        address: targetDoc.issuerAddress || meta.issuerAddress || biz.address || '',
        phone: targetDoc.issuerPhone || meta.issuerPhone || biz.phone || '',
        email: targetDoc.issuerEmail || meta.issuerEmail || biz.email || '',
        legal: targetDoc.issuerLegal || meta.issuerLegal || biz.legal || '',
        logoUrl: (targetDoc.logoUrl !== undefined && targetDoc.logoUrl !== null) ? targetDoc.logoUrl : (meta.logoUrl !== undefined ? meta.logoUrl : biz.logoUrl),
        logoSize: targetDoc.logoSize || meta.logoSize || biz.logoSize || 70,
        logoPosition: targetDoc.logoPosition || meta.logoPosition || biz.logoPosition || 'right',
        primaryColor: targetDoc.primaryColor || meta.primaryColor || biz.primaryColor || '#0F172A',
        secondaryColor: targetDoc.secondaryColor || meta.secondaryColor || biz.secondaryColor || '#64748B'
      });

      const colLabels = targetDoc.columnLabels || meta.columnLabels || {};
      const totLabels = targetDoc.labels || meta.labels || {};

      const subtotal = Number(targetDoc.subtotal) || Number(targetDoc.total) || 0;
      const discount = Number(targetDoc.discount) || 0;
      const showDiscount = targetDoc.showDiscount !== undefined ? !!targetDoc.showDiscount : (meta.showDiscount !== undefined ? !!meta.showDiscount : (discount > 0));
      const showVat = targetDoc.showVat !== undefined ? !!targetDoc.showVat : (meta.showVat !== undefined ? !!meta.showVat : true);
      const taxAmount = Number(targetDoc.tax) || Number(targetDoc.taxAmount) || Number(targetDoc.tax_amount) || 0;
      const grandTotal = Number(targetDoc.total) || 0;
      const deposit = targetDoc.depositAmount !== undefined ? Number(targetDoc.depositAmount) : (Number(meta.depositAmount) || 0);
      const showDeposit = targetDoc.showDeposit !== undefined ? !!targetDoc.showDeposit : (meta.showDeposit !== undefined ? !!meta.showDeposit : (deposit > 0));
      const balanceDue = Math.max(0, grandTotal - deposit);

      const docData = {
        biz: docBiz,
        docTitleText: targetDoc.docTitleText || meta.docTitleText || '',
        docType: targetDoc.type || 'invoice',
        docNum: targetDoc.number || 'FAC-2026-0001',
        issueDate: targetDoc.issueDate || meta.issueDate || new Date().toISOString().split('T')[0],
        dueDate: targetDoc.dueDate || meta.dueDate || '',
        status: targetDoc.status || 'draft',
        subject: targetDoc.subject || meta.subject || '',
        showSubject: targetDoc.showSubject !== undefined ? !!targetDoc.showSubject : (meta.showSubject !== undefined ? !!meta.showSubject : true),
        showLogo: targetDoc.showLogo !== undefined ? !!targetDoc.showLogo : (meta.showLogo !== undefined ? !!meta.showLogo : true),
        paymentMethod: targetDoc.paymentMethod || meta.paymentMethod || 'Virement bancaire',
        paymentDetails: targetDoc.paymentDetails || meta.paymentDetails || '',
        showPaymentMethods: targetDoc.showPaymentMethods !== undefined ? !!targetDoc.showPaymentMethods : (meta.showPaymentMethods !== undefined ? !!meta.showPaymentMethods : true),
        terms: targetDoc.terms || targetDoc.conditions || meta.terms || 'À réception',
        notes: targetDoc.notes || meta.notes || '',
        showNotes: targetDoc.showNotes !== undefined ? !!targetDoc.showNotes : (meta.showNotes !== undefined ? !!meta.showNotes : true),
        thankYouText: targetDoc.thankYouText || meta.thankYouText || 'Merci pour votre confiance !',
        showThankYou: targetDoc.showThankYou !== undefined ? !!targetDoc.showThankYou : (meta.showThankYou !== undefined ? !!meta.showThankYou : true),
        legalNotices: targetDoc.legalNoticesText || meta.legalNoticesText || targetDoc.legalNotices || meta.legalNotices || (biz.legal || ''),
        showLegalNotices: targetDoc.showLegalNotices !== undefined ? !!targetDoc.showLegalNotices : (meta.showLegalNotices !== undefined ? !!meta.showLegalNotices : true),
        client: {
          name: targetDoc.clientName || 'Client Destinataire',
          company: targetDoc.clientCompany || '',
          phone: targetDoc.clientPhone || '',
          email: targetDoc.clientEmail || '',
          address: targetDoc.clientAddress || meta.clientAddress || '',
          taxId: targetDoc.clientTaxId || meta.clientTaxId || (targetDoc.client && targetDoc.client.taxId) || '',
          legalFieldName: targetDoc.clientLegalFieldName || meta.clientLegalFieldName || (targetDoc.client && targetDoc.client.legalFieldName) || ''
        },
        colDesc: colLabels.desc || 'Description',
        colQty: colLabels.qty || 'Quantité',
        colUnit: colLabels.unit || 'Unité',
        colPrice: colLabels.price || 'Prix Unitaire',
        colTax: colLabels.tax || 'TVA',
        colDiscount: colLabels.discount || 'Remise',
        colTotal: colLabels.total || 'Total HT',
        lblSubtotal: totLabels.subtotal || 'Sous-total HT',
        lblTax: totLabels.tax || 'TVA',
        lblTotal: totLabels.total || 'Total TTC',
        lblDeposit: totLabels.deposit || 'Acompte déjà versé',
        lblBalance: totLabels.balance || 'Solde net à payer',
        items: rawDocItems.map(it => ({
          name: it.name || 'Article',
          quantity: Number(it.quantity) || 1,
          unit: it.unit || '',
          price: Number(it.price) || 0,
          taxRate: (it.taxRate !== undefined && it.taxRate !== null) ? Number(it.taxRate) : (biz.defaultVatRate !== undefined ? biz.defaultVatRate : 0),
          discount: Number(it.discount) || 0,
          totalHT: Number(it.totalHT) || (Number(it.quantity || 1) * Number(it.price || 0)),
          total: Number(it.total) || (Number(it.quantity || 1) * Number(it.price || 0))
        })),
        subtotal: subtotal,
        discount: discount,
        showDiscount: showDiscount,
        showVat: showVat,
        taxAmount: taxAmount,
        grandTotal: grandTotal,
        deposit: deposit,
        showDeposit: showDeposit,
        balanceDue: balanceDue,
        currency: currencyStr,
        primaryColor: targetDoc.primaryColor || meta.primaryColor || biz.primaryColor || '#0F172A',
        secondaryColor: targetDoc.secondaryColor || meta.secondaryColor || biz.secondaryColor || '#64748B'
      };

      const filename = ((targetDoc.number || 'facture_KIVO').trim().replace(/[^a-zA-Z0-9-_]/g, '_')) + '.pdf';
      const renderedHtml = window.KivoTemplates ? window.KivoTemplates.render(templateId, docData) : '';
      return { renderedHtml, filename, templateId, docData };
    }

    // Sans argument : état courant du builder (y compris avant d'enregistrer)
    let builderData = null;
    if (window.KivoTemplates && typeof window.KivoTemplates.collectData === 'function') {
      builderData = window.KivoTemplates.collectData(this.state);
    }
    const builderNum = (builderData && builderData.docNum) || (document.getElementById('builder-doc-number') || {}).value || 'facture_KIVO';
    const filename = (builderNum.trim().replace(/[^a-zA-Z0-9-_]/g, '_')) + '.pdf';
    let renderedHtml = '';
    if (window.KivoTemplates && typeof window.KivoTemplates.render === 'function') {
      renderedHtml = window.KivoTemplates.render(templateId, builderData) || '';
    }
    if (!renderedHtml) {
      const sourceEl = document.getElementById('live-paper-preview-container') || document.getElementById('public-doc-printable-area');
      if (sourceEl) renderedHtml = sourceEl.innerHTML;
    }
    return { renderedHtml, filename, templateId };
  },

  /**
   * Crée et prépare l'iframe hors écran pour html2canvas / impression
   */
  _preparePdfIframe: async function (renderedHtml, templateId) {
    const isDark = (templateId === 'premium');
    const bgColor = isDark ? '#181A20' : '#FFFFFF';

    const iframe = document.createElement('iframe');
    iframe.id = 'kivo-pdf-render-frame';
    iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;margin:0;padding:0;overflow:visible;';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write('<!DOCTYPE html><html><head></head><body></body></html>');
    iframeDoc.close();

    // Copier les feuilles de style et polices du document principal
    const headElements = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
    const linkPromises = [];
    headElements.forEach(el => {
      if (el.tagName.toLowerCase() === 'link') {
        const link = iframeDoc.createElement('link');
        link.rel = 'stylesheet';
        link.href = el.href;
        linkPromises.push(new Promise(res => { link.onload = res; link.onerror = res; }));
        iframeDoc.head.appendChild(link);
      } else if (el.tagName.toLowerCase() === 'style') {
        const style = iframeDoc.createElement('style');
        style.textContent = el.textContent;
        iframeDoc.head.appendChild(style);
      }
    });

    const resetStyle = iframeDoc.createElement('style');
    resetStyle.textContent = `
      * { box-sizing: border-box; }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: ${bgColor} !important;
        color: ${bgColor === '#181A20' ? '#F1F5F9' : '#0F172A'};
        font-family: Inter, sans-serif;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body {
        width: 794px !important;
        min-width: 794px !important;
      }
      @page {
        size: A4 portrait;
        margin: 0;
      }
      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    `;
    iframeDoc.head.appendChild(resetStyle);

    iframeDoc.body.innerHTML = renderedHtml;
    if (iframeDoc.body.firstElementChild) {
      iframeDoc.body.firstElementChild.style.width = '794px';
      iframeDoc.body.firstElementChild.style.boxSizing = 'border-box';
    }

    // Attendre le chargement des feuilles avec timeout max 1.5s
    await Promise.race([Promise.all(linkPromises), new Promise(r => setTimeout(r, 1500))]);

    // Attendre les polices
    if (iframeDoc.fonts && iframeDoc.fonts.ready) {
      try { await iframeDoc.fonts.ready; } catch (_) {}
    }

    // Attendre le décodage de toutes les images (logo compris)
    const imgs = Array.from(iframeDoc.images || []);
    const imgPromises = imgs.map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      if (typeof img.decode === 'function') return img.decode().catch(() => {});
      return new Promise(res => { img.onload = res; img.onerror = res; });
    });
    await Promise.race([Promise.all(imgPromises), new Promise(r => setTimeout(r, 2000))]);

    // Délai pour s'assurer que le rendu CSS et le layout sont calculés
    await new Promise(r => setTimeout(r, 100));

    return { iframe, iframeDoc, bgColor };
  },

  /**
   * Téléchargement PDF haute fidélité via html2canvas 1.4.1 + jsPDF 2.5.1
   */
  downloadPdf: async function (targetDocOrId) {
    let iframe = null;
    let overlay = null;

    try {
      if (typeof html2canvas === 'undefined') {
        this.showToast(this._t('toast_doc_html2canvas_missing'), "error");
        return;
      }
      const JsPDF = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : window.jsPDF;
      if (!JsPDF) {
        this.showToast(this._t('toast_doc_jspdf_missing'), "error");
        return;
      }

      // 1. Overlay de chargement
      overlay = document.createElement('div');
      overlay.id = 'kivo-pdf-loading-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.8);z-index:999999;display:flex;align-items:center;justify-content:center;color:#fff;font-family:Inter,sans-serif;backdrop-filter:blur(2px);';
      overlay.innerHTML = `
        <div style="background:#1E293B;padding:22px 30px;border-radius:12px;display:flex;align-items:center;gap:14px;box-shadow:0 20px 40px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round" style="animation:spin 0.9s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <span style="font-size:14px;font-weight:600;">Génération du PDF haute résolution...</span>
        </div>
      `;
      document.body.appendChild(overlay);

      // 2. Extraire données et HTML du document
      const { renderedHtml, filename, templateId } = this._getDocForRender(targetDocOrId);
      if (!renderedHtml) {
        this.showToast(this._t('toast_doc_no_download'), "error");
        return;
      }

      // 3. Monter dans l'iframe hors écran et attendre les ressources
      const prep = await this._preparePdfIframe(renderedHtml, templateId);
      iframe = prep.iframe;
      const iframeDoc = prep.iframeDoc;
      const bgColor = prep.bgColor;

      // 4. Capture html2canvas
      const canvas = await html2canvas(iframeDoc.body, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: bgColor,
        width: 794,
        windowWidth: 794,
        scrollX: 0,
        scrollY: 0
      });

      // 5. Découpe en pages A4
      const pageHeightPx = Math.round(canvas.width * (297 / 210));
      const bodyRect = iframeDoc.body.getBoundingClientRect();
      const rows = Array.from(iframeDoc.querySelectorAll('tr')).map(tr => {
        const r = tr.getBoundingClientRect();
        return {
          top: (r.top - bodyRect.top) * 2,
          bottom: (r.bottom - bodyRect.top) * 2
        };
      });

      const pdf = new JsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      let currentY = 0;
      let pageIndex = 0;
      const totalHeight = canvas.height;

      while (currentY < totalHeight) {
        const remainingHeight = totalHeight - currentY;

        // Éviter une page vide finale (artefact ou marge résiduelle < 45px)
        if (pageIndex > 0 && remainingHeight < 45) {
          break;
        }

        let nextCutY = currentY + pageHeightPx;
        let sliceHeight = pageHeightPx;

        if (nextCutY >= totalHeight) {
          sliceHeight = remainingHeight;
          nextCutY = totalHeight;
        } else {
          // Coupe intelligente : chercher si la coupe traverse une ligne <tr>
          for (const row of rows) {
            if (nextCutY > row.top + 4 && nextCutY < row.bottom - 4) {
              if (row.top > currentY + (pageHeightPx * 0.35)) {
                nextCutY = Math.floor(row.top);
                sliceHeight = nextCutY - currentY;
                break;
              }
            }
          }
        }

        // Éviter une page vide finale
        if (sliceHeight <= 15 && pageIndex > 0) {
          break;
        }

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = pageHeightPx;
        const tempCtx = tempCanvas.getContext('2d');

        // Remplir le fond avec la couleur du template
        tempCtx.fillStyle = bgColor;
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        tempCtx.drawImage(
          canvas,
          0, currentY, canvas.width, sliceHeight,
          0, 0, canvas.width, sliceHeight
        );

        const pageData = tempCanvas.toDataURL('image/jpeg', 0.95);
        if (pageIndex > 0) {
          pdf.addPage('a4', 'portrait');
        }
        pdf.addImage(pageData, 'JPEG', 0, 0, 210, 297);

        pageIndex++;
        currentY = nextCutY;
      }

      pdf.save(filename);
      this.showToast(this._t('toast_doc_pdf_success'), "success");

    } catch (err) {
      console.error('[KivoApp] Erreur downloadPdf:', err);
      console.error('[KivoApp] downloadPdf error:', err);
      this.showToast(this._t('toast_doc_pdf_error'), "error");
    } finally {
      if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
  },

  /**
   * Impression via iframe dédié A4 (seule la facture apparaît)
   */
  printPdf: async function (targetDocOrId) {
    let iframe = null;
    let overlay = null;

    try {
      if (!window.KivoTemplates) {
        this.showToast(this._t('toast_template_engine_unavail'), "error");
        return;
      }

      overlay = document.createElement('div');
      overlay.id = 'kivo-pdf-loading-overlay';
      overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,23,42,0.8);z-index:999999;display:flex;align-items:center;justify-content:center;color:#fff;font-family:Inter,sans-serif;';
      overlay.innerHTML = `
        <div style="background:#1E293B;padding:22px 30px;border-radius:12px;display:flex;align-items:center;gap:14px;box-shadow:0 20px 40px rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.1);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" stroke-width="2.5" stroke-linecap="round" style="animation:spin 0.9s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <span style="font-size:14px;font-weight:600;">Préparation de l'impression...</span>
        </div>
      `;
      document.body.appendChild(overlay);

      const { renderedHtml, templateId } = this._getDocForRender(targetDocOrId);
      if (!renderedHtml) {
        this.showToast(this._t('toast_doc_no_print'), "error");
        return;
      }

      const prep = await this._preparePdfIframe(renderedHtml, templateId);
      iframe = prep.iframe;

      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
        overlay = null;
      }

      iframe.contentWindow.focus();
      iframe.contentWindow.print();

    } catch (err) {
      console.error('[KivoApp] Erreur printPdf:', err);
      console.error('[KivoApp] printPdf error:', err);
      this.showToast(this._t('toast_doc_print_error'), "error");
    } finally {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      setTimeout(() => {
        if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 4000);
    }
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
    this.showToast(this._t('toast_plan_activated').replace('{plan}', label), 'success');

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
    window.open(`https://wa.me/242068286376?text=${msg}`, '_blank');
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.KivoApp.init();
  });
} else {
  window.KivoApp.init();
}

