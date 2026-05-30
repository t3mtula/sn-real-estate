// ========== RENEWALS ==========
function renderRenew(){
  const now=new Date(), ps=DB.properties;
  const rs=DB.contracts.filter(c=>{const e=parseBE(c.end);if(!e)return false;const d=(e-now)/864e5;return d>-30&&d<=180&&!c.cancelled}).sort((a,b)=>(parseBE(a.end)||0)-(parseBE(b.end)||0));
  const expired=rs.filter(c=>{const e=parseBE(c.end);return e&&e<now}).length;
  const within30=rs.filter(c=>{const e=parseBE(c.end);if(!e)return false;const d=Math.ceil((e-now)/864e5);return d>=0&&d<=30}).length;
  const within90=rs.filter(c=>{const e=parseBE(c.end);if(!e)return false;const d=Math.ceil((e-now)/864e5);return d>30&&d<=90}).length;
  const within180=rs.filter(c=>{const e=parseBE(c.end);if(!e)return false;const d=Math.ceil((e-now)/864e5);return d>90&&d<=180}).length;

  $('content').innerHTML=`${propTabBar()}
    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:16px">
      <div class="kpi-box" style="border-color:#fecaca"><div class="kv" style="color:#dc2626">${expired}</div><div class="kl">หมดแล้ว</div></div>
      <div class="kpi-box" style="border-color:#fde68a"><div class="kv" style="color:#d97706">${within30}</div><div class="kl">ภายใน 30 วัน</div></div>
      <div class="kpi-box"><div class="kv" style="color:#f59e0b">${within90}</div><div class="kl">31-90 วัน</div></div>
      <div class="kpi-box"><div class="kv" style="color:#6366f1">${within180}</div><div class="kl">91-180 วัน</div></div>
      <div class="kpi-box"><div class="kv" style="color:#1e293b">${rs.length}</div><div class="kl">ทั้งหมด</div></div>
    </div>

    <div style="font-size:13px;color:#64748b;margin-bottom:12px">${rs.length} สัญญาที่ต้องพิจารณาต่อสัญญา</div>

    ${rs.length===0?'<div style="text-align:center;color:#64748b;padding:48px 0;font-size:14px">ไม่มีสัญญาที่ต้องต่ออายุในช่วงนี้</div>':
    rs.map(c=>{
      const e=parseBE(c.end),d=e?Math.ceil((e-now)/864e5):0,isExp=d<0;
      const p=ps.find(x=>x.pid===c.pid);
      const s=status(c);
      const mo=monthlyRev(c);
      // Progress bar
      const cS=parseBE(c.start),cE=parseBE(c.end);
      const tDays=cS&&cE?Math.max(1,Math.round((cE-cS)/864e5)):0;
      const elap=cS?Math.round((now-cS)/864e5):0;
      const pct=tDays>0?Math.min(100,Math.max(0,Math.round(elap/tDays*100))):0;
      const bCol=d<0?'#dc2626':d<=30?'#f59e0b':d<=90?'#d97706':'#6366f1';
      const borderCol=isExp?'border-left:3px solid #dc2626':d<=30?'border-left:3px solid #f59e0b':d<=90?'border-left:3px solid #d97706':'border-left:3px solid #6366f1';

      // Status badge (same as other pages)
      const stBadge={active:'<span style="background:#dcfce7;color:#15803d;padding:1px 7px;border-radius:99px;font-size:10px;font-weight:600">มีผล</span>',expiring:'<span style="background:#fef3c7;color:#b45309;padding:1px 7px;border-radius:99px;font-size:10px;font-weight:600;animation:pulse-badge 2s infinite">ใกล้หมด</span>',expired:'<span style="background:#fee2e2;color:#dc2626;padding:1px 7px;border-radius:99px;font-size:10px;font-weight:600">หมดอายุ</span>'}[s]||'';

      return`<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:6px;${borderCol}">
        <div style="padding:12px 16px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <span style="font-weight:700;color:#1e293b;font-size:14px">${esc(c.tenant)}</span>
                ${stBadge}
              </div>
              <div style="font-size:12px;color:#64748b;margin-bottom:2px">${esc(c.no)||'-'} · ${p?esc(p.name):esc(c.property)||'-'} · ${p?esc(p.location):''}</div>
              <div style="font-size:12px;color:#64748b">${esc((c.rate||'').split('(')[0].trim())||'-'}${mo>0?' · <span style="color:#059669;font-weight:600">'+fmtBaht(mo,{sym:0})+' บ./ด.</span>':''}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:20px;font-weight:800;color:${bCol}">${isExp?Math.abs(d):d}</div>
              <div style="font-size:10px;color:${bCol};font-weight:600">${isExp?'วัน เกินแล้ว':'วัน เหลือ'}</div>
              <div style="font-size:10px;color:#64748b;margin-top:2px">สิ้นสุด ${fmtBE(c.end)}</div>
            </div>
          </div>
          <!-- Progress bar -->
          <div class="progress-cell" style="margin-top:8px">
            <div class="pc-dates" style="display:flex;justify-content:space-between;margin-bottom:2px"><span>${fmtBE(c.start)}</span><span style="font-weight:600;color:${bCol}">${pct}%</span><span>${fmtBE(c.end)}</span></div>
            <div class="pc-bar" style="height:6px"><div class="pc-fill" style="width:${pct}%;background:${bCol}"></div></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;padding-top:8px;border-top:1px solid #f1f5f9">
            <button onclick="renewContract(${c.id})" style="padding:6px 16px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer">ต่อสัญญา</button>
            <button onclick="viewContract(${c.id})" oncontextmenu="showCtxMenu(event,${c.id})" style="padding:6px 16px;background:#fff;color:#64748b;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;cursor:pointer">ดูรายละเอียด</button>
          </div>
        </div>
      </div>`;}).join('')}`;
}


