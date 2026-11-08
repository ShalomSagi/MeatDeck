/** Coming back to the window refreshes GitHub (if it hasn't in the last 10s): what you see is current. */
import { useEffect } from "react";
import { api } from "../api.ts";

export function usePeekGithubOnFocus() {
  useEffect(() => {
    const peek = () => document.visibilityState === "visible" && void api.peekGithub().catch(() => {});
    window.addEventListener("focus", peek);
    document.addEventListener("visibilitychange", peek);
    return () => {
      window.removeEventListener("focus", peek);
      document.removeEventListener("visibilitychange", peek);
    };
  }, []);
}
