'use strict'

const multiplex = require('multiplex')
const toStream = require('pull-stream-to-stream')

const MULTIPLEX_CODEC = require('./multiplex-codec')
const Muxer = require('./muxer')

function create (rawConn, isListener) {
  const conn = toStream(rawConn)
  // Let it flow, let it flooow
  conn.resume()

  conn.on('end', () => {
    // Cleanup and destroy the connection when it ends
    // as the converted stream doesn't emit 'close'
    // but .destroy will trigger a 'close' event.
    conn.destroy()
  })

  const muxer = multiplex()

  return new Muxer(conn, muxer, isListener)
}

exports = module.exports = create
exports.multicodec = MULTIPLEX_CODEC
exports.dialer = (conn) => create(conn, false)
exports.listener = (conn) => create(conn, true)
