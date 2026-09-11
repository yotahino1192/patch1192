import Foundation
import Capacitor
import ClerkKit

final class PatchBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(PatchAuthPlugin())
    }
}

// Only a short-lived API token crosses this bridge. Clerk owns the persistent
// native credentials in its app-private Keychain service (no access group).
@objc(PatchAuthPlugin)
public class PatchAuthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PatchAuthPlugin"
    public let jsName = "PatchAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getToken", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startEmail", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "verifyEmail", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise)
    ]
    @MainActor private var clerk: Clerk?
    @MainActor private var setupTask: Task<Void, Error>?
    @MainActor private var eventsTask: Task<Void, Never>?
    @MainActor private var pendingSignIn: SignIn?
    @MainActor private var pendingSignUp: SignUp?
    @MainActor private var initialized = false

    @MainActor private func identity() -> JSObject {
        guard let clerk, let session = clerk.session, session.status == .active, let user = clerk.user else {
            return ["identity": NSNull()]
        }
        return ["identity": ["subject": user.id, "sessionId": session.id]]
    }

    private func keyDomain(_ key: String) -> String? {
        guard key.hasPrefix("pk_test_") || key.hasPrefix("pk_live_") else { return nil }
        var encoded = String(key.dropFirst(8)).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        encoded += String(repeating: "=", count: (4 - encoded.count % 4) % 4)
        guard let data = Data(base64Encoded: encoded), let value = String(data: data, encoding: .utf8), value.hasSuffix("$") else { return nil }
        let domain = String(value.dropLast())
        guard domain.contains("."), domain.range(of: "^[A-Za-z0-9.-]+$", options: .regularExpression) != nil else { return nil }
        return domain
    }

    @objc func initialize(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                if setupTask == nil {
                    guard let key = call.getString("publishableKey"),
                          let domain = keyDomain(key) else {
                        call.reject("Clerk publishable key is not configured."); return
                    }
                    let instance = clerk ?? Clerk.configure(publishableKey: key, options: .init(telemetryEnabled: false, keychainConfig: .init(service: "\(Bundle.main.bundleIdentifier ?? "com.patch.learning").clerk.\(domain)")))
                    clerk = instance
                    setupTask = Task { @MainActor in
                        _ = try await instance.refreshEnvironment()
                        _ = try await instance.refreshClient()
                    }
                }
                try await setupTask?.value
                initialized = true
                if eventsTask == nil, let clerk {
                    eventsTask = Task { @MainActor [weak self] in
                        for await event in clerk.auth.events {
                            guard let self else { return }
                            switch event {
                            case .sessionChanged, .signedOut, .accountDeleted:
                                self.notifyListeners("sessionChanged", data: self.identity())
                            default: break // Never forward token events or credentials.
                            }
                        }
                    }
                }
                call.resolve(identity())
            } catch {
                setupTask = nil
                call.reject("ログインを確認できません。接続を確認してください。")
            }
        }
    }

    @objc func getSession(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard initialized, let clerk else { call.reject("Auth not initialized"); return }
            do { _ = try await clerk.refreshClient(); call.resolve(identity()) }
            catch { call.reject("ログインを確認できません。") }
        }
    }

    @objc func getToken(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard initialized, let clerk, let expected = call.getString("sessionId"), clerk.session?.id == expected else {
                call.reject("Session changed"); return
            }
            do {
                let token = try await clerk.auth.getToken()
                guard clerk.session?.id == expected, clerk.session?.status == .active else { call.reject("Session changed"); return }
                call.resolve(["token": token as Any? ?? NSNull()])
            } catch { call.reject("認証トークンを取得できません。接続を確認してください。") }
        }
    }

    @objc func startEmail(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard initialized, let clerk, let email = call.getString("email"), clerk.session?.status != .active else { call.reject("Auth unavailable"); return }
            pendingSignIn = nil; pendingSignUp = nil
            do {
                if call.getBool("signUp") == true {
                    let attempt = try await clerk.auth.signUp(emailAddress: email)
                    pendingSignUp = try await attempt.sendEmailCode()
                } else {
                    pendingSignIn = try await clerk.auth.signInWithEmailCode(emailAddress: email)
                }
                call.resolve()
            } catch { call.reject("確認コードを送信できません。メールアドレスと接続を確認してください。") }
        }
    }

    @objc func verifyEmail(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard initialized, let clerk, let code = call.getString("code") else { call.reject("Auth unavailable"); return }
            do {
                let sessionId: String?
                if call.getBool("signUp") == true, let attempt = pendingSignUp {
                    let result = try await attempt.verifyEmailCode(code)
                    pendingSignUp = result; sessionId = result.createdSessionId
                } else if let attempt = pendingSignIn {
                    let result = try await attempt.verifyCode(code)
                    pendingSignIn = result; sessionId = result.createdSessionId
                } else { call.reject("確認コードを再送信してください。"); return }
                if let sessionId { try await clerk.auth.setActive(sessionId: sessionId) }
                call.resolve(identity())
            } catch { call.reject("確認できません。コードの有効期限と入力を確認してください。") }
        }
    }

    @objc func signOut(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard initialized, let clerk, let sessionId = call.getString("sessionId") else { call.reject("Auth unavailable"); return }
            do {
                // Never sign out a different active account because an old JS call arrived late.
                if clerk.session?.id == sessionId { try await clerk.auth.signOut(sessionId: sessionId) }
                pendingSignIn = nil; pendingSignUp = nil
                call.resolve()
            } catch { call.reject("ログアウトを完了できません。接続を確認してください。") }
        }
    }
}
