export const haptics = {
  light: () => { if (typeof navigator !== 'undefined') navigator.vibrate?.(10); },
  medium: () => { if (typeof navigator !== 'undefined') navigator.vibrate?.(25); },
  heavy: () => { if (typeof navigator !== 'undefined') navigator.vibrate?.(50); },
  success: () => { if (typeof navigator !== 'undefined') navigator.vibrate?.([10, 30, 10]); },
  error: () => { if (typeof navigator !== 'undefined') navigator.vibrate?.([50, 30, 50]); },
};
