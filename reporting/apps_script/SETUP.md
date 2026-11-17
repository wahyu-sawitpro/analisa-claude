# Panduan Setup Otomasi Report (Apps Script)

Ada 3 otomasi. **Masing-masing punya project Apps Script sendiri.**

| Report | Project Apps Script | File script | Report dibuat GitHub | Apps Script update Drive | File di Drive |
|---|---|---|---|---|---|
| AM Report | `AM Report Smallholder` | `AmReport.gs` | Senin 16:00 WIB | Senin 17:00–18:00 WIB | 1 `.pptx` |
| LTV Report | `LTV Report Smallholder` | `LtvReport.gs` | Senin ~15:23 WIB (GitHub bisa telat beberapa jam) | Cek tiap jam; Drive ter-update ≤ 1 jam setelah report jadi | Google Slides bertumpuk (8 minggu terakhir, terbaru di atas) + `.pptx` & `.xlsx` minggu terbaru |
| SLA / Aging Report | `SLA Aging Report B2C` | `SlaReport.gs` | Rabu ~11:17 WIB | Rabu 13:00–14:00 WIB | 1 `.pptx` |

## Cara kerja (sama untuk ketiganya)

```
CSV di-upload ke GitHub (branch main)
        │
        ▼
GitHub Actions membuat deck/xlsx → disimpan sebagai "artifact"
        │
        ▼
Apps Script (sesuai jadwal) mengambil artifact terbaru
        │
        ▼
File TETAP di Google Drive ditimpa → link tidak berubah,
versi minggu lalu tersimpan di "Version history" Drive
```

Tidak ada email. Tim cukup membuka link file di Drive.

---

## A. Persiapan sekali saja (dipakai oleh ketiga project)

### A1. Buat token GitHub
1. Buka GitHub → foto profil → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Isi:
   - **Token name**: `apps-script-reports`
   - **Expiration**: maksimal yang diizinkan, lalu catat tanggal expired-nya.
   - **Repository access**: *Only select repositories* → `wahyu-sawitpro/analisa-claude`
   - **Permissions → Repository permissions → Actions**: **Read-only**. *Metadata: Read-only* ikut terpilih otomatis.
3. Klik **Generate token**, lalu **copy token-nya** (diawali `github_pat_...`). Token ini hanya tampil sekali.

> Satu token yang sama boleh dipakai di ketiga project.
> Kalau token expired, semua report berhenti update dengan error `GitHub API 401`. Buat token baru, lalu ganti `GITHUB_TOKEN` di ketiga project.

### A2. Siapkan file tetap di Google Drive
Untuk setiap report, upload file kosong atau sembarang **satu kali saja**. File ini nantinya ditimpa otomatis setiap minggu.

| Report | File yang perlu ada |
|---|---|
| AM | 1 file `.pptx` (sudah ada, ID-nya sudah terisi di `AmReport.gs`) |
| LTV | 1 `.pptx` + 1 `.xlsx` (sudah ada, ID-nya sudah terisi di `LtvReport.gs`) |
| SLA | 1 `.pptx` (sudah ada: *Pending Aging.pptx*, ID-nya sudah terisi di `SlaReport.gs`) |

Cara mengambil **File ID**: buka file di Drive, lalu lihat URL-nya:
`https://docs.google.com/presentation/d/`**`1AbCdEf...XyZ`**`/edit` → bagian yang ditebalkan adalah File ID.

> Upload sebagai file `.pptx` / `.xlsx` asli. **Jangan** dikonversi ke Google Slides/Sheets. Kalau Drive menawarkan konversi otomatis, matikan dulu di Drive → ⚙️ Settings → *Convert uploads* → off.

---

## B. Langkah per project (ulangi untuk AM, LTV, SLA)

Lakukan langkah B1–B7 tiga kali, satu kali untuk setiap report. Tabel di bawah menunjukkan nilai yang berbeda per report.

| | AM | LTV | SLA |
|---|---|---|---|
| Nama project | `AM Report Smallholder` | `LTV Report Smallholder` | `SLA Aging Report B2C` |
| File di repo | `reporting/apps_script/AmReport.gs` | `reporting/apps_script/LtvReport.gs` | `reporting/apps_script/SlaReport.gs` |
| Konstanta File ID | `AM_PPTX_FILE_ID` | `LTV_PPTX_FILE_ID`, `LTV_XLSX_FILE_ID` | `SLA_PPTX_FILE_ID` |
| Workflow di tab Actions | *AM Report Smallholder (build deck)* | *LTV & Upsell / Cross-sell Report Smallholder (build deck)* | *Delivery SLA / Aging Report B2C Smallholder (build deck)* |
| Fungsi setup | `amSetup` | `ltvSetup` | `slaSetup` |
| Fungsi tes | `amPullLatestReport` | `ltvPullLatestReport` | `slaPullLatestReport` |
| Fungsi pasang jadwal | `amInstallTrigger` | `ltvInstallTrigger` | `slaInstallTrigger` |

### B1. Buat project baru
1. Buka **https://script.google.com** → **New project**.
2. Klik judul *Untitled project* di kiri atas, lalu ganti dengan nama project dari tabel di atas.

### B2. Tempel script
1. Di GitHub, buka file script dari tabel, lalu klik **Raw**. Pilih semua (Ctrl+A) dan copy (Ctrl+C).
2. Di Apps Script, buka `Code.gs`. **Hapus semua isinya**, lalu paste.
   *(Aman karena ini project baru khusus untuk report ini.)*
3. Klik 💾 **Save**.

### B3. Tambahkan Drive API
1. Di sidebar kiri, di bagian **Services**, klik **+**.
2. Pilih **Drive API** → **Add**.

### B4. Tambahkan GITHUB_TOKEN
1. Di sidebar kiri, klik ⚙️ **Project Settings**.
2. Scroll ke **Script Properties** → **Add script property**.
3. Isi **Property** = `GITHUB_TOKEN` dan **Value** = token dari langkah A1.
4. Klik **Save script properties**.

### B5. Isi File ID Drive
Kembali ke editor (ikon `< >`). Di bagian atas script, ganti File ID dengan file dari langkah A2, lalu klik **Save**.
- **AM**, **LTV**, dan **SLA**: ID-nya sudah terisi. Cukup pastikan ID tersebut memang file yang dipakai tim.

### B6. Pastikan sudah ada artifact di GitHub
1. Di GitHub, buka tab **Actions**, lalu pilih workflow dari tabel.
2. Klik **Run workflow** → **Run workflow**. Tunggu sampai muncul centang hijau, biasanya 1–3 menit.

### B7. Jalankan berurutan di Apps Script
Pilih nama fungsi di dropdown di sebelah tombol ▶ **Run**, lalu klik **Run**:
1. **Fungsi setup** (`amSetup` / `ltvSetup` / `slaSetup`)
   - Pada run pertama akan muncul permintaan izin: **Review permissions** → pilih akun → **Advanced** → **Go to … (unsafe)** → **Allow**. Ini normal untuk script buatan sendiri.
   - Log yang benar: `Drive OK (...)` untuk setiap file, lalu `GitHub OK: latest artifact ...`.
2. **Fungsi tes** (`...PullLatestReport`). Log: `Updated <nama file> ...`. Buka file di Drive, isinya seharusnya sudah report terbaru.
3. **Fungsi pasang jadwal** (`...InstallTrigger`). Log: `... trigger installed: every ...`.
4. Cek ikon ⏰ **Triggers** di sidebar. Harus ada **1** trigger dengan fungsi `...PullLatestReport`.

Project ini selesai. Ulangi langkah B1–B7 untuk report berikutnya.

---

## C. Bersihkan project lama (WAJIB kalau sebelumnya digabung)

Kalau dulu AM dan LTV (atau SLA versi email) berjalan di **satu project lama**, matikan trigger lama di project itu. Kalau tidak dimatikan, file akan di-update dua kali atau masih ada email yang terkirim.

1. Buka project lama → ⏰ **Triggers**.
2. Hapus (⋮ → **Delete trigger**) semua trigger untuk fungsi: `pullLatestReport`, `pullAllReports`, `ltvPullLatestReport`, `slaRunReport`.
3. Opsional: arsipkan project lama. Jangan dihapus dulu sampai ketiga project baru sudah terbukti jalan selama 1 minggu.

---

## D. Rutinitas mingguan (yang perlu dilakukan manusia)

Upload export CSV terbaru ke GitHub di branch `main`, dengan **nama file yang persis sama**, sebelum jadwal GitHub Actions:

| Report | File yang di-upload | Batas upload |
|---|---|---|
| AM | `CRM Smallholder.csv`, `Sales Smallholder.csv` | Senin sebelum 16:00 WIB |
| LTV | `detail customer smallholder.csv` (+ `Sales Smallholder.csv`) | Senin sebelum 16:00 WIB |
| SLA | `pending and aging more than 14 days from smallholder team customer.csv` (+ `Sales Smallholder.csv`, `CRM Smallholder.csv` untuk konteks) | Rabu sebelum 11:00 WIB |

Cara upload: di repo, klik **Add file** → **Upload files**, drag file CSV ke halaman, lalu **Commit changes** langsung ke `main`.

> Workflow `Clean old CSV` otomatis menghapus CSV yang tidak di-update lebih dari 1 bulan.

---

## E. Kalau ada error

| Pesan error | Penyebab | Solusi |
|---|---|---|
| `Add Script Property GITHUB_TOKEN first.` | Token belum diisi **di project ini** (Script Properties tidak dibagi antar project) | Lakukan langkah B4 |
| `Drive is not defined` / `ReferenceError: Drive` | Drive API belum ditambahkan | Lakukan langkah B3 |
| `GitHub API 401` | Token salah atau expired | Buat token baru (A1), lalu ganti di B4 untuk ketiga project |
| `GitHub API 403` / `404` | Token tidak punya akses ke repo, atau izin Actions belum Read-only | Cek pengaturan token di A1 |
| `GitHub OK, but no artifact yet` / `No artifact "..." found.` | Workflow belum pernah jalan atau artifact sudah lewat 14 hari | Lakukan langkah B6 |
| `Latest ... artifact is XXh old — this week's ... workflow probably failed` | Workflow minggu ini gagal, biasanya karena CSV belum di-upload | Buka tab Actions → lihat run yang merah → upload CSV yang kurang → **Re-run** → lalu jalankan fungsi tes |
| `File not found` / `Requested entity was not found` | File ID salah, atau akun Apps Script tidak punya akses ke file itu | Cek ID di B5 dan pastikan file bisa dibuka oleh akun yang sama |
| `... already uploaded, nothing to do.` | Bukan error. Artifact ini sudah pernah di-upload | Tidak perlu tindakan |

Riwayat run bisa dilihat di Apps Script → **Executions** (ikon ☰ dengan panah).
