import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { initSentry, trackPageLoad } from './lib/sentry';
import './index.css';

// Initialize Sentry before rendering the app
initSentry();

/**
 * Track Core Web Vitals (CWV)
 *
 * Core Web Vitals are Google's metrics for measuring user experience:
 * - LCP (Largest Contentful Paint): Loading performance
 * - FID (First Input Delay): Interactivity
 * - CLS (Cumulative Layout Shift): Visual stability
 */
function initCoreWebVitals() {
  // Only track in production or if explicitly enabled
  if (import.meta.env.MODE === 'development' && import.meta.env.VITE_TRACK_WEB_VITALS !== 'true') {
    return;
  }

  // Import web-vitals dynamically to reduce initial bundle size
  import('web-vitals').then(({ onCLS, onFID, onLCP, onFCP, onTTFB }) => {
    // Largest Contentful Paint - measures loading performance
    // Good: < 2.5s, Needs improvement: 2.5s - 4s, Poor: > 4s
    onLCP((metric) => {
      console.log('LCP:', metric.value, 'ms');
      (window as any).Sentry?.setMeasurement('lcp', metric.value, 'millisecond');
      (window as any).Sentry?.setTag('lcp_rating', metric.rating);
    });

    // First Input Delay - measures interactivity
    // Good: < 100ms, Needs improvement: 100-300ms, Poor: > 300ms
    onFID((metric) => {
      console.log('FID:', metric.value, 'ms');
      (window as any).Sentry?.setMeasurement('fid', metric.value, 'millisecond');
      (window as any).Sentry?.setTag('fid_rating', metric.rating);
    });

    // Cumulative Layout Shift - measures visual stability
    // Good: < 0.1, Needs improvement: 0.1-0.25, Poor: > 0.25
    onCLS((metric) => {
      console.log('CLS:', metric.value);
      (window as any).Sentry?.setMeasurement('cls', metric.value, 'none');
      (window as any).Sentry?.setTag('cls_rating', metric.rating);
    });

    // First Contentful Paint - measures when first content is painted
    onFCP((metric) => {
      console.log('FCP:', metric.value, 'ms');
      (window as any).Sentry?.setMeasurement('fcp', metric.value, 'millisecond');
    });

    // Time to First Byte - measures server response time
    onTTFB((metric) => {
      console.log('TTFB:', metric.value, 'ms');
      (window as any).Sentry?.setMeasurement('ttfb', metric.value, 'millisecond');
    });
  }).catch((error) => {
    console.error('Failed to load web-vitals:', error);
  });
}

/**
 * Track route changes for performance monitoring
 */
function initRouteChangeTracking() {
  let lastPath = window.location.pathname;
  let navigationStartTime = performance.now();

  // Track initial page load
  window.addEventListener('load', () => {
    const loadTime = performance.now();
    trackPageLoad(lastPath, loadTime);
  });

  // Track route changes (for single-page app navigation)
  const observer = new MutationObserver(() => {
    const currentPath = window.location.pathname;
    if (currentPath !== lastPath) {
      const navigationTime = performance.now() - navigationStartTime;
      trackPageLoad(currentPath, navigationTime);
      
      lastPath = currentPath;
      navigationStartTime = performance.now();
    }
  });

  // Observe changes to the document title (often updated on route changes)
  observer.observe(document.querySelector('title') || document.head, {
    childList: true,
    subtree: true,
  });
}

/**
 * Track component load times using Performance Observer
 */
function initComponentTracking() {
  if (!('PerformanceObserver' in window)) {
    return;
  }

  try {
    // Track long tasks that might indicate performance issues
    const longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        console.warn('Long task detected:', entry.duration, 'ms', entry);
        
        if (entry.duration > 100) {
          (window as any).Sentry?.captureMessage(
            'Long Task Detected',
            {
              level: 'warning',
              tags: {
                duration: entry.duration,
                type: 'long-task',
              },
            }
          );
        }
      }
    });

    longTaskObserver.observe({ entryTypes: ['longtask'] });
  } catch (error) {
    // Long tasks API might not be supported
    console.log('Long task monitoring not available:', error);
  }
}

/**
 * Monitor memory usage (if available)
 */
function initMemoryMonitoring() {
  // Only in development or if explicitly enabled
  if (import.meta.env.MODE !== 'development' && import.meta.env.VITE_MONITOR_MEMORY !== 'true') {
    return;
  }

  const performance = (window as any).performance;
  
  if (!performance?.memory) {
    return;
  }

  // Log memory usage every minute
  setInterval(() => {
    const memory = performance.memory;
    const usedMB = (memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
    const totalMB = (memory.totalJSHeapSize / 1024 / 1024).toFixed(2);
    const limitMB = (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2);
    
    console.log(
      `Memory: ${usedMB}MB / ${totalMB}MB (limit: ${limitMB}MB)`
    );

    // Warn if memory usage is high (> 80% of limit)
    if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.8) {
      console.warn('High memory usage detected!');
    }
  }, 60000);
}

// Initialize performance monitoring
initCoreWebVitals();
initRouteChangeTracking();
initComponentTracking();
initMemoryMonitoring();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
