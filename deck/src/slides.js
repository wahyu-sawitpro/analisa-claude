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

  // Customers chasing orders
  if(A.service.length>=3){ const SV=A.service, iss=countBy(SV,r=>r.issue), first=SV.filter(r=>r.first).length, sp=countBy(SV,r=>r.pic)[0];
    N.svTitle=`${SV.length} “leads” were customers chasing ${A.svcRefs.length||"their"} order${A.svcRefs.length===1?"":"s"}${A.svcSla?`; ${A.svcSla} mention the SLA or a queue`:""}`;
    N.svNotes=[
      `<b>${esc(iss[0][0])}</b> is the most common issue (${iss[0][1]} of ${SV.length})${iss[1]?`, then ${esc(lc(iss[1][0]))} (${iss[1][1]})`:""}.`,
      first&&`<b>${first} ${first===1?"is a first purchase":"are first purchases"}.</b> A late first order is the likeliest to be the last one.`,
      sp&&`<b>${esc(sp[0])} handled ${sp[1]} of ${SV.length}</b>, escalating to ops by hand. Give ops a weekly list of overdue orders instead of waiting for customers to ask.`,
      `<b>They are left out of the rejection reasons and the funnel</b>, and logged in the CRM as leads only because there is no service status.`
    ].filter(Boolean); }

  // Engagements logged from a template (same status, reason and location, no notes)
  N.tplWho=andList(A.templated.map(t=>t.p)); N.tplN=A.templated.reduce((s,t)=>s+t.n,0); N.tplSrc=andList([...new Set(A.templated.map(t=>lc(t.src.v||"these")))]);
  N.tplDominant=A.tplRows.length>=Math.max(5,A.notWon.length*.5);
  // Rejection reasons in detail
  const sp=A.reasonSplit[0], TL={"Locked in elsewhere":"locked into a shop, KUD or agent","Just asking":"just asking","Stock & delivery":"stalled on stock or delivery","Price":"put off by price","Not a fit":"not a fit","Timing":"not buying yet"};
  if(A.reasonRows.length){
    const r0=A.reasonList[0];
    const uni=new Set([...(A.uniform||[]).map(x=>x.p),...A.templated.map(t=>t.p)]), spG=sp?sp.groups.filter(g=>!(sp.k==="pic"&&uni.has(g.g))):[];
    N.rrTitle=N.tplDominant?`${A.tplRows.length} of ${A.reasonRows.length} “not interested” entries are logged from a template, so the real reasons are unknown`:spG.length?spG.slice(0,2).map(g=>`${g.g}: ${g.tn} of ${g.n} ${TL[g.theme]||lc(g.theme)}`).join(". ")+"."
      :`“${r0.k}” is the most common reason (${r0.n} of ${A.reasonRows.length})`;
    N.rrNotes=[
      spG.length&&`<b>${esc(LABEL[sp.k])} predicts the reason.</b> ${esc(spG.slice(0,5).map(g=>`${g.g} (${g.n}): mostly ${TL[g.theme]||lc(g.theme)}`).join("; "))}. The answer depends on which list is being worked, so fix the list, not the pitch.`,
      !A.templated.length&&A.uniform?.length&&`<b>Check the entries of ${esc(andList(A.uniform.map(x=>`${x.p} (${x.same} of ${x.n})`)))}:</b> nearly all have the same status and reason, which looks like a form default rather than what each lead said.`,
      A.askTotal>=3&&A.askUnreach&&`<b>“Just asking” is partly a logging habit.</b> ${A.askUnreach} of ${A.askTotal} were recorded when the call didn't connect, so no reason was actually heard.`,
      A.templated.length&&`<b>${esc(N.tplWho)}: ${N.tplN} engagements look templated</b>: one status, one reason${A.templated.every(t=>t.loc.s>=.9)?` and one location (${esc(A.templated[0].loc.v)})`:""}, no notes${A.templated.some(t=>t.perDay)?` (${A.templated.filter(t=>t.perDay).map(t=>`${esc(t.p.split(" ")[0])} exactly ${t.perDay} a day`).join(", ")})`:""}. They can't say why ${esc(N.tplSrc)} leads say no.`,
      A.service.length>=2&&`<b>${A.service.length} more engagements were customers asking where their order is</b>${A.svcRefs.length?` (${A.svcRefs.length} orders named${A.svcSla?`, ${A.svcSla} past the delivery SLA`:""})`:""}; they are left out of the reasons above.`,
      A.locHot&&!A.templated.some(t=>t.loc.v===A.locHot.g)&&`<b>${esc(A.locHot.g)}</b>: ${A.locHot.tn} of ${A.locHot.n} engagements there are ${esc(TL[A.locHot.theme]||lc(A.locHot.theme))}.`
    ].filter(Boolean).slice(0,4);
  }

  // Success
  const wonDom=k=>{const c=countBy(A.won,r=>r[k]);return c[0]?{v:c[0][0],n:c[0][1]}:null};
  const wp=wonDom("pic"), wc=wonDom("channel");
  const both=wp&&wc?A.won.filter(r=>r.pic===wp.v&&r.channel===wc.v).length:0;
  const nonLead=A.wonPos.length+A.wonAfter.length;
  N.kindNote=nonLead?`${[A.wonPos.length&&`${A.wonPos.length} ${A.wonPos.length===1?"is a sale":"are sales"} logged at checkout (mobile shop or walk-in)`,A.wonAfter.length&&`${A.wonAfter.length} ${A.wonAfter.length===1?"is an after-sales call":"are after-sales calls"} on orders already placed`].filter(Boolean).join(" and ")}; ${A.wonLead.length} came from working a lead.`:"";
  if(won&&nonLead/won>=.5) N.winTitle=`${won} orders logged in the CRM, but only ${A.wonLead.length} came from working a lead${A.has.sales?` (${rp(A.linkedGmv)} in matched orders)`:""}`;
  else if(won) N.winTitle=both/won>=.6
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
  const conv=A.picCard.filter(g=>g.leadEng>=3&&!A.templated.some(t=>t.p===g.p)).map(g=>({...g,eng:g.leadEng,won:g.leadWon})).sort((a,b)=>b.won/b.eng-a.won/a.eng||b.eng-a.eng), cHi=conv[0], cLo=conv[conv.length-1];
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
    if(N.tplDominant) N.cbTitle=`No real call-back list yet: ${A.tplRows.length} of ${nw} leads carry the same templated reason; ${A.warm.length} ${A.warm.length===1?"is":"are"} genuinely in play`;
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
      `<b>Customers:</b> ${W.retained.n?`${W.retained.n} bought in both weeks (${rp(W.retained.prev)} → ${rp(W.retained.cur)})`:"none bought in both weeks"}, ${W.gained.n?`${W.gained.n} ${W.gained.n===1?"is":"are"} new to the week (${rp(W.gained.gmv)})`:"none are new to the week"} and ${W.lost.n} from the week before didn't reorder (${rp(W.lost.gmv)}).${!up&&W.lost.gmv>=Math.abs(W.dG)*.5?" Customers who didn't come back explain most of the drop.":!up&&W.retained.prev-W.retained.cur>=Math.abs(W.dG)*.5?` Regular customers buying less explains most of the drop (${W.retained.down} of ${W.retained.n} spent less).`:up&&W.gained.gmv>=W.dG*.5?" Customers who didn't buy the week before explain most of the growth.":up&&W.retained.cur-W.retained.prev>=W.dG*.5?` Regular customers buying more explains most of the growth (${W.retained.up} of ${W.retained.n} spent more).`:""}`,
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
  if(tTop&&lost>=8) F.push([tTop.t==="Locked in elsewhere"?"Rejections are about loyalty, not product":`Top rejection theme: ${lc(tTop.t)}`,
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
  if(won&&(A.wonPos.length+A.wonAfter.length)/won>=.5) F.splice(1,0,["Most CRM “wins” are logged after the sale",`${N.kindNote.replace(/^./,c=>c.toUpperCase())} So the CRM can't yet show what turns a lead into an order.`]);
  if(A.service.length>=3) F.splice(1,0,[`${A.service.length} customers chased late orders`,`They were logged as leads but asked where their order is${A.svcRefs.length?`: ${A.svcRefs.length} orders named${A.svcSla?`, ${A.svcSla} engagements mention the SLA or a queue`:""}`:""}. Late deliveries put the next order at risk.`]);
  if(A.templated.length){ const t=A.templated[0], f=[`${N.tplN} leads are logged from a template`,`${N.tplWho}: one status, one reason${t.loc.s>=.9?`, one location (${t.loc.v})`:""} and no notes${t.perDay?`; ${t.p.split(" ")[0]} logs exactly ${t.perDay} a day`:""}. The ${N.tplSrc} results can't be judged.`];
    if(N.tplDominant){ const i=F.findIndex(x=>/rejection theme|just asking|loyalty/i.test(x[0])); if(i>=0) F.splice(i,1); F.splice(1,0,f); } else F.push(f); }
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
  if(tTop&&tTop.t==="Locked in elsewhere"&&tTop.lost>=5) act.push({t:"Stop competing head-on with KUDs and shops",d:`${tTop.lost} rejections are tied to an existing shop, KUD or agent${sig("credit").lost?`, ${sig("credit").lost} of them buying on credit`:""}. Test a KUD partnership or payment terms, and drop these numbers from this season's call lists.`,o:"Sales lead",w:"Next 2 weeks"});
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
  if(A.service.length>=3){ const sp=countBy(A.service,r=>r.pic)[0]?.[0]; act.splice(1,0,{t:`Clear the late-order backlog${A.svcRefs.length?` (${A.svcRefs.length} orders)`:""}`,d:`Customers asked about ${A.svcRefs.length?A.svcRefs.slice(0,4).join(", ")+(A.svcRefs.length>4?", …":""):"their orders"}. Get a delivery date from ops for each, tell the customer before they ask again, and log these as order follow-ups, not leads.`,o:`Ops${sp?` + ${sp}`:""}`,w:"This week"}); }
  if(A.overdue.length){ const ov=A.overdue, pv=ov.reduce((s,r)=>s+(r.potential||0),0); act.splice(2,0,{t:`Close ${ov.length} prospect${ov.length>1?"s":""} past ${ov.length>1?"their":"its"} closing date${pv?` (${rp(pv)})`:""}`,d:`${ov.map(r=>`${r.product||r.purpose||"prospect"}${r.potential?` ${rp(r.potential)}`:""}, due ${fds(r.closing)}`).slice(0,3).join("; ")}. Call this week to close or set a new date.`,o:andList([...new Set(ov.map(r=>r.pic).filter(Boolean))])||"PIC",w:"This week"}); }
  if(A.templated.length){ const t=A.templated[0]; const ai=act.findIndex(a=>/catch-all/.test(a.t)); if(ai>=0) act.splice(ai,1);
    act.splice(N.tplDominant?1:act.length,0,{t:`Log what ${N.tplSrc} leads actually said`,d:`${N.tplN} engagements by ${N.tplWho} share one status, one reason${t.loc.s>=.9?" and one location":""} with no notes. Record the real reason, the lead's location and one line of the conversation, or the ${N.tplSrc} spend can't be judged.`,o:N.tplWho,w:"This week"}); }
  if(A.wow){ const W=A.wow;
    if(!W.up&&!W.flat&&W.retained.prev-W.retained.cur>W.lost.gmv&&W.retained.down) act.unshift({t:`Find out why ${W.retained.down} regular customer${W.retained.down>1?"s":""} bought less`,d:`Customers who ordered in both weeks spent ${rp(W.retained.prev)} → ${rp(W.retained.cur)}${W.family.find(x=>x.d<0)?`; ${W.family.find(x=>x.d<0).k} fell most`:""}. Check stock, price and delivery with each, and agree the next order size.`,o:"Sales PIC",w:"This week"});
    else if(!W.up&&!W.flat&&W.lost.n>=1) act.unshift({t:`Win back ${W.lost.n} customer${W.lost.n>1?"s":""} who bought the week before`,d:`They spent ${rp(W.lost.gmv)} the week before and nothing last week${W.family.find(x=>x.d<0)?`; ${W.family.find(x=>x.d<0).k} fell most`:""}. Ask what stopped them (stock, price, delivery or timing) and book the next order.`,o:"Sales PIC",w:"This week"});
    else if(W.up&&!W.flat) act.splice(1,0,{t:`Repeat what lifted GMV ${W.pc!=null?W.pc+"%":""}`,d:`The increase came from ${W.drv}${W.lead?`, led by ${W.lead.k}`:""}. ${W.gained.n?`Book the next order with the ${W.gained.n} customer${W.gained.n>1?"s":""} who didn't buy the week before, within two weeks.`:"Keep the same call list and offer next week."}`,o:"Team lead",w:"Next week"}); }
  if(A.trend){ const T=A.trend, Z=T.Z, ns=T.stopped.length;
    if(ns&&!T.up) act.splice(1,0,{t:`Win back ${T.acc} that stopped ordering`,d:`${andList(T.stopped.map(c=>c.label))} bought ${rp(T.stopped.reduce((s,c)=>s+c.tot,0))} in ${T.preLabel} and nothing in ${Z.label}. Ask what changed (price, supplier, season) and agree the next order; don't let a few accounts carry the month.`,o:andList([...new Set(T.stopped.map(c=>c.pic).filter(Boolean))])||"Account PIC",w:"This week"});
    if(Z.openGmv>=Z.gmv*.1) act.push({t:`Close out ${rp(Z.openGmv)} of ${Z.label} orders`,d:`${Z.openN} ${Z.label} order${Z.openN===1?" is":"s are"} not completed${Z.partGmv?` and ${rp(Z.partGmv)} is only partially paid`:""}. Confirm delivery and payment dates so the month's GMV is realised.`,o:"Order PIC + finance",w:"This week"}); }
  if(N.tplDominant){ const i=act.findIndex(x=>x.t.startsWith("Log what")); if(i>0) act.unshift(act.splice(i,1)[0]); }
  N.actions=act.slice(0,6);
  if(N.tplDominant) N.bottom={p:`Make the ${N.tplSrc} logs usable before judging or funding them.`,s:`${N.tplN} of ${n} engagements carry one templated status and reason.${A.won.length?` The ${A.won.length} win${A.won.length>1?"s":""} came from ${andList([...new Set(A.won.map(r=>lc(r.channel||"other")))])}.`:""}`};
  if(!N.bottom.p) N.bottom.p=N.actions[0]?`${N.actions[0].t}.`:"Keep logging every engagement so wins and losses can be compared.";

  // Data gaps
  const g=[]; const fill=k=>A.crm.filter(r=>r[k]!==null&&r[k]!==undefined).length/(n||1);
  if(A.nostatus.length) g.push(`${A.nostatus.length} engagement${A.nostatus.length>1?"s":""} without a status`);
  const chMiss=A.crm.filter(r=>!r.channel).length; if(chMiss) g.push(`${chMiss} without an engagement type`);
  const low=["potential","needKg","followDate","location","custType"].filter(k=>A.crmMap[k]&&fill(k)<.3).map(k=>({potential:"potential GMV",needKg:"fertilizer needs",followDate:"follow-up date",location:"location",custType:"customer type"}[k]));
  if(low.length) g.push(`${andList(low)} mostly empty`);
  if(A.wonFromNotes.length) g.push(`${A.wonFromNotes.length} closed deal${A.wonFromNotes.length>1?"s":""} still marked “${A.wonFromNotes[0].statusLogged||"blank"}”`);
  if(A.dupRows) g.unshift(`${A.dupRows} engagement${A.dupRows>1?"s":""} entered twice`);
  if(A.service.length) g.unshift(`${A.service.length} order-status question${A.service.length>1?"s":""} logged as leads`);
  if(won&&A.wonLead.length<won) g.unshift(`${won-A.wonLead.length} checkout sale${won-A.wonLead.length>1?"s":""} logged as wins`);
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
// Short SKU label for tables: no pack size, no "MOP/" prefix ("RP Mahkota 50kg - Egypt" -> "RP Mahkota Egypt").
const skuShort=n=>String(n).replace(/\s*\d+(?:[.,]\d+)?\s*kg\b/gi,"").replace(/^MOP\//i,"").replace(/\s+-\s+/g," ").replace(/\s+/g," ").trim();
const mt1=v=>(Math.round(v*10)/10).toLocaleString("en-US",{minimumFractionDigits:1,maximumFractionDigits:1});
const mt0=v=>Math.round(v).toLocaleString("en-US");
// DO pipeline: where the FFB supplier leads stand, who and where they are, and the lead list with what is missing.
const DO_C={HOT:"#B85A28",WARM:"#D9A21B",COLD:"#5B7F95"};
const cap=t=>String(t).replace(/^./,c=>c.toUpperCase()), tN=v=>v==null?"–":nf.format(Math.round(v)), plS=(n,w)=>`${nf.format(n)} ${w}${n===1?"":"s"}`;
function doSpecs(Q,pre){
  const S=[], R=Q.rows, items=(c,col)=>c.map(([k,v])=>({k,v,color:col?col(k):CAT[0]}));
  const sc=k=>DO_C[k]||"#9AA592", ffbBy=(f)=>[...sumBy(R,f,r=>r.ffb||0)];
  const old=[...R].filter(r=>r.age!=null).sort((a,b)=>b.age-a.age)[0];
  S.push({kicker:pre+"DO pipeline · where the leads stand",
    title:`${plS(Q.n,"DO lead")}: ${Q.status.map(([k,v])=>`${v} ${k}`).join(", ")}; ${Q.progress.map(([k,v])=>`${v} at ${k.toLowerCase()}`).join(", ")}`,
    rows:[{cards:[
      {w:1,title:"Leads by status",sub:"Potential FFB (t) at the right",chart:{type:"hbar",items:Q.status.map(([k,v])=>({k,v,color:sc(k),r:`${tN(R.filter(r=>r.status===k).reduce((s,r)=>s+(r.ffb||0),0))} t`}))}},
      {w:1,title:"Leads by progress stage",sub:"Area (ha) at the right",chart:{type:"hbar",items:Q.progress.map(([k,v])=>({k,v,color:CAT[0],r:`${tN(R.filter(r=>r.progress===k).reduce((s,r)=>s+(r.area||0),0))} ha`}))}}]}],
    notes:[`<b>Size:</b> ${tN(Q.area)} ha and ${tN(Q.ffb)} t of potential FFB across ${plS(Q.n,"lead")}${Q.n>1?`; the largest is ${[...R].sort((a,b)=>(b.ffb||0)-(a.ffb||0))[0].id} with ${tN([...R].sort((a,b)=>(b.ffb||0)-(a.ffb||0))[0].ffb)} t`:""}.`,
      old&&`<b>Age:</b> the oldest open lead (${old.id}) was created ${fds(old.created)}, ${old.age} days ago, and is still ${old.status} at ${old.progress.toLowerCase()}.`].filter(Boolean)});
  const card=(title,c,sub)=>({w:1,title,sub,chart:{type:"hbar",items:c.slice(0,5).map(([k,v])=>({k,v,color:CAT[0]})),rowH:40}});
  S.push({kicker:pre+"DO pipeline · who and where",title:`${Q.pic.map(([k,v])=>`${k} ${v}`).slice(0,3).join(", ")}${Q.regency.length?`; ${Q.regency.slice(0,2).map(([k,v])=>`${k} ${v}`).join(", ")}`:""}${Q.mill.length?`; nearest mill ${Q.mill[0][0]}`:""}`,
    rows:[{cards:[card("By PIC",Q.pic,"Leads per PIC"),card("By regency",Q.regency,Q.prov.map(([k])=>k).slice(0,2).join(", ")),card("By nearest mill",Q.mill,"Mill closest to the DO")]},
      {cards:[card("By lead source",Q.source,"How the lead was found"),card("By customer type",Q.custType,"Type of DO"),
        {w:1,title:"Potential FFB by PIC",sub:"Tonnes",chart:{type:"hbar",items:ffbBy(r=>r.pic).slice(0,5).map(([k,v])=>({k,v,color:CAT[2]})),fmt:v=>`${tN(v)} t`,rowH:40}}]}]});
  const ord={HOT:0,WARM:1,COLD:2}, L=[...R].sort((a,b)=>(ord[a.status]??3)-(ord[b.status]??3)||(b.ffb||0)-(a.ffb||0)).slice(0,12);
  S.push({kicker:pre+"DO pipeline · lead list",title:`${R.filter(r=>r.missing.length).length} of ${plS(Q.n,"lead")} ${R.filter(r=>r.missing.length).length===1?"misses":"miss"} key information: ${[...new Map(R.flatMap(r=>r.missing).map(x=>[x,1])).keys()].slice(0,3).join(", ")||"none"}`,
    rows:[{cards:[{foot:`Hottest first, then by potential FFB. No owner names or phone numbers are shown. Age = days since the lead was created, to ${fds(Q.today)}.`,
      table:{colW:[9,12,10,13,11,7,7,7,8,8,6,18],head:["Lead","PIC","Regency","Customer type","Progress","Status","Area (ha)","FFB (t)","Nearest mill","Created","Age","Missing"],align:["l","l","l","l","l","l","r","r","l","l","r","l"],
        rows:L.map(r=>[{v:r.id,bold:true},r.pic||"–",r.regency||"–",r.custType||"–",r.progress,{v:r.status,fill:sc(r.status),color:"#FFFFFF"},tN(r.area),tN(r.ffb),r.mill||"–",r.created?fds(r.created):"–",r.age??"–",r.missing.join(", ")||"–"])}}]}]});
  return S;
}
function doNarrative(T){
  const Q=T[0].A.dop, R=Q.rows, X={multi:false,dop:true,gaps:[],dates:Q.dates}, hot=R.filter(r=>r.status==="HOT").length, cold=R.filter(r=>r.status==="COLD").length;
  const miss=countBy(R.flatMap(r=>r.missing.map(m=>({m}))),x=>x.m), early=R.filter(r=>/first|outreach|contact/i.test(r.progress)).length, old=[...R].filter(r=>r.age!=null).sort((a,b)=>b.age-a.age)[0];
  const partial=Q.maxId&&Q.maxId>Q.n*1.5;
  X.eyebrow="DO Pipeline"; X.title=`Smallholder DO Leads, ${Q.dates.length?`${fds(Q.dates[0])}${Q.dates.length>1&&+Q.dates[0]!==+Q.dates[Q.dates.length-1]?` – ${fds(Q.dates[Q.dates.length-1])}`:""}`:"status"}`;
  X.period=`Status to ${fds(Q.today)} ${Q.today.getFullYear()}`; X.meta=plS(Q.n,"DO lead");
  X.headline=`${plS(Q.n,"DO lead")} with ${tN(Q.area)} ha and ${tN(Q.ffb)} t of potential FFB; ${cold===Q.n?`${Q.n===1?"it is":"all are"} still COLD`:`${hot} HOT, ${cold} COLD`}${early?` and ${early===Q.n?(Q.n===1?"at":"all at"):`${early} at`} first outreach`:""}`;
  X.kpis=[{v:nf.format(Q.n),u:"",l:`DO lead${Q.n===1?"":"s"} in this export${partial?` (IDs run to ${Q.maxId})`:""}`,hot:true},
    {v:tN(Q.ffb),u:" t",l:"potential FFB across the leads"},{v:tN(Q.area),u:" ha",l:"area across the leads"},
    {v:String(hot),u:`/${Q.n}`,l:`HOT leads; ${cold} COLD${old?`, oldest ${old.age} days`:""}`}];
  X.findings=[
    partial&&[`This export looks partial`,`It has ${plS(Q.n,"lead")} but the lead IDs run to ${Q.maxId}, so about ${Q.maxId-Q.n} leads are missing. Re-export the full DO pipeline before reading trends from it.`],
    [`No lead has moved past first contact`.replace("No lead has",early===Q.n?"No lead has":`${Q.n-early} of ${Q.n} leads have`).replace("moved past first contact",early===Q.n?"moved past first contact":"moved past first contact"),`${Q.progress.map(([k,v])=>`${v} at ${k}`).join(", ")}; status ${Q.status.map(([k,v])=>`${k} ${v}`).join(", ")}${old?`. ${old.id} is ${old.age} days old`:""}.`],
    miss.length&&[`Key fields are empty`,`${cap(miss.slice(0,4).map(([k,v])=>`${k} (${v} of ${Q.n})`).join(", "))}. Without the distance to the mill and the current buyer the offer can't be priced.`],
    [`Where the volume is`,`${Q.regency.slice(0,2).map(([k,v])=>`${k} ${v}`).join(", ")||"No regency"}${Q.mill.length?`, nearest mill ${Q.mill.slice(0,2).map(([k])=>k).join(", ")}`:""}; ${Q.custType.slice(0,2).map(([k,v])=>`${k} ${v}`).join(", ")}, found through ${Q.source.slice(0,2).map(([k])=>k.toLowerCase()).join(" and ")}.`]].filter(Boolean).slice(0,4);
  X.bottom={p:partial?`Get the full DO pipeline export, then move the COLD leads past first outreach with the missing facts filled in.`:`Move the COLD leads past first outreach, and fill in the mill distance and current buyer so each offer can be priced.`,
    s:`Status as exported from the CRM; potential FFB and area are as entered by the PIC. Owner names and phone numbers are not shown.`};
  const byPic=countBy(R.filter(r=>r.status!=="HOT"),r=>r.pic);
  X.actions=[
    partial&&{t:`Re-export the full DO pipeline`,d:`This file has ${plS(Q.n,"lead")} but IDs run to ${Q.maxId}. Export every DO lead (all PICs, all statuses) so the deck shows the whole pipeline.`,o:"",w:""},
    old&&{t:`Second visit for ${old.id}`,d:`${old.pic||"The PIC"}: ${old.age} days at ${old.progress.toLowerCase()}, ${tN(old.area)} ha and ${tN(old.ffb)} t potential FFB${old.mill?` near ${old.mill}`:""}. Agree the next step and a closing date.`,o:"",w:""},
    miss.length&&{t:`Fill in ${miss.slice(0,2).map(([k])=>k).join(" and ")}`,d:`${cap(miss.map(([k,v])=>`${k} empty on ${v} of ${Q.n}`).join("; "))}. Make them required before a lead moves past first outreach.`,o:"",w:""},
    byPic.length&&{t:`Weekly DO pipeline review by PIC`,d:`Leads not yet HOT: ${byPic.map(([k,v])=>`${k} ${v}`).join(", ")}. Review progress, status and closing dates each week in this deck.`,o:"",w:""}].filter(Boolean);
  return X;
}
// Farmer acquisition: Duta vs non-Duta last week, what moved the total, the weekly trend, and the channel / campaign detail.
const sg=v=>v>0?`+${nf.format(v)}`:v<0?`−${nf.format(-v)}`:"0", spc=(l,p)=>p?`${l>=p?"+":"−"}${Math.abs(Math.round((l/p-1)*100))}%`:"–";
const SRC_C={Organic:CAT[0],GADN:CAT[2],Meta:CAT[4],"Identified Campaigns":CAT[1],Duta:CAT[3]};
const srcC=(k,i)=>SRC_C[k]||EXTRA[i%EXTRA.length];
function acqSpecs(Q,pre){
  const S=[], L=Q.L, P=Q.P, W=Q.weeks, d=P?L.total-P.total:0, dn=P?L.non-P.non:0, du=P?L.under-P.under:0;
  const drops=Q.dSrc.filter(x=>x.d<0).sort((a,b)=>a.d-b.d), ups=Q.dSrc.filter(x=>x.d>0).sort((a,b)=>b.d-a.d), top=drops[0];
  // 1. Duta vs non-Duta (internal-team Dutas and external Dutas are both Duta)
  const D=Q.dutas, act=D.filter(x=>x.l), intN=D.filter(x=>x.internal).length;
  const rowsT=[
    [{v:"Duta",bold:true},P?nf.format(P.under):"–",{v:nf.format(L.under),bold:true},P?sg(du):"–",P?spc(L.under,P.under):"–",`${(L.under/L.total*100).toFixed(1)}%`],
    ["   Internal-team Dutas",P?nf.format(P.test):"–",nf.format(L.test),P?sg(L.test-P.test):"–",P?spc(L.test,P.test):"–",""],
    ["   External Dutas",P?nf.format(P.real):"–",nf.format(L.real),P?sg(L.real-P.real):"–",P?spc(L.real,P.real):"–",""],
    [{v:"Non Duta",bold:true},P?nf.format(P.non):"–",{v:nf.format(L.non),bold:true},P?sg(dn):"–",P?spc(L.non,P.non):"–",`${(L.non/L.total*100).toFixed(1)}%`],
    [{v:"Total farmers",bold:true},P?{v:nf.format(P.total),bold:true}:"–",{v:nf.format(L.total),bold:true},P?{v:sg(d),bold:true}:"–",P?{v:spc(L.total,P.total),bold:true}:"–","100%"]];
  const rowsD=D.slice(0,12).map(x=>[{v:x.k,bold:!!x.l},x.internal?"Internal team":"External",P?(x.p?nf.format(x.p):"–"):"–",x.l?{v:nf.format(x.l),bold:true}:"–",nf.format(x.tot)]);
  S.push({kicker:pre+"Acquisition · Duta vs non-Duta",
    title:P?`Dutas brought ${nf.format(L.under)} farmers last week (${sg(du)}), ${(L.under/L.total*100).toFixed(1)}% of ${nf.format(L.total)}; non-Duta ${nf.format(L.non)} (${sg(dn)})`:`Dutas brought ${nf.format(L.under)} of ${nf.format(L.total)} farmers in the week of ${L.label}`,
    rows:[
      {cards:[
        {w:1.1,title:"Duta vs non-Duta, last week vs the week before",sub:P?`${P.label} vs ${L.label}`:L.label,table:{colW:[30,13,13,12,11,13],head:["Farmers",P?`Week of ${P.short}`:"Week before",`Week of ${L.short}`,"Change","Change %","Share last week"],align:["l","r","r","r","r","r"],rows:rowsT}},
        {w:1,title:"Farmers by Duta",sub:`Last week first; ${W.length} weeks = ${W[0].short} – ${L.short}`,table:{colW:[32,24,15,15,14],head:["Duta","Type",P?`Week of ${P.short}`:"Week before",`Week of ${L.short}`,`${W.length} weeks`],align:["l","l","r","r","r"],rows:rowsD}}]}],
    notes:[
      `<b>Dutas:</b> ${L.under} farmers last week came through ${act.length} Duta${act.length===1?"":"s"} (${act.map(x=>`${x.k} ${x.l}`).join(", ")||"none"}), all ${L.real?"":"from "}${L.real?`${L.test} internal team, ${L.real} external`:"internal-team Dutas"}. ${intN} of the ${D.length} Dutas with farmers in ${W.length} weeks are internal team; external Dutas brought ${Q.weeks.reduce((s,x)=>s+x.real,0)}.`,
      Q.dropped&&`<b>Week left out:</b> the week of ${fds(new Date(Q.dropped.w))} (${nf.format(Q.dropped.n)} farmers to ${fds(Q.dropped.to)}) is still in progress, so last week is ${L.label}.`].filter(Boolean)});
  // 2. What moved the total
  if(P){ const steps=[{k:`Week before\n${P.short}`,v:P.total,total:true},...Q.dSrc.filter(x=>x.d).sort((a,b)=>a.d-b.d).map(x=>({k:x.k,v:x.d})),{k:`Last week\n${L.short}`,v:L.total,total:true,color:CAT[0]}];
    const cm=Q.camps.filter(x=>x.d), cItems=[...cm.slice(0,5),...cm.slice(-3).reverse()].filter((x,i,a)=>a.indexOf(x)===i).sort((a,b)=>a.d-b.d).map(x=>({k:x.k,v:x.d,tip:`${x.p} → ${x.l}`}));
    const topC=Q.camps[0];
    S.push({kicker:pre+"Acquisition · what moved the total",
      title:top?`${top.k} explains ${pct(-top.d,-d>0?-d:1)}% of the drop (${sg(top.d)}); ${ups.length?`${ups.map(x=>`${x.k} ${sg(x.d)}`).join(", ")} grew`:"no channel grew"}`:`Farmers ${sg(d)} on the week before`,
      rows:[{cards:[
        {w:1,title:"From the week before to last week, by channel",sub:"Farmers registered, by acquisition channel",chart:{type:"waterfall",steps,lblH:36}},
        {w:1,title:"Largest moves by campaign, non-Duta",sub:"Change in farmers; hover for week before → last week",chart:{type:"diverge",items:cItems}}]}],
      notes:[
        top&&`<b>${top.k} fell from ${nf.format(top.p)} to ${nf.format(top.l)}</b>${topC&&topC.d<0?`; inside it the largest single drop is “${topC.k}” (${nf.format(topC.p)} → ${nf.format(topC.l)}).`:"."}`,
        ups.length&&`<b>Paid acquisition held up:</b> ${ups.map(x=>`${x.k} ${nf.format(x.p)} → ${nf.format(x.l)}`).join(", ")}${Q.camps.filter(x=>x.d>0).length?`; the largest campaign gain is “${Q.camps[Q.camps.length-1].k}” (${sg(Q.camps[Q.camps.length-1].d)}).`:"."}`].filter(Boolean)}); }
  // 3. Weekly trend and the days of the week
  const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  S.push({kicker:pre+`Acquisition · ${W.length}-week trend`,
    title:P?`Last week is ${Q.avg?`${spc(L.total,Q.avg)} on the ${Q.avgN}-week average (${nf.format(Math.round(Q.avg))})`:""}; the peak was ${nf.format(Q.peak.total)} in the week of ${Q.peak.short}`:`${W.length} weeks of registrations`,
    rows:[{cards:[
      {w:1.3,title:"Farmers registered per week, by channel",sub:`Registration weeks start on Monday${Q.dropped?`; the week of ${fds(new Date(Q.dropped.w))} is left out`:""}`,chart:{type:"column",stacked:true,cats:W.map(x=>x.short),
        series:Q.srcs.map((k,i)=>({name:k,color:srcC(k,i),values:W.map(x=>x.src.get(k)||0)})),lblH:24}},
      P&&{w:1,title:"Farmers per day, last week vs the week before",sub:"By join date",chart:{type:"line",cats:DAYS,show:"all",max:Math.ceil(Math.max(...P.days,...L.days)*1.15/10)*10,axisFmt:v=>nf.format(Math.round(v)),
        series:[{name:`Week before (${P.short})`,color:"#9AA592",values:P.days,show:[P.days.indexOf(Math.max(...P.days))]},{name:`Last week (${L.short})`,color:CAT[0],values:L.days}]}}].filter(Boolean)}],
    notes:[P&&`<b>The week before had a mid-week spike:</b> ${Math.max(...P.days)} farmers on ${DAYS[P.days.indexOf(Math.max(...P.days))]}, against a high of ${Math.max(...L.days)} on any day last week. Last week's days were flatter (${Math.min(...L.days)}–${Math.max(...L.days)} a day).`,
      `<b>Days:</b> the file's weeks run from Monday morning to the next Monday morning; registrations before the cut on the next Monday are counted as Monday, so each day is a full 24 hours.`].filter(Boolean)});
  // 4. Channel and campaign detail
  const base=Q.weeks.slice(Math.max(0,W.length-5),-1), av=k=>base.length?base.reduce((s,x)=>s+(x.src.get(k)||0),0)/base.length:0;
  const rowsC=Q.srcs.map(k=>{ const p=P?P.src.get(k)||0:0, l=L.src.get(k)||0;
    return [{v:k==="Duta"?"Duta (under Duta)":k,bold:true},P?nf.format(p):"–",{v:nf.format(l),bold:true},P?sg(l-p):"–",P?spc(l,p):"–",nf.format(Math.round(av(k)))]; });
  rowsC.push([{v:"Total",bold:true},P?{v:nf.format(P.total),bold:true}:"–",{v:nf.format(L.total),bold:true},P?{v:sg(d),bold:true}:"–",P?{v:spc(L.total,P.total),bold:true}:"–",{v:nf.format(Math.round(Q.avg||0)),bold:true}]);
  const cTop=[...Q.camps].sort((a,b)=>b.l-a.l||a.d-b.d).slice(0,8), cRest=Q.camps.filter(x=>!cTop.includes(x));
  const rowsK=cTop.map(x=>[x.k,P?nf.format(x.p):"–",{v:nf.format(x.l),bold:true},P?sg(x.d):"–"]);
  if(cRest.length) rowsK.push([`Other ${cRest.length} campaigns`,P?nf.format(cRest.reduce((s,x)=>s+x.p,0)):"–",nf.format(cRest.reduce((s,x)=>s+x.l,0)),P?sg(cRest.reduce((s,x)=>s+x.d,0)):"–"]);
  const bS=P?P.short:"–", lS=L.short, ph=L.noPhone, pp=P?P.noPhone:null;
  S.push({kicker:pre+"Acquisition · channels in detail",title:`${Q.dSrc.filter(x=>x.d<0).length} of ${Q.dSrc.length} channels fell last week; ${pct(ph,L.total)}% of new farmers have no phone number`,
    rows:[{cards:[
      {w:1.1,title:"Farmers by channel",sub:"Acquisition channel",foot:`${base.length}-week avg = the ${base.length} weeks before last week (${base.map(x=>x.short).join(", ")}).`,
        table:{colW:[30,14,14,13,13,14],head:["Channel",`Week of ${bS}`,`Week of ${lS}`,"Change","Change %",`${base.length}-week avg`],align:["l","r","r","r","r","r"],rows:rowsC}},
      {w:1,title:"Non-Duta farmers by campaign",sub:"Largest last week first",table:{colW:[46,18,18,18],head:["Campaign",`Week of ${bS}`,`Week of ${lS}`,"Change"],align:["l","r","r","r"],rows:rowsK}}]}],
    notes:[`<b>Phone numbers:</b> ${nf.format(ph)} of ${nf.format(L.total)} farmers last week (${pct(ph,L.total)}%)${pp!=null?` and ${nf.format(pp)} of ${nf.format(P.total)} the week before`:""} registered without a phone number, so sales and Dutas cannot follow them up.`]});
  return S;
}
function acqNarrative(T){
  const Q=T[0].A.acq, L=Q.L, P=Q.P, d=P?L.total-P.total:0, top=Q.dSrc.filter(x=>x.d<0).sort((a,b)=>a.d-b.d)[0], ups=Q.dSrc.filter(x=>x.d>0).sort((a,b)=>b.d-a.d), extAll=Q.weeks.reduce((s,x)=>s+x.real,0);
  const D=Q.dutas, act=D.filter(x=>x.l), intD=D.filter(x=>x.internal), extD=D.filter(x=>!x.internal), lead=[...D].sort((a,b)=>b.tot-a.tot)[0];
  const topC=Q.camps[0], gainC=Q.camps[Q.camps.length-1], X={multi:false,acq:true,gaps:[],dates:Q.dates};
  X.eyebrow="Farmer Acquisition"; X.title=`Duta vs Non-Duta, ${L.label}`; X.period=`Week of ${L.label} ${new Date(L.w).getFullYear()}`; X.meta=P?`vs ${P.label}`:`${nf.format(L.total)} farmers`;
  X.headline=P?`${nf.format(L.total)} farmers joined last week, ${sg(d)} (${spc(L.total,P.total)}): ${nf.format(L.under)} through Dutas (${sg(L.under-P.under)}) and ${nf.format(L.non)} without (${sg(L.non-P.non)})`:`${nf.format(L.total)} farmers joined in the week of ${L.label}`;
  X.kpis=[{v:nf.format(L.total),u:"",l:`farmers registered ${L.label}${P?`, ${sg(d)} (${spc(L.total,P.total)}) on ${P.label}`:""}`,hot:true},
    {v:nf.format(L.non),u:"",l:`non-Duta${P?`: ${sg(L.non-P.non)} (${spc(L.non,P.non)}) on the week before`:""}`},
    {v:nf.format(L.under),u:"",l:`under a Duta${P?`: ${sg(L.under-P.under)} (${spc(L.under,P.under)}) on the week before`:""}`},
    {v:String(act.length),u:`/${D.length}`,l:`Dutas registered a farmer last week (${act.map(x=>x.k).join(", ")||"none"})`}];
  X.findings=[
    top&&[`${top.k} drove the drop`,`${top.k} fell from ${nf.format(top.p)} to ${nf.format(top.l)} (${sg(top.d)}), ${pct(-top.d,Math.max(1,-d))}% of the ${nf.format(Math.abs(d))} fewer farmers.${topC&&topC.d<0?` The “${topC.k}” campaign alone went ${nf.format(topC.p)} → ${nf.format(topC.l)}.`:""}`],
    P&&[`Dutas halved, from a small base`,`${nf.format(P.under)} → ${nf.format(L.under)} farmers (${(L.under/L.total*100).toFixed(1)}% of all). ${act.length} of ${D.length} Dutas registered a farmer last week; ${lead?`${lead.k} leads with ${lead.tot} in ${Q.weeks.length} weeks`:""}. ${intD.length} of the ${D.length} are internal team, external Dutas brought ${extAll}.`],
    ups.length&&[`Paid channels held up`,`${ups.map(x=>`${x.k} ${nf.format(x.p)} → ${nf.format(x.l)}`).join(", ")}; “${gainC.k}” added ${sg(gainC.d)} farmers.`],
    P&&[`The week before was a peak`,`${nf.format(P.total)} farmers with ${Math.max(...P.days)} on one day; last week is ${Q.avg?`${spc(L.total,Q.avg)} on the ${Q.avgN}-week average of ${nf.format(Math.round(Q.avg))}`:""}, still ${spc(L.total,Q.weeks[0].total)} on the week of ${Q.weeks[0].short}.`]].filter(Boolean).slice(0,4);
  X.bottom={p:`Non-Duta channels bring ${pct(L.non,L.total)}% of farmers. Win back ${top?top.k.toLowerCase():"organic"} registrations, and get every Duta registering farmers each week.`,
    s:`Farmers counted by the week they registered.${Q.dropped?` The week of ${fds(new Date(Q.dropped.w))} is in progress and left out.`:""} Duta covers internal-team and external Dutas alike.`};
  const idle=D.filter(x=>!x.l);
  X.actions=[
    top&&{t:`Find out why ${top.k} fell ${sg(top.d)}`,d:`${top.k} went ${nf.format(top.p)} → ${nf.format(top.l)}${topC&&topC.d<0?`, mostly “${topC.k}” (${nf.format(topC.p)} → ${nf.format(topC.l)})`:""}. Check what drove the ${P?P.short:""} peak (a broadcast, a post, an app release) and repeat it.`,o:"",w:""},
    {t:"Set a weekly farmer target per Duta",d:`Dutas brought ${nf.format(L.under)} farmers last week${P?` (${nf.format(P.under)} the week before)`:""}. ${idle.length?`${idle.map(x=>x.k).join(", ")} registered none last week.`:""} Agree a weekly number per Duta and track it in this deck.`,o:"",w:""},
    {t:"Grow the external Duta network",d:`${intD.length} of the ${D.length} Dutas with farmers are internal team; external Dutas brought ${extAll} farmer${extAll===1?"":"s"} in ${Q.weeks.length} weeks${extD.length?` (${extD.map(x=>x.k).join(", ")})`:""}. Recruit and activate external Dutas in the main areas.`,o:"",w:""},
    gainC&&gainC.d>0&&{t:`Keep funding “${gainC.k}”`,d:`It added ${sg(gainC.d)} farmers (${nf.format(gainC.p)} → ${nf.format(gainC.l)}). Compare its cost per farmer with the other campaigns before shifting budget.`,o:"",w:""},
    {t:"Make the phone number required at registration",d:`${pct(L.noPhone,L.total)}% of last week's farmers (${nf.format(L.noPhone)}) have no phone number, so they cannot be followed up by sales or a Duta.`,o:"",w:""}].filter(Boolean);
  return X;
}
// Stock forecast: what the history says, the plan by month and area, and the plan by SKU.
function forecastSpecs(F,pre){
  const S=[], H=F.hist, M=F.months, tgt=F.target, avgMt=M.reduce((s,m)=>s+m.mt,0)/M.length, kgBest=F.bestKg;
  const mult=F.best?tgt/F.best.gmv:null, gB=v=>v>=1e9?`${(v/1e9).toFixed(1)}B`:`${Math.round(v/1e6)}M`;
  const histLab=h=>h.partial?`${h.label}\n(to ${fds(F.lastDate)})`:h.label;
  // 1. What the target asks for
  S.push({kicker:pre+`Forecast · ${rp(tgt)} a month`,
    title:`${rp(tgt)} a month needs about ${mt0(avgMt)} t of fertilizer, ${kgBest?`${(avgMt*1000/kgBest.kg).toFixed(1)}× our best month (${mt0(kgBest.kg/1000)} t in ${kgBest.label})`:""}`,
    rows:[{h:84,cards:[{kpiRow:[
      {v:rpParts(tgt)[0],u:rpParts(tgt)[1],l:`monthly sales target used for the plan`,hot:true},
      {v:rpParts(F.best.gmv)[0],u:rpParts(F.best.gmv)[1],l:`best month so far (${F.best.label}${F.bestRecent&&F.bestRecent!==F.best?`; best of the last ${F.avgN} months ${rp(F.bestRecent.gmv)} in ${F.bestRecent.label}`:""})`},
      {v:rpParts(F.avg)[0],u:rpParts(F.avg)[1],l:`average month, last ${F.avgN} full months; target is ${(tgt/F.avg).toFixed(1)}×`},
      {v:mt0(F.ordersNeeded),u:"",l:`fertilizer orders a month at the ${F.recentLabel} average order of ${rp(F.aov)} (${F.recentFullLabel}: ${Math.round(F.ordersPerMonth)} a month)`}]}]},
      {cards:[
        {w:1,title:"GMV by month vs the target",sub:`All products; ${histLab(H[H.length-1]).replace("\n"," ")} is partial`,chart:{type:"column",cats:[...H.map(histLab),"Target"],
          series:[{name:"GMV",values:[...H.map(h=>h.gmv),tgt],colors:[...H.map(h=>h.partial?"#B3BBAB":CAT[0]),CAT[1]]}],fmt:gB,lblH:30}},
        {w:1,title:"Fertilizer tonnes: history and the plan",sub:"Tonnes sold per month; plan months in yellow",chart:{type:"column",cats:[...H.map(histLab),...M.map(m=>m.label.replace(" ","\n"))],
          series:[{name:"Tonnes",values:[...H.map(h=>h.kg/1000),...M.map(m=>m.mt)],colors:[...H.map(h=>h.partial?"#B3BBAB":CAT[0]),...M.map(()=>CAT[1])]}],fmt:v=>mt0(v),lblH:30}}]}],
    notes:[
      `<b>Method:</b> the ${rp(tgt)} target is split by each area's share of fertilizer GMV (${F.areas.map(a=>`${a} ${pct(F.share[a],1)}%`).join(", ")}); ${pct(F.fertShare,1)}% of GMV is fertilizer and ${(F.shipShare*100).toFixed(1)}% is shipping. The rest is turned into kg at the prices in “${esc(F.priceLabel.replace(/\.csv$/i,""))}”, with each area's product and price-tier mix from ${M.some(m=>!m.seasonal)?`the last 4 months (${F.recentLabel})`:""}${M.some(m=>m.seasonal)?`${M.some(m=>!m.seasonal)?"; January uses ":""}the same month last season (${M.filter(m=>m.seasonal).map(m=>m.winLabel).join(", ")})`:""}.`,
      F.priceMoves.length&&`<b>Prices today vs what we sold at (${F.recentLabel}):</b> ${esc(F.priceMoves.slice(0,4).map(x=>`${skuShort(x.name)} ${rp(x.was)} → ${rp(x.now)} a bag (${x.now>=x.was?"+":"−"}${Math.abs(Math.round((x.now/x.was-1)*100))}%)`).join("; "))}.`,
      (F.inf.n||F.unpriced.length)&&`<b>Data:</b> ${F.inf.n?`${F.inf.n} lines (${rp(F.inf.gmv)}) had no province and took the customer's province from other orders${F.inf.byPic?` (${F.inf.byPic} from the PIC's main area)`:""}. `:""}${F.unpriced.length?`${F.unpriced.length} SKUs are not on the price list and use their last selling price (${esc(F.unpriced.slice(0,3).map(skuShort).join(", "))}${F.unpriced.length>3?"…":""}).`:""}`
    ].filter(Boolean)});
  // 2. Where the stock goes: tonnes by area per month, and the largest SKUs over the 3 months
  const ARC=[CAT[0],CAT[1],CAT[2]], skT=new Map(); M.forEach(m=>m.rows.forEach(r=>r.skus.forEach(x=>skT.set(x.name,(skT.get(x.name)||0)+x.mt))));
  const topSk=[...skT].sort((a,b)=>b[1]-a[1]).slice(0,8), totMt=M.reduce((s,m)=>s+m.mt,0), r0=M[0].rows[0], rJ=M[M.length-1].rows[0];
  S.push({kicker:pre+"Forecast · where the stock goes",title:`${F.areas[0]} needs ${pct(M[0].rows[0].mt,M[0].mt)}% of the stock; ${skuShort(topSk[0][0])} and ${skuShort(topSk[1][0])} are ${pct(topSk[0][1]+topSk[1][1],totMt)}% of the tonnes`,
    rows:[{cards:[
      {w:1,title:"Stock required by area (MT)",sub:"Tonnes per month to reach the target",chart:{type:"column",stacked:true,cats:M.map(m=>m.label),
        series:F.areas.map((a,i)=>({name:a,color:ARC[i],values:M.map(m=>m.rows.find(r=>r.area===a)?.mt||0)})),fmt:v=>mt0(v),lblH:28}},
      {w:1.1,title:"Largest SKUs, Nov–Jan (MT)",sub:"Tonnes over the 3 months; bags in grey",chart:{type:"hbar",items:topSk.map(([n,v])=>({k:skuShort(n),v,r:`${nf.format(Math.round(v*1000/(packKg(n)||50)))} bags`})),fmt:v=>mt1(v)}}]}],
    notes:[
      `<b>${M[0].label.split(" ")[0]} and ${M[1].label.split(" ")[0]} lean on rock phosphate and KCL</b> (the ${F.recentLabel} mix), so they need more tonnes at a lower ${rp(r0.vpk)}/kg in ${F.areas[0]}.`,
      `<b>${M[M.length-1].label.split(" ")[0]} follows last season</b> (${M[M.length-1].winLabel}): more KCL and NPK at ${rp(rJ.vpk)}/kg, so the same rupiah needs fewer tonnes (${mt0(M[M.length-1].mt)} MT).`,
      `<b>Sumatera Selatan is small and thin:</b> ${M[0].rows.find(r=>r.area==="Sumatera Selatan")?`${mt1(M[0].rows.find(r=>r.area==="Sumatera Selatan").mt)} MT a month from ${M[0].rows.find(r=>r.area==="Sumatera Selatan").orders} orders of history`:"no history"}, so its mix can swing with one or two customers.`].filter(Boolean)});
  // 3. Stock plan by month and area (the table management asked for)
  const rows=[]; M.forEach(m=>m.rows.forEach((r,i)=>{ const top=r.skus.slice(0,3).map(x=>`${skuShort(x.name)} ${mt1(x.mt)}`).join(" · "), rest=r.skus.length-3;
    rows.push([i?"":{v:m.label,bold:true},`${r.area}${r.note?"*":""}`,{v:`${mt1(r.mt)} MT: ${top}`},
      `${rp(r.target)}\n(fertilizer ${rp(r.fertGmv)})`,
      `${r.thin?`Full-history mix (too few orders in ${m.winLabel.split(" ")[0]})`:`${m.winLabel.split(" ")[0]} mix, ${r.orders} orders`} · ${rp(r.vpk)}/kg${r.best&&r.best.mt?` · ${(r.mt/r.best.mt).toFixed(1)}× best month (${mt0(r.best.mt)} t, ${r.best.label.split(" ")[0]})`:""}`]); }));
  const notes=M[0].rows.filter(r=>r.note).map(r=>`*${r.area} ${r.note}.`);
  S.push({kicker:pre+"Forecast · stock plan by month and area",title:`Stock needed for ${rp(tgt)} a month: ${M.map(m=>`${mt0(m.mt)} MT in ${m.label.split(" ")[0]}`).join(", ")}`,
    rows:[{cards:[{foot:`${notes.join(" ")} Stock required = tonnes to sell at 14 Oct prices, rounded to whole bags; top 3 SKUs shown (all SKUs on the next slide).`,table:{colW:[7,12,40,12,29],head:["Month","Area (province)","Stock required (MT)","Target sales (IDR)","Description"],align:["l","l","l","l","l"],rows}}]}]});
  // 3. Stock plan by SKU
  const sk=new Map(); M.forEach((m,mi)=>m.rows.forEach(r=>r.skus.forEach(x=>{ const o=sk.get(x.k)||{name:x.name,pack:x.pack,mt:M.map(()=>0),val:0,kg:0,areas:new Map()}; o.mt[mi]+=x.mt; o.val+=x.ppk*x.mt*1000; o.kg+=x.mt*1000; o.areas.set(r.area,(o.areas.get(r.area)||0)+x.mt); sk.set(x.k,o); })));
  const all=[...sk.values()].map(o=>({...o,tot:o.mt.reduce((a,b)=>a+b,0)})).sort((a,b)=>b.tot-a.tot), top=all.slice(0,13), oth=all.slice(13);
  const line=(name,mt,tot,bags,ppb,ar)=>[name,...mt.map(v=>v?mt1(v):"–"),{v:mt1(tot),bold:true},bags,ppb,ar];
  const srows=top.map(o=>line(skuShort(o.name),o.mt,o.tot,nf.format(Math.round(o.tot*1000/o.pack)),rp(o.val/o.kg*o.pack),[...o.areas].sort((a,b)=>b[1]-a[1]).map(([a,v])=>`${a.replace("Sumatera ","Sum")} ${pct(v,o.tot)}%`).slice(0,2).join(", ")));
  if(oth.length) srows.push(line(`Other ${oth.length} SKUs`,M.map((_,i)=>oth.reduce((s,o)=>s+o.mt[i],0)),oth.reduce((s,o)=>s+o.tot,0),"–","–","–"));
  srows.push(line({v:"Total",bold:true},M.map(m=>m.mt),M.reduce((s,m)=>s+m.mt,0),"–","–","–").map((c,i)=>i===0?c:typeof c==="object"?c:{v:c,bold:true}));
  S.push({kicker:pre+"Forecast · stock plan by SKU",title:`${all.slice(0,3).map(o=>skuShort(o.name)).join(", ")} are ${pct(all.slice(0,3).reduce((s,o)=>s+o.tot,0),all.reduce((s,o)=>s+o.tot,0))}% of the tonnes to stock`,
    rows:[{cards:[{table:{colW:[30,9,9,9,10,9,12,18],head:["SKU",...M.map(m=>`${m.label} (MT)`),"3 months (MT)","Bags","Avg price / bag","Main areas"],align:["l","r","r","r","r","r","r","l"],rows:srows}}]}]});
  return S;
}
function teamSpecs(A,N,pre){
  if(A.acq) return acqSpecs(A.acq,pre);
  if(A.dop) return doSpecs(A.dop,pre);
  const S=[], O=A.orders, pl=(n,w)=>`${n} ${w}${n===1?"":"s"}`, rpM=v=>rp(v);
  if(A.forecast) return forecastSpecs(A.forecast,pre);  // a price list makes this a forecast deck: forecast slides only
  const NI={name:"Not interested",color:OUTC.lost}, WM={name:"Considering / prospect",color:OUTC.warm}, NS={name:"No status",color:OUTC.none};

  // Success story
  if(A.won.length){
    const dims=[...(A.wonLead.length<A.won.length?["wonKind"]:[]),...["channel","source","leadType","userType","purpose","kabupaten","pic"].filter(k=>A.won.some(r=>r[k]))].slice(0,3);
    const how={w:.85,title:`How the ${A.won.length} wins happened`,sub:"Each bar splits the CRM wins; count inside",
      chart:{type:"stack100",rows:dims.map(k=>({label:LABEL[k],segs:countBy(A.won,r=>r[k]??"(not filled)").map(([g,n],i)=>({k:g,n,color:g==="(not filled)"?OUTC.none:CAT[i]||"#B3BBAB"}))}))}};
    let right;
    if(A.has.sales){
      const kp=[{v:`${A.wonLinked.length}`,u:`/${A.won.length}`,l:"Wins confirmed in sales data",hot:true},{v:rpParts(A.linkedGmv)[0],u:rpParts(A.linkedGmv)[1],l:`GMV of ${pl(A.linkedOrders.length,"matched order")}`},
        A.hasCustStatus?{v:String(A.wonNew),u:`/${A.linkedOrders.length}`,l:"Matched orders from new customers"}:{v:String(A.wonFromNotes.length||A.won.length),u:`/${A.won.length}`,l:A.wonFromNotes.length?"Wins found only in the notes (“Closing …”)":A.crmSources.some(x=>x.succ)?"closings logged in the CRM this week":"Wins with a CRM status of ordered"}];
      const by=andList(A.matchCounts.filter(m=>A.won.some(r=>r.matchBy===m[0])).map(([k])=>`${k} (${A.won.filter(r=>r.matchBy===k).length})`));
      right={w:1.45,split:[{h:104,kpiRow:kp},{title:"Orders behind the wins",sub:A.linkedOrders.length>5?`Top 5 of ${A.linkedOrders.length} by GMV`:"Matched from the sales export",
        table:{colW:[10,13,34,8,...(A.hasCustStatus?[9]:[])],head:["Order","PIC","Products","GMV",...(A.hasCustStatus?["Customer"]:[])],align:["l","l","l","r","l"],rows:A.linkedOrders.slice(0,5).map(o=>[o.no,o.pic||"–",o.items.slice(0,2).join(", ")+(o.items.length>2?` +${o.items.length-2}`:""),rp(o.gmv),...(A.hasCustStatus?[o.isNew?{v:"New",pill:true}:"Repeat"]:[])])},
        foot:`Matched by ${by||"–"}.${A.wonFromNotes.length?` ${A.wonFromNotes.length} counted as wins from “Closing” in the notes.`:""}${N.outNote?` ${N.outNote}`:""}${N.kindNote?` Of the ${A.won.length} wins, ${N.kindNote}`:""}`}]};
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
    if(N.tplDominant){ const pics=countBy(A.reasonRows,r=>r.pic); cards.push({w:.9,title:"Who logged these",sub:"Engagements that did not order, by PIC; lead source in grey",
      chart:{type:"hbar",items:pics.slice(0,6).map(([p,n])=>({k:p,v:n,r:countBy(A.reasonRows.filter(r=>r.pic===p),r=>r.source)[0]?.[0]||"–"})),color:"#8E9C84"}}); }
    S.push({kicker:pre+N.rk,title:N.rrTitle,rows:[{cards}],notes:N.rrNotes});
  }

  // Customers chasing their orders (logged as leads)
  if(A.service.length>=3){
    const SV=A.service, iss=countBy(SV,r=>r.issue), sp=countBy(SV,r=>r.pic)[0], first=SV.filter(r=>r.first).length, open=new Set(A.orders.filter(o=>o.lines.some(l=>l.soStatus&&!/complete/i.test(l.soStatus))).map(o=>o.no.toUpperCase()));
    S.push({kicker:pre+"Customer service · orders customers are chasing",title:N.svTitle,rows:[{h:84,cards:[{kpiRow:[
        {v:String(SV.length),u:"",l:"engagements were customers asking about an order",hot:true},{v:String(A.svcRefs.length),u:"",l:"orders named in those conversations"},
        {v:String(A.svcSla),u:`/${SV.length}`,l:"mention the delivery SLA or a queue"},{v:String(first),u:"",l:first===1?"is a customer's first purchase":"are customers' first purchases"}]}]},
      {cards:[{w:.85,title:"What they asked about",sub:"Read from the discussion notes",chart:{type:"hbar",items:iss.map(([k,n])=>({k,v:n})),color:CAT[3]}},
        {w:1.5,title:"Orders named",sub:"Customer names and phone numbers are left out",table:{colW:[18,16,14,22,8],head:["Order(s)","PIC","Channel","Issue","Date"],
          rows:SV.slice().sort((a,b)=>(a.date||0)-(b.date||0)).slice(0,6).map(r=>[r.svcRefs.join(", ")||"–",r.pic||"–",r.channel||"–",r.first?{v:`${r.issue} · first order`,pill:true}:r.issue,r.date?fds(r.date):"–"])}}]}],notes:N.svNotes});
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
  if(T[0].A.dop){ const Q=T[0].A.dop; return `DO leads from the CRM · status to ${fds(Q.today)} ${Q.today.getFullYear()}`; }
  if(T[0].A.acq){ const Q=T[0].A.acq; return `Farmers by registration week${Q.P?` · last week vs the week before`:""} · data to ${fds(Q.lastDate)} ${Q.lastDate.getFullYear()}`; }
  const tr=T.find(t=>t.A.trend)?.A.trend, sales=T.some(t=>t.A.has.sales), fc=T.find(t=>t.A.forecast)?.A.forecast, last=fc?fc.lastDate:X.dates[X.dates.length-1];
  const asOf=last?`data to ${fds(last)} ${last.getFullYear()}`:"";
  return [sales&&"GMV incl. shipping, before discount",fc?`target ${rp(fc.target)} a month at ${fc.priceLabel.replace(/^price (per )?/i,"prices of ").replace(/\.csv$/i,"")}`:tr?`${tr.Z.label} vs ${tr.F.label}`:T.some(t=>t.A.wow)?"last week vs the week before":null,asOf].filter(Boolean).join(" · ")||"SAWITPRO PROPRIETARY";
}
function deckNarrative(T){
  if(T[0].A.dop){ const X=doNarrative(T); X.actions=draftActs(X.actions); X.basis=basisOf(T,X); FOOT_BASIS=X.basis; return X; }
  if(T[0].A.acq){ const X=acqNarrative(T); X.actions=draftActs(X.actions); X.basis=basisOf(T,X); FOOT_BASIS=X.basis; return X; }
  const X=deckNarrative0(T), fa=[];
  T.filter(t=>t.A.forecast).forEach(t=>{ const F=t.A.forecast, m0=F.months[0], top=new Map();
    m0.rows.forEach(r=>r.skus.forEach(x=>top.set(x.name,(top.get(x.name)||0)+x.mt)));
    const tops=[...top].sort((a,b)=>b[1]-a[1]).slice(0,3).map(([n,v])=>`${skuShort(n)} ${mt0(v)} MT`).join(", ");
    fa.push({t:`Secure ${mt0(m0.mt)} MT for ${m0.label}`,d:`${tops} are the largest lines. Check stock on hand and supplier lead time against the plan by area (${m0.rows.map(r=>`${r.area} ${mt0(r.mt)} MT`).join(", ")}).`,o:"",w:"",team:X.multi?t.name:null});
    fa.push({t:`Plan ${mt0(F.ordersNeeded)} fertilizer orders a month`,d:`${rp(F.target)} a month at the ${F.recentLabel} average order of ${rp(F.aov)} needs ${mt0(F.ordersNeeded)} orders; the team closed ${Math.round(F.ordersPerMonth)} a month in ${F.recentFullLabel}. Split the gap by PIC and area.`,o:"",w:"",team:X.multi?t.name:null}); });
  T.filter(t=>t.A.forecast).forEach(t=>{ const F=t.A.forecast, mJ=F.months[F.months.length-1], m0=F.months[0];
    const kcl=[...new Map(mJ.rows.flatMap(r=>r.skus).map(x=>[x.name,0])).keys()].map(n=>[n,mJ.rows.reduce((s,r)=>s+(r.skus.find(x=>x.name===n)?.mt||0),0)]).sort((a,b)=>b[1]-a[1])[0];
    if(kcl) fa.push({t:`Book ${mt0(kcl[1])} MT of ${skuShort(kcl[0])} for ${mJ.label.split(" ")[0]}`,d:`${mJ.label.split(" ")[0]} shifts to last season's mix (${mJ.winLabel}); ${skuShort(kcl[0])} is the largest line at ${mt0(kcl[1])} MT, against ${mt0(m0.rows.reduce((s,r)=>s+(r.skus.find(x=>x.name===kcl[0])?.mt||0),0))} MT in ${m0.label.split(" ")[0]}. Confirm supplier allocation before December.`,o:"",w:"",team:X.multi?t.name:null});
    if(F.unpriced.length) fa.push({t:`Add ${F.unpriced.length} SKUs to the price list`,d:`${F.unpriced.slice(0,4).map(skuShort).join(", ")}${F.unpriced.length>4?" and others":""} sell but are not on the 14 Oct price list, so the plan uses their last selling price.`,o:"",w:"",team:X.multi?t.name:null});
    if(F.inf.n) fa.push({t:`Fill the province on ${F.inf.n} order lines`,d:`${rp(F.inf.gmv)} of sales had no province (mostly Jan–Feb); the plan took it from the customer's other orders. Fix it at the source so the area split stays right.`,o:"",w:"",team:X.multi?t.name:null}); });
  if(fa.length) X.actions=fa.slice(0,6);
  // the cover says the deck carries a stock plan
  const fc0=T.find(t=>t.A.forecast)?.A.forecast;
  if(fc0){ const F=fc0, m=F.months, tg=F.target, avgMt=m.reduce((s,x)=>s+x.mt,0)/m.length, name=T.find(t=>t.A.forecast).name;
    const skT=new Map(); m.forEach(x=>x.rows.forEach(r=>r.skus.forEach(k=>skT.set(k.name,(skT.get(k.name)||0)+k.mt)))); const top=[...skT].sort((a,b)=>b[1]-a[1]);
    X.forecast=true; X.gaps=[]; X.eyebrow="Stock Forecast"; X.title=`${name} · ${m[0].label} – ${m[m.length-1].label}`;
    X.period=`Sales history ${fds(F.hist[0]&&new Date(Math.floor(F.hist[0].m/12),F.hist[0].m%12,1))} – ${fds(F.lastDate)} ${F.lastDate.getFullYear()}`; X.meta=`target ${rp(tg)} a month`;
    X.headline=`${rp(tg)} a month needs ${m.map(x=>`${mt0(x.mt)} MT in ${x.label.split(" ")[0]}`).join(", ")}: about ${(avgMt*1000/F.bestKg.kg).toFixed(1)}× our best month`;
    X.kpis=[{v:mt0(m[0].mt),u:" MT",l:`stock for ${m[0].label} (${m.slice(1).map(x=>`${x.label.split(" ")[0]} ${mt0(x.mt)} MT`).join(", ")})`,hot:true},
      {v:rpParts(tg)[0],u:rpParts(tg)[1],l:`target a month: ${(tg/F.best.gmv).toFixed(1)}× the best month (${rp(F.best.gmv)}, ${F.best.label}), ${(tg/F.avg).toFixed(1)}× the ${F.avgN}-month average`},
      {v:mt0(F.ordersNeeded),u:"",l:`fertilizer orders a month needed, vs ${Math.round(F.ordersPerMonth)} a month in ${F.recentFullLabel}`},
      {v:String(pct(F.share[F.areas[0]],1)),u:"%",l:`of the target and stock in ${F.areas[0]}; ${F.areas.slice(1).map(a=>`${a} ${pct(F.share[a],1)}%`).join(", ")}`}];
    X.findings=[
      [`Rp4B is a step up, not a stretch of today`.replace("Rp4B",rp(tg)),`The best month so far was ${rp(F.best.gmv)} (${F.best.label}); the last ${F.avgN} full months averaged ${rp(F.avg)}. The plan needs ${mt0(avgMt)} MT a month against a record of ${mt0(F.bestKg.kg/1000)} t (${F.bestKg.label}).`],
      [`Two SKUs carry the plan`,`${top.slice(0,3).map(([n,v])=>`${skuShort(n)} ${mt0(v)} MT`).join(", ")} over the 3 months (${pct(top.slice(0,3).reduce((s,x)=>s+x[1],0),top.reduce((s,x)=>s+x[1],0))}% of the tonnes). A stock-out of either stops the plan.`],
      [`January is a different mix`,`Last season's Jan–Feb sold more KCL and NPK, so January needs ${mt0(m[m.length-1].mt)} MT for the same ${rp(tg)}, against ${mt0(m[0].mt)} MT in ${m[0].label.split(" ")[0]}.`],
      [`The gap is orders, not price`,`At the ${F.recentLabel} average order of ${rp(F.aov)}, ${rp(tg)} needs ${mt0(F.ordersNeeded)} orders a month; the team closed ${Math.round(F.ordersPerMonth)}. Today's prices are within ${Math.max(...F.priceMoves.map(x=>Math.abs(Math.round((x.now/x.was-1)*100))),0)}% of what the top SKUs sold for.`]];
    X.bottom={p:`Stock ${top.slice(0,2).map(([n])=>skuShort(n)).join(" and ")} first, and plan ${mt0(F.ordersNeeded)} orders a month by PIC and area.`,
      s:`Stock required is the tonnage to sell at 14 Oct prices; stock on hand and supplier lead times are not in the data.`}; }
  X.actions=draftActs(X.actions||[]); X.basis=basisOf(T,X); FOOT_BASIS=X.basis; return X;
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
  X.gaps=T.flatMap(t=>t.N.gaps.slice(0,2).map(g=>`${t.name}: ${g}`)).slice(0,4);
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
    if(t.C&&t.NC&&!t.A.forecast) teamSlides(t.C,t.NC,`${X.multi?`${t.name} · `:""}CRM ${crmSpan(t.C)} · `,S,next);
  });
  S.push(contentSlide(next(),"Next steps",`${X.actions.length} draft actions ${X.dop?"to move the DO pipeline":X.acq?"to grow farmer acquisition":X.forecast?"to deliver the stock plan":X.trend?"to recover sales":"for the coming week"}; owners and dates to be agreed`,`
    <div class="act${X.actions.length>4?" act3":""}">${X.actions.map((a,i)=>`<div class="card"><h3><span>${i+1}</span>${esc(a.t)}</h3><p>${esc(a.d)}</p><div class="meta">${a.team?`<span class="team">${esc(a.team)}</span>`:""}<span>Owner: ${esc(a.o)}</span><span class="when">${esc(a.w)}</span></div></div>`).join("")}</div>
    ${X.gaps.length?`<div class="gaps"><b>Also clean up in the CRM:</b> ${esc(X.gaps.join("; "))}.</div>`:""}`));
  S.push(`<div class="slide closing"><img class="bg" src="${IMG.closing}" alt=""><div class="shade"></div><img class="wm" src="${IMG.wm}" alt="SawitPRO.id"><img class="lg" src="${IMG.logo}" alt="">
    <div class="box"><h2>Thank You</h2><p>#TerusTumbuh</p></div></div>`);
  return S;
}
