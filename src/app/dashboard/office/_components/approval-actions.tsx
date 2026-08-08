"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { decideApproval } from "../actions";

export function ApprovalActions({ approvalId }: { approvalId: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<null | "APPROVED" | "REJECTED">(null);

  function decide(decision: "APPROVED" | "REJECTED") {
    start(async () => {
      const res = await decideApproval({ approvalId, decision });
      if (!res.ok) {
        toast.error(res.error ?? "Não foi possível registrar a decisão.");
        return;
      }
      setDone(decision);
      toast.success(decision === "APPROVED" ? "Solicitação aprovada." : "Solicitação rejeitada.");
    });
  }

  if (done) {
    return (
      <span className="text-xs font-medium text-muted-foreground">
        {done === "APPROVED" ? "Aprovada" : "Rejeitada"}
      </span>
    );
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => decide("REJECTED")} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <X />} Rejeitar
      </Button>
      <Button size="sm" onClick={() => decide("APPROVED")} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Check />} Aprovar
      </Button>
    </div>
  );
}
