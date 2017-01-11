'use strict'

const pull = require('pull-stream')

const MULTIPLEX_CODEC = require('./multiplex-codec')
const Muxer = require('./muxer')
const Multiplex = require('./multiplex')

function create (conn, isListener) {
  const mpx = new Multiplex()
  pull(conn, mpx, conn)

  return new Muxer(conn, mpx, isListener)
}

exports = module.exports = create
exports.multicodec = MULTIPLEX_CODEC
exports.dialer = (conn) => create(conn, false)
exports.listener = (conn) => create(conn, true)
