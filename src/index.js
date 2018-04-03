'use strict'

const MULTIPLEX_CODEC = require('./codec')
const pull = require('pull-stream')
const Mplex = require('pull-plex')
const Muxer = require('./muxer')

function create (conn, isListener) {
  const mpx = new Mplex(!isListener)
  pull(conn, mpx, conn)
  const muxer = new Muxer(conn, mpx)
  muxer.once('error', (() => {})) // log error here
  return muxer
}

exports = module.exports = create
exports.multicodec = MULTIPLEX_CODEC
exports.dialer = (conn) => create(conn, false)
exports.listener = (conn) => create(conn, true)
