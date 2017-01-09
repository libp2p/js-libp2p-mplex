'use strict'

const expect = require('chai').expect


function mapSeries (list, func) {
  const res = []

  return list.reduce((acc, next) => {
    return acc.then((val) => {
      res.push(val)

      return func(next)
    })
  }, Promise.resolve(null)).then((val) => {
    res.push(val)
    return res.slice(1)
  })
}

describe.only('map', () => {
  it('maps', () => {
    const hashes = [
      'hash1',
      'hash2',
      'hash3'
    ]

    const get = (hash) => Promise.resolve(hash + 'cool')

    return mapSeries(hashes, get).then((res) => {
      expect(res).to.be.eql([
        'hash1cool',
        'hash2cool',
        'hash3cool'
      ])
    })
  })
})
