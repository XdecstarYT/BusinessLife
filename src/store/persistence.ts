/**
 * IndexedDB persistence with a localStorage fallback. Saves are plain JSON
 * (the whole GameState), so export/import is trivial and modding-friendly.
 * A lightweight promise-based wrapper avoids pulling in a dependency.
 */
import type { GameState } from '../sim/types';

const DB_NAME = 'businesslife';
const STORE = 'saves';
const META = 'meta';
const DB_VERSION = 1;

export interface SaveSlotMeta {
  id: string;
  saveName: string;
  playerName: string;
  age: number;
  year: number;
  netWorth: number;
  updatedAt: number;
  autosave: boolean;
  legacyScore: number | null; // set once the game has ended, for New Game+ bonuses
}

interface SaveRecord {
  id: string;
  meta: SaveSlotMeta;
  state: GameState;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  return dbPromise;
}

// -- localStorage fallback ---------------------------------------------------
const LS_PREFIX = 'bl_save_';
function lsSave(rec: SaveRecord): void {
  try {
    localStorage.setItem(LS_PREFIX + rec.id, JSON.stringify(rec));
  } catch {
    /* storage full or unavailable */
  }
}
function lsList(): SaveSlotMeta[] {
  const out: SaveSlotMeta[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(LS_PREFIX)) {
      try {
        out.push((JSON.parse(localStorage.getItem(key)!) as SaveRecord).meta);
      } catch {
        /* skip */
      }
    }
  }
  return out;
}

export async function saveGame(id: string, state: GameState, autosave = false): Promise<void> {
  const meta: SaveSlotMeta = {
    id,
    saveName: state.saveName,
    playerName: state.player.name,
    age: state.player.age,
    year: state.year,
    netWorth: state.netWorthHistory[state.netWorthHistory.length - 1]?.value ?? state.player.money,
    updatedAt: Date.now(),
    autosave,
    legacyScore: state.gameOver?.legacyScore ?? null,
  };
  const rec: SaveRecord = { id, meta, state: structuredClone(state) };
  const db = await openDB();
  if (!db) {
    lsSave(rec);
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE, META], 'readwrite');
    tx.objectStore(STORE).put(rec);
    tx.objectStore(META).put(meta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }).catch(() => lsSave(rec));
}

export async function loadGame(id: string): Promise<GameState | null> {
  const db = await openDB();
  if (!db) {
    const raw = localStorage.getItem(LS_PREFIX + id);
    return raw ? (JSON.parse(raw) as SaveRecord).state : null;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result ? (req.result as SaveRecord).state : null);
    req.onerror = () => resolve(null);
  });
}

export async function listSaves(): Promise<SaveSlotMeta[]> {
  const db = await openDB();
  if (!db) return lsList().sort((a, b) => b.updatedAt - a.updatedAt);
  return new Promise((resolve) => {
    const tx = db.transaction(META, 'readonly');
    const req = tx.objectStore(META).getAll();
    req.onsuccess = () => resolve((req.result as SaveSlotMeta[]).sort((a, b) => b.updatedAt - a.updatedAt));
    req.onerror = () => resolve([]);
  });
}

export async function deleteSave(id: string): Promise<void> {
  const db = await openDB();
  if (!db) {
    localStorage.removeItem(LS_PREFIX + id);
    return;
  }
  await new Promise<void>((resolve) => {
    const tx = db.transaction([STORE, META], 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.objectStore(META).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export function exportSave(state: GameState): string {
  return JSON.stringify(state);
}

export function importSave(json: string): GameState {
  const state = JSON.parse(json) as GameState;
  if (!state.player || !state.countries || typeof state.year !== 'number') {
    throw new Error('Invalid save file.');
  }
  return state;
}

export const AUTOSAVE_ID = 'autosave';
