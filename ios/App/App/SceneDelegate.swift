import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    // 1. Cold Start Handler
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let _ = (scene as? UIWindowScene) else { return }
        
        if let urlContext = connectionOptions.urlContexts.first {
            let url = urlContext.url
            print("⚡️ [SceneDelegate] Cold Start URL: \(url.absoluteString)")
            
            // Wait for Vue to mount (3s), then Force Feed
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                self.forceInjectUrl(url)
            }
        }
    }

    // 2. Warm Resume Handler
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        print("⚡️ [SceneDelegate] Warm Resume URL: \(url.absoluteString)")
        
        // App is open, fire immediately
        self.forceInjectUrl(url)
    }

    // 3. The "Force Feed" Helper
    private func forceInjectUrl(_ url: URL) {
        // Find the Capacitor Bridge View Controller
        if let bridgeVC = self.window?.rootViewController as? CAPBridgeViewController {
            let js = "window.handleOpenUrl('\(url.absoluteString)')"
            print("⚡️ [SceneDelegate] Injecting JS: \(js)")
            
            bridgeVC.webView?.evaluateJavaScript(js) { (result, error) in
                if let error = error {
                    print("⚡️ [SceneDelegate] Injection failed: \(error.localizedDescription)")
                } else {
                    print("⚡️ [SceneDelegate] Injection success!")
                }
            }
        } else {
            print("⚡️ [SceneDelegate] Could not find BridgeViewController to inject JS")
        }
    }

    // Boilerplate
    func sceneDidBecomeActive(_ scene: UIScene) {}
    func sceneWillResignActive(_ scene: UIScene) {}
    func sceneWillEnterForeground(_ scene: UIScene) {}
    func sceneDidEnterBackground(_ scene: UIScene) {}
}
