#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// WidgetBridgePlugin(Swift) 을 Capacitor 런타임에 "WidgetBridge" 라는 이름으로 등록한다.
// JS: registerPlugin("WidgetBridge") 와 일치해야 한다.
CAP_PLUGIN(WidgetBridgePlugin, "WidgetBridge",
           CAP_PLUGIN_METHOD(save, CAPPluginReturnPromise);
)
