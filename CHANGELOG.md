# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/) as it applies to an
action: removing or renaming an input or output, dropping a supported ROCm
version, distribution or platform, or changing the install location or an
exported variable is a breaking change.

## [Unreleased]

### Added

- **Linux job containers:** the action works in bare Ubuntu and Debian
  containers that run as root and ship no `sudo`. Privileged commands run
  directly when the job is root and through `sudo` otherwise; if neither is
  possible the step fails with a clear message. Missing `ca-certificates` and
  `gpg` are installed first, and only when absent, so hosted runners are
  unaffected ([#15]).
- **Linux, RHEL 8, 9 and 10 (ROCm 10.x):** installs from AMD's RPM repository
  with dnf, in `manylinux_2_28` and other RHEL-family containers. The signing
  key is checked against the pinned fingerprint before `rpm --import`, and the
  repository is set up with `gpgcheck=1` and `repo_gpgcheck=1`. Missing
  `gnupg2` is installed first, and `gcc-c++` with ROCm, because `hipcc` needs
  it to compile and link. ROCm 7.2.x and older on RHEL fail early with a clear
  message ([#17]).

## [1.0.0] - 2026-11-18

First release.

### Added

- **Linux, ROCm 10.x:** installs from AMD's multi-arch apt repository
  (`stable.repo.amd.com`) with per-architecture packages selected by `gfx`.
  Ubuntu 22.04, 24.04 and 26.04 are tested in CI; Debian 12 and 13 are supported
  in the code but not tested. The repository signing key is checked against a
  pinned fingerprint before it is trusted.
- **Linux, ROCm 7.2.x and older:** installs through the `amdgpu-install` package
  from `repo.radeon.com` on Ubuntu 22.04 and 24.04. Versions 6.2.2, 7.0.1 and
  7.2.4 are listed; only 7.2.4 is tested. No kernel driver is installed.
- **Windows, ROCm 10.x:** installs the tarball on `windows-2022` and
  `windows-2025`, streamed into the system `tar` without a temporary file. The GPU
  target is mapped to a tarball family; several families, or `gfx: all`, use the
  `multiarch` tarball.
- **Inputs** `version`, `gfx` and `components`, plus `use-cache` and
  `log-file-suffix`, which are accepted but have no effect yet. **Outputs**
  `ROCM_PATH` and `version`. After the step `ROCM_PATH` and `HIP_PATH` are exported, the `bin`
  directory is on `PATH`, `LD_LIBRARY_PATH` includes the library directory on
  Linux, and `HIP_DEVICE_LIB_PATH` is set on Windows.
- **Strict input validation:** an invalid `version`, `gfx` or `components` value
  is rejected with a clear message before any command runs. CI asserts the
  failures.
- **CI:** every supported platform installs ROCm, runs `hipcc --version`, compiles
  a HIP program and builds a CMake project against 13 ROCm and HIP libraries
  (compile and link only; hosted runners have no GPU). A `Check dist` workflow
  keeps the committed `dist/` bundle current.

[Unreleased]: https://github.com/vhrabar/rocm-toolkit/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/vhrabar/rocm-toolkit/releases/tag/v1.0.0
[#15]: https://github.com/vhrabar/rocm-toolkit/issues/15
[#17]: https://github.com/vhrabar/rocm-toolkit/issues/17
