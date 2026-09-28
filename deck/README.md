# Deck Analisa Leads – SawitPRO

Deck presentasi interaktif (HTML) berbasis template *Deck Template SawitPRO*. Tombol **Unggah data** di toolbar
membaca file CSV, TSV, XLSX, XLS, ODS atau JSON langsung di browser dan membangun ulang seluruh slide dari data baru.
File juga bisa di-*drag & drop* ke halaman. Data tidak dikirim ke server mana pun.

- `index.html` – deck siap pakai (buka langsung di browser).
- `src/deck.html` – sumber deck; gambar template ditulis sebagai `{{IMG:nama}}`.
- `src/sample-data.json` – data contoh (tanpa nama & nomor telepon leads).
- `assets/` – gambar dari template PPTX (dikompresi).
- `build.py` – `python3 deck/build.py` menyisipkan gambar + data contoh ke `index.html`.

## Format data
Kolom dikenali dari judulnya (tidak harus persis sama): `Status`, `Alasan`, `PIC`, `Tipe engagement`, `Tanggal`,
`Lokasi`, `Sumber`, `Tujuan`, `Produk`, `Potential sales (IDR)`, `ID`. Variasi penulisan status seperti
"Tidak tertark" atau "Mempetimbangkan" dinormalisasi otomatis. Kolom nama/telepon/kontak tidak ditampilkan.
Untuk file dengan banyak sheet, pilih sheet dari dropdown di toolbar.

## Ringkasan analisa (data 21–25 Sep 2026, 34 leads)
1. **88% (30) tidak tertarik, 12% (4) masih mempertimbangkan.** Keempat leads hangat bernilai potensi Rp9,99 jt
   (3× benih Topaz Rp2,8 jt, 1× uji daun Rp1,59 jt), alasan: belum butuh dalam waktu dekat.
2. **Penolakan terkonsentrasi di satu pola:** semua 30 penolakan dari satu PIC (Naya Huwaidah), via WhatsApp chat,
   produk KebunPRO, lokasi Kota Pekanbaru – Payung Sekaki, sumber Field Team, pada 21–23 Sep. Ini terlihat seperti
   blast chat ke satu daftar kontak, bukan penolakan organik.
3. **Alasan terlalu umum:** "Belum ada ketertarikan yang jelas" (88%) tidak bisa ditindaklanjuti.
4. **Engagement tatap muka/telepon menghasilkan semua leads hangat** (Khoirul Huda: 3 visit onsite + 1 telepon).
5. **Kualitas data:** status salah ketik, 4 kolom kosong total (Potential FFB, Alasan lainnya, Estimasi closing,
   Keterangan), 88% baris tanpa potensi sales & produk. Di file asli juga ada 1 lead tanpa `ID on contact`,
   1 lead dengan dua nomor, dan 1 lead yang namanya berbeda dengan kontak (PSEN-1737 "tono" vs "Anton S").

Rekomendasi: evaluasi skrip & target list WA KebunPRO, pecah alasan penolakan jadi opsi spesifik (harga, belum butuh,
sudah punya vendor, tidak bisa dihubungi), follow-up 4 leads hangat dalam 7–14 hari, dan jadikan potensi sales,
produk, serta PIC lapangan sebagai field wajib.
