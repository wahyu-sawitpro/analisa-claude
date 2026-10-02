/* ================= Export: PowerPoint + Google Slides ================= */
// Rebuilds the current analysis as a native, editable 16:9 .pptx in the SawitPRO template style.
const PPTX_SRC="https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js";
const PPTX_MIME="application/vnd.openxmlformats-officedocument.presentationml.presentation";
let pptxLib=null;
function loadPptx(){
  if(window.PptxGenJS) return Promise.resolve();
  if(!pptxLib) pptxLib=new Promise((ok,fail)=>{const sc=document.createElement("script"); sc.src=PPTX_SRC; sc.onload=ok;
    sc.onerror=()=>{pptxLib=null; fail(new Error("The PowerPoint builder didn't load. Check your connection and try again."))}; document.head.appendChild(sc);});
  return pptxLib;
}
const X=px=>px/96;                        // deck canvas px -> inches (1280x720 = 13.33x7.5in)
const H=c=>c.replace("#","").toUpperCase();
const FONT="Plus Jakarta Sans";
const imgData=u=>u.replace(/^data:/,"");
const strip=h=>String(h).replace(/<[^>]+>/g,"").replace(/&quot;/g,'"').replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#39;/g,"'");

function buildPptx(A,N){
  const pres=new PptxGenJS(); pres.layout="LAYOUT_WIDE"; pres.title="Why Leads Say No"; pres.company="SawitPRO";
  const txt=(sl,t,o)=>sl.addText(t,{isTextBox:true,fontFace:FONT,margin:0,valign:"top",...o});
  const box=(sl,x,y,w,h,fill)=>sl.addShape(pres.shapes.ROUNDED_RECTANGLE,{x:X(x),y:X(y),w:X(w),h:X(h),rectRadius:0.12,fill:{color:fill||"FFFFFF"},line:{color:fill||"FFFFFF",width:0}});
  const base={catAxisLabelFontFace:FONT,valAxisLabelFontFace:FONT,dataLabelFontFace:FONT,legendFontFace:FONT,catAxisLabelColor:"535353",catAxisLabelFontSize:10.5,
    dataLabelFontSize:10.5,dataLabelColor:"2B2F28",valGridLine:{style:"none"},catGridLine:{style:"none"},catAxisLineShow:false,valAxisLineShow:false,valAxisHidden:true};
  function content(no,kicker,title){
    const sl=pres.addSlide(); sl.background={color:"FFFFFF"}; no=pres.slides.length;
    sl.addImage({data:imgData(IMG.panel),x:X(38),y:X(38),w:X(1204),h:X(644),sizing:{type:"cover",w:X(1204),h:X(644)}});
    sl.addShape(pres.shapes.RECTANGLE,{x:X(38),y:X(655),w:X(1154),h:X(13),fill:{color:"F5D347"},line:{color:"F5D347",width:0}});
    sl.addImage({data:imgData(IMG.palm),x:X(1188),y:X(606),w:X(84),h:X(88)});
    sl.addImage({data:imgData(IMG.logo),x:X(1152),y:X(30),w:X(94),h:X(94)});
    txt(sl,"SAWITPRO PROPRIETARY",{x:X(40),y:X(690),w:3,h:0.22,fontSize:8,color:"7A8373",charSpacing:1});
    txt(sl,String(no),{x:X(620),y:X(690),w:0.4,h:0.22,fontSize:8,bold:true,color:"4A653B",align:"center"});
    txt(sl,"Do not use or distribute without permission from SawitPRO",{x:X(700),y:X(690),w:X(540),h:0.22,fontSize:8,color:"7A8373",align:"right"});
    txt(sl,kicker.toUpperCase(),{x:X(82),y:X(64),w:8,h:0.25,fontSize:10,bold:true,color:"D9A21B",charSpacing:2});
    txt(sl,title,{x:X(80),y:X(88),w:X(1040),h:X(84),fontSize:23,bold:true,color:"4A653B",fit:"shrink"});
    return sl;
  }
  const heading=(sl,x,y,w,t,sub)=>{ txt(sl,t,{x:X(x),y:X(y),w:X(w),h:0.28,fontSize:13,bold:true,color:"274E13"}); if(sub) txt(sl,sub,{x:X(x),y:X(y+24),w:X(w),h:0.25,fontSize:9.5,color:"7A8373"}); };
  const kpi=(sl,x,y,w,h,k)=>{ box(sl,x,y,w,h,k.hot?"4A653B":"FFFFFF");
    txt(sl,[{text:k.v,options:{fontSize:30,bold:true,color:k.hot?"FFFFFF":"274E13"}},{text:k.u,options:{fontSize:15,bold:true,color:k.hot?"FFFFFF":"4A653B"}}],{x:X(x+18),y:X(y+14),w:X(w-36),h:0.5});
    txt(sl,k.l,{x:X(x+18),y:X(y+62),w:X(w-36),h:X(h-70),fontSize:10,color:k.hot?"E4ECDD":"535353",fit:"shrink"}); };

  // 1 Cover
  { const sl=pres.addSlide();
    sl.addImage({data:imgData(IMG.cover),x:0,y:0,w:13.333,h:7.5,sizing:{type:"cover",w:13.333,h:7.5}});
    sl.addImage({data:imgData(IMG.wm),x:X(66),y:X(62),w:X(247),h:X(81)});
    sl.addShape(pres.shapes.RECTANGLE,{x:X(498),y:X(362),w:X(782),h:X(257),fill:{color:"4A653B"},line:{color:"4A653B",width:0}});
    sl.addShape(pres.shapes.OVAL,{x:X(371),y:X(362),w:X(257),h:X(257),fill:{color:"4A653B"},line:{color:"4A653B",width:0}});
    sl.addImage({data:imgData(IMG.logo),x:X(388),y:X(379),w:X(222),h:X(222)});
    txt(sl,"Plantation Team",{x:X(652),y:X(380),w:X(590),h:0.5,fontSize:26,bold:true,color:"F5D347"});
    txt(sl,"Why Leads Say No",{x:X(652),y:X(430),w:X(590),h:0.9,fontSize:38,bold:true,color:"FFFFFF"});
    txt(sl,`Lead rejection analysis · ${N.period} · ${nf.format(A.n)} leads${A.sources.length>1?` · ${A.sources.length} sources`:""}`,{x:X(652),y:X(630),w:X(600),h:0.3,fontSize:12,bold:true,color:"FFFFFF"}); }

  // 2 Executive summary
  { const sl=content(2,"Executive summary",N.summaryTitle);
    N.kpis.forEach((k,i)=>kpi(sl,80+i*274,180,256,118,k));
    box(sl,80,316,650,326);
    const f=N.findings.flatMap((x,i)=>[{text:x[0],options:{fontSize:13,bold:true,color:"274E13",bullet:{code:"25CF"},breakLine:true}},
      {text:x[1],options:{fontSize:10.5,color:"535353",indentLevel:1,breakLine:i<N.findings.length-1,paraSpaceAfter:9}}]);
    txt(sl,f,{x:X(100),y:X(334),w:X(612),h:X(292),fit:"shrink"});
    box(sl,750,316,410,326,"274E13");
    txt(sl,[{text:"BOTTOM LINE",options:{fontSize:9.5,bold:true,color:"F5D347",charSpacing:2,breakLine:true,paraSpaceAfter:8}},
      {text:N.bottom.p,options:{fontSize:16,bold:true,color:"FFFFFF",breakLine:true,paraSpaceAfter:10}},{text:N.bottom.s,options:{fontSize:10.5,color:"D8E3CF"}}],
      {x:X(774),y:X(338),w:X(362),h:X(286),fit:"shrink"}); }

  // Across data sources (only when several files/sheets are combined)
  if(A.sources.length>1){ const sl=content(0,"Across data sources",N.srcTitle), src=A.sources.slice(0,8);
    box(sl,80,180,470,462); heading(sl,100,196,430,"Leads per source, by status","Each uploaded file or sheet");
    const g=src.slice().reverse();
    sl.addChart(pres.charts.BAR,A.statusKeys.map(k=>({name:k,labels:g.map(x=>x.name.length>34?x.name.slice(0,33)+"…":x.name),values:g.map(x=>x.status.find(s=>s[0]===k)[1])})),
      {...base,x:X(96),y:X(250),w:X(438),h:X(380),barDir:"bar",barGrouping:"stacked",chartColors:A.statusKeys.map(k=>H(A.color(k))),showValue:true,dataLabelPosition:"ctr",
        dataLabelColor:"FFFFFF",dataLabelFormatCode:"0;;;",showLegend:A.statusKeys.length>1,legendPos:"t",legendFontSize:10,legendColor:"535353",barGapWidthPct:50,catAxisLabelFontSize:9});
    box(sl,570,180,590,462);
    const hd=(t,o)=>({text:t,options:{bold:true,color:"FFFFFF",fill:{color:"4A653B"},fontSize:9.5,...o}}), r_={align:"right"};
    const rows=[[hd("Source"),hd("Leads",r_),hd("Not int.",r_),hd("In play",r_),hd("Potential",r_),hd("Period")]];
    src.forEach(x=>rows.push([{text:x.name},{text:String(x.n),options:r_},{text:pct(x.rej,x.n)+"%",options:r_},{text:String(x.warm),options:r_},{text:x.pot?rp(x.pot):"–",options:r_},{text:span(x.dates)}]));
    const ft={bold:true,fill:{color:"F4F6F1"}};
    rows.push([{text:"All sources",options:ft},{text:String(A.n),options:{...ft,...r_}},{text:pct(A.rej.length,A.n)+"%",options:{...ft,...r_}},{text:String(A.warm.length),options:{...ft,...r_}},
      {text:A.potWarm?rp(A.potWarm):"–",options:{...ft,...r_}},{text:N.period,options:ft}]);
    sl.addTable(rows,{x:X(586),y:X(196),w:X(558),colW:[X(178),X(54),X(62),X(56),X(78),X(130)],fontFace:FONT,fontSize:9,color:"2B2F28",border:{type:"solid",pt:0.5,color:"DCE2D6"},valign:"middle",margin:0.04,autoPage:false});
    txt(sl,N.srcNote,{x:X(586),y:X(600),w:X(558),h:0.3,fontSize:9,color:"7A8373"}); }

  // 3 Outcome driver
  { const D=N.driver, sl=content(3,"What drives the outcome",D?N.driverTitle:"Outcome drivers");
    if(D){
      box(sl,80,180,440,320); heading(sl,100,196,400,`Leads still in play, by ${D.dim.toLowerCase()}`,"Share of leads that did not reject (considering or better)");
      const g=A.best.groups.slice().reverse();
      sl.addChart(pres.charts.BAR,[{name:"Still in play",labels:g.map(x=>`${x.g} (${x.w}/${x.n})`),values:g.map(x=>Math.round(x.rate*100))}],{...base,x:X(96),y:X(250),w:X(408),h:X(240),
        barDir:"bar",chartColors:["4A653B"],showValue:true,dataLabelPosition:"outEnd",dataLabelFormatCode:'0"%"',showLegend:false,barGapWidthPct:50,valAxisMinVal:0,valAxisMaxVal:120});
      box(sl,540,180,620,320);
      const hd=t=>({text:t,options:{bold:true,color:"FFFFFF",fill:{color:"4A653B"},fontSize:10}});
      const rows=[[hd("Dimension"),hd(`Not interested (${A.rej.length})`),hd(`Still in play (${A.warm.length})`)]];
      A.profile.forEach(p=>rows.push([{text:LABEL[p.k],options:{bold:true,color:"7A8373"}},{text:`${p.rej.v}  ${Math.round(p.rej.share*100)}%${A.lockstep.includes(p.k)?"  · all":""}`},
        {text:A.warm.length?`${p.warm.v}  ${Math.round(p.warm.share*100)}%`:"–"}]));
      if(A.dates.length) rows.push([{text:"Dates",options:{bold:true,color:"7A8373"}},{text:span(A.rej.map(r=>r.date).filter(Boolean).sort((a,b)=>a-b))},{text:span(A.warm.map(r=>r.date).filter(Boolean).sort((a,b)=>a-b))}]);
      sl.addTable(rows,{x:X(556),y:X(196),w:X(588),colW:[X(130),X(229),X(229)],fontFace:FONT,fontSize:9.5,color:"2B2F28",border:{type:"solid",pt:0.5,color:"DCE2D6"},valign:"middle",margin:0.05,autoPage:false});
      box(sl,80,516,1080,110,"FBEFC4");
      txt(sl,strip(N.caveat),{x:X(100),y:X(530),w:X(1040),h:X(84),fontSize:11,color:"5A4600",valign:"middle",fit:"shrink"});
    } else txt(sl,"Needs a status column with both rejected and progressing leads.",{x:X(80),y:X(300),w:X(1080),h:1,fontSize:14,color:"7A8373",align:"center"}); }

  // 4 Reasons
  { const sl=content(4,"Why leads say no",N.reasonTitle);
    box(sl,80,180,620,462); heading(sl,100,196,580,"Reasons logged, by lead status","Reasons translated from the Indonesian form options");
    const rs=A.reasons.slice(0,5).slice().reverse();
    if(rs.length) sl.addChart(pres.charts.BAR,A.statusKeys.map(s=>({name:s,labels:rs.map(r=>r[0]),values:rs.map(([k])=>A.rows.filter(r=>r.reason===k&&r.status===s).length)})),
      {...base,x:X(96),y:X(250),w:X(588),h:X(290),barDir:"bar",barGrouping:"stacked",chartColors:A.statusKeys.map(k=>H(A.color(k))),showValue:true,dataLabelPosition:"ctr",
        dataLabelColor:"FFFFFF",dataLabelFormatCode:"0;;;",showLegend:A.statusKeys.length>1,legendPos:"t",legendFontSize:10,legendColor:"535353",barGapWidthPct:50});
    if(A.warm.length) txt(sl,`Leads still in play: ${A.warmReasons.map(([k,v])=>`${v}× ${k.toLowerCase()}`).join(", ")}. That is a timing objection, which can be nurtured.`,{x:X(100),y:X(560),w:X(580),h:X(64),fontSize:10.5,color:"535353",fit:"shrink"});
    box(sl,720,180,440,462); heading(sl,740,196,400,"Reason quality","Can the team act on the reason given?");
    txt(sl,[{text:String(N.catchPct),options:{fontSize:48,bold:true,color:"274E13"}},{text:"%",options:{fontSize:22,bold:true,color:"274E13"}}],{x:X(740),y:X(250),w:X(400),h:0.8});
    txt(sl,`of rejections carry a catch-all reason${A.rejNoReason?`, and ${A.rejNoReason} carry none`:""}. There is nothing to fix in the pitch, price or targeting.`,{x:X(740),y:X(330),w:X(400),h:X(60),fontSize:11,color:"535353"});
    heading(sl,740,404,400,"Proposed required options","Each one points to a different fix");
    const opts=["Price too high","No need yet + revisit month","Already has a supplier","Unreachable","Needs owner / co-op approval","Doubts the product"];
    txt(sl,opts.map((o,i)=>({text:o,options:{bullet:{code:"25A0"},breakLine:i<opts.length-1,paraSpaceAfter:3}})),{x:X(744),y:X(456),w:X(396),h:X(170),fontSize:11,bold:true,color:"274E13"}); }

  // 5 Pipeline
  { const sl=content(5,"Pipeline at stake",N.pipeTitle);
    if(A.warm.length){
      const avg=A.potWarm/A.warm.length;
      [{v:rpParts(A.potWarm)[0],u:rpParts(A.potWarm)[1],l:"Potential sales still in play",hot:true},{v:A.potWarm?rpParts(avg)[0]:"–",u:A.potWarm?rpParts(avg)[1]:"",l:"Average value per lead in play"},
       {v:String(A.warmClosing),u:`/${A.warm.length}`,l:"Have an estimated closing date"}].forEach((k,i)=>kpi(sl,80+i*366,180,348,112,k));
      const cols=[["id","ID"],["date","Date"],["pic","PIC"],["product","Product"],["location","Location"],["potential","Potential"]].filter(c=>A.map[c[0]]);
      const hd=(t,o)=>({text:t,options:{bold:true,color:"FFFFFF",fill:{color:"4A653B"},fontSize:10,...o}});
      const rows=[[...cols.map(c=>hd(c[1],c[0]==="potential"?{align:"right"}:{})),hd("Reason"),hd("Status")]];
      A.warm.slice().sort((a,b)=>(b.potential||0)-(a.potential||0)).slice(0,6).forEach(r=>rows.push([...cols.map(([k])=>({text:k==="potential"?(r.potential?rp(r.potential):"–"):k==="date"?(r.date?fd(r.date):"–"):String(k==="product"?(r.product||r.purpose||"–"):(r[k]||"–")),options:k==="potential"?{align:"right"}:{}})),
        {text:r.reason||"–"},{text:r.status,options:{bold:true,color:"6B4F00",fill:{color:"FBEFC4"}}}]));
      box(sl,80,310,1080,332);
      sl.addTable(rows,{x:X(96),y:X(326),w:X(1048),fontFace:FONT,fontSize:9.5,color:"2B2F28",border:{type:"solid",pt:0.5,color:"DCE2D6"},valign:"middle",margin:0.05,autoPage:false});
      txt(sl,"Lead names and phone numbers are left out; look them up by ID in the CRM.",{x:X(96),y:X(612),w:8,h:0.25,fontSize:9,color:"7A8373"});
    } else txt(sl,"Every lead in this data is not interested, or there is no status column.",{x:X(80),y:X(300),w:X(1080),h:1,fontSize:14,color:"7A8373",align:"center"}); }

  // 6 Actions
  { const sl=content(6,"Next steps",`${N.actions.length} actions for the next two weeks`);
    N.actions.forEach((a,i)=>{ const x=80+(i%2)*548, y=180+Math.floor(i/2)*205; box(sl,x,y,532,190);
      txt(sl,[{text:`${i+1}  `,options:{color:"D9A21B",bold:true,fontSize:12}},{text:a.t,options:{color:"274E13",bold:true,fontSize:13}}],{x:X(x+20),y:X(y+16),w:X(492),h:0.3});
      txt(sl,a.d,{x:X(x+20),y:X(y+48),w:X(492),h:X(96),fontSize:10.5,color:"535353",fit:"shrink"});
      txt(sl,[{text:`Owner: ${a.o}`,options:{bold:true,color:"274E13"}},{text:`     ${a.w}`,options:{bold:true,color:"9A6F00"}}],{x:X(x+20),y:X(y+154),w:X(492),h:0.25,fontSize:9.5}); });
    if(N.gaps.length) txt(sl,[{text:"Also clean up in the form: ",options:{bold:true,color:"274E13"}},{text:N.gaps.join("; ")+"."}],{x:X(80),y:X(600),w:X(1080),h:X(40),fontSize:10,color:"535353",fit:"shrink"}); }

  // 7 Closing
  { const sl=pres.addSlide();
    sl.addImage({data:imgData(IMG.closing),x:0,y:0,w:13.333,h:7.5,sizing:{type:"cover",w:13.333,h:7.5}});
    sl.addShape(pres.shapes.RECTANGLE,{x:0,y:0,w:13.333,h:7.5,fill:{color:"000000",transparency:65},line:{color:"000000",width:0,transparency:100}});
    sl.addImage({data:imgData(IMG.wm),x:X(66),y:X(62),w:X(247),h:X(81)});
    sl.addImage({data:imgData(IMG.logo),x:X(1094),y:X(48),w:X(120),h:X(120)});
    txt(sl,"Thank You",{x:0,y:X(290),w:13.333,h:1.1,fontSize:60,bold:true,color:"FFFFFF",align:"center"});
    txt(sl,"#TerusTumbuh",{x:0,y:X(400),w:13.333,h:0.6,fontSize:26,bold:true,color:"F5D347",align:"center"}); }
  return pres;
}

function deckName(){ const d=state.A?.dates||[]; const t=d.length?`${d[0].getFullYear()}-${String(d[0].getMonth()+1).padStart(2,"0")}-${String(d[0].getDate()).padStart(2,"0")}`:"data";
  return `SawitPRO Lead Rejection Analysis ${t}`; }
async function makeBlob(){ await loadPptx(); return buildPptx(state.A,state.N).write({outputType:"blob"}); }
async function busy(btn,label,fn){ const html=btn.innerHTML; btn.disabled=true; const t=btn.querySelector(".t"); if(t) t.textContent=label; else btn.textContent=label;
  try{ await fn(); } finally{ btn.disabled=false; btn.innerHTML=html; } }

async function downloadPptx(btn){
  await busy(btn,"Preparing…",async()=>{
    try{
      const blob=await makeBlob(), name=deckName()+".pptx";
      const dl=window.claude?.use?await window.claude.use("downloads"):null;
      if(dl){ try{ await dl.save({filename:name,data:blob}); note(`Saved ${name}.`); }
        catch(e){ if(e?.code!=="declined") note(`The file wasn't saved: ${e?.message||e?.code||"saving isn't available in this view"}.`,true); } }
      else { const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000); note(`Downloaded ${name}.`); }
    }catch(e){ note(e.message||"Couldn't build the PPTX.",true); }
  });
}

// Google Slides: upload the PPTX to the viewer's Google Drive (the connector converts it to Slides) and link to it.
const GDRIVE="Google Drive";
let mcpP=null; const getMcp=()=>mcpP||(mcpP=window.claude?.use?window.claude.use("mcp").catch(()=>null):Promise.resolve(null));
function fileIdOf(p){
  if(typeof p==="string"){ try{ p=JSON.parse(p) }catch(e){ const m=p.match(/"id"\s*:\s*"([\w-]{10,})"/)||p.match(/\/d\/([\w-]{10,})/); return m?m[1]:null; } }
  if(!p||typeof p!=="object") return null;
  const f=p.file||p.result||p; const link=f.webViewLink||f.alternateLink||f.url||f.viewUrl;
  return f.id||(link&&(link.match(/\/d\/([\w-]{10,})/)||[])[1])||null;
}
const b64=blob=>new Promise((ok,fail)=>{const r=new FileReader(); r.onload=()=>ok(String(r.result).split(",")[1]); r.onerror=()=>fail(r.error); r.readAsDataURL(blob);});
function manualSlides(lead){ document.getElementById("gsLead").textContent=lead; gsModal.hidden=false; document.getElementById("gsDl").focus(); }
async function openInSlides(btn){
  const mcp=await getMcp();
  if(!mcp) return manualSlides("Google Drive isn't reachable from this view, so import the deck by hand. Text, tables and charts stay editable.");
  await busy(btn,"Uploading…",async()=>{
    try{
      const blob=await makeBlob(), title=deckName();
      let fileArgs=false; try{ fileArgs=!!(await mcp.listTools()).fileArgs }catch(e){}
      const content=fileArgs?{$file:{data:blob,name:title.replace(/\s+/g,"-")+".pptx",type:PPTX_MIME}}:(blob.size<700000?await b64(blob):null);
      if(!content) return manualSlides("The deck is too large to send to Google Drive from this view. Import it by hand instead.");
      const res=await mcp.callTool(GDRIVE,"create_file",{title,base64Content:content,contentMimeType:PPTX_MIME});
      const id=fileIdOf(res.payload??res.content?.[0]?.text);
      const url=id?`https://docs.google.com/presentation/d/${id}/edit`:"https://drive.google.com/drive/recent";
      note(`Saved to your Google Drive as “${esc(title)}”. <a href="${url}" target="_blank" rel="noopener">Open in Google Slides ↗</a>`,false,true);
    }catch(e){
      const c=e?.code;
      if(c==="server_not_connected"||c==="selection_required") manualSlides("Google Drive isn't connected for your account. Add it in claude.ai Settings → Connectors, or import the deck by hand.");
      else if(c==="needs_reauth") manualSlides("Your Google Drive connection has expired. Reconnect it in claude.ai Settings → Connectors, or import the deck by hand.");
      else if(c==="not_in_manifest"||c==="not_granted"||c==="capability_disabled"||c==="blocked_by_policy"||c==="approval_required") manualSlides("Google Drive access isn't allowed for this page, so import the deck by hand.");
      else if(c==="server_unavailable"||c==="upstream_error") note("Google Drive didn't answer. Check your Drive's Recent files before trying again, in case the upload went through.",true);
      else if(c==="tool_error") note(`Google Drive refused the upload: ${e.message}`,true);
      else note(e?.message||"Couldn't send the deck to Google Drive.",true);
    }
  });
}
const gsModal=document.getElementById("gsModal");
document.getElementById("pptxBtn").onclick=e=>downloadPptx(e.currentTarget);
document.getElementById("gslidesBtn").onclick=e=>openInSlides(e.currentTarget);
document.getElementById("gsDl").onclick=e=>downloadPptx(e.currentTarget);
document.getElementById("gsClose").onclick=()=>{ gsModal.hidden=true; };
gsModal.onclick=e=>{ if(e.target===gsModal) gsModal.hidden=true; };
addEventListener("keydown",e=>{ if(e.key==="Escape"&&!gsModal.hidden) gsModal.hidden=true; });
loadPptx().catch(()=>{});
