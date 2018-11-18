import Ubre from './ubre'

export default (ws, options) =>
  'clients' in ws
    ? server(ws, options)
    : client(ws, options)

function client(ws, options) {
  const ubre = Ubre({
    send: message => ws.send(message),
    ...options
  })
  ws.onmessage = ({ target, data }) => ubre.message(data, target)
  ws.onopen = () => ubre.open()
  ws.onclose = () => ubre.close()

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
