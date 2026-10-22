import { getCharWidth, getStringWidth, truncateStringByWidth } from '../utils/charWidth.js';

describe('charWidth', () => {
  describe('getCharWidth', () => {
    it('returns 0 for empty string', () => {
      expect(getCharWidth('')).toBe(0);
      expect(getCharWidth(null as unknown as string)).toBe(0);
    });

    it('returns 1 for ASCII characters', () => {
      expect(getCharWidth('a')).toBe(1);
      expect(getCharWidth('Z')).toBe(1);
      expect(getCharWidth('0')).toBe(1);
      expect(getCharWidth(' ')).toBe(1);
      expect(getCharWidth('!')).toBe(1);
    });

    it('returns 2 for emoji characters', () => {
      expect(getCharWidth('😀')).toBe(2);
      expect(getCharWidth('🚀')).toBe(2);
      expect(getCharWidth('❤️')).toBe(2);
      expect(getCharWidth('🔥')).toBe(2);
    });

    it('returns 2 for CJK characters', () => {
      expect(getCharWidth('中')).toBe(2);
      expect(getCharWidth('文')).toBe(2);
      expect(getCharWidth('あ')).toBe(2); // Hiragana
      expect(getCharWidth('ア')).toBe(2); // Katakana
      expect(getCharWidth('한')).toBe(2); // Korean
    });

    it('returns 2 for full-width characters', () => {
      expect(getCharWidth('Ａ')).toBe(2); // Full-width A
      expect(getCharWidth('１')).toBe(2); // Full-width 1
      expect(getCharWidth('。')).toBe(2); // CJK punctuation
    });

    it('handles surrogate pairs correctly', () => {
      const emoji = '😀'; // U+1F600
      expect(getCharWidth(emoji)).toBe(2);
      
      // Test with explicit surrogate pair
      const surrogateChar = '\uD83D\uDE00'; // Same emoji
      expect(getCharWidth(surrogateChar)).toBe(2);
    });

    it('handles incomplete surrogate pairs', () => {
      const highSurrogate = '\uD83D'; // High surrogate without low
      expect(getCharWidth(highSurrogate)).toBe(2);
    });

    it('skips orphaned low surrogates', () => {
      const lowSurrogate = '\uDC00'; // Low surrogate without high
      expect(getCharWidth(lowSurrogate)).toBe(0);
    });

    it('handles various emoji blocks', () => {
      expect(getCharWidth('⌚')).toBe(2); // U+231A
      expect(getCharWidth('⚡')).toBe(2); // U+26A1
      expect(getCharWidth('✅')).toBe(2); // U+2705
      expect(getCharWidth('⭐')).toBe(2); // U+2B50
    });

    it('draws text-presentation symbols one column wide unless followed by U+FE0F', () => {
      expect(getCharWidth('☀')).toBe(1); // U+2600
      expect(getCharWidth('☀️')).toBe(2);
      expect(getCharWidth('⬇')).toBe(1); // U+2B07
      expect(getCharWidth('★')).toBe(1);
      expect(getCharWidth('●')).toBe(1);
      expect(getCharWidth('▸')).toBe(1);
      expect(getCharWidth('→')).toBe(1);
      expect(getCharWidth('️')).toBe(0);
    });

    it('returns 1 for other Unicode characters', () => {
      expect(getCharWidth('é')).toBe(1); // Latin extended
      expect(getCharWidth('ñ')).toBe(1); // Latin extended
      expect(getCharWidth('α')).toBe(1); // Greek
      expect(getCharWidth('б')).toBe(1); // Cyrillic
    });
  });

  describe('getStringWidth', () => {
    it('returns 0 for empty string', () => {
      expect(getStringWidth('')).toBe(0);
      expect(getStringWidth(null as unknown as string)).toBe(0);
    });

    it('calculates width for ASCII strings', () => {
      expect(getStringWidth('hello')).toBe(5);
      expect(getStringWidth('Hello World!')).toBe(12);
    });

    it('calculates width for strings with emoji', () => {
      expect(getStringWidth('Hello 😀')).toBe(8); // 6 + 2
      expect(getStringWidth('🚀🚀🚀')).toBe(6); // 2 + 2 + 2
    });

    it('calculates width for mixed character strings', () => {
      expect(getStringWidth('Hello 世界')).toBe(10); // 6 + 2 + 2
      expect(getStringWidth('こんにちは')).toBe(10); // 2 * 5
    });

    it('handles surrogate pairs in strings', () => {
      const emojiString = '👍🏼'; // Thumbs up with skin tone (multiple code points)
      expect(getStringWidth(emojiString)).toBe(4); // 2 for base emoji + 2 for skin tone modifier
      
      const mixedString = 'a👍b';
      expect(getStringWidth(mixedString)).toBe(4); // 1 + 2 + 1
    });

    it('handles invalid surrogate sequences', () => {
      const invalidSurrogate = 'a\uD83Db'; // High surrogate not followed by low
      expect(getStringWidth(invalidSurrogate)).toBe(4); // 1 + 2 + 1
    });

    it('calculates width for complex strings', () => {
      const complex = 'User: Hello 世界! 😀 How are you?';
      // U:1 s:1 e:1 r:1 ::1 space:1 H:1 e:1 l:1 l:1 o:1 space:1 世:2 界:2 !:1 space:1 😀:2 space:1 H:1 o:1 w:1 space:1 a:1 r:1 e:1 space:1 y:1 o:1 u:1 ?:1
      // Total: 33 (need to account for the correct width)
      expect(getStringWidth(complex)).toBe(33);
    });
  });

  describe('truncateStringByWidth', () => {
    it('returns empty string for empty input', () => {
      expect(truncateStringByWidth('', 10)).toBe('');
      expect(truncateStringByWidth(null as unknown as string, 10)).toBe('');
    });

    it('returns full string if within width', () => {
      expect(truncateStringByWidth('hello', 10)).toBe('hello');
      expect(truncateStringByWidth('hello', 8)).toBe('hello'); // 5 chars fit within 8 - 3 = 5
    });

    it('truncates ASCII strings correctly', () => {
      expect(truncateStringByWidth('hello world', 8)).toBe('hello...');
      expect(truncateStringByWidth('abcdefghij', 7)).toBe('abcd...');
    });

    it('truncates strings with emoji correctly', () => {
      // Width calculation: H:1 e:1 l:1 l:1 o:1 space:1 = 6
      // When we hit emoji at position 6, width would become 6+2=8
      // Since 8 + 3 (for ...) > 10, we stop before the emoji
      expect(truncateStringByWidth('Hello 😀 World', 10)).toBe('Hello ...');
      expect(truncateStringByWidth('😀😀😀😀', 7)).toBe('😀😀...');
    });

    it('truncates strings with CJK characters', () => {
      // "Hello " = 6, "世" would make it 8, 8+3 > 10, so stop before
      expect(truncateStringByWidth('Hello 世界', 10)).toBe('Hello ...');
      // こ:2 ん:2 に:2 ち:2 = 8, next char would exceed, so stop
      expect(truncateStringByWidth('こんにちは世界', 10)).toBe('こんに...');
    });

    it('handles edge case where character would exceed limit', () => {
      // Width 5 total, but next emoji would make it 7, so stop
      expect(truncateStringByWidth('a😀b', 5)).toBe('a...');
      expect(truncateStringByWidth('世界hello', 7)).toBe('世界...');
    });

    it('preserves surrogate pairs when truncating', () => {
      const emojiString = '👍🏼👍🏼👍🏼'; // Each emoji with skin tone
      // The base emoji 👍 has width 2, 2 + 3 = 5, so it fits exactly
      expect(truncateStringByWidth(emojiString, 5)).toBe('👍...');
    });

    it('handles very small max widths', () => {
      expect(truncateStringByWidth('hello', 3)).toBe('...');
      expect(truncateStringByWidth('hello', 4)).toBe('h...');
    });

    it('handles exact width match', () => {
      expect(truncateStringByWidth('hello', 8)).toBe('hello'); // 5 + 3 for ellipsis
      expect(truncateStringByWidth('hello world', 14)).toBe('hello world'); // 11 + 3 for ellipsis
    });

    it('handles complex mixed content', () => {
      const mixed = 'User said: こんにちは! 😀 Nice to meet you';
      // First 20 width chars should be: "User said: こんに..."
      expect(truncateStringByWidth(mixed, 20)).toBe('User said: こんに...');
    });
  });
});