import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--color-bg-secondary)",
        foreground: "var(--color-text-primary)",
        card: "var(--color-bg-primary)",
        "card-foreground": "var(--color-text-primary)",
        popover: "var(--color-bg-primary)",
        "popover-foreground": "var(--color-text-primary)",
        primary: "var(--color-accent-primary)",
        "primary-foreground": "var(--color-accent-text)",
        secondary: "var(--color-bg-tertiary)",
        "secondary-foreground": "var(--color-text-primary)",
        muted: "var(--color-bg-tertiary)",
        "muted-foreground": "var(--color-text-secondary)",
        accent: "var(--color-bg-tertiary)",
        "accent-foreground": "var(--color-text-primary)",
        destructive: "var(--color-danger)",
        "destructive-foreground": "var(--color-accent-text)",
        border: "var(--color-border)",
        input: "var(--color-border)",
        ring: "var(--color-accent-primary)",
      },
      borderRadius: {
        lg: "var(--radius-lg)",
        md: "var(--radius-md)",
        sm: "var(--radius-sm)",
      },
      fontFamily: {
        sans: ["var(--font-family)"],
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
