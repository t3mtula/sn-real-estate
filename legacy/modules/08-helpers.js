// ========== HELPERS ==========
// Escape HTML สำหรับ render user input ใน template literals (กัน XSS)
function esc(s){if(s==null)return'';return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

// Clamp helpers — boundary validation สำหรับ money/integer values
// ใช้ที่ Excel import / form save / API response เพื่อกัน negative + NaN + overflow
//   clampMoney('-50,000')         → 0       (negative clamped to min=0)
//   clampMoney('1,234.50')        → 1234.5
//   clampMoney('abc',{def:100})   → 100
//   clampMoney('1e15',{max:1e9})  → 1e9
function clampMoney(v,opts){
  opts=opts||{};
  const min=opts.min!=null?opts.min:0;
  const max=opts.max!=null?opts.max:1e10;
  const def=opts.def!=null?opts.def:0;
  const n=parseFloat(String(v==null?'':v).replace(/[,\s฿]/g,''));
  if(isNaN(n)||!isFinite(n))return def;
  return Math.max(min,Math.min(max,n));
}
// clampInt('5',{min:1,max:31,def:5}) → 5 ; clampInt('99',{min:1,max:31,def:5}) → 31
function clampInt(v,opts){
  opts=opts||{};
  const min=opts.min!=null?opts.min:0;
  const max=opts.max!=null?opts.max:Number.MAX_SAFE_INTEGER;
  const def=opts.def!=null?opts.def:0;
  const n=parseInt(v);
  if(isNaN(n))return def;
  return Math.max(min,Math.min(max,n));
}
// Currency formatter — single source of truth สำหรับเงินบาท
// fmtBaht(1234567)        → "฿1,234,567"
// fmtBaht(1234567,{sym:0}) → "1,234,567"
// fmtBaht(1234.5,{dec:2}) → "฿1,234.50"
// fmtBaht(null) → "฿0"
function fmtBaht(n,opt){
  opt=opt||{};
  const v=Number(n)||0;
  const dec=opt.dec||0;
  const sym=opt.sym!==0;
  const s=v.toLocaleString('en-US',{minimumFractionDigits:dec,maximumFractionDigits:dec});
  return (sym?'฿':'')+s;
}
// Plain number formatter (ไม่มีสัญลักษณ์เงิน) สำหรับ count, percent, etc.
function fmtNum(n,dec){return (Number(n)||0).toLocaleString('en-US',{minimumFractionDigits:dec||0,maximumFractionDigits:dec||0});}
// แปลง Date object → "DD/MM/YYYY" BE string (zero-padded). ใช้แทน inline pattern ทั่ว codebase
function dateToBE(d){if(!d||!(d instanceof Date)||isNaN(d))return'';return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+(d.getFullYear()+543)}
function parseBE(s){if(!s)return null;const p=s.split('/');if(p.length!==3)return null;const d=+p[0],m=+p[1]-1,y=+p[2]-543;if(isNaN(d)||isNaN(m)||isNaN(y)||y<1900)return null;return new Date(y,m,d)}
function fmtBE(s){const d=parseBE(s);if(!d)return s||'-';return d.toLocaleDateString('th-TH',{year:'numeric',month:'short',day:'numeric'})}
function fuzzyName(s){return(s||'').replace(/นาย|นางสาว|นาง|บริษัท|จำกัด|มหาชน|ห้างหุ้นส่วน/g,'').replace(/\s+/g,'').toLowerCase();}
function nameMatch(a,b){const fa=fuzzyName(a),fb=fuzzyName(b);return!!(fa&&fb&&fa.length>1&&fb.length>1&&(fa.includes(fb)||fb.includes(fa)));}
// L3: relative time — accept Date|number|ISO string
function relTime(t){if(!t)return '-';const d=t instanceof Date?t:new Date(t);if(isNaN(d))return '-';const s=Math.floor((Date.now()-d.getTime())/1000);if(s<5)return 'เมื่อสักครู่';if(s<60)return s+' วินาทีที่แล้ว';const m=Math.floor(s/60);if(m<60)return m+' นาทีที่แล้ว';const h=Math.floor(m/60);if(h<24)return h+' ชั่วโมงที่แล้ว';const dy=Math.floor(h/24);if(dy<7)return dy+' วันที่แล้ว';if(dy<30)return Math.floor(dy/7)+' สัปดาห์ที่แล้ว';if(dy<365)return Math.floor(dy/30)+' เดือนที่แล้ว';return Math.floor(dy/365)+' ปีที่แล้ว'}
function amt(r){
  if(!r)return 0;
  // สัญญาอัตราขั้นบันได เช่น "ปี 2567 เดือนละ 3,000บาท,ปี 2568-2569 เดือนละ 5,000 บาท"
  const parts=r.split(/,(?=\s*ปี\s*\d)/);
  if(parts.length>1){
    const curBE=new Date().getFullYear()+543;
    for(let i=parts.length-1;i>=0;i--){
      const ym=parts[i].match(/ปี\s*(\d{4})(?:\s*-\s*(\d{4}))?/);
      if(ym){
        const from=parseInt(ym[1]),to=ym[2]?parseInt(ym[2]):from;
        if(curBE>=from&&curBE<=to){const v=_parseAmtStr(parts[i]);if(v)return v;}
      }
    }
    const v=_parseAmtStr(parts[parts.length-1]);if(v)return v;
  }
  return _parseAmtStr(r);
}
function _parseAmtStr(s){
  if(!s)return 0;
  // 1) ตัวเลข (รวมทศนิยม) + บาท เช่น "505,263.15 บาท", "3,000บาท", "18,150.-บาท"
  const m1=s.match(/([\d,]+(?:\.\d+)?)\s*\.?-?\s*บาท/);
  if(m1)return parseFloat(m1[1].replace(/,/g,''))||0;
  // 2) keyword + ตัวเลข เช่น "เดือนละ 114,000 (...)", "ปีละ 50,000 (..."
  const m2=s.match(/(?:เดือนละ|ไตรมาสละ|ปีละ|งวดละ|ครั้งละ)\s*([\d,]+(?:\.\d+)?)/);
  if(m2)return parseFloat(m2[1].replace(/,/g,''))||0;
  // 3) ตัวเลข + วงเล็บที่มี "บาท" ข้างใน เช่น "114,000 (หนึ่งแสน...บาทถ้วน)"
  const m3=s.match(/([\d,]+(?:\.\d+)?)\s*\([^)]*บาท[^)]*\)/);
  if(m3)return parseFloat(m3[1].replace(/,/g,''))||0;
  // 4) fallback: ถ้ามี keyword ค่าเช่า → หาตัวเลข >=100
  if(/(?:เดือนละ|ไตรมาสละ|ปีละ|งวดละ|ครั้งละ|ค่าเช่า|อัตรา)/.test(s)){
    const nums=s.match(/[\d,]+(?:\.\d+)?/g);
    if(nums){
      const vals=nums.map(n=>parseFloat(n.replace(/,/g,''))).filter(n=>n>=100);
      if(vals.length>=1)return Math.max(...vals);
    }
  }
  // 5) ตัวเลขล้วน (จาก import / Excel) เช่น "1500", "22,750", "13300.50"
  const trimmed=String(s).trim();
  if(/^[\d,]+(?:\.\d+)?$/.test(trimmed)){
    const v=parseFloat(trimmed.replace(/,/g,''));
    if(v>0) return v;
  }
  return 0;
}
function monthly(r){const a=amt(r);if(!a)return 0;if(r.includes('เดือนละ'))return a;if(r.includes('ไตรมาสละ'))return a/3;if(r.includes('ปีละ'))return a/12;return a}
// ใบกำกับภาษีต้องมี taxId 13 หลัก + ที่อยู่ผู้เช่า (สรรพากรบังคับ)
function isTaxComplete(c){
  if(!c) return false;
  const taxId = String(c.taxId||'').replace(/\D/g,'');
  if(taxId.length !== 13) return false;
  const addr = String(c.tenantAddr||'').trim();
  if(addr.length < 10) return false;
  return true;
}
function taxIncompleteContracts(){
  return (DB.contracts||[]).filter(c => !c.cancelled && !isTaxComplete(c));
}

function isBadAddr(p){
  if(p.addr_province||p.province)return false; // structured import — มีจังหวัด = valid
  const a=p.address||p.location;
  if(!a||a.length<10||a===p.type||a===p.name)return true;
  // ตรวจที่อยู่ที่เป็นคำอธิบาย ไม่ใช่ที่อยู่จริง
  const desc=/^(เช่า|ให้เช่า|ที่ดิน\s*(จ\.|$))/i;
  if(desc.test(a.trim()))return true;
  // ที่อยู่จริงต้องมี marker อย่างน้อย 1 ตัว: ต./อ./จ./แขวง/เขต/เลขที่/หมู่/ซอย/ถนน/ม.
  const markers=/(ต\.|อ\.|จ\.|แขวง|เขต|เลขที่|หมู่|ม\.\d|ซอย|ซ\.|ถนน|ถ\.|บ้านเลขที่)/;
  if(!markers.test(a))return true;
  return false;
}
function monthlyRev(c){
  if(!c)return 0;
  // Use pre-computed structured value when available (accurate for quarterly/lump/semi)
  if(c.monthlyBaht!=null&&c.monthlyBaht>0)return c.monthlyBaht;
  if(!c.rate)return 0;
  const a=amt(c.rate);if(!a)return 0;
  if(c.rate.includes('เดือนละ'))return a;
  if(c.rate.includes('ไตรมาสละ'))return a/3;
  if(c.rate.includes('ปีละ'))return a/12;
  // ไม่มี keyword ความถี่ → เฉลี่ยตามระยะเวลาสัญญา
  const s=parseBE(c.start),e=parseBE(c.end);
  if(s&&e&&e>s){const months=Math.max(1,Math.round((e-s)/(30.44*864e5)));return a/months}
  return a;
}
function status(c){if(c.closed)return'closed';if(c.cancelled)return'cancelled';const n=new Date(),e=parseBE(c.end),s=parseBE(c.start);if(!e)return'unknown';if(e<n)return'expired';const th=(typeof DB!=='undefined'&&DB.sysConfig&&Number(DB.sysConfig.expiringDays))||90;if((e-n)/864e5<=th)return'expiring';if(s&&s>n)return'upcoming';return'active'}

// ========== CONTRACT DATA VALIDATION ==========
// Rule registry: แต่ละ rule = self-contained pure function (detect + fix UI + apply)
//   detect(c, allContracts) → {msg, extra?} | null
//   fix.validate(value, c, allContracts) → errorMsg | null  (null = valid)
//   apply(c, values) → mutate contract field(s) ใน place
// validateContractData / scanContractIssues / applyDataFix ทั้งหมด iterate rules registry นี้
// → เพิ่ม rule ใหม่ = push entry เดียว ไม่ต้องแก้ logic อื่น

const _RULE_BAD_NO = /^[-–—_.]+$/;
const _isVacantTenant = c => (c.tenant||'').trim()==='ว่าง' || !(c.tenant||'').trim();

const CONTRACT_RULES = [
  {
    id: 'no_missing',
    field: 'no',
    severity: 'block',
    label: 'เลขสัญญา',
    detect(c){
      const no=(c.no||'').trim();
      if(!no) return {msg:'ไม่มีเลขสัญญา'};
      if(no==='-'||no==='--'||no==='N/A'||_RULE_BAD_NO.test(no)) return {msg:'เลขสัญญาไม่ถูกต้อง ("'+no+'")'};
      return null;
    },
    fix: {
      type:'text', field:'no', label:'เลขสัญญาใหม่', placeholder:'เช่น สช.001/2569',
      // เลขปัจจุบันใช้ไม่ได้แน่นอน → autogen เลย
      initial: () => (typeof genNextContractNo==='function' ? genNextContractNo() : ''),
      regen: () => (typeof genNextContractNo==='function' ? genNextContractNo() : ''),
      validate(v, c, list){
        v=(v||'').trim();
        if(!v) return 'กรอกเลขสัญญา';
        if(v==='-'||v==='--'||v==='N/A'||_RULE_BAD_NO.test(v)) return 'เลขสัญญาไม่ถูกต้อง';
        if(list.some(x=>x&&x.id!==c.id&&(x.no||'').trim()===v)) return 'เลขสัญญาซ้ำกับฉบับอื่น';
        return null;
      }
    },
    apply(c, values){ c.no=(values.no||'').trim(); }
  },
  {
    id: 'no_duplicate',
    field: 'no',
    severity: 'block',
    label: 'เลขสัญญาซ้ำ',
    detect(c, list){
      const no=(c.no||'').trim();
      if(!no||no==='-'||no==='--'||no==='N/A'||_RULE_BAD_NO.test(no)) return null;
      const dups=list.filter(x=>x&&x.id!==c.id&&(x.no||'').trim()===no);
      if(dups.length===0) return null;
      return {msg:'เลขสัญญาซ้ำ ('+dups.length+' ฉบับอื่นใช้เลขเดียวกัน)', extra:{dupIds:dups.map(d=>d.id)}};
    },
    fix: {
      type:'text', field:'no', label:'เลขสัญญาใหม่ (ต้องไม่ซ้ำ)', placeholder:'เช่น สช.001/2569',
      // ซ้ำอยู่แล้ว → autogen เลขใหม่ที่ไม่ซ้ำ
      initial: () => (typeof genNextContractNo==='function' ? genNextContractNo() : ''),
      regen: () => (typeof genNextContractNo==='function' ? genNextContractNo() : ''),
      validate(v, c, list){
        v=(v||'').trim();
        if(!v) return 'กรอกเลขสัญญา';
        if(list.some(x=>x&&x.id!==c.id&&(x.no||'').trim()===v)) return 'เลขสัญญายังซ้ำกับฉบับอื่น';
        return null;
      }
    },
    apply(c, values){ c.no=(values.no||'').trim(); }
  },
  {
    id: 'tenant_missing',
    field: 'tenant',
    severity: 'block',
    label: 'ผู้เช่า',
    detect(c){
      if((c.tenant||'').trim()) return null;
      return {msg:'ไม่มีชื่อผู้เช่า'};
    },
    fix: {
      type:'text', field:'tenant', label:'ชื่อผู้เช่า', placeholder:'เช่น นายสมชาย ใจดี / บจก. xxx / ว่าง',
      initial: c => c.tenant || '',
      validate(v){ if(!(v||'').trim()) return 'กรอกชื่อผู้เช่า (ใส่ "ว่าง" ถ้ายังไม่มีผู้เช่า)'; return null; }
    },
    apply(c, values){ c.tenant=(values.tenant||'').trim(); }
  },
  {
    id: 'start_invalid',
    field: 'start',
    severity: 'block',
    label: 'วันเริ่มสัญญา',
    detect(c){
      if(_isVacantTenant(c)) return null;
      const s=(c.start||'').trim();
      if(!s) return {msg:'ไม่มีวันเริ่มสัญญา'};
      if(!parseBE(s)) return {msg:'วันเริ่มผิดรูปแบบ ("'+s+'") ต้องเป็น DD/MM/YYYY พ.ศ.'};
      return null;
    },
    fix: {
      type:'date', field:'start', label:'วันเริ่มสัญญา (DD/MM/YYYY พ.ศ.)', placeholder:'01/01/2569',
      initial: c => c.start || '',
      validate(v){
        v=(v||'').trim();
        if(!v) return 'กรอกวันที่';
        if(!parseBE(v)) return 'รูปแบบวันที่ไม่ถูกต้อง — DD/MM/YYYY (พ.ศ.)';
        return null;
      }
    },
    apply(c, values){ c.start=normalizeBEDate((values.start||'').trim()); }
  },
  {
    id: 'start_format_warn',
    field: 'start',
    severity: 'warn',
    label: 'วันเริ่มสัญญา format',
    detect(c){
      if(_isVacantTenant(c)) return null;
      const s=(c.start||'').trim();
      if(!s||!parseBE(s)) return null; // skip — start_invalid handles those
      if(/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return null;
      return {msg:'วันเริ่มควรเป็น DD/MM/YYYY ("'+s+'")'};
    },
    fix: {
      type:'date', field:'start', label:'วันเริ่มสัญญา (DD/MM/YYYY พ.ศ.)', placeholder:'01/01/2569',
      initial: c => normalizeBEDate(c.start||''),
      validate(v){
        v=(v||'').trim();
        if(!v||!parseBE(v)) return 'รูปแบบวันที่ไม่ถูกต้อง';
        return null;
      }
    },
    apply(c, values){ c.start=normalizeBEDate((values.start||'').trim()); }
  },
  {
    id: 'end_invalid',
    field: 'end',
    severity: 'block',
    label: 'วันสิ้นสุดสัญญา',
    detect(c){
      if(_isVacantTenant(c)) return null;
      const e=(c.end||'').trim();
      if(!e) return {msg:'ไม่มีวันสิ้นสุดสัญญา'};
      if(!parseBE(e)) return {msg:'วันสิ้นสุดผิดรูปแบบ ("'+e+'")'};
      return null;
    },
    fix: {
      type:'date', field:'end', label:'วันสิ้นสุดสัญญา (DD/MM/YYYY พ.ศ.)', placeholder:'31/12/2569',
      initial: c => c.end || '',
      validate(v, c){
        v=(v||'').trim();
        if(!v) return 'กรอกวันที่';
        const ed=parseBE(v);
        if(!ed) return 'รูปแบบวันที่ไม่ถูกต้อง';
        const sd=parseBE((c.start||'').trim());
        if(sd&&ed<=sd) return 'วันสิ้นสุดต้องหลังวันเริ่ม';
        return null;
      }
    },
    apply(c, values){ c.end=normalizeBEDate((values.end||'').trim()); }
  },
  {
    id: 'end_format_warn',
    field: 'end',
    severity: 'warn',
    label: 'วันสิ้นสุดสัญญา format',
    detect(c){
      if(_isVacantTenant(c)) return null;
      const e=(c.end||'').trim();
      if(!e||!parseBE(e)) return null;
      if(/^\d{2}\/\d{2}\/\d{4}$/.test(e)) return null;
      return {msg:'วันสิ้นสุดควรเป็น DD/MM/YYYY ("'+e+'")'};
    },
    fix: {
      type:'date', field:'end', label:'วันสิ้นสุดสัญญา (DD/MM/YYYY พ.ศ.)', placeholder:'31/12/2569',
      initial: c => normalizeBEDate(c.end||''),
      validate(v){
        v=(v||'').trim();
        if(!v||!parseBE(v)) return 'รูปแบบวันที่ไม่ถูกต้อง';
        return null;
      }
    },
    apply(c, values){ c.end=normalizeBEDate((values.end||'').trim()); }
  },
  {
    id: 'end_before_start',
    field: 'end',
    severity: 'block',
    label: 'วันสิ้นสุดก่อนวันเริ่ม',
    detect(c){
      if(_isVacantTenant(c)) return null;
      const sd=parseBE((c.start||'').trim()), ed=parseBE((c.end||'').trim());
      if(sd&&ed&&ed<=sd) return {msg:'วันสิ้นสุดต้องหลังวันเริ่ม'};
      return null;
    },
    fix: {
      type:'date', field:'end', label:'วันสิ้นสุดสัญญาใหม่ (ต้องหลังวันเริ่ม)', placeholder:'31/12/2569',
      initial: c => c.end || '',
      validate(v, c){
        v=(v||'').trim();
        const ed=parseBE(v);
        if(!ed) return 'รูปแบบวันที่ไม่ถูกต้อง';
        const sd=parseBE((c.start||'').trim());
        if(sd&&ed<=sd) return 'วันสิ้นสุดต้องหลังวันเริ่ม ('+c.start+')';
        return null;
      }
    },
    apply(c, values){ c.end=normalizeBEDate((values.end||'').trim()); }
  },
  {
    id: 'landlord_missing',
    field: 'landlord',
    severity: 'warn',
    label: 'ผู้ให้เช่า',
    detect(c){
      if(_isVacantTenant(c)) return null;
      if((c.landlord||'').trim()) return null;
      return {msg:'ไม่มีชื่อผู้ให้เช่า'};
    },
    fix: {
      type:'text', field:'landlord', label:'ชื่อผู้ให้เช่า', placeholder:'เช่น บริษัท สมบัติภา จำกัด',
      initial: c => c.landlord || '',
      validate(v){ if(!(v||'').trim()) return 'กรอกชื่อผู้ให้เช่า'; return null; }
    },
    apply(c, values){ c.landlord=(values.landlord||'').trim(); }
  },
  {
    id: 'rate_invalid',
    field: 'rate',
    severity: 'block',
    label: 'ค่าเช่า',
    detect(c){
      if(_isVacantTenant(c)) return null;
      const rs=(c.rate||'').toString();
      const rn=parseFloat(rs.replace(/[^\d.]/g,''));
      if(!rs) return {msg:'ไม่มีค่าเช่า'};
      if(isNaN(rn)||rn<=0) return {msg:'ค่าเช่าต้องมากกว่า 0'};
      return null;
    },
    fix: {
      type:'number', field:'rate', label:'ค่าเช่า (บาท/เดือน)', placeholder:'เช่น 15000',
      initial: c => {
        const n=parseFloat(String(c.rate||'').replace(/[^\d.]/g,''));
        return isNaN(n)||n<=0 ? '' : n.toString();
      },
      validate(v){
        const n=parseFloat(String(v||'').replace(/[^\d.]/g,''));
        if(!v||isNaN(n)||n<=0) return 'ใส่ตัวเลขมากกว่า 0';
        return null;
      }
    },
    apply(c, values){
      const n=parseFloat(String(values.rate||'').replace(/[^\d.]/g,''));
      // Preserve string format ที่ contract form ใช้ — เช่น "15,000 บาท/เดือน"
      c.rate=n.toLocaleString('en-US')+' บาท/เดือน';
    }
  },
  {
    id: 'pid_orphan',
    field: 'pid',
    severity: 'block',
    label: 'ทรัพย์สินไม่มีอยู่',
    detect(c){
      if(c.pid==null) return null;
      if(typeof DB==='undefined'||!DB.properties) return null;
      const p=DB.properties.find(x=>x.pid===c.pid);
      if(p) return null;
      return {msg:'อ้างอิงทรัพย์สินที่ไม่มีอยู่ (pid='+c.pid+')'};
    },
    // pid_orphan: complex fix → ส่งไป edit form เต็ม (ไม่มี inline fix)
    fix: null,
    apply: null
  },
  {
    id: 'tax_id_missing',
    field: 'taxId',
    severity: 'warn',
    label: 'เลขผู้เสียภาษี (สำหรับใบกำกับภาษี)',
    detect(c){
      if(c.cancelled) return null;
      const t=String(c.taxId||'').replace(/\D/g,'');
      if(t.length===13) return null;
      return {msg: t.length===0 ? 'ไม่มีเลขผู้เสียภาษี — ใบกำกับภาษีออกไม่ได้' : 'เลขผู้เสียภาษีไม่ครบ 13 หลัก ('+t.length+' หลัก)'};
    },
    fix: {
      type:'text', field:'taxId', label:'เลขผู้เสียภาษี (13 หลัก)', placeholder:'1-2345-67890-12-3',
      initial: c => c.taxId||'',
      validate(v){
        const d=String(v||'').replace(/\D/g,'');
        if(d.length!==13) return 'ต้องเป็นตัวเลข 13 หลัก';
        return null;
      }
    },
    apply(c, values){ c.taxId=(values.taxId||'').trim(); }
  },
  {
    id: 'tenant_addr_missing',
    field: 'tenantAddr',
    severity: 'warn',
    label: 'ที่อยู่ผู้เช่า (สำหรับใบกำกับภาษี)',
    detect(c){
      if(c.cancelled) return null;
      const a=String(c.tenantAddr||'').trim();
      if(a.length>=10) return null;
      return {msg:'ไม่มีที่อยู่ผู้เช่า — ใบกำกับภาษีออกไม่ได้'};
    },
    fix: {
      type:'text', field:'tenantAddr', label:'ที่อยู่ผู้เช่า (เลขที่/ถนน/ตำบล/อำเภอ/จังหวัด)',
      placeholder:'123 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
      initial: c => c.tenantAddr||'',
      validate(v){
        if(String(v||'').trim().length<10) return 'ที่อยู่สั้นเกินไป';
        return null;
      }
    },
    apply(c, values){ c.tenantAddr=(values.tenantAddr||'').trim(); }
  }
];

// Pure function — รับ contract object + list ของ contracts ทั้งหมด (สำหรับ dup check)
// return [{ruleId, field, severity:'block'|'warn', msg, dupIds?}]
// ใช้ทั้งใน form validation และ "ข้อมูลต้องแก้" page
function validateContractData(c, allContracts){
  const issues = [];
  if(!c) return issues;
  const list = allContracts || (typeof DB!=='undefined' ? DB.contracts : []) || [];
  CONTRACT_RULES.forEach(rule => {
    const hit = rule.detect(c, list);
    if(!hit) return;
    const issue = {ruleId: rule.id, field: rule.field, severity: rule.severity, msg: hit.msg};
    if(hit.extra) Object.assign(issue, hit.extra);
    issues.push(issue);
  });
  return issues;
}

// Action: apply inline fix to a contract via rule registry
// returns {ok: true} or {ok: false, error: 'msg'}
function applyDataFix(cid, ruleId, values){
  const rule = CONTRACT_RULES.find(r => r.id === ruleId);
  if(!rule) return {ok:false, error:'ไม่พบกฎ '+ruleId};
  if(!rule.fix || !rule.apply) return {ok:false, error:'กฎนี้ไม่รองรับการแก้แบบ inline — กรุณาใช้ฟอร์มเต็ม'};
  const c = (DB.contracts||[]).find(x => x.id === cid);
  if(!c) return {ok:false, error:'ไม่พบสัญญา ID '+cid};
  const list = DB.contracts || [];

  // Validate value via rule's fix.validate
  const value = values[rule.fix.field];
  const err = rule.fix.validate(value, c, list);
  if(err) return {ok:false, error:err};

  // Apply mutation + persist
  rule.apply(c, values);
  if(typeof save === 'function') save();
  if(typeof addActivityLog === 'function') {
    addActivityLog('datafix_applied','แก้ไข '+rule.label+' ของสัญญา '+(c.no||'#'+c.id)+' → '+value);
  }
  return {ok:true};
}

// Normalize BE date string: "1/9/2566" or "1/09/2566" → "01/09/2566"
// คืนค่าเดิมถ้า parse ไม่ได้
function normalizeBEDate(s){
  if(!s) return s;
  s = String(s).trim();
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if(!m) return s;
  const d = m[1].padStart(2,'0');
  const mo = m[2].padStart(2,'0');
  const y = m[3];
  // Sanity check: 01-31 / 01-12 / reasonable BE year
  const di = parseInt(d,10), moi = parseInt(mo,10);
  if(di<1||di>31||moi<1||moi>12) return s;
  return d + '/' + mo + '/' + y;
}

// Scan DB.contracts ทั้งหมด → return รายการที่มี issues
function scanContractIssues(){
  const cs = (typeof DB!=='undefined' && DB.contracts) || [];
  const result = [];
  cs.forEach(c => {
    const issues = validateContractData(c, cs);
    if(issues.length > 0) result.push({contract:c, issues});
  });
  return result;
}
function badge(s){const m={active:['b2-active','มีผล'],expiring:['b2-expiring','ใกล้หมด'],expired:['b2-expired','หมดอายุ'],upcoming:['b2-upcoming','รอเริ่ม'],cancelled:['b2-cancelled','ยกเลิก'],closed:['b2-cancelled','สิ้นสุด'],paid:['b2-paid','ชำระแล้ว'],unpaid:['b2-unpaid','รอชำระ'],overdue:['b2-overdue','เกินกำหนด']};const[c,l]=m[s]||['b2-neutral','?'];return`<span class="b2 ${c}">${l}</span>`}
// Invoice status badge helper (H3) — use this instead of inline HTML
function invBadge(s){
  const m={
    draft:['#fef3c7','#92400e','ร่าง'],
    sent:['#dbeafe','#1e40af','ส่งแล้ว'],
    paid:['#dcfce7','#166534','ชำระแล้ว'],
    partial:['#ffedd5','#c2410c','ชำระบางส่วน'],
    overdue:['#fee2e2','#991b1b','ค้างชำระ'],
    voided:['#f1f5f9','#64748b','ยกเลิก']
  };
  const[bg,c,l]=m[s]||['#f1f5f9','#64748b',s||'-'];
  return `<span style="background:${bg};color:${c};padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600">${l}</span>`;
}
function typeColor(t) {
  if(!t) return 'other';
  if(t.includes('เสาสัญญาณ')) return 'signal';
  if(t.includes('ป้ายโฆษณา')) return 'billboard';
  if(t.includes('พักอาศัย')||t.includes('อยู่อาศัย')) return 'residence';
  if(t.includes('พาณิชย')||t.includes('ท่ามะกา')) return 'commercial';
  if(t.includes('เกษตร')) return 'agriculture';
  if(t.includes('อุตสาห')||t.includes('โรงงาน')) return 'industrial';
  if(t.includes('จอด')) return 'parking';
  if(t.includes('สำนัก')) return 'office';
  if(t.includes('สาธารณ')) return 'utility';
  return 'other';
}
function cat(p){if(!p)return'อื่นๆ';if(p.includes('อยู่อาศัย'))return'ที่พักอาศัย';if(p.includes('เสาสัญญาณ'))return'เสาสัญญาณ';if(p.includes('ป้ายโฆษณา'))return'ป้ายโฆษณา';if(p.includes('สำนักงาน'))return'สำนักงาน';if(p.includes('อินเตอร์เน็ต'))return'สาธารณูปโภค';if(p.includes('เกษตรกรรม'))return'เกษตรกรรม';if(p.includes('จอดรถ'))return'ที่จอดรถ';if(p.includes('โกดัง')||p.includes('โรงงาน'))return'โกดัง/โรงงาน';return'อื่นๆ'}
function payFreq(rate,payment,c){
  const mo={type:'monthly',periods:[1,2,3,4,5,6,7,8,9,10,11,12],labels:MO,label:'รายเดือน',due:5};
  const qt={type:'quarterly',periods:[1,2,3,4],labels:['Q1 (ม.ค.-มี.ค.)','Q2 (เม.ย.-มิ.ย.)','Q3 (ก.ค.-ก.ย.)','Q4 (ต.ค.-ธ.ค.)'],label:'รายไตรมาส',due:5};
  const yr={type:'yearly',periods:[1],labels:['ทั้งปี'],label:'รายปี',due:5};
  const lump={type:'lump',periods:[1],labels:['ครั้งเดียว'],label:'ชำระครั้งเดียว',due:0};
  // Use structured fields when contract object provided (most accurate)
  if(c&&c.payFreq){
    const due=c.payDueDay||5;
    if(c.payFreq==='monthly')return{...mo,due};
    if(c.payFreq==='quarterly')return{...qt,due};
    if(c.payFreq==='yearly')return{...yr,due};
    if(c.payFreq==='semi')return{type:'semi',periods:[1,2],labels:['H1 (ม.ค.-มิ.ย.)','H2 (ก.ค.-ธ.ค.)'],label:'ราย 6 เดือน',due};
    if(c.payFreq==='lump')return lump;
    // 'custom' or unknown — fall through to text parse below
  }
  const p=payment||'';
  // ตรวจจาก payment method ก่อน (แม่นกว่า)
  if(p.includes('ทั้งหมดในวันเซ็น'))return lump;
  if(p.includes('รายปี')||p.includes('เป็นรายปี'))return yr;
  if(p.includes('ทุก 6 เดือน')||p.includes('ทุก6เดือน')){return{type:'semi',periods:[1,2],labels:['H1 (ม.ค.-มิ.ย.)','H2 (ก.ค.-ธ.ค.)'],label:'ราย 6 เดือน',due:5};}
  if(p.includes('ทุก 3 เดือน')||p.includes('ทุก3เดือน'))return qt;
  // ตรวจจาก rate string
  if(!rate)return mo;
  if(rate.includes('ไตรมาสละ'))return qt;
  if(rate.includes('ปีละ'))return yr;
  // ตรวจ due date จาก payment
  const dm=p.match(/วันที่\s*(\d+)/);
  const due=dm?parseInt(dm[1]):(c&&c.payDueDay?c.payDueDay:5);
  return{...mo,due};
}
function toast(msg,type='success',ms){
  const el=document.getElementById('toast');
  if(!el)return;
  const icons={success:'✓',error:'✕',warning:'⚠',info:'ℹ'};
  const colors={success:'bg-green-500',error:'bg-red-500',warning:'bg-amber-500',info:'bg-blue-500'};
  const icon=icons[type]||icons.info;
  const cls=colors[type]||colors.info;
  el.innerHTML=`<div class="toast ${cls} text-white px-5 py-3 rounded-lg shadow-lg text-sm font-medium" role="status" aria-live="polite"><span style="font-weight:700;margin-right:8px">${icon}</span>${msg}</div>`;
  el.classList.remove('hidden');
  const dur=ms||(type==='error'||type==='warning'?4000:2500);
  clearTimeout(window._toastTimer);
  window._toastTimer=setTimeout(()=>el.classList.add('hidden'),dur);
}
let _modalDirty=false;
function markModalDirty(){_modalDirty=true;}
function closeModal(force){
  if(!force && _modalDirty){
    const mbody=document.getElementById('mbody');
    const hasForm=mbody&&(mbody.querySelector('form')||mbody.querySelector('input[type="text"],textarea,select'));
    if(hasForm){
      customConfirm('ออกจากหน้านี้?','คุณมีข้อมูลที่ยังไม่ได้บันทึก\nต้องการออกโดยไม่บันทึกใช่หรือไม่?',function(){
        _modalDirty=false;
        document.getElementById('modal').classList.add('hidden');
        render();
      },{icon:'⚠️',yesLabel:'ออกไม่บันทึก',yesColor:'#dc2626',noLabel:'อยู่ต่อ'});
      return;
    }
  }
  _modalDirty=false;
  document.getElementById('modal').classList.add('hidden');
  render();
}
function enhanceDatalistInputs(container){
  (container||document).querySelectorAll('input[list]').forEach(input=>{
    if(input.dataset.dlEnhanced)return;
    input.dataset.dlEnhanced='1';
    input.style.paddingRight='28px';
    const wrap=document.createElement('span');
    wrap.style.cssText='position:absolute;right:8px;top:50%;transform:translateY(-50%);cursor:pointer;font-size:14px;color:#64748b;user-select:none;line-height:1';
    wrap.textContent='▾';
    wrap.title='แสดงตัวเลือกทั้งหมด';
    wrap.onmouseenter=()=>wrap.style.color='#6366f1';
    wrap.onmouseleave=()=>wrap.style.color='#64748b';
    wrap.onclick=(e)=>{
      e.preventDefault();
      e.stopPropagation();
      const saved=input.value;
      input.value='';
      input.focus();
      const onBlur=()=>{
        if(!input.value)input.value=saved;
        input.removeEventListener('blur',onBlur);
      };
      input.addEventListener('blur',onBlur);
    };
    if(input.parentElement){
      input.parentElement.style.position='relative';
      input.parentElement.appendChild(wrap);
    }
  });
}
function $(id){return document.getElementById(id)}
function kpiCard(label, value, secondary='', trend='', color='#6366f1', colorLight='#a5b4fc', icon='') {
  const trendHTML = trend ? `<span class="kpi-trend ${trend.up ? 'up' : 'down'}">${trend.up ? '▲' : '▼'} ${trend.pct}%</span>` : '';
  return `<div class="kpi-card" style="--card-color:${color};--card-color-light:${colorLight}">
    <p class="kpi-label">${label}</p>
    <div style="display:flex;align-items:baseline;gap:8px">
      <div class="kpi-value">${value}</div>
      ${trendHTML}
    </div>
    ${secondary ? `<p class="kpi-secondary">${secondary}</p>` : ''}
  </div>`;
}
// ── ตัด " โดย ..." ออกจากชื่อ landlord เพื่อ display เท่านั้น ──
// "บริษัท ก จำกัด โดย นายข" → "บริษัท ก จำกัด"
// ห้ามใช้เป็น key ค้นหา/อ้างอิง DB — ใช้ name เต็มเสมอ
function shortLandlordName(name){
  if(!name) return '';
  const idx=name.indexOf(' โดย ');
  return idx!==-1?name.substring(0,idx).trim():name;
}

