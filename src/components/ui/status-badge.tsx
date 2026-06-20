import { Badge } from "@/components/ui/badge";
import type { BadgeTone } from "@/lib/enums";

export function StatusBadge({
  value,
  labels,
  tones,
}: {
  value: string | null | undefined;
  labels: Record<string, string>;
  tones?: Record<string, BadgeTone>;
}) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge tone={tones?.[value] ?? "neutral"}>{labels[value] ?? value}</Badge>
  );
}
