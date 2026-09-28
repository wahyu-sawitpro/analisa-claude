/* ================= Export: PowerPoint / Google Slides ================= */
// Rebuilds the current analysis as a native, editable .pptx in the SawitPRO template style.
const PPTX_SRC="https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js";
let pptxLib=null;
function loadPptx(){
  if(window.PptxGenJS) return Promise.resolve();
  if(!pptxLib) pptxLib=new Promise((ok,fail)=>{const sc=document.createElement("script"); sc.src=PPTX_SRC; sc.onload=ok;
    sc.onerror=()=>{pptxLib=null; fail(new Error("Pembuat PPTX gagal dimuat. Periksa koneksi internet lalu coba lagi."))}; document.head.appendChild(sc);});
  return pptxLib;
}
const X=px=>px/96;                       // deck canvas px -> inches (1280x720 = 13.33x7.5in)
const H=c=>c.replace("#","").toUpperCase();
const FONT="Plus Jakarta Sans";
const imgData=u=>u.replace(/^data:/,"");

function buildPptx(A){
  const pres=new PptxGenJS(); pres.layout="LAYOUT_WIDE"; pres.title="Analisa Alasan Penolakan Leads"; pres.company="SawitPRO";
  const P=period(A), tt=A.status.find(s=>s[0]==="Tidak tertarik")?.[1]||0, warmN=A.warm.length;
  const txt=(sl,text,o)=>sl.addText(text,{isTextBox:true,fontFace:FONT,margin:0,valign:"top",...o});
  let pageNo=0;
  const base={catAxisLabelFontFace:FONT,valAxisLabelFontFace:FONT,dataLabelFontFace:FONT,legendFontFace:FONT,catAxisLabelColor:"535353",valAxisLabelColor:"7A8373",
    catAxisLabelFontSize:11,valAxisLabelFontSize:10,dataLabelFontSize:11,dataLabelColor:"2B2F28",valGridLine:{color:"E3E8DF",size:0.5},catGridLine:{style:"none"},
    catAxisLineShow:false,valAxisLineShow:false,valAxisHidden:true};

  function content(kicker,title){
    const sl=pres.addSlide(); pageNo=pres.slides.length;
    sl.background={color:"FFFFFF"};
    sl.addImage({data:imgData(IMG.panel),x:X(38),y:X(38),w:X(1204),h:X(644),sizing:{type:"cover",w:X(1204),h:X(644)}});
    sl.addShape(pres.shapes.RECTANGLE,{x:X(38),y:X(655),w:X(1154),h:X(13),fill:{color:"F5D347"},line:{color:"F5D347",width:0}});
    sl.addImage({data:imgData(IMG.palm),x:X(1188),y:X(606),w:X(84),h:X(88)});
    sl.addImage({data:imgData(IMG.logo),x:X(1152),y:X(30),w:X(94),h:X(94)});
    txt(sl,"MATERI MILIK SAWITPRO",{x:X(40),y:X(690),w:3,h:0.22,fontSize:8,color:"7A8373",charSpacing:1});
    txt(sl,String(pageNo),{x:X(620),y:X(690),w:0.4,h:0.22,fontSize:8,bold:true,color:"4A653B",align:"center"});
    txt(sl,"Dilarang mempergunakan dan menyebarkan isi materi ini tanpa izin dari pihak SawitPRO",{x:X(700),y:X(690),w:X(540),h:0.22,fontSize:8,color:"7A8373",align:"right"});
    if(kicker) txt(sl,kicker.toUpperCase(),{x:X(82),y:X(64),w:8,h:0.25,fontSize:10,bold:true,color:"D9A21B",charSpacing:2});
    txt(sl,title,{x:X(80),y:X(88),w:X(1040),h:X(84),fontSize:26,bold:true,color:"4A653B",valign:"top",fit:"shrink"});
    return sl;
  }
  function card(sl,x,y,w,h,title,sub){
    sl.addShape(pres.shapes.ROUNDED_RECTANGLE,{x:X(x),y:X(y),w:X(w),h:X(h),rectRadius:0.12,fill:{color:"FFFFFF"},line:{color:"FFFFFF",width:0}});
    txt(sl,title,{x:X(x+22),y:X(y+18),w:X(w-44),h:0.3,fontSize:14,bold:true,color:"274E13"});
    if(sub) txt(sl,sub,{x:X(x+22),y:X(y+44),w:X(w-44),h:0.25,fontSize:10,color:"7A8373"});
  }
  function empty(sl,x,y,w,h,msg){ txt(sl,msg,{x:X(x),y:X(y),w:X(w),h:X(h),fontSize:13,color:"7A8373",align:"center",valign:"middle"}); }
  function barChart(sl,list,x,y,w,h,{max=6,color="4A653B",pctOf,suffix=""}={}){
    if(!list.length) return empty(sl,x,y,w,h,"Kolom belum tersedia di data ini");
    let items=list.slice(0,max); if(list.length>max) items=[...items,[`Lainnya (${list.length-max})`,list.slice(max).reduce((s,v)=>s+v[1],0)]];
    items=items.slice().reverse();
    sl.addChart(pres.charts.BAR,[{name:"Jumlah",labels:items.map(i=>i[0]),values:items.map(i=>i[1])}],{...base,x:X(x),y:X(y),w:X(w),h:X(h),barDir:"bar",
      chartColors:[H(color)],showValue:true,dataLabelPosition:"outEnd",dataLabelFormatCode:suffix?'0"'+suffix+'"':"0",showLegend:false,barGapWidthPct:60,valAxisMinVal:0,
      valAxisMaxVal:Math.max(...items.map(i=>i[1]))*1.18});
  }
  function stackChart(sl,field,x,y,w,h,{max=5,dir="bar",labels,groupsList}={}){
    const groups=(groupsList||A[field]||[]).slice(0,max);
    if(!groups.length) return empty(sl,x,y,w,h,`Kolom ${LABEL[field]||field} belum tersedia`);
    const keys=A.statusKeys.length?A.statusKeys:["_"], match=typeof field==="function"?field:(r,g)=>r[field]===g;
    let gs=dir==="bar"?groups.slice().reverse():groups;
    const data=keys.map(s=>({name:s==="_"?"Leads":s,labels:labels?labels(gs):gs.map(g=>g[0]),values:gs.map(([g])=>A.rows.filter(r=>match(r,g)&&(s==="_"||r.status===s)).length)}));
    sl.addChart(pres.charts.BAR,data,{...base,x:X(x),y:X(y),w:X(w),h:X(h),barDir:dir,barGrouping:"stacked",chartColors:keys.map(k=>H(k==="_"?"#4A653B":sColor(k,A))),
      showValue:true,dataLabelPosition:"ctr",dataLabelColor:"FFFFFF",dataLabelFormatCode:'0;;;',showLegend:keys.length>1,legendPos:"t",legendFontSize:10,legendColor:"535353",barGapWidthPct:60});
  }

  // 1 Cover
  { const sl=pres.addSlide();
    sl.addImage({data:imgData(IMG.cover),x:0,y:0,w:13.333,h:7.5,sizing:{type:"cover",w:13.333,h:7.5}});
    sl.addImage({data:imgData(IMG.wm),x:X(66),y:X(62),w:X(247),h:X(81)});
    sl.addShape(pres.shapes.RECTANGLE,{x:X(498),y:X(362),w:X(782),h:X(257),fill:{color:"4A653B"},line:{color:"4A653B",width:0}});
    sl.addShape(pres.shapes.OVAL,{x:X(371),y:X(362),w:X(257),h:X(257),fill:{color:"4A653B"},line:{color:"4A653B",width:0}});
    sl.addImage({data:imgData(IMG.logo),x:X(388),y:X(379),w:X(222),h:X(222)});
    txt(sl,"Plantation Team",{x:X(652),y:X(378),w:X(590),h:0.5,fontSize:28,bold:true,color:"F5D347"});
    txt(sl,"Analisa Alasan Penolakan Leads",{x:X(652),y:X(430),w:X(590),h:1.4,fontSize:36,bold:true,color:"FFFFFF",fit:"shrink"});
    txt(sl,`${P} · ${nf.format(A.n)} leads`,{x:X(652),y:X(630),w:X(590),h:0.3,fontSize:12,bold:true,color:"FFFFFF"}); }

  // 2 TOC
  { const sl=content("","Daftar isi");
    const toc=[["Ringkasan status leads","Berapa leads yang menolak dan yang masih hangat"],["Alasan penolakan","Apa yang membuat leads tidak lanjut"],
      ["PIC & channel engagement","Siapa dan lewat apa leads dihubungi"],["Produk, sumber & lokasi","Di mana dan untuk produk apa"],
      ["Leads yang masih hangat","Daftar tindak lanjut prioritas"],["Kualitas data & rekomendasi","Perbaikan input dan langkah berikutnya"]];
    toc.forEach((t,i)=>{const cx=80+(i%2)*530, cy=190+Math.floor(i/2)*90;
      txt(sl,String(i+1).padStart(2,"0"),{x:X(cx),y:X(cy+4),w:0.5,h:0.3,fontSize:12,bold:true,color:"D9A21B"});
      txt(sl,[{text:t[0],options:{fontSize:17,bold:true,color:"274E13",breakLine:true}},{text:t[1],options:{fontSize:11,color:"7A8373"}}],{x:X(cx+50),y:X(cy),w:X(450),h:0.75});}); }

  const divider=(no,label,title)=>{ const sl=pres.addSlide();
    sl.addImage({data:imgData(IMG.divider),x:0,y:0,w:13.333,h:7.5,sizing:{type:"cover",w:13.333,h:7.5}});
    txt(sl,label,{x:X(131),y:X(330),w:X(760),h:0.6,fontSize:30,bold:true,color:"F5D347"});
    txt(sl,title,{x:X(131),y:X(390),w:X(800),h:1.6,fontSize:42,bold:true,color:"FFFFFF"});
    txt(sl,String(no).padStart(2,"0"),{x:X(900),y:X(500),w:X(300),h:X(170),fontSize:130,bold:true,color:"FFFFFF",transparency:85,align:"right"}); };
  divider(1,"Bagian 1","Gambaran data leads minggu ini");

  // 4 KPI
  { const sl=content("Ringkasan",`${pct(tt,A.n)}% leads menolak, ${nf.format(warmN)} leads masih bisa dikejar`);
    const [pv,pu]=rpParts(A.potWarm);
    const kp=[[nf.format(A.n),"","Total leads tercatat"],[String(pct(tt,A.n)),"%",`${nf.format(tt)} leads berstatus tidak tertarik`],
      [nf.format(warmN),"","Leads masih mempertimbangkan / hangat"],[pv,pu,"Potensi sales (IDR) dari leads hangat"]];
    kp.forEach((k,i)=>{const x=80+i*272, hot=i===2;
      sl.addShape(pres.shapes.ROUNDED_RECTANGLE,{x:X(x),y:X(180),w:X(252),h:X(125),rectRadius:0.12,fill:{color:hot?"4A653B":"FFFFFF"},line:{color:hot?"4A653B":"FFFFFF",width:0}});
      txt(sl,[{text:k[0],options:{fontSize:34,bold:true,color:hot?"FFFFFF":"274E13"}},{text:k[1],options:{fontSize:16,bold:true,color:hot?"FFFFFF":"4A653B"}}],{x:X(x+20),y:X(196),w:X(212),h:0.6});
      txt(sl,k[2],{x:X(x+20),y:X(252),w:X(212),h:0.45,fontSize:11,color:hot?"E4ECDD":"535353"});});
    card(sl,80,330,1068,210,"Komposisi status leads",`Status dinormalisasi dari input asli (${A.typos.length?`${A.typos.length} variasi penulisan diperbaiki`:"tanpa koreksi"})`);
    if(A.statusKeys.length){
      sl.addChart(pres.charts.BAR,A.statusKeys.map(s=>({name:s,labels:["Status"],values:[A.status.find(x=>x[0]===s)[1]]})),{...base,x:X(96),y:X(395),w:X(1036),h:X(135),
        barDir:"bar",barGrouping:"percentStacked",chartColors:A.statusKeys.map(k=>H(sColor(k,A))),showValue:true,dataLabelPosition:"ctr",dataLabelColor:"FFFFFF",dataLabelFontSize:12,dataLabelFontBold:true,
        showLegend:true,legendPos:"b",legendFontSize:11,catAxisHidden:true,barGapWidthPct:20});
    } else empty(sl,96,395,1036,135,"Kolom status tidak ditemukan"); }

  // 5 Reasons
  { const r0=A.reasons[0];
    const sl=content("Alasan penolakan",r0?`“${r0[0]}” jadi alasan ${pct(r0[1],A.n)}% penolakan`:"Alasan penolakan");
    card(sl,80,180,600,440,"Alasan tidak tertarik","Jumlah leads per alasan"); barChart(sl,A.reasons,96,240,568,370);
    card(sl,704,180,444,440,"Alasan × status","Apakah alasan yang sama muncul di status berbeda");
    const reasonOf=r=>r.reason && r.reasonOther && /lain|other/i.test(r.reason)? r.reasonOther : r.reason;
    stackChart(sl,(r,g)=>reasonOf(r)===g,720,240,412,370,{groupsList:A.reasons}); }

  // 6 PIC & channel
  { const p0=A.pic[0]; const sl=content("PIC & channel",p0?`${p0[0]} menangani ${pct(p0[1],A.n)}% leads yang tercatat`:"PIC & channel engagement");
    card(sl,80,180,524,440,"Per PIC plantation team","Jumlah leads dan statusnya"); stackChart(sl,"pic",96,240,492,370);
    card(sl,624,180,524,440,"Per tipe engagement","Cara leads dihubungi"); stackChart(sl,"channel",640,240,492,370); }

  // 7 Product & source
  { const u0=A.purpose[0]; const sl=content("Produk & sumber",u0?`${u0[0]} mendominasi dengan ${pct(u0[1],A.n)}% leads`:"Produk & sumber leads");
    card(sl,80,180,524,440,"Tujuan engagement","Lini produk / layanan yang ditawarkan"); stackChart(sl,"purpose",96,240,492,370);
    card(sl,624,180,524,440,"Sumber leads","Dari mana leads berasal"); stackChart(sl,"source",640,240,492,370); }

  // 8 Location & daily
  { const l0=A.location[0]; const sl=content("Lokasi & waktu",l0?`${pct(l0[1],A.n)}% leads berasal dari ${l0[0]}`:"Lokasi & aktivitas harian");
    card(sl,80,180,500,440,"Lokasi (kabupaten – kecamatan)","Top lokasi leads"); barChart(sl,A.location,96,240,468,370,{max:5});
    card(sl,600,180,548,440,"Engagement per hari","Jumlah leads per tanggal engagement");
    if(A.dates.length){ const days=[...new Set(A.rows.filter(r=>r.date).map(r=>+r.date))].sort((a,b)=>a-b).slice(-14).map(k=>[k,0]);
      stackChart(sl,(r,g)=>r.date&&+r.date===g,616,240,516,370,{dir:"col",groupsList:days,max:14,labels:gs=>gs.map(([k])=>fds(new Date(k)))});
    } else empty(sl,616,240,516,370,"Kolom tanggal belum tersedia"); }

  divider(2,"Bagian 2","Temuan & tindak lanjut");

  // 10 Warm leads
  { const sl=content("Prioritas follow-up",warmN?`${nf.format(warmN)} leads hangat senilai ${rp(A.potWarm)} perlu di-follow-up`:"Belum ada leads hangat pada data ini");
    if(warmN){
      const cols=[["id","ID"],["date","Tanggal"],["pic","PIC"],["product","Produk"],["location","Lokasi"],["reason","Alasan"],["potential","Potensi"]].filter(c=>A.map[c[0]]);
      const wl=A.warm.slice().sort((a,b)=>(b.potential||0)-(a.potential||0)).slice(0,8);
      const hd=o=>({fill:{color:"4A653B"},color:"FFFFFF",bold:true,fontSize:11,...o});
      const rows=[[...cols.map(c=>({text:c[1],options:hd(c[0]==="potential"?{align:"right"}:{})})),{text:"Status",options:hd()}]];
      wl.forEach(r=>rows.push([...cols.map(([k])=>({text:k==="potential"?(r.potential?rp(r.potential):"–"):k==="date"?(r.date?fd(r.date):"–"):String(k==="product"?(r.product||r.purpose||"–"):(r[k]||"–")),
        options:k==="potential"?{align:"right"}:{}})),{text:r.status,options:{color:"6B4F00",bold:true,fill:{color:"FBEFC4"}}}]));
      if(A.map.potential) rows.push([{text:"Total potensi",options:{bold:true,colspan:cols.length-1,fill:{color:"F4F6F1"}}},{text:rp(A.potWarm),options:{bold:true,align:"right",fill:{color:"F4F6F1"}}},{text:"",options:{fill:{color:"F4F6F1"}}}]);
      sl.addTable(rows,{x:X(80),y:X(180),w:X(1068),fontFace:FONT,fontSize:10.5,color:"2B2F28",fill:{color:"FFFFFF"},border:{type:"solid",pt:0.5,color:"DCE2D6"},valign:"middle",margin:0.06,autoPage:false});
      txt(sl,"Nama dan nomor telepon leads tidak ditampilkan di deck. Gunakan ID untuk mencarinya di CRM.",{x:X(80),y:X(605),w:8,h:0.3,fontSize:10,color:"535353"});
    } else empty(sl,80,200,1068,380,"Semua leads pada data ini berstatus tidak tertarik atau kolom status belum ada."); }

  // 11 Data quality
  { const keyCols=A.fill.slice().sort((a,b)=>a[1]-b[1]), poor=keyCols.filter(x=>x[1]<.5);
    const sl=content("Kualitas data",poor.length?`${poor.length} dari ${keyCols.length} kolom terisi kurang dari separuh`:"Kelengkapan data sudah baik");
    card(sl,80,180,620,440,"Kelengkapan per kolom","Persentase baris yang terisi (kolom data pribadi tidak ditampilkan)");
    barChart(sl,keyCols.slice(0,9).map(([h,f])=>[h,Math.round(f*100)]),96,240,588,370,{max:9,color:"#9DAE8F",suffix:"%"});
    card(sl,720,180,428,440,"Catatan input","Hal yang perlu dirapikan di form");
    const notes=qualityNotes(A).map(t=>t.replace(/&quot;/g,'"').replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#39;/g,"'"));
    txt(sl,notes.map((t,i)=>({text:t,options:{bullet:{code:"25CF"},breakLine:i<notes.length-1,paraSpaceAfter:8}})),{x:X(742),y:X(240),w:X(384),h:X(360),fontSize:11,color:"535353",fit:"shrink"}); }

  // 12 Insights
  { const sl=content("Insight & rekomendasi","Apa yang perlu dilakukan minggu depan");
    const ins=insights(A).map(t=>t.map(x=>x.replace(/&quot;/g,'"').replace(/&amp;/g,"&").replace(/&#39;/g,"'")));
    const gap=Math.min(88,440/ins.length);
    ins.forEach((t,i)=>{const y=180+i*gap;
      sl.addShape(pres.shapes.ROUNDED_RECTANGLE,{x:X(80),y:X(y),w:X(880),h:X(gap-12),rectRadius:0.1,fill:{color:"FFFFFF"},line:{color:"FFFFFF",width:0}});
      sl.addShape(pres.shapes.OVAL,{x:X(98),y:X(y+14),w:X(34),h:X(34),fill:{color:i%2?"F5D347":"4A653B"},line:{color:i%2?"F5D347":"4A653B",width:0}});
      txt(sl,String(i+1),{x:X(98),y:X(y+14),w:X(34),h:X(34),fontSize:12,bold:true,color:i%2?"274E13":"FFFFFF",align:"center",valign:"middle"});
      txt(sl,[{text:t[0],options:{fontSize:13,bold:true,color:"274E13",breakLine:true}},{text:t[1],options:{fontSize:10.5,color:"535353"}}],{x:X(150),y:X(y+10),w:X(790),h:X(gap-28),fit:"shrink"});});
    sl.addImage({data:imgData(IMG.point),x:X(1000),y:X(420),w:X(190),h:X(190)}); }

  // 13 Closing
  { const sl=pres.addSlide();
    sl.addImage({data:imgData(IMG.closing),x:0,y:0,w:13.333,h:7.5,sizing:{type:"cover",w:13.333,h:7.5}});
    sl.addShape(pres.shapes.RECTANGLE,{x:0,y:0,w:13.333,h:7.5,fill:{color:"000000",transparency:65},line:{color:"000000",width:0,transparency:100}});
    sl.addImage({data:imgData(IMG.wm),x:X(66),y:X(62),w:X(247),h:X(81)});
    sl.addImage({data:imgData(IMG.logo),x:X(1094),y:X(48),w:X(120),h:X(120)});
    txt(sl,"Terima Kasih",{x:0,y:X(290),w:13.333,h:1.1,fontSize:60,bold:true,color:"FFFFFF",align:"center"});
    txt(sl,"#TerusTumbuh",{x:0,y:X(400),w:13.333,h:0.6,fontSize:26,bold:true,color:"F5D347",align:"center"}); }
  return pres;
}

function pptxName(){ const d=state.A?.dates||[]; const tag=d.length?`${d[0].getFullYear()}-${String(d[0].getMonth()+1).padStart(2,"0")}-${String(d[0].getDate()).padStart(2,"0")}`:"data";
  return `Analisa-Leads-SawitPRO-${tag}.pptx`; }
async function downloadPptx(btn){
  const label=btn.innerHTML; btn.disabled=true; btn.querySelector(".t")?.replaceChildren("Menyiapkan…");
  try{
    await loadPptx();
    const pres=buildPptx(state.A), name=pptxName();
    const blob=await pres.write({outputType:"blob"});
    const dl=window.claude?.use ? await window.claude.use("downloads") : null;
    if(dl){
      try{ await dl.save({filename:name,data:blob}); note(`${name} tersimpan. Buka di PowerPoint, atau upload ke Google Drive lalu buka dengan Google Slides.`); }
      catch(e){ if(e?.code!=="declined") note(`File belum tersimpan: ${e?.message||e?.code||"penyimpanan tidak tersedia di tampilan ini"}.`,true); }
    } else {
      const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>URL.revokeObjectURL(a.href),4000); note(`${name} diunduh.`);
    }
  }catch(e){ note(e.message||"PPTX gagal dibuat.",true); }
  finally{ btn.disabled=false; btn.innerHTML=label; }
}
const gsModal=document.getElementById("gsModal");
document.getElementById("pptxBtn").onclick=e=>downloadPptx(e.currentTarget);
document.getElementById("gslidesBtn").onclick=()=>{ gsModal.hidden=false; document.getElementById("gsDl").focus(); };
document.getElementById("gsDl").onclick=e=>downloadPptx(e.currentTarget);
document.getElementById("gsClose").onclick=()=>{ gsModal.hidden=true; };
gsModal.onclick=e=>{ if(e.target===gsModal) gsModal.hidden=true; };
addEventListener("keydown",e=>{ if(e.key==="Escape" && !gsModal.hidden) gsModal.hidden=true; });
loadPptx().catch(()=>{});
