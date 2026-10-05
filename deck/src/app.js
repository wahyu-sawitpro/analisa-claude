/* ================= State, render & scaling ================= */
let SLIDES=[]; const state={sources:[],sample:true,dirty:false,A:null,N:null};
const deckEl=document.getElementById("deck"), presentEl=document.getElementById("present"), stage=document.getElementById("stage");
const roleOf=d=>d.role&&d.role!=="auto"?d.role:detectRole(d.headers);
function analyzeNow(){
  const on=state.sources.filter(x=>x.on);
  state.dirty=false; renderSources(); note("");
  if(!on.length){ deckEl.innerHTML=`<div class="card"><div class="empty">All data sources are switched off. Turn one on above, then click Analyze.</div></div>`; SLIDES=[]; state.A=null; return; }
  const T=analyseTeams(on).map(t=>({...t,N:narrative(t.A)})), X=deckNarrative(T);
  state.T=T; state.X=X; state.A=T[0].A; state.N=T[0].N;
  SLIDES=buildDeck(T,X);
  deckEl.innerHTML=SLIDES.map((s,i)=>`<section class="frame" aria-label="Slide ${i+1}">${s}</section>`).join("");
  const files=new Set(on.map(x=>x.name)).size;
  const crmN=T.reduce((s,t)=>s+t.A.crm.length,0), ordN=T.reduce((s,t)=>s+t.A.orders.length,0);
  document.getElementById("srcName").textContent=`${files} file${files>1?"s":""} · ${T.length>1?`${T.map(t=>t.name).join(" + ")} · `:""}${[crmN&&`${nf.format(crmN)} CRM rows`,ordN&&`${nf.format(ordN)} orders`].filter(Boolean).join(" · ")}`;
  const A=T[0].A;
  if(!state.sample){ const miss=[]; if(A.has.crm&&!A.crmMap.status) miss.push("a lead status column (e.g. “Respon Pengguna” or “Status”)"); if(A.has.crm&&!A.crmMap.reason) miss.push("a reason column (“Alasan …”)");
    if(miss.length) note(`Some slides are thin because the CRM data has no ${miss.join(" and no ")}.`); }
  fit(); save();
}
function markDirty(){ state.dirty=true; renderSources(); save(); }
function fit(){ for(const f of deckEl.querySelectorAll(".frame")) f.firstElementChild.style.transform=`scale(${f.clientWidth/1280})`; if(!presentEl.hidden) showP(); }
new ResizeObserver(fit).observe(deckEl);
function note(msg,err,html){ const n=document.getElementById("notice"); if(!msg){n.hidden=true;return} if(html) n.innerHTML=msg; else n.textContent=msg; n.className="notice"+(err?" err":""); n.hidden=false; }

/* ================= File loading ================= */
const ROLE_SHORT={crm:"CRM",sales:"Sales"};
const SAMPLE_SRCS=(SAMPLE?.sources||[]).map(s=>({...s,on:true,role:"auto",team:"auto"}));
function sheetToDs(wb,name,sheet){
  const aoa=XLSX.utils.sheet_to_json(wb.Sheets[sheet],{header:1,raw:true,defval:null,blankrows:false});
  let hi=aoa.findIndex(r=>r.filter(v=>!blank(v)).length>=2); if(hi<0) hi=0;
  const headers=(aoa[hi]||[]).map((h,i)=>blank(h)?`Column ${i+1}`:String(h).replace(/^﻿/,"").trim());
  return {name,sheet,headers,rows:aoa.slice(hi+1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??null]))).filter(r=>Object.values(r).some(v=>!blank(v))),on:true,role:"auto",team:"auto"};
}
// Guess the delimiter of a text file from its header line (Indonesian Excel exports often use semicolons).
const sniffFS=t=>{ const line=t.split(/\r?\n/,1)[0]; const c=[",",";","\t","|"].map(d=>[d,line.split(d).length]).sort((a,b)=>b[1]-a[1]); return c[0][1]>1?c[0][0]:","; };
// One file -> one or more sources. Workbooks keep every sheet that looks like CRM or sales data (else the largest sheet).
async function readFile(file){
  const ext=file.name.split(".").pop().toLowerCase();
  if(ext==="json"){ const j=JSON.parse(await file.text()); const rows=Array.isArray(j)?j:(j.rows||j.data||Object.values(j).find(Array.isArray));
    if(!Array.isArray(rows)||!rows.length) throw new Error("the JSON file must contain an array of rows");
    return [{name:file.name,sheet:null,headers:[...new Set(rows.flatMap(r=>Object.keys(r)))],rows,on:true,role:"auto",team:"auto"}]; }
  if(typeof XLSX==="undefined") throw new Error("the spreadsheet reader didn't load. Check your connection and reload the page");
  let wb;
  if(["csv","tsv","txt"].includes(ext)){ const t=(await file.text()).replace(/^﻿/,""); wb=XLSX.read(t,{type:"string",raw:true,FS:ext==="tsv"?"\t":sniffFS(t)}); }
  else wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true});
  const sheets=wb.SheetNames.map(sh=>sheetToDs(wb,file.name,sh)).filter(d=>d.rows.length);
  if(!sheets.length) throw new Error("no data rows found");
  const useful=sheets.filter(d=>{ const c=detectCrm(d.headers), s=detectSales(d.headers);
    return ["status","reason","pic","id","channel"].filter(k=>c[k]).length>=2||["orderNo","gmv","item","qty"].filter(k=>s[k]).length>=2; });
  const keep=useful.length?useful:[sheets.sort((a,b)=>b.rows.length-a.rows.length)[0]];
  if(wb.SheetNames.length===1) keep.forEach(d=>d.sheet=null);
  return keep;
}
const save=()=>{ try{ state.sample?localStorage.removeItem("sp-deck-data-v5"):localStorage.setItem("sp-deck-data-v5",JSON.stringify({sources:state.sources,dirty:state.dirty})); }catch(e){} };
async function loadFiles(list){
  const files=[...list]; if(!files.length) return;
  note(""); const failed=[], added=[];
  for(const f of files){ try{ added.push(...await readFile(f)); }catch(e){ failed.push(`“${f.name}”: ${e.message}`); } }
  if(added.length){
    if(state.sample){ state.sources=[]; state.sample=false; }
    for(const d of added){ const i=state.sources.findIndex(x=>x.name===d.name&&x.sheet===d.sheet); if(i>=0) state.sources[i]=d; else state.sources.push(d); }
    markDirty();
  }
  if(failed.length) note(`Couldn't read ${failed.join("; ")}.`,true);
}
function renderSources(){
  const box=document.getElementById("sources"), on=state.sources.filter(x=>x.on).length;
  const chips=state.sources.map((d,i)=>{ const auto=detectRole(d.headers);
    return `<span class="src-chip${d.on?"":" off"}">
      <label><input type="checkbox" data-i="${i}" ${d.on?"checked":""} aria-label="Include ${esc(srcLabel(d))}"> ${esc(srcLabel(d))} <em>${nf.format(d.rows.length)}</em></label>
      <select data-role="${i}" aria-label="Data type of ${esc(srcLabel(d))}">${["auto","crm","sales"].map(r=>`<option value="${r}" ${(d.role||"auto")===r?"selected":""}>${r==="auto"?`${ROLE_SHORT[auto]} (auto)`:ROLE_SHORT[r]}</option>`).join("")}</select>
      <select data-team="${i}" aria-label="Team of ${esc(srcLabel(d))}">${["auto","Smallholder","Plantation"].map(t=>`<option value="${t}" ${(d.team||"auto")===t?"selected":""}>${t==="auto"?`${detectTeam({...d,team:"auto"})||"Team"} (auto)`:t}</option>`).join("")}</select>
      ${state.sample?"":`<button type="button" data-rm="${i}" aria-label="Remove ${esc(srcLabel(d))}">×</button>`}</span>`; }).join("");
  box.innerHTML=`<span class="lbl">${state.sample?"Sample data":"Data sources"}</span>${chips}
    <button class="link" type="button" id="addMore">+ Add files</button>${state.sample?"":`<button class="link" type="button" id="clearAll">Use sample data</button>`}
    <span class="spacer"></span>
    ${state.dirty?`<button class="analyze" type="button" id="analyzeBtn" ${on?"":"disabled"}>Analyze ${on} file${on===1?"":"s"} →</button>`:`<span class="uptodate">✓ Deck is up to date</span>`}`;
  document.getElementById("staleNote").hidden=!state.dirty;
  deckEl.classList.toggle("stale",state.dirty);
}
const src=document.getElementById("sources");
src.addEventListener("change",e=>{ const t=e.target;
  if(t.dataset.i!==undefined){ state.sources[+t.dataset.i].on=t.checked; markDirty(); }
  if(t.dataset.role!==undefined){ state.sources[+t.dataset.role].role=t.value; markDirty(); }
  if(t.dataset.team!==undefined){ state.sources[+t.dataset.team].team=t.value; markDirty(); } });
src.addEventListener("click",e=>{ const t=e.target;
  const rm=t.closest("[data-rm]"); if(rm){ state.sources.splice(+rm.dataset.rm,1); if(!state.sources.length){ state.sources=SAMPLE_SRCS.map(s=>({...s})); state.sample=true; analyzeNow(); } else markDirty(); return; }
  if(t.id==="addMore") document.getElementById("fileIn").click();
  if(t.id==="clearAll"){ state.sources=SAMPLE_SRCS.map(s=>({...s})); state.sample=true; analyzeNow(); }
  if(t.id==="analyzeBtn") analyzeNow(); });
document.getElementById("staleGo").onclick=()=>analyzeNow();
document.getElementById("uploadBtn").onclick=()=>document.getElementById("fileIn").click();
document.getElementById("fileIn").onchange=e=>{ loadFiles(e.target.files); e.target.value=""; };
let dragN=0; const hint=document.getElementById("dropHint");
addEventListener("dragenter",e=>{if([...e.dataTransfer.types].includes("Files")){dragN++;hint.hidden=false}});
addEventListener("dragleave",()=>{dragN=Math.max(0,dragN-1); if(!dragN) hint.hidden=true});
addEventListener("dragover",e=>e.preventDefault());
addEventListener("drop",e=>{e.preventDefault(); dragN=0; hint.hidden=true; loadFiles(e.dataTransfer.files);});

/* ================= Present mode ================= */
let cur=0;
function showP(){ if(!SLIDES.length) return; const s=Math.min(innerWidth/1280,(innerHeight-70)/720); stage.style.width=1280*s+"px"; stage.style.height=720*s+"px";
  stage.innerHTML=SLIDES[cur]; stage.firstElementChild.style.transform=`scale(${s})`; document.getElementById("pCount").textContent=`${cur+1} / ${SLIDES.length}`; }
const go=d=>{ cur=Math.max(0,Math.min(SLIDES.length-1,cur+d)); showP(); };
document.getElementById("presentBtn").onclick=()=>{ if(!SLIDES.length) return; const y=[...deckEl.children].findIndex(f=>f.getBoundingClientRect().bottom>90); cur=Math.max(0,y);
  presentEl.hidden=false; showP(); presentEl.requestFullscreen?.().catch(()=>{}); };
function closeP(){ presentEl.hidden=true; if(document.fullscreenElement) document.exitFullscreen?.().catch(()=>{}); }
document.getElementById("pPrev").onclick=()=>go(-1); document.getElementById("pNext").onclick=()=>go(1); document.getElementById("pClose").onclick=closeP;
stage.onclick=e=>go(e.clientX>innerWidth/2?1:-1);
addEventListener("keydown",e=>{ if(presentEl.hidden) return; if(["ArrowRight","PageDown"," "].includes(e.key)){e.preventDefault();go(1)} else if(["ArrowLeft","PageUp"].includes(e.key)){e.preventDefault();go(-1)} else if(e.key==="Escape") closeP(); });
addEventListener("resize",()=>{ if(!presentEl.hidden) showP(); });

/* ================= Tooltip ================= */
const tip=document.getElementById("tip");
addEventListener("pointermove",e=>{ const t=e.target.closest?.("[data-tip]"); if(!t){tip.hidden=true;return}
  tip.textContent=t.dataset.tip; tip.hidden=false; const w=tip.offsetWidth; tip.style.left=Math.min(innerWidth-w-8,e.clientX+14)+"px"; tip.style.top=(e.clientY+16)+"px"; });
