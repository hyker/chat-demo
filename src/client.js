import {
  CHAT_URL,
  CHAT_END_WS,
  CHAT_KEY_PUB,
  CHAT_KEY_SUB,
  CHAT_KEY_UNSUB,
  CHAT_KEY_NOTIFY,
  CHAT_KEY_MSG,
  CHAT_KEY_REFRESH,
} from './consts'

/**
 * Client to communicate with the chat backend.
 * WebSocket protocol format: "action[|arg...]" 
 */
export default class Client {

  /**
   * Create a client.
   * Takes the name (well-known id) of the current user.
   */ 
  constructor(name) {
    this.name = name
    this.isConnected = false
    
    // If some interactions with the client is done while not connection is
    // established, place them on a backlog and execute them when connected.
    this.offlineBacklog = []

    this.ws = new WebSocket(`ws://${CHAT_URL}/${CHAT_END_WS}`)
    this.ws.onopen = () => {
      this.isConnected = true 

      // work through backlog
      for (let task of this.offlineBacklog)
        task()

      // subscribe to refresh notifications relating name
      this.ws.send(`${CHAT_KEY_NOTIFY}|${name}`)
    }
  }
 
  /**
   * Publish a chat message to the message stream.
   * 
   * channel: the channel to publish on
   * message: the message text to be published
   */
  publish(channel, message) {
    // if not connected, push to backlog
    if (!this.isConnected)
      return this.offlineBacklog.push(this.put.bind(this, ...arguments))

    this.ws.send(`${CHAT_KEY_PUB}|${channel}|${this.name}|${message}`)
  }

  /**
   * Subscribe to a channel, from the point in time indicated by sequence.
   *
   * channel: the channel to subscribe to
   * sequence: the sequence number indicating current point in time
   */
  subscribe(channel, sequence) {
    // if not conneted, push to backlog
    if (!this.isConnected)
      return this.offlineBacklog.push(this.subscribe.bind(this, ...arguments))

    this.ws.send(`${CHAT_KEY_SUB}|${channel}|${sequence}`)
  }

  /**
   * Unsubscribe from a channel.
   *
   * channel: the channel to unsubscribe from
   */
  unsubscribe(channel) {
    // if not connected, push to backlog
    if (!this.isConnected)
      return this.offlineBacklog.push(this.unsubscribe.bind(this, ...arguments))

    this.ws.send(`${CHAT_KEY_UNSUB}|${channel}`)
  }

  /**
   * Set action callbacks.
   */
  onAction(onMessage, refresh) {
    // if not connected, push to backlog
    if (!this.isConnected)
        return this.offlineBacklog.push(this.onAction.bind(this, ...arguments))

    this.ws.onmessage = ({ data }) => {
      // if data is a refresh, invoke the callback
      if (data == CHAT_KEY_REFRESH)
        refresh()
      // if data is a message, invoke the callback
      else if (data.startsWith(CHAT_KEY_MSG)) {
        let list = data.split('|'),
            args = list.splice(0, 4),
            rest = list.join('|')

        let [ , channel, sequence, name ] = args

        onMessage({ sequence, channel, name, text: rest }) 
      }
    }
  }
}
