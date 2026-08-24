"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Home, ListTree, TrendingUp, CalendarDays, Plus, X, Milk, Baby,
  Droplet, Moon, Thermometer, Check, Trash2, Sparkles, AlertTriangle,
  ExternalLink, RefreshCw,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { supabase } from "../lib/supabase";
import { fetchRappelsBebe } from "../lib/rappels";

const INK = "#332D3E";
const PAPER = "#FBF7F1";
const CARD = "#FFFFFF";
const SAGE = "#7C9473";
const SAGE_SOFT = "#E4EAE0";
const BLUSH = "#D98E93";
const BLUSH_SOFT = "#F6E3E2";
const LAVENDER = "#8F80B0";
const LAVENDER_SOFT = "#E9E4F3";
const AMBER = "#C98A3E";
const AMBER_SOFT = "#F3E5CE";
const LINE = "#E7DFD3";

const PARENTS = [
  { id: "maman", label: "Maman", color: BLUSH, soft: BLUSH_SOFT },
  { id: "papa", label: "Papa", color: SAGE, soft: SAGE_SOFT },
  { id: "autre", label: "Autre", color: AMBER, soft: AMBER_SOFT },
];

const uid = () => Math.random().toString(36).slice(2, 10);
const emptyData = () => ({ events: [], appointments: [], growth: [] });
const ROW_ID = "default";

function useBabyData() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const savingRef = useRef(false);

  useEffect(() => {
    let channel;

    const load = async () => {
      const { data: row, error } = await supabase
        .from("baby_data")
        .select("payload")
        .eq("id", ROW_ID)
        .single();

      if (error || !row) {
        await supabase.from("baby_data").insert({ id: ROW_ID, payload: emptyData() });
        setData(emptyData());
      } else {
        setData(row.payload);
      }
      setStatus("ready");
    };

    load();

    channel = supabase
      .channel("baby_data_changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "baby_data", filter: `id=eq.${ROW_ID}` },
        (payload) => {
          if (!savingRef.current) setData(payload.new.payload);
          savingRef.current = false;
        }
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const persist = useCallback(async (next) => {
    setData(next);
    savingRef.current = true;
    await supabase.from("baby_data").update({ payload: next, updated_at: new Date().toISOString() }).eq("id", ROW_ID);
  }, []);

  return { data, status, persist };
}

const fmtTime = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const fmtDay = (iso) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
const fmtDayLong = (iso) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
const dayKey = (iso) => new Date(iso).toISOString().slice(0, 10);
const nowLocalInput = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const TYPE_META = {
  biberon: { label: "Biberon", icon: Milk, color: AMBER, soft: AMBER_SOFT },
  allaitement: { label: "Allaitement", icon: Baby, color: BLUSH, soft: BLUSH_SOFT },
  couche: { label: "Couche", icon: Droplet, color: "#A97C50", soft: "#EFE1D2" },
  sommeil: { label: "Sommeil", icon: Moon, color: LAVENDER, soft: LAVENDER_SOFT },
  temperature: { label: "Température", icon: Thermometer, color: "#C1554B", soft: "#F4DEDB" },
};

export default function Page() {
  const { data, status, persist } = useBabyData();
  const [tab, setTab] = useState("accueil");
  const [parent, setParent] = useState("maman");
  const [modal, setModal] = useState(null);

  if (status === "loading" || !data) return <LoadingScreen />;

  const addEvent = (evt) => persist({ ...data, events: [{ id: uid(), parent, ...evt }, ...data.events] });
  const removeEvent = (id) => persist({ ...data, events: data.events.filter((e) => e.id !== id) });

  const addAppointment = (appt) =>
    persist({ ...data, appointments: [...data.appointments, { id: uid(), parent, done: false, ...appt }] });
  const toggleAppointment = (id) =>
    persist({ ...data, appointments: data.appointments.map((a) => (a.id === id ? { ...a, done: !a.done } : a)) });
  const removeAppointment = (id) => persist({ ...data, appointments: data.appointments.filter((a) => a.id !== id) });

  const addGrowth = (g) => persist({ ...data, growth: [...data.growth, { id: uid(), parent, ...g }] });
  const removeGrowth = (id) => persist({ ...data, growth: data.growth.filter((g) => g.id !== id) });

  return (
    <div style={styles.app}>
      <Header parent={parent} setParent={setParent} />
      <main style={styles.main}>
        {tab === "accueil" && <Accueil data={data} setTab={setTab} />}
        {tab === "journal" && <Journal data={data} onRemove={removeEvent} />}
        {tab === "courbes" && (
          <Courbes data={data} onAddGrowth={() => setModal({ type: "growth" })} onRemoveGrowth={removeGrowth} />
        )}
        {tab === "rdv" && (
          <RendezVous data={data} onAdd={() => setModal({ type: "appointment" })} onToggle={toggleAppointment} onRemove={removeAppointment} />
        )}
        {tab === "rappels" && <Rappels />}
      </main>

      <QuickAddBar onPick={(type) => setModal({ type })} />
      <BottomNav tab={tab} setTab={setTab} />

      {modal?.type && TYPE_META[modal.type] && (
        <EventModal type={modal.type} onClose={() => setModal(null)} onSave={(evt) => { addEvent(evt); setModal(null); }} />
      )}
      {modal?.type === "appointment" && (
        <AppointmentModal onClose={() => setModal(null)} onSave={(a) => { addAppointment(a); setModal(null); }} />
      )}
      {modal?.type === "growth" && (
        <GrowthModal onClose={() => setModal(null)} onSave={(g) => { addGrowth(g); setModal(null); }} />
      )}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ ...styles.app, alignItems: "center", justifyContent: "center", display: "flex" }}>
      <div style={{ textAlign: "center", color: INK }}>
        <Sparkles size={22} style={{ opacity: 0.5 }} />
        <p style={{ fontFamily: "Fraunces, serif", marginTop: 8 }}>Ouverture du carnet…</p>
      </div>
    </div>
  );
}

function Header({ parent, setParent }) {
  return (
    <header style={styles.header}>
      <div>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 22, fontWeight: 600, color: INK }}>Petit Carnet</div>
        <div style={{ fontSize: 12, color: "#8A8390", textTransform: "capitalize" }}>{fmtDayLong(new Date().toISOString())}</div>
      </div>
      <div style={styles.parentPicker}>
        {PARENTS.map((p) => (
          <button
            key={p.id}
            onClick={() => setParent(p.id)}
            style={{ ...styles.parentPill, background: parent === p.id ? p.color : "transparent", color: parent === p.id ? "#fff" : INK }}
          >
            {p.label}
          </button>
        ))}
      </div>
    </header>
  );
}

function Accueil({ data, setTab }) {
  const todays = data.events.filter((e) => isToday(e.timestamp));
  const biberons = todays.filter((e) => e.type === "biberon");
  const totalLait = biberons.reduce((s, e) => s + (Number(e.quantityDrunk) || 0), 0);
  const tetees = todays.filter((e) => e.type === "allaitement").length;
  const lastCouche = data.events.find((e) => e.type === "couche");
  const lastRepas = data.events.find((e) => e.type === "biberon" || e.type === "allaitement");
  const lastSommeil = data.events.find((e) => e.type === "sommeil");
  const nextAppt = data.appointments.filter((a) => !a.done && new Date(a.datetime) >= new Date()).sort((a, b) => new Date(a.datetime) - new Date(b.datetime))[0];

  return (
    <div style={styles.stack}>
      <DayRibbon events={todays} />
      <div style={styles.statGrid}>
        <StatCard label="Biberons aujourd'hui" value={biberons.length} sub={`${totalLait} ml au total`} color={AMBER} soft={AMBER_SOFT} />
        <StatCard label="Tétées aujourd'hui" value={tetees} color={BLUSH} soft={BLUSH_SOFT} />
        <MiniCard label="Dernière couche" value={lastCouche ? fmtTime(lastCouche.timestamp) : "—"} icon={Droplet} color="#A97C50" />
        <MiniCard label="Dernier repas" value={lastRepas ? fmtTime(lastRepas.timestamp) : "—"} icon={Milk} color={AMBER} />
        <MiniCard label="Dernier sommeil" value={lastSommeil ? fmtTime(lastSommeil.timestamp) : "—"} icon={Moon} color={LAVENDER} />
        <MiniCard label="Prochain RDV" value={nextAppt ? nextAppt.title : "Aucun"} sub={nextAppt ? fmtDay(nextAppt.datetime) : null} icon={CalendarDays} color={SAGE} onClick={() => setTab("rdv")} />
      </div>
    </div>
  );
}

function DayRibbon({ events }) {
  const items = events.filter((e) => e.type !== "sommeil" || e.end).map((e) => {
    const d = new Date(e.timestamp);
    return { ...e, pct: ((d.getHours() * 60 + d.getMinutes()) / 1440) * 100 };
  });
  const nowPct = (() => { const d = new Date(); return ((d.getHours() * 60 + d.getMinutes()) / 1440) * 100; })();

  return (
    <div style={styles.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={styles.cardTitle}>Ruban du jour</span>
        <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 11, color: "#8A8390" }}>00h — 24h</span>
      </div>
      <div style={{ position: "relative", height: 46, marginTop: 18 }}>
        <div style={{ position: "absolute", top: 20, left: 0, right: 0, height: 2, background: LINE, borderRadius: 2 }} />
        <div style={{ position: "absolute", top: 14, left: `${nowPct}%`, width: 1, height: 14, background: INK, opacity: 0.35 }} />
        {items.length === 0 && <div style={{ position: "absolute", top: 0, left: 0, fontSize: 12, color: "#B0A9B5" }}>Rien noté pour l'instant aujourd'hui.</div>}
        {items.map((it) => {
          const meta = TYPE_META[it.type];
          return <div key={it.id} title={`${meta.label} · ${fmtTime(it.timestamp)}`} style={{ position: "absolute", top: 12, left: `calc(${it.pct}% - 8px)`, width: 16, height: 16, borderRadius: 999, background: meta.color, border: "2px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />;
        })}
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
        {Object.entries(TYPE_META).map(([k, m]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#8A8390" }}>
            <div style={{ width: 8, height: 8, borderRadius: 999, background: m.color }} />
            {m.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, soft }) {
  return (
    <div style={{ ...styles.card, background: soft }}>
      <div style={{ fontSize: 12, color: INK, opacity: 0.75 }}>{label}</div>
      <div style={{ fontFamily: "Fraunces, serif", fontSize: 32, fontWeight: 600, color, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#8A8390", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function MiniCard({ label, value, sub, icon: Icon, color, onClick }) {
  return (
    <div style={{ ...styles.card, cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 999, background: `${color}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={14} color={color} />
        </div>
        <div style={{ fontSize: 12, color: "#8A8390" }}>{label}</div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: INK, marginTop: 8 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#B0A9B5" }}>{sub}</div>}
    </div>
  );
}

function Journal({ data, onRemove }) {
  const [filter, setFilter] = useState("all");
  const events = data.events.filter((e) => filter === "all" || e.type === filter);
  const groups = useMemo(() => {
    const g = {};
    events.forEach((e) => { const k = dayKey(e.timestamp); g[k] = g[k] || []; g[k].push(e); });
    return Object.entries(g).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [events]);

  return (
    <div style={styles.stack}>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        <FilterChip label="Tout" active={filter === "all"} onClick={() => setFilter("all")} />
        {Object.entries(TYPE_META).map(([k, m]) => (
          <FilterChip key={k} label={m.label} color={m.color} active={filter === k} onClick={() => setFilter(k)} />
        ))}
      </div>
      {groups.length === 0 && <EmptyState text="Aucun évènement pour ce filtre." />}
      {groups.map(([day, evts]) => (
        <div key={day}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#8A8390", margin: "10px 2px", textTransform: "capitalize" }}>{fmtDayLong(evts[0].timestamp)}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {evts.map((e) => <EventRow key={e.id} evt={e} onRemove={() => onRemove(e.id)} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function FilterChip({ label, active, onClick, color }) {
  return (
    <button onClick={onClick} style={{ flexShrink: 0, padding: "6px 13px", borderRadius: 999, border: `1px solid ${active ? (color || INK) : LINE}`, background: active ? (color ? `${color}22` : SAGE_SOFT) : "#fff", color: active ? INK : "#8A8390", fontSize: 12, fontWeight: 600 }}>
      {label}
    </button>
  );
}

function EventRow({ evt, onRemove }) {
  const meta = TYPE_META[evt.type];
  const Icon = meta.icon;
  const parentMeta = PARENTS.find((p) => p.id === evt.parent);
  return (
    <div style={{ ...styles.card, display: "flex", alignItems: "center", gap: 12, padding: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: meta.soft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={16} color={meta.color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{eventSummary(evt)}</div>
        <div style={{ fontSize: 11, color: "#B0A9B5", display: "flex", gap: 6, alignItems: "center" }}>
          {fmtTime(evt.timestamp)}
          {parentMeta && <span style={{ color: parentMeta.color, fontWeight: 600 }}>· {parentMeta.label}</span>}
        </div>
      </div>
      <button onClick={onRemove} style={styles.iconBtn}><Trash2 size={14} color="#B0A9B5" /></button>
    </div>
  );
}

function eventSummary(e) {
  switch (e.type) {
    case "biberon": return `Biberon — ${e.quantityDrunk || 0} ml bus (${e.quantityPrepared || 0} ml préparés)`;
    case "allaitement": return `Allaitement — ${e.side || ""} · ${e.durationMin || 0} min`;
    case "couche": return `Couche — ${e.kind}`;
    case "sommeil": return e.end ? `Sommeil — ${sleepDurationLabel(e.timestamp, e.end)}` : "Sommeil — en cours";
    case "temperature": return `Température — ${e.value} °C`;
    default: return TYPE_META[e.type]?.label || e.type;
  }
}

function sleepDurationLabel(start, end) {
  const mins = Math.round((new Date(end) - new Date(start)) / 60000);
  return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`;
}

function EmptyState({ text }) {
  return <div style={{ textAlign: "center", padding: "40px 16px", color: "#B0A9B5" }}><p style={{ fontFamily: "Fraunces, serif", fontSize: 15 }}>{text}</p></div>;
}

function Courbes({ data, onAddGrowth, onRemoveGrowth }) {
  const days = useMemo(() => lastNDays(14), []);
  const sleepByDay = days.map((d) => {
    const total = data.events.filter((e) => e.type === "sommeil" && e.end && dayKey(e.timestamp) === d.key).reduce((s, e) => s + (new Date(e.end) - new Date(e.timestamp)) / 3600000, 0);
    return { label: d.label, heures: Math.round(total * 10) / 10 };
  });
  const foodByDay = days.map((d) => {
    const ml = data.events.filter((e) => e.type === "biberon" && dayKey(e.timestamp) === d.key).reduce((s, e) => s + (Number(e.quantityDrunk) || 0), 0);
    return { label: d.label, ml };
  });
  const growth = [...data.growth].sort((a, b) => new Date(a.date) - new Date(b.date));
  const weightData = growth.filter((g) => g.weight).map((g) => ({ label: fmtDay(g.date), kg: Number(g.weight), id: g.id }));
  const heightData = growth.filter((g) => g.height).map((g) => ({ label: fmtDay(g.date), cm: Number(g.height), id: g.id }));

  return (
    <div style={styles.stack}>
      <ChartCard title="Sommeil (heures / jour)" subtitle="14 derniers jours">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={sleepByDay}>
            <CartesianGrid stroke={LINE} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8A8390" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#8A8390" }} axisLine={false} tickLine={false} width={26} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} h`, "Sommeil"]} />
            <Bar dataKey="heures" fill={LAVENDER} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Lait bu au biberon (ml / jour)" subtitle="14 derniers jours">
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={foodByDay}>
            <CartesianGrid stroke={LINE} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8A8390" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#8A8390" }} axisLine={false} tickLine={false} width={30} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} ml`, "Lait"]} />
            <Bar dataKey="ml" fill={AMBER} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Courbe de poids" subtitle="comme dans le carnet de santé" action={<button onClick={onAddGrowth} style={styles.smallBtn}><Plus size={13} /> Mesure</button>}>
        {weightData.length === 0 ? <EmptyState text="Ajoute une première mesure de poids." /> : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={weightData}>
              <CartesianGrid stroke={LINE} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8A8390" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#8A8390" }} axisLine={false} tickLine={false} width={30} domain={["auto", "auto"]} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} kg`, "Poids"]} />
              <Line type="monotone" dataKey="kg" stroke={SAGE} strokeWidth={2.5} dot={{ r: 4, fill: SAGE }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Courbe de taille" subtitle="comme dans le carnet de santé">
        {heightData.length === 0 ? <EmptyState text="Ajoute une première mesure de taille." /> : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={heightData}>
              <CartesianGrid stroke={LINE} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8A8390" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#8A8390" }} axisLine={false} tickLine={false} width={30} domain={["auto", "auto"]} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} cm`, "Taille"]} />
              <Line type="monotone" dataKey="cm" stroke={BLUSH} strokeWidth={2.5} dot={{ r: 4, fill: BLUSH }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {growth.length > 0 && (
        <div style={styles.card}>
          <span style={styles.cardTitle}>Mesures enregistrées</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {[...growth].reverse().map((g) => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: `1px solid ${LINE}` }}>
                <span style={{ color: "#8A8390" }}>{fmtDay(g.date)}</span>
                <span style={{ fontFamily: "IBM Plex Mono, monospace", color: INK }}>{g.weight ? `${g.weight} kg` : "—"} {g.height ? ` · ${g.height} cm` : ""}</span>
                <button onClick={() => onRemoveGrowth(g.id)} style={styles.iconBtn}><Trash2 size={12} color="#B0A9B5" /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function lastNDays(n) {
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    arr.push({ key: d.toISOString().slice(0, 10), label: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) });
  }
  return arr;
}

const tooltipStyle = { background: "#fff", border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 12 };

function ChartCard({ title, subtitle, action, children }) {
  return (
    <div style={styles.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={styles.cardTitle}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: "#B0A9B5" }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

function RendezVous({ data, onAdd, onToggle, onRemove }) {
  const upcoming = data.appointments.filter((a) => !a.done).sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  const past = data.appointments.filter((a) => a.done);
  return (
    <div style={styles.stack}>
      <button onClick={onAdd} style={styles.primaryBtn}><Plus size={15} /> Nouveau rendez-vous</button>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#8A8390", margin: "10px 2px" }}>À venir</div>
        {upcoming.length === 0 && <EmptyState text="Aucun rendez-vous à venir." />}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {upcoming.map((a) => <ApptRow key={a.id} a={a} onToggle={onToggle} onRemove={onRemove} />)}
        </div>
      </div>
      {past.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#8A8390", margin: "10px 2px" }}>Passés</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {past.map((a) => <ApptRow key={a.id} a={a} onToggle={onToggle} onRemove={onRemove} muted />)}
          </div>
        </div>
      )}
    </div>
  );
}

function ApptRow({ a, onToggle, onRemove, muted }) {
  const parentMeta = PARENTS.find((p) => p.id === a.parent);
  return (
    <div style={{ ...styles.card, display: "flex", alignItems: "center", gap: 12, padding: 12, opacity: muted ? 0.55 : 1 }}>
      <button onClick={() => onToggle(a.id)} style={{ ...styles.checkbox, background: a.done ? SAGE : "#fff", borderColor: a.done ? SAGE : LINE }}>
        {a.done && <Check size={12} color="#fff" />}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: INK, textDecoration: a.done ? "line-through" : "none" }}>{a.title}</div>
        <div style={{ fontSize: 11, color: "#B0A9B5" }}>
          {new Date(a.datetime).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          {a.notes ? ` · ${a.notes}` : ""}
          {parentMeta && <span style={{ color: parentMeta.color, fontWeight: 600 }}> · {parentMeta.label}</span>}
        </div>
      </div>
      <button onClick={() => onRemove(a.id)} style={styles.iconBtn}><Trash2 size={14} color="#B0A9B5" /></button>
    </div>
  );
}

function Rappels() {
  const [rappels, setRappels] = useState([]);
  const [status, setStatus] = useState("loading");

  const load = async () => {
    setStatus("loading");
    try {
      const data = await fetchRappelsBebe();
      setRappels(data);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={styles.stack}>
      <div style={{ ...styles.card, background: "#F4DEDB", display: "flex", gap: 10, alignItems: "center" }}>
        <AlertTriangle size={18} color="#C1554B" />
        <div style={{ fontSize: 12, color: INK }}>
          Rappels officiels liés aux produits bébé, fournis par le gouvernement (RappelConso).
        </div>
      </div>

      <button onClick={load} style={{ ...styles.smallBtn, alignSelf: "flex-start" }}>
        <RefreshCw size={13} /> Actualiser
      </button>

      {status === "loading" && <EmptyState text="Recherche des rappels en cours…" />}
      {status === "error" && <EmptyState text="Impossible de récupérer les rappels pour le moment." />}
      {status === "ready" && rappels.length === 0 && (
        <EmptyState text="Aucun rappel récent trouvé pour les produits bébé." />
      )}

      {status === "ready" &&
        rappels.map((r, i) => (
          <div key={r.reference_fiche || i} style={styles.card}>
            <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>
              {r.noms_des_modeles_ou_references || r.marque_produit || "Produit rappelé"}
            </div>
            <div style={{ fontSize: 11, color: "#8A8390", marginTop: 2 }}>
              {[r.categorie_de_produit, r.sous_categorie_de_produit].filter(Boolean).join(" · ")}
            </div>
            {r.motif_rappel && (
              <div style={{ fontSize: 12, color: INK, marginTop: 8 }}>
                <strong>Motif : </strong>{r.motif_rappel}
              </div>
            )}
            {r.date_publication && (
              <div style={{ fontSize: 11, color: "#B0A9B5", marginTop: 6 }}>
                Publié le {fmtDay(r.date_publication)}
              </div>
            )}
            {r.lien_vers_la_fiche_rappel && (
              <a
                href={r.lien_vers_la_fiche_rappel}
                target="_blank"
                rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: SAGE, fontWeight: 600, marginTop: 10, textDecoration: "none" }}
              >
                Voir la fiche complète <ExternalLink size={12} />
              </a>
            )}
          </div>
        ))}
    </div>
  );
}

function QuickAddBar({ onPick }) {
  const items = [
    { type: "biberon", ...TYPE_META.biberon },
    { type: "allaitement", ...TYPE_META.allaitement },
    { type: "couche", ...TYPE_META.couche },
    { type: "sommeil", ...TYPE_META.sommeil },
    { type: "temperature", ...TYPE_META.temperature },
  ];
  return (
    <div style={styles.quickBar}>
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <button key={it.type} onClick={() => onPick(it.type)} style={{ ...styles.quickBtn, background: it.soft }}>
            <Icon size={16} color={it.color} />
            <span style={{ fontSize: 10, color: INK, fontWeight: 600 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function BottomNav({ tab, setTab }) {
  const items = [
    { id: "accueil", label: "Accueil", icon: Home },
    { id: "journal", label: "Journal", icon: ListTree },
    { id: "courbes", label: "Courbes", icon: TrendingUp },
    { id: "rdv", label: "RDV", icon: CalendarDays },
    { id: "rappels", label: "Rappels", icon: AlertTriangle },
  ];
  return (
    <nav style={styles.bottomNav}>
      {items.map((it) => {
        const Icon = it.icon;
        const active = tab === it.id;
        return (
          <button key={it.id} onClick={() => setTab(it.id)} style={styles.navBtn}>
            <Icon size={19} color={active ? SAGE : "#B0A9B5"} />
            <span style={{ fontSize: 10, color: active ? SAGE : "#B0A9B5", fontWeight: active ? 700 : 500 }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ModalShell({ title, color, onClose, children }) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 600, color: color || INK }}>{title}</span>
          <button onClick={onClose} style={styles.iconBtn}><X size={18} color="#8A8390" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function EventModal({ type, onClose, onSave }) {
  const meta = TYPE_META[type];
  const [timestamp, setTimestamp] = useState(nowLocalInput());
  const [quantityPrepared, setQuantityPrepared] = useState("");
  const [quantityDrunk, setQuantityDrunk] = useState("");
  const [side, setSide] = useState("gauche");
  const [durationMin, setDurationMin] = useState("");
  const [kind, setKind] = useState("pipi");
  const [end, setEnd] = useState("");
  const [value, setValue] = useState("");

  const save = () => {
    const base = { type, timestamp: new Date(timestamp).toISOString() };
    if (type === "biberon") onSave({ ...base, quantityPrepared, quantityDrunk });
    if (type === "allaitement") onSave({ ...base, side, durationMin });
    if (type === "couche") onSave({ ...base, kind });
    if (type === "sommeil") onSave({ ...base, end: end ? new Date(end).toISOString() : null });
    if (type === "temperature") onSave({ ...base, value });
  };

  return (
    <ModalShell title={meta.label} color={meta.color} onClose={onClose}>
      <Field label="Heure"><input type="datetime-local" value={timestamp} onChange={(e) => setTimestamp(e.target.value)} style={styles.input} /></Field>
      {type === "biberon" && (
        <>
          <Field label="Quantité préparée (ml)"><input type="number" inputMode="numeric" value={quantityPrepared} onChange={(e) => setQuantityPrepared(e.target.value)} style={styles.input} placeholder="120" /></Field>
          <Field label="Quantité réellement bue (ml)"><input type="number" inputMode="numeric" value={quantityDrunk} onChange={(e) => setQuantityDrunk(e.target.value)} style={styles.input} placeholder="100" /></Field>
        </>
      )}
      {type === "allaitement" && (
        <>
          <Field label="Côté"><SegButtons value={side} onChange={setSide} options={[{ v: "gauche", l: "Gauche" }, { v: "droit", l: "Droit" }, { v: "les deux", l: "Les deux" }]} color={meta.color} /></Field>
          <Field label="Durée (minutes)"><input type="number" inputMode="numeric" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} style={styles.input} placeholder="15" /></Field>
        </>
      )}
      {type === "couche" && (
        <Field label="Type"><SegButtons value={kind} onChange={setKind} options={[{ v: "pipi", l: "Pipi" }, { v: "selles", l: "Selles" }, { v: "les deux", l: "Les deux" }]} color={meta.color} /></Field>
      )}
      {type === "sommeil" && <Field label="Fin (laisser vide si en cours)"><input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} style={styles.input} /></Field>}
      {type === "temperature" && <Field label="Température (°C)"><input type="number" step="0.1" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} style={styles.input} placeholder="37.2" /></Field>}
      <button onClick={save} style={{ ...styles.primaryBtn, background: meta.color, marginTop: 6 }}>Enregistrer</button>
    </ModalShell>
  );
}

function AppointmentModal({ onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [datetime, setDatetime] = useState(nowLocalInput());
  const [notes, setNotes] = useState("");
  const save = () => { if (!title.trim()) return; onSave({ title: title.trim(), datetime: new Date(datetime).toISOString(), notes: notes.trim() }); };
  return (
    <ModalShell title="Nouveau rendez-vous" color={SAGE} onClose={onClose}>
      <Field label="Titre"><input value={title} onChange={(e) => setTitle(e.target.value)} style={styles.input} placeholder="Pédiatre, vaccin, PMI…" /></Field>
      <Field label="Date et heure"><input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} style={styles.input} /></Field>
      <Field label="Note (facultatif)"><input value={notes} onChange={(e) => setNotes(e.target.value)} style={styles.input} placeholder="Apporter le carnet de santé" /></Field>
      <button onClick={save} style={{ ...styles.primaryBtn, background: SAGE, marginTop: 6 }}>Enregistrer</button>
    </ModalShell>
  );
}

function GrowthModal({ onClose, onSave }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const save = () => { if (!weight && !height) return; onSave({ date, weight, height }); };
  return (
    <ModalShell title="Nouvelle mesure" color={SAGE} onClose={onClose}>
      <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={styles.input} /></Field>
      <Field label="Poids (kg)"><input type="number" step="0.01" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} style={styles.input} placeholder="4.20" /></Field>
      <Field label="Taille (cm)"><input type="number" step="0.1" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} style={styles.input} placeholder="54.5" /></Field>
      <button onClick={save} style={{ ...styles.primaryBtn, background: SAGE, marginTop: 6 }}>Enregistrer</button>
    </ModalShell>
  );
}

function Field({ label, children }) {
  return <div style={{ marginBottom: 12 }}><div style={{ fontSize: 11, fontWeight: 600, color: "#8A8390", marginBottom: 5 }}>{label}</div>{children}</div>;
}

function SegButtons({ value, onChange, options, color }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)} style={{ flex: 1, padding: "9px 6px", borderRadius: 9, border: `1px solid ${value === o.v ? color : LINE}`, background: value === o.v ? `${color}22` : "#fff", color: INK, fontSize: 12, fontWeight: 600 }}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

const styles = {
  app: { fontFamily: "Inter, sans-serif", background: PAPER, color: INK, minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative", paddingBottom: 150 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "20px 18px 12px" },
  parentPicker: { display: "flex", gap: 4, background: "#fff", padding: 3, borderRadius: 999, border: `1px solid ${LINE}` },
  parentPill: { padding: "6px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, border: "none" },
  main: { padding: "6px 16px" },
  stack: { display: "flex", flexDirection: "column", gap: 12 },
  card: { background: CARD, borderRadius: 16, padding: 14, border: `1px solid ${LINE}` },
  cardTitle: { fontFamily: "Fraunces, serif", fontSize: 15, fontWeight: 600, color: INK },
  statGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  iconBtn: { border: "none", background: "transparent", padding: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  checkbox: { width: 22, height: 22, borderRadius: 7, border: `2px solid ${LINE}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  primaryBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: SAGE, color: "#fff", border: "none", borderRadius: 12, padding: "13px 16px", fontSize: 13, fontWeight: 700, width: "100%" },
  smallBtn: { display: "flex", alignItems: "center", gap: 4, background: SAGE_SOFT, color: SAGE, border: "none", borderRadius: 999, padding: "6px 10px", fontSize: 11, fontWeight: 700 },
  input: { width: "100%", padding: "11px 12px", borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 14, color: INK, background: "#fff" },
  quickBar: { position: "fixed", bottom: 68, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, display: "flex", justifyContent: "space-around", padding: "8px 10px", gap: 6 },
  quickBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, border: "none", borderRadius: 12, padding: "9px 4px" },
  bottomNav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#fff", borderTop: `1px solid ${LINE}`, display: "flex", padding: "8px 0 max(8px, env(safe-area-inset-bottom))" },
  navBtn: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, border: "none", background: "transparent", padding: "4px 0" },
  overlay: { position: "fixed", inset: 0, background: "rgba(51,45,62,0.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 },
  sheet: { background: PAPER, width: "100%", maxWidth: 480, borderRadius: "20px 20px 0 0", padding: "20px 18px calc(20px + env(safe-area-inset-bottom))", maxHeight: "85vh", overflowY: "auto" },
};


          
