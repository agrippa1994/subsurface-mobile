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

    // Task 03 smoke units: proof on device that the vendored core serializes
    // and parses. Both go away once task 05 lands the real API.
    Function("smokeSerializeMinimalLog") { () -> String? in
      SsrfCoreBridge.smokeSerializeMinimalLog()
    }

    Function("smokeCountDivesInFile") { (path: String) -> Int in
      SsrfCoreBridge.smokeCountDives(inFile: path)
    }
  }
}
