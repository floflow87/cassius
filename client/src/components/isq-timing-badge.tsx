import { Badge } from "@/components/ui/badge";
import { differenceInDays } from "date-fns";

export type IsqTimingLabel = "+0" | "+2M" | "+3M" | "+4M" | "+6M" | "+12M" | "+18M" | "+24M" | "+36M" | "+48M";

interface IsqTimingThreshold {
  label: IsqTimingLabel;
  minDays: number;
  cssVar: string;
  useLightText: boolean;
}

const ISQ_TIMING_THRESHOLDS: IsqTimingThreshold[] = [
  { label: "+48M", minDays: 1460, cssVar: "--isq-timing-48m", useLightText: true },
  { label: "+36M", minDays: 1095, cssVar: "--isq-timing-36m", useLightText: true },
  { label: "+24M", minDays: 730, cssVar: "--isq-timing-24m", useLightText: true },
  { label: "+18M", minDays: 540, cssVar: "--isq-timing-18m", useLightText: true },
  { label: "+12M", minDays: 365, cssVar: "--isq-timing-12m", useLightText: true },
  { label: "+6M", minDays: 180, cssVar: "--isq-timing-6m", useLightText: false },
  { label: "+4M", minDays: 120, cssVar: "--isq-timing-4m", useLightText: false },
  { label: "+3M", minDays: 90, cssVar: "--isq-timing-3m", useLightText: false },
  { label: "+2M", minDays: 60, cssVar: "--isq-timing-2m", useLightText: false },
  { label: "+0", minDays: 0, cssVar: "--isq-timing-0", useLightText: false },
];

export function getIsqTimingFromDays(daysSincePose: number): IsqTimingThreshold {
  for (const threshold of ISQ_TIMING_THRESHOLDS) {
    if (daysSincePose >= threshold.minDays) {
      return threshold;
    }
  }
  return ISQ_TIMING_THRESHOLDS[ISQ_TIMING_THRESHOLDS.length - 1];
}

export function getIsqTimingFromDates(poseDate: Date, measurementDate: Date): IsqTimingThreshold {
  const daysSincePose = differenceInDays(measurementDate, poseDate);
  return getIsqTimingFromDays(Math.max(0, daysSincePose));
}

export function getIsqTimingLabel(poseDate: Date, measurementDate: Date): IsqTimingLabel {
  return getIsqTimingFromDates(poseDate, measurementDate).label;
}

interface IsqTimingBadgeProps {
  poseDate: Date | string;
  measurementDate?: Date | string;
  className?: string;
}

export function IsqTimingBadge({ poseDate, measurementDate, className = "" }: IsqTimingBadgeProps) {
  const poseDateObj = typeof poseDate === "string" ? new Date(poseDate) : poseDate;
  const measurementDateObj = measurementDate 
    ? (typeof measurementDate === "string" ? new Date(measurementDate) : measurementDate)
    : new Date();
  
  const timing = getIsqTimingFromDates(poseDateObj, measurementDateObj);
  
  return (
    <Badge
      className={`text-[10px] border-0 ${className}`}
      style={{
        backgroundColor: `hsl(var(${timing.cssVar}))`,
        color: timing.useLightText 
          ? `hsl(var(--isq-timing-foreground-light))` 
          : `hsl(var(--isq-timing-foreground))`,
      }}
      data-testid={`isq-timing-badge-${timing.label.replace("+", "plus")}`}
    >
      {timing.label}
    </Badge>
  );
}

export function getIsqTimingStyles(poseDate: Date | string, measurementDate?: Date | string): {
  label: IsqTimingLabel;
  bgColor: string;
  textColor: string;
} {
  const poseDateObj = typeof poseDate === "string" ? new Date(poseDate) : poseDate;
  const measurementDateObj = measurementDate 
    ? (typeof measurementDate === "string" ? new Date(measurementDate) : measurementDate)
    : new Date();
  
  const timing = getIsqTimingFromDates(poseDateObj, measurementDateObj);
  
  return {
    label: timing.label,
    bgColor: `hsl(var(${timing.cssVar}))`,
    textColor: timing.useLightText 
      ? `hsl(var(--isq-timing-foreground-light))` 
      : `hsl(var(--isq-timing-foreground))`,
  };
}
