import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  htmlFor,
  error,
  required,
  hint,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  error?: string[] | string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const errorText = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="text-red-500"> *</span>}
        </Label>
      )}
      {children}
      {hint && !errorText && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {errorText && (
        <p className="text-xs text-red-600 dark:text-red-400">{errorText}</p>
      )}
    </div>
  );
}

export function FormGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</div>
  );
}
