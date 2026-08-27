/**
 * KIVO MATIQUE — Authentication Management
 */

window.KivoAuth = {
  session: null,
  user: null,

  init: async function() {
    console.log('[KivoAuth] Initializing Auth...');
    
    // Check current session
    const { data: { session }, error } = await KivoDb.supabase.auth.getSession();
    if (error) {
      console.error('[KivoAuth] getSession error:', error);
    }
    
    this.session = session;
    this.user = session?.user || null;

    // Listen for auth state changes
    // NOTE: Do NOT call KivoApp.init() here — KivoApp handles its own session check on load.
    // This listener only updates KivoAuth state for sign-in/out events that happen AFTER load.
    KivoDb.supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[KivoAuth] Auth event: ${event}`);
      this.session = session;
      this.user = session?.user || null;
      
      if (event === 'SIGNED_OUT') {
        // Session was cleared — ensure login modal is shown
        const loginModal = document.getElementById('modal-login');
        if (loginModal) loginModal.style.display = 'flex';
      }
      // SIGNED_IN is handled by KivoApp.init() directly on page load.
      // Calling KivoApp.init() here again would cause double initialization.
    });
  },


  handleAuthRedirect: function() {
    if (!this.session) {
      console.warn('[KivoAuth] No active session. App data might fail RLS.');
      document.getElementById('modal-login').style.display = 'flex';
    } else {
      console.log('[KivoAuth] User is authenticated:', this.user.email);
      document.getElementById('modal-login').style.display = 'none';
    }
  },

  signUp: async function(email, password) {
    const { data, error } = await KivoDb.supabase.auth.signUp({ email, password });
    if (error) {
      console.error('[KivoAuth] signUp error:', error.message);
      return { error };
    }
    return { data };
  },

  signIn: async function(email, password) {
    const { data, error } = await KivoDb.supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('[KivoAuth] signIn error:', error.message);
      return { error };
    }
    return { data };
  },

  signOut: async function() {
    const { error } = await KivoDb.supabase.auth.signOut();
    if (error) console.error('[KivoAuth] signOut error:', error.message);
    else console.log('[KivoAuth] Successfully signed out.');
  }
};

// Auto-initialize when the script loads
document.addEventListener('DOMContentLoaded', () => {
  KivoAuth.init();
});
