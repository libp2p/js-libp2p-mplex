'use strict'

const varint = require('varint')

exports.createHeader = (id, initiator, codeI, code) => {
  let flag
  if (codeI == null) {
    flag = initiator
  } else {
    flag = initiator ? codeI : code
  }

  const header = id << 3 | flag

  return new Buffer(varint.encode(header))
}

exports.readHeader = (raw) => {
  const header = varint.decode(raw)
  return {
    header: header,
    flag: header & 7,
    id: header >> 3
  }
}
