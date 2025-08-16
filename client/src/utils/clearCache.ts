/**
 * Cache clearing utilities for debugging and manual cache management
 */

import { serviceWorkerManager } from './serviceWorker';

export async function clearAllAppData(): Promise<void> {
  console.log('🧹 Clearing all app data...');
  
  try {
    // 1. Clear all caches
    await serviceWorkerManager.clearAllCaches();
    
    // 2. Clear localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
      console.log('✅ localStorage cleared');
    }
    
    // 3. Clear sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
      console.log('✅ sessionStorage cleared');
    }
    
    // 4. Clear IndexedDB (if any)
    if ('indexedDB' in window) {
      try {
        // This is a basic approach - you might need to customize based on your IndexedDB usage
        const databases = await indexedDB.databases();
        await Promise.all(
          databases.map(db => {
            if (db.name) {
              return new Promise<void>((resolve, reject) => {
                const deleteReq = indexedDB.deleteDatabase(db.name!);
                deleteReq.onsuccess = () => resolve();
                deleteReq.onerror = () => reject(deleteReq.error);
              });
            }
          })
        );
        console.log('✅ IndexedDB cleared');
      } catch (error) {
        console.warn('⚠️ Could not clear IndexedDB:', error);
      }
    }
    
    // 5. Unregister service worker
    await serviceWorkerManager.unregister();
    
    console.log('✅ All app data cleared successfully');
    console.log('🔄 Reloading page to apply changes...');
    
    // Reload the page after a short delay
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
  } catch (error) {
    console.error('❌ Failed to clear app data:', error);
    throw error;
  }
}

export function addClearCacheToConsole(): void {
  // Add a global function to the console for easy debugging
  (window as any).clearKinConnectCache = clearAllAppData;
  console.log('🔧 Debug helper added: Run clearKinConnectCache() in console to clear all app data');
}

// Development helper - only add in development mode
if (import.meta.env.DEV) {
  addClearCacheToConsole();
}