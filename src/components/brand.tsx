import { cn } from "@/lib/utils";

export function Logo({
  className,
  showWord = true,
}: {
  className?: string;
  showWord?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-cyan-500 font-bold text-white shadow-sm">
        C
      </div>
      {showWord && (
        <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">
          Chronos<span className="text-sidebar-accent">tek</span>
        </span>
      )}
    </div>
  );
}
