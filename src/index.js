'use strict'

const MULTIPLEX_CODEC = require('./codec')
const pull = require('pull-stream')
const Mplex = require('pull-plex')
const abortable = require('pull-abortable')
const Muxer = require('./muxer')

function create (conn, isListener) {
  const mpx = new Mplex(!isListener)
  const aborter = abortable()

  pull(
    conn,
    mpx,
    aborter,
    conn
  )

  const muxer = new Muxer(conn, mpx)
  muxer.once('error', (err) => {
    aborter.abort(err) // TODO: should we abort here or just ignore?
  })

  muxer.on('close', () => {
    aborter.abort()
  })

  return muxer
}

exports = module.exports = create
exports.multicodec = MULTIPLEX_CODEC
exports.dialer = (conn) => create(conn, false)
exports.listener = (conn) => create(conn, true)
