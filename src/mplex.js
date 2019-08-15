'use strict'

const pipe = require('it-pipe')
const pushable = require('it-pushable')
const log = require('debug')('libp2p:mplex:mplex')
const abortable = require('abortable-iterator')
const Coder = require('./coder')
const restrictSize = require('./restrict-size')
const { MessageTypes, MessageTypeNames } = require('./message-types')
const createStream = require('./stream')

class Mplex {
  constructor (options) {
    options = options || {}
    options = typeof options === 'function' ? { onStream: options } : options

    this._streamId = 0
    this._streams = { initiators: new Map(), receivers: new Map() }
    this._options = options

    this.sink = this._createSink()
    this.source = this._createSource()
    this.onStream = options.onStream
  }

  // Initiate a new stream with the given name
  newStream (name) {
    const id = this._streamId++
    name = name == null ? id.toString() : String(name)
    log('new initiator stream %s %s', id, name)
    const send = msg => {
      if (log.enabled) {
        log('initiator stream send', { id: msg.id, type: MessageTypeNames[msg.type], data: msg.data })
      }
      return this.source.push(msg)
    }
    const onEnd = () => {
      log('initiator stream %s ended', id)
      this._streams.initiators.delete(id)
    }
    const stream = createStream({ id, name, send, onEnd })
    this._streams.initiators.set(id, stream)
    return stream
  }

  _newReceiverStream ({ id, name }) {
    if (this._streams.receivers.has(id)) {
      throw new Error(`stream ${id} already exists!`)
    }
    log('new receiver stream %s %s', id, name)
    const send = msg => {
      if (log.enabled) {
        log('receiver stream send', { id: msg.id, type: MessageTypeNames[msg.type], data: msg.data })
      }
      return this.source.push(msg)
    }
    const onEnd = () => {
      log('receiver stream %s ended', id)
      this._streams.receivers.delete(id)
    }
    const stream = createStream({ id, name, send, type: 'receiver', onEnd })
    this._streams.receivers.set(id, stream)
    return stream
  }

  _createSink () {
    return async source => {
      if (this._options.signal) {
        source = abortable(source, this._options.signal)
      }

      try {
        await pipe(
          source,
          Coder.decode,
          restrictSize(this._options.maxMsgSize),
          async source => {
            for await (const msg of source) {
              this._handleIncoming(msg)
            }
          }
        )
      } catch (err) {
        log('error in sink', err)
        return this.source.end(err) // End the source with an error
      }

      this.source.end()
    }
  }

  _createSource () {
    const onEnd = err => {
      const { initiators, receivers } = this._streams
      // Abort all the things!
      for (const s of initiators.values()) s.abort(err)
      for (const s of receivers.values()) s.abort(err)
    }
    const source = pushable(onEnd)
    const encodedSource = pipe(
      source,
      restrictSize(this._options.maxMsgSize),
      Coder.encode
    )
    return Object.assign(encodedSource, {
      push: source.push,
      end: source.end,
      return: source.return
    })
  }

  _handleIncoming ({ id, type, data }) {
    if (log.enabled) {
      log('incoming message', { id, type: MessageTypeNames[type], data: data.slice() })
    }

    // Create a new stream?
    if (type === MessageTypes.NEW_STREAM && this.onStream) {
      const stream = this._newReceiverStream({ id, name: data.toString() })
      return this.onStream(stream)
    }

    const list = type & 1 ? this._streams.initiators : this._streams.receivers
    const stream = list.get(id)

    if (!stream) return log('missing stream %s', id)

    switch (type) {
      case MessageTypes.MESSAGE_INITIATOR:
      case MessageTypes.MESSAGE_RECEIVER:
        stream.source.push(data)
        break
      case MessageTypes.CLOSE_INITIATOR:
      case MessageTypes.CLOSE_RECEIVER:
        stream.close()
        break
      case MessageTypes.RESET_INITIATOR:
      case MessageTypes.RESET_RECEIVER:
        stream.reset()
        break
      default:
        log('unknown message type %s', type)
    }
  }
}

Mplex.multicodec = '/mplex/6.7.0'

module.exports = Mplex
