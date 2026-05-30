// ========== PER-CONTRACT CLAUSE OVERRIDE EDITOR ==========
// แก้ไขข้อสัญญาเฉพาะสัญญานี้ — แสดงสีแดงในจอ ปกติเวลาพิมพ์
function openClauseOverrideEditor(cid){
  const c=DB.contracts.find(x=>x.id===cid);
  if(!c)return;
  const tpl=getActiveTemplate();
  const base=normalizeClauses(tpl.clauses);
  if(!c.clauseOverrides)c.clauseOverrides={};
  const ov=c.clauseOverrides;
  const esc=s=>(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  $('mtitle').textContent='แก้ข้อสัญญาเฉพาะสัญญานี้ — '+(c.no||c.tenant);
  $('mbody').innerHTML=`
    <div style="max-height:70vh;overflow-y:auto;padding-right:6px">
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;font-size:12px;color:#991b1b;margin-bottom:14px">
        ⚠ ข้อที่แก้จะแสดง <strong>สีแดง</strong> ในจอ พร้อมโน้ต "(แก้ไข)" — แต่<strong>เวลาพิมพ์จะออกสีดำปกติ ไม่มีโน้ต</strong><br>
        ถ้าเว้นว่าง = ใช้ข้อมาตรฐานจากฟอร์ม
      </div>
      ${base.map((cl,i)=>{
        const cur=ov[String(i)]||'';
        const subs=(cl.sub||[]).map((s,j)=>{
          const k=i+'.'+j;
          const cs=ov[k]||'';
          return `<div style="margin:8px 0 8px 24px">
            <div style="font-size:11px;color:#6b7280;margin-bottom:3px">ข้อย่อย ${i+1}.${j+1}</div>
            <div style="font-size:11px;color:#64748b;margin-bottom:3px;font-style:italic">เดิม: ${esc(s)}</div>
            <textarea data-ovk="${k}" rows="2" placeholder="เว้นว่าง = ใช้แบบเดิม" style="width:100%;padding:8px;border:1px solid ${cs?'#dc2626':'#e2e8f0'};border-radius:6px;font-size:12px;${cs?'background:#fef2f2':''}">${esc(cs)}</textarea>
          </div>`;
        }).join('');
        return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:10px;background:${cur?'#fef2f2':'#fff'}">
          <div style="font-weight:700;color:#1e3a5f;font-size:13px;margin-bottom:4px">ข้อ ${i+1}</div>
          <div style="font-size:11px;color:#64748b;margin-bottom:4px;font-style:italic">เดิม: ${esc(cl.text)}</div>
          <textarea data-ovk="${i}" rows="3" placeholder="เว้นว่าง = ใช้แบบเดิม" style="width:100%;padding:8px;border:1px solid ${cur?'#dc2626':'#e2e8f0'};border-radius:6px;font-size:12px;${cur?'background:#fff':''}">${esc(cur)}</textarea>
          ${subs}
        </div>`;
      }).join('')}
    </div>
    <div class="flex gap-3 pt-3 border-t mt-3">
      <button onclick="saveClauseOverrides(${cid})" class="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">บันทึก</button>
      <button onclick="clearClauseOverrides(${cid})" class="px-4 py-2.5 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50">ล้างทั้งหมด</button>
      <button onclick="closeModal();viewContract(${cid})" class="flex-1 py-2.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">ยกเลิก</button>
    </div>`;
  $('modal').classList.remove('hidden');
}

function saveClauseOverrides(cid){
  const c=DB.contracts.find(x=>x.id===cid);
  if(!c)return;
  const ov={};
  document.querySelectorAll('[data-ovk]').forEach(el=>{
    const k=el.dataset.ovk;
    const v=(el.value||'').trim();
    if(v)ov[k]=v;
  });
  c.clauseOverrides=ov;
  addActivityLog('edit_clause_override','แก้ข้อสัญญาเฉพาะ '+(c.no||'#'+cid)+' ('+Object.keys(ov).length+' ข้อ)');
  save();
  toast('บันทึกแล้ว');
  closeModal();
  viewContract(cid);
}

function clearClauseOverrides(cid){
  if(!confirm('ล้างการแก้ไขทั้งหมดของสัญญานี้ — กลับไปใช้แบบมาตรฐาน?'))return;
  const c=DB.contracts.find(x=>x.id===cid);
  if(!c)return;
  c.clauseOverrides={};
  save();
  toast('ล้างแล้ว');
  closeModal();
  viewContract(cid);
}

// ========== GLOBAL ADDRESS EDIT (single source of truth) ==========
function editLandlordAddr(name){
  if(!name)return;
  // Get current address from latest contract with this landlord
  const latest=DB.contracts.filter(x=>x.landlord===name&&x.landlordAddr).sort((a,b)=>b.id-a.id)[0];
  const curAddr=latest?latest.landlordAddr:'';
  showAddrEditDialog('ที่อยู่ผู้ให้เช่า','ll_edit',name,curAddr,'landlord','landlordAddr');
}
function editTenantAddr(name){
  if(!name)return;
  const latest=DB.contracts.filter(x=>x.tenant===name&&x.tenantAddr).sort((a,b)=>b.id-a.id)[0];
  const curAddr=latest?latest.tenantAddr:'';
  showAddrEditDialog('ที่อยู่ผู้เช่า','tn_edit',name,curAddr,'tenant','tenantAddr');
}
function showAddrEditDialog(title,prefix,personName,curAddr,matchField,addrField){
  const affected=DB.contracts.filter(x=>x[matchField]===personName);
  const ov=document.createElement('div');
  ov.id='addrEditOverlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  ov.innerHTML=`<div style="background:#fff;border-radius:16px;width:100%;max-width:500px;box-shadow:0 20px 60px rgba(0,0,0,.2);overflow:hidden">
    <div style="padding:20px 24px;border-bottom:1px solid #e5e7eb">
      <div style="font-size:16px;font-weight:700;color:#111827">${esc(title)}</div>
      <div style="font-size:13px;color:#6b7280;margin-top:2px">${esc(personName)} <span style="color:#a78bfa;font-size:11px">(จะอัพเดต ${affected.length} สัญญา)</span></div>
    </div>
    <form id="addrEditForm" style="padding:20px 24px">
      ${buildAddrSubFields(prefix, curAddr)}
      <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
        <button type="button" onclick="document.getElementById('addrEditOverlay').remove()" style="padding:8px 20px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;color:#374151;background:#fff;cursor:pointer">ยกเลิก</button>
        <button type="submit" style="padding:8px 20px;border:none;border-radius:8px;font-size:13px;color:#fff;background:#6366f1;cursor:pointer;font-weight:600">💾 บันทึกทุกสัญญา</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
  document.getElementById('addrEditForm').onsubmit=function(e){
    e.preventDefault();
    const fd=new FormData(this);
    const newAddr=assembleAddrFromPrefix(fd,prefix);
    // Update all contracts with this person
    let count=0;
    DB.contracts.forEach(c=>{
      if(c[matchField]===personName){
        const old=c[addrField]||'';
        if(old!==newAddr){c[addrField]=newAddr;count++;}
      }
    });
    save();
    ov.remove();
    if(count>0){
      addActivityLog('edit',`แก้ไข${title} "${personName}" (${count} สัญญา): ${newAddr.substring(0,60)}`);
      toast(`อัพเดตที่อยู่ ${personName} ใน ${count} สัญญาแล้ว`);
    } else {
      toast('ไม่มีอะไรเปลี่ยน');
    }
    // Re-render current view
    const curCid=window._currentViewCid;
    if(curCid)viewContract(curCid);
  };
}

function openCancelDialog(cid){
  const c=DB.contracts.find(x=>x.id===cid);if(!c)return;
  const today=new Date();
  const todayBE=`${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()+543}`;

  // Calculate contract duration info
  const startD=parseBE(c.start);
  const endD=parseBE(c.end);
  const daysRemaining=endD?Math.max(0,Math.round((endD-today)/864e5)):0;
  const perPeriod=amt(c.rate);
  const freq=payFreq(c.rate,c.payment);

  // Count unpaid periods
  const unpaid=[];
  if(freq.periods){
    const curBEYear=today.getFullYear()+543;
    freq.periods.forEach((p,idx)=>{
      const pk=c.id+'-'+curBEYear+'-'+p;
      if(!DB.payments[pk]?.paid)unpaid.push(freq.labels[idx]||'งวด '+p);
    });
  }

  const _cancelDefaultDate = c.plannedMoveOut || todayBE;
  $('mtitle').textContent='ยืนยันออกจริง — '+c.tenant;
  $('mbody').innerHTML=`
    ${c.noticeDate?`<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#92400e">
      <b>📢 ผู้เช่าแจ้งย้ายออกแล้ว</b> · แจ้งเมื่อ ${c.noticeDate} · กำหนดออก <b>${c.plannedMoveOut||'-'}</b>
      ${c.noticeNote?'<br>'+esc(c.noticeNote):''}
    </div>`:''}
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px;margin-bottom:16px;display:flex;gap:12px;align-items:flex-start">
      <svg style="width:24px;height:24px;color:#dc2626;flex-shrink:0;margin-top:2px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>
      <div><div style="font-weight:700;color:#991b1b;font-size:14px">ยืนยันยกเลิกสัญญา</div>
      <div style="font-size:12px;color:#7f1d1d;margin-top:4px">สัญญา <strong>${esc(c.no)||'#'+c.id}</strong> ของ <strong>${esc(c.tenant)}</strong></div></div>
    </div>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:16px;font-size:12px;color:#475569">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <div>สัญญาเริ่ม: <strong>${c.start||'-'}</strong></div>
        <div>สิ้นสุด: <strong>${c.end||'-'}</strong></div>
        <div>ค่าเช่า/งวด: <strong>${fmtBaht(perPeriod,{sym:0})} บาท</strong></div>
        <div>เหลือ: <strong>${daysRemaining} วัน</strong></div>
      </div>
      ${unpaid.length>0?'<div style="margin-top:6px;color:#dc2626">ค้างชำระ '+unpaid.length+' งวด: '+unpaid.join(', ')+'</div>':'<div style="margin-top:6px;color:#059669">ชำระครบทุกงวดแล้ว</div>'}
    </div>

    <form id="cancelForm" class="space-y-3">
      <div>
        <label class="text-xs font-semibold text-gray-700 mb-1 block">วันที่ออกจริง <span class="text-red-400">*</span></label>
        <div style="position:relative"><input type="text" name="cancelDate" value="${_cancelDefaultDate}" required class="w-full px-3 py-2 pr-9 border-2 border-red-200 rounded-lg text-sm font-medium bg-red-50 focus:border-red-500 outline-none" placeholder="dd/mm/yyyy พ.ศ."><span onclick="openThaiDP(this.previousElementSibling)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:16px;color:#64748b" title="เลือกวันที่">📅</span></div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">ระบบจะไม่คิดรายได้หลังวันนี้ · งวดที่ค้างก่อนวันยกเลิกยังต้องเก็บเงิน</div>
      </div>
      <div>
        <label class="text-xs font-semibold text-gray-700 mb-1 block">เหตุผลการยกเลิก</label>
        <select name="cancelReasonPreset" class="w-full px-3 py-2 border rounded-lg text-sm mb-2" onchange="const ta=this.closest('form').querySelector('[name=cancelReason]');if(this.value==='_custom'){ta.style.display='';ta.focus();}else{ta.value=this.value;ta.style.display='none';}">
          <option value="">-- เลือกเหตุผล --</option>
          <option value="ผู้เช่าขอยกเลิกก่อนกำหนด">ผู้เช่าขอยกเลิกก่อนกำหนด</option>
          <option value="หมดสัญญาแล้วไม่ต่อ">หมดสัญญาแล้วไม่ต่อ</option>
          <option value="ผิดสัญญา/ค้างค่าเช่า">ผิดสัญญา/ค้างค่าเช่า</option>
          <option value="ผู้ให้เช่าบอกเลิก">ผู้ให้เช่าบอกเลิก</option>
          <option value="เปลี่ยนผู้เช่าใหม่">เปลี่ยนผู้เช่าใหม่</option>
          <option value="_custom">อื่น ๆ (พิมพ์เอง)</option>
        </select>
        <textarea name="cancelReason" rows="2" class="w-full px-3 py-2 border rounded-lg text-sm" style="display:none" placeholder="ระบุเหตุผล..."></textarea>
      </div>
      <div class="flex gap-2 pt-2">
        <button type="submit" class="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">ยืนยันยกเลิก</button>
        <button type="button" onclick="viewContract(${cid})" class="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">กลับ</button>
      </div>
    </form>`;
  $('cancelForm').addEventListener('submit',e=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    const cancelDate=fd.get('cancelDate')||todayBE;
    // Check for unpaid invoices
    const unpaidInvs=(DB.invoices||[]).filter(inv=>inv.cid===cid&&inv.status!=='paid');
    if(unpaidInvs.length>0){
      const total=unpaidInvs.reduce(function(s,inv){return s+(inv.total||0);},0);
      customConfirm('มีใบแจ้งหนี้ค้างชำระ','สัญญานี้มีใบแจ้งหนี้ค้างชำระ '+unpaidInvs.length+' ใบ (รวม '+fmtBaht(total,{sym:0})+' บาท)\n\nยังต้องการยกเลิกสัญญาใช่หรือไม่?\nใบแจ้งหนี้ค้างจะยังคงอยู่ในระบบ',function(){
        _doCancelContract(c,cid,cancelDate,fd);
      },{icon:'⚠️',yesLabel:'ยืนยันยกเลิก',yesColor:'#dc2626'});
      return;
    }
    _doCancelContract(c,cid,cancelDate,fd);
  });
  $('modal').classList.remove('hidden');
  setTimeout(()=>enhanceDatalistInputs($('mbody')),50);
}
function _doCancelContract(c,cid,cancelDate,fd){
  c.cancelled=true;
  c.cancelledDate=cancelDate;
  c.cancelledReason=fd.get('cancelReason')||fd.get('cancelReasonPreset')||'';
  c.originalEnd=c.originalEnd||c.end;
  c.end=cancelDate;
  addActivityLog('cancel_contract','ยกเลิกสัญญา '+(c.no||'#'+cid)+' — '+c.tenant,{reason:c.cancelledReason});
  addContractAudit(cid,'cancel','ยกเลิกสัญญา · '+cancelDate+(c.cancelledReason?' — '+c.cancelledReason:''),{originalEnd:c.originalEnd,cancelDate});
  save();toast('ยกเลิกสัญญาแล้ว · วันที่ยกเลิก: '+cancelDate);viewContract(cid);
}

// ─── Notice to Move Out ───────────────────────────────────────────────────
function openNoticeDialog(cid){
  const c=DB.contracts.find(x=>x.id===cid);if(!c)return;
  const today=new Date();
  const _todayBE=String(today.getDate()).padStart(2,'0')+'/'+String(today.getMonth()+1).padStart(2,'0')+'/'+(today.getFullYear()+543);
  const isEdit=!!c.noticeDate;
  $('mtitle').textContent=(isEdit?'แก้ไข':'บันทึก')+'แจ้งย้ายออก — '+c.tenant;
  $('mbody').innerHTML=`
  <div style="font-family:Sarabun">
    ${isEdit?`<div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#92400e">
      <b>บันทึกแล้ว</b> · แจ้งเมื่อ ${c.noticeDate} · กำหนดออก ${c.plannedMoveOut||'-'}
      <br><span style="opacity:.75">แก้ไขจะบันทึกทับของเดิม</span>
    </div>`:''}
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#475569">
      <div><b>ผู้เช่า:</b> ${esc(c.tenant)||'-'} &nbsp;·&nbsp; <b>สัญญาเลขที่:</b> ${esc(c.no)||'#'+c.id}</div>
      <div><b>สิ้นสุดตามสัญญา:</b> ${c.end||'-'}</div>
    </div>
    <form id="noticeForm" style="display:grid;gap:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <label style="font-size:11px;color:#64748b;display:block;margin-bottom:4px">วันที่แจ้ง <span style="color:#dc2626">*</span></label>
          <div style="position:relative">
            <input type="text" name="noticeDate" value="${c.noticeDate||_todayBE}" required placeholder="DD/MM/YYYY"
              style="width:100%;padding:9px 36px 9px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:Sarabun;box-sizing:border-box">
            <span onclick="openThaiDP(this.previousElementSibling)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:16px;color:#64748b">📅</span>
          </div>
        </div>
        <div>
          <label style="font-size:11px;color:#64748b;display:block;margin-bottom:4px">วันที่จะออกจริง <span style="color:#dc2626">*</span></label>
          <div style="position:relative">
            <input type="text" name="plannedMoveOut" value="${c.plannedMoveOut||c.end||''}" required placeholder="DD/MM/YYYY"
              style="width:100%;padding:9px 36px 9px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:Sarabun;box-sizing:border-box">
            <span onclick="openThaiDP(this.previousElementSibling)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:16px;color:#64748b">📅</span>
          </div>
        </div>
      </div>
      <div>
        <label style="font-size:11px;color:#64748b;display:block;margin-bottom:4px">หมายเหตุ</label>
        <textarea name="noticeNote" rows="2" placeholder="เช่น แจ้งผ่าน Line, ไม่ต่อสัญญา"
          style="width:100%;padding:9px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:Sarabun;box-sizing:border-box;resize:none">${esc(c.noticeNote||'')}</textarea>
      </div>
      <div style="display:flex;gap:8px;margin-top:2px">
        <button type="submit" style="flex:1;padding:11px;background:#d97706;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:Sarabun">💾 บันทึก</button>
        <button type="button" onclick="viewContract(${cid})" style="padding:11px 18px;background:#f1f5f9;color:#475569;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-family:Sarabun">ยกเลิก</button>
      </div>
    </form>
  </div>`;
  $('modal').classList.remove('hidden');
  $('noticeForm').addEventListener('submit',e=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    const noticeDate=normalizeBEDate(fd.get('noticeDate')||'');
    const plannedMoveOut=normalizeBEDate(fd.get('plannedMoveOut')||'');
    if(!noticeDate||!parseBE(noticeDate)){toast('กรุณาระบุวันที่แจ้งให้ถูกต้อง','error');return;}
    if(!plannedMoveOut||!parseBE(plannedMoveOut)){toast('กรุณาระบุวันที่จะออกให้ถูกต้อง','error');return;}
    _doSaveNotice(c,cid,noticeDate,plannedMoveOut,fd.get('noticeNote')||'');
  });
}
function _doSaveNotice(c,cid,noticeDate,plannedMoveOut,noticeNote){
  const isEdit=!!c.noticeDate;
  c.noticeDate=noticeDate;
  c.plannedMoveOut=plannedMoveOut;
  c.noticeNote=noticeNote;
  addActivityLog(isEdit?'notice_edit':'notice_moveout',(isEdit?'แก้ไข':'บันทึก')+'แจ้งย้ายออก '+(c.no||'#'+cid)+' — '+c.tenant+' · ออกจริง '+plannedMoveOut);
  save();
  toast('บันทึกแจ้งย้ายออกแล้ว ✓');
  viewContract(cid);
}

function restoreContract(cid){
  const c=DB.contracts.find(x=>x.id===cid);if(!c)return;
  // BUGFIX P2-4: เช็ค overlap ก่อนคืนสถานะ
  // ถ้าระหว่างที่ยกเลิกไป มีสัญญาอื่นมาเช่าทรัพย์เดียวกันในช่วงเวลาทับ → ต้องเตือนก่อน
  // Skip ทรัพย์สินที่แบ่งให้หลายผู้เช่าได้พร้อมกัน (ดาดฟ้า ฯลฯ)
  const restoredEnd = c.originalEnd || c.end;
  const cs = parseBE(c.start), ce = parseBE(restoredEnd);
  const skipMulti = typeof isMultiTenantProperty==='function' && isMultiTenantProperty(c.pid);
  const overlap = !skipMulti && cs && ce && DB.contracts.find(x => x.id!==cid && x.pid===c.pid && !x.cancelled
    && (()=>{const s=parseBE(x.start),e=parseBE(x.end);return s&&e&&!(e<cs||s>ce);})());
  if(overlap){
    customConfirm('ไม่สามารถคืนสถานะได้',
      'ทรัพย์สินนี้มีสัญญา "'+(overlap.no||'#'+overlap.id)+' — '+overlap.tenant+'" ทับช่วงเวลา ('+overlap.start+' ถึง '+overlap.end+')\n\nกรุณายกเลิกสัญญาอื่นก่อน หรือแก้วันที่ให้ไม่ทับกัน',
      null, {icon:'⚠️', type:'alert'});
    return;
  }
  customConfirm('คืนสถานะสัญญา','คืนสถานะ '+c.tenant+' ?\nสัญญาจะกลับมานับรายได้ตามปกติ',function(){
  if(c.originalEnd)c.end=c.originalEnd; // restore original end date
  c.cancelled=false;delete c.cancelledDate;delete c.cancelledReason;delete c.originalEnd;
  addContractAudit(cid,'restore','คืนสถานะสัญญา · กลับมามีผลตามวันสิ้นสุดเดิม');
  save();toast('คืนสถานะสัญญาแล้ว');viewContract(cid);
  },{icon:'🔄',yesLabel:'คืนสถานะ',yesColor:'#059669'});
}

function openPropertyDetail(pid) {
  const p = DB.properties.find(x => x.pid === pid);
  if (!p) return;
  const cs = DB.contracts.filter(x => x.pid === pid).sort((a, b) => (parseBE(b.start) || 0) - (parseBE(a.start) || 0));
  const activeC = cs.find(x => {const s = status(x); return s === 'active' || s === 'upcoming';});

  // ที่อยู่สำหรับแสดงผล — fallback ไป titleDeed ถ้า address ว่าง/สั้นเกิน (เคสที่ดินเปล่า)
  const dispAddr = (typeof getPropertyAddress === 'function') ? getPropertyAddress(p) : (p.address||p.location||'');
  const isMulti = (typeof isMultiTenantProperty === 'function') && isMultiTenantProperty(p);
  $('mtitle').textContent = p.name;
  $('mbody').innerHTML = `
    <div class="space-y-6">
      <div class="bg-gray-50 rounded-lg p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="font-semibold text-gray-900">ข้อมูลทรัพย์สิน</h4>
          <button onclick="openEditPropertyDialog(${pid})" class="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg font-medium hover:bg-indigo-100" title="แก้ไขข้อมูลทรัพย์สิน">✏️ แก้ไข</button>
        </div>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div><span class="text-gray-500">ประเภท:</span><div class="font-medium">${esc(p.type)}${isMulti?' <span style="font-size:9px;color:#fff;background:#10b981;padding:1px 6px;border-radius:99px;font-weight:700;margin-left:4px" title="ทรัพย์สินนี้แบ่งให้หลายผู้เช่าได้พร้อมกัน — ระบบจะไม่เตือนเรื่องสัญญาซ้อน">หลายผู้เช่า</span>':''}</div></div>
          <div><span class="text-gray-500">สถานที่:</span><div class="font-medium">${esc(p.location)}</div></div>
          <div class="col-span-2"><span class="text-gray-500">ที่อยู่:</span>${isBadAddr(p)?'<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:6px 10px;margin-top:4px;font-size:12px;color:#dc2626;font-weight:600">⚠ ที่อยู่ไม่ถูกต้อง กรุณาแก้ไข</div>'+(dispAddr?'<div style="font-size:11px;color:#64748b;margin-top:2px">ปัจจุบัน: '+esc(dispAddr)+'</div>':''):'<div class="font-medium text-xs mt-1">'+esc(dispAddr)+'</div>'}</div>
          <div><span class="text-gray-500">พื้นที่:</span><div class="font-medium">${esc(p.area) || '-'}</div></div>
          <div><span class="text-gray-500">โฉนด:</span><div class="font-medium text-xs mt-1">${esc(p.titleDeed) || '-'}</div></div>
        </div>
      </div>

      <!-- Property Images -->
      <div class="bg-white rounded-lg border p-4">
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-semibold text-gray-900 text-sm">รูปภาพ (${(p.images||[]).length})</h4>
          <label class="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-medium cursor-pointer hover:bg-indigo-100">
            + เพิ่มรูป
            <input type="file" accept="image/*" multiple style="display:none" onchange="propAddImages(${pid},this.files)">
          </label>
        </div>
        ${(p.images||[]).length>0?`
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${(p.images||[]).map((img,i)=>`
              <div style="position:relative;width:100px;height:80px;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;cursor:pointer" onclick="propViewImage(${pid},${i})">
                <img src="${img}" style="width:100%;height:100%;object-fit:cover">
                <button onclick="event.stopPropagation();propRemoveImage(${pid},${i})" style="position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.5);color:#fff;border:none;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center" title="ลบ">×</button>
              </div>
            `).join('')}
          </div>
        `:'<div class="text-xs text-gray-400 text-center py-4">ยังไม่มีรูปภาพ · กดเพิ่มรูปเพื่อแนบรูปที่ดิน สัญญา หรืออื่นๆ</div>'}
      </div>

      ${activeC ? `
      <div class="bg-blue-50 rounded-lg p-4 space-y-2">
        <h4 class="font-semibold text-gray-900">ผู้เช่าปัจจุบัน</h4>
        <div class="text-sm space-y-1">
          <div><span class="text-gray-600">ชื่อ:</span> <span class="font-medium">${esc(activeC.tenant)}</span></div>
          ${activeC.taxId&&activeC.taxId!=='-'?'<div><span class="text-gray-600">เลขประจำตัว:</span> <span class="font-medium">'+esc(activeC.taxId)+'</span></div>':''}
          ${activeC.tenantAddr&&activeC.tenantAddr!=='-'?'<div><span class="text-gray-600">ที่อยู่:</span> <span class="font-medium text-xs">'+esc(activeC.tenantAddr)+'</span></div>':''}
          <div><span class="text-gray-600">โทร:</span> <span class="font-medium">${esc(activeC.phone) || '-'}</span></div>
          <div><span class="text-gray-600">เลขที่สัญญา:</span> <span class="font-medium">${esc(activeC.no) || '-'}</span></div>
        </div>
      </div>
      ` : '<div class="bg-red-50 rounded-lg p-4"><div class="text-sm font-medium text-red-800">ว่าง (ไม่มีสัญญาที่ใช้งาน)</div></div>'}

      ${(()=>{
        // Check for overlapping contracts on this property
        // Skip ทรัพย์สินที่แบ่งให้หลายผู้เช่าได้พร้อมกัน (ดาดฟ้า ฯลฯ)
        if(typeof isMultiTenantProperty==='function' && isMultiTenantProperty(p))return'';
        const activeCs=cs.filter(c=>!c.cancelled&&status(c)!=='cancelled');
        const overlaps=[];
        for(let i=0;i<activeCs.length;i++){
          for(let j=i+1;j<activeCs.length;j++){
            const a=activeCs[i],b=activeCs[j];
            const as=parseBE(a.start),ae=parseBE(a.end),bs=parseBE(b.start),be=parseBE(b.end);
            if(as&&ae&&bs&&be){const ov=Math.min(ae.getTime(),be.getTime())-Math.max(as.getTime(),bs.getTime());if(ov>=86400000)overlaps.push({a,b});}
          }
        }
        if(overlaps.length===0)return'';
        return'<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;margin-bottom:4px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><svg style="width:18px;height:18px;color:#dc2626;flex-shrink:0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg><span style="font-size:13px;font-weight:700;color:#dc2626">สัญญาซ้อนกัน — 1 แปลงควรมี 1 ผู้เช่า</span></div>'+overlaps.map(o=>'<div style="font-size:11px;color:#991b1b;padding:3px 0 3px 26px">• <b>'+esc(o.a.tenant)+'</b> ('+fmtBE(o.a.start)+'—'+fmtBE(o.a.end)+') ซ้อนกับ <b>'+esc(o.b.tenant)+'</b> ('+fmtBE(o.b.start)+'—'+fmtBE(o.b.end)+')</div>').join('')+'</div>';
      })()}

      <div class="space-y-3">
        <h4 class="font-semibold text-gray-900">สัญญาทั้งหมด (${cs.length})</h4>
        ${cs.length === 0 ? '<div class="text-sm text-gray-500">ไม่มีสัญญา</div>' : `
          <div class="space-y-2">
            ${cs.map(c => `
              <div class="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer" onclick="toggleContractExpand(this, ${c.id})">
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <div class="font-medium text-gray-900">${esc(c.tenant)}</div>
                    <div class="text-xs text-gray-500">${esc(c.no) || '-'} · ${fmtBE(c.start)} — ${fmtBE(c.end)}</div>
                  </div>
                  <div>${badge(status(c))}</div>
                </div>
                <div id="contract-detail-${c.id}" class="hidden mt-3 pt-3 border-t space-y-2 text-sm">
                  <div><span class="text-gray-600">อัตราเช่า:</span> <span>${esc(c.rate)}</span></div>
                  <div><span class="text-gray-600">วันที่เริ่ม:</span> <span>${fmtBE(c.start)}</span></div>
                  <div><span class="text-gray-600">วันที่สิ้นสุด:</span> <span>${fmtBE(c.end)}</span></div>
                  <div><span class="text-gray-600">วัตถุประสงค์:</span> <span>${esc(c.purpose)}</span></div>
                  <div class="pt-2 flex gap-2">
                    <button onclick="editContract(${c.id})" class="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">แก้ไข</button>
                    <button onclick="deleteContract(${c.id})" class="text-xs px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200">ลบ</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      <div class="flex gap-2 pt-4">
        <button onclick="openAddContractDialog(${pid})" class="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">เพิ่มสัญญาใหม่</button>
        <button onclick="editProperty(${pid})" class="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">แก้ไข</button>
        <button onclick="deleteProperty(${pid})" class="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">ลบ</button>
      </div>
    </div>
  `;
  $('modal').classList.remove('hidden');
  setTimeout(()=>enhanceDatalistInputs($('mbody')),50);
}

function propAddImages(pid,files){
  const p=DB.properties.find(x=>x.pid===pid);if(!p)return;
  if(!p.images)p.images=[];
  // Filter oversized files upfront — previously, skipped files would leave
  // `loaded` short of `files.length`, so save() never fired and new images
  // were lost on refresh.
  const valid=Array.from(files).filter(f=>{
    if(f.size>3*1024*1024){toast('ไฟล์ '+f.name+' ใหญ่เกิน 3MB');return false;}
    return true;
  });
  if(!valid.length)return;
  let loaded=0;
  const done=()=>{
    loaded++;
    if(loaded===valid.length){save();toast('เพิ่ม '+loaded+' รูปแล้ว');openPropertyDetail(pid);}
  };
  valid.forEach(file=>{
    const reader=new FileReader();
    reader.onload=e=>{p.images.push(e.target.result);done();};
    reader.onerror=()=>{toast('อ่านไฟล์ '+file.name+' ไม่สำเร็จ','error');done();};
    reader.readAsDataURL(file);
  });
}

function propRemoveImage(pid,idx){
  const p=DB.properties.find(x=>x.pid===pid);if(!p||!p.images)return;
  customConfirm('ลบรูปภาพ','ลบรูปนี้?',function(){
  p.images.splice(idx,1);
  save();openPropertyDetail(pid);
  },{icon:'🗑️',yesLabel:'ลบ',yesColor:'#dc2626'});
}

function propViewImage(pid,idx){
  const p=DB.properties.find(x=>x.pid===pid);if(!p||!p.images||!p.images[idx])return;
  const total=p.images.length;
  $('mtitle').textContent=p.name+' — รูปที่ '+(idx+1)+'/'+total;
  $('mbody').innerHTML=`<div style="text-align:center">
    <img src="${p.images[idx]}" style="max-width:100%;max-height:70vh;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1)">
    <div style="margin-top:12px;display:flex;justify-content:center;gap:8px">
      ${idx>0?'<button onclick="propViewImage('+pid+','+(idx-1)+')" style="padding:6px 16px;border:1px solid #d1d5db;border-radius:8px;font-size:12px;cursor:pointer">◀ ก่อนหน้า</button>':''}
      <button onclick="openPropertyDetail(${pid})" style="padding:6px 16px;border:1px solid #d1d5db;border-radius:8px;font-size:12px;cursor:pointer">กลับ</button>
      ${idx<total-1?'<button onclick="propViewImage('+pid+','+(idx+1)+')" style="padding:6px 16px;border:1px solid #d1d5db;border-radius:8px;font-size:12px;cursor:pointer">ถัดไป ▶</button>':''}
    </div>
  </div>`;
}

function toggleContractExpand(el, cid) {
  const detail = document.getElementById('contract-detail-' + cid);
  if (detail) detail.classList.toggle('hidden');
}

function parseAddrParts(addr){
  if(!addr) return {addrLine:'',subDistrict:'',district:'',province:'',zip:''};
  let s=addr.replace(/\s+/g,' ').trim();
  let zip='',province='',district='',subDistrict='',addrLine='';
  // รหัสไปรษณีย์
  const mz=s.match(/\s*(\d{5})\s*$/);
  if(mz){zip=mz[1];s=s.substring(0,s.length-mz[0].length).trim();}
  // จังหวัด
  const mj=s.match(/\s*(?:จ\.|จังหวัด)\s*(.+?)$/);
  if(mj){province=mj[1].trim();s=s.substring(0,s.length-mj[0].length).trim();}
  // อำเภอ/เขต
  const ma=s.match(/\s*(?:อ\.|อำเภอ|เขต)\s*(.+?)$/);
  if(ma){district=ma[1].trim();s=s.substring(0,s.length-ma[0].length).trim();}
  // ตำบล/แขวง
  const mt=s.match(/\s*(?:ต\.|ตำบล|แขวง)\s*(.+?)$/);
  if(mt){subDistrict=mt[1].trim();s=s.substring(0,s.length-mt[0].length).trim();}
  addrLine=s.trim();
  return {addrLine,subDistrict,district,province,zip};
}

function assemblePropAddr(fd){
  const parts=[];
  const al=(fd.get('addrLine')||'').trim();
  const sd=(fd.get('subDistrict')||'').trim();
  const dt=(fd.get('district')||'').trim();
  const pv=(fd.get('province')||'').trim();
  const zp=(fd.get('zip')||'').trim();
  const isBKK=/กรุงเทพ/.test(pv);
  if(al) parts.push(al);
  if(sd) parts.push(isBKK?'แขวง'+sd:'ต.'+sd);
  if(dt) parts.push(isBKK?'เขต'+dt:'อ.'+dt);
  if(pv) parts.push('จ.'+pv);
  if(zp) parts.push(zp);
  return parts.join(' ');
}

const TH_PROVINCES=['กรุงเทพมหานคร','กระบี่','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','พะเยา','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ','สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู','อ่างทอง','อุดรธานี','อุทัยธานี','อุตรดิตถ์','อุบลราชธานี','อำนาจเจริญ'];
function buildAddrSubFields(prefix, addrStr, opts){
  const ap=parseAddrParts(addrStr);
  const safeV=s=>(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  const ro=(opts&&opts.readonly)?'readonly tabindex="-1" style="background:#f1f5f9;cursor:default"':'';
  const cls='w-full px-3 py-2 border rounded-lg text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none';
  return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;margin-top:4px">
    <div style="margin-bottom:6px">
      <label class="text-xs text-gray-500 mb-1 block">เลขที่ / หมู่ / ซอย / ถนน</label>
      <input type="text" name="${prefix}_line" value="${safeV(ap.addrLine)}" class="${cls}" ${ro} placeholder="เช่น 99/1 หมู่ 5 ถ.เพชรเกษม">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
      <div>
        <label class="text-xs text-gray-500 mb-1 block">ตำบล/แขวง</label>
        <input type="text" name="${prefix}_sd" value="${safeV(ap.subDistrict)}" class="${cls}" ${ro} placeholder="เช่น ดอนกรวย">
      </div>
      <div>
        <label class="text-xs text-gray-500 mb-1 block">อำเภอ/เขต</label>
        <input type="text" name="${prefix}_dt" value="${safeV(ap.district)}" class="${cls}" ${ro} placeholder="เช่น ดำเนินสะดวก">
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      <div>
        <label class="text-xs text-gray-500 mb-1 block">จังหวัด</label>
        <datalist id="dl_prov_${prefix}">${TH_PROVINCES.map(p=>'<option value="'+p+'">').join('')}</datalist>
        <input type="text" name="${prefix}_pv" value="${safeV(ap.province)}" aria-autocomplete="list" list="dl_prov_${prefix}" class="${cls}" ${ro} placeholder="เช่น ราชบุรี">
      </div>
      <div>
        <label class="text-xs text-gray-500 mb-1 block">รหัสไปรษณีย์</label>
        <input type="text" name="${prefix}_zip" value="${safeV(ap.zip)}" maxlength="5" class="${cls}" ${ro} placeholder="เช่น 70130">
      </div>
    </div>
  </div>`;
}

function assembleAddrFromPrefix(fd, prefix){
  const parts=[];
  const al=(fd.get(prefix+'_line')||'').trim();
  const sd=(fd.get(prefix+'_sd')||'').trim();
  const dt=(fd.get(prefix+'_dt')||'').trim();
  const pv=(fd.get(prefix+'_pv')||'').trim();
  const zp=(fd.get(prefix+'_zip')||'').trim();
  const isBKK=/กรุงเทพ/.test(pv);
  if(al) parts.push(al);
  if(sd) parts.push(isBKK?'แขวง'+sd:'ต.'+sd);
  if(dt) parts.push(isBKK?'เขต'+dt:'อ.'+dt);
  if(pv) parts.push('จ.'+pv);
  if(zp) parts.push(zp);
  return parts.join(' ');
}

function buildPropFormHTML(p, types, locs){
  const isEdit=!!p;
  const v=k=>p?(p[k]||''):'';
  const ap=parseAddrParts(v('address'));
  const safeV=s=>(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  // สร้าง datalist สำหรับตำบล อำเภอ จากข้อมูลที่มี
  const allAddr=DB.properties.map(x=>x.address).filter(Boolean);
  const sdSet=new Set(), dtSet=new Set(), pvSet=new Set();
  allAddr.forEach(a=>{
    const mt=a.match(/(?:ต\.|ตำบล)\s*(\S+)/); if(mt) sdSet.add(mt[1]);
    const ma=a.match(/(?:อ\.|อำเภอ)\s*(\S+)/); if(ma) dtSet.add(ma[1]);
    const mj=a.match(/(?:จ\.|จังหวัด)\s*(\S+)/); if(mj) pvSet.add(mj[1]);
  });
  return `
    <form id="propForm" class="space-y-4">
      <datalist id="dl_ptypes">${types.map(t=>'<option value="'+esc(t)+'">').join('')}</datalist>
      <datalist id="dl_plocs">${locs.map(t=>'<option value="'+esc(t)+'">').join('')}</datalist>
      <datalist id="dl_sd">${[...sdSet].sort().map(t=>'<option value="'+esc(t)+'">').join('')}</datalist>
      <datalist id="dl_dt">${[...dtSet].sort().map(t=>'<option value="'+esc(t)+'">').join('')}</datalist>
      <datalist id="dl_pv">${TH_PROVINCES.map(t=>'<option value="'+esc(t)+'">').join('')}</datalist>
      <div>
        <label class="text-xs font-medium text-gray-600 mb-1 block">ชื่อทรัพย์สิน <span class="text-red-400">*</span></label>
        <input type="text" name="name" id="propNameInput" value="${safeV(v('name'))}" required class="w-full px-3 py-2 border rounded-lg text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none" placeholder="เช่น ที่ดิน ต.ดอนกรวย" autocomplete="off">
        <div id="propNameSuggest" class="hidden mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto text-sm"></div>
        <div id="propDupWarn" class="hidden mt-1 bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-xs text-yellow-700"></div>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px">
        <div style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:8px;display:flex;align-items:center;gap:4px">
          <span style="font-size:13px">📍</span> ที่อยู่ทรัพย์สิน
        </div>
        <div style="margin-bottom:8px">
          <label class="text-xs font-medium text-gray-500 mb-1 block">เลขที่ / หมู่ / ซอย / ถนน</label>
          <input type="text" name="addrLine" value="${safeV(ap.addrLine)}" class="w-full px-3 py-2 border rounded-lg text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none" placeholder="เช่น 99/1 หมู่ 5 ซอยราชวิถี ถ.เพชรเกษม">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <div>
            <label class="text-xs font-medium text-gray-500 mb-1 block">ตำบล/แขวง</label>
            <input type="text" name="subDistrict" value="${safeV(ap.subDistrict)}" aria-autocomplete="list" list="dl_sd" class="w-full px-3 py-2 border rounded-lg text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none" placeholder="เช่น ดอนกรวย">
          </div>
          <div>
            <label class="text-xs font-medium text-gray-500 mb-1 block">อำเภอ/เขต</label>
            <input type="text" name="district" value="${safeV(ap.district)}" aria-autocomplete="list" list="dl_dt" class="w-full px-3 py-2 border rounded-lg text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none" placeholder="เช่น ดำเนินสะดวก">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <label class="text-xs font-medium text-gray-500 mb-1 block">จังหวัด</label>
            <input type="text" name="province" value="${safeV(ap.province)}" aria-autocomplete="list" list="dl_pv" class="w-full px-3 py-2 border rounded-lg text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none" placeholder="เช่น ราชบุรี">
          </div>
          <div>
            <label class="text-xs font-medium text-gray-500 mb-1 block">รหัสไปรษณีย์</label>
            <input type="text" name="zip" value="${safeV(ap.zip)}" maxlength="5" pattern="[0-9]{5}" class="w-full px-3 py-2 border rounded-lg text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none" placeholder="เช่น 70130">
          </div>
        </div>
        <input type="hidden" name="address" value="">
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-medium text-gray-600 mb-1 block">เนื้อที่</label>
          <input type="text" name="area" value="${safeV(v('area'))}" class="w-full px-3 py-2 border rounded-lg text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none" placeholder="เช่น 2 ไร่ 1 งาน 50 ตร.วา">
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600 mb-1 block">เลขโฉนด</label>
          <input type="text" name="titleDeed" value="${safeV(v('titleDeed'))}" class="w-full px-3 py-2 border rounded-lg text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none" placeholder="เช่น 12345">
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600 mb-1 block">ประเภท <span class="text-red-400">*</span></label>
          <input type="text" name="type" value="${safeV(v('type'))}" aria-autocomplete="list" list="dl_ptypes" required class="w-full px-3 py-2 border rounded-lg text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none" placeholder="เช่น เสาสัญญาณ, ที่ดินเปล่า">
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600 mb-1 block">จังหวัด (สถานที่) <span class="text-red-400">*</span></label>
          <input type="text" name="location" value="${safeV(v('location'))}" aria-autocomplete="list" list="dl_plocs" required class="w-full px-3 py-2 border rounded-lg text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 outline-none" placeholder="เช่น ราชบุรี, กรุงเทพฯ">
        </div>
      </div>
      <div id="propFormErrors" class="hidden text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg p-2"></div>
      <div class="flex gap-3 pt-2">
        <button type="submit" class="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">${isEdit?'บันทึก':'เพิ่มทรัพย์สิน'}</button>
        <button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">ยกเลิก</button>
      </div>
    </form>
  `;
}

function openAddPropertyDialog() {
  const types=[...new Set(DB.properties.map(p=>p.type).filter(Boolean))].sort();
  const locs=[...new Set(DB.properties.map(p=>p.location).filter(Boolean))].sort();
  $('mtitle').textContent = 'เพิ่มทรัพย์สิน';
  $('mbody').innerHTML = buildPropFormHTML(null, types, locs);

  // Live search + duplicate detection on name field
  let _propSugTimer;
  $('propNameInput').addEventListener('input', e => {
    clearTimeout(_propSugTimer);
    _propSugTimer = setTimeout(() => {
      const q = e.target.value.trim().toLowerCase();
      const sugBox = $('propNameSuggest');
      const warnBox = $('propDupWarn');
      if (!q || q.length < 2) { sugBox.classList.add('hidden'); warnBox.classList.add('hidden'); return; }
      const matches = DB.properties.filter(p => p.name.toLowerCase().includes(q));
      const exact = matches.find(p => p.name.toLowerCase() === q);
      if (exact) {
        warnBox.innerHTML = '⚠️ ทรัพย์สินชื่อ "<strong>' + esc(exact.name) + '</strong>" มีอยู่แล้ว (' + esc(exact.location) + ', ' + esc(exact.type) + ')';
        warnBox.classList.remove('hidden');
      } else { warnBox.classList.add('hidden'); }
      if (matches.length > 0 && !exact) {
        sugBox.innerHTML = matches.slice(0, 8).map(p =>
          '<div class="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-0 flex justify-between" onclick="$(\'propNameInput\').value=\'' + esc(p.name.replace(/'/g,"\\'")) + '\';$(\'propNameSuggest\').classList.add(\'hidden\');propCheckDup(\'' + esc(p.name.replace(/'/g,"\\'")) + '\')">' +
          '<span class="text-gray-900">' + esc(p.name) + '</span>' +
          '<span class="text-xs text-gray-400">' + esc(p.location) + ' · ' + esc(p.type) + '</span></div>'
        ).join('');
        sugBox.classList.remove('hidden');
      } else { sugBox.classList.add('hidden'); }
    }, 200);
  });
  $('propNameInput').addEventListener('blur', () => { setTimeout(() => $('propNameSuggest')?.classList.add('hidden'), 200); });

  $('propForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const rawName = fd.get('name').trim();
    const addr = assemblePropAddr(fd);
    const deed = (fd.get('titleDeed')||'').trim();
    // validation
    const errs=[];
    if(!rawName) errs.push('กรุณาระบุชื่อทรัพย์สิน');
    if(!(fd.get('type')||'').trim()) errs.push('กรุณาระบุประเภท');
    if(!(fd.get('location')||'').trim()) errs.push('กรุณาระบุจังหวัด (สถานที่)');
    const zp=(fd.get('zip')||'').trim();
    if(zp && !/^\d{5}$/.test(zp)) errs.push('รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก');
    if(errs.length){
      const eb=$('propFormErrors');
      eb.innerHTML=errs.join('<br>');eb.classList.remove('hidden');return;
    }
    const name = autoEnrichPropName(rawName, addr, deed);
    const dup = DB.properties.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (dup && !confirm('ทรัพย์สินชื่อ "' + dup.name + '" มีอยู่แล้ว (' + dup.location + ')\nต้องการเพิ่มซ้ำหรือไม่?')) return;
    const pid = Math.max(...DB.properties.map(p => p.pid), 0) + 1;
    DB.properties.push({
      pid, name, address: addr, area: fd.get('area'),
      titleDeed: deed, type: fd.get('type'), location: fd.get('location')
    });
    addActivityLog('add_property','เพิ่มทรัพย์สิน '+name);
    save(); closeModal(true); toast('เพิ่มทรัพย์สินแล้ว'); renderProperties();
  });
  $('modal').classList.remove('hidden');
  setTimeout(()=>enhanceDatalistInputs($('mbody')),50);
}

function autoEnrichPropName(name, address, titleDeed) {
  // ถ้าชื่อมี ต./อ./แขวง/เขต อยู่แล้ว ไม่ต้องเพิ่ม
  if(/ต\.|อ\.|แขวง|เขต/.test(name)) return name;
  // ชื่อประเภทสั้นๆ ที่ควรเพิ่มที่อยู่: ที่ดิน, ที่น้ำ, บ้าน, อาคารพาณิชย์, ห้องแถว, สำนักงาน
  if(!/^(ที่ดิน|ที่น้ำ|บ้าน|อาคารพาณิชย์|ห้องแถว|สำนักงาน|โกดัง|โรงงาน)/.test(name)) return name;
  let src = address||'';
  if(!/ต\.|แขวง/.test(src)) src = titleDeed||'';
  const t = src.match(/ต\.(\S+)/)||src.match(/แขวง(\S+)/);
  const a = src.match(/อ\.(\S+)/)||src.match(/เขต(\S+)/);
  const parts=[];
  if(t) parts.push((src.match(/ต\./)?'ต.':'แขวง')+t[1]);
  if(a) parts.push((src.match(/อ\./)?'อ.':'เขต')+a[1]);
  return parts.length ? name+' '+parts.join(' ') : name;
}

function propCheckDup(name) {
  const exact = DB.properties.find(p => p.name.toLowerCase() === name.toLowerCase());
  const warnBox = $('propDupWarn');
  if (exact) {
    warnBox.innerHTML = '⚠️ ทรัพย์สินชื่อ "<strong>' + esc(exact.name) + '</strong>" มีอยู่แล้ว (' + esc(exact.location) + ', ' + esc(exact.type) + ')';
    warnBox.classList.remove('hidden');
  } else { warnBox.classList.add('hidden'); }
}

function editProperty(pid) {
  const p = DB.properties.find(x => x.pid === pid);
  if (!p) return;
  const types=[...new Set(DB.properties.map(x=>x.type).filter(Boolean))].sort();
  const locs=[...new Set(DB.properties.map(x=>x.location).filter(Boolean))].sort();
  $('mtitle').textContent = 'แก้ไขทรัพย์สิน';
  $('mbody').innerHTML = buildPropFormHTML(p, types, locs);
  $('propForm').addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const rawName = fd.get('name').trim();
    const addr = assemblePropAddr(fd);
    const deed = (fd.get('titleDeed')||'').trim();
    // validation
    const errs=[];
    if(!rawName) errs.push('กรุณาระบุชื่อทรัพย์สิน');
    if(!(fd.get('type')||'').trim()) errs.push('กรุณาระบุประเภท');
    if(!(fd.get('location')||'').trim()) errs.push('กรุณาระบุจังหวัด (สถานที่)');
    const zp=(fd.get('zip')||'').trim();
    if(zp && !/^\d{5}$/.test(zp)) errs.push('รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก');
    if(errs.length){
      const eb=$('propFormErrors');
      eb.innerHTML=errs.join('<br>');eb.classList.remove('hidden');return;
    }
    Object.assign(p, {
      name: autoEnrichPropName(rawName, addr, deed),
      address: addr,
      area: fd.get('area'),
      titleDeed: deed,
      type: fd.get('type'),
      location: fd.get('location')
    });
    addActivityLog('edit_property','แก้ไขทรัพย์สิน '+p.name);
    save();
    closeModal(true);
    toast('บันทึกแล้ว');
    renderProperties();
  });
  $('modal').classList.remove('hidden');
  setTimeout(()=>enhanceDatalistInputs($('mbody')),50);
}

function deleteProperty(pid) {
  if(!hasPermission('delete')){toast('คุณไม่มีสิทธิ์ลบทรัพย์สิน','error');return;}
  const p = DB.properties.find(x => x.pid === pid);
  const pName = p ? p.name : '(ไม่รู้จัก)';
  // Check active contracts
  const activeContracts = DB.contracts.filter(c => c.pid === pid && !c.cancelled && status(c) !== 'expired');
  if(activeContracts.length > 0) {
    customConfirm('ไม่สามารถลบได้', 'ทรัพย์สิน "' + pName + '" มีสัญญาที่ยังใช้งานอยู่ ' + activeContracts.length + ' สัญญา\n\nกรุณายกเลิกหรือรอให้สัญญาหมดอายุก่อนลบ:\n' + activeContracts.map(function(c){ return '• ' + (c.no||'#'+c.id) + ' — ' + c.tenant; }).join('\n'), null, {icon:'⚠️', type:'alert'});
    return;
  }
  // Check expired/cancelled contracts (warn but allow)
  const oldContracts = DB.contracts.filter(c => c.pid === pid);
  // BUGFIX P2-3: เตือนใบแจ้งหนี้ orphan ที่จะหลุดจากสัญญาของทรัพย์นี้
  // ใบไม่โดนลบตรงๆ แต่หน้า invoice จะไม่มีทรัพย์อ้างอิง → user ควรรู้ก่อนยืนยัน
  const orphanInvs = (DB.invoices||[]).filter(inv => oldContracts.some(c => c.id === inv.cid));
  let warnMsg = oldContracts.length > 0 ? '\n\n⚠️ สัญญาเก่า ' + oldContracts.length + ' สัญญาจะยังอยู่ในระบบ (ไม่ถูกลบ)' : '';
  if(orphanInvs.length > 0) warnMsg += '\n⚠️ ใบแจ้งหนี้ ' + orphanInvs.length + ' ใบจะหลุดจากทรัพย์ (ยังอยู่ในระบบแต่ไม่มีทรัพย์อ้างอิง)';
  customConfirm('ลบทรัพย์สิน','ลบ "' + pName + '" ใช่หรือไม่?' + warnMsg, function(){
  const propBefore = DB.properties.find(p=>p.pid===pid);
  if(!actionDeleteProperty(pid))return;
  addActivityLog('delete_property','ลบทรัพย์สิน '+pName, {entity_type:'property', entity_id:pid, before:propBefore});
  closeModal(true);
  toast('ลบแล้ว');
  renderProperties();
  },{icon:'🗑️',yesLabel:'ลบ',yesColor:'#dc2626'});
}

// ========== CONTRACTS ==========
let tenantExpanded = new Set();
let cSort={key:'rent',dir:'desc'};
// Tier B pagination — render top N tenants, "show more" loads next 50
const TENANTS_PER_PAGE = 50;
let tenantsShown = TENANTS_PER_PAGE;
function showMoreTenants(){ tenantsShown += TENANTS_PER_PAGE; renderContracts(); }
let cBatchSelect=new Set();
let cLastChecked=null;
function toggleTenantExpand(key){if(tenantExpanded.has(key))tenantExpanded.delete(key);else tenantExpanded.add(key);renderContracts();}
function toggleCSort(key){if(cSort.key===key)cSort.dir=cSort.dir==='asc'?'desc':'asc';else{cSort.key=key;cSort.dir=(key==='rent')?'desc':'asc';}renderContracts();}
function toggleSigned(cid){const c=DB.contracts.find(x=>x.id===cid);if(c){c.signed=!c.signed;addActivityLog(c.signed?'sign_contract':'unsign_contract',(c.signed?'เซ็น':'ยกเลิกการเซ็น')+' สัญญา '+(c.no||'#'+cid)+' — '+c.tenant);save();render();}}

function renderContracts(){
  const cs=DB.contracts, ps=DB.properties;
  const sts=['all','active','expiring','expired','upcoming','cancelled'];

  // Filter
  let fl=cs.slice();
  if(cFilter.q){
    const q=cFilter.q.toLowerCase();
    fl=fl.filter(c=>c.tenant?.toLowerCase().includes(q)||c.no?.toLowerCase().includes(q)||c.property?.toLowerCase().includes(q));
  }
  if(cFilter.st!=='all')fl=fl.filter(c=>status(c)===cFilter.st);
  if(cFilter.cat!=='all')fl=fl.filter(c=>cat(c.purpose)===cFilter.cat);
  if(cFilter.signed==='signed')fl=fl.filter(c=>c.signed);
  else if(cFilter.signed==='unsigned')fl=fl.filter(c=>!c.signed);

  // Group by tenant
  const tenantMap={};
  fl.forEach(c=>{
    const key=c.tenant||'ไม่ระบุผู้เช่า';
    if(!tenantMap[key])tenantMap[key]={contracts:[],tenant:key};
    tenantMap[key].contracts.push(c);
  });
  let tenants=Object.values(tenantMap);

  // Sort tenants
  tenants.sort((a,b)=>{
    if(cSort.key==='tenant'){
      return cSort.dir==='asc'?a.tenant.localeCompare(b.tenant,'th'):b.tenant.localeCompare(a.tenant,'th');
    }
    if(cSort.key==='rent'){
      const ar=a.contracts.reduce((s,c)=>s+monthlyRev(c),0);
      const br=b.contracts.reduce((s,c)=>s+monthlyRev(c),0);
      return cSort.dir==='asc'?(ar-br):(br-ar);
    }
    if(cSort.key==='property'){
      const ap=(ps.find(x=>x.pid===a.contracts[0]?.pid)||{}).name||'';
      const bp=(ps.find(x=>x.pid===b.contracts[0]?.pid)||{}).name||'';
      return cSort.dir==='asc'?ap.localeCompare(bp,'th'):bp.localeCompare(ap,'th');
    }
    if(cSort.key==='status'){
      const so={active:0,expiring:1,expired:2,upcoming:3,cancelled:4};
      const sa=a.contracts.some(c=>status(c)==='expiring')?'expiring':a.contracts.some(c=>status(c)==='active')?'active':'expired';
      const sb=b.contracts.some(c=>status(c)==='expiring')?'expiring':b.contracts.some(c=>status(c)==='active')?'active':'expired';
      return cSort.dir==='asc'?(so[sa]??9)-(so[sb]??9):(so[sb]??9)-(so[sa]??9);
    }
    if(cSort.key==='end'){
      const ae=a.contracts.map(c=>parseBE(c.end)).filter(Boolean).sort((x,y)=>x-y)[0];
      const be=b.contracts.map(c=>parseBE(c.end)).filter(Boolean).sort((x,y)=>x-y)[0];
      if(!ae&&!be)return 0;if(!ae)return 1;if(!be)return -1;
      return cSort.dir==='asc'?(ae-be):(be-ae);
    }
    // Default: active first then by rev
    const aAct=a.contracts.some(c=>{const s=status(c);return s==='active'||s==='expiring'});
    const bAct=b.contracts.some(c=>{const s=status(c);return s==='active'||s==='expiring'});
    if(aAct!==bAct)return bAct-aAct;
    return b.contracts.reduce((s,c)=>s+monthlyRev(c),0)-a.contracts.reduce((s,c)=>s+monthlyRev(c),0);
  });

  // KPIs
  const totalTenants=tenants.length;
  const totalContracts=fl.length;
  const activeContracts=fl.filter(c=>{const s=status(c);return s==='active'||s==='expiring'}).length;
  const expiringContracts=fl.filter(c=>status(c)==='expiring').length;
  const totalRevMo=fl.reduce((s,c)=>s+monthlyRev(c),0);

  const cSortArrow=(k)=>cSort.key===k?'<span class="arrow">'+(cSort.dir==='asc'?'▲':'▼')+'</span>':'';

  $('content').innerHTML=`${propTabBar()}
    <!-- KPI Summary -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:16px">
      <div class="kpi-box"><div class="kv" style="color:#6366f1">${totalTenants}</div><div class="kl">ผู้เช่า</div></div>
      <div class="kpi-box"><div class="kv" style="color:#1e293b">${totalContracts}</div><div class="kl">สัญญาทั้งหมด</div></div>
      <div class="kpi-box"><div class="kv" style="color:#059669">${activeContracts}</div><div class="kl">สัญญามีผล</div></div>
      ${expiringContracts>0?'<div class="kpi-box" style="border-color:#fde68a"><div class="kv" style="color:#d97706">'+expiringContracts+'</div><div class="kl">ใกล้หมดอายุ</div></div>':''}
      <div class="kpi-box accent"><div class="kv" style="color:#059669">${fmtBaht(totalRevMo,{sym:0})}</div><div class="kl">บ./เดือน</div></div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <div class="relative flex-1" style="min-width:220px">
        <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input id="cq" type="text" placeholder="ค้นหาผู้เช่า, เลขสัญญา..." value="${esc(cFilter.q)}" class="w-full pl-9 pr-4 py-2 border rounded-lg text-sm">
      </div>
      <select id="csf" class="px-3 py-2 border rounded-lg text-sm bg-white">
        ${sts.map(s=>`<option value="${s}" ${cFilter.st===s?'selected':''}>${{all:'ทุกสถานะ',active:'มีผล',expiring:'ใกล้หมด',expired:'หมดอายุ',upcoming:'รอเริ่ม',cancelled:'ยกเลิก'}[s]}</option>`).join('')}
      </select>
      <select id="csignf" class="px-3 py-2 border rounded-lg text-sm bg-white">
        <option value="all" ${cFilter.signed==='all'?'selected':''}>ทุกการเซ็น</option>
        <option value="signed" ${cFilter.signed==='signed'?'selected':''}>เซ็นแล้ว</option>
        <option value="unsigned" ${cFilter.signed==='unsigned'?'selected':''}>ยังไม่เซ็น</option>
      </select>
      <button onclick="batchPrintContracts()" style="padding:8px 14px;background:#fff;color:#6366f1;border:1px solid #c7d2fe;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px"><svg style="width:14px;height:14px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>พิมพ์</button>
      <button onclick="openAddContractDialog()" class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-1.5">+ เพิ่มสัญญา</button>
    </div>

    <!-- Column Header -->
    <div class="grid-contracts-header">
      <div><input type="checkbox" style="width:14px;height:14px;cursor:pointer" onchange="toggleAllContracts(this.checked)" title="เลือกทั้งหมด"></div>
      <div></div>
      <div class="col-sort" onclick="toggleCSort('tenant')">ผู้เช่า ${cSortArrow('tenant')}</div>
      <div class="col-sort" onclick="toggleCSort('property')">ทรัพย์สิน ${cSortArrow('property')}</div>
      <div class="col-sort" onclick="toggleCSort('status')">สถานะ ${cSortArrow('status')}</div>
      <div class="col-sort" onclick="toggleCSort('end')">ระยะสัญญา ${cSortArrow('end')}</div>
      <div class="col-sort" onclick="toggleCSort('rent')" style="justify-content:flex-end">ค่าเช่า/ด. ${cSortArrow('rent')}</div>
    </div>

    <!-- Batch Select Info -->
    ${cBatchSelect.size>0?'<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;margin-bottom:8px"><span style="font-size:12px;font-weight:600;color:#4338ca">เลือก '+cBatchSelect.size+' สัญญา</span><button onclick="batchPrintContracts()" style="padding:4px 12px;background:#6366f1;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">พิมพ์ที่เลือก</button><button onclick="batchMarkSigned(true)" style="padding:4px 12px;background:#059669;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer">เซ็นแล้ว</button><button onclick="batchMarkSigned(false)" style="padding:4px 12px;background:#fff;color:#64748b;border:1px solid #e2e8f0;border-radius:6px;font-size:11px;cursor:pointer">ยังไม่เซ็น</button><button onclick="cBatchSelect.clear();renderContracts()" style="padding:4px 8px;background:none;color:#64748b;border:none;font-size:11px;cursor:pointer">ยกเลิก</button></div>':''}

    <!-- Tenant Rows (Tier B pagination) -->
    <div>
    ${tenants.slice(0,tenantsShown).map(t=>{
      const expanded=tenantExpanded.has(t.tenant);
      const tContracts=t.contracts;
      const active=tContracts.filter(c=>{const s=status(c);return s==='active'||s==='expiring'});
      const rev=tContracts.reduce((s,c)=>s+monthlyRev(c),0);
      const mainC=active[0]||tContracts[0];
      const mainP=mainC?ps.find(x=>x.pid===mainC.pid):null;
      const props=[...new Set(tContracts.map(c=>{const p2=ps.find(x=>x.pid===c.pid);return p2?p2.name:''}).filter(Boolean))];
      const isActive=active.length>0;
      const hasExpiring=active.some(c=>status(c)==='expiring');
      const borderClass=!isActive?'prop-vacant':hasExpiring?'prop-expiring':'prop-active';

      // Status badge (same as properties page)
      const tStatus=hasExpiring?'expiring':isActive?'active':tContracts.some(c=>status(c)==='upcoming')?'upcoming':'expired';
      const stBadgeMap={active:'<span style="background:#dcfce7;color:#15803d;padding:1px 7px;border-radius:99px;font-size:10px;font-weight:600;white-space:nowrap">มีผล</span>',expiring:'<span style="background:#fef3c7;color:#b45309;padding:1px 7px;border-radius:99px;font-size:10px;font-weight:600;white-space:nowrap;animation:pulse-badge 2s infinite">ใกล้หมด</span>',expired:'<span style="background:#fee2e2;color:#dc2626;padding:1px 7px;border-radius:99px;font-size:10px;font-weight:600;white-space:nowrap">หมดอายุ</span>',upcoming:'<span style="background:#e0e7ff;color:#4338ca;padding:1px 7px;border-radius:99px;font-size:10px;font-weight:600;white-space:nowrap">รอเริ่ม</span>'};
      const signedCount=tContracts.filter(c=>c.signed).length;
      const unsignedCount=tContracts.length-signedCount;

      // Progress bar from main contract
      const cS=mainC?parseBE(mainC.start):null, cE=mainC?parseBE(mainC.end):null;
      const now2=new Date();
      const tDays=cS&&cE?Math.max(1,Math.round((cE-cS)/864e5)):0;
      const elap=cS?Math.round((now2-cS)/864e5):0;
      const rem=cE?Math.round((cE-now2)/864e5):0;
      const pBar=tDays>0?Math.min(100,Math.max(0,Math.round(elap/tDays*100))):0;
      const sShort=cS?(cS.getDate()+'/'+(cS.getMonth()+1)+'/'+(cS.getFullYear()+543).toString().slice(-2)):'-';
      const eShort=cE?(cE.getDate()+'/'+(cE.getMonth()+1)+'/'+(cE.getFullYear()+543).toString().slice(-2)):'-';
      const bCol=rem<0?'#dc2626':rem<=90?'#f59e0b':'#22c55e';
      const dLbl=rem<0?Math.abs(rem)+' วันเกิน':rem<=0?'หมดวันนี้':'เหลือ '+rem+' วัน';

      return `
      <div class="prop-row ${borderClass}" style="margin-bottom:2px">
        <div class="prop-head grid-contracts-row" onclick="toggleTenantExpand('${esc(t.tenant.replace(/'/g,"\\\\'"))}')" style="padding:6px 10px">
          <div onclick="event.stopPropagation()"><input type="checkbox" data-cids="${tContracts.map(c=>c.id).join(',')}" ${tContracts.every(c=>cBatchSelect.has(c.id))?'checked':''} style="width:14px;height:14px;cursor:pointer" onclick="handleTenantCheck(event,this)" title="เลือกทั้งหมดของผู้เช่านี้"></div>
          <svg style="width:12px;height:12px" class="text-gray-400 transition-transform ${expanded?'transform rotate-90':''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          <div style="min-width:0;overflow:hidden;display:flex;align-items:center;gap:5px">
            <span style="font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.tenant)}</span>
            <span style="font-size:10px;color:#fff;background:#6366f1;padding:1px 6px;border-radius:99px;font-weight:700;flex-shrink:0">${tContracts.length}</span>
          </div>
          <div style="color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px">${props.length>0?esc(props[0])+(props.length>1?' +อีก'+(props.length-1):''):'<span style="color:#cbd5e1">-</span>'}</div>
          <div style="text-align:center">${stBadgeMap[tStatus]||'-'}${unsignedCount>0?'<div style="font-size:9px;color:#dc2626;margin-top:1px">'+unsignedCount+' ยังไม่เซ็น</div>':''}</div>
          <div class="progress-cell" style="min-width:0">${mainC&&cS?`<div class="pc-dates" style="display:flex;justify-content:space-between;margin-bottom:2px"><span>${sShort}</span><span style="font-weight:600;color:${bCol}">${pBar}%</span><span>${eShort}</span></div><div class="pc-bar"><div class="pc-fill" style="width:${pBar}%;background:${bCol}"></div></div><div class="pc-info" style="color:${bCol};margin-top:1px">${dLbl}</div>`:'<span style="color:#cbd5e1;font-size:10px">-</span>'}</div>
          <div style="font-weight:700;color:${rev>0?'#059669':'#cbd5e1'};text-align:right;white-space:nowrap;font-size:13px">${rev>0?fmtBaht(rev,{sym:0}):'-'}</div>
        </div>
        ${expanded?`<div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:8px">
          ${tContracts.sort((a,b)=>(parseBE(b.start)||0)-(parseBE(a.start)||0)).map(c=>{
            const p=ps.find(x=>x.pid===c.pid);
            const s=status(c);
            const sColor={active:'#059669',expiring:'#d97706',expired:'#dc2626',upcoming:'#2563eb',cancelled:'#64748b'}[s]||'#64748b';
            const sLabel={active:'มีผล',expiring:'ใกล้หมด',expired:'หมดอายุ',upcoming:'รอเริ่ม',cancelled:'ยกเลิก'}[s]||s;
            const mo=monthlyRev(c);
            const rS=parseBE(c.start),rE=parseBE(c.end),rNow2=new Date();
            const rTot=rS&&rE?Math.max(1,Math.round((rE-rS)/864e5)):0;
            const rElap=rS?Math.round((rNow2-rS)/864e5):0;
            const rRem=rE?Math.round((rE-rNow2)/864e5):0;
            const rPct=rTot>0?Math.min(100,Math.max(0,Math.round(rElap/rTot*100))):0;
            const rCol=rRem<0?'#dc2626':rRem<=90?'#f59e0b':'#22c55e';
            return`<div class="grid-contracts-subrow" data-cid="${c.id}" onclick="viewContract(${c.id})" oncontextmenu="showCtxMenu(event,${c.id})" onmouseover="this.style.background='#eef2ff'" onmouseout="this.style.background='#fff'">
              <div onclick="event.stopPropagation()"><input type="checkbox" ${cBatchSelect.has(c.id)?'checked':''} style="width:13px;height:13px;cursor:pointer" onclick="handleContractCheck(event,${c.id})" data-cid="${c.id}"></div>
              <div style="width:4px;height:32px;border-radius:2px;background:${sColor}"></div>
              <div style="min-width:0">
                <div style="font-weight:500;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p?esc(p.name):'-'}</div>
                <div style="font-size:10px;color:#64748b">${p?esc(p.location):''} ${c.no?'· '+esc(c.no):''}</div>
              </div>
              <div class="progress-cell" style="min-width:0">
                <div class="pc-dates" style="display:flex;justify-content:space-between;margin-bottom:2px"><span>${fmtBE(c.start)}</span><span style="font-weight:600;color:${rCol}">${rPct}%</span><span>${fmtBE(c.end)}</span></div>
                <div class="pc-bar"><div class="pc-fill" style="width:${rPct}%;background:${rCol}"></div></div>
                <div class="pc-info" style="color:${rCol};margin-top:1px">${rRem<0?Math.abs(rRem)+' วันเกิน':rRem<=0?'หมดวันนี้':'เหลือ '+rRem+' วัน'}</div>
              </div>
              <div style="text-align:center;display:flex;flex-direction:column;gap:2px;align-items:center">
                <span style="font-size:10px;font-weight:600;color:${sColor};background:${sColor}15;padding:2px 7px;border-radius:99px;white-space:nowrap">${sLabel}</span>
                <span onclick="event.stopPropagation();toggleSigned(${c.id})" style="font-size:9px;font-weight:600;cursor:pointer;padding:1px 6px;border-radius:99px;white-space:nowrap;${c.signed?'background:#dcfce7;color:#15803d':'background:#fef2f2;color:#dc2626'}" title="คลิกเพื่อเปลี่ยนสถานะการเซ็น">${c.signed?'เซ็นแล้ว':'ยังไม่เซ็น'}</span>
              </div>
              <div style="font-weight:600;color:${mo>0?'#059669':'#cbd5e1'};text-align:right;font-size:12px">${mo>0?fmtBaht(mo,{sym:0})+' บ.':'-'}</div>
            </div>`;
          }).join('')}
        </div>`:''}
      </div>`;
    }).join('')}
    ${tenants.length>tenantsShown?`<div style="text-align:center;padding:14px;margin-top:8px"><button onclick="showMoreTenants()" style="padding:10px 22px;background:#fff;color:#475569;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">⬇ แสดงเพิ่ม ${Math.min(TENANTS_PER_PAGE,tenants.length-tenantsShown)} ราย <span style="color:#64748b;font-weight:400;margin-left:6px">(แสดง ${tenantsShown}/${tenants.length})</span></button></div>`:''}
    ${tenants.length===0?`<div style="text-align:center;padding:60px 20px;background:#fff;border:2px dashed #e5e7eb;border-radius:12px;margin-top:12px">
      <div style="font-size:48px;margin-bottom:12px">📄</div>
      <div style="font-size:16px;font-weight:700;color:#1e293b;margin-bottom:6px">${DB.contracts.length===0?'ยังไม่มีสัญญา':'ไม่พบสัญญาตามตัวกรอง'}</div>
      <div style="font-size:13px;color:#64748b;margin-bottom:16px">${DB.contracts.length===0?'เริ่มต้นโดยการเพิ่มสัญญาแรก':'ลองล้างตัวกรอง หรือเปลี่ยนคำค้นหา'}</div>
      ${DB.contracts.length===0?'<button onclick="openAddContractDialog()" style="padding:10px 20px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">+ เพิ่มสัญญา</button>':'<button onclick="cFilter.q=\'\';cFilter.st=\'all\';cFilter.cat=\'all\';cFilter.signed=\'all\';renderContracts()" style="padding:8px 16px;background:#f1f5f9;color:#475569;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">ล้างตัวกรอง</button>'}
    </div>`:''}
    </div>`;

  let _cqTimer;
  $('cq').addEventListener('input',e=>{cFilter.q=e.target.value;clearTimeout(_cqTimer);_cqTimer=setTimeout(()=>{const v=cFilter.q;cPage=0;tenantsShown=TENANTS_PER_PAGE;renderContracts();const ne=$('cq');if(ne){ne.value=v;ne.focus();ne.setSelectionRange(v.length,v.length)}},300)});
  $('csf').addEventListener('change',e=>{cFilter.st=e.target.value;cPage=0;tenantsShown=TENANTS_PER_PAGE;renderContracts()});
  if($('csignf'))$('csignf').addEventListener('change',e=>{cFilter.signed=e.target.value;cPage=0;tenantsShown=TENANTS_PER_PAGE;renderContracts()});
}

function toggleAllContracts(checked){
  const cs=DB.contracts;
  // Apply to filtered contracts only
  let fl=cs.slice();
  if(cFilter.q){const q=cFilter.q.toLowerCase();fl=fl.filter(c=>c.tenant?.toLowerCase().includes(q)||c.no?.toLowerCase().includes(q)||c.property?.toLowerCase().includes(q));}
  if(cFilter.st!=='all')fl=fl.filter(c=>status(c)===cFilter.st);
  if(cFilter.signed==='signed')fl=fl.filter(c=>c.signed);
  else if(cFilter.signed==='unsigned')fl=fl.filter(c=>!c.signed);
  if(checked)fl.forEach(c=>cBatchSelect.add(c.id));
  else cBatchSelect.clear();
  renderContracts();
}

function handleTenantCheck(evt,el){
  const ids=el.dataset.cids.split(',').map(Number);
  if(el.checked)ids.forEach(id=>cBatchSelect.add(id));
  else ids.forEach(id=>cBatchSelect.delete(id));
  renderContracts();
}

function handleContractCheck(evt,cid){
  if(evt.shiftKey&&cLastChecked!==null){
    // Get all visible contract IDs in order
    const rows=Array.from(document.querySelectorAll('[data-cid]'));
    const ids=rows.map(r=>+r.dataset.cid);
    const a=ids.indexOf(cLastChecked),b=ids.indexOf(cid);
    if(a!==-1&&b!==-1){
      const start=Math.min(a,b),end=Math.max(a,b);
      for(let i=start;i<=end;i++){
        cBatchSelect.add(ids[i]);
      }
    }
  }else{
    if(cBatchSelect.has(cid))cBatchSelect.delete(cid);
    else cBatchSelect.add(cid);
  }
  cLastChecked=cid;
  renderContracts();
}

function batchPrintContracts(){
  let ids;
  if(cBatchSelect.size>0){
    ids=[...cBatchSelect];
  }else{
    let fl=DB.contracts.slice();
    if(cFilter.q){const q=cFilter.q.toLowerCase();fl=fl.filter(c=>c.tenant?.toLowerCase().includes(q)||c.no?.toLowerCase().includes(q)||c.property?.toLowerCase().includes(q));}
    if(cFilter.st!=='all')fl=fl.filter(c=>status(c)===cFilter.st);
    if(cFilter.signed==='signed')fl=fl.filter(c=>c.signed);
    else if(cFilter.signed==='unsigned')fl=fl.filter(c=>!c.signed);
    ids=fl.map(c=>c.id);
  }
  if(ids.length===0){toast('ไม่มีสัญญาที่จะพิมพ์','error');return;}
  const selected=DB.contracts.filter(c=>ids.includes(c.id));
  openPrintOverlay(selected,'พิมพ์สัญญา — '+selected.length+' ฉบับ');
}

function batchMarkSigned(val){
  cBatchSelect.forEach(id=>{const c=DB.contracts.find(x=>x.id===id);if(c)c.signed=val;});
  save();
  cBatchSelect.clear();
  renderContracts();
  toast(val?'เปลี่ยนเป็นเซ็นแล้ว':'เปลี่ยนเป็นยังไม่เซ็น');
}

// === CONTRACT OVERLAP CHECK ===
function checkContractOverlap(pid,startStr,endStr,excludeId){
  if(!pid||!startStr||!endStr)return[];
  // Skip ทรัพย์สินที่แบ่งให้หลายผู้เช่าได้พร้อมกัน
  if(typeof isMultiTenantProperty==='function' && isMultiTenantProperty(pid))return[];
  const s=parseBE(startStr),e=parseBE(endStr);
  if(!s||!e)return[];
  return DB.contracts.filter(c=>{
    if(c.pid!==+pid)return false;
    if(c.id===excludeId)return false;
    if(c.cancelled)return false;
    const cs=parseBE(c.start),ce=parseBE(c.end);
    if(!cs||!ce)return false;
    // Overlap: requires at least 1 full day of actual overlap (sequential OK)
    if(!(s.getTime()<ce.getTime()&&e.getTime()>cs.getTime()))return false;
    const ov=Math.min(e.getTime(),ce.getTime())-Math.max(s.getTime(),cs.getTime());
    return ov>=86400000;
  });
}

