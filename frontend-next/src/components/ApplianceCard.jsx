'use client';

import { useState, useEffect, useCallback } from 'react';

const ICONS = { light_bulb: '💡', default: '🔌' };

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

export default function ApplianceCard({ appliance, sessionStart, onToggle, onReset }) {
  const [elapsed, setElapsed] = useState('—');
  const [busy, setBusy] = useState(false);

  const isOn = appliance.status === 'ON';
  const icon = ICONS[appliance.id] || ICONS.default;

  // Tick the session timer every second
  useEffect(() => {
    if (!isOn || !sessionStart) {
      setElapsed('—');
      return;
    }
    const tick = () => setElapsed(fmtTime(Date.now() - sessionStart));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isOn, sessionStart]);

  const handleToggle = useCallback(async () => {
    setBusy(true);
    try {
      await onToggle(appliance.id);
    } finally {
      setBusy(false);
    }
  }, [appliance.id, onToggle]);

  const handleReset = useCallback(() => {
    onReset(appliance.id);
  }, [appliance.id, onReset]);

  return (
    <div className={`card${isOn ? ' on' : ''}`} id={`card-${appliance.id}`}>
      {/* Card header */}
      <div className="card-header">
        <div className="appliance-info">
          <div className="appliance-name">{appliance.name}</div>
          <div className={`badge${isOn ? ' on' : ''}`}>
            <div className="badge-dot" />
            {isOn ? 'ONLINE' : 'OFFLINE'}
          </div>
        </div>
        <div className="appliance-icon">{icon}</div>
      </div>

      {/* Energy meter */}
      <div className="energy-block">
        <div className="energy-label">Energy Consumed</div>
        <div className="energy-value" id={`energy-${appliance.id}`}>
          {fmt(appliance.energyUsed)}<span className="unit">Wh</span>
        </div>
        <div className="session-row">
          <span className="session-label">Session</span>
          <span className="session-timer" id={`timer-${appliance.id}`}>{elapsed}</span>
        </div>
      </div>

      {/* Toggle button */}
      <button
        id={`btn-${appliance.id}`}
        className={`btn-toggle${isOn ? ' on' : ''}`}
        onClick={handleToggle}
        disabled={busy}
      >
        <span className="btn-icon">{isOn ? '⏹' : '▶'}</span>
        {isOn ? 'Turn OFF' : 'Turn ON'}
      </button>

      {/* Reset button */}
      <button className="btn-reset" onClick={handleReset}>
        ↺ Reset counter
      </button>
    </div>
  );
}
