/* ================= Field detection ================= */
// Each key lists regexes in priority order; the first header matching the earliest regex wins.
// One header is claimed by one key only. Two schemas: CRM engagements and sales order lines.
const CRM_FIELDS=[
  ["reasonOther",[/alasan\s*lain|other\s*reason/]],
  ["fieldPic",[/assign\s*field|pic.*lapang|field\s*(team|pic|officer)|tim\s*lapang/]],
  ["closing",[/closing/]],
  ["fertDate",[/tanggal\s*pemupukan/]],
  ["followDate",[/tanggal\s*follow/]],
  ["followPlan",[/rencana\s*follow|recana\s*follow/]],
  ["ffb",[/ffb|\(mt\)/]],
  ["needKg",[/fertilizer\s*needs\s*\(kg\)|kebutuhan\s*pupuk/]],
  ["potential",[/potential\s*gmv|potential\s*sales|potensi/]],
  ["reason",[/alasan|reason/]],
  ["status",[/respon\s*pengguna|status\s*leads|lead\s*status|^status$/]],
  ["callResp",[/call\s*response/]],
  ["phone",[/phone\s*no|^phone$|nomor\s*tel|no\.?\s*hp|telp|telf|cleaned\s*phone/]],
  ["name",[/nama\s*customer|nama\s*leads|customer\s*name|^nama$/]],
  ["pic",[/smallholders\s*team|pic\s*\(|^pic$|pic\s*name|sales\s*(rep|person)|petugas/]],
  ["channel",[/engagement\s*type|tipe\s*engag|jenis\s*engag|channel|metode/]],
  ["date",[/^tanggal$|tanggal\s*engag|engagement\s*date|^date$|^tgl$/]],
  ["leadType",[/^leads?$|lead\s*type|jenis\s*lead/]],
  ["location",[/kecamatan|lokasi|kabupat|location|wilayah/]],
  ["source",[/sumber\s*lead|lead\s*source|^source$/]],
  ["purpose",[/objective|tujuan/]],
  ["product",[/product\s*yang\s*diminta|produk\s*yang\s*ditawarkan|pupuk\s*ditawarkan|^product$|^produk$/]],
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
  ["phone",[/customer_?phone|phone|no\.?\s*hp/]],
  ["name",[/customer_?name|nama\s*customer/]],
  ["qty",[/^qty$|quantity|jumlah/]],
  ["gmv",[/^gmv$/,/sales_?amount/,/nett_?sales/,/revenue/,/total/]],
  ["salesAmount",[/sales_?amount/]],
  ["nett",[/nett_?sales|net\s*sales/]],
  ["revenue",[/^revenue$|paid\s*amount|amount\s*paid/]],
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
function detectRole(headers){
  const s=detectSales(headers), c=detectCrm(headers);
  const salesScore=["orderNo","invoice","qty","gmv","item"].filter(k=>s[k]).length;
  const crmScore=["status","reason","channel","detail","id"].filter(k=>c[k]).length;
  return salesScore>=3&&salesScore>=crmScore?"sales":"crm";
}
const ROLE_LABEL={crm:"CRM engagements",sales:"Sales orders"};

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
  const t=s.toLowerCase().replace(/[^a-z ]/g,"").split(" ").filter(Boolean)[0]; return t&&t.length>=3?t:null; };
const firstTok=v=>(clean(v)||"").toLowerCase().split(" ")[0]||null;
const PERSON_RE=/^(phone|name)$/;

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
const LABEL={channel:"Engagement channel",source:"Lead source",leadType:"Lead type",pic:"PIC",custType:"Customer type",location:"Location",purpose:"Objective",_src:"Data source"};
function countBy(rows,f){const m=new Map();for(const r of rows){const k=f(r);if(k===null||k===undefined)continue;m.set(k,(m.get(k)||0)+1)}return [...m].sort((a,b)=>b[1]-a[1])}
function sumBy(rows,f,v){const m=new Map();for(const r of rows){const k=f(r);if(k===null||k===undefined)continue;m.set(k,(m.get(k)||0)+v(r))}return [...m].sort((a,b)=>b[1]-a[1])}
const srcLabel=d=>d.sheet&&!/^sheet\s*1$/i.test(d.sheet)?`${d.name} · ${d.sheet}`:d.name;
const shortItem=s=>String(s||"").replace(/\s*\(\d+\s*butir\)/i,"").replace(/\s+-\s+Topaz.*$/i,"").trim();

/* ================= Analysis ================= */
function canonCrm(r,map,src){ const o={_raw:r,_src:src};
  for(const k in map){ const v=r[map[k]];
    o[k]=k==="potential"||k==="ffb"||k==="needKg"?toNum(v):k==="date"||k==="closing"||k==="fertDate"||k==="followDate"?toDate(v):k==="status"?canonStatus(v)
      :k==="channel"?trChannel(v):k==="reason"?trReason(v):k==="custType"?(clean(v)||"").replace(/[^\p{L}\p{N} \/-]/gu,"").trim()||null:clean(v); }
  if(o.reason==="Other"&&o.reasonOther) o.reason=trReason(o.reasonOther);
  o.reasonRaw=map.reason?clean(r[map.reason]):null;
  o.ph=phoneKey(o.phone); o.nk=nameKey(o.name);
  o.ref=(String(o.detail||"").match(/#?B2C\d{4,}/i)||[])[0]?.replace(/^#?/,"#").toUpperCase()||null;
  const txt=norm(o.detail); o.signals=SIGNALS.filter(([,,re])=>re.test(txt)).map(s=>s[0]);
  o.outcome=o.status===WON?"Won":WARM.has(o.status)?"Warm":o.status==="Not interested"?"Lost":null;
  o.theme=themeOf(o.reason);
  return o; }
function canonSale(r,map,src){ const o={_raw:r,_src:src};
  for(const k in map){ const v=r[map[k]]; o[k]=["qty","gmv","salesAmount","nett","revenue","discount","shipping"].includes(k)?toNum(v):k==="date"?toDate(v):clean(v); }
  o.ph=phoneKey(o.phone); o.nk=nameKey(o.name);
  o.family=familyOf(o.item); o.region=regionOf(o.city)||regionOf(o.province);
  o.unit=o.qty?(o.salesAmount??o.gmv??0)/o.qty:null;
  return o; }
// Product family from the item name (fertilizer type), so "RP Mahkota" and "RP Sasco" count together.
const FAMILIES=[["Seeds",/benih|seed|topaz|bibit/],["Rock phosphate (RP)",/\brp\b|rock\s*phos|fosfat/],["NPK",/\bnpk\b/],["KCL / MOP",/kcl|\bmop\b/],["Urea",/urea/],
  ["ZA",/\bza\b/],["Borate",/borat|boron/],["Dolomite",/dolomit/],["TSP / SP-36",/\btsp\b|sp-?36/],["Herbicide & pesticide",/gramoxone|metsulindo|herbisida|herbicide|racun|insektisida|pestisida|round\s*up/]];
const familyOf=v=>{ const s=norm(v); if(!s) return null; const f=FAMILIES.find(([,re])=>re.test(s)); return f?f[0]:clean(v).split(" ")[0]; };
const regionOf=v=>{ const s=clean(v); if(!s) return null; const t=s.toUpperCase().replace(/^(KABUPATEN|KAB\.?|KOTA)\s+/,"").replace(/\s+CITY$/,"").trim();
  return t.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()); };

function analyse(sources){
  const A={crmSources:[],salesSources:[]}; const crm=[], lines=[];
  for(const d of sources){ const role=d.role&&d.role!=="auto"?d.role:detectRole(d.headers), label=srcLabel(d);
    if(role==="sales"){ const m=detectSales(d.headers); A.salesSources.push(label); for(const r of d.rows) if(Object.values(r).some(v=>!blank(v))) lines.push(canonSale(r,m,label)); }
    else { const m=detectCrm(d.headers); A.crmSources.push({label,map:m}); for(const r of d.rows) if(Object.values(r).some(v=>!blank(v))) crm.push(canonCrm(r,m,label)); } }
  // CRM: repeated IDs counted once, latest source wins
  const byId=new Map(), C=[]; let dupes=0;
  for(const o of crm){ if(o.id){ if(byId.has(o.id)){ C[byId.get(o.id)]=o; dupes++; continue; } byId.set(o.id,C.length); } C.push(o); }
  A.crm=C; A.dupes=dupes; A.lines=lines;
  A.has={crm:C.length>0,sales:lines.length>0};
  A.crmMap=Object.assign({},...A.crmSources.map(s=>s.map));
  A.won=C.filter(r=>r.outcome==="Won"); A.warm=C.filter(r=>r.outcome==="Warm"); A.lost=C.filter(r=>r.outcome==="Lost"); A.nostatus=C.filter(r=>!r.outcome);
  A.notWon=C.filter(r=>r.outcome!=="Won");
  A.statusKeys=STATUS_ORDER.filter(s=>C.some(r=>r.status===s)).concat([...new Set(C.map(r=>r.status).filter(s=>s&&!STATUS_ORDER.includes(s)))]);
  A.color=k=>STATUS_COLOR[k]||EXTRA[A.statusKeys.filter(x=>!STATUS_COLOR[x]).indexOf(k)%EXTRA.length];
  A.dates=[...C.map(r=>r.date),...lines.map(r=>r.date)].filter(Boolean).sort((a,b)=>a-b);

  // ---- Sales orders (lines grouped by order number)
  const om=new Map();
  lines.forEach((l,i)=>{ const key=l.orderNo||l.invoice||`line-${i}`; if(!om.has(key)) om.set(key,{no:l.orderNo||l.invoice||"–",lines:[]}); om.get(key).lines.push(l); });
  A.orders=[...om.values()].map(o=>{ const L=o.lines, f=L[0];
    return {...o,pic:f.pic,ph:f.ph,nk:f.nk,date:f.date,city:f.city,app:f.app,gmv:L.reduce((s,l)=>s+(l.gmv||0),0),qty:L.reduce((s,l)=>s+(l.qty||0),0),
      items:[...new Set(L.map(l=>shortItem(l.item)).filter(Boolean))],cats:[...new Set(L.map(l=>l.category).filter(Boolean))],
      isNew:L.some(l=>/new/i.test(l.custStatus||"")),partial:L.some(l=>/partial|unpaid|pending/i.test(l.payStatus||"")),team:f.team}; })
    .sort((a,b)=>b.gmv-a.gmv);
  const O=A.orders; A.gmv=O.reduce((s,o)=>s+o.gmv,0);
  A.customers=new Set(O.map(o=>o.ph||o.nk||o.no)).size;
  A.newOrders=O.filter(o=>o.isNew); A.partial=O.filter(o=>o.partial);
  A.byItem=sumBy(lines,l=>shortItem(l.item)||null,l=>l.gmv||0);
  // What sold: product family, product category, basket and price consistency
  const grp=(key)=>{ const m=new Map(); for(const l of lines){ const k=key(l); if(!k) continue; if(!m.has(k)) m.set(k,{k,gmv:0,qty:0,orders:new Set(),cust:new Set()});
      const g=m.get(k); g.gmv+=l.gmv||0; g.qty+=l.qty||0; g.orders.add(l.orderNo||l.invoice||l); g.cust.add(l.ph||l.nk); }
    return [...m.values()].map(g=>({...g,orders:g.orders.size,cust:g.cust.size})).sort((a,b)=>b.gmv-a.gmv); };
  A.byFamily=grp(l=>l.family); A.byCat=grp(l=>l.category); A.byRegion=grp(l=>l.region); A.byProvince=grp(l=>regionOf(l.province));
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
  A.byApp=seg(o=>o.app); A.byCust=seg(o=>o.isNew?"New customer":"Repeat customer");
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

  // ---- Link CRM to sales: phone, then order reference in notes, then first name + same PIC
  const picTok=p=>firstTok(p);
  const findOrders=r=>{ let m=r.ph?O.filter(o=>o.ph===r.ph):[];
    if(!m.length&&r.ref) m=O.filter(o=>o.no.toUpperCase()===r.ref);
    if(!m.length&&r.nk) m=O.filter(o=>o.nk===r.nk&&picTok(o.pic)===picTok(r.pic));
    return m; };
  for(const r of C){ r.orders=A.has.sales?findOrders(r):[]; r.orders.forEach(o=>{ o.crm=o.crm||[]; o.crm.push(r); }); }
  A.wonLinked=A.won.filter(r=>r.orders.length);
  A.linkedOrders=O.filter(o=>o.crm&&o.crm.some(r=>r.outcome==="Won"));
  A.linkedGmv=A.linkedOrders.reduce((s,o)=>s+o.gmv,0);
  A.noCrm=O.filter(o=>!o.crm);
  A.wonCustomers=new Set(A.won.map(r=>r.ph||r.nk||r.id)).size;

  // ---- Reasons and notes for leads that did not order
  A.reasons=countBy(A.notWon,r=>r.reason);
  A.themes=THEMES.map(([t,,c])=>({t,c,n:A.notWon.filter(r=>r.theme===t).length,lost:A.lost.filter(r=>r.theme===t).length,warm:A.warm.filter(r=>r.theme===t).length})).filter(x=>x.n);
  A.signals=SIGNALS.map(([k,label])=>({k,label,lost:A.lost.filter(r=>r.signals.includes(k)).length,warm:A.warm.filter(r=>r.signals.includes(k)).length})).map(x=>({...x,n:x.lost+x.warm})).filter(x=>x.n).sort((a,b)=>b.n-a.n);
  A.unreachable=A.notWon.filter(r=>/unable|tidak bisa|not reach|no answer/i.test(r.callResp||"")).length;
  A.stockRows=A.notWon.filter(r=>r.theme==="Stock & delivery"||r.signals.includes("stock"));
  A.intentWarm=A.warm.filter(r=>r.signals.some(s=>s==="logistics"||s==="price"));

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
