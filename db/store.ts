import { env } from "cloudflare:workers";
import type {
  AppData,
  Card,
  CardSet,
  ChatMessage,
  GeneratedCard,
  GeneratedMaterial,
  ReviewLog,
  ReviewRating,
  BinaryReviewRating,
} from "../lib/types";
import { scheduleBinaryReview } from "../lib/review";

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
      format TEXT NOT NULL DEFAULT 'qa',
      choices TEXT NOT NULL DEFAULT '[]',
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
      session_id TEXT,
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
      session_id TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS chat_messages_user_idx ON chat_messages(user_id)"),
    db.prepare("CREATE INDEX IF NOT EXISTS chat_messages_card_idx ON chat_messages(card_id)"),
  ]);
  const cardColumns = await db.prepare("PRAGMA table_info(cards)").all<{ name: string }>();
  const columnNames = new Set((cardColumns.results || []).map((column) => String(column.name)));
  const upgrades = [];
  if (!columnNames.has("format")) upgrades.push(db.prepare("ALTER TABLE cards ADD COLUMN format TEXT NOT NULL DEFAULT 'qa'"));
  if (!columnNames.has("choices")) upgrades.push(db.prepare("ALTER TABLE cards ADD COLUMN choices TEXT NOT NULL DEFAULT '[]'"));
  if (upgrades.length) await db.batch(upgrades);
  const reviewColumns = await db.prepare("PRAGMA table_info(review_logs)").all<{ name: string }>();
  if (!(reviewColumns.results || []).some((column) => String(column.name) === "session_id")) {
    await db.prepare("ALTER TABLE review_logs ADD COLUMN session_id TEXT").run();
  }
  await db.prepare("CREATE INDEX IF NOT EXISTS review_logs_session_idx ON review_logs(session_id)").run();
  const chatColumns = await db.prepare("PRAGMA table_info(chat_messages)").all<{ name: string }>();
  if (!(chatColumns.results || []).some((column) => String(column.name) === "session_id")) {
    await db.prepare("ALTER TABLE chat_messages ADD COLUMN session_id TEXT").run();
  }
  await db.prepare("CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages(session_id)").run();
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
        (id,set_id,user_id,question,answer,format,choices,status,difficulty,due_at,interval_days,review_count,correct_count,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id("card"), setId, userId, question, answer, "qa", "[]", "未学習", difficulty, nowIso, 0, 0, 0, nowIso, nowIso)),
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
    db.prepare("SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 500").bind(userId).all(),
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
    sessionId: row.session_id ? String(row.session_id) : null,
    rating: String(row.rating) as ReviewRating,
    responseMs: Number(row.response_ms),
    reviewedAt: String(row.reviewed_at),
  }));

  const chatMessages: ChatMessage[] = [...(chatResult.results || [])].reverse().map((row) => ({
    id: String(row.id),
    setId: row.set_id ? String(row.set_id) : null,
    cardId: row.card_id ? String(row.card_id) : null,
    sessionId: row.session_id ? String(row.session_id) : null,
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
    format: ["qa", "multiple_choice", "self_explain"].includes(String(row.format)) ? String(row.format) as Card["format"] : "qa",
    choices: parseJsonArray(row.choices),
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
        (id,set_id,user_id,question,answer,format,choices,status,difficulty,due_at,interval_days,review_count,correct_count,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(id("card"), setId, userId, card.question.trim(), card.answer.trim(), normalizeFormat(card.format), JSON.stringify(normalizeChoices(card)), "未学習",
          Math.max(1, Math.min(3, Math.round(card.difficulty || 2))), now, 0, 0, 0, now, now)),
  ];
  await db.batch(statements);
  return setId;
}

function normalizeFormat(format: GeneratedCard["format"]): Card["format"] {
  return ["qa", "multiple_choice", "self_explain"].includes(format) ? format : "qa";
}

function normalizeChoices(card: GeneratedCard): string[] {
  if (normalizeFormat(card.format) !== "multiple_choice") return [];
  const answer = card.answer.trim();
  const choices = [...new Set((card.choices || []).map((choice) => choice.trim()).filter(Boolean))];
  if (choices.includes(answer)) return choices.slice(0, 4);
  return [...choices.slice(0, 3), answer];
}

export async function addCardsToSet(userId: string, setId: string, newCards: GeneratedCard[]): Promise<void> {
  await ensureDatabase();
  const db = database();
  const existing = await db.prepare("SELECT id FROM card_sets WHERE id = ? AND user_id = ?").bind(setId, userId).first<{ id: string }>();
  if (!existing) throw new Error("SET_NOT_FOUND");
  const now = new Date().toISOString();
  await db.batch([
    ...newCards.map((card) => db.prepare(`INSERT INTO cards
      (id,set_id,user_id,question,answer,format,choices,status,difficulty,due_at,interval_days,review_count,correct_count,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id("card"), setId, userId, card.question.trim(), card.answer.trim(), normalizeFormat(card.format), JSON.stringify(normalizeChoices(card)), "未学習",
        Math.max(1, Math.min(3, Math.round(card.difficulty || 2))), now, 0, 0, 0, now, now)),
    db.prepare("UPDATE card_sets SET updated_at = ?, next_review_at = ? WHERE id = ? AND user_id = ?").bind(now, now, setId, userId),
  ]);
}

export async function reviewCard(userId: string, cardId: string, rating: BinaryReviewRating, responseMs: number, sessionId: string | null): Promise<void> {
  await ensureDatabase();
  const db = database();
  const card = await db.prepare("SELECT * FROM cards WHERE id = ? AND user_id = ?").bind(cardId, userId).first<Record<string, unknown>>();
  if (!card) throw new Error("CARD_NOT_FOUND");

  const reviewedAtMs = Date.now();
  const now = new Date(reviewedAtMs).toISOString();
  const schedule = scheduleBinaryReview(rating, Number(card.interval_days || 0), reviewedAtMs);
  const dueAt = new Date(schedule.dueAtMs);
  const safeResponseMs = Number.isFinite(responseMs) ? Math.max(0, Math.min(responseMs, 3_600_000)) : 0;
  const setId = String(card.set_id);
  await db.batch([
    db.prepare(`UPDATE cards SET status = ?, due_at = ?, interval_days = ?,
      review_count = review_count + 1, correct_count = correct_count + ?, updated_at = ?
      WHERE id = ? AND user_id = ?`)
      .bind(schedule.status, dueAt.toISOString(), schedule.intervalDays, schedule.correctDelta, now, cardId, userId),
    db.prepare("INSERT INTO review_logs (id,user_id,card_id,session_id,rating,response_ms,reviewed_at) VALUES (?,?,?,?,?,?,?)")
      .bind(id("review"), userId, cardId, sessionId, rating, safeResponseMs, now),
    db.prepare("UPDATE card_sets SET last_studied_at = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .bind(now, now, setId, userId),
  ]);
  const next = await db.prepare("SELECT MIN(due_at) AS next_due FROM cards WHERE set_id = ? AND user_id = ? AND status <> 'アーカイブ'")
    .bind(setId, userId).first<{ next_due: string }>();
  await db.prepare("UPDATE card_sets SET next_review_at = ? WHERE id = ? AND user_id = ?")
    .bind(next?.next_due || dueAt.toISOString(), setId, userId).run();
}

export async function saveChatPair(
  userId: string,
  setId: string | null,
  cardId: string | null,
  sessionId: string | null,
  question: string,
  answer: string,
): Promise<void> {
  await ensureDatabase();
  const db = database();
  const now = Date.now();
  await db.batch([
    db.prepare("INSERT INTO chat_messages (id,user_id,set_id,card_id,session_id,role,content,created_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(id("msg"), userId, setId, cardId, sessionId, "user", question, new Date(now).toISOString()),
    db.prepare("INSERT INTO chat_messages (id,user_id,set_id,card_id,session_id,role,content,created_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(id("msg"), userId, setId, cardId, sessionId, "assistant", answer, new Date(now + 1).toISOString()),
  ]);
}

export async function loadAiCardContext(userId: string, setId: string, cardId: string, sessionId: string): Promise<{
  setId: string;
  cardId: string;
  category: string;
  cardQuestion: string;
  cardAnswer: string;
  sourceContent: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}> {
  await ensureDatabase();
  const db = database();
  const context = await db.prepare(`SELECT c.id AS card_id, c.set_id, c.question, c.answer, s.category, src.content
    FROM cards c
    INNER JOIN card_sets s ON s.id = c.set_id AND s.user_id = c.user_id
    INNER JOIN sources src ON src.id = s.source_id AND src.user_id = c.user_id
    WHERE c.id = ? AND c.set_id = ? AND c.user_id = ?`)
    .bind(cardId, setId, userId).first<Record<string, unknown>>();
  if (!context) throw new Error("CARD_NOT_FOUND");
  const historyResult = await db.prepare(`SELECT role, content FROM chat_messages
    WHERE user_id = ? AND set_id = ? AND card_id = ? AND session_id = ?
    ORDER BY created_at DESC LIMIT 20`)
    .bind(userId, setId, cardId, sessionId).all<Record<string, unknown>>();
  const history = [...(historyResult.results || [])].reverse()
    .filter((row) => ["user", "assistant"].includes(String(row.role)))
    .map((row) => ({ role: String(row.role) as "user" | "assistant", content: String(row.content).slice(0, 4000) }));
  return {
    setId: String(context.set_id),
    cardId: String(context.card_id),
    category: String(context.category),
    cardQuestion: String(context.question),
    cardAnswer: String(context.answer),
    sourceContent: String(context.content),
    history,
  };
}
