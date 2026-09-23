"use client";
import { PrivacyContext } from "./privacy-provider";
import { createContext, useContext } from "react";
import type { AccountScope } from "../lib/account-scope";
import type { ApiTransport } from "../lib/api-client";
import { materialDataTransport } from '../lib/material-data-client';

export const AccountContext = createContext<{ scope: AccountScope; logout: (deleting?:boolean) => Promise<void>; email?: string; reauthenticate?: (code?: string) => Promise<void> } | null>(null);
export function useAccount() { return useContext(AccountContext); }
export function useApiFetch(): ApiTransport {
  const account = useAccount();
  const privacy = useContext(PrivacyContext);
  const request = privacy?.request ?? account?.scope.request;
  return request ? materialDataTransport(request, account?.scope.assertCurrent) : missingAccount;
}
const missingAccount: ApiTransport = () => Promise.reject(new Error('ログインしてください。'));
