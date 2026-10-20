"use strict";

/* SKPO FORMULA 1 — Petugas (GitHub Pages + Supabase) */

const db = window.supabaseClient;
const ZON_MASA = "Asia/Kuala_Lumpur";
const SELANG_SEMAKAN_STATUS = 15000;
const HAD_KETEPATAN_GPS = 100;

/* Kunci tempatan khusus Formula 1 supaya tidak bercampur dengan MotoGP. */
const KUNCI_USER_F1 = "skpoF1User";
const KUNCI_DEVICE_F1 = "skpoF1DeviceId";

let userLogin = null;
let tugas = null;
let lokasiGPS = null;
let lokasiGPSCheckout = null;
let jarakSemasa = null;
let jarakCheckout = null;
let lokasiDibenarkan = false;
let lokasiCheckoutDibenarkan = false;
let sedangMenghantar = false;
let sedangMenghantarCheckout = false;
let timerSemakStatus = null;
let statusKehadiranSemasa = "";
let sudahCheckOutSemasa = false;
let rekodCheckinSemasa = null;

function el(id) { return document.getElementById(id); }
function teks(v) { return String(v ?? "").trim(); }
function atas(v) { return teks(v).toUpperCase(); }
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}
function hariIniMalaysia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZON_MASA, year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}
function formatTarikhMasa(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return teks(v) || "-";
  return new Intl.DateTimeFormat("ms-MY", {
    timeZone: ZON_MASA, day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(d);
}
function nilaiBoolean(v) {
  return v === true || ["YA", "YES", "Y", "1", "BENAR", "TRUE"].includes(atas(v));
}
function paparStatus(id, mesej, jenis = "warning") {
  const e = el(id); if (!e) return;
  e.className = `status-box ${jenis}`; e.style.display = "block"; e.innerHTML = mesej;
}
function emailDalaman(noBadan) {
  const n = teks(noBadan).toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return `${n}@skpo.local`;
}
function dapatkanDeviceId() {
  const kunci = KUNCI_DEVICE_F1;
  let id = localStorage.getItem(kunci);
  if (!id) {
    const rawak = window.crypto?.randomUUID?.() ||
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16);
      });
    id = `F1-DEV-${rawak.toUpperCase()}`; localStorage.setItem(kunci, id);
  }
  return id;
}

async function sahkanIkatanPeranti() {
  const { data, error } = await db.rpc(
    "ikat_peranti_petugas",
    { p_device_id: dapatkanDeviceId() }
  );

  if (error) {
    if (/ikat_peranti_petugas|function.*does not exist/i.test(error.message || "")) {
      throw new Error(
        "Kawalan peranti belum dipasang dalam Supabase. Hubungi Pentadbir."
      );
    }
    throw error;
  }

  if (!data || data.success !== true) {
    throw new Error(
      data?.message || "Peranti ini tidak dibenarkan untuk akaun tersebut."
    );
  }

  return data;
}

async function ambilProfil(userId) {
  let hasil = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (hasil.error && /auth_user_id/i.test(hasil.error.message || "")) {
    hasil = await db.from("profiles").select("*").eq("auth_user_id", userId).maybeSingle();
  }
  if (hasil.error) throw hasil.error;
  return hasil.data;
}

async function login() {
  const noBadan = atas(el("noBadan")?.value);
  const password = teks(el("password")?.value);
  const btn = el("btnLogin");
  if (!noBadan || !password) {
    el("status").innerHTML = '<span class="status-error">Sila masukkan No Badan dan kata laluan.</span>';
    return;
  }
  btn.disabled = true; btn.textContent = "SEDANG LOGIN...";
  el("status").innerHTML = '<span class="status-warning">Sedang menyemak...</span>';
  try {
    const { data, error } = await db.auth.signInWithPassword({ email: emailDalaman(noBadan), password });
    if (error || !data.user) throw new Error("No Badan atau kata laluan tidak sah.");
    const profil = await ambilProfil(data.user.id);
    if (!profil) throw new Error("Profil petugas tidak dijumpai.");
    if (profil.aktif === false) throw new Error("Akaun petugas tidak aktif.");
    await sahkanIkatanPeranti();
    userLogin = {
      id: profil.id, authUserId: data.user.id, noBadan: profil.no_badan,
      pangkat: profil.pangkat || "", nama: profil.nama || "", peranan: profil.peranan || "PETUGAS"
    };
    localStorage.setItem(KUNCI_USER_F1, JSON.stringify(userLogin));
    paparDashboardProfil();
    await refreshDashboard();
    mulaSemakanStatusAutomatik();
  } catch (err) {
    await db.auth.signOut().catch(() => {});
    el("status").innerHTML = `<span class="status-error">${escapeHtml(err.message)}</span>`;
  } finally {
    btn.disabled = false; btn.textContent = "LOGIN";
  }
}

function paparDashboardProfil() {
  el("loginBox").classList.remove("login-visible");
  el("loginBox").style.display = "none"; el("dashboard").style.display = "block";
  el("pangkatPetugas").textContent = userLogin.pangkat || "PANGKAT TIDAK DINYATAKAN";
  el("namaPetugas").textContent = userLogin.nama || "-";
  el("noBadanPetugas").textContent = `No Badan: ${userLogin.noBadan || "-"}`;
  el("status").innerHTML = "";
}

async function pulihkanSesi() {
  try {
    const { data, error } = await db.auth.getSession();
    if (error || !data.session?.user) return;
    const profil = await ambilProfil(data.session.user.id);
    if (!profil || profil.aktif === false) { await db.auth.signOut(); return; }
    await sahkanIkatanPeranti();
    userLogin = {
      id: profil.id, authUserId: data.session.user.id, noBadan: profil.no_badan,
      pangkat: profil.pangkat || "", nama: profil.nama || "", peranan: profil.peranan || "PETUGAS"
    };
    localStorage.setItem(KUNCI_USER_F1, JSON.stringify(userLogin));
    paparDashboardProfil(); await refreshDashboard(); mulaSemakanStatusAutomatik();
  } catch (err) {
    console.error("Pemulihan sesi gagal:", err);
    await db.auth.signOut().catch(() => {});
    localStorage.removeItem(KUNCI_USER_F1);
    el("status").innerHTML = `<span class="status-error">${escapeHtml(err.message)}</span>`;
  }
}

async function dapatkanTugasHariIni() {
  const status = el("statusTugas");
  status.innerHTML = '<span class="status-warning">Sedang mendapatkan tugasan...</span>';
  el("btnCheckin").disabled = true;
  ["callSignTugas", "jenisTugas", "lokasiTugas", "penyeliaTugas", "pemegangSetTugas"]
    .forEach(id => el(id).textContent = "Memuatkan...");
  try {
    const tarikh = hariIniMalaysia();
    let q = await db.from("penugasan").select("*").eq("petugas_id", userLogin.id).eq("tarikh", tarikh)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (q.error && /petugas_id|tarikh/i.test(q.error.message || "")) {
      q = await db.from("penugasan").select("*").eq("profile_id", userLogin.id).eq("tarikh_tugas", tarikh)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
    }
    if (q.error) throw q.error;
    const p = q.data;
    if (!p) {
      tugas = null; kosongkanMaklumatTugas();
      status.innerHTML = '<span class="status-error">Tiada tugasan hari ini.</span>';
      kemasKiniButangPelaporan(null); return null;
    }
    if (atas(p.status) === "DIGANTI") {
      tugas = null; kosongkanMaklumatTugas();
      status.innerHTML = '<span class="status-error"><strong>STATUS PETUGAS: DIGANTI</strong><br>Anda telah digantikan dengan petugas lain.</span>';
      el("btnCheckin").disabled = true; el("btnCheckout").disabled = true;
      el("btnCheckin").textContent = "CHECK-IN TIDAK DIBENARKAN";
      el("btnCheckout").textContent = "CHECK-OUT TIDAK DIBENARKAN";
      return null;
    }
    tugas = {
      status: true, id: p.id, callSign: p.call_sign || "-",
      jenisTugas: p.jenis_tugas || "-", lokasi: p.tempat_tugas || p.lokasi || "-",
      penyelia: nilaiBoolean(p.penyelia) ? "YA" : "TIDAK",
      pemegangSet: nilaiBoolean(p.pemegang_set) ? "YA" : "TIDAK",
      lat: Number(p.latitude ?? p.lat), lng: Number(p.longitude ?? p.lng),
      radius: Number(p.radius_meter ?? p.radius ?? 30), raw: p
    };
    el("callSignTugas").textContent = tugas.callSign;
    el("jenisTugas").textContent = tugas.jenisTugas;
    el("lokasiTugas").textContent = tugas.lokasi;
    el("penyeliaTugas").textContent = tugas.penyelia;
    el("pemegangSetTugas").textContent = tugas.pemegangSet;
    status.innerHTML = '<span class="status-success">Tugasan hari ini dijumpai.</span>';
    return tugas;
  } catch (err) {
    tugas = null; kosongkanMaklumatTugas();
    status.innerHTML = `<span class="status-error">Ralat mendapatkan tugasan: ${escapeHtml(err.message)}</span>`;
    return null;
  }
}

async function semakStatusCheckInPetugas() {
  if (!userLogin || !tugas) return;
  paparStatus("statusKehadiran", "Sedang menyemak status kehadiran...", "warning");
  try {
    const { data, error } = await db.from("checkin").select("*").eq("petugas_id", userLogin.id)
      .eq("tarikh", hariIniMalaysia()).order("masa_checkin", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    rekodCheckinSemasa = data || null;
    if (!data) {
      statusKehadiranSemasa = ""; sudahCheckOutSemasa = false;
      el("btnCheckin").disabled = false; el("btnCheckin").textContent = "CHECK-IN KEHADIRAN";
      paparStatus("statusKehadiran", "<strong>Status Kehadiran: BELUM HADIR</strong><br>Sila buat Check-In kehadiran.", "warning");
      el("btnCheckout").disabled = true; el("btnCheckout").textContent = "CHECK-OUT TIDAK DIBENARKAN";
      paparStatus("statusCheckout", "Check-Out hanya dibenarkan selepas Check-In disahkan.", "warning");
      kemasKiniButangPelaporan(tugas); return;
    }
    statusKehadiranSemasa = atas(data.status);
    const paparan = statusKehadiranSemasa === "MENUNGGU" ? "MENUNGGU PENGESAHAN URUSETIA" : statusKehadiranSemasa;
    el("btnCheckin").disabled = true; el("btnCheckin").textContent = "CHECK-IN TELAH DIREKODKAN";
    const jenis = statusKehadiranSemasa === "DITOLAK" ? "error" : statusKehadiranSemasa === "HADIR" ? "success" : "warning";
    paparStatus("statusKehadiran", `<strong>Check-In telah direkodkan.</strong><br>Masa: ${escapeHtml(formatTarikhMasa(data.masa_checkin))}<br>Status: ${escapeHtml(paparan)}`, jenis);
    await semakStatusCheckOutPetugas(); kemasKiniButangPelaporan(tugas);
  } catch (err) {
    paparStatus("statusKehadiran", `Ralat menyemak status: ${escapeHtml(err.message)}`, "error");
  }
}

async function semakStatusCheckOutPetugas() {
  if (!userLogin || !tugas) return;
  try {
    const { data, error } = await db.from("checkout").select("*").eq("petugas_id", userLogin.id)
      .eq("tarikh", hariIniMalaysia()).order("masa_checkout", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (data) {
      sudahCheckOutSemasa = true; el("btnCheckout").disabled = true;
      el("btnCheckout").textContent = "CHECK-OUT TELAH DIREKODKAN";
      paparStatus("statusCheckout", `<strong>Check-Out telah direkodkan.</strong><br>Masa: ${escapeHtml(formatTarikhMasa(data.masa_checkout))}<br>Tempoh Bertugas: ${escapeHtml(formatTempoh(data.tempoh_minit))}<br>Status: <strong>SELESAI TUGAS</strong>`, "success");
    } else if (statusKehadiranSemasa === "HADIR") {
      sudahCheckOutSemasa = false; el("btnCheckout").disabled = false;
      el("btnCheckout").textContent = "CHECK-OUT KEHADIRAN";
      paparStatus("statusCheckout", "Check-Out boleh dibuat selepas selesai tugas.", "warning");
    } else {
      sudahCheckOutSemasa = false; el("btnCheckout").disabled = true;
      el("btnCheckout").textContent = "CHECK-OUT TIDAK DIBENARKAN";
      paparStatus("statusCheckout", "Check-Out hanya dibenarkan selepas Check-In disahkan.", "warning");
    }
    kemasKiniButangPelaporan(tugas);
  } catch (err) { paparStatus("statusCheckout", `Ralat menyemak Check-Out: ${escapeHtml(err.message)}`, "error"); }
}

function formatTempoh(minit) {
  if (!Number.isFinite(Number(minit))) return "-";
  const m = Math.max(0, Number(minit)); return `${Math.floor(m / 60)} jam ${Math.round(m % 60)} minit`;
}
function petugasLayakHantarLaporan(t) {
  if (!t) return false;

  const ialahPenyelia = atas(t.penyelia) === "YA";
  const ialahPemegangSet = atas(t.pemegangSet) === "YA";
  const jenis = normalisasiJenisTugasPelaporan(t.jenisTugas);

  /*
    LITUPAN KESELAMATAN:
    Borang khas ini hanya dibenarkan kepada PENYELIA.
    Pemegang Set yang bukan Penyelia tidak diberi akses.
  */
  if (jenis === "LITUPAN KESELAMATAN") {
    return ialahPenyelia;
  }

  return ialahPenyelia || ialahPemegangSet;
}

function kemasKiniButangPelaporan(t) {
  const b = el("btnLaporan");
  const skrinLaporan = el("laporan");
  const ruangBorang = el("borangLaporanDinamik");

  if (!b) return;

  const jenis =
    t
      ? normalisasiJenisTugasPelaporan(t.jenisTugas)
      : "";

  const ialahLitupan =
    jenis === "LITUPAN KESELAMATAN";

  const layak =
    petugasLayakHantarLaporan(t);

  /*
    Jika bukan petugas yang layak:
    - Litupan Keselamatan mesti PENYELIA.
    - Jenis lain kekal Penyelia atau Pemegang Set.
  */
  if (!layak) {
    b.style.display = "none";
    b.disabled = true;
    b.textContent =
      ialahLitupan
        ? "LAPORAN LITUPAN KESELAMATAN"
        : "HANTAR PELAPORAN";

    if (ruangBorang) {
      ruangBorang.innerHTML = "";
    }

    if (skrinLaporan) {
      skrinLaporan.style.display = "none";
    }

    return;
  }

  b.style.display = "block";

  b.disabled =
    !(
      statusKehadiranSemasa === "HADIR" &&
      !sudahCheckOutSemasa
    );

  if (sudahCheckOutSemasa) {
    b.textContent =
      ialahLitupan
        ? "LAPORAN LITUPAN DITUTUP SELEPAS CHECK-OUT"
        : "PELAPORAN DITUTUP SELEPAS CHECK-OUT";

    return;
  }

  if (statusKehadiranSemasa !== "HADIR") {
    b.textContent =
      ialahLitupan
        ? "LAPORAN LITUPAN MENUNGGU PENGESAHAN URUSETIA"
        : "PELAPORAN MENUNGGU PENGESAHAN URUSETIA";

    return;
  }

  b.textContent =
    ialahLitupan
      ? "HANTAR LAPORAN LITUPAN KESELAMATAN"
      : "HANTAR PELAPORAN";
}

function mulaCheckin() { bukaSkrinGps("checkin"); }
function mulaCheckout() {
  if (statusKehadiranSemasa !== "HADIR" || sudahCheckOutSemasa) return alert("Check-Out tidak dibenarkan.");
  bukaSkrinGps("checkout");
}
function bukaSkrinGps(mod) {
  if (!tugas) return alert("Tiada tugasan yang sah untuk hari ini.");
  const keluar = mod === "checkout";
  if (keluar) { lokasiGPSCheckout = null; jarakCheckout = null; lokasiCheckoutDibenarkan = false; }
  else { lokasiGPS = null; jarakSemasa = null; lokasiDibenarkan = false; }
  el("dashboard").style.display = "none"; el(mod).style.display = "block";
  el(keluar ? "tugasCheckout" : "tugasCheckin").innerHTML =
    binaBarisMaklumat("Call Sign:", tugas.callSign) + binaBarisMaklumat("Jenis Tugas:", tugas.jenisTugas) +
    binaBarisMaklumat("Tempat Tugas:", tugas.lokasi) + (!keluar ? binaBarisMaklumat("Penyelia:", tugas.penyelia) + binaBarisMaklumat("Pemegang Set:", tugas.pemegangSet) : "");
  el(keluar ? "gpsStatusCheckout" : "gpsStatus").textContent = "Sila dapatkan lokasi GPS semasa.";
  el(keluar ? "koordinatCheckout" : "koordinat").innerHTML = "";
  el(keluar ? "jarakStatusCheckout" : "jarakStatus").innerHTML = "";
  const h = el(keluar ? "statusHantarCheckout" : "statusHantar"); h.style.display = "none"; h.innerHTML = "";
  el(keluar ? "btnDapatGPSCheckout" : "btnDapatGPS").disabled = false;
  el(keluar ? "btnHantarCheckout" : "btnHantar").disabled = true;
}

function dapatkanGPS() { dapatkanGpsUntuk(false); }
function dapatkanGPSCheckout() { dapatkanGpsUntuk(true); }
function dapatkanGpsUntuk(keluar) {
  const ids = keluar
    ? ["gpsStatusCheckout", "koordinatCheckout", "jarakStatusCheckout", "btnDapatGPSCheckout", "btnHantarCheckout"]
    : ["gpsStatus", "koordinat", "jarakStatus", "btnDapatGPS", "btnHantar"];
  const [s, k, j, g, h] = ids.map(el);

  if (!navigator.geolocation) {
    s.innerHTML = '<span class="status-error">Peranti / browser ini tidak menyokong lokasi GPS.</span>';
    return;
  }

  s.innerHTML = '<span class="status-warning"><strong>Mencari GPS terbaik...</strong><br>Sila tunggu sehingga bacaan stabil. Proses boleh mengambil sehingga 30 saat.</span>';
  k.innerHTML = "";
  j.innerHTML = "";
  g.disabled = true;
  h.disabled = true;

  let terbaik = null;
  let bilangan = 0;
  let selesai = false;
  let watchId = null;

  const simpanBacaan = (pos) => {
    bilangan += 1;
    const gps = {
      lat: Number(pos.coords.latitude),
      lng: Number(pos.coords.longitude),
      accuracy: Number(pos.coords.accuracy)
    };

    if (!Number.isFinite(gps.lat) || !Number.isFinite(gps.lng) || !Number.isFinite(gps.accuracy)) return;
    if (!terbaik || gps.accuracy < terbaik.accuracy) terbaik = gps;

    if (keluar) lokasiGPSCheckout = terbaik;
    else lokasiGPS = terbaik;

    k.innerHTML = `Latitude: ${terbaik.lat.toFixed(7)}<br>Longitude: ${terbaik.lng.toFixed(7)}<br><strong>Ketepatan terbaik: ±${terbaik.accuracy.toFixed(1)} meter</strong><br>Bacaan GPS: ${bilangan}`;
    s.innerHTML = terbaik.accuracy <= 30
      ? '<span class="status-success">GPS telah stabil dan bacaan terbaik diperoleh.</span>'
      : '<span class="status-warning">GPS diperoleh tetapi masih diperhalusi... Jangan tutup skrin ini.</span>';

    semakRadius(keluar);
    if (terbaik.accuracy <= 30) tamatCarian();
  };

  const tamatCarian = () => {
    if (selesai) return;
    selesai = true;
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    g.disabled = false;

    if (!terbaik) {
      s.innerHTML = '<span class="status-error">GPS tidak berjaya mendapatkan lokasi. Sila cuba semula di kawasan lebih terbuka.</span>';
      return;
    }

    if (terbaik.accuracy > HAD_KETEPATAN_GPS) {
      h.disabled = true;
      s.innerHTML = `<span class="status-error"><strong>GPS terlalu lemah (±${terbaik.accuracy.toFixed(1)} meter).</strong><br>Sila hidupkan Precise Location / Lokasi Tepat, pastikan Location Services aktif dan cuba semula.</span>`;
    } else {
      s.innerHTML = `<span class="status-success"><strong>GPS terbaik dipilih.</strong><br>Ketepatan: ±${terbaik.accuracy.toFixed(1)} meter.</span>`;
      semakRadius(keluar);
    }
  };

  const gagalGps = (err) => {
    if (selesai) return;
    selesai = true;
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    g.disabled = false;
    h.disabled = true;

    let mesej = "Lokasi tidak dapat dikesan.";
    if (err.code === 1) {
      mesej = "Kebenaran lokasi ditolak. iPhone: Settings > Privacy & Security > Location Services > Safari Websites > While Using dan hidupkan Precise Location. Kemudian kembali dan tekan CUBA GPS SEMULA.";
    } else if (err.code === 2) {
      mesej = "GPS belum mendapat lokasi. Pastikan Location Services, Wi-Fi/Data aktif dan cuba di kawasan lebih terbuka.";
    } else if (err.code === 3) {
      mesej = "GPS mengambil masa terlalu lama. Sila cuba semula dan tunggu sehingga bacaan stabil.";
    }
    s.innerHTML = `<span class="status-error">${escapeHtml(mesej)}</span>`;
  };

  watchId = navigator.geolocation.watchPosition(
    simpanBacaan,
    gagalGps,
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
  );

  setTimeout(tamatCarian, 30000);
}

function semakRadius(keluar) {
  const gps = keluar ? lokasiGPSCheckout : lokasiGPS;
  const jarakId = keluar ? "jarakStatusCheckout" : "jarakStatus";
  const butangId = keluar ? "btnHantarCheckout" : "btnHantar";
  const radius = Number(tugas?.radius || 30);

  if (!gps || !Number.isFinite(tugas?.lat) || !Number.isFinite(tugas?.lng)) {
    el(jarakId).innerHTML = '<span class="status-error">Koordinat lokasi tugas tidak sah.</span>';
    return;
  }

  const jarak = kiraJarakMeter(gps.lat, gps.lng, tugas.lat, tugas.lng);
  if (keluar) jarakCheckout = jarak; else jarakSemasa = jarak;

  /* Toleransi hanya mengambil sebahagian ketidakpastian GPS dan dihadkan 30m.
     Ini membantu GPS lemah tanpa membuka radius terlalu luas. */
  const toleransiGps = Math.min(Math.max(gps.accuracy * 0.5, 0), 30);
  const jarakDinilai = Math.max(0, jarak - toleransiGps);
  const ketepatanLulus = gps.accuracy <= HAD_KETEPATAN_GPS;
  const dibenar = ketepatanLulus && jarakDinilai <= radius;

  if (keluar) lokasiCheckoutDibenarkan = dibenar; else lokasiDibenarkan = dibenar;

  if (dibenar) {
    el(jarakId).innerHTML = `<span class="status-success"><strong>Lokasi berjaya disahkan.</strong><br>Jarak GPS: ${jarak.toFixed(1)} meter · Ketepatan: ±${gps.accuracy.toFixed(1)} meter · Radius tugas: ${radius} meter.</span>`;
  } else if (!ketepatanLulus) {
    el(jarakId).innerHTML = `<span class="status-warning"><strong>GPS belum cukup tepat.</strong><br>Ketepatan semasa ±${gps.accuracy.toFixed(1)} meter (maksimum ±${HAD_KETEPATAN_GPS} meter). Sistem sedang mencari bacaan lebih baik.</span>`;
  } else {
    el(jarakId).innerHTML = `<span class="status-error"><strong>Lokasi di luar kawasan tugas.</strong><br>Jarak GPS: ${jarak.toFixed(1)} meter · Radius tugas: ${radius} meter · Ketepatan: ±${gps.accuracy.toFixed(1)} meter.</span>`;
  }

  el(butangId).disabled = !dibenar;
}

async function hantarKehadiran() {
  if (sedangMenghantar || !lokasiGPS || !lokasiDibenarkan) return;
  sedangMenghantar = true; setProsesGps(false, true, "Sedang menyimpan rekod kehadiran...");
  const payload = {
    p_penugasan_id: tugas.id, p_latitude: lokasiGPS.lat, p_longitude: lokasiGPS.lng,
    p_ketepatan_gps: lokasiGPS.accuracy, p_device_id: dapatkanDeviceId()
  };
  try {
    let data;
    const rpc = await db.rpc("rekod_checkin_petugas", payload);
    if (rpc.error && rpcTiada(rpc.error)) {
      const ins = await db.from("checkin").insert({
        penugasan_id: tugas.id, petugas_id: userLogin.id, tarikh: hariIniMalaysia(),
        latitude: lokasiGPS.lat, longitude: lokasiGPS.lng, ketepatan_gps: lokasiGPS.accuracy,
        jarak_meter: jarakSemasa, device_id: dapatkanDeviceId(), status: "MENUNGGU"
      }).select("*").single();
      if (ins.error) throw ins.error; data = ins.data;
    } else { if (rpc.error) throw rpc.error; if (rpc.data?.success === false) throw new Error(rpc.data.message); data = rpc.data; }
    paparStatus("statusHantar", `<strong>Check-In berjaya dihantar.</strong><br>Status: MENUNGGU PENGESAHAN URUSETIA`, "success");
    el("btnHantar").textContent = "CHECK-IN BERJAYA";
    setTimeout(async () => { kembaliDashboard(); await refreshDashboard(); }, 1500);
    return data;
  } catch (err) { paparStatus("statusHantar", escapeHtml(err.message), "error"); setProsesGps(false, false); }
  finally { sedangMenghantar = false; }
}

async function hantarCheckout() {
  if (sedangMenghantarCheckout || !lokasiGPSCheckout || !lokasiCheckoutDibenarkan) return;
  sedangMenghantarCheckout = true; setProsesGps(true, true, "Sedang menyimpan rekod Check-Out...");
  try {
    const payload = {
      p_penugasan_id: tugas.id, p_latitude: lokasiGPSCheckout.lat, p_longitude: lokasiGPSCheckout.lng,
      p_ketepatan_gps: lokasiGPSCheckout.accuracy, p_device_id: dapatkanDeviceId()
    };
    const rpc = await db.rpc("rekod_checkout_petugas", payload);
    if (rpc.error && rpcTiada(rpc.error)) {
      const mula = new Date(rekodCheckinSemasa.masa_checkin).getTime();
      const tempoh = Number.isFinite(mula) ? Math.max(0, Math.round((Date.now() - mula) / 60000)) : null;
      const ins = await db.from("checkout").insert({
        checkin_id: rekodCheckinSemasa.id, penugasan_id: tugas.id, petugas_id: userLogin.id,
        tarikh: hariIniMalaysia(), latitude: lokasiGPSCheckout.lat, longitude: lokasiGPSCheckout.lng,
        ketepatan_gps: lokasiGPSCheckout.accuracy, jarak_meter: jarakCheckout,
        tempoh_minit: tempoh, status: "SELESAI TUGAS"
      }).select("*").single();
      if (ins.error) throw ins.error;
    } else { if (rpc.error) throw rpc.error; if (rpc.data?.success === false) throw new Error(rpc.data.message); }
    paparStatus("statusHantarCheckout", "<strong>Check-Out berjaya.</strong><br>Status: SELESAI TUGAS", "success");
    el("btnHantarCheckout").textContent = "CHECK-OUT BERJAYA";
    setTimeout(async () => { kembaliDashboardCheckout(); await refreshDashboard(); }, 1500);
  } catch (err) { paparStatus("statusHantarCheckout", escapeHtml(err.message), "error"); setProsesGps(true, false); }
  finally { sedangMenghantarCheckout = false; }
}
function rpcTiada(err) { return /does not exist|not found|PGRST202|schema cache/i.test(`${err?.code || ""} ${err?.message || ""}`); }
function setProsesGps(keluar, proses, mesej = "") {
  const h = el(keluar ? "btnHantarCheckout" : "btnHantar");
  const g = el(keluar ? "btnDapatGPSCheckout" : "btnDapatGPS");
  const k = el(keluar ? "btnKembaliCheckout" : "btnKembali");
  h.disabled = proses; g.disabled = proses; k.disabled = proses;
  h.textContent = proses ? "SEDANG MENGHANTAR..." : (keluar ? "HANTAR CHECK-OUT" : "HANTAR KEHADIRAN");
  if (mesej) paparStatus(keluar ? "statusHantarCheckout" : "statusHantar", mesej, "warning");
}

function normalisasiJenisTugasPelaporan(nilai) {
  const jenis = atas(nilai).replace(/\s+/g, " ").trim();

  if (jenis.includes("LITUPAN KESELAMATAN")) return "LITUPAN KESELAMATAN";
  if (jenis.includes("KAWALAN KESELAMATAN")) return "KAWALAN KESELAMATAN";
  if (jenis.includes("KAWALAN LALULINTAS") || jenis.includes("KAWALAN LALU LINTAS")) {
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
  if (jenis.includes("BALAI POLIS BERGERAK")) return "BALAI POLIS BERGERAK";
  if (jenis.includes("PONDOK POLIS")) return "PONDOK POLIS";
  if (jenis.includes("UNIT PEMUSNAH BOM")) return "UNIT PEMUSNAH BOM";
  if (jenis.includes("SUBTEK")) return "SUBTEK";

  return jenis;
}

function bukaLaporan() {
  if (!tugas) {
    alert("Maklumat tugasan tidak dijumpai.");
    return;
  }

  /* Perlindungan utama: hanya Penyelia atau Pemegang Set. */
  if (!petugasLayakHantarLaporan(tugas)) {
    const ruangBorang = el("borangLaporanDinamik");

    if (ruangBorang) ruangBorang.innerHTML = "";
    if (el("laporan")) el("laporan").style.display = "none";

    const jenis = normalisasiJenisTugasPelaporan(tugas.jenisTugas);

    alert(
      jenis === "LITUPAN KESELAMATAN"
        ? "Borang Litupan Keselamatan hanya disediakan kepada Penyelia."
        : "Borang pelaporan hanya disediakan kepada Penyelia atau Pemegang Set."
    );
    return;
  }

  if (statusKehadiranSemasa !== "HADIR" || sudahCheckOutSemasa) {
    alert("Pelaporan hanya dibenarkan selepas kehadiran disahkan dan sebelum Check-Out.");
    return;
  }

  el("dashboard").style.display = "none";
  el("laporan").style.display = "block";

  const jenisLaporan =
    normalisasiJenisTugasPelaporan(tugas.jenisTugas);

  const ialahLitupan =
    jenisLaporan === "LITUPAN KESELAMATAN";

  const ialahSubtek =
    jenisLaporan === "SUBTEK";

  const tajukLaporan =
    el("tajukLaporanPetugas");

  if (tajukLaporan) {
    tajukLaporan.textContent =
      ialahLitupan
        ? "Pelaporan Litupan Keselamatan"
        : ialahSubtek
          ? "Pelaporan SUBTEK"
          : "Pelaporan Petugas";
  }

  /*
    Pengguna meminta TARIKH tidak dipaparkan
    dalam Borang Litupan Keselamatan.
  */
  const blokTarikh =
    el("blokTarikhMasaLaporan");

  if (blokTarikh) {
    blokTarikh.style.display =
      ialahLitupan ? "none" : "block";
  }

  el("tugasLaporan").innerHTML =
    binaBarisMaklumat("Call Sign:", tugas.callSign) +
    binaBarisMaklumat("Jenis Tugas:", tugas.jenisTugas) +
    binaBarisMaklumat("Tempat Tugas:", tugas.lokasi) +
    binaBarisMaklumat("Penyelia:", tugas.penyelia);

  kemasKiniTarikhMasaLaporan();
  janaBorangPelaporan();

  const status = el("statusLaporan");
  if (status) {
    status.style.display = "none";
    status.innerHTML = "";
  }

  const btn = el("btnHantarLaporan");
  if (btn) {
    btn.disabled = false;
    btn.textContent =
      jenisLaporan === "LITUPAN KESELAMATAN"
        ? "HANTAR LAPORAN LITUPAN KESELAMATAN"
        : jenisLaporan === "SUBTEK"
          ? "HANTAR LAPORAN SUBTEK KEPADA URUSETIA"
          : "HANTAR LAPORAN KEPADA URUSETIA";
  }

  window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
}

function kemasKiniTarikhMasaLaporan() {
  const ruang = el("tarikhMasaLaporan");
  if (ruang) ruang.textContent = formatTarikhMasa(new Date());
}

function tutupLaporan() {
  el("laporan").style.display = "none";
  el("dashboard").style.display = "block";
}

function janaBorangPelaporan() {
  const ruang = el("borangLaporanDinamik");
  if (!ruang || !tugas) return;

  const jenis = normalisasiJenisTugasPelaporan(tugas.jenisTugas);

  switch (jenis) {
    case "LITUPAN KESELAMATAN":
      ruang.innerHTML = `
        <div class="litupan-report-header">
          <h2>Borang Litupan Keselamatan</h2>
          <p>
            Masukkan maklumat VVIP / VIP yang diliputi.
            Borang ini hanya boleh dihantar oleh Penyelia.
          </p>
        </div>

        <div class="litupan-grid">
          <div class="litupan-field">
            <label for="lapLitupanKategori">
              <strong>Kategori *</strong>
            </label>
            <select id="lapLitupanKategori">
              <option value="">-- PILIH --</option>
              <option value="VVIP">VVIP</option>
              <option value="VIP">VIP</option>
            </select>
          </div>

          <div class="litupan-field litupan-field-wide">
            <label for="lapLitupanNama">
              <strong>Nama *</strong>
            </label>
            <input
              id="lapLitupanNama"
              type="text"
              placeholder="Nama VVIP / VIP"
              autocomplete="off"
            >
          </div>

          <div class="litupan-field">
            <label for="lapLitupanJawatan">
              <strong>Jawatan</strong>
            </label>
            <input
              id="lapLitupanJawatan"
              type="text"
              placeholder="Contoh: MENTERI / KETUA JABATAN"
              autocomplete="off"
            >
          </div>

          <div class="litupan-field">
            <label for="lapLitupanAgensi">
              <strong>Agensi / Organisasi</strong>
            </label>
            <input
              id="lapLitupanAgensi"
              type="text"
              placeholder="Contoh: KDN / PDRM / ORGANISASI"
              autocomplete="off"
            >
          </div>

          <div class="litupan-field">
            <label for="lapLitupanMasaKetibaan">
              <strong>Masa Ketibaan</strong>
            </label>
            <input
              id="lapLitupanMasaKetibaan"
              type="time"
            >
          </div>

          <div class="litupan-field">
            <label for="lapLitupanMasaBeredar">
              <strong>Masa Beredar</strong>
            </label>
            <input
              id="lapLitupanMasaBeredar"
              type="time"
            >
          </div>

          <div class="litupan-field litupan-field-wide">
            <label for="lapLitupanLokasi">
              <strong>Lokasi</strong>
            </label>
            <input
              id="lapLitupanLokasi"
              type="text"
              placeholder="Contoh: PADDOCK / MAIN GRANDSTAND"
              autocomplete="off"
            >
          </div>

          <div class="litupan-field litupan-field-wide">
            <label for="lapLitupanTujuan">
              <strong>Tujuan / Aktiviti</strong>
            </label>
            <textarea
              id="lapLitupanTujuan"
              placeholder="Tujuan lawatan atau aktiviti..."
            ></textarea>
          </div>

          <div class="litupan-field litupan-field-wide">
            <label for="lapLitupanCatatan">
              <strong>Catatan</strong>
            </label>
            <textarea
              id="lapLitupanCatatan"
              placeholder="Catatan tambahan jika ada..."
            ></textarea>
          </div>
        </div>
      `;
      break;

    case "SUBTEK":
      ruang.innerHTML = `
        <div class="subtek-report-header">
          <h2>Borang Pelaporan SUBTEK</h2>
          <p>
            Masukkan maklumat situasi semasa SUBTEK untuk dihantar kepada Urusetia.
          </p>
        </div>

        <div class="subtek-grid">
          <div class="subtek-field subtek-field-wide">
            <label for="lapSubtekKeadaanKeselamatan">
              <strong>Keadaan Keselamatan *</strong>
            </label>
            <select id="lapSubtekKeadaanKeselamatan">
              <option value="">-- PILIH --</option>
              <option value="TERKAWAL">TERKAWAL</option>
              <option value="TIDAK TERKAWAL">TIDAK TERKAWAL</option>
            </select>
          </div>

          <div class="subtek-field subtek-field-wide">
            <label for="lapSubtekLokasi">
              <strong>Lokasi *</strong>
            </label>
            <input
              id="lapSubtekLokasi"
              type="text"
              placeholder="Contoh: PADDOCK / MAIN GRANDSTAND / SUBTEK"
              autocomplete="off"
            >
          </div>

          <div class="subtek-field subtek-field-wide">
            ${binaPilihanAdaTiada(
              "lapSubtekVvipVip",
              "VVIP / VIP",
              "Butiran VVIP / VIP",
              "Masukkan nama / jawatan VVIP atau VIP."
            )}
          </div>

          <div class="subtek-field">
            <label for="lapSubtekJumlahPengunjung">
              <strong>Jumlah Pengunjung *</strong>
            </label>
            <input
              id="lapSubtekJumlahPengunjung"
              type="number"
              min="0"
              step="1"
              value="0"
              inputmode="numeric"
            >
          </div>

          <div class="subtek-field">
            <label for="lapSubtekJumlahKenderaanPengunjung">
              <strong>Jumlah Kenderaan Pengunjung *</strong>
            </label>
            <input
              id="lapSubtekJumlahKenderaanPengunjung"
              type="number"
              min="0"
              step="1"
              value="0"
              inputmode="numeric"
            >
          </div>

          <div class="subtek-field subtek-field-wide">
            <label for="lapSubtekKeperluanBantuan">
              <strong>Keperluan Bantuan / Sokongan *</strong>
            </label>
            <textarea
              id="lapSubtekKeperluanBantuan"
              placeholder="Masukkan keperluan bantuan atau sokongan. Jika tiada, masukkan TIADA."
            ></textarea>
          </div>

          <div class="subtek-field subtek-field-wide">
            <label for="lapSubtekCatatan">
              <strong>Catatan *</strong>
            </label>
            <textarea
              id="lapSubtekCatatan"
              placeholder="Masukkan catatan. Jika tiada, masukkan TIADA."
            ></textarea>
          </div>
        </div>
      `;
      break;

    case "KAWALAN KESELAMATAN":
      ruang.innerHTML = `
        <h2>Borang Kawalan Keselamatan</h2>

        <label for="lapKeadaanKeselamatan"><strong>Keadaan Keselamatan</strong></label>
        <select id="lapKeadaanKeselamatan">
          <option value="">-- PILIH --</option>
          <option value="TERKAWAL">TERKAWAL</option>
          <option value="TIDAK TERKAWAL">TIDAK TERKAWAL</option>
        </select>

        <label for="lapJumlahPengunjung"><strong>Jumlah Pengunjung</strong></label>
        <input id="lapJumlahPengunjung" type="number" min="0" step="1" inputmode="numeric" placeholder="Contoh: 1500">

        <h3>Pecahan Kenderaan</h3>

        <label for="lapBas"><strong>Bas</strong></label>
        <input id="lapBas" type="number" min="0" step="1" value="0" inputmode="numeric" oninput="kiraJumlahKenderaanKeselamatan()">

        <label for="lapMotosikal"><strong>Motosikal</strong></label>
        <input id="lapMotosikal" type="number" min="0" step="1" value="0" inputmode="numeric" oninput="kiraJumlahKenderaanKeselamatan()">

        <label for="lapMotokar"><strong>Motokar</strong></label>
        <input id="lapMotokar" type="number" min="0" step="1" value="0" inputmode="numeric" oninput="kiraJumlahKenderaanKeselamatan()">

        <label for="lapJumlahKenderaan"><strong>Jumlah Kenderaan</strong></label>
        <input id="lapJumlahKenderaan" type="number" value="0" readonly>

        ${binaPilihanAdaTiada("lapVvipVip", "VVIP / VIP", "Butiran VVIP / VIP", "Masukkan nama / jawatan VVIP atau VIP.")}

        <label for="lapCatatan"><strong>Catatan</strong></label>
        <textarea id="lapCatatan" placeholder="Jika tiada, masukkan TIADA."></textarea>
      `;
      kiraJumlahKenderaanKeselamatan();
      break;

    case "KAWALAN LALULINTAS":
      ruang.innerHTML = `
        <h2>Borang Kawalan Lalulintas</h2>

        <label for="lapKeadaanTrafik"><strong>Keadaan Trafik</strong></label>
        <select id="lapKeadaanTrafik">
          <option value="">-- PILIH --</option>
          <option value="LANCAR">LANCAR</option>
          <option value="PERLAHAN">PERLAHAN</option>
          <option value="SESAK">SESAK</option>
        </select>

        <label for="lapJumlahKenderaan"><strong>Jumlah Kenderaan</strong></label>
        <input id="lapJumlahKenderaan" type="number" min="0" step="1" inputmode="numeric" placeholder="Contoh: 350">

        ${binaPilihanAdaTiada("lapKemalangan", "Kemalangan", "Butiran Kemalangan", "Masukkan butiran kemalangan.")}

        <label for="lapCatatanTindakan"><strong>Catatan / Tindakan</strong></label>
        <textarea id="lapCatatanTindakan" placeholder="Masukkan catatan atau tindakan yang telah diambil."></textarea>
      `;
      break;

    case "RONDAAN PENCEGAHAN JENAYAH":
    case "RONDAAN PENCEGAHAN JENAYAH NARKOTIK":
    case "RONDAAN PENCEGAHAN JENAYAH KOMERSIL":
      ruang.innerHTML = `
        <h2>${escapeHtml(jenis)}</h2>

        <label for="lapLokasiRondaan"><strong>Lokasi Rondaan</strong></label>
        <textarea id="lapLokasiRondaan" placeholder="Masukkan lokasi / kawasan rondaan."></textarea>

        <h3>Pemeriksaan</h3>

        <label for="lapPemeriksaanLelaki"><strong>Lelaki</strong></label>
        <input id="lapPemeriksaanLelaki" type="number" min="0" step="1" value="0" inputmode="numeric" oninput="kiraJumlahPemeriksaan()">

        <label for="lapPemeriksaanPerempuan"><strong>Perempuan</strong></label>
        <input id="lapPemeriksaanPerempuan" type="number" min="0" step="1" value="0" inputmode="numeric" oninput="kiraJumlahPemeriksaan()">

        <label for="lapJumlahPemeriksaan"><strong>Jumlah Pemeriksaan</strong></label>
        <input id="lapJumlahPemeriksaan" type="number" value="0" readonly>

        ${binaPilihanAdaTiada("lapTangkapan", "Tangkapan", "Butiran Tangkapan", "Masukkan butiran tangkapan.")}

        ${binaPilihanAdaTiada("lapRampasan", "Rampasan", "Butiran Rampasan", "Masukkan butiran rampasan.")}

        <label for="lapCatatanRepot"><strong>Catatan / No. Repot</strong></label>
        <textarea id="lapCatatanRepot" placeholder="Masukkan catatan dan No. Repot jika berkaitan. Jika tiada, masukkan TIADA."></textarea>
      `;
      kiraJumlahPemeriksaan();
      break;

    case "BALAI POLIS BERGERAK":
      ruang.innerHTML = `
        <h2>Borang Balai Polis Bergerak</h2>

        <label for="lapNoRepot"><strong>No. Repot</strong></label>
        <input id="lapNoRepot" type="text" placeholder="Jika tiada, masukkan TIADA.">

        <label for="lapCatatan"><strong>Catatan</strong></label>
        <textarea id="lapCatatan" placeholder="Jika tiada, masukkan TIADA."></textarea>
      `;
      break;

    case "PONDOK POLIS":
      ruang.innerHTML = `
        <h2>Borang Pondok Polis</h2>

        <label for="lapNoRepot"><strong>No. Repot</strong></label>
        <input id="lapNoRepot" type="text" placeholder="Jika tiada, masukkan TIADA.">

        <label for="lapCatatan"><strong>Catatan</strong></label>
        <textarea id="lapCatatan" placeholder="Jika tiada, masukkan TIADA."></textarea>
      `;
      break;

    case "UNIT PEMUSNAH BOM":
      ruang.innerHTML = `
        <h2>Borang Unit Pemusnah Bom</h2>

        <label for="lapLokasi"><strong>Lokasi</strong></label>
        <textarea id="lapLokasi" placeholder="Masukkan lokasi."></textarea>

        ${binaPilihanAdaTiada("lapVvipVip", "VVIP / VIP", "Butiran VVIP / VIP", "Masukkan nama / jawatan VVIP atau VIP.")}

        ${binaPilihanAdaTiada("lapAncaman", "Jenis Ancaman", "Butiran / Jenis Ancaman", "Masukkan jenis ancaman.")}

        <label for="lapCatatan"><strong>Catatan</strong></label>
        <textarea id="lapCatatan" placeholder="Masukkan catatan."></textarea>
      `;
      break;

    default:
      ruang.innerHTML = `
        <div class="status-box error" style="display:block">
          <strong>BORANG PELAPORAN TIDAK DIJUMPAI</strong><br><br>
          Jenis tugas: <strong>${escapeHtml(tugas.jenisTugas)}</strong><br><br>
          Sila hubungi Pentadbir.
        </div>
      `;
      el("btnHantarLaporan").disabled = true;
  }
}

function binaPilihanAdaTiada(id, label, labelButiran, placeholder) {
  return `
    <div class="laporan-pilihan">
      <label for="${escapeHtml(id)}Status"><strong>${escapeHtml(label)}</strong></label>
      <select id="${escapeHtml(id)}Status" onchange="ubahPaparanButiranLaporan('${escapeHtml(id)}')">
        <option value="TIADA">TIADA</option>
        <option value="ADA">ADA</option>
      </select>

      <div id="${escapeHtml(id)}ButiranBox" style="display:none;">
        <label for="${escapeHtml(id)}Butiran"><strong>${escapeHtml(labelButiran)}</strong></label>
        <textarea id="${escapeHtml(id)}Butiran" placeholder="${escapeHtml(placeholder)}"></textarea>
      </div>
    </div>
  `;
}

function ubahPaparanButiranLaporan(id) {
  const status = el(`${id}Status`);
  const box = el(`${id}ButiranBox`);
  const butiran = el(`${id}Butiran`);
  if (!status || !box) return;

  const ada = atas(status.value) === "ADA";
  box.style.display = ada ? "block" : "none";
  if (!ada && butiran) butiran.value = "";
}

function nomborBulatLaporan(id) {
  const ruang = el(id);
  if (!ruang) return 0;

  const nilai = Number(ruang.value);
  return Number.isInteger(nilai) && nilai >= 0 ? nilai : 0;
}

function kiraJumlahKenderaanKeselamatan() {
  const bas = nomborBulatLaporan("lapBas");
  const motosikal = nomborBulatLaporan("lapMotosikal");
  const motokar = nomborBulatLaporan("lapMotokar");
  const jumlah = bas + motosikal + motokar;

  if (el("lapJumlahKenderaan")) el("lapJumlahKenderaan").value = jumlah;
  return jumlah;
}

function kiraJumlahPemeriksaan() {
  const lelaki = nomborBulatLaporan("lapPemeriksaanLelaki");
  const perempuan = nomborBulatLaporan("lapPemeriksaanPerempuan");
  const jumlah = lelaki + perempuan;

  if (el("lapJumlahPemeriksaan")) el("lapJumlahPemeriksaan").value = jumlah;
  return jumlah;
}

function dapatkanAdaTiadaLaporan(id) {
  const status = atas(el(`${id}Status`)?.value) === "ADA" ? "ADA" : "TIADA";
  const butiran = status === "ADA" ? teks(el(`${id}Butiran`)?.value) : "";
  return { status, butiran };
}

function binaDataLaporan() {
  const jenis = normalisasiJenisTugasPelaporan(tugas?.jenisTugas);

  if (jenis === "LITUPAN KESELAMATAN") {
    const kategori =
      atas(el("lapLitupanKategori")?.value);

    const nama =
      teks(el("lapLitupanNama")?.value);

    const jawatan =
      teks(el("lapLitupanJawatan")?.value);

    const agensi =
      teks(el("lapLitupanAgensi")?.value);

    const masaKetibaan =
      teks(el("lapLitupanMasaKetibaan")?.value);

    const masaBeredar =
      teks(el("lapLitupanMasaBeredar")?.value);

    const lokasi =
      teks(el("lapLitupanLokasi")?.value);

    const tujuan =
      teks(el("lapLitupanTujuan")?.value);

    const catatan =
      teks(el("lapLitupanCatatan")?.value);

    if (!["VVIP", "VIP"].includes(kategori)) {
      throw new Error("Sila pilih Kategori VVIP atau VIP.");
    }

    if (!nama) {
      throw new Error("Sila masukkan nama VVIP / VIP.");
    }

    /*
      Tarikh tidak diminta dalam borang.
      Tarikh penghantaran akan direkod oleh pangkalan data
      melalui rekod pelaporan / created_at.
    */
    return {
      kategori,
      nama,
      jawatan,
      agensi_organisasi: agensi,
      masa_ketibaan: masaKetibaan,
      masa_beredar: masaBeredar,
      lokasi,
      tujuan_aktiviti: tujuan,
      catatan,

      /*
        Nilai ringkas ini memastikan Modul Carta VVIP/VIP
        sedia ada boleh mengenal pasti laporan ini.
      */
      vvip_vip: `${kategori} — ${nama}`,

      /*
        Maklumat penugasan disimpan bersama untuk kegunaan
        paparan Pentadbir/Urusetia jika diperlukan.
      */
      petugas: {
        id: userLogin?.id || null,
        no_badan: userLogin?.noBadan || "",
        pangkat: userLogin?.pangkat || "",
        nama: userLogin?.nama || ""
      },

      penugasan: {
        id: tugas?.id || null,
        call_sign: tugas?.callSign || "",
        jenis_tugas: tugas?.jenisTugas || "",
        tempat_tugas: tugas?.lokasi || "",
        penyelia: tugas?.penyelia || ""
      }
    };
  }

  if (jenis === "SUBTEK") {
    const keadaanKeselamatan =
      atas(
        el(
          "lapSubtekKeadaanKeselamatan"
        )?.value
      );

    const lokasi =
      teks(
        el(
          "lapSubtekLokasi"
        )?.value
      );

    const vvipVip =
      dapatkanAdaTiadaLaporan(
        "lapSubtekVvipVip"
      );

    const jumlahPengunjung =
      Number(
        el(
          "lapSubtekJumlahPengunjung"
        )?.value
      );

    const jumlahKenderaanPengunjung =
      Number(
        el(
          "lapSubtekJumlahKenderaanPengunjung"
        )?.value
      );

    const keperluanBantuanSokongan =
      teks(
        el(
          "lapSubtekKeperluanBantuan"
        )?.value
      );

    const catatan =
      teks(
        el(
          "lapSubtekCatatan"
        )?.value
      );

    if (!keadaanKeselamatan) {
      throw new Error(
        "Sila pilih Keadaan Keselamatan."
      );
    }

    if (!lokasi) {
      throw new Error(
        "Sila masukkan Lokasi."
      );
    }

    if (
      vvipVip.status === "ADA" &&
      !vvipVip.butiran
    ) {
      throw new Error(
        "Sila masukkan butiran VVIP / VIP."
      );
    }

    if (
      !Number.isInteger(
        jumlahPengunjung
      ) ||
      jumlahPengunjung < 0
    ) {
      throw new Error(
        "Sila masukkan Jumlah Pengunjung yang sah."
      );
    }

    if (
      !Number.isInteger(
        jumlahKenderaanPengunjung
      ) ||
      jumlahKenderaanPengunjung < 0
    ) {
      throw new Error(
        "Sila masukkan Jumlah Kenderaan Pengunjung yang sah."
      );
    }

    if (!keperluanBantuanSokongan) {
      throw new Error(
        "Sila masukkan Keperluan Bantuan / Sokongan. Jika tiada, masukkan TIADA."
      );
    }

    if (!catatan) {
      throw new Error(
        "Sila masukkan Catatan. Jika tiada, masukkan TIADA."
      );
    }

    return {
      keadaan_keselamatan:
        keadaanKeselamatan,

      lokasi,

      vvip_vip:
        vvipVip,

      jumlah_pengunjung:
        jumlahPengunjung,

      jumlah_kenderaan_pengunjung:
        jumlahKenderaanPengunjung,

      keperluan_bantuan_sokongan:
        keperluanBantuanSokongan,

      catatan
    };
  }

  if (jenis === "KAWALAN KESELAMATAN") {
    const keadaan = atas(el("lapKeadaanKeselamatan")?.value);
    const jumlahPengunjung = Number(el("lapJumlahPengunjung")?.value);
    const bas = nomborBulatLaporan("lapBas");
    const motosikal = nomborBulatLaporan("lapMotosikal");
    const motokar = nomborBulatLaporan("lapMotokar");
    const jumlahKenderaan = kiraJumlahKenderaanKeselamatan();
    const vvipVip = dapatkanAdaTiadaLaporan("lapVvipVip");
    const catatan = teks(el("lapCatatan")?.value);

    if (!keadaan) throw new Error("Sila pilih keadaan keselamatan.");
    if (!Number.isInteger(jumlahPengunjung) || jumlahPengunjung < 0) {
      throw new Error("Sila masukkan jumlah pengunjung yang sah.");
    }
    if (vvipVip.status === "ADA" && !vvipVip.butiran) {
      throw new Error("Sila masukkan butiran VVIP / VIP.");
    }
    if (!catatan) throw new Error("Sila masukkan catatan. Jika tiada, masukkan TIADA.");

    return {
      keadaan_keselamatan: keadaan,
      jumlah_pengunjung: jumlahPengunjung,
      kenderaan: { bas, motosikal, motokar, jumlah: jumlahKenderaan },
      vvip_vip: vvipVip,
      catatan
    };
  }

  if (jenis === "KAWALAN LALULINTAS") {
    const keadaanTrafik = atas(el("lapKeadaanTrafik")?.value);
    const jumlahKenderaan = Number(el("lapJumlahKenderaan")?.value);
    const kemalangan = dapatkanAdaTiadaLaporan("lapKemalangan");
    const catatanTindakan = teks(el("lapCatatanTindakan")?.value);

    if (!keadaanTrafik) throw new Error("Sila pilih keadaan trafik.");
    if (!Number.isInteger(jumlahKenderaan) || jumlahKenderaan < 0) {
      throw new Error("Sila masukkan jumlah kenderaan yang sah.");
    }
    if (kemalangan.status === "ADA" && !kemalangan.butiran) {
      throw new Error("Sila masukkan butiran kemalangan.");
    }
    if (!catatanTindakan) throw new Error("Sila masukkan catatan / tindakan.");

    return {
      keadaan_trafik: keadaanTrafik,
      jumlah_kenderaan: jumlahKenderaan,
      kemalangan,
      catatan_tindakan: catatanTindakan
    };
  }

  if (
    jenis === "RONDAAN PENCEGAHAN JENAYAH" ||
    jenis === "RONDAAN PENCEGAHAN JENAYAH NARKOTIK" ||
    jenis === "RONDAAN PENCEGAHAN JENAYAH KOMERSIL"
  ) {
    const lokasi = teks(el("lapLokasiRondaan")?.value);
    const lelaki = nomborBulatLaporan("lapPemeriksaanLelaki");
    const perempuan = nomborBulatLaporan("lapPemeriksaanPerempuan");
    const jumlah = kiraJumlahPemeriksaan();
    const tangkapan = dapatkanAdaTiadaLaporan("lapTangkapan");
    const rampasan = dapatkanAdaTiadaLaporan("lapRampasan");
    const catatanRepot = teks(el("lapCatatanRepot")?.value);

    if (!lokasi) throw new Error("Sila masukkan lokasi rondaan.");
    if (tangkapan.status === "ADA" && !tangkapan.butiran) {
      throw new Error("Sila masukkan butiran tangkapan.");
    }
    if (rampasan.status === "ADA" && !rampasan.butiran) {
      throw new Error("Sila masukkan butiran rampasan.");
    }
    if (!catatanRepot) {
      throw new Error("Sila masukkan catatan / No. Repot. Jika tiada, masukkan TIADA.");
    }

    return {
      lokasi_rondaan: lokasi,
      pemeriksaan: { lelaki, perempuan, jumlah },
      tangkapan,
      rampasan,
      catatan_no_repot: catatanRepot
    };
  }

  if (jenis === "BALAI POLIS BERGERAK" || jenis === "PONDOK POLIS") {
    const noRepot = teks(el("lapNoRepot")?.value);
    const catatan = teks(el("lapCatatan")?.value);

    if (!noRepot) throw new Error("Sila masukkan No. Repot. Jika tiada, masukkan TIADA.");
    if (!catatan) throw new Error("Sila masukkan catatan.");

    return { no_repot: noRepot, catatan };
  }

  if (jenis === "UNIT PEMUSNAH BOM") {
    const lokasi = teks(el("lapLokasi")?.value);
    const vvipVip = dapatkanAdaTiadaLaporan("lapVvipVip");
    const ancaman = dapatkanAdaTiadaLaporan("lapAncaman");
    const catatan = teks(el("lapCatatan")?.value);

    if (!lokasi) throw new Error("Sila masukkan lokasi.");
    if (vvipVip.status === "ADA" && !vvipVip.butiran) {
      throw new Error("Sila masukkan butiran VVIP / VIP.");
    }
    if (ancaman.status === "ADA" && !ancaman.butiran) {
      throw new Error("Sila masukkan jenis ancaman.");
    }
    if (!catatan) throw new Error("Sila masukkan catatan.");

    return { lokasi, vvip_vip: vvipVip, jenis_ancaman: ancaman, catatan };
  }

  throw new Error(`Borang bagi jenis tugas "${tugas?.jenisTugas || "-"}" belum disediakan.`);
}

async function hantarLaporan() {
  const btn = el("btnHantarLaporan");

  const jenisSemasa =
    normalisasiJenisTugasPelaporan(
      tugas?.jenisTugas
    );

  /*
    Perlindungan pada masa submit juga.
    Litupan Keselamatan mesti PENYELIA.
  */
  if (
    jenisSemasa === "LITUPAN KESELAMATAN" &&
    atas(tugas?.penyelia) !== "YA"
  ) {
    paparStatus(
      "statusLaporan",
      "Borang Litupan Keselamatan hanya boleh dihantar oleh Penyelia.",
      "error"
    );
    return;
  }

  if (!petugasLayakHantarLaporan(tugas) || statusKehadiranSemasa !== "HADIR" || sudahCheckOutSemasa) {
    paparStatus("statusLaporan", "Pelaporan tidak dibenarkan.", "error");
    return;
  }

  let dataLaporan;
  try {
    dataLaporan = binaDataLaporan();
  } catch (err) {
    paparStatus("statusLaporan", escapeHtml(err.message), "error");
    return;
  }

  if (!confirm("Adakah anda pasti mahu menghantar laporan ini kepada URUSETIA?")) return;

  btn.disabled = true;
  btn.textContent = "SEDANG MENGHANTAR...";
  paparStatus("statusLaporan", "Sedang menghantar laporan...", "warning");

  try {
    const jenis = normalisasiJenisTugasPelaporan(tugas.jenisTugas);

    const payload = {
      penugasan_id: tugas.id,
      petugas_id: userLogin.id,
      jenis_tugas: jenis,
      data_laporan: dataLaporan
    };

    /* Kekalkan kolum lama untuk keserasian sementara dengan paparan Urusetia/Admin lama. */
    if (jenis === "LITUPAN KESELAMATAN") {
      payload.jumlah_pengunjung = 0;
      payload.jumlah_kenderaan = 0;

      /*
        Carta VVIP/VIP sedia ada boleh terus membaca rekod ini.
      */
      payload.vvip_vip =
        `${dataLaporan.kategori} — ${dataLaporan.nama}`;

      payload.perkara_menarik =
        dataLaporan.catatan ||
        dataLaporan.tujuan_aktiviti ||
        "";

    } else if (jenis === "SUBTEK") {
      payload.jumlah_pengunjung =
        dataLaporan.jumlah_pengunjung;

      payload.jumlah_kenderaan =
        dataLaporan.jumlah_kenderaan_pengunjung;

      payload.vvip_vip =
        dataLaporan.vvip_vip.status === "ADA"
          ? dataLaporan.vvip_vip.butiran
          : "TIADA";

      payload.perkara_menarik =
        dataLaporan.catatan;

    } else if (jenis === "KAWALAN KESELAMATAN") {
      payload.jumlah_pengunjung = dataLaporan.jumlah_pengunjung;
      payload.jumlah_kenderaan = dataLaporan.kenderaan.jumlah;
      payload.vvip_vip = dataLaporan.vvip_vip.status === "ADA" ? dataLaporan.vvip_vip.butiran : "TIADA";
      payload.perkara_menarik = dataLaporan.catatan;
    } else if (jenis === "KAWALAN LALULINTAS") {
      payload.jumlah_pengunjung = 0;
      payload.jumlah_kenderaan = dataLaporan.jumlah_kenderaan;
      payload.vvip_vip = "TIADA";
      payload.perkara_menarik = dataLaporan.catatan_tindakan;
    } else {
      payload.jumlah_pengunjung = 0;
      payload.jumlah_kenderaan = 0;
      payload.vvip_vip = "TIADA";
      payload.perkara_menarik = dataLaporan.catatan || dataLaporan.catatan_no_repot || "";
    }

    const { error } = await db.from("pelaporan").insert(payload);
    if (error) throw error;

    paparStatus("statusLaporan", "<strong>LAPORAN BERJAYA DIHANTAR.</strong>", "success");
    btn.textContent = "LAPORAN TELAH DIHANTAR";

    setTimeout(() => tutupLaporan(), 1800);

  } catch (err) {
    console.error("Ralat menghantar laporan:", err);
    btn.disabled = false;
    btn.textContent =
      jenisSemasa === "LITUPAN KESELAMATAN"
        ? "HANTAR LAPORAN LITUPAN KESELAMATAN"
        : jenisSemasa === "SUBTEK"
          ? "HANTAR LAPORAN SUBTEK KEPADA URUSETIA"
          : "HANTAR LAPORAN KEPADA URUSETIA";

    paparStatus("statusLaporan", `Ralat menghantar laporan: ${escapeHtml(err.message)}`, "error");
  }
}


/* ================================================================
   PASS & KENDERAAN PETUGAS — FIX 005
   Petugas mengisi No. Siri PASS dan No. Kenderaan sendiri.
   Draf input dikekalkan semasa auto-refresh dashboard.
================================================================ */
let drafPassKenderaanPetugas = { noSiriPass: "", noKenderaan: "", sedangEdit: false };

function simpanDrafPassKenderaanDaripadaInput() {
  const inputPass = el("noSiriPassPetugas");
  const inputKenderaan = el("noKenderaanPetugas");
  if (!inputPass || !inputKenderaan) return;
  drafPassKenderaanPetugas.noSiriPass = inputPass.value;
  drafPassKenderaanPetugas.noKenderaan = inputKenderaan.value;
}

function tandaDrafPassKenderaanBerubah() {
  drafPassKenderaanPetugas.sedangEdit = true;
  simpanDrafPassKenderaanDaripadaInput();
}
function sediakanModulPassKenderaanPetugas() {
  if (el("modulPassKenderaanPetugas")) return;
  const btnCheckout = el("btnCheckout");
  if (!btnCheckout) return;
  const seksyen = document.createElement("section");
  seksyen.id = "modulPassKenderaanPetugas";
  seksyen.className = "walkie-card";
  seksyen.style.marginTop = "16px";
  seksyen.innerHTML = `
    <div class="walkie-header">
      <div>
        <h2>Maklumat Pas & Kenderaan</h2>
        <p>Isi No. Siri Pas dan No. Kenderaan untuk penugasan hari ini.</p>
      </div>
    </div>
    <div class="info-box" style="margin-bottom:12px">
      <div class="info-row"><div class="info-label">Tarikh Penugasan:</div><div class="info-value" id="tarikhPassKenderaan">-</div></div>
      <div class="info-row"><div class="info-label">No. Badan:</div><div class="info-value" id="noBadanPassKenderaan">-</div></div>
      <div class="info-row"><div class="info-label">Pangkat:</div><div class="info-value" id="pangkatPassKenderaan">-</div></div>
      <div class="info-row"><div class="info-label">Nama:</div><div class="info-value" id="namaPassKenderaan">-</div></div>
      <div class="info-row"><div class="info-label">No. Siri Pas:</div><div class="info-value" id="paparanNoSiriPassKenderaan">-</div></div>
      <div class="info-row"><div class="info-label">No. Kenderaan:</div><div class="info-value" id="paparanNoKenderaanPassKenderaan">-</div></div>
    </div>
    <div id="borangPassKenderaanPetugas">
      <label for="noSiriPassPetugas"><strong>No. Siri Pas</strong></label>
      <input id="noSiriPassPetugas" type="text" placeholder="Contoh: F1-0045" autocomplete="off" oninput="tandaDrafPassKenderaanBerubah()" style="text-transform:uppercase;margin-bottom:10px">
      <label for="noKenderaanPetugas"><strong>No. Kenderaan</strong></label>
      <input id="noKenderaanPetugas" type="text" placeholder="Contoh: VAB 1234" autocomplete="off" oninput="tandaDrafPassKenderaanBerubah()" style="text-transform:uppercase;margin-bottom:10px">
      <button id="btnSimpanPassKenderaan" type="button" onclick="simpanPassKenderaanPetugas()">SIMPAN MAKLUMAT</button>
      <button id="btnBatalEditPassKenderaan" class="secondary" type="button" onclick="batalEditPassKenderaanPetugas()" style="display:none;margin-top:8px">BATAL</button>
    </div>
    <div id="tindakanPassKenderaanPetugas" style="display:none">
      <button id="btnEditPassKenderaan" type="button" onclick="mulaEditPassKenderaanPetugas()">KEMAS KINI MAKLUMAT</button>
    </div>
    <div class="status-box" id="statusPassKenderaanPetugas" role="status" aria-live="polite" style="display:none"></div>
  `;
  btnCheckout.insertAdjacentElement("afterend", seksyen);
}

function tetapkanModEditPassKenderaan(adaRekod, sedangEdit = false) {
  const borang = el("borangPassKenderaanPetugas");
  const tindakan = el("tindakanPassKenderaanPetugas");
  const batal = el("btnBatalEditPassKenderaan");
  const simpan = el("btnSimpanPassKenderaan");
  if (!borang || !tindakan) return;

  if (!adaRekod || sedangEdit) {
    borang.style.display = "block";
    tindakan.style.display = "none";
    if (batal) batal.style.display = adaRekod ? "block" : "none";
    if (simpan) simpan.textContent = adaRekod ? "SIMPAN PERUBAHAN" : "SIMPAN MAKLUMAT";
  } else {
    borang.style.display = "none";
    tindakan.style.display = "block";
  }
}

function mulaEditPassKenderaanPetugas() {
  drafPassKenderaanPetugas.sedangEdit = true;
  tetapkanModEditPassKenderaan(true, true);
  el("noSiriPassPetugas")?.focus();
}

async function batalEditPassKenderaanPetugas() {
  drafPassKenderaanPetugas.sedangEdit = false;
  const status = el("statusPassKenderaanPetugas");
  if (status) { status.style.display = "none"; status.innerHTML = ""; }
  await muatPassKenderaanPetugas();
}

function paparModulPassKenderaanPetugas(aktif) {
  sediakanModulPassKenderaanPetugas();
  const modul = el("modulPassKenderaanPetugas");
  if (!modul) return;
  modul.style.display = aktif ? "block" : "none";
  if (aktif) {
    el("tarikhPassKenderaan").textContent = hariIniMalaysia();
    el("noBadanPassKenderaan").textContent = userLogin?.noBadan || "-";
    el("pangkatPassKenderaan").textContent = userLogin?.pangkat || "-";
    el("namaPassKenderaan").textContent = userLogin?.nama || "-";
  }
}

async function muatPassKenderaanPetugas() {
  paparModulPassKenderaanPetugas(Boolean(userLogin && tugas));
  if (!userLogin || !tugas) return;
  const status = el("statusPassKenderaanPetugas");
  try {
    const { data, error } = await db.from("pass_kenderaan_petugas")
      .select("*")
      .eq("petugas_id", userLogin.id)
      .eq("tarikh_penugasan", hariIniMalaysia())
      .maybeSingle();
    if (error) throw error;
    // Jangan timpa nilai yang sedang ditaip apabila auto-refresh 15 saat berjalan.
    if (drafPassKenderaanPetugas.sedangEdit) {
      el("noSiriPassPetugas").value = drafPassKenderaanPetugas.noSiriPass;
      el("noKenderaanPetugas").value = drafPassKenderaanPetugas.noKenderaan;
    } else {
      el("noSiriPassPetugas").value = data?.no_siri_pass || "";
      el("noKenderaanPetugas").value = data?.no_kenderaan || "";
      drafPassKenderaanPetugas.noSiriPass = data?.no_siri_pass || "";
      drafPassKenderaanPetugas.noKenderaan = data?.no_kenderaan || "";
    }
    el("paparanNoSiriPassKenderaan").textContent = data?.no_siri_pass || "-";
    el("paparanNoKenderaanPassKenderaan").textContent = data?.no_kenderaan || "-";

    if (data) {
      // Rekod yang telah disimpan dipaparkan terus di bawah Nama.
      // Kotak hijau kejayaan tidak lagi diperlukan.
      status.style.display = "none";
      status.innerHTML = "";
      tetapkanModEditPassKenderaan(true, drafPassKenderaanPetugas.sedangEdit);
    } else {
      status.style.display = "none";
      status.innerHTML = "";
      tetapkanModEditPassKenderaan(false, true);
    }
  } catch (err) {
    paparStatus("statusPassKenderaanPetugas", `Ralat mendapatkan maklumat PASS/Kenderaan: ${escapeHtml(err.message)}`, "error");
  }
}

async function simpanPassKenderaanPetugas() {
  if (!userLogin || !tugas) return alert("Tiada penugasan yang sah untuk hari ini.");
  const noSiri = atas(el("noSiriPassPetugas")?.value);
  const noKenderaan = atas(el("noKenderaanPetugas")?.value);
  if (!noSiri || !noKenderaan) return paparStatus("statusPassKenderaanPetugas", "Sila isi No. Siri PASS dan No. Kenderaan.", "error");
  const btn = el("btnSimpanPassKenderaan");
  btn.disabled = true; btn.textContent = "SEDANG MENYIMPAN...";
  try {
    const payload = {
      tarikh_penugasan: hariIniMalaysia(),
      petugas_id: userLogin.id,
      no_badan: atas(userLogin.noBadan),
      pangkat: atas(userLogin.pangkat),
      nama: atas(userLogin.nama),
      no_siri_pass: noSiri,
      no_kenderaan: noKenderaan,
      updated_at: new Date().toISOString()
    };
    const { error } = await db.from("pass_kenderaan_petugas")
      .upsert(payload, { onConflict: "tarikh_penugasan,petugas_id" });
    if (error) {
      if (/pass_kenderaan_no_siri_tarikh_key|duplicate key|unique/i.test(error.message || "")) {
        throw new Error(`No. Siri PASS ${noSiri} telah digunakan oleh petugas lain pada tarikh ini.`);
      }
      throw error;
    }
    drafPassKenderaanPetugas = { noSiriPass: noSiri, noKenderaan, sedangEdit: false };
    el("noSiriPassPetugas").value = noSiri;
    el("noKenderaanPetugas").value = noKenderaan;
    el("paparanNoSiriPassKenderaan").textContent = noSiri;
    el("paparanNoKenderaanPassKenderaan").textContent = noKenderaan;
    const statusPass = el("statusPassKenderaanPetugas");
    if (statusPass) {
      statusPass.style.display = "none";
      statusPass.innerHTML = "";
    }
    btn.textContent = "SIMPAN PERUBAHAN";
    tetapkanModEditPassKenderaan(true, false);
  } catch (err) {
    paparStatus("statusPassKenderaanPetugas", `Gagal menyimpan: ${escapeHtml(err.message)}`, "error");
  } finally { btn.disabled = false; if (btn.textContent === "SEDANG MENYIMPAN...") btn.textContent = "SIMPAN MAKLUMAT"; }
}

async function refreshDashboard() {
  if (!userLogin) return;
  const b = el("btnRefreshStatus"); if (b) { b.disabled = true; b.textContent = "SEDANG MENYEMAK..."; }
  try {
    const ada = await dapatkanTugasHariIni();
    if (ada) await semakStatusCheckInPetugas();
    await muatPassKenderaanPetugas();
    if (window.SKPOWalkie?.muatSemula) await window.SKPOWalkie.muatSemula();
  } finally { if (b) { b.disabled = false; b.textContent = "SEMAK SEMULA STATUS"; } }
}
function mulaSemakanStatusAutomatik() {
  hentikanSemakanStatusAutomatik();
  timerSemakStatus = setInterval(() => {
    if (userLogin && el("dashboard")?.style.display === "block") refreshDashboard();
  }, SELANG_SEMAKAN_STATUS);
}
function hentikanSemakanStatusAutomatik() { if (timerSemakStatus) clearInterval(timerSemakStatus); timerSemakStatus = null; }
function kembaliDashboard() { el("checkin").style.display = "none"; el("dashboard").style.display = "block"; }
function kembaliDashboardCheckout() { el("checkout").style.display = "none"; el("dashboard").style.display = "block"; }

/* PAPARAN PETA OPERASI */
let skalaPeta = 1;

/*
  Versi peta digunakan untuk memecahkan cache browser / PWA.
  Tukar nilai ini setiap kali images/peta.png diganti di GitHub.
*/
const VERSI_PETA_OPERASI = "20260929-001";

function muatSemulaPetaOperasi() {
  const imej = el("imejPeta");
  if (!imej) return;

  const srcBaharu = `images/peta.png?v=${encodeURIComponent(VERSI_PETA_OPERASI)}`;

  /* Elak reload berulang jika versi yang sama sudah dipaparkan. */
  const srcSemasa = imej.getAttribute("src") || "";
  if (srcSemasa !== srcBaharu) {
    imej.src = srcBaharu;
  }
}

function bukaPeta() {
  const modal = el("modalPeta");
  if (!modal) return;

  /* Pastikan peta terkini diminta, bukan salinan cache lama. */
  muatSemulaPetaOperasi();

  resetZumPeta();
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("peta-terbuka");
}

function tutupPeta() {
  const modal = el("modalPeta");
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("peta-terbuka");
  el("btnPaparPeta")?.focus();
}

function paparSkalaPeta() {
  const imej = el("imejPeta");
  const status = el("statusPeta");
  if (imej) imej.style.width = `${Math.round(skalaPeta * 100)}%`;
  if (status) {
    status.textContent = `Zum: ${Math.round(skalaPeta * 100)}%`;
    status.classList.remove("error");
  }
}

function ubahZumPeta(perubahan) {
  skalaPeta = Math.min(3, Math.max(0.5, skalaPeta + perubahan));
  paparSkalaPeta();
}

function resetZumPeta() {
  skalaPeta = 1;
  paparSkalaPeta();
  const ruang = el("ruangPeta");
  if (ruang) { ruang.scrollTop = 0; ruang.scrollLeft = 0; }
}

function petaBerjayaDimuatkan() { paparSkalaPeta(); }

function petaGagalDimuatkan() {
  const status = el("statusPeta");
  if (!status) return;
  status.textContent = "Peta belum ditemui. Muat naik fail images/peta.png ke GitHub.";
  status.classList.add("error");
}

async function logout() {
  tutupPeta();
  hentikanSemakanStatusAutomatik(); await db.auth.signOut().catch(() => {}); localStorage.removeItem(KUNCI_USER_F1);
  userLogin = tugas = lokasiGPS = lokasiGPSCheckout = rekodCheckinSemasa = null;
  ["dashboard", "checkin", "checkout", "laporan"].forEach(id => { if (el(id)) el(id).style.display = "none"; });
  const loginBox = el("loginBox");
  if (loginBox) {
    loginBox.style.removeProperty("display");
    loginBox.classList.add("login-visible");
  }
  el("password").value = "";
  el("status").innerHTML = "";
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
}
function kosongkanMaklumatTugas() { ["callSignTugas", "jenisTugas", "lokasiTugas", "penyeliaTugas", "pemegangSetTugas"].forEach(id => el(id).textContent = "-"); }
function binaBarisMaklumat(label, nilai) { return `<div class="info-row"><div class="info-label">${escapeHtml(label)}</div><div class="info-value">${escapeHtml(nilai || "-")}</div></div>`; }
function kiraJarakMeter(lat1, lng1, lat2, lng2) {
  const R = 6371000, dLat = darjahKeRadian(lat2 - lat1), dLng = darjahKeRadian(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(darjahKeRadian(lat1)) * Math.cos(darjahKeRadian(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function darjahKeRadian(v) { return v * Math.PI / 180; }


/* ================================================================
   MUAT TURUN JADUAL FORMULA 1
   Kategori: TUGAS AM / BSJ / BSJN / BSJK / CAW. KHAS
   Fail PDF disimpan di folder: jadual/
================================================================ */

const JADUAL_F1_TARIKH = [
  { nilai: "02102026", label: "02/10/2026" },
  { nilai: "03102026", label: "03/10/2026" },
  { nilai: "04102026", label: "04/10/2026" }
];

const JADUAL_F1_KATEGORI = [
  { nilai: "TUGAS AM", label: "Tugas AM", fail: "TUGAS AM" },
  { nilai: "BSJ", label: "BSJ", fail: "BSJ" },
  { nilai: "BSJN", label: "BSJN", fail: "BSJN" },
  { nilai: "BSJK", label: "BSJK", fail: "BSJK" },
  { nilai: "CAW KHAS", label: "Caw. Khas", fail: "CAW KHAS" }
];

function pasangModulMuatTurunJadual() {
  if (document.getElementById("btnMuatTurunJadual")) return;

  const btnPeta = document.getElementById("btnPaparPeta");
  if (!btnPeta) return;

  const gaya = document.createElement("style");
  gaya.id = "gayaMuatTurunJadualF1";
  gaya.textContent = `
    .schedule-download-button{
      width:100%;margin-top:10px;padding:14px 16px;border:0;border-radius:6px;
      background:#c89b2c;color:#111;font-weight:800;font-size:15px;cursor:pointer;
    }
    .schedule-download-button:hover{filter:brightness(1.08)}
    .jadual-modal{
      position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.78);
      display:flex;align-items:center;justify-content:center;padding:18px;
    }
    .jadual-modal[hidden]{display:none!important}
    .jadual-dialog{
      width:min(520px,100%);background:#202020;border:1px solid #4b4b4b;
      border-radius:14px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.55);
      color:#fff;
    }
    .jadual-dialog h2{margin:0 0 8px;color:#d6ad35}
    .jadual-dialog p{margin:0 0 18px;color:#ccc;line-height:1.45}
    .jadual-field{margin-bottom:14px}
    .jadual-field label{display:block;margin-bottom:7px;font-weight:700}
    .jadual-field select{
      width:100%;box-sizing:border-box;padding:12px;border-radius:7px;
      border:1px solid #666;background:#111;color:#fff;font-size:16px;
    }
    .jadual-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}
    .jadual-actions button{padding:13px;border:0;border-radius:7px;font-weight:800;cursor:pointer}
    .jadual-download{background:#238b4b;color:#fff}
    .jadual-cancel{background:#555;color:#fff}
    #statusMuatTurunJadual{margin-top:14px;line-height:1.4}
    @media(max-width:520px){.jadual-actions{grid-template-columns:1fr}}
  `;
  document.head.appendChild(gaya);

  const butang = document.createElement("button");
  butang.id = "btnMuatTurunJadual";
  butang.type = "button";
  butang.className = "schedule-download-button";
  butang.textContent = "MUAT TURUN JADUAL";
  butang.addEventListener("click", bukaMuatTurunJadual);
  btnPeta.parentNode.insertBefore(butang, btnPeta);

  const modal = document.createElement("section");
  modal.id = "modalMuatTurunJadual";
  modal.className = "jadual-modal";
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "tajukMuatTurunJadual");
  modal.innerHTML = `
    <div class="jadual-dialog">
      <h2 id="tajukMuatTurunJadual">Muat Turun Jadual</h2>
      <p>Pilih tarikh dan kategori jadual Formula 1.</p>

      <div class="jadual-field">
        <label for="pilihTarikhJadual">Tarikh</label>
        <select id="pilihTarikhJadual">
          <option value="">-- PILIH TARIKH --</option>
          ${JADUAL_F1_TARIKH.map(x => `<option value="${x.nilai}">${x.label}</option>`).join("")}
        </select>
      </div>

      <div class="jadual-field">
        <label for="pilihKategoriJadual">Kategori Jadual</label>
        <select id="pilihKategoriJadual">
          <option value="">-- PILIH KATEGORI --</option>
          ${JADUAL_F1_KATEGORI.map(x => `<option value="${x.nilai}">${x.label}</option>`).join("")}
        </select>
      </div>

      <div class="jadual-actions">
        <button class="jadual-download" id="btnSahkanMuatTurunJadual" type="button">
          MUAT TURUN PDF
        </button>
        <button class="jadual-cancel" type="button" onclick="tutupMuatTurunJadual()">
          BATAL
        </button>
      </div>

      <div id="statusMuatTurunJadual" role="status" aria-live="polite"></div>
    </div>
  `;

  modal.addEventListener("click", event => {
    if (event.target === modal) tutupMuatTurunJadual();
  });

  document.body.appendChild(modal);
  document.getElementById("btnSahkanMuatTurunJadual")
    ?.addEventListener("click", muatTurunJadualDipilih);
}

function bukaMuatTurunJadual() {
  const modal = document.getElementById("modalMuatTurunJadual");
  const status = document.getElementById("statusMuatTurunJadual");
  if (!modal) return;
  if (status) status.innerHTML = "";
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function tutupMuatTurunJadual() {
  const modal = document.getElementById("modalMuatTurunJadual");
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
  document.getElementById("btnMuatTurunJadual")?.focus();
}

function namaFailJadualFormula1(tarikh, kategori) {
  const item = JADUAL_F1_KATEGORI.find(x => x.nilai === kategori);
  if (!item) return "";
  return `JADUAL FORMULA 1 ${item.fail} ${tarikh}.pdf`;
}

async function muatTurunJadualDipilih() {
  const tarikh = document.getElementById("pilihTarikhJadual")?.value || "";
  const kategori = document.getElementById("pilihKategoriJadual")?.value || "";
  const status = document.getElementById("statusMuatTurunJadual");
  const btn = document.getElementById("btnSahkanMuatTurunJadual");

  if (!tarikh) {
    if (status) status.innerHTML = '<span class="status-error">Sila pilih tarikh jadual.</span>';
    return;
  }
  if (!kategori) {
    if (status) status.innerHTML = '<span class="status-error">Sila pilih kategori jadual.</span>';
    return;
  }

  const namaFail = namaFailJadualFormula1(tarikh, kategori);
  const url = `jadual/${encodeURIComponent(namaFail)}`;

  if (btn) {
    btn.disabled = true;
    btn.textContent = "MENYEMAK FAIL...";
  }
  if (status) status.innerHTML = '<span class="status-warning">Sedang menyemak jadual...</span>';

  try {
    const respons = await fetch(url, { method: "GET", cache: "no-store" });
    if (!respons.ok) {
      throw new Error(`Jadual ${kategori} bagi tarikh ${tarikh.slice(0,2)}/${tarikh.slice(2,4)}/${tarikh.slice(4)} belum tersedia.`);
    }

    const blob = await respons.blob();
    const blobUrl = URL.createObjectURL(blob);
    const pautan = document.createElement("a");
    pautan.href = blobUrl;
    pautan.download = namaFail;
    document.body.appendChild(pautan);
    pautan.click();
    pautan.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);

    if (status) {
      status.innerHTML = `<span class="status-success"><strong>Jadual dijumpai.</strong><br>${escapeHtml(namaFail)}</span>`;
    }
  } catch (err) {
    if (status) {
      status.innerHTML = `<span class="status-error">${escapeHtml(err.message || "Jadual tidak dapat dimuat turun.")}</span>`;
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "MUAT TURUN PDF";
    }
  }
}


document.addEventListener("DOMContentLoaded", () => {
  pasangModulMuatTurunJadual();
  sediakanModulPassKenderaanPetugas();
  paparModulPassKenderaanPetugas(false);
  el("password")?.addEventListener("keydown", e => { if (e.key === "Enter") login(); });
  pulihkanSesi();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !el("modalPeta")?.hidden) tutupPeta();
});
/* FIX007 UI CLOCK */
(function(){function u(){const d=new Date(),a=document.getElementById('petugasTarikh'),b=document.getElementById('petugasMasa');if(a)a.textContent=d.toLocaleDateString('ms-MY',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});if(b)b.textContent=d.toLocaleTimeString('ms-MY',{hour12:false});}document.addEventListener('DOMContentLoaded',()=>{u();setInterval(u,1000)});})();