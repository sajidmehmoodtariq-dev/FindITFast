import { Timestamp } from 'firebase/firestore';
import { ReportService, ItemService } from './firestoreService';
import type { Report } from '../types';

export interface CreateReportData {
  itemId: string;
  storeId: string;
  type: 'missing' | 'moved' | 'found' | 'confirm';
  comment?: string;
  userId?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface CreateItemReportData {
  itemId: string;
  storeId: string;
  itemName: string;
  itemImage: string; // base64 string
  locationImage: string; // base64 string
  comments: string;
  reportedBy: string;
  reportedAt: Date;
}

export class ReportServiceClass {
  /**
   * Submit a new report for an item
   */
  static async submitReport(data: CreateReportData): Promise<string> {
    try {
      // Create the report
      const reportData: Omit<Report, 'id'> = {
        itemId: data.itemId,
        storeId: data.storeId,
        type: data.type,
        timestamp: Timestamp.now(),
        userId: data.userId,
        location: data.location,
      };

      const reportId = await ReportService.create(reportData);

      // Update item report count if it's a negative report (missing or moved)
      if (data.type === 'missing' || data.type === 'moved') {
        await ItemService.incrementReportCount(data.itemId);
      }

      return reportId;
    } catch (error) {
      console.error('Error submitting report:', error);
      throw new Error('Failed to submit report. Please try again.');
    }
  }

  /**
   * Get reports for a specific item
   */
  static async getItemReports(itemId: string): Promise<Report[]> {
    try {
      return await ReportService.getByItem(itemId);
    } catch (error) {
      console.error('Error getting item reports:', error);
      throw new Error('Failed to load reports.');
    }
  }

  /**
   * Get reports for a specific store
   */
  static async getStoreReports(storeId: string): Promise<Report[]> {
    try {
      return await ReportService.getByStore(storeId);
    } catch (error) {
      console.error('Error getting store reports:', error);
      throw new Error('Failed to load store reports.');
    }
  }

  /**
   * Get recent reports across all items
   */
  static async getRecentReports(days: number = 7): Promise<Report[]> {
    try {
      return await ReportService.getRecentReports(days);
    } catch (error) {
      console.error('Error getting recent reports:', error);
      throw new Error('Failed to load recent reports.');
    }
  }

  /**
   * Get report statistics for an item
   */
  static async getItemReportStats(itemId: string): Promise<{
    total: number;
    missing: number;
    moved: number;
    found: number;
    confirmed: number;
  }> {
    try {
      const reports = await ReportService.getByItem(itemId);
      
      const stats = {
        total: reports.length,
        missing: 0,
        moved: 0,
        found: 0,
        confirmed: 0,
      };

      reports.forEach(report => {
        switch (report.type) {
          case 'missing':
            stats.missing++;
            break;
          case 'moved':
            stats.moved++;
            break;
          case 'found':
            stats.found++;
            break;
          case 'confirm':
            stats.confirmed++;
            break;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting item report stats:', error);
      throw new Error('Failed to load report statistics.');
    }
  }

  /**
   * Check if an item should be flagged for admin review
   * Items are flagged if they have multiple negative reports
   */
  static async shouldFlagItem(itemId: string): Promise<boolean> {
    try {
      const stats = await this.getItemReportStats(itemId);
      const negativeReports = stats.missing + stats.moved;
      const positiveReports = stats.found + stats.confirmed;
      
      // Flag if there are 3+ negative reports and more negative than positive
      return negativeReports >= 3 && negativeReports > positiveReports;
    } catch (error) {
      console.error('Error checking if item should be flagged:', error);
      return false;
    }
  }

  /**
   * Flag an item for admin review by updating its status
   * This would typically update a flag in the item record
   */
  static async flagItemForReview(itemId: string, reason: string = 'Multiple negative reports'): Promise<void> {
    try {
      // In a real implementation, you might want to add a 'flagged' field to the Item model
      // For now, we'll log this action and could extend the Item interface later
      console.log(`Item ${itemId} flagged for admin review: ${reason}`);
      
      // This would be implemented when admin functionality is added
      // await FirestoreService.addDocument('flagged_items', { itemId, reason, timestamp: Timestamp.now(), status: 'pending_review' });
    } catch (error) {
      console.error('Error flagging item for review:', error);
      throw new Error('Failed to flag item for review.');
    }
  }

  /**
   * Process a report and automatically flag item if needed
   */
  static async processReportAndFlag(data: CreateReportData): Promise<string> {
    try {
      // Submit the report first
      const reportId = await this.submitReport(data);
      
      // Check if item should be flagged after this report
      if (data.type === 'missing' || data.type === 'moved') {
        const shouldFlag = await this.shouldFlagItem(data.itemId);
        if (shouldFlag) {
          await this.flagItemForReview(data.itemId, `Multiple ${data.type} reports received`);
        }
      }
      
      return reportId;
    } catch (error) {
      console.error('Error processing report and flagging:', error);
      throw error;
    }
  }

  /**
   * Create an item report with images (base64)
   */
  static async createItemReport(data: CreateItemReportData): Promise<string> {
    try {
      // Create the report data with base64 images stored directly
      const reportData: Omit<Report, 'id'> = {
        itemId: data.itemId,
        storeId: data.storeId,
        type: 'missing',
        timestamp: Timestamp.fromDate(data.reportedAt),
        userId: data.reportedBy,
        status: 'pending',
        metadata: {
          itemName: data.itemName,
          itemImageBase64: data.itemImage, // Store base64 directly
          locationImageBase64: data.locationImage, // Store base64 directly
          comments: data.comments,
          reportType: 'missing_with_images'
        }
      };

      // Save to database
      const reportId = await ReportService.create(reportData);
      
      return reportId;
    } catch (error) {
      console.error('Error creating item report:', error);
      throw new Error('Failed to submit report. Please try again.');
    }
  }

  /**
   * Get user location for reports (if permission granted)
   */
  static async getUserLocation(): Promise<{ latitude: number; longitude: number } | undefined> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(undefined);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.warn('Could not get user location:', error);
          resolve(undefined);
        },
        {
          timeout: 5000,
          maximumAge: 300000, // 5 minutes
        }
      );
    });
  }
}

export const reportService = ReportServiceClass;