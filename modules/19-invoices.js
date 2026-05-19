// ========== INVOICING SYSTEM ==========
// M10: shared print/receipt CSS — 3 call sites ใช้ block เดียวกัน ห้าม drift
const _INV_PRINT_CSS=`@page{size:A4;margin:0}
*{margin:0;padding:0;box-sizing:border-box;font-family:'Sarabun',sans-serif}
body{background:#fff;color:#1e293b;font-size:11px;line-height:1.4}
.page{width:210mm;height:297mm;margin:0 auto;position:relative;page-break-after:always;display:flex;flex-direction:column}
.page:last-child{page-break-after:auto}
.half{width:100%;height:148.5mm;padding:10mm 14mm 8mm;position:relative;overflow:hidden}
.top-half{border-bottom:1px dashed #64748b}
.copy-half{position:relative}
.copy-watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-25deg);font-size:48px;font-weight:800;color:rgba(148,163,184,.08);letter-spacing:6px;pointer-events:none;z-index:0;white-space:nowrap}
.half-content{position:relative;z-index:1}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none!important}}
@media screen{body{background:#e2e8f0;padding:20px}.page{box-shadow:0 4px 24px rgba(0,0,0,.12);border-radius:4px;margin-bottom:20px}body.embed{background:#f8fafc;padding:10px 0}}`;
let invoiceMonth=new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0');
let invoiceTab='invoices'; // 'invoices' | 'receipts' | 'slips' | 'settings'
let slipSessionData={slips:[],totalPaid:0}; // Track slips uploaded in current session
// ── Invoice list UI state ──
let invSort='invoiceNo';      // sort column key
let invSortDir='asc';         // 'asc' | 'desc'
let invSearch='';             // search query string
let invLandlordFilter='all';  // shortLandlordName key or 'all'
let invOverdueOnly=false;     // true → KPI click: show cross-month overdue only
let invStatusFilter='all';    // 'all' | 'overdue' | 'unpaid' | 'paid' | 'draft'
let invBatchSelect=new Set(); // invoice IDs ที่เลือกไว้
let invPage=1;                 // current page (1-based)
const INV_PER_PAGE=20;         // items per page
let _invLastChecked=null;     // สำหรับ shift-click range
let _invVisibleIds=[];        // IDs ของ invoice ที่กำลังแสดง (cache)
// ── Search debounce + focus preservation ──
// แก้ปัญหา: oninput เดิม re-render ทั้งหน้า → input element ใหม่ → focus หาย → IME ไทยพิมพ์ไม่ติด
let _invSearchTimer=null;
function _invSearchInput(el,which){
  if(which==='rcp'){rcpSearch=el.value;rcpPage=1;}else{invSearch=el.value;invPage=1;}
  clearTimeout(_invSearchTimer);
  const id=el.id, caret=el.selectionStart;
  _invSearchTimer=setTimeout(()=>{
    renderInvoicePage();
    const ne=document.getElementById(id);
    if(ne){ne.focus();try{ne.setSelectionRange(caret,caret);}catch(e){}}
  },220);
}
// ── Receipt list UI state ──
let rcpSort='invoiceNo';      // sort column key
let rcpSortDir='asc';         // 'asc' | 'desc'
let rcpPage=1;                // current page (1-based)
let rcpSearch='';             // separate search state for receipt tab
const RCP_PER_PAGE=20;        // items per page

// ── Virtual scroll stub (Phase 3.5) ──
// เปิดเมื่อ list > VIRTUAL_THRESHOLD เพื่อ render เฉพาะ rows ที่อยู่ใน viewport
// ปัจจุบัน: pagination 20/หน้า ครอบคลุมเคสจริงหมดแล้ว — stub ไว้สำหรับ future
const VIRTUAL_THRESHOLD=200;
function _shouldVirtualize(list){return Array.isArray(list)&&list.length>VIRTUAL_THRESHOLD;}
// TODO: implement viewport windowing (IntersectionObserver) เมื่อ volume เกิน 200/เดือน
// ── Landlord filter helper ──
// invLandlordFilter เก็บ shortLandlordName (group key) หรือ 'all'
// คืน null = ไม่ filter | string[] = headerIds ที่ match
function _llFilterIds(){
  if(invLandlordFilter==='all') return null;
  const matched=(DB.invoiceHeaders||[]).filter(h=>shortLandlordName(h.companyName||h.name||'-')===invLandlordFilter);
  if(matched.length>0) return matched.map(h=>String(h.id));
  return [String(invLandlordFilter)]; // fallback: legacy single headerId
}

function renderInvoicePage(){
  // Badge counts for tabs
  const monthInvs=(DB.invoices||[]).filter(i=>i.month===invoiceMonth);
  const unpaidCount=(DB.invoices||[]).filter(i=>i.status!=='paid'&&i.status!=='voided').length;
  const overdueCount=(DB.invoices||[]).filter(i=>i.status!=='paid'&&i.status!=='voided'&&getDaysOverdue(i)>0).length;
  const partialCount=(DB.invoices||[]).filter(i=>i.status==='partial').length;
  const paidCount=monthInvs.filter(i=>i.status==='paid').length;
  const noHeader=(!DB.invoiceHeaders||DB.invoiceHeaders.length===0);

  const sessSlipCount=(slipSessionData&&slipSessionData.slips)?slipSessionData.slips.length:0;
  const tabs = [
    {id:'invoices', label:'ใบแจ้งหนี้'
      +(overdueCount>0?' <span style="background:#fee2e2;color:#dc2626;padding:1px 6px;border-radius:99px;font-size:10px;font-weight:700">⚠'+overdueCount+'</span>':'')
      +(unpaidCount>0?' <span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:99px;font-size:10px;font-weight:700">'+unpaidCount+'</span>':''), icon:'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'},
    {id:'slips', label:'อัปโหลดสลิป'+(sessSlipCount>0?' <span style="background:#dcfce7;color:#15803d;padding:1px 6px;border-radius:99px;font-size:10px;font-weight:700">'+sessSlipCount+'</span>':''), icon:'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'},
    {id:'receipts', label:'ใบเสร็จรับเงิน'+(paidCount>0?' <span style="background:#dcfce7;color:#15803d;padding:1px 6px;border-radius:99px;font-size:10px;font-weight:700">'+paidCount+'</span>':''), icon:'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'},
    {id:'audit', label:'ประวัติ', icon:'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'},
  ];

  // ERP pattern: auto-width tabs, left-aligned (Xero/QuickBooks/Stripe/Linear)
  //   Reason: flex:1 ทำให้ active tab กว้างตาม viewport (1920÷3=640px) → ข้างในว่าง ดูห่วย
  const tabHTML = `<div style="display:inline-flex;gap:2px;background:#f1f5f9;border-radius:10px;padding:3px;margin-bottom:14px">
    ${tabs.map(t => {
      const isActive = invoiceTab === t.id;
      return `<button onclick="invoiceTab='${t.id}';renderInvoicePage()" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;border:none;font-size:13px;font-weight:${isActive?'600':'500'};font-family:Sarabun;cursor:pointer;transition:all .15s;white-space:nowrap;${isActive?'background:#fff;color:#4338ca;box-shadow:0 1px 3px rgba(0,0,0,.08)':'background:transparent;color:#64748b'}">
        <svg style="width:16px;height:16px;flex-shrink:0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${t.icon}"/></svg>
        ${t.label}
      </button>`;
    }).join('')}
  </div>`;

  // Redirect stale tab states
  if(invoiceTab==='settings') invoiceTab='invoices';

  if(invoiceTab === 'invoices'){
    renderInvoiceListPage(tabHTML);
  } else if(invoiceTab === 'slips'){
    renderSlipUploadPage(tabHTML);
  } else if(invoiceTab === 'receipts'){
    renderReceiptListPage(tabHTML);
  } else if(invoiceTab === 'audit'){
    renderInvoiceAuditPage(tabHTML);
  }
}

// ══════════════════════════════════════════════════════════════════
//  SHARED HELPER: Smart Landlord Filter Tabs + Overflow Dropdown
//  mode: 'inv' = show overdue/unpaid/missing badges
//        'rcp' = show receipt count only (green theme)
//  dueContracts: ส่ง null ถ้าไม่ต้องการ missing badge (mode=rcp)
// ══════════════════════════════════════════════════════════════════
//  SHARED HELPER: Landlord <select> options
//  mode: 'inv' = include overdue/unpaid counts in label
//        'rcp' = include paid counts only
// ══════════════════════════════════════════════════════════════════
function buildLandlordSelectHTML(baseInvs,dueContracts,mode){
  const allHeaders=DB.invoiceHeaders||[];
  if(allHeaders.length===0) return '';
  const isRcp=mode==='rcp';

  const groupMap={};
  allHeaders.forEach(h=>{
    const key=shortLandlordName(h.companyName||h.name||'-');
    if(!groupMap[key]) groupMap[key]={key,headers:[]};
    groupMap[key].headers.push(h);
  });

  const scored=Object.values(groupMap).map(g=>{
    const ids=g.headers.map(h=>h.id);
    const hInvs=baseInvs.filter(i=>ids.some(id=>id==i.headerId));
    const over=!isRcp?hInvs.filter(i=>getDisplayStatus(i)==='overdue').length:0;
    const unpaid=!isRcp?hInvs.filter(i=>i.status!=='paid'&&i.status!=='voided'&&getDisplayStatus(i)!=='overdue').length:0;
    const paid=hInvs.filter(i=>i.status==='paid').length;
    return {...g,over,unpaid,paid,score:over*1000+unpaid*100+paid*10};
  }).sort((a,b)=>b.score-a.score);

  return scored.map(g=>{
    const hints=[];
    if(g.over>0)   hints.push(`⚠${g.over}`);
    if(g.unpaid>0) hints.push(`${g.unpaid}รอ`);
    if(isRcp&&g.paid>0) hints.push(`✓${g.paid}`);
    const label=g.key+(hints.length?` (${hints.join(' ')})`:' ');
    return `<option value="${esc(g.key)}"${invLandlordFilter===g.key?' selected':''}>${esc(label)}</option>`;
  }).join('');
}

// Per-render lookup caches — built once, reused by sort/filter/row builders
// (เคลียร์ทุกครั้งที่เริ่ม render เพื่อไม่ให้ stale ข้าม render)
let _invHeaderMap=null,_invContractMap=null;
function _buildInvLookups(){
  _invHeaderMap=new Map();(DB.invoiceHeaders||[]).forEach(h=>_invHeaderMap.set(String(h.id),h));
  _invContractMap=new Map();(DB.contracts||[]).forEach(c=>_invContractMap.set(String(c.id),c));
}
function _hdrById(id){return _invHeaderMap?_invHeaderMap.get(String(id)):(DB.invoiceHeaders||[]).find(h=>h.id==id);}
function _ctrById(id){return _invContractMap?_invContractMap.get(String(id)):(DB.contracts||[]).find(c=>c.id==id);}

function renderInvoiceListPage(tabHTML){
  _buildInvLookups();
  const allHeaders=DB.invoiceHeaders||[];
  const thMo=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const months2=[];
  for(let i=0;i<12;i++){const m=new Date(new Date().getFullYear(),new Date().getMonth()-i,1);months2.push(`${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,'0')}`);}

  // ── 1. Base set: current month ──
  // When "overdue-only" mode is ON → cross-month scan (ignore invoiceMonth filter)
  const baseInvs=invOverdueOnly
    ? (DB.invoices||[]).filter(i=>i.category!=='deposit'&&getDisplayStatus(i)==='overdue')
    : (DB.invoices||[]).filter(i=>i.category!=='deposit'&&i.month===invoiceMonth);

  // ── 2. Landlord filter ──
  const _fids=_llFilterIds();
  const filteredByLandlord=_fids?baseInvs.filter(i=>_fids.includes(String(i.headerId))):baseInvs;

  // ── 2.5. Status filter (from toolbar select; cross-month overdue handled by invOverdueOnly) ──
  let filteredByStatus=filteredByLandlord;
  if(!invOverdueOnly&&invStatusFilter!=='all'){
    if(invStatusFilter==='overdue')      filteredByStatus=filteredByLandlord.filter(i=>getDisplayStatus(i)==='overdue');
    else if(invStatusFilter==='unpaid')  filteredByStatus=filteredByLandlord.filter(i=>i.status!=='paid'&&i.status!=='voided'&&getDisplayStatus(i)!=='overdue');
    else if(invStatusFilter==='paid')    filteredByStatus=filteredByLandlord.filter(i=>i.status==='paid');
    else if(invStatusFilter==='draft')   filteredByStatus=filteredByLandlord.filter(i=>i.status==='draft');
  }

  // ── 3. Search filter ──
  const sq=(invSearch||'').toLowerCase().trim();
  let invoices=sq?filteredByStatus.filter(i=>
    (i.invoiceNo||'').toLowerCase().includes(sq)||
    (i.property||'').toLowerCase().includes(sq)||
    (i.tenant||'').toLowerCase().includes(sq)
  ):[...filteredByStatus];

  // ── 4. Sort ──
  function parseDueDateTS(d){if(!d)return 0;const p=d.split('/');if(p.length!==3)return 0;return new Date(parseInt(p[2])-543,parseInt(p[1])-1,parseInt(p[0])).getTime();}
  const statusOrd={draft:0,sent:1,overdue:2,partial:3,paid:4,voided:5};
  invoices.sort((a,b)=>{
    let r=0;
    if(invSort==='property')r=(a.property||'').localeCompare(b.property||'','th');
    else if(invSort==='tenant')r=(a.tenant||'').localeCompare(b.tenant||'','th');
    else if(invSort==='landlord'){const _ha=_hdrById(a.headerId);const _hb=_hdrById(b.headerId);const _la=_ha?.companyName||_ctrById(a.cid)?.landlord||'';const _lb=_hb?.companyName||_ctrById(b.cid)?.landlord||'';r=_la.localeCompare(_lb,'th');}
    else if(invSort==='total')r=(a.total||0)-(b.total||0);
    else if(invSort==='dueDate')r=parseDueDateTS(a.dueDate)-parseDueDateTS(b.dueDate);
    else if(invSort==='status')r=(statusOrd[getDisplayStatus(a)]||0)-(statusOrd[getDisplayStatus(b)]||0);
    else if(invSort==='daysOverdue')r=getDaysOverdue(a)-getDaysOverdue(b);
    else r=(a.invoiceNo||'').localeCompare(b.invoiceNo||'');
    return invSortDir==='asc'?r:-r;
  });

  // ── 5. KPI (from filteredByLandlord, excludes search) ──
  const nonV=filteredByLandlord.filter(i=>i.status!=='voided');
  const kpiTotalAmt=nonV.reduce((s,i)=>s+(i.total||0),0);
  const kpiPaidList=nonV.filter(i=>i.status==='paid');
  const kpiUnpaidList=nonV.filter(i=>i.status!=='paid');
  const kpiOverdueList=nonV.filter(i=>getDisplayStatus(i)==='overdue');
  const kpiPaidAmt=kpiPaidList.reduce((s,i)=>s+(i.total||0),0);
  const kpiUnpaidAmt=kpiUnpaidList.reduce((s,i)=>s+(i.remainingAmount!=null?i.remainingAmount:i.total||0),0);
  const kpiOverdueAmt=kpiOverdueList.reduce((s,i)=>s+(i.remainingAmount!=null?i.remainingAmount:i.total||0),0);

  // ── 5b. Cross-month overdue (independent of view month; drives "เกินกำหนด" KPI) ──
  //   Rationale: overdue is a financial reality, not a view-month concept.
  //   User ไม่ควรต้องสลับเดือนเพื่อเห็นใบเกินกำหนดจากเดือนก่อน.
  const crossOverdueList=(DB.invoices||[]).filter(i=>i.status!=='voided'&&getDisplayStatus(i)==='overdue');
  const crossOverdueAmt=crossOverdueList.reduce((s,i)=>s+(i.remainingAmount!=null?i.remainingAmount:i.total||0),0);

  // ── 6. Missing invoices (contracts due but no invoice yet) ──
  const dueContracts=DB.contracts.filter(c=>isInvoiceDue(c,invoiceMonth));
  const filteredDue=_fids?dueContracts.filter(c=>_fids.includes(String(c.invHeaderId||DB.defaultInvHeader))):dueContracts;
  const missing=filteredDue.filter(c=>!(DB.invoices||[]).find(i=>i.cid===c.id&&i.month===invoiceMonth));

  // ── 7. Outstanding per tenant (all time) ──
  const tenantDebts={};
  (DB.invoices||[]).forEach(iv=>{
    if(iv.status!=='paid'&&iv.status!=='voided'){
      const k=iv.tenant||'';
      tenantDebts[k]=(tenantDebts[k]||0)+(iv.remainingAmount!=null?iv.remainingAmount:iv.total||0);
    }
  });

  // ═══════════════════════════════
  //  A. LANDLORD FILTER TABS
  // ═══════════════════════════════

  // ═══════════════════════════════
  //  B. KPI SIDEBAR (vertical stack — ERP pattern: Ramp/Brex/QuickBooks)
  //     3 current-month KPIs + divider + cross-month overdue alert
  //     Rationale: แยก scope visually — "เดือนนี้" vs "ทั้งระบบ"
  // ═══════════════════════════════
  const kpiSidebarHTML=`<aside class="inv-side" aria-label="สรุปตัวเลข">
    <div class="inv-side-heading">📊 เดือนนี้</div>
    <div class="inv-kpi" style="background:#fff;border-color:#e5e7eb">
      <div class="inv-kpi-lbl" style="color:#64748b">📄 เรียกเก็บทั้งหมด</div>
      <div class="inv-kpi-val" style="color:#1e293b">${fmtBaht(kpiTotalAmt,{sym:0})}</div>
      <div class="inv-kpi-sub" style="color:#64748b">${nonV.length} ใบ</div>
    </div>
    <div class="inv-kpi" style="background:#f0fdf4;border-color:#bbf7d0">
      <div class="inv-kpi-lbl" style="color:#15803d">✅ ชำระแล้ว</div>
      <div class="inv-kpi-val" style="color:#059669">${fmtBaht(kpiPaidAmt,{sym:0})}</div>
      <div class="inv-kpi-sub" style="color:#15803d">${kpiPaidList.length} ใบ</div>
    </div>
    <div class="inv-kpi" style="background:#fffbeb;border-color:#fde68a">
      <div class="inv-kpi-lbl" style="color:#92400e">⏳ รอชำระ</div>
      <div class="inv-kpi-val" style="color:#d97706">${fmtBaht(kpiUnpaidAmt,{sym:0})}</div>
      <div class="inv-kpi-sub" style="color:#92400e">${kpiUnpaidList.length} ใบ</div>
    </div>
    <div class="inv-side-divider"></div>
    <div class="inv-side-heading">🔔 ข้ามเดือน (ทั้งระบบ)</div>
    <div onclick="invOverdueOnly=!invOverdueOnly;invPage=1;renderInvoicePage()"
         title="${invOverdueOnly?'คลิกเพื่อปิดตัวกรอง':'คลิกเพื่อแสดงเฉพาะใบเกินกำหนด (ข้ามทุกเดือน)'}"
         class="inv-kpi"
         role="button" tabindex="0"
         style="background:${crossOverdueList.length>0?(invOverdueOnly?'#fee2e2':'#fff1f2'):'#f8fafc'};border:${invOverdueOnly?'2px solid #dc2626':('1px solid '+(crossOverdueList.length>0?'#fecaca':'#e5e7eb'))};cursor:pointer;transition:all .12s;position:relative">
      <div class="inv-kpi-lbl" style="color:${crossOverdueList.length>0?'#991b1b':'#64748b'}">🔴 เกินกำหนด ${invOverdueOnly?'<span style="color:#dc2626;font-weight:800">✓ กำลังกรอง</span>':''}</div>
      <div class="inv-kpi-val" style="color:${crossOverdueList.length>0?'#dc2626':'#64748b'}">${fmtBaht(crossOverdueAmt,{sym:0})}</div>
      <div class="inv-kpi-sub" style="color:${crossOverdueList.length>0?'#dc2626':'#64748b'}">${crossOverdueList.length} ใบ ${crossOverdueList.length>0&&!invOverdueOnly?'<span style="color:#dc2626;font-weight:700;margin-left:4px">▸ ดู</span>':''}</div>
    </div>
  </aside>`;

  // ═══════════════════════════════
  //  C. TOP BAR (month + search + buttons)
  // ═══════════════════════════════
  // CSS tokens (inv- prefix) — injected once per render
  //   Phase 6: ERP 2-column layout (main table + right KPI sidebar)
  //   — toolbar compacted, utility actions → ⋯ menu (Stripe/Linear pattern)
  const invStyleHTML=`<style id="inv-tokens">
    /* ── 2-column grid: table left, KPI sidebar right ── */
    .inv-layout{display:grid;grid-template-columns:1fr 280px;gap:16px;align-items:start}
    .inv-main{min-width:0}
    .inv-side{display:flex;flex-direction:column;gap:8px;position:sticky;top:12px}
    .inv-side-heading{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.6px;padding:2px 2px 0}
    .inv-side-divider{height:1px;background:#e2e8f0;margin:6px 0 2px}
    .inv-kpi{border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;background:#fff}
    .inv-kpi-lbl{font-size:10px;font-weight:600;margin-bottom:4px;letter-spacing:.3px}
    .inv-kpi-val{font-size:18px;font-weight:800;line-height:1}
    .inv-kpi-sub{font-size:10px;margin-top:3px}
    @media (max-width:1100px){
      .inv-layout{grid-template-columns:1fr}
      .inv-side{position:static;flex-direction:row;flex-wrap:wrap;gap:8px}
      .inv-side-heading{flex-basis:100%}
      .inv-side-divider{flex-basis:100%;margin:2px 0}
      .inv-kpi{flex:1 1 160px}
    }

    /* ── toolbar (compact single row) ── */
    .inv-toolbar{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;align-items:center}
    .inv-action-send{padding:3px 8px;border:none;background:#dbeafe;color:#1d4ed8;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;font-family:Sarabun;width:78px}
    .inv-action-send:hover{background:#bfdbfe}

    /* ── ⋯ เพิ่มเติม overflow menu (details/summary, no JS state) ── */
    .inv-more{position:relative;margin-left:auto}
    .inv-more>summary{list-style:none;padding:8px 12px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;cursor:pointer;font-family:Sarabun;font-size:12px;font-weight:600;color:#475569;white-space:nowrap;user-select:none;display:inline-flex;align-items:center;gap:4px;min-height:36px}
    .inv-more>summary::-webkit-details-marker{display:none}
    .inv-more>summary:hover{background:#f8fafc}
    .inv-more[open]>summary{background:#eef2ff;color:var(--c-primary-hover);border-color:#c7d2fe}
    .inv-more-menu{position:absolute;top:calc(100% + 4px);right:0;z-index:200;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.12);min-width:200px;overflow:hidden;display:flex;flex-direction:column;padding:4px 0}
    .inv-more-menu button{padding:9px 14px;border:none;background:#fff;cursor:pointer;font-family:Sarabun;font-size:12px;font-weight:500;color:#1e293b;text-align:left;white-space:nowrap;display:flex;align-items:center;gap:8px}
    .inv-more-menu button:hover{background:#f8fafc}

    @media (max-width:1024px){
      .inv-toolbar{gap:4px}
    }
  </style>`;
  const draftCount=invoices.filter(i=>i.status==='draft').length;
  const llSelectOpts=buildLandlordSelectHTML(baseInvs,dueContracts,'inv');
  const topBarHTML=invStyleHTML+`<div class="inv-toolbar">
    <select onchange="invoiceMonth=this.value;invPage=1;renderInvoicePage()" style="padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:Sarabun;background:#fff;min-height:36px">
      ${months2.map(m=>{const[y,mo]=m.split('-');return'<option value="'+m+'" '+(m===invoiceMonth?'selected':'')+'>'+thMo[parseInt(mo)-1]+' '+(parseInt(y)+543)+'</option>';}).join('')}
    </select>
    ${llSelectOpts?`<select onchange="invLandlordFilter=this.value;invPage=1;rcpPage=1;renderInvoicePage()" style="padding:8px 12px;border:${invLandlordFilter!=='all'?'2px solid #6366f1':'1px solid #e5e7eb'};border-radius:8px;font-size:13px;font-family:Sarabun;background:${invLandlordFilter!=='all'?'#eef2ff':'#fff'};min-height:36px;color:#1e293b">
      <option value="all"${invLandlordFilter==='all'?' selected':''}>🏘️ ผู้ให้เช่า — ทั้งหมด</option>
      ${llSelectOpts}
    </select>`:''}
    <select onchange="invStatusFilter=this.value;invOverdueOnly=false;invPage=1;renderInvoicePage()" style="padding:8px 12px;border:${invStatusFilter!=='all'?'2px solid #6366f1':'1px solid #e5e7eb'};border-radius:8px;font-size:13px;font-family:Sarabun;background:${invStatusFilter!=='all'?'#eef2ff':'#fff'};min-height:36px;color:#1e293b">
      <option value="all"${invStatusFilter==='all'?' selected':''}>สถานะ — ทั้งหมด</option>
      <option value="overdue"${invStatusFilter==='overdue'?' selected':''}>⚠️ เกินกำหนด</option>
      <option value="unpaid"${invStatusFilter==='unpaid'?' selected':''}>⏳ รอชำระ</option>
      <option value="paid"${invStatusFilter==='paid'?' selected':''}>✅ ชำระแล้ว</option>
      <option value="draft"${invStatusFilter==='draft'?' selected':''}>📝 ร่าง</option>
    </select>
    <div style="position:relative;flex:1;min-width:200px;max-width:360px">
      <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#64748b;font-size:14px;pointer-events:none">🔍</span>
      <input type="text" id="invSearchInput" placeholder="ค้นหา ทรัพย์สิน / ผู้เช่า / เลขที่..." value="${invSearch.replace(/"/g,'&quot;')}"
        oninput="_invSearchInput(this,'inv')"
        style="width:100%;padding:8px 32px 8px 32px;border:${invSearch?'2px solid #6366f1':'1px solid #e5e7eb'};border-radius:8px;font-size:12px;font-family:Sarabun;background:${invSearch?'#eef2ff':'#fff'};box-sizing:border-box;min-height:36px">
      ${invSearch?`<button onclick="invSearch='';renderInvoicePage()" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#64748b;font-size:13px;padding:2px">✕</button>`:''}
    </div>
    <button class="btn2 btn2-primary" onclick="confirmGenerateAllInvoices(invoiceMonth)" title="สร้างใบแจ้งหนี้สำหรับทุกสัญญาที่ยังไม่ออกในเดือนนี้">📄 สร้างทั้งหมด</button>
    <button class="btn2 btn2-ghost" onclick="openInvoiceForm()">+ สร้างเอง</button>
    ${draftCount>0?`<button class="btn2 btn2-success" onclick="sendAllDraftInvoices()" title="บันทึกสถานะเป็นส่งแล้ว สำหรับร่างทั้งหมด">📤 บันทึกส่ง (${draftCount})</button>`:''}
    <details class="inv-more">
      <summary title="เครื่องมืออื่น ๆ">⋯ เพิ่มเติม</summary>
      <div class="inv-more-menu">
        <button onclick="this.closest('details').open=false;showMonthlySummary()">📊 สรุปรายเดือน</button>
        <button onclick="this.closest('details').open=false;showAgingReport()">⏱️ รายงานอายุหนี้</button>
        <button onclick="this.closest('details').open=false;showAllOutstanding()">📋 ค้างทั้งหมด</button>
        <button onclick="this.closest('details').open=false;showFollowUpDashboard()">📅 นัดชำระ</button>
        <button onclick="this.closest('details').open=false;batchPrintInvoices(true)" title="พิมพ์ใบแจ้งหนี้ทั้งหมดในรายการที่กรองไว้">🖨️ พิมพ์ทั้งหมด</button>
        <button onclick="this.closest('details').open=false;exportExcelInvoices()">📥 ส่งออก Excel</button>
      </div>
    </details>
  </div>`;

  // ═══════════════════════════════
  //  D. MISSING INVOICES ALERT
  // ═══════════════════════════════
  let missingHTML='';
  if(missing.length>0){
    const previewNames=missing.slice(0,3).map(c=>c.property||c.tenant||'-').join(', ')+(missing.length>3?` และอีก ${missing.length-3} รายการ`:'');
    missingHTML=`<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:11px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px">
      <span style="font-size:22px;flex-shrink:0">📋</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;color:#92400e">${missing.length} สัญญายังไม่มีใบแจ้งหนี้เดือนนี้</div>
        <div style="font-size:11px;color:#b45309;margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(previewNames)}</div>
      </div>
      <button onclick="confirmGenerateAllInvoices(invoiceMonth)" style="flex-shrink:0;padding:6px 14px;background:#f59e0b;color:#fff;border:none;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;font-family:Sarabun">สร้างทันที</button>
    </div>`;
  }

  // ═══════════════════════════════
  //  E. SORTABLE TABLE
  // ═══════════════════════════════
  // Sort header helper
  function sth(col,label,align){
    align=align||'left';
    const active=invSort===col;
    const arrow=active?(invSortDir==='asc'?'▲':'▼'):'⇅';
    return `<th onclick="if(invSort==='${col}'){invSortDir=invSortDir==='asc'?'desc':'asc';}else{invSort='${col}';invSortDir='asc';}renderInvoicePage()"
      title="${active?('เรียงตาม '+label+' — '+(invSortDir==='asc'?'น้อย→มาก':'มาก→น้อย')+' (คลิกเพื่อสลับ)'):'คลิกเพื่อเรียงตาม '+label}"
      style="padding:9px 10px;text-align:${align};font-weight:${active?800:600};color:${active?'#4338ca':'#64748b'};cursor:pointer;user-select:none;white-space:nowrap;background:${active?'#e0e7ff':'#f8fafc'};border-bottom:3px solid ${active?'#4338ca':'#e5e7eb'};transition:all .1s;position:relative">
      ${label}&nbsp;<span style="font-size:${active?11:10}px;opacity:${active?1:.35};font-weight:900">${arrow}</span></th>`;
  }

  // ── Pagination ──
  const totalInvCount=invoices.length;
  const totalPages=Math.max(1,Math.ceil(totalInvCount/INV_PER_PAGE));
  if(invPage>totalPages)invPage=totalPages;
  if(invPage<1)invPage=1;
  const pageStart=(invPage-1)*INV_PER_PAGE;
  const pagedInvoices=invoices.slice(pageStart,pageStart+INV_PER_PAGE);

  // ── Cache visible IDs สำหรับ batch ops ──
  _invVisibleIds=invoices.map(i=>i.id);
  const _batchVisible=_invVisibleIds.filter(id=>invBatchSelect.has(id));
  const _allChecked=_invVisibleIds.length>0&&_invVisibleIds.every(id=>invBatchSelect.has(id));
  const _someChecked=_batchVisible.length>0;

  let tableHTML='';
  if(invoices.length===0){
    tableHTML=`<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;text-align:center;padding:48px 20px;color:#64748b">
      <div style="font-size:48px;margin-bottom:12px">📄</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px">${invSearch?'ไม่พบ "'+esc(invSearch)+'"':'ยังไม่มีใบแจ้งหนี้'}</div>
      <div style="font-size:12px">${invSearch?'ลองค้นหาคำอื่น หรือ <a onclick="invSearch=\'\';renderInvoicePage()" style="color:#6366f1;cursor:pointer;text-decoration:underline">ล้างการค้นหา</a>':'กดปุ่ม "สร้างทั้งหมด" เพื่อสร้างอัตโนมัติ'}</div>
    </div>`;
  } else {
    const rows=pagedInvoices.map(inv=>{
      const ds=getDisplayStatus(inv);
      const daysOver=getDaysOverdue(inv);
      const stC={draft:'#64748b',sent:'#0ea5e9',paid:'#059669',partial:'#d97706',overdue:'#dc2626',voided:'#64748b'}[ds]||'#64748b';
      const stL={draft:'แบบร่าง',sent:'ส่งแล้ว',paid:'ชำระแล้ว',partial:'บางส่วน',overdue:'เกิน'+(daysOver>0?' '+daysOver+'ว':''),voided:'ยกเลิก'}[ds]||ds;
      const rowBg=ds==='overdue'?(daysOver>30?'#fff1f2':daysOver>7?'#fff5f5':'#fffbeb'):'';
      const hoverBg=inv.status==='paid'?'#f0fdf4':ds==='overdue'?'#ffe4e6':'#f0f4ff';
      const fType=inv.freqType||(()=>{const cc=DB.contracts.find(x=>x.id===inv.cid);return cc?payFreq(cc.rate,cc.payment).type:'monthly';})();
      const fBadge={monthly:{bg:'#dbeafe',color:'#1e40af',label:'รายเดือน'},quarterly:{bg:'#fef3c7',color:'#92400e',label:'รายไตรมาส'},semi:{bg:'#fce7f3',color:'#9d174d',label:'ราย 6 ด.'},yearly:{bg:'#fee2e2',color:'#991b1b',label:'⚠ รายปี'},lump:{bg:'#f1f5f9',color:'#475569',label:'ครั้งเดียว'}}[fType]||{bg:'#dbeafe',color:'#1e40af',label:'รายเดือน'};
      // Landlord name lookup — fallback: header → contract landlord → '—'
      const _hdr=(DB.invoiceHeaders||[]).find(x=>x.id==inv.headerId);
      const _cForLL=DB.contracts.find(x=>x.id==inv.cid);
      const _rawLandlord=shortLandlordName((_hdr?.companyName||_hdr?.name||'')||(_cForLL?.landlord||'')||(inv.landlord||''));
      const landlordLabel=_rawLandlord?(_rawLandlord.length>14?_rawLandlord.substring(0,14)+'…':_rawLandlord):'—';
      const isPaid=inv.status==='paid';
      const isVoided=inv.status==='voided';
      const isPartial=inv.status==='partial';
      const isDraft=inv.status==='draft';
      const canPay=!isPaid&&!isVoided;
      const remaining=inv.remainingAmount!=null?inv.remainingAmount:(isPaid?0:inv.total||0);
      const tDebt=tenantDebts[inv.tenant||'']||0;
      const tHasMore=canPay&&tDebt>remaining+1;
      // Follow-up badge
      const fuDate=inv.followUpDate||'';
      const fuHTML=fuDate
        ?`<div style="margin-top:3px"><span onclick="event.stopPropagation();openFollowUpModal(${inv.id})" style="font-size:9px;padding:2px 6px;border-radius:4px;background:#e0e7ff;color:#4338ca;cursor:pointer;font-weight:600" title="${esc(inv.followUpNote)||''}">📅 ${esc(fuDate)}</span></div>`
        :`<div style="margin-top:3px"><span onclick="event.stopPropagation();openFollowUpModal(${inv.id})" style="font-size:9px;padding:1px 6px;border-radius:4px;background:#f1f5f9;color:#64748b;cursor:pointer" title="ตั้งวันนัดชำระ">+ นัดชำระ</span></div>`;

      return `<tr onclick="viewInvoiceDetail(${inv.id})"
        style="border-top:1px solid #f1f5f9;${rowBg?'background:'+rowBg+';':''}cursor:pointer;transition:background .12s"
        onmouseover="this.style.background='${hoverBg}'" onmouseout="this.style.background='${rowBg}'">
        <td style="padding:6px 8px;width:32px;text-align:center;box-shadow:inset 4px 0 0 ${stC}" onclick="event.stopPropagation()" title="${stL}">
          <input type="checkbox" ${invBatchSelect.has(inv.id)?'checked':''} onclick="handleInvCheck(event,${inv.id})" style="width:14px;height:14px;cursor:pointer;accent-color:#6366f1">
        </td>
        <td style="padding:8px 10px">
          <div style="font-weight:600;color:#1e293b;font-size:12px">${esc(inv.invoiceNo)||'-'}${inv.settledByDeposit?'<span style="margin-left:4px;font-size:9px;font-weight:600;color:#059669;background:#dcfce7;padding:1px 5px;border-radius:99px" title="ชำระโดยหักจากเงินประกัน">🏦 หักประกัน</span>':''}</div>
          ${fType!=='monthly'?`<span style="font-size:9px;font-weight:600;color:${fBadge.color};background:${fBadge.bg};padding:1px 5px;border-radius:99px;white-space:nowrap">${fBadge.label}</span>`:''}
        </td>
        <td style="padding:8px 10px;color:#475569;font-size:12px;max-width:220px"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(inv.property||'')}">${esc(inv.property)||'-'}</div></td>
        <td style="padding:8px 10px;font-size:12px;max-width:160px"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#475569" title="${esc(inv.tenant||'')}">${esc(inv.tenant)||'-'}</div></td>
        <td style="padding:8px 10px;font-size:11px;color:#6366f1;white-space:nowrap">
          ${_hdr?.logo?`<img src="${esc(_hdr.logo)}" style="width:14px;height:14px;object-fit:contain;border-radius:2px;vertical-align:middle;margin-right:3px">`:''}${esc(landlordLabel)}
        </td>
        <td style="padding:8px 10px;font-size:11px;color:${daysOver>0&&!isPaid?'#dc2626':'#64748b'};white-space:nowrap">
          <div>${esc(inv.dueDate)||'-'}</div>
          ${daysOver>0&&!isPaid?`<div style="font-size:9px;color:#dc2626;font-weight:700">เกิน ${daysOver} วัน</div>`:''}
        </td>
        <td style="padding:8px 10px;text-align:right;font-weight:600;font-size:13px;color:${ds==='overdue'||fType==='yearly'?'#dc2626':'#1e293b'}">
          <div>${fmtBaht(inv.total||0,{sym:0})}${fType==='yearly'?' <span style="font-size:9px;color:#dc2626">ปี</span>':''}</div>
          ${isPartial?`<div style="font-size:10px;color:#d97706">ค้าง ${fmtBaht(remaining,{sym:0})}</div>`:''}
          ${tHasMore?`<div style="display:inline-block;margin-top:2px;font-size:9px;color:#dc2626;font-weight:700;background:#fee2e2;padding:1px 5px;border-radius:99px" title="ผู้เช่ารายนี้มียอดค้างรวมหลายใบ">⚠ รวม ${fmtBaht(tDebt,{sym:0})}฿</div>`:''}
        </td>
        <td style="padding:8px 10px;text-align:center">
          <span style="font-size:10px;font-weight:700;color:${stC};background:${stC}18;padding:3px 8px;border-radius:99px;white-space:nowrap">${stL}</span>
          ${fuHTML}
        </td>
        <td style="padding:6px 8px;text-align:center;white-space:nowrap" onclick="event.stopPropagation()">
          ${isDraft?`<button class="inv-action-send" onclick="markInvoiceSent(${inv.id})" title="คลิกเพื่อบันทึกว่าใบนี้ส่งให้ผู้เช่าแล้ว">📤 บันทึกส่ง</button>`
            :canPay?`<button onclick="openReceivePaymentModal(${inv.id})" style="padding:6px 12px;border:none;background:${ds==='overdue'?'#dc2626':'#059669'};color:#fff;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:Sarabun;min-height:32px;min-width:88px">💰 ${isPartial?'รับเพิ่ม':'รับเงิน'}</button>`
            :isPaid?`<button onclick="printReceipt(${inv.id})" style="padding:6px 12px;border:none;background:#dcfce7;color:#15803d;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:Sarabun;min-height:32px;min-width:88px">🧾 ใบเสร็จ</button>`
            :`<button onclick="viewInvoiceDetail(${inv.id})" style="padding:6px 12px;border:none;background:#f1f5f9;color:#64748b;border-radius:6px;font-size:11px;cursor:pointer;font-family:Sarabun;min-height:32px">ℹ️ ดู</button>`}
        </td>
      </tr>`;
    }).join('');

    const totalShown=invoices.reduce((s,i)=>s+(i.total||0),0);
    // ── คำนวณ subset counts สำหรับ batch actions ──
    const batchInvObjs=_batchVisible.map(id=>(DB.invoices||[]).find(x=>x.id===id)).filter(Boolean);
    const batchSelAmt=batchInvObjs.reduce((s,iv)=>s+(iv.total||0),0);
    const batchDraftIds=batchInvObjs.filter(iv=>iv.status==='draft').map(iv=>iv.id);
    const batchCanPayIds=batchInvObjs.filter(iv=>iv.status!=='paid'&&iv.status!=='voided').map(iv=>iv.id);
    const batchPaidIds=batchInvObjs.filter(iv=>iv.status==='paid').map(iv=>iv.id);

    // helper: separator
    const sep=`<div style="width:1px;height:16px;background:#c7d2fe;flex-shrink:0;margin:0 2px"></div>`;
    // helper: btn
    const bb=(label,onclick,bg,color)=>`<button onclick="${onclick}" style="flex-shrink:0;padding:4px 10px;background:${bg};color:${color};border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:Sarabun;white-space:nowrap">${label}</button>`;

    // ── Batch action bar — single line ──
    const batchBarHTML=_someChecked
      ?`<div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:7px 12px;margin-bottom:10px;display:flex;align-items:center;gap:6px;overflow-x:auto;white-space:nowrap;min-height:36px">
          <span style="font-size:12px;font-weight:700;color:#4338ca;flex-shrink:0">✓ ${_batchVisible.length} ใบ · ${fmtBaht(batchSelAmt,{sym:0})} ฿</span>
          ${sep}
          ${batchDraftIds.length>0?bb(`📤 บันทึกส่ง (${batchDraftIds.length})`,`batchMarkSent([${batchDraftIds.join(',')}])`,'#0ea5e9','#fff'):''}
          ${batchCanPayIds.length>0?bb(`💰 รับเงิน (${batchCanPayIds.length})`,`batchMarkPaid([${batchCanPayIds.join(',')}])`,'#059669','#fff'):''}
          ${sep}
          ${bb('🖨️ Invoice','batchPrintInvoices(false)','#6366f1','#fff')}
          ${batchPaidIds.length>0?bb(`🧾 Receipt (${batchPaidIds.length})`,`batchPrintReceipts([${batchPaidIds.join(',')}])`,'#10b981','#fff'):''}
          ${sep}
          ${bb('✕','invBatchSelect.clear();renderInvoicePage()','#f1f5f9','#64748b')}
        </div>`
      :'';

    tableHTML=`${batchBarHTML}<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <thead><tr>
          <th style="padding:9px 10px;background:#f8fafc;border-bottom:2px solid #e5e7eb;width:32px;text-align:center">
            <input type="checkbox" ${_allChecked?'checked':''} onclick="handleInvAllCheck(this.checked)" style="width:14px;height:14px;cursor:pointer;accent-color:#6366f1" title="${_allChecked?'ยกเลิกทั้งหมด':'เลือกทั้งหมด'}">
          </th>
          ${sth('invoiceNo','เลขที่ / ความถี่')}
          ${sth('property','ทรัพย์สิน')}
          ${sth('tenant','ผู้เช่า')}
          ${sth('landlord','ผู้ให้เช่า')}
          ${sth('dueDate','กำหนดชำระ')}
          ${sth('total','ยอด','right')}
          ${sth('status','สถานะ / นัดชำระ','center')}
          <th style="padding:9px 10px;text-align:center;font-weight:600;color:#64748b;background:#f8fafc;border-bottom:2px solid #e5e7eb;white-space:nowrap">การดำเนินการ</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="padding:8px 14px;background:#f8fafc;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#64748b">
        <span>แสดง <b style="color:#475569">${pageStart+1}-${Math.min(pageStart+INV_PER_PAGE,totalInvCount)}</b> จาก <b style="color:#475569">${totalInvCount}</b> รายการ${invSearch?' · ค้นหา "'+esc(invSearch)+'"':''}</span>
        ${totalPages>1?`<div style="display:flex;align-items:center;gap:4px">
          <button onclick="invPage=1;renderInvoicePage()" ${invPage<=1?'disabled':''} style="padding:3px 8px;border:1px solid #e5e7eb;border-radius:5px;background:${invPage<=1?'#f8fafc':'#fff'};color:${invPage<=1?'#cbd5e1':'#475569'};font-size:11px;cursor:${invPage<=1?'default':'pointer'};font-family:Sarabun">«</button>
          <button onclick="invPage--;renderInvoicePage()" ${invPage<=1?'disabled':''} style="padding:3px 8px;border:1px solid #e5e7eb;border-radius:5px;background:${invPage<=1?'#f8fafc':'#fff'};color:${invPage<=1?'#cbd5e1':'#475569'};font-size:11px;cursor:${invPage<=1?'default':'pointer'};font-family:Sarabun">‹</button>
          <span style="padding:3px 10px;font-weight:700;color:#4338ca;background:#eef2ff;border-radius:5px">${invPage} / ${totalPages}</span>
          <button onclick="invPage++;renderInvoicePage()" ${invPage>=totalPages?'disabled':''} style="padding:3px 8px;border:1px solid #e5e7eb;border-radius:5px;background:${invPage>=totalPages?'#f8fafc':'#fff'};color:${invPage>=totalPages?'#cbd5e1':'#475569'};font-size:11px;cursor:${invPage>=totalPages?'default':'pointer'};font-family:Sarabun">›</button>
          <button onclick="invPage=${totalPages};renderInvoicePage()" ${invPage>=totalPages?'disabled':''} style="padding:3px 8px;border:1px solid #e5e7eb;border-radius:5px;background:${invPage>=totalPages?'#f8fafc':'#fff'};color:${invPage>=totalPages?'#cbd5e1':'#475569'};font-size:11px;cursor:${invPage>=totalPages?'default':'pointer'};font-family:Sarabun">»</button>
        </div>`:''}
        <span>ยอดรวม <b style="color:#1e293b">${fmtBaht(totalShown,{sym:0})} บาท</b></span>
      </div>
    </div>`;
  }

  // ═══════════════════════════════
  //  F. FINAL LAYOUT — Phase 6 ERP 2-column
  //     Row 1: tabs (navigation)
  //     Row 2: toolbar (actions)
  //     Row 3: chip strip (filter)
  //     Row 4: [main table + KPI sidebar] side-by-side
  // ═══════════════════════════════
  $('content').innerHTML=`${tabHTML}${topBarHTML}<div class="inv-layout"><div class="inv-main">${missingHTML}${tableHTML}</div>${kpiSidebarHTML}</div>`;
}

function renderReceiptListPage(tabHTML){
  _buildInvLookups();
  const months2=[];
  const d3=new Date();
  for(let i=0;i<12;i++){const m=new Date(d3.getFullYear(),d3.getMonth()-i,1);months2.push(`${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,'0')}`);}
  const thMo2=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

  // ── 1. Base set: paid invoices this month ──
  const basePaid=(DB.invoices||[]).filter(i=>i.status==='paid'&&i.month===invoiceMonth);

  // ── 2. Landlord filter ──
  const _rfids=_llFilterIds();
  let paidInvoices=_rfids?basePaid.filter(i=>_rfids.includes(String(i.headerId))):[...basePaid];

  // ── 3. Search filter ──
  const rsq=(rcpSearch||'').toLowerCase().trim();
  if(rsq) paidInvoices=paidInvoices.filter(i=>
    (i.invoiceNo||'').toLowerCase().includes(rsq)||
    (i.receiptNo||'').toLowerCase().includes(rsq)||
    (i.property||'').toLowerCase().includes(rsq)||
    (i.tenant||'').toLowerCase().includes(rsq)||
    (i.landlord||'').toLowerCase().includes(rsq)
  );

  // ── 4. Sort ──
  paidInvoices.sort((a,b)=>{
    let r=0;
    if(rcpSort==='property')     r=(a.property||'').localeCompare(b.property||'','th');
    else if(rcpSort==='tenant')  r=(a.tenant||'').localeCompare(b.tenant||'','th');
    else if(rcpSort==='total')   r=(a.total||0)-(b.total||0);
    else if(rcpSort==='paidAt')  r=(a.paidAt||'').localeCompare(b.paidAt||'');
    else if(rcpSort==='landlord'){
      const _ha=(DB.invoiceHeaders||[]).find(x=>x.id==a.headerId);
      const _hb=(DB.invoiceHeaders||[]).find(x=>x.id==b.headerId);
      r=(_ha?.companyName||'').localeCompare(_hb?.companyName||'','th');
    }
    else r=(a.invoiceNo||'').localeCompare(b.invoiceNo||'');
    return rcpSortDir==='asc'?r:-r;
  });

  // ── 5. KPI (landlord-filtered, pre-search) ──
  const kpiBase=_rfids?basePaid.filter(i=>_rfids.includes(String(i.headerId))):[...basePaid];
  const kpiTotal=kpiBase.reduce((s,i)=>s+(i.total||0),0);
  const kpiCount=kpiBase.length;
  const kpiAvg=kpiCount>0?Math.round(kpiTotal/kpiCount):0;
  const curYear=new Date().getFullYear()+'';
  const kpiYTD=(DB.invoices||[]).filter(i=>i.status==='paid'&&(!_rfids||_rfids.includes(String(i.headerId)))&&(i.month||'').startsWith(curYear)).reduce((s,i)=>s+(i.total||0),0);

  // ── 6. Landlord Tabs ──
  const llSelectOptsRcp=buildLandlordSelectHTML(basePaid,null,'rcp');

  // ── 7. KPI Cards ──
  const kpiHTML=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 14px">
      <div style="font-size:10px;font-weight:600;color:#15803d;margin-bottom:4px">✅ รับแล้วเดือนนี้</div>
      <div style="font-size:19px;font-weight:800;color:#059669;line-height:1">${fmtBaht(kpiTotal,{sym:0})}</div>
      <div style="font-size:10px;color:#15803d;margin-top:3px">${kpiCount} ใบเสร็จ</div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px">
      <div style="font-size:10px;font-weight:600;color:#64748b;margin-bottom:4px">📊 เฉลี่ยต่อใบ</div>
      <div style="font-size:19px;font-weight:800;color:#1e293b;line-height:1">${fmtBaht(kpiAvg,{sym:0})}</div>
      <div style="font-size:10px;color:#64748b;margin-top:3px">บาท/ใบ</div>
    </div>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 14px">
      <div style="font-size:10px;font-weight:600;color:#1d4ed8;margin-bottom:4px">📅 รับแล้วปีนี้ (YTD)</div>
      <div style="font-size:19px;font-weight:800;color:#1d4ed8;line-height:1">${fmtBaht(kpiYTD,{sym:0})}</div>
      <div style="font-size:10px;color:#3b82f6;margin-top:3px">บาท</div>
    </div>
  </div>`;

  // ── 8. Sort header helper ──
  function rsth(col,label,align){
    align=align||'left';
    const active=rcpSort===col;
    const arrow=active?(rcpSortDir==='asc'?'↑':'↓'):'⇅';
    return `<th onclick="if(rcpSort==='${col}'){rcpSortDir=rcpSortDir==='asc'?'desc':'asc';}else{rcpSort='${col}';rcpSortDir='asc';}rcpPage=1;renderInvoicePage()"
      style="padding:9px 10px;text-align:${align};font-weight:600;color:${active?'#10b981':'#64748b'};cursor:pointer;user-select:none;white-space:nowrap;background:${active?'#ecfdf5':'#f8fafc'};border-bottom:2px solid ${active?'#10b981':'#e5e7eb'};transition:all .1s">
      ${label}&nbsp;<span style="font-size:10px;opacity:${active?1:.4}">${arrow}</span></th>`;
  }

  // ── 9. Pagination ──
  const totalRcpCount=paidInvoices.length;
  const totalRcpPages=Math.max(1,Math.ceil(totalRcpCount/RCP_PER_PAGE));
  if(rcpPage>totalRcpPages)rcpPage=totalRcpPages;
  if(rcpPage<1)rcpPage=1;
  const rcpStart=(rcpPage-1)*RCP_PER_PAGE;
  const pagedReceipts=paidInvoices.slice(rcpStart,rcpStart+RCP_PER_PAGE);
  const allPaidIds=paidInvoices.map(i=>i.id);

  // ── 10. Top bar ──
  const topHTML=`<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;align-items:center">
    <select onchange="invoiceMonth=this.value;rcpPage=1;renderInvoicePage()" style="padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:Sarabun">
      ${months2.map(m=>{const[y,mo]=m.split('-');return'<option value="'+m+'" '+(m===invoiceMonth?'selected':'')+'>'+thMo2[parseInt(mo)-1]+' '+(parseInt(y)+543)+'</option>';}).join('')}
    </select>
    ${llSelectOptsRcp?`<select onchange="invLandlordFilter=this.value;invPage=1;rcpPage=1;renderInvoicePage()" style="padding:8px 12px;border:${invLandlordFilter!=='all'?'2px solid #10b981':'1px solid #e5e7eb'};border-radius:8px;font-size:13px;font-family:Sarabun;background:${invLandlordFilter!=='all'?'#ecfdf5':'#fff'};color:#1e293b">
      <option value="all"${invLandlordFilter==='all'?' selected':''}>🏘️ ผู้ให้เช่า — ทั้งหมด</option>
      ${llSelectOptsRcp}
    </select>`:''}
    <div style="position:relative;flex:1;min-width:180px;max-width:280px">
      <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:#64748b;font-size:14px;pointer-events:none">🔍</span>
      <input type="text" id="rcpSearchInput" placeholder="ค้นหาใบเสร็จ..." value="${(rcpSearch||'').replace(/"/g,'&quot;')}"
        oninput="_invSearchInput(this,'rcp')"
        style="width:100%;padding:8px 32px 8px 32px;border:${rcpSearch?'2px solid #10b981':'1px solid #e5e7eb'};border-radius:8px;font-size:12px;font-family:Sarabun;background:${rcpSearch?'#ecfdf5':'#fff'};box-sizing:border-box">
      ${rcpSearch?`<button onclick="rcpSearch='';renderInvoicePage()" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#64748b;font-size:13px;padding:2px">✕</button>`:''}
    </div>
    ${paidInvoices.length>0?`
      <button onclick="batchPrintReceipts([${allPaidIds.join(',')}])" style="padding:8px 12px;background:#dcfce7;color:#15803d;border:1px solid #86efac;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;font-family:Sarabun">🧾 พิมพ์ทั้งหมด ${paidInvoices.length} ใบ</button>
      <button onclick="exportExcelReceipts()" style="padding:8px 12px;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;font-family:Sarabun">📥 Excel</button>`
    :''}
  </div>`;

  // ── 11. Table ──
  let listHTML='';
  if(paidInvoices.length===0){
    listHTML=`<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;text-align:center;padding:48px 20px;color:#64748b">
      <div style="font-size:48px;margin-bottom:12px">🧾</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px">${rsq?'ไม่พบ "'+rsq+'"':'ยังไม่มีใบเสร็จเดือนนี้'}</div>
      <div style="font-size:12px">${rsq?'<a onclick="rcpSearch=\'\';renderInvoicePage()" style="color:#10b981;cursor:pointer;text-decoration:underline">ล้างการค้นหา</a>':'เมื่อทำเครื่องหมาย "ชำระแล้ว" ในแท็บใบแจ้งหนี้ จะแสดงที่นี่'}</div>
    </div>`;
  } else {
    const totalAmt=paidInvoices.reduce((s,i)=>s+(i.total||0),0);
    const rows=pagedReceipts.map(inv=>{
      const paidDate=inv.paidAt?new Date(inv.paidAt):null;
      const paidDateStr=paidDate?dateToBE(paidDate):'-';
      const _hdr=(DB.invoiceHeaders||[]).find(x=>x.id==inv.headerId);
      const landlordFull=shortLandlordName(_hdr?.companyName||_hdr?.name||inv.landlord||'—');
      const landlordShort=landlordFull.length>14?landlordFull.substring(0,14)+'…':landlordFull;
      return `<tr onclick="printReceipt(${inv.id})" style="border-top:1px solid #f1f5f9;cursor:pointer;transition:background .15s" onmouseover="this.style.background='#f0fdf4'" onmouseout="this.style.background=''">
        <td style="padding:8px 12px;font-weight:700;color:#15803d;font-size:12px">${esc(inv.receiptNo||inv.invoiceNo?.replace('INV','REC'))||'-'}</td>
        <td style="padding:8px;color:#64748b;font-size:11px">${esc(inv.invoiceNo)||'-'}</td>
        <td style="padding:8px;color:#475569;font-size:12px">${esc(inv.property)||'-'}</td>
        <td style="padding:8px;color:#475569;font-size:12px">${esc(inv.tenant)||'-'}</td>
        <td style="padding:8px;font-size:11px;color:#6366f1">
          ${_hdr?.logo?`<img src="${esc(_hdr.logo)}" style="width:14px;height:14px;object-fit:contain;border-radius:2px;vertical-align:middle;margin-right:3px">`:''}${esc(landlordShort)}
        </td>
        <td style="padding:8px;text-align:right;font-weight:600;font-size:13px;color:#059669">${fmtBaht(inv.total||0,{sym:0})}</td>
        <td style="padding:8px;text-align:center;color:#059669;font-size:11px">${paidDateStr}</td>
        <td style="padding:8px;text-align:center" onclick="event.stopPropagation()">
          <div style="display:flex;gap:5px;justify-content:center">
            <button onclick="printReceipt(${inv.id})" title="พิมพ์ใบเสร็จ" style="padding:4px 8px;background:#dcfce7;color:#15803d;border:none;border-radius:6px;font-size:11px;cursor:pointer;font-family:Sarabun;font-weight:600">🧾</button>
            ${inv.slipImage?`<button onclick="viewSlipImage(${inv.id})" title="ดู Slip" style="padding:4px 8px;background:#dbeafe;color:#1e40af;border:none;border-radius:6px;font-size:11px;cursor:pointer;font-family:Sarabun">🖼️</button>`:''}
            <button onclick="viewReceiptDetail(${inv.id})" title="รายละเอียด" style="padding:4px 8px;background:#f1f5f9;color:#475569;border:none;border-radius:6px;font-size:11px;cursor:pointer;font-family:Sarabun">ℹ️</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    listHTML=`<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:12px;padding:10px 16px;background:#f0fdf4;border-bottom:1px solid #dcfce7">
        <span style="font-weight:700;font-size:14px;color:#15803d">🧾 ใบเสร็จ ${totalRcpCount} ใบ${rsq?' · ค้นหา "'+rsq+'"':''}</span>
        <span style="font-size:12px;font-weight:600;color:#059669;margin-left:auto">${fmtBaht(totalAmt,{sym:0})} บาท</span>
      </div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <thead><tr>
          ${rsth('invoiceNo','เลขที่ใบเสร็จ')}
          <th style="padding:9px 10px;text-align:left;font-weight:400;color:#64748b;background:#f8fafc;border-bottom:2px solid #e5e7eb;white-space:nowrap">ใบแจ้งหนี้</th>
          ${rsth('property','ทรัพย์สิน')}
          ${rsth('tenant','ผู้เช่า')}
          ${rsth('landlord','ผู้ให้เช่า')}
          ${rsth('total','จำนวนเงิน','right')}
          ${rsth('paidAt','วันที่ชำระ','center')}
          <th style="padding:9px 10px;text-align:center;font-weight:600;color:#64748b;background:#f8fafc;border-bottom:2px solid #e5e7eb;white-space:nowrap">Actions</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="padding:8px 14px;background:#f8fafc;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#64748b">
        <span>แสดง <b style="color:#475569">${rcpStart+1}-${Math.min(rcpStart+RCP_PER_PAGE,totalRcpCount)}</b> จาก <b style="color:#475569">${totalRcpCount}</b> ใบ</span>
        ${totalRcpPages>1?`<div style="display:flex;align-items:center;gap:4px">
          <button onclick="rcpPage=1;renderInvoicePage()" ${rcpPage<=1?'disabled':''} style="padding:3px 8px;border:1px solid #e5e7eb;border-radius:5px;background:${rcpPage<=1?'#f8fafc':'#fff'};color:${rcpPage<=1?'#cbd5e1':'#475569'};font-size:11px;cursor:${rcpPage<=1?'default':'pointer'};font-family:Sarabun">«</button>
          <button onclick="rcpPage--;renderInvoicePage()" ${rcpPage<=1?'disabled':''} style="padding:3px 8px;border:1px solid #e5e7eb;border-radius:5px;background:${rcpPage<=1?'#f8fafc':'#fff'};color:${rcpPage<=1?'#cbd5e1':'#475569'};font-size:11px;cursor:${rcpPage<=1?'default':'pointer'};font-family:Sarabun">‹</button>
          <span style="padding:3px 10px;font-weight:700;color:#10b981;background:#ecfdf5;border-radius:5px">${rcpPage} / ${totalRcpPages}</span>
          <button onclick="rcpPage++;renderInvoicePage()" ${rcpPage>=totalRcpPages?'disabled':''} style="padding:3px 8px;border:1px solid #e5e7eb;border-radius:5px;background:${rcpPage>=totalRcpPages?'#f8fafc':'#fff'};color:${rcpPage>=totalRcpPages?'#cbd5e1':'#475569'};font-size:11px;cursor:${rcpPage>=totalRcpPages?'default':'pointer'};font-family:Sarabun">›</button>
          <button onclick="rcpPage=${totalRcpPages};renderInvoicePage()" ${rcpPage>=totalRcpPages?'disabled':''} style="padding:3px 8px;border:1px solid #e5e7eb;border-radius:5px;background:${rcpPage>=totalRcpPages?'#f8fafc':'#fff'};color:${rcpPage>=totalRcpPages?'#cbd5e1':'#475569'};font-size:11px;cursor:${rcpPage>=totalRcpPages?'default':'pointer'};font-family:Sarabun">»</button>
        </div>`:''}
        <span>รวม <b style="color:#059669">${fmtBaht(totalAmt,{sym:0})} บาท</b></span>
      </div>
    </div>`;
  }

  $('content').innerHTML=`${tabHTML}${kpiHTML}${topHTML}${listHTML}`;
}

function viewReceiptDetail(invId){
  const inv=DB.invoices.find(x=>x.id===invId);
  if(!inv)return;
  const recNo=inv.receiptNo||(inv.invoiceNo?inv.invoiceNo.replace('INV','REC'):'REC-'+inv.id);
  $('mtitle').textContent='ใบเสร็จรับเงิน '+recNo;
  $('mbody').innerHTML=`
    <div>
      <div style="background:#f0fdf4;border:1px solid #dcfce7;border-radius:12px;padding:16px;margin-bottom:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:12px">
          <div><span style="font-size:11px;color:#059669;text-transform:uppercase;font-weight:600">เลขที่ใบเสร็จ</span><div style="font-size:16px;font-weight:700;color:#15803d;margin-top:4px">${esc(recNo)}</div><div style="font-size:10px;color:#64748b;margin-top:2px">ใบแจ้งหนี้: ${esc(inv.invoiceNo)||'-'}</div></div>
          <div><span style="font-size:11px;color:#059669;text-transform:uppercase;font-weight:600">จำนวนเงิน</span><div style="font-size:18px;font-weight:700;color:#15803d;margin-top:4px">${fmtBaht(inv.total||0,{sym:0})} บาท</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div><span style="font-size:11px;color:#059669;text-transform:uppercase;font-weight:600">ทรัพย์สิน</span><div style="font-size:14px;font-weight:600;color:#15803d;margin-top:4px">${esc(inv.property)||'-'}</div></div>
          <div><span style="font-size:11px;color:#059669;text-transform:uppercase;font-weight:600">ผู้เช่า</span><div style="font-size:14px;font-weight:600;color:#15803d;margin-top:4px">${esc(inv.tenant)||'-'}</div></div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="printReceipt(${inv.id})" style="padding:10px 16px;background:#dcfce7;color:#15803d;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">🧾 พิมพ์ใบเสร็จ</button>
        ${inv.slipImage?'<button onclick="viewSlipImage('+inv.id+')" style="padding:10px 16px;background:#dbeafe;color:#1e40af;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">🖼️ ดู slip</button>':''}
        <button onclick="viewInvoiceAudit(${inv.id})" style="padding:10px 16px;background:#f1f5f9;color:#475569;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">📋 ประวัติ</button>
      </div>
    </div>
  `;
  $('modal').classList.remove('hidden');
}

function printReceipt(invId){
  const inv=DB.invoices.find(x=>x.id===invId);
  if(!inv)return toast('ไม่พบใบแจ้งหนี้','error');
  verifyPIN(function(staff){
    inv.lastSignedBy=staff.name;
    inv.lastSignedAt=new Date().toISOString();
    save();
    const html=receiptHTML(inv,staff);
    openPrintOverlay(null,`${inv.category==='deposit'?'ใบรับเงินประกัน':'ใบเสร็จรับเงิน'} ${esc(inv.invoiceNo)}`,html);
    addInvoiceAudit(invId, 'receipt_printed', 'พิมพ์ใบเสร็จรับเงิน — ลงนามโดย '+staff.name);
  });
}

function receiptHTML(inv,staff){
  const today=new Date();
  const todayBE=dateToBE(today);
  const thMonths=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const staffName=staff?staff.name:'';
  const staffRole=staff?staff.role||'':'';
  const isDeposit=inv.category==='deposit';

  const c=DB.contracts.find(x=>x.id===inv.cid);
  const h=(DB.invoiceHeaders||[]).find(x=>x.id==inv.headerId)||(DB.invoiceHeaders||[])[0]||(c?{companyName:c.landlord||'',address:c.landlordAddr||'',bankName:c.bank||'',bankAccount:c.acctNo||'',bankAccountName:c.accountName||''}:{});
  const p=c?DB.properties.find(x=>x.pid===c.pid):null;
  const freq=inv.freqType||'monthly';
  const freqLbl=inv.freqLabel||{monthly:'รายเดือน',quarterly:'รายไตรมาส',semi:'ราย 6 เดือน',yearly:'รายปี',lump:'ครั้งเดียว'}[freq]||'รายเดือน';
  const [my,mm]=inv.month.split('-');
  const monthLabel=thMonths[parseInt(mm)-1]+' '+(parseInt(my)+543);
  const tenantAddr=c?.tenantAddr||'';
  const paidDate=inv.paidAt?new Date(inv.paidAt):new Date();
  const paidDateBE=dateToBE(paidDate);
  const recNo=inv.receiptNo||(inv.invoiceNo?inv.invoiceNo.replace('INV','REC'):'REC-'+inv.id);
  const landlordName=(h?.companyName||c?.landlord||inv.landlord||'').replace(/\s*โดย\s+.+$/,'');
  const landlordAddr=h?.address||c?.landlordAddr||'';
  const landlordPhone=h?.phone||'';
  const landlordTax=h?.taxId||'';
  const defaultNote=(DB.invoiceSettings?.defaultNote)||h?.notes||'';
  const finalNote=inv.note||defaultNote;
  // ── VAT compliance — ใช้ calcVat helper (Phase A) ──
  const _v=calcVat(inv,h);
  const isVat=isDeposit?false:_v.isVat, vatRate=_v.rate, subtotal=_v.subtotal, vatAmount=isDeposit?0:_v.vatAmount;
  const grossTotal=isDeposit?inv.total:_v.total;
  const tenantTaxId=c?.taxId||'';
  const taxInvoiceNo=inv.taxInvoiceNo||'';
  const docTitle=isDeposit?'ใบรับเงินประกันการเช่า':(isVat?'ใบเสร็จรับเงิน / ใบกำกับภาษี':'ใบเสร็จรับเงิน');
  const docTitleEn=isDeposit?'SECURITY DEPOSIT RECEIPT':(isVat?'RECEIPT / TAX INVOICE':'RECEIPT');
  const _invItems=inv.items&&inv.items.length?inv.items:(isDeposit?[{desc:freqLbl||'เงินประกัน',amount:inv.total||0}]:[]);

  function halfReceipt(copyLabel){
    const isCopy=copyLabel==='สำเนา';
    return `<div class="half ${isCopy?'copy-half':'top-half'}">
      ${isCopy?'<div class="copy-watermark">สำเนา / COPY</div>':''}
      <div class="half-content" style="display:flex;flex-direction:column;height:100%">

        <!-- ── Header: Title first ── -->
        <div style="display:flex;gap:12px;align-items:flex-start;padding-bottom:10px;border-bottom:3px solid #059669;margin-bottom:10px;flex-shrink:0">
          ${h?.logo?'<img src="'+esc(h.logo)+'" style="width:48px;height:48px;object-fit:contain;border-radius:6px;flex-shrink:0;border:1px solid #dcfce7">':''}
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
              <span style="font-size:${isVat?18:24}px;font-weight:800;color:#059669;letter-spacing:.5px;line-height:1.1">${docTitle}</span>
              <span style="font-size:10px;color:#64748b;font-weight:400">${docTitleEn}</span>
            </div>
            ${landlordName?'<div style="font-size:12px;font-weight:700;color:#1e293b;margin-top:4px">'+esc(landlordName)+'</div>':''}
            ${landlordAddr?'<div style="font-size:9px;color:#64748b;line-height:1.5;margin-top:1px">'+esc(landlordAddr)+'</div>':''}
            ${(landlordPhone||landlordTax)?'<div style="font-size:9px;color:#64748b;margin-top:1px">'+(landlordPhone?'โทร '+esc(landlordPhone):'')+(landlordPhone&&landlordTax?' &nbsp;·&nbsp; ':'')+(landlordTax?'เลขผู้เสียภาษี '+esc(landlordTax):'')+'</div>':''}
          </div>
          <div style="flex-shrink:0;text-align:right">
            <span style="display:inline-block;font-size:9px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:5px;padding:3px 10px;color:#059669;font-weight:600">${copyLabel}</span>
            ${isVat&&taxInvoiceNo?'<div style="font-size:8px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:5px;padding:3px 8px;margin-top:4px;font-weight:700">เลขใบกำกับภาษี<br>'+esc(taxInvoiceNo)+'</div>':''}
          </div>
        </div>

        <!-- ── Meta grid ── -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);border-radius:8px;overflow:hidden;margin-bottom:10px;border:1px solid #bbf7d0;flex-shrink:0">
          <div style="padding:8px 12px;background:#f0fdf4;border-right:1px solid #bbf7d0"><div style="font-size:8px;color:#059669;font-weight:600;letter-spacing:.4px;margin-bottom:4px">เลขที่ใบเสร็จ</div><div style="font-size:12px;font-weight:800;color:#065f46;line-height:1.2">${esc(recNo)}</div></div>
          <div style="padding:8px 12px;background:#f0fdf4;border-right:1px solid #bbf7d0"><div style="font-size:8px;color:#059669;font-weight:600;letter-spacing:.4px;margin-bottom:4px">อ้างอิงใบแจ้งหนี้</div><div style="font-size:12px;font-weight:700;color:#065f46">${esc(inv.invoiceNo)}</div></div>
          <div style="padding:8px 12px;background:#ecfdf5;border-right:1px solid #bbf7d0"><div style="font-size:8px;color:#059669;font-weight:600;letter-spacing:.4px;margin-bottom:4px">รอบบิล</div><div style="font-size:12px;font-weight:700;color:#065f46">${monthLabel}</div></div>
          <div style="padding:8px 12px;background:#ecfdf5"><div style="font-size:8px;color:#059669;font-weight:600;letter-spacing:.4px;margin-bottom:4px">วันที่ชำระ</div><div style="font-size:13px;font-weight:800;color:#065f46">${paidDateBE}</div></div>
        </div>

        <!-- ── Parties: Tenant + Property only ── -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div style="border:1px solid #bbf7d0;border-radius:6px;padding:9px 12px;background:#f0fdf4">
            <div style="font-size:7px;font-weight:700;color:#059669;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px">ได้รับเงินจาก / Received From</div>
            <div style="display:flex;align-items:flex-start;gap:7px">
              ${c?.tenantLogo?'<img src="'+esc(c.tenantLogo)+'" style="width:22px;height:22px;object-fit:contain;border-radius:3px;border:1px solid #bbf7d0;flex-shrink:0;margin-top:1px">':''}
              <div><div style="font-size:12px;font-weight:700;color:#1e293b;line-height:1.2">${esc(inv.tenant)}</div>${tenantAddr?'<div style="font-size:9px;color:#64748b;line-height:1.4;margin-top:3px">'+esc(tenantAddr)+'</div>':'<div style="font-size:9px;color:#dc2626;font-weight:600;margin-top:3px">⚠️ ไม่มีที่อยู่ผู้เช่า — แก้ในสัญญาก่อน</div>'}${tenantTaxId?'<div style="font-size:9px;color:#92400e;margin-top:2px;font-weight:600">เลขผู้เสียภาษี: '+esc(tenantTaxId)+'</div>':'<div style="font-size:9px;color:#dc2626;font-weight:600;margin-top:2px">⚠️ ไม่มีเลขผู้เสียภาษี — แก้ในสัญญาก่อน</div>'}</div>
            </div>
          </div>
          <div style="border:1px solid #bbf7d0;border-radius:6px;padding:9px 12px;background:#f0fdf4">
            <div style="font-size:7px;font-weight:700;color:#059669;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px">ทรัพย์สิน / Property</div>
            <div style="font-size:12px;font-weight:700;color:#1e293b;line-height:1.2">${esc(inv.property)||'—'}</div>
            ${c?.no?'<div style="font-size:9px;color:#64748b;margin-top:3px">สัญญา: '+esc(c.no)+'</div>':''}
            <div style="font-size:9px;color:#64748b;margin-top:2px">${freqLbl}</div>
          </div>
        </div>

        <!-- ── Items table ── -->
        <table style="width:100%;border-collapse:collapse;font-size:10.5px;border-radius:6px;overflow:hidden;border:1px solid #bbf7d0">
          <tr style="background:#f0fdf4;border-bottom:2px solid #059669">
            <th style="padding:7px 10px;text-align:left;font-size:8px;font-weight:700;color:#065f46;letter-spacing:.5px">รายการ</th>
            <th style="padding:7px 10px;text-align:right;font-size:8px;font-weight:700;color:#065f46;letter-spacing:.5px;width:120px">จำนวนเงิน (บาท)</th>
          </tr>
          ${_invItems.map((it,i)=>'<tr style="border-bottom:1px solid #f0fdf4"><td style="padding:7px 10px;color:#334155">'+(i+1)+'. '+esc(isDeposit?it.desc:enrichDesc(it,inv))+'</td><td style="padding:7px 10px;text-align:right;font-weight:600;color:#1e293b;font-variant-numeric:tabular-nums">'+fmtBaht(it.amount,{sym:0,dec:2})+'</td></tr>').join('')}
        </table>
        ${isVat?`<div style="display:flex;justify-content:flex-end;margin-top:6px;margin-bottom:6px">
          <table style="font-size:10px;border-collapse:collapse">
            <tr><td style="padding:2px 10px;text-align:right;color:#64748b">มูลค่าก่อนภาษี (Subtotal)</td><td style="padding:2px 10px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:#1e293b;min-width:110px">${fmtBaht(subtotal,{sym:0,dec:2})}</td></tr>
            <tr><td style="padding:2px 10px;text-align:right;color:#64748b">ภาษีมูลค่าเพิ่ม ${vatRate}% (VAT)</td><td style="padding:2px 10px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:#92400e;min-width:110px">${fmtBaht(vatAmount,{sym:0,dec:2})}</td></tr>
          </table>
        </div>`:''}
        <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
          <div style="background:#f0fdf4;color:#065f46;border:2px solid #059669;padding:8px 20px;border-radius:0 0 8px 8px;display:flex;align-items:center;gap:14px">
            <span style="font-size:10px;opacity:.7;font-weight:500">${isVat?'ยอดรวมสุทธิ (รวม VAT)':'ยอดรวมทั้งสิ้น'}</span>
            <span style="font-size:19px;font-weight:800;font-variant-numeric:tabular-nums">${fmtBaht(inv.total,{sym:0,dec:2})}</span>
            <span style="font-size:9px;opacity:.55">บาท</span>
          </div>
        </div>

${finalNote?'<div style="padding:6px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:8.5px;color:#92400e;margin-bottom:6px"><b>หมายเหตุ:</b> '+esc(finalNote.replace(/\n/g,' '))+'</div>':''}

        <!-- ── Signature ── -->
        <div style="margin-top:auto;padding-top:9px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-end">
          <div style="text-align:center;min-width:120px">
            ${staff?.signatureImg?'<img src="'+esc(staff.signatureImg)+'" style="height:44px;max-width:140px;object-fit:contain;display:block;margin:0 auto 4px">':'<div style="height:44px;border-bottom:1px dotted #64748b;width:120px;margin:0 auto 4px"></div>'}
            <div style="font-size:9px;font-weight:600;color:#059669">ผู้รับเงิน</div>
            ${staffName?'<div style="font-size:10px;font-weight:700;color:#1e293b;margin-top:1px">'+esc(staffName)+'</div><div style="font-size:8px;color:#64748b">'+esc(staffRole)+'</div>':'<div style="font-size:8px;color:#64748b;margin-top:1px">ลงนาม / วันที่</div>'}
          </div>
          <div style="font-size:8px;color:#64748b;text-align:center;line-height:1.6">${esc(landlordName)||''}<br>${esc(recNo)} · ${todayBE}</div>
          <div style="text-align:center;min-width:120px">
            <div style="height:44px;border-bottom:1px dotted #64748b;width:120px;margin:0 auto 4px"></div>
            <div style="font-size:9px;font-weight:600;color:#334155">ผู้ชำระเงิน</div>
            <div style="font-size:8px;color:#64748b;margin-top:1px">ลงนาม / วันที่</div>
          </div>
        </div>
      </div>
    </div>`;
  }

  let _rHtml=`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
${_INV_PRINT_CSS}
</style></head><body>
<div class="no-print" style="position:fixed;top:0;left:0;right:0;z-index:100;background:#059669;padding:8px 24px;display:flex;align-items:center;gap:16px;box-shadow:0 2px 12px rgba(0,0,0,.2)">
  <button onclick="window.print()" style="background:#fff;color:#059669;border:none;padding:8px 24px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">🖨️ พิมพ์ / PDF</button>
  ${staffName?'<span style="color:#fff;font-size:11px">✓ ลงนามโดย '+esc(staffName)+'</span>':''}
  <span style="color:rgba(255,255,255,.7);font-size:11px;margin-left:auto">ใบเสร็จรับเงิน — ${todayBE}</span>
</div>
<div style="height:48px" class="no-print"></div>
<div class="page">${halfReceipt('ต้นฉบับ')}${halfReceipt('สำเนา')}</div>
</body></html>`;
  if(isDeposit) _rHtml=_rHtml
    .replace(/#059669/g,'#0891b2').replace(/#f0fdf4/g,'#ecfeff')
    .replace(/#bbf7d0/g,'#a5f3fc').replace(/#065f46/g,'#164e63')
    .replace(/#ecfdf5/g,'#ecfeff').replace(/#a7f3d0/g,'#a5f3fc')
    .replace(/#dcfce7/g,'#cffafe')
    .replace(/ใบเสร็จรับเงิน — /g,'ใบรับเงินประกัน — ');
  return _rHtml;
}

function renderInvoiceAuditPage(tabHTML){
  const orphans=DB.invoiceAuditOrphan||[];
  // Also collect all recent audit events from existing invoices
  const allEvents=[];
  (DB.invoices||[]).forEach(inv=>{
    (inv.audit||[]).forEach(a=>{
      allEvents.push({...a, invoiceNo:inv.invoiceNo, invId:inv.id});
    });
  });
  orphans.forEach(o=>{
    // orphan records are flat {invId,ts,beDateStr,action,detail,snapshot} — not nested
    allEvents.push({ts:o.ts,beDateStr:o.beDateStr,action:o.action,detail:o.detail,snapshot:o.snapshot||null, invoiceNo:o.invoiceNo||('INV-'+o.invId), invId:o.invId, isDeleted:true});
  });
  // Sort by timestamp desc
  allEvents.sort((a,b)=>(b.ts||'').localeCompare(a.ts||''));
  const recent=allEvents.slice(0,100);

  const actionIcons={created:'📝',edited:'✏️',paid:'💰',deleted:'🗑️',voided:'🚫',printed:'🖨️',receipt_printed:'🧾',slip_attached:'📸',status_change:'🔄',unvoid:'♻️'};
  const actionBg={created:'#dcfce7',edited:'#fef3c7',paid:'#d1fae5',deleted:'#fee2e2',voided:'#fecaca',printed:'#e0e7ff',receipt_printed:'#ede9fe',slip_attached:'#dbeafe'};
  const actionText={created:'#166534',edited:'#92400e',paid:'#065f46',deleted:'#991b1b',voided:'#991b1b',printed:'#3730a3',receipt_printed:'#5b21b6',slip_attached:'#1e40af'};

  const sec=document.getElementById('content');
  sec.innerHTML=tabHTML+`
    <div style="padding:16px">
      <h3 style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:12px">📋 ประวัติการดำเนินการทั้งหมด</h3>
      <div style="font-size:12px;color:#64748b;margin-bottom:16px">แสดงรายการ 100 กิจกรรมล่าสุดเกี่ยวกับใบแจ้งหนี้และใบเสร็จ</div>
      ${recent.length===0?'<div style="text-align:center;padding:40px;color:#64748b">ยังไม่มีประวัติ</div>':
      `<div style="display:flex;flex-direction:column;gap:4px">
        ${recent.map(e=>`<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#fff;border:1px solid #f1f5f9;border-radius:8px;cursor:${e.isDeleted?'default':'pointer'}" ${e.isDeleted?'':`onclick="viewInvoiceAudit(${e.invId})"`}>
          <span style="font-size:16px;flex-shrink:0">${actionIcons[e.action]||'📋'}</span>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span style="font-size:12px;font-weight:600;color:#1e293b">${esc(e.invoiceNo)||''}</span>
              <span style="font-size:10px;padding:2px 8px;border-radius:4px;background:${actionBg[e.action]||'#f1f5f9'};color:${actionText[e.action]||'#475569'};font-weight:600">${e.action==='created'?'สร้าง':e.action==='edited'?'แก้ไข':e.action==='paid'?'ชำระ':e.action==='deleted'?'ลบ':e.action==='voided'?'ยกเลิก':e.action==='printed'?'พิมพ์':e.action==='receipt_printed'?'พิมพ์ใบเสร็จ':esc(e.action)}</span>
              ${e.isDeleted?'<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:#fee2e2;color:#991b1b;font-weight:600">ถูกลบแล้ว</span>':''}
            </div>
            <div style="font-size:11px;color:#64748b;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.detail)||''}</div>
          </div>
          <div style="font-size:10px;color:#64748b;flex-shrink:0;white-space:nowrap">${esc(e.beDateStr)||''}</div>
        </div>`).join('')}
      </div>`}
    </div>`;
}

function renderInvoiceSettingsPage(tabHTML){
  const headers = DB.invoiceHeaders || [];

  let settingsHTML = '';
  if(headers.length === 0){
    settingsHTML = `<div style="text-align:center;padding:40px;color:#64748b">
      <p style="font-size:48px;margin-bottom:12px">⚙️</p>
      <p>ยังไม่มีหัวบิล</p>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:16px">
        <button onclick="openStaffSettings()" style="padding:10px 20px;background:#f1f5f9;color:#475569;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">👤 จัดการพนักงาน</button>
        <button onclick="openInvoiceHeaderSettings()" style="padding:10px 20px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">+ เพิ่มหัวบิล</button>
      </div>
    </div>`;
  } else {
    settingsHTML = `<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px">
      <button onclick="openStaffSettings()" style="padding:8px 16px;background:#f1f5f9;color:#475569;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">👤 จัดการพนักงาน (${(DB.staff||[]).length})</button>
      <button onclick="openInvoiceHeaderSettings()" style="padding:8px 16px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">+ เพิ่ม/แก้ไขหัวบิล</button>
    </div>`;
    settingsHTML += headers.map(h => `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px;display:flex;gap:16px;align-items:center">
      ${h.logo?'<img src="'+esc(h.logo)+'" style="width:60px;height:60px;object-fit:contain;border-radius:8px;border:1px solid #e5e7eb">':'<div style="width:60px;height:60px;background:#f1f5f9;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:24px">🏢</div>'}
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;color:#1e293b;font-size:14px">${esc(shortLandlordName(h.companyName||h.name||'-'))}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">${esc(h.address)||''}</div>
        <div style="font-size:11px;color:#64748b">${h.phone?'Tel: '+esc(h.phone):''} ${h.taxId?'| Tax: '+esc(h.taxId):''}</div>
        ${h.bankName?'<div style="font-size:11px;color:#0369a1;margin-top:4px">🏦 '+esc(h.bankName)+' '+esc(h.bankAccount)+' ('+esc(h.bankAccountName)+')</div>':''}
        ${h.promptPayId?'<div style="margin-top:4px;font-size:10px;color:#059669;font-weight:600">⚡ PromptPay: '+esc(h.promptPayId)+(h.promptPayName?' · '+esc(h.promptPayName):'')+(h.promptPayBank?' ('+esc(h.promptPayBank)+')':'')+'</div>':(h.qrCode?'<div style="margin-top:6px"><img src="'+esc(h.qrCode)+'" style="width:48px;height:48px;border-radius:4px;border:1px solid #e5e7eb"></div>':'')}
        ${h.notes?'<div style="font-size:10px;color:#92400e;margin-top:4px;background:#fffbeb;padding:4px 8px;border-radius:4px">📝 '+esc(h.notes.substring(0,60))+(h.notes.length>60?'...':'')+'</div>':''}
      </div>
      ${h.id===DB.defaultInvHeader?'<span style="font-size:10px;background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:99px;font-weight:600">ค่าเริ่มต้น</span>':''}
    </div>`).join('');
  }

  $('content').innerHTML = `${tabHTML}${settingsHTML}`;
}


// ============================================================
// STATUS HELPERS
// ============================================================
// คำนวณ display status รวม overdue (ไม่แก้ inv.status จริง — render only)
function getDisplayStatus(inv){
  if(inv.status==='paid'||inv.status==='voided')return inv.status;
  if(inv.status==='partial')return 'partial';
  if(inv.dueDate){
    const p=inv.dueDate.split('/');
    if(p.length===3){
      const d=parseInt(p[0]),m=parseInt(p[1])-1,y=parseInt(p[2])-543;
      if(new Date()>new Date(y,m,d+1))return 'overdue';
    }
  }
  return inv.status||'draft';
}

// คำนวณจำนวนวันที่เลยกำหนดชำระ (0 = ยังไม่เกิน)
// ใช้ cutoff เดียวกับ getDisplayStatus: overdue = วันถัดจาก dueDate เป็นต้นไป
function getDaysOverdue(inv){
  if(!inv.dueDate)return 0;
  const p=inv.dueDate.split('/');
  if(p.length!==3)return 0;
  const d=parseInt(p[0]),m=parseInt(p[1])-1,y=parseInt(p[2])-543;
  // +1 เพื่อให้ตรงกับ getDisplayStatus (วัน dueDate เองยังไม่นับเป็น overdue)
  const diff=Math.floor((Date.now()-new Date(y,m,d+1).getTime())/864e5)+1;
  return Math.max(0,diff);
}

// Check if a contract is due for invoice in a given month based on payment frequency
function isInvoiceDue(c, month){
  const s=status(c);
  if(s==='cancelled'||s==='expired')return false;
  // Check contract period covers this month
  const [y,mo]=month.split('-');
  const monthStart=new Date(parseInt(y),parseInt(mo)-1,1);
  const monthEnd=new Date(parseInt(y),parseInt(mo),0);
  const cStart=parseBE(c.start), cEnd=parseBE(c.end);
  if(cStart && cStart>monthEnd) return false; // contract hasn't started
  if(cEnd && cEnd<monthStart) return false; // contract already ended

  const freq=payFreq(c.rate, c.payment);
  if(freq.type==='lump') return false; // one-time payment, no recurring invoice
  if(freq.type==='monthly') return true;

  // For non-monthly: check if this month aligns with the payment schedule
  const startMonth=cStart?cStart.getMonth():0; // 0-based
  const thisMonth=parseInt(mo)-1; // 0-based
  const monthsSinceStart=cStart?((parseInt(y)-cStart.getFullYear())*12+(thisMonth-startMonth)):thisMonth;

  if(freq.type==='quarterly') return monthsSinceStart>=0 && monthsSinceStart%3===0;
  if(freq.type==='semi') return monthsSinceStart>=0 && monthsSinceStart%6===0;
  if(freq.type==='yearly') return monthsSinceStart>=0 && monthsSinceStart%12===0;
  return true; // default: treat as monthly
}

// ========== VAT helper (Phase A) ==========
// Central VAT calculation — ใช้แทน pattern เดิมที่ inline ใน 6 ที่
// Mode:
//   'none'      → ไม่มี VAT. subtotal=total, vat=0
//   'inclusive' → total รวม VAT แล้ว. subtotal=total/(1+r), vat=total-subtotal
//   'exclusive' → total คือ base ไม่รวม VAT. subtotal=total, vat=total*r, gross=total+vat
// Resolution order: inv.vatMode → header.vatMode → (header.vatRegistered?'inclusive':'none')
// ใช้ gross = สิ่งที่ลูกค้าจ่ายจริง (inv.total ควรเก็บเป็น gross เสมอ — generateInvoice จัดการ)
function calcVat(inv, header){
  const h=header||null;
  // New per-line structure: items have vatable flag
  if(inv && Array.isArray(inv.items) && inv.items.some(it => 'vatable' in (it||{}))){
    const rate=parseFloat((inv&&inv.vatRate)||(h&&h.vatRate))||7;
    const subVat=inv.items.filter(it=>it.vatable).reduce((s,it)=>s+(parseFloat(it.amount)||0),0);
    const subNoVat=inv.items.filter(it=>!it.vatable).reduce((s,it)=>s+(parseFloat(it.amount)||0),0);
    const vatAmount=subVat*rate/100;
    return {
      isVat: subVat>0,
      mode: subVat>0 ? 'lineitem' : 'none',
      rate,
      subtotal: +(subNoVat+subVat).toFixed(2),       // before-VAT total (all lines)
      subtotalVatable: +subVat.toFixed(2),           // มูลค่าก่อนภาษี (vatable)
      subtotalNonVatable: +subNoVat.toFixed(2),      // มูลค่าไม่คิดภาษี
      vatAmount: +vatAmount.toFixed(2),
      total: +(subNoVat+subVat+vatAmount).toFixed(2)
    };
  }
  // Legacy fallback: invoice-level vatMode
  let mode=inv&&inv.vatMode;
  if(!mode){
    if(h&&h.vatMode) mode=h.vatMode;
    else if(h&&h.vatRegistered) mode='inclusive';
    else mode='none';
  }
  const rate=mode==='none'?0:(parseFloat((inv&&inv.vatRate)||(h&&h.vatRate))||7);
  const total=+(inv&&inv.total)||0;
  let subtotal, vatAmount;
  if(mode==='none'){
    subtotal=total; vatAmount=0;
  } else if(mode==='exclusive'){
    subtotal=total/(1+rate/100);
    vatAmount=total-subtotal;
  } else {
    subtotal=total/(1+rate/100);
    vatAmount=total-subtotal;
  }
  return {
    isVat: mode!=='none',
    mode,
    rate,
    subtotal: +subtotal.toFixed(2),
    subtotalVatable: mode!=='none' ? +subtotal.toFixed(2) : 0,
    subtotalNonVatable: mode==='none' ? +total.toFixed(2) : 0,
    vatAmount: +vatAmount.toFixed(2),
    total: +total.toFixed(2)
  };
}

// Get the actual invoice amount based on payment frequency.
// Logic: normalize rate → monthly, then multiply by periods in billing cycle.
// แก้ bug: rate="เดือนละ 10,000" + payment="ทุก 3 เดือน" → ต้องได้ 30,000 ไม่ใช่ 10,000
function invoiceAmount(c){
  if(!c||!c.rate)return 0;
  const freq=payFreq(c.rate, c.payment);
  // lump / ไม่แน่ใจ → คืนยอดดิบตาม rate
  if(freq.type==='lump') return amt(c.rate)||0;
  // ถ้า rate keyword ตรงกับ freq → ใช้ยอดดิบตรงๆ (ไม่ต้องคูณ)
  // เช่น rate="ไตรมาสละ 30,000" + freq=quarterly → 30,000
  //      rate="ปีละ 100,000" + freq=yearly → 100,000
  if(freq.type==='quarterly' && c.rate.includes('ไตรมาสละ')) return amt(c.rate)||0;
  if(freq.type==='yearly'    && c.rate.includes('ปีละ'))     return amt(c.rate)||0;
  if(freq.type==='monthly'   && c.rate.includes('เดือนละ'))  return amt(c.rate)||0;
  // ไม่ตรง → normalize ผ่าน monthly() แล้วคูณจำนวนเดือนใน cycle
  const m=monthly(c.rate);
  if(!m)return 0;
  const periods={monthly:1,quarterly:3,semi:6,yearly:12}[freq.type]||1;
  return m*periods;
}

// Wrapper: confirm before bulk generate (Phase 2 — UX)
function confirmGenerateAllInvoices(month){
  const activeContracts=DB.contracts.filter(c=>isInvoiceDue(c,month));
  if(activeContracts.length===0){toast('ไม่มีสัญญาที่ต้องออกใบแจ้งหนี้เดือนนี้','warning');return;}
  let _willCreate=0,_willSkip=0;
  activeContracts.forEach(c=>{
    const existing=DB.invoices.find(x=>x.cid===c.id&&x.month===month);
    if(existing)_willSkip++; else _willCreate++;
  });
  if(_willCreate===0){toast(`ทุกใบของเดือนนี้สร้างไว้แล้ว (${_willSkip} ใบ)`,'warning');return;}
  const [y,mo]=month.split('-');
  const thMonths=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const monthLabel=thMonths[parseInt(mo)-1]+' '+(parseInt(y)+543);
  const msg=`จะสร้างใบแจ้งหนี้ใหม่ ${_willCreate} ใบ สำหรับเดือน ${monthLabel}`+(_willSkip>0?` (ข้ามของเดิม ${_willSkip} ใบ)`:'');
  customConfirm('ยืนยันสร้างใบแจ้งหนี้ทั้งหมด',msg,function(){generateAllInvoices(month);},{icon:'📄',yesLabel:'สร้างเลย',yesColor:'#4f46e5'});
}

let _genAllLock=0;
function generateAllInvoices(month){
  // Guard: anti double-click — block ภายใน 3 วินาที
  if(_genAllLock&&(Date.now()-_genAllLock)<3000){return toast('กำลังประมวลผล... กรุณารอสักครู่','warning');}
  _genAllLock=Date.now();
  // หัวบิล: ใช้จาก DB.invoiceHeaders หรือ fallback จากข้อมูลผู้ให้เช่าใน contract (ดู invoiceHTML / receiptHTML)
  const activeContracts=DB.contracts.filter(c=>isInvoiceDue(c,month));
  if(activeContracts.length===0){_genAllLock=0;toast('ไม่มีสัญญาที่ต้องออกใบแจ้งหนี้เดือนนี้','warning');return;}

  let created=0, skipped=0;
  activeContracts.forEach(c=>{
    const existing=DB.invoices.find(x=>x.cid===c.id&&x.month===month);
    if(existing){skipped++;return;}
    generateInvoice(c.id,month);
    created++;
  });

  // ไม่ log ถ้าไม่มีอะไรสร้างใหม่ (กัน log spam)
  if(created>0)addActivityLog('generate_invoices',`สร้างใบแจ้งหนี้ ${month} — ${created} ใบ`+(skipped>0?` (ข้าม ${skipped} ซ้ำ)`:``));
  save();
  if(created===0&&skipped>0)toast(`ทุกใบของเดือนนี้สร้างไว้แล้ว (${skipped} ใบ)`,'warning');
  else toast(`สร้างใบแจ้งหนี้แล้ว ${created} ใบ`+(skipped>0?` (ข้าม ${skipped} ที่มีอยู่แล้ว)`:``));
  invoiceTab='invoices';
  renderInvoicePage();
  setTimeout(()=>{_genAllLock=0;},3000);
}

const _genInvLocks=new Map(); // key: cid+'_'+month → timestamp. Per-contract-month lock
                               // ไม่ใช้ global เพราะจะ block generateAllInvoices loop ที่วน contracts คนละตัว
function generateInvoice(cid,month){
  // Type guard — รับเฉพาะ "YYYY-MM" (Gregorian) เท่านั้น
  // กัน null/undefined/number → crash กลางทาง + invoice เลขเพี้ยน "INV-invalid-0001"
  if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)){
    console.warn('[generateInvoice] invalid month parameter:',month);
    if(typeof toast==='function') toast('เดือนไม่ถูกต้อง — ใช้ format YYYY-MM','error');
    return;
  }

  // Guard: anti double-click per (contract,month) — block 2 วินาที
  // ปลอดภัยสำหรับ generateAllInvoices loop เพราะ key ไม่ซ้ำกัน (different cids)
  // แต่กันกรณี user ดับเบิลคลิก context-menu บนสัญญาเดียวกัน → ออกบิลซ้ำ
  const lockKey=cid+'_'+month;
  const lockTime=_genInvLocks.get(lockKey);
  if(lockTime&&(Date.now()-lockTime)<2000){toast('กำลังสร้างใบแจ้งหนี้... รอสักครู่','warning');return;}
  _genInvLocks.set(lockKey,Date.now());
  setTimeout(()=>_genInvLocks.delete(lockKey),2000);

  const c=DB.contracts.find(x=>x.id===cid);
  if(!c)return;
  const p=DB.properties.find(x=>x.pid===c.pid);
  const headerId=+(c.invHeaderId||DB.defaultInvHeader||DB.invoiceHeaders[0]?.id)||null;

  const [y,mo]=month.split('-');
  // ใช้ max ID+1 แทน count เพื่อกันเลขซ้ำเมื่อลบแล้วสร้างใหม่
  const existingNums=(DB.invoices||[]).filter(x=>x.month===month).map(x=>{const m=(x.invoiceNo||'').match(/-(\d+)$/);return m?parseInt(m[1]):0;});
  const nextNum=Math.max(0,...existingNums)+1;
  const invoiceNo=`INV-${month}-${String(nextNum).padStart(4,'0')}`;
  const rawDueDay=parseInt(c.dueDay)||5; // ปรับได้ per contract, default วันที่ 5
  // BUGFIX: เดิมใช้ new Date(y, mo, dueDay) → JS month 0-based ทำให้ due เลื่อนไปเดือนถัดไป
  // ต้องการ: เก็บเดือนไหน due วันที่ 5 เดือนนั้น
  // B4: clamp dueDay ให้ไม่เกินวันสุดท้ายของเดือน (กัน rollover เช่น dueDay=31 ใน ก.พ.)
  const daysInMonth=new Date(parseInt(y),parseInt(mo),0).getDate();
  const dueDay=Math.min(Math.max(1,rawDueDay),daysInMonth);
  const dueDate=new Date(parseInt(y),parseInt(mo)-1,dueDay);
  const dueDateBE=dateToBE(dueDate);

  // Use actual invoice amount based on frequency, not monthly equivalent
  const baseAmount=invoiceAmount(c);
  // ── Resolve VAT mode from header (Phase A) ──
  const _h=(DB.invoiceHeaders||[]).find(x=>x.id===headerId);
  let _vatMode=(_h&&_h.vatMode)||(_h&&_h.vatRegistered?'inclusive':'none');
  const _vatRate=parseFloat((_h&&_h.vatRate))||7;
  // gross = ยอดที่ลูกค้าจ่ายจริง
  // exclusive: base ไม่รวม VAT → ต้องบวก VAT เข้าไป
  // inclusive: base รวม VAT แล้ว → gross = base
  // none: ไม่มี VAT → gross = base
  const rentAmount = (_vatMode==='exclusive') ? +(baseAmount*(1+_vatRate/100)).toFixed(2) : baseAmount;
  const freq=payFreq(c.rate, c.payment);
  const freqLabel=freq.label||'';

  // Build invoice description based on frequency type
  let itemDesc='ค่าเช่า';
  const thMonths=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const thMonthsFull=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const yearBE=parseInt(y)+543;
  const monthNum=parseInt(mo);

  if(freq.type==='monthly'){
    itemDesc='ค่าเช่าประจำเดือน '+thMonthsFull[monthNum-1]+' '+yearBE;
  } else if(freq.type==='quarterly'){
    const qNum=Math.ceil(monthNum/3);
    const startMo=thMonths[(qNum-1)*3];
    const endMo=thMonths[Math.min(qNum*3-1,11)];
    itemDesc='ค่าเช่าไตรมาสที่ '+qNum+' ('+startMo+'-'+endMo+' '+yearBE+')';
  } else if(freq.type==='semi'){
    const hNum=monthNum<=6?1:2;
    const startMo=hNum===1?'ม.ค.':'ก.ค.';
    const endMo=hNum===1?'มิ.ย.':'ธ.ค.';
    itemDesc='ค่าเช่าครึ่งปี'+hNum+' ('+startMo+'-'+endMo+' '+yearBE+')';
  } else if(freq.type==='yearly'){
    const yy2=String(yearBE%100).padStart(2,'0');
    itemDesc='ค่าเช่าประจำปี '+yearBE+' (1 ม.ค. '+yy2+' - 31 ธ.ค. '+yy2+')';
  } else if(freq.type==='lump'){
    itemDesc='ค่าเช่า (ชำระครั้งเดียว)';
  }

  const items=[
    {desc:itemDesc,amount:rentAmount}
  ];

  const total=items.reduce((s,it)=>s+it.amount,0);

  DB.invoices.push({
    id:DB.nextInvId++,
    cid:cid,
    pid:c.pid,
    month:month,
    tenant:c.tenant,
    property:c.property||p?.name,
    invoiceNo:invoiceNo,
    date:dateToBE(new Date()),
    dueDate:dueDateBE,
    items:items,
    total:total,
    headerId:headerId,
    freqType:freq.type,
    freqLabel:freqLabel,
    // ── VAT snapshot (Phase A) — lock เพื่อให้แก้ settings แล้วไม่กระทบใบเก่า ──
    vatMode:_vatMode,
    vatRate:_vatMode==='none'?0:_vatRate,
    vatBase:baseAmount, // ราคาก่อน VAT (ไว้ debug/audit)
    status:'draft',
    paidAmount:0,
    remainingAmount:total,
    payments:[],
    createdAt:new Date().toISOString()
  });
  addInvoiceAudit(DB.nextInvId-1, 'created', 'สร้างใบแจ้งหนี้อัตโนมัติ '+invoiceNo+' — ค่าเช่า '+fmtBaht(total,{sym:0})+' บาท');
}

function viewInvoiceList(month){
  const invs=DB.invoices.filter(i=>i.month===month).sort((a,b)=>a.invoiceNo.localeCompare(b.invoiceNo));
  $('mtitle').textContent=`ใบแจ้งหนี้ — ${month}`;
  $('mbody').innerHTML=`<div style="max-height:70vh;overflow-y:auto">
    ${invs.length===0?'<div style="text-align:center;padding:40px;color:#64748b">ยังไม่มีใบแจ้งหนี้</div>':'<table style="width:100%;font-size:12px;border-collapse:collapse"><tr style="background:#f8fafc;border-bottom:1px solid #e5e7eb"><th style="padding:8px;text-align:left;font-weight:600">เลขที่</th><th style="padding:8px;text-align:left">ห้อง</th><th style="padding:8px;text-align:left">ผู้เช่า</th><th style="padding:8px;text-align:right;font-weight:600">รวม</th><th style="padding:8px;text-align:center">สถานะ</th><th style="padding:8px;text-align:center">การกระทำ</th></tr>'+invs.map(inv=>`<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:8px;font-weight:500">${esc(inv.invoiceNo)}</td><td style="padding:8px">${esc(inv.property)}</td><td style="padding:8px">${esc(inv.tenant)}</td><td style="padding:8px;text-align:right">${fmtBaht(inv.total,{sym:0})} บ.</td><td style="padding:8px;text-align:center">${invBadge(inv.status)}</td><td style="padding:8px;text-align:center"><button onclick="printInvoice(${inv.id})" style="background:none;border:none;color:#3b82f6;cursor:pointer;font-size:14px" title="พิมพ์">🖨️</button> <button onclick="markInvoicePaid(${inv.id})" style="background:none;border:none;color:#22c55e;cursor:pointer;font-size:14px" title="ชำระแล้ว">✓</button></td></tr>`).join('')}+'</table>'}
  </div>`;
  document.getElementById('modal').classList.remove('hidden');
}

function printInvoice(invId){
  const inv=DB.invoices.find(x=>x.id===invId);
  if(!inv)return toast('ไม่พบใบแจ้งหนี้','error');
  verifyPIN(function(staff){
    inv.lastSignedBy=staff.name;
    inv.lastSignedAt=new Date().toISOString();
    save();
    const html=invoiceHTML([inv],staff);
    openPrintOverlay(null,`ใบแจ้งหนี้ ${esc(inv.invoiceNo)}`,html);
    addInvoiceAudit(invId, 'printed', 'พิมพ์ใบแจ้งหนี้ — ลงนามโดย '+staff.name);
  });
}

function viewInvoiceDetail(invId){
  const inv=DB.invoices.find(x=>x.id===invId);
  if(!inv)return;
  const ds=getDisplayStatus(inv);
  const daysOver=getDaysOverdue(inv);
  const stLabels={draft:'แบบร่าง',sent:'รอชำระ',paid:'ชำระแล้ว',partial:'ชำระบางส่วน',overdue:'เกินกำหนด'+(daysOver>0?' '+daysOver+' วัน':''),voided:'ยกเลิก'};
  const stLabel=stLabels[ds]||inv.status;
  const stColors={draft:'#64748b',sent:'#0ea5e9',paid:'#059669',partial:'#d97706',overdue:'#dc2626',voided:'#64748b'};
  const stC=stColors[ds]||'#64748b';
  const isPaid=inv.status==='paid';
  const isPartial=inv.status==='partial';
  const isVoided=inv.status==='voided';
  $('mtitle').textContent='ใบแจ้งหนี้ '+inv.invoiceNo;
  const pmts=inv.payments||[];
  $('mbody').innerHTML=`
    <div>
      <!-- Summary card -->
      <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin-bottom:12px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div><span style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600">เลขที่ใบแจ้งหนี้</span><div style="font-size:15px;font-weight:700;color:#1e293b;margin-top:3px">${esc(inv.invoiceNo)||'-'}</div></div>
          <div><span style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600">สถานะ</span><div style="margin-top:3px"><span style="font-size:11px;font-weight:700;color:${stC};background:${stC}18;padding:3px 10px;border-radius:99px">${stLabel}</span></div></div>
          <div><span style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600">ทรัพย์สิน</span><div style="font-size:13px;font-weight:600;color:#1e293b;margin-top:3px">${esc(inv.property)||'-'}</div></div>
          <div><span style="font-size:10px;color:#64748b;text-transform:uppercase;font-weight:600">ผู้เช่า</span><div style="font-size:13px;font-weight:600;color:#1e293b;margin-top:3px">${esc(inv.tenant)||'-'}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;padding-top:10px;border-top:1px solid #e5e7eb">
          <div><span style="font-size:10px;color:#64748b;font-weight:600">ยอดรวมใบแจ้งหนี้</span><div style="font-size:16px;font-weight:700;color:#1e293b;margin-top:3px">${fmtBaht(inv.total||0,{sym:0})} ฿</div></div>
          <div><span style="font-size:10px;color:#059669;font-weight:600">ชำระแล้ว</span><div style="font-size:16px;font-weight:700;color:#059669;margin-top:3px">${fmtBaht(inv.paidAmount||0,{sym:0})} ฿</div></div>
          <div><span style="font-size:10px;color:${((inv.remainingAmount!=null?inv.remainingAmount:Math.max(0,(inv.total||0)-(inv.paidAmount||0)))>0)?'#dc2626':'#64748b'};font-weight:600">ยังค้าง</span><div style="font-size:16px;font-weight:700;color:${((inv.remainingAmount!=null?inv.remainingAmount:Math.max(0,(inv.total||0)-(inv.paidAmount||0)))>0)?'#dc2626':'#64748b'};margin-top:3px">${fmtBaht(inv.remainingAmount!=null?inv.remainingAmount:Math.max(0,(inv.total||0)-(inv.paidAmount||0)),{sym:0})} ฿</div></div>
        </div>
        ${inv.receiptNo?'<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:11px;color:#059669;font-weight:600">🧾 เลขที่ใบเสร็จ: '+esc(inv.receiptNo)+'</div>':''}
        ${daysOver>0&&!isPaid?`<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:11px;color:#dc2626;font-weight:700">⚠️ เลยกำหนดชำระ ${daysOver} วัน (กำหนด: ${esc(inv.dueDate)||'-'})</div>`:''}
      </div>

      <!-- Payment history -->
      ${pmts.length>0?`<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px 14px;margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:#15803d;margin-bottom:8px">💰 ประวัติการรับเงิน (${pmts.length} ครั้ง)</div>
        ${pmts.map((p,i)=>{
          const pd=new Date(p.date);
          const pdStr=dateToBE(pd);
          return`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;${i>0?'border-top:1px solid #dcfce7':''}">
            <span style="font-size:11px;color:#15803d;font-weight:700;min-width:110px">${esc(p.receiptNo)||'-'}</span>
            <span style="font-size:12px;font-weight:700;color:#1e293b">${fmtBaht(p.amount||0,{sym:0})} ฿</span>
            <span style="font-size:11px;color:#64748b">${esc(p.method)||''} ${pdStr}</span>
            ${p.ref?'<span style="font-size:10px;color:#64748b">ref:'+esc(p.ref)+'</span>':''}
            ${p.slip?'<button onclick="viewSlipImage('+inv.id+')" style="padding:2px 8px;background:#dbeafe;color:#1e40af;border:none;border-radius:4px;font-size:10px;cursor:pointer;font-family:Sarabun">slip</button>':''}
            <button onclick="printPaymentReceipt(${inv.id},${i})" style="padding:2px 8px;background:#dcfce7;color:#15803d;border:none;border-radius:4px;font-size:10px;cursor:pointer;font-family:Sarabun;font-weight:600">🧾 พิมพ์</button>
          </div>`;
        }).join('')}
      </div>`:''}

      <!-- Note -->
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:700;color:#92400e;margin-bottom:6px">📝 หมายเหตุ (เฉพาะใบนี้)</div>
        <textarea id="invNoteField" rows="2" placeholder="หมายเหตุสำหรับใบนี้ (เว้นว่าง = ใช้ค่า default)" style="width:100%;padding:8px 10px;border:1px solid #fcd34d;border-radius:6px;font-size:12px;font-family:Sarabun;resize:vertical;background:#fff;color:#1e293b;box-sizing:border-box">${esc(inv.note)||''}</textarea>
        <div style="display:flex;justify-content:flex-end;margin-top:6px">
          <button onclick="saveInvoiceNote(${inv.id})" style="padding:5px 14px;background:#f59e0b;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:Sarabun">💾 บันทึก</button>
        </div>
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="printInvoice(${inv.id})" style="padding:9px 14px;background:#eef2ff;color:#4338ca;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">🖨️ พิมพ์ใบแจ้งหนี้</button>
        ${!isVoided?'<button onclick="closeModal();openInvoiceForm('+inv.id+')" style="padding:9px 14px;background:#fef3c7;color:#92400e;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">✏️ แก้ไข</button>':''}
        ${(isPaid||isPartial)&&inv.slipImage?'<button onclick="viewSlipImage('+inv.id+')" style="padding:9px 14px;background:#dbeafe;color:#1e40af;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">🖼️ ดู slip</button>':''}
        ${!isPaid&&!isVoided?'<button onclick="closeModal();openReceivePaymentModal('+inv.id+')" style="padding:9px 18px;background:#059669;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:Sarabun">💰 '+(isPartial?'รับเงินเพิ่ม':'บันทึกรับเงิน')+'</button>':''}
        ${isPaid?'<button onclick="printReceipt('+inv.id+')" style="padding:9px 14px;background:#dcfce7;color:#15803d;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">🧾 พิมพ์ใบเสร็จ</button>':''}
        ${!isVoided&&hasPermission('void')?'<button onclick="voidInvoice('+inv.id+')" style="padding:9px 14px;background:#fff7ed;color:#c2410c;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">🚫 Void</button>':''}
        ${hasPermission('delete')?`<button onclick="deleteInvoice(${inv.id})" style="padding:9px 14px;background:#fee2e2;color:#dc2626;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">🗑️ ลบ</button>`:''}
        <button onclick="viewInvoiceAudit(${inv.id})" style="padding:9px 14px;background:#f1f5f9;color:#475569;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">📋 ประวัติ</button>
      </div>
    </div>
  `;
  $('modal').classList.remove('hidden');
}

function viewInvoiceAudit(invId){
  const inv=DB.invoices.find(x=>x.id===invId);
  const auditEntries=inv?(inv.audit||[]):[];
  // Also check orphans
  const orphan=!inv&&DB.invoiceAuditOrphan?(DB.invoiceAuditOrphan.find(x=>x.invId===invId)):null;
  const entries=inv?auditEntries:(orphan?orphan.audit:[]);
  const invNo=inv?inv.invoiceNo:(orphan?orphan.invoiceNo:'#'+invId);

  const actionIcons={created:'📝',edited:'✏️',paid:'💰',deleted:'🗑️',voided:'🚫',printed:'🖨️',receipt_printed:'🧾',slip_attached:'📸',status_change:'🔄',unvoid:'♻️'};
  const actionColors={created:'#22c55e',edited:'#f59e0b',paid:'#059669',deleted:'#dc2626',voided:'#ef4444',printed:'#6366f1',receipt_printed:'#8b5cf6',slip_attached:'#3b82f6',status_change:'#06b6d4',unvoid:'#14b8a6'};

  $('mtitle').textContent='ประวัติการดำเนินการ — '+invNo;
  $('mbody').innerHTML=`<div style="max-height:70vh;overflow-y:auto">
    ${entries.length===0?'<div style="text-align:center;padding:40px;color:#64748b"><div style="font-size:32px;margin-bottom:8px">📋</div>ยังไม่มีประวัติ</div>':
    `<div style="position:relative;padding-left:28px">
      <div style="position:absolute;left:10px;top:8px;bottom:8px;width:2px;background:#e5e7eb"></div>
      ${entries.map((e,i)=>`<div style="position:relative;padding:12px 0 12px 16px;${i<entries.length-1?'border-bottom:1px solid #f8fafc':''}">
        <div style="position:absolute;left:-22px;top:14px;width:24px;height:24px;border-radius:50%;background:${actionColors[e.action]||'#64748b'};display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 0 0 3px #fff">${actionIcons[e.action]||'📋'}</div>
        <div style="font-size:13px;font-weight:600;color:#1e293b">${esc(e.detail||e.action)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">${esc(e.beDateStr)}</div>
        ${e.snapshot?'<details style="margin-top:4px"><summary style="font-size:11px;color:#6366f1;cursor:pointer">ดูข้อมูลก่อนแก้ไข</summary><pre style="font-size:10px;color:#64748b;background:#f8fafc;padding:8px;border-radius:6px;margin-top:4px;overflow-x:auto;white-space:pre-wrap">'+JSON.stringify(e.snapshot,null,2).replace(/</g,'&lt;')+'</pre></details>':''}
      </div>`).join('')}
    </div>`}
  </div>`;
  $('modal').classList.remove('hidden');
}


// ============================================================
// ERP-STYLE PAYMENT RECEIPT FLOW
// ============================================================
// B3: Smart pre-fill — find last payment method for this contract (most recent across all invoices)
function getLastPayMethodForCid(cid){
  if(!cid)return '';
  let latestDate='', latestMethod='';
  (DB.invoices||[]).forEach(i=>{
    if(i.cid!==cid)return;
    (i.payments||[]).forEach(p=>{
      const pd=p.date||'';
      if(pd>latestDate){ latestDate=pd; latestMethod=p.method||''; }
    });
  });
  return latestMethod;
}

function openReceivePaymentModal(invId){
  const inv=DB.invoices.find(x=>x.id===invId);
  if(!inv)return;
  if(inv.status==='paid')return toast('ใบแจ้งหนี้นี้ชำระแล้ว');
  const today=new Date();
  const todayBE=dateToBE(today);
  const daysOver=getDaysOverdue(inv);
  const isPartial=inv.status==='partial';
  const remaining=inv.remainingAmount!=null?inv.remainingAmount:inv.total||0;
  const paidSoFar=inv.paidAmount||0;
  // B3: prefer last method for this contract; fallback to 'โอนเงิน'
  const _lastMethod=getLastPayMethodForCid(inv.cid)||'โอนเงิน';

  $('mtitle').textContent='💰 บันทึกรับเงิน';
  $('mbody').innerHTML=`
  <div>
    <!-- Invoice summary card -->
    <div style="background:linear-gradient(135deg,${daysOver>0?'#fff5f5,#fee2e2':'#ecfdf5,#d1fae5'});border:1px solid ${daysOver>0?'#fca5a5':'#86efac'};border-radius:12px;padding:14px 16px;margin-bottom:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><div style="font-size:10px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px">เลขที่ใบแจ้งหนี้</div><div style="font-size:15px;font-weight:700;color:#065f46">${esc(inv.invoiceNo)||'-'}</div></div>
        <div><div style="font-size:10px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px">ยอดรวมใบแจ้งหนี้</div><div style="font-size:18px;font-weight:800;color:#1e293b">${fmtBaht(inv.total||0,{sym:0})} <span style="font-size:12px;font-weight:500">บาท</span></div></div>
        <div><div style="font-size:10px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px">ทรัพย์สิน</div><div style="font-size:12px;font-weight:600;color:#1e293b">${esc(inv.property)||'-'}</div></div>
        <div><div style="font-size:10px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px">ผู้เช่า</div><div style="font-size:12px;font-weight:600;color:#1e293b">${esc(inv.tenant)||'-'}</div></div>
      </div>
    </div>

    <!-- Overdue alert -->
    ${daysOver>0?`<div style="background:#fff1f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
      <span style="font-size:18px">⚠️</span>
      <div>
        <div style="font-size:12px;font-weight:700;color:#dc2626">เลยกำหนดชำระ ${daysOver} วัน</div>
        <div style="font-size:11px;color:#b91c1c;margin-top:1px">กำหนดชำระ: ${esc(inv.dueDate)||'-'}</div>
      </div>
    </div>`:''}

    <!-- Partial payment status -->
    ${isPartial?`<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:#92400e;margin-bottom:6px">📊 สถานะการชำระ</div>
      <div style="display:flex;justify-content:space-between;font-size:12px">
        <span style="color:#64748b">ชำระแล้ว</span><span style="font-weight:700;color:#059669">${fmtBaht(paidSoFar,{sym:0})} บาท</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px;padding-top:4px;border-top:1px solid #fde68a">
        <span style="color:#92400e;font-weight:700">ยังค้างอยู่</span><span style="font-weight:800;color:#dc2626">${fmtBaht(remaining,{sym:0})} บาท</span>
      </div>
    </div>`:''}

    <!-- Payment form -->
    <div style="display:grid;gap:12px">

      <!-- จำนวนเงินที่รับ -->
      <div>
        <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px">💵 จำนวนเงินที่รับ <span style="color:#ef4444">*</span></label>
        <div style="position:relative">
          <input type="number" id="rpAmount" value="${remaining}" min="0.01" step="0.01"
            style="width:100%;padding:10px 50px 10px 12px;border:2px solid #d1fae5;border-radius:8px;font-size:16px;font-family:Sarabun;font-weight:700;color:#065f46;background:#f0fdf4;box-sizing:border-box"
            oninput="const v=parseFloat(this.value)||0;const rem=${remaining};document.getElementById('rpAmtHint').textContent=v<rem?'ชำระบางส่วน — ยังค้าง '+fmtBaht(rem-v,{sym:0})+' บาท':'ชำระครบ ✓'">
          <span style="position:absolute;right:12px;top:50%;transform:translateY(-50%);font-size:12px;color:#64748b;font-weight:600">บาท</span>
        </div>
        <div id="rpAmtHint" style="font-size:11px;color:#059669;margin-top:4px;font-weight:600">ชำระครบ ✓</div>
      </div>

      <!-- วันที่รับเงิน -->
      <div>
        <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px">📅 วันที่รับเงิน <span style="color:#ef4444">*</span></label>
        <div style="position:relative;max-width:200px">
          <input type="text" id="rpDate" value="${todayBE}" required placeholder="dd/mm/yyyy"
            style="width:100%;padding:9px 36px 9px 12px;border:2px solid #d1fae5;border-radius:8px;font-size:14px;font-family:Sarabun;font-weight:600;color:#065f46;background:#f0fdf4;box-sizing:border-box"
            oninput="this.style.borderColor=this.value?'#059669':'#ef4444'">
          <span onclick="openThaiDP(this.previousElementSibling)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:16px">📅</span>
        </div>
      </div>

      <!-- วิธีชำระ -->
      <div>
        <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px">💳 วิธีชำระเงิน</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${['โอนเงิน','เงินสด','เช็ค','อื่นๆ'].map(m=>{const sel=(m===_lastMethod);return `<label style="display:flex;align-items:center;gap:6px;padding:7px 14px;border:2px solid ${sel?'#059669':'#e5e7eb'};border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;color:${sel?'#065f46':'#374151'};background:${sel?'#f0fdf4':'#fff'};transition:all .15s" onclick="document.querySelectorAll('.rp-method').forEach(l=>{l.style.borderColor='#e5e7eb';l.style.background='#fff';l.style.color='#374151'});this.style.borderColor='#059669';this.style.background='#f0fdf4';this.style.color='#065f46';document.getElementById('rpMethod').value='${m}'" class="rp-method"><input type="radio" name="rpMethodRadio" value="${m}" ${sel?'checked':''} style="display:none">${m}</label>`}).join('')}
        </div>
        <input type="hidden" id="rpMethod" value="${_lastMethod}">
      </div>

      <!-- เลขอ้างอิง -->
      <div>
        <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px">🔖 เลขอ้างอิง / เลขที่โอน <span style="color:#64748b;font-weight:400">(ถ้ามี)</span></label>
        <input type="text" id="rpRef" placeholder="เช่น 20240401-001 หรือ เลขที่โอน 6 หลักท้าย"
          style="width:100%;padding:9px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:Sarabun;box-sizing:border-box">
      </div>

      <!-- แนบ Slip -->
      <div>
        <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px">🖼️ แนบ Slip <span style="color:#64748b;font-weight:400">(ถ้ามี)</span></label>
        <div id="rpSlipPreview" style="display:none;margin-bottom:8px">
          <img id="rpSlipImg" style="max-height:120px;border-radius:8px;border:1px solid #e5e7eb;object-fit:contain">
          <button onclick="document.getElementById('rpSlipImg').src='';document.getElementById('rpSlipPreview').style.display='none';document.getElementById('rpSlipData').value=''" style="display:block;margin-top:4px;font-size:11px;color:#64748b;background:none;border:none;cursor:pointer;font-family:Sarabun">✕ ลบรูป</button>
        </div>
        <label style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:#f8fafc;border:2px dashed #cbd5e1;border-radius:8px;cursor:pointer;font-size:13px;color:#64748b;font-weight:600;transition:all .15s" onmouseover="this.style.borderColor='#059669';this.style.color='#059669'" onmouseout="this.style.borderColor='#cbd5e1';this.style.color='#64748b'">
          📎 เลือกไฟล์ Slip
          <input type="file" accept="image/*" style="display:none" onchange="rpUploadSlip(this)">
        </label>
        <input type="hidden" id="rpSlipData" value="">
      </div>

      <!-- หมายเหตุ -->
      <div>
        <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px">📝 หมายเหตุ <span style="color:#64748b;font-weight:400">(ถ้ามี)</span></label>
        <textarea id="rpNote" rows="2" placeholder="เช่น ชำระงวดที่ 1 เดือนมกราคม"
          style="width:100%;padding:9px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:Sarabun;resize:vertical;box-sizing:border-box"></textarea>
      </div>
    </div>

    <!-- Action buttons -->
    <div style="display:flex;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid #e5e7eb">
      <button onclick="submitReceivePayment(${inv.id})"
        style="flex:1;padding:12px;background:#059669;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:Sarabun;display:flex;align-items:center;justify-content:center;gap:6px"
        onmouseover="this.style.background='#047857'" onmouseout="this.style.background='#059669'">
        ✅ บันทึกรับเงิน
      </button>
      <button onclick="closeModal(true)"
        style="padding:12px 20px;background:#f1f5f9;color:#64748b;border:none;border-radius:10px;font-size:14px;cursor:pointer;font-family:Sarabun"
        onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
        ยกเลิก
      </button>
    </div>
  </div>`;
  $('modal').classList.remove('hidden');
}

function rpUploadSlip(input){
  if(!input.files[0])return;
  compressImage(input.files[0],1200,0.75,function(dataUrl){
    document.getElementById('rpSlipData').value=dataUrl;
    const img=document.getElementById('rpSlipImg');
    img.src=dataUrl;
    document.getElementById('rpSlipPreview').style.display='';
  });
}

// ========== DATA CLEANUP: ลบ payment ซ้ำ (run จาก console: dedupReceiptDuplicates()) ==========
function dedupReceiptDuplicates(){
  let fixed=0,removedPayments=0,affectedInv=[];
  DB.invoices.forEach(inv=>{
    if(!inv.payments||inv.payments.length<2)return;
    const seen=new Map();
    const kept=[];
    inv.payments.forEach(p=>{
      // duplicate key: same amount + same date (วันเดียวกัน รับเงินจริงคงไม่ซ้ำ amount เป๊ะ)
      const dayKey=(p.date||'').slice(0,10)+'|'+Math.round(p.amount||0);
      if(seen.has(dayKey)){removedPayments++;return;}
      seen.set(dayKey,true);kept.push(p);
    });
    if(kept.length<inv.payments.length){
      inv.payments=kept;
      // recompute paidAmount
      inv.paidAmount=kept.reduce((s,p)=>s+(p.amount||0),0);
      inv.remainingAmount=Math.max(0,(inv.total||0)-inv.paidAmount);
      if(inv.remainingAmount<=0.01){inv.status='paid';inv.remainingAmount=0;}
      else if(inv.paidAmount>0){inv.status='partial';}
      fixed++;affectedInv.push(inv.invoiceNo);
    }
  });
  if(fixed){
    save();
    addActivityLog('dedup','ล้างข้อมูลซ้ำ: '+fixed+' ใบ ลบ payment '+removedPayments+' รายการ — '+affectedInv.join(', '));
    toast('ล้างแล้ว '+fixed+' ใบ ลบรายการซ้ำ '+removedPayments+' รายการ','success');
  }else{toast('ไม่พบ payment ซ้ำ','success');}
  console.log('Affected:',affectedInv);
  return {fixed,removedPayments,affectedInv};
}

function submitReceivePayment(invId){
  const inv=DB.invoices.find(x=>x.id===invId);
  if(!inv)return;
  // Guard 1: ใบนี้ชำระครบแล้ว ห้ามรับเพิ่ม
  if(inv.status==='paid'&&(inv.remainingAmount||0)<=0.01){return toast('ใบนี้ชำระครบแล้ว','warning');}
  if(inv.status==='voided'){return toast('ใบนี้ถูกยกเลิกแล้ว','error');}
  // Guard 2: anti double-click — submit ซ้ำใน 2 วินาที block
  if(inv._submittingPay&&(Date.now()-inv._submittingPay)<2000){return;}
  inv._submittingPay=Date.now();
  const dateVal=(document.getElementById('rpDate').value||'').trim();
  if(!dateVal){document.getElementById('rpDate').style.borderColor='#ef4444';return toast('⚠ กรุณาระบุวันที่รับเงิน');}
  const method=document.getElementById('rpMethod').value||'โอนเงิน';
  const ref=(document.getElementById('rpRef').value||'').trim();
  const slip=document.getElementById('rpSlipData').value||'';
  const note=(document.getElementById('rpNote').value||'').trim();
  const amtEl=document.getElementById('rpAmount');
  const payAmt=amtEl?parseFloat(amtEl.value)||0:inv.total||0;
  if(payAmt<=0) return toast('⚠ กรุณาระบุจำนวนเงิน','error');
  // Guard 3: ห้ามรับเงินเกินยอดค้างชำระ
  const remaining=(inv.total||0)-(inv.paidAmount||0);
  if(payAmt>remaining+0.01){
    delete inv._submittingPay;
    return toast('⚠ จำนวนเงินเกินยอดค้าง ('+fmtBaht(remaining,{sym:0,dec:2})+' บาท)','error');
  }

  // Parse BE date to ISO
  const parts=dateVal.split('/');
  let paidISO=new Date().toISOString();
  if(parts.length===3){
    const d=parseInt(parts[0]),m=parseInt(parts[1])-1,y=parseInt(parts[2])-543;
    if(!isNaN(d)&&!isNaN(m)&&!isNaN(y)){const pd=new Date(y,m,d,12,0,0);if(!isNaN(pd.getTime()))paidISO=pd.toISOString();}
  }

  // Generate receipt number for this payment
  if(!DB.nextReceiptId) DB.nextReceiptId=1;
  const receiptNo='REC-'+inv.month+'-'+String(DB.nextReceiptId++).padStart(4,'0');

  // Build payment record
  if(!inv.payments) inv.payments=[];
  const _by=(currentUser&&currentUser.name)||'(ไม่ระบุ)';
  inv.payments.push({receiptNo,date:paidISO,amount:payAmt,method,ref,slip:slip||'',note,by:_by});

  // Update running totals
  inv.paidAmount=(inv.paidAmount||0)+payAmt;
  inv.remainingAmount=Math.max(0,(inv.total||0)-inv.paidAmount);

  if(inv.remainingAmount<=0.01){
    // ชำระครบ
    inv.status='paid';
    inv.paidAt=paidISO;
    inv.payMethod=method;
    if(ref) inv.payRef=ref;
    if(slip) inv.slipImage=slip;
    if(note) inv.payNote=note;
    inv.receiptNo=receiptNo; // เลขที่ใบเสร็จสุดท้าย
    inv.remainingAmount=0;
    _assignTaxInvoiceNoIfVat(inv);
  } else {
    // ชำระบางส่วน
    inv.status='partial';
    if(slip&&!inv.slipImage) inv.slipImage=slip;
  }

  const auditDetail='รับเงิน '+fmtBaht(payAmt,{sym:0})+' บาท ('+method+')'+(ref?' ref:'+ref:'')+(slip?' แนบ slip':'')+' → '+receiptNo+(inv.status==='partial'?' [บางส่วน ค้าง '+fmtBaht(inv.remainingAmount,{sym:0})+' บาท]':' [ชำระครบ]');
  addActivityLog('receive_payment','บันทึกรับเงิน '+inv.invoiceNo+' — '+fmtBaht(payAmt,{sym:0})+' บาท '+receiptNo);
  addInvoiceAudit(invId,'paid',auditDetail);
  delete inv._submittingPay;
  save();
  closeModal();
  if(window._currentViewCid) viewContract(window._currentViewCid);
  else renderInvoicePage();
  showReceiptBanner(invId,receiptNo,payAmt,inv.status==='paid');
}

function showReceiptBanner(invId,receiptNo,paidAmt,isFullyPaid){
  const inv=DB.invoices.find(x=>x.id===invId);
  if(!inv)return;
  const existing=document.getElementById('receiptSuccessBanner');
  if(existing)existing.remove();
  const rNo=receiptNo||inv.receiptNo||inv.invoiceNo;
  const bgColor=isFullyPaid?'#059669':'#d97706';
  const shadowColor=isFullyPaid?'rgba(5,150,105,.35)':'rgba(217,119,6,.35)';

  const banner=document.createElement('div');
  banner.id='receiptSuccessBanner';
  banner.style.cssText=`position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9990;background:${bgColor};color:#fff;border-radius:12px;padding:14px 20px;box-shadow:0 8px 24px ${shadowColor};display:flex;align-items:center;gap:12px;font-family:Sarabun;font-size:13px;font-weight:600;min-width:320px;max-width:90vw;animation:si .3s ease`;
  const isDeposit=inv.category==='deposit';
  const _prop=inv.property||inv.tenant||'';
  const _ctxLine=_prop?`<div style="font-size:10px;font-weight:600;opacity:.75;margin-top:1px">${isDeposit?'เงินประกัน · ':''} ${esc(_prop)}</div>`:(isDeposit?`<div style="font-size:10px;font-weight:600;opacity:.75;margin-top:1px">เงินประกัน</div>`:'');
  banner.innerHTML=`
    <span style="font-size:20px">${isFullyPaid?'✅':'💰'}</span>
    <div style="flex:1">
      <div>${isFullyPaid?'ชำระครบ':'รับเงินบางส่วน'} — <strong>${esc(rNo)}</strong></div>
      ${_ctxLine}
      <div style="font-size:11px;font-weight:400;opacity:.85;margin-top:2px">${fmtBaht(paidAmt||0,{sym:0})} บาท · ${esc(inv.payMethod)||''} ${inv.payRef?'· ref: '+esc(inv.payRef):''}${!isFullyPaid?' · ค้าง '+fmtBaht(inv.remainingAmount||0,{sym:0})+' บาท':''}</div>
    </div>
    ${isFullyPaid?`<button onclick="printReceipt(${invId});document.getElementById('receiptSuccessBanner').remove()"
      style="padding:7px 14px;background:#fff;color:#059669;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:Sarabun;white-space:nowrap">
      🧾 พิมพ์ใบเสร็จ
    </button>`:''}
    <button onclick="document.getElementById('receiptSuccessBanner').remove()"
      style="padding:4px 8px;background:rgba(255,255,255,.2);color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;font-family:Sarabun">✕</button>
  `;
  document.body.appendChild(banner);
  // Auto-dismiss after 8 seconds
  setTimeout(()=>{ if(document.getElementById('receiptSuccessBanner'))banner.remove(); },8000);
}

// ── ACTION: lazy assign taxInvoiceNo ถ้า landlord จด VAT ──
// format: TIV-YYMM-NNNN  (running ต่อเนื่องทั้งระบบ ไม่รีเซตรายเดือน)
// idempotent: ถ้ามีแล้วไม่ทำซ้ำ
function _assignTaxInvoiceNoIfVat(inv){
  if(!inv||inv.taxInvoiceNo)return;
  const h=(DB.invoiceHeaders||[]).find(x=>x.id===inv.headerId);
  if(!h||!h.vatRegistered)return;
  if(DB.nextTaxInvoiceId==null)DB.nextTaxInvoiceId=1;
  const n=DB.nextTaxInvoiceId++;
  const d=new Date();
  const yy=String((d.getFullYear()+543)%100).padStart(2,'0');
  const mm=String(d.getMonth()+1).padStart(2,'0');
  inv.taxInvoiceNo='TIV-'+yy+mm+'-'+String(n).padStart(4,'0');
  inv.taxInvoiceIssuedAt=new Date().toISOString();
  addInvoiceAudit(inv.id,'tax_invoice_issued','ออกเลขใบกำกับภาษี: '+inv.taxInvoiceNo);
}
function markInvoicePaid(invId, slipImage, slipMeta){
  const inv=DB.invoices.find(x=>x.id===invId);
  if(!inv)return;
  if(slipImage){
    inv.status='paid';
    inv.paidAt=new Date().toISOString();
    inv.slipImage=slipImage;
    if(slipMeta) inv.slipMeta=slipMeta;
    // Fix: ถ้ายังไม่มี paidAmount (ไม่เคยผ่าน submitReceivePayment) ให้ set เต็มจำนวน
    if(inv.paidAmount==null) inv.paidAmount=inv.total||0;
    inv.remainingAmount=0;
    _assignTaxInvoiceNoIfVat(inv);
    const auditDetail=slipMeta?'ชำระแล้ว (slip ตรวจสอบแล้ว — ref '+slipMeta.transRef+' จาก '+(slipMeta.senderName||'?')+') — ยอด '+fmtBaht(inv.total||0,{sym:0})+' บาท':'ชำระแล้ว (แนบ slip) — ยอด '+fmtBaht(inv.total||0,{sym:0})+' บาท';
    addActivityLog('mark_invoice_paid','ทำเครื่องหมายใบแจ้งหนี้ '+inv.invoiceNo+' ชำระแล้ว (แนบ slip)');
    addInvoiceAudit(invId, 'paid', auditDetail);
    save();
    return;
  }
  customConfirm('ชำระแล้ว','ทำเครื่องหมายว่า '+inv.invoiceNo+' ชำระแล้ว?\n\nยอด '+fmtBaht(inv.total||0,{sym:0})+' บาท',function(){
    inv.status='paid';
    inv.paidAt=new Date().toISOString();
    // Fix: set paidAmount/remainingAmount ให้ถูกต้อง
    if(inv.paidAmount==null) inv.paidAmount=inv.total||0;
    inv.remainingAmount=0;
    _assignTaxInvoiceNoIfVat(inv);
    addActivityLog('mark_invoice_paid','ทำเครื่องหมายใบแจ้งหนี้ '+inv.invoiceNo+' ชำระแล้ว');
    addInvoiceAudit(invId, 'paid', 'ทำเครื่องหมายชำระแล้ว (ไม่มี slip) — ยอด '+fmtBaht(inv.total||0,{sym:0})+' บาท');
    save();
    toast('อัปเดตสถานะแล้ว — ออกใบเสร็จได้ที่แท็บ "ใบเสร็จรับเงิน"');
    renderInvoicePage();
  },{icon:'✅',yesLabel:'ชำระแล้ว',yesColor:'#059669'});
}

// ── ACTION: mark invoice as sent (draft → sent) ──
function markInvoiceSent(invId){
  const inv=DB.invoices.find(x=>x.id===invId);
  if(!inv||inv.status!=='draft')return;
  inv.status='sent';
  inv.sentAt=new Date().toISOString();
  addInvoiceAudit(invId,'status_change','เปลี่ยนสถานะ: แบบร่าง → ส่งแล้ว');
  addActivityLog('invoice_sent','ส่งใบแจ้งหนี้ '+inv.invoiceNo+' แล้ว');
  save();
  toast('✓ เปลี่ยนสถานะเป็น "ส่งแล้ว"');
  renderInvoicePage();
}

// ส่งใบร่างทุกเดือน — ใช้ตอนเริ่มใช้ระบบหลัง import (ปลดล็อก aging/revenue reports)
function sendAllDraftsGlobal(){
  const drafts=(DB.invoices||[]).filter(i=>i.status==='draft'&&i.category!=='deposit');
  if(!drafts.length)return toast('ไม่มีใบร่างให้ส่ง','warning');
  customConfirm('📤 ส่งใบแจ้งหนี้ทั้งหมด',
    `เปลี่ยนสถานะ ${drafts.length} ใบ (ทุกเดือน) เป็น "ส่งแล้ว" ?\n• ใช้สำหรับเริ่มใช้ระบบหลัง import ข้อมูล\n• หลังส่งแล้วใบจะนับเป็นค้างชำระตามวันครบกำหนด`,
    function(){
      const now=new Date().toISOString();
      drafts.forEach(inv=>{
        inv.status='sent'; inv.sentAt=now;
        addInvoiceAudit(inv.id,'sent','ส่งใบแจ้งหนี้ (batch global '+drafts.length+' ใบ)');
      });
      addActivityLog('batch_send_global','ส่งใบร่างทั้งหมด '+drafts.length+' ใบ');
      save();
      toast('📤 ส่งแล้ว '+drafts.length+' ใบ','success');
      if(typeof render==='function')render();
    },
    {icon:'📤',yesLabel:'ส่งทั้งหมด',yesColor:'#ea580c'});
}

function sendAllDraftInvoices(){
  const drafts=(DB.invoices||[]).filter(i=>i.status==='draft'&&i.month===invoiceMonth);
  if(!drafts.length)return toast('ไม่มีใบแจ้งหนี้ที่เป็นแบบร่าง','warning');
  customConfirm(
    '📤 ส่งใบแจ้งหนี้ทั้งหมด',
    'เปลี่ยนสถานะ '+drafts.length+' ใบ เป็น "ส่งแล้ว" ทั้งหมด?',
    function(){
      const now=new Date().toISOString();
      drafts.forEach(function(inv){
        inv.status='sent';
        inv.sentAt=now;
        addInvoiceAudit(inv.id,'sent','ส่งใบแจ้งหนี้ (ส่งทั้งหมด '+drafts.length+' ใบ)');
      });
      addActivityLog('batch_send','ส่งใบแจ้งหนี้เดือน '+invoiceMonth+' ทั้งหมด '+drafts.length+' ใบ');
      save();
      renderInvoicePage();
      toast('📤 ส่งแล้ว '+drafts.length+' ใบ','success');
    },
    {icon:'📤',yesLabel:'ยืนยันส่งทั้งหมด',yesColor:'#f59e0b'}
  );
}

// ── ACTION: save follow-up date + note ──
function saveFollowUp(invId,date,note){
  const inv=DB.invoices.find(x=>x.id===invId);
  if(!inv)return;
  inv.followUpDate=(date||'').trim();
  inv.followUpNote=(note||'').trim();
  save();
  toast(inv.followUpDate?'✓ บันทึกนัดชำระแล้ว':'ลบนัดชำระแล้ว');
  closeModal();
  renderInvoicePage();
}

// ── RENDER: follow-up modal ──
function openFollowUpModal(invId){
  const inv=DB.invoices.find(x=>x.id===invId);
  if(!inv)return;
  $('mtitle').textContent='📅 ตั้งวันนัดชำระ';
  $('mbody').innerHTML=`
    <div>
      <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;margin-bottom:16px">
        <div style="font-size:13px;font-weight:700;color:#1e293b">${esc(inv.invoiceNo)||'-'} — ${esc(inv.tenant)||''}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px">${esc(inv.property)||''} · ยอด ${fmtBaht(inv.total||0,{sym:0})} บาท</div>
      </div>
      <div style="display:grid;gap:12px">
        <div>
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px">📅 วันที่ผู้เช่านัดชำระ</label>
          <div style="position:relative;max-width:200px">
            <input type="text" id="fuDateInput" value="${esc(inv.followUpDate)||''}" placeholder="dd/mm/yyyy"
              style="width:100%;padding:9px 36px 9px 12px;border:2px solid #c7d2fe;border-radius:8px;font-size:14px;font-family:Sarabun;font-weight:600;box-sizing:border-box">
            <span onclick="openThaiDP(this.previousElementSibling)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:16px">📅</span>
          </div>
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px">📝 บันทึก follow-up</label>
          <input type="text" id="fuNoteInput" value="${(inv.followUpNote||'').replace(/"/g,'&quot;')}"
            placeholder="เช่น ผู้เช่าสัญญาจะโอนวันที่ 5 / โทรนัดแล้ว..."
            style="width:100%;padding:9px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:Sarabun;box-sizing:border-box">
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button onclick="saveFollowUp(${invId},document.getElementById('fuDateInput').value,document.getElementById('fuNoteInput').value)"
          style="flex:1;padding:10px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:Sarabun">💾 บันทึก</button>
        ${inv.followUpDate?`<button onclick="saveFollowUp(${invId},'','')" style="padding:10px 14px;background:#fee2e2;color:#dc2626;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">✕ ลบ</button>`:''}
        <button onclick="closeModal()" style="padding:10px 16px;background:#f1f5f9;color:#64748b;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-family:Sarabun">ยกเลิก</button>
      </div>
    </div>`;
  $('modal').classList.remove('hidden');
}

function viewSlipImage(invId){
  const inv=DB.invoices.find(x=>x.id===invId);
  if(!inv||!inv.slipImage)return toast('ไม่มีรูป slip');
  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:pointer';
  overlay.onclick=()=>{document.removeEventListener('keydown',escHandler);overlay.remove();};
  const escHandler=(e)=>{if(e.key==='Escape'){document.removeEventListener('keydown',escHandler);overlay.remove();}};
  document.addEventListener('keydown',escHandler);
  const img=document.createElement('img');
  img.src=inv.slipImage;
  img.style.cssText='max-width:90vw;max-height:90vh;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,0.5)';
  overlay.appendChild(img);
  document.body.appendChild(overlay);
}

function renderSlipUploadPage(tabHTML){
  const months2=[];
  const d3=new Date();
  for(let i=0;i<12;i++){const m=new Date(d3.getFullYear(),d3.getMonth()-i,1);months2.push(`${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,'0')}`);}
  const thMo2=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

  let uploadedSlips=slipSessionData.slips||[];

  const topBarHTML=`<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:16px;align-items:center">
    <select id="slipMonthSelect" onchange="invoiceMonth=this.value;slipSessionData.slips.forEach(s=>{s.month=this.value;});renderInvoicePage()" style="padding:8px 12px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:Sarabun">
      ${months2.map(m=>{const[y,mo]=m.split('-');return'<option value="'+m+'" '+(m===invoiceMonth?'selected':'')+'>'+thMo2[parseInt(mo)-1]+' '+(parseInt(y)+543)+'</option>';}).join('')}
    </select>
  </div>`;

  const hasUnpaidInvoices=(DB.invoices||[]).some(inv=>inv.month===invoiceMonth&&inv.status!=='paid');
  const noInvoiceWarning=!hasUnpaidInvoices?`<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:12px;display:flex;align-items:center;gap:10px">
    <span style="font-size:18px">⚠️</span>
    <div>
      <div style="font-size:13px;font-weight:600;color:#92400e">ยังไม่มีใบแจ้งหนี้ค้างชำระเดือนนี้</div>
      <div style="font-size:12px;color:#a16207">กรุณาสร้างใบแจ้งหนี้ก่อนที่แท็บ "ใบแจ้งหนี้" จึงจะเลือกสัญญาได้</div>
    </div>
  </div>`:'';

  const slipOkCfg=DB.slipOk||{};
  const slipOkStatus=slipOkCfg.enabled&&slipOkCfg.apiKey&&slipOkCfg.branchId
    ?`<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#065f46;display:flex;align-items:center;gap:8px">
        <span>🤖</span>
        <span>SlipOK auto-verify เปิดใช้งาน — สลิปที่อัปโหลดจะถูกตรวจสอบและจับคู่ใบแจ้งหนี้อัตโนมัติ</span>
      </div>`
    :`<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#92400e;display:flex;align-items:center;gap:8px">
        <span>💡</span>
        <span>เปิดใช้ SlipOK API ใน <a href="javascript:page='settings';settingsTab='invoice';render()" style="color:#92400e;text-decoration:underline;font-weight:600">ตั้งค่า → ใบแจ้งหนี้</a> เพื่อตรวจสลิปและจับคู่อัตโนมัติ</span>
      </div>`;

  const dropZoneHTML=`<div style="border:2px dashed #cbd5e1;border-radius:12px;padding:40px 20px;text-align:center;background:#f8fafc;cursor:pointer;transition:all .2s" id="slipDropZone" ondragover="event.preventDefault();this.style.borderColor='#6366f1';this.style.background='#eef2ff'" ondragleave="this.style.borderColor='#cbd5e1';this.style.background='#f8fafc'" ondrop="event.preventDefault();this.style.borderColor='#cbd5e1';this.style.background='#f8fafc';handleSlipFiles(event.dataTransfer.files)">
    <div style="font-size:24px;margin-bottom:8px">📸</div>
    <div style="font-size:14px;color:#334155;font-weight:600;margin-bottom:4px">วาง slip ที่นี่ หรือกดเลือกไฟล์</div>
    <div style="font-size:12px;color:#64748b">รองรับรูปภาพ JPG, PNG (ขนาดสูงสุด 5MB)</div>
    <input type="file" id="slipFileInput" multiple accept="image/*" style="display:none" onchange="handleSlipFiles(this.files)">
    <button type="button" onclick="document.getElementById('slipFileInput').click()" style="margin-top:12px;padding:8px 20px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-family:Sarabun" onmouseover="this.style.background='#4338ca'" onmouseout="this.style.background='#4f46e5'">เลือกไฟล์</button>
  </div>`;

  const tagged=uploadedSlips.map((s,i)=>({s,i}));
  const matchedGroup=tagged.filter(({s})=>!s.verifying&&s.autoMatched&&s.cid);
  const verifyingGroup=tagged.filter(({s})=>s.verifying);
  const manualGroup=tagged.filter(({s})=>!s.verifying&&!s.autoMatched);

  let slipsListHTML='';
  if(!uploadedSlips.length){
    slipsListHTML='<div style="text-align:center;padding:40px;color:#64748b"><p style="font-size:14px">ยังไม่มี slip ที่อัปโหลด</p><p style="font-size:12px;margin-top:8px">ลากไฟล์หรือกดเลือกรูปด้านบน</p></div>';
  } else {
    // ── ✅ Auto-matched section ──
    if(matchedGroup.length){
      slipsListHTML+=`<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:16px;margin-top:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div style="font-size:13px;font-weight:700;color:#15803d">✅ จับคู่อัตโนมัติ <span style="background:#16a34a;color:#fff;padding:1px 8px;border-radius:99px;font-size:11px">${matchedGroup.length}</span></div>
          <button onclick="confirmAllMatched()" style="padding:7px 14px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:Sarabun" onmouseover="this.style.background='#15803d'" onmouseout="this.style.background='#16a34a'">✅ ยืนยันทั้งหมด (${matchedGroup.length} รายการ)</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${matchedGroup.map(({s,i})=>{
            const inv=DB.invoices.find(x=>x.id===s.matchedInvId);
            const ctr=DB.contracts.find(c=>c.id===s.cid);
            const prop=ctr?DB.properties.find(p=>p.pid===ctr.pid):null;
            const dupBadge=s.duplicate?'<span style="color:#dc2626;font-size:10px;font-weight:600;margin-left:6px">⚠️ ซ้ำ</span>':'';
            return `<div style="display:flex;align-items:center;gap:10px;padding:10px;background:#fff;border:1px solid #bbf7d0;border-radius:8px">
              <img src="${esc(s.thumb)}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;flex-shrink:0;cursor:pointer" onclick="viewSlipThumb(${i})" title="คลิกดูรูปใหญ่">
              <div style="flex:1;min-width:0">
                <div style="font-size:12px;font-weight:700;color:#166534;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.senderName)||'?'}${dupBadge}</div>
                <div style="font-size:11px;color:#059669;margin-top:1px">${fmtBaht(s.amount||0,{sym:0})} บ. → <b>${esc(inv?inv.invoiceNo:'?')}</b> · ${esc(ctr?ctr.tenant:'')}</div>
                <div style="font-size:10px;color:#6b7280">${esc(prop?prop.name:'')}</div>
              </div>
              <div style="display:flex;gap:4px;flex-shrink:0">
                <button onclick="confirmSlipPayment(${i})" title="ยืนยันรายการนี้" style="padding:6px 10px;background:#16a34a;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;font-family:Sarabun">✓</button>
                <button onclick="slipSessionData.slips.splice(${i},1);renderInvoicePage()" title="ลบ" style="padding:6px 9px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;font-size:11px;cursor:pointer;font-family:Sarabun">✕</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }

    // ── ⏳ Verifying section ──
    if(verifyingGroup.length){
      slipsListHTML+=`<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px;margin-top:16px">
        <div style="font-size:13px;font-weight:700;color:#1d4ed8;margin-bottom:10px">⏳ กำลังตรวจสอบ <span style="background:#2563eb;color:#fff;padding:1px 8px;border-radius:99px;font-size:11px">${verifyingGroup.length}</span></div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${verifyingGroup.map(({s,i})=>`<div style="display:flex;align-items:center;gap:10px;padding:10px;background:#fff;border:1px solid #bfdbfe;border-radius:8px">
            <img src="${esc(s.thumb)}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;flex-shrink:0;opacity:0.7">
            <div style="flex:1;color:#1e40af;font-size:12px">⏳ กำลังตรวจสอบกับ SlipOK...</div>
            <button onclick="slipSessionData.slips.splice(${i},1);renderInvoicePage()" style="padding:6px 9px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;font-size:11px;cursor:pointer;font-family:Sarabun">✕</button>
          </div>`).join('')}
        </div>
      </div>`;
    }

    // ── ⚠️ Manual section ──
    if(manualGroup.length){
      slipsListHTML+=`<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;margin-top:16px">
        <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:12px">⚠️ เลือกสัญญาด้วยตนเอง <span style="background:#d97706;color:#fff;padding:1px 8px;border-radius:99px;font-size:11px">${manualGroup.length}</span></div>
        <div style="display:flex;flex-direction:column;gap:12px">
          ${manualGroup.map(({s,i})=>{
            let reasonBanner='';
            if(s.verifyError) reasonBanner=`<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:6px 10px;font-size:11px;color:#991b1b;margin-bottom:8px">⚠️ ตรวจสลิปไม่สำเร็จ: ${esc(s.verifyError)}</div>`;
            else if(s.noMatch) reasonBanner=`<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:6px 10px;font-size:11px;color:#991b1b;margin-bottom:8px">❌ ไม่พบ invoice ยอดตรง (${fmtBaht(s.amount||0,{sym:0})} บ.)</div>`;
            else if(s.matchCandidates) reasonBanner=`<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:6px;padding:6px 10px;font-size:11px;color:#92400e;margin-bottom:8px">⚠️ พบ ${s.matchCandidates.length} ใบที่ยอดตรง — กรุณาเลือก</div>`;
            else if(s.verified) reasonBanner=`<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:6px 10px;font-size:11px;color:#0369a1;margin-bottom:8px">ℹ️ ตรวจแล้ว: ${esc(s.senderName)||'?'} ${fmtBaht(s.amount||0,{sym:0})} บ.</div>`;
            return `<div style="background:#fff;border:1px solid #fde68a;border-radius:10px;padding:14px;display:flex;gap:12px">
              <img src="${esc(s.thumb)}" style="width:64px;height:64px;object-fit:cover;border-radius:8px;flex-shrink:0;cursor:pointer" onclick="viewSlipThumb(${i})" title="คลิกดูรูปใหญ่">
              <div style="flex:1;min-width:0">
                ${reasonBanner}
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
                  <div>
                    <label style="font-size:10px;color:#64748b;font-weight:600;display:block;margin-bottom:4px">สัญญา / ผู้เช่า *</label>
                    <select onchange="updateSlipContractData(${i},this.value)" style="width:100%;padding:7px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;font-family:Sarabun">
                      <option value="">-- เลือกสัญญา --</option>
                      ${DB.contracts.map(c=>{
                        const p=DB.properties.find(x=>x.pid===c.pid);
                        const hasUnpaid=(DB.invoices||[]).some(inv=>inv.cid===c.id&&inv.month===s.month&&inv.status!=='paid');
                        return hasUnpaid?'<option value="'+c.id+'" '+(s.cid===c.id?'selected':'')+'>'+esc(c.tenant)+' — '+esc(p?p.name||c.property:c.property||'')+'</option>':'';
                      }).join('')}
                    </select>
                  </div>
                  <div>
                    <label style="font-size:10px;color:#64748b;font-weight:600;display:block;margin-bottom:4px">เดือน</label>
                    <select onchange="slipSessionData.slips[${i}].month=this.value;renderInvoicePage()" style="width:100%;padding:7px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;font-family:Sarabun">
                      ${months2.map(m=>{const[y,mo]=m.split('-');return'<option value="'+m+'" '+(m===s.month?'selected':'')+'>'+thMo2[parseInt(mo)-1]+' '+(parseInt(y)+543)+'</option>';}).join('')}
                    </select>
                  </div>
                </div>
                <div style="display:flex;gap:6px">
                  <button onclick="confirmSlipPayment(${i})" style="flex:1;padding:8px;background:${s.cid?'#16a34a':'#cbd5e1'};color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:${s.cid?'pointer':'not-allowed'};font-family:Sarabun" ${!s.cid?'disabled':''}>✅ บันทึก & ชำระแล้ว</button>
                  <button onclick="slipSessionData.slips.splice(${i},1);renderInvoicePage()" style="padding:8px 12px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;font-size:12px;cursor:pointer;font-family:Sarabun">ลบ</button>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }
  }

  const summaryHTML=uploadedSlips.length>0?`<div style="margin-top:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px">
    <div style="font-size:12px;color:#475569;font-weight:600;margin-bottom:8px">📊 สรุปเซสชั่นนี้</div>
    <div style="display:flex;gap:20px;flex-wrap:wrap">
      <div><div style="font-size:10px;color:#64748b">อัปโหลด</div><div style="font-size:18px;font-weight:700;color:#1e293b">${uploadedSlips.length}</div></div>
      <div><div style="font-size:10px;color:#16a34a">จับคู่แล้ว</div><div style="font-size:18px;font-weight:700;color:#16a34a">${matchedGroup.length}</div></div>
      <div><div style="font-size:10px;color:#d97706">รอเลือก</div><div style="font-size:18px;font-weight:700;color:#d97706">${manualGroup.length}</div></div>
      <div><div style="font-size:10px;color:#059669">ชำระแล้วเซสชั่นนี้</div><div style="font-size:18px;font-weight:700;color:#059669">${fmtBaht(slipSessionData.totalPaid,{sym:0})} บ.</div></div>
    </div>
  </div>`:'';

  $('content').innerHTML=`${tabHTML}${topBarHTML}${slipOkStatus}${noInvoiceWarning}${dropZoneHTML}${slipsListHTML}${summaryHTML}`;
}

function handleSlipFiles(files){
  Array.from(files).forEach(file=>{
    if(!file.type.startsWith('image/'))return toast('กรุณาเลือกไฟล์รูปภาพเท่านั้น','error');
    if(file.size>5*1024*1024)return toast('ไฟล์ใหญ่เกินไป (สูงสุด 5MB)','error');
    compressImage(file,800,0.5,base64=>{
      const slip={thumb:base64,cid:0,month:invoiceMonth,verified:false,verifying:false};
      slipSessionData.slips.push(slip);
      const idx=slipSessionData.slips.length-1;
      const cfg=DB.slipOk||{};
      if(cfg.enabled&&cfg.apiKey&&cfg.branchId){
        slip.verifying=true;
        renderInvoicePage();
        verifySlipOk(file).then(data=>{
          slip.verifying=false;
          slip.verified=true;
          slip.amount=data.amount;
          slip.transRef=data.transRef;
          slip.transDate=data.transDate;
          slip.senderName=(data.sender&&(data.sender.displayName||data.sender.name))||'';
          slip.sendingBank=data.sendingBank||'';
          // dedup: เช็ค transRef ซ้ำกับ invoice ที่ชำระแล้ว
          const dup=(DB.invoices||[]).find(inv=>inv.slipMeta&&inv.slipMeta.transRef===data.transRef);
          if(dup){slip.duplicate=true;slip.duplicateInvNo=dup.invoiceNo;}
          autoMatchSlip(idx);
          renderInvoicePage();
        }).catch(e=>{
          slip.verifying=false;
          slip.verifyError=(e&&e.message)||'ตรวจสลิปไม่สำเร็จ';
          renderInvoicePage();
        });
      } else {
        renderInvoicePage();
      }
    });
  });
}

// Action: verify slip ผ่าน SlipOK API → คืน {amount, transRef, sender, ...}
async function verifySlipOk(file){
  const cfg=DB.slipOk||{};
  if(!cfg.enabled||!cfg.apiKey||!cfg.branchId)throw new Error('SlipOK ยังไม่ได้ตั้งค่า');
  const fd=new FormData();
  fd.append('files',file);
  fd.append('log','true');
  const res=await fetch('https://api.slipok.com/api/line/apikey/'+encodeURIComponent(cfg.branchId),{
    method:'POST',
    headers:{'x-authorization':cfg.apiKey},
    body:fd
  });
  const json=await res.json().catch(()=>({}));
  if(!res.ok||!json.success){
    throw new Error((json&&json.message)||('API error '+res.status));
  }
  return json.data||json;
}

// Action: หา invoice ที่ match กับ slip (amount+month+fuzzy name) → set slip.cid อัตโนมัติ
function autoMatchSlip(idx){
  const slip=slipSessionData.slips[idx];
  if(!slip||slip.amount==null)return;
  const candidates=(DB.invoices||[]).filter(inv=>
    inv.month===slip.month&&
    inv.status!=='paid'&&
    Math.abs((inv.total||0)-slip.amount)<0.01
  );
  if(candidates.length===0){slip.noMatch=true;return;}
  if(candidates.length===1){
    slip.cid=candidates[0].cid;
    slip.matchedInvId=candidates[0].id;
    slip.autoMatched=true;
    return;
  }
  // Multiple candidates — narrow down with sender name fuzzy match
  if(slip.senderName){
    const named=candidates.filter(inv=>{
      const ctr=DB.contracts.find(c=>c.id===inv.cid);
      return ctr&&nameMatch(slip.senderName,ctr.tenant);
    });
    if(named.length===1){
      slip.cid=named[0].cid;
      slip.matchedInvId=named[0].id;
      slip.autoMatched=true;
      return;
    }
  }
  slip.matchCandidates=candidates.map(c=>c.id);
}

function updateSlipContractData(idx,cid){
  slipSessionData.slips[idx].cid=parseInt(cid)||0;
  // user override → clear auto-match flag
  slipSessionData.slips[idx].autoMatched=false;
  renderInvoicePage();
}

function confirmSlipPayment(idx){
  const slip=slipSessionData.slips[idx];
  if(!slip.cid)return toast('กรุณาเลือกสัญญา','error');
  if(slip.duplicate){
    return customConfirm('สลิปซ้ำ','สลิปนี้ถูกใช้กับ '+slip.duplicateInvNo+' แล้ว\n\nยืนยันบันทึกซ้ำ?',function(){_doConfirmSlipPayment(idx);});
  }
  _doConfirmSlipPayment(idx);
}

function _doConfirmSlipPayment(idx){
  const slip=slipSessionData.slips[idx];
  const unpaidInvs=(DB.invoices||[]).filter(inv=>inv.cid===slip.cid&&inv.month===slip.month&&inv.status!=='paid');
  if(unpaidInvs.length===0)return toast('ไม่พบใบแจ้งหนี้ที่ค้างชำระ','error');
  // ถ้ามี matchedInvId → ใช้ตัวนั้น (กรณี cid มีหลาย invoice เดือนเดียว)
  const inv=slip.matchedInvId?unpaidInvs.find(x=>x.id===slip.matchedInvId)||unpaidInvs[0]:unpaidInvs[0];
  const meta=slip.verified?{
    transRef:slip.transRef,
    amount:slip.amount,
    senderName:slip.senderName,
    sendingBank:slip.sendingBank,
    transDate:slip.transDate,
    verifiedAt:new Date().toISOString()
  }:null;
  markInvoicePaid(inv.id,slip.thumb,meta);
  slipSessionData.slips.splice(idx,1);
  slipSessionData.totalPaid+=inv.total;
  toast('บันทึก '+inv.invoiceNo+' ชำระแล้ว ✅');
  renderInvoicePage();
}

function confirmAllMatched(){
  const toProcess=slipSessionData.slips
    .map((s,i)=>({s,i}))
    .filter(({s})=>s.autoMatched&&s.cid&&!s.duplicate);
  if(!toProcess.length)return toast('ไม่มี slip ที่จับคู่อัตโนมัติ','warning');
  customConfirm(
    'ยืนยัน '+toProcess.length+' รายการ',
    'ยืนยันรับเงิน '+toProcess.length+' ใบแจ้งหนี้ที่จับคู่อัตโนมัติ?',
    function(){
      let count=0;
      toProcess.sort((a,b)=>b.i-a.i).forEach(({s,i})=>{
        const unpaidInvs=(DB.invoices||[]).filter(inv=>inv.cid===s.cid&&inv.month===s.month&&inv.status!=='paid');
        if(!unpaidInvs.length)return;
        const inv=s.matchedInvId?unpaidInvs.find(x=>x.id===s.matchedInvId)||unpaidInvs[0]:unpaidInvs[0];
        const meta=s.verified?{transRef:s.transRef,amount:s.amount,senderName:s.senderName,sendingBank:s.sendingBank,transDate:s.transDate,verifiedAt:new Date().toISOString()}:null;
        markInvoicePaid(inv.id,s.thumb,meta);
        slipSessionData.totalPaid+=inv.total;
        slipSessionData.slips.splice(i,1);
        count++;
      });
      toast('บันทึกชำระแล้ว '+count+' รายการ ✅');
      renderInvoicePage();
    },
    {icon:'✅',yesLabel:'ยืนยัน '+toProcess.length+' รายการ',yesColor:'#059669',noLabel:'ยกเลิก'}
  );
}

function viewSlipThumb(idx){
  const slip=slipSessionData.slips[idx];
  if(!slip||!slip.thumb)return;
  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999;cursor:pointer';
  overlay.onclick=()=>overlay.remove();
  const img=document.createElement('img');
  img.src=slip.thumb;
  img.style.cssText='max-width:90vw;max-height:90vh;border-radius:12px';
  overlay.appendChild(img);
  document.body.appendChild(overlay);
}

function showAgingReport(){
  const unpaid=(DB.invoices||[]).filter(i=>i.status==='draft'||i.status==='sent'||i.status==='partial');
  const today=new Date();
  const buckets={current:[],d30:[],d60:[],d90:[],over90:[]};

  unpaid.forEach(inv=>{
    // Parse due date
    const due=parseBE(inv.dueDate);
    if(!due){buckets.current.push(inv);return;}
    const days=Math.floor((today-due)/(1000*60*60*24));
    if(days<=0) buckets.current.push(inv);
    else if(days<=30) buckets.d30.push(inv);
    else if(days<=60) buckets.d60.push(inv);
    else if(days<=90) buckets.d90.push(inv);
    else buckets.over90.push(inv);
  });

  const sumBucket=(arr)=>arr.reduce((s,i)=>s+(i.total||0),0);
  const totalAll=sumBucket(unpaid);
  // VAT split สำหรับ unpaid (VAT ค้างเก็บ)
  function _vsBucket(arr){
    let sub=0,vat=0,gross=0,n=0;
    arr.forEach(i=>{
      const h=(DB.invoiceHeaders||[]).find(x=>x.id==i.headerId);
      const g=i.total||0;gross+=g;
      const _v=calcVat(i,h);
      if(_v.isVat){sub+=_v.subtotal;vat+=_v.vatAmount;n++;}
      else sub+=g;
    });
    return {sub:Math.round(sub*100)/100,vat:Math.round(vat*100)/100,gross,n};
  }
  const vsAll=_vsBucket(unpaid);
  const hasAnyVat=vsAll.n>0;

  const bucketData=[
    {label:'ยังไม่ถึงกำหนด',color:'#22c55e',bg:'#dcfce7',items:buckets.current},
    {label:'เกิน 1-30 วัน',color:'#f59e0b',bg:'#fef3c7',items:buckets.d30},
    {label:'เกิน 31-60 วัน',color:'#f97316',bg:'#ffedd5',items:buckets.d60},
    {label:'เกิน 61-90 วัน',color:'#ef4444',bg:'#fee2e2',items:buckets.d90},
    {label:'เกิน 90 วัน',color:'#991b1b',bg:'#fecaca',items:buckets.over90}
  ];

  $('mtitle').textContent='รายงานอายุหนี้ (Aging Report)';
  $('mbody').innerHTML=`<div style="max-height:70vh;overflow-y:auto">
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      ${bucketData.map(b=>`<div style="flex:1;min-width:120px;background:${b.bg};border-radius:10px;padding:12px">
        <div style="font-size:11px;color:${b.color};font-weight:600">${b.label}</div>
        <div style="font-size:18px;font-weight:700;color:${b.color}">${fmtBaht(sumBucket(b.items),{sym:0})}</div>
        <div style="font-size:10px;color:${b.color};opacity:.7">${b.items.length} ใบ</div>
      </div>`).join('')}
    </div>
    <div style="background:#f8fafc;border-radius:10px;padding:12px 16px;margin-bottom:${hasAnyVat?'10':'16'}px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:13px;font-weight:600;color:#475569">ยอดค้างชำระทั้งหมด</span>
      <span style="font-size:18px;font-weight:700;color:#1e293b">${fmtBaht(totalAll,{sym:0})} บาท</span>
    </div>
    ${hasAnyVat?`
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 14px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;font-size:12px">
      <span style="color:#92400e;font-weight:600">🧾 ในยอดค้างนี้มี VAT (${vsAll.n} ใบ จาก landlord จด VAT)</span>
      <span style="color:#92400e;font-weight:700">มูลค่าก่อนภาษี ${fmtBaht(vsAll.sub,{sym:0,dec:2})} &nbsp;·&nbsp; VAT ${fmtBaht(vsAll.vat,{sym:0,dec:2})} บาท</span>
    </div>`:''}
    ${bucketData.filter(b=>b.items.length>0).map(b=>`
      <div style="margin-bottom:16px">
        <div style="font-size:13px;font-weight:700;color:${b.color};margin-bottom:8px;display:flex;align-items:center;gap:6px">
          <span style="width:8px;height:8px;border-radius:50%;background:${b.color}"></span>${b.label} (${b.items.length} ใบ — ${fmtBaht(sumBucket(b.items),{sym:0})} บาท)
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${b.items.map(inv=>`<div onclick="closeModal();viewInvoiceDetail(${inv.id})" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#fff;border:1px solid #f1f5f9;border-radius:8px;cursor:pointer;font-size:12px">
            <div>
              <span style="font-weight:600">${esc(inv.invoiceNo)}</span>
              <span style="color:#64748b;margin-left:8px">${esc(inv.tenant)||''}</span>
            </div>
            <div style="font-weight:600;color:${b.color}">${fmtBaht(inv.total||0,{sym:0})} บ.</div>
          </div>`).join('')}
        </div>
      </div>
    `).join('')}
  </div>`;
  $('modal').classList.remove('hidden');
}

function showMonthlySummary(month){
  month=month||invoiceMonth;
  const invs=(DB.invoices||[]).filter(i=>i.month===month);
  const paid=invs.filter(i=>i.status==='paid');
  const unpaid=invs.filter(i=>i.status==='draft'||i.status==='sent'||i.status==='partial');
  const voided=invs.filter(i=>i.status==='voided');
  const totalBilled=invs.filter(i=>i.status!=='voided').reduce((s,i)=>s+(i.total||0),0);
  const totalPaid=paid.reduce((s,i)=>s+(i.total||0),0)+unpaid.filter(i=>i.status==='partial').reduce((s,i)=>s+(i.paidAmount||0),0);
  const totalUnpaid=unpaid.reduce((s,i)=>s+(i.remainingAmount!=null?i.remainingAmount:i.total||0),0);
  const totalVoided=voided.reduce((s,i)=>s+(i.total||0),0);
  const collectionRate=totalBilled>0?Math.round(totalPaid/totalBilled*100):0;

  // ── VAT split (เฉพาะ landlord ที่จด VAT) ──
  function vatSplit(list){
    let sub=0,vat=0,gross=0,vatCount=0;
    list.forEach(i=>{
      const h=(DB.invoiceHeaders||[]).find(x=>x.id==i.headerId);
      const g=i.total||0;
      gross+=g;
      const _v=calcVat(i,h);
      if(_v.isVat){
        sub+=_v.subtotal;vat+=_v.vatAmount;vatCount++;
      } else {
        sub+=g;
      }
    });
    return {sub:Math.round(sub*100)/100,vat:Math.round(vat*100)/100,gross,vatCount};
  }
  const vsBilled=vatSplit(invs.filter(i=>i.status!=='voided'));
  const vsPaid=vatSplit(paid);
  const hasAnyVat=vsBilled.vatCount>0;

  const thMo=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const [y,m]=month.split('-');
  const monthLabel=thMo[parseInt(m)-1]+' '+(parseInt(y)+543);

  $('mtitle').textContent='สรุปยอดรายเดือน — '+monthLabel;
  $('mbody').innerHTML=`<div style="max-height:70vh;overflow-y:auto">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div style="background:#eef2ff;border-radius:12px;padding:16px"><div style="font-size:11px;color:#6366f1;font-weight:600">ออกบิลทั้งหมด</div><div style="font-size:22px;font-weight:700;color:#4338ca">${fmtBaht(totalBilled,{sym:0})}</div><div style="font-size:11px;color:#818cf8">${invs.filter(i=>i.status!=='voided').length} ใบ</div></div>
      <div style="background:#dcfce7;border-radius:12px;padding:16px"><div style="font-size:11px;color:#059669;font-weight:600">ชำระแล้ว</div><div style="font-size:22px;font-weight:700;color:#15803d">${fmtBaht(totalPaid,{sym:0})}</div><div style="font-size:11px;color:#4ade80">${paid.length} ใบ</div></div>
      <div style="background:#fef3c7;border-radius:12px;padding:16px"><div style="font-size:11px;color:#d97706;font-weight:600">ค้างชำระ</div><div style="font-size:22px;font-weight:700;color:#92400e">${fmtBaht(totalUnpaid,{sym:0})}</div><div style="font-size:11px;color:#f59e0b">${unpaid.length} ใบ</div></div>
      <div style="background:#fee2e2;border-radius:12px;padding:16px"><div style="font-size:11px;color:#dc2626;font-weight:600">ยกเลิก (Void)</div><div style="font-size:22px;font-weight:700;color:#991b1b">${fmtBaht(totalVoided,{sym:0})}</div><div style="font-size:11px;color:#f87171">${voided.length} ใบ</div></div>
    </div>
    <div style="background:linear-gradient(135deg,#4338ca,#6366f1);border-radius:12px;padding:16px;margin-bottom:16px;color:#fff">
      <div style="font-size:11px;opacity:.8;font-weight:600">อัตราการเก็บเงิน (Collection Rate)</div>
      <div style="display:flex;align-items:end;gap:8px;margin-top:4px">
        <div style="font-size:28px;font-weight:800">${collectionRate}%</div>
        <div style="font-size:12px;opacity:.7;margin-bottom:4px">${fmtBaht(totalPaid,{sym:0})} / ${fmtBaht(totalBilled,{sym:0})} บาท</div>
      </div>
      <div style="background:rgba(255,255,255,.2);border-radius:99px;height:8px;margin-top:8px"><div style="background:#fff;height:100%;border-radius:99px;width:${collectionRate}%;transition:width .3s"></div></div>
    </div>
    ${hasAnyVat?`
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:14px 16px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:13px;font-weight:700;color:#92400e">🧾 สรุป VAT ประจำเดือน</span>
        <span style="font-size:10px;color:#b45309;background:#fef3c7;padding:2px 8px;border-radius:99px">${vsBilled.vatCount} ใบ จาก landlord ที่จด VAT</span>
      </div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr style="color:#92400e;font-size:10px;font-weight:700"><td></td><td style="text-align:right;padding:4px 8px">มูลค่าก่อนภาษี</td><td style="text-align:right;padding:4px 8px">VAT</td><td style="text-align:right;padding:4px 8px">รวมสุทธิ</td></tr>
        <tr style="border-top:1px solid #fde68a"><td style="padding:6px 8px;color:#64748b">ออกบิลทั้งหมด</td><td style="text-align:right;padding:6px 8px;font-variant-numeric:tabular-nums;font-weight:600">${fmtBaht(vsBilled.sub,{sym:0,dec:2})}</td><td style="text-align:right;padding:6px 8px;font-variant-numeric:tabular-nums;font-weight:600;color:#92400e">${fmtBaht(vsBilled.vat,{sym:0,dec:2})}</td><td style="text-align:right;padding:6px 8px;font-variant-numeric:tabular-nums;font-weight:700;color:#1e293b">${fmtBaht(vsBilled.gross,{sym:0,dec:2})}</td></tr>
        <tr style="border-top:1px solid #fde68a;background:#fefce8"><td style="padding:6px 8px;color:#15803d;font-weight:600">ชำระแล้ว</td><td style="text-align:right;padding:6px 8px;font-variant-numeric:tabular-nums;font-weight:600">${fmtBaht(vsPaid.sub,{sym:0,dec:2})}</td><td style="text-align:right;padding:6px 8px;font-variant-numeric:tabular-nums;font-weight:600;color:#92400e">${fmtBaht(vsPaid.vat,{sym:0,dec:2})}</td><td style="text-align:right;padding:6px 8px;font-variant-numeric:tabular-nums;font-weight:700;color:#15803d">${fmtBaht(vsPaid.gross,{sym:0,dec:2})}</td></tr>
      </table>
      <div style="font-size:9px;color:#a16207;margin-top:8px;line-height:1.4">⚠️ ตัวเลข VAT ที่ "ชำระแล้ว" คือยอดที่ต้องนำส่งสรรพากร (VAT ขายของเดือนนี้)</div>
    </div>`:''}
    ${unpaid.length>0?`
    <div style="margin-top:16px">
      <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:8px">📌 ค้างชำระ (${unpaid.length} ใบ)</div>
      ${unpaid.map(inv=>`<div onclick="closeModal();viewInvoiceDetail(${inv.id})" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:#fff;border:1px solid #fef3c7;border-radius:8px;cursor:pointer;font-size:12px;margin-bottom:4px">
        <div><span style="font-weight:600">${esc(inv.invoiceNo)}</span> <span style="color:#64748b">${esc(inv.tenant)||''}</span></div>
        <span style="font-weight:600;color:#d97706">${fmtBaht(inv.total||0,{sym:0})} บ.</span>
      </div>`).join('')}
    </div>`:''}
  </div>`;
  $('modal').classList.remove('hidden');
}

function openInvoiceForm(invId){
  const isEdit=!!invId;
  const inv=isEdit?DB.invoices.find(x=>x.id===invId):null;

  // Get active contracts for dropdown
  const contracts=DB.contracts.filter(c=>{const s=status(c);return s==='active'||s==='soon';});
  const headers=DB.invoiceHeaders||[];

  // Warn if no active contracts and not editing
  if(!isEdit && contracts.length===0){
    customConfirm('ไม่มีสัญญาที่ใช้งาน','ไม่พบสัญญาที่ active อยู่\nกรุณาเพิ่มสัญญาก่อนสร้างใบแจ้งหนี้',null,{icon:'📋',type:'alert'});
    return;
  }
  if(!isEdit && headers.length===0){
    customConfirm('ไม่มีข้อมูลผู้ให้เช่า','กรุณาเพิ่มข้อมูลผู้ให้เช่า/บริษัทในหน้าตั้งค่าก่อน\nเพื่อใช้เป็นหัวกระดาษใบแจ้งหนี้',null,{icon:'🏢',type:'alert'});
    return;
  }

  // Default month
  const defMonth=isEdit?inv.month:invoiceMonth;
  const [defY,defMo]=defMonth.split('-');

  // Items for edit
  const items=isEdit&&inv.items?inv.items:[{desc:'ค่าเช่า',amount:0}];

  $('mtitle').textContent=isEdit?'แก้ไขใบแจ้งหนี้':'สร้างใบแจ้งหนี้ใหม่';
  $('mbody').innerHTML=`
  <form id="invoiceForm" onsubmit="return false" style="max-height:70vh;overflow-y:auto">
    <input type="hidden" id="invEditId" value="${isEdit?inv.id:''}">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div>
        <label class="text-xs font-medium text-gray-600 mb-1 block">สัญญา / ผู้เช่า *</label>
        <select name="cid" id="invCidSelect" onchange="onInvContractChange()" class="w-full px-3 py-2 border rounded-lg text-sm" ${isEdit?'disabled':''}>
          <option value="">-- เลือกสัญญา --</option>
          ${contracts.map(c=>{
            const p=DB.properties.find(x=>x.pid===c.pid);
            return '<option value="'+c.id+'" '+(isEdit&&inv.cid===c.id?'selected':'')+'>'+esc(c.tenant)+' — '+esc(p?.name||c.property||'')+'</option>';
          }).join('')}
        </select>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600 mb-1 block">เลขที่ใบแจ้งหนี้</label>
        <input type="text" name="invoiceNo" value="${isEdit?esc(inv.invoiceNo):''}" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="INV-YYYY-MM-001 (อัตโนมัติ)">
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px">
      <div>
        <label class="text-xs font-medium text-gray-600 mb-1 block">ประจำเดือน</label>
        <input type="month" name="month" value="${defMonth}" class="w-full px-3 py-2 border rounded-lg text-sm">
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600 mb-1 block">วันที่ออก</label>
        <input type="text" name="date" value="${isEdit?esc(inv.date):dateToBE(new Date())}" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="DD/MM/BBBB (พ.ศ.)">
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600 mb-1 block">กำหนดชำระ</label>
        <input type="text" name="dueDate" value="${isEdit?esc(inv.dueDate):''}" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="DD/MM/BBBB (พ.ศ.)">
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div>
        <label class="text-xs font-medium text-gray-600 mb-1 block">ผู้ให้เช่า (หัวบิล)</label>
        <select name="headerId" class="w-full px-3 py-2 border rounded-lg text-sm">
          ${headers.map(h=>'<option value="'+h.id+'" '+(isEdit&&inv.headerId===h.id?'selected':'')+'>'+esc(h.companyName)+'</option>').join('')}
          ${headers.length===0?'<option value="">ยังไม่มีผู้ให้เช่า</option>':''}
        </select>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600 mb-1 block">สถานะ</label>
        <select name="status" class="w-full px-3 py-2 border rounded-lg text-sm">
          <option value="draft" ${isEdit&&inv.status==='draft'?'selected':''}>แบบร่าง</option>
          <option value="sent" ${isEdit&&inv.status==='sent'?'selected':''}>ส่งแล้ว</option>
          <option value="paid" ${isEdit&&inv.status==='paid'?'selected':''}>ชำระแล้ว</option>
        </select>
      </div>
    </div>

    <div id="invContractHint"></div>

    <div style="border-top:1px solid #e5e7eb;padding-top:12px;margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span class="text-xs font-semibold text-gray-500">รายการ</span>
        <button type="button" onclick="addInvoiceItemRow()" style="font-size:11px;color:#4338ca;background:#eef2ff;border:none;padding:3px 10px;border-radius:6px;cursor:pointer;font-family:Sarabun;font-weight:600">+ เพิ่มรายการ</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 120px 70px 28px;gap:8px;margin-bottom:4px;padding:0 4px;font-size:10px;color:#64748b;font-weight:600">
        <span>รายละเอียด</span><span style="text-align:right">จำนวน</span><span style="text-align:center">VAT 7%</span><span></span>
      </div>
      <div id="invItemsContainer">
        ${items.map((it,i)=>`
          <div class="inv-item-row" style="display:grid;grid-template-columns:1fr 120px 70px 28px;gap:8px;margin-bottom:6px;align-items:center">
            <input type="text" name="itemDesc_${i}" value="${esc(it.desc)||''}" class="px-3 py-2 border rounded-lg text-sm" placeholder="รายละเอียด">
            <input type="text" name="itemAmt_${i}" value="${it.amount||0}" class="px-3 py-2 border rounded-lg text-sm text-right" placeholder="จำนวนเงิน" oninput="calcInvTotal()">
            <label style="display:flex;align-items:center;justify-content:center;cursor:pointer;background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;height:36px"><input type="checkbox" name="itemVat_${i}" ${it.vatable?'checked':''} onchange="calcInvTotal()" style="cursor:pointer;width:16px;height:16px"></label>
            <button type="button" onclick="this.closest('.inv-item-row').remove();calcInvTotal()" style="width:24px;height:24px;border:none;background:#fee2e2;color:#dc2626;border-radius:4px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center">✕</button>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:8px;padding:10px 12px;background:#f8fafc;border-radius:8px;font-size:12px;color:#475569">
        <div id="invFormBreakdown" style="display:none">
          <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span>มูลค่าไม่คิดภาษี:</span><span id="invFormSubNoVat" style="font-weight:600;color:#1e293b">0.00</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span>มูลค่าก่อนภาษี:</span><span id="invFormSubVat" style="font-weight:600;color:#1e293b">0.00</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:3px"><span>VAT 7%:</span><span id="invFormVatAmt" style="font-weight:600;color:#1e293b">0.00</span></div>
          <div style="border-top:1px solid #e2e8f0;margin:6px 0"></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span style="font-size:13px;font-weight:600">รวมทั้งสิ้น:</span>
          <div><span id="invFormTotal" style="font-size:15px;font-weight:800;color:#1e293b">${fmtBaht(items.reduce((s,it)=>{const a=parseFloat(it.amount)||0;return s+a+(it.vatable?a*0.07:0);},0),{sym:0,dec:2})}</span><span style="font-size:11px;color:#64748b;margin-left:4px">บาท</span></div>
        </div>
      </div>
    </div>

    <div style="display:flex;gap:12px;padding-top:12px;border-top:1px solid #e5e7eb">
      <button type="button" onclick="saveInvoiceForm(${isEdit?inv.id:'null'})" class="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">${isEdit?'บันทึก':'สร้างใบแจ้งหนี้'}</button>
      <button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">ยกเลิก</button>
    </div>
  </form>`;

  $('modal').classList.remove('hidden');
  // Init hint panel (สำหรับ edit mode ที่ cid disabled ไม่ trigger onchange)
  if(isEdit && inv.cid){
    setTimeout(()=>_updateInvContractHint(inv.cid, inv.month, inv.id),0);
  }
}

function addInvoiceItemRow(){
  const container=$('invItemsContainer');
  const idx=container.querySelectorAll('.inv-item-row').length;
  const row=document.createElement('div');
  row.className='inv-item-row';
  row.style.cssText='display:grid;grid-template-columns:1fr 120px 70px 28px;gap:8px;margin-bottom:6px;align-items:center';
  row.innerHTML=`
    <input type="text" name="itemDesc_${idx}" value="" class="px-3 py-2 border rounded-lg text-sm" placeholder="รายละเอียด">
    <input type="text" name="itemAmt_${idx}" value="0" class="px-3 py-2 border rounded-lg text-sm text-right" placeholder="จำนวนเงิน" oninput="calcInvTotal()">
    <label style="display:flex;align-items:center;justify-content:center;cursor:pointer;background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;height:36px"><input type="checkbox" name="itemVat_${idx}" onchange="calcInvTotal()" style="cursor:pointer;width:16px;height:16px"></label>
    <button type="button" onclick="this.closest('.inv-item-row').remove();calcInvTotal()" style="width:24px;height:24px;border:none;background:#fee2e2;color:#dc2626;border-radius:4px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center">✕</button>`;
  container.appendChild(row);
}

function calcInvTotal(){
  const rows=document.querySelectorAll('.inv-item-row');
  let subNoVat=0, subVat=0;
  rows.forEach(r=>{
    const amtInput=r.querySelector('input[name^="itemAmt"]');
    const vatInput=r.querySelector('input[name^="itemVat"]');
    const amt=amtInput?(parseFloat(amtInput.value.replace(/,/g,''))||0):0;
    if(vatInput && vatInput.checked) subVat+=amt;
    else subNoVat+=amt;
  });
  const vatAmt = subVat * 0.07;
  const total = subNoVat + subVat + vatAmt;
  // Update breakdown visibility + values
  const breakdown = document.getElementById('invFormBreakdown');
  if(breakdown){
    if(subVat > 0){
      breakdown.style.display = '';
      const sn=document.getElementById('invFormSubNoVat'); if(sn) sn.textContent=fmtBaht(subNoVat,{sym:0,dec:2});
      const sv=document.getElementById('invFormSubVat'); if(sv) sv.textContent=fmtBaht(subVat,{sym:0,dec:2});
      const va=document.getElementById('invFormVatAmt'); if(va) va.textContent=fmtBaht(vatAmt,{sym:0,dec:2});
    } else {
      breakdown.style.display = 'none';
    }
  }
  const el=$('invFormTotal');
  if(el)el.textContent=fmtBaht(total,{sym:0,dec:2});
  // Refresh contract hint realtime
  const cidEl=document.querySelector('[name="cid"]');
  const moEl=document.querySelector('[name="month"]');
  const editIdEl=document.getElementById('invEditId');
  if(document.getElementById('invContractHint')&&cidEl&&moEl){
    _updateInvContractHint(parseInt(cidEl.value)||null,moEl.value,editIdEl?parseInt(editIdEl.value)||null:null);
  }
}

// ── Render: contract amount hint panel ใน invoice form ──
function _updateInvContractHint(cid, month, excludeId){
  const hintEl=document.getElementById('invContractHint');
  if(!hintEl)return;
  if(!cid||!month){hintEl.innerHTML='';return;}
  const c=DB.contracts.find(x=>x.id===cid);
  if(!c){hintEl.innerHTML='';return;}
  const contractMax=invoiceAmount(c);
  if(!contractMax){hintEl.innerHTML='';return;}

  // ยอดรวม invoices ที่ออกแล้วในเดือนนี้ (ยกเว้นใบที่กำลังแก้ไข)
  const existingInvs=(DB.invoices||[]).filter(x=>x.cid===cid&&x.month===month&&x.status!=='voided'&&x.id!==excludeId);
  const existingSum=existingInvs.reduce((s,x)=>s+(x.total||0),0);
  const existingCount=existingInvs.length;

  // ยอดรวมปัจจุบัน (form + ที่ออกแล้ว)
  const rows=document.querySelectorAll('.inv-item-row');
  let formTotal=0;
  rows.forEach(r=>{formTotal+=parseFloat(r.querySelector('input[name^="itemAmt"]')?.value?.replace(/,/g,''))||0;});
  const cumTotal=existingSum+formTotal;
  const remaining=contractMax-cumTotal;
  const isOver=cumTotal>contractMax+0.01;
  const isClose=!isOver&&contractMax>0&&(cumTotal/contractMax)>=0.8;

  const color=isOver?'#dc2626':isClose?'#d97706':'#059669';
  const bg=isOver?'#fff1f2':isClose?'#fffbeb':'#f0fdf4';
  const border=isOver?'#fca5a5':isClose?'#fde68a':'#86efac';
  const icon=isOver?'⚠️':isClose?'📊':'✅';

  hintEl.innerHTML=`<div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <span style="font-weight:700;color:${color}">${icon} ยอดรวมใบแจ้งหนี้เดือนนี้ (สัญญาเดียวกัน)</span>
      ${existingCount>0?`<span style="font-size:10px;color:#64748b;background:#f1f5f9;padding:2px 8px;border-radius:99px">ออกแล้ว ${existingCount} ใบ</span>`:''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <div><div style="color:#64748b;margin-bottom:2px">ยอดสูงสุดตามสัญญา</div><div style="font-weight:700;color:#1e293b">${fmtBaht(contractMax,{sym:0})} บาท</div></div>
      <div><div style="color:#64748b;margin-bottom:2px">ออกแล้ว${existingCount>0?' ('+existingCount+' ใบ)':''}</div><div style="font-weight:700;color:#475569">${fmtBaht(existingSum,{sym:0})} บาท</div></div>
      <div><div style="color:#64748b;margin-bottom:2px">${isOver?'เกินสัญญา':'คงเหลือออกได้'}</div><div style="font-weight:700;color:${color}">${fmtBaht(Math.abs(remaining),{sym:0})} บาท${isOver?' 🚨':''}</div></div>
    </div>
  </div>`;
}

function onInvContractChange(){
  const cid=parseInt(document.querySelector('[name="cid"]').value);
  if(!cid)return;
  const c=DB.contracts.find(x=>x.id===cid);
  if(!c)return;

  // Auto-fill rent amount in first item
  const rentAmt=invoiceAmount(c);
  const freq=payFreq(c.rate,c.payment);
  const freqLabel=freq.label||'';
  const firstDesc=document.querySelector('[name="itemDesc_0"]');
  const firstAmt=document.querySelector('[name="itemAmt_0"]');
  if(firstDesc)firstDesc.value='ค่าเช่า'+(freqLabel?' ('+freqLabel+')':'');
  if(firstAmt)firstAmt.value=rentAmt;

  // Auto-select header from contract's linked landlord
  const hSelect=document.querySelector('[name="headerId"]');
  if(hSelect && c.invHeaderId){
    hSelect.value=c.invHeaderId;
  }

  // Auto-fill due date (5th of next month)
  const dueDayOfMonth=(DB.formConfig&&DB.formConfig.dueDayOfMonth)||5;
  const monthInput=document.querySelector('[name="month"]');
  if(monthInput&&monthInput.value){
    const [y,mo]=monthInput.value.split('-');
    const dd=new Date(parseInt(y),parseInt(mo),dueDayOfMonth);
    document.querySelector('[name="dueDate"]').value=dateToBE(dd);
  }

  calcInvTotal();
  // Refresh hint with newly selected contract
  const moEl=document.querySelector('[name="month"]');
  const editIdEl=document.getElementById('invEditId');
  _updateInvContractHint(cid,moEl?moEl.value:'',editIdEl?parseInt(editIdEl.value)||null:null);
}

function saveInvoiceForm(existingId){
  const form=$('invoiceForm');
  const fd=new FormData(form);
  const cid=parseInt(fd.get('cid'))||(existingId?DB.invoices.find(x=>x.id===existingId)?.cid:null);
  if(!cid){toast('กรุณาเลือกสัญญา','warning');return;}

  const c=DB.contracts.find(x=>x.id===cid);
  const p=c?DB.properties.find(x=>x.pid===c.pid):null;
  const month=fd.get('month')||invoiceMonth;
  const freq=c?payFreq(c.rate,c.payment):{type:'monthly',label:'รายเดือน'};

  // Collect items (with VAT toggle per line)
  const items=[];
  document.querySelectorAll('.inv-item-row').forEach(row=>{
    const desc=row.querySelector('input[name^="itemDesc"]')?.value||'';
    const amt=parseFloat(row.querySelector('input[name^="itemAmt"]')?.value?.replace(/,/g,''))||0;
    const vatable=!!row.querySelector('input[name^="itemVat"]')?.checked;
    if(desc||amt>0)items.push({desc,amount:amt,vatable});
  });
  if(items.length===0){toast('กรุณาเพิ่มรายการอย่างน้อย 1 รายการ','warning');return;}
  const subVat=items.filter(it=>it.vatable).reduce((s,it)=>s+(parseFloat(it.amount)||0),0);
  const subNoVat=items.filter(it=>!it.vatable).reduce((s,it)=>s+(parseFloat(it.amount)||0),0);
  const vatRate=7;
  const vatAmount=+(subVat*vatRate/100).toFixed(2);
  const total=+(subNoVat+subVat+vatAmount).toFixed(2);
  const vatMode = subVat>0 ? 'lineitem' : 'none';

  // Auto-generate invoice number if empty (ใช้ max+1 กันเลขซ้ำ)
  let invoiceNo=fd.get('invoiceNo')||'';
  if(!invoiceNo){
    const existNums=(DB.invoices||[]).filter(x=>x.month===month).map(x=>{const m2=(x.invoiceNo||'').match(/-(\d+)$/);return m2?parseInt(m2[1]):0;});
    const nxt=Math.max(0,...existNums)+1;
    invoiceNo=`INV-${month}-${String(nxt).padStart(4,'0')}`;
  }

  // ── Collect remaining form fields ──
  const dateVal=fd.get('date')||fmtBE(new Date());
  const dueDateVal=fd.get('dueDate')||'';
  const headerIdVal=fd.get('headerId')||DB.defaultInvHeader||null;
  const statusVal=fd.get('status')||'draft';

  // ── Action: actual save (wrapped in closure เพื่อ reuse จาก confirm) ──
  function doSave(){
    if(existingId){
      const inv=DB.invoices.find(x=>x.id===existingId);
      if(!inv)return;
      const oldSnapshot={invoiceNo:inv.invoiceNo,total:inv.total,status:inv.status,items:JSON.parse(JSON.stringify(inv.items))};
      inv.invoiceNo=invoiceNo;
      inv.month=month;
      inv.date=dateVal||inv.date;
      inv.dueDate=dueDateVal||inv.dueDate;
      inv.headerId=headerIdVal||inv.headerId;
      inv.status=statusVal||inv.status;
      inv.items=items;
      inv.total=total;
      inv.vatMode=vatMode;
      inv.vatRate=vatRate;
      inv.vatBase=+subVat.toFixed(2);
      inv.vatAmount=vatAmount;
      inv.freqType=freq.type;
      inv.freqLabel=freq.label||'';
      inv.updatedAt=new Date().toISOString();
      // Reset partial state if total changed (ยอดใหม่ต้องคำนวณ remaining ใหม่)
      if(total!==oldSnapshot.total && inv.paidAmount!=null){
        inv.remainingAmount=Math.max(0,total-inv.paidAmount);
        if(inv.remainingAmount<=0.01){inv.status='paid';inv.remainingAmount=0;}
        else if(inv.paidAmount>0) inv.status='partial';
      }
      addActivityLog('edit_invoice',`แก้ไขใบแจ้งหนี้ ${invoiceNo}`);
      addInvoiceAudit(existingId,'edited','แก้ไข: '+[inv.total!==oldSnapshot.total?'ยอด '+fmtBaht(oldSnapshot.total,{sym:0})+'→'+fmtBaht(inv.total,{sym:0}):'',inv.invoiceNo!==oldSnapshot.invoiceNo?'เลขที่ '+oldSnapshot.invoiceNo+'→'+inv.invoiceNo:''].filter(Boolean).join(', ')||'แก้ไขรายละเอียด',oldSnapshot);
      toast('บันทึกการเปลี่ยนแปลงแล้ว');
    } else {
      DB.invoices.push({
        id:DB.nextInvId++,
        cid:cid,
        pid:c?.pid,
        month:month,
        tenant:c?.tenant||'',
        property:c?.property||p?.name||'',
        invoiceNo:invoiceNo,
        date:dateVal,
        dueDate:dueDateVal,
        items:items,
        total:total,
        vatMode:vatMode,
        vatRate:vatRate,
        vatBase:+subVat.toFixed(2),
        vatAmount:vatAmount,
        headerId:headerIdVal,
        freqType:freq.type,
        freqLabel:freq.label||'',
        status:statusVal,
        // Payment fields — symmetric with auto-generated invoices (line 1315-1317)
        // so partial-payment UI + aging report work for manually-created invoices
        paidAmount:0,
        remainingAmount:total,
        payments:[],
        createdAt:new Date().toISOString()
      });
      addActivityLog('create_invoice',`สร้างใบแจ้งหนี้ ${invoiceNo} — ${c?.tenant||''}`);
      addInvoiceAudit(DB.nextInvId-1,'created','สร้างใบแจ้งหนี้ '+invoiceNo+' ด้วยมือ — '+fmtBaht(total,{sym:0})+' บาท');
      toast('สร้างใบแจ้งหนี้แล้ว');
    }
    save();
    closeModal(true);
    invoiceMonth=month;
    invoiceTab='invoices';
    renderInvoicePage();
  }

  // ── Guard: cumulative total vs contract max ──
  const contractMax=c?invoiceAmount(c):0;
  if(contractMax>0){
    // ยอดรวมใบแจ้งหนี้ที่ออกแล้วในเดือนนี้ (ยกเว้นใบที่กำลังแก้ไข)
    const existingSum=(DB.invoices||[])
      .filter(x=>x.cid===cid&&x.month===month&&x.status!=='voided'&&x.id!==existingId)
      .reduce((s,x)=>s+(x.total||0),0);
    const newCumTotal=existingSum+total;
    if(newCumTotal>contractMax+0.01){
      const existingCount=(DB.invoices||[]).filter(x=>x.cid===cid&&x.month===month&&x.status!=='voided'&&x.id!==existingId).length;
      customConfirm(
        '⚠️ ยอดรวมเกินสัญญา',
        `ยอดรวมใบแจ้งหนี้เดือนนี้จะเป็น ${fmtBaht(newCumTotal,{sym:0})} บาท\n`+
        `(${existingCount>0?'ออกแล้ว '+fmtBaht(existingSum,{sym:0})+' + ใบนี้ '+fmtBaht(total,{sym:0}):'ใบนี้ '+fmtBaht(total,{sym:0})})\n\n`+
        `ยอดสูงสุดตามสัญญา: ${fmtBaht(contractMax,{sym:0})} บาท\n`+
        `เกินไป: ${fmtBaht(newCumTotal-contractMax,{sym:0})} บาท\n\n`+
        `ต้องการบันทึกต่อไปหรือไม่?`,
        doSave,
        {icon:'⚠️',yesLabel:'บันทึกต่อไป',yesColor:'#d97706',noLabel:'ยกเลิก'}
      );
      return;
    }
  }

  doSave();
}

// ═══════════════════════════════════════════
// BATCH PRINT — Invoice & Receipt
// ═══════════════════════════════════════════

// Action: toggle single invoice in batch select
function handleInvCheck(evt, invId){
  if(evt.shiftKey && _invLastChecked!=null){
    const a=_invVisibleIds.indexOf(_invLastChecked),b=_invVisibleIds.indexOf(invId);
    if(a!==-1&&b!==-1){
      const s=Math.min(a,b),e=Math.max(a,b);
      for(let i=s;i<=e;i++) invBatchSelect.add(_invVisibleIds[i]);
    }
  } else {
    if(invBatchSelect.has(invId)) invBatchSelect.delete(invId);
    else invBatchSelect.add(invId);
  }
  _invLastChecked=invId;
  renderInvoicePage();
}

// Action: select/deselect all visible invoices
function handleInvAllCheck(checked){
  if(checked) _invVisibleIds.forEach(id=>invBatchSelect.add(id));
  else{ _invVisibleIds.forEach(id=>invBatchSelect.delete(id)); }
  renderInvoicePage();
}

// Action: batch print invoices (useAll=true → print all visible, false → print selected only)
function batchPrintInvoices(useAll){
  const targetIds=useAll?_invVisibleIds:[..._invVisibleIds.filter(id=>invBatchSelect.has(id))];
  const invs=(DB.invoices||[]).filter(x=>targetIds.includes(x.id)&&x.status!=='voided');
  if(invs.length===0)return toast('ไม่มีใบแจ้งหนี้ที่จะพิมพ์','warning');
  verifyPIN(function(staff){
    invs.forEach(inv=>{inv.lastSignedAt=new Date().toISOString();});
    save();
    const html=invoiceHTML(invs,staff);
    openPrintOverlay(null,`ใบแจ้งหนี้ ${invs.length} ใบ`,html);
    invs.forEach(inv=>addInvoiceAudit(inv.id,'printed','พิมพ์ใบแจ้งหนี้ (batch '+invs.length+' ใบ) — ลงนามโดย '+staff.name));
  });
}

// Action: batch print receipts — รับ array ของ invIds
function batchPrintReceipts(ids){
  const invs=(DB.invoices||[]).filter(x=>ids.includes(x.id)&&x.status==='paid');
  if(invs.length===0)return toast('ไม่มีใบเสร็จ (เฉพาะที่ชำระแล้ว)','warning');
  verifyPIN(function(staff){
    invs.forEach(inv=>{inv.lastSignedAt=new Date().toISOString();});
    save();
    const html=batchReceiptHTML(invs,staff);
    openPrintOverlay(null,`ใบเสร็จรับเงิน ${invs.length} ใบ`,html);
    invs.forEach(inv=>addInvoiceAudit(inv.id,'receipt_printed','พิมพ์ใบเสร็จ (batch '+invs.length+' ใบ) — ลงนามโดย '+staff.name));
  });
}

// Render: สร้าง HTML สำหรับพิมพ์ใบเสร็จหลายใบในเอกสารเดียว
function batchReceiptHTML(invList, staff){
  // ดึงเฉพาะ page div จาก receiptHTML ของแต่ละใบ แล้วรวมเป็น document เดียว
  const pages=invList.map(inv=>{
    const full=receiptHTML(inv,staff);
    const idx=full.indexOf('<div class="page">');
    const end=full.lastIndexOf('</body>');
    return idx!==-1&&end!==-1?full.slice(idx,end).trim():'';
  }).join('\n');

  const today=new Date();
  const todayBE=dateToBE(today);
  const staffName=staff?staff.name:'';

  // ใช้ CSS จาก receiptHTML แต่ดึงมาจาก sample ใบแรก
  const sampleFull=receiptHTML(invList[0],staff);
  const styleMatch=sampleFull.match(/<style>([\s\S]*?)<\/style>/);
  const css=styleMatch?styleMatch[1]:'';

  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>${css}</style></head><body>
<div class="no-print" style="position:fixed;top:0;left:0;right:0;z-index:100;background:#059669;padding:8px 24px;display:flex;align-items:center;gap:16px;box-shadow:0 2px 12px rgba(0,0,0,.2)">
  <button onclick="window.print()" style="background:#fff;color:#059669;border:none;padding:8px 24px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">🖨️ พิมพ์ / PDF</button>
  ${staffName?'<span style="color:#fff;font-size:11px">✓ ลงนามโดย '+esc(staffName)+'</span>':''}
  <span style="color:rgba(255,255,255,.7);font-size:11px;margin-left:auto">ใบเสร็จรับเงิน ${invList.length} ใบ — ${todayBE}</span>
</div>
<div style="height:48px" class="no-print"></div>
${pages}
</body></html>`;
}

// ─── Action: batch mark selected draft invoices as sent ───────────────────────
function batchMarkSent(ids){
  if(!ids||!ids.length)return toast('ไม่มีใบที่ยังเป็น Draft','warning');
  const invs=(DB.invoices||[]).filter(x=>ids.includes(x.id)&&x.status==='draft');
  if(!invs.length)return toast('ใบที่เลือกไม่ได้อยู่ในสถานะ Draft','warning');
  customConfirm(
    '📤 ยืนยันส่งใบแจ้งหนี้',
    `เปลี่ยนสถานะ ${invs.length} ใบ เป็น "ส่งแล้ว" ?`,
    function(){
      const now=new Date().toISOString();
      invs.forEach(inv=>{
        inv.status='sent';
        inv.sentAt=now;
        addInvoiceAudit(inv.id,'sent','เปลี่ยนสถานะเป็น ส่งแล้ว (batch '+invs.length+' ใบ)');
        addActivityLog('invoice_sent','ส่งใบแจ้งหนี้ '+inv.invoiceNo+' (batch)');
      });
      save();
      invBatchSelect.clear();
      renderInvoicePage();
      toast('📤 อัปเดตแล้ว '+invs.length+' ใบ','success');
    },
    {icon:'📤',yesLabel:'ยืนยัน',yesColor:'#4f46e5'}
  );
}

// ─── Action: open batch receive-payment modal ─────────────────────────────────
function batchMarkPaid(ids){
  if(!ids||!ids.length)return toast('ไม่มีใบที่รับเงินได้','warning');
  const invs=(DB.invoices||[]).filter(x=>ids.includes(x.id)&&x.status!=='paid'&&x.status!=='voided');
  if(!invs.length)return toast('ใบที่เลือกชำระแล้วทั้งหมด','warning');
  const totalAmt=invs.reduce((s,x)=>{
    const rem=x.remainingAmount!=null?x.remainingAmount:(x.total||0)-(x.paidAmount||0);
    return s+Math.max(0,rem);
  },0);
  const today=new Date();
  const todayBE=dateToBE(today);

  $('mtitle').textContent='💰 รับเงิน '+invs.length+' ใบ';
  $('mbody').innerHTML=`
  <div>
    <!-- Summary card -->
    <div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:1px solid #86efac;border-radius:12px;padding:14px 16px;margin-bottom:12px">
      <div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">ยอดรวมที่จะรับ</div>
      <div style="font-size:24px;font-weight:800;color:#065f46">${fmtBaht(totalAmt,{sym:0})} <span style="font-size:13px;font-weight:500">บาท</span></div>
      <div style="font-size:11px;color:#64748b;margin-top:4px">${invs.length} ใบแจ้งหนี้ — ชำระครบทั้งหมดโดยอัตโนมัติ</div>
    </div>
    <!-- Invoice list -->
    <div style="max-height:160px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:12px">
      ${invs.map(inv=>{
        const rem=inv.remainingAmount!=null?inv.remainingAmount:(inv.total||0)-(inv.paidAmount||0);
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 12px;border-bottom:1px solid #f1f5f9;font-size:12px">
          <span style="color:#374151;font-weight:600">${esc(inv.invoiceNo)||'-'}</span>
          <span style="color:#6b7280">${esc(inv.tenant)||''}</span>
          <span style="font-weight:700;color:#059669">${fmtBaht(Math.max(0,rem),{sym:0})} บาท</span>
        </div>`;
      }).join('')}
    </div>
    <!-- Payment form -->
    <div style="display:grid;gap:12px">
      <!-- วันที่รับเงิน -->
      <div>
        <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px">📅 วันที่รับเงิน <span style="color:#ef4444">*</span></label>
        <div style="position:relative;max-width:200px">
          <input type="text" id="bpDate" value="${todayBE}" required placeholder="dd/mm/yyyy"
            style="width:100%;padding:9px 36px 9px 12px;border:2px solid #d1fae5;border-radius:8px;font-size:14px;font-family:Sarabun;font-weight:600;color:#065f46;background:#f0fdf4;box-sizing:border-box"
            oninput="this.style.borderColor=this.value?'#059669':'#ef4444'">
          <span onclick="openThaiDP(this.previousElementSibling)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:16px">📅</span>
        </div>
      </div>
      <!-- วิธีชำระ -->
      <div>
        <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px">💳 วิธีชำระเงิน</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${['โอนเงิน','เงินสด','เช็ค','อื่นๆ'].map((m,i)=>`<label style="display:flex;align-items:center;gap:6px;padding:7px 14px;border:2px solid ${i===0?'#059669':'#e5e7eb'};border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;color:${i===0?'#065f46':'#374151'};background:${i===0?'#f0fdf4':'#fff'};transition:all .15s" onclick="document.querySelectorAll('.bp-method').forEach(l=>{l.style.borderColor='#e5e7eb';l.style.background='#fff';l.style.color='#374151'});this.style.borderColor='#059669';this.style.background='#f0fdf4';this.style.color='#065f46';document.getElementById('bpMethod').value='${m}'" class="bp-method">${m}</label>`).join('')}
        </div>
        <input type="hidden" id="bpMethod" value="โอนเงิน">
      </div>
      <!-- เลขอ้างอิง -->
      <div>
        <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px">🔖 เลขอ้างอิง (ถ้ามี)</label>
        <input type="text" id="bpRef" placeholder="เช่น เลข transaction"
          style="width:100%;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:Sarabun;box-sizing:border-box">
      </div>
      <!-- หมายเหตุ -->
      <div>
        <label style="font-size:12px;font-weight:700;color:#374151;display:block;margin-bottom:6px">📝 หมายเหตุ</label>
        <input type="text" id="bpNote" placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
          style="width:100%;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:Sarabun;box-sizing:border-box">
      </div>
    </div>
    <!-- Submit button -->
    <div style="margin-top:16px;display:flex;justify-content:flex-end;gap:8px">
      <button onclick="closeModal()" style="padding:9px 20px;border:1px solid #d1d5db;background:#fff;border-radius:8px;font-size:13px;font-family:Sarabun;cursor:pointer">ยกเลิก</button>
      <button onclick="submitBatchPayment(${JSON.stringify(ids)})" style="padding:9px 24px;background:#059669;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;font-family:Sarabun;cursor:pointer">💰 บันทึกรับเงิน ${invs.length} ใบ</button>
    </div>
  </div>`;
  $('modal').classList.remove('hidden');
}

// ─── Action: submit batch payment (full remaining per invoice) ────────────────
function submitBatchPayment(ids){
  const invs=(DB.invoices||[]).filter(x=>ids.includes(x.id)&&x.status!=='paid'&&x.status!=='voided');
  if(!invs.length){closeModal();return;}
  const dateVal=(document.getElementById('bpDate').value||'').trim();
  if(!dateVal){document.getElementById('bpDate').style.borderColor='#ef4444';return toast('⚠ กรุณาระบุวันที่รับเงิน');}
  const method=document.getElementById('bpMethod').value||'โอนเงิน';
  const ref=(document.getElementById('bpRef').value||'').trim();
  const note=(document.getElementById('bpNote').value||'').trim();

  // Parse BE date to ISO
  const parts=dateVal.split('/');
  let paidISO=new Date().toISOString();
  if(parts.length===3){
    const d=parseInt(parts[0]),m=parseInt(parts[1])-1,y=parseInt(parts[2])-543;
    if(!isNaN(d)&&!isNaN(m)&&!isNaN(y)){const pd=new Date(y,m,d,12,0,0);if(!isNaN(pd.getTime()))paidISO=pd.toISOString();}
  }

  if(!DB.nextReceiptId) DB.nextReceiptId=1;
  let totalCollected=0;
  invs.forEach(inv=>{
    const rem=inv.remainingAmount!=null?inv.remainingAmount:Math.max(0,(inv.total||0)-(inv.paidAmount||0));
    if(rem<=0)return;
    const receiptNo='REC-'+inv.month+'-'+String(DB.nextReceiptId++).padStart(4,'0');
    if(!inv.payments) inv.payments=[];
    inv.payments.push({receiptNo,date:paidISO,amount:rem,method,ref,slip:'',note});
    inv.paidAmount=(inv.paidAmount||0)+rem;
    inv.remainingAmount=0;
    inv.status='paid';
    inv.paidAt=paidISO;
    inv.payMethod=method;
    inv.receiptNo=receiptNo;
    if(ref) inv.payRef=ref;
    if(note) inv.payNote=note;
    totalCollected+=rem;
    addInvoiceAudit(inv.id,'paid','รับเงิน '+fmtBaht(rem,{sym:0})+' บาท ('+method+')'+(ref?' ref:'+ref:'')+' → '+receiptNo+' (batch '+invs.length+' ใบ)');
    addActivityLog('receive_payment','บันทึกรับเงิน '+inv.invoiceNo+' — '+fmtBaht(rem,{sym:0})+' บาท '+receiptNo+' (batch)');
  });
  save();
  closeModal();
  invBatchSelect.clear();
  renderInvoicePage();
  toast('✅ รับเงินแล้ว '+invs.length+' ใบ รวม '+fmtBaht(totalCollected,{sym:0})+' บาท','success');
}

// B5: Auto-void drafts older than N days (runs on boot)
// Config: DB.sysConfig.draftVoidEnabled (default true), DB.sysConfig.draftVoidDays (default 60)
function autoVoidExpiredDrafts(){
  const cfg=DB.sysConfig||(DB.sysConfig={});
  if(cfg.draftVoidEnabled===false) return 0;
  const days=parseInt(cfg.draftVoidDays)||60;
  const cutoffTs=Date.now()-days*864e5;
  const nowISO=new Date().toISOString();
  let count=0;
  (DB.invoices||[]).forEach(inv=>{
    if(inv.status!=='draft')return;
    // Prefer createdAt (system timestamp); fallback to inv.date (BE string)
    let createdTs=null;
    if(inv.createdAt){
      const t=Date.parse(inv.createdAt);
      if(!isNaN(t))createdTs=t;
    }
    if(createdTs==null && inv.date){
      const p=parseBE(inv.date);
      if(p)createdTs=p.getTime();
    }
    if(createdTs==null || createdTs>cutoffTs) return;
    inv.status='voided';
    inv.voidedAt=nowISO;
    inv.voidReason='ร่างค้างเกิน '+days+' วัน (auto)';
    if(typeof addInvoiceAudit==='function'){
      try{ addInvoiceAudit(inv.id,'auto_voided','ยกเลิกร่างอัตโนมัติ (ค้าง > '+days+' วัน)'); }catch(e){}
    }
    count++;
  });
  if(count>0){
    try{ save(); }catch(e){}
    if(typeof addActivityLog==='function'){
      try{ addActivityLog('auto_void_drafts','ยกเลิกใบร่างอัตโนมัติ '+count+' ฉบับ (ค้าง > '+days+' วัน)'); }catch(e){}
    }
  }
  return count;
}

function voidInvoice(invId){
  if(!hasPermission('void')){toast('คุณไม่มีสิทธิ์ยกเลิกใบแจ้งหนี้','error');return;}
  const inv=DB.invoices.find(x=>x.id===invId);
  if(!inv)return;
  if(inv.status==='voided')return toast('ใบแจ้งหนี้นี้ถูกยกเลิกแล้ว','warning');
  customConfirm('ยกเลิกใบแจ้งหนี้','ยกเลิก (Void) ใบแจ้งหนี้ '+inv.invoiceNo+'?\n\nใบแจ้งหนี้จะยังคงอยู่ในระบบเพื่อการตรวจสอบ แต่จะไม่นับรวมในยอดค้างชำระ',function(){
    const oldStatus=inv.status;
    inv.status='voided';
    inv.voidedAt=new Date().toISOString();
    inv.voidReason='ยกเลิกโดยผู้ใช้';
    addInvoiceAudit(invId, 'voided', 'ยกเลิกใบแจ้งหนี้ (สถานะเดิม: '+(oldStatus==='draft'?'ร่าง':oldStatus==='sent'?'ส่งแล้ว':oldStatus==='paid'?'ชำระแล้ว':oldStatus)+')');
    addActivityLog('void_invoice','ยกเลิกใบแจ้งหนี้ '+inv.invoiceNo);
    save();
    toast('ยกเลิกใบแจ้งหนี้แล้ว');
    renderInvoicePage();
  },{icon:'🚫',yesLabel:'ยกเลิกใบแจ้งหนี้',yesColor:'#dc2626'});
}

function deleteInvoice(invId){
  if(!hasPermission('delete')){toast('คุณไม่มีสิทธิ์ลบใบแจ้งหนี้','error');return;}
  const inv=DB.invoices.find(x=>x.id===invId);
  if(!inv)return;
  customConfirm('ลบใบแจ้งหนี้','ลบใบแจ้งหนี้ '+inv.invoiceNo+'?',function(){
    const r=actionDeleteInvoice(invId);
    if(!r)return;
    addActivityLog('delete_invoice','ลบใบแจ้งหนี้ '+r.invoiceNo);
    toast('ลบแล้ว');
    renderInvoicePage();
  },{icon:'🗑️',yesLabel:'ลบ',yesColor:'#dc2626'});
}

function openInvoiceHeaderSettings(){
  $('mtitle').textContent='จัดการผู้ให้เช่า / บริษัท';
  let html=`<div style="max-height:70vh;overflow-y:auto">`;

  if(DB.invoiceHeaders.length===0){
    html+=`<div style="padding:20px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;margin-bottom:16px">
      <p style="margin:0;font-size:13px;color:#166534">ยังไม่มีข้อมูลผู้ให้เช่า เริ่มต้นด้วยการเพิ่มผู้ให้เช่า/บริษัทใหม่</p>
    </div>`;
  }else{
    DB.invoiceHeaders.forEach((h,idx)=>{
      html+=`<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div style="flex:1">
            <div style="font-weight:600;margin-bottom:4px">${esc(h.name)}</div>
            <div style="font-size:11px;color:#64748b;margin-bottom:8px">${esc(h.companyName)}<br>${esc(h.address)}<br>Tel: ${esc(h.phone)} | Tax ID: ${esc(h.taxId)}</div>
            ${h.logo?`<img src="${esc(h.logo)}" style="max-width:80px;max-height:60px;margin-bottom:8px">`:''}<br>
            <button onclick="editInvoiceHeader(${h.id})" style="padding:4px 12px;background:#3b82f6;color:#fff;border:none;border-radius:4px;font-size:11px;cursor:pointer">แก้ไข</button>
            <button onclick="setDefaultInvoiceHeader(${h.id})" style="padding:4px 12px;background:${DB.defaultInvHeader===h.id?'#10b981':'#f3f4f6'};color:${DB.defaultInvHeader===h.id?'#fff':'#475569'};border:none;border-radius:4px;font-size:11px;cursor:pointer;margin-left:4px">${DB.defaultInvHeader===h.id?'✓ ค่าเริ่มต้น':'ตั้งเป็นค่าเริ่มต้น'}</button>
            ${hasPermission('delete')?`<button onclick="deleteInvoiceHeader(${h.id})" style="padding:4px 12px;background:#fee2e2;color:#dc2626;border:none;border-radius:4px;font-size:11px;cursor:pointer;margin-left:4px">ลบ</button>`:''}
          </div>
        </div>
      </div>`;
    });
  }

  html+=`<div style="margin-top:16px"><button onclick="addInvoiceHeader()" style="padding:10px 20px;background:#10b981;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">+ เพิ่มผู้ให้เช่า/บริษัท</button></div></div>`;

  $('mbody').innerHTML=html;
  document.getElementById('modal').classList.remove('hidden');
}

function addInvoiceHeader(){
  window._logoDataUrl=null;
  $('mtitle').textContent='เพิ่มผู้ให้เช่า / บริษัท';
  $('mbody').innerHTML=`<form id="headerForm" style="display:flex;flex-direction:column;gap:12px">
    <div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">ชื่อย่อ (สำหรับเลือก)</label>
      <input type="text" id="hdrName" placeholder="เช่น สำนักงานหลัก, บจก.ABC" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">ชื่อผู้ให้เช่า / บริษัท</label>
      <input type="text" id="hdrCompany" placeholder="บริษัท สมบัตินภา จำกัด" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">ที่อยู่</label>
      <textarea id="hdrAddress" placeholder="ที่อยู่..." style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun;height:60px"></textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">เบอรโทร</label>
        <input type="text" id="hdrPhone" placeholder="02-1234-5678" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
      </div>
      <div>
        <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">หมายเลขประจำตัวผู้เสียภาษี</label>
        <input type="text" id="hdrTaxId" placeholder="0123456789012" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
      </div>
    </div>
    <div style="border:1px solid #fde68a;border-radius:8px;padding:12px;background:#fffbeb">
      <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:8px">🧾 ภาษีมูลค่าเพิ่ม (VAT)</div>
      <select id="hdrVatMode" onchange="document.getElementById('hdrVatRateBox').style.display=this.value==='none'?'none':'block'" style="width:100%;padding:8px;border:1px solid #fde68a;border-radius:6px;font-size:13px;font-family:Sarabun;background:#fff">
        <option value="none">ไม่จด VAT</option>
        <option value="inclusive">จด VAT — ราคารวม VAT แล้ว (Inclusive)</option>
        <option value="exclusive">จด VAT — บวก VAT เพิ่ม (Exclusive)</option>
      </select>
      <div id="hdrVatRateBox" style="display:none;margin-top:10px">
        <label style="display:block;font-size:11px;font-weight:600;color:#92400e;margin-bottom:4px">อัตรา VAT (%)</label>
        <input type="number" id="hdrVatRate" value="7" min="0" max="100" step="0.1" style="width:120px;padding:6px 8px;border:1px solid #fde68a;border-radius:6px;font-size:13px;font-family:Sarabun;background:#fff">
        <div style="font-size:10px;color:#a16207;margin-top:6px">Inclusive = ค่าเช่า 10,700 = 10,000 + VAT 700 / Exclusive = ค่าเช่า 10,000 + VAT 700 = 10,700</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">ธนาคาร</label>
        <input type="text" id="hdrBank" placeholder="ธ.กสิกรไทย" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
      </div>
      <div>
        <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">เลขบัญชี</label>
        <input type="text" id="hdrAccount" placeholder="123-4-56789-0" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
      </div>
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">ชื่อบัญชี</label>
      <input type="text" id="hdrAccountName" placeholder="บจก. สมบัตินภา" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
    </div>
    <div style="border:1px solid #bfdbfe;border-radius:8px;padding:12px;background:#f0f9ff">
      <div style="font-weight:700;font-size:12px;color:#1e40af;margin-bottom:8px">⚡ PromptPay (สร้าง QR อัตโนมัติในใบแจ้งหนี้)</div>
      <div>
        <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">PromptPay ID <span style="font-size:10px;color:#64748b;font-weight:400">(เบอร์ 10 หลัก / นิติบุคคล หรือบัตรประชาชน 13 หลัก / e-Wallet 15 หลัก)</span></label>
        <input type="text" id="hdrPromptPayId" placeholder="เช่น 0812345678 หรือ 0105556789012" oninput="_ppPreview()" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        <div>
          <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">ชื่อบัญชี PromptPay</label>
          <input type="text" id="hdrPromptPayName" placeholder="บจ. สมบัตินภา" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">ธนาคาร PromptPay</label>
          <input type="text" id="hdrPromptPayBank" placeholder="กสิกรไทย" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
        </div>
      </div>
      <div id="ppPreviewBox" style="margin-top:10px;display:none;padding:10px;background:#fff;border:1px solid #bfdbfe;border-radius:8px;text-align:center">
        <div style="font-size:10px;color:#64748b;margin-bottom:6px">ตัวอย่าง QR (ยอด 100 บาท)</div>
        <div id="ppPreviewImg"></div>
      </div>
      <div style="font-size:10px;color:#059669;margin-top:6px">⚡ ระบบจะสร้าง QR พร้อมยอดเงินอัตโนมัติในทุกใบแจ้งหนี้</div>
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">หมายเหตุ (แสดงท้ายใบแจ้งหนี้)</label>
      <textarea id="hdrNotes" placeholder="เช่น กรุณาชำระภายในกำหนด / กรุณาแจ้งหลักฐานการโอนเงิน" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun;height:60px"></textarea>
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">โลโก้ (ขนาดไฟล์สูงสุด 200KB)</label>
      <input type="file" id="hdrLogo" accept="image/*" onchange="uploadLogo(this)" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px">
      <div id="logoPreview" style="margin-top:8px"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button type="button" onclick="closeModal()" style="flex:1;padding:10px;background:#f3f4f6;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">ยกเลิก</button>
      <button type="button" onclick="saveInvoiceHeader()" style="flex:1;padding:10px;background:#10b981;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">บันทึก</button>
    </div>
  </form>`;
}

function uploadLogo(input){
  if(!input.files[0])return;
  const file=input.files[0];
  if(file.size>200000){toast('ไฟล์ใหญ่เกินไป (สูงสุด 200KB)','error');return;}
  const reader=new FileReader();
  reader.onload=function(e){
    const dataUrl=e.target.result;
    window._logoDataUrl=dataUrl;
    $('logoPreview').innerHTML=`<img src="${esc(dataUrl)}" style="max-width:100px;max-height:80px;border-radius:6px;border:1px solid #e5e7eb">`;
  };
  reader.readAsDataURL(file);
}

function uploadQR(input){
  if(!input.files[0])return;
  const file=input.files[0];
  if(file.size>300000){toast('ไฟล์ QR ใหญ่เกินไป (สูงสุด 300KB)','error');return;}
  compressImage(file, 400, 0.8, function(dataUrl){
    window._qrDataUrl=dataUrl;
    document.getElementById('qrPreview').innerHTML='<img src="'+dataUrl+'" style="max-width:120px;max-height:120px;border-radius:8px;border:1px solid #e5e7eb">';
  });
}

function saveInvoiceHeader(){
  const name=$('hdrName').value.trim();
  const company=$('hdrCompany').value.trim();
  const address=$('hdrAddress').value.trim();
  const phone=$('hdrPhone').value.trim();
  const taxId=$('hdrTaxId').value.trim();
  const bank=$('hdrBank').value.trim();
  const account=$('hdrAccount').value.trim();
  const accountName=$('hdrAccountName').value.trim();
  const notes=document.getElementById('hdrNotes')?.value?.trim()||'';

  if(!name||!company){toast('กรุณากรอกชื่อและบริษัท','error');return;}

  const header={
    id:Date.now(),
    name:name,
    companyName:shortLandlordName(company),
    address:address,
    phone:phone,
    taxId:taxId,
    vatMode:document.getElementById('hdrVatMode')?.value||'none',
    vatRegistered:(document.getElementById('hdrVatMode')?.value||'none')!=='none',
    vatRate:parseFloat(document.getElementById('hdrVatRate')?.value)||7,
    bankName:bank,
    bankAccount:account,
    bankAccountName:accountName,
    logo:window._logoDataUrl||null,
    promptPayId:document.getElementById('hdrPromptPayId')?.value?.trim()||'',
    promptPayName:document.getElementById('hdrPromptPayName')?.value?.trim()||'',
    promptPayBank:document.getElementById('hdrPromptPayBank')?.value?.trim()||'',
    notes:notes
  };

  DB.invoiceHeaders.push(header);
  if(DB.invoiceHeaders.length===1)DB.defaultInvHeader=header.id;
  addActivityLog('add_invoice_header',`เพิ่มส่วนหัวใบแจ้งหนี้ "${name}"`);
  save();
  toast('เพิ่มผู้ให้เช่า/บริษัทแล้ว');
  openInvoiceHeaderSettings();
}

function editInvoiceHeader(headerId){
  const h=DB.invoiceHeaders.find(x=>x.id===headerId);
  if(!h)return;
  window._logoDataUrl=null;
  $('mtitle').textContent='แก้ไขผู้ให้เช่า / บริษัท';
  $('mbody').innerHTML=`<form id="headerForm" style="display:flex;flex-direction:column;gap:12px">
    <div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">ชื่อย่อ (สำหรับเลือก)</label>
      <input type="text" id="hdrName" value="${esc(h.name)}" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">ชื่อผู้ให้เช่า / บริษัท</label>
      <input type="text" id="hdrCompany" value="${esc(h.companyName)}" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">ที่อยู่</label>
      <textarea id="hdrAddress" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun;height:60px">${esc(h.address)}</textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">เบอรโทร</label>
        <input type="text" id="hdrPhone" value="${esc(h.phone)}" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
      </div>
      <div>
        <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">หมายเลขประจำตัวผู้เสียภาษี</label>
        <input type="text" id="hdrTaxId" value="${esc(h.taxId)||''}" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
      </div>
    </div>
    <div style="border:1px solid #fde68a;border-radius:8px;padding:12px;background:#fffbeb">
      <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:8px">🧾 ภาษีมูลค่าเพิ่ม (VAT)</div>
      ${(()=>{const _m=h.vatMode||(h.vatRegistered?'inclusive':'none');return `
      <select id="hdrVatMode" onchange="document.getElementById('hdrVatRateBox').style.display=this.value==='none'?'none':'block'" style="width:100%;padding:8px;border:1px solid #fde68a;border-radius:6px;font-size:13px;font-family:Sarabun;background:#fff">
        <option value="none" ${_m==='none'?'selected':''}>ไม่จด VAT</option>
        <option value="inclusive" ${_m==='inclusive'?'selected':''}>จด VAT — ราคารวม VAT แล้ว (Inclusive)</option>
        <option value="exclusive" ${_m==='exclusive'?'selected':''}>จด VAT — บวก VAT เพิ่ม (Exclusive)</option>
      </select>
      <div id="hdrVatRateBox" style="display:${_m==='none'?'none':'block'};margin-top:10px">
        <label style="display:block;font-size:11px;font-weight:600;color:#92400e;margin-bottom:4px">อัตรา VAT (%)</label>
        <input type="number" id="hdrVatRate" value="${h.vatRate!=null?h.vatRate:7}" min="0" max="100" step="0.1" style="width:120px;padding:6px 8px;border:1px solid #fde68a;border-radius:6px;font-size:13px;font-family:Sarabun;background:#fff">
        <div style="font-size:10px;color:#a16207;margin-top:6px">Inclusive = ค่าเช่า 10,700 = 10,000 + VAT 700 / Exclusive = ค่าเช่า 10,000 + VAT 700 = 10,700</div>
      </div>`;})()}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">ธนาคาร</label>
        <input type="text" id="hdrBank" value="${esc(h.bankName)}" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
      </div>
      <div>
        <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">เลขบัญชี</label>
        <input type="text" id="hdrAccount" value="${esc(h.bankAccount)}" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
      </div>
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">ชื่อบัญชี</label>
      <input type="text" id="hdrAccountName" value="${esc(h.bankAccountName)}" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
    </div>
    <div>
    <div style="border:1px solid #bfdbfe;border-radius:8px;padding:12px;background:#f0f9ff">
      <div style="font-weight:700;font-size:12px;color:#1e40af;margin-bottom:8px">⚡ PromptPay (สร้าง QR อัตโนมัติในใบแจ้งหนี้)</div>
      <div>
        <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">PromptPay ID <span style="font-size:10px;color:#64748b;font-weight:400">(เบอร์ 10 หลัก / นิติบุคคล หรือบัตรประชาชน 13 หลัก / e-Wallet 15 หลัก)</span></label>
        <input type="text" id="hdrPromptPayId" value="${esc(h.promptPayId)||''}" placeholder="เช่น 0812345678 หรือ 0105556789012" oninput="_ppPreview()" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        <div>
          <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">ชื่อบัญชี PromptPay</label>
          <input type="text" id="hdrPromptPayName" value="${esc(h.promptPayName)||''}" placeholder="บจ. สมบัตินภา" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">ธนาคาร PromptPay</label>
          <input type="text" id="hdrPromptPayBank" value="${esc(h.promptPayBank)||''}" placeholder="กสิกรไทย" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
        </div>
      </div>
      <div id="ppPreviewBox" style="margin-top:10px;${h.promptPayId?'':'display:none;'}padding:10px;background:#fff;border:1px solid #bfdbfe;border-radius:8px;text-align:center">
        <div style="font-size:10px;color:#64748b;margin-bottom:6px">ตัวอย่าง QR (ยอด 100 บาท)</div>
        <div id="ppPreviewImg"></div>
      </div>
      <div style="font-size:10px;color:#059669;margin-top:6px">⚡ ระบบจะสร้าง QR พร้อมยอดเงินอัตโนมัติในทุกใบแจ้งหนี้</div>
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">หมายเหตุ (แสดงท้ายใบแจ้งหนี้)</label>
      <textarea id="hdrNotes" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun;height:60px">${esc(h.notes)||''}</textarea>
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">โลโก้ (ขนาดไฟล์สูงสุด 200KB)</label>
      <input type="file" id="hdrLogo" accept="image/*" onchange="uploadLogo(this)" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px">
      <div id="logoPreview" style="margin-top:8px">${h.logo?`<img src="${esc(h.logo)}" style="max-width:100px;max-height:80px;border-radius:6px;border:1px solid #e5e7eb">`:''}</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button type="button" onclick="openInvoiceHeaderSettings()" style="flex:1;padding:10px;background:#f3f4f6;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">ยกเลิก</button>
      <button type="button" onclick="updateInvoiceHeader(${headerId})" style="flex:1;padding:10px;background:#10b981;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">บันทึก</button>
    </div>
  </form>`;
  // Auto-show QR preview if promptPayId exists
  if(h.promptPayId)setTimeout(()=>_ppPreview(),100);
}

function updateInvoiceHeader(headerId){
  const h=DB.invoiceHeaders.find(x=>x.id===headerId);
  if(!h)return;
  h.name=$('hdrName').value.trim();
  h.companyName=shortLandlordName($('hdrCompany').value.trim());
  h.address=$('hdrAddress').value.trim();
  h.phone=$('hdrPhone').value.trim();
  h.taxId=$('hdrTaxId').value.trim();
  h.vatMode=document.getElementById('hdrVatMode')?.value||'none';
  h.vatRegistered=h.vatMode!=='none';
  h.vatRate=parseFloat(document.getElementById('hdrVatRate')?.value)||7;
  h.bankName=$('hdrBank').value.trim();
  h.bankAccount=$('hdrAccount').value.trim();
  h.bankAccountName=$('hdrAccountName').value.trim();
  if(window._logoDataUrl)h.logo=window._logoDataUrl;
  h.promptPayId=document.getElementById('hdrPromptPayId')?.value?.trim()||h.promptPayId||'';
  h.promptPayName=document.getElementById('hdrPromptPayName')?.value?.trim()||'';
  h.promptPayBank=document.getElementById('hdrPromptPayBank')?.value?.trim()||'';
  h.notes=document.getElementById('hdrNotes')?.value?.trim()||'';
  addActivityLog('edit_invoice_header',`แก้ไขส่วนหัวใบแจ้งหนี้ "${h.name}"`);
  save();
  toast('อัปเดตแล้ว');
  openInvoiceHeaderSettings();
}

function setDefaultInvoiceHeader(headerId){
  DB.defaultInvHeader=headerId;
  save();
  toast('ตั้งเป็นค่าเริ่มต้นแล้ว');
  openInvoiceHeaderSettings();
}

function deleteInvoiceHeader(headerId){
  if(!hasPermission('delete')){toast('คุณไม่มีสิทธิ์ลบส่วนหัว','error');return;}
  customConfirm('ลบส่วนหัว','ลบส่วนหัวนี้?',function(){
    if(!actionDeleteInvoiceHeader(headerId))return;
    // Re-home default pointer if we deleted the default (action layer doesn't touch this pointer)
    if(DB.defaultInvHeader===headerId){DB.defaultInvHeader=DB.invoiceHeaders[0]?.id||null;save();}
    addActivityLog('delete_invoice_header','ลบส่วนหัวใบแจ้งหนี้');
    toast('ลบแล้ว');
    openInvoiceHeaderSettings();
  },{icon:'🗑️',yesLabel:'ลบ',yesColor:'#dc2626'});
}

// ========== STAFF PIN SYSTEM ==========
function openStaffSettings(){
  const staff=DB.staff||[];
  $('mtitle').textContent='จัดการพนักงาน';
  let html='<div style="max-height:70vh;overflow-y:auto">';
  if(staff.length>0){
    html+=staff.map((s,i)=>`<div style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:8px">
      <div style="width:40px;height:40px;border-radius:50%;background:${['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#8b5cf6'][i%6]};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px">${esc(s.name.charAt(0))}</div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:14px;color:#1e293b">${esc(s.name)}</div>
        <div style="font-size:11px;color:#64748b">${esc(s.role)||'พนักงาน'} · PIN: ****</div>
      </div>
      <button onclick="editStaff(${i})" style="padding:4px 12px;background:#eef2ff;color:#4338ca;border:none;border-radius:6px;font-size:11px;cursor:pointer;font-family:Sarabun">แก้ไข</button>
      ${hasPermission('staff')?`<button onclick="deleteStaff(${i})" style="padding:4px 12px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;font-size:11px;cursor:pointer;font-family:Sarabun">ลบ</button>`:''}
    </div>`).join('');
  } else {
    html+='<div style="text-align:center;padding:30px;color:#64748b"><div style="font-size:32px;margin-bottom:8px">👤</div>ยังไม่มีพนักงาน</div>';
  }
  html+='<button onclick="addStaffForm()" style="margin-top:16px;padding:10px 20px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun;width:100%">+ เพิ่มพนักงาน</button></div>';
  $('mbody').innerHTML=html;
  $('modal').classList.remove('hidden');
}

function addStaffForm(){
  window._staffSigUrl=undefined;
  $('mtitle').textContent='เพิ่มพนักงาน';
  $('mbody').innerHTML=`<form id="staffForm" style="display:flex;flex-direction:column;gap:14px">
    <div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">ชื่อ-นามสกุล</label>
      <input type="text" id="staffName" placeholder="สมชาย ใจดี" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;font-family:Sarabun">
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">บทบาท</label>
      <select id="staffRole" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;font-family:Sarabun">
        <option value="staff">พนักงาน (Staff)</option>
        <option value="manager">ผู้จัดการ (Manager)</option>
        <option value="admin">ผู้ดูแลระบบ (Admin)</option>
      </select>
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">อีเมล Google Workspace</label>
      <input type="email" id="staffEmail" placeholder="user@yourdomain.com" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;font-family:Sarabun">
      <div style="font-size:10px;color:#64748b;margin-top:4px">ใช้สำหรับ login ด้วย Google — ผู้ที่มีอีเมลนี้จะเข้าระบบในบทบาทที่กำหนด</div>
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">ลายเซ็น (สำหรับใบแจ้งหนี้)</label>
      <input type="file" accept="image/*" onchange="uploadStaffSig(this)" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px;font-size:12px">
      <div id="staffSigPreview" style="margin-top:6px;min-height:20px"></div>
      <div style="font-size:10px;color:#64748b;margin-top:4px">อัปโหลดรูปลายเซ็น — จะแสดงในใบแจ้งหนี้เมื่อลงนาม</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button type="button" onclick="showPage('settings');settingsTab='staff';renderSettingsPage()" style="flex:1;padding:10px;background:#f3f4f6;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">ยกเลิก</button>
      <button type="button" onclick="saveStaff()" style="flex:1;padding:10px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">บันทึก</button>
    </div>
  </form>`;
}

function saveStaff(editIdx){
  const name=document.getElementById('staffName').value.trim();
  const role=document.getElementById('staffRole').value.trim();
  const email=(document.getElementById('staffEmail').value||'').trim().toLowerCase();
  if(!name){toast('กรุณากรอกชื่อ','error');return;}
  if(!role){toast('กรุณาเลือกบทบาท','error');return;}
  if(!email||!/.+@.+\..+/.test(email)){toast('กรุณากรอกอีเมลให้ถูกต้อง','error');return;}
  if(!DB.staff)DB.staff=[];
  // ป้องกันอีเมลซ้ำ
  const dup=DB.staff.find((s,i)=>s.email===email&&i!==editIdx);
  if(dup){toast('อีเมลนี้มีอยู่แล้ว','error');return;}
  if(editIdx!==undefined&&editIdx!==null){
    DB.staff[editIdx].name=name;
    DB.staff[editIdx].role=role;
    DB.staff[editIdx].email=email;
    if(window._staffSigUrl!==undefined)DB.staff[editIdx].signatureImg=window._staffSigUrl;
  } else {
    DB.staff.push({name,role,email,signatureImg:window._staffSigUrl||'',createdAt:new Date().toISOString()});
  }
  window._staffSigUrl=undefined;
  addActivityLog('staff','บันทึกพนักงาน '+name);
  save();
  toast('บันทึกแล้ว');
  showPage('settings');settingsTab='staff';renderSettingsPage();
}

function editStaff(idx){
  const s=DB.staff[idx];
  if(!s)return;
  window._staffSigUrl=undefined;
  $('mtitle').textContent='แก้ไขพนักงาน';
  $('mbody').innerHTML=`<form id="staffForm" style="display:flex;flex-direction:column;gap:14px">
    <div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">ชื่อ-นามสกุล</label>
      <input type="text" id="staffName" value="${esc(s.name)}" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;font-family:Sarabun">
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">บทบาท</label>
      <select id="staffRole" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;font-family:Sarabun">
        <option value="staff" ${(s.role||'staff')==='staff'?'selected':''}>พนักงาน (Staff)</option>
        <option value="manager" ${s.role==='manager'?'selected':''}>ผู้จัดการ (Manager)</option>
        <option value="admin" ${s.role==='admin'?'selected':''}>ผู้ดูแลระบบ (Admin)</option>
      </select>
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">อีเมล Google Workspace</label>
      <input type="email" id="staffEmail" value="${esc(s.email)||''}" placeholder="user@yourdomain.com" style="width:100%;padding:10px;border:1px solid #e5e7eb;border-radius:8px;font-size:14px;font-family:Sarabun">
    </div>
    <div>
      <label style="display:block;font-size:12px;font-weight:600;margin-bottom:4px">ลายเซ็น (สำหรับใบแจ้งหนี้)</label>
      <input type="file" accept="image/*" onchange="uploadStaffSig(this)" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:8px;font-size:12px">
      <div id="staffSigPreview" style="margin-top:6px;min-height:20px">${s.signatureImg?'<img src="'+esc(s.signatureImg)+'" style="max-height:52px;border-radius:4px;border:1px solid #e5e7eb;background:#f8fafc;padding:4px">':''}</div>
      <div style="font-size:10px;color:#64748b;margin-top:4px">อัปโหลดรูปใหม่เพื่อเปลี่ยนลายเซ็น (ทิ้งว่างไว้เพื่อคงของเดิม)</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button type="button" onclick="showPage('settings');settingsTab='staff';renderSettingsPage()" style="flex:1;padding:10px;background:#f3f4f6;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">ยกเลิก</button>
      <button type="button" onclick="saveStaff(${idx})" style="flex:1;padding:10px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">บันทึก</button>
    </div>
  </form>`;
}

function deleteStaff(idx){
  if(!hasPermission('staff')){toast('คุณไม่มีสิทธิ์ลบพนักงาน','error');return;}
  const s=DB.staff[idx];
  if(!s)return;
  customConfirm('ลบพนักงาน','ลบ '+s.name+' ?',function(){
    DB.staff.splice(idx,1);
    addActivityLog('staff','ลบพนักงาน '+s.name);
    save();
    toast('ลบแล้ว');
    showPage('settings');settingsTab='staff';renderSettingsPage();
  },{icon:'🗑️',yesLabel:'ลบ',yesColor:'#dc2626'});
}

function verifyPIN(callback){
  // Google auth — ไม่ต้องใส่ PIN, ใช้ currentUser โดยตรง
  callback(currentUser || {name:'(ไม่ระบุ)', role:''});
}

// ========== SHARED INVOICE HELPERS ==========
function enrichDesc(it,inv){
  const d=it.desc;
  if(/ประจำเดือน|ไตรมาสที่|ครึ่งปี\d|ประจำปี/.test(d))return d;
  if(!d.startsWith('ค่าเช่า'))return d;
  const [y,mo]=inv.month.split('-');
  const yearBE=parseInt(y)+543;
  const mNum=parseInt(mo);
  const shortY=String(parseInt(y)).slice(-2);
  const thM=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const thMFull=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const freq=inv.freqType||'monthly';
  if(freq==='monthly')return'ค่าเช่าประจำเดือน '+thMFull[mNum-1]+' '+yearBE;
  if(freq==='quarterly'){const q=Math.ceil(mNum/3);return'ค่าเช่าไตรมาสที่ '+q+' ('+thM[(q-1)*3]+'-'+thM[Math.min(q*3-1,11)]+' '+yearBE+')';}
  if(freq==='semi'){const h=mNum<=6?1:2;return'ค่าเช่าครึ่งปี'+h+' ('+(h===1?'ม.ค.':'ก.ค.')+'-'+(h===1?'มิ.ย.':'ธ.ค.')+' '+yearBE+')';}
  if(freq==='yearly')return'ค่าเช่าประจำปี '+yearBE+' (1 ม.ค. '+shortY+' - 31 ธ.ค. '+shortY+')';
  return d;
}

// ========== PROMPTPAY QR GENERATION ==========
function _crc16CCITT(str){
  let c=0xFFFF;
  for(let i=0;i<str.length;i++){
    c^=str.charCodeAt(i)<<8;
    for(let j=0;j<8;j++)c=((c&0x8000)?((c<<1)^0x1021):(c<<1))&0xFFFF;
  }
  return c;
}
function buildPromptPayPayload(target, amount){
  // 4 type auto-detect by digit length:
  //   ≤10 digits → phone (tag 01, prepended 0066)
  //   13 digits → tax/citizen ID (tag 02)
  //   15 digits → e-Wallet (tag 03)
  const f=(id,v)=>id+String(v.length).padStart(2,'0')+v;
  const clean=target.replace(/\D/g,'');
  let norm, tType;
  if(clean.length<=10){
    norm='0066'+clean.replace(/^0/,'').slice(-9).padStart(9,'0');
    tType='01';
  } else if(clean.length===15){
    norm=clean;
    tType='03';
  } else {
    // 13-digit (tax/citizen) — pad/truncate to 13 just in case
    norm=clean.padStart(13,'0').slice(-13);
    tType='02';
  }
  const merchant=f('00','A000000677010111')+f(tType,norm);
  let p=f('00','01')+f('01','12')+f('29',merchant)+f('53','764');
  if(amount&&amount>0)p+=f('54',amount.toFixed(2));
  p+=f('58','TH')+'6304';
  const crc=_crc16CCITT(p).toString(16).toUpperCase().padStart(4,'0');
  return p.slice(0,-4)+'6304'+crc;
}

// Offline QR: generate PromptPay QR data URL using embedded library + canvas
function generateQRDataUrl(promptPayId, amount){
  if(!promptPayId||!window.qrcode)return '';
  try{
    const payload=buildPromptPayPayload(promptPayId,amount);
    const qr=window.qrcode(0,'M');
    qr.addData(payload,'Byte');
    qr.make();
    const n=qr.getModuleCount();
    const sc=4,pad=sc*2;
    const sz=n*sc+pad*2;
    const cv=document.createElement('canvas');
    cv.width=cv.height=sz;
    const ctx=cv.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,sz,sz);
    ctx.fillStyle='#000';
    for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.isDark(r,c))ctx.fillRect(pad+c*sc,pad+r*sc,sc,sc);
    return cv.toDataURL('image/png');
  }catch(e){console.error('QR gen error',e);return '';}
}
// Live QR preview in settings forms
function _ppPreview(){
  const ppId=(document.getElementById('hdrPromptPayId')?.value||'').replace(/[-\s]/g,'');
  const box=document.getElementById('ppPreviewBox');
  const img=document.getElementById('ppPreviewImg');
  if(!box||!img)return;
  if(!ppId||ppId.length<10){box.style.display='none';img.innerHTML='';return;}
  const dataUrl=generateQRDataUrl(ppId,100);
  if(!dataUrl){box.style.display='none';return;}
  box.style.display='';
  img.innerHTML='<img src="'+dataUrl+'" style="width:120px;height:120px;border-radius:6px;border:1px solid #bfdbfe;image-rendering:pixelated"><div style="font-size:10px;color:#15803d;margin-top:4px;font-weight:600">✓ QR ใช้งานได้</div>';
}

async function genPromptPayQR(){
  const phone=document.getElementById('hdrPhone')?.value?.trim()||'';
  const taxId=document.getElementById('hdrTaxId')?.value?.trim()||'';
  const target=taxId.replace(/\D/g,'').length===13?taxId:phone;
  if(!target){toast('กรุณากรอกเบอร์โทร หรือเลขผู้เสียภาษีก่อน','error');return;}
  const btn=document.getElementById('genQRBtn');
  if(btn)btn.textContent='⏳ กำลังสร้าง...';
  try{
    const payload=buildPromptPayPayload(target);
    const url='https://api.qrserver.com/v1/create-qr-code/?size=200x200&data='+encodeURIComponent(payload);
    const resp=await fetch(url);
    if(!resp.ok)throw new Error('fetch failed');
    const blob=await resp.blob();
    const reader=new FileReader();
    reader.onload=function(e){
      window._qrDataUrl=e.target.result;
      const prev=document.getElementById('qrPreview');
      if(prev)prev.innerHTML='<img src="'+e.target.result+'" style="max-width:120px;max-height:120px;border-radius:8px;border:2px solid #6366f1;margin-top:4px"><div style="font-size:10px;color:#15803d;margin-top:4px">✓ QR PromptPay สร้างแล้ว</div>';
      if(btn)btn.textContent='⚡ สร้าง QR PromptPay ใหม่';
      toast('สร้าง QR PromptPay สำเร็จ ✓');
    };
    reader.readAsDataURL(blob);
  }catch(e){
    if(btn)btn.textContent='⚡ สร้าง QR PromptPay';
    toast('สร้าง QR ไม่ได้ — ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต','error');
  }
}

// ========== STAFF SIGNATURE UPLOAD ==========
function uploadStaffSig(input){
  const file=input.files[0];
  if(!file)return;
  if(file.size>300*1024){toast('ไฟล์ใหญ่เกิน 300KB — ลองบีบอัดรูปก่อน','error');return;}
  const reader=new FileReader();
  reader.onload=e=>{
    window._staffSigUrl=e.target.result;
    const prev=document.getElementById('staffSigPreview');
    if(prev)prev.innerHTML='<img src="'+e.target.result+'" style="max-height:52px;border-radius:4px;border:1px solid #e5e7eb;background:#f8fafc;padding:4px">';
  };
  reader.readAsDataURL(file);
}

function invoiceHTML(invoices,staff){
  const today=new Date();
  const todayBE=dateToBE(today);
  const thMonths=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const staffName=staff?staff.name:'';
  const staffRole=staff?staff.role||'':'';

  // enrichDesc is a shared top-level function (see above invoiceHTML)

  function halfContent(inv, copyLabel){
    const c=DB.contracts.find(x=>x.id===inv.cid);
    const h=(DB.invoiceHeaders||[]).find(x=>x.id==inv.headerId)||(DB.invoiceHeaders||[])[0]||(c?{companyName:c.landlord||'',address:c.landlordAddr||'',bankName:c.bank||'',bankAccount:c.acctNo||'',bankAccountName:c.accountName||''}:{});
    const p=c?DB.properties.find(x=>x.pid===c.pid):null;
    const freq=inv.freqType||'monthly';
    const freqLbl=inv.freqLabel||{monthly:'รายเดือน',quarterly:'รายไตรมาส',semi:'ราย 6 เดือน',yearly:'รายปี',lump:'ครั้งเดียว'}[freq]||'รายเดือน';
    const [my,mm]=inv.month.split('-');
    const monthLabel=thMonths[parseInt(mm)-1]+' '+(parseInt(my)+543);
    const tenantAddr=c?.tenantAddr||'';
    const isCopy=copyLabel==='สำเนา';
    // Landlord details: invoice header first, fall back to contract's landlord fields
    const landlordName=(h?.companyName||c?.landlord||inv.landlord||'').replace(/\s*โดย\s+.+$/,'');
    const landlordAddr=h?.address||c?.landlordAddr||'';
    const landlordPhone=h?.phone||'';
    const landlordTax=h?.taxId||'';
    // Notes: per-invoice override → system default → header note
    const defaultNote=(DB.invoiceSettings?.defaultNote)||'';
    const finalNote=inv.note||defaultNote||h?.notes||'';
    // ── VAT compliance — ใช้ calcVat helper (Phase A) ──
    const _v=calcVat(inv,h);
    const isVat=_v.isVat, vatRate=_v.rate, subtotal=_v.subtotal, vatAmount=_v.vatAmount;
    const grossTotal=_v.total;
    const tenantTaxId=c?.taxId||'';
    const docTitle=isVat?'ใบแจ้งหนี้ / ใบกำกับภาษี':'ใบแจ้งหนี้';
    const docTitleEn=isVat?'INVOICE / TAX INVOICE':'INVOICE';

    return `<div class="half ${isCopy?'copy-half':'top-half'}">
      ${isCopy?'<div class="copy-watermark">สำเนา / COPY</div>':''}
      <div class="half-content" style="display:flex;flex-direction:column;height:100%">

        <!-- ── Header: Title first, then landlord info ── -->
        <div style="display:flex;gap:12px;align-items:flex-start;padding-bottom:10px;border-bottom:3px solid #1e293b;margin-bottom:10px;flex-shrink:0">
          ${h?.logo?'<img src="'+esc(h.logo)+'" style="width:48px;height:48px;object-fit:contain;border-radius:6px;flex-shrink:0;border:1px solid #e2e8f0">':''}
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
              <span style="font-size:${isVat?18:24}px;font-weight:800;color:#1e293b;letter-spacing:.5px;line-height:1.1">${docTitle}</span>
              <span style="font-size:10px;color:#64748b;font-weight:400">${docTitleEn}</span>
            </div>
            ${landlordName?'<div style="font-size:12px;font-weight:700;color:#1e293b;margin-top:4px">'+esc(landlordName)+'</div>':''}
            ${landlordAddr?'<div style="font-size:9px;color:#64748b;line-height:1.5;margin-top:1px">'+esc(landlordAddr)+'</div>':''}
            ${(landlordPhone||landlordTax)?'<div style="font-size:9px;color:#64748b;margin-top:1px">'+(landlordPhone?'โทร '+esc(landlordPhone):'')+(landlordPhone&&landlordTax?' &nbsp;·&nbsp; ':'')+(landlordTax?'เลขผู้เสียภาษี '+esc(landlordTax):'')+'</div>':''}
          </div>
          <div style="flex-shrink:0;text-align:right">
            <span style="display:inline-block;font-size:9px;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:5px;padding:3px 10px;color:#475569;font-weight:600">${copyLabel}</span>
          </div>
        </div>

        <!-- ── Meta grid ── -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);border-radius:8px;overflow:hidden;margin-bottom:10px;border:1px solid #cbd5e1;flex-shrink:0">
          <div style="padding:8px 12px;background:#f8fafc;border-right:1px solid #e2e8f0"><div style="font-size:8px;color:#64748b;font-weight:600;letter-spacing:.4px;margin-bottom:4px">เลขที่</div><div style="font-size:12px;font-weight:800;color:#1e293b;line-height:1.2">${esc(inv.invoiceNo)}</div></div>
          <div style="padding:8px 12px;background:#f8fafc;border-right:1px solid #e2e8f0"><div style="font-size:8px;color:#64748b;font-weight:600;letter-spacing:.4px;margin-bottom:4px">วันที่ออก</div><div style="font-size:12px;font-weight:700;color:#334155">${esc(inv.date)||todayBE}</div></div>
          <div style="padding:8px 12px;background:#f1f5f9;border-right:1px solid #e2e8f0"><div style="font-size:8px;color:#64748b;font-weight:600;letter-spacing:.4px;margin-bottom:4px">รอบบิล</div><div style="font-size:12px;font-weight:700;color:#334155">${monthLabel}</div></div>
          <div style="padding:8px 12px;background:#f1f5f9"><div style="font-size:8px;color:#64748b;font-weight:600;letter-spacing:.4px;margin-bottom:4px">กำหนดชำระ</div><div style="font-size:13px;font-weight:800;color:#b91c1c">${esc(inv.dueDate)||'—'}</div></div>
        </div>

        <!-- ── Parties: Tenant + Property (no landlord box) ── -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div style="border:1px solid #e2e8f0;border-radius:6px;padding:9px 12px">
            <div style="font-size:7px;font-weight:700;color:#64748b;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px">ผู้เช่า / Bill To</div>
            <div style="display:flex;align-items:flex-start;gap:7px">
              ${c?.tenantLogo?'<img src="'+esc(c.tenantLogo)+'" style="width:22px;height:22px;object-fit:contain;border-radius:3px;border:1px solid #e2e8f0;flex-shrink:0;margin-top:1px">':''}
              <div><div style="font-size:12px;font-weight:700;color:#1e293b;line-height:1.2">${esc(inv.tenant)}</div>${tenantAddr?'<div style="font-size:9px;color:#64748b;line-height:1.4;margin-top:3px">'+esc(tenantAddr)+'</div>':'<div style="font-size:9px;color:#dc2626;font-weight:600;margin-top:3px">⚠️ ไม่มีที่อยู่ผู้เช่า — แก้ในสัญญาก่อน</div>'}${tenantTaxId?'<div style="font-size:9px;color:#92400e;margin-top:2px;font-weight:600">เลขผู้เสียภาษี: '+esc(tenantTaxId)+'</div>':'<div style="font-size:9px;color:#dc2626;font-weight:600;margin-top:2px">⚠️ ไม่มีเลขผู้เสียภาษี — แก้ในสัญญาก่อน</div>'}</div>
            </div>
          </div>
          <div style="border:1px solid #e2e8f0;border-radius:6px;padding:9px 12px">
            <div style="font-size:7px;font-weight:700;color:#64748b;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px">ทรัพย์สิน / Property</div>
            <div style="font-size:12px;font-weight:700;color:#1e293b;line-height:1.2">${esc(inv.property)||'—'}</div>
            ${c?.no?'<div style="font-size:9px;color:#64748b;margin-top:3px">สัญญา: '+esc(c.no)+'</div>':''}
            <div style="font-size:9px;color:#64748b;margin-top:2px">${freqLbl}</div>
          </div>
        </div>

        <!-- ── Items table ── -->
        <table style="width:100%;border-collapse:collapse;font-size:10.5px;border-radius:6px;overflow:hidden;border:1px solid #cbd5e1">
          <tr style="background:#f1f5f9;border-bottom:2px solid #64748b">
            <th style="padding:7px 10px;text-align:left;font-size:8px;font-weight:700;color:#334155;letter-spacing:.5px">รายการ</th>
            <th style="padding:7px 10px;text-align:right;font-size:8px;font-weight:700;color:#334155;letter-spacing:.5px;width:120px">จำนวนเงิน (บาท)</th>
          </tr>
          ${inv.items.map((it,i)=>'<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:7px 10px;color:#334155">'+(i+1)+'. '+esc(enrichDesc(it,inv))+'</td><td style="padding:7px 10px;text-align:right;font-weight:600;color:#1e293b;font-variant-numeric:tabular-nums">'+fmtBaht(it.amount,{sym:0,dec:2})+'</td></tr>').join('')}
        </table>
        ${isVat?`<div style="display:flex;justify-content:flex-end;margin-top:6px;margin-bottom:6px">
          <table style="font-size:10px;border-collapse:collapse">
            <tr><td style="padding:2px 10px;text-align:right;color:#64748b">มูลค่าก่อนภาษี (Subtotal)</td><td style="padding:2px 10px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:#1e293b;min-width:110px">${fmtBaht(subtotal,{sym:0,dec:2})}</td></tr>
            <tr><td style="padding:2px 10px;text-align:right;color:#64748b">ภาษีมูลค่าเพิ่ม ${vatRate}% (VAT)</td><td style="padding:2px 10px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:#92400e;min-width:110px">${fmtBaht(vatAmount,{sym:0,dec:2})}</td></tr>
          </table>
        </div>`:''}
        <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
          <div style="background:#f8fafc;color:#1e293b;border:2px solid #1e293b;padding:8px 20px;border-radius:0 0 8px 8px;display:flex;align-items:center;gap:14px">
            <span style="font-size:10px;color:#64748b;font-weight:500">${isVat?'ยอดรวมสุทธิ (รวม VAT)':'ยอดรวมทั้งสิ้น'}</span>
            <span style="font-size:19px;font-weight:800;font-variant-numeric:tabular-nums">${fmtBaht(inv.total,{sym:0,dec:2})}</span>
            <span style="font-size:9px;color:#64748b">บาท</span>
          </div>
        </div>

        <!-- ── Bank + PromptPay QR ── -->
        ${(()=>{
          const hasPP=h?.promptPayId&&inv.total>0;
          const qrSrc=hasPP?generateQRDataUrl(h.promptPayId,inv.total):'';
          const bk=c?.bank||h?.bankName||'';
          const acct=c?.acctNo||h?.bankAccount||'';
          const acctName=c?.accountName||h?.bankAccountName||'';
          const ppName=h?.promptPayName||acctName||'';
          const ppBank=h?.promptPayBank||bk||'';
          const ppId=h?.promptPayId||'';
          // PromptPay QR section (เฉพาะใบแจ้งหนี้ที่ยังไม่จ่าย + ยอด > 0)
          let html='';
          if(hasPP&&qrSrc){
            html+='<div style="display:flex;gap:10px;align-items:center;border:1px solid #bfdbfe;background:#f0f9ff;border-radius:8px;padding:9px 12px;margin-bottom:7px">';
            html+='<img src="'+qrSrc+'" style="width:58px;height:58px;border-radius:6px;border:1px solid #bfdbfe;flex-shrink:0;image-rendering:pixelated">';
            html+='<div style="flex:1;font-size:9px;color:#475569;line-height:1.6">';
            html+='<div style="font-weight:700;color:#1e40af;font-size:10px;margin-bottom:2px">สแกนจ่ายผ่าน PromptPay</div>';
            if(ppName)html+='<div><b>ชื่อบัญชี:</b> '+esc(ppName)+'</div>';
            if(ppBank)html+='<div><b>ธนาคาร:</b> '+esc(ppBank)+'</div>';
            html+='<div><b>PromptPay:</b> '+esc(ppId)+'</div>';
            html+='<div><b>จำนวน:</b> <span style="color:#1e40af;font-weight:700">'+fmtBaht(inv.total,{sym:0,dec:2})+' บาท</span></div>';
            html+='</div></div>';
          }
          // Bank account section (always shown)
          html+='<div style="display:flex;gap:10px;align-items:center;border:1px solid '+(hasPP?'#e2e8f0':'#bfdbfe')+';background:'+(hasPP?'#f8fafc':'#f0f9ff')+';border-radius:8px;padding:9px 12px;margin-bottom:7px">';
          if(!hasPP){
            const fallbackQr=h?.qrCode||'';
            html+=fallbackQr?'<img src="'+esc(fallbackQr)+'" style="width:58px;height:58px;border-radius:6px;border:1px solid #bfdbfe;flex-shrink:0;image-rendering:pixelated">':'<div style="width:58px;height:58px;border-radius:6px;border:2px dashed #bfdbfe;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px">🏦</div>';
          } else {
            html+='<div style="width:20px;flex-shrink:0;text-align:center;font-size:14px">🏦</div>';
          }
          html+='<div style="flex:1;font-size:9px;color:#475569;line-height:1.6">';
          html+='<div style="font-weight:700;color:#1e40af;font-size:10px;margin-bottom:2px">'+(bk?'โอนเข้าบัญชี '+esc(bk):'โอนเงินผ่านธนาคาร')+'</div>';
          html+=acct?'<div style="font-size:14px;font-weight:800;color:#1e293b;letter-spacing:1px;font-variant-numeric:tabular-nums">'+esc(acct)+'</div>':'<div style="font-size:9px;color:#64748b;font-style:italic">ยังไม่ได้ตั้งค่าเลขบัญชี</div>';
          if(acctName)html+='<div style="color:#64748b">ชื่อบัญชี: '+esc(acctName)+'</div>';
          html+='</div></div>';
          return html;
        })()}

        ${finalNote?'<div style="padding:6px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:8.5px;color:#92400e;margin-bottom:6px"><b>หมายเหตุ:</b> '+esc(finalNote.replace(/\n/g,' '))+'</div>':''}

        <!-- ── Signature ── -->
        <div style="margin-top:auto;padding-top:9px;border-top:1px solid #e2e8f0;display:flex;justify-content:center">
          <div style="text-align:center;min-width:140px;max-width:180px">
            ${staff?.signatureImg?'<img src="'+esc(staff.signatureImg)+'" style="height:48px;max-width:160px;object-fit:contain;display:block;margin:0 auto 5px">':'<div style="height:48px;border-bottom:1px dotted #64748b;width:140px;margin:0 auto 5px"></div>'}
            <div style="font-size:9px;font-weight:600;color:#334155;letter-spacing:.3px">ผู้วางบิล</div>
            ${staffName?'<div style="font-size:10px;font-weight:700;color:#1e293b;margin-top:2px">'+esc(staffName)+'</div><div style="font-size:8px;color:#64748b">'+esc(staffRole)+'</div>':'<div style="font-size:8px;color:#64748b;margin-top:2px">ลงนาม / วันที่</div>'}
          </div>
        </div>

      </div>
    </div>`;
  }

  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
${_INV_PRINT_CSS}
</style></head><body>
<div class="no-print" style="position:fixed;top:0;left:0;right:0;z-index:100;background:#1e293b;padding:8px 24px;display:flex;align-items:center;gap:16px;box-shadow:0 2px 12px rgba(0,0,0,.2)">
  <button onclick="window.print()" style="background:#0ea5e9;color:#fff;border:none;padding:8px 24px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">🖨️ พิมพ์ / PDF</button>
  ${staffName?'<span style="color:#22c55e;font-size:11px">✓ ลงนามโดย '+esc(staffName)+'</span>':''}
  <span style="color:#64748b;font-size:11px;margin-left:auto">ใบแจ้งหนี้ — ${todayBE}</span>
</div>
<div style="height:48px" class="no-print"></div>
${invoices.map(inv=>`<div class="page">${halfContent(inv,'ต้นฉบับ')}${halfContent(inv,'สำเนา')}</div>`).join('')}
</body></html>`;
}

document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    // Close help overlay first
    const ho=document.getElementById('kbdHelpOverlay');
    if(ho&&ho.style.display!=='none'){ho.style.display='none';return;}
    // Close notification panel
    const np=document.getElementById('notifPanel');
    if(np&&np.style.display!=='none'){np.style.display='none';document.removeEventListener('click',_closeNotifPanel);return;}
    const po=document.getElementById('printOverlay');
    if(po&&po.style.display!=='none'){closePrintOverlay();return;}
    const mo=document.getElementById('modal');
    if(mo&&!mo.classList.contains('hidden')){closeModal();return;}
    hideCtxMenu();
    return;
  }
  // L8: global keyboard shortcuts — skip when typing in inputs
  const t=e.target;
  const inField=t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable);
  if(inField)return;
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key==='/'){
    // Focus first visible search input on current page
    const inputs=document.querySelectorAll('input[type="search"],input[placeholder*="ค้นหา"],input[placeholder*="Search"],input[id$="Search"]');
    for(const el of inputs){
      const r=el.getBoundingClientRect();
      if(r.width>0&&r.height>0&&!el.disabled){e.preventDefault();el.focus();el.select&&el.select();return;}
    }
  }else if(e.key==='?'||(e.shiftKey&&e.key==='/')){
    e.preventDefault();
    showKbdHelpOverlay();
  }
});

// L8: Keyboard shortcuts help overlay
function showKbdHelpOverlay(){
  let o=document.getElementById('kbdHelpOverlay');
  if(!o){
    o=document.createElement('div');
    o.id='kbdHelpOverlay';
    o.setAttribute('role','dialog');
    o.setAttribute('aria-label','คีย์ลัด');
    o.style.cssText='position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:99999;display:flex;align-items:center;justify-content:center';
    o.onclick=function(e){if(e.target===o)o.style.display='none';};
    o.innerHTML=`<div style="background:#fff;border-radius:16px;padding:28px 32px;max-width:480px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:Sarabun">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div style="font-size:18px;font-weight:700;color:#1e293b">⌨️ คีย์ลัด</div>
        <button onclick="document.getElementById('kbdHelpOverlay').style.display='none'" aria-label="ปิด" style="background:none;border:none;font-size:22px;cursor:pointer;color:#64748b;width:32px;height:32px;border-radius:8px">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:auto 1fr;gap:12px 20px;font-size:14px">
        <kbd style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:4px 10px;font-family:monospace;font-weight:600;text-align:center;min-width:36px">/</kbd><div style="color:#475569;align-self:center">โฟกัสช่องค้นหาในหน้าปัจจุบัน</div>
        <kbd style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:4px 10px;font-family:monospace;font-weight:600;text-align:center;min-width:36px">?</kbd><div style="color:#475569;align-self:center">เปิดหน้าคีย์ลัดนี้</div>
        <kbd style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:4px 10px;font-family:monospace;font-weight:600;text-align:center;min-width:36px">Esc</kbd><div style="color:#475569;align-self:center">ปิด modal / panel / overlay</div>
      </div>
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center">กด Esc หรือคลิกนอกกล่องเพื่อปิด</div>
    </div>`;
    document.body.appendChild(o);
  }
  o.style.display='flex';
}

// ============================================================
// FEATURE: EXPORT EXCEL RECEIPTS
// ============================================================
function exportExcelReceipts(){
  if(typeof XLSX==='undefined'){toast('กำลังโหลด SheetJS...','warning');return;}
  const wb=XLSX.utils.book_new();
  const paidInvs=(DB.invoices||[]).filter(i=>i.status==='paid');
  const rows=paidInvs.map(inv=>{
    const paidDate=inv.paidAt?new Date(inv.paidAt).toLocaleDateString('th-TH'):'';
    const recNo=inv.receiptNo||(inv.invoiceNo?inv.invoiceNo.replace('INV','REC'):'');
    const h=(DB.invoiceHeaders||[]).find(x=>x.id==inv.headerId);
    const _v=calcVat(inv,h);
    const isVat=_v.isVat, vatRate=_v.rate, subtotal=_v.subtotal, vatAmt=_v.vatAmount;
    return {
      'เลขที่ใบเสร็จ':recNo,'อ้างอิงใบแจ้งหนี้':inv.invoiceNo||'',
      'เลขใบกำกับภาษี':inv.taxInvoiceNo||'',
      'ประจำเดือน':inv.month||'','ผู้เช่า':inv.tenant||'',
      'ทรัพย์สิน':inv.property||'',
      'มูลค่าก่อนภาษี':subtotal,'VAT %':vatRate,'VAT (บาท)':vatAmt,
      'จำนวนเงิน':gross,
      'วิธีชำระ':inv.payMethod||'','เลขอ้างอิง':inv.payRef||'',
      'วันที่ชำระ':paidDate,
      'จำนวนครั้งที่ชำระ':(inv.payments||[]).length
    };
  });
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'ใบเสร็จรับเงิน');
  const fname=`receipts_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb,fname);
  addActivityLog('export_excel',`Export ใบเสร็จ Excel ${fname}`);save();
  toast('Export ใบเสร็จ Excel สำเร็จ');
}

// ============================================================
// FEATURE: PRINT RECEIPT PER PAYMENT (แต่ละครั้งที่ชำระ)
// ============================================================
function printPaymentReceipt(invId, payIdx){
  const inv=DB.invoices.find(x=>x.id===invId);
  if(!inv||!inv.payments||!inv.payments[payIdx])return toast('ไม่พบข้อมูลการชำระ','error');
  verifyPIN(function(staff){
    const pmt=inv.payments[payIdx];
    const html=paymentReceiptHTML(inv,pmt,staff,payIdx);
    openPrintOverlay(null,`ใบเสร็จ ${pmt.receiptNo||''}`,html);
    addInvoiceAudit(invId, 'receipt_printed', 'พิมพ์ใบเสร็จครั้งที่ '+(payIdx+1)+' — '+pmt.receiptNo+' ลงนามโดย '+staff.name);
  });
}

function paymentReceiptHTML(inv,pmt,staff,payIdx){
  const today=new Date();
  const todayBE=dateToBE(today);
  const staffName=staff?staff.name:'';
  const staffRole=staff?staff.role||'':'';
  const c=DB.contracts.find(x=>x.id===inv.cid);
  const h=(DB.invoiceHeaders||[]).find(x=>x.id==inv.headerId)||(DB.invoiceHeaders||[])[0]||{};
  const landlordName=(h.companyName||c?.landlord||'').replace(/\s*โดย\s+.+$/,'');
  const landlordAddr=h.address||c?.landlordAddr||'';
  const landlordPhone=h.phone||'';
  const landlordTax=h.taxId||'';
  const recNo=pmt.receiptNo||('REC-'+(payIdx+1));
  const paidDate=pmt.date?new Date(pmt.date):new Date();
  const paidDateBE=dateToBE(paidDate);
  const [my,mm]=inv.month.split('-');
  const thMonths=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const monthLabel=thMonths[parseInt(mm)-1]+' '+(parseInt(my)+543);
  const tenantAddr=c?.tenantAddr||'';
  const isPartialPay=inv.payments.length>1||(inv.status==='partial');
  const paidBefore=(inv.payments||[]).slice(0,payIdx).reduce((s,p)=>s+(p.amount||0),0);
  const remainAfter=Math.max(0,(inv.total||0)-paidBefore-(pmt.amount||0));
  // ── VAT (Phase 2b — payment receipt) ──
  // ใช้ calcVat สำหรับ rate/mode แต่ payment amount ใช้ของจริงจาก pmt
  const _v=calcVat(inv,h);
  const isVat=_v.isVat, vatRate=_v.rate;
  const payGross=pmt.amount||0;
  const paySub=isVat?+(payGross/(1+vatRate/100)).toFixed(2):payGross;
  const payVat=isVat?+(payGross-paySub).toFixed(2):0;
  const tenantTaxId=c?.taxId||'';
  const taxInvoiceNo=inv.taxInvoiceNo||'';
  const docTitle=isVat?'ใบเสร็จรับเงิน / ใบกำกับภาษี':'ใบเสร็จรับเงิน';
  const docTitleEn=isVat?'RECEIPT / TAX INVOICE':'RECEIPT';

  function halfReceipt(copyLabel){
    const isCopy=copyLabel==='สำเนา';
    return `<div class="half ${isCopy?'copy-half':'top-half'}">
      ${isCopy?'<div class="copy-watermark">สำเนา / COPY</div>':''}
      <div class="half-content" style="display:flex;flex-direction:column;height:100%">
        <div style="display:flex;gap:12px;align-items:flex-start;padding-bottom:10px;border-bottom:3px solid #059669;margin-bottom:10px;flex-shrink:0">
          ${h.logo?'<img src="'+esc(h.logo)+'" style="width:48px;height:48px;object-fit:contain;border-radius:6px;flex-shrink:0;border:1px solid #dcfce7">':''}
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
              <span style="font-size:${isVat?18:24}px;font-weight:800;color:#059669;letter-spacing:.5px;line-height:1.1">${docTitle}</span>
              <span style="font-size:10px;color:#64748b;font-weight:400">${docTitleEn}</span>
              ${isPartialPay?'<span style="font-size:10px;padding:2px 8px;border-radius:99px;background:#fef3c7;color:#92400e;font-weight:700">ชำระครั้งที่ '+(payIdx+1)+'</span>':''}
            </div>
            ${landlordName?'<div style="font-size:12px;font-weight:700;color:#1e293b;margin-top:4px">'+esc(landlordName)+'</div>':''}
            ${landlordAddr?'<div style="font-size:9px;color:#64748b;line-height:1.5;margin-top:1px">'+esc(landlordAddr)+'</div>':''}
            ${(landlordPhone||landlordTax)?'<div style="font-size:9px;color:#64748b;margin-top:1px">'+(landlordPhone?'โทร '+esc(landlordPhone):'')+(landlordPhone&&landlordTax?' · ':'')+(landlordTax?'เลขผู้เสียภาษี '+esc(landlordTax):'')+'</div>':''}
          </div>
          <div style="flex-shrink:0;text-align:right">
            <span style="display:inline-block;font-size:9px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:5px;padding:3px 10px;color:#059669;font-weight:600">${copyLabel}</span>
            ${isVat&&taxInvoiceNo?'<div style="font-size:8px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:5px;padding:3px 8px;margin-top:4px;font-weight:700">เลขใบกำกับภาษี<br>'+esc(taxInvoiceNo)+'</div>':''}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);border-radius:8px;overflow:hidden;margin-bottom:10px;border:1px solid #bbf7d0;flex-shrink:0">
          <div style="padding:8px 12px;background:#f0fdf4;border-right:1px solid #bbf7d0"><div style="font-size:8px;color:#059669;font-weight:600;letter-spacing:.4px;margin-bottom:4px">เลขที่ใบเสร็จ</div><div style="font-size:12px;font-weight:800;color:#065f46;line-height:1.2">${esc(recNo)}</div></div>
          <div style="padding:8px 12px;background:#f0fdf4;border-right:1px solid #bbf7d0"><div style="font-size:8px;color:#059669;font-weight:600;letter-spacing:.4px;margin-bottom:4px">อ้างอิงใบแจ้งหนี้</div><div style="font-size:12px;font-weight:700;color:#065f46">${esc(inv.invoiceNo)}</div></div>
          <div style="padding:8px 12px;background:#ecfdf5;border-right:1px solid #bbf7d0"><div style="font-size:8px;color:#059669;font-weight:600;letter-spacing:.4px;margin-bottom:4px">รอบบิล</div><div style="font-size:12px;font-weight:700;color:#065f46">${monthLabel}</div></div>
          <div style="padding:8px 12px;background:#ecfdf5"><div style="font-size:8px;color:#059669;font-weight:600;letter-spacing:.4px;margin-bottom:4px">วันที่ชำระ</div><div style="font-size:13px;font-weight:800;color:#065f46">${paidDateBE}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div style="border:1px solid #bbf7d0;border-radius:6px;padding:9px 12px;background:#f0fdf4">
            <div style="font-size:7px;font-weight:700;color:#059669;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px">ได้รับเงินจาก / Received From</div>
            <div style="font-size:12px;font-weight:700;color:#1e293b;line-height:1.2">${esc(inv.tenant)}</div>
            ${tenantAddr?'<div style="font-size:9px;color:#64748b;line-height:1.4;margin-top:3px">'+esc(tenantAddr)+'</div>':''}
            ${isVat&&tenantTaxId?'<div style="font-size:9px;color:#92400e;margin-top:2px;font-weight:600">เลขผู้เสียภาษี: '+esc(tenantTaxId)+'</div>':''}
          </div>
          <div style="border:1px solid #bbf7d0;border-radius:6px;padding:9px 12px;background:#f0fdf4">
            <div style="font-size:7px;font-weight:700;color:#059669;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px">ทรัพย์สิน / Property</div>
            <div style="font-size:12px;font-weight:700;color:#1e293b;line-height:1.2">${esc(inv.property)||'—'}</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:10.5px;border-radius:6px;overflow:hidden;border:1px solid #bbf7d0">
          <tr style="background:#f0fdf4;border-bottom:2px solid #059669">
            <th style="padding:7px 10px;text-align:left;font-size:8px;font-weight:700;color:#065f46;letter-spacing:.5px">รายการ</th>
            <th style="padding:7px 10px;text-align:right;font-size:8px;font-weight:700;color:#065f46;letter-spacing:.5px;width:120px">จำนวนเงิน (บาท)</th>
          </tr>
          <tr style="border-bottom:1px solid #f0fdf4"><td style="padding:7px 10px;color:#334155">ชำระค่าเช่า — ${esc(inv.invoiceNo)} ${pmt.method?'('+esc(pmt.method)+')':''} ${pmt.ref?'ref: '+esc(pmt.ref):''}</td><td style="padding:7px 10px;text-align:right;font-weight:600;color:#1e293b;font-variant-numeric:tabular-nums">${fmtBaht(pmt.amount||0,{sym:0,dec:2})}</td></tr>
        </table>
        ${isVat?`<div style="display:flex;justify-content:flex-end;margin-top:6px;margin-bottom:6px">
          <table style="font-size:10px;border-collapse:collapse">
            <tr><td style="padding:2px 10px;text-align:right;color:#64748b">มูลค่าก่อนภาษี (Subtotal)</td><td style="padding:2px 10px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:#1e293b;min-width:110px">${fmtBaht(paySub,{sym:0,dec:2})}</td></tr>
            <tr><td style="padding:2px 10px;text-align:right;color:#64748b">ภาษีมูลค่าเพิ่ม ${vatRate}% (VAT)</td><td style="padding:2px 10px;text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:#92400e;min-width:110px">${fmtBaht(payVat,{sym:0,dec:2})}</td></tr>
          </table>
        </div>`:''}
        <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
          <div style="background:#f0fdf4;color:#065f46;border:2px solid #059669;padding:8px 20px;border-radius:0 0 8px 8px;display:flex;align-items:center;gap:14px">
            <span style="font-size:10px;opacity:.7;font-weight:500">${isVat?'ชำระครั้งนี้ (รวม VAT)':'ชำระครั้งนี้'}</span>
            <span style="font-size:19px;font-weight:800;font-variant-numeric:tabular-nums">${fmtBaht(pmt.amount||0,{sym:0,dec:2})}</span>
            <span style="font-size:9px;opacity:.55">บาท</span>
          </div>
        </div>
        ${isPartialPay?`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px;font-size:10px">
          <div style="background:#eef2ff;padding:6px 8px;border-radius:6px;text-align:center"><div style="color:#6366f1;font-weight:600">ยอดรวมใบแจ้งหนี้</div><div style="font-weight:800;color:#1e293b">${fmtBaht(inv.total||0,{sym:0})} ฿</div></div>
          <div style="background:#dcfce7;padding:6px 8px;border-radius:6px;text-align:center"><div style="color:#059669;font-weight:600">ชำระแล้วรวม</div><div style="font-weight:800;color:#059669">${fmtBaht(paidBefore+(pmt.amount||0),{sym:0})} ฿</div></div>
          <div style="background:${remainAfter>0?'#fee2e2':'#f0fdf4'};padding:6px 8px;border-radius:6px;text-align:center"><div style="color:${remainAfter>0?'#dc2626':'#059669'};font-weight:600">ยอดคงเหลือ</div><div style="font-weight:800;color:${remainAfter>0?'#dc2626':'#059669'}">${fmtBaht(remainAfter,{sym:0})} ฿</div></div>
        </div>`:''}
${pmt.note?'<div style="padding:6px 10px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;font-size:8.5px;color:#92400e;margin-bottom:6px"><b>หมายเหตุ:</b> '+esc(pmt.note)+'</div>':''}
        <div style="margin-top:auto;padding-top:9px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-end">
          <div style="text-align:center;min-width:120px">
            ${staff?.signatureImg?'<img src="'+esc(staff.signatureImg)+'" style="height:44px;max-width:140px;object-fit:contain;display:block;margin:0 auto 4px">':'<div style="height:44px;border-bottom:1px dotted #64748b;width:120px;margin:0 auto 4px"></div>'}
            <div style="font-size:9px;font-weight:600;color:#059669">ผู้รับเงิน</div>
            ${staffName?'<div style="font-size:10px;font-weight:700;color:#1e293b;margin-top:1px">'+esc(staffName)+'</div><div style="font-size:8px;color:#64748b">'+esc(staffRole)+'</div>':''}
          </div>
          <div style="font-size:8px;color:#64748b;text-align:center;line-height:1.6">${esc(landlordName)||''}<br>${esc(recNo)} · ${todayBE}</div>
          <div style="text-align:center;min-width:120px">
            <div style="height:44px;border-bottom:1px dotted #64748b;width:120px;margin:0 auto 4px"></div>
            <div style="font-size:9px;font-weight:600;color:#334155">ผู้ชำระเงิน</div>
          </div>
        </div>
      </div>
    </div>`;
  }
  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>${_INV_PRINT_CSS}</style></head><body>
<div class="no-print" style="position:fixed;top:0;left:0;right:0;z-index:100;background:#059669;padding:8px 24px;display:flex;align-items:center;gap:16px;box-shadow:0 2px 12px rgba(0,0,0,.2)">
  <button onclick="window.print()" style="background:#fff;color:#059669;border:none;padding:8px 24px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">🖨️ พิมพ์ / PDF</button>
  ${staffName?'<span style="color:#fff;font-size:11px">✓ ลงนามโดย '+esc(staffName)+'</span>':''}
  <span style="color:rgba(255,255,255,.7);font-size:11px;margin-left:auto">ใบเสร็จรับเงิน (ครั้งที่ ${payIdx+1}) — ${todayBE}</span>
</div>
<div style="height:48px" class="no-print"></div>
<div class="page">${halfReceipt('ต้นฉบับ')}${halfReceipt('สำเนา')}</div>
</body></html>`;
}

// ============================================================
// FEATURE: ALL OUTSTANDING (ค้างชำระข้ามเดือน)
// ============================================================
function showAllOutstanding(){
  const allUnpaid=(DB.invoices||[]).filter(i=>i.status!=='paid'&&i.status!=='voided');
  allUnpaid.sort((a,b)=>getDaysOverdue(b)-getDaysOverdue(a));
  const totalAmt=allUnpaid.reduce((s,i)=>s+(i.remainingAmount!=null?i.remainingAmount:i.total||0),0);

  // Group by tenant
  const byTenant={};
  allUnpaid.forEach(inv=>{
    const k=inv.tenant||'ไม่ระบุ';
    if(!byTenant[k])byTenant[k]={invs:[],total:0};
    byTenant[k].invs.push(inv);
    byTenant[k].total+=(inv.remainingAmount!=null?inv.remainingAmount:inv.total||0);
  });
  const tenants=Object.entries(byTenant).sort((a,b)=>b[1].total-a[1].total);

  $('mtitle').textContent='📋 ค้างชำระทั้งหมด (ทุกเดือน)';
  $('mbody').innerHTML=`<div style="max-height:70vh;overflow-y:auto">
    <div style="background:linear-gradient(135deg,#dc2626,#ef4444);border-radius:12px;padding:16px;margin-bottom:16px;color:#fff">
      <div style="font-size:11px;opacity:.8;font-weight:600">ยอดค้างชำระรวมทั้งหมด</div>
      <div style="font-size:28px;font-weight:800;margin-top:4px">${fmtBaht(totalAmt,{sym:0})} <span style="font-size:14px;font-weight:500">บาท</span></div>
      <div style="font-size:11px;opacity:.7;margin-top:2px">${allUnpaid.length} ใบ · ${tenants.length} ผู้เช่า</div>
    </div>
    ${tenants.map(([name,data])=>`
      <div style="margin-bottom:12px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
        <div style="padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:13px;font-weight:700;color:#1e293b">${esc(name)}</div>
          <div style="font-size:13px;font-weight:700;color:#dc2626">${fmtBaht(data.total,{sym:0})} ฿</div>
        </div>
        ${data.invs.map(inv=>{
          const ds=getDisplayStatus(inv);
          const dOver=getDaysOverdue(inv);
          const rem=inv.remainingAmount!=null?inv.remainingAmount:inv.total||0;
          return `<div onclick="closeModal();viewInvoiceDetail(${inv.id})" style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid #f8fafc;cursor:pointer;font-size:12px" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background=''">
            <span style="font-weight:600;min-width:90px">${esc(inv.invoiceNo)||'-'}</span>
            <span style="color:#64748b;flex:1">${esc(inv.month)} · ${esc(inv.property)||''}</span>
            ${dOver>0?`<span style="font-size:10px;color:#dc2626;font-weight:700">เกิน ${dOver}ว</span>`:''}
            <span style="font-weight:700;color:${ds==='overdue'?'#dc2626':'#d97706'}">${fmtBaht(rem,{sym:0})} ฿</span>
          </div>`;
        }).join('')}
      </div>
    `).join('')}
  </div>`;
  $('modal').classList.remove('hidden');
}

// ============================================================
// FEATURE: FOLLOW-UP DASHBOARD
// ============================================================
function showFollowUpDashboard(){
  const today=new Date();
  const todayStr=dateToBE(today);
  const allWithFU=(DB.invoices||[]).filter(i=>i.followUpDate&&i.status!=='paid'&&i.status!=='voided');

  // Parse and sort by follow-up date
  allWithFU.sort((a,b)=>{
    const pa=parseBE(a.followUpDate),pb=parseBE(b.followUpDate);
    return (pa||new Date(9999,0))-(pb||new Date(9999,0));
  });

  // Split into overdue follow-ups, today, and upcoming
  const fuOverdue=[],fuToday=[],fuUpcoming=[];
  allWithFU.forEach(inv=>{
    const d=parseBE(inv.followUpDate);
    if(!d){fuUpcoming.push(inv);return;}
    const diff=Math.floor((d-today)/864e5);
    if(diff<0)fuOverdue.push(inv);
    else if(diff===0)fuToday.push(inv);
    else fuUpcoming.push(inv);
  });

  // Also show invoices with NO follow-up that are overdue
  const noFUOverdue=(DB.invoices||[]).filter(i=>!i.followUpDate&&i.status!=='paid'&&i.status!=='voided'&&getDaysOverdue(i)>0);

  $('mtitle').textContent='📅 Follow-up Dashboard — นัดชำระ';
  const section=(title,icon,color,items)=>{
    if(items.length===0)return '';
    return `<div style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;color:${color};margin-bottom:8px;display:flex;align-items:center;gap:6px">${icon} ${title} (${items.length})</div>
      ${items.map(inv=>{
        const dOver=getDaysOverdue(inv);
        const rem=inv.remainingAmount!=null?inv.remainingAmount:inv.total||0;
        return `<div onclick="closeModal();viewInvoiceDetail(${inv.id})" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#fff;border:1px solid #f1f5f9;border-radius:8px;cursor:pointer;font-size:12px;margin-bottom:4px" onmouseover="this.style.background='#f0f4ff'" onmouseout="this.style.background='#fff'">
          <div style="min-width:80px;font-weight:600">${esc(inv.invoiceNo)||'-'}</div>
          <div style="flex:1;color:#475569">${esc(inv.tenant)||'-'} · ${esc(inv.property)||''}</div>
          ${inv.followUpDate?`<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#e0e7ff;color:#4338ca;font-weight:600">📅 ${esc(inv.followUpDate)}</span>`:''}
          ${inv.followUpNote?`<span style="font-size:10px;color:#64748b;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(inv.followUpNote)}">💬 ${esc(inv.followUpNote)}</span>`:''}
          ${dOver>0?`<span style="font-size:10px;color:#dc2626;font-weight:700">เกิน ${dOver}ว</span>`:''}
          <span style="font-weight:700;color:#1e293b;min-width:70px;text-align:right">${fmtBaht(rem,{sym:0})} ฿</span>
        </div>`;
      }).join('')}
    </div>`;
  };

  $('mbody').innerHTML=`<div style="max-height:70vh;overflow-y:auto">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
      <div style="background:#fee2e2;border-radius:10px;padding:12px;text-align:center"><div style="font-size:10px;font-weight:600;color:#dc2626">เลยนัด</div><div style="font-size:20px;font-weight:800;color:#dc2626">${fuOverdue.length}</div></div>
      <div style="background:#dbeafe;border-radius:10px;padding:12px;text-align:center"><div style="font-size:10px;font-weight:600;color:#1d4ed8">วันนี้</div><div style="font-size:20px;font-weight:800;color:#1d4ed8">${fuToday.length}</div></div>
      <div style="background:#f0fdf4;border-radius:10px;padding:12px;text-align:center"><div style="font-size:10px;font-weight:600;color:#059669">กำลังมา</div><div style="font-size:20px;font-weight:800;color:#059669">${fuUpcoming.length}</div></div>
    </div>
    ${section('เลยวันนัดชำระแล้ว','🔴','#dc2626',fuOverdue)}
    ${section('นัดชำระวันนี้','🔵','#1d4ed8',fuToday)}
    ${section('กำลังจะถึง','🟢','#059669',fuUpcoming)}
    ${section('⚠️ เกินกำหนดแต่ยังไม่ตั้งนัดชำระ','⚠️','#92400e',noFUOverdue)}
    ${allWithFU.length===0&&noFUOverdue.length===0?'<div style="text-align:center;padding:40px;color:#64748b"><div style="font-size:32px;margin-bottom:8px">📅</div>ยังไม่มีนัดชำระ</div>':''}
  </div>`;
  $('modal').classList.remove('hidden');
}

