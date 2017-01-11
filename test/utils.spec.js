/* eslint-env mocha */
'use strict'

const expect = require('chai').expect

const utils = require('../src/utils')

describe('utils', () => {
  describe('createHeader', () => {
    it('initiator', () => {
      expect(
        utils.createHeader(2, true, 2, 1)
      ).to.be.eql(
        new Buffer([18])
      )
    })

    it('not initiator', () => {
      expect(
        utils.createHeader(2, false, 2, 1)
      ).to.be.eql(
        new Buffer([17])
      )
    })

    it('no initiator', () => {
      expect(
        utils.createHeader(2, 4)
      ).to.be.eql(
        new Buffer([20])
      )
    })
  })

  describe('readHeader', () => {
    it('simple', () => {
      expect(
        utils.readHeader(new Buffer([20]))
      ).to.be.eql({
        header: 20,
        flag: 4,
        id: 2
      })
    })
  })
})
