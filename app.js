/**
 * A2Z CYBER — Billing & Management System
 * app.js — Core Application Logic
 */

'use strict';

/**
 * ╔══════════════════════════════════════════════════════════╗
 *   A2Z CYBER — GLOBAL CONFIGURATION
 *   Paste your Web App URL here once to link all devices.
 * ╚══════════════════════════════════════════════════════════╝
 */
const GLOBAL_CONFIG = {
  webhookUrl: 'https://script.google.com/macros/s/AKfycbx3FKFdljjazCi8AFwwXS9vSCgUUt6rCdAniqFVtwOu5lvRW9tW3Io-WST-kSC-ngNUOQ/exec',
  supabaseUrl: 'https://ghhetbgfbtuvamzhkhrc.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoaGV0YmdmYnR1dmFtemhraHJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDU3NjIsImV4cCI6MjA5MTMyMTc2Mn0.INL2IR5rvUJ3On7sg8l3OH6M7ziuSYMOnpJRpfpNHK4'
};

let _supabaseClient = null;

/* ════════════════════════════════════════════════════════════
   STATE
   ════════════════════════════════════════════════════════════ */
const STATE = {
  currentStaff: '',
  currentRole: '',         // 'manager' or 'staff'
  currentPaymentMode: 'cash', // track selected payment mode
  transactions: [],        // completed transactions (persisted in localStorage)
  pendingSync: [],         // transactions waiting to be sent to Sheets
  withdrawals: [],         // staff commission withdrawals {id, staff, amount, date, paid}
  attendance: [],          // login/logout records {id, staff, loginTime, logoutTime}
  reportFilter: 'today',   // 'today' | 'week' | 'month' | 'all'
  settings: {
    webhookUrl: '',
    supabaseUrl: '',
    supabaseKey: '',
    staffList: [
      { name: 'Manager', password: '1997', role: 'manager', photo: '' },
      { name: 'Sayan Roy', password: '2026', role: 'staff', photo: '' },
      { name: 'Rupa Majumder', password: '3000', role: 'staff', photo: '' }
    ],
    services: [
      { id: 'printout-bw',    name: 'Print BK',     price: 2,  icon: '🖨️', category: 'Printing' },
      { id: 'printout-col',   name: 'Print Color',  price: 10, icon: '🎨', category: 'Printing' },
      { id: 'xerox-single',   name: 'Xerox BK',     price: 2,  icon: '📄', category: 'Xerox' },
      { id: 'xerox-col',      name: 'Xerox Color',  price: 5,  icon: '🌈', category: 'Xerox' },
      { id: 'form-fillup',    name: 'Form Fillup',  price: 50, icon: '📝', category: 'Documentation' },
      { id: 'scan',           name: 'Scanning',     price: 10, icon: '🔍', category: 'Misc' },
      { id: 'lamination',     name: 'Lamination',   price: 15, icon: '🗂️', category: 'Misc' },
      { id: 'passport-photo', name: 'Passport Photo', price: 40, icon: '📸', category: 'Photography' },
    ],
    rushItems: [
      { id: 'rush-xerox-bk',   name: 'BK Xerox',   price: 2,  icon: '📄', colorClass: 'rush-tap-bk' },
      { id: 'rush-xerox-col',  name: 'Colour Xerox', price: 5,  icon: '🌈', colorClass: 'rush-tap-col' },
      { id: 'rush-print-bk',   name: 'BK Print',    price: 3,  icon: '🖨️', colorClass: 'rush-tap-bkp' },
      { id: 'rush-print-col',  name: 'Colour Print', price: 8,  icon: '🎨', colorClass: 'rush-tap-colp' },
      { id: 'rush-print-bke',  name: 'BK Print (Edited)', price: 8,  icon: '🖨️✨', colorClass: 'rush-tap-bkp' },
      { id: 'rush-print-cole', name: 'Colour Print (Edited)', price: 10, icon: '🎨✨', colorClass: 'rush-tap-colp' },
      { id: 'rush-page-a4',    name: 'A4 Page',     price: 1,  icon: '📄', colorClass: 'rush-tap-bk' },
    ],
    quotes: [
      '⚡ Every bill is a step toward your goal. Keep pushing!',
      '🚀 Fast service = happy customers = bigger commission!',
      '💪 You are the heartbeat of A2Z CYBER. Keep going!',
      '🌟 Small actions, big results. Bill with pride!',
      '🎯 Stay focused. Your efforts are building something great.',
      '🔥 Rush hour? You were born ready for this!',
      '💡 Every customer who walks in is an opportunity. Grab it!',
      '🏆 Champions show up every day. That is you!',
      '🌈 Your smile is part of our service. Keep shining!',
      '⚙️ Precision + speed = excellence. You have got this!',
      '💰 More bills = more growth. Lets go!',
      '🎖️ Great service is not an accident. It is your habit.',
      '🌊 Ride the rush with confidence. You are trained for this.',
      '💎 Quality work done fast is your superpower.',
      '🦁 Work like a lion - focused, bold, unstoppable.',
      '📈 Every satisfied customer is a win. Log it!',
      '🎪 Make every customer feel like the most important one.',
      '⭐ Excellence is doing ordinary things extraordinarily well.',
      '🏅 Today is your chance to be better than yesterday.',
      '🧠 Smart billing = faster service = proud staff.',
    ]
  },
};

/**
 * JSON-P Helper for CORS-free reading on local files (file://)
 */
function fetchJsonp(url, params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = 'jsonp_cb_' + Math.round(100000 * Math.random());
    const query = new URLSearchParams(params);
    query.set('callback', callbackName);
    
    const script = document.createElement('script');
    script.src = url + (url.includes('?') ? '&' : '?') + query.toString();
    
    window[callbackName] = (data) => {
      delete window[callbackName];
      document.body.removeChild(script);
      resolve(data);
    };
    
    script.onerror = () => {
      delete window[callbackName];
      document.body.removeChild(script);
      reject(new Error('JSONP fetch failed'));
    };
    
    document.body.appendChild(script);
  });
}

/**
 * Supabase Initialization — uses a cached client to avoid re-creating.
 */
function initSupabase() {
  if (_supabaseClient) return true; // Already initialized
  const url = (STATE.settings.supabaseUrl || '').trim();
  const key = (STATE.settings.supabaseKey || '').trim();
  
  // The CDN exposes the library as window.supabase (the module namespace)
  if (url && key && window.supabase && window.supabase.createClient) {
    try {
      _supabaseClient = window.supabase.createClient(url, key);
      console.log('⚡ Supabase Client Initialized');
      return true;
    } catch(e) {
      console.error('Supabase init failed', e);
    }
  }
  return false;
}

/**
 * Get the initialized Supabase client (or null).
 */
function getSupabaseClient() {
  initSupabase();
  return _supabaseClient;
}

/**
 * HELPER: Returns the best webhook URL available.
 * Prioritizes the UI-entered URL over the hardcoded fallback.
 */
function getWebhookUrl() {
  const uiUrl = (STATE.settings.webhookUrl || '').trim();
  // Use UI URL if it looks valid, otherwise fallback to GLOBAL_CONFIG
  return (uiUrl.startsWith('http')) ? uiUrl : GLOBAL_CONFIG.webhookUrl;
}

/**
 * Fetch cloud CONFIG from Supabase or Google Sheets.
 */
async function fetchCloudConfig() {
  // Try Supabase first
  const db = getSupabaseClient();
  if (db) {
    try {
      const { data, error } = await db.from('app_settings').select('*');
      if (!error && data) {
        data.forEach(item => {
          if (STATE.settings[item.key] !== undefined) {
            STATE.settings[item.key] = item.value;
          }
        });
        localStorage.setItem('a2z_settings', JSON.stringify(STATE.settings));
        console.log('✅ Supabase config loaded!');
        return true;
      }
    } catch(e) { console.warn('Supabase config fetch failed', e); }
  }

  // Fallback to Google Sheets
  const url = getWebhookUrl();
  if (!url) return false;
  try {
    const json = await fetchJsonp(url, { action: 'getConfig' });
    if (json.staffList) STATE.settings.staffList = json.staffList;
    if (json.services) STATE.settings.services = json.services;
    if (json.rushItems) STATE.settings.rushItems = json.rushItems;
    if (json.quotes) STATE.settings.quotes = json.quotes;
    if (json.webhookUrl && !GLOBAL_CONFIG.webhookUrl) STATE.settings.webhookUrl = json.webhookUrl.trim();

    localStorage.setItem('a2z_settings', JSON.stringify(STATE.settings));
    console.log('✅ Google Sheets config loaded!');
    return true;
  } catch(e) {
    console.warn('⚠️ Cloud config fetch failed', e);
    return false;
  }
}

/**
 * Push current settings config to Supabase/Cloud.
 */
async function pushConfigToSupabase() {
  const db = getSupabaseClient();
  if (db) {
    showToast('Pushing config to Supabase...', 'info');
    const keys = ['staffList', 'services', 'rushItems', 'quotes'];
    const updates = keys.map(k => ({ key: k, value: STATE.settings[k], updated_at: new Date() }));
    
    try {
      const { error } = await db.from('app_settings').upsert(updates);
      if (!error) {
        showToast('✅ Supabase config updated!', 'success');
        return;
      }
      throw error;
    } catch(e) {
      console.error('Supabase push failed', e);
      showToast('Supabase push failed, trying Sheets...', 'warning');
    }
  }
  await pushConfigToCloud();
}

/**
 * Fetch transactions from Supabase/Cloud.
 */
async function fetchCloudData() {
  console.log('☁️ Fetching cloud transactions...');
  
  let cloudTransactions = [];
  
  const db = getSupabaseClient();
  if (db) {
    try {
      // Fetch ALL transactions (no date filter) so weekly/monthly reports work
      const { data, error } = await db
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .limit(5000); // reasonable cap
        
      if (!error && data) {
        cloudTransactions = data.map(tx => ({
          id:              tx.id,
          date:            tx.date,
          customerName:    tx.customer_name    ?? tx.customerName    ?? 'Walk-in Customer',
          mobile:          tx.mobile           ?? '',
          address:         tx.address          ?? '',
          staff:           tx.staff            ?? '',
          service:         tx.service          ?? '',
          jobType:         tx.job_type         ?? tx.jobType         ?? 'service',
          paymentMode:     tx.payment_mode     ?? tx.paymentMode     ?? 'cash',
          amount:          tx.amount           ?? 0,
          displayDuration: tx.display_duration ?? tx.displayDuration ?? '',
          notes:           tx.notes            ?? '',
          items:           tx.items            ?? [],
          syncStatus:      'synced'
        }));
      }
    } catch(e) { console.warn('Supabase fetch failed', e); }
    
    try {
      const { data: wData, error: wError } = await db.from('withdrawals').select('*').order('date', { ascending: false });
      if (!wError && wData) {
        const cloudWMap = {};
        wData.forEach(w => { cloudWMap[w.id] = w; });
        const wMerged = [...wData];
        STATE.withdrawals.forEach(w => { if (!cloudWMap[w.id]) wMerged.unshift(w); });
        STATE.withdrawals = wMerged;
        saveState();
      }
    } catch(e) { console.warn('Supabase withdrawals fetch failed', e); }
  }

  // If Supabase failed or returned nothing, try Sheets as fallback
  if (cloudTransactions.length === 0) {
    const url = getWebhookUrl();
    if (url) {
      try {
        const sheetsData = await fetchJsonp(url, { action: 'get' });
        if (Array.isArray(sheetsData)) cloudTransactions = sheetsData;
      } catch(e) { console.warn('Sheets fetch failed', e); }
    }
  }

  if (cloudTransactions.length > 0) {
    const pendingIds = new Set(STATE.pendingSync.map(p => p.id));
    const localPending = STATE.transactions.filter(tx => pendingIds.has(tx.id));
    const cloudMap = {};
    cloudTransactions.forEach(tx => { if (tx.id) cloudMap[tx.id] = tx; });
    const merged = [...cloudTransactions];
    localPending.forEach(lp => { if (!cloudMap[lp.id]) merged.unshift(lp); });
    STATE.transactions = merged;
    saveState();
    renderRecentTable();
    updateDashboardStats();
    console.log(`✅ ${cloudTransactions.length} transactions loaded!`);
  }
}

async function syncToSupabase(transaction) {
  const db = getSupabaseClient();
  if (!db) return 'failed';
  try {
    const { error } = await db.from('transactions').upsert({
      id: transaction.id,
      date: transaction.date,
      customer_name: transaction.customerName,
      mobile: transaction.mobile,
      address: transaction.address || '',
      staff: transaction.staff,
      service: transaction.service,
      job_type: transaction.jobType,
      payment_mode: transaction.paymentMode,
      amount: transaction.amount,
      display_duration: transaction.displayDuration,
      notes: transaction.notes,
      items: transaction.items || []
    });
    return error ? 'failed' : 'synced';
  } catch(e) {
    console.error('Supabase sync error:', e);
    return 'failed';
  }
}

async function syncWithdrawalToSupabase(withdrawal) {
  const db = getSupabaseClient();
  if (!db) return 'failed';
  try {
    const { error } = await db.from('withdrawals').upsert({
      id: withdrawal.id,
      staff: withdrawal.staff,
      amount: withdrawal.amount,
      date: withdrawal.date
    });
    return error ? 'failed' : 'synced';
  } catch(e) {
    console.error('Supabase sync error for withdrawal:', e);
    return 'failed';
  }
}

async function syncAllTransactionsToSupabase() {
  if (!getSupabaseClient()) { showToast('Configure Supabase first!', 'error'); return; }
  const all = STATE.transactions;
  if (!all.length) return;
  
  showCloudSyncBanner(`☁️ Syncing ${all.length} bills to Supabase...`);
  let ok = 0, fail = 0;
  for (const tx of all) {
    const result = await syncToSupabase(tx);
    if (result === 'synced') { tx.syncStatus = 'synced'; ok++; }
    else fail++;
  }
  saveState();
  renderRecentTable();
  updateDashboardStats();
  hideCloudSyncBanner();
  showToast(fail === 0 ? `✅ All ${ok} synced!` : `⚠️ ${ok} synced, ${fail} failed`, fail === 0 ? 'success' : 'warning');
}

async function testSupabaseConnection() {
  const db = getSupabaseClient();
  if (!db) { showToast('Enter Supabase URL & Key first!', 'error'); return; }
  showToast('Testing Supabase...', 'info');
  try {
    const { error } = await db.from('app_settings').select('count', { count: 'exact', head: true });
    if (error) throw error;
    showToast('✅ Supabase Connected!', 'success');
  } catch(e) {
    showToast('❌ Supabase Connection Failed: ' + e.message, 'error', 10000);
  }
}




/* SCREENS list for navigation toggle */
const SCREENS = [
  'login', 'dashboard', 'service-form', 'rush-billing', 'reports', 'settings', 'services', 'customer-db'
];

/* ════════════════════════════════════════════════════════════
   MOTIVATION QUOTES
   ════════════════════════════════════════════════════════════ */
function showMotivationalQuote(containerId) {
  const el = $(containerId);
  if (!el) return;
  const quotes = STATE.settings.quotes || [];
  if (quotes.length === 0) {
     el.textContent = "Stay focused and keep growing! 🚀";
     return;
  }
  const q = quotes[Math.floor(Math.random() * quotes.length)];
  el.textContent = q;
}

function startQuoteRotation() {
  setInterval(() => {
    showMotivationalQuote('dashboard-motivation');
    showMotivationalQuote('rush-motivation-quote');
    showMotivationalQuote('sf-motivation-quote-text');
  }, 120000);
}

/* ════════════════════════════════════════════════════════════
   UTILITIES
════════════════════════════════════════════════════════════ */
function $(id) { return document.getElementById(id); }

function showScreen(name) {
  SCREENS.forEach(s => {
    const el = $(`screen-${s}`);
    if (el) el.classList.toggle('active', s === name);
  });
  window.scrollTo(0, 0);
}

function showToast(msg, type = 'info', duration = 2800) {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast toast-${type}`;
  t.classList.remove('hidden');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.add('hidden'), duration);
}

/**
 * Shows a subtle banner below the login card while syncing with the cloud.
 */
function showCloudSyncBanner(msg, type = 'info', autoDismissMs = 0) {
  let banner = $('cloud-sync-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'cloud-sync-banner';
    banner.style.cssText = [
      'position:fixed', 'bottom:1.5rem', 'left:50%',
      'transform:translateX(-50%)', 'z-index:9999',
      'padding:0.55rem 1.4rem', 'border-radius:50px',
      'font-size:0.82rem', 'font-weight:600',
      'display:flex', 'align-items:center', 'gap:0.5rem',
      'backdrop-filter:blur(12px)',
      'box-shadow:0 4px 20px rgba(0,0,0,0.25)',
      'transition:opacity 0.4s ease',
      'white-space:nowrap'
    ].join(';');
    document.body.appendChild(banner);
  }
  const colors = {
    info:    'background:rgba(0,40,70,0.9);color:#00c8ff;border:1px solid rgba(0,200,255,0.25)',
    success: 'background:rgba(0,60,30,0.9);color:#00e676;border:1px solid rgba(0,230,118,0.25)',
    error:   'background:rgba(70,0,0,0.9);color:#ff5252;border:1px solid rgba(255,82,82,0.25)',
  };
  banner.style.cssText += ';' + (colors[type] || colors.info);
  banner.textContent = msg;
  banner.style.opacity = '1';
  banner.style.display = 'flex';
  clearTimeout(banner._timer);
  if (autoDismissMs > 0) {
    banner._timer = setTimeout(() => hideCloudSyncBanner(), autoDismissMs);
  }
}

function hideCloudSyncBanner() {
  const banner = $('cloud-sync-banner');
  if (!banner) return;
  banner.style.opacity = '0';
  setTimeout(() => { banner.style.display = 'none'; }, 400);
}


function formatCurrency(amount) {
  return `₹${parseFloat(amount).toFixed(2)}`;
}

function formatDateTimeShort(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' }) + ' ' +
         d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getToday() {
  const today = getTodayKey();
  return STATE.transactions.filter(tx => tx.date.startsWith(today));
}

/* ════════════════════════════════════════════════════════════
   PERSISTENCE
════════════════════════════════════════════════════════════ */
function saveState() {
  try {
    localStorage.setItem('a2z_transactions', JSON.stringify(STATE.transactions));
    localStorage.setItem('a2z_settings', JSON.stringify(STATE.settings));
    localStorage.setItem('a2z_pendingSync', JSON.stringify(STATE.pendingSync));
    localStorage.setItem('a2z_withdrawals', JSON.stringify(STATE.withdrawals));
    localStorage.setItem('a2z_attendance', JSON.stringify(STATE.attendance));
    localStorage.setItem('a2z_currentStaff', STATE.currentStaff || '');
    localStorage.setItem('a2z_currentRole', STATE.currentRole || '');
  } catch(e) { console.warn('Save failed', e); }
}

function loadState() {
  try {
    const tx = localStorage.getItem('a2z_transactions');
    if (tx) STATE.transactions = JSON.parse(tx);

    const st = localStorage.getItem('a2z_settings');
    if (st) STATE.settings = { ...STATE.settings, ...JSON.parse(st) };

    const ps = localStorage.getItem('a2z_pendingSync');
    if (ps) STATE.pendingSync = JSON.parse(ps);

    const wd = localStorage.getItem('a2z_withdrawals');
    if (wd) STATE.withdrawals = JSON.parse(wd);

    const att = localStorage.getItem('a2z_attendance');
    if (att) STATE.attendance = JSON.parse(att);

    STATE.currentStaff = localStorage.getItem('a2z_currentStaff') || '';
    STATE.currentRole = localStorage.getItem('a2z_currentRole') || '';
  } catch(e) { console.warn('Load failed', e); }
}

/* ════════════════════════════════════════════════════════════
   GOOGLE SHEETS SYNC
════════════════════════════════════════════════════════════ */
async function syncToSheets(transaction, action = 'upsert') {
  const url = getWebhookUrl();
  if (!url) return 'no-url';
  try {
    const payload = JSON.stringify({
      action: action,
      transaction: transaction
    });

    // We use a Blob with text/plain to ensure it's a "Simple Request"
    // that bypasses CORB and CORS preflight triggers.
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      body: new Blob([payload], { type: 'text/plain' })
    });
    return 'synced';
  } catch(e) {
    console.error('Sync error:', e);
    return 'failed';
  }
}

async function processPendingSync() {
  if (!STATE.pendingSync.length || !STATE.settings.webhookUrl) return;
  const toProcess = [...STATE.pendingSync];
  STATE.pendingSync = [];
  saveState();
  for (const tx of toProcess) {
    const result = await syncToSheets(tx);
    if (result !== 'synced') STATE.pendingSync.push(tx);
  }
  saveState();
  renderRecentTable();
}

/**
 * AUTO-SYNC: Silently pushes only UN-SYNCED bills to cloud.
 * Runs automatically on every login and app startup — no button needed.
 */
async function autoSyncUnsyncedBills() {
  const url = getWebhookUrl();
  if (!url) return;

  // Only pick bills that haven't been confirmed synced yet
  const unsynced = STATE.transactions.filter(tx => tx.syncStatus !== 'synced');
  if (!unsynced.length) return;

  console.log(`☁️ Auto-syncing ${unsynced.length} unsynced bills...`);

  for (const tx of unsynced) {
    const result = await syncToSheets(tx, 'upsert');
    if (result === 'synced') {
      tx.syncStatus = 'synced';
      // Remove from pendingSync if present
      STATE.pendingSync = STATE.pendingSync.filter(p => p.id !== tx.id);
    }
  }

  saveState();
  renderRecentTable();
  updateDashboardStats();
  console.log('✅ Auto-sync complete!');
}

/**
 * MANUAL: Force-push ALL local transactions to Google Sheets (button use).
 */
async function syncAllTransactionsToCloud() {
  const url = getWebhookUrl();
  if (!url) { showToast('No cloud URL configured!', 'error'); return; }

  const all = STATE.transactions;
  if (!all.length) { showToast('No local transactions to sync', 'info'); return; }

  showCloudSyncBanner(`☁️ Syncing ${all.length} bills to cloud...`);
  showToast(`Uploading ${all.length} bills...`, 'info', 5000);

  let ok = 0, fail = 0;
  for (const tx of all) {
    const result = await syncToSheets(tx, 'upsert');
    if (result === 'synced') { tx.syncStatus = 'synced'; ok++; }
    else fail++;
  }

  saveState();
  renderRecentTable();
  updateDashboardStats();
  hideCloudSyncBanner();

  if (fail === 0) {
    showToast(`✅ All ${ok} bills synced! Other devices will now see them.`, 'success', 4000);
    showCloudSyncBanner(`✅ ${ok} bills synced! All devices updated.`, 'success', 4000);
  } else {
    showToast(`⚠️ ${ok} synced, ${fail} failed. Check internet & retry.`, 'warning', 4000);
  }
}

/**
 * Explicit connectivity test to detect CORS or network issues.
 */
async function testCloudConnection() {
  const url = getWebhookUrl();
  if (!url) {
    showToast('Enter a Webhook URL first!', 'error');
    return;
  }

  showToast('Testing cloud connection...', 'info');
  const statusEl = $('webhook-status');
  if (statusEl) statusEl.innerHTML = '<span class="loading-dots">Testing READ/WRITE...</span>';

  try {
    // Universal Test READ: Always use JSONP for maximum reliability across devices/platforms
    const data = await fetchJsonp(url, { action: 'getConfig' });
    
    // We expect config keys or an empty object, not an error
    if (data && !data.error) {
      showToast('✅ Cloud Sync is working perfectly!', 'success');
      if (statusEl) {
        statusEl.innerHTML = '✅ Connected! Your device can read and write to Google Sheets.';
        statusEl.className = 'webhook-status success';
        // Auto-refresh the settings view to show the status clearly
        renderSettings(); 
      }
    } else {
      throw new Error(data ? data.error : 'Invalid response');
    }
  } catch (e) {
    console.error('Connection test failed:', e);
    const isFile = window.location.protocol === 'file:';
    const msg = isFile 
      ? '❌ READ failed. Did you redeploy your Google Script with Anyone access?'
      : '❌ Connection failed. Check if Script URL is correct and public.';
    
    showToast(msg, 'error', 12000);
    if (statusEl) {
      statusEl.innerHTML = `
        <div style="color:var(--red); font-weight:700;">${msg}</div>
        <div style="margin-top:0.5rem; font-size:0.8rem; line-height:1.4; color:var(--text-secondary);">
          <b>Troubleshooting steps:</b><br>
          1. Deployment URL must end in <b>/exec</b> (not /dev)<br>
          2. Access must be <b>"Anyone"</b><br>
          3. Ensure you clicked <b>Deploy → New Deployment</b>
        </div>
      `;
      statusEl.className = 'webhook-status error';
    }
  }
}

/**
 * HARD RESET: Clears all local storage and reloads.
 * Use as a last resort if app state is corrupted.
 */
window.hardResetApp = function() {
  if (confirm("⚠️ This will clear ALL local transactions and settings. Are you sure?")) {
    localStorage.clear();
    window.location.reload();
  }
};

window.testCloudConnection = testCloudConnection;

window.syncAllTransactionsToCloud = syncAllTransactionsToCloud;

/* ════════════════════════════════════════════════════════════
   CLOCK
════════════════════════════════════════════════════════════ */
function startClock() {
  function tick() {
    const el = $('live-clock');
    const heroTime = $('hero-clock-time');
    const heroDate = $('hero-clock-date');
    if (!el && !heroTime) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
    
    if (el) el.textContent = timeStr;
    if (heroTime) heroTime.textContent = timeStr;
    if (heroDate) {
      heroDate.textContent = now.toLocaleDateString('en-IN', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
      });
    }
  }
  tick();
  setInterval(tick, 1000);
}

/* ════════════════════════════════════════════════════════════
   STAFF LOGIN BUTTONS
════════════════════════════════════════════════════════════ */
function renderStaffLoginButtons() {
  const grid = $('staff-btn-grid');
  if (!grid) return;
  const avatarColors = [
    'linear-gradient(135deg,#00c8ff,#00ffc8)',
    'linear-gradient(135deg,#7b5df8,#00c8ff)',
    'linear-gradient(135deg,#ff6b35,#ffb300)',
    'linear-gradient(135deg,#00e676,#00c8ff)',
    'linear-gradient(135deg,#ff4d6d,#7b5df8)',
  ];
  grid.innerHTML = STATE.settings.staffList.map((s, i) => {
    const avatarContent = s.photo 
      ? `<img src="${s.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
      : s.name.charAt(0).toUpperCase();
    
    return `
    <button class="staff-login-btn" onclick="selectStaff('${s.name}')">
      <div class="staff-avatar" style="background:${s.photo ? 'none' : avatarColors[i % avatarColors.length]}">${avatarContent}</div>
      <span>${s.name}</span>
    </button>
  `}).join('');
}

let selectedStaffName = '';

window.selectStaff = function(name) {
  selectedStaffName = name;
  $('login-staff-name').textContent = name;
  $('login-password-input').value = '';
  $('login-selection-view').classList.add('hidden');
  $('login-password-view').classList.remove('hidden');
  $('login-password-input').focus();
};

window.showStaffSelection = function() {
  $('login-selection-view').classList.remove('hidden');
  $('login-password-view').classList.add('hidden');
};

window.handleLogin = function() {
  const password = $('login-password-input').value;
  const staff = STATE.settings.staffList.find(s => s.name === selectedStaffName);
  
  if (staff && staff.password === password) {
    loginAsStaff(staff);
  } else {
    showToast('Incorrect password!', 'error');
    $('login-password-input').value = '';
    $('login-password-input').focus();
  }
};

window.loginAsStaff = function(staff) {
  STATE.currentStaff = staff.name;
  STATE.currentRole = staff.role;

  // --- Attendance: record login time ---
  if (staff.role !== 'manager') {
    const sessionId = generateId();
    window._currentAttendanceId = sessionId;
    const record = { id: sessionId, staff: staff.name, loginTime: new Date().toISOString(), logoutTime: null };
    STATE.attendance.push(record);
    saveState();
    syncAttendanceToSupabase(record);
  }

  saveState();
  $('header-staff-name').textContent = staff.name;
  renderRecentTable();
  updateDashboardStats();
  showScreen('dashboard');
  showToast(`Welcome, ${staff.name}!`, 'success');
  showMotivationalQuote('dashboard-motivation');
  
  // Hide/Show Manager specific actions
  if (staff.role === 'manager') {
    $('btn-reports').classList.remove('hidden');
    $('btn-settings').classList.remove('hidden');
    $('btn-manage-services').classList.remove('hidden');
    $('btn-customer-db').classList.remove('hidden');
    $('btn-clear-history').classList.remove('hidden');
    if($('btn-withdrawal-review')) $('btn-withdrawal-review').classList.remove('hidden');
    if($('btn-attendance')) $('btn-attendance').classList.remove('hidden');
  } else {
    $('btn-reports').classList.add('hidden'); 
    $('btn-settings').classList.add('hidden');
    $('btn-manage-services').classList.add('hidden');
    $('btn-customer-db').classList.add('hidden');
    $('btn-clear-history').classList.add('hidden');
    if($('btn-withdrawal-review')) $('btn-withdrawal-review').classList.add('hidden');
    if($('btn-attendance')) $('btn-attendance').classList.add('hidden');
  }

  // Silently pull latest cloud transactions so this device is up-to-date
  const hasCloud = STATE.settings.supabaseUrl || STATE.settings.webhookUrl;
  if (hasCloud) {
    autoSyncUnsyncedBills().then(() => {
      fetchCloudData();
    });
  }
};

/* ════════════════════════════════════════════════════════════
   DASHBOARD STATS
════════════════════════════════════════════════════════════ */
function getToday() {
  const today = getTodayKey();
  return STATE.transactions.filter(tx => tx.date.startsWith(today));
}

function updateDashboardStats() {
  let todayTx = getToday();
  const commissionCard = $('stat-commission-card');
  const allTimeCommCard = $('stat-alltime-commission-card');
  const extraSection = $('manager-dashboard-extra');

  // Filter for staff visibility
  if (STATE.currentRole !== 'manager') {
    todayTx = todayTx.filter(tx => tx.staff === STATE.currentStaff);
    $('stat-income').parentElement.parentElement.style.display = 'none';
    if(commissionCard) commissionCard.style.display = 'flex';
    if(allTimeCommCard) allTimeCommCard.style.display = 'flex';
    if(extraSection) extraSection.classList.add('hidden');
  } else {
    $('stat-income').parentElement.parentElement.style.display = 'flex';
    if(commissionCard) commissionCard.style.display = 'none';
    if(allTimeCommCard) allTimeCommCard.style.display = 'none';
    if(extraSection) extraSection.classList.remove('hidden');
  }

  const income = todayTx.reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
  
  // Calculate specific totals (Manager only view mostly, but good to have)
  const cashTotal = todayTx.filter(tx => tx.paymentMode === 'cash').reduce((s, tx) => s + parseFloat(tx.amount), 0);
  const upiTotal  = todayTx.filter(tx => tx.paymentMode === 'upi').reduce((s, tx) => s + parseFloat(tx.amount), 0);

  // Active Staff (Unique staff who billed today)
  const activeStaffSet = new Set(getToday().map(tx => tx.staff));
  const activeStaffCount = activeStaffSet.size;

  // Render Stats
  $('stat-customers').textContent = todayTx.length;
  $('stat-income').textContent = formatCurrency(income);
  $('stat-printjobs').textContent = todayTx.length; // Simplified
  
  if($('stat-commission')) {
    const govFeesTotal = todayTx.reduce((s, tx) => {
      const feeItem = tx.items?.find(i => i.name === 'Gov Fees');
      return s + (feeItem ? parseFloat(feeItem.price) : 0);
    }, 0);
    
    const todaysCommissionVal = (income - govFeesTotal) * 0.10;
    $('stat-commission').textContent = formatCurrency(todaysCommissionVal);

    // Milestone Celebration Logic (Every 50)
    if (STATE.currentRole !== 'manager') {
      const currentMilestone = Math.floor(todaysCommissionVal / 50) * 50;
      if (typeof window._lastCelebratedCommission === 'undefined') {
        window._lastCelebratedCommission = currentMilestone; // Initialize silently on boot
      } else if (currentMilestone > window._lastCelebratedCommission && currentMilestone >= 50) {
        window._lastCelebratedCommission = currentMilestone;
        triggerMilestoneCelebration(currentMilestone);
      }
    }
  }

  // All time commission for Staff
  if ($('stat-alltime-commission')) {
    const allTimeTx = STATE.transactions.filter(tx => tx.staff === STATE.currentStaff);
    const totalAllTimeIncome = allTimeTx.reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
    const totalAllTimeGovFees = allTimeTx.reduce((s, tx) => {
      const feeItem = tx.items?.find(i => i.name === 'Gov Fees');
      return s + (feeItem ? parseFloat(feeItem.price) : 0);
    }, 0);
    $('stat-alltime-commission').textContent = formatCurrency((totalAllTimeIncome - totalAllTimeGovFees) * 0.10);
  }

  // Hero Mini Stats
  if($('dashboard-total-income')) $('dashboard-total-income').textContent = formatCurrency(income);
  if($('dashboard-staff-count')) $('dashboard-staff-count').textContent = activeStaffCount;

  // Daily Summary (Extra Section)
  if($('summary-total-cash')) $('summary-total-cash').textContent = formatCurrency(cashTotal);
  if($('summary-total-upi')) $('summary-total-upi').textContent = formatCurrency(upiTotal);

  // Update Cloud Status Badge
  const sheetsBadge = $('sheets-status-val');
  if (sheetsBadge) {
    if (STATE.settings.supabaseUrl) {
      sheetsBadge.textContent = '⚡ SUPABASE';
      sheetsBadge.style.color = 'var(--teal)';
    } else if (STATE.settings.webhookUrl) {
      sheetsBadge.textContent = 'SHEETS';
      sheetsBadge.style.color = 'var(--green)';
    } else {
      sheetsBadge.textContent = 'NOT LINKED';
      sheetsBadge.style.color = 'var(--red)';
    }
  }

  // Staff Performance (Manager only)
  if (STATE.currentRole === 'manager') {
    renderStaffPerformance();
  }
}

function renderStaffPerformance() {
  const list = $('staff-performance-list');
  if (!list) return;

  const today = getToday();
  const staffData = {};

  today.forEach(tx => {
    if (!staffData[tx.staff]) staffData[tx.staff] = { count: 0, revenue: 0 };
    staffData[tx.staff].count++;
    staffData[tx.staff].revenue += parseFloat(tx.amount);
  });

  const html = Object.entries(staffData).map(([name, data]) => `
    <div class="glass-pill" style="display:flex; justify-content:space-between; align-items:center; padding:0.6rem 1rem; border:1px solid #eef2f6;">
      <div style="font-weight:700; color:var(--text-primary); font-size:0.9rem;">${name}</div>
      <div style="display:flex; gap:1.5rem; font-size:0.85rem;">
        <span style="color:var(--text-muted)">Jobs: <b style="color:var(--text-primary)">${data.count}</b></span>
        <span style="color:var(--text-muted)">Earned: <b style="color:var(--teal)">${formatCurrency(data.revenue)}</b></span>
      </div>
    </div>
  `).join('');

  list.innerHTML = html || '<div class="empty-state">No activity yet.</div>';
}

/* ════════════════════════════════════════════════════════════
   JOB MANAGEMENT
════════════════════════════════════════════════════════════ */


function saveServiceJob(data) {
  const transaction = {
    id: generateId(),
    customerName: data.customerName,
    mobile: data.mobile,
    address: data.address || '',
    staff: data.staff,
    service: 'Print/Xerox/Form',
    jobType: 'service',
    paymentMode: STATE.currentPaymentMode || 'cash',
    items: data.items,
    amount: data.total.toFixed(2),
    date: new Date().toISOString(),
    syncStatus: 'pending',
    displayDuration: `${data.items.length} item(s)`
  };

  STATE.transactions.unshift(transaction);
  STATE.pendingSync.push(transaction);
  saveState();

  // Reset payment mode to default Cash
  STATE.currentPaymentMode = 'cash';
  document.querySelectorAll('.pm-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === 'cash');
  });

  renderRecentTable();
  updateDashboardStats();

  // Try Supabase first, then fall back to Google Sheets
  const syncFn = getSupabaseClient() ? syncToSupabase : (tx) => syncToSheets(tx, 'upsert');
  syncFn(transaction).then(result => {
    transaction.syncStatus = result === 'synced' ? 'synced' : 'pending';
    if (result === 'synced') {
      STATE.pendingSync = STATE.pendingSync.filter(t => t.id !== transaction.id);
      if($('sheets-status-val')) $('sheets-status-val').textContent = 'SYNCED ✅';
    }
    saveState();
    renderRecentTable();
  });

  showReceiptModal(transaction);
  if (STATE.currentRole !== 'manager' && typeof confetti === 'function') {
    setTimeout(triggerCommissionConfetti, 300);
  }
}

window.triggerCommissionConfetti = function() {
  const count = 200;
  const defaults = { origin: { y: 0.7 }, zIndex: 99999 };

  function fire(particleRatio, opts) {
    confetti({ ...defaults, ...opts, particleCount: Math.floor(count * particleRatio) });
  }

  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
};

window.triggerMilestoneCelebration = function(amount) {
  if (typeof confetti !== 'function') return;
  const duration = 3000;
  const end = Date.now() + duration;

  showToast(`🏆 Milestone Reached: ₹${amount} Commission!`, 'success');

  (function frame() {
    confetti({
      particleCount: 8,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#00a0dc', '#00bfa5', '#ff8f00', '#6d4aff']
    });
    confetti({
      particleCount: 8,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#00a0dc', '#00bfa5', '#ff8f00', '#6d4aff']
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());
};

/* ════════════════════════════════════════════════════════════
   RECEIPT MODAL
════════════════════════════════════════════════════════════ */
function showReceiptModal(tx) {
  const modal = $('modal-receipt');
  const body  = $('receipt-body');

  let html = `
    <div class="receipt-row"><span class="receipt-row-label">Date & Time</span><span class="receipt-row-value">${formatDateTimeShort(tx.date)}</span></div>
    <div class="receipt-row"><span class="receipt-row-label">Customer</span><span class="receipt-row-value">${tx.customerName}</span></div>
    <div class="receipt-row"><span class="receipt-row-label">Mobile</span><span class="receipt-row-value">${tx.mobile || '—'}</span></div>
    <div class="receipt-row" style="align-items: center; gap: 0.5rem;">
      <span class="receipt-row-label">Staff</span>
      <div style="display: flex; align-items: center; gap: 0.5rem; justify-content: flex-end; flex: 1;">
        <span class="receipt-row-value">${tx.staff}</span>
        ${(() => {
          const staff = STATE.settings.staffList.find(s => s.name === tx.staff);
          return (staff && staff.photo) ? `<img src="${staff.photo}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">` : '';
        })()}
      </div>
    </div>
    <div class="receipt-row"><span class="receipt-row-label">Service</span><span class="receipt-row-value">${tx.service}</span></div>
  `;

  if (tx.items && tx.items.length) {
    html += `<div class="receipt-items-heading">Items</div>`;
    tx.items.forEach(item => {
      html += `
        <div class="receipt-item-row">
          <span>${item.name} * ${item.qty}</span>
          <span>${formatCurrency(item.qty * item.price)}</span>
        </div>`;
    });
  }

  html += `
    <div class="receipt-row total">
      <span class="receipt-row-label">TOTAL AMOUNT</span>
      <span class="receipt-row-value">${formatCurrency(tx.amount)}</span>
    </div>`;

  if (tx.notes) {
    html += `<div class="receipt-row"><span class="receipt-row-label">Notes</span><span class="receipt-row-value" style="color:var(--text-muted)">${tx.notes}</span></div>`;
  }

  body.innerHTML = html;
  modal.classList.remove('hidden');

  // Cache current transaction for WhatsApp sharing
  window._currentReceiptTx = tx;
}

/**
 * Generates and opens a WhatsApp link for the given transaction
 */
function sendWhatsApp(tx) {
  if (!tx.mobile) {
    showToast('Customer mobile number is missing!', 'error');
    return;
  }

  const divider = '────────────────';
  const staff = STATE.settings.staffList.find(s => s.name === tx.staff);
  const staffLine = staff && staff.mobile ? `*Staff:* ${tx.staff} (${staff.mobile})` : `*Staff:* ${tx.staff}`;

  let msg = `*⚡ A2Z CYBER - BILL RECEIPT* \n`;
  msg += `${divider}\n`;
  msg += `*Date:* ${formatDateTimeShort(tx.date)}\n`;
  msg += `*Customer:* ${tx.customerName}\n`;
  msg += staffLine + `\n`;
  msg += `*Service:* ${tx.service}\n`;

  if (tx.items && tx.items.length) {
    msg += `\n*ITEMS:* \n`;
    tx.items.forEach(item => {
      msg += `• ${item.name} (${item.qty}) - ₹${(item.qty * item.price).toFixed(0)}\n`;
    });
  }

  msg += `${divider}\n`;
  msg += `*TOTAL AMOUNT: ₹${parseFloat(tx.amount).toFixed(0)}* \n`;
  msg += `${divider}\n`;
  msg += `_Thank you for visiting A2Z CYBER!_ \n`;
  msg += `_Served by ${tx.staff}_ \n`;
  msg += `_Please visit again._`;

  const encodedMsg = encodeURIComponent(msg);
  // Ensure mobile has country code, default to 91 (India) if 10 digits
  let phone = tx.mobile.replace(/\D/g, '');
  if (phone.length === 10) phone = '91' + phone;

  const url = `https://wa.me/${phone}?text=${encodedMsg}`;
  window.open(url, '_blank');
}

/* ════════════════════════════════════════════════════════════
   RECENT TRANSACTIONS TABLE
════════════════════════════════════════════════════════════ */
function renderRecentTable() {
  const tbody = $('recent-table-body');
  if (!tbody) return;

  let today = getToday();
  
  // Filter for staff
  if (STATE.currentRole !== 'manager') {
    today = today.filter(tx => tx.staff === STATE.currentStaff);
  }

  if (!today.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-state">No transactions yet today</td></tr>';
    return;
  }

  tbody.innerHTML = today.map((tx, i) => {
    const syncHtml = `<span class="sync-badge ${tx.syncStatus}">${tx.syncStatus === 'synced' ? '✓ Synced' : tx.syncStatus === 'failed' ? '✗ Failed' : '⟳ Pending'}</span>`;
    const payMode = tx.paymentMode === 'upi' ? '📱 UPI' : '💵 Cash';
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${tx.customerName}</td>
        <td>${tx.mobile || '—'}</td>
        <td>${tx.staff}</td>
        <td>${tx.service}</td>
        <td>${tx.displayDuration}</td>
        <td class="amount-cell">${formatCurrency(tx.amount)}</td>
        <td style="font-size:0.75rem; font-weight:700;">${payMode}</td>
        <td>${formatDateTimeShort(tx.date)}</td>
        <td>${syncHtml}</td>
        ${STATE.currentRole === 'manager' ? `
        <td style="white-space:nowrap">
          <button class="btn btn-ghost btn-sm" onclick="editTransaction('${tx.id}')" title="Edit">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="deleteTransaction('${tx.id}')" title="Delete" style="color:var(--red)">🗑️</button>
        </td>` : ''}
      </tr>`;
  }).join('');
}

function initPaymentSelectors() {
  const selectors = document.querySelectorAll('.payment-mode-selector');
  selectors.forEach(sel => {
    const buttons = sel.querySelectorAll('.pm-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        STATE.currentPaymentMode = btn.dataset.mode;
        // Toggle active class for all buttons in THIS selector
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Also sync OTHER selectors (rush and service screens)
        document.querySelectorAll('.pm-btn').forEach(allBtn => {
          if (allBtn.dataset.mode === btn.dataset.mode) allBtn.classList.add('active');
          else allBtn.classList.remove('active');
        });
      });
    });
  });
}

/* ════════════════════════════════════════════════════════════
   SERVICE BUTTONS + CART UI
════════════════════════════════════════════════════════════ */
let serviceCart = []; // { id, name, icon, qty, price }

function initServiceForm() {
  serviceCart = [];
  $('sf-customer-name').value = '';
  $('sf-mobile').value = '';
  if ($('sf-address')) $('sf-address').value = '';
  $('sf-service-search').value = '';
  if ($('sf-gov-fees')) $('sf-gov-fees').value = '';
  $('sf-search-results').classList.add('hidden');
  renderQuickAddSidebar();
  renderServiceCart();
}

function renderQuickAddSidebar() {
  const grid = $('service-sidebar-grid');
  if (!grid) return;
  const items = STATE.settings.rushItems || [];
  grid.innerHTML = items.map(item => `
    <button class="sidebar-tap-btn ${item.colorClass || ''}" onclick="addToCart('${item.id}', '${item.name}', '${item.icon}', ${item.price})">
      <span class="tap-icon">${item.icon}</span>
      <span class="tap-name">${item.name}</span>
      <span class="tap-price">₹${item.price}</span>
    </button>
  `).join('') || '<div class="empty-state">No quick items</div>';
}

window.searchServices = function() {
  const query = $('sf-service-search').value.toLowerCase().trim();
  const results = $('sf-search-results');
  
  if (!query) {
    results.classList.add('hidden');
    return;
  }

  const filtered = STATE.settings.services.filter(s => 
    s.name.toLowerCase().includes(query) || s.id.toLowerCase().includes(query)
  );

  if (!filtered.length) {
    results.innerHTML = '<div class="search-no-results">No services found</div>';
    results.classList.remove('hidden');
    return;
  }

  results.innerHTML = filtered.map(s => `
    <div class="search-result-item" onclick="selectServiceSearch('${s.id}')">
      <span class="search-result-icon">${s.icon}</span>
      <span class="search-result-name">${s.name}</span>
      <span class="search-result-price">₹${s.price}</span>
    </div>
  `).join('');
  results.classList.remove('hidden');
};

window.selectServiceSearch = function(svcId) {
  const service = STATE.settings.services.find(s => s.id === svcId);
  if (!service) return;
  
  addToCart(service.id, service.name, service.icon, service.price);
  $('sf-service-search').value = '';
  $('sf-search-results').classList.add('hidden');
};

let rushCart = []; // { id, name, icon, qty, price }

window.addRushItem = function(id, name, icon, price) {
  const existing = rushCart.find(i => i.id === id);
  if (existing) {
    existing.qty++;
  } else {
    rushCart.push({ id, name, icon, qty: 1, price });
  }
  renderRushCart();
  showToast(`${icon} ${name} added`, 'success', 900);
};

window.addManualRushItem = function() {
  const nameInput = $('rush-manual-svc');
  const amtInput  = $('rush-manual-amt');
  
  const name = nameInput.value.trim();
  const amt  = parseFloat(amtInput.value);
  
  if (!name) {
    showToast('Please enter a service name!', 'error');
    nameInput.focus();
    return;
  }
  if (isNaN(amt) || amt <= 0) {
    showToast('Please enter a valid amount!', 'error');
    amtInput.focus();
    return;
  }
  
  const id = 'manual-' + generateId();
  addRushItem(id, name, '⚙️', amt);
  
  // Clear inputs
  nameInput.value = '';
  amtInput.value = '';
  showToast('Custom item added!', 'success');
};

window.rushCartQty = function(id, delta) {
  const item = rushCart.find(i => i.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  renderRushCart();
};

window.rushCartQtyInput = function(id, value) {
  const item = rushCart.find(i => i.id === id);
  if (!item) return;
  let val = parseInt(value, 10);
  if (isNaN(val) || val < 1) val = 1;
  item.qty = val;
  renderRushCart();
};

window.removeRushItem = function(id) {
  rushCart = rushCart.filter(i => i.id !== id);
  renderRushCart();
};

function renderRushCart() {
  const section = $('rush-cart-section');
  const list    = $('rush-cart-list');
  const totalEl = $('rush-total-display');
  if (!section || !list || !totalEl) return;

  if (!rushCart.length) {
    section.classList.add('hidden');
    totalEl.textContent = '₹0';
    return;
  }

  section.classList.remove('hidden');
  list.innerHTML = rushCart.map(item => `
    <div class="cart-item-row">
      <span class="cart-item-name">${item.icon} ${item.name}</span>
      <div class="cart-item-controls">
        <button class="cart-qty-btn" onclick="rushCartQty('${item.id}',-1)">−</button>
        <input type="number" class="cart-qty-input" value="${item.qty}" min="1" onchange="rushCartQtyInput('${item.id}', this.value)" onclick="this.select()" />
        <button class="cart-qty-btn" onclick="rushCartQty('${item.id}',1)">+</button>
      </div>
      <span class="cart-item-total">₹${(item.qty * item.price).toFixed(0)}</span>
      <button class="cart-item-del" onclick="removeRushItem('${item.id}')">✕</button>
    </div>
  `).join('');

  const total = rushCart.reduce((s, i) => s + i.qty * i.price, 0);
  totalEl.textContent = `₹${total.toFixed(0)}`;
}

window.renderRushGrid = function() {
  const grid = $('rush-grid');
  if (!grid) return;
  
  grid.innerHTML = STATE.settings.rushItems.map(item => `
    <button class="rush-tap-btn ${item.colorClass}" onclick="addRushItem('${item.id}', '${item.name}', '${item.icon}', ${item.price})">
      <div class="rush-tap-icon">${item.icon}</div>
      <div class="rush-tap-name">${item.name}</div>
      <div class="rush-tap-price">₹${item.price}<span>/page</span></div>
    </button>
  `).join('');
};

window.renderRushItemsSettings = function() {
  const container = $('rush-items-list-settings');
  if (!container) return;
  
  container.innerHTML = STATE.settings.rushItems.map(item => `
    <div class="service-mgmt-item glass" style="padding:0.75rem; display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
      <div style="display:flex; align-items:center; gap:0.75rem;">
        <span style="font-size:1.25rem;">${item.icon}</span>
        <div>
          <div style="font-weight:700;">${item.name}</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">₹${item.price} • ${item.colorClass}</div>
        </div>
      </div>
      </div>
      <div>
        <button class="btn btn-ghost btn-sm" onclick="editRushItemSetting('${item.id}')" style="color:var(--cyan); margin-right:0.2rem;">✎</button>
        <button class="btn btn-ghost btn-sm" onclick="removeRushItemSetting('${item.id}')" style="color:var(--red)">✕</button>
      </div>
    </div>
  `).join('') || '<div class="empty-state">No items added</div>';
};

window.removeRushItemSetting = function(id) {
  if (confirm('Remove this quick bill item?')) {
    STATE.settings.rushItems = STATE.settings.rushItems.filter(i => i.id !== id);
    saveState();
    renderRushItemsSettings();
    showToast('Item removed', 'info');
  }
};

let editingRushId = null;

window.editRushItemSetting = function(id) {
  const item = STATE.settings.rushItems.find(i => i.id === id);
  if (!item) return;

  editingRushId = id;
  $('new-rush-name').value = item.name;
  $('new-rush-price').value = item.price;
  $('new-rush-icon').value = item.icon;
  $('new-rush-color').value = item.colorClass || 'rush-tap-bk';
  if ($('new-rush-icon-preview')) $('new-rush-icon-preview').textContent = item.icon;

  $('btn-add-rush').textContent = '💾 Update Rush Grid';
  $('btn-cancel-rush').classList.remove('hidden');
  $('new-rush-name').focus();
};

window.cancelEditRushMode = function() {
  editingRushId = null;
  $('new-rush-name').value = '';
  $('new-rush-price').value = '';
  $('new-rush-icon').value = '📄';
  $('new-rush-color').value = 'rush-tap-bk';
  if ($('new-rush-icon-preview')) $('new-rush-icon-preview').textContent = '📄';

  $('btn-add-rush').textContent = '+ Add to Rush Grid';
  $('btn-cancel-rush').classList.add('hidden');
};

window.addRushItemSetting = function() {
  const name = $('new-rush-name').value.trim();
  const price = parseFloat($('new-rush-price').value) || 0;
  const icon = $('new-rush-icon').value.trim() || '📄';
  const color = $('new-rush-color').value;

  if (!name) { showToast('Name is required', 'error'); return; }

  if (editingRushId) {
    const item = STATE.settings.rushItems.find(i => i.id === editingRushId);
    if (item) {
      item.name = name;
      item.price = price;
      item.icon = icon;
      item.colorClass = color;
      showToast('Quick bill item updated!', 'success');
    }
    cancelEditRushMode();
  } else {
    const id = 'rush-' + generateId();
    STATE.settings.rushItems.push({ id, name, price, icon, colorClass: color });
    showToast('Quick bill item added!', 'success');
    
    $('new-rush-name').value = '';
    $('new-rush-price').value = '';
    $('new-rush-icon').value = '📄';
  }

  saveState();
  renderRushItemsSettings();
  pushConfigToCloud(); // sync to all devices
};

window.addToCart = function(id, name, icon, price) {
  const existing = serviceCart.find(i => i.id === id);
  if (existing) {
    existing.qty++;
  } else {
    serviceCart.push({ id, name, icon, qty: 1, price });
  }
  renderServiceCart();
  showToast(`${icon} ${name} added`, 'success', 1200);
};


window.cartQty = function(id, delta) {
  const item = serviceCart.find(i => i.id === id);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  renderServiceCart();
};

window.cartQtyInput = function(id, value) {
  const item = serviceCart.find(i => i.id === id);
  if (!item) return;
  let val = parseInt(value, 10);
  if (isNaN(val) || val < 1) val = 1;
  item.qty = val;
  renderServiceCart();
};


window.removeFromCart = function(id) {
  serviceCart = serviceCart.filter(i => i.id !== id);
  renderServiceCart();
};

window.renderServiceCart = function renderServiceCart() {
  const section = $('service-cart-section');
  const list    = $('service-cart-list');
  const totalEl = $('sf-total-display');
  if (!section || !list || !totalEl) return;

  const govFees = parseFloat($('sf-gov-fees')?.value) || 0;

  if (!serviceCart.length) {
    section.classList.add('hidden');
    totalEl.textContent = `₹${govFees.toFixed(0)}`;
    return;
  }

  section.classList.remove('hidden');
  list.innerHTML = serviceCart.map(item => `
    <div class="cart-item-row">
      <span class="cart-item-name">${item.icon} ${item.name}</span>
      <div class="cart-item-controls">
        <button class="cart-qty-btn" onclick="cartQty('${item.id}',-1)">−</button>
        <input type="number" class="cart-qty-input" value="${item.qty}" min="1" onchange="cartQtyInput('${item.id}', this.value)" onclick="this.select()" />
        <button class="cart-qty-btn" onclick="cartQty('${item.id}',1)">+</button>
      </div>
      <span class="cart-item-total">₹${(item.qty * item.price).toFixed(0)}</span>
      <button class="cart-item-del" onclick="removeFromCart('${item.id}')">✕</button>
    </div>
  `).join('');

  const totalItems = serviceCart.reduce((s, i) => s + i.qty * i.price, 0);
  const total = totalItems + govFees;
  totalEl.textContent = `₹${total.toFixed(0)}`;
  
  // Ensure the list scrolls to the bottom when new items are added
  setTimeout(() => { if(list) list.scrollTop = list.scrollHeight; }, 10);
}

window.addManualServiceItem = function() {
  const nameInput = $('sf-custom-name');
  const priceInput = $('sf-custom-price');
  if (!nameInput || !priceInput) return;

  const name = nameInput.value.trim();
  const price = parseFloat(priceInput.value);

  if (!name || isNaN(price) || price <= 0) {
    showToast('Please enter valid service name and price!', 'error');
    if (!name) nameInput.focus(); else priceInput.focus();
    return;
  }

  addToCart('manual-' + generateId(), name, '🛠️', price);
  nameInput.value = '';
  priceInput.value = '';
  showToast('Custom item added!', 'success', 800);
};

/* ════════════════════════════════════════════════════════════
   REPORTS SCREEN
════════════════════════════════════════════════════════════ */

/**
 * Returns a date range filter for use in report queries.
 * filter: 'today' | 'week' | 'month' | 'all'
 */
function getReportDateRange(filter) {
  const now = new Date();
  if (filter === 'today') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { start };
  }
  if (filter === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay()); // Sunday
    start.setHours(0, 0, 0, 0);
    return { start };
  }
  if (filter === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start };
  }
  return { start: null }; // 'all'
}

/**
 * Fetch data from Supabase filtered by date range for reports.
 * Falls back to local STATE.transactions if Supabase is unavailable.
 */
async function fetchReportData(filter) {
  const db = getSupabaseClient();
  const { start } = getReportDateRange(filter);

  if (db) {
    try {
      let query = db.from('transactions').select('*').order('date', { ascending: false }).limit(5000);
      if (start) query = query.gte('date', start.toISOString());

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data.map(tx => ({
          id:              tx.id,
          date:            tx.date,
          customerName:    tx.customer_name    ?? tx.customerName    ?? 'Walk-in Customer',
          mobile:          tx.mobile           ?? '',
          address:         tx.address          ?? '',
          staff:           tx.staff            ?? '',
          service:         tx.service          ?? '',
          jobType:         tx.job_type         ?? tx.jobType         ?? 'service',
          paymentMode:     tx.payment_mode     ?? tx.paymentMode     ?? 'cash',
          amount:          tx.amount           ?? 0,
          displayDuration: tx.display_duration ?? tx.displayDuration ?? '',
          notes:           tx.notes            ?? '',
          items:           tx.items            ?? [],
          syncStatus:      'synced'
        }));
      }
    } catch(e) { console.warn('Supabase report fetch failed', e); }
  }

  // Fallback: filter local state
  if (!start) return STATE.transactions;
  return STATE.transactions.filter(tx => new Date(tx.date) >= start);
}

async function renderReports() {
  // Determine which filter button is active
  const filter = STATE.reportFilter;

  // Update heading
  const headingMap = {
    today: "Today's Transactions",
    week:  "This Week's Transactions",
    month: "This Month's Transactions",
    all:   "All-Time Transactions"
  };
  const heading = $('rpt-table-heading');
  if (heading) heading.textContent = headingMap[filter] || "Transactions";

  // Show loading state
  const tbody = $('report-table-body');
  if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="empty-state"><span class="loading-dots">Fetching data from database...</span></td></tr>`;

  let data = await fetchReportData(filter);

  // Filter for staff (non-manager only sees their own)
  if (STATE.currentRole !== 'manager') {
    data = data.filter(tx => tx.staff === STATE.currentStaff);
    $('staff-summary-list').parentElement.style.display = 'none';
  } else {
    $('staff-summary-list').parentElement.style.display = 'block';
  }

  const income   = data.reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
  const cashInc  = data.filter(tx => tx.paymentMode === 'cash').reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
  const upiInc   = data.filter(tx => tx.paymentMode === 'upi').reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);

  $('rpt-customers').textContent = data.length;
  $('rpt-income').textContent    = formatCurrency(income);
  if ($('rpt-cash')) $('rpt-cash').textContent = formatCurrency(cashInc);
  if ($('rpt-upi'))  $('rpt-upi').textContent  = formatCurrency(upiInc);

  // Period label for staff summary
  const periodLabel = { today: 'Today', week: 'Week', month: 'Month', all: 'Total' }[filter] || 'Period';

  // Staff summary
  const staffMap = {};
  STATE.settings.staffList.forEach(s => {
    if (s.role !== 'manager') staffMap[s.name] = { count: 0, amount: 0 };
  });
  data.forEach(tx => {
    if (!staffMap[tx.staff] && tx.staff !== 'Manager' && STATE.settings.staffList.find(s => s.name === tx.staff)) {
      staffMap[tx.staff] = { count: 0, amount: 0 };
    }
    if (staffMap[tx.staff]) {
      staffMap[tx.staff].count++;
      staffMap[tx.staff].amount += parseFloat(tx.amount || 0);
    }
  });
  const maxAmount = Math.max(...Object.values(staffMap).map(v => v.amount), 1);
  const staffListEl = $('staff-summary-list');
  if (staffListEl) {
    staffListEl.innerHTML = Object.entries(staffMap).map(([name, d]) => {
      const wallet = getStaffWallet(name);
      return `
      <div class="staff-summary-item" onclick="showStaffDetails('${name}')" style="cursor:pointer;transition:all var(--transition)" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.3rem">
            <span style="font-weight:600">${name} <span style="font-size:0.75rem;color:var(--text-muted)">(Tap for details)</span></span>
            <span style="color:#0080ff;font-family:var(--font-mono);font-weight:700">${periodLabel}: ${formatCurrency(d.amount)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:var(--text-muted);margin-bottom:0.4rem">
            <span>${d.count} transaction(s)</span>
            <span style="font-weight:600;color:var(--teal)">Bal: ${formatCurrency(wallet.balance)}</span>
          </div>
          <div style="font-size:0.75rem;color:var(--text-secondary);background:rgba(0,0,0,0.03);padding:0.4rem;border-radius:4px;display:flex;justify-content:space-between">
            <span>Earned: ${formatCurrency(wallet.earned)}</span>
            <span style="color:var(--red)">Withdrawn: ${formatCurrency(wallet.withdrawn)}</span>
          </div>
          <div class="staff-summary-bar" style="width:${Math.min((d.amount / maxAmount) * 100, 100)}%;margin-top:0.4rem"></div>
        </div>
      </div>`;
    }).join('') || '<div class="empty-state">No staff found</div>';
  }

  // Full table
  if (!tbody) return;
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="${STATE.currentRole === 'manager' ? 9 : 8}" class="empty-state">No records found for this period</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map((tx, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${tx.customerName}</td>
      <td>${tx.mobile || '—'}</td>
      <td>${tx.staff}</td>
      <td>${tx.service}</td>
      <td>${tx.displayDuration}</td>
      <td class="amount-cell">${formatCurrency(tx.amount)}</td>
      <td>${formatDateTimeShort(tx.date)}</td>
      ${STATE.currentRole === 'manager' ? `
      <td>
        <button class="btn btn-ghost btn-sm" onclick="editTransaction('${tx.id}')">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteTransaction('${tx.id}')" style="color:var(--red)">🗑️</button>
      </td>` : ''}
    </tr>
  `).join('');
}

/* ════════════════════════════════════════════════════════════
   EXPORT CSV
════════════════════════════════════════════════════════════ */
function exportCSV() {
  const isAll = STATE.reportFilter === 'all';
  const data = isAll ? STATE.transactions : getToday();
  
  if (!data.length) { showToast('No data to export', 'error'); return; }

  const headers = ['#','Customer Name','Mobile','Staff','Service','Amount (₹)','Date & Time'];
  const rows = data.map((tx, i) => [
    i + 1,
    tx.customerName,
    tx.mobile || '',
    tx.staff,
    tx.service,
    tx.amount,
    formatDateTimeShort(tx.date)
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `A2Z_CYBER_${getTodayKey()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported!', 'success');
}

/* ════════════════════════════════════════════════════════════
   SETTINGS SCREEN
════════════════════════════════════════════════════════════ */
function renderSettingsScreen() {
  const url = STATE.settings.webhookUrl || '';
  const sUrl = STATE.settings.supabaseUrl || '';
  const sKey = STATE.settings.supabaseKey || '';
  
  $('setting-webhook').value = url;
  if($('setting-supabase-url')) $('setting-supabase-url').value = sUrl;
  if($('setting-supabase-key')) $('setting-supabase-key').value = sKey;

  // Update cloud status badge
  const dot  = $('cloud-status-dot');
  const txt  = $('cloud-status-text');
  if (dot && txt) {
    if (sUrl && sKey) {
      dot.style.background = 'var(--green)';
      dot.style.boxShadow  = '0 0 6px var(--green)';
      txt.textContent = '✅ Supabase Connected — Fast Realtime Sync';
      txt.style.color = 'var(--green)';
    } else if (url) {
      dot.style.background = 'var(--amber)';
      dot.style.boxShadow  = '0 0 6px var(--amber)';
      txt.textContent = '⚠️ Google Sheets legacy sync active';
      txt.style.color = 'var(--amber)';
    } else {
      dot.style.background = 'var(--red)';
      dot.style.boxShadow  = 'none';
      txt.textContent = '❌ Not connected — data is local only';
      txt.style.color = 'var(--red)';
    }
  }

  renderStaffSettings();
  renderRushItemsSettings();
  renderQuotesSettings();
}

function renderQuotesSettings() {
  const container = $('quotes-list-settings');
  if (!container) return;
  const quotes = STATE.settings.quotes || [];
  
  container.innerHTML = quotes.map((q, i) => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.03); padding:0.5rem; border-radius:6px; font-size:0.85rem;">
      <span style="flex:1; margin-right:0.5rem;">${q}</span>
      <button onclick="removeQuoteSetting(${i})" style="background:none; border:none; color:var(--red); cursor:pointer; font-size:1rem; padding:0 0.3rem;">✕</button>
    </div>
  `).join('') || '<div class="empty-state">No quotes added</div>';
}

window.addQuoteSetting = function() {
  const input = $('new-quote-input');
  const quote = input.value.trim();
  if (!quote) { showToast('Please enter a quote', 'error'); return; }
  
  if (!STATE.settings.quotes) STATE.settings.quotes = [];
  STATE.settings.quotes.push(quote);
  saveState();
  input.value = '';
  renderQuotesSettings();
  showToast('Quote added successfully!', 'success');
};

window.removeQuoteSetting = function(index) {
  if (!confirm('Remove this quote?')) return;
  STATE.settings.quotes.splice(index, 1);
  saveState();
  renderQuotesSettings();
  showToast('Quote removed', 'info');
};

function renderStaffSettings() {
  const container = $('staff-list-settings');
  if (!container) return;
  const isManager = STATE.currentRole === 'manager';
  
  container.innerHTML = STATE.settings.staffList.map(s => {
    // Only show delete button for non-manager staff, and only if current user is manager
    const showDelete = isManager && s.role !== 'manager';
    return `
      <span class="staff-tag">
        ${s.name} (${s.role})
        ${showDelete ? `<button class="staff-tag-remove" onclick="removeStaff('${s.name}')">✕</button>` : ''}
      </span>
    `;
  }).join('');
}

window.removeStaff = function(name) {
  if (STATE.currentRole !== 'manager') { showToast('Only Manager can remove staff', 'error'); return; }
  const staff = STATE.settings.staffList.find(s => s.name === name);
  if (staff && staff.role === 'manager') { showToast('Cannot remove Manager account', 'error'); return; }
  
  STATE.settings.staffList = STATE.settings.staffList.filter(s => s.name !== name);
  saveState();
  renderStaffSettings();
  renderStaffLoginButtons();
  showToast(`${name} removed. Syncing to cloud...`, 'info');
  pushConfigToCloud();
};


/* ════════════════════════════════════════════════════════════
   EVENT LISTENERS
════════════════════════════════════════════════════════════ */
let editingSvcId = null;

function renderServicesTable() {
  const tbody = $('services-table-body');
  if (!tbody) return;
  tbody.innerHTML = STATE.settings.services.map(s => {
    const hasOptions = s.options && s.options.trim().length > 0;
    const priceDisplay = hasOptions ? '<span style="color:var(--cyan);font-weight:700">Multi-Price</span>' : `₹${s.price}`;
    
    return `
    <tr>
      <td>${s.name}</td>
      <td><span class="badge-category">${s.category || 'General'}</span></td>
      <td class="amount-cell">${priceDisplay}</td>
      <td>
        <div style="display:flex; gap:0.4rem;">
          <button class="btn btn-ghost btn-sm" onclick="editService('${s.id}')" style="color:var(--cyan)">✎ Edit</button>
          <button class="btn btn-ghost btn-sm" onclick="removeService('${s.id}')" style="color:var(--red)">✕ Remove</button>
        </div>
      </td>
    </tr>
  `}).join('') || '<tr><td colspan="4" class="empty-state">No services added</td></tr>';
}

window.editService = function(id) {
  const svc = STATE.settings.services.find(s => s.id === id);
  if (!svc) return;

  editingSvcId = id;
  $('new-svc-name').value = svc.name;
  $('new-svc-price').value = svc.price;
  $('new-svc-category').value = svc.category || '';
  $('new-svc-options').value = svc.options || '';


  $('btn-add-service').textContent = '💾 Update Service';
  $('btn-cancel-svc-edit').classList.remove('hidden');
  $('new-svc-name').focus();
};

window.cancelEditServiceMode = function() {
  editingSvcId = null;
  $('new-svc-name').value = '';
  $('new-svc-price').value = '';
  $('new-svc-category').value = '';
  $('new-svc-options').value = '';

  $('btn-add-service').textContent = '+ Add Service';
  $('btn-cancel-svc-edit').classList.add('hidden');
};

window.removeService = function(id) {
  if (confirm('Are you sure you want to remove this service?')) {
    STATE.settings.services = STATE.settings.services.filter(s => s.id !== id);
    saveState();
    renderServicesTable();
    pushConfigToCloud(); // sync to all devices
    showToast('Service removed', 'info');
  }
};

function bindEvents() {
  // Existing ...
  $('btn-manage-services').addEventListener('click', () => {
    renderServicesTable();
    showScreen('services');
  });

  $('btn-back-from-services').addEventListener('click', () => {
    cancelEditServiceMode();
    showScreen('dashboard');
  });

  $('btn-cancel-svc-edit').addEventListener('click', cancelEditServiceMode);

  $('btn-add-service').addEventListener('click', () => {
    const name = $('new-svc-name').value.trim();
    const price = parseFloat($('new-svc-price').value) || 0;
    const icon = '📄'; // Default icon
    const category = $('new-svc-category').value.trim() || 'General';
    const options = $('new-svc-options').value.trim();

    
    if (!name) {
      showToast('Please enter a service name', 'error');
      return;
    }
    
    if (editingSvcId) {
      // Update existing
      const svc = STATE.settings.services.find(s => s.id === editingSvcId);
      if (svc) {
        svc.name = name;
        svc.price = price;
        svc.icon = icon;
        svc.category = category;
        svc.options = options;
        showToast(`${name} updated!`, 'success');
      }
      cancelEditServiceMode();
    } else {
      // Add new
      const id = name.toLowerCase().replace(/\s+/g, '-');
      if (STATE.settings.services.find(s => s.id === id)) {
        showToast('Service with this name already exists', 'error');
        return;
      }
      STATE.settings.services.push({ id, name, price, icon, category, options });
      showToast(`${name} added!`, 'success');

      // Clear form
      $('new-svc-name').value = '';
      $('new-svc-price').value = '';
      $('new-svc-category').value = '';
    }

    saveState();
    renderServicesTable();
    pushConfigToCloud(); // sync service catalogue to all devices
  });

  // ── LOGIN — tap buttons rendered by renderStaffLoginButtons() ───
  $('btn-logout').addEventListener('click', () => {
    // --- Attendance: record logout time ---
    if (STATE.currentRole !== 'manager' && window._currentAttendanceId) {
      const rec = STATE.attendance.find(a => a.id === window._currentAttendanceId);
      if (rec && !rec.logoutTime) {
        rec.logoutTime = new Date().toISOString();
        saveState();
        syncAttendanceToSupabase(rec);
      }
      window._currentAttendanceId = null;
    }
    STATE.currentStaff = '';
    STATE.currentRole = '';
    saveState();
    showStaffSelection();
    renderStaffLoginButtons();
    showScreen('login');
  });

  $('btn-rush-billing').addEventListener('click', () => {
    rushCart = [];
    renderRushCart();
    renderRushGrid();
    showMotivationalQuote('rush-motivation-quote');
    showScreen('rush-billing');
  });

  $('btn-back-from-rush').addEventListener('click', () => showScreen('dashboard'));

  $('btn-save-rush-job').addEventListener('click', () => {
    if (!rushCart.length) { showToast('Please add at least one item', 'error'); return; }
    const total = rushCart.reduce((s, i) => s + i.qty * i.price, 0);
    saveServiceJob({
      customerName: 'Walk-in Customer',
      mobile: '',
      staff: STATE.currentStaff,
      items: rushCart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
      total
    });
    rushCart = [];
    renderRushCart();
    showScreen('dashboard');
  });

  // ── DASHBOARD NAVIGATION ────────────────────────────────

  $('btn-new-service-job').addEventListener('click', () => {
    initServiceForm();
    showScreen('service-form');
  });

  $('btn-reports').addEventListener('click', () => {
    // Reset filter to Today each time reports is opened
    STATE.reportFilter = 'today';
    const rptBtns = ['rpt-filter-today', 'rpt-filter-week', 'rpt-filter-month', 'rpt-filter-all'];
    rptBtns.forEach(id => { const b = $(id); if (b) b.classList.remove('active'); });
    const todayBtn = $('rpt-filter-today');
    if (todayBtn) todayBtn.classList.add('active');
    showScreen('reports');
    renderReports(); // async — fires immediately
  });

  $('btn-settings').addEventListener('click', () => {
    renderSettingsScreen();
    showScreen('settings');
  });

  $('btn-manage-services').addEventListener('click', () => {
    renderServicesTable();
    showScreen('services');
  });

  $('btn-back-from-services').addEventListener('click', () => showScreen('dashboard'));

  $('btn-clear-history').addEventListener('click', () => {
    if (confirm('Clear all transactions for today? This cannot be undone.')) {
      const today = getTodayKey();
      STATE.transactions = STATE.transactions.filter(tx => !tx.date.startsWith(today));
      saveState();
      renderRecentTable();
      updateDashboardStats();
      showToast('Today\'s transactions cleared', 'info');
    }
  });


  // ── SERVICE FORM ────────────────────────────────────────
  $('btn-back-from-service-form').addEventListener('click', () => showScreen('dashboard'));

  $('btn-save-service-job').addEventListener('click', () => {
    const name   = $('sf-customer-name').value.trim();
    const mobile = $('sf-mobile').value.trim();
    const address = $('sf-address') ? $('sf-address').value.trim() : '';
    const staff  = STATE.currentStaff;
    const govFeesRaw = parseFloat($('sf-gov-fees')?.value);
    const govFees = isNaN(govFeesRaw) ? 0 : govFeesRaw;

    if (!name) { showToast('Customer name is required', 'error'); $('sf-customer-name').focus(); return; }
    if (!mobile || mobile.length < 10) { showToast('Valid mobile number is required', 'error'); $('sf-mobile').focus(); return; }
    if (!serviceCart.length && govFees <= 0) { showToast('Please add items or gov fees', 'error'); return; }

    const itemsToSave = serviceCart.map(i => ({ name: i.name, qty: i.qty, price: i.price }));
    if (govFees > 0) {
      itemsToSave.push({ name: 'Gov Fees', qty: 1, price: govFees });
    }

    const total = itemsToSave.reduce((s, i) => s + i.qty * i.price, 0);
    if (total <= 0) { showToast('Total must be greater than 0', 'error'); return; }

    saveServiceJob({
      customerName: name, mobile, address, staff,
      items: itemsToSave,
      total
    });

    serviceCart = [];
    if ($('sf-gov-fees')) $('sf-gov-fees').value = '';
    showScreen('dashboard');
  });

  // ── RECEIPT MODAL ───────────────────────────────────────
  $('btn-whatsapp-receipt').addEventListener('click', () => {
    if (window._currentReceiptTx) sendWhatsApp(window._currentReceiptTx);
  });

  $('btn-print-receipt')?.addEventListener('click', () => {
    window.print();
  });
  $('btn-close-receipt').addEventListener('click', () => {
    $('modal-receipt').classList.add('hidden');
    // Ensure we are on dashboard after closing
    showScreen('dashboard');
    renderRecentTable();
    updateDashboardStats();
  });

  $('modal-receipt').addEventListener('click', (e) => {
    if (e.target === $('modal-receipt')) $('modal-receipt').classList.add('hidden');
  });

  // ── REPORTS ─────────────────────────────────────────────
  const _rptBtns = ['rpt-filter-today', 'rpt-filter-week', 'rpt-filter-month', 'rpt-filter-all'];
  const _rptVals = { 'rpt-filter-today': 'today', 'rpt-filter-week': 'week', 'rpt-filter-month': 'month', 'rpt-filter-all': 'all' };
  _rptBtns.forEach(btnId => {
    const el = $(btnId);
    if (!el) return;
    el.addEventListener('click', () => {
      STATE.reportFilter = _rptVals[btnId];
      _rptBtns.forEach(id => { const b = $(id); if (b) b.classList.remove('active'); });
      el.classList.add('active');
      renderReports();
    });
  });

  $('btn-back-from-reports').addEventListener('click', () => showScreen('dashboard'));
  $('btn-export-csv').addEventListener('click', exportCSV);

  $('btn-close-staff-detail')?.addEventListener('click', () => {
    $('modal-staff-detail').classList.add('hidden');
  });
  $('modal-staff-detail')?.addEventListener('click', (e) => {
    if (e.target === $('modal-staff-detail')) $('modal-staff-detail').classList.add('hidden');
  });

  // ── NEW MANAGER MODALS ─────────────────────────────────
  $('btn-withdrawal-review')?.addEventListener('click', () => {
    renderWithdrawalReview('all');
    $('modal-withdrawal-review').classList.remove('hidden');
  });
  $('btn-close-withdrawal-review')?.addEventListener('click', () => {
    $('modal-withdrawal-review').classList.add('hidden');
  });
  $('modal-withdrawal-review')?.addEventListener('click', (e) => {
    if (e.target === $('modal-withdrawal-review')) $('modal-withdrawal-review').classList.add('hidden');
  });

  $('btn-attendance')?.addEventListener('click', () => {
    window._attFilter = 'today';
    renderAttendanceModal();
    $('modal-attendance').classList.remove('hidden');
  });
  $('btn-close-attendance')?.addEventListener('click', () => {
    $('modal-attendance').classList.add('hidden');
  });
  $('modal-attendance')?.addEventListener('click', (e) => {
    if (e.target === $('modal-attendance')) $('modal-attendance').classList.add('hidden');
  });

  // ── WALLET ──────────────────────────────────────────────
  $('btn-wallet')?.addEventListener('click', () => { window.showWallet(); });
  
  $('btn-close-wallet')?.addEventListener('click', () => {
    $('modal-wallet').classList.add('hidden');
  });
  $('modal-wallet')?.addEventListener('click', (e) => {
    if (e.target === $('modal-wallet')) $('modal-wallet').classList.add('hidden');
  });
  
  $('btn-withdraw-submit')?.addEventListener('click', () => {
    const amountStr = $('wallet-withdraw-amount').value;
    const amount = parseFloat(amountStr);
    
    if (isNaN(amount) || amount <= 0) {
      showToast('Enter a valid amount to withdraw.', 'error');
      return;
    }

    const staffName = STATE.currentRole === 'manager' ? 'Manager' : STATE.currentStaff;
    const wallet = getStaffWallet(staffName);

    if (amount > wallet.balance) {
      showToast('Insufficient balance!', 'error');
      return;
    }

    const newWithdrawal = {
      id: generateId(),
      staff: staffName,
      amount: amount,
      date: new Date().toISOString(),
      paid: false
    };
    STATE.withdrawals.push(newWithdrawal);
    saveState();
    
    if (getSupabaseClient()) {
      syncWithdrawalToSupabase(newWithdrawal);
    }
    
    showToast(`Successfully withdrew ${formatCurrency(amount)}`, 'success');
    window.showWallet(); // Refresh modal data
  });

  // ── SETTINGS ────────────────────────────────────────────
  $('btn-save-supabase')?.addEventListener('click', async () => {
    const url = $('setting-supabase-url').value.trim();
    const key = $('setting-supabase-key').value.trim();
    STATE.settings.supabaseUrl = url;
    STATE.settings.supabaseKey = key;
    saveState();
    
    _supabaseClient = null; // Reset so it re-creates with new credentials
    if (initSupabase()) {
      showToast('Supabase configured successfully!', 'success');
      // Sync local transactions immediately if connected
      await syncAllTransactionsToSupabase();
    } else {
      showToast('Supabase config saved. Missing URL or Key.', 'info');
    }
  });

  $('btn-back-from-settings').addEventListener('click', () => showScreen('dashboard'));

  $('btn-save-webhook').addEventListener('click', async () => {
    const url = $('setting-webhook').value.trim();
    STATE.settings.webhookUrl = url;
    saveState();
    const statusEl = $('webhook-status');
    if (url) {
      statusEl.textContent = '✓ URL saved. Uploading all bills and settings to cloud...';
      statusEl.className = 'webhook-status success';
      // Push config (staff, services, etc.)
      await pushConfigToCloud();
      // Push ALL local transactions so other devices can see them
      await syncAllTransactionsToCloud();
      processPendingSync();
      statusEl.textContent = '✅ All bills & settings synced! Other devices will now show your data.';
    } else {
      statusEl.textContent = 'No URL set. Data saved locally only.';
      statusEl.className = 'webhook-status';
      showToast('Settings saved!', 'success');
    }
  });

  $('btn-test-webhook')?.addEventListener('click', async () => {
    const url = $('setting-webhook').value.trim();
    if (!url) { showToast('Please enter a URL first', 'error'); return; }
    
    const statusEl = $('webhook-status');
    statusEl.innerHTML = '<span class="loading-dots">Testing connection...</span>';
    statusEl.className = 'webhook-status';

    try {
      // Using a GET request to the script (doGet in Gas)
      // Append a dummy param to avoid cache
      const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'ping=1', { method: 'GET', mode: 'no-cors' });
      // With no-cors we can't see the status, but if fetch didn't throw, it reached the server
      statusEl.innerHTML = '✅ Connection established! Google Sheets is linked.';
      statusEl.className = 'webhook-status success';
      showToast('Connection test successful!', 'success');
    } catch(e) {
      statusEl.innerHTML = '❌ Connection failed. Check URL or internet.';
      statusEl.className = 'webhook-status error';
      showToast('Could not reach Google Sheets', 'error');
    }
  });


  $('btn-add-staff').addEventListener('click', () => {
    const name = $('new-staff-input').value.trim();
    if (!name) return;
    if (STATE.settings.staffList.find(s => s.name === name)) { showToast('Staff already exists', 'error'); return; }
    STATE.settings.staffList.push({ name, password: '1234', role: 'staff' });
    saveState();
    $('new-staff-input').value = '';
    renderStaffSettings();
    renderStaffLoginButtons();
    showToast(`${name} added! Syncing to cloud...`, 'success');
    pushConfigToCloud();
  });

  $('new-staff-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('btn-add-staff').click();
  });

  // ── PROFILE SECTION ─────────────────────────────────────
  $('btn-profile')?.addEventListener('click', () => window.showProfileSection());
  $('btn-close-profile')?.addEventListener('click', () => $('modal-profile').classList.add('hidden'));
  $('btn-upload-trigger')?.addEventListener('click', () => $('input-profile-photo').click());
  $('input-profile-photo')?.addEventListener('change', e => window.handlePhotoUpload(e));
  $('btn-save-profile')?.addEventListener('click', () => window.saveProfile());

  // ── EDIT TRANSACTION ────────────────────────────────────
  $('btn-close-edit-tx')?.addEventListener('click', () => {
    $('modal-edit-transaction').classList.add('hidden');
  });
  $('btn-save-edit-tx')?.addEventListener('click', () => {
    window.saveTransactionEdit();
  });


  $('btn-customer-db').addEventListener('click', () => {
    renderCustomerDatabase();
    showScreen('customer-db');
  });

  $('btn-back-from-cust-db').addEventListener('click', () => showScreen('dashboard'));
}

window.deleteTransaction = async function(id) {
  if (!confirm('Are you sure you want to delete this bill? This will also remove it from Google Sheets.')) return;
  
  const tx = STATE.transactions.find(t => t.id === id);
  if (!tx) return;

  // 1. Remove from local state
  STATE.transactions = STATE.transactions.filter(t => t.id !== id);
  saveState();

  // 2. Try Supabase delete first, then Sheets fallback
  let result;
  const db = getSupabaseClient();
  if (db) {
    const { error } = await db.from('transactions').delete().eq('id', id);
    result = error ? 'failed' : 'synced';
  } else {
    result = await syncToSheets(tx, 'delete');
  }
  if (result !== 'synced') {
    showToast('Deleted locally. Cloud sync will retry.', 'warning');
  } else {
    showToast('Deleted successfully!', 'success');
  }

  renderRecentTable();
  if (SCREENS.includes('reports') && $('screen-reports').classList.contains('active')) {
    renderReports();
  }
  updateDashboardStats();
};

window.editTransaction = function(id) {
  const tx = STATE.transactions.find(t => t.id === id);
  if (!tx) return;

  $('edit-tx-id').value = id;
  $('edit-tx-name').value = tx.customerName || '';
  $('edit-tx-mobile').value = tx.mobile || '';
  $('edit-tx-amount').value = tx.amount || 0;
  $('edit-tx-notes').value = tx.notes || '';

  $('modal-edit-transaction').classList.remove('hidden');
};

window.saveTransactionEdit = async function() {
  const id = $('edit-tx-id').value;
  const tx = STATE.transactions.find(t => t.id === id);
  if (!tx) return;

  tx.customerName = $('edit-tx-name').value;
  tx.mobile = $('edit-tx-mobile').value;
  tx.amount = parseFloat($('edit-tx-amount').value).toFixed(2);
  tx.notes = $('edit-tx-notes').value;

  saveState();
  $('modal-edit-transaction').classList.add('hidden');
  showToast('Bill updated locally!', 'success');

  // Sync update — try Supabase first, then Sheets
  const syncFn2 = getSupabaseClient() ? syncToSupabase : (t) => syncToSheets(t, 'upsert');
  const result = await syncFn2(tx);
  if (result === 'synced') {
    showToast('Bill updated & synced!', 'success');
  } else {
    showToast('Updated locally. Sync pending...', 'warning');
  }

  renderRecentTable();
  if (SCREENS.includes('reports') && $('screen-reports').classList.contains('active')) {
    renderReports();
  }
  updateDashboardStats();
};

window.getStaffWallet = function(staffName) {
  const staffTx = STATE.transactions.filter(tx => tx.staff === staffName);
  
  // Lifetime Income & Gov Fees
  const income = staffTx.reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
  const govFees = staffTx.reduce((s, tx) => {
    const feeItem = tx.items?.find(i => i.name === 'Gov Fees');
    return s + (feeItem ? parseFloat(feeItem.price) : 0);
  }, 0);
  
  const lifetimeEarned = (income - govFees) * 0.10;
  
  const staffWd = STATE.withdrawals.filter(w => w.staff === staffName);
  const totalWithdrawn = staffWd.reduce((s, w) => s + parseFloat(w.amount || 0), 0);
  
  return {
    earned: lifetimeEarned,
    withdrawn: totalWithdrawn,
    balance: lifetimeEarned - totalWithdrawn
  };
};

window.showStaffDetails = function(staffName) {
  const staffTx = STATE.transactions.filter(tx => tx.staff === staffName);
  
  if (staffTx.length === 0) {
    showToast('No transactions found for this staff', 'info');
    return;
  }

  // Helper to extract Gov Fees from a list of transactions
  const getGovFees = (txs) => txs.reduce((s, tx) => {
    const feeItem = tx.items?.find(i => i.name === 'Gov Fees');
    return s + (feeItem ? parseFloat(feeItem.price) : 0);
  }, 0);

  // Calculate Today
  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayTxs = staffTx.filter(tx => tx.date.startsWith(todayDateStr));
  const todayIncome = todayTxs.reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
  const todayComm = (todayIncome - getGovFees(todayTxs)) * 0.10;

  // Calculate This Week (last 7 days approx, or week-to-date)
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekTxs = staffTx.filter(tx => new Date(tx.date) > weekAgo);
  const weekIncome = weekTxs.reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
  const weekComm = (weekIncome - getGovFees(weekTxs)) * 0.10;

  // Calculate This Month
  const thisMonthStr = todayDateStr.substring(0, 7); // YYYY-MM
  const monthTxs = staffTx.filter(tx => tx.date.startsWith(thisMonthStr));
  const monthIncome = monthTxs.reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
  const monthComm = (monthIncome - getGovFees(monthTxs)) * 0.10;

  $('staff-detail-name').textContent = staffName + "'s Performance";
  $('sd-today').textContent = formatCurrency(todayIncome);
  $('sd-today-comm').textContent = formatCurrency(todayComm);
  $('sd-week').textContent = formatCurrency(weekIncome);
  $('sd-week-comm').textContent = formatCurrency(weekComm);
  $('sd-month').textContent = formatCurrency(monthIncome);
  $('sd-month-comm').textContent = formatCurrency(monthComm);

  const wallet = getStaffWallet(staffName);
  $('sd-lifetime-earned').textContent = formatCurrency(wallet.earned);
  $('sd-lifetime-withdrawn').textContent = formatCurrency(wallet.withdrawn);
  $('sd-lifetime-balance').textContent = formatCurrency(wallet.balance);

  const tbody = $('staff-detail-tbody');
  tbody.innerHTML = staffTx.slice(0, 50).map((tx) => `
    <tr style="border-bottom: 1px solid var(--border);">
      <td style="padding: 0.8rem;">${formatDateTimeShort(tx.date)}</td>
      <td style="padding: 0.8rem;">${tx.customerName || 'Walk-in'}</td>
      <td style="padding: 0.8rem;">${tx.displayDuration || tx.service}</td>
      <td style="padding: 0.8rem; font-family:var(--font-mono); font-weight:700; color:var(--teal)">${formatCurrency(tx.amount)}</td>
    </tr>
  `).join('');

  $('modal-staff-detail').classList.remove('hidden');
};

/* ════════════════════════════════════════════════════════════
   WALLET & COMMISSION
════════════════════════════════════════════════════════════ */
window.showWallet = function() {
  const staffName = STATE.currentRole === 'manager' ? 'Manager' : STATE.currentStaff;
  const wallet = getStaffWallet(staffName);
  
  $('wallet-staff-name').textContent = staffName + "'s Wallet";
  $('wallet-earned').textContent = formatCurrency(wallet.earned);
  $('wallet-withdrawn').textContent = formatCurrency(wallet.withdrawn);
  $('wallet-balance').textContent = formatCurrency(wallet.balance);
  $('wallet-withdraw-amount').value = '';

  // Render Past Withdrawals History
  const historyTbody = $('wallet-history-tbody');
  if (historyTbody) {
    let myWithdrawals = STATE.withdrawals.filter(w => w.staff === staffName);
    myWithdrawals.sort((a,b) => new Date(b.date) - new Date(a.date));
    
    if (!myWithdrawals.length) {
      historyTbody.innerHTML = `<tr><td colspan="3" class="empty-state">No withdrawals yet</td></tr>`;
    } else {
      historyTbody.innerHTML = myWithdrawals.map(w => `
        <tr style="border-bottom: 1px solid rgba(0,0,0,0.05);">
          <td style="padding: 0.5rem; font-size: 0.8rem;">${formatDateTimeShort(w.date)}</td>
          <td style="padding: 0.5rem; text-align: right; font-family: var(--font-mono); font-weight: 700; color: var(--teal);">${formatCurrency(w.amount)}</td>
          <td style="padding: 0.5rem; text-align: right;">
            <span style="padding:0.2rem 0.5rem; border-radius:4px; font-size:0.75rem; font-weight:700;
              background:${w.paid ? 'rgba(46,125,50,0.1)' : 'rgba(255,143,0,0.1)'};
              color:${w.paid ? 'var(--green)' : 'var(--amber)'};">
              ${w.paid ? '✅ Paid' : '⏳ Pending'}
            </span>
          </td>
        </tr>
      `).join('');
    }
  }
  
  $('modal-wallet').classList.remove('hidden');
};

/* ════════════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════════════ */
window.showProfileSection = function() {
  const staff = STATE.settings.staffList.find(s => s.name === STATE.currentStaff);
  if (!staff) return;

  $('profile-name').value = staff.name;
  $('profile-mobile').value = staff.mobile || '';
  $('profile-password').value = ''; // Don't show password for security

  const preview = $('profile-photo-preview');
  if (staff.photo) {
    preview.innerHTML = `<img src="${staff.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    preview.style.background = 'none';
  } else {
    preview.textContent = staff.name.charAt(0).toUpperCase();
    preview.style.background = 'linear-gradient(135deg, var(--cyan), var(--teal))';
  }

  $('modal-profile').classList.remove('hidden');
};

window.handlePhotoUpload = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Simple size check (2MB)
  if (file.size > 2 * 1024 * 1024) {
    showToast('Image too large! Please use a photo under 2MB.', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result;
    const preview = $('profile-photo-preview');
    preview.innerHTML = `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    preview.style.background = 'none';
    
    // Temporarily store in a data attribute to save later
    $('modal-profile').setAttribute('data-pending-photo', base64);
  };
  reader.readAsDataURL(file);
};

window.saveProfile = function() {
  const staff = STATE.settings.staffList.find(s => s.name === STATE.currentStaff);
  if (!staff) return;

  const newName = $('profile-name').value.trim();
  const newMobile = $('profile-mobile').value.trim();
  const newPass = $('profile-password').value.trim();
  const newPhoto = $('modal-profile').getAttribute('data-pending-photo');

  if (!newName) { showToast('Display Name is required', 'error'); return; }

  // Update staff object
  staff.name = newName;
  staff.mobile = newMobile;
  if (newPass) staff.password = newPass;
  if (newPhoto) staff.photo = newPhoto;

  // If name changed, we might need to update other things, but for now we update currentStaff
  STATE.currentStaff = newName;
  $('header-staff-name').textContent = newName;

  saveState();
  renderStaffLoginButtons();
  $('modal-profile').classList.add('hidden');
  $('modal-profile').removeAttribute('data-pending-photo');
  
  showToast('Profile updated successfully!', 'success');
};

/* ════════════════════════════════════════════════════════════
   SERVICE OPTIONS LOGIC
   ════════════════════════════════════════════════════════════ */
window.parseServiceOptions = function(str) {
  if (!str) return [];
  return str.split(',').map(part => {
    const [label, price] = part.split(':');
    return {
      label: label?.trim() || 'Standard',
      price: parseFloat(price?.trim()) || 0
    };
  }).filter(o => !isNaN(o.price));
};

window.showServiceOptionsModal = function(svcId, source) {
  const svc = STATE.settings.services.find(s => s.id === svcId);
  if (!svc) return;

  const options = parseServiceOptions(svc.options);
  if (!options.length) return;

  $('svc-options-title').textContent = `${svc.icon} ${svc.name}`;
  $('svc-options-grid').innerHTML = options.map(opt => `
    <button class="svc-option-btn" onclick="selectServiceOption('${svcId}', '${opt.label}', ${opt.price}, '${source}')">
      <span class="svc-option-label">${opt.label}</span>
      <span class="svc-option-price">₹${opt.price}</span>
    </button>
  `).join('');

  $('modal-service-options').classList.remove('hidden');
  
  // Close handler (single use)
  const close = () => {
    $('modal-service-options').classList.add('hidden');
    $('btn-close-svc-options').removeEventListener('click', close);
  };
  $('btn-close-svc-options').addEventListener('click', close);
};

window.selectServiceOption = function(svcId, label, price, source) {
  const svc = STATE.settings.services.find(s => s.id === svcId);
  if (!svc) return;

  const finalName = `${svc.name} (${label})`;
  
  if (source === 'rush') {
    addRushItem(svcId + '-' + label.replace(/\s+/g,'-'), finalName, svc.icon, price, true);
  } else {
    addToCart(svcId + '-' + label.replace(/\s+/g,'-'), finalName, svc.icon, price, true);
  }

  $('modal-service-options').classList.add('hidden');
};

// Update existing handlers to support options check
const rawAddRushItem = window.addRushItem;
window.addRushItem = function(id, name, icon, price, force = false) {
  if (!force) {
    const svc = STATE.settings.services.find(s => s.id === id);
    if (svc && svc.options && svc.options.trim().length > 0) {
      showServiceOptionsModal(id, 'rush');
      return;
    }
  }
  rawAddRushItem(id, name, icon, price);
};

const rawAddToCart = window.addToCart;
window.addToCart = function(id, name, icon, price, force = false) {
  if (!force) {
    const svc = STATE.settings.services.find(s => s.id === id);
    if (svc && svc.options && svc.options.trim().length > 0) {
      showServiceOptionsModal(id, 'standard');
      return;
    }
  }
  rawAddToCart(id, name, icon, price);
};



function init() {
  loadState();

  // If URL is hardcoded in GLOBAL_CONFIG, always use it (takes priority)
  if (GLOBAL_CONFIG.webhookUrl) {
    STATE.settings.webhookUrl = GLOBAL_CONFIG.webhookUrl;
  }
  // Supabase credentials — always use hardcoded values if present
  if (GLOBAL_CONFIG.supabaseUrl) {
    STATE.settings.supabaseUrl = GLOBAL_CONFIG.supabaseUrl;
  }
  if (GLOBAL_CONFIG.supabaseKey) {
    STATE.settings.supabaseKey = GLOBAL_CONFIG.supabaseKey;
  }

  renderStaffLoginButtons();
  startClock();
  initPaymentSelectors();
  bindEvents();
  startQuoteRotation();

  // Always show login first
  showScreen('login');

  // Check for local file protocol (CORS limitation)
  if (window.location.protocol === 'file:') {
    setTimeout(() => {
      showToast('⚠️ Running as Local File: Cloud Sync might be limited. For full sync, open via a Web Server or GitHub Pages.', 'warning', 8000);
      console.warn('CORS Warning: Running from file:// protocol. Google Sheets SYNC requires a web server (http/https).');
    }, 2000);
  }

  const hasCloud = STATE.settings.supabaseUrl || STATE.settings.webhookUrl;
  if (hasCloud) {
    // Show "Connecting..." banner while fetching cloud config
    showCloudSyncBanner(STATE.settings.supabaseUrl ? '⚡ Connecting to Supabase...' : '☁️ Connecting to Google Sheets...');
    // Re-init Supabase client if creds are loaded from localStorage
    _supabaseClient = null; // Reset so initSupabase re-creates
    fetchCloudConfig().then(ok => {
      renderStaffLoginButtons();  // refresh with cloud staff list
      hideCloudSyncBanner();
      if (ok) showCloudSyncBanner('✅ Cloud connected! Tap your name to login.', 'success', 3000);

      // Session restore: if already logged in, go straight to dashboard
      if (STATE.currentStaff && STATE.currentRole) {
        const staff = STATE.settings.staffList.find(s => s.name === STATE.currentStaff);
        if (staff) {
          window.loginAsStaff(staff); // this also calls fetchCloudData
        }
      }
    });
  } else {
    // No cloud — restore session from local cache if available
    if (STATE.currentStaff && STATE.currentRole) {
      const staff = STATE.settings.staffList.find(s => s.name === STATE.currentStaff);
      if (staff) window.loginAsStaff(staff);
    }
    // Show banner hint to connect
    showCloudSyncBanner('⚠️ No cloud configured. Data is local only.', 'error', 5000);
  }

  // Re-attempt any locally queued syncs & auto-push unsynced bills
  setTimeout(() => {
    processPendingSync();
    autoSyncUnsyncedBills();
  }, 3000);

  // Auto-refresh dashboard stats from Supabase every 60 seconds
  setInterval(() => {
    if ($('screen-dashboard').classList.contains('active') && STATE.currentStaff) {
      fetchCloudData().then(() => {
        updateDashboardStats();
        renderRecentTable();
      });
    }
  }, 60000);
}

document.addEventListener('DOMContentLoaded', init);

window.selectPickerIcon = function(targetId, icon) {
  const input = $(targetId);
  const preview = $(targetId + '-preview');
  if (input) input.value = icon;
  if (preview) preview.textContent = icon;
  showToast('Icon updated!', 'success', 500);
};

window.renderCustomerDatabase = function() {
  const tbody = $('cust-db-table-body');
  const searchInput = $('cust-db-search');
  const search = searchInput ? searchInput.value.toLowerCase() : '';
  
  if (!tbody) return;

  // 1. Group transactions by mobile number (unique identifier)
  const customers = {};
  STATE.transactions.forEach(tx => {
    if (!tx.mobile) return; // Skip walk-ins with no mobile
    
    if (!customers[tx.mobile]) {
      customers[tx.mobile] = {
        name: tx.customerName || 'N/A',
        mobile: tx.mobile,
        lastVisit: tx.date,
        totalJobs: 0,
        txDates: [] // Array to hold all readable dates for searching
      };
    }
    
    customers[tx.mobile].totalJobs++;
    // Add multiple searchable date formats (ISO and visual)
    customers[tx.mobile].txDates.push(tx.date.substring(0, 10));
    try {
      customers[tx.mobile].txDates.push(formatDateTimeShort(tx.date).toLowerCase());
    } catch(e) {}
    
    if (new Date(tx.date) > new Date(customers[tx.mobile].lastVisit)) {
      customers[tx.mobile].lastVisit = tx.date;
      if (tx.customerName) customers[tx.mobile].name = tx.customerName;
    }
  });

  let customerList = Object.values(customers);
  
  // 2. Filter by search
  if (search) {
    customerList = customerList.filter(c => 
      c.name.toLowerCase().includes(search) || 
      c.mobile.includes(search) ||
      c.txDates.some(dateStr => dateStr.includes(search))
    );
  }

  // 3. Sort by last visit (newest first)
  customerList.sort((a,b) => new Date(b.lastVisit) - new Date(a.lastVisit));

  if (!customerList.length) {
    const totalTxs = STATE.transactions.length;
    let emptyMsg = search ? 'No matching customers found.' : 'No unique customer records found yet.';
    if (!search && totalTxs > 0) {
      emptyMsg = 'History exists, but no mobile numbers were captured to create records.';
    }
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">${emptyMsg}</td></tr>`;
    return;
  }

  tbody.innerHTML = customerList.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td style="font-weight:700;">${c.name}</td>
      <td>${c.mobile}</td>
      <td>${formatDateTimeShort(c.lastVisit)}</td>
      <td><span class="badge-category" style="background:rgba(0,0,0,0.03); color:var(--text-primary); border:1px solid var(--border);">${c.totalJobs} visits</span></td>
      <td>
        <div style="display:flex; gap:0.4rem;">
          <button class="btn btn-ghost btn-sm" onclick="fastBillToCustomer('${c.mobile}', '${c.name.replace(/'/g,"\\'")}')" style="color:var(--cyan)">⚡ Fast Bill</button>
          <button class="btn btn-ghost btn-sm" onclick="directWhatsApp('${c.mobile}')" style="color:var(--whatsapp-color, #25D366)">📱 WhatsApp</button>
        </div>
      </td>
    </tr>
  `).join('');
};

window.fastBillToCustomer = function(mobile, name) {
  initServiceForm();
  $('sf-customer-name').value = name;
  $('sf-mobile').value = mobile;
  showScreen('service-form');
};

window.directWhatsApp = function(mobile) {
  let phone = mobile.replace(/\D/g, '');
  if (phone.length === 10) phone = '91' + phone;
  window.open(`https://wa.me/${phone}`, '_blank');
};


/* ════════════════════════════════════════════════════════════
   ATTENDANCE SYNC
════════════════════════════════════════════════════════════ */
async function syncAttendanceToSupabase(record) {
  const db = getSupabaseClient();
  if (!db) return;
  try {
    await db.from('attendance').upsert({
      id: record.id,
      staff: record.staff,
      login_time: record.loginTime,
      logout_time: record.logoutTime || null
    });
  } catch(e) { console.warn('Attendance sync failed', e); }
}

async function fetchAttendanceFromCloud() {
  const db = getSupabaseClient();
  if (!db) return;
  try {
    const { data, error } = await db.from('attendance').select('*').order('login_time', { ascending: false }).limit(2000);
    if (!error && data) {
      const cloudMap = {};
      data.forEach(r => { cloudMap[r.id] = r; });
      const merged = data.map(r => ({
        id: r.id,
        staff: r.staff,
        loginTime: r.login_time,
        logoutTime: r.logout_time || null
      }));
      STATE.attendance.forEach(local => { if (!cloudMap[local.id]) merged.push(local); });
      STATE.attendance = merged;
      saveState();
    }
  } catch(e) { console.warn('Attendance fetch failed', e); }
}


/* ════════════════════════════════════════════════════════════
   WITHDRAWAL REVIEW PANEL (Manager)
════════════════════════════════════════════════════════════ */
window.renderWithdrawalReview = function(staffFilter) {
  const tbody = $('wr-table-body');
  const summary = $('wr-summary');
  if (!tbody || !summary) return;

  // Build per-staff filter buttons
  const filterBtns = $('wr-staff-filter-btns');
  if (filterBtns && filterBtns.innerHTML === '') {
    STATE.settings.staffList.filter(s => s.role !== 'manager').forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm btn-ghost';
      btn.textContent = s.name;
      btn.onclick = () => renderWithdrawalReview(s.name);
      filterBtns.appendChild(btn);
    });
  }

  let withdrawals = [...STATE.withdrawals];
  if (staffFilter !== 'all') withdrawals = withdrawals.filter(w => w.staff === staffFilter);
  withdrawals.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Summary
  const totalReq = withdrawals.length;
  const totalAmt = withdrawals.reduce((s, w) => s + parseFloat(w.amount || 0), 0);
  const paidAmt  = withdrawals.filter(w => w.paid).reduce((s, w) => s + parseFloat(w.amount || 0), 0);
  const unpaidAmt = totalAmt - paidAmt;

  summary.innerHTML = `
    <div class="glass" style="padding:1rem;text-align:center;border-radius:14px;">
      <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600;">TOTAL REQUESTS</div>
      <div style="font-size:1.5rem;font-weight:800;color:var(--cyan);">${totalReq}</div>
    </div>
    <div class="glass" style="padding:1rem;text-align:center;border-radius:14px;">
      <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600;">PAID OUT</div>
      <div style="font-size:1.5rem;font-weight:800;color:var(--green);">${formatCurrency(paidAmt)}</div>
    </div>
    <div class="glass" style="padding:1rem;text-align:center;border-radius:14px;">
      <div style="font-size:0.75rem;color:var(--text-muted);font-weight:600;">PENDING</div>
      <div style="font-size:1.5rem;font-weight:800;color:var(--amber);">${formatCurrency(unpaidAmt)}</div>
    </div>
  `;

  if (!withdrawals.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No withdrawal records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = withdrawals.map((w, i) => `
    <tr>
      <td>${i + 1}</td>
      <td style="font-weight:700;">${w.staff}</td>
      <td style="font-family:var(--font-mono);color:var(--teal);font-weight:700;">${formatCurrency(w.amount)}</td>
      <td>${formatDateTimeShort(w.date)}</td>
      <td>
        <span style="padding:0.2rem 0.75rem;border-radius:999px;font-size:0.8rem;font-weight:700;
          background:${w.paid ? 'rgba(46,125,50,0.1)' : 'rgba(255,143,0,0.1)'};
          color:${w.paid ? 'var(--green)' : 'var(--amber)'};
          border:1px solid ${w.paid ? 'var(--green)' : 'var(--amber)'};">
          ${w.paid ? '✅ Paid' : '⏳ Pending'}
        </span>
      </td>
      <td>
        <button class="btn btn-sm ${w.paid ? 'btn-ghost' : 'btn-success'}" onclick="toggleWithdrawalPaid('${w.id}')">
          ${w.paid ? '↩ Unmark' : '✅ Mark Paid'}
        </button>
      </td>
    </tr>
  `).join('');
};

window.toggleWithdrawalPaid = function(id) {
  const w = STATE.withdrawals.find(x => x.id === id);
  if (!w) return;
  w.paid = !w.paid;
  saveState();

  // Sync to Supabase
  const db = getSupabaseClient();
  if (db) {
    db.from('withdrawals').upsert({ id: w.id, staff: w.staff, amount: w.amount, date: w.date, paid: w.paid })
      .then(() => {});
  }

  renderWithdrawalReview('all');
  showToast(w.paid ? `✅ Marked as paid for ${w.staff}` : `↩ Marked as pending for ${w.staff}`, 'success');
};


/* ════════════════════════════════════════════════════════════
   ATTENDANCE & PERFORMANCE ANALYTICS
════════════════════════════════════════════════════════════ */
window._attFilter = 'today';

window.setAttendanceFilter = function(filter) {
  window._attFilter = filter;
  ['today','week','month','all'].forEach(f => {
    const btn = $(`att-filter-${f}`);
    if (btn) btn.className = `btn btn-sm ${f === filter ? 'btn-primary' : 'btn-ghost'}`;
  });
  renderAttendanceModal();
};

window.renderAttendanceModal = async function() {
  const container = $('att-cards');
  if (!container) return;
  container.innerHTML = `<div class="empty-state">Loading attendance from cloud...</div>`;

  await fetchAttendanceFromCloud();

  const filter  = window._attFilter || 'today';
  const now     = new Date();

  function startOf(f) {
    if (f === 'today') { const d = new Date(now); d.setHours(0,0,0,0); return d; }
    if (f === 'week')  { const d = new Date(now); d.setDate(now.getDate() - now.getDay()); d.setHours(0,0,0,0); return d; }
    if (f === 'month') { return new Date(now.getFullYear(), now.getMonth(), 1); }
    return null;
  }

  const start = startOf(filter);
  const records = STATE.attendance.filter(r => !start || new Date(r.loginTime) >= start);

  const staffList = STATE.settings.staffList.filter(s => s.role !== 'manager');

  if (!staffList.length) {
    container.innerHTML = `<div class="empty-state">No staff configured.</div>`;
    return;
  }

  container.innerHTML = staffList.map(staff => {
    const sessions = records.filter(r => r.staff === staff.name);

    // Calculate totals
    let totalMins = 0;
    sessions.forEach(s => {
      if (s.logoutTime) {
        totalMins += (new Date(s.logoutTime) - new Date(s.loginTime)) / 60000;
      }
    });
    const hours = Math.floor(totalMins / 60);
    const mins  = Math.floor(totalMins % 60);

    // Performance from transactions
    const txFilter = start ? STATE.transactions.filter(tx => tx.staff === staff.name && new Date(tx.date) >= start)
                           : STATE.transactions.filter(tx => tx.staff === staff.name);
    const totalRevenue = txFilter.reduce((s, tx) => s + parseFloat(tx.amount || 0), 0);
    const govFees = txFilter.reduce((s, tx) => {
      const f = tx.items?.find(i => i.name === 'Gov Fees');
      return s + (f ? parseFloat(f.price) : 0);
    }, 0);
    const commission = (totalRevenue - govFees) * 0.10;
    const wallet = getStaffWallet(staff.name);

    const sessionRows = sessions.slice(0, 5).map(s => `
      <tr>
        <td style="font-size:0.8rem;">${new Date(s.loginTime).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</td>
        <td style="color:var(--green);font-weight:600;font-size:0.8rem;">${new Date(s.loginTime).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true})}</td>
        <td style="color:${s.logoutTime ? 'var(--red)' : 'var(--amber)'};font-weight:600;font-size:0.8rem;">
          ${s.logoutTime ? new Date(s.logoutTime).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true}) : '🟡 Active'}
        </td>
        <td style="font-size:0.8rem;color:var(--cyan);">
          ${s.logoutTime ? Math.floor((new Date(s.logoutTime)-new Date(s.loginTime))/60000) + ' min' : '—'}
        </td>
      </tr>
    `).join('');

    const photo = staff.photo
      ? `<img src="${staff.photo}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid var(--cyan);">`
      : `<div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,var(--cyan),var(--teal));display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:900;color:#fff;">${staff.name[0]}</div>`;

    return `
    <div class="glass" style="padding:1.5rem;border-radius:var(--radius-lg);">
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;">
        ${photo}
        <div style="flex:1;">
          <div style="font-size:1.1rem;font-weight:800;color:var(--text-primary);">${staff.name}</div>
          <div style="font-size:0.8rem;color:var(--text-muted);">${sessions.length} session(s) · ${hours}h ${mins}m total work time</div>
        </div>
        <!-- Performance chips -->
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          <span style="padding:0.3rem 0.8rem;border-radius:999px;background:rgba(0,160,220,0.08);border:1px solid var(--cyan);color:var(--cyan);font-size:0.78rem;font-weight:700;">Bills: ${txFilter.length}</span>
          <span style="padding:0.3rem 0.8rem;border-radius:999px;background:rgba(0,191,165,0.08);border:1px solid var(--teal);color:var(--teal);font-size:0.78rem;font-weight:700;">Revenue: ${formatCurrency(totalRevenue)}</span>
          <span style="padding:0.3rem 0.8rem;border-radius:999px;background:rgba(109,74,255,0.08);border:1px solid var(--purple);color:var(--purple);font-size:0.78rem;font-weight:700;">Commission: ${formatCurrency(commission)}</span>
          <span style="padding:0.3rem 0.8rem;border-radius:999px;background:rgba(255,143,0,0.08);border:1px solid var(--amber);color:var(--amber);font-size:0.78rem;font-weight:700;">Balance: ${formatCurrency(wallet.balance)}</span>
        </div>
      </div>

      ${sessions.length ? `
      <div class="table-wrapper" style="max-height:200px;overflow-y:auto;">
        <table style="font-size:0.82rem;">
          <thead><tr><th>Date</th><th>Login</th><th>Logout</th><th>Duration</th></tr></thead>
          <tbody>${sessionRows}${sessions.length > 5 ? `<tr><td colspan="4" class="empty-state" style="font-size:0.75rem;">...and ${sessions.length - 5} more sessions</td></tr>` : ''}</tbody>
        </table>
      </div>
      ` : `<div class="empty-state" style="font-size:0.85rem;">No sessions in this period.</div>`}
    </div>
    `;
  }).join('');
};

