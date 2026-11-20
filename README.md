# rocm-toolkit

> **Unofficial.** This project is not affiliated with, endorsed by, or sponsored by AMD. "AMD", "ROCm", and "HIP" are trademarks
> of Advanced Micro Devices, Inc. (AMD) and are used here only to describe what the action installs.

Unofficial GitHub Action that installs AMD ROCm (HIP, compilers, libraries) on Ubuntu runners, in Ubuntu, Debian, RHEL-family (including `manylinux_2_28`),
SLES and openSUSE Leap job containers, and on Windows runners. 
Pick a ROCm version and a GPU target, get `hipcc` on `PATH`, and the environment variables you need to build.

```yaml
- uses: vhrabar/rocm-toolkit@v1.1.0
  with:
    version: '10.2.0'
    gfx: gfx1200
- run: hipcc --version
```

## There is no GPU on hosted runners

GitHub-hosted runners have no AMD GPU. 
This action installs the toolchain so you can **configure, compile and link**.
It cannot run GPU code. 
The kernel driver (DKMS, display driver) is never installed.

## Usage

### Linux

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7.0.1
      - uses: vhrabar/rocm-toolkit@v1.1.0
        with:
          version: '10.2.0'
          gfx: gfx1200
      - run: hipcc my_kernel.hip -o my_kernel --offload-arch=gfx1200
```

### Windows

```yaml
jobs:
  build:
    runs-on: windows-2025
    steps:
      - uses: actions/checkout@v7.0.1
      - uses: vhrabar/rocm-toolkit@v1.1.0
        with:
          version: '10.2.0'
          gfx: gfx1200
      - run: hipcc my_kernel.hip -o my_kernel.exe --offload-arch=gfx1200
```

The runner's Visual Studio provides the C++ standard library; the action does not install it.

### Containers

Bare Ubuntu, Debian and RHEL-family job containers work without a setup step:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    container: debian:12
    steps:
      - uses: actions/checkout@v7.0.1
      - uses: vhrabar/rocm-toolkit@v1.1.0
        with:
          version: '10.2.0'
          gfx: gfx1200
      - run: hipcc my_kernel.hip -o my_kernel --offload-arch=gfx1200
```

Privileged commands run through `sudo`, or directly when the job already runs as root (as containers usually do). If neither is possible, the step fails with a clear message.
On Ubuntu and Debian, if `ca-certificates` or `gpg` are missing, the step installs them.
On RHEL 8, 9 and 10 and their rebuilds (AlmaLinux, Rocky Linux, CentOS Stream, Oracle Linux, UBI, `manylinux_2_28`) the step uses dnf with signature checks on for both packages and
repository metadata. It installs `gnupg2` if it is missing, and `gcc-c++`, which `hipcc` needs to compile and link and AMD's RPMs do not pull in.
On SLES 15 and 16 and openSUSE Leap the step uses zypper, again with signature checks on for packages and repository metadata, and installs `gcc-c++` for the same reason.
The AMD key is imported with `rpm --import` after its fingerprint is checked; keys are never auto-imported.
Only missing packages are installed; nothing else is added to the image.
Additional tools beyond ROCm, such as `cmake`, are up to the end-user.

### Matrix

```yaml
jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-22.04, ubuntu-24.04, windows-2022, windows-2025]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v7.0.1
      - uses: vhrabar/rocm-toolkit@v1.1.0
        with:
          version: '10.2.0'
          gfx: gfx1200
```

### CMake

`ROCM_PATH` is set after the step, so it can be passed straight to CMake. 
See[`.github/smoke`](.github/smoke) for a project that builds against hip, rocBLAS, rocFFT, rocRAND, rocSPARSE, rocSOLVER, their hip-prefixed counterparts, hipCUB, rocPRIM and rocThrust.
Note that rocPRIM, hipCUB and rocThrust need C++17, which clang does not select by default on Windows.

## Inputs

| Name | Required | Default | In short |
| --- | --- | --- | --- |
| [`version`](#version) | **yes** | none | ROCm version to install, e.g. `'10.2.0'` |
| [`gfx`](#gfx) | no | `all` | GPU target(s) to build for, e.g. `gfx1200` |
| [`components`](#components) | no | `dev` | Linux package set; `dev` is enough to compile |
| [`use-cache`](#use-cache-and-log-file-suffix) | no | `true` | accepted, no effect yet |
| [`log-file-suffix`](#use-cache-and-log-file-suffix) | no | `log.txt` | accepted, no effect yet |


### `version`

Required. The ROCm version, written `MAJOR.MINOR.PATCH`; quote it in YAML (`'10.2.0'`). There is no default, so a workflow never changes ROCm version on its own.

| Version | Where it installs |
| --- | --- |
| `10.0.0`, `10.1.0`, `10.2.0` | every supported platform: Ubuntu, Debian, RHEL family, SLES/openSUSE Leap, other Linux (tarball), Windows |
| `6.2.2`, `7.0.1`, `7.2.4` | Ubuntu 22.04 and 24.04 only, through AMD's `amdgpu-install` package |


### `gfx`

The GPU architecture(s) to install code for, e.g. `gfx1200`. Several are comma-separated (`gfx1100, gfx1200`). `all` installs every architecture and cannot be combined with other targets; it is **large** (see below), so set a target whenever you know it. Hosted runners have no GPU, so this only decides what you can compile for.

Targets AMD publishes ROCm 10.x for:

| Linux (packages and tarball) | Windows |
| --- | --- |
| `gfx908`, `gfx90a`, `gfx942`, `gfx950`, `gfx1010`, `gfx1011`, `gfx1012`, `gfx1030` to `gfx1036`, `gfx1100` to `gfx1103`, `gfx1150` to `gfx1153`, `gfx1200`, `gfx1201`, `gfx1250` | the same without the data-centre targets `gfx942`, `gfx950` and `gfx1250` |

What a target selects depends on how ROCm is installed:

- Ubuntu, Debian, RHEL, SLES (packages): the per-architecture packages of each target, e.g. `amdrocm-core-dev10.2-gfx1200`. `all` selects the version-only packages, which contain every architecture. A well-formed target that AMD does not package fails in the install step.
- Windows and other Linux (tarball): targets map to a tarball family (`gfx1200` and `gfx1201` share `gfx120X-all`). Targets from several families, or `all`, select the `multiarch` tarball: about 9.5 GB on Linux and 4.5 GB on Windows, against 2 to 3.7 GB for one family. An unknown target fails before downloading, with the list above.
- ROCm 7.2.x and older: not packaged per architecture; `gfx` has no effect and the step warns if it is set.

### `components`

Linux package flows only: which parts of ROCm to install, comma-separated. At least one of `dev` or `sdk` is needed for `hipcc`; the step fails afterwards if no compiler was installed.

| Component | Contents | ROCm 10.x package | ROCm 7.2.x and older |
| --- | --- | --- | --- |
| `dev` (default) | compiler (`hipcc`, `amdclang++`), headers and runtime: enough to build | `amdrocm-core-dev<ver>-<gfx>` (`-devel` on RHEL/SLES) | `rocm-hip-runtime-dev` |
| `sdk` | `dev` plus AMD's SDK packages | `amdrocm-core-sdk<ver>-<gfx>` | `rocm-hip-sdk` |
| `runtime` | the HIP runtime only, no compiler | `amdrocm<ver>-<gfx>` | `rocm-hip-runtime` |
| `developer-tools` | profilers and debuggers | `amdrocm-developer-tools<ver>` | `rocm-developer-tools` |
| `opencl` | the OpenCL runtime | `amdrocm-opencl<ver>` | `rocm-opencl` |

The tarball (Windows, and Linux distributions without an AMD repo) is always installed whole; there `components` has no effect and the step warns if it is set to anything but `dev`.


## What the runner must provide

- Root or `sudo` on Ubuntu, Debian, RHEL and SLES, which install system packages. Hosted runners have `sudo`; job containers usually run as root. Without either, the step fails with a clear message. The tarball path (other Linux distributions) needs neither: without root it installs under `RUNNER_TOOL_CACHE`.
- Disk space: about 10 GB on Linux and 9 GB on Windows for one target; more with several targets or `gfx: all`.
- Network access to `stable.repo.amd.com` (and `repo.radeon.com` for ROCm 7.2.x and older).
- On distributions without an AMD repo (Fedora, Arch, ...): a C++ compiler and `python3`, installed before the step (e.g. `dnf install gcc-c++ python3`, `pacman -S gcc python`). The tarball cannot bring them; the step warns when they are missing.
- On Windows: Visual Studio, which provides the C++ standard library. Hosted Windows runners have it.
- In `registry.suse.com/bci/*` and `opensuse/leap` containers: a `PATH` on the container (see [Known limitations](#known-limitations)).

## Outputs

| Name | Description |
| --- | --- |
| `ROCM_PATH` | Absolute path of the ROCm installation root. |
| `version` | The ROCm version that was installed. |

## What the step sets up

| | Linux, ROCm 10.x | Linux, ROCm 7.2.x and older | Windows, ROCm 10.x |
| --- | --- | --- | --- |
| Install location | `/opt/rocm/core-<MAJOR.MINOR>` | `/opt/rocm-<version>` | `C:\rocm\core-<MAJOR.MINOR>` |
| Source | `stable.repo.amd.com`: the apt, dnf or zypper repository for the distribution, or the tarball where there is none | `repo.radeon.com` (`amdgpu-install` package, then the `components` packages) | tarball from `stable.repo.amd.com`, streamed into `tar` |
| `gfx` | per-architecture packages | no effect (not packaged per architecture) | maps to a tarball family; several families or `all` use the `multiarch` tarball |

For later steps the action exports `ROCM_PATH` and `HIP_PATH`, adds the `bin`directory to `PATH`, and:

- on Linux, adds `<root>/lib` to `LD_LIBRARY_PATH`;
- on Windows, also sets `HIP_DEVICE_LIB_PATH` to `<root>\lib\llvm\amdgcn\bitcode`. Without it, clang cannot find the device libraries once `ROCM_PATH` points at the root of the Windows tarball.

The repositories' signing key is checked against a pinned fingerprint before it is trusted, and package and repository signatures stay checked.

## Supported versions and platforms

| Platform | ROCm versions | Tested in CI |
| --- | --- | --- |
| Ubuntu 22.04, 24.04, 26.04 | 10.0.0, 10.1.0, 10.2.0 | 10.2.0 on all three runners and in an `ubuntu:24.04` container; 10.1.0 on `ubuntu-24.04` |
| Debian 12, 13 | 10.0.0, 10.1.0, 10.2.0 | 10.2.0, `gfx1200`, in `debian:12` and `debian:13` containers |
| RHEL 8, 9, 10 and rebuilds (AlmaLinux, Rocky Linux, CentOS Stream, Oracle Linux, UBI) | 10.0.0, 10.1.0, 10.2.0 | 10.2.0, `gfx1200`, in `manylinux_2_28`, `almalinux:9` and `almalinux:10` containers |
| SLES 15, 16 and openSUSE Leap 15, 16 | 10.0.0, 10.1.0, 10.2.0 | 10.2.0, `gfx1200`, in `bci-base:15.6` and `bci-base:16.0` containers; openSUSE Leap installs the same packages |
| Other Linux without an AMD package repo (Fedora, Arch, Amazon Linux, ...), glibc 2.28 or newer | 10.0.0, 10.1.0, 10.2.0, from the tarball | 10.2.0, `gfx1200`, in an `archlinux:latest` container |
| Ubuntu 22.04, 24.04 | 6.2.2, 7.0.1, 7.2.4 | 7.2.4 only, on both runners and in an `ubuntu:24.04` container |
| Windows (`windows-2022`, `windows-2025`) | 10.0.0, 10.1.0, 10.2.0 | 10.2.0, `gfx1200` |

Every tested combination installs, runs `hipcc --version` and compiles a HIP program. On hosted runners CI also builds the library smoke project (compile and link only); in bare containers it does not, since they have no `cmake`.
On a distribution without an AMD package repo the step warns and installs the ROCm tarball instead: into `/opt/rocm/core-X.Y` as root, otherwise under `RUNNER_TOOL_CACHE`. The tarball cannot bring a C++ compiler or `python3`, which `hipcc` needs, so install them first (e.g. `gcc-c++ python3` on Fedora, `gcc python` on Arch).
On Linux the 10.x install adds about 10 GB of disk and takes about one to two minutes; on Windows it takes about 85 s and adds about 9 GB.

A version outside the list is rejected with a clear error. Windows supports ROCm 10.x only.

## Known limitations

- `gfx: all` on Windows is untested. It selects the 4.5 GB `multiarch` tarball. `windows-2025` runners have only about 28 to 33 GB of free disk, so it may not fit.
- Only the `gfx120X-all` Windows family has been checked against the tarball contents. The mapping for the other families follows the file names.
- The legacy flow has no Ubuntu 26.04, Debian, RHEL or SLES support. On those distros use ROCm 10.0.0 or newer.
- Of the RHEL rebuilds, only AlmaLinux (and `manylinux_2_28`, which is based on it) is tested in CI. openSUSE Leap 16 is not tested in CI.
- On SLES and openSUSE Leap, AMD's packages do not create `/usr/bin/hipcc`. Use `hipcc` from `PATH`, where the step puts `$ROCM_PATH/bin`.
- The `registry.suse.com/bci/*` and `opensuse/leap` images declare no `PATH`. In those job containers, once the step adds `$ROCM_PATH/bin` to `PATH`, the runner runs later steps with only that directory on `PATH`, and they fail with `exec: "sh": executable file not found in $PATH`. Set `PATH` on the container:

  ```yaml
  container:
    image: registry.suse.com/bci/bci-base:16.0
    env:
      PATH: /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
  ```
- Anything marked "not tested" above is not covered by CI.

The facts the action relies on, how each was checked and what is still open are in
[`docs/RESEARCH.md`](docs/RESEARCH.md).

## Adding a ROCm version

1. Check that the version exists:
   - ROCm 10.x: the apt indexes at
     `https://stable.repo.amd.com/rocm/core/packages/<distro>/` must list
     `amdrocm-core-dev<MAJOR.MINOR>-<gfx>` (`-devel` in the `rhel*/x86_64` and
     `sles*/x86_64` RPM repos), and the tarballs
     `therock-dist-{linux,windows}-<family>-<version>.tar.gz` must exist under
     `https://stable.repo.amd.com/rocm/core/tarball/`.
   - ROCm 7.2.x and older: `https://repo.radeon.com/amdgpu-install/<dir>/ubuntu/<codename>/`
     must contain an `amdgpu-install_*_all.deb` (a `7.x.0` release lives in the
     directory `7.x`).
2. Add the version to `MULTIARCH_VERSIONS` or `LEGACY_VERSIONS` in
   [`src/versions.ts`](src/versions.ts).
3. Record what you verified in `docs/RESEARCH.md`. CI picks the new version up by
   itself: it tests the newest and the previous entry of `MULTIARCH_VERSIONS`
   and the newest of `LEGACY_VERSIONS`, read from `src/versions.ts`.
4. Run `npm run all`, and commit the rebuilt `dist/`.

## Development

```bash
npm ci
npm run all 
```

- TypeScript (strict, ESM), bundled by Rollup into `dist/index.js`, which is committed. The `Check dist` workflow fails if it is stale, and the pre-commit hook in `.githooks/` rebuilds it.
- The action runs on GitHub's `node24` runtime. Tooling uses Node 26 (`.nvmrc`), but `@types/node` is pinned to 24 so code cannot use newer-only APIs.
- Tests are Jest with the `@actions/*` modules mocked.

## Attribution & Disclaimer

Project structure is modeled on[Jimver/cuda-toolkit](https://github.com/Jimver/cuda-toolkit) (MIT).
No code or CUDA-specific tables were copied.

This is an independent project. "AMD", "ROCm" and "HIP" are trademarks of teh Advanced Micro Devices, Inc.

## License

Released under the MIT License. See [`LICENSE`](LICENSE).

The MIT License above covers this project's own code. The bundled`dist/index.js` also contains third-party packages,
which remain the copyright of their respective authors and are distributed under their own licenses. Their
license notices are in [`dist/licenses.txt`](dist/licenses.txt), which is generated on every build.

Copyright © 2026 Vedran Hrabar
