import { useEffect } from 'react';
import { useAppStore } from '@/stores/app';
import type { DeviceType } from '@/types';

export function useDeviceType() {
  const setDeviceType = useAppStore((s) => s.setDeviceType);

  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      let type: DeviceType = 'desktop';
      if (w < 768) type = 'mobile';
      else if (w < 1024) type = 'tablet';
      setDeviceType(type);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [setDeviceType]);
}
