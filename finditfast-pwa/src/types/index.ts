import { Timestamp } from 'firebase/firestore';

export interface Store {
  id: string;
  name: string;
  address: string;
  location: {
    latitude: number;
    longitude: number;
  };
  floorplanUrl?: string; // Backward compatibility - deprecated
  floorplanData?: {
    name: string;
    type: string;
    size: number;
    base64: string;
    uploadedAt: Date;
    originalSize: number;
  }; // Backward compatibility - deprecated
  ownerId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
}

export interface StorePlan {
  id: string;
  storeId: string;
  ownerId: string;
  name: string;
  type: string;
  size: number;
  // base64: string; // Removed to avoid Safari/iOS Firestore size limitations
  uploadedAt: Timestamp;
  originalSize: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Metadata fields instead of storing base64 data
  hasImageData: boolean;
  fileName: string;
}

export interface Item {
  id: string;
  name: string;
  category?: string; // Item category for organization
  description?: string; // Optional item description
  storeId: string;
  floorplanId?: string; // Which floorplan this item belongs to
  imageUrl: string; // Changed to store placeholder/metadata instead of base64
  priceImageUrl?: string;
  position?: {
    x: number;
    y: number;
  };
  price?: string; // Changed to string to support formats like "$5.99"
  inStock?: boolean; // In-stock status
  verified: boolean;
  verifiedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  reportCount: number;
  deleted?: boolean; // Soft delete flag
  // Metadata fields for Safari/iOS compatibility
  hasImageData?: boolean;
  imageMimeType?: string;
  imageSize?: number;
  hasPriceImage?: boolean;
  priceImageMimeType?: string;
  priceImageSize?: number;
}

export interface StoreOwner {
  id: string;           // Custom short ID like "st_088354"
  firebaseUid: string;  // Firebase Auth UID for authentication
  name: string;
  email: string;
  phone: string;
  storeId: string;
  createdAt: Timestamp;
}

export interface Report {
  id: string;
  itemId: string;
  storeId: string;
  userId?: string;
  type: 'missing' | 'moved' | 'found' | 'confirm';
  timestamp: Timestamp;
  status?: 'pending' | 'resolved' | 'dismissed';
  location?: {
    latitude: number;
    longitude: number;
  };
  metadata?: {
    itemName?: string;
    itemImageUrl?: string; // Keep for backward compatibility
    locationImageUrl?: string; // Keep for backward compatibility
    itemImageBase64?: string; // New base64 storage
    locationImageBase64?: string; // New base64 storage
    comments?: string;
    reportType?: string;
  };
}

export interface StoreRequest {
  id: string;
  storeId: string;     // Generated when request is created
  storeName: string;
  address: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  requestedBy: string; // Always required to match Firestore rules
  ownerId?: string;    // For backward compatibility
  ownerName?: string;
  ownerEmail?: string;
  notes?: string;
  requestedAt: Date;
  status: 'pending' | 'approved' | 'rejected';
  approvedAt?: Date;
  rejectedAt?: Date;
  approvedBy?: string;
  rejectedBy?: string;
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  uploadedFiles?: Array<{
    name: string;
    url: string;
    size: number;
  }>;
}

export interface UserRequest {
  id: string;
  requestType: 'new_store' | 'new_item';
  userId?: string; // Optional for anonymous requests
  userEmail?: string;
  title: string;
  description: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  address?: string;
  storeName?: string; // For new store requests
  itemName?: string; // For new item requests
  storeId?: string; // For new item requests - which store to add to
  category?: string;
  requestedAt: Date;
  status: 'pending' | 'reviewed' | 'implemented' | 'rejected';
  reviewedAt?: Date;
  reviewedBy?: string;
  priority: 'low' | 'medium' | 'high';
  metadata?: {
    images?: string[]; // Base64 encoded images
    additionalInfo?: Record<string, any>;
  };
}

// Re-export permission types
export * from './permissions';