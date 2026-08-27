import { useState, useEffect, useCallback } from "react";

// ─── STORES ──────────────────────────────────────────────────────────────────
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

// 5 timed preps + 1 cierre = 6 prep/conteo pairs → cols 2-13
// col 14 = Total Producido (auto), col 15 = Total Vendido (auto)
const PREPS = ["7:00 AM","11:00 AM","3:00 PM","6:00 PM","9:00 PM","Cierre"];

const DAYS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

const TRAY_NOTE = `📋 TODOS LOS NÚMEROS SON EN BANDEJAS\nMinis = 27 unidades / bandeja\nDOTS = 48 unidades / bandeja\nRegulares = 12 unidades / bandeja`;

const APPS_SCRIPT_URL = "";
const USE_SHEETS = APPS_SCRIPT_URL.length > 0;

const KK_GREEN = "#00704A";
const KK_RED   = "#CC0000";
const COL_ORANGE = "#FFA500";
const COL_BLUE   = "#00B0F0";
const COL_ORANGE_LIGHT = "#FFF3E0";
const COL_BLUE_LIGHT   = "#E3F6FD";

// ─── STORAGE HELPERS ─────────────────────────────────────────────────────────
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

// ─── EMPTY ROW ────────────────────────────────────────────────────────────────
// For each flavor: { prep0, conteo0, prep1, conteo1, ... prep5, conteo5 }
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

// ─── COMPUTED COLS ────────────────────────────────────────────────────────────
function totalProducido(row) {
  // Sum of all PREP cells
  return PREPS.reduce((s, _, i) => s + (parseFloat(row[`prep${i}`]) || 0), 0);
}
function totalVendido(row) {
  // Sum of all PREP - Conteo del Cierre (last conteo)
  const sumPrep   = totalProducido(row);
  const cierreCnt = parseFloat(row[`conteo${PREPS.length-1}`]) || 0;
  return Math.max(0, sumPrep - cierreCnt);
}

// ─── API HELPERS ──────────────────────────────────────────────────────────────
async function sheetsPost(payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method:"POST", body:JSON.stringify(payload),
    headers:{"Content-Type":"application/json"},
  });
  return res.json();
}
async function sheetsGet(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${APPS_SCRIPT_URL}?${qs}`);
  return res.json();
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]   = useState("login");
  const [store, setStore]     = useState(null);
  const [flavors, setFlavors] = useState(() => loadLocal("kk_flavors", INITIAL_FLAVORS));
  const [offlineQ, setOfflineQ] = useState(() => loadLocal("kk_offline_q", []));

  useEffect(() => saveLocal("kk_flavors", flavors), [flavors]);
  useEffect(() => saveLocal("kk_offline_q", offlineQ), [offlineQ]);

  useEffect(() => {
    if (!USE_SHEETS) return;
    sheetsGet({ action:"getFlavors" })
      .then(d => { if (d.flavors) { setFlavors(d.flavors); saveLocal("kk_flavors", d.flavors); } })
      .catch(() => {});
  }, []);

  if (screen === "login")
    return <Login onStore={s => { setStore(s); setScreen("store"); }}
                  onAdmin={p => { if (p === "admin123") setScreen("admin"); else alert("Contraseña incorrecta"); }} />;
  if (screen === "store")
    return <StoreScreen store={store} flavors={flavors} offlineQ={offlineQ}
                        setOfflineQ={setOfflineQ} onBack={() => setScreen("login")} />;
  if (screen === "admin")
    return <AdminScreen flavors={flavors} setFlavors={setFlavors} onBack={() => setScreen("login")} />;
  return null;
}

// ─── LOGIN ─────────────────────────────────────────────────────────────────────
function Login({ onStore, onAdmin }) {
  const [pass, setPass]         = useState("");
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

        {/* Tray note on login too */}
        <TrayNote />

        <div style={S.sectionLabel}>SELECCIONA TU TIENDA</div>
        <div style={S.storeGrid}>
          {STORES.map(s => (
            <button key={s.id} style={S.storeBtn} onClick={() => onStore(s)}
              onMouseEnter={e => { e.currentTarget.style.background=KK_GREEN; e.currentTarget.style.borderColor=KK_GREEN; }}
              onMouseLeave={e => { e.currentTarget.style.background="#1a1a1a"; e.currentTarget.style.borderColor="#2a2a2a"; }}>
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
                  onKeyDown={e => e.key==="Enter" && onAdmin(pass)} />
                <button style={S.greenBtn} onClick={() => onAdmin(pass)}>Entrar</button>
              </div>
          }
        </div>
      </div>
    </div>
  );
}

// ─── TRAY NOTE COMPONENT ──────────────────────────────────────────────────────
function TrayNote() {
  return (
    <div style={{
      background:"#1a1200", border:`1.5px solid ${COL_ORANGE}`,
      borderRadius:8, padding:"10px 14px", marginBottom:18,
      fontSize:13, lineHeight:1.7, color:"#ffe0a0",
    }}>
      <strong style={{ color:COL_ORANGE }}>📋 TODOS LOS NÚMEROS SON EN BANDEJAS</strong><br/>
      Minis = 27 unidades / bandeja &nbsp;·&nbsp; DOTS = 48 unidades / bandeja &nbsp;·&nbsp; Regulares = 12 unidades / bandeja
    </div>
  );
}

// ─── STORE SCREEN ─────────────────────────────────────────────────────────────
function StoreScreen({ store, flavors, offlineQ, setOfflineQ, onBack }) {
  const today     = new Date();
  const weekStart = getWeekStart(today);
  const todayIdx  = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const [dayIdx, setDayIdx]   = useState(todayIdx);
  const [tab, setTab]         = useState("entry");
  const [loading, setLoading] = useState(false);
  const [savedDays, setSavedDays] = useState({});
  const [formData, setFormData]   = useState(() => emptyForm(flavors));
  const [syncing, setSyncing]     = useState(false);

  const dayDate = new Date(weekStart); dayDate.setDate(dayDate.getDate() + dayIdx);

  // Load week from storage
  useEffect(() => {
    async function load() {
      setLoading(true);
      if (USE_SHEETS) {
        try {
          const res = await sheetsGet({ action:"getWeek", storeId:store.id, weekStart:fmt(weekStart) });
          if (res.days) setSavedDays(res.days);
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
  }, [store.id]);

  // Populate form when day changes
  useEffect(() => {
    setFormData(savedDays[dayIdx]?.data ?? emptyForm(flavors));
  }, [dayIdx, savedDays, flavors]);

  function handleChange(flavor, field, val) {
    setFormData(prev => ({
      ...prev,
      [flavor]: { ...prev[flavor], [field]: val },
    }));
  }

  async function handleSave() {
    const record = {
      action:    "saveDay",
      storeId:   store.id,
      storeName: store.name,
      weekStart: fmt(weekStart),
      dayIdx,
      dayName:   DAYS[dayIdx],
      date:      fmt(dayDate),
      data:      formData,
      savedAt:   new Date().toISOString(),
    };
    setSavedDays(prev => ({ ...prev, [dayIdx]: record }));
    if (!USE_SHEETS) {
      saveLocal(`kk_entry__${store.id}__${fmt(weekStart)}__${dayIdx}`, record);
      alert(`✅ Guardado — ${DAYS[dayIdx]} ${fmt(dayDate)}`);
      return;
    }
    setSyncing(true);
    try {
      await sheetsPost(record);
      setSyncing(false);
      alert(`✅ Enviado — ${DAYS[dayIdx]} ${fmt(dayDate)}`);
    } catch {
      setOfflineQ(prev => [...prev.filter(x =>
        !(x.storeId===record.storeId && x.weekStart===record.weekStart && x.dayIdx===record.dayIdx)
      ), record]);
      setSyncing(false);
      alert(`📶 Sin conexión — guardado localmente. Se enviará cuando haya internet.`);
    }
  }

  // Weekly summary across saved days
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
        {/* Header */}
        <div style={S.header}>
          <button style={S.backBtn} onClick={onBack}>← Salir</button>
          <div style={{ flex:1 }}>
            <div style={S.headerTitle}>{store.id} — {store.name}</div>
            <div style={S.headerSub}>Semana: {weekLabel(weekStart)}{syncing ? " · Sincronizando…" : ""}</div>
          </div>
          <TabBar tabs={[{k:"entry",label:"📝 Entrada"},{k:"weekly",label:"📊 Resumen Semanal"}]}
                  active={tab} setActive={setTab} />
        </div>

        {tab === "entry" && (
          <>
            {/* Day selector */}
            <div style={S.dayBar}>
              {DAYS.map((d, i) => {
                const dd = new Date(weekStart); dd.setDate(dd.getDate()+i);
                const has = !!savedDays[i];
                return (
                  <button key={i} style={{ ...S.dayBtn, ...(i===dayIdx ? S.dayActive : {}), position:"relative" }}
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
                  {/* Flavor rows per category — first one carries the full header */}
                  {Object.entries(flavors).map(([cat, fls], catIdx) => (
                    <div key={cat} style={{ marginBottom:20 }}>
                      <div style={S.catHead}>{cat}</div>
                      <FlavorTable fls={fls} formData={formData} onChange={handleChange}
                                   firstCategory={catIdx === 0} />
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

// ─── COLGROUP — single source of truth for all column widths ─────────────────
// Col 1: flavor name 160px | cols 2-13: 12 input cols 58px each | cols 14-15: 90px each
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

// ─── SHARED TABLE HEADER (used on every category table) ───────────────────────
function TableHeader({ firstCategory }) {
  // Only show the full 2-row header on the very first category
  if (!firstCategory) {
    return (
      <thead>
        <tr>
          <th style={{ ...Tc.hBase, background:"#1a1a1a", color:"#555", padding:"3px 8px" }}></th>
          {PREPS.map((_, i) => (
            <>
              <th key={`p${i}`} style={{ ...Tc.subH, background:COL_ORANGE, color:"#5a2d00" }}>PREP</th>
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
      {/* Row 1: time slot groups */}
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
      {/* Row 2: PREP / Conteo sub-headers */}
      <tr>
        <th style={{ ...Tc.subH, background:"#111", color:"#555" }}></th>
        {PREPS.map((_, i) => (
          <>
            <th key={`p${i}`} style={{ ...Tc.subH, background:COL_ORANGE, color:"#5a2d00",
              borderLeft:"2px solid #c47a00" }}>PREP</th>
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
// Each category gets its own table but they all share the same colgroup widths,
// so columns stay perfectly aligned across the page.
function FlavorTable({ fls, formData, onChange, firstCategory }) {
  return (
    <div style={{ overflowX:"auto" }}>
      <table style={{ borderCollapse:"collapse", tableLayout:"fixed", width:"100%", fontSize:13 }}>
        <TableColGroup />
        <TableHeader firstCategory={firstCategory} />
        <tbody>
          {fls.map(fl => {
            const row = formData[fl] ?? emptyRow();
            const totProd = totalProducido(row);
            const totVend = totalVendido(row);
            return (
              <tr key={fl} style={{ borderBottom:"1px solid #1e1e1e" }}>
                {/* Flavor name */}
                <td style={{ ...Tc.flavor }}>{fl}</td>

                {/* 6 × PREP + Conteo pairs (orange, editable) */}
                {PREPS.map((_, i) => (
                  <>
                    <td key={`p${i}`} style={{ ...Tc.orangeCell,
                      borderLeft: i === 0 ? `2px solid ${COL_ORANGE}` : `2px solid #c47a0044` }}>
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

                {/* Total Producido (blue, read-only) */}
                <td style={Tc.blueCell}>{totProd || "—"}</td>

                {/* Total Vendido (blue, read-only) */}
                <td style={Tc.blueCell}>{totVend || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── WEEKLY SUMMARY TABLE ─────────────────────────────────────────────────────
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
                  <td style={{ ...Tc.wkSub, background:"#0a2a0a", color:"#4aaa4a", fontSize:11 }}>=IFERROR((Prod−Vend)/Prod, 0)</td>
                </tr>
              </thead>
              <tbody>
                {summary.map(r => {
                  const burn = r.prod > 0 ? ((r.prod - r.vend) / r.prod * 100).toFixed(1) : null;
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

  async function addFlavor() {
    const name = newFlavor.trim(); if (!name) return;
    const updated = { ...flavors, [newCat]: [...(flavors[newCat]||[]), name] };
    setFlavors(updated); setNF("");
    if (USE_SHEETS) await sheetsPost({ action:"saveFlavors", flavors:updated });
  }
  async function removeFlavor(cat, fl) {
    if (!confirm(`¿Eliminar "${fl}"?`)) return;
    const updated = { ...flavors, [cat]: flavors[cat].filter(f => f!==fl) };
    setFlavors(updated);
    if (USE_SHEETS) await sheetsPost({ action:"saveFlavors", flavors:updated });
  }
  async function addCategory() {
    const name = newCatName.trim().toUpperCase();
    if (!name || flavors[name]) return;
    const updated = { ...flavors, [name]: [] };
    setFlavors(updated); setNC(name); setNCN("");
    if (USE_SHEETS) await sheetsPost({ action:"saveFlavors", flavors:updated });
  }

  return (
    <div style={S.page}>
      <div style={S.shell}>
        <div style={S.header}>
          <button style={S.backBtn} onClick={onBack}>← Salir</button>
          <div style={{ flex:1 }}>
            <div style={S.headerTitle}>Panel de Administrador</div>
            <div style={S.headerSub}>{USE_SHEETS ? "✅ Conectado" : "⚠️ Modo local"}</div>
          </div>
          <TabBar tabs={[{k:"flavors",label:"🍩 Sabores"},{k:"export",label:"📤 Exportar"}]}
                  active={aTab} setActive={setATab} />
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
                onKeyDown={e => e.key==="Enter" && addFlavor()} />
              <button style={S.greenBtn} onClick={addFlavor}>+ Agregar</button>
            </div>
            <div style={{ display:"flex", gap:8, marginBottom:24 }}>
              <input style={{ ...S.input, flex:1 }} placeholder="Nueva categoría"
                value={newCatName} onChange={e => setNCN(e.target.value)}
                onKeyDown={e => e.key==="Enter" && addCategory()} />
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

        {aTab === "export" && <ExportTab flavors={flavors} />}
      </div>
    </div>
  );
}

// ─── EXPORT TAB ───────────────────────────────────────────────────────────────
function ExportTab({ flavors }) {
  const [filterStore, setFS] = useState("ALL");
  const [filterWeek, setFW]  = useState("ALL");

  // Collect all local entries
  const allEntries = [];
  STORES.forEach(st => {
    for (let w = 0; w < 52; w++) {
      const ws = getWeekStart(new Date(Date.now() - w*7*24*60*60*1000));
      DAYS.forEach((_, di) => {
        const rec = loadLocal(`kk_entry__${st.id}__${fmt(ws)}__${di}`, null);
        if (rec) allEntries.push(rec);
      });
    }
  });

  const weeks = [...new Set(allEntries.map(e => e.weekStart))].sort().reverse();

  const filtered = allEntries.filter(e =>
    (filterStore === "ALL" || e.storeId === filterStore) &&
    (filterWeek  === "ALL" || e.weekStart === filterWeek)
  );

  function buildRows() {
    const groups = {};
    filtered.forEach(e => {
      const gk = `${e.storeId}__${e.weekStart}`;
      if (!groups[gk]) groups[gk] = { storeId:e.storeId, storeName:e.storeName, weekStart:e.weekStart, days:[] };
      groups[gk].days.push(e);
    });
    const rows = [];
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
          const burn = prod > 0 ? ((prod-vend)/prod*100).toFixed(1) : "N/A";
          rows.push({ store:g.storeId, storeName:g.storeName, weekStart:g.weekStart, fl, prod, vend, burn });
        }
      });
    });
    return rows;
  }

  function downloadCSV() {
    const rows = buildRows();
    if (!rows.length) { alert("No hay datos."); return; }
    const header = "Store #,Store Name,Week Start,Flavor,Total Producido,Total Vendido,% Burn Rate";
    const csv = [header, ...rows.map(r =>
      `${r.store},"${r.storeName}","${r.weekStart}","${r.fl}",${r.prod},${r.vend},${r.burn}`
    )].join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `kk_burnrate_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  const pbiRows = buildRows();

  return (
    <div style={S.entryArea}>
      <div style={S.sectionLabel}>EXPORTAR PARA POWER BI</div>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
        <select style={S.select} value={filterStore} onChange={e => setFS(e.target.value)}>
          <option value="ALL">Todas las tiendas</option>
          {STORES.map(s => <option key={s.id} value={s.id}>{s.id} — {s.name}</option>)}
        </select>
        <select style={S.select} value={filterWeek} onChange={e => setFW(e.target.value)}>
          <option value="ALL">Todas las semanas</option>
          {weeks.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
        <button style={S.greenBtn} onClick={downloadCSV}>⬇ CSV ({pbiRows.length} filas)</button>
      </div>

      {pbiRows.length > 0 && (
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
              {pbiRows.slice(0,15).map((r,i) => (
                <tr key={i} style={{ borderBottom:"1px solid #141414" }}>
                  <td style={{ padding:"5px 8px", color:KK_GREEN, fontWeight:700 }}>{r.store}</td>
                  <td style={{ padding:"5px 8px", color:"#ccc" }}>{r.storeName}</td>
                  <td style={{ padding:"5px 8px", color:"#ccc" }}>{r.weekStart}</td>
                  <td style={{ padding:"5px 8px", color:"#ccc" }}>{r.fl}</td>
                  <td style={{ padding:"5px 8px", textAlign:"center", color:"#ccc" }}>{r.prod}</td>
                  <td style={{ padding:"5px 8px", textAlign:"center", color:"#ccc" }}>{r.vend}</td>
                  <td style={{ padding:"5px 8px", textAlign:"center", fontWeight:700,
                    color: parseFloat(r.burn) <= 10 ? "#4ade80" : parseFloat(r.burn) <= 25 ? "#facc15" : KK_RED }}>
                    {r.burn !== "N/A" ? `${r.burn}%` : "—"}
                  </td>
                </tr>
              ))}
              {pbiRows.length > 15 && (
                <tr><td colSpan={7} style={{ padding:"6px 8px", color:"#555", textAlign:"center", fontSize:12 }}>
                  … y {pbiRows.length-15} filas más
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function TabBar({ tabs, active, setActive }) {
  return (
    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
      {tabs.map(t => (
        <button key={t.k}
          style={{ ...S.tabBtn, ...(active===t.k ? S.tabActive : {}) }}
          onClick={() => setActive(t.k)}>{t.label}</button>
      ))}
    </div>
  );
}

// ─── TABLE CELL STYLES ────────────────────────────────────────────────────────
const Tc = {
  hBase: {
    padding:"5px 4px", border:"1px solid #333", fontWeight:700,
    textAlign:"center", fontSize:11, whiteSpace:"nowrap",
  },
  subH: {
    padding:"3px 4px", border:"1px solid #333", fontWeight:400,
    textAlign:"center", fontSize:10, whiteSpace:"nowrap",
  },
  flavor: {
    padding:"5px 8px", minWidth:140, maxWidth:180, color:"#ddd",
    fontSize:12, border:"1px solid #1a1a1a", whiteSpace:"nowrap",
    overflow:"hidden", textOverflow:"ellipsis",
  },
  orangeCell: {
    padding:0, background:COL_ORANGE_LIGHT,
    border:`1px solid ${COL_ORANGE}44`,
  },
  orangeInput: {
    width:"100%", boxSizing:"border-box",
    background:"transparent", border:"none", outline:"none",
    textAlign:"center", fontSize:13, color:"#000", fontWeight:600,
    padding:"4px 2px",
  },
  blueCell: {
    padding:"5px 8px", background:COL_BLUE_LIGHT, border:`1px solid ${COL_BLUE}55`,
    textAlign:"center", fontWeight:700, color:"#003a60", fontSize:13,
  },
  wkH: {
    padding:"6px 10px", background:"#1a1a1a", color:"#aaa",
    fontWeight:700, fontSize:12, border:"1px solid #2a2a2a", whiteSpace:"nowrap",
    textAlign:"center",
  },
  wkSub: {
    padding:"3px 8px", background:"#111", color:"#555",
    fontSize:10, border:"1px solid #1f1f1f", textAlign:"center",
  },
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight:"100vh", background:"#0a0a0a",
    display:"flex", alignItems:"flex-start", justifyContent:"center",
    padding:"20px 8px", fontFamily:"'Inter','Segoe UI',sans-serif",
    color:"#e8e8e8", boxSizing:"border-box",
  },
  loginCard: {
    background:"#111", border:"1px solid #1f1f1f", borderRadius:16,
    padding:32, width:"100%", maxWidth:520, marginTop:28,
  },
  logoRow: { display:"flex", alignItems:"center", gap:16, marginBottom:22 },
  logoCircle: {
    width:50, height:50, background:KK_RED, borderRadius:"50%",
    display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0,
  },
  logoTitle: { fontWeight:900, fontSize:21, letterSpacing:2, color:"#fff" },
  logoSub:   { fontSize:12, color:"#666", marginTop:2 },
  sectionLabel: {
    fontSize:11, fontWeight:700, letterSpacing:2, color:"#444",
    marginBottom:10, textTransform:"uppercase",
  },
  storeGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 },
  storeBtn: {
    background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:10,
    padding:"12px 10px", cursor:"pointer", color:"#e8e8e8",
    display:"flex", flexDirection:"column", alignItems:"center", gap:3,
    transition:"background 0.15s, border-color 0.15s",
  },
  adminToggle: { background:"none", border:"none", color:"#444", cursor:"pointer", fontSize:13, padding:0 },
  input: {
    background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8,
    padding:"8px 12px", color:"#e8e8e8", fontSize:14, outline:"none",
  },
  greenBtn: {
    background:KK_GREEN, border:"none", borderRadius:8, padding:"8px 16px",
    color:"#fff", fontWeight:700, cursor:"pointer", fontSize:13, whiteSpace:"nowrap",
  },
  shell:  { width:"100%", maxWidth:1200, display:"flex", flexDirection:"column" },
  header: {
    background:"#111", border:"1px solid #1f1f1f", borderRadius:"12px 12px 0 0",
    padding:"12px 16px", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap",
  },
  backBtn: {
    background:"none", border:"1px solid #2a2a2a", borderRadius:6,
    color:"#666", cursor:"pointer", fontSize:13, padding:"4px 10px",
  },
  headerTitle: { fontWeight:800, fontSize:16, color:"#fff" },
  headerSub:   { fontSize:12, color:"#555" },
  tabBtn: {
    background:"none", border:"1px solid #222", borderRadius:7,
    color:"#666", cursor:"pointer", fontSize:12, padding:"5px 11px", fontWeight:600,
  },
  tabActive: { background:KK_GREEN, border:`1px solid ${KK_GREEN}`, color:"#fff" },
  dayBar: {
    background:"#111", borderLeft:"1px solid #1f1f1f", borderRight:"1px solid #1f1f1f",
    borderBottom:"1px solid #1f1f1f", display:"flex", padding:"8px 12px", gap:5,
  },
  dayBtn: {
    flex:1, background:"#1a1a1a", border:"1px solid #222", borderRadius:8,
    color:"#888", cursor:"pointer", display:"flex", flexDirection:"column",
    alignItems:"center", padding:"6px 2px", gap:1, minWidth:0,
  },
  dayActive: { background:KK_RED, border:`1px solid ${KK_RED}`, color:"#fff" },
  dot: {
    position:"absolute", top:3, right:3, width:6, height:6,
    background:KK_GREEN, borderRadius:"50%",
  },
  entryArea: {
    background:"#111", border:"1px solid #1f1f1f", borderTop:"none",
    borderRadius:"0 0 12px 12px", padding:"16px 16px 28px",
    overflowY:"auto", maxHeight:"calc(100vh - 200px)",
  },
  loading: { color:"#555", textAlign:"center", padding:40 },
  empty:   { color:"#444", textAlign:"center", padding:32 },
  catHead: {
    fontSize:11, fontWeight:800, letterSpacing:2, color:KK_RED,
    textTransform:"uppercase", marginBottom:6, marginTop:4,
    paddingBottom:5, borderBottom:"1px solid #1a1a1a",
  },
  saveBtn: {
    display:"block", width:"100%", marginTop:20,
    background:KK_GREEN, border:"none", borderRadius:10,
    padding:"13px", color:"#fff", fontWeight:800, fontSize:15,
    cursor:"pointer", letterSpacing:1,
  },
  select: {
    background:"#1a1a1a", border:"1px solid #222", borderRadius:8,
    padding:"7px 12px", color:"#e8e8e8", fontSize:13, outline:"none",
  },
  removeBtn: {
    background:"none", border:"1px solid #222", borderRadius:5,
    color:"#555", cursor:"pointer", padding:"2px 7px", fontSize:11,
  },
};
