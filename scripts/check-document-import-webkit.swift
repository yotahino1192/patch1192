// macOS WKWebView regression runner; this is not an iPhone/device-picker test.
// Build scripts/build-document-import-fixture.mjs first. Only synthetic fixtures run.
import AppKit
import WebKit
let root = URL(fileURLWithPath: CommandLine.arguments[1]).standardizedFileURL
let page = CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "document-import-flow.html"
class Handler: NSObject, WKURLSchemeHandler, WKScriptMessageHandler {
    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        let path = task.request.url!.path
        let file = root.appendingPathComponent(path).standardizedFileURL
        guard file.path.hasPrefix(root.path + "/") else { task.didFailWithError(URLError(.badURL)); return }
        do {
            let data = try Data(contentsOf: file)
            let mime = path.hasSuffix(".html") ? "text/html" : path.hasSuffix(".js") || path.hasSuffix(".mjs") ? "text/javascript" : path.hasSuffix(".css") ? "text/css" : "application/octet-stream"
            task.didReceive(URLResponse(url: task.request.url!, mimeType: mime, expectedContentLength: data.count, textEncodingName: "utf-8"))
            task.didReceive(data); task.didFinish()
        } catch { task.didFailWithError(error) }
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let output = message.body as? String, let data = output.data(using: .utf8),
              let object = try? JSONSerialization.jsonObject(with: data),
              let rows = (object as? [String: Any])?["results"] as? [[String: Any]] ?? object as? [[String: Any]] else { exit(2) }
        print(output)
        let passed = rows.allSatisfy { row in
            if let ok = row["ok"] as? Bool { return ok }
            return ["accepted", "textMatches", "canContinue", "continued", "malformedRejected"].allSatisfy { row[$0] as? Bool == true }
        }
        exit(passed ? 0 : 1)
    }
}
let app = NSApplication.shared
let handler = Handler(), configuration = WKWebViewConfiguration()
configuration.setURLSchemeHandler(handler, forURLScheme: "capacitor")
configuration.userContentController.add(handler, name: "results")
let web = WKWebView(frame: NSRect(x: 0, y: 0, width: 390, height: 844), configuration: configuration)
let window = NSWindow(contentRect: web.frame, styleMask: [.titled], backing: .buffered, defer: false)
window.contentView = web
window.makeKeyAndOrderFront(nil)
web.load(URLRequest(url: URL(string: "capacitor://localhost/tests/fixtures/" + page)!))
DispatchQueue.main.asyncAfter(deadline: .now() + 60) { print("FIXTURE_TIMEOUT"); exit(1) }
app.run()
