import { reconcileStudy, retentionSnapshot } from "./retention.ts";
import { PRESETS, GOALS, validInterests, recommend } from "../lib/onboarding";
import { InputError } from "../lib/api-input.ts";
import type { UserProfile } from "../lib/types";
import { studyDayBounds, streakLength } from "../lib/daily-review";
import type { DailyReview } from "../lib/types";
import { database, initializeDatabase } from "./client";
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


export async function ensureDatabase(): Promise<void> {
  await initializeDatabase();
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

export async function seedIfEmpty(userId: string, language: "ja" | "en" = "ja"): Promise<void> {
  await ensureDatabase();
  const row = await database().prepare("SELECT COUNT(*) AS count FROM card_sets WHERE user_id = ?").bind(userId).first<{ count: number }>();
  if (Number(row?.count || 0) > 0) return;
  const en = language === "en";
  const pairs = en ? [
    ["What is substance according to Spinoza?", "That which exists in itself and is understood through itself."],
    ["What did Spinoza identify substance with?", "God, or Nature (Deus sive Natura)."],
    ["What are the properties of substance for Spinoza?", "Substance is infinite and has infinitely many attributes."],
  ] : [
    ["スピノザにおける実体とは？", "それ自体で存在し、それ自体によって理解されるもの。"],
    ["スピノザは実体を何と同一視したか？", "神、または自然（デウス・シヴェ・ナトゥーラ）と同一視した。"],
    ["スピノザによれば、実体の性質は？", "実体は無限であり、無数の属性を持つ。"],
  ];
  await saveGeneratedSet(userId, {
    title: en ? "Spinoza" : "スピノザ", category: en ? "Philosophy" : "哲学",
    summary: en ? "Spinoza identifies the one substance with God or Nature." : "唯一の実体を神＝自然とみなすスピノザの一元論。",
    keyPoints: pairs.map(([, answer]) => answer), sourceContent: pairs.map(([, answer]) => answer).join(en ? " " : "\n"),
    cards: pairs.map(([question, answer]) => ({ question, answer, format: "qa", choices: [], difficulty: 2 })),
  });
}

export async function loadAppData(userId: string, sessionIds: string[] = [], timezone?:string): Promise<AppData> {
  await ensureDatabase();
  const profile = await loadProfile(userId);
  const db = database();
  const { start, end } = studyDayBounds(new Date());
  const recordStart = new Date(new Date(start).getTime() - 6 * 86_400_000).toISOString();
  const [setResult, cardResult, reviewResult, chatResult, folderResult, activityResult] = await Promise.all([
    db.prepare("SELECT * FROM card_sets WHERE user_id = ? ORDER BY updated_at DESC").bind(userId).all(),
    db.prepare("SELECT * FROM cards WHERE user_id = ? ORDER BY created_at ASC").bind(userId).all(),
    db.prepare("SELECT * FROM review_logs WHERE user_id = ? ORDER BY reviewed_at DESC, rowid DESC LIMIT 500").bind(userId).all(),
    db.prepare("SELECT * FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 500").bind(userId).all(),
    db.prepare("SELECT id, parent_id, name FROM folders WHERE user_id = ? ORDER BY name, id").bind(userId).all(),
    // Count each successfully recalled card once per Tokyo day, beyond the log page limit.
    db.prepare("SELECT date(reviewed_at, '+9 hours') AS day, COUNT(DISTINCT card_id) AS cards FROM review_logs WHERE user_id = ? AND undone_at IS NULL AND rating IN ('good', 'easy') AND reviewed_at >= ? AND reviewed_at < ? GROUP BY day").bind(userId, recordStart, end).all(),
  ]);

  const cards = (cardResult.results || []).map(mapCard);
  const sets: CardSet[] = (setResult.results || []).map((row) => ({
    folderId: row.folder_id ? String(row.folder_id) : null,
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
    const source = await db.prepare("SELECT content FROM sources WHERE user_id = ? AND id = (SELECT source_id FROM card_sets WHERE id = ? AND user_id = ?)")
      .bind(userId, set.id, userId).first<{ content: string }>();
    set.sourceContent = source?.content || "";
  }

  const requestedSessions = [...new Set([...sessionIds, ...(!profile.onboardingCompleted && profile.initialSessionId ? [profile.initialSessionId] : [])])];
  const sessionRows = requestedSessions.length ? (await db.prepare(`SELECT * FROM review_logs WHERE user_id = ? AND session_id IN (${requestedSessions.map(() => "?").join(",")}) ORDER BY rowid ASC`).bind(userId, ...requestedSessions).all()).results : [];
  const mapReview = (row: Record<string, unknown>): ReviewLog => ({
    id: String(row.id),
    cardId: String(row.card_id),
    sessionId: row.session_id ? String(row.session_id) : null,
    rating: String(row.rating) as ReviewRating,
    responseMs: Number(row.response_ms),
    reviewedAt: String(row.reviewed_at),
    operationId: row.operation_id ? String(row.operation_id) : null,
  });
  const reviews = (reviewResult.results || []).filter((row) => !row.undone_at).map(mapReview);
  const sessionReviews = sessionRows.filter((row) => !row.undone_at).map(mapReview);

  const chatMessages: ChatMessage[] = [...(chatResult.results || [])].reverse().map((row) => ({
    id: String(row.id),
    setId: row.set_id ? String(row.set_id) : null,
    cardId: row.card_id ? String(row.card_id) : null,
    sessionId: row.session_id ? String(row.session_id) : null,
    role: String(row.role) as "user" | "assistant",
    content: String(row.content),
    createdAt: String(row.created_at),
  }));

  const folders = (folderResult.results || []).map((row) => ({ id: String(row.id), parentId: row.parent_id ? String(row.parent_id) : null, name: String(row.name) }));
  return { retention: await retentionSnapshot(userId,timezone), profile, undoneOperationIds: sessionRows.filter((row) => row.undone_at && row.operation_id).map((row) => String(row.operation_id)), sets, reviews, ...(requestedSessions.length ? { sessionReviews } : {}), chatMessages, folders, recordActivity: (activityResult.results || []).map((row) => ({ day: String(row.day), cards: Number(row.cards) })), undoneReviewIds: [...(reviewResult.results || []), ...sessionRows].filter((row) => row.undone_at).map((row) => String(row.id)), dailyReview: await loadDailyReview(userId) };
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

export async function saveGeneratedSet(userId: string, material: GeneratedMaterial & { sourceContent: string; folderId?: string | null }): Promise<string> {
  await ensureDatabase();
  const db = database();
  const now = new Date().toISOString();
  await requireFolder(userId, material.folderId || null);
  const { setId, statements } = materialStatements(db, userId, material, now);
  await db.batch(statements);
  return setId;
}

function materialStatements(db: ReturnType<typeof database>, userId: string, material: GeneratedMaterial & { sourceContent: string; folderId?: string | null }, now: string) {
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
  statements.push(db.prepare("UPDATE card_sets SET folder_id = ? WHERE id = ? AND user_id = ?").bind(material.folderId || null, setId, userId));
  return { setId, statements };
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

export async function addCardsToSet(userId: string, setId: string, newCards: GeneratedCard[], source?: { title: string; content: string }): Promise<void> {
  await ensureDatabase();
  const db = database();
  const existing = await db.prepare("SELECT id FROM card_sets WHERE id = ? AND user_id = ?").bind(setId, userId).first<{ id: string }>();
  if (!existing) throw new Error("SET_NOT_FOUND");
  const now = new Date().toISOString();
  await db.batch([
    ...(source ? [db.prepare("UPDATE sources SET content = content || ?, updated_at = ? WHERE user_id = ? AND id = (SELECT source_id FROM card_sets WHERE id = ? AND user_id = ?)")
      .bind(`\n\n--- ${source.title} ---\n${source.content}`, now, userId, setId, userId)] : []),
    ...newCards.map((card) => db.prepare(`INSERT INTO cards
      (id,set_id,user_id,question,answer,format,choices,status,difficulty,due_at,interval_days,review_count,correct_count,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id("card"), setId, userId, card.question.trim(), card.answer.trim(), normalizeFormat(card.format), JSON.stringify(normalizeChoices(card)), "未学習",
        Math.max(1, Math.min(3, Math.round(card.difficulty || 2))), now, 0, 0, 0, now, now)),
    db.prepare("UPDATE card_sets SET updated_at = ?, next_review_at = ? WHERE id = ? AND user_id = ?").bind(now, now, setId, userId),
  ]);
}

export async function reviewCard(userId: string, cardId: string, rating: BinaryReviewRating, responseMs: number, sessionId: string | null, operation?: { operationId: string; expectedReviewCount: number }): Promise<string> {
  await ensureDatabase();
  await loadDailyReview(userId);
  return database().transaction(async (tx) => {
    if (operation) {
      const existing = (await tx.execute({ sql: "SELECT * FROM review_logs WHERE user_id = ? AND operation_id = ?", args: [userId, operation.operationId] })).rows[0];
      if (existing) {
        const previous = JSON.parse(String(existing.previous_state));
        if (existing.card_id !== cardId || existing.session_id !== sessionId || existing.rating !== rating || previous.reviewCount !== operation.expectedReviewCount) throw new Error("REVIEW_OPERATION_CONFLICT");
        return String(existing.id); // Includes undone operations: a retry must never reapply them.
      }
    }
    const card = (await tx.execute({ sql: "SELECT * FROM cards WHERE id = ? AND user_id = ?", args: [cardId, userId] })).rows[0];
    if (!card || ["アーカイブ", "削除済み"].includes(String(card.status))) throw new Error("CARD_NOT_FOUND");
    if (operation && Number(card.review_count) !== operation.expectedReviewCount) throw new Error("REVIEW_STATE_CONFLICT");
    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    const schedule = scheduleBinaryReview(rating, Number(card.interval_days), nowMs);
    const setId = String(card.set_id);
    const set = (await tx.execute({ sql: "SELECT last_studied_at FROM card_sets WHERE id = ? AND user_id = ?", args: [setId, userId] })).rows[0];
    const previous = { status: card.status, dueAt: card.due_at, intervalDays: card.interval_days, reviewCount: card.review_count, correctCount: card.correct_count, lastStudiedAt: set?.last_studied_at ?? null };
    const reviewId = id("review");
    await tx.execute({ sql: "UPDATE cards SET status = ?, due_at = ?, interval_days = ?, review_count = review_count + 1, correct_count = correct_count + ?, updated_at = ? WHERE id = ? AND user_id = ?", args: [schedule.status, new Date(schedule.dueAtMs).toISOString(), schedule.intervalDays, schedule.correctDelta, now, cardId, userId] });
    await tx.execute({ sql: "INSERT INTO review_logs (id,user_id,card_id,session_id,rating,response_ms,reviewed_at,previous_state,operation_id) VALUES (?,?,?,?,?,?,?,?,?)", args: [reviewId, userId, cardId, sessionId, rating, Number.isFinite(responseMs) ? Math.max(0, Math.min(responseMs, 3_600_000)) : 0, now, JSON.stringify(previous), operation?.operationId ?? null] });
    await tx.execute({ sql: "UPDATE card_sets SET last_studied_at = ?, updated_at = ?, next_review_at = (SELECT MIN(due_at) FROM cards WHERE set_id = ? AND user_id = ? AND status NOT IN ('アーカイブ', '削除済み')) WHERE id = ? AND user_id = ?", args: [now, now, setId, userId, setId, userId] });
    await completeFirstLearning(tx, userId, sessionId, now);
    await reconcileStudy(tx, userId, sessionId, now);
    return reviewId;
  });
}

export async function undoReview(userId: string, reviewId: string, sessionId: string): Promise<void> {
  await ensureDatabase();
  await database().transaction(async (tx) => {
    const review = (await tx.execute({ sql: "SELECT rowid AS sequence, * FROM review_logs WHERE id = ? AND user_id = ? AND session_id = ?", args: [reviewId, userId, sessionId] })).rows[0];
    if (!review?.previous_state) throw new Error("UNDO_NOT_AVAILABLE");
    const newer = (await tx.execute({ sql: "SELECT id FROM review_logs WHERE user_id = ? AND rowid > ? AND undone_at IS NULL LIMIT 1", args: [userId, review.sequence] })).rows[0];
    if (newer) throw new Error("UNDO_NOT_AVAILABLE");
    if (review.undone_at) return; // Retrying the same request never rolls back twice.
    const card = (await tx.execute({ sql: "SELECT * FROM cards WHERE id = ? AND user_id = ?", args: [review.card_id, userId] })).rows[0];
    if (!card || ["削除済み", "アーカイブ"].includes(String(card.status))) throw new Error("UNDO_NOT_AVAILABLE");
    const previous = JSON.parse(String(review.previous_state)) as { status: string; dueAt: string; intervalDays: number; reviewCount: number; correctCount: number; lastStudiedAt: string | null };
    if (Number(card.review_count) !== previous.reviewCount + 1) throw new Error("UNDO_NOT_AVAILABLE");
    const now = new Date().toISOString();
    await tx.execute({ sql: "UPDATE review_logs SET undone_at = ? WHERE id = ? AND user_id = ?", args: [now, reviewId, userId] });
    await tx.execute({ sql: "UPDATE cards SET status = ?, due_at = ?, interval_days = ?, review_count = ?, correct_count = ?, updated_at = ? WHERE id = ? AND user_id = ?", args: [previous.status, previous.dueAt, previous.intervalDays, previous.reviewCount, previous.correctCount, now, review.card_id, userId] });
    await tx.execute({ sql: "UPDATE card_sets SET last_studied_at = ?, updated_at = ?, next_review_at = (SELECT MIN(due_at) FROM cards WHERE set_id = ? AND user_id = ? AND status NOT IN ('アーカイブ', '削除済み')) WHERE id = ? AND user_id = ?", args: [previous.lastStudiedAt, now, card.set_id, userId, card.set_id, userId] });
    const { day, start, end } = studyDayBounds(new Date(String(review.reviewed_at)));
    await tx.execute({ sql: `UPDATE daily_review_plans SET completed_at = NULL WHERE user_id = ? AND day = ? AND EXISTS (
      SELECT 1 FROM json_each(daily_review_plans.card_ids) assignment JOIN cards c ON c.id = assignment.value AND c.user_id = daily_review_plans.user_id
      WHERE c.status NOT IN ('削除済み', 'アーカイブ') AND c.id NOT IN (SELECT card_id FROM review_logs WHERE user_id = ? AND reviewed_at >= ? AND reviewed_at < ? AND rating IN ('good','easy') AND undone_at IS NULL)
    )`, args: [userId, day, userId, start, end] });
    await reconcileStudy(tx,userId,sessionId,now);
  });
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
  if (!setId || !cardId || !sessionId) throw new Error("CARD_NOT_FOUND");
  await loadAiCardContext(userId, setId, cardId, sessionId);
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

export async function manageMaterial(userId: string, input: {
  action: string; cardId?: string; setId?: string; title?: string;
  question?: string; answer?: string; choices?: string[];
}): Promise<void> {
  await ensureDatabase();
  const db = database();
  const now = new Date().toISOString();
  if (input.action === "renameSet") {
    const result = await db.prepare("UPDATE card_sets SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .bind(input.title, now, input.setId, userId).run();
    if (!result.meta.changes) throw new Error("SET_NOT_FOUND");
    return;
  }
  const card = await db.prepare("SELECT * FROM cards WHERE id = ? AND user_id = ?").bind(input.cardId, userId).first<Record<string, unknown>>();
  if (!card) throw new Error("CARD_NOT_FOUND");
  let statement;
  if (input.action === "editCard") {
    const choices = input.choices || [];
    if (card.format === "multiple_choice" && (choices.length !== 4 || new Set(choices).size !== 4 || !choices.every(Boolean) || !choices.includes(input.answer || ""))) throw new Error("INVALID_CHOICES");
    statement = db.prepare("UPDATE cards SET question = ?, answer = ?, choices = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .bind(input.question, input.answer, JSON.stringify(card.format === "multiple_choice" ? choices : []), now, input.cardId, userId);
  } else {
    const restored = Number(card.interval_days) >= 14 ? "定着中" : Number(card.interval_days) > 0 ? "復習待ち" : Number(card.review_count) > 0 ? "苦手" : "未学習";
    const status = input.action === "deleteCard" ? "削除済み" : input.action === "archiveCard" ? "アーカイブ" : restored;
    statement = db.prepare("UPDATE cards SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(status, now, input.cardId, userId);
  }
  await db.batch([
    statement,
    db.prepare("UPDATE card_sets SET updated_at = ? WHERE id = ? AND user_id = ?").bind(now, card.set_id, userId),
  ]);
  await db.prepare("UPDATE card_sets SET next_review_at = (SELECT MIN(due_at) FROM cards WHERE set_id = ? AND user_id = ? AND status NOT IN ('アーカイブ', '削除済み')) WHERE id = ? AND user_id = ?")
    .bind(card.set_id, userId, card.set_id, userId).run();
}

async function requireFolder(userId: string, folderId: string | null): Promise<void> {
  if (folderId === null) return;
  const folder = await database().prepare("SELECT id FROM folders WHERE id = ? AND user_id = ?").bind(folderId, userId).first();
  if (!folder) throw new Error("FOLDER_NOT_FOUND");
}

export async function organizeSets(userId: string, input: {
  action: "createFolder" | "renameFolder" | "moveSet";
  folderId: string | null; setId?: string; name?: string;
}): Promise<string | null> {
  const db = database();
  await requireFolder(userId, input.folderId);
  const now = new Date().toISOString();
  if (input.action === "createFolder") {
    const folderId = id("folder");
    await db.prepare("INSERT INTO folders (id, user_id, parent_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(folderId, userId, input.folderId, input.name, now, now).run();
    return folderId;
  }
  if (input.action === "renameFolder") {
    if (!input.folderId) throw new Error("FOLDER_NOT_FOUND");
    await db.prepare("UPDATE folders SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(input.name, now, input.folderId, userId).run();
  } else {
    const result = await db.prepare("UPDATE card_sets SET folder_id = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(input.folderId, now, input.setId, userId).run();
    if (!result.meta.changes) throw new Error("SET_NOT_FOUND");
  }
  return input.folderId;
}

export async function loadDailyReview(userId: string, now = new Date()): Promise<DailyReview> {
  const db = database();
  const { day, start, end } = studyDayBounds(now);
  const intro = await db.prepare("SELECT initial_card_ids, first_learning_completed_at FROM user_profiles WHERE user_id = ? AND initial_set_id IS NOT NULL").bind(userId).first<{initial_card_ids:string;first_learning_completed_at:string|null}>();
  // Freeze the day's assignment so completed sets do not disappear as due dates advance.
  let plan = await db.prepare("SELECT card_ids, completed_at FROM daily_review_plans WHERE user_id = ? AND day = ?")
    .bind(userId, day).first<{ card_ids: string; completed_at: string | null }>();
  if (!plan) {
    const candidates = await db.prepare(`SELECT id FROM cards WHERE user_id = ? AND status NOT IN ('アーカイブ', '削除済み') AND
      ((interval_days < 60 AND due_at < ?) OR (interval_days <= 60 AND id IN (SELECT card_id FROM review_logs WHERE user_id = ? AND reviewed_at >= ? AND reviewed_at < ? AND rating IN ('good','easy') AND undone_at IS NULL)))
      ORDER BY due_at, id`).bind(userId, end, userId, start, end).all<{ id: string }>();
    const ids = intro && !intro.first_learning_completed_at ? parseJsonArray(intro.initial_card_ids) : (candidates.results || []).map((c) => c.id);
    if (ids.length) {
      await db.prepare("INSERT OR IGNORE INTO daily_review_plans (user_id, day, card_ids) VALUES (?, ?, ?)").bind(userId, day, JSON.stringify(ids)).run();
      plan = await db.prepare("SELECT card_ids, completed_at FROM daily_review_plans WHERE user_id = ? AND day = ?").bind(userId, day).first<{ card_ids: string; completed_at: string | null }>();
    }
  }
  const active = await db.prepare("SELECT id FROM cards WHERE user_id = ? AND status NOT IN ('アーカイブ', '削除済み')").bind(userId).all<{ id: string }>();
  const activeIds = new Set((active.results || []).map((c) => c.id));
  const cardIds = plan ? parseJsonArray(plan.card_ids).filter((id) => activeIds.has(id)) : [];
  const successes = await db.prepare("SELECT DISTINCT card_id FROM review_logs WHERE user_id = ? AND reviewed_at >= ? AND reviewed_at < ? AND (rating IN ('good', 'easy') OR session_id = (SELECT initial_session_id FROM user_profiles WHERE user_id = ?)) AND undone_at IS NULL")
    .bind(userId, start, end, userId).all<{ card_id: string }>();
  const successfulIds = new Set((successes.results || []).map((r) => r.card_id));
  if (intro?.first_learning_completed_at && intro.first_learning_completed_at >= start && intro.first_learning_completed_at < end) for (const id of parseJsonArray(intro.initial_card_ids)) successfulIds.add(id);
  const completedCardIds = cardIds.filter((id) => successfulIds.has(id));
  const completed = Boolean(plan?.completed_at) || (cardIds.length > 0 && completedCardIds.length === cardIds.length);
  if (completed && !plan?.completed_at) await db.prepare("UPDATE daily_review_plans SET completed_at = ? WHERE user_id = ? AND day = ? AND completed_at IS NULL").bind(now.toISOString(), userId, day).run();
  const history = await db.prepare("SELECT day FROM daily_review_plans WHERE user_id = ? AND completed_at IS NOT NULL AND day <= ? ORDER BY day DESC").bind(userId, day).all<{ day: string }>();
  const achievedDays = (history.results || []).map((row) => row.day);
  return { day, cardIds, completedCardIds, completed, achievedDays: achievedDays.slice(0, 60), streak: streakLength(achievedDays, now) };
}

export async function loadProfile(userId: string): Promise<UserProfile> {
  await ensureDatabase();
  const db = database();
  await db.prepare(`INSERT OR IGNORE INTO user_profiles (user_id, onboarding_completed)
    SELECT ?, CASE WHEN EXISTS (SELECT 1 FROM card_sets WHERE user_id = ?)
      OR EXISTS (SELECT 1 FROM review_logs WHERE user_id = ?) OR EXISTS (SELECT 1 FROM folders WHERE user_id = ?)
      OR EXISTS (SELECT 1 FROM sources WHERE user_id = ?) THEN 1 ELSE 0 END`).bind(userId,userId,userId,userId,userId).run();
  const row = await db.prepare('SELECT * FROM user_profiles WHERE user_id = ?').bind(userId).first<Record<string,unknown>>();
  if (!row) throw new Error('PROFILE_NOT_FOUND');
  return { displayName: String(row.display_name), interests: parseJsonArray(row.interests), learningGoal: String(row.learning_goal), onboardingCompleted: Boolean(row.onboarding_completed), onboardingCompletedAt: row.onboarding_completed_at ? String(row.onboarding_completed_at) : null, initialSetId: row.initial_set_id ? String(row.initial_set_id) : null, initialCardIds: parseJsonArray(row.initial_card_ids), initialSessionId: row.initial_session_id ? String(row.initial_session_id) : null, firstLearningCompletedAt: row.first_learning_completed_at ? String(row.first_learning_completed_at) : null };
}

export async function updateOnboarding(userId: string, input: Record<string,unknown>): Promise<void> {
  await loadProfile(userId);
  await database().transaction(async tx => {
    const row = (await tx.execute({sql:'SELECT * FROM user_profiles WHERE user_id = ?',args:[userId]})).rows[0];
    if (row.onboarding_completed) return;
    const now = new Date().toISOString();
    if (input.step === 'finish') {
      if (!row.first_learning_completed_at) throw new InputError('まず3枚の学習を終えてください。',409);
      await tx.execute({sql:'UPDATE user_profiles SET onboarding_completed = 1, onboarding_completed_at = ? WHERE user_id = ?',args:[now,userId]});
      return;
    }
    if (row.initial_set_id) return; // Double taps/retries cannot adopt another preset.
    if (input.step === 'name') {
      if (typeof input.displayName !== 'string' || !input.displayName.trim() || input.displayName.trim().length > 60) throw new InputError('名前を1〜60文字で入力してください。');
      await tx.execute({sql:'UPDATE user_profiles SET display_name = ? WHERE user_id = ?',args:[input.displayName.trim(),userId]});
    } else if (input.step === 'interests') {
      if (!row.display_name || !validInterests(input.interests)) throw new InputError('興味を3つ選んでください。');
      await tx.execute({sql:'UPDATE user_profiles SET interests = ?, learning_goal = ? WHERE user_id = ?',args:[JSON.stringify(input.interests),'',userId]});
    } else if (input.step === 'goal') {
      if (!validInterests(parseJsonArray(row.interests)) || typeof input.learningGoal !== 'string' || !GOALS.includes(input.learningGoal)) throw new InputError('学習目的を1つ選んでください。');
      await tx.execute({sql:'UPDATE user_profiles SET learning_goal = ? WHERE user_id = ?',args:[input.learningGoal,userId]});
    } else if (input.step === 'select') {
      const choices = recommend(parseJsonArray(row.interests),String(row.learning_goal));
      const preset = PRESETS.find(p => p.id === input.presetId && choices.some(c=>c.preset.id===p.id));
      if (!row.learning_goal || !preset) throw new InputError('おすすめからセットを選んでください。');
      const {setId,statements} = materialStatements(database(),userId,preset,now);
      for (const statement of statements) await tx.execute({sql:statement.sql,args:statement.args});
      // Material statements preserve the preset order. Store exact IDs rather than relying on random-ID sorting.
      const cardRows = (await tx.execute({sql:'SELECT id FROM cards WHERE set_id = ? AND user_id = ? ORDER BY rowid LIMIT 3',args:[setId,userId]})).rows;
      const cardIds = cardRows.map(r=>String(r.id));
      const sessionId = id('intro');
      await tx.execute({sql:'UPDATE user_profiles SET initial_set_id = ?, initial_card_ids = ?, initial_session_id = ? WHERE user_id = ?',args:[setId,JSON.stringify(cardIds),sessionId,userId]});
      const {day} = studyDayBounds(new Date(now));
      await tx.execute({sql:'INSERT OR IGNORE INTO daily_review_plans (user_id,day,card_ids) VALUES (?,?,?)',args:[userId,day,JSON.stringify(cardIds)]});
    } else throw new InputError('未対応の操作です。');
  });
}

async function completeFirstLearning(tx: import('@libsql/client').Transaction, userId: string, sessionId: string | null, now: string) {
  const profile = (await tx.execute({sql:'SELECT * FROM user_profiles WHERE user_id = ? AND initial_session_id = ? AND first_learning_completed_at IS NULL',args:[userId,sessionId]})).rows[0];
  if (!profile) return;
  const ids = parseJsonArray(profile.initial_card_ids);
  const answers = (await tx.execute({sql:'SELECT DISTINCT card_id FROM review_logs WHERE user_id = ? AND session_id = ? AND undone_at IS NULL',args:[userId,sessionId]})).rows.map(r=>String(r.card_id));
  if (ids.length !== 3 || !ids.every(id=>answers.includes(id))) return;
  await tx.execute({sql:'UPDATE user_profiles SET first_learning_completed_at = ? WHERE user_id = ? AND first_learning_completed_at IS NULL',args:[now,userId]});
  const {day} = studyDayBounds(new Date(now));
  await tx.execute({sql:'INSERT INTO daily_review_plans (user_id,day,card_ids,completed_at) VALUES (?,?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET completed_at = COALESCE(daily_review_plans.completed_at,excluded.completed_at)',args:[userId,day,JSON.stringify(ids),now]});
}
