/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RegexItem {
  id: string;
  name: string;
  pattern: string;
  flags: string;
  replacement: string;
  isFavorite?: boolean;
}

export type PresetStepType = 'command' | 'regex' | 'symbol';

export interface PresetStep {
  id: string;
  type: PresetStepType;
  value: string; // command id, regex id, or string of symbols
}

export interface Preset {
  id: string;
  name: string;
  steps: PresetStep[];
  isFavorite?: boolean;
}

export interface Note {
  id: string;
  content: string;
  timestamp: number;
}

export interface HistoryState {
  text: string;
  cursorPos?: number;
}

export interface TextStats {
  chars: number;
  words: number;
  sentences: number;
  paragraphs: number;
}

export interface SunoTag {
  full: string;
  structure: string;
  styles: string[];
  startIndex: number;
  endIndex: number;
}
