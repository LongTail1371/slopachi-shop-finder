import { describe, it, expect } from 'vitest';
import { cleanText, parseSignedInt, toHalfWidth, extractBrackets, roundHalfAwayFromZero } from '../src/text';

describe('cleanText', () => {
  it('nbsp と全角空白と改行を 1 つの半角空白にする', () => {
    expect(cleanText('\xa0店舗:  新！ガーデン八潮\n\t\t\xa0八潮市　')).toBe('店舗: 新！ガーデン八潮 八潮市');
  });
});

describe('parseSignedInt', () => {
  it('符号と桁区切りと単位を扱う', () => {
    expect(parseSignedInt('+29,780玉')).toBe(29780);
    expect(parseSignedInt('-1,020枚')).toBe(-1020);
    expect(parseSignedInt('7,570G')).toBe(7570);
    expect(parseSignedInt('平均差玉数:+13,700玉')).toBe(13700);
  });
  it('数字が無ければ null', () => {
    expect(parseSignedInt('なし')).toBeNull();
  });
});

describe('toHalfWidth', () => {
  it('全角英数を半角にし波ダッシュを統一する', () => {
    expect(toHalfWidth('ＳＡＯ２ ４１４～４１７')).toBe('SAO2 414〜417');
  });
});

describe('extractBrackets', () => {
  it('【】の中身を順に返す', () => {
    expect(extractBrackets('【からくり2 451】\n【スマスロゴッド 452,453】')).toEqual(['からくり2 451', 'スマスロゴッド 452,453']);
    expect(extractBrackets('なし')).toEqual([]);
  });
});

describe('roundHalfAwayFromZero', () => {
  it('0 から遠い側へ四捨五入する', () => {
    expect(roundHalfAwayFromZero(-0.5)).toBe(-1);
    expect(roundHalfAwayFromZero(-1.5)).toBe(-2);
    expect(roundHalfAwayFromZero(1.5)).toBe(2);
    expect(roundHalfAwayFromZero(2.4)).toBe(2);
    expect(roundHalfAwayFromZero(-2.4)).toBe(-2);
    expect(roundHalfAwayFromZero(0)).toBe(0);
    expect(Object.is(roundHalfAwayFromZero(0), -0)).toBe(false);
  });
});
