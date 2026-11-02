// Render a built deck page headless, check it for errors and save its PPTX.
// Usage: PW=$(npm root -g)/playwright LIBS=<dir with node_modules/xlsx and pptxgenjs> node deck/tools/export_pptx.js <index.html> <out.pptx>
// The CDN scripts are served from LIBS (the sandbox blocks the CDNs); install them once with
//   npm install --prefix <LIBS> xlsx@0.18.5 pptxgenjs@3.12.0
const {chromium}=require(process.env.PW); const path=require('path');
const LIBS=process.env.LIBS, [page, out]=process.argv.slice(2);
(async()=>{ const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1600,height:1000}}); const errs=[];
  p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/xlsx.full.min.js',r=>r.fulfill({path:path.join(LIBS,'node_modules/xlsx/dist/xlsx.full.min.js'),contentType:'application/javascript'}));
  await p.route('**/pptxgen.bundle.js',r=>r.fulfill({path:path.join(LIBS,'node_modules/pptxgenjs/dist/pptxgen.bundle.js'),contentType:'application/javascript'}));
  await p.goto('file://'+path.resolve(page)); await p.waitForTimeout(4000);
  const t=await p.$$eval('#deck > *',els=>els.map(e=>e.innerText.replace(/\s+/g,' ').slice(0,140)));
  t.forEach((x,i)=>console.log(i+1,x));
  const dl=p.waitForEvent('download',{timeout:120000}); await p.click('#pptxBtn'); await (await dl).saveAs(out);
  console.log(errs.length?'ERRORS '+JSON.stringify(errs):'no page errors', '· saved', out); await b.close(); process.exit(errs.length?1:0); })();
