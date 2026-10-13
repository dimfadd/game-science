# SOP QC ukuran visual

Tujuan: setiap angka, teks, dan benda yang harus dilihat atau disentuh anak **terbaca dan mudah disentuh di HP terkecil yang kita dukung**, bukan hanya di laptop. SOP ini wajib dijalankan untuk setiap game baru, level baru, atau perubahan tampilan, dan hasilnya dicatat di `docs/LOG.md`.

## 1. Kenapa ukuran bisa terlalu kecil

Semua game digambar di kanvas tetap **1280 × 800 unit**. Kanvas itu diperkecil agar muat di layar:

| Perangkat (landscape) | Tinggi kanvas di layar | Skala (px per unit) | 1 px layar = |
|---|---|---|---|
| HP kecil 740 × 360 | 360 px | **0,45** | 2,2 unit |
| HP umum 844 × 390 | 390 px | 0,49 | 2,0 unit |
| Tablet 1180 × 820 | 744 px | 0,93 | 1,1 unit |
| Laptop 1280 × 800 | 724 px | 0,90 | 1,1 unit |

Desain yang terlihat pas di laptop menjadi **setengah ukurannya** di HP. Karena itu, ukuran minimum ditentukan dari **HP kecil (skala 0,45)**.

Di HP landscape, HUD menjadi kolom di kiri layar supaya kanvas memakai seluruh tinggi layar, dan kanvas dilebarkan otomatis supaya tidak ada strip kosong (`GS.fitStage`, `GS.stageView`).

## 2. Ukuran minimum (dalam unit kanvas)

| Elemen | Gagal jika kurang dari | Disarankan | Setara di HP kecil |
|---|---|---|---|
| Angka yang harus dibaca anak untuk bermain (label beban, harga, nomor patok, angka di kartu, kalimat matematika) | **36 u** (16 px) | 48 u | 22 px |
| Teks/label lain yang perlu dibaca | **30 u** (13 px) | 34 u | 15 px |
| Benda yang diseret atau diketuk (sisi terpendek, termasuk area sentuh tak terlihat) | **90 u** (40 px) | 110 u | 50 px |
| Jarak antar-target sentuh | 20 u | 28 u | |
| Titik penghitung (subitizing) | diameter 14 u | 18 u | |
| Tombol HTML (dock, panel) | **44 px** | 56 px | |
| Teks HTML | 15 px | 17 px | |

Aturan tambahan:
1. **Ukuran gambar tetap tidak boleh menyandikan berat** (`DESIGN.md`). Memperbesar benda kecil-berat (batu, baut) boleh, asalkan benda besar-ringan (kapas, balon) tetap lebih besar.
2. Teks hiasan (papan nama "WARUNG", tulisan di angkot, dan sejenisnya) boleh lebih kecil, tapi harus diberi `data-qc="decor"` atau berada di dalam `.gs-scene`.
3. Area sentuh boleh lebih besar dari gambarnya: pakai `<rect fill="transparent">` sebagai hit area.
4. Setiap target ketuk di SVG yang **tidak** memakai `GS.drag` wajib diberi atribut `data-hit="nama"` supaya ikut diukur.
5. Isi penting berada di area desain `x 0–1280`. Area di luarnya hanya terlihat di layar lebar, jadi khusus untuk latar. Latar dan lantai buatan game sendiri digambar dari `x −600` sampai `1880` (pemandangan `GS.art.scene` sudah otomatis selebar itu).
6. Hindari meletakkan angka penting di zona yang tertutup UI di HP: kiri atas sekitar 380 × 130 u (gelembung Chuppy, hanya sementara) dan kanan bawah sekitar 420 × 170 u (tombol aksi).
7. Kalau benda tidak muat setelah diperbesar, kurangi jumlahnya per layar atau atur ulang tata letaknya. Jangan kembali mengecilkannya.

## 3. Prosedur QC

1. `npm --prefix tests install` (sekali saja).
2. `node tests/visual-qc.js <game> [tier]`. Alat ini membuka setiap level di HP kecil (740 × 360) dan HP umum (844 × 390), mengukur ukuran setiap teks dan target dalam piksel, lalu menulis `tests/shots/qc/report.md` beserta screenshot per level.
3. **Syarat lulus: 0 FAIL.** Setiap `warn` harus dilihat di screenshot dan diputuskan dengan sadar.
4. Lihat screenshot setiap level (minimal level 1 tiap jenjang dan setiap jenis level baru) dengan pertanyaan:
   - Apakah angka bisa dibaca tanpa mendekatkan mata?
   - Apakah benda yang harus diseret jelas terlihat dan tidak saling tumpuk?
   - Apakah ada yang tertutup tombol, HUD, atau gelembung?
   - Apakah latar penuh sampai tepi layar?
   - Apakah fokus layar (yang harus diperhatikan anak) adalah elemen terbesar atau paling kontras?
5. `node tests/levels.js <game>` tetap harus lolos (semua jenjang).
6. Catat hasilnya di `docs/LOG.md` (jumlah FAIL sebelum dan sesudah).

## 4. Saat membuat game atau level baru

- Mulai dari ukuran minimum di atas, jangan mendesain di laptop lalu mengecilkan.
- Uji di 740 × 360 sejak prototipe pertama.
- Gunakan `GS.stageView.scale` jika perlu menyesuaikan sesuatu saat runtime, dan dengarkan event `gs:stage`.
