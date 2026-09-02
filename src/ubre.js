export default Ubre

const noop = () => { /* noop */ }

function Ubre({
  send = noop,
  receive = noop,
  open = noop,
  close = noop,
  timeout = 0,
  deserialize = JSON.parse,
  serialize = JSON.stringify,
  unwrapError = unwrapErr
}) {
  const $closed = Symbol('closed')
      , $aborters = Symbol('aborters')
      , $queue = Symbol('queue')

  const subscriptions = new Map()
      , subscribers = new Map()
      , requests = new Map()
      , handlers = new Map()

  let i = 0
    , isOpen = open === true
    , queued = []
    , publishes = []

  function subscribe(from, { subscribe }) {
    !subscribers.has(subscribe) && ubre.onTopicStart(subscribe)
    addTo(subscribers, subscribe, from)
    ubre.onSubscribe(subscribe, from)
  }

  function unsubscribe(from, { unsubscribe }) {
    removeFrom(subscribers, unsubscribe, from)
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
      return respond(from, id, { fail: id, body: 'NotFound' })

    const fn = handlers.get(request)
    const ac = new AbortController()

    let timer
      , timedOut = false

    from[$aborters]
      ? from[$aborters].set(id, ac)
      : (from[$aborters] = new Map([[id, ac]]))

    const running = new Promise(x => x(fn(body, from, ac)))
    const result = timeout
      ? Promise.race([running, new Promise((resolve, reject) =>
        timer = setTimeout(() => {
          timedOut = true
          ac.abort(new Error('Timeout'))
          reject(new Error('Timeout'))
        }, timeout)
      )])
      : running

    result.then(
      x => ({ success: id, body: x }),
      x => ({ fail: id, body: unwrapError(x) })
    ).catch((error) => {
      console.error('unwrapError failed', error)
      return { fail: id, body: 'InternalError' }
    }).then(x => {
      timer && clearTimeout(timer)
      from[$aborters] && from[$aborters].delete(id)
      from[$closed] || (ac.signal.aborted && !timedOut) || respond(from, id, x)
    })
  }

  function success(from, { success, body }) {
    const r = pending(from, success)
    if (!r)
      return

    r.resolve(body)
    clearRequest(success)
  }

  function fail(from, { fail, body }) {
    const r = pending(from, fail)
    if (!r)
      return

    r.reject(body)
    clearRequest(fail)
  }

  function pending(from, id) {
    const r = requests.get(id)
    if (r && r.target && r.target !== from) {
      console.error('Response for request ' + id + ' came from the wrong peer')
      return
    }

    return r
  }

  function abort(from, { abort, body }) {
    if (from[$aborters] && from[$aborters].has(abort))
      from[$aborters].get(abort).abort(body)
  }

  function clearRequest(id) {
    const r = requests.get(id)
    if (!r)
      return

    r.timer && clearTimeout(r.timer)
    requests.delete(id)
  }

  function respond(target, id, message) {
    try {
      sendResponse(target, id, message)
    } catch (error) {
      console.error('Could not send response', error)
      'fail' in message || respond(target, id, { fail: id, body: 'SerializationError' })
    }
  }

  function sendResponse(target, id, message) {
    if (isOpen)
      return forward(message, target)

    target[$queue]
      ? target[$queue].push({ id, message })
      : (queued.push(target), target[$queue] = [{ id, message }])
  }

  function requeue(target, messages) {
    target[$queue] = messages.concat(target[$queue] || [])
  }

  function sendPublish(message, target) {
    isOpen
      ? forward(message, target)
      : publishes.push({ message, target })
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
    'abort'                in x ? abort(from, x) :
    'request' in x && 'id' in x ? request(from, x) :
    'success'              in x ? success(from, x) :
    'fail'                 in x && fail(from, x)
  }

  ubre.publish = function(topic, body) {
    if (!subscribers.has(topic))
      return

    const targets = subscribers.get(topic)
        , message = { publish: topic, body }

    this.target
      ? targets.has(this.target) && sendPublish(message, this.target)
      : targets.forEach(target => sendPublish(message, target))
  }

  ubre.subscribe = function(topic, body, fn) {
    if (arguments.length === 2) {
      fn = body
      body = undefined
    }

    isOpen && forward({ subscribe: topic, body }, this.target)
    const subscription = { body, fn, sent: isOpen, target: this.target }
    addTo(subscriptions, topic, subscription)

    return {
      unsubscribe: () => {
        isOpen && forward({ unsubscribe: topic, body }, this.target)
        removeFrom(subscriptions, topic, subscription)
      }
    }
  }

  ubre.request = function(request, body, context) {
    const id = ++i
    const ms = context && 'timeout' in context
      ? context.timeout
      : timeout

    const cancel = (reason, abortBody) => {
      requests.has(id) && requests.get(id).reject(reason)
      clearRequest(id)
      isOpen && forward({ abort: id, body: abortBody }, this.target)
    }

    context && context.signal && context.signal.addEventListener('abort', (e) =>
      cancel(e.target.reason, e.target.reason)
    )

    return new Promise((resolve, reject) => {
      try {
        isOpen && forward({ request, id, body }, this.target)
        const r = { resolve, reject, request, body, sent: isOpen, target: this.target }
        requests.set(id, r)
        ms && (r.timer = setTimeout(() => cancel(new Error('Timeout'), 'Timeout'), ms))
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

    const targets = queued
    queued = []
    try {
      targets.forEach(target => {
        const messages = target[$queue]
        delete target[$queue]
        if (!messages)
          return

        let x = 0
        try {
          for (; x < messages.length; x++)
            respond(target, messages[x].id, messages[x].message)
        } finally {
          x < messages.length && requeue(target, messages.slice(x))
        }
      })
    } finally {
      targets.forEach(target =>
        target[$queue] && queued.indexOf(target) === -1 && queued.push(target)
      )
    }

    const pending = publishes
    publishes = []
    pending.forEach(({ message, target }) => forward(message, target))
  }

  ubre.close = function(target) {
    target = target || this.target

    if (target) {
      target[$closed] = true
      delete target[$queue]
      if (target[$aborters]) {
        target[$aborters].forEach(ac => ac.abort(new Error('closed')))
        delete target[$aborters]
      }
      publishes = publishes.filter(p => p.target !== target)
      subscribers.forEach((targets, topic) =>
        targets.delete(target) && targets.size === 0 && subscribers.delete(topic)
      )
      subscriptions.forEach((s, topic) => {
        s.forEach(subscription =>
          subscription.target === target && s.delete(subscription)
        )
        s.size === 0 && subscriptions.delete(topic)
      })
      requests.forEach((r, id) => r.target === target && (
        r.reject(new Error('closed')),
        clearRequest(id)
      ))
    } else {
      isOpen = false
      subscriptions.forEach(s => s.forEach(m => m.sent = false))
      requests.forEach(r => r.sent = false)
    }
  }

  typeof receive === 'function' && receive(ubre.message)
  typeof open === 'function' && open(ubre.open)
  typeof close === 'function' && close(target => ubre.close(target))

  return ubre
}

function addTo(map, key, item) {
  const set = map.get(key)
  set
    ? set.add(item)
    : map.set(key, new Set([item]))
}

function removeFrom(map, key, item) {
  const set = map.get(key)
  if (!set)
    return

  set.delete(item)
  set.size === 0 && map.delete(key)
}

function copy(o, seen = new Set()) {
  seen.add(o)
  const result = Object.keys(o).reduce((acc, key) => (
    acc[key] = o[key] && typeof o[key] === 'object'
      ? seen.has(o[key])
        ? '[Circular]'
        : copy(o[key], seen)
      : o[key],
    acc
  ), Array.isArray(o) ? [] : {})
  seen.delete(o)
  return result
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
