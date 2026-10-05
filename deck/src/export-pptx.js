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
  if(DX.multi){ const sl=content("Teams at a glance",DX.cmpTitle), tot=T.reduce((s,t)=>s+t.A.gmv,0), TC=["274E13","D9A21B","6E8F5A","5B7F95"];
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
  });

  function teamBlock(A,N,pre){
  // Success story
  if(A.won.length){ const sl=content(pre+"Success story",N.winTitle);
    box(sl,80,180,400,462); heading(sl,100,196,360,`How the ${A.won.length} wins happened`,"Share of CRM engagements that ended in an order");
    ["channel","source"].forEach((k,i)=>{ const c=countBy(A.won,r=>r[k]).slice(0,3); if(!c.length) return;
      txt(sl,LABEL[k].toUpperCase(),{x:X(100),y:X(250+i*190),w:X(360),h:0.2,fontSize:8.5,bold:true,color:"7A8373",charSpacing:1});
      hbar(sl,c.map(([g,v])=>({k:g,v})),96,266+i*190,368,160,{max:A.won.length}); });
    if(A.has.sales){ const nw=A.linkedOrders.filter(o=>o.isNew).length;
      [{v:`${A.wonLinked.length}`,u:`/${A.won.length}`,l:"Wins confirmed in sales data",hot:true},{v:rpParts(A.linkedGmv)[0],u:rpParts(A.linkedGmv)[1],l:`GMV of ${A.linkedOrders.length} matched orders`},
       A.hasCustStatus?{v:String(nw),u:`/${A.linkedOrders.length}`,l:"Matched orders from new customers"}:{v:String(A.wonFromNotes.length||A.won.length),u:`/${A.won.length}`,l:A.wonFromNotes.length?"Wins found only in the notes (“Closing …”)":"Wins with a CRM status of ordered"}].forEach((k,i)=>kpi(sl,498+i*224,180,210,104,k));
      box(sl,498,298,662,344);
      table(sl,["Order","PIC","Products","GMV","Customer"],A.linkedOrders.slice(0,5).map(o=>[o.no,o.pic||"–",o.items.slice(0,2).join(", ")+(o.items.length>2?` +${o.items.length-2}`:""),{text:rp(o.gmv),options:R},!A.hasCustStatus?"–":o.isNew?{text:"New",options:{bold:true,color:"6B4F00",fill:{color:"FBEFC4"}}}:"Repeat"]),
        512,312,634,[86,118,270,80,80]);
      txt(sl,"Matched by phone number, then order number in the notes, then name and PIC.",{x:X(512),y:X(612),w:X(634),h:0.22,fontSize:8.5,color:"7A8373"});
    } else { box(sl,498,180,662,462); table(sl,["ID","PIC","Channel","Source","Notes"],A.won.slice(0,8).map(r=>[r.id||"–",r.pic||"–",r.channel||"–",r.source||"–",(r.detail||"").slice(0,60)]),512,196,634,[90,110,100,90,244]); } }

  // Sales: what sold
  if(A.has.sales){ const O=A.orders, Q=A.qtyTotal||1, F0=A.byFamily[0], sp=A.priceSpread[0], pair=A.pairs[0];
    const sl=content(pre+"Sales last week · what sold",N.soldTitle);
    box(sl,80,180,410,462); heading(sl,100,196,370,"GMV by product type","Rp million, grouped from item names");
    hbar(sl,A.byFamily.slice(0,7).map(x=>({k:`${x.k} (${nf.format(x.qty)})`,v:Math.round(x.gmv/1e5)/10})),96,248,378,384,{fmt:'0.0"M"'});
    box(sl,506,180,410,462); heading(sl,526,196,370,"GMV by product category","Rp million; orders in brackets");
    hbar(sl,A.byCat.slice(0,7).map(x=>({k:`${x.k} (${x.orders})`,v:Math.round(x.gmv/1e5)/10})),522,248,378,330,{fmt:'0.0"M"',colors:["6E8F5A"]});
    if(N.catLine) txt(sl,N.catLine,{x:X(526),y:X(586),w:X(370),h:X(46),fontSize:9.5,color:"535353",fit:"shrink"});
    const k3=[F0&&(A.unitsAnchor?{v:String(pct(F0.qty,Q)),u:"%",l:`of all units sold are ${F0.k} (${nf.format(F0.qty)} of ${nf.format(Q)})`,hot:true}:{v:String(pct(F0.gmv,A.gmv)),u:"%",l:`of GMV is ${F0.k}`,hot:true}),
      {v:A.itemsPerOrder.toFixed(1),u:"",l:`products per order; ${A.multiFamily} of ${O.length} orders mix product types${pair?`, most often ${pair[0]}`:""}`},
      sp&&sp.spread>=.05?{v:"+"+Math.round(sp.spread*100),u:"%",l:`price gap on ${sp.item} across ${sp.n} order lines (${rp(sp.min)}–${rp(sp.max)} per unit)`}:{v:rpParts(A.gmv/(O.length||1))[0],u:rpParts(A.gmv/(O.length||1))[1],l:"average order value"}].filter(Boolean);
    k3.forEach((k,i)=>kpi(sl,932,180+i*158,228,146,k));

    // Sales: who bought and how
    const s2=content(pre+"Sales last week · who bought and how",N.whoTitle), appName=k=>({WEB:"Web",PETANI:"Petani app","SAWITPRO-RETAIL":"SawitPRO retail","SAWITPRO-BISNIS":"SawitPRO bisnis"}[String(k).toUpperCase()]||k);
    box(s2,80,180,380,462);
    if(A.byRegion.length){ heading(s2,100,196,340,"GMV by customer region",`Rp million; customers in brackets. ${A.byProvince.map(p=>`${p.k} ${pct(p.gmv,A.gmv)}%`).join(" · ")}`);
      hbar(s2,A.byRegion.slice(0,7).map(x=>({k:`${x.k} (${x.cust})`,v:Math.round(x.gmv/1e5)/10})),96,248,348,330,{fmt:'0.0"M"'}); }
    else { heading(s2,100,196,340,"GMV by customer role","Rp million; orders in brackets. No region in this export");
      hbar(s2,A.byRole.map(x=>({k:`${roleName(x.k)} (${x.n})`,v:Math.round(x.gmv/1e5)/10})),96,248,348,330,{fmt:'0.0"M"'}); }
    if(N.regionNote&&A.byRegion.length) txt(s2,N.regionNote,{x:X(100),y:X(586),w:X(340),h:X(46),fontSize:9.5,color:"535353",fit:"shrink"});
    box(s2,476,180,440,462); heading(s2,496,196,400,"How they ordered","Average order value by channel and customer type");
    const segRows=(t,rows)=>[[t,"Orders","GMV","Avg order"].map((h,i)=>({text:h,options:{bold:true,color:"FFFFFF",fill:{color:"4A653B"},fontSize:9,align:i?"right":"left"}})),
      ...rows.map(x=>[{text:String(x.k)},{text:String(x.n),options:R},{text:rp(x.gmv),options:R},{text:rp(x.aov),options:R}])];
    const tOpt=y=>({x:X(492),y:X(y),w:X(408),colW:[X(150),X(66),X(96),X(96)],fontFace:FONT,fontSize:9,color:"2B2F28",border:{type:"solid",pt:0.5,color:"DCE2D6"},valign:"middle",margin:0.04,autoPage:false});
    let y=246; if(A.byApp.length){ s2.addTable(segRows("Channel",A.byApp.map(x=>({...x,k:appName(x.k)}))),tOpt(y)); y+=26*(A.byApp.length+1)+14; }
    if(A.byCust.length){ s2.addTable(segRows("Customer",A.byCust),tOpt(y)); y+=26*(A.byCust.length+1)+16; }
    txt(s2,"SALES PIC (ORDERS)",{x:X(496),y:X(y),w:X(400),h:0.2,fontSize:8.5,bold:true,color:"7A8373",charSpacing:1});
    hbar(s2,A.byPic.slice(0,4).map(x=>({k:`${x.p} (${x.n})`,v:Math.round(x.g/1e5)/10})),492,y+14,408,Math.max(120,630-y-14),{fmt:'0.0"M"',colors:["6E8F5A"]});
    const parG=A.partial.reduce((s,o)=>s+o.gmv,0), openG=A.openOrders.reduce((s,o)=>s+o.gmv,0), ncG=A.noCrm.reduce((s,o)=>s+o.gmv,0);
    [A.partial.length&&{v:rpParts(A.outstanding||parG)[0],u:rpParts(A.outstanding||parG)[1],l:A.outstanding?`still unpaid on ${A.partial.length} partially paid orders (${rp(parG)} GMV)`:`GMV on ${A.partial.length} partially paid orders`,hot:true},
     A.openOrders.length&&{v:String(A.openOrders.length),u:`/${O.length}`,l:`orders still open, not completed (${rp(openG)})`},
     A.has.crm?{v:String(A.noCrm.length),u:`/${O.length}`,l:`orders with no CRM engagement (${rp(ncG)})`}:{v:String(pct(A.top2,A.gmv)),u:"%",l:"of GMV from the top 2 orders"}].filter(Boolean)
     .forEach((k,i)=>kpi(s2,932,180+i*158,228,146,k)); }

  // Rejection reasons in detail
  if(A.reasonRows.length){ const sl=content(pre+"Rejection reasons last week",N.rrTitle), RL=A.reasonList.slice(0,7), dims=A.reasonDims;
    box(sl,80,180,520,462); heading(sl,100,196,480,"Every reason given",`${A.reasonRows.length} engagements that did not order`);
    hbar(sl,RL.map(r=>({k:r.k,s:[r.lost,r.warm,r.other]})),96,248,488,380,{stacked:true,names:["Not interested","Considering / prospect","No status"],colors:["8E9C84","D9A21B","C9CFC3"],legend:true});
    const cols=dims.flatMap(k=>countBy(A.reasonRows.filter(r=>r[k]),r=>r[k]).slice(0,3).map(([g])=>({k,g})));
    if(cols.length){ const v=(r,c)=>A.reasonRows.filter(x=>x.reason===r.k&&x[c.k]===c.g).length, mx=Math.max(1,...RL.flatMap(r=>cols.map(c=>v(r,c))));
      const shade=n=>{ if(!n) return "FFFFFF"; const t=.15+.85*n/mx, mix=(a,b)=>Math.round(a+(b-a)*t).toString(16).padStart(2,"0"); return (mix(255,74)+mix(255,101)+mix(255,59)).toUpperCase(); };
      const hd=t=>({text:t,options:{bold:true,color:"FFFFFF",fill:{color:"4A653B"},fontSize:8.5,align:"center"}});
      const rows=[[{text:"Reason",options:{bold:true,color:"FFFFFF",fill:{color:"4A653B"},fontSize:8.5}},...cols.map(c=>hd(`${LABEL[c.k]}: ${c.g}`))],
        ...RL.map(r=>[{text:r.k,options:{fontSize:8.5}},...cols.map(c=>{const n=v(r,c);return {text:n?String(n):"",options:{align:"center",bold:true,fill:{color:shade(n)},color:n/mx>.5?"FFFFFF":"2B2F28"}};})])];
      box(sl,620,180,540,300);
      sl.addTable(rows,{x:X(632),y:X(192),w:X(516),colW:[X(156),...cols.map(()=>X(360/cols.length))],fontFace:FONT,fontSize:8.5,color:"2B2F28",border:{type:"solid",pt:0.5,color:"DCE2D6"},valign:"middle",margin:0.04,autoPage:false}); }
    if(N.rrNotes.length){ box(sl,620,494,540,148,"FBEFC4"); txt(sl,N.rrNotes.map((t,i)=>({text:strip(t),options:{breakLine:i<N.rrNotes.length-1,paraSpaceAfter:5}})),{x:X(638),y:X(506),w:X(504),h:X(124),fontSize:9.5,color:"5A4600",fit:"shrink"}); } }

  // Why leads say no
  if(A.notWon.length){ const sl=content(pre+"What the reasons mean",N.reasonTitle);
    box(sl,80,180,520,462); heading(sl,100,196,480,"Reasons, grouped by what would fix them",`${A.notWon.length} engagements that did not order`);
    hbar(sl,A.themes.slice().sort((a,b)=>b.n-a.n).map(t=>({k:t.t,s:[t.lost,t.warm]})),96,248,488,380,{stacked:true,names:["Not interested","Considering / prospect"],colors:["8E9C84","D9A21B"],legend:true});
    box(sl,620,180,540,462); heading(sl,640,196,500,"What the discussion notes say","Signals read from the CRM notes, by lead status");
    if(A.signals.length) hbar(sl,A.signals.slice(0,6).map(x=>({k:x.label,s:[x.lost,x.warm]})),636,248,508,380,{stacked:true,names:["Not interested","Considering / prospect"],colors:["8E9C84","D9A21B"],legend:true});
    else txt(sl,"No discussion notes in this data",{x:X(640),y:X(400),w:X(500),h:0.3,fontSize:11,color:"7A8373",align:"center"}); }

  // What separates winners
  if(N.driver){ const D=N.driver, sl=content(pre+"What separates winners",`${D.dim} decides the outcome. ${N.driverTitle}`), gs=A.best.groups.filter(x=>x.g!=="(not filled)");
    box(sl,80,180,400,340); heading(sl,100,196,360,`Share ${A.posLabel}, by ${lc(D.dim)}`,`${A.crm.filter(r=>r.outcome).length} CRM engagements with a status`);
    hbar(sl,gs.map(g=>({k:`${g.g} (${g.w}/${g.n})`,v:Math.round(g.rate*100)})),96,248,368,262,{fmt:'0"%"',max:100});
    box(sl,496,180,664,340);
    const cw=Math.floor(504/A.cohorts.length);
    table(sl,["Most common",...A.cohorts.map(([c,rs])=>`${c} (${rs.length})`)],A.profile.map(p=>[{text:LABEL[p.k],options:{bold:true,color:"7A8373"}},...p.vals.map(v=>`${v.v}  ${Math.round(v.share*100)}%`)]),512,196,632,[128,...A.cohorts.map(()=>cw)]);
    box(sl,80,536,1080,104,"FBEFC4"); txt(sl,strip(N.caveat),{x:X(100),y:X(548),w:X(1040),h:X(80),fontSize:10.5,color:"5A4600",valign:"middle",fit:"shrink"}); }

  // Recoverable demand
  if(A.warm.length){ const sl=content(pre+"Recoverable demand",N.warmTitle), SL=Object.fromEntries(SIGNALS.map(s=>[s[0],s[1]]));
    [{v:String(A.warm.length),u:"",l:"Considering or prospect",hot:true},{v:String(A.intentWarm.length),u:"",l:"Asked about warehouse, delivery or price"},
     {v:String(A.warm.filter(r=>/unable|tidak bisa/i.test(r.callResp||"")).length),u:"",l:"Could not be reached by phone"},{v:String(A.stockRows.length),u:"",l:"Stalled on stock or delivery time"}].forEach((k,i)=>kpi(sl,80+i*274,180,256,104,k));
    box(sl,80,300,1080,342);
    table(sl,["ID","PIC","Channel","Status","What they asked or said"],A.warm.slice().sort((a,b)=>b.signals.length-a.signals.length).slice(0,5).map(r=>[r.id||"–",r.pic||"–",r.channel||"–",{text:r.status,options:{bold:true,color:"6B4F00",fill:{color:"FBEFC4"}}},r.signals.map(s=>SL[s]).join("; ")||r.reason||"–"]),96,316,1048,[110,140,130,120,548]);
    txt(sl,"Names and phone numbers are left out; look leads up by ID in the CRM.",{x:X(96),y:X(612),w:8,h:0.22,fontSize:8.5,color:"7A8373"}); }

  }

  // Next steps
  { const sl=content("Next steps",`${DX.actions.length} actions for the coming week`);
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
