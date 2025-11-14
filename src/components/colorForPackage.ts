import type { PackageColor } from "../types/Package";
import type { Theme } from "./GameView";

export function colorForPackage(color: PackageColor, theme: Theme): string {
  if (theme === "hawkins") {
    switch (color) {
      case "red":
        return "#b91c1c";
      case "blue":
        return "#1d4ed8";
      case "green":
        return "#15803d";
      case "yellow":
        return "#ca8a04";
      case "purple":
        return "#6d28d9";
        }
      }

  switch (color) {
    case "red":
      return "#f97373";
    case "blue":
      return "#60a5fa";
    case "green":
      return "#4ade80";
    case "yellow":
      return "#facc15";
    case "purple":
      return "#c4b5fd";
  }

  return "#ffffff";
}
