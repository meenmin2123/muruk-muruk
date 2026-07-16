import WidgetKit
import SwiftUI

// 무럭무럭 홈 화면 위젯.
// App Group(group.com.muruk.app) 공유 저장소에서 앱이 써둔 "오늘 스냅샷"을 읽어
// 오늘 할 일 목록과 칭찬판(스티커/도장) 진행도를 보여준다.
//
// 설치: Xcode에서 Widget Extension 타겟(MurukWidget)을 만든 뒤, 생성된 기본 swift 파일
//       내용을 이 파일로 교체. 위젯 타겟에도 App Groups 로 group.com.muruk.app 을 켤 것.

// MARK: - 데이터 모델 (lib/widget.ts 의 WidgetSnapshot 과 1:1 대응)

struct WTask: Codable, Hashable {
    let text: String
    let done: Bool
    let color: String?
}

struct WBoard: Codable, Hashable {
    let title: String
    let color: String
    let stickers: Int
    let stamps: Int
    let cap: Int
}

struct WidgetSnapshot: Codable {
    let date: String
    let doneCount: Int
    let totalCount: Int
    let tasks: [WTask]
    let totalStickers: Int
    let totalStamps: Int
    let boards: [WBoard]
    let updatedAt: String?

    static let empty = WidgetSnapshot(
        date: "", doneCount: 0, totalCount: 0, tasks: [],
        totalStickers: 0, totalStamps: 0, boards: [], updatedAt: nil
    )
    static let sample = WidgetSnapshot(
        date: "2026-06-30", doneCount: 2, totalCount: 4,
        tasks: [
            WTask(text: "물 2L 마시기", done: true, color: "#3FC58A"),
            WTask(text: "영어 강의 1개 듣기", done: true, color: "#5B8DEF"),
            WTask(text: "30분 걷기", done: false, color: "#3FC58A"),
            WTask(text: "오늘 회고 한 줄", done: false, color: nil),
        ],
        totalStickers: 12, totalStamps: 1,
        boards: [WBoard(title: "건강하게 살기", color: "#3FC58A", stickers: 3, stamps: 1, cap: 5)],
        updatedAt: nil
    )
}

// MARK: - 공유 저장소 읽기

enum WidgetStore {
    static let appGroup = "group.com.muruk.app"
    static let snapshotKey = "snapshot"

    static func load() -> WidgetSnapshot? {
        guard let defaults = UserDefaults(suiteName: appGroup),
              let raw = defaults.string(forKey: snapshotKey),
              let data = raw.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    }
}

// MARK: - 타임라인

struct MurukEntry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> MurukEntry {
        MurukEntry(date: Date(), snapshot: .sample)
    }
    func getSnapshot(in context: Context, completion: @escaping (MurukEntry) -> Void) {
        completion(MurukEntry(date: Date(), snapshot: WidgetStore.load() ?? .sample))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<MurukEntry>) -> Void) {
        let snap = WidgetStore.load() ?? .empty
        let entry = MurukEntry(date: Date(), snapshot: snap)
        // 앱이 갱신하면 WidgetCenter.reloadAllTimelines 로 즉시 갱신되지만,
        // 안전하게 30분마다도 한 번 더 갱신을 요청한다.
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date())
            ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

// MARK: - 색/배경 헬퍼

extension Color {
    init(hex: String) {
        let s = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var v: UInt64 = 0
        Scanner(string: s).scanHexInt64(&v)
        let r, g, b: Double
        if s.count == 6 {
            r = Double((v & 0xFF0000) >> 16) / 255
            g = Double((v & 0x00FF00) >> 8) / 255
            b = Double(v & 0x0000FF) / 255
        } else {
            r = 0.27; g = 0.72; b = 0.49 // 기본 브랜드 그린
        }
        self.init(.sRGB, red: r, green: g, blue: b, opacity: 1)
    }
}

private let brand = Color(hex: "#46B97C")
private let bgColor = Color(hex: "#F3FAF1")

extension View {
    @ViewBuilder
    func widgetBackground(_ color: Color) -> some View {
        if #available(iOS 17.0, *) {
            self.containerBackground(color, for: .widget)
        } else {
            self.background(color)
        }
    }
}

// MARK: - 공용 조각

private struct ProgressBar: View {
    let done: Int
    let total: Int
    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.black.opacity(0.08))
                Capsule()
                    .fill(brand)
                    .frame(width: total > 0 ? geo.size.width * CGFloat(done) / CGFloat(total) : 0)
            }
        }
        .frame(height: 7)
    }
}

private struct StickerLine: View {
    let stamps: Int
    let stickers: Int
    var body: some View {
        HStack(spacing: 10) {
            Label("\(stamps)", systemImage: "rosette")
            Label("\(stickers)", systemImage: "star.fill")
        }
        .font(.caption2.weight(.semibold))
        .foregroundColor(brand)
    }
}

private struct TaskRow: View {
    let task: WTask
    var body: some View {
        HStack(spacing: 7) {
            ZStack {
                Circle()
                    .strokeBorder(task.done ? brand : Color.black.opacity(0.18), lineWidth: 2)
                    .background(Circle().fill(task.done ? brand : .clear))
                    .frame(width: 16, height: 16)
                if task.done {
                    Image(systemName: "checkmark")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.white)
                }
            }
            Text(task.text)
                .font(.system(size: 13))
                .strikethrough(task.done, color: .secondary)
                .foregroundColor(task.done ? .secondary : .primary)
                .lineLimit(1)
            Spacer(minLength: 0)
            if let c = task.color {
                Circle().fill(Color(hex: c)).frame(width: 7, height: 7)
            }
        }
    }
}

// MARK: - Small / Medium 뷰

private struct SmallView: View {
    let snap: WidgetSnapshot
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 4) {
                Image(systemName: "leaf.fill").font(.system(size: 11)).foregroundColor(brand)
                Text("오늘").font(.subheadline.bold()).foregroundColor(.primary)
                Spacer()
            }
            Spacer(minLength: 0)
            if snap.totalCount == 0 {
                Text("할 일을 적어볼까요?")
                    .font(.system(size: 13)).foregroundColor(.secondary)
            } else {
                HStack(alignment: .firstTextBaseline, spacing: 2) {
                    Text("\(snap.doneCount)").font(.system(size: 30, weight: .heavy)).foregroundColor(brand)
                    Text("/ \(snap.totalCount)").font(.subheadline.weight(.semibold)).foregroundColor(.secondary)
                }
                ProgressBar(done: snap.doneCount, total: snap.totalCount)
            }
            Spacer(minLength: 0)
            StickerLine(stamps: snap.totalStamps, stickers: snap.totalStickers)
        }
        .padding(14)
        .widgetBackground(bgColor)
    }
}

private struct MediumView: View {
    let snap: WidgetSnapshot
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 5) {
                Image(systemName: "leaf.fill").font(.system(size: 12)).foregroundColor(brand)
                Text("모아모아 · 오늘").font(.subheadline.bold()).foregroundColor(.primary)
                Spacer()
                if snap.totalCount > 0 {
                    Text("\(snap.doneCount)/\(snap.totalCount)")
                        .font(.caption.weight(.bold)).foregroundColor(brand)
                }
                StickerLine(stamps: snap.totalStamps, stickers: snap.totalStickers)
            }
            if snap.totalCount > 0 {
                ProgressBar(done: snap.doneCount, total: snap.totalCount)
            }
            if snap.tasks.isEmpty {
                Spacer()
                Text("오늘 할 일이 없어요. 앱에서 하나 적어볼까요? 🌱")
                    .font(.system(size: 13)).foregroundColor(.secondary)
                Spacer()
            } else {
                VStack(alignment: .leading, spacing: 5) {
                    ForEach(Array(snap.tasks.prefix(4)), id: \.self) { t in
                        TaskRow(task: t)
                    }
                }
                if snap.tasks.count > 4 {
                    Text("외 \(snap.tasks.count - 4)개 더")
                        .font(.caption2).foregroundColor(.secondary)
                }
                Spacer(minLength: 0)
            }
        }
        .padding(14)
        .widgetBackground(bgColor)
    }
}

struct MurukWidgetEntryView: View {
    @Environment(\.widgetFamily) var family
    let entry: Provider.Entry
    var body: some View {
        switch family {
        case .systemSmall: SmallView(snap: entry.snapshot)
        default: MediumView(snap: entry.snapshot)
        }
    }
}

// MARK: - 위젯 정의

struct MurukWidget: Widget {
    let kind = "MurukWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            MurukWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("모아모아")
        .description("오늘 할 일과 칭찬판 진행도를 보여줘요.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct MurukWidgetBundle: WidgetBundle {
    var body: some Widget {
        MurukWidget()
    }
}
