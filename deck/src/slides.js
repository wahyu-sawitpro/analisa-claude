/* ================= Narrative (shared by HTML and PPTX) ================= */
const lc=s=>String(s).replace(/^(?!PIC)./,c=>c.toLowerCase());
const andList=a=>a.length<2?a.join(""):a.slice(0,-1).join(", ")+" and "+a[a.length-1];
const PRODUCT_RE=/\b(AC\s*(?:Powder\s*)?AKP|KCL(?:\s+(?:Mahkota|Sasco|Mentari|Canada))?|NPK(?:\s+(?:DGW|Sawit|Yaramila|Pak Tani))?|RP(?:\s+(?:Mahkota|Sasco|Cap Daun))?|Urea|ZA(?:\s+Cap Daun)?|Borate|Dolomit|herbisida|Gramoxone)\b/gi;
function productsIn(rows){ const m=new Map();
  for(const r of rows){ const txt=[r.product,r.detail].filter(Boolean).join(" "); for(const x of txt.match(PRODUCT_RE)||[]){ const k=x.replace(/\s+/g," ").replace(/powder\s*/i,"").toUpperCase().replace("HERBISIDA","herbicide"); m.set(k,(m.get(k)||0)+1);} }
  return [...m].sort((a,b)=>b[1]-a[1]).map(x=>x[0]); }

function narrative(A){
  const N={}, n=A.crm.length, won=A.won.length, warm=A.warm.length, lost=A.lost.length, nw=A.notWon.length;
  N.period=span(A.dates);
  N.team=A.team?`${A.team.replace(/^./,c=>c.toUpperCase())} Team`:"Sales Team";
  N.title=won||A.has.sales?(nw?"What Won and What Lost Last Week":"What Won Last Week"):"Why Leads Say No";
  N.meta=[A.has.sales&&`${A.orders.length} orders`,n&&`${n} CRM engagements`].filter(Boolean).join(" · ");

  // KPI strip
  if(A.has.sales) N.kpis=[
      {v:rpParts(A.gmv)[0],u:rpParts(A.gmv)[1],l:`Sales GMV from ${A.orders.length} orders`,hot:true},
      {v:nf.format(A.customers),u:"",l:`Customers buying (${A.newOrders.length} new)`},
      n?{v:nf.format(won),u:`/${n}`,l:"CRM engagements that ended in an order"}:{v:rpParts(A.orders.length?A.gmv/A.orders.length:0)[0],u:rpParts(A.orders.length?A.gmv/A.orders.length:0)[1],l:"Average order value"},
      n?{v:String(pct(lost,n)),u:"%",l:`of CRM engagements not interested (${lost})`}:{v:String(pct(A.top2,A.gmv)),u:"%",l:"of GMV from the top 2 orders"}];
  else N.kpis=[{v:nf.format(n),u:"",l:"Engagements logged"},{v:String(pct(lost,n)),u:"%",l:`${lost} not interested`},
      {v:nf.format(warm),u:"",l:"Still in play (considering or prospect)",hot:true},{v:nf.format(won),u:"",l:"Ended in an order"}];

  // Driver: which dimension separates the positive cohort (ordered, else still in play)
  const B=A.best;
  if(B){ const g=B.groups.filter(x=>x.g!=="(not filled)"&&x.n>=3), hi=g.slice().sort((a,b)=>b.rate-a.rate||b.n-a.n)[0], lo=g.slice().sort((a,b)=>a.rate-b.rate||b.n-a.n)[0];
    N.driver={k:B.k,dim:LABEL[B.k],hi,lo};
    N.driverTitle=`${hi.g}: ${hi.w} of ${hi.n} ${A.posLabel}. ${lo.g}: ${lo.w} of ${lo.n}.`;
    const tog=A.together.filter(k=>k!==B.k).map(k=>LABEL[k]);
    const filtered=A.crmSources.length>1&&A.crmSources.every(s=>{const o=new Set(A.crm.filter(r=>r._src===s.label).map(r=>r.outcome==="Won"));return o.size===1;});
    N.caveat=[tog.length?`<b>${esc(LABEL[B.k])} is not the only difference.</b> The ${A.posLabel} leads also share the same ${esc(andList(tog.map(lc)))}, so these factors move together. Treat this as one working playbook rather than a single cause.`:"",
      filtered?`<b>The CRM files are split by outcome</b> (one holds only orders), so rates describe these logs, not the full funnel.`:`<b>Small sample (${n} engagements).</b> Confirm with next week's data.`].filter(Boolean).join(" ");
  }

  // Themes and signals
  const tTop=A.themes.slice().sort((a,b)=>b.lost-a.lost)[0];
  const sig=k=>A.signals.find(x=>x.k===k)||{lost:0,warm:0,n:0};
  N.reasonTitle=tTop&&lost&&tTop.lost/lost>=.4?`${pct(tTop.lost,lost)}% of “not interested” leads are ${tTop.t==="Locked in elsewhere"?"locked into a supplier, KUD or agent":tTop.t.toLowerCase()}`
    :A.themes[0]?`${A.themes[0].t} is the most common reason (${A.themes[0].n} of ${nw})`:"Why leads say no";

  // Rejection reasons in detail
  const sp=A.reasonSplit[0], TL={"Locked in elsewhere":"locked into a shop, KUD or agent","Just asking":"just asking","Stock & delivery":"stalled on stock or delivery","Price":"put off by price","Not a fit":"not a fit","Timing":"not buying yet"};
  if(A.reasonRows.length){
    const r0=A.reasonList[0];
    N.rrTitle=sp?sp.groups.slice(0,2).map(g=>`${g.g}: ${g.tn} of ${g.n} ${TL[g.theme]||lc(g.theme)}`).join(". ")+"."
      :`“${r0.k}” is the most common reason (${r0.n} of ${A.reasonRows.length})`;
    N.rrNotes=[
      sp&&`<b>${esc(LABEL[sp.k])} predicts the reason.</b> ${esc(sp.groups.map(g=>`${g.g} (${g.n}): mostly ${TL[g.theme]||lc(g.theme)}`).join("; "))}. The answer depends on which list is being worked, so fix the list, not the pitch.`,
      A.askTotal>=3&&A.askUnreach&&`<b>“Just asking” is partly a logging habit.</b> ${A.askUnreach} of ${A.askTotal} were recorded when the call didn't connect, so no reason was actually heard.`,
      A.locHot&&`<b>${esc(A.locHot.g)}</b>: ${A.locHot.tn} of ${A.locHot.n} engagements there are ${esc(TL[A.locHot.theme]||lc(A.locHot.theme))}.`
    ].filter(Boolean);
  }

  // Success
  const wonDom=k=>{const c=countBy(A.won,r=>r[k]);return c[0]?{v:c[0][0],n:c[0][1]}:null};
  const wp=wonDom("pic"), wc=wonDom("channel");
  if(won) N.winTitle=wp&&wc&&wp.n/won>=.6&&wc.n/won>=.6
      ? `${wp.v}'s ${lc(wc.v)}s produced ${wp.n} of ${won} CRM wins${A.has.sales?`, ${rp(A.linkedGmv)} in orders`:""}`
      : `${won} CRM engagements ended in an order${A.has.sales?`, worth ${rp(A.linkedGmv)}`:""}`;
  if(A.has.sales){ const O=A.orders;
    N.salesTitle=A.noCrm.length/O.length>=.3?`${rp(A.gmv)} from ${O.length} orders, but ${A.noCrm.length} of them never appear in the CRM`
      :`${rp(A.gmv)} from ${O.length} orders; the top 2 make up ${pct(A.top2,A.gmv)}%`; }
  if(warm) N.warmTitle=A.intentWarm.length>=2?`${warm} leads are still in play, and ${A.intentWarm.length} are already asking how to buy`:`${warm} leads are still in play`;

  // Headline for the executive summary
  const dh=N.driver&&won?`${N.driver.hi.g} converts (${N.driver.hi.w} of ${N.driver.hi.n}); ${lc(N.driver.lo.g)} doesn't (${N.driver.lo.w} of ${N.driver.lo.n})`:null;
  N.headline=A.has.sales?`${rp(A.gmv)} in sales last week.${dh?` ${dh}.`:""}`:dh||(n?`${pct(lost,n)}% of leads said no; ${warm} are still in play`:"Executive summary");
  // Findings (max 4)
  const F=[];
  if(N.driver){ const {hi,lo}=N.driver; F.push([`${N.driver.dim} separates winners from the rest`,`${hi.g}: ${hi.w} of ${hi.n} ${A.posLabel}. ${lo.g}: ${lo.w} of ${lo.n}.`]); }
  if(tTop&&lost) F.push([tTop.t==="Locked in elsewhere"?"Rejections are about loyalty, not product":`Top rejection theme: ${lc(tTop.t)}`,
    `${tTop.lost} of ${lost} “not interested” leads${tTop.t==="Locked in elsewhere"?" already buy from a shop, KUD or agent":` cite ${lc(tTop.t)}`}${sig("credit").lost?`; ${sig("credit").lost} buy on credit`:""}${sig("season").lost?`; ${sig("season").lost} already fertilized this season`:""}.`]);
  if(A.intentWarm.length>=2) F.push(["Warm leads are asking how to buy",`${A.intentWarm.length} of ${warm} leads in play asked about the warehouse, delivery or prices${A.unreachable?`; ${A.unreachable} could not be reached by phone`:""}.`]);
  if(A.has.sales&&A.noCrm.length/A.orders.length>=.3) F.push(["The CRM misses most of the sales story",`${A.noCrm.length} of ${A.orders.length} orders (${rp(A.noCrm.reduce((s,o)=>s+o.gmv,0))}) have no CRM engagement${A.crmMap.potential?", and CRM wins carry no GMV":""}.`]);
  if(A.stockRows.length>=2) F.push(["Stock-outs cost real orders",`${A.stockRows.length} leads stalled because the product wasn't available or delivery was too slow.`]);
  if(!A.has.sales&&!won&&nw){ const ca=A.notWon.filter(r=>r.theme==="Just asking").length; if(ca/nw>=.5) F.push(["We don't know why leads say no",`${pct(ca,nw)}% of reasons are a catch-all, so the team can't fix the pitch.`]); }
  N.findings=F.slice(0,4);

  // Bottom line
  const lever=N.driver&&["source","channel"].includes(N.driver.k)&&won?`Put the team where wins happen: ${lc(N.driver.hi.g)}, not ${lc(N.driver.lo.g)}.`:null;
  N.bottom={p:lever||(warm?"Close the leads still in play before adding new ones.":"Fix how we reach and qualify leads."),
    s:[A.intentWarm.length>=2&&`Call back the ${A.intentWarm.length} warm leads asking how to buy this week.`,A.stockRows.length>=2&&"Restock the products leads asked for.",
       tTop&&tTop.t==="Locked in elsewhere"&&"Stop cold-calling farmers who are tied to a KUD or shop."].filter(Boolean).join(" ")||"Better reason and value fields will sharpen next week's analysis."};

  // Actions (max 4, in priority order)
  const act=[]; const warmPic=countBy(A.warm,r=>r.pic)[0]?.[0];
  if(N.driver&&won&&["source","channel"].includes(N.driver.k)){ const {hi,lo}=N.driver;
    act.push({t:`Move effort from ${lc(lo.g)} to ${lc(hi.g)}`,d:`${hi.g} turned ${hi.w} of ${hi.n} engagements into orders; ${lc(lo.g)} turned ${lo.w} of ${lo.n}. Shift part of next week's ${lc(lo.g)} list to ${lc(hi.g)} and compare results.`,o:"Team lead",w:"Next week"}); }
  if(A.intentWarm.length>=2) act.push({t:`Close ${A.intentWarm.length} warm leads within 48 hours`,d:`They asked about the warehouse, delivery or prices.${A.unreachable?` ${A.unreachable} could not be reached by phone, so send the price list and warehouse location on WhatsApp, then follow up.`:""}`,o:warmPic||"Lead PIC",w:"This week"});
  if(tTop&&tTop.t==="Locked in elsewhere"&&tTop.lost>=3) act.push({t:"Stop competing head-on with KUDs and shops",d:`${tTop.lost} rejections are tied to an existing shop, KUD or agent${sig("credit").lost?`, ${sig("credit").lost} of them buying on credit`:""}. Test a KUD partnership or payment terms, and drop these numbers from this season's call lists.`,o:"Sales lead",w:"Next 2 weeks"});
  if(A.stockRows.length>=2){ const pr=productsIn(A.stockRows).slice(0,3); act.push({t:"Restock what leads asked for",d:`${A.stockRows.length} leads stalled on availability or a 7–14 day delivery${pr.length?`: ${andList(pr)}`:""}. Confirm stock before promising, and offer warehouse pickup.`,o:"Supply & ops",w:"This week"}); }
  if(A.has.sales&&A.noCrm.length/A.orders.length>=.3) act.push({t:"Log every order in the CRM",d:`${A.noCrm.length} of ${A.orders.length} orders have no engagement record. Add the order number to each CRM entry so wins carry their GMV.`,o:"Sales ops",w:"Next form update"});
  if(warm&&!A.intentWarm.length) act.push({t:`Book dated follow-ups for ${warm} leads in play`,d:"Agree a concrete next step with each lead and log a follow-up date.",o:warmPic||"Lead PIC",w:"This week"});
  if(nw&&A.notWon.filter(r=>r.theme==="Just asking").length/nw>=.3) act.push({t:"Replace the catch-all reason",d:"Make the reason a required dropdown: price, no need yet (with a revisit month), has a supplier, tied to KUD, out of stock, unreachable. Drop “just asking”.",o:"Sales ops",w:"Next form update"});
  N.actions=act.slice(0,4);

  // Data gaps
  const g=[]; const fill=k=>A.crm.filter(r=>r[k]!==null&&r[k]!==undefined).length/(n||1);
  if(A.nostatus.length) g.push(`${A.nostatus.length} engagement${A.nostatus.length>1?"s":""} without a status`);
  const chMiss=A.crm.filter(r=>!r.channel).length; if(chMiss) g.push(`${chMiss} without an engagement type`);
  const low=["potential","needKg","followDate","location","custType"].filter(k=>A.crmMap[k]&&fill(k)<.3).map(k=>({potential:"potential GMV",needKg:"fertilizer needs",followDate:"follow-up date",location:"location",custType:"customer type"}[k]));
  if(low.length) g.push(`${andList(low)} mostly empty`);
  N.gaps=n?g:[];
  return N;
}

/* ================= HTML slides ================= */
function hbars(items,{fmt=v=>nf.format(v),right,max,color="#4A653B",scale}={}){
  if(!items.length) return `<div class="empty">Not in this data</div>`;
  const top=scale||Math.max(...items.map(i=>i.v))||1;
  return `<div class="hbars">${items.slice(0,max||items.length).map(i=>`<div class="hb"><div class="top"><span class="k" title="${esc(i.tip||i.k)}">${esc(i.k)}</span><span class="n">${fmt(i.v)}${right?`<em>${esc(right(i))}</em>`:""}</span></div>
    <div class="track">${(i.segs||[[i.v,color,i.tip||i.k]]).filter(s=>s[0]).map(s=>`<div class="seg" style="flex:0 0 ${s[0]/top*100}%;background:${s[1]}" data-tip="${esc(s[2])}"></div>`).join("")}</div></div>`).join("")}</div>`;
}
const legendOf=pairs=>`<div class="legend">${pairs.map(([k,c])=>`<span><i style="background:${c}"></i>${esc(k)}</span>`).join("")}</div>`;
const kpiHtml=k=>`<div class="kpi${k.hot?" hot":""}"><div class="v">${esc(k.v)}<small>${esc(k.u)}</small></div><div class="l">${esc(k.l)}</div></div>`;
function contentSlide(n,kicker,title,body){
  return `<div class="slide content"><div class="panel"></div><div class="ybar"></div><img class="palm" src="${IMG.palm}" alt=""><img class="logo" src="${IMG.logo}" alt="SawitPRO">
  <div class="kicker">${esc(kicker)}</div><h2>${esc(title)}</h2><div class="body">${body}</div>
  <div class="foot"><span>SAWITPRO PROPRIETARY</span><span class="pg">${n}</span><span>Do not use or distribute without permission from SawitPRO</span></div></div>`;
}
const OUT_COLOR={"Ordered":"#274E13","Considering / prospect":"#D9A21B","Not interested":"#8E9C84"};

function buildSlides(A,N){
  const S=[], next=()=>S.length+1;
  S.push(`<div class="slide cover"><img class="bg" src="${IMG.cover}" alt=""><div class="shade"></div><img class="wm" src="${IMG.wm}" alt="SawitPRO.id">
    <div class="band"></div><div class="disc"><img src="${IMG.logo}" alt=""></div>
    <div class="txt"><p class="eyebrow">${esc(N.team)}</p><p class="title">${esc(N.title)}</p></div>
    <div class="meta">${esc(N.period)} · ${esc(N.meta)}</div></div>`);

  // Executive summary
  S.push(contentSlide(next(),"Executive summary",N.headline,`
    <div class="kpis">${N.kpis.map(kpiHtml).join("")}</div>
    <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:18px;margin-top:18px">
      <div class="card"><div class="findings">${N.findings.map(f=>`<div class="find"><span class="mk"></span><div><b>${esc(f[0])}</b><p>${esc(f[1])}</p></div></div>`).join("")}</div></div>
      <div class="bottom"><span class="lb">Bottom line</span><p>${esc(N.bottom.p)}</p><small>${esc(N.bottom.s)}</small></div></div>`));

  // Rejection reasons in detail
  const sp=A.reasonSplit[0], TL={"Locked in elsewhere":"locked into a shop, KUD or agent","Just asking":"just asking","Stock & delivery":"stalled on stock or delivery","Price":"put off by price","Not a fit":"not a fit","Timing":"not buying yet"};
  if(A.reasonRows.length){
    const r0=A.reasonList[0];
    N.rrTitle=sp?sp.groups.slice(0,2).map(g=>`${g.g}: ${g.tn} of ${g.n} ${TL[g.theme]||lc(g.theme)}`).join(". ")+"."
      :`“${r0.k}” is the most common reason (${r0.n} of ${A.reasonRows.length})`;
    N.rrNotes=[
      sp&&`<b>${esc(LABEL[sp.k])} predicts the reason.</b> ${esc(sp.groups.map(g=>`${g.g} (${g.n}): mostly ${TL[g.theme]||lc(g.theme)}`).join("; "))}. The answer depends on which list is being worked, so fix the list, not the pitch.`,
      A.askTotal>=3&&A.askUnreach&&`<b>“Just asking” is partly a logging habit.</b> ${A.askUnreach} of ${A.askTotal} were recorded when the call didn't connect, so no reason was actually heard.`,
      A.locHot&&`<b>${esc(A.locHot.g)}</b>: ${A.locHot.tn} of ${A.locHot.n} engagements there are ${esc(TL[A.locHot.theme]||lc(A.locHot.theme))}.`
    ].filter(Boolean);
  }

  // Success story
  if(A.won.length){
    const mini=k=>{const c=countBy(A.won,r=>r[k]);return c.length?`<div class="mini"><h4>${esc(LABEL[k])}</h4>${hbars(c.slice(0,3).map(([g,v])=>({k:g,v})),{scale:A.won.length,right:i=>pct(i.v,A.won.length)+"%"})}</div>`:""};
    const rows=A.has.sales?A.linkedOrders.slice(0,5).map(o=>`<tr><td>${esc(o.no)}</td><td>${esc(o.pic||"–")}</td><td>${esc(o.items.slice(0,2).join(", "))}${o.items.length>2?` +${o.items.length-2}`:""}</td><td class="num">${rp(o.gmv)}</td><td>${o.isNew?`<span class="pill">New</span>`:"Repeat"}</td></tr>`).join("")
      :A.won.slice(0,6).map(r=>`<tr><td>${esc(r.id||"–")}</td><td>${esc(r.pic||"–")}</td><td>${esc(r.channel||"–")}</td><td>${esc(r.source||"–")}</td><td>${esc((r.detail||"").slice(0,60))}</td></tr>`).join("");
    const newWon=A.linkedOrders.filter(o=>o.isNew).length;
    S.push(contentSlide(next(),"Success story",N.winTitle,`
      <div style="display:grid;grid-template-columns:.85fr 1.45fr;gap:18px;align-items:start">
        <div class="card"><h3>How the ${A.won.length} wins happened</h3><p class="sub">Share of CRM engagements that ended in an order</p>${["channel","source"].map(mini).join("")}</div>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="stats3">${[{v:`${A.wonLinked.length}`,u:`/${A.won.length}`,l:"Wins confirmed in sales data",hot:true},{v:rpParts(A.linkedGmv)[0],u:rpParts(A.linkedGmv)[1],l:`GMV of ${A.linkedOrders.length} matched orders`},
            {v:String(newWon),u:`/${A.linkedOrders.length}`,l:"Matched orders from new customers"}].map(k=>A.has.sales?kpiHtml(k):"").join("")}</div>
          <div class="card" style="padding:14px 16px"><table class="tbl"><thead><tr>${(A.has.sales?["Order","PIC","Products","GMV","Customer"]:["ID","PIC","Channel","Source","Notes"]).map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
          <p class="sub" style="margin:8px 0 0">${A.has.sales?`Matched by phone number, then order number in the notes, then name and PIC.${A.linkedOrders.length>5?` Top 5 of ${A.linkedOrders.length} by GMV.`:""}`:"Upload the sales file to see what these wins were worth."}</p></div></div></div>`));
  }

  // Sales last week
  if(A.has.sales){
    const O=A.orders, rep=O.filter(o=>!o.isNew), newG=A.newOrders.reduce((s,o)=>s+o.gmv,0), parG=A.partial.reduce((s,o)=>s+o.gmv,0), ncG=A.noCrm.reduce((s,o)=>s+o.gmv,0);
    S.push(contentSlide(next(),"Sales last week",N.salesTitle,`
      <div style="display:grid;grid-template-columns:1.1fr 1fr .9fr;gap:16px">
        <div class="card"><h3>GMV by product</h3><p class="sub">Top items across all orders</p>${hbars(A.byItem.slice(0,6).map(([k,v])=>({k,v})),{fmt:rp})}</div>
        <div class="card"><h3>GMV by PIC</h3><p class="sub">Orders in brackets</p>${hbars(A.byPic.slice(0,6).map(x=>({k:x.p,v:x.g,o:x.n})),{fmt:rp,right:i=>`(${i.o})`,color:"#6E8F5A"})}</div>
        <div style="display:flex;flex-direction:column;gap:12px">
          ${kpiHtml({v:String(pct(rep.length,O.length)),u:"%",l:`Repeat-customer orders; ${A.newOrders.length} new customers worth ${rp(newG)}`})}
          ${kpiHtml({v:String(A.noCrm.length),u:`/${O.length}`,l:`Orders with no CRM engagement (${rp(ncG)})`,hot:A.noCrm.length/O.length>=.3})}
          ${A.partial.length?kpiHtml({v:String(A.partial.length),u:"",l:`Partially paid orders worth ${rp(parG)}`}):kpiHtml({v:String(pct(A.top2,A.gmv)),u:"%",l:"of GMV from the top 2 orders"})}
        </div></div>`));
  }

  // Rejection reasons in detail
  if(A.reasonRows.length){
    const RL=A.reasonList.slice(0,7), dims=A.reasonDims, more=A.reasonList.length-RL.length;
    const cols=dims.flatMap(k=>countBy(A.reasonRows.filter(r=>r[k]),r=>r[k]).slice(0,3).map(([g])=>({k,g})));
    const mx=Math.max(1,...RL.flatMap(r=>cols.map(c=>A.reasonRows.filter(x=>x.reason===r.k&&x[c.k]===c.g).length)));
    const cell=v=>`<td class="heat" style="background:rgba(74,101,59,${v?(.12+.78*v/mx).toFixed(2):0});color:${v/mx>.5?"#fff":"var(--ink)"}">${v||""}</td>`;
    S.push(contentSlide(next(),"Rejection reasons last week",N.rrTitle,`
      <div style="display:grid;grid-template-columns:1fr 1.05fr;gap:18px;align-items:start">
        <div class="card" style="padding:16px 20px"><h3>Every reason given</h3><p class="sub" style="margin-bottom:8px">${A.reasonRows.length} engagements that did not order; original CRM wording in grey${more>0?`; ${more} rarer reasons not shown`:""}</p>${legendOf([["Not interested","#8E9C84"],["Considering / prospect","#D9A21B"]])}
          <div class="hbars rr">${RL.map(r=>`<div class="hb"><div class="top"><span class="k">${esc(r.k)}<small>${esc(r.raw)}</small></span><span class="n">${r.n}<em>${pct(r.n,A.reasonRows.length)}%</em></span></div>
            <div class="track">${[[r.lost,"#8E9C84","not interested"],[r.warm,"#D9A21B","considering / prospect"],[r.other,"#C9CFC3","no status"]].filter(x=>x[0]).map(x=>`<div class="seg" style="flex:0 0 ${x[0]/RL[0].n*100}%;background:${x[1]}" data-tip="${esc(`${r.k} · ${x[2]}: ${x[0]}`)}"></div>`).join("")}</div></div>`).join("")}</div></div>
        <div style="display:flex;flex-direction:column;gap:14px">
          ${cols.length?`<div class="card" style="padding:14px 16px"><table class="tbl heatt"><thead><tr><th>Reason</th>${dims.map(k=>`<th colspan="${cols.filter(c=>c.k===k).length}" class="grp">${esc(LABEL[k])}</th>`).join("")}</tr>
            <tr class="sub2"><th></th>${cols.map(c=>`<th>${esc(c.g)}</th>`).join("")}</tr></thead>
            <tbody>${RL.map(r=>`<tr><td>${esc(r.k)}</td>${cols.map(c=>cell(A.reasonRows.filter(x=>x.reason===r.k&&x[c.k]===c.g).length)).join("")}</tr>`).join("")}</tbody></table></div>`:""}
          ${N.rrNotes.length?`<div class="caveat tight">${N.rrNotes.join("<br>")}</div>`:""}</div></div>`));
  }

  // Why leads say no
  if(A.notWon.length){
    const tb=A.themes.slice().sort((a,b)=>b.n-a.n).map(t=>({k:t.t,v:t.n,segs:[[t.lost,"#8E9C84",`${t.t} · not interested: ${t.lost}`],[t.warm,"#D9A21B",`${t.t} · considering / prospect: ${t.warm}`]],
      tip:A.reasons.filter(([r])=>themeOf(r)===t.t).map(([r,c])=>`${r} (${c})`).join(", ")}));
    S.push(contentSlide(next(),"What the reasons mean",N.reasonTitle,`
      <div style="display:grid;grid-template-columns:1fr 1.1fr;gap:18px">
        <div class="card"><h3>Reasons, grouped by what would fix them</h3><p class="sub">${A.notWon.length} engagements that did not order; hover a bar for the original reasons</p>${legendOf([["Not interested","#8E9C84"],["Considering / prospect","#D9A21B"]])}${hbars(tb,{right:i=>pct(i.v,A.notWon.length)+"%"})}</div>
        <div class="card"><h3>What the discussion notes say</h3><p class="sub">Signals read from “Detail pembahasan”, by lead status</p>${A.signals.length?legendOf([["Not interested","#8E9C84"],["Considering / prospect","#D9A21B"]])+hbars(A.signals.slice(0,6).map(x=>({k:x.label,v:x.n,segs:[[x.lost,"#8E9C84",`not interested: ${x.lost}`],[x.warm,"#D9A21B",`considering / prospect: ${x.warm}`]]})),{}):`<div class="empty">No discussion notes in this data</div>`}</div></div>`));
  }

  // Won vs the rest
  if(N.driver){
    const D=N.driver, gs=A.best.groups.filter(x=>x.g!=="(not filled)");
    S.push(contentSlide(next(),"What separates winners",`${D.dim} decides the outcome. ${N.driverTitle}`,`
      <div style="display:grid;grid-template-columns:.85fr 1.4fr;gap:18px">
        <div class="card"><h3>Share ${A.posLabel}, by ${esc(lc(D.dim))}</h3><p class="sub">Across ${A.crm.filter(r=>r.outcome).length} CRM engagements with a status</p>${hbars(gs.map(g=>({k:g.g,v:Math.round(g.rate*100),w:g.w,n:g.n})),{fmt:v=>v+"%",right:i=>`${i.w} of ${i.n}`,scale:100})}</div>
        <div class="card" style="padding:14px 16px"><table class="tbl"><thead><tr><th>Most common</th>${A.cohorts.map(([c,rs])=>`<th><i class="dot" style="background:${OUT_COLOR[c]}"></i>${esc(c)} (${rs.length})</th>`).join("")}</tr></thead>
          <tbody>${A.profile.map(p=>`<tr><td class="dim">${esc(LABEL[p.k])}</td>${p.vals.map(v=>`<td>${esc(v.v)}<span class="sh">${Math.round(v.share*100)}%</span></td>`).join("")}</tr>`).join("")}</tbody></table></div></div>
      <div class="caveat" style="margin-top:14px">${N.caveat}</div>`));
  }

  // Recoverable demand
  if(A.warm.length){
    const SL=Object.fromEntries(SIGNALS.map(s=>[s[0],s[1]]));
    const rows=A.warm.slice().sort((a,b)=>b.signals.length-a.signals.length).slice(0,5);
    S.push(contentSlide(next(),"Recoverable demand",N.warmTitle,`
      <div class="stats4">${[{v:String(A.warm.length),u:"",l:"Considering or prospect",hot:true},{v:String(A.intentWarm.length),u:"",l:"Asked about warehouse, delivery or price"},
        {v:String(A.warm.filter(r=>/unable|tidak bisa/i.test(r.callResp||"")).length),u:"",l:"Could not be reached by phone"},{v:String(A.stockRows.length),u:"",l:"Stalled on stock or delivery time"}].map(kpiHtml).join("")}</div>
      <div class="card" style="margin-top:14px;padding:14px 16px"><table class="tbl"><thead><tr><th>ID</th><th>PIC</th><th>Channel</th><th>Status</th><th>What they asked or said</th></tr></thead><tbody>
        ${rows.map(r=>`<tr><td style="white-space:nowrap">${esc(r.id||"–")}</td><td>${esc(r.pic||"–")}</td><td style="white-space:nowrap">${esc(r.channel||"–")}</td><td><span class="pill">${esc(r.status)}</span></td><td>${esc(r.signals.map(s=>SL[s]).join("; ")||r.reason||"–")}</td></tr>`).join("")}</tbody></table>
        <p class="sub" style="margin:8px 0 0">${A.warm.length>rows.length?`${rows.length} of ${A.warm.length} shown. `:""}Names and phone numbers are left out; look leads up by ID in the CRM.</p></div>`));
  }

  // Next steps
  S.push(contentSlide(next(),"Next steps",`${N.actions.length} actions for the coming week`,`
    <div class="act">${N.actions.map((a,i)=>`<div class="card"><h3><span>${i+1}</span>${esc(a.t)}</h3><p>${esc(a.d)}</p><div class="meta"><span>Owner: ${esc(a.o)}</span><span class="when">${esc(a.w)}</span></div></div>`).join("")}</div>
    ${N.gaps.length?`<div class="gaps"><b>Also clean up in the CRM:</b> ${esc(N.gaps.join("; "))}.</div>`:""}`));

  S.push(`<div class="slide closing"><img class="bg" src="${IMG.closing}" alt=""><div class="shade"></div><img class="wm" src="${IMG.wm}" alt="SawitPRO.id"><img class="lg" src="${IMG.logo}" alt="">
    <div class="box"><h2>Thank You</h2><p>#TerusTumbuh</p></div></div>`);
  return S;
}
