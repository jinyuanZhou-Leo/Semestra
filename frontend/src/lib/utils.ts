// input:  [`clsx` class aggregation arguments and `tailwind-merge` conflict resolution]
// output: [`cn(...inputs)` utility function]
// pos:    [Fundamental className composition helper used across component files]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
