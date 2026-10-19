/* ================================================================
   SKPO FORMULA 1 — SAMBUNGAN SUPABASE — FIX 003
================================================================ */
(function mulakanSupabaseSKPOFormula1(){
  "use strict";
  const STORAGE_KEY = "skpo-f1-supabase-auth";
  window.SKPO_SUPABASE_READY=false;
  window.SKPO_SUPABASE_ERROR="";
  try {
    const cfg=window.SKPO_CONFIG||{};
    const raw=String(cfg.SUPABASE_URL||"").trim();
    let projectUrl="";
    try {
      const u=new URL(raw);
      if(u.protocol!=="https:" || !u.hostname.endsWith(".supabase.co")) throw new Error();
      projectUrl=u.origin;
    } catch(_) { throw new Error("SUPABASE_URL Formula 1 tidak sah."); }
    const key=String(cfg.SUPABASE_PUBLISHABLE_KEY||cfg.SUPABASE_ANON_KEY||"").trim();
    if(!key) throw new Error("Publishable Key Formula 1 belum dimasukkan.");
    if(!window.supabase?.createClient) throw new Error("Pustaka Supabase tidak berjaya dimuatkan daripada CDN.");

    // Satu klien sahaja. Lock khas mengelakkan login tergantung apabila
    // beberapa tab OP-LITAR pada origin yang sama sedang terbuka.
    const lockTanpaTunggu = async (_name, _acquireTimeout, fn) => await fn();

    const client=window.supabase.createClient(projectUrl,key,{
      auth:{
        persistSession:true,
        autoRefreshToken:true,
        detectSessionInUrl:true,
        storageKey:STORAGE_KEY,
        lock:lockTanpaTunggu
      },
      global:{headers:{"X-Client-Info":"skpo-f1-github-pages-fix003"}}
    });
    window.supabaseClient=client;
    window.skpoSupabase=client;
    window.SKPO_SUPABASE_READY=true;
    console.info("SKPO Formula 1: Supabase FIX003 sedia.");
  } catch(error) {
    window.supabaseClient=null;
    window.skpoSupabase=null;
    window.SKPO_SUPABASE_READY=false;
    window.SKPO_SUPABASE_ERROR=error?.message||"Sambungan Supabase Formula 1 gagal.";
    console.error("SKPO Formula 1: Supabase gagal:",error);
  }
})();
