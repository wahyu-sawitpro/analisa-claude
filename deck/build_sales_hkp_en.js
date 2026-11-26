// Deck (English): Verified Program Review (KYC / HKP) - Farmer-Only
const pptxgen = require("pptxgenjs");
const { applyTheme } = require("/root/.claude/skills/synced/f84fc666-f8fd-4229-ba19-0ac62aac0445_f490ad36-027d-4c95-be29-17a3c254bf19/pptx/scripts/apply_theme.js");

const THEME = {
  name: "Sawit Verified",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "1C2B22", lt1: "FFFFFF", dk2: "1F4D2B", lt2: "EEF4EC",
    accent1: "1F4D2B", accent2: "7FB069", accent3: "E0A526", accent4: "C0392B",
    accent5: "5C6B63", accent6: "B9D3A8", hlink: "1F4D2B", folHlink: "5C6B63",
  },
};
const H = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Farmer-Only Verified Program Review";
const C = pres.SchemeColor;

// ---------- Layouts ----------
pres.defineSlideMaster({
  title: "DARK",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 2.3, w: 11.7, h: 1.6, fontSize: 40, bold: true, color: C.background1, valign: "bottom", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 4.1, w: 11.7, h: 1.2, fontSize: 18, color: C.accent6, valign: "top", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "DARK_TOP",
  background: { color: C.text2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.4, w: 12.1, h: 0.9, fontSize: 30, bold: true, color: C.background1, valign: "middle", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.4, w: 12.1, h: 0.9, fontSize: 30, bold: true, color: C.text2, valign: "middle", margin: 0 }, text: "" } },
    { text: { text: "HKP Sales · Farmer-Only products · as of 26 Nov 2026", options: { x: 0.6, y: 7.0, w: 8, h: 0.3, fontSize: 10, color: C.accent5, margin: 0 } } },
  ],
  slideNumber: { x: 12.2, y: 7.0, w: 0.5, h: 0.3, fontSize: 10, color: C.accent5, align: "right" },
});

const tb = (slide, text, o) => slide.addText(text, Object.assign({ isTextBox: true, margin: 0, fontSize: 14, color: C.text1, valign: "top" }, o));
const card = (slide, x, y, w, h, fill, name) =>
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill || C.background2 }, line: { color: fill || C.background2 }, objectName: name });

// ---------- Data ----------
const before = { cust: 15, ord: 17, sales: 232662938, aov: 13686055, conv: 2.73 };
const after = { cust: 25, ord: 28, sales: 605232978, aov: 21615463, conv: 4.55 };
const target = 1000000000;
const pct = (a, b) => ((a / b - 1) * 100);
const jt = (v) => (v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 });

// ---------- 1. Title ----------
pres.addSection({ title: "Opening" });
let s = pres.addSlide({ masterName: "DARK", sectionTitle: "Opening" });
s.addText("Farmer-Only Verified Program: Month 2 Review", { placeholder: "title" });
s.addText("Before vs After Verification (KYC / HKP review)  ·  Target IDR 500M/month  ·  26 November 2026", { placeholder: "body" });
s.addNotes("Goal: assess whether user verification (KYC/HKP) makes Farmer-Only product sales better targeted, and where we stand against the IDR 1B cumulative target in month 2.");

// ---------- 2. Executive summary ----------
pres.addSection({ title: "Summary" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Summary" });
s.addText("Verification works, but sales are only at 60.5% of target", { placeholder: "title" });
const stats = [
  { big: "IDR 605M", lbl: "Sales after verification\nvs IDR 1B cumulative target", tone: C.accent3 },
  { big: "+160%", lbl: "Sales growth\nvs before verification", tone: C.accent1 },
  { big: "4.55%", lbl: "Of verified users bought\n(up from 2.73%)", tone: C.accent1 },
];
stats.forEach((st, i) => {
  const x = 0.6 + i * 4.1;
  card(s, x, 1.6, 3.8, 2.4, C.background2, "stat" + i);
  tb(s, st.big, { x: x + 0.3, y: 1.85, w: 3.2, h: 1.0, fontSize: 44, bold: true, color: st.tone, fontFace: THEME.headFontFace, valign: "middle" });
  tb(s, st.lbl, { x: x + 0.3, y: 2.95, w: 3.2, h: 0.9, fontSize: 14, color: C.accent5 });
});
tb(s, [
  { text: "Quality is better: ", options: { bold: true, color: C.text2 } },
  { text: "after verification, more farmers bought (15 → 25) and order value rose 58% (IDR 13.7M → IDR 21.6M), so we are reaching the right market.", options: { breakLine: true } },
  { text: "Volume is not enough: ", options: { bold: true, color: C.accent4 } },
  { text: "IDR 605M against an IDR 1B target (IDR 395M gap). Average of ~IDR 303M/month vs IDR 500M/month target.", options: { breakLine: true } },
  { text: "Biggest opportunity: ", options: { bold: true, color: C.text2 } },
  { text: "525 of 550 verified users (95%) have never bought a Farmer-Only product." },
], { x: 0.6, y: 4.4, w: 12.1, h: 2.3, fontSize: 16, paraSpaceAfter: 8 });
s.addNotes("Status: AMBER. Right direction (verification lifts every metric), but actual sales are below target.");

// ---------- 3. Before vs after ----------
pres.addSection({ title: "Analysis" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Analysis" });
s.addText("Every metric improved after users were verified", { placeholder: "title" });
const hdr = (t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.text2 }, align: "center" } });
const rows = [
  ["Unique customers", before.cust, after.cust, pct(after.cust, before.cust)],
  ["Total orders", before.ord, after.ord, pct(after.ord, before.ord)],
  ["Total sales (IDR M)", jt(before.sales), jt(after.sales), pct(after.sales, before.sales)],
  ["Avg order value (IDR M)", jt(before.aov), jt(after.aov), pct(after.aov, before.aov)],
  ["% of verified who bought", "2.73%", "4.55%", pct(4.55, 2.73)],
  ["Orders per customer", (17 / 15).toFixed(2), (28 / 25).toFixed(2), pct(28 / 25, 17 / 15)],
];
const tbl = [[hdr("Metric"), hdr("Before"), hdr("After"), hdr("Change")]].concat(rows.map((r) => [
  { text: r[0], options: { bold: true, color: C.text1 } },
  { text: String(r[1]), options: { align: "center", color: C.text1 } },
  { text: String(r[2]), options: { align: "center", color: C.text1, bold: true } },
  { text: (r[3] >= 0 ? "+" : "") + r[3].toFixed(0) + "%", options: { align: "center", bold: true, color: Math.abs(r[3]) < 5 ? C.accent5 : C.accent1 } },
]));
s.addTable(tbl, { x: 0.6, y: 1.6, w: 7.0, colW: [2.8, 1.35, 1.35, 1.5], fontSize: 14, rowH: 0.55, border: { type: "solid", pt: 0.75, color: "D5DED3" }, fill: { color: C.background1 }, valign: "middle" });
s.addChart(pres.charts.BAR, [{ name: "Sales (IDR M)", labels: ["Before", "After"], values: [232.7, 605.2] }], {
  x: 8.0, y: 1.5, w: 4.7, h: 4.3, barDir: "col", showTitle: true, title: "Total sales (IDR million)", titleFontSize: 14, titleColor: H.dk2, titleFontFace: "+mn-lt",
  chartColors: [H.accent5, H.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 13, dataLabelColor: H.dk1, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "#,##0.0",
  catAxisLabelColor: H.accent5, valAxisLabelColor: H.accent5, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", catAxisLabelFontSize: 12, valAxisHidden: true,
  valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, barGapWidthPct: 60,
});
tb(s, "Growth came from two drivers: more farmers buying (+67%) and bigger orders (+58%). Purchase frequency stayed at ~1.1x per customer, so there are no repeat orders yet.", { x: 0.6, y: 5.75, w: 12.1, h: 0.9, fontSize: 15, italic: true, color: C.text2 });

// ---------- 4. Target ----------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Analysis" });
s.addText("Against target: IDR 395M short in month 2", { placeholder: "title" });
s.addChart(pres.charts.BAR, [{ name: "IDR M", labels: ["Cumulative target (2 mo)", "Actual", "Gap"], values: [1000, 605.2, 394.8] }], {
  x: 0.6, y: 1.5, w: 6.6, h: 4.9, barDir: "bar", showTitle: true, title: "IDR million (cumulative Oct–Nov)", titleFontSize: 14, titleColor: H.dk2, titleFontFace: "+mn-lt",
  chartColors: [H.accent6, H.accent1, H.accent4], showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 13, dataLabelColor: H.dk1, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "#,##0",
  catAxisLabelColor: H.dk1, catAxisLabelFontFace: "+mn-lt", catAxisLabelFontSize: 13, valAxisHidden: true, catAxisOrientation: "maxMin",
  valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, barGapWidthPct: 50,
});
const kpis = [
  ["60.5%", "of cumulative target achieved", C.accent3],
  ["~IDR 303M", "average per month (target IDR 500M)", C.accent3],
  ["~18 orders", "more needed to close the gap (AOV IDR 21.6M)", C.accent4],
];
kpis.forEach((k, i) => {
  const y = 1.6 + i * 1.6;
  card(s, 7.6, y, 5.1, 1.35, C.background2, "kpi" + i);
  tb(s, k[0], { x: 7.9, y: y + 0.15, w: 4.6, h: 0.6, fontSize: 28, bold: true, color: k[2], fontFace: THEME.headFontFace });
  tb(s, k[1], { x: 7.9, y: y + 0.78, w: 4.6, h: 0.45, fontSize: 14, color: C.accent5 });
});
s.addNotes("Assumption: the 'After verification' period is about the 2 program months (Oct–Nov). With ~4 days left in November, the IDR 395M gap is unlikely to close; focus on an IDR 500M/month run-rate from December.");

// ---------- 5. What it takes ----------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Analysis" });
s.addText("Hitting IDR 500M/month needs ~2x more monthly buyers", { placeholder: "title" });
tb(s, "Sales = Verified users × % who buy × Orders per customer × Avg order value", { x: 0.6, y: 1.45, w: 12.1, h: 0.5, fontSize: 18, bold: true, color: C.text2, fontFace: THEME.headFontFace });
const levers = [
  ["Verified users", "550", "Grow the base: speed up KYC/HKP", "Base"],
  ["% buying / month", "~2.3% to ~3.8%", "Activate the 525 verified non-buyers", "Priority 1"],
  ["Orders / customer", "1.12x", "Drive repeat orders (next fertilizer cycle)", "Priority 2"],
  ["Avg order value", "IDR 21.6M", "Maintain; bundle packages per hectare", "Maintain"],
];
levers.forEach((l, i) => {
  const x = 0.6 + i * 3.08;
  card(s, x, 2.2, 2.85, 3.5, i === 1 ? C.text2 : C.background2, "lever" + i);
  const dark = i === 1;
  tb(s, l[3].toUpperCase(), { x: x + 0.25, y: 2.4, w: 2.4, h: 0.35, fontSize: 11, bold: true, color: dark ? C.accent3 : C.accent5, charSpacing: 1 });
  tb(s, l[0], { x: x + 0.25, y: 2.8, w: 2.4, h: 0.5, fontSize: 18, bold: true, color: dark ? C.background1 : C.text2 });
  tb(s, l[1], { x: x + 0.25, y: 3.35, w: 2.4, h: 0.8, fontSize: 20, bold: true, color: dark ? C.background1 : C.text1, fontFace: THEME.headFontFace });
  tb(s, l[2], { x: x + 0.25, y: 4.3, w: 2.4, h: 1.2, fontSize: 14, color: dark ? C.accent6 : C.accent5 });
});
tb(s, "Math: IDR 500M ÷ IDR 21.6M ≈ 23 orders/month ≈ 21 buyers/month (3.8% of 550). Today: ~14 orders/month (28 orders in 2 months).", { x: 0.6, y: 5.95, w: 12.1, h: 0.8, fontSize: 14, italic: true, color: C.accent5 });

// ---------- 6. Data caveats ----------
pres.addSection({ title: "Caveats" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Caveats" });
s.addText("Data caveats before using these numbers for decisions", { placeholder: "title" });
const cav = [
  ["Periods are not equal", "'Before' is fixed to Aug–Sep 2026, while 'After' runs from the verified date with no end date. Users verified before August inflate 'After'. Limit it to Oct–Nov to compare like for like with the target."],
  ["HKP status not filtered", "The v.status = 'APPROVED' filter is commented out, so rejected HKP reviews count as verified. The 550 may be overstated."],
  ["data_farm query", "WHERE f.is_active uses an alias 'f' that is never defined. Confirm which query version was actually run (dim_farm AS f)."],
  ["Small sample", "Only 28 orders; one large order (~IDR 20M) moves sales by ~3.5%. Track monthly, not only the total."],
];
cav.forEach((c, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = 0.6 + col * 6.15, y = 1.55 + row * 2.6;
  card(s, x, y, 5.95, 2.35, C.background2, "cav" + i);
  s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: y + 0.3, w: 0.5, h: 0.5, fill: { color: C.accent3 }, line: { color: C.accent3 }, objectName: "num" + i });
  tb(s, String(i + 1), { x: x + 0.3, y: y + 0.3, w: 0.5, h: 0.5, fontSize: 16, bold: true, color: C.background1, align: "center", valign: "middle" });
  tb(s, c[0], { x: x + 1.0, y: y + 0.33, w: 4.7, h: 0.45, fontSize: 18, bold: true, color: C.text2, valign: "middle" });
  tb(s, c[1], { x: x + 0.3, y: y + 0.95, w: 5.4, h: 1.3, fontSize: 14, color: C.text1 });
});

// ---------- 7. Recommendations ----------
pres.addSection({ title: "Recommendations" });
s = pres.addSlide({ masterName: "DARK_TOP", sectionTitle: "Recommendations" });
s.addText("Recommendations and next steps", { placeholder: "title" });
const recs = [
  ["Activate the 525 verified users", "Telesales/WhatsApp campaign to verified non-buyers; prioritize the largest farms."],
  ["Build repeat orders", "Next fertilizing-cycle reminders for the 25 buyers; target 1.5 orders per customer."],
  ["Grow the verified base", "Speed up KYC/HKP and follow up on pending documents."],
  ["Fix the query and tracking", "Filter on APPROVED, limit to Oct–Nov, and add a monthly breakdown to monitor run-rate."],
];
recs.forEach((r, i) => {
  const y = 1.75 + i * 1.25;
  s.addShape(pres.shapes.OVAL, { x: 0.8, y: y + 0.05, w: 0.6, h: 0.6, fill: { color: C.accent3 }, line: { color: C.accent3 }, objectName: "rnum" + i });
  tb(s, String(i + 1), { x: 0.8, y: y + 0.05, w: 0.6, h: 0.6, fontSize: 20, bold: true, color: C.text2, align: "center", valign: "middle" });
  tb(s, r[0], { x: 1.7, y: y, w: 10.8, h: 0.45, fontSize: 20, bold: true, color: C.background1 });
  tb(s, r[1], { x: 1.7, y: y + 0.47, w: 10.8, h: 0.5, fontSize: 15, color: C.accent6 });
});

(async () => {
  const out = "/home/user/analisa-claude/deck/HKP Verified Sales Review.pptx";
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log("ok");
})();
