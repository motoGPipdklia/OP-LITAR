"use strict";

/* SUBTEK FIX009 — Jawatankuasa: susunan manual NAIK/TURUN melalui kolum susunan */

/* SKPO FORMULA 1 BUILD: 20260928-RANK-PB-HOLDER-FIX-017 */

/* ================================================================
   SKPO FORMULA 1 — PENTADBIR
   GitHub Pages + Supabase
================================================================ */

const db = window.supabaseClient;
const ZON_MASA = "Asia/Kuala_Lumpur";
const BUCKET_SITREP_ADMIN = "sitrep-lampiran";
const MASA_TAMAT_PERMINTAAN = 15000;

/* Kunci sesi khusus Pentadbir Formula 1. */
const KUNCI_ADMIN_F1 = "skpoF1Subtek";
const NO_BADAN_ADMIN_UTAMA_F1 = "ADMINF1";
const EMAIL_ADMIN_UTAMA_F1 = "admin@skpo.local";

let adminLogin = null;
let dataDashboard = [];
let dataLaporanPetugasAdmin = [];
let dataSitrepAdmin = [];
let dataPassKenderaanAdmin = [];
let tabLaporanAdminAktif = "petugas";
let dataPaparan = [];
let rekodResetDevice = null;
let rekodImportPenugasan = [];
let importSedangBerjalan = false;
let rekodImportPengguna = [];
let importPenggunaSedangBerjalan = false;

/* Jana Penugasan Automatik */
let dataPetugasAuto = [];
let previewPenugasanAuto = [];
let autoSedangSimpan = false;
let autoLokasiCounter = 0;

const JENIS_PENUGASAN_AUTO_F1 = [
  "KAWALAN KESELAMATAN",
  "KAWALAN LALU LINTAS",
  "RONDAAN PENCEGAHAN JENAYAH",
  "RONDAAN PENCEGAHAN JENAYAH NARKOTIK",
  "RONDAAN PENCEGAHAN JENAYAH KOMERSIL",
  "LITUPAN KESELAMATAN",
  "UNIT PEMUSNAH BOM",
  "SUBTEK"
];

let jenisPenugasanAutoAktif = "";
const pilihanPetugasMengikutJenisAuto = {};

/*
  Seorang petugas hanya boleh berada dalam SATU jenis penugasan
  sepanjang tempoh operasi.
  Map: NO_BADAN -> JENIS_PENUGASAN
*/
const jenisTetapPetugasAuto = {};
const jenisTersimpanPetugasAuto = {};
/* FIX 016: semua petugas yang sudah mempunyai sekurang-kurangnya satu rekod penugasan */
const petugasSudahAdaPenugasanAuto = new Set();






/* Peranti khas Pentadbir Formula 1 */
const KUNCI_DEVICE_F1_ADMIN = "skpoF1DeviceId";
const HAD_PERANTI_KHAS_ADMIN = 2;
let dataPerantiKhasAdmin = [];


/* ================================================================
   CETAK CARTA INDIVIDU
================================================================ */

function tajukCetakanCartaPentadbir(jenis, tajuk) {
  const tarikh =
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    hariIniMalaysia();

  return {
    tajuk:
      teks(tajuk) ||
      atas(jenis).replace(/_/g, " "),
    tarikh:
      formatTarikhMalaysia(tarikh)
  };
}


function tukarCanvasKeImejUntukCetakanPentadbir(
  asal,
  salinan
) {
  const canvasAsal =
    [...asal.querySelectorAll("canvas")];

  const canvasSalinan =
    [...salinan.querySelectorAll("canvas")];

  canvasAsal.forEach((canvas, index) => {
    const canvasClone =
      canvasSalinan[index];

    if (!canvasClone) return;

    try {
      const imej =
        document.createElement("img");

      imej.src =
        canvas.toDataURL(
          "image/png",
          1
        );

      imej.alt =
        canvas.getAttribute("aria-label") ||
        "Carta operasi";

      imej.className =
        "print-chart-image";

      canvasClone.replaceWith(
        imej
      );

    } catch (error) {
      console.warn(
        "Canvas gagal ditukar kepada imej untuk cetakan:",
        error
      );
    }
  });
}


function bersihkanSalinanCetakanCartaPentadbir(
  salinan
) {
  /*
    Butang dan kawalan interaktif tidak perlu dicetak.
  */
  salinan
    .querySelectorAll(
      "button, select, input, textarea, .admin-chart-print-button, " +
      ".admin-vehicle-hint, .admin-attendance-hint, .admin-incident-hint, " +
      ".admin-map-controls, .admin-map-marker-controls"
    )
    .forEach(item =>
      item.remove()
    );

  /*
    Status berjaya / ralat sistem tidak dimasukkan dalam laporan cetak.
  */
  salinan
    .querySelectorAll(
      ".status-box"
    )
    .forEach(item =>
      item.remove()
    );

  return salinan;
}


function cetakCartaPentadbir(
  jenis,
  tajuk
) {
  const jenisBersih =
    atas(jenis);

  const asal =
    document.querySelector(
      `[data-chart-section="${jenisBersih}"]`
    );

  if (!asal) {
    alert(
      "Bahagian carta untuk dicetak tidak dijumpai."
    );
    return;
  }

  const salinan =
    asal.cloneNode(true);

  tukarCanvasKeImejUntukCetakanPentadbir(
    asal,
    salinan
  );

  bersihkanSalinanCetakanCartaPentadbir(
    salinan
  );

  const maklumat =
    tajukCetakanCartaPentadbir(
      jenisBersih,
      tajuk
    );

  const cssLinks =
    [...document.querySelectorAll(
      'link[rel="stylesheet"]'
    )]
      .map(link => {
        const href =
          new URL(
            link.getAttribute("href"),
            document.baseURI
          ).href;

        return `<link rel="stylesheet" href="${escapeHtml(href)}">`;
      })
      .join("\n");

  const tetingkap =
    window.open(
      "",
      "_blank",
      "width=1400,height=900"
    );

  if (!tetingkap) {
    alert(
      "Pelayar menghalang tetingkap cetak. Benarkan pop-up untuk laman ini dan cuba semula."
    );
    return;
  }

  tetingkap.document.open();

  tetingkap.document.write(`
    <!DOCTYPE html>
    <html lang="ms">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${escapeHtml(maklumat.tajuk)}</title>

      ${cssLinks}

      <style>
        @page {
          size: A4 landscape;
          margin: 10mm;
        }

        html,
        body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          color: #111111 !important;
          font-family: Arial, Helvetica, sans-serif !important;
        }

        body {
          padding: 8mm !important;
        }

        .print-report-header {
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 3px solid #d4af37;
          text-align: center;
        }

        .print-report-header h1 {
          margin: 0;
          color: #111111 !important;
          font-size: 22px;
        }

        .print-report-header h2 {
          margin: 6px 0 0;
          color: #111111 !important;
          font-size: 17px;
        }

        .print-report-header p {
          margin: 5px 0 0;
          color: #444444 !important;
          font-size: 12px;
        }

        .print-chart-container {
          width: 100%;
        }

        .print-chart-container .admin-chart-card {
          width: 100% !important;
          max-width: none !important;
          min-width: 0 !important;
          margin: 0 !important;
          padding: 14px !important;
          border: 1px solid #b8b8b8 !important;
          box-shadow: none !important;
          background: #ffffff !important;
          color: #111111 !important;
        }

        .print-chart-container h3,
        .print-chart-container strong,
        .print-chart-container b,
        .print-chart-container td,
        .print-chart-container th,
        .print-chart-container span,
        .print-chart-container div {
          color: #111111;
        }

        .print-chart-container .muted,
        .print-chart-container small {
          color: #555555 !important;
        }

        /* Tema khas cetakan: jangan bawa panel hitam tema dashboard ke kertas/PDF. */
        .print-chart-container .admin-visitor-layout > *,
        .print-chart-container .admin-vehicle-layout > *,
        .print-chart-container .admin-chart-panel,
        .print-chart-container .admin-chart-subcard,
        .print-chart-container .admin-chart-list-panel,
        .print-chart-container [class*="chart-panel"],
        .print-chart-container [class*="detail-panel"] {
          background: #ffffff !important;
          color: #111111 !important;
          border-color: #bcbcbc !important;
          box-shadow: none !important;
        }

        .print-chart-container .admin-chart-card-heading,
        .print-chart-container .section-heading,
        .print-chart-container .admin-committee-heading {
          margin-bottom: 12px !important;
        }

        .print-chart-container .section-heading-actions,
        .print-chart-container .admin-committee-heading-actions {
          display: none !important;
        }

        .print-chart-image {
          display: block;
          width: 100% !important;
          max-width: 900px !important;
          height: auto !important;
          margin: 0 auto !important;
          object-fit: contain;
        }

        .print-chart-container .admin-chart-canvas-wrap,
        .print-chart-container .admin-vehicle-canvas-wrap,
        .print-chart-container .admin-attendance-canvas-wrap,
        .print-chart-container .admin-incident-canvas-wrap {
          height: auto !important;
          min-height: 0 !important;
          background: #ffffff !important;
        }

        .print-chart-container .admin-visitor-layout,
        .print-chart-container .admin-vehicle-layout,
        .print-chart-container .admin-attendance-layout,
        .print-chart-container .admin-incident-layout,
        .print-chart-container .admin-operation-map-layout {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) minmax(280px, .72fr) !important;
          gap: 12px !important;
        }

        .print-chart-container .admin-visitor-chart-panel,
        .print-chart-container .admin-visitor-detail-panel,
        .print-chart-container .admin-visitor-trend-panel,
        .print-chart-container .admin-visitor-location-panel,
        .print-chart-container .admin-vehicle-chart-panel,
        .print-chart-container .admin-vehicle-detail-panel,
        .print-chart-container .admin-attendance-chart-panel,
        .print-chart-container .admin-attendance-list-panel,
        .print-chart-container .admin-incident-chart-panel,
        .print-chart-container .admin-incident-detail-panel,
        .print-chart-container .admin-operation-map-panel,
        .print-chart-container .admin-operation-map-detail {
          border: 1px solid #bcbcbc !important;
          background: #ffffff !important;
          color: #111111 !important;
        }

        .print-chart-container table {
          width: 100% !important;
          min-width: 0 !important;
          max-width: 100% !important;
          table-layout: auto !important;
          border-collapse: collapse !important;
          background: #ffffff !important;
        }

        .print-chart-container th,
        .print-chart-container td {
          position: static !important;
          padding: 7px 8px !important;
          border: 1px solid #777777 !important;
          background: #ffffff !important;
          color: #111111 !important;
          font-size: 10px !important;
        }

        .print-chart-container th {
          font-weight: 700 !important;
          text-align: center !important;
        }

        .print-chart-container .admin-committee-title-row th {
          background: #202020 !important;
          color: #ffffff !important;
        }

        .print-chart-container .admin-committee-group-row td {
          background: #ece2b8 !important;
          color: #111111 !important;
          font-weight: 700 !important;
        }

        .print-chart-container .admin-chronology-table tbody td:nth-child(2) {
          font-weight: 400 !important;
        }

        .print-chart-container .admin-chronology-table tbody td:nth-child(4) {
          text-align: center !important;
          vertical-align: middle !important;
        }

        .print-chart-container .admin-chart-list-item,
        .print-chart-container .admin-vehicle-detail-item,
        .print-chart-container .admin-attendance-person,
        .print-chart-container .admin-incident-detail-item {
          break-inside: avoid;
          border-color: #cccccc !important;
          background: #ffffff !important;
          color: #111111 !important;
        }

        .print-chart-container img {
          max-width: 100%;
        }

        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>

    <body>
      <header class="print-report-header">
        <h1>OP LITAR</h1>
        <h2>${escapeHtml(maklumat.tajuk)}</h2>
        <p>TARIKH: ${escapeHtml(maklumat.tarikh)}</p>
      </header>

      <main class="print-chart-container">
        ${salinan.outerHTML}
      </main>

      <script>
        window.addEventListener("load", function () {
          setTimeout(function () {
            window.focus();
            window.print();
          }, 500);
        });
      <\/script>
    </body>
    </html>
  `);

  tetingkap.document.close();
}


/* ================================================================
   MODUL CARTA OPERASI
================================================================ */

let dataCartaLaporanPentadbir = [];
let cartaPengunjungPentadbir = null;
let cartaPengunjungLokasiPentadbir = null;
let lokasiPengunjungDipilihPentadbir = "SEMUA";
let cartaKenderaanPentadbir = null;
let cartaKenderaanLokasiPentadbir = null;
let lokasiKenderaanDipilihPentadbir = "SEMUA";
let kategoriKenderaanDipilihPentadbir = "BAS";
let dataPengunjungManualPentadbir = [];
let modPengunjungManualPentadbir = "TAMBAH";
let dataKenderaanManualPentadbir = [];
let modKenderaanManualPentadbir = "TAMBAH";
const JADUAL_CARTA_MANUAL_F1 = "carta_manual";
let cartaJawatankuasaPentadbir = null;
let dataJawatankuasaOperasiPentadbir = [];
let dataPilihanPetugasJawatankuasaPentadbir = [];
let rekodJawatankuasaSedangEditPentadbir = null;
let dataAgensiLuarOperasiPentadbir = [];
let rekodAgensiLuarSedangEditPentadbir = null;
let dataVvipVipOperasiPentadbir = [];
let rekodVvipVipSedangEditPentadbir = null;
let idVvipVipDipilihPentadbir = "";
let cartaKehadiranPentadbir = null;
let statusKehadiranCartaDipilihPentadbir = "HADIR";
let cartaInsidenPentadbir = null;
let kategoriInsidenDipilihPentadbir = "TANGKAPAN";

let lokasiPetaDipilihPentadbir = "";
let tabPetugasLokasiAktif = "BERTUGAS";
let zumPetaCartaPentadbir = 1;
let markerPetaDipaparkanPentadbir = true;
let jenisTugasPetaDipilihPentadbir = "SEMUA";
let jenisTugasMarkerUrusPentadbir = "";

let sedangSeretMarkerPetaPentadbir = false;
let lokasiMarkerSeretPentadbir = "";
let kanvasMarkerSeretPentadbir = null;


const KUNCI_TETAPAN_PETA_CARTA_F1 = "skpoF1TetapanPetaCarta";
const URL_PETA_ADMIN_F1 = "images/petaadmin.png?v=20260821-1334";
const KUNCI_KRONOLOGI_CARTA_F1 = "skpoF1KronologiCarta";




function el(id) {
  return document.getElementById(id);
}

function teks(nilai) {
  return String(nilai ?? "").trim();
}

function atas(nilai) {
  return teks(nilai).toUpperCase();
}

function escapeHtml(nilai) {
  return String(nilai ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function nilaiBoolean(nilai) {
  return nilai === true || [
    "YA", "YES", "Y", "1", "BENAR", "TRUE"
  ].includes(atas(nilai));
}

function emailDalaman(noBadan) {
  const noBadanBersih = atas(noBadan);

  /*
    Akaun Pentadbir utama Formula 1 telah didaftarkan dalam Supabase
    Authentication sebagai admin@skpo.local.
  */
  if (noBadanBersih === NO_BADAN_ADMIN_UTAMA_F1) {
    return EMAIL_ADMIN_UTAMA_F1;
  }

  const nilai = noBadanBersih
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");

  return `${nilai}@skpo.local`;
}

function hariIniMalaysia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZON_MASA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}


function formatTarikhMalaysia(nilai) {
  if (!nilai) return "-";

  const input = teks(nilai);

  /*
    YYYY-MM-DD diproses tanpa timezone supaya tarikh
    tidak berubah akibat zon masa browser.
  */
  const padanan =
    input.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (padanan) {
    return `${padanan[3]}/${padanan[2]}/${padanan[1]}`;
  }

  const tarikh =
    new Date(input);

  if (
    Number.isNaN(
      tarikh.getTime()
    )
  ) {
    return input || "-";
  }

  return new Intl.DateTimeFormat(
    "ms-MY",
    {
      timeZone: ZON_MASA,
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  ).format(tarikh);
}


function formatTarikhMasa(nilai) {
  if (!nilai) return "-";

  const tarikh = new Date(nilai);
  if (Number.isNaN(tarikh.getTime())) return teks(nilai) || "-";

  return new Intl.DateTimeFormat("ms-MY", {
    timeZone: ZON_MASA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(tarikh);
}


/*
  Format masa ringkas untuk label paksi carta operasi.
  Contoh: 13:25
*/
function formatMasaPendekCartaPentadbir(nilai) {
  if (!nilai) return "-";

  const masa = new Date(nilai);

  if (
    Number.isNaN(
      masa.getTime()
    )
  ) {
    return teks(nilai) || "-";
  }

  return new Intl.DateTimeFormat(
    "ms-MY",
    {
      timeZone: ZON_MASA,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }
  ).format(masa);
}

function formatTempoh(minit) {
  const jumlah = Number(minit);
  if (!Number.isFinite(jumlah)) return "-";

  const selamat = Math.max(0, jumlah);
  return `${Math.floor(selamat / 60)} jam ${Math.round(selamat % 60)} minit`;
}

function bahagiKumpulan(senarai, saiz) {
  const hasil = [];
  for (let i = 0; i < senarai.length; i += saiz) {
    hasil.push(senarai.slice(i, i + saiz));
  }
  return hasil;
}

function paparMesej(id, mesej, jenis = "warning") {
  const elemen = el(id);
  if (!elemen) return;

  elemen.className = jenis;
  elemen.innerHTML = mesej;
}

function denganHadMasa(promise, milisaat = MASA_TAMAT_PERMINTAAN) {
  let pemasa;

  const tamat = new Promise((_, reject) => {
    pemasa = setTimeout(() => {
      reject(new Error(
        "Sambungan ke Supabase mengambil masa terlalu lama. " +
        "Semak Project URL, Publishable Key dan status projek Supabase."
      ));
    }, milisaat);
  });

  return Promise.race([promise, tamat])
    .finally(() => clearTimeout(pemasa));
}

function pastikanSupabase() {
  if (!db?.auth || typeof db.auth.signInWithPassword !== "function") {
    throw new Error(
      window.SKPO_SUPABASE_ERROR ||
      "Sambungan Supabase belum tersedia. Semak api-config.js, " +
      "supabase-client.js dan susunan fail JavaScript."
    );
  }
}

async function panggilEdgeFunction(namaFungsi, body, masaTamat = 25000) {
  pastikanSupabase();

  const konfigurasi = window.SKPO_CONFIG || {};
  const projectUrlInput = teks(konfigurasi.SUPABASE_URL);
  const publishableKey = teks(
    konfigurasi.SUPABASE_PUBLISHABLE_KEY ||
    konfigurasi.SUPABASE_ANON_KEY
  );

  if (!projectUrlInput || !publishableKey) {
    throw new Error(
      "Project URL atau Publishable Key belum lengkap dalam js/api-config.js."
    );
  }

  let projectUrl;

  try {
    const url = new URL(projectUrlInput);

    if (
      url.protocol !== "https:" ||
      !url.hostname.endsWith(".supabase.co")
    ) {
      throw new Error("Domain Supabase tidak sah.");
    }

    projectUrl = url.origin;
  } catch (_) {
    throw new Error(
      "SUPABASE_URL tidak sah. Gunakan URL seperti https://PROJECT-ID.supabase.co"
    );
  }

  const { data: sesiData, error: sesiError } =
    await denganHadMasa(db.auth.getSession());

  if (sesiError) throw sesiError;

  const accessToken = sesiData?.session?.access_token;

  if (!accessToken) {
    throw new Error(
      "Sesi Pentadbir telah tamat. Sila log keluar dan login semula."
    );
  }

  const endpoint =
    `${projectUrl}/functions/v1/${encodeURIComponent(namaFungsi)}`;

  let response;

  try {
    response = await denganHadMasa(
      fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "apikey": publishableKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body || {})
      }),
      masaTamat
    );
  } catch (error) {
    throw new Error(
      "Edge Function tidak dapat dihubungi. Pastikan fungsi " +
      `\"${namaFungsi}\" telah dideploy dan kod CORS telah dimasukkan. ` +
      `Butiran: ${error?.message || "Ralat rangkaian"}`
    );
  }

  const responseText = await response.text();
  let data = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch (_) {
      data = { message: responseText };
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      `Edge Function gagal dengan status HTTP ${response.status}.`
    );
  }

  return data || {};
}

async function dapatkanProfil(userId, noBadan = "") {
  let hasil = await denganHadMasa(db.from("profiles").select("*").eq("id", userId).maybeSingle());
  if (!hasil.error && hasil.data) return hasil.data;

  const hasilAuth = await denganHadMasa(db.from("profiles").select("*").eq("auth_user_id", userId).maybeSingle());
  if (!hasilAuth.error && hasilAuth.data) return hasilAuth.data;

  const noBadanBersih = atas(noBadan);
  if (noBadanBersih) {
    const hasilNoBadan = await denganHadMasa(db.from("profiles").select("*").ilike("no_badan", noBadanBersih).maybeSingle());
    if (!hasilNoBadan.error && hasilNoBadan.data) return hasilNoBadan.data;
    if (hasilNoBadan.error) throw hasilNoBadan.error;
  }

  if (hasilAuth.error) throw hasilAuth.error;
  if (hasil.error) throw hasil.error;
  return null;
}

function semakPerananPentadbir(profil) {
  const peranan = atas(profil?.peranan);
  const noBadan = atas(profil?.no_badan);
  const email = teks(profil?.email).toLowerCase();

  // SUBTEK mempunyai akses modul ini. Pentadbir ialah super-admin dan
  // boleh membuka SUBTEK tanpa dialihkan semula ke admin.html.
  return ["SUBTEK", "PENTADBIR", "ADMIN"].includes(peranan) ||
    noBadan === NO_BADAN_ADMIN_UTAMA_F1 ||
    email === EMAIL_ADMIN_UTAMA_F1;
}


/* ================================================================
   TUKAR PASSWORD PENTADBIR
================================================================ */

function bukaTukarPasswordAdmin() {
  const modal = el("modalTukarPasswordAdmin");
  if (!modal) return;

  ["passwordSemasaAdmin", "passwordBaharuAdmin", "sahkanPasswordBaharuAdmin"]
    .forEach(id => {
      const input = el(id);
      if (input) input.value = "";
    });

  const status = el("statusTukarPasswordAdmin");
  if (status) {
    status.className = "status-box";
    status.innerHTML = "";
    status.style.display = "none";
  }

  modal.hidden = false;
  modal.style.display = "block";
  modal.classList.add("open");

  setTimeout(() => el("passwordSemasaAdmin")?.focus(), 50);
}

function tutupTukarPasswordAdmin() {
  const modal = el("modalTukarPasswordAdmin");
  if (!modal) return;

  modal.classList.remove("open");
  modal.hidden = true;
  modal.style.display = "none";
}

async function simpanPasswordAdmin() {
  const passwordSemasa = el("passwordSemasaAdmin")?.value || "";
  const passwordBaharu = el("passwordBaharuAdmin")?.value || "";
  const pengesahan = el("sahkanPasswordBaharuAdmin")?.value || "";
  const btn = el("btnSimpanPasswordAdmin");

  const mesej = (teksMesej, jenis = "warning") => {
    const ruang = el("statusTukarPasswordAdmin");
    if (!ruang) return;
    ruang.style.display = "block";
    ruang.className = jenis;
    ruang.textContent = teksMesej;
  };

  if (!passwordSemasa || !passwordBaharu || !pengesahan) {
    mesej("Sila lengkapkan semua ruangan password.", "warning");
    return;
  }

  if (passwordBaharu.length < 6) {
    mesej("Password baharu mestilah sekurang-kurangnya 6 aksara.", "warning");
    return;
  }

  if (passwordBaharu !== pengesahan) {
    mesej("Pengesahan password baharu tidak sepadan.", "error");
    return;
  }

  if (passwordSemasa === passwordBaharu) {
    mesej("Password baharu mestilah berbeza daripada password semasa.", "warning");
    return;
  }

  try {
    pastikanSupabase();
    if (btn) btn.disabled = true;
    mesej("Sedang mengesahkan password semasa...", "warning");

    const { data: userData, error: userError } =
      await denganHadMasa(db.auth.getUser());

    if (userError) throw userError;

    const email = teks(userData?.user?.email);
    if (!email) {
      throw new Error("E-mel akaun Pentadbir tidak dapat dikenal pasti.");
    }

    // Re-authentication: password semasa mesti betul sebelum perubahan dibuat.
    const { error: loginError } =
      await denganHadMasa(
        db.auth.signInWithPassword({
          email,
          password: passwordSemasa
        })
      );

    if (loginError) {
      mesej("Password semasa tidak betul.", "error");
      return;
    }

    mesej("Password disahkan. Sedang menukar password...", "warning");

    const { error: updateError } =
      await denganHadMasa(
        db.auth.updateUser({
          password: passwordBaharu
        })
      );

    if (updateError) throw updateError;

    mesej("Password Pentadbir berjaya ditukar.", "success");

    el("passwordSemasaAdmin").value = "";
    el("passwordBaharuAdmin").value = "";
    el("sahkanPasswordBaharuAdmin").value = "";

    setTimeout(() => tutupTukarPasswordAdmin(), 1400);

  } catch (error) {
    console.error("Tukar password Pentadbir gagal:", error);
    mesej(
      `Gagal menukar password: ${error?.message || "Ralat tidak diketahui."}`,
      "error"
    );
  } finally {
    if (btn) btn.disabled = false;
  }
}


/* ================================================================
   PERANTI KHAS PENTADBIR
================================================================ */

function dapatkanDeviceIdAdmin() {
  let id = localStorage.getItem(KUNCI_DEVICE_F1_ADMIN);

  if (!id) {
    const rawak =
      window.crypto?.randomUUID?.() ||
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, aksara => {
        const nombor = Math.random() * 16 | 0;
        const nilai = aksara === "x" ? nombor : (nombor & 3 | 8);
        return nilai.toString(16);
      });

    id = `F1-DEV-${rawak.toUpperCase()}`;
    localStorage.setItem(KUNCI_DEVICE_F1_ADMIN, id);
  }

  return id;
}

function jenisPerantiSemasaAdmin() {
  const ua = String(navigator.userAgent || "").toLowerCase();

  if (
    /android|iphone|ipad|ipod|mobile|windows phone/.test(ua)
  ) {
    return "TELEFON";
  }

  return "LAPTOP";
}

function paparanStatusPerantiKhasAdmin(aktif) {
  const ruang = el("statusPerantiKhasAdmin");
  const btnTambah = el("btnJadikanPerantiKhas");
  const btnBuang = el("btnBuangPerantiKhas");

  if (ruang) {
    ruang.innerHTML = aktif
      ? '<span class="badge badge-green">PERANTI KHAS AKTIF</span>'
      : '<span class="badge badge-gray">BUKAN PERANTI KHAS</span>';
  }

  if (btnTambah) btnTambah.disabled = aktif;
  if (btnBuang) btnBuang.disabled = !aktif;
}

async function muatPerantiKhasAdmin() {
  if (!adminLogin) return;

  const deviceId = dapatkanDeviceIdAdmin();
  const jenis = jenisPerantiSemasaAdmin();

  if (el("deviceIdAdmin")) {
    el("deviceIdAdmin").textContent = deviceId;
  }

  if (el("jenisPerantiAdmin")) {
    el("jenisPerantiAdmin").textContent = jenis;
  }

  try {
    const { data, error } = await denganHadMasa(
      db.from("device_whitelist")
        .select("device_id,akses_semua_petugas,catatan,aktif")
        .eq("akses_semua_petugas", true)
        .order("device_id", { ascending: true })
    );

    if (error) throw error;

    dataPerantiKhasAdmin = data || [];

    const perantiSemasa = dataPerantiKhasAdmin.find(
      item => atas(item.device_id) === atas(deviceId) && item.aktif !== false
    );

    paparanStatusPerantiKhasAdmin(Boolean(perantiSemasa));

    const tbody = el("tbodyPerantiKhasAdmin");
    if (tbody) {
      if (!dataPerantiKhasAdmin.length) {
        tbody.innerHTML =
          '<tr><td colspan="4" class="empty-row">Belum ada peranti khas didaftarkan.</td></tr>';
      } else {
        tbody.innerHTML = dataPerantiKhasAdmin.map((item, index) => {
          const catatan = teks(item.catatan) || "-";
          const jenisPeranti =
            /TELEFON/i.test(catatan) ? "TELEFON" :
            /LAPTOP/i.test(catatan) ? "LAPTOP" : "-";

          return `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(jenisPeranti)}</td>
              <td style="word-break:break-all">${escapeHtml(item.device_id || "-")}</td>
              <td>${escapeHtml(catatan)}</td>
            </tr>
          `;
        }).join("");
      }
    }

    const statusBox = el("mesejPerantiKhasAdmin");
    if (statusBox && !statusBox.innerHTML) {
      statusBox.style.display = "none";
    }

  } catch (error) {
    console.error("Gagal memuatkan peranti khas:", error);
    paparanStatusPerantiKhasAdmin(false);

    paparMesej(
      "mesejPerantiKhasAdmin",
      `Gagal menyemak peranti khas: ${escapeHtml(error.message)}. ` +
      "Pastikan kolum akses_semua_petugas dan catatan telah diwujudkan dalam device_whitelist.",
      "error"
    );
  }
}

async function salinDeviceIdAdmin() {
  const deviceId = dapatkanDeviceIdAdmin();

  try {
    await navigator.clipboard.writeText(deviceId);
    paparMesej(
      "mesejPerantiKhasAdmin",
      "Device ID berjaya disalin.",
      "success"
    );
  } catch (_) {
    window.prompt("Salin Device ID ini:", deviceId);
  }
}

async function jadikanPerantiKhasAdmin() {
  if (!adminLogin) return;

  const deviceId = dapatkanDeviceIdAdmin();
  const jenis = jenisPerantiSemasaAdmin();
  const btn = el("btnJadikanPerantiKhas");

  btn.disabled = true;
  btn.textContent = "SEDANG MENDAFTAR...";

  try {
    const { data: sediaAda, error: semakError } = await denganHadMasa(
      db.from("device_whitelist")
        .select("device_id,akses_semua_petugas,catatan,aktif")
        .eq("akses_semua_petugas", true)
    );

    if (semakError) throw semakError;

    const senaraiAktif = (sediaAda || []).filter(item => item.aktif !== false);
    const sudahAda = senaraiAktif.some(
      item => atas(item.device_id) === atas(deviceId)
    );

    if (!sudahAda && senaraiAktif.length >= HAD_PERANTI_KHAS_ADMIN) {
      throw new Error(
        "Had maksimum 2 peranti khas telah dicapai. Buang salah satu peranti khas dahulu."
      );
    }

    const jenisSudahAda = senaraiAktif.some(item => {
      if (atas(item.device_id) === atas(deviceId)) return false;
      const catatan = atas(item.catatan);
      return jenis === "TELEFON"
        ? catatan.includes("TELEFON")
        : catatan.includes("LAPTOP");
    });

    if (!sudahAda && jenisSudahAda) {
      throw new Error(
        `Satu peranti khas jenis ${jenis} sudah didaftarkan. ` +
        `Sistem hanya membenarkan 1 LAPTOP dan 1 TELEFON.`
      );
    }

    const payload = {
      device_id: deviceId,
      akses_semua_petugas: true,
      aktif: true,
      catatan: `PERANTI KHAS ADMINF1 - ${jenis}`
    };

    /*
      Cuba UPSERT terus ke device_whitelist.
      device_id perlu mempunyai UNIQUE constraint.
    */
    const { error } = await denganHadMasa(
      db.from("device_whitelist")
        .upsert(payload, { onConflict: "device_id" })
    );

    if (error) throw error;

    paparMesej(
      "mesejPerantiKhasAdmin",
      `<strong>PERANTI KHAS BERJAYA DIAKTIFKAN.</strong><br>` +
      `${escapeHtml(jenis)} ini kini boleh digunakan untuk login sebagai petugas lain.`,
      "success"
    );



  } catch (error) {
    console.error("Gagal menjadikan peranti khas:", error);

    const tambahan =
      /row-level security|permission denied|policy/i.test(error.message || "")
        ? " Semak RLS/policy INSERT dan UPDATE pada table device_whitelist."
        : /duplicate|unique|on conflict/i.test(error.message || "")
          ? " Pastikan device_whitelist.device_id mempunyai UNIQUE constraint."
          : "";

    paparMesej(
      "mesejPerantiKhasAdmin",
      `Gagal mendaftarkan peranti khas: ${escapeHtml(error.message)}${escapeHtml(tambahan)}`,
      "error"
    );

  } finally {
    btn.textContent = "JADIKAN PERANTI KHAS";
    const aktif = dataPerantiKhasAdmin.some(
      item => atas(item.device_id) === atas(deviceId) && item.aktif !== false
    );
    btn.disabled = aktif;
  }
}

async function buangPerantiKhasAdmin() {
  if (!adminLogin) return;

  const deviceId = dapatkanDeviceIdAdmin();

  if (!confirm(
    "Buang status PERANTI KHAS daripada peranti ini? " +
    "Selepas dibuang, peranti ini akan kembali tertakluk kepada kawalan device binding biasa."
  )) return;

  const btn = el("btnBuangPerantiKhas");
  btn.disabled = true;
  btn.textContent = "SEDANG MEMBUANG...";

  try {
    const { error } = await denganHadMasa(
      db.from("device_whitelist")
        .update({
          akses_semua_petugas: false,
          aktif: false
        })
        .eq("device_id", deviceId)
    );

    if (error) throw error;

    paparMesej(
      "mesejPerantiKhasAdmin",
      "Status peranti khas berjaya dibuang.",
      "success"
    );



  } catch (error) {
    console.error("Gagal membuang peranti khas:", error);

    paparMesej(
      "mesejPerantiKhasAdmin",
      `Gagal membuang peranti khas: ${escapeHtml(error.message)}`,
      "error"
    );

  } finally {
    btn.textContent = "BUANG PERANTI KHAS";
  }
}

/* ================================================================
   LOGIN DAN SESI
================================================================ */

async function login() {
  const noBadan = atas(el("noBadan")?.value);
  const password = teks(el("password")?.value);
  const butang = el("btnLogin");

  if (!noBadan || !password) {
    paparMesej(
      "loginStatus",
      "Sila masukkan No Badan dan kata laluan.",
      "error"
    );
    return;
  }

  butang.disabled = true;
  butang.textContent = "SEDANG MENYEMAK...";
  paparMesej("loginStatus", "Sedang menyemak...", "warning");

  try {
    pastikanSupabase();

    const { data, error } = await denganHadMasa(
      db.auth.signInWithPassword({
        email: emailDalaman(noBadan),
        password
      })
    );

    if (error) {
      const mesejSupabase = String(
        error.message || "Ralat pengesahan tidak diketahui."
      ).trim();

      throw new Error(
        "Login Supabase gagal: " + mesejSupabase
      );
    }

    if (!data?.user) {
      throw new Error(
        "Login Supabase tidak memulangkan maklumat pengguna."
      );
    }

    const profil = await dapatkanProfil(data.user.id, noBadan);

    if (!profil) {
      throw new Error(
        "Akaun Auth berjaya ditemui tetapi profil pengguna tidak wujud."
      );
    }

    if (profil.aktif === false) {
      throw new Error("Akaun SUBTEK telah dinyahaktifkan.");
    }

    const peranan = atas(profil.peranan);

if (!semakPerananPentadbir(profil)) {

  await db.auth.signOut().catch(() => {});

  if (peranan === "TSM") { window.location.replace("tsm.html"); return; }
  if (["PENTADBIR", "ADMIN"].includes(peranan)) { window.location.replace("admin.html"); return; }
  window.location.replace("index.html");
  return;
}

    adminLogin = {
      id: profil.id,
      authUserId: data.user.id,
      noBadan: profil.no_badan,
      pangkat: profil.pangkat || "",
      nama: profil.nama || "",
      peranan: atas(profil.peranan)
    };

    localStorage.setItem(KUNCI_ADMIN_F1, JSON.stringify(adminLogin));

    el("loginPage")?.classList.add("hidden");
    if(el("loginPage")) el("loginPage").style.display="none";
    el("dashboard")?.classList.remove("hidden");
    el("dashboard")?.classList.add("admin-authenticated");
    if(el("dashboard")) el("dashboard").style.display="block";
    el("adminName").textContent = [
      adminLogin.pangkat,
      adminLogin.nama,
      `(${adminLogin.noBadan})`
    ].filter(Boolean).join(" ");

    paparMesej("loginStatus", "", "success");
    await muatData(true);

  } catch (error) {
    console.error("Login SUBTEK gagal:", error);
    await db?.auth?.signOut().catch(() => {});

    paparMesej(
      "loginStatus",
      escapeHtml(error.message || "Login SUBTEK gagal."),
      "error"
    );
  } finally {
    butang.disabled = false;
    butang.textContent = "LOGIN SUBTEK";
  }
}

async function pulihkanSesiPentadbir() {
  try {
    pastikanSupabase();

    const { data, error } = await denganHadMasa(db.auth.getSession());
    if (error || !data?.session?.user) return;

    const profil = await dapatkanProfil(data.session.user.id);
    if (!profil || profil.aktif === false) {

  await db.auth.signOut().catch(() => {});
  window.location.replace("index.html");
  return;

}

const peranan = atas(profil.peranan);

if (!semakPerananPentadbir(profil)) {

  await db.auth.signOut().catch(() => {});

  if (peranan === "TSM") { window.location.replace("tsm.html"); return; }
  if (["PENTADBIR", "ADMIN"].includes(peranan)) { window.location.replace("admin.html"); return; }
  window.location.replace("index.html");
  return;

}

    adminLogin = {
      id: profil.id,
      authUserId: data.session.user.id,
      noBadan: profil.no_badan,
      pangkat: profil.pangkat || "",
      nama: profil.nama || "",
      peranan: atas(profil.peranan)
    };

    el("loginPage")?.classList.add("hidden");
    if(el("loginPage")) el("loginPage").style.display="none";
    el("dashboard")?.classList.remove("hidden");
    el("dashboard")?.classList.add("admin-authenticated");
    if(el("dashboard")) el("dashboard").style.display="block";
    el("adminName").textContent = [
      adminLogin.pangkat,
      adminLogin.nama,
      `(${adminLogin.noBadan})`
    ].filter(Boolean).join(" ");

    await muatData(true);

  } catch (error) {
    console.error("Pemulihan sesi SUBTEK gagal:", error);
    paparMesej("loginStatus", escapeHtml(error.message), "error");
  }
}

async function logout() {
  /* FIX 007 — LOG KELUAR PENTADBIR
     Tutup dashboard serta-merta dan pulangkan paparan ke login.
     class admin-authenticated WAJIB dibuang supaya CSS tidak terus
     memaksa dashboard dipaparkan selepas logout.
  */
  const dashboard = el("dashboard");
  const loginPage = el("loginPage");

  adminLogin = null;
  dataDashboard = [];
  dataPaparan = [];
  localStorage.removeItem(KUNCI_ADMIN_F1);

  if (dashboard) {
    dashboard.classList.remove("admin-authenticated");
    dashboard.classList.add("hidden");
    dashboard.style.display = "none";
  }

  if (loginPage) {
    loginPage.classList.remove("hidden");
    loginPage.style.display = "flex";
  }

  if (el("noBadan")) el("noBadan").value = "";
  if (el("password")) el("password").value = "";
  if (el("loginStatus")) {
    el("loginStatus").innerHTML = "";
    el("loginStatus").className = "";
  }

  /* Tamatkan sesi Supabase selepas UI dikunci. */
  try {
    if (db?.auth?.signOut) {
      await denganHadMasa(db.auth.signOut(), 8000);
    }
  } catch (error) {
    console.warn("Log keluar Supabase:", error);
  } finally {
    /* Pastikan keadaan akhir sentiasa LOGIN walaupun signOut gagal/rangkaian perlahan. */
    if (dashboard) {
      dashboard.classList.remove("admin-authenticated");
      dashboard.classList.add("hidden");
      dashboard.style.display = "none";
    }
    if (loginPage) {
      loginPage.classList.remove("hidden");
      loginPage.style.display = "flex";
    }
    el("noBadan")?.focus();
  }
}

/* ================================================================
   DATA DASHBOARD
================================================================ */

async function muatData(kemasKiniPenapis = false) {
  if (!adminLogin) return;

  const tarikh = el("tarikh").value || hariIniMalaysia();
  el("tarikh").value = tarikh;
  paparMesej("status", "Sedang mendapatkan data...", "warning");

  try {
    const penugasanRes = await denganHadMasa(
      db.from("penugasan")
        .select("*")
        .eq("tarikh", tarikh)
        .order("created_at", { ascending: true })
    );

    if (penugasanRes.error) throw penugasanRes.error;

    const senaraiTugas = penugasanRes.data || [];
    const petugasIds = [...new Set(
      senaraiTugas
        .map(item => item.petugas_id || item.profile_id)
        .filter(Boolean)
    )];

    let profil = [];
    if (petugasIds.length) {
      const profilRes = await denganHadMasa(
        db.from("profiles").select("*").in("id", petugasIds)
      );
      if (profilRes.error) throw profilRes.error;
      profil = profilRes.data || [];
    }

    const [checkinRes, checkoutRes, deviceRes] = await Promise.all([
      denganHadMasa(
        db.from("checkin").select("*").eq("tarikh", tarikh)
      ),
      denganHadMasa(
        db.from("checkout").select("*").eq("tarikh", tarikh)
      ),
      denganHadMasa(
        db.rpc("senarai_device_petugas", {
          p_petugas_ids: petugasIds
        })
      )
    ]);

    if (checkinRes.error) throw checkinRes.error;
    if (checkoutRes.error) throw checkoutRes.error;
    if (deviceRes.error) {
      throw new Error(
        `Status Device gagal dimuatkan: ${deviceRes.error.message}. Jalankan semula device-binding.sql.`
      );
    }

    const profilMap = new Map(profil.map(item => [item.id, item]));
    const checkinMap = new Map(
      (checkinRes.data || []).map(item => [item.penugasan_id, item])
    );
    const checkoutMap = new Map(
      (checkoutRes.data || []).map(item => [item.penugasan_id, item])
    );
    const deviceMap = new Map(
      (deviceRes.data || []).map(item => [item.profile_id, item])
    );

    dataDashboard = senaraiTugas.map(item => {
      const petugasId = item.petugas_id || item.profile_id;
      const pengguna = profilMap.get(petugasId) || {};
      const checkin = checkinMap.get(item.id) || null;
      const checkout = checkoutMap.get(item.id) || null;
      const ikatanDevice = deviceMap.get(petugasId) || null;
      const statusTugas = atas(item.status);

      /*
        Paparan Pentadbir:
        - CUTI SAKIT dan KECEMASAN dipaparkan sebagai TIDAK HADIR.
        - Nilai sebenar dalam penugasan.status kekal dan tidak diubah.
      */
      const statusKehadiran =
        statusTugas === "DIGANTI"
          ? "DIGANTI"
          : (
              statusTugas === "DITOLAK" ||
              statusTugas === "CUTI SAKIT" ||
              statusTugas === "KECEMASAN"
            )
            ? "TIDAK HADIR"
            : checkin
              ? (
                  atas(checkin.status) === "DITOLAK"
                    ? "TIDAK HADIR"
                    : atas(checkin.status) || "MENUNGGU"
                )
              : "BELUM HADIR";

      return {
        idPenugasan: item.id,
        petugasId,
        noBadan: pengguna.no_badan || "-",
        pangkat: pengguna.pangkat || "-",
        nama: pengguna.nama || "-",
        telefon: pengguna.telefon || "-",
        bahagian:
          pengguna.bahagian ||
          pengguna.balai ||
          pengguna.cawangan ||
          pengguna.unit ||
          pengguna.bahagian_unit ||
          "-",
        deviceId: ikatanDevice?.device_id || "",
        deviceDiikatPada: ikatanDevice?.diikat_pada || null,
        deviceKaliTerakhir: ikatanDevice?.kali_terakhir || null,
        callSign: item.call_sign || "-",
        jenisTugas: item.jenis_tugas || "-",
        tempatTugas: item.tempat_tugas || item.lokasi || "-",
        pemegangSet: nilaiBoolean(item.pemegang_set),
        penyelia: nilaiBoolean(item.penyelia),
        statusKehadiran,
        statusPenugasanAsal: statusTugas,
        jenisKetidakhadiran:
          (
            statusTugas === "DITOLAK" ||
            statusTugas === "CUTI SAKIT" ||
            statusTugas === "KECEMASAN"
          )
            ? statusTugas
            : "",
        masaCheckin: checkin?.masa_checkin || null,
        masaCheckout: checkout?.masa_checkout || null,
        tempohMinit: checkout?.tempoh_minit,
        checkin,
        checkout
      };
    });

    if (kemasKiniPenapis) binaPilihanPenapis();
    papar();
    paparMesej(
      "status",
      `${dataDashboard.length} rekod berjaya dimuatkan.`,
      "success"
    );
  } catch (error) {
    console.error("Data dashboard gagal dimuatkan:", error);
    dataDashboard = [];
    papar();
    paparMesej(
      "status",
      `Ralat mendapatkan data: ${escapeHtml(error.message)}`,
      "error"
    );
  }
}

function binaPilihanPenapis() {
  isiPilihan(
    "jenisTugas",
    "SEMUA JENIS TUGAS",
    dataDashboard.map(item => item.jenisTugas)
  );

  isiPilihan(
    "tempatTugas",
    "SEMUA TEMPAT TUGAS",
    dataDashboard.map(item => item.tempatTugas)
  );

  isiPilihan(
    "pangkatPenapis",
    "SEMUA PANGKAT",
    dataDashboard.map(item => item.pangkat)
  );
}

function isiPilihan(id, labelSemua, nilai) {
  const pilih = el(id);
  const nilaiSemasa = pilih.value;
  const unik = [...new Set(nilai.filter(item => item && item !== "-"))]
    .sort((a, b) => a.localeCompare(b, "ms"));

  pilih.innerHTML = `<option value="">${escapeHtml(labelSemua)}</option>` +
    unik.map(item => (
      `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`
    )).join("");

  if (unik.includes(nilaiSemasa)) pilih.value = nilaiSemasa;
}

function papar() {
  const jenis = atas(el("jenisTugas")?.value);
  const tempat = atas(el("tempatTugas")?.value);
  const status = atas(el("statusPenapis")?.value);
  const pangkat = atas(el("pangkatPenapis")?.value);
  const carian = atas(el("carian")?.value);

  dataPaparan = dataDashboard.filter(item => {
    if (jenis && atas(item.jenisTugas) !== jenis) return false;
    if (tempat && atas(item.tempatTugas) !== tempat) return false;
    if (pangkat && atas(item.pangkat) !== pangkat) return false;
     
    if (status) {
      if (status === "CHECK-OUT" && !item.checkout) return false;
      if (status !== "CHECK-OUT" && item.statusKehadiran !== status) return false;
    }

    if (carian) {
      const gabung = atas([
        item.noBadan,
        item.pangkat,
        item.nama,
        item.telefon,
        item.callSign,
        item.jenisTugas,
        item.tempatTugas,
        item.pemegangSet ? "YA" : "TIDAK"
      ].join(" "));

      if (!gabung.includes(carian)) return false;
    }

    return true;
  });

  paparJadual();
  paparStatistik();
}

function paparJadual() {
  const tbody = el("tbody");

  if (!dataPaparan.length) {
    tbody.innerHTML = (
      '<tr><td colspan="15" class="empty-row">' +
      "Tiada rekod yang sepadan.</td></tr>"
    );
    return;
  }

  tbody.innerHTML = dataPaparan.map((item, index) => {
    const kelas = kelasBadge(item.statusKehadiran);
    const keadaan = item.checkout
      ? "SELESAI TUGAS"
      : item.statusKehadiran === "HADIR"
        ? "MASIH BERTUGAS"
        : "-";

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.noBadan)}</td>
        <td>
          <strong>${escapeHtml(item.pangkat)}</strong><br>
          ${escapeHtml(item.nama)}
        </td>
        <td>${escapeHtml(item.telefon)}</td>
        <td>${escapeHtml(item.callSign)}</td>
        <td>${escapeHtml(item.jenisTugas)}</td>
        <td>${escapeHtml(item.tempatTugas)}</td>
        <td>
          <span class="badge ${item.pemegangSet ? "badge-green" : "badge-gray"}">
            ${item.pemegangSet ? "YA" : "TIDAK"}
          </span>
        </td>
        <td>${escapeHtml(formatTarikhMasa(item.masaCheckin))}</td>
        <td><span class="badge ${kelas}">${escapeHtml(item.statusKehadiran)}</span></td>
        <td>${escapeHtml(formatTarikhMasa(item.masaCheckout))}</td>
        <td>${escapeHtml(formatTempoh(item.tempohMinit))}</td>
        <td>${escapeHtml(keadaan)}</td>
        <td>
          <span class="badge ${item.deviceId ? "badge-green" : "badge-gray"}">
            ${item.deviceId ? "BERDAFTAR" : "TIADA"}
          </span>
        </td>
        <td>
          <button
            class="reset-device"
            type="button"
            onclick="bukaModalResetDevice('${escapeHtml(item.petugasId)}')"
          >
            RESET DEVICE
          </button>
          <button
            class="reset-device"
            type="button"
            style="margin-top:6px;background:#9f2d2d;"
            onclick="padamPenugasanDashboard(
              '${escapeHtml(item.idPenugasan)}',
              '${escapeHtml(item.noBadan)}',
              '${escapeHtml(item.nama)}'
            )"
          >
            PADAM
          </button>
        </td>
      </tr>
    `;
  }).join("");
}


/* ================================================================
   FIX 20261003 — PADAM PENUGASAN TERUS DARI DASHBOARD
================================================================ */
async function padamPenugasanDashboard(idPenugasan, noBadan, nama) {
  const id = teks(idPenugasan);

  if (!id) {
    alert("ID penugasan tidak ditemui.");
    return;
  }

  const rekod = dataDashboard.find(
    item => teks(item.idPenugasan) === id
  );

  if (!rekod) {
    alert("Rekod penugasan tidak ditemui dalam Dashboard.");
    return;
  }

  /*
    Lindungi rekod kehadiran yang telah bermula.
    Petugas yang sudah Check-In / Check-Out tidak boleh dipadam
    terus kerana rekod kehadiran berkait dengan penugasan ini.
  */
  if (rekod.checkin || rekod.checkout) {
    alert(
      "Rekod ini tidak boleh dipadam kerana petugas sudah mempunyai " +
      "rekod Check-In atau Check-Out."
    );
    return;
  }

  const label = [
    atas(noBadan || rekod.noBadan),
    teks(nama || rekod.nama)
  ].filter(Boolean).join(" — ");

  if (!confirm(
    `PADAM PENUGASAN INI?\n\n${label}\n` +
    `${rekod.jenisTugas || "-"}\n${rekod.tempatTugas || "-"}\n\n` +
    "Tindakan ini akan membuang rekod daripada table penugasan Supabase. " +
    "Profil pengguna TIDAK akan dipadam."
  )) {
    return;
  }

  try {
    paparMesej(
      "status",
      `Sedang memadam penugasan ${escapeHtml(label)}...`,
      "warning"
    );

    const { data, error } = await denganHadMasa(
      db.from("penugasan")
        .delete()
        .eq("id", id)
        .select("id")
    );

    if (error) {
      const mesej = String(error.message || "");

      if (/row-level security|permission denied|policy/i.test(mesej)) {
        throw new Error(
          "Supabase menghalang DELETE pada table penugasan. " +
          "Benarkan polisi DELETE untuk akaun Pentadbir."
        );
      }

      throw error;
    }

    if (!Array.isArray(data) || !data.length) {
      throw new Error(
        "Tiada rekod dipadam. Semak polisi DELETE (RLS) table penugasan."
      );
    }

    await muatData(true);

    paparMesej(
      "status",
      `${escapeHtml(label)} berjaya dibuang daripada jadual penugasan.`,
      "success"
    );

  } catch (error) {
    console.error("Padam penugasan Dashboard gagal:", error);

    paparMesej(
      "status",
      `Gagal memadam penugasan: ${escapeHtml(error.message || "Ralat tidak diketahui.")}`,
      "error"
    );
  }
}


function kelasBadge(status) {
  if (status === "HADIR") return "badge-green";
  if (status === "MENUNGGU") return "badge-yellow";

  if (
    status === "DITOLAK" ||
    status === "DIGANTI" ||
    status === "TIDAK HADIR"
  ) {
    return "badge-red";
  }

  return "badge-gray";
}

function paparStatistik() {
  const jumlah = dataPaparan.length;
  const hadir = dataPaparan.filter(item => item.statusKehadiran === "HADIR").length;
  const menunggu = dataPaparan.filter(item => item.statusKehadiran === "MENUNGGU").length;
  const ditolak = dataPaparan.filter(item => item.statusKehadiran === "TIDAK HADIR").length;
  const checkout = dataPaparan.filter(item => Boolean(item.checkout)).length;
  const bertugas = dataPaparan.filter(item => item.statusKehadiran === "HADIR" && !item.checkout).length;
  const belumHadir = dataPaparan.filter(item => item.statusKehadiran === "BELUM HADIR").length;
  const pemegangSet = dataPaparan.filter(item => item.pemegangSet).length;
  const peratus = jumlah ? Math.round((hadir / jumlah) * 100) : 0;

  el("jumlah").textContent = jumlah;
  el("hadir").textContent = hadir;
  el("menunggu").textContent = menunggu;
  el("ditolak").textContent = ditolak;
  el("checkout").textContent = checkout;
  el("bertugas").textContent = bertugas;
  el("belumHadir").textContent = belumHadir;
  el("jumlahPemegangSet").textContent = pemegangSet;
  el("progressPercent").textContent = `${peratus}%`;
  el("progressFill").style.width = `${peratus}%`;
  el("progressText").textContent = `${hadir} / ${jumlah} Petugas Hadir`;
  el("progressTrack").setAttribute("aria-valuenow", String(peratus));
}

/* ================================================================
   EXPORT
================================================================ */

function muatLaporanPdf() {
  window.print();
}

function exportExcel() {
  if (!dataPaparan.length) {
    alert("Tiada data untuk dieksport.");
    return;
  }

  const tajuk = [
    "BIL", "NO BADAN", "PANGKAT", "NAMA", "NO TELEFON", "CALL SIGN",
    "JENIS TUGAS", "TEMPAT TUGAS", "PEMEGANG SET",
    "CHECK-IN", "STATUS", "CHECK-OUT", "TEMPOH"
  ];

  const baris = dataPaparan.map((item, index) => [
    index + 1,
    item.noBadan,
    item.pangkat,
    item.nama,
    item.telefon,
    item.callSign,
    item.jenisTugas,
    item.tempatTugas,
    item.pemegangSet ? "YA" : "TIDAK",
    formatTarikhMasa(item.masaCheckin),
    item.statusKehadiran,
    formatTarikhMasa(item.masaCheckout),
    formatTempoh(item.tempohMinit)
  ]);

  const csv = [tajuk, ...baris]
    .map(item => item.map(csvSelamat).join(","))
    .join("\r\n");

  const fail = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8"
  });

  const pautan = document.createElement("a");
  pautan.href = URL.createObjectURL(fail);
  pautan.download = `SKPO_F1_${el("tarikh").value || hariIniMalaysia()}.csv`;
  pautan.click();
  URL.revokeObjectURL(pautan.href);
}

function csvSelamat(nilai) {
  const teksNilai = String(nilai ?? "").replace(/"/g, '""');
  return `"${teksNilai}"`;
}

/* ================================================================
   DAFTAR PENGGUNA
================================================================ */

async function daftarPenggunaBaharu() {
  const noBadan = atas(el("penggunaNoBadan").value);
  const pangkat = atas(el("penggunaPangkat").value);
  const nama = atas(el("penggunaNama").value);
  const peranan = atas(el("penggunaPeranan").value);
  const telefon = teks(el("penggunaTelefon").value);
  const bahagian = atas(el("penggunaBahagian").value);
  const daerah = atas(el("penggunaDaerah").value);
  const password = el("penggunaPassword").value;
  const passwordSah = el("penggunaPasswordSah").value;
  const butang = el("btnDaftarPengguna");

  if (!noBadan || !pangkat || !nama || !peranan || !password) {
    paparMesej("statusDaftarPengguna", "Sila lengkapkan semua ruangan wajib.", "error");
    return;
  }

  if (password.length < 8) {
    paparMesej("statusDaftarPengguna", "Kata laluan mestilah sekurang-kurangnya 8 aksara.", "error");
    return;
  }

  if (password !== passwordSah) {
    paparMesej("statusDaftarPengguna", "Pengesahan kata laluan tidak sepadan.", "error");
    return;
  }

  butang.disabled = true;
  butang.textContent = "SEDANG MENDAFTAR...";
  paparMesej("statusDaftarPengguna", "Sedang mencipta akaun...", "warning");

  try {
    const data = await panggilEdgeFunction(
      "tambah-petugas",
      {
        no_badan: noBadan,
        noBadan,
        pangkat,
        nama,
        peranan,
        telefon,
        bahagian,
        daerah,
        password
      }
    );

    if (data?.status === false || data?.success === false) {
      throw new Error(data.mesej || data.message || "Pendaftaran pengguna gagal.");
    }

    paparMesej("statusDaftarPengguna", "Pengguna baharu berjaya didaftarkan.", "success");

    [
      "penggunaNoBadan", "penggunaPangkat", "penggunaNama",
      "penggunaTelefon", "penggunaBahagian", "penggunaDaerah",
      "penggunaPassword", "penggunaPasswordSah"
    ].forEach(id => { el(id).value = ""; });

    el("penggunaPeranan").value = "PETUGAS";
  } catch (error) {
    console.error("Pendaftaran pengguna gagal:", error);
    paparMesej(
      "statusDaftarPengguna",
      `Pendaftaran gagal: ${escapeHtml(error.message)}`,
      "error"
    );
  } finally {
    butang.disabled = false;
    butang.textContent = "DAFTAR PENGGUNA";
  }
}

/* ================================================================
   IMPORT PENGGUNA CSV
================================================================ */

function binaRekodImportPenggunaCsv(barisCsv) {
  if (barisCsv.length < 2) {
    throw new Error("Fail CSV tidak mempunyai rekod pengguna.");
  }

  const alias = {
    NO_BADAN: ["NO_BADAN", "NOBADAN", "NO_POLIS", "BODY_NO"],
    PANGKAT: ["PANGKAT", "RANK"],
    NAMA: ["NAMA", "NAMA_PENUH", "NAME"],
    TELEFON: ["TELEFON", "NO_TELEFON", "NO_TEL", "PHONE"],
    PERANAN: ["PERANAN", "ROLE"],
    BAHAGIAN: ["BAHAGIAN", "BALAI", "CAWANGAN", "BAHAGIAN_BALAI_CAWANGAN"],
    DAERAH: ["DAERAH", "DISTRICT"],
    KATA_LALUAN: ["KATA_LALUAN", "KATALALUAN", "PASSWORD"],
    AKTIF: ["AKTIF", "ACTIVE"]
  };

  const header = barisCsv[0].map(normalisasiHeaderCsv);
  const indeks = {};
  Object.entries(alias).forEach(([nama, pilihan]) => {
    indeks[nama] = header.findIndex(item => pilihan.includes(item));
  });

  const wajib = ["NO_BADAN", "PANGKAT", "NAMA", "KATA_LALUAN"];
  const tiada = wajib.filter(nama => indeks[nama] < 0);
  if (tiada.length) {
    throw new Error(`Kolum wajib tidak dijumpai: ${tiada.join(", ")}. Gunakan templat pengguna yang disediakan.`);
  }

  const perananSah = ["PETUGAS", "PENYELIA", "URUSETIA", "PENTADBIR", "TSM", "PUSAT_KAWALAN"];
  const ambil = (baris, nama) => indeks[nama] >= 0 ? teks(baris[indeks[nama]]) : "";

  const rekod = barisCsv.slice(1).map((baris, kedudukan) => {
    const nomborBaris = kedudukan + 2;
    const ralat = [];
    const noBadan = atas(ambil(baris, "NO_BADAN"));
    const pangkat = atas(ambil(baris, "PANGKAT"));
    const nama = atas(ambil(baris, "NAMA"));
    const peranan = atas(ambil(baris, "PERANAN") || "PETUGAS");
    const password = ambil(baris, "KATA_LALUAN");
    const aktif = booleanCsv(ambil(baris, "AKTIF"), true);

    if (!noBadan) ralat.push("No Badan kosong");
    if (noBadan && !/^[A-Z0-9_-]+$/.test(noBadan)) {
      ralat.push("No Badan hanya boleh mengandungi huruf, nombor, _ atau -");
    }
    if (!pangkat) ralat.push("Pangkat kosong");
    if (!nama) ralat.push("Nama kosong");
    if (!perananSah.includes(peranan)) ralat.push("Peranan tidak sah");
    if (password.length < 8) ralat.push("Kata laluan kurang daripada 8 aksara");
    if (aktif === null) ralat.push("Aktif mesti YA atau TIDAK");

    return {
      baris: nomborBaris,
      ralat,
      sediaAda: false,
      diimport: false,
      data: {
        baris: nomborBaris,
        no_badan: noBadan,
        pangkat,
        nama,
        telefon: ambil(baris, "TELEFON") || null,
        peranan,
        bahagian: atas(ambil(baris, "BAHAGIAN")) || null,
        daerah: atas(ambil(baris, "DAERAH")) || null,
        password,
        aktif: aktif === true
      }
    };
  });

  const kekerapan = new Map();
  rekod.forEach(item => {
    if (!item.data.no_badan) return;
    kekerapan.set(item.data.no_badan, (kekerapan.get(item.data.no_badan) || 0) + 1);
  });
  rekod.forEach(item => {
    if (kekerapan.get(item.data.no_badan) > 1) {
      item.ralat.push("No Badan berganda dalam fail");
    }
  });

  return rekod;
}

async function semakPenggunaSediaAda(rekod) {
  const noBadan = [...new Set(
    rekod.filter(item => item.ralat.length === 0).map(item => item.data.no_badan)
  )];
  const sediaAda = new Set();

  for (const kumpulan of bahagiKumpulan(noBadan, 100)) {
    const { data, error } = await denganHadMasa(
      db.from("profiles").select("no_badan").in("no_badan", kumpulan)
    );
    if (error) throw error;
    (data || []).forEach(item => sediaAda.add(atas(item.no_badan)));
  }

  rekod.forEach(item => {
    item.sediaAda = sediaAda.has(item.data.no_badan);
    if (item.sediaAda) item.data.password = "";
  });
}

function paparPratontonImportPengguna() {
  const jumlah = rekodImportPengguna.length;
  const baharu = rekodImportPengguna.filter(
    item => item.ralat.length === 0 && !item.sediaAda && !item.diimport
  ).length;
  const siap = rekodImportPengguna.filter(item => item.sediaAda || item.diimport).length;
  const gagal = rekodImportPengguna.filter(item => item.ralat.length > 0).length;

  el("importPenggunaJumlah").textContent = String(jumlah);
  el("importPenggunaBaharu").textContent = String(baharu);
  el("importPenggunaSediaAda").textContent = String(siap);
  el("importPenggunaGagal").textContent = String(gagal);
  el("btnImportPengguna").disabled = baharu === 0 || importPenggunaSedangBerjalan;
  el("ruangPratontonImportPengguna").hidden = jumlah === 0;

  el("tbodyImportPengguna").innerHTML = rekodImportPengguna
    .slice(0, 100)
    .map(item => {
      const d = item.data;
      let semakan = '<span class="badge badge-green">SAH — BAHARU</span>';
      if (item.diimport) semakan = '<span class="badge badge-green">BERJAYA DIIMPORT</span>';
      else if (item.sediaAda) semakan = '<span class="badge badge-gray">SEDIA ADA — DILANGKAU</span>';
      else if (item.ralat.length) {
        semakan = `<span class="badge badge-red" title="${escapeHtml(item.ralat.join("; "))}">RALAT: ${escapeHtml(item.ralat.join("; "))}</span>`;
      }

      return `<tr>
        <td>${item.baris}</td>
        <td>${escapeHtml(d.no_badan || "-")}</td>
        <td>${escapeHtml(d.pangkat || "-")}</td>
        <td>${escapeHtml(d.nama || "-")}</td>
        <td>${escapeHtml(d.telefon || "-")}</td>
        <td>${escapeHtml(d.peranan || "-")}</td>
        <td>${escapeHtml(d.bahagian || "-")}</td>
        <td>${escapeHtml(d.daerah || "-")}</td>
        <td>${d.aktif ? "YA" : "TIDAK"}</td>
        <td>${semakan}</td>
      </tr>`;
    })
    .join("");

  el("notaPratontonImportPengguna").textContent = jumlah > 100
    ? `Memaparkan 100 daripada ${jumlah} baris. Kata laluan disembunyikan.`
    : `Memaparkan semua ${jumlah} baris. Kata laluan disembunyikan.`;
}

async function bacaFailPenggunaCsv(event) {
  const fail = event?.target?.files?.[0];
  if (!fail) return;

  rekodImportPengguna = [];
  el("importPenggunaFail").textContent = fail.name;
  el("btnImportPengguna").disabled = true;
  paparMesej("statusImportPengguna", "Sedang membaca dan menyemak pengguna...", "warning");

  try {
    if (!/\.csv$/i.test(fail.name)) throw new Error("Sila pilih fail berformat .csv.");
    if (fail.size > 5 * 1024 * 1024) throw new Error("Saiz fail melebihi had 5 MB.");

    rekodImportPengguna = binaRekodImportPenggunaCsv(parseCsv(await fail.text()));
    await semakPenggunaSediaAda(rekodImportPengguna);
    paparPratontonImportPengguna();

    const baharu = rekodImportPengguna.filter(
      item => item.ralat.length === 0 && !item.sediaAda
    ).length;
    const sediaAda = rekodImportPengguna.filter(item => item.sediaAda).length;
    const gagal = rekodImportPengguna.filter(item => item.ralat.length > 0).length;

    paparMesej(
      "statusImportPengguna",
      `${baharu} pengguna baharu sedia diimport. ${sediaAda} sedia ada akan dilangkau. ${gagal} baris bermasalah.`,
      gagal ? "warning" : "success"
    );
  } catch (error) {
    console.error("Bacaan CSV pengguna gagal:", error);
    rekodImportPengguna = [];
    paparPratontonImportPengguna();
    paparMesej("statusImportPengguna", escapeHtml(error.message), "error");
  }
}

function kosongkanImportPengguna() {
  if (importPenggunaSedangBerjalan) return;
  rekodImportPengguna = [];
  el("failPenggunaCsv").value = "";
  el("importPenggunaFail").textContent = "-";
  el("statusImportPengguna").className = "status-box";
  el("statusImportPengguna").innerHTML = "";
  paparPratontonImportPengguna();
}

function muatTurunTemplatPengguna() {
  const kandungan = [
    "NO_BADAN,PANGKAT,NAMA,NO_TELEFON,PERANAN,BAHAGIAN,DAERAH,KATA_LALUAN,AKTIF",
    "197898,L/KPL,NORHISHAM BIN CHE MAT,0193151615,PETUGAS,BKDNKA,SEPANG,Skpo@A7m2#1,YA",
    "199898,SJN,AHMAD BIN ALI,0123456789,PENYELIA,CAWANGAN KHAS,SEPANG,Skpo@B9n4#2,YA",
    "PUSATF1,INSP,PUSAT KAWALAN OP LITAR,0123456789,PUSAT_KAWALAN,IPK,SELANGOR,Skpo@F1PK2026#1,YA"
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", kandungan], { type: "text/csv;charset=utf-8" });
  const pautan = document.createElement("a");
  pautan.href = URL.createObjectURL(blob);
  pautan.download = "TEMPLAT_PENGGUNA_SKPO_F1.csv";
  document.body.appendChild(pautan);
  pautan.click();
  const alamat = pautan.href;
  pautan.remove();
  setTimeout(() => URL.revokeObjectURL(alamat), 1000);
}

async function importPenggunaCsv() {
  if (importPenggunaSedangBerjalan) return;

  const senarai = rekodImportPengguna.filter(
    item => item.ralat.length === 0 && !item.sediaAda && !item.diimport
  );

  if (!senarai.length) {
    paparMesej(
      "statusImportPengguna",
      "Tiada pengguna baharu yang sah untuk diimport.",
      "error"
    );
    return;
  }

  if (!confirm(
    `Import ${senarai.length} pengguna baharu? ` +
    "Akaun Authentication dan profil pengguna akan dicipta di Supabase."
  )) return;

  importPenggunaSedangBerjalan = true;

  const butang = el("btnImportPengguna");
  butang.disabled = true;

  let diproses = 0;
  let berjaya = 0;
  let sediaAda = 0;
  let gagal = 0;

  const semuaKeputusan = [];

  try {
    /*
      PENTING:
      Pendaftaran manual dalam sistem menggunakan Edge Function
      "tambah-petugas". Import CSV kini menggunakan fungsi yang sama
      supaya Auth user + public.profiles dicipta dengan aliran yang
      sama dan tidak memerlukan Edge Function "import-pengguna".
    */

    for (const item of senarai) {
      const d = item.data;

      butang.textContent =
        `MENGIMPORT ${diproses + 1} / ${senarai.length}...`;

      paparMesej(
        "statusImportPengguna",
        `Sedang mencipta pengguna ${diproses + 1} daripada ${senarai.length}: ` +
        `${escapeHtml(d.no_badan)} — ${escapeHtml(d.nama)}. ` +
        "Jangan tutup halaman ini.",
        "warning"
      );

      try {
        const hasil = await panggilEdgeFunction(
          "tambah-petugas",
          {
            no_badan: d.no_badan,
            noBadan: d.no_badan,
            pangkat: d.pangkat,
            nama: d.nama,
            telefon: d.telefon || "",
            peranan: d.peranan || "PETUGAS",
            bahagian: d.bahagian || "",
            daerah: d.daerah || "",
            password: d.password,
            aktif: d.aktif !== false
          },
          60000
        );

        if (hasil?.status === false || hasil?.success === false) {
          throw new Error(
            hasil?.mesej ||
            hasil?.message ||
            "Pendaftaran pengguna gagal."
          );
        }

        item.diimport = true;
        item.data.password = "";
        berjaya += 1;

        semuaKeputusan.push({
          baris: item.baris,
          no_badan: d.no_badan,
          status: "BERJAYA",
          mesej: "Pengguna berjaya didaftarkan."
        });

      } catch (error) {
        const mesejAsal = String(
          error?.message || "Pendaftaran pengguna gagal."
        );

        /*
          Jika profil sudah wujud / pengguna sudah didaftarkan,
          tandakan sebagai sedia ada dan jangan anggap sebagai
          kegagalan import keseluruhan.
        */
        if (
          /already registered|already exists|duplicate|sedia ada|sudah wujud|telah didaftarkan/i
            .test(mesejAsal)
        ) {
          item.sediaAda = true;
          item.data.password = "";
          sediaAda += 1;

          semuaKeputusan.push({
            baris: item.baris,
            no_badan: d.no_badan,
            status: "SEDIA_ADA",
            mesej: mesejAsal
          });

        } else {
          gagal += 1;

          const mesejPaparan =
            /Edge Function|Failed to send|404/i.test(mesejAsal)
              ? `${mesejAsal} Pastikan Edge Function "tambah-petugas" telah dideploy dan berfungsi.`
              : mesejAsal;

          if (
            !item.ralat.some(ralat =>
              String(ralat).includes(mesejPaparan)
            )
          ) {
            item.ralat.push(`Import: ${mesejPaparan}`);
          }

          semuaKeputusan.push({
            baris: item.baris,
            no_badan: d.no_badan,
            status: "GAGAL",
            mesej: mesejPaparan
          });
        }
      }

      diproses += 1;
      paparPratontonImportPengguna();

      /*
        Jeda kecil antara akaun untuk mengurangkan risiko terlalu
        banyak permintaan Auth dalam masa yang sangat singkat.
      */
      if (diproses < senarai.length) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    /*
      Semak semula table profiles selepas import supaya status sebenar
      di Supabase disahkan sebelum keputusan akhir dipaparkan.
    */
    try {
      await semakPenggunaSediaAda(rekodImportPengguna);

      rekodImportPengguna.forEach(item => {
        if (item.diimport) item.sediaAda = false;
      });

      paparPratontonImportPengguna();
    } catch (semakError) {
      console.warn(
        "Semakan semula profiles selepas import gagal:",
        semakError
      );
    }

    const ralat = semuaKeputusan.filter(
      item => item.status === "GAGAL"
    );

    const butiran = ralat.length
      ? `<br><details><summary>Lihat ${ralat.length} ralat</summary><ul>${
          ralat.slice(0, 100).map(item =>
            `<li>Baris ${escapeHtml(item.baris || "-")} — ` +
            `${escapeHtml(item.no_badan || "-")}: ` +
            `${escapeHtml(item.mesej || "Ralat")}</li>`
          ).join("")
        }</ul></details>`
      : "";

    paparMesej(
      "statusImportPengguna",
      `<strong>IMPORT PENGGUNA SELESAI</strong><br>` +
      `Berjaya: ${berjaya}<br>` +
      `Sedia ada/dilangkau: ${sediaAda}<br>` +
      `Gagal: ${gagal}${butiran}`,
      gagal ? "warning" : "success"
    );

    /*
      Muat semula dashboard jika fungsi tersedia.
    */
    if (berjaya > 0 && typeof muatData === "function") {
      try {
        await muatData(true);
      } catch (errorMuat) {
        console.warn(
          "Pengguna berjaya diimport tetapi dashboard gagal dimuat semula:",
          errorMuat
        );
      }
    }

  } catch (error) {
    console.error("Import pengguna gagal:", error);

    paparMesej(
      "statusImportPengguna",
      `Import gagal: ${escapeHtml(
        error?.message || "Ralat tidak diketahui."
      )}`,
      "error"
    );

  } finally {
    importPenggunaSedangBerjalan = false;
    butang.textContent = "IMPORT PENGGUNA KE SUPABASE";
    paparPratontonImportPengguna();
  }
}

/* ================================================================
   IMPORT PENUGASAN CSV
================================================================ */

function normalisasiHeaderCsv(nilai) {
  return atas(nilai)
    .replace(/^\uFEFF/, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function kesanPemisahCsv(kandungan) {
  const barisPertama = String(kandungan || "").split(/\r?\n/, 1)[0] || "";
  const calon = [",", ";", "\t"];
  let terbaik = ",";
  let jumlahTerbaik = -1;

  calon.forEach(pemisah => {
    let dalamPetikan = false;
    let jumlah = 0;

    for (let i = 0; i < barisPertama.length; i += 1) {
      const aksara = barisPertama[i];
      if (aksara === '"') dalamPetikan = !dalamPetikan;
      if (!dalamPetikan && aksara === pemisah) jumlah += 1;
    }

    if (jumlah > jumlahTerbaik) {
      terbaik = pemisah;
      jumlahTerbaik = jumlah;
    }
  });

  return terbaik;
}

function parseCsv(kandungan) {
  const teksCsv = String(kandungan || "").replace(/^\uFEFF/, "");
  const pemisah = kesanPemisahCsv(teksCsv);
  const baris = [];
  let rekod = [];
  let sel = "";
  let dalamPetikan = false;

  for (let i = 0; i < teksCsv.length; i += 1) {
    const aksara = teksCsv[i];

    if (aksara === '"') {
      if (dalamPetikan && teksCsv[i + 1] === '"') {
        sel += '"';
        i += 1;
      } else {
        dalamPetikan = !dalamPetikan;
      }
      continue;
    }

    if (!dalamPetikan && aksara === pemisah) {
      rekod.push(sel);
      sel = "";
      continue;
    }

    if (!dalamPetikan && (aksara === "\n" || aksara === "\r")) {
      if (aksara === "\r" && teksCsv[i + 1] === "\n") i += 1;
      rekod.push(sel);
      sel = "";

      if (rekod.some(item => teks(item) !== "")) baris.push(rekod);
      rekod = [];
      continue;
    }

    sel += aksara;
  }

  if (dalamPetikan) {
    throw new Error("Terdapat tanda petikan yang tidak ditutup dalam fail CSV.");
  }

  rekod.push(sel);
  if (rekod.some(item => teks(item) !== "")) baris.push(rekod);

  return baris;
}

function tarikhCsv(nilai) {
  const asal = teks(nilai);
  let tahun;
  let bulan;
  let hari;
  let padanan = asal.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (padanan) {
    tahun = Number(padanan[1]);
    bulan = Number(padanan[2]);
    hari = Number(padanan[3]);
  } else {
    padanan = asal.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (!padanan) return null;
    hari = Number(padanan[1]);
    bulan = Number(padanan[2]);
    tahun = Number(padanan[3]);
  }

  const semakan = new Date(Date.UTC(tahun, bulan - 1, hari));
  if (
    semakan.getUTCFullYear() !== tahun ||
    semakan.getUTCMonth() !== bulan - 1 ||
    semakan.getUTCDate() !== hari
  ) return null;

  return `${String(tahun).padStart(4, "0")}-${String(bulan).padStart(2, "0")}-${String(hari).padStart(2, "0")}`;
}

function booleanCsv(nilai, nilaiAsal = false) {
  const bersih = atas(nilai);
  if (!bersih) return nilaiAsal;
  if (["YA", "YES", "Y", "1", "TRUE", "BENAR"].includes(bersih)) return true;
  if (["TIDAK", "NO", "N", "0", "FALSE", "PALSU"].includes(bersih)) return false;
  return null;
}

function nomborCsv(nilai) {
  const bersih = teks(nilai).replace(",", ".");
  if (!bersih) return null;
  const nombor = Number(bersih);
  return Number.isFinite(nombor) ? nombor : null;
}

function binaRekodImportCsv(barisCsv) {
  if (barisCsv.length < 2) {
    throw new Error("Fail CSV tidak mempunyai rekod penugasan.");
  }

  const alias = {
    TARIKH: ["TARIKH", "TARIKH_TUGAS", "DATE"],
    NO_BADAN: ["NO_BADAN", "NOBADAN", "NO_POLIS", "BODY_NO"],
    CALL_SIGN: ["CALL_SIGN", "CALLSIGN"],
    JENIS_TUGAS: ["JENIS_TUGAS", "TUGAS"],
    TEMPAT_TUGAS: ["TEMPAT_TUGAS", "LOKASI", "LOKASI_TUGAS"],
    PENYELIA: ["PENYELIA", "SUPERVISOR"],
    PEMEGANG_SET: ["PEMEGANG_SET", "PEMEGANGSET", "RADIO_HOLDER"],
    LATITUDE: ["LATITUDE", "LAT"],
    LONGITUDE: ["LONGITUDE", "LONG", "LNG"],
    RADIUS_METER: ["RADIUS_METER", "RADIUS", "RADIUS_METERS"],
    STATUS: ["STATUS", "STATUS_PENUGASAN"]
  };

  const header = barisCsv[0].map(normalisasiHeaderCsv);
  const indeks = {};

  Object.entries(alias).forEach(([nama, pilihan]) => {
    indeks[nama] = header.findIndex(item => pilihan.includes(item));
  });

  const wajib = [
    "TARIKH", "NO_BADAN", "JENIS_TUGAS", "TEMPAT_TUGAS",
    "LATITUDE", "LONGITUDE", "RADIUS_METER"
  ];
  const tiada = wajib.filter(nama => indeks[nama] < 0);

  if (tiada.length) {
    throw new Error(`Kolum wajib tidak dijumpai: ${tiada.join(", ")}. Gunakan templat yang disediakan.`);
  }

  const ambil = (baris, nama) => indeks[nama] >= 0 ? teks(baris[indeks[nama]]) : "";
  const rekod = barisCsv.slice(1).map((baris, kedudukan) => {
    const nomborBaris = kedudukan + 2;
    const ralat = [];
    const tarikh = tarikhCsv(ambil(baris, "TARIKH"));
    const noBadan = atas(ambil(baris, "NO_BADAN"));
    const jenisTugas = atas(ambil(baris, "JENIS_TUGAS"));
    const tempatTugas = atas(ambil(baris, "TEMPAT_TUGAS"));
    const penyelia = booleanCsv(ambil(baris, "PENYELIA"), false);
    const pemegangSet = booleanCsv(ambil(baris, "PEMEGANG_SET"), false);
    const latitude = nomborCsv(ambil(baris, "LATITUDE"));
    const longitude = nomborCsv(ambil(baris, "LONGITUDE"));
    const radius = nomborCsv(ambil(baris, "RADIUS_METER"));
    const status = atas(ambil(baris, "STATUS") || "AKTIF");

    if (!tarikh) ralat.push("Tarikh tidak sah");
    if (!noBadan) ralat.push("No Badan kosong");
    if (!jenisTugas) ralat.push("Jenis Tugas kosong");
    if (!tempatTugas) ralat.push("Tempat Tugas kosong");
    if (penyelia === null) ralat.push("Penyelia mesti YA atau TIDAK");
    if (pemegangSet === null) ralat.push("Pemegang Set mesti YA atau TIDAK");
    if (latitude === null || latitude < -90 || latitude > 90) ralat.push("Latitude tidak sah");
    if (longitude === null || longitude < -180 || longitude > 180) ralat.push("Longitude tidak sah");
    if (radius === null || !Number.isInteger(radius) || radius < 1 || radius > 5000) {
      ralat.push("Radius mesti nombor bulat 1 hingga 5000");
    }
    if (!["AKTIF", "DIGANTI"].includes(status)) ralat.push("Status mesti AKTIF atau DIGANTI");

    return {
      baris: nomborBaris,
      ralat,
      data: {
        baris: nomborBaris,
        tarikh,
        no_badan: noBadan,
        call_sign: atas(ambil(baris, "CALL_SIGN")) || null,
        jenis_tugas: jenisTugas,
        tempat_tugas: tempatTugas,
        penyelia: penyelia === true,
        pemegang_set: pemegangSet === true,
        latitude,
        longitude,
        radius_meter: radius,
        status
      }
    };
  });

  const kekerapan = new Map();
  rekod.forEach(item => {
    if (!item.data.tarikh || !item.data.no_badan) return;
    const kunci = `${item.data.tarikh}|${item.data.no_badan}`;
    kekerapan.set(kunci, (kekerapan.get(kunci) || 0) + 1);
  });

  rekod.forEach(item => {
    const kunci = `${item.data.tarikh}|${item.data.no_badan}`;
    if (kekerapan.get(kunci) > 1) item.ralat.push("No Badan dan tarikh berganda dalam fail");
  });

  return rekod;
}

async function semakPetugasUntukImport(rekod) {
  const noBadan = [...new Set(
    rekod.filter(item => item.ralat.length === 0).map(item => item.data.no_badan)
  )];
  const profil = new Map();

  for (const kumpulan of bahagiKumpulan(noBadan, 100)) {
    const { data, error } = await denganHadMasa(
      db.from("profiles").select("no_badan,aktif").in("no_badan", kumpulan)
    );
    if (error) throw error;
    (data || []).forEach(item => profil.set(atas(item.no_badan), item.aktif === true));
  }

  rekod.forEach(item => {
    if (item.ralat.length > 0) return;
    if (!profil.has(item.data.no_badan)) {
      item.ralat.push("No Badan belum didaftarkan");
    } else if (profil.get(item.data.no_badan) !== true) {
      item.ralat.push("Akaun petugas tidak aktif");
    }
  });
}

function paparPratontonImport() {
  const jumlah = rekodImportPenugasan.length;
  const sah = rekodImportPenugasan.filter(item => item.ralat.length === 0).length;
  const gagal = jumlah - sah;

  el("importJumlah").textContent = String(jumlah);
  el("importSah").textContent = String(sah);
  el("importGagal").textContent = String(gagal);
  el("btnImportPenugasan").disabled = sah === 0 || importSedangBerjalan;
  el("ruangPratontonImport").hidden = jumlah === 0;

  el("tbodyImportPenugasan").innerHTML = rekodImportPenugasan
    .slice(0, 100)
    .map(item => {
      const d = item.data;
      const semakan = item.ralat.length
        ? `<span class="badge badge-red" title="${escapeHtml(item.ralat.join("; "))}">RALAT: ${escapeHtml(item.ralat.join("; "))}</span>`
        : '<span class="badge badge-green">SAH</span>';

      return `<tr>
        <td>${item.baris}</td>
        <td>${escapeHtml(d.tarikh || "-")}</td>
        <td>${escapeHtml(d.no_badan || "-")}</td>
        <td>${escapeHtml(d.call_sign || "-")}</td>
        <td>${escapeHtml(d.jenis_tugas || "-")}</td>
        <td>${escapeHtml(d.tempat_tugas || "-")}</td>
        <td>${d.penyelia ? "YA" : "TIDAK"}</td>
        <td>${d.pemegang_set ? "YA" : "TIDAK"}</td>
        <td>${d.latitude ?? "-"}</td>
        <td>${d.longitude ?? "-"}</td>
        <td>${d.radius_meter ?? "-"}</td>
        <td>${semakan}</td>
      </tr>`;
    })
    .join("");

  el("notaPratontonImport").textContent = jumlah > 100
    ? `Memaparkan 100 daripada ${jumlah} baris. Semua baris tetap akan diproses.`
    : `Memaparkan semua ${jumlah} baris.`;
}

async function bacaFailPenugasanCsv(event) {
  const fail = event?.target?.files?.[0];
  if (!fail) return;

  rekodImportPenugasan = [];
  el("importFail").textContent = fail.name;
  el("btnImportPenugasan").disabled = true;
  paparMesej("statusImportPenugasan", "Sedang membaca dan menyemak fail CSV...", "warning");

  try {
    if (!/\.csv$/i.test(fail.name)) throw new Error("Sila pilih fail berformat .csv.");
    if (fail.size > 5 * 1024 * 1024) throw new Error("Saiz fail melebihi had 5 MB.");

    const kandungan = await fail.text();
    rekodImportPenugasan = binaRekodImportCsv(parseCsv(kandungan));
    await semakPetugasUntukImport(rekodImportPenugasan);
    paparPratontonImport();

    const sah = rekodImportPenugasan.filter(item => item.ralat.length === 0).length;
    const gagal = rekodImportPenugasan.length - sah;
    paparMesej(
      "statusImportPenugasan",
      gagal
        ? `${sah} baris sah. ${gagal} baris bermasalah dan tidak akan diimport.`
        : `Semua ${sah} baris sah dan sedia untuk diimport.`,
      gagal ? "warning" : "success"
    );
  } catch (error) {
    console.error("Bacaan CSV gagal:", error);
    rekodImportPenugasan = [];
    paparPratontonImport();
    paparMesej("statusImportPenugasan", escapeHtml(error.message), "error");
  }
}

function kosongkanImportPenugasan() {
  if (importSedangBerjalan) return;
  rekodImportPenugasan = [];
  el("failPenugasanCsv").value = "";
  el("importFail").textContent = "-";
  el("statusImportPenugasan").className = "status-box";
  el("statusImportPenugasan").innerHTML = "";
  paparPratontonImport();
}

function muatTurunTemplatPenugasan() {
  const tarikh = el("tarikh")?.value || hariIniMalaysia();
  const kandungan = [
    "TARIKH,NO_BADAN,CALL_SIGN,JENIS_TUGAS,TEMPAT_TUGAS,PENYELIA,PEMEGANG_SET,LATITUDE,LONGITUDE,RADIUS_METER,STATUS",
    `${tarikh},197898,VCC,URUSETIA,SUBTEK,YA,YA,2.7585826,101.7096481,30,AKTIF`,
    `${tarikh},199898,BRAVO 01,KAWALAN KESELAMATAN,PINTU UTAMA,TIDAK,YA,2.7591000,101.7102000,30,AKTIF`
  ].join("\r\n");

  const blob = new Blob(["\uFEFF", kandungan], { type: "text/csv;charset=utf-8" });
  const pautan = document.createElement("a");
  pautan.href = URL.createObjectURL(blob);
  pautan.download = `TEMPLAT_PENUGASAN_${tarikh}.csv`;
  document.body.appendChild(pautan);
  pautan.click();
  pautan.remove();
  setTimeout(() => URL.revokeObjectURL(pautan.href), 1000);
}

async function importPenugasanCsv() {
  if (importSedangBerjalan) return;

  const sah = rekodImportPenugasan.filter(item => item.ralat.length === 0);
  if (!sah.length) {
    paparMesej("statusImportPenugasan", "Tiada baris sah untuk diimport.", "error");
    return;
  }

  if (!confirm(`Import ${sah.length} rekod penugasan ke Supabase? Rekod tarikh dan No Badan yang sama akan dikemas kini.`)) return;

  importSedangBerjalan = true;
  const butang = el("btnImportPenugasan");
  butang.disabled = true;
  let diproses = 0;
  let berjaya = 0;
  let baharu = 0;
  let dikemasKini = 0;
  let gagal = 0;
  const semuaRalat = [];

  try {
    const kumpulan = bahagiKumpulan(sah, 200);

    for (let i = 0; i < kumpulan.length; i += 1) {
      butang.textContent = `MENGIMPORT ${diproses} / ${sah.length}...`;
      paparMesej(
        "statusImportPenugasan",
        `Sedang memproses kumpulan ${i + 1} daripada ${kumpulan.length}...`,
        "warning"
      );

      const { data, error } = await denganHadMasa(
        db.rpc("import_penugasan_csv", {
          p_rekod: kumpulan[i].map(item => item.data)
        }),
        60000
      );

      if (error) {
        const mesej = `${error.code || ""} ${error.message || ""}`;
        if (/PGRST202|does not exist|schema cache|Could not find/i.test(mesej)) {
          throw new Error("Fungsi import belum dipasang. Jalankan fail 03_import_penugasan_csv.sql dalam Supabase SQL Editor, kemudian cuba semula.");
        }
        throw error;
      }

      const hasil = typeof data === "string" ? JSON.parse(data) : (data || {});
      berjaya += Number(hasil.berjaya || 0);
      baharu += Number(hasil.baharu || 0);
      dikemasKini += Number(hasil.dikemas_kini || 0);
      gagal += Number(hasil.gagal || 0);
      if (Array.isArray(hasil.ralat)) semuaRalat.push(...hasil.ralat);
      diproses += kumpulan[i].length;
    }

    const butiranRalat = semuaRalat.length
      ? `<br><details><summary>Lihat ${semuaRalat.length} ralat import</summary><ul>${semuaRalat.slice(0, 100).map(item => `<li>Baris ${escapeHtml(item.baris || "-")}: ${escapeHtml(item.mesej || "Ralat")}</li>`).join("")}</ul></details>`
      : "";

    paparMesej(
      "statusImportPenugasan",
      `<strong>IMPORT SELESAI</strong><br>Berjaya: ${berjaya} (Baharu: ${baharu}, Dikemas kini: ${dikemasKini})<br>Gagal: ${gagal}${butiranRalat}`,
      gagal ? "warning" : "success"
    );

    if (sah[0]?.data?.tarikh) el("tarikh").value = sah[0].data.tarikh;
    await muatData(true);
  } catch (error) {
    console.error("Import penugasan gagal:", error);
    paparMesej("statusImportPenugasan", `Import gagal: ${escapeHtml(error.message)}`, "error");
  } finally {
    importSedangBerjalan = false;
    butang.textContent = "IMPORT PENUGASAN KE SUPABASE";
    butang.disabled = sah.length === 0;
  }
}

/* ================================================================
   JANA PENUGASAN AUTOMATIK 3–5 HARI — FORMULA 1
================================================================ */

function tambahHariISO(tarikhISO, jumlahHari) {
  const padanan = teks(tarikhISO).match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!padanan) {
    throw new Error("Tarikh mula tidak sah.");
  }

  const tarikh = new Date(Date.UTC(
    Number(padanan[1]),
    Number(padanan[2]) - 1,
    Number(padanan[3]) + Number(jumlahHari || 0)
  ));

  return tarikh.toISOString().slice(0, 10);
}


async function muatJadualTersimpanKePratontonAuto() {
  const mula =
    teks(el("autoTarikhMula")?.value) ||
    teks(el("tarikh")?.value) ||
    hariIniMalaysia();

  const tamat =
    teks(el("autoTarikhTamat")?.value) ||
    mula;

  if (!mula || !tamat) return;

  try {
    const { data: rekod, error } = await denganHadMasa(
      db.from("penugasan")
        .select("*")
        .gte("tarikh", mula)
        .lte("tarikh", tamat)
        .order("tarikh", { ascending: true })
        .order("created_at", { ascending: true })
    );

    if (error) throw error;

    const senarai = rekod || [];

    if (!senarai.length) {
      previewPenugasanAuto = [];
      paparPreviewPenugasanAuto();

      paparMesej(
        "statusJanaAuto",
        `Tiada jadual tersimpan di Supabase bagi ${escapeHtml(formatTarikhMalaysia(mula))}` +
        (tamat !== mula ? ` hingga ${escapeHtml(formatTarikhMalaysia(tamat))}` : "") + ".",
        "warning"
      );
      return;
    }

    /*
      PENTING:
      penugasan.petugas_id mungkin menyimpan profiles.id ATAU profiles.auth_user_id.
      Oleh itu jangan query profiles hanya dengan .in("id", ids).
      Muat profil dan bina dua indeks supaya rekod lama dan baharu sama-sama boleh dipadankan.
    */
    const { data: profilData, error: profilError } = await denganHadMasa(
      db.from("profiles").select("*")
    );

    if (profilError) throw profilError;

    const profil = profilData || [];
    const profilById = new Map();
    const profilByAuth = new Map();
    const profilByNoBadan = new Map();

    profil.forEach(item => {
      if (item?.id) profilById.set(String(item.id), item);
      if (item?.auth_user_id) profilByAuth.set(String(item.auth_user_id), item);

      const noBadan = atas(item?.no_badan);
      if (noBadan) profilByNoBadan.set(noBadan, item);
    });

    const mulaUTC = Date.parse(`${mula}T00:00:00Z`);

    previewPenugasanAuto = senarai.map(item => {
      const petugasId = String(item.petugas_id || item.profile_id || "");
      const noBadanRekod = atas(item.no_badan || "");

      const pengguna =
        profilById.get(petugasId) ||
        profilByAuth.get(petugasId) ||
        profilByNoBadan.get(noBadanRekod) ||
        {};

      const tarikhItem = teks(item.tarikh);
      const tarikhUTC = Date.parse(`${tarikhItem}T00:00:00Z`);

      const hari =
        Number.isFinite(tarikhUTC) && Number.isFinite(mulaUTC)
          ? Math.floor((tarikhUTC - mulaUTC) / 86400000) + 1
          : 1;

      return {
        acara: "FORMULA1",
        hari,
        tarikh: tarikhItem,
        no_badan: atas(pengguna.no_badan || item.no_badan || ""),
        pangkat: atas(pengguna.pangkat || item.pangkat || ""),
        nama: atas(pengguna.nama || item.nama || ""),
        telefon:
          pengguna.telefon ||
          pengguna.no_telefon ||
          item.telefon ||
          item.no_telefon ||
          "",
        daerah:
          pengguna.daerah ||
          item.daerah ||
          "",
        corak_tugas: atas(item.corak_tugas || "ROTATION"),
        call_sign: atas(item.call_sign || ""),
        jenis_tugas: atas(item.jenis_tugas || ""),
        tempat_tugas: atas(item.tempat_tugas || item.lokasi || ""),
        penyelia: nilaiBoolean(item.penyelia),
        pemegang_set: nilaiBoolean(item.pemegang_set),
        latitude: item.latitude ?? null,
        longitude: item.longitude ?? null,
        radius_meter: item.radius_meter ?? item.radius ?? null,
        status: atas(item.status || "AKTIF")
      };
    });

    paparPreviewPenugasanAuto();

    if (el("btnSimpanAuto")) {
      el("btnSimpanAuto").disabled = true;
    }

    paparMesej(
      "statusJanaAuto",
      `<strong>JADUAL TERSIMPAN DIMUATKAN</strong><br>` +
      `${previewPenugasanAuto.length} rekod daripada ${escapeHtml(formatTarikhMalaysia(mula))}` +
      (tamat !== mula ? ` hingga ${escapeHtml(formatTarikhMalaysia(tamat))}` : "") +
      ` dipaparkan semula dari Supabase.`,
      "success"
    );

  } catch (error) {
    console.error("Muat jadual tersimpan ke pratonton gagal:", error);

    previewPenugasanAuto = [];
    paparPreviewPenugasanAuto();

    paparMesej(
      "statusJanaAuto",
      `Jadual tersimpan gagal dimuatkan: ${escapeHtml(error.message)}`,
      "error"
    );
  }
}

async function bukaJanaPenugasan() {
  tutupSemuaModulPentadbir();

  const modul = el("modulJanaPenugasan");
  const butangHeader = el("btnBukaJanaPenugasan");

  if (!modul) {
    alert("Modul Jana Penugasan tidak dijumpai dalam admin.html.");
    return;
  }

  modul.hidden = false;
  modul.removeAttribute("hidden");
  modul.style.removeProperty("display");
  modul.classList.add("modul-disorot");

  if (butangHeader) {
    butangHeader.setAttribute("aria-expanded", "true");
  }

  const inputTarikh = el("autoTarikhMula");
  const inputTarikhTamat = el("autoTarikhTamat");

  if (inputTarikh && !inputTarikh.value) {
    inputTarikh.value =
      el("tarikh")?.value ||
      hariIniMalaysia();
  }

  if (
    inputTarikhTamat &&
    !inputTarikhTamat.value
  ) {
    inputTarikhTamat.value =
      inputTarikh?.value ||
      el("tarikh")?.value ||
      hariIniMalaysia();
  }

  selaraskanKolumHariAuto();

  if (!el("tbodyLokasiAuto")?.children.length) {
    tambahLokasiAuto();
    tambahLokasiAuto();
    tambahLokasiAuto();
    tambahLokasiAuto();
  }

  selaraskanKolumHariAuto();

  jenisPenugasanAutoAktif =
    atas(el("autoJenisPenugasan")?.value);

  if (jenisPenugasanAutoAktif) {
    if (!dataPetugasAuto.length) {
      muatPetugasAuto();
    } else {
      paparPetugasAuto();
    }
  } else {
    const tbody = el("tbodyPetugasAuto");
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="11" class="empty-row">Pilih Jenis Penugasan dahulu.</td></tr>';
    }
  }

  kemasKiniTarikhMuatTurunPenugasanAuto();

  // Paparkan semula jadual yang telah disimpan walaupun halaman di-refresh/login semula.
  await muatJadualTersimpanKePratontonAuto();

  window.setTimeout(() => {
    modul.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, 80);
}


function tutupJanaPenugasan() {
  const modul = el("modulJanaPenugasan");
  const butangHeader = el("btnBukaJanaPenugasan");

  if (modul) {
    modul.hidden = true;
    modul.setAttribute("hidden", "");
    modul.style.display = "none";
    modul.classList.remove("modul-disorot");
  }

  if (butangHeader) {
    butangHeader.setAttribute("aria-expanded", "false");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* ================================================================
   SUSUNAN PANGKAT & PERATURAN PEMEGANG SET — FIX 017
================================================================ */

const SUSUNAN_PANGKAT_F1 = [
  "ACP", "SUPT", "DSP", "ASP", "INSP", "SI", "SM", "SJN",
  "KPL", "L/KPL", "KONST", "KPL/S", "L/KPL/S", "KONST/S",
  "KPL/PB", "L/KPL/PB", "KONST/PB"
];

const INDEKS_PANGKAT_F1 = new Map(
  SUSUNAN_PANGKAT_F1.map((pangkat, index) => [pangkat, index])
);

const LOKASI_PENYELIA_BUKAN_PEMEGANG_SET_F1 = new Set([
  "BALAI POLIS BERGERAK (MALL AREA)",
  "BALAI POLIS BERGERAK (PX)",
  "BALAI POLIS BERGERAK (GRANDSTAND F)"
]);

function indeksPangkatF1(pangkat) {
  const nilai = atas(pangkat);
  return INDEKS_PANGKAT_F1.has(nilai)
    ? INDEKS_PANGKAT_F1.get(nilai)
    : SUSUNAN_PANGKAT_F1.length + 100;
}

function bandingNoBadanF1(a, b) {
  const teksA = teks(a);
  const teksB = teks(b);
  const noA = Number(teksA);
  const noB = Number(teksB);
  const sahA = Number.isFinite(noA);
  const sahB = Number.isFinite(noB);

  if (sahA && sahB && noA !== noB) return noA - noB;
  if (sahA && !sahB) return -1;
  if (!sahA && sahB) return 1;

  return teksA.localeCompare(teksB, "ms", {
    numeric: true,
    sensitivity: "base"
  });
}

function bandingPangkatNoBadanF1(a, b) {
  const pangkatA = indeksPangkatF1(a?.pangkat);
  const pangkatB = indeksPangkatF1(b?.pangkat);

  if (pangkatA !== pangkatB) return pangkatA - pangkatB;
  return bandingNoBadanF1(a?.no_badan, b?.no_badan);
}

function ialahPangkatPBF1(pangkat) {
  return ["KPL/PB", "L/KPL/PB", "KONST/PB"].includes(atas(pangkat));
}

function lokasiPenyeliaBukanPemegangSetF1(tempat) {
  return LOKASI_PENYELIA_BUKAN_PEMEGANG_SET_F1.has(atas(tempat));
}

async function muatPetugasAuto() {
  const jenis =
    atas(el("autoJenisPenugasan")?.value);

  if (!jenis) {
    paparMesej(
      "statusPetugasAuto",
      "Sila pilih Jenis Penugasan terlebih dahulu.",
      "warning"
    );
    return;
  }

  jenisPenugasanAutoAktif = jenis;

  paparMesej(
    "statusPetugasAuto",
    `Sedang memuatkan senarai petugas untuk ${escapeHtml(jenis)}...`,
    "warning"
  );

  try {
    const { data, error } = await denganHadMasa(
      db.from("profiles")
        .select("*")
        .eq("aktif", true)
        .order("pangkat", { ascending: true })
        .order("nama", { ascending: true })
        .limit(3000)
    );

    if (error) throw error;

    dataPetugasAuto = (data || [])
      .filter(item => {
        const peranan = atas(item.peranan || "PETUGAS");
        return !["PENTADBIR", "ADMIN"].includes(peranan);
      });

    // Kunci petugas yang sudah mempunyai penugasan dalam julat tarikh operasi.
    await muatJenisPenugasanTersimpanAuto();

    paparPetugasAuto();

    paparMesej(
      "statusPetugasAuto",
      `${dataPetugasAuto.length} petugas aktif dimuatkan untuk ` +
      `<strong>${escapeHtml(jenis)}</strong>. ` +
      `Tandakan hanya anggota yang terlibat dalam jenis penugasan ini.`,
      "success"
    );

  } catch (error) {
    console.error("Muat petugas auto gagal:", error);

    dataPetugasAuto = [];
    paparPetugasAuto();

    paparMesej(
      "statusPetugasAuto",
      `Gagal memuatkan petugas: ${escapeHtml(error.message)}`,
      "error"
    );
  }
}


async function muatJenisPenugasanTersimpanAuto() {
  const mula =
    teks(el("autoTarikhMula")?.value) ||
    teks(el("tarikh")?.value) ||
    hariIniMalaysia();

  const tamat =
    teks(el("autoTarikhTamat")?.value) ||
    mula;

  Object.keys(jenisTersimpanPetugasAuto).forEach(kunci => {
    delete jenisTersimpanPetugasAuto[kunci];
  });
  petugasSudahAdaPenugasanAuto.clear();

  const { data: rekod, error } = await denganHadMasa(
    db.from("penugasan")
      .select("*")
      .gte("tarikh", mula)
      .lte("tarikh", tamat)
      .order("tarikh", { ascending: true })
  );

  if (error) throw error;

  const profilById = new Map();
  const profilByAuth = new Map();

  dataPetugasAuto.forEach(profil => {
    if (profil?.id) profilById.set(String(profil.id), profil);
    if (profil?.auth_user_id) {
      profilByAuth.set(String(profil.auth_user_id), profil);
    }
  });

  (rekod || []).forEach(item => {
    const petugasId = String(item.petugas_id || item.profile_id || "");
    const profil =
      profilById.get(petugasId) ||
      profilByAuth.get(petugasId) ||
      null;

    const noBadan =
      atas(
        profil?.no_badan ||
        item.no_badan ||
        ""
      );

    const jenis =
      atas(item.jenis_tugas || "");

    if (!noBadan || !jenis) return;

    /* FIX 016: walau apa pun jenis tugasnya, kewujudan satu rekod sudah cukup untuk mengunci petugas. */
    petugasSudahAdaPenugasanAuto.add(noBadan);

    /*
      Jika seseorang mempunyai rekod pada beberapa hari untuk jenis yang sama,
      ia tetap dianggap satu Jenis Penugasan.
    */
    if (!jenisTersimpanPetugasAuto[noBadan]) {
      jenisTersimpanPetugasAuto[noBadan] = jenis;
    }

    /*
      Penugasan yang sudah tersimpan adalah authoritative.
      Ini memastikan refresh/login semula masih mengunci petugas.
    */
    jenisTetapPetugasAuto[noBadan] =
      jenisTersimpanPetugasAuto[noBadan];
  });
}


function petugasDipilihJenisAuto(noBadan) {
  const jenis =
    jenisPenugasanAutoAktif ||
    atas(el("autoJenisPenugasan")?.value);

  if (!jenis) return false;

  return jenisTetapPetugasAuto[atas(noBadan)] === jenis;
}


function jenisPetugasAuto(noBadan) {
  const kunci = atas(noBadan);
  return (
    jenisTersimpanPetugasAuto[kunci] ||
    jenisTetapPetugasAuto[kunci] ||
    ""
  );
}


function labelJenisPetugasAuto(noBadan) {
  const jenis = jenisPetugasAuto(noBadan);

  if (!jenis) {
    return '<span class="badge badge-gray">BELUM DITETAPKAN</span>';
  }

  return `<span class="badge badge-blue">${escapeHtml(jenis)}</span>`;
}


function ubahPilihanPetugasJenisAuto(checkbox) {
  const tr = checkbox?.closest("tr[data-auto-petugas-index]");
  if (!tr) return;

  const index = Number(tr.dataset.autoPetugasIndex);
  const profil = dataPetugasAuto[index];
  if (!profil) return;

  const noBadan = atas(profil.no_badan);
  const jenisSemasa =
    jenisPenugasanAutoAktif ||
    atas(el("autoJenisPenugasan")?.value);

  if (!jenisSemasa) {
    checkbox.checked = false;
    alert("Pilih Jenis Penugasan terlebih dahulu.");
    return;
  }

  const jenisTersimpan = jenisTersimpanPetugasAuto[noBadan] || "";
  const jenisSediaAda = jenisPetugasAuto(noBadan);

  if (jenisTersimpan) {
    checkbox.checked = jenisTersimpan === jenisSemasa;

    alert(
      `${profil.pangkat || ""} ${profil.nama || noBadan} sudah mempunyai penugasan ` +
      `${jenisTersimpan}.\n\nPetugas yang sudah mempunyai penugasan tidak boleh dipilih semula.`
    );

    paparPetugasAuto();
    return;
  }

  if (checkbox.checked) {
    if (
      jenisSediaAda &&
      jenisSediaAda !== jenisSemasa
    ) {
      checkbox.checked = false;

      alert(
        `${profil.pangkat || ""} ${profil.nama || noBadan} telah ditetapkan ` +
        `di ${jenisSediaAda}.\n\n` +
        `Petugas tidak boleh berada dalam dua jenis penugasan.`
      );

      return;
    }

    jenisTetapPetugasAuto[noBadan] = jenisSemasa;

  } else {
    if (jenisSediaAda === jenisSemasa) {
      delete jenisTetapPetugasAuto[noBadan];
    }
  }

  simpanPilihanPetugasJenisAuto();
  paparPetugasAuto();
  kemasKiniRingkasanKapasitiAuto();
}


function simpanPilihanPetugasJenisAuto() {
  const jenis =
    jenisPenugasanAutoAktif ||
    atas(el("autoJenisPenugasan")?.value);

  if (!jenis) return;

  const setPilihan = new Set();

  document
    .querySelectorAll("#tbodyPetugasAuto tr[data-auto-petugas-index]")
    .forEach(tr => {
      const cb = tr.querySelector(".auto-pilih-petugas");
      const index = Number(tr.dataset.autoPetugasIndex);
      const profil = dataPetugasAuto[index];

      if (!profil?.no_badan) return;

      const noBadan = atas(profil.no_badan);

      if (
        cb?.checked &&
        (
          !jenisTetapPetugasAuto[noBadan] ||
          jenisTetapPetugasAuto[noBadan] === jenis
        )
      ) {
        jenisTetapPetugasAuto[noBadan] = jenis;
        setPilihan.add(noBadan);
      }
    });

  pilihanPetugasMengikutJenisAuto[jenis] = setPilihan;
}


function tukarJenisPenugasanAuto() {
  simpanPilihanPetugasJenisAuto();

  jenisPenugasanAutoAktif =
    atas(el("autoJenisPenugasan")?.value);

  previewPenugasanAuto = [];
  paparPreviewPenugasanAuto();

  if (el("btnSimpanAuto")) {
    el("btnSimpanAuto").disabled = true;
  }

  if (!jenisPenugasanAutoAktif) {
    dataPetugasAuto = [];

    const tbody = el("tbodyPetugasAuto");
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="11" class="empty-row">Pilih Jenis Penugasan dahulu.</td></tr>';
    }

    paparMesej(
      "statusPetugasAuto",
      "Pilih salah satu daripada 8 Jenis Penugasan.",
      "warning"
    );

    return;
  }

  muatPetugasAuto();

  /*
    Semua slot lokasi baharu akan menggunakan jenis tugas yang dipilih.
  */
  document
    .querySelectorAll("#tbodyLokasiAuto .auto-jenis-tugas")
    .forEach(input => {
      input.value = jenisPenugasanAutoAktif;
      input.readOnly = true;
    });
}


function paparPetugasAuto() {
  const tbody = el("tbodyPetugasAuto");
  if (!tbody) return;

  if (!dataPetugasAuto.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" class="empty-row">
          Tiada petugas aktif ditemui.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = dataPetugasAuto
    .map((item, index) => {
      const penyeliaAsal = nilaiBoolean(item.penyelia);
      const pemegangAsal = nilaiBoolean(item.pemegang_set);
      const noBadanKunci = atas(item.no_badan);
      const jenisTersimpan =
        jenisTersimpanPetugasAuto[noBadanKunci] || "";
      const jenisSediaAda = jenisPetugasAuto(item.no_badan);
      const dimilikiJenisLain =
        Boolean(jenisSediaAda) &&
        jenisSediaAda !== jenisPenugasanAutoAktif;
      const dipilihJenisSemasa =
        jenisSediaAda === jenisPenugasanAutoAktif;
      const sudahAdaPenugasan =
        petugasSudahAdaPenugasanAuto.has(noBadanKunci);

      return `
        <tr data-auto-petugas-index="${index}">
          <td>
            <input
              class="auto-pilih-petugas"
              type="checkbox"
              ${(!sudahAdaPenugasan && dipilihJenisSemasa) ? "checked" : ""}
              ${(dimilikiJenisLain || sudahAdaPenugasan) ? "disabled" : ""}
              onchange="ubahPilihanPetugasJenisAuto(this)"
              aria-label="Pilih ${escapeHtml(item.no_badan || "")}"
            >
          </td>

          <td>${escapeHtml(item.no_badan || "-")}</td>
          <td>${escapeHtml(item.pangkat || "-")}</td>
          <td>${escapeHtml(item.nama || "-")}</td>
          <td>${escapeHtml(item.daerah || "-")}</td>
          <td>${escapeHtml(item.telefon || item.no_telefon || "-")}</td>

          <td class="auto-jenis-tetap-cell">
            ${labelJenisPetugasAuto(item.no_badan)}
            ${sudahAdaPenugasan ? '<div style="font-size:10px;color:#f0c94d;margin-top:4px;">SUDAH ADA PENUGASAN</div>' : ''}
          </td>

          <td>
            <select
              class="auto-corak-tugas"
              onchange="ubahCorakTugasAuto(this)"
              ${dimilikiJenisLain ? "disabled" : ""}
            >
              <option value="ROTATION" selected>ROTATION</option>
              <option value="KEKAL">KEKAL</option>
            </select>
          </td>

          <td>
            <select
              class="auto-lokasi-kekal"
              disabled
            >
              <option value="">PILIH LOKASI</option>
            </select>
          </td>

          <td>
            <select
              class="auto-penyelia-select ${penyeliaAsal ? "is-yes" : ""}"
              onchange="kemasKiniWarnaSelectAuto(this)"
              ${dimilikiJenisLain ? "disabled" : ""}
            >
              <option value="TIDAK" ${penyeliaAsal ? "" : "selected"}>TIDAK</option>
              <option value="YA" ${penyeliaAsal ? "selected" : ""}>YA</option>
            </select>
          </td>

          <td>
            <select
              class="auto-pemegang-select ${pemegangAsal ? "is-yes" : ""}"
              onchange="kemasKiniWarnaSelectAuto(this)"
              ${dimilikiJenisLain ? "disabled" : ""}
            >
              <option value="TIDAK" ${pemegangAsal ? "" : "selected"}>TIDAK</option>
              <option value="YA" ${pemegangAsal ? "selected" : ""}>YA</option>
            </select>
          </td>
        </tr>
      `;
    })
    .join("");

  kemasKiniPilihanLokasiKekalAuto(false);
}


function kemasKiniWarnaSelectAuto(select) {
  if (!select) return;

  select.classList.toggle(
    "is-yes",
    atas(select.value) === "YA"
  );
}


function ubahCorakTugasAuto(select) {
  const tr = select?.closest("tr");
  if (!tr) return;

  const lokasiSelect = tr.querySelector(".auto-lokasi-kekal");
  const kekal = atas(select.value) === "KEKAL";

  if (lokasiSelect) {
    lokasiSelect.disabled = !kekal;

    if (!kekal) {
      lokasiSelect.value = "";
    }
  }

  if (kekal) {
    kemasKiniPilihanLokasiKekalAuto(false);
  }
}


function senaraiLokasiRingkasAuto() {
  const hasil = [];

  document
    .querySelectorAll("#tbodyLokasiAuto tr")
    .forEach((tr, index) => {
      const callSign = atas(
        tr.querySelector(".auto-call-sign")?.value
      );

      const jenisTugas = atas(
        tr.querySelector(".auto-jenis-tugas")?.value
      );

      const tempatTugas = atas(
        tr.querySelector(".auto-tempat-tugas")?.value
      );

      if (!jenisTugas || !tempatTugas) return;

      const kunci =
        `${callSign || ""}|${jenisTugas}|${tempatTugas}`;

      hasil.push({
        index,
        kunci,
        label:
          `${callSign ? callSign + " — " : ""}${tempatTugas}`,
        call_sign: callSign || null,
        jenis_tugas: jenisTugas,
        tempat_tugas: tempatTugas
      });
    });

  return hasil;
}


function kemasKiniPilihanLokasiKekalAuto(paparStatusSelepas = false) {
  const lokasi = senaraiLokasiRingkasAuto();

  document
    .querySelectorAll("#tbodyPetugasAuto .auto-lokasi-kekal")
    .forEach(select => {
      const nilaiLama = select.value;

      select.innerHTML =
        '<option value="">PILIH LOKASI</option>' +
        lokasi.map(item =>
          `<option value="${escapeHtml(item.kunci)}">` +
          `${escapeHtml(item.label)}` +
          `</option>`
        ).join("");

      if (
        nilaiLama &&
        lokasi.some(item => item.kunci === nilaiLama)
      ) {
        select.value = nilaiLama;
      }
    });

  if (paparStatusSelepas) {
    paparMesej(
      "statusPetugasAuto",
      `${lokasi.length} lokasi tersedia untuk pilihan petugas KEKAL.`,
      lokasi.length ? "success" : "warning"
    );
  }
}


function pilihSemuaPetugasAuto(aktif) {
  const jenis =
    jenisPenugasanAutoAktif ||
    atas(el("autoJenisPenugasan")?.value);

  if (!jenis) {
    alert("Pilih Jenis Penugasan terlebih dahulu.");
    return;
  }

  document
    .querySelectorAll("#tbodyPetugasAuto tr[data-auto-petugas-index]")
    .forEach(tr => {
      const input = tr.querySelector(".auto-pilih-petugas");
      const index = Number(tr.dataset.autoPetugasIndex);
      const profil = dataPetugasAuto[index];

      if (!input || !profil?.no_badan) return;

      const noBadan = atas(profil.no_badan);
      const jenisSediaAda = jenisTetapPetugasAuto[noBadan] || "";

      if (jenisSediaAda && jenisSediaAda !== jenis) {
        input.checked = false;
        input.disabled = true;
        return;
      }

      input.checked = Boolean(aktif);

      if (aktif) {
        jenisTetapPetugasAuto[noBadan] = jenis;
      } else if (jenisTetapPetugasAuto[noBadan] === jenis) {
        delete jenisTetapPetugasAuto[noBadan];
      }
    });

  simpanPilihanPetugasJenisAuto();
  paparPetugasAuto();
  kemasKiniRingkasanKapasitiAuto();
}


function kiraBilHariAutoDariKalendar() {
  const mula = teks(el("autoTarikhMula")?.value);
  const tamat = teks(el("autoTarikhTamat")?.value);

  if (!mula || !tamat) return 0;

  const m1 = mula.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const m2 = tamat.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!m1 || !m2) return 0;

  const masaMula = Date.UTC(
    Number(m1[1]),
    Number(m1[2]) - 1,
    Number(m1[3])
  );

  const masaTamat = Date.UTC(
    Number(m2[1]),
    Number(m2[2]) - 1,
    Number(m2[3])
  );

  if (masaTamat < masaMula) return 0;

  return Math.floor((masaTamat - masaMula) / 86400000) + 1;
}


function htmlKapasitiHariAuto(hari, nilai = 0) {
  return `
    <td class="auto-kapasiti-hari-cell" data-hari="${hari}">
      <input
        class="auto-jumlah-petugas auto-jumlah-hari-${hari}"
        data-hari="${hari}"
        type="number"
        min="0"
        max="5000"
        step="1"
        value="${escapeHtml(nilai ?? 0)}"
        placeholder="0"
        onchange="kemasKiniRingkasanKapasitiAuto()"
        oninput="kemasKiniRingkasanKapasitiAuto()"
      >
    </td>
  `;
}


function selaraskanKolumHariAuto() {
  const bilHari = kiraBilHariAutoDariKalendar();

  const inputBilHari = el("autoBilHari");
  const paparanBilHari = el("autoBilHariPaparan");

  if (inputBilHari) {
    inputBilHari.value = String(bilHari || 0);
  }

  if (paparanBilHari) {
    paparanBilHari.value =
      bilHari > 0
        ? `${bilHari} HARI`
        : "PILIH TARIKH";
  }

  const headerTindakan = el("autoHeaderTindakan");

  if (headerTindakan) {
    const trHeader = headerTindakan.parentElement;

    trHeader
      ?.querySelectorAll(".auto-kapasiti-hari-header")
      .forEach(item => item.remove());

    for (let hari = 1; hari <= bilHari; hari += 1) {
      const th = document.createElement("th");
      th.className = "auto-kapasiti-hari-header";
      th.dataset.hari = String(hari);
      th.textContent = `Hari ${hari}`;
      trHeader.insertBefore(th, headerTindakan);
    }
  }

  document
    .querySelectorAll("#tbodyLokasiAuto tr")
    .forEach(tr => {
      const nilaiLama = {};

      tr.querySelectorAll(".auto-kapasiti-hari-cell")
        .forEach(td => {
          const hari = Number(td.dataset.hari || 0);
          const input = td.querySelector(".auto-jumlah-petugas");

          if (hari > 0) {
            nilaiLama[hari] = input?.value ?? "0";
          }
        });

      tr.querySelectorAll(".auto-kapasiti-hari-cell")
        .forEach(td => td.remove());

      const tdTindakan = tr.lastElementChild;

      if (tdTindakan) {
        for (let hari = 1; hari <= bilHari; hari += 1) {
          tdTindakan.insertAdjacentHTML(
            "beforebegin",
            htmlKapasitiHariAuto(
              hari,
              nilaiLama[hari] ?? 0
            )
          );
        }
      }
    });
}


function kemasKiniBilHariAutoDariKalendar() {
  const mula = teks(el("autoTarikhMula")?.value);
  const tamat = teks(el("autoTarikhTamat")?.value);

  if (mula && tamat && tamat < mula) {
    if (el("autoBilHari")) {
      el("autoBilHari").value = "0";
    }

    if (el("autoBilHariPaparan")) {
      el("autoBilHariPaparan").value = "TARIKH TIDAK SAH";
    }

    paparMesej(
      "statusJanaAuto",
      "Tarikh Tamat tidak boleh lebih awal daripada Tarikh Mula.",
      "error"
    );

    selaraskanKolumHariAuto();
    return;
  }

  selaraskanKolumHariAuto();
  kemasKiniRingkasanKapasitiAuto();

  previewPenugasanAuto = [];
  paparPreviewPenugasanAuto();

  if (el("btnSimpanAuto")) {
    el("btnSimpanAuto").disabled = true;
  }
}



const NAMA_CALL_SIGN_AUTO = [
  "ALFA", "BRAVO", "CHARLIE", "DELTA", "ECHO", "FOXTROT",
  "GOLF", "HOTEL", "INDIA", "JULIET", "KILO", "LIMA",
  "MIKE", "NOVEMBER", "OSCAR", "PAPA", "QUEBEC", "ROMEO",
  "SIERRA", "TANGO", "UNIFORM", "VICTOR", "WHISKEY", "XRAY",
  "YANKEE", "ZULU"
];

function binaCallSignAuto(prefix, jumlah) {
  const asas = atas(prefix);
  const bil = Math.max(1, Number(jumlah) || 1);

  if (bil === 1) return [asas];

  return Array.from({ length: bil }, (_, index) => {
    const suffix = NAMA_CALL_SIGN_AUTO[index] || String(index + 1);
    return `${asas} ${suffix}`.trim();
  });
}

function tambahLokasiAuto(data = {}) {
  const tbody = el("tbodyLokasiAuto");
  if (!tbody) return;

  autoLokasiCounter += 1;

  const tr = document.createElement("tr");
  tr.dataset.autoLokasiId = String(autoLokasiCounter);

  tr.innerHTML = `
    <td>
      <input
        class="auto-call-sign"
        type="text"
        value="${escapeHtml(data.call_sign || "")}"
        placeholder="Contoh: GATE 1"
      >
    </td>

    <td>
      <input
        class="auto-jumlah-pemegang-set"
        type="number"
        min="1"
        max="26"
        step="1"
        value="${escapeHtml(data.jumlah_pemegang_set ?? 1)}"
        title="Bilangan Call Sign / Pemegang Set di tempat tugas ini"
      >
    </td>

    <td>
      <input
        class="auto-jenis-tugas"
        type="text"
        value="${escapeHtml(data.jenis_tugas || jenisPenugasanAutoAktif || atas(el("autoJenisPenugasan")?.value) || "")}"
        placeholder="Pilih Jenis Penugasan di atas"
        readonly
      >
    </td>

    <td>
      <input
        class="auto-tempat-tugas"
        type="text"
        value="${escapeHtml(data.tempat_tugas || "")}"
        placeholder="Contoh: PINTU UTAMA"
      >
    </td>

    <td>
      <input
        class="auto-latitude"
        type="number"
        step="any"
        value="${escapeHtml(data.latitude ?? "")}"
        placeholder="2.7585826"
      >
    </td>

    <td>
      <input
        class="auto-longitude"
        type="number"
        step="any"
        value="${escapeHtml(data.longitude ?? "")}"
        placeholder="101.7096481"
      >
    </td>

    <td>
      <input
        class="auto-radius"
        type="number"
        min="1"
        max="5000"
        step="1"
        value="${escapeHtml(data.radius_meter ?? 30)}"
      >
    </td>

    ${Array.from(
      {
        length: Math.max(
          1,
          kiraBilHariAutoDariKalendar()
        )
      },
      (_, index) => {
        const hari = index + 1;

        return htmlKapasitiHariAuto(
          hari,
          data[`jumlah_hari_${hari}`] ?? 0
        );
      }
    ).join("")}

    <td>
      <button
        class="auto-location-remove"
        type="button"
        onclick="buangLokasiAuto(this)"
      >
        BUANG
      </button>
    </td>
  `;

  tbody.appendChild(tr);
  kemasKiniPilihanLokasiKekalAuto(false);
}


function buangLokasiAuto(butang) {
  const tr = butang?.closest("tr");
  if (!tr) return;

  tr.remove();
  kemasKiniPilihanLokasiKekalAuto(false);

  previewPenugasanAuto = [];
  paparPreviewPenugasanAuto();

  if (el("btnSimpanAuto")) {
    el("btnSimpanAuto").disabled = true;
  }
}


function bacaPetugasDipilihAuto() {
  const hasil = [];

  document
    .querySelectorAll("#tbodyPetugasAuto tr[data-auto-petugas-index]")
    .forEach(tr => {
      const pilih = tr.querySelector(".auto-pilih-petugas");

      if (!pilih?.checked) return;

      const index = Number(tr.dataset.autoPetugasIndex);
      const profil = dataPetugasAuto[index];

      if (!profil) return;

      /* FIX 016: petugas yang sudah ada apa-apa rekod dalam Supabase tidak boleh dijana semula. */
      if (petugasSudahAdaPenugasanAuto.has(atas(profil.no_badan))) return;

      const jenisPetugas =
        jenisTetapPetugasAuto[atas(profil.no_badan)] || "";

      if (
        jenisPetugas !== jenisPenugasanAutoAktif
      ) {
        return;
      }

      const corak =
        atas(tr.querySelector(".auto-corak-tugas")?.value || "ROTATION");

      const lokasiKekal =
        teks(tr.querySelector(".auto-lokasi-kekal")?.value);

      if (corak === "KEKAL" && !lokasiKekal) {
        throw new Error(
          `${atas(profil.pangkat)} ${atas(profil.nama)} (${atas(profil.no_badan)}): ` +
          `Pilih Lokasi Kekal.`
        );
      }

      hasil.push({
        id: profil.id,
        auth_user_id: profil.auth_user_id || null,
        no_badan: atas(profil.no_badan),
        pangkat: atas(profil.pangkat),
        nama: atas(profil.nama),

        // Bawa sekali maklumat profil untuk Pratonton dan Cetakan Jadual.
        telefon:
          teks(profil.telefon) ||
          teks(profil.no_telefon) ||
          "",
        no_telefon:
          teks(profil.no_telefon) ||
          teks(profil.telefon) ||
          "",
        daerah:
          atas(profil.daerah || ""),

        corak_tugas: corak,
        lokasi_kekal: lokasiKekal || null,
        penyelia:
          atas(tr.querySelector(".auto-penyelia-select")?.value) === "YA",
        pemegang_set:
          atas(tr.querySelector(".auto-pemegang-select")?.value) === "YA"
      });
    });

  return hasil;
}

function bacaLokasiAuto() {
  const hasil = [];

  document
    .querySelectorAll("#tbodyLokasiAuto tr")
    .forEach((tr, index) => {
      const callSign =
        atas(tr.querySelector(".auto-call-sign")?.value);

      const jumlahPemegangSetTeks =
        teks(tr.querySelector(".auto-jumlah-pemegang-set")?.value || "1");

      const jumlahPemegangSet = Number(jumlahPemegangSetTeks);

      if (
        !Number.isInteger(jumlahPemegangSet) ||
        jumlahPemegangSet < 1 ||
        jumlahPemegangSet > 26
      ) {
        throw new Error(
          `Lokasi baris ${index + 1}: Jumlah Pemegang Set mesti 1 hingga 26.`
        );
      }

      const jenisTugas =
        jenisPenugasanAutoAktif ||
        atas(el("autoJenisPenugasan")?.value) ||
        atas(tr.querySelector(".auto-jenis-tugas")?.value);

      const tempatTugas =
        atas(tr.querySelector(".auto-tempat-tugas")?.value);

      const latitudeTeks =
        teks(tr.querySelector(".auto-latitude")?.value);

      const longitudeTeks =
        teks(tr.querySelector(".auto-longitude")?.value);

      const radiusTeks =
        teks(tr.querySelector(".auto-radius")?.value);

      const bilHari =
        kiraBilHariAutoDariKalendar();

      const jumlahMengikutHari =
        Array.from(
          {
            length: Math.max(
              0,
              bilHari
            )
          },
          (_, kedudukanHari) => {
            const hari = kedudukanHari + 1;

            const nilai = Number(
              teks(
                tr.querySelector(
                  `.auto-jumlah-hari-${hari}`
                )?.value
              ) || 0
            );

            if (
              !Number.isInteger(nilai) ||
              nilai < 0 ||
              nilai > 5000
            ) {
              throw new Error(
                `Lokasi baris ${index + 1}: Jumlah Petugas Hari ${hari} mesti nombor bulat 0 hingga 5000.`
              );
            }

            return nilai;
          }
        );

      const barisKosong =
        !callSign &&
        !jenisTugas &&
        !tempatTugas &&
        !latitudeTeks &&
        !longitudeTeks &&
        jumlahMengikutHari.every(nilai => nilai === 0);

      if (barisKosong) return;

      if (!jenisTugas) {
        throw new Error(
          `Lokasi baris ${index + 1}: Jenis Tugas wajib diisi.`
        );
      }

      if (!tempatTugas) {
        throw new Error(
          `Lokasi baris ${index + 1}: Tempat Tugas wajib diisi.`
        );
      }

      const latitude = Number(latitudeTeks);
      const longitude = Number(longitudeTeks);
      const radius = Number(radiusTeks || 30);

      if (
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90
      ) {
        throw new Error(
          `Lokasi baris ${index + 1}: Latitude tidak sah.`
        );
      }

      if (
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        throw new Error(
          `Lokasi baris ${index + 1}: Longitude tidak sah.`
        );
      }

      if (
        !Number.isInteger(radius) ||
        radius < 1 ||
        radius > 5000
      ) {
        throw new Error(
          `Lokasi baris ${index + 1}: Radius mesti nombor bulat 1 hingga 5000.`
        );
      }

      const senaraiCallSign =
        binaCallSignAuto(callSign || tempatTugas, jumlahPemegangSet);

      /*
        Satu baris ialah SATU tempat fizikal. Jika ada beberapa pemegang set,
        sistem pecahkan tempat itu kepada beberapa Call Sign. Jumlah petugas
        harian dibahagi seimbang; baki diberikan bermula Call Sign pertama.
      */
      senaraiCallSign.forEach((callSignPenuh, indeksCallSign) => {
        const jumlahCallSignMengikutHari =
          jumlahMengikutHari.map(jumlahKeseluruhan => {
            if (jumlahKeseluruhan <= 0) return 0;

            const asas = Math.floor(jumlahKeseluruhan / jumlahPemegangSet);
            const baki = jumlahKeseluruhan % jumlahPemegangSet;

            return asas + (indeksCallSign < baki ? 1 : 0);
          });

        hasil.push({
          call_sign: callSignPenuh || null,
          call_sign_prefix: callSign || tempatTugas,
          indeks_call_sign: indeksCallSign,
          jumlah_pemegang_set: jumlahPemegangSet,
          jenis_tugas: jenisTugas,
          tempat_tugas: tempatTugas,
          latitude,
          longitude,
          radius_meter: radius,
          jumlah_mengikut_hari: jumlahCallSignMengikutHari
        });
      });
    });

  return hasil;
}


function kemasKiniRingkasanKapasitiAuto() {
  const petugasDipilih =
    document.querySelectorAll(
      "#tbodyPetugasAuto .auto-pilih-petugas:checked"
    ).length;

  const bilHari = kiraBilHariAutoDariKalendar();
  const jumlahHari = [];

  for (let hari = 1; hari <= bilHari; hari += 1) {
    let jumlah = 0;

    document
      .querySelectorAll(`#tbodyLokasiAuto .auto-jumlah-hari-${hari}`)
      .forEach(input => {
        const nilai = Number(input.value || 0);
        if (Number.isFinite(nilai) && nilai > 0) jumlah += Math.floor(nilai);
      });

    jumlahHari.push({ hari, jumlah });
  }

  const status = el("statusJanaAuto");
  if (!status || !petugasDipilih) return;

  const tidakSama = jumlahHari.filter(x => x.jumlah !== petugasDipilih);

  if (tidakSama.length) {
    const butiran = jumlahHari
      .map(x => `Hari ${x.hari}: ${x.jumlah}/${petugasDipilih}`)
      .join(" &nbsp;•&nbsp; ");

    paparMesej(
      "statusJanaAuto",
      `<strong>SEMAKAN JUMLAH MENGIKUT HARI</strong><br>${butiran}<br>` +
      `Setiap hari mesti berjumlah ${petugasDipilih} petugas.`,
      "warning"
    );
  }
}

function binaAgihanLokasiAuto(petugas, lokasi, hari) {
  const baki = lokasi.map(item => ({
    ...item,
    kunci_lokasi:
      `${item.call_sign || ""}|${item.jenis_tugas}|${item.tempat_tugas}`,
    baki: Number(item.jumlah_mengikut_hari?.[hari] || 0)
  }));

  const hasil = [];

  /*
    PERATURAN WAJIB PENYELIA
    ------------------------------------------------------------
    - Setiap TEMPAT TUGAS yang aktif pada hari berkenaan WAJIB
      mempunyai TEPAT 1 penyelia.
    - Petugas yang ditanda PENYELIA = YA akan digunakan sebagai
      penyelia lokasi.
    - Bilangan penyelia yang dipilih mesti sama dengan bilangan
      lokasi aktif pada hari tersebut.
    - Penyelia KEKAL kekal di lokasi yang dipilih.
    - Penyelia ROTATION diagihkan dahulu ke lokasi yang masih belum
      mempunyai penyelia.
    - Selepas itu barulah petugas biasa diagihkan mengikut baki kuota.
  */

  const lokasiAktif =
    baki.filter(item => item.baki > 0);

  const tempatAktif = [
    ...new Set(lokasiAktif.map(item => item.tempat_tugas))
  ];

  const penyeliaDipilih =
    petugas.filter(item => item.penyelia === true);

  if (penyeliaDipilih.length !== tempatAktif.length) {
    throw new Error(
      `Hari ${hari + 1}: Terdapat ${tempatAktif.length} Tempat Tugas fizikal aktif, ` +
      `jadi sistem memerlukan tepat ${tempatAktif.length} penyelia. ` +
      `Penyelia yang ditetapkan sekarang ialah ${penyeliaDipilih.length}. ` +
      `Sila tandakan tepat seorang penyelia bagi setiap Tempat Tugas.`
    );
  }

  const petugasKekal =
    petugas.filter(item =>
      item.corak_tugas === "KEKAL"
    );

  const petugasRotation =
    petugas.filter(item =>
      item.corak_tugas !== "KEKAL"
    );

  const penyeliaLokasi = new Map();
  const petugasSudahDiagih = new Set();

  function masukkanKeSlot(anggota, slot, sebagaiPenyelia = false) {
    if (!slot) {
      throw new Error(
        `Hari ${hari + 1}: Lokasi untuk ${anggota.pangkat} ${anggota.nama} tidak dijumpai.`
      );
    }

    if (slot.baki <= 0) {
      throw new Error(
        `Hari ${hari + 1}: Kuota ${slot.tempat_tugas} tidak mencukupi.`
      );
    }

    if (sebagaiPenyelia) {
      if (penyeliaLokasi.has(slot.tempat_tugas)) {
        const sediaAda = penyeliaLokasi.get(slot.tempat_tugas);
        throw new Error(
          `Hari ${hari + 1}: Tempat Tugas ${slot.tempat_tugas} mempunyai lebih daripada seorang penyelia ` +
          `(${sediaAda.pangkat} ${sediaAda.nama} dan ${anggota.pangkat} ${anggota.nama}). ` +
          `Setiap Tempat Tugas hanya dibenarkan 1 penyelia.`
        );
      }

      penyeliaLokasi.set(slot.tempat_tugas, anggota);
    }

    slot.baki -= 1;
    petugasSudahDiagih.add(anggota.no_badan);

    /*
      Nilai penyelia pada hasil ditentukan oleh kedudukan sebenar
      dalam jadual hari tersebut, bukan sekadar nilai dropdown asal.
    */
    /*
      FIX 015:
      Jangan simpan rujukan objek slot asal di dalam setiap rekod petugas.
      Satu slot boleh digunakan oleh beberapa petugas. Jika objek yang sama
      dikongsi, perubahan Call Sign seorang petugas (contohnya ALFA) akan
      turut menukar Call Sign petugas lain dalam slot yang sama.

      Nilai baki masih ditolak pada slot asal di atas, tetapi rekod hasil
      menerima SALINAN slot yang bebas untuk setiap petugas.
    */
    hasil.push({
      anggota: {
        ...anggota,
        penyelia: sebagaiPenyelia
      },
      slot: {
        ...slot,
        jumlah_mengikut_hari: Array.isArray(slot.jumlah_mengikut_hari)
          ? [...slot.jumlah_mengikut_hari]
          : slot.jumlah_mengikut_hari
      }
    });
  }

  /*
    1. MASUKKAN PETUGAS KEKAL DAHULU.
       Jika petugas KEKAL ialah penyelia, lokasi itu terus mempunyai
       seorang penyelia dan tidak akan menerima penyelia kedua.
  */
  petugasKekal.forEach(anggota => {
    const slot =
      baki.find(item =>
        item.kunci_lokasi === anggota.lokasi_kekal
      );

    if (!slot) {
      throw new Error(
        `Lokasi kekal untuk ${anggota.pangkat} ${anggota.nama} ` +
        `tidak lagi wujud dalam Bahagian 2.`
      );
    }

    if (slot.baki <= 0) {
      throw new Error(
        `Hari ${hari + 1}: Kuota ${slot.tempat_tugas} tidak mencukupi ` +
        `untuk semua petugas KEKAL yang ditetapkan di lokasi tersebut.`
      );
    }

    masukkanKeSlot(
      anggota,
      slot,
      anggota.penyelia === true
    );
  });

  /*
    Ambil lokasi petugas ROTATION pada hari sebelumnya supaya sistem
    masih cuba mengelakkan lokasi yang sama dua hari berturut-turut.
  */
  const lokasiSemalam = new Map();

  if (hari > 0) {
    previewPenugasanAuto
      .filter(item =>
        item.hari === hari &&
        item.corak_tugas !== "KEKAL"
      )
      .forEach(item => {
        lokasiSemalam.set(
          item.no_badan,
          `${item.call_sign || ""}|${item.jenis_tugas}|${item.tempat_tugas}`
        );
      });
  }

  /*
    2. AGIHKAN PENYELIA ROTATION DAHULU.
       Hanya lokasi yang BELUM mempunyai penyelia boleh dipilih.
  */
  const penyeliaRotation =
    petugasRotation
      .filter(item => item.penyelia === true)
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const panjang = Math.max(1, penyeliaDipilih.length);
        const ka = (a.index + hari) % panjang;
        const kb = (b.index + hari) % panjang;
        return ka - kb;
      })
      .map(x => x.item);

  penyeliaRotation.forEach((anggota, urutan) => {
    if (petugasSudahDiagih.has(anggota.no_badan)) return;

    const lokasiSebelum =
      lokasiSemalam.get(anggota.no_badan) || "";

    const lokasiPerluPenyelia =
      baki.filter(item =>
        item.baki > 0 &&
        !penyeliaLokasi.has(item.tempat_tugas)
      );

    let calon = null;

    /* Utamakan lokasi yang bukan lokasi semalam. */
    for (let offset = 0; offset < lokasiPerluPenyelia.length; offset += 1) {
      const idx =
        (urutan + hari + offset) %
        Math.max(1, lokasiPerluPenyelia.length);

      const item = lokasiPerluPenyelia[idx];
      if (!item) continue;

      if (item.kunci_lokasi !== lokasiSebelum) {
        calon = item;
        break;
      }
    }

    /* Jika semua pilihan sama dengan semalam, tetap isi lokasi kosong. */
    if (!calon) {
      calon = lokasiPerluPenyelia[0] || null;
    }

    if (!calon) {
      throw new Error(
        `Hari ${hari + 1}: Tiada Tempat Tugas kosong untuk penyelia ` +
        `${anggota.pangkat} ${anggota.nama}. Semak tetapan penyelia.`
      );
    }

    masukkanKeSlot(anggota, calon, true);
  });

  /*
    3. SEMAKAN WAJIB: SETIAP LOKASI AKTIF MESTI SUDAH ADA 1 PENYELIA
       sebelum petugas biasa diagihkan.
  */
  const lokasiTiadaPenyelia =
    tempatAktif.filter(tempat =>
      !penyeliaLokasi.has(tempat)
    );

  if (lokasiTiadaPenyelia.length) {
    const senarai =
      lokasiTiadaPenyelia.join(", ");

    throw new Error(
      `Hari ${hari + 1}: Tempat Tugas berikut belum mempunyai penyelia: ${senarai}. ` +
      `Setiap Tempat Tugas wajib mempunyai tepat 1 penyelia.`
    );
  }

  /*
    4. AGIHKAN BAKI PETUGAS ROTATION BIASA.
       Penyelia sudah selesai diagihkan dan tidak masuk semula di sini.
  */
  const petugasRotationBiasa =
    petugasRotation
      .filter(item =>
        !petugasSudahDiagih.has(item.no_badan)
      )
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const panjang = Math.max(1, petugasRotation.length);
        const ka = (a.index + hari) % panjang;
        const kb = (b.index + hari) % panjang;
        return ka - kb;
      })
      .map(x => x.item);

  petugasRotationBiasa.forEach((anggota, urutan) => {
    const lokasiSebelum =
      lokasiSemalam.get(anggota.no_badan) || "";

    let calon = null;

    for (let offset = 0; offset < baki.length; offset += 1) {
      const idx =
        (urutan + hari + offset) %
        Math.max(1, baki.length);

      const item = baki[idx];

      if (!item || item.baki <= 0) continue;

      if (item.kunci_lokasi !== lokasiSebelum) {
        calon = item;
        break;
      }
    }

    if (!calon) {
      calon =
        baki.find(item =>
          item.baki > 0
        ) || null;
    }

    if (!calon) {
      throw new Error(
        `Hari ${hari + 1}: Baki kapasiti lokasi tidak mencukupi ` +
        `untuk petugas ROTATION.`
      );
    }

    masukkanKeSlot(anggota, calon, false);
  });

  /*
    5. SEMAK KUOTA LOKASI MESTI HABIS TEPAT.
  */
  const bakiTidakDiguna =
    baki.reduce(
      (jumlah, item) =>
        jumlah + Math.max(0, item.baki),
      0
    );

  if (bakiTidakDiguna !== 0) {
    throw new Error(
      `Hari ${hari + 1}: Terdapat ${bakiTidakDiguna} kuota lokasi ` +
      `yang belum diisi. Semak jumlah petugas.`
    );
  }

  /*
    SUSUNAN MUKTAMAD — FIX 014

    ALFA hanya Penyelia seorang.
    Penyelia ALFA juga Pemegang Set.
    Petugas lain bermula BRAVO.
    Petugas biasa disusun No Badan kecil -> besar.
    Pemegang Set BRAVO/CHARLIE/... = No Badan terbesar dalam kumpulan.
  */
  tempatAktif.forEach(tempat => {
    const rekodTempat =
      hasil.filter(item => item.slot.tempat_tugas === tempat);

    const penyelia =
      rekodTempat.find(item => item.anggota.penyelia === true);

    if (!penyelia) {
      throw new Error(`Hari ${hari + 1}: ${tempat} tidak mempunyai Penyelia.`);
    }

    const rujukan = rekodTempat[0].slot;
    const prefix =
      teks(rujukan.call_sign_prefix) ||
      teks(rujukan.call_sign)
        .replace(/\s+(ALFA|BRAVO|CHARLIE|DELTA|ECHO|FOXTROT|GOLF|HOTEL|INDIA|JULIET|KILO|LIMA|MIKE|NOVEMBER|OSCAR|PAPA|QUEBEC|ROMEO|SIERRA|TANGO|UNIFORM|VICTOR|WHISKEY|XRAY|YANKEE|ZULU)$/i, "")
        .trim();

    const jumlahCallSign =
      Math.max(1, Number(rujukan.jumlah_pemegang_set) || 1);

    // Reset semua holder di lokasi ini.
    rekodTempat.forEach(r => {
      r.anggota.pemegang_set = false;
    });

    // ALFA dikhaskan kepada penyelia sahaja.
    penyelia.slot.call_sign = `${prefix} ALFA`.trim();
    penyelia.slot.call_sign_prefix = prefix;
    penyelia.slot.indeks_call_sign = 0;
    penyelia.slot.jumlah_pemegang_set = jumlahCallSign;
    penyelia.slot.kunci_lokasi = `${tempat}||${prefix} ALFA`;

    const penyeliaBukanPemegangSet =
      lokasiPenyeliaBukanPemegangSetF1(tempat);

    // Tiga lokasi Balai Polis Bergerak: Penyelia ALFA bukan Pemegang Set.
    // Untuk lokasi lain, kekalkan peraturan Penyelia ALFA = Pemegang Set.
    penyelia.anggota.pemegang_set = !penyeliaBukanPemegangSet;

    const biasa =
      rekodTempat
        .filter(r => r !== penyelia)
        .sort((a, b) =>
          bandingPangkatNoBadanF1(a.anggota, b.anggota)
        );

    if (biasa.length) {
      // Lokasi biasa: jumlahCallSign termasuk ALFA (Penyelia ialah Pemegang Set).
      // Tiga lokasi Balai Polis Bergerak khas: ALFA bukan Pemegang Set,
      // maka jumlah pemegang set diagihkan kepada BRAVO/CHARLIE/...
      const bilKumpulan = Math.min(
        Math.max(1, penyeliaBukanPemegangSet ? jumlahCallSign : jumlahCallSign - 1),
        biasa.length
      );

      let offset = 0;

      for (let g = 0; g < bilKumpulan; g++) {
        const baki = biasa.length - offset;
        const bakiKumpulan = bilKumpulan - g;
        const saiz = Math.ceil(baki / bakiKumpulan);
        const grup = biasa.slice(offset, offset + saiz);
        offset += saiz;

        const indeks = g + 1; // 1=BRAVO
        const suffix =
          NAMA_CALL_SIGN_AUTO[indeks] || String(indeks + 1);
        const callSign = `${prefix} ${suffix}`.trim();

        grup.forEach(r => {
          r.slot.call_sign = callSign;
          r.slot.call_sign_prefix = prefix;
          r.slot.indeks_call_sign = indeks;
          r.slot.jumlah_pemegang_set = jumlahCallSign;
          r.slot.kunci_lokasi = `${tempat}||${callSign}`;
        });

        // Pemegang Set dipilih daripada anggota BUKAN PB sahaja.
        // Susunan grup mengikut pangkat khusus kemudian No. Badan;
        // calon terakhir yang layak dipilih sebagai Pemegang Set.
        const calonPemegang = [...grup]
          .reverse()
          .find(r => !ialahPangkatPBF1(r.anggota.pangkat));

        if (!calonPemegang) {
          throw new Error(
            `Hari ${hari + 1}: Kumpulan ${callSign} di ${tempat} hanya mempunyai ` +
            `anggota PB. Pangkat PB tidak boleh menjadi Pemegang Set.`
          );
        }

        calonPemegang.anggota.pemegang_set = true;
      }
    }

    // Validate by VALUES, not object identity.
    const alfa = rekodTempat.filter(r =>
      /\sALFA$/i.test(teks(r.slot.call_sign))
    );

    if (alfa.length !== 1) {
      throw new Error(
        `Hari ${hari + 1}: ${tempat} mesti mempunyai tepat seorang pengguna ALFA.`
      );
    }

    if (alfa[0].anggota.penyelia !== true) {
      throw new Error(
        `Hari ${hari + 1}: ALFA di ${tempat} mesti Penyelia.`
      );
    }

    if (
      penyeliaBukanPemegangSet &&
      alfa[0].anggota.pemegang_set === true
    ) {
      throw new Error(
        `Hari ${hari + 1}: Penyelia ALFA di ${tempat} tidak boleh menjadi Pemegang Set.`
      );
    }

    if (
      !penyeliaBukanPemegangSet &&
      alfa[0].anggota.pemegang_set !== true
    ) {
      throw new Error(
        `Hari ${hari + 1}: ALFA di ${tempat} mesti Penyelia dan Pemegang Set.`
      );
    }

    const pbPemegangSet = rekodTempat.find(r =>
      r.anggota.pemegang_set === true &&
      ialahPangkatPBF1(r.anggota.pangkat)
    );

    if (pbPemegangSet) {
      throw new Error(
        `Hari ${hari + 1}: ${pbPemegangSet.anggota.pangkat} ` +
        `${pbPemegangSet.anggota.nama} di ${tempat} tidak boleh menjadi Pemegang Set.`
      );
    }

    const alfaBukanPenyelia =
      rekodTempat.some(r =>
        /\sALFA$/i.test(teks(r.slot.call_sign)) &&
        r.anggota.penyelia !== true
      );

    if (alfaBukanPenyelia) {
      throw new Error(
        `Hari ${hari + 1}: Petugas biasa tidak dibenarkan menggunakan ALFA di ${tempat}.`
      );
    }
  });

  return hasil;
}

function janaPreviewPenugasanAuto() {
  try {
    const jenisPenugasan =
      atas(el("autoJenisPenugasan")?.value);

    if (!jenisPenugasan) {
      throw new Error(
        "Pilih Jenis Penugasan terlebih dahulu."
      );
    }

    jenisPenugasanAutoAktif =
      jenisPenugasan;

    const tarikhMula = teks(
      el("autoTarikhMula")?.value
    );

    const tarikhTamat = teks(
      el("autoTarikhTamat")?.value
    );

    if (!tarikhMula) {
      throw new Error(
        "Sila pilih Tarikh Mula."
      );
    }

    if (!tarikhTamat) {
      throw new Error(
        "Sila pilih Tarikh Tamat."
      );
    }

    const bilHari =
      kiraBilHariAutoDariKalendar();

    if (bilHari < 1) {
      throw new Error(
        "Julat tarikh tidak sah. Tarikh Tamat mesti sama atau selepas Tarikh Mula."
      );
    }

    const petugas =
      bacaPetugasDipilihAuto();

    const lokasi =
      bacaLokasiAuto();

    if (!petugas.length) {
      throw new Error(
        "Pilih sekurang-kurangnya seorang petugas."
      );
    }

    if (!lokasi.length) {
      throw new Error(
        "Masukkan sekurang-kurangnya satu lokasi / penugasan."
      );
    }

    for (let hari = 0; hari < bilHari; hari += 1) {
      const jumlahKapasitiHari =
        lokasi.reduce(
          (jumlah, item) =>
            jumlah + Number(item.jumlah_mengikut_hari?.[hari] || 0),
          0
        );

      if (jumlahKapasitiHari !== petugas.length) {
        const beza = jumlahKapasitiHari - petugas.length;

        throw new Error(
          `Hari ${hari + 1}: Jumlah petugas mengikut lokasi ialah ${jumlahKapasitiHari}, ` +
          `tetapi petugas dipilih ialah ${petugas.length}. ` +
          (
            beza > 0
              ? `Kurangkan ${beza} petugas pada Hari ${hari + 1}.`
              : `Tambah ${Math.abs(beza)} petugas pada Hari ${hari + 1}.`
          )
        );
      }
    }

    previewPenugasanAuto = [];

    /*
      AGIHAN MENGIKUT KAPASITI + ROTATION TERKAWAL

      Setiap hari, setiap lokasi menerima tepat jumlah anggota
      yang ditetapkan pada kolum HARI 1 hingga HARI 5.

      Sistem cuba mengelakkan seseorang berada di lokasi yang sama
      dua hari berturut-turut. Jika kekangan kapasiti menjadikannya
      mustahil, sistem masih mengutamakan pemenuhan jumlah lokasi.
    */
    for (let hari = 0; hari < bilHari; hari += 1) {
      const tarikh =
        tambahHariISO(
          tarikhMula,
          hari
        );

      const agihan =
        binaAgihanLokasiAuto(
          petugas,
          lokasi,
          hari
        );

      agihan.forEach(({ anggota, slot }) => {
        previewPenugasanAuto.push({
          acara: "FORMULA1",
          hari: hari + 1,
          tarikh,
          no_badan: anggota.no_badan,
          pangkat: anggota.pangkat,
          nama: anggota.nama,
          telefon: anggota.telefon || anggota.no_telefon || "",
          daerah: anggota.daerah || "",
          corak_tugas: anggota.corak_tugas,
          call_sign: slot.call_sign,
          jenis_tugas: slot.jenis_tugas,
          tempat_tugas: slot.tempat_tugas,
          penyelia: anggota.penyelia,
          pemegang_set: anggota.pemegang_set,
          latitude: slot.latitude,
          longitude: slot.longitude,
          radius_meter: slot.radius_meter,
          status: "AKTIF"
        });
      });
    }

    paparPreviewPenugasanAuto();

    if (el("btnSimpanAuto")) {
      el("btnSimpanAuto").disabled =
        previewPenugasanAuto.length === 0;
    }

    paparMesej(
      "statusJanaAuto",
      `<strong>PRATONTON BERJAYA DIJANA</strong><br>` +
      `Jenis: ${escapeHtml(jenisPenugasanAutoAktif)}<br>` +
      `${petugas.length} petugas × ${bilHari} hari = ` +
      `${previewPenugasanAuto.length} rekod penugasan.`,
      "success"
    );

  } catch (error) {
    console.error(
      "Jana preview penugasan gagal:",
      error
    );

    previewPenugasanAuto = [];
    paparPreviewPenugasanAuto();

    if (el("btnSimpanAuto")) {
      el("btnSimpanAuto").disabled = true;
    }

    paparMesej(
      "statusJanaAuto",
      escapeHtml(error.message),
      "error"
    );
  }
}


function paparPreviewPenugasanAuto() {
  const tbody =
    el("tbodyPreviewAuto");

  const ringkasan =
    el("ringkasanAuto");

  if (!tbody) return;

  if (!previewPenugasanAuto.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="empty-row">
          Belum ada pratonton.
        </td>
      </tr>
    `;

    if (ringkasan) {
      ringkasan.textContent =
        "Belum ada jadual dijana.";
    }

    kemasKiniPenapisCetakJadualAuto();
    return;
  }

  let html = "";
  let hariTerakhir = null;

  previewPenugasanAuto
    .forEach(item => {
      if (hariTerakhir !== item.hari) {
        hariTerakhir = item.hari;

        html += `
          <tr class="auto-day-row">
            <td colspan="10">
              HARI ${item.hari}
              &nbsp;•&nbsp;
              ${escapeHtml(formatTarikhMalaysia(item.tarikh))}
              &nbsp;•&nbsp;
              OP LITAR
            </td>
          </tr>
        `;
      }

      html += `
        <tr>
          <td>${item.hari}</td>
          <td>${escapeHtml(formatTarikhMalaysia(item.tarikh))}</td>
          <td>${escapeHtml(item.no_badan)}</td>
          <td>
            ${escapeHtml(item.pangkat)}
            ${escapeHtml(item.nama)}
          </td>
          <td>
            <span class="badge ${item.corak_tugas === "KEKAL" ? "badge-yellow" : "badge-blue"}">
              ${escapeHtml(item.corak_tugas || "ROTATION")}
            </span>
          </td>
          <td>${escapeHtml(item.call_sign || "-")}</td>
          <td>${escapeHtml(item.jenis_tugas)}</td>
          <td>${escapeHtml(item.tempat_tugas)}</td>
          <td>
            <span class="badge ${item.penyelia ? "badge-green" : "badge-gray"}">
              ${item.penyelia ? "YA" : "TIDAK"}
            </span>
          </td>
          <td>
            <span class="badge ${item.pemegang_set ? "badge-green" : "badge-gray"}">
              ${item.pemegang_set ? "YA" : "TIDAK"}
            </span>
          </td>
        </tr>
      `;
    });

  tbody.innerHTML = html;

  const bilHari =
    new Set(
      previewPenugasanAuto.map(item =>
        item.hari
      )
    ).size;

  const bilPetugas =
    new Set(
      previewPenugasanAuto.map(item =>
        item.no_badan
      )
    ).size;

  const bilLokasi =
    new Set(
      previewPenugasanAuto.map(item =>
        `${item.jenis_tugas}|${item.tempat_tugas}`
      )
    ).size;

  const bilPenyelia =
    new Set(
      previewPenugasanAuto
        .filter(item => item.penyelia)
        .map(item => item.no_badan)
    ).size;

  const bilPemegang =
    new Set(
      previewPenugasanAuto
        .filter(item => item.pemegang_set)
        .map(item => item.no_badan)
    ).size;

  const bilKekal =
    new Set(
      previewPenugasanAuto
        .filter(item => item.corak_tugas === "KEKAL")
        .map(item => item.no_badan)
    ).size;

  const bilRotation =
    bilPetugas - bilKekal;

  kemasKiniPenapisCetakJadualAuto();

  if (ringkasan) {
    ringkasan.innerHTML =
      `<strong>${bilPetugas}</strong> Petugas &nbsp;•&nbsp; ` +
      `<strong>${bilHari}</strong> Hari &nbsp;•&nbsp; ` +
      `<strong>${bilLokasi}</strong> Slot &nbsp;•&nbsp; ` +
      `<strong>${bilPenyelia}</strong> Penyelia &nbsp;•&nbsp; ` +
      `<strong>${bilPemegang}</strong> Pemegang Set &nbsp;•&nbsp; ` +
      `<strong>${bilKekal}</strong> Kekal &nbsp;•&nbsp; ` +
      `<strong>${bilRotation}</strong> Rotation &nbsp;•&nbsp; ` +
      `<strong>${previewPenugasanAuto.length}</strong> Rekod<br>` +
      `<span style="color:#aaa">Jumlah setiap lokasi boleh berbeza mengikut hari dan akan mengikut julat tarikh yang dipilih.</span>`;
  }
}


/* ================================================================
   CETAK JADUAL PENUGASAN AUTOMATIK
   Penapis: Tarikh -> Jenis Tugas -> Tempat Tugas
================================================================ */

function pilihanUnikCetakAuto(senarai) {
  return [...new Set(
    (senarai || [])
      .map(item => teks(item))
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "ms"));
}


function isiSelectCetakAuto(id, labelSemua, senarai, nilaiSemasa = "") {
  const select = el(id);
  if (!select) return;

  const unik = pilihanUnikCetakAuto(senarai);

  select.innerHTML =
    `<option value="">${escapeHtml(labelSemua)}</option>` +
    unik.map(item =>
      `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`
    ).join("");

  if (unik.includes(nilaiSemasa)) {
    select.value = nilaiSemasa;
  }
}


function kemasKiniPenapisCetakJadualAuto() {
  const selectTarikh = el("cetakTarikhAuto");
  const selectJenis = el("cetakJenisTugasAuto");
  const selectTempat = el("cetakTempatTugasAuto");
  const btnCetak = el("btnCetakJadualAuto");

  if (!selectTarikh || !selectJenis) return;

  const adaJadual = previewPenugasanAuto.length > 0;

  selectTarikh.disabled = !adaJadual;
  selectJenis.disabled = !adaJadual;
  if (selectTempat) selectTempat.disabled = !adaJadual;
  if (btnCetak) btnCetak.disabled = !adaJadual;

  const tarikhLama = selectTarikh.value;
  const jenisLama = selectJenis.value;

  const tarikh = pilihanUnikCetakAuto(
    previewPenugasanAuto.map(item => item.tarikh)
  );

  selectTarikh.innerHTML =
    '<option value="">PILIH TARIKH</option>' +
    tarikh.map(item =>
      `<option value="${escapeHtml(item)}">${escapeHtml(formatTarikhMalaysia(item))}</option>`
    ).join("");

  if (tarikh.includes(tarikhLama)) {
    selectTarikh.value = tarikhLama;
  } else if (tarikh.length === 1) {
    selectTarikh.value = tarikh[0];
  }

  const dataTarikh = selectTarikh.value
    ? previewPenugasanAuto.filter(item => item.tarikh === selectTarikh.value)
    : previewPenugasanAuto;

  isiSelectCetakAuto(
    "cetakJenisTugasAuto",
    "SEMUA JENIS TUGAS",
    dataTarikh.map(item => item.jenis_tugas),
    jenisLama
  );

  kemasKiniPilihanTempatCetakAuto();
}


function kemasKiniPilihanCetakAuto() {
  const tarikh = el("cetakTarikhAuto")?.value || "";
  const jenisLama = el("cetakJenisTugasAuto")?.value || "";

  const dataTarikh = tarikh
    ? previewPenugasanAuto.filter(item => item.tarikh === tarikh)
    : previewPenugasanAuto;

  isiSelectCetakAuto(
    "cetakJenisTugasAuto",
    "SEMUA JENIS TUGAS",
    dataTarikh.map(item => item.jenis_tugas),
    jenisLama
  );

  kemasKiniPilihanTempatCetakAuto();
}


function kemasKiniPilihanTempatCetakAuto() {
  const tarikh = el("cetakTarikhAuto")?.value || "";
  const jenis = atas(el("cetakJenisTugasAuto")?.value);
  const tempatLama = el("cetakTempatTugasAuto")?.value || "";

  const dataDitapis = previewPenugasanAuto.filter(item => {
    if (tarikh && item.tarikh !== tarikh) return false;
    if (jenis && atas(item.jenis_tugas) !== jenis) return false;
    return true;
  });

  isiSelectCetakAuto(
    "cetakTempatTugasAuto",
    "SEMUA TEMPAT TUGAS",
    dataDitapis.map(item => item.tempat_tugas),
    tempatLama
  );
}


function cetakJadualPenugasanAuto() {
  if (!previewPenugasanAuto.length) {
    alert("Jana pratonton jadual terlebih dahulu.");
    return;
  }

  const tarikh = el("cetakTarikhAuto")?.value || "";
  const jenis = atas(el("cetakJenisTugasAuto")?.value);
  const tempat = atas(el("cetakTempatTugasAuto")?.value);

  if (!tarikh) {
    alert("Sila pilih tarikh untuk dicetak.");
    el("cetakTarikhAuto")?.focus();
    return;
  }

  const rekod = previewPenugasanAuto
    .filter(item => {
      if (item.tarikh !== tarikh) return false;
      if (jenis && atas(item.jenis_tugas) !== jenis) return false;
      if (tempat && atas(item.tempat_tugas) !== tempat) return false;
      return true;
    })
    .sort((a, b) =>
      bandingPangkatNoBadanF1(a, b)
    );

  if (!rekod.length) {
    alert("Tiada rekod dijumpai untuk pilihan cetakan tersebut.");
    return;
  }

  const labelJenis =
    teks(el("cetakJenisTugasAuto")?.value) || "SEMUA JENIS TUGAS";

  const labelTempat =
    teks(el("cetakTempatTugasAuto")?.value) || "SEMUA TEMPAT TUGAS";

  const baris = rekod.map((item, index) => `
    <tr>
      <td class="center">${index + 1}</td>
      <td class="center">${escapeHtml(item.no_badan || "-")}</td>
      <td class="center">${escapeHtml(item.pangkat || "-")}</td>
      <td class="nama">${escapeHtml(item.nama || "-")}</td>
      <td class="center">${escapeHtml(item.telefon || "-")}</td>
      <td class="center">${escapeHtml(item.daerah || "-")}</td>
      <td class="center">${escapeHtml(item.call_sign || "-")}</td>
      <td class="center">${item.penyelia ? "YA" : "TIDAK"}</td>
      <td class="center">${item.pemegang_set ? "YA" : "TIDAK"}</td>
    </tr>
  `).join("");

  const tetingkap = window.open(
    "",
    "_blank",
    "width=1400,height=900"
  );

  if (!tetingkap) {
    alert(
      "Pelayar menghalang tetingkap cetak. " +
      "Benarkan pop-up untuk laman ini dan cuba semula."
    );
    return;
  }

  tetingkap.document.open();
  tetingkap.document.write(`
    <!DOCTYPE html>
    <html lang="ms">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Jadual Penugasan - ${escapeHtml(formatTarikhMalaysia(tarikh))}</title>

      <style>
        @page {
          size: A4 landscape;
          margin: 9mm;
        }

        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          background: #fff;
          color: #111;
          font-family: Arial, Helvetica, sans-serif;
        }

        body {
          padding: 5mm;
        }

        .header {
          text-align: center;
          margin-bottom: 12px;
        }

        .header h1 {
          margin: 0;
          font-size: 19px;
          font-weight: 800;
        }

        .header h2 {
          margin: 4px 0 0;
          font-size: 15px;
          font-weight: 700;
        }

        .maklumat {
          width: 100%;
          margin: 12px 0 10px;
          border-collapse: collapse;
          font-size: 11px;
        }

        .maklumat td {
          border: 0;
          padding: 2px 4px;
          vertical-align: top;
        }

        .maklumat .label {
          width: 105px;
          font-weight: 700;
        }

        .jadual {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 9px;
        }

        .jadual th,
        .jadual td {
          border: 1px solid #333;
          padding: 5px 4px;
          vertical-align: middle;
          overflow-wrap: anywhere;
        }

        .jadual th {
          background: #ececec;
          text-align: center;
          font-weight: 800;
        }

        .jadual .center {
          text-align: center;
        }

        .jadual .nama {
          text-align: left;
          font-weight: 600;
        }

        .jadual th:nth-child(1) { width: 4%; }
        .jadual th:nth-child(2) { width: 9%; }
        .jadual th:nth-child(3) { width: 7%; }
        .jadual th:nth-child(4) { width: 25%; }
        .jadual th:nth-child(5) { width: 12%; }
        .jadual th:nth-child(6) { width: 10%; }
        .jadual th:nth-child(7) { width: 11%; }
        .jadual th:nth-child(8) { width: 10%; }
        .jadual th:nth-child(9) { width: 12%; }

        .jumlah {
          margin-top: 10px;
          font-size: 11px;
          font-weight: 700;
        }

        thead {
          display: table-header-group;
        }

        tr {
          break-inside: avoid;
        }

        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>

    <body>
      <header class="header">
        <h1>OP LITAR</h1>
        <h2>JADUAL PENUGASAN PETUGAS</h2>
      </header>

      <table class="maklumat">
        <tr>
          <td class="label">TARIKH</td>
          <td>: ${escapeHtml(formatTarikhMalaysia(tarikh))}</td>
        </tr>
        <tr>
          <td class="label">JENIS TUGAS</td>
          <td>: ${escapeHtml(labelJenis)}</td>
        </tr>
        <tr>
          <td class="label">TEMPAT TUGAS</td>
          <td>: ${escapeHtml(labelTempat)}</td>
        </tr>
      </table>

      <table class="jadual">
        <thead>
          <tr>
            <th>BIL</th>
            <th>NO BADAN</th>
            <th>PANGKAT</th>
            <th>NAMA</th>
            <th>NO TELEFON</th>
            <th>DAERAH</th>
            <th>CALL SIGN</th>
            <th>PENYELIA</th>
            <th>PEMEGANG SET</th>
          </tr>
        </thead>
        <tbody>
          ${baris}
        </tbody>
      </table>

      <div class="jumlah">
        JUMLAH PETUGAS: ${rekod.length}
      </div>

      <script>
        window.addEventListener("load", function () {
          setTimeout(function () {
            window.focus();
            window.print();
          }, 300);
        });
      <\/script>
    </body>
    </html>
  `);

  tetingkap.document.close();
}



/* ================================================================
   FIX 20261003 — SYNC JADUAL JANA PENUGASAN
   Buang rekod lama dalam Supabase yang sudah tiada dalam Pratonton
   bagi TARIKH + JENIS TUGAS yang sedang disimpan.
================================================================ */
async function syncBuangPenugasanLamaAuto(payload) {
  const rekodBaharu = Array.isArray(payload) ? payload : [];
  if (!rekodBaharu.length) return 0;

  const tarikhTerlibat = [...new Set(
    rekodBaharu.map(item => teks(item.tarikh)).filter(Boolean)
  )];

  const jenisTerlibat = [...new Set(
    rekodBaharu.map(item => atas(item.jenis_tugas)).filter(Boolean)
  )];

  if (!tarikhTerlibat.length || !jenisTerlibat.length) return 0;

  /*
    Ambil profil untuk memadankan petugas_id/profile_id kepada No Badan.
    Ini menyokong rekod lama yang mungkin menyimpan profiles.id
    atau profiles.auth_user_id.
  */
  const { data: profilData, error: profilError } = await denganHadMasa(
    db.from("profiles").select("id,auth_user_id,no_badan")
  );

  if (profilError) throw profilError;

  const noBadanById = new Map();

  (profilData || []).forEach(item => {
    const noBadan = atas(item.no_badan);
    if (!noBadan) return;

    if (item.id) {
      noBadanById.set(String(item.id), noBadan);
    }

    if (item.auth_user_id) {
      noBadanById.set(String(item.auth_user_id), noBadan);
    }
  });

  /*
    Kunci rekod yang memang masih wujud dalam Pratonton.
    No Badan + Tarikh + Jenis Tugas digunakan supaya lokasi/call sign
    boleh berubah tanpa dianggap sebagai petugas yang telah dibuang.
  */
  const kunciBaharu = new Set(
    rekodBaharu.map(item =>
      [
        teks(item.tarikh),
        atas(item.jenis_tugas),
        atas(item.no_badan)
      ].join("|")
    )
  );

  const { data: rekodSediaAda, error: rekodError } = await denganHadMasa(
    db.from("penugasan")
      .select("id,tarikh,jenis_tugas,petugas_id,profile_id,no_badan")
      .in("tarikh", tarikhTerlibat)
      .in("jenis_tugas", jenisTerlibat)
  );

  if (rekodError) throw rekodError;

  const idUntukPadam = (rekodSediaAda || [])
    .filter(item => {
      const petugasId = String(item.petugas_id || item.profile_id || "");
      const noBadan =
        atas(item.no_badan) ||
        noBadanById.get(petugasId) ||
        "";

      const kunci = [
        teks(item.tarikh),
        atas(item.jenis_tugas),
        noBadan
      ].join("|");

      return noBadan && !kunciBaharu.has(kunci);
    })
    .map(item => item.id)
    .filter(Boolean);

  if (!idUntukPadam.length) return 0;

  /*
    Jangan padam rekod yang sudah mempunyai Check-In / Check-Out.
    Ini melindungi rekod kehadiran yang telah berlaku.
  */
  const [checkinRes, checkoutRes] = await Promise.all([
    denganHadMasa(
      db.from("checkin")
        .select("penugasan_id")
        .in("penugasan_id", idUntukPadam)
    ),
    denganHadMasa(
      db.from("checkout")
        .select("penugasan_id")
        .in("penugasan_id", idUntukPadam)
    )
  ]);

  if (checkinRes.error) throw checkinRes.error;
  if (checkoutRes.error) throw checkoutRes.error;

  const idAdaKehadiran = new Set([
    ...(checkinRes.data || []).map(item => String(item.penugasan_id)),
    ...(checkoutRes.data || []).map(item => String(item.penugasan_id))
  ]);

  const idSelamatPadam = idUntukPadam.filter(
    id => !idAdaKehadiran.has(String(id))
  );

  if (!idSelamatPadam.length) return 0;

  const kumpulanPadam = bahagiKumpulan(idSelamatPadam, 200);
  let jumlahDipadam = 0;

  for (const kumpulan of kumpulanPadam) {
    const { data, error } = await denganHadMasa(
      db.from("penugasan")
        .delete()
        .in("id", kumpulan)
        .select("id")
    );

    if (error) {
      const mesej = String(error.message || "");

      if (/row-level security|permission denied|policy/i.test(mesej)) {
        throw new Error(
          "Jadual baharu berjaya disimpan tetapi rekod lama tidak dapat dipadam. " +
          "Semak polisi DELETE (RLS) table penugasan untuk Pentadbir."
        );
      }

      throw error;
    }

    jumlahDipadam += (data || []).length;
  }

  return jumlahDipadam;
}


async function simpanPenugasanAuto() {
  if (
    autoSedangSimpan ||
    !previewPenugasanAuto.length
  ) {
    return;
  }

  const jumlah =
    previewPenugasanAuto.length;

  if (!confirm(
    `Simpan ${jumlah} rekod penugasan OP LITAR ke Supabase?\n\n` +
    `Jika No Badan dan tarikh yang sama sudah wujud, ` +
    `rekod tersebut akan dikemas kini oleh sistem import sedia ada.`
  )) {
    return;
  }

  autoSedangSimpan = true;

  const butang =
    el("btnSimpanAuto");

  if (butang) {
    butang.disabled = true;
  }

  let diproses = 0;
  let berjaya = 0;
  let baharu = 0;
  let dikemasKini = 0;
  let gagal = 0;
  const semuaRalat = [];

  try {
    /*
      Payload sengaja menggunakan struktur yang SAMA dengan
      Import Penugasan CSV sedia ada. Tiada kolum baharu dihantar.
    */
    const payload =
      previewPenugasanAuto
        .map((item, index) => ({
          baris: index + 1,
          tarikh: item.tarikh,
          no_badan: item.no_badan,
          call_sign: item.call_sign || null,
          jenis_tugas: item.jenis_tugas,
          tempat_tugas: item.tempat_tugas,
          penyelia: item.penyelia === true,
          pemegang_set: item.pemegang_set === true,
          latitude: item.latitude,
          longitude: item.longitude,
          radius_meter: item.radius_meter,
          status: "AKTIF"
        }));

    const kumpulan =
      bahagiKumpulan(
        payload,
        200
      );

    for (
      let i = 0;
      i < kumpulan.length;
      i += 1
    ) {
      if (butang) {
        butang.textContent =
          `MENYIMPAN ${diproses} / ${jumlah}...`;
      }

      paparMesej(
        "statusJanaAuto",
        `Sedang menyimpan kumpulan ${i + 1} ` +
        `daripada ${kumpulan.length}...`,
        "warning"
      );

      const { data, error } =
        await denganHadMasa(
          db.rpc(
            "import_penugasan_csv",
            {
              p_rekod: kumpulan[i]
            }
          ),
          60000
        );

      if (error) {
        const mesej =
          `${error.code || ""} ${error.message || ""}`;

        if (
          /PGRST202|does not exist|schema cache|Could not find/i
            .test(mesej)
        ) {
          throw new Error(
            "Fungsi import_penugasan_csv belum dipasang atau " +
            "tidak ditemui dalam Supabase."
          );
        }

        throw error;
      }

      const hasil =
        typeof data === "string"
          ? JSON.parse(data)
          : (data || {});

      berjaya +=
        Number(hasil.berjaya || 0);

      baharu +=
        Number(hasil.baharu || 0);

      dikemasKini +=
        Number(hasil.dikemas_kini || 0);

      gagal +=
        Number(hasil.gagal || 0);

      if (Array.isArray(hasil.ralat)) {
        semuaRalat.push(
          ...hasil.ralat
        );
      }

      diproses +=
        kumpulan[i].length;
    }

    const butiranRalat =
      semuaRalat.length
        ? `<br><details>` +
          `<summary>Lihat ${semuaRalat.length} ralat</summary>` +
          `<ul>` +
          semuaRalat
            .slice(0, 100)
            .map(item =>
              `<li>Baris ${escapeHtml(item.baris || "-")}: ` +
              `${escapeHtml(item.mesej || "Ralat")}</li>`
            )
            .join("") +
          `</ul></details>`
        : "";

    paparMesej(
      "statusJanaAuto",
      `<strong>SIMPANAN PENUGASAN SELESAI</strong><br>` +
      `Berjaya: ${berjaya} ` +
      `(Baharu: ${baharu}, Dikemas kini: ${dikemasKini})<br>` +
      `Gagal: ${gagal}` +
      butiranRalat,
      gagal ? "warning" : "success"
    );

    /*
      FIX 20261003:
      Selepas INSERT/UPDATE selesai, selaraskan Supabase dengan Pratonton.
      Rekod lama yang sudah tiada dalam Pratonton akan dibuang bagi
      tarikh + jenis tugas yang sedang disimpan.
    */
    const jumlahDipadam =
      await syncBuangPenugasanLamaAuto(payload);

    const tarikhPertama =
      previewPenugasanAuto[0]?.tarikh;

    if (
      el("tarikh") &&
      tarikhPertama
    ) {
      el("tarikh").value =
        tarikhPertama;
    }

    if (jumlahDipadam > 0) {
      paparMesej(
        "statusJanaAuto",
        `<strong>SIMPANAN & SYNC SELESAI</strong><br>` +
        `Berjaya: ${berjaya} ` +
        `(Baharu: ${baharu}, Dikemas kini: ${dikemasKini})<br>` +
        `Rekod lama dibuang: ${jumlahDipadam}<br>` +
        `Gagal: ${gagal}` +
        butiranRalat,
        gagal ? "warning" : "success"
      );
    }

    await muatData(true);

  } catch (error) {
    console.error(
      "Simpan penugasan automatik gagal:",
      error
    );

    paparMesej(
      "statusJanaAuto",
      `Simpan gagal: ${escapeHtml(error.message)}`,
      "error"
    );

  } finally {
    autoSedangSimpan = false;

    if (butang) {
      butang.textContent =
        "SIMPAN KE SUPABASE";

      butang.disabled =
        previewPenugasanAuto.length === 0;
    }
  }
}


async function resetJanaPenugasanAuto() {
  if (
    !confirm(
      "Reset borang Jana Penugasan? Jadual yang telah disimpan di Supabase akan dikekalkan dan dimuatkan semula ke Pratonton Jadual."
    )
  ) {
    return;
  }

  // Kekalkan julat tarikh operasi supaya RESET tidak mengecilkan
  // pratonton tersimpan kepada satu hari sahaja.
  const tarikhMulaSebelumReset =
    teks(el("autoTarikhMula")?.value) ||
    teks(el("tarikh")?.value) ||
    hariIniMalaysia();

  const tarikhTamatSebelumReset =
    teks(el("autoTarikhTamat")?.value) ||
    tarikhMulaSebelumReset;

  const tbodyLokasi =
    el("tbodyLokasiAuto");

  if (tbodyLokasi) {
    tbodyLokasi.innerHTML = "";
  }

  for (let i = 0; i < 4; i += 1) {
    tambahLokasiAuto();
  }

  pilihSemuaPetugasAuto(true);

  document
    .querySelectorAll(
      "#tbodyPetugasAuto .auto-penyelia-select, " +
      "#tbodyPetugasAuto .auto-pemegang-select"
    )
    .forEach(select => {
      select.value = "TIDAK";
      kemasKiniWarnaSelectAuto(select);
    });

  document
    .querySelectorAll("#tbodyPetugasAuto tr[data-auto-petugas-index]")
    .forEach(tr => {
      const corak = tr.querySelector(".auto-corak-tugas");
      const lokasi = tr.querySelector(".auto-lokasi-kekal");

      if (corak) corak.value = "ROTATION";

      if (lokasi) {
        lokasi.value = "";
        lokasi.disabled = true;
      }
    });

  if (el("autoTarikhMula")) {
    el("autoTarikhMula").value = tarikhMulaSebelumReset;
  }

  if (el("autoTarikhTamat")) {
    el("autoTarikhTamat").value = tarikhTamatSebelumReset;
  }

  selaraskanKolumHariAuto();

  if (el("btnSimpanAuto")) {
    el("btnSimpanAuto").disabled = true;
  }

  const status =
    el("statusJanaAuto");

  if (status) {
    status.className = "status-box";
    status.innerHTML = "";
  }

  // RESET hanya mengosongkan borang penjanaan.
  // Jadual yang sudah disimpan tidak dipadam; muat semula dari Supabase.
  try {
    await muatJadualTersimpanKePratontonAuto();
  } catch (error) {
    console.error("Gagal memuat semula pratonton selepas RESET:", error);
    paparMesej(
      "statusJanaAuto",
      `Borang telah direset tetapi jadual tersimpan gagal dimuatkan semula: ${escapeHtml(error.message)}`,
      "error"
    );
  }
}


function sediakanJanaPenugasanAuto() {
  const inputMula = el("autoTarikhMula");
  const inputTamat = el("autoTarikhTamat");

  const tarikhAsas =
    el("tarikh")?.value ||
    hariIniMalaysia();

  if (
    inputMula &&
    !inputMula.value
  ) {
    inputMula.value =
      tarikhAsas;
  }

  if (
    inputTamat &&
    !inputTamat.value
  ) {
    inputTamat.value =
      inputMula?.value ||
      tarikhAsas;
  }

  [inputMula, inputTamat]
    .filter(Boolean)
    .forEach(input => {
      if (
        !input.dataset.listenerKalendarAuto
      ) {
        input.addEventListener(
          "change",
          kemasKiniBilHariAutoDariKalendar
        );

        input.dataset.listenerKalendarAuto =
          "1";
      }
    });

  selaraskanKolumHariAuto();

  const tbodyLokasi =
    el("tbodyLokasiAuto");

  if (
    tbodyLokasi &&
    !tbodyLokasi.children.length
  ) {
    for (
      let i = 0;
      i < 4;
      i += 1
    ) {
      tambahLokasiAuto();
    }
  }

  selaraskanKolumHariAuto();
}


/* ================================================================
   RESET DEVICE
================================================================ */

function bukaModalResetDevice(petugasId) {
  const rekod = dataDashboard.find(item => item.petugasId === petugasId);
  if (!rekod) return;

  rekodResetDevice = rekod;
  el("maklumatResetDevice").innerHTML = `
    <strong>${escapeHtml(rekod.pangkat)} ${escapeHtml(rekod.nama)}</strong><br>
    No Badan: ${escapeHtml(rekod.noBadan)}<br>
    Device ID Terikat: ${escapeHtml(rekod.deviceId || "TIADA")}<br><br>

    <strong>Fungsi Reset:</strong><br>
    Sebarang ikatan peranti petugas ini akan dibuang.
    Rekod Check-In, Check-Out dan status kehadiran akan <strong>DIKEKALKAN</strong>.<br><br>

    Selepas reset, petugas boleh login menggunakan telefon mereka sendiri
    dan telefon tersebut akan didaftarkan sebagai peranti petugas.
  `;
  el("statusModalResetDevice").innerHTML = "";
  el("modalResetDevice").style.display = "block";
}

function tutupModalResetDevice() {
  rekodResetDevice = null;
  el("modalResetDevice").style.display = "none";
}

async function hantarResetDevice() {
  if (!rekodResetDevice) return;

  const butang = el("btnSahkanResetDevice");

  if (!confirm(
    `Sahkan RESET DEVICE untuk ${rekodResetDevice.noBadan}? ` +
    "Rekod Check-In, Check-Out dan status kehadiran akan dikekalkan."
  )) return;

  butang.disabled = true;
  butang.textContent = "SEDANG RESET...";

  try {
    /*
      RPC ini hanya membuang device_bindings petugas.
      Ia TIDAK menyentuh:
      - checkin
      - checkout
      - penugasan
      - device_whitelist / Peranti Khas Admin
    */
    const hasil = await denganHadMasa(
      db.rpc("nyahikat_peranti_petugas", {
        p_no_badan: rekodResetDevice.noBadan
      })
    );

    if (hasil.error) {
      if (/PGRST202|schema cache|does not exist/i.test(
        `${hasil.error.code || ""} ${hasil.error.message || ""}`
      )) {
        throw new Error(
          "Fungsi nyahikat_peranti_petugas belum dipasang atau belum dikemas kini dalam Supabase."
        );
      }

      throw hasil.error;
    }

    if (!hasil.data || hasil.data.success !== true) {
      throw new Error(
        hasil.data?.message ||
        "Reset Device gagal."
      );
    }

    paparMesej(
      "statusModalResetDevice",
      `<strong>RESET DEVICE BERJAYA.</strong><br>` +
      `${escapeHtml(hasil.data.message || "Ikatan peranti telah dibuang.")}<br><br>` +
      `Rekod kehadiran dikekalkan. Petugas kini boleh login menggunakan telefon mereka sendiri.`,
      "success"
    );

    /*
      Kemas kini data tempatan terus supaya butang/status tidak
      bergantung kepada cache lama.
    */
    const idPetugas = rekodResetDevice.petugasId;

    dataDashboard.forEach(item => {
      if (item.petugasId === idPetugas) {
        item.deviceId = "";
        item.deviceDiikatPada = null;
        item.deviceKaliTerakhir = null;
      }
    });

    setTimeout(async () => {
      tutupModalResetDevice();
      await muatData(false);
    }, 1300);

  } catch (error) {
    console.error("Reset Device gagal:", error);

    paparMesej(
      "statusModalResetDevice",
      `Reset Device gagal: ${escapeHtml(error.message)}`,
      "error"
    );

  } finally {
    butang.disabled = false;
    butang.textContent = "SAHKAN RESET DEVICE";
  }
}

/* ================================================================
   NAVIGASI MODUL PENTADBIR
================================================================ */

/*
  Menutup semua modul tambahan supaya hanya satu modul
  dipaparkan pada satu masa.
*/
function tutupSemuaModulPentadbir() {
  pulihkanCartaDaripadaLaporanHarian();
  const aiSubtek = el("modulSkpoAiSubtek");
  if (aiSubtek) { aiSubtek.hidden = true; aiSubtek.style.display = "none"; }
  const senaraiModul = [
    {
      idModul: "modulPerantiKhasAdmin",
      idKandungan: "",
      idButang: "",
      teksButang: ""
    },
    {
      idModul: "modulImportPengguna",
      idKandungan: "kandunganImportPengguna",
      idButang: "btnToggleImportPengguna",
      teksButang: "PAPARKAN IMPORT"
    },
    {
      idModul: "modulJanaPenugasan",
      idKandungan: "",
      idButang: "btnBukaJanaPenugasan",
      teksButang: "JANA PENUGASAN"
    },
    {
      idModul: "modulImportPenugasan",
      idKandungan: "kandunganImportPenugasan",
      idButang: "btnToggleImportPenugasan",
      teksButang: "PAPARKAN IMPORT"
    },
    {
      idModul: "modulDaftarPengguna",
      idKandungan: "borangDaftarPengguna",
      idButang: "btnToggleDaftarPengguna",
      teksButang: "PAPARKAN BORANG"
    },
    {
      idModul: "modulLaporanPentadbir",
      idKandungan: "",
      idButang: "",
      teksButang: ""
    },
    {
      idModul: "modulPassKenderaanPentadbir",
      idKandungan: "",
      idButang: "btnBukaPassKenderaan",
      teksButang: "PASS & KENDERAAN"
    },
    {
      idModul: "modulCartaPentadbir",
      idKandungan: "",
      idButang: "btnBukaCartaPentadbir",
      teksButang: "CARTA"
    },
    {
      idModul: "modulLaporanKeseluruhanHarian",
      idKandungan: "",
      idButang: "btnBukaLaporanKeseluruhanHarian",
      teksButang: "LAPORAN KESELURUHAN HARIAN"
    }
  ];

  senaraiModul.forEach(item => {
    const modul = el(item.idModul);
    const kandungan = el(item.idKandungan);
    const butang = el(item.idButang);

    if (modul) {
      modul.hidden = true;
      modul.setAttribute("hidden", "");
      modul.style.display = "none";
      modul.classList.remove("modul-disorot");
    }

    if (kandungan) {
      kandungan.hidden = true;
      kandungan.setAttribute("hidden", "");
    }

    if (butang) {
      butang.setAttribute("aria-expanded", "false");
      butang.textContent = item.teksButang;
    }
  });
}


/*
  Membuka modul yang dipilih dan membawa paparan
  ke bahagian modul tersebut.
*/
function bukaDanSkrolModul(
  idModul,
  idKandungan,
  idButangToggle,
  teksButangBuka
) {
  const modul = el(idModul);
  const kandungan = el(idKandungan);
  const butangToggle = el(idButangToggle);

  if (!modul) {
    console.error(`Modul tidak ditemui: ${idModul}`);
    alert("Modul tidak ditemui. Sila semak ID modul dalam admin.html.");
    return;
  }

  /*
    Tutup modul lain terlebih dahulu.
  */
  tutupSemuaModulPentadbir();

  /*
    Paparkan section utama.
  */
  modul.hidden = false;
  modul.removeAttribute("hidden");
  modul.style.removeProperty("display");

  /*
    Paparkan kandungan di dalam section.
  */
  if (kandungan) {
    kandungan.hidden = false;
    kandungan.removeAttribute("hidden");
    kandungan.style.removeProperty("display");
  }

  /*
    Kemas kini butang Paparkan/Sembunyikan.
  */
  if (butangToggle) {
    butangToggle.setAttribute("aria-expanded", "true");
    butangToggle.textContent = teksButangBuka;
  }

  /*
    Beri masa kepada browser untuk melukis modul,
    kemudian scroll ke modul.
  */
  window.setTimeout(() => {
    modul.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest"
    });

    modul.classList.remove("modul-disorot");

    void modul.offsetWidth;

    modul.classList.add("modul-disorot");

    window.setTimeout(() => {
      modul.classList.remove("modul-disorot");
    }, 1800);
  }, 100);
}


function tutupPerantiKhasAdmin() {
  const modul = el("modulPerantiKhasAdmin");
  if (!modul) return;

  modul.hidden = true;
  modul.style.display = "none";
  modul.classList.remove("modul-disorot");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


function bukaPerantiKhasAdmin() {
  tutupSemuaModulPentadbir();

  const modul = el("modulPerantiKhasAdmin");
  if (!modul) {
    alert("Modul Peranti Khas Pentadbir tidak dijumpai.");
    return;
  }

  modul.hidden = false;
  modul.removeAttribute("hidden");
  modul.style.removeProperty("display");
  modul.classList.add("modul-disorot");

  muatPerantiKhasAdmin();

  modul.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}


function bukaImportPengguna() {
  bukaDanSkrolModul(
    "modulImportPengguna",
    "kandunganImportPengguna",
    "btnToggleImportPengguna",
    "SEMBUNYIKAN IMPORT"
  );
}


function bukaImportPenugasan() {
  bukaDanSkrolModul(
    "modulImportPenugasan",
    "kandunganImportPenugasan",
    "btnToggleImportPenugasan",
    "SEMBUNYIKAN IMPORT"
  );
}


function bukaDaftarPengguna() {
  bukaDanSkrolModul(
    "modulDaftarPengguna",
    "borangDaftarPengguna",
    "btnToggleDaftarPengguna",
    "SEMBUNYIKAN BORANG"
  );
}

function bukaModulLaporanPentadbir() {
  tutupSemuaModulPentadbir();

  const modul = el("modulLaporanPentadbir");
  if (!modul) return;

  modul.hidden = false;
  modul.removeAttribute("hidden");
  modul.style.removeProperty("display");

  const inputTarikh = el("tarikhLaporanPentadbir");
  if (inputTarikh && !inputTarikh.value) {
    inputTarikh.value = el("tarikh")?.value || hariIniMalaysia();
  }

  tukarTabLaporanPentadbir(tabLaporanAdminAktif, false);
  muatLaporanPentadbir();
  modul.scrollIntoView({ behavior: "smooth", block: "start" });
}

function tutupModulLaporanPentadbir() {
  const modul = el("modulLaporanPentadbir");
  if (!modul) return;
  modul.hidden = true;
  modul.setAttribute("hidden", "");
  modul.style.display = "none";
}


/* ================================================================
   TOGGLE MODUL
================================================================ */

function toggleDaftarPengguna() {
  const modul = el("modulDaftarPengguna");
  const kandungan = el("borangDaftarPengguna");
  const butang = el("btnToggleDaftarPengguna");

  if (!modul || !kandungan || !butang) return;

  const sedangTerbuka = !kandungan.hidden;

  if (sedangTerbuka) {
    kandungan.hidden = true;
    kandungan.setAttribute("hidden", "");

    modul.hidden = true;
    modul.setAttribute("hidden", "");
    modul.style.display = "none";

    butang.setAttribute("aria-expanded", "false");
    butang.textContent = "PAPARKAN BORANG";
  } else {
    modul.hidden = false;
    modul.removeAttribute("hidden");
    modul.style.removeProperty("display");

    kandungan.hidden = false;
    kandungan.removeAttribute("hidden");

    butang.setAttribute("aria-expanded", "true");
    butang.textContent = "SEMBUNYIKAN BORANG";
  }
}


function toggleBahagianImport(
  idModul,
  idKandungan,
  idButang
) {
  const modul = el(idModul);
  const kandungan = el(idKandungan);
  const butang = el(idButang);

  if (!modul || !kandungan || !butang) return;

  const sedangTerbuka = !kandungan.hidden;

  if (sedangTerbuka) {
    kandungan.hidden = true;
    kandungan.setAttribute("hidden", "");

    modul.hidden = true;
    modul.setAttribute("hidden", "");
    modul.style.display = "none";

    butang.setAttribute("aria-expanded", "false");
    butang.textContent = "PAPARKAN IMPORT";
  } else {
    modul.hidden = false;
    modul.removeAttribute("hidden");
    modul.style.removeProperty("display");

    kandungan.hidden = false;
    kandungan.removeAttribute("hidden");

    butang.setAttribute("aria-expanded", "true");
    butang.textContent = "SEMBUNYIKAN IMPORT";
  }
}


function toggleImportPengguna() {
  toggleBahagianImport(
    "modulImportPengguna",
    "kandunganImportPengguna",
    "btnToggleImportPengguna"
  );
}


function toggleImportPenugasan() {
  toggleBahagianImport(
    "modulImportPenugasan",
    "kandunganImportPenugasan",
    "btnToggleImportPenugasan"
  );
}

/* ================================================================
   MODUL LAPORAN PENTADBIR
================================================================ */

function tukarTabLaporanPentadbir(tab, perluPapar = true) {
  tabLaporanAdminAktif = tab === "sitrep" ? "sitrep" : "petugas";

  const petugasAktif = tabLaporanAdminAktif === "petugas";
  const tabPetugas = el("tabAdminLaporanPetugas");
  const tabSitrep = el("tabAdminSitrep");

  tabPetugas?.classList.toggle("active", petugasAktif);
  tabSitrep?.classList.toggle("active", !petugasAktif);
  tabPetugas?.setAttribute("aria-selected", String(petugasAktif));
  tabSitrep?.setAttribute("aria-selected", String(!petugasAktif));

  if (el("panelAdminLaporanPetugas")) {
    el("panelAdminLaporanPetugas").hidden = !petugasAktif;
  }
  if (el("panelAdminSitrep")) {
    el("panelAdminSitrep").hidden = petugasAktif;
  }

  if (perluPapar) paparLaporanPentadbir();
}

function tarikhMalaysiaDaripadaMasa(nilai) {
  if (!nilai) return "";
  const masa = new Date(nilai);
  if (Number.isNaN(masa.getTime())) return teks(nilai).slice(0, 10);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZON_MASA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(masa);
}

function formatMasaLaporanAdmin(nilai) {
  if (!nilai) return "-";
  const masa = new Date(nilai);
  if (Number.isNaN(masa.getTime())) return teks(nilai) || "-";

  return new Intl.DateTimeFormat("ms-MY", {
    timeZone: ZON_MASA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(masa);
}

async function muatLaporanPentadbir() {
  const tarikh = el("tarikhLaporanPentadbir")?.value || hariIniMalaysia();
  const status = el("statusLaporanPentadbir");

  if (status) {
    status.className = "status warning";
    status.textContent = "Sedang mendapatkan laporan...";
  }

  try {
    const [laporanRes, sitrepRes, profilRes, tugasRes] = await Promise.all([
      db.from("pelaporan")
        .select("*")
        .order("tarikh_masa", { ascending: false })
        .limit(500),
      db.from("sitrep")
        .select("*")
        .eq("tarikh", tarikh)
        .order("created_at", { ascending: false })
        .limit(500),
      db.from("profiles")
        .select("id,no_badan,pangkat,nama")
        .limit(2000),
      db.from("penugasan")
        .select("*")
        .eq("tarikh", tarikh)
        .limit(2000)
    ]);

    if (laporanRes.error) throw laporanRes.error;
    if (sitrepRes.error) throw sitrepRes.error;
    if (profilRes.error) throw profilRes.error;
    if (tugasRes.error) throw tugasRes.error;

    const profilMap = new Map((profilRes.data || []).map(item => [item.id, item]));
    const tugasMap = new Map((tugasRes.data || []).map(item => [item.id, item]));

    dataLaporanPetugasAdmin = (laporanRes.data || [])
      .filter(item => {
        const sudahDibaca = item.dibaca === true || Boolean(item.dibaca_pada);
        return sudahDibaca && tarikhMalaysiaDaripadaMasa(item.tarikh_masa) === tarikh;
      })
      .map(item => ({
        ...item,
        profil: profilMap.get(item.petugas_id) || null,
        penugasan: tugasMap.get(item.penugasan_id) || null
      }));

    dataSitrepAdmin = (sitrepRes.data || []).map(item => ({
      ...item,
      profil: profilMap.get(item.pengirim_id || item.dicipta_oleh || item.profile_id) || null
    }));

    if (status) {
      status.className = "status success";
      status.textContent =
        `${dataLaporanPetugasAdmin.length} laporan telah dibaca dan ` +
        `${dataSitrepAdmin.length} rekod SITREP ditemui.`;
    }

    paparLaporanPentadbir();
  } catch (error) {
    console.error("Muat laporan Pentadbir gagal:", error);
    dataLaporanPetugasAdmin = [];
    dataSitrepAdmin = [];

    if (status) {
      status.className = "status error";
      status.textContent = `Laporan gagal dimuatkan: ${error.message || "Ralat tidak diketahui."}`;
    }
    paparLaporanPentadbir();
  }
}

function paparLaporanPentadbir() {
  const carian = atas(el("carianLaporanPentadbir")?.value);
  const tbodyLaporan = el("tbodyLaporanPetugasAdmin");
  const tbodySitrep = el("tbodySitrepAdmin");

  const laporanDitapis = dataLaporanPetugasAdmin.filter(item => {
    const profil = item.profil || {};
    const tugasItem = item.penugasan || {};
    return !carian || atas([
      profil.no_badan, profil.pangkat, profil.nama,
      tugasItem.call_sign, tugasItem.tempat_tugas, tugasItem.lokasi,
      item.vvip_vip, item.perkara_menarik
    ].join(" ")).includes(carian);
  });

  if (tbodyLaporan) {
    tbodyLaporan.innerHTML = laporanDitapis.length
      ? laporanDitapis.map((item, index) => {
          const profil = item.profil || {};
          const tugasItem = item.penugasan || {};
          const nama = [profil.pangkat, profil.nama].filter(Boolean).join(" ") || "-";
          const lokasi = tugasItem.call_sign || tugasItem.tempat_tugas || tugasItem.lokasi || "-";
          return `
            <tr>
              <td>${index + 1}</td>
              <td><strong>${escapeHtml(nama)}</strong><br>${escapeHtml(profil.no_badan || "-")}</td>
              <td>${escapeHtml(lokasi)}</td>
              <td>${escapeHtml(formatMasaLaporanAdmin(item.tarikh_masa))}</td>
              <td><button class="gray compact-print" type="button" onclick="cetakLaporanPetugasAdmin('${escapeHtml(item.id)}')">CETAK</button></td>
            </tr>`;
        }).join("")
      : '<tr><td colspan="5" class="empty-row">Tiada laporan yang telah dibaca untuk tarikh ini.</td></tr>';
  }

  const sitrepDitapis = dataSitrepAdmin.filter(item => {
    const profil = item.profil || {};
    return !carian || atas([
      item.tajuk, item.musuh, item.kedudukan, item.tugas, item.tadbir,
      item.perancangan_hadapan, item.kekuatan, item.pegawai_pemerintah_medan,
      item.keselamatan, item.keutamaan, profil.nama, profil.no_badan
    ].join(" ")).includes(carian);
  });

  if (tbodySitrep) {
    tbodySitrep.innerHTML = sitrepDitapis.length
      ? sitrepDitapis.map((item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(item.tadbir || "-")}</td>
            <td>${escapeHtml(formatMasaLaporanAdmin(item.created_at || item.tarikh_masa))}</td>
            <td>
              <div
                style="
                  display:grid;
                  grid-template-columns:190px 130px;
                  gap:8px;
                  justify-content:center;
                  align-items:center;
                  width:100%;
                "
              >
                ${
                  item.lampiran_path
                    ? `
                      <button
                        class="compact-print"
                        type="button"
                        style="
                          width:190px;
                          min-width:190px;
                          max-width:190px;
                          height:42px;
                          min-height:42px;
                          max-height:42px;
                          margin:0;
                          padding:0 14px;
                          background:#2e7d32;
                          color:#ffffff;
                          border:0;
                          border-radius:8px;
                          font-weight:700;
                          box-sizing:border-box;
                        "
                        onclick="muatTurunLampiranSitrepAdmin(
                          '${escapeHtml(item.lampiran_path)}',
                          '${escapeHtml(item.lampiran_nama || "lampiran")}'
                        )"
                      >
                        MUAT TURUN LAMPIRAN
                      </button>
                    `
                    : ""
                }

                <button
                  class="gray compact-print"
                  type="button"
                  style="
                    width:130px;
                    min-width:130px;
                    max-width:130px;
                    height:42px;
                    min-height:42px;
                    max-height:42px;
                    margin:0;
                    box-sizing:border-box;
                  "
                  onclick="cetakSitrepAdmin('${escapeHtml(item.id)}')"
                >
                  CETAK
                </button>
              </div>
            </td>
          </tr>`).join("")
      : '<tr><td colspan="4" class="empty-row">Tiada rekod SITREP untuk tarikh ini.</td></tr>';

    const jadualSitrep = tbodySitrep.closest("table");

    if (jadualSitrep) {
      const kepala = jadualSitrep.querySelectorAll("thead th");

      if (kepala[2]) {
        kepala[2].style.textAlign = "center";
        kepala[2].style.width = "220px";
      }

      if (kepala[3]) {
        kepala[3].style.textAlign = "center";
        kepala[3].style.width = "340px";
      }

      jadualSitrep
        .querySelectorAll("tbody td:nth-child(3)")
        .forEach(td => {
          td.style.textAlign = "center";
          td.style.verticalAlign = "middle";
          td.style.whiteSpace = "nowrap";
        });

      jadualSitrep
        .querySelectorAll("tbody td:nth-child(4)")
        .forEach(td => {
          td.style.textAlign = "center";
          td.style.verticalAlign = "middle";
          td.style.width = "340px";
        });
    }
  }
}

function bukaCetakanAdmin(tajuk, kandungan) {
  const tetingkap = window.open("", "_blank", "width=900,height=700");
  if (!tetingkap) {
    alert("Paparan cetak disekat oleh pelayar. Benarkan pop-up dan cuba semula.");
    return;
  }

  tetingkap.document.write(`<!doctype html>
    <html lang="ms"><head><meta charset="utf-8"><title>${escapeHtml(tajuk)}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#111;margin:32px;line-height:1.5}
      h1{font-size:22px;text-align:center;margin:0 0 8px}
      .subtitle{text-align:center;margin:0 0 24px;color:#444}
      .meta{border:1px solid #bbb;padding:12px;margin-bottom:18px}
      .field{margin:0 0 14px;page-break-inside:avoid;white-space:pre-wrap}
      .field strong{display:block;margin-bottom:4px}
      .attachment{max-width:100%;max-height:520px}
      @media print{button{display:none}}
    </style></head><body>
    <h1>${escapeHtml(tajuk)}</h1>
    <p class="subtitle">SKPO OP LITAR</p>
    ${kandungan}
    <script>window.onload=()=>setTimeout(()=>window.print(),250);<\/script>
    </body></html>`);
  tetingkap.document.close();
}

function normalisasiJenisTugasCetakAdmin(nilai) {
  const jenis = atas(nilai)
    .replace(/\s+/g, " ")
    .trim();

  if (jenis.includes("KAWALAN KESELAMATAN")) {
    return "KAWALAN KESELAMATAN";
  }

  if (
    jenis.includes("KAWALAN LALULINTAS") ||
    jenis.includes("KAWALAN LALU LINTAS")
  ) {
    return "KAWALAN LALULINTAS";
  }

  if (jenis.includes("RONDAAN PENCEGAHAN JENAYAH NARKOTIK")) {
    return "RONDAAN PENCEGAHAN JENAYAH NARKOTIK";
  }

  if (jenis.includes("RONDAAN PENCEGAHAN JENAYAH KOMERSIL")) {
    return "RONDAAN PENCEGAHAN JENAYAH KOMERSIL";
  }

  if (jenis.includes("RONDAAN PENCEGAHAN JENAYAH")) {
    return "RONDAAN PENCEGAHAN JENAYAH";
  }

  if (jenis.includes("BALAI POLIS BERGERAK")) {
    return "BALAI POLIS BERGERAK";
  }

  if (jenis.includes("PONDOK POLIS")) {
    return "PONDOK POLIS";
  }

  if (
    jenis.includes("UNIT PEMUSNAH BOM") ||
    jenis === "UPB"
  ) {
    return "UNIT PEMUSNAH BOM";
  }

  return jenis;
}


function nilaiAdaTiadaCetakAdmin(objek) {
  if (!objek || typeof objek !== "object") {
    return teks(objek) || "TIADA";
  }

  const status = atas(objek.status);
  const butiran = teks(objek.butiran);

  if (status === "ADA") {
    return butiran || "ADA";
  }

  return "TIADA";
}


function medanDinamikCetakLaporanAdmin(item) {
  const tugasItem = item.penugasan || {};

  const jenis = normalisasiJenisTugasCetakAdmin(
    item.jenis_tugas ||
    tugasItem.jenis_tugas ||
    "-"
  );

  const data =
    item.data_laporan &&
    typeof item.data_laporan === "object"
      ? item.data_laporan
      : {};

  /*
    Laporan lama: kekalkan paparan asal jika data_laporan kosong.
  */
  if (!Object.keys(data).length) {
    return [
      ["Jumlah Pengunjung", item.jumlah_pengunjung ?? "-"],
      ["Jumlah Kenderaan", item.jumlah_kenderaan ?? "-"],
      ["VVIP / VIP", item.vvip_vip || "TIADA"],
      ["Perkara Menarik", item.perkara_menarik || "TIADA"]
    ];
  }


  if (jenis === "KAWALAN KESELAMATAN") {
    const kenderaan =
      data.kenderaan &&
      typeof data.kenderaan === "object"
        ? data.kenderaan
        : {};

    return [
      ["Keadaan Keselamatan", data.keadaan_keselamatan || "-"],
      ["Jumlah Pengunjung", data.jumlah_pengunjung ?? item.jumlah_pengunjung ?? 0],
      ["Jumlah Kenderaan", kenderaan.jumlah ?? item.jumlah_kenderaan ?? 0],
      ["Bas", kenderaan.bas ?? 0],
      ["Motosikal", kenderaan.motosikal ?? 0],
      ["Motokar", kenderaan.motokar ?? 0],
      ["VVIP / VIP", nilaiAdaTiadaCetakAdmin(data.vvip_vip)],
      ["Catatan", data.catatan || item.perkara_menarik || "TIADA"]
    ];
  }


  if (jenis === "KAWALAN LALULINTAS") {
    return [
      ["Keadaan Trafik", data.keadaan_trafik || "-"],
      ["Jumlah Kenderaan", data.jumlah_kenderaan ?? item.jumlah_kenderaan ?? 0],
      ["Kemalangan", nilaiAdaTiadaCetakAdmin(data.kemalangan)],
      ["Catatan / Tindakan", data.catatan_tindakan || item.perkara_menarik || "TIADA"]
    ];
  }


  if (
    jenis === "RONDAAN PENCEGAHAN JENAYAH" ||
    jenis === "RONDAAN PENCEGAHAN JENAYAH NARKOTIK" ||
    jenis === "RONDAAN PENCEGAHAN JENAYAH KOMERSIL"
  ) {
    const pemeriksaan =
      data.pemeriksaan &&
      typeof data.pemeriksaan === "object"
        ? data.pemeriksaan
        : {};

    return [
      ["Lokasi Rondaan", data.lokasi_rondaan || "-"],
      ["Jumlah Pemeriksaan", pemeriksaan.jumlah ?? 0],
      ["Lelaki", pemeriksaan.lelaki ?? 0],
      ["Perempuan", pemeriksaan.perempuan ?? 0],
      ["Tangkapan", nilaiAdaTiadaCetakAdmin(data.tangkapan)],
      ["Rampasan", nilaiAdaTiadaCetakAdmin(data.rampasan)],
      ["Catatan / No. Repot", data.catatan_no_repot || item.perkara_menarik || "TIADA"]
    ];
  }


  if (
    jenis === "BALAI POLIS BERGERAK" ||
    jenis === "PONDOK POLIS"
  ) {
    return [
      ["No. Repot", data.no_repot || "TIADA"],
      ["Catatan", data.catatan || item.perkara_menarik || "TIADA"]
    ];
  }


  if (jenis === "UNIT PEMUSNAH BOM") {
    return [
      ["Lokasi", data.lokasi || "-"],
      ["VVIP / VIP", nilaiAdaTiadaCetakAdmin(data.vvip_vip)],
      ["Jenis Ancaman", nilaiAdaTiadaCetakAdmin(data.jenis_ancaman)],
      ["Catatan", data.catatan || item.perkara_menarik || "TIADA"]
    ];
  }


  return [
    ["Jumlah Pengunjung", item.jumlah_pengunjung ?? "-"],
    ["Jumlah Kenderaan", item.jumlah_kenderaan ?? "-"],
    ["VVIP / VIP", item.vvip_vip || "TIADA"],
    ["Perkara Menarik", item.perkara_menarik || "TIADA"]
  ];
}


function cetakLaporanPetugasAdmin(id) {
  const item = dataLaporanPetugasAdmin.find(
    rekod => String(rekod.id) === String(id)
  );

  if (!item) {
    return alert("Rekod laporan tidak ditemui.");
  }

  const profil = item.profil || {};
  const tugasItem = item.penugasan || {};

  const nama =
    [profil.pangkat, profil.nama]
      .filter(Boolean)
      .join(" ") || "-";

  const jenisTugas =
    item.jenis_tugas ||
    tugasItem.jenis_tugas ||
    "-";

  const medan = [
    ["Petugas", nama],
    ["No Badan", profil.no_badan || "-"],
    ["Call Sign", tugasItem.call_sign || "-"],
    ["Jenis Tugas", jenisTugas],
    ["Tempat Tugas", tugasItem.tempat_tugas || tugasItem.lokasi || "-"],
    ["Tarikh / Masa", formatMasaLaporanAdmin(item.tarikh_masa)],

    ...medanDinamikCetakLaporanAdmin(item),

    ["Dibaca Pada", formatMasaLaporanAdmin(item.dibaca_pada)]
  ];

  bukaCetakanAdmin(
    "LAPORAN PETUGAS",
    medan.map(([label, nilai]) =>
      `<div class="field">` +
        `<strong>${escapeHtml(label)}</strong>` +
        `${escapeHtml(nilai ?? "-")}` +
      `</div>`
    ).join("")
  );
}



async function muatTurunLampiranSitrepAdmin(laluan, namaFail = "lampiran") {
  if (!laluan) {
    alert("Lampiran SITREP tidak ditemui.");
    return;
  }

  try {
    const { data, error } = await db.storage
      .from(BUCKET_SITREP_ADMIN)
      .download(laluan);

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("Fail lampiran tidak ditemui.");
    }

    const url = URL.createObjectURL(data);
    const pautan = document.createElement("a");

    pautan.href = url;
    pautan.download = namaFail || "lampiran";
    pautan.style.display = "none";

    document.body.appendChild(pautan);
    pautan.click();
    pautan.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1500);

  } catch (error) {
    console.error("Muat turun lampiran SITREP Admin gagal:", error);

    alert(
      "Lampiran gagal dimuat turun: " +
      (error.message || "Ralat tidak diketahui.")
    );
  }
}


function cetakSitrepAdmin(id) {
  const item = dataSitrepAdmin.find(rekod => String(rekod.id) === String(id));
  if (!item) return alert("Rekod SITREP tidak ditemui.");

  const profil = item.profil || {};
  const medan = [
    ["1. Tajuk", item.tajuk],
    ["2. Musuh", item.musuh],
    ["3. Kedudukan", item.kedudukan],
    ["4. Tugas", item.tugas],
    ["5. Tadbir", item.tadbir],
    ["6. Perancangan Hadapan", item.perancangan_hadapan],
    ["7. Kekuatan", item.kekuatan],
    ["8. Pegawai Pemerintah Medan", item.pegawai_pemerintah_medan],
    ["9. Keselamatan", item.keselamatan],
    ["10. Keutamaan", item.keutamaan],
    ["11. Lampiran", item.lampiran_url || item.lampiran_nama || "TIADA"]
  ];

  const pengirim = [profil.pangkat, profil.nama].filter(Boolean).join(" ") || item.pengirim_nama || "-";
  const meta = `
    <div class="meta">
      <strong>Pengirim:</strong> ${escapeHtml(pengirim)}
      &nbsp; | &nbsp; <strong>No Badan:</strong> ${escapeHtml(profil.no_badan || item.pengirim_no_badan || "-")}
      <br><strong>Masa dihantar:</strong> ${escapeHtml(formatMasaLaporanAdmin(item.created_at || item.tarikh_masa))}
    </div>`;

  bukaCetakanAdmin("SITUATION REPORT (SITREP)", meta + medan.map(([label, nilai]) => {
    const teksNilai = nilai || "-";
    const lampiranImej = label.startsWith("11.") && /^https?:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(teksNilai)
      ? `<br><img class="attachment" src="${escapeHtml(teksNilai)}" alt="Lampiran SITREP">`
      : "";
    return `<div class="field"><strong>${escapeHtml(label)}</strong>${escapeHtml(teksNilai)}${lampiranImej}</div>`;
  }).join(""));
}


/* ================================================================
   PERMULAAN HALAMAN
================================================================ */


/* ================================================================
   CARTA OPERASI PENTADBIR
================================================================ */

function nomborCarta(nilai, fallback = 0) {
  const nombor = Number(nilai);
  return Number.isFinite(nombor) ? nombor : fallback;
}


function dataLaporanCarta(item) {
  return item?.data_laporan &&
    typeof item.data_laporan === "object" &&
    !Array.isArray(item.data_laporan)
      ? item.data_laporan
      : {};
}


function jenisTugasCarta(item) {
  return atas(
    item?.jenis_tugas ||
    item?.penugasan?.jenis_tugas ||
    ""
  );
}


function nilaiAdaCarta(nilai) {
  if (nilai === null || nilai === undefined) return false;

  if (typeof nilai === "object") {
    if (Array.isArray(nilai)) {
      return nilai.some(item => nilaiAdaCarta(item));
    }

    if ("ada" in nilai) {
      return nilaiBoolean(nilai.ada);
    }

    if ("status" in nilai) {
      const status = atas(nilai.status);
      if (["TIADA", "TIDAK", "NONE", "FALSE", "0", "-"].includes(status)) {
        return false;
      }
    }

    return Object.values(nilai).some(item => nilaiAdaCarta(item));
  }

  const teksNilai = atas(nilai);

  return Boolean(
    teksNilai &&
    ![
      "TIADA",
      "TIDAK",
      "NONE",
      "N/A",
      "NA",
      "NIL",
      "-",
      "0",
      "FALSE"
    ].includes(teksNilai)
  );
}


function teksNilaiCarta(nilai) {
  if (nilai === null || nilai === undefined || nilai === "") {
    return "";
  }

  if (Array.isArray(nilai)) {
    return nilai
      .map(item => teksNilaiCarta(item))
      .filter(Boolean)
      .join("\n");
  }

  if (typeof nilai === "object") {
    const calon =
      nilai.nama ||
      nilai.butiran ||
      nilai.catatan ||
      nilai.keterangan ||
      nilai.nilai ||
      nilai.teks;

    if (calon) {
      return teksNilaiCarta(calon);
    }

    return Object.entries(nilai)
      .filter(([kunci]) => !["ada", "status"].includes(kunci))
      .map(([kunci, value]) => `${kunci}: ${teksNilaiCarta(value)}`)
      .filter(item => !item.endsWith(": "))
      .join("\n");
  }

  return teks(nilai);
}


function masaCartaLabel(nilai) {
  if (!nilai) return "-";

  const tarikh = new Date(nilai);

  if (Number.isNaN(tarikh.getTime())) {
    return teks(nilai);
  }

  return new Intl.DateTimeFormat("ms-MY", {
    timeZone: ZON_MASA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(tarikh);
}


function kemusnahkanCartaPentadbir(carta) {
  if (carta && typeof carta.destroy === "function") {
    carta.destroy();
  }
}


function pastikanChartJsPentadbir() {
  if (typeof window.Chart !== "function") {
    throw new Error(
      "Chart.js tidak dimuatkan. Pastikan script Chart.js berada sebelum js/admin.js dalam admin.html."
    );
  }
}


function bukaModulCartaPentadbir() {
  tutupSemuaModulPentadbir();

  const modul = el("modulCartaPentadbir");

  if (!modul) {
    alert(
      "Modul CARTA belum terdapat dalam admin.html. Gunakan admin.html yang telah ditambah Modul Carta."
    );
    return;
  }

  modul.hidden = false;
  modul.removeAttribute("hidden");
  modul.style.removeProperty("display");

  const butang = el("btnBukaCartaPentadbir");
  if (butang) {
    butang.setAttribute("aria-expanded", "true");
  }

  const inputTarikh = el("tarikhCartaPentadbir");

  if (inputTarikh && !inputTarikh.value) {
    inputTarikh.value =
      el("tarikh")?.value ||
      hariIniMalaysia();
  }

  muatDataCartaPentadbir();

  setTimeout(() => {
    modul.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, 40);
}


function tutupModulCartaPentadbir() {
  const modul = el("modulCartaPentadbir");

  if (!modul) return;

  modul.hidden = true;
  modul.setAttribute("hidden", "");
  modul.style.display = "none";

  const butang = el("btnBukaCartaPentadbir");

  if (butang) {
    butang.setAttribute("aria-expanded", "false");
  }
}


async function muatDataCartaPentadbir() {
  if (!adminLogin) return;

  const tarikh =
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    hariIniMalaysia();

  if (el("tarikhCartaPentadbir")) {
    el("tarikhCartaPentadbir").value = tarikh;
  }

  paparMesej(
    "statusCartaPentadbir",
    "Sedang menyediakan carta operasi...",
    "warning"
  );

  try {
    /*
      Dashboard petugas digunakan oleh Carta Kehadiran dan Peta.
      Jika tarikh carta berbeza daripada dashboard semasa,
      muat semula dashboard untuk tarikh tersebut.
    */
    if (el("tarikh")) {
      const tarikhDashboard = el("tarikh").value;

      if (tarikhDashboard !== tarikh) {
        el("tarikh").value = tarikh;
        await muatData(true);
      } else if (!dataDashboard.length) {
        await muatData(true);
      }
    }

    // FIX006: ambil laporan terus dalam julat tarikh Malaysia yang dipilih.
    const mulaHari = new Date(`${tarikh}T00:00:00+08:00`).toISOString();
    const tamatHariObj = new Date(`${tarikh}T00:00:00+08:00`);
    tamatHariObj.setDate(tamatHariObj.getDate() + 1);
    const laporanRes = await denganHadMasa(
      db.from("pelaporan")
        .select("*")
        .gte("tarikh_masa", mulaHari)
        .lt("tarikh_masa", tamatHariObj.toISOString())
        .order("tarikh_masa", { ascending: true })
        .limit(10000)
    );

    if (laporanRes.error) {
      throw laporanRes.error;
    }

    dataCartaLaporanPentadbir =
      (laporanRes.data || [])
        .filter(item =>
          tarikhMalaysiaDaripadaMasa(item.tarikh_masa) === tarikh
        );

    /*
      Rekod tambahan manual Pengunjung dan Kenderaan
      dimuat terus daripada Supabase supaya data sama
      pada semua peranti Pentadbir.
    */
    await muatDataManualCartaPentadbir(tarikh);

    await Promise.all([
      muatJawatankuasaOperasiPentadbir(tarikh, false),
      muatAgensiLuarOperasiPentadbir(tarikh, false),
      muatVvipVipOperasiPentadbir(tarikh, false)
    ]);

    paparRingkasanCartaPentadbir();
    paparCartaPengunjungPentadbir();
    paparCartaKenderaanPentadbir();
    paparCartaKehadiranPentadbir();
    paparCartaInsidenPentadbir();
    paparCartaVvipVipPentadbir();
    paparCartaJawatankuasaPentadbir();
    paparCartaAgensiLuarPentadbir();

    muatPetaCartaPentadbir();
    paparKronologiPentadbir();

    paparMesej(
      "statusCartaPentadbir",
      `${dataCartaLaporanPentadbir.length} laporan dan ${dataDashboard.length} rekod penugasan diproses untuk carta.`,
      "success"
    );

  } catch (error) {
    console.error(
      "Muat Carta Pentadbir gagal:",
      error
    );

    paparMesej(
      "statusCartaPentadbir",
      `Ralat memuatkan carta: ${escapeHtml(error.message || "Ralat tidak diketahui.")}`,
      "error"
    );
  }
}



async function muatDataManualCartaPentadbir(tarikhInput) {
  const tarikh =
    teks(tarikhInput) ||
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    hariIniMalaysia();

  const { data, error } =
    await denganHadMasa(
      db.from(
        JADUAL_CARTA_MANUAL_F1
      )
        .select("*")
        .eq(
          "tarikh",
          tarikh
        )
        .in(
          "jenis",
          [
            "PENGUNJUNG",
            "KENDERAAN"
          ]
        )
        .order(
          "masa",
          {
            ascending: true
          }
        )
        .order(
          "created_at",
          {
            ascending: true
          }
        )
    );

  if (error) {
    if (
      error.code === "42P01" ||
      /carta_manual/i.test(
        error.message || ""
      )
    ) {
      throw new Error(
        "Jadual Supabase carta_manual belum diwujudkan. Jalankan fail SQL yang disertakan terlebih dahulu."
      );
    }

    throw error;
  }

  const senarai =
    data ||
    [];

  dataPengunjungManualPentadbir =
    senarai.filter(
      item =>
        atas(
          item.jenis
        ) ===
        "PENGUNJUNG"
    );

  dataKenderaanManualPentadbir =
    senarai.filter(
      item =>
        atas(
          item.jenis
        ) ===
        "KENDERAAN"
    );
}


function masaDaripadaSupabasePentadbir(nilai) {
  const masa =
    teks(nilai);

  if (!masa) return "00:00";

  return masa
    .slice(
      0,
      5
    );
}


function masaSekarangInputPentadbir() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: ZON_MASA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date()).replace('.', ':');
}

function masaManualCartaPentadbir(item) {
  const tarikh =
    teks(
      item?.tarikh
    ) ||
    hariIniMalaysia();

  const masa =
    masaDaripadaSupabasePentadbir(
      item?.masa
    ) ||
    "00:00";

  return `${tarikh}T${masa}:00+08:00`;
}

function rekodPengunjungManualSintetikPentadbir(item) {
  return {
    id:
      `MANUAL-PENGUNJUNG-${item.id}`,

    tarikh_masa:
      masaManualCartaPentadbir(
        item
      ),

    jenis_tugas:
      "KAWALAN KESELAMATAN",

    jumlah_pengunjung:
      nomborCarta(
        item.jumlah_pengunjung,
        0
      ),

    jumlah_kenderaan:
      0,

    nama_petugas:
      "PENTADBIR (MANUAL)",

    no_badan:
      item.created_by_no_badan ||
      adminLogin?.noBadan ||
      "-",

    call_sign:
      "MANUAL",

    data_laporan: {
      jumlah_pengunjung:
        nomborCarta(
          item.jumlah_pengunjung,
          0
        ),

      lokasi:
        item.lokasi ||
        "-",

      catatan:
        item.catatan ||
        "",

      sumber_manual:
        true
    },

    _manual:
      true,

    _manualJenis:
      "PENGUNJUNG",

    _manualId:
      item.id
  };
}

function rekodKenderaanManualSintetikPentadbir(item) {
  const bas =
    nomborCarta(
      item.bas,
      0
    );

  const motosikal =
    nomborCarta(
      item.motosikal,
      0
    );

  const motokar =
    nomborCarta(
      item.motokar,
      0
    );

  return {
    id:
      `MANUAL-KENDERAAN-${item.id}`,

    tarikh_masa:
      masaManualCartaPentadbir(
        item
      ),

    jenis_tugas:
      "KAWALAN KESELAMATAN",

    jumlah_pengunjung:
      0,

    jumlah_kenderaan:
      bas +
      motosikal +
      motokar,

    nama_petugas:
      "PENTADBIR (MANUAL)",

    no_badan:
      item.created_by_no_badan ||
      adminLogin?.noBadan ||
      "-",

    call_sign:
      "MANUAL",

    data_laporan: {
      lokasi:
        item.lokasi ||
        "-",

      kenderaan: {
        bas,
        motosikal,
        motokar,
        jumlah:
          bas +
          motosikal +
          motokar
      },

      catatan:
        item.catatan ||
        "",

      sumber_manual:
        true
    },

    _manual:
      true,

    _manualJenis:
      "KENDERAAN",

    _manualId:
      item.id
  };
}

function senaraiPengunjungCartaPentadbir() {
  const tarikh = el("tarikhCartaPentadbir")?.value || el("tarikh")?.value || hariIniMalaysia();
  const manual = dataPengunjungManualPentadbir
    .filter(item => teks(item.tarikh) === tarikh)
    .map(rekodPengunjungManualSintetikPentadbir);
  return [...laporanKeselamatanCarta(), ...manual].sort((a,b) => new Date(a.tarikh_masa || 0) - new Date(b.tarikh_masa || 0));
}

function senaraiKenderaanCartaPentadbir() {
  const tarikh = el("tarikhCartaPentadbir")?.value || el("tarikh")?.value || hariIniMalaysia();
  const manual = dataKenderaanManualPentadbir
    .filter(item => teks(item.tarikh) === tarikh)
    .map(rekodKenderaanManualSintetikPentadbir);
  return [...laporanKeselamatanCarta(), ...manual].sort((a,b) => new Date(a.tarikh_masa || 0) - new Date(b.tarikh_masa || 0));
}

function bukaModalPengunjungManualPentadbir(mod = "TAMBAH") {
  modPengunjungManualPentadbir = atas(mod) === "TOLAK" ? "TOLAK" : "TAMBAH";

  const tarikh = el("tarikhCartaPentadbir")?.value || el("tarikh")?.value || hariIniMalaysia();
  if (el("tarikhPengunjungManualPentadbir")) el("tarikhPengunjungManualPentadbir").value = tarikh;
  if (el("masaPengunjungManualPentadbir")) el("masaPengunjungManualPentadbir").value = masaSekarangInputPentadbir();
  if (el("lokasiPengunjungManualPentadbir")) el("lokasiPengunjungManualPentadbir").value = "";
  if (el("jumlahPengunjungManualPentadbir")) el("jumlahPengunjungManualPentadbir").value = "1";
  if (el("catatanPengunjungManualPentadbir")) el("catatanPengunjungManualPentadbir").value = "";

  const modTolak = modPengunjungManualPentadbir === "TOLAK";
  if (el("tajukModalPengunjungManualPentadbir")) {
    el("tajukModalPengunjungManualPentadbir").textContent =
      modTolak ? "Pengunjung Beredar Keluar" : "Tambah Pengunjung";
  }

  if (el("peneranganModalPengunjungManualPentadbir")) {
    el("peneranganModalPengunjungManualPentadbir").textContent =
      modTolak
        ? "Masukkan jumlah pengunjung yang telah beredar keluar."
        : "Masukkan rekod pengunjung secara manual untuk Carta Pengunjung.";
  }

  if (el("labelJumlahPengunjungManualPentadbir")) {
    el("labelJumlahPengunjungManualPentadbir").textContent =
      modTolak ? "Jumlah Pengunjung Beredar Keluar *" : "Jumlah Pengunjung *";
  }

  const butang = el("btnSimpanPengunjungManualPentadbir");
  if (butang) {
    butang.textContent = modTolak ? "SIMPAN PENGUNJUNG BEREDAR KELUAR" : "SIMPAN PENGUNJUNG";
    butang.classList.toggle("red", modTolak);
    butang.classList.toggle("green-button", !modTolak);
  }

  const status = el("statusPengunjungManualPentadbir");
  if (status) { status.className = "status-box"; status.innerHTML = ""; }
  const modal = el("modalPengunjungManualPentadbir");

  if (!modal) {
    console.error("Modal pengunjung manual tidak ditemui.");
    alert("Borang Pengunjung tidak ditemui. Sila muat semula halaman.");
    return;
  }

  modal.hidden = false;
  modal.removeAttribute("hidden");
  modal.classList.add("open");
  modal.style.display = "block";
  modal.style.zIndex = "99999";

  setTimeout(() => {
    el("jumlahPengunjungManualPentadbir")?.focus();
  }, 50);
}

function bukaTambahPengunjungManualPentadbir() {
  bukaModalPengunjungManualPentadbir("TAMBAH");
}

function bukaTolakPengunjungManualPentadbir() {
  bukaModalPengunjungManualPentadbir("TOLAK");
}

function tutupModalPengunjungManualPentadbir() {
  const modal = el("modalPengunjungManualPentadbir");
  if (!modal) return;

  modal.classList.remove("open");
  modal.hidden = true;
  modal.setAttribute("hidden", "");
  modal.style.display = "none";
}

/*
  FIX 20261003:
  Pastikan fungsi butang Carta Pengunjung sentiasa tersedia
  kepada onclick dalam admin.html.
*/
window.bukaTambahPengunjungManualPentadbir =
  bukaTambahPengunjungManualPentadbir;

window.bukaTolakPengunjungManualPentadbir =
  bukaTolakPengunjungManualPentadbir;

window.tutupModalPengunjungManualPentadbir =
  tutupModalPengunjungManualPentadbir;

async function simpanPengunjungManualPentadbir() {
  const tarikh =
    teks(
      el(
        "tarikhPengunjungManualPentadbir"
      )?.value
    );

  const masa =
    teks(
      el(
        "masaPengunjungManualPentadbir"
      )?.value
    );

  const jumlahInput = Math.max(
    0,
    Math.trunc(Number(el("jumlahPengunjungManualPentadbir")?.value) || 0)
  );

  const modTolak = modPengunjungManualPentadbir === "TOLAK";
  const jumlah = modTolak ? -jumlahInput : jumlahInput;

  if (
    !tarikh ||
    !masa
  ) {
    return paparMesej(
      "statusPengunjungManualPentadbir",
      "Tarikh dan Masa wajib diisi.",
      "error"
    );
  }

  if (jumlahInput <= 0) {
    return paparMesej(
      "statusPengunjungManualPentadbir",
      "Jumlah pengunjung mestilah sekurang-kurangnya 1.",
      "error"
    );
  }

  if (modTolak) {
    const jumlahSemasa = jumlahPengunjungSemasaCarta();
    if (jumlahInput > jumlahSemasa) {
      return paparMesej(
        "statusPengunjungManualPentadbir",
        `Jumlah yang hendak ditolak (${jumlahInput.toLocaleString("ms-MY")}) melebihi jumlah semasa (${jumlahSemasa.toLocaleString("ms-MY")}).`,
        "error"
      );
    }
  }

  const butang =
    el(
      "btnSimpanPengunjungManualPentadbir"
    );

  if (butang) {
    butang.disabled = true;
    butang.textContent =
      "MENYIMPAN...";
  }

  try {
    const payload = {
      jenis:
        "PENGUNJUNG",

      tarikh,

      masa,

      lokasi:
        atas(
          el(
            "lokasiPengunjungManualPentadbir"
          )?.value
        ) ||
        "-",

      jumlah_pengunjung:
        jumlah,

      bas:
        0,

      motosikal:
        0,

      motokar:
        0,

      catatan:
        [
          modTolak ? "PENGUNJUNG BEREDAR KELUAR" : "",
          atas(el("catatanPengunjungManualPentadbir")?.value)
        ].filter(Boolean).join(" - "),

      created_by_profile_id:
        adminLogin?.id ||
        null,

      created_by_auth_user_id:
        adminLogin?.authUserId ||
        null,

      created_by_no_badan:
        adminLogin?.noBadan ||
        null
    };

    const {
      data,
      error
    } =
      await denganHadMasa(
        db.from(
          JADUAL_CARTA_MANUAL_F1
        )
          .insert(
            payload
          )
          .select("*")
          .single()
      );

    if (error) {
      throw error;
    }

    dataPengunjungManualPentadbir.push(
      data
    );

    if (
      el(
        "tarikhCartaPentadbir"
      )
    ) {
      el(
        "tarikhCartaPentadbir"
      ).value =
        tarikh;
    }

    tutupModalPengunjungManualPentadbir();

    paparRingkasanCartaPentadbir();
    paparCartaPengunjungPentadbir();

    paparMesej(
      "statusCartaPentadbir",
      modTolak
        ? "Jumlah pengunjung berjaya ditolak dan disimpan ke Supabase."
        : "Rekod pengunjung manual berjaya disimpan ke Supabase.",
      "success"
    );

  } catch (error) {
    console.error(
      "Simpan pengunjung manual gagal:",
      error
    );

    paparMesej(
      "statusPengunjungManualPentadbir",
      `Gagal menyimpan ke Supabase: ${escapeHtml(error.message || "Ralat tidak diketahui.")}`,
      "error"
    );

  } finally {
    if (butang) {
      butang.disabled = false;
      butang.textContent = modTolak
        ? "TOLAK PENGUNJUNG"
        : "SIMPAN PENGUNJUNG";
    }
  }
}


async function padamPengunjungManualPentadbir(id) {
  if (
    !confirm(
      "Padam rekod pengunjung manual ini daripada Supabase?"
    )
  ) {
    return;
  }

  try {
    const {
      error
    } =
      await denganHadMasa(
        db.from(
          JADUAL_CARTA_MANUAL_F1
        )
          .delete()
          .eq(
            "id",
            id
          )
      );

    if (error) {
      throw error;
    }

    dataPengunjungManualPentadbir =
      dataPengunjungManualPentadbir.filter(
        item =>
          teks(
            item.id
          ) !==
          teks(
            id
          )
      );

    paparRingkasanCartaPentadbir();
    paparCartaPengunjungPentadbir();

    paparMesej(
      "statusCartaPentadbir",
      "Rekod pengunjung manual telah dipadam daripada Supabase.",
      "success"
    );

  } catch (error) {
    console.error(
      "Padam pengunjung manual gagal:",
      error
    );

    paparMesej(
      "statusCartaPentadbir",
      `Gagal memadam rekod: ${escapeHtml(error.message || "Ralat tidak diketahui.")}`,
      "error"
    );
  }
}

function bukaModalKenderaanManualPentadbir(mod = "TAMBAH") {
  modKenderaanManualPentadbir =
    atas(mod) === "TOLAK"
      ? "TOLAK"
      : "TAMBAH";

  const tarikh =
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    hariIniMalaysia();

  if (el("tarikhKenderaanManualPentadbir")) {
    el("tarikhKenderaanManualPentadbir").value = tarikh;
  }

  if (el("masaKenderaanManualPentadbir")) {
    el("masaKenderaanManualPentadbir").value = masaSekarangInputPentadbir();
  }

  [
    "basKenderaanManualPentadbir",
    "motosikalKenderaanManualPentadbir",
    "motokarKenderaanManualPentadbir"
  ].forEach(id => {
    if (el(id)) el(id).value = "0";
  });

  if (el("lokasiKenderaanManualPentadbir")) {
    el("lokasiKenderaanManualPentadbir").value = "";
  }

  if (el("catatanKenderaanManualPentadbir")) {
    el("catatanKenderaanManualPentadbir").value = "";
  }

  const tolak =
    modKenderaanManualPentadbir === "TOLAK";

  const tajuk =
    el("tajukModalKenderaanManualPentadbir");

  if (tajuk) {
    tajuk.textContent =
      tolak
        ? "Tolak Kenderaan Pengunjung"
        : "Tambah Kenderaan Pengunjung";
  }

  const penerangan =
    el("peneranganModalKenderaanManualPentadbir");

  if (penerangan) {
    penerangan.textContent =
      tolak
        ? "Masukkan jumlah Bas, Motosikal dan Motokar yang beredar keluar."
        : "Masukkan jumlah Bas, Motosikal dan Motokar secara manual.";
  }

  const butang =
    el("btnSimpanKenderaanManualPentadbir");

  if (butang) {
    butang.textContent =
      tolak
        ? "TOLAK KENDERAAN"
        : "SIMPAN KENDERAAN";

    butang.classList.toggle(
      "red",
      tolak
    );

    butang.classList.toggle(
      "green-button",
      !tolak
    );
  }

  const status =
    el("statusKenderaanManualPentadbir");

  if (status) {
    status.className = "status-box";
    status.innerHTML = "";
  }

  const modal =
    el("modalKenderaanManualPentadbir");

  if (modal) {
    modal.hidden = false;
    modal.classList.add("open");
  }
}

function bukaTambahKenderaanManualPentadbir() {
  bukaModalKenderaanManualPentadbir("TAMBAH");
}

function bukaTolakKenderaanManualPentadbir() {
  bukaModalKenderaanManualPentadbir("TOLAK");
}

function tutupModalKenderaanManualPentadbir() {
  const modal=el("modalKenderaanManualPentadbir"); if(modal){modal.classList.remove("open");modal.hidden=true;}
}


window.bukaTambahKenderaanManualPentadbir = bukaTambahKenderaanManualPentadbir;
window.bukaTolakKenderaanManualPentadbir = bukaTolakKenderaanManualPentadbir;
window.tutupModalKenderaanManualPentadbir = tutupModalKenderaanManualPentadbir;

async function simpanKenderaanManualPentadbir() {
  const tarikh =
    teks(
      el(
        "tarikhKenderaanManualPentadbir"
      )?.value
    );

  const masa =
    teks(
      el(
        "masaKenderaanManualPentadbir"
      )?.value
    );

  const basInput =
    Math.max(
      0,
      Math.trunc(
        Number(
          el(
            "basKenderaanManualPentadbir"
          )?.value
        ) || 0
      )
    );

  const motosikalInput =
    Math.max(
      0,
      Math.trunc(
        Number(
          el(
            "motosikalKenderaanManualPentadbir"
          )?.value
        ) || 0
      )
    );

  const motokarInput =
    Math.max(
      0,
      Math.trunc(
        Number(
          el(
            "motokarKenderaanManualPentadbir"
          )?.value
        ) || 0
      )
    );

  if (!tarikh || !masa) {
    return paparMesej(
      "statusKenderaanManualPentadbir",
      "Tarikh dan Masa wajib diisi.",
      "error"
    );
  }

  if (
    basInput === 0 &&
    motosikalInput === 0 &&
    motokarInput === 0
  ) {
    return paparMesej(
      "statusKenderaanManualPentadbir",
      "Masukkan sekurang-kurangnya satu jumlah kenderaan.",
      "error"
    );
  }

  const tolak =
    modKenderaanManualPentadbir === "TOLAK";

  if (tolak) {
    const rekodSemasa =
      senaraiKenderaanCartaPentadbir();

    const jumlahSemasa = kategori =>
      rekodSemasa.reduce(
        (jumlah, item) =>
          jumlah +
          nilaiKenderaanDaripadaLaporanPentadbir(
            item,
            kategori
          ),
        0
      );

    const basSemasa =
      Math.max(0, jumlahSemasa("BAS"));

    const motosikalSemasa =
      Math.max(0, jumlahSemasa("MOTOSIKAL"));

    const motokarSemasa =
      Math.max(0, jumlahSemasa("MOTOKAR"));

    if (basInput > basSemasa) {
      return paparMesej(
        "statusKenderaanManualPentadbir",
        `Jumlah Bas yang hendak ditolak (${basInput}) melebihi jumlah semasa (${basSemasa}).`,
        "error"
      );
    }

    if (motosikalInput > motosikalSemasa) {
      return paparMesej(
        "statusKenderaanManualPentadbir",
        `Jumlah Motosikal yang hendak ditolak (${motosikalInput}) melebihi jumlah semasa (${motosikalSemasa}).`,
        "error"
      );
    }

    if (motokarInput > motokarSemasa) {
      return paparMesej(
        "statusKenderaanManualPentadbir",
        `Jumlah Motokar yang hendak ditolak (${motokarInput}) melebihi jumlah semasa (${motokarSemasa}).`,
        "error"
      );
    }
  }

  const tanda =
    tolak
      ? -1
      : 1;

  const bas =
    basInput * tanda;

  const motosikal =
    motosikalInput * tanda;

  const motokar =
    motokarInput * tanda;

  const butang =
    el(
      "btnSimpanKenderaanManualPentadbir"
    );

  if (butang) {
    butang.disabled = true;
    butang.textContent =
      tolak
        ? "MENOLAK..."
        : "MENYIMPAN...";
  }

  try {
    const catatanPengguna =
      atas(
        el(
          "catatanKenderaanManualPentadbir"
        )?.value
      );

    const payload = {
      jenis:
        "KENDERAAN",

      tarikh,

      masa,

      lokasi:
        atas(
          el(
            "lokasiKenderaanManualPentadbir"
          )?.value
        ) ||
        "-",

      jumlah_pengunjung:
        0,

      bas,

      motosikal,

      motokar,

      catatan:
        tolak
          ? (
              catatanPengguna
                ? `KENDERAAN BEREDAR KELUAR - ${catatanPengguna}`
                : "KENDERAAN BEREDAR KELUAR"
            )
          : catatanPengguna,

      created_by_profile_id:
        adminLogin?.id ||
        null,

      created_by_auth_user_id:
        adminLogin?.authUserId ||
        null,

      created_by_no_badan:
        adminLogin?.noBadan ||
        null
    };

    const {
      data,
      error
    } =
      await denganHadMasa(
        db.from(
          JADUAL_CARTA_MANUAL_F1
        )
          .insert(
            payload
          )
          .select("*")
          .single()
      );

    if (error) {
      throw error;
    }

    dataKenderaanManualPentadbir.push(
      data
    );

    if (
      el(
        "tarikhCartaPentadbir"
      )
    ) {
      el(
        "tarikhCartaPentadbir"
      ).value =
        tarikh;
    }

    tutupModalKenderaanManualPentadbir();

    paparRingkasanCartaPentadbir();
    paparCartaKenderaanPentadbir();

    paparMesej(
      "statusCartaPentadbir",
      tolak
        ? "Rekod kenderaan beredar keluar berjaya disimpan ke Supabase."
        : "Rekod kenderaan manual berjaya disimpan ke Supabase.",
      "success"
    );

  } catch (error) {
    console.error(
      tolak
        ? "Tolak kenderaan manual gagal:"
        : "Simpan kenderaan manual gagal:",
      error
    );

    paparMesej(
      "statusKenderaanManualPentadbir",
      `Gagal menyimpan ke Supabase: ${escapeHtml(error.message || "Ralat tidak diketahui.")}`,
      "error"
    );

  } finally {
    if (butang) {
      butang.disabled = false;
      butang.textContent =
        tolak
          ? "TOLAK KENDERAAN"
          : "SIMPAN KENDERAAN";
    }
  }
}

async function padamKenderaanManualPentadbir(id) {
  if (
    !confirm(
      "Padam rekod kenderaan manual ini daripada Supabase?"
    )
  ) {
    return;
  }

  try {
    const {
      error
    } =
      await denganHadMasa(
        db.from(
          JADUAL_CARTA_MANUAL_F1
        )
          .delete()
          .eq(
            "id",
            id
          )
      );

    if (error) {
      throw error;
    }

    dataKenderaanManualPentadbir =
      dataKenderaanManualPentadbir.filter(
        item =>
          teks(
            item.id
          ) !==
          teks(
            id
          )
      );

    paparRingkasanCartaPentadbir();
    paparCartaKenderaanPentadbir();

    paparMesej(
      "statusCartaPentadbir",
      "Rekod kenderaan manual telah dipadam daripada Supabase.",
      "success"
    );

  } catch (error) {
    console.error(
      "Padam kenderaan manual gagal:",
      error
    );

    paparMesej(
      "statusCartaPentadbir",
      `Gagal memadam rekod: ${escapeHtml(error.message || "Ralat tidak diketahui.")}`,
      "error"
    );
  }
}

function laporanKeselamatanCarta() {
  return dataCartaLaporanPentadbir.filter(
    item => jenisTugasCarta(item) === "KAWALAN KESELAMATAN"
  );
}


function laporanTerkiniKeselamatanCarta() {
  const senarai = senaraiPengunjungCartaPentadbir();

  return senarai.length
    ? senarai[senarai.length - 1]
    : null;
}


function jumlahPengunjungSemasaCarta() {
  /*
    JUMLAH KESELURUHAN PENGUNJUNG
    Gabungkan semua laporan Kawalan Keselamatan
    dan rekod manual + PENGUNJUNG bagi tarikh dipilih.
  */
  return senaraiPengunjungCartaPentadbir()
    .reduce(
      (jumlah, item) =>
        jumlah +
        nilaiJumlahPengunjungPentadbir(item),
      0
    );
}


function pecahanKenderaanSemasaCarta() {
  return senaraiKenderaanCartaPentadbir()
    .reduce(
      (jumlah, item) => {
        const data =
          dataLaporanCarta(item);

        const kenderaan =
          data.kenderaan &&
          typeof data.kenderaan === "object"
            ? data.kenderaan
            : {};

        const bas =
          nomborCarta(
            kenderaan.bas ??
            data.bas,
            0
          );

        const motosikal =
          nomborCarta(
            kenderaan.motosikal ??
            data.motosikal,
            0
          );

        const motokar =
          nomborCarta(
            kenderaan.motokar ??
            data.motokar,
            0
          );

        const jumlahItem =
          nomborCarta(
            kenderaan.jumlah ??
            item.jumlah_kenderaan,
            bas + motosikal + motokar
          );

        jumlah.bas += bas;
        jumlah.motosikal += motosikal;
        jumlah.motokar += motokar;
        jumlah.jumlah += jumlahItem;

        return jumlah;
      },
      {
        bas: 0,
        motosikal: 0,
        motokar: 0,
        jumlah: 0
      }
    );
}



function rekodPetugasVvipVipPentadbir(item) {
  const penugasanId =
    item?.penugasan_id ||
    item?.tugas_id ||
    "";

  if (penugasanId) {
    const ikutPenugasan =
      dataDashboard.find(
        rekod =>
          teks(rekod.idPenugasan) ===
          teks(penugasanId)
      );

    if (ikutPenugasan) {
      return ikutPenugasan;
    }
  }

  const petugasId =
    item?.petugas_id ||
    item?.profile_id ||
    "";

  if (petugasId) {
    const ikutPetugas =
      dataDashboard.find(
        rekod =>
          teks(rekod.petugasId) ===
          teks(petugasId)
      );

    if (ikutPetugas) {
      return ikutPetugas;
    }
  }

  return null;
}


function kumpulanVvipVipCarta() {
  const hasil = [];

  /*
    A. Rekod daripada laporan petugas
  */
  dataCartaLaporanPentadbir.forEach(item => {
    const data = dataLaporanCarta(item);

    const petugas =
      rekodPetugasVvipVipPentadbir(item);

    const nilai =
      data.vvip_vip ??
      item.vvip_vip;

    if (!nilaiAdaCarta(nilai)) return;

    const butiran = teksNilaiCarta(nilai);

    if (!butiran) return;

    butiran
      .split(/\n+/)
      .map(item => teks(item))
      .filter(Boolean)
      .forEach(teksItem => {
        hasil.push({
          id: `LAPORAN-${item.id || `${teks(item.tarikh_masa)}-${teksItem}`}`,
          jenisRekod: "LAPORAN",
          kategori: "VVIP / VIP",
          nama: teksItem,
          jawatan: "",
          agensi: "",
          masaTiba: item.tarikh_masa || null,
          masaBeredar: null,
          lokasi:
            petugas?.tempatTugas ||
            item.tempat_tugas ||
            item.lokasi ||
            data.lokasi ||
            "",
          tempatTugas:
            petugas?.tempatTugas ||
            item.tempat_tugas ||
            item.lokasi ||
            data.lokasi ||
            "",
          petugasNama:
            petugas
              ? `${petugas.pangkat || ""} ${petugas.nama || ""}`.trim()
              : (
                  item.nama_petugas ||
                  item.nama ||
                  "-"
                ),
          noBadan:
            petugas?.noBadan ||
            item.no_badan ||
            "-",
          jenisTugasPetugas:
            petugas?.jenisTugas ||
            item.jenis_tugas ||
            jenisTugasCarta(item) ||
            "-",
          callSign:
            petugas?.callSign ||
            item.call_sign ||
            "-",
          tujuan: "",
          catatan: "",
          sumber:
            jenisTugasCarta(item) ||
            "LAPORAN PETUGAS"
        });
      });
  });

  /*
    B. Rekod manual daripada Urusetia / Pentadbir
  */
  dataVvipVipOperasiPentadbir.forEach(item => {
    hasil.push({
      id: item.id,
      jenisRekod: "MANUAL",
      kategori: atas(item.kategori) || "VIP",
      nama: item.nama || "-",
      jawatan: item.jawatan || "",
      agensi: item.agensi || "",
      masaTiba: item.masa_tiba || null,
      masaBeredar: item.masa_beredar || null,
      lokasi: item.lokasi || "",
      tempatTugas: item.lokasi || "",
      petugasNama: "URUSETIA / PENTADBIR",
      noBadan: "-",
      jenisTugasPetugas: "-",
      callSign: "-",
      tujuan: item.tujuan || "",
      catatan: item.catatan || "",
      sumber: "URUSETIA / PENTADBIR"
    });
  });

  return hasil.sort((a, b) => {
    const masaA = teks(a.masaTiba);
    const masaB = teks(b.masaTiba);

    return masaA.localeCompare(masaB, "ms");
  });
}


function kiraInsidenCarta() {
  let tangkapan = 0;
  let rampasan = 0;
  let kemalangan = 0;
  let ancaman = 0;

  dataCartaLaporanPentadbir.forEach(item => {
    const data = dataLaporanCarta(item);

    if (nilaiAdaCarta(data.tangkapan)) tangkapan += 1;
    if (nilaiAdaCarta(data.rampasan)) rampasan += 1;
    if (nilaiAdaCarta(data.kemalangan)) kemalangan += 1;

    if (
      nilaiAdaCarta(
        data.jenis_ancaman ??
        data.ancaman
      )
    ) {
      ancaman += 1;
    }
  });

  return {
    tangkapan,
    rampasan,
    kemalangan,
    ancaman,
    jumlah:
      tangkapan +
      rampasan +
      kemalangan +
      ancaman
  };
}


function paparRingkasanCartaPentadbir() {
  /*
    FIX008 — Kad ringkasan CARTA OPERASI mesti memaparkan NILAI TERTINGGI (PEAK),
    sama seperti LAPORAN KESELURUHAN HARIAN dan SKPO AI.

    Rekod manual carta ialah pergerakan tambah/tolak. Oleh itu nilai akhir boleh
    kembali kepada 0 walaupun jumlah tertinggi operasi pernah mencecah angka
    yang besar. Kad utama tidak lagi menggunakan nilai akhir/semasa.
  */
  const statistikPengunjung =
    statistikPengunjungLaporanHarian();

  const statistikKenderaan =
    statistikKenderaanLaporanHarian();

  const vvipVip =
    kumpulanVvipVipCarta();

  const insiden =
    kiraInsidenCarta();

  if (el("cartaJumlahPengunjung")) {
    el("cartaJumlahPengunjung").textContent =
      statistikPengunjung.keseluruhan.toLocaleString("ms-MY");
  }

  if (el("cartaJumlahKenderaan")) {
    el("cartaJumlahKenderaan").textContent =
      statistikKenderaan.keseluruhan.toLocaleString("ms-MY");
  }

  if (el("cartaJumlahVvipVip")) {
    el("cartaJumlahVvipVip").textContent =
      vvipVip.length.toLocaleString("ms-MY");
  }

  /*
    Ringkasan insiden operasi:
    - TANGKAPAN
    - RAMPASAN
    - KEMALANGAN

    Nilai diambil terus daripada laporan petugas
    bagi tarikh carta yang dipilih.
  */
  if (el("cartaJumlahTangkapan")) {
    el("cartaJumlahTangkapan").textContent =
      insiden.tangkapan.toLocaleString("ms-MY");
  }

  if (el("cartaJumlahRampasan")) {
    el("cartaJumlahRampasan").textContent =
      insiden.rampasan.toLocaleString("ms-MY");
  }

  if (el("cartaJumlahKemalangan")) {
    el("cartaJumlahKemalangan").textContent =
      insiden.kemalangan.toLocaleString("ms-MY");
  }
}



function binaPanelPengunjungPentadbir() {
  const kanvas =
    el("canvasCartaPengunjung");

  if (!kanvas) return null;

  return kanvas.closest(
    '[data-chart-section="PENGUNJUNG"]'
  );
}


function lokasiLaporanPengunjungPentadbir(item) {
  const data =
    dataLaporanCarta(item);

  const petugas =
    rekodPetugasUntukLaporanPengunjungPentadbir(
      item
    );

  return (
    atas(
      data.lokasi ??
      data.tempat_tugas ??
      item.lokasi ??
      item.tempat_tugas ??
      petugas?.tempatTugas
    ) ||
    "TIDAK DINYATAKAN"
  );
}


function ringkasanPengunjungMengikutLokasiPentadbir() {
  const kumpulan = new Map();

  senaraiPengunjungCartaPentadbir()
    .forEach(item => {
      const lokasi =
        lokasiLaporanPengunjungPentadbir(item);

      const jumlah =
        nilaiJumlahPengunjungPentadbir(item);

      const sediaAda =
        kumpulan.get(lokasi) || {
          lokasi,
          datang: 0,
          keluar: 0,
          baki: 0,
          bilLaporan: 0
        };

      /*
        Nilai positif = pengunjung DATANG.
        Nilai negatif = pengunjung KELUAR / BEREDAR KELUAR.
        Untuk carta, nilai keluar disimpan sebagai nombor positif
        supaya tiada lagi bar negatif pada paksi carta.
      */
      if (jumlah >= 0) {
        sediaAda.datang += jumlah;
      } else {
        sediaAda.keluar += Math.abs(jumlah);
      }

      sediaAda.baki =
        sediaAda.datang -
        sediaAda.keluar;

      sediaAda.bilLaporan += 1;

      kumpulan.set(lokasi, sediaAda);
    });

  return Array
    .from(kumpulan.values())
    .sort(
      (a, b) =>
        b.datang - a.datang ||
        b.keluar - a.keluar ||
        a.lokasi.localeCompare(b.lokasi, "ms")
    );
}


function paparSemuaLokasiPengunjungPentadbir() {
  lokasiPengunjungDipilihPentadbir =
    "SEMUA";

  paparButiranPengunjungPentadbir();

  paparCartaPengunjungLokasiPentadbir();
}


function pilihLokasiPengunjungPentadbir(lokasi) {
  lokasiPengunjungDipilihPentadbir =
    atas(lokasi) ||
    "SEMUA";

  paparButiranPengunjungPentadbir();

  paparCartaPengunjungLokasiPentadbir();
}


function paparCartaPengunjungLokasiPentadbir() {
  const kanvas =
    el("canvasCartaPengunjungLokasi");

  if (!kanvas) return;

  try {
    pastikanChartJsPentadbir();
  } catch (error) {
    return;
  }

  const ringkasan =
    ringkasanPengunjungMengikutLokasiPentadbir();

  const labels =
    ringkasan.map(item => item.lokasi);

  /*
    Paparan lokasi hanya menunjukkan pengunjung DATANG.
    Rekod keluar masih disimpan dan digunakan pada bahagian lain,
    tetapi tidak dipaparkan dalam carta ini.
  */
  const nilai =
    ringkasan.map(item => item.datang);

  const jumlahKeseluruhan =
    ringkasan.reduce(
      (jumlah, item) => jumlah + item.datang,
      0
    );

  const jumlahBox =
    el("jumlahKeseluruhanPengunjungLokasiPentadbir");

  if (jumlahBox) {
    /*
      Paparan JUMLAH KESELURUHAN dibuang sepenuhnya
      daripada panel PENGUNJUNG MENGIKUT LOKASI.
    */
    const kotakJumlah =
      jumlahBox.closest(".admin-chart-location-total") ||
      jumlahBox.parentElement;

    if (kotakJumlah) {
      kotakJumlah.style.display = "none";
    }
  }

  kemusnahkanCartaPentadbir(
    cartaPengunjungLokasiPentadbir
  );

  cartaPengunjungLokasiPentadbir =
    new Chart(
      kanvas,
      {
        type: "bar",

        data: {
          labels,

          datasets: [
            {
              label: "JUMLAH PENGUNJUNG",
              data: nilai,
              borderWidth: 2,
              borderRadius: 6,
              borderSkipped: false
            }
          ]
        },

        options: {
          ...pilihanCartaPentadbir(
            "Jumlah Pengunjung"
          ),

          indexAxis: "y",

          maintainAspectRatio: false,

          scales: {
            x: {
              beginAtZero: true,
              ticks: {
                color: "#d8d8d8",
                precision: 0
              },
              grid: {
                color:
                  "rgba(255,255,255,.08)"
              },
              title: {
                display: true,
                text: "Jumlah Pengunjung",
                color: "#d8d8d8"
              }
            },

            y: {
              ticks: {
                color: "#ffffff",
                font: {
                  weight: "700"
                }
              },
              grid: {
                color:
                  "rgba(255,255,255,.05)"
              }
            }
          },

          onClick(event) {
            const elemen =
              cartaPengunjungLokasiPentadbir
                ?.getElementsAtEventForMode(
                  event,
                  "nearest",
                  {
                    intersect: true
                  },
                  true
                ) || [];

            if (!elemen.length) return;

            const rekod =
              ringkasan[
                elemen[0].index
              ];

            if (!rekod) return;

            pilihLokasiPengunjungPentadbir(
              rekod.lokasi
            );
          },

          onHover(event, elements) {
            const sasaran =
              event?.native?.target;

            if (sasaran) {
              sasaran.style.cursor =
                elements?.length
                  ? "pointer"
                  : "default";
            }
          },

          plugins: {
            ...pilihanCartaPentadbir(
              "Jumlah Pengunjung"
            ).plugins,

            legend: {
              labels: {
                color: "#ffffff",
                font: {
                  weight: "700"
                }
              }
            },

            tooltip: {
              enabled: true,

              callbacks: {
                label(context) {
                  return (
                    `JUMLAH PENGUNJUNG: ${Number(context.raw || 0).toLocaleString("ms-MY")}`
                  );
                },

                afterLabel(context) {
                  const rekod =
                    ringkasan[
                      context.dataIndex
                    ];

                  return (
                    `${rekod?.bilLaporan || 0} rekod/laporan`
                  );
                },

                footer() {
                  return (
                    "Klik untuk papar butiran lokasi ini"
                  );
                }
              }
            }
          }
        }
      }
    );
}



function rekodPetugasUntukLaporanPengunjungPentadbir(item) {
  const petugasId =
    item.petugas_id ||
    item.profile_id ||
    "";

  if (!petugasId) return null;

  return (
    dataDashboard.find(
      rekod =>
        rekod.petugasId === petugasId
    ) || null
  );
}


function nilaiJumlahPengunjungPentadbir(item) {
  const data =
    dataLaporanCarta(item);

  return nomborCarta(
    data.jumlah_pengunjung ??
    item.jumlah_pengunjung,
    0
  );
}


function jumlahKenderaanPengunjungPentadbir(item) {
  const data =
    dataLaporanCarta(item);

  const kenderaan =
    data.kenderaan &&
    typeof data.kenderaan === "object"
      ? data.kenderaan
      : {};

  const bas =
    nomborCarta(
      kenderaan.bas ?? data.bas,
      0
    );

  const motosikal =
    nomborCarta(
      kenderaan.motosikal ?? data.motosikal,
      0
    );

  const motokar =
    nomborCarta(
      kenderaan.motokar ?? data.motokar,
      0
    );

  return nomborCarta(
    kenderaan.jumlah ??
    item.jumlah_kenderaan,
    bas + motosikal + motokar
  );
}


function paparButiranPengunjungPentadbir(indexDipilih = -1) {
  binaPanelPengunjungPentadbir();

  const semua =
    senaraiPengunjungCartaPentadbir();

  const lokasiDipilih =
    atas(
      lokasiPengunjungDipilihPentadbir
    ) || "SEMUA";

  const senarai =
    lokasiDipilih === "SEMUA"
      ? semua
      : semua.filter(
          item =>
            lokasiLaporanPengunjungPentadbir(
              item
            ) === lokasiDipilih
        );

  const ruang =
    el(
      "senaraiButiranPengunjungPentadbir"
    );

  const jumlahBox =
    el(
      "jumlahButiranPengunjungPentadbir"
    );

  const tajuk =
    el(
      "tajukButiranPengunjungPentadbir"
    );

  const ringkasan =
    el(
      "ringkasanLokasiPengunjungPentadbir"
    );

  const jumlahDipaparkan =
    senarai.reduce(
      (jumlah, item) =>
        jumlah +
        nilaiJumlahPengunjungPentadbir(
          item
        ),
      0
    );

  if (tajuk) {
    tajuk.textContent =
      lokasiDipilih === "SEMUA"
        ? "SEMUA LOKASI"
        : lokasiDipilih;
  }

  if (jumlahBox) {
    jumlahBox.textContent =
      senarai.length.toLocaleString(
        "ms-MY"
      );
  }

  if (ringkasan) {
    ringkasan.innerHTML = `
      <span>
        ${
          lokasiDipilih === "SEMUA"
            ? "JUMLAH KESELURUHAN"
            : "JUMLAH LOKASI"
        }
      </span>

      <strong>
        ${jumlahDipaparkan.toLocaleString("ms-MY")}
        PENGUNJUNG
      </strong>
    `;
  }

  if (!ruang) return;

  if (!senarai.length) {
    ruang.innerHTML = `
      <div class="empty-row">
        Tiada laporan pengunjung untuk
        ${
          lokasiDipilih === "SEMUA"
            ? "tarikh ini"
            : escapeHtml(lokasiDipilih)
        }.
      </div>
    `;

    return;
  }

  ruang.innerHTML =
    senarai.map(
      (item, index) => {
        const data =
          dataLaporanCarta(item);

        const petugas =
          rekodPetugasUntukLaporanPengunjungPentadbir(
            item
          );

        const jumlahPengunjung =
          nilaiJumlahPengunjungPentadbir(
            item
          );

        const jumlahKenderaan =
          jumlahKenderaanPengunjungPentadbir(
            item
          );

        const namaPetugas =
          petugas
            ? `${teks(petugas.pangkat)} ${teks(petugas.nama)}`.trim()
            : teks(
                item.nama_petugas ||
                item.nama
              ) || "-";

        const noBadan =
          teks(petugas?.noBadan) ||
          teks(item.no_badan) ||
          "-";

        const telefon =
          teks(petugas?.telefon) ||
          teks(item.no_telefon) ||
          teks(item.telefon) ||
          "-";

        const callSign =
          teks(petugas?.callSign) ||
          teks(item.call_sign) ||
          "-";

        const lokasi =
          lokasiLaporanPengunjungPentadbir(
            item
          );

        const jenisTugas =
          jenisTugasCarta(item) ||
          petugas?.jenisTugas ||
          "KAWALAN KESELAMATAN";

        const vvipVip =
          teksNilaiCarta(
            data.vvip_vip ??
            item.vvip_vip
          ) || "TIADA";

        const perkaraMenarik =
          teksNilaiCarta(
            data.perkara_menarik ??
            data.catatan ??
            item.perkara_menarik
          );

        return `
          <article
            class="admin-visitor-detail-item ${
              index === indexDipilih
                ? "aktif"
                : ""
            }"
            data-index-pengunjung="${index}"
            data-lokasi-pengunjung="${escapeHtml(lokasi)}"
          >
            <div
              class="admin-visitor-detail-number"
            >
              ${index + 1}
            </div>

            <div
              class="admin-visitor-detail-main"
            >
              <div
                class="admin-visitor-detail-top"
              >
                <strong>
                  ${jumlahPengunjung.toLocaleString("ms-MY")}
                  PENGUNJUNG
                </strong>

                <time>
                  ${escapeHtml(
                    formatMasaLaporanAdmin(
                      item.tarikh_masa
                    )
                  )}
                </time>
              </div>

              <div
                class="admin-visitor-detail-body"
              >
                <div>
                  <span>
                    Jumlah Pengunjung
                  </span>
                  <b>
                    ${jumlahPengunjung.toLocaleString("ms-MY")}
                  </b>
                </div>

                <div>
                  <span>
                    Jumlah Kenderaan
                  </span>
                  <b>
                    ${jumlahKenderaan.toLocaleString("ms-MY")}
                  </b>
                </div>

                <div>
                  <span>Lokasi</span>
                  <b>
                    ${escapeHtml(lokasi)}
                  </b>
                </div>

                <div>
                  <span>Call Sign</span>
                  <b>
                    ${escapeHtml(callSign)}
                  </b>
                </div>

                <div>
                  <span>Petugas</span>
                  <b>
                    ${escapeHtml(namaPetugas)}
                  </b>
                </div>

                <div>
                  <span>No Badan</span>
                  <b>
                    ${escapeHtml(noBadan)}
                  </b>
                </div>

                <div>
                  <span>No. Telefon</span>
                  <b>
                    ${escapeHtml(telefon)}
                  </b>
                </div>

                <div>
                  <span>VVIP / VIP</span>
                  <b>
                    ${escapeHtml(vvipVip)}
                  </b>
                </div>

                <div
                  class="admin-visitor-detail-wide"
                >
                  <span>Jenis Tugas</span>
                  <b>
                    ${escapeHtml(jenisTugas)}
                  </b>
                </div>
              </div>

              ${
                perkaraMenarik
                  ? `
                    <div
                      class="admin-visitor-note"
                    >
                      <span>
                        Perkara Menarik / Catatan
                      </span>

                      <p>
                        ${escapeHtml(perkaraMenarik)}
                      </p>
                    </div>
                  `
                  : ""
              }

              ${
                item._manual
                  ? `
                    <div
                      class="admin-manual-record-actions"
                    >
                      <span
                        class="badge badge-yellow"
                      >
                        REKOD MANUAL
                      </span>

                      <button
                        class="red compact-button"
                        type="button"
                        onclick="padamPengunjungManualPentadbir('${item._manualId}')"
                      >
                        PADAM
                      </button>
                    </div>
                  `
                  : ""
              }
            </div>
          </article>
        `;
      }
    )
    .join("");

  if (
    indexDipilih >= 0
  ) {
    const aktif =
      ruang.querySelector(
        `[data-index-pengunjung="${indexDipilih}"]`
      );

    aktif?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }
}



function pilihRekodPengunjungPentadbir(index) {
  const senarai =
    senaraiPengunjungCartaPentadbir();

  if (
    index < 0 ||
    index >= senarai.length
  ) {
    return;
  }

  lokasiPengunjungDipilihPentadbir =
    "SEMUA";

  paparButiranPengunjungPentadbir(
    index
  );
}


function paparCartaPengunjungPentadbir() {
  const kanvas =
    el("canvasCartaPengunjung");

  if (!kanvas) return;

  binaPanelPengunjungPentadbir();

  try {
    pastikanChartJsPentadbir();
  } catch (error) {
    return;
  }

  const senarai =
    senaraiPengunjungCartaPentadbir();

  const labels =
    senarai.map(item =>
      masaCartaLabel(item.tarikh_masa)
    );

  /*
    Carta memaparkan JUMLAH TERKUMPUL.
    Contoh laporan 500, 0, 250:
    carta akan menjadi 500, 500, 750.
  */
  let jumlahTerkumpul = 0;

  const nilai =
    senarai.map(item => {
      jumlahTerkumpul +=
        nilaiJumlahPengunjungPentadbir(
          item
        );

      return jumlahTerkumpul;
    });

  kemusnahkanCartaPentadbir(
    cartaPengunjungPentadbir
  );

  cartaPengunjungPentadbir =
    new Chart(kanvas, {
      type: "line",

      data: {
        labels,
        datasets: [
          {
            label: "Jumlah Keseluruhan Pengunjung",
            data: nilai,
            tension: 0.28,
            fill: false,
            pointRadius: 6,
            pointHoverRadius: 9,
            pointHitRadius: 18
          }
        ]
      },

      options: {
        ...pilihanCartaPentadbir(
          "Jumlah Keseluruhan Pengunjung"
        ),

        onClick(event) {
          const elemen =
            cartaPengunjungPentadbir
              ?.getElementsAtEventForMode(
                event,
                "nearest",
                {
                  intersect: false,
                  axis: "x"
                },
                true
              ) || [];

          if (!elemen.length) return;

          pilihRekodPengunjungPentadbir(
            elemen[0].index
          );
        },

        onHover(event) {
          const sasaran =
            event?.native?.target;

          if (sasaran) {
            sasaran.style.cursor =
              "pointer";
          }
        },

        plugins: {
          ...pilihanCartaPentadbir(
            "Jumlah Pengunjung"
          ).plugins,

          legend: {
            labels: {
              color: "#ffffff",
              font: {
                weight: "700"
              }
            }
          },

          tooltip: {
            enabled: true,
            callbacks: {
              label(context) {
                return `Jumlah Keseluruhan: ${(Number(context.raw) || 0).toLocaleString("ms-MY")} pengunjung`;
              },

              afterLabel(context) {
                const item =
                  senarai[context.dataIndex];

                const nilaiLaporan =
                  item
                    ? nilaiJumlahPengunjungPentadbir(item)
                    : 0;

                return [
                  `Laporan ini: ${Number(nilaiLaporan || 0).toLocaleString("ms-MY")} pengunjung`,
                  "Klik untuk sorot butiran di sebelah kanan"
                ];
              }
            }
          }
        }
      }
    });

  /*
    Paparkan kedua-dua perspektif:
    1. Trend jumlah terkumpul mengikut masa.
    2. Jumlah pengunjung mengikut lokasi.
  */
  paparCartaPengunjungLokasiPentadbir();

  paparButiranPengunjungPentadbir();
}


function labelKategoriKenderaanPentadbir(kategori) {
  const peta = {
    BAS: "BAS",
    MOTOSIKAL: "MOTOSIKAL",
    MOTOKAR: "MOTOKAR"
  };

  return peta[kategori] || kategori;
}


function nilaiKenderaanDaripadaLaporanPentadbir(item, kategori) {
  const data = dataLaporanCarta(item);

  const kenderaan =
    data.kenderaan &&
    typeof data.kenderaan === "object"
      ? data.kenderaan
      : {};

  if (kategori === "BAS") {
    return nomborCarta(
      kenderaan.bas ??
      data.bas,
      0
    );
  }

  if (kategori === "MOTOSIKAL") {
    return nomborCarta(
      kenderaan.motosikal ??
      data.motosikal,
      0
    );
  }

  if (kategori === "MOTOKAR") {
    return nomborCarta(
      kenderaan.motokar ??
      data.motokar,
      0
    );
  }

  return 0;
}


function jumlahKeseluruhanKenderaanLaporanPentadbir(item) {
  const data = dataLaporanCarta(item);

  const kenderaan =
    data.kenderaan &&
    typeof data.kenderaan === "object"
      ? data.kenderaan
      : {};

  const bas =
    nomborCarta(
      kenderaan.bas ??
      data.bas,
      0
    );

  const motosikal =
    nomborCarta(
      kenderaan.motosikal ??
      data.motosikal,
      0
    );

  const motokar =
    nomborCarta(
      kenderaan.motokar ??
      data.motokar,
      0
    );

  return nomborCarta(
    kenderaan.jumlah ??
    item.jumlah_kenderaan,
    bas + motosikal + motokar
  );
}


function lokasiLaporanKenderaanPentadbir(item) {
  const data =
    dataLaporanCarta(item);

  const petugas =
    rekodPetugasUntukLaporanKenderaanPentadbir(
      item
    );

  return (
    atas(
      data.lokasi ??
      data.tempat_tugas ??
      item.lokasi ??
      item.tempat_tugas ??
      petugas?.tempatTugas
    ) ||
    "TIDAK DINYATAKAN"
  );
}


function ringkasanKenderaanMengikutLokasiPentadbir() {
  const kumpulan = new Map();

  senaraiKenderaanCartaPentadbir()
    .forEach(item => {
      const lokasi =
        lokasiLaporanKenderaanPentadbir(item);

      const bas =
        nilaiKenderaanDaripadaLaporanPentadbir(item, "BAS");

      const motokar =
        nilaiKenderaanDaripadaLaporanPentadbir(item, "MOTOKAR");

      const motosikal =
        nilaiKenderaanDaripadaLaporanPentadbir(item, "MOTOSIKAL");

      const jumlah =
        jumlahKeseluruhanKenderaanLaporanPentadbir(item);

      const sediaAda =
        kumpulan.get(lokasi) || {
          lokasi,
          bas: 0,
          motokar: 0,
          motosikal: 0,
          jumlah: 0,
          bilLaporan: 0
        };

      /*
        Hanya rekod KENDERAAN DATANG (+) dipaparkan.
        Pecahan BAS, MOTOKAR dan MOTOSIKAL dikekalkan.
        Rekod keluar (-) masih kekal dalam data tetapi
        tidak dimasukkan ke carta KENDERAAN MENGIKUT LOKASI.
      */
      if (jumlah >= 0) {
        sediaAda.bas += Math.max(0, bas);
        sediaAda.motokar += Math.max(0, motokar);
        sediaAda.motosikal += Math.max(0, motosikal);
        sediaAda.jumlah += Math.max(0, bas) +
                           Math.max(0, motokar) +
                           Math.max(0, motosikal);
      }

      sediaAda.bilLaporan += 1;
      kumpulan.set(lokasi, sediaAda);
    });

  return Array
    .from(kumpulan.values())
    .sort(
      (a, b) =>
        b.jumlah - a.jumlah ||
        a.lokasi.localeCompare(b.lokasi, "ms")
    );
}


function paparSemuaLokasiKenderaanPentadbir() {
  lokasiKenderaanDipilihPentadbir =
    "SEMUA";

  paparButiranKenderaanPentadbir();

  paparCartaKenderaanLokasiPentadbir();
}


function pilihLokasiKenderaanPentadbir(lokasi) {
  lokasiKenderaanDipilihPentadbir =
    atas(lokasi) ||
    "SEMUA";

  paparButiranKenderaanPentadbir();

  paparCartaKenderaanLokasiPentadbir();
}


function rekodPetugasUntukLaporanKenderaanPentadbir(item) {
  const petugasId =
    item.petugas_id ||
    item.profile_id ||
    "";

  if (!petugasId) return null;

  return (
    dataDashboard.find(
      rekod =>
        rekod.petugasId === petugasId
    ) ||
    null
  );
}


function paparButiranKenderaanPentadbir() {
  const semua =
    senaraiKenderaanCartaPentadbir();

  const lokasiDipilih =
    atas(
      lokasiKenderaanDipilihPentadbir
    ) || "SEMUA";

  const senarai =
    lokasiDipilih === "SEMUA"
      ? semua
      : semua.filter(
          item =>
            lokasiLaporanKenderaanPentadbir(
              item
            ) === lokasiDipilih
        );

  const ruang =
    el(
      "senaraiButiranKenderaanPentadbir"
    );

  const jumlahBox =
    el(
      "jumlahButiranKenderaanPentadbir"
    );

  const tajuk =
    el(
      "tajukButiranKenderaanPentadbir"
    );

  const ringkasan =
    el(
      "ringkasanLokasiKenderaanPentadbir"
    );

  const jumlahDipaparkan =
    senarai.reduce(
      (jumlah, item) =>
        jumlah +
        jumlahKeseluruhanKenderaanLaporanPentadbir(
          item
        ),
      0
    );

  if (tajuk) {
    tajuk.textContent =
      lokasiDipilih === "SEMUA"
        ? "SEMUA LOKASI"
        : lokasiDipilih;
  }

  if (jumlahBox) {
    jumlahBox.textContent =
      senarai.length.toLocaleString(
        "ms-MY"
      );
  }

  if (ringkasan) {
    ringkasan.innerHTML = `
      <span>
        ${
          lokasiDipilih === "SEMUA"
            ? "JUMLAH KESELURUHAN"
            : "JUMLAH LOKASI"
        }
      </span>

      <strong>
        ${jumlahDipaparkan.toLocaleString("ms-MY")}
        KENDERAAN
      </strong>
    `;
  }

  if (!ruang) return;

  if (!senarai.length) {
    ruang.innerHTML = `
      <div class="empty-row">
        Tiada laporan kenderaan untuk
        ${
          lokasiDipilih === "SEMUA"
            ? "tarikh ini"
            : escapeHtml(lokasiDipilih)
        }.
      </div>
    `;

    return;
  }

  ruang.innerHTML =
    senarai.map(
      (item, index) => {
        const data =
          dataLaporanCarta(item);

        const petugas =
          rekodPetugasUntukLaporanKenderaanPentadbir(
            item
          );

        const bas =
          nilaiKenderaanDaripadaLaporanPentadbir(
            item,
            "BAS"
          );

        const motosikal =
          nilaiKenderaanDaripadaLaporanPentadbir(
            item,
            "MOTOSIKAL"
          );

        const motokar =
          nilaiKenderaanDaripadaLaporanPentadbir(
            item,
            "MOTOKAR"
          );

        const jumlahKenderaan =
          jumlahKeseluruhanKenderaanLaporanPentadbir(
            item
          );

        const lokasi =
          lokasiLaporanKenderaanPentadbir(
            item
          );

        const namaPetugas =
          petugas
            ? `${teks(petugas.pangkat)} ${teks(petugas.nama)}`.trim()
            : teks(
                item.nama_petugas ||
                item.nama
              ) || "-";

        const noBadan =
          teks(petugas?.noBadan) ||
          teks(item.no_badan) ||
          "-";

        const telefon =
          teks(petugas?.telefon) ||
          teks(item.no_telefon) ||
          teks(item.telefon) ||
          "-";

        const callSign =
          teks(petugas?.callSign) ||
          teks(item.call_sign) ||
          "-";

        const jenisTugas =
          jenisTugasCarta(item) ||
          petugas?.jenisTugas ||
          "KAWALAN KESELAMATAN";

        const catatan =
          teksNilaiCarta(
            data.perkara_menarik ??
            data.catatan ??
            item.perkara_menarik
          );

        return `
          <article class="admin-vehicle-detail-item">
            <div class="admin-vehicle-detail-number">
              ${index + 1}
            </div>

            <div class="admin-vehicle-detail-main">

              <div class="admin-vehicle-detail-top">
                <strong>
                  ${jumlahKenderaan.toLocaleString("ms-MY")}
                  KENDERAAN
                </strong>

                <time>
                  ${escapeHtml(
                    formatMasaLaporanAdmin(
                      item.tarikh_masa
                    )
                  )}
                </time>
              </div>

              <div class="admin-vehicle-detail-body">

                <div>
                  <span>Jumlah Kenderaan</span>
                  <b>${jumlahKenderaan.toLocaleString("ms-MY")}</b>
                </div>

                <div>
                  <span>Lokasi</span>
                  <b>${escapeHtml(lokasi)}</b>
                </div>

                <div>
                  <span>Bas</span>
                  <b>${bas.toLocaleString("ms-MY")}</b>
                </div>

                <div>
                  <span>Motosikal</span>
                  <b>${motosikal.toLocaleString("ms-MY")}</b>
                </div>

                <div>
                  <span>Motokar</span>
                  <b>${motokar.toLocaleString("ms-MY")}</b>
                </div>

                <div>
                  <span>Call Sign</span>
                  <b>${escapeHtml(callSign)}</b>
                </div>

                <div>
                  <span>Petugas</span>
                  <b>${escapeHtml(namaPetugas)}</b>
                </div>

                <div>
                  <span>No Badan</span>
                  <b>${escapeHtml(noBadan)}</b>
                </div>

                <div>
                  <span>No. Telefon</span>
                  <b>${escapeHtml(telefon)}</b>
                </div>

                <div class="admin-vehicle-detail-wide">
                  <span>Jenis Tugas</span>
                  <b>${escapeHtml(jenisTugas)}</b>
                </div>

              </div>

              ${
                catatan
                  ? `
                    <div class="admin-vehicle-note">
                      <span>Perkara Menarik / Catatan</span>
                      <p>${escapeHtml(catatan)}</p>
                    </div>
                  `
                  : ""
              }

              ${
                item._manual
                  ? `
                    <div class="admin-manual-record-actions">
                      <span class="badge badge-yellow">
                        REKOD MANUAL
                      </span>

                      <button
                        class="red compact-button"
                        type="button"
                        onclick="padamKenderaanManualPentadbir('${item._manualId}')"
                      >
                        PADAM
                      </button>
                    </div>
                  `
                  : ""
              }
            </div>
          </article>
        `;
      }
    )
    .join("");
}


function paparCartaKenderaanLokasiPentadbir() {
  const kanvas =
    el("canvasCartaKenderaanLokasi");

  if (!kanvas) return;

  try {
    pastikanChartJsPentadbir();
  } catch (_) {
    return;
  }

  const ringkasan =
    ringkasanKenderaanMengikutLokasiPentadbir();

  const labels =
    ringkasan.map(item => item.lokasi);

  const dataBas =
    ringkasan.map(item => item.bas);

  const dataMotokar =
    ringkasan.map(item => item.motokar);

  const dataMotosikal =
    ringkasan.map(item => item.motosikal);

  // Buang paparan JUMLAH KESELURUHAN seperti carta pengunjung.
  const jumlahBox =
    el("jumlahKeseluruhanKenderaanLokasiPentadbir");

  if (jumlahBox) {
    const kotakJumlah =
      jumlahBox.closest(".admin-chart-location-total") ||
      jumlahBox.parentElement;

    if (kotakJumlah) {
      kotakJumlah.style.display = "none";
    }
  }

  kemusnahkanCartaPentadbir(
    cartaKenderaanLokasiPentadbir
  );

  cartaKenderaanLokasiPentadbir =
    new Chart(
      kanvas,
      {
        type: "bar",

        data: {
          labels,

          datasets: [
            {
              label: "BAS",
              data: dataBas,
              borderWidth: 2,
              borderRadius: 5,
              borderSkipped: false
            },
            {
              label: "MOTOKAR",
              data: dataMotokar,
              borderWidth: 2,
              borderRadius: 5,
              borderSkipped: false
            },
            {
              label: "MOTOSIKAL",
              data: dataMotosikal,
              borderWidth: 2,
              borderRadius: 5,
              borderSkipped: false
            }
          ]
        },

        options: {
          ...pilihanCartaPentadbir("Jumlah Kenderaan"),

          indexAxis: "y",
          maintainAspectRatio: false,

          interaction: {
            mode: "index",
            intersect: false
          },

          scales: {
            x: {
              beginAtZero: true,
              stacked: true,
              ticks: {
                color: "#d8d8d8",
                precision: 0
              },
              grid: {
                color: "rgba(255,255,255,.08)"
              },
              title: {
                display: true,
                text: "Jumlah Kenderaan",
                color: "#d8d8d8"
              }
            },

            y: {
              stacked: true,
              ticks: {
                color: "#ffffff",
                font: {
                  weight: "700"
                }
              },
              grid: {
                color: "rgba(255,255,255,.05)"
              }
            }
          },

          onClick(event) {
            const elemen =
              cartaKenderaanLokasiPentadbir
                ?.getElementsAtEventForMode(
                  event,
                  "nearest",
                  { intersect: true },
                  true
                ) || [];

            if (!elemen.length) return;

            const rekod =
              ringkasan[elemen[0].index];

            if (!rekod) return;

            pilihLokasiKenderaanPentadbir(
              rekod.lokasi
            );
          },

          onHover(event, elements) {
            const sasaran =
              event?.native?.target;

            if (sasaran) {
              sasaran.style.cursor =
                elements?.length ? "pointer" : "default";
            }
          },

          plugins: {
            ...pilihanCartaPentadbir("Jumlah Kenderaan").plugins,

            legend: {
              display: true,
              labels: {
                color: "#ffffff",
                font: {
                  weight: "700"
                }
              }
            },

            tooltip: {
              enabled: true,

              callbacks: {
                footer(context) {
                  const indeks =
                    context?.[0]?.dataIndex;

                  const rekod =
                    ringkasan[indeks];

                  if (!rekod) return "";

                  return `JUMLAH: ${Number(rekod.jumlah || 0).toLocaleString("ms-MY")} KENDERAAN`;
                },

                afterFooter() {
                  return "Klik untuk papar butiran lokasi ini";
                }
              }
            }
          }
        }
      }
    );
}



function paparCartaKenderaanPentadbir() {
  const kanvas =
    el("canvasCartaKenderaan");

  if (!kanvas) return;

  try {
    pastikanChartJsPentadbir();
  } catch (_) {
    return;
  }

  const senarai =
    senaraiKenderaanCartaPentadbir();

  const labels =
    senarai.map(item =>
      formatMasaPendekCartaPentadbir(
        item.tarikh_masa
      )
    );

  let jumlahBas = 0;
  let jumlahMotokar = 0;
  let jumlahMotosikal = 0;

  const dataBas = [];
  const dataMotokar = [];
  const dataMotosikal = [];

  senarai.forEach(item => {
    jumlahBas +=
      nilaiKenderaanDaripadaLaporanPentadbir(
        item,
        "BAS"
      );

    jumlahMotokar +=
      nilaiKenderaanDaripadaLaporanPentadbir(
        item,
        "MOTOKAR"
      );

    jumlahMotosikal +=
      nilaiKenderaanDaripadaLaporanPentadbir(
        item,
        "MOTOSIKAL"
      );

    dataBas.push(jumlahBas);
    dataMotokar.push(jumlahMotokar);
    dataMotosikal.push(jumlahMotosikal);
  });

  kemusnahkanCartaPentadbir(
    cartaKenderaanPentadbir
  );

  cartaKenderaanPentadbir =
    new Chart(
      kanvas,
      {
        type: "line",

        data: {
          labels,

          datasets: [
            {
              label: "Bas",
              data: dataBas,
              tension: .28,
              pointRadius: 4,
              pointHoverRadius: 6,
              borderWidth: 3,
              fill: false
            },
            {
              label: "Motokar",
              data: dataMotokar,
              tension: .28,
              pointRadius: 4,
              pointHoverRadius: 6,
              borderWidth: 3,
              fill: false
            },
            {
              label: "Motosikal",
              data: dataMotosikal,
              tension: .28,
              pointRadius: 4,
              pointHoverRadius: 6,
              borderWidth: 3,
              fill: false
            }
          ]
        },

        options: {
          ...pilihanCartaPentadbir(
            "Jumlah Kenderaan"
          ),

          interaction: {
            mode: "index",
            intersect: false
          },

          plugins: {
            ...pilihanCartaPentadbir(
              "Jumlah Kenderaan"
            ).plugins,

            legend: {
              display: true,
              labels: {
                color: "#ffffff",
                font: {
                  weight: "700"
                }
              }
            },

            tooltip: {
              callbacks: {
                footer(context) {
                  if (!context?.length) return "";

                  const indeks =
                    context[0].dataIndex;

                  const bas =
                    Number(
                      dataBas[indeks] || 0
                    );

                  const motokar =
                    Number(
                      dataMotokar[indeks] || 0
                    );

                  const motosikal =
                    Number(
                      dataMotosikal[indeks] || 0
                    );

                  return (
                    `JUMLAH TERKUMPUL: ` +
                    `${(bas + motokar + motosikal).toLocaleString("ms-MY")} KENDERAAN`
                  );
                }
              }
            }
          }
        }
      }
    );

  paparCartaKenderaanLokasiPentadbir();

  paparButiranKenderaanPentadbir();
}



/* ================================================================
   CARTA KEHADIRAN — FUNGSI INTERAKTIF
================================================================ */

function kategoriKehadiranCartaPentadbir(item) {
  /*
    Susunan keutamaan:
    1. Jika sudah Check-Out = SELESAI
    2. Jika status HADIR = HADIR
    3. Jika MENUNGGU = MENUNGGU
    4. Selain itu = TIDAK HADIR
  */

  if (item.checkout) {
    return "SELESAI";
  }

  if (atas(item.statusKehadiran) === "HADIR") {
    return "HADIR";
  }

  if (atas(item.statusKehadiran) === "MENUNGGU") {
    return "MENUNGGU";
  }

  return "TIDAK_HADIR";
}


function labelKategoriKehadiranPentadbir(kategori) {
  const peta = {
    HADIR: "HADIR",
    TIDAK_HADIR: "TIDAK HADIR",
    SELESAI: "SELESAI",
    MENUNGGU: "MENUNGGU"
  };

  return peta[kategori] || kategori;
}


function senaraiMengikutKehadiranPentadbir(kategori) {
  return dataDashboard
    .filter(item =>
      kategoriKehadiranCartaPentadbir(item) === kategori
    )
    .sort((a, b) => {
      const pangkatA = atas(a.pangkat);
      const pangkatB = atas(b.pangkat);

      if (pangkatA !== pangkatB) {
        return pangkatA.localeCompare(
          pangkatB,
          "ms"
        );
      }

      return atas(a.nama).localeCompare(
        atas(b.nama),
        "ms"
      );
    });
}


function paparSenaraiKehadiranPentadbir(kategori) {
  statusKehadiranCartaDipilihPentadbir =
    kategori;

  const label =
    labelKategoriKehadiranPentadbir(
      kategori
    );

  const senarai =
    senaraiMengikutKehadiranPentadbir(
      kategori
    );

  if (
    el("tajukSenaraiKehadiranPentadbir")
  ) {
    el(
      "tajukSenaraiKehadiranPentadbir"
    ).textContent = label;
  }

  if (
    el("jumlahSenaraiKehadiranPentadbir")
  ) {
    el(
      "jumlahSenaraiKehadiranPentadbir"
    ).textContent =
      senarai.length.toLocaleString(
        "ms-MY"
      );
  }

  const ruang =
    el("senaraiKehadiranPentadbir");

  if (!ruang) return;

  if (!senarai.length) {
    ruang.innerHTML = `
      <div class="empty-row">
        Tiada petugas dalam status
        ${escapeHtml(label)}.
      </div>
    `;
    return;
  }

  ruang.innerHTML =
    senarai.map((item, index) => {

      const masa =
        item.checkout
          ? (
              item.checkout.masa_checkout ||
              item.masaCheckout
            )
          : item.masaCheckin;

      const teksMasa =
        masa
          ? formatTarikhMasa(masa)
          : "-";

      return `
        <article class="admin-attendance-person">

          <div class="admin-attendance-person-no">
            ${index + 1}
          </div>

          <div class="admin-attendance-person-main">

            <strong>
              ${escapeHtml(item.pangkat || "")}
              ${escapeHtml(item.nama || "-")}
            </strong>

            <div class="admin-attendance-person-meta">

              <span>
                No Badan:
                <b>
                  ${escapeHtml(item.noBadan || "-")}
                </b>
              </span>

              <span>
                No. Telefon:
                <b>
                  ${escapeHtml(item.telefon || "-")}
                </b>
              </span>

              <span>
                Call Sign:
                <b>
                  ${escapeHtml(item.callSign || "-")}
                </b>
              </span>

              <span>
                Tempat:
                <b>
                  ${escapeHtml(item.tempatTugas || "-")}
                </b>
              </span>

              <span>
                Tugas:
                <b>
                  ${escapeHtml(item.jenisTugas || "-")}
                </b>
              </span>

            </div>

            <div class="admin-attendance-person-footer">

              ${
                item.penyelia
                  ? '<span class="badge badge-yellow">PENYELIA</span>'
                  : ""
              }

              ${
                item.pemegangSet
                  ? '<span class="badge badge-blue">PEMEGANG SET</span>'
                  : ""
              }

              <small>
                ${
                  kategori === "SELESAI"
                    ? "Check-Out"
                    : kategori === "HADIR"
                      ? "Check-In"
                      : "Masa"
                }:
                ${escapeHtml(teksMasa)}
              </small>

            </div>

          </div>

        </article>
      `;
    }).join("");
}


function pilihKategoriCartaKehadiranPentadbir(index) {
  const kategori = [
    "HADIR",
    "TIDAK_HADIR",
    "SELESAI",
    "MENUNGGU"
  ][index];

  if (!kategori) return;

  paparSenaraiKehadiranPentadbir(
    kategori
  );
}


/* ================================================================
   PLUGIN PERATUS CARTA KEHADIRAN
================================================================ */

const pluginPeratusCartaKehadiranPentadbir = {
  id: "peratusCartaKehadiranPentadbir",

  afterDatasetsDraw(chart) {
    const { ctx } = chart;

    const dataset =
      chart.data.datasets?.[0];

    const meta =
      chart.getDatasetMeta(0);

    if (
      !dataset ||
      !meta?.data?.length
    ) {
      return;
    }

    const nilai =
      dataset.data.map(
        item => Number(item) || 0
      );

    const jumlah =
      nilai.reduce(
        (a, b) => a + b,
        0
      );

    if (!jumlah) return;

    ctx.save();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 12px Arial";

    meta.data.forEach(
      (arc, index) => {

        const bilangan =
          nilai[index];

        if (!bilangan) return;

        const peratus =
          Math.round(
            (bilangan / jumlah) * 100
          );

        /*
          Elakkan tulisan bertindih
          untuk bahagian terlalu kecil.
        */
        if (peratus < 5) return;

        const posisi =
          arc.tooltipPosition();

        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle =
          "rgba(0,0,0,.85)";
        ctx.lineWidth = 4;

        const teksPeratus =
          `${peratus}%`;

        ctx.strokeText(
          teksPeratus,
          posisi.x,
          posisi.y
        );

        ctx.fillText(
          teksPeratus,
          posisi.x,
          posisi.y
        );
      }
    );

    ctx.restore();
  }
};


function peratusKategoriKehadiranPentadbir(
  nilai,
  semuaNilai
) {
  const jumlah =
    semuaNilai.reduce(
      (a, b) =>
        a + (Number(b) || 0),
      0
    );

  if (!jumlah) return 0;

  return Math.round(
    (
      (Number(nilai) || 0) /
      jumlah
    ) * 100
  );
}


function paparCartaKehadiranPentadbir() {
  const kanvas =
    el("canvasCartaKehadiran");

  if (!kanvas) return;

  try {
    pastikanChartJsPentadbir();
  } catch (_) {
    return;
  }

  const hadir =
    senaraiMengikutKehadiranPentadbir(
      "HADIR"
    ).length;

  const tidakHadir =
    senaraiMengikutKehadiranPentadbir(
      "TIDAK_HADIR"
    ).length;

  const selesai =
    senaraiMengikutKehadiranPentadbir(
      "SELESAI"
    ).length;

  const menunggu =
    senaraiMengikutKehadiranPentadbir(
      "MENUNGGU"
    ).length;

  const nilaiCarta = [
    hadir,
    tidakHadir,
    selesai,
    menunggu
  ];

  kemusnahkanCartaPentadbir(
    cartaKehadiranPentadbir
  );

  cartaKehadiranPentadbir =
    new Chart(kanvas, {
      type: "doughnut",

      data: {
        labels: [
          "Hadir",
          "Tidak Hadir",
          "Selesai",
          "Menunggu"
        ],

        datasets: [
          {
            data: nilaiCarta
          }
        ]
      },

      plugins: [
        pluginPeratusCartaKehadiranPentadbir
      ],

      options: {
        responsive: true,
        maintainAspectRatio: false,

        onClick(event, elements) {
          if (!elements?.length) return;

          pilihKategoriCartaKehadiranPentadbir(
            elements[0].index
          );
        },

        onHover(event, elements) {
          const sasaran =
            event?.native?.target;

          if (sasaran) {
            sasaran.style.cursor =
              elements?.length
                ? "pointer"
                : "default";
          }
        },

        plugins: {
          legend: {
            position: "top",

            labels: {
              color: "#ffffff",
              font: {
                size: 12,
                weight: "700"
              },

              generateLabels(chart) {
                const data =
                  chart.data;

                const semuaNilai =
                  data.datasets?.[0]?.data || [];

                return data.labels.map(
                  (label, index) => {
                    const nilai =
                      Number(
                        semuaNilai[index]
                      ) || 0;

                    const peratus =
                      peratusKategoriKehadiranPentadbir(
                        nilai,
                        semuaNilai
                      );

                    const style =
                      chart.getDatasetMeta(0)
                        .controller
                        .getStyle(index);

                    return {
                      text:
                        `${label}: ${nilai} (${peratus}%)`,
                      fillStyle:
                        style.backgroundColor,
                      strokeStyle:
                        style.borderColor,
                      lineWidth:
                        style.borderWidth,
                      fontColor: "#ffffff",
                      hidden:
                        !chart.getDataVisibility(index),
                      index
                    };
                  }
                );
              }
            },

            onClick(event, legendItem) {
              pilihKategoriCartaKehadiranPentadbir(
                legendItem.index
              );
            }
          },

          tooltip: {
            enabled: true,

            callbacks: {
              label(context) {
                const semuaNilai =
                  context.chart.data.datasets?.[0]?.data || [];

                const nilai =
                  Number(context.raw) || 0;

                const peratus =
                  peratusKategoriKehadiranPentadbir(
                    nilai,
                    semuaNilai
                  );

                return `${context.label}: ${nilai} petugas (${peratus}%)`;
              },

              afterLabel() {
                return "Klik untuk papar senarai nama";
              }
            }
          }
        }
      }
    });

  paparSenaraiKehadiranPentadbir(
    statusKehadiranCartaDipilihPentadbir
  );
}


function labelKategoriInsidenPentadbir(kategori) {
  const peta = {
    TANGKAPAN: "TANGKAPAN",
    RAMPASAN: "RAMPASAN",
    KEMALANGAN: "KEMALANGAN",
    ANCAMAN: "ANCAMAN"
  };

  return peta[kategori] || kategori;
}


function nilaiInsidenDaripadaLaporanPentadbir(item, kategori) {
  const data = dataLaporanCarta(item);

  if (kategori === "TANGKAPAN") {
    return data.tangkapan;
  }

  if (kategori === "RAMPASAN") {
    return data.rampasan;
  }

  if (kategori === "KEMALANGAN") {
    return data.kemalangan;
  }

  if (kategori === "ANCAMAN") {
    return (
      data.jenis_ancaman ??
      data.ancaman
    );
  }

  return null;
}


function senaraiInsidenMengikutKategoriPentadbir(kategori) {
  return dataCartaLaporanPentadbir
    .filter(item =>
      nilaiAdaCarta(
        nilaiInsidenDaripadaLaporanPentadbir(
          item,
          kategori
        )
      )
    )
    .sort((a, b) => {
      const masaA = new Date(a.tarikh_masa || 0).getTime();
      const masaB = new Date(b.tarikh_masa || 0).getTime();
      return masaB - masaA;
    });
}


function rekodPetugasUntukLaporanInsidenPentadbir(item) {
  const petugasId =
    item.petugas_id ||
    item.profile_id ||
    "";

  if (!petugasId) return null;

  return (
    dataDashboard.find(
      rekod => rekod.petugasId === petugasId
    ) || null
  );
}


function lokasiLaporanInsidenPentadbir(item, petugas) {
  const data = dataLaporanCarta(item);

  return (
    teks(data.lokasi) ||
    teks(data.tempat_tugas) ||
    teks(item.tempat_tugas) ||
    teks(petugas?.tempatTugas) ||
    "-"
  );
}


function paparButiranInsidenPentadbir(kategori) {
  kategoriInsidenDipilihPentadbir =
    kategori;

  const label =
    labelKategoriInsidenPentadbir(kategori);

  const senarai =
    senaraiInsidenMengikutKategoriPentadbir(
      kategori
    );

  if (el("tajukButiranInsidenPentadbir")) {
    el("tajukButiranInsidenPentadbir").textContent =
      label;
  }

  if (el("jumlahButiranInsidenPentadbir")) {
    el("jumlahButiranInsidenPentadbir").textContent =
      senarai.length.toLocaleString("ms-MY");
  }

  const ruang =
    el("senaraiButiranInsidenPentadbir");

  if (!ruang) return;

  if (!senarai.length) {
    ruang.innerHTML = `
      <div class="empty-row">
        Tiada laporan ${escapeHtml(label)} untuk tarikh ini.
      </div>
    `;
    return;
  }

  ruang.innerHTML =
    senarai.map((item, index) => {
      const data =
        dataLaporanCarta(item);

      const petugas =
        rekodPetugasUntukLaporanInsidenPentadbir(item);

      const nilai =
        nilaiInsidenDaripadaLaporanPentadbir(
          item,
          kategori
        );

      const butiran =
        teksNilaiCarta(nilai) || "-";

      const jenisTugas =
        jenisTugasCarta(item) ||
        petugas?.jenisTugas ||
        "-";

      const lokasi =
        lokasiLaporanInsidenPentadbir(
          item,
          petugas
        );

      const namaPetugas =
        petugas
          ? `${teks(petugas.pangkat)} ${teks(petugas.nama)}`.trim()
          : teks(item.nama_petugas || item.nama) || "-";

      const noBadan =
        teks(petugas?.noBadan) ||
        teks(item.no_badan) ||
        "-";

      const telefon =
        teks(petugas?.telefon) ||
        teks(item.no_telefon) ||
        teks(item.telefon) ||
        "-";

      const catatanTambahan =
        teksNilaiCarta(
          data.catatan ??
          data.perkara_menarik ??
          data.catatan_no_repot
        );

      return `
        <article class="admin-incident-detail-item">
          <div class="admin-incident-detail-number">
            ${index + 1}
          </div>

          <div class="admin-incident-detail-main">
            <div class="admin-incident-detail-top">
              <strong>${escapeHtml(label)}</strong>
              <time>
                ${escapeHtml(
                  formatMasaLaporanAdmin(
                    item.tarikh_masa
                  )
                )}
              </time>
            </div>

            <div class="admin-incident-detail-body">
              <div>
                <span>Butiran</span>
                <b>${escapeHtml(butiran)}</b>
              </div>

              <div>
                <span>Lokasi</span>
                <b>${escapeHtml(lokasi)}</b>
              </div>

              <div>
                <span>Jenis Tugas</span>
                <b>${escapeHtml(jenisTugas)}</b>
              </div>

              <div>
                <span>Petugas</span>
                <b>${escapeHtml(namaPetugas)}</b>
              </div>

              <div>
                <span>No Badan</span>
                <b>${escapeHtml(noBadan)}</b>
              </div>

              <div>
                <span>No. Telefon</span>
                <b>${escapeHtml(telefon)}</b>
              </div>
            </div>

            ${
              catatanTambahan
                ? `
                  <div class="admin-incident-note">
                    <span>Catatan</span>
                    <p>${escapeHtml(catatanTambahan)}</p>
                  </div>
                `
                : ""
            }
          </div>
        </article>
      `;
    }).join("");
}


function pilihKategoriCartaInsidenPentadbir(index) {
  const kategori = [
    "TANGKAPAN",
    "RAMPASAN",
    "KEMALANGAN",
    "ANCAMAN"
  ][index];

  if (!kategori) return;

  paparButiranInsidenPentadbir(kategori);
}



function sorotBarInsidenPentadbir(indexDipilih) {
  const carta =
    cartaInsidenPentadbir;

  if (!carta) return;

  const dataset =
    carta.data.datasets?.[0];

  if (!dataset) return;

  /*
    Warna berbeza untuk kategori dipilih.
    Tidak bergantung pada warna khusus untuk setiap kategori,
    cuma beri opacity lebih jelas pada pilihan aktif.
  */
  const warnaAsal =
    carta.options?.plugins?._warnaInsidenAsal ||
    "rgba(54, 162, 235, 0.65)";

  dataset.backgroundColor =
    carta.data.labels.map(
      (_, index) =>
        index === indexDipilih
          ? "rgba(212, 175, 55, 0.95)"
          : "rgba(54, 162, 235, 0.48)"
    );

  dataset.borderColor =
    carta.data.labels.map(
      (_, index) =>
        index === indexDipilih
          ? "#ffffff"
          : "rgba(255,255,255,.25)"
    );

  dataset.borderWidth =
    carta.data.labels.map(
      (_, index) =>
        index === indexDipilih
          ? 2
          : 1
    );

  carta.update();
}


function paparCartaInsidenPentadbir() {
  const kanvas =
    el("canvasCartaInsiden");

  if (!kanvas) return;

  try {
    pastikanChartJsPentadbir();
  } catch (_) {
    return;
  }

  const insiden =
    kiraInsidenCarta();

  const nilaiCarta = [
    insiden.tangkapan,
    insiden.rampasan,
    insiden.kemalangan,
    insiden.ancaman
  ];

  kemusnahkanCartaPentadbir(
    cartaInsidenPentadbir
  );

  cartaInsidenPentadbir =
    new Chart(kanvas, {
      type: "bar",

      data: {
        labels: [
          "Tangkapan",
          "Rampasan",
          "Kemalangan",
          "Ancaman"
        ],

        datasets: [
          {
            label: "Bilangan Laporan",
            data: nilaiCarta
          }
        ]
      },

      options: {
        responsive: true,
        maintainAspectRatio: false,

        onClick(event) {
          /*
            Cuba kesan bar yang diklik terlebih dahulu.
            intersect:false membolehkan bar yang sangat pendek
            masih mudah dipilih.
          */
          const elemenTerdekat =
            cartaInsidenPentadbir
              ?.getElementsAtEventForMode(
                event,
                "nearest",
                {
                  intersect: false,
                  axis: "x"
                },
                true
              ) || [];

          if (elemenTerdekat.length) {
            pilihKategoriCartaInsidenPentadbir(
              elemenTerdekat[0].index
            );
            sorotBarInsidenPentadbir(
              elemenTerdekat[0].index
            );
            return;
          }

          /*
            Fallback:
            tentukan kategori berdasarkan kedudukan X klik.
            Jadi walaupun nilai = 0 dan bar hampir tidak kelihatan,
            kawasan kategorinya masih boleh diklik.
          */
          const carta =
            cartaInsidenPentadbir;

          const xScale =
            carta?.scales?.x;

          const nativeEvent =
            event?.native;

          if (
            !carta ||
            !xScale ||
            !nativeEvent
          ) {
            return;
          }

          const rect =
            carta.canvas.getBoundingClientRect();

          const x =
            nativeEvent.clientX -
            rect.left;

          let indexTerdekat = -1;
          let jarakTerdekat = Infinity;

          carta.data.labels.forEach(
            (_, index) => {
              const pixel =
                xScale.getPixelForValue(index);

              const jarak =
                Math.abs(pixel - x);

              if (jarak < jarakTerdekat) {
                jarakTerdekat = jarak;
                indexTerdekat = index;
              }
            }
          );

          if (indexTerdekat >= 0) {
            pilihKategoriCartaInsidenPentadbir(
              indexTerdekat
            );
            sorotBarInsidenPentadbir(
              indexTerdekat
            );
          }
        },

        onHover(event) {
          const sasaran =
            event?.native?.target;

          if (sasaran) {
            sasaran.style.cursor =
              "pointer";
          }
        },

        plugins: {
          legend: {
            labels: {
              color: "#ffffff",
              font: {
                size: 12,
                weight: "700"
              }
            }
          },

          tooltip: {
            callbacks: {
              label(context) {
                return `${context.label}: ${Number(context.raw) || 0} laporan`;
              },

              afterLabel() {
                return "Klik untuk papar butiran";
              }
            }
          }
        },

        scales: {
          x: {
            ticks: {
              color: "#ffffff",
              font: {
                weight: "700"
              }
            },

            grid: {
              color: "rgba(255,255,255,.06)"
            }
          },

          y: {
            beginAtZero: true,

            ticks: {
              color: "#c8c8c8",
              precision: 0
            },

            grid: {
              color: "rgba(255,255,255,.06)"
            },

            title: {
              display: true,
              text: "Bilangan Insiden",
              color: "#c8c8c8"
            }
          }
        }
      }
    });

  paparButiranInsidenPentadbir(
    kategoriInsidenDipilihPentadbir
  );

  const indeksAktif = [
    "TANGKAPAN",
    "RAMPASAN",
    "KEMALANGAN",
    "ANCAMAN"
  ].indexOf(
    kategoriInsidenDipilihPentadbir
  );

  if (indeksAktif >= 0) {
    sorotBarInsidenPentadbir(
      indeksAktif
    );
  }
}


/* ================================================================
   VVIP / VIP — PAPARAN + CRUD SUPABASE
================================================================ */

function ralatJadualVvipVipBelumWujud(error) {
  return (
    error?.code === "42P01" ||
    /vvip_vip_operasi|relation.*does not exist|could not find.*table/i.test(
      error?.message || ""
    )
  );
}


async function muatVvipVipOperasiPentadbir(
  tarikh,
  paparStatus = true
) {
  const tarikhDipilih =
    tarikh ||
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    hariIniMalaysia();

  try {
    const { data, error } =
      await denganHadMasa(
        db.from("vvip_vip_operasi")
          .select("*")
          .eq("tarikh", tarikhDipilih)
          .order("masa_tiba", { ascending: true })
          .order("nama", { ascending: true })
      );

    if (error) throw error;

    dataVvipVipOperasiPentadbir =
      data || [];

    paparCartaVvipVipPentadbir();
    paparRingkasanCartaPentadbir();

    if (paparStatus) {
      paparMesej(
        "statusVvipVipPentadbir",
        `${dataVvipVipOperasiPentadbir.length} rekod tambahan VVIP / VIP dimuatkan.`,
        "success"
      );
    }

    return true;

  } catch (error) {
    console.error(
      "Gagal memuat VVIP/VIP:",
      error
    );

    dataVvipVipOperasiPentadbir = [];
    paparCartaVvipVipPentadbir();

    const mesej =
      ralatJadualVvipVipBelumWujud(error)
        ? "Jadual vvip_vip_operasi belum diwujudkan. Jalankan SQL yang disediakan dalam Supabase SQL Editor."
        : `Ralat VVIP / VIP: ${error.message || "Ralat tidak diketahui."}`;

    paparMesej(
      "statusVvipVipPentadbir",
      escapeHtml(mesej),
      "error"
    );

    return false;
  }
}


async function muatSemulaVvipVipPentadbir() {
  const tarikh =
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    hariIniMalaysia();

  await muatVvipVipOperasiPentadbir(
    tarikh,
    true
  );
}


function kosongkanBorangVvipVipPentadbir() {
  rekodVvipVipSedangEditPentadbir = null;

  const nilaiKosong = [
    "idVvipVipPentadbir",
    "namaVvipVipPentadbir",
    "jawatanVvipVipPentadbir",
    "agensiVvipVipPentadbir",
    "masaTibaVvipVipPentadbir",
    "masaBeredarVvipVipPentadbir",
    "lokasiVvipVipPentadbir",
    "tujuanVvipVipPentadbir",
    "catatanVvipVipPentadbir"
  ];

  nilaiKosong.forEach(id => {
    if (el(id)) el(id).value = "";
  });

  if (el("kategoriVvipVipPentadbir")) {
    el("kategoriVvipVipPentadbir").value = "VIP";
  }

  const status =
    el("statusModalVvipVipPentadbir");

  if (status) {
    status.className = "status-box";
    status.innerHTML = "";
  }
}


function bukaTambahVvipVipPentadbir() {
  kosongkanBorangVvipVipPentadbir();

  const tarikh =
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    hariIniMalaysia();

  if (el("tarikhVvipVipPentadbir")) {
    el("tarikhVvipVipPentadbir").value =
      tarikh;
  }

  if (el("tajukModalVvipVipPentadbir")) {
    el("tajukModalVvipVipPentadbir").textContent =
      "Tambah VVIP / VIP";
  }

  const modal =
    el("modalVvipVipPentadbir");

  if (modal) {
    modal.hidden = false;
    modal.classList.add("open");
  }
}


function bukaEditVvipVipPentadbir(id) {
  const rekod =
    dataVvipVipOperasiPentadbir.find(
      item =>
        teks(item.id) === teks(id)
    );

  if (!rekod) {
    alert("Rekod VVIP / VIP tidak dijumpai.");
    return;
  }

  rekodVvipVipSedangEditPentadbir =
    rekod;

  if (el("idVvipVipPentadbir")) {
    el("idVvipVipPentadbir").value =
      rekod.id || "";
  }

  if (el("tarikhVvipVipPentadbir")) {
    el("tarikhVvipVipPentadbir").value =
      rekod.tarikh || "";
  }

  if (el("kategoriVvipVipPentadbir")) {
    el("kategoriVvipVipPentadbir").value =
      atas(rekod.kategori) === "VVIP"
        ? "VVIP"
        : "VIP";
  }

  const map = {
    namaVvipVipPentadbir: rekod.nama,
    jawatanVvipVipPentadbir: rekod.jawatan,
    agensiVvipVipPentadbir: rekod.agensi,
    masaTibaVvipVipPentadbir: rekod.masa_tiba,
    masaBeredarVvipVipPentadbir: rekod.masa_beredar,
    lokasiVvipVipPentadbir: rekod.lokasi,
    tujuanVvipVipPentadbir: rekod.tujuan,
    catatanVvipVipPentadbir: rekod.catatan
  };

  Object.entries(map).forEach(([idElemen, nilai]) => {
    if (el(idElemen)) {
      el(idElemen).value =
        teks(nilai);
    }
  });

  if (el("tajukModalVvipVipPentadbir")) {
    el("tajukModalVvipVipPentadbir").textContent =
      "Edit VVIP / VIP";
  }

  const modal =
    el("modalVvipVipPentadbir");

  if (modal) {
    modal.hidden = false;
    modal.classList.add("open");
  }
}


function tutupModalVvipVipPentadbir() {
  const modal =
    el("modalVvipVipPentadbir");

  if (modal) {
    modal.classList.remove("open");
    modal.hidden = true;
  }

  kosongkanBorangVvipVipPentadbir();
}


async function simpanVvipVipPentadbir() {
  const btn =
    el("btnSimpanVvipVipPentadbir");

  const id =
    teks(
      el("idVvipVipPentadbir")?.value
    );

  const tarikh =
    teks(
      el("tarikhVvipVipPentadbir")?.value
    );

  const kategori =
    atas(
      el("kategoriVvipVipPentadbir")?.value
    );

  const nama =
    atas(
      el("namaVvipVipPentadbir")?.value
    );

  if (!tarikh || !kategori || !nama) {
    paparMesej(
      "statusModalVvipVipPentadbir",
      "Tarikh, Kategori dan Nama wajib diisi.",
      "error"
    );
    return;
  }

  const payload = {
    tarikh,
    kategori,
    nama,
    jawatan:
      atas(
        el("jawatanVvipVipPentadbir")?.value
      ) || null,
    agensi:
      atas(
        el("agensiVvipVipPentadbir")?.value
      ) || null,
    masa_tiba:
      teks(
        el("masaTibaVvipVipPentadbir")?.value
      ) || null,
    masa_beredar:
      teks(
        el("masaBeredarVvipVipPentadbir")?.value
      ) || null,
    lokasi:
      atas(
        el("lokasiVvipVipPentadbir")?.value
      ) || null,
    tujuan:
      atas(
        el("tujuanVvipVipPentadbir")?.value
      ) || null,
    catatan:
      atas(
        el("catatanVvipVipPentadbir")?.value
      ) || null,
    dikemaskini_oleh:
      adminLogin?.id || null
  };

  btn.disabled = true;
  btn.textContent =
    id
      ? "SEDANG MENGEMAS KINI..."
      : "SEDANG MENYIMPAN...";

  try {
    let hasil;

    if (id) {
      hasil =
        await denganHadMasa(
          db.from("vvip_vip_operasi")
            .update(payload)
            .eq("id", id)
            .select()
            .single()
        );
    } else {
      hasil =
        await denganHadMasa(
          db.from("vvip_vip_operasi")
            .insert({
              ...payload,
              dicipta_oleh:
                adminLogin?.id || null
            })
            .select()
            .single()
        );
    }

    if (hasil.error) throw hasil.error;

    if (el("tarikhCartaPentadbir")) {
      el("tarikhCartaPentadbir").value =
        tarikh;
    }

    await muatVvipVipOperasiPentadbir(
      tarikh,
      false
    );

    paparMesej(
      "statusVvipVipPentadbir",
      id
        ? "Rekod VVIP / VIP berjaya dikemas kini."
        : "Rekod VVIP / VIP berjaya ditambah.",
      "success"
    );

    tutupModalVvipVipPentadbir();

  } catch (error) {
    console.error(
      "Simpan VVIP/VIP gagal:",
      error
    );

    const mesej =
      ralatJadualVvipVipBelumWujud(error)
        ? "Jadual vvip_vip_operasi belum diwujudkan. Jalankan SQL yang disediakan dahulu."
        : error.message;

    paparMesej(
      "statusModalVvipVipPentadbir",
      `Gagal menyimpan: ${escapeHtml(mesej || "Ralat tidak diketahui.")}`,
      "error"
    );

  } finally {
    btn.disabled = false;
    btn.textContent =
      "SIMPAN VVIP / VIP";
  }
}


async function padamVvipVipPentadbir(id) {
  const rekod =
    dataVvipVipOperasiPentadbir.find(
      item =>
        teks(item.id) === teks(id)
    );

  if (!rekod) return;

  if (
    !confirm(
      `Padam ${rekod.kategori || "VIP"} ${rekod.nama || ""}?`
    )
  ) {
    return;
  }

  try {
    const { error } =
      await denganHadMasa(
        db.from("vvip_vip_operasi")
          .delete()
          .eq("id", id)
      );

    if (error) throw error;

    await muatVvipVipOperasiPentadbir(
      rekod.tarikh,
      false
    );

    paparMesej(
      "statusVvipVipPentadbir",
      "Rekod VVIP / VIP berjaya dipadam.",
      "success"
    );

  } catch (error) {
    console.error(
      "Padam VVIP/VIP gagal:",
      error
    );

    paparMesej(
      "statusVvipVipPentadbir",
      `Gagal memadam rekod: ${escapeHtml(error.message)}`,
      "error"
    );
  }
}


function formatMasaVvipVipPentadbir(nilai) {
  const masa = teks(nilai);
  if (!masa) return "-";

  if (/^\d{2}:\d{2}(:\d{2})?$/.test(masa)) {
    return masa.slice(0, 5);
  }

  try {
    return formatMasaLaporanAdmin(masa);
  } catch (_) {
    return masa;
  }
}


function bolehBukaButiranVvipVipPentadbir(item) {
  return Boolean(item);
}



function kosongkanButiranVvipVipPentadbir() {
  idVvipVipDipilihPentadbir = "";

  const tajuk =
    el("tajukButiranVvipVipPentadbir");

  const ruang =
    el("butiranVvipVipPentadbir");

  if (tajuk) {
    tajuk.textContent =
      "PILIH VVIP / VIP";
  }

  if (ruang) {
    ruang.innerHTML = `
      <div class="admin-vvip-detail-empty">
        <strong>BUTIRAN PETUGAS</strong>
        <p>
          Klik mana-mana nama VVIP / VIP untuk melihat maklumat
          petugas yang menghantar laporan.
        </p>
      </div>
    `;
  }
}


function pilihVvipVipPentadbir(id) {
  const senarai =
    kumpulanVvipVipCarta();

  const item =
    senarai.find(
      rekod =>
        teks(rekod.id) === teks(id)
    );

  if (!item) {
    return;
  }

  idVvipVipDipilihPentadbir =
    item.id;

  document
    .querySelectorAll(
      ".admin-vvip-name-item"
    )
    .forEach(elemen =>
      elemen.classList.remove("active")
    );

  const aktif =
    document.querySelector(
      `.admin-vvip-name-item[data-vvip-id="${CSS.escape(String(item.id))}"]`
    );

  if (aktif) {
    aktif.classList.add("active");
  }

  paparButiranVvipVipPentadbir(
    item
  );
}


function paparButiranVvipVipPentadbir(item) {
  const tajuk =
    el("tajukButiranVvipVipPentadbir");

  const ruang =
    el("butiranVvipVipPentadbir");

  if (!tajuk || !ruang || !item) return;

  tajuk.textContent =
    item.nama || "VVIP / VIP";

  const petugasNama =
    teks(item.petugasNama) || "-";

  const noBadan =
    teks(item.noBadan) || "-";

  const lokasi =
    teks(
      item.tempatTugas ||
      item.lokasi
    ) || "-";

  const jenisTugas =
    teks(item.jenisTugasPetugas) || "-";

  const callSign =
    teks(item.callSign) || "-";

  ruang.innerHTML = `
    <div class="admin-vvip-detail-source">
      SUMBER: ${escapeHtml(item.sumber || "-")}
    </div>

    <div class="admin-vvip-detail-grid">
      <div class="admin-vvip-detail-wide">
        <span>Petugas :</span>
        <b>${escapeHtml(petugasNama)}</b>
      </div>

      <div>
        <span>No. Badan :</span>
        <b>${escapeHtml(noBadan)}</b>
      </div>

      <div>
        <span>Call Sign :</span>
        <b>${escapeHtml(callSign)}</b>
      </div>

      <div>
        <span>Lokasi :</span>
        <b>${escapeHtml(lokasi)}</b>
      </div>

      <div>
        <span>Jenis Tugas :</span>
        <b>${escapeHtml(jenisTugas)}</b>
      </div>
    </div>
  `;
}

function paparCartaVvipVipPentadbir() {
  const ruang =
    el("senaraiCartaVvipVip");

  const jumlah =
    el("jumlahSenaraiVvipVipPentadbir");

  if (!ruang) return;

  const senarai =
    kumpulanVvipVipCarta();

  if (jumlah) {
    jumlah.textContent =
      `${senarai.length.toLocaleString("ms-MY")} REKOD`;
  }

  if (!senarai.length) {
    ruang.innerHTML =
      '<div class="empty-row">Tiada maklumat VVIP / VIP untuk tarikh ini.</div>';

    kosongkanButiranVvipVipPentadbir();
    return;
  }

  /*
    Jika rekod yang sedang dipilih sudah tiada selepas refresh,
    kosongkan panel kanan.
  */
  if (
    idVvipVipDipilihPentadbir &&
    !senarai.some(
      item =>
        teks(item.id) ===
        teks(idVvipVipDipilihPentadbir)
    )
  ) {
    kosongkanButiranVvipVipPentadbir();
  }

  ruang.innerHTML =
    senarai.map((item, index) => {
      const bolehBukaButiran =
        bolehBukaButiranVvipVipPentadbir(item);

      const aktif =
        bolehBukaButiran &&
        teks(item.id) ===
          teks(idVvipVipDipilihPentadbir);

      const tindakanManual =
        item.jenisRekod === "MANUAL"
          ? `
            <div class="admin-vvip-manual-actions">
              <button
                class="admin-committee-edit-button"
                type="button"
                onclick="event.stopPropagation();bukaEditVvipVipPentadbir('${escapeHtml(item.id)}')"
              >
                EDIT
              </button>

              <button
                class="admin-committee-delete-button"
                type="button"
                onclick="event.stopPropagation();padamVvipVipPentadbir('${escapeHtml(item.id)}')"
              >
                PADAM
              </button>
            </div>
          `
          : "";

      const petunjuk =
        bolehBukaButiran
          ? `
            <span class="admin-vvip-open-hint">
              KLIK UNTUK BUTIRAN
            </span>
          `
          : "";

      return `
        <article
          class="admin-vvip-name-item ${bolehBukaButiran ? "clickable" : "manual"} ${aktif ? "active" : ""}"
          data-vvip-id="${escapeHtml(item.id)}"
          ${
            bolehBukaButiran
              ? `onclick="pilihVvipVipPentadbir('${escapeHtml(item.id)}')"`
              : ""
          }
        >
          <span class="admin-vvip-name-number">
            ${index + 1}
          </span>

          <div class="admin-vvip-name-main">
            <strong>
              ${escapeHtml(item.kategori || "VVIP / VIP")}
              — ${escapeHtml(item.nama || "-")}
            </strong>

            <small>
              SUMBER: ${escapeHtml(item.sumber || "-")}
            </small>

            ${petunjuk}
            ${tindakanManual}
          </div>
        </article>
      `;
    }).join("");

  /*
    Kekalkan butiran yang sedang dipilih selepas render semula.
  */
  if (idVvipVipDipilihPentadbir) {
    const dipilih =
      senarai.find(
        item =>
          teks(item.id) ===
          teks(idVvipVipDipilihPentadbir)
      );

    if (dipilih) {
      paparButiranVvipVipPentadbir(
        dipilih
      );
    }
  }
}



/* ================================================================
   AGENSI LUAR OPERASI — SUPABASE CRUD
================================================================ */

function nomborAgensiLuarPentadbir(nilai) {
  const nombor =
    Number(nilai);

  if (
    !Number.isFinite(nombor) ||
    nombor < 0
  ) {
    return 0;
  }

  return Math.floor(nombor);
}


function dataAgensiLuarPentadbir() {
  return [...dataAgensiLuarOperasiPentadbir]
    .sort((a, b) =>
      atas(a.jabatan_agensi)
        .localeCompare(
          atas(b.jabatan_agensi),
          "ms"
        )
    );
}


function ralatJadualAgensiLuarBelumWujud(error) {
  return (
    error?.code === "42P01" ||
    /agensi_luar_operasi|relation.*does not exist|could not find.*table/i.test(
      error?.message || ""
    )
  );
}


function ralatKolumAgensiLuarBelumWujud(error) {
  return (
    /kekuatan|kenderaan|column.*does not exist|schema cache/i.test(
      error?.message || ""
    )
  );
}


async function muatAgensiLuarOperasiPentadbir(
  tarikh,
  paparStatus = true
) {
  const tarikhDipilih =
    tarikh ||
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    hariIniMalaysia();

  try {
    const { data, error } =
      await denganHadMasa(
        db.from("agensi_luar_operasi")
          .select("*")
          .eq(
            "tarikh",
            tarikhDipilih
          )
          .order(
            "jabatan_agensi",
            {
              ascending: true
            }
          )
      );

    if (error) {
      throw error;
    }

    dataAgensiLuarOperasiPentadbir =
      data || [];

    paparCartaAgensiLuarPentadbir();

    if (paparStatus) {
      paparMesej(
        "statusAgensiLuarPentadbir",
        `${dataAgensiLuarOperasiPentadbir.length} rekod agensi luar berjaya dimuatkan.`,
        "success"
      );
    }

    return true;

  } catch (error) {
    console.error(
      "Gagal memuatkan agensi luar:",
      error
    );

    dataAgensiLuarOperasiPentadbir = [];
    paparCartaAgensiLuarPentadbir();

    let mesej =
      `Ralat agensi luar: ${error.message || "Ralat tidak diketahui."}`;

    if (
      ralatJadualAgensiLuarBelumWujud(
        error
      )
    ) {
      mesej =
        "Jadual agensi_luar_operasi belum diwujudkan. Jalankan SQL yang disediakan.";

    } else if (
      ralatKolumAgensiLuarBelumWujud(
        error
      )
    ) {
      mesej =
        "Kolum KEKUATAN / KENDERAAN belum diwujudkan. Jalankan SQL kemas kini Agensi Luar yang disediakan.";
    }

    paparMesej(
      "statusAgensiLuarPentadbir",
      escapeHtml(mesej),
      "error"
    );

    return false;
  }
}


async function muatSemulaAgensiLuarPentadbir() {
  const tarikh =
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    hariIniMalaysia();

  await muatAgensiLuarOperasiPentadbir(
    tarikh,
    true
  );
}


function resetBorangAgensiLuarPentadbir() {
  [
    "idAgensiLuarPentadbir",
    "jabatanAgensiLuarPentadbir",
    "pegawaiAgensiLuarPentadbir",
    "telefonAgensiLuarPentadbir"
  ].forEach(id => {
    if (el(id)) {
      el(id).value = "";
    }
  });

  [
    "pegawaiKekuatanAgensiLuarPentadbir",
    "anggotaKekuatanAgensiLuarPentadbir",
    "basAgensiLuarPentadbir",
    "jenteraAgensiLuarPentadbir",
    "loriAgensiLuarPentadbir",
    "vanAgensiLuarPentadbir",
    "motokarAgensiLuarPentadbir",
    "motosikalAgensiLuarPentadbir"
  ].forEach(id => {
    if (el(id)) {
      el(id).value = "0";
    }
  });

  const status =
    el("statusModalAgensiLuarPentadbir");

  if (status) {
    status.innerHTML = "";
    status.style.display = "none";
  }
}


function bukaTambahAgensiLuarPentadbir() {
  const modal =
    document.getElementById(
      "modalAgensiLuarPentadbir"
    );

  /*
    Buka modal TERLEBIH DAHULU.
    Jadi walaupun ada masalah pada reset borang,
    modal masih akan kelihatan.
  */
  if (modal) {
    modal.hidden = false;
    modal.removeAttribute("hidden");
    modal.classList.add("open");
    modal.style.display = "block";
    modal.style.zIndex = "99999";
  }

  try {
    rekodAgensiLuarSedangEditPentadbir =
      null;

    resetBorangAgensiLuarPentadbir();

    const tarikh =
      el("tarikhCartaPentadbir")?.value ||
      el("tarikh")?.value ||
      hariIniMalaysia();

    if (
      el("tarikhAgensiLuarPentadbir")
    ) {
      el(
        "tarikhAgensiLuarPentadbir"
      ).value = tarikh;
    }

    if (
      el("tajukModalAgensiLuarPentadbir")
    ) {
      el(
        "tajukModalAgensiLuarPentadbir"
      ).textContent =
        "Tambah Bantuan Luar";
    }

  } catch (error) {
    console.error(
      "Ralat menyediakan borang Agensi Luar:",
      error
    );
  }
}

function bukaEditAgensiLuarPentadbir(id) {
  const item =
    dataAgensiLuarOperasiPentadbir
      .find(rekod =>
        teks(rekod.id) ===
        teks(id)
      );

  if (!item) {
    alert(
      "Rekod agensi luar tidak ditemui."
    );
    return;
  }

  rekodAgensiLuarSedangEditPentadbir =
    item;

  const nilai = {
    idAgensiLuarPentadbir:
      item.id || "",

    tarikhAgensiLuarPentadbir:
      item.tarikh || "",

    jabatanAgensiLuarPentadbir:
      item.jabatan_agensi || "",

    pegawaiKekuatanAgensiLuarPentadbir:
      item.pegawai ?? 0,

    anggotaKekuatanAgensiLuarPentadbir:
      item.anggota ??
      Math.max(
        0,
        nomborAgensiLuarPentadbir(item.kekuatan) -
        nomborAgensiLuarPentadbir(item.pegawai)
      ),

    basAgensiLuarPentadbir:
      item.bas ?? 0,

    jenteraAgensiLuarPentadbir:
      item.jentera ?? 0,

    loriAgensiLuarPentadbir:
      item.lori ?? 0,

    vanAgensiLuarPentadbir:
      item.van ?? 0,

    motokarAgensiLuarPentadbir:
      item.motokar ?? 0,

    motosikalAgensiLuarPentadbir:
      item.motosikal ?? 0,

    pegawaiAgensiLuarPentadbir:
      item.pegawai_penyelaras || "",

    telefonAgensiLuarPentadbir:
      item.telefon || ""
  };

  Object.entries(nilai)
    .forEach(
      ([idElemen, nilaiElemen]) => {
        if (el(idElemen)) {
          el(idElemen).value =
            nilaiElemen;
        }
      }
    );

  if (
    el("tajukModalAgensiLuarPentadbir")
  ) {
    el(
      "tajukModalAgensiLuarPentadbir"
    ).textContent =
      "Edit Bantuan Luar";
  }

  const status =
    el("statusModalAgensiLuarPentadbir");

  if (status) {
    status.innerHTML = "";
    status.style.display = "none";
  }

  const modal =
    el("modalAgensiLuarPentadbir");

  if (modal) {
    modal.hidden = false;
    modal.removeAttribute("hidden");
    modal.classList.add("open");
    modal.style.display = "block";
    modal.style.zIndex = "99999";
  }
}


function tutupModalAgensiLuarPentadbir() {
  const modal =
    document.getElementById(
      "modalAgensiLuarPentadbir"
    );

  if (modal) {
    modal.classList.remove("open");
    modal.style.display = "none";
    modal.hidden = true;
    modal.setAttribute(
      "hidden",
      ""
    );
  }

  rekodAgensiLuarSedangEditPentadbir =
    null;
}

async function simpanAgensiLuarPentadbir() {
  const btn =
    el("btnSimpanAgensiLuarPentadbir");

  const id =
    teks(
      el(
        "idAgensiLuarPentadbir"
      )?.value
    );

  const payload = {
    tarikh:
      teks(
        el(
          "tarikhAgensiLuarPentadbir"
        )?.value
      ),

    jabatan_agensi:
      atas(
        el(
          "jabatanAgensiLuarPentadbir"
        )?.value
      ),

    pegawai:
      nomborAgensiLuarPentadbir(
        el("pegawaiKekuatanAgensiLuarPentadbir")?.value
      ),

    anggota:
      nomborAgensiLuarPentadbir(
        el("anggotaKekuatanAgensiLuarPentadbir")?.value
      ),

    bas:
      nomborAgensiLuarPentadbir(
        el("basAgensiLuarPentadbir")?.value
      ),

    jentera:
      nomborAgensiLuarPentadbir(
        el("jenteraAgensiLuarPentadbir")?.value
      ),

    lori:
      nomborAgensiLuarPentadbir(
        el("loriAgensiLuarPentadbir")?.value
      ),

    van:
      nomborAgensiLuarPentadbir(
        el("vanAgensiLuarPentadbir")?.value
      ),

    motokar:
      nomborAgensiLuarPentadbir(
        el("motokarAgensiLuarPentadbir")?.value
      ),

    motosikal:
      nomborAgensiLuarPentadbir(
        el("motosikalAgensiLuarPentadbir")?.value
      ),

    pegawai_penyelaras:
      atas(
        el(
          "pegawaiAgensiLuarPentadbir"
        )?.value
      ),

    telefon:
      teks(
        el(
          "telefonAgensiLuarPentadbir"
        )?.value
      )
  };

  /*
    Kolum KEKUATAN dan KENDERAAN dalam jadual utama kekal sebagai JUMLAH.
    Pecahan disimpan dalam kolum masing-masing.
  */
  payload.kekuatan =
    payload.pegawai +
    payload.anggota;

  payload.kenderaan =
    payload.bas +
    payload.jentera +
    payload.lori +
    payload.van +
    payload.motokar +
    payload.motosikal;

  if (!payload.tarikh) {
    paparMesej(
      "statusModalAgensiLuarPentadbir",
      "Tarikh wajib diisi.",
      "error"
    );
    return;
  }

  if (!payload.jabatan_agensi) {
    paparMesej(
      "statusModalAgensiLuarPentadbir",
      "Jabatan / Agensi wajib diisi.",
      "error"
    );
    return;
  }

  if (!payload.pegawai_penyelaras) {
    paparMesej(
      "statusModalAgensiLuarPentadbir",
      "Pegawai Penyelaras wajib diisi.",
      "error"
    );
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent =
      id
        ? "SEDANG MENGEMAS KINI..."
        : "SEDANG MENYIMPAN...";
  }

  try {
    let hasil;

    if (id) {
      hasil =
        await denganHadMasa(
          db.from(
            "agensi_luar_operasi"
          )
            .update({
              ...payload,
              updated_at:
                new Date().toISOString()
            })
            .eq(
              "id",
              id
            )
            .select("*")
            .single()
        );

    } else {
      hasil =
        await denganHadMasa(
          db.from(
            "agensi_luar_operasi"
          )
            .insert({
              ...payload,
              created_by:
                adminLogin?.id ||
                adminLogin?.authUserId ||
                null
            })
            .select("*")
            .single()
        );
    }

    if (hasil.error) {
      throw hasil.error;
    }

    await muatAgensiLuarOperasiPentadbir(
      el(
        "tarikhCartaPentadbir"
      )?.value ||
      payload.tarikh,
      false
    );

    tutupModalAgensiLuarPentadbir();

  } catch (error) {
    console.error(
      "Gagal menyimpan Agensi Luar:",
      error
    );

    let mesej =
      `Gagal menyimpan rekod: ${error.message || "Ralat tidak diketahui."}`;

    if (
      ralatKolumAgensiLuarBelumWujud(
        error
      )
    ) {
      mesej =
        "Kolum KEKUATAN / KENDERAAN belum diwujudkan dalam Supabase. Jalankan SQL kemas kini yang disediakan.";
    }

    paparMesej(
      "statusModalAgensiLuarPentadbir",
      escapeHtml(mesej),
      "error"
    );

  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent =
        "SIMPAN BANTUAN LUAR";
    }
  }
}


async function padamAgensiLuarPentadbir(id) {
  const item =
    dataAgensiLuarOperasiPentadbir
      .find(rekod =>
        teks(rekod.id) ===
        teks(id)
      );

  if (!item) {
    alert(
      "Rekod agensi luar tidak ditemui."
    );
    return;
  }

  if (
    !confirm(
      `Padam rekod agensi luar "${item.jabatan_agensi || "-"}"?`
    )
  ) {
    return;
  }

  try {
    const { error } =
      await denganHadMasa(
        db.from(
          "agensi_luar_operasi"
        )
          .delete()
          .eq(
            "id",
            id
          )
      );

    if (error) {
      throw error;
    }

    await muatSemulaAgensiLuarPentadbir();

  } catch (error) {
    alert(
      `Gagal memadam rekod: ${error.message || "Ralat tidak diketahui."}`
    );
  }
}


function paparCartaAgensiLuarPentadbir() {
  const tbody =
    el("tbodyAgensiLuarPentadbir");

  if (!tbody) {
    return;
  }

  const senarai =
    dataAgensiLuarPentadbir();

  const tarikh =
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    "";
if (!senarai.length) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="6"
          class="empty-row"
        >
          Tiada rekod agensi luar untuk tarikh ini.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML =
    senarai
      .map((item, index) => {
        const jumlahKekuatan =
          (item.pegawai != null || item.anggota != null)
            ? (
                nomborAgensiLuarPentadbir(item.pegawai) +
                nomborAgensiLuarPentadbir(item.anggota)
              )
            : nomborAgensiLuarPentadbir(item.kekuatan);

        const jumlahKenderaan =
          (item.bas != null ||
           item.jentera != null ||
           item.lori != null ||
           item.van != null ||
           item.motokar != null ||
           item.motosikal != null)
            ? (
                nomborAgensiLuarPentadbir(item.bas) +
                nomborAgensiLuarPentadbir(item.jentera) +
                nomborAgensiLuarPentadbir(item.lori) +
                nomborAgensiLuarPentadbir(item.van) +
                nomborAgensiLuarPentadbir(item.motokar) +
                nomborAgensiLuarPentadbir(item.motosikal)
              )
            : (item.kenderaan ??
          (
            nomborAgensiLuarPentadbir(item.bas) +
            nomborAgensiLuarPentadbir(item.lori) +
            nomborAgensiLuarPentadbir(item.jentera) +
            nomborAgensiLuarPentadbir(item.van) +
            nomborAgensiLuarPentadbir(item.motokar) +
            nomborAgensiLuarPentadbir(item.motosikal)
              ));

        return `
          <tr>
            <td style="text-align:center;">
              ${index + 1}
            </td>

            <td>
              <div class="admin-committee-task-text">
                ${escapeHtml(
                  item.jabatan_agensi || "-"
                )}
              </div>

              <div class="admin-committee-row-actions">
                <button
                  class="admin-committee-edit-button"
                  type="button"
                  onclick="bukaEditAgensiLuarPentadbir('${escapeHtml(item.id)}')"
                >
                  EDIT
                </button>

                <button
                  class="admin-committee-delete-button"
                  type="button"
                  onclick="padamAgensiLuarPentadbir('${escapeHtml(item.id)}')"
                >
                  PADAM
                </button>
              </div>
            </td>

            <td style="text-align:center;">
              ${jumlahKekuatan}
            </td>

            <td style="text-align:center;">
              ${nomborAgensiLuarPentadbir(
                jumlahKenderaan
              )}
            </td>

            <td style="text-align:center;">
              ${escapeHtml(
                item.pegawai_penyelaras || "-"
              )}
            </td>

            <td style="text-align:center;">
              ${escapeHtml(
                item.telefon || "-"
              )}
            </td>
          </tr>
        `;
      })
      .join("");
}


/* ================================================================
   JAWATANKUASA OPERASI — SUPABASE CRUD
================================================================ */

function dataJawatankuasaPentadbir() {
  return [...dataJawatankuasaOperasiPentadbir]
    .sort((a, b) => {
      const kumpulanA = atas(a.jawatankuasa);
      const kumpulanB = atas(b.jawatankuasa);

      if (kumpulanA !== kumpulanB) {
        return kumpulanA.localeCompare(kumpulanB, "ms");
      }

      const susunanA = Number(a.susunan);
      const susunanB = Number(b.susunan);
      const sahA = Number.isFinite(susunanA) && susunanA > 0;
      const sahB = Number.isFinite(susunanB) && susunanB > 0;

      if (sahA && sahB && susunanA !== susunanB) {
        return susunanA - susunanB;
      }
      if (sahA && !sahB) return -1;
      if (!sahA && sahB) return 1;

      const tugasA = atas(a.tugas);
      const tugasB = atas(b.tugas);

      if (tugasA !== tugasB) {
        return tugasA.localeCompare(tugasB, "ms");
      }

      return atas(a.nama).localeCompare(atas(b.nama), "ms");
    });
}


function teksPangkatNoNamaJawatankuasaPentadbir(item) {
  return [
    teks(item.pangkat),
    teks(item.no_badan),
    teks(item.nama)
  ]
    .filter(
      nilai =>
        nilai &&
        nilai !== "-"
    )
    .join(" ") || "-";
}


function ralatJadualJawatankuasaBelumWujud(error) {
  return (
    error?.code === "42P01" ||
    /jawatankuasa_operasi|relation.*does not exist|could not find.*table/i.test(
      error?.message || ""
    )
  );
}


async function muatJawatankuasaOperasiPentadbir(
  tarikh,
  paparStatus = true
) {
  const tarikhDipilih =
    tarikh ||
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    hariIniMalaysia();

  try {
    const { data, error } =
      await denganHadMasa(
        db.from("jawatankuasa_operasi")
          .select("*")
          .eq("tarikh", tarikhDipilih)
          .order("jawatankuasa", { ascending: true })
          .order("susunan", { ascending: true, nullsFirst: false })
          .order("tugas", { ascending: true })
          .order("nama", { ascending: true })
      );

    if (error) throw error;

    dataJawatankuasaOperasiPentadbir =
      data || [];

    paparCartaJawatankuasaPentadbir();

    if (paparStatus) {
      paparMesej(
        "statusJawatankuasaPentadbir",
        `${dataJawatankuasaOperasiPentadbir.length} rekod jawatankuasa berjaya dimuatkan.`,
        "success"
      );
    }

    return true;

  } catch (error) {
    console.error(
      "Gagal memuatkan jawatankuasa:",
      error
    );

    dataJawatankuasaOperasiPentadbir = [];
    paparCartaJawatankuasaPentadbir();

    const mesej =
      ralatJadualJawatankuasaBelumWujud(error)
        ? "Jadual jawatankuasa_operasi belum diwujudkan. Jalankan fail SQL yang disediakan dalam Supabase SQL Editor."
        : `Ralat jawatankuasa: ${error.message || "Ralat tidak diketahui."}`;

    paparMesej(
      "statusJawatankuasaPentadbir",
      escapeHtml(mesej),
      "error"
    );

    /*
      Jangan rosakkan carta lain jika table Jawatankuasa
      belum diwujudkan.
    */
    return false;
  }
}


async function muatSemulaJawatankuasaPentadbir() {
  const tarikh =
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    hariIniMalaysia();

  await muatJawatankuasaOperasiPentadbir(
    tarikh,
    true
  );
}


async function muatPilihanPetugasJawatankuasaPentadbir() {
  const select =
    el("petugasJawatankuasaPentadbir");

  if (!select) return;

  select.disabled = true;
  select.innerHTML =
    '<option value="">SEDANG MEMUATKAN PETUGAS...</option>';

  try {
    const { data, error } =
      await denganHadMasa(
        db.from("profiles")
          .select("*")
          .order("nama", { ascending: true })
      );

    if (error) throw error;

    dataPilihanPetugasJawatankuasaPentadbir =
      (data || [])
        .filter(item =>
          item.aktif !== false
        );

    select.innerHTML =
      '<option value="">PILIH PETUGAS</option>' +
      dataPilihanPetugasJawatankuasaPentadbir
        .map(item => {
          const label = [
            teks(item.pangkat),
            teks(item.no_badan),
            teks(item.nama)
          ]
            .filter(Boolean)
            .join(" ");

          return `
            <option value="${escapeHtml(item.id || "")}">
              ${escapeHtml(label || item.no_badan || item.nama || "-")}
            </option>
          `;
        })
        .join("");

  } catch (error) {
    console.error(
      "Gagal memuat pilihan petugas:",
      error
    );

    dataPilihanPetugasJawatankuasaPentadbir = [];

    select.innerHTML =
      '<option value="">GAGAL MEMUATKAN PETUGAS</option>';

    paparMesej(
      "statusModalJawatankuasaPentadbir",
      `Gagal mendapatkan senarai petugas: ${escapeHtml(error.message)}`,
      "error"
    );

  } finally {
    select.disabled = false;
  }
}


function petugasPilihanJawatankuasaPentadbir() {
  const id =
    teks(
      el(
        "petugasJawatankuasaPentadbir"
      )?.value
    );

  return (
    dataPilihanPetugasJawatankuasaPentadbir
      .find(item =>
        teks(item.id) === id
      ) ||
    null
  );
}


function kemasKiniPreviewPetugasJawatankuasaPentadbir(
  petugas
) {
  const nilai = {
    previewPangkatJawatankuasa:
      petugas?.pangkat || "-",

    previewNoBadanJawatankuasa:
      petugas?.no_badan || "-",

    previewNamaJawatankuasa:
      petugas?.nama || "-",

    previewTelefonJawatankuasa:
      petugas?.telefon ||
      petugas?.no_telefon ||
      "-"
  };

  Object.entries(nilai)
    .forEach(([id, teksPaparan]) => {
      if (el(id)) {
        el(id).textContent =
          teks(teksPaparan) || "-";
      }
    });
}


function pilihPetugasJawatankuasaPentadbir() {
  const petugas =
    petugasPilihanJawatankuasaPentadbir();

  kemasKiniPreviewPetugasJawatankuasaPentadbir(
    petugas
  );

  /*
    Unit boleh dicadangkan daripada profil,
    tetapi masih boleh diubah oleh Pentadbir.
  */
  const unitInput =
    el("unitJawatankuasaPentadbir");

  if (
    petugas &&
    unitInput &&
    !teks(unitInput.value)
  ) {
    unitInput.value =
      petugas.bahagian ||
      petugas.balai ||
      petugas.cawangan ||
      petugas.unit ||
      petugas.bahagian_unit ||
      "";
  }
}


function kosongkanBorangJawatankuasaPentadbir() {
  rekodJawatankuasaSedangEditPentadbir = null;

  if (el("idJawatankuasaPentadbir")) {
    el("idJawatankuasaPentadbir").value = "";
  }

  if (el("petugasJawatankuasaPentadbir")) {
    el("petugasJawatankuasaPentadbir").value = "";
  }

  if (el("namaJawatankuasaPentadbir")) {
    el("namaJawatankuasaPentadbir").value = "";
  }

  if (el("unitJawatankuasaPentadbir")) {
    el("unitJawatankuasaPentadbir").value = "";
  }

  if (el("tugasJawatankuasaPentadbir")) {
    el("tugasJawatankuasaPentadbir").value = "";
  }

  kemasKiniPreviewPetugasJawatankuasaPentadbir(
    null
  );

  const status =
    el("statusModalJawatankuasaPentadbir");

  if (status) {
    status.className = "status-box";
    status.innerHTML = "";
  }
}


async function bukaTambahJawatankuasaPentadbir() {
  kosongkanBorangJawatankuasaPentadbir();

  const tarikh =
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    hariIniMalaysia();

  if (el("tarikhJawatankuasaPentadbir")) {
    el("tarikhJawatankuasaPentadbir").value =
      tarikh;
  }

  if (el("tajukModalJawatankuasaPentadbir")) {
    el("tajukModalJawatankuasaPentadbir").textContent =
      "Tambah Jawatankuasa";
  }

  const modal =
    el("modalJawatankuasaPentadbir");

  if (modal) {
    modal.hidden = false;
    modal.classList.add("open");
  }

  await muatPilihanPetugasJawatankuasaPentadbir();
}


async function bukaEditJawatankuasaPentadbir(id) {
  const rekod =
    dataJawatankuasaOperasiPentadbir.find(
      item =>
        teks(item.id) === teks(id)
    );

  if (!rekod) {
    alert(
      "Rekod jawatankuasa tidak dijumpai."
    );
    return;
  }

  rekodJawatankuasaSedangEditPentadbir =
    rekod;

  const modal =
    el("modalJawatankuasaPentadbir");

  if (modal) {
    modal.hidden = false;
    modal.classList.add("open");
  }

  if (el("tajukModalJawatankuasaPentadbir")) {
    el("tajukModalJawatankuasaPentadbir").textContent =
      "Edit Jawatankuasa";
  }

  await muatPilihanPetugasJawatankuasaPentadbir();

  if (el("idJawatankuasaPentadbir")) {
    el("idJawatankuasaPentadbir").value =
      rekod.id || "";
  }

  if (el("tarikhJawatankuasaPentadbir")) {
    el("tarikhJawatankuasaPentadbir").value =
      rekod.tarikh || "";
  }

  if (el("petugasJawatankuasaPentadbir")) {
    el("petugasJawatankuasaPentadbir").value =
      rekod.petugas_id || "";
  }

  if (el("namaJawatankuasaPentadbir")) {
    el("namaJawatankuasaPentadbir").value =
      rekod.jawatankuasa || "";
  }

  if (el("unitJawatankuasaPentadbir")) {
    el("unitJawatankuasaPentadbir").value =
      rekod.unit || "";
  }

  if (el("tugasJawatankuasaPentadbir")) {
    el("tugasJawatankuasaPentadbir").value =
      rekod.tugas || "";
  }

  const petugas =
    petugasPilihanJawatankuasaPentadbir();

  kemasKiniPreviewPetugasJawatankuasaPentadbir(
    petugas || {
      pangkat: rekod.pangkat,
      no_badan: rekod.no_badan,
      nama: rekod.nama,
      telefon: rekod.telefon
    }
  );
}


function tutupModalJawatankuasaPentadbir() {
  const modal =
    el("modalJawatankuasaPentadbir");

  if (modal) {
    modal.classList.remove("open");
    modal.hidden = true;
  }

  kosongkanBorangJawatankuasaPentadbir();
}


async function simpanJawatankuasaPentadbir() {
  const btn =
    el("btnSimpanJawatankuasaPentadbir");

  const id =
    teks(
      el("idJawatankuasaPentadbir")?.value
    );

  const tarikh =
    teks(
      el("tarikhJawatankuasaPentadbir")?.value
    );

  const petugas =
    petugasPilihanJawatankuasaPentadbir();

  const jawatankuasa =
    atas(
      el("namaJawatankuasaPentadbir")?.value
    );

  const unit =
    atas(
      el("unitJawatankuasaPentadbir")?.value
    );

  const tugas =
    atas(
      el("tugasJawatankuasaPentadbir")?.value
    );

  if (
    !tarikh ||
    !petugas ||
    !jawatankuasa ||
    !unit ||
    !tugas
  ) {
    paparMesej(
      "statusModalJawatankuasaPentadbir",
      "Lengkapkan Tarikh, Petugas, Jawatankuasa, Unit dan Tugas.",
      "error"
    );
    return;
  }

  const payload = {
    tarikh,
    petugas_id: petugas.id,
    jawatankuasa,
    unit,
    tugas,
    pangkat: atas(petugas.pangkat),
    no_badan: atas(petugas.no_badan),
    nama: atas(petugas.nama),
    telefon:
      teks(
        petugas.telefon ||
        petugas.no_telefon
      ),
    dikemaskini_oleh:
      adminLogin?.id || null
  };

  btn.disabled = true;
  btn.textContent =
    id
      ? "SEDANG MENGEMAS KINI..."
      : "SEDANG MENYIMPAN...";

  try {
    let hasil;

    if (id) {
      hasil =
        await denganHadMasa(
          db.from("jawatankuasa_operasi")
            .update(payload)
            .eq("id", id)
            .select()
            .single()
        );
    } else {
      const rekodKumpulan =
        dataJawatankuasaOperasiPentadbir.filter(
          item => atas(item.jawatankuasa) === jawatankuasa
        );

      const susunanSeterusnya =
        rekodKumpulan.reduce((maksimum, item) => {
          const nilai = Number(item.susunan);
          return Number.isFinite(nilai) && nilai > maksimum
            ? nilai
            : maksimum;
        }, 0) + 1;

      hasil =
        await denganHadMasa(
          db.from("jawatankuasa_operasi")
            .insert({
              ...payload,
              susunan: susunanSeterusnya,
              dicipta_oleh:
                adminLogin?.id || null
            })
            .select()
            .single()
        );
    }

    if (hasil.error) {
      throw hasil.error;
    }

    const tarikhCarta =
      el("tarikhCartaPentadbir");

    if (tarikhCarta) {
      tarikhCarta.value =
        tarikh;
    }

    paparMesej(
      "statusModalJawatankuasaPentadbir",
      id
        ? "Rekod jawatankuasa berjaya dikemas kini."
        : "Rekod jawatankuasa berjaya ditambah.",
      "success"
    );

    await muatJawatankuasaOperasiPentadbir(
      tarikh,
      false
    );

    setTimeout(
      () =>
        tutupModalJawatankuasaPentadbir(),
      450
    );

  } catch (error) {
    console.error(
      "Simpan jawatankuasa gagal:",
      error
    );

    const mesej =
      ralatJadualJawatankuasaBelumWujud(error)
        ? "Jadual jawatankuasa_operasi belum diwujudkan. Jalankan SQL yang disediakan dahulu."
        : error.message;

    paparMesej(
      "statusModalJawatankuasaPentadbir",
      `Gagal menyimpan: ${escapeHtml(mesej || "Ralat tidak diketahui.")}`,
      "error"
    );

  } finally {
    btn.disabled = false;
    btn.textContent =
      "SIMPAN JAWATANKUASA";
  }
}


async function ubahSusunanJawatankuasaPentadbir(id, arah) {
  const rekod = dataJawatankuasaOperasiPentadbir.find(
    item => teks(item.id) === teks(id)
  );

  if (!rekod) return;

  const kumpulan = dataJawatankuasaPentadbir().filter(
    item => atas(item.jawatankuasa) === atas(rekod.jawatankuasa)
  );

  const indeks = kumpulan.findIndex(
    item => teks(item.id) === teks(id)
  );

  if (indeks < 0) return;

  const indeksSasaran =
    atas(arah) === "NAIK"
      ? indeks - 1
      : indeks + 1;

  if (
    indeksSasaran < 0 ||
    indeksSasaran >= kumpulan.length
  ) {
    return;
  }

  const sasaran = kumpulan[indeksSasaran];

  /*
    Normalisasikan susunan kumpulan dahulu supaya rekod lama yang
    susunan=NULL juga boleh terus menggunakan butang NAIK/TURUN.
  */
  const normal = kumpulan.map((item, index) => ({
    ...item,
    susunanNormal: index + 1
  }));

  const rekodNormal = normal.find(
    item => teks(item.id) === teks(rekod.id)
  );
  const sasaranNormal = normal.find(
    item => teks(item.id) === teks(sasaran.id)
  );

  if (!rekodNormal || !sasaranNormal) return;

  try {
    paparMesej(
      "statusJawatankuasaPentadbir",
      "Sedang mengubah susunan jawatankuasa...",
      "warning"
    );

    /*
      Simpan nombor unik sementara untuk mengelakkan konflik jika
      kolum susunan mempunyai unique constraint.
    */
    const sementara = 1000000 + Date.now() % 100000;

    const langkah1 = await denganHadMasa(
      db.from("jawatankuasa_operasi")
        .update({ susunan: sementara })
        .eq("id", rekod.id)
    );
    if (langkah1.error) throw langkah1.error;

    const langkah2 = await denganHadMasa(
      db.from("jawatankuasa_operasi")
        .update({ susunan: rekodNormal.susunanNormal })
        .eq("id", sasaran.id)
    );
    if (langkah2.error) throw langkah2.error;

    const langkah3 = await denganHadMasa(
      db.from("jawatankuasa_operasi")
        .update({ susunan: sasaranNormal.susunanNormal })
        .eq("id", rekod.id)
    );
    if (langkah3.error) throw langkah3.error;

    /*
      Rekod lain dalam kumpulan turut dinormalisasikan 1,2,3...
      supaya paparan ADMIN dan SUBTEK sentiasa konsisten.
    */
    for (const item of normal) {
      if (
        teks(item.id) === teks(rekod.id) ||
        teks(item.id) === teks(sasaran.id)
      ) continue;

      if (Number(item.susunan) !== item.susunanNormal) {
        const kemasKini = await denganHadMasa(
          db.from("jawatankuasa_operasi")
            .update({ susunan: item.susunanNormal })
            .eq("id", item.id)
        );
        if (kemasKini.error) throw kemasKini.error;
      }
    }

    await muatJawatankuasaOperasiPentadbir(
      rekod.tarikh,
      false
    );

    paparMesej(
      "statusJawatankuasaPentadbir",
      "Susunan jawatankuasa berjaya dikemas kini.",
      "success"
    );

  } catch (error) {
    console.error("Ubah susunan jawatankuasa gagal:", error);

    paparMesej(
      "statusJawatankuasaPentadbir",
      `Gagal mengubah susunan: ${escapeHtml(error.message || "Ralat tidak diketahui.")}`,
      "error"
    );

    await muatJawatankuasaOperasiPentadbir(
      rekod.tarikh,
      false
    ).catch(() => {});
  }
}


async function padamJawatankuasaPentadbir(id) {
  const rekod =
    dataJawatankuasaOperasiPentadbir.find(
      item =>
        teks(item.id) === teks(id)
    );

  if (!rekod) return;

  if (
    !confirm(
      `Padam ${rekod.pangkat || ""} ${rekod.nama || ""} daripada ${rekod.jawatankuasa || "jawatankuasa"}?`
    )
  ) {
    return;
  }

  try {
    const { error } =
      await denganHadMasa(
        db.from("jawatankuasa_operasi")
          .delete()
          .eq("id", id)
      );

    if (error) throw error;

    await muatJawatankuasaOperasiPentadbir(
      rekod.tarikh,
      false
    );

    paparMesej(
      "statusJawatankuasaPentadbir",
      "Rekod jawatankuasa berjaya dipadam.",
      "success"
    );

  } catch (error) {
    console.error(
      "Padam jawatankuasa gagal:",
      error
    );

    paparMesej(
      "statusJawatankuasaPentadbir",
      `Gagal memadam rekod: ${escapeHtml(error.message)}`,
      "error"
    );
  }
}


function paparCartaJawatankuasaPentadbir() {
  const tbody =
    el("tbodyJawatankuasaPentadbir");

  if (!tbody) return;

  if (cartaJawatankuasaPentadbir) {
    kemusnahkanCartaPentadbir(
      cartaJawatankuasaPentadbir
    );

    cartaJawatankuasaPentadbir = null;
  }

  const senarai =
    dataJawatankuasaPentadbir();

  const tarikh =
    el("tarikhCartaPentadbir")?.value ||
    el("tarikh")?.value ||
    "";
if (!senarai.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-row">
          Tiada rekod jawatankuasa untuk tarikh ini.
        </td>
      </tr>
    `;
    return;
  }

  let kumpulanSemasa = "";
  let bil = 0;
  const baris = [];

  senarai.forEach(item => {
    const kumpulan =
      atas(item.jawatankuasa) ||
      "LAIN-LAIN";

    if (
      kumpulan !==
      kumpulanSemasa
    ) {
      kumpulanSemasa =
        kumpulan;

      baris.push(`
        <tr class="admin-committee-group-row">
          <td colspan="5">
            ${escapeHtml(kumpulan)}
          </td>
        </tr>
      `);
    }

    bil += 1;

    baris.push(`
      <tr>
        <td class="col-bil">
          ${bil}
        </td>

        <td class="col-nama">
          ${escapeHtml(
            teksPangkatNoNamaJawatankuasaPentadbir(
              item
            )
          )}
        </td>

        <td class="col-unit">
          ${escapeHtml(
            item.unit || "-"
          )}
        </td>

        <td class="col-tugas">
          <div class="admin-committee-task-text">
            ${escapeHtml(
              item.tugas || "-"
            )}
          </div>

          <div class="admin-committee-row-actions">
            <button
              class="admin-committee-edit-button"
              type="button"
              title="Naikkan kedudukan"
              onclick="ubahSusunanJawatankuasaPentadbir('${escapeHtml(item.id)}', 'NAIK')"
            >
              ↑ NAIK
            </button>

            <button
              class="admin-committee-edit-button"
              type="button"
              title="Turunkan kedudukan"
              onclick="ubahSusunanJawatankuasaPentadbir('${escapeHtml(item.id)}', 'TURUN')"
            >
              ↓ TURUN
            </button>

            <button
              class="admin-committee-edit-button"
              type="button"
              onclick="bukaEditJawatankuasaPentadbir('${escapeHtml(item.id)}')"
            >
              EDIT
            </button>

            <button
              class="admin-committee-delete-button"
              type="button"
              onclick="padamJawatankuasaPentadbir('${escapeHtml(item.id)}')"
            >
              PADAM
            </button>
          </div>
        </td>

        <td class="col-telefon">
          ${escapeHtml(
            item.telefon || "-"
          )}
        </td>
      </tr>
    `);
  });

  tbody.innerHTML =
    baris.join("");
}


function pilihanCartaPentadbir(
  tajukPakis = ""
) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: "index"
    },
    plugins: {
      legend: {
        labels: {
          color: "#eeeeee"
        }
      },
      tooltip: {
        enabled: true
      }
    },
    scales: {
      x: {
        ticks: {
          color: "#c8c8c8"
        },
        grid: {
          color: "rgba(255,255,255,.06)"
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: "#c8c8c8",
          precision: 0
        },
        grid: {
          color: "rgba(255,255,255,.06)"
        },
        title: {
          display: Boolean(tajukPakis),
          text: tajukPakis,
          color: "#c8c8c8"
        }
      }
    }
  };
}


function tukarPaparanCartaPentadbir(
  pilihan
) {
  const nilai =
    atas(pilihan || "SEMUA");

  document
    .querySelectorAll(
      "#modulCartaPentadbir [data-chart-section]"
    )
    .forEach(section => {
      const kategori =
        atas(
          section.getAttribute(
            "data-chart-section"
          )
        );

      section.hidden =
        nilai !== "SEMUA" &&
        kategori !== nilai;
    });
}


/* ================================================================
   LAPORAN KESELURUHAN HARIAN — INTERAKTIF + CETAK + PDF
   Carta asal DIPINDAHKAN (bukan clone) supaya semua event Chart.js,
   klik label, senarai lokasi dan kawalan interaktif kekal berfungsi.
================================================================ */

let indukCartaAsalLaporanHarian = null;
let penandaCartaAsalLaporanHarian = null;
let laporanHarianSudahDijana = false;

function pulihkanCartaDaripadaLaporanHarian() {
  const grid = document.querySelector("#kandunganLaporanKeseluruhanHarian .admin-chart-grid");
  if (grid) grid.classList.remove("laporan-keseluruhan-aktif");
  if (grid && penandaCartaAsalLaporanHarian?.parentNode) {
    penandaCartaAsalLaporanHarian.parentNode.insertBefore(grid, penandaCartaAsalLaporanHarian);
  } else if (grid && indukCartaAsalLaporanHarian) {
    indukCartaAsalLaporanHarian.appendChild(grid);
  }
}

function bukaLaporanKeseluruhanHarian() {
  tutupSemuaModulPentadbir();
  const modul = el("modulLaporanKeseluruhanHarian");
  if (!modul) return alert("Modul LAPORAN KESELURUHAN HARIAN tidak ditemui dalam admin.html.");
  modul.hidden = false;
  modul.removeAttribute("hidden");
  modul.style.removeProperty("display");
  el("btnBukaLaporanKeseluruhanHarian")?.setAttribute("aria-expanded", "true");
  const input = el("tarikhLaporanKeseluruhanHarian");
  if (input && !input.value) input.value = el("tarikhCartaPentadbir")?.value || el("tarikh")?.value || hariIniMalaysia();
  setTimeout(() => modul.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
}

function tutupLaporanKeseluruhanHarian() {
  pulihkanCartaDaripadaLaporanHarian();
  const modul = el("modulLaporanKeseluruhanHarian");
  if (!modul) return;
  modul.hidden = true;
  modul.setAttribute("hidden", "");
  modul.style.display = "none";
  el("btnBukaLaporanKeseluruhanHarian")?.setAttribute("aria-expanded", "false");
}

function statistikPengunjungLaporanHarian() {
  const senarai = senaraiPengunjungCartaPentadbir();
  let semasa = 0;
  let tertinggi = 0;

  senarai.forEach(item => {
    semasa += nilaiJumlahPengunjungPentadbir(item);
    tertinggi = Math.max(tertinggi, semasa);
  });

  return {
    keseluruhan: Math.max(0, tertinggi),
    terkini: Math.max(0, semasa)
  };
}

function statistikKenderaanLaporanHarian() {
  const senarai = senaraiKenderaanCartaPentadbir();
  let bas = 0;
  let motokar = 0;
  let motosikal = 0;
  let tertinggi = 0;

  senarai.forEach(item => {
    bas += nilaiKenderaanDaripadaLaporanPentadbir(item, "BAS");
    motokar += nilaiKenderaanDaripadaLaporanPentadbir(item, "MOTOKAR");
    motosikal += nilaiKenderaanDaripadaLaporanPentadbir(item, "MOTOSIKAL");

    const jumlahSemasa = bas + motokar + motosikal;
    tertinggi = Math.max(tertinggi, jumlahSemasa);
  });

  return {
    keseluruhan: Math.max(0, tertinggi),
    terkini: Math.max(0, bas + motokar + motosikal)
  };
}

function binaRingkasanLaporanHarian() {
  const pengunjung = statistikPengunjungLaporanHarian();
  const kenderaan = statistikKenderaanLaporanHarian();
  const vvip = kumpulanVvipVipCarta();
  const insiden = kiraInsidenCarta();

  const item = [
    ["JUMLAH PENGUNJUNG KESELURUHAN", pengunjung.keseluruhan],
    ["JUMLAH PENGUNJUNG TERKINI", pengunjung.terkini],
    ["JUMLAH KENDERAAN PENGUNJUNG KESELURUHAN", kenderaan.keseluruhan],
    ["JUMLAH KENDERAAN PENGUNJUNG TERKINI", kenderaan.terkini],
    ["VVIP / VIP", vvip.length],
    ["TANGKAPAN", insiden.tangkapan],
    ["RAMPASAN", insiden.rampasan],
    ["KEMALANGAN", insiden.kemalangan]
  ];

  return `<div class="admin-chart-summary-grid laporan-harian-summary">${item.map(([label,nilai]) => `
    <article class="admin-chart-summary-card"><span>${escapeHtml(label)}</span><strong>${Number(nilai || 0).toLocaleString("ms-MY")}</strong></article>`).join("")}</div>`;
}

function tapisLaporanKeseluruhanHarian(nilai = "SEMUA") {
  const kandungan = el("kandunganLaporanKeseluruhanHarian");
  if (!kandungan) return;
  const pilihan = atas(nilai) || "SEMUA";
  kandungan.querySelectorAll("[data-chart-section]").forEach(section => {
    const kategori = atas(section.dataset.chartSection);
    const papar = pilihan === "SEMUA" || kategori === pilihan;
    section.hidden = !papar;
    section.style.display = papar ? "" : "none";
  });
}

async function janaLaporanKeseluruhanHarian() {
  if (!adminLogin) return;
  const tarikh = el("tarikhLaporanKeseluruhanHarian")?.value || hariIniMalaysia();
  const kandungan = el("kandunganLaporanKeseluruhanHarian");
  const btnCetak = el("btnCetakLaporanKeseluruhanHarian");
  const btnPdf = el("btnPdfLaporanKeseluruhanHarian");
  if (!kandungan) return;
  if (btnCetak) btnCetak.disabled = true;
  if (btnPdf) btnPdf.disabled = true;
  paparMesej("statusLaporanKeseluruhanHarian", "Sedang memuatkan laporan interaktif...", "warning");

  try {
    pulihkanCartaDaripadaLaporanHarian();
    if (el("tarikhCartaPentadbir")) el("tarikhCartaPentadbir").value = tarikh;
    await muatDataCartaPentadbir();

    const gridAsal = document.querySelector("#modulCartaPentadbir .admin-chart-grid");
    if (!gridAsal) throw new Error("Kandungan Carta Operasi tidak ditemui.");

    if (!penandaCartaAsalLaporanHarian || !penandaCartaAsalLaporanHarian.isConnected) {
      indukCartaAsalLaporanHarian = gridAsal.parentNode;
      penandaCartaAsalLaporanHarian = document.createComment("SKPO: kedudukan asal admin-chart-grid");
      gridAsal.parentNode.insertBefore(penandaCartaAsalLaporanHarian, gridAsal);
    }

    kandungan.innerHTML = `
      <div class="laporan-harian-kepala" style="text-align:center;margin-bottom:16px;">
        <h2 style="margin:0;">OP LITAR</h2>
        <h3 style="margin:6px 0;">LAPORAN KESELURUHAN HARIAN</h3>
        <div class="muted">TARIKH: ${escapeHtml(formatTarikhMalaysia(tarikh))}</div>
      </div>
      ${binaRingkasanLaporanHarian()}
      <div id="hosCartaLaporanHarian" style="margin-top:18px;"></div>`;

    gridAsal.classList.add("laporan-keseluruhan-aktif");
    el("hosCartaLaporanHarian").appendChild(gridAsal);
    laporanHarianSudahDijana = true;
    tapisLaporanKeseluruhanHarian(el("paparanLaporanKeseluruhanHarian")?.value || "SEMUA");
    if (btnCetak) btnCetak.disabled = false;
    if (btnPdf) btnPdf.disabled = false;
    paparMesej("statusLaporanKeseluruhanHarian", `Laporan interaktif ${escapeHtml(formatTarikhMalaysia(tarikh))} sedia. Carta kekal interaktif dan butiran individu Pengunjung/Kenderaan disembunyikan dalam laporan keseluruhan.`, "success");
  } catch (error) {
    console.error("Jana laporan keseluruhan harian gagal:", error);
    laporanHarianSudahDijana = false;
    kandungan.innerHTML = `<div class="empty-row">Laporan gagal dijana.</div>`;
    paparMesej("statusLaporanKeseluruhanHarian", `Ralat menjana laporan: ${escapeHtml(error?.message || "Ralat tidak diketahui.")}`, "error");
  }
}

function salinanStatikLaporanHarianUntukEksport() {
  const asal = el("kandunganLaporanKeseluruhanHarian");
  if (!asal || !laporanHarianSudahDijana) return null;
  const clone = asal.cloneNode(true);

  /* Tukar canvas kepada imej tanpa menukar rupa/warna carta. */
  const asalCanvas = [...asal.querySelectorAll("canvas")];
  const cloneCanvas = [...clone.querySelectorAll("canvas")];
  asalCanvas.forEach((canvas, index) => {
    const sasaran = cloneCanvas[index];
    if (!sasaran) return;
    try {
      const img = document.createElement("img");
      img.src = canvas.toDataURL("image/png", 1);
      img.alt = canvas.getAttribute("aria-label") || "Carta operasi";
      const rect = canvas.getBoundingClientRect();
      img.style.cssText = `display:block;width:${Math.max(1, Math.round(rect.width))}px;max-width:100%;height:auto;object-fit:contain;`;
      sasaran.replaceWith(img);
    } catch (e) {
      console.warn("Carta gagal ditukar untuk eksport:", e);
    }
  });

  /* Elemen kawalan tidak perlu dalam Cetak/PDF. */
  clone.querySelectorAll("button,select,input,textarea,.admin-chart-print-button,.admin-vehicle-hint,.admin-attendance-hint,.admin-incident-hint,.admin-map-controls,.admin-map-marker-controls,.status-box").forEach(n => n.remove());

  /* Kekalkan formula laporan keseluruhan: KESELURUHAN = nilai peak graf. */
  const statPengunjungEksport = statistikPengunjungLaporanHarian();
  const statKenderaanEksport = statistikKenderaanLaporanHarian();
  const jumlahLokasiPengunjung = clone.querySelector("#jumlahKeseluruhanPengunjungLokasiPentadbir");
  const jumlahLokasiKenderaan = clone.querySelector("#jumlahKeseluruhanKenderaanLokasiPentadbir");
  if (jumlahLokasiPengunjung) jumlahLokasiPengunjung.textContent = Number(statPengunjungEksport.keseluruhan || 0).toLocaleString("ms-MY");
  if (jumlahLokasiKenderaan) jumlahLokasiKenderaan.textContent = Number(statKenderaanEksport.keseluruhan || 0).toLocaleString("ms-MY");

  /* Khusus Laporan Keseluruhan: panel-panel ini memang tidak dipaparkan. */
  clone.querySelectorAll(
    ".admin-visitor-detail-panel,.admin-vehicle-detail-panel," +
    ".admin-attendance-list-panel,.admin-map-location-panel," +
    ".admin-vvip-detail-panel,.admin-incident-detail-panel"
  ).forEach(n => n.remove());

  clone.querySelectorAll("[data-chart-section]").forEach(n => {
    n.hidden = false;
    n.removeAttribute("hidden");
    n.style.display = "";
  });

  /* Selepas panel kanan dibuang, bahagian utama menggunakan ruang laporan yang tersedia.
     Warna, font, border dan tema TIDAK diubah — semuanya ikut paparan dalam sistem. */
  clone.querySelectorAll(
    ".admin-visitor-layout,.admin-vehicle-layout,.admin-attendance-layout," +
    ".admin-operation-map-layout,.admin-vvip-layout,.admin-incident-layout"
  ).forEach(n => n.style.setProperty("display", "block", "important"));

  clone.querySelectorAll(
    ".admin-visitor-chart-panel,.admin-vehicle-chart-panel,.admin-attendance-chart-panel," +
    ".admin-operation-map-stage,.admin-vvip-list-panel,.admin-incident-chart-panel"
  ).forEach(n => {
    n.style.setProperty("width", "100%", "important");
    n.style.setProperty("max-width", "none", "important");
  });

  return clone;
}

function cetakLaporanKeseluruhanHarian() {
  const clone = salinanStatikLaporanHarianUntukEksport();
  if (!clone) return alert("Sila jana laporan terlebih dahulu.");

  const tarikh = el("tarikhLaporanKeseluruhanHarian")?.value || hariIniMalaysia();
  const cssLinks = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .map(link => `<link rel="stylesheet" href="${escapeHtml(new URL(link.getAttribute("href"), document.baseURI).href)}">`)
    .join("\n");

  /* FIX 007 — susunan khas CETAK sahaja.
     1) Peta: JENIS TUGAS + gambar peta dalam SATU halaman.
     2) Pengunjung: Trend satu halaman, Pecahan Lokasi satu halaman.
     3) Kenderaan: Trend satu halaman, Pecahan Lokasi satu halaman.
     MUAT TURUN PDF tidak disentuh. */
  function pecahKadDuaHalaman(selectorKad, selectorBlok, kelasTambahan) {
    const kad = clone.querySelector(selectorKad);
    if (!kad) return;
    const blok = [...kad.querySelectorAll(selectorBlok)];
    if (blok.length < 2) return;

    const halamanTrend = kad.cloneNode(true);
    const halamanLokasi = kad.cloneNode(true);

    [...halamanTrend.querySelectorAll(selectorBlok)].forEach((n, i) => {
      if (i !== 0) n.remove();
    });
    [...halamanLokasi.querySelectorAll(selectorBlok)].forEach((n, i) => {
      if (i !== 1) n.remove();
    });

    halamanTrend.classList.add("print-split-page", `${kelasTambahan}-trend-page`);
    halamanLokasi.classList.add("print-split-page", `${kelasTambahan}-location-page`);

    /* Pada halaman kedua, kekalkan tajuk kad tetapi ubah keterangan supaya jelas. */
    const pTrend = halamanTrend.querySelector(".admin-chart-card-heading .muted");
    const pLokasi = halamanLokasi.querySelector(".admin-chart-card-heading .muted");
    if (pTrend) pTrend.textContent = "TREND OPERASI — JUMLAH TERKUMPUL MENGIKUT MASA";
    if (pLokasi) pLokasi.textContent = "PECAHAN LOKASI";

    kad.replaceWith(halamanTrend, halamanLokasi);
  }

  pecahKadDuaHalaman(
    ".admin-visitor-chart-card",
    ".admin-visitor-chart-block",
    "visitor"
  );
  pecahKadDuaHalaman(
    ".admin-vehicle-chart-card",
    ".admin-vehicle-chart-block",
    "vehicle"
  );

  const bgBody = getComputedStyle(document.body).backgroundColor || "#111";
  const w = window.open("", "_blank", "width=1500,height=950");
  if (!w) return alert("Pelayar menghalang tetingkap cetak. Benarkan pop-up dan cuba semula.");

  w.document.open();
  w.document.write(`<!DOCTYPE html><html lang="ms"><head>
    <meta charset="UTF-8">
    <title>Laporan Keseluruhan Harian ${escapeHtml(formatTarikhMalaysia(tarikh))}</title>
    ${cssLinks}
    <style>
      @page{size:A4 landscape;margin:7mm}
      html,body{
        margin:0!important;padding:0!important;background:${escapeHtml(bgBody)}!important;
        -webkit-print-color-adjust:exact!important;print-color-adjust:exact!important
      }
      #kandunganCetak{width:100%!important;max-width:none!important;margin:0!important}
      #kandunganCetak *{box-sizing:border-box!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
      #kandunganCetak img{max-width:100%!important;height:auto!important;object-fit:contain!important}

      /* Tajuk halaman pertama putih. */
      #kandunganCetak .laporan-harian-kepala h2,
      #kandunganCetak .laporan-harian-kepala h3{color:#fff!important}

      /* Semua kad utama tidak boleh terpotong di tengah. */
      #kandunganCetak .admin-chart-card,
      #kandunganCetak .print-split-page{
        break-inside:avoid-page!important;
        page-break-inside:avoid!important;
      }

      /* PETA: filter Jenis Tugas + peta mesti muat bersama dalam satu halaman. */
      #kandunganCetak .admin-operation-map-card{
        height:190mm!important;
        max-height:190mm!important;
        overflow:hidden!important;
      }
      #kandunganCetak .admin-operation-map-card .section-heading{margin-bottom:3mm!important}
      #kandunganCetak .admin-operation-map-card .admin-map-task-filter{
        margin:0 0 3mm 0!important;
        min-height:13mm!important;
      }
      #kandunganCetak .admin-operation-map-card .admin-operation-map-layout,
      #kandunganCetak .admin-operation-map-card .admin-operation-map-stage{
        display:block!important;width:100%!important;max-width:none!important;
        height:145mm!important;max-height:145mm!important;overflow:hidden!important;
      }
      #kandunganCetak .admin-operation-map-card .admin-operation-map-viewport,
      #kandunganCetak .admin-operation-map-card .admin-operation-map-canvas{
        width:100%!important;height:139mm!important;max-height:139mm!important;
        overflow:hidden!important;display:flex!important;align-items:center!important;justify-content:center!important;
        transform:none!important;
      }
      #kandunganCetak .admin-operation-map-card .admin-operation-map-image{
        display:block!important;width:auto!important;height:auto!important;
        max-width:100%!important;max-height:137mm!important;object-fit:contain!important;
        position:static!important;transform:none!important;margin:0 auto!important;
      }
      #kandunganCetak .admin-operation-map-card .admin-map-marker-layer,
      #kandunganCetak .admin-operation-map-card .admin-map-footer{display:none!important}

      /* Halaman Trend/Pecahan: satu blok menggunakan seluruh ruang halaman. */
      #kandunganCetak .print-split-page{
        height:190mm!important;max-height:190mm!important;overflow:hidden!important;
      }
      #kandunganCetak .print-split-page .admin-visitor-layout,
      #kandunganCetak .print-split-page .admin-vehicle-layout,
      #kandunganCetak .print-split-page .admin-visitor-chart-panel,
      #kandunganCetak .print-split-page .admin-vehicle-chart-panel{
        display:block!important;width:100%!important;max-width:none!important;height:auto!important;
      }
      #kandunganCetak .print-split-page .admin-visitor-chart-block,
      #kandunganCetak .print-split-page .admin-vehicle-chart-block{
        width:100%!important;max-width:none!important;height:155mm!important;max-height:155mm!important;
        overflow:hidden!important;
      }
      #kandunganCetak .print-split-page .admin-chart-canvas-wrap{
        width:100%!important;height:132mm!important;max-height:132mm!important;
        display:flex!important;align-items:center!important;justify-content:center!important;overflow:hidden!important;
      }
      #kandunganCetak .print-split-page .admin-chart-canvas-wrap img{
        width:auto!important;height:auto!important;max-width:100%!important;max-height:130mm!important;
        object-fit:contain!important;margin:auto!important;
      }
      #kandunganCetak .print-split-page .admin-visitor-location-total,
      #kandunganCetak .print-split-page .admin-vehicle-location-total,
      #kandunganCetak .print-split-page .admin-visitor-location-hint,
      #kandunganCetak .print-split-page .admin-vehicle-location-hint{display:none!important}

      @media print{
        #kandunganCetak .admin-chart-card,
        #kandunganCetak .print-split-page{
          break-before:page!important;page-break-before:always!important;
          break-inside:avoid-page!important;page-break-inside:avoid!important;
          width:100%!important;
        }
        #kandunganCetak .admin-chart-card:first-of-type{
          break-before:auto!important;page-break-before:auto!important;
        }
      }
    </style>
  </head><body>
    <main id="kandunganCetak">${clone.innerHTML}</main>
    <script>
      window.addEventListener("load",function(){
        const imgs=[...document.images];
        Promise.all(imgs.map(i=>i.complete?Promise.resolve():new Promise(r=>{i.onload=r;i.onerror=r;})))
          .then(()=>setTimeout(function(){window.focus();window.print();},900));
      });
    <\/script>
  </body></html>`);
  w.document.close();
}

async function muatTurunPdfLaporanKeseluruhanHarian() {
  const asal = el("kandunganLaporanKeseluruhanHarian");
  if (!asal || !laporanHarianSudahDijana) return alert("Sila jana laporan terlebih dahulu.");
  if (!window.html2canvas || !window.jspdf?.jsPDF) return alert("Modul PDF belum dimuatkan. Pastikan internet tersedia dan muat semula halaman.");
  const btn=el("btnPdfLaporanKeseluruhanHarian"), tarikh=el("tarikhLaporanKeseluruhanHarian")?.value||hariIniMalaysia(), statusId="statusLaporanKeseluruhanHarian";
  let host=null;
  try {
    if(btn){btn.disabled=true;btn.textContent="SEDANG MENJANA PDF...";} paparMesej(statusId,"Sedang menjana PDF tanpa memotong carta...","warning");
    const clone=salinanStatikLaporanHarianUntukEksport(); if(!clone) throw new Error("Paparan laporan tidak tersedia.");
    host=document.createElement("div"); host.style.cssText=`position:fixed;left:-100000px;top:0;width:${Math.max(1000,Math.round(asal.getBoundingClientRect().width))}px;z-index:-1;background:${getComputedStyle(document.body).backgroundColor||"#0f0f0f"};padding:0;margin:0;`; host.appendChild(clone); document.body.appendChild(host);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const cards=[...clone.querySelectorAll(".admin-chart-card")]; if(!cards.length) throw new Error("Tiada carta ditemui untuk laporan.");
    const {jsPDF}=window.jspdf; const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true}); const pageW=pdf.internal.pageSize.getWidth(),pageH=pdf.internal.pageSize.getHeight(),margin=7,usableW=pageW-margin*2,usableH=pageH-margin*2;
    /* Ringkasan atas pada halaman pertama. */
    const first=cards[0]; const firstTop=first.getBoundingClientRect().top-clone.getBoundingClientRect().top; if(firstTop>10){const introCanvas=await window.html2canvas(clone,{scale:1.35,useCORS:true,backgroundColor:getComputedStyle(document.body).backgroundColor||"#0f0f0f",logging:false,height:Math.ceil(firstTop)}); const sc=Math.min(usableW/introCanvas.width,usableH/introCanvas.height); pdf.addImage(introCanvas.toDataURL("image/jpeg",.96),"JPEG",margin,margin,introCanvas.width*sc,introCanvas.height*sc,undefined,"FAST");}
    for(let i=0;i<cards.length;i++){
      const c=await window.html2canvas(cards[i],{scale:1.35,useCORS:true,allowTaint:false,backgroundColor:getComputedStyle(document.body).backgroundColor||"#0f0f0f",logging:false});
      pdf.addPage("a4","landscape"); const sc=Math.min(usableW/c.width,usableH/c.height),wmm=c.width*sc,hmm=c.height*sc,x=(pageW-wmm)/2,y=(pageH-hmm)/2; pdf.addImage(c.toDataURL("image/jpeg",.96),"JPEG",x,y,wmm,hmm,undefined,"FAST");
    }
    host.remove();host=null; pdf.save(`SKPO_LAPORAN_KESELURUHAN_HARIAN_${tarikh}.pdf`); paparMesej(statusId,`PDF ${escapeHtml(formatTarikhMalaysia(tarikh))} berjaya dijana tanpa memotong carta.`,"success");
  } catch(error){if(host)host.remove();console.error("PDF laporan harian gagal:",error);paparMesej(statusId,`Gagal menjana PDF: ${escapeHtml(error?.message||"Ralat tidak diketahui.")}`,"error");}
  finally{if(btn){btn.disabled=false;btn.textContent="MUAT TURUN PDF";}}
}

/* ================================================================
   PETA LOKASI PENUGASAN
================================================================ */

function tetapanPetaCartaPentadbir() {
  try {
    const data =
      JSON.parse(
        localStorage.getItem(
          KUNCI_TETAPAN_PETA_CARTA_F1
        ) ||
        "{}"
      );

    return {
      imej: URL_PETA_ADMIN_F1,
      marker:
        data.marker &&
        typeof data.marker === "object"
          ? data.marker
          : {}
    };
  } catch (_) {
    return {
      imej: URL_PETA_ADMIN_F1,
      marker: {}
    };
  }
}

function simpanTetapanPetaCartaTempatan(
  data
) {
  localStorage.setItem(
    KUNCI_TETAPAN_PETA_CARTA_F1,
    JSON.stringify(data)
  );
}



function normalisasiJenisTugasMarkerPentadbir(nilai) {
  return atas(nilai).replace(/\s+/g, " ").trim();
}

function jenisTugasMarkerDisokongPentadbir(nilai) {
  const jenis =
    normalisasiJenisTugasMarkerPentadbir(
      nilai
    );

  return Boolean(
    jenis &&
    jenis !== "-"
  );
}


function jenisTugasUnikCartaPentadbir() {
  return [
    ...new Set(
      dataDashboard
        .map(item =>
          normalisasiJenisTugasMarkerPentadbir(
            item.jenisTugas
          )
        )
        .filter(item =>
          item &&
          item !== "-"
        )
    )
  ].sort(
    (a, b) =>
      a.localeCompare(
        b,
        "ms"
      )
  );
}


function binaPilihanJenisTugasPetaPentadbir() {
  const semuaJenis =
    jenisTugasUnikCartaPentadbir();

  const penapis =
    el("penapisJenisTugasPetaPentadbir");

  if (penapis) {
    const nilaiSemasa =
      normalisasiJenisTugasMarkerPentadbir(
        penapis.value ||
        jenisTugasPetaDipilihPentadbir ||
        "SEMUA"
      ) || "SEMUA";

    penapis.innerHTML =
      '<option value="SEMUA">SEMUA JENIS TUGAS</option>' +
      semuaJenis
        .map(item => `
          <option value="${escapeHtml(item)}">
            ${escapeHtml(item)}
          </option>
        `)
        .join("");

    penapis.value =
      (
        nilaiSemasa === "SEMUA" ||
        semuaJenis.includes(nilaiSemasa)
      )
        ? nilaiSemasa
        : "SEMUA";

    jenisTugasPetaDipilihPentadbir =
      penapis.value ||
      "SEMUA";
  }

  const urus =
    el("pilihanJenisTugasMarkerPentadbir");

  if (urus) {
    const nilaiSemasa =
      normalisasiJenisTugasMarkerPentadbir(
        urus.value ||
        jenisTugasMarkerUrusPentadbir
      );

    urus.innerHTML =
      '<option value="">PILIH JENIS TUGAS</option>' +
      semuaJenis
        .map(item => `
          <option value="${escapeHtml(item)}">
            ${escapeHtml(item)}
          </option>
        `)
        .join("");

    if (
      nilaiSemasa &&
      semuaJenis.includes(nilaiSemasa)
    ) {
      urus.value = nilaiSemasa;
      jenisTugasMarkerUrusPentadbir = nilaiSemasa;
    } else {
      urus.value = "";
      jenisTugasMarkerUrusPentadbir = "";
    }
  }
}

function padanJenisTugasMarkerPentadbir(nilaiData, pilihan) {
  const dipilih = normalisasiJenisTugasMarkerPentadbir(pilihan);
  if (!dipilih || dipilih === "SEMUA") return true;
  return normalisasiJenisTugasMarkerPentadbir(nilaiData) === dipilih;
}

function kunciMarkerPetaPentadbir(jenisTugas, lokasi) {
  return `${normalisasiJenisTugasMarkerPentadbir(jenisTugas)}|||${atas(lokasi)}`;
}

function pecahKunciMarkerPetaPentadbir(kunci) {
  const bahagian = teks(kunci).split("|||");
  return { jenisTugas: bahagian[0] || "", lokasi: bahagian.slice(1).join("|||") || "" };
}

function jenisTugasPetaSemasaPentadbir() {
  return normalisasiJenisTugasMarkerPentadbir(
    el("penapisJenisTugasPetaPentadbir")?.value ||
    jenisTugasPetaDipilihPentadbir ||
    "SEMUA"
  ) || "SEMUA";
}

function tukarJenisTugasPetaPentadbir(nilai) {
  jenisTugasPetaDipilihPentadbir = normalisasiJenisTugasMarkerPentadbir(nilai || "SEMUA") || "SEMUA";
  lokasiPetaDipilihPentadbir = "";
  tabPetugasLokasiAktif = "BERTUGAS";
  const kosong = el("panelLokasiPetaPentadbir")?.querySelector(".admin-map-location-empty");
  if (kosong) kosong.style.display = "";
  const kandungan = el("kandunganLokasiPetaPentadbir");
  if (kandungan) { kandungan.hidden = true; kandungan.setAttribute("hidden", ""); }
  paparMarkerPetaPentadbir();
}

function tukarJenisTugasUrusMarkerPentadbir(nilai) {
  jenisTugasMarkerUrusPentadbir = normalisasiJenisTugasMarkerPentadbir(nilai);
  binaPilihanLokasiMarkerPentadbir();
  paparMarkerUrusPetaPentadbir();
  if (el("lokasiMarkerDipilihPentadbir")) el("lokasiMarkerDipilihPentadbir").textContent = "BELUM DIPILIH";
}

function kombinasiMarkerPetaPentadbir(jenisPilihan = jenisTugasPetaSemasaPentadbir()) {
  const pilihan = normalisasiJenisTugasMarkerPentadbir(jenisPilihan || "SEMUA");
  const pasangan = new Map();
  dataDashboard.forEach(item => {
    const jenis = normalisasiJenisTugasMarkerPentadbir(item.jenisTugas);
    const lokasi = teks(item.tempatTugas);
    if (!jenisTugasMarkerDisokongPentadbir(jenis) || !lokasi || lokasi === "-") return;
    if (pilihan !== "SEMUA" && jenis !== pilihan) return;
    const kunci = kunciMarkerPetaPentadbir(jenis,lokasi);
    if (!pasangan.has(kunci)) pasangan.set(kunci,{kunci,jenisTugas:jenis,lokasi});
  });
  return [...pasangan.values()].sort((a,b) => a.jenisTugas.localeCompare(b.jenisTugas,"ms") || a.lokasi.localeCompare(b.lokasi,"ms"));
}

function posisiMarkerJenisLokasiPentadbir(tetapan, jenisTugas, lokasi, index, jumlah) {
  const kunci = kunciMarkerPetaPentadbir(jenisTugas,lokasi);
  return tetapan.marker?.[kunci] || tetapan.marker?.[lokasi] || posisiAutomatikMarker(index,jumlah);
}

function lokasiUnikCartaPentadbir(jenisTugas = "SEMUA") {
  const pilihan = normalisasiJenisTugasMarkerPentadbir(jenisTugas || "SEMUA");
  return [...new Set(dataDashboard
    .filter(item => pilihan === "SEMUA" || padanJenisTugasMarkerPentadbir(item.jenisTugas,pilihan))
    .map(item => teks(item.tempatTugas))
    .filter(item => item && item !== "-"))]
    .sort((a,b) => a.localeCompare(b,"ms"));
}

function posisiAutomatikMarker(
  index,
  jumlah
) {
  const kolum =
    Math.max(
      2,
      Math.ceil(
        Math.sqrt(jumlah || 1)
      )
    );

  const baris =
    Math.max(
      1,
      Math.ceil(
        (jumlah || 1) / kolum
      )
    );

  const xIndex =
    index % kolum;

  const yIndex =
    Math.floor(index / kolum);

  return {
    x:
      ((xIndex + 1) /
      (kolum + 1)) *
      100,

    y:
      ((yIndex + 1) /
      (baris + 1)) *
      100,

    status: "NORMAL"
  };
}



function kemasKiniButangMarkerPetaPentadbir() {
  const butang =
    el("btnToggleMarkerPetaPentadbir");

  if (!butang) return;

  if (markerPetaDipaparkanPentadbir) {
    butang.textContent = "TUTUP MARKER";
    butang.setAttribute("aria-pressed", "true");
    butang.classList.remove("marker-hidden");
  } else {
    butang.textContent = "PAPAR MARKER";
    butang.setAttribute("aria-pressed", "false");
    butang.classList.add("marker-hidden");
  }
}


function setPaparanMarkerPetaPentadbir(papar) {
  markerPetaDipaparkanPentadbir =
    Boolean(papar);

  const lapisan =
    el("lapisanMarkerPetaPentadbir");

  if (lapisan) {
    lapisan.hidden =
      !markerPetaDipaparkanPentadbir;

    lapisan.style.display =
      markerPetaDipaparkanPentadbir
        ? ""
        : "none";
  }

  /*
    Apabila marker ditutup, panel maklumat lokasi juga disembunyikan
    supaya paparan benar-benar hanya gambar peta.
  */
  const panel =
    el("panelLokasiPetaPentadbir");

  if (panel) {
    panel.classList.toggle(
      "marker-panel-hidden",
      !markerPetaDipaparkanPentadbir
    );
  }

  const layout =
    document.querySelector(
      "#kadCartaPeta .admin-operation-map-layout"
    );

  if (layout) {
    layout.classList.toggle(
      "markers-off",
      !markerPetaDipaparkanPentadbir
    );
  }

  kemasKiniButangMarkerPetaPentadbir();
}


function toggleMarkerPetaPentadbir() {
  setPaparanMarkerPetaPentadbir(
    !markerPetaDipaparkanPentadbir
  );
}


function muatPetaCartaPentadbir() {
  const imej = el("imejPetaCartaPentadbir");
  if (imej) imej.src = URL_PETA_ADMIN_F1;
  const imejUrus = el("imejUrusPetaPentadbir");
  if (imejUrus) { imejUrus.src = URL_PETA_ADMIN_F1; delete imejUrus.dataset.imejBaharu; }

  /*
    Senarai Jenis Tugas marker dijana automatik daripada
    semua Jenis Tugas yang wujud dalam dataDashboard.
  */
  binaPilihanJenisTugasPetaPentadbir();

  binaPilihanLokasiMarkerPentadbir();
  paparMarkerPetaPentadbir();
  paparMarkerUrusPetaPentadbir();
  pasangZoomPetaPentadbir();
  setPaparanMarkerPetaPentadbir(markerPetaDipaparkanPentadbir);
}

function dataPetugasLokasiPentadbir(lokasi, jenisTugas = jenisTugasPetaSemasaPentadbir()) {
  const namaLokasi = atas(lokasi);
  const tugas = normalisasiJenisTugasMarkerPentadbir(jenisTugas || "SEMUA");
  return dataDashboard.filter(item =>
    atas(item.tempatTugas) === namaLokasi &&
    (tugas === "SEMUA" || padanJenisTugasMarkerPentadbir(item.jenisTugas,tugas))
  );
}

function statusPetugasLokasiPentadbir(
  item
) {
  if (item.checkout) {
    return "SELESAI";
  }

  if (
    item.statusKehadiran === "HADIR"
  ) {
    return "BERTUGAS";
  }

  return "BELUM_HADIR";
}


function paparMarkerPetaPentadbir() {
  const lapisan = el("lapisanMarkerPetaPentadbir");
  if (!lapisan) return;
  const jenisDipilih = jenisTugasPetaSemasaPentadbir();
  const kombinasi = kombinasiMarkerPetaPentadbir(jenisDipilih);
  const tetapan = tetapanPetaCartaPentadbir();

  lapisan.innerHTML = kombinasi.map((item,index) => {
    const posisi = posisiMarkerJenisLokasiPentadbir(tetapan,item.jenisTugas,item.lokasi,index,kombinasi.length);
    const petugas = dataPetugasLokasiPentadbir(item.lokasi,item.jenisTugas);
    const bertugas = petugas.filter(p => statusPetugasLokasiPentadbir(p) === "BERTUGAS").length;
    const status = atas(posisi.status || "NORMAL");
    const lokasiJs = item.lokasi.replace(/\\/g,"\\\\").replace(/'/g,"\\'");
    const jenisJs = item.jenisTugas.replace(/\\/g,"\\\\").replace(/'/g,"\\'");
    return `
      <button class="admin-map-marker admin-map-marker-${escapeHtml(status.toLowerCase())}" type="button"
        style="left:${Number(posisi.x).toFixed(3)}%;top:${Number(posisi.y).toFixed(3)}%;"
        onclick="pilihMarkerLokasiPentadbir('${lokasiJs}','${jenisJs}')"
        title="${escapeHtml(item.jenisTugas)} — ${escapeHtml(item.lokasi)}">
        <span class="admin-map-marker-count">${bertugas}/${petugas.length}</span>
        <span class="admin-map-marker-label">${escapeHtml(item.lokasi)}</span>
        ${jenisDipilih === "SEMUA" ? `<span class="admin-map-marker-task">${escapeHtml(item.jenisTugas)}</span>` : ""}
      </button>`;
  }).join("");
}

function pilihMarkerLokasiPentadbir(lokasi, jenisTugas) {
  lokasiPetaDipilihPentadbir = lokasi;
  jenisTugasPetaDipilihPentadbir = normalisasiJenisTugasMarkerPentadbir(jenisTugas || jenisTugasPetaSemasaPentadbir());
  tabPetugasLokasiAktif = "BERTUGAS";
  const kosong = el("panelLokasiPetaPentadbir")?.querySelector(".admin-map-location-empty");
  if (kosong) kosong.style.display = "none";
  const kandungan = el("kandunganLokasiPetaPentadbir");
  if (kandungan) { kandungan.hidden = false; kandungan.removeAttribute("hidden"); }
  paparPanelLokasiPentadbir();
}

function paparPanelLokasiPentadbir() {
  if (!lokasiPetaDipilihPentadbir) return;
  const jenisTugas = normalisasiJenisTugasMarkerPentadbir(jenisTugasPetaDipilihPentadbir || jenisTugasPetaSemasaPentadbir());
  const senarai = dataPetugasLokasiPentadbir(lokasiPetaDipilihPentadbir,jenisTugas);
  const kategori = {
    BERTUGAS: senarai.filter(item => statusPetugasLokasiPentadbir(item) === "BERTUGAS"),
    BELUM_HADIR: senarai.filter(item => statusPetugasLokasiPentadbir(item) === "BELUM_HADIR"),
    SELESAI: senarai.filter(item => statusPetugasLokasiPentadbir(item) === "SELESAI")
  };
  const tetapan = tetapanPetaCartaPentadbir();
  const kunci = kunciMarkerPetaPentadbir(jenisTugas,lokasiPetaDipilihPentadbir);
  const status = atas(tetapan.marker?.[kunci]?.status || tetapan.marker?.[lokasiPetaDipilihPentadbir]?.status || "NORMAL");
  if (el("namaLokasiPetaPentadbir")) el("namaLokasiPetaPentadbir").textContent = lokasiPetaDipilihPentadbir;
  if (el("jenisTugasLokasiPetaPentadbir")) el("jenisTugasLokasiPetaPentadbir").textContent = jenisTugas || "-";
  if (el("statusLokasiPetaPentadbir")) el("statusLokasiPetaPentadbir").textContent = status;
  if (el("jumlahDitugaskanLokasi")) el("jumlahDitugaskanLokasi").textContent = senarai.length;
  if (el("jumlahBertugasLokasi")) el("jumlahBertugasLokasi").textContent = kategori.BERTUGAS.length;
  if (el("jumlahBelumHadirLokasi")) el("jumlahBelumHadirLokasi").textContent = kategori.BELUM_HADIR.length;
  if (el("jumlahSelesaiLokasi")) el("jumlahSelesaiLokasi").textContent = kategori.SELESAI.length;
  ["BERTUGAS","BELUM_HADIR","SELESAI"].forEach(kategoriTab => {
    const id = kategoriTab === "BERTUGAS" ? "tabLokasiBertugas" : kategoriTab === "BELUM_HADIR" ? "tabLokasiBelumHadir" : "tabLokasiSelesai";
    el(id)?.classList.toggle("active",tabPetugasLokasiAktif === kategoriTab);
  });
  paparSenaraiPetugasLokasiPentadbir(kategori[tabPetugasLokasiAktif] || []);
}

function tukarTabPetugasLokasi(
  tab
) {
  tabPetugasLokasiAktif =
    tab;

  paparPanelLokasiPentadbir();
}


function paparSenaraiPetugasLokasiPentadbir(
  senarai
) {
  const ruang =
    el("senaraiPetugasLokasiPeta");

  if (!ruang) return;

  if (!senarai.length) {
    ruang.innerHTML =
      '<div class="empty-row">Tiada petugas untuk dipaparkan.</div>';
    return;
  }

  ruang.innerHTML =
    senarai.map((item, index) => `
      <article class="admin-map-personnel-card">
        <div class="admin-map-personnel-number">
          ${index + 1}
        </div>

        <div class="admin-map-personnel-main">
          <strong>
            ${escapeHtml(item.pangkat || "")}
            ${escapeHtml(item.nama || "-")}
          </strong>

          <div class="admin-map-personnel-meta">
            <span>No Badan: ${escapeHtml(item.noBadan || "-")}</span>
            <span>Call Sign: ${escapeHtml(item.callSign || "-")}</span>
            <span>Tugas: ${escapeHtml(item.jenisTugas || "-")}</span>
            ${
              item.penyelia
                ? '<span class="badge badge-yellow">PENYELIA</span>'
                : ""
            }
            ${
              item.pemegangSet
                ? '<span class="badge badge-blue">PEMEGANG SET</span>'
                : ""
            }
          </div>

          ${
            item.masaCheckin
              ? `
                <small>
                  Check-In:
                  ${escapeHtml(
                    formatTarikhMasa(
                      item.masaCheckin
                    )
                  )}
                </small>
              `
              : ""
          }
        </div>
      </article>
    `).join("");
}


function binaPilihanLokasiMarkerPentadbir() {
  const select = el("pilihanLokasiMarkerPentadbir");
  if (!select) return;
  const jenis =
    normalisasiJenisTugasMarkerPentadbir(
      el("pilihanJenisTugasMarkerPentadbir")?.value ||
      jenisTugasMarkerUrusPentadbir
    );

  jenisTugasMarkerUrusPentadbir =
    jenis;

  const semasa =
    select.value;

  const lokasi =
    jenis
      ? lokasiUnikCartaPentadbir(jenis)
      : [];
  select.innerHTML = '<option value="">PILIH TEMPAT TUGAS</option>' + lokasi.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
  if (lokasi.includes(semasa)) select.value = semasa;
  if (!select.dataset.listenerLokasiMarker) {
    select.dataset.listenerLokasiMarker = "1";
    select.addEventListener("change",() => {
      const nama = teks(select.value);
      const jenisSemasa = normalisasiJenisTugasMarkerPentadbir(el("pilihanJenisTugasMarkerPentadbir")?.value || jenisTugasMarkerUrusPentadbir);
      if (el("lokasiMarkerDipilihPentadbir")) el("lokasiMarkerDipilihPentadbir").textContent = nama ? `${jenisSemasa} — ${nama}` : "BELUM DIPILIH";
      const tetapan = tetapanPetaCartaPentadbir();
      const kunci = kunciMarkerPetaPentadbir(jenisSemasa,nama);
      const status = atas(tetapan.marker?.[kunci]?.status || tetapan.marker?.[nama]?.status || "NORMAL");
      if (el("statusMarkerPentadbir")) el("statusMarkerPentadbir").value = status;
    });
  }
}

function bukaUrusPetaPentadbir() {
  const modal = el("modalUrusPetaPentadbir");
  if (!modal) { alert("Modal Urus Peta belum terdapat dalam admin.html."); return; }
  binaPilihanJenisTugasPetaPentadbir();
  binaPilihanLokasiMarkerPentadbir();
  muatPetaCartaPentadbir();
  const lokasiSemasa = el("pilihanLokasiMarkerPentadbir")?.value || "";
  if (el("lokasiMarkerDipilihPentadbir")) el("lokasiMarkerDipilihPentadbir").textContent = lokasiSemasa ? `${jenisTugasMarkerUrusPentadbir} — ${lokasiSemasa}` : "BELUM DIPILIH";
  modal.hidden = false; modal.removeAttribute("hidden"); modal.classList.add("open");
  document.body.classList.add("modal-open");
}

function tutupUrusPetaPentadbir() {
  const modal =
    el("modalUrusPetaPentadbir");

  if (!modal) return;

  modal.classList.remove("open");
  modal.hidden = true;
  modal.setAttribute("hidden", "");

  document.body.classList.remove(
    "modal-open"
  );
}


function pratontonPetaPentadbir(event) {
  if (event?.target) {
    event.target.value = "";
  }

  const imej =
    el("imejUrusPetaPentadbir");

  if (imej) {
    imej.src = URL_PETA_ADMIN_F1;
    delete imej.dataset.imejBaharu;
  }

  paparMesej(
    "statusUrusPetaPentadbir",
    "Peta Admin kini menggunakan images/petaadmin.png dari GitHub. Tukar fail petaadmin.png di GitHub jika mahu menukar gambar.",
    "warning"
  );
}

function paparMarkerUrusPetaPentadbir() {
  const lapisan = el("lapisanMarkerUrusPetaPentadbir");
  if (!lapisan) return;
  const jenis = normalisasiJenisTugasMarkerPentadbir(el("pilihanJenisTugasMarkerPentadbir")?.value || jenisTugasMarkerUrusPentadbir);
  jenisTugasMarkerUrusPentadbir = jenis;
  const lokasi = lokasiUnikCartaPentadbir(jenis);
  const tetapan = tetapanPetaCartaPentadbir();
  lapisan.innerHTML = lokasi.map((nama,index) => {
    const kunci = kunciMarkerPetaPentadbir(jenis,nama);
    const posisi = posisiMarkerJenisLokasiPentadbir(tetapan,jenis,nama,index,lokasi.length);
    const status = atas(posisi.status || "NORMAL");
    const namaAtribut = escapeHtml(nama);
    const kunciAtribut = escapeHtml(kunci);
    const namaJs = nama.replace(/\\/g,"\\\\").replace(/'/g,"\\'");
    const jenisJs = jenis.replace(/\\/g,"\\\\").replace(/'/g,"\\'");
    return `<button class="admin-map-marker admin-map-marker-manage admin-map-marker-${escapeHtml(status.toLowerCase())}" type="button"
      style="left:${Number(posisi.x).toFixed(3)}%;top:${Number(posisi.y).toFixed(3)}%;" data-kunci-marker="${kunciAtribut}" data-lokasi="${namaAtribut}"
      title="${escapeHtml(jenis)} — ${namaAtribut}" onpointerdown="mulaSeretMarkerPetaPentadbir(event,'${jenisJs}','${namaJs}')"
      onclick="event.stopPropagation(); pilihLokasiUrusMarkerPentadbir('${namaJs}','${jenisJs}')"><span class="admin-map-marker-label">${namaAtribut}</span></button>`;
  }).join("");
  const kanvas = el("kanvasUrusPetaPentadbir");
  if (kanvas && !kanvas.dataset.listenerMarker) {
    kanvas.dataset.listenerMarker = "1";
    kanvas.addEventListener("click",event => { if (!sedangSeretMarkerPetaPentadbir) letakMarkerPetaPentadbir(event); });
  }
}

function pilihLokasiUrusMarkerPentadbir(lokasi, jenisTugas = jenisTugasMarkerUrusPentadbir) {
  const jenis = normalisasiJenisTugasMarkerPentadbir(jenisTugas);
  const jenisSelect = el("pilihanJenisTugasMarkerPentadbir");
  if (jenisSelect && jenisTugasMarkerDisokongPentadbir(jenis)) { jenisSelect.value = jenis; jenisTugasMarkerUrusPentadbir = jenis; binaPilihanLokasiMarkerPentadbir(); }
  const select = el("pilihanLokasiMarkerPentadbir");
  if (select) { select.value = lokasi; select.dispatchEvent(new Event("change")); }
}

function mulaSeretMarkerPetaPentadbir(event, jenisTugas, lokasi) {
  event.preventDefault(); event.stopPropagation();
  sedangSeretMarkerPetaPentadbir = true;
  lokasiMarkerSeretPentadbir = kunciMarkerPetaPentadbir(jenisTugas,lokasi);
  kanvasMarkerSeretPentadbir = el("kanvasUrusPetaPentadbir");
  pilihLokasiUrusMarkerPentadbir(lokasi,jenisTugas);
  document.body.classList.add("marker-dragging");
  window.addEventListener("pointermove",gerakSeretMarkerPetaPentadbir);
  window.addEventListener("pointerup",tamatSeretMarkerPetaPentadbir,{once:true});
}

function gerakSeretMarkerPetaPentadbir(event) {
  if (!sedangSeretMarkerPetaPentadbir || !lokasiMarkerSeretPentadbir || !kanvasMarkerSeretPentadbir) return;
  const rect = kanvasMarkerSeretPentadbir.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = ((event.clientX-rect.left)/rect.width)*100;
  const y = ((event.clientY-rect.top)/rect.height)*100;
  const tetapan = tetapanPetaCartaPentadbir();
  const lama = tetapan.marker?.[lokasiMarkerSeretPentadbir] || {};
  const pecahan = pecahKunciMarkerPetaPentadbir(lokasiMarkerSeretPentadbir);
  tetapan.marker[lokasiMarkerSeretPentadbir] = {...lama,jenisTugas:pecahan.jenisTugas,lokasi:pecahan.lokasi,x:Math.max(0,Math.min(100,x)),y:Math.max(0,Math.min(100,y)),status:atas(el("statusMarkerPentadbir")?.value || lama.status || "NORMAL")};
  simpanTetapanPetaCartaTempatan(tetapan);
  const marker = el("lapisanMarkerUrusPetaPentadbir")?.querySelector(`[data-kunci-marker="${CSS.escape(lokasiMarkerSeretPentadbir)}"]`);
  if (marker) { marker.style.left = `${tetapan.marker[lokasiMarkerSeretPentadbir].x}%`; marker.style.top = `${tetapan.marker[lokasiMarkerSeretPentadbir].y}%`; }
}

function tamatSeretMarkerPetaPentadbir() {
  if (!sedangSeretMarkerPetaPentadbir) return;
  window.removeEventListener("pointermove",gerakSeretMarkerPetaPentadbir);
  document.body.classList.remove("marker-dragging");
  const pecahan = pecahKunciMarkerPetaPentadbir(lokasiMarkerSeretPentadbir);
  sedangSeretMarkerPetaPentadbir = false; lokasiMarkerSeretPentadbir = ""; kanvasMarkerSeretPentadbir = null;
  paparMarkerPetaPentadbir();
  paparMesej("statusUrusPetaPentadbir",`Marker ${escapeHtml(pecahan.jenisTugas)} — ${escapeHtml(pecahan.lokasi)} telah dipindahkan. Tekan SIMPAN MARKER.`,"success");
}

function letakMarkerPetaPentadbir(event) {
  const jenisTugas = normalisasiJenisTugasMarkerPentadbir(el("pilihanJenisTugasMarkerPentadbir")?.value || jenisTugasMarkerUrusPentadbir);
  const lokasi = el("pilihanLokasiMarkerPentadbir")?.value;
  if (!jenisTugas || !jenisTugasMarkerDisokongPentadbir(jenisTugas)) { paparMesej("statusUrusPetaPentadbir","Pilih Jenis Tugas dahulu.","warning"); return; }
  if (!lokasi) { paparMesej("statusUrusPetaPentadbir","Pilih Tempat Tugas dahulu.","warning"); return; }
  const kanvas = el("kanvasUrusPetaPentadbir"); if (!kanvas) return;
  const rect = kanvas.getBoundingClientRect();
  const x = ((event.clientX-rect.left)/rect.width)*100; const y = ((event.clientY-rect.top)/rect.height)*100;
  const tetapan = tetapanPetaCartaPentadbir(); const kunci = kunciMarkerPetaPentadbir(jenisTugas,lokasi);
  tetapan.marker[kunci] = {jenisTugas,lokasi,x:Math.max(0,Math.min(100,x)),y:Math.max(0,Math.min(100,y)),status:atas(el("statusMarkerPentadbir")?.value || tetapan.marker?.[kunci]?.status || tetapan.marker?.[lokasi]?.status || "NORMAL")};
  simpanTetapanPetaCartaTempatan(tetapan);
  pilihLokasiUrusMarkerPentadbir(lokasi,jenisTugas); paparMarkerUrusPetaPentadbir(); paparMarkerPetaPentadbir();
  paparMesej("statusUrusPetaPentadbir",`Marker ${escapeHtml(jenisTugas)} — ${escapeHtml(lokasi)} telah diletakkan. Anda boleh seret marker untuk melaras kedudukan.`,"success");
}

function simpanTetapanPetaPentadbir() {
  const tetapan = tetapanPetaCartaPentadbir();
  const jenisTugas = normalisasiJenisTugasMarkerPentadbir(el("pilihanJenisTugasMarkerPentadbir")?.value || jenisTugasMarkerUrusPentadbir);
  const lokasi = el("pilihanLokasiMarkerPentadbir")?.value;
  const kunci = kunciMarkerPetaPentadbir(jenisTugas,lokasi);
  if (jenisTugas && lokasi && tetapan.marker?.[kunci]) { tetapan.marker[kunci].status = atas(el("statusMarkerPentadbir")?.value || "NORMAL"); tetapan.marker[kunci].jenisTugas = jenisTugas; tetapan.marker[kunci].lokasi = lokasi; }
  try { simpanTetapanPetaCartaTempatan({imej:URL_PETA_ADMIN_F1,marker:tetapan.marker || {}}); }
  catch (error) { paparMesej("statusUrusPetaPentadbir","Tetapan marker gagal disimpan.","error"); return; }
  muatPetaCartaPentadbir();
  paparMesej("statusUrusPetaPentadbir","Marker berjaya disimpan mengikut Jenis Tugas dan Tempat Tugas.","success");
}

function pasangZoomPetaPentadbir() {
  const viewport =
    el("viewportPetaCartaPentadbir");

  if (
    !viewport ||
    viewport.dataset.zoomListener
  ) {
    return;
  }

  viewport.dataset.zoomListener =
    "1";

  viewport.addEventListener(
    "wheel",
    event => {
      event.preventDefault();

      zumPetaCartaPentadbir +=
        event.deltaY < 0
          ? 0.15
          : -0.15;

      zumPetaCartaPentadbir =
        Math.max(
          0.75,
          Math.min(
            3,
            zumPetaCartaPentadbir
          )
        );

      gunaZumPetaCartaPentadbir();
    },
    {
      passive: false
    }
  );
}


function gunaZumPetaCartaPentadbir() {
  const kanvas =
    el("kanvasPetaCartaPentadbir");

  if (kanvas) {
    kanvas.style.transform =
      `scale(${zumPetaCartaPentadbir})`;
  }

  if (el("statusPetaCartaPentadbir")) {
    el("statusPetaCartaPentadbir")
      .textContent =
      `Zoom: ${Math.round(
        zumPetaCartaPentadbir *
        100
      )}%`;
  }
}


function resetZumPetaCartaPentadbir() {
  zumPetaCartaPentadbir = 1;
  gunaZumPetaCartaPentadbir();
}


/* ================================================================
   KRONOLOGI OPERASI
================================================================ */

function dapatkanKronologiTempatanPentadbir() {
  try {
    const data =
      JSON.parse(
        localStorage.getItem(
          KUNCI_KRONOLOGI_CARTA_F1
        ) ||
        "[]"
      );

    return Array.isArray(data)
      ? data
      : [];
  } catch (_) {
    return [];
  }
}


function bukaTambahKronologiPentadbir() {
  const modal =
    el(
      "modalTambahKronologiPentadbir"
    );

  if (!modal) {
    alert(
      "Modal Tambah Kronologi belum terdapat dalam admin.html."
    );
    return;
  }

  const masa =
    el("masaKronologiPentadbir");

  if (masa && !masa.value) {
    const sekarang =
      new Date();

    const local =
      new Date(
        sekarang.getTime() -
        sekarang.getTimezoneOffset() *
        60000
      );

    masa.value =
      local.toISOString().slice(0, 16);
  }

  modal.hidden = false;
  modal.removeAttribute("hidden");
  modal.classList.add("open");
  document.body.classList.add(
    "modal-open"
  );
}


function tutupTambahKronologiPentadbir() {
  const modal =
    el(
      "modalTambahKronologiPentadbir"
    );

  if (!modal) return;

  modal.classList.remove("open");
  modal.hidden = true;
  modal.setAttribute("hidden", "");
  document.body.classList.remove(
    "modal-open"
  );
}


function simpanKronologiPentadbir() {
  const masa =
    el("masaKronologiPentadbir")
      ?.value;

  const lokasi =
    teks(
      el("lokasiKronologiPentadbir")
        ?.value
    );

  const tajuk =
    teks(
      el("tajukKronologiPentadbir")
        ?.value
    );

  const catatan =
    teks(
      el("catatanKronologiPentadbir")
        ?.value
    );

  if (!masa || !tajuk) {
    paparMesej(
      "statusTambahKronologiPentadbir",
      "Tarikh/Masa dan Tajuk perlu diisi.",
      "error"
    );
    return;
  }

  const senarai =
    dapatkanKronologiTempatanPentadbir();

  senarai.push({
    id:
      window.crypto?.randomUUID?.() ||
      String(Date.now()),

    masa,
    lokasi,
    tajuk,
    catatan
  });

  senarai.sort(
    (a, b) =>
      new Date(b.masa) -
      new Date(a.masa)
  );

  localStorage.setItem(
    KUNCI_KRONOLOGI_CARTA_F1,
    JSON.stringify(senarai)
  );

  [
    "lokasiKronologiPentadbir",
    "tajukKronologiPentadbir",
    "catatanKronologiPentadbir"
  ].forEach(id => {
    if (el(id)) el(id).value = "";
  });

  if (el("masaKronologiPentadbir")) {
    el("masaKronologiPentadbir").value =
      "";
  }

  paparKronologiPentadbir();
  tutupTambahKronologiPentadbir();
}


function paparKronologiPentadbir() {
  const tbody =
    el("senaraiKronologiPentadbir");

  if (!tbody) return;

  const tarikh =
    el("tarikhCartaPentadbir")
      ?.value ||
    hariIniMalaysia();
const manual =
    dapatkanKronologiTempatanPentadbir()
      .filter(item =>
        teks(item.masa).slice(0, 10) ===
        tarikh
      );

  const automatik =
    dataCartaLaporanPentadbir
      .filter(item => {
        const data =
          dataLaporanCarta(item);

        return (
          nilaiAdaCarta(data.kemalangan) ||
          nilaiAdaCarta(data.tangkapan) ||
          nilaiAdaCarta(data.rampasan) ||
          nilaiAdaCarta(
            data.jenis_ancaman ??
            data.ancaman
          )
        );
      })
      .map(item => {
        const data =
          dataLaporanCarta(item);

        const perkara = [];

        if (nilaiAdaCarta(data.kemalangan)) {
          perkara.push(
            `Kemalangan: ${teksNilaiCarta(data.kemalangan)}`
          );
        }

        if (nilaiAdaCarta(data.tangkapan)) {
          perkara.push(
            `Tangkapan: ${teksNilaiCarta(data.tangkapan)}`
          );
        }

        if (nilaiAdaCarta(data.rampasan)) {
          perkara.push(
            `Rampasan: ${teksNilaiCarta(data.rampasan)}`
          );
        }

        if (
          nilaiAdaCarta(
            data.jenis_ancaman ??
            data.ancaman
          )
        ) {
          perkara.push(
            `Ancaman: ${teksNilaiCarta(
              data.jenis_ancaman ??
              data.ancaman
            )}`
          );
        }

        return {
          id: `laporan-${item.id}`,
          masa: item.tarikh_masa,
          lokasi:
            item.penugasan?.tempat_tugas ||
            data.lokasi ||
            "",
          tajuk:
            jenisTugasCarta(item) ||
            "LAPORAN PETUGAS",
          catatan:
            perkara.join(" | ")
        };
      });

  const semua =
    [...manual, ...automatik]
      .sort(
        (a, b) =>
          new Date(b.masa) -
          new Date(a.masa)
      );

  if (!semua.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="empty-row">
          Belum ada kronologi operasi untuk tarikh ini.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML =
    semua.map(item => `
      <tr>
        <td style="text-align:center;white-space:nowrap;">
          ${escapeHtml(
            formatMasaLaporanAdmin(
              item.masa
            )
          )}
        </td>

        <td style="text-align:center;font-weight:800;">
          ${escapeHtml(item.tajuk || "-")}
        </td>

        <td style="text-align:center;">
          ${escapeHtml(item.lokasi || "-")}
        </td>

        <td style="text-align:left;white-space:normal;">
          ${escapeHtml(item.catatan || "-")}
        </td>
      </tr>
    `).join("");
}



/* ================================================================
   PASS & KENDERAAN PETUGAS — PENTADBIR
================================================================ */
function bukaModulPassKenderaanPentadbir() {
  tutupSemuaModulPentadbir();
  const modul = el("modulPassKenderaanPentadbir");
  if (!modul) return;
  modul.hidden = false; modul.removeAttribute("hidden"); modul.style.display = "block";
  const inputTarikh = el("tarikhPassKenderaanAdmin");
  if (inputTarikh && !inputTarikh.value) inputTarikh.value = el("tarikh")?.value || hariIniMalaysia();
  muatPassKenderaanPentadbir();
  modul.scrollIntoView({ behavior: "smooth", block: "start" });
}
function tutupModulPassKenderaanPentadbir() {
  const modul = el("modulPassKenderaanPentadbir");
  if (modul) { modul.hidden = true; modul.setAttribute("hidden", ""); modul.style.display = "none"; }
}
async function muatPassKenderaanPentadbir() {
  const tarikh = el("tarikhPassKenderaanAdmin")?.value || hariIniMalaysia();
  const status = el("statusPassKenderaanAdmin");
  if (status) { status.className = "status-box warning"; status.style.display = "block"; status.textContent = "Sedang mendapatkan rekod..."; }
  try {
    const { data, error } = await db.from("pass_kenderaan_petugas").select("*")
      .eq("tarikh_penugasan", tarikh).order("no_badan", { ascending: true });
    if (error) throw error;
    dataPassKenderaanAdmin = data || [];
    paparPassKenderaanPentadbir();
    if (status) { status.className = "status-box success"; status.innerHTML = `<strong>${dataPassKenderaanAdmin.length}</strong> rekod dijumpai untuk ${escapeHtml(formatTarikhMalaysia(tarikh))}.`; }
  } catch (err) {
    dataPassKenderaanAdmin = []; paparPassKenderaanPentadbir();
    if (status) { status.className = "status-box error"; status.textContent = `Ralat: ${err.message}`; }
  }
}
function dataPassKenderaanDitapis() {
  const cari = atas(el("carianPassKenderaanAdmin")?.value);
  if (!cari) return [...dataPassKenderaanAdmin];
  return dataPassKenderaanAdmin.filter(r => [r.no_badan,r.pangkat,r.nama,r.no_siri_pass,r.no_kenderaan].some(v => atas(v).includes(cari)));
}
function paparPassKenderaanPentadbir() {
  const tbody = el("tbodyPassKenderaanAdmin"); if (!tbody) return;
  const rows = dataPassKenderaanDitapis();
  if (!rows.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty-row">Tiada rekod dijumpai.</td></tr>'; return; }
  tbody.innerHTML = rows.map((r,i) => `<tr>
    <td style="text-align:center">${i+1}</td><td style="text-align:center">${escapeHtml(formatTarikhMalaysia(r.tarikh_penugasan))}</td>
    <td style="text-align:center;font-weight:700">${escapeHtml(r.no_badan||"-")}</td><td>${escapeHtml(r.pangkat||"-")}</td>
    <td style="text-align:center;vertical-align:middle">${escapeHtml(r.nama||"-")}</td><td style="text-align:center;font-weight:700">${escapeHtml(r.no_siri_pass||"-")}</td>
    <td style="text-align:center;font-weight:700">${escapeHtml(r.no_kenderaan||"-")}</td></tr>`).join("");
}
function cetakPassKenderaanPentadbir() {
  const rows=dataPassKenderaanDitapis(); if(!rows.length) return alert("Tiada rekod untuk dicetak.");
  const tarikh=el("tarikhPassKenderaanAdmin")?.value||hariIniMalaysia();
  const isi=rows.map((r,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(formatTarikhMalaysia(r.tarikh_penugasan))}</td><td>${escapeHtml(r.no_badan||"-")}</td><td>${escapeHtml(r.pangkat||"-")}</td><td>${escapeHtml(r.nama||"-")}</td><td>${escapeHtml(r.no_siri_pass||"-")}</td><td>${escapeHtml(r.no_kenderaan||"-")}</td></tr>`).join("");
  const w=window.open("","_blank","width=1200,height=800"); if(!w) return alert("Benarkan pop-up untuk mencetak.");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>PASS & Kenderaan</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial;color:#111}h1,h2,p{text-align:center;margin:4px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #555;padding:7px;font-size:11px;text-align:center}th{background:#eee}</style></head><body><h1>OP LITAR</h1><h2>REKOD PASS & KENDERAAN PETUGAS</h2><p>TARIKH PENUGASAN: ${escapeHtml(formatTarikhMalaysia(tarikh))}</p><table><thead><tr><th>BIL</th><th>TARIKH PENUGASAN</th><th>NO BADAN</th><th>PANGKAT</th><th>NAMA</th><th>NO SIRI PASS</th><th>NO KENDERAAN</th></tr></thead><tbody>${isi}</tbody></table><p style="text-align:left;margin-top:10px"><strong>JUMLAH REKOD: ${rows.length}</strong></p><script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`); w.document.close();
}
function csvSelamat(v){const s=String(v??"");return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}
function muatTurunCsvPassKenderaanPentadbir() {
  const rows=dataPassKenderaanDitapis(); if(!rows.length) return alert("Tiada rekod untuk dimuat turun.");
  const kepala=["BIL","TARIKH PENUGASAN","NO BADAN","PANGKAT","NAMA","NO SIRI PASS","NO KENDERAAN"];
  const baris=rows.map((r,i)=>[i+1,r.tarikh_penugasan,r.no_badan,r.pangkat,r.nama,r.no_siri_pass,r.no_kenderaan].map(csvSelamat).join(","));
  const blob=new Blob(["\ufeff"+[kepala.join(","),...baris].join("\r\n")],{type:"text/csv;charset=utf-8;"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`PASS_KENDERAAN_${el("tarikhPassKenderaanAdmin")?.value||hariIniMalaysia()}.csv`; document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
}

window.login = login;
window.logout = logout;

document.addEventListener("DOMContentLoaded", () => {
  sediakanJanaPenugasanAuto();
  const inputTarikh = el("tarikh");

  if (inputTarikh) {
    inputTarikh.value = hariIniMalaysia();
  }

  const tarikhLaporan = el("tarikhLaporanPentadbir");
  if (tarikhLaporan) {
    tarikhLaporan.value = hariIniMalaysia();
  }

  const tarikhCarta = el("tarikhCartaPentadbir");
  if (tarikhCarta) {
    tarikhCarta.value = hariIniMalaysia();
  }

  const tarikhLaporanKeseluruhan = el("tarikhLaporanKeseluruhanHarian");
  if (tarikhLaporanKeseluruhan) {
    tarikhLaporanKeseluruhan.value = hariIniMalaysia();
  }

  el("password")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      login();
    }
  });

  /*
    Pastikan ketiga-tiga modul ditutup
    apabila halaman mula dibuka.
  */
  tutupSemuaModulPentadbir();

  pulihkanSesiPentadbir();
});


/* ================================================================
   AGENSI LUAR — PASTIKAN INLINE ONCLICK BOLEH AKSES
================================================================ */
window.bukaTambahAgensiLuarPentadbir =
  bukaTambahAgensiLuarPentadbir;

window.bukaEditAgensiLuarPentadbir =
  bukaEditAgensiLuarPentadbir;

window.tutupModalAgensiLuarPentadbir =
  tutupModalAgensiLuarPentadbir;

window.simpanAgensiLuarPentadbir =
  simpanAgensiLuarPentadbir;

window.padamAgensiLuarPentadbir =
  padamAgensiLuarPentadbir;

/* ================================================================
   MENU PENTADBIR — 20260922
   Menu tindakan disembunyikan secara lalai dan dipaparkan apabila
   butang MENU PENTADBIR ditekan.
================================================================ */
function toggleMenuPentadbir(paksaBuka = null) {
  const menu = document.getElementById("menuPentadbir");
  const butang = document.getElementById("btnToggleMenuPentadbir");
  const ikon = document.getElementById("ikonMenuPentadbir");

  if (!menu || !butang) return;

  const sedangBuka = !menu.hidden;
  const perluBuka = typeof paksaBuka === "boolean" ? paksaBuka : !sedangBuka;

  menu.hidden = !perluBuka;
  butang.setAttribute("aria-expanded", perluBuka ? "true" : "false");
  if (ikon) ikon.textContent = perluBuka ? "▲" : "▼";
}

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") toggleMenuPentadbir(false);
});

/* ================================================================
   FIX 004 — PDF VIEW + PRINT 1 CARTA / HALAMAN
================================================================ */
async function fix004MuatTurunPdfView(){
  const asal=document.getElementById('kandunganLaporanKeseluruhanHarian');
  if(!asal) return alert('Sila jana laporan terlebih dahulu.');
  if(!window.html2canvas || !window.jspdf?.jsPDF) return alert('Modul PDF belum dimuatkan. Muat semula halaman.');
  const tarikh=document.getElementById('tarikhLaporanKeseluruhanHarian')?.value || new Date().toISOString().slice(0,10);
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const rect=asal.getBoundingClientRect();
  const canvas=await html2canvas(asal,{scale:1.35,useCORS:true,allowTaint:false,backgroundColor:getComputedStyle(document.body).backgroundColor||'#111',logging:false,width:Math.round(rect.width),height:asal.scrollHeight,windowWidth:Math.max(innerWidth,Math.round(rect.width)),windowHeight:Math.max(innerHeight,asal.scrollHeight),scrollX:0,scrollY:-scrollY});
  const W=297, H=W*(canvas.height/canvas.width);
  const pdf=new jspdf.jsPDF({orientation:H>=W?'portrait':'landscape',unit:'mm',format:[W,H],compress:true});
  pdf.addImage(canvas.toDataURL('image/jpeg',.96),'JPEG',0,0,W,H,undefined,'FAST');
  pdf.save(`OP_LITAR_LAPORAN_KESELURUHAN_VIEW_${tarikh}.pdf`);
}

function fix004CetakSatuCartaSatuHalaman(){
  const asal=document.getElementById('kandunganLaporanKeseluruhanHarian');
  if(!asal) return alert('Sila jana laporan terlebih dahulu.');
  const clone=asal.cloneNode(true);
  clone.querySelectorAll('.admin-visitor-detail-panel,.admin-vehicle-detail-panel,.admin-attendance-list-panel,.admin-map-location-panel,.admin-vvip-detail-panel,.admin-incident-detail-panel').forEach(x=>x.remove());
  clone.querySelectorAll('.admin-chart-card').forEach(x=>x.classList.add('fix004-page'));
  const styles=[...document.querySelectorAll('link[rel="stylesheet"]')].map(x=>`<link rel="stylesheet" href="${new URL(x.getAttribute('href'),document.baseURI).href}">`).join('');
  const w=open('','_blank','width=1500,height=950'); if(!w) return alert('Benarkan pop-up untuk cetakan.');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8">${styles}<style>@page{size:A4 landscape;margin:7mm}html,body{margin:0;background:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}.fix004-page{break-before:page;page-break-before:always;break-inside:avoid;page-break-inside:avoid;width:100%!important;max-height:190mm!important;overflow:hidden!important}.fix004-page:first-child{break-before:auto;page-break-before:auto}.admin-visitor-layout,.admin-vehicle-layout,.admin-attendance-layout,.admin-operation-map-layout,.admin-vvip-layout,.admin-incident-layout{display:block!important}.admin-visitor-chart-panel,.admin-vehicle-chart-panel,.admin-attendance-chart-panel,.admin-operation-map-stage,.admin-vvip-list-panel,.admin-incident-chart-panel{width:100%!important;max-width:none!important}</style></head><body>${clone.outerHTML}<script>addEventListener('load',()=>setTimeout(()=>print(),800))<\\/script></body></html>`);
  w.document.close();
}

addEventListener('DOMContentLoaded',()=>{
  const pdf=document.getElementById('btnPdfLaporanKeseluruhanHarian');
  const cetak=document.getElementById('btnCetakLaporanKeseluruhanHarian');
  if(pdf){const n=pdf.cloneNode(true);pdf.replaceWith(n);n.addEventListener('click',fix004MuatTurunPdfView);}
  if(cetak){const n=cetak.cloneNode(true);cetak.replaceWith(n);n.addEventListener('click',fix004CetakSatuCartaSatuHalaman);}
});

/* ================================================================
   SKPO AI ASSISTANT — SUBTEK V1
   Edge Function yang dijangka: skpo-ai-assistant
================================================================ */
function bukaSkpoAiSubtek() {
  tutupSemuaModulPentadbir();
  const modul = el("modulSkpoAiSubtek");
  if (!modul) return;
  modul.hidden = false;
  modul.style.display = "block";
  modul.scrollIntoView({ behavior: "smooth", block: "start" });
}

function tutupSkpoAiSubtek() {
  const modul = el("modulSkpoAiSubtek");
  if (!modul) return;
  modul.hidden = true;
  modul.style.display = "none";
}

// FIX007: Render jawapan AI secara selamat dan profesional.
// Hanya subset Markdown asas disokong; HTML daripada model sentiasa di-escape.
function formatJawapanSkpoAiSubtek(nilai) {
  const sumber = String(nilai ?? "").replace(/\r\n?/g, "\n").trim();
  if (!sumber) return "";

  const escapeHtml = (v) => String(v).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  const inline = (v) => {
    let x = escapeHtml(v);
    x = x.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    x = x.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
    x = x.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    return x;
  };

  const lines = sumber.split("\n");
  const html = [];
  let listType = null;

  const tutupList = () => {
    if (listType) html.push(`</${listType}>`);
    listType = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { tutupList(); continue; }

    const headingMd = line.match(/^#{1,4}\s+(.+)$/);
    const headingCaps = !headingMd && line.length <= 80 &&
      /^[A-Z0-9À-ÖØ-Þ /&()\-:]+$/.test(line) && /[A-ZÀ-ÖØ-Þ]/.test(line);

    if (headingMd || headingCaps) {
      tutupList();
      const tajuk = headingMd ? headingMd[1] : line;
      const kelas = /^(RINGKASAN OPERASI|ANALISIS KEHADIRAN|ISU DIKESAN|SITUATION REPORT|SITREP)/i.test(tajuk)
        ? "skpo-ai-title" : "skpo-ai-heading";
      html.push(`<div class="${kelas}">${inline(tajuk)}</div>`);
      continue;
    }

    const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);
    const bullet = line.match(/^[-*•]\s+(.+)$/);

    if (numbered) {
      if (listType !== "ol") { tutupList(); listType = "ol"; html.push('<ol class="skpo-ai-list">'); }
      html.push(`<li>${inline(numbered[2])}</li>`);
      continue;
    }

    if (bullet) {
      if (listType !== "ul") { tutupList(); listType = "ul"; html.push('<ul class="skpo-ai-list">'); }
      html.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }

    tutupList();
    html.push(`<p>${inline(line)}</p>`);
  }

  tutupList();
  return html.join("");
}

function paparJawapanSkpoAiSubtek(output, jawapan) {
  if (!output) return;
  output.innerHTML = formatJawapanSkpoAiSubtek(jawapan);
  output.style.whiteSpace = "normal";
  output.style.overflow = "visible";
  output.style.maxHeight = "none";
  output.style.height = "auto";
  output.style.lineHeight = "1.65";

  if (!document.getElementById("skpoAiFix007Style")) {
    const style = document.createElement("style");
    style.id = "skpoAiFix007Style";
    style.textContent = `
      #jawapanSkpoAiSubtek{padding:20px 22px!important;word-break:break-word;}
      #jawapanSkpoAiSubtek .skpo-ai-title{font-size:1.22rem;font-weight:800;margin:0 0 22px;color:#fff;letter-spacing:.02em;}
      #jawapanSkpoAiSubtek .skpo-ai-heading{font-size:1.02rem;font-weight:800;margin:24px 0 10px;color:#f4c842;letter-spacing:.02em;}
      #jawapanSkpoAiSubtek p{margin:8px 0;color:inherit;}
      #jawapanSkpoAiSubtek strong{font-weight:800;color:#fff;}
      #jawapanSkpoAiSubtek .skpo-ai-list{margin:8px 0 16px;padding-left:26px;}
      #jawapanSkpoAiSubtek .skpo-ai-list li{margin:5px 0;padding-left:3px;}
      #jawapanSkpoAiSubtek code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:rgba(255,255,255,.08);padding:1px 5px;border-radius:4px;}
    `;
    document.head.appendChild(style);
  }
}

async function tanyaSkpoAiSubtek(mod = "SOALAN") {
  const btn=el("btnTanyaSkpoAiSubtek"), output=el("jawapanSkpoAiSubtek");
  const soalan=teks(el("soalanSkpoAiSubtek")?.value), tarikh=el("tarikh")?.value||hariIniMalaysia(), tindakan=atas(mod||"SOALAN");
  if(tindakan==="SOALAN"&&!soalan){paparMesej("statusSkpoAiSubtek","Sila masukkan soalan untuk SKPO AI.","warning");el("soalanSkpoAiSubtek")?.focus();return;}
  if(btn){btn.disabled=true;btn.textContent="AI SEDANG MENGANALISIS...";} paparMesej("statusSkpoAiSubtek","SKPO AI sedang menganalisis data operasi...","warning"); if(output)output.textContent="Sedang menjana analisis...";
  try{
    pastikanSupabase();
    if(el("tarikhCartaPentadbir")) el("tarikhCartaPentadbir").value=tarikh;
    await muatData(true); await muatDataCartaPentadbir();
    const petugas=dataDashboard||[], kira=n=>petugas.filter(x=>atas(x.statusKehadiran)===n).length;
    const ringkasanKumpulan=(medan)=>{const m=new Map();petugas.forEach(item=>{const nama=teks(item?.[medan])||"TIDAK DINYATAKAN";if(!m.has(nama))m.set(nama,{nama,kekuatan:0,hadir:0,belum_hadir:0,tidak_hadir:0,menunggu:0,diganti:0,selesai_tugas:0,masih_bertugas:0});const r=m.get(nama),st=atas(item.statusKehadiran);r.kekuatan++;if(st==="HADIR")r.hadir++;if(st==="BELUM HADIR")r.belum_hadir++;if(st==="TIDAK HADIR")r.tidak_hadir++;if(st==="MENUNGGU")r.menunggu++;if(st==="DIGANTI")r.diganti++;if(item.checkout||item.masaCheckout)r.selesai_tugas++;if(st==="HADIR"&&!(item.checkout||item.masaCheckout))r.masih_bertugas++;});return[...m.values()].sort((a,b)=>b.kekuatan-a.kekuatan||a.nama.localeCompare(b.nama,"ms"));};
    const pengunjung=statistikPengunjungLaporanHarian(), kenderaan=statistikKenderaanLaporanHarian(), vvip=kumpulanVvipVipCarta(), insiden=kiraInsidenCarta();
    const laporanRingkas=(dataCartaLaporanPentadbir||[]).slice(-80).map(item=>{const d=dataLaporanCarta(item)||{};return{masa:item.tarikh_masa||null,jenis_tugas:item.jenis_tugas||item.penugasan?.jenis_tugas||"",tempat_tugas:item.tempat_tugas||item.penugasan?.tempat_tugas||item.penugasan?.lokasi||"",perkara_menarik:d.perkara_menarik??d.catatan??"",tangkapan:d.tangkapan??"",rampasan:d.rampasan??"",kemalangan:d.kemalangan??"",ancaman:d.jenis_ancaman??d.ancaman??""};}).filter(x=>x.perkara_menarik||x.tangkapan||x.rampasan||x.kemalangan||x.ancaman);
    const selesai=petugas.filter(x=>Boolean(x.checkout||x.masaCheckout)).length;
    const dataOperasi={sumber:"SUBTEK",tarikh,nota:"Semua angka telah dikira oleh SKPO. Gunakan sebagai angka muktamad. Jangan kira semula daripada rekod individu.",ringkasan_kehadiran:{jumlah_petugas:petugas.length,hadir:kira("HADIR"),belum_hadir:kira("BELUM HADIR"),tidak_hadir:kira("TIDAK HADIR"),menunggu:kira("MENUNGGU"),diganti:kira("DIGANTI"),selesai_tugas:selesai,masih_bertugas:petugas.filter(x=>atas(x.statusKehadiran)==="HADIR"&&!(x.checkout||x.masaCheckout)).length},statistik_operasi:{jumlah_pengunjung_keseluruhan_peak:pengunjung.keseluruhan,jumlah_pengunjung_terkini:pengunjung.terkini,jumlah_kenderaan_pengunjung_keseluruhan_peak:kenderaan.keseluruhan,jumlah_kenderaan_pengunjung_terkini:kenderaan.terkini,vvip_vip:vvip.length,tangkapan:insiden.tangkapan||0,rampasan:insiden.rampasan||0,kemalangan:insiden.kemalangan||0,ancaman:insiden.ancaman||0,jumlah_laporan_operasi:(dataCartaLaporanPentadbir||[]).length},kehadiran_mengikut_jenis_tugas:ringkasanKumpulan("jenisTugas"),kehadiran_mengikut_tempat_tugas:ringkasanKumpulan("tempatTugas"),laporan_penting:laporanRingkas};
    const {data,error}=await db.functions.invoke("skpo-ai-assistant",{body:{tindakan,soalan:tindakan==="SOALAN"?soalan:"",tarikh,dataOperasi}});
    if(error){let butiran=teks(error?.message);try{const c=error?.context;if(c&&typeof c.json==="function"){const r=await c.json();butiran=teks(r?.error||r?.message||butiran);}}catch(_){}throw new Error(butiran||"Edge Function skpo-ai-assistant gagal dipanggil.");}
    const jawapan=teks(data?.jawapan||data?.answer||data?.result);if(!jawapan)throw new Error("SKPO AI tidak memulangkan jawapan.");if(output)paparJawapanSkpoAiSubtek(output,jawapan);paparMesej("statusSkpoAiSubtek","Analisis AI berjaya dijana.","success");
  }catch(error){console.error("SKPO AI gagal:",error);if(output)output.textContent="SKPO AI Assistant belum dapat menghasilkan analisis.";paparMesej("statusSkpoAiSubtek",teks(error?.message)||"SKPO AI gagal menjana analisis.","error");}
  finally{if(btn){btn.disabled=false;btn.textContent="HANTAR SOALAN";}}
}