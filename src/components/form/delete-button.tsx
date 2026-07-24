"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";

export function DeleteButton({
  action,
  confirmMessage = "Tem certeza que deseja excluir? Esta ação pode ser desfeita apenas no banco.",
  confirmationText,
  successMessage = "Registro excluído.",
  redirectTo,
  children,
  variant = "outline",
  size,
  iconOnly = false,
}: {
  action: () => Promise<{ error?: string } | void>;
  confirmMessage?: string;
  confirmationText?: string;
  successMessage?: string;
  redirectTo?: string;
  children?: React.ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onClick() {
    if (!window.confirm(confirmMessage)) return;
    if (
      confirmationText &&
      window.prompt(
        `Para confirmar a exclusão definitiva, digite ${confirmationText}:`,
      ) !== confirmationText
    ) {
      toast.error("Confirmação incorreta. Nenhum registro foi excluído.");
      return;
    }
    start(async () => {
      const res = await action();
      if (res && "error" in res && res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(successMessage);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size ?? (iconOnly ? "icon" : "default")}
      onClick={onClick}
      disabled={pending}
      className={
        iconOnly ? "text-red-600 hover:text-red-700 dark:text-red-400" : undefined
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Trash2 />}
      {!iconOnly && (children ?? "Excluir")}
    </Button>
  );
}
