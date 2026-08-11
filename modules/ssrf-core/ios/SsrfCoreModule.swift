// AI-generated (Claude)
import ExpoModulesCore

// Expo Modules synchronous functions are dispatched over JSI, so `add` below
// runs C++ on the JS thread with no bridge serialization. Task 05 extends this
// definition with the real JSON in / JSON out core API.
public class SsrfCoreModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SsrfCore")

    Function("add") { (a: Int, b: Int) -> Int in
      SsrfCoreBridge.add(a, b: b)
    }
  }
}
