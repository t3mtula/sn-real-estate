// ========== CONTRACT FORM VALIDATION ==========
function validateContractForm(form){
  // Clear previous errors
  form.querySelectorAll('.field-error').forEach(el=>el.remove());
  form.querySelectorAll('.err-border').forEach(el=>el.classList.remove('err-border'));
  const errors=[];
  function addErr(fieldName,msg){
    errors.push({field:fieldName,msg:msg});
  }
  function getVal(name){return (form.querySelector('[name="'+name+'"]')?.value||'').trim();}

  // 1. ทรัพย์สิน — ต้องเลือก
  const pid=getVal('pid');
  if(!pid) addErr('pid','กรุณาเลือกทรัพย์สิน');

  // 2. ชื่อผู้เช่า — ต้องกรอก
  const tFirst=getVal('tenantFirst');
  if(!tFirst) addErr('tenantFirst','กรุณากรอกชื่อผู้เช่า');

  // 3. วัตถุประสงค์ — ต้องเลือก
  const purpose=getVal('purpose');
  const purposeCustom=getVal('purposeCustom');
  if(!purpose||(purpose==='_custom'&&!purposeCustom)) addErr('purpose','กรุณาเลือกหรือกรอกวัตถุประสงค์');

  // 4. ค่าเช่า — ต้องเป็นตัวเลข > 0
  const rateAmtRaw=getVal('rateAmt');
  const rateNum=parseFloat(rateAmtRaw.replace(/[,\s]/g,''));
  if(!rateAmtRaw) addErr('rateAmt','กรุณากรอกจำนวนค่าเช่า');
  else if(isNaN(rateNum)||rateNum<=0) addErr('rateAmt','ค่าเช่าต้องเป็นตัวเลขมากกว่า 0');

  // 5. วันเริ่มต้น — ต้อง valid พ.ศ. format
  const startStr=getVal('start');
  const startDate=parseBE(startStr);
  if(!startStr) addErr('start','กรุณากรอกวันเริ่มต้น');
  else if(!startDate) addErr('start','รูปแบบวันที่ไม่ถูกต้อง (ใช้ dd/mm/yyyy พ.ศ.)');

  // 6. วันสิ้นสุด — ต้อง valid + หลังวันเริ่ม
  const endStr=getVal('end');
  const endDate=parseBE(endStr);
  if(!endStr) addErr('end','กรุณากรอกวันสิ้นสุด');
  else if(!endDate) addErr('end','รูปแบบวันที่ไม่ถูกต้อง (ใช้ dd/mm/yyyy พ.ศ.)');
  else if(startDate&&endDate&&endDate<=startDate) addErr('end','วันสิ้นสุดต้องหลังวันเริ่มต้น');

  // 7. วันทำสัญญา — ถ้ากรอกต้อง valid
  const dateStr=getVal('date');
  if(dateStr&&!parseBE(dateStr)) addErr('date','รูปแบบวันที่ไม่ถูกต้อง (ใช้ dd/mm/yyyy พ.ศ.)');

  // 8. เลขสัญญา — required + ห้ามเป็น "-" + ห้ามซ้ำ (BLOCK ทั้งหมด)
  const contractNo=getVal('no');
  const editId=form.dataset.editId?+form.dataset.editId:null;
  if(!contractNo){
    addErr('no','กรุณากรอกเลขสัญญา');
  } else if(contractNo==='-'||contractNo==='--'||contractNo==='N/A'||/^[-–—_.]+$/.test(contractNo)){
    addErr('no','เลขสัญญาไม่ถูกต้อง ("'+contractNo+'")');
  } else {
    const dup=DB.contracts.find(c=>(c.no||'').trim()===contractNo&&c.id!==editId);
    if(dup) addErr('no','เลขสัญญานี้ซ้ำกับสัญญาของ "'+(dup.tenant||'?')+'" (ID '+dup.id+')');
  }

  // 9. เงินประกัน — ถ้ากรอกต้องเป็นตัวเลข
  const depositStr=getVal('deposit');
  if(depositStr){
    const depNum=parseFloat(depositStr.replace(/[,\s]/g,''));
    if(isNaN(depNum)) addErr('deposit','เงินประกันต้องเป็นตัวเลข');
  }

  // Show errors
  if(errors.length>0){
    let firstEl=null;
    const blocking=errors.filter(e=>!e.msg.startsWith('⚠'));
    const warnings=errors.filter(e=>e.msg.startsWith('⚠'));

    // Inline field errors
    errors.forEach(err=>{
      const input=form.querySelector('[name="'+err.field+'"]');
      if(!input)return;
      input.classList.add('err-border');
      const errDiv=document.createElement('div');
      errDiv.className='field-error';
      const isWarn=err.msg.startsWith('⚠');
      errDiv.style.cssText='font-size:10px;color:'+(isWarn?'#d97706':'#dc2626')+';margin-top:2px;display:flex;align-items:center;gap:3px';
      errDiv.innerHTML=(isWarn?'':'<svg style="width:11px;height:11px;flex-shrink:0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>')+err.msg;
      input.parentElement.appendChild(errDiv);
      if(!firstEl&&!isWarn)firstEl=input;
    });

    // Summary box at top of form
    const oldBox=form.querySelector('.validate-summary');
    if(oldBox)oldBox.remove();
    const box=document.createElement('div');
    box.className='validate-summary';
    if(blocking.length>0){
      box.style.cssText='background:linear-gradient(135deg,#fef2f2,#fff1f2);border:1px solid #fca5a5;border-radius:10px;padding:12px 14px;margin-bottom:12px;animation:shake .4s';
      box.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><svg style="width:18px;height:18px;color:#dc2626;flex-shrink:0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg><span style="font-size:13px;font-weight:700;color:#991b1b">กรุณาแก้ไข '+blocking.length+' รายการก่อนบันทึก</span></div>'+
        '<div style="display:flex;flex-direction:column;gap:3px;padding-left:26px">'+blocking.map(e=>'<div style="font-size:11px;color:#b91c1c;display:flex;align-items:center;gap:4px"><span style="width:4px;height:4px;background:#dc2626;border-radius:50%;flex-shrink:0"></span>'+e.msg+'</div>').join('')+'</div>';
    }else{
      box.style.cssText='background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fcd34d;border-radius:10px;padding:12px 14px;margin-bottom:12px';
      box.innerHTML='<div style="display:flex;align-items:center;gap:8px"><svg style="width:16px;height:16px;color:#d97706;flex-shrink:0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01"/></svg><span style="font-size:12px;color:#92400e">'+warnings.map(e=>e.msg).join(' · ')+'</span></div>';
    }
    form.prepend(box);
    // Scroll to summary box
    box.scrollIntoView({behavior:'smooth',block:'start'});
    if(blocking.length>0)return false;
    return true;
  }
  return true;
}

// Real-time field validation (called on input/blur)
function liveValidateField(input){
  const name=input.name;
  // Clear existing error on this field
  const prev=input.parentElement.querySelector('.field-error');
  if(prev)prev.remove();
  input.classList.remove('err-border');
  const val=input.value.trim();
  let msg='';
  if(name==='rateAmt'){
    if(val){const n=parseFloat(val.replace(/[,\s]/g,''));if(isNaN(n)||n<=0)msg='ต้องเป็นตัวเลข > 0';}
  }else if(name==='deposit'){
    if(val){const n=parseFloat(val.replace(/[,\s]/g,''));if(isNaN(n))msg='ต้องเป็นตัวเลข';}
  }else if(name==='start'||name==='end'||name==='date'){
    if(val&&!parseBE(val))msg='รูปแบบ dd/mm/yyyy พ.ศ.';
    // Check start < end
    if(!msg&&(name==='start'||name==='end')){
      const form=input.closest('form');
      if(form){
        const sV=form.querySelector('[name="start"]')?.value?.trim();
        const eV=form.querySelector('[name="end"]')?.value?.trim();
        if(sV&&eV){const sd=parseBE(sV),ed=parseBE(eV);if(sd&&ed&&ed<=sd&&name==='end')msg='ต้องหลังวันเริ่มต้น';}
      }
    }
  }
  if(msg){
    input.classList.add('err-border');
    const errDiv=document.createElement('div');
    errDiv.className='field-error';
    errDiv.style.cssText='font-size:10px;color:#dc2626;margin-top:2px';
    errDiv.textContent=msg;
    input.parentElement.appendChild(errDiv);
  }
}

// ตรวจว่าพยานไม่ซ้ำกับผู้เซ็น
function validateSignerWitness(fd){
  const sign=(fd.get('landlordSignerName')||'').trim();
  const w1=(fd.get('witness1Name')||'').trim();
  const w2=(fd.get('witness2Name')||'').trim();
  if(sign&&w1&&sign===w1){toast('พยานคนที่ 1 เป็นคนเดียวกับผู้เซ็นไม่ได้','error');return false;}
  if(sign&&w2&&sign===w2){toast('พยานคนที่ 2 เป็นคนเดียวกับผู้เซ็นไม่ได้','error');return false;}
  if(w1&&w2&&w1===w2){toast('พยาน 2 คนต้องไม่ใช่คนเดียวกัน','error');return false;}
  return true;
}

// เก็บข้อมูลผู้เซ็น พยาน และลายเซ็น ลงในออบเจ็กต์สัญญา
function applySignerFields(target,fd){
  target.landlordSignerName=fd.get('landlordSignerName')||'';
  target.landlordSignerTitle=fd.get('landlordSignerTitle')||'';
  target.witness1Name=fd.get('witness1Name')||'';
  target.witness1Title=fd.get('witness1Title')||'';
  target.witness2Name=fd.get('witness2Name')||'';
  target.witness2Title=fd.get('witness2Title')||'';
  target.landlordSig=fd.get('landlordSig')||'';
  target.tenantSig=fd.get('tenantSig')||'';
  target.witness1Sig=fd.get('witness1Sig')||'';
  target.witness2Sig=fd.get('witness2Sig')||'';
  return target;
}

function confirmOverlapAndSave(pid,startStr,endStr,excludeId,saveFn){
  const overlaps=checkContractOverlap(pid,startStr,endStr,excludeId);
  if(overlaps.length>0){
    const names=overlaps.map(c=>'• '+(c.tenant||'?')+' ('+fmtBE(c.start)+' — '+fmtBE(c.end)+')').join('\n');
    if(!confirm('⚠ ทรัพย์สินนี้มีสัญญาที่ช่วงเวลาซ้อนกัน:\n\n'+names+'\n\n1 แปลง ควรมี 1 ผู้เช่า\nต้องการบันทึกต่อหรือไม่?'))return false;
  }
  saveFn();
  return true;
}

function openAddContractDialog(pid){
  $('mtitle').textContent = 'เพิ่มสัญญาใหม่';
  $('mbody').innerHTML = contractFormHTML('add', null, pid);
  $('contractForm').addEventListener('submit', e => {
    e.preventDefault();
    resolveFormDropdowns(new FormData(e.target));
    if(!validateContractForm(e.target))return;
    const fd = new FormData(e.target);
    resolveFormDropdowns(fd);
    if(!validateSignerWitness(fd))return;
    const thePid=+fd.get('pid');
    confirmOverlapAndSave(thePid,fd.get('start'),fd.get('end'),null,()=>{
      const cid = DB.nextCId++;
      const newContract = {
        id: cid, pid: thePid, no: fd.get('no'), date: normalizeBEDate(fd.get('date') || new Date().toLocaleDateString('th-TH')),
        tenant: fd.get('tenant'), phone: fd.get('phone'), purpose: fd.get('purpose'),
        taxId: fd.get('taxId') || '', branch: fd.get('branch') || '00000', tenantAddr: assembleAddrFromPrefix(fd,'ta'), madeAt: fd.get('madeAt') || '',
        rate: buildRateStr(fd), start: normalizeBEDate(fd.get('start')), end: normalizeBEDate(fd.get('end')),
        dur: fd.get('dur'), deposit: fd.get('deposit'), payment: fd.get('payment'),
        bank: fd.get('bank'), acctNo: fd.get('acctNo'),
        property: DB.properties.find(x => x.pid === thePid)?.name || '',
        area: fd.get('area') || '', spot: fd.get('spot') || '', landlord: shortLandlordName(fd.get('landlord') || ''), landlordAddr: assembleAddrFromPrefix(fd,'la'),
        accountName: fd.get('accountName') || '', rateAdj: fd.get('rateAdj') || '',
        dueDay: clampInt(fd.get('dueDay'),{min:1,max:31,def:5}),
        invHeaderId: fd.get('invHeaderId') || null,
        tenantLogo: fd.get('tenantLogo') || null,
        cancelled: false
      };
      applySignerFields(newContract,fd);
      DB.contracts.push(newContract);
      addActivityLog('add_contract','เพิ่มสัญญา '+(newContract.no||'#'+cid)+' — '+newContract.tenant);
      createDepositInvoice(cid);
      const _dep1=getContractDeposit(newContract);
      if(_dep1>0) addDepositLedger({cid,type:'in',amount:_dep1,date:newContract.start,note:'รับเงินประกันตอนเริ่มสัญญา',refId:'contract-'+cid});
      save(); closeModal(true); toast('เพิ่มสัญญาแล้ว');
      if (pid) openPropertyDetail(pid); else renderContracts();
    });
  });
  $('modal').classList.remove('hidden');
  setTimeout(()=>{enhanceDatalistInputs($('mbody'));const hs=document.getElementById('cfHeaderSelect');if(hs&&hs.value&&hs.value!=='')cfSelectHeader(hs.value);},50);
}

function editContract(cid) {
  viewContract(cid);
}

function renewContract(cid) {
  const c = DB.contracts.find(x => x.id === cid);
  if (!c) return;
  $('mtitle').textContent = 'ต่อสัญญา — ' + c.tenant;
  $('mbody').innerHTML = contractFormHTML('renew', c);
  setTimeout(cfCalcEndFromDur, 50); // Auto-calc end date on load
  $('contractForm').addEventListener('submit', e => {
    e.preventDefault();
    resolveFormDropdowns(new FormData(e.target));
    if(!validateContractForm(e.target))return;
    const fd = new FormData(e.target);
    resolveFormDropdowns(fd);
    if(!validateSignerWitness(fd))return;
    const thePid=+fd.get('pid');
    confirmOverlapAndSave(thePid,fd.get('start'),fd.get('end'),null,()=>{
      const newId = DB.nextCId++;
      const newContract = {
        id: newId, pid: thePid, no: fd.get('no'), date: normalizeBEDate(fd.get('date') || new Date().toLocaleDateString('th-TH')),
        tenant: fd.get('tenant'), phone: fd.get('phone'), purpose: fd.get('purpose'),
        taxId: fd.get('taxId') || '', branch: fd.get('branch') || '00000', tenantAddr: assembleAddrFromPrefix(fd,'ta'), madeAt: fd.get('madeAt') || '',
        rate: buildRateStr(fd), start: normalizeBEDate(fd.get('start')), end: normalizeBEDate(fd.get('end')),
        dur: fd.get('dur'), deposit: fd.get('deposit'), payment: fd.get('payment'),
        bank: fd.get('bank'), acctNo: fd.get('acctNo'),
        property: DB.properties.find(x => x.pid === thePid)?.name || '',
        area: fd.get('area') || '', spot: fd.get('spot') || '', landlord: shortLandlordName(fd.get('landlord') || ''), landlordAddr: assembleAddrFromPrefix(fd,'la'),
        accountName: fd.get('accountName') || '', rateAdj: fd.get('rateAdj') || '',
        dueDay: clampInt(fd.get('dueDay'),{min:1,max:31,def:5}),
        renewedFrom: cid,
        invHeaderId: fd.get('invHeaderId') || null,
        tenantLogo: fd.get('tenantLogo') || null,
        cancelled: false
      };
      applySignerFields(newContract,fd);
      DB.contracts.push(newContract);
      addActivityLog('renew_contract','ต่อสัญญา '+(newContract.no||'#'+newId)+' — '+newContract.tenant);
      createDepositInvoice(newId);
      const _dep2=getContractDeposit(newContract);
      if(_dep2>0) addDepositLedger({cid:newId,type:'in',amount:_dep2,date:newContract.start,note:'รับเงินประกันตอนเริ่มสัญญา (ต่อสัญญา)',refId:'contract-'+newId});
      save(); closeModal(true); toast('สร้างสัญญาต่อสำเร็จ');
      renderContracts();
    });
  });
  $('modal').classList.remove('hidden');
  setTimeout(()=>{enhanceDatalistInputs($('mbody'));const hs=document.getElementById('cfHeaderSelect');if(hs&&hs.value&&hs.value!=='')cfSelectHeader(hs.value);},50);
}

function copyContract(cid) {
  const c = DB.contracts.find(x => x.id === cid);
  if (!c) return;
  $('mtitle').textContent = 'คัดลอกสัญญา — จาก ' + (c.no||c.tenant);
  $('mbody').innerHTML = contractFormHTML('copy', c);
  setTimeout(cfCalcEndFromDur, 50); // Auto-calc end date on load
  $('contractForm').addEventListener('submit', e => {
    e.preventDefault();
    resolveFormDropdowns(new FormData(e.target));
    if(!validateContractForm(e.target))return;
    const fd = new FormData(e.target);
    resolveFormDropdowns(fd);
    if(!validateSignerWitness(fd))return;
    const thePid=+fd.get('pid');
    confirmOverlapAndSave(thePid,fd.get('start'),fd.get('end'),null,()=>{
      const newId = DB.nextCId++;
      const newContract = {
        id: newId, pid: thePid, no: fd.get('no'), date: normalizeBEDate(fd.get('date') || new Date().toLocaleDateString('th-TH')),
        tenant: fd.get('tenant'), phone: fd.get('phone'), purpose: fd.get('purpose'),
        taxId: fd.get('taxId') || '', branch: fd.get('branch') || '00000', tenantAddr: assembleAddrFromPrefix(fd,'ta'), madeAt: fd.get('madeAt') || '',
        rate: buildRateStr(fd), start: normalizeBEDate(fd.get('start')), end: normalizeBEDate(fd.get('end')),
        dur: fd.get('dur'), deposit: fd.get('deposit'), payment: fd.get('payment'),
        bank: fd.get('bank'), acctNo: fd.get('acctNo'),
        property: DB.properties.find(x => x.pid === thePid)?.name || '',
        area: fd.get('area') || '', spot: fd.get('spot') || '', landlord: shortLandlordName(fd.get('landlord') || ''), landlordAddr: assembleAddrFromPrefix(fd,'la'),
        accountName: fd.get('accountName') || '', rateAdj: fd.get('rateAdj') || '', deed: fd.get('deed') || '',
        dueDay: clampInt(fd.get('dueDay'),{min:1,max:31,def:5}),
        copiedFrom: cid,
        invHeaderId: fd.get('invHeaderId') || null,
        tenantLogo: fd.get('tenantLogo') || null,
        cancelled: false
      };
      applySignerFields(newContract,fd);
      DB.contracts.push(newContract);
      addActivityLog('copy_contract','คัดลอกสัญญา '+(newContract.no||'#'+newId)+' — '+newContract.tenant);
      createDepositInvoice(newId);
      const _dep3=getContractDeposit(newContract);
      if(_dep3>0) addDepositLedger({cid:newId,type:'in',amount:_dep3,date:newContract.start,note:'รับเงินประกันตอนเริ่มสัญญา (คัดลอก)',refId:'contract-'+newId});
      save(); closeModal(true); toast('คัดลอกสัญญาสำเร็จ');
      viewContract(newId);
    });
  });
  $('modal').classList.remove('hidden');
  setTimeout(()=>{enhanceDatalistInputs($('mbody'));const hs=document.getElementById('cfHeaderSelect');if(hs&&hs.value&&hs.value!=='')cfSelectHeader(hs.value);},50);
}

function deleteContract(cid) {
  if(!hasPermission('delete')){toast('คุณไม่มีสิทธิ์ลบสัญญา','error');return;}
  const c = DB.contracts.find(x => x.id === cid);
  if(!c)return;
  const reason=prompt('กรุณาระบุเหตุผลในการลบสัญญา "'+( c.no||c.tenant)+'":\n(เช่น ข้อมูลซ้ำ, กรอกผิด, ทดสอบ)\n\nยกเลิก = ไม่ลบ');
  if(!reason||!reason.trim())return;
  if(!confirm('ยืนยันลบสัญญา "'+( c.no||c.tenant)+'" ?\n\nเหตุผล: '+reason+'\n\n** การลบจะไม่สามารถกู้คืนได้ **'))return;
  // Log the deletion (before action — caller layer responsibility)
  addActivityLog('delete_contract','ลบสัญญา '+(c.no||'#'+c.id)+' — '+c.tenant,{reason:reason.trim(),contract:JSON.parse(JSON.stringify(c))});
  // Decide invoice cascade
  const orphanInvs=(DB.invoices||[]).filter(x=>x.cid===cid);
  let alsoInvoices=false;
  if(orphanInvs.length>0){
    alsoInvoices=confirm(`พบใบแจ้งหนี้ ${orphanInvs.length} ใบที่ผูกกับสัญญานี้\nต้องการลบใบแจ้งหนี้เหล่านี้ด้วยหรือไม่?`);
  }
  // Action layer — single cascade delete
  const result=actionDeleteContract(cid,{alsoDeleteInvoices:alsoInvoices});
  if(!result)return;
  const pid=result.pid;
  if(result.invoicesRemoved>0){
    addActivityLog('delete_orphan_invoices',`ลบใบแจ้งหนี้ ${result.invoicesRemoved} ใบที่ผูกกับสัญญา #${cid}`);
  }
  toast('ลบสัญญาแล้ว — บันทึกใน Log');
  closeModal(true);
  if (pid) openPropertyDetail(pid);
  else renderContracts();
}

// Build contract form HTML — mode: 'add', 'edit', 'renew', 'copy'
function contractFormHTML(mode, c, pid) {
  const isEdit = mode === 'edit';
  const isRenew = mode === 'renew';
  const isCopy = mode === 'copy';
  const p = pid ? DB.properties.find(x => x.pid === pid) : (c ? DB.properties.find(x => x.pid === c.pid) : null);

  // Collect unique values from existing contracts for dropdowns/datalists
  const tenants = [...new Set(DB.contracts.map(x => x.tenant).filter(Boolean))].sort();
  const phones = {};
  DB.contracts.forEach(x => { if (x.tenant && x.phone) phones[x.tenant] = x.phone; });
  const purposes = [...new Set(DB.contracts.map(x => x.purpose).filter(Boolean))].sort();
  const banks = [...new Set(DB.contracts.map(x => x.bank).filter(Boolean))].sort();
  const landlords = [...new Set(DB.contracts.map(x => x.landlord).filter(Boolean))].sort();
  const accountNames = [...new Set(DB.contracts.map(x => x.accountName).filter(Boolean))].sort();
  const payments = [...new Set(DB.contracts.map(x => x.payment).filter(Boolean))].sort();

  // For 'add' mode with pid: find latest contract on this property to pre-fill
  const prevContract = (!c && pid) ? DB.contracts.filter(x => x.pid === pid).sort((a,b) => b.id - a.id)[0] : null;

  const v = (field) => {
    if (isEdit && c) return c[field] || '';
    if (isRenew && c) return c[field] || '';
    if (isCopy && c) {
      if (field === 'no') return '';
      if (field === 'date') return '';
      return c[field] || '';
    }
    // Add mode with previous contract on same property: pre-fill most fields
    if (prevContract) {
      if (field === 'no' || field === 'date' || field === 'start' || field === 'end' || field === 'dur') return '';
      return prevContract[field] || '';
    }
    return '';
  };

  return `
    <form id="contractForm" class="space-y-3" style="max-height:70vh;overflow-y:auto;padding-right:4px">
      <!-- Datalists for autocomplete -->
      <datalist id="dl_tenants">${tenants.map(t => '<option value="' + t + '">').join('')}</datalist>
      <datalist id="dl_purposes">${purposes.map(t => '<option value="' + t + '">').join('')}</datalist>
      <datalist id="dl_banks">${banks.map(t => '<option value="' + t + '">').join('')}</datalist>
      <datalist id="dl_landlords">${landlords.map(t => '<option value="' + t + '">').join('')}</datalist>
      <datalist id="dl_accountNames">${accountNames.map(t => '<option value="' + t + '">').join('')}</datalist>
      <datalist id="dl_payments">${payments.map(t => '<option value="' + t + '">').join('')}</datalist>

      ${isRenew ? '<div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 mb-2">ต่อสัญญาจาก: <strong>' + (c?.tenant || '') + '</strong> — ' + (c?.no || '') + ' (ข้อมูลเดิมถูกเติมให้แล้ว แก้ไขได้ตามต้องการ)</div>' : ''}
      ${isCopy ? '<div class="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-700 mb-2"><strong>คัดลอกจาก:</strong> ' + (c?.no || '') + ' — ' + (c?.tenant || '') + '<br>ข้อมูลทั้งหมดถูกเติมให้แล้ว กรุณาใส่เลขที่สัญญาใหม่ และแก้ไขข้อมูลที่ต้องเปลี่ยน</div>' : ''}
      ${prevContract ? '<div class="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700 mb-2">ดึงข้อมูลจากสัญญาเดิม: <strong>' + (prevContract.tenant || '') + '</strong> — ' + (prevContract.no || '') + '<br>ผู้เช่า ผู้ให้เช่า ธนาคาร ฯลฯ ถูกเติมให้แล้ว กรุณาใส่เลขสัญญา วันที่ และระยะเวลาใหม่</div>' : ''}

      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2">
          <label class="text-xs font-medium text-gray-600 mb-1 block">ทรัพย์สิน <span class="text-red-400">*</span></label>
          ${(isRenew||isCopy||isEdit) && p
            ? `<div style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:8px">
                <svg style="width:16px;height:16px;color:#6366f1;flex-shrink:0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                <span style="font-size:14px;font-weight:600;color:#1e293b">${p.name} (${p.location})</span>
                <span style="font-size:10px;color:#64748b;margin-left:auto">ล็อกไว้ — ไม่สามารถเปลี่ยนทรัพย์สินได้</span>
              </div>
              <input type="hidden" name="pid" value="${p.pid}">`
            : `<select name="pid" required class="w-full px-3 py-2 border rounded-lg text-sm" onchange="cfAutoFillProp(this.value)">
                <option value="">— เลือกทรัพย์สิน —</option>
                ${DB.properties.map(pp => '<option value="' + pp.pid + '" ' + (pid === pp.pid ? 'selected' : '') + '>' + pp.name + ' (' + pp.location + ')' + '</option>').join('')}
              </select>`}
        </div>

        <div>
          <label class="text-xs font-medium text-gray-600 mb-1 block">เลขที่สัญญา</label>
          <div class="flex gap-2">
            <input type="text" name="no" value="${isRenew ? '' : v('no')}" class="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="${isRenew ? 'เลขสัญญาใหม่' : ''}">
            <button type="button" onclick="cfGenContractNo()" class="px-3 py-2 border rounded-lg text-xs text-indigo-600 hover:bg-indigo-50 flex-shrink-0 whitespace-nowrap">สร้างเลข</button>
          </div>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-600 mb-1 block">วันทำสัญญา</label>
          <div style="position:relative"><input type="text" name="date" value="${v('date')}" class="w-full px-3 py-2 pr-9 border rounded-lg text-sm" placeholder="dd/mm/yyyy พ.ศ." onblur="liveValidateField(this)"><span onclick="openThaiDP(this.previousElementSibling)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:16px;color:#64748b" title="เลือกวันที่">📅</span></div>
        </div>
        <div class="col-span-2">
          <label class="text-xs font-medium text-gray-600 mb-1 block">ทำที่ <span style="font-weight:400;color:#64748b">(ดึงจากที่อยู่ผู้ให้เช่าอัตโนมัติ)</span></label>
          <input type="text" name="madeAt" id="cfMadeAt" value="${v('madeAt')}" class="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50" placeholder="จะดึงจากที่อยู่ผู้ให้เช่าอัตโนมัติ" readonly>
        </div>
      </div>

      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin-top:4px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <div style="width:3px;height:18px;background:#6366f1;border-radius:2px"></div>
          <span style="font-size:13px;font-weight:700;color:#1e293b">ข้อมูลผู้เช่า</span>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2">
            <label class="text-xs font-medium text-gray-600 mb-1 block">ชื่อผู้เช่า <span class="text-red-400">*</span></label>
            ${(()=>{
              const full=v('tenant');
              // Parse existing name into prefix/first/last
              const prefixes=['นาย','นาง','นางสาว','บริษัท','ห้างหุ้นส่วนจำกัด','ห้างหุ้นส่วนสามัญ','น.ส.','ม.ร.ว.','ม.ล.','ศ.','ผศ.','รศ.','ดร.','พล.ท.','พล.ต.','พ.อ.','พ.ท.','ร.ต.','ว่าที่ ร.ต.'];
              let curPrefix='',curFirst='',curLast='';
              if(full){
                for(const pf of prefixes){if(full.startsWith(pf)){curPrefix=pf;let rest=full.slice(pf.length).trim();const parts=rest.split(/\s+/);if(parts.length>=2){curLast=parts.pop();curFirst=parts.join(' ');}else{curFirst=rest;}break;}}
                if(!curPrefix){const parts=full.split(/\s+/);if(parts.length>=2){curLast=parts.pop();curFirst=parts.join(' ');}else{curFirst=full;}}
              }
              return `<div style="display:grid;grid-template-columns:120px 1fr 1fr;gap:6px">
                <div>
                  <select name="tenantPrefix" class="w-full px-2 py-2 border rounded-lg text-sm">
                    <option value="">คำนำหน้า</option>
                    ${['นาย','นาง','นางสาว','บริษัท','ห้างหุ้นส่วนจำกัด'].map(pf=>'<option value="'+pf+'" '+(curPrefix===pf?'selected':'')+'>'+pf+'</option>').join('')}
                  </select>
                </div>
                <div>
                  <input type="text" name="tenantFirst" value="${(curFirst||'').replace(/"/g,'&quot;')}" required aria-autocomplete="list" list="dl_tenants" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="ชื่อ" onchange="cfAutoFillTenant(cfBuildTenantName())">
                </div>
                <div>
                  <input type="text" name="tenantLast" value="${(curLast||'').replace(/"/g,'&quot;')}" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="นามสกุล / จำกัด">
                </div>
              </div>
              <input type="hidden" name="tenant" value="${(full||'').replace(/"/g,'&quot;')}">`;
            })()}
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 mb-1 block">เลขบัตรประชาชน / เลขผู้เสียภาษี <span style="color:#dc2626">*</span> <span class="text-gray-400 font-normal">(จำเป็นสำหรับใบกำกับภาษี)</span></label>
            <input type="text" name="taxId" value="${v('taxId')}" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="เช่น 1-2345-67890-12-3" maxlength="17" oninput="cfFormatThaiId(this)">
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 mb-1 block">สาขา <span class="text-gray-400 font-normal">(ใบกำกับภาษี)</span></label>
            ${(()=>{const br=v('branch')||'00000';const isHead=br==='00000';return `
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:7px 0">
              <label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer;color:#374151">
                <input type="radio" name="branchType" value="head" ${isHead?'checked':''} onchange="cfBranchChange()" style="cursor:pointer">
                สำนักงานใหญ่
              </label>
              <label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer;color:#374151">
                <input type="radio" name="branchType" value="branch" ${!isHead?'checked':''} onchange="cfBranchChange()" style="cursor:pointer">
                สาขา
              </label>
              <input type="text" id="cfBranchNo" placeholder="เลขสาขา" maxlength="5" value="${isHead?'':br}" oninput="cfBranchSync()" onblur="cfBranchSync()" style="${isHead?'display:none;':''}flex:1;min-width:90px;padding:5px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px">
            </div>
            <input type="hidden" name="branch" id="cfBranchHidden" value="${br}">`;})()}
          </div>
          <div class="col-span-2">
            <label class="text-xs font-medium text-gray-600 mb-1 block">โทรศัพท์</label>
            <input type="text" name="phone" value="${v('phone')}" class="w-full px-3 py-2 border rounded-lg text-sm" id="cfPhone" placeholder="เช่น 081-234-5678">
          </div>
          <div class="col-span-2">
            <label class="text-xs font-medium text-gray-600 mb-1 block">ที่อยู่ผู้เช่า <span style="color:#dc2626">*</span> <span class="text-gray-400 font-normal">(จำเป็นสำหรับใบกำกับภาษี)</span></label>
            ${buildAddrSubFields('ta', v('tenantAddr'))}
          </div>
          <div class="col-span-2">
            <label class="text-xs font-medium text-gray-600 mb-1 block">โลโก้/รูปผู้เช่า <span style="font-weight:400;color:#64748b">(ไม่บังคับ — แสดงในใบแจ้งหนี้)</span></label>
            <div style="display:flex;align-items:center;gap:12px">
              <input type="file" accept="image/*" onchange="cfUploadTenantLogo(this)" style="font-size:12px;flex:1">
              <div id="cfTenantLogoPreview">${v('tenantLogo')?'<img src="'+v('tenantLogo')+'" style="width:40px;height:40px;object-fit:contain;border-radius:6px;border:1px solid #e5e7eb">':''}</div>
              <input type="hidden" name="tenantLogo" value="${(v('tenantLogo')||'').replace(/"/g,'&quot;')}">
            </div>
          </div>
        </div>
      </div>

      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin-top:4px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <div style="width:3px;height:18px;background:#0891b2;border-radius:2px"></div>
          <span style="font-size:13px;font-weight:700;color:#1e293b">รายละเอียดสัญญา</span>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2">
            <label class="text-xs font-medium text-gray-600 mb-1 block">วัตถุประสงค์ <span class="text-red-400">*</span></label>
            <select name="purpose" required class="w-full px-3 py-2 border rounded-lg text-sm" onchange="if(this.value==='_custom'){this.style.display='none';this.nextElementSibling.style.display='';this.nextElementSibling.focus();}">
              <option value="">— เลือก —</option>
              ${purposes.map(p=>'<option value="'+p.replace(/"/g,'&quot;')+'" '+(v('purpose')===p?'selected':'')+'>'+p+'</option>').join('')}
              <option value="_custom">+ พิมพ์เอง...</option>
            </select>
            <input type="text" style="display:none" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" placeholder="พิมพ์วัตถุประสงค์" name="purposeCustom">
          </div>
          <div class="col-span-2">
            <label class="text-xs font-medium text-gray-600 mb-1 block">อัตราค่าเช่า <span class="text-red-400">*</span></label>
            <div style="display:flex;gap:6px;align-items:center">
              <div style="display:flex;gap:1px;background:#e2e8f0;border-radius:8px;overflow:hidden;flex-shrink:0">
                ${['วันละ','เดือนละ','ไตรมาสละ','ครึ่งปีละ','ปีละ','เหมาจ่าย'].map(opt=>{
                  const isActive=v('rate').includes(opt)||(opt==='เดือนละ'&&!v('rate'));
                  return '<label style="padding:7px 10px;font-size:12px;cursor:pointer;background:'+(isActive?'#4f46e5':'#fff')+';color:'+(isActive?'#fff':'#475569')+';display:flex;align-items:center;gap:3px;transition:all .15s"><input type="radio" name="ratePrefix" value="'+opt+'" '+(isActive?'checked':'')+' style="display:none" onchange="this.closest(\'div\').querySelectorAll(\'label\').forEach(l=>{l.style.background=\'#fff\';l.style.color=\'#475569\'});this.parentElement.style.background=\'#4f46e5\';this.parentElement.style.color=\'#fff\'">'+opt+'</label>';
                }).join('')}
              </div>
              <input type="text" name="rateAmt" value="${(()=>{const m=v('rate').match(/([\d,]+(?:\.\d+)?)\s*(?:\.?-?\s*บาท|บาท)/);if(m)return m[1];const m2=v('rate').match(/(?:เดือนละ|ไตรมาสละ|ปีละ|วันละ|ครึ่งปีละ|เหมาจ่าย|งวดละ)\s*([\d,]+)/);return m2?m2[1]:'';})()}" required class="flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="จำนวนเงิน เช่น 114,000" style="min-width:120px" oninput="liveValidateField(this)">
              <span style="flex-shrink:0;font-size:13px;color:#64748b">บาท</span>
            </div>
          </div>
          <div class="col-span-2" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px">
            <div style="font-size:11px;font-weight:600;color:#64748b;margin-bottom:8px">ระยะเวลาเช่า</div>
            <div style="display:grid;grid-template-columns:auto 1fr 1fr 1fr;gap:8px;align-items:end">
              <div>
                <label class="text-xs text-gray-500 mb-1 block">ระยะเวลา</label>
                <div style="display:flex;gap:4px">
                  <input type="number" name="durYears" value="${(()=>{const m=v('dur').match(/(\d+)\s*ปี/);return m?m[1]:'';})()}" min="0" class="px-2 py-2 border rounded-lg text-sm" style="width:52px" placeholder="0" onchange="cfCalcEndFromDur()">
                  <span style="font-size:12px;color:#64748b;align-self:center">ปี</span>
                  <input type="number" name="durMonths" value="${(()=>{const m=v('dur').match(/(\d+)\s*เดือน/);return m?m[1]:'';})()}" min="0" max="11" class="px-2 py-2 border rounded-lg text-sm" style="width:52px" placeholder="0" onchange="cfCalcEndFromDur()">
                  <span style="font-size:12px;color:#64748b;align-self:center">เดือน</span>
                </div>
              </div>
              <div>
                <label class="text-xs text-gray-500 mb-1 block">วันเริ่มต้น <span class="text-red-400">*</span></label>
                <div style="position:relative"><input type="text" name="start" value="${isRenew ? cfTodayBE() : v('start')}" required class="w-full px-3 py-2 pr-9 border rounded-lg text-sm" placeholder="dd/mm/yyyy" onchange="cfCalcEndFromDur()" onblur="liveValidateField(this)"><span onclick="openThaiDP(this.previousElementSibling)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:14px;color:#64748b" title="เลือกวันที่">📅</span></div>
              </div>
              <div>
                <label class="text-xs text-gray-500 mb-1 block">วันสิ้นสุด <span class="text-red-400">*</span></label>
                <div style="position:relative"><input type="text" name="end" value="${isRenew ? '' : v('end')}" required class="w-full px-3 py-2 pr-9 border rounded-lg text-sm" placeholder="dd/mm/yyyy" onchange="cfCalcDurFromEnd()" onblur="liveValidateField(this)"><span onclick="openThaiDP(this.previousElementSibling)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:14px;color:#64748b" title="เลือกวันที่">📅</span></div>
              </div>
              <div>
                <div id="cfDurSummary" style="font-size:11px;color:#64748b;padding:8px 0"></div>
              </div>
            </div>
            <input type="hidden" name="dur" value="${v('dur')}">
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 mb-1 block">เงินประกัน</label>
            <input type="text" name="deposit" value="${(()=>{const d=v('deposit');const n=parseFloat(String(d).replace(/[^\d.]/g,''));return !isNaN(n)&&n?fmtBaht(n,{sym:0}):d;})()}" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="เช่น 50,000" onblur="cfFormatDeposit(this)" oninput="liveValidateField(this)">
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 mb-1 block">พื้นที่ <span style="font-weight:400;color:#64748b">(ดึงจากทรัพย์สิน)</span></label>
            <input type="text" name="area" value="${v('area') || (p ? p.area : '')}" class="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50" id="cfArea" readonly placeholder="เลือกทรัพย์สินด้านบนเพื่อดึงข้อมูล">
          </div>
          <div class="col-span-2">
            <label class="text-xs font-medium text-gray-600 mb-1 block">จุด/ตำแหน่งบนทรัพย์ <span style="font-weight:400;color:#64748b">(ถ้าทรัพย์ปล่อยหลายจุด)</span></label>
            <input type="text" name="spot" id="cfSpot" list="cfSpotList" value="${v('spot')||''}" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="เช่น ล็อก A, ห้อง 1, ป้ายหน้า, ชั้น 2">
            <datalist id="cfSpotList">
              ${(() => {
                const curPid = p ? p.pid : null;
                if (!curPid) return '';
                const spots = Array.from(new Set((DB.contracts||[]).filter(x => x.pid === curPid && x.spot).map(x => x.spot)));
                return spots.map(s => '<option value="'+s.replace(/"/g,'&quot;')+'">').join('');
              })()}
            </datalist>
          </div>
        </div>
      </div>

      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin-top:4px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <div style="width:3px;height:18px;background:#059669;border-radius:2px"></div>
          <span style="font-size:13px;font-weight:700;color:#1e293b">การชำระเงิน / ผู้ให้เช่า</span>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="col-span-2">
            <label class="text-xs font-medium text-gray-600 mb-1 block">วิธีชำระ</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div>
                <label class="text-xs text-gray-500 mb-1 block">กำหนดชำระ</label>
                <select name="paySchedule" class="w-full px-3 py-2 border rounded-lg text-sm" onchange="cfUpdatePayment()">
                  ${['ล่วงหน้า','ทุกเดือน','รายไตรมาส','รายปี','ตามสัญญา'].map(opt=>{
                    const isActive=v('payment').includes(opt);
                    return '<option value="'+opt+'" '+(isActive?'selected':'')+'>'+opt+'</option>';
                  }).join('')}
                </select>
              </div>
              <div>
                <label class="text-xs text-gray-500 mb-1 block">ช่องทาง</label>
                <select name="payChannel" class="w-full px-3 py-2 border rounded-lg text-sm" onchange="cfUpdatePayment()">
                  ${['โอนเงิน','เงินสด','เช็ค','อื่นๆ'].map(opt=>{
                    const isActive=v('payment').includes(opt);
                    return '<option value="'+opt+'" '+(isActive?'selected':'')+'>'+opt+'</option>';
                  }).join('')}
                </select>
              </div>
            </div>
            <input type="text" name="payNote" value="${(()=>{const p=v('payment');const kw=['ล่วงหน้า','ทุกเดือน','รายไตรมาส','รายปี','ตามสัญญา','โอนเงิน','เงินสด','เช็ค','อื่นๆ'];let r=p;kw.forEach(k=>{r=r.replace(k,'')});return r.replace(/[·,\s]+/g,' ').trim();})()}" class="w-full px-3 py-2 border rounded-lg text-sm mt-2" placeholder="รายละเอียดเพิ่มเติม เช่น ภายในวันที่ 5 ของทุกเดือน / ชำระทั้งหมดในวันเซ็นสัญญา">
            <input type="hidden" name="payment" value="${v('payment')}">
            <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
              <label class="text-xs text-gray-500 whitespace-nowrap">📅 วันครบกำหนดใบแจ้งหนี้ วันที่</label>
              <input type="number" name="dueDay" min="1" max="31" value="${v('dueDay')||5}" class="px-3 py-2 border rounded-lg text-sm" style="width:72px;text-align:center">
              <span class="text-xs text-gray-400">ของทุกเดือน (1–31 · เดือนสั้นใช้วันสุดท้าย)</span>
            </div>
          </div>
          <div class="col-span-2">
            <label class="text-xs font-medium text-gray-600 mb-1 block">ผู้ให้เช่า / บริษัท <span style="font-weight:400;color:#6366f1">(ดึงข้อมูลอัตโนมัติจากตั้งค่า)</span></label>
            <select id="cfHeaderSelect" class="w-full px-3 py-2 border rounded-lg text-sm" onchange="cfSelectHeader(this.value)" style="border-color:#6366f1;background:#faf5ff">
              <option value="">— เลือกผู้ให้เช่า/บริษัท —</option>
              ${(DB.invoiceHeaders||[]).map(h=>{
                const sel=v('invHeaderId')==h.id||((!v('invHeaderId'))&&v('landlord')===h.companyName)?'selected':'';
                return '<option value="'+h.id+'" '+sel+'>'+h.name+' — '+(h.companyName||'')+'</option>';
              }).join('')}
              <option value="_manual">+ กรอกเอง (ไม่ใช้ข้อมูลจากระบบ)</option>
            </select>
            <input type="hidden" name="invHeaderId" id="cfInvHeaderId" value="${v('invHeaderId')||''}">
            <div id="cfHeaderPreview" style="margin-top:8px;display:none;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px 14px;font-size:12px;color:#166534"></div>
          </div>

          <div id="cfManualLandlordSection" style="display:none" class="col-span-2">
            <div class="grid grid-cols-1 gap-3">
              <div>
                <label class="text-xs font-medium text-gray-600 mb-1 block">ผู้ให้เช่า (ลงนาม)</label>
                <select name="landlord" class="w-full px-3 py-2 border rounded-lg text-sm" onchange="cfSelectLandlord(this.value)">
                  <option value="">— เลือก —</option>
                  ${landlords.map(l=>'<option value="'+l.replace(/"/g,'&quot;')+'" '+(v('landlord')===l?'selected':'')+'>'+l+'</option>').join('')}
                  <option value="_custom">+ พิมพ์เอง...</option>
                </select>
                <input type="text" id="cfLandlordCustom" style="display:none" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" placeholder="พิมพ์ชื่อผู้ให้เช่า" name="landlordCustom">
              </div>
              <div id="cfLandlordAddrWrap">
                <label class="text-xs font-medium text-gray-600 mb-1 block">ที่อยู่ผู้ให้เช่า</label>
                <div id="cfLandlordAddrDisplay" style="background:#f1f5f9;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;font-size:13px;color:#475569;min-height:38px">${v('landlordAddr')||'<span style="color:#64748b">เลือกผู้ให้เช่าด้านบนเพื่อดึงที่อยู่</span>'}</div>
              </div>
            </div>
          </div>
          <input type="hidden" name="bank" value="${v('bank')}">
          <input type="hidden" name="acctNo" value="${v('acctNo')}">
          <input type="hidden" name="accountName" value="${v('accountName')}">
          <input type="hidden" name="la_line" value="${(()=>{const ap=parseAddrParts(v('landlordAddr'));return ap.addrLine||'';})()}">
          <input type="hidden" name="la_sd" value="${(()=>{const ap=parseAddrParts(v('landlordAddr'));return ap.subDistrict||'';})()}">
          <input type="hidden" name="la_dt" value="${(()=>{const ap=parseAddrParts(v('landlordAddr'));return ap.district||'';})()}">
          <input type="hidden" name="la_pv" value="${(()=>{const ap=parseAddrParts(v('landlordAddr'));return ap.province||'';})()}">
          <input type="hidden" name="la_zip" value="${(()=>{const ap=parseAddrParts(v('landlordAddr'));return ap.zip||'';})()}">
          <div class="col-span-2">
            <label class="text-xs font-medium text-gray-600 mb-1 block">การปรับค่าเช่า</label>
            ${(()=>{
              const cur=v('rateAdj');
              const presets=['ไม่ปรับตลอดสัญญา','ปรับเพิ่ม 5% ทุกปี','ปรับเพิ่ม 10% ทุก 3 ปี','ปรับเพิ่ม 10% ทุก 5 ปี','ปรับตามข้อตกลง'];
              const isPreset=presets.includes(cur);
              return `<select name="rateAdjPreset" class="w-full px-3 py-2 border rounded-lg text-sm" onchange="if(this.value==='_custom'){this.nextElementSibling.style.display='';this.nextElementSibling.focus();}else{this.nextElementSibling.style.display='none';document.querySelector('[name=rateAdj]').value=this.value;}">
                <option value="">— เลือก —</option>
                ${presets.map(p=>'<option value="'+p+'" '+(cur===p?'selected':'')+'>'+p+'</option>').join('')}
                <option value="_custom" ${cur&&!isPreset?'selected':''}>+ พิมพ์เอง...</option>
              </select>
              <input type="text" name="rateAdjCustom" style="display:${cur&&!isPreset?'':'none'}" value="${cur&&!isPreset?(cur||'').replace(/"/g,'&quot;'):''}" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" placeholder="พิมพ์รายละเอียดการปรับค่าเช่า" oninput="document.querySelector('[name=rateAdj]').value=this.value">
              <input type="hidden" name="rateAdj" value="${(cur||'').replace(/"/g,'&quot;')}">`;
            })()}
          </div>
        </div>
      </div>

      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin-top:4px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
          <div style="width:3px;height:18px;background:#7c3aed;border-radius:2px"></div>
          <span style="font-size:13px;font-weight:700;color:#1e293b">ผู้เซ็น & พยาน</span>
        </div>
        ${(()=>{
          const signers=(DB.sysConfig&&DB.sysConfig.signers)||[];
          const staffList=(DB.staff||[]).map(s=>s.name).filter(Boolean);
          const allWitnessOpts=[...new Set([...signers.map(s=>s.name),...staffList])].filter(Boolean);
          // ตรวจว่าผู้ให้เช่าเป็นนิติบุคคลหรือไม่
          const llName=v('landlord')||'';
          const isCompany=/บริษัท|ห้างหุ้นส่วน|หจก|บจก|จำกัด/i.test(llName);
          const curLSign=v('landlordSignerName')||(isCompany?(signers[0]?.name||''):'');
          const curLTitle=v('landlordSignerTitle')||(isCompany?(signers.find(s=>s.name===curLSign)?.title||''):'');
          // อยุทธ์ default = พยาน 1 ทุกสัญญา ยกเว้นเมื่อเขาเป็นคนเซ็นเอง
          // ใช้ชื่อเต็มจาก signers/staff list ถ้าหาเจอ
          const dwSeed=(DB.sysConfig&&(DB.sysConfig.defaultWitness1||DB.sysConfig.defaultWitness2))||'อยุทธ์';
          // ต้องเป็นชื่อเต็ม (มีนามสกุล = มี space) — หา full name จาก signers/staff
          const dwFull=allWitnessOpts.find(n=>/\s/.test(n)&&(n===dwSeed||n.split(/\s+/)[0]===dwSeed||n.indexOf(dwSeed)===0))||'';
          const w1=v('witness1Name')|| (dwFull&&dwFull!==curLSign?dwFull:'');
          const w2=v('witness2Name')||'';
          const w1t=v('witness1Title')||(signers.find(s=>s.name===w1)?.title||'');
          const w2t=v('witness2Title')||(signers.find(s=>s.name===w2)?.title||'');
          const dlOpts=allWitnessOpts.map(n=>'<option value="'+n+'">').join('');
          const opt=(arr,cur)=>arr.map(n=>'<option value="'+n+'" '+(cur===n?'selected':'')+'>'+n+'</option>').join('');
          const signerOpts=signers.map(s=>'<option value="'+s.name+'" data-title="'+(s.title||'').replace(/"/g,'&quot;')+'" '+(curLSign===s.name?'selected':'')+'>'+s.name+(s.title?' ('+s.title+')':'')+'</option>').join('');
          return `<div class="grid grid-cols-2 gap-3 mb-3">
            <div class="col-span-2">
              <label class="text-xs font-medium text-gray-600 mb-1 block">กรรมการผู้เซ็น (ฝั่งผู้ให้เช่า — บริษัทเรา)</label>
              <select name="landlordSignerName" class="w-full px-3 py-2 border rounded-lg text-sm" onchange="const t=this.options[this.selectedIndex].dataset.title||'';document.querySelector('[name=landlordSignerTitle]').value=t;">
                <option value="">— เลือกกรรมการ —</option>
                ${signerOpts}
              </select>
              <input type="text" name="landlordSignerTitle" value="${(curLTitle||'').replace(/"/g,'&quot;')}" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" placeholder="ตำแหน่ง เช่น กรรมการผู้จัดการ">
            </div>
            <datalist id="dl_witnesses">${dlOpts}</datalist>
            <div>
              <label class="text-xs font-medium text-gray-600 mb-1 block">พยานคนที่ 1</label>
              <input type="text" name="witness1Name" aria-autocomplete="list" list="dl_witnesses" value="${(w1||'').replace(/"/g,'&quot;')}" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="พิมพ์ชื่อ หรือเลือกจากรายชื่อ">
              <input type="text" name="witness1Title" value="${(w1t||'').replace(/"/g,'&quot;')}" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" placeholder="ตำแหน่ง (ไม่บังคับ)">
            </div>
            <div>
              <label class="text-xs font-medium text-gray-600 mb-1 block">พยานคนที่ 2</label>
              <input type="text" name="witness2Name" aria-autocomplete="list" list="dl_witnesses" value="${(w2||'').replace(/"/g,'&quot;')}" class="w-full px-3 py-2 border rounded-lg text-sm" placeholder="พิมพ์ชื่อ หรือเลือกจากรายชื่อ">
              <input type="text" name="witness2Title" value="${(w2t||'').replace(/"/g,'&quot;')}" class="w-full px-3 py-2 border rounded-lg text-sm mt-1" placeholder="ตำแหน่ง (ไม่บังคับ)">
            </div>
          </div>`;
        })()}
        <div class="text-xs font-semibold text-gray-500 mb-2">ลายเซ็น</div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-medium text-gray-600 mb-1 block">ลายเซ็นผู้ให้เช่า</label>
            <div class="flex gap-2 items-center">
              <div id="cfLandlordSigPreview" style="width:60px;height:40px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:24px;color:#cbd5e1">📝</div>
              <input type="file" class="flex-1 text-xs" accept="image/*" onchange="cfPreviewSig(this,'cfLandlordSigPreview')">
            </div>
            <input type="hidden" name="landlordSig" value="${v('landlordSig')}">
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 mb-1 block">ลายเซ็นผู้เช่า</label>
            <div class="flex gap-2 items-center">
              <div id="cfTenantSigPreview" style="width:60px;height:40px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:24px;color:#cbd5e1">📝</div>
              <input type="file" class="flex-1 text-xs" accept="image/*" onchange="cfPreviewSig(this,'cfTenantSigPreview')">
            </div>
            <input type="hidden" name="tenantSig" value="${v('tenantSig')}">
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 mb-1 block">ลายเซ็นพยาน 1</label>
            <div class="flex gap-2 items-center">
              <div id="cfWitness1SigPreview" style="width:60px;height:40px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:24px;color:#cbd5e1">📝</div>
              <input type="file" class="flex-1 text-xs" accept="image/*" onchange="cfPreviewSig(this,'cfWitness1SigPreview')">
            </div>
            <input type="hidden" name="witness1Sig" value="${v('witness1Sig')}">
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600 mb-1 block">ลายเซ็นพยาน 2</label>
            <div class="flex gap-2 items-center">
              <div id="cfWitness2SigPreview" style="width:60px;height:40px;border:1px solid #e2e8f0;border-radius:6px;background:#f8fafc;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:24px;color:#cbd5e1">📝</div>
              <input type="file" class="flex-1 text-xs" accept="image/*" onchange="cfPreviewSig(this,'cfWitness2SigPreview')">
            </div>
            <input type="hidden" name="witness2Sig" value="${v('witness2Sig')}">
          </div>
        </div>
      </div>

      </div>
      <div class="flex gap-3 pt-2">
        <button type="submit" class="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">${isRenew ? 'สร้างสัญญาต่อ' : 'บันทึก'}</button>
        <button type="button" onclick="closeModal()" class="flex-1 py-2.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">ยกเลิก</button>
      </div>
    </form>
  `;
}


// Auto-fill phone when selecting existing tenant
function cfAutoFillTenant(name) {
  const prev = DB.contracts.filter(x => x.tenant === name).sort((a, b) => b.id - a.id)[0];
  if (prev) {
    const ph = document.getElementById('cfPhone');
    if (ph && !ph.value) ph.value = prev.phone || '';
    const taxEl = document.querySelector('[name=taxId]');
    if (taxEl && !taxEl.value) taxEl.value = prev.taxId || '';
    // Auto-fill branch
    const branchHidden = document.getElementById('cfBranchHidden');
    if (branchHidden && branchHidden.value === '00000' && prev.branch && prev.branch !== '00000') {
      branchHidden.value = prev.branch;
      const branchRadio = document.querySelector('[name=branchType][value=branch]');
      const branchInput = document.getElementById('cfBranchNo');
      if (branchRadio) branchRadio.checked = true;
      if (branchInput) { branchInput.value = prev.branch; branchInput.style.display = ''; }
    }
    // Auto-fill tenant address sub-fields
    if(prev.tenantAddr){
      const ap=parseAddrParts(prev.tenantAddr);
      const fill=(n,v)=>{const el=document.querySelector('[name='+n+']');if(el&&!el.value)el.value=v||'';};
      fill('ta_line',ap.addrLine);fill('ta_sd',ap.subDistrict);fill('ta_dt',ap.district);fill('ta_pv',ap.province);fill('ta_zip',ap.zip);
    }
    // Auto-fill tenant logo from previous contract
    if(prev.tenantLogo){
      const logoEl=document.querySelector('[name=tenantLogo]');
      if(logoEl&&!logoEl.value){
        logoEl.value=prev.tenantLogo;
        const preview=document.getElementById('cfTenantLogoPreview');
        if(preview)preview.innerHTML='<img src="'+prev.tenantLogo+'" style="width:40px;height:40px;object-fit:contain;border-radius:6px;border:1px solid #e5e7eb">';
      }
    }
  }
}

// Branch (สาขา) — toggle visibility + sync hidden field
function cfBranchChange(){
  const sel = document.querySelector('[name=branchType]:checked')?.value || 'head';
  const inp = document.getElementById('cfBranchNo');
  const hidden = document.getElementById('cfBranchHidden');
  if (!inp || !hidden) return;
  if (sel === 'head') {
    inp.style.display = 'none';
    inp.value = '';
    hidden.value = '00000';
  } else {
    inp.style.display = '';
    if (!inp.value) inp.value = '';
    inp.focus();
    cfBranchSync();
  }
}
function cfBranchSync(){
  const inp = document.getElementById('cfBranchNo');
  const hidden = document.getElementById('cfBranchHidden');
  if (!inp || !hidden) return;
  const digits = (inp.value || '').replace(/\D/g, '');
  hidden.value = digits ? digits.padStart(5, '0') : '00000';
}

// Build full tenant name from prefix + first + last sub-fields
function cfBuildTenantName(){
  const prefix=document.querySelector('[name=tenantPrefix]')?.value||'';
  const first=(document.querySelector('[name=tenantFirst]')?.value||'').trim();
  const last=(document.querySelector('[name=tenantLast]')?.value||'').trim();
  const full=(prefix?prefix:'')+((prefix&&first)?' ':'')+first+(last?' '+last:'');
  const hidden=document.querySelector('[name=tenant]');
  if(hidden) hidden.value=full;
  return full;
}

// Validate Thai National ID checksum
// BUGFIX P2-5: กันพิมพ์ผิด 13 หลัก — ใช้ mod 11 checksum
// digit[12] = (11 - (Σ digit[i]*(13-i) for i=0..11) mod 11) mod 10
function isValidThaiId(digits){
  if(!/^\d{13}$/.test(digits)) return false;
  let sum=0;
  for(let i=0;i<12;i++) sum += parseInt(digits[i]) * (13-i);
  const check = (11 - (sum % 11)) % 10;
  return check === parseInt(digits[12]);
}

// Format Thai national ID: X-XXXX-XXXXX-XX-X
function cfFormatThaiId(input){
  let v=input.value.replace(/[^\d]/g,'');
  if(v.length>13) v=v.slice(0,13);
  let formatted='';
  for(let i=0;i<v.length;i++){
    if(i===1||i===5||i===10||i===12) formatted+='-';
    formatted+=v[i];
  }
  input.value=formatted;
  // Also update hidden field if exists
  const hidden=document.querySelector('[name=taxId]');
  if(hidden&&hidden!==input) hidden.value=formatted;
  // Validate only when full 13 digits entered
  if(v.length===13){
    if(!isValidThaiId(v)){
      input.style.borderColor='#dc2626';
      input.style.background='#fef2f2';
      input.title='เลขบัตรประชาชนไม่ถูกต้อง (checksum ผิด)';
    } else {
      input.style.borderColor='';
      input.style.background='';
      input.title='';
    }
  } else {
    // Clear warning while user still typing
    input.style.borderColor='';
    input.style.background='';
    input.title='';
  }
}

function cfSelectBank(val){
  // Bank section removed from form UI — function kept for safety but no-ops if elements absent
  const customDiv=$('cfBankCustom');
  if(!customDiv)return;
  if(val==='_custom'){
    customDiv.style.display='';
    const bn=$('cfBankName'),an=$('cfAcctNo'),acn=$('cfAcctName');
    if(bn)bn.oninput=function(){const f=document.querySelector('[name=bank]');if(f)f.value=this.value};
    if(an)an.oninput=function(){const f=document.querySelector('[name=acctNo]');if(f)f.value=this.value};
    if(acn)acn.oninput=function(){const f=document.querySelector('[name=accountName]');if(f)f.value=this.value};
    return;
  }
  customDiv.style.display='none';
  if(!val){const b=document.querySelector('[name=bank]'),a=document.querySelector('[name=acctNo]'),c=document.querySelector('[name=accountName]');if(b)b.value='';if(a)a.value='';if(c)c.value='';return;}
  const parts=val.split('|||');
  const bf=document.querySelector('[name=bank]'),af=document.querySelector('[name=acctNo]'),cf=document.querySelector('[name=accountName]');
  if(bf)bf.value=parts[0]||'';if(af)af.value=parts[1]||'';if(cf)cf.value=parts[2]||'';
}

function cfUploadTenantLogo(input){
  if(!input.files[0])return;
  const file=input.files[0];
  compressImage(file, 200, 0.7, function(dataUrl){
    document.querySelector('[name=tenantLogo]').value=dataUrl;
    document.getElementById('cfTenantLogoPreview').innerHTML='<img src="'+dataUrl+'" style="width:40px;height:40px;object-fit:contain;border-radius:6px;border:1px solid #e5e7eb">';
  });
}

function cfPreviewSig(input, previewId){
  if(!input.files[0])return;
  const file=input.files[0];
  const reader=new FileReader();
  reader.onload=function(e){
    const dataUrl=e.target.result;
    // Store base64 in hidden input
    const fieldName=input.name; // landlordSig, tenantSig, witness1Sig, witness2Sig
    const hiddenInput=document.querySelector('[name='+fieldName+']');
    if(hiddenInput) hiddenInput.value=dataUrl;
    // Show preview
    const previewDiv=document.getElementById(previewId);
    if(previewDiv) previewDiv.innerHTML='<img src="'+dataUrl+'" style="width:100%;height:100%;object-fit:contain;border-radius:4px">';
  };
  reader.readAsDataURL(file);
}

function cfSelectHeader(val){
  const preview=document.getElementById('cfHeaderPreview');
  const manualSection=document.getElementById('cfManualLandlordSection');
  const hiddenHeaderId=document.getElementById('cfInvHeaderId');

  if(val==='_manual'){
    // Show manual entry section, hide preview
    if(manualSection)manualSection.style.display='';
    if(preview)preview.style.display='none';
    if(hiddenHeaderId)hiddenHeaderId.value='';
    return;
  }

  if(!val){
    if(manualSection)manualSection.style.display='none';
    if(preview)preview.style.display='none';
    if(hiddenHeaderId)hiddenHeaderId.value='';
    // Clear hidden fields
    document.querySelector('[name=bank]').value='';
    document.querySelector('[name=acctNo]').value='';
    document.querySelector('[name=accountName]').value='';
    document.querySelector('[name=landlord]')&&(document.querySelector('[name=landlord]').value='');
    return;
  }

  // Find the header
  const h=(DB.invoiceHeaders||[]).find(x=>x.id===+val);
  if(!h)return;

  // Hide manual section, show preview
  if(manualSection)manualSection.style.display='none';
  if(hiddenHeaderId)hiddenHeaderId.value=h.id;

  // Auto-fill hidden fields + update visible bank select
  document.querySelector('[name=bank]').value=h.bankName||'';
  document.querySelector('[name=acctNo]').value=h.bankAccount||'';
  document.querySelector('[name=accountName]').value=h.bankAccountName||'';
  // Try to select matching bank in the visible dropdown
  if(h.bankName&&h.bankAccount){
    const bSel=document.getElementById('cfBankSelect');
    if(bSel){
      const matchKey=h.bankName+'|||'+h.bankAccount+'||'+(h.bankAccountName||'');
      // Look for matching option
      let matched=false;
      for(const opt of bSel.options){
        const parts=opt.value.split('|||');
        if(parts[0]===h.bankName&&parts[1]===h.bankAccount){bSel.value=opt.value;matched=true;break;}
      }
      if(!matched){
        // Add header's bank as _custom entry and show
        const customKey=h.bankName+'|||'+h.bankAccount+'|||'+(h.bankAccountName||'');
        const opt=new Option((h.bankAccountName||h.bankName)+' — '+h.bankName+' '+h.bankAccount, customKey);
        bSel.insertBefore(opt, bSel.options[bSel.options.length-1]);
        bSel.value=customKey;
      }
      const cDiv=document.getElementById('cfBankCustom');if(cDiv)cDiv.style.display='none';
    }
  }

  // Auto-fill landlord name (try hidden or select)
  const landlordSel=document.querySelector('[name=landlord]');
  if(landlordSel){
    // Check if companyName exists in options
    let found=false;
    for(const opt of landlordSel.options){if(opt.value===h.companyName){landlordSel.value=h.companyName;found=true;break;}}
    if(!found)landlordSel.value=h.companyName;
  }

  // Auto-fill landlord address
  if(h.address){
    const ap=parseAddrParts(h.address);
    const fill=(n,v)=>{const el=document.querySelector('[name='+n+']');if(el)el.value=v||'';};
    fill('la_line',ap.addrLine);fill('la_sd',ap.subDistrict);fill('la_dt',ap.district);fill('la_pv',ap.province);fill('la_zip',ap.zip);
  }

  // Auto-fill madeAt
  const madeAtEl=document.getElementById('cfMadeAt');
  if(madeAtEl)madeAtEl.value=h.address||'';

  // Show preview card
  if(preview){
    preview.style.display='';
    preview.innerHTML=`<div style="display:flex;gap:10px;align-items:start">
      ${h.logo?'<img src="'+esc(h.logo)+'" style="width:40px;height:40px;object-fit:contain;border-radius:6px;border:1px solid #86efac;flex-shrink:0">':''}
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:13px;color:#15803d">${esc(shortLandlordName(h.companyName||h.name))}</div>
        <div style="font-size:11px;color:#166534;margin-top:2px">${esc(h.address)||'-'}</div>
        ${h.phone?'<div style="font-size:11px;color:#166534">Tel: '+esc(h.phone)+(h.taxId?' | Tax: '+esc(h.taxId):'')+'</div>':''}
        ${h.bankName?'<div style="font-size:11px;color:#0369a1;margin-top:4px">🏦 '+esc(h.bankName)+' '+esc(h.bankAccount)+' ('+esc(h.bankAccountName||'-')+')</div>':''}
      </div>
    </div>
    <div style="font-size:10px;color:#15803d;margin-top:6px">✓ ข้อมูลผู้ให้เช่า ธนาคาร และที่อยู่จะถูกดึงอัตโนมัติ</div>`;
  }

  // Auto-trigger initial state on form load
  setTimeout(()=>{
    const sel=document.getElementById('cfHeaderSelect');
    if(sel&&sel.value&&sel.value!=='_manual'&&sel.value!==''){
      // Already selected — ensure preview shows
    }
  },100);
}

function cfSelectLandlord(val){
  const customEl=$('cfLandlordCustom');
  if(val==='_custom'){
    customEl.style.display='';customEl.focus();
    customEl.oninput=function(){document.querySelector('[name=landlord]').value=this.value};
    return;
  }
  customEl.style.display='none';
  // Auto-fill landlord address from previous contracts
  const addrDisplay=document.getElementById('cfLandlordAddrDisplay');
  if(val){
    const prev=DB.contracts.filter(x=>x.landlord===val&&x.landlordAddr).sort((a,b)=>b.id-a.id)[0];
    if(prev&&prev.landlordAddr){
      // Set readonly display
      if(addrDisplay) addrDisplay.textContent=prev.landlordAddr;
      // Set hidden sub-fields so assembleAddrFromPrefix still works on submit
      const ap=parseAddrParts(prev.landlordAddr);
      const fill=(n,v)=>{const el=document.querySelector('[name='+n+']');if(el)el.value=v||'';};
      fill('la_line',ap.addrLine);fill('la_sd',ap.subDistrict);fill('la_dt',ap.district);fill('la_pv',ap.province);fill('la_zip',ap.zip);
      // Auto-fill madeAt from landlord address
      const madeAtEl=document.getElementById('cfMadeAt');
      if(madeAtEl) madeAtEl.value=prev.landlordAddr;
    } else {
      if(addrDisplay) addrDisplay.innerHTML='<span style="color:#64748b">ไม่พบที่อยู่ในระบบ</span>';
    }
  } else {
    if(addrDisplay) addrDisplay.innerHTML='<span style="color:#64748b">เลือกผู้ให้เช่าด้านบนเพื่อดึงที่อยู่</span>';
  }
  // Auto-select bank account matching this landlord
  const bankSel=$('cfBankSelect');
  if(val&&bankSel&&!bankSel.value){
    const opts=bankSel.querySelectorAll('option[data-landlords]');
    for(const opt of opts){
      const lls=(opt.dataset.landlords||'').split(',');
      if(lls.includes(val)){bankSel.value=opt.value;cfSelectBank(opt.value);break;}
    }
  }
}

// Auto-fill area when selecting property (always overwrite — area is readonly, pulled from property)
function cfAutoFillProp(pidStr) {
  const pp = DB.properties.find(x => x.pid === +pidStr);
  if (pp) {
    const area = document.getElementById('cfArea');
    if (area) area.value = pp.area || '';
  }
}

// Compose rate string from prefix + amount
function buildRateStr(fd) {
  const prefix = fd.get('ratePrefix') || 'เดือนละ';
  const rateAmt = (fd.get('rateAmt') || '0').replace(/[^\d,.]/g,'');
  return prefix + ' ' + rateAmt + ' บาท';
}

// Resolve custom dropdown values before saving
function resolveFormDropdowns(fd){
  // Purpose: if dropdown is _custom, use the text input
  const purpose=fd.get('purpose');
  if(purpose==='_custom'){const custom=fd.get('purposeCustom');if(custom)fd.set('purpose',custom);}
  // Tenant name: assemble from prefix + first + last into hidden tenant field
  const tFirst=(fd.get('tenantFirst')||'').trim();
  const tLast=(fd.get('tenantLast')||'').trim();
  const tPrefix=fd.get('tenantPrefix')||'';
  if(tFirst){
    const full=(tPrefix?tPrefix+' ':'')+tFirst+(tLast?' '+tLast:'');
    fd.set('tenant',full);
  }
  // RateAdj: if preset is _custom, hidden rateAdj already has the custom value from oninput; otherwise use preset
  const rateAdjPreset=fd.get('rateAdjPreset');
  if(rateAdjPreset&&rateAdjPreset!=='_custom'){fd.set('rateAdj',rateAdjPreset);}
  // Payment: assemble from sub-fields if hidden field is empty
  if(!fd.get('payment')){
    const parts=[];
    if(fd.get('paySchedule'))parts.push(fd.get('paySchedule'));
    if(fd.get('payChannel'))parts.push(fd.get('payChannel'));
    if(fd.get('payNote'))parts.push(fd.get('payNote').trim());
    fd.set('payment',parts.join(' · '));
  }
  // Landlord
  const landlord=fd.get('landlord');
  if(landlord==='_custom'){const custom=fd.get('landlordCustom');if(custom)fd.set('landlord',custom);}
  // Deposit: strip to number only
  const dep=fd.get('deposit');
  if(dep){fd.set('deposit',dep.replace(/[^\d.]/g,''));}
}

function cfTodayBE(){const d=new Date();return d.getDate()+'/'+(d.getMonth()+1)+'/'+(d.getFullYear()+543)}

// Convert number to Thai Baht text e.g. 81000 → "แปดหมื่นหนึ่งพันบาทถ้วน"
function numToThaiBaht(n){
  if(n===0||n==='0')return'ศูนย์บาทถ้วน';
  if(n===null||n===undefined||n===''||isNaN(n))return'';
  n=Math.abs(parseFloat(n));
  const units=['','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
  const places=['','สิบ','ร้อย','พัน','หมื่น','แสน','ล้าน'];
  function intPart(num){
    if(num===0)return'ศูนย์';
    let s='',d=String(Math.floor(num)),len=d.length;
    for(let i=0;i<len;i++){
      const digit=+d[i],pos=len-i-1;
      if(digit===0)continue;
      if(pos===1&&digit===2){s+='ยี่สิบ';continue;}
      if(pos===1&&digit===1){s+='สิบ';continue;}
      if(pos===0&&digit===1&&len>1){s+='เอ็ด';continue;}
      s+=units[digit]+places[pos%7];
      if(pos>=7&&pos%6===0)s+='ล้าน';
    }
    return s;
  }
  const int=Math.floor(n),frac=Math.round((n-int)*100);
  let result=intPart(int)+'บาท';
  result+=frac>0?intPart(frac)+'สตางค์':'ถ้วน';
  return result;
}

// Format deposit for display/print: "81,000 บาท (แปดหมื่นหนึ่งพันบาทถ้วน)"
function fmtDeposit(raw){
  if(!raw)return'';
  const num=parseFloat(String(raw).replace(/[^\d.]/g,''));
  if(!num||isNaN(num))return raw;
  return fmtBaht(num,{sym:0})+' บาท ('+numToThaiBaht(num)+')';
}

// Format deposit input: strip to number with commas
function cfFormatDeposit(input){
  let v=input.value.replace(/[^\d.]/g,'');
  const num=parseFloat(v);
  if(!isNaN(num)&&v){input.value=fmtBaht(num,{sym:0});}
}

// parseBE defined at top of script — do not duplicate

function cfCalcEnd(){cfCalcEndFromDur();}

function cfCalcEndFromDur(){
  const startEl=document.querySelector('[name=start]');
  const yEl=document.querySelector('[name=durYears]');
  const mEl=document.querySelector('[name=durMonths]');
  const endEl=document.querySelector('[name=end]');
  const durEl=document.querySelector('[name=dur]');
  const sumEl=document.getElementById('cfDurSummary');
  if(!startEl||!endEl)return;
  const sv=startEl.value;
  const years=yEl?+yEl.value||0:0;
  const months=mEl?+mEl.value||0:0;
  // Update hidden dur field
  const durParts=[];
  if(years>0) durParts.push(years+' ปี');
  if(months>0) durParts.push(months+' เดือน');
  if(durEl) durEl.value=durParts.join(' ')||'';
  if(!sv||(!years&&!months))return;
  const sd=parseBE(sv);if(!sd)return;
  // Safe month/year addition: clamp day to target month's last day
  // to prevent JS Date setMonth() overflow (e.g., Jan 31 + 1mo → Mar 3)
  const totalMonths=sd.getMonth()+years*12+months;
  const tY=sd.getFullYear()+Math.floor(totalMonths/12);
  const tM=((totalMonths%12)+12)%12;
  const lastDay=new Date(tY,tM+1,0).getDate();
  const tD=Math.min(sd.getDate(),lastDay);
  const ed=new Date(tY,tM,tD);
  ed.setDate(ed.getDate()-1);
  const dd=String(ed.getDate()).padStart(2,'0');
  const mm=String(ed.getMonth()+1).padStart(2,'0');
  endEl.value=dd+'/'+mm+'/'+(ed.getFullYear()+543);
  if(sumEl) sumEl.textContent=durParts.join(' ')+' (ถึง '+fmtBE(endEl.value)+')';
}

function cfCalcDurFromEnd(){
  const startEl=document.querySelector('[name=start]');
  const endEl=document.querySelector('[name=end]');
  const yEl=document.querySelector('[name=durYears]');
  const mEl=document.querySelector('[name=durMonths]');
  const durEl=document.querySelector('[name=dur]');
  const sumEl=document.getElementById('cfDurSummary');
  if(!startEl||!endEl)return;
  const sd=parseBE(startEl.value),ed=parseBE(endEl.value);
  if(!sd||!ed)return;
  // BUGFIX: end date เป็น inclusive (ครอบคลุมวันสุดท้าย)
  // สมมาตรกับ cfCalcEndFromDur ที่ทำ setDate(d-1) ตอนคำนวณย้อนกลับ
  // → ต้อง add 1 วันให้ ed ก่อน แล้วคำนวณ diff
  const edPlus=new Date(ed.getFullYear(),ed.getMonth(),ed.getDate()+1);
  let years=edPlus.getFullYear()-sd.getFullYear();
  let months=edPlus.getMonth()-sd.getMonth();
  let days=edPlus.getDate()-sd.getDate();
  if(days<0){months--;}
  if(months<0){years--;months+=12;}
  if(years<0){years=0;months=0;}
  if(yEl) yEl.value=years||'';
  if(mEl) mEl.value=months||'';
  const durParts=[];
  if(years>0) durParts.push(years+' ปี');
  if(months>0) durParts.push(months+' เดือน');
  if(durEl) durEl.value=durParts.join(' ')||'';
  if(sumEl) sumEl.textContent=durParts.join(' ')||'';
}

function cfUpdatePayment(){
  const schEl=document.querySelector('select[name=paySchedule]')||document.querySelector('[name=paySchedule]:checked');
  const chEl=document.querySelector('select[name=payChannel]')||document.querySelector('[name=payChannel]:checked');
  const note=document.querySelector('[name=payNote]');
  const hidden=document.querySelector('[name=payment]');
  if(!hidden)return;
  const parts=[];
  const schVal=schEl?(schEl.tagName==='SELECT'?schEl.value:schEl.value):'';
  const chVal=chEl?(chEl.tagName==='SELECT'?chEl.value:chEl.value):'';
  if(schVal) parts.push(schVal);
  if(chVal) parts.push(chVal);
  if(note&&note.value.trim()) parts.push(note.value.trim());
  hidden.value=parts.join(' · ');
}

// Pure: คำนวณเลขสัญญาถัดไป — ใช้ในฟอร์มสร้างใหม่ + datafix autogen
function genNextContractNo(){
  const y=new Date().getFullYear()+543;
  const existing=(DB.contracts||[]).map(c=>c.no).filter(Boolean);
  let maxNum=0;
  existing.forEach(n=>{const m=n.match(/(\d+)/);if(m)maxNum=Math.max(maxNum,+m[1])});
  const next=String(maxNum+1).padStart(3,'0');
  return 'สช.'+next+'/'+y;
}
function cfGenContractNo(){
  const el=document.querySelector('[name=no]');
  if(el)el.value=genNextContractNo();
}

