import Ubre from './ubre'

export function client(ws, options) {
  options = options || {}
  if (typeof options.send !== 'function')
    options.send = message => ws.send(message)

  const ubre = Ubre(options)

  ws.addEventListener('message', (e) => e.data && e.data[0] === '{' && ubre.message(e.data, ws))
  ws.addEventListener('open', () => ubre.open())
  ws.addEventListener('close', () => ubre.close())

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
  ubre.wss = server
  server.on('connection', ws => {
    ws.on('message', data => data[0] === '{' && ubre.message(data, ws))
    ws.on('close', () => ubre(ws).close())
  })

  return ubre
}
