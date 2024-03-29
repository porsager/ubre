export default Ubre

const noop = () => { /* noop */ }
const closedSymbol = Symbol('closed')

function Ubre({
  send = noop,
  receive = noop,
  open = noop,
  close = noop,
  deserialize = JSON.parse,
  serialize = JSON.stringify,
  unwrapError = unwrapErr
}) {
  const subscriptions = MapSet()
      , subscribers = MapSet()
      , responses = MapSet()
      , queue = MapSet()
      , requests = Map()
      , publishes = Map()
      , handlers = Map()

  let i = 0
    , isOpen = open === true

  function subscribe(from, { subscribe }) {
    !subscribers.has(subscribe) && ubre.onTopicStart(subscribe)
    subscribers.add(subscribe, from)
    ubre.onSubscribe(subscribe, from)
  }

  function unsubscribe(from, { unsubscribe }) {
    subscribers.remove(unsubscribe, from)
    !subscribers.has(unsubscribe) && ubre.onTopicEnd(unsubscribe)
    ubre.onUnsubscribe(unsubscribe, from)
  }

  function publish(from, { publish, body }) {
    subscriptions.has(publish) && subscriptions.get(publish).forEach(s => (
      (!s.target || s.target === from) && s.fn(body, from)
    ))
  }

  function request(from, { id, request, body }) {
    if (!handlers.has(request))
      return forward({ fail: id, body: 'NotFound' }, from)

    responses.add(from, { id })
    new Promise(x => x(handlers.get(request)(body, from))).then(
      x => ({ success: id, body: x }),
      x => ({ fail: id, body: unwrapError(x) })
    ).then(x =>
      from[closedSymbol] || sendResponse(from, id, x)
    )
  }

  function success(from, { success, body }) {
    requests.has(success) && requests.get(success).resolve(body)
    requests.delete(success)
  }

  function fail(from, { fail, body }) {
    requests.has(fail) && requests.get(fail).reject(body)
    requests.delete(fail)
  }

  function sendResponse(target, id, message) {
    if (isOpen) {
      forward(message, target),
      responses.remove(target, id)
    } else {
      queue.add(target, { id, message })
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
    const x = deserialize(message)
    'subscribe'            in x ? subscribe(from, x) :
    'unsubscribe'          in x ? unsubscribe(from, x) :
    'publish'              in x ? publish(from, x) :
    'request' in x && 'id' in x ? request(from, x) :
    'success'              in x ? success(from, x) :
    'fail'                 in x && fail(from, x)
  }

  ubre.publish = function(topic, body) {
    subscribers.has(topic) && (this.target
      ? subscribers.get(topic).has(this.target) && forward({ publish: topic, body }, this.target)
      : subscribers.get(topic).forEach(s => isOpen
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

    isOpen && forward({ subscribe: topic, body }, this.target)
    const subscription = { body, fn, sent: isOpen, target: this.target }
    subscriptions.add(topic, subscription)

    return {
      unsubscribe: () => {
        isOpen && forward({ unsubscribe: topic, body }, this.target)
        subscriptions.remove(topic, subscription)
      }
    }
  }

  ubre.request = function(request, body, id) {
    id = id || ++i
    return new Promise((resolve, reject) => {
      try {
        isOpen && forward({ request, id, body }, this.target)
        requests.set(id, { resolve, reject, request, body, sent: isOpen, target: this.target })
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
    isOpen = true

    subscriptions.forEach((s, topic) => s.forEach(m => !m.sent && (
      forward({ subscribe: topic, body: m.body }, m.target),
      m.sent = true
    )))

    requests.forEach((r, id) => !r.sent && (
      forward({ request: r.request, id, body: r.body }, r.target),
      r.sent = true
    ))

    queue.forEach(({ id, message }, from) =>
      sendResponse(from, id, message)
    )

    publishes.forEach((target, p) => {
      forward(p, target)
      publishes.delete(p)
    })
  }

  ubre.close = function() {
    if (this.target) {
      this.target[closedSymbol] = true
      subscribers.removeItems(this.target)
      subscriptions.forEach(s => s.forEach(({ target }) =>
        target === this.target && s.delete(target)
      ))
      requests.forEach((r, id) => r.target === this.target && (
        r.reject(new Error('closed')),
        requests.delete(id)
      ))
      responses.delete(this.target)
      queue.delete(this.target)
    } else {
      isOpen = false
      subscriptions.forEach(s => s.forEach(m => m.sent = false))
    }
  }

  receive(ubre.message)
  typeof open === 'function' && open(ubre.open)
  typeof open === 'function' && receive(ubre.close)

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

