// ========== EXPORT EXCEL ==========
function exportExcelAll(){
  if(typeof XLSX==='undefined'){toast('กำลังโหลด SheetJS...','warning');return;}
  const wb=XLSX.utils.book_new();

  // Sheet 1: ทรัพย์สิน (ครบทุก field)
  const propRows=DB.properties.map(p=>({
    'pid':p.pid,'ชื่อ':p.name||'','ที่อยู่':p.location||'','จังหวัด':p.province||'','ประเภท':p.type||'','เจ้าของ':p.owner||''
  }));
  if(propRows.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(propRows),'ทรัพย์สิน');

  // Sheet 2: สัญญาเช่า (ครบทุก field รวม internal IDs)
  const conRows=DB.contracts.map(c=>{
    const p=DB.properties.find(x=>x.pid===c.pid);
    const s=status(c);
    const freq=payFreq(c.rate,c.payment);
    return {
      'id':c.id,'pid':c.pid||'','เลขที่สัญญา':c.no||'','วันที่ทำสัญญา':c.date||'',
      'ทรัพย์สิน':c.property||p?.name||'','ผู้เช่า':c.tenant||'','เบอร์โทร':c.phone||'',
      'เลขผู้เสียภาษี':c.taxId||'','ที่อยู่ผู้เช่า':c.tenantAddr||'',
      'วัตถุประสงค์':c.purpose||'','พื้นที่':c.area||'','ทำที่':c.madeAt||'',
      'วันเริ่ม':c.start||'','วันสิ้นสุด':c.end||'','ระยะเวลา':c.dur||'',
      'ค่าเช่า':c.rate||'','จำนวนเงิน':amt(c.rate)||0,'ความถี่':freq.label||'','การชำระ':c.payment||'',
      'เงินประกัน':c.deposit||'','ปรับค่าเช่า':c.rateAdj||'',
      'ผู้ให้เช่า':c.landlord||'','ที่อยู่ผู้ให้เช่า':c.landlordAddr||'',
      'ธนาคาร':c.bank||'','เลขบัญชี':c.acctNo||'','ชื่อบัญชี':c.accountName||'',
      'สถานะ':s==='active'?'ใช้งาน':s==='expired'?'หมดอายุ':s==='soon'?'ใกล้หมด':s==='cancelled'?'ยกเลิก':'รอเริ่ม',
      'เซ็นแล้ว':c.signed?'ใช่':'ไม่','ยกเลิก':c.cancelled?'ใช่':'ไม่',
      'cancelDate':c.cancelledDate||c.cancelDate||'','cancelReason':c.cancelledReason||c.cancelReason||'',
      'จังหวัด':p?.province||''
    };
  });
  if(conRows.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(conRows),'สัญญาเช่า');

  // Sheet 3: ใบแจ้งหนี้ (ครบทุก field)
  const invRows=(DB.invoices||[]).map(inv=>{
    const stLabel={draft:'แบบร่าง',sent:'ส่งแล้ว',paid:'ชำระแล้ว'}[inv.status]||inv.status;
    return {
      'id':inv.id,'cid':inv.cid||'','pid':inv.pid||'',
      'เลขที่':inv.invoiceNo||'','ประจำเดือน':inv.month||'','ผู้เช่า':inv.tenant||'','ทรัพย์สิน':inv.property||'',
      'รวมเงิน':inv.total||0,'สถานะ':stLabel,'freqType':inv.freqType||'','ความถี่':inv.freqLabel||'',
      'วันที่ออก':inv.date||'','กำหนดชำระ':inv.dueDate||'',
      'headerId':inv.headerId||'','paidAt':inv.paidAt||'','createdAt':inv.createdAt||'',
      'รายการ_JSON':inv.items?JSON.stringify(inv.items):'','slipImage':inv.slipImage?'YES':''
    };
  });
  if(invRows.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(invRows),'ใบแจ้งหนี้');

  // Sheet 4: การชำระเงิน (payments object → rows)
  const payRows=[];
  Object.entries(DB.payments||{}).forEach(([key,val])=>{
    payRows.push({'key':key,'paid':val.paid?'ใช่':'ไม่','date':val.date||'','amount':val.amount||'','note':val.note||''});
  });
  if(payRows.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(payRows),'การชำระเงิน');

  // Sheet 5: หัวบิล (invoiceHeaders)
  const hdrRows=(DB.invoiceHeaders||[]).map(h=>({
    'id':h.id,'ชื่อ':h.name||'','บริษัท':h.companyName||'','ที่อยู่':h.address||'',
    'โทร':h.phone||'','เลขภาษี':h.taxId||'','ธนาคาร':h.bankName||'',
    'เลขบัญชี':h.bankAccount||'','ชื่อบัญชี':h.bankAccountName||'','logo':h.logo?'[มีโลโก้]':''
  }));
  if(hdrRows.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(hdrRows),'หัวบิล');

  // Sheet 6: ตั้งค่า (IDs, settings, templates summary)
  const settingsRows=[
    {'key':'nextPId','value':DB.nextPId},
    {'key':'nextCId','value':DB.nextCId},
    {'key':'nextInvId','value':DB.nextInvId},
    {'key':'defaultInvHeader','value':DB.defaultInvHeader||''},
    {'key':'activeTemplate','value':DB.activeTemplate||''},
    {'key':'templates_count','value':(DB.templates||[]).length},
    {'key':'activityLog_count','value':(DB.activityLog||[]).length}
  ];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(settingsRows),'ตั้งค่า');

  // Sheet 6.5: พนักงาน (ไม่รวม signatureImg เพราะใหญ่เกิน Excel cell)
  const staffRows=(DB.staff||[]).map(s=>({
    'ชื่อ':s.name||'','ตำแหน่ง':s.role||'','PIN':s.pin||'','createdAt':s.createdAt||'',
    'มีลายเซ็น':s.signatureImg?'ใช่':''
  }));
  if(staffRows.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(staffRows),'พนักงาน');

  // Sheet 7: Activity Log
  const logRows=(DB.activityLog||[]).slice(-500).map(l=>({
    'เวลา':l.time||l.date||'','ประเภท':l.type||'','รายละเอียด':l.detail||l.desc||''
  }));
  if(logRows.length)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(logRows),'ประวัติ');

  const fname=`rental_FULL_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb,fname);
  addActivityLog('export_excel',`Export Excel ครบ ${fname} — ${propRows.length} ทรัพย์สิน, ${conRows.length} สัญญา, ${invRows.length} ใบแจ้งหนี้, ${payRows.length} การชำระ`);
  save();
  toast('Export Excel ครบทุกข้อมูล — '+fname+' | หมายเหตุ: Slip images เก็บใน IndexedDB เท่านั้น','info');
}

function exportExcelContracts(){
  if(typeof XLSX==='undefined'){toast('กำลังโหลด SheetJS...','warning');return;}
  const wb=XLSX.utils.book_new();
  const rows=DB.contracts.map(c=>{
    const p=DB.properties.find(x=>x.pid===c.pid);
    const s=status(c);
    const freq=payFreq(c.rate,c.payment);
    return {
      'เลขที่สัญญา':c.no||'','วันที่ทำสัญญา':c.date||'',
      'ทรัพย์สิน':c.property||p?.name||'','จังหวัด':p?.province||'',
      'ผู้เช่า':c.tenant||'','เบอร์โทร':c.phone||'','เลขผู้เสียภาษี':c.taxId||'',
      'ที่อยู่ผู้เช่า':c.tenantAddr||'',
      'วันเริ่ม':c.start||'','วันสิ้นสุด':c.end||'','ระยะเวลา':c.dur||'',
      'ค่าเช่า':c.rate||'','จำนวนเงิน':amt(c.rate)||0,'ความถี่':freq.label||'',
      'การชำระ':c.payment||'','เงินประกัน':c.deposit||'',
      'ผู้ให้เช่า':c.landlord||'','ที่อยู่ผู้ให้เช่า':c.landlordAddr||'',
      'ธนาคาร':c.bank||'','เลขบัญชี':c.acctNo||'','ชื่อบัญชี':c.accountName||'',
      'สถานะ':s==='active'?'ใช้งาน':s==='expired'?'หมดอายุ':s==='soon'?'ใกล้หมด':s==='cancelled'?'ยกเลิก':'รอเริ่ม',
      'เซ็นแล้ว':c.signed?'ใช่':'ไม่'
    };
  });
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'สัญญาเช่า');
  const fname=`contracts_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb,fname);
  addActivityLog('export_excel',`Export สัญญา Excel ${fname}`);save();
  toast('Export สัญญา Excel สำเร็จ');
}

function exportExcelInvoices(){
  if(typeof XLSX==='undefined'){toast('กำลังโหลด SheetJS...','warning');return;}
  const wb=XLSX.utils.book_new();
  const rows=(DB.invoices||[]).map(inv=>{
    const stLabel={draft:'แบบร่าง',sent:'ส่งแล้ว',paid:'ชำระแล้ว'}[inv.status]||inv.status;
    const paidDate=inv.paidAt?new Date(inv.paidAt).toLocaleDateString('th-TH'):'';
    const h=(DB.invoiceHeaders||[]).find(x=>x.id==inv.headerId);
    const isVat=!!(h&&h.vatRegistered);
    const vatRate=isVat?(parseFloat(h.vatRate)||7):0;
    const gross=inv.total||0;
    const subtotal=isVat?+(gross/(1+vatRate/100)).toFixed(2):gross;
    const vatAmt=isVat?+(gross-subtotal).toFixed(2):0;
    return {
      'เลขที่':inv.invoiceNo||'','ประจำเดือน':inv.month||'',
      'ผู้เช่า':inv.tenant||'','ทรัพย์สิน':inv.property||'',
      'มูลค่าก่อนภาษี':subtotal,'VAT %':vatRate,'VAT (บาท)':vatAmt,
      'รวมเงิน':gross,'ความถี่':inv.freqLabel||'',
      'สถานะ':stLabel,'วันที่ออก':inv.date||'','กำหนดชำระ':inv.dueDate||'',
      'วันที่ชำระ':paidDate,
      'เลขใบกำกับภาษี':inv.taxInvoiceNo||'',
      'รายการ':inv.items?inv.items.map(it=>it.desc+': '+fmtBaht(it.amount,{sym:0})).join(' | '):''
    };
  });
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'ใบแจ้งหนี้');
  const fname=`invoices_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb,fname);
  addActivityLog('export_excel',`Export ใบแจ้งหนี้ Excel ${fname}`);save();
  toast('Export ใบแจ้งหนี้ Excel สำเร็จ');
}

function importExcel(e){
  if(typeof XLSX==='undefined'){toast('กำลังโหลด SheetJS...','warning');return;}
  const file=e.target.files[0];
  if(!file)return;

  // Show import mode picker
  $('mtitle').textContent='Import จาก Excel';
  $('mbody').innerHTML=`
    <div style="padding:8px 0">
      <p style="font-size:13px;color:#475569;margin-bottom:16px">ไฟล์: <b>${(file.name||'').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</b></p>
      <p style="font-size:12px;color:#64748b;margin-bottom:12px">เลือกประเภทข้อมูลที่จะ import:</p>
      <div style="display:flex;flex-direction:column;gap:8px" id="importExcelOptions">
        <button onclick="doImportExcelFull()" style="padding:12px 16px;background:#fef2f2;border:2px solid #fca5a5;border-radius:10px;text-align:left;cursor:pointer;font-family:Sarabun">
          <div style="font-size:13px;font-weight:700;color:#dc2626">🔄 Restore ทั้งหมด (แทนที่ข้อมูลเดิม)</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">ใช้ไฟล์ที่ Export ครบแล้ว — กู้คืนทุกอย่างรวม payments, หัวบิล, ตั้งค่า</div>
        </button>
        <button onclick="doImportDBReady()" style="padding:12px 16px;background:#f0fdf4;border:2px solid #86efac;border-radius:10px;text-align:left;cursor:pointer;font-family:Sarabun">
          <div style="font-size:13px;font-weight:700;color:#15803d">📦 Import จากไฟล์ DB_Ready</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">ใช้ไฟล์ที่เตรียมไว้แล้ว (sheet: contracts + properties)</div>
        </button>
        <div style="padding:4px 0;text-align:center;font-size:11px;color:#64748b">— หรือเพิ่มข้อมูลบางส่วน —</div>
        <button onclick="doImportExcel('contracts')" style="padding:12px 16px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;text-align:left;cursor:pointer;font-family:Sarabun">
          <div style="font-size:13px;font-weight:600;color:#4338ca">📋 สัญญาเช่า</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">เพิ่มสัญญาใหม่เข้าไป (ไม่ลบของเดิม)</div>
        </button>
        <button onclick="doImportExcel('properties')" style="padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;text-align:left;cursor:pointer;font-family:Sarabun">
          <div style="font-size:13px;font-weight:600;color:#15803d">🏠 ทรัพย์สิน</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">เพิ่มทรัพย์สินใหม่เข้าไป (ไม่ลบของเดิม)</div>
        </button>
        <button onclick="doImportExcel('invoices')" style="padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;text-align:left;cursor:pointer;font-family:Sarabun">
          <div style="font-size:13px;font-weight:600;color:#92400e">💰 ใบแจ้งหนี้</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">เพิ่มใบแจ้งหนี้ใหม่เข้าไป (ไม่ลบของเดิม)</div>
        </button>
        <button onclick="doImportExcel('staff')" style="padding:12px 16px;background:#fdf4ff;border:1px solid #f0abfc;border-radius:10px;text-align:left;cursor:pointer;font-family:Sarabun">
          <div style="font-size:13px;font-weight:600;color:#86198f">👤 พนักงาน</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">เพิ่มพนักงานใหม่ (ลายเซ็นต้องอัพโหลดในระบบเอง)</div>
        </button>
      </div>
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid #e5e7eb">
        <div style="font-size:11px;color:#64748b;margin-bottom:6px">ไม่มีไฟล์? โหลด template เปล่า:</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <button onclick="downloadExcelTemplate('contracts')" style="padding:5px 10px;font-size:11px;border:1px solid #c7d2fe;background:#eef2ff;border-radius:6px;cursor:pointer;font-family:Sarabun">📋 สัญญา</button>
          <button onclick="downloadExcelTemplate('properties')" style="padding:5px 10px;font-size:11px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:6px;cursor:pointer;font-family:Sarabun">🏠 ทรัพย์สิน</button>
          <button onclick="downloadExcelTemplate('invoices')" style="padding:5px 10px;font-size:11px;border:1px solid #fde68a;background:#fffbeb;border-radius:6px;cursor:pointer;font-family:Sarabun">💰 ใบแจ้งหนี้</button>
          <button onclick="downloadExcelTemplate('staff')" style="padding:5px 10px;font-size:11px;border:1px solid #f0abfc;background:#fdf4ff;border-radius:6px;cursor:pointer;font-family:Sarabun">👤 พนักงาน</button>
        </div>
      </div>
      <div style="margin-top:12px">
        <button onclick="closeModal()" style="padding:8px 16px;border:1px solid #e5e7eb;border-radius:8px;font-size:12px;cursor:pointer;font-family:Sarabun;color:#64748b">ยกเลิก</button>
      </div>
    </div>`;
  $('modal').classList.remove('hidden');

  // Store file for later
  window._importExcelFile=file;
  e.target.value='';
}

function doImportExcelFull(){
  const file=window._importExcelFile;
  if(!file){toast('ไม่พบไฟล์','error');return;}
  customConfirm('Restore ข้อมูลทั้งหมด','Restore จะแทนที่ข้อมูลทั้งหมด!\nข้อมูลเดิมจะหายไป',function(){
  const reader=new FileReader();
  reader.onload=(ev)=>{
    try{
      const data=new Uint8Array(ev.target.result);
      const wb=XLSX.read(data,{type:'array'});
      const sheetNames=wb.SheetNames;
      const getSheet=(name)=>{const ws=wb.Sheets[name];return ws?XLSX.utils.sheet_to_json(ws):[];};

      // 1) ทรัพย์สิน
      const propSheet=getSheet('ทรัพย์สิน');
      if(propSheet.length){
        DB.properties=propSheet.map(r=>({
          pid:r['pid']||r['รหัส']||DB.nextPId++,
          name:r['ชื่อ']||'',location:r['ที่อยู่']||'',
          province:r['จังหวัด']||'',type:r['ประเภท']||'',owner:r['เจ้าของ']||''
        }));
      }

      // 2) สัญญาเช่า
      const conSheet=getSheet('สัญญาเช่า');
      if(conSheet.length){
        DB.contracts=conSheet.map(r=>({
          id:r['id']||DB.nextCId++,pid:r['pid']||null,
          no:r['เลขที่สัญญา']||'',date:r['วันที่ทำสัญญา']||'',
          property:r['ทรัพย์สิน']||'',tenant:r['ผู้เช่า']||'',
          phone:r['เบอร์โทร']||'',taxId:r['เลขผู้เสียภาษี']||'',
          tenantAddr:r['ที่อยู่ผู้เช่า']||'',purpose:r['วัตถุประสงค์']||'',
          area:r['พื้นที่']||'',madeAt:r['ทำที่']||'',
          start:String(r['วันเริ่ม']||''),end:String(r['วันสิ้นสุด']||''),dur:r['ระยะเวลา']||'',
          rate:String(r['ค่าเช่า']||''),payment:r['การชำระ']||'',
          deposit:r['เงินประกัน']||'',rateAdj:r['ปรับค่าเช่า']||'',
          landlord:r['ผู้ให้เช่า']||'',landlordAddr:r['ที่อยู่ผู้ให้เช่า']||'',
          bank:r['ธนาคาร']||'',acctNo:r['เลขบัญชี']||'',accountName:r['ชื่อบัญชี']||'',
          signed:r['เซ็นแล้ว']==='ใช่',
          cancelled:r['ยกเลิก']==='ใช่',cancelledDate:r['cancelDate']||'',cancelledReason:r['cancelReason']||''
        }));
      }

      // 3) ใบแจ้งหนี้
      const invSheet=getSheet('ใบแจ้งหนี้');
      if(invSheet.length){
        // First, preserve existing slipImage data
        const existingSlipMap={};
        (DB.invoices||[]).forEach(inv=>{if(inv.id&&inv.slipImage)existingSlipMap[inv.id]=inv.slipImage;});

        DB.invoices=invSheet.map(r=>{
          let items=[];
          try{if(r['รายการ_JSON'])items=JSON.parse(r['รายการ_JSON']);}catch(e){}
          const stMap={'แบบร่าง':'draft','ส่งแล้ว':'sent','ชำระแล้ว':'paid'};
          const invId=r['id']||DB.nextInvId++;
          return {
            id:invId,cid:r['cid']||null,pid:r['pid']||null,
            month:r['ประจำเดือน']||'',tenant:r['ผู้เช่า']||'',property:r['ทรัพย์สิน']||'',
            invoiceNo:String(r['เลขที่']||''),date:r['วันที่ออก']||'',dueDate:r['กำหนดชำระ']||'',
            items:items,total:clampMoney(r['รวมเงิน']),
            headerId:r['headerId']||null,
            freqType:r['freqType']||'monthly',freqLabel:r['ความถี่']||'รายเดือน',
            status:stMap[r['สถานะ']]||r['สถานะ']||'draft',
            paidAt:r['paidAt']||'',createdAt:r['createdAt']||'',
            slipImage:existingSlipMap[invId]||''
          };
        });
      }

      // 4) การชำระเงิน
      const paySheet=getSheet('การชำระเงิน');
      if(paySheet.length){
        DB.payments={};
        paySheet.forEach(r=>{
          if(!r['key'])return;
          DB.payments[r['key']]={paid:r['paid']==='ใช่',date:r['date']||'',amount:r['amount']||'',note:r['note']||''};
        });
      }

      // 5) หัวบิล
      const hdrSheet=getSheet('หัวบิล');
      if(hdrSheet.length){
        DB.invoiceHeaders=hdrSheet.map(r=>({
          id:r['id']||Date.now(),name:r['ชื่อ']||'',companyName:r['บริษัท']||'',
          address:r['ที่อยู่']||'',phone:r['โทร']||'',taxId:r['เลขภาษี']||'',
          bankName:r['ธนาคาร']||'',bankAccount:r['เลขบัญชี']||'',bankAccountName:r['ชื่อบัญชี']||'',
          logo:null
        }));
      }

      // 6.5) พนักงาน (preserve signatureImg ของเดิมโดย match ชื่อ)
      const staffSheet=getSheet('พนักงาน');
      if(staffSheet.length){
        const sigMap={};
        (DB.staff||[]).forEach(s=>{if(s.name&&s.signatureImg)sigMap[s.name]=s.signatureImg;});
        DB.staff=staffSheet.map(r=>({
          name:r['ชื่อ']||'',role:r['ตำแหน่ง']||'',pin:String(r['PIN']||''),
          createdAt:r['createdAt']||new Date().toISOString(),
          signatureImg:sigMap[r['ชื่อ']]||''
        })).filter(s=>s.name);
      }

      // 7) ตั้งค่า
      const setSheet=getSheet('ตั้งค่า');
      if(setSheet.length){
        const sm={};setSheet.forEach(r=>{if(r['key'])sm[r['key']]=r['value'];});
        if(sm.nextPId)DB.nextPId=Number(sm.nextPId);
        if(sm.nextCId)DB.nextCId=Number(sm.nextCId);
        if(sm.nextInvId)DB.nextInvId=Number(sm.nextInvId);
        if(sm.defaultInvHeader)DB.defaultInvHeader=sm.defaultInvHeader;
        if(sm.activeTemplate)DB.activeTemplate=sm.activeTemplate;
      }

      // Ensure required fields
      if(!DB.invoices)DB.invoices=[];
      if(!DB.invoiceHeaders)DB.invoiceHeaders=[];
      if(!DB.activityLog)DB.activityLog=[];
      if(!DB.templates)DB.templates=[];
      if(!DB.payments)DB.payments={};

      save();
      addActivityLog('import_excel_full',`Restore ทั้งหมดจาก Excel ${file.name} — ${DB.properties.length} ทรัพย์สิน, ${DB.contracts.length} สัญญา, ${(DB.invoices||[]).length} ใบแจ้งหนี้, ${Object.keys(DB.payments).length} payments`);
      save();
      closeModal(true);
      toast(`Restore สำเร็จ — ${DB.properties.length} ทรัพย์สิน, ${DB.contracts.length} สัญญา, ${(DB.invoices||[]).length} ใบแจ้งหนี้`);
      render();
    }catch(err){
      toast('อ่านไฟล์ไม่ได้: '+err.message,'error');
    }
  };
  reader.readAsArrayBuffer(file);
  },{icon:'🔄',yesLabel:'Restore',yesColor:'#dc2626'});
}

// Validate rows before import — return {ok, skip, reasons[]}
function _validateImportRows(type,rows){
  const ok=[],skip=[];
  const existPropNames=new Set((DB.properties||[]).map(p=>p.name));
  const existStaffEmails=new Set((DB.staff||[]).map(s=>(s.email||'').toLowerCase()).filter(Boolean));
  const existInvNos=new Set((DB.invoices||[]).map(i=>i.invoiceNo));
  rows.forEach((r,i)=>{
    const row=i+2; // excel row (header=1)
    if(type==='contracts'){
      const t=(r['ผู้เช่า']||r['tenant']||'').trim();
      const p=(r['ทรัพย์สิน']||r['property']||'').trim();
      if(!t&&!p){skip.push({row,reason:'ไม่มีผู้เช่า/ทรัพย์สิน'});return;}
      if(!t){skip.push({row,reason:'ไม่มีชื่อผู้เช่า'});return;}
      ok.push(r);
    }else if(type==='properties'){
      const n=(r['ชื่อ']||r['name']||r['ทรัพย์สิน']||'').trim();
      if(!n){skip.push({row,reason:'ไม่มีชื่อ'});return;}
      if(existPropNames.has(n)){skip.push({row,reason:'ชื่อ "'+n+'" ซ้ำของเดิม'});return;}
      ok.push(r);existPropNames.add(n);
    }else if(type==='invoices'){
      const t=(r['ผู้เช่า']||r['tenant']||'').trim();
      const total=parseFloat(r['รวมเงิน']||r['total'])||0;
      const no=String(r['เลขที่']||r['invoiceNo']||'').trim();
      if(!t&&!total){skip.push({row,reason:'ไม่มีผู้เช่า+ยอด'});return;}
      if(no&&existInvNos.has(no)){skip.push({row,reason:'เลขที่ "'+no+'" ซ้ำ'});return;}
      ok.push(r);if(no)existInvNos.add(no);
    }else if(type==='staff'){
      const n=(r['ชื่อ']||r['name']||'').trim();
      const email=String(r['อีเมล']||r['email']||'').trim().toLowerCase();
      if(!n){skip.push({row,reason:'ไม่มีชื่อ'});return;}
      if(!email||!/.+@.+\..+/.test(email)){skip.push({row,reason:'ไม่มีอีเมลหรือรูปแบบผิด'});return;}
      if(existStaffEmails.has(email)){skip.push({row,reason:'อีเมล '+email+' ซ้ำ'});return;}
      ok.push(r);existStaffEmails.add(email);
    }
  });
  return {ok,skip};
}

function doImportExcel(type){
  const file=window._importExcelFile;
  if(!file){toast('ไม่พบไฟล์','error');return;}
  const reader=new FileReader();
  reader.onload=(ev)=>{
    try{
      const data=new Uint8Array(ev.target.result);
      const wb=XLSX.read(data,{type:'array'});
      // Auto-select named sheet for DB_Ready.xlsx multi-sheet format, fallback to first sheet
      const sheetName=wb.SheetNames.includes(type)?type:wb.SheetNames[0];
      const ws=wb.Sheets[sheetName];
      const rows=XLSX.utils.sheet_to_json(ws);
      if(rows.length===0){toast('ไม่พบข้อมูลในไฟล์','warning');return;}
      const v=_validateImportRows(type,rows);
      const typeLabel={contracts:'สัญญาเช่า',properties:'ทรัพย์สิน',invoices:'ใบแจ้งหนี้',staff:'พนักงาน'}[type]||type;
      window._pendingImport={type,rows:v.ok};
      const skipHTML=v.skip.length?`<div style="margin-top:10px;padding:10px;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;max-height:140px;overflow:auto"><div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:6px">⚠ ข้าม ${v.skip.length} แถว</div>${v.skip.slice(0,20).map(s=>`<div style="font-size:11px;color:#78350f">แถว ${s.row}: ${s.reason}</div>`).join('')}${v.skip.length>20?`<div style="font-size:11px;color:#78350f;font-style:italic">...และอีก ${v.skip.length-20}</div>`:''}</div>`:'';
      $('mtitle').textContent='ตรวจสอบก่อน Import';
      $('mbody').innerHTML=`
        <div style="padding:8px 0">
          <div style="display:flex;gap:12px;margin-bottom:12px">
            <div style="flex:1;padding:14px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;text-align:center">
              <div style="font-size:24px;font-weight:800;color:#15803d">${v.ok.length}</div>
              <div style="font-size:11px;color:#166534;margin-top:2px">จะ Import</div>
            </div>
            <div style="flex:1;padding:14px;background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;text-align:center">
              <div style="font-size:24px;font-weight:800;color:#dc2626">${v.skip.length}</div>
              <div style="font-size:11px;color:#991b1b;margin-top:2px">จะข้าม</div>
            </div>
          </div>
          <p style="font-size:12px;color:#475569">ประเภท: <b>${typeLabel}</b> · รวม ${rows.length} แถวในไฟล์</p>
          ${skipHTML}
          <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">
            <button onclick="closeModal()" style="padding:8px 16px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;cursor:pointer;font-family:Sarabun">ยกเลิก</button>
            <button onclick="_executeImportExcel()" ${v.ok.length===0?'disabled':''} style="padding:8px 18px;background:${v.ok.length===0?'#cbd5e1':'#16a34a'};color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:${v.ok.length===0?'not-allowed':'pointer'};font-family:Sarabun">✓ ยืนยัน Import ${v.ok.length} รายการ</button>
          </div>
        </div>`;
      $('modal').classList.remove('hidden');
    }catch(err){toast('อ่านไฟล์ไม่ได้: '+err.message,'error');}
  };
  reader.readAsArrayBuffer(file);
}

function _executeImportExcel(){
  const pending=window._pendingImport;
  if(!pending){toast('ไม่มีข้อมูล','error');return;}
  const type=pending.type;
  const rows=pending.rows;
  const file=window._importExcelFile;
  (function run(){
    try{
      let imported=0;

      const _bool=(v)=>v===true||v==='True'||v==='true'||v===1||v==='1';
      const _num=(v,fallback=null)=>{const n=parseFloat(v);return isNaN(n)?fallback:n;};
      const _str=(v)=>v==null?'':String(v).trim();

      if(type==='contracts'){
        let maxId=DB.nextCId-1;
        rows.forEach(r=>{
          const tenant=_str(r['tenant']||r['ผู้เช่า']||r['Tenant']||'');
          const property=_str(r['property']||r['ทรัพย์สิน']||r['Property']||r['ห้อง']||'');
          if(!tenant&&!property)return;

          // Use id from xlsx (fresh import) or auto-assign
          const srcId=_num(r['id']);
          const cid=(srcId&&srcId>0)?srcId:DB.nextCId++;
          if(cid>maxId)maxId=cid;

          // pid: use from xlsx, or match by property name
          const srcPid=_num(r['pid']);
          const matchProp=(!srcPid||srcPid<=0)?DB.properties.find(p=>p.name===property||p.name?.includes(property)):null;
          const pid=(srcPid&&srcPid>0)?srcPid:(matchProp?.pid||null);

          // Raw text fields (backward compat for existing render/payFreq/print code)
          const rate=_str(r['rateRaw']||r['ค่าเช่า']||r['rate']||r['Rate']||'');
          const payment=_str(r['payRaw']||r['การชำระ']||r['payment']||'');
          const deposit=_str(r['depositRaw']||r['เงินประกัน']||r['deposit']||'');
          const tenantAddr=_str(r['tenantAddr_raw']||r['ที่อยู่ผู้เช่า']||r['tenantAddr']||'');
          const landlordAddr=_str(r['landlordAddr_raw']||r['ที่อยู่ผู้ให้เช่า']||r['landlordAddr']||'');

          DB.contracts.push({
            id:cid, pid:pid,
            // Identity
            no:_str(r['no']||r['เลขที่สัญญา']||''),
            date:normalizeBEDate(_str(r['date']||r['วันที่ทำสัญญา']||'')),
            madeAt:_str(r['madeAt']||r['ทำที่']||''),
            // Tenant
            tenant:tenant, property:property,
            phone:_str(r['phone']||r['เบอร์โทร']||''),
            purpose:_str(r['purpose']||r['วัตถุประสงค์']||''),
            taxId:_str(r['taxId']||r['เลขผู้เสียภาษี']||''),
            taxIdKind:_str(r['taxIdKind']||''),
            taxIdRemark:_str(r['taxIdRemark']||''),
            tenantAddr:tenantAddr,
            tenantAddr_line:_str(r['tenantAddr_line']||''),
            tenantAddr_subdistrict:_str(r['tenantAddr_subdistrict']||''),
            tenantAddr_district:_str(r['tenantAddr_district']||''),
            tenantAddr_province:_str(r['tenantAddr_province']||''),
            coTenants:_str(r['coTenants']||''),
            guarantorName:_str(r['guarantorName']||''),
            guarantorTaxId:_str(r['guarantorTaxId']||''),
            guarantorAddr_line:_str(r['guarantorAddr_line']||''),
            guarantorAddr_subdistrict:_str(r['guarantorAddr_subdistrict']||''),
            guarantorAddr_district:_str(r['guarantorAddr_district']||''),
            guarantorAddr_province:_str(r['guarantorAddr_province']||''),
            // Landlord
            landlord:_str(r['landlord']||r['ผู้ให้เช่า']||''),
            landlordSignerName:_str(r['landlordSignerName']||''),
            landlordAddr:landlordAddr,
            landlordAddr_line:_str(r['landlordAddr_line']||''),
            landlordAddr_subdistrict:_str(r['landlordAddr_subdistrict']||''),
            landlordAddr_district:_str(r['landlordAddr_district']||''),
            landlordAddr_province:_str(r['landlordAddr_province']||''),
            // Dates & duration
            start:normalizeBEDate(_str(r['start']||r['วันเริ่ม']||'')),
            end:normalizeBEDate(_str(r['end']||r['วันสิ้นสุด']||'')),
            durMonths:_num(r['durMonths']),
            durDays:_num(r['durDays']),
            dur:_str(r['durRaw']||r['ระยะเวลา']||r['dur']||''),
            // Rate (raw for display + structured for calc)
            rate:rate,
            rateAmount:_num(r['rateAmount']),
            rateFreq:_str(r['rateFreq']||''),
            monthlyBaht:_num(r['monthlyBaht']),
            // Deposit
            deposit:deposit,
            depositAmount:_num(r['depositAmount']),
            // Escalation
            rateAdj:_str(r['rateAdjRaw']||r['ปรับค่าเช่า']||r['rateAdj']||''),
            escalationPct:_num(r['escalationPct']),
            escalationCycle:_str(r['escalationCycle']||''),
            escalationBase:_num(r['escalationBase']),
            escalationStartYear:_num(r['escalationStartYear']),
            // Payment (raw for display + structured for invoice gen)
            payment:payment,
            payTiming:_str(r['payTiming']||''),
            payFreq:_str(r['payFreq']||''),
            payDueDay:_num(r['payDueDay']),
            payDueMonth:_num(r['payDueMonth']),
            payInstallments:_num(r['payInstallments']),
            payAmount:_num(r['payAmount']),
            prepaid:_bool(r['prepaid']),
            // Bank
            bank:_str(r['bank']||r['ธนาคาร']||''),
            acctNo:_str(r['acctNo']||r['เลขบัญชี']||''),
            accountName:_str(r['accountName']||r['ชื่อบัญชี']||''),
            // Property details
            area:_str(r['area']||r['พื้นที่']||''),
            // Meters
            meterElecStart:_num(r['meterElecStart']),
            meterElecRate:_num(r['meterElecRate']),
            meterWaterStart:_num(r['meterWaterStart']),
            meterWaterRate:_num(r['meterWaterRate']),
            // Status flags
            signed:_bool(r['signed']),
            cancelled:_bool(r['cancelled']||r['ยกเลิก']||false),
          });
          imported++;
        });
        // Advance nextCId past imported IDs
        const newMax=DB.contracts.reduce((m,c)=>c.id>m?c.id:m,DB.nextCId-1);
        DB.nextCId=newMax+1;

      } else if(type==='properties'){
        let maxPid=DB.nextPId-1;
        rows.forEach(r=>{
          const name=_str(r['name']||r['ชื่อ']||r['Name']||r['ทรัพย์สิน']||'');
          if(!name)return;
          const srcPid=_num(r['pid']);
          const pid=(srcPid&&srcPid>0)?srcPid:DB.nextPId++;
          if(pid>maxPid)maxPid=pid;
          const addrParts=[r['addr_line'],r['addr_subdistrict'],r['addr_district'],r['addr_province']].filter(Boolean);
          DB.properties.push({
            pid:pid, name:name,
            description:_str(r['description']||''),
            propertyType:_str(r['propertyType']||''),
            // Structured address
            addr_line:_str(r['addr_line']||''),
            addr_subdistrict:_str(r['addr_subdistrict']||''),
            addr_district:_str(r['addr_district']||''),
            addr_province:_str(r['addr_province']||''),
            // Backward-compat aliases
            location:addrParts.length?addrParts.join(' '):_str(r['ที่อยู่']||r['location']||''),
            province:_str(r['addr_province']||r['จังหวัด']||r['province']||''),
            type:_str(r['propertyType']||r['ประเภท']||r['type']||''),
            // Other fields
            titleDeed:_str(r['titleDeed']||''),
            area:_str(r['area']||r['พื้นที่']||''),
            owner:_str(r['owner']||r['เจ้าของ']||''),
            status:_str(r['status']||''),
          });
          imported++;
        });
        const newMax=DB.properties.reduce((m,p)=>p.pid>m?p.pid:m,DB.nextPId-1);
        DB.nextPId=newMax+1;
      } else if(type==='staff'){
        if(!DB.staff)DB.staff=[];
        const existingEmails=new Set(DB.staff.map(s=>(s.email||'').toLowerCase()).filter(Boolean));
        const existingNames=new Set(DB.staff.map(s=>s.name));
        rows.forEach(r=>{
          const name=(r['ชื่อ']||r['name']||'').trim();
          const email=String(r['อีเมล']||r['email']||'').trim().toLowerCase();
          if(!name||!email)return;
          if(existingEmails.has(email)||existingNames.has(name))return;
          DB.staff.push({
            name,role:r['ตำแหน่ง']||r['role']||'',email,
            signatureImg:'',
            createdAt:new Date().toISOString()
          });
          existingPins.add(pin);existingNames.add(name);
          imported++;
        });
      } else if(type==='invoices'){
        rows.forEach(r=>{
          const invId=DB.nextInvId++;
          const invoiceNo=r['เลขที่']||r['invoiceNo']||'INV-'+invId;
          const tenant=r['ผู้เช่า']||r['tenant']||'';
          const total=parseFloat(r['รวมเงิน']||r['total'])||0;
          if(!tenant&&!total)return;

          // Try to match contract
          const matchContract=DB.contracts.find(c=>c.tenant===tenant);

          DB.invoices.push({
            id:invId,cid:matchContract?.id||null,pid:matchContract?.pid||null,
            month:r['ประจำเดือน']||r['month']||'',
            tenant:tenant,property:r['ทรัพย์สิน']||r['property']||matchContract?.property||'',
            invoiceNo:String(invoiceNo),
            date:r['วันที่ออก']||r['date']||'',
            dueDate:r['กำหนดชำระ']||r['dueDate']||'',
            items:[{desc:'ค่าเช่า',amount:total}],
            total:total,
            headerId:DB.defaultInvHeader||null,
            freqType:r['ความถี่']||'monthly',freqLabel:r['ความถี่']||'รายเดือน',
            status:r['สถานะ']==='ชำระแล้ว'?'paid':r['สถานะ']==='ส่งแล้ว'?'sent':'draft',
            createdAt:new Date().toISOString()
          });
          imported++;
        });
      }

      save();
      addActivityLog('import_excel',`Import Excel (${type}) จาก ${file.name} — ${imported} รายการ`);
      save();
      closeModal(true);

      // Post-import validation summary (สำหรับ contracts เท่านั้น)
      let summaryMsg = `Import สำเร็จ — ${imported} รายการ`;
      if(type==='contracts' && typeof scanContractIssues==='function'){
        try{
          const scan = scanContractIssues();
          if(scan.length > 0){
            summaryMsg += ` · ⚠️ ${scan.length} มีปัญหา`;
            setTimeout(()=>{
              if(confirm(`Import เข้า ${imported} รายการแล้ว\n\nพบ ${scan.length} สัญญามีข้อมูลที่ต้องแก้\n\nต้องการไปหน้า "ข้อมูลต้องแก้" เลยไหม?`)){
                showPage('datafix');
              }
            }, 800);
          }
        }catch(e){console.warn('post-import scan failed:',e);}
      }
      toast(summaryMsg);
      render();
      window._pendingImport=null;
    }catch(err){
      toast('Import ไม่ได้: '+err.message,'error');
    }
  })();
}

// Download empty Excel template for given type
function downloadExcelTemplate(type){
  if(typeof XLSX==='undefined'){toast('กำลังโหลด SheetJS...','warning');return;}
  const headers={
    contracts:['เลขที่สัญญา','วันที่ทำสัญญา','ทรัพย์สิน','ผู้เช่า','เบอร์โทร','เลขผู้เสียภาษี','ที่อยู่ผู้เช่า','วันเริ่ม','วันสิ้นสุด','ระยะเวลา','ค่าเช่า','การชำระ','เงินประกัน','ผู้ให้เช่า','ที่อยู่ผู้ให้เช่า','ธนาคาร','เลขบัญชี','ชื่อบัญชี'],
    properties:['ชื่อ','ที่อยู่','จังหวัด','ประเภท','เจ้าของ'],
    invoices:['เลขที่','ประจำเดือน','ผู้เช่า','ทรัพย์สิน','รวมเงิน','ความถี่','สถานะ','วันที่ออก','กำหนดชำระ'],
    staff:['ชื่อ','ตำแหน่ง','PIN']
  }[type];
  if(!headers){toast('ไม่รู้จัก type','error');return;}
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet([headers]);
  XLSX.utils.book_append_sheet(wb,ws,'template');
  const fname=`template_${type}_${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb,fname);
  toast('ดาวน์โหลด template สำเร็จ — '+fname);
}

// ========== IMPORT DB_READY FORMAT ==========
// รองรับไฟล์ที่มี sheet ชื่อ "contracts" + "properties" (English columns)
function doImportDBReady(){
  const file = window._importExcelFile;
  if(!file){ toast('ไม่พบไฟล์','error'); return; }
  customConfirm('Import จาก DB_Ready',
    'จะเพิ่ม properties + contracts จากไฟล์นี้\n(ไม่ลบข้อมูลเดิม)',
    function(){
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const wb = XLSX.read(new Uint8Array(ev.target.result), {type:'array'});
          const getSheet = (name) => {
            const ws = wb.Sheets[name];
            return ws ? XLSX.utils.sheet_to_json(ws) : [];
          };

          // Properties
          const propRows = getSheet('properties');
          let addedProps = 0;
          propRows.forEach(r => {
            if(!r.pid && !r.name) return;
            const pid = r.pid || DB.nextPId++;
            // skip ถ้ามีแล้ว
            if(DB.properties.find(p => p.pid === pid || p.name === r.name)) return;
            DB.properties.push({
              pid, name: r.name||'', location: r['addr.line']||r.description||'',
              province: r['addr.province']||'', type: r.propertyType||'',
              owner: r.owner||'', status: r.status||'active',
              titleDeed: r.titleDeed||'', area: r.area||''
            });
            if(pid >= DB.nextPId) DB.nextPId = pid + 1;
            addedProps++;
          });

          // Contracts
          const conRows = getSheet('contracts');
          let addedCons = 0;
          conRows.forEach(r => {
            if(!r.tenant && !r.no) return;
            const id = r.id || DB.nextCId++;
            if(DB.contracts.find(c => c.id === id || c.no === r.no)) return;
            DB.contracts.push({
              id, pid: r.pid||null, no: r.no||'',
              date: r.date||'', madeAt: r.madeAt||'',
              tenant: r.tenant||'', taxId: r.taxId||'', phone: r.phone||'',
              tenantAddr: r['tenantAddr.raw']||r.tenantAddr||'',
              landlord: r.landlord||'', landlordAddr: r.landlordAddr||'',
              landlordSignerName: r.landlordSignerName||'',
              property: r.property||'', area: r.area||'', purpose: r.purpose||'',
              start: String(r.start||''), end: String(r.end||''),
              rate: r.monthlyBaht ? ('เดือนละ '+Number(r.monthlyBaht).toLocaleString()+' บาท') : (r.rateAmount ? (Number(r.rateAmount).toLocaleString()+' บาท') : ''),
              deposit: r.depositAmount ? (Number(r.depositAmount).toLocaleString()+' บาท') : '',
              bank: r.bank||'', acctNo: r.acctNo||'', accountName: r.accountName||'',
              signed: r.signed === true || r.signed === 'true' || r.signed === 1,
              cancelled: r.cancelled === true || r.cancelled === 'true' || r.cancelled === 1,
              status: r.status||'active'
            });
            if(id >= DB.nextCId) DB.nextCId = id + 1;
            addedCons++;
          });

          // Auto-generate invoiceHeaders จาก contract.landlord (ถ้ายังไม่มี)
          let addedHeaders = 0;
          if(!DB.invoiceHeaders) DB.invoiceHeaders = [];
          if(DB.invoiceHeaders.length === 0 && DB.contracts.length > 0) {
            const landlordMap = {};
            let ts = Date.now();
            DB.contracts.forEach(c => {
              if(!c.landlord || landlordMap[c.landlord]) return;
              const hId = ts++;
              landlordMap[c.landlord] = hId;
              DB.invoiceHeaders.push({
                id: hId,
                name: c.landlord.replace(/บริษัท\s*/g,'บจก.').replace(/\s*จำกัด/g,'').replace(/\s*โดย\s*.+/,'').substring(0,30),
                companyName: c.landlord,
                address: c.landlordAddr||'', phone:'', taxId:'',
                bankName: c.bank||'', bankAccount: c.acctNo||'', bankAccountName: c.accountName||'',
                logo: null, vatRegistered: false, vatRate: 7, vatMode: 'none'
              });
              addedHeaders++;
            });
            if(DB.invoiceHeaders.length > 0 && !DB.defaultInvHeader) DB.defaultInvHeader = DB.invoiceHeaders[0].id;
            DB.contracts.forEach(c => {
              if(c.landlord && landlordMap[c.landlord] && !c.invHeaderId) c.invHeaderId = landlordMap[c.landlord];
            });
          }
          save();
          addActivityLog('import_db_ready', `Import DB_Ready: +${addedProps} ทรัพย์สิน, +${addedCons} สัญญา, +${addedHeaders} ผู้ให้เช่า`);
          closeModal(true);
          toast(`Import สำเร็จ — ${addedProps} ทรัพย์สิน, ${addedCons} สัญญา${addedHeaders?', '+addedHeaders+' ผู้ให้เช่า':''}`,'success');
          render();
        } catch(err) {
          toast('อ่านไฟล์ไม่ได้: '+err.message,'error');
        }
      };
      reader.readAsArrayBuffer(file);
    }, {icon:'📦', yesLabel:'Import', yesColor:'#15803d'}
  );
}

