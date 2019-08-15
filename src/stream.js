'use strict'

const abortable = require('abortable-iterator')
const AbortController = require('abort-controller')
const log = require('debug')('mplex:stream')
const pushable = require('it-pushable')
const { InitiatorMessageTypes, ReceiverMessageTypes } = require('./message-types')

module.exports = ({ id, name, send, onEnd = (() => {}), type = 'initiator' }) => {
  const abortController = new AbortController()
  const resetController = new AbortController()
  const Types = type === 'initiator' ? InitiatorMessageTypes : ReceiverMessageTypes

  name = String(name == null ? id : name)

  let sourceEnded = false
  let sinkEnded = false
  let endErr

  const onSourceEnd = err => {
    sourceEnded = true
    log('%s stream %s source end', type, name, err)
    if (err && !endErr) endErr = err
    if (sinkEnded) onEnd(endErr)
  }

  const onSinkEnd = err => {
    sinkEnded = true
    log('%s stream %s sink end', type, name, err)
    if (err && !endErr) endErr = err
    if (sourceEnded) onEnd(endErr)
  }

  const stream = {
    // Close for reading
    close: () => stream.source.end(),
    // Close for reading and writing (local error)
    abort: err => {
      // End the source with the passed error
      stream.source.end(err)
      abortController.abort()
    },
    // Close immediately for reading and writing (remote error)
    reset: () => resetController.abort(),
    sink: async source => {
      source = abortable(source, abortController.signal, { abortMessage: 'stream aborted', abortCode: 'ERR_MPLEX_STREAM_ABORT' })
      source = abortable(source, resetController.signal, { abortMessage: 'stream reset', abortCode: 'ERR_MPLEX_STREAM_RESET' })

      if (type === 'initiator') { // If initiator, open a new stream
        send({ id, type: Types.NEW_STREAM, data: name })
      }

      try {
        for await (const data of source) {
          send({ id, type: Types.MESSAGE, data })
        }
      } catch (err) {
        // Send no more data if this stream was remotely reset
        if (err.code === 'ERR_MPLEX_STREAM_RESET') {
          log('%s stream %s reset', type, name)
        } else {
          log('%s stream %s error', type, name, err)
          send({ id, type: Types.RESET })
        }

        stream.source.end(err)
        return onSinkEnd(err)
      }

      send({ id, type: Types.CLOSE })
      onSinkEnd()
    },
    source: pushable(onSourceEnd)
  }

  return stream
}
