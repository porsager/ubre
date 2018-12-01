function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var rngBrowser = createCommonjsModule(function (module) {
// Unique ID creation requires a high quality random # generator.  In the
// browser this is a little complicated due to unknown quality of Math.random()
// and inconsistent support for the `crypto` API.  We do the best we can via
// feature-detection

// getRandomValues needs to be invoked in a context where "this" is a Crypto
// implementation. Also, find the complete implementation of crypto on IE11.
var getRandomValues = (typeof(crypto) != 'undefined' && crypto.getRandomValues && crypto.getRandomValues.bind(crypto)) ||
                      (typeof(msCrypto) != 'undefined' && typeof window.msCrypto.getRandomValues == 'function' && msCrypto.getRandomValues.bind(msCrypto));

if (getRandomValues) {
  // WHATWG crypto RNG - http://wiki.whatwg.org/wiki/Crypto
  var rnds8 = new Uint8Array(16); // eslint-disable-line no-undef

  module.exports = function whatwgRNG() {
    getRandomValues(rnds8);
    return rnds8;
  };
} else {
  // Math.random()-based (RNG)
  //
  // If all else fails, use Math.random().  It's fast, but is of unspecified
  // quality.
  var rnds = new Array(16);

  module.exports = function mathRNG() {
    for (var i = 0, r; i < 16; i++) {
      if ((i & 0x03) === 0) { r = Math.random() * 0x100000000; }
      rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return rnds;
  };
}
});

/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */
var byteToHex = [];
for (var i = 0; i < 256; ++i) {
  byteToHex[i] = (i + 0x100).toString(16).substr(1);
}

function bytesToUuid(buf, offset) {
  var i = offset || 0;
  var bth = byteToHex;
  // join used to fix memory issue caused by concatenation: https://bugs.chromium.org/p/v8/issues/detail?id=3175#c4
  return ([bth[buf[i++]], bth[buf[i++]], 
	bth[buf[i++]], bth[buf[i++]], '-',
	bth[buf[i++]], bth[buf[i++]], '-',
	bth[buf[i++]], bth[buf[i++]], '-',
	bth[buf[i++]], bth[buf[i++]], '-',
	bth[buf[i++]], bth[buf[i++]],
	bth[buf[i++]], bth[buf[i++]],
	bth[buf[i++]], bth[buf[i++]]]).join('');
}

var bytesToUuid_1 = bytesToUuid;

function v4(options, buf, offset) {
  var i = buf && offset || 0;

  if (typeof(options) == 'string') {
    buf = options === 'binary' ? new Array(16) : null;
    options = null;
  }
  options = options || {};

  var rnds = options.random || (options.rng || rngBrowser)();

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;

  // Copy bytes to buffer, if provided
  if (buf) {
    for (var ii = 0; ii < 16; ++ii) {
      buf[i + ii] = rnds[ii];
    }
  }

  return buf || bytesToUuid_1(rnds);
}

var v4_1 = v4;

var noop = function () { /* noop */ };

function Ubre(ref) {
  var send = ref.send; if ( send === void 0 ) send = noop;
  var open = ref.open; if ( open === void 0 ) open = false;
  var deserialize = ref.deserialize; if ( deserialize === void 0 ) deserialize = JSON.parse;
  var serialize = ref.serialize; if ( serialize === void 0 ) serialize = JSON.stringify;

  var subscriptions = MapSet()
      , subscribers = MapSet()
      , tasks = new Map()
      , requests = new Map()
      , handlers = new Map();

  var incoming = {
    subscribe: function(from, ref) {
      var topic = ref[0];

      !subscribers.has(topic) && ubre.onTopicStart(topic);
      subscribers.add(topic, from);
      ubre.onSubscribe(topic, from);
    },

    unsubscribe: function(from, ref) {
      var topic = ref[0];

      subscribers.remove(topic, from);
      !subscribers.has(topic) && ubre.onTopicEnd(topic);
      ubre.onUnsubscribe(topic, from);
    },

    publish: function (from, ref, body) {
        var topic = ref[0];

        return subscriptions.has(topic) && subscriptions.get(topic).forEach(function (s) { return (
        (!s.target || s.target === from) && s.fn(body)
      ); });
  },

    request: function (from, ref, data) {
      var id = ref[0];
      var url = ref[1];

      if (!handlers.has(url))
        { return forward(['fail', id], new Error('NotFound'), from) }

      tasks.set(id, from);
      Promise.resolve(handlers.get(url)(data, from))
      .then(function (result) {
        tasks.has(id) && (
          forward(['success', id], result, from),
          tasks.delete(id)
        );
      })
      .catch(function (error) {
        tasks.has(id) && (
          forward(['fail', id], error, from),
          tasks.delete(id)
        );
      });
    },

    success: function (from, ref, body) {
      var id = ref[0];

      requests.has(id) && requests.get(id).resolve(body);
      requests.delete(id);
    },

    fail: function (from, ref, body) {
      var id = ref[0];

      requests.has(id) && requests.get(id).reject(body);
      requests.delete(id);
    },

    cancel: function (from, ref) {
        var id = ref[0];

        return tasks.delete(id);
  }
  };

  function forward(head, body, target) {
    send(head.join(' ') + (body ? '\n' + serialize(body) : ''), target);
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

  ubre.onTopicStart = noop;
  ubre.onTopicEnd = noop;
  ubre.onSubscribe = noop;
  ubre.onUnsubscribe = noop;

  ubre.message = function (message, from) {
    var idx = message.indexOf('\n')
        , header = idx > -1 ? message.slice(0, idx) : message;
    var ref = header.split(' ');
    var type = ref[0];
    var args = ref.slice(1);
    var body = idx > -1 && message.slice(idx + 1);

    if (type in incoming)
      { incoming[type](from, args, body && deserialize(body)); }
  };

  ubre.publish = function (topic, body) {
    subscribers.has(topic) && subscribers.get(topic).forEach(function (s) { return forward(['publish', topic], body, s); }
    );
  };

  ubre.subscribe = function(topic, body, fn) {
    var this$1 = this;

    if (arguments.length === 2) {
      fn = body;
      body = undefined;
    }

    open && forward(['subscribe', topic], body, this.target);
    var subscription = { body: body, fn: fn, sent: open, target: this.target };
    subscriptions.add(topic, subscription);

    return {
      unsubscribe: function () {
        open && forward(['unsubscribe', topic], null, this$1.target);
        subscriptions.remove(topic, subscription);
      }
    }
  };

  ubre.request = function(url, body, id) {
    var this$1 = this;

    id = id || v4_1();
    var cancel;
    var promise = new Promise(function (resolve, reject) {
      cancel = function () { return (
        open && forward(['cancel', id], null, this$1.target),
        requests.delete(id),
        reject(new Error('cancelled'))
      ); };
      requests.set(id, { resolve: resolve, reject: reject, url: url, body: body, sent: open, target: this$1.target });
    });

    promise.cancel = cancel;

    open && forward(['request', id, url], body, this.target);
    return promise
  };

  ubre.handle = function (url, fn) {
    typeof url === 'object'
      ? Object.keys(url).forEach(function (h) { return ubre.handle(h, url[h]); })
      : handlers.set(url, fn);
  };

  ubre.open = function (target) {
    open = true;

    subscriptions.forEach(function (s, topic) { return s.forEach(function (m) { return !m.sent && (
      forward(['subscribe', topic], m.body, m.target),
      m.sent = true
    ); }); });

    requests.forEach(function (r, id) { return !r.sent && (
      forward(['request', id, r.url], r.body, r.target),
      r.sent = true
    ); });
  };

  ubre.close = function() {
    var this$1 = this;

    if (this.target) {
      subscribers.removeItems(this.target);
      subscriptions.forEach(function (s, topic) { return s.forEach(function (ref) {
          var target = ref.target;

          return target === this$1.target && s.delete(target);
        }
      ); });
      requests.forEach(function (ref, id) {
        var target = ref.target;
        var reject = ref.reject;

        return target === this$1.target && (
        reject(new Error('closed')),
        requests.delete(id)
      );
      });
      tasks.forEach(function (target, id) { target === this$1.target && tasks.delete(id); });
    } else {
      open = false;
      subscriptions.forEach(function (s) { return s.forEach(function (m) { return m.sent = false; }); });
      requests.forEach(function (ref) {
        var reject = ref.reject;

        return reject(new Error('closed'));
      });
      requests.clear();
      tasks.clear();
    }
  };

  return ubre
}

function MapSet() {
  var map = new Map();

  return {
    add: function (key, item) { return (map.get(key) || map.set(key, new Set()).get(key)).add(item); },
    has: map.has.bind(map),
    get: map.get.bind(map),
    delete: map.delete.bind(map),
    clear: map.clear.bind(map),
    forEach: map.forEach.bind(map),
    removeItems: function (item) { return map.forEach(function (set) { return set.delete(item); }); },
    remove: function (key, item) {
      var set = map.get(key);
      set && set.delete(item);
      set.size === 0 && map.delete(key);
    }
  }
}

function ws (ws, options) { return typeof ws.address === 'function'
    ? server(ws, options)
    : client(ws, options); }

function client(ws, options) {
  var ubre = Ubre(Object.assign({}, {send: function (message) { return ws.send(message); }},
    options))

  ;(ws.addEventListener || ws.on).call(ws, 'message', function (ref) {
    var target = ref.target;
    var data = ref.data;

    return ubre.message(data, target);
  })
  ;(ws.addEventListener || ws.on).call(ws, 'open', function () { return ubre.open(); })
  ;(ws.addEventListener || ws.on).call(ws, 'close', function () { return ubre.close(); });

  ubre.ws = ws;

  return ubre
}

function server(server, options) {
  var ubre = Ubre(Object.assign({}, {send: function (message, ws) { return ws.send(message); },
    open: true},
    options));

  server.on('connection', function (ws) {
    ws.on('message', function (data) { return ubre.message(data, ws); });
    ws.on('close', function () { return ubre(ws).close(); });
  });

  return ubre
}

Ubre.ws = ws;

export default Ubre;
