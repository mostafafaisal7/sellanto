import { useEffect, useRef } from 'react';

interface BoomerangVideoProps {
  src: string;
  className?: string;
}

/**
 * Plays a video on a ping-pong loop: forward (first→last), then reverse
 * (last→first), then forward again, forever.
 *
 * `<video loop>` only loops forward and `playbackRate = -1` isn't supported in
 * Chrome, so the reverse phase is driven manually by stepping `currentTime`
 * backwards with requestAnimationFrame. Must stay `muted` + `playsInline` so
 * browsers allow autoplay.
 */
export function BoomerangVideo({ src, className }: BoomerangVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;

    let raf = 0;
    let last = 0;

    const stepReverse = (ts: number) => {
      if (!last) last = ts;
      const dt = (ts - last) / 1000; // seconds since last frame
      last = ts;
      const next = v.currentTime - dt;
      if (next <= 0) {
        // reached the start → play forward again
        v.currentTime = 0;
        last = 0;
        v.play().catch(() => {});
        return;
      }
      v.currentTime = next;
      raf = requestAnimationFrame(stepReverse);
    };

    const onEnded = () => {
      // reached the end → run backwards to the start
      v.pause();
      last = 0;
      raf = requestAnimationFrame(stepReverse);
    };

    v.addEventListener('ended', onEnded);
    v.play().catch(() => {});

    return () => {
      v.removeEventListener('ended', onEnded);
      cancelAnimationFrame(raf);
    };
  }, [src]);

  return (
    <video
      ref={ref}
      src={src}
      className={className}
      muted
      autoPlay
      playsInline
      preload="auto"
    />
  );
}

export default BoomerangVideo;
