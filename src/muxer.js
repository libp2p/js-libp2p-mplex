'use strict'

const EventEmitter = require('events').EventEmitter
const Connection = require('interface-connection').Connection

const MULTIPLEX_CODEC = require('./multiplex-codec')

module.exports = class MultiplexMuxer extends EventEmitter {
  constructor (conn, multiplex, isListener) {
    super()

    this.multiplex = multiplex
    this.conn = conn
    this.multicodec = MULTIPLEX_CODEC
    this.isListener = isListener
    this._id = 0

    multiplex.on('close', () => {
      this.emit('close')
    })

    multiplex.on('error', (err) => {
      this.emit('error', err)
    })

    multiplex.on('stream', (stream) => {
      const muxedConn = new Connection(stream, this.conn)
      this.emit('stream', muxedConn)
    })
  }

  // method added to enable pure stream muxer feeling
  newStream (callback) {
    if (!callback) {
      callback = noop
    }

    let id = this._id

    if (this.isListener) {
      id++
    }

    const stream = this.multiplex.createStream(id)
    this._id += 2

    const conn = new Connection(stream, this.conn)

    setTimeout(() => {
      callback(null, conn)
    }, 0)

    return conn
  }

  end (callback) {
    this.multiplex.destroy(callback)
  }
}

function noop () {}
