'use strict'

const EventEmitter = require('events').EventEmitter
const Connection = require('interface-connection').Connection
const setImmediate = require('async/setImmediate')

const MULTIPLEX_CODEC = require('./codec')

function noop () {}

class MultiplexMuxer extends EventEmitter {
  constructor (conn, multiplex) {
    super()
    this.multiplex = multiplex
    this.conn = conn
    this.multicodec = MULTIPLEX_CODEC

    multiplex.on('close', () => this.emit('close'))
    multiplex.on('error', (err) => this.emit('error', err))

    multiplex.on('stream', (stream) => {
      stream.once('error', (() => {}))
      this.emit('stream', new Connection(stream, this.conn))
    })
  }

  // method added to enable pure stream muxer feeling
  newStream (callback) {
    callback = callback || noop
    let stream
    try {
      stream = this.multiplex.createStream()
    } catch (err) {
      return setImmediate(() => callback(err))
    }

    const conn = new Connection(stream, this.conn)
    stream.openChan()
    setImmediate(() => callback(null, conn))
    return conn
  }

  end (callback) {
    callback = callback || noop
    this.multiplex.once('close', callback)
    this.multiplex.destroy()
  }
}

module.exports = MultiplexMuxer

