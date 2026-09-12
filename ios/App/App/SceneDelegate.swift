import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = PatchBridgeViewController()
        window?.makeKeyAndVisible()

        if let response = connectionOptions.notificationResponse,
           let raw = response.notification.request.content.userInfo["url"] as? String,
           let url = URL(string: raw), let owner = response.notification.request.content.userInfo["owner"] as? String {
            RetentionLinks.capture(url, owner: owner)
        }
        for context in connectionOptions.urlContexts { RetentionLinks.capture(context.url) }
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for context in URLContexts { RetentionLinks.capture(context.url) }
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
