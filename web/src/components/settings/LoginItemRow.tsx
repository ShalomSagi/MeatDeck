import { Power } from "lucide-react";
import { useEffect, useState } from "react";
import { Switch } from "../ui.tsx";
import { desktop } from "../../desktop.ts";

export function LoginItemRow() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    void desktop?.getLoginItem().then(setOn);
  }, []);
  return (
    <div id="setting-login" className="flex items-center gap-3 px-4 py-3">
      <Power className="size-4 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-sm font-medium">Open at login</p>
        <p className="text-xs text-muted-foreground">
          Starts hidden in the background so scheduled runs happen even before you open the window.
        </p>
      </div>
      {on !== null && (
        <Switch
          checked={on}
          onChange={async (v) => setOn((await desktop?.setLoginItem(v)) ?? v)}
          label="Open at login"
        />
      )}
    </div>
  );
}
