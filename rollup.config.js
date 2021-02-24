import commonjs from 'rollup-plugin-commonjs'
import nodeResolve from 'rollup-plugin-node-resolve'
import buble from 'rollup-plugin-buble'

export default [{
  input: 'src/index.js',
  plugins: [
    nodeResolve({
      browser: true
    }),
    commonjs(),
    buble()
  ],
  output: {
    file: 'dist/ubre.browser.js',
    format: 'esm'
  }
}, {
  input: 'src/index.js',
  external: ['crypto'],
  plugins: [
    nodeResolve(),
    commonjs(),
    buble()
  ],
  output: {
    file: 'dist/ubre.js',
    format: 'cjs',
    exports: 'default'
  }
}]
