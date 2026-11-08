import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui.tsx";

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  };
  return (
    <Button variant="ghost-muted" size="icon-sm" aria-label="Toggle theme" onClick={toggle}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
