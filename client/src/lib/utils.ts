import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isDeposeIntervention(typeIntervention: string | string[] | undefined): boolean {
  if (!typeIntervention) return false;
  const types = Array.isArray(typeIntervention) ? typeIntervention : [typeIntervention];
  return types.some(t => t === "DEPOSE_IMPLANT" || t === "DEPOSE_PROTHESE");
}

export function getSiteBadgeColor(siteFdi: string, depose?: boolean): string {
  if (depose) {
    const siteNum = parseInt(siteFdi, 10);
    if (isNaN(siteNum)) {
      return "bg-orange-200 text-orange-800 dark:bg-orange-800/40 dark:text-orange-200";
    }
    const toothPosition = siteNum % 10;
    if (toothPosition === 1 || toothPosition === 2) {
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300";
    } else if (toothPosition === 3 || toothPosition === 4) {
      return "bg-orange-200 text-orange-800 dark:bg-orange-800/40 dark:text-orange-200";
    } else if (toothPosition === 5 || toothPosition === 6) {
      return "bg-orange-300 text-orange-900 dark:bg-orange-700/40 dark:text-orange-100";
    } else {
      return "bg-orange-400 text-white dark:bg-orange-600/40 dark:text-orange-50";
    }
  }
  const siteNum = parseInt(siteFdi, 10);
  if (isNaN(siteNum)) {
    return "bg-teal-200 text-teal-800 dark:bg-teal-800/40 dark:text-teal-200";
  }
  const toothPosition = siteNum % 10;
  if (toothPosition === 1 || toothPosition === 2) {
    return "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300";
  } else if (toothPosition === 3 || toothPosition === 4) {
    return "bg-teal-200 text-teal-800 dark:bg-teal-800/40 dark:text-teal-200";
  } else if (toothPosition === 5 || toothPosition === 6) {
    return "bg-teal-300 text-teal-900 dark:bg-teal-700/40 dark:text-teal-100";
  } else {
    return "bg-teal-400 text-white dark:bg-teal-600/40 dark:text-teal-50";
  }
}
