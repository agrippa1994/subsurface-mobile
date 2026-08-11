package expo.modules.ssrfcore

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SsrfCoreModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SsrfCore")
  }
}
