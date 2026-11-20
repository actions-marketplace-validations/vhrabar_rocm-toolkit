import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'
import license from 'rollup-plugin-license'

/** @type {import('rollup').RollupOptions} */
export default {
  input: 'src/index.ts',
  output: {
    esModule: true,
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true,
    inlineDynamicImports: true
  },
  onwarn(warning, warn) {
    // Third-party noise from bundled @actions/* packages
    if (warning.id?.includes('node_modules')) return
    if (warning.code === 'CIRCULAR_DEPENDENCY') return
    warn(warning)
  },
  plugins: [
    typescript({ tsconfig: './tsconfig.build.json' }),
    nodeResolve({ preferBuiltins: true }),
    commonjs(),
    json(),
    // Bundled third-party code must ship with its license notices
    license({
      thirdParty: {
        includePrivate: false,
        includeSelf: false,
        output: {
          file: 'dist/licenses.txt'
        }
      }
    })
  ]
}
