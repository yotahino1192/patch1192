export type CardStatus = "未学習" | "復習待ち" | "定着中" | "苦手" | "アーカイブ" | "削除済み";
export type ReviewRating = "again" | "hard" | "good" | "easy";
export type BinaryReviewRating = Extract<ReviewRating, "again" | "good">;
export type CardFormat = "qa" | "multiple_choice" | "self_explain";

export type Card = {
  id: string;
  setId: string;
  question: string;
  answer: string;
  format: CardFormat;
  choices: string[];
  status: CardStatus;
  difficulty: number;
  dueAt: string;
  intervalDays: number;
  reviewCount: number;
  correctCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Folder = {
  id: string;
  parentId: string | null;
  name: string;
};

export type CardSet = {
  folderId: string | null;
  id: string;
  title: string;
  category: string;
  summary: string;
  keyPoints: string[];
  sourceContent: string;
  createdAt: string;
  updatedAt: string;
  lastStudiedAt: string | null;
  nextReviewAt: string | null;
  cards: Card[];
};

export type ReviewLog = {
  id: string;
  cardId: string;
  sessionId: string | null;
  rating: ReviewRating;
  reviewedAt: string;
  responseMs: number;
};

export type ChatMessage = {
  id: string;
  setId: string | null;
  cardId: string | null;
  sessionId: string | null;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type DailyReview = {
  day: string;
  cardIds: string[];
  completedCardIds: string[];
  completed: boolean;
  achievedDays: string[];
  streak: number;
};

export type AppData = {
  undoneReviewIds?: string[];
  recordActivity?: { day: string; cards: number }[];
  dailyReview: DailyReview;
  folders: Folder[];
  sets: CardSet[];
  reviews: ReviewLog[];
  chatMessages: ChatMessage[];
};

export type GeneratedCard = {
  question: string;
  answer: string;
  difficulty: number;
  format: CardFormat;
  choices: string[];
};

export type GeneratedMaterial = {
  title: string;
  category: string;
  summary: string;
  keyPoints: string[];
  cards: GeneratedCard[];
};
