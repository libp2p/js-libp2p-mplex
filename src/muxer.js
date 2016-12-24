'use strict'

const EventEmitter = require('events').EventEmitter
const Connection = require('interface-connection').Connection
const toPull = require('stream-to-pull-stream')

const MULTIPLEX_CODEC = require('./multiplex-codec')

module.exports = class MultiplexMuxer extends EventEmitter {
  constructor (conn, multiplex, isListener) {
    super()

    this._id = 1
    this.multiplex = multiplex
    this.conn = conn
    this.multicodec = MULTIPLEX_CODEC
    this.isListener = isListener

    multiplex.on('close', () => {
      this.emit('close')
    })

    multiplex.on('error', (err) => {
      this.emit('error', err)
    })

    multiplex.on('stream', (stream) => {
      stream.respond(200, {})
      const muxedConn = new Connection(toPull.duplex(stream), this.conn)
      this.emit('stream', muxedConn)
    })
  }

  // method added to enable pure stream muxer feeling
  newStream (callback) {
    if (!callback) {
      callback = noop
    }
    const conn = new Connection(null, this.conn)
    this._id = this._id + (this.isListener ? 2 : 1)

    const stream = this.multiplex.createStream(this._id)
    const freshConn = new Connection(toPull.duplex(stream), conn)

    setTimeout(() => {
      callback(null, freshConn)
    }, 0)

    return freshConn
  }

  end (cb) {
    this.multiplex.end(cb)
  }
}

function noop () {}
