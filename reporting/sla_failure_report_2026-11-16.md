# Laporan SLA Pengiriman B2C Smallholder — 16 Nov 2026

**SLA:** order harus terkirim ≤ 14 hari sejak `sale_order_date` dan harus fully paid (PAID).
**Sumber:** `pending and aging more than 14 days from smallholder team customer.csv`, ditambah konteks dari `Sales Smallholder.csv`, `detail customer smallholder.csv` dan `CRM Smallholder.csv`.

## Ringkasan

| Metrik | Nilai |
|---|---|
| Order yang gagal SLA | **2** (semua status pengiriman `pending`) |
| Nilai sales yang tertahan | **Rp 26.029.410** |
| Rata-rata aging | 34 hari (≈ 20 hari melewati SLA) |
| Fully paid | 2/2 PAID, tapi keduanya **belum dikirim** |
| Status SO di Odoo | 2/2 masih **NEW** |

## Detail per order

| Order | Customer | PIC | Item | Sales | Order | Lunas | Jadwal kirim | Aging | Akar masalah |
|---|---|---|---|---|---|---|---|---|---|
| #B2C26350 | EKA PURNOMO (toko keliling, repeat, Kampar) | Rudi Nirwana | NPK Phonska Plus 25kg ×50 | Rp 16,9 jt | 12 Okt | **11 Nov (H+30)** | 26 Okt (H+14) | 35 hari | Pelunasan terlambat, lalu belum dikirim juga 5 hari setelah lunas |
| #B2C26488 | SAHALA (repeat, Rokan Hilir) | Muhammad Abdul Wahab | MOP/KCL Mentari 50kg ×22 | Rp 9,1 jt | 14 Okt | **14 Okt (H+0)** | 28 Okt (H+14) | 33 hari | Masalah fulfilment internal: lunas di hari order, tapi tidak dikirim selama 33 hari |

### #B2C26350 — EKA PURNOMO
- Pelunasan baru masuk 30 hari setelah order, jadi SLA sudah lewat sebelum barang boleh dikirim. **Dari sisi kapan pelanggarannya terjadi, pemiliknya adalah collection oleh Sales PIC.**
- Jadwal kirim 26 Okt dibuat **sebelum lunas**. Slot itu kedaluwarsa dan tidak pernah dijadwalkan ulang setelah pembayaran masuk 11 Nov.
- Sudah 5 hari sejak lunas, SO masih NEW dan barang belum dikirim. Jadi sekarang masalahnya juga sudah ada di Ops.
- PIC visit onsite tanggal 6 Nov (CRM SMEN-43668, customer tanya harga ZA). Order masih pending saat itu, tapi tidak ada catatan follow-up atau eskalasi pengiriman.

### #B2C26488 — SAHALA
- Customer lunas **di hari yang sama** dengan order, jadi tidak ada kendala dari sisi customer. **Ini murni pelanggaran SLA oleh internal (Ops/Logistik).**
- Jadwal kirim tepat di hari ke-14 (tanpa buffer), lalu terlewat 19 hari tanpa update.
- Order kecil (22 sak / 1,1 ton) di Rokan Hilir. Dugaan: order ditahan untuk konsolidasi armada atau rute. Ini perlu dikonfirmasi ke Ops.
- Kemungkinan alamat tidak konsisten: kota di order sebelumnya dan lokasi kebun (dibuat 14 Okt) ada di Rokan Hilir, sedangkan order ini tercatat di Kampar. Perlu dicek apakah alamat kirim benar.

## Lessons learned

1. **Status PAID tidak otomatis menggerakkan pengiriman.** Kedua order lunas tapi SO masih NEW, sehingga gudang tidak pernah menerima tugas picking. → Buat otomasi Odoo: SO auto-confirm saat invoice PAID, atau minimal alert harian "PAID & SO = NEW" ke Ops.
2. **Penjadwalan kirim dilakukan di hari ke-14.** Kalau ada sedikit saja keterlambatan, SLA pasti gagal. → Jadwalkan pengiriman paling lambat H+7 s/d H+10 sejak order.
3. **Jadwal yang terlewat tidak ada pemiliknya.** Keduanya lewat 19–21 hari dari jadwal tanpa alasan atau tanggal baru. → Aturannya: kalau tanggal jadwal lewat, Ops wajib isi alasan dan tanggal baru dalam 24 jam.
4. **Jadwal dibuat sebelum lunas lalu tidak di-reset.** (#B2C26350) → Jadwalkan pengiriman hanya setelah PAID. Saat pembayaran masuk, jadwal ulang dalam ≤ 3 hari.
5. **Collection yang lambat menghabiskan jatah SLA.** Butuh 30 hari sampai lunas. → Reminder PIC di H+1, H+3, H+7. Order yang belum lunas di H+7 di-re-date atau dibatalkan, supaya SLA mengukur kinerja Ops dan tidak tercampur dengan perilaku bayar customer.
6. **PIC bertemu customer tapi tidak mengeskalasi order yang pending.** → Saat visit atau call ke customer yang punya order pending lebih dari 7 hari, PIC wajib cek status kirim dan mencatatnya di CRM.
7. **Dua-duanya repeat customer.** Risiko churn tinggi. → PIC menelepon minggu ini dengan tanggal kirim yang pasti. Pertimbangkan goodwill (free ongkir/voucher) di order berikutnya.

## Otomasi (sama seperti AM report & LTV report, tanpa email)

| Langkah | Kapan | File |
|---|---|---|
| GitHub Actions membaca CSV aging (+ Sales & CRM untuk konteks), lalu membuat deck `.pptx` dan `.xlsx` sebagai artifact `sla-report` | Rabu ~11:17 WIB | `.github/workflows/sla-report-weekly.yml`, `reporting/sla_report.py` |
| Apps Script mengambil artifact terbaru dan menimpa 2 file tetap di Drive (link tidak berubah; minggu sebelumnya tersimpan sebagai version history) | Rabu 13:00–14:00 WIB | `reporting/apps_script/SlaReport.gs` |

Isi deck: Summary (KPI, per akar masalah, per PIC) → Detail order → Temuan proses per order (termasuk kontak CRM selama order pending) → Lessons learned & actions.
Isi xlsx: Orders failing SLA, Lessons learned, Per PIC, Assumptions.

Rutinitas: sebelum Rabu 11:00 WIB, upload CSV *"pending and aging more than 14 days from smallholder team customer.csv"* terbaru ke `main`.
