import { clsx, type ClassValue } from "clsx";
import type * as React from "react";
import { twMerge } from "tailwind-merge";

export const cn = (...v: ClassValue[]) => twMerge(clsx(v));

// Button recipes adapted from T3 Code's ui/button.tsx (outline / ghost / default).
const buttonBase =
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-control)] border font-medium outline-none transition-[background-color,box-shadow,scale] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const variants = {
  default:
    "border-primary bg-primary text-primary-foreground shadow-xs shadow-primary/24 inset-shadow-[0_1px_rgb(255_255_255/16%)] hover:bg-primary/90",
  outline:
    "border-input bg-popover text-foreground shadow-xs/5 hover:bg-accent dark:bg-input/32 dark:hover:bg-input/64 [&_svg]:text-muted-foreground",
  ghost: "border-transparent text-foreground hover:bg-accent [&_svg]:text-muted-foreground",
  "ghost-muted": "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
  "warning-outline":
    "border-warning/32 bg-warning/8 text-warning-foreground hover:bg-warning/16 dark:hover:bg-warning/24",
};

const sizes = {
  default: "h-8 px-[11px] text-sm",
  sm: "h-7 px-[9px] text-sm",
  xs: "h-6 gap-1 px-[7px] text-xs [&_svg:not([class*='size-'])]:size-3.5",
  icon: "size-8",
  "icon-sm": "size-7",
  "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3.5",
};

export function Button({
  variant = "outline",
  size = "default",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants; size?: keyof typeof sizes }) {
  return <button type="button" className={cn(buttonBase, variants[variant], sizes[size], className)} {...props} />;
}

const badgeVariants = {
  default: "bg-secondary text-secondary-foreground border-border",
  outline: "border-input bg-background text-foreground dark:bg-input/32",
  info: "bg-info/8 text-info-foreground dark:bg-info/16",
  success: "bg-success/8 text-success-foreground dark:bg-success/16",
  warning: "bg-warning/8 text-warning-foreground dark:bg-warning/16",
  error: "bg-destructive/8 text-destructive-foreground dark:bg-destructive/16",
  primary: "bg-primary/8 text-primary dark:bg-primary/20 dark:text-[oklch(0.75_0.12_264)]",
};
export type BadgeVariant = keyof typeof badgeVariants;

export function Badge({
  variant = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] shrink-0 items-center gap-1 whitespace-nowrap rounded-[4px] border border-transparent px-1.5 text-2xs font-medium [&_svg]:size-3 [&_svg]:opacity-80",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeader({
  title,
  count,
  action,
  icon,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex h-8 items-center gap-2 px-1">
      {icon && <span className="text-muted-foreground [&_svg]:size-3.5">{icon}</span>}
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
      {count !== undefined && <span className="text-2xs tabular-nums text-muted-foreground/70">{count}</span>}
      <div className="ml-auto flex items-center gap-1">{action}</div>
    </div>
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-xs/5 dark:shadow-none",
        className,
      )}
      {...props}
    />
  );
}

export function Empty({ icon, title, hint }: { icon?: React.ReactNode; title: string; hint?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-6 py-8 text-center">
      {icon && <div className="mb-1 text-muted-foreground/60 [&_svg]:size-5">{icon}</div>}
      <p className="text-sm font-medium text-foreground/80">{title}</p>
      {hint && <p className="max-w-xs text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function StatusDot({ tone }: { tone: "success" | "warning" | "error" | "info" | "muted" }) {
  const color = {
    success: "bg-success",
    warning: "bg-warning",
    error: "bg-destructive",
    info: "bg-info",
    muted: "bg-muted-foreground/50",
  }[tone];
  return <span className={cn("inline-block size-1.5 shrink-0 rounded-full", color)} />;
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-8.5 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors",
        checked ? "bg-primary" : "bg-input",
      )}
    >
      <span
        className={cn(
          "inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-drawer",
          checked ? "translate-x-3.5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { id: T; label: string; count?: number }[];
}) {
  return (
    <div className="mb-5 inline-flex rounded-lg border border-border bg-muted p-0.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
            value === t.id && "bg-card text-foreground shadow-xs/5 dark:bg-accent dark:shadow-none",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="tabular-nums text-muted-foreground">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
