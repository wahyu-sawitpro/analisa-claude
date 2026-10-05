/* ================= Narrative (shared by HTML and PPTX) ================= */
const lc=s=>String(s).replace(/^(?![A-Z]{2}|WhatsApp)./,c=>c.toLowerCase());
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
  const both=wp&&wc?A.won.filter(r=>r.pic===wp.v&&r.channel===wc.v).length:0;
  if(won) N.winTitle=both/won>=.6
      ? `${wp.v}'s ${lc(wc.v)}s produced ${both} of ${won} CRM wins${A.has.sales?`, ${rp(A.linkedGmv)} in orders`:""}`
      : `${won} CRM engagements ended in an order${A.has.sales?`, worth ${rp(A.linkedGmv)}`:""}`;
  if(A.has.sales){ const O=A.orders, F0=A.byFamily[0], Q=A.qtyTotal||1, CN=A.byCat.filter(c=>c.k!=="(no category)"), C0=CN[0], CO=CN.slice().sort((a,b)=>b.orders-a.orders)[0], UC=A.byCat.find(c=>c.k==="(no category)");
    N.soldTitle=F0?(F0.qty/Q>=.5?`${F0.k} is the anchor product: ${pct(F0.qty,Q)}% of units and ${pct(F0.gmv,A.gmv)}% of GMV`:`${F0.k} leads with ${pct(F0.gmv,A.gmv)}% of GMV`):"What sold";
    N.catLine=C0?(CO&&CO.k!==C0.k?`By product category, ${C0.k} brings the most GMV (${pct(C0.gmv,A.gmv)}%) and ${CO.k} the most orders (${CO.orders}).`:`By product category, ${C0.k} leads on GMV (${pct(C0.gmv,A.gmv)}%) and orders (${C0.orders}).`):"";
    if(UC) N.catLine=(N.catLine?N.catLine+" ":"")+`${rp(UC.gmv)} (${pct(UC.gmv,A.gmv)}%) has no product category in the export.`;
    const P0=A.byProvince[0], RG=A.byRegion, RC=RG.slice().sort((a,b)=>b.cust-a.cust||b.gmv-a.gmv)[0], R0=RG[0];
    const r0top=R0?Math.max(...O.filter(o=>o.lines.some(l=>l.region===R0.k)).map(o=>o.gmv)):0;
    const R0role=A.byRole[0];
    N.whoTitle=!RC&&R0role?`${roleName(R0role.k)}s bring ${pct(R0role.gmv,A.gmv)}% of GMV across ${R0role.n} order${R0role.n>1?"s":""}`:RC?`${P0&&A.byProvince.length>1?`${P0.k} is ${pct(P0.gmv,A.gmv)}% of GMV; `:""}${RC.k} has the most customers (${RC.cust})${R0&&R0.k!==RC.k?`, ${R0.k} the most GMV`:""}`:"Who bought and how";
    N.regionNote=R0&&R0.orders<=3&&r0top/R0.gmv>=.8?`${R0.k}'s ${rp(R0.gmv)} is mostly one order (${rp(r0top)}), so ${RC&&RC.k!==R0.k?RC.k:"the broader base"} is the steadier market.`:"";
    N.salesTitle=A.noCrm.length/O.length>=.3?`${rp(A.gmv)} from ${O.length} orders, but ${A.noCrm.length} of them never appear in the CRM`
      :`${rp(A.gmv)} from ${O.length} orders; the top 2 make up ${pct(A.top2,A.gmv)}%`; }
  if(warm) N.warmTitle=A.intentWarm.length>=2?`${warm} leads are still in play, and ${A.intentWarm.length} are already asking how to buy`:`${warm} leads are still in play`;

  // Funnel and PIC scorecard
  const FU=A.funnel, steps=FU.slice(1).map((f,i)=>({from:FU[i],to:f,rate:FU[i][1]?f[1]/FU[i][1]:1})).filter(x=>x.from[1]>=5&&(won||x.to[0]!=="Ordered"));
  const drop=steps.slice().sort((a,b)=>a.rate-b.rate)[0];
  const NL=A.notLogging, nlG=NL.reduce((s,g)=>s+g.gmv,0), nlO=NL.reduce((s,g)=>s+g.orders,0);
  const conv=A.picCard.filter(g=>g.eng>=3).sort((a,b)=>b.won/b.eng-a.won/a.eng||b.eng-a.eng), cHi=conv[0], cLo=conv[conv.length-1];
  N.pf=A.has.crm&&(n>=5||A.picCard.length>=2);
  N.pfTitle=[n>=8&&drop&&`Only ${drop.to[1]} of ${drop.from[1]} ${drop.from[0]==="Engagements logged"?"engagements":lc(drop.from[0]).replace(/^reached the lead$/,"reached leads").replace(/^showed interest$/,"interested leads")} ${drop.to[0]==="Reached the lead"?"were reached":drop.to[0]==="Showed interest"?"showed interest":"ordered"}`,
    NL.length&&`${NL.length} seller${NL.length>1?"s":""} with ${rp(nlG)} in orders log${NL.length>1?"":"s"} nothing in the CRM`,
    !NL.length&&cHi&&cLo&&cHi!==cLo&&cHi.won&&`${cHi.p} converts ${cHi.won} of ${cHi.eng}; ${cLo.p} ${cLo.won} of ${cLo.eng}`].filter(Boolean).slice(0,2).join("; ")||"Who sells, and how much of it the CRM sees";
  N.pfNotes=[
    A.calls.length>=5&&A.callsMissed&&`<b>${A.callsMissed} of ${A.calls.length} calls didn't connect.</b> Those leads never heard the offer; retry on WhatsApp before marking them.`,
    cHi&&cLo&&cHi!==cLo&&cHi.won&&cHi.won/cHi.eng-cLo.won/cLo.eng>=.3&&`<b>${esc(cHi.p)} turns ${pct(cHi.won,cHi.eng)}% of engagements into orders${cHi.topCh?`, mostly by ${esc(lc(cHi.topCh))}`:""};</b> ${esc(cLo.p)} turns ${pct(cLo.won,cLo.eng)}%${cLo.topCh?` (mostly ${esc(lc(cLo.topCh))})`:""}${cLo.warm?`, with ${cLo.warm} still considering`:""}. ${cLo.eng>=cHi.eng*.8?`Similar effort (${cLo.eng} engagements vs ${cHi.eng}), different method.`:`${cLo.eng} engagements vs ${cHi.eng}.`}`,
    NL.length&&`<b>${esc(andList(NL.map(g=>g.p)))} closed ${nlO} order${nlO>1?"s":""} (${rp(nlG)}) with no CRM entry.</b> The CRM can't explain ${pct(nlG,A.gmv||1)}% of GMV until they log their engagements.`,
    A.cycle.n>=3&&A.cycle.sameDay/A.cycle.n>=.7?`<b>${A.cycle.sameDay} of ${A.cycle.n} wins are dated the same day as their order.</b> The CRM records the sale, not the lead's journey, so it can't yet show how long leads take to buy.`
    :A.cycle.n>=2&&`<b>Wins ordered a median ${A.cycle.median} day${A.cycle.median===1?"":"s"} after the engagement</b>${A.cycle.sameDay?` (${A.cycle.sameDay} of ${A.cycle.n} the same day)`:""}${A.cycle.before?`; ${A.cycle.before} engagement${A.cycle.before>1?"s are":" is"} dated after the order, so ${A.cycle.before>1?"they were":"it was"} logged as a record, not a lead`:""}.`
  ].filter(Boolean).slice(0,4);

  // Order quality and timing
  if(A.has.sales&&A.orders.length>=3){
    const peak=A.daily.filter(d=>d.orders).sort((a,b)=>b.gmv-a.gmv)[0], big=A.bands.filter(b=>b.lo>=2e7), small=A.bands.filter(b=>b.hi<=5e6);
    const bigN=big.reduce((s,b)=>s+b.n,0), bigG=big.reduce((s,b)=>s+b.gmv,0), smN=small.reduce((s,b)=>s+b.n,0), smG=small.reduce((s,b)=>s+b.gmv,0);
    const dayName=d=>`${DAY[d.getDay()]} ${fds(d)}`;
    const c1=A.custAgg[0]?.gmv/(A.gmv||1)||0;
    N.oqTitle=[bigN&&bigG/A.gmv>=.5&&`${bigN} order${bigN>1?"s":""} above Rp20M ${bigN>1?"make":"makes"} ${pct(bigG,A.gmv)}% of GMV`,
      bigN===1&&Math.abs(c1-bigG/A.gmv)<.05?null:A.customers>=6?A.top3Share>=.4&&`the top 3 of ${A.customers} customers are ${Math.round(A.top3Share*100)}%`:c1>=.4&&`the largest customer is ${Math.round(c1*100)}%`,
      peak&&A.daily.filter(d=>d.orders).length>=3&&peak.gmv/A.gmv>=.35&&`${dayName(peak.d)} alone brought ${pct(peak.gmv,A.gmv)}%`].filter(Boolean).slice(0,2).join("; ").replace(/^./,c=>c.toUpperCase())||`${A.orders.length} orders, ${rp(A.gmv/A.orders.length)} on average`;
    N.oqNotes=[
      smN>=2&&bigN&&`<b>A few big orders carry the week.</b> ${smN} orders under Rp5M add up to ${pct(smG,A.gmv)}% of GMV; ${bigN} above Rp20M ${bigN>1?"bring":"brings"} ${pct(bigG,A.gmv)}%. Losing one large buyer moves the week more than many small ones.`,
      smN<2&&bigN>=3&&`<b>Orders are large.</b> ${bigN} of ${A.orders.length} orders are above Rp20M (${pct(bigG,A.gmv)}% of GMV); the smallest bands barely register.`,
      A.multiOrderCust&&`<b>${A.multiOrderCust} customer${A.multiOrderCust>1?"s":""} ordered more than once in the week</b>, so ${A.customers} customers placed ${A.orders.length} orders.`,
      A.discount>0&&`<b>Discounts: ${rp(A.discount)} (${(A.discount/(A.gmv||1)*100).toFixed(1)}% of GMV) on ${A.discOrders.length} order${A.discOrders.length>1?"s":""}.</b>${A.shipping>0?` Shipping charged: ${rp(A.shipping)} on ${A.shipOrders.length} order${A.shipOrders.length>1?"s":""}.`:""}`,
      A.logLag.n>=3&&A.logLag.late>=2&&`<b>CRM entries are written late.</b> ${A.logLag.late} of ${A.logLag.n} were last edited 3+ days after the engagement${A.logLag.wonMedian!=null&&A.logLag.restMedian!=null&&A.logLag.wonMedian-A.logLag.restMedian>=2?`; wins a median ${A.logLag.wonMedian} days later, other leads ${A.logLag.restMedian}`:""}. Late entries hide this week's pipeline until next week.`
    ].filter(Boolean).slice(0,3);
  }

  // Headline for the executive summary
  const dh=N.driver&&won?`${N.driver.hi.g} converts (${N.driver.hi.w} of ${N.driver.hi.n}); ${lc(N.driver.lo.g)} doesn't (${N.driver.lo.w} of ${N.driver.lo.n})`:null;
  const sF0=A.byFamily?.[0], sTail=sF0?` ${sF0.k} is ${pct(sF0.gmv,A.gmv||1)}% of GMV${A.outstanding>=A.gmv*.1?`, and ${rp(A.outstanding)} is still unpaid`:""}.`:"";
  N.headline=!A.has.sales&&won&&!nw?`${won} CRM engagement${won>1?"s":""} ended in an order`:A.has.sales?`${rp(A.gmv)} in sales last week.${dh?` ${dh}.`:sTail}`:dh||(n?`${pct(lost,n)}% of leads said no; ${warm} are still in play`:"Executive summary");
  // Findings (max 4)
  const F=[];
  if(N.driver){ const {hi,lo}=N.driver; F.push([`${N.driver.dim} separates winners from the rest`,`${hi.g}: ${hi.w} of ${hi.n} ${A.posLabel}. ${lo.g}: ${lo.w} of ${lo.n}.`]); }
  if(tTop&&lost) F.push([tTop.t==="Locked in elsewhere"?"Rejections are about loyalty, not product":`Top rejection theme: ${lc(tTop.t)}`,
    `${tTop.lost} of ${lost} “not interested” leads${tTop.t==="Locked in elsewhere"?" already buy from a shop, KUD or agent":` cite ${lc(tTop.t)}`}${sig("credit").lost?`; ${sig("credit").lost} buy on credit`:""}${sig("season").lost?`; ${sig("season").lost} already fertilized this season`:""}.`]);
  if(A.intentWarm.length>=2) F.push(["Warm leads are asking how to buy",`${A.intentWarm.length} of ${warm} leads in play asked about the warehouse, delivery or prices${A.unreachable?`; ${A.unreachable} could not be reached by phone`:""}.`]);
  if(A.has.sales&&A.outstanding>=A.gmv*.1) F.push([`${rp(A.outstanding)} of last week's sales is still unpaid`,`${A.partial.length} partially paid order${A.partial.length>1?"s":""} worth ${rp(A.partial.reduce((s,o)=>s+o.gmv,0))}; ${A.openOrders.length} of ${A.orders.length} orders are still open.`]);
  if(A.has.sales&&A.noCrm.length/A.orders.length>=.3) F.push(["The CRM misses most of the sales story",`${A.noCrm.length} of ${A.orders.length} orders (${rp(A.noCrm.reduce((s,o)=>s+o.gmv,0))}) have no CRM engagement${A.notLogging.length?`; ${A.notLogging.length} seller${A.notLogging.length>1?"s":""} logged none at all`:A.crmMap.potential?", and CRM wins carry no GMV":""}.`]);
  if(A.stockRows.length>=2) F.push(["Stock-outs cost real orders",`${A.stockRows.length} leads stalled because the product wasn't available or delivery was too slow.`]);
  if(!A.has.sales&&!won&&nw){ const ca=A.notWon.filter(r=>r.theme==="Just asking").length; if(ca/nw>=.5) F.push(["We don't know why leads say no",`${pct(ca,nw)}% of reasons are a catch-all, so the team can't fix the pitch.`]); }
  if(won&&A.has.sales) F.push([`${A.wonLinked.length} of ${won} CRM wins confirmed in sales`,`They became ${A.linkedOrders.length} order${A.linkedOrders.length===1?"":"s"} worth ${rp(A.linkedGmv)}${A.matchCounts.find(m=>m[0]==="value and date")?"; one is matched only by value and date":""}.`]);
  if(A.has.sales&&A.byFamily[0]) F.push([`${A.byFamily[0].k} is ${pct(A.byFamily[0].gmv,A.gmv)}% of GMV`,`${rp(A.gmv)} from ${A.orders.length} orders${A.topOrderShare>=.5?`; one order alone is ${pct(A.orders[0].gmv,A.gmv)}% of GMV`:""}.`]);
  if(A.wonFromNotes.length) F.push(["Closed deals are not marked as orders",`${A.wonFromNotes.length} win${A.wonFromNotes.length>1?"s are":" is"} still “${A.wonFromNotes[0].statusLogged||"blank"}” in the CRM although the notes say closing.`]);
  N.findings=F.slice(0,4);

  // Bottom line
  const lever=N.driver&&["source","channel"].includes(N.driver.k)&&won?`Put the team where wins happen: ${lc(N.driver.hi.g)}, not ${lc(N.driver.lo.g)}.`:null;
  N.bottom={p:lever||(warm?"Close the leads still in play before adding new ones.":nw?"Fix how we reach and qualify leads.":null),
    s:[A.intentWarm.length>=2&&`Call back the ${A.intentWarm.length} warm leads asking how to buy this week.`,A.stockRows.length>=2&&"Restock the products leads asked for.",
       tTop&&tTop.t==="Locked in elsewhere"&&"Stop cold-calling farmers who are tied to a KUD or shop."].filter(Boolean).join(" ")||"Better reason and value fields will sharpen next week's analysis."};

  // Actions (max 4, in priority order)
  const act=[]; const warmPic=countBy(A.warm,r=>r.pic)[0]?.[0];
  if(N.driver&&won&&["source","channel"].includes(N.driver.k)){ const {hi,lo}=N.driver;
    act.push({t:`Move effort from ${lc(lo.g)} to ${lc(hi.g)}`,d:`${hi.g} turned ${hi.w} of ${hi.n} engagements into orders; ${lc(lo.g)} turned ${lo.w} of ${lo.n}. Shift part of next week's ${lc(lo.g)} list to ${lc(hi.g)} and compare results.`,o:"Team lead",w:"Next week"}); }
  if(A.intentWarm.length>=2) act.push({t:`Close ${A.intentWarm.length} warm leads within 48 hours`,d:`They asked about the warehouse, delivery or prices.${A.unreachable?` ${A.unreachable} could not be reached by phone, so send the price list and warehouse location on WhatsApp, then follow up.`:""}`,o:warmPic||"Lead PIC",w:"This week"});
  if(tTop&&tTop.t==="Locked in elsewhere"&&tTop.lost>=3) act.push({t:"Stop competing head-on with KUDs and shops",d:`${tTop.lost} rejections are tied to an existing shop, KUD or agent${sig("credit").lost?`, ${sig("credit").lost} of them buying on credit`:""}. Test a KUD partnership or payment terms, and drop these numbers from this season's call lists.`,o:"Sales lead",w:"Next 2 weeks"});
  if(A.stockRows.length>=2){ const pr=productsIn(A.stockRows).slice(0,3); act.push({t:"Restock what leads asked for",d:`${A.stockRows.length} leads stalled on availability or a 7–14 day delivery${pr.length?`: ${andList(pr)}`:""}. Confirm stock before promising, and offer warehouse pickup.`,o:"Supply & ops",w:"This week"}); }
  if(A.has.sales&&A.outstanding>=A.gmv*.05) act.push({t:`Collect ${rp(A.outstanding)} still unpaid`,d:`${A.partial.length} order${A.partial.length>1?"s are":" is"} only partially paid. Confirm payment dates before the next delivery to these customers.`,o:"Finance + order PIC",w:"This week"});
  if(A.has.sales&&A.noCrm.length/A.orders.length>=.3) act.push({t:"Log every order in the CRM",d:`${A.noCrm.length} of ${A.orders.length} orders have no engagement record${A.notLogging.length?`, including every order from ${andList(A.notLogging.map(g=>g.p))}`:""}. Log engagements on the same day and add the order number, so wins carry their GMV.`,o:"Sales ops",w:"Next form update"});
  if(warm&&!A.intentWarm.length) act.push({t:`Book dated follow-ups for ${warm} leads in play`,d:"Agree a concrete next step with each lead and log a follow-up date.",o:warmPic||"Lead PIC",w:"This week"});
  if(nw&&A.notWon.filter(r=>r.theme==="Just asking").length/nw>=.3) act.push({t:"Replace the catch-all reason",d:"Make the reason a required dropdown: price, no need yet (with a revisit month), has a supplier, tied to KUD, out of stock, unreachable. Drop “just asking”.",o:"Sales ops",w:"Next form update"});
  const tests=A.byFamily?.find(f=>/test/i.test(f.k));
  if(tests) act.push({t:`Turn ${tests.cust} test customer${tests.cust>1?"s":""} into fertilizer orders`,d:`Leaf and soil tests (${rp(tests.gmv)}) end in a fertilizer recommendation. Book a follow-up when results are ready and quote the recommended products.`,o:countBy(A.orders.filter(o=>o.lines.some(l=>l.family===tests.k)),o=>o.pic)[0]?.[0]||"Test PIC",w:"When results are in"});
  if(A.has.sales&&A.topOrderShare>=.5&&A.orders.length>1) act.push({t:"Widen the base beyond one large order",d:`One order is ${pct(A.orders[0].gmv,A.gmv)}% of GMV. Line up repeat orders from the other ${A.orders.length-1} customers so next week doesn't depend on a single deal.`,o:"Team lead",w:"Next 2 weeks"});
  if(A.wonFromNotes.length) act.push({t:"Mark closed deals as orders in the CRM",d:`${A.wonFromNotes.length} closed deal${A.wonFromNotes.length>1?"s are":" is"} still logged as “${A.wonFromNotes[0].statusLogged||"blank"}”. Update the status and add the order number, so wins are counted automatically.`,o:"Sales ops",w:"This week"});
  N.actions=act.slice(0,6);
  if(!N.bottom.p) N.bottom.p=N.actions[0]?`${N.actions[0].t}.`:"Keep logging every engagement so wins and losses can be compared.";

  // Data gaps
  const g=[]; const fill=k=>A.crm.filter(r=>r[k]!==null&&r[k]!==undefined).length/(n||1);
  if(A.nostatus.length) g.push(`${A.nostatus.length} engagement${A.nostatus.length>1?"s":""} without a status`);
  const chMiss=A.crm.filter(r=>!r.channel).length; if(chMiss) g.push(`${chMiss} without an engagement type`);
  const low=["potential","needKg","followDate","location","custType"].filter(k=>A.crmMap[k]&&fill(k)<.3).map(k=>({potential:"potential GMV",needKg:"fertilizer needs",followDate:"follow-up date",location:"location",custType:"customer type"}[k]));
  if(low.length) g.push(`${andList(low)} mostly empty`);
  if(A.wonFromNotes.length) g.push(`${A.wonFromNotes.length} closed deal${A.wonFromNotes.length>1?"s":""} still marked “${A.wonFromNotes[0].statusLogged||"blank"}”`);
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
const roleName=k=>String(k).toLowerCase().replace(/_/g," ").replace(/^./,c=>c.toUpperCase());
const OUT_COLOR={"Ordered":"#274E13","Considering / prospect":"#D9A21B","Not interested":"#8E9C84"};

// Slides for one team. `pre` prefixes each kicker ("Smallholder · ") when the deck covers several teams.
function teamSlides(A,N,pre,S,next){
  // Success story
  if(A.won.length){
    const mini=k=>{const c=countBy(A.won,r=>r[k]);return c.length?`<div class="mini"><h4>${esc(LABEL[k])}</h4>${hbars(c.slice(0,3).map(([g,v])=>({k:g,v})),{scale:A.won.length,right:i=>pct(i.v,A.won.length)+"%"})}</div>`:""};
    const rows=A.has.sales?A.linkedOrders.slice(0,5).map(o=>`<tr><td>${esc(o.no)}</td><td>${esc(o.pic||"–")}</td><td>${esc(o.items.slice(0,2).join(", "))}${o.items.length>2?` +${o.items.length-2}`:""}</td><td class="num">${rp(o.gmv)}</td><td>${!A.hasCustStatus?"–":o.isNew?`<span class="pill">New</span>`:"Repeat"}</td></tr>`).join("")
      :A.won.slice(0,6).map(r=>`<tr><td>${esc(r.id||"–")}</td><td>${esc(r.pic||"–")}</td><td>${esc(r.channel||"–")}</td><td>${esc(r.source||"–")}</td><td>${esc((r.detail||"").slice(0,60))}</td></tr>`).join("");
    const newWon=A.linkedOrders.filter(o=>o.isNew).length;
    S.push(contentSlide(next(),pre+"Success story",N.winTitle,`
      <div style="display:grid;grid-template-columns:.85fr 1.45fr;gap:18px;align-items:start">
        <div class="card"><h3>How the ${A.won.length} wins happened</h3><p class="sub">Share of CRM engagements that ended in an order</p>${["channel","source"].map(mini).join("")}</div>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div class="stats3">${[{v:`${A.wonLinked.length}`,u:`/${A.won.length}`,l:"Wins confirmed in sales data",hot:true},{v:rpParts(A.linkedGmv)[0],u:rpParts(A.linkedGmv)[1],l:`GMV of ${A.linkedOrders.length} matched orders`},
            A.hasCustStatus?{v:String(newWon),u:`/${A.linkedOrders.length}`,l:"Matched orders from new customers"}:{v:String(A.wonFromNotes.length||A.won.length),u:`/${A.won.length}`,l:A.wonFromNotes.length?"Wins found only in the notes (“Closing …”)":"Wins with a CRM status of ordered"}].map(k=>A.has.sales?kpiHtml(k):"").join("")}</div>
          <div class="card" style="padding:14px 16px"><table class="tbl"><thead><tr>${(A.has.sales?["Order","PIC","Products","GMV","Customer"]:["ID","PIC","Channel","Source","Notes"]).map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>
          <p class="sub" style="margin:8px 0 0">${A.has.sales?`Matched by ${andList(A.matchCounts.filter(m=>A.won.some(r=>r.matchBy===m[0])).map(([k])=>`${k} (${A.won.filter(r=>r.matchBy===k).length})`))}.${A.wonFromNotes.length?` ${A.wonFromNotes.length} counted as wins from “Closing” in the notes.`:""}${A.linkedOrders.length>5?` Top 5 of ${A.linkedOrders.length} by GMV.`:""}`:"Upload the sales file to see what these wins were worth."}</p></div></div></div>`));
  }

  // Sales: what sold
  if(A.has.sales){
    const O=A.orders, Q=A.qtyTotal||1, F0=A.byFamily[0], sp=A.priceSpread[0], pair=A.pairs[0];
    S.push(contentSlide(next(),pre+"Sales last week · what sold",N.soldTitle,`
      <div style="display:grid;grid-template-columns:1.1fr 1.1fr .85fr;gap:16px;align-items:start">
        <div class="card"><h3>GMV by product type</h3><p class="sub">Grouped from item names; units in grey</p>${hbars(A.byFamily.slice(0,7).map(x=>({k:x.k,v:x.gmv,q:x.qty})),{fmt:rp,right:i=>`${nf.format(i.q)} units`})}</div>
        <div class="card"><h3>GMV by product category</h3><p class="sub">“product_cat” in the sales export; orders in grey</p>${hbars(A.byCat.slice(0,7).map(x=>({k:x.k,v:x.gmv,o:x.orders})),{fmt:rp,right:i=>`${i.o} order${i.o>1?"s":""}`,color:"#6E8F5A"})}
          ${N.catLine?`<p class="sub" style="margin:14px 0 0">${esc(N.catLine)}</p>`:""}</div>
        <div style="display:flex;flex-direction:column;gap:12px">
          ${F0?(A.unitsAnchor?kpiHtml({v:String(pct(F0.qty,Q)),u:"%",l:`of all units sold are ${F0.k} (${nf.format(F0.qty)} of ${nf.format(Q)})`,hot:true}):kpiHtml({v:String(pct(F0.gmv,A.gmv)),u:"%",l:`of GMV is ${F0.k}${A.orders.filter(o=>o.lines.some(l=>l.family===F0.k)).length===1?", from a single order":""}`,hot:true})):""}
          ${kpiHtml({v:A.itemsPerOrder.toFixed(1),u:"",l:`products per order; ${A.multiFamily} of ${O.length} orders mix product types${pair?`, most often ${pair[0]}`:""}`})}
          ${sp&&sp.spread>=.05?kpiHtml({v:"+"+Math.round(sp.spread*100),u:"%",l:`price gap on ${sp.item} across ${sp.n} order lines (${rp(sp.min)}–${rp(sp.max)} per unit)`})
            :kpiHtml({v:rpParts(A.gmv/(O.length||1))[0],u:rpParts(A.gmv/(O.length||1))[1],l:"average order value"})}
        </div></div>`));

    // Sales: who bought and how
    const appName=k=>({WEB:"Web",PETANI:"Petani app","SAWITPRO-RETAIL":"SawitPRO retail","SAWITPRO-BISNIS":"SawitPRO bisnis"}[String(k).toUpperCase()]||k);
    const segTable=(title,rows)=>`<table class="tbl seg"><thead><tr><th>${title}</th><th>Orders</th><th>GMV</th><th>Avg order</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.k)}</td><td class="num">${x.n}</td><td class="num">${rp(x.gmv)}</td><td class="num">${rp(x.aov)}</td></tr>`).join("")}</tbody></table>`;
    const parG=A.partial.reduce((s,o)=>s+o.gmv,0), openG=A.openOrders.reduce((s,o)=>s+o.gmv,0), ncG=A.noCrm.reduce((s,o)=>s+o.gmv,0);
    S.push(contentSlide(next(),pre+"Sales last week · who bought and how",N.whoTitle,`
      <div style="display:grid;grid-template-columns:1fr 1.15fr .8fr;gap:16px;align-items:start">
        ${A.byRegion.length?`<div class="card"><h3>GMV by customer region</h3><p class="sub">${esc(A.byProvince.map(p=>`${p.k} ${pct(p.gmv,A.gmv)}%`).join(" · "))}; customers in grey</p>${hbars(A.byRegion.slice(0,7).map(x=>({k:x.k,v:x.gmv,c:x.cust})),{fmt:rp,right:i=>`${i.c} cust.`})}`
          :`<div class="card"><h3>GMV by customer role</h3><p class="sub">No region in this export; orders in grey</p>${hbars(A.byRole.map(x=>({k:roleName(x.k),v:x.gmv,o:x.n})),{fmt:rp,right:i=>`${i.o} order${i.o>1?"s":""}`})}`}
          ${N.regionNote&&A.byRegion.length?`<p class="sub" style="margin:12px 0 0">${esc(N.regionNote)}</p>`:""}</div>
        <div class="card" style="display:flex;flex-direction:column;gap:12px"><div><h3>How they ordered</h3><p class="sub" style="margin-bottom:8px">Average order value by ordering channel and customer type</p>
          ${A.byApp.length?segTable("Channel",A.byApp.map(x=>({...x,k:appName(x.k)}))):""}</div>${A.byCust.length?segTable("Customer",A.byCust):""}
          <div><h4 class="mini-h">Sales PIC</h4>${hbars(A.byPic.slice(0,4).map(x=>({k:x.p,v:x.g,o:x.n})),{fmt:rp,right:i=>`(${i.o})`,color:"#6E8F5A"})}</div></div>
        <div style="display:flex;flex-direction:column;gap:12px">
          ${A.partial.length?kpiHtml({v:rpParts(A.outstanding||parG)[0],u:rpParts(A.outstanding||parG)[1],l:A.outstanding?`still unpaid on ${A.partial.length} partially paid orders (${rp(parG)} GMV)`:`GMV on ${A.partial.length} partially paid orders`,hot:true}):""}
          ${A.openOrders.length?kpiHtml({v:String(A.openOrders.length),u:`/${O.length}`,l:`orders still open, not completed (${rp(openG)})`}):""}
          ${A.has.crm?kpiHtml({v:String(A.noCrm.length),u:`/${O.length}`,l:`orders with no CRM engagement (${rp(ncG)})`}):kpiHtml({v:String(pct(A.top2,A.gmv)),u:"%",l:"of GMV from the top 2 orders"})}
        </div></div>`));
  }

  // Sales: order quality and timing
  if(N.oqNotes){
    const days=A.daily.filter(d=>d.orders||d.eng), dl=d=>`${DAY[d.getDay()]} ${fds(d)}`;
    S.push(contentSlide(next(),pre+"Sales last week · order size and timing",N.oqTitle,`
      <div style="display:grid;grid-template-columns:1.05fr 1fr .85fr;gap:16px;align-items:start">
        <div class="card"><h3>GMV by day</h3><p class="sub">Order date; orders and CRM engagements that day in grey</p>${hbars(days.map(d=>({k:dl(d.d),v:d.gmv,o:d.orders,e:d.eng})),{fmt:rp,right:i=>`${i.o} ord.${A.has.crm?` · ${i.e} CRM`:""}`})}</div>
        <div class="card"><h3>Orders by size</h3><p class="sub">Number of orders; share of GMV in grey</p>${hbars(A.bands.map(b=>({k:b.k,v:b.n,g:b.gmv})),{right:i=>`${pct(i.g,A.gmv)}% GMV`,color:"#6E8F5A"})}</div>
        <div style="display:flex;flex-direction:column;gap:12px">
          ${kpiHtml(A.customers>=6?{v:String(Math.round(A.top3Share*100)),u:"%",l:`of GMV from the top 3 of ${A.customers} customers`,hot:true}:{v:String(pct(A.custAgg[0]?.gmv||0,A.gmv)),u:"%",l:`of GMV from the largest of ${A.customers} customers`,hot:true})}
          ${A.cycle.n?kpiHtml({v:String(A.cycle.median),u:" days",l:`median from CRM engagement to order (${A.cycle.n} matched wins)`})
            :kpiHtml({v:rpParts(A.gmv/(A.orders.length||1))[0],u:rpParts(A.gmv/(A.orders.length||1))[1],l:"average order value"})}
          ${A.discount>0?kpiHtml({v:(A.discount/(A.gmv||1)*100).toFixed(1),u:"%",l:`of GMV given as discount (${rp(A.discount)}, ${A.discOrders.length} orders)`})
            :kpiHtml({v:String(A.multiOrderCust),u:`/${A.customers}`,l:"customers who ordered more than once"})}
        </div></div>
      ${N.oqNotes.length?`<div class="caveat tight" style="margin-top:14px">${N.oqNotes.join("<br>")}</div>`:""}`));
  }

  // Rejection reasons in detail
  if(A.reasonRows.length){
    const RL=A.reasonList.slice(0,7), dims=A.reasonDims, more=A.reasonList.length-RL.length;
    const cols=dims.flatMap(k=>countBy(A.reasonRows.filter(r=>r[k]),r=>r[k]).slice(0,3).map(([g])=>({k,g})));
    const mx=Math.max(1,...RL.flatMap(r=>cols.map(c=>A.reasonRows.filter(x=>x.reason===r.k&&x[c.k]===c.g).length)));
    const cell=v=>`<td class="heat" style="background:rgba(74,101,59,${v?(.12+.78*v/mx).toFixed(2):0});color:${v/mx>.5?"#fff":"var(--ink)"}">${v||""}</td>`;
    S.push(contentSlide(next(),pre+"Rejection reasons last week",N.rrTitle,`
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
    S.push(contentSlide(next(),pre+"What the reasons mean",N.reasonTitle,`
      <div style="display:grid;grid-template-columns:1fr 1.1fr;gap:18px">
        <div class="card"><h3>Reasons, grouped by what would fix them</h3><p class="sub">${A.notWon.length} engagements that did not order; hover a bar for the original reasons</p>${legendOf([["Not interested","#8E9C84"],["Considering / prospect","#D9A21B"]])}${hbars(tb,{right:i=>pct(i.v,A.notWon.length)+"%"})}</div>
        <div class="card"><h3>What the discussion notes say</h3><p class="sub">Signals read from “Detail pembahasan”, by lead status</p>${A.signals.length?legendOf([["Not interested","#8E9C84"],["Considering / prospect","#D9A21B"]])+hbars(A.signals.slice(0,6).map(x=>({k:x.label,v:x.n,segs:[[x.lost,"#8E9C84",`not interested: ${x.lost}`],[x.warm,"#D9A21B",`considering / prospect: ${x.warm}`]]})),{}):`<div class="empty">No discussion notes in this data</div>`}</div></div>`));
  }

  // Won vs the rest
  if(N.driver){
    const D=N.driver, gs=A.best.groups.filter(x=>x.g!=="(not filled)");
    S.push(contentSlide(next(),pre+"What separates winners",`${D.dim} decides the outcome. ${N.driverTitle}`,`
      <div style="display:grid;grid-template-columns:.85fr 1.4fr;gap:18px">
        <div class="card"><h3>Share ${A.posLabel}, by ${esc(lc(D.dim))}</h3><p class="sub">Across ${A.crm.filter(r=>r.outcome).length} CRM engagements with a status</p>${hbars(gs.map(g=>({k:g.g,v:Math.round(g.rate*100),w:g.w,n:g.n})),{fmt:v=>v+"%",right:i=>`${i.w} of ${i.n}`,scale:100})}</div>
        <div class="card" style="padding:14px 16px"><table class="tbl"><thead><tr><th>Most common</th>${A.cohorts.map(([c,rs])=>`<th><i class="dot" style="background:${OUT_COLOR[c]}"></i>${esc(c)} (${rs.length})</th>`).join("")}</tr></thead>
          <tbody>${A.profile.map(p=>`<tr><td class="dim">${esc(LABEL[p.k])}</td>${p.vals.map(v=>`<td>${esc(v.v)}<span class="sh">${Math.round(v.share*100)}%</span></td>`).join("")}</tr>`).join("")}</tbody></table></div></div>
      <div class="caveat" style="margin-top:14px">${N.caveat}</div>`));
  }

  // Team performance: funnel and PIC scorecard
  if(N.pf){
    const FU=A.funnel, hasC=A.has.crm, hasS=A.has.sales;
    const head=["PIC",...(hasC?["CRM eng.","Reached","Won · warm · lost"]:[]),...(hasS?["Orders","GMV"]:[]),...(hasC&&hasS?["Orders in CRM"]:[])];
    const rows=A.picCard.slice(0,7).map(g=>[esc(g.p),...(hasC?[g.eng||"–",g.eng?`${pct(g.reached,g.eng)}%`:"–",g.eng?`${g.won} · ${g.warm} · ${g.lost}`:"–"]:[]),...(hasS?[g.orders||"–",g.orders?rp(g.gmv):"–"]:[]),...(hasC&&hasS?[g.orders?(g.inCrm?`${g.inCrm} of ${g.orders}`:`<span class="pill">0 of ${g.orders}</span>`):"–"]:[])]);
    S.push(contentSlide(next(),pre+"Team performance · funnel and PIC scorecard",N.pfTitle,`
      <div style="display:grid;grid-template-columns:.8fr 1.5fr;gap:18px;align-items:start">
        <div class="card"><h3>CRM funnel</h3><p class="sub">Share of all engagements logged; step conversion in grey</p>${hasC?hbars(FU.map((f,i)=>({k:f[0],v:f[1],r:i?pct(f[1],FU[i-1][1]):null})),{scale:FU[0][1]||1,right:i=>i.r==null?"":`${i.r}% of previous`}):`<div class="empty">Upload a CRM file to see the funnel</div>`}</div>
        <div class="card" style="padding:14px 16px"><table class="tbl"><thead><tr>${head.map((h,i)=>`<th${i?' class="num"':""}>${h}</th>`).join("")}</tr></thead>
          <tbody>${rows.map(r=>`<tr>${r.map((c,i)=>`<td${i?' class="num"':""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>
          <p class="sub" style="margin:8px 0 0">PIC names as written in the CRM and sales exports${A.picCard.length>7?`; top 7 of ${A.picCard.length}`:""}.</p></div></div>
      ${N.pfNotes.length?`<div class="caveat tight" style="margin-top:14px">${N.pfNotes.join("<br>")}</div>`:""}`));
  }

  // Recoverable demand
  if(A.warm.length){
    const SL=Object.fromEntries(SIGNALS.map(s=>[s[0],s[1]]));
    const rows=A.warm.slice().sort((a,b)=>b.signals.length-a.signals.length).slice(0,5);
    S.push(contentSlide(next(),pre+"Recoverable demand",N.warmTitle,`
      <div class="stats4">${[{v:String(A.warm.length),u:"",l:"Considering or prospect",hot:true},{v:String(A.intentWarm.length),u:"",l:"Asked about warehouse, delivery or price"},
        {v:String(A.warm.filter(r=>/unable|tidak bisa/i.test(r.callResp||"")).length),u:"",l:"Could not be reached by phone"},{v:String(A.stockRows.length),u:"",l:"Stalled on stock or delivery time"}].map(kpiHtml).join("")}</div>
      <div class="card" style="margin-top:14px;padding:14px 16px"><table class="tbl"><thead><tr><th>ID</th><th>PIC</th><th>Channel</th><th>Status</th><th>What they asked or said</th></tr></thead><tbody>
        ${rows.map(r=>`<tr><td style="white-space:nowrap">${esc(r.id||"–")}</td><td>${esc(r.pic||"–")}</td><td style="white-space:nowrap">${esc(r.channel||"–")}</td><td><span class="pill">${esc(r.status)}</span></td><td>${esc(r.signals.map(s=>SL[s]).join("; ")||r.reason||"–")}</td></tr>`).join("")}</tbody></table>
        <p class="sub" style="margin:8px 0 0">${A.warm.length>rows.length?`${rows.length} of ${A.warm.length} shown. `:""}Names and phone numbers are left out; look leads up by ID in the CRM.</p></div>`));
  }

}

/* ================= Whole deck (one or more teams) ================= */
function deckNarrative(T){
  const X={multi:T.length>1}, all=T.map(t=>t.A);
  X.dates=all.flatMap(A=>A.dates).sort((a,b)=>a-b); X.period=span(X.dates);
  if(!X.multi){ const N=T[0].N; return Object.assign(X,{eyebrow:N.team,title:N.title,meta:N.meta,headline:N.headline,kpis:N.kpis,findings:N.findings,bottom:N.bottom,
      actions:N.actions.map(a=>({...a})),gaps:N.gaps}); }
  const gmv=all.reduce((s,A)=>s+A.gmv,0), orders=all.reduce((s,A)=>s+A.orders.length,0), crm=all.reduce((s,A)=>s+A.crm.length,0);
  const won=all.reduce((s,A)=>s+A.won.length,0), wonL=all.reduce((s,A)=>s+A.wonLinked.length,0);
  X.eyebrow="Weekly Sales Review"; X.title=`${andList(T.map(t=>t.name))} Last Week`;
  X.meta=[orders&&`${orders} orders`,crm&&`${crm} CRM engagements`,`${T.length} teams`].filter(Boolean).join(" · ");
  X.headline=gmv?`${rp(gmv)} in sales last week: ${T.map(t=>`${t.name} ${rp(t.A.gmv)}`).join(", ")}`:`${crm} CRM engagements across ${T.length} teams`;
  X.kpis=[{v:rpParts(gmv)[0],u:rpParts(gmv)[1],l:`Total GMV from ${orders} orders`,hot:true},
    ...T.slice(0,2).map(t=>({v:rpParts(t.A.gmv)[0],u:rpParts(t.A.gmv)[1],l:`${t.name}: ${t.A.orders.length} orders, ${pct(t.A.gmv,gmv)}% of GMV`})),
    {v:String(wonL),u:`/${won}`,l:"CRM wins confirmed in sales data"}];
  // two findings per team, labelled with the team
  X.findings=T.flatMap(t=>t.N.findings.slice(0,T.length>2?1:2).map(f=>[`${t.name}: ${f[0]}`,f[1]])).slice(0,4);
  X.bottom={p:`${T[0].name}: ${T[0].N.bottom.p}`,s:T.slice(1).map(t=>`${t.name}: ${t.N.bottom.p}`).join(" ")};
  // actions: up to 4 from the first team, 2 from the others, then fill to 6
  const take=T.map((t,i)=>t.N.actions.map(a=>({...a,team:t.name})).slice(0,i===0?4:2)), rest=T.map((t,i)=>t.N.actions.map(a=>({...a,team:t.name})).slice(i===0?4:2));
  X.actions=[...take.flat(),...rest.flat()].slice(0,6);
  X.gaps=T.flatMap(t=>t.N.gaps.map(g=>`${t.name}: ${g}`));
  // team comparison
  const cov=t=>t.A.orders.length?(t.A.orders.length-t.A.noCrm.length)/t.A.orders.length:null;
  const withCov=T.filter(t=>t.A.has.crm&&t.A.has.sales&&t.A.orders.length), best=withCov.slice().sort((a,b)=>cov(b)-cov(a));
  const lead=T.slice().sort((a,b)=>b.A.gmv-a.A.gmv)[0];
  X.cmpTitle=`${lead.name} drives ${pct(lead.A.gmv,gmv)}% of GMV`+(best.length>=2&&cov(best[0])-cov(best[best.length-1])>=.25
    ?`; ${best[0].name} records ${best[0].A.orders.length-best[0].A.noCrm.length} of ${best[0].A.orders.length} orders in the CRM vs ${best[best.length-1].A.orders.length-best[best.length-1].A.noCrm.length} of ${best[best.length-1].A.orders.length}`:"");
  const F=(t)=>t.A.byFamily?.[0];
  X.cmpRows=[
    ["Sales GMV",T.map(t=>t.A.has.sales?rp(t.A.gmv):"–")],
    ["Orders · customers",T.map(t=>t.A.has.sales?`${t.A.orders.length} · ${t.A.customers}`:"–")],
    ["Average order value",T.map(t=>t.A.orders.length?rp(t.A.gmv/t.A.orders.length):"–")],
    ["Top product type",T.map(t=>F(t)?`${F(t).k} (${pct(F(t).gmv,t.A.gmv)}%)`:"–")],
    ["Largest order share of GMV",T.map(t=>t.A.orders.length?`${pct(t.A.orders[0].gmv,t.A.gmv)}%`:"–")],
    ["CRM engagements logged",T.map(t=>t.A.crm.length?`${t.A.crm.length} (${t.A.won.length} won, ${t.A.lost.length} not interested)`:"–")],
    ["CRM wins confirmed in sales",T.map(t=>t.A.won.length&&t.A.has.sales?`${t.A.wonLinked.length} of ${t.A.won.length} · ${rp(t.A.linkedGmv)}`:"–")],
    ["Orders with a CRM record",T.map(t=>t.A.has.crm&&t.A.orders.length?`${t.A.orders.length-t.A.noCrm.length} of ${t.A.orders.length}`:"–")],
    ["Still unpaid",T.map(t=>t.A.has.sales?(t.A.outstanding?rp(t.A.outstanding):"Nothing"):"–")],
  ];
  return X;
}
function dividerSlide(no,label,title,meta){
  return `<div class="slide divider"><img class="bg" src="${IMG.divider}" alt=""><div class="txt"><p class="eyebrow">${esc(label)}</p><p class="title">${esc(title)}</p>${meta?`<p class="dmeta">${esc(meta)}</p>`:""}</div><div class="num">${String(no).padStart(2,"0")}</div></div>`;
}
function buildDeck(T,X){
  const S=[], next=()=>S.length+1;
  S.push(`<div class="slide cover"><img class="bg" src="${IMG.cover}" alt=""><div class="shade"></div><img class="wm" src="${IMG.wm}" alt="SawitPRO.id">
    <div class="band"></div><div class="disc"><img src="${IMG.logo}" alt=""></div>
    <div class="txt"><p class="eyebrow">${esc(X.eyebrow)}</p><p class="title">${esc(X.title)}</p></div>
    <div class="meta">${esc(X.period)} · ${esc(X.meta)}</div></div>`);
  S.push(contentSlide(next(),"Executive summary",X.headline,`
    <div class="kpis">${X.kpis.map(kpiHtml).join("")}</div>
    <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:18px;margin-top:18px">
      <div class="card"><div class="findings">${X.findings.map(f=>`<div class="find"><span class="mk"></span><div><b>${esc(f[0])}</b><p>${esc(f[1])}</p></div></div>`).join("")}</div></div>
      <div class="bottom"><span class="lb">Bottom line</span><p>${esc(X.bottom.p)}</p><small>${esc(X.bottom.s)}</small></div></div>`));
  if(X.multi){
    const tot=T.reduce((s,t)=>s+t.A.gmv,0), TC=["#274E13","#D9A21B","#6E8F5A","#5B7F95"];
    S.push(contentSlide(next(),"Teams at a glance",X.cmpTitle,`
      ${tot?`<div class="card" style="padding:14px 18px;margin-bottom:14px"><h3 style="margin-bottom:8px">Share of GMV</h3><div class="stack-big">${T.map((t,i)=>`<div class="seg" style="flex:${t.A.gmv||0.0001};background:${TC[i]}" data-tip="${esc(`${t.name}: ${rp(t.A.gmv)}`)}">${t.A.gmv/tot>.12?`${esc(t.name)} · ${rp(t.A.gmv)} (${pct(t.A.gmv,tot)}%)`:""}</div>`).join("")}</div>
        <div class="legend" style="margin:8px 0 0">${T.map((t,i)=>`<span><i style="background:${TC[i]}"></i>${esc(t.name)}: ${rp(t.A.gmv)} (${pct(t.A.gmv,tot)}%)</span>`).join("")}</div></div>`:""}
      <div class="card" style="padding:14px 16px"><table class="tbl cmp"><thead><tr><th></th>${T.map(t=>`<th>${esc(t.name)}</th>`).join("")}</tr></thead>
        <tbody>${X.cmpRows.map(([k,v])=>`<tr><td class="dim">${esc(k)}</td>${v.map(x=>`<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`));
  }
  T.forEach((t,i)=>{
    if(X.multi) S.push(dividerSlide(i+1,`Team ${i+1}`,t.name,[t.A.has.sales&&`${rp(t.A.gmv)} from ${t.A.orders.length} orders`,t.A.crm.length&&`${t.A.crm.length} CRM engagements`].filter(Boolean).join(" · ")));
    teamSlides(t.A,t.N,X.multi?`${t.name} · `:"",S,next);
  });
  S.push(contentSlide(next(),"Next steps",`${X.actions.length} actions for the coming week`,`
    <div class="act${X.actions.length>4?" act3":""}">${X.actions.map((a,i)=>`<div class="card"><h3><span>${i+1}</span>${esc(a.t)}</h3><p>${esc(a.d)}</p><div class="meta">${a.team?`<span class="team">${esc(a.team)}</span>`:""}<span>Owner: ${esc(a.o)}</span><span class="when">${esc(a.w)}</span></div></div>`).join("")}</div>
    ${X.gaps.length?`<div class="gaps"><b>Also clean up in the CRM:</b> ${esc(X.gaps.join("; "))}.</div>`:""}`));
  S.push(`<div class="slide closing"><img class="bg" src="${IMG.closing}" alt=""><div class="shade"></div><img class="wm" src="${IMG.wm}" alt="SawitPRO.id"><img class="lg" src="${IMG.logo}" alt="">
    <div class="box"><h2>Thank You</h2><p>#TerusTumbuh</p></div></div>`);
  return S;
}
