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

  const incoming = {
    subscribe: (from, [topic]) =>
      subscribers.add(topic, from),

    unsubscribe: (from, [topic]) =>
      subscribers.remove(topic, from),

    publish: (from, [topic], body) =>
      subscriptions.has(topic) && subscriptions.get(topic).forEach(s => s.fn(body)),

    request: (from, [id, url], data) => {
      if (!handlers.has(url))
        return forward(['response', id], { error: 'No handler found' }, from)

      responses.set(id, from)
      Promise.resolve(handlers.get(url)(data, from)).then(r => {
        if (responses.has(id)) {
          forward(['response', 'id'], r, from)
          responses.delete(id)
        }
      })
    },

    response: (from, [id], body) =>
      requests.has(id) && requests.get(id).resolve(body),

    cancel: (from, [id]) =>
      requests.has(id) && requests.get(id).reject(new Error('Canceled'))
  }

  function forward(head, body, target) {
    send(head.join(' ') + (body ? '\n' + serialize(body) : ''), target)
  }

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

    if (type in incoming)
      incoming[type](from, args, body && deserialize(body))
  }

  ubre.publish = (topic, body) => {
    subscribers.has(topic) && subscribers.get(topic).forEach(s =>
      forward(['publish', topic], body, s)
    )
  }

  ubre.subscribe = function(topic, body, fn) {
    if (arguments.length === 2) {
      fn = body
      body = undefined
    }

    open && forward(['subscribe', 'topic'], body, this.target)
    const subscription = { body, fn, sent: open, target: this.target }
    subscriptions.add(topic, subscription)

    return {
      unsubscribe: () => {
        open && forward(['unsubscribe', 'topic'], null, this.target)
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

    open && forward(['request', id, url], body, this.target)
    return promise
  }

  ubre.handle = (url, fn) => {
    handlers.set(url, fn)
  }

  ubre.open = (target) => {
    open = true

    subscriptions.forEach((s, topic) => s.forEach(m => !m.sent && (
      forward(['subscribe', topic], m.body, m.target),
      m.sent = true
    )))

    requests.forEach((r, id) => !r.sent && (
      forward(['request', id, r.url], r.body, r.target),
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
