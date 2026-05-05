// ========== GLOBAL SEARCH (Cmd+K / Ctrl+K) ==========
// ค้นข้าม contracts / properties / invoices / landlords ในที่เดียว

(function(){
  document.addEventListener('keydown', function(e){
    const isOpen = document.getElementById('searchPalette');
    // Cmd+K / Ctrl+K = open
    if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k') {
      e.preventDefault();
      if(isOpen) closeGlobalSearch(); else openGlobalSearch();
    }
    // Escape = close
    if(e.key==='Escape' && isOpen) { e.preventDefault(); closeGlobalSearch(); }
  });
})();

function openGlobalSearch(){
  if(document.getElementById('searchPalette'))return;
  const el = document.createElement('div');
  el.id = 'searchPalette';
  el.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding-top:80px;backdrop-filter:blur(2px)';
  el.innerHTML = `
    <div style="background:#fff;border-radius:14px;width:600px;max-width:92vw;box-shadow:0 20px 50px rgba(0,0,0,.25);overflow:hidden">
      <div style="padding:14px 18px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:10px">
        <span style="font-size:18px">🔎</span>
        <input id="searchInput" placeholder="ค้นผู้เช่า, ทรัพย์สิน, เลขที่บิล, ผู้ให้เช่า..." style="flex:1;border:none;outline:none;font-size:15px;font-family:Sarabun;color:#1e293b">
        <span style="font-size:11px;color:#94a3b8;background:#f1f5f9;padding:3px 8px;border-radius:6px">ESC</span>
      </div>
      <div id="searchResults" style="max-height:60vh;overflow-y:auto;padding:6px"></div>
    </div>`;
  el.addEventListener('click', e => { if(e.target===el) closeGlobalSearch(); });
  document.body.appendChild(el);
  const input = document.getElementById('searchInput');
  input.addEventListener('input', _runGlobalSearch);
  setTimeout(()=>input.focus(), 50);
  _runGlobalSearch();
}

function closeGlobalSearch(){
  const el = document.getElementById('searchPalette');
  if(el) el.remove();
}

function _runGlobalSearch(){
  const q = (document.getElementById('searchInput')?.value||'').trim().toLowerCase();
  const out = document.getElementById('searchResults');
  if(!out) return;
  if(!q){
    out.innerHTML = `<div style="padding:32px;text-align:center;color:#94a3b8;font-size:13px">เริ่มพิมพ์เพื่อค้นข้ามทั้งระบบ</div>`;
    return;
  }
  const matches = [];
  // Contracts
  (DB.contracts||[]).forEach(c => {
    const hit = (c.no||'').toLowerCase().includes(q) || (c.tenant||'').toLowerCase().includes(q) || (c.taxId||'').includes(q);
    if(hit) matches.push({type:'contract', icon:'📋', label:c.tenant||'(ไม่มีชื่อ)', sub:'สัญญา '+(c.no||'-'), id:c.id, action:`viewContract(${c.id})`});
  });
  // Properties
  (DB.properties||[]).forEach(p => {
    const hit = (p.name||'').toLowerCase().includes(q) || (p.location||'').toLowerCase().includes(q) || (p.address||'').toLowerCase().includes(q);
    if(hit) matches.push({type:'property', icon:'🏢', label:p.name||'(ไม่มีชื่อ)', sub:p.type+' · '+(p.province||p.location||''), id:p.pid, action:`showPage('properties');setTimeout(()=>{document.querySelector('[data-pid="${p.pid}"]')?.scrollIntoView({behavior:'smooth',block:'center'})},300)`});
  });
  // Invoices
  (DB.invoices||[]).forEach(inv => {
    const hit = (inv.invoiceNo||'').toLowerCase().includes(q) || (inv.tenant||'').toLowerCase().includes(q);
    if(hit) matches.push({type:'invoice', icon:'💰', label:inv.invoiceNo||'(ไม่มีเลข)', sub:(inv.tenant||'')+' · '+fmtBaht(inv.total||0), id:inv.id, action:`viewInvoiceDetail(${inv.id})`});
  });
  // Landlords (จาก contracts)
  const lls = new Map();
  (DB.contracts||[]).forEach(c => { if(c.landlord) lls.set(c.landlord, (lls.get(c.landlord)||0)+1); });
  lls.forEach((cnt, ll) => {
    if(ll.toLowerCase().includes(q)) matches.push({type:'landlord', icon:'👤', label:ll, sub:cnt+' สัญญา', id:ll, action:`showPage('landlords')`});
  });

  if(matches.length===0){
    out.innerHTML = `<div style="padding:32px;text-align:center;color:#94a3b8;font-size:13px">ไม่เจอข้อมูล "${esc(q)}"</div>`;
    return;
  }
  // Limit 50 across types
  const top = matches.slice(0, 50);
  out.innerHTML = top.map(m => `
    <button onclick="${m.action};closeGlobalSearch()" style="width:100%;text-align:left;padding:10px 14px;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;gap:12px;border-radius:8px;font-family:Sarabun" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
      <span style="font-size:18px;flex-shrink:0">${m.icon}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:#1e293b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.label)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.sub)}</div>
      </div>
    </button>
  `).join('');
}
