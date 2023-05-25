![ubre](ubre.svg)

**Ubre is a small spec for supporting pub/sub & request/response message passing.**

It can be used on any kind of connection that supports sending / receiving text/binary messages, but was created with websockets in mind. It should be easy to use for communicating through iframes, service workers and similar avenues.

The design is simple to nest recursively to create tunnels/proxies through UBRE itself.

It is not concerned with deliverability or connection management, but is intended simply as a comman format for req/res and pub/sub messaging.

You can find an implementation of UBRE in javascript which can be used on the server, and in the browser. 

## JSON Message Format

### pub / sub

> publish, subscribe, events

Used to subscribe / publish. The handling of subscriptions according to the name is entirely up to the client.

#### `subscribe`

```
{
    "subscribe": "some topic"
}
```

#### `publish`

```
{
    "publish": "some topic",
    ["body": "some topic data"]
}
```

#### `unsubscribe`

```
{
    "unsubscribe": "some topic"
}
```

### req / res

> rpc, rest, graphql

#### `request`

```
{
    "request": "unique id",
    ["body": "some request body"]
}
```

#### `success`

```
{
    "success": "id",
    ["body": "some success data"]
}
```

#### `fail`

```
{
    "fail": "id",
    ["body": "some fail data"]
}
```

## Binary Message Format

The binary message format consists of a header with the message type(uint8), topic length(uint16) and body length(uint32) in network byte order (big endian - most significant byte first). Then comes the topic, and the body. If the body length is 0 no body is included. If the body length is -1 the body is expected to be streaming, and data should be read until the message ends.

The topic format or body format is not defined by the protocol and is completely up to the user how to encode/decode.

The message types are as follows:

| Type      | ASCII | Hex  | Decimal |
|-----------|-------|------|---------|
| Subscribe | S     | 0x53 | 83      |
| Publish   | P     | 0x50 | 80      |
| Request   | R     | 0x52 | 82      |
| success   | s     | 0x73 | 115     |
| fail      | f     | 0x63 | 102     |

That means a complete message looks like this:

| Part         | Length | Content               |
|--------------|--------|-----------------------|
| Type         | uint8  | S \| P \| R \| s \| f |
| Name length  | uint16 | length                |
| Body length  | uint32 | 0 \| -1 \| length     |
| Name content | ...    | byte(name length)     |
| Body content | ...    | byte(body length)     |
