'use client';

import { useEffect, useRef } from 'react';

export default function Toast({ message }) {
  const ref = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!message) return;
    const el = ref.current;
    if (!el) return;

    el.classList.add('show');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => el.classList.remove('show'), 2200);

    return () => clearTimeout(timerRef.current);
  }, [message]);

  return (
    <div id="toast" className="toast" ref={ref}>
      {message}
    </div>
  );
}
