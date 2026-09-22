// Simulator-only harness. Compile with PatchWidget.swift minus its @main Widget declaration,
// plus Shared/RetentionSnapshot.swift; never add this file to the shipping target.
import SwiftUI
import UIKit

private let states = ["NORMAL", "AT_RISK", "LAST_CHANCE", "COMPLETED", "BROKEN", "SIGNED_OUT", "NEW_USER", "STALE"]
private let now = Date(timeIntervalSince1970: 1_800_000_000)

private func fixture(_ state: String, streak: Int = 12) -> PatchEntry {
    guard state != "SIGNED_OUT" else { return PatchEntry(date: now, snapshot: nil) }
    let ms = now.timeIntervalSince1970 * 1000
    let hours = state == "LAST_CHANCE" ? 2.0 : state == "AT_RISK" ? 5.0 : 10.0
    let snapshot = RetentionSnapshot(version: 1, generatedAt: ms, expiresAt: state == "STALE" ? ms : ms + 86400000,
        day: 1, dayEnd: ms + hours * 3600000, timezone: "Asia/Tokyo",
        streak: state == "NEW_USER" ? 0 : state == "BROKEN" ? 0 : streak,
        hot: false, completed: state == "COMPLETED", broken: state == "BROKEN", dueCount: 4)
    return PatchEntry(date: now, snapshot: snapshot)
}

private struct Tile: View {
    let entry: PatchEntry
    let language: String
    let side: CGFloat
    var body: some View {
        let presentation = PatchSmallPresentation(entry: entry, locale: Locale(identifier: language))
        PatchSmallHeader(presentation: presentation)
            .foregroundStyle(PatchSmallArtworkBackground.ink)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .padding(16) // representative WidgetKit margins; actual configuration keeps system margins
            .background { PatchSmallArtworkBackground(artwork: presentation.artwork) }
            .frame(width: side, height: side)
            .clipShape(RoundedRectangle(cornerRadius: 22))
    }
}

@MainActor private func runQA() throws {
    let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    let expected = ["NORMAL": "widget-normal", "AT_RISK": "widget-risk", "LAST_CHANCE": "widget-urgent",
                    "COMPLETED": "widget-complete", "BROKEN": "widget-restart", "SIGNED_OUT": "widget-normal",
                    "NEW_USER": "widget-normal", "STALE": "widget-normal"]
    var count = 0
    for language in ["en", "ja"] {
        for state in states {
            let presentation = PatchSmallPresentation(entry: fixture(state), locale: Locale(identifier: language))
            precondition(presentation.state == state, "Fixture must exercise the domain resolver: \(state)")
            precondition(presentation.artwork.rawValue == expected[state])
            precondition(presentation.streak == (state == "SIGNED_OUT" || state == "STALE" ? nil : state == "NEW_USER" || state == "BROKEN" ? 0 : 12))
            let numberFont = UIFont(name: presentation.numberFont, size: 20)!
            let messageFont = UIFont(name: presentation.messageFont, size: 14)!
            precondition(numberFont.fontName == presentation.numberFont)
            precondition(messageFont.fontName == presentation.messageFont)
            let width = (presentation.message as NSString).size(withAttributes: [.font: messageFont]).width
            precondition(width * 0.85 <= 141 - 32, "Clipped message at compact size: \(language) \(state) \(width)")
            for side: CGFloat in [141, 155, 170, 180] {
                for scheme: ColorScheme in [.light, .dark] {
                    let renderer = ImageRenderer(content: Tile(entry: fixture(state), language: language, side: side).environment(\.colorScheme, scheme))
                    renderer.scale = 2
                    let rendered = renderer.uiImage!
                    precondition(rendered.size.width == side && rendered.size.height == side)
                    count += 1
                }
            }
        }
        for streak in [0, 3, 12, 123, 1234] {
            let entry = fixture(streak == 0 ? "NEW_USER" : "NORMAL", streak: streak)
            let presentation = PatchSmallPresentation(entry: entry, locale: Locale(identifier: language))
            precondition(presentation.streakText == String(streak))
            let font = UIFont(name: presentation.numberFont, size: 20)!
            precondition((presentation.streakText as NSString).size(withAttributes: [.font: font]).width + 21 < 109)
        }
        for scheme: ColorScheme in [.light, .dark] {
            let sheet = VStack(spacing: 12) {
                Text("Small Widget · \(language) · \(scheme == .light ? "light" : "dark")").font(.headline)
                ForEach(0..<2) { row in
                    HStack(alignment: .top, spacing: 12) {
                        ForEach(0..<4) { col in
                            let state = states[row * 4 + col]
                            VStack(spacing: 6) {
                                Text(state).font(.system(size: 11, weight: .medium))
                                Tile(entry: fixture(state), language: language, side: 155)
                            }
                        }
                    }
                }
                HStack(spacing: 12) {
                    ForEach([0, 3, 12, 123], id: \.self) { streak in
                        Tile(entry: fixture(streak == 0 ? "NEW_USER" : "NORMAL", streak: streak), language: language, side: 155)
                    }
                }
            }
            .padding(16)
            .background(scheme == .dark ? Color.black : Color(white: 0.9))
            .environment(\.colorScheme, scheme)
            let renderer = ImageRenderer(content: sheet)
            renderer.scale = 2
            try renderer.uiImage!.pngData()!.write(to: directory.appendingPathComponent("small-\(language)-\(scheme == .light ? "light" : "dark").png"))
        }
    }
    precondition(PatchSmallArtwork.allCases.count == 5)
    for artwork in PatchSmallArtwork.allCases {
        let image = UIImage(named: artwork.rawValue)!
        precondition(image.size.width == image.size.height, "Artwork must remain square")
        precondition(image.cgImage!.width >= 1024, "Full-resolution artwork must be bundled")
    }
    precondition(UIImage(named: "companion.jpeg") != nil)
    try "PASS: \(count) renders; 8 domain states; 5 mappings; en/ja; light/dark; 141/155/170/180pt; streak 0/3/12/123/1234; native font registration; message fitting; five catalog artworks loaded.\n".write(to: directory.appendingPathComponent("result.txt"), atomically: true, encoding: .utf8)
}

@main struct PatchSmallWidgetQA: App {
    var body: some Scene {
        WindowGroup {
            Text("Patch Small Widget QA")
                .task {
                    do { try runQA() } catch { fatalError("QA failed: \(error)") }
                }
        }
    }
}
