// ========== REPORTS MODULE (24) ==========
// Phase 1 Foundation: skeleton + nav + permission hooks
// Spec: docs/REPORTS-SPEC.md
// CSS prefix: rpt-*
// Architectural rules: read-only module, no save(), no DB mutation

// ----- State (Phase 1: scoped inside module; move to 02-state.js if shared) -----
let rptActive = 'action';  // 'action'|'revenue'|'occupancy'|'expiry'|'arrears'|'property'|'renewal'
// R2-H2: bulk select state for overdue invoices in Action Center
let _ovSel = new Set();
function toggleOvSel(id){if(_ovSel.has(id))_ovSel.delete(id);else _ovSel.add(id);renderReportsPage();}
function toggleOvSelAll(ids){const all=ids.every(i=>_ovSel.has(i));if(all)ids.forEach(i=>_ovSel.delete(i));else ids.forEach(i=>_ovSel.add(i));renderReportsPage();}
function clearOvSel(){_ovSel.clear();renderReportsPage();}
function exportOvSelected(){
  const ids=[..._ovSel];
  if(ids.length===0)return toast('ยังไม่ได้เลือกรายการ','warning');
  if(typeof XLSX==='undefined')return toast('XLSX library ยังไม่โหลด','error');
  const rows=[];const now=new Date();
  ids.forEach(id=>{
    const inv=(DB.invoices||[]).find(x=>x.id===id);if(!inv)return;
    const due=parseBE(inv.dueDate);const days=due?Math.floor((now-due)/864e5):0;
    rows.push({'เลขบิล':inv.invoiceNo||inv.no||'-','ผู้เช่า':inv.tenant||'-','ทรัพย์สิน':inv.property||'-','ยอด':Number(inv.total)||0,'วันครบกำหนด':inv.dueDate||'-','เกิน(วัน)':days,'สถานะ':inv.status||'-'});
  });
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'บิลค้าง-ที่เลือก');
  const ts=new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb,`overdue-selected-${ts}.xlsx`);
  toast(`Export ${rows.length} รายการสำเร็จ`,'success');
}
let rptFilters = {
  dateFrom: null,   // BE string "DD/MM/YYYY" or null = default per report
  dateTo: null,
  propertyId: 'all',
  bucket: 'all',
  expiryRange: 90,  // days
  headerId: null,   // accounting reports: invoiceHeader filter (null = default, 'all' = ทุกบริษัท)
};

// ----- Report definitions (single source of truth) -----
const RPT_DEFS = [
  // Operational reports — ใช้ทุกวัน, decision support
  { id:'action',    label:'📅 Action Center',         perm:'view_report_action',    phase:'P0', section:'ops' },
  { id:'revenue',   label:'💰 รายได้',                perm:'view_report_revenue',   phase:'P0', section:'ops' },
  { id:'occupancy', label:'🏠 Occupancy',             perm:'view_report_occupancy', phase:'P0', section:'ops' },
  { id:'expiry',    label:'📆 สัญญาใกล้หมด',          perm:'view_report_expiry',    phase:'P0', section:'ops' },
  { id:'arrears',   label:'⏰ ค้างชำระ (Aging)',      perm:'view_report_arrears',   phase:'P0', section:'ops' },
  { id:'property',  label:'🏢 Property Performance',  perm:'view_report_property',  phase:'P1', section:'ops' },
  { id:'renewal',   label:'🔄 Renewal Rate',          perm:'view_report_renewal',   phase:'P1', section:'ops' },
  // Accounting reports — ออกทุกเดือน, ส่งสรรพากร/CPA, A4 + Excel
  { id:'taxsales',  label:'📋 ภาษีขาย (ภพ.30)',       perm:'view_report_revenue',   phase:'P3', section:'acct' },
  { id:'rentbills', label:'🧾 บิลค่าเช่ารายเดือน',    perm:'view_report_revenue',   phase:'P3', section:'acct' },
  { id:'depbal',    label:'💰 เงินประกันคงค้าง',       perm:'view_report_revenue',   phase:'P3', section:'acct' },
  { id:'depret',    label:'↩️ คืนเงินประกัน',          perm:'view_report_revenue',   phase:'P3', section:'acct' },
  { id:'baddebt',   label:'💸 หนี้สูญ',               perm:'view_report_revenue',   phase:'P3', section:'acct' },
  { id:'revanalysis', label:'📊 วิเคราะห์รายรับ',     perm:'view_report_revenue',   phase:'P3', section:'acct' },
];

// ----- Action layer (filter setters) -----
function rptSetActive(id){
  if(!RPT_DEFS.find(r=>r.id===id)) return;
  if(!hasPermission(RPT_DEFS.find(r=>r.id===id).perm)){
    toast('คุณไม่มีสิทธิ์ดูรายงานนี้','error');
    return;
  }
  rptActive = id;
  render();
}

function rptSetFilter(key, value){
  rptFilters[key] = value;
  render();
}

function rptSetMonthFilter(ceYear, month){
  const pad = n => String(n).padStart(2,'0');
  const lastDay = new Date(ceYear, month + 1, 0).getDate();
  rptFilters.dateFrom = `01/${pad(month+1)}/${ceYear+543}`;
  rptFilters.dateTo   = `${pad(lastDay)}/${pad(month+1)}/${ceYear+543}`;
  render();
}

function rptSetYearFilter(ceYear){
  rptFilters.dateFrom = `01/01/${ceYear+543}`;
  rptFilters.dateTo   = `31/12/${ceYear+543}`;
  render();
}

function rptClearDateFilter(){
  rptFilters.dateFrom = null;
  rptFilters.dateTo   = null;
  render();
}

// ----- Render layer (read-only) -----
function renderReportsPage(){
  // Permission check: ถ้าดูไม่ได้ report ปัจจุบัน → หา report แรกที่ดูได้
  const activeDef = RPT_DEFS.find(r=>r.id===rptActive);
  if(!activeDef || !hasPermission(activeDef.perm)){
    const firstAllowed = RPT_DEFS.find(r=>hasPermission(r.perm));
    if(firstAllowed){
      rptActive = firstAllowed.id;
    } else {
      $('content').innerHTML = rptNoAccessHTML();
      return;
    }
  }

  $('content').innerHTML = `
    <div class="rpt-wrap" style="padding:16px 24px">
      ${rptTabBarHTML()}
      <div class="rpt-body" style="margin-top:16px">
        ${rptRouteHTML(rptActive)}
      </div>
    </div>
  `;
  rptPostRender(rptActive);
}

// ----- Chart wrapper (destroy + recreate) -----
function rptChart(canvasId, config){
  if(typeof Chart === 'undefined') return null;
  if(!window._rptCharts) window._rptCharts = {};
  const prev = window._rptCharts[canvasId];
  if(prev){ try{ prev.destroy(); }catch(e){} }
  const el = document.getElementById(canvasId);
  if(!el) return null;
  const inst = new Chart(el.getContext('2d'), config);
  window._rptCharts[canvasId] = inst;
  return inst;
}

// ----- Post-render dispatch (chart init etc.) -----
function rptPostRender(id){
  // Destroy any leftover charts when switching tabs
  if(window._rptCharts){
    Object.keys(window._rptCharts).forEach(k=>{
      try{ window._rptCharts[k].destroy(); }catch(e){}
      delete window._rptCharts[k];
    });
  }
  switch(id){
    case 'revenue':   rptRevenueInitCharts(); break;
    case 'occupancy': rptOccupancyInitCharts(); break;
    case 'expiry':    rptExpiryInitCharts(); break;
    case 'arrears':   rptArrearsInitCharts(); break;
    case 'property':  rptPropertyPerfInitCharts(); break;
    case 'renewal':   rptRenewalInitCharts(); break;
  }
}

function rptTabBarHTML(){
  const allowed = RPT_DEFS.filter(r=>hasPermission(r.perm));
  const opsTabs = allowed.filter(r=>r.section!=='acct');
  const acctTabs = allowed.filter(r=>r.section==='acct');
  const renderTab = r => {
    const active = r.id===rptActive;
    return `<button onclick="rptSetActive('${r.id}')" class="rpt-tab" style="
      padding:8px 16px;border-radius:10px;border:none;cursor:pointer;font-family:Sarabun;font-size:13px;font-weight:600;
      background:${active?'#4f46e5':'#f1f5f9'};color:${active?'#fff':'#475569'};
      box-shadow:${active?'0 2px 8px rgba(79,70,229,.25)':'none'};
    ">${r.label}</button>`;
  };
  const sectionLabel = (txt, color) => `<div style="display:flex;align-items:center;gap:8px;margin:14px 4px 6px">
    <div style="width:3px;height:14px;background:${color};border-radius:2px"></div>
    <span style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:.5px;text-transform:uppercase">${txt}</span>
  </div>`;
  let html = `<div class="rpt-tabbar" style="background:#fff;border-radius:14px;box-shadow:0 1px 3px rgba(0,0,0,.04);padding:12px">`;
  if(opsTabs.length){
    html += sectionLabel('Operational — งานประจำวัน', '#4f46e5');
    html += `<div style="display:flex;gap:8px;flex-wrap:wrap">${opsTabs.map(renderTab).join('')}</div>`;
  }
  if(acctTabs.length){
    html += sectionLabel('บัญชี — ส่งสรรพากร/CPA', '#059669');
    html += `<div style="display:flex;gap:8px;flex-wrap:wrap">${acctTabs.map(renderTab).join('')}</div>`;
  }
  html += `</div>`;
  return html;
}

function rptRouteHTML(id){
  switch(id){
    case 'action':    return rptActionCenterHTML();
    case 'revenue':   return rptRevenueHTML();
    case 'occupancy': return rptOccupancyHTML();
    case 'expiry':    return rptExpiryHTML();
    case 'arrears':   return rptArrearsHTML();
    case 'property':  return rptPropertyPerfHTML();
    case 'renewal':   return rptRenewalHTML();
    case 'taxsales':  return rptTaxSalesHTML();
    case 'rentbills': return rptRentBillsHTML();
    case 'depbal':    return rptDepositBalanceHTML();
    case 'depret':    return rptDepositReturnHTML();
    case 'baddebt':   return rptBadDebtHTML();
    case 'revanalysis': return rptRevAnalysisHTML();
    default:          return rptPlaceholderHTML('Unknown', 'ไม่พบรายงาน');
  }
}

// ============================================================
// Phase 3: Accounting Reports — Shared Helpers
// ============================================================

// Resolve current selected header (null=default, 'all'=overview)
function rptResolveHeader(){
  const hid = rptFilters.headerId;
  const headers = DB.invoiceHeaders||[];
  if(hid==='all') return null;  // explicit overview mode
  if(hid==null){
    // default = DB.defaultInvHeader, fallback first
    return headers.find(h=>h.id===DB.defaultInvHeader) || headers[0] || null;
  }
  return headers.find(h=>h.id===hid) || null;
}

function rptIsOverviewMode(){ return rptFilters.headerId==='all'; }

// Company filter dropdown — used by accounting reports
function rptCompanyFilterHTML(){
  const headers = DB.invoiceHeaders||[];
  const sel = rptFilters.headerId;
  const current = rptResolveHeader();
  if(headers.length===0){
    return `<div style="padding:12px 16px;background:#fef3c7;border:1px solid #fbbf24;border-radius:10px;font-size:13px;color:#92400e">
      ⚠ ยังไม่มีหัวบริษัทในระบบ — <a href="javascript:void(0)" onclick="page='settings';settingsTab='invoice';render()" style="color:#92400e;font-weight:700;text-decoration:underline">ไปสร้างที่ตั้งค่า</a>
    </div>`;
  }
  const opts = headers.map(h=>{
    const isSel = current && h.id===current.id && sel!=='all';
    const branchTxt = h.branchCode && h.branchCode!=='00000' ? ` สาขา ${esc(h.branchCode)}` : (h.branchCode==='00000'?' (สนง.ใหญ่)':'');
    return `<option value="${esc(h.id)}" ${isSel?'selected':''}>${esc(h.companyName)||'-'}${branchTxt}</option>`;
  }).join('');
  return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
    <label style="font-size:12px;color:#64748b;font-weight:600">บริษัท:</label>
    <select onchange="rptSetFilter('headerId',this.value==='all'?'all':parseInt(this.value))" style="padding:7px 12px;border:1px solid #d1d5db;border-radius:8px;font-family:Sarabun;font-size:13px;background:#fff;min-width:240px">
      ${opts}
      <option value="all" ${sel==='all'?'selected':''}>📊 ทุกบริษัท (ภาพรวม — Excel เท่านั้น)</option>
    </select>
  </div>`;
}

// Date range filter — used by accounting reports
function rptDateRangeFilterHTML(){
  const from = rptFilters.dateFrom || '';
  const to   = rptFilters.dateTo   || '';
  const now  = new Date();
  const ceY  = now.getFullYear();
  const m    = now.getMonth();
  const prevM = m === 0 ? 11 : m - 1;
  const prevY = m === 0 ? ceY - 1 : ceY;
  const inputStyle = 'padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:12px;width:108px;font-family:Sarabun;cursor:pointer;background:#fff';
  const presetStyle = 'padding:5px 10px;background:#f1f5f9;color:#475569;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:Sarabun';
  const clearStyle  = 'padding:5px 10px;background:#fee2e2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:Sarabun';
  return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
    <label style="font-size:12px;color:#64748b;font-weight:600">จาก:</label>
    <input type="text" value="${from}" placeholder="DD/MM/YYYY" readonly
      onclick="openThaiDP(this)" onchange="rptSetFilter('dateFrom',this.value||null)"
      style="${inputStyle}">
    <label style="font-size:12px;color:#64748b;font-weight:600">ถึง:</label>
    <input type="text" value="${to}" placeholder="DD/MM/YYYY" readonly
      onclick="openThaiDP(this)" onchange="rptSetFilter('dateTo',this.value||null)"
      style="${inputStyle}">
    <button onclick="rptSetMonthFilter(${ceY},${m})" style="${presetStyle}">เดือนนี้</button>
    <button onclick="rptSetMonthFilter(${prevY},${prevM})" style="${presetStyle}">เดือนก่อน</button>
    <button onclick="rptSetYearFilter(${ceY})" style="${presetStyle}">ปีนี้</button>
    ${(from||to)?`<button onclick="rptClearDateFilter()" style="${clearStyle}">✕ ล้าง</button>`:''}
  </div>`;
}

// A4 print template (with company header) — used by accounting reports
// header: invoiceHeader object | null (overview mode)
// title: report title
// dateRangeStr: "01/04/2569 ถึง 30/04/2569"
// bodyHTML: report content
function rptA4PrintHTML(header, title, dateRangeStr, bodyHTML){
  const today = new Date();
  const todayBE = String(today.getDate()).padStart(2,'0')+'/'+String(today.getMonth()+1).padStart(2,'0')+'/'+(today.getFullYear()+543);
  const headerBlock = header ? `
    <div style="font-size:14px;font-weight:700;color:#1e293b">${esc(header.companyName)||'-'}${header.branchCode==='00000'||!header.branchCode?'':' สาขา '+esc(header.branchCode)}</div>
    ${header.address?`<div style="font-size:11px;color:#475569;margin-top:2px">${esc(header.address)}</div>`:''}
    ${header.taxId?`<div style="font-size:11px;color:#475569">เลขประจำตัวผู้เสียภาษี ${esc(header.taxId)}${header.branchCode?' ('+esc(header.branchCode)+')':''}</div>`:''}
    ${header.phone?`<div style="font-size:11px;color:#475569">โทร. ${esc(header.phone)}${header.email?' / อีเมล. '+esc(header.email):''}</div>`:''}
  ` : `<div style="font-size:14px;font-weight:700;color:#1e293b">📊 ภาพรวมทุกบริษัท</div>`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
      *{box-sizing:border-box}
      body{margin:0;padding:24px;font-family:'Sarabun',sans-serif;color:#1e293b;font-size:11px}
      .a4-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1e293b;padding-bottom:12px;margin-bottom:14px}
      .a4-title{text-align:center;font-size:16px;font-weight:700;margin:14px 0 8px}
      .a4-meta{display:flex;justify-content:space-between;font-size:11px;color:#475569;margin-bottom:14px}
      table{width:100%;border-collapse:collapse;font-size:10px}
      thead tr{background:#f1f5f9}
      th,td{padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}
      th{font-weight:700;color:#475569}
      .num{text-align:right;font-variant-numeric:tabular-nums}
      .totals{font-weight:700;background:#f8fafc;border-top:2px solid #1e293b}
      @media print{body{padding:12mm}.no-print{display:none}}
    </style></head><body>
    <div class="a4-header">
      <div>${headerBlock}</div>
      <div style="text-align:right;font-size:11px;color:#64748b">หน้า 1/1</div>
    </div>
    <div class="a4-title">${title}</div>
    <div class="a4-meta">
      <div>วันที่พิมพ์: ${todayBE}</div>
      <div>${dateRangeStr||''}</div>
      <div>เวลาที่พิมพ์: ${String(today.getHours()).padStart(2,'0')}:${String(today.getMinutes()).padStart(2,'0')}</div>
    </div>
    ${bodyHTML}
    <div class="no-print" style="margin-top:24px;text-align:center">
      <button onclick="window.print()" style="padding:10px 24px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">🖨 พิมพ์</button>
      <button onclick="window.close()" style="padding:10px 24px;background:#f1f5f9;color:#475569;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-family:Sarabun;margin-left:8px">ปิด</button>
    </div>
    </body></html>`;
}

// Open print preview in new window
function rptOpenA4Print(headerObj, title, dateRangeStr, bodyHTML){
  if(!headerObj){
    toast('ไม่สามารถพิมพ์โหมดภาพรวม — กรุณาเลือกบริษัทก่อน', 'warning');
    return;
  }
  const w = window.open('', '_blank');
  if(!w){ toast('ป๊อปอัพถูกบล็อค กรุณาอนุญาต popup','warning'); return; }
  w.document.write(rptA4PrintHTML(headerObj, title, dateRangeStr, bodyHTML));
  w.document.close();
}

// Filter invoices by header + date range + status
function rptFilterInvoices(opts){
  opts = opts || {};
  const header = opts.header || rptResolveHeader();
  const overview = rptIsOverviewMode();
  const fromBE = rptFilters.dateFrom; const toBE = rptFilters.dateTo;
  const from = fromBE ? parseBE(fromBE) : null;
  const to = toBE ? parseBE(toBE) : null;
  return (DB.invoices||[]).filter(inv=>{
    // Company filter
    if(!overview && header && inv.headerId !== header.id) return false;
    // Status filter (e.g. 'paid' for tax sales report)
    if(opts.statuses && !opts.statuses.includes(inv.status)) return false;
    // Exclude voided/draft by default for accounting
    if(opts.excludeVoid !== false && (inv.status==='voided' || inv.status==='void')) return false;
    if(opts.excludeDraft && inv.status==='draft') return false;
    // Date range — use opts.dateField (default 'date')
    const df = opts.dateField || 'date';
    const dStr = inv[df] || inv.date;
    const d = dStr ? parseBE(dStr) : null;
    if(from && (!d || d<from)) return false;
    if(to){ const tEnd = new Date(to.getFullYear(),to.getMonth(),to.getDate(),23,59,59); if(!d || d>tEnd) return false; }
    return true;
  });
}

function rptDateRangeStr(){
  const f = rptFilters.dateFrom; const t = rptFilters.dateTo;
  if(!f && !t) return '';
  if(f && t) return `(จากวันที่ ${f} ถึงวันที่ ${t})`;
  if(f) return `(จาก ${f})`;
  return `(ถึง ${t})`;
}

// ============================================================
// Shared helpers (for all reports)
// ============================================================
function rptKpiCardHTML(opts){
  // opts: {label, value, sub, color, bg}
  const c = opts.color || '#4f46e5';
  const bg = opts.bg || '#eef2ff';
  return `<div style="background:#fff;border:1px solid #e2e8f0;border-left:4px solid ${c};border-radius:12px;padding:16px;min-width:0">
    <div style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:.3px;text-transform:uppercase;margin-bottom:6px">${opts.label||''}</div>
    <div style="font-size:24px;font-weight:800;color:${c};line-height:1.1">${opts.value||0}</div>
    ${opts.sub?`<div style="font-size:11px;color:#64748b;margin-top:4px">${opts.sub}</div>`:''}
  </div>`;
}

function rptEmptyStateHTML(icon, text){
  return `<div style="text-align:center;padding:32px 16px;color:#64748b">
    <div style="font-size:32px;margin-bottom:8px">${icon||'📭'}</div>
    <div style="font-size:13px">${text||'ไม่มีข้อมูล'}</div>
  </div>`;
}

function rptSectionHTML(title, count, bodyHTML, accentColor){
  const c = accentColor || '#4f46e5';
  return `<div style="background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.04);margin-bottom:12px;overflow:hidden">
    <div style="padding:12px 16px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:8px">
      <div style="width:4px;height:16px;background:${c};border-radius:2px"></div>
      <div style="font-size:14px;font-weight:700;color:#1e293b">${title}</div>
      <div style="font-size:11px;color:#64748b;background:#f1f5f9;padding:2px 8px;border-radius:99px;font-weight:600">${count}</div>
    </div>
    <div>${bodyHTML}</div>
  </div>`;
}

// ============================================================
// Report 1: Action Center (P0)
// ============================================================
function rptCalcActionCenter(){
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const in30 = new Date(today); in30.setDate(in30.getDate()+30);
  const in7  = new Date(today); in7.setDate(in7.getDate()+7);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // 1. Contracts expiring in next 30 days (not cancelled, not already expired)
  const expiring = (DB.contracts||[]).filter(c=>{
    if(c.cancelled) return false;
    const e = parseBE(c.end);
    if(!e) return false;
    return e >= today && e <= in30;
  }).map(c=>{
    const e = parseBE(c.end);
    const daysLeft = Math.ceil((e - today)/864e5);
    const p = (DB.properties||[]).find(x=>x.pid===c.pid);
    return { c, daysLeft, propName: p?p.name:(c.property||'-') };
  }).sort((a,b)=>a.daysLeft-b.daysLeft);

  // 2. Overdue invoices (unpaid + past due)
  const overdue = (DB.invoices||[]).filter(inv=>{
    if(inv.status==='paid' || inv.status==='voided') return false;
    const days = getDaysOverdue(inv);
    return days > 0;
  }).map(inv=>{
    const days = getDaysOverdue(inv);
    const c = (DB.contracts||[]).find(x=>x.id===inv.cid);
    return { inv, days, tenantName: inv.tenant || (c?c.tenant:'-') };
  }).sort((a,b)=>b.days-a.days);

  // 3. Invoices due in next 7 days (not overdue yet, not paid)
  const dueSoon = (DB.invoices||[]).filter(inv=>{
    if(inv.status==='paid' || inv.status==='voided') return false;
    const d = parseBE(inv.dueDate);
    if(!d) return false;
    return d >= today && d <= in7;
  }).map(inv=>{
    const d = parseBE(inv.dueDate);
    const daysUntil = Math.ceil((d - today)/864e5);
    return { inv, daysUntil };
  }).sort((a,b)=>a.daysUntil-b.daysUntil);

  // 4. New contracts this month
  const newThisMonth = (DB.contracts||[]).filter(c=>{
    if(c.cancelled) return false;
    const s = parseBE(c.start);
    return s && s >= monthStart && s <= today;
  });

  // Totals
  const overdueTotal = overdue.reduce((s,x)=>s + (Number(x.inv.total)||0), 0);
  const dueSoonTotal = dueSoon.reduce((s,x)=>s + (Number(x.inv.total)||0), 0);

  return { expiring, overdue, dueSoon, newThisMonth, overdueTotal, dueSoonTotal };
}

function rptActionCenterHTML(){
  const data = rptCalcActionCenter();
  const { expiring, overdue, dueSoon, newThisMonth, overdueTotal, dueSoonTotal } = data;

  // KPI cards
  const kpis = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px">
    ${rptKpiCardHTML({label:'สัญญาหมดใน 30 วัน', value:expiring.length, sub:expiring.length>0?'ต้องติดต่อต่อสัญญา':'—', color:'#dc2626', bg:'#fee2e2'})}
    ${rptKpiCardHTML({label:'บิลค้างเกินกำหนด', value:overdue.length, sub:overdueTotal>0?fmtBaht(overdueTotal)+' รวม':'—', color:'#d97706', bg:'#fef3c7'})}
    ${rptKpiCardHTML({label:'บิลครบกำหนด 7 วัน', value:dueSoon.length, sub:dueSoonTotal>0?fmtBaht(dueSoonTotal)+' รวม':'—', color:'#059669', bg:'#dcfce7'})}
    ${rptKpiCardHTML({label:'สัญญาใหม่เดือนนี้', value:newThisMonth.length, sub:'เริ่มต้นเดือนนี้', color:'#4f46e5', bg:'#eef2ff'})}
  </div>`;

  // If everything is empty → celebration state
  if(expiring.length===0 && overdue.length===0 && dueSoon.length===0){
    return `<div style="background:#fff;border-radius:14px;padding:48px;box-shadow:0 1px 3px rgba(0,0,0,.04);text-align:center">
      <div style="font-size:56px;margin-bottom:12px">🎉</div>
      <div style="font-size:18px;font-weight:700;color:#1e293b;margin-bottom:6px">ไม่มีงานค้าง — เยี่ยมมาก!</div>
      <div style="font-size:13px;color:#64748b">ไม่มีสัญญาใกล้หมด ไม่มีบิลค้าง ไม่มีบิลที่ต้องเร่งส่ง</div>
      ${kpis}
    </div>`;
  }

  // Section 1: expiring contracts
  const sec1Body = expiring.length===0
    ? rptEmptyStateHTML('✅','ไม่มีสัญญาที่หมดภายใน 30 วัน')
    : `<table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#fafbfc;color:#64748b;font-weight:600;text-align:left">
          <th style="padding:8px 12px">เลขสัญญา</th>
          <th style="padding:8px 12px">ผู้เช่า</th>
          <th style="padding:8px 12px">ทรัพย์</th>
          <th style="padding:8px 12px">วันหมด</th>
          <th style="padding:8px 12px;text-align:right">เหลือ (วัน)</th>
          <th style="padding:8px 12px;text-align:right">จัดการ</th>
        </tr></thead>
        <tbody>
          ${expiring.map(r=>{
            const urgencyColor = r.daysLeft<=7?'#dc2626':r.daysLeft<=14?'#d97706':'#059669';
            const phone = (r.c.phone||'').replace(/[^0-9+]/g,'');
            return `<tr style="border-top:1px solid #f1f5f9">
              <td style="padding:10px 12px;color:#1e293b;font-weight:600">${esc(r.c.no)||'-'}</td>
              <td style="padding:10px 12px;color:#475569">${esc(r.c.tenant)||'-'}</td>
              <td style="padding:10px 12px;color:#64748b">${esc(r.propName)}</td>
              <td style="padding:10px 12px;color:#64748b">${fmtBE(r.c.end)}</td>
              <td style="padding:10px 12px;text-align:right;font-weight:700;color:${urgencyColor}">${r.daysLeft}</td>
              <td style="padding:10px 12px;text-align:right;white-space:nowrap">
                <button onclick="renewContract(${r.c.id})" style="padding:4px 10px;background:#6366f1;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">ต่อ</button>
                <button onclick="viewContract(${r.c.id})" style="padding:4px 10px;background:#f1f5f9;color:#475569;border:none;border-radius:6px;font-size:11px;cursor:pointer;margin-left:4px">ดู</button>
                ${phone?`<a href="tel:${phone}" style="padding:4px 10px;background:#059669;color:#fff;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none;margin-left:4px;display:inline-block">📞</a>`:''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;

  // Section 2: overdue invoices (R2-H2: multi-select + bulk export)
  const _ovIds = overdue.map(r=>r.inv.id);
  [..._ovSel].forEach(id=>{if(!_ovIds.includes(id))_ovSel.delete(id);});
  const _ovAllChecked = _ovIds.length>0 && _ovIds.every(i=>_ovSel.has(i));
  const _ovSelN = _ovSel.size;
  const _ovBulkBar = _ovSelN>0
    ? `<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;margin-bottom:8px;font-size:12px">
        <span style="font-weight:700;color:#92400e">เลือกแล้ว ${_ovSelN} รายการ</span>
        <button onclick="exportOvSelected()" class="btn-sm" style="padding:6px 12px;background:#16a34a;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">📊 Export Excel ที่เลือก</button>
        <button onclick="clearOvSel()" class="btn-sm" style="padding:6px 12px;background:#f1f5f9;color:#475569;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">ล้างการเลือก</button>
      </div>`
    : '';
  const sec2Body = overdue.length===0
    ? rptEmptyStateHTML('✅','ไม่มีบิลค้างเกินกำหนด')
    : `${_ovBulkBar}<div style="max-height:480px;overflow-y:auto;border:1px solid #f1f5f9;border-radius:8px"><table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#fafbfc;color:#64748b;font-weight:600;text-align:left;position:sticky;top:0;z-index:1">
          <th style="padding:8px 12px;width:32px"><input type="checkbox" ${_ovAllChecked?'checked':''} onclick='toggleOvSelAll(${JSON.stringify(_ovIds)})' aria-label="เลือกทั้งหมด" style="cursor:pointer;width:16px;height:16px"></th>
          <th style="padding:8px 12px">เลขบิล</th>
          <th style="padding:8px 12px">ผู้เช่า</th>
          <th style="padding:8px 12px;text-align:right">ยอด</th>
          <th style="padding:8px 12px">วันครบกำหนด</th>
          <th style="padding:8px 12px;text-align:right">เกิน (วัน)</th>
          <th style="padding:8px 12px;text-align:right">จัดการ</th>
        </tr></thead>
        <tbody>
          ${overdue.map(r=>{
            const urgencyColor = r.days>=60?'#dc2626':r.days>=30?'#d97706':'#f59e0b';
            const _ck=_ovSel.has(r.inv.id)?'checked':'';
            const ctr2=(DB.contracts||[]).find(x=>x.id===r.inv.cid);
            const phone2=(ctr2&&ctr2.phone||'').replace(/[^0-9+]/g,'');
            return `<tr style="border-top:1px solid #f1f5f9${_ck?';background:#fffbeb':''}">
              <td style="padding:10px 12px"><input type="checkbox" ${_ck} onclick="toggleOvSel(${r.inv.id})" aria-label="เลือกบิล" style="cursor:pointer;width:16px;height:16px"></td>
              <td style="padding:10px 12px;color:#1e293b;font-weight:600">${esc(r.inv.invoiceNo||r.inv.no)||'-'}</td>
              <td style="padding:10px 12px;color:#475569">${esc(r.tenantName)}</td>
              <td style="padding:10px 12px;text-align:right;color:#1e293b;font-weight:600">${fmtBaht((Number(r.inv.total)||0))}</td>
              <td style="padding:10px 12px;color:#64748b">${fmtBE(r.inv.dueDate)}</td>
              <td style="padding:10px 12px;text-align:right;font-weight:700;color:${urgencyColor}">${r.days}</td>
              <td style="padding:10px 12px;text-align:right;white-space:nowrap">
                <button onclick="viewInvoiceDetail(${r.inv.id})" class="btn-sm" style="padding:4px 10px;background:#4f46e5;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">ดู</button>
                ${phone2?`<a href="tel:${phone2}" style="padding:4px 10px;background:#059669;color:#fff;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none;margin-left:4px;display:inline-block">📞</a>`:''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>`;

  // Section 3: due soon
  const sec3Body = dueSoon.length===0
    ? rptEmptyStateHTML('📭','ไม่มีบิลที่ครบกำหนดใน 7 วัน')
    : `<table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#fafbfc;color:#64748b;font-weight:600;text-align:left">
          <th style="padding:8px 12px">เลขบิล</th>
          <th style="padding:8px 12px">ผู้เช่า</th>
          <th style="padding:8px 12px;text-align:right">ยอด</th>
          <th style="padding:8px 12px">ครบกำหนด</th>
          <th style="padding:8px 12px;text-align:right">อีก (วัน)</th>
          <th style="padding:8px 12px;text-align:right">จัดการ</th>
        </tr></thead>
        <tbody>
          ${dueSoon.map(r=>{
            const ctr3=(DB.contracts||[]).find(x=>x.id===r.inv.cid);
            const phone3=(ctr3&&ctr3.phone||'').replace(/[^0-9+]/g,'');
            return `<tr style="border-top:1px solid #f1f5f9">
            <td style="padding:10px 12px;color:#1e293b;font-weight:600">${esc(r.inv.invoiceNo||r.inv.no)||'-'}</td>
            <td style="padding:10px 12px;color:#475569">${esc(r.inv.tenant)||'-'}</td>
            <td style="padding:10px 12px;text-align:right;color:#1e293b;font-weight:600">${fmtBaht((Number(r.inv.total)||0))}</td>
            <td style="padding:10px 12px;color:#64748b">${fmtBE(r.inv.dueDate)}</td>
            <td style="padding:10px 12px;text-align:right;font-weight:700;color:#059669">${r.daysUntil}</td>
            <td style="padding:10px 12px;text-align:right;white-space:nowrap">
              <button onclick="viewInvoiceDetail(${r.inv.id})" style="padding:4px 10px;background:#4f46e5;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">ดู</button>
              ${phone3?`<a href="tel:${phone3}" style="padding:4px 10px;background:#059669;color:#fff;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none;margin-left:4px;display:inline-block">📞</a>`:''}
            </td>
          </tr>`;}).join('')}
        </tbody>
      </table>`;

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div>
        <div style="font-size:18px;font-weight:800;color:#1e293b">📅 Action Center</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px">งานที่ต้องทำวันนี้ — อัปเดต ${fmtBE(new Date().getDate().toString().padStart(2,'0')+'/'+(new Date().getMonth()+1).toString().padStart(2,'0')+'/'+(new Date().getFullYear()+543))}</div>
      </div>
    </div>
    ${kpis}
    ${rptSectionHTML('🔴 สัญญาใกล้หมดใน 30 วัน', expiring.length, sec1Body, '#dc2626')}
    ${rptSectionHTML('🟡 บิลค้างเกินกำหนด', overdue.length, sec2Body, '#d97706')}
    ${rptSectionHTML('🟢 บิลครบกำหนดใน 7 วัน', dueSoon.length, sec3Body, '#059669')}
  `;
}

// ============================================================
// Report 4: Contract Expiry Forecast (P0)
// ============================================================
function rptCalcExpiry(){
  const range = Number(rptFilters.expiryRange) || 90;
  const propFilter = rptFilters.propertyId || 'all';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const horizon = new Date(today); horizon.setDate(horizon.getDate()+range);

  const rows = (DB.contracts||[]).filter(c=>{
    if(c.cancelled) return false;
    if(propFilter!=='all' && c.pid!==propFilter) return false;
    const e = parseBE(c.end);
    if(!e) return false; // open-ended → exclude
    return e >= today && e <= horizon;
  }).map(c=>{
    const e = parseBE(c.end);
    const daysLeft = Math.ceil((e - today)/864e5);
    const p = (DB.properties||[]).find(x=>x.pid===c.pid);
    const monthly = (typeof monthlyRev==='function') ? (monthlyRev(c)||0) : 0;
    let bucket = '90';
    if(daysLeft<=30) bucket='30';
    else if(daysLeft<=60) bucket='60';
    return { c, daysLeft, propName: p?p.name:(c.property||'-'), monthly, bucket };
  }).sort((a,b)=>a.daysLeft-b.daysLeft);

  const in30 = rows.filter(r=>r.daysLeft<=30);
  const in60 = rows.filter(r=>r.daysLeft<=60);
  const in90 = rows.filter(r=>r.daysLeft<=90);
  const lostRevenue = rows.reduce((s,r)=>s + (r.monthly||0), 0);

  // Weekly bucket: next 12 weeks (count contracts whose end falls in each week)
  const weeks = [];
  for(let i=0;i<12;i++){
    const wStart = new Date(today); wStart.setDate(wStart.getDate()+i*7);
    const wEnd   = new Date(today); wEnd.setDate(wEnd.getDate()+(i+1)*7-1);
    const cnt = rows.filter(r=>{
      const e = parseBE(r.c.end);
      return e>=wStart && e<=wEnd;
    }).length;
    weeks.push({ label:`W${i+1}`, count:cnt });
  }

  return { rows, in30:in30.length, in30Sum:in30.reduce((s,r)=>s+r.monthly,0),
           in60:in60.length, in90:in90.length, lostRevenue, weeks, range };
}

function rptExpiryHTML(){
  const data = rptCalcExpiry();
  const { rows, in30, in30Sum, in60, in90, lostRevenue, range } = data;
  const properties = (DB.properties||[]);

  // Range toggle
  const ranges = [30, 60, 90, 180, 365];
  const rangeBtns = ranges.map(n=>{
    const active = n===Number(range);
    return `<button onclick="rptSetFilter('expiryRange',${n})" style="
      padding:6px 14px;border-radius:8px;border:none;cursor:pointer;font-family:Sarabun;font-size:12px;font-weight:600;
      background:${active?'#4f46e5':'#f1f5f9'};color:${active?'#fff':'#475569'}">${n} วัน</button>`;
  }).join('');

  // Property filter
  const propOpts = `<option value="all">ทุกทรัพย์</option>` +
    properties.map(p=>`<option value="${esc(p.pid)}" ${rptFilters.propertyId===p.pid?'selected':''}>${esc(p.name||p.pid)}</option>`).join('');
  const propSelect = `<select onchange="rptSetFilter('propertyId',this.value)" style="
    padding:6px 10px;border:1px solid #e2e8f0;border-radius:8px;font-family:Sarabun;font-size:12px;background:#fff;color:#475569">
    ${propOpts}</select>`;

  const kpis = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px">
    ${rptKpiCardHTML({label:'หมดใน 30 วัน', value:in30, sub:in30Sum>0?fmtBaht(in30Sum)+'/เดือน':'—', color:'#dc2626'})}
    ${rptKpiCardHTML({label:'หมดใน 60 วัน', value:in60, sub:'รวมสะสม', color:'#d97706'})}
    ${rptKpiCardHTML({label:'หมดใน 90 วัน', value:in90, sub:'รวมสะสม', color:'#059669'})}
    ${rptKpiCardHTML({label:'รายได้เสี่ยงหาย', value:fmtBaht(lostRevenue), sub:'ถ้าไม่ต่อสัญญาทั้งหมด', color:'#4f46e5'})}
  </div>`;

  // Charts
  const chartsBlock = rows.length===0
    ? rptEmptyStateHTML('🎉','ไม่มีสัญญาที่จะหมดในช่วงนี้')
    : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
          <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:8px">📊 Timeline สัญญาใกล้หมด</div>
          <div style="max-height:360px;overflow-y:auto"><canvas id="rptExpiryTimeline" height="${Math.max(120, rows.length*22)}"></canvas></div>
        </div>
        <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
          <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:8px">📅 จำนวนสัญญาที่หมด (12 สัปดาห์ข้างหน้า)</div>
          <div style="height:280px"><canvas id="rptExpiryWeekly"></canvas></div>
        </div>
      </div>`;

  const tableBody = rows.length===0
    ? rptEmptyStateHTML('✅','ไม่มีสัญญา')
    : `<table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#fafbfc;color:#64748b;font-weight:600;text-align:left">
          <th style="padding:8px 12px">เลขสัญญา</th>
          <th style="padding:8px 12px">ผู้เช่า</th>
          <th style="padding:8px 12px">ทรัพย์</th>
          <th style="padding:8px 12px">วันหมด</th>
          <th style="padding:8px 12px;text-align:right">เหลือ (วัน)</th>
          <th style="padding:8px 12px;text-align:right">ค่าเช่า/เดือน</th>
          <th style="padding:8px 12px;text-align:right">จัดการ</th>
        </tr></thead>
        <tbody>
          ${rows.map(r=>{
            const color = r.daysLeft<=30?'#dc2626':r.daysLeft<=60?'#d97706':'#059669';
            const phone = (r.c.phone||'').replace(/[^0-9+]/g,'');
            return `<tr style="border-top:1px solid #f1f5f9">
              <td style="padding:10px 12px;color:#1e293b;font-weight:600">${esc(r.c.no)||'-'}</td>
              <td style="padding:10px 12px;color:#475569">${esc(r.c.tenant)||'-'}</td>
              <td style="padding:10px 12px;color:#64748b">${esc(r.propName)}</td>
              <td style="padding:10px 12px;color:#64748b">${fmtBE(r.c.end)}</td>
              <td style="padding:10px 12px;text-align:right;font-weight:700;color:${color}">${r.daysLeft}</td>
              <td style="padding:10px 12px;text-align:right;color:#1e293b">${fmtBaht((r.monthly||0))}</td>
              <td style="padding:10px 12px;text-align:right;white-space:nowrap">
                <button onclick="renewContract(${r.c.id})" style="padding:4px 10px;background:#6366f1;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">ต่อ</button>
                <button onclick="viewContract(${r.c.id})" style="padding:4px 10px;background:#f1f5f9;color:#475569;border:none;border-radius:6px;font-size:11px;cursor:pointer;margin-left:4px">ดู</button>
                ${phone?`<a href="tel:${phone}" style="padding:4px 10px;background:#059669;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;text-decoration:none;margin-left:4px;display:inline-block">📞</a>`:''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:18px;font-weight:800;color:#1e293b">📆 สัญญาใกล้หมด — Forecast</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px">ช่วง ${range} วันข้างหน้า — ${rows.length} สัญญา</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        ${propSelect}
        <div style="display:flex;gap:4px;background:#f8fafc;padding:4px;border-radius:10px">${rangeBtns}</div>
      </div>
    </div>
    ${kpis}
    ${chartsBlock}
    ${rptSectionHTML('📋 รายการสัญญา', rows.length, tableBody, '#4f46e5')}
  `;
}

function rptExpiryInitCharts(){
  if(typeof Chart === 'undefined') return;
  const data = rptCalcExpiry();
  const { rows, weeks } = data;
  if(rows.length===0) return;

  // Timeline (horizontal bar): 1 bar per contract, length = daysLeft
  const colors = rows.map(r=> r.daysLeft<=30?'#dc2626':r.daysLeft<=60?'#d97706':'#059669');
  rptChart('rptExpiryTimeline', {
    type:'bar',
    data:{
      labels: rows.map(r=> (r.c.no||'-') + ' · ' + (r.c.tenant||'-').slice(0,18)),
      datasets:[{ label:'เหลือ (วัน)', data: rows.map(r=>r.daysLeft), backgroundColor: colors, borderRadius:4 }]
    },
    options:{
      indexAxis:'y',
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      scales:{ x:{ beginAtZero:true, title:{ display:true, text:'วันที่เหลือ' } }, y:{ ticks:{ font:{ size:10 } } } }
    }
  });

  // Weekly bar
  rptChart('rptExpiryWeekly', {
    type:'bar',
    data:{
      labels: weeks.map(w=>w.label),
      datasets:[{ label:'จำนวนสัญญา', data: weeks.map(w=>w.count), backgroundColor:'#6366f1', borderRadius:4 }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1 } } }
    }
  });
}

// ============================================================
// Shared utilities (date / format / export)
// ============================================================
function rptStartOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function rptEndOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59); }
function rptMonthLabel(d){
  const m = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return m[d.getMonth()] + ' ' + ((d.getFullYear()+543)%100);
}
function rptInvPaidAmount(inv){
  if(inv.paidAmount!=null) return Number(inv.paidAmount)||0;
  if(inv.status==='paid') return Number(inv.total)||0;
  return 0;
}
function rptInvOutstanding(inv){
  if(inv.status==='voided') return 0;
  if(inv.remainingAmount!=null) return Number(inv.remainingAmount)||0;
  if(inv.status==='paid') return 0;
  return Number(inv.total)||0;
}
function rptInvIssuedDate(inv){
  // Use dueDate as proxy for issued month (no separate issueDate field stored)
  return parseBE(inv.dueDate);
}
function rptInvPaidDate(inv){
  if(inv.paidAt) return new Date(inv.paidAt);
  if(inv.status==='paid') return parseBE(inv.dueDate); // fallback
  return null;
}
function rptFmtComparison(cur, prev){
  if(prev===0 || prev==null){
    return cur>0 ? '<span style="color:#059669">↑ ใหม่</span>' : '—';
  }
  const pct = ((cur-prev)/Math.abs(prev))*100;
  const arrow = pct>=0 ? '↑' : '↓';
  const color = pct>=0 ? '#059669' : '#dc2626';
  return `<span style="color:${color}">${arrow} ${Math.abs(pct).toFixed(1)}%</span>`;
}

// ----- Excel export (uses SheetJS already loaded by 05-excel.js) -----
function rptExportExcel(reportId){
  if(typeof XLSX === 'undefined'){ toast('SheetJS ยังไม่โหลด','error'); return; }
  const wb = XLSX.utils.book_new();
  const ymd = new Date().toISOString().slice(0,10).replace(/-/g,'');
  let fname = 'รายงาน_' + reportId + '_' + ymd + '.xlsx';

  try {
    if(reportId==='revenue'){
      const d = rptCalcRevenue();
      const summary = [
        { 'KPI':'รายได้จริง (paid)', 'ยอด': d.paidThis },
        { 'KPI':'บิลที่ออก', 'ยอด': d.issuedThis },
        { 'KPI':'ค้างรับ', 'ยอด': d.outstanding },
        { 'KPI':'Collection rate %', 'ยอด': d.collectionRate.toFixed(1) },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
      const byProp = d.byProperty.map(x=>({ 'ทรัพย์':x.name, 'รายได้':x.paid, 'บิลที่ออก':x.issued, 'ค้างรับ':x.outstanding }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(byProp), 'By Property');
    }
    else if(reportId==='occupancy'){
      const d = rptCalcOccupancy();
      const rows = d.rows.map(r=>({ 'ทรัพย์':r.name, 'สถานะ':r.statusLabel, 'ผู้เช่า':r.tenant||'-', 'สัญญาหมด':r.endBE||'-' }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Occupancy');
    }
    else if(reportId==='expiry'){
      const d = rptCalcExpiry();
      const rows = d.rows.map(r=>({ 'เลขสัญญา':r.c.no||'-', 'ผู้เช่า':r.c.tenant||'-', 'ทรัพย์':r.propName, 'วันหมด':fmtBE(r.c.end), 'เหลือ(วัน)':r.daysLeft, 'ค่าเช่า/เดือน':r.monthly }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Expiry');
    }
    else if(reportId==='arrears'){
      const d = rptCalcArrears();
      const summary = [
        { 'Bucket':'1-30 วัน', 'ยอดค้าง':d.b30, 'จำนวน':d.b30Count },
        { 'Bucket':'31-60 วัน', 'ยอดค้าง':d.b60, 'จำนวน':d.b60Count },
        { 'Bucket':'61-90 วัน', 'ยอดค้าง':d.b90, 'จำนวน':d.b90Count },
        { 'Bucket':'90+ วัน', 'ยอดค้าง':d.b90plus, 'จำนวน':d.b90plusCount },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
      const detail = d.rows.map(r=>({ 'ผู้เช่า':r.tenant, 'ทรัพย์':r.propName, 'เลขบิล':r.invNo, 'ยอดค้าง':r.amount, 'วันครบกำหนด':fmtBE(r.inv.dueDate), 'อายุหนี้':r.daysOverdue, 'Bucket':r.bucket }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), 'Detail');
    }
    else if(reportId==='property'){
      const d = rptCalcPropertyPerf();
      const rows = d.rows.map(r=>({ 'อันดับ':r.rank, 'ทรัพย์':r.name, 'รายได้':r.revenue, '%Occupancy':r.occupancyPct.toFixed(1), 'ค่าเช่าเฉลี่ย':r.avgRent, 'จำนวนผู้เช่า':r.tenantCount }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Performance');
    }
    else if(reportId==='renewal'){
      const d = rptCalcRenewal();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.renewed.map(r=>({ 'ผู้เช่า':r.old.tenant, 'ทรัพย์':r.propName, 'หมดเก่า':fmtBE(r.old.end), 'เริ่มใหม่':fmtBE(r.next.start), 'Gap วัน':r.gap }))), 'Renewed');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.lost.map(r=>({ 'ผู้เช่า':r.c.tenant, 'ทรัพย์':r.propName, 'วันหมด':fmtBE(r.c.end) }))), 'Lost');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.pending.map(r=>({ 'ผู้เช่า':r.c.tenant, 'ทรัพย์':r.propName, 'วันหมด':fmtBE(r.c.end) }))), 'Pending');
    }
    else if(reportId==='action'){
      const d = rptCalcActionCenter();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.expiring.map(r=>({ 'สัญญา':r.c.no, 'ผู้เช่า':r.c.tenant, 'ทรัพย์':r.propName, 'วันหมด':fmtBE(r.c.end), 'เหลือ':r.daysLeft }))), 'สัญญาใกล้หมด');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.overdue.map(r=>({ 'เลขบิล':r.inv.invoiceNo||r.inv.no, 'ผู้เช่า':r.tenantName, 'ยอด':r.inv.total, 'เกิน':r.days }))), 'บิลค้าง');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(d.dueSoon.map(r=>({ 'เลขบิล':r.inv.invoiceNo||r.inv.no, 'ผู้เช่า':r.inv.tenant, 'ยอด':r.inv.total, 'ครบกำหนด':fmtBE(r.inv.dueDate) }))), 'ครบกำหนด 7 วัน');
    }
    else { toast('ไม่รองรับ export รายงานนี้','warning'); return; }

    if(wb.SheetNames.length===0){ toast('ไม่มีข้อมูลให้ export','warning'); return; }
    XLSX.writeFile(wb, fname);
    toast('Export Excel สำเร็จ','success');
  } catch(e){
    console.error(e);
    toast('Export ล้มเหลว: '+e.message,'error');
  }
}

// ----- PDF export (browser print — reuse pattern from 17-contract-print.js) -----
function rptExportPDF(reportId){
  // Find the report body in the DOM
  const body = document.querySelector('.rpt-body');
  if(!body){ toast('ไม่พบเนื้อหารายงาน','error'); return; }
  const w = window.open('', '_blank');
  if(!w){ toast('โปรดอนุญาต popup','error'); return; }
  w.document.write(`
    <html><head><meta charset="utf-8"><title>รายงาน ${reportId}</title>
    <style>
      body{font-family:Sarabun,sans-serif;padding:24px;color:#1e293b}
      h1{font-size:18px;margin-bottom:8px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:left}
      canvas{display:none}
      button{display:none}
      @page{size:A4 landscape;margin:15mm}
    </style>
    </head><body>
      <h1>📊 รายงาน — ${reportId}</h1>
      <div style="font-size:11px;color:#64748b;margin-bottom:12px">พิมพ์เมื่อ ${new Date().toLocaleString('th-TH')}</div>
      ${body.innerHTML}
      <script>setTimeout(function(){window.print();},300);<\/script>
    </body></html>
  `);
  w.document.close();
}

function rptExportBarHTML(reportId){
  return `<div style="display:flex;gap:6px;margin-left:auto">
    <button onclick="rptExportExcel('${reportId}')" style="padding:6px 12px;border:1px solid #16a34a;background:#fff;color:#16a34a;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer">📥 Excel</button>
    <button onclick="rptExportPDF('${reportId}')" style="padding:6px 12px;border:1px solid #4f46e5;background:#fff;color:#4f46e5;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer">📄 PDF</button>
  </div>`;
}

// ============================================================
// Report 2: Revenue (P0) — admin only
// ============================================================
function rptCalcRevenue(){
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = rptStartOfMonth(today);
  const monthEnd = rptEndOfMonth(today);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth()-1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23,59,59);
  const yearAgoStart = new Date(today.getFullYear()-1, today.getMonth(), 1);
  const yearAgoEnd = new Date(today.getFullYear()-1, today.getMonth()+1, 0, 23,59,59);

  const invoices = (DB.invoices||[]).filter(i=>i.status!=='voided');

  const sumPaidIn = (s,e)=> invoices.reduce((acc,inv)=>{
    const pd = rptInvPaidDate(inv);
    if(!pd || pd<s || pd>e) return acc;
    return acc + rptInvPaidAmount(inv);
  },0);
  const sumIssuedIn = (s,e)=> invoices.reduce((acc,inv)=>{
    const id = rptInvIssuedDate(inv);
    if(!id || id<s || id>e) return acc;
    return acc + (Number(inv.total)||0);
  },0);

  const paidThis = sumPaidIn(monthStart, monthEnd);
  const paidLast = sumPaidIn(lastMonthStart, lastMonthEnd);
  const paidYearAgo = sumPaidIn(yearAgoStart, yearAgoEnd);
  const issuedThis = sumIssuedIn(monthStart, monthEnd);
  const issuedLast = sumIssuedIn(lastMonthStart, lastMonthEnd);
  const outstanding = invoices.reduce((s,inv)=>{
    const d = parseBE(inv.dueDate);
    if(!d || d>=today) return s;
    return s + rptInvOutstanding(inv);
  },0);
  const collectionRate = issuedThis>0 ? (paidThis/issuedThis)*100 : 0;

  // 12-month series
  const months = [];
  for(let i=11;i>=0;i--){
    const ms = new Date(today.getFullYear(), today.getMonth()-i, 1);
    const me = new Date(today.getFullYear(), today.getMonth()-i+1, 0, 23,59,59);
    const ms2 = new Date(today.getFullYear()-1, today.getMonth()-i, 1);
    const me2 = new Date(today.getFullYear()-1, today.getMonth()-i+1, 0, 23,59,59);
    months.push({ label: rptMonthLabel(ms), thisYear: sumPaidIn(ms,me), lastYear: sumPaidIn(ms2,me2) });
  }

  // Revenue by property (current month)
  const propMap = {};
  invoices.forEach(inv=>{
    const pd = rptInvPaidDate(inv);
    if(!pd || pd<monthStart || pd>monthEnd) return;
    const c = (DB.contracts||[]).find(x=>x.id===inv.cid);
    const pid = c?c.pid:(inv.pid||'unknown');
    const p = (DB.properties||[]).find(x=>x.pid===pid);
    const name = p?p.name:(inv.property||'ไม่ระบุ');
    if(!propMap[name]) propMap[name] = { name, paid:0, issued:0, outstanding:0 };
    propMap[name].paid += rptInvPaidAmount(inv);
  });
  invoices.forEach(inv=>{
    const id = rptInvIssuedDate(inv);
    const c = (DB.contracts||[]).find(x=>x.id===inv.cid);
    const pid = c?c.pid:(inv.pid||'unknown');
    const p = (DB.properties||[]).find(x=>x.pid===pid);
    const name = p?p.name:(inv.property||'ไม่ระบุ');
    if(!propMap[name]) propMap[name] = { name, paid:0, issued:0, outstanding:0 };
    if(id && id>=monthStart && id<=monthEnd) propMap[name].issued += Number(inv.total)||0;
    const d = parseBE(inv.dueDate);
    if(d && d<today) propMap[name].outstanding += rptInvOutstanding(inv);
  });
  const byProperty = Object.values(propMap).sort((a,b)=>b.paid-a.paid);

  return { paidThis, paidLast, paidYearAgo, issuedThis, issuedLast, outstanding, collectionRate, months, byProperty };
}

function rptRevenueHTML(){
  if(!hasPermission || !hasPermission('view_report_revenue')) return rptNoAccessHTML();
  const d = rptCalcRevenue();
  const kpis = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px">
    ${rptKpiCardHTML({label:'รายได้จริง (เดือนนี้)', value:fmtBaht(d.paidThis), sub:'MoM '+rptFmtComparison(d.paidThis,d.paidLast)+' · YoY '+rptFmtComparison(d.paidThis,d.paidYearAgo), color:'#059669'})}
    ${rptKpiCardHTML({label:'บิลที่ออก', value:fmtBaht(d.issuedThis), sub:'MoM '+rptFmtComparison(d.issuedThis,d.issuedLast), color:'#4f46e5'})}
    ${rptKpiCardHTML({label:'ค้างรับสะสม', value:fmtBaht(d.outstanding), sub:'รวมบิลค้างทั้งหมด', color:'#dc2626'})}
    ${rptKpiCardHTML({label:'Collection rate', value:d.collectionRate.toFixed(1)+'%', sub:'paid / issued', color:'#d97706'})}
  </div>`;

  const charts = `<div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-bottom:12px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
      <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:8px">📈 รายได้ 12 เดือนย้อนหลัง</div>
      <div style="height:280px"><canvas id="rptRevLine"></canvas></div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
      <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:8px">🥧 รายได้แยกตามทรัพย์ (เดือนนี้)</div>
      <div style="height:280px"><canvas id="rptRevDonut"></canvas></div>
    </div>
  </div>`;

  const tableBody = d.byProperty.length===0
    ? rptEmptyStateHTML('📭','ยังไม่มีรายได้เดือนนี้')
    : `<table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#fafbfc;color:#64748b;font-weight:600;text-align:left">
          <th style="padding:8px 12px">ทรัพย์</th>
          <th style="padding:8px 12px;text-align:right">รายได้</th>
          <th style="padding:8px 12px;text-align:right">บิลที่ออก</th>
          <th style="padding:8px 12px;text-align:right">ค้างรับ</th>
          <th style="padding:8px 12px;text-align:right">% collection</th>
        </tr></thead>
        <tbody>${d.byProperty.map(r=>{
          const cr = r.issued>0?((r.paid/r.issued)*100):0;
          return `<tr style="border-top:1px solid #f1f5f9">
            <td style="padding:10px 12px;color:#1e293b;font-weight:600">${esc(r.name)}</td>
            <td style="padding:10px 12px;text-align:right;color:#059669;font-weight:700">${fmtBaht(r.paid)}</td>
            <td style="padding:10px 12px;text-align:right;color:#475569">${fmtBaht(r.issued)}</td>
            <td style="padding:10px 12px;text-align:right;color:#dc2626">${fmtBaht(r.outstanding)}</td>
            <td style="padding:10px 12px;text-align:right;color:#1e293b">${cr.toFixed(1)}%</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:18px;font-weight:800;color:#1e293b">💰 Revenue Report</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px">เดือนปัจจุบัน + เปรียบเทียบ MoM/YoY</div>
      </div>
      ${rptExportBarHTML('revenue')}
    </div>
    ${kpis}
    ${charts}
    ${rptSectionHTML('🏢 Revenue by Property', d.byProperty.length, tableBody, '#059669')}
  `;
}

function rptRevenueInitCharts(){
  if(typeof Chart==='undefined') return;
  const d = rptCalcRevenue();
  rptChart('rptRevLine', {
    type:'line',
    data:{ labels:d.months.map(m=>m.label),
      datasets:[
        { label:'ปีนี้', data:d.months.map(m=>m.thisYear), borderColor:'#4f46e5', backgroundColor:'rgba(79,70,229,.1)', tension:.3, fill:true },
        { label:'ปีก่อน', data:d.months.map(m=>m.lastYear), borderColor:'#64748b', borderDash:[6,4], tension:.3, fill:false },
      ]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ position:'bottom' } },
      scales:{ y:{ beginAtZero:true, ticks:{ callback:v=>fmtBaht(v) } } } }
  });
  const top = d.byProperty.slice(0,5);
  const others = d.byProperty.slice(5).reduce((s,x)=>s+x.paid,0);
  const labels = top.map(x=>x.name).concat(others>0?['อื่นๆ']:[]);
  const values = top.map(x=>x.paid).concat(others>0?[others]:[]);
  rptChart('rptRevDonut', {
    type:'doughnut',
    data:{ labels, datasets:[{ data:values, backgroundColor:['#4f46e5','#059669','#d97706','#dc2626','#0ea5e9','#64748b'] }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ font:{ size:10 } } } } }
  });
}

// ============================================================
// Report 3: Occupancy (P0)
// ============================================================
function rptCalcOccupancy(){
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const in90 = new Date(today); in90.setDate(in90.getDate()+90);
  const properties = DB.properties||[];
  const contracts = (DB.contracts||[]).filter(c=>!c.cancelled);

  const rows = properties.map(p=>{
    const active = contracts.find(c=>{
      const s = parseBE(c.start), e = parseBE(c.end);
      if(!s) return false;
      if(e && (e<today)) return false;
      return s<=today;
    });
    let st = 'vacant', stLabel = 'ว่าง', tenant=null, end=null, willVacant=false;
    if(active){
      st = 'occupied'; stLabel = 'เช่าอยู่'; tenant = active.tenant;
      end = active.end;
      const e = parseBE(active.end);
      if(e && e<=in90){ willVacant = true; stLabel = 'จะว่างใน 90 วัน'; st='will-vacant'; }
    }
    return { p, name:p.name||p.pid, status:st, statusLabel:stLabel, tenant, endBE: end?fmtBE(end):null, willVacant };
  });

  const total = rows.length;
  const occupied = rows.filter(r=>r.status==='occupied').length;
  const willVacant = rows.filter(r=>r.status==='will-vacant').length;
  const vacant = rows.filter(r=>r.status==='vacant').length;
  const occRate = total>0 ? ((occupied+willVacant)/total*100) : 0;

  // 12-month trend (snapshot end of each month)
  const trend = [];
  for(let i=11;i>=0;i--){
    const ms = new Date(today.getFullYear(), today.getMonth()-i+1, 0); // last day of month
    let occ=0;
    properties.forEach(p=>{
      const has = contracts.some(c=>{
        if(c.pid!==p.pid) return false;
        const s = parseBE(c.start), e = parseBE(c.end);
        if(!s || s>ms) return false;
        if(e && e<ms) return false;
        return true;
      });
      if(has) occ++;
    });
    trend.push({ label: rptMonthLabel(ms), occ, total });
  }

  return { rows, total, occupied, vacant, willVacant, occRate, trend };
}

function rptOccupancyHTML(){
  const d = rptCalcOccupancy();
  const kpis = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px">
    ${rptKpiCardHTML({label:'Total units', value:d.total, color:'#4f46e5'})}
    ${rptKpiCardHTML({label:'Occupied', value:d.occupied, sub:d.total>0?(d.occupied/d.total*100).toFixed(1)+'%':'0%', color:'#059669'})}
    ${rptKpiCardHTML({label:'Vacant', value:d.vacant, sub:d.total>0?(d.vacant/d.total*100).toFixed(1)+'%':'0%', color:'#dc2626'})}
    ${rptKpiCardHTML({label:'Will be vacant 90d', value:d.willVacant, sub:'สัญญาจะหมด', color:'#d97706'})}
  </div>`;

  const charts = `<div style="display:grid;grid-template-columns:1fr 2fr;gap:12px;margin-bottom:12px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
      <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:8px">🥧 สถานะปัจจุบัน</div>
      <div style="height:240px"><canvas id="rptOccDonut"></canvas></div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
      <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:8px">📊 Occupancy 12 เดือน</div>
      <div style="height:240px"><canvas id="rptOccTrend"></canvas></div>
    </div>
  </div>`;

  // Sort: vacant first (action needed), then will-vacant, then occupied
  const sortOrder = {vacant:0, 'will-vacant':1, occupied:2};
  const rowsSorted = d.rows.slice().sort((a,b)=>(sortOrder[a.status]||9)-(sortOrder[b.status]||9));
  const tableBody = rowsSorted.length===0
    ? rptEmptyStateHTML('📭','ยังไม่มีทรัพย์ในระบบ')
    : `<table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#fafbfc;color:#64748b;font-weight:600;text-align:left">
          <th style="padding:8px 12px">ทรัพย์</th>
          <th style="padding:8px 12px">สถานะ</th>
          <th style="padding:8px 12px">ผู้เช่าปัจจุบัน</th>
          <th style="padding:8px 12px">สัญญาหมด</th>
          <th style="padding:8px 12px;text-align:right">จัดการ</th>
        </tr></thead>
        <tbody>${rowsSorted.map(r=>{
          const c = r.status==='occupied'?'#059669':r.status==='will-vacant'?'#d97706':'#dc2626';
          const bg = r.status==='vacant'?'background:#fef2f2;':'';
          return `<tr style="border-top:1px solid #f1f5f9;${bg}">
            <td style="padding:10px 12px;color:#1e293b;font-weight:600">${esc(r.name)}</td>
            <td style="padding:10px 12px"><span style="color:${c};font-weight:700">${r.statusLabel}</span></td>
            <td style="padding:10px 12px;color:#475569">${esc(r.tenant)||'-'}</td>
            <td style="padding:10px 12px;color:#64748b">${r.endBE||'-'}</td>
            <td style="padding:10px 12px;text-align:right">
              <button onclick="openPropertyDetail('${esc(r.p.pid)}')" style="padding:4px 10px;background:#4f46e5;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">ดูทรัพย์</button>
            </td>
          </tr>`;
        }).join('')}</tbody></table>`;

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:18px;font-weight:800;color:#1e293b">🏠 Occupancy Report</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px">${d.occRate.toFixed(1)}% occupancy ณ วันนี้</div>
      </div>
      ${rptExportBarHTML('occupancy')}
    </div>
    ${kpis}
    ${charts}
    ${rptSectionHTML('📋 รายการทรัพย์', d.rows.length, tableBody, '#4f46e5')}
  `;
}

function rptOccupancyInitCharts(){
  if(typeof Chart==='undefined') return;
  const d = rptCalcOccupancy();
  rptChart('rptOccDonut', {
    type:'doughnut',
    data:{ labels:['Occupied','Vacant','Will vacant 90d'],
      datasets:[{ data:[d.occupied, d.vacant, d.willVacant], backgroundColor:['#059669','#dc2626','#d97706'] }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } }
  });
  rptChart('rptOccTrend', {
    type:'bar',
    data:{ labels:d.trend.map(x=>x.label), datasets:[{ label:'Occupied units', data:d.trend.map(x=>x.occ), backgroundColor:'#4f46e5', borderRadius:4 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ stepSize:1 } } } }
  });
}

// ============================================================
// Report 5: Arrears Aging (P0)
// ============================================================
function rptCalcArrears(){
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const propFilter = rptFilters.propertyId || 'all';
  const bucketFilter = rptFilters.bucket || 'all';

  const overdue = (DB.invoices||[]).filter(inv=>{
    if(inv.status==='paid' || inv.status==='voided') return false;
    const due = parseBE(inv.dueDate);
    if(!due || due>=today) return false;
    return rptInvOutstanding(inv) > 0;
  }).map(inv=>{
    const due = parseBE(inv.dueDate);
    const daysOverdue = Math.floor((today-due)/864e5);
    let bucket='1-30';
    if(daysOverdue>90) bucket='90+';
    else if(daysOverdue>60) bucket='61-90';
    else if(daysOverdue>30) bucket='31-60';
    const c = (DB.contracts||[]).find(x=>x.id===inv.cid);
    const pid = c?c.pid:inv.pid;
    const p = (DB.properties||[]).find(x=>x.pid===pid);
    return {
      inv, daysOverdue, bucket,
      tenant: inv.tenant || (c?c.tenant:'-'),
      propName: p?p.name:(inv.property||'-'),
      pid: pid||'unknown',
      invNo: inv.invoiceNo||inv.no||'-',
      amount: rptInvOutstanding(inv),
    };
  });

  const filtered = overdue.filter(r=>{
    if(propFilter!=='all' && r.pid!==propFilter) return false;
    if(bucketFilter!=='all' && r.bucket!==bucketFilter) return false;
    return true;
  }).sort((a,b)=>b.daysOverdue-a.daysOverdue);

  const totalAmount = filtered.reduce((s,r)=>s+r.amount,0);
  const b30 = filtered.filter(r=>r.bucket==='1-30').reduce((s,r)=>s+r.amount,0);
  const b30Count = filtered.filter(r=>r.bucket==='1-30').length;
  const b60 = filtered.filter(r=>r.bucket==='31-60').reduce((s,r)=>s+r.amount,0);
  const b60Count = filtered.filter(r=>r.bucket==='31-60').length;
  const b90 = filtered.filter(r=>r.bucket==='61-90').reduce((s,r)=>s+r.amount,0);
  const b90Count = filtered.filter(r=>r.bucket==='61-90').length;
  const b90plus = filtered.filter(r=>r.bucket==='90+').reduce((s,r)=>s+r.amount,0);
  const b90plusCount = filtered.filter(r=>r.bucket==='90+').length;

  // Stacked by property
  const propMap = {};
  filtered.forEach(r=>{
    if(!propMap[r.propName]) propMap[r.propName] = { name:r.propName, '1-30':0, '31-60':0, '61-90':0, '90+':0 };
    propMap[r.propName][r.bucket] += r.amount;
  });
  const byProp = Object.values(propMap);

  // 6-month trend (snapshot at month end)
  const trend = [];
  for(let i=5;i>=0;i--){
    const snap = new Date(today.getFullYear(), today.getMonth()-i+1, 0);
    let total=0;
    (DB.invoices||[]).forEach(inv=>{
      if(inv.status==='voided') return;
      const due = parseBE(inv.dueDate);
      if(!due || due>=snap) return;
      // approximate: was unpaid as of snap if paidAt > snap or no paidAt
      const pd = inv.paidAt ? new Date(inv.paidAt) : null;
      if(pd && pd<=snap) return;
      total += Number(inv.total)||0;
    });
    trend.push({ label: rptMonthLabel(snap), total });
  }

  return { rows:filtered, totalAmount, b30, b30Count, b60, b60Count, b90, b90Count, b90plus, b90plusCount, byProp, trend };
}

function rptArrearsHTML(){
  const d = rptCalcArrears();
  const properties = DB.properties||[];
  const propOpts = `<option value="all">ทุกทรัพย์</option>` +
    properties.map(p=>`<option value="${esc(p.pid)}" ${rptFilters.propertyId===p.pid?'selected':''}>${esc(p.name||p.pid)}</option>`).join('');
  const bucketOpts = ['all','1-30','31-60','61-90','90+'].map(b=>
    `<option value="${b}" ${rptFilters.bucket===b?'selected':''}>${b==='all'?'ทุก bucket':b+' วัน'}</option>`).join('');

  const filters = `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
    <select onchange="rptSetFilter('propertyId',this.value)" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:8px;font-family:Sarabun;font-size:12px;background:#fff">${propOpts}</select>
    <select onchange="rptSetFilter('bucket',this.value)" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:8px;font-family:Sarabun;font-size:12px;background:#fff">${bucketOpts}</select>
  </div>`;

  const kpis = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px">
    ${rptKpiCardHTML({label:'ค้างรวมทั้งหมด', value:fmtBaht(d.totalAmount), sub:d.rows.length+' บิล', color:'#4f46e5'})}
    ${rptKpiCardHTML({label:'90+ วัน (critical)', value:fmtBaht(d.b90plus), sub:d.b90plusCount+' บิล', color:'#dc2626'})}
    ${rptKpiCardHTML({label:'31-90 วัน', value:fmtBaht(d.b60+d.b90), sub:(d.b60Count+d.b90Count)+' บิล', color:'#d97706'})}
    ${rptKpiCardHTML({label:'1-30 วัน', value:fmtBaht(d.b30), sub:d.b30Count+' บิล', color:'#059669'})}
  </div>`;

  if(d.rows.length===0){
    const draftCount=(DB.invoices||[]).filter(i=>i.status==='draft'&&i.category!=='deposit').length;
    const draftCTA=draftCount>0
      ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px;margin-top:12px;display:flex;align-items:center;gap:14px">
          <div style="font-size:32px">📤</div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:700;color:#9a3412">มีใบแจ้งหนี้ ${draftCount} ใบที่ยังเป็น "ร่าง"</div>
            <div style="font-size:11px;color:#9a3412">ส่งให้ผู้เช่าก่อนถึงจะนับเป็นค้างชำระได้</div>
          </div>
          <button onclick="sendAllDraftsGlobal()" style="padding:10px 18px;background:#ea580c;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:Sarabun;white-space:nowrap">บันทึกส่งทั้งหมด</button>
        </div>` : '';
    return `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><div><div style="font-size:18px;font-weight:800;color:#1e293b">⏰ Arrears Aging</div></div>${rptExportBarHTML('arrears')}</div>
      ${kpis}
      <div style="background:#fff;border-radius:14px;padding:48px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.04)">
        <div style="font-size:48px;margin-bottom:8px">🎉</div>
        <div style="font-size:16px;font-weight:700;color:#1e293b">ไม่มีบิลค้างชำระ</div>
      </div>
      ${draftCTA}`;
  }

  // Sort properties by total outstanding (high → low), top 10
  const propRanked = (d.byProp||[]).map(p=>{
    const total=(p['1-30']||0)+(p['31-60']||0)+(p['61-90']||0)+(p['90+']||0);
    return Object.assign({}, p, {total});
  }).sort((a,b)=>b.total-a.total);
  const propRankedTop = propRanked.slice(0,10);
  const charts = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:13px;font-weight:700;color:#1e293b">📊 ค้างชำระแยก Property</div>
        <div style="font-size:10px;color:#64748b">เรียงตามยอดค้างมาก → น้อย</div>
      </div>
      ${propRanked.length===0
        ? '<div style="text-align:center;padding:30px 12px;color:#64748b;font-size:12px">ไม่มีข้อมูล</div>'
        : `<div style="max-height:280px;overflow-y:auto">
            <table style="width:100%;border-collapse:collapse;font-size:11px">
              <thead><tr style="background:#fafbfc;color:#64748b;font-weight:600;text-align:right;position:sticky;top:0">
                <th style="padding:7px 8px;text-align:left">Property</th>
                <th style="padding:7px 8px">รวม</th>
                <th style="padding:7px 8px;color:#059669">1-30</th>
                <th style="padding:7px 8px;color:#f59e0b">31-60</th>
                <th style="padding:7px 8px;color:#d97706">61-90</th>
                <th style="padding:7px 8px;color:#dc2626">90+</th>
              </tr></thead>
              <tbody>${propRankedTop.map(p=>`
                <tr style="border-top:1px solid #f1f5f9">
                  <td style="padding:7px 8px;color:#1e293b;font-weight:600;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(p.name)}">${esc(p.name)}</td>
                  <td style="padding:7px 8px;text-align:right;color:#dc2626;font-weight:700">${fmtBaht(p.total,{sym:0})}</td>
                  <td style="padding:7px 8px;text-align:right;color:${p['1-30']>0?'#059669':'#cbd5e1'}">${p['1-30']>0?fmtBaht(p['1-30'],{sym:0}):'—'}</td>
                  <td style="padding:7px 8px;text-align:right;color:${p['31-60']>0?'#f59e0b':'#cbd5e1'}">${p['31-60']>0?fmtBaht(p['31-60'],{sym:0}):'—'}</td>
                  <td style="padding:7px 8px;text-align:right;color:${p['61-90']>0?'#d97706':'#cbd5e1'}">${p['61-90']>0?fmtBaht(p['61-90'],{sym:0}):'—'}</td>
                  <td style="padding:7px 8px;text-align:right;color:${p['90+']>0?'#dc2626':'#cbd5e1'};font-weight:${p['90+']>0?700:400}">${p['90+']>0?fmtBaht(p['90+'],{sym:0}):'—'}</td>
                </tr>`).join('')}
                ${propRanked.length>10?`<tr><td colspan="6" style="padding:6px;text-align:center;color:#64748b;font-size:10px">+${propRanked.length-10} ทรัพย์</td></tr>`:''}
              </tbody>
            </table>
          </div>`}
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
      <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:8px">📈 ยอดค้าง 6 เดือนย้อนหลัง</div>
      <div style="height:280px"><canvas id="rptArrTrend"></canvas></div>
    </div>
  </div>`;

  const top10 = new Set(d.rows.slice(0,10).map(r=>r.inv.id));
  const tableBody = `<table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead><tr style="background:#fafbfc;color:#64748b;font-weight:600;text-align:left">
      <th style="padding:8px 12px">ผู้เช่า</th>
      <th style="padding:8px 12px">ทรัพย์</th>
      <th style="padding:8px 12px">เลขบิล</th>
      <th style="padding:8px 12px;text-align:right">ยอดค้าง</th>
      <th style="padding:8px 12px">ครบกำหนด</th>
      <th style="padding:8px 12px;text-align:right">อายุ (วัน)</th>
      <th style="padding:8px 12px">Bucket</th>
      <th style="padding:8px 12px;text-align:right">จัดการ</th>
    </tr></thead>
    <tbody>${d.rows.slice(0,100).map(r=>{
      const isTop = top10.has(r.inv.id);
      const bg = isTop ? 'background:#fef3c7;' : '';
      const c = r.bucket==='90+'?'#dc2626':r.bucket==='61-90'?'#d97706':r.bucket==='31-60'?'#f59e0b':'#059669';
      const ctr = (DB.contracts||[]).find(x=>x.id===r.inv.cid);
      const phone = (ctr&&ctr.phone||'').replace(/[^0-9+]/g,'');
      return `<tr style="border-top:1px solid #f1f5f9;${bg}">
        <td style="padding:10px 12px;color:#1e293b;font-weight:600">${esc(r.tenant)}${isTop?' ⭐':''}</td>
        <td style="padding:10px 12px;color:#64748b">${esc(r.propName)}</td>
        <td style="padding:10px 12px;color:#475569">${esc(r.invNo)}</td>
        <td style="padding:10px 12px;text-align:right;color:#dc2626;font-weight:700">${fmtBaht(r.amount)}</td>
        <td style="padding:10px 12px;color:#64748b">${fmtBE(r.inv.dueDate)}</td>
        <td style="padding:10px 12px;text-align:right;font-weight:700;color:${c}">${r.daysOverdue}</td>
        <td style="padding:10px 12px"><span style="background:${c};color:#fff;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700">${r.bucket}</span></td>
        <td style="padding:8px 12px;text-align:right;white-space:nowrap">
          <button onclick="viewInvoiceDetail(${r.inv.id})" style="padding:4px 10px;background:#4f46e5;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">ดูใบ</button>
          ${phone?`<a href="tel:${phone}" style="padding:4px 10px;background:#059669;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;text-decoration:none;margin-left:4px;display:inline-block">📞</a>`:''}
        </td>
      </tr>`;
    }).join('')}
    ${d.rows.length>100?`<tr><td colspan="8" style="padding:10px;text-align:center;color:#64748b;font-size:11px">แสดง 100 จาก ${d.rows.length}</td></tr>`:''}
    </tbody></table>`;

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:18px;font-weight:800;color:#1e293b">⏰ Arrears Aging</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px">Top 10 ลูกหนี้ค้างนาน highlight ⭐</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${filters}${rptExportBarHTML('arrears')}</div>
    </div>
    ${kpis}
    ${charts}
    ${rptSectionHTML('📋 รายการบิลค้าง', d.rows.length, tableBody, '#dc2626')}
  `;
}

function rptArrearsInitCharts(){
  if(typeof Chart==='undefined') return;
  const d = rptCalcArrears();
  if(d.rows.length===0) return;
  rptChart('rptArrTrend', {
    type:'line',
    data:{ labels:d.trend.map(x=>x.label), datasets:[{ label:'ยอดค้างรวม', data:d.trend.map(x=>x.total), borderColor:'#dc2626', backgroundColor:'rgba(220,38,38,.1)', fill:true, tension:.3 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ y:{ beginAtZero:true, ticks:{ callback:v=>fmtBaht(v) } } } }
  });
}

// ============================================================
// Report 6: Property Performance (P1) — admin only
// ============================================================
function rptCalcPropertyPerf(){
  if(!hasPermission || !hasPermission('view_report_property')) return { rows:[], top:null, worst:null, avgOcc:0, totalRev:0 };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const periodDays = Math.max(1, Math.ceil((today-yearStart)/864e5));

  const properties = DB.properties||[];
  const contracts = DB.contracts||[];
  const invoices = (DB.invoices||[]).filter(i=>i.status!=='voided');

  const rows = properties.map(p=>{
    const propContracts = contracts.filter(c=>c.pid===p.pid && !c.cancelled);
    const revenue = invoices.filter(inv=>{
      const c = contracts.find(x=>x.id===inv.cid);
      if(!c || c.pid!==p.pid) return false;
      const pd = rptInvPaidDate(inv);
      return pd && pd>=yearStart && pd<=today;
    }).reduce((s,inv)=>s+rptInvPaidAmount(inv),0);

    // Occupancy days within YTD
    let occDays = 0;
    propContracts.forEach(c=>{
      const s = parseBE(c.start), e = parseBE(c.end);
      if(!s) return;
      const start = s<yearStart ? yearStart : s;
      const end = (!e || e>today) ? today : e;
      if(end>=start) occDays += Math.ceil((end-start)/864e5)+1;
    });
    const occupancyPct = Math.min(100, (occDays/periodDays)*100);

    const tenantCount = new Set(propContracts.map(c=>c.tenant)).size;
    const rents = propContracts.map(c=>(typeof monthlyRev==='function'?monthlyRev(c)||0:0)).filter(x=>x>0);
    const avgRent = rents.length>0 ? rents.reduce((s,x)=>s+x,0)/rents.length : 0;

    return { p, name:p.name||p.pid, revenue, occupancyPct, tenantCount, avgRent };
  }).sort((a,b)=>b.revenue-a.revenue).map((r,i)=>({ ...r, rank:i+1 }));

  const top = rows[0]||null;
  const worst = rows.length>0 ? rows[rows.length-1] : null;
  const totalRev = rows.reduce((s,r)=>s+r.revenue,0);
  const avgOcc = rows.length>0 ? rows.reduce((s,r)=>s+r.occupancyPct,0)/rows.length : 0;

  return { rows, top, worst, totalRev, avgOcc };
}

function rptPropertyPerfHTML(){
  if(!hasPermission || !hasPermission('view_report_property')) return rptNoAccessHTML();
  const d = rptCalcPropertyPerf();

  const kpis = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px">
    ${rptKpiCardHTML({label:'🏆 Top earner', value:d.top?esc(d.top.name):'-', sub:d.top?fmtBaht(d.top.revenue):'', color:'#059669'})}
    ${rptKpiCardHTML({label:'📉 Worst performer', value:d.worst?esc(d.worst.name):'-', sub:d.worst?fmtBaht(d.worst.revenue):'', color:'#dc2626'})}
    ${rptKpiCardHTML({label:'Avg occupancy', value:d.avgOcc.toFixed(1)+'%', sub:'YTD เฉลี่ยทุกทรัพย์', color:'#4f46e5'})}
    ${rptKpiCardHTML({label:'Total revenue', value:fmtBaht(d.totalRev), sub:'YTD รวม', color:'#d97706'})}
  </div>`;

  const charts = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
      <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:8px">📊 Ranking by Revenue (top 20)</div>
      <div style="max-height:360px;overflow-y:auto"><canvas id="rptPpRank" height="${Math.max(120, Math.min(20,d.rows.length)*22)}"></canvas></div>
    </div>
    <div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
      <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:8px">🎯 Occupancy vs Revenue</div>
      <div style="height:340px"><canvas id="rptPpScatter"></canvas></div>
    </div>
  </div>`;

  const tableBody = d.rows.length===0
    ? rptEmptyStateHTML('📭','ยังไม่มีทรัพย์')
    : `<table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#fafbfc;color:#64748b;font-weight:600;text-align:left">
          <th style="padding:8px 12px">อันดับ</th>
          <th style="padding:8px 12px">ทรัพย์</th>
          <th style="padding:8px 12px;text-align:right">รายได้</th>
          <th style="padding:8px 12px;text-align:right">% Occupancy</th>
          <th style="padding:8px 12px;text-align:right">ค่าเช่าเฉลี่ย</th>
          <th style="padding:8px 12px;text-align:right">ผู้เช่า</th>
        </tr></thead>
        <tbody>${d.rows.map(r=>{
          const q = r.rank/d.rows.length;
          const heat = q<=0.25?'#dcfce7':q>=0.75?'#fee2e2':'#fef9c3';
          return `<tr style="border-top:1px solid #f1f5f9;background:${heat}">
            <td style="padding:10px 12px;font-weight:700;color:#1e293b">#${r.rank}</td>
            <td style="padding:10px 12px;color:#1e293b;font-weight:600">${esc(r.name)}</td>
            <td style="padding:10px 12px;text-align:right;color:#059669;font-weight:700">${fmtBaht(r.revenue)}</td>
            <td style="padding:10px 12px;text-align:right">${r.occupancyPct.toFixed(1)}%</td>
            <td style="padding:10px 12px;text-align:right">${fmtBaht(Math.round(r.avgRent))}</td>
            <td style="padding:10px 12px;text-align:right">${r.tenantCount}</td>
          </tr>`;
        }).join('')}</tbody></table>`;

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:18px;font-weight:800;color:#1e293b">🏢 Property Performance</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px">YTD ranking + heat map</div>
      </div>
      ${rptExportBarHTML('property')}
    </div>
    ${kpis}
    ${charts}
    ${rptSectionHTML('📋 Performance Table', d.rows.length, tableBody, '#4f46e5')}
  `;
}

function rptPropertyPerfInitCharts(){
  if(typeof Chart==='undefined') return;
  const d = rptCalcPropertyPerf();
  if(d.rows.length===0) return;
  const top20 = d.rows.slice(0,20);
  rptChart('rptPpRank', {
    type:'bar',
    data:{ labels: top20.map(r=>r.name),
      datasets:[{ label:'รายได้', data: top20.map(r=>r.revenue), backgroundColor:'#4f46e5', borderRadius:4 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false } },
      scales:{ x:{ beginAtZero:true, ticks:{ callback:v=>fmtBaht(v) } } } }
  });
  rptChart('rptPpScatter', {
    type:'scatter',
    data:{ datasets:[{ label:'Properties', data: d.rows.map(r=>({ x:r.occupancyPct, y:r.revenue, name:r.name })), backgroundColor:'#4f46e5' }] },
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:(ctx)=>ctx.raw.name+': '+ctx.raw.x.toFixed(0)+'% / ฿'+fmtBaht(ctx.raw.y,{sym:0}) } } },
      scales:{ x:{ title:{ display:true, text:'% Occupancy' }, beginAtZero:true, max:100 }, y:{ title:{ display:true, text:'รายได้' }, beginAtZero:true, ticks:{ callback:v=>fmtBaht(v) } } } }
  });
}

// ============================================================
// Report 7: Renewal Rate (P1) — admin only
// ============================================================
function rptCalcRenewal(){
  if(!hasPermission || !hasPermission('view_report_renewal')) return { renewed:[], lost:[], pending:[], rate:0, prevRate:0, trend:[] };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const oneYearAgo = new Date(today); oneYearAgo.setFullYear(oneYearAgo.getFullYear()-1);
  const twoYearAgo = new Date(today); twoYearAgo.setFullYear(twoYearAgo.getFullYear()-2);
  const grace30Ago = new Date(today); grace30Ago.setDate(grace30Ago.getDate()-30);
  const contracts = (DB.contracts||[]).filter(c=>!c.cancelled);

  // Helper: find renewal for a contract (same tenant + same pid, start within 60 days after old end)
  const findRenewal = (oldC)=>{
    const oldEnd = parseBE(oldC.end); if(!oldEnd) return null;
    return contracts.find(n=>{
      if(n.id===oldC.id) return false;
      if(n.pid!==oldC.pid) return false;
      if((n.tenant||'').trim() !== (oldC.tenant||'').trim()) return false;
      const ns = parseBE(n.start); if(!ns) return false;
      const diff = (ns-oldEnd)/864e5;
      return diff>=-1 && diff<=60;
    }) || null;
  };

  // Base: contracts that ended in last 12 months (excluding currently in grace 30 days)
  const ended12 = contracts.filter(c=>{
    const e = parseBE(c.end);
    return e && e>=oneYearAgo && e<=grace30Ago;
  });

  const renewed = [];
  const lost = [];
  ended12.forEach(c=>{
    const next = findRenewal(c);
    const p = (DB.properties||[]).find(x=>x.pid===c.pid);
    const propName = p?p.name:(c.property||'-');
    if(next){
      const oe = parseBE(c.end), ns = parseBE(next.start);
      const gap = Math.round((ns-oe)/864e5);
      renewed.push({ old:c, next, propName, gap });
    } else {
      lost.push({ c, propName });
    }
  });

  // Pending: ended in last 30 days, no renewal yet
  const pending = contracts.filter(c=>{
    const e = parseBE(c.end);
    if(!e || e<grace30Ago || e>today) return false;
    return !findRenewal(c);
  }).map(c=>{
    const p = (DB.properties||[]).find(x=>x.pid===c.pid);
    return { c, propName: p?p.name:(c.property||'-') };
  });

  const total = renewed.length+lost.length;
  const rate = total>0 ? (renewed.length/total*100) : 0;

  // Previous 12 months rate
  const ended24 = contracts.filter(c=>{
    const e = parseBE(c.end);
    return e && e>=twoYearAgo && e<oneYearAgo;
  });
  let prevRenewed=0;
  ended24.forEach(c=>{ if(findRenewal(c)) prevRenewed++; });
  const prevRate = ended24.length>0 ? (prevRenewed/ended24.length*100) : 0;

  // Trend: 12 monthly points (rolling 12mo at each month end going back 12 months)
  const trend = [];
  for(let i=11;i>=0;i--){
    const snapEnd = new Date(today.getFullYear(), today.getMonth()-i+1, 0);
    const snapStart = new Date(snapEnd); snapStart.setFullYear(snapStart.getFullYear()-1);
    const base = contracts.filter(c=>{
      const e = parseBE(c.end);
      return e && e>=snapStart && e<=snapEnd;
    });
    let r=0;
    base.forEach(c=>{ if(findRenewal(c)) r++; });
    trend.push({ label: rptMonthLabel(snapEnd), rate: base.length>0?(r/base.length*100):0 });
  }

  return { renewed, lost, pending, rate, prevRate, trend, totalBase: total };
}

function rptRenewalHTML(){
  if(!hasPermission || !hasPermission('view_report_renewal')) return rptNoAccessHTML();
  const d = rptCalcRenewal();

  const kpis = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px">
    ${rptKpiCardHTML({label:'🔄 Renewal rate', value:d.rate.toFixed(1)+'%', sub:'Rolling 12 เดือน', color:'#4f46e5'})}
    ${rptKpiCardHTML({label:'✅ Renewed', value:d.renewed.length, sub:'สัญญาที่ต่อ', color:'#059669'})}
    ${rptKpiCardHTML({label:'❌ Lost', value:d.lost.length, sub:'ไม่ต่อ', color:'#dc2626'})}
    ${rptKpiCardHTML({label:'vs ปีก่อน', value:rptFmtComparison(d.rate, d.prevRate), sub:'prev: '+d.prevRate.toFixed(1)+'%', color:'#d97706'})}
  </div>`;

  const charts = `<div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.04);margin-bottom:12px">
    <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:8px">📈 Renewal Rate Trend (12 months rolling)</div>
    <div style="height:280px"><canvas id="rptRenLine"></canvas></div>
  </div>`;

  const renewedTbl = d.renewed.length===0 ? rptEmptyStateHTML('—','ไม่มีสัญญาที่ต่อใน 12 เดือน')
    : `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#fafbfc;color:#64748b;font-weight:600;text-align:left">
      <th style="padding:8px 12px">ผู้เช่า</th><th style="padding:8px 12px">ทรัพย์</th><th style="padding:8px 12px">หมดเก่า</th><th style="padding:8px 12px">เริ่มใหม่</th><th style="padding:8px 12px;text-align:right">Gap (วัน)</th>
    </tr></thead><tbody>${d.renewed.map(r=>`<tr style="border-top:1px solid #f1f5f9">
      <td style="padding:10px 12px;color:#1e293b;font-weight:600">${esc(r.old.tenant)||'-'}</td>
      <td style="padding:10px 12px;color:#64748b">${esc(r.propName)}</td>
      <td style="padding:10px 12px;color:#64748b">${fmtBE(r.old.end)}</td>
      <td style="padding:10px 12px;color:#64748b">${fmtBE(r.next.start)}</td>
      <td style="padding:10px 12px;text-align:right;font-weight:700;color:#059669">${r.gap}</td>
    </tr>`).join('')}</tbody></table>`;

  const lostTbl = d.lost.length===0 ? rptEmptyStateHTML('🎉','ไม่มีสัญญาที่เสีย')
    : `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#fafbfc;color:#64748b;font-weight:600;text-align:left">
      <th style="padding:8px 12px">ผู้เช่า</th><th style="padding:8px 12px">ทรัพย์</th><th style="padding:8px 12px">วันหมด</th>
    </tr></thead><tbody>${d.lost.map(r=>`<tr style="border-top:1px solid #f1f5f9">
      <td style="padding:10px 12px;color:#1e293b;font-weight:600">${esc(r.c.tenant)||'-'}</td>
      <td style="padding:10px 12px;color:#64748b">${esc(r.propName)}</td>
      <td style="padding:10px 12px;color:#64748b">${fmtBE(r.c.end)}</td>
    </tr>`).join('')}</tbody></table>`;

  const pendingTbl = d.pending.length===0 ? rptEmptyStateHTML('—','ไม่มีสัญญารอ grace period')
    : `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#fafbfc;color:#64748b;font-weight:600;text-align:left">
      <th style="padding:8px 12px">ผู้เช่า</th><th style="padding:8px 12px">ทรัพย์</th><th style="padding:8px 12px">วันหมด</th>
    </tr></thead><tbody>${d.pending.map(r=>`<tr style="border-top:1px solid #f1f5f9">
      <td style="padding:10px 12px;color:#1e293b;font-weight:600">${esc(r.c.tenant)||'-'}</td>
      <td style="padding:10px 12px;color:#64748b">${esc(r.propName)}</td>
      <td style="padding:10px 12px;color:#64748b">${fmtBE(r.c.end)}</td>
    </tr>`).join('')}</tbody></table>`;

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div>
        <div style="font-size:18px;font-weight:800;color:#1e293b">🔄 Renewal Rate</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px">Base: ${d.totalBase} สัญญา (rolling 12mo)</div>
      </div>
      ${rptExportBarHTML('renewal')}
    </div>
    ${kpis}
    ${charts}
    ${rptSectionHTML('✅ Renewed', d.renewed.length, renewedTbl, '#059669')}
    ${rptSectionHTML('❌ Lost', d.lost.length, lostTbl, '#dc2626')}
    ${rptSectionHTML('⏳ Pending (grace 30d)', d.pending.length, pendingTbl, '#d97706')}
  `;
}

function rptRenewalInitCharts(){
  if(typeof Chart==='undefined') return;
  const d = rptCalcRenewal();
  rptChart('rptRenLine', {
    type:'line',
    data:{ labels:d.trend.map(x=>x.label),
      datasets:[{ label:'Renewal rate %', data:d.trend.map(x=>x.rate), borderColor:'#4f46e5', backgroundColor:'rgba(79,70,229,.1)', fill:true, tension:.3 }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } },
      scales:{ y:{ beginAtZero:true, max:100, ticks:{ callback:v=>v+'%' } } } }
  });
}

function rptPlaceholderHTML(title, desc){
  const chartjsLoaded = (typeof Chart !== 'undefined');
  return `
    <div style="background:#fff;border-radius:14px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.04);min-height:400px">
      <div style="font-size:20px;font-weight:700;color:#1e293b;margin-bottom:8px">${title}</div>
      <div style="font-size:13px;color:#64748b;margin-bottom:24px">${desc}</div>
      <div style="padding:16px;background:#f8fafc;border-left:4px solid #4f46e5;border-radius:8px;font-size:12px;color:#475569;line-height:1.8">
        <div style="font-weight:700;color:#1e293b;margin-bottom:6px">🏗️ Phase 1: Foundation</div>
        <div>• โมดูลโหลดได้ ✓</div>
        <div>• Permission check ทำงาน ✓</div>
        <div>• Tab bar แสดงเฉพาะ report ที่มีสิทธิ์ดู ✓</div>
        <div>• Chart.js library: <strong style="color:${chartjsLoaded?'#059669':'#dc2626'}">${chartjsLoaded?'✓ โหลดแล้ว':'✗ ยังไม่โหลด'}</strong></div>
        <div style="margin-top:10px;color:#64748b">Phase 2 จะเติมเนื้อหา report จริงทีละตัว</div>
      </div>
    </div>
  `;
}

function rptNoAccessHTML(){
  return `
    <div style="padding:48px;text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🔒</div>
      <div style="font-size:18px;font-weight:700;color:#1e293b">ไม่มีสิทธิ์เข้าถึงรายงาน</div>
      <div style="font-size:13px;color:#64748b;margin-top:8px">กรุณาติดต่อผู้ดูแลระบบ</div>
    </div>
  `;
}

// ============================================================
// Phase 3 — Report 1: รายงานภาษีขาย (ภพ.30)
// ============================================================
function rptCalcTaxSales(){
  const header = rptResolveHeader();
  const overview = rptIsOverviewMode();
  // Get all paid invoices in date range, filtered by company
  // Exclude category='deposit' — เงินประกันไม่ใช่ขาย/บริการ ไม่เข้า ภพ.30
  const invs = rptFilterInvoices({ statuses:['paid','partial','sent'], dateField:'date' })
    .filter(inv => inv.category !== 'deposit');
  const rows = invs.map(inv=>{
    const c = (DB.contracts||[]).find(x=>x.id===inv.cid);
    const v = calcVat(inv, header);
    const p = (DB.properties||[]).find(x=>x.pid===inv.pid);
    return {
      inv, contract: c,
      date: inv.date,
      no: inv.invoiceNo || inv.no || '-',
      taxInvoiceNo: inv.taxInvoiceNo || '',
      room: p?p.name:(inv.property||'-'),
      tenantName: inv.tenant || (c?c.tenant:''),
      tenantTaxId: c?c.taxId||'':'',
      tenantBranch: c?c.branch||'00000':'00000',
      nonVatable: v.subtotalNonVatable || 0,
      vatable: v.subtotalVatable || 0,
      vatAmount: v.vatAmount || 0,
      total: v.total || 0
    };
  }).sort((a,b)=>{
    const da=parseBE(a.date), db=parseBE(b.date);
    return (da||0)-(db||0) || a.no.localeCompare(b.no);
  });
  const totals = rows.reduce((acc,r)=>({
    nonVatable: acc.nonVatable + r.nonVatable,
    vatable: acc.vatable + r.vatable,
    vatAmount: acc.vatAmount + r.vatAmount,
    total: acc.total + r.total
  }), {nonVatable:0, vatable:0, vatAmount:0, total:0});
  return { rows, totals, header, overview };
}

function rptTaxSalesHTML(){
  const headers = DB.invoiceHeaders||[];
  if(headers.length===0){
    return `<div style="background:#fff;border-radius:14px;padding:24px">
      <div style="font-size:18px;font-weight:800;color:#1e293b;margin-bottom:8px">📋 รายงานภาษีขาย (ภพ.30)</div>
      ${rptCompanyFilterHTML()}
    </div>`;
  }
  const d = rptCalcTaxSales();
  const rangeStr = rptDateRangeStr();
  const overview = d.overview;

  const tableRowsHTML = d.rows.length===0
    ? `<tr><td colspan="10" style="padding:32px;text-align:center;color:#64748b;font-size:12px">ไม่มีรายการในช่วงที่เลือก</td></tr>`
    : d.rows.map((r,i)=>`<tr>
        <td>${r.date}</td>
        <td style="font-weight:600">${esc(r.no)}</td>
        <td>${esc(r.room)}</td>
        <td>${esc(r.tenantName)}</td>
        <td>${esc(r.tenantTaxId)||'-'}</td>
        <td>${esc(r.tenantBranch)||'00000'}</td>
        <td class="num">${r.nonVatable>0?fmtBaht(r.nonVatable,{sym:0,dec:2}):'-'}</td>
        <td class="num">${r.vatable>0?fmtBaht(r.vatable,{sym:0,dec:2}):'-'}</td>
        <td class="num">${r.vatAmount>0?fmtBaht(r.vatAmount,{sym:0,dec:2}):'-'}</td>
        <td class="num" style="font-weight:700">${fmtBaht(r.total,{sym:0,dec:2})}</td>
      </tr>`).join('');
  const totalsRow = `<tr class="totals">
    <td colspan="6" style="text-align:right">รวม</td>
    <td class="num">${fmtBaht(d.totals.nonVatable,{sym:0,dec:2})}</td>
    <td class="num">${fmtBaht(d.totals.vatable,{sym:0,dec:2})}</td>
    <td class="num">${fmtBaht(d.totals.vatAmount,{sym:0,dec:2})}</td>
    <td class="num">${fmtBaht(d.totals.total,{sym:0,dec:2})}</td>
  </tr>`;

  const fullTable = `<table>
    <thead><tr>
      <th>วัน เดือน ปี</th><th>เลขที่</th><th>ห้อง</th><th>ชื่อผู้ซื้อสินค้า/ผู้รับบริการ</th>
      <th>เลขประจำตัวผู้เสียภาษีอากร</th><th>สนง.ใหญ่/สาขา</th>
      <th class="num">มูลค่าไม่คิดภาษี</th><th class="num">มูลค่าก่อนภาษี</th>
      <th class="num">ภาษีมูลค่าเพิ่ม</th><th class="num">มูลค่ารวมภาษี</th>
    </tr></thead>
    <tbody>${tableRowsHTML}${d.rows.length>0?totalsRow:''}</tbody>
  </table>`;

  return `
    <div style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:18px;font-weight:800;color:#1e293b">📋 รายงานภาษีขาย (ภพ.30)</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">${d.rows.length} รายการ ${rangeStr}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="rptTaxSalesExportExcel()" style="padding:8px 16px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">📊 Excel</button>
          <button onclick="rptTaxSalesPrint()" ${overview?'disabled':''} style="padding:8px 16px;background:${overview?'#cbd5e1':'#4f46e5'};color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:${overview?'not-allowed':'pointer'};opacity:${overview?'.5':'1'}" title="${overview?'พิมพ์ A4 ไม่ได้ในโหมดทุกบริษัท':''}">🖨 พิมพ์ A4</button>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:14px;padding:12px;background:#f8fafc;border-radius:10px">
        ${rptCompanyFilterHTML()}
        ${rptDateRangeFilterHTML()}
      </div>
      ${overview?`<div style="padding:8px 12px;background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;margin-bottom:12px;font-size:12px;color:#92400e">📊 โหมดภาพรวม — รวมทุกบริษัท. พิมพ์ A4 ไม่ได้ (เพราะ ภพ.30 ต้องแยกต่อบริษัท/สาขา)</div>`:''}
      <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:10px">
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead><tr style="background:#fafbfc;color:#475569;font-weight:700;text-align:left">
            <th style="padding:8px 10px">วัน เดือน ปี</th>
            <th style="padding:8px 10px">เลขที่</th>
            <th style="padding:8px 10px">ห้อง</th>
            <th style="padding:8px 10px">ชื่อผู้ซื้อสินค้า/ผู้รับบริการ</th>
            <th style="padding:8px 10px">เลขผู้เสียภาษี</th>
            <th style="padding:8px 10px">สาขา</th>
            <th style="padding:8px 10px;text-align:right">ไม่คิดภาษี</th>
            <th style="padding:8px 10px;text-align:right">ก่อนภาษี</th>
            <th style="padding:8px 10px;text-align:right">VAT</th>
            <th style="padding:8px 10px;text-align:right">รวมภาษี</th>
          </tr></thead>
          <tbody>${d.rows.length===0
            ? `<tr><td colspan="10" style="padding:32px;text-align:center;color:#64748b">ไม่มีรายการในช่วงที่เลือก</td></tr>`
            : d.rows.map(r=>`<tr style="border-top:1px solid #f1f5f9">
              <td style="padding:8px 10px;color:#475569">${r.date}</td>
              <td style="padding:8px 10px;color:#1e293b;font-weight:600">${esc(r.no)}</td>
              <td style="padding:8px 10px;color:#64748b">${esc(r.room)}</td>
              <td style="padding:8px 10px;color:#475569">${esc(r.tenantName)}</td>
              <td style="padding:8px 10px;color:#64748b;font-family:monospace">${esc(r.tenantTaxId)||'-'}</td>
              <td style="padding:8px 10px;color:#64748b;text-align:center">${esc(r.tenantBranch)||'00000'}</td>
              <td style="padding:8px 10px;text-align:right;color:${r.nonVatable>0?'#1e293b':'#cbd5e1'}">${r.nonVatable>0?fmtBaht(r.nonVatable,{sym:0,dec:2}):'—'}</td>
              <td style="padding:8px 10px;text-align:right;color:${r.vatable>0?'#1e293b':'#cbd5e1'}">${r.vatable>0?fmtBaht(r.vatable,{sym:0,dec:2}):'—'}</td>
              <td style="padding:8px 10px;text-align:right;color:${r.vatAmount>0?'#059669':'#cbd5e1'};font-weight:600">${r.vatAmount>0?fmtBaht(r.vatAmount,{sym:0,dec:2}):'—'}</td>
              <td style="padding:8px 10px;text-align:right;color:#1e293b;font-weight:700">${fmtBaht(r.total,{sym:0,dec:2})}</td>
            </tr>`).join('')
          }
          ${d.rows.length>0?`<tr style="border-top:2px solid #1e293b;background:#f8fafc;font-weight:700">
            <td colspan="6" style="padding:10px;text-align:right;color:#1e293b">รวม</td>
            <td style="padding:10px;text-align:right;color:#1e293b">${fmtBaht(d.totals.nonVatable,{sym:0,dec:2})}</td>
            <td style="padding:10px;text-align:right;color:#1e293b">${fmtBaht(d.totals.vatable,{sym:0,dec:2})}</td>
            <td style="padding:10px;text-align:right;color:#059669">${fmtBaht(d.totals.vatAmount,{sym:0,dec:2})}</td>
            <td style="padding:10px;text-align:right;color:#1e293b;font-size:13px">${fmtBaht(d.totals.total,{sym:0,dec:2})}</td>
          </tr>`:''}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function rptTaxSalesPrint(){
  const d = rptCalcTaxSales();
  if(d.overview){ toast('โหมดภาพรวม พิมพ์ A4 ไม่ได้ — เลือกบริษัทเดียวก่อน','warning'); return; }
  const totalsRow = `<tr class="totals">
    <td colspan="6" style="text-align:right">รวม</td>
    <td class="num">${fmtBaht(d.totals.nonVatable,{sym:0,dec:2})}</td>
    <td class="num">${fmtBaht(d.totals.vatable,{sym:0,dec:2})}</td>
    <td class="num">${fmtBaht(d.totals.vatAmount,{sym:0,dec:2})}</td>
    <td class="num">${fmtBaht(d.totals.total,{sym:0,dec:2})}</td>
  </tr>`;
  const body = `<table>
    <thead><tr>
      <th>วัน เดือน ปี</th><th>เลขที่</th><th>ห้อง</th><th>ชื่อผู้ซื้อสินค้า/ผู้รับบริการ</th>
      <th>เลขประจำตัวผู้เสียภาษีอากร</th><th>สนง.ใหญ่/สาขา</th>
      <th class="num">มูลค่าไม่คิดภาษี</th><th class="num">มูลค่าก่อนภาษี</th>
      <th class="num">ภาษีมูลค่าเพิ่ม</th><th class="num">มูลค่ารวมภาษี</th>
    </tr></thead>
    <tbody>${d.rows.map(r=>`<tr>
      <td>${r.date}</td><td>${esc(r.no)}</td><td>${esc(r.room)}</td><td>${esc(r.tenantName)}</td>
      <td>${esc(r.tenantTaxId)||'-'}</td><td style="text-align:center">${esc(r.tenantBranch)||'00000'}</td>
      <td class="num">${r.nonVatable>0?fmtBaht(r.nonVatable,{sym:0,dec:2}):'-'}</td>
      <td class="num">${r.vatable>0?fmtBaht(r.vatable,{sym:0,dec:2}):'-'}</td>
      <td class="num">${r.vatAmount>0?fmtBaht(r.vatAmount,{sym:0,dec:2}):'-'}</td>
      <td class="num" style="font-weight:700">${fmtBaht(r.total,{sym:0,dec:2})}</td>
    </tr>`).join('')}${d.rows.length>0?totalsRow:''}</tbody></table>`;
  rptOpenA4Print(d.header, 'รายงานภาษีขาย', rptDateRangeStr(), body);
}

function rptTaxSalesExportExcel(){
  if(typeof XLSX==='undefined'){ toast('XLSX library ยังไม่โหลด','error'); return; }
  const d = rptCalcTaxSales();
  const rows = d.rows.map(r=>({
    'วัน เดือน ปี': r.date,
    'เลขที่ใบกำกับภาษี': r.no,
    'ห้อง': r.room,
    'ชื่อผู้ซื้อสินค้า/ผู้รับบริการ': r.tenantName,
    'เลขผู้เสียภาษี': r.tenantTaxId||'',
    'สาขา': r.tenantBranch||'00000',
    'มูลค่าไม่คิดภาษี': r.nonVatable,
    'มูลค่าก่อนภาษี': r.vatable,
    'VAT': r.vatAmount,
    'รวมภาษี': r.total
  }));
  rows.push({
    'วัน เดือน ปี': '', 'เลขที่ใบกำกับภาษี': '', 'ห้อง': '', 'ชื่อผู้ซื้อสินค้า/ผู้รับบริการ': 'รวม',
    'เลขผู้เสียภาษี':'', 'สาขา':'',
    'มูลค่าไม่คิดภาษี': d.totals.nonVatable,
    'มูลค่าก่อนภาษี': d.totals.vatable,
    'VAT': d.totals.vatAmount,
    'รวมภาษี': d.totals.total
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'ภาษีขาย');
  const tag = d.header ? (d.header.companyName||'').replace(/[^a-zA-Z0-9ก-๙]/g,'_') : 'overview';
  const ts = new Date().toISOString().slice(0,10);
  XLSX.writeFile(wb, `tax-sales-${tag}-${ts}.xlsx`);
  toast(`Export ${d.rows.length} รายการ`,'success');
}

// ============================================================
// Phase 3 — Report 2: บิลค่าเช่ารายเดือน
// ============================================================
function rptCalcRentBills(){
  const header = rptResolveHeader();
  const overview = rptIsOverviewMode();
  const invs = rptFilterInvoices({ excludeVoid: true, excludeDraft: true })
    .filter(inv => inv.category !== 'deposit');
  const statusLabel = {paid:'ชำระแล้ว', partial:'บางส่วน', overdue:'เกินกำหนด', sent:'รอชำระ', draft:'แบบร่าง'};
  const rows = invs.map(inv => {
    const p = (DB.properties||[]).find(x => x.pid === inv.pid);
    const total = Number(inv.total) || 0;
    const paid = Number(inv.paidAmount) || 0;
    const remaining = +(total - paid).toFixed(2);
    return {
      inv, date: inv.date || '-',
      no: inv.invoiceNo || inv.no || '-',
      tenant: inv.tenant || '-',
      room: p ? p.name : (inv.property || '-'),
      total, paid, remaining,
      status: inv.status || 'sent',
      statusLabel: statusLabel[inv.status] || inv.status
    };
  }).sort((a, b) => {
    const da = parseBE(a.date), db = parseBE(b.date);
    return (da || 0) - (db || 0) || a.no.localeCompare(b.no);
  });
  const totals = rows.reduce((acc, r) => ({
    total: acc.total + r.total, paid: acc.paid + r.paid, remaining: acc.remaining + r.remaining
  }), { total: 0, paid: 0, remaining: 0 });
  return { rows, totals, header, overview };
}

function rptRentBillsHTML(){
  const d = rptCalcRentBills();
  const rangeStr = rptDateRangeStr();
  const stColor = {paid:'#059669', partial:'#d97706', overdue:'#dc2626', sent:'#0ea5e9', draft:'#64748b'};
  const tdStyle = 'padding:8px 10px';
  const thStyle = 'padding:8px 10px;background:#fafbfc;color:#475569;font-weight:700;text-align:left';
  const tableRows = d.rows.length === 0
    ? `<tr><td colspan="8" style="padding:32px;text-align:center;color:#64748b;font-size:12px">ไม่มีรายการในช่วงที่เลือก</td></tr>`
    : d.rows.map(r => `<tr style="border-bottom:1px solid #f1f5f9">
        <td style="${tdStyle};font-size:12px">${r.date}</td>
        <td style="${tdStyle};font-size:12px;font-weight:600">${esc(r.no)}</td>
        <td style="${tdStyle};font-size:12px">${esc(r.tenant)}</td>
        <td style="${tdStyle};font-size:12px">${esc(r.room)}</td>
        <td style="${tdStyle};font-size:12px;text-align:right">${fmtBaht(r.total,{sym:0,dec:2})}</td>
        <td style="${tdStyle};font-size:12px;text-align:right;color:#059669">${r.paid>0?fmtBaht(r.paid,{sym:0,dec:2}):'-'}</td>
        <td style="${tdStyle};font-size:12px;text-align:right;color:${r.remaining>0?'#dc2626':'#94a3b8'}">${r.remaining>0?fmtBaht(r.remaining,{sym:0,dec:2}):'-'}</td>
        <td style="${tdStyle};font-size:11px"><span style="background:${stColor[r.status]||'#64748b'}20;color:${stColor[r.status]||'#64748b'};padding:2px 8px;border-radius:99px;font-weight:600">${r.statusLabel}</span></td>
      </tr>`).join('');
  const totalsRow = d.rows.length === 0 ? '' : `<tr style="background:#f8fafc;font-weight:700;font-size:12px">
    <td colspan="4" style="${tdStyle};text-align:right">รวม</td>
    <td style="${tdStyle};text-align:right">${fmtBaht(d.totals.total,{sym:0,dec:2})}</td>
    <td style="${tdStyle};text-align:right;color:#059669">${fmtBaht(d.totals.paid,{sym:0,dec:2})}</td>
    <td style="${tdStyle};text-align:right;color:#dc2626">${fmtBaht(d.totals.remaining,{sym:0,dec:2})}</td>
    <td></td>
  </tr>`;
  return `
    <div style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:18px;font-weight:800;color:#1e293b">🧾 บิลค่าเช่ารายเดือน</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">${d.rows.length} รายการ ${rangeStr}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="rptRentBillsExportExcel()" style="padding:8px 16px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">📊 Excel</button>
          <button onclick="rptRentBillsPrint()" ${d.overview?'disabled':''} style="padding:8px 16px;background:${d.overview?'#cbd5e1':'#4f46e5'};color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:${d.overview?'not-allowed':'pointer'};opacity:${d.overview?'.5':'1'};font-family:Sarabun">🖨 พิมพ์ A4</button>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:14px;padding:12px;background:#f8fafc;border-radius:10px">
        ${rptCompanyFilterHTML()}${rptDateRangeFilterHTML()}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
        ${rptKpiCardHTML({label:'รวมที่ออกบิล', value:fmtBaht(d.totals.total), color:'#4f46e5'})}
        ${rptKpiCardHTML({label:'รับชำระแล้ว', value:fmtBaht(d.totals.paid), color:'#059669'})}
        ${rptKpiCardHTML({label:'ค้างชำระ', value:fmtBaht(d.totals.remaining), color:'#dc2626'})}
      </div>
      <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:10px">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="${thStyle}">วันที่</th>
            <th style="${thStyle}">เลขที่</th>
            <th style="${thStyle}">ผู้เช่า</th>
            <th style="${thStyle}">ห้อง/ทรัพย์</th>
            <th style="${thStyle};text-align:right">ยอดบิล</th>
            <th style="${thStyle};text-align:right">ชำระแล้ว</th>
            <th style="${thStyle};text-align:right">ค้างชำระ</th>
            <th style="${thStyle}">สถานะ</th>
          </tr></thead>
          <tbody>${tableRows}${totalsRow}</tbody>
        </table>
      </div>
    </div>`;
}

function rptRentBillsPrint(){
  const d = rptCalcRentBills();
  if(d.overview){ toast('โหมดภาพรวม พิมพ์ A4 ไม่ได้ — เลือกบริษัทก่อน','warning'); return; }
  const statusLabel = {paid:'ชำระแล้ว', partial:'บางส่วน', overdue:'เกินกำหนด', sent:'รอชำระ', draft:'แบบร่าง'};
  const body = `<table>
    <thead><tr>
      <th>วันที่</th><th>เลขที่</th><th>ผู้เช่า</th><th>ห้อง</th>
      <th class="num">ยอดบิล</th><th class="num">ชำระ</th><th class="num">ค้าง</th><th>สถานะ</th>
    </tr></thead>
    <tbody>
      ${d.rows.map(r=>`<tr>
        <td>${r.date}</td><td>${esc(r.no)}</td><td>${esc(r.tenant)}</td><td>${esc(r.room)}</td>
        <td class="num">${fmtBaht(r.total,{sym:0,dec:2})}</td>
        <td class="num">${r.paid>0?fmtBaht(r.paid,{sym:0,dec:2}):'-'}</td>
        <td class="num">${r.remaining>0?fmtBaht(r.remaining,{sym:0,dec:2}):'-'}</td>
        <td>${statusLabel[r.status]||r.status}</td>
      </tr>`).join('')}
      <tr class="totals">
        <td colspan="4" style="text-align:right">รวม</td>
        <td class="num">${fmtBaht(d.totals.total,{sym:0,dec:2})}</td>
        <td class="num">${fmtBaht(d.totals.paid,{sym:0,dec:2})}</td>
        <td class="num">${fmtBaht(d.totals.remaining,{sym:0,dec:2})}</td>
        <td></td>
      </tr>
    </tbody>
  </table>`;
  rptOpenA4Print(d.header, 'บิลค่าเช่ารายเดือน', rptDateRangeStr(), body);
}

function rptRentBillsExportExcel(){
  if(typeof XLSX==='undefined'){ toast('XLSX library ยังไม่โหลด','error'); return; }
  const d = rptCalcRentBills();
  const statusLabel = {paid:'ชำระแล้ว', partial:'บางส่วน', overdue:'เกินกำหนด', sent:'รอชำระ', draft:'แบบร่าง'};
  const rows = d.rows.map(r=>({
    'วันที่': r.date, 'เลขที่': r.no, 'ผู้เช่า': r.tenant, 'ห้อง/ทรัพย์': r.room,
    'ยอดบิล': r.total, 'ชำระแล้ว': r.paid, 'ค้างชำระ': r.remaining,
    'สถานะ': statusLabel[r.status] || r.status
  }));
  rows.push({'วันที่':'','เลขที่':'','ผู้เช่า':'','ห้อง/ทรัพย์':'รวม','ยอดบิล':d.totals.total,'ชำระแล้ว':d.totals.paid,'ค้างชำระ':d.totals.remaining,'สถานะ':''});
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'บิลค่าเช่า');
  XLSX.writeFile(wb, `rent-bills-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast(`Export ${d.rows.length} รายการ`, 'success');
}

// ============================================================
// Phase 3 — Report 3: เงินประกันคงค้าง
// ============================================================
function rptCalcDepositBalance(){
  const header = rptResolveHeader();
  const overview = rptIsOverviewMode();
  const ledger = DB.depositLedger || [];
  const contractMap = {};
  ledger.forEach(e => {
    if(!contractMap[e.cid]) contractMap[e.cid] = { cid: e.cid, in: 0, deduct: 0, out: 0 };
    if(e.type === 'in')     contractMap[e.cid].in     += e.amount || 0;
    else if(e.type === 'deduct') contractMap[e.cid].deduct += e.amount || 0;
    else if(e.type === 'out')    contractMap[e.cid].out    += e.amount || 0;
  });
  const rows = Object.values(contractMap).map(m => {
    const c = (DB.contracts||[]).find(x => x.id === m.cid);
    if(!c) return null;
    const balance = +(m.in - m.deduct - m.out).toFixed(2);
    if(balance < 0.005) return null;
    if(!overview && header){
      const depInv = (DB.invoices||[]).find(i => i.cid === c.id && i.category === 'deposit');
      if(depInv && depInv.headerId !== header.id) return null;
    }
    const p = (DB.properties||[]).find(x => x.pid === c.pid);
    return {
      contractNo: c.no || '-',
      tenant: c.tenant || '-',
      room: p ? p.name : (c.property || '-'),
      received: +m.in.toFixed(2),
      deducted: +m.deduct.toFixed(2),
      returned: +m.out.toFixed(2),
      balance,
      cstatus: c.status || '-'
    };
  }).filter(r => r !== null);
  rows.sort((a, b) => a.tenant.localeCompare(b.tenant, 'th'));
  const totals = rows.reduce((acc, r) => ({
    received: acc.received + r.received, deducted: acc.deducted + r.deducted,
    returned: acc.returned + r.returned, balance: acc.balance + r.balance
  }), { received: 0, deducted: 0, returned: 0, balance: 0 });
  return { rows, totals, header, overview };
}

function rptDepositBalanceHTML(){
  const d = rptCalcDepositBalance();
  const tdStyle = 'padding:8px 10px;font-size:12px';
  const thStyle = 'padding:8px 10px;background:#fafbfc;color:#475569;font-weight:700;text-align:left;font-size:12px';
  const tableRows = d.rows.length === 0
    ? `<tr><td colspan="6" style="padding:32px;text-align:center;color:#64748b;font-size:12px">ไม่มีเงินประกันคงค้าง</td></tr>`
    : d.rows.map(r => `<tr style="border-bottom:1px solid #f1f5f9">
        <td style="${tdStyle}">${esc(r.contractNo)}</td>
        <td style="${tdStyle}">${esc(r.tenant)}</td>
        <td style="${tdStyle}">${esc(r.room)}</td>
        <td style="${tdStyle};text-align:right">${fmtBaht(r.received,{sym:0,dec:2})}</td>
        <td style="${tdStyle};text-align:right;color:#d97706">${r.deducted>0?fmtBaht(r.deducted,{sym:0,dec:2}):'-'}</td>
        <td style="${tdStyle};text-align:right;color:#4f46e5;font-weight:700">${fmtBaht(r.balance,{sym:0,dec:2})}</td>
      </tr>`).join('');
  const totalsRow = d.rows.length === 0 ? '' : `<tr style="background:#f8fafc;font-weight:700;font-size:12px">
    <td colspan="3" style="${tdStyle};text-align:right">รวม</td>
    <td style="${tdStyle};text-align:right">${fmtBaht(d.totals.received,{sym:0,dec:2})}</td>
    <td style="${tdStyle};text-align:right;color:#d97706">${fmtBaht(d.totals.deducted,{sym:0,dec:2})}</td>
    <td style="${tdStyle};text-align:right;color:#4f46e5">${fmtBaht(d.totals.balance,{sym:0,dec:2})}</td>
  </tr>`;
  return `
    <div style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:18px;font-weight:800;color:#1e293b">💰 เงินประกันคงค้าง</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">${d.rows.length} สัญญา ณ ปัจจุบัน</div>
        </div>
        <button onclick="rptDepositBalanceExportExcel()" style="padding:8px 16px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">📊 Excel</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:14px;padding:12px;background:#f8fafc;border-radius:10px">
        ${rptCompanyFilterHTML()}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
        ${rptKpiCardHTML({label:'ยอดประกันที่รับมา', value:fmtBaht(d.totals.received), color:'#4f46e5'})}
        ${rptKpiCardHTML({label:'หักค่าเสียหายแล้ว', value:fmtBaht(d.totals.deducted), color:'#d97706'})}
        ${rptKpiCardHTML({label:'ยอดคงค้างรวม', value:fmtBaht(d.totals.balance), color:'#059669'})}
      </div>
      <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:10px">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="${thStyle}">เลขสัญญา</th>
            <th style="${thStyle}">ผู้เช่า</th>
            <th style="${thStyle}">ห้อง</th>
            <th style="${thStyle};text-align:right">รับมา</th>
            <th style="${thStyle};text-align:right">หักแล้ว</th>
            <th style="${thStyle};text-align:right">คงค้าง</th>
          </tr></thead>
          <tbody>${tableRows}${totalsRow}</tbody>
        </table>
      </div>
    </div>`;
}

function rptDepositBalanceExportExcel(){
  if(typeof XLSX==='undefined'){ toast('XLSX library ยังไม่โหลด','error'); return; }
  const d = rptCalcDepositBalance();
  const rows = d.rows.map(r=>({'เลขสัญญา':r.contractNo,'ผู้เช่า':r.tenant,'ห้อง':r.room,'รับมา':r.received,'หักแล้ว':r.deducted,'คงค้าง':r.balance}));
  rows.push({'เลขสัญญา':'','ผู้เช่า':'','ห้อง':'รวม','รับมา':d.totals.received,'หักแล้ว':d.totals.deducted,'คงค้าง':d.totals.balance});
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'ประกันคงค้าง');
  XLSX.writeFile(wb, `deposit-balance-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast(`Export ${d.rows.length} รายการ`, 'success');
}

// ============================================================
// Phase 3 — Report 4: คืนเงินประกัน
// ============================================================
function rptCalcDepositReturn(){
  const header = rptResolveHeader();
  const overview = rptIsOverviewMode();
  const fromBE = rptFilters.dateFrom; const toBE = rptFilters.dateTo;
  const from = fromBE ? parseBE(fromBE) : null;
  const to   = toBE   ? parseBE(toBE)   : null;
  const outEntries = (DB.depositLedger||[]).filter(e => e.type === 'out');
  const rows = outEntries.map(e => {
    const c = (DB.contracts||[]).find(x => x.id === e.cid);
    if(!c) return null;
    if(!overview && header){
      const depInv = (DB.invoices||[]).find(i => i.cid === e.cid && i.category === 'deposit');
      if(depInv && depInv.headerId !== header.id) return null;
    }
    const d = e.date ? parseBE(e.date) : null;
    if(from && (!d || d < from)) return null;
    if(to){ const tEnd = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59); if(!d || d > tEnd) return null; }
    const deductions = (DB.depositLedger||[]).filter(x => x.cid === e.cid && x.type === 'deduct' && x.refId === e.refId);
    const deducted = +deductions.reduce((s, x) => s + (x.amount || 0), 0).toFixed(2);
    const inEntry = (DB.depositLedger||[]).find(x => x.cid === e.cid && x.type === 'in');
    const p = (DB.properties||[]).find(x => x.pid === c.pid);
    return {
      date: e.date || '-',
      contractNo: c.no || '-',
      tenant: c.tenant || '-',
      room: p ? p.name : (c.property || '-'),
      depositOriginal: inEntry ? inEntry.amount : 0,
      deducted,
      returned: e.amount || 0,
      note: e.note || ''
    };
  }).filter(r => r !== null);
  rows.sort((a, b) => { const da = parseBE(a.date), db = parseBE(b.date); return (da||0) - (db||0); });
  const totals = rows.reduce((acc, r) => ({
    depositOriginal: acc.depositOriginal + r.depositOriginal,
    deducted: acc.deducted + r.deducted,
    returned: acc.returned + r.returned
  }), { depositOriginal: 0, deducted: 0, returned: 0 });
  return { rows, totals, header, overview };
}

function rptDepositReturnHTML(){
  const d = rptCalcDepositReturn();
  const rangeStr = rptDateRangeStr();
  const tdStyle = 'padding:8px 10px;font-size:12px';
  const thStyle = 'padding:8px 10px;background:#fafbfc;color:#475569;font-weight:700;text-align:left;font-size:12px';
  const tableRows = d.rows.length === 0
    ? `<tr><td colspan="7" style="padding:32px;text-align:center;color:#64748b;font-size:12px">ไม่มีรายการคืนเงินประกัน</td></tr>`
    : d.rows.map(r => `<tr style="border-bottom:1px solid #f1f5f9">
        <td style="${tdStyle}">${r.date}</td>
        <td style="${tdStyle}">${esc(r.contractNo)}</td>
        <td style="${tdStyle}">${esc(r.tenant)}</td>
        <td style="${tdStyle}">${esc(r.room)}</td>
        <td style="${tdStyle};text-align:right">${fmtBaht(r.depositOriginal,{sym:0,dec:2})}</td>
        <td style="${tdStyle};text-align:right;color:#d97706">${r.deducted>0?fmtBaht(r.deducted,{sym:0,dec:2}):'-'}</td>
        <td style="${tdStyle};text-align:right;color:#059669;font-weight:700">${fmtBaht(r.returned,{sym:0,dec:2})}</td>
      </tr>`).join('');
  const totalsRow = d.rows.length === 0 ? '' : `<tr style="background:#f8fafc;font-weight:700;font-size:12px">
    <td colspan="4" style="${tdStyle};text-align:right">รวม</td>
    <td style="${tdStyle};text-align:right">${fmtBaht(d.totals.depositOriginal,{sym:0,dec:2})}</td>
    <td style="${tdStyle};text-align:right;color:#d97706">${fmtBaht(d.totals.deducted,{sym:0,dec:2})}</td>
    <td style="${tdStyle};text-align:right;color:#059669">${fmtBaht(d.totals.returned,{sym:0,dec:2})}</td>
  </tr>`;
  return `
    <div style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:18px;font-weight:800;color:#1e293b">↩️ รายงานคืนเงินประกัน</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">${d.rows.length} รายการ ${rangeStr}</div>
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="rptDepositReturnExportExcel()" style="padding:8px 16px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">📊 Excel</button>
          <button onclick="rptDepositReturnPrint()" ${d.overview?'disabled':''} style="padding:8px 16px;background:${d.overview?'#cbd5e1':'#4f46e5'};color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:${d.overview?'not-allowed':'pointer'};opacity:${d.overview?'.5':'1'};font-family:Sarabun">🖨 พิมพ์ A4</button>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:14px;padding:12px;background:#f8fafc;border-radius:10px">
        ${rptCompanyFilterHTML()}${rptDateRangeFilterHTML()}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
        ${rptKpiCardHTML({label:'ยอดประกันเดิม', value:fmtBaht(d.totals.depositOriginal), color:'#4f46e5'})}
        ${rptKpiCardHTML({label:'หักค่าเสียหาย', value:fmtBaht(d.totals.deducted), color:'#d97706'})}
        ${rptKpiCardHTML({label:'คืนจริง', value:fmtBaht(d.totals.returned), color:'#059669'})}
      </div>
      <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:10px">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="${thStyle}">วันที่คืน</th>
            <th style="${thStyle}">เลขสัญญา</th>
            <th style="${thStyle}">ผู้เช่า</th>
            <th style="${thStyle}">ห้อง</th>
            <th style="${thStyle};text-align:right">ประกันเดิม</th>
            <th style="${thStyle};text-align:right">หัก</th>
            <th style="${thStyle};text-align:right">คืนจริง</th>
          </tr></thead>
          <tbody>${tableRows}${totalsRow}</tbody>
        </table>
      </div>
    </div>`;
}

function rptDepositReturnPrint(){
  const d = rptCalcDepositReturn();
  if(d.overview){ toast('โหมดภาพรวม พิมพ์ A4 ไม่ได้','warning'); return; }
  const body = `<table>
    <thead><tr>
      <th>วันที่คืน</th><th>เลขสัญญา</th><th>ผู้เช่า</th><th>ห้อง</th>
      <th class="num">ประกันเดิม</th><th class="num">หัก</th><th class="num">คืนจริง</th>
    </tr></thead>
    <tbody>
      ${d.rows.map(r=>`<tr>
        <td>${r.date}</td><td>${esc(r.contractNo)}</td><td>${esc(r.tenant)}</td><td>${esc(r.room)}</td>
        <td class="num">${fmtBaht(r.depositOriginal,{sym:0,dec:2})}</td>
        <td class="num">${r.deducted>0?fmtBaht(r.deducted,{sym:0,dec:2}):'-'}</td>
        <td class="num" style="font-weight:700">${fmtBaht(r.returned,{sym:0,dec:2})}</td>
      </tr>`).join('')}
      <tr class="totals">
        <td colspan="4" style="text-align:right">รวม</td>
        <td class="num">${fmtBaht(d.totals.depositOriginal,{sym:0,dec:2})}</td>
        <td class="num">${fmtBaht(d.totals.deducted,{sym:0,dec:2})}</td>
        <td class="num">${fmtBaht(d.totals.returned,{sym:0,dec:2})}</td>
      </tr>
    </tbody>
  </table>`;
  rptOpenA4Print(d.header, 'รายงานคืนเงินประกัน', rptDateRangeStr(), body);
}

function rptDepositReturnExportExcel(){
  if(typeof XLSX==='undefined'){ toast('XLSX library ยังไม่โหลด','error'); return; }
  const d = rptCalcDepositReturn();
  const rows = d.rows.map(r=>({'วันที่คืน':r.date,'เลขสัญญา':r.contractNo,'ผู้เช่า':r.tenant,'ห้อง':r.room,'ประกันเดิม':r.depositOriginal,'หัก':r.deducted,'คืนจริง':r.returned}));
  rows.push({'วันที่คืน':'','เลขสัญญา':'','ผู้เช่า':'','ห้อง':'รวม','ประกันเดิม':d.totals.depositOriginal,'หัก':d.totals.deducted,'คืนจริง':d.totals.returned});
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'คืนประกัน');
  XLSX.writeFile(wb, `deposit-return-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast(`Export ${d.rows.length} รายการ`, 'success');
}

// ============================================================
// Phase 3 — Report 5: หนี้สูญ
// ============================================================
function rptCalcBadDebt(){
  const header = rptResolveHeader();
  const overview = rptIsOverviewMode();
  const fromBE = rptFilters.dateFrom; const toBE = rptFilters.dateTo;
  const from = fromBE ? parseBE(fromBE) : null;
  const to   = toBE   ? parseBE(toBE)   : null;
  const rows = (DB.invoices||[]).filter(inv => {
    if(inv.status !== 'voided') return false;
    if(inv.category === 'deposit') return false;
    if(!overview && header && inv.headerId !== header.id) return false;
    const d = inv.date ? parseBE(inv.date) : null;
    if(from && (!d || d < from)) return false;
    if(to){ const tEnd = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59); if(!d || d > tEnd) return false; }
    const total = Number(inv.total) || 0;
    const paid  = Number(inv.paidAmount) || 0;
    return (total - paid) > 0.005;
  }).map(inv => {
    const total = Number(inv.total) || 0;
    const paid  = Number(inv.paidAmount) || 0;
    const loss  = +(total - paid).toFixed(2);
    const p = (DB.properties||[]).find(x => x.pid === inv.pid);
    return {
      date: inv.date || '-',
      no: inv.invoiceNo || inv.no || '-',
      tenant: inv.tenant || '-',
      room: p ? p.name : (inv.property || '-'),
      total, paid, loss
    };
  }).sort((a, b) => { const da = parseBE(a.date), db = parseBE(b.date); return (da||0) - (db||0); });
  const totals = rows.reduce((acc, r) => ({
    total: acc.total + r.total, paid: acc.paid + r.paid, loss: acc.loss + r.loss
  }), { total: 0, paid: 0, loss: 0 });
  return { rows, totals, header, overview };
}

function rptBadDebtHTML(){
  const d = rptCalcBadDebt();
  const rangeStr = rptDateRangeStr();
  const tdStyle = 'padding:8px 10px;font-size:12px';
  const thStyle = 'padding:8px 10px;background:#fafbfc;color:#475569;font-weight:700;text-align:left;font-size:12px';
  const tableRows = d.rows.length === 0
    ? `<tr><td colspan="7" style="padding:32px;text-align:center;color:#64748b;font-size:12px">ไม่มีรายการหนี้สูญ</td></tr>`
    : d.rows.map(r => `<tr style="border-bottom:1px solid #f1f5f9">
        <td style="${tdStyle}">${r.date}</td>
        <td style="${tdStyle};font-weight:600">${esc(r.no)}</td>
        <td style="${tdStyle}">${esc(r.tenant)}</td>
        <td style="${tdStyle}">${esc(r.room)}</td>
        <td style="${tdStyle};text-align:right">${fmtBaht(r.total,{sym:0,dec:2})}</td>
        <td style="${tdStyle};text-align:right;color:#059669">${r.paid>0?fmtBaht(r.paid,{sym:0,dec:2}):'-'}</td>
        <td style="${tdStyle};text-align:right;color:#dc2626;font-weight:700">${fmtBaht(r.loss,{sym:0,dec:2})}</td>
      </tr>`).join('');
  const totalsRow = d.rows.length === 0 ? '' : `<tr style="background:#f8fafc;font-weight:700;font-size:12px">
    <td colspan="4" style="${tdStyle};text-align:right">รวม</td>
    <td style="${tdStyle};text-align:right">${fmtBaht(d.totals.total,{sym:0,dec:2})}</td>
    <td style="${tdStyle};text-align:right;color:#059669">${fmtBaht(d.totals.paid,{sym:0,dec:2})}</td>
    <td style="${tdStyle};text-align:right;color:#dc2626">${fmtBaht(d.totals.loss,{sym:0,dec:2})}</td>
  </tr>`;
  return `
    <div style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:18px;font-weight:800;color:#1e293b">💸 รายงานหนี้สูญ</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">${d.rows.length} รายการ ${rangeStr}</div>
        </div>
        <button onclick="rptBadDebtExportExcel()" style="padding:8px 16px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">📊 Excel</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:14px;padding:12px;background:#f8fafc;border-radius:10px">
        ${rptCompanyFilterHTML()}${rptDateRangeFilterHTML()}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
        ${rptKpiCardHTML({label:'ยอดบิลที่ยกเลิก', value:fmtBaht(d.totals.total), color:'#4f46e5'})}
        ${rptKpiCardHTML({label:'รับชำระก่อน void', value:fmtBaht(d.totals.paid), color:'#d97706'})}
        ${rptKpiCardHTML({label:'มูลค่าสูญ', value:fmtBaht(d.totals.loss), color:'#dc2626'})}
      </div>
      <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:10px">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="${thStyle}">วันที่</th>
            <th style="${thStyle}">เลขที่</th>
            <th style="${thStyle}">ผู้เช่า</th>
            <th style="${thStyle}">ห้อง</th>
            <th style="${thStyle};text-align:right">ยอดบิล</th>
            <th style="${thStyle};text-align:right">รับบางส่วน</th>
            <th style="${thStyle};text-align:right">มูลค่าสูญ</th>
          </tr></thead>
          <tbody>${tableRows}${totalsRow}</tbody>
        </table>
      </div>
    </div>`;
}

function rptBadDebtExportExcel(){
  if(typeof XLSX==='undefined'){ toast('XLSX library ยังไม่โหลด','error'); return; }
  const d = rptCalcBadDebt();
  const rows = d.rows.map(r=>({'วันที่':r.date,'เลขที่':r.no,'ผู้เช่า':r.tenant,'ห้อง':r.room,'ยอดบิล':r.total,'รับบางส่วน':r.paid,'มูลค่าสูญ':r.loss}));
  rows.push({'วันที่':'','เลขที่':'','ผู้เช่า':'','ห้อง':'รวม','ยอดบิล':d.totals.total,'รับบางส่วน':d.totals.paid,'มูลค่าสูญ':d.totals.loss});
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'หนี้สูญ');
  XLSX.writeFile(wb, `bad-debt-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast(`Export ${d.rows.length} รายการ`, 'success');
}

// ============================================================
// Phase 3 — Report 6: วิเคราะห์รายรับ
// ============================================================
function rptCalcRevAnalysis(){
  const header = rptResolveHeader();
  const overview = rptIsOverviewMode();
  const invs = rptFilterInvoices({ statuses: ['paid','partial'], dateField: 'date' })
    .filter(inv => inv.category !== 'deposit');
  const catLabel = {rent:'ค่าเช่า', service:'ค่าบริการ', utility:'สาธารณูปโภค', other:'อื่นๆ'};
  const catColor = {rent:'#4f46e5', service:'#059669', utility:'#d97706', other:'#94a3b8'};
  const catMap = {};
  const monthMap = {};
  let grandTotal = 0;
  invs.forEach(inv => {
    const cat = inv.category || 'rent';
    const amt = Number(inv.paidAmount) || Number(inv.total) || 0;
    catMap[cat] = (catMap[cat] || 0) + amt;
    const d = parseBE(inv.date);
    if(d){
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const labelBE = `${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()+543}`;
      if(!monthMap[key]) monthMap[key] = { key, label: labelBE, total: 0 };
      monthMap[key].total += amt;
    }
    grandTotal += amt;
  });
  const categories = Object.entries(catMap).map(([cat, amt]) => ({
    cat, label: catLabel[cat] || cat, color: catColor[cat] || '#94a3b8',
    amt: +amt.toFixed(2),
    pct: grandTotal > 0 ? +(amt / grandTotal * 100).toFixed(1) : 0
  })).sort((a, b) => b.amt - a.amt);
  const months = Object.values(monthMap).sort((a, b) => a.key.localeCompare(b.key));
  const avgMonthly = months.length > 0 ? Math.round(grandTotal / months.length) : 0;
  return { categories, months, grandTotal: +grandTotal.toFixed(2), avgMonthly, count: invs.length, header, overview };
}

function rptRevAnalysisHTML(){
  const d = rptCalcRevAnalysis();
  const rangeStr = rptDateRangeStr();
  const tdStyle = 'padding:8px 10px;font-size:12px';
  const thStyle = 'padding:8px 10px;background:#fafbfc;color:#475569;font-weight:700;text-align:left;font-size:12px';
  const catRows = d.categories.length === 0
    ? `<tr><td colspan="3" style="padding:16px;text-align:center;color:#64748b">ไม่มีข้อมูล</td></tr>`
    : d.categories.map(c => `<tr style="border-bottom:1px solid #f1f5f9">
        <td style="${tdStyle}"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${c.color};margin-right:6px;vertical-align:middle"></span>${c.label}</td>
        <td style="${tdStyle};text-align:right;font-weight:600">${fmtBaht(c.amt,{sym:0,dec:2})}</td>
        <td style="${tdStyle};text-align:right;color:#64748b">${c.pct}%</td>
      </tr>`).join('');
  const monthRows = d.months.length === 0
    ? `<tr><td colspan="2" style="padding:16px;text-align:center;color:#64748b">ไม่มีข้อมูล</td></tr>`
    : d.months.map(m => `<tr style="border-bottom:1px solid #f1f5f9">
        <td style="${tdStyle}">${m.label}</td>
        <td style="${tdStyle};text-align:right;font-weight:600">${fmtBaht(m.total,{sym:0,dec:2})}</td>
      </tr>`).join('');
  return `
    <div style="background:#fff;border-radius:14px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,.04)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:18px;font-weight:800;color:#1e293b">📊 วิเคราะห์รายรับ</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">${d.count} รายการ ${rangeStr}</div>
        </div>
        <button onclick="rptRevAnalysisExportExcel()" style="padding:8px 16px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">📊 Excel</button>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:14px;padding:12px;background:#f8fafc;border-radius:10px">
        ${rptCompanyFilterHTML()}${rptDateRangeFilterHTML()}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">
        ${rptKpiCardHTML({label:'รายรับรวม', value:fmtBaht(d.grandTotal), color:'#4f46e5'})}
        ${d.categories[0] ? rptKpiCardHTML({label:'หมวดหลัก', value:d.categories[0].label, sub:fmtBaht(d.categories[0].amt)+' ('+d.categories[0].pct+'%)', color:d.categories[0].color}) : ''}
        ${rptKpiCardHTML({label:'เฉลี่ย/เดือน', value:fmtBaht(d.avgMonthly), sub:d.months.length+' เดือน', color:'#d97706'})}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
          <div style="padding:10px 14px;background:#fafbfc;font-weight:700;font-size:13px;color:#1e293b;border-bottom:1px solid #e2e8f0">แยกตามหมวด</div>
          <table style="width:100%;border-collapse:collapse">
            <thead><tr>
              <th style="${thStyle}">หมวด</th>
              <th style="${thStyle};text-align:right">ยอด</th>
              <th style="${thStyle};text-align:right">%</th>
            </tr></thead>
            <tbody>${catRows}</tbody>
          </table>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
          <div style="padding:10px 14px;background:#fafbfc;font-weight:700;font-size:13px;color:#1e293b;border-bottom:1px solid #e2e8f0">รายเดือน</div>
          <table style="width:100%;border-collapse:collapse">
            <thead><tr>
              <th style="${thStyle}">เดือน</th>
              <th style="${thStyle};text-align:right">รายรับ</th>
            </tr></thead>
            <tbody>${monthRows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function rptRevAnalysisExportExcel(){
  if(typeof XLSX==='undefined'){ toast('XLSX library ยังไม่โหลด','error'); return; }
  const d = rptCalcRevAnalysis();
  const catRows = d.categories.map(c => ({'หมวด': c.label, 'ยอด': c.amt, '%': c.pct}));
  const mRows = d.months.map(m => ({'เดือน': m.label, 'รายรับ': m.total}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catRows.length ? catRows : [{}]), 'แยกหมวด');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mRows.length ? mRows : [{}]), 'รายเดือน');
  XLSX.writeFile(wb, `rev-analysis-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('Export สำเร็จ', 'success');
}
