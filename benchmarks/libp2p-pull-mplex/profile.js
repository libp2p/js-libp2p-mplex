'use strict'

const pair = require('pull-pair/duplex')
const pull = require('pull-stream')
const generate = require('pull-generate')
const each = require('async/each')
const eachLimit = require('async/eachLimit')
const setImmediate = require('async/setImmediate')

const Plex = require('../../src')

const spawn = (nStreams, nMsg, done, limit) => {
  const p = pair()

  const check = marker(2 * nStreams, done)

  const msg = 'simple msg'

  const listener = Plex.dialer(p[0])
  const dialer = Plex.listener(p[1])

  listener.on('stream', (stream) => {
    pull(
      stream,
      pull.onEnd((err) => {
        if (err) { return done(err) }
        check()
        pull(pull.empty(), stream)
      })
    )
  })

  const numbers = []
  for (let i = 0; i < nStreams; i++) {
    numbers.push(i)
  }

  const spawnStream = (n, cb) => {
    const stream = dialer.newStream()
    pull(
      generate(0, (s, cb) => {
        setImmediate(() => {
          cb(s === nMsg ? true : null, msg, s + 1)
        })
      }),
      stream,
      pull.collect((err) => {
        if (err) { return done(err) }
        check()
        cb()
      })
    )
  }

  if (limit) {
    eachLimit(numbers, limit, spawnStream, () => {})
  } else {
    each(numbers, spawnStream, () => {})
  }
}

function marker (n, done) {
  let i = 0
  return (err) => {
    i++

    // console.log(`${i} out of ${n} interactions`)
    if (err) {
      console.error('Failed after %s iterations', i)
      return done(err)
    }

    if (i === n) {
      done()
    }
  }
}

spawn(1000, 1000, (err) => {
  if (err) {
    throw err
  }
  console.log('Done')
  process.exit(0)
}, 50000)
