#!/usr/bin/env node
/**
 * Enhanced Inventory Demo Population Script
 * Creates sample stores with floorplans and items for testing the enhanced inventory system
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sample base64 floorplan (small test image)
const sampleFloorplanBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// Sample base64 item images (small test images)
const sampleItemImages = {
  milk: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  bread: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  soap: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
};

async function createEnhancedInventoryDemo() {
  console.log('🚀 Creating Enhanced Inventory Demo Data...');

  try {
    // Test store owner UID (using the existing test owner)
    const testOwnerUid = 'GFBy3Rd7zVTl9zqwAmnCHtcFXN82'; // Known test owner
    const timestamp = new Date();

    // 1. Create Store Requests
    console.log('📝 Creating store requests...');
    
    const stores = [
      {
        id: `store_${Date.now()}_001`,
        name: 'Downtown Grocery',
        address: '123 Main St, Downtown',
        location: { latitude: -33.8688, longitude: 151.2093 }
      },
      {
        id: `store_${Date.now()}_002`,
        name: 'Corner Pharmacy',
        address: '456 Oak Ave, Suburb',
        location: { latitude: -33.8650, longitude: 151.2094 }
      },
      {
        id: `store_${Date.now()}_003`,
        name: 'Quick Mart',
        address: '789 Pine St, City Center',
        location: { latitude: -33.8670, longitude: 151.2095 }
      }
    ];

    const storeIds = [];

    for (const store of stores) {
      // Create store request
      const requestRef = await addDoc(collection(db, 'storeRequests'), {
        storeId: store.id,
        storeName: store.name,
        address: store.address,
        location: store.location,
        requestedBy: testOwnerUid,
        status: 'approved',
        requestedAt: timestamp,
        approvedAt: timestamp,
        approvedBy: 'finditfasthq@gmail.com'
      });
      
      console.log(`✅ Created store request: ${store.name} (${requestRef.id})`);

      // Create actual store
      await setDoc(doc(db, 'stores', store.id), {
        id: store.id,
        name: store.name,
        address: store.address,
        location: store.location,
        ownerId: testOwnerUid,
        createdAt: timestamp,
        updatedAt: timestamp
      });

      console.log(`🏪 Created store: ${store.name} (${store.id})`);
      storeIds.push(store.id);
    }

    // 2. Create Store Plans for each store
    console.log('🗺️ Creating store plans...');
    
    const storePlans = [];
    
    for (let i = 0; i < stores.length; i++) {
      const store = stores[i];
      
      // Create main floorplan
      const mainPlanId = `plan_${store.id}_main`;
      const mainPlan = {
        id: mainPlanId,
        storeId: store.id,
        ownerId: testOwnerUid,
        name: `${store.name} - Main Floor`,
        type: 'image/png',
        size: 1024,
        base64: sampleFloorplanBase64,
        uploadedAt: timestamp,
        originalSize: 2048,
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      await setDoc(doc(db, 'storePlans', mainPlanId), mainPlan);
      storePlans.push(mainPlan);
      console.log(`📋 Created plan: ${mainPlan.name} (${mainPlanId})`);

      // Create secondary floorplan for some stores
      if (i < 2) {
        const secondPlanId = `plan_${store.id}_second`;
        const secondPlan = {
          id: secondPlanId,
          storeId: store.id,
          ownerId: testOwnerUid,
          name: `${store.name} - Storage Area`,
          type: 'image/png',
          size: 1024,
          base64: sampleFloorplanBase64,
          uploadedAt: timestamp,
          originalSize: 2048,
          isActive: false,
          createdAt: timestamp,
          updatedAt: timestamp
        };

        await setDoc(doc(db, 'storePlans', secondPlanId), secondPlan);
        storePlans.push(secondPlan);
        console.log(`📋 Created plan: ${secondPlan.name} (${secondPlanId})`);
      }
    }

    // 3. Create Sample Items
    console.log('📦 Creating sample items...');
    
    const itemTemplates = [
      { name: 'Whole Milk', price: '$4.99', category: 'Dairy', image: sampleItemImages.milk },
      { name: 'White Bread', price: '$2.49', category: 'Bakery', image: sampleItemImages.bread },
      { name: 'Hand Soap', price: '$3.99', category: 'Personal Care', image: sampleItemImages.soap },
      { name: 'Organic Eggs', price: '$5.99', category: 'Dairy', image: sampleItemImages.milk },
      { name: 'Wheat Bread', price: '$2.99', category: 'Bakery', image: sampleItemImages.bread },
      { name: 'Body Wash', price: '$6.49', category: 'Personal Care', image: sampleItemImages.soap },
      { name: 'Cheddar Cheese', price: '$7.99', category: 'Dairy', image: sampleItemImages.milk },
      { name: 'Croissants', price: '$4.49', category: 'Bakery', image: sampleItemImages.bread },
      { name: 'Toothpaste', price: '$3.49', category: 'Personal Care', image: sampleItemImages.soap }
    ];

    let itemCount = 0;
    
    for (const storePlan of storePlans) {
      // Add 3-5 items per floorplan
      const itemsToAdd = Math.floor(Math.random() * 3) + 3;
      
      for (let i = 0; i < itemsToAdd && itemCount < itemTemplates.length; i++) {
        const template = itemTemplates[itemCount];
        
        const itemData = {
          name: template.name,
          price: template.price,
          imageUrl: `data:image/png;base64,${template.image}`,
          priceImageUrl: `data:image/png;base64,${template.image}`,
          storeId: storePlan.storeId,
          floorplanId: storePlan.id,
          position: {
            x: Math.random() * 80 + 10, // 10-90%
            y: Math.random() * 80 + 10  // 10-90%
          },
          verified: true,
          verifiedAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
          reportCount: 0
        };

        const itemRef = await addDoc(collection(db, 'items'), itemData);
        console.log(`📦 Created item: ${template.name} in ${storePlan.name} (${itemRef.id})`);
        itemCount++;
      }
    }

    console.log('\n🎉 Enhanced Inventory Demo Data Created Successfully!');
    console.log('\n📊 Summary:');
    console.log(`   🏪 Stores: ${stores.length}`);
    console.log(`   📋 Store Plans: ${storePlans.length}`);
    console.log(`   📦 Items: ${itemCount}`);
    console.log(`   👤 Owner: ${testOwnerUid}`);
    
    console.log('\n🚀 To test the Enhanced Inventory System:');
    console.log('   1. Start your app: npm run dev');
    console.log('   2. Login as owner: test@gmail.com / Test123!');
    console.log('   3. Go to Owner Dashboard → Inventory tab');
    console.log('   4. You should see your stores with floorplan previews');
    console.log('   5. Click "Manage Items" to open the enhanced inventory modal');
    console.log('   6. Click on the floorplan to add new items');

  } catch (error) {
    console.error('❌ Error creating demo data:', error);
    throw error;
  }
}

// Run the script
createEnhancedInventoryDemo()
  .then(() => {
    console.log('\n✅ Demo data creation completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Demo data creation failed:', error);
    process.exit(1);
  });
