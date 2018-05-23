'use strict'

const each = require('async/each')
const eachLimit = require('async/eachLimit')

const Plex = require('multiplex')

const spawn = (nStreams, nMsg, done, limit) => {
  const check = marker(2 * nStreams, done)

  const msg = 'simple msg'

  const listener = new Plex()
  const dialer = new Plex()

  listener.on('stream', (stream) => {
    stream.once('data', () => {
      check()
    })

    stream.once('error', (err) => {
      done(err)
    })
  })

  dialer.pipe(listener).pipe(dialer)

  const numbers = []
  for (let i = 1; i <= nStreams; i++) {
    numbers.push(i)
  }

  const spawnStream = (n, cb) => {
    const stream = dialer.createStream()

    stream.once('error', (err) => {
      return done(err)
    })

    for (let i = 0; i <= nMsg; i++) {
      stream.write(msg + i)
    }

    check()
    stream.end()
    cb()
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

spawn(1000, 10000, (err) => {
  if (err) {
    throw err
  }
  console.log('Done')
  process.exit(0)
}, 50000)
