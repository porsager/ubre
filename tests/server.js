import Ubre from '../src/index.js'
import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({
  port: 3000
})

const ubre = Ubre({
  // Send includes the target given in ubre.message() below
  send: (message, ws) => console.log(10, message) || ws.send(message),
  // We're a server, so this connection is open by default
  open: true
})

// Handle all requests for users
ubre.handle('users', (message, ws) => 'well hello there')

setInterval(() =>
  // Publish some news regularly
  ubre.publish('news', { title: 'Short', content: 'News' })
, 2000)

wss.on('connection', ws => {
  // Pass data to ubre including a unique identifier for the target
  ws.on('message', data => console.log(25, data) || ubre.message(data, ws))

  // Clean up when connection is closed
  ws.on('close', () => ubre(ws).close())

  // Send a request to authenticate
  ubre(ws).request('authenticate').then(({ user, password, session }) =>
    {console.log(user, password, session)}// Do something to login
  ).catch(console.log)
})
