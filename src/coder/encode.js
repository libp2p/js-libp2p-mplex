'use strict'

const varint = require('varint')

const POOL_SIZE = 10 * 1024
const empty = Buffer.alloc(0)

class Encoder {
  constructor () {
    this._pool = Buffer.allocUnsafe(POOL_SIZE)
    this._poolOffset = 0
  }

  write (msg) {
    const pool = this._pool
    let offset = this._poolOffset

    varint.encode(msg.id << 3 | msg.type, pool, offset)
    offset += varint.encode.bytes
    varint.encode(msg.data ? msg.data.length : 0, pool, offset)
    offset += varint.encode.bytes

    const header = pool.slice(this._poolOffset, offset)

    if (POOL_SIZE - offset < 100) {
      this._pool = Buffer.allocUnsafe(POOL_SIZE)
      this._poolOffset = 0
    } else {
      this._poolOffset = offset
    }

    if (!msg.data) return [header, empty]

    return [header, msg.data]
  }
}

const encoder = new Encoder()

module.exports = source => (async function * encode () {
  for await (const msg of source) {
    const chunks = encoder.write(msg)
    for (let i = 0; i < chunks.length; i++) {
      yield chunks[i]
    }
  }
})()
