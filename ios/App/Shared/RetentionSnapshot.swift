import Foundation

struct RetentionSnapshot: Codable {
    let version: Int
    let generatedAt: Double
    let expiresAt: Double
    let day: Int
    let dayEnd: Double
    let timezone: String
    let streak: Int
    let hot: Bool
    let completed: Bool
    let broken: Bool
    let dueCount: Int
    func state(at date: Date) -> String {
        let now = date.timeIntervalSince1970 * 1000
        if version != 1 || now >= expiresAt || now >= dayEnd { return "STALE" }
        if completed { return "COMPLETED" }
        if broken { return "BROKEN" }
        if streak == 0 { return "NEW_USER" }
        if dayEnd - now <= 3 * 3600000 { return "LAST_CHANCE" }
        if dayEnd - now <= 6 * 3600000 { return "AT_RISK" }
        return "NORMAL"
    }
}
enum RetentionStore {
    static let group = "group.com.patch.learning.retention"
    static var url: URL? { FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?.appendingPathComponent("retention-v1.json") }
    static func read() -> RetentionSnapshot? {
        guard let url, let data = try? Data(contentsOf: url), data.count < 4096 else { return nil }
        return try? JSONDecoder().decode(RetentionSnapshot.self, from: data)
    }
    static func write(_ snapshot: RetentionSnapshot) throws {
        guard let url else { throw NSError(domain: "PatchRetention", code: 1, userInfo: [NSLocalizedDescriptionKey: "APP_GROUP_UNAVAILABLE"]) }
        try JSONEncoder().encode(snapshot).write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
    static func clear() throws { if let url, FileManager.default.fileExists(atPath: url.path) { try FileManager.default.removeItem(at: url) } }
}

// A past scheduled instant is treated as delivered even if the user cleared the
// notification tray. Travel grace must never re-send the same day's warning.
enum RetentionNotificationLedger {
    static func maySchedule(previous: Double?, now: Double) -> Bool { previous.map { $0 > now } ?? true }
}
