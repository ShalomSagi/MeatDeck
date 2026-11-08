import { CalendarDays, FileText, Hammer } from "lucide-react";
import type { Integration } from "../../../../../shared/integrations.ts";
import { GithubIcon, LinearIcon, SlackIcon } from "../../icons.tsx";
import { DRIVER } from "./drivers.tsx";
import { cn } from "../../ui.tsx";

export function IntegrationIcon({
  i,
  className = "size-5",
}: {
  i: Pick<Integration, "icon" | "driver">;
  className?: string;
}) {
  switch (i.icon) {
    case "github":
      return <GithubIcon className={className} />;
    case "linear":
      return <LinearIcon className={cn(className, "text-[#5E6AD2]")} />;
    case "slack":
      return <SlackIcon className={className} />;
    case "notion":
      return <FileText className={className} />;
    case "buildkite":
      return <Hammer className={className} />;
    case "calendar":
      return <CalendarDays className={className} />;
    default:
      return <span className={cn("[&_svg]:size-full", className)}>{DRIVER[i.driver].icon}</span>;
  }
}
