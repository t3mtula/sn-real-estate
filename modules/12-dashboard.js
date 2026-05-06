// ========== DASHBOARD ==========
let mapSelLoc = null;
const MAP_LOC_COLORS = {'ราชบุรี':'#6366f1','กรุงเทพฯ':'#ef4444','เชียงใหม่':'#22c55e','กาญจนบุรี':'#f59e0b','นครปฐม':'#06b6d4'};
// Build reverse lookup: province ID → location name
const TH_ID_TO_LOC = {};
Object.entries(TH_LOC_MAP).forEach(([loc,id])=>TH_ID_TO_LOC[id]=loc);

// Extract province from address text — รองรับหลาย format
// Order: BKK keywords → "จ.XXX" / "จังหวัด XXX" → bare province name (substring match กับ TH_PROVINCES)
function extractProvince(text){
  if(!text) return null;
  const s = String(text);
  // BKK keyword (รวม "กรุงเทพ" stand-alone — เคสบ้าน/ทาวน์เฮาส์ไม่มี "จ." นำ)
  if(/กรุงเทพมหานคร|กทม\.|กรุงเทพฯ|กรุงเทพ/.test(s)) return 'กรุงเทพฯ';
  // Pattern "จ.XXX" หรือ "จังหวัด XXX" (ที่ไหนก็ได้ — ไม่บังคับท้ายข้อความ)
  const m = s.match(/จ(?:ังหวัด)?\.?\s*([฀-๿]+(?:\s[฀-๿]+)?)/);
  if(m) {
    const cand = m[1].trim();
    if(typeof TH_PROVINCES==='undefined' || TH_PROVINCES.includes(cand) || cand==='กรุงเทพมหานคร') {
      return cand==='กรุงเทพมหานคร'?'กรุงเทพฯ':cand;
    }
  }
  // Fallback: substring scan กับ list จังหวัดทั้งหมด (เคส address เก็บแค่ชื่อจังหวัดล้วน เช่น "ราชบุรี")
  if(typeof TH_PROVINCES!=='undefined') {
    for(const prov of TH_PROVINCES) {
      if(s.includes(prov)) return prov==='กรุงเทพมหานคร'?'กรุงเทพฯ':prov;
    }
  }
  return null;
}

function buildLocData(){
  const cs=DB.contracts, ps=DB.properties;
  const locData={};
  ps.forEach(p=>{
    const loc = p.province || p.addr_province || extractProvince(p.location||p.address) || 'ไม่ระบุจังหวัด';
    if(!locData[loc])locData[loc]={props:[],contracts:[],rev:0,vacant:0,expiring:0};
    locData[loc].props.push(p);
    const pcs=cs.filter(c=>c.pid===p.pid);
    const pAct=pcs.filter(c=>{const s=status(c);return s==='active'||s==='expiring'});
    const pUpcoming=pcs.filter(c=>status(c)==='upcoming');
    const pExp=pcs.filter(c=>status(c)==='expiring');
    locData[loc].contracts.push(...pcs);
    locData[loc].rev+=pAct.reduce((s,c)=>s+monthlyRev(c),0);
    if(pAct.length===0&&pUpcoming.length===0)locData[loc].vacant++;
    locData[loc].expiring+=pExp.length;
  });
  return locData;
}

function renderDash(){
  try{
  const cs=DB.contracts||[], ps=DB.properties||[], now=new Date();
  const act=cs.filter(c=>{const s=status(c);return s==='active'||s==='expiring'});
  const exp=cs.filter(c=>status(c)==='expiring');
  const tot=act.reduce((s,c)=>s+monthlyRev(c),0);
  const locData=buildLocData();
  const locEntries=Object.entries(locData).sort((a,b)=>b[1].rev-a[1].rev);

  // Category breakdown
  const byCat={};
  act.forEach(c=>{const k=cat(c.purpose);byCat[k]=(byCat[k]||0)+monthlyRev(c)});
  const cats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);

  // Calculate occupancy rate
  const totalProps=ps.length;
  const occupiedProps=ps.filter(p=>{const pcs=cs.filter(c=>c.pid===p.pid);const pAct=pcs.filter(c=>{const s=status(c);return s==='active'||s==='expiring'||s==='upcoming'});return pAct.length>0}).length;
  const occupancyRate=totalProps>0?Math.round(occupiedProps/totalProps*100):0;

  // Helper: check if a contract's payment is paid for a given month
  function isPaidForMonth(c,beY,m){
    const freq=payFreq(c.rate,c.payment);
    if(freq.type==='monthly'){
      return DB.payments[c.id+'-'+beY+'-'+m]?.paid||false;
    }else if(freq.type==='quarterly'){
      const qMap={1:1,2:1,3:1,4:2,5:2,6:2,7:3,8:3,9:3,10:4,11:4,12:4};
      return DB.payments[c.id+'-'+beY+'-'+qMap[m]]?.paid||false;
    }else if(freq.type==='semi'){
      return DB.payments[c.id+'-'+beY+'-'+(m<=6?1:2)]?.paid||false;
    }else if(freq.type==='yearly'){
      return DB.payments[c.id+'-'+beY+'-1']?.paid||false;
    }else if(freq.type==='lump'){
      return DB.payments[c.id+'-'+beY+'-1']?.paid||false;
    }
    return false;
  }

  // Current month collection rate (ใช้ monthlyRev เป็นฐาน — เฉลี่ยต่อเดือน ไม่ว่าความถี่จะเป็นอะไร)
  const curBEYear=now.getFullYear()+543;
  const curMonth=now.getMonth()+1;
  let moExpected=0,moCollected=0;
  act.forEach(c=>{
    const mo=monthlyRev(c);
    moExpected+=mo;
    if(isPaidForMonth(c,curBEYear,curMonth)) moCollected+=mo;
  });
  const collectionRate=moExpected>0?Math.round(moCollected/moExpected*100):0;
  const moOutstanding=moExpected-moCollected;

  // ===== 12-MONTH TREND DATA (ใช้ทุกสัญญา ไม่ใช่แค่ active ปัจจุบัน) =====
  const allNonCancelled=cs.filter(c=>!c.cancelled);
  const trendData=[];
  for(let i=11;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const m=d.getMonth()+1;
    const y=d.getFullYear();
    const beY=y+543;
    let expected=0,collected=0;
    allNonCancelled.forEach(c=>{
      const cStart=parseBE(c.start),cEnd=parseBE(c.end);
      const periodStart=new Date(y,m-1,1),periodEnd=new Date(y,m,0);
      if(cStart&&cStart>periodEnd)return;
      if(cEnd&&cEnd<periodStart)return;
      const mo=monthlyRev(c);
      expected+=mo;
      if(isPaidForMonth(c,beY,m)) collected+=mo;
    });
    trendData.push({month:m,year:y,beYear:beY,label:MO[m-1],expected,collected});
  }
  const trendMax=Math.max(...trendData.map(t=>Math.max(t.expected,t.collected)),1);

  // ===== PAYMENT BREAKDOWN BY LOCATION (for donut chart) =====
  const locCollected={},locExpected={};
  act.forEach(c=>{
    const p=ps.find(x=>x.pid===c.pid);
    const loc=p?p.location:'อื่นๆ';
    if(!locExpected[loc])locExpected[loc]=0;
    if(!locCollected[loc])locCollected[loc]=0;
    const mo=monthlyRev(c);
    locExpected[loc]+=mo;
    if(isPaidForMonth(c,curBEYear,curMonth)) locCollected[loc]+=mo;
  });

  // ===== HORIZONTAL BAR CHART DATA (expected vs collected by location) =====
  // Derive จาก data จริง ไม่ hardcode order — ทุก location ใช้สีจาก MAP_LOC_COLORS หรือ palette fallback
  // Group ตามจังหวัด (ใช้ p.province → addr_province → extract จาก location → "ไม่ระบุจังหวัด")
  const locRevenue={},locPaid={};
  act.forEach(c=>{
    const p=ps.find(x=>x.pid===c.pid);
    const loc = p ? (p.province || p.addr_province || extractProvince(p.location||p.address) || 'ไม่ระบุจังหวัด') : 'ไม่ระบุจังหวัด';
    const mo=monthlyRev(c);
    locRevenue[loc]=(locRevenue[loc]||0)+mo;
    if(isPaidForMonth(c,curBEYear,curMonth)) locPaid[loc]=(locPaid[loc]||0)+mo;
  });
  const _locFallbackPalette=['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#06b6d4','#f43f5e','#84cc16'];
  let _locColorIdx=0;
  let locBarDataAll = Object.keys(locRevenue).filter(l=>locRevenue[l]>0).map(loc=>({
    loc,
    expected:locRevenue[loc],
    collected:locPaid[loc]||0,
    color:MAP_LOC_COLORS[loc]||_locFallbackPalette[_locColorIdx++%_locFallbackPalette.length]
  }));
  locBarDataAll.sort((a,b)=>b.expected-a.expected);
  // Top 8 + รวม "อื่นๆ" (ถ้ามี > 8 จังหวัด)
  const TOP_LOC_LIMIT = 8;
  let locBarData = locBarDataAll;
  if(locBarDataAll.length > TOP_LOC_LIMIT) {
    const top = locBarDataAll.slice(0, TOP_LOC_LIMIT);
    const rest = locBarDataAll.slice(TOP_LOC_LIMIT);
    const restExpected = rest.reduce((s,r)=>s+r.expected,0);
    const restCollected = rest.reduce((s,r)=>s+r.collected,0);
    locBarData = [...top, {
      loc: 'อื่นๆ ('+rest.length+' จังหวัด)',
      expected: restExpected,
      collected: restCollected,
      color: '#94a3b8'
    }];
  }
  const locBarMax=locBarData.length>0?Math.max(...locBarData.map(d=>d.expected)):1;
  const locBarTotal=locBarData.reduce((s,d)=>s+d.expected,0)||1;

  // (horizontal bar chart rendered inline in HTML below)

  // ===== PER-CONTRACT BILLING TABLE (current month) =====
  const billingRows=[];
  act.forEach(c=>{
    const p=ps.find(x=>x.pid===c.pid);
    const freq=payFreq(c.rate,c.payment);
    const rateAmt=amt(c.rate);
    let expAmt=0,pk='',periodLabel='';
    if(freq.type==='monthly'){
      expAmt=rateAmt;pk=c.id+'-'+curBEYear+'-'+curMonth;periodLabel=MO[curMonth-1];
    }else if(freq.type==='quarterly'){
      const qMap={1:1,2:1,3:1,4:2,5:2,6:2,7:3,8:3,9:3,10:4,11:4,12:4};
      const q=qMap[curMonth]||1;
      if(curMonth===[1,4,7,10][q-1]){expAmt=rateAmt;pk=c.id+'-'+curBEYear+'-'+q;periodLabel='Q'+q;}
    }else if(freq.type==='semi'){
      const h=curMonth<=6?1:2;
      if(curMonth===(h===1?1:7)){expAmt=rateAmt;pk=c.id+'-'+curBEYear+'-'+h;periodLabel='H'+h;}
    }else if(freq.type==='yearly'){
      if(curMonth===1){expAmt=rateAmt;pk=c.id+'-'+curBEYear+'-1';periodLabel='ทั้งปี';}
    }
    if(expAmt<=0)return;
    const payment=DB.payments[pk];
    const paid=payment?.paid||false;
    const paidAmt=paid?(payment.amount||expAmt):0;
    billingRows.push({
      cid:c.id,tenant:c.tenant||'-',property:p?p.name:'-',location:p?p.location:'-',
      freq:freq.label,period:periodLabel,expected:expAmt,collected:paidAmt,paid,
      paidDate:payment?.date||'',no:c.no||''
    });
  });
  billingRows.sort((a,b)=>a.paid-b.paid||b.expected-a.expected);
  const billingPaid=billingRows.filter(r=>r.paid).length;
  const billingTotal=billingRows.length;
  const _hasPayments=Object.keys(DB.payments||{}).length>0;

  // ===== RENTAL INCOME TABLE (by location, monthly/quarterly/yearly) =====
  const incomeRows=[];
  const locOrder=['ราชบุรี','กาญจนบุรี','กรุงเทพฯ','นครปฐม','เชียงใหม่'];
  locOrder.forEach(loc=>{
    const ld=locData[loc];
    if(!ld)return;
    const locAct=ld.contracts.filter(c=>{const s=status(c);return s==='active'||s==='expiring'});
    const mo=locAct.reduce((s,c)=>s+monthlyRev(c),0);
    incomeRows.push({loc,props:ld.props.length,contracts:locAct.length,monthly:mo,quarterly:mo*3,yearly:mo*12,color:MAP_LOC_COLORS[loc]||'#6366f1'});
  });
  const totalMo=incomeRows.reduce((s,r)=>s+r.monthly,0);
  const totalQt=totalMo*3;
  const totalYr=totalMo*12;

  // Build detail data for drill-down
  const incomeDetail={};
  incomeRows.forEach(r=>{
    const ld=locData[r.loc];if(!ld)return;
    const locCs=ld.contracts.filter(c=>{const s=status(c);return s==='active'||s==='expiring'});
    incomeDetail[r.loc]=locCs.map(c=>{
      const p=ps.find(x=>x.pid===c.pid);
      const mo=monthlyRev(c);
      return{cid:c.id,tenant:c.tenant||'-',property:p?p.name:'-',type:p?p.type:'',rate:c.rate||'',mo,qt:mo*3,yr:mo*12,end:fmtBE(c.end),no:c.no||''};
    }).sort((a,b)=>b.mo-a.mo);
  });

  const incomeTableHTML=`
    <div class="section-card" style="margin-bottom:20px">
      <h2 class="section-title" style="--section-color:#6366f1">สรุปรายได้ค่าเช่าตามพื้นที่</h2>
      <p style="font-size:11px;color:#64748b;margin:-12px 0 16px 0">คลิกแถวเพื่อดูรายละเอียดสัญญา</p>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px" id="incomeTable">
          <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569;width:24px"></th>
              <th style="padding:10px 12px;text-align:left;font-weight:600;color:#475569">พื้นที่</th>
              <th style="padding:10px 10px;text-align:center;font-weight:600;color:#475569;width:65px">ทรัพย์สิน</th>
              <th style="padding:10px 10px;text-align:center;font-weight:600;color:#475569;width:65px">สัญญา</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569">รายเดือน</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569">รายปี</th>
              <th style="padding:10px 12px;text-align:right;font-weight:600;color:#475569;width:80px">สัดส่วน</th>
            </tr>
          </thead>
          <tbody>
            ${incomeRows.map(r=>{
              const pct=totalMo>0?Math.round(r.monthly/totalMo*100):0;
              const details=incomeDetail[r.loc]||[];
              return`<tr style="border-bottom:1px solid #f1f5f9;cursor:pointer;transition:background 0.15s" onclick="toggleIncomeDetail('${r.loc}')" onmouseover="this.style.background='#f0f9ff'" onmouseout="this.style.background=''">
                <td style="padding:10px 4px 10px 12px"><svg id="incChev_${r.loc.replace(/\s/g,'')}" style="width:12px;height:12px;color:#64748b;transition:transform .2s" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg></td>
                <td style="padding:10px 12px">
                  <div style="display:flex;align-items:center;gap:8px">
                    <div style="width:4px;height:28px;border-radius:2px;background:${r.color}"></div>
                    <div style="font-weight:600;color:#1e293b">${esc(r.loc)}</div>
                  </div>
                </td>
                <td style="padding:10px 10px;text-align:center;color:#64748b">${r.props}</td>
                <td style="padding:10px 10px;text-align:center;color:#64748b">${r.contracts}</td>
                <td style="padding:10px 12px;text-align:right;font-weight:600;color:#1e293b">${fmtBaht(r.monthly,{sym:0})}</td>
                <td style="padding:10px 12px;text-align:right;color:#475569">${fmtBaht(r.yearly,{sym:0})}</td>
                <td style="padding:10px 12px;text-align:right">
                  <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px">
                    <div style="width:40px;height:6px;border-radius:3px;background:#e2e8f0;overflow:hidden"><div style="height:100%;width:${pct}%;background:${r.color};border-radius:3px"></div></div>
                    <span style="font-size:12px;font-weight:600;color:${r.color}">${pct}%</span>
                  </div>
                </td>
              </tr>
              <tr id="incDetail_${r.loc.replace(/\s/g,'')}" style="display:none">
                <td colspan="7" style="padding:0;background:#f8fafc">
                  <div style="padding:8px 16px 12px 44px">
                    <table style="width:100%;border-collapse:collapse;font-size:12px">
                      <thead><tr style="border-bottom:1px solid #e2e8f0">
                        <th style="padding:6px 8px;text-align:left;color:#64748b;font-weight:500">ทรัพย์สิน</th>
                        <th style="padding:6px 8px;text-align:left;color:#64748b;font-weight:500">ผู้เช่า</th>
                        <th style="padding:6px 8px;text-align:left;color:#64748b;font-weight:500">เลขที่สัญญา</th>
                        <th style="padding:6px 8px;text-align:right;color:#64748b;font-weight:500">ต่อเดือน</th>
                        <th style="padding:6px 8px;text-align:right;color:#64748b;font-weight:500">ต่อปี</th>
                        <th style="padding:6px 8px;text-align:right;color:#64748b;font-weight:500">สิ้นสุด</th>
                        <th style="padding:6px 8px;text-align:center;color:#64748b;font-weight:500;width:40px"></th>
                      </tr></thead>
                      <tbody>${details.map(d=>`<tr style="border-bottom:1px solid #f1f5f9;transition:background .1s" onmouseover="this.style.background='#eef2ff'" onmouseout="this.style.background=''">
                        <td style="padding:6px 8px;color:#334155;font-weight:500">${esc(d.property)}</td>
                        <td style="padding:6px 8px;color:#475569">${esc(d.tenant)}</td>
                        <td style="padding:6px 8px;color:#64748b;font-size:11px">${esc(d.no)}</td>
                        <td style="padding:6px 8px;text-align:right;font-weight:600;color:#059669">${fmtBaht(d.mo,{sym:0})}</td>
                        <td style="padding:6px 8px;text-align:right;color:#475569">${fmtBaht(d.yr,{sym:0})}</td>
                        <td style="padding:6px 8px;text-align:right;color:#64748b;font-size:11px">${d.end}</td>
                        <td style="padding:6px 8px;text-align:center"><a onclick="event.stopPropagation();viewContract(${d.cid})" style="color:#6366f1;cursor:pointer;font-size:11px;text-decoration:underline">ดู</a></td>
                      </tr>`).join('')}
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="background:#f0f9ff;border-top:2px solid #6366f1">
              <td></td>
              <td style="padding:12px;font-weight:700;color:#1e293b">รวมทั้งหมด</td>
              <td style="padding:12px;text-align:center;font-weight:600;color:#475569">${incomeRows.reduce((s,r)=>s+r.props,0)}</td>
              <td style="padding:12px;text-align:center;font-weight:600;color:#475569">${incomeRows.reduce((s,r)=>s+r.contracts,0)}</td>
              <td style="padding:12px;text-align:right;font-weight:700;color:#6366f1;font-size:14px">${fmtBaht(totalMo,{sym:0})}</td>
              <td style="padding:12px;text-align:right;font-weight:700;color:#475569">${fmtBaht(totalYr,{sym:0})}</td>
              <td style="padding:12px;text-align:right;font-weight:700;color:#6366f1">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>`;

  // Build Thailand SVG map — เน้นเฉพาะจังหวัดที่มีทรัพย์
  // จังหวัดที่มีทรัพย์: highlight สีเข้ม / ที่ไม่มี: จางมาก
  const activeIds = new Set(
    Object.entries(TH_LOC_MAP)
      .filter(([loc]) => locData[loc] && locData[loc].props.length > 0)
      .map(([_,id]) => id)
  );
  let provincePaths='';
  Object.entries(TH_PATHS).forEach(([id,d])=>{
    const isActive = activeIds.has(id);
    const fill   = isActive ? '#e0e7ff' : '#fafafa';
    const stroke = isActive ? '#a5b4fc' : '#e5e7eb';
    provincePaths+=`<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${isActive?0.8:0.4}" class="map-prov-bg" data-id="${id}"/>`;
  });

  // Interactive colored bubbles — เฉพาะจังหวัดที่มีทรัพย์สิน (count>0)
  // ซ่อนจังหวัด 0 เพราะรกแผนที่และให้ข้อมูลผิด ("รายได้ 0 บาท" = ไม่ได้ลงทุน, ไม่ใช่ insight)
  let labelsHTML='';
  const bubbleData=Object.entries(TH_LOC_MAP).map(([loc,id])=>{
    const c=TH_CENTROIDS[id];if(!c)return null;
    const ld=locData[loc];
    const count=ld?ld.props.length:0;
    if(count===0)return null;
    const rev=ld?ld.rev:0;
    return{loc,id,cx:c[0],cy:c[1],count,rev,color:MAP_LOC_COLORS[loc]||'#6366f1'};
  }).filter(Boolean).sort((a,b)=>a.count-b.count);
  const maxCount=Math.max(...bubbleData.map(b=>b.count),1);
  bubbleData.forEach(b=>{
    const isSel=b.loc===mapSelLoc;
    const r=Math.max(16,Math.min(36,16+(b.count/maxCount)*20));
    const selR=isSel?r+4:r;
    labelsHTML+=`<g onclick="mapClickLoc('${b.loc}')" style="cursor:pointer" class="map-pin">
      ${isSel?`<circle cx="${b.cx}" cy="${b.cy}" r="${selR+6}" fill="${b.color}" opacity="0.15"><animate attributeName="r" values="${selR+4};${selR+10};${selR+4}" dur="2s" repeatCount="indefinite"/></circle>`:''}
      <circle cx="${b.cx}" cy="${b.cy}" r="${selR}" fill="${b.color}" stroke="#fff" stroke-width="3" opacity="${isSel?1:0.9}" filter="url(#bubbleSh)"/>
      <text x="${b.cx}" y="${b.cy}" text-anchor="middle" dominant-baseline="central" font-size="${Math.max(12,selR*0.55)}" font-weight="800" fill="#fff" pointer-events="none">${b.count}</text>
      <text x="${b.cx}" y="${b.cy+selR+14}" text-anchor="middle" font-size="12" font-weight="700" fill="#334155" pointer-events="none" stroke="#fff" stroke-width="4" paint-order="stroke">${esc(b.loc)}</text>
      ${b.rev>0?`<text x="${b.cx}" y="${b.cy+selR+27}" text-anchor="middle" font-size="9" font-weight="500" fill="#64748b" pointer-events="none" stroke="#fff" stroke-width="3" paint-order="stroke">${(b.rev/1000).toFixed(0)}K/ด.</text>`:''}
    </g>`;
  });

  const thaiMap=`<svg viewBox="240 35 520 930" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">
    <defs>
      <filter id="mapSh"><feDropShadow dx="0" dy="1" stdDeviation="3" flood-opacity="0.15"/></filter>
      <filter id="bubbleSh"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.25"/></filter>
    </defs>
    ${provincePaths}
    ${labelsHTML}
  </svg>`;

  // Selected location detail (enhanced with gradient header)
  const sel=mapSelLoc&&locData[mapSelLoc]?mapSelLoc:null;
  const selD=sel?locData[sel]:null;
  let detailHTML='';
  if(sel&&selD){
    const selProps=selD.props;
    const selAct=selD.contracts.filter(c=>{const s=status(c);return s==='active'||s==='expiring'});
    const types={};selProps.forEach(p=>{types[p.type]=(types[p.type]||0)+1});
    const selColor=MAP_LOC_COLORS[sel]||'#6366f1';
    detailHTML=`
      <div class="detail-panel-subtle" style="--loc-color:${selColor}">
        <div class="loc-detail-header" style="background:linear-gradient(135deg,${selColor},${selColor}dd);display:flex;align-items:center;justify-content:space-between">
          <h3 class="loc-detail-title">${esc(sel)}</h3>
          <button onclick="mapSelLoc=null;renderDash()" class="loc-detail-close">ปิด ×</button>
        </div>
        <div class="map-stat-row">
          <div class="map-stat-box"><div class="map-stat-val" style="color:${selColor}">${selProps.length}</div><div class="map-stat-lbl">ทรัพย์สิน</div></div>
          <div class="map-stat-box"><div class="map-stat-val text-green-600">${selAct.length}</div><div class="map-stat-lbl">สัญญามีผล</div></div>
          <div class="map-stat-box"><div class="map-stat-val" style="color:${selColor}">${fmtBaht(selD.rev,{sym:0})}</div><div class="map-stat-lbl">บาท/เดือน</div></div>
        </div>
        <div class="flex flex-wrap gap-1 mb-3">${Object.entries(types).map(([t,n])=>`<span class="property-mini-stat">${esc(t)} (${n})</span>`).join('')}</div>
        ${selD.vacant>0?`<div class="text-xs text-red-500 font-semibold mb-2">ว่าง ${selD.vacant} แปลง</div>`:''}
        ${selD.expiring>0?`<div class="text-xs text-yellow-700 font-semibold mb-2">สัญญาใกล้หมด ${selD.expiring} รายการ</div>`:''}
        <div class="map-prop-list">
          ${selProps.map(p=>{
            const pcs=cs.filter(c=>c.pid===p.pid);
            const pAct=pcs.filter(c=>{const s=status(c);return s==='active'||s==='expiring'});
            const pRev=pAct.reduce((s,c)=>s+monthlyRev(c),0);
            const isVacant=pAct.length===0;
            return`<div class="map-prop-item" onclick="showPage('properties');propFilter.loc='${sel}';renderProperties()">
              <div style="width:3px;height:28px;border-radius:1px;background:${isVacant?'#ef4444':'#10b981'};flex-shrink:0;opacity:0.8"></div>
              <div style="min-width:0;flex:1">
                <div class="font-medium text-gray-900" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</div>
                <div class="text-xs text-gray-400">${esc(p.type)} · ${pAct.length} สัญญา</div>
              </div>
              <div class="text-right flex-shrink-0">
                <div class="text-sm font-bold" style="color:${selColor}">${pRev>0?fmtBaht(pRev,{sym:0}):'-'}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  // Expiring contracts alert section
  let expHTML='';
  if(exp.length){
    const expSorted=exp.slice().sort((a,b)=>(parseBE(a.end)||0)-(parseBE(b.end)||0));
    expHTML=`<div class="section-card" style="--section-color:#f59e0b;border-left:4px solid #f59e0b">
      <h2 class="section-title" style="--section-color:#f59e0b">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
        สัญญาใกล้หมดอายุ (${exp.length} รายการ ภายใน 90 วัน)
      </h2>
      <div class="space-y-2">
        ${expSorted.slice(0,8).map(c=>{const p=DB.properties.find(x=>x.pid===c.pid);const e=parseBE(c.end);const d=e?Math.ceil((e-now)/864e5):0;return`<div class="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-100 hover:border-orange-300 cursor-pointer" onclick="viewContract(${c.id})" oncontextmenu="showCtxMenu(event,${c.id})">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2"><span class="font-semibold text-gray-900 text-sm">${esc(c.tenant)}</span><span class="text-xs text-gray-400">${esc(c.no)||''}</span></div>
            <div class="text-xs text-gray-500 mt-0.5"><span class="font-medium">${p?esc(p.name):'?'}</span> · ${p?esc(p.location):''}</div>
          </div>
          <div class="text-right flex-shrink-0 ml-3">
            <div class="text-sm font-bold ${d<=30?'text-red-600':'text-orange-700'}">อีก ${d} วัน</div>
            <div class="text-xs text-gray-400">${fmtBE(c.end)}</div>
          </div>
        </div>`;}).join('')}
        ${exp.length>8?'<div class="text-xs text-gray-500 text-center pt-2">แสดง 8 จาก '+exp.length+' รายการ</div>':''}
      </div>
    </div>`;
  }

  // Data-quality alert — link to "ข้อมูลต้องแก้" page
  let _dataFixAlertHTML = '';
  try {
    const _dfResults = scanContractIssues();
    if(_dfResults.length > 0) {
      const _dfBlock = _dfResults.filter(r => r.issues.some(i => i.severity==='block')).length;
      const _dfWarn = _dfResults.length - _dfBlock;
      _dataFixAlertHTML = `<div class="alert-strip ${_dfBlock>0?'danger':'warn'}" onclick="showPage('datafix')" style="cursor:pointer;margin-bottom:12px" title="ไปหน้าข้อมูลต้องแก้">
        <svg class="alert-strip-icon" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
        <div class="alert-strip-body">
          <p class="alert-strip-title">ข้อมูลต้องแก้ — ${_dfResults.length} สัญญา</p>
          <p class="alert-strip-desc">${_dfBlock>0?_dfBlock+' ด่วน · ':''}${_dfWarn>0?_dfWarn+' ควรตรวจ':''} — คลิกเพื่อดูรายละเอียด</p>
        </div>
        <span class="btn2 btn2-sm ${_dfBlock>0?'btn2-danger':'btn2-ghost'}" style="pointer-events:none">ดูรายละเอียด →</span>
      </div>`;
    }
  } catch(e) { console.warn('dataFix alert error:', e); }

  // Build notification alerts for dashboard
  const _dashNotifs=getNotifications();
  const _urgentNotifs=_dashNotifs.filter(n=>n.type==='danger'||n.type==='warning');
  const _dashAlertHTML=_urgentNotifs.length>0?`
    <div style="margin-bottom:16px;border-radius:12px;overflow:hidden;border:1px solid ${_urgentNotifs.some(n=>n.type==='danger')?'#fecaca':'#fde68a'};background:${_urgentNotifs.some(n=>n.type==='danger')?'#fef2f2':'#fffbeb'}">
      <div style="padding:10px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ${_urgentNotifs.some(n=>n.type==='danger')?'#fecaca':'#fde68a'}">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:18px">${_urgentNotifs.some(n=>n.type==='danger')?'🚨':'⚠️'}</span>
          <span style="font-size:13px;font-weight:700;color:${_urgentNotifs.some(n=>n.type==='danger')?'#991b1b':'#92400e'}">ต้องดำเนินการ (${_urgentNotifs.length} รายการ)</span>
        </div>
        <button onclick="toggleNotifPanel()" style="font-size:11px;color:#6366f1;background:none;border:none;cursor:pointer;font-family:Sarabun;font-weight:600;text-decoration:underline">ดูทั้งหมด →</button>
      </div>
      <div style="padding:8px 12px;display:flex;flex-wrap:wrap;gap:6px">
        ${_urgentNotifs.slice(0,6).map(n=>{
          const col=n.type==='danger'?{bg:'#fee2e2',text:'#991b1b',border:'#fca5a5'}:{bg:'#fef3c7',text:'#92400e',border:'#fcd34d'};
          return '<div onclick="'+n.actionStr.replace(/"/g,'&quot;')+'" style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;background:'+col.bg+';border:1px solid '+col.border+';cursor:pointer;transition:transform .1s;flex:1;min-width:200px" onmouseover="this.style.transform=\'scale(1.02)\'" onmouseout="this.style.transform=\'\'"><span style="font-size:14px">'+esc(n.icon)+'</span><div style="flex:1;min-width:0"><div style="font-size:11px;font-weight:700;color:'+col.text+'">'+esc(n.title)+'</div><div style="font-size:10px;color:'+col.text+';opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(n.desc)+'</div></div></div>';
        }).join('')}
        ${_urgentNotifs.length>6?'<div style="font-size:11px;color:#64748b;padding:6px;text-align:center;width:100%">+อีก '+(_urgentNotifs.length-6)+' รายการ</div>':''}
      </div>
    </div>`:'';

  // ===== V2 Dashboard: Alert strips + kpi-v2 grid =====
  // Cross-month overdue alert
  const _ovdList=(DB.invoices||[]).filter(i=>i.status!=='voided'&&typeof getDisplayStatus==='function'&&getDisplayStatus(i)==='overdue');
  const _ovdAmt=_ovdList.reduce((s,i)=>s+(i.remainingAmount!=null?i.remainingAmount:i.total||0),0);
  const _ovdAlertHTML=_ovdList.length>0?`<div class="alert-strip danger" onclick="invOverdueOnly=true;invPage=1;showPage('invoices');" style="cursor:pointer" title="ดูใบแจ้งหนี้เกินกำหนดทั้งหมด">
    <svg class="alert-strip-icon" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
    <div class="alert-strip-body">
      <p class="alert-strip-title">เกินกำหนด (ข้ามเดือน) — ${_ovdList.length} ฉบับ</p>
      <p class="alert-strip-desc">ค้างรวม ${fmtBaht(_ovdAmt,{sym:0})} บาท · คลิกเพื่อดูใบแจ้งหนี้</p>
    </div>
    <span class="btn2 btn2-danger btn2-sm" style="pointer-events:none">ดูทั้งหมด →</span>
  </div>`:'';

  // Expiring contracts alert (summary — detail list still below)
  const _expAlertHTML=exp.length>0?`<div class="alert-strip warn" onclick="propTab='renewals';showPage('properties');render()" style="cursor:pointer" title="ไปหน้าต่อสัญญา">
    <svg class="alert-strip-icon" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
    <div class="alert-strip-body">
      <p class="alert-strip-title">สัญญาใกล้หมดอายุ — ${exp.length} ฉบับ</p>
      <p class="alert-strip-desc">ภายใน ${(DB.sysConfig&&DB.sysConfig.expiringDays)||90} วัน · ควรเริ่มทยอยต่อสัญญา</p>
    </div>
    <span class="btn2 btn2-ghost btn2-sm" style="pointer-events:none">ไปเลย →</span>
  </div>`:'';

  // Unpaid deposit receipts alert (ยังไม่ได้รับเงินประกันจากผู้เช่า)
  const _unpaidDepInvs=(DB.invoices||[]).filter(i=>i.category==='deposit'&&i.status!=='paid'&&i.status!=='voided');
  const _unpaidDepAmt=_unpaidDepInvs.reduce((s,i)=>s+(i.remainingAmount!=null?i.remainingAmount:i.total||0),0);
  const _unpaidDepHTML=_unpaidDepInvs.length>0?`<div class="alert-strip warn" onclick="propFilter.status='pendingdeposit';showPage('properties');renderProperties()" style="cursor:pointer" title="ดูทรัพย์สินที่ค้างรับเงินประกัน">
    <svg class="alert-strip-icon" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
    <div class="alert-strip-body">
      <p class="alert-strip-title">ค้างรับเงินประกัน — ${_unpaidDepInvs.length} ห้อง</p>
      <p class="alert-strip-desc">รวม ${fmtBaht(_unpaidDepAmt,{sym:0})} บาท · ผู้เช่ายังไม่ได้จ่ายเงินประกัน</p>
    </div>
    <span class="btn2 btn2-ghost btn2-sm" style="pointer-events:none">ดูทั้งหมด →</span>
  </div>`:'';

  // Pending deposits alert
  const _pendDep=cs.filter(c=>{const s=status(c);if(s!=='expired'&&s!=='cancelled')return false;const dep=c.deposit?parseFloat(String(c.deposit).replace(/[^\d.]/g,''))||0:0;if(dep<=0)return false;return !(DB.deposits||[]).some(d=>d.cid===c.id);});
  const _pendDepSum=_pendDep.reduce((s,c)=>s+(parseFloat(String(c.deposit).replace(/[^\d.]/g,''))||0),0);
  const _pendDepAlertHTML=_pendDep.length>0?`<div class="alert-strip warn" onclick="showPendingDeposits()" style="cursor:pointer">
    <svg class="alert-strip-icon" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
    <div class="alert-strip-body">
      <p class="alert-strip-title">ประกันค้างคืน — ${_pendDep.length} ฉบับ</p>
      <p class="alert-strip-desc">รวม ${fmtBaht(_pendDepSum,{sym:0})} บาท · สัญญาสิ้นสุดแล้วยังไม่ได้คืนเงินประกัน</p>
    </div>
    <span class="btn2 btn2-ghost btn2-sm" style="pointer-events:none">ดำเนินการ →</span>
  </div>`:'';

  $('content').innerHTML=`
    ${_dataFixAlertHTML}
    ${_dashAlertHTML}
    ${_ovdAlertHTML}
    ${_expAlertHTML}
    ${_unpaidDepHTML}
    ${_pendDepAlertHTML}

    <!-- V2 KPI row: Hero revenue + 3 secondary -->
    <div style="display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr;gap:14px;margin-bottom:20px" class="v2-kpi-grid">
      <div class="kpi-v2 hero" onclick="showPage('properties')">
        <div class="kpi-v2-icon ic-indigo"><svg viewBox="0 0 24 24" fill="currentColor" aria-label="บาท"><text x="12" y="17.5" text-anchor="middle" font-size="17" font-weight="800" font-family="Sarabun,system-ui,sans-serif">฿</text></svg></div>
        <div class="kpi-v2-body">
          <p class="kpi-v2-value">${fmtBaht(tot,{sym:0})}</p>
          <p class="kpi-v2-label">รายได้ต่อเดือน (เฉลี่ย)${_hasPayments?' · เก็บได้ '+fmtBaht(moCollected,{sym:0})+' ('+collectionRate+'%)':''}</p>
          <span class="kpi-v2-trend ${_hasPayments?(collectionRate>=100?'up':collectionRate>=50?'neutral':'down'):'neutral'}">${_hasPayments?(collectionRate>=100?'▲':collectionRate>=50?'●':'▼')+' '+billingPaid+'/'+billingTotal+' สัญญาชำระเดือนนี้':'ยังไม่บันทึกการชำระเงิน'}</span>
        </div>
      </div>
      <div class="kpi-v2" onclick="showPage('properties')">
        <div class="kpi-v2-icon ic-sky"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 22V12h6v10"/></svg></div>
        <div class="kpi-v2-body">
          <p class="kpi-v2-value">${totalProps}</p>
          <p class="kpi-v2-label">ทรัพย์สิน · ${occupiedProps} แห่งมีผู้เช่า</p>
        </div>
      </div>
      <div class="kpi-v2" onclick="showPage('properties');propFilter.status='occupied';renderProperties()">
        <div class="kpi-v2-icon ic-emerald"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg></div>
        <div class="kpi-v2-body">
          <p class="kpi-v2-value">${occupancyRate}%</p>
          <p class="kpi-v2-label">อัตราการเช่า · ${totalProps-occupiedProps} แปลงว่าง</p>
        </div>
      </div>
      <div class="kpi-v2" onclick="propTab='contracts';showPage('properties');render()">
        <div class="kpi-v2-icon ic-violet"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg></div>
        <div class="kpi-v2-body">
          <p class="kpi-v2-value">${act.length}</p>
          <p class="kpi-v2-label">สัญญามีผล · จาก ${cs.length} ฉบับ</p>
        </div>
      </div>
    </div>

    <!-- ===== REVENUE & COLLECTION OVERVIEW ===== -->
    <div class="grid grid-cols-3 gap-6 mb-6">
      <!-- Horizontal Bar Chart: Revenue by Location -->
      <div class="section-card">
        <h2 class="section-title" style="--section-color:#6366f1">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
          รายได้ตามพื้นที่
        </h2>
        <div style="padding:8px 0 4px 0">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px">
            <div style="font-size:11px;color:#64748b">${MO[curMonth-1]} ${curBEYear}</div>
            <div style="display:flex;gap:12px;font-size:11px">
              <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#e2e8f0"></span>ยอดรวม</span>
              <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#10b981"></span>ชำระแล้ว</span>
            </div>
          </div>
          ${locBarData.length===0?'<div style="text-align:center;color:#64748b;padding:20px;font-size:13px">ไม่มีข้อมูลรายได้</div>':''}
          ${locBarData.map(d=>{
            const pctExp=Math.round(d.expected/locBarMax*100);
            const pctCol=locBarMax>0?Math.round(d.collected/locBarMax*100):0;
            const share=Math.round(d.expected/locBarTotal*100);
            const colRate=d.expected>0?Math.round(d.collected/d.expected*100):0;
            return`<div style="margin-bottom:14px">
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
                <div style="display:flex;align-items:center;gap:6px">
                  <div style="width:10px;height:10px;border-radius:3px;background:${d.color};flex-shrink:0"></div>
                  <span style="font-size:13px;font-weight:600;color:#1e293b">${esc(d.loc)}</span>
                  <span style="font-size:10px;color:#64748b">${share}%</span>
                </div>
                <span style="font-size:11px;font-weight:600;color:${colRate>=100?'#10b981':colRate>0?'#f59e0b':'#64748b'}">${colRate}%</span>
              </div>
              <div style="position:relative;height:20px;background:#f1f5f9;border-radius:6px;overflow:hidden">
                <div style="position:absolute;top:0;left:0;height:100%;width:${pctExp}%;background:${d.color}22;border-radius:6px"></div>
                <div style="position:absolute;top:0;left:0;height:100%;width:${pctCol}%;background:${d.color};border-radius:6px;transition:width .5s"></div>
              </div>
              <div style="display:flex;justify-content:space-between;margin-top:3px;font-size:11px">
                <span style="color:#10b981;font-weight:600">${fmtBaht(d.collected,{sym:0})}</span>
                <span style="color:#64748b">${fmtBaht(d.expected,{sym:0})} บาท</span>
              </div>
            </div>`;
          }).join('')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;border-top:1px solid #f1f5f9;padding-top:12px">
          <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:10px;padding:12px;text-align:center">
            <div style="font-size:11px;color:#065f46;margin-bottom:2px">เก็บแล้ว</div>
            <div style="font-size:18px;font-weight:800;color:#10b981">${fmtBaht(moCollected,{sym:0})}</div>
            <div style="font-size:10px;color:#065f46;opacity:0.7">บาท</div>
          </div>
          <div style="background:linear-gradient(135deg,${moOutstanding>0?'#fef2f2,#fee2e2':'#f0fdf4,#dcfce7'});border-radius:10px;padding:12px;text-align:center">
            <div style="font-size:11px;color:${moOutstanding>0?'#991b1b':'#065f46'};margin-bottom:2px">ค้างชำระ</div>
            <div style="font-size:18px;font-weight:800;color:${moOutstanding>0?'#ef4444':'#10b981'}">${fmtBaht(moOutstanding,{sym:0})}</div>
            <div style="font-size:10px;color:${moOutstanding>0?'#991b1b':'#065f46'};opacity:0.7">บาท</div>
          </div>
        </div>
      </div>

      <!-- 12-Month Trend Bar Chart -->
      <div class="section-card col-span-2">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <h2 class="section-title" style="--section-color:#8b5cf6">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            แนวโน้มรายได้ 12 เดือน
          </h2>
          <div style="display:flex;gap:16px;font-size:11px">
            <div style="display:flex;align-items:center;gap:4px"><div style="width:12px;height:12px;border-radius:3px;background:#8b5cf6"></div> คาดหวัง</div>
            <div style="display:flex;align-items:center;gap:4px"><div style="width:12px;height:12px;border-radius:3px;background:#10b981"></div> เก็บได้</div>
          </div>
        </div>
        <div style="position:relative;height:260px;padding:20px 0 30px 0">
          <!-- Y-axis labels -->
          <div style="position:absolute;left:0;top:20px;bottom:30px;width:50px;display:flex;flex-direction:column;justify-content:space-between">
            ${[1,0.75,0.5,0.25,0].map(f=>`<div style="font-size:10px;color:#64748b;text-align:right;padding-right:8px;transform:translateY(${f===0?'-50%':'50%'})">${(trendMax*f/1000).toFixed(0)}K</div>`).join('')}
          </div>
          <!-- Grid lines -->
          <div style="position:absolute;left:55px;right:10px;top:20px;bottom:30px">
            ${[0,25,50,75,100].map(p=>`<div style="position:absolute;left:0;right:0;top:${p}%;border-bottom:1px ${p===100?'solid #cbd5e1':'dashed #f1f5f9'};"></div>`).join('')}
          </div>
          <!-- Bars -->
          <div style="position:absolute;left:55px;right:10px;top:20px;bottom:30px;display:flex;gap:4px">
            ${trendData.map((t,i)=>{
              const hExp=trendMax>0?(t.expected/trendMax*100):0;
              const hCol=trendMax>0?(t.collected/trendMax*100):0;
              const isCur=i===11;
              return`<div style="flex:1;display:flex;gap:2px;align-items:flex-end">
                  <div style="flex:1;background:${isCur?'#8b5cf6':'#c4b5fd'};height:${hExp}%;border-radius:4px 4px 0 0;min-height:${t.expected>0?'2px':'0'};opacity:${isCur?1:0.7};transition:height .5s" title="คาดหวัง: ${fmtBaht(t.expected,{sym:0})} บาท"></div>
                  <div style="flex:1;background:${isCur?'#10b981':'#6ee7b7'};height:${hCol}%;border-radius:4px 4px 0 0;min-height:${t.collected>0?'2px':'0'};opacity:${isCur?1:0.7};transition:height .5s" title="เก็บได้: ${fmtBaht(t.collected,{sym:0})} บาท"></div>
              </div>`;
            }).join('')}
          </div>
          <!-- Month labels -->
          <div style="position:absolute;left:55px;right:10px;bottom:0;display:flex;gap:4px">
            ${trendData.map((t,i)=>{
              const isCur=i===11;
              return`<div style="flex:1;text-align:center;font-size:10px;font-weight:${isCur?'700':'400'};color:${isCur?'#8b5cf6':'#64748b'}">${t.label}</div>`;
            }).join('')}
          </div>
        </div>
        <!-- Summary stats row -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:8px;border-top:1px solid #f1f5f9;padding-top:12px">
          <div style="text-align:center">
            <div style="font-size:10px;color:#64748b">รายได้เดือนนี้</div>
            <div style="font-size:16px;font-weight:700;color:#8b5cf6">${fmtBaht(moExpected,{sym:0})}</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:10px;color:#64748b">เก็บได้เดือนนี้</div>
            <div style="font-size:16px;font-weight:700;color:#10b981">${fmtBaht(moCollected,{sym:0})}</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:10px;color:#64748b">เฉลี่ย/เดือน (12 ด.)</div>
            <div style="font-size:16px;font-weight:700;color:#475569">${fmtBaht(Math.round(trendData.reduce((s,t)=>s+t.collected,0)/12),{sym:0})}</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:10px;color:#64748b">สัญญาชำระเดือนนี้</div>
            <div style="font-size:16px;font-weight:700;color:#475569">${billingPaid}/${billingTotal}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== BILLING DETAIL TABLE ===== -->
    <div class="section-card" style="margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <h2 class="section-title" style="--section-color:#059669">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
          รายละเอียดการเก็บเงิน — ${MO[curMonth-1]} ${curBEYear}
        </h2>
        <div style="display:flex;gap:8px;font-size:11px">
          <span style="background:#dcfce7;color:#065f46;padding:2px 8px;border-radius:99px;font-weight:600">${billingPaid} ชำระแล้ว</span>
          ${billingTotal-billingPaid>0?`<span style="background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:99px;font-weight:600">${billingTotal-billingPaid} ค้างชำระ</span>`:''}
        </div>
      </div>
      <div style="overflow-x:auto;max-height:400px;overflow-y:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead style="position:sticky;top:0;z-index:1">
            <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0">
              <th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569">ผู้เช่า</th>
              <th style="padding:8px 12px;text-align:left;font-weight:600;color:#475569">ทรัพย์สิน</th>
              <th style="padding:8px 10px;text-align:center;font-weight:600;color:#475569;width:80px">พื้นที่</th>
              <th style="padding:8px 12px;text-align:right;font-weight:600;color:#475569;width:100px">คาดหวัง</th>
              <th style="padding:8px 12px;text-align:right;font-weight:600;color:#475569;width:100px">เก็บได้</th>
              <th style="padding:8px 10px;text-align:center;font-weight:600;color:#475569;width:90px">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            ${billingRows.map((r,i)=>`<tr style="border-bottom:1px solid #f1f5f9;background:${r.paid?'':'#fffbeb'};transition:background .15s" onmouseover="this.style.background='${r.paid?'#f0fdf4':'#fef3c7'}'" onmouseout="this.style.background='${r.paid?'':'#fffbeb'}'" onclick="viewContract(${r.cid})" class="cursor-pointer">
              <td style="padding:8px 12px;font-weight:500;color:#1e293b">${esc(r.tenant)}</td>
              <td style="padding:8px 12px;color:#475569;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.property)}</td>
              <td style="padding:8px 10px;text-align:center"><span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${MAP_LOC_COLORS[r.location]||'#64748b'}22;color:${MAP_LOC_COLORS[r.location]||'#475569'};font-weight:500">${esc(r.location)}</span></td>
              <td style="padding:8px 12px;text-align:right;font-weight:600;color:#475569">${fmtBaht(r.expected,{sym:0})}</td>
              <td style="padding:8px 12px;text-align:right;font-weight:700;color:${r.paid?'#10b981':'#64748b'}">${r.paid?fmtBaht(r.collected,{sym:0}):'-'}</td>
              <td style="padding:8px 10px;text-align:center">
                ${r.paid
                  ?'<span style="display:inline-flex;align-items:center;gap:3px;background:#dcfce7;color:#065f46;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600"><svg style="width:12px;height:12px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>ชำระแล้ว</span>'
                  :'<span style="display:inline-flex;align-items:center;gap:3px;background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600"><svg style="width:12px;height:12px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>รอชำระ</span>'}
              </td>
            </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr style="background:#f0f9ff;border-top:2px solid #059669">
              <td colspan="3" style="padding:10px 12px;font-weight:700;color:#1e293b;text-align:right">รวม ${billingTotal} สัญญา</td>
              <td style="padding:10px 12px;text-align:right;font-weight:700;color:#8b5cf6;font-size:13px">${fmtBaht(moExpected,{sym:0})}</td>
              <td style="padding:10px 12px;text-align:right;font-weight:700;color:#10b981;font-size:13px">${fmtBaht(moCollected,{sym:0})}</td>
              <td style="padding:10px;text-align:center;font-weight:700;color:${collectionRate>=100?'#10b981':'#f59e0b'};font-size:13px">${collectionRate}%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-6 mb-6">
      <div class="section-card col-span-2">
        <h2 class="section-title" style="--section-color:#6366f1">แผนที่ทรัพย์สิน</h2>
        <div class="map-wrap">
          <div class="map-svg-box" style="flex:0 0 380px;padding:12px">${thaiMap}</div>
          <div class="map-detail">
            <div style="font-size:12px;color:#64748b;margin-bottom:16px">กดจังหวัดบนแผนที่เพื่อดูรายละเอียด</div>
            ${locEntries.slice(0,5).map(([loc,d])=>{
              const pct=tot?Math.round(d.rev/tot*100):0;
              const color=MAP_LOC_COLORS[loc]||'#64748b';
              const isSel=loc===sel;
              return`<div class="map-loc-card ${isSel?'sel':''}" onclick="mapClickLoc('${loc}')" style="${isSel?'border-left-color:'+color+';border-left-width:4px':''}">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></div>
                    <span class="font-semibold text-gray-900 text-sm">${esc(loc)}</span>
                  </div>
                  <div class="text-right">
                    <span class="font-bold text-sm" style="color:${color}">${fmtBaht(d.rev,{sym:0})}</span>
                    <span class="text-xs text-gray-400 ml-1">${pct}%</span>
                  </div>
                </div>
                <div class="flex items-center gap-2 mt-2 text-xs text-gray-500">
                  <span>${d.props.length} ทรัพย์</span>
                  <span>·</span>
                  <span>${d.contracts.filter(c=>{const s=status(c);return s==='active'||s==='expiring'}).length} สัญญา</span>
                </div>
                <div class="heat-bar" style="width:${pct}%;background:linear-gradient(90deg,${color},${color}dd);margin-top:8px;padding:0 8px;font-size:10px">${pct}%</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="section-card">
        <h2 class="section-title" style="--section-color:#10b981">สรุปเดือนนี้</h2>
        <div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
            <span style="font-size:12px;color:#64748b">เก็บเงินแล้ว</span>
            <span style="font-size:13px;font-weight:700;color:${collectionRate>=100?'#10b981':collectionRate>=50?'#f59e0b':'#ef4444'}">${collectionRate}%</span>
          </div>
          <div style="height:10px;background:#e2e8f0;border-radius:5px;overflow:hidden">
            <div style="height:100%;width:${Math.min(collectionRate,100)}%;background:${collectionRate>=100?'#10b981':collectionRate>=50?'#f59e0b':'#ef4444'};border-radius:5px;transition:width .5s"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:#64748b">
            <span>${fmtBaht(moCollected,{sym:0})} บาท</span>
            <span>เป้า ${fmtBaht(moExpected,{sym:0})} บาท</span>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
          <div style="background:#f0fdf4;border-radius:8px;padding:10px;text-align:center;cursor:pointer" onclick="showPage('properties')">
            <div style="font-size:20px;font-weight:700;color:#10b981">${fmtBaht(moCollected,{sym:0})}</div>
            <div style="font-size:10px;color:#065f46">เก็บแล้ว (บาท)</div>
          </div>
          <div style="background:${moOutstanding>0?'#fef2f2':'#f0fdf4'};border-radius:8px;padding:10px;text-align:center;cursor:pointer" onclick="showPage('properties')">
            <div style="font-size:20px;font-weight:700;color:${moOutstanding>0?'#ef4444':'#10b981'}">${moOutstanding>0?fmtBaht(moOutstanding,{sym:0}):'0'}</div>
            <div style="font-size:10px;color:${moOutstanding>0?'#991b1b':'#065f46'}">ค้างชำระ (บาท)</div>
          </div>
        </div>
        <div style="border-top:1px solid #e2e8f0;padding-top:12px">
          <div style="font-size:12px;font-weight:600;color:#334155;margin-bottom:8px">ต้องดำเนินการ</div>
          ${exp.length>0?'<div style="display:flex;align-items:center;gap:8px;padding:8px;background:#fffbeb;border-radius:6px;margin-bottom:6px;cursor:pointer;font-size:12px" onclick="showPage(\'renewals\')"><span style="color:#f59e0b;font-weight:700">'+exp.length+'</span><span style="color:#92400e">สัญญาใกล้หมดอายุ</span><span style="margin-left:auto;color:#f59e0b;font-size:10px">ดู →</span></div>':''}
          ${moOutstanding>0?'<div style="display:flex;align-items:center;gap:8px;padding:8px;background:#fef2f2;border-radius:6px;margin-bottom:6px;cursor:pointer;font-size:12px" onclick="showPage(\'invoices\')"><span style="color:#ef4444;font-weight:700">'+fmtBaht(moOutstanding,{sym:0})+'</span><span style="color:#991b1b">บาทยังไม่เก็บ</span><span style="margin-left:auto;color:#ef4444;font-size:10px">ดูใบแจ้งหนี้ →</span></div>':''}
          ${(totalProps-occupiedProps)>0?'<div style="display:flex;align-items:center;gap:8px;padding:8px;background:#f1f5f9;border-radius:6px;cursor:pointer;font-size:12px" onclick="showPage(\'properties\');propFilter.status=\'vacant\';renderProperties()"><span style="color:#6366f1;font-weight:700">'+(totalProps-occupiedProps)+'</span><span style="color:#475569">ทรัพย์สินว่าง</span><span style="margin-left:auto;color:#6366f1;font-size:10px">ดู →</span></div>':''}
          ${exp.length===0&&moOutstanding<=0&&occupiedProps===totalProps?'<div style="padding:8px;background:#f0fdf4;border-radius:6px;font-size:12px;color:#065f46;text-align:center">ทุกอย่างเรียบร้อยดี</div>':''}
        </div>
      </div>
    </div>

    ${incomeTableHTML}

    ${sel?detailHTML:''}
    ${expHTML}`;
  }catch(e){console.error('renderDash error:',e);$('content').innerHTML='<div class="p-6 text-red-500">Dashboard error: '+e.message+'</div>';}
}

function mapClickLoc(loc){
  mapSelLoc=mapSelLoc===loc?null:loc;
  renderDash();
}
function toggleIncomeDetail(loc){
  const key=loc.replace(/\s/g,'');
  const row=document.getElementById('incDetail_'+key);
  const chev=document.getElementById('incChev_'+key);
  if(!row)return;
  const show=row.style.display==='none';
  row.style.display=show?'':'none';
  if(chev)chev.style.transform=show?'rotate(90deg)':'';
}

