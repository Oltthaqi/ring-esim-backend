// src/package-templates/ocs-packages.interface.ts
export interface OcsPackageTemplate {
  packageTemplateId: string;
  packageTemplateName: string;
  locationzoneid: string;
  // optionally present, provider-dependent:
  perioddays?: number;
  volume?: string; // "5GB" / "500MB" or sometimes numeric + unit
  price?: number; // if exposed
}
