import type { AppData, Card, CardSet, Folder } from './types';

/** Wire collections contain no source text, key points or nested card arrays. */
export type MaterialSummary = Omit<CardSet, 'sourceContent' | 'keyPoints' | 'cards'>;
export type MaterialCollection = 'sets' | 'cards' | 'folders';
export type MaterialPage<T> = { items: T[]; nextCursor: string | null };
export type MaterialPages = {
  sets: MaterialPage<MaterialSummary>;
  cards: MaterialPage<Card>;
  folders: MaterialPage<Folder>;
};
export type AppDataPage = Omit<AppData, 'sets' | 'folders'> & {
  materialsVersion: 1;
  collections: MaterialPages;
};
export type MaterialTextPage = { content: string; nextCursor: string | null };
export const MATERIAL_PAGE_SIZE = 100;
export const MATERIAL_MAX_PAGE_SIZE = 200;
export const MATERIAL_PAGE_BYTES = 512 * 1024;
export const MATERIAL_TEXT_CHARACTERS = 32000;
