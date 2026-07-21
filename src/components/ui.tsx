import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return <section className={className ? `cartao ${className}` : 'cartao'}>{children}</section>;
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="erro" role="alert">
      {children}
    </p>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="aviso" role="status">
      {children}
    </div>
  );
}

/** Botão que evita submissão duplicada por duplo toque. */
export function ActionButton({
  onClick,
  children,
  disabled,
  variant = 'primario',
  type = 'button',
}: {
  onClick: () => void | Promise<void>;
  children: ReactNode;
  disabled?: boolean;
  variant?: 'primario' | 'secundario' | 'perigo' | 'discreto';
  type?: 'button' | 'submit';
}) {
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const className = variant === 'secundario' ? '' : variant;

  return (
    <button
      type={type}
      className={className}
      disabled={disabled === true || busy}
      onClick={() => {
        if (busy) return;
        setBusy(true);
        void Promise.resolve(onClick()).finally(() => {
          if (mounted.current) setBusy(false);
        });
      }}
    >
      {children}
    </button>
  );
}

export function BackLink({ onClick, label = 'Voltar' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="discreto" onClick={onClick}>
      ← {label}
    </button>
  );
}

/** Contagem regressiva acessível, em mm:ss. */
export function Countdown({ deadline, offset = 0 }: { deadline: number; offset?: number }) {
  const [remaining, setRemaining] = useState(() => deadline - (Date.now() + offset));

  useEffect(() => {
    const tick = () => setRemaining(deadline - (Date.now() + offset));
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [deadline, offset]);

  const clamped = Math.max(0, remaining);
  const minutes = Math.floor(clamped / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const text = `${minutes}:${String(seconds).padStart(2, '0')}`;

  return (
    <p className="contador" aria-live="polite" aria-label={`Tempo restante: ${minutes} minutos e ${seconds} segundos`}>
      {text}
    </p>
  );
}
