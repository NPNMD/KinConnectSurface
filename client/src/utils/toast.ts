import toast from 'react-hot-toast';

/**
 * Toast notification utilities with consistent styling and durations
 */

// Toast configuration
const TOAST_CONFIG = {
  success: {
    duration: 3000,
    icon: '✓',
    style: {
      background: '#10b981',
      color: '#fff',
      fontWeight: '500',
    },
  },
  error: {
    duration: 5000,
    icon: '✕',
    style: {
      background: '#ef4444',
      color: '#fff',
      fontWeight: '500',
    },
  },
  info: {
    duration: 4000,
    icon: 'ℹ',
    style: {
      background: '#3b82f6',
      color: '#fff',
      fontWeight: '500',
    },
  },
  warning: {
    duration: 4000,
    icon: '⚠',
    style: {
      background: '#f59e0b',
      color: '#fff',
      fontWeight: '500',
    },
  },
};

/**
 * Show a success toast notification
 */
export const showSuccess = (message: string) => {
  toast.success(message, {
    duration: TOAST_CONFIG.success.duration,
    style: TOAST_CONFIG.success.style,
    icon: TOAST_CONFIG.success.icon,
    ariaProps: {
      role: 'status',
      'aria-live': 'polite',
    },
  });
};

/**
 * Show an error toast notification
 */
export const showError = (message: string) => {
  toast.error(message, {
    duration: TOAST_CONFIG.error.duration,
    style: TOAST_CONFIG.error.style,
    icon: TOAST_CONFIG.error.icon,
    ariaProps: {
      role: 'alert',
      'aria-live': 'assertive',
    },
  });
};

/**
 * Show an info toast notification
 */
export const showInfo = (message: string) => {
  toast(message, {
    duration: TOAST_CONFIG.info.duration,
    style: TOAST_CONFIG.info.style,
    icon: TOAST_CONFIG.info.icon,
    ariaProps: {
      role: 'status',
      'aria-live': 'polite',
    },
  });
};

/**
 * Show a warning toast notification
 */
export const showWarning = (message: string) => {
  toast(message, {
    duration: TOAST_CONFIG.warning.duration,
    style: TOAST_CONFIG.warning.style,
    icon: TOAST_CONFIG.warning.icon,
    ariaProps: {
      role: 'alert',
      'aria-live': 'polite',
    },
  });
};

/**
 * Show a loading toast that can be updated
 */
export const showLoading = (message: string) => {
  return toast.loading(message, {
    style: {
      background: '#6b7280',
      color: '#fff',
      fontWeight: '500',
    },
  });
};

/**
 * Dismiss a specific toast by ID
 */
export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};

/**
 * Dismiss all toasts
 */
export const dismissAllToasts = () => {
  toast.dismiss();
};