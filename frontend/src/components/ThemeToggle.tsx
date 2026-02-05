import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "./ThemeProvider"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    if (theme === "light") setTheme("dark")
    else if (theme === "dark") setTheme("system")
    else setTheme("light")
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="text-muted-foreground hover:text-foreground transition-all duration-300"
      title={`Current theme: ${theme}. Click to change.`}
    >
      <div className="relative h-5 w-5 flex items-center justify-center">
        <Sun className={`h-5 w-5 transition-all duration-300 absolute ${theme === 'light' ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'}`} />
        <Moon className={`h-5 w-5 transition-all duration-300 absolute ${theme === 'dark' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'}`} />
        <Monitor className={`h-5 w-5 transition-all duration-300 absolute ${theme === 'system' ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'}`} />
      </div>
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
