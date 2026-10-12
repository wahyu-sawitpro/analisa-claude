/* ================= Charts: one geometry, drawn as SVG on the page and as shapes in the PPTX ================= */
// Every chart is laid out once as primitives (rect, line, dot, text) in slide pixels (1280x720 canvas).
// The page draws them as SVG; the PPTX draws the same primitives as plain shapes and text boxes, because
// Google Slides drops the labels of imported native charts.
const CAT=["#3E7B27","#D9A21B","#2B7BB0","#B85A28","#7B4FB0"];      // categorical order, validated for colour-blind separation on white
const RAMP=["#274E13","#3F6B2B","#5E8C47","#86AD6C","#B3CC9F"];     // ordinal green ramp (funnel steps, size bands)
const OUTC={won:"#274E13",warm:"#D9A21B",lost:"#8E9C84",none:"#C9CFC3"};
const THEME_C={"Just asking":"#D9A21B","Stock & delivery":"#B85A28","Price":"#2B7BB0","Timing":"#7B4FB0","Other":"#C9CFC3","Locked in elsewhere":"#5F6B57","Not a fit":"#A9B2A0"};
const CINK="#2B2F28", CMUTE="#7A8373", CGRID="#E3E8DE", CTRACK="#E9EDE5", CBASE="#B9C2B0";

const tw=(s,z)=>String(s).length*z*.56;
const cR=(x,y,w,h,fill,tip,r=3)=>({t:"r",x,y,w,h,fill,tip,r});
const cL=(x1,y1,x2,y2,color,sw=1,dash)=>({t:"l",x1,y1,x2,y2,color,sw,dash});
const cD=(cx,cy,rad,fill,tip)=>({t:"d",cx,cy,rad,fill,tip});
const cA=(pts,fill)=>({t:"a",pts,fill});
const cT=(x,y,w,h,s,o={})=>({t:"t",x,y,w,h,s:String(s),size:o.size||12,bold:!!o.bold,color:o.color||CINK,align:o.align||"left",valign:o.valign||"middle"});
function wrapTxt(s,maxW,z,ml=2){
  const out=[];
  for(const para of String(s).split("\n")){ let cur=""; for(const w of para.split(/\s+/)){ const t=cur?cur+" "+w:w; if(tw(t,z)>maxW&&cur){ out.push(cur); cur=w; } else cur=t; } out.push(cur); }
  if(out.length>ml){ out.length=ml; out[ml-1]+="…"; }
  return out.map(l=>tw(l,z)>maxW?l.slice(0,Math.max(1,Math.floor(maxW/(z*.56))-1))+"…":l).join("\n");
}
const hexRgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const mixC=(a,b,t)=>"#"+hexRgb(a).map((v,i)=>Math.round(v+(hexRgb(b)[i]-v)*t).toString(16).padStart(2,"0")).join("").toUpperCase();
const onC=c=>{ const [r,g,b]=hexRgb(c); return (r*299+g*587+b*114)/1000>150?CINK:"#FFFFFF"; };
function legendRow(P,items,W){ let x=0, y=0;
  items.forEach(it=>{ const w=tw(it.name,11.5)+30; if(x&&x+w-12>W){ x=0; y+=18; } P.push(cR(x,y+3,11,11,it.color,null,2)); P.push(cT(x+16,y,w-16,17,it.name,{size:11.5,color:"#535353"})); x+=w; });
  return y+22; }

// Horizontal bars: label above, value at the right, optional stacked segments [value, colour, tip].
function hbarChart(o,W,H){
  const P=[], I=o.items||[]; if(!I.length) return [cT(0,H/2-10,W,20,"Not in this data",{size:13,color:CMUTE,align:"center"})];
  const fmt=o.fmt||(v=>nf.format(v)), tot=it=>it.segs?it.segs.reduce((s,g)=>s+(g[0]||0),0):it.v;
  let top=0; if(o.legend) top=legendRow(P,o.legend,W)+4;
  const n=I.length, mx=o.max||Math.max(...I.map(tot))||1, rh=Math.min(o.rowH||46,(H-top)/n), bh=Math.max(8,Math.min(12,rh*.27)), lh=rh-bh-6;
  I.forEach((it,i)=>{ const y=top+i*rh, by=y+lh+2, vt=(o.vfmt||fmt)(tot(it)), wv=tw(vt,12.5)+4, wr=it.r?tw(it.r,11.5)+14:0;
    P.push(cT(0,y,W-wv-wr-6,lh,wrapTxt(it.k,W-wv-wr-6,12.5,1),{size:12.5,valign:"bottom"}));
    P.push(cT(W-wv,y,wv,lh,vt,{size:12.5,bold:true,align:"right",valign:"bottom"}));
    if(it.r) P.push(cT(W-wv-wr,y,wr-8,lh,it.r,{size:11.5,color:CMUTE,align:"right",valign:"bottom"}));
    P.push(cR(0,by,W,bh,CTRACK,null,3));
    let x=0; (it.segs||[[it.v,it.color||o.color||CAT[0],`${it.k}: ${vt}`]]).forEach(([v,c,tip])=>{ if(!v) return; const w=W*v/mx; P.push(cR(x,by,Math.max(2,w-(it.segs?2:0)),bh,c,tip||it.k,3));
      if(it.segs&&w>=20) P.push(cT(x,by,w-2,bh,String(v),{size:9.5,bold:true,color:onC(c),align:"center"})); x+=w; }); });
  return P;
}
// Vertical columns: one or more series (grouped or stacked), value on top, category under the axis.
function columnChart(o,W,H){
  const P=[], S=o.series, n=o.cats.length, fmt=o.fmt||(v=>nf.format(v)); let top=0;
  if(o.legend||S.length>1) top=legendRow(P,o.legend||S.map(s=>({name:s.name,color:s.color})),W)+4;
  const lblH=o.lblH||32, base=H-lblH, plotH=base-top-20;
  const tot=i=>o.stacked?S.reduce((s,se)=>s+(se.values[i]||0),0):Math.max(0,...S.map(se=>se.values[i]||0));
  const mx=o.max||Math.max(...o.cats.map((_,i)=>tot(i)))||1, band=W/n;
  const gw=Math.min(band*.62,o.stacked||S.length===1?70:S.length*34), bw=o.stacked?gw:(gw-(S.length-1)*3)/S.length;
  o.cats.forEach((c,i)=>{ const cx=band*i+band/2; let y=base; const cl=String(c).split("\n")[0];
    S.forEach((se,si)=>{ const v=se.values[i]||0; if(!v){ if(S.length===1&&!o.stacked&&o.labels!==false) P.push(cT(cx-30,base-18,60,16,(o.vfmt||fmt)(0,i,si),{size:11.5,bold:true,align:"center"})); return; } const h=Math.max(2,plotH*v/mx), col=se.colors?.[i]||se.color, tip=`${cl}${S.length>1?` · ${se.name}`:""}: ${fmt(v)}`;
      if(o.stacked){ P.push(cR(cx-gw/2,y-h,gw,Math.max(1.5,h-(y<base?2:0)),col,tip,3)); if(h>=16&&gw>=22) P.push(cT(cx-gw/2,y-h,gw,h,String(v),{size:10,bold:true,color:onC(col),align:"center"})); y-=h; }
      else { const x=cx-gw/2+si*(bw+3); P.push(cR(x,base-h,bw,h,col,tip,4));
        if(o.labels!==false) P.push(cT(x-24,base-h-18,bw+48,16,(o.vfmt||fmt)(v,i,si),{size:S.length>2?10:11.5,bold:true,align:"center"})); } });
    if(o.stacked&&o.labels!==false) P.push(cT(cx-40,y-18,80,16,(o.vfmt||fmt)(tot(i),i),{size:11.5,bold:true,align:"center"}));
    P.push(cT(band*i+1,base+5,band-2,lblH-5,wrapTxt(c,band-4,11,o.lblLines||3),{size:11,color:CINK,align:"center",valign:"top"})); });
  P.push(cL(0,base,W,base,CBASE,1));
  return P;
}
// Line: one axis only. Optional reference line, shaded area (page only) and selected point labels.
function lineChart(o,W,H){
  const P=[], S=o.series, n=o.cats.length, fmt=o.fmt||(v=>nf.format(v)); let top=0;
  if(S.length>1) top=legendRow(P,S.map(s=>({name:s.name,color:s.color})),W)+4;
  const left=40, right=12, lblH=22, base=H-lblH, plotH=base-top-20;
  const mx=o.max||Math.max(...S.flatMap(s=>s.values))*1.08||1, xs=i=>left+8+(n>1?i*(W-left-right-16)/(n-1):(W-left)/2), ys=v=>base-plotH*v/mx;
  [0,.5,1].forEach(f=>{ const y=base-plotH*f; P.push(cL(left,y,W-right,y,f?CGRID:CBASE,1)); P.push(cT(0,y-8,left-6,16,(o.axisFmt||fmt)(mx*f),{size:10.5,color:CMUTE,align:"right"})); });
  if(o.ref){ const y=ys(o.ref.v); P.push(cL(left,y,W-right,y,"#B5523B",1.2,true)); P.push(cT(W-right-190,y+3,190,14,o.ref.label,{size:10.5,bold:true,color:"#8A3A26",align:"right"})); }
  S.forEach(se=>{ const pts=se.values.map((v,i)=>[xs(i),ys(v||0)]);
    if(o.area) P.push(cA([[pts[0][0],base],...pts,[pts[pts.length-1][0],base]],se.color));
    for(let i=1;i<pts.length;i++) P.push(cL(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1],se.color,2.5));
    pts.forEach(([x,y],i)=>{ P.push(cD(x,y,n>14?3.5:4.5,se.color,`${String(o.cats[i]).replace("\n"," ")}${S.length>1?` · ${se.name}`:""}: ${fmt(se.values[i]||0)}`));
      if(o.show==="all"||(o.show||[n-1]).includes(i)) P.push(cT(x-45,y-24,90,16,(o.vfmt||fmt)(se.values[i]||0,i),{size:11.5,bold:true,align:"center"})); }); });
  o.cats.forEach((c,i)=>{ if(!c||(o.xEvery&&i%o.xEvery&&i!==n-1)) return; P.push(cT(xs(i)-40,base+5,80,lblH-4,c,{size:10.5,color:CMUTE,align:"center",valign:"top"})); });
  return P;
}
// Unit chart: one square per lead, grouped (e.g. recoverable vs closed), legend with counts.
function waffleChart(o,W,H){
  const P=[], G=o.groups.filter(g=>g.n), N=G.reduce((s,g)=>s+g.n,0)||1, legW=Math.min(o.legendW||230,W*.6), gw=W-legW-16;
  let cols=Math.max(1,Math.ceil(Math.sqrt(N*gw/H))), s=Math.min(gw/cols,H/Math.ceil(N/cols),34);
  while(Math.ceil(N/cols)*s>H&&cols<N){ cols++; s=Math.min(gw/cols,H/Math.ceil(N/cols),34); }
  let k=0; G.forEach(g=>{ for(let j=0;j<g.n;j++,k++) P.push(cR((k%cols)*s,Math.floor(k/cols)*s,s-3,s-3,g.color,`${g.k}: ${g.n} of ${N}`,2)); });
  let ly=0, grp=null; const lx=W-legW;
  G.forEach(g=>{ if(g.grp&&g.grp!==grp){ grp=g.grp; const gn=G.filter(x=>x.grp===grp).reduce((s,x)=>s+x.n,0);
      P.push(cT(lx,ly,legW,18,`${grp.toUpperCase()} · ${gn}`,{size:10.5,bold:true,color:CMUTE})); ly+=20; }
    P.push(cR(lx,ly+4,12,12,g.color,null,2)); P.push(cT(lx+18,ly,legW-50,20,wrapTxt(g.k,legW-50,12,1),{size:12}));
    P.push(cT(lx+legW-30,ly,30,20,`${g.n}`,{size:12,bold:true,align:"right"})); ly+=23; });
  return P;
}
// Funnel: centred bars that narrow with each step; step conversion at the right.
function funnelChart(o,W,H){
  const P=[], S=o.steps, n=S.length, mx=S[0][1]||1, rw=70, bw=W-rw, rh=H/n, bh=Math.min(46,rh-10);
  S.forEach(([k,v],i)=>{ const w=Math.max(bw*.1,bw*v/mx), x=(bw-w)/2, y=i*rh+(rh-bh)/2, c=RAMP[Math.min(i,RAMP.length-1)], lbl=`${k}: ${nf.format(v)}`;
    P.push(cR(x,y,w,bh,c,lbl,5));
    if(tw(lbl,13)<w-14) P.push(cT(x,y,w,bh,lbl,{size:13,bold:true,color:onC(c),align:"center"}));
    else { P.push(cT(0,y,Math.max(40,x-6),bh,wrapTxt(k,Math.max(40,x-6),12,2),{size:12,align:"right"})); P.push(cT(x,y,w,bh,nf.format(v),{size:13,bold:true,color:onC(c),align:"center"})); }
    P.push(cT(bw+8,y,rw-8,bh,i?`${pct(v,S[i-1][1])}%`:"",{size:13,bold:true,color:CMUTE})); });
  P.push(cT(bw+8,-2,rw,14,"STEP",{size:9.5,bold:true,color:CMUTE}));
  return P;
}
// 100% bars: one bar per dimension, split into its groups.
function stack100Chart(o,W,H){
  const P=[], rh=Math.min(o.rowH||70,H/o.rows.length); let y=0;
  o.rows.forEach(r=>{ const segs=r.segs.filter(g=>g.n), N=segs.reduce((s,g)=>s+g.n,0)||1, by=y+18, bh=26;
    P.push(cT(0,y,W,15,r.label.toUpperCase(),{size:10.5,bold:true,color:CMUTE,valign:"top"}));
    let x=0; segs.forEach(g=>{ const w=W*g.n/N; P.push(cR(x,by,Math.max(2,w-2),bh,g.color,`${r.label} · ${g.k}: ${g.n} of ${N}`,3));
      if(w>=24) P.push(cT(x,by,w-2,bh,String(g.n),{size:12,bold:true,color:onC(g.color),align:"center"})); x+=w; });
    let lx=0, ly=by+bh+5; segs.forEach(g=>{ const t=`${g.k} ${pct(g.n,N)}%`, ww=tw(t,11)+24; if(lx+ww>W){ lx=0; ly+=16; } if(ly>y+rh-12) return;
      P.push(cR(lx,ly+3,9,9,g.color,null,2)); P.push(cT(lx+13,ly,ww-13,15,t,{size:11,color:"#535353"})); lx+=ww; });
    y+=rh; });
  return P;
}
// Heat matrix: shaded cells with the value printed.
function heatChart(o,W,H){
  const P=[], rw=o.rowW||140, hh=o.headH||36, cw=(W-rw)/o.cols.length, rh=Math.min(36,(H-hh)/o.rows.length), fmt=o.fmt||(v=>nf.format(v));
  const mx=Math.max(1,...o.rows.flatMap(r=>o.cols.map(c=>o.val(r,c)||0)));
  o.cols.forEach((c,j)=>P.push(cT(rw+j*cw+2,0,cw-4,hh-4,wrapTxt(c,cw-4,10.5,3),{size:10.5,bold:true,color:CMUTE,align:"center",valign:"bottom"})));
  o.rows.forEach((r,i)=>{ const y=hh+i*rh; P.push(cT(0,y,rw-8,rh,wrapTxt(r,rw-8,12,2),{size:12}));
    o.cols.forEach((c,j)=>{ const v=o.val(r,c)||0, t=v/mx, fill=v?mixC("#FFFFFF","#274E13",.14+.8*t):"#F4F6F1";
      P.push(cR(rw+j*cw+1.5,y+1.5,cw-3,rh-3,fill,`${r} · ${String(c).replace("\n"," ")}: ${fmt(v)}`,3));
      if(v) P.push(cT(rw+j*cw,y,cw,rh,fmt(v),{size:11.5,bold:t>.45,color:onC(fill),align:"center"})); }); });
  return P;
}
// Waterfall (bridge): totals as full columns, changes as floating up/down steps.
const UP="#3E7B27", DOWN="#A23B72";   // up / down pair, checked for colour-blind separation
function waterfallChart(o,W,H){
  const P=[], S=o.steps, n=S.length, fmt=o.fmt||(v=>nf.format(v)), lblH=o.lblH||36, base=H-lblH, plotH=base-22, band=W/n, bw=Math.min(band*.6,70);
  let run=0; const pts=S.map(s=>{ const a=s.total?0:run, b=s.total?s.v:run+s.v; run=s.total?s.v:b; return {s,a,b}; });
  const mx=Math.max(1,...pts.flatMap(p=>[p.a,p.b])), y=v=>base-plotH*v/mx;
  pts.forEach(({s,a,b},i)=>{ const cx=band*i+band/2, top=y(Math.max(a,b)), h=Math.max(2,Math.abs(y(a)-y(b))), col=s.total?(s.color||"#274E13"):s.v>=0?UP:DOWN;
    P.push(cR(cx-bw/2,top,bw,h,col,`${s.k.replace("\n"," ")}: ${s.total?fmt(s.v):(s.v>=0?"+":"−")+fmt(Math.abs(s.v))}`,3));
    P.push(cT(cx-50,top-18,100,16,s.total?fmt(s.v):(s.v>=0?"+":"−")+fmt(Math.abs(s.v)),{size:11.5,bold:true,align:"center",color:s.total?CINK:col}));
    if(i<n-1) P.push(cL(cx+bw/2,y(b),cx+band-bw/2,y(b),CBASE,1,true));
    P.push(cT(band*i+1,base+5,band-2,lblH-5,wrapTxt(s.k,band-4,11,3),{size:11,align:"center",valign:"top"})); });
  P.push(cL(0,base,W,base,CBASE,1));
  return P;
}
// Diverging bars: change per item around a zero line, gains to the right, losses to the left.
function divergeChart(o,W,H){
  const P=[], I=o.items||[]; if(!I.length) return [cT(0,H/2-10,W,20,"No change to show",{size:13,color:CMUTE,align:"center"})];
  const fmt=o.fmt||(v=>nf.format(v)), lw=Math.min(W*.36,150), area=W-lw, pos=I.some(i=>i.v>0), neg=I.some(i=>i.v<0),
    mid=pos&&neg?lw+area/2:pos?lw+2:W-2, half=(pos&&neg?area/2:area-4)-62, mx=Math.max(1,...I.map(i=>Math.abs(i.v))), rh=Math.min(o.rowH||34,H/I.length), bh=Math.min(16,rh-10);
  P.push(cL(mid,0,mid,I.length*rh,CBASE,1));
  I.forEach((it,i)=>{ const yy=i*rh, by=yy+(rh-bh)/2, w=Math.max(2,half*Math.abs(it.v)/mx), up=it.v>=0, t=(up?"+":"−")+fmt(Math.abs(it.v));
    P.push(cT(0,yy,lw-8,rh,wrapTxt(it.k,lw-8,12,rh>=34?2:1),{size:12}));
    P.push(cR(up?mid+1:mid-1-w,by,w,bh,up?UP:DOWN,`${it.k}: ${t}${it.tip?` (${it.tip})`:""}`,3));
    P.push(cT(up?mid+w+5:mid-w-61,yy,56,rh,t,{size:11.5,bold:true,color:up?UP:DOWN,align:up?"left":"right"})); });
  return P;
}
const CHARTS={hbar:hbarChart,column:columnChart,line:lineChart,waffle:waffleChart,funnel:funnelChart,stack100:stack100Chart,heat:heatChart,waterfall:waterfallChart,diverge:divergeChart};
const layoutChart=(c,W,H)=>CHARTS[c.type](c,W,H);

/* ---------- SVG renderer ---------- */
const f1=v=>Math.round(v*10)/10;
function svgPrim(p){
  const tip=p.tip?` data-tip="${esc(p.tip)}"`:"";
  if(p.t==="r") return `<rect x="${f1(p.x)}" y="${f1(p.y)}" width="${f1(Math.max(p.w,.5))}" height="${f1(Math.max(p.h,.5))}" rx="${f1(Math.min(p.r||0,p.w/2,p.h/2))}" fill="${p.fill}"${tip}/>`;
  if(p.t==="l") return `<line x1="${f1(p.x1)}" y1="${f1(p.y1)}" x2="${f1(p.x2)}" y2="${f1(p.y2)}" stroke="${p.color}" stroke-width="${p.sw}" stroke-linecap="round"${p.dash?' stroke-dasharray="5 4"':""}/>`;
  if(p.t==="d") return `<circle cx="${f1(p.cx)}" cy="${f1(p.cy)}" r="${p.rad}" fill="${p.color||p.fill}" stroke="#fff" stroke-width="2"/><circle cx="${f1(p.cx)}" cy="${f1(p.cy)}" r="11" fill="transparent"${tip}/>`;
  if(p.t==="a") return `<polygon points="${p.pts.map(q=>f1(q[0])+","+f1(q[1])).join(" ")}" fill="${p.fill}" fill-opacity=".12"/>`;
  const L=p.s.split("\n"), lh=p.size*1.22, ax=p.align==="center"?p.x+p.w/2:p.align==="right"?p.x+p.w:p.x, th=L.length*lh;
  const y0=p.valign==="top"?p.y:p.valign==="bottom"?p.y+p.h-th:p.y+(p.h-th)/2;
  return `<text font-size="${p.size}" font-weight="${p.bold?700:400}" fill="${p.color}" text-anchor="${p.align==="center"?"middle":p.align==="right"?"end":"start"}">${L.map((l,i)=>`<tspan x="${f1(ax)}" y="${f1(y0+lh*i+p.size*.98)}">${esc(l)}</tspan>`).join("")}</text>`;
}
const svgChart=(c,W,H)=>`<svg class="chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${layoutChart(c,W,H).map(svgPrim).join("")}</svg>`;

/* ---------- Panel slides: a grid of cards described once, rendered as HTML and as PPTX ---------- */
// spec = {kicker, title, rows:[{h?, cards:[card]}], notes:[html]}
// card = {w (weight), title, sub, chart | table | kpis (vertical) | kpiRow (horizontal) | split:[card] (stacked), foot}
const BODY_W=1080, BODY_H=462, GAPX=16, GAPY=14;
const CARD={px:22,pt:18,title:24,sub:20,gap:8,pb:14};
function notesH(notes){ if(!notes?.length) return 0; const lines=notes.reduce((s,n)=>s+Math.ceil(tw(String(n).replace(/<[^>]+>/g,""),12.3)/1030),0); return Math.min(150,22+lines*18); }
function placeCards(cards,x,y,W,H,horizontal=true){
  const tw_=cards.reduce((s,c)=>s+(c.w||1),0), out=[]; let pos=horizontal?x:y;
  const fixed=horizontal?0:cards.reduce((s,c)=>s+(c.h||0),0), flex=horizontal?tw_:cards.filter(c=>!c.h).reduce((s,c)=>s+(c.w||1),0);
  cards.forEach(c=>{ if(horizontal){ const w=(W-GAPX*(cards.length-1))*(c.w||1)/tw_; out.push(...placeCard(c,pos,y,w,H)); pos+=w+GAPX; }
    else { const h=c.h||(H-GAPY*(cards.length-1)-fixed)*(c.w||1)/(flex||1); out.push(...placeCard(c,x,pos,W,h)); pos+=h+GAPY; } });
  return out;
}
function placeCard(c,x,y,w,h){
  if(c.split) return placeCards(c.split,x,y,w,h,false);
  if(c.kpis) return placeCards(c.kpis.map(k=>({kpi:k})),x,y,w,h,false);
  if(c.kpiRow) return placeCards(c.kpiRow.map(k=>({kpi:k})),x,y,w,h,true);
  const top=CARD.pt+(c.title?CARD.title:0)+(c.sub?CARD.sub:0)+(c.title||c.sub?CARD.gap:0), fh=c.foot?Math.min(56,18+Math.ceil(tw(c.foot,12.3)/(w-44))*17):0;
  return [{...c,x,y,w,h,inner:{x:CARD.px,y:top,w:w-2*CARD.px,h:h-top-CARD.pb-fh},fh}];
}
function layoutPanels(spec){
  const nh=notesH(spec.notes), H=BODY_H-(nh?nh+GAPY:0), rows=spec.rows, fixed=rows.reduce((s,r)=>s+(r.h||0),0), free=rows.filter(r=>!r.h).length;
  let y=0; const cells=[];
  rows.forEach(r=>{ const h=r.h||(H-fixed-GAPY*(rows.length-1))/(free||1); cells.push(...placeCards(r.cards,0,y,BODY_W,h,true)); y+=h+GAPY; });
  return {cells,notes:nh?{y:BODY_H-nh,h:nh,list:spec.notes}:null};
}
// Column widths for a table spec: proportional to the longest text in each column (bounded).
function colWeights(T){ const txt=v=>String(typeof v==="object"&&v?v.v:v??"");
  return T.colW||T.head.map((h,i)=>Math.min(46,Math.max(5,txt(h).length*.8,...T.rows.map(r=>txt(r[i]).length)))); }
// HTML
function cellHtml(c){
  const st=`left:${f1(c.x)}px;top:${f1(c.y)}px;width:${f1(c.w)}px;height:${f1(c.h)}px`;
  if(c.kpi) return `<div class="pk" style="${st}">${kpiHtml(c.kpi)}</div>`;
  const I=c.inner; let body="";
  if(c.chart) body=`<div style="position:absolute;left:${I.x}px;top:${I.y}px">${svgChart(c.chart,I.w,I.h)}</div>`;
  else if(c.table){ const T=c.table, al=i=>T.align?.[i]==="r"?' class="num"':T.align?.[i]==="c"?' style="text-align:center"':"";
    body=`<div style="position:absolute;left:${I.x}px;top:${I.y}px;width:${I.w}px"><table class="tbl pt" style="table-layout:fixed"><colgroup>${(()=>{ const w=colWeights(T), t=w.reduce((a,b)=>a+b,0); return w.map(x=>`<col style="width:${(x/t*100).toFixed(1)}%">`).join(""); })()}</colgroup><thead><tr>${T.head.map((h,i)=>`<th${al(i)}>${esc(h)}</th>`).join("")}</tr></thead><tbody>${
      T.rows.map(r=>`<tr>${r.map((v,i)=>{ const o=typeof v==="object"&&v?v:{v}; return `<td${al(i)}${o.fill?` style="background:${o.fill};color:${o.color||CINK}"`:""}>${o.pill?`<span class="pill">${esc(o.v)}</span>`:o.bold?`<b>${esc(o.v)}</b>`:esc(o.v)}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>`; }
  return `<div class="card pc" style="${st}">${c.title?`<h3>${esc(c.title)}</h3>`:""}${c.sub?`<p class="sub">${esc(c.sub)}</p>`:""}${body}${c.foot?`<p class="pfoot">${esc(c.foot)}</p>`:""}</div>`;
}
function panelSlide(n,spec){
  const L=layoutPanels(spec);
  return contentSlide(n,spec.kicker,spec.title,`<div class="panels">${L.cells.map(cellHtml).join("")}${L.notes?`<div class="caveat tight pn" style="top:${f1(L.notes.y)}px;height:${f1(L.notes.h)}px">${L.notes.list.join("<br>")}</div>`:""}</div>`);
}
