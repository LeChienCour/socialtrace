import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getPreferredTheme, setStoredTheme, type Theme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getPreferredTheme());

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setStoredTheme(next);
    setTheme(next);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggle}
      className="w-full justify-start gap-2.5"
    >
      {theme === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </Button>
  );
}
