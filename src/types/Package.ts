export type PackageColor = "red" | "blue" | "green" | "yellow" | "purple";

export type PackageKind = "standard" | "perishable";

export type PackageItem = {
  id: string;
  color: PackageColor;
  kind: PackageKind;
};
