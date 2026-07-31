import { env } from "cloudflare:workers";
import type {
  AppData,
  Card,
  CardSet,
  ChatMessage,
  GeneratedMaterial,
  ReviewLog,
  ReviewRating,
} from "../lib/types";

type RuntimeEnv = {
  DB?: D1Database;
};

function database(): D1Database {
  const db = (env as unknown as RuntimeEnv).DB;
  if (!db) throw new Error("DATABASE_NOT_CONFIGURED");
  return db;
}

export function requestUserId(request: Request): string {
  return request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase() || "loop-owner";
}

export async function ensureDatabase(): Promise<void> {
  const db = database();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS sources_user_idx ON sources(user_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS card_sets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      summary TEXT NOT NULL,
      key_points TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_studied_at TEXT,
      next_review_at TEXT
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS card_sets_user_idx ON card_sets(user_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      status TEXT NOT NULL,
      difficulty INTEGER NOT NULL DEFAULT 2,
      due_at TEXT NOT NULL,
      interval_days INTEGER NOT NULL DEFAULT 0,
      review_count INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS cards_user_idx ON cards(user_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS cards_set_idx ON cards(set_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS cards_due_idx ON cards(due_at)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS review_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      rating TEXT NOT NULL,
      response_ms INTEGER NOT NULL,
      reviewed_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS review_logs_user_idx ON review_logs(user_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS review_logs_card_idx ON review_logs(card_id)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      set_id TEXT,
      card_id TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS chat_messages_user_idx ON chat_messages(user_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS chat_messages_card_idx ON chat_messages(card_id)"),
  ]);
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function parseJsonArray(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function seedIfEmpty(userId: string): Promise<void> {
  const db = database();
  const row = await db.prepare("SELECT COUNT(*) AS count FROM card_sets WHERE user_id = ?")
    .bind(userId).first<{ count: number }>();
  if (Number(row?.count || 0) > 0) return;

  const now = new Date();
  const nowIso = now.toISOString();
  const sourceId = id("src");
  const setId = id("set");
  const seedCards = [
    ["スピノザにおける実体とは？", "それ自体で存在し、それ自体によって理解されるもの。", 2],
    ["スピノザは実体を何と同一視したか？", "神、または自然（デウス・シヴェ・ナトゥーラ）と同一視した。", 2],
    ["スピノザによれば、実体の性質は？", "実体は無限であり、無数の属性を持つ。", 3],
  ] as const;

  await db.batch([
    db.prepare("INSERT INTO sources (id,user_id,title,content,created_at,updated_at) VALUES (?,?,?,?,?,?)")
      .bind(sourceId, userId, "スピノザの実体論", "スピノザは、実体とはそれ自体で存在し、それ自体によって理解されるものだと定義した。唯一の実体を神または自然と同一視し、無限の属性を持つと考えた。", nowIso, nowIso),
    db.prepare(`INSERT INTO card_sets
      (id,user_id,source_id,title,category,summary,key_points,created_at,updated_at,last_studied_at,next_review_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(setId, userId, sourceId, "スピノザ", "哲学", "唯一の実体を神＝自然とみなすスピノザの一元論。",
        JSON.stringify(["実体はそれ自体で存在する", "実体は神または自然である", "実体は無限の属性を持つ"]),
        nowIso, nowIso, null, nowIso),
    ...seedCards.map(([question, answer, difficulty]) =>
      db.prepare(`INSERT INTO cards
        (id,set_id,user_id,question,answer,status,difficulty,due_at,interval_days,review_count,correct_count,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id("card"), setId, userId, question, answer, "未学習", difficulty, nowIso, 0, 0, 0, nowIso, nowIso)),
  ]);
}

export async function loadAppData(userId: string): Promise<AppData> {
  await ensureDatabase();
  await seedIfEmpty(userId);
  const db = database();
  const [setResult, cardResult, reviewResult, chatResult] = await Promise.all([
    db.prepare("SELECT * FROM card_sets WHERE user_id = ? ORDER BY updated_at DESC").bind(userId).all(),
    db.prepare("SELECT * FROM cards WHERE user_id = ? ORDER BY created_at ASC").bind(userId).all(),
    db.prepare("SELECT * FROM review_logs WHERE user_id = ? ORDER BY reviewed_at DESC LIMIT 500").bind(userId).all(),
    db.prepare("SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT 500").bind(userId).all(),
  ]);

  const cards = (cardResult.results || []).map(mapCard);
  const sets: CardSet[] = (setResult.results || []).map((row) => ({
    id: String(row.id),
    title: String(row.title),
    category: String(row.category),
    summary: String(row.summary),
    keyPoints: parseJsonArray(row.key_points),
    sourceContent: "",
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    lastStudiedAt: row.last_studied_at ? String(row.last_studied_at) : null,
    nextReviewAt: row.next_review_at ? String(row.next_review_at) : null,
    cards: cards.filter((card) => card.setId === String(row.id)),
  }));

  for (const set of sets) {
    const source = await db.prepare("SELECT content FROM sources WHERE id = (SELECT source_id FROM card_sets WHERE id = ? AND user_id = ?)")
      .bind(set.id, userId).first<{ content: string }>();
    set.sourceContent = source?.content || "";
  }

  const reviews: ReviewLog[] = (reviewResult.results || []).map((row) => ({
    id: String(row.id),
    cardId: String(row.card_id),
    rating: String(row.rating) as ReviewRating,
    responseMs: Number(row.response_ms),
    reviewedAt: String(row.reviewed_at),
  }));

  const chatMessages: ChatMessage[] = (chatResult.results || []).map((row) => ({
    id: String(row.id),
    setId: row.set_id ? String(row.set_id) : null,
    cardId: row.card_id ? String(row.card_id) : null,
    role: String(row.role) as "user" | "assistant",
    content: String(row.content),
    createdAt: String(row.created_at),
  }));

  return { sets, reviews, chatMessages };
}

function mapCard(row: Record<string, unknown>): Card {
  return {
    id: String(row.id),
    setId: String(row.set_id),
    question: String(row.question),
    answer: String(row.answer),
    status: String(row.status) as Card["status"],
    difficulty: Number(row.difficulty),
    dueAt: String(row.due_at),
    intervalDays: Number(row.interval_days),
    reviewCount: Number(row.review_count),
    correctCount: Number(row.correct_count),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function saveGeneratedSet(userId: string, material: GeneratedMaterial & { sourceContent: string }): Promise<string> {
  await ensureDatabase();
  const db = database();
  const now = new Date().toISOString();
  const sourceId = id("src");
  const setId = id("set");
  const statements = [
    db.prepare("INSERT INTO sources (id,user_id,title,content,created_at,updated_at) VALUES (?,?,?,?,?,?)")
      .bind(sourceId, userId, material.title, material.sourceContent, now, now),
    db.prepare(`INSERT INTO card_sets
      (id,user_id,source_id,title,category,summary,key_points,created_at,updated_at,last_studied_at,next_review_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(setId, userId, sourceId, material.title, material.category, material.summary,
        JSON.stringify(material.keyPoints), now, now, null, now),
    ...material.cards.map((card) =>
      db.prepare(`INSERT INTO cards
        (id,set_id,user_id,question,answer,status,difficulty,due_at,interval_days,review_count,correct_count,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id("card"), setId, userId, card.question.trim(), card.answer.trim(), "未学習",
          Math.max(1, Math.min(3, Math.round(card.difficulty || 2))), now, 0, 0, 0, now, now)),
  ];
  await db.batch(statements);
  return setId;
}

export async function reviewCard(userId: string, cardId: string, rating: ReviewRating, responseMs: number): Promise<void> {
  await ensureDatabase();
  const db = database();
  const card = await db.prepare("SELECT * FROM cards WHERE id = ? AND user_id = ?").bind(cardId, userId).first<Record<string, unknown>>();
  if (!card) throw new Error("CARD_NOT_FOUND");

  const currentInterval = Number(card.interval_days || 0);
  let intervalDays = 0;
  let dueAt = new Date();
  let status: Card["status"] = "復習待ち";
  let correctDelta = 0;
  if (rating === "again") {
    dueAt = new Date(Date.now() + 10 * 60 * 1000);
    status = "苦手";
  } else if (rating === "hard") {
    intervalDays = Math.max(1, Math.round(currentInterval * 1.2) || 1);
    dueAt = new Date(Date.now() + intervalDays * 86400000);
    status = "復習待ち";
  } else if (rating === "good") {
    intervalDays = Math.max(3, Math.round(currentInterval * 2) || 3);
    dueAt = new Date(Date.now() + intervalDays * 86400000);
    status = "定着中";
    correctDelta = 1;
  } else {
    intervalDays = Math.max(7, Math.round(currentInterval * 3) || 7);
    dueAt = new Date(Date.now() + intervalDays * 86400000);
    status = "定着中";
    correctDelta = 1;
  }
  const now = new Date().toISOString();
  const setId = String(card.set_id);
  await db.batch([
    db.prepare(`UPDATE cards SET status = ?, due_at = ?, interval_days = ?,
      review_count = review_count + 1, correct_count = correct_count + ?, updated_at = ?
      WHERE id = ? AND user_id = ?`)
      .bind(status, dueAt.toISOString(), intervalDays, correctDelta, now, cardId, userId),
    db.prepare("INSERT INTO review_logs (id,user_id,card_id,rating,response_ms,reviewed_at) VALUES (?,?,?,?,?,?)")
      .bind(id("review"), userId, cardId, rating, Math.max(0, Math.min(responseMs, 3600000)), now),
    db.prepare("UPDATE card_sets SET last_studied_at = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .bind(now, now, setId, userId),
  ]);
  const next = await db.prepare("SELECT MIN(due_at) AS next_due FROM cards WHERE set_id = ? AND user_id = ?")
    .bind(setId, userId).first<{ next_due: string }>();
  await db.prepare("UPDATE card_sets SET next_review_at = ? WHERE id = ? AND user_id = ?")
    .bind(next?.next_due || dueAt.toISOString(), setId, userId).run();
}

export async function saveChatPair(
  userId: string,
  setId: string | null,
  cardId: string | null,
  question: string,
  answer: string,
): Promise<void> {
  await ensureDatabase();
  const db = database();
  const now = Date.now();
  await db.batch([
    db.prepare("INSERT INTO chat_messages (id,user_id,set_id,card_id,role,content,created_at) VALUES (?,?,?,?,?,?,?)")
      .bind(id("msg"), userId, setId, cardId, "user", question, new Date(now).toISOString()),
    db.prepare("INSERT INTO chat_messages (id,user_id,set_id,card_id,role,content,created_at) VALUES (?,?,?,?,?,?,?)")
      .bind(id("msg"), userId, setId, cardId, "assistant", answer, new Date(now + 1).toISOString()),
  ]);
}

