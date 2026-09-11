"use client";
import { createContext, useContext } from "react";
import type { AccountScope } from "../lib/account-scope";
import type { ApiTransport } from "../lib/api-client";

export const AccountContext = createContext<{ scope: AccountScope; logout: () => Promise<void> } | null>(null);
export function useAccount() { return useContext(AccountContext); }
export function useApiFetch(): ApiTransport {
  const account = useAccount();
  return account?.scope.request ?? (() => Promise.reject(new Error("ログインしてください。")));
}
