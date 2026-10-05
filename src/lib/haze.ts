/** The five haze colors. The bake picks one per photo (spec 7.2). */
export type HazeName = 'ice' | 'denim' | 'navy' | 'silver' | 'dusk';

export const HAZE: Record<HazeName, { fill: string; opacity: number; blend: 'screen' | 'normal' }> = {
  ice: { fill: '#AAC4EC', opacity: 0.38, blend: 'screen' },
  denim: { fill: '#7393C0', opacity: 0.5, blend: 'screen' },
  navy: { fill: '#2A3B58', opacity: 0.6, blend: 'normal' },
  silver: { fill: '#D7DCE3', opacity: 0.34, blend: 'screen' },
  dusk: { fill: 'linear-gradient(180deg, #A9C2E8, #BCC5D3 50%, #D3BD9A)', opacity: 0.4, blend: 'screen' },
};
