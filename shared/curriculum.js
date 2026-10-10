/* Mat Sains curriculum: grade tiers and what each game teaches at each tier.
 * Single source of truth for the hub (map labels, parent guide, level counts)
 * and for games (GS.tier()). Specification: docs/KURIKULUM.md.
 * Load after core.js and auth.js, before a game's game.js. */
(function () {
  'use strict';
  const MS = (window.MS = window.MS || {});
  const GS = (window.GS = window.GS || {});

  const TIERS = [
    { id: 'tk', kelas: 'TK', label: 'TK', long: 'TK / PAUD', fase: 'Fase Fondasi', levels: 6 },
    { id: 'k1', kelas: '1', label: 'Kelas 1', long: 'Kelas 1', fase: 'Fase A', levels: 8 },
    { id: 'k2', kelas: '2', label: 'Kelas 2', long: 'Kelas 2', fase: 'Fase A', levels: 8 },
    { id: 'k3', kelas: '3', label: 'Kelas 3', long: 'Kelas 3', fase: 'Fase B', levels: 8 },
    { id: 'k4', kelas: '4+', label: 'Kelas 4+', long: 'Kelas 4 ke atas', fase: 'Fase B', levels: 8 }
  ];
  const byId = id => TIERS.find(t => t.id === id);
  const fromKelas = k => (TIERS.find(t => t.kelas === String(k)) || {}).id;

  /* What each game teaches per tier (shown on the map and in the parent guide). */
  const GAMES = {
    timbangan: {
      name: 'Timbangan Pasar', kind: 'mix',
      desc: {
        tk: 'Mana yang lebih berat? Benda besar belum tentu berat. Membuat dua piring sama banyak sampai 5.',
        k1: 'Sama dengan, lebih dari, kurang dari. Penjumlahan dan pengurangan sampai 20 sebagai keseimbangan.',
        k2: 'Puluhan dan satuan sampai 100, bilangan hilang, setengah, dan penjumlahan berulang. Posisi di jungkat-jungkit ikut menentukan.',
        k3: 'Perkalian dan pembagian dengan kantong sama berat, pecahan dari berat, dan berat × jarak di jungkat-jungkit.',
        k4: 'Kotak misteri (persamaan), kilogram dan gram, pertidaksamaan, dan pengungkit dengan banyak beban.'
      }
    },
    angkot: {
      name: 'Angkot Penuh!', kind: 'mat',
      desc: {
        tk: 'Angkot kecil berangkat kalau 5 kursinya penuh. Membilang dan melengkapi sampai 5.',
        k1: 'Angkot berangkat kalau tepat 10 penumpang. Pasangan bilangan 10 dan number bond.',
        k2: 'Puluhan dan satuan sampai 99 dengan angkot dan becak. Penjumlahan dan pengurangan dua angka.',
        k3: 'Bus besar 100 penumpang: ratusan, puluhan, satuan. Perkalian dan pembagian penumpang.',
        k4: 'Kereta dan ribuan, pembulatan, pembagian bersisa, dan kelipatan kapasitas.'
      }
    },
    katak: {
      name: 'Lompat Katak', kind: 'mat',
      desc: {
        tk: 'Membilang lompatan di batu bertitik sampai 10, maju dan mundur.',
        k1: 'Garis bilangan sampai 20: maju, mundur, lompat 2 dan 5, menghitung lanjut.',
        k2: 'Garis bilangan sampai 100: lompat 5 dan 10, puluhan lalu satuan, garis bilangan kosong.',
        k3: 'Perkalian sebagai lompatan berulang, pembagian, dan lompat ratusan sampai 1.000.',
        k4: 'Kelipatan persekutuan, pecahan di garis bilangan, dan ribuan.'
      }
    },
    ketapel: {
      name: 'Ketapel Mangga', kind: 'fis',
      desc: {
        tk: 'Tarik sedikit jatuh dekat, tarik kuat jatuh jauh. Patok bertitik 1 sampai 5.',
        k1: 'Tarikan lebih kuat membuat batu lebih jauh. Patok 1 sampai 10 sebagai garis bilangan.',
        k2: 'Sudut lemparan, lintasan melengkung melewati semak dan pohon, jarak sampai 15 meter.',
        k3: 'Batu lebih berat terbang lebih lambat, bola kertas tertahan udara. Memilih proyektil yang tepat.',
        k4: 'Mencari sudut terbaik dan pola tarikan: tarikan dua kali lipat, jarak hampir empat kali.'
      }
    },
    perahu: {
      name: 'Rakit Terapung', kind: 'mix',
      desc: {
        tk: 'Mana yang terapung, mana yang tenggelam? Menebak lalu melihat sendiri.',
        k1: 'Terapung atau tenggelam ditentukan bahan, bukan ukuran. Memuat rakit tepat 10 kg.',
        k2: 'Memuat rakit dengan penjumlahan sampai 30 kg, sebanyak mungkin tanpa tenggelam.',
        k3: 'Muatan dengan perkalian dan bentuk lambung plastisin yang membawa kelereng paling banyak.',
        k4: 'Air tawar dan air asin, mengurutkan massa jenis, dan merancang lambung untuk muatan tertentu.'
      }
    },
    martabak: {
      name: 'Bagi Martabak', kind: 'mat',
      desc: {
        tk: 'Membagi sama besar untuk dua teman. Potongan yang adil membuat semua senang.',
        k1: 'Setengah dan seperempat dengan memotong martabak dan kue lapis.',
        k2: 'Sepertiga dan seperenam, membandingkan pecahan, dan setengah dari kumpulan.',
        k3: 'Pecahan seperti ¾ dan 2/4, mengurutkan pecahan, dan pecahan dari kumpulan.',
        k4: 'Pecahan senilai, penjumlahan dan pengurangan penyebut sama, pecahan campuran.'
      }
    },
    bibit: {
      name: 'Kebun Bibit', kind: 'mat',
      desc: {
        tk: 'Satu bibit untuk setiap lubang. Membandingkan barisan dan mengisi lahan kecil sampai pas.',
        k1: 'Baris isi 5 dan 10, dobel, genap dan ganjil, serta sisa bibit sebagai pengurangan.',
        k2: 'Perkalian sebagai baris × kolom dan penjumlahan berulang, tukar baris dan kolom, pembagian awal.',
        k3: 'Perkalian dan pembagian sampai 100, faktor, sifat distributif, luas dan keliling dalam petak.',
        k4: 'Perkalian dua angka dengan model luas, bilangan prima, kelipatan persekutuan, luas bangun L.'
      }
    },
    kembalian: {
      name: 'Warung Kembalian', kind: 'mat',
      desc: {
        tk: 'Membayar dengan koin sebanyak titik di label harga. Mana yang lebih mahal.',
        k1: 'Uang ribuan sampai Rp20.000: membayar tepat, kembalian dari Rp10.000, lembar paling sedikit.',
        k2: 'Sampai Rp100.000: kembalian dengan menghitung lanjut, belanja beberapa barang, cukup atau tidak.',
        k3: 'Ratusan rupiah, harga × jumlah barang, patungan, dan menukar uang.',
        k4: 'Ratusan ribu, perkiraan, harga satuan yang lebih hemat, anggaran, dan pembagian bersisa.'
      }
    },
    jam: {
      name: 'Jam Kampung', kind: 'mix',
      desc: {
        tk: 'Pagi, siang, malam mengikuti matahari. Mengurutkan kegiatan sehari dan bayangan yang memendek.',
        k1: 'Jam tepat dan setengah jam. Memutar jarum dan melihat kampung ikut berjalan.',
        k2: 'Seperempat jam, kelipatan 5 menit, jam digital, dan lama waktu dalam jam dan menit.',
        k3: 'Menit tepat, format 24 jam, lama waktu melewati jam, jadwal, dan detik.',
        k4: 'Lama waktu jam dan menit, konversi, jadwal kereta, WIB WITA WIT, dan jam matahari.'
      }
    },
    wayang: {
      name: 'Wayang Bayangan', kind: 'fis',
      desc: {
        tk: 'Bayangan muncul saat cahaya terhalang. Dekat lampu besar, jauh dari lampu kecil.',
        k1: 'Membuat bayangan pas dengan bentuk pesanan, bahan tembus dan tidak tembus cahaya.',
        k2: 'Bayangan dua dan tiga kali tinggi wayang, tinggi lampu, dua lampu, mengurutkan bahan.',
        k3: 'Cahaya merambat lurus, ukuran bayangan dengan angka, tepi kabur, dan bahan bening atau buram.',
        k4: 'Perbandingan ukuran bayangan, pantulan cermin, dan mengukur tinggi pohon dengan bayangan.'
      }
    }
  };

  function param() {
    try { const t = new URLSearchParams(location.search).get('tier'); return byId(t) ? t : null; } catch (e) { return null; }
  }
  /** Current tier id: ?tier= in the URL, else the signed-in child's kelas, else the device profile, else k1. */
  function tier() {
    const p = param();
    if (p) return p;
    const a = MS.auth;
    const s = a && a.current && a.current();
    const prof = a && a.profile && a.profile();
    return fromKelas(s && s.kelas) || fromKelas(prof && prof.kelas) || 'k1';
  }

  MS.kur = {
    TIERS, GAMES,
    tier,
    info: id => byId(id || tier()),
    levels: (id) => byId(id || tier()).levels,
    fromKelas,
    toKelas: id => byId(id).kelas,
    next: id => { const i = TIERS.findIndex(t => t.id === (id || tier())); return TIERS[i + 1] || null; }
  };
  GS.tier = tier;
  GS.tierInfo = () => byId(tier());
})();
