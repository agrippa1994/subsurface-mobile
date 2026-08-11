// AI-generated (Claude)
// Shared types for the ssrf-core module boundary.
//
// The JSI boundary format is JSON: TypeScript sends/receives JSON strings and
// the native module owns the in-memory divelog. Task 05 fills in the real
// divelog / dive / dive-site / buddy shapes here.

// Native surface exposed by the Swift/Kotlin module definition.
export type SsrfCoreNativeModule = {
  // Smoke test proving C++ executes over JSI (task 02).
  add(a: number, b: number): number;
};
