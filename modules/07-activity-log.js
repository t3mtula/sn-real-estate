// ========== ACTIVITY LOG ==========
// addActivityLog(action, desc, dataOrOpts)
// dataOrOpts รองรับทั้งรูปแบบเก่า ({reason:...}) และใหม่ ({entity_type, entity_id, before, after})
function addActivityLog(action, desc, data){
  if(!DB.activityLog) DB.activityLog=[];
  const now=new Date();
  const ts=now.toISOString();
  const beDateStr=String(now.getDate()).padStart(2,'0')+'/'+String(now.getMonth()+1).padStart(2,'0')+'/'+(now.getFullYear()+543)+' '+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  DB.activityLog.unshift({ts,beDateStr,action,desc,data:data||null});
  if(DB.activityLog.length>500) DB.activityLog.length=500;
  // Persist ลง Supabase
  if(typeof logActivityToSupabase === 'function') {
    try {
      const opts = (data && (data.entity_type || data.entity_id || data.before || data.after)) ? data : null;
      const detail = desc + (data && data.reason ? ' — '+data.reason : '');
      logActivityToSupabase(action, detail, opts);
    } catch(e){}
  }
}

function addInvoiceAudit(invId, action, detail, snapshot){
  const inv=DB.invoices.find(x=>x.id===invId);
  if(!inv){
    // For deleted invoices, store in orphan audit
    if(!DB.invoiceAuditOrphan) DB.invoiceAuditOrphan=[];
    const now=new Date();
    const beDateStr=String(now.getDate()).padStart(2,'0')+'/'+String(now.getMonth()+1).padStart(2,'0')+'/'+(now.getFullYear()+543)+' '+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    DB.invoiceAuditOrphan.unshift({invId,ts:now.toISOString(),beDateStr,action,detail,snapshot:snapshot||null});
    if(DB.invoiceAuditOrphan.length>500) DB.invoiceAuditOrphan.length=500;
    return;
  }
  if(!inv.audit) inv.audit=[];
  const now=new Date();
  const beDateStr=String(now.getDate()).padStart(2,'0')+'/'+String(now.getMonth()+1).padStart(2,'0')+'/'+(now.getFullYear()+543)+' '+String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  inv.audit.unshift({ts:now.toISOString(),beDateStr,action,detail,snapshot:snapshot||null});
  if(inv.audit.length>50) inv.audit.length=50;
}

// Audit log viewer — โหลดจาก Supabase (re_activity_log) + filter
let _auditFilter = { entity_type: '', user: '', limit: 200 };

async function viewActivityLog(){
  $('mtitle').textContent='📋 ประวัติกิจกรรม (Audit Log)';
  $('mbody').innerHTML = `<div style="text-align:center;padding:40px;color:#64748b">⏳ โหลดข้อมูล...</div>`;
  $('modal').classList.remove('hidden');
  await _renderAuditLog();
}

async function _renderAuditLog(){
  const logs = (typeof loadActivityLog === 'function')
    ? await loadActivityLog(_auditFilter)
    : (DB.activityLog||[]).slice(0,200);
  const icons = {
    add_contract:'📝', delete_contract:'🗑️', cancel_contract:'⛔', renew_contract:'🔄',
    copy_contract:'📋', sign_contract:'✓', unsign_contract:'✕', edit_contract:'✏️',
    payment:'💰', add_property:'🏢', edit_property:'🏢', delete_property:'🗑️',
    edit:'✏️', import:'📥', export_data:'📤',
    invoice_sent:'📤', batch_send:'📤', batch_send_global:'📤',
    receive_payment:'💰', login:'🔐', login_fail:'⛔', staff:'👤',
    import_db_ready:'📥', import_data:'📥', restore_backup:'🔄', batch_print:'🖨️'
  };
  const entityIcon = { contract:'📋', property:'🏢', invoice:'💰', payment:'💵', deposit:'🔒', staff:'👤', settings:'⚙️' };
  const entityTypes = ['', 'contract', 'property', 'invoice', 'payment', 'deposit', 'staff', 'settings'];
  const users = Array.from(new Set(logs.map(l => l.user_name).filter(Boolean))).sort();

  const filterBar = `<div style="display:flex;gap:8px;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid #e5e7eb;margin-bottom:10px">
    <select onchange="_auditFilter.entity_type=this.value;_renderAuditLog()" style="padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-family:Sarabun">
      ${entityTypes.map(t => `<option value="${t}" ${t===_auditFilter.entity_type?'selected':''}>${t?(entityIcon[t]||'')+' '+t:'— ทุกประเภท —'}</option>`).join('')}
    </select>
    <select onchange="_auditFilter.user=this.value;_renderAuditLog()" style="padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-family:Sarabun">
      <option value="">— ทุก user —</option>
      ${users.map(u => `<option value="${u}" ${u===_auditFilter.user?'selected':''}>${u}</option>`).join('')}
    </select>
    <input type="number" min="50" max="1000" step="50" value="${_auditFilter.limit}" onchange="_auditFilter.limit=parseInt(this.value)||200;_renderAuditLog()" style="width:80px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;font-family:Sarabun">
    <span style="font-size:12px;color:#64748b;align-self:center">แสดง ${logs.length} รายการล่าสุด</span>
  </div>`;

  const rows = logs.length === 0
    ? `<div style="text-align:center;padding:40px;color:#64748b">ยังไม่มีกิจกรรม</div>`
    : logs.map(l => {
        const ts = l.created_at || l.ts;
        const dt = ts ? new Date(ts) : null;
        const beStr = dt ? `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()+543} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}` : (l.beDateStr||'-');
        const detail = l.detail || l.desc || '';
        const action = l.action || '';
        const user = l.user_name || (l.data && l.data.user) || '—';
        const eIcon = l.entity_type ? (entityIcon[l.entity_type]||'') : '';
        const aIcon = icons[action] || '📋';
        const payloadStr = l.payload ? `<details style="margin-top:4px"><summary style="font-size:10px;color:#64748b;cursor:pointer">ดู before/after</summary><pre style="font-size:10px;background:#f8fafc;padding:6px;border-radius:4px;overflow-x:auto;margin-top:4px">${JSON.stringify(l.payload,null,2).replace(/</g,'&lt;')}</pre></details>` : '';
        return `<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px">
          <span style="font-size:18px;flex-shrink:0">${aIcon}</span>
          <div style="flex:1;min-width:0">
            <div style="color:#334155">${esc(detail)}</div>
            <div style="color:#64748b;font-size:11px;margin-top:2px;display:flex;gap:8px;flex-wrap:wrap">
              <span>👤 ${esc(user)}</span>
              <span>·</span>
              <span>${esc(beStr)}</span>
              ${l.entity_type ? `<span>·</span><span>${eIcon} ${esc(l.entity_type)}${l.entity_id?' #'+esc(l.entity_id):''}</span>` : ''}
            </div>
            ${payloadStr}
          </div>
        </div>`;
      }).join('');

  $('mbody').innerHTML = `<div>${filterBar}<div style="max-height:60vh;overflow-y:auto">${rows}</div></div>`;
}

