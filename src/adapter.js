'use strict'

const Mplex = require('.')
const AbortController = require('abort-controller')
const pull = require('pull-stream/pull')
const map = require('pull-stream/throughs/map')
const toPull = require('async-iterator-to-pull-stream')
const { Connection } = require('interface-connection')
const EE = require('events')
const noop = () => {}

function create (conn, isListener) {
  const toConn = stream => {
    const { source } = stream
    stream.source = (async function * () {
      for await (const chunk of source) {
        yield chunk.slice() // convert bl to Buffer
      }
    })()
    Object.assign(stream.source, { push: source.push, end: source.end })
    return new Connection(toPull.duplex(stream), conn)
  }

  const abortController = new AbortController()
  const adapterMuxer = Object.assign(new EE(), {
    newStream (cb) {
      cb = cb || noop
      const stream = muxer.newStream()
      const conn = toConn(stream)
      setTimeout(() => cb(null, conn))
      return conn
    },
    end (err, cb) {
      if (typeof err === 'function') {
        cb = err
        err = null
      }
      cb = cb || noop
      abortController.abort()
      cb()
    }
  })

  const muxer = new Mplex({
    signal: abortController.signal,
    onStream: stream => adapterMuxer.emit('stream', toConn(stream))
  })

  pull(
    conn,
    toPull.duplex(muxer),
    // convert bl to Buffer
    map(chunk => chunk.slice()),
    read => (end, cb) => {
      if (end) adapterMuxer.emit('close', end)
      read(end, cb)
    },
    conn
  )

  return adapterMuxer
}

module.exports = create
module.exports.multicodec = Mplex.multicodec
module.exports.dialer = conn => create(conn, false)
module.exports.listener = conn => create(conn, true)
