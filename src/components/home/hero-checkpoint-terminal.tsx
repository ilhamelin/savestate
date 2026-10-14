'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Bookmark, CheckCircle2, Clock, Gamepad2, Skull, Trophy, ArrowUpRight } from 'lucide-react';

const checkpointStates = {
  playing: {
    label: 'Playing',
    icon: Gamepad2,
    color: 'orange',
    desc: 'En curso: sesión activa y progreso sincronizado en tiempo real.',
  },
  backlog: {
    label: 'Backlog',
    icon: Clock,
    color: 'amber',
    desc: 'Pendientes por iniciar: tu lista de espera priorizada.',
  },
  cleared: {
    label: 'Cleared',
    icon: CheckCircle2,
    color: 'emerald',
    desc: 'Campaña completada: créditos finales superados.',
  },
  platinum: {
    label: '100% Platinum',
    icon: Trophy,
    color: 'purple',
    desc: 'Maestría total: 100% de logros y coleccionables desbloqueados.',
  },
  dropped: {
    label: 'Dropped',
    icon: Skull,
    color: 'red',
    desc: 'Partida pausada o abandonada en el archivo.',
  },
  wishlist: {
    label: 'Wishlist',
    icon: Bookmark,
    color: 'cyan',
    desc: 'Deseados: radar de precios y alertas de ofertas activas.',
  },
} as const;

type CheckpointState = keyof typeof checkpointStates;

export function HeroCheckpointTerminal() {
  const [selectedState, setSelectedState] = useState<CheckpointState>('playing');
  const selected = checkpointStates[selectedState];
  const SelectedIcon = selected.icon;

  return (
    <section
      className="hero-terminal checkpoint-terminal"
      data-color={selected.color}
      aria-label="Haunted Checkpoint Terminal"
    >
      <Image
        src="/icons/halloween/telarana-de-halloween.png"
        alt=""
        width={56}
        height={56}
        className="corner-web checkpoint-terminal-web"
        unoptimized
      />
      <div className="checkpoint-terminal-top">
        <div className="checkpoint-terminal-logbook">
          <Image
            src="/icons/halloween/calabaza.png"
            alt=""
            width={18}
            height={18}
            className="checkpoint-terminal-pumpkin"
            unoptimized
          />
          <span>savestate://player/logbook</span>
        </div>
        <span className="checkpoint-terminal-signal" aria-hidden="true">
          ● NIGHT MODE
        </span>
      </div>

      <div className="checkpoint-terminal-art" aria-hidden="true">
        <span className="checkpoint-terminal-orbit" />
        <SelectedIcon size={76} strokeWidth={1.2} />
        <span className="checkpoint-terminal-kicker">HAUNTED CHECKPOINT TERMINAL</span>
        <strong>SAVE YOUR PROGRESS</strong>
      </div>

      <div className="checkpoint-terminal-body">
        <p className="checkpoint-terminal-prompt">$ choose_your_state</p>
        <div
          className="checkpoint-state-grid"
          role="group"
          aria-label="Elige un estado de biblioteca"
        >
          {(Object.keys(checkpointStates) as CheckpointState[]).map((state) => {
            const option = checkpointStates[state];
            const Icon = option.icon;
            return (
              <button
                key={state}
                type="button"
                className="checkpoint-state"
                data-color={option.color}
                aria-pressed={selectedState === state}
                onClick={() => setSelectedState(state)}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
        <div className="checkpoint-telemetry" role="status" aria-live="polite" aria-atomic="true">
          <span className="checkpoint-telemetry-label">
            ESTADO SELECCIONADO // <strong>{selected.label}</strong>
          </span>
          <p>{selected.desc}</p>
        </div>
        <p className="checkpoint-terminal-preview">
          Vista previa interactiva · tu biblioteca no se modifica.
        </p>
        <div className="checkpoint-terminal-actions">
          <Link className="button small checkpoint-register" href="/explore">
            + Registrar partida <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
          <Link className="button outline small" href="/library">
            Explorar Logbook
          </Link>
        </div>
      </div>
    </section>
  );
}
