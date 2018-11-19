![ubre](logo.svg)

[![NPM version](https://img.shields.io/npm/v/ubre.svg)](https://www.npmjs.com/package/ubre)
[![Size](https://img.shields.io/bundlephobia/minzip/ubre.svg)]()
[![Gitter Chat](https://img.shields.io/gitter/room/porsager/ubre.svg)]()

**A Javascript library implementing the lightweight [UBRE](UBRE.md) text protocol for p2p, client and server use.**

Ubre is by itself transport agnostic, and the base of this library simply gives you some hooks to tie ubre messages with the transport of your choosing.

There are pre hooked versions to set up Ubre easily over WebSockets on the client and server.

## WebSocket server
```js
const ws = require('ws')
    , Ubre = require('ubre')

const server = ws.Server({ port: 5000 })
const ubre = Ubre(server)

ubre.handle('echo', x => x)

setInterval(() =>
  ubre.publish('ping', new Date())
)
```

## WebSocket client
```js
import Pws from 'pws'
import Ubre from 'ubre'

const socket = new Pws('ws://localhost:5000')
const ubre = Ubre(socket)

ubre.request('echo', 'hello').then(x =>
  x // hello
)

ubre.subscribe('ping', date => 
  date // eg. '2018-11-19T21:50:05.679Z'
)
```

## Manual hookup - WebSocket Client example 

```js
import Ubre from 'ubre'
import Pws from 'pws'

// Establish a reconnecting websocket.
const ws = new Pws('ws://localhost:4663')

const ubre = Ubre({
  // Ubre will call send to have you put it through your connection
  send: message => ws.send(message)
})

// When a message is received pass it on to ubre for handling
ws.onmessage = ({ target, data }) => ubre.message(data, target)

// Tell ubre when a connection is open to send queued messages
ws.onopen = () => ubre.open()

// Throw pending requests and mark subscriptions for resubscription
ws.onclose = () => ubre.close()

// Subscribe to the news topic
ubre.subscribe('news', news =>
  // Do things with the news
)

// Request /users
ubre.request('/users').then(users =>
  // Do something with the users
)
```

## Manual hookup - WebSocket Server example

```js
const Ubre = require('ubre')
    , WebSocket = require('ws')
    , db = require('./db')

const wss = new WebSocket.Server({
  port: 4663
})

const ubre = Ubre({
  send: (message, ws) => ws.send(message)
})

// Register request handlers
ubre.handle('/users', (message, ws) =>
  db.any('select * from users')
)

wss.on('connection', ws => {
  // Pass messages to ubre including a unique identifier for the target
  ws.on('message', data => ubre.message(data, ws))

  // Clean up when connection is closed
  ws.on('close', () => ubre.close(ws))

  // Publish some news
  ubre.publish('news', {
    title: 'Short News',
    content: 'News these days are very short'
  })
})
```


