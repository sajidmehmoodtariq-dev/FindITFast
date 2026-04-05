import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export const AdminService = {
  async isAdminUid(uid: string): Promise<boolean> {
    if (!uid) return false;

    try {
      const adminDoc = await getDoc(doc(db, 'admins', uid));
      return adminDoc.exists();
    } catch (error) {
      console.error('Error checking admin access:', error);
      return false;
    }
  }
};
