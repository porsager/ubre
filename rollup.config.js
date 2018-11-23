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
    buble({
      objectAssign: 'Object.assign'
    })
  ],
  output: {
    file: 'dist/index.browser.js',
    format: 'esm'
  }
}, {
  input: 'src/index.js',
  plugins: [
    nodeResolve(),
    commonjs(),
    buble({
      objectAssign: 'Object.assign'
    })
  ],
  output: {
    file: 'dist/index.js',
    format: 'cjs'
  }
}]
