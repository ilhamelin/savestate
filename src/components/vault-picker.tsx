'use client';
import { useEffect, useRef } from 'react';
import { VaultRoom } from '@/components/vault-room';
import type { VaultItem } from '@/domain/vault';
export function VaultPicker({
  onSelect,
  onClose,
}: {
  onSelect: (item: VaultItem) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog ref={dialog} className="vault-dialog vault-picker" onCancel={onClose}>
      <button type="button" className="button outline small" onClick={onClose}>
        ✕ Cerrar bóveda
      </button>
      <VaultRoom onSelect={onSelect} />
    </dialog>
  );
}
