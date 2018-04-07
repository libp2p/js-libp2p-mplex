'use strict'

const MULTIPLEX_CODEC = require('./codec')
const pull = require('pull-stream')
const Mplex = require('pull-mplex')
const abortable = require('pull-abortable')
const Muxer = require('./muxer')

const debug = require('debug')

const log = debug('libp2p-mplex')
log.err = debug('libp2p-mplex:error')

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
    log.err('got error', err)
    aborter.abort(err) // TODO: should we do the abort here or just ignore?
  })

  muxer.on('close', () => {
    log('closing muxer')
    aborter.abort()
  })

  return muxer
}

exports = module.exports = create
exports.multicodec = MULTIPLEX_CODEC
exports.dialer = (conn) => create(conn, false)
exports.listener = (conn) => create(conn, true)
