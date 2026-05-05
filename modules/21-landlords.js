// ========== LANDLORDS VIEW ==========
let llFilter = '';
let _llFilterTimer = null;
// Tier B pagination
const LANDLORDS_PER_PAGE = 50;
let llShown = LANDLORDS_PER_PAGE;
function showMoreLandlords(){ llShown += LANDLORDS_PER_PAGE; renderLandlords(); }
// Debounced filter — กัน focus loss + Thai IME break เพราะ re-render ทุก keystroke
function llFilterDebounced(v){
  llFilter = v;
  llShown = LANDLORDS_PER_PAGE; // reset pagination on filter
  if(_llFilterTimer) clearTimeout(_llFilterTimer);
  _llFilterTimer = setTimeout(()=>{
    renderLandlords();
    // restore focus + cursor position หลัง re-render
    const el = document.getElementById('llSearchInput');
    if(el){el.focus(); try{el.setSelectionRange(el.value.length,el.value.length);}catch(e){}}
  }, 250);
}
function renderLandlords(){
  const cs = DB.contracts;
  const ps = DB.properties;

  // Build landlord data from all contracts (active ones primarily)
  const llMap = {};
  cs.forEach(c => {
    const ll = c.landlord;
    if(!ll) return;
    if(!llMap[ll]) llMap[ll] = { name: ll, addr: '', addrs: new Set(), contracts: [], properties: new Set(), banks: new Map(), totalRevMo: 0, totalRevYr: 0, active: 0, cancelled: 0, expired: 0, headerMatch: null, signers: {} };
    const entry = llMap[ll];
    entry.contracts.push(c);
    if(c.landlordAddr){ if(!entry.addr) entry.addr = c.landlordAddr; entry.addrs.add(c.landlordAddr); }
    // นับว่ากรรมการคนไหนเซ็นกี่สัญญา
    if(c.landlordSignerName){
      const sn = c.landlordSignerName.trim();
      if(sn) entry.signers[sn] = (entry.signers[sn]||0) + 1;
    }
    entry.properties.add(c.pid);
    const st = status(c);
    if(st === 'active' || st === 'expiring' || st === 'upcoming') {
      entry.active++;
      const freq = payFreq(c.rate, c.payment);
      const mo = monthlyRev(c);
      if(freq.type === 'yearly' || freq.type === 'lump') { entry.totalRevYr += mo * 12; }
      else { entry.totalRevMo += mo; }
    } else if(st === 'cancelled') { entry.cancelled++; }
    else { entry.expired++; }
    // Collect bank accounts
    if(c.bank && c.acctNo) {
      const bKey = c.bank + '|' + c.acctNo;
      if(!entry.banks.has(bKey)) entry.banks.set(bKey, { bank: c.bank, acctNo: c.acctNo, accountName: c.accountName || '' });
    }
    // Link to invoiceHeader if available
    if(c.invHeaderId && !entry.headerMatch){
      entry.headerMatch = (DB.invoiceHeaders||[]).find(x=>x.id===+c.invHeaderId) || null;
    }
  });

  let llArr = Object.values(llMap).sort((a,b) => (b.totalRevMo + b.totalRevYr/12) - (a.totalRevMo + a.totalRevYr/12));

  // Filter
  if(llFilter) {
    const q = llFilter.toLowerCase();
    llArr = llArr.filter(l => l.name.toLowerCase().includes(q) || l.addr.toLowerCase().includes(q) || [...l.banks.values()].some(b => b.bank.includes(q) || b.acctNo.includes(q)));
  }

  // Summary KPIs
  const totalLL = Object.keys(llMap).length;
  const totalActiveContracts = llArr.reduce((s,l) => s + l.active, 0);
  const totalRevMo = llArr.reduce((s,l) => s + l.totalRevMo, 0);
  const totalRevYr = llArr.reduce((s,l) => s + l.totalRevYr, 0);

  let html = `<div style="max-width:1100px;margin:0 auto">`;

  // KPI cards (unified design)
  html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:20px">
    <div class="kpi-box"><div class="kv" style="color:#6366f1">${totalLL}</div><div class="kl">ผู้ให้เช่า</div></div>
    <div class="kpi-box"><div class="kv" style="color:#059669">${totalActiveContracts}</div><div class="kl">สัญญามีผล</div></div>
    <div class="kpi-box accent"><div class="kv" style="color:#059669">${fmtBaht(totalRevMo,{sym:0})}</div><div class="kl">บ./เดือน</div></div>
    ${totalRevYr>0?'<div class="kpi-box accent2"><div class="kv" style="color:#2563eb">'+fmtBaht(totalRevYr,{sym:0})+'</div><div class="kl">บ./ปี</div></div>':''}
  </div>`;

  // Search (unified design)
  html += `<div style="margin-bottom:16px;position:relative;max-width:400px">
    <svg style="width:14px;height:14px;position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#64748b" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
    <input id="llSearchInput" type="text" value="${esc(llFilter)}" oninput="llFilterDebounced(this.value)" placeholder="ค้นหาผู้ให้เช่า ธนาคาร เลขบัญชี..." class="w-full pl-9 pr-4 py-2 border rounded-lg text-sm">
  </div>`;

  // Landlord cards
  llArr.slice(0,llShown).forEach(l => {
    const propCount = l.properties.size;
    const bankArr = [...l.banks.values()];
    const totalRev = l.totalRevMo + (l.totalRevYr / 12);
    const propNames = [...l.properties].map(pid => {
      const p = ps.find(x => x.pid === pid);
      return p ? p.name : 'ทรัพย์สิน #'+pid;
    });

    html += `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:0;margin-bottom:12px;overflow:hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;gap:12px;flex-wrap:wrap;cursor:pointer;transition:background 0.15s" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='#fff'" onclick="this.nextElementSibling.classList.toggle('hidden')">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
            ${(()=>{const hm=l.headerMatch||(DB.invoiceHeaders||[]).find(x=>x.companyName===l.name);return hm&&hm.logo?'<img src="'+esc(hm.logo)+'" style="width:36px;height:36px;border-radius:50%;object-fit:contain;border:2px solid #e5e7eb;flex-shrink:0;background:#fff">':'<div style="width:36px;height:36px;border-radius:50%;background:#6366f1;display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg style="width:18px;height:18px;color:#fff" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg></div>';})()}
            <div>
              <div style="font-size:15px;font-weight:700;color:#111827">${esc(shortLandlordName(l.name))}</div>
              ${(()=>{
                const sks=Object.keys(l.signers);
                if(!sks.length) return '';
                const chips=sks.sort((a,b)=>l.signers[b]-l.signers[a]).map(n=>`<span style="display:inline-block;background:#eef2ff;color:#4338ca;font-size:10px;padding:2px 8px;border-radius:99px;margin-right:4px">เซ็นโดย ${esc(n)} (${l.signers[n]})</span>`).join('');
                return `<div style="margin-top:3px">${chips}</div>`;
              })()}
              ${l.addr ? `<div style="font-size:11px;color:#9ca3af;max-width:400px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l.addr)} <span onclick="event.stopPropagation();editLandlordAddr('${esc(l.name.replace(/'/g,"\\'"))}')" style="color:#6366f1;cursor:pointer;font-size:10px;text-decoration:underline">แก้ไข</span>${l.addrs.size>1?`<span style="color:#dc2626;font-size:10px;margin-left:6px;font-weight:600" title="บริษัทเดียวกันมีหลายที่อยู่ — ตรวจสอบ">⚠ มี ${l.addrs.size} ที่อยู่</span>`:''}</div>` : `<div><span onclick="event.stopPropagation();editLandlordAddr('${esc(l.name.replace(/'/g,"\\'"))}')" style="color:#6366f1;cursor:pointer;font-size:11px">+ เพิ่มที่อยู่</span></div>`}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:16px;align-items:center;flex-shrink:0;flex-wrap:wrap">
          <div style="text-align:center">
            <div style="font-size:20px;font-weight:800;color:#6366f1">${propCount}</div>
            <div style="font-size:10px;color:#9ca3af">แปลง</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:20px;font-weight:800;color:#059669">${l.active}</div>
            <div style="font-size:10px;color:#9ca3af">สัญญามีผล</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:16px;font-weight:700;color:#d97706">${totalRev ? fmtBaht(totalRev,{sym:0}) : '0'}</div>
            <div style="font-size:10px;color:#9ca3af">บ./เดือน</div>
          </div>
          <svg style="width:16px;height:16px;color:#9ca3af;transition:transform 0.2s" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
        </div>
      </div>

      <div class="hidden" style="border-top:1px solid #f3f4f6;padding:16px 20px;background:#fafbfc">
        <!-- Bank accounts -->
        <div style="margin-bottom:14px">
          <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px;display:flex;align-items:center;gap:6px">
            <svg style="width:14px;height:14px;color:#6366f1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
            บัญชีธนาคาร (${bankArr.length})
          </div>
          ${bankArr.length ? bankArr.map(b => `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:4px">
            <div style="flex:1">
              <div style="font-size:13px;font-weight:600;color:#111827">${esc(b.accountName) || '-'}</div>
              <div style="font-size:12px;color:#6b7280">${esc(b.bank)} · ${esc(b.acctNo)}</div>
            </div>
          </div>`).join('') : '<div style="font-size:12px;color:#9ca3af;padding:4px 0">ไม่มีข้อมูลบัญชี</div>'}
        </div>

        <!-- Properties & contracts -->
        <div>
          <div style="font-size:12px;font-weight:700;color:#374151;margin-bottom:8px;display:flex;align-items:center;gap:6px">
            <svg style="width:14px;height:14px;color:#059669" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            ทรัพย์สินที่ให้เช่า (${propCount})
          </div>
          ${propNames.map((pn, i) => {
            const pid = [...l.properties][i];
            const pContracts = l.contracts.filter(c => c.pid === pid);
            const activeC = pContracts.filter(c => { const s=status(c); return s==='active'||s==='expiring'||s==='upcoming'; });
            return `<div style="padding:8px 12px;background:#fff;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:4px">
              <div style="font-size:13px;font-weight:600;color:#111827;margin-bottom:4px">${esc(pn)}</div>
              ${activeC.length ? activeC.map(ac => {
                const acSt = status(ac);
                const stC = {active:'#059669',expiring:'#d97706',expired:'#dc2626',upcoming:'#2563eb',cancelled:'#64748b'}[acSt] || '#6b7280';
                return `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:3px 0;color:#374151">
                  <span><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${stC};margin-right:6px"></span>${esc(ac.tenant)||'-'} <span style="color:#9ca3af">(${esc(ac.no)||''})</span></span>
                  <span style="color:${stC};font-weight:600">${fmtBaht(monthlyRev(ac),{sym:0})} บ./ด.</span>
                </div>`;
              }).join('') : '<div style="font-size:12px;color:#9ca3af">ไม่มีสัญญามีผล</div>'}
            </div>`;
          }).join('')}
        </div>
        ${l.cancelled > 0 ? `<div style="font-size:11px;color:#9ca3af;margin-top:8px">ยกเลิก ${l.cancelled} ฉบับ</div>` : ''}
        ${l.expired > 0 ? `<div style="font-size:11px;color:#9ca3af">หมดอายุ ${l.expired} ฉบับ</div>` : ''}
      </div>
    </div>`;
  });

  if(llArr.length === 0) {
    html += `<div style="text-align:center;padding:40px;color:#9ca3af;font-size:14px">ไม่พบผู้ให้เช่า</div>`;
  } else if(llArr.length > llShown) {
    html += `<div style="text-align:center;padding:14px;margin-top:8px"><button onclick="showMoreLandlords()" style="padding:10px 22px;background:#fff;color:#475569;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">⬇ แสดงเพิ่ม ${Math.min(LANDLORDS_PER_PAGE,llArr.length-llShown)} ราย <span style="color:#94a3b8;font-weight:400;margin-left:6px">(แสดง ${llShown}/${llArr.length})</span></button></div>`;
  }

  html += `</div>`;
  $('content').innerHTML = html;
}

// ========== BACKFILL PAST PAYMENTS ==========
