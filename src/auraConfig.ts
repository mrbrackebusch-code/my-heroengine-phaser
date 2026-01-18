export const AURA_RADII = [0, 1, 2, 3] as const;
export type AuraRadius = (typeof AURA_RADII)[number];

export const DEFAULT_AURA_RADIUS = 2;

export function pickAuraRadius(requested: number, radii: readonly number[] = AURA_RADII): number {
  const r = Math.max(0, requested | 0);
  if (!radii.length) return r;
  let best = radii[0] | 0;
  let bestDist = Math.abs(r - best);
  for (let i = 1; i < radii.length; i++) {
    const cand = radii[i] | 0;
    const dist = Math.abs(r - cand);
    if (dist < bestDist) {
      best = cand;
      bestDist = dist;
    }
  }
  return best;
}

export function auraSuffix(radius: number): string {
  return `_aura_r${radius | 0}`;
}

export function auraKey(baseKey: string, radius: number): string {
  return `${baseKey}${auraSuffix(radius)}`;
}
