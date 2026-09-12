import type { Identity } from "./account-scope";

export interface NativeAuth {
  appInfo?():Promise<{version:string;build:string}>;
  initialize(): Promise<Identity | null>;
  getSession(): Promise<Identity | null>;
  getToken(sessionId: string): Promise<string | null>;
  startEmail(email: string, signUp: boolean): Promise<void>;
  verifyEmail(code: string, signUp: boolean): Promise<Identity | null>;
  signOut(sessionId: string, deleting?:boolean): Promise<void>;
  reauthenticate?(sessionId:string,code?:string):Promise<void>;
  subscribe(listener: (identity: Identity | null) => void): () => void;
}
let nativeAuth: NativeAuth | undefined;
export function configureNativeAuth(auth: NativeAuth) { nativeAuth = auth; }
export function getNativeAuth() { return nativeAuth; }
