/**
 * KIVO MATIQUE — Supabase Database Client
 * Project: KIVO MATIQUE (fzdtdfymvhydtoyqpdxd)
 * Region: eu-north-1
 */

const SUPABASE_URL = 'https://fzdtdfymvhydtoyqpdxd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6ZHRkZnltdmh5ZHRveXFwZHhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNjAyMTcsImV4cCI6MjEwMTkzNjIxN30.WK4pbZ1HYq5QDFasw3P3gKPz4KfMObGTfb721s5spdQ';

/**
 * Supabase REST API helper — lightweight, no SDK required
 */
window.KivoDb = {
  _headers: {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Prefer': 'return=representation'
  },

  _url: function(table, query = '') {
    return `${SUPABASE_URL}/rest/v1/${table}${query}`;
  },

  // ─── Generic CRUD ──────────────────────────────────────────────────

  /** SELECT - returns array of rows */
  select: async function(table, query = '') {
    try {
      const res = await fetch(this._url(table, query), {
        method: 'GET',
        headers: this._headers
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (e) {
      console.error(`[KivoDb] select(${table}) error:`, e);
      return null;
    }
  },

  /** INSERT - inserts one or more rows */
  insert: async function(table, data) {
    try {
      const res = await fetch(this._url(table), {
        method: 'POST',
        headers: this._headers,
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (e) {
      console.error(`[KivoDb] insert(${table}) error:`, e);
      return null;
    }
  },

  /** UPSERT - insert or update on conflict */
  upsert: async function(table, data, onConflict = 'id') {
    try {
      const res = await fetch(this._url(table, `?on_conflict=${onConflict}`), {
        method: 'POST',
        headers: { ...this._headers, 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (e) {
      console.error(`[KivoDb] upsert(${table}) error:`, e);
      return null;
    }
  },

  /** UPDATE - updates rows matching filter */
  update: async function(table, data, filter) {
    try {
      const res = await fetch(this._url(table, `?${filter}`), {
        method: 'PATCH',
        headers: this._headers,
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(await res.text());
      return await res.json();
    } catch (e) {
      console.error(`[KivoDb] update(${table}) error:`, e);
      return null;
    }
  },

  /** DELETE - deletes rows matching filter */
  delete: async function(table, filter) {
    try {
      const res = await fetch(this._url(table, `?${filter}`), {
        method: 'DELETE',
        headers: this._headers
      });
      if (!res.ok) throw new Error(await res.text());
      return true;
    } catch (e) {
      console.error(`[KivoDb] delete(${table}) error:`, e);
      return false;
    }
  },

  // ─── Domain-specific helpers ───────────────────────────────────────

  /** Load all app data from Supabase into KivoApp.state */
  loadAll: async function() {
    console.log('[KivoDb] Loading all data from Supabase...');
    const [settings, clients, catalog, documents, activities] = await Promise.all([
      this.select('business_settings', '?id=eq.default'),
      this.select('clients', '?order=created_at.desc'),
      this.select('catalog', '?order=created_at.asc'),
      this.select('documents', '?order=created_at.desc'),
      this.select('activities', '?order=created_at.desc&limit=50')
    ]);

    return { settings, clients, catalog, documents, activities };
  },

  /** Save (upsert) a single document */
  saveDocument: async function(doc) {
    // Convert items array to JSON string if needed
    const payload = { ...doc };
    if (Array.isArray(payload.items)) {
      payload.items = JSON.stringify(payload.items);
    }
    return this.upsert('documents', payload);
  },

  /** Save a client */
  saveClient: async function(client) {
    return this.upsert('clients', client);
  },

  /** Save a catalog item */
  saveCatalogItem: async function(item) {
    return this.upsert('catalog', item);
  },

  /** Save business settings */
  saveSettings: async function(settings) {
    return this.upsert('business_settings', settings);
  },

  /** Log an activity */
  logActivity: async function(activity) {
    return this.insert('activities', activity);
  },

  /** Delete a document by ID */
  deleteDocument: async function(id) {
    return this.delete('documents', `id=eq.${id}`);
  },

  /** Delete a client by ID */
  deleteClient: async function(id) {
    return this.delete('clients', `id=eq.${id}`);
  },

  /** Delete a catalog item by ID */
  deleteCatalogItem: async function(id) {
    return this.delete('catalog', `id=eq.${id}`);
  },

  /** Test connectivity - returns true if connected */
  ping: async function() {
    try {
      const res = await fetch(this._url('business_settings', '?id=eq.default&select=id'), {
        headers: this._headers
      });
      return res.ok;
    } catch {
      return false;
    }
  }
};

console.log('[KivoDb] Supabase client initialized for KIVO MATIQUE — fzdtdfymvhydtoyqpdxd');
