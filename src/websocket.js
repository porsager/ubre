import Ubre from './ubre'

export function client(ws, options) {
  options = options || {}
  if (typeof options.send !== 'function')
    options.send = message => ws.send(message)

  const ubre = Ubre(options)

  ;(ws.addEventListener || ws.on).call(ws, 'message', (e) => {
    e.target === ws
      ? ubre.message(e.data, e.target)
      : ubre.message(e, ws)
  })
  ;(ws.addEventListener || ws.on).call(ws, 'open', () => ubre.open())
  ;(ws.addEventListener || ws.on).call(ws, 'close', () => ubre.close())

  ubre.ws = ws

  return ubre
}

export function server(server, options) {
  options = options || {}
  if (typeof options.send !== 'function')
    options.send = (message, ws) => ws.send(message)

  if (!('open' in options))
    options.open = true

  const ubre = Ubre(options)

  server.on('connection', ws => {
    ws.on('message', data => ubre.message(data, ws))
    ws.on('close', () => ubre(ws).close())
  })

  return ubre
}
