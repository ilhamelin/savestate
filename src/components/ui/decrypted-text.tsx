'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { visibleAnimation } from '@/lib/visible-animation';
const GLYPHS = 'ABCDEF0123456789#_$%▓░';
export function DecryptedText({ text, children }: { text: string; children?: ReactNode }) {
  const output = useRef<HTMLSpanElement>(null);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = output.current,
      wrapper = container.current;
    if (!node || !text) return;
    const characters = Array.from(text);
    const cleanup = visibleAnimation(
      wrapper ?? node,
      (progress) => {
        wrapper?.classList.toggle('is-decrypting', progress < 1);
        const revealed = Math.floor(progress * characters.length);
        node.textContent =
          progress === 1
            ? text
            : characters
                .map((character, index) =>
                  index < revealed || /\s/u.test(character)
                    ? character
                    : GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
                )
                .join('');
      },
      650,
      45,
    );
    return () => {
      cleanup();
      wrapper?.classList.remove('is-decrypting');
    };
  }, [text]);
  if (children !== undefined)
    return (
      <div className="decrypted-rich" ref={container}>
        <div className="decrypted-final">{children}</div>
        <span className="decrypted-overlay" aria-hidden="true" ref={output}>
          {text}
        </span>
      </div>
    );
  return (
    <span>
      <span className="sr-only motion-static">{text}</span>
      <span className="motion-animated" aria-hidden="true" ref={output}>
        {text}
      </span>
    </span>
  );
}
