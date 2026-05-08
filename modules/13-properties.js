// ========== TAB BAR HELPERS ==========
function propTabBar(){
  const renewCount=DB.contracts.filter(c=>{const s=status(c);return(s==='expiring');}).length;
  const tabs=[
    {id:'properties',label:'ทรัพย์สิน',icon:'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'},
    {id:'contracts',label:'สัญญาเช่า',icon:'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'},
    {id:'renewals',label:'ใกล้หมดอายุ'+(renewCount>0?' ('+renewCount+')':''),icon:'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',badge:renewCount},
  ];
  return `<div style="display:flex;gap:2px;background:#f1f5f9;border-radius:10px;padding:3px;margin-bottom:16px">
    ${tabs.map(t=>{
      const active=propTab===t.id;
      return `<button onclick="propTab='${t.id}';render()" style="flex:1;padding:8px 12px;border:none;border-radius:8px;font-size:12px;font-weight:${active?'700':'500'};cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;transition:all .15s;background:${active?'#fff':'transparent'};color:${active?'#1e293b':'#64748b'};box-shadow:${active?'0 1px 3px rgba(0,0,0,.1)':'none'}">
        <svg style="width:14px;height:14px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${t.icon}"/></svg>
        ${t.label}
        ${t.badge&&t.badge>0?'<span style="background:#ef4444;color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:99px;min-width:16px;text-align:center">'+t.badge+'</span>':''}
      </button>`;
    }).join('')}
  </div>`;
}


// ========== PROPERTY HELPERS ==========
// ทรัพย์สินที่แบ่งให้หลายผู้เช่าได้พร้อมกัน (ดาดฟ้า, ที่ดินใหญ่, ฯลฯ)
// ใช้สำหรับ skip การเช็ค "ซ้อน!" — เช่นดาดฟ้าใส่เสาส่งสัญญาณหลายเจ้าได้ปกติ
function isMultiTenantProperty(pidOrProp){
  let p = pidOrProp;
  if(typeof pidOrProp === 'number' || typeof pidOrProp === 'string'){
    p = (DB.properties||[]).find(x => x.pid === +pidOrProp);
  }
  if(!p) return false;
  if(p.multiTenant === true) return true;
  // Default: ดาดฟ้าเกือบทั้งหมดมีหลายผู้เช่าพร้อมกัน
  if(p.type === 'rooftop_tower') return true;
  return false;
}

// Display address — fallback ไป titleDeed ถ้า address ว่าง/สั้นเกิน (เคสที่ดินเปล่า)
function getPropertyAddress(p){
  if(!p) return '';
  const addr = (p.address || p.location || '').trim();
  // ถือว่า address ใช้งานได้จริงต้องมี markers (ต./อ./จ./แขวง/เขต/หมู่/ซอย/ถนน) หรือยาวพอ
  const markers = /(ต\.|อ\.|จ\.|แขวง|เขต|หมู่|ม\.\d|ซอย|ซ\.|ถนน|ถ\.)/;
  if(addr && (addr.length >= 15 || markers.test(addr))) return addr;
  // Fallback: titleDeed มักมีตำแหน่งโฉนด (ต.X อ.Y จ.Z) ของที่ดินเปล่า
  const td = (p.titleDeed || '').trim();
  if(td && markers.test(td)) return td;
  return addr || td || '';
}

// ========== PROPERTIES ==========
let propFilter = { q: '', type: 'all', loc: 'all', status: 'all' };
function clearPropFilter(){propFilter={q:'',type:'all',loc:'all',status:'all'};renderProperties();}
let propSort = { key: 'name', dir: 'asc' };  // key: name|rent|contracts|end|start|status
function togglePropSort(key){if(propSort.key===key)propSort.dir=propSort.dir==='asc'?'desc':'asc';else{propSort.key=key;propSort.dir=(key==='rent'||key==='contracts')?'desc':'asc';}renderProperties();}

let propExpanded = new Set();

function propInfo(p) {
  const cs = DB.contracts.filter(c => c.pid === p.pid);
  const active = cs.filter(c => { const s = status(c); return s === 'active' || s === 'expiring'; });
  const upcoming = cs.filter(c => status(c) === 'upcoming');
  const cancelled = cs.filter(c => status(c) === 'cancelled');
  const expiring = cs.filter(c => status(c) === 'expiring');
  // Split revenue: monthly vs yearly — only count active/expiring, NOT upcoming
  let revMo=0, revYr=0;
  active.forEach(c=>{
    const freq=payFreq(c.rate,c.payment);
    const mo=monthlyRev(c);
    if(freq.type==='yearly'||freq.type==='lump'){
      revYr+=mo*12; // แสดงเป็นรายปี
    }else{
      revMo+=mo;
    }
  });
  const rev = revMo + (revYr/12); // total monthly equivalent
  const isVacant = active.length === 0 && upcoming.length === 0;
  const bestStatus = expiring.length > 0 ? 'expiring' : (active.length > 0 ? 'active' : (upcoming.length > 0 ? 'upcoming' : 'vacant'));
  // Get landlords from active contracts
  const landlords = [...new Set([...active,...upcoming].map(c=>c.landlord).filter(Boolean))];
  // Overlap check — skip ทรัพย์สินที่แบ่งให้หลายผู้เช่าได้พร้อมกัน (ดาดฟ้า ฯลฯ)
  const overlapIds=new Set();
  if(!isMultiTenantProperty(p)){
    const nonCancelled=cs.filter(x=>{const sx=status(x);return sx!=='cancelled';});
    for(let i=0;i<nonCancelled.length;i++){
      for(let j=i+1;j<nonCancelled.length;j++){
        const as=parseBE(nonCancelled[i].start),ae=parseBE(nonCancelled[i].end);
        const bs=parseBE(nonCancelled[j].start),be=parseBE(nonCancelled[j].end);
        if(as&&ae&&bs&&be){
          const overlapMs=Math.min(ae.getTime(),be.getTime())-Math.max(as.getTime(),bs.getTime());
          if(overlapMs>86400000){ // >1 day = real overlap, not edge-touch
            overlapIds.add(nonCancelled[i].id);
            overlapIds.add(nonCancelled[j].id);
          }
        }
      }
    }
  }
  const hasOverlap=overlapIds.size>0;
  return { cs, active, upcoming, cancelled, expiring, rev, revMo, revYr, isVacant, bestStatus, total: cs.length, landlords, hasOverlap, overlapIds };
}

function renderProperties(){
  const ps = DB.properties;
  const locs = [...new Set(ps.map(p => p.location))].sort();
  const types = [...new Set(ps.map(p => p.type))].sort();

  let filtered = ps.map(p => ({ ...p, _info: propInfo(p) }));
  if (propFilter.q) {
    const q = propFilter.q.toLowerCase();
    filtered = filtered.filter(p => {
      if (p.name.toLowerCase().includes(q) || (p.address||'').toLowerCase().includes(q)) return true;
      return p._info.cs.some(c => c.tenant?.toLowerCase().includes(q) || c.no?.toLowerCase().includes(q));
    });
  }
  if (propFilter.type !== 'all') filtered = filtered.filter(p => p.type === propFilter.type);
  if (propFilter.loc !== 'all') filtered = filtered.filter(p => p.location === propFilter.loc);
  if (propFilter.status === 'vacant') filtered = filtered.filter(p => p._info.isVacant);
  else if (propFilter.status === 'occupied') filtered = filtered.filter(p => !p._info.isVacant);
  else if (propFilter.status === 'expiring') filtered = filtered.filter(p => p._info.expiring.length > 0);
  else if (propFilter.status === 'badaddr') filtered = filtered.filter(p => isBadAddr(p));
  else if (propFilter.status === 'pendingdeposit') filtered = filtered.filter(p =>
    p._info.active.concat(p._info.upcoming).some(c=>{const di=(DB.invoices||[]).find(i=>i.cid===c.id&&i.category==='deposit');return di&&di.status!=='paid';})
  );

  // Sorting
  if(propSort.key==='rent') filtered.sort((a,b)=>(b._info.rev-a._info.rev)*(propSort.dir==='asc'?-1:1));
  else if(propSort.key==='contracts') filtered.sort((a,b)=>(b._info.active.length-a._info.active.length)*(propSort.dir==='asc'?-1:1));
  else if(propSort.key==='name') filtered.sort((a,b)=>propSort.dir==='asc'?a.name.localeCompare(b.name,'th'):b.name.localeCompare(a.name,'th'));
  else if(propSort.key==='end'){
    filtered.sort((a,b)=>{
      const ae=a._info.active.map(c=>parseBE(c.end)).filter(Boolean).sort((x,y)=>x-y)[0];
      const be=b._info.active.map(c=>parseBE(c.end)).filter(Boolean).sort((x,y)=>x-y)[0];
      if(!ae&&!be)return 0;if(!ae)return 1;if(!be)return -1;
      return propSort.dir==='asc'?(ae-be):(be-ae);
    });
  }
  else if(propSort.key==='start'){
    filtered.sort((a,b)=>{
      const as=a._info.active.map(c=>parseBE(c.start)).filter(Boolean).sort((x,y)=>x-y)[0];
      const bs=b._info.active.map(c=>parseBE(c.start)).filter(Boolean).sort((x,y)=>x-y)[0];
      if(!as&&!bs)return 0;if(!as)return 1;if(!bs)return -1;
      return propSort.dir==='asc'?(as-bs):(bs-as);
    });
  }
  else if(propSort.key==='status'){
    const so={active:0,expiring:1,expired:2,vacant:3,upcoming:4,cancelled:5};
    filtered.sort((a,b)=>{
      const sa=a._info.isVacant?'vacant':a._info.bestStatus;
      const sb=b._info.isVacant?'vacant':b._info.bestStatus;
      const d=(so[sa]??9)-(so[sb]??9);
      return propSort.dir==='asc'?d:-d;
    });
  }
  else if(propSort.key==='tenant'){
    filtered.sort((a,b)=>{
      const at=a._info.active[0]?.tenant||'';
      const bt=b._info.active[0]?.tenant||'';
      if(!at&&!bt)return 0;if(!at)return 1;if(!bt)return -1;
      return propSort.dir==='asc'?at.localeCompare(bt,'th'):bt.localeCompare(at,'th');
    });
  }
  else if(propSort.key==='landlord'){
    filtered.sort((a,b)=>{
      const al=a._info.landlords[0]||'';
      const bl=b._info.landlords[0]||'';
      if(!al&&!bl)return 0;if(!al)return 1;if(!bl)return -1;
      return propSort.dir==='asc'?al.localeCompare(bl,'th'):bl.localeCompare(al,'th');
    });
  }
  else if(propSort.key==='type'){
    filtered.sort((a,b)=>{
      const at=a.type||'';const bt=b.type||'';
      return propSort.dir==='asc'?at.localeCompare(bt,'th'):bt.localeCompare(at,'th');
    });
  }

  // Summary stats
  const totalProps = filtered.length;
  const totalVacant = filtered.filter(p => p._info.isVacant).length;
  const totalRevMo = filtered.reduce((s, p) => s + p._info.revMo, 0);
  const totalRevYr = filtered.reduce((s, p) => s + p._info.revYr, 0);
  const totalContracts = filtered.reduce((s, p) => s + p._info.active.length, 0);
  const totalCancelled = filtered.reduce((s, p) => s + p._info.cancelled.length, 0);
  const badAddrCount = DB.properties.filter(p=>isBadAddr(p)).length;
  const noProvCount = DB.properties.filter(p =>
    !p.province && !p.addr_province &&
    !(typeof extractProvince === 'function' && extractProvince(p.location||p.address))
  ).length;
  const pendDepCount = DB.properties.filter(p=>{
    const pcs=DB.contracts.filter(c=>c.pid===p.pid);
    return pcs.some(c=>{const s=status(c);if(s==='cancelled'||s==='expired')return false;const di=(DB.invoices||[]).find(i=>i.cid===c.id&&i.category==='deposit');return di&&di.status!=='paid';});
  }).length;

  // Group by location — only when sorting by name (default).
  // Other sorts → flat list so sort order is global (not per-province).
  const grouped = {};
  const locColors = {'ราชบุรี':'#6366f1','กรุงเทพฯ':'#ef4444','เชียงใหม่':'#22c55e','กาญจนบุรี':'#f59e0b','นครปฐม':'#06b6d4','อื่นๆ':'#8b5cf6'};
  const groupByLoc = propSort.key === 'name';
  if (groupByLoc) {
    filtered.forEach(p => {
      if (!grouped[p.location]) grouped[p.location] = [];
      grouped[p.location].push(p);
    });
  } else {
    grouped['__all__'] = filtered;
  }

  const locOrder = ['ราชบุรี','กรุงเทพฯ','เชียงใหม่','กาญจนบุรี','นครปฐม','อื่นๆ'];
  const sortedLocs = Object.keys(grouped).sort((a, b) => {
    const ai = locOrder.indexOf(a), bi = locOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  $('content').innerHTML = `${propTabBar()}
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <div class="relative flex-1" style="min-width:220px">
        <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input id="pq" type="text" placeholder="ค้นหาทรัพย์สิน หรือ ชื่อผู้เช่า..." value="${esc(propFilter.q)}" class="w-full pl-9 pr-4 py-2 border rounded-lg text-sm">
      </div>
      <select id="ptf" class="px-3 py-2 border rounded-lg text-sm bg-white">
        <option value="all">ทุกประเภท</option>${types.map(t => `<option value="${esc(t)}" ${propFilter.type===t?'selected':''}>${esc(t)}</option>`).join('')}
      </select>
      <select id="plf" class="px-3 py-2 border rounded-lg text-sm bg-white">
        <option value="all">ทุกจังหวัด</option>${locs.map(l => `<option value="${esc(l)}" ${propFilter.loc===l?'selected':''}>${esc(l)}</option>`).join('')}
      </select>
      <select id="psf" class="px-3 py-2 border rounded-lg text-sm bg-white">
        <option value="all" ${propFilter.status==='all'?'selected':''}>ทั้งหมด</option>
        <option value="occupied" ${propFilter.status==='occupied'?'selected':''}>มีผู้เช่า</option>
        <option value="vacant" ${propFilter.status==='vacant'?'selected':''}>ว่าง</option>
        <option value="expiring" ${propFilter.status==='expiring'?'selected':''}>สัญญาใกล้หมด</option>
        ${badAddrCount>0?'<option value="badaddr" '+(propFilter.status==='badaddr'?'selected':'')+'>⚠ ที่อยู่ไม่ถูกต้อง ('+badAddrCount+')</option>':''}
        ${pendDepCount>0?'<option value="pendingdeposit" '+(propFilter.status==='pendingdeposit'?'selected':'')+'>💰 ค้างรับเงินประกัน ('+pendDepCount+')</option>':''}
      </select>
      <select id="psort" class="px-3 py-2 border rounded-lg text-sm bg-white">
        <option value="name" ${propSort.key==='name'?'selected':''}>ชื่อ ก-ฮ</option>
        <option value="rent" ${propSort.key==='rent'?'selected':''}>ค่าเช่า มาก→น้อย</option>
        <option value="contracts" ${propSort.key==='contracts'?'selected':''}>จำนวนสัญญา</option>
        <option value="end" ${propSort.key==='end'?'selected':''}>สิ้นสุดเร็วสุด</option>
        <option value="start" ${propSort.key==='start'?'selected':''}>เริ่มสัญญา</option>
        <option value="status" ${propSort.key==='status'?'selected':''}>สถานะ</option>
        <option value="tenant" ${propSort.key==='tenant'?'selected':''}>ผู้เช่า ก-ฮ</option>
        <option value="landlord" ${propSort.key==='landlord'?'selected':''}>ผู้ให้เช่า ก-ฮ</option>
      </select>
      <button onclick="openAddPropertyDialog()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-1.5">+ เพิ่มทรัพย์สิน</button>
    </div>

    <div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap;align-items:stretch">
      <!-- Occupancy donut -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:12px;min-width:200px">
        ${(()=>{
          const occRate=totalProps>0?Math.round((totalProps-totalVacant)/totalProps*100):0;
          const oR=26,oC=2*Math.PI*oR,oF=oC*(1-occRate/100);
          return `<svg width="64" height="64" viewBox="0 0 64 64" style="flex-shrink:0">
            <circle cx="32" cy="32" r="${oR}" fill="none" stroke="#fee2e2" stroke-width="7"/>
            <circle cx="32" cy="32" r="${oR}" fill="none" stroke="#10b981" stroke-width="7" stroke-dasharray="${oC}" stroke-dashoffset="${oF}" stroke-linecap="round" transform="rotate(-90 32 32)" style="transition:stroke-dashoffset .8s"/>
            <text x="32" y="30" text-anchor="middle" font-size="13" font-weight="800" fill="#111827">${occRate}%</text>
            <text x="32" y="42" text-anchor="middle" font-size="7" fill="#64748b">ครอบครอง</text>
          </svg>`;
        })()}
        <div>
          <div style="font-size:11px;color:#64748b;margin-bottom:2px">อัตราการเช่า</div>
          <div style="display:flex;gap:8px;font-size:12px">
            <span style="color:#10b981;font-weight:700">${totalProps-totalVacant} เช่า</span>
            <span style="color:#ef4444;font-weight:700">${totalVacant} ว่าง</span>
          </div>
        </div>
      </div>
      <!-- Stat cards (unified design) -->
      <div style="flex:1;display:flex;gap:6px;flex-wrap:wrap;min-width:0">
        <div class="kpi-box" style="flex:1;min-width:70px"><div class="kv" style="color:#6366f1">${totalProps}</div><div class="kl">ทรัพย์สิน</div></div>
        <div class="kpi-box" style="flex:1;min-width:70px"><div class="kv" style="color:#059669">${totalContracts}</div><div class="kl">สัญญามีผล</div></div>
        ${totalCancelled>0?'<div class="kpi-box" style="flex:1;min-width:70px"><div class="kv" style="color:#64748b">'+totalCancelled+'</div><div class="kl">ยกเลิก</div></div>':''}
        <div class="kpi-box accent" style="flex:1;min-width:90px"><div class="kv" style="color:#059669;font-size:20px">${fmtBaht(totalRevMo,{sym:0})}</div><div class="kl">บ./เดือน</div></div>
        ${totalRevYr>0?'<div class="kpi-box accent2" style="flex:1;min-width:90px"><div class="kv" style="color:#2563eb;font-size:20px">'+fmtBaht(totalRevYr,{sym:0})+'</div><div class="kl">บ./ปี</div></div>':''}
      </div>
      <!-- Type distribution mini bars -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px;min-width:160px">
        <div style="font-size:10px;color:#64748b;margin-bottom:6px;font-weight:600">ตามประเภท</div>
        ${(()=>{
          const tc={};filtered.forEach(p=>{tc[p.type]=(tc[p.type]||0)+1});
          const tEntries=Object.entries(tc).sort((a,b)=>b[1]-a[1]).slice(0,5);
          const tMax=Math.max(...tEntries.map(e=>e[1]),1);
          const tColors=['#6366f1','#f59e0b','#10b981','#ef4444','#06b6d4'];
          return tEntries.map(([t,n],i)=>`<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
            <span style="font-size:10px;color:#475569;width:50px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t)}</span>
            <div style="flex:1;height:6px;background:#f1f5f9;border-radius:3px;overflow:hidden"><div style="height:100%;width:${Math.round(n/tMax*100)}%;background:${tColors[i%5]};border-radius:3px"></div></div>
            <span style="font-size:10px;font-weight:700;color:${tColors[i%5]};min-width:16px;text-align:right">${n}</span>
          </div>`).join('');
        })()}
      </div>
    </div>

    ${badAddrCount>0?'<div onclick="propFilter.status=\'badaddr\';renderProperties()" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px 14px;margin-bottom:12px;cursor:pointer;display:flex;align-items:center;gap:8px"><span style="font-size:18px">⚠</span><span style="font-size:13px;color:#dc2626;font-weight:600">'+badAddrCount+' ทรัพย์สินไม่มีที่อยู่ที่ถูกต้อง</span><span style="font-size:11px;color:#ef4444;margin-left:auto">คลิกเพื่อกรอง →</span></div>':''}
    ${noProvCount>0?'<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:8px 14px;margin-bottom:12px;display:flex;align-items:center;gap:8px"><span style="font-size:18px">🗺️</span><span style="font-size:13px;color:#9a3412;font-weight:600">'+noProvCount+' ทรัพย์สินไม่มีจังหวัด — แผนที่/รายงานไม่ครบ</span><button onclick="openProvinceFillTool()" style="margin-left:auto;padding:5px 14px;background:#ea580c;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;font-family:Sarabun;white-space:nowrap">เติมจังหวัด</button></div>':''}
    ${pendDepCount>0?'<div onclick="propFilter.status=\'pendingdeposit\';renderProperties()" style="background:#ecfeff;border:1px solid #a5f3fc;border-radius:8px;padding:8px 14px;margin-bottom:12px;cursor:pointer;display:flex;align-items:center;gap:8px"><span style="font-size:18px">💰</span><span style="font-size:13px;color:#0891b2;font-weight:600">'+pendDepCount+' ทรัพย์สินค้างรับเงินประกัน</span><span style="font-size:11px;color:#0891b2;margin-left:auto">คลิกเพื่อกรอง →</span></div>':''}

    <div id="propList">
    <div class="grid-properties-header">
      <div></div>
      <div class="col-sort" onclick="togglePropSort('name')" title="เรียงตามชื่อ">ทรัพย์สิน ${propSort.key==='name'?'<span class="arrow">'+(propSort.dir==='asc'?'▲':'▼')+'</span>':''}</div>
      <div class="col-sort" onclick="togglePropSort('tenant')" title="เรียงตามผู้เช่า">ผู้เช่า ${propSort.key==='tenant'?'<span class="arrow">'+(propSort.dir==='asc'?'▲':'▼')+'</span>':''}</div>
      <div class="col-sort" onclick="togglePropSort('status')" title="เรียงตามสถานะ">สถานะ ${propSort.key==='status'?'<span class="arrow">'+(propSort.dir==='asc'?'▲':'▼')+'</span>':''}</div>
      <div class="col-sort" onclick="togglePropSort('end')" title="เรียงตามสิ้นสุดสัญญา">ระยะสัญญา ${propSort.key==='end'||propSort.key==='start'?'<span class="arrow">'+(propSort.dir==='asc'?'▲':'▼')+'</span>':''}</div>
      <div class="col-sort" onclick="togglePropSort('rent')" style="text-align:right;justify-content:flex-end" title="เรียงตามค่าเช่า">ค่าเช่า/ด. ${propSort.key==='rent'?'<span class="arrow">'+(propSort.dir==='asc'?'▲':'▼')+'</span>':''}</div>
    </div>
    ${filtered.length===0?`
      <div style="text-align:center;padding:60px 20px;background:#fff;border:2px dashed #e5e7eb;border-radius:12px;margin-top:12px">
        <div style="font-size:48px;margin-bottom:12px">🏢</div>
        <div style="font-size:16px;font-weight:700;color:#1e293b;margin-bottom:6px">${DB.properties.length===0?'ยังไม่มีทรัพย์สิน':'ไม่พบทรัพย์สินตามตัวกรอง'}</div>
        <div style="font-size:13px;color:#64748b;margin-bottom:16px">${DB.properties.length===0?'เริ่มต้นโดยการเพิ่มทรัพย์สินแรกของคุณ':'ลองล้างตัวกรอง หรือเปลี่ยนคำค้นหา'}</div>
        ${DB.properties.length===0?'<button onclick="openAddPropertyDialog()" style="padding:10px 20px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">+ เพิ่มทรัพย์สิน</button>':'<button onclick="clearPropFilter()" style="padding:8px 16px;background:#f1f5f9;color:#475569;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">ล้างตัวกรอง</button>'}
      </div>
    `:''}
    ${sortedLocs.map(loc => {
      const items = grouped[loc];
      const locRevMo = items.reduce((s,p) => s+p._info.revMo, 0);
      const locRevYr = items.reduce((s,p) => s+p._info.revYr, 0);
      const dotColor = locColors[loc] || '#64748b';
      const showLocHeader = groupByLoc && loc !== '__all__';
      return `
      ${showLocHeader ? `<div style="display:flex;align-items:center;gap:6px;padding:6px 8px;margin-top:8px;background:${dotColor}11;border-left:3px solid ${dotColor};border-radius:0 4px 4px 0">
        <span style="font-weight:700;color:#1e293b;font-size:12px">${esc(loc)}</span>
        <span style="font-size:10px;color:#64748b">${items.length} ทรัพย์สิน</span>
        <span style="font-size:10px;font-weight:600;color:${dotColor};margin-left:auto">${locRevMo>0?fmtBaht(locRevMo,{sym:0})+' บ./ด.':''}${locRevMo>0&&locRevYr>0?' · ':''}${locRevYr>0?fmtBaht(locRevYr,{sym:0})+' บ./ปี':''}</span>
      </div>` : ''}
      ${items.map(p => {
        const info = p._info;
        const expanded = propExpanded.has(p.pid);
        const borderClass = info.isVacant ? 'prop-vacant' : (info.expiring.length > 0 ? 'prop-expiring' : (info.cancelled.length > 0 && info.active.length === 0 ? 'prop-vacant' : 'prop-active'));
        const landlordStr = info.landlords.length>0?info.landlords[0]+(info.landlords.length>1?' +อีก'+(info.landlords.length-1):''):'';
        const landlordShort = landlordStr.replace(/บริษัท\s*/g,'บจก.').replace(/\s*จำกัด/g,'').replace(/\s*โดย\s*.+/,'');
        const stBadge = {active:'<span style="background:#dcfce7;color:#15803d;padding:1px 7px;border-radius:99px;font-size:10px;font-weight:600;white-space:nowrap">มีผล</span>',expiring:'<span style="background:#fef3c7;color:#b45309;padding:1px 7px;border-radius:99px;font-size:10px;font-weight:600;white-space:nowrap;animation:pulse-badge 2s infinite">ใกล้หมด</span>',expired:'<span style="background:#fee2e2;color:#dc2626;padding:1px 7px;border-radius:99px;font-size:10px;font-weight:600;white-space:nowrap">หมดอายุ</span>',upcoming:'<span style="background:#e0e7ff;color:#4338ca;padding:1px 7px;border-radius:99px;font-size:10px;font-weight:600;white-space:nowrap">รอเริ่ม</span>',cancelled:'<span style="background:#f1f5f9;color:#64748b;padding:1px 7px;border-radius:99px;font-size:10px;font-weight:600;white-space:nowrap;text-decoration:line-through">ยกเลิก</span>',vacant:'<span style="background:#fee2e2;color:#ef4444;padding:1px 7px;border-radius:99px;font-size:10px;font-weight:600;white-space:nowrap">ว่าง</span>'};
        // Pending deposit badge
        const _pDepBadge=info.active.concat(info.upcoming).some(c=>{const di=(DB.invoices||[]).find(i=>i.cid===c.id&&i.category==='deposit');return di&&di.status!=='paid';});
        // Build list of rows — 1 row per active/expiring contract; if none → 1 vacant row
        const rows = info.active.concat(info.expiring.filter(c => info.active.indexOf(c) === -1));
        const isVacant = rows.length === 0;
        const now = new Date();
        const rowCount = isVacant ? 1 : rows.length;
        const buildRow = (c, idx) => {
          const isFirst = idx === 0;
          const s = c ? status(c) : 'vacant';
          const cStartD = c ? parseBE(c.start) : null;
          const cEndD = c ? parseBE(c.end) : null;
          const totalDays = cStartD && cEndD ? Math.max(1, Math.round((cEndD - cStartD) / 864e5)) : 0;
          const elapsed = cStartD ? Math.round((now - cStartD) / 864e5) : 0;
          const remaining = cEndD ? Math.round((cEndD - now) / 864e5) : 0;
          const pct = totalDays > 0 ? Math.min(100, Math.max(0, Math.round(elapsed / totalDays * 100))) : 0;
          const startShort = cStartD ? (cStartD.getDate()+'/'+(cStartD.getMonth()+1)+'/'+(cStartD.getFullYear()+543).toString().slice(-2)) : '-';
          const endShort = cEndD ? (cEndD.getDate()+'/'+(cEndD.getMonth()+1)+'/'+(cEndD.getFullYear()+543).toString().slice(-2)) : '-';
          const barColor = remaining < 0 ? '#dc2626' : remaining <= 90 ? '#f59e0b' : '#22c55e';
          const daysLabel = remaining < 0 ? Math.abs(remaining)+' วันเกิน' : remaining <= 0 ? 'หมดวันนี้' : 'เหลือ '+remaining+' วัน';
          const cMo = c ? monthlyRev(c) : 0;
          const tenantDisp = c ? (esc(c.tenant)||'-')+(c.spot?' <span style="color:#64748b;font-size:10px">· '+esc(c.spot)+'</span>':'') : '<span style="color:#cbd5e1">-</span>';
          const tenantClick = c ? `onclick="event.stopPropagation();viewContract(${c.id})" style="cursor:pointer"` : '';
          return `
          <div class="prop-head grid-properties-row${isFirst?'':' prop-subrow'}" onclick="togglePropExpand(${p.pid})" style="padding:6px 10px${isFirst?'':';border-top:1px dashed #e2e8f0'}">
            ${isFirst ? `<svg style="width:12px;height:12px" class="text-gray-400 transition-transform ${expanded?'transform rotate-90':''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>` : '<span></span>'}
            <div style="min-width:0;overflow:hidden;display:flex;align-items:center;gap:5px">
              ${isFirst ? `<span style="font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;flex:1">${esc(p.name)}</span>
              ${p.type?'<span class="type-badge '+typeColor(p.type)+'" style="font-size:9px;padding:1px 4px;white-space:nowrap;flex-shrink:0">'+esc(p.type)+'</span>':''}
              ${info.hasOverlap?'<span onclick="event.stopPropagation();showOverlapDetail('+p.pid+')" style="font-size:10px;color:#fff;background:#dc2626;padding:1px 6px;border-radius:99px;font-weight:700;flex-shrink:0;cursor:pointer" title="คลิกดูรายละเอียด">ซ้อน!</span>':''}
              ${isBadAddr(p)?'<span style="font-size:10px;color:#ef4444;flex-shrink:0">⚠</span>':''}
              ${_pDepBadge?'<span style="font-size:9px;color:#0891b2;background:#ecfeff;border:1px solid #a5f3fc;padding:1px 5px;border-radius:99px;font-weight:600;flex-shrink:0;white-space:nowrap">💰 ค้างประกัน</span>':''}` : '<span style="color:#cbd5e1;font-size:10px;margin-left:14px">↳</span>'}
            </div>
            <div ${tenantClick} style="color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px;${c?'cursor:pointer':''}">${tenantDisp}</div>
            <div style="text-align:center">${stBadge[s]||'-'}</div>
            <div class="progress-cell" style="min-width:0">${c?`<div class="pc-dates" style="display:flex;justify-content:space-between;margin-bottom:2px"><span>${startShort}</span><span style="font-weight:600;color:${barColor}">${pct}%</span><span>${endShort}</span></div><div class="pc-bar"><div class="pc-fill" style="width:${pct}%;background:${barColor}"></div></div><div class="pc-info" style="color:${barColor};margin-top:1px">${daysLabel}</div>`:'<span style="color:#cbd5e1;font-size:10px">-</span>'}</div>
            <div style="font-weight:700;color:${cMo>0?'#059669':'#cbd5e1'};text-align:right;white-space:nowrap;font-size:13px">${cMo>0?fmtBaht(cMo,{sym:0}):'-'}</div>
          </div>`;
        };
        const rowsHtml = isVacant ? buildRow(null, 0) : rows.map((c,i) => buildRow(c,i)).join('');
        return `
        <div class="prop-row ${borderClass}" style="margin-bottom:2px">
          ${rowsHtml}
          ${expanded ? renderPropContracts(p, info) : ''}
        </div>`;
      }).join('')}`;
    }).join('')}
    </div>
  `;

  let _pqTimer;
  $('pq').addEventListener('input', e => { propFilter.q = e.target.value; clearTimeout(_pqTimer); _pqTimer = setTimeout(() => { const v = propFilter.q; const el = $('pq'); renderProperties(); const ne = $('pq'); if(ne){ne.value=v;ne.focus();ne.setSelectionRange(v.length,v.length)} }, 300); });
  $('ptf').addEventListener('change', e => { propFilter.type = e.target.value; renderProperties(); });
  $('plf').addEventListener('change', e => { propFilter.loc = e.target.value; renderProperties(); });
  $('psf').addEventListener('change', e => { propFilter.status = e.target.value; renderProperties(); });
  $('psort').addEventListener('change', e => { propSort.key=e.target.value; propSort.dir=e.target.value==='rent'||e.target.value==='contracts'?'desc':'asc'; renderProperties(); });
}

function renderPropContracts(p, info) {
  // === Property details section ===
  const imgCount = (p.images||[]).length;
  const propDetailHTML = `<div style="background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:10px 16px;display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;font-size:12px">
    <div>
      <div style="color:#64748b;font-size:10px;font-weight:600;margin-bottom:2px">ที่อยู่</div>
      <div style="color:#334155;line-height:1.4">${esc(p.address)||'<span style=\"color:#ef4444\">ไม่ระบุ</span>'}</div>
    </div>
    <div>
      <div style="color:#64748b;font-size:10px;font-weight:600;margin-bottom:2px">เลขโฉนด</div>
      <div style="color:#334155">${esc(p.titleDeed)||'-'}</div>
    </div>
    <div style="display:flex;gap:20px">
      <div>
        <div style="color:#64748b;font-size:10px;font-weight:600;margin-bottom:2px">เนื้อที่</div>
        <div style="color:#334155;font-weight:600">${p.area&&p.area!=='-'?esc(p.area):'ไม่ระบุ'}</div>
      </div>
      <div>
        <div style="color:#64748b;font-size:10px;font-weight:600;margin-bottom:2px">ประเภท</div>
        <div style="color:#334155">${esc(p.type)||'-'}</div>
      </div>
      <div>
        <div style="color:#64748b;font-size:10px;font-weight:600;margin-bottom:2px">จังหวัด</div>
        <div style="color:#334155">${esc(p.location)||'-'}</div>
      </div>
    </div>
    <div style="display:flex;gap:20px;align-items:end">
      <div>
        <div style="color:#64748b;font-size:10px;font-weight:600;margin-bottom:2px">รายได้/เดือน</div>
        <div style="font-weight:700;color:${info.revMo>0?'#059669':'#64748b'};font-size:14px">${info.revMo>0?fmtBaht(info.revMo,{sym:0})+' บาท':'-'}</div>
      </div>
      ${info.revYr>0?'<div><div style="color:#64748b;font-size:10px;font-weight:600;margin-bottom:2px">รายได้/ปี</div><div style="font-weight:700;color:#2563eb;font-size:14px">'+fmtBaht(info.revYr,{sym:0})+' บาท</div></div>':''}
      ${imgCount>0?'<div style="margin-left:auto"><span style="font-size:10px;color:#6366f1;cursor:pointer" onclick="event.stopPropagation();openPropertyDetail('+p.pid+')">รูปภาพ ('+imgCount+')</span></div>':''}
    </div>
  </div>`;

  // === Contracts section ===
  if (info.total === 0) return '<div class="prop-contracts">'+propDetailHTML+'<div class="px-6 py-4 text-sm text-gray-400">ยังไม่มีสัญญา · <a href="#" onclick="event.preventDefault();openAddContractDialog('+p.pid+')" class="text-indigo-600 hover:underline">เพิ่มสัญญา</a></div></div>';
  const allC = info.cs.sort((a,b) => {
    const sa = status(a), sb = status(b);
    const order = {active:0,expiring:0,upcoming:1,expired:2,cancelled:3,unknown:4};
    return (order[sa]??9) - (order[sb]??9);
  });
  // Group by spot (only if at least one contract has spot set)
  const hasSpot = allC.some(c => (c.spot||'').trim() && !c.cancelled);
  const spotGroups = {}; const spotOrder = [];
  if (hasSpot) {
    allC.forEach(c => {
      const key = (c.spot||'').trim() || '(ยังไม่ระบุจุด)';
      if (!spotGroups[key]) { spotGroups[key] = []; spotOrder.push(key); }
      spotGroups[key].push(c);
    });
  }
  const renderRow = (c) => {
      const s = status(c);
      const isCan = s==='cancelled';
      const isOv = info.overlapIds&&info.overlapIds.has(c.id);
      const freq = payFreq(c.rate,c.payment);
      const moAmt = monthlyRev(c);
      const isYearly = freq.type==='yearly'||freq.type==='lump';
      const rateDisplay = isCan ? '<span style="text-decoration:line-through;color:#64748b">'+(moAmt>0?fmtBaht(moAmt,{sym:0}):'0')+'</span>' : (moAmt>0?fmtBaht(moAmt,{sym:0})+(isYearly?' บ./ปี':' บ./ด.'):'');
      return `<div class="prop-c-row" onclick="event.stopPropagation();viewContract(${c.id})" oncontextmenu="event.stopPropagation();showCtxMenu(event,${c.id})" style="${isCan?'opacity:0.5;':''}${isOv?'border-left:3px solid #dc2626;background:#fef2f2;':''}">
        <div style="min-width:0;flex:1">
          <div class="flex items-center gap-2">
            <span class="font-medium ${isCan?'text-gray-400':'text-gray-900'}" style="${isCan?'text-decoration:line-through':''}">${esc(c.tenant) || '-'}</span>
            ${badge(s)}
            ${isOv?'<span style="font-size:9px;color:#dc2626;font-weight:700;background:#fee2e2;padding:0 5px;border-radius:99px">ซ้อน</span>':''}
          </div>
          <div class="text-xs text-gray-400 mt-0.5">${esc(c.no)||'-'} · ${esc(c.purpose)||'-'}${c.landlord?' · <span style="color:#64748b">ให้เช่า: '+esc(shortLandlordName(c.landlord))+'</span>':''}</div>
        </div>
        <div class="text-right flex-shrink-0 text-xs" style="min-width:150px">
          <div class="font-medium ${isCan?'text-gray-400':'text-gray-700'}">${rateDisplay||'-'}</div>
          <div class="text-gray-400">${fmtBE(c.start)} — ${fmtBE(c.end)}</div>
        </div>
        <div class="flex gap-1 flex-shrink-0">
          <button onclick="event.stopPropagation();editContract(${c.id})" class="p-1 hover:bg-yellow-50 rounded text-gray-400 hover:text-yellow-600" title="แก้ไข">&#9998;</button>
        </div>
      </div>`;
  };
  let contractsHTML;
  if (hasSpot) {
    contractsHTML = spotOrder.map(spotKey => {
      const list = spotGroups[spotKey];
      const activeList = list.filter(c => !c.cancelled);
      const spotRev = activeList.reduce((s,c) => s + (monthlyRev(c)||0), 0);
      const count = list.length;
      return `<div class="prop-spot-group" style="border-top:1px solid #e2e8f0">
        <div style="padding:6px 16px;background:#f1f5f9;display:flex;align-items:center;gap:10px;font-size:11px">
          <span style="font-weight:700;color:#334155">📍 ${esc(spotKey)}</span>
          <span style="color:#64748b">${count} สัญญา</span>
          ${spotRev>0?'<span style="margin-left:auto;font-weight:700;color:#059669">'+fmtBaht(spotRev,{sym:0})+' บ./ด.</span>':'<span style="margin-left:auto;color:#64748b">-</span>'}
        </div>
        ${list.map(renderRow).join('')}
      </div>`;
    }).join('');
  } else {
    contractsHTML = allC.map(renderRow).join('');
  }
  return `<div class="prop-contracts">
    ${propDetailHTML}
    <div style="padding:6px 16px 2px 16px;display:flex;align-items:center;justify-content:space-between">
      <span class="text-xs font-medium text-gray-500">สัญญาทั้งหมด ${info.total} รายการ${hasSpot?' · '+spotOrder.length+' จุด':''}</span>
      <div class="flex gap-1">
        <button onclick="event.stopPropagation();openAddContractDialog(${p.pid})" class="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 font-medium">+ สัญญาใหม่</button>
        <button onclick="event.stopPropagation();openPropertyDetail(${p.pid})" class="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 font-medium">ดูรายละเอียด</button>
      </div>
    </div>
    ${contractsHTML}
  </div>`;
}

function togglePropExpand(pid) {
  if (propExpanded.has(pid)) propExpanded.delete(pid);
  else propExpanded.add(pid);
  renderProperties();
}

// ========== CONTRACT VIEW: PAYMENT TIMELINE + KPI ==========
// Render-only helpers. Read DB.invoices ของ contract นี้ → KPI + filter chips + timeline rows
// State: vcTimelineFilter ('all' | 'unpaid' | 'paid') ใน 02-state.js
// Action: setVcTimelineFilter(f) ด้านล่าง — ไม่แตะ DB

// Compute payment behavior: ตรงเวลา/สาย — เทียบ paidAt กับ dueDate
function _vcPaymentStats(invoices){
  const paid=invoices.filter(i=>i.status==='paid'&&i.paidAt&&i.dueDate);
  let onTime=0, lateDays=[];
  paid.forEach(inv=>{
    const p=inv.dueDate.split('/');
    if(p.length!==3)return;
    const dueY=parseInt(p[2])-543, dueM=parseInt(p[1])-1, dueD=parseInt(p[0]);
    const dueTs=new Date(dueY,dueM,dueD).getTime();
    const paidTs=new Date(inv.paidAt).getTime();
    const diff=Math.floor((paidTs-dueTs)/864e5);
    if(diff<=0) onTime++;
    else lateDays.push(diff);
  });
  const avgLate=lateDays.length?Math.round(lateDays.reduce((a,b)=>a+b,0)/lateDays.length):0;
  return {totalPaid:paid.length, onTime, late:lateDays.length, avgLate};
}

// KPI strip: ค้างจ่าย · ตรงเวลา N/M · เฉลี่ยช้า X วัน
function buildContractKpi(c, cInvoices){
  if(c.tenant==='ว่าง'||!c.tenant) return ''; // skip vacant
  const outstanding=cInvoices
    .filter(i=>i.status!=='paid'&&i.status!=='voided')
    .reduce((s,i)=>s+(i.remainingAmount!=null?i.remainingAmount:(i.total||0)),0);
  const overdueCount=cInvoices.filter(i=>getDisplayStatus(i)==='overdue').length;
  const stats=_vcPaymentStats(cInvoices);
  const totalInvoices=cInvoices.length;

  if(totalInvoices===0) return ''; // ยังไม่มี invoice → ไม่ต้อง KPI

  const kpiCard=(label,value,sub,color)=>`<div style="flex:1;min-width:120px;padding:10px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:10px">
    <div style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.4px">${label}</div>
    <div style="font-size:18px;font-weight:700;color:${color};margin-top:2px;line-height:1.2">${value}</div>
    ${sub?`<div style="font-size:11px;color:#64748b;margin-top:1px">${sub}</div>`:''}
  </div>`;

  return `<div style="margin-top:12px;padding:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;display:flex;gap:8px;flex-wrap:wrap">
    ${kpiCard('ค้างชำระ', outstanding>0?fmtBaht(outstanding,{sym:0})+' ฿':'-', overdueCount>0?'⚠ เกินกำหนด '+overdueCount+' ใบ':(outstanding>0?'รอชำระ':'ไม่มี'), outstanding>0?'#dc2626':'#16a34a')}
    ${kpiCard('ชำระตรงเวลา', stats.totalPaid>0?(stats.onTime+'/'+stats.totalPaid):'-', stats.totalPaid>0?Math.round(stats.onTime/stats.totalPaid*100)+'%':'ยังไม่มีข้อมูล', stats.totalPaid>0&&stats.onTime/stats.totalPaid>=0.8?'#16a34a':'#d97706')}
    ${kpiCard('เฉลี่ยล่าช้า', stats.avgLate>0?stats.avgLate+' วัน':'-', stats.late>0?'จาก '+stats.late+' ใบที่จ่ายช้า':'ไม่มี', stats.avgLate>7?'#dc2626':(stats.avgLate>0?'#d97706':'#16a34a'))}
    ${kpiCard('ใบทั้งหมด', totalInvoices, stats.totalPaid+' ชำระแล้ว · '+(totalInvoices-stats.totalPaid)+' ค้าง', '#475569')}
  </div>`;
}

// Status badge for timeline rows
function _vcStatusBadge(inv){
  const ds=getDisplayStatus(inv);
  const map={
    paid:    {bg:'#dcfce7',color:'#15803d',icon:'✅',label:'ชำระแล้ว'},
    partial: {bg:'#fef3c7',color:'#92400e',icon:'🟡',label:'ชำระบางส่วน'},
    overdue: {bg:'#fee2e2',color:'#b91c1c',icon:'🔴',label:'เกินกำหนด'},
    voided:  {bg:'#f1f5f9',color:'#64748b',icon:'⊘',label:'ยกเลิก'},
    sent:    {bg:'#eef2ff',color:'#4338ca',icon:'📤',label:'รอชำระ'},
    draft:   {bg:'#f1f5f9',color:'#64748b',icon:'📝',label:'ร่าง'}
  };
  const m=map[ds]||map.draft;
  return `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:${m.bg};color:${m.color};border-radius:99px;font-size:10px;font-weight:700">${m.icon} ${m.label}</span>`;
}

// Apply filter chip
function _vcFilterInvoices(cInvoices, filter){
  if(filter==='unpaid') return cInvoices.filter(i=>i.status!=='paid'&&i.status!=='voided');
  if(filter==='paid')   return cInvoices.filter(i=>i.status==='paid');
  return cInvoices;
}

// Action: change filter + re-render same modal (reset pagination)
function setVcTimelineFilter(f){
  vcTimelineFilter=f;
  vcTimelineShown=12;
  if(window._currentViewCid) viewContract(window._currentViewCid);
}

// Action: show more rows in timeline (+12 per click)
function showMoreVcTimeline(){
  vcTimelineShown+=12;
  if(window._currentViewCid) viewContract(window._currentViewCid);
}

// Timeline: filter chips + sorted row list (newest first)
function buildContractTimeline(c, cInvoices){
  if(c.tenant==='ว่าง'||!c.tenant) return ''; // ห้องว่าง ไม่ต้อง timeline

  // Sort invoices: newest first by month desc, fallback by id desc
  const sorted=[...cInvoices].sort((a,b)=>{
    if(a.month!==b.month) return (b.month||'').localeCompare(a.month||'');
    return (b.id||0)-(a.id||0);
  });

  const filtered=_vcFilterInvoices(sorted, vcTimelineFilter);
  // Tier B pagination: default 12, "show more" +12 per click
  const visible=filtered.slice(0, vcTimelineShown);
  const remaining=filtered.length-visible.length;
  const counts={
    all: sorted.length,
    unpaid: sorted.filter(i=>i.status!=='paid'&&i.status!=='voided').length,
    paid: sorted.filter(i=>i.status==='paid').length
  };

  const chip=(id,label,n)=>{
    const active=vcTimelineFilter===id;
    return `<button onclick="setVcTimelineFilter('${id}')" style="padding:5px 11px;border-radius:99px;font-size:11px;font-weight:600;cursor:pointer;font-family:Sarabun;border:1px solid ${active?'#6366f1':'#e2e8f0'};background:${active?'#eef2ff':'#fff'};color:${active?'#4338ca':'#475569'};display:inline-flex;align-items:center;gap:5px">
      ${label}<span style="background:${active?'#c7d2fe':'#f1f5f9'};color:${active?'#4338ca':'#64748b'};padding:1px 6px;border-radius:99px;font-size:10px">${n}</span>
    </button>`;
  };

  const filterBar=`<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap">
    ${chip('all','ทั้งหมด',counts.all)}
    ${chip('unpaid','ค้างชำระ',counts.unpaid)}
    ${chip('paid','ชำระแล้ว',counts.paid)}
  </div>`;

  if(sorted.length===0){
    return `<div style="margin-top:12px;border-top:1px solid #e2e8f0;padding-top:8px">
      <div style="font-size:13px;font-weight:600;color:#475569;margin-bottom:8px">📅 ประวัติการชำระ</div>
      <div style="text-align:center;padding:24px;color:#64748b;font-size:12px;background:#f8fafc;border-radius:10px;border:1px dashed #cbd5e1">ยังไม่มีใบแจ้งหนี้สำหรับสัญญานี้</div>
    </div>`;
  }

  const thMo=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  function fmtMonth(m){
    if(!m)return '-';
    const [y,mo]=m.split('-');
    return thMo[parseInt(mo)-1]+' '+(parseInt(y)+543);
  }

  const rows=visible.map(inv=>{
    const ds=getDisplayStatus(inv);
    const isPaid=inv.status==='paid';
    const isUnpaid=!isPaid&&inv.status!=='voided';
    const daysOver=getDaysOverdue(inv);
    const slipThumb=inv.slipImage?`<img src="${inv.slipImage}" onclick="event.stopPropagation();viewSlipImage(${inv.id})" style="width:36px;height:36px;object-fit:cover;border-radius:6px;cursor:pointer;border:1px solid #e2e8f0;flex-shrink:0" title="ดูสลิป">`:'';
    const meta=inv.slipMeta?`<div style="font-size:10px;color:#64748b;margin-top:2px">ref: ${esc(inv.slipMeta.transRef)||'-'}${inv.slipMeta.senderName?' · '+esc(inv.slipMeta.senderName):''}</div>`:'';
    // paidAt = ISO timestamp → format as BE date string
    const paidStr=inv.paidAt?(()=>{const d=new Date(inv.paidAt);return d.getDate()+'/'+(d.getMonth()+1)+'/'+(d.getFullYear()+543);})():'-';
    const subline=isPaid
      ? `ชำระ ${paidStr}${inv.receiptNo?' · '+esc(inv.receiptNo):''}`
      : (daysOver>0?`เกินกำหนด ${daysOver} วัน · ครบกำหนด ${esc(inv.dueDate)||'-'}`:`ครบกำหนด ${esc(inv.dueDate)||'-'}`);

    const quickAction=isUnpaid
      ? `<button onclick="event.stopPropagation();closeModal();openReceivePaymentModal(${inv.id})" style="padding:5px 10px;background:#16a34a;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:Sarabun;flex-shrink:0" onmouseover="this.style.background='#15803d'" onmouseout="this.style.background='#16a34a'">+ บันทึกชำระ</button>`
      : `<button onclick="event.stopPropagation();closeModal();viewInvoiceDetail(${inv.id})" style="padding:5px 10px;background:#eef2ff;color:#4338ca;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:Sarabun;flex-shrink:0" onmouseover="this.style.background='#e0e7ff'" onmouseout="this.style.background='#eef2ff'">ดูรายละเอียด</button>`;

    return `<div style="display:flex;gap:10px;align-items:center;padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;margin-bottom:6px">
      ${slipThumb||'<div style="width:36px;height:36px;border-radius:6px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#64748b;flex-shrink:0;font-size:14px">📄</div>'}
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-size:13px;font-weight:600;color:#1e293b">${fmtMonth(inv.month)}</span>
          ${_vcStatusBadge(inv)}
          <span style="font-size:11px;color:#64748b">${esc(inv.invoiceNo)||'-'}</span>
        </div>
        <div style="font-size:12px;color:#475569;margin-top:2px">${subline}</div>
        ${meta}
      </div>
      <div style="font-size:14px;font-weight:700;color:${isPaid?'#15803d':(daysOver>0?'#b91c1c':'#475569')};text-align:right;flex-shrink:0">
        ${fmtBaht(inv.total||0,{sym:0})} ฿
      </div>
      ${quickAction}
    </div>`;
  }).join('');

  const showMoreBtn=remaining>0?`<div style="text-align:center;margin-top:6px">
    <button onclick="showMoreVcTimeline()" style="padding:8px 18px;background:#fff;color:#4338ca;border:1px solid #c7d2fe;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun" onmouseover="this.style.background='#eef2ff'" onmouseout="this.style.background='#fff'">▾ แสดงเพิ่ม ${Math.min(12,remaining)} ใบ <span style="color:#64748b;font-weight:400">(เหลือ ${remaining})</span></button>
  </div>`:'';

  return `<div style="margin-top:12px;border-top:1px solid #e2e8f0;padding-top:10px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px;flex-wrap:wrap">
      <div style="font-size:13px;font-weight:600;color:#475569">📅 ประวัติใบแจ้งหนี้ &amp; การชำระ</div>
      ${filtered.length>0?`<div style="font-size:11px;color:#64748b">แสดง ${visible.length}/${filtered.length}</div>`:''}
    </div>
    ${filterBar}
    ${filtered.length>0?rows:'<div style="text-align:center;padding:20px;color:#64748b;font-size:12px;background:#f8fafc;border-radius:10px">ไม่มีรายการในตัวกรองนี้</div>'}
    ${showMoreBtn}
  </div>`;
}

// ─── Workflow progress strip for viewContract ────────────────────────────
function _vcWorkflowStrip(c, st){
  const depositAmt=c.deposit?parseFloat(String(c.deposit).replace(/[^\d.]/g,''))||0:0;
  const hasDeposit=depositAmt>0;
  const _depInv=(DB.invoices||[]).find(i=>i.cid===c.id&&i.category==='deposit');
  const depositRecvd=_depInv?_depInv.status==='paid':!!c.depositReceivedAt;
  const depositRecvdDate=_depInv?.payments?.[0]?.date||c.depositReceivedAt||'';
  const hasNotice=!!c.noticeDate;
  const inspDone=!!(DB.inspections||[]).find(d=>d.cid===c.id);
  const depReturnDone=!!(DB.deposits||[]).find(d=>d.cid===c.id);
  const cid=c.id;

  // Closed + all steps done
  if(c.closed&&inspDone&&depReturnDone){
    return `<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#065f46">
      <b>✓ สิ้นสุดสมบูรณ์</b> — ตรวจรับคืน ✓ · คืนเงินประกัน ✓
    </div>`;
  }

  // Post-contract: expired / cancelled / closed-but-incomplete
  if(st==='expired'||st==='cancelled'||c.closed){
    return `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:#92400e;margin-bottom:8px">📋 ขั้นตอนคืนทรัพย์</div>
      <div style="display:flex;gap:8px;align-items:stretch">
        <button onclick="openInspectionForm(${cid})" style="flex:1;padding:8px 10px;background:${inspDone?'#ecfdf5':'#fff'};border:1.5px solid ${inspDone?'#059669':'#fbbf24'};border-radius:8px;cursor:pointer;text-align:left;font-family:Sarabun">
          <div style="font-size:11px;font-weight:700;color:${inspDone?'#059669':'#92400e'}">${inspDone?'✓ ตรวจแล้ว':'1. ตรวจรับคืนทรัพย์'}</div>
          <div style="font-size:10px;color:#64748b;margin-top:2px">${inspDone?'กดดูรายงาน':'กดเพื่อเริ่มตรวจ'}</div>
        </button>
        <div style="display:flex;align-items:center;color:#64748b;font-size:18px;font-weight:300">›</div>
        ${hasDeposit
          ?`<button onclick="openDepositReturn(${cid})" style="flex:1;padding:8px 10px;background:${depReturnDone?'#ecfdf5':'#fff'};border:1.5px solid ${depReturnDone?'#059669':'#fbbf24'};border-radius:8px;cursor:pointer;text-align:left;font-family:Sarabun">
              <div style="font-size:11px;font-weight:700;color:${depReturnDone?'#059669':'#92400e'}">${depReturnDone?'✓ คืนแล้ว':'2. คืนเงินประกัน'}</div>
              <div style="font-size:10px;color:#64748b;margin-top:2px">${depReturnDone?'กดดูใบคืน':'กดเพื่อดำเนินการ'}</div>
            </button>`
          :`<div style="flex:1;padding:8px 10px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#64748b">ไม่มีเงินประกัน</div>`}
      </div>
    </div>`;
  }

  // Active with notice recorded
  if(hasNotice){
    const moveOutD=c.plannedMoveOut?parseBE(c.plannedMoveOut):null;
    const daysLeft=moveOutD?Math.max(0,Math.round((moveOutD-new Date())/864e5)):null;
    return `<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:12px 14px;margin-bottom:12px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div>
          <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:3px">📢 แจ้งย้ายออกแล้ว</div>
          <div style="font-size:11px;color:#78350f">
            วันที่แจ้ง <b>${esc(c.noticeDate)}</b>
            ${c.plannedMoveOut?` · ออกจริง <b>${esc(c.plannedMoveOut)}</b>`:''}
            ${daysLeft!==null?` <span style="color:#dc2626;font-weight:700">(เหลือ ${daysLeft} วัน)</span>`:''}
          </div>
          ${c.noticeNote?`<div style="font-size:10px;color:#92400e;margin-top:3px">${esc(c.noticeNote)}</div>`:''}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button onclick="openNoticeDialog(${cid})" style="padding:7px 11px;background:#fff;color:#92400e;border:1px solid #fcd34d;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:Sarabun">แก้ไข</button>
          <button onclick="openMoveOutSummary(${cid})" style="padding:7px 11px;background:#0891b2;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:Sarabun">📋 สรุปย้ายออก →</button>
        </div>
      </div>
    </div>`;
  }

  // Active — show deposit status + notice action
  const depHTML=hasDeposit
    ?(depositRecvd
      ?`<span style="color:#059669;font-weight:700">✓ รับเงินประกันแล้ว</span> · ${fmtBaht(depositAmt,{sym:0})} บาท · ${esc(depositRecvdDate)}`
      :`<span style="color:#dc2626;font-weight:700">⚠️ ยังไม่รับเงินประกัน</span> · ${fmtBaht(depositAmt,{sym:0})} บาท`)
    :`<span style="color:#64748b">ไม่มีเงินประกัน</span>`;

  return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
    <div style="font-size:12px;color:#475569;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
      ${depHTML}
      ${hasDeposit&&!depositRecvd&&_depInv?`<button onclick="openReceivePaymentModal(${_depInv.id})" style="padding:5px 10px;background:#dc2626;color:#fff;border:none;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;font-family:Sarabun">💳 รับเงินประกัน</button>`:''}
    </div>
    <button onclick="openNoticeDialog(${cid})" style="padding:7px 13px;background:#d97706;color:#fff;border:none;border-radius:7px;font-size:11px;font-weight:700;cursor:pointer;font-family:Sarabun;flex-shrink:0">📢 แจ้งย้ายออก</button>
  </div>`;
}

function viewContract(id) {
  const c = DB.contracts.find(x => x.id === id);
  if (!c) return;
  window._currentViewCid=id;
  const p = DB.properties.find(x => x.pid === c.pid);
  $('mtitle').textContent = 'สัญญา ' + (c.no || '#'+c.id); // textContent — auto-escaped

  // Build landlord lookup: name → addr
  const llAddrMap={};
  DB.contracts.forEach(x=>{if(x.landlord&&x.landlordAddr)llAddrMap[x.landlord]=x.landlordAddr;});
  const uniqueLandlords=[...new Set(DB.contracts.map(x=>x.landlord).filter(Boolean))];

  // Build bank combos lookup
  const bankMap=new Map();
  DB.contracts.forEach(x=>{
    if(x.bank&&x.acctNo){
      const bk=x.bank+'|'+x.acctNo;
      if(!bankMap.has(bk))bankMap.set(bk,{bank:x.bank,acctNo:x.acctNo,accountName:x.accountName||''});
    }
  });
  const bankCombos=[...bankMap.values()];
  // Invoice header for bank fallback
  const vcHdr=(DB.invoiceHeaders||[]).find(x=>x.id===+c.invHeaderId)||(DB.invoiceHeaders||[])[0]||{};

  const cInvoices=(DB.invoices||[]).filter(iv=>iv.cid===c.id);
  const isCancelled=c.cancelled||false;

  const cancelBanner=isCancelled?`<div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:8px;padding:12px 16px;margin-bottom:12px;display:flex;align-items:center;gap:10px">
    <svg style="width:20px;height:20px;color:#64748b;flex-shrink:0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
    <div><div style="font-weight:700;color:#334155;font-size:14px">สัญญานี้ถูกยกเลิก</div>
    <div style="font-size:12px;color:#64748b">วันที่ยกเลิก: ${esc(c.cancelledDate)||'-'}${c.cancelledReason?' · เหตุผล: '+esc(c.cancelledReason):''}</div></div>
  </div>`:'';

  // Buttons — grouped into action bar
  const _bDepAmt=c.deposit?parseFloat(String(c.deposit).replace(/[^\d.]/g,''))||0:0;
  const _bDepInv=(DB.invoices||[]).find(i=>i.cid===c.id&&i.category==='deposit')||null;
  const _depBtnHtml=(_bDepAmt>0&&_bDepInv)?('<div style="display:flex;gap:1px;background:#e2e8f0;border-radius:8px;overflow:hidden;flex-shrink:0"><button onclick="'+(_bDepInv.status==='paid'?'printReceipt('+_bDepInv.id+')':'openReceivePaymentModal('+_bDepInv.id+')')+'" style="padding:8px 12px;background:'+(_bDepInv.status==='paid'?'#f0fdf4':'#fff')+';font-size:12px;color:#0369a1;border:none;cursor:pointer;font-weight:600" title="'+(_bDepInv.status==='paid'?'พิมพ์ใบรับเงินประกัน':'รับเงินประกัน')+'">'+(_bDepInv.status==='paid'?'📄':'💳')+' ใบรับเงินประกัน</button></div>'):'';
  const btnRow=`<div style="margin-top:16px;padding:12px 0;border-top:1px solid #e2e8f0;display:flex;gap:6px;align-items:center;flex-wrap:wrap">
    <div style="display:flex;gap:1px;background:#e2e8f0;border-radius:8px;overflow:hidden;flex-shrink:0">
      <button onclick="previewContract(${c.id})" style="padding:8px 12px;background:#fff;font-size:12px;color:#334155;border:none;cursor:pointer;display:flex;align-items:center;gap:4px" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#fff'"><svg style="width:14px;height:14px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>พิมพ์สัญญา</button>
    </div>
    <div style="display:flex;gap:1px;background:#e2e8f0;border-radius:8px;overflow:hidden;flex-shrink:0">
      <button onclick="closeModal();renewContract(${c.id})" style="padding:8px 12px;background:#fff;font-size:12px;color:#d97706;border:none;cursor:pointer" onmouseover="this.style.background='#fffbeb'" onmouseout="this.style.background='#fff'">ต่อสัญญา</button>
      <button onclick="closeModal();copyContract(${c.id})" style="padding:8px 12px;background:#fff;font-size:12px;color:#2563eb;border:none;cursor:pointer" onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background='#fff'">คัดลอก</button>
      <button onclick="openClauseOverrideEditor(${c.id})" style="padding:8px 12px;background:#fff;font-size:12px;color:#dc2626;border:none;cursor:pointer" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='#fff'" title="แก้ข้อสัญญาเฉพาะสัญญานี้">✎ แก้ข้อ</button>
    </div>
    ${_depBtnHtml}
    <div style="margin-left:auto">
      ${isCancelled
        ?`<button onclick="restoreContract(${c.id})" style="padding:8px 14px;background:#059669;color:#fff;font-size:12px;font-weight:600;border:none;border-radius:8px;cursor:pointer" onmouseover="this.style.background='#047857'" onmouseout="this.style.background='#059669'">คืนสถานะ</button>`
        :`<button onclick="openCancelDialog(${c.id})" style="padding:8px 14px;background:#f1f5f9;color:#64748b;font-size:12px;border:none;border-radius:8px;cursor:pointer" onmouseover="this.style.background='#fee2e2';this.style.color='#dc2626'" onmouseout="this.style.background='#f1f5f9';this.style.color='#64748b'">ยกเลิก</button>`}
    </div>
  </div>`;

  // Prominent header with tenant/landlord and status
  const st=status(c);
  const stColors={active:'#059669',expiring:'#d97706',expired:'#dc2626',upcoming:'#2563eb',cancelled:'#64748b',closed:'#475569'};
  const stBg={active:'#ecfdf5',expiring:'#fffbeb',expired:'#fef2f2',upcoming:'#eff6ff',cancelled:'#f1f5f9',closed:'#f8fafc'};
  const stBorder={active:'#a7f3d0',expiring:'#fde68a',expired:'#fecaca',upcoming:'#bfdbfe',cancelled:'#cbd5e1',closed:'#e2e8f0'};
  const stLabel={active:'มีผล',expiring:'ใกล้หมด',expired:'หมดอายุ',upcoming:'ยังไม่เริ่ม',cancelled:'ยกเลิก',closed:'สิ้นสุดแล้ว ✓'};
  const moRev=monthlyRev(c);
  const freq=payFreq(c.rate,c.payment);

  // === CONTRACT TIMELINE ===
  const cStart=parseBE(c.start),cEnd=parseBE(c.end);
  const now=new Date();
  const totalDays=cStart&&cEnd?Math.max(1,Math.round((cEnd-cStart)/864e5)):0;
  const elapsed=cStart?Math.max(0,Math.round((now-cStart)/864e5)):0;
  const remaining=cEnd?Math.max(0,Math.round((cEnd-now)/864e5)):0;
  const timelinePct=totalDays>0?Math.min(100,Math.round(elapsed/totalDays*100)):0;

  // Status icons
  const stIcons={active:'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>',expiring:'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>',expired:'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>',upcoming:'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>',cancelled:'<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>'};


  const headerHTML=`<div style="background:${stBg[st]};border:1px solid ${stBorder[st]};border-radius:12px;overflow:hidden;margin-bottom:16px">
    <!-- Status bar top accent -->
    <div style="height:4px;background:${stColors[st]}"></div>
    <div style="padding:16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="width:28px;height:28px;border-radius:50%;background:${stColors[st]};display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <svg style="width:16px;height:16px;color:#fff" fill="none" stroke="currentColor" viewBox="0 0 24 24">${stIcons[st]||stIcons.active}</svg>
            </div>
            <span style="background:${stColors[st]};color:#fff;font-size:11px;font-weight:700;padding:2px 10px;border-radius:99px">${stLabel[st]||st}</span>
            <span style="font-size:13px;color:#6b7280">${esc(c.no)||'#'+c.id}</span>
            ${st==='expiring'?`<span style="background:#fef3c7;color:#92400e;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;animation:pulse 2s infinite">เหลือ ${remaining} วัน</span>`:''}
            ${st==='active'&&remaining>0&&remaining<=180?`<span style="font-size:11px;color:#6b7280">เหลือ ${remaining} วัน</span>`:''}
          </div>
          <div style="display:flex;gap:20px;flex-wrap:wrap">
            <div><div style="font-size:11px;color:#64748b;margin-bottom:2px">ผู้เช่า</div>
              <div style="font-size:16px;font-weight:700;color:#111827">${esc(c.tenant)||'-'}</div>
              ${c.phone?`<div style="font-size:12px;color:#6b7280">${esc(c.phone)}</div>`:''}
            </div>
            <div><div style="font-size:11px;color:#64748b;margin-bottom:2px">ผู้ให้เช่า</div>
              <div style="font-size:16px;font-weight:700;color:#111827">${esc(shortLandlordName(c.landlord))||'-'}</div>
            </div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:16px;flex-shrink:0">
          <div style="text-align:right">
            <div style="font-size:11px;color:#64748b;margin-bottom:2px">ค่าเช่า/เดือน</div>
            <div style="font-size:22px;font-weight:800;color:${stColors[st]};line-height:1.2">${moRev?fmtBaht(moRev,{sym:0})+' <span style="font-size:13px;font-weight:600">บ.</span>':'-'}</div>
            <div style="font-size:11px;color:#64748b">${freq.type==='monthly'?'รายเดือน':freq.type==='quarterly'?'รายไตรมาส':freq.type==='semi'?'ราย 6 เดือน':freq.type==='yearly'?'รายปี':'เหมาจ่าย'}</div>
          </div>
        </div>
      </div>
      <!-- Contract duration timeline bar -->
      ${totalDays>0?`<div style="margin-top:14px;padding-top:12px;border-top:1px solid ${stBorder[st]}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:11px;color:#6b7280">${esc(c.start)||''}</span>
          <span style="font-size:11px;font-weight:600;color:${stColors[st]}">${timelinePct}% ผ่านไปแล้ว</span>
          <span style="font-size:11px;color:#6b7280">${esc(c.end)||''}</span>
        </div>
        <div style="position:relative;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">
          <div style="position:absolute;left:0;top:0;height:100%;width:${timelinePct}%;background:linear-gradient(90deg,${stColors[st]}88,${stColors[st]});border-radius:4px;transition:width .8s ease"></div>
          <div style="position:absolute;left:${timelinePct}%;top:-2px;width:3px;height:12px;background:${stColors[st]};border-radius:1px;transform:translateX(-50%);box-shadow:0 0 4px ${stColors[st]}88"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px">
          <span style="font-size:10px;color:#64748b">${elapsed} วันผ่านไป</span>
          <span style="font-size:10px;color:#64748b">${remaining>0?remaining+' วันเหลือ':'หมดอายุแล้ว'}</span>
        </div>
      </div>`:''}
    </div>
  </div>`;

  // === COLLAPSIBLE DETAIL SECTION ===
  const dRow=(label,val)=>val&&val!=='—'?`<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid #f8fafc">
    <span style="width:110px;flex-shrink:0;font-size:11px;color:#64748b;padding-top:1px">${label}</span>
    <span style="font-size:12px;color:#334155;line-height:1.5">${val}</span>
  </div>`:''

  // Fix NaN: strip non-numeric chars before parsing deposit
  const depositAmt=c.deposit?parseFloat(String(c.deposit).replace(/[^\d.]/g,'')):0;
  const depositDisplay=depositAmt&&!isNaN(depositAmt)?fmtBaht(depositAmt,{sym:0})+' บาท':'';
  // Bank details: contract first, header fallback
  const vcBank=c.bank||vcHdr.bankName||'';
  const vcAcctNo=c.acctNo||vcHdr.bankAccount||'';
  const vcAcctName=c.accountName||vcHdr.bankAccountName||'';
  // Section label helper
  const dSec=(label)=>`<div style="grid-column:1/-1;margin-top:10px;padding-bottom:4px;border-bottom:2px solid #e2e8f0;font-size:10px;font-weight:700;color:#6366f1;letter-spacing:.8px;text-transform:uppercase">${label}</div>`;

  // === CONTRACT DETAILS (open by default) ===
  const detailHTML=`<div style="margin-top:12px;border-top:1px solid #e2e8f0;padding-top:8px">
    <button onclick="const b=document.getElementById('vcDetailBody');const ch=document.getElementById('vcDetailChev');if(b.style.display==='none'){b.style.display='';ch.style.transform='rotate(90deg)'}else{b.style.display='none';ch.style.transform=''}" style="display:flex;align-items:center;gap:8px;width:100%;padding:8px 0;background:none;border:none;cursor:pointer;text-align:left">
      <svg id="vcDetailChev" style="width:14px;height:14px;color:#64748b;transition:transform .15s;flex-shrink:0;transform:rotate(90deg)" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
      <svg style="width:15px;height:15px;color:#6366f1;flex-shrink:0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
      <span style="font-size:13px;font-weight:600;color:#475569">รายละเอียดสัญญา</span>
      <span onclick="event.stopPropagation();openEditContract(${c.id})" style="margin-left:auto;font-size:11px;color:#6366f1;font-weight:600;cursor:pointer;padding:3px 10px;border-radius:6px;background:#eef2ff;display:flex;align-items:center;gap:4px" onmouseover="this.style.background='#e0e7ff'" onmouseout="this.style.background='#eef2ff'"><svg style="width:11px;height:11px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>แก้ไข</span>
    </button>
    <div id="vcDetailBody" style="padding:4px 0 4px 2px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px">
        ${dSec('เงื่อนไขการเช่า')}
        ${dRow('วันเริ่มต้น',esc(c.start)||'')}
        ${dRow('ค่าเช่า',esc(c.rate)||'')}
        ${dRow('วันสิ้นสุด',esc(c.end)||'')}
        ${depositDisplay?dRow('เงินประกัน',depositDisplay):''}
        ${dRow('ระยะเวลา',esc(c.dur)||'')}
        ${dRow('การชำระ',esc(c.payment)||'')}
        ${c.rateAdj?dRow('ปรับค่าเช่า',esc(c.rateAdj)):''}

        ${dSec('ทรัพย์สิน')}
        ${dRow('ทรัพย์สิน',p?esc(p.name)+(p.location?' · '+esc(p.location):''):'')}
        ${dRow('วัตถุประสงค์',esc(c.purpose)||'')}
        ${dRow('พื้นที่',c.area?esc(c.area)+' ตร.ม.':'')}
        ${p&&p.titleDeed?dRow('เอกสารสิทธิ์',esc(p.titleDeed)):''}

        ${dSec('ผู้เกี่ยวข้อง')}
        ${dRow('ผู้เช่า',esc(c.tenant)||'')}
        ${dRow('ผู้ให้เช่า',esc(shortLandlordName(c.landlord))||'')}
        ${dRow('เบอร์โทร',esc(c.phone)||'')}
        ${dRow('ที่อยู่ผู้ให้เช่า',esc(c.landlordAddr)||'')}
        ${c.taxId?dRow('เลขผู้เสียภาษี',esc(c.taxId)):''}
        ${dRow('ที่อยู่ผู้เช่า',esc(c.tenantAddr)||'')}

        ${vcBank?dSec('บัญชีรับเงิน'):''}
        ${vcBank?dRow('ธนาคาร',esc(vcBank)):''}
        ${vcAcctNo?dRow('เลขบัญชี',esc(vcAcctNo)):''}
        ${vcAcctName?dRow('ชื่อบัญชี',esc(vcAcctName)):''}
        ${c.madeAt?dSec('อื่นๆ'):''}
        ${c.madeAt?dRow('ทำที่',esc(c.madeAt)):''}
      </div>
    </div>
  </div>`;

  // === KPI STRIP + PAYMENT TIMELINE === (replaces old slip gallery — slip thumbs inline ใน timeline แล้ว)
  const kpiHTML=buildContractKpi(c, cInvoices);
  const timelineHTML=buildContractTimeline(c, cInvoices);

  const workflowStrip=_vcWorkflowStrip(c,st);

  // === AUDIT HISTORY === (collapsible "ประวัติการแก้ไข")
  const auditHTML=(()=>{
    const audit=c.audit||[];
    if(!audit.length)return '';
    const rows=audit.slice(0,20).map(a=>`<div style="display:flex;gap:10px;padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px">
      <span style="color:#64748b;flex-shrink:0;font-variant-numeric:tabular-nums">${esc(a.beDateStr)}</span>
      <span style="flex:1;color:#334155">${esc(a.detail)}</span>
      <span style="color:#64748b;font-size:11px;flex-shrink:0">${esc(a.user||'')}</span>
    </div>`).join('');
    return `<details style="margin-top:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:0;overflow:hidden">
      <summary style="padding:10px 14px;cursor:pointer;font-size:13px;font-weight:600;color:#475569;list-style:none;display:flex;justify-content:space-between;align-items:center">
        <span>📜 ประวัติการแก้ไข (${audit.length})</span>
        <span style="font-size:11px;color:#64748b">คลิกเพื่อดู</span>
      </summary>
      <div style="background:#fff;max-height:300px;overflow-y:auto">${rows}</div>
    </details>`;
  })();

  // Layout: header → actions → workflow strip → KPI → timeline → details (collapsed) → audit
  $('mbody').innerHTML = `<div id="vcForm">${cancelBanner}${workflowStrip}${headerHTML}${btnRow}${kpiHTML}${timelineHTML}${detailHTML}${auditHTML}</div>`;

  // No form submit handler needed — read-only view

  $('modal').classList.remove('hidden');
  setTimeout(()=>enhanceDatalistInputs($('mbody')),50);
}

function openEditContract(id){
  const c=DB.contracts.find(x=>x.id===id);
  if(!c)return;
  $('mtitle').textContent='แก้ไขสัญญา '+(c.no||'#'+c.id);
  const formHTML=contractFormHTML('edit',c,c.pid);
  $('mbody').innerHTML=`<div>${formHTML.replace('</form>',`
    <div style="margin-top:12px;padding-top:12px;border-top:2px solid #e2e8f0;display:flex;gap:8px;justify-content:center">
      <button type="submit" style="padding:10px 32px;background:#059669;color:#fff;font-size:14px;font-weight:700;border:none;border-radius:8px;cursor:pointer" onmouseover="this.style.background='#047857'" onmouseout="this.style.background='#059669'">บันทึกการเปลี่ยนแปลง</button>
      <button type="button" onclick="viewContract(${c.id})" style="padding:10px 20px;background:#f1f5f9;color:#64748b;font-size:14px;border:none;border-radius:8px;cursor:pointer" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">ยกเลิก</button>
    </div>
  </form>`)}</div>`;
  const form=$('contractForm');
  if(form){
    form.dataset.editId=c.id;
    form.addEventListener('submit',e=>{
      e.preventDefault();
      resolveFormDropdowns(new FormData(e.target));
      if(!validateContractForm(e.target))return;
      const fd=new FormData(e.target);
      resolveFormDropdowns(fd);
      confirmOverlapAndSave(c.pid,fd.get('start'),fd.get('end'),c.id,()=>{
        c.no=fd.get('no')||c.no;
        c.date=fd.get('date')||c.date;
        c.tenant=fd.get('tenant')||c.tenant;
        c.phone=fd.get('phone')||'';
        c.purpose=fd.get('purpose')||'';
        c.taxId=fd.get('taxId')||'';
        c.tenantAddr=assembleAddrFromPrefix(fd,'ta');
        c.madeAt=fd.get('madeAt')||'';
        c.rate=buildRateStr(fd);
        c.start=fd.get('start')||c.start;
        c.end=fd.get('end')||c.end;
        c.dur=fd.get('dur')||'';
        c.deposit=(fd.get('deposit')||'').replace(/[^\d.]/g,'');
        c.payment=fd.get('payment')||'';
        c.bank=fd.get('bank')||'';
        c.acctNo=fd.get('acctNo')||'';
        c.accountName=fd.get('accountName')||'';
        c.area=fd.get('area')||'';
        c.spot=fd.get('spot')||'';
        c.landlord=fd.get('landlord')||'';
        c.landlordAddr=assembleAddrFromPrefix(fd,'la');
        c.rateAdj=fd.get('rateAdj')||'';
        c.dueDay=parseInt(fd.get('dueDay'))||5;
        c.invHeaderId=fd.get('invHeaderId')||null;
        c.tenantLogo=fd.get('tenantLogo')||null;
        addActivityLog('edit_contract','แก้ไขสัญญา '+(c.no||'#'+c.id)+' — '+c.tenant);
        save();toast('บันทึกการเปลี่ยนแปลงแล้ว');
        viewContract(c.id);
      });
    });
  }
  setTimeout(cfCalcEndFromDur,50);
  setTimeout(()=>enhanceDatalistInputs($('mbody')),50);
}

function toggleFieldEdit(row){
  // Close any other open edit fields first
  document.querySelectorAll('.vc-row .vc-edit:not(.hidden)').forEach(el=>{
    if(el.closest('.vc-row')!==row){
      el.classList.add('hidden');
      el.closest('.vc-row').querySelector('.vc-display').classList.remove('hidden');
    }
  });
  const disp=row.querySelector('.vc-display');
  const edit=row.querySelector('.vc-edit');
  disp.classList.add('hidden');
  edit.classList.remove('hidden');
  const inp=edit.querySelector('select,input,textarea');
  if(inp){inp.focus();if(inp.tagName==='INPUT')inp.select();}
}

function cancelFieldEdit(row){
  row.querySelector('.vc-display').classList.remove('hidden');
  row.querySelector('.vc-edit').classList.add('hidden');
}

function saveFieldEdit(row,cid){
  const c=DB.contracts.find(x=>x.id===cid);if(!c)return;
  const key=row.dataset.key;
  const dtype=row.dataset.type;
  const _vcAuditOldVal=c[key]; // capture before-value for audit trail
  if(dtype==='dropdown_bank'){
    const sel=row.querySelector('.vc-edit select');
    const bk=sel?sel.value:'';
    if(bk){
      // Find bank combo from all contracts
      const bankMap=new Map();
      DB.contracts.forEach(x=>{if(x.bank&&x.acctNo){const k=x.bank+'|'+x.acctNo;if(!bankMap.has(k))bankMap.set(k,{bank:x.bank,acctNo:x.acctNo,accountName:x.accountName||''});}});
      const found=bankMap.get(bk);
      if(found){c.bank=found.bank;c.acctNo=found.acctNo;c.accountName=found.accountName;}
    }
  } else if(dtype==='dropdown_landlord'){
    const sel=row.querySelector('.vc-edit select');
    const newVal=sel?sel.value:'';
    c[key]=newVal;
    // Auto-fill landlordAddr from known data
    if(newVal){
      const llAddrMap={};
      DB.contracts.forEach(x=>{if(x.landlord&&x.landlordAddr)llAddrMap[x.landlord]=x.landlordAddr;});
      if(llAddrMap[newVal])c.landlordAddr=llAddrMap[newVal];
    }
  } else if(dtype==='addr'){
    // Assemble address from sub-fields
    const prefix='vc_'+key;
    const g=n=>{const el=row.querySelector('[name='+prefix+n+']');return el?el.value.trim():'';};
    const parts=[];
    const al=g('_line'),sd=g('_sd'),dt=g('_dt'),pv=g('_pv'),zp=g('_zip');
    const isBKK=/กรุงเทพ/.test(pv);
    if(al)parts.push(al);
    if(sd)parts.push(isBKK?'แขวง'+sd:'ต.'+sd);
    if(dt)parts.push(isBKK?'เขต'+dt:'อ.'+dt);
    if(pv)parts.push('จ.'+pv);
    if(zp)parts.push(zp);
    c[key]=parts.join(' ');
  } else {
    const inp=row.querySelector('.vc-edit input, .vc-edit textarea');
    const newVal=inp?inp.value:'';
    c[key]=newVal;
  }
  // Audit trail — บันทึกเฉพาะตอนค่าจริงๆ เปลี่ยน
  if(c[key]!==_vcAuditOldVal){
    const _vcAuditFieldLabel=row.querySelector('.text-gray-500')?.textContent||key;
    addContractAudit(cid,'edit_field',_vcAuditFieldLabel+': "'+(_vcAuditOldVal||'-')+'" → "'+(c[key]||'-')+'"',{field:key,from:_vcAuditOldVal,to:c[key]});
  }
  save();
  toast('บันทึก "'+row.querySelector('.text-gray-500').textContent+'" แล้ว');
  viewContract(cid);
}

function vcLandlordChange(sel,cid){
  // Preview: when landlord dropdown changes, show the address that will be auto-filled
  const val=sel.value;
  if(!val)return;
  const llAddrMap={};
  DB.contracts.forEach(x=>{if(x.landlord&&x.landlordAddr)llAddrMap[x.landlord]=x.landlordAddr;});
  const addr=llAddrMap[val]||'';
  if(addr){
    let hint=sel.parentElement.querySelector('.vc-ll-hint');
    if(!hint){hint=document.createElement('div');hint.className='vc-ll-hint';hint.style.cssText='font-size:11px;color:#6366f1;margin-top:2px';sel.parentElement.insertBefore(hint,sel.nextSibling);}
    hint.textContent='ที่อยู่: '+addr.substring(0,60)+(addr.length>60?'...':'');
  }
}

// ========== EDIT PROPERTY DIALOG ==========
// แก้ไขข้อมูลทรัพย์สิน (เปิดจากปุ่ม ✏️ แก้ไข ใน openPropertyDetail)
const PROP_TYPES = [
  {v:'shophouse', l:'ห้องแถว / อาคารพาณิชย์'},
  {v:'land_with_house', l:'ที่ดินพร้อมสิ่งปลูกสร้าง / บ้าน'},
  {v:'vacant_land', l:'ที่ดินเปล่า'},
  {v:'rooftop_tower', l:'ดาดฟ้า / เสาส่งสัญญาณ'},
  {v:'apartment', l:'อพาร์ตเมนต์ / ห้องเช่า'},
  {v:'other', l:'อื่นๆ'}
];

function openEditPropertyDialog(pid){
  const p = DB.properties.find(x => x.pid === +pid);
  if(!p){ toast('ไม่พบทรัพย์สิน','error'); return; }
  const isMulti = !!p.multiTenant;
  const safeV = v => (v==null?'':String(v).replace(/"/g,'&quot;'));
  $('mtitle').textContent = '✏️ แก้ไข ' + p.name;
  $('mbody').innerHTML = `
    <form id="propEditForm" class="space-y-4">
      <div>
        <label style="font-size:12px;color:#64748b;font-weight:600">ชื่อทรัพย์สิน *</label>
        <input type="text" name="name" value="${safeV(p.name)}" required class="w-full px-3 py-2 border rounded-lg text-sm">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label style="font-size:12px;color:#64748b;font-weight:600">ประเภท</label>
          <select name="type" class="w-full px-3 py-2 border rounded-lg text-sm">
            ${PROP_TYPES.map(t=>`<option value="${t.v}" ${p.type===t.v?'selected':''}>${t.l}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:12px;color:#64748b;font-weight:600">สถานะ</label>
          <select name="status" class="w-full px-3 py-2 border rounded-lg text-sm">
            <option value="occupied" ${p.status==='occupied'?'selected':''}>มีผู้เช่า</option>
            <option value="vacant" ${p.status==='vacant'?'selected':''}>ว่าง</option>
            <option value="active" ${(!p.status||p.status==='active')?'selected':''}>active (ค่าเริ่มต้น)</option>
          </select>
        </div>
      </div>
      <div>
        <label style="font-size:12px;color:#64748b;font-weight:600">สถานที่ (location สั้นๆ เช่น "ดาดฟ้า ราชเทวี")</label>
        <input type="text" name="location" value="${safeV(p.location)}" class="w-full px-3 py-2 border rounded-lg text-sm">
      </div>
      <div>
        <label style="font-size:12px;color:#64748b;font-weight:600">ที่อยู่ (address ละเอียด)</label>
        <textarea name="address" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm">${safeV(p.address)}</textarea>
        <div style="font-size:11px;color:#64748b;margin-top:2px">ถ้าเป็นที่ดินเปล่า ปล่อยว่างได้ ระบบจะใช้ "เลขโฉนด" เป็นที่อยู่อัตโนมัติ</div>
      </div>
      <div>
        <label style="font-size:12px;color:#64748b;font-weight:600">เลขโฉนด / titleDeed</label>
        <input type="text" name="titleDeed" value="${safeV(p.titleDeed)}" class="w-full px-3 py-2 border rounded-lg text-sm">
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label style="font-size:12px;color:#64748b;font-weight:600">พื้นที่</label>
          <input type="text" name="area" value="${safeV(p.area)}" class="w-full px-3 py-2 border rounded-lg text-sm">
        </div>
        <div>
          <label style="font-size:12px;color:#64748b;font-weight:600">เจ้าของ (owner)</label>
          <input type="text" name="owner" value="${safeV(p.owner)}" class="w-full px-3 py-2 border rounded-lg text-sm">
        </div>
      </div>
      <div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:10px;padding:12px 14px">
        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">
          <input type="checkbox" name="multiTenant" ${isMulti?'checked':''} style="margin-top:3px;width:16px;height:16px;accent-color:#10b981">
          <div>
            <div style="font-size:13px;font-weight:700;color:#065f46">ทรัพย์สินนี้แบ่งให้หลายผู้เช่าได้พร้อมกัน</div>
            <div style="font-size:11px;color:#047857;margin-top:3px">เช่น ดาดฟ้าใส่เสาสัญญาณหลายเจ้า, ที่ดินใหญ่แบ่งล็อต — ติ๊กแล้วระบบจะไม่เตือน "สัญญาซ้อน"</div>
          </div>
        </label>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;padding-top:8px;border-top:1px solid #e5e7eb">
        <button type="button" onclick="closeModal()" class="px-4 py-2 border rounded-lg text-sm">ยกเลิก</button>
        <button type="submit" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">บันทึก</button>
      </div>
    </form>`;
  document.getElementById('propEditForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    p.name = (fd.get('name')||'').toString().trim() || p.name;
    p.type = fd.get('type') || p.type;
    p.status = fd.get('status') || p.status;
    p.location = (fd.get('location')||'').toString().trim();
    p.address = (fd.get('address')||'').toString().trim();
    p.titleDeed = (fd.get('titleDeed')||'').toString().trim();
    p.area = (fd.get('area')||'').toString().trim();
    p.owner = (fd.get('owner')||'').toString().trim();
    p.multiTenant = !!fd.get('multiTenant');
    save();
    addActivityLog('property_edit','แก้ไขข้อมูลทรัพย์สิน '+p.name);
    closeModal();
    toast('บันทึกข้อมูลทรัพย์สินแล้ว','success');
    if(typeof openPropertyDetail === 'function') openPropertyDetail(+pid);
  });
}

