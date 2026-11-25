/**
 * KIVO MATIQUE — Client Supabase Serveur (Vercel Serverless Functions)
 * Utilise les variables d'environnement Vercel (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_ANON_KEY).
 */

const https = require('https');
const url = require('url');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fzdtdfymvhydtoyqpdxd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6ZHRkZnltdmh5ZHRveXFwZHhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNjAyMTcsImV4cCI6MjEwMTkzNjIxN30.WK4pbZ1HYq5QDFasw3P3gKPz4KfMObGTfb721s5spdQ';

/**
 * Exécute une requête REST HTTP vers PostgREST Supabase
 */
function supabaseFetch(path, options = {}) {
  return new Promise((resolve, reject) => {
    const fullUrl = `${SUPABASE_URL}/rest/v1${path}`;
    const parsed = url.parse(fullUrl);
    const method = options.method || 'GET';
    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': options.bearerToken ? `Bearer ${options.bearerToken}` : `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {})
    };

    const req = https.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.path,
      method: method,
      headers: headers
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let parsedBody = null;
        if (raw) {
          try {
            parsedBody = JSON.parse(raw);
          } catch (_) {
            parsedBody = raw;
          }
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsedBody
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      req.write(bodyStr);
    }
    req.end();
  });
}

/**
 * Récupère l'utilisateur Supabase à partir d'un JWT Bearer
 */
async function authenticateUser(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  return new Promise((resolve) => {
    const parsed = url.parse(`${SUPABASE_URL}/auth/v1/user`);
    const request = https.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.path,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${token}`
      }
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const user = JSON.parse(raw);
            resolve({ user, token });
          } catch (_) {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });

    request.on('error', () => resolve(null));
    request.end();
  });
}

module.exports = {
  SUPABASE_URL,
  SUPABASE_KEY,
  supabaseFetch,
  authenticateUser
};

