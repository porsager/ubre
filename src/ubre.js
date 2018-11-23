import uuid from 'uuid/v4'

export default Ubre

const noop = () => { /* noop */ }

function Ubre({
  send = noop,
  open = false,
  deserialize = JSON.parse,
  serialize = JSON.stringify
}) {
  const subscriptions = MapSet()
      , subscribers = MapSet()
      , tasks = new Map()
      , requests = new Map()
      , handlers = new Map()

  const incoming = {
    subscribe: function(from, [topic]) {
      !subscribers.has(topic) && ubre.onTopicStart(topic)
      subscribers.add(topic, from)
      ubre.onSubscribe(topic, from)
    },

    unsubscribe: function(from, [topic]) {
      subscribers.remove(topic, from)
      !subscribers.has(topic) && ubre.onTopicEnd(topic)
      ubre.onUnsubscribe(topic, from)
    },

    publish: (from, [topic], body) =>
      subscriptions.has(topic) && subscriptions.get(topic).forEach(s => (
        (!s.target || s.target === from) && s.fn(body)
      )),

    request: (from, [id, url], data) => {
      if (!handlers.has(url))
        return forward(['fail', id], new Error('NotFound'), from)

      tasks.set(id, from)
      Promise.resolve(handlers.get(url)(data, from))
      .then(result => {
        tasks.has(id) && (
          forward(['success', id], result, from),
          tasks.delete(id)
        )
      })
      .catch(error => {
        tasks.has(id) && (
          forward(['fail', id], error, from),
          tasks.delete(id)
        )
      })
    },

    success: (from, [id], body) => {
      requests.has(id) && requests.get(id).resolve(body)
      requests.delete(id)
    },

    fail: (from, [id], body) => {
      requests.has(id) && requests.get(id).reject(body)
      requests.delete(id)
    },

    cancel: (from, [id]) =>
      tasks.delete(id)
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

  ubre.onTopicStart = noop
  ubre.onTopicEnd = noop
  ubre.onSubscribe = noop
  ubre.onUnsubscribe = noop

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

    open && forward(['subscribe', topic], body, this.target)
    const subscription = { body, fn, sent: open, target: this.target }
    subscriptions.add(topic, subscription)

    return {
      unsubscribe: () => {
        open && forward(['unsubscribe', topic], null, this.target)
        subscriptions.remove(topic, subscription)
      }
    }
  }

  ubre.request = function(url, body, id) {
    id = id || uuid()
    let cancel
    const promise = new Promise((resolve, reject) => {
      cancel = () => (
        open && forward(['cancel', id], null, this.target),
        requests.delete(id),
        reject(new Error('cancelled'))
      )
      requests.set(id, { resolve, reject, url, body, sent: open, target: this.target })
    })

    promise.cancel = cancel

    open && forward(['request', id, url], body, this.target)
    return promise
  }

  ubre.handle = (url, fn) => {
    typeof url === 'object'
      ? Object.keys(url).forEach(h => ubre.handle(h, url[h]))
      : handlers.set(url, fn)
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
      subscriptions.forEach((s, topic) => s.forEach(({ target }) =>
        target === this.target && s.delete(target)
      ))
      requests.forEach(({ target, reject }, id) => target === this.target && (
        reject(new Error('closed')),
        requests.delete(id)
      ))
      tasks.forEach((target, id) => { target === this.target && tasks.delete(id) })
    } else {
      open = false
      subscriptions.forEach(s => s.forEach(m => m.sent = false))
      requests.forEach(({ reject }) => reject(new Error('closed')))
      requests.clear()
      tasks.clear()
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
