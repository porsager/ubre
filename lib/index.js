const uuid = require('uuid/v4')

module.exports = ({
  send = (message, target) => { throw new Error('Send not implemented') },
  open = false,
  deserialize = JSON.parse,
  serialize = JSON.stringify
}) => {
  const subscriptions = MapSet()
      , subscribers = MapSet()
      , responses = new Map()
      , requests = new Map()
      , handlers = new Map()

  const parse = {
    subscribe,
    unsubscribe,
    publish,
    request,
    response,
    cancel
  }

  const message = format(parse)

  function ubre(target) {
    return Object.create(ubre, {
      target: {
        writable: false,
        configurable: false,
        value: target
      }
    })
  }

  ubre.message = (message, from) => {
    const idx = message.indexOf('\n')
        , header = idx > -1 ? message.slice(0, idx) : message
        , [type, ...args] = header.split(' ')
        , body = idx > -1 && message.slice(idx + 1)

    if (type in parse)
      parse[type](from, args, body && deserialize(body))
  }

  ubre.publish = (topic, body) => {
    subscribers.has(topic) && subscribers.get(topic).forEach(s =>
      send(message.publish(topic, body), s)
    )
  }

  ubre.subscribe = function(topic, body, fn) {
    if (arguments.length === 2) {
      fn = body
      body = undefined
    }

    open && send(message.subscribe(topic, body), this.target)
    const subscription = { body, fn, sent: open }
    subscriptions.add(topic, subscription)

    return {
      unsubscribe: () => {
        open && send(message.unsubscribe(topic), this.target)
        subscriptions.remove(topic, subscription)
      }
    }
  }

  ubre.request = function(url, body, id) {
    id = id || uuid()
    const promise = new Promise((resolve, reject) => {
      requests.set(id, { resolve, reject, url, body, sent: open, target: this.target })
    }).then(result => (
      requests.delete(id),
      result
    )).catch(err => {
      requests.delete(id)
      throw err
    })

    open && send(message.request([id, url], body), this.target)
    return promise
  }

  ubre.handle = (url, fn) => {
    handlers.set(url, fn)
  }

  ubre.open = (target) => {
    open = true

    subscriptions.forEach((s, topic) => s.forEach(m => !m.sent && (
      send(message.subscribe(topic, m.body)),
      m.sent = true
    )))

    requests.forEach((r, id) => !r.sent && (
      send(message.request([id, r.url], r.body), r.target),
      r.sent = true
    ))
  }

  ubre.close = function() {
    if (this.target) {
      subscribers.removeItems(this.target)
      responses.forEach((target, id) => {
        target === this.target && responses.delete(id)
      })
    } else {
      open = false
      subscriptions.forEach(s => s.forEach(m => m.sent = false))
      requests.forEach(promise => promise.reject(new Error('Closed')))
      responses.clear()
    }
  }

  return ubre

  function subscribe(from, [topic]) {
    subscribers.add(topic, from)
  }

  function unsubscribe(from, [topic]) {
    subscribers.remove(topic, from)
  }

  function publish(from, [topic], body) {
    subscriptions.has(topic) && subscriptions.get(topic).forEach(s => s.fn(body))
  }

  function request(from, [id, url], data) {
    if (!handlers.has(url))
      return send(message.response(id, { error: 'No handler found' }), from)

    responses.set(id, from)
    Promise.resolve(handlers.get(url)(data, from)).then(r => {
      if (responses.has(id)) {
        send(message.response(id, r), from)
        responses.delete(id)
      }
    })
  }

  function response(from, [id], body) {
    requests.has(id) && requests.get(id).resolve(body)
  }

  function cancel(from, [id]) {
    requests.has(id) && requests.get(id).reject(new Error('Canceled'))
  }

  function format(xs) {
    return Object.keys(xs).reduce((acc, x) => (
      acc[x] = (args, body) => [x].concat(args).join(' ') + (body ? '\n' + serialize(body) : ''),
      acc
    ), {})
  }
}

function MapSet() {
  const map = new Map()

  return {
    add: (key, item) => (map.get(key) || map.set(key, new Set()).get(key)).add(item),
    has: map.has.bind(map),
    get: map.get.bind(map),
    delete: map.delete.bind(map),
    clear: map.clear.bind(map),
    forEach: map.forEach.bind(map),
    removeItems: item => map.forEach(set => set.delete(item)),
    remove: (key, item) => {
      const set = map.get(key)
      set && set.delete(item)
      set.size === 0 && map.delete(key)
    }
  }
}
