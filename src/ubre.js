export default Ubre

const noop = () => { /* noop */ }

function Ubre({
  send = noop,
  receive = noop,
  open = false,
  deserialize = JSON.parse,
  serialize = JSON.stringify,
  unwrapError = unwrapErr
}) {
  const subscriptions = MapSet()
      , subscribers = MapSet()
      , tasks = Map()
      , requests = Map()
      , publishes = Map()
      , handlers = Map()

  let i = 0

  const incoming = {
    subscribe: function(from, { subscribe }) {
      !subscribers.has(subscribe) && ubre.onTopicStart(subscribe)
      subscribers.add(subscribe, from)
      ubre.onSubscribe(subscribe, from)
    },

    unsubscribe: function(from, { unsubscribe }) {
      subscribers.remove(unsubscribe, from)
      !subscribers.has(unsubscribe) && ubre.onTopicEnd(unsubscribe)
      ubre.onUnsubscribe(unsubscribe, from)
    },

    publish: (from, { publish, body }) =>
      subscriptions.has(publish) && subscriptions.get(publish).forEach(s => (
        (!s.target || s.target === from) && s.fn(body, from)
      )),

    request: (from, { id, request, body }) => {
      if (!handlers.has(request))
        return forward({ fail: id, body: 'NotFound' }, from)

      tasks.set(id, { from })
      new Promise(resolve => resolve(handlers.get(request)(body, from)))
      .then(body => sendResponse(id, { success: id, body }))
      .catch(body => sendResponse(id, { fail: id, body: unwrapError(body) }))
    },

    success: (from, { success, body }) => {
      requests.has(success) && requests.get(success).resolve(body)
      requests.delete(success)
    },

    fail: (from, { fail, body }) => {
      requests.has(fail) && requests.get(fail).reject(body)
      requests.delete(fail)
    }
  }

  function sendResponse(id, message) {
    const task = tasks.get(id)
    if (!task)
      return

    if (open) {
      forward(message, task.from),
      tasks.delete(id)
    } else {
      task.message = message
    }
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
    message.subscribe && incoming.subscribe(from, message)
    message.unsubscribe && incoming.unsubscribe(from, message)
    message.publish && incoming.publish(from, message)
    message.request && message.id && incoming.request(from, message)
    message.success && incoming.success(from, message)
    message.fail && incoming.fail(from, message)
  }

  ubre.publish = function(topic, body) {
    subscribers.has(topic) && (this.target
      ? subscribers.get(topic).has(this.target) && forward({ publish: topic, body }, this.target)
      : subscribers.get(topic).forEach(s => open
        ? forward({ publish: topic, body }, s)
        : publishes.set({ publish: topic, body }, s)
      )
    )
  }

  ubre.subscribe = function(topic, body, fn) {
    if (arguments.length === 2) {
      fn = body
      body = undefined
    }

    open && forward({ subscribe: topic, body }, this.target)
    const subscription = { body, fn, sent: open, target: this.target }
    subscriptions.add(topic, subscription)

    return {
      unsubscribe: () => {
        open && forward({ unsubscribe: topic, body }, this.target)
        subscriptions.remove(topic, subscription)
      }
    }
  }

  ubre.request = function(request, body, id) {
    id = id || ++i
    return new Promise((resolve, reject) => {
      try {
        open && forward({ request, id, body }, this.target)
        requests.set(id, { resolve, reject, request, body, sent: open, target: this.target })
      } catch (err) {
        reject(err)
      }
    })
  }

  ubre.handle = (request, fn) => {
    typeof request === 'object'
      ? Object.keys(request).forEach(h => ubre.handle(h, request[h]))
      : handlers.set(request, fn)
  }

  ubre.open = () => {
    open = true

    subscriptions.forEach((s, topic) => s.forEach(m => !m.sent && (
      forward({ subscribe: topic, body: m.body }, m.target),
      m.sent = true
    )))

    requests.forEach((r, id) => !r.sent && (
      forward({ request: r.request, id, body: r.body }, r.target),
      r.sent = true
    ))

    tasks.forEach((message, id) =>
      sendResponse(id, message)
    )

    publishes.forEach((target, p) => {
      forward(p, target)
      publishes.delete(p)
    })
  }

  ubre.close = function() {
    if (this.target) {
      subscribers.removeItems(this.target)
      subscriptions.forEach(s => s.forEach(({ target }) =>
        target === this.target && s.delete(target)
      ))
      requests.forEach((r, id) => r.target === this.target && (
        r.reject(new Error('closed')),
        requests.delete(id)
      ))
      tasks.forEach((target, id) => { target === this.target && tasks.delete(id) })
    } else {
      open = false
      subscriptions.forEach(s => s.forEach(m => m.sent = false))
    }
  }

  receive(ubre.message)

  return ubre
}

function MapSet() {
  const map = Map()

  return {
    add: (key, item) => (map.get(key) || map.set(key, Set()).get(key)).add(item),
    has: map.has.bind(map),
    get: map.get.bind(map),
    delete: map.delete.bind(map),
    clear: map.clear.bind(map),
    forEach: map.forEach.bind(map),
    removeItems: item => map.forEach(set => set.delete(item)),
    remove: (key, item) => {
      if (!map.has(key))
        return

      const set = map.get(key)
      set.delete(item)
      set.size === 0 && map.delete(key)
    }
  }
}

function Map() {
  let keys = []
    , values = []

  const map = {
    has: x => keys.indexOf(x) !== -1,
    get: x => values[keys.indexOf(x)],
    set: (x, v) => (keys.push(x), values.push(v), map),
    forEach: fn => keys.forEach((k, i) => fn(values[i], k, map)),
    clear: () => (keys = [], values = [], undefined),
    delete: x => {
      const index = keys.indexOf(x)
      if (index > -1) {
        keys.splice(index, 1)
        values.splice(index, 1)
      }
    }
  }

  return map
}

function Set() {
  let values = []

  const set = {
    add: x => (values.indexOf(x) === -1 && values.push(x), set),
    clear: () => (values = [], undefined),
    delete: x => values.indexOf(x) !== -1 ? (values.splice(values.indexOf(x), 1), true) : false,
    forEach: fn => values.forEach(v => fn(v, v, set)),
    has: x => values.indexOf(x) !== -1
  }

  Object.defineProperty(set, 'size', {
    get() {
      return values.length
    }
  })

  return set
}

function copy(o, seen = []) {
  return Object.keys(o).reduce((acc, key) => (
    acc[key] = o[key] && typeof o[key] === 'object'
      ? (
        seen.push(o),
        seen.indexOf(o[key]) > -1
          ? '[Circular]'
          : copy(o[key], seen))
      : o[key],
    acc
  ), Array.isArray(o) ? [] : {})
}

const common = ['name', 'message', 'stack', 'code']
function unwrapErr(error) {
  if (typeof error === 'function')
    return '[Function: ' + (error.name || 'anonymous') + ']'

  if (typeof error !== 'object')
    return error

  const err = copy(error)
  common.forEach(c =>
    typeof error[c] === 'string' && (err[c] = error[c])
  )
  return err
}

