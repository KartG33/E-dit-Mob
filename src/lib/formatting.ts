/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SunoTag } from '../types';

export const COMMANDS = {
  // SPACES & PUNCTUATION
  DOUBLE_SPACES: { id: 'double_spaces', label: '×2 пробелы', fn: (t: string) => t.replace(/ {2,}/g, ' ') },
  NON_BREAKING: { id: 'non_breaking', label: 'Неразрывные', fn: (t: string) => t.replace(/\u00A0/g, ' ') },
  TRIM_LINES: { id: 'trim_lines', label: 'Обрезать края', fn: (t: string) => t.split('\n').map(l => l.trim()).join('\n') },
  SPACE_BEFORE: { id: 'space_before', label: 'Пробел до знака', fn: (t: string) => t.replace(/\s+([,.!?;:])/g, '$1') },
  SPACE_AFTER: { id: 'space_after', label: 'Пробел после знака', fn: (t: string) => t.replace(/([,.!?;:])(?=[^\s])/g, '$1 ') },
  REMOVE_PUNCTUATION: { id: 'remove_punctuation', label: 'Убрать пунктуацию', fn: (t: string) => t.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") },
  REMOVE_BRACKETS: { id: 'remove_brackets', label: 'Убрать ( ) [ ]', fn: (t: string) => t.replace(/\(.*?\)|\[.*?\]/g, "") },
  REMOVE_EMOJI: { id: 'remove_emoji', label: 'Убрать эмодзи', fn: (t: string) => t.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '') },

  // CASE
  UPPERCASE: { id: 'uppercase', label: 'АА ВЕРХНИЙ', fn: (t: string) => t.toUpperCase() },
  LOWERCASE: { id: 'lowercase', label: 'аа нижний', fn: (t: string) => t.toLowerCase() },
  TITLE_CASE: { id: 'title_case', label: 'Аа Каждое Слово', fn: (t: string) => t.replace(/\b\w/g, l => l.toUpperCase()) },
  SENTENCE_CASE: { id: 'sentence_case', label: 'Аа предложения', fn: (t: string) => t.replace(/(^\s*\w|[.!?]\s+\w)/g, l => l.toUpperCase()) },

  // LINES
  EXTRA_LINES: { id: 'extra_lines', label: 'Лишние строки', fn: (t: string) => t.replace(/\n{3,}/g, '\n\n') },
  ONE_LINE: { id: 'one_line', label: 'Одна строка', fn: (t: string) => t.replace(/\n+/g, ' ') },
  BY_SENTENCE: { id: 'by_sentence', label: 'По предложениям', fn: (t: string) => t.replace(/([.!?])\s+(?=[А-ЯA-Z])/g, "$1\n") },
  REMOVE_NUMBERING: { id: 'remove_numbering', label: 'Убрать нумерацию', fn: (t: string) => t.replace(/^\s*\d+[\.\)]\s*/gm, "") },
  ONLY_STRUCTURE: { id: 'only_structure', label: 'Only Structure', fn: (t: string) => stripSunoStyles(t) },
};

export const parseSunoTags = (text: string): SunoTag[] => {
  const regex = /\[([^\]]+)\]/g;
  const tags: SunoTag[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const content = match[1];
    const parts = content.split('|').map(p => p.trim());
    tags.push({
      full: match[0],
      structure: parts[0],
      styles: parts.slice(1).filter(Boolean),
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }
  return tags;
};

export const stripSunoStyles = (text: string): string => {
  return text.replace(/\[([^\]|]+)\|[^\]]+\]/g, '[$1]');
};

export const getStats = (text: string) => {
  const trimmed = text.trim();
  return {
    chars: text.length,
    words: trimmed ? trimmed.split(/\s+/).length : 0,
    sentences: trimmed ? trimmed.split(/[.!?]+/).filter(Boolean).length : 0,
    paragraphs: trimmed ? trimmed.split(/\n\s*\n/).filter(Boolean).length : 0,
  };
};

export const detectSpecialChars = (text: string): Record<string, number> => {
  const chars: Record<string, number> = {};
  const specialRegex = /[^a-zA-Z0-9\sа-яА-ЯёЁ\n]/g;
  let match;
  while ((match = specialRegex.exec(text)) !== null) {
    const char = match[0];
    chars[char] = (chars[char] || 0) + 1;
  }
  return chars;
};
