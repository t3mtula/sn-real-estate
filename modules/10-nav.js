// ========== NAV ==========
// Sub-tab state for consolidated pages
var propTab='properties'; // M2: var (not let) — script-concat build means inline onclick handlers run in global scope and can't see let. var attaches to window so `propTab='x'` from onclick actually updates the same slot.

const PAGES=[
  {id:'dashboard',label:'Dashboard',icon:'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>'},
  {id:'properties',label:'ทรัพย์สิน',icon:'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>'},
  {id:'contracts',label:'สัญญาเช่า',icon:'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>'},
  {id:'landlords',label:'ผู้ให้เช่า',icon:'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>'},
  {id:'invoices',label:'ใบแจ้งหนี้',icon:'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>'},
  {id:'reports',label:'รายงาน',icon:'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>',perm:'view_reports'},
];

function buildNav(){
  // ไม่มี currentUser หรือ role='pending' → render nav ว่าง (กัน UI โชว์เมนูตอนยังไม่ผ่าน auth)
  if(!currentUser || currentUser.role==='pending'){
    const navEl=$('nav'); if(navEl) navEl.innerHTML='';
    return;
  }
  const roleLabels={admin:'ผู้ดูแลระบบ',manager:'ผู้จัดการ',staff:'พนักงาน'};
  const roleColors={admin:'#6366f1',manager:'#f59e0b',staff:'#64748b'};
  const roleBg={admin:'#eef2ff',manager:'#fef3c7',staff:'#f1f5f9'};
  const userRole=currentUser?.role||'staff';
  const _nc=getNotifCounts();
  const _totalUnpaid=(DB.invoices||[]).filter(i=>i.category!=='deposit'&&i.status!=='paid'&&i.status!=='voided').length;
  const _navBadge=(pid)=>{
    if(pid==='properties'&&_nc.contract>0)return `<span style="margin-left:auto;min-width:18px;height:18px;background:#fef3c7;color:#b45309;border-radius:99px;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 5px">${_nc.contract}</span>`;
    if(pid==='invoices'&&_totalUnpaid>0)return `<span style="margin-left:auto;min-width:18px;height:18px;background:#fee2e2;color:#dc2626;border-radius:99px;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 5px">${_totalUnpaid}</span>`;
    return '';
  };
  $('nav').innerHTML=PAGES.filter(p=>!p.perm||hasPermission(p.perm)).map(p=>{
    // contracts = synthetic → active เมื่อ page==properties + propTab==contracts
    const isActive = (p.id==='contracts')
      ? (page==='properties' && propTab==='contracts')
      : (p.id==='properties')
        ? (page==='properties' && propTab!=='contracts')
        : (page===p.id);
    return `<button onclick="showPage('${p.id}')" data-p="${p.id}" class="sb w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 ${isActive?'active':''}"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">${p.icon}</svg>${p.label}${_navBadge(p.id)}</button>`;
  }).join('')
  +`<div style="border-top:1px solid #e2e8f0;margin-top:8px;padding-top:8px">
    <button onclick="viewActivityLog()" class="w-full flex items-center gap-3 px-4 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>ประวัติกิจกรรม</button>
    ${hasPermission('settings')?'<button onclick="showPage(\'settings\')" class="w-full flex items-center gap-3 px-4 py-2 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/></svg>ตั้งค่า</button>':''}
  </div>
  <div style="border-top:1px solid #e2e8f0;margin-top:auto;padding-top:8px">
    <div style="padding:12px;border-top:1px solid #e2e8f0">
      <div style="font-size:12px;font-weight:600;color:#1e293b">${currentUser?.name||'ไม่ระบุ'}</div>
      <div style="font-size:10px;color:#64748b;margin-top:2px;padding:2px 0"><span style="background:${roleBg[userRole]||'#f1f5f9'};color:${roleColors[userRole]||'#64748b'};padding:2px 8px;border-radius:99px;font-weight:600;font-size:9px">${roleLabels[userRole]||userRole}</span></div>
      <button onclick="customConfirm('ยืนยันออกจากระบบ','คุณต้องการออกจากระบบหรือไม่?',logout)" aria-label="ออกจากระบบ" style="margin-top:10px;padding:10px 12px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:8px;font-size:12px;cursor:pointer;font-family:Sarabun;width:100%;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .15s" onmouseover="this.style.background='#fee2e2';this.style.borderColor='#f87171'" onmouseout="this.style.background='#fef2f2';this.style.borderColor='#fecaca'"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>ออกจากระบบ</button>
    </div>
  </div>`;
}
const _PAGE_TITLES={dashboard:'Dashboard',properties:'ทรัพย์สิน',contracts:'สัญญาเช่า',landlords:'ผู้ให้เช่า',invoices:'ใบแจ้งหนี้',pipeline:'Pipeline',reports:'รายงาน',settings:'ตั้งค่า',datafix:'ข้อมูลต้องแก้',login:'เข้าสู่ระบบ'};
function showPage(p){
  // 'contracts' = synthetic page → ใช้ properties page + tab=contracts
  let actualPage=p, tabOverride=null;
  if(p==='contracts'){ actualPage='properties'; tabOverride='contracts'; }
  page=actualPage; cPage=0;
  if(actualPage==='properties') propTab=tabOverride||'properties';
  try{sessionStorage.setItem('sn_lastPage',p);}catch(e){}
  document.title=(_PAGE_TITLES[p]||_PAGE_TITLES[actualPage]||'')+' · SN Rental Manager';
  buildNav();
  render();
  if(actualPage!=='login'&&typeof injectHelpButton==='function')injectHelpButton();
  _autoCloseSidebarOnMobile();
}
function _restorePage(){const v=['dashboard','properties','contracts','landlords','invoices','pipeline','reports','settings','datafix'];try{const s=sessionStorage.getItem('sn_lastPage');if(s&&v.includes(s))return s;}catch(e){}return'dashboard';}
function showPropTab(t){propTab=t;render();}

// ── Mobile sidebar toggle ─────────────────────────────────────────────────
function toggleSidebar(){
  const aside=document.querySelector('#app > aside');
  if(!aside)return;
  const open=aside.classList.toggle('nav-open');
  document.body.classList.toggle('nav-open',open);
}
function closeSidebar(){
  const aside=document.querySelector('#app > aside');
  if(!aside)return;
  aside.classList.remove('nav-open');
  document.body.classList.remove('nav-open');
}
// Auto-close on nav button click (mobile only — <768px)
function _autoCloseSidebarOnMobile(){
  if(window.matchMedia&&window.matchMedia('(max-width: 767px)').matches){
    closeSidebar();
  }
}

