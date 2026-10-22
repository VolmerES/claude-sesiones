// Emoji_Presentation=Yes between U+2000 and U+2BFF (Unicode emoji-data.txt)
const EMOJI_PRESENTATION_BMP: Array<[number, number]> = [
  [0x231A, 0x231B], [0x23E9, 0x23EC], [0x23F0, 0x23F0], [0x23F3, 0x23F3], [0x25FD, 0x25FE],
  [0x2614, 0x2615], [0x2648, 0x2653], [0x267F, 0x267F], [0x2693, 0x2693], [0x26A1, 0x26A1],
  [0x26AA, 0x26AB], [0x26BD, 0x26BE], [0x26C4, 0x26C5], [0x26CE, 0x26CE], [0x26D4, 0x26D4],
  [0x26EA, 0x26EA], [0x26F2, 0x26F3], [0x26F5, 0x26F5], [0x26FA, 0x26FA], [0x26FD, 0x26FD],
  [0x2705, 0x2705], [0x270A, 0x270B], [0x2728, 0x2728], [0x274C, 0x274C], [0x274E, 0x274E],
  [0x2753, 0x2755], [0x2757, 0x2757], [0x2795, 0x2797], [0x27B0, 0x27B0], [0x27BF, 0x27BF],
  [0x2B1B, 0x2B1C], [0x2B50, 0x2B50], [0x2B55, 0x2B55],
];

export function getCharWidth(char: string): number {
  if (!char || char.length === 0) return 0;
  
  const code = char.charCodeAt(0);
  
  // ASCII characters
  if (code <= 0x7F) {
    return 1;
  }
  
  // Check for high surrogate (emoji that use surrogate pairs)
  if (code >= 0xD800 && code <= 0xDBFF) {
    // This is a high surrogate, check if there's a low surrogate following
    if (char.length > 1) {
      const lowSurrogate = char.charCodeAt(1);
      if (lowSurrogate >= 0xDC00 && lowSurrogate <= 0xDFFF) {
        // This is a surrogate pair (emoji)
        return 2;
      }
    }
    return 2; // Treat incomplete surrogate as width 2
  }
  
  // Low surrogate without high surrogate (shouldn't happen in valid UTF-16)
  if (code >= 0xDC00 && code <= 0xDFFF) {
    return 0; // Skip orphaned low surrogates
  }
  
  // Variation selectors and zero-width joiners take no space
  if ((code >= 0xFE00 && code <= 0xFE0F) || (code >= 0x200B && code <= 0x200D)) {
    return 0;
  }

  // A symbol followed by U+FE0F is drawn as an emoji
  if (char.length > 1 && char.charCodeAt(1) === 0xFE0F) {
    return 2;
  }

  // Symbols in the BMP (★ ● ▸ → ☀ …) are one column wide in terminals, except the
  // ones Unicode draws as emoji by default (Emoji_Presentation)
  if (code >= 0x2000 && code <= 0x2BFF) {
    return EMOJI_PRESENTATION_BMP.some(([from, to]) => code >= from && code <= to) ? 2 : 1;
  }

  // Emoji blocks (single code point emojis)
  if ((code >= 0x1F300 && code <= 0x1F5FF) ||   // Miscellaneous Symbols and Pictographs
      (code >= 0x1F600 && code <= 0x1F64F) ||   // Emoticons
      (code >= 0x1F680 && code <= 0x1F6FF) ||   // Transport and Map Symbols
      (code >= 0x1F700 && code <= 0x1F77F) ||   // Alchemical Symbols
      (code >= 0x1F780 && code <= 0x1F7FF) ||   // Geometric Shapes Extended
      (code >= 0x1F800 && code <= 0x1F8FF) ||   // Supplemental Arrows-C
      (code >= 0x1F900 && code <= 0x1F9FF) ||   // Supplemental Symbols and Pictographs
      (code >= 0x1FA00 && code <= 0x1FA6F) ||   // Chess Symbols
      (code >= 0x1FA70 && code <= 0x1FAFF)) {   // Symbols and Pictographs Extended-A
    return 2;
  }
  
  // CJK characters and other full-width characters
  if ((code >= 0x4E00 && code <= 0x9FFF) ||   // CJK Unified Ideographs
      (code >= 0x3040 && code <= 0x309F) ||   // Hiragana
      (code >= 0x30A0 && code <= 0x30FF) ||   // Katakana
      (code >= 0xAC00 && code <= 0xD7AF) ||   // Hangul Syllables (Korean)
      (code >= 0xFF00 && code <= 0xFFEF) ||   // Full-width forms
      (code >= 0x3000 && code <= 0x303F) ||   // CJK punctuation
      (code >= 0xFE30 && code <= 0xFE4F) ||   // CJK Compatibility Forms
      (code >= 0xFE50 && code <= 0xFE6F) ||   // Small Form Variants
      (code >= 0x3200 && code <= 0x32FF) ||   // Enclosed CJK Letters and Months
      (code >= 0x3300 && code <= 0x33FF) ||   // CJK Compatibility
      (code >= 0x3400 && code <= 0x4DBF) ||   // CJK Extension A
      (code >= 0x20000 && code <= 0x2A6DF) || // CJK Extension B
      (code >= 0x2A700 && code <= 0x2B73F) || // CJK Extension C
      (code >= 0x2B740 && code <= 0x2B81F) || // CJK Extension D
      (code >= 0x2B820 && code <= 0x2CEAF) || // CJK Extension E
      (code >= 0x2CEB0 && code <= 0x2EBEF) || // CJK Extension F
      (code >= 0x30000 && code <= 0x3134F)) { // CJK Extension G
    return 2;
  }
  
  // Default for other characters
  return 1;
}

export function getStringWidth(str: string): number {
  if (!str) return 0;
  
  let width = 0;
  let i = 0;
  
  while (i < str.length) {
    const code = str.charCodeAt(i);
    
    // Handle surrogate pairs
    if (code >= 0xD800 && code <= 0xDBFF && i + 1 < str.length) {
      const lowCode = str.charCodeAt(i + 1);
      if (lowCode >= 0xDC00 && lowCode <= 0xDFFF) {
        // This is a valid surrogate pair
        width += 2;
        i += 2;
        continue;
      }
    }
    
    // Single character
    width += getCharWidth(str[i]);
    i++;
  }
  
  return width;
}

export function truncateStringByWidth(str: string, maxWidth: number): string {
  if (!str) return '';
  
  let width = 0;
  let result = '';
  let i = 0;
  
  while (i < str.length) {
    const code = str.charCodeAt(i);
    let charSequence = '';
    let charWidth = 0;
    
    // Handle surrogate pairs
    if (code >= 0xD800 && code <= 0xDBFF && i + 1 < str.length) {
      const lowCode = str.charCodeAt(i + 1);
      if (lowCode >= 0xDC00 && lowCode <= 0xDFFF) {
        // This is a valid surrogate pair
        charSequence = str.slice(i, i + 2);
        charWidth = 2;
        i += 2;
      } else {
        // High surrogate without valid low surrogate
        charSequence = str[i];
        charWidth = getCharWidth(str[i]);
        i++;
      }
    } else {
      // Single character
      charSequence = str[i];
      charWidth = getCharWidth(str[i]);
      i++;
    }
    
    if (width + charWidth > maxWidth - 3) { // Reserve space for "..."
      return result + '...';
    }
    
    result += charSequence;
    width += charWidth;
  }
  
  return result;
}