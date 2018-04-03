'use strict'

const MULTIPLEX_CODEC = require('./codec')
const pull = require('pull-stream')
const Mplex = require('pull-plex')
const Muxer = require('./muxer')

function create (conn, isListener) {
  const mpx = new Mplex(!isListener)
  pull(conn, mpx, conn)
  return new Muxer(conn, mpx)
}

exports = module.exports = create
exports.multicodec = MULTIPLEX_CODEC
exports.dialer = (conn) => create(conn, false)
exports.listener = (conn) => create(conn, true)
