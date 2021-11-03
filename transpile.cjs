const fs = require('fs')
    , path = require('path')

const cjs = 'cjs'
    , src = 'src'

!fs.existsSync(cjs) && fs.mkdirSync(cjs)

fs.readdirSync(src).forEach(name =>
  fs.writeFileSync(
    path.join(cjs, name),
    transpile(fs.readFileSync(path.join(src, name), 'utf8'))
  )
)

fs.writeFileSync(path.join(cjs, 'package.json'), JSON.stringify({ type: 'commonjs' }))

function transpile(x) {
  return x.replace(/export default function ([^(]+)/, 'module.exports = $1;function $1')
          .replace(/export class ([^ ]+) ([\s\S]+)/, 'class $1 $2;module.exports.$1 = $1')
          .replace(/export default /, 'module.exports = ')
          .replace(/export const ([a-z0-9_$]+)/gi, 'const $1 = module.exports.$1')
          .replace(/export function ([a-z0-9_$]+)/gi, 'module.exports.$1 = function $1')
          .replace(/import {([^{}]*?)} from (['"].*?['"])/gi, 'const {$1} = require($2)')
          .replace(/import (.*?) from (['"].*?['"])/gi, 'const $1 = require($2)')
          .replace(/import (['"].*?['"])/gi, 'require($1)')
}
