import { describe, it, expect } from 'vitest';
import { normalizeMachineName, machineKeyFor, isExcludedMachineName } from '../src/normalize';

describe('normalizeMachineName', () => {
  it('全角・空白・記号・大文字小文字のゆれを吸収する', () => {
    expect(normalizeMachineName('真・北斗無双 Re:319ver.')).toBe('真北斗無双re:319ver.');
    expect(normalizeMachineName('真北斗無双　Ｒｅ：３１９Ｖｅｒ．')).toBe('真北斗無双re:319ver.');
    expect(normalizeMachineName('ソードアート・オンライン 閃光の軌跡')).toBe('ソードアートオンライン閃光の軌跡');
  });
});

describe('machineKeyFor', () => {
  it('DMM ID 優先', () => {
    expect(machineKeyFor('押忍！番長 漢の頂', '4714')).toBe('dmm:4714');
  });
  it('ID が無ければ正規化名', () => {
    expect(machineKeyFor('東京喰種', null)).toBe('name:東京喰種');
  });
});

describe('isExcludedMachineName', () => {
  it('バラエティは機種ではない', () => {
    expect(isExcludedMachineName('バラエティ')).toBe(true);
    expect(isExcludedMachineName('東京喰種')).toBe(false);
  });
});
