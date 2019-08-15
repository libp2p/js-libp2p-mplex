'use strict'

const varint = require('varint')
const BufferList = require('bl')

module.exports = source => (async function * decode () {
  const decoder = new Decoder()
  for await (const chunk of source) {
    const msgs = decoder.write(chunk)
    for (let i = 0; i < msgs.length; i++) yield msgs[i]
  }
})()

class Decoder {
  constructor () {
    this._buffer = new BufferList()
    // optimisation to allow varint to take a bl (well a proxy to)
    this._bufferProxy = new Proxy({}, {
      get: (_, prop) => prop[0] === 'l' ? this._buffer[prop] : this._buffer.get(parseInt(prop))
    })
    this._headerInfo = null
  }

  write (chunk) {
    if (!chunk || !chunk.length) return []

    this._buffer.append(chunk)

    if (!this._headerInfo) {
      try {
        this._headerInfo = this._decodeHeader(this._bufferProxy)
      } catch (err) {
        return [] // not enough data yet...probably
      }

      // remove the header from the buffer
      this._buffer = this._buffer.shallowSlice(this._headerInfo.offset)
    }

    const { id, type, length } = this._headerInfo

    if (this._buffer.length < length) return [] // not got enough data yet

    if (this._buffer.length === length) {
      const msg = { id, type, data: this._buffer }

      this._headerInfo = null
      this._buffer = new BufferList()

      return [msg]
    }

    const msg = { id, type, data: this._buffer.shallowSlice(0, length) }
    const rest = this._buffer.shallowSlice(length)

    this._headerInfo = null
    this._buffer = new BufferList()

    return [msg, ...this.write(rest)]
  }

  _decodeHeader (data) {
    const h = varint.decode(data)
    let offset = varint.decode.bytes
    const length = varint.decode(data, offset)
    offset += varint.decode.bytes
    return { id: h >> 3, type: h & 7, offset, length }
  }
}
