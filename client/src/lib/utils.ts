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
