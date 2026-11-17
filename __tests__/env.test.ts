import { jest } from '@jest/globals'

const core = {
  exportVariable: jest.fn(),
  addPath: jest.fn(),
  setOutput: jest.fn()
}
jest.unstable_mockModule('@actions/core', () => core)

const { applyEnv, buildEnv, mergeLibraryPath } = await import('../src/env.js')

describe('buildEnv', () => {
  it('builds posix paths on linux', () => {
    expect(buildEnv('/opt/rocm', 'linux')).toEqual({
      rocmPath: '/opt/rocm',
      hipPath: '/opt/rocm',
      binDir: '/opt/rocm/bin',
      libDir: '/opt/rocm/lib'
    })
  })

  it('builds windows paths on windows', () => {
    const env = buildEnv('C:\\Program Files\\AMD\\ROCm\\6.2', 'windows')
    expect(env.binDir).toBe('C:\\Program Files\\AMD\\ROCm\\6.2\\bin')
  })
})

describe('mergeLibraryPath', () => {
  it('prepends and dedupes', () => {
    expect(mergeLibraryPath('/a', '/b:/a:/c')).toBe('/a:/b:/c')
  })

  it('handles an unset value', () => {
    expect(mergeLibraryPath('/a', undefined)).toBe('/a')
  })
})

describe('applyEnv', () => {
  it('exports variables, PATH and outputs on linux', () => {
    applyEnv(buildEnv('/opt/rocm', 'linux'), 'linux', '10.1.0')
    expect(core.exportVariable).toHaveBeenCalledWith('ROCM_PATH', '/opt/rocm')
    expect(core.exportVariable).toHaveBeenCalledWith('HIP_PATH', '/opt/rocm')
    expect(core.addPath).toHaveBeenCalledWith('/opt/rocm/bin')
    expect(core.exportVariable).toHaveBeenCalledWith(
      'LD_LIBRARY_PATH',
      expect.stringContaining('/opt/rocm/lib')
    )
    expect(core.setOutput).toHaveBeenCalledWith('version', '10.1.0')
  })

  it('does not set LD_LIBRARY_PATH on windows', () => {
    applyEnv(buildEnv('C:\\r', 'windows'), 'windows', '6.2.2')
    expect(core.exportVariable).not.toHaveBeenCalledWith(
      'LD_LIBRARY_PATH',
      expect.anything()
    )
  })
})
