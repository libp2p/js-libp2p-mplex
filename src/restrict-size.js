'use strict'

const MAX_MSG_SIZE = 1 << 20 // 1MB

module.exports = max => {
  max = max || MAX_MSG_SIZE

  const checkSize = msg => {
    if (msg.data && msg.data.length > max) {
      throw Object.assign(new Error('message size too large!'), { code: 'ERR_MSG_TOO_BIG' })
    }
  }

  return source => {
    return (async function * restrictSize () {
      for await (const msg of source) {
        if (Array.isArray(msg)) {
          msg.forEach(checkSize)
        } else {
          checkSize(msg)
        }
        yield msg
      }
    })()
  }
}
