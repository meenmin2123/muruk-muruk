import Foundation
import Capacitor
import WidgetKit

// 무럭무럭 — 웹앱(JS)에서 보낸 "오늘 스냅샷"을 App Group 공유 저장소에 저장하고
// 홈 화면 위젯을 새로고침하는 Capacitor 플러그인.
//
// JS 쪽에서는  WidgetBridge.save({ data: "<JSON 문자열>" })  로 호출한다.
// (lib/widget.ts 의 registerPlugin("WidgetBridge") 와 이름이 같아야 한다.)
//
// 설치: 이 파일과 WidgetBridgePlugin.m 을 App 타겟에 추가. App 타겟에
//       App Groups 기능으로 group.com.muruk.app 을 켜둘 것.
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin {
    // App 타겟과 위젯 타겟 양쪽에 동일하게 등록해야 하는 App Group ID.
    static let appGroup = "group.com.muruk.app"
    static let snapshotKey = "snapshot"

    @objc func save(_ call: CAPPluginCall) {
        guard let data = call.getString("data") else {
            call.reject("missing 'data'")
            return
        }
        guard let defaults = UserDefaults(suiteName: WidgetBridgePlugin.appGroup) else {
            call.reject("App Group(\(WidgetBridgePlugin.appGroup)) 을 열 수 없어요. Capability 설정을 확인하세요.")
            return
        }
        defaults.set(data, forKey: WidgetBridgePlugin.snapshotKey)
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        call.resolve()
    }
}
