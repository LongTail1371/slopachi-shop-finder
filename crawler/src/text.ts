export function cleanText(s: string): string {
  return s
    .replace(/ /g, ' ')
    .replace(/　/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseSignedInt(s: string): number | null {
  const m = s.replace(/ /g, ' ').match(/([+\-−－]?)\s*([\d,，]+)/);
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
