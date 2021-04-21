'use strict'

const abortable = require('abortable-iterator')
const AbortController = require('abort-controller')
const log = require('debug')('libp2p:mplex:stream')
const pushable = require('it-pushable')
const BufferList = require('bl/BufferList')
const errCode = require('err-code')
const { MAX_MSG_SIZE } = require('./restrict-size')
const { InitiatorMessageTypes, ReceiverMessageTypes } = require('./message-types')
const pDefer = require('p-defer')

const ERR_MPLEX_STREAM_RESET = 'ERR_MPLEX_STREAM_RESET'
const ERR_MPLEX_STREAM_ABORT = 'ERR_MPLEX_STREAM_ABORT'
const MPLEX_WRITE_STREAM_CLOSED = 'MPLEX_WRITE_STREAM_CLOSED'

/**
 * @typedef {import('libp2p-interfaces/src/stream-muxer/types').MuxedStream} MuxedStream
 * @typedef {import('libp2p-interfaces/src/stream-muxer/types').Sink} Sink
 */

/**
 * @param {object} options
 * @param {number} options.id
 * @param {string} options.name
 * @param {function(*)} options.send - Called to send data through the stream
 * @param {function(Error)} [options.onEnd] - Called whenever the stream ends
 * @param {string} [options.type] - One of ['initiator','receiver']. Defaults to 'initiator'
 * @param {number} [options.maxMsgSize] - Max size of an mplex message in bytes. Writes > size are automatically split. Defaults to 1MB
 * @returns {MuxedStream} A muxed stream
 */
module.exports = ({ id, name, send, onEnd = () => {}, type = 'initiator', maxMsgSize = MAX_MSG_SIZE }) => {
  const abortController = new AbortController()
  const resetController = new AbortController()
  const writeCloseController = new AbortController()
  const Types = type === 'initiator' ? InitiatorMessageTypes : ReceiverMessageTypes
  const externalId = type === 'initiator' ? (`i${id}`) : `r${id}`

  name = String(name == null ? id : name)

  let sinkInProgress = false
  let endErr
  const ended = {}
  const defers = {
    sink: [],
    source: []
  }

  const end = (type, err) => {
    if (!ended[type]) {
      ended[type] = true
      log('%s stream %s %s end', type, name, type, err)
      stream.timeline[`${type}Close`] = Date.now()

      if (ended.source && ended.sink) {
        stream.timeline.close = Date.now()
        onEnd(endErr)
      } else {
        endErr = err
      }
    }

    for (const defer of defers[type]) {
      defer.resolve()
    }
    defers[type] = []
  }

  const closeWrite = (controller) => {
    if (ended.sink) {
      return
    }

    const defer = pDefer()
    defers.sink.push(defer)

    // Make sure we're still in the sink when aborting
    // If the sink wasn't opened yet, open it and immediately close
    sinkInProgress ? controller.abort() : stream.sink([])
    return defer.promise
  }

  const closeRead = (err) => {
    // Needed because pushable doesn't call the end function multiple times
    if (ended.source) {
      return
    }

    const defer = pDefer()
    defers.source.push(defer)
    stream.source.end(err)
    return defer.promise
  }

  const closeAll = (controller, err) => {
    return Promise.all([
      closeWrite(controller),
      closeRead(err)
    ])
  }

  const _send = (message) => !ended.sink && send(message)

  /** @type {MuxedStream} */
  const stream = {
    // Close for both Reading and Writing
    close: () => closeAll(writeCloseController),
    // Close for reading
    closeRead: () => closeRead(),
    // Close for writing
    closeWrite: () => closeWrite(writeCloseController),
    // Close for reading and writing (local error)
    abort: err => {
      log('%s stream %s abort', type, name, err)
      closeAll(abortController, err)
    },
    // Close immediately for reading and writing (remote error)
    reset: () => {
      const err = errCode(new Error('stream reset'), ERR_MPLEX_STREAM_RESET)
      closeAll(resetController, err)
    },
    sink: async source => {
      if (sinkInProgress) {
        throw errCode(new Error('the sink was already opened'), 'ERR_SINK_ALREADY_OPENED')
      }

      if (ended.sink) {
        throw errCode(new Error('the stream was already closed'), 'ERR_STREAM_CLOSED')
      }

      sinkInProgress = true
      source = abortable(source, [
        { signal: abortController.signal, options: { abortMessage: 'stream aborted', abortCode: ERR_MPLEX_STREAM_ABORT } },
        { signal: resetController.signal, options: { abortMessage: 'stream reset', abortCode: ERR_MPLEX_STREAM_RESET } },
        { signal: writeCloseController.signal, options: { abortMessage: 'write stream closed', abortCode: MPLEX_WRITE_STREAM_CLOSED } }
      ])

      if (type === 'initiator') { // If initiator, open a new stream
        _send({ id, type: Types.NEW_STREAM, data: name })
      }

      try {
        for await (let data of source) {
          while (data.length) {
            if (data.length <= maxMsgSize) {
              _send({ id, type: Types.MESSAGE, data })
              break
            }
            data = BufferList.isBufferList(data) ? data : new BufferList(data)
            _send({ id, type: Types.MESSAGE, data: data.shallowSlice(0, maxMsgSize) })
            data.consume(maxMsgSize)
          }
        }
      } catch (err) {
        if (err.code !== MPLEX_WRITE_STREAM_CLOSED) {
          // Send no more data if this stream was remotely reset
          if (err.code === ERR_MPLEX_STREAM_RESET) {
            log('%s stream %s reset', type, name)
          } else {
            log('%s stream %s error', type, name, err)
            _send({ id, type: Types.RESET })
          }

          stream.source.end(err)
          return end('sink', err)
        }
      }

      _send({ id, type: Types.CLOSE })
      end('sink')
    },
    source: pushable(end.bind(null, 'source')),
    timeline: {
      open: Date.now(),
      close: null
    },
    id: externalId
  }

  return stream
}
