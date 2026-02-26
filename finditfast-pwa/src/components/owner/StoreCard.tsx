import React from 'react';
import type { Store, StorePlan } from '../../types';
import { getStorePlanImageUrl } from '../../utils/storePlanCompatibility';

interface StoreWithPlans {
  store: Store;
  plans: StorePlan[];
  items: any[];
  itemCount: number;
  categories: string[];
}

interface StoreCardProps {
  storeData: StoreWithPlans;
  onOpenInventory: (store: Store, plan: StorePlan) => void;
  onManageItems: (store: Store) => void;
  onSetActivePlan: (storeId: string, planId: string) => void;
}

export const StoreCard: React.FC<StoreCardProps> = ({
  storeData,
  onManageItems,
  onSetActivePlan
}) => {
  const { store, plans, itemCount, categories } = storeData;
  const activePlan = plans.find(plan => plan.isActive) || plans[0];

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
      {/* Store Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{store.name}</h3>
            <p className="text-sm text-gray-600">{store.address}</p>
          </div>
          <div className="text-right">
            <div className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2 py-1 rounded-full">
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-1 mb-4">
          {categories.map((category, index) => (
            <span
              key={index}
              className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-md"
            >
              {category}
            </span>
          ))}
        </div>
      </div>

      {/* Floorplan Preview */}
      {activePlan ? (
        <div className="px-6">
          <div className="relative bg-gray-100 rounded-lg overflow-hidden mb-4" style={{ height: '200px' }}>
            <img
              src={getStorePlanImageUrl(activePlan)}
              alt={`${store.name} floorplan`}
              className="w-full h-full object-cover"
            />
            
            {/* Active Plan Indicator */}
            <div className="absolute top-3 right-3">
              <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center">
                <div className="w-2 h-2 bg-white rounded-full mr-1"></div>
                Active Plan
              </div>
            </div>
            
            {/* Item Count Overlay */}
            <div className="absolute bottom-3 right-3">
              <div className="bg-black bg-opacity-70 text-white text-sm px-2 py-1 rounded-md">
                {itemCount} items
              </div>
            </div>
          </div>

          {/* Plan Selector */}
          {plans.length > 1 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Floorplan ({plans.length} available)
              </label>
              <select
                value={activePlan.id}
                onChange={(e) => onSetActivePlan(store.id, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} {plan.isActive ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      ) : (
        <div className="px-6">
          <div className="bg-gray-100 rounded-lg p-8 text-center mb-4" style={{ height: '200px' }}>
            <div className="text-gray-400 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">No floorplan uploaded</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="px-6 pb-6">
        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => onManageItems(store)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            <div className="flex items-center justify-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              Manage Items
            </div>
          </button>
        
        </div>
      </div>

      {/* Store Stats Footer */}
      <div className="bg-gray-50 px-6 py-3 border-t">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">
            Plans: {plans.length}
          </span>
          <span className="text-gray-600">
            Items: {itemCount}
          </span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            activePlan ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {activePlan ? 'Ready' : 'Setup needed'}
          </span>
        </div>
      </div>
    </div>
  );
};
