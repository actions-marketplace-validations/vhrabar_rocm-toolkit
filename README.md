# rocm-toolkit

> **Unofficial.** This project is not affiliated with, endorsed by, or sponsored by AMD. "AMD", "ROCm", and "HIP" are trademarks
> of Advanced Micro Devices, Inc. (AMD) and are used here only to describe what the action installs.

Unofficial GitHub Action that installs AMD ROCm (HIP, compilers, libraries) on Ubuntu runners, in Ubuntu, Debian, RHEL-family (including `manylinux_2_28`),
SLES and openSUSE Leap job containers, and on Windows runners. 
Pick a ROCm version and a GPU target, get `hipcc` on `PATH`, and the environment variables you need to build.

```yaml
- uses: vhrabar/rocm-toolkit@v1
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
      - uses: vhrabar/rocm-toolkit@v1
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
      - uses: vhrabar/rocm-toolkit@v1
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
      - uses: vhrabar/rocm-toolkit@v1
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
      - uses: vhrabar/rocm-toolkit@v1
        with:
          version: '10.2.0'
          gfx: gfx1200
```

### CMake

`ROCM_PATH` is set after the step, so it can be passed straight to CMake. 
See[`.github/smoke`](.github/smoke) for a project that builds against hip, rocBLAS, rocFFT, rocRAND, rocSPARSE, rocSOLVER, their hip-prefixed counterparts, hipCUB, rocPRIM and rocThrust.
Note that rocPRIM, hipCUB and rocThrust need C++17, which clang does not select by default on Windows.

## Inputs

| Name | Default | Description |
| --- | --- | --- |
| `version` | **required**, no default | ROCm version, `MAJOR.MINOR.PATCH`, e.g. `10.2.0`. Must be in the [supported list](#supported-versions-and-platforms). Pinning it means a workflow never changes ROCm version on its own. |
| `gfx` | `all` | GPU target, for example `gfx1200`. Comma-separated for several. `all` installs every architecture, which is **large**; set a target whenever you can. |
| `components` | `dev` | Linux only: comma-separated `runtime`, `dev`, `sdk`, `developer-tools`, `opencl`. `dev` is what you need to compile. Ignored on Windows (the tarball is installed whole). |
| `use-cache` | `true` | Accepted but currently has no effect (WIP). |
| `log-file-suffix` | `log.txt` | Accepted but currently has no effect (WIP). |

## Outputs

| Name | Description |
| --- | --- |
| `ROCM_PATH` | Absolute path of the ROCm installation root. |
| `version` | The ROCm version that was installed. |

## What the step sets up

| | Linux, ROCm 10.x | Linux, ROCm 7.2.x and older | Windows, ROCm 10.x |
| --- | --- | --- | --- |
| Install location | `/opt/rocm/core-<MAJOR.MINOR>` | `/opt/rocm-<version>` | `C:\rocm\core-<MAJOR.MINOR>` |
| Source | `stable.repo.amd.com` apt repository | `repo.radeon.com` (`amdgpu-install` package, then `rocm-hip-runtime-dev`) | tarball from `stable.repo.amd.com`, streamed into `tar` |
| `gfx` | per-architecture packages | no effect (not packaged per architecture) | maps to a tarball family; several families or `all` use the `multiarch` tarball |

For later steps the action exports `ROCM_PATH` and `HIP_PATH`, adds the `bin`directory to `PATH`, and:

- on Linux, adds `<root>/lib` to `LD_LIBRARY_PATH`;
- on Windows, also sets `HIP_DEVICE_LIB_PATH` to `<root>\lib\llvm\amdgcn\bitcode`. Without it, clang cannot find the device libraries once `ROCM_PATH` points at the root of the Windows tarball.

The apt repository's signing key is checked against a pinned fingerprint before it is trusted.

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

A version outside the lis is rejected with a clear error. Windows supports ROCm 10.x only.

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
   - ROCm 10.x: the apt index at
     `https://stable.repo.amd.com/rocm/core/packages/<distro>/` must list
     `amdrocm-core-dev<MAJOR.MINOR>-<gfx>`, and the Windows tarball
     `therock-dist-windows-<family>-<version>.tar.gz` must exist under
     `https://stable.repo.amd.com/rocm/core/tarball/`.
   - ROCm 7.2.x and older: `https://repo.radeon.com/amdgpu-install/<dir>/ubuntu/<codename>/`
     must contain an `amdgpu-install_*_all.deb` (a `7.x.0` release lives in the
     directory `7.x`).
2. Add the version to `MULTIARCH_VERSIONS` or `LEGACY_VERSIONS` in
   [`src/versions.ts`](src/versions.ts).
3. Update the version used by the CI jobs if you want it covered, and record what
   you verified in `docs/RESEARCH.md`.
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
