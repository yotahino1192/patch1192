import Foundation
import Capacitor
import UserNotifications
import WidgetKit

@MainActor enum RetentionLinks {
    static var pending: [[String: Any]] = []
    static func capture(_ url: URL, owner: String? = nil) {
        guard url.scheme == "patch" else { return }
        var link: [String: Any] = ["url": url.absoluteString, "at": Date().timeIntervalSince1970 * 1000]
        if let owner = owner ?? UserDefaults.standard.string(forKey: "patch.retention.owner") { link["owner"] = owner }
        pending = [link] // Latest user intent wins; never retain an unbounded queue.
    }
}
@objc(PatchRetentionPlugin)
public class PatchRetentionPlugin: CAPPlugin, CAPBridgedPlugin, UNUserNotificationCenterDelegate {
    public let identifier = "PatchRetentionPlugin"
    public let jsName = "PatchRetention"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "activate", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signedOut", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "publish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "permission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "links", returnType: CAPPluginReturnPromise)
    ]
    @MainActor private var generation = 0
    @MainActor private var owner: String? { UserDefaults.standard.string(forKey: "patch.retention.owner") }
    public override func load() { UNUserNotificationCenter.current().delegate = self }
    @MainActor private func removeNotifications() async {
        let center = UNUserNotificationCenter.current()
        let pending = await center.pendingNotificationRequests().filter { $0.identifier.hasPrefix("patch-retention-") }.map(\.identifier)
        center.removePendingNotificationRequests(withIdentifiers: pending)
        let delivered = await center.deliveredNotifications().filter { $0.request.identifier.hasPrefix("patch-retention-") }.map { $0.request.identifier }
        center.removeDeliveredNotifications(withIdentifiers: delivered)
    }
    @objc func activate(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let user = call.getString("userId"), !user.isEmpty else { call.reject("INVALID_OWNER"); return }
            if owner != user {
                generation += 1
                UserDefaults.standard.removeObject(forKey: "patch.retention.owner")
            UserDefaults.standard.removeObject(forKey: "patch.retention.scheduled")
                await removeNotifications()
                do { try RetentionStore.clear() } catch { call.reject("CLEANUP_PENDING"); return }
                WidgetCenter.shared.reloadAllTimelines()
                RetentionLinks.pending.removeAll { ($0["owner"] as? String).map { $0 != user } ?? false }
                UserDefaults.standard.set(user, forKey: "patch.retention.owner")
            }
            call.resolve()
        }
    }
    @objc func clear(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let user = call.getString("userId"), owner == user else { call.resolve(); return }
            generation += 1
            // Keep the owner until cleanup succeeds so durable cleanup retries can finish it.
            await removeNotifications()
            do { try RetentionStore.clear() } catch { call.reject("CLEANUP_PENDING"); return }
            RetentionLinks.pending.removeAll()
            UserDefaults.standard.removeObject(forKey: "patch.retention.owner")
            UserDefaults.standard.removeObject(forKey: "patch.retention.scheduled")
            WidgetCenter.shared.reloadAllTimelines()
            call.resolve()
        }
    }
    @objc func signedOut(_ call: CAPPluginCall) {
        Task { @MainActor in
            generation += 1
            await removeNotifications()
            do { try RetentionStore.clear() } catch { call.reject("CLEANUP_PENDING"); return }
            RetentionLinks.pending.removeAll { $0["owner"] != nil }
            UserDefaults.standard.removeObject(forKey: "patch.retention.owner")
            UserDefaults.standard.removeObject(forKey: "patch.retention.scheduled")
            WidgetCenter.shared.reloadAllTimelines()
            call.resolve()
        }
    }
    @objc func publish(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let user = call.getString("userId"), owner == user, let object = call.getObject("snapshot"),
                  let data = try? JSONSerialization.data(withJSONObject: object),
                  let snapshot = try? JSONDecoder().decode(RetentionSnapshot.self, from: data), snapshot.version == 1,
                  snapshot.dueCount >= 0, snapshot.streak >= 0 else { call.reject("INVALID_SNAPSHOT"); return }
            let ticket = generation
            let center = UNUserNotificationCenter.current()
            let pending = await center.pendingNotificationRequests().filter { $0.identifier.hasPrefix("patch-retention-") }.map(\.identifier)
            guard owner == user, ticket == generation else { call.resolve(); return }
            center.removePendingNotificationRequests(withIdentifiers: pending)
            var groupAvailable = true
            do { try RetentionStore.write(snapshot); WidgetCenter.shared.reloadAllTimelines() } catch { groupAvailable = false }
            let settings = await center.notificationSettings()
            guard owner == user, ticket == generation else { call.resolve(); return }
            if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
                var ledger = (UserDefaults.standard.dictionary(forKey: "patch.retention.scheduled") as? [String: Double] ?? [:]).filter { $0.key == "review-\(snapshot.day)" || $0.key == "streak-\(snapshot.day)" }
                for item in call.getArray("notifications", JSObject.self) ?? [] {
                    guard let id = item["id"] as? String, let at = item["at"] as? Double,
                          let url = item["url"] as? String, ["patch://continue", "patch://review/today"].contains(url),
                          let title = item["title"] as? String, at > Date().timeIntervalSince1970 * 1000, at < snapshot.dayEnd else { continue }
                    guard RetentionNotificationLedger.maySchedule(previous: ledger[id], now: Date().timeIntervalSince1970 * 1000) else { continue }
                    let content = UNMutableNotificationContent()
                    content.title = "Patch"; content.body = title; content.sound = .default
                    content.userInfo = ["url": url, "owner": user]
                    let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1, at / 1000 - Date().timeIntervalSince1970), repeats: false)
                    do { try await center.add(UNNotificationRequest(identifier: "patch-retention-" + id, content: content, trigger: trigger)) } catch { call.reject("NOTIFICATION_SYNC_FAILED"); return }
                    ledger[id] = at
                    UserDefaults.standard.set(ledger, forKey: "patch.retention.scheduled")
                    if owner != user || ticket != generation { center.removePendingNotificationRequests(withIdentifiers: ["patch-retention-" + id]); call.resolve(); return }
                }
            }
            call.resolve(["appGroupAvailable": groupAvailable])
        }
    }
    @objc func permission(_ call: CAPPluginCall) {
        Task { do { let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]); call.resolve(["granted": granted]) } catch { call.reject("PERMISSION_FAILED") } }
    }
    @objc func links(_ call: CAPPluginCall) { Task { @MainActor in let links = RetentionLinks.pending; RetentionLinks.pending.removeAll(); call.resolve(["links": links]) } }
    public func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        let info = response.notification.request.content.userInfo
        Task { @MainActor in
            if let raw = info["url"] as? String, let url = URL(string: raw), let user = info["owner"] as? String, user == owner { RetentionLinks.capture(url, owner: user) }
            completionHandler()
        }
    }
}
