'use strict'

const debug = require('debug')
const log = debug('multiplex')
log.error = debug('multiplex:error')

const lp = require('pull-length-prefixed')
const batch = require('pull-batch')
const pull = require('pull-stream')
const EventEmitter = require('events').EventEmitter
const many = require('pull-many')
// const pullWindow = require('pull-window')

const pullSwitch = require('./pull-switch')
const utils = require('./utils')
const Channel = require('./multiplex-channel')

class Multiplex extends EventEmitter {
  constructor (opts) {
    log('multiplex create')
    super()
    opts = opts || {}

    this._options = opts

    this._localIds = 0

    this._streams = {}

    // TODO: only encode/decode data chunks, not headers
    this.sink = pull(
      lp.decode(),
      batch(2),
      pullSwitch(this._split.bind(this))
    )

    this._many = many()
    this.source = pull(
      this._many,
      // pull.flatten(),
      lp.encode()
    )
  }

  _split (input) {
    // already closed
    if (!input[0]) {
      return
    }

    const header = utils.readHeader(input[0])
    const data = input[1]

    const id = header.id
    const flag = header.flag

    log('split', {header, data, flag, id})
    // open
    if (flag === 0) {
      log('open', id)
      let channel = this._streams[id]
      if (!channel) {
        channel = new Channel(id, null, true)
        this._streams[id] = channel
        this._addSource(channel.outChan.p.source)
        this.emit('stream', channel, id)
      }

      return channel.inChan.p.sink
    }

    // close or error
    if ([3, 4, 5, 6].indexOf(flag) > -1) {
      const c = this._streams[id]
      this._streams[id] = null

      // error
      if (flag > 4) {
        const msg = data.toString() || 'Channel destroyed'
        const err = new Error(msg)

        c.inChan.abort(err)
        this.emit('error', err)
      } else {
        // end
        c.inChan.abort()
      }

      return
    }

    return this._streams[id].inChan.p.sink
  }

  _addSource (source) {
    this._many.add(source)// pull(
    //   source,
    //   pullWindow.recent(1000 * 1000, 50)
    // ))
  }

  _nextId (initiator) {
    const id = this._localIds
    this._localIds += 2

    if (initiator) {
      return id + 1
    }

    return id
  }

  createStream (id, name, opts) {
    id = id == null ? this._nextId(true) : id
    log('create stream', {id, name})

    const channel = new Channel(id, name)

    this._streams[id] = channel
    this._addSource(channel.outChan.p.source)

    return channel
  }

  destroy (callback) {
    if (callback) {
      this.on('close', callback)
    }

    // TODO: How to do this best?
    // this._streams.forEach((s) => s.close())
  }
}

module.exports = Multiplex
exports.Channel = Channel
