"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Home, ListTree, TrendingUp, CalendarDays, Plus, X, Milk, Baby,
  Droplet, Moon, Thermometer, Check, Trash2, Sparkles,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { supabase } from "../lib/supabase";

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
          
