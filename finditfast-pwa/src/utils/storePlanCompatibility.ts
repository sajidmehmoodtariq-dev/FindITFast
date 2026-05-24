/**
 * Compatibility utilities for StorePlan data migration
 * Handles the transition from base64 storage to metadata-only storage
 * for Safari/iOS Firestore compatibility
 */

import type { StorePlan } from '../types';

// Extended interface for backward compatibility
export interface LegacyStorePlan extends Omit<StorePlan, 'hasImageData' | 'fileName'> {
  base64?: string; // Optional for backward compatibility
  hasImageData?: boolean;
  fileName?: string;
}

/**
 * Gets the floorplan image URL, handling both legacy (base64) and new (metadata) formats
 * For new metadata-only floorplans, returns a placeholder image
 */
export function getStorePlanImageUrl(storePlan: LegacyStorePlan | StorePlan): string {
  // Base64 stored directly in Firestore
  if ('base64' in storePlan && storePlan.base64) {
    return storePlan.base64;
  }

  // Firebase Storage URL (legacy records that were uploaded before reverting)
  if ('imageUrl' in storePlan && (storePlan as any).imageUrl) {
    return (storePlan as any).imageUrl;
  }

  // Metadata-only record with no image — show placeholder
  if (storePlan.hasImageData) {
    return generateFloorplanPlaceholder(storePlan.fileName || storePlan.name);
  }

  return generateFloorplanPlaceholder('Floorplan');
}

/**
 * Checks if a StorePlan has image data available
 */
export function hasStorePlanImage(storePlan: LegacyStorePlan | StorePlan): boolean {
  // Legacy format
  if ('base64' in storePlan && storePlan.base64) {
    return true;
  }
  
  // New format
  return storePlan.hasImageData === true;
}

/**
 * Generates a placeholder SVG for floorplans
 */
function generateFloorplanPlaceholder(title: string): string {
  const svgContent = `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f3f4f6" stroke="#d1d5db" stroke-width="2"/>
      <circle cx="200" cy="150" r="40" fill="#e5e7eb" stroke="#9ca3af" stroke-width="2"/>
      <text x="200" y="200" font-family="Arial, sans-serif" font-size="14" fill="#6b7280" text-anchor="middle">
        ${title}
      </text>
      <text x="200" y="220" font-family="Arial, sans-serif" font-size="12" fill="#9ca3af" text-anchor="middle">
        Floorplan Uploaded
      </text>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svgContent)}`;
}

/**
 * Determines if StorePlan is in legacy format (has base64 field)
 */
export function isLegacyStorePlan(storePlan: any): storePlan is LegacyStorePlan {
  return 'base64' in storePlan && typeof storePlan.base64 === 'string';
}