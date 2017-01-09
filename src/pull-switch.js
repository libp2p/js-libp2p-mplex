'use strict'

const pull = require('pull-stream')
const peek = require('pull-peek')
const pushable = require('pull-pushable')

module.exports = function pullSwitch (switcher) {
  let ended = false
  let cbs = []
  let data = []
  let sinks = []

  return (read) => {
    function next (end, input) {
      if (end) {
        ended = end
        cbs.filter(Boolean).forEach((cb) => cb(end))
        sinks = []

        return
      }

      const sink = switcher(input)
      let index = sinks.indexOf(sink)

      if (index === -1) {
        sinks.push(sink)
        index = sinks.length - 1
        data[index] = input

        pull(
          (abort, cb) => {
            if (data[index]) {
              const _data = data[index]
              data[index] = null
              return cb(null, _data)
            }

            if (ended) {
              return cb(ended)
            }

            if (abort) {
              // dead, remove
              sinks = sinks.slice(0, index).concat(sinks.slice(index + 1))
              return cb(abort)
            }

            cbs[index] = cb
            read(ended, next)
          },
          sink
        )
      } else if (cbs[index]) {
        cbs[index](null, input)
      } else {
        data[index] = input
      }
    }

    read(null, next)
  }
}
