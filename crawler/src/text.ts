export function cleanText(s: string): string {
  return s
    .replace(/\xa0/g, ' ')
    .replace(/　/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSignedInt(s: string): number | null {
  const m = s.replace(/\xa0/g, ' ').match(/([+\-−－]?)\s*([\d,，]+)/);
  if (!m) return null;
  const sign = m[1] && m[1] !== '+' ? -1 : 1;
  const digits = m[2]!.replace(/[,，]/g, '');
  if (digits === '') return null;
  return sign * Number(digits);
}

export function toHalfWidth(s: string): string {
  return s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[～~]/g, '〜');
}

export function extractBrackets(s: string): string[] {
  return [...s.matchAll(/【([^】]+)】/g)].map((m) => m[1]!.trim());
}

/** 四捨五入（0 から遠い側へ）。Math.round は -0.5 → -0 になるため使わない */
export function roundHalfAwayFromZero(n: number): number {
  return Math.sign(n) * Math.round(Math.abs(n)) || 0;
}
