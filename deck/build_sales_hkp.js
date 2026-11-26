// Deck: Evaluasi Program Verified (KYC / HKP) - Khusus Petani
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
pres.title = "Evaluasi Program Verified Khusus Petani";
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
    { text: { text: "Sales HKP · Khusus Petani · per 26 Nov 2026", options: { x: 0.6, y: 7.0, w: 8, h: 0.3, fontSize: 10, color: C.accent5, margin: 0 } } },
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
const jt = (v) => (v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 });

// ---------- 1. Title ----------
pres.addSection({ title: "Pembuka" });
let s = pres.addSlide({ masterName: "DARK", sectionTitle: "Pembuka" });
s.addText("Program Verified Khusus Petani: Evaluasi Bulan ke-2", { placeholder: "title" });
s.addText("Sebelum vs Setelah Verified (KYC / review HKP)  ·  Target Rp 500 jt/bulan  ·  26 November 2026", { placeholder: "body" });
s.addNotes("Tujuan: menilai apakah verifikasi user (KYC/HKP) membuat penjualan produk Khusus Petani lebih tepat sasaran, dan posisi terhadap target Rp 1 M kumulatif di bulan ke-2.");

// ---------- 2. Executive summary ----------
pres.addSection({ title: "Ringkasan" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Ringkasan" });
s.addText("Verifikasi terbukti efektif, tapi penjualan baru 60,5% dari target", { placeholder: "title" });
const stats = [
  { big: "Rp 605 jt", lbl: "Sales setelah verified\nvs target kumulatif Rp 1 M", tone: C.accent3 },
  { big: "+160%", lbl: "Kenaikan sales\nvs periode sebelum verified", tone: C.accent1 },
  { big: "4,55%", lbl: "Verified user yang membeli\n(naik dari 2,73%)", tone: C.accent1 },
];
stats.forEach((st, i) => {
  const x = 0.6 + i * 4.1;
  card(s, x, 1.6, 3.8, 2.4, C.background2, "stat" + i);
  tb(s, st.big, { x: x + 0.3, y: 1.85, w: 3.2, h: 1.0, fontSize: 44, bold: true, color: st.tone, fontFace: THEME.headFontFace, valign: "middle" });
  tb(s, st.lbl, { x: x + 0.3, y: 2.95, w: 3.2, h: 0.9, fontSize: 14, color: C.accent5 });
});
tb(s, [
  { text: "Kualitas bagus: ", options: { bold: true, color: C.text2 } },
  { text: "setelah verified, lebih banyak petani yang beli (15 → 25) dan nilai per order naik 58% (Rp 13,7 jt → Rp 21,6 jt), artinya target market lebih tepat.", options: { breakLine: true } },
  { text: "Volume belum cukup: ", options: { bold: true, color: C.accent4 } },
  { text: "Rp 605 jt dari target Rp 1 M (gap Rp 395 jt). Rata-rata ±Rp 303 jt/bulan vs target Rp 500 jt/bulan.", options: { breakLine: true } },
  { text: "Peluang terbesar: ", options: { bold: true, color: C.text2 } },
  { text: "525 dari 550 user verified (95%) belum pernah membeli produk Khusus Petani." },
], { x: 0.6, y: 4.4, w: 12.1, h: 2.3, fontSize: 16, paraSpaceAfter: 8 });
s.addNotes("Status: AMBER. Arah benar (efek verifikasi positif di semua metrik), tapi realisasi di bawah target.");

// ---------- 3. Before vs after ----------
pres.addSection({ title: "Analisa" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Analisa" });
s.addText("Semua metrik naik setelah user terverifikasi", { placeholder: "title" });
const hdr = (t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.text2 }, align: "center" } });
const rows = [
  ["Unique customer", before.cust, after.cust, pct(after.cust, before.cust)],
  ["Total order", before.ord, after.ord, pct(after.ord, before.ord)],
  ["Total sales (Rp jt)", jt(before.sales), jt(after.sales), pct(after.sales, before.sales)],
  ["Avg order value (Rp jt)", jt(before.aov), jt(after.aov), pct(after.aov, before.aov)],
  ["% customer dari verified", "2,73%", "4,55%", pct(4.55, 2.73)],
  ["Order per customer", (17 / 15).toFixed(2).replace(".", ","), (28 / 25).toFixed(2).replace(".", ","), pct(28 / 25, 17 / 15)],
];
const tbl = [[hdr("Metrik"), hdr("Sebelum"), hdr("Setelah"), hdr("Perubahan")]].concat(rows.map((r) => [
  { text: r[0], options: { bold: true, color: C.text1 } },
  { text: String(r[1]), options: { align: "center", color: C.text1 } },
  { text: String(r[2]), options: { align: "center", color: C.text1, bold: true } },
  { text: (r[3] >= 0 ? "+" : "") + r[3].toFixed(0) + "%", options: { align: "center", bold: true, color: Math.abs(r[3]) < 5 ? C.accent5 : C.accent1 } },
]));
s.addTable(tbl, { x: 0.6, y: 1.6, w: 7.0, colW: [2.8, 1.35, 1.35, 1.5], fontSize: 14, rowH: 0.55, border: { type: "solid", pt: 0.75, color: "D5DED3" }, fill: { color: C.background1 }, valign: "middle" });
s.addChart(pres.charts.BAR, [{ name: "Sales (Rp jt)", labels: ["Sebelum", "Setelah"], values: [232.7, 605.2] }], {
  x: 8.0, y: 1.5, w: 4.7, h: 4.3, barDir: "col", showTitle: true, title: "Total sales (Rp juta)", titleFontSize: 14, titleColor: H.dk2, titleFontFace: "+mn-lt",
  chartColors: [H.accent5, H.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 13, dataLabelColor: H.dk1, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "#,##0.0",
  catAxisLabelColor: H.accent5, valAxisLabelColor: H.accent5, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", catAxisLabelFontSize: 12, valAxisHidden: true,
  valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, barGapWidthPct: 60,
});
tb(s, "Kenaikan didorong 2 hal: lebih banyak petani yang beli (+67%) dan nilai order lebih besar (+58%). Frekuensi beli per customer tetap ±1,1x, belum ada repeat order.", { x: 0.6, y: 5.75, w: 12.1, h: 0.9, fontSize: 15, italic: true, color: C.text2 });

// ---------- 4. Target ----------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Analisa" });
s.addText("Posisi vs target: kurang Rp 395 jt di bulan ke-2", { placeholder: "title" });
s.addChart(pres.charts.BAR, [{ name: "Rp jt", labels: ["Target kumulatif (2 bln)", "Realisasi", "Gap"], values: [1000, 605.2, 394.8] }], {
  x: 0.6, y: 1.5, w: 6.6, h: 4.9, barDir: "bar", showTitle: true, title: "Rp juta (kumulatif Okt–Nov)", titleFontSize: 14, titleColor: H.dk2, titleFontFace: "+mn-lt",
  chartColors: [H.accent6, H.accent1, H.accent4], showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 13, dataLabelColor: H.dk1, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "#,##0",
  catAxisLabelColor: H.dk1, catAxisLabelFontFace: "+mn-lt", catAxisLabelFontSize: 13, valAxisHidden: true, catAxisOrientation: "maxMin",
  valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, barGapWidthPct: 50,
});
const kpis = [
  ["60,5%", "pencapaian target kumulatif", C.accent3],
  ["±Rp 303 jt", "rata-rata per bulan (target Rp 500 jt)", C.accent3],
  ["±18 order", "tambahan untuk tutup gap (AOV Rp 21,6 jt)", C.accent4],
];
kpis.forEach((k, i) => {
  const y = 1.6 + i * 1.6;
  card(s, 7.6, y, 5.1, 1.35, C.background2, "kpi" + i);
  tb(s, k[0], { x: 7.9, y: y + 0.15, w: 4.6, h: 0.6, fontSize: 28, bold: true, color: k[2], fontFace: THEME.headFontFace });
  tb(s, k[1], { x: 7.9, y: y + 0.78, w: 4.6, h: 0.45, fontSize: 14, color: C.accent5 });
});
s.addNotes("Asumsi: periode 'Setelah verified' ≈ 2 bulan program (Okt–Nov). Dengan sisa ±4 hari di November, gap Rp 395 jt sulit ditutup; fokus pada run-rate Rp 500 jt/bulan mulai Desember.");

// ---------- 5. What it takes ----------
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Analisa" });
s.addText("Untuk Rp 500 jt/bulan, pembeli bulanan perlu ±2x lipat", { placeholder: "title" });
tb(s, "Sales = User verified × % yang membeli × Order per customer × Avg order value", { x: 0.6, y: 1.45, w: 12.1, h: 0.5, fontSize: 18, bold: true, color: C.text2, fontFace: THEME.headFontFace });
const levers = [
  ["User verified", "550", "Perbesar basis: percepat KYC/HKP", "Basis"],
  ["% membeli / bulan", "±2,3%  →  ±3,8%", "Aktivasi 525 verified yang belum beli", "Prioritas 1"],
  ["Order / customer", "1,12x", "Dorong repeat order (pupuk musim berikut)", "Prioritas 2"],
  ["Avg order value", "Rp 21,6 jt", "Pertahankan; bundling paket per hektar", "Jaga"],
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
tb(s, "Hitungan: Rp 500 jt ÷ Rp 21,6 jt ≈ 23 order/bulan ≈ 21 pembeli/bulan (3,8% dari 550). Saat ini ±14 order/bulan (28 order dalam 2 bulan).", { x: 0.6, y: 5.95, w: 12.1, h: 0.8, fontSize: 14, italic: true, color: C.accent5 });

// ---------- 6. Data caveats ----------
pres.addSection({ title: "Catatan" });
s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Catatan" });
s.addText("Catatan data sebelum angka dipakai untuk keputusan", { placeholder: "title" });
const cav = [
  ["Periode tidak setara", "'Sebelum' dikunci Agu–Sep 2026, 'Setelah' terbuka sejak tanggal verified tanpa batas akhir. User yang verified sebelum Agustus ikut menambah 'Setelah'. Batasi ke Okt–Nov agar apple-to-apple dengan target."],
  ["Status HKP belum difilter", "Filter v.status = 'APPROVED' masih dikomentari, sehingga review HKP yang ditolak ikut dihitung verified. Jumlah 550 bisa lebih besar dari aslinya."],
  ["Query data_farm", "WHERE f.is_active memakai alias 'f' yang tidak didefinisikan. Pastikan versi yang dijalankan sudah benar (dim_farm AS f)."],
  ["Sampel kecil", "Hanya 28 order; 1 order besar (±Rp 20 jt) = ±3,5% sales. Pantau per bulan, bukan hanya agregat."],
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
pres.addSection({ title: "Rekomendasi" });
s = pres.addSlide({ masterName: "DARK_TOP", sectionTitle: "Rekomendasi" });
s.addText("Rekomendasi & langkah berikut", { placeholder: "title" });
const recs = [
  ["Aktivasi 525 user verified", "Campaign telesales/WA ke verified yang belum beli; prioritaskan luas kebun terbesar."],
  ["Bangun repeat order", "Reminder jadwal pemupukan berikutnya untuk 25 pembeli; target 1,5 order/customer."],
  ["Perbesar basis verified", "Percepat proses KYC/HKP, follow-up dokumen yang pending."],
  ["Rapikan query & tracking", "Filter APPROVED, batasi periode Okt–Nov, dan buat breakdown per bulan untuk monitoring run-rate."],
];
recs.forEach((r, i) => {
  const y = 1.75 + i * 1.25;
  s.addShape(pres.shapes.OVAL, { x: 0.8, y: y + 0.05, w: 0.6, h: 0.6, fill: { color: C.accent3 }, line: { color: C.accent3 }, objectName: "rnum" + i });
  tb(s, String(i + 1), { x: 0.8, y: y + 0.05, w: 0.6, h: 0.6, fontSize: 20, bold: true, color: C.text2, align: "center", valign: "middle" });
  tb(s, r[0], { x: 1.7, y: y, w: 10.8, h: 0.45, fontSize: 20, bold: true, color: C.background1 });
  tb(s, r[1], { x: 1.7, y: y + 0.47, w: 10.8, h: 0.5, fontSize: 15, color: C.accent6 });
});

(async () => {
  const out = "/home/user/analisa-claude/deck/Evaluasi Sales HKP Verified.pptx";
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log("ok");
})();
