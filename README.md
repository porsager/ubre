![ubre](logo.svg)

***WARNING** *This is still alpha stage - expect breaking changes*

[![NPM version](https://img.shields.io/npm/v/ubre.svg)](https://www.npmjs.com/package/ubre)
[![Size](https://img.shields.io/bundlephobia/minzip/ubre.svg)]()
[![Gitter Chat](https://img.shields.io/gitter/room/porsager/ubre.svg)]()
[![license](https://img.shields.io/github/license/porsager/ubre.svg)]()

**A Javascript library implementing the lightweight [UBRE](UBRE.md) text protocol for p2p, client and server use.**

Ubre is by itself transport agnostic, and the base of this library simply gives you some hooks to tie ubre messages with the transport of your choosing.

There are pre hooked versions to set up Ubre easily over WebSockets on the client and server.

## Getting started
You can initialize `Ubre` in various ways. The simplest form is using one of the pre defined wrappers.

Here's a simple example using the WebSocket wrapper setting up both a server and client.

#### WebSocket server
```js
const ws = require('ws')
    , Ubre = require('ubre')

const server = ws.Server({ port: 5000 })
const ubre = Ubre.ws(server)

ubre.handle('echo', x => x)

setInterval(() =>
  ubre.publish('ping', new Date())
)
```

#### WebSocket client
```js
import Pws from 'pws'
import Ubre from 'ubre'

const socket = new Pws('ws://localhost:5000')
const ubre = Ubre.ws(socket)

ubre.request('echo', 'hello').then(x =>
  x // hello
)

ubre.subscribe('ping', date =>
  date // eg. '2018-11-19T21:50:05.679Z'
)
```

## Request / Response (RPC)

The request / response method is fairly straight forward. You can send a request to a specific namespace with an arbitrary payload, and a promise is returned which respolves once the recipient returns either success or failure.

#### Make a request
```js
ubre.request('launch', {
  code: 42
})
.then(result => 'Launched with result')
.catch(error => 'Oh noes - wrong code')
```

To handle a request you register a function for a namespace which returns your response directly or as a promise
#### Handle requests
```js
ubre.handle('launch', ({ code }) =>
  launchCodes.get(code)
)
```

## Pub / Sub

The publish / subscribe setup is equally simple. No wildcard matching just direct namespaces / topics as with RPC. To subscribe, simply specify the topic and a callback function to be called whenever something is published.

```js
ubre.subscribe('news', news => {
  // Something new
})
```

Publishing is equally simple, just do.
```js
ubre.publish('news', { title: 'Short news', content: 'News are new' })
```

## Options

#### `send: Function (data, target) -> `
Ubre will call the `send` function to have you handle pushing the message over your chosen transport.

#### `open: Boolean`
Open is used for clients or servers that you know will always have an open connection.

#### `serialize: Function a -> b`


#### `deserialize: Function a -> b`

## Methods

#### `.message(data, target)`
This function is used to push messages following the ubre protocol from senders for ubre to handle. 

## More examples

#### Manual hookup - WebSocket Client example 

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

#### Manual hookup - WebSocket Server example

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


