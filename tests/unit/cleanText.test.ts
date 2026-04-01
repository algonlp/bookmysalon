import { cleanText } from '../../src/nlp/preprocessing/cleanText';

describe('cleanText', () => {
  it('normalizes spaces and lowercases text', () => {
    expect(cleanText('  Hello   WORLD  ')).toBe('hello world');
  });
});
