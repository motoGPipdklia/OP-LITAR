"use strict";

let deferredPwaPrompt = null;

function pwaIsIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function pwaIsStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
         window.navigator.standalone === true;
}

function pwaUpdateUI() {
  const btn = document.getElementById("btnInstallPwa");
  const hint = document.getElementById("iosInstallHint");

  if (pwaIsStandalone()) {
    if (btn) btn.hidden = true;
    if (hint) hint.hidden = true;
    return;
  }

  if (pwaIsIOS()) {
    if (btn) btn.hidden = true;
    if (hint) hint.hidden = false;
  } else if (hint) {
    hint.hidden = true;
  }
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPwaPrompt = event;

  const btn = document.getElementById("btnInstallPwa");
  if (btn && !pwaIsStandalone()) {
    btn.hidden = false;
  }
});

window.addEventListener("appinstalled", () => {
  deferredPwaPrompt = null;
  const btn = document.getElementById("btnInstallPwa");
  if (btn) btn.hidden = true;
});

async function installSKPOFormula1() {
  if (pwaIsIOS()) {
    alert('Untuk iPhone/iPad: buka menggunakan Safari, tekan Share, kemudian pilih "Add to Home Screen".');
    return;
  }

  if (!deferredPwaPrompt) {
    alert("Pilihan pemasangan belum tersedia. Pastikan laman dibuka menggunakan Chrome/Edge melalui HTTPS.");
    return;
  }

  deferredPwaPrompt.prompt();
  await deferredPwaPrompt.userChoice;
  deferredPwaPrompt = null;
  pwaUpdateUI();
}

// Fungsi ini juga boleh dipanggil daripada Portal.
window.installSKPOFormula1 = installSKPOFormula1;

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnInstallPwa");
  if (btn) btn.addEventListener("click", installSKPOFormula1);

  pwaUpdateUI();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js?v=20261019-cache-chart-001", { updateViaCache: "none" })
      .then(reg => reg.update()).catch(err => console.error("Service Worker gagal:", err));
  }
});

// Jika pengguna datang dari Portal melalui ?install=1,
// paparkan butang install dengan jelas apabila browser sudah sediakan prompt.
const pwaUrlParams = new URLSearchParams(window.location.search);
if (pwaUrlParams.get("install") === "1") {
  window.addEventListener("beforeinstallprompt", () => {
    setTimeout(() => {
      const btn = document.getElementById("btnInstallPwa");
      if (btn) {
        btn.hidden = false;
        btn.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 250);
  });
}
