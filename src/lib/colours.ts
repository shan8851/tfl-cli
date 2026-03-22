const ESCAPE_CHARACTER = String.fromCharCode(27);
const ANSI_PATTERN = new RegExp(`${ESCAPE_CHARACTER}\\[[0-9;]*m`, 'g');
const ANSI_RESET = '\u001B[0m';
const ANSI_BOLD = '\u001B[1m';
const ANSI_DIM = '\u001B[2m';

const HEX_BY_LINE_KEY = {
  bakerloo: '#B26300',
  central: '#DC241F',
  circle: '#FFC80A',
  district: '#007D32',
  dlr: '#00AFAD',
  elizabeth: '#60399E',
  jubilee: '#838D93',
  liberty: '#5D6061',
  lioness: '#FAA61A',
  metropolitan: '#9B0058',
  mildmay: '#0077AD',
  northern: '#E8E8EC',
  overground: '#FA7B05',
  piccadilly: '#0019A8',
  suffragette: '#5BBD72',
  victoria: '#039BE5',
  weaver: '#823A62',
  windrush: '#ED1B00',
  'hammersmith and city': '#F589A6',
  'waterloo and city': '#76D0BD',
} as const;

const HEX_BY_MODE_KEY = {
  bus: '#DC241F',
  coach: '#A0A5A9',
  cycle: '#007D32',
  dlr: '#00AFAD',
  overground: '#FA7B05',
  train: '#A0A5A9',
  tram: '#007D32',
  tube: '#0019A8',
  walking: '#E8E8EC',
  river: '#00AFAD',
  cablecar: '#FFC80A',
  'public-bus': '#DC241F',
  'elizabeth-line': '#60399E',
  'national-rail': '#A0A5A9',
  'london-overground': '#FA7B05',
} as const;

const NEUTRAL_HEX = '#A0A5A9';
const SUCCESS_HEX = '#007D32';
const WARNING_HEX = '#FFC80A';
const DANGER_HEX = '#DC241F';
const WHITE_HEX = '#E8E8EC';

type WrapTextOptions = {
  continuationIndent?: string;
  firstIndent?: string;
  width: number;
};

type TextStyler = {
  bold: (value: string) => string;
  danger: (value: string) => string;
  dim: (value: string) => string;
  line: (value: string, line: string) => string;
  mode: (value: string, mode: string) => string;
  neutral: (value: string) => string;
  rgb: (value: string, hex: string) => string;
  status: (value: string, status: string) => string;
  success: (value: string) => string;
  warning: (value: string) => string;
  white: (value: string) => string;
};

const normalizeKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replaceAll('&', ' and ')
    .replaceAll(/['’.,/()]/g, ' ')
    .replaceAll(/-/g, ' ')
    .replaceAll(/\s+/g, ' ');

const normalizeLineKey = (value: string): string => {
  const normalizedValue = normalizeKey(value).replace(/\s+line$/, '').trim();

  if (normalizedValue === 'elizabeth line') {
    return 'elizabeth';
  }

  if (normalizedValue === 'h and c' || normalizedValue === 'hammersmith city') {
    return 'hammersmith and city';
  }

  if (normalizedValue === 'waterloo city') {
    return 'waterloo and city';
  }

  if (normalizedValue === 'london overground') {
    return 'overground';
  }

  return normalizedValue;
};

const normalizeModeKey = (value: string): string => normalizeKey(value);

const getAnsiRgbCode = (hex: string): string => {
  const normalizedHex = hex.startsWith('#') ? hex.slice(1) : hex;
  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);

  return `\u001B[38;2;${red};${green};${blue}m`;
};

const applyCode = (value: string, code: string, enabled: boolean): string =>
  enabled ? `${code}${value}${ANSI_RESET}` : value;

export const stripAnsi = (value: string): string => value.replaceAll(ANSI_PATTERN, '');

export const visibleWidth = (value: string): number => Array.from(stripAnsi(value)).length;

export const padVisibleEnd = (value: string, width: number): string =>
  `${value}${' '.repeat(Math.max(0, width - visibleWidth(value)))}`;

export const padVisibleStart = (value: string, width: number): string =>
  `${' '.repeat(Math.max(0, width - visibleWidth(value)))}${value}`;

const chunkWord = (value: string, size: number): string[] => {
  if (value.length <= size) {
    return [value];
  }

  const characters = Array.from(value);

  return characters.reduce<string[]>((chunks, character) => {
    const currentChunk = chunks.at(-1) ?? '';

    if (visibleWidth(currentChunk) >= size) {
      return [...chunks, character];
    }

    return [...chunks.slice(0, -1), `${currentChunk}${character}`];
  }, ['']);
};

export const wrapText = (value: string, options: WrapTextOptions): string[] => {
  const firstIndent = options.firstIndent ?? '';
  const continuationIndent = options.continuationIndent ?? firstIndent;
  const width = Math.max(1, options.width);
  const paragraphs = value.split('\n');

  return paragraphs.flatMap((paragraph, paragraphIndex) => {
    const normalizedParagraph = paragraph.trim().replaceAll(/\s+/g, ' ');

    if (normalizedParagraph.length === 0) {
      return paragraphIndex === paragraphs.length - 1 ? [] : [''];
    }

    const words = normalizedParagraph.split(' ');
    const lines: string[] = [];
    let currentIndent = firstIndent;
    let currentWords: string[] = [];

    const flushLine = (): void => {
      lines.push(`${currentIndent}${currentWords.join(' ')}`.trimEnd());
      currentIndent = continuationIndent;
      currentWords = [];
    };

    words.forEach((word) => {
      const maxContentWidth = Math.max(1, width - visibleWidth(currentIndent));
      const wordChunks = visibleWidth(word) > maxContentWidth ? chunkWord(word, maxContentWidth) : [word];

      wordChunks.forEach((wordChunk) => {
        const nextContent = currentWords.length === 0 ? wordChunk : `${currentWords.join(' ')} ${wordChunk}`;

        if (visibleWidth(nextContent) <= maxContentWidth) {
          currentWords = currentWords.length === 0 ? [wordChunk] : [...currentWords, wordChunk];
          return;
        }

        if (currentWords.length > 0) {
          flushLine();
        }

        currentWords = [wordChunk];
      });
    });

    if (currentWords.length > 0) {
      flushLine();
    }

    if (paragraphIndex === paragraphs.length - 1) {
      return lines;
    }

    return [...lines, ''];
  });
};

export const joinAligned = (
  left: string,
  right: string,
  width: number,
  gap = 2,
): string => {
  const leftWidth = visibleWidth(left);
  const rightWidth = visibleWidth(right);
  const availableGap = width - leftWidth - rightWidth;

  if (availableGap >= gap) {
    return `${left}${' '.repeat(availableGap)}${right}`;
  }

  return `${left}${' '.repeat(gap)}${right}`;
};

export const getTerminalWidth = (): number => process.stdout.columns ?? 80;

export const resolveLineHex = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  const normalizedValue = normalizeLineKey(value);
  return HEX_BY_LINE_KEY[normalizedValue as keyof typeof HEX_BY_LINE_KEY];
};

export const resolveModeHex = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }

  const normalizedValue = normalizeModeKey(value);
  return HEX_BY_MODE_KEY[normalizedValue as keyof typeof HEX_BY_MODE_KEY];
};

export const resolveStatusHex = (value: string): string => {
  const normalizedValue = normalizeKey(value);

  if (normalizedValue === 'good service') {
    return SUCCESS_HEX;
  }

  if (normalizedValue === 'minor delays') {
    return WARNING_HEX;
  }

  if (
    normalizedValue === 'part closure' ||
    normalizedValue === 'part suspended' ||
    normalizedValue === 'severe delays' ||
    normalizedValue === 'suspended'
  ) {
    return DANGER_HEX;
  }

  if (normalizedValue === 'planned closure' || normalizedValue === 'reduced service') {
    return WARNING_HEX;
  }

  if (normalizedValue === 'service closed' || normalizedValue === 'special service') {
    return NEUTRAL_HEX;
  }

  if (normalizedValue.includes('delay') || normalizedValue.includes('closure')) {
    return WARNING_HEX;
  }

  if (normalizedValue.includes('suspend')) {
    return DANGER_HEX;
  }

  return NEUTRAL_HEX;
};

export const createTextStyler = (enabled: boolean): TextStyler => ({
  bold: (value) => applyCode(value, ANSI_BOLD, enabled),
  danger: (value) => applyCode(value, getAnsiRgbCode(DANGER_HEX), enabled),
  dim: (value) => applyCode(value, ANSI_DIM, enabled),
  line: (value, line) => {
    const resolvedHex = resolveLineHex(line);
    return resolvedHex ? applyCode(value, getAnsiRgbCode(resolvedHex), enabled) : value;
  },
  mode: (value, mode) => {
    const resolvedHex = resolveModeHex(mode);
    return resolvedHex ? applyCode(value, getAnsiRgbCode(resolvedHex), enabled) : value;
  },
  neutral: (value) => applyCode(value, getAnsiRgbCode(NEUTRAL_HEX), enabled),
  rgb: (value, hex) => applyCode(value, getAnsiRgbCode(hex), enabled),
  status: (value, status) => applyCode(value, getAnsiRgbCode(resolveStatusHex(status)), enabled),
  success: (value) => applyCode(value, getAnsiRgbCode(SUCCESS_HEX), enabled),
  warning: (value) => applyCode(value, getAnsiRgbCode(WARNING_HEX), enabled),
  white: (value) => applyCode(value, getAnsiRgbCode(WHITE_HEX), enabled),
});
