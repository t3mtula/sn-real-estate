// ========== SETTINGS PAGE ==========
function renderSettingsPage(){
  if(!hasPermission('settings')){
    document.getElementById('content').innerHTML='<div style="text-align:center;padding:60px;color:#64748b"><div style="font-size:48px;margin-bottom:12px">🔒</div>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>';
    return;
  }

  const tabs=[
    {id:'company',label:'ข้อมูลบริษัท',icon:'🏢'},
    {id:'invoice',label:'ใบแจ้งหนี้',icon:'📄'},
    {id:'contractform',label:'ฟอร์มสัญญา',icon:'📝'},
    {id:'display',label:'การแสดงผล',icon:'🎨'},
    {id:'system',label:'ระบบ',icon:'⚙️'},
    {id:'staff',label:'พนักงาน',icon:'👥'}
  ];

  const tabHTML=`<div style="display:flex;gap:2px;background:#f1f5f9;border-radius:10px;padding:3px;margin-bottom:20px">
    ${tabs.map(t=>{
      const isActive=settingsTab===t.id;
      return `<button onclick="settingsTab='${t.id}';renderSettingsPage()" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:8px;border:none;font-size:13px;font-weight:${isActive?'600':'500'};font-family:Sarabun;cursor:pointer;${isActive?'background:#fff;color:#4338ca;box-shadow:0 1px 3px rgba(0,0,0,.1)':'background:transparent;color:#64748b'}">${t.icon} ${t.label}</button>`;
    }).join('')}
  </div>`;

  let bodyHTML='';

  if(settingsTab==='company'){
    bodyHTML=renderSettingsCompany();
  } else if(settingsTab==='invoice'){
    bodyHTML=renderSettingsInvoice();
  } else if(settingsTab==='contractform'){
    bodyHTML=renderSettingsContractForm();
  } else if(settingsTab==='display'){
    bodyHTML=renderSettingsDisplay();
  } else if(settingsTab==='system'){
    bodyHTML=renderSettingsSystem();
  } else if(settingsTab==='staff'){
    bodyHTML=renderSettingsStaff();
  }

  document.getElementById('content').innerHTML=tabHTML+bodyHTML;
  // After DOM ready: fire post-render inits
  if(settingsTab==='invoice'){
    clearTimeout(_invInitTimer);
    _invInitTimer=setTimeout(updateInvoicePreview,0);
  }
  if(settingsTab==='contractform'){
    setTimeout(function(){ renderCfEditor(); updateCfPreview(); }, 0);
  }
  if(settingsTab==='system') { setTimeout(function(){ renderAutoBackupList(); }, 50); }
}

function renderSettingsDisplay(){
  if(!DB.sysConfig) DB.sysConfig={};
  const cfg=DB.sysConfig;
  if(!cfg.signers) cfg.signers=[{name:'สมบัติ',title:'กรรมการผู้จัดการ'},{name:'อยุทธ์',title:'ผู้รับมอบอำนาจ'}];
  const signers=cfg.signers;

  return `<div>
    <!-- ── ผู้เซ็น & พยาน ── -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <div style="width:4px;height:22px;background:#7c3aed;border-radius:2px"></div>
      <h3 style="font-size:16px;font-weight:700;color:#1e293b">ผู้เซ็น & พยาน</h3>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div>
          <div style="font-size:13px;font-weight:600;color:#1e293b">✍️ รายชื่อผู้เซ็นและพยาน (สัญญาเช่า)</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">ใช้เป็น dropdown ให้เลือกตอนทำสัญญา</div>
        </div>
        <button onclick="addSignerRow()" style="padding:6px 14px;background:#eef2ff;color:#4338ca;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">+ เพิ่มคน</button>
      </div>
      <div id="signerList" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
        ${signers.map((s,i)=>`<div style="display:flex;gap:8px;align-items:center">
          <input type="text" value="${(s.name||'').replace(/"/g,'&quot;')}" placeholder="ชื่อ" onchange="DB.sysConfig.signers[${i}].name=this.value.trim();save()" style="flex:1;padding:7px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
          <input type="text" value="${(s.title||'').replace(/"/g,'&quot;')}" placeholder="ตำแหน่ง (เช่น กรรมการผู้จัดการ)" onchange="DB.sysConfig.signers[${i}].title=this.value.trim();save()" style="flex:1.3;padding:7px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
          <button onclick="removeSignerRow(${i})" style="padding:6px 10px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;font-size:11px;cursor:pointer;font-family:Sarabun">ลบ</button>
        </div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding-top:12px;border-top:1px solid #f1f5f9">
        <div>
          <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">พยานเริ่มต้น 1</label>
          <select onchange="DB.sysConfig.defaultWitness1=this.value;save();toast('บันทึกแล้ว')" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
            <option value="">— ไม่ตั้งค่า —</option>
            ${signers.map(s=>`<option value="${(s.name||'').replace(/"/g,'&quot;')}" ${cfg.defaultWitness1===s.name?'selected':''}>${s.name||'-'}${s.title?' ('+s.title+')':''}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">พยานเริ่มต้น 2</label>
          <select onchange="DB.sysConfig.defaultWitness2=this.value;save();toast('บันทึกแล้ว')" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
            <option value="">— ไม่ตั้งค่า —</option>
            ${signers.map(s=>`<option value="${(s.name||'').replace(/"/g,'&quot;')}" ${cfg.defaultWitness2===s.name?'selected':''}>${s.name||'-'}${s.title?' ('+s.title+')':''}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="font-size:10px;color:#64748b;margin-top:8px">💡 พยานเริ่มต้นจะถูก pre-fill ทุกสัญญาใหม่</div>
    </div>

    <!-- ── การแสดงผล ── -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <div style="width:4px;height:22px;background:#6366f1;border-radius:2px"></div>
      <h3 style="font-size:16px;font-weight:700;color:#1e293b">การแสดงผล</h3>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:20px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div>
          <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">ชื่อระบบ</label>
          <input type="text" value="${cfg.appName||'SN Rental Manager'}" onchange="DB.sysConfig.appName=this.value.trim();save();toast('บันทึกแล้ว')" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">สกุลเงิน</label>
          <select onchange="DB.sysConfig.currency=this.value;save();toast('บันทึกแล้ว')" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
            <option value="THB" ${(cfg.currency||'THB')==='THB'?'selected':''}>บาท (THB)</option>
            <option value="USD" ${cfg.currency==='USD'?'selected':''}>US Dollar (USD)</option>
            <option value="EUR" ${cfg.currency==='EUR'?'selected':''}>Euro (EUR)</option>
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
        <div>
          <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">รูปแบบวันที่</label>
          <select onchange="DB.sysConfig.dateFormat=this.value;save();toast('บันทึกแล้ว')" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
            <option value="BE" ${(cfg.dateFormat||'BE')==='BE'?'selected':''}>พ.ศ. (DD/MM/BBBB)</option>
            <option value="CE" ${cfg.dateFormat==='CE'?'selected':''}>ค.ศ. (DD/MM/YYYY)</option>
          </select>
        </div>
        <div>
          <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">จำนวนรายการต่อหน้า</label>
          <input type="number" value="${cfg.pageSize||15}" min="5" max="100" onchange="DB.sysConfig.pageSize=parseInt(this.value)||15;save();toast('บันทึกแล้ว')" style="width:100%;padding:8px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
        </div>
      </div>
    </div>

    <!-- ── การแจ้งเตือน ── -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <div style="width:4px;height:22px;background:#f59e0b;border-radius:2px"></div>
      <h3 style="font-size:16px;font-weight:700;color:#1e293b">การแจ้งเตือน</h3>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:20px">
      <div style="display:flex;flex-direction:column;gap:10px">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
          <input type="checkbox" ${cfg.warnExpiring!==false?'checked':''} onchange="DB.sysConfig.warnExpiring=this.checked;save()">
          <span style="font-size:13px">แจ้งเตือนสัญญาใกล้หมดอายุ</span>
        </label>
        <div style="display:flex;align-items:center;gap:10px;padding-left:24px">
          <span style="font-size:13px;color:#64748b">เตือนล่วงหน้า</span>
          <input type="number" min="30" max="180" step="1" value="${Number(cfg.expiringDays)||90}" style="width:72px;padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;text-align:center" onchange="var v=parseInt(this.value,10);if(isNaN(v)||v<30)v=30;if(v>180)v=180;this.value=v;DB.sysConfig.expiringDays=v;save();if(typeof render==='function')render();if(typeof toast==='function')toast('เปลี่ยนเป็น '+v+' วันก่อนหมด');">
          <span style="font-size:13px;color:#64748b">วันก่อนหมดอายุ (30–180, default 90)</span>
        </div>
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
          <input type="checkbox" ${cfg.warnOverdue!==false?'checked':''} onchange="DB.sysConfig.warnOverdue=this.checked;save()">
          <span style="font-size:13px">แจ้งเตือนใบแจ้งหนี้เกินกำหนด</span>
        </label>
      </div>
    </div>
  </div>`;
}

function renderSettingsContractForm(){
  const tpl=getActiveTemplate();
  if(!cfEditTpl||cfEditTpl._tplId!==tpl.id) cfEditTpl={_tplId:tpl.id,name:tpl.name,intro:tpl.intro,clauses:[...tpl.clauses]};
  const templates=DB.templates||[];
  return `
    <!-- Split view: left=version bar+editor, right=preview -->
    <div style="display:flex;gap:12px;height:calc(100vh - 200px)">

      <!-- Left panel -->
      <div style="flex:1;min-width:0;border:1px solid #e2e8f0;border-radius:12px;background:#fff;overflow:hidden;display:flex;flex-direction:column">

        <!-- Version bar — sticky inside left panel -->
        <div style="padding:10px 14px;border-bottom:1px solid #e2e8f0;background:#f8fafc;flex-shrink:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <select id="cfTplSelect" onchange="cfSwitchTemplate(+this.value)" style="padding:6px 10px;border:1px solid #e2e8f0;border-radius:7px;font-size:12px;font-family:Sarabun;background:#fff;color:#1e293b;font-weight:600;min-width:160px">
              ${templates.map(t=>`<option value="${t.id}" ${t.id===tpl.id?'selected':''}>${t.name}${t.id===tpl.id?' ✓':''}</option>`).join('')}
            </select>
            <button onclick="cfNewVersion()" style="padding:6px 12px;border:1px solid #16a34a;color:#16a34a;background:#f0fdf4;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun;white-space:nowrap">+ สร้างใหม่</button>
            <button onclick="cfDuplicateVersion()" style="padding:6px 12px;border:1px solid #e2e8f0;color:#475569;background:#fff;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun;white-space:nowrap">คัดลอก</button>
            ${templates.length>1?`<button onclick="cfDeleteVersion()" style="padding:6px 12px;border:1px solid #fca5a5;color:#dc2626;background:#fff;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun;white-space:nowrap">ลบ</button>`:''}
            <div style="margin-left:auto">
              ${tpl.id!==DB.activeTemplate
                ?`<button onclick="cfSetActive(${tpl.id})" style="padding:6px 12px;background:#eef2ff;color:#4338ca;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun;white-space:nowrap">ตั้งเป็นค่าเริ่มต้น</button>`
                :`<span style="font-size:11px;color:#16a34a;font-weight:600;background:#f0fdf4;padding:4px 10px;border-radius:99px;border:1px solid #bbf7d0">✓ ค่าเริ่มต้น</span>`}
            </div>
          </div>
        </div>

        <!-- Editor — scrollable -->
        <div style="flex:1;overflow-y:auto;padding:16px">
          <div id="cfEditor"></div>
        </div>
      </div>

      <!-- Right panel: A4 Preview -->
      <div style="flex:0 0 48%;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;overflow:hidden;display:flex;flex-direction:column">
        <div style="padding:10px 14px;border-bottom:1px solid #e2e8f0;background:#fff;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
          <span style="font-size:12px;font-weight:600;color:#475569">🖨️ A4 Preview</span>
          <button onclick="cfPrintPreview()" style="display:flex;align-items:center;gap:5px;padding:5px 12px;background:#4f46e5;color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun" onmouseover="this.style.background='#4338ca'" onmouseout="this.style.background='#4f46e5'"><svg style="width:13px;height:13px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>ตัวอย่างพิมพ์</button>
        </div>
        <iframe id="cfPreviewFrame" style="flex:1;border:none;background:#fff" srcdoc=""></iframe>
      </div>

    </div>

    <!-- ── Template ตรวจรับคืนทรัพย์ ── -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;margin-top:24px">
      <div style="width:4px;height:22px;background:#059669;border-radius:2px"></div>
      <h3 style="font-size:16px;font-weight:700;color:#1e293b">Template ตรวจรับคืนทรัพย์</h3>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div>
          <div style="font-size:14px;font-weight:600;color:#1e293b">🔍 Template รายการตรวจรับคืนทรัพย์</div>
          <div style="font-size:11px;color:#64748b;margin-top:2px">รายการนี้จะใช้ทุกครั้งที่เปิดฟอร์ม Inspection — เพิ่ม/ลบ/เรียงลำดับได้</div>
        </div>
        <button onclick="inspSettingAddItem()" style="padding:6px 14px;background:#eef2ff;color:#4338ca;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">+ เพิ่มรายการ</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${(()=>{
          const cl=(DB.sysConfig&&DB.sysConfig.inspectionChecklist)||[];
          if(!cl.length) return '<div style="text-align:center;color:#64748b;font-size:12px;padding:12px">ยังไม่มีรายการ — กด "+ เพิ่มรายการ"</div>';
          return cl.map((item,i)=>`
            <div style="display:flex;gap:8px;align-items:center">
              <span style="font-size:12px;color:#64748b;width:20px;text-align:right">${i+1}</span>
              <input type="text" value="${(item.label||'').replace(/"/g,'&quot;')}" placeholder="ชื่อรายการตรวจ"
                onchange="DB.sysConfig.inspectionChecklist[${i}].label=this.value.trim();save()"
                style="flex:1;padding:7px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:13px;font-family:Sarabun">
              <button onclick="inspSettingMoveItem(${i},-1)" ${i===0?'disabled':''} style="padding:5px 8px;background:#f1f5f9;color:#64748b;border:none;border-radius:5px;cursor:pointer;font-size:11px${i===0?';opacity:.3':''}">▲</button>
              <button onclick="inspSettingMoveItem(${i},1)" ${i===cl.length-1?'disabled':''} style="padding:5px 8px;background:#f1f5f9;color:#64748b;border:none;border-radius:5px;cursor:pointer;font-size:11px${i===cl.length-1?';opacity:.3':''}">▼</button>
              <button onclick="inspSettingRemoveItem(${i})" style="padding:5px 9px;background:#fee2e2;color:#dc2626;border:none;border-radius:5px;cursor:pointer;font-size:11px;font-family:Sarabun">ลบ</button>
            </div>
          `).join('');
        })()}
      </div>
    </div>
  `;
}

function renderSettingsCompany(){
  const headers=DB.invoiceHeaders||[];
  let html='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 style="font-size:16px;font-weight:700;color:#1e293b">ข้อมูลผู้ให้เช่า / บริษัท</h3><button onclick="openInvoiceHeaderSettings()" style="padding:8px 16px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">+ เพิ่ม/แก้ไข</button></div>';

  if(headers.length===0){
    html+='<div style="text-align:center;padding:40px;color:#64748b"><div style="font-size:48px;margin-bottom:12px">🏢</div>ยังไม่มีข้อมูลผู้ให้เช่า/บริษัท<br><span style="font-size:12px">กดปุ่มด้านบนเพื่อเพิ่ม</span></div>';
  } else {
    headers.forEach(h=>{
      html+=`<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:12px">
        <div style="display:flex;gap:16px;align-items:start">
          ${h.logo?'<img src="'+esc(h.logo)+'" style="width:60px;height:60px;object-fit:contain;border-radius:8px;border:1px solid #e5e7eb">':'<div style="width:60px;height:60px;background:#f1f5f9;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:24px">🏢</div>'}
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;color:#1e293b;font-size:15px">${esc(h.companyName||h.name)||'-'}</div>
            <div style="font-size:11px;color:#64748b;margin-top:2px">${esc(h.address)||'-'}</div>
            <div style="font-size:11px;color:#64748b">${h.phone?'Tel: '+esc(h.phone):''} ${h.taxId?'| Tax: '+esc(h.taxId):''}</div>
            ${h.bankName?'<div style="font-size:11px;color:#0369a1;margin-top:4px">🏦 '+esc(h.bankName)+' '+esc(h.bankAccount)+' ('+esc(h.bankAccountName)+')</div>':''}
            ${h.notes?'<div style="font-size:10px;color:#92400e;margin-top:4px;background:#fffbeb;padding:4px 8px;border-radius:4px">📝 '+esc(h.notes.substring(0,80))+(h.notes.length>80?'...':'')+'</div>':''}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
            ${h.id===DB.defaultInvHeader?'<span style="font-size:10px;background:#dcfce7;color:#15803d;padding:3px 10px;border-radius:99px;font-weight:600;white-space:nowrap">ค่าเริ่มต้น</span>':''}
            <span style="font-size:10px;padding:3px 10px;border-radius:99px;font-weight:600;white-space:nowrap;${(h.vatRate||0)>0?'background:#fef3c7;color:#92400e':'background:#f1f5f9;color:#64748b'}">VAT ${h.vatRate!=null?h.vatRate:7}%</span>
          </div>
        </div>
      </div>`;
    });
  }
  return html;
}

let _invPreviewMode='invoice'; // 'invoice' | 'receipt' | 'taxinvoice'
let _invPreviewTimer=null;
let _invInitTimer=null; // auto-load timer on settings open

function updateInvoicePreview(mode){
  if(mode){ clearTimeout(_invInitTimer); _invInitTimer=null; _invPreviewMode=mode; }
  const frame=document.getElementById('invPreviewFrame');
  if(!frame) return;
  // Build sample invoice
  const today=new Date();
  const yr=today.getFullYear(); const mo=today.getMonth()+1;
  const cfg=DB.formConfig||{};
  const is=DB.invoiceSettings||{};
  const prefix=cfg.invoicePrefix||'INV';
  const taxPrefix=is.taxPrefix||'TAX';
  const dueDay=cfg.dueDayOfMonth||5;
  const vatRate=is.vatRate||7;
  const base=15000+100+640; // 15740
  const vat=Math.round(base*vatRate/100);
  const sampleInv={
    id:0,
    invoiceNo:`${prefix}-${yr+543}-001`,
    month:`${yr}-${String(mo).padStart(2,'0')}`,
    freqType:'monthly',
    date:`${today.getDate()}/${mo}/${yr+543}`,
    dueDate:`${dueDay}/${mo===12?1:mo+1}/${mo===12?yr+544:yr+543}`,
    property:'ห้อง A101 — อาคารตัวอย่าง',
    tenant:'ตัวอย่าง ผู้เช่า',
    tenantPhone:'089-000-0000',
    items:[
      {desc:'ค่าเช่า',amount:15000},
      {desc:'ค่าน้ำประปา',amount:100},
      {desc:'ค่าไฟฟ้า',amount:640},
    ],
    total:base,
    headerId:null,
    cid:null,
    landlord:'',
    note:is.defaultNote||''
  };
  // Embed-preview scaling CSS (hide print bar, zoom to fit iframe)
  const embedCSS=`<style>
body.embed .no-print{display:none!important}
body.embed>div[style*="height:48px"]{display:none!important}
body.embed{background:#f0f4f8;padding:10px 0}
body.embed .page{zoom:.62;margin:0 auto 8px;box-shadow:0 2px 12px rgba(0,0,0,.12);border-radius:4px}
</style>`;
  let html='';
  try{
    if(_invPreviewMode==='receipt'){
      html=receiptHTML(sampleInv,null);
    } else if(_invPreviewMode==='taxinvoice'){
      // Tax invoice: invoice layout + title swap + VAT rows
      const taxInv={...sampleInv,
        invoiceNo:`${taxPrefix}-${yr+543}-001`,
        items:[
          {desc:'ค่าเช่า',amount:15000},
          {desc:'ค่าน้ำประปา',amount:100},
          {desc:'ค่าไฟฟ้า',amount:640},
          {desc:`ภาษีมูลค่าเพิ่ม ${vatRate}%`,amount:vat},
        ],
        total:base+vat
      };
      html=invoiceHTML([taxInv],null);
      // Swap title from ใบแจ้งหนี้ → ใบกำกับภาษี
      html=html
        .replace(/>ใบแจ้งหนี้<\/span>/g,'>ใบกำกับภาษี</span>')
        .replace(/INVOICE/g,'TAX INVOICE');
    } else {
      html=invoiceHTML([sampleInv],null);
    }
    html=html.replace('</head>',embedCSS+'</head>').replace('<body>','<body class="embed">');
  } catch(e){
    html=`<html><body style="font-family:sans-serif;padding:40px;color:#64748b;text-align:center"><div style="font-size:32px;margin-bottom:12px">⚠️</div>ไม่สามารถแสดง Preview ได้<br><small>${e.message}</small></body></html>`;
  }
  frame.srcdoc=html;
  // Update tab highlights — pill style (white=active, transparent=inactive)
  ['invPrevBtnInv','invPrevBtnTax','invPrevBtnRec'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    const modeMap={invPrevBtnInv:'invoice',invPrevBtnTax:'taxinvoice',invPrevBtnRec:'receipt'};
    const active=_invPreviewMode===modeMap[id];
    el.style.background=active?'#fff':'transparent';
    el.style.color=active?'#4338ca':'#64748b';
    el.style.boxShadow=active?'0 1px 3px rgba(0,0,0,.1)':'none';
  });
}
function updateInvoicePreviewDebounced(){
  clearTimeout(_invPreviewTimer);
  _invPreviewTimer=setTimeout(updateInvoicePreview,320);
}

function renderSettingsInvoice(){
  if(!DB.formConfig) DB.formConfig={};
  if(!DB.invoiceSettings) DB.invoiceSettings={};
  if(!DB.slipOk) DB.slipOk={branchId:'',apiKey:'',enabled:false};
  const cfg=DB.formConfig;
  const is=DB.invoiceSettings;
  const taxEnabled=is.taxInvoiceEnabled||false;
  const slipOk=DB.slipOk;

  return `<div style="display:flex;gap:14px;height:calc(100vh - 260px)">

    <!-- ══ Left: Settings ══ -->
    <div style="flex:1;overflow-y:auto;padding-right:6px">

      <!-- ใบแจ้งหนี้ -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <div style="width:4px;height:22px;background:#6366f1;border-radius:2px"></div>
        <h3 style="font-size:16px;font-weight:700;color:#1e293b">ใบแจ้งหนี้ (Invoice)</h3>
      </div>

      <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:18px;margin-bottom:14px">
        <div style="font-size:13px;font-weight:600;color:#475569;margin-bottom:14px">📋 รูปแบบเลขที่และการชำระ</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          <div>
            <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">คำนำหน้าเลขที่ใบแจ้งหนี้</label>
            <input type="text" value="${cfg.invoicePrefix||'INV'}" oninput="updateInvoicePreviewDebounced()" onchange="DB.formConfig.invoicePrefix=this.value.trim()||'INV';save();toast('บันทึกแล้ว ✓');updateInvoicePreview()" style="width:100%;padding:9px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:Sarabun;box-sizing:border-box">
            <div style="font-size:10px;color:#64748b;margin-top:3px">ตัวอย่าง: INV → INV-2569-001</div>
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">วันครบกำหนดชำระ (วันที่ของเดือนถัดไป)</label>
            <input type="number" value="${cfg.dueDayOfMonth||5}" min="1" max="31" oninput="updateInvoicePreviewDebounced()" onchange="DB.formConfig.dueDayOfMonth=parseInt(this.value)||5;save();toast('บันทึกแล้ว ✓');updateInvoicePreview()" style="width:100%;padding:9px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:Sarabun;box-sizing:border-box">
            <div style="font-size:10px;color:#64748b;margin-top:3px">วันที่ 1-31 · เดือนสั้นใช้วันสุดท้ายอัตโนมัติ</div>
          </div>
        </div>

        <div>
          <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">📝 หมายเหตุเริ่มต้น (แสดงท้ายใบแจ้งหนี้และใบเสร็จทุกใบ)</label>
          <textarea rows="3" placeholder="เช่น กรุณาชำระก่อนวันครบกำหนด หากมีข้อสงสัยติดต่อ 089-xxx-xxxx" oninput="if(!DB.invoiceSettings)DB.invoiceSettings={};DB.invoiceSettings.defaultNote=this.value.trim();updateInvoicePreviewDebounced()" onchange="if(!DB.invoiceSettings)DB.invoiceSettings={};DB.invoiceSettings.defaultNote=this.value.trim();save();toast('บันทึกแล้ว ✓')" style="width:100%;padding:9px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:Sarabun;resize:vertical;box-sizing:border-box">${is.defaultNote||''}</textarea>
          <div style="font-size:10px;color:#64748b;margin-top:3px">สามารถ override ได้ในแต่ละใบโดยไปที่ รายละเอียดใบแจ้งหนี้ → แก้ไข</div>
        </div>
      </div>

      <!-- ใบกำกับภาษี -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:14px;margin-top:24px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:4px;height:22px;background:#f59e0b;border-radius:2px"></div>
          <h3 style="font-size:16px;font-weight:700;color:#1e293b">ใบกำกับภาษี (Tax Invoice)</h3>
        </div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <span style="font-size:11px;color:#64748b">${taxEnabled?'เปิดใช้งาน':'ปิดอยู่'}</span>
          <div onclick="if(!DB.invoiceSettings)DB.invoiceSettings={};DB.invoiceSettings.taxInvoiceEnabled=!DB.invoiceSettings.taxInvoiceEnabled;save();renderSettingsPage();" style="width:44px;height:24px;border-radius:12px;background:${taxEnabled?'#f59e0b':'#d1d5db'};position:relative;cursor:pointer;transition:background .2s;flex-shrink:0">
            <div style="width:20px;height:20px;border-radius:50%;background:#fff;position:absolute;top:2px;${taxEnabled?'right:2px':'left:2px'};transition:all .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)"></div>
          </div>
        </label>
      </div>

      <div style="background:#fff;border:1px solid ${taxEnabled?'#fde68a':'#e5e7eb'};border-radius:12px;padding:18px;margin-bottom:14px;${taxEnabled?'':'opacity:.6'}">
        ${taxEnabled?'':'<div style="font-size:11px;color:#64748b;margin-bottom:12px;padding:6px 10px;background:#f1f5f9;border-radius:6px">⚠️ เปิดใช้งานใบกำกับภาษีก่อนเพื่อตั้งค่า</div>'}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">คำนำหน้าเลขที่ใบกำกับภาษี</label>
            <input type="text" value="${is.taxPrefix||'TAX'}" ${taxEnabled?'':'disabled'} onchange="if(!DB.invoiceSettings)DB.invoiceSettings={};DB.invoiceSettings.taxPrefix=this.value.trim()||'TAX';save();toast('บันทึกแล้ว ✓')" style="width:100%;padding:9px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:Sarabun;${taxEnabled?'':'background:#f1f5f9'};box-sizing:border-box">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">อัตราภาษีมูลค่าเพิ่ม</label>
            <select ${taxEnabled?'':'disabled'} onchange="if(!DB.invoiceSettings)DB.invoiceSettings={};DB.invoiceSettings.vatRate=parseFloat(this.value);save();toast('บันทึกแล้ว ✓')" style="width:100%;padding:9px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:Sarabun;${taxEnabled?'':'background:#f1f5f9'}">
              <option value="7" ${(is.vatRate||7)===7?'selected':''}>7%</option>
              <option value="0" ${is.vatRate===0?'selected':''}>0% (ยกเว้น VAT)</option>
            </select>
          </div>
        </div>
        <div style="margin-top:12px;font-size:10px;color:#64748b;padding:8px 12px;background:#fffbeb;border-radius:6px;border:1px solid #fde68a">
          💡 ใบกำกับภาษีจะมีรูปแบบเหมือนใบแจ้งหนี้ แต่มีหัวเรื่อง "ใบกำกับภาษี" และแสดงยอดก่อน VAT + VAT + ยอดรวม
        </div>
      </div>

      <!-- SlipOK API -->
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:14px;margin-top:24px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:4px;height:22px;background:#10b981;border-radius:2px"></div>
          <h3 style="font-size:16px;font-weight:700;color:#1e293b">SlipOK API (ตรวจสลิปอัตโนมัติ)</h3>
        </div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <span style="font-size:11px;color:#64748b">${slipOk.enabled?'เปิดใช้งาน':'ปิดอยู่'}</span>
          <div onclick="DB.slipOk.enabled=!DB.slipOk.enabled;save();renderSettingsPage();" style="width:44px;height:24px;border-radius:12px;background:${slipOk.enabled?'#10b981':'#d1d5db'};position:relative;cursor:pointer;transition:background .2s;flex-shrink:0">
            <div style="width:20px;height:20px;border-radius:50%;background:#fff;position:absolute;top:2px;${slipOk.enabled?'right:2px':'left:2px'};transition:all .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)"></div>
          </div>
        </label>
      </div>

      <div style="background:#fff;border:1px solid ${slipOk.enabled?'#a7f3d0':'#e5e7eb'};border-radius:12px;padding:18px;margin-bottom:14px;${slipOk.enabled?'':'opacity:.6'}">
        <div style="font-size:11px;color:#64748b;margin-bottom:12px;padding:8px 12px;background:#f0fdf4;border-radius:6px;border:1px solid #a7f3d0">
          🤖 เมื่อเปิดใช้งาน ระบบจะส่งสลิปไปตรวจสอบกับ SlipOK API → อ่านยอด/ผู้โอน/ref → จับคู่ใบแจ้งหนี้ที่ยอดและเดือนตรงกันอัตโนมัติ + ตรวจสลิปซ้ำ<br>
          📝 สมัครและรับ API key ได้ที่ <a href="https://slipok.com" target="_blank" style="color:#059669;font-weight:600">slipok.com</a>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div>
            <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">Branch ID</label>
            <input type="text" value="${slipOk.branchId||''}" ${slipOk.enabled?'':'disabled'} placeholder="เช่น 12345" onchange="DB.slipOk.branchId=this.value.trim();save();toast('บันทึกแล้ว ✓')" style="width:100%;padding:9px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:Sarabun;${slipOk.enabled?'':'background:#f1f5f9'};box-sizing:border-box">
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:#64748b;display:block;margin-bottom:4px">API Key</label>
            <input type="password" value="${slipOk.apiKey||''}" ${slipOk.enabled?'':'disabled'} placeholder="x-authorization key" onchange="DB.slipOk.apiKey=this.value.trim();save();toast('บันทึกแล้ว ✓')" style="width:100%;padding:9px 10px;border:1px solid #e5e7eb;border-radius:8px;font-size:13px;font-family:Sarabun;${slipOk.enabled?'':'background:#f1f5f9'};box-sizing:border-box">
          </div>
        </div>
        <div style="font-size:10px;color:#64748b;padding:8px 12px;background:#fffbeb;border-radius:6px;border:1px solid #fde68a">
          ⚠️ API Key เก็บอยู่ใน browser (IndexedDB) ของเครื่องนี้เท่านั้น — หากใช้หลายเครื่องต้องตั้งค่าแยก
        </div>
      </div>

    </div><!-- /left -->

    <!-- ══ Right: A4 Preview ══ -->
    <div style="flex:0 0 48%;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;overflow:hidden;display:flex;flex-direction:column;min-height:0">
      <div style="padding:10px 14px;border-bottom:1px solid #e2e8f0;background:#fff;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <span style="font-size:12px;font-weight:600;color:#475569">🖨️ A4 Preview</span>
        <div style="display:flex;gap:6px">
          <button id="invPrevBtnInv" onclick="updateInvoicePreview('invoice')" style="padding:5px 11px;border-radius:7px;border:none;font-size:11px;font-weight:600;cursor:pointer;font-family:Sarabun;background:${(_invPreviewMode||'invoice')==='invoice'?'#fff':'transparent'};color:${(_invPreviewMode||'invoice')==='invoice'?'#4338ca':'#64748b'};box-shadow:${(_invPreviewMode||'invoice')==='invoice'?'0 1px 3px rgba(0,0,0,.1)':'none'};transition:all .15s">ใบแจ้งหนี้</button>
          <button id="invPrevBtnTax" onclick="updateInvoicePreview('taxinvoice')" style="padding:5px 11px;border-radius:7px;border:none;font-size:11px;font-weight:600;cursor:pointer;font-family:Sarabun;background:${_invPreviewMode==='taxinvoice'?'#fff':'transparent'};color:${_invPreviewMode==='taxinvoice'?'#4338ca':'#64748b'};box-shadow:${_invPreviewMode==='taxinvoice'?'0 1px 3px rgba(0,0,0,.1)':'none'};transition:all .15s">ใบกำกับภาษี</button>
          <button id="invPrevBtnRec" onclick="updateInvoicePreview('receipt')" style="padding:5px 11px;border-radius:7px;border:none;font-size:11px;font-weight:600;cursor:pointer;font-family:Sarabun;background:${_invPreviewMode==='receipt'?'#fff':'transparent'};color:${_invPreviewMode==='receipt'?'#4338ca':'#64748b'};box-shadow:${_invPreviewMode==='receipt'?'0 1px 3px rgba(0,0,0,.1)':'none'};transition:all .15s">ใบเสร็จ</button>
        </div>
      </div>
      <iframe id="invPreviewFrame" style="flex:1;border:none;background:#fff;min-height:0" srcdoc="<html><body style='display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;color:#64748b'><div style='text-align:center'><div style='font-size:28px;margin-bottom:8px'>🖨️</div>กำลังโหลด Preview...</div></body></html>"></iframe>
    </div>

  </div>`;
}

function saveInvoiceNote(invId){
  const inv=DB.invoices.find(x=>x.id===invId);
  if(!inv)return;
  const val=document.getElementById('invNoteField')?.value?.trim()||'';
  inv.note=val;
  save();
  toast('บันทึกหมายเหตุแล้ว ✓');
}

function renderSettingsSystem(){
  if(!DB.sysConfig) DB.sysConfig={};
  const cfg=DB.sysConfig;

  return `<div>
    <!-- ── Backup & Restore ── -->
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <div style="width:4px;height:22px;background:#7c3aed;border-radius:2px"></div>
      <h3 style="font-size:16px;font-weight:700;color:#1e293b">Backup & Restore</h3>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:20px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <button onclick="exportData()" style="padding:10px 20px;background:linear-gradient(135deg,#7c3aed,#3b82f6);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:Sarabun;box-shadow:0 2px 8px rgba(124,58,237,0.3);transition:all .15s" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(124,58,237,0.4)'" onmouseout="this.style.transform='';this.style.boxShadow='0 2px 8px rgba(124,58,237,0.3)'">💾 Export Backup</button>
        <label style="padding:10px 20px;background:linear-gradient(135deg,#6366f1,#06b6d4);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:Sarabun;box-shadow:0 2px 8px rgba(99,102,241,0.3);transition:all .15s;display:inline-flex;align-items:center" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(99,102,241,0.4)'" onmouseout="this.style.transform='';this.style.boxShadow='0 2px 8px rgba(99,102,241,0.3)'">📂 Import Backup<input type="file" accept=".json" onchange="importData(event)" style="display:none"></label>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="exportExcelAll()" style="padding:8px 16px;background:#dbeafe;color:#1e40af;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">📊 Export Excel (ทุก sheet)</button>
      </div>
      <div style="margin-top:12px;padding:10px;background:#f8fafc;border-radius:8px;font-size:11px;color:#64748b">
        <span style="font-weight:600;color:#7c3aed">IndexedDB</span> ·
        Data v${DATA_VERSION} ·
        ทรัพย์สิน: <b>${DB.properties.length}</b> ·
        สัญญา: <b>${DB.contracts.length}</b> ·
        ใบแจ้งหนี้: <b>${(DB.invoices||[]).length}</b> ·
        พนักงาน: <b>${(DB.staff||[]).length}</b> ·
        ประวัติ: <b>${(DB.activityLog||[]).length}</b>
      </div>
    </div>

    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <div style="width:4px;height:22px;background:#6366f1;border-radius:2px"></div>
      <h3 style="font-size:16px;font-weight:700;color:#1e293b">Auto-Backup</h3>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:13px;font-weight:600;color:#1e293b">🔄 สำรองข้อมูลอัตโนมัติ</div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <span style="font-size:11px;color:#64748b;font-weight:500">${cfg.autoBackup!==false?'เปิดใช้งาน':'ปิดอยู่'}</span>
          <div onclick="DB.sysConfig.autoBackup=!(DB.sysConfig.autoBackup!==false);save();if(DB.sysConfig.autoBackup!==false){startAutoBackup();}else{stopAutoBackup();}renderSettingsPage();" style="width:40px;height:22px;border-radius:11px;background:${cfg.autoBackup!==false?'#7c3aed':'#d1d5db'};position:relative;cursor:pointer;transition:background .2s">
            <div style="width:18px;height:18px;border-radius:50%;background:#fff;position:absolute;top:2px;${cfg.autoBackup!==false?'right:2px':'left:2px'};transition:all .2s;box-shadow:0 1px 3px rgba(0,0,0,.2)"></div>
          </div>
        </label>
      </div>
      ${cfg.autoBackup!==false?'<div style="display:flex;gap:12px;align-items:center;margin-bottom:12px"><label style="font-size:11px;font-weight:600;color:#64748b">ความถี่:</label><select onchange="DB.sysConfig.autoBackupHours=parseInt(this.value);save();startAutoBackup();toast(\'บันทึกแล้ว\')" style="padding:6px 10px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;font-family:Sarabun"><option value="6" '+(cfg.autoBackupHours===6?'selected':'')+'>ทุก 6 ชม.</option><option value="12" '+(cfg.autoBackupHours===12?'selected':'')+'>ทุก 12 ชม.</option><option value="24" '+(!cfg.autoBackupHours||cfg.autoBackupHours===24?'selected':'')+'>ทุก 24 ชม.</option><option value="48" '+(cfg.autoBackupHours===48?'selected':'')+'>ทุก 2 วัน</option><option value="168" '+(cfg.autoBackupHours===168?'selected':'')+'>ทุกสัปดาห์</option></select><span style="font-size:10px;color:#64748b">เก็บล่าสุด ${AUTOBACKUP_MAX} ไฟล์</span><button onclick="createAutoBackup().then(function(){toast(\'สร้าง backup สำเร็จ\');renderAutoBackupList();})" style="margin-left:auto;padding:6px 14px;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer;font-family:Sarabun">⚡ Backup ตอนนี้</button></div>'+(cfg._lastAutoBackup?'<div style="font-size:10px;color:#64748b;margin-bottom:10px">Backup ล่าสุด: '+new Date(cfg._lastAutoBackup).toLocaleString('th-TH')+'</div>':'')+'<div id="autoBackupList"><div style="text-align:center;padding:12px;color:#64748b;font-size:11px">กำลังโหลด...</div></div>':'<div style="text-align:center;padding:16px;color:#64748b;font-size:12px">เปิดใช้งาน Auto-Backup เพื่อสำรองข้อมูลอัตโนมัติ<br><span style="font-size:10px">ระบบจะเก็บ backup ไว้ใน IndexedDB สูงสุด ${AUTOBACKUP_MAX} ไฟล์ล่าสุด</span></div>'}
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
      <div style="width:4px;height:22px;background:#dc2626;border-radius:2px"></div>
      <h3 style="font-size:16px;font-weight:700;color:#1e293b">ตรวจสอบข้อมูล</h3>
    </div>
    <!-- Data Integrity Audit -->
    <div style="background:#fff;border-radius:12px;padding:18px;border:1px solid #e5e7eb">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div>
          <div style="font-weight:600;color:#1e293b;font-size:14px">🔍 ตรวจความสมบูรณ์ของข้อมูล</div>
          <div style="font-size:11px;color:#64748b;margin-top:3px">ค้นหา orphan records, overlap dates, invoice totals ผิดพลาด, เลขซ้ำ</div>
        </div>
        <button onclick="showDataIntegrityReport()" style="padding:8px 16px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;font-family:Sarabun">รันตรวจ</button>
      </div>
    </div>
  </div>`;
}

function addSignerRow(){
  if(!DB.sysConfig)DB.sysConfig={};
  if(!DB.sysConfig.signers)DB.sysConfig.signers=[];
  DB.sysConfig.signers.push({name:'',title:''});
  save();
  renderSettingsPage();
}
function removeSignerRow(i){
  if(!DB.sysConfig||!DB.sysConfig.signers)return;
  DB.sysConfig.signers.splice(i,1);
  save();
  renderSettingsPage();
}

function renderSettingsStaff(){
  const staff=DB.staff||[];
  const roleLabels={admin:'ผู้ดูแลระบบ',manager:'ผู้จัดการ',staff:'พนักงาน'};
  const roleColors={admin:'#6366f1',manager:'#f59e0b',staff:'#64748b'};
  const roleBg={admin:'#eef2ff',manager:'#fef3c7',staff:'#f1f5f9'};

  let html=`<div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:700;color:#1e293b">พนักงาน & สิทธิ์การใช้งาน</h3>
      <button onclick="addStaffForm()" style="padding:8px 16px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:Sarabun">+ เพิ่มพนักงาน</button>
    </div>`;

  // Permission matrix
  html+=`<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:16px">
    <div style="font-size:14px;font-weight:600;color:#1e293b;margin-bottom:12px">🔑 ตารางสิทธิ์</div>
    <div style="overflow-x:auto">
    <table style="width:100%;font-size:11px;border-collapse:collapse">
      <tr style="background:#f8fafc"><th style="padding:8px;text-align:left;font-weight:600;border-bottom:1px solid #e5e7eb">สิทธิ์</th><th style="padding:8px;text-align:center;color:#6366f1;border-bottom:1px solid #e5e7eb">Admin</th><th style="padding:8px;text-align:center;color:#f59e0b;border-bottom:1px solid #e5e7eb">Manager</th><th style="padding:8px;text-align:center;color:#64748b;border-bottom:1px solid #e5e7eb">Staff</th></tr>
      ${[
        ['ดูข้อมูล','✓','✓','✓'],
        ['พิมพ์เอกสาร','✓','✓','✓'],
        ['สร้างสัญญา/ใบแจ้งหนี้','✓','✓','✕'],
        ['แก้ไขสัญญา/ใบแจ้งหนี้','✓','✓','✕'],
        ['ลบข้อมูล','✓','✕','✕'],
        ['ยกเลิก (Void)','✓','✓','✕'],
        ['ตั้งค่าระบบ','✓','✕','✕'],
        ['จัดการพนักงาน','✓','✕','✕'],
        ['Import/Export','✓','✓ (Export)','✕']
      ].map(r=>`<tr style="border-bottom:1px solid #f1f5f9"><td style="padding:6px 8px;font-weight:500">${r[0]}</td><td style="padding:6px;text-align:center;color:${r[1]==='✓'?'#22c55e':'#ef4444'};border-bottom:1px solid #f1f5f9">${r[1]}</td><td style="padding:6px;text-align:center;color:${r[2].includes('✓')?'#22c55e':'#ef4444'};border-bottom:1px solid #f1f5f9">${r[2]}</td><td style="padding:6px;text-align:center;color:${r[3]==='✓'?'#22c55e':'#ef4444'};border-bottom:1px solid #f1f5f9">${r[3]}</td></tr>`).join('')}
    </table>
    </div>
  </div>`;

  // Staff list
  if(staff.length>0){
    html+=staff.map((s,i)=>`<div class="set-card" style="display:flex;align-items:center;gap:12px;padding:14px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:8px">
      <div style="width:44px;height:44px;border-radius:50%;background:${roleColors[s.role]||'#64748b'};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px">${s.name.charAt(0)}</div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:14px;color:#1e293b">${s.name}</div>
        <span style="font-size:10px;padding:2px 8px;border-radius:99px;background:${roleBg[s.role]||'#f1f5f9'};color:${roleColors[s.role]||'#64748b'};font-weight:600">${roleLabels[s.role]||s.role}</span>
      </div>
      <button onclick="editStaff(${i})" style="padding:6px 14px;background:#eef2ff;color:#4338ca;border:none;border-radius:6px;font-size:12px;cursor:pointer;font-family:Sarabun;font-weight:600">แก้ไข</button>
      ${hasPermission('staff')?'<button onclick="deleteStaff('+i+')" style="padding:6px 14px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;font-size:12px;cursor:pointer;font-family:Sarabun;font-weight:600">ลบ</button>':''}
    </div>`).join('');
  } else {
    html+='<div style="text-align:center;padding:30px;color:#64748b"><div style="font-size:32px;margin-bottom:8px">👤</div>ยังไม่มีพนักงาน</div>';
  }

  html+='</div>';
  return html;
}

function render(){
  // Update title based on current tab
  const titleMap={properties:'ทรัพย์สิน',contracts:'สัญญาเช่า',renewals:'ใกล้หมดอายุ',contractform:'แบบฟอร์มสัญญา',dashboard:'Dashboard',landlords:'ผู้ให้เช่า',invoices:'ใบแจ้งหนี้',pipeline:'Pipeline',reports:'รายงาน',settings:'ตั้งค่าระบบ',datafix:'ข้อมูลต้องแก้'};
  if(page==='properties')$('title').textContent=titleMap[propTab]||'ทรัพย์สิน';
  else $('title').textContent=titleMap[page]||'';

  // Update notification badge on every render
  try{updateNotifBadge();}catch(e){}

  if(page==='dashboard')renderDash();
  else if(page==='properties'){
    if(propTab==='contracts')renderContracts();
    else if(propTab==='renewals')renderRenew();
    else renderProperties();
  }
  else if(page==='landlords')renderLandlords();
  else if(page==='invoices')renderInvoicePage();
  else if(page==='pipeline')renderPipelinePage();
  else if(page==='reports')renderReportsPage();
  else if(page==='settings')renderSettingsPage();
  else if(page==='datafix')renderDataFix();
}

