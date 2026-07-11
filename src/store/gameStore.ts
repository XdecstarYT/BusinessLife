/**
 * Zustand store: the single source of truth the UI subscribes to. It wraps
 * the pure simulation (engine + actions) and the persistence layer. All game
 * mutations go through here so React re-renders and autosave stay consistent.
 */
import { create } from 'zustand';
import type { EventChoice, FiredEvent, GameState } from '../sim/types';
import { generateWorld, type NewGameConfig } from '../sim/world';
import { advanceDay, advanceWeek, advanceYear, continueAsHeir as continueAsHeirEngine, gameOverCheck } from '../sim/engine';
import { resolveChoice } from '../sim/events';
import { RNG } from '../sim/rng';
import * as actions from '../sim/actions';
import * as market from '../sim/market';
import { ACHIEVEMENTS } from '../data/achievements';
import {
  AUTOSAVE_ID,
  deleteSave,
  exportSave,
  importSave,
  listSaves,
  loadGame,
  saveGame,
  type SaveSlotMeta,
} from './persistence';

export type Screen =
  | 'menu'
  | 'life'
  | 'career'
  | 'business'
  | 'studio'
  | 'market'
  | 'assets'
  | 'politics'
  | 'world'
  | 'explore'
  | 'news'
  | 'stats'
  | 'family'
  | 'casino'
  | 'athlete'
  | 'military'
  | 'drugs'
  | 'leaderboard';

interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'err' | 'achievement';
  icon?: string;
}

interface GameStoreState {
  state: GameState | null;
  screen: Screen;
  saves: SaveSlotMeta[];
  toasts: Toast[];
  eventQueue: FiredEvent[];
  activeEvent: FiredEvent | null;
  eventResult: { text: string | null; logs: string[] } | null;
  darkMode: boolean;
  busy: boolean;
  // Achievement keys already celebrated this session — lets us diff `state.achievements` after
  // every mutation and toast only the ones that are genuinely new, not ones a loaded save already had.
  seenAchievements: string[];

  // lifecycle
  newGame: (config: NewGameConfig) => void;
  refreshSaves: () => Promise<void>;
  load: (id: string) => Promise<void>;
  save: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  exportCurrent: () => string;
  importFrom: (json: string) => void;
  toMenu: () => void;

  // gameplay
  setScreen: (s: Screen) => void;
  nextYear: () => void;
  nextDay: () => void;
  nextWeek: () => void;
  chooseEvent: (choice: EventChoice) => void;
  dismissEventResult: () => void;
  dismissElectionResult: () => void;
  continueAsHeir: (npcId: string) => void;
  endStoryHere: () => void;
  dismissYearRecap: () => void;
  toggleDark: () => void;
  toast: (text: string, tone?: 'ok' | 'err') => void;
  toastAchievement: (icon: string, label: string) => void;

  // action dispatch — returns the ActionResult and applies re-render
  run: <T extends unknown[]>(fn: (state: GameState, ...args: T) => actions.ActionResult, ...args: T) => actions.ActionResult;
  // market helpers (same shape, different result type)
  trade: <T extends unknown[]>(fn: (state: GameState, ...args: T) => market.TradeResult, ...args: T) => market.TradeResult;
}

let toastId = 0;

/** Marks every achievement a state already has as "seen" without celebrating them — for a
 * freshly loaded/imported/inherited game, where they're old news, not something to toast. */
function seedSeenAchievements(state: GameState, set: (p: Partial<GameStoreState>) => void): void {
  set({ seenAchievements: [...state.achievements] });
}

/** Diffs `state.achievements` against what's already been celebrated this session and fires a
 * gold achievement toast (with confetti, via Toasts) for each genuinely new one. Achievements can
 * unlock from a year tick, a daily/weekly tick, or a direct player action, so this is called from
 * every one of those paths rather than just nextYear. */
function announceNewAchievements(state: GameState, get: () => GameStoreState, set: (p: Partial<GameStoreState>) => void): void {
  const seen = new Set(get().seenAchievements);
  const fresh = state.achievements.filter((a) => !seen.has(a));
  if (fresh.length === 0) return;
  set({ seenAchievements: [...state.achievements] });
  for (const key of fresh) {
    const def = ACHIEVEMENTS[key];
    if (def) get().toastAchievement(def.icon, def.label);
  }
}

/** Re-wrap the mutated state object into a new reference so React updates. */
function commit(get: () => GameStoreState, set: (p: Partial<GameStoreState>) => void): void {
  const s = get().state;
  if (!s) return;
  set({ state: { ...s } });
  // Fire-and-forget autosave.
  void saveGame(AUTOSAVE_ID, s, true);
  announceNewAchievements(s, get, set);
}

export const useGame = create<GameStoreState>((set, get) => ({
  state: null,
  screen: 'menu',
  saves: [],
  toasts: [],
  eventQueue: [],
  activeEvent: null,
  eventResult: null,
  darkMode: true,
  busy: false,
  seenAchievements: [],

  newGame: (config) => {
    const state = generateWorld(config);
    set({ state, screen: 'life', eventQueue: [], activeEvent: null, eventResult: null });
    seedSeenAchievements(state, set);
    void saveGame(AUTOSAVE_ID, state, true);
  },

  refreshSaves: async () => {
    set({ saves: await listSaves() });
  },

  load: async (id) => {
    const state = await loadGame(id);
    if (state) {
      const queue = state.pendingEvents ?? [];
      set({ state, screen: 'life', eventQueue: queue.slice(1), activeEvent: queue[0] ?? null, eventResult: null });
      seedSeenAchievements(state, set);
    } else {
      get().toast('Save not found.', 'err');
    }
  },

  save: async (id) => {
    const s = get().state;
    if (!s) return;
    await saveGame(id, s, false);
    await get().refreshSaves();
    get().toast('Game saved.');
  },

  remove: async (id) => {
    await deleteSave(id);
    await get().refreshSaves();
  },

  exportCurrent: () => {
    const s = get().state;
    return s ? exportSave(s) : '';
  },

  importFrom: (json) => {
    try {
      const state = importSave(json);
      const queue = state.pendingEvents ?? [];
      set({ state, screen: 'life', eventQueue: queue.slice(1), activeEvent: queue[0] ?? null, eventResult: null });
      seedSeenAchievements(state, set);
      get().toast('Save imported.');
    } catch {
      get().toast('Invalid save file.', 'err');
    }
  },

  toMenu: () => {
    void get().refreshSaves();
    set({ screen: 'menu' });
  },

  setScreen: (screen) => set({ screen }),

  nextYear: () => {
    const s = get().state;
    if (!s || s.gameOver) return;
    // Resolve any queued events first — block advancing until cleared.
    if (get().eventQueue.length > 0 || get().activeEvent) {
      get().toast('Resolve your current event first.', 'err');
      return;
    }
    const next = advanceYear(s);
    const queue = next.pendingEvents ?? [];
    set({
      state: { ...next },
      eventQueue: queue.slice(1),
      activeEvent: queue[0] ?? null,
      screen: 'life',
    });
    void saveGame(AUTOSAVE_ID, next, true);
    announceNewAchievements(next, get, set);
  },

  nextDay: () => {
    const s = get().state;
    if (!s || s.gameOver) return;
    if (get().eventQueue.length > 0 || get().activeEvent) {
      get().toast('Resolve your current event first.', 'err');
      return;
    }
    const res = advanceDay(s);
    const queue = res.state.pendingEvents ?? [];
    set({
      state: { ...res.state },
      eventQueue: queue.slice(1),
      activeEvent: queue[0] ?? null,
    });
    for (const h of res.headlines) get().toast(h);
    void saveGame(AUTOSAVE_ID, res.state, true);
    announceNewAchievements(res.state, get, set);
  },

  nextWeek: () => {
    const s = get().state;
    if (!s || s.gameOver) return;
    if (get().eventQueue.length > 0 || get().activeEvent) {
      get().toast('Resolve your current event first.', 'err');
      return;
    }
    const res = advanceWeek(s);
    const queue = res.state.pendingEvents ?? [];
    set({
      state: { ...res.state },
      eventQueue: queue.slice(1),
      activeEvent: queue[0] ?? null,
    });
    for (const h of res.headlines.slice(0, 3)) get().toast(h);
    if (res.headlines.length > 3) get().toast(`+${res.headlines.length - 3} more small moments this week`);
    void saveGame(AUTOSAVE_ID, res.state, true);
    announceNewAchievements(res.state, get, set);
  },

  chooseEvent: (choice) => {
    const s = get().state;
    const ev = get().activeEvent;
    if (!s || !ev) return;
    const rng = new RNG(s.seed);
    rng.state = s.rngState;
    const result = resolveChoice(s, ev, choice, rng);
    s.rngState = rng.state;
    // Record the event and its outcome in the life log so the feed stays rich.
    const summary = result.text ? `${choice.label} — ${result.text}` : choice.label;
    s.lifeLog.push({ year: s.year, age: s.player.age, text: summary, kind: 'info' });
    for (const l of result.logs) s.lifeLog.push({ year: s.year, age: s.player.age, text: l, kind: 'info' });
    // This event is now resolved — keep the persisted queue in sync with what's actually
    // left, otherwise an autosave taken mid-queue would replay already-resolved events
    // (and their effects) on reload, or soft-lock the game if it never gets read back
    // into `activeEvent` (see load()/importFrom()).
    s.pendingEvents = get().eventQueue;
    set({ state: { ...s }, eventResult: result, activeEvent: null });
    void saveGame(AUTOSAVE_ID, s, true);
    announceNewAchievements(s, get, set);
  },

  dismissEventResult: () => {
    const s = get().state;
    const queue = get().eventQueue;
    const nextActive = queue[0] ?? null;
    const nextQueue = queue.slice(1);
    if (s) s.pendingEvents = nextActive ? [nextActive, ...nextQueue] : nextQueue;
    set({
      state: s ? { ...s } : null,
      eventResult: null,
      activeEvent: nextActive,
      eventQueue: nextQueue,
    });
    if (s) void saveGame(AUTOSAVE_ID, s, true);
  },

  toggleDark: () => set({ darkMode: !get().darkMode }),

  dismissElectionResult: () => {
    const s = get().state;
    if (!s) return;
    s.player.lastElectionResult = null;
    commit(get, set);
  },

  continueAsHeir: (npcId) => {
    const s = get().state;
    if (!s) return;
    const next = continueAsHeirEngine(s, npcId);
    set({ state: { ...next }, screen: 'life' });
    seedSeenAchievements(next, set);
    void saveGame(AUTOSAVE_ID, next, true);
  },

  endStoryHere: () => {
    const s = get().state;
    if (!s) return;
    s.pendingSuccession = null;
    commit(get, set);
  },

  dismissYearRecap: () => {
    const s = get().state;
    if (!s) return;
    s.yearRecap = null;
    commit(get, set);
  },

  toast: (text, tone = 'ok') => {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, text, tone }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 3200);
  },

  toastAchievement: (icon, label) => {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, text: label, tone: 'achievement', icon }] });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 4200);
  },

  run: (fn, ...args) => {
    const s = get().state;
    if (!s) return { ok: false, message: 'No game in progress.' };
    const res = fn(s, ...args);
    if (!s.player.alive) gameOverCheck(s);
    commit(get, set);
    get().toast(res.message, res.ok ? 'ok' : 'err');
    return res;
  },

  trade: (fn, ...args) => {
    const s = get().state;
    if (!s) return { ok: false, message: 'No game in progress.' };
    const res = fn(s, ...args);
    commit(get, set);
    get().toast(res.message, res.ok ? 'ok' : 'err');
    return res;
  },
}));
