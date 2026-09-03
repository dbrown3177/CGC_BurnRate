import { useState, useEffect, useCallback } from "react";

// ─── CONFIG — paste your Supabase credentials here ───────────────────────────
const SUPABASE_URL = "https://msgussbsssgcmtkksrvp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zZ3Vzc2Jzc3NnY210a2tzcnZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTk1ODcsImV4cCI6MjEwMzQzNTU4N30.0IwuljHC2JFIEVdzKeCkeb5Xq85_R6hjhno3pFXOCDk";

const USE_DB = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

// ─── SUPABASE HELPERS ─────────────────────────────────────────────────────────
async function dbSelect(table, filters = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=*`;
  Object.entries(filters).forEach(([k, v]) => { url += `&${k}=eq.${v}`; });
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  return res.json();
}

async function dbUpsert(table, row, onConflict) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(row),
  });
  return res.ok;
}

// ─── STORES ───────────────────────────────────────────────────────────────────
const STORES = [
  { id: "7006", name: "Mayagüez" },
  { id: "7007", name: "Hatillo" },
  { id: "7005", name: "Ponce" },
  { id: "7002", name: "Caguas" },
  { id: "7003", name: "Guaynabo" },
  { id: "7008", name: "Carolina" },
  { id: "7004", name: "Dorado" },
  { id: "7009", name: "Mall of San Juan" },
];

const INITIAL_FLAVORS = {
  RINGS: [
    "Mini Ring","Mini Sugar","Mini Chocolate Iced","Mini Chocolate Sprinkles",
    "Chocolate Iced Glazed","Chocolate Iced with Sprinkles",
  ],
  RELLENAS: [
    "Nutella Ring Filled","Quesito","Queso-Guayaba","Guayaba",
    "Bavarian Kreme","Cinnamon Cheesecake","Sugar",
  ],
  PROMOCION: [
    "Pokemon Poke Ball","Pokemon Pikachu","Pokemon Charmander",
    "Pokemon Jigglypuff","Pokemon Squirtle","Pokemon Bulbasaur",
  ],
  CAKE: ["Hershey's Brownie Fudge","Choco Cake","Cruller"],
  "SIN RELLENAR": [
    "Original Trays","Glazed","Shell Secas","Wet Shell Glazed",
    "Ring Secas","Mini Shell Mojadas","Mini Shell Secas",
  ],
  "DOUGHNUT DOTS": ["OG Dots","Dots Nutella","Dots Glazed"],
};

const PREPS = ["7:00 AM","11:00 AM","3:00 PM","6:00 PM","9:00 PM","Cierre"];
const DAYS  = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

const KK_GREEN        = "#00704A";
const KK_RED          = "#CC0000";
const COL_ORANGE      = "#FFA500";
const COL_BLUE        = "#00B0F0";
const COL_ORANGE_LIGHT = "#FFF3E0";
const COL_BLUE_LIGHT   = "#E3F6FD";

// ─── LOCAL STORAGE HELPERS ────────────────────────────────────────────────────
function loadLocal(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
  catch { return fallback; }
}
function saveLocal(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────
function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0,0,0,0);
  return d;
}
function fmt(d) { return d.toISOString().split("T")[0]; }
function weekLabel(ws) {
  const e = new Date(ws); e.setDate(e.getDate()+6);
  return `${fmt(ws)} → ${fmt(e)}`;
}

// ─── ROW HELPERS ──────────────────────────────────────────────────────────────
function emptyRow() {
  const r = {};
  PREPS.forEach((_, i) => { r[`prep${i}`] = ""; r[`conteo${i}`] = ""; });
  return r;
}
function emptyForm(flavors) {
  const f = {};
  Object.values(flavors).flat().forEach(fl => { f[fl] = emptyRow(); });
  return f;
}
function totalProducido(row) {
  return PREPS.reduce((s, _, i) => s + (parseFloat(row[`prep${i}`]) || 0), 0);
}
function totalVendido(row) {
  const sumPrep    = totalProducido(row);
  const cierreCnt  = parseFloat(row[`conteo${PREPS.length - 1}`]) || 0;
  return Math.max(0, sumPrep - cierreCnt);
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]     = useState("login");
  const [store, setStore]       = useState(null);
  const [flavors, setFlavors]   = useState(() => loadLocal("kk_flavors", INITIAL_FLAVORS));
  const [offlineQ, setOfflineQ] = useState(() => loadLocal("kk_offline_q", []));

  useEffect(() => saveLocal("kk_flavors", flavors), [flavors]);
  useEffect(() => saveLocal("kk_offline_q", offlineQ), [offlineQ]);

  // Load flavors from DB on start
  useEffect(() => {
    if (!USE_DB) return;
    dbSelect("flavor_config", { id: 1 }).then(rows => {
      if (rows?.[0]?.flavors) {
        setFlavors(rows[0].flavors);
        saveLocal("kk_flavors", rows[0].flavors);
      }
    }).catch(() => {});
  }, []);

  // Flush offline queue when back online
  useEffect(() => {
    if (!USE_DB) return;
    async function flush() {
      if (!offlineQ.length) return;
      const remaining = [];
      for (const entry of offlineQ) {
        const ok = await dbUpsert("burn_rate_entries", entry, "store_id,week_start,day_index");
        if (!ok) remaining.push(entry);
      }
      setOfflineQ(remaining);
    }
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [offlineQ]);

  if (screen === "login")
    return <Login
      onStore={s => { setStore(s); setScreen("store"); }}
      onAdmin={p => { if (p === "admin123") setScreen("admin"); else alert("Contraseña incorrecta"); }}
    />;
  if (screen === "store")
    return <StoreScreen store={store} flavors={flavors}
             offlineQ={offlineQ} setOfflineQ={setOfflineQ}
             onBack={() => setScreen("login")} />;
  if (screen === "admin")
    return <AdminScreen flavors={flavors} setFlavors={setFlavors}
             onBack={() => setScreen("login")} />;
  return null;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onStore, onAdmin }) {
  const [pass, setPass]           = useState("");
  const [showAdmin, setShowAdmin] = useState(false);
  return (
    <div style={S.page}>
      <div style={S.loginCard}>
        <div style={S.logoRow}>
          <div style={S.logoCircle}>🍩</div>
          <div>
            <div style={S.logoTitle}>KRISPY KREME</div>
            <div style={S.logoSub}>Burn Rate — Registro de Producción</div>
          </div>
        </div>

        <TrayNote />

        {USE_DB
          ? <div style={S.okBanner}>✅ Conectado a base de datos central</div>
          : <div style={S.warnBanner}>⚠️ Sin base de datos — configura Supabase para compartir datos entre tiendas.</div>
        }

        <div style={S.sectionLabel}>SELECCIONA TU TIENDA</div>
        <div style={S.storeGrid}>
          {STORES.map(s => (
            <button key={s.id} style={S.storeBtn} onClick={() => onStore(s)}
              onMouseEnter={e => { e.currentTarget.style.background = KK_GREEN; e.currentTarget.style.borderColor = KK_GREEN; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#1a1a1a"; e.currentTarget.style.borderColor = "#2a2a2a"; }}>
              <span style={{ fontWeight:800, fontSize:16, color:"#fff" }}>{s.id}</span>
              <span style={{ fontSize:12, opacity:0.65 }}>{s.name}</span>
            </button>
          ))}
        </div>

        <div style={{ borderTop:"1px solid #1f1f1f", marginTop:20, paddingTop:16 }}>
          {!showAdmin
            ? <button style={S.adminToggle} onClick={() => setShowAdmin(true)}>Acceso de Administrador ›</button>
            : <div style={{ display:"flex", gap:8 }}>
                <input style={{ ...S.input, flex:1 }} type="password" placeholder="Contraseña"
                  value={pass} onChange={e => setPass(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && onAdmin(pass)} />
                <button style={S.greenBtn} onClick={() => onAdmin(pass)}>Entrar</button>
              </div>
          }
        </div>
      </div>
    </div>
  );
}

// ─── TRAY NOTE ────────────────────────────────────────────────────────────────
function TrayNote() {
  return (
    <div style={{
      background:"#1a1200", border:`1.5px solid ${COL_ORANGE}`,
      borderRadius:8, padding:"10px 14px", marginBottom:16,
      fontSize:13, lineHeight:1.7, color:"#ffe0a0",
    }}>
      <strong style={{ color:COL_ORANGE }}>📋 TODOS LOS NÚMEROS SON EN BANDEJAS</strong><br />
      Minis = 27 unidades / bandeja &nbsp;·&nbsp; DOTS = 48 unidades / bandeja &nbsp;·&nbsp; Regulares = 12 unidades / bandeja
    </div>
  );
}

// ─── STORE SCREEN ─────────────────────────────────────────────────────────────
function StoreScreen({ store, flavors, offlineQ, setOfflineQ, onBack }) {
  const today       = new Date();
  const currentWeek = getWeekStart(today);
  const todayIdx    = today.getDay() === 0 ? 6 : today.getDay() - 1;

  // Allow selecting current week or up to 2 previous weeks
  const weekOptions = [0, 1, 2].map(n => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() - n * 7);
    return d;
  });

  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = weekOptions[weekOffset];

  const [dayIdx, setDayIdx]       = useState(todayIdx);
  const [tab, setTab]             = useState("entry");
  const [loading, setLoading]     = useState(false);
  const [savedDays, setSavedDays] = useState({});
  const [formData, setFormData]   = useState(() => emptyForm(flavors));
  const [syncing, setSyncing]     = useState(false);

  const dayDate = new Date(weekStart); dayDate.setDate(dayDate.getDate() + dayIdx);

  // Reload when store or week changes
  useEffect(() => {
    async function load() {
      setLoading(true);
      setSavedDays({});
      if (USE_DB) {
        try {
          const rows = await dbSelect("burn_rate_entries", {
            store_id:   store.id,
            week_start: fmt(weekStart),
          });
          const days = {};
          (rows || []).forEach(r => { days[r.day_index] = { ...r, data: r.data }; });
          setSavedDays(days);
        } catch {}
      } else {
        const local = {};
        DAYS.forEach((_, i) => {
          const v = loadLocal(`kk_entry__${store.id}__${fmt(weekStart)}__${i}`, null);
          if (v) local[i] = v;
        });
        setSavedDays(local);
      }
      setLoading(false);
    }
    load();
  }, [store.id, weekOffset]);

  useEffect(() => {
    setFormData(savedDays[dayIdx]?.data ?? emptyForm(flavors));
  }, [dayIdx, savedDays, flavors]);

  function handleChange(flavor, field, val) {
    setFormData(prev => ({ ...prev, [flavor]: { ...prev[flavor], [field]: val } }));
  }

  async function handleSave() {
    const record = {
      store_id:   store.id,
      store_name: store.name,
      week_start: fmt(weekStart),
      day_index:  dayIdx,
      day_name:   DAYS[dayIdx],
      date:       fmt(dayDate),
      data:       formData,
      saved_at:   new Date().toISOString(),
    };

    // Optimistic update
    setSavedDays(prev => ({ ...prev, [dayIdx]: record }));

    if (!USE_DB) {
      saveLocal(`kk_entry__${store.id}__${fmt(weekStart)}__${dayIdx}`, record);
      alert(`✅ Guardado — ${DAYS[dayIdx]} ${fmt(dayDate)}`);
      return;
    }

    setSyncing(true);
    try {
      const ok = await dbUpsert("burn_rate_entries", record, "store_id,week_start,day_index");
      setSyncing(false);
      if (ok) {
        alert(`✅ Enviado a base de datos — ${DAYS[dayIdx]} ${fmt(dayDate)}`);
      } else {
        throw new Error("upsert failed");
      }
    } catch {
      setOfflineQ(prev => [
        ...prev.filter(x => !(x.store_id === record.store_id && x.week_start === record.week_start && x.day_index === record.day_index)),
        record,
      ]);
      setSyncing(false);
      alert(`📶 Sin conexión — guardado localmente.\nSe enviará automáticamente cuando haya internet.`);
    }
  }

  // Weekly summary
  const allFlavors = Object.values(flavors).flat();
  const weeklySummary = allFlavors.map(fl => {
    let prod = 0, vend = 0;
    Object.values(savedDays).forEach(rec => {
      const row = rec?.data?.[fl] ?? emptyRow();
      prod += totalProducido(row);
      vend += totalVendido(row);
    });
    return { fl, prod, vend };
  }).filter(r => r.prod > 0 || r.vend > 0);

  return (
    <div style={S.page}>
      <div style={S.shell}>
        <div style={S.header}>
          <button style={S.backBtn} onClick={onBack}>← Salir</button>
          <div style={{ flex:1 }}>
            <div style={S.headerTitle}>{store.id} — {store.name}</div>
            <div style={S.headerSub}>
              {syncing && "↻ Sincronizando… · "}
              {offlineQ.length > 0 && `⚠ ${offlineQ.length} pendiente(s) · `}
            </div>
          </div>
          {/* Week selector — current + 2 previous weeks */}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            {weekOptions.map((ws, i) => (
              <button key={i}
                style={{
                  ...S.tabBtn,
                  ...(weekOffset === i ? { background:"#444", border:"1px solid #666", color:"#fff" } : {}),
                  fontSize:11, padding:"4px 10px",
                }}
                onClick={() => { setWeekOffset(i); setDayIdx(i === 0 ? todayIdx : 0); }}>
                {i === 0 ? "📅 Esta semana" : i === 1 ? "⬅ Semana anterior" : "⬅⬅ Hace 2 semanas"}
              </button>
            ))}
          </div>
          <div style={{ width:"100%", fontSize:12, color:"#555", paddingTop:4 }}>
            Semana seleccionada: <strong style={{ color:"#aaa" }}>{weekLabel(weekStart)}</strong>
            {weekOffset > 0 && <span style={{ color:KK_RED, marginLeft:8 }}>⚠ Editando semana pasada</span>}
          </div>
          <TabBar
            tabs={[{ k:"entry", label:"📝 Entrada" }, { k:"weekly", label:"📊 Resumen Semanal" }]}
            active={tab} setActive={setTab}
          />
        </div>

        {tab === "entry" && (
          <>
            <div style={S.dayBar}>
              {DAYS.map((d, i) => {
                const dd = new Date(weekStart); dd.setDate(dd.getDate() + i);
                const has = !!savedDays[i];
                return (
                  <button key={i}
                    style={{ ...S.dayBtn, ...(i === dayIdx ? S.dayActive : {}), position:"relative" }}
                    onClick={() => setDayIdx(i)}>
                    {has && <span style={S.dot} />}
                    <span style={{ fontSize:10, opacity:0.65 }}>{d.slice(0,3).toUpperCase()}</span>
                    <span style={{ fontWeight:700, fontSize:14 }}>{dd.getDate()}</span>
                  </button>
                );
              })}
            </div>

            <div style={S.entryArea}>
              <TrayNote />
              {loading ? <div style={S.loading}>Cargando…</div> : (
                <>
                  {Object.entries(flavors).map(([cat, fls], catIdx) => (
                    <div key={cat} style={{ marginBottom:20 }}>
                      <div style={S.catHead}>{cat}</div>
                      <FlavorTable fls={fls} formData={formData}
                        onChange={handleChange} firstCategory={catIdx === 0} />
                    </div>
                  ))}
                  <button style={S.saveBtn} onClick={handleSave}>
                    💾 Guardar {DAYS[dayIdx]} {fmt(dayDate)}
                  </button>
                </>
              )}
            </div>
          </>
        )}

        {tab === "weekly" && (
          <div style={S.entryArea}>
            <TrayNote />
            <WeeklySummary summary={weeklySummary} daysCount={Object.keys(savedDays).length} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TABLE COLGROUP ───────────────────────────────────────────────────────────
function TableColGroup() {
  return (
    <colgroup>
      <col style={{ width:160 }} />
      {PREPS.map((_, i) => (
        <>
          <col key={`p${i}`} style={{ width:58 }} />
          <col key={`c${i}`} style={{ width:58 }} />
        </>
      ))}
      <col style={{ width:90 }} />
      <col style={{ width:90 }} />
    </colgroup>
  );
}

// ─── TABLE HEADER ─────────────────────────────────────────────────────────────
function TableHeader({ firstCategory }) {
  if (!firstCategory) {
    return (
      <thead>
        <tr>
          <th style={{ ...Tc.hBase, background:"#1a1a1a", color:"#555", padding:"3px 8px" }}></th>
          {PREPS.map((_, i) => (
            <>
              <th key={`p${i}`} style={{ ...Tc.subH, background:COL_ORANGE, color:"#5a2d00", borderLeft:"2px solid #c47a00" }}>PREP</th>
              <th key={`c${i}`} style={{ ...Tc.subH, background:COL_ORANGE, color:"#5a2d00" }}>Conteo</th>
            </>
          ))}
          <th style={{ ...Tc.subH, background:COL_BLUE, color:"#003a60" }}>=Σ PREP</th>
          <th style={{ ...Tc.subH, background:COL_BLUE, color:"#003a60" }}>Σ−Cierre</th>
        </tr>
      </thead>
    );
  }
  return (
    <thead>
      <tr>
        <th style={{ ...Tc.hBase, background:"#111", color:"#aaa", textAlign:"left", paddingLeft:10 }}>Sabor</th>
        {PREPS.map((p, i) => (
          <th key={i} colSpan={2}
            style={{ ...Tc.hBase, background:COL_ORANGE, color:"#000", borderLeft:"2px solid #c47a00" }}>
            {p}
          </th>
        ))}
        <th style={{ ...Tc.hBase, background:COL_BLUE, color:"#000" }}>Total Producido</th>
        <th style={{ ...Tc.hBase, background:COL_BLUE, color:"#000" }}>Total Vendido</th>
      </tr>
      <tr>
        <th style={{ ...Tc.subH, background:"#111", color:"#555" }}></th>
        {PREPS.map((_, i) => (
          <>
            <th key={`p${i}`} style={{ ...Tc.subH, background:COL_ORANGE, color:"#5a2d00", borderLeft:"2px solid #c47a00" }}>PREP</th>
            <th key={`c${i}`} style={{ ...Tc.subH, background:COL_ORANGE, color:"#5a2d00" }}>Conteo</th>
          </>
        ))}
        <th style={{ ...Tc.subH, background:COL_BLUE, color:"#003a60", fontSize:10 }}>=Σ PREP</th>
        <th style={{ ...Tc.subH, background:COL_BLUE, color:"#003a60", fontSize:10 }}>Σ PREP−Cierre</th>
      </tr>
    </thead>
  );
}

// ─── FLAVOR TABLE ─────────────────────────────────────────────────────────────
function FlavorTable({ fls, formData, onChange, firstCategory }) {
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ borderCollapse:"collapse", tableLayout:"fixed", width:"100%", fontSize:13 }}>
        <TableColGroup />
        <TableHeader firstCategory={firstCategory} />
        <tbody>
          {fls.map(fl => {
            const row     = formData[fl] ?? emptyRow();
            const totProd = totalProducido(row);
            const totVend = totalVendido(row);
            return (
              <tr key={fl} style={{ borderBottom:"1px solid #1e1e1e" }}>
                <td style={Tc.flavor}>{fl}</td>
                {PREPS.map((_, i) => (
                  <>
                    <td key={`p${i}`} style={{ ...Tc.orangeCell, borderLeft: i === 0 ? `2px solid ${COL_ORANGE}` : `2px solid #c47a0044` }}>
                      <input style={Tc.orangeInput} type="number" min="0" placeholder="0"
                        value={row[`prep${i}`]}
                        onChange={e => onChange(fl, `prep${i}`, e.target.value)} />
                    </td>
                    <td key={`c${i}`} style={Tc.orangeCell}>
                      <input style={Tc.orangeInput} type="number" min="0" placeholder="0"
                        value={row[`conteo${i}`]}
                        onChange={e => onChange(fl, `conteo${i}`, e.target.value)} />
                    </td>
                  </>
                ))}
                <td style={Tc.blueCell}>{totProd || "—"}</td>
                <td style={Tc.blueCell}>{totVend || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── WEEKLY SUMMARY ───────────────────────────────────────────────────────────
function WeeklySummary({ summary, daysCount }) {
  const grandProd = summary.reduce((s, r) => s + r.prod, 0);
  const grandVend = summary.reduce((s, r) => s + r.vend, 0);
  const grandBurn = grandProd > 0 ? ((grandProd - grandVend) / grandProd * 100).toFixed(1) : null;

  return (
    <>
      <div style={S.sectionLabel}>RESUMEN SEMANAL — {daysCount} día(s) registrados</div>
      {summary.length === 0
        ? <div style={S.empty}>No hay datos registrados esta semana.</div>
        : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ borderCollapse:"collapse", width:"100%", minWidth:500, fontSize:13 }}>
              <thead>
                <tr>
                  <th style={{ ...Tc.wkH, textAlign:"left", width:200 }}>Sabor</th>
                  <th style={{ ...Tc.wkH, background:COL_BLUE, color:"#000" }}>Total Producido</th>
                  <th style={{ ...Tc.wkH, background:COL_BLUE, color:"#000" }}>Total Vendido</th>
                  <th style={{ ...Tc.wkH, background:"#1a4a1a", color:"#7eff7e" }}>% Burn Rate</th>
                </tr>
                <tr>
                  <td style={{ ...Tc.wkSub, textAlign:"left" }}></td>
                  <td style={{ ...Tc.wkSub, background:COL_BLUE_LIGHT, color:"#003a60", fontSize:11 }}>=Σ celdas PREP</td>
                  <td style={{ ...Tc.wkSub, background:COL_BLUE_LIGHT, color:"#003a60", fontSize:11 }}>=Σ Total Vendido</td>
                  <td style={{ ...Tc.wkSub, background:"#0a2a0a", color:"#4aaa4a", fontSize:11 }}>=IFERROR((Prod−Vend)/Prod,0)</td>
                </tr>
              </thead>
              <tbody>
                {summary.map(r => {
                  const burn     = r.prod > 0 ? ((r.prod - r.vend) / r.prod * 100).toFixed(1) : null;
                  const burnColor = burn === null ? "#555"
                    : parseFloat(burn) <= 10 ? "#4ade80"
                    : parseFloat(burn) <= 25 ? "#facc15"
                    : KK_RED;
                  return (
                    <tr key={r.fl} style={{ borderBottom:"1px solid #1a1a1a" }}>
                      <td style={{ padding:"6px 10px", color:"#ddd" }}>{r.fl}</td>
                      <td style={{ ...Tc.blueCell, textAlign:"center" }}>{r.prod}</td>
                      <td style={{ ...Tc.blueCell, textAlign:"center" }}>{r.vend}</td>
                      <td style={{ padding:"6px 10px", textAlign:"center", fontWeight:700, color:burnColor }}>
                        {burn !== null ? `${burn}%` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop:"2px solid #333", background:"#111" }}>
                  <td style={{ padding:"8px 10px", fontWeight:700, color:"#fff" }}>TOTAL</td>
                  <td style={{ ...Tc.blueCell, textAlign:"center", fontWeight:700 }}>{grandProd}</td>
                  <td style={{ ...Tc.blueCell, textAlign:"center", fontWeight:700 }}>{grandVend}</td>
                  <td style={{ padding:"8px 10px", textAlign:"center", fontWeight:700,
                    color: grandBurn === null ? "#555"
                      : parseFloat(grandBurn) <= 10 ? "#4ade80"
                      : parseFloat(grandBurn) <= 25 ? "#facc15" : KK_RED }}>
                    {grandBurn !== null ? `${grandBurn}%` : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      }
    </>
  );
}

// ─── ADMIN SCREEN ─────────────────────────────────────────────────────────────
function AdminScreen({ flavors, setFlavors, onBack }) {
  const [aTab, setATab]      = useState("flavors");
  const [newFlavor, setNF]   = useState("");
  const [newCat, setNC]      = useState(Object.keys(flavors)[0]);
  const [newCatName, setNCN] = useState("");

  async function saveFlavors(updated) {
    setFlavors(updated);
    saveLocal("kk_flavors", updated);
    if (USE_DB) {
      await dbUpsert("flavor_config", { id:1, flavors:updated }, "id");
    }
  }

  async function addFlavor() {
    const name = newFlavor.trim(); if (!name) return;
    await saveFlavors({ ...flavors, [newCat]: [...(flavors[newCat]||[]), name] });
    setNF("");
  }
  async function removeFlavor(cat, fl) {
    if (!confirm(`¿Eliminar "${fl}"?`)) return;
    await saveFlavors({ ...flavors, [cat]: flavors[cat].filter(f => f !== fl) });
  }
  async function addCategory() {
    const name = newCatName.trim().toUpperCase();
    if (!name || flavors[name]) return;
    await saveFlavors({ ...flavors, [name]: [] });
    setNC(name); setNCN("");
  }

  return (
    <div style={S.page}>
      <div style={S.shell}>
        <div style={S.header}>
          <button style={S.backBtn} onClick={onBack}>← Salir</button>
          <div style={{ flex:1 }}>
            <div style={S.headerTitle}>Panel de Administrador</div>
            <div style={S.headerSub}>{USE_DB ? "✅ Conectado a Supabase" : "⚠️ Modo local"}</div>
          </div>
          <TabBar
            tabs={[{ k:"flavors", label:"🍩 Sabores" }, { k:"data", label:"📋 Ver Datos" }, { k:"export", label:"📤 Exportar" }]}
            active={aTab} setActive={setATab}
          />
        </div>

        {aTab === "flavors" && (
          <div style={S.entryArea}>
            <TrayNote />
            <div style={S.sectionLabel}>GESTIÓN DE SABORES</div>
            <div style={{ display:"flex", gap:8, marginBottom:8 }}>
              <select style={S.select} value={newCat} onChange={e => setNC(e.target.value)}>
                {Object.keys(flavors).map(c => <option key={c}>{c}</option>)}
              </select>
              <input style={{ ...S.input, flex:1 }} placeholder="Nombre del sabor"
                value={newFlavor} onChange={e => setNF(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addFlavor()} />
              <button style={S.greenBtn} onClick={addFlavor}>+ Agregar</button>
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:24 }}>
              <input style={{ ...S.input, flex:1 }} placeholder="Nueva categoría"
                value={newCatName} onChange={e => setNCN(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addCategory()} />
              <button style={{ ...S.greenBtn, background:"#333" }} onClick={addCategory}>+ Categoría</button>
            </div>
            {Object.entries(flavors).map(([cat, fls]) => (
              <div key={cat} style={{ marginBottom:18 }}>
                <div style={S.catHead}>{cat} <span style={{ fontWeight:400, fontSize:11, opacity:0.4 }}>({fls.length})</span></div>
                {fls.map(fl => (
                  <div key={fl} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                    padding:"6px 8px", borderBottom:"1px solid #141414" }}>
                    <span style={{ fontSize:13, color:"#ddd" }}>{fl}</span>
                    <button style={S.removeBtn} onClick={() => removeFlavor(cat, fl)}>✕</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {aTab === "data"   && <DataTab />}
        {aTab === "export" && <ExportTab flavors={flavors} />}
      </div>
    </div>
  );
}

// ─── DATA TAB (admin sees all store submissions) ──────────────────────────────
function DataTab() {
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filterStore, setFS]      = useState("ALL");
  const [filterWeek, setFW]       = useState("ALL");

  useEffect(() => {
    async function load() {
      setLoading(true);
      if (USE_DB) {
        const data = await dbSelect("burn_rate_entries");
        setRows(data || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  const weeks  = [...new Set(rows.map(r => r.week_start))].sort().reverse();
  const filtered = rows.filter(r =>
    (filterStore === "ALL" || r.store_id === filterStore) &&
    (filterWeek  === "ALL" || r.week_start === filterWeek)
  ).sort((a, b) => b.saved_at?.localeCompare(a.saved_at));

  return (
    <div style={S.entryArea}>
      <div style={S.sectionLabel}>REGISTROS DE TODAS LAS TIENDAS ({rows.length} entradas)</div>
      {!USE_DB && <div style={S.warnBanner}>⚠️ Conecta Supabase para ver datos de otras tiendas.</div>}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
        <select style={S.select} value={filterStore} onChange={e => setFS(e.target.value)}>
          <option value="ALL">Todas las tiendas</option>
          {STORES.map(s => <option key={s.id} value={s.id}>{s.id} — {s.name}</option>)}
        </select>
        <select style={S.select} value={filterWeek} onChange={e => setFW(e.target.value)}>
          <option value="ALL">Todas las semanas</option>
          {weeks.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        {USE_DB && <button style={S.greenBtn} onClick={() => { setLoading(true); dbSelect("burn_rate_entries").then(d => { setRows(d||[]); setLoading(false); }); }}>↻ Actualizar</button>}
      </div>
      {loading ? <div style={S.loading}>Cargando…</div> : filtered.length === 0
        ? <div style={S.empty}>No hay registros.</div>
        : filtered.map((r, i) => (
          <div key={i} style={{ padding:"10px 12px", borderBottom:"1px solid #1a1a1a" }}>
            <div style={{ display:"flex", gap:12, alignItems:"center" }}>
              <span style={{ fontWeight:700, color:KK_GREEN, fontSize:15 }}>{r.store_id}</span>
              <span style={{ fontWeight:600, color:"#ddd" }}>{r.day_name} — {r.date}</span>
              <span style={{ marginLeft:"auto", fontSize:11, color:"#555" }}>
                {r.saved_at ? new Date(r.saved_at).toLocaleString("es-PR") : ""}
              </span>
            </div>
            <div style={{ fontSize:12, color:"#666", marginTop:3 }}>
              Semana: {r.week_start} · {Object.values(r.data||{}).filter(v => parseFloat(v?.prep0) > 0 || parseFloat(v?.prep1) > 0).length} sabores con datos
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ─── EXPORT TAB ───────────────────────────────────────────────────────────────
function ExportTab({ flavors }) {
  const [rows, setRows]      = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStore, setFS] = useState("ALL");
  const [filterWeek, setFW]  = useState("ALL");

  useEffect(() => {
    async function load() {
      setLoading(true);
      if (USE_DB) {
        const data = await dbSelect("burn_rate_entries");
        setRows(data || []);
      }
      setLoading(false);
    }
    load();
  }, []);

  const weeks    = [...new Set(rows.map(r => r.week_start))].sort().reverse();
  const filtered = rows.filter(r =>
    (filterStore === "ALL" || r.store_id === filterStore) &&
    (filterWeek  === "ALL" || r.week_start === filterWeek)
  );

  function buildCSVRows() {
    const groups = {};
    filtered.forEach(r => {
      const gk = `${r.store_id}__${r.week_start}`;
      if (!groups[gk]) groups[gk] = { store_id:r.store_id, store_name:r.store_name, week_start:r.week_start, days:[] };
      groups[gk].days.push(r);
    });
    const out = [];
    const allFlavors = Object.values(flavors).flat();
    Object.values(groups).forEach(g => {
      allFlavors.forEach(fl => {
        let prod = 0, vend = 0;
        g.days.forEach(d => {
          const row = d.data?.[fl] ?? emptyRow();
          prod += totalProducido(row);
          vend += totalVendido(row);
        });
        if (prod > 0 || vend > 0) {
          const burn = prod > 0 ? ((prod - vend) / prod * 100).toFixed(1) : "N/A";
          out.push({ store:g.store_id, storeName:g.store_name, weekStart:g.week_start, fl, prod, vend, burn });
        }
      });
    });
    return out;
  }

  function downloadCSV() {
    const csvRows = buildCSVRows();
    if (!csvRows.length) { alert("No hay datos para exportar."); return; }
    const header = "Store #,Store Name,Week Start,Flavor,Total Producido,Total Vendido,% Burn Rate";
    const csv = [header, ...csvRows.map(r =>
      `${r.store},"${r.storeName}","${r.weekStart}","${r.fl}",${r.prod},${r.vend},${r.burn}`
    )].join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `kk_burnrate_resumen_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  const csvRows = buildCSVRows();

  return (
    <div style={S.entryArea}>
      <div style={S.sectionLabel}>EXPORTAR RESUMEN SEMANAL PARA POWER BI</div>
      {!USE_DB && <div style={S.warnBanner}>⚠️ Conecta Supabase para exportar datos de todas las tiendas.</div>}
      <p style={{ fontSize:13, color:"#888", lineHeight:1.7, marginBottom:16 }}>
        Descarga el CSV y ábrelo en Power BI con <strong>Obtener datos → Texto/CSV</strong>.<br/>
        Columnas: <em>Store #, Store Name, Week Start, Flavor, Total Producido, Total Vendido, % Burn Rate</em>
      </p>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
        <select style={S.select} value={filterStore} onChange={e => setFS(e.target.value)}>
          <option value="ALL">Todas las tiendas</option>
          {STORES.map(s => <option key={s.id} value={s.id}>{s.id} — {s.name}</option>)}
        </select>
        <select style={S.select} value={filterWeek} onChange={e => setFW(e.target.value)}>
          <option value="ALL">Todas las semanas</option>
          {weeks.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        <button style={S.greenBtn} onClick={downloadCSV}>⬇ Descargar CSV ({csvRows.length} filas)</button>
      </div>
      {loading ? <div style={S.loading}>Cargando…</div> : csvRows.length > 0 && (
        <div style={{ overflowX:"auto" }}>
          <table style={{ borderCollapse:"collapse", width:"100%", fontSize:12 }}>
            <thead>
              <tr>
                {["Store #","Store Name","Week Start","Sabor","Total Producido","Total Vendido","% Burn Rate"].map(h => (
                  <th key={h} style={{ ...Tc.wkH, fontSize:11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {csvRows.slice(0,15).map((r, i) => (
                <tr key={i} style={{ borderBottom:"1px solid #141414" }}>
                  <td style={{ padding:"5px 8px", color:KK_GREEN, fontWeight:700 }}>{r.store}</td>
                  <td style={{ padding:"5px 8px", color:"#ccc" }}>{r.storeName}</td>
                  <td style={{ padding:"5px 8px", color:"#ccc" }}>{r.weekStart}</td>
                  <td style={{ padding:"5px 8px", color:"#ccc" }}>{r.fl}</td>
                  <td style={{ padding:"5px 8px", textAlign:"center", color:"#ccc" }}>{r.prod}</td>
                  <td style={{ padding:"5px 8px", textAlign:"center", color:"#ccc" }}>{r.vend}</td>
                  <td style={{ padding:"5px 8px", textAlign:"center", fontWeight:700,
                    color: r.burn === "N/A" ? "#555" : parseFloat(r.burn) <= 10 ? "#4ade80" : parseFloat(r.burn) <= 25 ? "#facc15" : KK_RED }}>
                    {r.burn !== "N/A" ? `${r.burn}%` : "—"}
                  </td>
                </tr>
              ))}
              {csvRows.length > 15 && (
                <tr><td colSpan={7} style={{ padding:"6px", color:"#555", textAlign:"center" }}>… y {csvRows.length - 15} filas más</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── SHARED ───────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, setActive }) {
  return (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
      {tabs.map(t => (
        <button key={t.k}
          style={{ ...S.tabBtn, ...(active === t.k ? S.tabActive : {}) }}
          onClick={() => setActive(t.k)}>{t.label}</button>
      ))}
    </div>
  );
}

// ─── TABLE CELL STYLES ────────────────────────────────────────────────────────
const Tc = {
  hBase: { padding:"5px 4px", border:"1px solid #333", fontWeight:700, textAlign:"center", fontSize:11, whiteSpace:"nowrap" },
  subH:  { padding:"3px 4px", border:"1px solid #333", fontWeight:400, textAlign:"center", fontSize:10, whiteSpace:"nowrap" },
  flavor: { padding:"5px 8px", minWidth:140, maxWidth:180, color:"#ddd", fontSize:12, border:"1px solid #1a1a1a", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" },
  orangeCell:  { padding:0, background:COL_ORANGE_LIGHT, border:`1px solid ${COL_ORANGE}44` },
  orangeInput: { width:"100%", boxSizing:"border-box", background:"transparent", border:"none", outline:"none", textAlign:"center", fontSize:13, color:"#000", fontWeight:600, padding:"4px 2px" },
  blueCell: { padding:"5px 8px", background:COL_BLUE_LIGHT, border:`1px solid ${COL_BLUE}55`, textAlign:"center", fontWeight:700, color:"#003a60", fontSize:13 },
  wkH:   { padding:"6px 10px", background:"#1a1a1a", color:"#aaa", fontWeight:700, fontSize:12, border:"1px solid #2a2a2a", whiteSpace:"nowrap", textAlign:"center" },
  wkSub: { padding:"3px 8px", background:"#111", color:"#555", fontSize:10, border:"1px solid #1f1f1f", textAlign:"center" },
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  page:      { minHeight:"100vh", background:"#0a0a0a", display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"20px 8px", fontFamily:"'Inter','Segoe UI',sans-serif", color:"#e8e8e8", boxSizing:"border-box" },
  loginCard: { background:"#111", border:"1px solid #1f1f1f", borderRadius:16, padding:32, width:"100%", maxWidth:520, marginTop:28 },
  logoRow:   { display:"flex", alignItems:"center", gap:16, marginBottom:22 },
  logoCircle:{ width:50, height:50, background:KK_RED, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 },
  logoTitle: { fontWeight:900, fontSize:21, letterSpacing:2, color:"#fff" },
  logoSub:   { fontSize:12, color:"#666", marginTop:2 },
  sectionLabel: { fontSize:11, fontWeight:700, letterSpacing:2, color:"#444", marginBottom:10, textTransform:"uppercase" },
  storeGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 },
  storeBtn:  { background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:10, padding:"12px 10px", cursor:"pointer", color:"#e8e8e8", display:"flex", flexDirection:"column", alignItems:"center", gap:3, transition:"background 0.15s, border-color 0.15s" },
  adminToggle:{ background:"none", border:"none", color:"#444", cursor:"pointer", fontSize:13, padding:0 },
  okBanner:  { background:"#001a0d", border:"1px solid #003a1a", borderRadius:8, padding:"8px 14px", fontSize:13, color:KK_GREEN, marginBottom:16 },
  warnBanner:{ background:"#1a1200", border:"1px solid #3a2a00", borderRadius:8, padding:"8px 14px", fontSize:13, color:"#f59e0b", marginBottom:16 },
  input:     { background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, padding:"8px 12px", color:"#e8e8e8", fontSize:14, outline:"none" },
  greenBtn:  { background:KK_GREEN, border:"none", borderRadius:8, padding:"8px 16px", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, whiteSpace:"nowrap" },
  shell:     { width:"100%", maxWidth:1200, display:"flex", flexDirection:"column" },
  header:    { background:"#111", border:"1px solid #1f1f1f", borderRadius:"12px 12px 0 0", padding:"12px 16px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" },
  backBtn:   { background:"none", border:"1px solid #2a2a2a", borderRadius:6, color:"#666", cursor:"pointer", fontSize:13, padding:"4px 10px" },
  headerTitle:{ fontWeight:800, fontSize:16, color:"#fff" },
  headerSub: { fontSize:12, color:"#555" },
  tabBtn:    { background:"none", border:"1px solid #222", borderRadius:7, color:"#666", cursor:"pointer", fontSize:12, padding:"5px 11px", fontWeight:600 },
  tabActive: { background:KK_GREEN, border:`1px solid ${KK_GREEN}`, color:"#fff" },
  dayBar:    { background:"#111", borderLeft:"1px solid #1f1f1f", borderRight:"1px solid #1f1f1f", borderBottom:"1px solid #1f1f1f", display:"flex", padding:"8px 12px", gap:5 },
  dayBtn:    { flex:1, background:"#1a1a1a", border:"1px solid #222", borderRadius:8, color:"#888", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", padding:"6px 2px", gap:1, minWidth:0 },
  dayActive: { background:KK_RED, border:`1px solid ${KK_RED}`, color:"#fff" },
  dot:       { position:"absolute", top:3, right:3, width:6, height:6, background:KK_GREEN, borderRadius:"50%" },
  entryArea: { background:"#111", border:"1px solid #1f1f1f", borderTop:"none", borderRadius:"0 0 12px 12px", padding:"16px 16px 28px", overflowY:"auto", maxHeight:"calc(100vh - 200px)" },
  loading:   { color:"#555", textAlign:"center", padding:40 },
  empty:     { color:"#444", textAlign:"center", padding:32 },
  catHead:   { fontSize:11, fontWeight:800, letterSpacing:2, color:KK_RED, textTransform:"uppercase", marginBottom:6, marginTop:4, paddingBottom:5, borderBottom:"1px solid #1a1a1a" },
  saveBtn:   { display:"block", width:"100%", marginTop:20, background:KK_GREEN, border:"none", borderRadius:10, padding:"13px", color:"#fff", fontWeight:800, fontSize:15, cursor:"pointer", letterSpacing:1 },
  select:    { background:"#1a1a1a", border:"1px solid #222", borderRadius:8, padding:"7px 12px", color:"#e8e8e8", fontSize:13, outline:"none" },
  removeBtn: { background:"none", border:"1px solid #222", borderRadius:5, color:"#555", cursor:"pointer", padding:"2px 7px", fontSize:11 },
};
