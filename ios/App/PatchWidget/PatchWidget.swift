import SwiftUI
import WidgetKit

struct PatchEntry: TimelineEntry { let date: Date; let snapshot: RetentionSnapshot? }
struct PatchProvider: TimelineProvider {
    func placeholder(in context: Context) -> PatchEntry { PatchEntry(date: Date(), snapshot: nil) }
    func getSnapshot(in context: Context, completion: @escaping (PatchEntry) -> Void) { completion(PatchEntry(date: Date(), snapshot: RetentionStore.read())) }
    func getTimeline(in context: Context, completion: @escaping (Timeline<PatchEntry>) -> Void) {
        let now = Date(), snapshot = RetentionStore.read()
        var dates = [now]
        if let s = snapshot {
            dates += [s.dayEnd - 6 * 3600000, s.dayEnd - 3 * 3600000, s.expiresAt, s.dayEnd].map { Date(timeIntervalSince1970: $0 / 1000) }.filter { $0 > now }
        }
        completion(Timeline(entries: Array(Set(dates)).sorted().map { PatchEntry(date: $0, snapshot: snapshot) }, policy: .after(now.addingTimeInterval(1800))))
    }
}
struct PatchWidgetView: View {
    let entry: PatchEntry
    @Environment(\.widgetFamily) var family
    var state: String { entry.snapshot?.state(at: entry.date) ?? "SIGNED_OUT" }
    var urgent: Bool { state == "LAST_CHANCE" }
    var label: String {
        switch state {
        case "SIGNED_OUT": return "ログインして始めよう"
        case "NEW_USER": return "最初のPatchを作ろう"
        case "AT_RISK": return "今日のPatchを続けよう"
        case "LAST_CHANCE": return "あと3時間以内に1セット"
        case "COMPLETED": return "今日は達成！"
        case "BROKEN": return "今日からまた始めよう"
        case "STALE": return "アプリを開いて更新"
        default: return "毎日少しずつ"
        }
    }
    var body: some View {
        HStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Patch").font(.caption.bold())
                if state != "SIGNED_OUT" && state != "STALE" { Text("\(entry.snapshot?.streak ?? 0)日").font(.title.bold()) }
                Text(label).font(.caption).fixedSize(horizontal: false, vertical: true)
                if family == .systemMedium {
                    if state != "SIGNED_OUT" && state != "STALE" { Text("今日の復習 \(entry.snapshot?.dueCount ?? 0)枚").font(.subheadline.bold()) }
                    Text("続きから学習 ›").font(.caption.bold())
                }
            }
            Spacer(minLength: 0)
            Image("companion.jpeg").resizable().scaledToFit().frame(width: family == .systemMedium ? 64 : 36).clipShape(RoundedRectangle(cornerRadius: 12)).accessibilityLabel("Patchキャラクター")
        }
        .foregroundStyle(urgent ? Color(red: 0.45, green: 0.02, blue: 0.08) : Color(red: 0.04, green: 0.25, blue: 0.18))
        .containerBackground(urgent ? Color(red: 1, green: 0.83, blue: 0.85) : Color(red: 0.77, green: 0.96, blue: 0.87), for: .widget)
        .widgetURL(URL(string: "patch://continue"))
    }
}
@main struct PatchWidget: Widget {
    let kind = "PatchRetention"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PatchProvider()) { PatchWidgetView(entry: $0) }
            .configurationDisplayName("Patch").description("Streakと今日の復習").supportedFamilies([.systemSmall, .systemMedium])
    }
}
