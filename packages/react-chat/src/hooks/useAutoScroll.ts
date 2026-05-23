import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

const BOTTOM_THRESHOLD = 8;

export const useAutoScroll = (
  ref: RefObject<HTMLElement | null>,
  deps: readonly unknown[]
): void => {
  const wasAtBottomRef = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
      wasAtBottomRef.current = distanceFromBottom <= BOTTOM_THRESHOLD;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (wasAtBottomRef.current) {
      el.scrollTop = el.scrollHeight - el.clientHeight;
    }
  }, deps);
};
