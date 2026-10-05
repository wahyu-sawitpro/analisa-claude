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
  const pres=new PptxGenJS(); pres.layout="LAYOUT_WIDE"; pres.title=N.title; pres.company="SawitPRO";
  const txt=(sl,t,o)=>sl.addText(t,{isTextBox:true,fontFace:FONT,margin:0,valign:"top",...o});
  const box=(sl,x,y,w,h,fill)=>sl.addShape(pres.shapes.ROUNDED_RECTANGLE,{x:X(x),y:X(y),w:X(w),h:X(h),rectRadius:0.12,fill:{color:fill||"FFFFFF"},line:{color:fill||"FFFFFF",width:0}});
  const base={catAxisLabelFontFace:FONT,valAxisLabelFontFace:FONT,dataLabelFontFace:FONT,legendFontFace:FONT,catAxisLabelColor:"535353",catAxisLabelFontSize:10,
    dataLabelFontSize:10,dataLabelColor:"2B2F28",valGridLine:{style:"none"},catGridLine:{style:"none"},catAxisLineShow:false,valAxisLineShow:false,valAxisHidden:true};
  function content(kicker,title){
    const sl=pres.addSlide(), no=pres.slides.length; sl.background={color:"FFFFFF"};
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
  const heading=(sl,x,y,w,t,sub)=>{ txt(sl,t,{x:X(x),y:X(y),w:X(w),h:0.28,fontSize:13,bold:true,color:"274E13"}); if(sub) txt(sl,sub,{x:X(x),y:X(y+24),w:X(w),h:0.25,fontSize:9.5,color:"7A8373",fit:"shrink"}); };
  const kpi=(sl,x,y,w,h,k)=>{ box(sl,x,y,w,h,k.hot?"4A653B":"FFFFFF");
    txt(sl,[{text:k.v,options:{fontSize:28,bold:true,color:k.hot?"FFFFFF":"274E13"}},{text:k.u,options:{fontSize:14,bold:true,color:k.hot?"FFFFFF":"4A653B"}}],{x:X(x+16),y:X(y+12),w:X(w-32),h:0.5});
    txt(sl,k.l,{x:X(x+16),y:X(y+56),w:X(w-32),h:X(h-62),fontSize:9.5,color:k.hot?"E4ECDD":"535353",fit:"shrink"}); };
  const hbar=(sl,items,x,y,w,h,{colors=["4A653B"],names=["Value"],fmt="0",legend=false,stacked=false,max}={})=>{
    if(!items.length) return txt(sl,"Not in this data",{x:X(x),y:X(y+h/2-10),w:X(w),h:0.3,fontSize:11,color:"7A8373",align:"center"});
    const it=items.slice().reverse(), lab=it.map(i=>i.k.length>40?i.k.slice(0,39)+"…":i.k);
    const data=names.map((nm,si)=>({name:nm,labels:lab,values:it.map(i=>stacked?(i.s[si]||0):i.v)}));
    sl.addChart(pres.charts.BAR,data,{...base,x:X(x),y:X(y),w:X(w),h:X(h),barDir:"bar",barGrouping:stacked?"stacked":"clustered",chartColors:colors,showValue:true,
      dataLabelPosition:stacked?"ctr":"outEnd",dataLabelColor:stacked?"FFFFFF":"2B2F28",dataLabelFormatCode:stacked?"0;;;":fmt,showLegend:legend,legendPos:"t",legendFontSize:9.5,legendColor:"535353",
      barGapWidthPct:50,valAxisMinVal:0,...(stacked?{}:{valAxisMaxVal:(max||Math.max(...it.map(i=>i.v)))*1.25})}); };
  const table=(sl,head,rows,x,y,w,colW,o={})=>{ const hd=head.map(t=>({text:t,options:{bold:true,color:"FFFFFF",fill:{color:"4A653B"},fontSize:9.5}}));
    sl.addTable([hd,...rows.map(r=>r.map(c=>typeof c==="object"?c:{text:String(c)}))],{x:X(x),y:X(y),w:X(w),colW:colW&&colW.map(X),fontFace:FONT,fontSize:9,color:"2B2F28",border:{type:"solid",pt:0.5,color:"DCE2D6"},valign:"middle",margin:0.045,autoPage:false,...o}); };
  const R={align:"right"};

  // Cover
  { const sl=pres.addSlide();
    sl.addImage({data:imgData(IMG.cover),x:0,y:0,w:13.333,h:7.5,sizing:{type:"cover",w:13.333,h:7.5}});
    sl.addImage({data:imgData(IMG.wm),x:X(66),y:X(62),w:X(247),h:X(81)});
    sl.addShape(pres.shapes.RECTANGLE,{x:X(498),y:X(362),w:X(782),h:X(257),fill:{color:"4A653B"},line:{color:"4A653B",width:0}});
    sl.addShape(pres.shapes.OVAL,{x:X(371),y:X(362),w:X(257),h:X(257),fill:{color:"4A653B"},line:{color:"4A653B",width:0}});
    sl.addImage({data:imgData(IMG.logo),x:X(388),y:X(379),w:X(222),h:X(222)});
    txt(sl,N.team,{x:X(652),y:X(380),w:X(590),h:0.5,fontSize:26,bold:true,color:"F5D347"});
    txt(sl,N.title,{x:X(652),y:X(430),w:X(590),h:1.1,fontSize:34,bold:true,color:"FFFFFF",fit:"shrink"});
    txt(sl,`${N.period} · ${N.meta}`,{x:X(652),y:X(630),w:X(600),h:0.3,fontSize:12,bold:true,color:"FFFFFF"}); }

  // Executive summary
  { const sl=content("Executive summary",N.headline);
    N.kpis.forEach((k,i)=>kpi(sl,80+i*274,180,256,118,k));
    box(sl,80,316,650,326);
    txt(sl,N.findings.flatMap((x,i)=>[{text:x[0],options:{fontSize:13,bold:true,color:"274E13",bullet:{code:"25CF"},breakLine:true}},
      {text:x[1],options:{fontSize:10.5,color:"535353",indentLevel:1,breakLine:i<N.findings.length-1,paraSpaceAfter:9}}]),{x:X(100),y:X(334),w:X(612),h:X(292),fit:"shrink"});
    box(sl,750,316,410,326,"274E13");
    txt(sl,[{text:"BOTTOM LINE",options:{fontSize:9.5,bold:true,color:"F5D347",charSpacing:2,breakLine:true,paraSpaceAfter:8}},
      {text:N.bottom.p,options:{fontSize:16,bold:true,color:"FFFFFF",breakLine:true,paraSpaceAfter:10}},{text:N.bottom.s,options:{fontSize:10.5,color:"D8E3CF"}}],{x:X(774),y:X(338),w:X(362),h:X(286),fit:"shrink"}); }

  // Success story
  if(A.won.length){ const sl=content("Success story",N.winTitle);
    box(sl,80,180,400,462); heading(sl,100,196,360,`How the ${A.won.length} wins happened`,"Share of CRM engagements that ended in an order");
    ["channel","source"].forEach((k,i)=>{ const c=countBy(A.won,r=>r[k]).slice(0,3); if(!c.length) return;
      txt(sl,LABEL[k].toUpperCase(),{x:X(100),y:X(250+i*190),w:X(360),h:0.2,fontSize:8.5,bold:true,color:"7A8373",charSpacing:1});
      hbar(sl,c.map(([g,v])=>({k:g,v})),96,266+i*190,368,160,{max:A.won.length}); });
    if(A.has.sales){ const nw=A.linkedOrders.filter(o=>o.isNew).length;
      [{v:`${A.wonLinked.length}`,u:`/${A.won.length}`,l:"Wins confirmed in sales data",hot:true},{v:rpParts(A.linkedGmv)[0],u:rpParts(A.linkedGmv)[1],l:`GMV of ${A.linkedOrders.length} matched orders`},
       {v:String(nw),u:`/${A.linkedOrders.length}`,l:"Matched orders from new customers"}].forEach((k,i)=>kpi(sl,498+i*224,180,210,104,k));
      box(sl,498,298,662,344);
      table(sl,["Order","PIC","Products","GMV","Customer"],A.linkedOrders.slice(0,5).map(o=>[o.no,o.pic||"–",o.items.slice(0,2).join(", ")+(o.items.length>2?` +${o.items.length-2}`:""),{text:rp(o.gmv),options:R},o.isNew?{text:"New",options:{bold:true,color:"6B4F00",fill:{color:"FBEFC4"}}}:"Repeat"]),
        512,312,634,[86,118,270,80,80]);
      txt(sl,"Matched by phone number, then order number in the notes, then name and PIC.",{x:X(512),y:X(612),w:X(634),h:0.22,fontSize:8.5,color:"7A8373"});
    } else { box(sl,498,180,662,462); table(sl,["ID","PIC","Channel","Source","Notes"],A.won.slice(0,8).map(r=>[r.id||"–",r.pic||"–",r.channel||"–",r.source||"–",(r.detail||"").slice(0,60)]),512,196,634,[90,110,100,90,244]); } }

  // Sales last week
  if(A.has.sales){ const sl=content("Sales last week",N.salesTitle), O=A.orders, rep=O.filter(o=>!o.isNew).length;
    const newG=A.newOrders.reduce((s,o)=>s+o.gmv,0), parG=A.partial.reduce((s,o)=>s+o.gmv,0), ncG=A.noCrm.reduce((s,o)=>s+o.gmv,0);
    box(sl,80,180,400,462); heading(sl,100,196,360,"GMV by product","Top items across all orders, Rp million");
    hbar(sl,A.byItem.slice(0,6).map(([k,v])=>({k,v:Math.round(v/1e5)/10})),96,248,368,384,{fmt:'0.0"M"'});
    box(sl,496,180,370,462); heading(sl,516,196,330,"GMV by PIC","Rp million; orders in brackets");
    hbar(sl,A.byPic.slice(0,6).map(x=>({k:`${x.p} (${x.n})`,v:Math.round(x.g/1e5)/10})),512,248,338,384,{fmt:'0.0"M"',colors:["6E8F5A"]});
    [{v:String(pct(rep,O.length)),u:"%",l:`Repeat-customer orders; ${A.newOrders.length} new customers worth ${rp(newG)}`},
     {v:String(A.noCrm.length),u:`/${O.length}`,l:`Orders with no CRM engagement (${rp(ncG)})`,hot:A.noCrm.length/O.length>=.3},
     A.partial.length?{v:String(A.partial.length),u:"",l:`Partially paid orders worth ${rp(parG)}`}:{v:String(pct(A.top2,A.gmv)),u:"%",l:"of GMV from the top 2 orders"}]
     .forEach((k,i)=>kpi(sl,882,180+i*158,278,146,k)); }

  // Why leads say no
  if(A.notWon.length){ const sl=content("Why leads say no",N.reasonTitle);
    box(sl,80,180,520,462); heading(sl,100,196,480,"Reasons, grouped by what would fix them",`${A.notWon.length} engagements that did not order`);
    hbar(sl,A.themes.slice().sort((a,b)=>b.n-a.n).map(t=>({k:t.t,s:[t.lost,t.warm]})),96,248,488,380,{stacked:true,names:["Not interested","Considering / prospect"],colors:["8E9C84","D9A21B"],legend:true});
    box(sl,620,180,540,462); heading(sl,640,196,500,"What the discussion notes say","Signals read from the CRM notes, by lead status");
    if(A.signals.length) hbar(sl,A.signals.slice(0,6).map(x=>({k:x.label,s:[x.lost,x.warm]})),636,248,508,380,{stacked:true,names:["Not interested","Considering / prospect"],colors:["8E9C84","D9A21B"],legend:true});
    else txt(sl,"No discussion notes in this data",{x:X(640),y:X(400),w:X(500),h:0.3,fontSize:11,color:"7A8373",align:"center"}); }

  // What separates winners
  if(N.driver){ const D=N.driver, sl=content("What separates winners",`${D.dim} decides the outcome. ${N.driverTitle}`), gs=A.best.groups.filter(x=>x.g!=="(not filled)");
    box(sl,80,180,400,340); heading(sl,100,196,360,`Share ${A.posLabel}, by ${lc(D.dim)}`,`${A.crm.filter(r=>r.outcome).length} CRM engagements with a status`);
    hbar(sl,gs.map(g=>({k:`${g.g} (${g.w}/${g.n})`,v:Math.round(g.rate*100)})),96,248,368,262,{fmt:'0"%"',max:100});
    box(sl,496,180,664,340);
    const cw=Math.floor(504/A.cohorts.length);
    table(sl,["Most common",...A.cohorts.map(([c,rs])=>`${c} (${rs.length})`)],A.profile.map(p=>[{text:LABEL[p.k],options:{bold:true,color:"7A8373"}},...p.vals.map(v=>`${v.v}  ${Math.round(v.share*100)}%`)]),512,196,632,[128,...A.cohorts.map(()=>cw)]);
    box(sl,80,536,1080,104,"FBEFC4"); txt(sl,strip(N.caveat),{x:X(100),y:X(548),w:X(1040),h:X(80),fontSize:10.5,color:"5A4600",valign:"middle",fit:"shrink"}); }

  // Recoverable demand
  if(A.warm.length){ const sl=content("Recoverable demand",N.warmTitle), SL=Object.fromEntries(SIGNALS.map(s=>[s[0],s[1]]));
    [{v:String(A.warm.length),u:"",l:"Considering or prospect",hot:true},{v:String(A.intentWarm.length),u:"",l:"Asked about warehouse, delivery or price"},
     {v:String(A.warm.filter(r=>/unable|tidak bisa/i.test(r.callResp||"")).length),u:"",l:"Could not be reached by phone"},{v:String(A.stockRows.length),u:"",l:"Stalled on stock or delivery time"}].forEach((k,i)=>kpi(sl,80+i*274,180,256,104,k));
    box(sl,80,300,1080,342);
    table(sl,["ID","PIC","Channel","Status","What they asked or said"],A.warm.slice().sort((a,b)=>b.signals.length-a.signals.length).slice(0,5).map(r=>[r.id||"–",r.pic||"–",r.channel||"–",{text:r.status,options:{bold:true,color:"6B4F00",fill:{color:"FBEFC4"}}},r.signals.map(s=>SL[s]).join("; ")||r.reason||"–"]),96,316,1048,[110,140,130,120,548]);
    txt(sl,"Names and phone numbers are left out; look leads up by ID in the CRM.",{x:X(96),y:X(612),w:8,h:0.22,fontSize:8.5,color:"7A8373"}); }

  // Next steps
  { const sl=content("Next steps",`${N.actions.length} actions for the coming week`);
    N.actions.forEach((a,i)=>{ const x=80+(i%2)*548, y=180+Math.floor(i/2)*205; box(sl,x,y,532,190);
      txt(sl,[{text:`${i+1}  `,options:{color:"D9A21B",bold:true,fontSize:12}},{text:a.t,options:{color:"274E13",bold:true,fontSize:13}}],{x:X(x+20),y:X(y+16),w:X(492),h:0.3,fit:"shrink"});
      txt(sl,a.d,{x:X(x+20),y:X(y+48),w:X(492),h:X(96),fontSize:10.5,color:"535353",fit:"shrink"});
      txt(sl,[{text:`Owner: ${a.o}`,options:{bold:true,color:"274E13"}},{text:`     ${a.w}`,options:{bold:true,color:"9A6F00"}}],{x:X(x+20),y:X(y+154),w:X(492),h:0.25,fontSize:9.5}); });
    if(N.gaps.length) txt(sl,[{text:"Also clean up in the CRM: ",options:{bold:true,color:"274E13"}},{text:N.gaps.join("; ")+"."}],{x:X(80),y:X(600),w:X(1080),h:X(40),fontSize:10,color:"535353",fit:"shrink"}); }

  // Closing
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
  return `SawitPRO Sales and Leads Review ${t}`; }
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
