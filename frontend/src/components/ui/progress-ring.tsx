import { cn } from "@/lib/utils";

export function ProgressRing({
  done,
  total,
  size = 168,
  stroke = 12,
  className,
  tone = "cream",
}: {
  done: number;
  total: number;
  size?: number;
  stroke?: number;
  className?: string;
  tone?: "cream" | "forest";
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? Math.min(done / total, 1) : 0;

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={tone === "cream" ? "text-ivory/12" : "text-forest/10"}
          stroke="currentColor"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className={cn(
            "transition-[stroke-dashoffset] duration-700 ease-out",
            tone === "cream" ? "text-ivory" : "text-forest",
          )}
          stroke="currentColor"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn(
            "font-display leading-none",
            tone === "cream" ? "text-ivory" : "text-ink",
          )}
          style={{ fontSize: size * 0.28 }}
        >
          {done}
        </span>
        <span
          className={cn(
            "mt-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]",
            tone === "cream" ? "text-ivory/55" : "text-muted",
          )}
        >
          из {total}
        </span>
      </div>
    </div>
  );
}
