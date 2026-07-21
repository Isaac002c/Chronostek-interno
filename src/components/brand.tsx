import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

/**
 * Símbolo da Telun — "fonte de luz" ascendente (propósito → direção → evolução).
 * Fan de traços convergindo de baixo e florescendo para cima, com um facho
 * central brilhante. Gradiente violeta → lilás → cobre. Vetorial, escala bem de
 * 16px (favicon) a tamanhos grandes. Reproduz em fundo claro e escuro.
 */
export function TelunMark({
  className,
  title = "Telun",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      role="img"
      aria-label={title}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="telun-fan" x1="4" y1="42" x2="44" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7C3AED" />
          <stop offset="0.5" stopColor="#A56BFF" />
          <stop offset="1" stopColor="#FF8A3D" />
        </linearGradient>
        <linearGradient id="telun-beam" x1="24" y1="6" x2="24" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFD8A6" />
          <stop offset="1" stopColor="#A56BFF" />
        </linearGradient>
      </defs>
      <g
        stroke="url(#telun-fan)"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      >
        {/* pares externos e internos florescendo para cima */}
        <path d="M24 42 Q 8 33 11 17" />
        <path d="M24 42 Q 40 33 37 17" />
        <path d="M24 42 Q 16 28 19 11" />
        <path d="M24 42 Q 32 28 29 11" />
      </g>
      {/* facho central brilhante */}
      <path
        d="M24 42 L24 6"
        stroke="url(#telun-beam)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="24" cy="5.5" r="1.7" fill="#FFD8A6" />
    </svg>
  );
}

/** Marca-texto "TELUN" com espaçamento geométrico. Usa currentColor. */
export function TelunWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-semibold uppercase tracking-[0.28em] text-current",
        className,
      )}
    >
      Telun
    </span>
  );
}

/**
 * Logo composta (símbolo + marca-texto). `showWord=false` deixa só o símbolo
 * (sidebar recolhida / avatar). Mantida como `Logo` para compatibilidade de imports.
 */
export function Logo({
  className,
  showWord = true,
  markClassName,
}: {
  className?: string;
  showWord?: boolean;
  markClassName?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <TelunMark className={cn("size-8 shrink-0", markClassName)} />
      {showWord && (
        <TelunWordmark className="text-lg text-sidebar-foreground" />
      )}
    </div>
  );
}

/** Avatar quadrado da marca (app icon) — símbolo sobre superfície cósmica. */
export function BrandAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid place-items-center rounded-xl bg-sidebar ring-1 ring-sidebar-border",
        className,
      )}
      aria-label={BRAND.name}
    >
      <TelunMark className="size-[70%]" />
    </div>
  );
}
