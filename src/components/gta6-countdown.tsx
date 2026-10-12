'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { getGta6Countdown, GTA6_RELEASE_TEXT } from '@/domain/gta6-countdown';
export function Gta6Countdown() {
  const [countdown, setCountdown] = useState<ReturnType<typeof getGta6Countdown> | null>(null);
  useEffect(() => {
    const update = () => setCountdown(getGta6Countdown());
    const initial = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);
  return (
    <section className="gta6-countdown-banner" aria-labelledby="gta6-heading">
      <p className="gta6-radar">
        <Image src="/gta6/icon-128.png" alt="" width={40} height={40} unoptimized /> VICE CITY RADAR
        // LANZAMIENTO OFICIAL
      </p>
      <h2 id="gta6-heading">
        <Image
          src="/gta6/logo.png"
          alt="Grand Theft Auto VI"
          width={260}
          height={170}
          className="gta6-logo"
          unoptimized
        />
      </h2>
      <p>{GTA6_RELEASE_TEXT}</p>
      <div className="gta6-platforms">
        <span className="platform-tag">
          <Image src="/platforms/playstation.png" alt="" width={18} height={18} unoptimized />{' '}
          PlayStation 5
        </span>
        <span className="platform-tag">
          <Image src="/platforms/xbox.png" alt="" width={18} height={18} unoptimized /> Xbox Series
          X|S
        </span>
      </div>
      {countdown?.released ? (
        <p className="gta6-released">🌴 La fecha de lanzamiento ha llegado.</p>
      ) : (
        <div
          className="gta6-clock"
          role="timer"
          aria-label="Tiempo restante hasta el 19 de noviembre de 2026, 00:00 UTC"
          aria-live="off"
        >
          {(['days', 'hours', 'minutes', 'seconds'] as const).map((key, index) => (
            <div key={key}>
              <strong>{countdown ? String(countdown[key]).padStart(2, '0') : '—'}</strong>
              <span>{['DÍAS', 'HORAS', 'MINUTOS', 'SEGUNDOS'][index]}</span>
            </div>
          ))}
        </div>
      )}
      <small className="muted">Cuenta regresiva al 19/11/2026 · 00:00 UTC.</small>
    </section>
  );
}
