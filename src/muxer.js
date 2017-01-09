'use strict'

const EventEmitter = require('events').EventEmitter
const Connection = require('interface-connection').Connection
const toPull = require('stream-to-pull-stream')
const pull = require('pull-stream')
const pullCatch = require('pull-catch')

const MULTIPLEX_CODEC = require('./multiplex-codec')

module.exports = class MultiplexMuxer extends EventEmitter {
  constructor (conn, multiplex, isListener) {
    super()

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
      const muxedConn = new Connection(
        stream,
        this.conn
      )
      this.emit('stream', muxedConn)
    })
  }

  // method added to enable pure stream muxer feeling
  newStream (callback) {
    if (!callback) {
      callback = noop
    }

    const stream = this.multiplex.createStream()

    const conn = new Connection(stream, this.conn)

    setTimeout(() => {
      callback(null, conn)
    }, 0)

    return conn
  }

  end (cb) {
    this.multiplex.once('close', cb)
    this.multiplex.destroy()
  }
}

function noop () {}
