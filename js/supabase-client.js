/**
 * KIVO MATIQUE — Supabase Database Client (Official SDK)
 * Project: KIVO MATIQUE (fzdtdfymvhydtoyqpdxd)
 *
 * FIX: 'const supabase' was conflicting with window.supabase from CDN on re-load.
 * Renamed internal variable to _kivoClient and wrapped in a guard to prevent
 * double-initialization (KivoDb is not defined / already declared errors).
 */

// Guard: if already initialized (e.g. script loaded twice), skip entirely
if (window.KivoDb) {
  console.warn('[KivoDb] Already initialized — skipping duplicate load.');
} else {

  const SUPABASE_URL = 'https://fzdtdfymvhydtoyqpdxd.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6ZHRkZnltdmh5ZHRveXFwZHhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNjAyMTcsImV4cCI6MjEwMTkzNjIxN30.WK4pbZ1HYq5QDFasw3P3gKPz4KfMObGTfb721s5spdQ';

  // Named _kivoClient to avoid name collision with window.supabase exposed by the CDN.
  // Using 'const supabase' at the top level of a script would throw
  // "Identifier 'supabase' has already been declared" if the script runs twice.
  const _kivoClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  window.KivoDb = {
    // Expose the client for auth operations (KivoAuth.signIn, etc.)
    supabase: _kivoClient,

    // ─── Generic CRUD ──────────────────────────────────────────────────

    select: async function (table, match = {}) {
      try {
        const { data, error } = await _kivoClient.from(table).select('*').match(match);
        if (error) throw error;
        return data;
      } catch (e) {
        console.error(`[KivoDb] select(${table}) error:`, e);
        return null;
      }
    },

    insert: async function (table, data) {
      try {
        if (window.KivoAuth && window.KivoAuth.user) {
          if (Array.isArray(data)) {
            data = data.map(d => ({ ...d, user_id: window.KivoAuth.user.id }));
          } else {
            data.user_id = window.KivoAuth.user.id;
          }
        }
        const { data: inserted, error } = await _kivoClient.from(table).insert(data).select();
        if (error) throw error;
        return inserted;
      } catch (e) {
        console.error(`[KivoDb] insert(${table}) error:`, e);
        return null;
      }
    },

    upsert: async function (table, data) {
      try {
        if (window.KivoAuth && window.KivoAuth.user) {
          if (Array.isArray(data)) {
            data = data.map(d => ({ ...d, user_id: window.KivoAuth.user.id }));
          } else {
            data.user_id = window.KivoAuth.user.id;
          }
        }
        const { data: upserted, error } = await _kivoClient.from(table).upsert(data).select();
        if (error) throw error;
        return upserted;
      } catch (e) {
        console.error(`[KivoDb] upsert(${table}) error:`, e);
        return null;
      }
    },

    update: async function (table, data, match) {
      try {
        const { data: updated, error } = await _kivoClient.from(table).update(data).match(match).select();
        if (error) throw error;
        return updated;
      } catch (e) {
        console.error(`[KivoDb] update(${table}) error:`, e);
        return null;
      }
    },

    delete: async function (table, match) {
      try {
        const { error } = await _kivoClient.from(table).delete().match(match);
        if (error) throw error;
        return true;
      } catch (e) {
        console.error(`[KivoDb] delete(${table}) error:`, e);
        return false;
      }
    },

    // ─── Domain-specific helpers ───────────────────────────────────────

    loadAll: async function () {
      console.log('[KivoDb] Loading all data from Supabase...');
      // Get current authenticated user to enforce strict isolation
      let user = window.KivoAuth?.user || null;
      if (!user) {
        try {
          const { data: userData } = await _kivoClient.auth.getUser();
          user = userData?.user || null;
        } catch (_) {}
      }
      if (!user) {
        console.warn('[KivoDb] loadAll: No authenticated user. Returning empty datasets.');
        return {
          settings:   [],
          clients:    [],
          catalog:    [],
          documents:  [],
          activities: []
        };
      }

      // Parallel execution for maximum speed (replaces slow sequential fetches)
      try {
        const [
          settingsRes,
          clientsRes,
          catalogRes,
          documentsRes,
          activitiesRes
        ] = await Promise.all([
          _kivoClient.from('business_settings').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
          _kivoClient.from('clients').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          _kivoClient.from('catalog').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
          _kivoClient.from('documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          _kivoClient.from('activities').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
        ]);

        if (settingsRes.error) console.error('[KivoDb] settings error:', settingsRes.error);
        if (clientsRes.error) console.error('[KivoDb] clients error:', clientsRes.error);
        if (catalogRes.error) console.error('[KivoDb] catalog error:', catalogRes.error);
        if (documentsRes.error) console.error('[KivoDb] documents error:', documentsRes.error);

        return {
          settings:   settingsRes.data   || [],
          clients:    clientsRes.data    || [],
          catalog:    catalogRes.data    || [],
          documents:  documentsRes.data  || [],
          activities: activitiesRes.data || []
        };
      } catch (e) {
        console.error('[KivoDb] loadAll parallel fetch error:', e);
        return {
          settings:   [],
          clients:    [],
          catalog:    [],
          documents:  [],
          activities: []
        };
      }
    },

    saveDocument: async function (doc) {
      let user = window.KivoAuth?.user || null;
      if (!user) {
        try {
          const { data: userData } = await _kivoClient.auth.getUser();
          user = userData?.user || null;
        } catch (_) {}
      }
      if (!user) throw new Error("Utilisateur non authentifié.");

      // Package lines and metadata cleanly in items JSON
      let rawLines = doc.items;
      if (typeof rawLines === 'string') {
        try {
          const parsed = JSON.parse(rawLines || '[]');
          rawLines = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.lines) ? parsed.lines : []);
        } catch (_) { rawLines = []; }
      } else if (rawLines && !Array.isArray(rawLines) && Array.isArray(rawLines.lines)) {
        rawLines = rawLines.lines;
      }
      const lines = Array.isArray(rawLines) ? rawLines : [];

      const resolvedIssueDate = doc.issueDate || doc.issue_date || new Date().toISOString().split('T')[0];
      const resolvedDueDate   = doc.dueDate   || doc.due_date   || '';
      const resolvedCurrency  = doc.currency  || 'FCFA';

      const itemsPayload = JSON.stringify({
        lines: lines,
        issueDate: resolvedIssueDate,
        dueDate: resolvedDueDate,
        currency: resolvedCurrency
      });

      // Strict mapping to valid Supabase columns
      // issue_date and due_date are stored BOTH as top-level columns and inside items JSON
      const payload = {
        id: doc.id,
        user_id: user.id,
        number: doc.number,
        type: doc.type || 'invoice',
        status: doc.status || 'draft',
        client_id: doc.clientId || doc.client_id || null,
        client_name: doc.clientName || doc.client_name || '',
        client_type: doc.clientType || doc.client_type || 'B2B',
        client_tax_id: doc.clientTaxId || doc.client_tax_id || '',
        client_email: doc.clientEmail || doc.client_email || '',
        client_phone: doc.clientPhone || doc.client_phone || '',
        issue_date: resolvedIssueDate,
        due_date: resolvedDueDate || null,
        currency: resolvedCurrency,
        items: itemsPayload,
        subtotal: Number(doc.subtotal) || 0,
        discount: Number(doc.discount) || 0,
        tax_rate: Number(doc.taxRate !== undefined ? doc.taxRate : doc.tax_rate) || 0,
        tax_amount: Number(doc.taxAmount !== undefined ? doc.taxAmount : (doc.tax || doc.tax_amount)) || 0,
        total: Number(doc.total) || 0,
        amount_paid: Number(doc.amountPaid !== undefined ? doc.amountPaid : doc.amount_paid) || 0,
        notes: doc.notes || '',
        conditions: doc.conditions || doc.terms || '',
        public_token: doc.publicToken || doc.public_token || ('tok_' + Math.random().toString(36).substring(2, 12)),
        views_count: Number(doc.viewsCount !== undefined ? doc.viewsCount : doc.views_count) || 0
      };

      const { data: upserted, error } = await _kivoClient.from('documents').upsert(payload).select();
      if (error) {
        console.error('[KivoDb] saveDocument error:', error);
        throw error;
      }
      return upserted;
    },

    saveClient: async function (client) {
      let user = window.KivoAuth?.user || null;
      if (!user) {
        try {
          const { data: userData } = await _kivoClient.auth.getUser();
          user = userData?.user || null;
        } catch (_) {}
      }
      if (!user) throw new Error("Utilisateur non authentifié.");

      // Strict mapping to valid Supabase columns only (no invalid tax_id/total_invoiced)
      const payload = {
        id: client.id,
        user_id: user.id,
        name: client.name,
        type: client.type || client.clientType || 'B2B',
        company: client.company || '',
        contact_name: client.contact_name || client.contactName || '',
        email: client.email || '',
        phone: client.phone || '',
        address: client.address || ''
      };

      const { data: upserted, error } = await _kivoClient.from('clients').upsert(payload).select();
      if (error) {
        console.error('[KivoDb] saveClient error:', error);
        throw error;
      }
      return upserted;
    },
    saveCatalogItem: async function (item)     { return this.upsert('catalog', item); },
    saveSettings:    async function (settings) {
      let user = window.KivoAuth?.user || null;
      if (!user) {
        try {
          const { data: userData } = await _kivoClient.auth.getUser();
          user = userData?.user || null;
        } catch (_) {}
      }
      if (!user) throw new Error("Utilisateur non authentifié.");

      const payload = { ...settings, user_id: user.id };

      // Check if existing settings record exists for this user
      const { data: existing } = await _kivoClient
        .from('business_settings')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        payload.updated_at = new Date().toISOString();
        const { data: updated, error } = await _kivoClient
          .from('business_settings')
          .update(payload)
          .eq('id', existing[0].id)
          .select();
        if (error) throw error;
        return updated;
      } else {
        const { data: inserted, error } = await _kivoClient
          .from('business_settings')
          .insert(payload)
          .select();
        if (error) throw error;
        return inserted;
      }
    },

    uploadLogo: async function (file, userId) {
      try {
        const fileExt  = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        const { error } = await _kivoClient.storage.from('logos').upload(fileName, file, {
          upsert: true,
          cacheControl: '3600'
        });
        if (error) throw error;
        const { data: { publicUrl } } = _kivoClient.storage.from('logos').getPublicUrl(fileName);
        return publicUrl;
      } catch (e) {
        console.error('[KivoDb] uploadLogo error:', e);
        return null;
      }
    },

    logActivity:      async function (activity) { return this.insert('activities', activity); },
    deleteDocument:   async function (id)       { return this.delete('documents',  { id }); },
    deleteClient:     async function (id)       { return this.delete('clients',    { id }); },
    deleteCatalogItem: async function (id)      { return this.delete('catalog',    { id }); }
  };

  console.log('[KivoDb] Supabase client initialized successfully.');

} // end guard
