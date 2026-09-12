"use client";
import { PrivacyContext } from "./privacy-provider";
import { createContext, useContext } from "react";
import type { AccountScope } from "../lib/account-scope";
import type { ApiTransport } from "../lib/api-client";

export const AccountContext = createContext<{ scope: AccountScope; logout: (deleting?:boolean) => Promise<void>; email?: string; reauthenticate?: (code?: string) => Promise<void> } | null>(null);
export function useAccount() { return useContext(AccountContext); }
export function useApiFetch(): ApiTransport {
  const account = useAccount();
  const privacy = useContext(PrivacyContext);
  return privacy?.request ?? account?.scope.request ?? (() => Promise.reject(new Error("ログインしてください。")));
}
