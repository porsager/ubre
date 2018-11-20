![ubre](logo.svg)

UBRE is a small text protocol for message passing supporting pub/sub & request/response (rpc).

It can be used on any kind of connection that supports sending / receiving messages, but was created with websockets in mind. It should be easy to use for communicating through iframes, service workers and similar avenues.

It is not concerned with deliverability or connection management, but is intended simply as a format to handle passing of messages.

You can find an implementation of UBRE in javascript which can be used on the server, and in the browser. 

## Message Formats

All message formats start the first line with the type of message and metadata to complete that message.

```
type meta data
payload
```

eg.
```
publish news
{"title":"Some News","content":"Short news"}
```

The following line / lines contain an optional payload for the message.

### pub / sub 

> publish, subscribe, events

Used to subscribe / publish to various topics. The topic format and handling is entirely up to the client.

#### `subscribe`

```
subscribe topic
```

#### `publish`

```
publish topic
payload
```

#### `unsubscribe`

```
unsubscribe topic
```

### req / res

> rpc, rest, graphql

#### `request`

```
request id path
payload
```

#### `cancel`

```
cancel id
```

#### `success`

```
success id
payload
```

#### `success`

```
fail id
payload
```
