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

function buildPptx(T,DX){
  const pres=new PptxGenJS(); pres.layout="LAYOUT_WIDE"; pres.title=DX.title; pres.company="SawitPRO";
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
  // Bar charts are drawn from plain shapes and text boxes, not native charts: Google Slides drops the
  // category labels of imported PPTX charts (showing 1, 2, 3 …) and shows an embedded-workbook preview.
  const fmtOf=f=>f==='0.0"M"'?v=>`Rp${(Math.round(v*10)/10).toLocaleString("en-US")}M`:f==='0"%"'?v=>`${v}%`:v=>nf.format(v);
  const rect=(sl,x,y,w,h,c)=>sl.addShape(pres.shapes.RECTANGLE,{x:X(x),y:X(y),w:X(Math.max(w,.5)),h:X(h),fill:{color:c},line:{color:c,width:0}});
  const hbar=(sl,items,x,y,w,h,{colors=["4A653B"],names=["Value"],fmt="0",legend=false,stacked=false,max}={})=>{
    if(!items.length) return txt(sl,"Not in this data",{x:X(x),y:X(y+h/2-10),w:X(w),h:0.3,fontSize:11,color:"7A8373",align:"center"});
    const F=fmtOf(fmt), tot=it=>stacked?it.s.reduce((a,b)=>a+(b||0),0):it.v;
    if(legend&&stacked){ let lx=x; names.forEach((nm,i)=>{ if(!items.some(it=>it.s[i])) return; rect(sl,lx,y+3,10,10,colors[i]);
        txt(sl,nm,{x:X(lx+14),y:X(y),w:X(nm.length*6+10),h:X(16),fontSize:9,color:"535353",valign:"middle"}); lx+=nm.length*6+34; }); y+=26; h-=26; }
    const top=max||Math.max(...items.map(tot))||1, n=items.length, rh=Math.min(52,h/n), bh=Math.max(8,Math.min(12,rh*.28)), lh=rh-bh-6;
    items.forEach((it,i)=>{ const ry=y+i*rh, by=ry+lh+2;
      txt(sl,it.k,{x:X(x),y:X(ry),w:X(w-96),h:X(lh),fontSize:10,color:"2B2F28",valign:"bottom",fit:"shrink"});
      txt(sl,F(tot(it)),{x:X(x+w-96),y:X(ry),w:X(96),h:X(lh),fontSize:10,bold:true,color:"2B2F28",align:"right",valign:"bottom"});
      rect(sl,x,by,w,bh,"E9EDE5");
      let bx=x; (stacked?it.s.map((v,si)=>[v||0,colors[si]]):[[it.v,colors[0]]]).forEach(([v,c])=>{ if(!v) return; const bw=w*v/top;
        rect(sl,bx,by,bw-(stacked?1.5:0),bh,c);
        if(stacked&&bw>=18&&bh>=10) txt(sl,String(v),{x:X(bx),y:X(by),w:X(bw),h:X(bh),fontSize:7.5,bold:true,color:"FFFFFF",align:"center",valign:"middle"});
        bx+=bw; }); }); };
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
    txt(sl,DX.eyebrow,{x:X(652),y:X(380),w:X(590),h:0.5,fontSize:26,bold:true,color:"F5D347"});
    txt(sl,DX.title,{x:X(652),y:X(430),w:X(590),h:1.1,fontSize:34,bold:true,color:"FFFFFF",fit:"shrink"});
    txt(sl,`${DX.period} · ${DX.meta}`,{x:X(652),y:X(630),w:X(600),h:0.3,fontSize:12,bold:true,color:"FFFFFF"}); }

  // Executive summary
  { const sl=content("Executive summary",DX.headline);
    DX.kpis.forEach((k,i)=>kpi(sl,80+i*274,180,256,118,k));
    box(sl,80,316,650,326);
    txt(sl,DX.findings.flatMap((x,i)=>[{text:x[0],options:{fontSize:13,bold:true,color:"274E13",bullet:{code:"25CF"},breakLine:true}},
      {text:x[1],options:{fontSize:10.5,color:"535353",indentLevel:1,breakLine:i<DX.findings.length-1,paraSpaceAfter:9}}]),{x:X(100),y:X(334),w:X(612),h:X(292),fit:"shrink"});
    box(sl,750,316,410,326,"274E13");
    txt(sl,[{text:"BOTTOM LINE",options:{fontSize:9.5,bold:true,color:"F5D347",charSpacing:2,breakLine:true,paraSpaceAfter:8}},
      {text:DX.bottom.p,options:{fontSize:16,bold:true,color:"FFFFFF",breakLine:true,paraSpaceAfter:10}},{text:DX.bottom.s,options:{fontSize:10.5,color:"D8E3CF"}}],{x:X(774),y:X(338),w:X(362),h:X(286),fit:"shrink"}); }

  // Teams at a glance
  if(DX.multi&&!DX.trend){ const sl=content("Teams at a glance",DX.cmpTitle), tot=T.reduce((s,t)=>s+t.A.gmv,0), TC=["274E13","D9A21B","6E8F5A","5B7F95"];
    if(tot){ box(sl,80,180,1080,96); heading(sl,100,192,600,"Share of GMV");
      let x=100; T.forEach((t,i)=>{ const w=Math.max(4,1040*t.A.gmv/tot); sl.addShape(pres.shapes.RECTANGLE,{x:X(x),y:X(222),w:X(w-2),h:X(38),fill:{color:TC[i]},line:{color:TC[i],width:0}});
        if(t.A.gmv/tot>.12) txt(sl,`${t.name} · ${rp(t.A.gmv)} (${pct(t.A.gmv,tot)}%)`,{x:X(x+10),y:X(222),w:X(w-20),h:X(38),fontSize:11,bold:true,color:"FFFFFF",valign:"middle"});
        else txt(sl,`${t.name} ${pct(t.A.gmv,tot)}%`,{x:X(x-150),y:X(262),w:X(150+w),h:X(14),fontSize:8.5,color:"535353",align:"right"});
        x+=w; }); }
    const y0=tot?292:180; box(sl,80,y0,1080,642-y0);
    const hd=t=>({text:t,options:{bold:true,color:"FFFFFF",fill:{color:"4A653B"},fontSize:10}});
    sl.addTable([[hd(""),...T.map(t=>hd(t.name))],...DX.cmpRows.map(([k,v])=>[{text:k,options:{bold:true,color:"7A8373"}},...v.map(x=>({text:x}))])],
      {x:X(96),y:X(y0+14),w:X(1048),colW:[X(260),...T.map(()=>X(788/T.length))],fontFace:FONT,fontSize:10,color:"2B2F28",border:{type:"solid",pt:0.5,color:"DCE2D6"},valign:"middle",margin:0.05,autoPage:false}); }

  // One section per team
  T.forEach((t,i)=>{
    if(DX.multi){ const sl=pres.addSlide();
      sl.addImage({data:imgData(IMG.divider),x:0,y:0,w:13.333,h:7.5,sizing:{type:"cover",w:13.333,h:7.5}});
      txt(sl,`Team ${i+1}`,{x:X(131),y:X(300),w:X(820),h:0.6,fontSize:28,bold:true,color:"F5D347"});
      txt(sl,t.name,{x:X(131),y:X(350),w:X(900),h:1.1,fontSize:54,bold:true,color:"FFFFFF"});
      txt(sl,[t.A.has.sales&&`${rp(t.A.gmv)} from ${t.A.orders.length} orders`,t.A.crm.length&&`${t.A.crm.length} CRM engagements`].filter(Boolean).join(" · "),{x:X(131),y:X(460),w:X(900),h:0.4,fontSize:16,bold:true,color:"E4ECDD"});
      txt(sl,String(i+1).padStart(2,"0"),{x:X(900),y:X(500),w:X(300),h:X(170),fontSize:130,bold:true,color:"FFFFFF",transparency:85,align:"right"}); }
    teamBlock(t.A,t.N,DX.multi?`${t.name} · `:"");
    if(t.C&&t.NC) teamBlock(t.C,t.NC,`${DX.multi?`${t.name} · `:""}CRM ${crmSpan(t.C)} · `);
  });

  // Draw chart primitives (see viz.js) as plain shapes and text boxes.
  function draw(sl,P,ox,oy){ P.forEach(p=>{
    if(p.t==="r"){ const w=Math.max(p.w,.6), h=Math.max(p.h,.6), r=Math.min(p.r||0,w/2,h/2);
      sl.addShape(r>=1.5?pres.shapes.ROUNDED_RECTANGLE:pres.shapes.RECTANGLE,{x:X(ox+p.x),y:X(oy+p.y),w:X(w),h:X(h),fill:{color:H(p.fill)},line:{color:H(p.fill),width:0},...(r>=1.5?{rectRadius:X(r)}:{})}); }
    else if(p.t==="l"){ const x=Math.min(p.x1,p.x2), y=Math.min(p.y1,p.y2), up=(p.x2-p.x1)*(p.y2-p.y1)<0;
      sl.addShape(pres.shapes.LINE,{x:X(ox+x),y:X(oy+y),w:X(Math.abs(p.x2-p.x1)),h:X(Math.abs(p.y2-p.y1)),flipV:up,line:{color:H(p.color),width:p.sw*.75,dashType:p.dash?"dash":"solid"}}); }
    else if(p.t==="d") sl.addShape(pres.shapes.OVAL,{x:X(ox+p.cx-p.rad),y:X(oy+p.cy-p.rad),w:X(p.rad*2),h:X(p.rad*2),fill:{color:H(p.fill)},line:{color:"FFFFFF",width:1.5}});
    else if(p.t==="t") txt(sl,p.s,{x:X(ox+p.x),y:X(oy+p.y),w:X(Math.max(p.w,8)),h:X(Math.max(p.h,8)),fontSize:Math.round(p.size*.75*10)/10,bold:p.bold,color:H(p.color),align:p.align,valign:p.valign==="middle"?"middle":p.valign,lineSpacingMultiple:.95});
  }); }
  function cellOf(v){ const o=typeof v==="object"&&v?v:{v}; return {text:String(o.v),options:o.pill?{bold:true,color:"6B4F00",fill:{color:"FBEFC4"}}:o.bold?{bold:true,color:"274E13"}:{}}; }
  function panelSlide(spec){
    const sl=content(spec.kicker,spec.title), L=layoutPanels(spec), ox=80, oy=180;
    L.cells.forEach(c=>{
      if(c.kpi) return kpi(sl,ox+c.x,oy+c.y,c.w,c.h,c.kpi);
      box(sl,ox+c.x,oy+c.y,c.w,c.h);
      if(c.title) heading(sl,ox+c.x+20,oy+c.y+16,c.w-40,c.title,c.sub); else if(c.sub) txt(sl,c.sub,{x:X(ox+c.x+20),y:X(oy+c.y+16),w:X(c.w-40),h:0.25,fontSize:9.5,color:"7A8373"});
      const I=c.inner;
      if(c.chart) draw(sl,layoutChart(c.chart,I.w,I.h),ox+c.x+I.x,oy+c.y+I.y);
      else if(c.table){ const T=c.table, al=i=>T.align?.[i]==="r"?"right":T.align?.[i]==="c"?"center":"left";
        const hd=T.head.map((h,i)=>({text:h,options:{bold:true,color:"FFFFFF",fill:{color:"4A653B"},fontSize:9,align:al(i)}}));
        sl.addTable([hd,...T.rows.map(r=>r.map((v,i)=>{ const c2=cellOf(v); c2.options={...c2.options,align:al(i)}; return c2; }))],
          {x:X(ox+c.x+I.x-6),y:X(oy+c.y+I.y),w:X(I.w+12),colW:(()=>{ const w=colWeights(T), t=w.reduce((a,b)=>a+b,0); return w.map(x=>X((I.w+12)*x/t)); })(),fontFace:FONT,fontSize:9,color:"2B2F28",border:{type:"solid",pt:0.5,color:"DCE2D6"},valign:"middle",margin:0.04,autoPage:false}); }
      if(c.foot) txt(sl,c.foot,{x:X(ox+c.x+20),y:X(oy+c.y+c.h-c.fh-6),w:X(c.w-40),h:X(c.fh),fontSize:9.2,color:"535353",valign:"bottom",fit:"shrink"});
    });
    if(L.notes){ box(sl,ox,oy+L.notes.y,1080,L.notes.h,"FBEFC4");
      txt(sl,L.notes.list.map((t,i)=>({text:strip(t),options:{breakLine:i<L.notes.list.length-1,paraSpaceAfter:3}})),{x:X(ox+18),y:X(oy+L.notes.y+9),w:X(1044),h:X(L.notes.h-18),fontSize:9.3,color:"5A4600",valign:"middle",fit:"shrink"}); }
  }
  function teamBlock(A,N,pre){ teamSpecs(A,N,pre).forEach(panelSlide); }

  // Next steps
  { const sl=content("Next steps",`${DX.actions.length} actions ${DX.trend?"to recover sales":"for the coming week"}`);
    const nc=DX.actions.length>4?3:2, cw=nc===3?(1080-2*14)/3:532, gap=nc===3?14:16;
    DX.actions.forEach((a,i)=>{ const x=80+(i%nc)*(cw+gap), y=180+Math.floor(i/nc)*205; box(sl,x,y,cw,190);
      txt(sl,[{text:`${i+1}  `,options:{color:"D9A21B",bold:true,fontSize:12}},{text:a.t,options:{color:"274E13",bold:true,fontSize:nc===3?12:13}}],{x:X(x+18),y:X(y+14),w:X(cw-36),h:X(40),fit:"shrink"});
      txt(sl,a.d,{x:X(x+18),y:X(y+56),w:X(cw-36),h:X(92),fontSize:nc===3?9.5:10.5,color:"535353",fit:"shrink"});
      txt(sl,[...(a.team?[{text:`${a.team}  ·  `,options:{bold:true,color:"4A653B"}}]:[]),{text:`Owner: ${a.o}`,options:{bold:true,color:"274E13"}},{text:`  ·  ${a.w}`,options:{bold:true,color:"9A6F00"}}],{x:X(x+18),y:X(y+156),w:X(cw-36),h:0.25,fontSize:9}); });
    if(DX.gaps.length) txt(sl,[{text:"Also clean up in the CRM: ",options:{bold:true,color:"274E13"}},{text:DX.gaps.join("; ")+"."}],{x:X(80),y:X(600),w:X(1080),h:X(40),fontSize:10,color:"535353",fit:"shrink"}); }

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

function deckName(){ const d=state.X?.dates||[]; const t=d.length?`${d[0].getFullYear()}-${String(d[0].getMonth()+1).padStart(2,"0")}-${String(d[0].getDate()).padStart(2,"0")}`:"data";
  return `SawitPRO ${state.X?.multi?"Smallholder and Plantation":(state.T?.[0]?.name||"Sales")} Review ${t}`; }
async function makeBlob(){ await loadPptx(); return buildPptx(state.T,state.X).write({outputType:"blob"}); }
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
