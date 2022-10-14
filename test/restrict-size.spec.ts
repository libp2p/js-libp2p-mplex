/* eslint-env mocha */

import { expect } from 'aegir/chai'
import { pipe } from 'it-pipe'
import randomBytes from 'iso-random-stream/src/random.js'
import { Message, MessageTypes } from '../src/message-types.js'
import { Uint8ArrayList } from 'uint8arraylist'
import { MplexStream, MplexStreamMuxer } from '../src/mplex.js'
import { encode } from '../src/encode.js'

describe('restrict-size', () => {
  const maxMsgSize = 32

  it('should throw when size is too big', async () => {
    const input: Message[] = [
      { id: 0, type: 1, data: new Uint8ArrayList(randomBytes(8)) },
      { id: 0, type: 1, data: new Uint8ArrayList(randomBytes(maxMsgSize)) },
      { id: 0, type: 1, data: new Uint8ArrayList(randomBytes(64)) },
      { id: 0, type: 1, data: new Uint8ArrayList(randomBytes(16)) }
    ]

    const output: Message[] = []
    const streamMuxer = new MplexStreamMuxer({ maxMsgSize })
    let abortError: Error | null = null

    // Mutate _handleIncoming to capture output
    streamMuxer._handleIncoming = async (msg) => {
      output.push(msg)
    }

    // Note: in current MplexStreamMuxer it's very hard to access sink errors.
    // The simplest way currently is to add a mock stream that will be aborted
    // on MplexStreamMuxer.close()
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const mockStream = {
      abort: (err) => {
        abortError = err
      }
    } as MplexStream
    // eslint-disable-next-line @typescript-eslint/dot-notation
    streamMuxer['_streams'].initiators.set(0, mockStream)

    await pipe(
      input,
      encode,
      streamMuxer.sink
    )

    if (abortError === null) throw Error('did not restrict size')
    expect(abortError).to.have.property('code', 'ERR_MSG_TOO_BIG')
    expect(output).to.have.length(2)
    expect(output[0]).to.deep.equal(input[0])
    expect(output[1]).to.deep.equal(input[1])
  })

  it('should allow message with no data property', async () => {
    const input: Message[] = [{ id: 4, type: MessageTypes.CLOSE_RECEIVER }]

    const output: Message[] = []
    const streamMuxer = new MplexStreamMuxer({ maxMsgSize })

    // Mutate _handleIncoming to capture output
    streamMuxer._handleIncoming = async (msg) => {
      output.push(msg)
    }

    await pipe(
      input,
      encode,
      streamMuxer.sink
    )
    expect(output).to.deep.equal(input)
  })
})
