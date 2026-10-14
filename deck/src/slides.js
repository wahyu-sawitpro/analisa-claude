// Next steps are suggestions built from the data: marked [DRAFT], with owner and date left for the team to agree.
const draftActs=acts=>acts.map(a=>({...a,t:/^\[DRAFT\]/.test(a.t)?a.t:`[DRAFT] ${a.t}`,o:"[to be agreed]",w:"[date to be agreed]"}));
/* ================= Narrative (shared by HTML and PPTX) ================= */
const lc=s=>String(s).replace(/^\S+/,w=>/^[A-Z][a-z-]*$/.test(w)?w.toLowerCase():w);
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
  N.sk=A.mode==="trend"&&A.trend?`Sales ${A.trend.label}`:"Sales last week";
  N.rk=A.mode==="crm"?"Rejection reasons":"Rejection reasons last week";

  // KPI strip
  if(A.has.sales) N.kpis=[
      {v:rpParts(A.gmv)[0],u:rpParts(A.gmv)[1],l:`Sales GMV from ${A.orders.length} orders${A.wow&&A.wow.p.gmv?` (${A.wow.dG>=0?"▲":"▼"} ${Math.abs(Math.round(A.wow.pct*100))}% vs the week before)`:""}`,hot:true},
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
    const uni=new Set((A.uniform||[]).map(x=>x.p)), spG=sp?sp.groups.filter(g=>!(sp.k==="pic"&&uni.has(g.g))):[];
    N.rrTitle=spG.length?spG.slice(0,2).map(g=>`${g.g}: ${g.tn} of ${g.n} ${TL[g.theme]||lc(g.theme)}`).join(". ")+"."
      :`“${r0.k}” is the most common reason (${r0.n} of ${A.reasonRows.length})`;
    N.rrNotes=[
      spG.length&&`<b>${esc(LABEL[sp.k])} predicts the reason.</b> ${esc(spG.slice(0,5).map(g=>`${g.g} (${g.n}): mostly ${TL[g.theme]||lc(g.theme)}`).join("; "))}. The answer depends on which list is being worked, so fix the list, not the pitch.`,
      A.uniform?.length&&`<b>Check the entries of ${esc(andList(A.uniform.map(x=>`${x.p} (${x.same} of ${x.n})`)))}:</b> nearly all have the same status and reason, which looks like a form default rather than what each lead said.`,
      A.askTotal>=3&&A.askUnreach&&`<b>“Just asking” is partly a logging habit.</b> ${A.askUnreach} of ${A.askTotal} were recorded when the call didn't connect, so no reason was actually heard.`,
      A.locHot&&`<b>${esc(A.locHot.g)}</b>: ${A.locHot.tn} of ${A.locHot.n} engagements there are ${esc(TL[A.locHot.theme]||lc(A.locHot.theme))}.`
    ].filter(Boolean).slice(0,3);
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
    A.noResult&&`<b>${A.noResult} phone or WhatsApp engagements have no call result logged,</b> so they are not counted as reached. Face-to-face visits count as reached.`,
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

  const wk=A.weekStart, wkEnd=wk&&new Date(+wk+6*864e5);
  N.outNote=A.crmBefore||A.crmAfter?`${[A.crmBefore&&`${A.crmBefore} dated before ${fds(wk)}`,A.crmAfter&&`${A.crmAfter} after ${fds(wkEnd)}`].filter(Boolean).join(" and ")} left out (other weeks).`:"";
  if(A.missingRefs.length){ const mr=A.missingRefs;
    N.missNote=`<b>${mr.length} closing${mr.length>1?"s":""} in the CRM${A.missingVal?` (${rp(A.missingVal)})`:""} name order numbers that are not in the sales export:</b> ${esc(mr.map(x=>x.ref).join(", "))}. Check whether they are invoiced, booked under another team, or mistyped.`; }
  // What the wins are worth
  if(won&&A.has.sales&&A.linkedOrders.length){
    const share=pct(A.linkedGmv,A.gmv), bw=A.bigWin, gap=A.mix.slice().sort((a,b)=>Math.abs(b.win-b.rest)-Math.abs(a.win-a.rest))[0];
    const days=bw?.r?.date&&bw.o.date?Math.round((bw.o.date-bw.r.date)/864e5):null, lt=countBy(A.won,r=>r.leadType)[0], ut=countBy(A.won,r=>r.userType);
    N.wwTitle=A.missingVal>=A.linkedGmv*.5?`The CRM logged ${rp(A.linkedGmv+A.missingVal)} of closings; only ${rp(A.linkedGmv)} of it is in the sales export`
      :A.noCrm.length?`Wins brought ${share}% of GMV; their orders average ${rp(A.aovWin)} vs ${rp(A.aovNoCrm)} for orders the CRM never saw`:`Wins brought ${share}% of GMV at ${rp(A.aovWin)} per order`;
    N.wwNotes=[
      bw&&`<b>Biggest win: ${rp(bw.o.gmv)}</b> (${esc(bw.o.items.slice(0,3).join(", "))}${bw.o.items.length>3?", …":""})${bw.r?.channel?` from ${esc(lc(bw.r.channel))}`:""}${bw.r?.source?` on a ${esc(lc(bw.r.source))} lead`:""}${bw.o.pic?` by ${esc(bw.o.pic)}`:""}${days!=null?`, ordered ${days<=0?"the same day":`${days} day${days>1?"s":""} later`}`:""}.`,
      gap&&A.orders.length>A.linkedOrders.length&&Math.abs(gap.win-gap.rest)>=10&&`<b>${gap.win>gap.rest?`Wins lean on ${esc(gap.k)}`:`Wins buy less ${esc(gap.k)}`}:</b> ${gap.win}% of win GMV vs ${gap.rest}% in other orders${gap.win>gap.rest?`, so ${esc(gap.k)} is the product the CRM motion sells best`:""}.`,
      lt&&`<b>${lt[1]} of ${won} wins came from ${esc(lc(lt[0]))}</b>${ut.length?`; buyers: ${esc(ut.map(([k,n])=>`${k} ${n}`).join(", "))}`:""}.`,
      A.hasCustStatus&&`<b>${A.wonNew} of ${A.linkedOrders.length} win orders are from new customers.</b>${A.wonNew/A.linkedOrders.length<.3?" CRM wins are mostly re-orders; new-customer growth comes from orders outside the CRM.":""}`,
      A.potWins.length&&A.crmSources.some(x=>x.succ)?`<b>Values in the closing log ${Math.abs(A.potActual-A.potSum)<=A.potSum*.1?"match":"differ from"} the sales export</b> on the ${A.potWins.length} matched closing${A.potWins.length>1?"s":""}: ${rp(A.potSum)} logged, ${rp(A.potActual)} invoiced.`
      :A.potWins.length===A.wonLinked.length?`<b>The CRM's potential GMV was ${A.potActual>=A.potSum?"met":"missed"}:</b> ${rp(A.potSum)} expected on the ${A.potWins.length} matched win${A.potWins.length>1?"s":""}, ${rp(A.potActual)} ordered (${A.potSum?Math.round((A.potActual/A.potSum-1)*100):0}%). A usable forecast for the next pipeline.`
        :A.potWins.length&&`<b>Potential GMV was logged on only ${A.potWins.length} of ${A.wonLinked.length} matched wins</b> (${rp(A.potSum)} expected, ${rp(A.potActual)} ordered). Fill it on every lead to size the pipeline.`
    ].filter(Boolean).slice(0,4);
    if(N.missNote){ N.wwNotes.splice(1,0,N.missNote); N.wwNotes.length=Math.min(N.wwNotes.length,4); }
  }

  // Where to grow
  if(A.has.sales&&A.orders.length>=3){
    const Hm=A.heat, cr=A.cross, top=cr?.also[0], ag=A.aging.filter(a=>a.lo>=4), agN=ag.reduce((s,a)=>s+a.n,0), agG=ag.reduce((s,a)=>s+a.gmv,0);
    let hot=null; if(Hm) for(const r of Hm.rows) for(const c of Hm.cols){ const v=Hm.v(r,c); if(!hot||v>hot.v) hot={r,c,v}; }
    let skew=null; if(Hm&&Hm.cols.length>=2) for(const c of Hm.cols){ const tot=Hm.rows.reduce((s,r)=>s+Hm.v(r,c),0), f=Hm.rows.slice().sort((a,b)=>Hm.v(b,c)-Hm.v(a,c))[0];
      if(tot&&f!==Hm.rows[0]&&Hm.v(f,c)/tot>=.4){ skew={c,f,p:pct(Hm.v(f,c),tot)}; break; } }
    N.wgTitle=([cr&&top&&cr.n-top.n>=2&&`${cr.n-top.n} of ${cr.n} ${cr.f.replace(/\s*\(.*\)/,"")} buyers skipped ${top.k}`,
      agN>=2&&`${agN} open orders (${rp(agG)}) are 4+ days old`,
      hot&&`${hot.r} in ${appName(hot.c)} is the biggest pocket (${rp(hot.v)})`].filter(Boolean).slice(0,2).join("; ")||"Where to grow next").replace(/^./,c=>c.toUpperCase());
    const sp=A.priceSpread[0];
    N.wgNotes=[
      cr&&cr.only>=2&&`<b>${cr.only} of ${cr.n} ${esc(cr.f)} buyers bought nothing else.</b>${top?` Offer ${esc(top.k)} (bought by ${top.n} of them) as the add-on on the next call.`:""}`,
      A.entry&&`<b>New customers start with ${esc(A.entry[0])}</b> (${A.entry[1]} of ${A.newOrdersN} new-customer orders). Lead with it when opening new accounts.`,
      skew&&`<b>${esc(appName(skew.c))} buys mostly ${esc(skew.f)}</b> (${skew.p}% of its GMV), unlike the other ${Hm.dim==="region"?"regions":"channels"}. Stock and pitch by area.`,
      A.aging.some(a=>a.n)&&`<b>${A.openOrders.length} of ${A.orders.length} orders are still open</b> as of ${fds(A.asOf)}${agN?`; ${agN} (${rp(agG)}) for 4+ days`:""}. Confirm delivery dates before customers chase them.`,
      sp&&sp.spread>=.1&&`<b>${esc(sp.item)} sold at ${rp(sp.min)}–${rp(sp.max)} per unit</b> across ${sp.n} lines (+${Math.round(sp.spread*100)}%). Check that discounts follow one price list.`
    ].filter(Boolean).slice(0,4);
  }

  // Who can be won back
  if(nw){
    const closed=A.notWon.filter(r=>!r.recov), cTop=countBy(closed,r=>r.theme)[0];
    N.cbTitle=`${A.recovN} of ${nw} leads who didn't order can still be won back${cTop&&cTop[1]>=2?`; ${cTop[1]} are ${TL[cTop[0]]||lc(cTop[0])}`:""}`;
    const PLAN={"Locked in elsewhere":["Closed for now","Offer payment terms or a KUD / agent partnership; drop from this season's cold-call lists","Next season"],
      "Just asking":["Recoverable","Send the price list and warehouse location on WhatsApp, then call to ask what they need","Within 48 hours"],
      "Stock & delivery":["Recoverable","Call back the day the product is in stock; offer warehouse pickup","When stock lands"],
      "Price":["Recoverable","Quote bulk or bundle prices and the landed cost including delivery","This week"],
      "Timing":["Recoverable","Log the next fertilizing month and book a call two weeks before","Before next application"],
      "Not a fit":["Closed","Remove from call lists (no land, wrong number, too small)","–"],
      "Other":["Check","Re-read the notes and pick a specific reason","This week"]};
    N.plan=countBy(A.notWon,r=>r.theme||"Other").map(([t,n])=>{ const p=PLAN[t]||PLAN.Other, w=A.notWon.filter(r=>(r.theme||"Other")===t&&r.outcome==="Warm").length;
      return [{v:t,bold:true},`${n}${w?` (${w} warm)`:""}`,p[0]==="Recoverable"?{v:"Recoverable",pill:true}:w?`${p[0]}, ${w} still warm`:p[0],p[1],p[2]]; });
  }

  // Last week vs the week before
  if(A.wow){ const W=A.wow, c=W.c, p=W.p, up=W.dG>=0, pc=W.pct==null?null:Math.round(Math.abs(W.pct)*100), flat=pc!=null&&pc<3;
    const sg=v=>(v>=0?"+":"−")+rp(Math.abs(v)), volDom=Math.abs(W.volume)>=Math.abs(W.value);
    const famUp=W.family.filter(x=>x.d>0), famDn=W.family.filter(x=>x.d<0), lead=(up?famUp:famDn)[0];
    const drv=volDom?`${c.orders>=p.orders?"more":"fewer"} orders (${p.orders} → ${c.orders})`:`${c.aov>=p.aov?"bigger":"smaller"} orders (average ${rp(p.aov)} → ${rp(c.aov)})`;
    const exPct=W.exTop.prev?Math.round((W.exTop.cur-W.exTop.prev)/W.exTop.prev*100):null, exUp=W.exTop.cur>=W.exTop.prev;
    W.up=up; W.pc=pc; W.flat=flat; W.drv=drv; W.lead=lead;
    N.wowTitle=flat?`GMV is flat vs the week before (${rp(p.gmv)} → ${rp(c.gmv)}), but the mix moved`
      :`GMV ${up?"up":"down"} ${pc!=null?pc+"%":sg(W.dG)} vs the week before (${rp(p.gmv)} → ${rp(c.gmv)})${lead?`, led by ${lead.k} (${sg(lead.d)})`:""}`;
    const pic=W.pic[0], reg=W.region[0];
    N.wowNotes=[
      c.orders===p.orders?`<b>Same number of orders (${c.orders}); ${flat?"order size held":`order size explains the ${up?"increase":"drop"}`}</b> (average ${rp(p.aov)} → ${rp(c.aov)}).`
        :`<b>${flat?"Volume and value offset each other":`The ${up?"increase":"drop"} comes mostly from ${esc(drv)}`}.</b> Order count accounts for ${sg(W.volume)}, order size for ${sg(W.value)}.`,
      W.family.length&&`<b>Products:</b> ${famUp.length?esc(famUp.slice(0,2).map(x=>`${x.k} ${sg(x.d)}`).join(", ")):"no product type grew"}; ${famDn.length?esc(famDn.slice(0,2).map(x=>`${x.k} ${sg(x.d)}`).join(", ")):"no product type fell"}.`,
      `<b>Customers:</b> ${W.retained.n?`${W.retained.n} bought in both weeks (${rp(W.retained.prev)} → ${rp(W.retained.cur)})`:"none bought in both weeks"}, ${W.gained.n?`${W.gained.n} ${W.gained.n===1?"is":"are"} new to the week (${rp(W.gained.gmv)})`:"none are new to the week"} and ${W.lost.n} from the week before didn't reorder (${rp(W.lost.gmv)}).${!up&&W.lost.gmv>=Math.abs(W.dG)*.5?" Customers who didn't come back explain most of the drop.":!up&&W.retained.prev-W.retained.cur>=Math.abs(W.dG)*.5?` Regular customers buying less explains most of the drop (${W.retained.down} of ${W.retained.n} spent less).`:up&&W.gained.gmv>=W.dG*.5?" New buyers explain most of the growth.":up&&W.retained.cur-W.retained.prev>=W.dG*.5?` Regular customers buying more explains most of the growth (${W.retained.up} of ${W.retained.n} spent more).`:""}`,
      exPct!=null&&c.orders>1&&p.orders>1&&`<b>Without each week's largest order</b> (${rp(c.top)} vs ${rp(p.top)}), GMV is ${exUp?"up":"down"} ${Math.abs(exPct)}%${exUp!==up&&!flat?`, so the headline ${up?"increase":"drop"} is one large order, not the underlying trend`:", so the trend holds beyond a single deal"}.`,
      (pic||reg)&&`<b>Biggest swings:</b> ${[pic&&`PIC ${esc(pic.k)} ${sg(pic.d)}`,reg&&`${esc(reg.k)} ${sg(reg.d)}`].filter(Boolean).join("; ")}.`
    ].filter(Boolean).slice(0,4);
  }

  // Month-by-month trend (when the sales export covers two or more full months)
  if(A.trend){ const T=A.trend, F=T.F, Z=T.Z, L1=T.M.length-1, up=T.dG>=0, pc=T.pct==null?null:Math.round(Math.abs(T.pct)*100), flat=pc!=null&&pc<3;
    const sg=v=>(v>=0?"+":"−")+rp(Math.abs(v)), ns=T.stopped.length, stopDrop=T.stopBy[0]-T.stopBy[L1], rpc=T.restPct==null?null:Math.round(T.restPct*100);
    const explains=!up&&!flat&&ns&&stopDrop>=Math.abs(T.dG)*.6&&T.rest[L1]>=T.rest[0], mid=T.low!==F&&T.low!==Z?T.low:null;
    const acc=ns===1?"1 account":`${ns} accounts`, B=T.bridge, Ret=T.retained;
    Object.assign(T,{up,pc,flat,explains,acc});
    N.trTitle=(flat?`GMV is flat from ${F.label} to ${Z.label} (${rp(F.gmv)} → ${rp(Z.gmv)})`:`GMV ${up?"up":"down"} ${pc}% from ${F.label} to ${Z.label} (${rp(F.gmv)} → ${rp(Z.gmv)})`)
      +(explains?`: ${acc} stopped ordering, everyone else grew ${rpc}%`:mid?`, after a dip in ${mid.label}`:"");
    const picsOf=cs=>andList([...new Set(cs.map(c=>c.pic).filter(Boolean))]);
    N.trNotes=[
      ns&&`<b>${acc} stopped ordering:</b> ${rp(T.stopped.reduce((s,c)=>s+c.tot,0))} over the period, ${rp(T.stopBy[0])} in ${F.label} (${pct(T.stopBy[0],F.gmv)}% of that month) and nothing in ${Z.label}. ${ns===1?"It was":"All were"} handled by ${esc(picsOf(T.stopped))}; last orders on ${andList(T.stopped.map(c=>fds(c.last)))}.`,
      mid&&`<b>${mid.label} was the low point</b> at ${rp(mid.gmv)}: ${mid.orders} orders from ${mid.customers} customers, vs ${F.orders} from ${F.customers} in ${F.label}.`,
      ns&&rpc!=null&&`<b>Everyone else ${T.rest[L1]>=T.rest[0]?"grew":"fell"} ${Math.abs(rpc)}%</b> (${rp(T.rest[0])} → ${rp(T.rest[L1])}); orders ${F.orders} → ${Z.orders}, average order ${rp(F.aov)} → ${rp(Z.aov)}.`,
      !ns&&`<b>Orders ${F.orders} → ${Z.orders}, average order ${rp(F.aov)} → ${rp(Z.aov)}</b>, customers ${F.customers} → ${Z.customers}.`,
      T.peakWeek&&`<b>Best week:</b> week of ${fds(T.peakWeek.d)} at ${rp(T.peakWeek.gmv)}.`
    ].filter(Boolean).slice(0,4);
    const pd=T.pic.filter(x=>x.d<0), pu=T.pic.filter(x=>x.d>0), CD=T.cat.length?T.cat:T.family, cd=CD.filter(x=>x.d<0), cu=CD.filter(x=>x.d>0);
    N.tr2Title=`${B.lost.n} of ${F.customers} ${F.label} customers didn't buy in ${Z.label}`+(pd[0]?`; ${pd[0].k} ${sg(pd[0].d)}${cd[0]?` and ${cd[0].k} ${sg(cd[0].d)}`:""} moved most`:cu[0]?`; ${cu[0].k} grew most (${sg(cu[0].d)})`:"");
    N.tr2Notes=[
      `<b>Customers:</b> ${B.lost.n} ${F.label} customers didn't buy in ${Z.label} (${rp(B.lost.gmv)}), ${B.both.n} bought in both (${rp(B.both.prev)} → ${rp(B.both.cur)}) and ${B.gained.n} ${Z.label} customers didn't buy in ${F.label} (${rp(B.gained.gmv)}).`,
      `<b>Retention:</b> ${Ret.n} of ${Ret.of} ${F.label} customers (${pct(Ret.n,Ret.of)}%) ordered again in ${T.laterLabel}; ${T.fresh.n} ${Z.label} customers are new to the whole period (${rp(T.fresh.gmv)}).`,
      (pd.length||pu.length)&&`<b>PICs:</b> ${[pd.slice(0,2).map(x=>`${esc(x.k)} ${sg(x.d)}`).join(", "),pu.slice(0,3).map(x=>`${esc(x.k)} ${sg(x.d)}`).join(", ")].filter(Boolean).join("; ")}.`,
      (cd.length||cu.length)&&`<b>Products:</b> ${[cd.slice(0,2).map(x=>`${esc(x.k)} ${sg(x.d)}`).join(", "),cu.slice(0,2).map(x=>`${esc(x.k)} ${sg(x.d)}`).join(", ")].filter(Boolean).join("; ")}.`
    ].filter(Boolean).slice(0,4);
    const bF=F.bands, bZ=Z.bands, big=b=>b[4].n, mid2=b=>b[2].n+b[3].n;
    N.tr3Title=big(bF)>big(bZ)?`Orders of Rp100M+ fell from ${big(bF)} to ${big(bZ)}; Rp20–100M orders went ${mid2(bF)} → ${mid2(bZ)}`:`Order sizes from ${F.label} to ${Z.label}: average ${rp(F.aov)} → ${rp(Z.aov)}`;
    N.tr3Notes=[
      `<b>Very large orders:</b> ${big(bF)} orders of Rp100M+ in ${F.label} (${rp(bF[4].gmv)}) vs ${big(bZ)} in ${Z.label} (${rp(bZ[4].gmv)}).`,
      (F.disc||Z.disc)&&`<b>Discounts</b> went ${rp(F.disc)} → ${rp(Z.disc)}${Z.disc<F.disc&&Z.gmv>=F.gmv*.8?", so the recovery was not bought with discounts":""}.`,
      Z.openGmv&&`<b>${rp(Z.openGmv)} of ${Z.label} GMV is not completed yet</b> (${Z.openN} order${Z.openN===1?"":"s"})${Z.partGmv?`; ${rp(Z.partGmv)} is only partially paid`:""}.`
    ].filter(Boolean);
  }

  if(A.trend){ const T=A.trend, F=T.F, Z=T.Z, M=T.M, sg=v=>(v>=0?"+":"−")+rp(Math.abs(v));
    const picD=T.pic, low=T.low, nw=M.map(x=>x.newGmv), rep2=M.map(x=>x.gmv-x.newGmv);
    const lowPic=low!==F&&low!==Z?[...F.pic.keys()].map(k=>({k,d:(low.pic.get(k)||0)-(F.pic.get(k)||0)})).sort((a,b)=>a.d-b.d)[0]:null;
    N.tr4Title=F.hasCust?`Repeat customers ${rep2[M.length-1]>=rep2[0]?"held":"fell"} (${rp(rep2[0])} → ${rp(rep2[M.length-1])}); new customers went ${rp(nw[0])} → ${rp(nw[M.length-1])}`
      :`${picD[0]?`${picD[0].k} ${sg(picD[0].d)} is the biggest PIC swing`:"GMV by PIC and product, month by month"}`;
    N.tr4Notes=[
      lowPic&&lowPic.d<0&&`<b>${low.label} dip:</b> ${esc(lowPic.k)} ${sg(lowPic.d)} vs ${F.label}; ${low.orders} orders from ${low.customers} customers.`,
      F.hasCust&&`<b>New customers</b> brought ${M.map(x=>`${rp(x.newGmv)} in ${x.label}`).join(", ")}; repeat customers ${M.map(x=>rp(x.gmv-x.newGmv)).join(" → ")}.`,
      `<b>Customers per month:</b> ${M.map(x=>`${x.label} ${x.customers}`).join(", ")}; orders per customer ${M.map(x=>(x.orders/(x.customers||1)).toFixed(1)).join(" → ")}.`
    ].filter(Boolean);
    // volume vs price
    if(T.vol){ const V=T.vol, kgP=Math.round((Z.kg-F.kg)/F.kg*100), rP=Math.round((Z.rpkg-F.rpkg)/F.rpkg*100), t=v=>`${nf.format(Math.round(v/1000))}t`;
      const share=(x,f)=>x.kg?(x.famKg.get(f)||0)/x.kg:0, fams=[...new Set([...F.famKg.keys(),...Z.famKg.keys()])].map(f=>({f,d:share(Z,f)-share(F,f),a:share(F,f),b:share(Z,f),rk:(Z.famKgG.get(f)||0)/(Z.famKg.get(f)||1)})).sort((a,b)=>b.d-a.d);
      const gain=fams[0], loss=fams[fams.length-1], pd=T.prices.filter(x=>x.eff<0).slice(0,3);
      Object.assign(V,{kgP,rP,t,gain,loss,pd});
      N.tr6Title=kgP>0&&rP<0?`We sold ${kgP}% more fertilizer by weight (${t(F.kg)} → ${t(Z.kg)}), but each kg brought ${-rP}% less`:`Volume ${kgP>=0?"+":""}${kgP}% (${t(F.kg)} → ${t(Z.kg)}), GMV per kg ${rP>=0?"+":""}${rP}%`;
      N.tr6Notes=[
        `<b>Volume added ${sg(V.volume)}; GMV per kg took ${sg(V.rate)}</b> (Rp${nf.format(Math.round(F.rpkg))} → Rp${nf.format(Math.round(Z.rpkg))} per kg). Of that, ${sg(V.mix)} is a cheaper product mix and ${sg(V.price)} lower prices on the same products.`,
        gain&&gain.d>.03&&`<b>Mix:</b> ${esc(gain.f)} went from ${Math.round(gain.a*100)}% to ${Math.round(gain.b*100)}% of kg sold (about Rp${nf.format(Math.round(gain.rk))}/kg)${loss&&loss.d<-.03?`, ${esc(loss.f)} from ${Math.round(loss.a*100)}% to ${Math.round(loss.b*100)}% (about Rp${nf.format(Math.round((F.famKgG.get(loss.f)||0)/(F.famKg.get(loss.f)||1)))}/kg)`:""}.`,
        pd.length&&`<b>Price cuts:</b> ${pd.map(x=>`${esc(x.k)} Rp${nf.format(Math.round(x.from/1000))}k → Rp${nf.format(Math.round(x.to/1000))}k (${pcs(x.chg)}, ${sg(x.eff)})`).join("; ")}.`,
        V.cover<.9&&`<b>${Math.round((1-V.cover)*100)}% of ${Z.label} GMV</b> is items without a weight (liquids, seeds, tests) and is shown as “Other items”.`
      ].filter(Boolean); }
    // month by month: concentration, timing, channel, new regions
    const th=x=>x.gmv?Math.round(x.thirds[2]/x.gmv*100):0, ap=T.app.slice(0,2), nr=T.newReg.slice(0,3);
    N.tr4Notes=[N.tr4Notes[0],
      `<b>Less reliance on a few buyers:</b> the top 5 customers were ${M.map(x=>`${Math.round(x.top5*100)}%`).join(" → ")} of GMV (${M.map(x=>x.label).join(", ")}).`,
      `<b>Month-end heavy:</b> days 21–31 brought ${M.map(x=>`${th(x)}%`).join(" → ")} of each month's GMV${F.thirds[0]>F.gmv*.3?`; ${F.label} also had a strong start (${rp(F.thirds[0])} in days 1–10)`:""}.`,
      (ap.length||nr.length)&&`<b>Channels and regions:</b> ${ap.map(x=>`${esc(appName(x.k))} ${sg(x.d)}`).join(", ")}${nr.length?`; new in ${Z.label}: ${nr.map(x=>`${esc(x.k)} ${rp(x.gmv)}`).join(", ")}`:""}.`
    ].filter(Boolean).slice(0,4);
    // who to win back first
    { const LA=T.lapsedAll, rep=LA.filter(c=>c.orders>=2), K=T.crm;
      T.lapsedSum={n:LA.length,gmv:LA.reduce((s,c)=>s+c.tot,0),rep:rep.length,repGmv:rep.reduce((s,c)=>s+c.tot,0)};
      N.tr5Title=K&&K.lapsedHit<=Math.max(1,K.lapsed*.1)?`${LA.length} customers stopped buying before ${Z.label} (${rp(T.lapsedSum.gmv)}); only ${K.lapsedHit} ${K.lapsedHit===1?"was":"were"} contacted in the CRM`
        :`${LA.length} customers stopped buying before ${Z.label} (${rp(T.lapsedSum.gmv)}); ${rep.length} of them were repeat buyers`;
      N.tr5Notes=[
        `<b>Start with the ${rep.length} repeat buyers</b> (2+ orders, ${rp(T.lapsedSum.repGmv)}): they already trust us. ${T.gapMed!=null?`Customers reorder every ${Math.round(T.gapMed)} days (median), so 30+ days of silence is a real gap.`:""}`,
        T.lapsedPic[0]&&`<b>By PIC:</b> ${T.lapsedPic.slice(0,3).map(x=>`${esc(x.p)} ${x.n} (${rp(x.gmv)})`).join(", ")}.`,
        `<b>Customers who bought in both ${F.label} and ${Z.label}:</b> ${T.bothUp} spent more, ${T.bothDown} spent less, so the problem is customers leaving, not customers shrinking.`,
        K&&`<b>CRM ${K.span}:</b> only ${K.past} of ${K.n} engagements went to past buyers.`
      ].filter(Boolean).slice(0,3); }
  }

  // Headline for the executive summary
  const dh=N.driver&&won?`${N.driver.hi.g} converts (${N.driver.hi.w} of ${N.driver.hi.n}); ${lc(N.driver.lo.g)} doesn't (${N.driver.lo.w} of ${N.driver.lo.n})`:null;
  const sF0=A.byFamily?.[0], sTail=sF0?` ${sF0.k} is ${pct(sF0.gmv,A.gmv||1)}% of GMV${A.outstanding>=A.gmv*.1?`, and ${rp(A.outstanding)} is still unpaid`:""}.`:"";
  const wowTag=A.wow&&A.wow.pc!=null?` (${A.wow.flat?"flat":(A.wow.up?"+":"−")+A.wow.pc+"%"} vs the week before)`:"";
  N.headline=!A.has.sales&&won&&!nw?`${won} CRM engagement${won>1?"s":""} ended in an order`:A.has.sales?`${rp(A.gmv)} in sales last week${wowTag}.${dh?` ${dh}.`:sTail}`:dh||(n?`${pct(lost,n)}% of leads said no; ${warm} are still in play`:"Executive summary");
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
  if(A.missingRefs.length) F.splice(1,0,[`${A.missingRefs.length} CRM closing${A.missingRefs.length>1?"s":""}${A.missingVal?` (${rp(A.missingVal)})`:""} missing from sales`,`Their order numbers (${A.missingRefs.slice(0,3).map(x=>x.ref).join(", ")}${A.missingRefs.length>3?", …":""}) are not in the sales export.`]);
  if(A.wonFromNotes.length) F.push(["Closed deals are not marked as orders",`${A.wonFromNotes.length} win${A.wonFromNotes.length>1?"s are":" is"} still “${A.wonFromNotes[0].statusLogged||"blank"}” in the CRM although the notes say closing.`]);
  if(A.wow){ const W=A.wow; F.unshift([W.flat?"GMV flat vs the week before":`GMV ${W.up?"up":"down"} ${W.pc!=null?W.pc+"%":""} vs the week before`,`${rp(W.p.gmv)} → ${rp(W.c.gmv)}, mostly from ${W.drv}${W.lead?`; ${W.lead.k} moved most`:""}.`]); }
  if(A.trend){ const T=A.trend; F.splice(A.wow?1:0,0,[T.flat?`GMV flat from ${T.F.label} to ${T.Z.label}`:`GMV ${T.up?"up":"down"} ${T.pc}% from ${T.F.label} to ${T.Z.label}`,
    `${rp(T.F.gmv)} → ${rp(T.Z.gmv)}${T.explains?`; ${T.acc} that stopped ordering explain the drop, all other customers grew ${Math.round(T.restPct*100)}%`:`; orders ${T.F.orders} → ${T.Z.orders}`}.`]); }
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
  if(A.missingRefs.length) act.splice(1,0,{t:`Reconcile ${A.missingRefs.length} closing${A.missingRefs.length>1?"s":""} missing from sales`,d:`${A.missingRefs.map(x=>x.ref).join(", ")}${A.missingVal?` (${rp(A.missingVal)})`:""} are logged as closed in the CRM but not in the sales export. Confirm the invoice, team and order number for each.`,o:"Sales ops + PIC",w:"This week"});
  if(A.wonFromNotes.length) act.push({t:"Mark closed deals as orders in the CRM",d:`${A.wonFromNotes.length} closed deal${A.wonFromNotes.length>1?"s are":" is"} still logged as “${A.wonFromNotes[0].statusLogged||"blank"}”. Update the status and add the order number, so wins are counted automatically.`,o:"Sales ops",w:"This week"});
  if(A.wow){ const W=A.wow;
    if(!W.up&&!W.flat&&W.retained.prev-W.retained.cur>W.lost.gmv&&W.retained.down) act.unshift({t:`Find out why ${W.retained.down} regular customer${W.retained.down>1?"s":""} bought less`,d:`Customers who ordered in both weeks spent ${rp(W.retained.prev)} → ${rp(W.retained.cur)}${W.family.find(x=>x.d<0)?`; ${W.family.find(x=>x.d<0).k} fell most`:""}. Check stock, price and delivery with each, and agree the next order size.`,o:"Sales PIC",w:"This week"});
    else if(!W.up&&!W.flat&&W.lost.n>=1) act.unshift({t:`Win back ${W.lost.n} customer${W.lost.n>1?"s":""} who bought the week before`,d:`They spent ${rp(W.lost.gmv)} the week before and nothing last week${W.family.find(x=>x.d<0)?`; ${W.family.find(x=>x.d<0).k} fell most`:""}. Ask what stopped them (stock, price, delivery or timing) and book the next order.`,o:"Sales PIC",w:"This week"});
    else if(W.up&&!W.flat) act.splice(1,0,{t:`Repeat what lifted GMV ${W.pc!=null?W.pc+"%":""}`,d:`The increase came from ${W.drv}${W.lead?`, led by ${W.lead.k}`:""}. ${W.gained.n?`Book a second order with the ${W.gained.n} new buyer${W.gained.n>1?"s":""} within two weeks.`:"Keep the same call list and offer next week."}`,o:"Team lead",w:"Next week"}); }
  if(A.trend){ const T=A.trend, Z=T.Z, ns=T.stopped.length;
    if(ns&&!T.up) act.splice(1,0,{t:`Win back ${T.acc} that stopped ordering`,d:`${andList(T.stopped.map(c=>c.label))} bought ${rp(T.stopped.reduce((s,c)=>s+c.tot,0))} in ${T.preLabel} and nothing in ${Z.label}. Ask what changed (price, supplier, season) and agree the next order; don't let a few accounts carry the month.`,o:andList([...new Set(T.stopped.map(c=>c.pic).filter(Boolean))])||"Account PIC",w:"This week"});
    if(Z.openGmv>=Z.gmv*.1) act.push({t:`Close out ${rp(Z.openGmv)} of ${Z.label} orders`,d:`${Z.openN} ${Z.label} order${Z.openN===1?" is":"s are"} not completed${Z.partGmv?` and ${rp(Z.partGmv)} is only partially paid`:""}. Confirm delivery and payment dates so the month's GMV is realised.`,o:"Order PIC + finance",w:"This week"}); }
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
  <div class="foot"><span>${esc(FOOT_BASIS)}</span><span class="pg">${n}</span><span>Do not use or distribute without permission from SawitPRO</span></div></div>`;
}
const appName=k=>({WEB:"Web",PETANI:"Petani app","SAWITPRO-RETAIL":"SawitPRO retail","SAWITPRO-BISNIS":"SawitPRO bisnis"}[String(k).toUpperCase()]||k);
const roleName=k=>String(k).toLowerCase().replace(/_/g," ").replace(/^./,c=>c.toUpperCase());
const OUT_COLOR={"Ordered":"#274E13","Considering / prospect":"#D9A21B","Not interested":"#8E9C84"};

// Slides for one team, described once as panel specs (see viz.js) and drawn by both the page and the PPTX.
// `pre` prefixes each kicker ("Smallholder · ") when the deck covers several teams.
function teamSpecs(A,N,pre){
  const S=[], O=A.orders, pl=(n,w)=>`${n} ${w}${n===1?"":"s"}`, rpM=v=>rp(v);
  const NI={name:"Not interested",color:OUTC.lost}, WM={name:"Considering / prospect",color:OUTC.warm}, NS={name:"No status",color:OUTC.none};

  // Success story
  if(A.won.length){
    const dims=["channel","source","leadType","userType","purpose","kabupaten","pic"].filter(k=>A.won.some(r=>r[k])).slice(0,3);
    const how={w:.85,title:`How the ${A.won.length} wins happened`,sub:"Each bar splits the CRM wins; count inside",
      chart:{type:"stack100",rows:dims.map(k=>({label:LABEL[k],segs:countBy(A.won,r=>r[k]??"(not filled)").map(([g,n],i)=>({k:g,n,color:g==="(not filled)"?OUTC.none:CAT[i]||"#B3BBAB"}))}))}};
    let right;
    if(A.has.sales){
      const kp=[{v:`${A.wonLinked.length}`,u:`/${A.won.length}`,l:"Wins confirmed in sales data",hot:true},{v:rpParts(A.linkedGmv)[0],u:rpParts(A.linkedGmv)[1],l:`GMV of ${pl(A.linkedOrders.length,"matched order")}`},
        A.hasCustStatus?{v:String(A.wonNew),u:`/${A.linkedOrders.length}`,l:"Matched orders from new customers"}:{v:String(A.wonFromNotes.length||A.won.length),u:`/${A.won.length}`,l:A.wonFromNotes.length?"Wins found only in the notes (“Closing …”)":A.crmSources.some(x=>x.succ)?"closings logged in the CRM this week":"Wins with a CRM status of ordered"}];
      const by=andList(A.matchCounts.filter(m=>A.won.some(r=>r.matchBy===m[0])).map(([k])=>`${k} (${A.won.filter(r=>r.matchBy===k).length})`));
      right={w:1.45,split:[{h:104,kpiRow:kp},{title:"Orders behind the wins",sub:A.linkedOrders.length>5?`Top 5 of ${A.linkedOrders.length} by GMV`:"Matched from the sales export",
        table:{head:["Order","PIC","Products","GMV",...(A.hasCustStatus?["Customer"]:[])],align:["l","l","l","r","l"],rows:A.linkedOrders.slice(0,5).map(o=>[o.no,o.pic||"–",o.items.slice(0,2).join(", ")+(o.items.length>2?` +${o.items.length-2}`:""),rp(o.gmv),...(A.hasCustStatus?[o.isNew?{v:"New",pill:true}:"Repeat"]:[])])},
        foot:`Matched by ${by||"–"}.${A.wonFromNotes.length?` ${A.wonFromNotes.length} counted as wins from “Closing” in the notes.`:""}${N.outNote?` ${N.outNote}`:""}`}]};
    } else right={w:1.45,title:"The wins",sub:A.trendSales?`${A.wonInSales} of ${A.won.length} wins are buyers in the sales export (matched by phone)`:A.has.sales?"No order in the sales export matches these wins by phone, order number or name; check them in the CRM":"Upload the sales file to see what these wins were worth",table:{head:["ID","PIC","Channel","Source","Notes"],rows:A.won.slice(0,7).map(r=>[r.id||"–",r.pic||"–",r.channel||"–",r.source||"–",(r.detail||"").slice(0,60)])}};
    S.push({kicker:pre+"Success story",title:N.winTitle,rows:[{cards:[how,right]}]});
  }

  // Success story: what the wins are worth
  if(N.wwNotes){
    const cats=[[`CRM wins\n${pl(A.linkedOrders.length,"order")}`,A.aovWin,OUTC.won],A.noCrm.length&&[`No CRM record\n${pl(A.noCrm.length,"order")}`,A.aovNoCrm,"#8E9C84"],[`All orders\n${O.length}`,A.aovAll,"#86AD6C"]].filter(Boolean);
    const rest=O.length>A.linkedOrders.length, recon=!A.noCrm.length&&A.missingRefs.length;
    const first=recon?{w:.95,title:"CRM closings vs the sales export",sub:"Value of closings logged this week",chart:{type:"column",cats:[`In the sales export\n${pl(A.linkedOrders.length,"order")}`,`Not in the export\n${pl(A.missingRefs.length,"order")}`],series:[{name:"Value",values:[A.linkedGmv,A.missingVal],colors:[OUTC.won,DOWN]}],fmt:rpM,lblH:36}}
      :{w:.95,title:"Average order value",sub:"Orders behind CRM wins vs the rest",chart:{type:"column",cats:cats.map(c=>c[0]),series:[{name:"Average order",values:cats.map(c=>c[1]),colors:cats.map(c=>c[2])}],fmt:rpM,lblH:36}};
    S.push({kicker:pre+"Success story · what the wins are worth",title:N.wwTitle,rows:[{cards:[
      first,
      {w:1.25,title:rest?"Product mix: wins vs other orders":"Product mix of the wins",sub:"Share of each group's GMV by product type",chart:{type:"column",cats:A.mix.map(m=>m.k),series:[{name:"CRM wins",color:CAT[0],values:A.mix.map(m=>m.win)},...(rest?[{name:"Other orders",color:CAT[2],values:A.mix.map(m=>m.rest)}]:[])],fmt:v=>v+"%",lblH:36}},
      {w:.72,kpis:[{v:String(pct(A.linkedGmv,A.gmv)),u:"%",l:"of the team's GMV came from orders behind CRM wins",hot:true},
        A.cycle.n?{v:String(A.cycle.median),u:" days",l:`median from CRM engagement to order (${A.cycle.sameDay} of ${A.cycle.n} same day)`}:{v:rpParts(A.aovWin)[0],u:rpParts(A.aovWin)[1],l:"average order behind a win"},
        A.hasCustStatus?{v:String(A.wonNew),u:`/${A.linkedOrders.length}`,l:"win orders from new customers"}:{v:String(A.wonLinked.length),u:`/${A.won.length}`,l:"wins confirmed in sales"}]}]}],notes:N.wwNotes});
  }

  // Sales: last week vs the week before
  if(A.wow){
    const W=A.wow, c=W.c, p=W.p, chg=(a,b)=>b?`${a>b?"▲":a<b?"▼":"="} ${Math.abs(Math.round((a-b)/b*100))}%`:"new", DW=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    S.push({kicker:pre+"Sales last week · vs the week before",title:N.wowTitle,rows:[{h:84,cards:[{kpiRow:[
        {v:rpParts(c.gmv)[0],u:rpParts(c.gmv)[1],l:`GMV, ${chg(c.gmv,p.gmv)} from ${rp(p.gmv)}`,hot:true},{v:String(c.orders),u:"",l:`orders, ${chg(c.orders,p.orders)} from ${p.orders}`},
        {v:rpParts(c.aov)[0],u:rpParts(c.aov)[1],l:`average order, ${chg(c.aov,p.aov)} from ${rp(p.aov)}`},{v:String(c.customers),u:"",l:`customers, ${chg(c.customers,p.customers)} from ${p.customers}`}]}]},
      {cards:[
        {w:1,title:"GMV by day of week",sub:`Week of ${fds(W.start)} vs week of ${fds(W.prevStart)}`,chart:{type:"line",cats:DW,series:[{name:"Last week",color:CAT[0],values:DW.map((_,i)=>c.days.get(String(i))||0)},{name:"Week before",color:"#9AA593",values:DW.map((_,i)=>p.days.get(String(i))||0)}],fmt:rpM,show:[]}},
        {w:1.05,title:"Customer bridge",sub:"Lost, returning and new customers",chart:{type:"waterfall",fmt:rpM,lblH:40,steps:[{k:"Week before",v:p.gmv,total:true,color:"#8E9C84"},{k:`Lost\n${W.lost.n} cust.`,v:-W.lost.gmv},
          {k:`Both weeks\n${W.retained.n} cust.`,v:W.retained.cur-W.retained.prev},{k:`New\n${W.gained.n} cust.`,v:W.gained.gmv},{k:"Last week",v:c.gmv,total:true}]}},
        {w:1,title:"What moved GMV",sub:"Change by product type; hover for both weeks",chart:{type:"diverge",items:W.family.slice(0,6).map(x=>({k:x.k,v:x.d,tip:`${rp(x.prev)} → ${rp(x.cur)}`})),fmt:rpM}}]}],notes:N.wowNotes});
  }

  // Sales trend over the months in the export
  if(A.trend){
    const T=A.trend, F=T.F, Z=T.Z, M=T.M, ns=T.stopped.length, chg=(a,b)=>b?`${a>b?"▲":a<b?"▼":"="} ${Math.abs(Math.round((a-b)/b*100))}%`:"new";
    const pk=T.weeks.indexOf(T.peakWeek), MC=M.length<=3?["#B3CC9F","#5E8C47","#274E13"].slice(3-M.length):RAMP.slice(0,M.length).reverse();
    S.push({kicker:pre+`Sales trend · ${T.label}`,title:N.trTitle,rows:[{h:84,cards:[{kpiRow:[
        {v:rpParts(Z.gmv)[0],u:rpParts(Z.gmv)[1],l:`${Z.label} GMV, ${chg(Z.gmv,F.gmv)} from ${rp(F.gmv)} in ${F.label}`,hot:true},{v:String(Z.orders),u:"",l:`orders in ${Z.label}, ${chg(Z.orders,F.orders)} from ${F.orders}`},
        {v:String(Z.customers),u:"",l:`customers, ${chg(Z.customers,F.customers)} from ${F.customers}`},{v:rpParts(Z.aov)[0],u:rpParts(Z.aov)[1],l:`average order, ${chg(Z.aov,F.aov)} from ${rp(F.aov)}`}]}]},
      {cards:[
        {w:.95,title:"GMV by month",sub:ns?`${T.acc} that stopped ordering vs everyone else`:"Orders under each column",chart:{type:"column",stacked:true,cats:M.map(x=>`${x.label}\n${pl(x.orders,"order")}`),
          series:ns?[{name:"All other customers",color:CAT[0],values:T.rest},{name:`${T.acc} that stopped`,color:CAT[3],values:T.stopBy}]:[{name:"GMV",color:CAT[0],values:M.map(x=>x.gmv)}],fmt:rpM,lblH:40}},
        {w:1.3,title:"GMV by week",sub:`Monday–Sunday weeks; best week and the last week labelled`,chart:{type:"line",cats:T.weeks.map(w=>fds(w.d)),series:[{name:"GMV",color:CAT[0],values:T.weeks.map(w=>w.gmv)}],fmt:rpM,area:true,show:[...new Set([pk,T.weeks.length-1])],xEvery:2}}]}],notes:N.trNotes});
    if(T.vol){ const V=T.vol, oth=(Z.gmv-Z.kgGmv)-(F.gmv-F.kgGmv), ml=M.map(x=>x.label);
      S.push({kicker:pre+`Sales trend · volume vs price`,title:N.tr6Title,rows:[{h:84,cards:[{kpiRow:[
          {v:V.t(Z.kg).replace("t",""),u:"t",l:`fertilizer sold in ${Z.label}, ${chg(Z.kg,F.kg)} from ${V.t(F.kg)}`,hot:true},{v:`Rp${nf.format(Math.round(Z.rpkg))}`,u:"",l:`GMV per kg, ${chg(Z.rpkg,F.rpkg)} from Rp${nf.format(Math.round(F.rpkg))}`},
          {v:rpParts(V.volume)[0],u:rpParts(V.volume)[1],l:`added by the extra volume`},{v:"−"+rpParts(-V.rate)[0],u:rpParts(-V.rate)[1],l:`lost to a lower GMV per kg (mix ${sgn(V.mix)}, price ${sgn(V.price)})`}]}]},
        {cards:[
          {w:.75,title:"Fertilizer sold",sub:"Tonnes, from pack sizes in item names",chart:{type:"column",cats:ml,series:[{name:"Tonnes",values:M.map(x=>Math.round(x.kg/1000)),colors:M.map((_,i)=>i===M.length-1?CAT[0]:"#86AD6C")}],fmt:v=>`${nf.format(v)}t`,lblH:24}},
          {w:.75,title:"GMV per kg",sub:"Rupiah per kg sold",chart:{type:"column",cats:ml,series:[{name:"Rp per kg",values:M.map(x=>Math.round(x.rpkg)),colors:M.map((_,i)=>i===M.length-1?CAT[3]:"#D9B38F")}],fmt:v=>`Rp${nf.format(v)}`,lblH:24}},
          {w:1.2,title:`${F.label} → ${Z.label} GMV: volume vs price`,sub:"Extra kg at the old price, then the effect of the lower price per kg",chart:{type:"waterfall",fmt:rpM,lblH:40,steps:[{k:F.label,v:F.gmv,total:true,color:"#8E9C84"},
            {k:"More kg",v:V.volume},{k:"Cheaper\nmix",v:V.mix},{k:"Lower\nprices",v:V.price},...(Math.abs(oth)>=F.gmv*.01?[{k:"Other\nitems",v:oth}]:[]),{k:Z.label,v:Z.gmv,total:true}]}}]}],notes:N.tr6Notes}); }
    const CD=T.cat.length?T.cat:T.family, B=T.bridge;
    S.push({kicker:pre+`Sales trend · what changed from ${F.label} to ${Z.label}`,title:N.tr2Title,rows:[{cards:[
      {w:1.05,title:"Customer bridge",sub:`${F.label} GMV to ${Z.label} GMV by customer`,chart:{type:"waterfall",fmt:rpM,lblH:40,steps:[{k:F.label,v:F.gmv,total:true,color:"#8E9C84"},{k:`Not in ${Z.label}\n${B.lost.n} cust.`,v:-B.lost.gmv},
        {k:`Both months\n${B.both.n} cust.`,v:B.both.cur-B.both.prev},{k:`Not in ${F.label}\n${B.gained.n} cust.`,v:B.gained.gmv},{k:Z.label,v:Z.gmv,total:true}]}},
      {w:1,title:"Change by PIC",sub:`${F.label} → ${Z.label} GMV; hover for both months`,chart:{type:"diverge",items:T.pic.slice(0,6).map(x=>({k:x.k,v:x.d,tip:`${rp(x.prev)} → ${rp(x.cur)}`})),fmt:rpM}},
      {w:1,title:T.cat.length?"Change by product category":"Change by product type",sub:`${F.label} → ${Z.label} GMV; hover for both months`,chart:{type:"diverge",items:CD.slice(0,6).map(x=>({k:x.k,v:x.d,tip:`${rp(x.prev)} → ${rp(x.cur)}`})),fmt:rpM}}]}],notes:N.tr2Notes});
    const cards=[{w:.85,title:"Orders by size",sub:"Orders per month, by order value (Rp)",chart:{type:"column",cats:["Under 5M","5–20M","20–50M","50–100M","100M+"],series:M.map((x,i)=>({name:x.label,color:MC[i],values:x.bands.map(b=>b.n)})),lblH:36}}];
    if(ns) cards.push({w:1.7,title:`${T.acc} that stopped ordering`,sub:"Names and phone numbers are left out; look accounts up by PIC and month",
      table:{colW:[10,20,22,...M.map(()=>10),10],head:["Account","PIC","Product · region",...M.map(x=>x.label),"Last order"],align:["l","l","l",...M.map(()=>"r"),"l"],rows:T.stopped.map(c=>[{v:c.label.replace("Account ",""),bold:true},c.pic||"–",[c.cat,c.region].filter(Boolean).join(" · ")||"–",...c.by.map(v=>v?rp(v):"–"),fds(c.last)])}});
    cards.push({w:.58,kpis:[{v:String(pct(T.retained.n,T.retained.of)),u:"%",l:`of ${F.label} customers ordered again in ${T.laterLabel} (${T.retained.n} of ${T.retained.of})`,hot:true},
      {v:String(T.fresh.n),u:"",l:`${Z.label} customers new to the period (${rp(T.fresh.gmv)})`},
      Z.openGmv?{v:rpParts(Z.openGmv)[0],u:rpParts(Z.openGmv)[1],l:`of ${Z.label} GMV not completed yet (${pl(Z.openN,"order")})`}:{v:rpParts(Z.aov)[0],u:rpParts(Z.aov)[1],l:`average ${Z.label} order`}]});
    S.push({kicker:pre+`Sales trend · order size and accounts`,title:N.tr3Title,rows:[{cards}],notes:N.tr3Notes});
    // month by month: PIC and product category heat matrices, new vs repeat customers
    const picRows=[...new Set(M.flatMap(x=>[...x.pic.keys()]))].sort((a,b)=>M.reduce((s,x)=>s+(x.pic.get(b)||0),0)-M.reduce((s,x)=>s+(x.pic.get(a)||0),0)).slice(0,7);
    const catRows=[...new Set(M.flatMap(x=>[...(T.cat.length?x.cat:x.family).keys()]))].sort((a,b)=>M.reduce((s,x)=>s+((T.cat.length?x.cat:x.family).get(b)||0),0)-M.reduce((s,x)=>s+((T.cat.length?x.cat:x.family).get(a)||0),0)).slice(0,7);
    const hf=v=>v>=10?String(Math.round(v)):v?v.toFixed(1):"–", ml=M.map(x=>x.label);
    const mm=[{w:1.05,title:"GMV by PIC and month",sub:"Rp million; darker = more",chart:{type:"heat",rows:picRows,cols:ml,rowW:170,val:(r,c)=>(M[ml.indexOf(c)].pic.get(r)||0)/1e6,fmt:hf}},
      {w:1.05,title:T.cat.length?"GMV by product category and month":"GMV by product type and month",sub:"Rp million; darker = more",chart:{type:"heat",rows:catRows,cols:ml,rowW:150,val:(r,c)=>((T.cat.length?M[ml.indexOf(c)].cat:M[ml.indexOf(c)].family).get(r)||0)/1e6,fmt:hf}}];
    if(F.hasCust) mm.push({w:.8,title:"New vs repeat customers",sub:"GMV per month by customer status",chart:{type:"column",stacked:true,cats:ml,series:[{name:"Repeat",color:CAT[0],values:M.map(x=>x.gmv-x.newGmv)},{name:"New",color:CAT[1],values:M.map(x=>x.newGmv)}],fmt:rpM,lblH:24}});
    S.push({kicker:pre+`Sales trend · month by month`,title:N.tr4Title,rows:[{cards:mm}],notes:N.tr4Notes});
    // who to win back first: lapsed customers per PIC, with CRM activity when a CRM export is there
    { const K=T.crm, LS=T.lapsedSum, PP=T.lapsedPic.slice(0,5), eng=p=>K?(K.pics.find(x=>x.p===p)||{}):{};
      const months0=M.slice(0,-1).map(x=>x.label);
      S.push({kicker:pre+`Sales trend · who to win back first`,title:N.tr5Title,rows:[{h:84,cards:[{kpiRow:[
          {v:String(LS.n),u:"",l:`customers bought in ${T.preLabel} but not in ${Z.label} (${rp(LS.gmv)})`},{v:String(LS.rep),u:"",l:`of them repeat buyers, 2+ orders (${rp(LS.repGmv)})`,hot:true},
          K?{v:String(K.lapsedHit),u:`/${K.lapsed}`,l:`contacted in the CRM (${K.span})`}:{v:String(Math.round(T.gapMed||0)),u:" days",l:"median time between a customer's orders"},
          K?{v:String(K.stoppedHit),u:`/${T.stopped.length}`,l:"accounts that stopped ordering contacted"}:{v:`${T.bothUp}`,u:`/${T.bothUp+T.bothDown}`,l:`customers in both ${F.label} and ${Z.label} who spent more`}]}]},
        {cards:[{title:"Lapsed customers by PIC",sub:`${T.lapsedPic.length>PP.length?`Top ${PP.length} of ${T.lapsedPic.length} PICs by lapsed GMV; `:""}PIC = the one on most of the customer's orders${K?`; CRM columns cover ${K.span}`:""}`,
          table:{head:["PIC",`GMV ${F.label} → ${Z.label}`,"Lapsed","Lapsed GMV","Repeat buyers",...months0.map(m=>`Last order ${m}`),...(K?["CRM eng.","Contacted"]:[])],align:["l","r","r","r","r",...months0.map(()=>"r"),"r","r"],
            rows:PP.map(x=>{ const d=T.pic.find(y=>y.k===x.p), e=eng(x.p); return [{v:x.p,bold:true},d?{v:(d.d>=0?"+":"−")+rp(Math.abs(d.d)),pill:d.d<0&&K&&!e.eng}:"–",x.n,rp(x.gmv),x.rep?`${x.rep} (${rp(x.repGmv)})`:"–",...x.byMonth,...(K?[e.eng||0,`${e.lapsedHit||0} of ${x.n}`]:[])]; })}}]}],notes:N.tr5Notes}); }


  }

  // Sales: what sold
  if(A.has.sales){
    const Q=A.qtyTotal||1, F0=A.byFamily[0], sp=A.priceSpread[0], pair=A.pairs[0];
    const k3=[F0&&(A.unitsAnchor?{v:String(pct(F0.qty,Q)),u:"%",l:`of all units sold are ${F0.k} (${nf.format(F0.qty)} of ${nf.format(Q)})`,hot:true}:{v:String(pct(F0.gmv,A.gmv)),u:"%",l:`of GMV is ${F0.k}${O.filter(o=>o.lines.some(l=>l.family===F0.k)).length===1?", from a single order":""}`,hot:true}),
      {v:A.itemsPerOrder.toFixed(1),u:"",l:`products per order; ${A.multiFamily} of ${O.length} orders mix product types${pair?`, most often ${pair[0]}`:""}`},
      sp&&sp.spread>=.05?{v:"+"+Math.round(sp.spread*100),u:"%",l:`price gap on ${sp.item} across ${sp.n} order lines (${rp(sp.min)}–${rp(sp.max)} per unit)`}:{v:rpParts(A.gmv/(O.length||1))[0],u:rpParts(A.gmv/(O.length||1))[1],l:"average order value"}].filter(Boolean);
    const cards=[{w:1.1,title:"GMV by product type",sub:"Grouped from item names; units in grey",chart:{type:"hbar",items:A.byFamily.slice(0,7).map(x=>({k:x.k,v:x.gmv,r:`${nf.format(x.qty)} units`})),fmt:rpM}}];
    if(A.byCat.length) cards.push({w:1.1,title:"GMV by product category",sub:"“product_cat”; orders under each column",chart:{type:"column",cats:A.byCat.slice(0,6).map(x=>`${x.k}\n${pl(x.orders,"order")}`),series:[{name:"GMV",color:CAT[2],values:A.byCat.slice(0,6).map(x=>x.gmv)}],fmt:rpM,lblH:46},foot:N.catLine||null});
    cards.push({w:.85,kpis:k3});
    S.push({kicker:pre+`${N.sk} · what sold`,title:N.soldTitle,rows:[{cards}]});

    // Sales: who bought and how
    const parG=A.partial.reduce((s,o)=>s+o.gmv,0), openG=A.openOrders.reduce((s,o)=>s+o.gmv,0), ncG=A.noCrm.reduce((s,o)=>s+o.gmv,0);
    const left=A.byRegion.length?{w:1,title:"GMV by customer region",sub:`${A.byProvince.map(p=>`${p.k} ${pct(p.gmv,A.gmv)}%`).join(" · ")}; customers in grey`,chart:{type:"hbar",items:A.byRegion.slice(0,7).map(x=>({k:x.k,v:x.gmv,r:`${x.cust} cust.`})),fmt:rpM},foot:N.regionNote||null}
      :{w:1,title:"GMV by customer role",sub:"No region in this export; orders in grey",chart:{type:"hbar",items:A.byRole.map(x=>({k:roleName(x.k),v:x.gmv,r:pl(x.n,"order")})),fmt:rpM}};
    const segs=[...A.byApp.map(x=>({k:`${appName(x.k)}\n${pl(x.n,"order")}`,v:x.aov,c:CAT[0]})),...A.byCust.map(x=>({k:`${x.k.replace(" customer","")}\n${pl(x.n,"order")}`,v:x.aov,c:CAT[2]}))];
    S.push({kicker:pre+`${N.sk} · who bought and how`,title:N.whoTitle,rows:[{cards:[left,
      {w:1.15,split:[{title:"Average order value",sub:"By ordering channel and customer type",chart:{type:"column",cats:segs.map(x=>x.k),series:[{name:"Average order",values:segs.map(x=>x.v),colors:segs.map(x=>x.c)}],fmt:rpM,lblH:34,
          legend:A.byCust.length?[{name:"Ordering channel",color:CAT[0]},{name:"Customer type",color:CAT[2]}]:null}},
        {title:"Sales PIC",sub:"GMV; orders in grey",chart:{type:"hbar",items:A.byPic.slice(0,4).map(x=>({k:x.p,v:x.g,r:pl(x.n,"order")})),fmt:rpM,color:"#5E8C47",rowH:40}}]},
      {w:.8,kpis:[A.partial.length&&{v:rpParts(A.outstanding||parG)[0],u:rpParts(A.outstanding||parG)[1],l:A.outstanding?`still unpaid on ${pl(A.partial.length,"partially paid order")} (${rp(parG)} GMV)`:`GMV on ${pl(A.partial.length,"partially paid order")}`,hot:true},
        A.openOrders.length&&{v:String(A.openOrders.length),u:`/${O.length}`,l:`orders still open, not completed (${rp(openG)})`},
        A.has.crm?{v:String(A.noCrm.length),u:`/${O.length}`,l:`orders with no CRM engagement (${rp(ncG)})`}:{v:String(pct(A.top2,A.gmv)),u:"%",l:"of GMV from the top 2 orders"}].filter(Boolean)}]}]});
  }

  // Sales: order size and timing
  if(N.oqNotes&&A.mode!=="trend"){
    const days=A.daily.filter(d=>d.orders), cum=[]; A.custAgg.reduce((s,c)=>{ s+=c.gmv; cum.push(Math.round(s/(A.gmv||1)*100)); return s; },0);
    const i80=cum.findIndex(v=>v>=80), nC=cum.length, BC=["Under Rp1M","Rp1–5M","Rp5–20M","Rp20–50M","Rp50M and up"];
    S.push({kicker:pre+`${N.sk} · order size and timing`,title:N.oqTitle,rows:[{cards:[
      {w:1.1,title:"GMV by day",sub:"Order date; orders under each column",chart:{type:"column",cats:days.map(d=>`${DAY[d.d.getDay()]} ${d.d.getDate()}\n${pl(d.orders,"order")}`),series:[{name:"GMV",color:CAT[0],values:days.map(d=>d.gmv)}],fmt:rpM,lblH:46}},
      {w:1,title:"Customer concentration",sub:`Cumulative % of GMV, ${nC} customers ranked`,chart:{type:"line",cats:cum.map((_,i)=>`#${i+1}`),series:[{name:"Cumulative share of GMV",color:CAT[0],values:cum}],max:100,fmt:v=>v+"%",
        ref:{v:80,label:i80>=0?`80% of GMV = top ${i80+1} of ${nC}`:"80% of GMV"},area:true,show:[...new Set([Math.min(2,nC-1),...(i80>=0?[i80]:[])])],xEvery:Math.max(1,Math.ceil(nC/7))}},
      {w:.85,title:"Orders by size",sub:"Number of orders; share of GMV on top",chart:{type:"column",cats:A.bands.map(b=>b.k),series:[{name:"Orders",values:A.bands.map(b=>b.n),colors:A.bands.map(b=>RAMP[4-BC.indexOf(b.k)])}],vfmt:(v,i)=>`${v} · ${pct(A.bands[i].gmv,A.gmv)}%`,lblH:36}}]}],notes:N.oqNotes});
  }

  // Sales: where to grow
  if(N.wgNotes){
    const cards=[], Hm=A.heat;
    if(Hm){ const cols=Hm.cols.map(c=>appName(c)); cards.push({w:1.3,title:`GMV by product type and ${Hm.dim}`,sub:"Rp million; darker = more",chart:{type:"heat",rows:Hm.rows,cols,rowW:150,val:(r,c)=>Hm.v(r,Hm.cols[cols.indexOf(c)])/1e6,fmt:v=>v>=10?String(Math.round(v)):v.toFixed(1)}}); }
    if(A.cross&&A.cross.also.length) cards.push({w:1,title:"What else they bought",sub:`Share of the ${A.cross.n} ${A.cross.f.replace(/\s*\(.*\)/,"")} buyers`,chart:{type:"hbar",items:A.cross.also.map(x=>({k:x.k,v:pct(x.n,A.cross.n),r:`${x.n} of ${A.cross.n}`})),fmt:v=>v+"%",max:100,color:CAT[2]}});
    if(A.openOrders.length>=2&&A.aging.length) cards.push({w:.85,title:"Open orders by age",sub:`Still “NEW”, as of ${fds(A.asOf)}`,chart:{type:"column",cats:A.aging.map(a=>a.k),series:[{name:"Open orders",values:A.aging.map(a=>a.n),colors:["#86AD6C","#5E8C47","#D9A21B","#B85A28"]}],vfmt:(v,i)=>v?`${v} · ${rp(A.aging[i].gmv)}`:"0",lblH:24}});
    if(cards.length>=2) S.push({kicker:pre+`${N.sk} · where to grow`,title:N.wgTitle,rows:[{cards}],notes:N.wgNotes});
  }

  // Rejection reasons in detail
  if(A.reasonRows.length){
    const RL=A.reasonList.slice(0,7), dims=A.reasonDims, more=A.reasonList.length-RL.length;
    const cols=dims.flatMap(k=>countBy(A.reasonRows.filter(r=>r[k]),r=>r[k]).slice(0,3).map(([g])=>({k,g,lab:`${LABEL[k]}\n${g}`})));
    const cards=[{w:1,title:"Every reason given",sub:`${A.reasonRows.length} engagements that did not order${more>0?`; ${more} rarer reasons not shown`:""}; hover for the CRM wording`,
      chart:{type:"hbar",legend:[NI,WM,...(RL.some(r=>r.other)?[NS]:[])],items:RL.map(r=>({k:r.k,segs:[[r.lost,OUTC.lost,`${r.raw} · not interested: ${r.lost}`],[r.warm,OUTC.warm,`${r.raw} · considering / prospect: ${r.warm}`],[r.other,OUTC.none,`${r.raw} · no status: ${r.other}`]]})),rowH:44}}];
    if(cols.length) cards.push({w:1.05,title:`Reason by ${andList(dims.map(k=>lc(LABEL[k])))}`,sub:"Engagements per reason; darker = more",chart:{type:"heat",rows:RL.map(r=>r.k),cols:cols.map(c=>c.lab),rowW:170,headH:44,
      val:(r,lab)=>{ const c=cols.find(x=>x.lab===lab); return A.reasonRows.filter(x=>x.reason===r&&x[c.k]===c.g).length; }}});
    S.push({kicker:pre+N.rk,title:N.rrTitle,rows:[{cards}],notes:N.rrNotes});
  }

  // Rejection reasons: who can be won back
  if(N.plan){
    const grp=[["Can be won back",A.notWon.filter(r=>r.recov)],["Closed for now",A.notWon.filter(r=>!r.recov)]];
    const groups=grp.flatMap(([g,rs])=>countBy(rs,r=>r.theme||"No reason given").map(([t,n])=>({k:t,n,grp:g,color:THEME_C[t]||OUTC.none})));
    const ser=[["Just asking",r=>r.theme==="Just asking",THEME_C["Just asking"]],["Locked in elsewhere",r=>r.theme==="Locked in elsewhere",THEME_C["Locked in elsewhere"]],["Other reasons",r=>r.theme!=="Just asking"&&r.theme!=="Locked in elsewhere",CAT[2]]];
    const row1=[{w:1.15,title:"Every lead that didn't order",sub:"One square per engagement, by reason",chart:{type:"waffle",groups,legendW:220}}];
    if(A.contacts.length>=2) row1.push({w:.9,title:"Contact outcome",sub:"Reasons by whether we actually talked",chart:{type:"column",stacked:true,cats:A.contacts,series:ser.map(([n,f,c])=>({name:n,color:c,values:A.contacts.map(k=>A.notWon.filter(r=>r.contact===k&&f(r)).length)})),lblH:30}});
    if(A.signals.length) row1.push({w:1,title:"What the notes say",sub:"Signals read from the discussion notes",chart:{type:"hbar",legend:[NI,WM],items:A.signals.slice(0,5).map(x=>({k:x.label,segs:[[x.lost,OUTC.lost,`not interested: ${x.lost}`],[x.warm,OUTC.warm,`considering / prospect: ${x.warm}`]]})),rowH:40}});
    S.push({kicker:pre+"Rejection reasons · who to call back",title:N.cbTitle,rows:[{cards:row1},{h:Math.min(220,64+N.plan.length*27),cards:[{table:{head:["Reason","Leads","Status","What to do","When"],align:["l","r","l","l","l"],rows:N.plan}}]}]});
  }

  // What separates winners
  if(N.driver){
    const D=N.driver, gs=A.best.groups.filter(x=>x.g!=="(not filled)");
    S.push({kicker:pre+"What separates winners",title:`${D.dim} decides the outcome. ${N.driverTitle}`,rows:[{cards:[
      {w:.9,title:`Share ${A.posLabel}, by ${lc(D.dim)}`,sub:`${A.crm.filter(r=>r.outcome).length} CRM engagements with a status`,chart:{type:"column",cats:gs.map(g=>`${g.g}\n${g.w} of ${g.n}`),series:[{name:"Rate",values:gs.map(g=>Math.round(g.rate*100)),colors:gs.map(g=>g===D.hi?OUTC.won:"#86AD6C")}],fmt:v=>v+"%",max:100,lblH:36}},
      {w:1.4,title:"Most common profile per cohort",sub:"Top value in each cohort and its share",table:{head:["",...A.cohorts.map(([c,rs])=>`${c} (${rs.length})`)],rows:A.profile.map(p=>[{v:LABEL[p.k],bold:true},...p.vals.map(v=>`${v.v} · ${Math.round(v.share*100)}%`)])}}]}],notes:[N.caveat]});
  }

  // Team performance
  if(N.pf){
    const hasS=A.has.sales, head=["PIC","CRM eng.","Reached","Won · warm · lost",...(hasS?["Orders","GMV","Orders in CRM"]:[])];
    const rows=A.picCard.slice(0,7).map(g=>[g.p,g.eng||"–",g.eng?`${pct(g.reached,g.eng)}%`:"–",g.eng?`${g.won} · ${g.warm} · ${g.lost}`:"–",...(hasS?[g.orders||"–",g.orders?rp(g.gmv):"–",g.orders?(g.inCrm?`${g.inCrm} of ${g.orders}`:{v:`0 of ${g.orders}`,pill:true}):"–"]:[])]);
    S.push({kicker:pre+"Team performance · funnel and PIC scorecard",title:N.pfTitle,rows:[{cards:[
      {w:.85,title:"CRM funnel",sub:"Engagements at each step; step conversion at the right",chart:{type:"funnel",steps:A.funnel}},
      {w:1.5,title:"PIC scorecard",sub:`CRM activity next to the orders each PIC closed${A.picCard.length>7?`; top 7 of ${A.picCard.length}`:""}`,table:{head,align:["l","r","r","r","r","r","r"],rows}}]}],notes:N.pfNotes});
  }

  // Recoverable demand
  if(A.warm.length){
    const SL=Object.fromEntries(SIGNALS.map(s=>[s[0],s[1]])), rows=A.warm.slice().sort((a,b)=>b.signals.length-a.signals.length).slice(0,6);
    S.push({kicker:pre+"Recoverable demand",title:N.warmTitle,rows:[{h:104,cards:[{kpiRow:[{v:String(A.warm.length),u:"",l:"Considering or prospect",hot:true},{v:String(A.intentWarm.length),u:"",l:"Asked about warehouse, delivery or price"},
      {v:String(A.warm.filter(r=>/unable|tidak bisa/i.test(r.callResp||"")).length),u:"",l:"Could not be reached by phone"},{v:String(A.stockRows.length),u:"",l:"Stalled on stock or delivery time"}]}]},
      {cards:[{title:"Leads still in play",sub:`${A.warm.length>rows.length?`${rows.length} of ${A.warm.length} shown. `:""}Names and phone numbers are left out; look leads up by ID in the CRM`,
        table:{head:["ID","PIC","Channel","Status","What they asked or said"],rows:rows.map(r=>[r.id||"–",r.pic||"–",r.channel||"–",{v:r.status,pill:true},r.signals.map(s=>SL[s]).join("; ")||r.reason||"–"])}}]}]});
  }
  return S;
}
function teamSlides(A,N,pre,S,next){ teamSpecs(A,N,pre).forEach(sp=>S.push(panelSlide(next(),sp))); }

/* ================= Whole deck (one or more teams) ================= */
// Footer line on every content slide: what GMV means, what is compared and the as-of date.
let FOOT_BASIS="SAWITPRO PROPRIETARY";
function basisOf(T,X){
  const tr=T.find(t=>t.A.trend)?.A.trend, sales=T.some(t=>t.A.has.sales), last=X.dates[X.dates.length-1];
  const asOf=last?`data to ${fds(last)} ${last.getFullYear()}`:"";
  return [sales&&"GMV incl. shipping, before discount",tr?`${tr.Z.label} vs ${tr.F.label}`:T.some(t=>t.A.wow)?"last week vs the week before":null,asOf].filter(Boolean).join(" · ")||"SAWITPRO PROPRIETARY";
}
function deckNarrative(T){
  const X=deckNarrative0(T); X.actions=draftActs(X.actions||[]); X.basis=basisOf(T,X); FOOT_BASIS=X.basis; return X;
}
function deckNarrative0(T){
  if(T.some(t=>t.A.mode==="trend"&&t.A.trend)) return trendNarrative(T);
  const X={multi:T.length>1}, all=T.map(t=>t.A);
  X.dates=all.flatMap(A=>A.dates).sort((a,b)=>a-b); X.period=span(X.dates);
  if(!X.multi){ const N=T[0].N; return Object.assign(X,{eyebrow:N.team,title:N.title,meta:N.meta,headline:N.headline,kpis:N.kpis,findings:N.findings,bottom:N.bottom,
      actions:N.actions.map(a=>({...a})),gaps:N.gaps}); }
  const gmv=all.reduce((s,A)=>s+A.gmv,0), orders=all.reduce((s,A)=>s+A.orders.length,0), crm=all.reduce((s,A)=>s+A.crm.length,0);
  const won=all.reduce((s,A)=>s+A.won.length,0), wonL=all.reduce((s,A)=>s+A.wonLinked.length,0);
  X.eyebrow="Weekly Sales Review"; X.title=`${andList(T.map(t=>t.name))} Last Week`;
  X.meta=[orders&&`${orders} orders`,crm&&`${crm} CRM engagements`,`${T.length} teams`].filter(Boolean).join(" · ");
  X.headline=gmv?`${rp(gmv)} in sales last week: ${T.map(t=>`${t.name} ${rp(t.A.gmv)}${t.A.wow&&t.A.wow.pc!=null?` (${t.A.wow.flat?"flat":(t.A.wow.up?"+":"−")+t.A.wow.pc+"%"})`:""}`).join(", ")}`:`${crm} CRM engagements across ${T.length} teams`;
  X.kpis=[{v:rpParts(gmv)[0],u:rpParts(gmv)[1],l:`Total GMV from ${orders} orders`,hot:true},
    ...T.slice(0,2).map(t=>({v:rpParts(t.A.gmv)[0],u:rpParts(t.A.gmv)[1],l:`${t.name}: ${t.A.orders.length} orders, ${pct(t.A.gmv,gmv)}% of GMV`})),
    {v:String(wonL),u:`/${won}`,l:"CRM wins confirmed in sales data"}];
  // two findings per team, labelled with the team
  X.findings=T.flatMap(t=>t.N.findings.slice(0,T.length>2?1:2).map(f=>[`${t.name}: ${f[0]}`,f[1]])).slice(0,4);
  X.bottom={p:`${T[0].name}: ${T[0].N.bottom.p}`,s:T.slice(1).map(t=>`${t.name}: ${t.N.bottom.p}`).join(" ")};
  // actions: up to 4 from the first team, 2 from the others, then fill to 6
  const take=T.map((t,i)=>t.N.actions.map(a=>({...a,team:t.name})).slice(0,i===0?4:2)), rest=T.map((t,i)=>t.N.actions.map(a=>({...a,team:t.name})).slice(i===0?4:2));
  X.actions=draftActs([...take.flat(),...rest.flat()].slice(0,6));
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
    ...(T.some(t=>t.A.wow)?[["GMV vs the week before",T.map(t=>t.A.wow?`${rp(t.A.wow.p.gmv)} → ${rp(t.A.wow.c.gmv)} (${t.A.wow.pc!=null?(t.A.wow.up?"+":"−")+t.A.wow.pc+"%":"new"})`:"–")]]:[]),
    ...(T.some(t=>t.A.trend)?[["GMV by month",T.map(t=>t.A.trend?`${t.A.trend.label}: ${t.A.trend.M.map(x=>rp(x.gmv)).join(" → ")}`:"–")]]:[]),
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
// Trend review (multi-month export): the summary is about the change across the months, not last week.
function trendNarrative(T){
  const X={multi:T.length>1,trend:true}, R=T.filter(t=>t.A.trend), t0=R[0], A=t0.A, TR=A.trend, F=TR.F, Z=TR.Z, N=t0.N, down=TR.dG<0&&!TR.flat;
  X.dates=T.flatMap(t=>t.A.dates).sort((a,b)=>a-b); X.period=span(X.dates);
  X.eyebrow=down?"Sales Decline Review":"Sales Trend Review"; X.title=`${andList(T.map(t=>t.name))} Sales ${TR.label}`;
  const crmN=T.reduce((s,t)=>s+(t.C?t.C.crm.length:0),0);
  X.meta=[`${T.reduce((s,t)=>s+t.A.orders.length,0)} orders`,`${T.reduce((s,t)=>s+(t.A.customers||0),0)} customers`,crmN&&`${crmN} CRM engagements${t0.C?` (${crmSpan(t0.C)})`:""}`].filter(Boolean).join(" · ");
  X.headline=R.length>1?R.map(t=>`${t.name}: ${t.N.trTitle}`).join(". "):N.trTitle;
  const stopG=TR.stopBy[0], ns=TR.stopped.length;
  X.kpis=[{v:rpParts(Z.gmv)[0],u:rpParts(Z.gmv)[1],l:`${Z.label} GMV, ${TR.flat?"flat":(TR.up?"▲ ":"▼ ")+TR.pc+"%"} vs ${rp(F.gmv)} in ${F.label}`,hot:true},
    {v:rpParts(TR.total)[0],u:rpParts(TR.total)[1],l:`total GMV ${TR.label} from ${A.orders.length} orders`},
    ns?{v:rpParts(stopG)[0],u:rpParts(stopG)[1],l:`${F.label} GMV from ${TR.acc} that stopped ordering (${pct(stopG,F.gmv)}%)`}:{v:rpParts(Z.aov)[0],u:rpParts(Z.aov)[1],l:`average order in ${Z.label} (${rp(F.aov)} in ${F.label})`},
    {v:String(pct(TR.retained.n,TR.retained.of)),u:"%",l:`of ${F.label} customers ordered again in ${TR.laterLabel} (${TR.retained.n} of ${TR.retained.of})`}];
  const f=[], sg=v=>(v>=0?"+":"−")+rp(Math.abs(v)), K=TR.crm, mid=TR.low!==F&&TR.low!==Z?TR.low:null;
  f.push([TR.flat?`GMV flat from ${F.label} to ${Z.label}`:`GMV ${TR.up?"up":"down"} ${TR.pc}% from ${F.label} to ${Z.label}`,`${M_(TR)}${mid?`, with ${mid.label} the low point`:""}.`]);
  if(ns) f.push([`${TR.acc} stopped ordering`,`${rp(stopG)} in ${F.label} (${pct(stopG,F.gmv)}% of the month), nothing in ${Z.label}; ${andList([...new Set(TR.stopped.map(c=>c.cat).filter(Boolean))])}, handled by ${andList([...new Set(TR.stopped.map(c=>c.pic).filter(Boolean))])}.`]);
  const V=TR.vol; if(V&&V.kgP>0&&V.rP<0) f.push([`More fertilizer sold, less per kg`,`${V.t(F.kg)} → ${V.t(Z.kg)} (+${V.kgP}%), but GMV per kg fell ${-V.rP}%: a cheaper mix ${sg(V.mix)}${V.pd[0]?`, price cuts ${sg(V.price)} (${V.pd[0].k} ${pcs(V.pd[0].chg)})`:""}.`]);
  else if(ns&&TR.restPct!=null) f.push([`Everyone else ${TR.rest[TR.rest.length-1]>=TR.rest[0]?"grew":"fell"} ${Math.abs(Math.round(TR.restPct*100))}%`,`${rp(TR.rest[0])} → ${rp(TR.rest[TR.rest.length-1])}; orders ${F.orders} → ${Z.orders}, average order ${rp(F.aov)} → ${rp(Z.aov)}${TR.cat.find(x=>x.d>0)?`; ${TR.cat.find(x=>x.d>0).k} ${sg(TR.cat.find(x=>x.d>0).d)}`:""}.`]);
  if(K) f.push([`${TR.lapsedSum.n} customers lapsed, and the CRM isn't chasing them`,`${TR.lapsedSum.rep} were repeat buyers (${rp(TR.lapsedSum.repGmv)}); ${K.lapsedHit} of ${K.lapsed} lapsed customers and ${K.stoppedHit} of ${ns} stopped accounts were contacted (${K.span}).`]);
  else f.push([`Only ${pct(TR.retained.n,TR.retained.of)}% of ${F.label} customers came back`,`${TR.retained.n} of ${TR.retained.of} ordered again in ${TR.laterLabel}; ${TR.fresh.n} ${Z.label} customers are new to the period.`]);
  X.findings=f.slice(0,4);
  X.bottom={p:ns&&TR.explains?`The drop is ${TR.acc}, not the base: win them back and keep the ${Math.round(TR.restPct*100)}% growth everyone else delivered.`:down?`Find out what changed for the customers who stopped buying and win them back.`:`Keep what grew GMV and widen the customer base.`,
    s:[Z.openGmv&&`${rp(Z.openGmv)} of ${Z.label} orders still need to be completed.`,K&&K.lapsed&&`Point the call list at the ${K.lapsed} lapsed customers.`].filter(Boolean).join(" ")};
  // actions: the trend's own first, then call lapsed customers, then the CRM team's own
  const act=[]; T.forEach(t=>{ const a=t.N.actions.filter(x=>/Win back|Close out/.test(x.t)).map(x=>({...x,team:X.multi?t.name:null})); act.push(...a);
    const k=t.A.trend&&t.A.trend.crm; if(k&&k.lapsed-k.lapsedHit>0) act.push({t:`Call the ${k.lapsed-k.lapsedHit} lapsed customers`,d:`They bought in ${t.A.trend.preLabel} (${rp(k.lapsedGmv)}) but not in ${t.A.trend.Z.label}, and ${k.lapsedHit?`only ${k.lapsedHit} ${k.lapsedHit===1?"is":"are"}`:"none are"} in the CRM. Put them at the top of each PIC's call list with their last order and product, and log every call.`,o:"Each PIC",w:"Next 2 weeks",team:X.multi?t.name:null});
    const tr=t.A.trend, up=tr&&tr.pic.filter(x=>x.d>0).slice(0,2), v=tr&&tr.vol;
    if(v&&v.rP<=-10) act.push({t:`Check what the ${-v.rP}% lower GMV per kg costs in margin`,d:`${v.gain&&v.gain.d>.03?`${v.gain.f} grew to ${Math.round(v.gain.b*100)}% of kg sold. `:""}${v.pd.length?`Prices fell on ${v.pd.slice(0,2).map(x=>`${x.k} (${pcs(x.chg)})`).join(" and ")}. `:""}Confirm the margin per product and pair low-priced products with higher-value ones in each offer.`,o:"Pricing + sales lead",w:"Next 2 weeks",team:X.multi?t.name:null});
    if(up&&up.length) act.push({t:`Repeat what ${andList(up.map(x=>x.k.split(" ")[0]))} did`,d:`${up.map(x=>`${x.k} ${sg(x.d)}`).join(", ")} from ${tr.F.label} to ${tr.Z.label}${tr.cat.find(x=>x.d>0)?`, led by ${tr.cat.find(x=>x.d>0).k}`:""}. Share their customer list and offer with the team.`,o:"Team lead",w:"Next team meeting",team:X.multi?t.name:null});
    if(t.NC) act.push(...t.NC.actions.slice(0,2).map(x=>({...x,team:X.multi?t.name:null}))); });
  X.actions=draftActs(act.slice(0,6));
  X.gaps=T.flatMap(t=>t.NC?t.NC.gaps.map(g=>`${X.multi?t.name+": ":""}${g}`):[]);
  return X;
}
const pcs=v=>`${v<0?"−":"+"}${Math.abs(Math.round(v*100))}%`, sgn=v=>(v>=0?"+":"−")+rp(Math.abs(v));
const crmSpan=C=>span(C.crm.map(r=>r.date)).replace(/ \d{4}$/,"");
const M_=TR=>TR.M.map(x=>rp(x.gmv)).join(" → ");
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
  if(X.multi&&!X.trend){
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
    if(t.C&&t.NC) teamSlides(t.C,t.NC,`${X.multi?`${t.name} · `:""}CRM ${crmSpan(t.C)} · `,S,next);
  });
  S.push(contentSlide(next(),"Next steps",`${X.actions.length} draft actions ${X.trend?"to recover sales":"for the coming week"}; owners and dates to be agreed`,`
    <div class="act${X.actions.length>4?" act3":""}">${X.actions.map((a,i)=>`<div class="card"><h3><span>${i+1}</span>${esc(a.t)}</h3><p>${esc(a.d)}</p><div class="meta">${a.team?`<span class="team">${esc(a.team)}</span>`:""}<span>Owner: ${esc(a.o)}</span><span class="when">${esc(a.w)}</span></div></div>`).join("")}</div>
    ${X.gaps.length?`<div class="gaps"><b>Also clean up in the CRM:</b> ${esc(X.gaps.join("; "))}.</div>`:""}`));
  S.push(`<div class="slide closing"><img class="bg" src="${IMG.closing}" alt=""><div class="shade"></div><img class="wm" src="${IMG.wm}" alt="SawitPRO.id"><img class="lg" src="${IMG.logo}" alt="">
    <div class="box"><h2>Thank You</h2><p>#TerusTumbuh</p></div></div>`);
  return S;
}
