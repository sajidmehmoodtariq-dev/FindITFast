import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDRGNwnwa0kKngvi8T-2FJor0n9GvWqKVw",
  authDomain: "finditfastapp.firebaseapp.com",
  projectId: "finditfastapp",
  storageBucket: "finditfastapp.firebasestorage.app",
  messagingSenderId: "552579740458",
  appId: "1:552579740458:web:84e9d74bc1e90ae0ea72d4",
  measurementId: "G-7QHFZG1FCZ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function debugReports() {
  console.log('\n🔍 DEBUGGING REPORTS SYSTEM\n');
  console.log('=' .repeat(60));
  
  const itemId = '4gxnEZ0bsdy4CuQyEHA0';
  const ownerEmail = 'ibitbytesoft@gmail.com';
  
  // 1. Find the item
  console.log('\n📦 Step 1: Finding the item...');
  const itemsSnapshot = await getDocs(collection(db, 'items'));
  const item = itemsSnapshot.docs.find(doc => doc.id === itemId);
  
  if (item) {
    const itemData = item.data();
    console.log('✅ Item found!');
    console.log('   Item ID:', item.id);
    console.log('   Item Name:', itemData.name);
    console.log('   Store ID:', itemData.storeId);
    console.log('   Owner ID:', itemData.ownerId);
    
    // 2. Find reports for this item
    console.log('\n📊 Step 2: Finding reports for this item...');
    const reportsSnapshot = await getDocs(query(
      collection(db, 'reports'),
      where('itemId', '==', itemId)
    ));
    
    console.log(`   Found ${reportsSnapshot.docs.length} report(s)`);
    reportsSnapshot.docs.forEach(doc => {
      const report = doc.data();
      console.log('   Report:', {
        id: doc.id,
        type: report.type,
        storeId: report.storeId,
        timestamp: report.timestamp?.toDate?.()
      });
    });
    
    // 3. Find the store
    console.log('\n🏪 Step 3: Finding the store...');
    const storeId = itemData.storeId;
    
    // Check in stores collection
    const storesSnapshot = await getDocs(query(
      collection(db, 'stores'),
      where('__name__', '==', storeId)
    ));
    
    if (storesSnapshot.docs.length > 0) {
      const store = storesSnapshot.docs[0].data();
      console.log('✅ Store found in stores collection:');
      console.log('   Store ID:', storesSnapshot.docs[0].id);
      console.log('   Store Name:', store.name);
      console.log('   Owner ID:', store.ownerId);
    } else {
      console.log('❌ Store NOT found in stores collection');
    }
    
    // Check in storeRequests collection
    const storeRequestsSnapshot = await getDocs(query(
      collection(db, 'storeRequests'),
      where('__name__', '==', storeId)
    ));
    
    if (storeRequestsSnapshot.docs.length > 0) {
      const storeRequest = storeRequestsSnapshot.docs[0].data();
      console.log('✅ Store found in storeRequests collection:');
      console.log('   Store ID:', storeRequestsSnapshot.docs[0].id);
      console.log('   Store Name:', storeRequest.storeName);
      console.log('   Owner ID:', storeRequest.ownerId);
      console.log('   Requested By:', storeRequest.requestedBy);
      console.log('   Status:', storeRequest.status);
    } else {
      console.log('❌ Store NOT found in storeRequests collection');
    }
    
    // 4. Find owner profile
    console.log('\n👤 Step 4: Finding owner profile...');
    const ownerProfilesSnapshot = await getDocs(query(
      collection(db, 'ownerProfiles'),
      where('email', '==', ownerEmail)
    ));
    
    if (ownerProfilesSnapshot.docs.length > 0) {
      const ownerProfile = ownerProfilesSnapshot.docs[0];
      const ownerData = ownerProfile.data();
      console.log('✅ Owner profile found:');
      console.log('   Profile ID:', ownerProfile.id);
      console.log('   Name:', ownerData.name);
      console.log('   Email:', ownerData.email);
      console.log('   Store ID:', ownerData.storeId);
    } else {
      console.log('❌ Owner profile NOT found');
    }
    
    // 5. Find all stores for this owner
    console.log('\n🏪 Step 5: Finding all stores owned by this user...');
    const ownerId = itemData.ownerId;
    
    const ownerStoresSnapshot = await getDocs(query(
      collection(db, 'stores'),
      where('ownerId', '==', ownerId)
    ));
    
    console.log(`   Found ${ownerStoresSnapshot.docs.length} store(s) in stores collection`);
    ownerStoresSnapshot.docs.forEach(doc => {
      console.log('   -', doc.id, ':', doc.data().name);
    });
    
    const ownerRequestsSnapshot = await getDocs(query(
      collection(db, 'storeRequests'),
      where('ownerId', '==', ownerId),
      where('status', '==', 'approved')
    ));
    
    console.log(`   Found ${ownerRequestsSnapshot.docs.length} approved store(s) in storeRequests collection`);
    ownerRequestsSnapshot.docs.forEach(doc => {
      console.log('   -', doc.id, ':', doc.data().storeName);
    });
    
  } else {
    console.log('❌ Item NOT found!');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Debug complete!\n');
}

debugReports().catch(console.error);
