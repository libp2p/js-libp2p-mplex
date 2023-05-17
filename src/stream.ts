import { MAX_MSG_SIZE } from './decode.js'
import { InitiatorMessageTypes, ReceiverMessageTypes } from './message-types.js'
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string'
import { Uint8ArrayList } from 'uint8arraylist'
import type { Message } from './message-types.js'
import { AbstractStream, AbstractStreamInit } from '@libp2p/interface-stream-muxer/stream'

export interface Options {
  id: number
  send: (msg: Message) => void
  name?: string
  onEnd?: (err?: Error) => void
  type?: 'initiator' | 'receiver'
  maxMsgSize?: number
}

interface MplexStreamInit extends AbstractStreamInit {
  streamId: number
  name: string
  send: (msg: Message) => void
}

class MplexStream extends AbstractStream {
  private name: string
  private streamId: number
  private send: (msg: Message) => void
  private types: Record<string, number>

  constructor (init: MplexStreamInit) {
    super(init)

    this.types = init.direction === 'outbound' ? InitiatorMessageTypes : ReceiverMessageTypes
    this.send = init.send
    this.name = init.name
    this.streamId = init.streamId
  }

  sendNewStream () {
    this.send({ id: this.streamId, type: InitiatorMessageTypes.NEW_STREAM, data: new Uint8ArrayList(uint8ArrayFromString(this.name)) })
  }

  sendData (data: Uint8ArrayList): void {
    this.send({ id: this.streamId, type: this.types.MESSAGE, data })
  }

  sendReset (): void {
    this.send({ id: this.streamId, type: this.types.RESET })
  }

  sendCloseWrite (): void {
    this.send({ id: this.streamId, type: this.types.CLOSE })
  }

  sendCloseRead(): void {
    // mplex does not support close read, only close write
  }
}

export function createStream (options: Options): MplexStream {
  const { id, name, send, onEnd, type = 'initiator', maxMsgSize = MAX_MSG_SIZE } = options

  return new MplexStream({
    id: type === 'initiator' ? (`i${id}`) : `r${id}`,
    streamId: id,
    name: `${name == null ? id : name}`,
    direction: type === 'initiator' ? 'outbound' : 'inbound',
    maxDataSize: maxMsgSize,
    onEnd,
    send
  })
}
