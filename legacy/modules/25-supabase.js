// ========== SUPABASE DATA LAYER ==========
// ใช้ fetch() ตรงๆ แทน Supabase client เพื่อหลีกเลี่ยง token-refresh hang

const SUPA_REST = SUPA_URL + '/rest/v1';

function _authHeaders(token) {
  return {
    'apikey': SUPA_KEY,
    'Authorization': 'Bearer ' + (token || SUPA_KEY),
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
}

async function _getToken() {
  if(window._currentAccessToken) return window._currentAccessToken;
  try {
    const p = _supaClient().auth.getSession();
    const timeout = new Promise((_,r) => setTimeout(() => r(new Error('timeout')), 5000));
    const { data: { session } } = await Promise.race([p, timeout]);
    return session ? session.access_token : null;
  } catch(e) { return null; }
}

// เมื่อ token หมดอายุ (401) → refresh + retry
async function _refreshToken() {
  try {
    const { data, error } = await _supaClient().auth.refreshSession();
    if(error || !data.session) {
      console.warn('[supabase] refresh failed — re-login required');
      if(typeof toast === 'function') toast('Session หมดอายุ — กรุณา login ใหม่', 'warning');
      setTimeout(() => logout(), 2000);
      return null;
    }
    window._currentAccessToken = data.session.access_token;
    return data.session.access_token;
  } catch(e) { console.warn('[supabase] refresh error', e); return null; }
}

async function _fetchTable(table, token) {
  try {
    let r = await fetch(`${SUPA_REST}/${table}?select=*`, { headers: _authHeaders(token) });
    if(r.status === 401) {
      const newToken = await _refreshToken();
      if(newToken) r = await fetch(`${SUPA_REST}/${table}?select=*`, { headers: _authHeaders(newToken) });
    }
    if(!r.ok) { console.warn('fetchTable', table, r.status); return []; }
    return await r.json();
  } catch(e) { console.warn('fetchTable error', table, e.message); return []; }
}

// ── LOAD ──────────────────────────────────────────────────────────────────
async function loadFromSupabase() {
  const token = await _getToken();
  if(!token) throw new Error('ไม่มี session — กรุณา login ใหม่');

  const [properties, contracts, invoices, depositLedger,
         staffRows, invoiceHeaders, templates, inspections, config] = await Promise.all([
    _fetchTable('properties',    token),
    _fetchTable('contracts',     token),
    _fetchTable('invoices',      token),
    _fetchTable('deposit_ledger',token),
    _fetchTable('re_staff',      token),
    _fetchTable('invoice_headers',token),
    _fetchTable('re_templates',  token),
    _fetchTable('inspections',   token),
    _fetchTable('re_config',     token)
  ]);

  DB.properties     = properties.map(r => r.data || {});
  DB.contracts      = contracts.map(r => r.data || {});
  DB.invoices       = invoices.map(r => r.data || {});
  DB.depositLedger  = depositLedger.map(r => r.data || {});
  DB.invoiceHeaders = invoiceHeaders.map(r => r.data || {});
  DB.templates      = templates.map(r => r.data || {});
  DB.inspections    = inspections.map(r => r.data || {});
  DB.staff          = staffRows.map(r => ({ ...(r.data||{}), name:r.name, role:r.role, email:r.email, id:r.id }));

  const cfg = {};
  config.forEach(c => { cfg[c.key] = c.value; });

  DB.nextPId          = Number(cfg.nextPId)         || 200;
  DB.nextCId          = Number(cfg.nextCId)         || 200;
  DB.nextInvId        = Number(cfg.nextInvId)       || 1000;
  DB.nextReceiptId    = Number(cfg.nextReceiptId)   || 1;
  DB.nextDepLedgerId  = Number(cfg.nextDepLedgerId) || 1;
  DB.nextInspId       = Number(cfg.nextInspId)      || 1;
  DB.activeTemplate   = cfg.activeTemplate  ?? null;
  DB.defaultInvHeader = cfg.defaultInvHeader ?? null;
  DB.formConfig       = cfg.formConfig  || {};
  DB.sysConfig        = cfg.sysConfig   || { expiringDays: 90 };
  DB.slipOk           = cfg.slipOk      || { branchId:'', apiKey:'', enabled:false };
  if(!DB.payments)    DB.payments    = {};
  if(!DB.activityLog) DB.activityLog = [];
}

// ── SAVE ──────────────────────────────────────────────────────────────────
async function saveToSupabase() {
  const token = await _getToken();
  if(!token) return;
  window._lastLocalSaveAt = Date.now(); // ป้องกัน self-trigger realtime reload

  const upsert = async (table, rows) => {
    if(!rows || !rows.length) return;
    let useToken = token;
    let r = await fetch(`${SUPA_REST}/${table}`, {
      method: 'POST',
      headers: { ..._authHeaders(useToken), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows)
    });
    if(r.status === 401) {
      useToken = await _refreshToken();
      if(useToken) r = await fetch(`${SUPA_REST}/${table}`, {
        method: 'POST',
        headers: { ..._authHeaders(useToken), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows)
      });
    }
    if(!r.ok) console.warn('upsert error', table, r.status, await r.text());
  };

  const now = new Date().toISOString();
  const ops = [];

  if(DB.properties?.length)
    ops.push(upsert('properties', DB.properties.map(p => ({ id: String(p.pid||p.id||''), data:p, updated_at:now }))));
  if(DB.contracts?.length)
    ops.push(upsert('contracts', DB.contracts.map(c => ({ id:String(c.id||''), property_id:String(c.pid||''), status:c.cancelled?'cancelled':'active', data:c, updated_at:now }))));
  if(DB.invoices?.length)
    ops.push(upsert('invoices', DB.invoices.map(i => ({ id:String(i.id||''), contract_id:String(i.cid||''), status:i.status||'pending', category:i.category||'rent', data:i, updated_at:now }))));
  if(DB.depositLedger?.length)
    ops.push(upsert('deposit_ledger', DB.depositLedger.map(d => ({ id:String(d.id||''), contract_id:String(d.cid||''), type:d.type||'in', data:d }))));
  if(DB.invoiceHeaders?.length)
    ops.push(upsert('invoice_headers', DB.invoiceHeaders.map(h => ({ id:String(h.id||''), name:h.companyName||h.name||'', data:h }))));
  if(DB.templates?.length)
    ops.push(upsert('re_templates', DB.templates.map(t => ({ id:String(t.id||''), name:t.name||'', data:t }))));
  if(DB.inspections?.length)
    ops.push(upsert('inspections', DB.inspections.map(i => ({ id:String(i.id||''), contract_id:String(i.cid||''), data:i }))));
  if(DB.staff?.length)
    ops.push(upsert('re_staff', DB.staff.map(s => ({ id:s.email||s.name, name:s.name, role:s.role||'staff', email:s.email||null, data:s }))));

  // Config
  ops.push(upsert('re_config', [
    { key:'nextPId',          value:DB.nextPId||200,        updated_at:now },
    { key:'nextCId',          value:DB.nextCId||200,        updated_at:now },
    { key:'nextInvId',        value:DB.nextInvId||1000,     updated_at:now },
    { key:'nextReceiptId',    value:DB.nextReceiptId||1,    updated_at:now },
    { key:'nextDepLedgerId',  value:DB.nextDepLedgerId||1,  updated_at:now },
    { key:'nextInspId',       value:DB.nextInspId||1,       updated_at:now },
    { key:'activeTemplate',   value:DB.activeTemplate||null,updated_at:now },
    { key:'defaultInvHeader', value:DB.defaultInvHeader||null,updated_at:now },
    { key:'formConfig',       value:DB.formConfig||{},      updated_at:now },
    { key:'sysConfig',        value:DB.sysConfig||{},       updated_at:now },
    { key:'slipOk',           value:DB.slipOk||{},          updated_at:now }
  ]));

  await Promise.allSettled(ops);
}

// ── ACTIVITY LOG (Supabase) ────────────────────────────────────────────────
// opts: { entity_type, entity_id, before, after }
async function logActivityToSupabase(action, detail, opts) {
  opts = opts || {};
  try {
    const token = await _getToken();
    if(!token) return;
    const payload = (opts.before || opts.after) ? { before: opts.before||null, after: opts.after||null } : null;
    await fetch(`${SUPA_REST}/re_activity_log`, {
      method: 'POST',
      headers: _authHeaders(token),
      body: JSON.stringify({
        user_name:   currentUser?.email || currentUser?.name || 'system',
        action,
        detail,
        entity_type: opts.entity_type || null,
        entity_id:   opts.entity_id ? String(opts.entity_id) : null,
        payload
      })
    });
  } catch(e) { console.warn('activity_log error:', e); }
}

// โหลด audit log จาก Supabase (สำหรับ viewer)
async function loadActivityLog(filter) {
  filter = filter || {};
  try {
    const token = await _getToken();
    if(!token) return [];
    let url = `${SUPA_REST}/re_activity_log?select=*&order=created_at.desc&limit=${filter.limit||100}`;
    if(filter.entity_type) url += `&entity_type=eq.${encodeURIComponent(filter.entity_type)}`;
    if(filter.entity_id)   url += `&entity_id=eq.${encodeURIComponent(filter.entity_id)}`;
    if(filter.user)        url += `&user_name=eq.${encodeURIComponent(filter.user)}`;
    if(filter.since)       url += `&created_at=gte.${encodeURIComponent(filter.since)}`;
    const r = await fetch(url, { headers: _authHeaders(token) });
    if(!r.ok) return [];
    return await r.json();
  } catch(e) { console.warn('audit load error:', e); return []; }
}

// ── STAFF ROLE RESOLUTION ─────────────────────────────────────────────────
// Allowlists — sync กับ supabase/07-domain-allowlist.sql ฝั่ง DB
//   BOOTSTRAP_EMAILS: email เดี่ยวที่ admin คนแรกได้ตอน re_staff ว่าง
//   BOOTSTRAP_DOMAINS: domain ที่ใครก็ได้ใน Workspace นี้ login ได้ → auto-add เป็น admin
// ⚠️ Default role = 'admin' ระหว่าง permission ยังไม่เคลียร์ — Tem ปรับ role ที่หน้า Settings → พนักงาน
const BOOTSTRAP_EMAILS  = ['t3mtula@gmail.com'];
const BOOTSTRAP_DOMAINS = ['sstpconstruction.com', 'sombatnapa.com'];
const DOMAIN_DEFAULT_ROLE = 'admin';

function _emailDomain(email) {
  const i = String(email||'').lastIndexOf('@');
  return i > -1 ? email.slice(i+1).toLowerCase() : '';
}

// คืน { allowed: boolean, role: string|null }
async function _resolveStaffRole(email, name) {
  try {
    const token = await _getToken();
    if(!token) return { allowed:false, role:null };

    // 1. email อยู่ใน re_staff อยู่แล้ว → ใช้ role ที่บันทึกไว้
    const r = await fetch(`${SUPA_REST}/re_staff?email=eq.${encodeURIComponent(email)}&select=id,role&limit=1`, { headers: _authHeaders(token) });
    const rows = await r.json();
    if(rows && rows.length > 0) {
      return { allowed:true, role: rows[0].role || 'staff' };
    }

    // 2. ไม่อยู่ใน re_staff — เช็ค domain allowlist ก่อน (Workspace auto-add)
    const domain = _emailDomain(email);
    if(BOOTSTRAP_DOMAINS.includes(domain)) {
      const ins = await fetch(`${SUPA_REST}/re_staff`, {
        method: 'POST',
        headers: _authHeaders(token),
        body: JSON.stringify({ id:email, name, role:DOMAIN_DEFAULT_ROLE, email, data:{name,role:DOMAIN_DEFAULT_ROLE,email,createdAt:Date.now(),via:'domain'} })
      });
      if(ins.ok) return { allowed:true, role: DOMAIN_DEFAULT_ROLE };
      // RLS reject → fall through to bootstrap path
    }

    // 3. Bootstrap email path (re_staff ว่าง + email ใน allowlist เดี่ยว)
    if(!BOOTSTRAP_EMAILS.includes(email)) {
      return { allowed:false, role:null };
    }
    const countR = await fetch(`${SUPA_REST}/re_staff?select=id`, { headers: _authHeaders(token) });
    const all = await countR.json();
    if(!all || all.length === 0) {
      const ins = await fetch(`${SUPA_REST}/re_staff`, {
        method: 'POST',
        headers: _authHeaders(token),
        body: JSON.stringify({ id:email, name, role:'admin', email, data:{name,role:'admin',email,createdAt:Date.now()} })
      });
      if(!ins.ok) return { allowed:false, role:null };
      return { allowed:true, role:'admin' };
    }

    return { allowed:false, role:null };
  } catch(e) {
    console.warn('[auth] _resolveStaffRole error:', e);
    return { allowed:false, role:null };
  }
}

// ── REALTIME + AUTO-RELOAD ────────────────────────────────────────────────
// ทำงาน 2 ทาง: (1) Supabase realtime channel (2) reload เมื่อกลับมา tab
let _realtimeChannel = null;
let _lastReloadAt = 0;
const _RELOAD_DEBOUNCE_MS = 3000; // ป้องกัน reload รัวๆ

function setupRealtimeSync() {
  if(!currentUser) return;
  if(_realtimeChannel) return; // already setup
  try {
    const client = _supaClient();
    _realtimeChannel = client.channel('re_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' },     _onRemoteChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' },    _onRemoteChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' },      _onRemoteChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deposit_ledger' },_onRemoteChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 're_config' },     _onRemoteChange)
      .subscribe(status => console.log('[realtime]', status));
  } catch(e) { console.warn('[realtime] setup failed', e); }
}

// ถ้ากำลังเปิด modal แก้งานอยู่ → defer reload กัน user เสียงานที่ยังไม่ save
let _pendingRemoteReload = false;
async function _onRemoteChange(payload) {
  // ถ้า save() ของเราเองเพิ่งทำงาน — skip
  if(window._lastLocalSaveAt && (Date.now() - window._lastLocalSaveAt) < 2000) return;
  // Debounce reload
  if(Date.now() - _lastReloadAt < _RELOAD_DEBOUNCE_MS) return;

  // ── Concurrent edit guard ────────────────────────────────────────────
  // ถ้า modal เปิดอยู่ + dirty → defer reload + แสดง banner เตือน
  // (กัน user A กรอกแบบฟอร์มอยู่ แล้ว user B save ทับ → form A หาย)
  const modalEl = document.getElementById('modal');
  const modalOpen = modalEl && !modalEl.classList.contains('hidden');
  if(modalOpen && (typeof _modalDirty!=='undefined' && _modalDirty)) {
    _pendingRemoteReload = true;
    _showConcurrentEditBanner();
    return;
  }

  _lastReloadAt = Date.now();
  console.log('[realtime] remote change detected, reloading...');
  await loadFromSupabase();
  if(typeof render === 'function') render();
  if(typeof toast === 'function') toast('🔄 ข้อมูลอัปเดตจาก user อื่น', 'info', 2000);
}

function _showConcurrentEditBanner() {
  let bn = document.getElementById('concurrentEditBanner');
  if(bn) return; // already shown
  bn = document.createElement('div');
  bn.id = 'concurrentEditBanner';
  bn.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);z-index:10000;background:#fffbeb;border:2px solid #f59e0b;border-radius:10px;padding:12px 18px;box-shadow:0 8px 24px rgba(0,0,0,.15);font-family:Sarabun;display:flex;align-items:center;gap:12px;max-width:520px';
  bn.innerHTML = `
    <span style="font-size:24px;flex-shrink:0">⚠️</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:700;color:#92400e">มีคนอื่นเพิ่งแก้ข้อมูล</div>
      <div style="font-size:11px;color:#b45309;margin-top:2px">บันทึกของคุณก่อน หรือยกเลิกเพื่อโหลดข้อมูลใหม่</div>
    </div>
    <button onclick="_dismissConcurrentEditAndReload()" style="padding:6px 14px;background:#f59e0b;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun;flex-shrink:0">ยกเลิก + โหลดใหม่</button>`;
  document.body.appendChild(bn);
}

async function _dismissConcurrentEditAndReload() {
  const bn = document.getElementById('concurrentEditBanner');
  if(bn) bn.remove();
  _pendingRemoteReload = false;
  if(typeof _modalDirty!=='undefined') _modalDirty = false;
  const modalEl = document.getElementById('modal');
  if(modalEl) modalEl.classList.add('hidden');
  _lastReloadAt = Date.now();
  await loadFromSupabase();
  if(typeof render === 'function') render();
  if(typeof toast === 'function') toast('🔄 โหลดข้อมูลใหม่แล้ว', 'info', 2000);
}

// เมื่อ modal ถูกปิด (save หรือ cancel) → ถ้ามี pending reload, ทำเลย
// hook ผ่าน MutationObserver เพื่อไม่ต้องแก้ closeModal/save() ทุกที่
(function _watchModalClose(){
  if(typeof window==='undefined') return;
  const setup = () => {
    const m = document.getElementById('modal');
    if(!m) { setTimeout(setup, 500); return; }
    const ob = new MutationObserver(() => {
      if(m.classList.contains('hidden') && _pendingRemoteReload) {
        const bn = document.getElementById('concurrentEditBanner');
        if(bn) bn.remove();
        _pendingRemoteReload = false;
        _lastReloadAt = Date.now();
        loadFromSupabase().then(() => {
          if(typeof render === 'function') render();
          if(typeof toast === 'function') toast('🔄 ข้อมูลอัปเดตจาก user อื่น', 'info', 2000);
        });
      }
    });
    ob.observe(m, { attributes: true, attributeFilter: ['class'] });
  };
  setup();
})();

// Reload เมื่อกลับมา tab (visibilitychange)
document.addEventListener('visibilitychange', async function() {
  if(document.visibilityState === 'visible' && currentUser) {
    if(Date.now() - _lastReloadAt < _RELOAD_DEBOUNCE_MS) return;
    _lastReloadAt = Date.now();
    try { await loadFromSupabase(); if(typeof render==='function') render(); } catch(e) {}
  }
});

// ── CLOUD BACKUP (Supabase) ───────────────────────────────────────────────
// บันทึก snapshot เต็ม DB ลง re_config (key='backup_YYYY-MM-DD')
async function createCloudBackup() {
  try {
    const token = await _getToken();
    if(!token) return;
    const today = new Date().toISOString().slice(0,10);
    const snapshot = JSON.parse(JSON.stringify(DB));
    snapshot._backupAt = new Date().toISOString();
    await fetch(`${SUPA_REST}/re_config`, {
      method: 'POST',
      headers: { ..._authHeaders(token), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key: 'backup_' + today, value: snapshot, updated_at: new Date().toISOString() })
    });
    console.log('[backup] cloud backup saved:', today);
  } catch(e) { console.warn('[backup] cloud backup failed', e); }
}

// ── IDB MIGRATION ─────────────────────────────────────────────────────────
async function migrateIDBToSupabase() {
  try {
    toast('กำลังโอนข้อมูล...', 'info');
    const req = indexedDB.open('RentalManagementDB', 1);
    req.onsuccess = async function(e) {
      const idb = e.target.result;
      const tx  = idb.transaction('appData', 'readonly');
      const get = tx.objectStore('appData').get('main');
      get.onsuccess = async function() {
        const data = get.result;
        if(!data || !data.contracts) { toast('ไม่พบข้อมูลใน IndexedDB', 'error'); return; }
        Object.assign(DB, data);
        await saveToSupabase();
        toast('โอนข้อมูลสำเร็จ — ' + (DB.contracts||[]).length + ' สัญญา', 'success');
      };
    };
    req.onerror = () => toast('เปิด IndexedDB ไม่ได้', 'error');
  } catch(e) { toast('โอนข้อมูลไม่สำเร็จ: ' + e.message, 'error'); }
}
