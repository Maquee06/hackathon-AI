'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import ConnectionBar from '@/components/ConnectionBar';
import ApplianceGrid from '@/components/ApplianceGrid';
import Toast from '@/components/Toast';
import { fetchAppliances, toggleAppliance, resetAppliance } from '@/lib/api';

const POLL_INTERVAL = 1000; // ms

export default function DashboardPage() {
  const [appliances, setAppliances] = useState({});       // id → appliance data
  const [connStatus, setConnStatus] = useState('');       // '' | 'connected' | 'error'
  const [connText, setConnText] = useState('Connecting to backend…');
  const [sessionStarts, setSessionStarts] = useState({}); // id → timestamp
  const [toastMsg, setToastMsg] = useState('');

  // ─── Toast helper ──────────────────────────────────────────────────────
  const toast = useCallback((msg) => {
    setToastMsg(msg);
  }, []);

  // ─── Poll backend ──────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    try {
      const list = await fetchAppliances();
      setAppliances((prev) => {
        const next = { ...prev };
        list.forEach((a) => { next[a.id] = a; });
        return next;
      });
      setConnStatus('connected');
      setConnText(`Backend connected · ${new Date().toLocaleTimeString()}`);
    } catch {
      setConnStatus('error');
      setConnText('Backend unreachable — retrying…');
    }
  }, []);

  // ─── Polling loop ──────────────────────────────────────────────────────
  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [poll]);

  // ─── Toggle handler ────────────────────────────────────────────────────
  const handleToggle = useCallback(async (id) => {
    try {
      const data = await toggleAppliance(id);
      setAppliances((prev) => ({ ...prev, [id]: data }));

      if (data.status === 'ON') {
        setSessionStarts((prev) => ({ ...prev, [id]: Date.now() }));
        toast(`${data.name} turned ON ▶`);
      } else {
        setSessionStarts((prev) => ({ ...prev, [id]: null }));
        toast(`${data.name} turned OFF ⏹`);
      }
    } catch {
      toast('⚠ Could not reach backend');
    }
  }, [toast]);

  // ─── Reset handler ─────────────────────────────────────────────────────
  const handleReset = useCallback(async (id) => {
    try {
      const data = await resetAppliance(id);
      setAppliances((prev) => ({ ...prev, [id]: data }));
      setSessionStarts((prev) => ({
        ...prev,
        [id]: data.status === 'ON' ? Date.now() : null,
      }));
      toast('Energy counter reset');
    } catch {
      toast('⚠ Reset failed');
    }
  }, [toast]);

  return (
    <>
      <Header />
      <ConnectionBar status={connStatus} text={connText} />
      <ApplianceGrid
        appliances={appliances}
        sessionStarts={sessionStarts}
        onToggle={handleToggle}
        onReset={handleReset}
      />
      <Toast message={toastMsg} />
    </>
  );
}
