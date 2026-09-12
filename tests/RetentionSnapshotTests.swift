import Foundation
@main struct RetentionSnapshotTests {
 static func main() throws {
  let now = Date(timeIntervalSince1970: 100000)
  func snapshot(_ completed: Bool = false, _ broken: Bool = false, _ streak: Int = 3) -> RetentionSnapshot {
   RetentionSnapshot(version: 1, generatedAt: 100000000, expiresAt: 150000000, day: 2, dayEnd: 136000000, timezone: "UTC", streak: streak, hot: streak >= 5, completed: completed, broken: broken, dueCount: 8)
  }
  precondition(snapshot().state(at: now) == "NORMAL")
  precondition(snapshot().state(at: now.addingTimeInterval(4*3600)) == "AT_RISK")
  precondition(snapshot().state(at: now.addingTimeInterval(7*3600)) == "LAST_CHANCE")
  precondition(snapshot(true).state(at: now) == "COMPLETED")
  precondition(snapshot(false, true, 0).state(at: now) == "BROKEN")
  precondition(snapshot(false, false, 0).state(at: now) == "NEW_USER")
  precondition(snapshot().state(at: now.addingTimeInterval(10*3600)) == "STALE")
  let data = try JSONEncoder().encode(snapshot())
  let decoded = try JSONDecoder().decode(RetentionSnapshot.self, from: data)
  precondition(decoded.dueCount == 8)
  precondition(!RetentionNotificationLedger.maySchedule(previous: 1000, now: 2000))
  precondition(RetentionNotificationLedger.maySchedule(previous: 3000, now: 2000))
  precondition(RetentionNotificationLedger.maySchedule(previous: nil, now: 2000))
  print("PASS: Swift Widget states, threshold parity, stale deadline, Codable snapshot round-trip")
 }
}
