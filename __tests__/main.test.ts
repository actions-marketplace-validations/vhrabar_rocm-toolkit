import { jest } from '@jest/globals'

const core = {
  getInput: jest.fn<(name: string) => string>(),
  info: jest.fn(),
  setFailed: jest.fn()
}
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('../src/windows.js', () => ({
  installWindows: jest.fn()
}))
jest.unstable_mockModule('../src/legacy.js', () => ({
  installLegacy: jest.fn()
}))
jest.unstable_mockModule('../src/linux.js', () => ({
  installMultiArch: jest.fn()
}))

const { makePlan, run } = await import('../src/main.js')

const raw = {
  version: '10.1.0',
  gfx: 'gfx1200',
  components: 'dev',
  useCache: 'true',
  logFileSuffix: 'log.txt'
}
const linux = { os: 'linux' as const, arch: 'x64', distro: 'ubuntu2404' }

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
