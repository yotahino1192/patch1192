import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { NativeAuth } from "../lib/auth-platform";
import type { Identity } from "../lib/account-scope";

type Snapshot = { identity: Identity | null };
interface AuthPlugin {
  appInfo():Promise<{version:string;build:string}>;
  reauthenticate(options:{sessionId:string;code?:string}):Promise<void>;
  initialize(options: { publishableKey: string }): Promise<Snapshot>;
  getSession(): Promise<Snapshot>;
  getToken(options: { sessionId: string }): Promise<{ token: string | null }>;
  startEmail(options: { email: string; signUp: boolean }): Promise<void>;
  verifyEmail(options: { code: string; signUp: boolean }): Promise<Snapshot>;
  signOut(options: { sessionId: string; deleting?:boolean }): Promise<void>;
  addListener(name: "sessionChanged", listener: (value: Snapshot) => void): Promise<PluginListenerHandle>;
}
const plugin = registerPlugin<AuthPlugin>("PatchAuth");
export function createNativeAuth(publishableKey: string): NativeAuth {
  return {
    appInfo:()=>plugin.appInfo(),
    reauthenticate: (sessionId,code)=>plugin.reauthenticate({sessionId,code}),
    initialize: async () => (await plugin.initialize({ publishableKey })).identity,
    getSession: async () => (await plugin.getSession()).identity,
    getToken: async sessionId => (await plugin.getToken({ sessionId })).token,
    startEmail: (email, signUp) => plugin.startEmail({ email, signUp }),
    verifyEmail: async (code, signUp) => (await plugin.verifyEmail({ code, signUp })).identity,
    signOut: async (sessionId,deleting) => {await plugin.signOut({sessionId,deleting});if(deleting)location.reload();},
    subscribe(listener) {
      let active = true;
      const handle = plugin.addListener("sessionChanged", result => { if (active) listener(result.identity); });
      return () => { active = false; void handle.then(value => value.remove()); };
    },
  };
}
