![ubre](logo.svg)

***WARNING** *This is still alpha stage - expect breaking changes*

**UBRE is a small json spec for message passing supporting pub/sub & request/response (rpc).**

It can be used on any kind of connection that supports sending / receiving json messages, but was created with websockets in mind. It should be easy to use for communicating through iframes, service workers and similar avenues.

It is not concerned with deliverability or connection management, but is intended simply as a format to handle passing of messages.

You can find an implementation of UBRE in javascript which can be used on the server, and in the browser. 

## Message Formats

All messages must include a type and name, and can include an id & body depending on type.

```
{
    "type": "..."
}
```

eg.
```
publish news
{
    "type": "publish",
    "name": "news",
    "body": {
        "title":"Some News",
        "content":"Short news"
    }
}
```

### pub / sub 

> publish, subscribe, events

Used to subscribe / publish. The handling of subscriptions according to the name is entirely up to the client.

#### `subscribe`

```
{
    "type": "subscribe",
    "name": "some topic"
}
```

#### `publish`

```
{
    "type": "publish",
    "name": "some topic",
    "body": "some topic data"
}
```

#### `unsubscribe`

```
{
    "type": "unsubscribe",
    "name": "some topic"
}
```

### req / res

> rpc, rest, graphql

#### `request`

```
{
    "type": "request",
    "id": "uniqueid",
    "name": "some request",
    "body": "some request body"
}
```

#### `success`

```
{
    "type": "success",
    "id": "uniqueid",
    "body": "some success data"
}
```

#### `fail`

```
{
    "type": "fail",
    "id": "uniqueid",
    "body": "some fail data"
}
```
