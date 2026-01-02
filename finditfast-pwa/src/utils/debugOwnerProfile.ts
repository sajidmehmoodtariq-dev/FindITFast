import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AuthService } from '../services/authService';

export const fixOwnerProfile = async () => {
  try {
    const user = AuthService.getCurrentUser();
    if (!user) {
      console.log('❌ No authenticated user');
      return;
    }

    console.log('🔧 FIXING OWNER PROFILE');
    console.log('👤 Current User:', user.email, user.uid);

    // First, find the owner document by firebaseUid
    const ownersSnapshot = await getDocs(
      query(collection(db, 'storeOwners'), where('firebaseUid', '==', user.uid))
    );

    if (ownersSnapshot.empty) {
      console.log('❌ No owner document found with firebaseUid:', user.uid);
      console.log('💡 The owner document might not exist yet or uses a different structure');
      
      // Try to find owner by email as fallback
      const emailSnapshot = await getDocs(
        query(collection(db, 'storeOwners'), where('email', '==', user.email))
      );
      
      if (!emailSnapshot.empty) {
        const ownerDoc = emailSnapshot.docs[0];
        console.log('🔍 Found owner by email:', ownerDoc.id);
        
        // Update with correct firebaseUid
        await updateDoc(doc(db, 'storeOwners', ownerDoc.id), {
          firebaseUid: user.uid,
          updatedAt: new Date()
        });
        
        console.log('✅ Successfully updated firebaseUid for owner:', ownerDoc.id);
      } else {
        console.log('❌ No owner document found by email either:', user.email);
      }
      return;
    }

    const ownerDoc = ownersSnapshot.docs[0];
    console.log('✅ Found owner document:', ownerDoc.id);

    // Update the owner document
    await updateDoc(doc(db, 'storeOwners', ownerDoc.id), {
      firebaseUid: user.uid,
      updatedAt: new Date()
    });

    console.log('✅ Successfully fixed firebaseUid for owner:', ownerDoc.id);
    
  } catch (error) {
    console.error('❌ Error fixing owner profile:', error);
  }
};

export const debugOwnerProfile = async () => {
  try {
    const user = AuthService.getCurrentUser();
    if (!user) {
      console.log('❌ No authenticated user');
      return;
    }

    console.log('🔍 DEBUGGING OWNER PROFILE');
    console.log('👤 Current User:', user.email, user.uid);

    // Check all store owners
    const ownersSnapshot = await getDocs(collection(db, 'storeOwners'));
    console.log('📋 Total store owners in database:', ownersSnapshot.docs.length);

    ownersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      console.log(`👤 Owner ${doc.id}:`, {
        id: doc.id,
        email: data.email,
        firebaseUid: data.firebaseUid,
        storeId: data.storeId,
        name: data.name
      });
    });

    // Check for owner with matching firebaseUid
    const matchingOwners = ownersSnapshot.docs.filter(doc => 
      doc.data().firebaseUid === user.uid
    );
    
    console.log('🎯 Matching owners for current user:', matchingOwners.length);
    matchingOwners.forEach(doc => {
      console.log('✅ Found matching owner:', doc.id, doc.data());
    });

    // Check store requests
    const requestsSnapshot = await getDocs(collection(db, 'storeRequests'));
    console.log('📋 Total store requests:', requestsSnapshot.docs.length);

    const userRequests = requestsSnapshot.docs.filter(doc => 
      doc.data().requestedBy === user.uid
    );
    
    console.log('🎯 Store requests for current user:', userRequests.length);
    userRequests.forEach(doc => {
      const data = doc.data();
      console.log(`📝 Request ${doc.id}:`, {
        id: doc.id,
        requestedBy: data.requestedBy,
        status: data.status,
        storeName: data.storeName,
        storeId: data.storeId
      });
    });

    // Check stores
    const storesSnapshot = await getDocs(collection(db, 'stores'));
    console.log('📋 Total stores:', storesSnapshot.docs.length);

    const userStores = storesSnapshot.docs.filter(doc => 
      doc.data().ownerId === user.uid
    );
    
    console.log('🎯 Stores owned by current user:', userStores.length);
    userStores.forEach(doc => {
      const data = doc.data();
      console.log(`🏪 Store ${doc.id}:`, {
        id: doc.id,
        name: data.name,
        ownerId: data.ownerId,
        status: data.status
      });
    });

  } catch (error) {
    console.error('❌ Error debugging owner profile:', error);
  }
};
