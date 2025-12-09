// src/zones/ocs-zones.interface.ts
export interface OcsZoneOperator {
  // many more fields exist; we only keep what we need
  countryIso2: string; // e.g., "AL"
  countryName: string; // e.g., "Albania"
  continent?: string;
}

export interface OcsLocationZone {
  zoneId: string; // UUID-like
  zoneName: string; // e.g., "Europe", "Balkans"
  operators: OcsZoneOperator[];
}
