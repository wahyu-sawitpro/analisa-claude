/* ================= Field detection ================= */
// Each key lists regexes in priority order; the first header matching the earliest regex wins.
// One header is claimed by one key only. Two schemas: CRM engagements and sales order lines.
const CRM_FIELDS=[
  ["reasonOther",[/alasan\s*lain|other\s*reason/]],
  ["fieldPic",[/assign\s*field|pic.*lapang|field\s*(team|pic|officer)|tim\s*lapang/]],
  ["closing",[/closing/]],
  ["modified",[/last\s*modified|modified\s*date|updated\s*at/]],
  ["fertDate",[/tanggal\s*pemupukan/]],
  ["followDate",[/tanggal\s*follow/]],
  ["followPlan",[/rencana\s*follow|recana\s*follow/]],
  ["ffb",[/ffb|\(mt\)/]],
  ["needKg",[/fertilizer\s*needs\s*\(kg\)|kebutuhan\s*pupuk/]],
  ["potential",[/potential\s*gmv|potential\s*sales|potensi/]],
  ["reason",[/alasan|reason/]],
  ["status",[/respon\s*pengguna|status\s*leads|lead\s*status|^status$/]],
  ["callResp",[/call\s*response/]],
  ["phone",[/phone\s*no|^phone$/,/nomor\s*tel|telp|telf|cleaned\s*phone/,/no\.?\s*hp/]],
  ["orderRef",[/^order\s*no|no\.?\s*order|order\s*number|^order$/]],
  ["kabupaten",[/^kabupaten$|regency/]],
  ["province",[/^province$|^provinsi$/]],
  ["name",[/nama\s*customer|nama\s*leads|customer\s*name|^nama$/]],
  ["pic",[/smallholders\s*team|pic\s*\(|^pic$|pic\s*name|sales\s*(rep|person)|petugas/]],
  ["channel",[/engagement\s*type|tipe\s*engag|jenis\s*engag|channel|metode/]],
  ["date",[/^tanggal$|tanggal\s*engag|engagement\s*date|^date$|^tgl$/]],
  ["leadType",[/^leads?$|lead\s*type|jenis\s*lead/]],
  ["location",[/kecamatan|lokasi|kabupat|location|wilayah/]],
  ["source",[/sumber\s*lead|lead\s*source|^source$/]],
  ["purpose",[/objective|tujuan/]],
  ["product",[/product\s*yang\s*diminta|produk\s*yang\s*ditawarkan|pupuk\s*ditawarkan|^product$|^produk$/]],
  ["userType",[/user\s*type/]],
  ["custType",[/customer\s*type|user\s*type|tipe\s*customer/]],
  ["id",[/engagement\s*id|^id$|lead\s*id/]],
  ["detail",[/detail\s*pembahasan|keterangan|catatan|notes?$/]],
];
const SALES_FIELDS=[
  ["orderNo",[/order_?no|order\s*no|order\s*number|no\.?\s*order/]],
  ["invoice",[/invoice/]],
  ["date",[/order_?date|tanggal\s*order|sale.*date|^date$|^tanggal$/]],
  ["pic",[/pic_?name|sales\s*name|^pic$|salesperson/]],
  ["team",[/pic_?team|team/]],
  ["custId",[/customer_?id/]],
  ["phone",[/customer_?phone|phone|no\.?\s*hp/]],
  ["name",[/customer_?name|nama\s*customer/]],
  ["qty",[/^qty$|quantity|jumlah/]],
  ["gmv",[/^gmv$/,/gmv/,/sales_?amount/,/nett_?sales/,/revenue/,/^total$/]],
  ["salesAmount",[/sales_?amount/]],
  ["nett",[/nett_?sales|net\s*sales/]],
  ["revenue",[/^revenue$|paid\s*amount|amount\s*paid|total_?paid|paid_?with/]],
  ["unitPrice",[/price_?per|unit_?price|harga_?satuan/]],
  ["role",[/user_?role|customer_?role|buyer_?type/]],
  ["discount",[/discount|diskon/]],
  ["shipping",[/shipping|ongkir/]],
  ["item",[/item_?name|^item$|product_?name|^produk$/]],
  ["category",[/product_?cat|kategori|category/]],
  ["payStatus",[/inv_?status|payment/]],
  ["soStatus",[/so_?status|order_?status/]],
  ["city",[/^city$|kota|kabupaten/]],
  ["province",[/province|provinsi/]],
  ["custStatus",[/customer_?status/]],
  ["app",[/app_?type|platform/]],
];
const norm=s=>String(s??"").toLowerCase().replace(/[_\-]+/g," ").replace(/\s+/g," ").trim();
function detectWith(fields,headers){
  const map={}, used=new Set();
  for(const [key,res] of fields){ for(const re of res){ const h=headers.find(h=>!used.has(h)&&(re.test(String(h).toLowerCase().trim())||re.test(norm(h)))); if(h){map[key]=h;used.add(h);break;} } }
  return map;
}
const detectCrm=h=>detectWith(CRM_FIELDS,h), detectSales=h=>detectWith(SALES_FIELDS,h);
// A price list: item names and a price column, no order or quantity columns.
const isPriceList=headers=>{ const h=headers.map(norm);
  return h.some(x=>/nama barang|item|product|produk/.test(x))&&h.some(x=>/harga|price/.test(x))&&!h.some(x=>/^qty$|quantity|order|invoice|gmv/.test(x)); };
function detectRole(headers){
  if(isPriceList(headers)) return "price";
  const s=detectSales(headers), c=detectCrm(headers);
  const salesScore=["orderNo","invoice","qty","gmv","item"].filter(k=>s[k]).length;
  const crmScore=["status","reason","channel","detail","id"].filter(k=>c[k]).length;
  return salesScore>=3&&salesScore>=crmScore?"sales":"crm";
}
const ROLE_LABEL={crm:"CRM engagements",sales:"Sales orders",price:"Price list"};

/* ================= Cleaning & translation ================= */
const blank=v=>v===null||v===undefined||(typeof v==="string"&&v.trim()==="")||(typeof v==="number"&&isNaN(v));
const clean=v=>blank(v)?null:String(v).replace(/\s+/g," ").trim();
const STATUS_ORDER=["Ordered","Prospect","Considering","Interested","Not interested"];
const WON="Ordered", WARM=new Set(["Prospect","Considering","Interested"]);
function canonStatus(v){ const s=norm(v); if(!s) return null;
  if(/already\s*order|sudah\s*order|ordered|closing|deal|won|closed/.test(s)) return "Ordered";
  if(/cold|tidak|ga?k\s*minat|not\s*interest|tolak|reject|lost/.test(s)) return "Not interested";
  if(/prospect|transaksi\s*dalam/.test(s)) return "Prospect";
  if(/timbang|pikir|consider|follow|nego|ragu/.test(s)) return "Considering";
  if(/tertarik|minat|interest|hot|warm/.test(s)) return "Interested";
  return clean(v).replace(/^./,c=>c.toUpperCase()); }
const REASON_EN=[
  [/belum\s*(ada\s*)?ketertarikan|cek harga|nanya|no clear interest/,"Just asking (no clear interest)"],
  [/supplier|toko langganan|langganan/,"Already has a supplier / shop"],
  [/terikat|kud|agen|koperasi|bumdes/,"Tied to a KUD / agent"],
  [/tidak tersedia|out of stock|stok/,"Product out of stock"],
  [/harga|mahal|price|expensive/,"Price too high"],
  [/lahan|no land/,"No longer has land"],
  [/kuantitas kecil|small quantit/,"Only wants small quantities"],
  [/waktu dekat|belum butuh|belum perlu|near term|nanti/,"No need in the near term"],
  [/tidak (bisa )?dihubungi|tidak (merespon|respon|balas)|no response|unreachable/,"Unreachable"],
  [/modal|dana|budget/,"No budget"],
  [/percaya|trust/,"Doubts the product"],
  [/^lain|other/,"Other"],
];
const trReason=v=>{ const s=norm(v); if(!s) return null; const m=REASON_EN.find(([re])=>re.test(s)); return m?m[1]:clean(v); };
// Reason themes: what kind of fix each reason calls for.
const THEMES=[
  ["Locked in elsewhere",/supplier|kud|agent/i,"#6E5A8A"],
  ["Stock & delivery",/out of stock/i,"#A8653A"],
  ["Price",/price/i,"#B5523B"],
  ["Not a fit",/land|small quantities|wrong number/i,"#8E9C84"],
  ["Timing",/near term/i,"#5B7F95"],
  ["Just asking",/just asking|no clear interest|^other$/i,"#C9B458"],
];
const themeOf=r=>{ if(!r) return null; const t=THEMES.find(([,re])=>re.test(r)); return t?t[0]:"Other"; };
// Signals read from the free-text discussion notes (Indonesian).
const SIGNALS=[
  ["logistics","Asked about the warehouse, delivery or minimum order",/alamat gudang|gudang|pengantaran|diantar|dianter|antar\b|jemput|ongkir|minimal ton|proses transaksi/],
  ["price","Asked about prices or discounts",/harga|diskon|grosir/],
  ["stock","Wanted product was out of stock, or delivery too slow",/tidak tersedia|belum tersedia|\bsla\b|stok/],
  ["credit","Buys on credit (cicilan) from current shop",/cicil|kredit|tempo|hutang/],
  ["season","Fertilizing for this season already done",/pemupukan sudah|selesai pemupukan|jadwal pemupukan|sudah lewat/],
  ["coop","Member of a KUD / BUMDES / agent",/\bkud\b|bumdes|koperasi|agen/],
  ["wrong","Wrong number or not an oil palm farmer",/salah sambung|bukan petani/],
];
function trChannel(v){ const s=norm(v); if(!s) return null;
  if(/chat|whats|\bwa\b|text/.test(s)) return "WhatsApp / text"; if(/visit|kunjung|onsite|on site|lapang/.test(s)) return "On-site visit";
  if(/phone|telepon|call|telp/.test(s)) return "Phone call"; if(/event|seminar|pameran/.test(s)) return "Event";
  return clean(v).replace(/\s*\(.*\)\s*/,""); }
function toNum(v){ if(blank(v)) return null; if(typeof v==="number") return v; let s=String(v).replace(/rp|idr|\s/gi,"");
  if(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s=s.replace(/\./g,"").replace(",","."); else s=s.replace(/,/g,""); const n=parseFloat(s); return isNaN(n)?null:n; }
function toDate(v){ if(blank(v)) return null; let d=null;
  if(v instanceof Date) d=new Date(Math.round(v.getTime()/60000)*60000);
  else if(typeof v==="number"&&v>20000&&v<80000) d=new Date(Math.round((v-25569)*864e5)+new Date().getTimezoneOffset()*6e4);
  else{ const s=String(v).trim(); let m;
    if((m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/))) d=new Date(+m[1],+m[2]-1,+m[3]);
    else if((m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/))) d=new Date(+(m[3].length===2?"20"+m[3]:m[3]),+m[2]-1,+m[1]);
    else{ const t=Date.parse(s); if(!isNaN(t)) d=new Date(t);} }
  if(!d||isNaN(d)||d.getFullYear()<2000) return null; return new Date(d.getFullYear(),d.getMonth(),d.getDate()); }
const phoneKey=v=>{ if(blank(v)) return null; const s=String(v); if(/^P[0-9a-f]{8}$/.test(s)) return s;
  let d=s.split(/\s+-\s+/)[0].replace(/\D/g,""); if(d.startsWith("62")) d=d.slice(2); if(d.startsWith("0")) d=d.slice(1); return d.length>=8?d:null; };
const nameKey=v=>{ const s=clean(v); if(!s) return null; if(/^customer [0-9a-f]{5}$/i.test(s)) return s.toLowerCase();
  const t=s.toLowerCase().replace(/^(bu|ibu|pak|bapak|bpk)\.?\s+/,"").replace(/[^a-z ]/g,"").split(" ").filter(Boolean)[0]; const k=t?t.replace(/[aeiouhy]/g,""):""; return k.length>=3?k:(t&&t.length>=3?t:null); };
const firstTok=v=>(clean(v)||"").toLowerCase().split(" ")[0]||null;
const PERSON_RE=/^(phone|name)$/;

/* ================= Reading sheets (with or without a header row) ================= */
// A first row that already holds data (dates, order numbers, files, amounts) means the export has no header row:
// column names are then inferred from what each column contains.
const DATA_CELL=[/^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/,/^\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}/,/^#?B2[BC]\d{3,}$/i,/\.(pdf|jpe?g|png)$/i,/^\d{1,3}(,\d{3}){1,}$/,/^\+?\d{9,14}$/];
const looksData=row=>row.filter(v=>!blank(v)&&DATA_CELL.some(re=>re.test(String(v).trim()))).length>=2;
const MONTHS=/^(jan|feb|mar|apr|may|mei|jun|jul|aug|agu|sep|oct|okt|nov|dec|des)[a-z]*$/i;
const PROV=/^(aceh|riau|kepulauan riau|jambi|bengkulu|lampung|sumatera( utara| barat| selatan)?|kepulauan bangka belitung|bangka belitung|kalimantan.*|jawa.*|banten|dki jakarta|sulawesi.*|papua.*)$/i;
const PRODUCT_WORDS=/benih|pupuk|urea|dokter sawit|kcl|mop|npk|\brp\b|herbis|garlon|round ?up|gramoxone|kieserit|dolomit|topaz|uji/i;
function inferHeaders(rows){
  const n=Math.max(...rows.map(r=>r.length)), names=Array(n).fill(null);
  const col=j=>rows.map(r=>r[j]).filter(v=>!blank(v)).map(v=>String(v).trim()), share=(vs,re)=>vs.length?vs.filter(v=>re.test(v)).length/vs.length:0;
  const take=(j,nm)=>{ if(!names.includes(nm)) names[j]=nm; };
  for(let j=0;j<n;j++){ const vs=col(j); if(!vs.length) continue;
    if(share(vs,MONTHS)===1) take(j,"Month");
    else if(share(vs,DATA_CELL[0])>=.6||share(vs,DATA_CELL[1])>=.6) take(j,"Tanggal");
    else if(share(vs,DATA_CELL[2])>=.6) take(j,"Order no");
    else if(share(vs,DATA_CELL[3])>=.6) take(j,"Attachment");
    else if(share(vs,/^\+?0?\d{9,14}$/)>=.6) take(j,"Phone No");
    else if(share(vs,/^\d{1,3}(,\d{3})+(\.\d+)?$|^\d{4,}$/)>=.6) take(j,"Potential GMV");
    else if(share(vs,PROV)>=.8) take(j,"Province");
    else if(share(vs,/,.*,/)>=.6) take(j,"Lokasi"); }
  const text=j=>!names[j]&&col(j).length&&share(col(j),/\d{5,}/)<.3;
  let prod=-1; for(let j=0;j<n;j++) if(text(j)&&share(col(j),PRODUCT_WORDS)>=.5&&col(j).join("").length/col(j).length>15){ names[j]="Product yang diminta customer"; prod=j; break; }
  for(let j=0;j<n;j++) if(text(j)&&share(col(j),/\d+\s*(sak|items?|seeds|lsu|ssu|liter|kg)|\(\d+\)/i)>=.5){ names[j]="Qty detail"; break; }
  if(prod>=0) for(let j=prod+1;j<n;j++) if(text(j)){ names[j]="Objective"; break; }
  const loc=names.indexOf("Lokasi"); if(loc>=0){ const nx=[]; for(let j=loc+1;j<n&&nx.length<2;j++) if(text(j)) nx.push(j); if(nx[0]!==undefined) names[nx[0]]="Kecamatan"; if(nx[1]!==undefined) names[nx[1]]="Kabupaten"; }
  const ph=names.indexOf("Phone No"), person=j=>text(j)&&share(col(j),/^[A-Za-z][A-Za-z.'\/ ]{1,40}$/)>=.8;
  for(let j=0;j<n;j++) if(person(j)&&(ph<0||j<ph)){ names[j]="Nama Customer"; break; }
  for(let j=Math.max(0,prod);j<n;j++) if(person(j)){ names[j]="PIC"; break; }
  return names.map((nm,i)=>nm||`Column ${i+1}`);
}
// Array-of-arrays (one sheet) -> data source.
function aoaToSource(aoa,name,sheet){
  let hi=aoa.findIndex(r=>r.filter(v=>!blank(v)).length>=2); if(hi<0) hi=0;
  // a title row above the real headers (e.g. "Ongkir" over a price list): use the row that names the item and price columns
  const ph=aoa.slice(0,6).findIndex(r=>r.some(v=>/nama barang|item name|product name/i.test(String(v??"")))&&r.some(v=>/harga|price/i.test(String(v??""))));
  if(ph>hi) hi=ph;
  const headerless=looksData(aoa[hi]||[]);
  const headers=headerless?inferHeaders(aoa.slice(hi)):(aoa[hi]||[]).map((h,i)=>blank(h)?`Column ${i+1}`:String(h).replace(/^﻿/,"").trim());
  const body=aoa.slice(headerless?hi:hi+1);
  return {name,sheet,headers,headerless,rows:body.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??null]))).filter(r=>Object.values(r).some(v=>!blank(v))),on:true,role:"auto",team:"auto"};
}

/* ================= Formatting ================= */
const nf=new Intl.NumberFormat("en-US");
const pct=(a,b)=>b?Math.round(a/b*100):0;
function rp(n){ if(!n) return "Rp0"; const a=Math.abs(n); if(a>=1e9) return "Rp"+(n/1e9).toLocaleString("en-US",{maximumFractionDigits:2})+"B";
  if(a>=1e6) return "Rp"+(n/1e6).toLocaleString("en-US",{maximumFractionDigits:a>=1e8?0:1})+"M"; return "Rp"+nf.format(Math.round(n)); }
function rpParts(n){ const m=rp(n).replace("Rp","").match(/^(.*?)([MB])?$/); return [m[1],m[2]||""]; }
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], DAY=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const fd=d=>d?`${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`:"–";
const fds=d=>d?`${d.getDate()} ${MON[d.getMonth()]}`:"–";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function span(ds){ ds=ds.filter(Boolean).sort((a,b)=>a-b); if(!ds.length) return "Undated"; const a=ds[0],b=ds[ds.length-1]; if(+a===+b) return fd(a);
  if(a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MON[b.getMonth()]} ${b.getFullYear()}`;
  if(a.getFullYear()===b.getFullYear()) return `${fds(a)} – ${fds(b)} ${b.getFullYear()}`;
  return `${fd(a)} – ${fd(b)}`; }
const STATUS_COLOR={"Ordered":"#274E13","Prospect":"#4A653B","Interested":"#4A653B","Considering":"#D9A21B","Not interested":"#8E9C84"};
const EXTRA=["#5B7F95","#A8653A","#6E5A8A","#3F8C7A"];
const LABEL={channel:"Engagement channel",source:"Lead source",leadType:"Lead type",pic:"PIC",custType:"Customer type",userType:"Buyer type",kabupaten:"Regency",location:"Location",purpose:"Objective",_src:"Data source"};
function countBy(rows,f){const m=new Map();for(const r of rows){const k=f(r);if(k===null||k===undefined)continue;m.set(k,(m.get(k)||0)+1)}return [...m].sort((a,b)=>b[1]-a[1])}
function sumBy(rows,f,v){const m=new Map();for(const r of rows){const k=f(r);if(k===null||k===undefined)continue;m.set(k,(m.get(k)||0)+v(r))}return [...m].sort((a,b)=>b[1]-a[1])}
const srcLabel=d=>d.sheet&&!/^sheet\s*1$/i.test(d.sheet)?`${d.name} · ${d.sheet}`:d.name;
const shortItem=s=>String(s||"").replace(/\s*\(\d+\s*butir\)/i,"").replace(/\s+-\s+Topaz.*$/i,"").trim();

/* ================= Analysis ================= */
function canonCrm(r,map,src,defStatus){ const o={_raw:r,_src:src};
  for(const k in map){ const v=r[map[k]];
    o[k]=k==="potential"||k==="ffb"||k==="needKg"?toNum(v):k==="date"||k==="closing"||k==="modified"||k==="fertDate"||k==="followDate"?toDate(v):k==="status"?canonStatus(v)
      :k==="channel"?trChannel(v):k==="reason"?trReason(v):k==="custType"||k==="userType"?(clean(v)||"").replace(/[^\p{L}\p{N} \/-]/gu,"").trim()||null:clean(v); }
  if(o.reason==="Other"&&o.reasonOther) o.reason=trReason(o.reasonOther);
  o.reasonRaw=map.reason?clean(r[map.reason]):null;
  o.ph=phoneKey(o.phone); o.nk=nameKey(o.name);
  const refOf=v=>(String(v||"").match(/#?B2[BC]\d{3,}/i)||[])[0]?.replace(/^#?/,"#").toUpperCase()||null;
  o.ref=refOf(o.orderRef)||refOf(o.detail); o.refs=o.ref?[o.ref]:[]; o.refVal=o.ref?{[o.ref]:o.potential||0}:{};
  if(!o.status&&defStatus) o.status=defStatus;
  const txt=norm(o.detail); o.signals=SIGNALS.filter(([,,re])=>re.test(txt)).map(s=>s[0]);
  if(o.status!==WON&&/(^|[^a-z])(closing|sudah order|already order|deal)\b/i.test(o.detail||"")&&!/(belum|tidak|gagal|batal|not)\s+(closing|order|deal)/i.test(o.detail||"")){ o.statusLogged=o.status; o.status=WON; }
  o.outcome=o.status===WON?"Won":WARM.has(o.status)?"Warm":o.status==="Not interested"?"Lost":null;
  o.theme=themeOf(o.reason);
  return o; }
function canonSale(r,map,src){ const o={_raw:r,_src:src};
  for(const k in map){ const v=r[map[k]]; o[k]=["qty","gmv","salesAmount","nett","revenue","discount","shipping"].includes(k)?toNum(v):k==="date"?toDate(v):clean(v); }
  o.ph=phoneKey(o.phone); o.nk=nameKey(o.name); if(o.role) o.role=o.role.split(/[;,]/)[0].trim();
  o.family=familyOf(o.item); o.region=regionOf(o.city)||regionOf(o.province);
  o.unit=o.unitPrice??(o.qty?(o.salesAmount??o.gmv??0)/o.qty:null);
  return o; }
// Product family from the item name (fertilizer type), so "RP Mahkota" and "RP Sasco" count together.
const FAMILIES=[["Leaf & soil tests",/uji\s*(daun|hara|tanah)|dokter\s*sawit|\blsu\b|\bssu\b|soil\s*test|leaf\s*test/],["Seeds",/benih|seed|topaz|bibit/],["Kieserite (Mg)",/kieserit|kiserit/],["Rock phosphate (RP)",/\brp\b|rock\s*phos|fosfat/],["NPK",/\bnpk\b/],["KCL / MOP",/kcl|\bmop\b/],["Urea",/urea/],
  ["ZA",/\bza\b/],["Borate",/borat|boron/],["Dolomite",/dolomit/],["TSP / SP-36",/\btsp\b|sp-?36/],["Herbicide & pesticide",/gramoxone|metsulindo|herbisida|herbicide|racun|insektisida|pestisida|round\s*up|garlon|supretox|marxone/],["AC AKP",/\bakp\b|\bac\s+powder/]];
const familyOf=v=>{ const s=norm(v); if(!s) return null; const f=FAMILIES.find(([,re])=>re.test(s)); return f?f[0]:clean(v).split(" ")[0]; };
const regionOf=v=>{ const s=clean(v); if(!s) return null; const t=s.toUpperCase().replace(/^(KABUPATEN|KAB\.?|KOTA)\s+/,"").replace(/\s+(CITY|REGENCY)$/,"").trim();
  return t.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()); };

function analyse(sources,opt={}){
  const A={crmSources:[],salesSources:[]}; const crm=[], lines=[];
  for(const d of sources){ const role=d.role&&d.role!=="auto"?d.role:detectRole(d.headers), label=srcLabel(d);
    if(role==="sales"){ const m=detectSales(d.headers); A.salesSources.push(label); for(const r of d.rows) if(Object.values(r).some(v=>!blank(v))) lines.push(canonSale(r,m,label)); }
    else { const m=detectCrm(d.headers), succ=!m.status&&(/success|already\s*order|closing/i.test(d.name)||!!m.orderRef)?WON:null; A.crmSources.push({label,map:m,succ:!!succ});
      let prev=null;
      for(const r of d.rows){ if(!Object.values(r).some(v=>!blank(v))) continue; const o=canonCrm(r,m,label,succ);
        // a row with only an order number (and amount) continues the closing above it: same customer, another order
        if(prev&&o.ref&&!o.date&&!o.name&&!o.phone){ prev.refs.push(o.ref); prev.refVal[o.ref]=o.potential||0; if(o.potential) prev.potential=(prev.potential||0)+o.potential; continue; }
        crm.push(o); prev=o; } } }
  // Trend review: CRM rows outside the sales months are left out (counted in A.crmOutside)
  if(opt.window){ const [a,b]=opt.window, n0=crm.length; for(let i=crm.length-1;i>=0;i--){ const d=crm[i].date; if(d&&(d<a||d>b)) crm.splice(i,1); } A.crmOutside=n0-crm.length; }
  // Sales: the same order line in two uploaded files counts once
  { const seen=new Map(); for(let i=lines.length-1;i>=0;i--){ const l=lines[i], k=[l.orderNo||l.invoice,l.item,l.qty,l.gmv].join("|");
      if(l.orderNo||l.invoice){ if(seen.has(k)&&seen.get(k)!==l._src){ lines.splice(i,1); continue; } seen.set(k,l._src); } } }
  // Two or more weeks of sales (one file or several): analyse the latest Monday–Sunday week, keep the week before to compare
  const wkOf=d=>{ const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); x.setDate(x.getDate()-(x.getDay()+6)%7); return +x; };
  const weeks=[...new Set(lines.filter(l=>l.date).map(l=>wkOf(l.date)))].sort((a,b)=>b-a);
  const allLines=lines.slice(); let prevLines=[];
  // Trend review (a multi-month export): analyse every full month together instead of the latest week
  if(opt.trend){ A.mode="trend"; A.trend=monthTrend(lines);
    if(A.trend){ const mk=d=>d.getFullYear()*12+d.getMonth(); lines.splice(0,lines.length,...lines.filter(l=>l.date&&A.trend.months.includes(mk(l.date)))); } }
  if(!opt.trend&&weeks.length>=2){ prevLines=lines.filter(l=>l.date&&wkOf(l.date)===weeks[1]);
    const keep=lines.filter(l=>!l.date||wkOf(l.date)===weeks[0]); lines.splice(0,lines.length,...keep);
    A.weekStart=new Date(weeks[0]); A.prevStart=new Date(weeks[1]); A.olderWeeks=weeks.length-2; }
  // CRM rows outside the sales week belong to another week's review
  // (a closing that names an order is placed in the week of that order, whatever date the log gives it)
  if(!opt.trend&&weeks.length){ const w0=weeks[0], w1=w0+7*864e5, nos=L=>new Set(L.map(l=>String(l.orderNo||"").toUpperCase())), cur=nos(lines), pw=nos(prevLines);
    const place=o=>o.refs.some(r=>cur.has(r))?0:o.refs.some(r=>pw.has(r))?-1:!o.date?0:+o.date<w0?-1:+o.date>=w1?1:0;
    const out=crm.filter(o=>place(o)!==0);
    A.crmBefore=out.filter(o=>place(o)<0).length; A.crmAfter=out.filter(o=>place(o)>0).length; A.weekStart=A.weekStart||new Date(w0);
    if(out.length){ const keep=crm.filter(o=>!out.includes(o)); crm.splice(0,crm.length,...keep); } }
  // CRM: repeated IDs counted once, latest source wins
  const byId=new Map(), C=[]; let dupes=0;
  for(const o of crm){ if(o.id){ if(byId.has(o.id)){ C[byId.get(o.id)]=o; dupes++; continue; } byId.set(o.id,C.length); } C.push(o); }
  A.crm=C; A.dupes=dupes; A.lines=lines;
  // Sales exports without a region: take it from the CRM closing log, matched by order number
  if(!lines.some(l=>l.region)){ const geo=new Map(); C.forEach(r=>{ const g=r.kabupaten||(r.location||"").split(/[,-]/)[1]; if(g) r.refs.forEach(x=>geo.set(x,{region:regionOf(g),province:r.province})); });
    lines.forEach(l=>{ const g=geo.get(String(l.orderNo||"").toUpperCase()); if(g){ l.region=g.region; if(!l.province&&g.province) l.province=g.province; } });
    A.regionFromCrm=lines.some(l=>l.region); }
  A.has={crm:C.length>0,sales:lines.length>0};
  A.crmMap=Object.assign({},...A.crmSources.map(s=>s.map));
  A.won=C.filter(r=>r.outcome==="Won"); A.warm=C.filter(r=>r.outcome==="Warm"); A.lost=C.filter(r=>r.outcome==="Lost"); A.nostatus=C.filter(r=>!r.outcome);
  A.notWon=C.filter(r=>r.outcome!=="Won");
  A.statusKeys=STATUS_ORDER.filter(s=>C.some(r=>r.status===s)).concat([...new Set(C.map(r=>r.status).filter(s=>s&&!STATUS_ORDER.includes(s)))]);
  A.color=k=>STATUS_COLOR[k]||EXTRA[A.statusKeys.filter(x=>!STATUS_COLOR[x]).indexOf(k)%EXTRA.length];
  A.dates=[...C.map(r=>r.date),...lines.map(r=>r.date)].filter(Boolean).sort((a,b)=>a-b);
  if(A.weekStart) A.dates=A.dates.filter(d=>d>=A.weekStart&&d<new Date(+A.weekStart+7*864e5));

  // ---- Sales orders (lines grouped by order number)
  const om=new Map();
  lines.forEach((l,i)=>{ const key=l.orderNo||l.invoice||`line-${i}`; if(!om.has(key)) om.set(key,{no:l.orderNo||l.invoice||"–",lines:[]}); om.get(key).lines.push(l); });
  A.orders=[...om.values()].map(o=>{ const L=o.lines, f=L[0];
    return {...o,pic:f.pic,ph:f.ph,nk:f.nk,date:f.date,city:f.city,app:f.app,gmv:L.reduce((s,l)=>s+(l.gmv||0),0),qty:L.reduce((s,l)=>s+(l.qty||0),0),
      items:[...new Set(L.map(l=>shortItem(l.item)).filter(Boolean))],cats:[...new Set(L.map(l=>l.category).filter(Boolean))],
      isNew:L.some(l=>/new/i.test(l.custStatus||"")),hasStatus:L.some(l=>l.custStatus),partial:L.some(l=>/partial|unpaid|pending/i.test(l.payStatus||"")),team:f.team}; })
    .sort((a,b)=>b.gmv-a.gmv);
  const O=A.orders; A.gmv=O.reduce((s,o)=>s+o.gmv,0);
  A.customers=new Set(O.map(o=>o.ph||o.nk||o.no)).size;
  A.hasCustStatus=O.some(o=>o.hasStatus); A.newOrders=O.filter(o=>o.isNew); A.partial=O.filter(o=>o.partial);
  A.byItem=sumBy(lines,l=>shortItem(l.item)||null,l=>l.gmv||0);
  // What sold: product family, product category, basket and price consistency
  const grp=(key)=>{ const m=new Map(); for(const l of lines){ const k=key(l); if(!k) continue; if(!m.has(k)) m.set(k,{k,gmv:0,qty:0,orders:new Set(),cust:new Set()});
      const g=m.get(k); g.gmv+=l.gmv||0; g.qty+=l.qty||0; g.orders.add(l.orderNo||l.invoice||l); g.cust.add(l.ph||l.nk); }
    return [...m.values()].map(g=>({...g,orders:g.orders.size,cust:g.cust.size})).sort((a,b)=>b.gmv-a.gmv); };
  A.byFamily=grp(l=>l.family); A.byCat=A.lines.some(l=>l.category)?grp(l=>l.category||"(no category)"):[]; A.byRegion=grp(l=>l.region); A.byProvince=grp(l=>regionOf(l.province));
  A.qtyTotal=lines.reduce((s,l)=>s+(l.qty||0),0);
  A.itemsPerOrder=O.length?O.reduce((s,o)=>s+o.lines.length,0)/O.length:0;
  const pairs=new Map(); for(const o of O){ const f=[...new Set(o.lines.map(l=>l.family).filter(Boolean))].sort(); for(let i=0;i<f.length;i++) for(let j=i+1;j<f.length;j++){ const k=f[i]+" + "+f[j]; pairs.set(k,(pairs.get(k)||0)+1); } }
  A.pairs=[...pairs].sort((a,b)=>b[1]-a[1]);
  A.multiFamily=O.filter(o=>new Set(o.lines.map(l=>l.family)).size>1).length;
  A.priceSpread=[...new Set(lines.map(l=>l.item))].map(it=>{ const u=lines.filter(l=>l.item===it&&l.unit>0).map(l=>l.unit); return u.length>=3?{item:shortItem(it),n:u.length,min:Math.min(...u),max:Math.max(...u)}:null; })
    .filter(Boolean).map(x=>({...x,spread:(x.max-x.min)/x.min})).sort((a,b)=>b.spread-a.spread);
  // How they bought: ordering channel, new vs repeat, sales PIC
  const seg=(f)=>{ const m=new Map(); for(const o of O){ const k=f(o); if(!k) continue; if(!m.has(k)) m.set(k,{k,n:0,gmv:0}); const g=m.get(k); g.n++; g.gmv+=o.gmv; }
    return [...m.values()].map(g=>({...g,aov:g.gmv/g.n})).sort((a,b)=>b.gmv-a.gmv); };
  A.byApp=seg(o=>o.app); A.byCust=A.hasCustStatus?seg(o=>o.isNew?"New customer":"Repeat customer"):[];
  // units are only comparable when one product type dominates the volume
  A.unitsAnchor=A.byFamily[0]&&A.byFamily[0].qty/(A.qtyTotal||1)>=.5;
  // Money and fulfilment at risk
  const outLine=l=>/partial|unpaid|pending/i.test(l.payStatus||"")&&l.revenue!=null?Math.max(0,(l.nett??l.gmv??0)-l.revenue):0;
  A.outstanding=lines.reduce((s,l)=>s+outLine(l),0);
  A.openOrders=O.filter(o=>o.lines.some(l=>/^new$|open|pending|process/i.test(l.soStatus||"")));
  A.discount=lines.reduce((s,l)=>s+(l.discount||0),0); A.shipping=lines.reduce((s,l)=>s+(l.shipping||0),0);
  A.salesDays=sumBy(O,o=>o.date?+o.date:null,o=>o.gmv).sort((a,b)=>a[0]-b[0]);
  A.byPic=sumBy(O,o=>o.pic,o=>o.gmv).map(([p,g])=>({p,g,n:O.filter(o=>o.pic===p).length}));
  A.byCity=sumBy(O,o=>o.city,o=>o.gmv);
  A.top2=O.slice(0,2).reduce((s,o)=>s+o.gmv,0);
  A.team=countBy(lines,l=>l.team)[0]?.[0]||null;
  A.byRole=(()=>{ const m=new Map(); for(const o of O){ const k=o.lines[0].role; if(!k) continue; if(!m.has(k)) m.set(k,{k,n:0,gmv:0}); const g=m.get(k); g.n++; g.gmv+=o.gmv; } return [...m.values()].map(g=>({...g,aov:g.gmv/g.n})).sort((a,b)=>b.gmv-a.gmv); })();
  A.topOrderShare=O.length?O[0].gmv/(A.gmv||1):0;

  // ---- Last week vs the week before
  if(prevLines.length){ const c=weekSummary(lines), p=weekSummary(prevLines);
    const delta=(mc,mp)=>[...new Set([...mc.keys(),...mp.keys()])].map(k=>({k,cur:mc.get(k)||0,prev:mp.get(k)||0})).map(x=>({...x,d:x.cur-x.prev})).filter(x=>x.d).sort((a,b)=>Math.abs(b.d)-Math.abs(a.d));
    const ret=[...c.cust.keys()].filter(k=>p.cust.has(k)), gain=[...c.cust.keys()].filter(k=>!p.cust.has(k)), lost=[...p.cust.keys()].filter(k=>!c.cust.has(k)), sum=(m,ks)=>ks.reduce((s,k)=>s+m.get(k),0);
    A.wow={c,p,dG:c.gmv-p.gmv,pct:p.gmv?(c.gmv-p.gmv)/p.gmv:null,volume:(c.orders-p.orders)*p.aov,value:(c.aov-p.aov)*c.orders,
      family:delta(c.family,p.family),region:delta(c.region,p.region),pic:delta(c.pic,p.pic),app:delta(c.app,p.app),cat:delta(c.cat,p.cat),
      retained:{n:ret.length,cur:sum(c.cust,ret),prev:sum(p.cust,ret),down:ret.filter(k=>c.cust.get(k)<p.cust.get(k)).length,up:ret.filter(k=>c.cust.get(k)>p.cust.get(k)).length},gained:{n:gain.length,gmv:sum(c.cust,gain)},lost:{n:lost.length,gmv:sum(p.cust,lost),top:lost.map(k=>p.cust.get(k)).sort((a,b)=>b-a)[0]||0},
      exTop:{cur:c.gmv-c.top,prev:p.gmv-p.top},start:A.weekStart,prevStart:A.prevStart}; }

  // ---- Month-by-month trend when the sales export covers two or more full months
  if(!opt.trend) A.trend=monthTrend(allLines);

  // ---- Link CRM to sales: phone, then order reference in notes, then first name + same PIC
  const picTok=p=>firstTok(p);
  const near=(a,b,days)=>a&&b&&Math.abs(a-b)<=days*864e5;
  const findOrders=r=>{ let m=r.refs.length?O.filter(o=>r.refs.includes(o.no.toUpperCase())):[]; if(m.length) return [m,"order number"];
    m=r.ph?O.filter(o=>o.ph===r.ph):[]; if(m.length) return [m,"phone"];
    if(r.nk){ m=O.filter(o=>o.nk===r.nk&&picTok(o.pic)===picTok(r.pic)); if(m.length) return [m,"name and PIC"]; }
    // last resort for won deals: same PIC, value within 2% of the CRM potential, ordered within 7 days
    if(r.outcome==="Won"&&r.potential){ m=O.filter(o=>!o.crm&&picTok(o.pic)===picTok(r.pic)&&Math.abs(o.gmv-r.potential)<=r.potential*.02&&(!r.date||near(o.date,r.date,7))); if(m.length===1) return [m,"value and date"]; }
    return [[],null]; };
  for(const r of C){ const [m,how]=A.has.sales?findOrders(r):[[],null]; r.orders=m; r.matchBy=how; m.forEach(o=>{ o.crm=o.crm||[]; o.crm.push(r); }); }
  A.matchCounts=countBy(C.filter(r=>r.matchBy),r=>r.matchBy);
  A.wonFromNotes=A.won.filter(r=>r.statusLogged!==undefined);
  A.wonLinked=A.won.filter(r=>r.orders.length);
  // closings whose order numbers are not in the sales export (not invoiced yet, another team's export, or a typo)
  const onos=new Set(O.map(o=>o.no.toUpperCase()));
  A.missingRefs=A.has.sales?A.won.flatMap(r=>r.refs.filter(x=>!onos.has(x)).map(x=>({ref:x,v:r.refVal[x]||0,pic:r.pic,purpose:r.purpose}))):[];
  A.missingVal=A.missingRefs.reduce((s,x)=>s+x.v,0);
  A.linkedOrders=O.filter(o=>o.crm&&o.crm.some(r=>r.outcome==="Won"));
  A.linkedGmv=A.linkedOrders.reduce((s,o)=>s+o.gmv,0);
  A.noCrm=O.filter(o=>!o.crm);
  A.wonCustomers=new Set(A.won.map(r=>r.ph||r.nk||r.id)).size;

  // ---- Funnel: logged -> reached -> showed interest -> ordered
  // When the export logs call results, a lead counts as reached only with a logged result or a face-to-face visit;
  // a phone or WhatsApp engagement with no result is "not recorded", not reached.
  const unable=r=>/unable|tidak bisa|not reach|no answer/i.test(r.callResp||""), hasResp=C.some(r=>r.callResp);
  const inPerson=r=>/onsite|visit|kunjung|event/i.test(r.channel||"");
  const reached=r=>r.callResp||!hasResp?!unable(r):inPerson(r);
  A.noResult=hasResp?C.filter(r=>!r.callResp&&!inPerson(r)).length:0;
  A.calls=C.filter(r=>r.callResp||/phone/i.test(r.channel||"")); A.callsMissed=A.calls.filter(unable).length;
  A.funnel=[["Engagements logged",C.length],["Reached the lead",C.filter(reached).length],["Showed interest",A.won.length+A.warm.length],["Ordered",A.won.length]];

  // ---- PIC scorecard: CRM activity next to the orders each PIC closed
  // PIC names are written differently across exports ("Simon Sihar Simanjuntak" / "Simon Simanjuntak"): match on first + last name
  const pk=v=>{ const t=(clean(v)||"").toLowerCase().replace(/[^a-z ]/g,"").split(" ").filter(w=>w.length>1); return t.length?t[0]+" "+(t.length>1?t[t.length-1]:""):null; }, pm=new Map();
  const pg=v=>{ const k=pk(v); if(!k) return null; if(!pm.has(k)) pm.set(k,{p:clean(v),eng:0,reached:0,won:0,warm:0,lost:0,orders:0,gmv:0,inCrm:0,ch:[]}); return pm.get(k); };
  for(const r of C){ const g=pg(r.pic); if(!g) continue; g.eng++; if(reached(r)) g.reached++; if(r.outcome==="Won") g.won++; else if(r.outcome==="Warm") g.warm++; else if(r.outcome==="Lost") g.lost++; if(r.channel) g.ch.push(r.channel); }
  for(const o of O){ const g=pg(o.pic); if(!g) continue; g.orders++; g.gmv+=o.gmv; if(o.crm) g.inCrm++; }
  A.picCard=[...pm.values()].map(g=>({...g,topCh:countBy(g.ch,x=>x)[0]?.[0]||null})).sort((a,b)=>b.gmv-a.gmv||b.eng-a.eng);
  A.notLogging=A.has.crm?A.picCard.filter(g=>g.orders&&!g.eng&&!g.inCrm):[];

  // ---- Speed: days from CRM engagement to the order, and how late CRM entries were written
  const dd=(a,b)=>Math.round((a-b)/864e5), med=a=>{ if(!a.length) return null; const s=a.slice().sort((x,y)=>x-y), m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2; };
  const cyc=A.won.filter(r=>r.date&&r.orders.some(o=>o.date)).map(r=>dd(Math.min(...r.orders.filter(o=>o.date).map(o=>+o.date)),r.date));
  A.cycle={n:cyc.length,median:med(cyc),sameDay:cyc.filter(x=>x===0).length,before:cyc.filter(x=>x<0).length,max:cyc.length?Math.max(...cyc):null};
  const lag=C.filter(r=>r.date&&r.modified).map(r=>({d:dd(r.modified,r.date),won:r.outcome==="Won"}));
  A.logLag={n:lag.length,median:med(lag.map(x=>x.d)),late:lag.filter(x=>x.d>=3).length,wonMedian:med(lag.filter(x=>x.won).map(x=>x.d)),restMedian:med(lag.filter(x=>!x.won).map(x=>x.d))};

  // ---- Daily rhythm: CRM engagements, orders and GMV per day
  const dm=new Map(), dg=d=>{ const k=+d; if(!dm.has(k)) dm.set(k,{d,eng:0,won:0,orders:0,gmv:0}); return dm.get(k); };
  C.forEach(r=>{ if(r.date){ const g=dg(r.date); g.eng++; if(r.outcome==="Won") g.won++; } });
  O.forEach(o=>{ if(o.date){ const g=dg(o.date); g.orders++; g.gmv+=o.gmv; } });
  A.daily=[...dm.values()].sort((a,b)=>a.d-b.d);

  // ---- Order quality: size bands, customer concentration, discounts and shipping
  const BANDS=[["Under Rp1M",0,1e6],["Rp1–5M",1e6,5e6],["Rp5–20M",5e6,2e7],["Rp20–50M",2e7,5e7],["Rp50M and up",5e7,Infinity]];
  A.bands=BANDS.map(([k,lo,hi])=>{ const os=O.filter(o=>o.gmv>=lo&&o.gmv<hi); return {k,lo,hi,n:os.length,gmv:os.reduce((s,o)=>s+o.gmv,0)}; }).filter(b=>b.n);
  const cm=new Map(); O.forEach(o=>{ const k=o.ph||o.nk||o.no; if(!cm.has(k)) cm.set(k,{n:0,gmv:0}); const g=cm.get(k); g.n++; g.gmv+=o.gmv; });
  A.custAgg=[...cm.values()].sort((a,b)=>b.gmv-a.gmv);
  A.top3Share=A.custAgg.slice(0,3).reduce((s,c)=>s+c.gmv,0)/(A.gmv||1);
  A.multiOrderCust=A.custAgg.filter(c=>c.n>1).length;
  A.discOrders=O.filter(o=>o.lines.some(l=>l.discount>0)); A.shipOrders=O.filter(o=>o.lines.some(l=>l.shipping>0));

  // ---- What the wins are worth: order value and product mix of CRM wins against the rest
  const aov=os=>os.length?os.reduce((s,o)=>s+o.gmv,0)/os.length:0, wonSet=new Set(A.linkedOrders);
  A.aovWin=aov(A.linkedOrders); A.aovNoCrm=aov(A.noCrm); A.aovAll=aov(O);
  const mixOf=os=>{ const t=os.reduce((s,o)=>s+o.gmv,0)||1, m=new Map(); os.forEach(o=>o.lines.forEach(l=>{ if(l.family) m.set(l.family,(m.get(l.family)||0)+(l.gmv||0)); })); return {t,m}; };
  const mw=mixOf(A.linkedOrders), mr=mixOf(O.filter(o=>!wonSet.has(o)));
  A.mix=A.byFamily.slice(0,5).map(f=>({k:f.k,win:Math.round((mw.m.get(f.k)||0)/mw.t*100),rest:Math.round((mr.m.get(f.k)||0)/mr.t*100)}));
  A.wonNew=A.linkedOrders.filter(o=>o.isNew).length;
  A.bigWin=A.linkedOrders[0]?{o:A.linkedOrders[0],r:A.linkedOrders[0].crm.find(r=>r.outcome==="Won")}:null;
  A.potWins=A.wonLinked.filter(r=>r.potential); A.potSum=A.potWins.reduce((s,r)=>{ const m=r.refs.filter(x=>r.orders.some(o=>o.no.toUpperCase()===x)); return s+(m.length?m.reduce((a,x)=>a+(r.refVal[x]||0),0):r.potential); },0); A.potActual=A.potWins.reduce((s,r)=>s+r.orders.reduce((a,o)=>a+o.gmv,0),0);

  // ---- Where to grow: product by region, what top-product buyers also buy, open orders by age
  const fams=A.byFamily.slice(0,5).map(f=>f.k);
  const geo=A.byRegion.length>=2?{k:"region",vals:A.byRegion.slice(0,4).map(x=>x.k),of:l=>l.region}:A.byApp.length>=2?{k:"channel",vals:A.byApp.map(x=>x.k),of:l=>O.find(o=>o.lines.includes(l))?.app}:null;
  A.heat=geo&&fams.length>=2?{dim:geo.k,rows:fams,cols:geo.vals,v:(f,g)=>lines.filter(l=>l.family===f&&geo.of(l)===g).reduce((s,l)=>s+(l.gmv||0),0)}:null;
  const custFam=new Map(); O.forEach(o=>{ const k=o.ph||o.nk||o.no; if(!custFam.has(k)) custFam.set(k,new Set()); o.lines.forEach(l=>l.family&&custFam.get(k).add(l.family)); });
  const famCust=A.byFamily.slice().sort((a,b)=>b.cust-a.cust)[0];
  if(famCust&&famCust.cust>=3){ const buyers=[...custFam.values()].filter(f=>f.has(famCust.k));
    A.cross={f:famCust.k,n:buyers.length,also:A.byFamily.filter(g=>g.k!==famCust.k).map(g=>({k:g.k,n:buyers.filter(b=>b.has(g.k)).length})).filter(x=>x.n).sort((a,b)=>b.n-a.n).slice(0,5),only:buyers.filter(b=>b.size===1).length}; }
  else A.cross=null;
  const asOf=O.reduce((m,o)=>o.date&&o.date>m?o.date:m,null); A.asOf=asOf;
  const AGE=[["0–1 days",0,1],["2–3 days",2,3],["4–6 days",4,6],["7+ days",7,1e9]];
  A.aging=asOf?AGE.map(([k,lo,hi])=>{ const os=A.openOrders.filter(o=>o.date&&dd(asOf,o.date)>=lo&&dd(asOf,o.date)<=hi); return {k,n:os.length,gmv:os.reduce((s,o)=>s+o.gmv,0),lo}; }):[];
  const newO=O.filter(o=>o.isNew); A.entry=A.hasCustStatus&&newO.length>=2?countBy(newO.flatMap(o=>[...new Set(o.lines.map(l=>l.family).filter(Boolean))]),f=>f)[0]:null;
  A.newOrdersN=newO.length;

  // ---- Reasons and notes for leads that did not order
  A.reasons=countBy(A.notWon,r=>r.reason);
  A.themes=THEMES.map(([t,,c])=>({t,c,n:A.notWon.filter(r=>r.theme===t).length,lost:A.lost.filter(r=>r.theme===t).length,warm:A.warm.filter(r=>r.theme===t).length})).filter(x=>x.n);
  A.signals=SIGNALS.map(([k,label])=>({k,label,lost:A.lost.filter(r=>r.signals.includes(k)).length,warm:A.warm.filter(r=>r.signals.includes(k)).length})).map(x=>({...x,n:x.lost+x.warm})).filter(x=>x.n).sort((a,b)=>b.n-a.n);
  A.unreachable=A.notWon.filter(r=>/unable|tidak bisa|not reach|no answer/i.test(r.callResp||"")).length;
  A.stockRows=A.notWon.filter(r=>r.theme==="Stock & delivery"||r.signals.includes("stock"));
  A.intentWarm=A.warm.filter(r=>r.signals.some(s=>s==="logistics"||s==="price"));

  // ---- Who can be won back: reason theme by whether the conversation happened
  const RECOV=new Set(["Just asking","Stock & delivery","Price","Timing"]);
  A.notWon.forEach(r=>{ r.contact=/unable|tidak bisa|not reach|no answer/i.test(r.callResp||"")?"Call didn't connect":/phone/i.test(r.channel||"")?"Call connected":r.channel||"Not recorded";
    r.recov=RECOV.has(r.theme)||r.outcome==="Warm"; });
  A.recovN=A.notWon.filter(r=>r.recov).length;
  A.contacts=countBy(A.notWon,r=>r.contact).map(([k])=>k);

  // ---- Rejection reasons in detail: which dimension predicts the reason given
  const RR=A.notWon.filter(r=>r.reason); A.reasonRows=RR;
  A.reasonList=countBy(RR,r=>r.reason).map(([k,n])=>({k,n,raw:countBy(RR.filter(r=>r.reason===k),r=>r.reasonRaw)[0]?.[0]||k,
    lost:RR.filter(r=>r.reason===k&&r.outcome==="Lost").length,warm:RR.filter(r=>r.reason===k&&r.outcome==="Warm").length,other:RR.filter(r=>r.reason===k&&!r.outcome).length}));
  const RD=["leadType","channel","source","custType","location","pic"].filter(k=>RR.filter(r=>r[k]).length>=RR.length*.6);
  A.reasonSplit=RD.map(k=>{ const rs=RR.filter(r=>r[k]), groups=countBy(rs,r=>r[k]).filter(([,n])=>n>=3).map(([g,n])=>{
      const sub=rs.filter(r=>r[k]===g), t=countBy(sub,r=>r.theme)[0]; return {g,n,theme:t[0],tn:t[1]}; });
    const cov=groups.reduce((s,x)=>s+x.n,0);
    const purity=cov?groups.reduce((s,x)=>s+x.tn,0)/cov:0, distinct=new Set(groups.map(x=>x.theme)).size;
    return {k,groups,purity:groups.length>=2&&distinct>=2?purity*(cov/RR.length):0}; }).filter(x=>x.purity>0)
    .sort((a,b)=>Math.abs(b.purity-a.purity)>.05?b.purity-a.purity:RD.indexOf(a.k)-RD.indexOf(b.k));
  A.reasonDims=A.reasonSplit.slice(0,2).map(x=>x.k);
  // PICs whose entries are all the same status and reason (likely a form default, not what the lead said)
  A.uniform=countBy(C.filter(r=>r.pic),r=>r.pic).filter(([,n])=>n>=30).map(([p,n])=>{
    const top=countBy(C.filter(r=>r.pic===p),r=>`${r.status||""}|${r.reasonRaw||""}`)[0]; return {p,n,same:top[1],status:top[0].split("|")[0],reason:top[0].split("|")[1]}; })
    .filter(x=>x.same/x.n>=.95);
  A.askUnreach=RR.filter(r=>r.theme==="Just asking"&&/unable|tidak bisa|not reach|no answer/i.test(r.callResp||"")).length;
  A.askTotal=RR.filter(r=>r.theme==="Just asking").length;
  A.locHot=countBy(RR,r=>r.location).filter(([,n])=>n>=4).map(([g,n])=>{const t=countBy(RR.filter(r=>r.location===g),r=>r.theme)[0];return {g,n,theme:t[0],tn:t[1]}}).filter(x=>x.tn/x.n>=.75)[0]||null;

  // ---- Which dimension separates winners (or warm leads) from the rest
  const DIMS=["source","channel","leadType","pic","custType","location"].filter(k=>C.some(r=>r[k]));
  const pos=A.won.length?r=>r.outcome==="Won":r=>r.outcome==="Warm";
  A.posLabel=A.won.length?"ordered":"still in play";
  const scored=C.filter(r=>r.outcome);
  const gini=(w,n)=>{if(!n)return 0;const p=w/n;return 2*p*(1-p)};
  const P=scored.filter(pos).length, base=gini(P,scored.length);
  A.dims=DIMS.map(k=>{ const groups=countBy(scored,r=>r[k]??"(not filled)").map(([g,n])=>{const w=scored.filter(r=>(r[k]??"(not filled)")===g&&pos(r)).length;return {g,n,w,rate:w/n}});
    const gain=base-groups.reduce((s,x)=>s+x.n/scored.length*gini(x.w,x.n),0); return {k,groups,gain}; })
    .sort((a,b)=>b.gain-a.gain);
  // Near-ties (within 10% of the top gain) go to the most actionable lever: how and where leads are sourced, not who called them.
  // A dimension only counts when at least two of its groups have 3+ engagements (no "1 of 1" findings).
  A.dims=A.dims.filter(d=>{ const g=d.groups.filter(x=>x.n>=3&&x.g!=="(not filled)"); return g.length>=2&&Math.max(...g.map(x=>x.rate))-Math.min(...g.map(x=>x.rate))>=.2; });
  const PREF=["source","channel","leadType","custType","location","pic"], top=A.dims[0]?.gain||0;
  A.best=P&&P<scored.length&&top>0?A.dims.filter(d=>d.gain>=top*.9).sort((a,b)=>PREF.indexOf(a.k)-PREF.indexOf(b.k))[0]:null;
  const dom=(rs,k)=>{const c=countBy(rs,r=>r[k]??"(not filled)");return c.length?{v:c[0][0],share:c[0][1]/rs.length}:{v:"–",share:0}};
  A.cohorts=[["Ordered",A.won],["Considering / prospect",A.warm],["Not interested",A.lost]].filter(c=>c[1].length);
  A.profile=DIMS.map(k=>({k,vals:A.cohorts.map(([,rs])=>dom(rs,k))}));
  // dimensions where the winning cohort is concentrated on a value the losers rarely have
  const posRows=scored.filter(pos), negRows=scored.filter(r=>!pos(r));
  A.together=DIMS.filter(k=>{ const p=dom(posRows,k), n=negRows.filter(r=>(r[k]??"(not filled)")===p.v).length/(negRows.length||1); return p.share>=.7&&p.v!=="(not filled)"&&n<=.3; });
  return A;
}

// Totals and breakdowns for one week of sales lines (used for week-on-week comparison).
function weekSummary(L){
  const om=new Map(); L.forEach((l,i)=>{ const k=l.orderNo||l.invoice||`line-${i}`; if(!om.has(k)) om.set(k,{gmv:0,lines:[]}); const o=om.get(k); o.gmv+=l.gmv||0; o.lines.push(l); });
  const O=[...om.values()], gmv=O.reduce((s,o)=>s+o.gmv,0), cust=new Map();
  O.forEach(o=>{ const f=o.lines[0], k=f.ph||f.nk||f.orderNo||f.invoice; cust.set(k,(cust.get(k)||0)+o.gmv); });
  const by=f=>{ const m=new Map(); L.forEach(l=>{ const k=f(l); if(k) m.set(k,(m.get(k)||0)+(l.gmv||0)); }); return m; };
  return {orders:O.length,gmv,aov:O.length?gmv/O.length:0,customers:cust.size,cust,top:Math.max(0,...O.map(o=>o.gmv)),
    newOrders:O.filter(o=>o.lines.some(l=>/new/i.test(l.custStatus||""))).length,
    family:by(l=>l.family),region:by(l=>l.region),pic:by(l=>l.pic),app:by(l=>l.app),cat:by(l=>l.category||(L.some(x=>x.category)?"(no category)":null)),
    days:by(l=>l.date?String((l.date.getDay()+6)%7):null)};
}

// Month-by-month trend over every full month in the sales export: totals, the customer bridge from the first to the
// last month, accounts that stopped ordering, and what changed by PIC, product and order size.
// Kilograms on a sales line, from the pack size in the item name ("Urea 50kg" x 10 = 500 kg)
const kgOf=l=>{ const m=String(l.item||"").match(/(\d+(?:[.,]\d+)?)\s*kg\b/i); return m&&l.qty?parseFloat(m[1].replace(",","."))*l.qty:null; };
const TBANDS=[["Under Rp5M",0,5e6],["Rp5–20M",5e6,20e6],["Rp20–50M",20e6,50e6],["Rp50–100M",50e6,100e6],["Rp100M+",100e6,Infinity]];
function monthTrend(L){
  const dated=L.filter(l=>l.date); if(!dated.length) return null;
  const ts=dated.map(l=>+l.date), lo=Math.min(...ts), hi=Math.max(...ts), mk=d=>d.getFullYear()*12+d.getMonth(), DAY3=3*864e5;
  const months=[]; for(let m=mk(new Date(lo));m<=mk(new Date(hi));m++){ const a=new Date(Math.floor(m/12),m%12,1), b=new Date(Math.floor(m/12),m%12+1,0); if(lo<=+a+DAY3&&hi>=+b-DAY3) months.push(m); }
  if(months.length<2) return null;
  // a long export (e.g. Jan–Sep) is reviewed on its last 3 full months; the forecast slides show the whole history
  if(months.length>3) months.splice(0,months.length-3);
  const M=months.map(m=>{ const ls=dated.filter(l=>mk(l.date)===m), om=new Map();
    ls.forEach((l,i)=>{ const k=l.orderNo||l.invoice||`line-${m}-${i}`; if(!om.has(k)) om.set(k,{gmv:0,lines:[]}); const o=om.get(k); o.gmv+=l.gmv||0; o.lines.push(l); });
    const O=[...om.values()], open=O.filter(o=>o.lines.some(l=>l.soStatus&&!/complete|done|selesai/i.test(l.soStatus))), part=O.filter(o=>o.lines.some(l=>/partial/i.test(l.payStatus||"")));
    const kl=ls.map(l=>({l,kg:kgOf(l)})).filter(x=>x.kg), kg=kl.reduce((s,x)=>s+x.kg,0), kgGmv=kl.reduce((s,x)=>s+(x.l.gmv||0),0), ws=weekSummary(ls);
    const cv=[...ws.cust.values()].sort((a,b)=>b-a), third=d=>d.getDate()<=10?0:d.getDate()<=20?1:2;
    const famKg=new Map(), famKgG=new Map(); kl.forEach(x=>{ const f=x.l.family||"Other"; famKg.set(f,(famKg.get(f)||0)+x.kg); famKgG.set(f,(famKgG.get(f)||0)+(x.l.gmv||0)); });
    return {m,label:MON[m%12],...ws,O,kg,kgGmv,famKg,famKgG,rpkg:kg?kgGmv/kg:null,top5:ws.gmv?cv.slice(0,5).reduce((s,v)=>s+v,0)/ws.gmv:0,top1:ws.gmv?(cv[0]||0)/ws.gmv:0,
      thirds:[0,1,2].map(i=>ls.filter(l=>third(l.date)===i).reduce((s,l)=>s+(l.gmv||0),0)),newGmv:ls.filter(l=>/new/i.test(l.custStatus||"")).reduce((s,l)=>s+(l.gmv||0),0),hasCust:ls.some(l=>l.custStatus),disc:ls.reduce((s,l)=>s+(l.discount||0),0),
      openGmv:open.reduce((s,o)=>s+o.gmv,0),openN:open.length,partGmv:part.reduce((s,o)=>s+o.gmv,0),partN:part.length,
      bands:TBANDS.map(([k,a,b])=>{ const os=O.filter(o=>o.gmv>=a&&o.gmv<b); return {k,n:os.length,gmv:os.reduce((s,o)=>s+o.gmv,0)}; })}; });
  const F=M[0], Z=M[M.length-1], ckey=l=>l.ph||l.nk||l.orderNo||l.invoice;
  // customers across the months
  const C=new Map(); dated.filter(l=>months.includes(mk(l.date))).forEach(l=>{ const k=ckey(l); if(!k) return; if(!C.has(k)) C.set(k,{k,by:months.map(()=>0),lines:[]}); const c=C.get(k); c.by[months.indexOf(mk(l.date))]+=l.gmv||0; c.lines.push(l); });
  const cs=[...C.values()].map(c=>({...c,tot:c.by.reduce((s,v)=>s+v,0),last:new Date(Math.max(...c.lines.map(l=>+l.date)))}));
  const total=M.reduce((s,x)=>s+x.gmv,0);
  // accounts that stopped: bought before the last month, nothing in it, and big enough to move the total
  const stopped=cs.filter(c=>!c.by[c.by.length-1]&&c.tot>=Math.max(total*.04,F.gmv*.08)).sort((a,b)=>b.tot-a.tot).slice(0,5).map((c,i)=>{ const top=(f)=>countBy(c.lines,f)[0]?.[0]||null;
    return {...c,label:`Account ${String.fromCharCode(65+i)}`,pic:top(l=>l.pic),region:top(l=>l.region),cat:sumBy(c.lines,l=>l.category||l.family,l=>l.gmv||0)[0]?.[0]||null}; });
  const stopBy=months.map((_,i)=>stopped.reduce((s,c)=>s+c.by[i],0)), rest=M.map((x,i)=>x.gmv-stopBy[i]);
  const inF=cs.filter(c=>c.by[0]), inZ=cs.filter(c=>c.by[c.by.length-1]), both=inF.filter(c=>c.by[c.by.length-1]);
  const lost=inF.filter(c=>!c.by[c.by.length-1]), gained=inZ.filter(c=>!c.by[0]), fresh=inZ.filter(c=>c.by.slice(0,-1).every(v=>!v));
  const sum=(a,i)=>a.reduce((s,c)=>s+c.by[i],0), L1=months.length-1;
  const delta=(mc,mp)=>[...new Set([...mc.keys(),...mp.keys()])].map(k=>({k,cur:mc.get(k)||0,prev:mp.get(k)||0})).map(x=>({...x,d:x.cur-x.prev})).filter(x=>x.d).sort((a,b)=>Math.abs(b.d)-Math.abs(a.d));
  // weekly GMV inside the months
  const wkOf=d=>{ const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); x.setDate(x.getDate()-(x.getDay()+6)%7); return +x; };
  const W=new Map(); dated.filter(l=>months.includes(mk(l.date))).forEach(l=>{ const k=wkOf(l.date); W.set(k,(W.get(k)||0)+(l.gmv||0)); });
  const weeks=[...W].sort((a,b)=>a[0]-b[0]).map(([k,g])=>({d:new Date(k),gmv:g}));
  const low=M.slice().sort((a,b)=>a.gmv-b.gmv)[0];
  // volume vs price: GMV = kg sold x Rp per kg; price effect per product from its average unit price in both months
  const vol=F.rpkg&&Z.rpkg?{volume:(Z.kg-F.kg)*F.rpkg,rate:(Z.rpkg-F.rpkg)*Z.kg,cover:Z.kgGmv/(Z.gmv||1)}:null;
  const ip=i=>{ const m=new Map(); dated.filter(l=>mk(l.date)===months[i]&&l.item&&l.qty&&l.unit).forEach(l=>{ const k=shortItem(l.item); if(!m.has(k)) m.set(k,{q:0,v:0}); const x=m.get(k); x.q+=l.qty; x.v+=l.unit*l.qty; }); return m; };
  const pF=ip(0), pZ=ip(L1), prices=[...pZ].filter(([k])=>pF.has(k)).map(([k,z])=>{ const f=pF.get(k), a=f.v/f.q, b=z.v/z.q; return {k,from:a,to:b,chg:(b-a)/a,qty:z.q,eff:(b-a)*z.q}; }).filter(x=>Math.abs(x.chg)>=.01).sort((a,b)=>a.eff-b.eff);
  if(vol){ vol.price=prices.reduce((s,x)=>s+x.eff,0); vol.mix=vol.rate-vol.price; }
  // how often customers reorder, and who lapsed (bought before the last month, not in it), per PIC
  const gaps=[]; cs.forEach(c=>{ const ds=[...new Set(c.lines.map(l=>+new Date(l.date.getFullYear(),l.date.getMonth(),l.date.getDate())))].sort((a,b)=>a-b); for(let i=1;i<ds.length;i++) gaps.push((ds[i]-ds[i-1])/864e5); });
  gaps.sort((a,b)=>a-b); const lapsed=cs.filter(c=>!c.by[L1]).map(c=>({...c,orders:new Set(c.lines.map(l=>l.orderNo||l.invoice)).size,pic:countBy(c.lines,l=>l.pic)[0]?.[0]||"–",lastM:mk(c.last)}));
  const lapsedPic=[...new Set(lapsed.map(c=>c.pic))].map(p=>{ const L=lapsed.filter(c=>c.pic===p); return {p,n:L.length,gmv:L.reduce((s,c)=>s+c.tot,0),rep:L.filter(c=>c.orders>=2).length,repGmv:L.filter(c=>c.orders>=2).reduce((s,c)=>s+c.tot,0),
    byMonth:months.slice(0,-1).map(m=>L.filter(c=>c.lastM===m).length)}; }).sort((a,b)=>b.gmv-a.gmv);
  const app=delta(Z.app,F.app), newReg=[...Z.region.keys()].filter(k=>!M.slice(0,-1).some(x=>x.region.has(k))).map(k=>({k,gmv:Z.region.get(k)})).sort((a,b)=>b.gmv-a.gmv);
  const bothC=cs.filter(c=>c.by[0]&&c.by[L1]);
  return {M,F,Z,months,vol,prices,gapMed:gaps.length?gaps[Math.floor(gaps.length/2)]:null,lapsedAll:lapsed,lapsedPic,app,newReg,
    bothUp:bothC.filter(c=>c.by[L1]>c.by[0]).length,bothDown:bothC.filter(c=>c.by[L1]<c.by[0]).length,label:`${F.label}–${Z.label}`,laterLabel:M.length<=3?M.slice(1).map(x=>x.label).join(" or "):`${M[1].label}–${Z.label}`,preLabel:M.length>2?`${F.label}–${M[M.length-2].label}`:F.label,dG:Z.gmv-F.gmv,pct:F.gmv?(Z.gmv-F.gmv)/F.gmv:null,total,low,weeks,peakWeek:weeks.slice().sort((a,b)=>b.gmv-a.gmv)[0],
    stopped,stopBy,rest,cust:cs,restPct:rest[0]?(rest[L1]-rest[0])/rest[0]:null,
    bridge:{lost:{n:lost.length,gmv:sum(lost,0)},both:{n:both.length,prev:sum(both,0),cur:sum(both,L1)},gained:{n:gained.length,gmv:sum(gained,L1)}},
    retained:{n:inF.filter(c=>c.by.slice(1).some(v=>v)).length,of:inF.length},fresh:{n:fresh.length,gmv:sum(fresh,L1)},
    pic:delta(Z.pic,F.pic),cat:delta(Z.cat,F.cat),family:delta(Z.family,F.family),region:delta(Z.region,F.region)};
}

/* ================= Teams ================= */
// Each source belongs to a team: an explicit choice, else a team column (sales), else its headers, else its file name.
const TEAMS=[["Smallholder",/smallholder/i],["Plantation",/plantation|perkebunan/i]];
const teamOf=v=>{ const t=TEAMS.find(([,re])=>re.test(String(v||""))); return t?t[0]:null; };
function detectTeam(d){
  if(d.team&&d.team!=="auto") return d.team;
  const role=d.role&&d.role!=="auto"?d.role:detectRole(d.headers);
  if(role==="sales"){ const col=detectSales(d.headers).team; if(col){ const c=countBy(d.rows,r=>teamOf(r[col])); if(c.length) return c[0][0]; } }
  return teamOf(d.headers.join(" "))||teamOf(d.name)||null;
}
// Split the selected sources into one analysis per team. Sales files with a team column are split row by row.
function analyseTeams(sources){
  const TR=trendMode(sources), parts=new Map(), add=(t,d)=>{ if(!parts.has(t)) parts.set(t,[]); parts.get(t).push(d); };
  const prices=[];
  for(const d of sources){
    const role=d.role&&d.role!=="auto"?d.role:detectRole(d.headers), col=role==="sales"&&(!d.team||d.team==="auto")?detectSales(d.headers).team:null;
    if(role==="price"){ prices.push(d); continue; }
    const split=col?countBy(d.rows,r=>teamOf(r[col])):[];
    if(split.length>1){ for(const [t] of split) add(t,{...d,role,rows:d.rows.filter(r=>teamOf(r[col])===t)}); }
    else add(detectTeam(d)||"_",{...d,role});
  }
  // Sources with no recognisable team join the only named team, or form their own group.
  const named=[...parts.keys()].filter(k=>k!=="_");
  if(parts.has("_")&&named.length===1){ parts.get(named[0]).push(...parts.get("_")); parts.delete("_"); }
  const order=["Smallholder","Plantation"];
  return [...parts].sort((a,b)=>(order.indexOf(a[0])+1||9)-(order.indexOf(b[0])+1||9))
    .map(([name,srcs])=>{ const sales=srcs.filter(d=>d.role==="sales"), crm=srcs.filter(d=>d.role!=="sales");
      // trend review: sales over the months, CRM analysed on its own (its dates rarely match the sales months)
      let A=TR&&sales.length?analyse(sales,{trend:true}):null, C=null;
      if(A&&A.trend){ if(crm.length){ const ds=A.dates.filter(Boolean), lo=ds.reduce((m,d)=>d<m?d:m,ds[0]), hi=ds.reduce((m,d)=>d>m?d:m,ds[0]);
          C=analyse(crm,{window:[new Date(lo.getFullYear(),lo.getMonth(),1),new Date(hi.getFullYear(),hi.getMonth()+1,0,23,59,59)]});
          if(!C.crm.length) C=analyse(crm); C.mode="crm"; linkTrendCrm(A,C); } } else A=analyse(srcs);
      // stock forecast: the team's whole sales history (partial months included) against the uploaded price list
      if(prices.length&&sales.length) A.forecast=forecastStock(salesLines(sales),priceList(prices),FC_TARGET);
      return {name:name==="_"?(A.team?A.team.replace(/s$/,""):"Team"):name,A,C,sources:srcs}; });
}
// A trend review is for exports that cover at least two full months and end on a full month (e.g. Jul–Sep),
// or cover three or more full months and stop part-way through the last one (e.g. Jan – 13 Oct; the partial month is left out).
function trendMode(sources){
  const ds=[]; for(const d of sources){ const role=d.role&&d.role!=="auto"?d.role:detectRole(d.headers); if(role!=="sales") continue;
    const c=detectSales(d.headers).date; if(c) for(const r of d.rows){ const x=toDate(r[c]); if(x) ds.push(+x); } }
  if(!ds.length) return false; const hi=new Date(Math.max(...ds)), lo=Math.min(...ds), D3=3*864e5;
  if(+hi<+new Date(hi.getFullYear(),hi.getMonth()+1,0)-D3) return lo<=+new Date(hi.getFullYear(),hi.getMonth()-3,1)+D3;
  return lo<=+new Date(hi.getFullYear(),hi.getMonth()-1,1)+D3;
}
// Who the CRM engagements reached, against the customers the trend lost: past buyers, lapsed customers, stopped accounts, per PIC.
function linkTrendCrm(A,C){
  const T=A.trend, last=T.months.length-1, ph=new Map(), pk=v=>{ const t=(clean(v)||"").toLowerCase().replace(/[^a-z ]/g,"").split(" ").filter(w=>w.length>1); return t.length?t[0]+" "+(t[t.length-1]||""):null; };
  T.cust.forEach(c=>c.lines.forEach(l=>{ if(l.ph) ph.set(l.ph,c); }));
  const hit=new Map(); C.crm.forEach(r=>{ const c=r.ph&&ph.get(r.ph); if(c) hit.set(c.k,c); });
  C.trendSales=true; C.wonInSales=(C.won||[]).filter(r=>r.ph&&ph.has(r.ph)).length;
  const lapsed=T.cust.filter(c=>!c.by[last]), H=[...hit.values()], eng=countBy(C.crm,r=>pk(r.pic)), mainPic=c=>countBy(c.lines,l=>l.pic)[0]?.[0];
  const pics=T.pic.map(x=>{ const e=eng.find(([k])=>k===pk(x.k)); const lp=lapsed.filter(c=>mainPic(c)===x.k); return {p:x.k,d:x.d,prev:x.prev,cur:x.cur,eng:e?e[1]:0,lapsed:lp.length,lapsedHit:lp.filter(c=>hit.has(c.k)).length}; });
  const others=eng.filter(([k])=>!T.pic.some(x=>pk(x.k)===k)).map(([k,n])=>({p:C.crm.find(r=>pk(r.pic)===k).pic,d:0,prev:0,cur:0,eng:n,lapsed:0,lapsedHit:0}));
  T.crm={n:C.crm.length,span:span(C.crm.map(r=>r.date)),past:H.length,pastGmv:H.reduce((s,c)=>s+c.tot,0),lapsed:lapsed.length,lapsedGmv:lapsed.reduce((s,c)=>s+c.tot,0),
    lapsedHit:H.filter(c=>!c.by[last]).length,stoppedHit:T.stopped.filter(s=>hit.has(s.k)).length,pics:[...pics,...others]};
}

/* ================= Price list & stock forecast ================= */
// Monthly sales target the stock plan is sized for (IDR, GMV). Set from the page; Rp4B by default.
let FC_TARGET=4e9;
// Focus areas: province names as the sales export writes them.
const FC_AREAS=[["Riau",/^riau$/],["Sumatera Utara",/^sumatera utara$|^sumut$/],["Sumatera Selatan",/^sumatera selatan$|^sumsel$|^lampung$|^jambi$|^bengkulu$/]];
const FC_AREA_NOTE={"Sumatera Selatan":"incl. Lampung, Jambi, Bengkulu"};
const areaOf=p=>{ const s=norm(p); const a=FC_AREAS.find(([,re])=>re.test(s)); return a?a[0]:null; };
// Price tier from the sales product category: Pupuk = reguler, Grosir = grosir, Toling = toko keliling, Khusus Petani.
const tierOf=c=>{ const s=norm(c); return /grosir/.test(s)?"Grosir":/toling|toko keliling/.test(s)?"Toko Keliling":/khusus petani/.test(s)?"Khusus Petani":"Reguler"; };
const skuKey=n=>norm(String(n||"").replace(/\((grosir|khusus petani|toko keliling)\)/ig,"")).replace(/\s*kg\b/g,"kg");
const skuName=n=>clean(String(n||"").replace(/\s*\((grosir|khusus petani|toko keliling)\)/ig,""));
// Weight of one pack from the item name; bundles add up ("Pupuk SawitPRO 20kg + Abu Janjang 40kg" = 60 kg).
const packKg=n=>{ const m=[...String(n||"").matchAll(/(\d+(?:[.,]\d+)?)\s*kg\b/gi)]; return m.length?m.reduce((s,x)=>s+parseFloat(x[1].replace(",",".")),0):null; };
// Fertilizer = sold by the kg; liquids, seeds and pesticides are left out.
const isFert=l=>packKg(l.item)>0&&!/liter|\bltr\b|\bml\b/i.test(l.item)&&!/racun|pestisida|herbisida/i.test(l.category||"")&&l.family!=="Herbicide & pesticide";
function salesLines(sources){
  const lines=[], seen=new Map();
  for(const d of sources){ const m=detectSales(d.headers), label=srcLabel(d);
    for(const r of d.rows){ if(!Object.values(r).some(v=>!blank(v))) continue; const l=canonSale(r,m,label), k=[l.orderNo||l.invoice,l.item,l.qty,l.gmv].join("|");
      if(l.orderNo||l.invoice){ if(seen.has(k)&&seen.get(k)!==label) continue; seen.set(k,label); } lines.push(l); } }
  return lines;
}
function priceList(sources){
  const P={map:new Map(),any:new Map(),names:new Map(),label:sources.map(srcLabel).join(", ")};
  for(const d of sources){ const H=d.headers, find=re=>H.find(h=>re.test(norm(h)));
    const nc=find(/nama barang|item|product|produk/), pc=find(/harga|price/), cc=find(/^category$|kategori|^tier$/);
    if(!nc||!pc) continue;
    for(const r of d.rows){ const name=clean(r[nc]), price=toNum(r[pc]); if(!name||!price) continue;
      const k=skuKey(name), t=cc?tierOf(r[cc]):tierOf(name);
      P.map.set(t+"|"+k,price); if(!P.any.has(k)) P.any.set(k,[]); P.any.get(k).push(price); if(!P.names.has(k)) P.names.set(k,skuName(name)); } }
  return P;
}
const median=a=>{ const s=a.slice().sort((x,y)=>x-y); return s.length?(s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2):null; };
function priceOf(P,l){ const k=skuKey(l.item), t=tierOf(l.category);
  if(P.map.has(t+"|"+k)) return {p:P.map.get(t+"|"+k),src:"list"};
  if(P.map.has("Reguler|"+k)) return {p:P.map.get("Reguler|"+k),src:"reguler"};
  if(P.any.has(k)) return {p:median(P.any.get(k)),src:"other tier"};
  return {p:l.qty?(l.salesAmount??l.gmv??0)/l.qty:null,src:"history"}; }

function forecastStock(lines,P,target){
  const L=lines.filter(l=>l.date&&l.item&&l.qty); if(!L.length||!P.map.size) return null;
  const known=p=>!!p&&!/^(no province|indonesia|-)$/i.test(p);
  // a line with no province takes the customer's province from their other orders, else the PIC's main province
  const vote=key=>{ const m=new Map(); L.forEach(l=>{ const k=key(l); if(!k||!known(l.province)) return; const c=m.get(k)||new Map(); c.set(l.province,(c.get(l.province)||0)+1); m.set(k,c); });
    return k=>{ const c=k&&m.get(k); return c?[...c].sort((a,b)=>b[1]-a[1])[0][0]:null; }; };
  const byPh=vote(l=>l.ph), byId=vote(l=>l.custId), byPic=vote(l=>l.pic), inf={n:0,gmv:0,byPic:0};
  L.forEach(l=>{ let p=l.province; if(!known(p)){ p=byPh(l.ph)||byId(l.custId); if(!p){ p=byPic(l.pic); if(p) inf.byPic++; } if(p){ inf.n++; inf.gmv+=l.gmv||0; } } l.fcProv=p; l.fcArea=areaOf(p); });
  const mk=d=>d.getFullYear()*12+d.getMonth(), mlab=m=>`${MON[m%12]} ${Math.floor(m/12)}`, sum=(a,f)=>a.reduce((s,x)=>s+(f(x)||0),0);
  const F=L.filter(isFert); F.forEach(l=>{ l.fcKg=packKg(l.item)*l.qty; l.fcSku=skuKey(l.item); l.fcM=mk(l.date); const pr=priceOf(P,l); l.fcPrice=pr.p; l.fcPsrc=pr.src; });
  const gmvAll=sum(L,l=>l.gmv), fertGmv=sum(F,l=>l.gmv), fertShare=gmvAll?fertGmv/gmvAll:0, shipShare=fertGmv?sum(F,l=>l.shipping)/fertGmv:0;
  const FF=F.filter(l=>l.fcArea), focusGmv=sum(FF,l=>l.gmv);
  const areas=FC_AREAS.map(([a])=>a).filter(a=>FF.some(l=>l.fcArea===a));
  const share=Object.fromEntries(areas.map(a=>[a,sum(FF.filter(l=>l.fcArea===a),l=>l.gmv)/focusGmv]));
  const last=Math.max(...L.map(l=>mk(l.date))), first=Math.min(...L.map(l=>mk(l.date))), lastDate=new Date(Math.max(...L.map(l=>+l.date)));
  const monthsWithData=new Set(F.map(l=>l.fcM)), recent=[last-3,last-2,last-1,last];
  const orders=a=>new Set(a.map(l=>l.orderNo||l.invoice)).size;
  // history per month (all areas): GMV, fertilizer tonnes, orders
  const hist=[]; for(let m=first;m<=last;m++){ const ls=L.filter(l=>mk(l.date)===m), fs=F.filter(l=>l.fcM===m);
    hist.push({m,label:MON[m%12],gmv:sum(ls,l=>l.gmv),fertGmv:sum(fs,l=>l.gmv),kg:sum(fs,l=>l.fcKg),orders:orders(fs),partial:m===last&&lastDate.getDate()<new Date(lastDate.getFullYear(),lastDate.getMonth()+1,0).getDate()-3}); }
  const full=hist.filter(h=>!h.partial), best=full.slice().sort((a,b)=>b.gmv-a.gmv)[0], bestKg=full.slice().sort((a,b)=>b.kg-a.kg)[0];
  const areaBest=a=>{ let b=null; for(let m=first;m<=last;m++){ const kg=sum(FF.filter(l=>l.fcArea===a&&l.fcM===m),l=>l.fcKg); if(!b||kg>b.kg) b={m,kg}; } return b; };
  const months=[1,2,3].map(i=>last+i).map(m=>{
    // same calendar month in the history (with the month after it) = seasonal mix; otherwise the last 4 months
    const same=[...monthsWithData].filter(x=>x%12===m%12), win=same.length?same.flatMap(x=>[x,x+1]):recent;
    const winLabel=same.length?`${MON[win[0]%12]}–${MON[win[win.length-1]%12]} ${Math.floor(win[win.length-1]/12)}`:`${MON[recent[0]%12]}–${MON[last%12]} ${Math.floor(last/12)}`;
    const rows=areas.map(a=>{
      let w=FF.filter(l=>l.fcArea===a&&win.includes(l.fcM)), thin=false;
      if(orders(w)<8){ w=FF.filter(l=>l.fcArea===a); thin=true; }
      const kgW=sum(w,l=>l.fcKg), vpk=sum(w,l=>l.qty*l.fcPrice)/kgW;
      const tgt=target*share[a], fg=tgt*fertShare, prod=fg*(1-shipShare), kg=prod/vpk;
      const sk=new Map(); w.forEach(l=>{ const x=sk.get(l.fcSku)||{k:l.fcSku,name:P.names.get(l.fcSku)||skuName(l.item),pack:packKg(l.item),kg:0,val:0}; x.kg+=l.fcKg; x.val+=l.qty*l.fcPrice; sk.set(l.fcSku,x); });
      const skus=[...sk.values()].map(x=>{ const bags=Math.round(x.kg/kgW*kg/x.pack); return {...x,bags,mt:bags*x.pack/1000,ppk:x.val/x.kg}; }).filter(x=>x.bags>0).sort((a,b)=>b.mt-a.mt);
      const mt=skus.reduce((s,x)=>s+x.mt,0), ab=areaBest(a);
      return {area:a,note:FC_AREA_NOTE[a]||"",target:tgt,fertGmv:fg,productValue:prod,vpk,mt,skus,orders:orders(w),thin,best:ab?{label:mlab(ab.m),mt:ab.kg/1000}:null}; });
    return {m,label:mlab(m),win,winLabel,seasonal:!!same.length,rows,mt:rows.reduce((s,r)=>s+r.mt,0)}; });
  // what the target asks for, at the recent run-rate
  const R=F.filter(l=>recent.includes(l.fcM)), rOrders=orders(R), aov=rOrders?sum(R,l=>l.gmv)/rOrders:0;
  const fullRecent=full.filter(h=>h.m>=last-6), avg=fullRecent.length?sum(fullRecent,h=>h.gmv)/fullRecent.length:0;
  const recentFull=full.filter(h=>h.m>=last-3), ordersPerMonth=recentFull.length?sum(recentFull,h=>h.orders)/recentFull.length:0;
  const bestRecent=fullRecent.slice().sort((a,b)=>b.gmv-a.gmv)[0];
  // today's price vs what the top SKUs sold for in the last 4 months (same tier)
  const priceMoves=[...new Set(R.map(l=>l.fcSku))].map(k=>{ const ls=R.filter(l=>l.fcSku===k&&l.fcPsrc==="list"&&l.salesAmount), q=sum(ls,l=>l.qty);
    return q?{k,name:P.names.get(k)||k,kg:sum(R.filter(l=>l.fcSku===k),l=>l.fcKg),was:sum(ls,l=>l.salesAmount)/q,now:sum(ls,l=>l.fcPrice*l.qty)/q}:null; }).filter(Boolean).sort((a,b)=>b.kg-a.kg).slice(0,5);
  const unpriced=[...new Set(F.filter(l=>l.fcPsrc==="history").map(l=>skuName(l.item)))];
  const otherGmv=sum(F.filter(l=>!l.fcArea),l=>l.gmv);
  return {target,months,areas,share,fertShare,shipShare,hist,best,bestKg,bestRecent,avg,avgN:fullRecent.length,ordersPerMonth,recentFullLabel:recentFull.length?`${recentFull[0].label}–${recentFull[recentFull.length-1].label}`:"",aov,ordersNeeded:aov?target*fertShare/aov:null,rOrders,
    recentLabel:`${MON[recent[0]%12]}–${MON[last%12]}`,lastDate,inf,priceMoves,unpriced,otherShare:fertGmv?otherGmv/fertGmv:0,priceLabel:P.label};
}
