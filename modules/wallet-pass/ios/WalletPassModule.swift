// AI-generated (Claude)
import ExpoModulesCore
import PassKit

// The native half of "Add to Apple Wallet". The pass itself - pass.json, the
// manifest, the PKCS#7 signature, the zip - is built in TypeScript
// (src/lib/wallet/signing.ts), where it is tested; this side only checks that
// PassKit accepts the bytes, shows the system sheet, and draws Apple's button.
//
// No Wallet entitlement is needed: any app may offer a validly signed pass to
// the user. The entitlement only matters for reading passes back, which the app
// never does.
public class WalletPassModule: Module {
  // The sheet's delegate, kept alive while the sheet is up.
  private var presenter: AddPassPresenter?

  public func definition() -> ModuleDefinition {
    Name("WalletPass")

    Function("canAddPasses") {
      PKAddPassesViewController.canAddPasses()
    }

    // Resolves once the sheet is gone: true when the pass is in Wallet then,
    // false when the user cancelled. Rejects when PassKit refuses the bytes,
    // with PassKit's reason (usually the signature).
    AsyncFunction("addPass") { (base64: String, promise: Promise) in
      guard let data = Data(base64Encoded: base64) else {
        promise.reject("ERR_PASS_DATA", "The pass is not valid base64.")
        return
      }
      let pass: PKPass
      do {
        pass = try PKPass(data: data)
      } catch {
        promise.reject("ERR_PASS_INVALID", error.localizedDescription)
        return
      }
      guard let controller = PKAddPassesViewController(pass: pass) else {
        promise.reject("ERR_PASS_UNAVAILABLE", "Wallet cannot add this pass on this device.")
        return
      }
      guard let host = self.appContext?.utilities?.currentViewController() else {
        promise.reject("ERR_NO_VIEW", "There is no screen to show Wallet over.")
        return
      }
      let presenter = AddPassPresenter(pass: pass) { [weak self] added in
        self?.presenter = nil
        promise.resolve(added)
      }
      self.presenter = presenter
      controller.delegate = presenter
      host.present(controller, animated: true)
    }.runOnQueue(.main)

    View(AddPassButtonView.self) {
      Events("onPress")
      Prop("dark") { (view: AddPassButtonView, dark: Bool) in
        view.setDark(dark)
      }
    }
  }
}

private final class AddPassPresenter: NSObject, PKAddPassesViewControllerDelegate {
  private let pass: PKPass
  private let done: (Bool) -> Void

  init(pass: PKPass, done: @escaping (Bool) -> Void) {
    self.pass = pass
    self.done = done
  }

  func addPassesViewControllerDidFinish(_ controller: PKAddPassesViewController) {
    controller.dismiss(animated: true) {
      // containsPass needs no entitlement; it is how the sheet's outcome is known.
      self.done(PKPassLibrary().containsPass(self.pass))
    }
  }
}

/// Apple's own "Add to Apple Wallet" button. The HIG asks for it rather than a
/// look-alike, and it localises itself.
final class AddPassButtonView: ExpoView {
  let onPress = EventDispatcher()
  private var button: PKAddPassButton

  required init(appContext: AppContext? = nil) {
    button = PKAddPassButton(addPassButtonStyle: .black)
    super.init(appContext: appContext)
    clipsToBounds = false
    install()
  }

  func setDark(_ dark: Bool) {
    let style: PKAddPassButtonStyle = dark ? .blackOutline : .black
    if button.addPassButtonStyle != style {
      button.removeFromSuperview()
      button = PKAddPassButton(addPassButtonStyle: style)
      install()
    }
  }

  private func install() {
    button.addTarget(self, action: #selector(pressed), for: .touchUpInside)
    addSubview(button)
    setNeedsLayout()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    button.frame = bounds
  }

  @objc private func pressed() {
    onPress()
  }
}
