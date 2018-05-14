/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const concat = require('concat-stream')
const through = require('through2')
const chunky = require('chunky')
const toStream = require('pull-stream-to-stream')

const MplexCore = require('libp2p-mplex/src/internals')
const Plex = require('pull-mplex')

describe('node stream multiplex interop', () => {
  it('new2old: one way piping work with 2 sub-streams', (done) => {
    const pullPlex = new Plex(true)
    const plex1 = toStream(pullPlex)
    const stream1 = toStream(pullPlex.createStream())
    const stream2 = toStream(pullPlex.createStream())

    const plex2 = new MplexCore({ initiator: false }, (stream) => {
      stream.pipe(collect())
    })

    plex1.pipe(plex2)

    stream1.write(Buffer.from('hello'))
    stream2.write(Buffer.from('world'))
    stream1.end()
    stream2.end()

    let pending = 2
    const results = []

    function collect () {
      return concat(function (data) {
        results.push(data.toString())

        if (--pending === 0) {
          results.sort()
          expect(results[0].toString()).to.equal('hello')
          expect(results[1].toString()).to.equal('world')
          done()
        }
      })
    }
  })

  it('old2new: one way piping work with 2 sub-streams', (done) => {
    const plex1 = new MplexCore()
    const stream1 = plex1.createStream()
    const stream2 = plex1.createStream()

    const pullPlex = new Plex({
      onChan: (pullStream) => {
        const stream = toStream(pullStream)
        stream.pipe(collect())
      }
    })
    const plex2 = toStream(pullPlex)

    plex1.pipe(plex2)

    stream1.write(Buffer.from('hello'))
    stream2.write(Buffer.from('world'))
    stream1.end()
    stream2.end()

    let pending = 2
    const results = []

    function collect () {
      return concat(function (data) {
        results.push(data.toString())

        if (--pending === 0) {
          results.sort()
          expect(results[0].toString()).to.equal('hello')
          expect(results[1].toString()).to.equal('world')
          done()
        }
      })
    }
  })

  it('new2old: two way piping works with 2 sub-streams', (done) => {
    const pullPlex = new Plex(true)
    const plex1 = toStream(pullPlex)

    const plex2 = new MplexCore((stream) => {
      const uppercaser = through(function (chunk, e, callback) {
        this.push(Buffer.from(chunk.toString().toUpperCase()))
        this.end()
        callback()
      })
      stream.pipe(uppercaser).pipe(stream)
    })

    plex1.pipe(plex2).pipe(plex1)

    const stream1 = toStream(pullPlex.createStream())
    const stream2 = toStream(pullPlex.createStream())

    stream1.pipe(collect())
    stream2.pipe(collect())

    stream1.write(Buffer.from('hello'))
    stream2.write(Buffer.from('world'))

    let pending = 2
    const results = []

    function collect () {
      return concat(function (data) {
        results.push(data.toString())
        if (--pending === 0) {
          results.sort()
          expect(results[0].toString()).to.equal('HELLO')
          expect(results[1].toString()).to.equal('WORLD')
          done()
        }
      })
    }
  })

  it('old2new: two way piping works with 2 sub-streams', (done) => {
    const plex1 = new MplexCore()

    const plex2 = toStream(new Plex({
      initiator: false,
      onChan: (pstream) => {
        const stream = toStream(pstream)
        const uppercaser = through(function (chunk, e, callback) {
          this.push(Buffer.from(chunk.toString().toUpperCase()))
          this.end()
          callback()
        })
        stream.pipe(uppercaser).pipe(stream)
      }
    }))

    plex1.pipe(plex2).pipe(plex1)

    const stream1 = plex1.createStream()
    const stream2 = plex1.createStream()

    stream1.pipe(collect())
    stream2.pipe(collect())

    stream1.write(Buffer.from('hello'))
    stream2.write(Buffer.from('world'))

    let pending = 2
    const results = []

    function collect () {
      return concat(function (data) {
        results.push(data.toString())
        if (--pending === 0) {
          results.sort()
          expect(results[0].toString()).to.equal('HELLO')
          expect(results[1].toString()).to.equal('WORLD')
          done()
        }
      })
    }
  })

  it('2 buffers packed into 1 chunk', (done) => {
    const pullPlex = new Plex(false)
    const plex1 = toStream(pullPlex)

    const plex2 = new MplexCore(function (b) {
      b.pipe(concat(function (body) {
        expect(body.toString('utf8')).to.equal('abc\n123\n')
        plex1.end()
        done()
      }))
    })

    plex1.pipe(plex2).pipe(plex1)

    const a = toStream(pullPlex.createStream(1337))
    a.write('abc\n')
    a.write('123\n')
    a.end()
  })

  it('new2old: chunks', (done) => {
    let times = 100
    ;(function chunk () {
      const collect = collector(function () {
        if (--times === 0) {
          done()
        } else {
          chunk()
        }
      })

      const pullPlex = new Plex(true)
      const plex1 = toStream(pullPlex)
      const stream1 = toStream(pullPlex.createStream())
      const stream2 = toStream(pullPlex.createStream())

      const plex2 = new MplexCore((stream) => {
        stream.pipe(collect())
      })

      plex1.pipe(through(function (buf, enc, next) {
        const bufs = chunky(buf)
        for (let i = 0; i < bufs.length; i++) this.push(bufs[i])
        next()
      })).pipe(plex2)

      stream1.write(Buffer.from('hello'))
      stream2.write(Buffer.from('world'))
      stream1.end()
      stream2.end()
    })()

    function collector (cb) {
      let pending = 2
      const results = []

      return function () {
        return concat(function (data) {
          results.push(data.toString())
          if (--pending === 0) {
            results.sort()
            expect(results[0].toString()).to.equal('hello')
            expect(results[1].toString()).to.equal('world')
            cb()
          }
        })
      }
    }
  })

  it('old2new: chunks', (done) => {
    let times = 100
    ;(function chunk () {
      const collect = collector(function () {
        if (--times === 0) {
          done()
        } else {
          chunk()
        }
      })

      const plex1 = new MplexCore({ initiator: true })
      const stream1 = plex1.createStream()
      const stream2 = plex1.createStream()

      const pullStream = new Plex({
        initiator: false,
        onChan: (pullStream) => {
          const stream = toStream(pullStream)
          stream.pipe(collect())
        }
      })
      const plex2 = toStream(pullStream)

      plex1.pipe(through(function (buf, enc, next) {
        const bufs = chunky(buf)
        for (let i = 0; i < bufs.length; i++) this.push(bufs[i])
        next()
      })).pipe(plex2)

      stream1.write(Buffer.from('hello'))
      stream2.write(Buffer.from('world'))
      stream1.end()
      stream2.end()
    })()

    function collector (cb) {
      let pending = 2
      const results = []

      return function () {
        return concat(function (data) {
          results.push(data.toString())
          if (--pending === 0) {
            results.sort()
            expect(results[0].toString()).to.equal('hello')
            expect(results[1].toString()).to.equal('world')
            cb()
          }
        })
      }
    }
  })

  it('quick message', (done) => {
    const pullPlex2 = new Plex(true)
    const plex2 = toStream(pullPlex2)

    const plex1 = new MplexCore(function (stream) {
      stream.write('hello world')
    })

    plex1.pipe(plex2).pipe(plex1)

    setTimeout(function () {
      const chan = pullPlex2.createStream()
      chan.openChan()
      const stream = toStream(chan)
      stream.on('data', function (data) {
        expect(data).to.eql(Buffer.from('hello world'))
        done()
      })
    }, 100)
  })

  it('new2old: half close a muxed stream', (done) => {
    const pullPlex1 = new Plex(true)
    const plex1 = toStream(pullPlex1)

    const plex2 = new MplexCore()

    plex1.pipe(plex2).pipe(plex1)

    plex2.on('stream', function (stream, id) {
      expect(stream).to.exist()
      expect(id).to.exist()

      // let it flow
      stream.on('data', function (data) {
        console.dir(data)
      })

      stream.on('end', function () {
        done()
      })

      stream.on('error', function (err) {
        expect(err).to.not.exist()
      })

      stream.write(Buffer.from('hello world'))

      stream.end()
    })

    const chan = pullPlex1.createStream()
    const stream = toStream(chan)
    chan.openChan()

    stream.on('data', function (data) {
      expect(data).to.eql(Buffer.from('hello world'))
    })

    stream.on('error', function (err) {
      expect(err).to.not.exist()
    })

    stream.on('end', function () {
      stream.end()
    })
  })

  it('old2new: half close a muxed stream', (done) => {
    const plex1 = new MplexCore()

    const pullPlex2 = new Plex()
    const plex2 = toStream(pullPlex2)

    plex1.pipe(plex2).pipe(plex1)

    pullPlex2.on('stream', function (chan, id) {
      const stream = toStream(chan)
      expect(stream).to.exist()
      expect(id).to.exist()

      // let it flow
      stream.on('data', function (data) {
        console.dir(data)
      })

      stream.on('end', function () {
        done()
      })

      stream.on('error', function (err) {
        expect(err).to.not.exist()
      })

      stream.write(Buffer.from('hello world'))

      stream.end()
    })

    const stream = plex1.createStream()

    stream.on('data', function (data) {
      expect(data).to.eql(Buffer.from('hello world'))
    })

    stream.on('error', function (err) {
      expect(err).to.not.exist()
    })

    stream.on('end', function () {
      stream.end()
    })
  })

  it('new2old: half close a half closed muxed stream', (done) => {
    const pullPlex1 = new Plex(true)
    const plex1 = toStream(pullPlex1)
    const plex2 = new MplexCore({ halfOpen: true })

    plex1.nameTag = 'plex1:'
    plex2.nameTag = 'plex2:'

    plex1.pipe(plex2).pipe(plex1)

    plex2.on('stream', function (stream, id) {
      expect(stream).to.exist()
      expect(id).to.exist()

      stream.on('data', function (data) {
        expect(data).to.eql(Buffer.from('some data'))
      })

      stream.on('end', function () {
        stream.write(Buffer.from('hello world'))
        stream.end()
      })

      stream.on('error', function (err) {
        expect(err).to.not.exist()
      })
    })

    const chan = pullPlex1.createStream()
    const stream = toStream(chan)

    stream.on('data', function (data) {
      expect(data).to.eql(Buffer.from('hello world'))
    })

    stream.on('error', function (err) {
      expect(err).to.not.exist()
    })

    stream.on('end', function () {
      done()
    })

    stream.write(Buffer.from('some data'))

    stream.end()
  })

  it('old2new: half close a half closed muxed stream', (done) => {
    const plex1 = new MplexCore({ halfOpen: true })

    const pullPlex2 = new Plex(false)
    const plex2 = toStream(pullPlex2)

    plex1.nameTag = 'plex1:'
    plex2.nameTag = 'plex2:'

    plex1.pipe(plex2).pipe(plex1)

    pullPlex2.on('stream', (chan, id) => {
      const stream = toStream(chan)

      expect(stream).to.exist()
      expect(id).to.exist()

      stream.on('data', (data) => {
        expect(data).to.eql(Buffer.from('some data'))
      })

      stream.on('end', () => {
        stream.write(Buffer.from('hello world'))
        stream.end()
      })

      stream.on('error', (err) => {
        expect(err).to.not.exist()
        console.dir(err)
      })
    })

    const stream = plex1.createStream()

    stream.on('data', (data) => {
      expect(data).to.eql(Buffer.from('hello world'))
    })

    // we can't make pull stream halfOpen with pull-stream-to-pull-stream
    // so it will error out with a writting after EOF error, so just ignore
    stream.on('error', (err) => {
      expect(err).to.not.exist()
    })

    stream.on('end', function () {
      done()
    })

    stream.write(Buffer.from('some data'))

    stream.end()
  })
})
