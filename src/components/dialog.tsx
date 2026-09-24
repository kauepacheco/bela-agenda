"use client";
import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="modal native-dialog" aria-label={title} onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose(); } }}><div className="modal-head"><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Fechar janela"><X/></button></div>{children}</dialog>;
}
