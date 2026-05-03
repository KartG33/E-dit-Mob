/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  History, 
  Files, 
  Trash2, 
  Copy, 
  ClipboardPaste, 
  StickyNote, 
  Star, 
  Zap, 
  Settings2, 
  Search, 
  RotateCcw, 
  RotateCw, 
  X, 
  Plus, 
  ChevronRight, 
  ChevronLeft, 
  Download, 
  Upload, 
  MoreVertical,
  Type,
  Maximize2,
  Minimize2,
  Trash
} from 'lucide-react';
import { 
  RegexItem, 
  Preset, 
  Note, 
  HistoryState, 
  TextStats, 
  SunoTag 
} from './types';
import { 
  COMMANDS, 
  parseSunoTags, 
  stripSunoStyles, 
  getStats, 
  detectSpecialChars 
} from './lib/formatting';

// Constants
const STORAGE_KEYS = {
  PRESETS: 'edit_presets_v1',
  REGEX: 'edit_regex_v1',
  NOTES: 'edit_notes_v1',
  TEXT: 'edit_last_text_v1',
  FAV_COMMANDS: 'edit_fav_commands_v1'
};

const DEFAULT_STRUC_TAGS = [
  'intro', 'verse', 'chorus', 'outro', 'bridge', 'hook', 
  'pre-chorus', 'post-chorus', 'breakdown', 'interlude', 
  'drop', 'build', 'refrain', 'coda', 'fade', 'skit', 'spoken'
];

export default function App() {
  // --- Core State ---
  const [text, setText] = useState('');
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [diff, setDiff] = useState(0);
  const [activeTab, setActiveTab] = useState<'Star' | 'Suno' | 'Presets' | 'Commands'>('Suno');
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const [isEditTagsOpen, setIsEditTagsOpen] = useState(false);
  const [isPwaInstalled, setIsPwaInstalled] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // --- Data State ---
  const [presets, setPresets] = useState<Preset[]>([]);
  const [regexList, setRegexList] = useState<RegexItem[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [favoriteCommands, setFavoriteCommands] = useState<string[]>([]);
  
  // --- Symbol Bar State ---
  const [symbolMode, setSymbolMode] = useState<'Detect' | 'Replace'>('Detect');
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set());

  // --- Inline Forms State ---
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [newPresetBuilder, setNewPresetBuilder] = useState<{name: string, steps: {id: string, type: string, value: string}[]}>({ name: '', steps: [] });
  const [newSymbolInput, setNewSymbolInput] = useState('');
  
  const [showRegexForm, setShowRegexForm] = useState(false);
  const [newRegex, setNewRegex] = useState({ name: '', pattern: '', replacement: '' });
  
  const [presetForNewStep, setPresetForNewStep] = useState<string | null>(null);
  const [newStep, setNewStep] = useState({ type: 'command', value: '' });

  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // --- Initialization ---
  useEffect(() => {
    const savedPresets = localStorage.getItem(STORAGE_KEYS.PRESETS);
    const savedRegex = localStorage.getItem(STORAGE_KEYS.REGEX);
    const savedNotes = localStorage.getItem(STORAGE_KEYS.NOTES);
    const savedText = localStorage.getItem(STORAGE_KEYS.TEXT);
    const savedFavCmds = localStorage.getItem(STORAGE_KEYS.FAV_COMMANDS);

    if (savedPresets) setPresets(JSON.parse(savedPresets));
    if (savedRegex) setRegexList(JSON.parse(savedRegex));
    if (savedNotes) setNotes(JSON.parse(savedNotes));
    if (savedFavCmds) setFavoriteCommands(JSON.parse(savedFavCmds));
    if (savedText) {
      setText(savedText);
      addToHistory(savedText);
    }

    // PWA Check
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsPwaInstalled(false);
    });

    window.addEventListener('appinstalled', () => {
      setIsPwaInstalled(true);
      setDeferredPrompt(null);
    });
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setIsPwaInstalled(true);
      setDeferredPrompt(null);
    }
  };

  // --- Helpers ---
  const addToHistory = (newText: string) => {
    const newState = { text: newText };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const updateText = (newText: string) => {
    setDiff(newText.length - text.length);
    setText(newText);
    addToHistory(newText);
    localStorage.setItem(STORAGE_KEYS.TEXT, newText);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setText(prev.text);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setText(next.text);
      setHistoryIndex(historyIndex + 1);
    }
  };

  const stats = useMemo(() => getStats(text), [text]);
  const detectedChars = useMemo(() => detectSpecialChars(text), [text]);
  const sunoTags = useMemo(() => parseSunoTags(text), [text]);

  const applyCommand = (id: string) => {
    const cmd = Object.values(COMMANDS).find(c => c.id === id);
    if (cmd) {
      updateText(cmd.fn(text));
    }
  };

  const applyRegex = (regex: RegexItem) => {
    try {
      const r = new RegExp(regex.pattern, regex.flags || 'g');
      updateText(text.replace(r, regex.replacement));
    } catch (e) {
      console.error('Invalid regex', e);
    }
  };

  const applyPreset = (preset: Preset) => {
    let currentText = text;
    preset.steps.forEach(step => {
      if (step.type === 'command') {
        const cmd = Object.values(COMMANDS).find(c => c.id === step.value);
        if (cmd) currentText = cmd.fn(currentText);
      } else if (step.type === 'regex') {
        const reg = regexList.find(r => r.id === step.value);
        if (reg) {
          try {
            const r = new RegExp(reg.pattern, reg.flags || 'g');
            currentText = currentText.replace(r, reg.replacement);
          } catch {}
        }
      } else if (step.type === 'symbol') {
        currentText = currentText.split(step.value).join('');
      }
    });
    updateText(currentText);
  };

  const clearText = () => {
    if (confirm('Очистить весь текст?')) {
      updateText('');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(text);
  };

  const pasteFromClipboard = async () => {
    const content = await navigator.clipboard.readText();
    updateText(text + content);
  };

  // --- Components ---

  const Pill = ({ label, value, colorClass }: { label: string, value: number, colorClass?: string }) => (
    <div className="bg-[#222] px-2.5 py-1 rounded-full text-[10px] font-medium flex items-center gap-1.5 border border-[#333]">
      <span className={`w-1.5 h-1.5 rounded-full ${colorClass || 'bg-blue-500'}`}></span>
      <span className="text-[10px] font-mono font-medium text-[#e0e0e0]">{value}</span>
      <span className="opacity-40 uppercase tracking-widest">{label}</span>
    </div>
  );

  return (
    <div className="h-screen w-full bg-[#0a0a0a] text-[#e0e0e0] flex flex-col font-sans select-none overflow-hidden">
      
      {/* HEADER */}
      <header className="p-4 flex flex-col gap-3 sticky top-0 bg-[#111] z-40 border-b border-[#222] shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2 shrink-0">
            <Pill label="СИМВ" value={stats.chars} colorClass="bg-blue-500" />
            <Pill label="СЛОВА" value={stats.words} colorClass="bg-emerald-500" />
            <Pill label="ПРЕДЛ" value={stats.sentences} colorClass="bg-orange-500" />
            <Pill label="АБЗАЦ" value={stats.paragraphs} colorClass="bg-purple-500" />
          </div>
          
          <div className="flex items-center gap-3 shrink-0 ml-auto">
            <button 
              onClick={() => setIsPresetsOpen(true)}
              className="px-3 py-1.5 bg-[#222] border border-[#333] rounded-lg text-xs font-semibold hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-200 transition-colors flex items-center gap-1.5"
            >
              <Settings2 size={14} /> Настройки
            </button>
            {!isPwaInstalled && (
              <button 
                onClick={handleInstall}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-bold text-white shadow-lg shadow-indigo-900/20 transition-all"
              >
                Install
              </button>
            )}
          </div>
        </div>

        {fileName && (
          <div className="flex items-center gap-2 bg-[#222] border border-[#333] px-3 py-2 rounded-lg mt-1">
            <Files size={14} className="text-blue-400" />
            <span className="text-xs text-[#bbb] truncate flex-1">{fileName}</span>
            <button onClick={() => setFileName(null)} className="p-1 hover:bg-[#2a2a2a] rounded">
              <X size={14} className="text-[#bbb]" />
            </button>
          </div>
        )}
      </header>

      <div className="p-3 flex flex-col gap-3 shrink-0 bg-[#0d0d0d]">
        {/* TABS */}
        <nav className="flex gap-1 bg-[#1a1a1a] p-1 rounded-xl w-fit">
          {(['Star', 'Suno', 'Presets', 'Commands'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-xs transition-all border ${
                activeTab === tab 
                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 font-bold shadow-sm' 
                  : 'border-transparent font-medium opacity-40 hover:opacity-100 text-[#e0e0e0] hover:bg-[#222]'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>

        {/* ACTION PANELS */}
        <div className="min-h-[44px] flex items-center">
          <AnimatePresence mode="wait">
            {activeTab === 'Suno' && (
              <motion.div 
                key="suno"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex flex-wrap gap-2"
              >
                <button 
                  onClick={() => updateText(stripSunoStyles(text))}
                  className="px-3 py-2 bg-indigo-900/30 border border-indigo-500/30 text-indigo-300 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors hover:bg-indigo-900/50 hover:border-indigo-500/50"
                >
                  Only Structure
                </button>
                <button 
                  onClick={() => setIsEditTagsOpen(true)}
                  className="px-3 py-2 bg-[#222] border border-[#333] rounded-lg text-[11px] font-medium hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-200 transition-colors text-[#e0e0e0]"
                >
                  Edit Tags ({sunoTags.length})
                </button>
              </motion.div>
            )}

          {activeTab === 'Commands' && (
            <motion.div 
              key="commands"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4 overflow-x-auto no-scrollbar pb-2"
            >
              <div className="flex flex-col gap-2">
                <span className="text-[9px] text-zinc-500 uppercase font-mono tracking-tighter">Символы</span>
                <div className="flex gap-2">
                  {[COMMANDS.DOUBLE_SPACES, COMMANDS.NON_BREAKING, COMMANDS.TRIM_LINES, COMMANDS.SPACE_BEFORE, COMMANDS.SPACE_AFTER, COMMANDS.REMOVE_PUNCTUATION, COMMANDS.REMOVE_BRACKETS].map(cmd => (
                    <button key={cmd.id} onClick={() => applyCommand(cmd.id)} className="whitespace-nowrap px-3 py-2 bg-[#222] border border-[#333] hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-200 rounded-lg text-[11px] font-medium transition-colors text-[#e0e0e0]">{cmd.label}</button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[9px] text-zinc-500 uppercase font-mono tracking-tighter">Строки</span>
                <div className="flex gap-2">
                  {[COMMANDS.EXTRA_LINES, COMMANDS.ONE_LINE, COMMANDS.BY_SENTENCE, COMMANDS.REMOVE_NUMBERING].map(cmd => (
                    <button key={cmd.id} onClick={() => applyCommand(cmd.id)} className="whitespace-nowrap px-3 py-2 bg-[#222] border border-[#333] hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-200 rounded-lg text-[11px] font-medium transition-colors text-[#e0e0e0]">{cmd.label}</button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[9px] text-zinc-500 uppercase font-mono tracking-tighter">Регистр</span>
                <div className="flex gap-2">
                  {[COMMANDS.UPPERCASE, COMMANDS.LOWERCASE, COMMANDS.TITLE_CASE, COMMANDS.SENTENCE_CASE].map(cmd => (
                    <button key={cmd.id} onClick={() => applyCommand(cmd.id)} className="whitespace-nowrap px-3 py-2 bg-[#222] border border-[#333] hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-200 rounded-lg text-[11px] font-medium transition-colors text-[#e0e0e0]">{cmd.label}</button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'Presets' && (
             <motion.div 
             key="presets"
             initial={{ opacity: 0, y: 5 }}
             animate={{ opacity: 1, y: 0 }}
             className="flex gap-2 overflow-x-auto no-scrollbar"
           >
             {presets.length === 0 ? (
               <div className="w-full flex items-center justify-center py-4 bg-[#111] rounded-xl border border-dashed border-[#333]">
                  <span className="text-[10px] text-zinc-500">Нет сохраненных пресетов</span>
               </div>
             ) : (
               presets.map(p => (
                 <button key={p.id} onClick={() => applyPreset(p)} className="whitespace-nowrap px-4 py-2 bg-[#222] hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-200 rounded-lg text-[11px] font-bold border border-[#333] flex items-center gap-2 transition-colors">
                   <Zap size={12} className="text-indigo-400" /> {p.name}
                 </button>
               ))
             )}
           </motion.div>
          )}

          {activeTab === 'Star' && (() => {
            const favCommandsList = Object.values(COMMANDS).filter(c => favoriteCommands.includes(c.id));
            const favItemsList = [...presets, ...regexList].filter(i => i.isFavorite);
            const hasFavs = favCommandsList.length > 0 || favItemsList.length > 0;
            return (
              <motion.div 
                key="star"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2 overflow-x-auto no-scrollbar min-h-[44px] items-center"
              >
                {!hasFavs ? (
                  <div className="w-full flex items-center py-4">
                    <span className="text-[10px] text-zinc-500">Отметьте элементы звездочкой в настройках</span>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {favCommandsList.map(cmd => (
                      <button 
                        key={cmd.id} 
                        onClick={() => applyCommand(cmd.id)}
                        className="whitespace-nowrap px-4 py-2 bg-[#222] hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-200 rounded-lg text-[11px] font-bold border border-[#333] flex items-center gap-2 transition-colors"
                      >
                        <Star size={12} className="fill-indigo-400 text-indigo-400" /> {cmd.label}
                      </button>
                    ))}
                    {favItemsList.map(item => (
                      <button 
                        key={item.id} 
                        onClick={() => 'steps' in item ? applyPreset(item) : applyRegex(item)}
                        className="whitespace-nowrap px-4 py-2 bg-[#222] hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-200 rounded-lg text-[11px] font-bold border border-[#333] flex items-center gap-2 transition-colors"
                      >
                        <Star size={12} className="fill-yellow-500 text-yellow-500" /> {item.name}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })()}
        </AnimatePresence>
        </div>
      </div>

      {/* SYMBOL BAR */}
      <div className="px-4 pb-3 bg-[#0d0d0d]">
        <div className="bg-[#111] rounded-xl border border-[#222] p-2 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex p-0.5 bg-[#222] rounded-lg w-fit">
              <button 
                onClick={() => setSymbolMode('Detect')}
                className={`text-[10px] font-bold uppercase tracking-tighter px-3 py-1 rounded-md transition-colors border ${symbolMode === 'Detect' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 shadow-sm' : 'border-transparent text-zinc-500 opacity-40 hover:opacity-100 hover:bg-[#222]'}`}
              >
                Detect
              </button>
              <button 
                onClick={() => setSymbolMode('Replace')}
                className={`text-[10px] font-bold uppercase tracking-tighter px-3 py-1 rounded-md transition-colors border ${symbolMode === 'Replace' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 shadow-sm' : 'border-transparent text-zinc-500 opacity-40 hover:opacity-100 hover:bg-[#222]'}`}
              >
                Replace
              </button>
            </div>
          {symbolMode === 'Detect' && Object.keys(detectedChars).length > 0 && (
            <button 
              onClick={() => {
                let nextText = text;
                selectedSymbols.forEach(s => {
                  nextText = nextText.split(s).join('');
                });
                updateText(nextText);
                setSelectedSymbols(new Set());
              }}
              className="text-[10px] font-bold text-red-500 uppercase flex items-center gap-1 hover:text-red-400"
            >
              <Trash2 size={12} /> УДАЛИТЬ ({selectedSymbols.size})
            </button>
          )}
          </div>

          {symbolMode === 'Detect' ? (
            <div className="flex gap-2 overflow-x-auto no-scrollbar min-h-[30px] items-center">
              {Object.keys(detectedChars).length === 0 ? (
                <span className="text-[10px] text-zinc-600 font-mono">Спецсимволы не найдены</span>
              ) : (
                Object.entries(detectedChars).map(([char, count]) => (
                  <button
                    key={char}
                    onClick={() => {
                      const next = new Set(selectedSymbols);
                      if (next.has(char)) next.delete(char);
                      else next.add(char);
                      setSelectedSymbols(next);
                    }}
                    className={`px-2 py-1 rounded border flex items-center gap-2 transition-all shrink-0 ${
                      selectedSymbols.has(char) 
                        ? 'bg-red-500/20 border-red-500/50 text-red-200' 
                        : 'bg-[#222] border-[#333] text-[#bbb] hover:bg-[#2a2a2a]'
                    }`}
                  >
                    <span className="text-[11px] font-mono">{char}</span>
                    <span className="text-[8px] opacity-60 bg-black/30 px-1 rounded font-mono">{count}</span>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="flex gap-2 items-center">
              <input 
                value={findText}
                onChange={e => setFindText(e.target.value)}
                placeholder="Find..."
                className="bg-[#222] border border-[#333] rounded px-2 py-1 text-xs text-[#e0e0e0] w-full outline-none focus:border-[#444]"
              />
              <ChevronRight size={14} className="text-zinc-600 shrink-0" />
              <input 
                value={replaceText}
                onChange={e => setReplaceText(e.target.value)}
                placeholder="Replace..."
                className="bg-[#222] border border-[#333] rounded px-2 py-1 text-xs text-[#e0e0e0] w-full outline-none focus:border-[#444]"
              />
              <button 
                onClick={() => updateText(text.split(findText).join(replaceText))}
                className="bg-[#333] text-[#e0e0e0] p-1 rounded hover:bg-[#444] border border-[#444]"
              >
                <Search size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* EDITOR */}
      <main className="flex-1 relative px-4 overflow-hidden flex flex-col pt-3">
        <div className="absolute top-8 right-8 z-10 w-fit">
          <AnimatePresence>
            {diff !== 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`text-[10px] font-mono font-bold px-2 py-1 rounded-full border shadow-xl ${
                  diff > 0 ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400' : 'bg-red-500/10 border-red-500/40 text-red-500'
                }`}
              >
                DIFF: {diff > 0 ? '+' : ''}{diff}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="w-full h-full bg-[#111] border border-[#222] rounded-t-2xl p-6 font-mono text-sm leading-[2.2] tracking-[0.02em] text-[#bbb] whitespace-pre-wrap flex flex-col overflow-hidden">
          <textarea
            ref={textAreaRef}
            value={text}
            onChange={(e) => updateText(e.target.value)}
            placeholder="Type or paste your lyrics here..."
            spellCheck={false}
            className="w-full h-full bg-transparent outline-none resize-none placeholder:text-[#555] placeholder:font-sans"
          />
        </div>
      </main>

      {/* BOTTOM NAV */}
      <footer className="p-4 bg-[#111] border-t border-[#222] flex justify-between items-center shrink-0 pb-safe">
        <div className="flex gap-4">
          <button onClick={undo} disabled={historyIndex <= 0} className="flex flex-col items-center gap-1 opacity-60 disabled:opacity-20 hover:opacity-100 transition-opacity">
            <div className="w-6 h-6 border border-white/20 flex items-center justify-center rounded"><RotateCcw size={12} /></div>
            <span className="text-[9px] uppercase tracking-widest font-bold">Undo</span>
          </button>
          <button onClick={redo} disabled={historyIndex >= history.length - 1} className="flex flex-col items-center gap-1 opacity-60 disabled:opacity-20 hover:opacity-100 transition-opacity">
            <div className="w-6 h-6 border border-white/20 flex items-center justify-center rounded"><RotateCw size={12} /></div>
            <span className="text-[9px] uppercase tracking-widest font-bold">Redo</span>
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={pasteFromClipboard} className="px-5 py-2.5 bg-[#222] border border-[#333] hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors hidden sm:block">Paste</button>
          <button onClick={copyToClipboard} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-indigo-900/20 transition-all text-white">Copy</button>
          <button onClick={clearText} className="px-5 py-2.5 bg-red-900/20 hover:bg-red-900/40 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors">Clear</button>
        </div>
        <button onClick={() => setIsNotesOpen(true)} className="flex flex-col items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors group">
          <div className="w-6 h-6 border border-indigo-500/40 flex items-center justify-center rounded bg-indigo-500/10 group-hover:bg-indigo-500/20 group-hover:border-indigo-400 transition-all"><StickyNote size={12} /></div>
          <span className="text-[9px] uppercase tracking-widest font-bold">Notes</span>
        </button>
      </footer>

      {/* MODALS / SHEETS */}
      {/* (Simplified for implementation - typically separated into components) */}
      <AnimatePresence>
        {isEditTagsOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-[#111] rounded-t-3xl border-t border-[#222] p-6 h-[80vh] flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Type className="text-blue-500" /> Edit Suno Tags
                </h3>
                <button onClick={() => setIsEditTagsOpen(false)} className="p-2 bg-[#222] hover:bg-[#2a2a2a] rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
                {sunoTags.length === 0 ? (
                  <div className="text-center py-12 text-zinc-600 text-sm italic">
                    Теги Suno не найдены в тексте
                  </div>
                ) : (
                  sunoTags.map((tag, idx) => {
                    const isDuplicate = sunoTags.some((t, i) => i !== idx && t.structure === tag.structure);
                    return (
                      <div key={idx} className="bg-[#0a0a0a] p-4 rounded-2xl border border-[#222] space-y-3 shadow-inner">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-blue-400 font-bold font-mono">[{tag.structure}]</span>
                            {isDuplicate && <span className="bg-blue-500/20 text-blue-400 text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tighter">×REPEAT</span>}
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                // Logic to strip styles for THIS tag structure globally
                                const r = new RegExp(`\\[${tag.structure}\\s*\\|.*?\\]`, 'g');
                                updateText(text.replace(r, `[${tag.structure}]`));
                              }}
                              className="text-[10px] bg-[#222] border border-[#333] hover:bg-[#2a2a2a] px-3 py-1 rounded-lg text-[#bbb] font-medium transition-colors"
                            >
                              STRIP
                            </button>
                            <button 
                              onClick={() => {
                                // Logic to remove this specific tag type globally
                                const r = new RegExp(`\\[${tag.structure}.*?\\]\n?`, 'g');
                                updateText(text.replace(r, ''));
                              }}
                              className="p-1.5 bg-[#222] border border-[#333] hover:bg-[#2a2a2a] rounded-lg text-red-500 transition-colors"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {tag.styles.map((style, sIdx) => (
                            <div key={sIdx} className="bg-[#222] border border-[#333] px-2.5 py-1 rounded-full flex items-center gap-2 group shadow-sm">
                              <input 
                                className="text-xs text-[#e0e0e0] bg-transparent outline-none w-auto min-w-[30px]"
                                defaultValue={style}
                                onBlur={(e) => {
                                  if (e.target.value !== style) {
                                    const newStyles = [...tag.styles];
                                    newStyles[sIdx] = e.target.value;
                                    const newTag = `[${tag.structure}${newStyles.length ? ' | ' + newStyles.join(' | ') : ''}]`;
                                    updateText(text.split(tag.full).join(newTag));
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                }}
                              />
                              <button 
                                onClick={() => {
                                  const newStyles = [...tag.styles];
                                  newStyles.splice(sIdx, 1);
                                  const newTag = `[${tag.structure}${newStyles.length ? ' | ' + newStyles.join(' | ') : ''}]`;
                                  // Update ALL instances of this exact tag to maintain live feel for repeats if desired
                                  // but usually users want to edit just this one. 
                                  // The requirement says "Повторяющиеся теги обновляются все сразу"
                                  updateText(text.split(tag.full).join(newTag));
                                }}
                                className="p-0.5 hover:bg-zinc-800 rounded text-zinc-500"
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                          <button 
                            onClick={() => {
                              const style = prompt('Add style tag:');
                              if (style) {
                                const newTag = `[${tag.structure} | ${[...tag.styles, style].join(' | ')}]`;
                                updateText(text.split(tag.full).join(newTag));
                              }
                            }}
                            className="bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-1 rounded-full text-xs font-bold"
                          >
                            + ADD
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}

        {isPresetsOpen && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm">
             <motion.div 
               initial={{ y: '100%' }}
               animate={{ y: 0 }}
               exit={{ y: '100%' }}
               className="bg-[#111] rounded-t-3xl border-t border-[#222] p-6 h-[90vh] flex flex-col shadow-2xl"
             >
               <div className="flex items-center justify-between mb-6">
                 <h3 className="text-lg font-bold flex items-center gap-2 text-[#e0e0e0]">
                    <Settings2 className="text-indigo-500" /> Настройки
                 </h3>
                 <button onClick={() => setIsPresetsOpen(false)} className="p-2 bg-[#222] hover:bg-[#2a2a2a] rounded-full transition-colors">
                    <X size={20} />
                 </button>
               </div>

               <div className="flex-1 overflow-y-auto no-scrollbar space-y-8">
                  {/* COMMANDS SECTION */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500">Системные команды</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.values(COMMANDS).map(cmd => {
                        const isFav = favoriteCommands.includes(cmd.id);
                        return (
                          <button 
                            key={cmd.id}
                            onClick={() => {
                              const newFavs = isFav ? favoriteCommands.filter(id => id !== cmd.id) : [...favoriteCommands, cmd.id];
                              setFavoriteCommands(newFavs);
                              localStorage.setItem(STORAGE_KEYS.FAV_COMMANDS, JSON.stringify(newFavs));
                            }}
                            className={`px-3 py-2 rounded-lg text-[11px] font-medium border flex items-center gap-2 transition-colors ${
                              isFav ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' : 'bg-[#222] border-[#333] text-[#bbb] hover:bg-[#2a2a2a]'
                            }`}
                          >
                            <Star size={12} className={isFav ? 'fill-indigo-400' : ''} /> {cmd.label}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* REGEX SECTION */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500">Custom Regex</h4>
                      <button 
                        onClick={() => setShowRegexForm(!showRegexForm)}
                        className={`p-1 rounded transition-colors ${showRegexForm ? 'bg-red-500/10 text-red-500' : 'text-indigo-400 hover:bg-indigo-500/10'}`}
                      >
                        {showRegexForm ? <X size={18} /> : <Plus size={18} />}
                      </button>
                    </div>
                    
                    <AnimatePresence>
                      {showRegexForm && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mb-4"
                        >
                          <div className="p-3 bg-[#111] border border-[#222] rounded-xl flex flex-col gap-2">
                            <input 
                              type="text" 
                              placeholder="Название (напр., Удалить теги)" 
                              className="bg-[#222] border border-[#333] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-indigo-500/50"
                              value={newRegex.name}
                              onChange={(e) => setNewRegex({...newRegex, name: e.target.value})}
                            />
                            <input 
                              type="text" 
                              placeholder="Паттерн (напр., \\[.*?\\])" 
                              className="bg-[#222] border border-[#333] rounded px-2 py-1.5 text-xs font-mono text-white outline-none focus:border-indigo-500/50"
                              value={newRegex.pattern}
                              onChange={(e) => setNewRegex({...newRegex, pattern: e.target.value})}
                            />
                            <input 
                              type="text" 
                              placeholder="Замена (оставьте пустым для удаления)" 
                              className="bg-[#222] border border-[#333] rounded px-2 py-1.5 text-xs font-mono text-white outline-none focus:border-indigo-500/50"
                              value={newRegex.replacement}
                              onChange={(e) => setNewRegex({...newRegex, replacement: e.target.value})}
                            />
                            <button
                              onClick={() => {
                                if (newRegex.name.trim() && newRegex.pattern.trim()) {
                                  const newList = [...regexList, { id: Date.now().toString(), name: newRegex.name.trim(), pattern: newRegex.pattern, replacement: newRegex.replacement, flags: 'g' }];
                                  setRegexList(newList);
                                  localStorage.setItem(STORAGE_KEYS.REGEX, JSON.stringify(newList));
                                  setNewRegex({ name: '', pattern: '', replacement: '' });
                                  setShowRegexForm(false);
                                }
                              }}
                              disabled={!newRegex.name.trim() || !newRegex.pattern.trim()}
                              className="mt-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-[#333] text-white text-xs font-bold rounded flex items-center justify-center gap-2 transition-colors"
                            >
                              <Plus size={14} /> Добавить
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="space-y-2">
                       {regexList.map(r => (
                         <div key={r.id} className="bg-[#0a0a0a] p-3 rounded-xl border border-[#222] flex items-center justify-between shadow-sm">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-[#e0e0e0]">{r.name}</span>
                              <span className="text-[10px] font-mono text-[#bbb]">/{r.pattern}/{r.flags}</span>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  const newList = regexList.map(item => item.id === r.id ? { ...item, isFavorite: !item.isFavorite } : item);
                                  setRegexList(newList);
                                  localStorage.setItem(STORAGE_KEYS.REGEX, JSON.stringify(newList));
                                }}
                                className={`p-2 border rounded-lg transition-colors ${r.isFavorite ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-500' : 'bg-[#222] border-[#333] hover:bg-[#2a2a2a] text-[#bbb]'}`}
                              >
                                <Star size={14} className={r.isFavorite ? 'fill-yellow-500' : ''} />
                              </button>
                              <button onClick={() => applyRegex(r)} className="p-2 bg-[#222] hover:bg-[#2a2a2a] border border-[#333] rounded-lg text-[#bbb] transition-colors"><Zap size={14} /></button>
                              <button 
                                onClick={() => {
                                  const filtered = regexList.filter(item => item.id !== r.id);
                                  setRegexList(filtered);
                                  localStorage.setItem(STORAGE_KEYS.REGEX, JSON.stringify(filtered));
                                }}
                                className="p-2 bg-[#222] hover:bg-red-900/40 border border-[#333] rounded-lg text-red-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                         </div>
                       ))}
                    </div>
                  </section>

                  {/* PRESETS SECTION */}
                  <section>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500">Presets</h4>
                      <button 
                         onClick={() => setShowPresetForm(!showPresetForm)}
                         className={`p-1 rounded transition-colors ${showPresetForm ? 'bg-red-500/10 text-red-500' : 'text-orange-500 hover:bg-orange-500/10'}`}
                      >
                         {showPresetForm ? <X size={18} /> : <Plus size={18} />}
                      </button>
                    </div>

                    <AnimatePresence>
                      {showPresetForm && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden mb-4"
                        >
                          <div className="p-4 bg-[#111] border border-[#222] rounded-xl flex flex-col gap-4">
                            <input 
                              type="text" 
                              placeholder="Название пресета" 
                              className="bg-[#222] border border-[#333] rounded px-3 py-2 text-sm text-white outline-none focus:border-orange-500/50"
                              value={newPresetBuilder.name}
                              onChange={(e) => setNewPresetBuilder({...newPresetBuilder, name: e.target.value})}
                            />
                            
                            <div>
                              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Сборка пресета ({newPresetBuilder.steps.length} шагов)</span>
                              <div className="flex flex-wrap gap-1 mt-2 min-h-[36px] p-2 bg-[#0a0a0a] rounded-lg border border-[#222]">
                                {newPresetBuilder.steps.length === 0 ? <span className="text-[10px] text-zinc-600 m-auto">Выберите шаги ниже</span> : newPresetBuilder.steps.map((step, idx) => (
                                  <div key={idx} className="flex items-center gap-1 bg-[#333] px-2 py-1 rounded text-[10px] text-white">
                                    <span className="truncate max-w-[150px]">{step.type === 'command' ? Object.values(COMMANDS).find(c => c.id === step.value)?.label || step.value : 
                                           step.type === 'regex' ? regexList.find(r => r.id === step.value)?.name || step.value : 
                                           `Удалить: ${step.value}`}</span>
                                    <button onClick={() => {
                                      const s = [...newPresetBuilder.steps];
                                      s.splice(idx, 1);
                                      setNewPresetBuilder({...newPresetBuilder, steps: s})
                                    }} className="text-zinc-500 hover:text-red-400"><X size={10}/></button>
                                  </div>
                                ))}
                              </div>
                            </div>
                        
                            <div className="flex flex-col gap-3">
                              <div>
                                <span className="text-[10px] font-bold text-zinc-500 uppercase">Команды</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {Object.values(COMMANDS).map(cmd => (
                                    <button key={cmd.id} onClick={() => setNewPresetBuilder({...newPresetBuilder, steps: [...newPresetBuilder.steps, {id: Date.now().toString() + Math.random(), type:'command', value: cmd.id}]})} className="px-2 py-1 bg-[#222] hover:bg-[#333] border border-[#333] rounded text-[10px] text-[#bbb] transition-colors">
                                      +{cmd.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              {regexList.length > 0 && (
                                <div>
                                  <span className="text-[10px] font-bold text-zinc-500 uppercase">Мои регулярки</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {regexList.map(r => (
                                      <button key={r.id} onClick={() => setNewPresetBuilder({...newPresetBuilder, steps: [...newPresetBuilder.steps, {id: Date.now().toString() + Math.random(), type:'regex', value: r.id}]})} className="px-2 py-1 bg-[#222] hover:bg-[#333] border border-[#333] rounded text-[10px] text-[#bbb] transition-colors">
                                        +{r.name}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div>
                                <span className="text-[10px] font-bold text-zinc-500 uppercase">Удалить строку/символ</span>
                                <div className="flex flex-wrap gap-1 mt-1 mb-2">
                                  {['######', '#####', '####', '###', '##', '#', '***', '**', '*', '_____', '__', '_', '---', '~~', '+', '1.', '>', '-', '```', '`', '[', ']', '(', ')', '!', '|', ':', '\\'].map(sym => (
                                    <button 
                                      key={sym} 
                                      onClick={() => {
                                        setNewPresetBuilder({...newPresetBuilder, steps: [...newPresetBuilder.steps, {id: Date.now().toString() + Math.random(), type:'symbol', value: sym}]});
                                      }}
                                      className="px-2 py-1 bg-[#222] hover:bg-[#333] border border-[#333] rounded text-[10px] text-[#bbb] font-mono transition-colors"
                                    >
                                      {sym}
                                    </button>
                                  ))}
                                </div>
                                <div className="flex gap-1 mt-1 items-center">
                                  <input 
                                    type="text" 
                                    className="bg-[#222] border border-[#333] rounded px-2 py-1.5 text-xs text-white outline-none flex-1 focus:border-orange-500/50" 
                                    placeholder="Свой символ/строка..." 
                                    value={newSymbolInput}
                                    onChange={(e) => setNewSymbolInput(e.target.value)}
                                  />
                                  <button onClick={() => {
                                    if (newSymbolInput) {
                                      setNewPresetBuilder({...newPresetBuilder, steps: [...newPresetBuilder.steps, {id: Date.now().toString() + Math.random(), type:'symbol', value: newSymbolInput}]});
                                      setNewSymbolInput('');
                                    }
                                  }} className="px-3 py-1.5 bg-[#222] hover:bg-[#333] border border-[#333] rounded text-xs font-bold text-zinc-300">
                                    Добавить
                                  </button>
                                </div>
                              </div>
                            </div>
                        
                            <button
                              onClick={() => {
                                if (newPresetBuilder.name.trim() && newPresetBuilder.steps.length > 0) {
                                  const newPresetsList = [...presets, { id: Date.now().toString(), name: newPresetBuilder.name.trim(), steps: newPresetBuilder.steps as any, isFavorite: false }];
                                  setPresets(newPresetsList);
                                  localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(newPresetsList));
                                  setNewPresetBuilder({ name: '', steps: [] });
                                  setShowPresetForm(false);
                                }
                              }}
                              disabled={!newPresetBuilder.name.trim() || newPresetBuilder.steps.length === 0}
                              className="mt-2 py-2.5 w-full bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:bg-[#333] text-white text-xs font-bold rounded-lg transition-colors"
                            >
                              Сохранить пресет
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="space-y-4">
                       {presets.map(p => (
                         <div key={p.id} className="bg-[#0a0a0a] p-4 rounded-2xl border border-[#222] shadow-sm">
                             <div className="flex items-center justify-between mb-3">
                               <span className="text-sm font-bold text-[#e0e0e0]">{p.name}</span>
                               <div className="flex gap-2">
                                  <button 
                                    onClick={() => {
                                      const newList = presets.map(item => item.id === p.id ? { ...item, isFavorite: !item.isFavorite } : item);
                                      setPresets(newList);
                                      localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(newList));
                                    }}
                                    className={`p-2 border rounded-lg transition-colors ${p.isFavorite ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-500' : 'bg-[#222] border-[#333] hover:bg-[#2a2a2a] text-[#bbb]'}`}
                                  >
                                    <Star size={14} className={p.isFavorite ? 'fill-yellow-500' : ''} />
                                  </button>
                                  <button onClick={() => applyPreset(p)} className="p-2 bg-[#222] hover:bg-[#2a2a2a] border border-[#333] rounded-lg text-orange-500 transition-colors"><Zap size={14}/></button>
                                  <button 
                                     onClick={() => {
                                       const filtered = presets.filter(item => item.id !== p.id);
                                       setPresets(filtered);
                                       localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(filtered));
                                     }}
                                     className="p-2 bg-[#222] hover:bg-red-900/40 border border-[#333] rounded-lg text-red-500 transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                               </div>
                             </div>
                             <div className="flex flex-wrap gap-2">
                               {p.steps.map(s => (
                                 <div key={s.id} className="bg-[#222] px-2 py-1 rounded text-[10px] text-[#bbb] border border-[#333]">
                                   {s.value}
                                 </div>
                               ))}
                               <button 
                                 onClick={() => setPresetForNewStep(presetForNewStep === p.id ? null : p.id)}
                                 className={`px-2 py-1 rounded border transition-colors text-[10px] ${presetForNewStep === p.id ? 'border-red-500/50 text-red-500' : 'border-dashed border-[#444] text-[#aaa] hover:text-[#fff] hover:border-[#666]'}`}
                               >
                                 {presetForNewStep === p.id ? 'ОТМЕНА' : '+ ШАГ'}
                               </button>
                             </div>
                             
                             <AnimatePresence>
                               {presetForNewStep === p.id && (
                                 <motion.div
                                   initial={{ opacity: 0, height: 0 }}
                                   animate={{ opacity: 1, height: 'auto' }}
                                   exit={{ opacity: 0, height: 0 }}
                                   className="overflow-hidden mt-3"
                                 >
                                   <div className="p-3 bg-[#111] border border-[#222] rounded-lg flex flex-col gap-2">
                                     <select 
                                       className="bg-[#222] border border-[#333] rounded px-2 py-1 text-xs text-white outline-none"
                                       value={newStep.type}
                                       onChange={(e) => setNewStep({...newStep, type: e.target.value as any})}
                                     >
                                       <option value="command">Команда</option>
                                       <option value="regex">Регулярное выражение (ID)</option>
                                       <option value="symbol">Символы</option>
                                     </select>
                                     <input 
                                       type="text" 
                                       placeholder={newStep.type === 'command' ? 'ID (напр. UPPERCASE, LINE_BREAKS)' : newStep.type === 'regex' ? 'ID Регулярки' : 'Символы для поиска'} 
                                       className="bg-[#222] border border-[#333] rounded px-2 py-1.5 text-xs text-white outline-none focus:border-orange-500/50"
                                       value={newStep.value}
                                       onChange={(e) => setNewStep({...newStep, value: e.target.value})}
                                     />
                                     <button
                                       onClick={() => {
                                         if (newStep.value.trim()) {
                                           const newPresets = presets.map(pr => {
                                             if (pr.id === p.id) {
                                               return { ...pr, steps: [...pr.steps, { id: Date.now().toString(), type: newStep.type as any, value: newStep.value.trim() }] };
                                             }
                                             return pr;
                                           });
                                           setPresets(newPresets);
                                           localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(newPresets));
                                           setNewStep({ type: 'command', value: '' });
                                           setPresetForNewStep(null);
                                         }
                                       }}
                                       disabled={!newStep.value.trim()}
                                       className="py-1.5 px-3 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:bg-[#333] text-white text-xs font-bold rounded transition-colors"
                                     >
                                       Добавить шаг
                                     </button>
                                   </div>
                                 </motion.div>
                               )}
                             </AnimatePresence>
                         </div>
                       ))}
                    </div>
                  </section>
               </div>
             </motion.div>
          </div>
        )}

        {isNotesOpen && (
           <div className="fixed inset-0 z-50 flex">
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                className="w-full h-full bg-[#111] flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)]"
              >
                 <header className="p-4 border-b border-[#222] flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2 text-[#e0e0e0]">
                       <StickyNote className="text-orange-400" /> Saved Notes
                    </h3>
                    <button onClick={() => setIsNotesOpen(false)} className="p-2 bg-[#222] hover:bg-[#2a2a2a] rounded-full transition-colors">
                       <ChevronRight size={20} />
                    </button>
                 </header>
                 <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0a0a]">
                    <button 
                      onClick={() => {
                        if (!text.trim()) return;
                        const newNote = { id: Date.now().toString(), content: text, timestamp: Date.now() };
                        const newNotes = [newNote, ...notes];
                        setNotes(newNotes);
                        localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(newNotes));
                      }}
                      className="w-full py-4 bg-orange-600/20 border border-orange-500/30 text-orange-400 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-orange-500/30 transition-all shadow-lg active:scale-[0.98]"
                    >
                      Save Current Text
                    </button>
                    {notes.map(note => (
                      <div key={note.id} className="bg-[#111] rounded-2xl border border-[#222] flex flex-col group overflow-hidden shadow-sm">
                         <div className="p-4">
                            <p className="text-xs text-[#bbb] line-clamp-3 mb-3 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                            <span className="text-[9px] text-[#666] font-mono">{new Date(note.timestamp).toLocaleString()}</span>
                         </div>
                         <div className="flex bg-[#1a1a1a] border-t border-[#333]">
                            <button onClick={() => updateText(note.content)} className="flex-1 py-2.5 text-[10px] font-bold text-[#888] hover:text-[#fff] hover:bg-[#2a2a2a] transition-all border-r border-[#333]">LOAD</button>
                            <button onClick={() => navigator.clipboard.writeText(note.content)} className="flex-1 py-2.5 text-[10px] font-bold text-[#888] hover:text-[#fff] hover:bg-[#2a2a2a] transition-all border-r border-[#333]">COPY</button>
                            <button 
                              onClick={() => {
                                const filtered = notes.filter(n => n.id !== note.id);
                                setNotes(filtered);
                                localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(filtered));
                              }}
                              className="px-4 py-2.5 text-red-500 hover:bg-red-900/40 transition-all"
                            >
                               <Trash2 size={14} />
                            </button>
                         </div>
                      </div>
                    ))}
                 </div>
              </motion.div>
           </div>
        )}
      </AnimatePresence>
    </div>
  );
}

