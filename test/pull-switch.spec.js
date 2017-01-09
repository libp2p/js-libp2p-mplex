/* eslint-env mocha */
'use strict'

const expect = require('chai').expect
const pull = require('pull-stream')
const pullSwitch = require('../src/pull-switch')

function makeCheck (n, done) {
  let i = 0

  return (err) => {
    if (err) {
      return done(err)
    }

    if (++i === n) {
      done()
    }
  }
}

describe('pull-switch', () => {
  it('switches sync values', (done) => {
    const check = makeCheck(3, done)
    const sinks = [
      pull.collect((err, vals) => {
        expect(err).to.not.exist
        expect(vals).to.be.eql([3, 6, 9])
        check()
      }),
      pull.collect((err, vals) => {
        expect(err).to.not.exist
        expect(vals).to.be.eql([1, 4, 7])
        check()
      }),
      pull.collect((err, vals) => {
        expect(err).to.not.exist
        expect(vals).to.be.eql([2, 5, 8])
        check()
      })
    ]

    pull(
      pull.values([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      pullSwitch((data) => {
        const i = data % 3
        return sinks[i]
      })
    )
  })

  it('switches async values', (done) => {
    const check = makeCheck(3, done)
    const sinks = [
      pull.collect((err, vals) => {
        expect(err).to.not.exist
        expect(vals).to.be.eql([3, 6, 9])
        check()
      }),
      pull.collect((err, vals) => {
        expect(err).to.not.exist
        expect(vals).to.be.eql([1, 4, 7])
        check()
      }),
      pull.collect((err, vals) => {
        expect(err).to.not.exist
        expect(vals).to.be.eql([2, 5, 8])
        check()
      })
    ]

    pull(
      pull.values([1, 2, 3, 4, 5, 6, 7, 8, 9]),
      pull.asyncMap((val, cb) => {
        setTimeout(() => {
          cb(null, val)
        }, 10)
      }),
      pullSwitch((data) => {
        const i = data % 3
        return sinks[i]
      })
    )
  })
})
