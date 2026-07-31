/// <reference types="@cloudflare/workers-types" />

declare module "cloudflare:workers" {
  export const env: {
    DB?: D1Database;
    OPENAI_API_KEY?: string;
    OPENAI_CARD_MODEL?: string;
    OPENAI_CHAT_MODEL?: string;
  };
}
