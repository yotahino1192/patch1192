import SwiftUI
import WidgetKit
import UIKit
import OSLog

struct PatchEntry: TimelineEntry { let date: Date; let snapshot: RetentionSnapshot? }
struct PatchProvider: TimelineProvider {
    func placeholder(in context: Context) -> PatchEntry {
        PatchWidgetResources.audit(path: "placeholder")
        return PatchEntry(date: Date(), snapshot: nil)
    }
    func getSnapshot(in context: Context, completion: @escaping (PatchEntry) -> Void) {
        PatchWidgetResources.audit(path: "snapshot")
        completion(PatchEntry(date: Date(), snapshot: RetentionStore.read()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<PatchEntry>) -> Void) {
        PatchWidgetResources.audit(path: "timeline")
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
        if family == .systemSmall {
            PatchSmallWidgetView(entry: entry)
                .widgetURL(URL(string: "patch://continue"))
        } else {
            mediumBody
        }
    }
    // Keep the existing Medium composition, copy, fonts and margins unchanged.
    private var mediumBody: some View {
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
            if let companion = PatchWidgetResources.image(named: "companion.jpeg") {
                Image(uiImage: companion).resizable().scaledToFit().frame(width: family == .systemMedium ? 64 : 36).clipShape(RoundedRectangle(cornerRadius: 12)).accessibilityLabel("Patchキャラクター")
            }
        }
        .foregroundStyle(urgent ? Color(red: 0.45, green: 0.02, blue: 0.08) : Color(red: 0.04, green: 0.25, blue: 0.18))
        .containerBackground(urgent ? Color(red: 1, green: 0.83, blue: 0.85) : Color(red: 0.77, green: 0.96, blue: 0.87), for: .widget)
        .widgetURL(URL(string: "patch://continue"))
    }
}
// Presentation only: the authoritative eight-state resolver stays in RetentionSnapshot.
enum PatchSmallArtwork: String, CaseIterable {
    case normal = "widget-normal"
    case risk = "widget-risk"
    case urgent = "widget-urgent"
    case complete = "widget-complete"
    case restart = "widget-restart"

    init(state: String) {
        switch state {
        case "AT_RISK": self = .risk
        case "LAST_CHANCE": self = .urgent
        case "COMPLETED": self = .complete
        case "BROKEN": self = .restart
        default: self = .normal // SIGNED_OUT, NEW_USER, STALE and NORMAL
        }
    }
}

struct PatchSmallPresentation {
    let state: String
    let streak: Int?
    let japanese: Bool

    init(entry: PatchEntry, locale: Locale) {
        state = entry.snapshot?.state(at: entry.date) ?? "SIGNED_OUT"
        // An expired or absent snapshot cannot claim a current streak.
        streak = state == "SIGNED_OUT" || state == "STALE" ? nil : entry.snapshot?.streak
        japanese = locale.language.languageCode?.identifier == "ja"
    }

    var artwork: PatchSmallArtwork { PatchSmallArtwork(state: state) }
    var streakText: String { streak.map(String.init) ?? "—" }
    var numberFont: String { japanese ? "RoundedMplus1c-Bold" : "NunitoSans-Bold" }
    // This is the actual PostScript name in @fontsource/noto-sans-jp 400.
    var messageFont: String { japanese ? "NotoSansJPThin-Regular" : "Inter-Regular" }
    var message: String {
        switch state {
        case "SIGNED_OUT": return japanese ? "ログインしよう" : "Sign in to start"
        case "NEW_USER": return japanese ? "最初のPatchを" : "Create a Patch"
        case "AT_RISK": return japanese ? "そろそろ学ぼう！" : "Time to practice!"
        case "LAST_CHANCE": return japanese ? "今がチャンス！" : "Last chance!"
        case "COMPLETED": return japanese ? "今日は達成！" : "Done for today!"
        case "BROKEN": return japanese ? "また始めよう！" : "Let’s start again!"
        case "STALE": return japanese ? "開いて更新" : "Open to refresh"
        default: return japanese ? "その調子！" : "Keep it going!"
        }
    }
    var streakAccessibilityLabel: String {
        guard let streak else { return japanese ? "連続学習日数は未確認" : "Current streak unavailable" }
        return japanese ? "連続学習 \(streak)日" : "\(streak) day streak"
    }
}

struct PatchSmallWidgetView: View {
    let entry: PatchEntry
    @Environment(\.locale) private var locale
    @Environment(\.showsWidgetContainerBackground) private var showsBackground

    var body: some View {
        let presentation = PatchSmallPresentation(entry: entry, locale: locale)
        PatchSmallHeader(presentation: presentation)
            .foregroundStyle(showsBackground ? PatchSmallArtworkBackground.ink : Color.primary)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            // Backgrounds already extend to the tile edges; system text margins remain intact.
            .containerBackground(for: .widget) {
                PatchSmallArtworkBackground(artwork: presentation.artwork)
            }
    }
}

struct PatchSmallHeader: View {
    let presentation: PatchSmallPresentation

    var body: some View {
        VStack(spacing: 2) {
            HStack(spacing: 5) {
                Image(systemName: "flame.fill")
                    .font(.system(size: 16, weight: .bold))
                    .accessibilityHidden(true)
                Text(presentation.streakText)
                    .font(PatchWidgetResources.font(named: presentation.numberFont, size: 20, isNumber: true))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(presentation.streakAccessibilityLabel)
            Text(presentation.message)
                .font(PatchWidgetResources.font(named: presentation.messageFont, size: 14))
                .lineLimit(1)
                .minimumScaleFactor(0.85)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
    }
}

struct PatchSmallArtworkBackground: View {
    let artwork: PatchSmallArtwork
    static let ink = Color(red: 0.04, green: 0.25, blue: 0.18)

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .top) {
                if let image = PatchWidgetResources.image(named: artwork.rawValue) {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                        .frame(width: geometry.size.width, height: geometry.size.height)
                    // A restrained top veil keeps the same dark text readable across future palettes.
                    LinearGradient(stops: [
                        .init(color: .white.opacity(0.94), location: 0),
                        .init(color: .white.opacity(0.88), location: 0.36),
                        .init(color: .clear, location: 0.58)
                    ], startPoint: .top, endPoint: .bottom)
                } else {
                    // Reuse the unmodified, white-backed companion. No stand-in final artwork.
                    Color.white
                    if let companion = PatchWidgetResources.image(named: "companion.jpeg") {
                        Image(uiImage: companion)
                            .resizable()
                            .scaledToFit()
                            .frame(width: geometry.size.width * 0.98)
                            .offset(y: geometry.size.height * 0.40)
                    }
                }
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
            .clipped()
        }
        .accessibilityHidden(true)
    }
}

// WidgetKit archives the bitmap, not its SwiftUI frame. Keep original assets in the
// catalog, but hand the remote renderer a bounded bitmap (including the fallback).
enum PatchWidgetResources {
    static let maximumImagePixels: CGFloat = 600
    private static let images = NSCache<NSString, UIImage>()

    static func image(named name: String) -> UIImage? {
        if let cached = images.object(forKey: name as NSString) { return cached }
        guard let source = UIImage(named: name, in: .main, compatibleWith: nil),
              source.size.width > 0, source.size.height > 0 else { return nil }
        let ratio = min(1, maximumImagePixels / max(source.size.width, source.size.height))
        let size = CGSize(width: source.size.width * ratio, height: source.size.height * ratio)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1 // Explicit pixels, independent of the device's 2x/3x display scale.
        format.preferredRange = .standard
        let image = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            source.draw(in: CGRect(origin: .zero, size: size))
        }
        images.setObject(image, forKey: name as NSString)
        #if DEBUG
        let logger = Logger(subsystem: "com.patch.learning.widget", category: "resources")
        logger.notice("archive image \(name, privacy: .public)=\(image.cgImage?.width ?? 0)x\(image.cgImage?.height ?? 0)")
        #endif
        return image
    }

    static func font(named name: String, size: CGFloat, isNumber: Bool = false) -> Font {
        guard UIFont(name: name, size: size) != nil else {
            return .system(size: size, weight: isNumber ? .bold : .regular,
                           design: isNumber ? .rounded : .default)
        }
        return .custom(name, fixedSize: size)
    }

    static func audit(path: String) {
        #if DEBUG
        let logger = Logger(subsystem: "com.patch.learning.widget", category: "resources")
        logger.notice("small-widget-archive-v1 provider=\(path, privacy: .public)")
        _ = resourceAudit
        #endif
    }

    #if DEBUG
    private static let resourceAudit: Void = {
        let logger = Logger(subsystem: "com.patch.learning.widget", category: "resources")
        for name in ["RoundedMplus1c-Bold", "NunitoSans-Bold", "NotoSansJPThin-Regular", "Inter-Regular"] {
            let resolved = UIFont(name: name, size: 14)?.fontName ?? "system-fallback"
            logger.notice("font \(name, privacy: .public)=\(resolved, privacy: .public)")
        }
        for name in PatchSmallArtwork.allCases.map(\.rawValue) + ["companion.jpeg"] {
            // Check bundle lookup without eagerly drawing every state into memory.
            let available = UIImage(named: name, in: .main, compatibleWith: nil) != nil
            logger.notice("resource \(name, privacy: .public) available=\(available)")
        }
    }()
    #endif
}

@main struct PatchWidget: Widget {
    let kind = "PatchRetention"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PatchProvider()) { PatchWidgetView(entry: $0) }
            .configurationDisplayName("Patch").description("Streakと今日の復習").supportedFamilies([.systemSmall, .systemMedium])
    }
}
