// Service Worker registration and update utilities

export interface ServiceWorkerUpdateAvailable {
  type: 'UPDATE_AVAILABLE';
  registration: ServiceWorkerRegistration;
}

export interface ServiceWorkerUpdated {
  type: 'UPDATED';
}

export type ServiceWorkerEvent = ServiceWorkerUpdateAvailable | ServiceWorkerUpdated;

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private listeners: ((event: ServiceWorkerEvent) => void)[] = [];

  async register(): Promise<ServiceWorkerRegistration | null> {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return null;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('Service Worker registered successfully');

      // Check for updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration?.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker is available
            this.notifyListeners({
              type: 'UPDATE_AVAILABLE',
              registration: this.registration!
            });
          }
        });
      });

      // Listen for controlling service worker changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Service worker has been updated and is now controlling the page
        this.notifyListeners({ type: 'UPDATED' });
      });

      // Check if there's already an update waiting
      if (this.registration.waiting) {
        this.notifyListeners({
          type: 'UPDATE_AVAILABLE',
          registration: this.registration
        });
      }

      return this.registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }

  async update(): Promise<void> {
    if (!this.registration) {
      console.warn('No service worker registration found');
      return;
    }

    try {
      await this.registration.update();
      console.log('Service Worker update check completed');
    } catch (error) {
      console.error('Service Worker update failed:', error);
    }
  }

  skipWaiting(): void {
    if (!this.registration?.waiting) {
      console.warn('No waiting service worker found');
      return;
    }

    // Tell the waiting service worker to skip waiting
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  addEventListener(listener: (event: ServiceWorkerEvent) => void): void {
    this.listeners.push(listener);
  }

  removeEventListener(listener: (event: ServiceWorkerEvent) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  private notifyListeners(event: ServiceWorkerEvent): void {
    this.listeners.forEach(listener => listener(event));
  }

  async unregister(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const result = await this.registration.unregister();
      console.log('Service Worker unregistered:', result);
      return result;
    } catch (error) {
      console.error('Service Worker unregistration failed:', error);
      return false;
    }
  }

  // Force clear all caches (useful for debugging)
  async clearAllCaches(): Promise<void> {
    if (!('caches' in window)) {
      return;
    }

    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
      console.log('All caches cleared');
    } catch (error) {
      console.error('Failed to clear caches:', error);
    }
  }
}

// Export singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();

// Utility function to register service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  return serviceWorkerManager.register();
}

// Utility function to force update
export function forceServiceWorkerUpdate(): void {
  serviceWorkerManager.skipWaiting();
}