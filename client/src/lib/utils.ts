import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getSiteBadgeColor(siteFdi: string): string {
  const siteNum = parseInt(siteFdi, 10);
  if (isNaN(siteNum) || siteNum < 11 || siteNum > 48) {
    return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
  const toothPosition = siteNum % 10;
  if (toothPosition === 1) {
    return "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300";
  } else if (toothPosition === 2) {
    return "bg-teal-200 text-teal-800 dark:bg-teal-800/40 dark:text-teal-200";
  } else if (toothPosition === 3) {
    return "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300";
  } else if (toothPosition === 4) {
    return "bg-cyan-200 text-cyan-800 dark:bg-cyan-800/40 dark:text-cyan-200";
  } else if (toothPosition === 5) {
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  } else if (toothPosition === 6) {
    return "bg-blue-200 text-blue-800 dark:bg-blue-800/40 dark:text-blue-200";
  } else if (toothPosition === 7) {
    return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300";
  } else {
    return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300";
  }
}
