"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";

export function ActionButton({
  action,
  confirmMessage,
  successMessage,
  children,
  ...buttonProps
}: {
  action: () => Promise<{ error?: string } | void>;
  confirmMessage?: string;
  successMessage?: string;
} & Omit<ButtonProps, "onClick">) {
  const [pending, start] = useTransition();

  function onClick() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    start(async () => {
      const res = await action();
      if (res && "error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      if (successMessage) toast.success(successMessage);
    });
  }

  return (
    <Button type="button" onClick={onClick} disabled={pending} {...buttonProps}>
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}
