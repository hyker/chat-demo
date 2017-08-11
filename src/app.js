import _ from 'lodash'
import React from 'react'
import atob from 'atob'
import btoa from 'btoa'
import path from 'path'
import rimraf from 'rimraf'
import storage from 'electron-json-storage'
import Channels from './channels'
import Login from './login'
import Chat from './chat'
import Client from './client'

import { verifyEmailAccount, verifyGithubAccount } from './verify'

import {
  CHAT_URL,
  CHAT_END_ADD,
  CHAT_END_DEL,
  CHAT_END_GET,
} from './consts'

import RiksKit from 'riks'

/**
 * Main application.
 * Holds communication client, crypto client and general application state. 
 */
export default class App extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      id: null, // ephemeral id of device
      name: '', // well-known id of user
      channel: '', // current selected channel
      channels: {}, // all available channels
      messages : {}, // loaded messages. { channel: [ message, ... ], ... } 
      sequence: {}, // current sequence for each channel, for reliability

      // access control whitelist { member: 0 || 1 }
      // member: the well-known id of a user
      // 0: deny
      // 1: allow
      whitelist: {}, 
    }
  }

  /**
   * Watch state transistions to perform side effects.
   * Actions are triggered by transition of state.
   * E.g. request to add channel members at backend, add entries to whitelist.
   * Also initiates crypto client once id becomes available.
   */
  componentWillUpdate(nextProps, nextState) {
    // on change of current selected channel
    if (this.state.channel != nextState.channel) {
      // handle (un)subscription to channels based on current selected channel
      if (this.state.channel)
        this.client.unsubscribe(this.state.channel)
      if (nextState.channel) {
        // subscribe with the latest stored sequence number for reliability
        this.client.subscribe(nextState.channel, nextState.sequence[nextState.channel] || 1)
      }
    }

    // on change in channel list
    if (this.state.channels != nextState.channels) {
      // selects channel when the first is available or current one is deleted
      if (!this.state.channel || !(this.state.channel in nextState.channels)) {
        var channel = ''
        for (channel in nextState.channels)
          break
        this.setState({ channel })
      }

      // detect add and remove operations on a channel
      if (!nextState.ignore) // ignore if change is from a explicit load
      for (var channel in nextState.channels) {
        var prev = this.state.channels[channel] || [],
          next = nextState.channels[channel]

        // find out if its a add or delete operation
        var add = prev.length < next.length,
          oper = add ? CHAT_END_ADD : CHAT_END_DEL,
          diff = add ?
            next.filter((i) => prev.indexOf(i) < 0) :
            prev.filter((i) => next.indexOf(i) < 0)

        if (diff.length)
          fetch(`http://${CHAT_URL}/${oper}/${channel}/${diff[0]}`)
          .catch(console.log)
      }

      // update whitelist with new entrys (new members)
      var whitelist = Object.assign({}, this.state.whitelist)
      for (var channel of Object.values(nextState.channels))
        for (var member of channel)
          if (!this.state.whitelist.hasOwnProperty(member))
            if (member != this.state.name)
              whitelist[member] = 1 // default ie allow

      this.setState({ whitelist })
    }

    // id becomes available, ie user logs in
    if (!this.state.id && nextState.id) {

      // load channels 
      this.setState({}, () => {
        this.initClient() // must be in callback, it needs state id and name
        this.loadChannels().then(this.loadWhitelist)
      })

      const store = 'persistenceFile.store'
      const { id, name } = nextState
      // construct device id from name and random id
      const deviceId = '#' + btoa(name + '|' + id).replace(/=/g, '')
      const password = 'password' // mock password

      // init the crypto
      this.crypto = new RiksKit(deviceId, password, store, (did, ns, keyId, allow) => {
          // conveniently, the name (well-known) is part of id
          const [ name, id ] = atob(did.substring(1)).split('|')

          // deny if name not in whitelist
          if (!this.state.whitelist[name])
            return false

          // verify relation between id and name
          if (name.startsWith('gh:'))
            verifyGithubAccount(id, name.substring(3)).then((ok) => {
              allow(ok) 
            })
          else
            verifyEmailAccount(id, name).then((ok) => {
              allow(ok) 
            })

        }, console.log)

      window.onbeforeunload = () => {
        if (this.crypto)
          this.crypto.close()
      }
    }

    if (nextState.ignore)
      this.setState({ ignore: false })
  }
  
  /**
   * App is launched, begin initiation.
   */
  componentWillMount() {
    Promise.resolve()
      .then(this.checkForId)
      .catch(console.log)
  }

  /**
   * Check and load id if is available.
   */
  checkForId = () => {
    return new Promise((resolve, reject) => {
      storage.get('hyker-chat-app', (error, data) => {
        this.setState({ id: data.id, name: data.name })
        data.id && resolve() || reject('not registered')
      })
    })
  }

  /**
   * Init communication client.
   */
  initClient = () => {
    this.client = new Client(this.state.name)
    const setState = _.debounce(() => {
      this.setState(this.state)
    })

    // receive messages
    this.client.onAction(async ({ channel, sequence, name, text }) => {
      // store sequence number
      if (sequence) {
        this.state.sequence[this.state.channel] = sequence 
      }

      if (text) {
        if (!this.state.messages[this.state.channel])
          this.state.messages[this.state.channel] = []

        if (name == this.state.name)
          name = null

        text = await this.crypto.decrypt(text) // inject decrypt

        this.state.messages[this.state.channel].push({ name, text })
      }

      setState()

    // refresh structure trigger
    }, () => {
      this.loadChannels().catch(console.log)
    })

    return Promise.resolve()
  }

  /**
   * User requests login.
   */
  onLogin = (id, name) => {
    storage.set('hyker-chat-app', { id, name })
    this.setState({ id, name })
  }

  /**
   * User requests to publish a message.
   */
  publishMessage = async (text) => {
    let channel = this.state.channel

    text = await this.crypto.encrypt(text, channel) // inject encrypt

    this.client.publish(channel, text)
  }

  /**
   * User requests to add a new channel.
   */
  newChannel = (channel) => {
    channel = channel.toLowerCase()
    var channels = Object.assign({}, this.state.channels)
    if (!(channel in channels))
      channels[channel] = [ this.state.name ]
    this.setState({ channels })
  }

  /**
   * User selects a channel.
   */
  setChannel = (channel) => {
      this.setState({ channel })
  }

  /**
   * Load channels from backend.
   */
  loadChannels = () => {
    return fetch(`http://${CHAT_URL}/${CHAT_END_GET}/${this.state.name}`)
    .then((response) => response.json())
    .then((channels) => {
      this.setState({ channels, ignore: true })
    })
  }

  /**
   * Delete member from channels in state.
   */
  delMember = (member) => {
    var channels = Object.assign({}, this.state.channels)
    var channel = channels[this.state.channel].slice()
    channel.splice(channel.indexOf(member), 1)
    channels[this.state.channel] = channel
    this.setState({ channels })
  }

  /**
   * Add member from channels in state.
   */
  addMember = (member) => {
    var channels = Object.assign({}, this.state.channels)
    var channel = channels[this.state.channel].slice()
    if (!~channel.indexOf(member)) 
      channel.push(member)
    channels[this.state.channel] = channel
    this.setState({ channels })
  }

  /**
   * Set rule in whitelist.
   */
  handleWhitelist = (member, ok) => {
    var whitelist = this.state.whitelist
    whitelist[member] = ok ? 1 : 0
    storage.set('hyker-chat-app-whitelist', whitelist)
    this.setState({ whitelist })
  }

  /**
   * Load whitelist from disk.
   */
  loadWhitelist = () => {
    return new Promise((resolve, reject) => {
      storage.get('hyker-chat-app-whitelist', (error, data) => {
        var whitelist = Object.assign({}, this.state.whitelist, data || {})
        this.setState({ whitelist })
        resolve()
      })
    })
  }

  /**
   * User requests to logout, delete all records.
   */
  logout = () => {
      this.crypto.close()
      this.crypto = null
      for (const file of [ 'keys', 'persistenceFile.storage' ])
        rimraf(path.resolve(__dirname + '/../' + file), () => {})
      storage.set('hyker-chat-app', {})
      storage.set('hyker-chat-app-whitelist', {})
      this.setState({ id: undefined, channel: '', channels: {} })
  }

  /**
   * Render application.
   */
  render() {
      // initial state is still loading 
      if (this.state.id === null)
          return <div></div>

      // initial state has loaded but id is not present, trigger login
      if (!this.state.id)
          return <Login onLogin={this.onLogin} />

      let chat

      if (this.state.channel)
          chat = <Chat
            members={this.state.channels[this.state.channel] || []}
            messages={this.state.messages[this.state.channel] || []}
            onMessage={this.publishMessage}
            onDelMember={this.delMember}
            onAddMember={this.addMember}
          />
      else
          chat = <div></div>
      return (
          <div style={styles.cont}>
              <div style={styles.side}>
                  <Channels
                      channel={this.state.channel}
                      channels={this.state.channels}
                      onNew={this.newChannel}
                      onSet={this.setChannel}
                      logout={this.logout}
                      whitelist={this.state.whitelist}
                      indicate={this.state.indicate}
                      toggle={this.handleWhitelist}
                  />
              </div>
              <div style={styles.main}>
                  {chat}
              </div>
          </div>
      );
  }
}

const styles = {
  cont: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  side: {
    width: 300,
    borderRight: 'solid 1px #eee',
    overflowY: 'auto',
    overflowX: 'hidden',
  },
  main: {
    flexGrow: 1,
  }
}
