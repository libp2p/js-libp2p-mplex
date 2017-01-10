/* eslint-env mocha */
'use strict'

const expect = require('chai').expect
const pull = require('pull-stream')

const pullEnd = require('../src/pull-end')

describe('pull-end', () => {
  it('gets called on end', (done) => {
    pull(
      pull.values([1, 2]),
      pullEnd(done),
      pull.drain()
    )
  })

  it('does not get called on errors', (done) => {
    pull(
      pull.error(new Error('fail')),
      pullEnd(() => {
        throw new Error('should not be called')
      }),
      pull.onEnd(() => done())
    )
  })

  it('can emit a final value', (done) => {
    pull(
      pull.values([1, 2]),
      pullEnd(() => {
        return 3
      }),
      pull.collect((err, res) => {
        expect(err).to.not.exist
        expect(res).to.be.eql([1, 2, 3])
        done()
      })
    )
  })
})
