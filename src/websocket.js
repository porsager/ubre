import Ubre from './ubre'

export default (ws, options) =>
  typeof ws.address === 'function'
    ? server(ws, options)
    : client(ws, options)

function client(ws, options) {
  const ubre = Ubre({
    send: message => ws.send(message),
    ...options
  })

  ws.addEventListener('message', ({ target, data }) => ubre.message(data, target))
  ws.addEventListener('open', () => ubre.open())
  ws.addEventListener('close', () => ubre.close())

  ubre.ws = ws

  return ubre
}

function server(server, options) {
  const ubre = Ubre({
    send: (message, ws) => ws.send(message),
    open: true,
    ...options
  })

  server.on('connection', ws => {
    ws.on('message', data => ubre.message(data, ws))
    ws.on('close', () => ubre(ws).close())
  })

  return ubre
}
