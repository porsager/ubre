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
    subscribe: function(from, { name }) {
      !subscribers.has(name) && ubre.onTopicStart(name)
      subscribers.add(name, from)
      ubre.onSubscribe(name, from)
    },

    unsubscribe: function(from, { name }) {
      subscribers.remove(name, from)
      !subscribers.has(name) && ubre.onTopicEnd(name)
      ubre.onUnsubscribe(name, from)
    },

    publish: (from, { name, body }) =>
      subscriptions.has(name) && subscriptions.get(name).forEach(s => (
        (!s.target || s.target === from) && s.fn(body, from)
      )),

    request: (from, { id, name, body }) => {
      if (!handlers.has(name))
        return forward({ type: 'fail', id, body: new Error('NotFound') }, from)

      tasks.set(id, from)
      Promise.resolve(handlers.get(name)(body, from))
      .then(body => {
        tasks.has(id) && (
          forward({ type: 'success', id, body: body === null ? undefined : body }, from),
          tasks.delete(id)
        )
      })
      .catch(body => {
        tasks.has(id) && (
          forward({ type: 'fail', id, body: body === null ? undefined : body }, from),
          tasks.delete(id)
        )
      })
    },

    success: (from, { id, body }) => {
      requests.has(id) && requests.get(id).resolve(body)
      requests.delete(id)
    },

    fail: (from, { id, body }) => {
      requests.has(id) && requests.get(id).reject(body)
      requests.delete(id)
    },

    cancel: (from, { id }) =>
      tasks.delete(id)
  }

  function forward(message, target) {
    send(serialize(message), target)
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
    message = deserialize(message)
    message.type in incoming && incoming[message.type](from, message)
  }

  ubre.publish = (topic, body) => {
    subscribers.has(topic) && subscribers.get(topic).forEach(s =>
      forward({ type: 'publish', name: topic, body }, s)
    )
  }

  ubre.subscribe = function(topic, body, fn) {
    if (arguments.length === 2) {
      fn = body
      body = undefined
    }

    open && forward({ type: 'subscribe', name: topic, body }, this.target)
    const subscription = { body, fn, sent: open, target: this.target }
    subscriptions.add(topic, subscription)

    return {
      unsubscribe: () => {
        open && forward({ type: 'unsubscribe', name: topic, body }, this.target)
        subscriptions.remove(topic, subscription)
      }
    }
  }

  ubre.request = function(name, body, id) {
    id = id || uuid()
    let cancel
    const promise = new Promise((resolve, reject) => {
      cancel = () => (
        open && forward({ type: 'cancel',  id, body }, this.target),
        requests.delete(id),
        reject(new Error('cancelled'))
      )
      requests.set(id, { resolve, reject, name, body, sent: open, target: this.target })
    })

    promise.cancel = cancel

    open && forward({ type: 'request', id, name, body }, this.target)
    return promise
  }

  ubre.handle = (name, fn) => {
    typeof name === 'object'
      ? Object.keys(name).forEach(h => ubre.handle(h, name[h]))
      : handlers.set(name, fn)
  }

  ubre.open = (target) => {
    open = true

    subscriptions.forEach((s, topic) => s.forEach(m => !m.sent && (
      forward({ type: 'subscribe', name: topic, body: m.body }, m.target),
      m.sent = true
    )))

    requests.forEach((r, id) => !r.sent && (
      forward({ type: 'request', id, name: r.name, body: r.body }, r.target),
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
