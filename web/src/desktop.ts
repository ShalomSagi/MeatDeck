// Present only inside the Electron shell (see desktop/preload.ts).
interface DesktopBridge {
  platform: string;
  setBadge(count: number): Promise<void>;
  getLoginItem(): Promise<boolean>;
  setLoginItem(on: boolean): Promise<boolean>;
  showWindow(): Promise<void>;
  onFullscreen?(cb: (on: boolean) => void): () => void;
}

export const desktop = (window as unknown as { desktop?: DesktopBridge }).desktop;
const isMacDesktop = desktop?.platform === "darwin";

if (desktop) document.documentElement.classList.add("desktop");
if (isMacDesktop) {
  document.documentElement.classList.add("desktop-mac");
  // Reserve room for the traffic lights only while they're visible (not in full screen).
  document.documentElement.classList.add("traffic-lights");
  desktop?.onFullscreen?.((on) => document.documentElement.classList.toggle("traffic-lights", !on));
}
