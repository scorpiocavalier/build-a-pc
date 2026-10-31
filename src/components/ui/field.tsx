import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

// Form building blocks for the admin dashboard.

export const inputClass =
  "h-10 w-full rounded-lg border bg-surface px-3 text-sm placeholder:text-muted/70 aria-invalid:border-red-400";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(inputClass, "pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(inputClass, "h-auto min-h-24 py-2 leading-relaxed", className)}
      {...props}
    />
  );
}
