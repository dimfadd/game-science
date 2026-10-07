# Kampung Sains

Koleksi game HTML5 untuk anak kelas 1–3 SD. Anak belajar matematika dan fisika intuitif lewat mekanik permainan, bukan lewat kuis.

## Cara main

Buka `index.html` di browser (bisa langsung dari file, tanpa server dan tanpa internet). Di tablet atau HP, jalankan server statis apa saja, misalnya:

```bash
python3 -m http.server 8000
# lalu buka http://<ip-komputer>:8000 dari tablet
```

## Deploy ke Vercel

Ini situs statis tanpa build. Di Vercel: **Add New → Project**, import repo ini, Framework Preset **Other**, Build Command dikosongkan, Output Directory `.`. Branch selain `main` otomatis mendapat Preview URL.

## Isi

| Game | Konsep |
|---|---|
| Timbangan Pasar | Sama dengan / lebih dari / kurang dari, penjumlahan dan pengurangan sebagai keseimbangan, bilangan hilang, setengah; berat ≠ ukuran; pengungkit (berat × jarak) |
| Angkot Penuh! | Pasangan 10, number bond, puluhan dan satuan |
| Lompat Katak | Garis bilangan, maju/mundur, lompat 2/5/10, perkalian sebagai lompatan berulang |
| Ketapel Mangga | Tarikan → kecepatan → jarak, lintasan parabola, massa dan hambatan udara |
| Rakit Terapung | Terapung/tenggelam ditentukan massa jenis, kapasitas rakit, bentuk lambung |
| Bagi Martabak | Bagian sama besar, ½ ⅓ ¼, membandingkan pecahan |

`assets.html` menampilkan semua aset visual (maskot Si Cil, benda, makhluk, latar, landmark).

## Struktur

```
index.html            Peta Kampung (hub) + panduan orang tua
assets.html           galeri aset
shared/core.js        runtime bersama (window.GS)
shared/core.css       token desain dan komponen UI
shared/art.js         library aset SVG (window.GS.art)
games/<id>/           satu folder per game
docs/DESIGN.md        prinsip pedagogi, gaya visual, aturan fisika
docs/GAMES.md         spesifikasi level setiap game
```

Tanpa build step dan tanpa library eksternal. Semua gambar adalah SVG buatan tangan, semua suara disintesis dengan Web Audio, dan instruksi diucapkan dengan Web Speech API (`id-ID`). Kalau perangkat tidak punya suara Bahasa Indonesia, teks tetap muncul di gelembung Si Cil.
