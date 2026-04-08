import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export const AdminService = {
  async isAdminUid(uid: string, email?: string): Promise<boolean> {
    if (!uid) return false;

    try {
      const [adminDoc, appConfigDoc] = await Promise.all([
        getDoc(doc(db, 'admins', uid)),
        getDoc(doc(db, 'appConfig', 'public'))
      ]);

      if (adminDoc.exists()) {
        return true;
      }

      const normalizedEmail = email?.trim().toLowerCase();
      if (!normalizedEmail || !appConfigDoc.exists()) {
        return normalizedEmail === 'admin@finditfast.com';
      }

      const config = appConfigDoc.data();
      const allowedEmails = new Set<string>();

      if (typeof config.adminEmail === 'string' && config.adminEmail.trim()) {
        allowedEmails.add(config.adminEmail.trim().toLowerCase());
      }

      if (Array.isArray(config.adminEmails)) {
        for (const adminEmail of config.adminEmails) {
          if (typeof adminEmail === 'string' && adminEmail.trim()) {
            allowedEmails.add(adminEmail.trim().toLowerCase());
          }
        }
      }

      return allowedEmails.has(normalizedEmail) || normalizedEmail === 'admin@finditfast.com';
    } catch (error) {
      console.error('Error checking admin access:', error);
      return false;
    }
  }
};
