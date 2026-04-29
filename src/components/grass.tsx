import { useEffect, useRef, useState } from 'react';

interface Cluster {
  /** Horizontal position as an absolute px offset within the strip. */
  leftPx: number;
  /** Cluster size in px. The taller the cluster, the higher its blade tips
   *  poke up — different cluster heights give a varied grass-line. */
  size: number;
  /** Animation delay in ms so neighbouring clusters don't sway in lockstep. */
  delay: number;
}

/** Read a numeric custom property off an element's computed style, falling
 *  back if it isn't set yet. Strips the trailing "px" Tailwind/Vite happily
 *  emits for some declarations. */
function readNum(el: HTMLElement, name: string, fallback: number): number {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  if (!raw) return fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Walk the strip width laying down clusters every `--grass-stride` px (with
 * jitter), each at a random size between `--grass-cluster-min` and
 * `--grass-cluster-max`. Spacing in real px instead of % keeps the lawn
 * the same density on a 360px phone and a 1200px desktop.
 */
function makeClusters(strip: HTMLElement): Cluster[] {
  const stripWidth = strip.offsetWidth;
  if (stripWidth <= 0) return [];
  const min = readNum(strip, '--grass-cluster-min', 150);
  const max = readNum(strip, '--grass-cluster-max', 275);
  const stride = readNum(strip, '--grass-stride', 80);
  const range = Math.max(0, max - min);

  const out: Cluster[] = [];
  let x = 0;
  while (x < stripWidth) {
    out.push({
      leftPx: x,
      size: Math.round(min + Math.random() * range),
      delay: Math.round(Math.random() * 4000),
    });
    x += stride * (0.7 + Math.random() * 0.6);
  }
  return out;
}

/**
 * Adapted from KPCodes' codepen (vxoqzW). Each cluster is an
 * `overflow: hidden` viewport containing three oversized rectangles
 * positioned mostly out of frame; each rectangle's *border* is the visible
 * grass blade and its rounded top corner is the blade tip. The keyframes
 * animate that border-radius, which makes the curve of the tip oscillate —
 * reading as wind. All tunables (color, blade width, sway speed, cluster
 * size range, spacing) live as CSS variables on `.grass-strip` in
 * styles.css.
 */
export function Grass() {
  const stripRef = useRef<HTMLDivElement>(null);
  const [clusters, setClusters] = useState<Cluster[]>([]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const recompute = () => setClusters(makeClusters(strip));
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(strip);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={stripRef}
      data-id="grass"
      aria-hidden="true"
      className="grass-strip pointer-events-none absolute inset-x-0 bottom-0"
    >
      {clusters.map((c, i) => (
        <div
          key={i}
          data-id={`grass-cluster-${i}`}
          className="grass-cluster"
          style={{
            left: `${c.leftPx}px`,
            width: `${c.size}px`,
            height: `${c.size}px`,
          }}
        >
          <div
            className="grass-blade grass-blade--1"
            style={{ animationDelay: `${c.delay}ms` }}
          />
          <div
            className="grass-blade grass-blade--2"
            style={{ animationDelay: `${c.delay}ms` }}
          />
          <div
            className="grass-blade grass-blade--3"
            style={{ animationDelay: `${c.delay}ms` }}
          />
        </div>
      ))}
    </div>
  );
}
