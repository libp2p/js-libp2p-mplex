'use strict'

const debug = require('debug')
const log = debug('multiplex')
log.error = debug('multiplex:error')

const varint = require('varint')
const lp = require('pull-length-prefixed')
const batch = require('pull-batch')
const pull = require('pull-stream')
const many = require('pull-many')
const pushable = require('pull-pushable')
const abortable = require('pull-abortable')
const EventEmitter = require('events').EventEmitter
const toObject = require('pull-stream-function-to-object')

const pullSwitch = require('./pull-switch')

const SIGNAL_FLUSH = new Buffer([0])

function InChannel (id, name) {
  if (name == null) {
    name = id.toString()
  }

  const initiator = false
  const header = id << 3 | (initiator ? 2 : 1)
  let open = false

  const aborter = abortable()

  return pull(
    pull.map((input) => {
      const header = input[0]
      const data = input[1]

      const type = header & 7
      const channel = header >> 3
      const isLocal = type & 1
      log('in', {header, data, type, channel, isLocal, id})
      switch (type) {
      case 0: // open
        return pull.empty()
      case 1: // local packet
      case 2: // remote packet
        return pull.values([data])
      case 3: // local end
      case 4: // remote end
        aborter.abort()
        return pull.empty()
      case 5: // local error
      case 6: // remote error
        const msg = data.toString || 'Channel destroyed'
        aborter.abort(new Error(msg))
        return pull.empty()
      default:
        return pull.empty()
      }
    }),
    pull.flatten(),
    aborter
  )
}

function OutChannel (id, name) {
  if (name == null) {
    name = id.toString()
  }

  const initiator = true
  const header = id << 3 | (initiator ? 2 : 1)
  let open = false

  const wrap = (data) => [header, data]

  return {
    sink: pull(
      pull.map((data) => {
        log('out', {header, data, open, id})
        if (!open) {
          open = true
          return pull.values([
            id << 3 | 0,
            Buffer.isBuffer(name) ? name : new Buffer(name)
          ].concat(wrap(data)))
        }

        return pull.values(wrap(data))
      }),
      pull.flatten()
    ),
    source: new InChannel(id, name)
  }
}

class Multiplex extends EventEmitter {
  constructor (opts) {
    super()
    opts = opts || {}

    this._options = opts

    this._localIds = 0

    this._streams = {}

    this._sink = pull(
      lp.decode(),
      batch(2),
      pullSwitch(this._split.bind(this))
    )

    this._many = many()
    this._source = pull(
      this._many,
      lp.encode()
    )
  }

  _split (input) {
    const header = input[0]
    const data = input[1]

    const id = header >> 3
    const type = header & 7

    log('split', {header, data, type, id})
    // open
    if (type === 0) {
      this._streams[id] = new InChannel(id, data.toString())
      this.emit('stream', this._streams[id], id)
      return this._streams[id]
    }

    // close or error
    if ([3, 4, 5, 6].indexOf(type) > -1) {
      const c = this._streams[id]
      this._streams[id] = null

      const msg = data.toString || 'Channel destroyed'
      this.emit('error', new Error(msg))
      return c
    }

    return this._streams[id]
  }

  _nextId (initiator) {
    const id = this._localIds
    this._localIds += 2

    if (initiator) {
      return id + 1
    }

    return id
  }

  createStream (name, opts) {
    const id = this._nextId(true)
    const channel = new OutChannel(id, name)

    this._streams[id] = channel
    this._many.add(channel.source)

    return channel
  }

  get source () {
    return this._source
  }

  get sink () {
    return this._sink
  }
}

module.exports = Multiplex
