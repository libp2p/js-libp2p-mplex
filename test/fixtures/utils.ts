import type { Message } from '../../src/message-types.js'

export function messageWithBytes (msg: Message) {
  if (msg.type === 0 || msg.type === 1 || msg.type === 2) {
    return {
      ...msg,
      data: msg.data.slice() // convert Uint8ArrayList to Buffer
    }
  }

  return msg
}
