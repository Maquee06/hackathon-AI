'use client';

import { useState, useEffect } from 'react';

function fmt(wh) {
  return Number(wh).toFixed(3);
}

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

export default function StatsBar({ appliances }) {
  const [uptime, setUptime] = useState('00:00:00');
  const [sessionStart] = useState(() => Date.now());

  const list = Object.values(appliances);
  const total = list.reduce((sum, a) => sum + (a.energyUsed || 0), 0);
  const active = list.filter((a) => a.status === 'ON').length;

  useEffect(() => {
    const id = setInterval(() => {
      setUptime(fmtTime(Date.now() - sessionStart));
    }, 1000);
    return () => clearInterval(id);
  }, [sessionStart]);

  return (
    <div className="stats-bar" id="statsBar">
      <div className="stat">
        <div className="stat-label">Total Energy</div>
        <div className="stat-val" id="statTotal" style={{ color: 'var(--accent-amber)' }}>
          {fmt(total)} <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>Wh</span>
        </div>
      </div>
      <div className="stat">
        <div className="stat-label">Active Appliances</div>
        <div className="stat-val" id="statActive" style={{ color: 'var(--accent-green)' }}>
          {active}
        </div>
      </div>
      <div className="stat">
        <div className="stat-label">Uptime</div>
        <div className="stat-val" id="statUptime" style={{ color: 'var(--muted)' }}>
          {uptime}
        </div>
      </div>
    </div>
  );
}
