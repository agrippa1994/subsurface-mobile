// AI-generated (Claude)
// Domain model of the app.
//
// The shapes themselves are declared once, at the module boundary
// (modules/ssrf-core/src/SsrfCore.types.ts), because that file is the normative
// description of the JSON the C++ bindings emit - see modules/ssrf-core/cpp/API.md.
// Re-exporting them here rather than restating them keeps a single definition:
// a field renamed in the bindings breaks compilation instead of silently
// drifting from a hand-copied mirror.
//
// Everything crossing the boundary is in the core's raw integer units
// (mm, mbar, mkelvin, ml, g, s, permille, microdegrees). Conversion and
// formatting live in ./units, never in C++, so the same numbers render metric
// or imperial.

export type {
  Cylinder,
  CylinderPatch,
  DeleteDiveResult,
  Dive,
  DiveComputer,
  DiveEvent,
  DivePatch,
  DiveSite,
  DiveSiteInput,
  DiveSummary,
  GasMix,
  GradientFactors,
  ImportResult,
  LoadResult,
  PlotEntry,
  PlotInfo,
  SaveResult,
  Stats,
  StatsDurationBin,
  StatsFilter,
  StatsMonth,
  StatsSummary,
  UngroupResult,
  TaxonomyEntry,
  WeightSystem,
  WeightSystemPatch,
} from '../../modules/ssrf-core/src/SsrfCore.types';

export {
  CylinderUse,
  DiveMode,
  EventSeverity,
  plotPressureAt,
  ProfileDiveType,
  SsrfCoreError,
  TaxonomyCategory,
  Velocity,
} from '../../modules/ssrf-core/src/SsrfCore.types';

export * from './units';
