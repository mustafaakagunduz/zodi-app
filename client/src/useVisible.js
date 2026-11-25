import { useSyncExternalStore } from 'react';

const subscribe = (onChange) => {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
};

export default function useVisible() {
  return useSyncExternalStore(subscribe, () => document.visibilityState === 'visible');
}
