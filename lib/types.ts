export type CardStatus = "未学習" | "復習待ち" | "定着中" | "苦手" | "アーカイブ";
export type ReviewRating = "again" | "hard" | "good" | "easy";
export type BinaryReviewRating = Extract<ReviewRating, "again" | "good">;

export type Card = {
  id: string;
  setId: string;
  question: string;
  answer: string;
  status: CardStatus;
  difficulty: number;
  dueAt: string;
  intervalDays: number;
  reviewCount: number;
  correctCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CardSet = {
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
  rating: ReviewRating;
  reviewedAt: string;
  responseMs: number;
};

export type ChatMessage = {
  id: string;
  setId: string | null;
  cardId: string | null;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type AppData = {
  sets: CardSet[];
  reviews: ReviewLog[];
  chatMessages: ChatMessage[];
};

export type GeneratedCard = {
  question: string;
  answer: string;
  difficulty: number;
};

export type GeneratedMaterial = {
  title: string;
  category: string;
  summary: string;
  keyPoints: string[];
  cards: GeneratedCard[];
};
