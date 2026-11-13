import { cn } from "@/lib/utils";

export function StreakPips({
  current,
  total = 5,
  size = "md",
}: {
  current: number;
  total?: number;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "h-6 w-6 text-[10px]",
    md: "h-9 w-9 text-xs",
    lg: "h-12 w-12 text-sm",
  };

  return (
    <div className="flex items-center gap-2" aria-label={`Racha ${current} de ${total}`}>
      {Array.from({ length: total }).map((_, index) => {
        const filled = index < current;
        return (
          <span
            key={index}
            className={cn(
              "inline-flex items-center justify-center rounded-full border-2 font-bold transition",
              sizes[size],
              filled
                ? "border-brand bg-brand text-white shadow-[0_0_0_3px_rgba(0,69,165,0.14)]"
                : "border-dashed border-line bg-white text-muted",
            )}
          >
            {index + 1}
          </span>
        );
      })}
    </div>
  );
}
