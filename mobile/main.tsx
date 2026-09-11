import { createRoot } from "react-dom/client";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import Patch from "../app/page";
import { configureApi } from "../lib/api-client";
import "../app/globals.css";
import "./fonts.css";

declare const __PATCH_API_URL__: string;

// Only JSON APIs cross the bridge; assets/PDF workers use the local WebView.
if (Capacitor.isNativePlatform()) {
  configureApi(__PATCH_API_URL__, async (url, options = {}) => {
    if (options.body != null && typeof options.body !== "string") {
      throw new Error("Native API transport supports JSON string bodies only.");
    }
    const result = await CapacitorHttp.request({
      url,
      method: options.method ?? "GET",
      headers: Object.fromEntries(new Headers(options.headers).entries()),
      data: options.body == null ? undefined : JSON.parse(options.body),
      responseType: "json",
      connectTimeout: 15000,
      readTimeout: 65000,
    });
    return new Response(typeof result.data === "string" ? result.data : JSON.stringify(result.data), {
      status: result.status,
      headers: result.headers,
    });
  });
}
// Browser development uses Vite's /api proxy; web Next.js remains same-origin.
createRoot(document.getElementById("root")!).render(<Patch />);
