'use strict'

const multiplex = require('multiplex')
const toStream = require('pull-stream-to-stream')

const MULTIPLEX_CODEC = require('./multiplex-codec')
const Muxer = require('./muxer')

function create (rawConn, isListener) {
  const conn = toStream(rawConn)
  // Let it flow, let it flooow
  conn.resume()

  const mpx = multiplex()
  conn.pipe(mpx).pipe(conn)

  return new Muxer(rawConn, mpx, isListener)
}

exports = module.exports = create
exports.multicodec = MULTIPLEX_CODEC
exports.dialer = (conn) => create(conn, false)
exports.listener = (conn) => create(conn, true)
