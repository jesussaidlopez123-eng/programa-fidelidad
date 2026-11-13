import { cn } from "@/lib/utils";

export function Badge({
  className,
  tone = "teal",
  children,
}: {
  className?: string;
  tone?: "teal" | "gold" | "rose" | "slate";
  children: React.ReactNode;
}) {
  const tones = {
    teal: "bg-success-soft text-success",
    gold: "bg-brand/10 text-brand",
    rose: "bg-danger-soft text-danger",
    slate: "bg-page text-muted",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-semibold tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
