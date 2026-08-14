# Third-party sources

Vendored verbatim, not generated. Do not edit in place - bump by replacing the
file with a new upstream release and noting the version here.

| Path | Upstream | Version | License |
| --- | --- | --- | --- |
| `nlohmann/json.hpp` | https://github.com/nlohmann/json | v3.11.3 (single-include amalgamation) | MIT |

`nlohmann/json.hpp` is the marshalling layer for the JSI boundary
(`cpp/bindings/`). MIT is compatible with this project's GPL-2.0.

Reproduce with:

    curl -L -o cpp/third_party/nlohmann/json.hpp \
      https://raw.githubusercontent.com/nlohmann/json/v3.11.3/single_include/nlohmann/json.hpp
