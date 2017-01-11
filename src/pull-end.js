'use strict'

module.exports = function pullEnd (onEnd) {
  onEnd = onEnd || function noop () {}

  let ended = false
  return function sink (read) {
    return function source (abort, callback) {
      read(abort, function onNext (end, data) {
        if (ended) {
          return callback(true)
        }

        if (end) {
          if (end === true) {
            ended = true
            return callback(null, onEnd())
          }

          return callback(end)
        }

        callback(end, data)
      })
    }
  }
}
