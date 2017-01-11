'use strict'

const debug = require('debug')
const log = debug('multiplex:channel')
log.error = debug('multiplex:channel:error')

const pull = require('pull-stream')
const abortable = require('pull-abortable')
const pullCatch = require('pull-catch')
const pair = require('pull-pair')

const pullEnd = require('./pull-end')
const utils = require('./utils')

const SIGNAL_FLUSH = new Buffer([0])

function inChannel (id, name) {
  if (name == null) {
    name = id.toString()
  }

  const p = pair()
  const aborter = abortable()

  return {
    abort: aborter.abort.bind(aborter),
    p: p,
    source: pull(
      p.source,
      aborter,
      pull.asyncMap((input, cb) => {
        const header = utils.readHeader(input[0])
        const data = input[1]

        const flag = header.flag
        const remoteId = header.id
        const isLocal = flag & 1
        log('in', {header, data, flag, id, isLocal, remoteId})

        switch (flag) {
          case 0: // open
            return cb()
          case 1: // local packet
          case 2: // remote packet
            return cb(null, data)
          case 3: // local end
          case 4: // remote end
            return
          case 5: // local error
          case 6: // remote error
            return cb(
              new Error(data.toString() || 'Channel destroyed')
            )
          default:
            return cb()
        }
      }),
      pull.filter(Boolean)
    )
  }
}

function outChannel (id, name, open) {
  if (name == null) {
    name = id.toString()
  }

  let flag = 2
  open = false
  const p = pair()

  const wrap = (data) => {
    // TODO: assert data < 1MB
    return [
      utils.createHeader(id, flag),
      Buffer.isBuffer(data) ? data : new Buffer(data)
    ]
  }

  return {
    p: p,
    sink: pull(
      pullEnd(() => {
        log('local end', id)
        flag = 3
        return SIGNAL_FLUSH
      }),
      pullCatch((err) => {
        log('local error', id, err.message)
        flag = 5
        return SIGNAL_FLUSH
      }),
      pull.map((data) => {
        if (!open) {
          open = true
          return pull.values([
            utils.createHeader(id, 0),
            Buffer.isBuffer(name) ? name : new Buffer(name)
          ].concat(wrap(data)))
        }

        return pull.values(wrap(data))
      }),
      pull.flatten(),
      p.sink
    )
  }
}

class Channel {
  constructor (id, name, open) {
    this.id = id
    this.name = name == null ? id.toString() : name

    log('new channel', {id, name})

    this.outChan = outChannel(id, name, open)
    this.sink = this.outChan.sink

    this.inChan = inChannel(id, name)
    this.source = this.inChan.source
  }
}

module.exports = Channel
