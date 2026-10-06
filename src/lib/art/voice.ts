// Salesforce: a voice waveform, thirteen lines that swell in the middle, over
// a row of level bars. The phase 1 drawing, unchanged.
import { Pen } from './pen';

export function voice(uid: string): string {
  const p = new Pen(uid);
  for (let i = 0; i < 13; i++) {
    let d = '';
    for (let x = 0; x <= 600; x += 5) {
      const env = Math.exp(-Math.pow((x - 300) / 165, 2));
      const y = 300 + (i - 6) * 9 + Math.sin(x * 0.043 + i * 0.5) * env * (110 - Math.abs(i - 6) * 12) + Math.sin(x * 0.12 + i * 1.3) * env * 16;
      d += (x === 0 ? 'M' : 'L') + x + ',' + y.toFixed(1) + ' ';
    }
    p.B(d);
    if (i % 4 === 1) p.F(d, 6 + i * 0.35, i * 0.8, i % 8 === 1);
    if (i === 6) p.T(d);
  }
  for (let x = 60; x <= 540; x += 24) {
    const h = 6 + 34 * Math.exp(-Math.pow((x - 300) / 140, 2)) * (0.6 + 0.4 * Math.sin(x));
    p.B('M' + x + ',' + (520 - h) + ' L' + x + ',' + (520 + h));
  }
  return p.svg('voice');
}
