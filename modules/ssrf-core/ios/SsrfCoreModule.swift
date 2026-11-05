// AI-generated (Claude)
import ExpoModulesCore

// Expo Modules synchronous functions are dispatched over JSI, so the calls
// below run C++ on the JS thread with no bridge serialization.
public class SsrfCoreModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SsrfCore")

    // Download progress and scan results. The core pushes them from its own
    // threads; each is one JSON object, parsed in src/index.ts.
    Events("onCoreEvent")

    OnCreate {
      SsrfCoreBridge.setEventSink { [weak self] json in
        self?.sendEvent("onCoreEvent", ["json": json])
      }
    }

    // The entire core API goes through this one function; adding a method is a
    // C++ and a TypeScript change only, never a native-glue change.
    Function("call") { (method: String, argsJson: String) -> String in
      SsrfCoreBridge.call(method, argsJson: argsJson)
    }

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
