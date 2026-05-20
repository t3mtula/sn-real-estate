// ========== CONTRACT PRINTING ==========
function dateToThai(dateStr){if(!dateStr)return'-';const d=parseBE(dateStr);if(!d)return dateStr;const thMo=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];return d.getDate()+' '+thMo[d.getMonth()]+' '+(d.getFullYear()+543);}

function contractHTML(contracts,tplOverride,hideToolbar){
  const today=new Date();
  const todayBE=`${today.getDate()}/${today.getMonth()+1}/${today.getFullYear()+543}`;
  const tpl=tplOverride||getActiveTemplate();
  // ── Filename สำหรับ PDF save · ใช้ title ของ document → browser ใช้เป็นชื่อไฟล์ default ──
  const docTitle = contracts.length === 1
    ? 'สัญญาเช่า '+(contracts[0].no||'')+' '+((contracts[0].tenant||'').replace(/บริษัท\s*/g,'บจก.').replace(/\s*จำกัด/g,'').replace(/\s*โดย.+/,'').trim()).substring(0,40)
    : 'สัญญาเช่า '+contracts.length+' ฉบับ';

  return`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<title>${docTitle}</title>
<link href="https://fonts.googleapis.com/css2?family=Sarabun:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">
<style>
@page { size: A4; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Sarabun', sans-serif; }
body { background: #fff; color: #1a202c; }
.page { width: 210mm; padding: 14mm 20mm 14mm; margin: 0 auto; position: relative; page-break-after: always; }
.page:last-child { page-break-after: auto; }

/* ════════════════════════════════════════════
   Professional Contract Print · Design System
   - Navy #1e3a5f · neutral grays · Sarabun
   - Consistent header / section / signature
   ════════════════════════════════════════════ */

/* ── Header (used by both main contract + appendix) ── */
.c-header { border-top: 3px solid #1e3a5f; border-bottom: 1px solid #cbd5e1; padding: 18px 0 14px; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.c-header-center { flex: 1; }
.c-title { font-size: 24px; font-weight: 800; color: #1e3a5f; letter-spacing: .3px; line-height: 1.15; }
.c-subtitle { font-size: 10px; color: #94a3b8; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
.c-meta-badge { background: #f8fafc; border: 1px solid #cbd5e1; border-left: 3px solid #1e3a5f; border-radius: 4px; padding: 8px 14px; text-align: left; white-space: nowrap; min-width: 130px; box-shadow: 0 1px 2px rgba(15, 23, 42, .04); }
.c-meta-badge .label { color: #94a3b8; font-size: 8.5px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
.c-meta-badge .value { color: #1e3a5f; font-weight: 700; font-size: 13px; display: block; margin-top: 2px; font-variant-numeric: tabular-nums; }

/* ── Date/Place strip ── */
.c-date-strip { background: #f8fafc; border-left: 3px solid #94a3b8; padding: 10px 16px; font-size: 13px; color: #334155; margin-bottom: 16px; line-height: 1.6; }
.c-date-strip b { color: #1e3a5f; font-weight: 700; }

/* ── Parties table · minimal — section hdr ใช้ light bg + navy text (ลดถมดำตอน print) ── */
.parties-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 18px; border-radius: 6px; overflow: hidden; border: 1px solid #cbd5e1; }
.parties-table .sect-hdr td { background: #f1f5f9; color: #1e3a5f; padding: 8px 14px; font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; }
.parties-table .party-row td { padding: 0; vertical-align: top; }
.party-cell { padding: 12px 16px; border-right: 1px solid #e2e8f0; }
.party-cell:last-child { border-right: none; }
.party-label { font-size: 8.5px; font-weight: 700; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 6px; }
.party-name { font-size: 15px; font-weight: 700; color: #1e3a5f; margin-bottom: 5px; line-height: 1.3; }
.party-detail { font-size: 12px; color: #1e293b; line-height: 1.6; margin-top: 2px; }
.party-detail-label { color: #64748b; font-weight: 600; font-size: 10px; letter-spacing: .5px; }

/* ── Contract body · spacing scale: 8 (sub) / 14 (clause) / 20 (section) ── */
.c-body { font-size: 13.5px; line-height: 1.8; color: #1e293b; text-align: justify; margin-bottom: 20px; }
.c-intro { margin: 0 0 14px 0; text-indent: 28px; }
.clause { margin: 14px 0; padding-left: 0; }
.clause-num { font-weight: 700; color: #1e3a5f; font-size: 13.5px; }
.sub-clause { margin: 8px 0 8px 28px; font-size: 13px; color: #1e293b; line-height: 1.8; }
.sub-clause-num { font-weight: 600; color: #1e3a5f; }
.c-closing { margin: 20px 0 0 0; text-indent: 28px; }
.override-mark { color: #dc2626; }
.override-note { font-size: 9px; color: #dc2626; font-style: italic; margin-left: 6px; }
@media print { .override-mark { color: inherit !important; } .override-note { display: none !important; } }

/* ── Section divider ── */
.c-divider { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }

/* ── Signature section · flow ตามหลัง content (natural pagination · ไม่ pin bottom) ── */
.sig-section { margin-top: 24px; padding-top: 10px; }
.sig-section-title { font-size: 9px; font-weight: 700; color: #94a3b8; letter-spacing: 2px; text-transform: uppercase; text-align: center; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
.sig-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 10px; }
.sig-block { text-align: center; }
.sig-img-area { height: 44px; display: flex; align-items: flex-end; justify-content: center; }
.sig-img-area img { max-height: 50px; max-width: 145px; object-fit: contain; }
/* คู่สัญญา (sig-grid ที่ตามหลัง sig-section-title) มีข้อมูลใต้เส้นเยอะ → เพิ่มพื้นที่เซ็นเหนือเส้น · พยาน grid 2 คงเดิม */
.sig-section-title + .sig-grid .sig-img-area { height: 72px; }
.sig-line-rule { border-top: 1px solid #1e3a5f; margin: 4px auto 0; width: 170px; }
.sig-name { font-size: 13px; font-weight: 700; color: #1e3a5f; margin-top: 5px; }
.sig-role { font-size: 11.5px; color: #475569; margin-top: 1px; }
.sig-date { font-size: 11px; color: #64748b; margin-top: 3px; }

/* ── Appendix Header ── */
.c-header.appendix-banner { border-top: 3px solid #1e3a5f; border-bottom: 1px solid #cbd5e1; padding: 12px 0 10px; margin-bottom: 18px; }
.appendix-eyebrow { font-size: 9px; letter-spacing: 3px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 4px; }

/* ── Appendix Section · form-style: dark section bar + 2-col key|value table
     · ทุก field มี row ของตัวเอง · field ว่าง = แถวหาย · ไม่มี alignment issue
     · page-break-inside: avoid → section ไม่ตัดกลาง (browser override ถ้าใหญ่เกินหน้า) ── */
.ap-section { margin-bottom: 14px; page-break-inside: avoid; break-inside: avoid; }
.ap-section-bar { background: #1e3a5f; color: #fff; padding: 7px 14px; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; border-radius: 4px 4px 0 0; }
.ap-section-bar .en { color: #94a3b8; font-weight: 500; margin-left: 8px; font-size: 9.5px; letter-spacing: 1.5px; }

/* Key|Value table (Property, Lease Terms, Bank) */
.ap-table { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-top: none; border-radius: 0 0 4px 4px; overflow: hidden; }
.ap-table tr { border-bottom: 1px solid #f1f5f9; }
.ap-table tr:last-child { border-bottom: none; }
.ap-table tr:nth-child(even) { background: #fafbfc; }
.ap-table td { padding: 8px 14px; font-size: 12.5px; color: #1e293b; line-height: 1.6; vertical-align: top; }
.ap-table td.k { width: 38%; color: #475569; font-weight: 600; font-size: 11.5px; letter-spacing: .2px; }
.ap-table td.v strong { color: #1e3a5f; font-weight: 700; }

/* Parties section: 2-col compare table (Lessor | Lessee) */
.ap-parties { width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-top: none; border-radius: 0 0 4px 4px; }
.ap-parties td { padding: 12px 14px; vertical-align: top; width: 50%; border-right: 1px solid #e2e8f0; }
.ap-parties td:last-child { border-right: none; }
.ap-party-label { font-size: 9px; font-weight: 700; color: #94a3b8; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 5px; }
.ap-party-name { font-size: 14px; font-weight: 700; color: #1e3a5f; margin-bottom: 5px; line-height: 1.35; }
.ap-party-detail { font-size: 12px; color: #1e293b; line-height: 1.6; margin-top: 3px; }
.ap-party-detail .k { color: #64748b; font-weight: 600; font-size: 10px; letter-spacing: .3px; }

/* Notes section: full-width text block */
.ap-notes-text { padding: 12px 14px; font-size: 12.5px; color: #1e293b; line-height: 1.7; border: 1px solid #cbd5e1; border-top: none; border-radius: 0 0 4px 4px; }

/* ── Print mode: natural flow · ปล่อย browser จัด pagination ตาม CSS spec
     → ไม่ pin sig bottom · ไม่ fill paper · clauses pack แน่นทุกหน้า ── */
@media print {
  @page { size: A4; margin: 14mm 20mm 14mm; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; orphans: 3; widows: 3; }
  .no-print { display: none !important; }
  .page { padding: 0 !important; min-height: 0 !important; height: auto !important; margin: 0; box-shadow: none; display: block; page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .page-body { display: block; }
  .sig-section { padding-top: 12px; }
  /* clause/sub-clause + signature + cards ห้าม split */
  .clause, .sub-clause { page-break-inside: avoid; break-inside: avoid; orphans: 2; widows: 2; }
  .parties-table, .sig-grid, .sig-block, .ap-card, .sig-section { page-break-inside: avoid; break-inside: avoid; }
  /* บังคับ page-break ก่อนเอกสารแนบท้าย */
  .appendix-page { page-break-before: always; break-before: page; }
}
@media screen {
  body { background: #e2e8f0; padding: 20px; }
  .page { box-shadow: 0 4px 24px rgba(0,0,0,0.12); border-radius: 4px; margin-bottom: 24px; background: #fff; }
  body.embed { background: #e2e8f0; padding: 16px 0; }
  /* Preview pages — A4 cards · flex column + min-height = paper content height
     → sig auto-margin push ลง bottom ของหน้า (ตรงกับ @media print) */
  body.embed .page { width: 210mm; max-width: calc(100% - 20px); margin: 0 auto 24px; min-height: auto; padding: 14mm 20mm 14mm; box-shadow: 0 6px 20px rgba(0,0,0,0.10); border-radius: 4px; background: #fff; display: block; }
  /* Continuation pages (clauses ต่อกัน · ไมฺ่มี sig) — min-height:auto · ไม่ต้อง fill paper */
  body.embed .page-body { display: block; }
}
</style></head><body>
${hideToolbar?'':'<div class="no-print" style="position:fixed;top:0;left:0;right:0;z-index:100;background:#1e3a5f;padding:10px 24px;display:flex;align-items:center;gap:16px;box-shadow:0 2px 12px rgba(0,0,0,0.25)"><button onclick="window.print()" style="background:#3b82f6;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;font-family:Sarabun">🖨️ พิมพ์ / บันทึก PDF</button><button onclick="window.close()" style="background:transparent;color:#64748b;border:1px solid #475569;padding:10px 20px;border-radius:8px;font-size:14px;cursor:pointer;font-family:Sarabun">ปิด</button><span style="color:#64748b;font-size:12px;margin-left:auto">สัญญาเช่า — '+today.toLocaleDateString("th-TH")+'</span></div><div style="height:56px" class="no-print"></div>'}
${contracts.map(c=>{
  const p=DB.properties.find(x=>x.pid===c.pid);
  // sigBox: single-line สำหรับบุคคลธรรมดา
  const sigBox=(label,name,imgSrc,title)=>'<div class="sig-block"><div class="sig-img-area">'+(imgSrc?'<img src="'+imgSrc+'" style="max-height:48px;max-width:140px;object-fit:contain">':'<div style="width:160px"></div>')+'</div><div class="sig-line-rule"></div><div class="sig-name">'+(name||'...................................')+'</div>'+(title?'<div class="sig-role">('+title+')</div>':'')+'<div class="sig-role">'+label+'</div><div class="sig-date">(......../......../........)</div></div>';
  // sigBoxParty: นิติบุคคล → multiline (บริษัท / โดย ผู้ลงนาม / ตำแหน่ง / ผู้เช่า/ผู้ให้เช่า)
  //   ถ้าบุคคลธรรมดา → fallback ไปใช้ sigBox เดิม
  const sigBoxParty=(label,partyName,signerName,signerTitle,imgSrc)=>{
    if(isCompanyName(partyName) && signerName){
      const safe=v=>String(v||'').replace(/</g,'&lt;');
      return '<div class="sig-block"><div class="sig-img-area">'+(imgSrc?'<img src="'+imgSrc+'" style="max-height:48px;max-width:140px;object-fit:contain">':'<div style="width:160px"></div>')+'</div><div class="sig-line-rule"></div>'
        +'<div class="sig-name" style="font-weight:600">'+safe(partyName)+'</div>'
        +'<div class="sig-name" style="font-size:11px">โดย '+safe(withPrefix(signerName))+'</div>'
        +(signerTitle?'<div class="sig-role">('+safe(signerTitle)+')</div>':'')
        +'<div class="sig-role">'+label+'</div>'
        +'<div class="sig-date">(......../......../........)</div></div>';
    }
    // บุคคลธรรมดา → fallback (signer หรือ party name)
    return sigBox(label, withPrefix(signerName||partyName), imgSrc, signerTitle);
  };
  // ── ทำสัญญาที่ + วันที่ ครบ (full address fallback ถ้า madeAt = ชื่อย่อ) ──
  const madeAtFull = (function(){
    const m = (c.madeAt||'').trim();
    const la = (c.landlordAddr||'').trim();
    // ถ้า madeAt = ชื่อบริษัท เพียวๆ → append landlord address ครบ
    if(m && la && !m.includes('ต.') && !m.includes('อ.') && !m.includes('ถนน')) return m+' (ที่อยู่: '+la+')';
    if(m) return m;
    if(la) return la;
    return '-';
  })();
  return'<div class="page">'+
    // ── Header (แสดงทั้ง screen + print เหมือนกัน — parity) ──
    '<div class="c-header">'+
      '<div class="c-header-center">'+
        '<div class="c-title">สัญญาเช่า</div>'+
        '<div class="c-subtitle">Tenancy Agreement</div>'+
      '</div>'+
      '<div class="c-meta-badge"><span class="label">เลขที่สัญญา</span><span class="value">'+c.no+'</span></div>'+
    '</div>'+

    // ── Date/Place (ครบ — ที่อยู่ + วันที่ + วันทำสัญญา ทศวรรษไทย) ──
    '<div class="c-date-strip">ทำสัญญา ณ <b>'+madeAtFull+'</b><br>เมื่อวันที่ <b>'+dateToThai(c.date)+'</b></div>'+

    // ── Parties ──
    '<table class="parties-table">'+
      '<tr class="sect-hdr"><td colspan="2">คู่สัญญา &nbsp;·&nbsp; Parties to Agreement</td></tr>'+
      '<tr class="party-row"><td style="width:50%;border-right:1px solid #e2e8f0"><div class="party-cell">'+
        '<div class="party-label">ผู้ให้เช่า · Lessor</div>'+
        '<div class="party-name">'+c.landlord+'</div>'+
        (c.landlordAddr?'<div class="party-detail"><span class="party-detail-label">ที่อยู่:</span> '+c.landlordAddr+'</div>':'')+
      '</div></td><td><div class="party-cell">'+
        '<div class="party-label">ผู้เช่า · Lessee</div>'+
        '<div class="party-name">'+c.tenant+'</div>'+
        (c.tenantAddr?'<div class="party-detail"><span class="party-detail-label">ที่อยู่:</span> '+c.tenantAddr+'</div>':'')+
        (c.phone?'<div class="party-detail"><span class="party-detail-label">โทร:</span> '+c.phone+'</div>':'')+
        (c.taxId?'<div class="party-detail"><span class="party-detail-label">เลขผู้เสียภาษี:</span> '+c.taxId+'</div>':'')+
      '</div></td></tr>'+
    '</table>'+

    // ── Page-body wrapper: content + signature ใช้ flex grow → signature ติด bottom · ลด white space ──
    '<div class="page-body">'+

    // ── Body ──
    '<div class="c-body">'+
      '<p class="c-intro">'+renderTemplateText(tpl.intro||'',c)+'</p>'+
      (function(){
        const merged=(typeof applyClauseOverrides==='function')
          ? applyClauseOverrides(tpl.clauses,c.clauseOverrides||{})
          : (tpl.clauses||[]).map(x=>typeof x==='string'?{text:x,sub:[]}:{text:x.text||'',sub:(x.sub||[]).slice(),_overridden:false,_overriddenSub:{}});
        return merged.map((cl,i)=>{
          const mainCls=cl._overridden?'clause override-mark':'clause';
          const note=cl._overridden?'<span class="override-note">(แก้ไขเฉพาะสัญญานี้)</span>':'';
          let html='<div class="'+mainCls+'"><span class="clause-num">ข้อ '+(i+1)+'.</span> '+renderTemplateText(cl.text||'',c)+note+'</div>';
          if(cl.sub&&cl.sub.length){
            html+=cl.sub.map((s,j)=>{
              const overridden=cl._overriddenSub&&cl._overriddenSub[j];
              const subCls=overridden?'sub-clause override-mark':'sub-clause';
              const subNote=overridden?'<span class="override-note">(แก้ไข)</span>':'';
              return '<div class="'+subCls+'"><span class="sub-clause-num">'+(i+1)+'.'+(j+1)+'</span> '+renderTemplateText(s,c)+subNote+'</div>';
            }).join('');
          }
          return html;
        }).join('');
      })()+
      (tpl.closing?'<p class="c-closing">'+renderTemplateText(tpl.closing,c)+'</p>':'')+
    '</div>'+

    // ── Signature (ติด bottom ผ่าน flex auto margin) ──
    '<div class="sig-section">'+
      '<div class="sig-section-title">ลายมือชื่อคู่สัญญาและพยาน / Signatures</div>'+
      '<div class="sig-grid">'+
        sigBoxParty('ผู้ให้เช่า (Lessor)',c.landlord,c.landlordSignerName,c.landlordSignerTitle,c.landlordSig)+
        sigBoxParty('ผู้เช่า (Lessee)',c.tenant,c.tenantSignerName,c.tenantSignerTitle,c.tenantSig)+
      '</div>'+
      '<div class="sig-grid">'+
        sigBox('พยาน / Witness 1',withPrefix(c.witness1Name||''),c.witness1Sig,c.witness1Title)+
        sigBox('พยาน / Witness 2',withPrefix(c.witness2Name||''),c.witness2Sig,c.witness2Title)+
      '</div>'+
    '</div>'+
    '</div>'+ /* /page-body */
  '</div>'+

  // ── Appendix page (card layout · design ตรงกับสัญญาหลัก) ──
  '<div class="page appendix-page">'+
    // Banner header — minimal · ใช้ style เดียวกับ main contract header
    '<div class="c-header appendix-banner">'+
      '<div class="c-header-center">'+
        '<div class="appendix-eyebrow">SCHEDULE · เอกสารประกอบสัญญา</div>'+
        '<div class="c-title">เอกสารแนบท้ายสัญญาเช่า</div>'+
        '<div class="c-subtitle">Contract Details &nbsp;·&nbsp; วันที่ทำสัญญา <b>'+dateToThai(c.date)+'</b></div>'+
      '</div>'+
      '<div class="c-meta-badge"><span class="label">เลขที่สัญญา</span><span class="value">'+c.no+'</span></div>'+
    '</div>'+
    '<div class="page-body">'+
  (function(){
    const safe = v => v==null?'':String(v);
    // Helper: render row only if value present — field ว่าง = แถวหายไป (ไม่ shift)
    const row = (label, value) => value ? '<tr><td class="k">'+label+'</td><td class="v">'+safe(value)+'</td></tr>' : '';
    const section = (thai, en, innerHtml) => innerHtml ?
      '<div class="ap-section">'+
        '<div class="ap-section-bar">'+thai+'<span class="en">· '+en+'</span></div>'+
        innerHtml+
      '</div>' : '';

    // ── คู่สัญญา · Parties (compare 2-col) ──
    const partyDetail = (k, v) => v ? '<div class="ap-party-detail"><span class="k">'+k+':</span> '+safe(v)+'</div>' : '';
    const partiesInner =
      '<table class="ap-parties"><tr>'+
        '<td>'+
          '<div class="ap-party-label">ผู้ให้เช่า · Lessor</div>'+
          '<div class="ap-party-name">'+safe(c.landlord)+'</div>'+
          partyDetail('ที่อยู่', c.landlordAddr)+
        '</td>'+
        '<td>'+
          '<div class="ap-party-label">ผู้เช่า · Lessee</div>'+
          '<div class="ap-party-name">'+safe(c.tenant)+'</div>'+
          partyDetail('ที่อยู่', c.tenantAddr)+
          partyDetail('โทรศัพท์', c.phone)+
          partyDetail('เลขผู้เสียภาษี', c.taxId)+
        '</td>'+
      '</tr></table>';
    const partiesSection = section('คู่สัญญา', 'PARTIES', partiesInner);

    // ── รายละเอียดทรัพย์สิน · Property ──
    const propertyRows =
      row('ทรัพย์สิน', c.property)+
      row('วัตถุประสงค์การเช่า', c.purpose)+
      row('พื้นที่', c.area)+
      row('เอกสารสิทธิ์', p && p.titleDeed);
    const propertySection = section('รายละเอียดทรัพย์สิน', 'PROPERTY',
      propertyRows ? '<table class="ap-table">'+propertyRows+'</table>' : '');

    // ── ระยะเวลาและค่าเช่า · Lease Terms (ทุก field แถวของตัวเอง) ──
    const depositVal = (function(){
      if(c.hasDeposit === false) return '';
      const s = fmtDeposit(c.deposit);
      return (!s || s === '-') ? '' : s;
    })();
    const leaseRows =
      row('วันเริ่มต้น', c.start ? dateToThai(c.start) : '')+
      row('วันสิ้นสุด', c.end ? dateToThai(c.end) : '')+
      row('ระยะเวลา', c.dur)+
      row('อัตราค่าเช่า', c.rate)+
      row('วิธีชำระ', c.payment)+
      row('การปรับค่าเช่า', c.rateAdj)+
      row('เงินประกัน', depositVal);
    const leaseSection = section('ระยะเวลาและค่าเช่า', 'LEASE TERMS',
      leaseRows ? '<table class="ap-table">'+leaseRows+'</table>' : '');

    // ── บัญชีรับโอน · Payment Account ──
    const _ph = (DB.invoiceHeaders||[]).find(x => x.id == c.invHeaderId);
    const _rb = (typeof resolveBankFields==='function') ? resolveBankFields(c, _ph) : {bankName:c.bank||'',accountNo:c.acctNo||'',accountName:c.accountName||''};
    const bankRows =
      row('ธนาคาร', _rb.bankName)+
      row('ชื่อบัญชี', _rb.accountName)+
      row('เลขที่บัญชี', _rb.accountNo)+
      row('PromptPay', _rb.promptPayId);
    const bankSection = section('บัญชีรับโอน', 'PAYMENT ACCOUNT',
      bankRows ? '<table class="ap-table">'+bankRows+'</table>' : '');

    // ── หมายเหตุ · Notes (ถ้ามี) ──
    const notesSection = section('หมายเหตุ', 'NOTES',
      c.notes ? '<div class="ap-notes-text">'+safe(c.notes)+'</div>' : '');

    return partiesSection + propertySection + leaseSection + bankSection + notesSection;
  })()+
    // Signature (push to bottom via flex auto-margin)
    '<div class="sig-section">'+
      '<div class="sig-section-title">ลายมือชื่อคู่สัญญาและพยาน / Signatures</div>'+
      '<div class="sig-grid">'+
        sigBoxParty('ผู้ให้เช่า (Lessor)',c.landlord,c.landlordSignerName,c.landlordSignerTitle,c.landlordSig)+
        sigBoxParty('ผู้เช่า (Lessee)',c.tenant,c.tenantSignerName,c.tenantSignerTitle,c.tenantSig)+
      '</div>'+
    '</div>'+
    '</div>'+ /* /page-body */
  '</div>';
}).join('')}
</body></html>`;
}

function printSingleContract(id){
  const c=DB.contracts.find(x=>x.id===id);
  if(!c)return;
  openPrintOverlay([c],'ตัวอย่างสัญญา — '+c.tenant);
}

function previewContract(id){
  const c=DB.contracts.find(x=>x.id===id);
  if(!c)return;
  closeModal();
  openPrintOverlay([c],'ตัวอย่างสัญญา — '+c.tenant);
}

// ========== PRINT OVERLAY ==========
function openPrintOverlay(contracts,title,rawHTML){
  let html;
  if(rawHTML){
    html=rawHTML.replace('<body>','<body class="embed">');
  } else {
    html=contractHTML(contracts,null,true).replace('<body>','<body class="embed">');
  }
  document.getElementById('printOverlayTitle').textContent=title||'ตัวอย่างสัญญา';
  document.getElementById('printOverlay').style.display='block';
  const frame=document.getElementById('printFrame');
  frame.srcdoc=html;
  // Preview = single tall card · browser จัด pagination เองตอน print
}

function closePrintOverlay(){
  document.getElementById('printOverlay').style.display='none';
  document.getElementById('printFrame').srcdoc='';
}
function doPrintFromOverlay(){
  const frame=document.getElementById('printFrame');
