import { jest } from '@jest/globals'
import type { Platform } from '../src/platform.js'

const core = {
  getInput: jest.fn<(name: string) => string>(),
  info: jest.fn(),
  setFailed: jest.fn()
}
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('../src/windows.js', () => ({
  installWindows: jest.fn()
}))
jest.unstable_mockModule('../src/linux/legacy.js', () => ({
  installLegacy: jest.fn()
}))
const installMultiArch = jest.fn<(...args: unknown[]) => Promise<string>>()
jest.unstable_mockModule('../src/linux/index.js', () => ({ installMultiArch }))
const failureMessage = jest.fn(
  (error: unknown, plan?: unknown) =>
    `${(error as Error).message}${plan ? ' [with context]' : ''}`
)
jest.unstable_mockModule('../src/context.js', () => ({ failureMessage }))
const detectPlatform = jest.fn()
jest.unstable_mockModule('../src/platform.js', () => ({ detectPlatform }))

const { makePlan, run } = await import('../src/main.js')

const raw = {
  version: '10.1.0',
  gfx: 'gfx1200',
  components: 'dev',
  useCache: 'true',
  logFileSuffix: 'log.txt'
}
const linux = {
  os: 'linux' as const,
  arch: 'x64',
  distro: 'ubuntu2404',
  packageManager: 'apt' as const
}

describe('makePlan', () => {
  it('selects multiarch for 10.x', () => {
    expect(makePlan(raw, () => linux).scheme).toBe('multiarch')
  })

  it('selects legacy for 7.0.1', () => {
    expect(makePlan({ ...raw, version: '7.0.1' }, () => linux).scheme).toBe(
      'legacy'
    )
  })

  it('fails fast on a bad version before doing anything', () => {
    expect(() =>
      makePlan({ ...raw, version: '10.1.0; id' }, () => linux)
    ).toThrow(/Invalid ROCm version/)
  })

  it('does not detect the platform when inputs are invalid', () => {
    const detect = jest.fn<() => typeof linux>()
    expect(() => makePlan({ ...raw, gfx: 'nope' }, detect)).toThrow(
      /Invalid gfx/
    )
    expect(detect).not.toHaveBeenCalled()
  })
})

describe('run', () => {
  beforeEach(() => {
    detectPlatform.mockReturnValue(linux)
  })

  it('installs through dnf on a RHEL-family distro', async () => {
    core.getInput.mockImplementation(
      (name) => (raw as Record<string, string>)[name] ?? ''
    )
    const rhel: Platform = { ...linux, distro: 'rhel9', packageManager: 'dnf' }
    detectPlatform.mockReturnValue(rhel)
    installMultiArch.mockRejectedValueOnce(new Error('stop here'))
    await run()
    expect(installMultiArch).toHaveBeenCalledWith(
      expect.objectContaining({ version: '10.1.0' }),
      'rhel9',
      expect.objectContaining({ kind: 'dnf' })
    )
  })

  it('adds the install context when an install fails', async () => {
    core.getInput.mockImplementation(
      (name) => (raw as Record<string, string>)[name] ?? ''
    )
    installMultiArch.mockRejectedValueOnce(new Error('apt-get failed'))
    await run()
    expect(failureMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'apt-get failed' }),
      expect.objectContaining({ platform: linux, scheme: 'multiarch' })
    )
    expect(core.setFailed).toHaveBeenCalledWith('apt-get failed [with context]')
  })

  it('reports invalid input through setFailed', async () => {
    core.getInput.mockImplementation((name) =>
      name === 'version' ? 'nonsense' : ''
    )
    await run()
    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringMatching(/Invalid ROCm version|Unsupported/)
    )
  })
})

describe('makePlan per package manager', () => {
  const on =
    (distro: string, packageManager: 'apt' | 'dnf' | 'zypper') =>
    (): Platform => ({ os: 'linux', arch: 'x64', distro, packageManager })

  it('accepts ROCm 10.x on a dnf distro', () => {
    const plan = makePlan(raw, on('rhel9', 'dnf'))
    expect(plan.scheme).toBe('multiarch')
    expect(plan.platform.packageManager).toBe('dnf')
  })

  it('rejects zypper until it has a flow', () => {
    expect(() => makePlan(raw, on('sles15', 'zypper'))).toThrow(
      /Detected sles15, which uses zypper\..*apt .* and dnf .* only; sles15 is not supported yet/
    )
  })

  it('rejects a Linux platform without a package manager', () => {
    expect(() =>
      makePlan(raw, () => ({ os: 'linux', arch: 'x64', distro: 'x' }))
    ).toThrow(/which uses an unknown package manager/)
  })

  it('rejects legacy versions on a dnf distro before doing anything', () => {
    expect(() =>
      makePlan({ ...raw, version: '7.2.4' }, on('rhel8', 'dnf'))
    ).toThrow(
      /ROCm 7\.2\.4 is not available on rhel8\..*use ROCm 10\.0\.0 or newer/
    )
  })

  it('keeps legacy versions on apt', () => {
    expect(
      makePlan({ ...raw, version: '7.2.4' }, on('ubuntu2404', 'apt')).scheme
    ).toBe('legacy')
  })
})
