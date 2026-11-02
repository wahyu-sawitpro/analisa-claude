// Build the deck's sample dataset from CSV exports, using the deck's own column detection (src/analysis.js).
//   node deck/tools/make_sample.js [--real] [--out file.json] export1.csv export2.csv ...
// Default: names and phone numbers are replaced by stable anonymous tokens (P1a2b3c4d, "Customer 1A2B3"), so the same
// buyer still matches across sales and CRM files; phone numbers inside notes become [phone]. Writes src/sample-data.json.
// --real keeps names and phones (for the private published deck via `SAMPLE=<file> python3 deck/build.py`); never commit it.
const fs=require("fs"), path=require("path"), vm=require("vm"), crypto=require("crypto");
const args=process.argv.slice(2), real=args.includes("--real"), oi=args.indexOf("--out");
const out=oi>=0?args[oi+1]:path.join(__dirname,"../src/sample-data.json");
const files=args.filter((a,i)=>a!=="--real"&&a!=="--out"&&args[i-1]!=="--out");
if(!files.length){ console.error("usage: make_sample.js [--real] [--out file.json] file.csv ..."); process.exit(1); }

const ctx=vm.createContext({console});
vm.runInContext(fs.readFileSync(path.join(__dirname,"../src/analysis.js"),"utf8")+";this.X={detectRole,detectCrm,detectSales,phoneKey,nameKey};",ctx);
const {detectRole,detectCrm,detectSales,phoneKey,nameKey}=ctx.X;

// CSV with quoted fields; the delimiter is guessed from the header line like the deck does (comma, semicolon, tab, pipe).
function parseCsv(t){
  t=t.replace(/^﻿/,""); const line=t.split(/\r?\n/,1)[0];
  const fs_=[",",";","\t","|"].map(d=>[d,line.split(d).length]).sort((a,b)=>b[1]-a[1])[0][0];
  const rows=[]; let row=[], f="", q=false;
  for(let i=0;i<t.length;i++){ const c=t[i];
    if(q){ if(c==='"'){ if(t[i+1]==='"'){ f+='"'; i++; } else q=false; } else f+=c; }
    else if(c==='"') q=true; else if(c===fs_){ row.push(f); f=""; }
    else if(c==="\n"||c==="\r"){ if(c==="\r"&&t[i+1]==="\n") i++; row.push(f); rows.push(row); row=[]; f=""; }
    else f+=c; }
  if(f!==""||row.length){ row.push(f); rows.push(row); }
  return rows.filter(r=>r.some(v=>v.trim()!==""));
}
const sha=s=>crypto.createHash("sha1").update("sp"+s).digest("hex");
const DROP=/^(no\.?\s*hp leads|cleaned leads.*|photo with geotag|customer_id|attachment|month|column \d+|id on contact|cleaned phone number)$/i;

const sources=[];
for(const f of files){
  const [hdr,...body]=parseCsv(fs.readFileSync(f,"utf8")), all=hdr.map(h=>h.trim());
  const role=detectRole(all), crm=role==="crm", map=crm?detectCrm(all):detectSales(all), ph=map.phone, nm=map.name;
  const headers=real?all:all.filter(h=>h&&!DROP.test(h)&&!(crm&&/phone|nama|name/i.test(h)&&h!==ph&&h!==nm));
  const rows=body.map(r=>{ const o={}; all.forEach((h,i)=>{ if(!headers.includes(h)) return; let v=r[i]===undefined||r[i].trim()===""?null:r[i];
      if(!real&&v!=null){
        if(h===ph){ const k=phoneKey(v); v=k?"P"+sha(k).slice(0,8):null; }
        else if(h===nm){ const k=nameKey(v); v=k?"Customer "+sha(k).slice(0,5).toUpperCase():null; }
        else v=v.replace(/(\+?62|0)?8\d{8,12}/g,"[phone]"); }
      o[h]=v; }); return o; });
  sources.push({name:path.basename(f),sheet:null,headers,rows});
  console.log(`${path.basename(f)}: ${role}, ${rows.length} rows, ${headers.length} columns`);
}
fs.writeFileSync(out,JSON.stringify({sources}));
console.log("wrote",out,real?"(REAL names and phones: do not commit)":"(anonymised)");
