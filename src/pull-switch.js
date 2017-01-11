'use strict'

const pull = require('pull-stream')

module.exports = function pullSwitch (switcher) {
  let ended = false
  const cbs = new Set()

  return (read) => {
    function next (end, input) {
      if (end) {
        ended = end
        cbs.forEach((cb) => cb(end))
        cbs.clear()

        return
      }

      const sink = switcher(input)
      if (!sink) {
        return
      }

      if (!sink.pulled) {
        sink.data = input
        sink.pulled = true
        pull(
          (abort, cb) => {
            if (sink.data != null) {
              const _data = sink.data
              sink.data = null
              return cb(null, _data)
            }

            if (ended) {
              return cb(ended)
            }

            if (abort) {
              cb(abort)
              read(ended, next)
              return
            }

            cbs.add(cb)
            sink.cb = cb
            read(ended, next)
          },
          sink
        )
      } else if (sink.cb) {
        const _cb = sink.cb
        cbs.delete(_cb)
        sink.cb = null
        _cb(null, input)
      } else {
        sink.data = input
      }
    }

    read(null, next)
  }
}
