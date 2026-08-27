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
      const { data: settings }   = await _kivoClient.from('business_settings').select('*');
      const { data: clients }    = await _kivoClient.from('clients').select('*').order('created_at', { ascending: false });
      const { data: catalog }    = await _kivoClient.from('catalog').select('*').order('created_at', { ascending: true });
      const { data: documents }  = await _kivoClient.from('documents').select('*').order('created_at', { ascending: false });
      const { data: activities } = await _kivoClient.from('activities').select('*').order('created_at', { ascending: false }).limit(50);
      return {
        settings:   settings   || [],
        clients:    clients    || [],
        catalog:    catalog    || [],
        documents:  documents  || [],
        activities: activities || []
      };
    },

    saveDocument: async function (doc) {
      const payload = { ...doc };
      if (Array.isArray(payload.items)) {
        payload.items = JSON.stringify(payload.items);
      }
      return this.upsert('documents', payload);
    },

    saveClient:      async function (client)   { return this.upsert('clients', client); },
    saveCatalogItem: async function (item)     { return this.upsert('catalog', item); },
    saveSettings:    async function (settings) { return this.upsert('business_settings', settings); },

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

  console.log('[KivoDb] ✅ Supabase client initialized successfully.');

} // end guard
