/* eslint-env mocha */
'use strict'

const tests = require('interface-stream-muxer')
const multiplex = require('../src')

describe.skip('compliance', () => {
  tests({
    setup (cb) {
      cb(null, multiplex)
    },
    teardown (cb) {
      cb()
    }
  })
})
