'use strict'

const EventEmitter = require('events').EventEmitter
const Connection = require('interface-connection').Connection
const toPull = require('stream-to-pull-stream')
// const pull = require('pull-stream')
// const pullCatch = require('pull-catch')

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

    multiplex.on('stream', (stream, id) => {
      stream.on('error', () => {
        console.log('stream.on error')
      })
      const muxedConn = new Connection(
        toPull.duplex(stream),
        // catchError(toPull.duplex(stream)),
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
    this._id = this._id + (this.isListener ? 2 : 1)

    const stream = this.multiplex.createStream(this._id)

    stream.on('error', () => {
      console.log('stream.on error')
    })

    const conn = new Connection(
      // catchError(toPull.duplex(stream)),
      toPull.duplex(stream),
      this.conn
    )

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

// function catchError (stream) {
//   return {
//     source: pull(
//       stream.source,
//       pullCatch((err) => {
//         if (err.message === 'Channel destroyed') {
//           return
//         }
//         // pass error through
//         return true
//       })
//     ),
//     sink: stream.sink
//   }
// }
