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
    teal: "bg-teal/10 text-teal-deep",
    gold: "bg-gold/20 text-ink",
    rose: "bg-rose-100 text-rose-800",
    slate: "bg-black/5 text-ink/70",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
