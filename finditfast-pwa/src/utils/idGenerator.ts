/**
 * Utility functions for generating short, user-friendly IDs
 */

/**
 * Generate a short, beautiful owner ID in format: st_XXXXXX
 * Where XXXXXX is a 6-digit number
 */
export const generateOwnerId = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  const combined = timestamp + random;
  
  // Take last 6 digits and ensure it's always 6 digits
  const sixDigits = String(combined).slice(-6).padStart(6, '0');
  
  return `st_${sixDigits}`;
};

/**
 * Generate a short store ID in format: store_XXXXXX
 */
export const generateStoreId = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  const combined = timestamp + random;
  
  // Take last 6 digits and ensure it's always 6 digits
  const sixDigits = String(combined).slice(-6).padStart(6, '0');
  
  return `store_${sixDigits}`;
};

/**
 * Generate a short request ID in format: req_XXXXXX
 */
export const generateRequestId = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  const combined = timestamp + random;
  
  // Take last 6 digits and ensure it's always 6 digits
  const sixDigits = String(combined).slice(-6).padStart(6, '0');
  
  return `req_${sixDigits}`;
};

/**
 * Validate ID format
 */
export const isValidOwnerId = (id: string): boolean => {
  return /^st_\d{6}$/.test(id);
};

export const isValidStoreId = (id: string): boolean => {
  return /^store_\d{6}$/.test(id);
};

/**
 * Check if an ID is already taken (you'll need to implement this with your database)
 */
export const isIdAvailable = async (_id: string, _collection: string): Promise<boolean> => {
  // This will be implemented with Firestore checks
  // For now, return true
  return true;
};

/**
 * Generate a unique ID with collision checking
 */
export const generateUniqueOwnerId = async (): Promise<string> => {
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const id = generateOwnerId();
    const available = await isIdAvailable(id, 'storeOwners');
    
    if (available) {
      return id;
    }
    
    attempts++;
    // Add small delay to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  
  // Fallback to timestamp-based ID if we can't generate unique one
  return `st_${Date.now().toString().slice(-6)}`;
};
