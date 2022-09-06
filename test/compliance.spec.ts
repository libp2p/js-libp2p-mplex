/* eslint-env mocha */

import tests from '@libp2p/interface-stream-muxer-compliance-tests'
import { Mplex } from '../src/index.js'

describe('compliance', () => {
  tests({
    async setup () {
      return new Mplex({
        maxInboundStreams: Infinity,
        maxNewInboundStreamsPerSecond: Infinity
      })
    },
    async teardown () {}
  })
})
