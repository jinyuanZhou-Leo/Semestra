// input:  [Tailwind config typing, dark-mode strategy, and source content globs]
// output: [default exported Tailwind configuration object]
// pos:    [Tailwind build configuration for class scanning and theme mode behavior]
//
// ⚠️ When this file is updated:
//    1. Update these header comments
//    2. Update the INDEX.md of the folder this file belongs to

import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {},
  plugins: [],
} satisfies Config;
