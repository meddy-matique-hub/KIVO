/**
 * KIVO MATIQUE — Supabase Database Client (Official SDK)
 * Project: KIVO MATIQUE (fzdtdfymvhydtoyqpdxd)
 */

const SUPABASE_URL = 'https://fzdtdfymvhydtoyqpdxd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6ZHRkZnltdmh5ZHRveXFwZHhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNjAyMTcsImV4cCI6MjEwMTkzNjIxN30.WK4pbZ1HYq5QDFasw3P3gKPz4KfMObGTfb721s5spdQ';

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

window.KivoDb = {
  // We keep the same interface methods to avoid breaking app.js right away
  supabase,

  // ─── Generic CRUD (Wrapped over SDK) ───────────────────────────────

  select: async function (table, match = {}) {
    try {
      const { data, error } = await supabase.from(table).select('*').match(match);
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
      const { data: inserted, error } = await supabase.from(table).insert(data).select();
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
      const { data: upserted, error } = await supabase.from(table).upsert(data).select();
      if (error) throw error;
      return upserted;
    } catch (e) {
      console.error(`[KivoDb] upsert(${table}) error:`, e);
      return null;
    }
  },

  update: async function (table, data, match) {
    try {
      const { data: updated, error } = await supabase.from(table).update(data).match(match).select();
      if (error) throw error;
      return updated;
    } catch (e) {
      console.error(`[KivoDb] update(${table}) error:`, e);
      return null;
    }
  },

  delete: async function (table, match) {
    try {
      const { error } = await supabase.from(table).delete().match(match);
      if (error) throw error;
      return true;
    } catch (e) {
      console.error(`[KivoDb] delete(${table}) error:`, e);
      return false;
    }
  },

  // ─── Domain-specific helpers ───────────────────────────────────────

  loadAll: async function () {
    console.log('[KivoDb] Loading all data from Supabase (SDK)...');

    // Fetching data for the authenticated user only (handled by RLS)
    const { data: settings } = await supabase.from('business_settings').select('*');
    const { data: clients } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
    const { data: catalog } = await supabase.from('catalog').select('*').order('created_at', { ascending: true });
    const { data: documents } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    const { data: activities } = await supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(50);

    return {
      settings: settings || [],
      clients: clients || [],
      catalog: catalog || [],
      documents: documents || [],
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

  saveClient: async function (client) {
    return this.upsert('clients', client);
  },

  saveCatalogItem: async function (item) {
    return this.upsert('catalog', item);
  },

  saveSettings: async function (settings) {
    return this.upsert('business_settings', settings);
  },

  logActivity: async function (activity) {
    return this.insert('activities', activity);
  },

  deleteDocument: async function (id) {
    return this.delete('documents', { id });
  },

  deleteClient: async function (id) {
    return this.delete('clients', { id });
  },

  deleteCatalogItem: async function (id) {
    return this.delete('catalog', { id });
  }
};

console.log('[KivoDb] SDK Supabase initialized.');
