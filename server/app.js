const fs = require('fs');
const url = require('url')
const http = require('http')
const uuid = require('uuid/v4')
const validator = require('validator')
const bluebird = require('bluebird')
const WebSocket = require('ws')
const r = require('rethinkdb')
const redis = require('redis')
const request = require('request-promise-native')
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')

// import constants shared with client
const {
  CHAT_KEY_PUB,
  CHAT_KEY_SUB,
  CHAT_KEY_UNSUB,
  CHAT_KEY_NOTIFY,
  CHAT_KEY_REFRESH,
  CHAT_KEY_MSG,
} = require('./consts')

// import config constants
const {
  MAIL_VERIFY_URL,
  MAIL_MG_KEY,
  MAIL_MG_URL,
  MAIL_FROM,
  MAIL_SUBJ,
  MAIL_TMPL,
  RETHINK_HOST,
  RETHINK_PORT,
  REDIS_HOST,
  REDIS_PORT,
} = require('./config')

// load the verify letter
const mailTmpl = fs.readFileSync(MAIL_TMPL, 'utf8')

// chat data structures
const channels = {}
const clients = {}
const observers = {}

/**
 * Add endpoint.
 * Add member to channel.
 */
const add = async (req, res) => {
  const { channel, id } = req.params

  if (!(channel in channels))
    channels[channel] = []

  if (!~channels[channel].indexOf(id))
    channels[channel].push(id)

  notify(channel, id)
  res.sendStatus(200)
}

/**
 * Remove endpoint.
 * Remove member from channel.
 */
const del = async (req, res) => {
  const { channel, id } = req.params

  if (channel in channels) {
    channels[channel].splice(channels[channel].indexOf(id), 1)

    if (!channels[channel].length)
      delete channels[channel]
  }

  notify(channel, id)
  res.sendStatus(200)
}

/**
 * Get endpoint.
 * Get channels of member.
 */
const get = async (req, res) => {
  const { id } = req.params
  const result = getInfo(id)
  res.json(result)
}

/**
 * Register endpoint.
 * Register id with email address.
 */
const reg = async (redis, req, res) => {
  const { id, mail } = req.body

  if (!id || !validator.isAscii(id))
    throw `invalid identity: ${id}`

  if (!validator.isEmail(mail +''))
    throw `invalid email address ${mail}`

  // check if mail already has been registered and verified
  const isMember = await redis.sismember_(mail, id)

  if (isMember)
    throw 'id already registered' 

  code = uuid().replace(/-/g, '')

  await redis.multi()
    .set(id, mail)
    .set(code, id)
    .exec_()

  await sendMail(mail, code)

  res.send()
}

/**
 * Verify endpoint.
 * Verify mail account by code.
 */
const verify = async (redis, req, res) => {
  const { code } = req.params

  if (!code || !validator.isAscii(code))
    throw `invalid code ${code}`

  const id = await redis.get_(code)

  if (!id)
    throw 'unknown code'
  
  const mail = await redis.get_(id)
  await redis.sadd_(mail, id)

  res.send('ok')
}

/**
 * Show endpoint.
 * Show ids of mail.
 */
const show = async (redis, req, res) => {
  const { mail } = req.params

  if (!validator.isEmail(mail +''))
    throw `invalid email address ${mail}`

  const ids = await redis.smembers_(mail)

  res.send(ids.join('\n') + '\n')
}

/**
 * Wait endpoint.
 * Wait until id and mail are verified.
 */
const wait = async (redis, ws, id, mail) => {
  let timeout = true
  t0 = +new Date

  while (+new Date - t0 < 60 * 1000) {
    const isMember = await redis.sismember_(mail, id)

    if (isMember) {
      timeout = false
      break
    }

		await sleep(1000)
  }

  if (timeout)
    await ws.send('to')
  else
    await ws.send('ok')
}

/**
 * Stream endpoint.
 * Incoming chat events e.g. publish and subscribe requests.
 */
const pull = async (c, ws) => {
  ws.on('message', async (data) => {
    let list = data.split('|'),
        args = list.splice(0, 1),
        rest = list.join('|')

    const [ action ] = args

    if (action === CHAT_KEY_NOTIFY) {
      const [ person ] = rest.split('|', 1)

      if (!(person in observers))
        observers[person] = []

      observers[person].push(ws)

    } else if (action === CHAT_KEY_SUB) {
      const [ uid, seq ] = rest.split('|', 2)

      msgs = await fetch(c, uid, +seq)

      for (const [ msg, seq ] of msgs)
        ws.send(`${CHAT_KEY_MSG}|${uid}|${seq}|${msg}`)

      if (!(uid in clients))
        clients[uid] = []

      clients[uid].push(ws)

    } else if (action === CHAT_KEY_UNSUB) {
      const [ uid ] = rest.split('|', 1)

      if (uid in clients) {
        clients[uid].splice(clients[uid].indexOf(ws), 1)

        if (!clients[uid].length)
          delete clients[uid]
      }
    } else if (action == CHAT_KEY_PUB) {
      list = rest.split('|'),
      args = list.splice(0, 1),
      rest = list.join('|')

      const [ uid ] = args

      await insert(c, uid, rest)
    }
  })

  ws.on('close', () => {
    for (const uid in clients) {
      const index = clients[uid].indexOf(ws)
      if (~index)
        clients[uid].splice(index, 1)
      if (!clients[uid].length)
        delete clients[uid]
    }

    for (const person in observers) {
      const index = observers[person].indexOf(ws)
      if (~index)
        observers[person].splice(index, 1)
      if (!observers[person].length)
        delete observers [person]
    }
  })
}

/**
 * WebSocket pusher.
 * Push chat messages to clients.
 */
const push = (uid, seq, msg) => {
  if (uid in clients)
    for (const ws of clients[uid])
      ws.send(`${CHAT_KEY_MSG}|${uid}|${seq}|${msg}`)
}

/**
 * WebSocket pusher.
 * Notify clients of changes related to a identity.
 */
const notify = (channel, identity) => {
  if (identity in observers)
    for (const ws of observers[identity]) {
      const result = getInfo(identity) // todo append this info on the msg
      ws.send(CHAT_KEY_REFRESH)
    }

  if (channel in clients)
    for (const ws of clients[channel]) {
      const result = getInfo(identity) // todo append this info on the msg
      ws.send(CHAT_KEY_REFRESH)
    }
}


/**
 * Insert message into persistent storage.
 *
 * uid: the unique identifier of the target of the message
 * msg: the actual message text
 * key: a client side generated unique message identifier to eliminate duplicates
 */
const insert = async (c, uid, msg, key) => {
  // if not key is provided, generate one
  key = key || uuid()

  try {
    // atomic increment sequence, then check-in message
    const result = await r
      .table('count')
      .get(uid)
      .replace(
        { id: uid, seq: r.row('seq').add(1).default(2) },
        { returnChanges: true })
      .do((result) => result('changes')(0)('new_val')('seq'))
      .do((seq) => r
        .table('queue')
        .insert(
          { id: key, msg, uid, seq },
          { returnChanges: true }))
      .run(c)

      // always ack

    if (result['errors'])
      console.log('desired write fail: ' + result['first_error'])

  } catch (err) {
    console.log('undesired write failed: ' + err)
  }
}

/**
 * Listen for new messages in the db.
 */
const listen = async (c) => {
  const feed = await r
    .table('queue')
    .changes()
    .run(c)

  let change

  while (change = await feed.next()) {
    const { msg, uid, seq } = change['new_val']
    push(uid, seq, msg)
  }
}

/**
 * Select messages from the db
 */
const select = async (c, uid, start, length) => {
  start = start || 0
  length = length || 1000

  const feed = await r
    .table ('queue')
    .orderBy({ index: r.desc('order') })
    .between(
      [ uid, start ],
      [ uid, r.maxval ],
      {index: 'order'})
    .limit(length).run(c)

  const rows = []

  for (;;)
    try {
      const change = await feed.next()
      rows.unshift(change)
    } catch (err) {
      break 
    }

  return rows
}

/**
 * Fetch message history since the given point in time.
 */
const fetch = async (c, uid, current) => {
  const msgs = []
  let result = await select(c, uid, current)
  const length = result.length

  if (current === 0 && length === 0)
    msgs.push([ null, 1 ])

  else if (current === 0)
    msgs.push([ null, result[length - 1]['seq'] ])

  else if (current === 1 && length === 0)
    msgs.push([ null, 1 ])

  else if (length === 0 || length === 1 && current === result[0]['seq']) {
    if (length === 0) {
      result = await select(uid, 0, 1)
      if (result.length === 0)
        result = [ { 'seq': 1 } ]
    }
    msgs.push([ null, result[0]['seq'] ])
  }

  else {
    if (current === result[0]['seq'])
      result.pop(0)
    for (const row of result)
      msgs.push([ row['msg'], row['seq'] ])
  }

  return msgs
}

/**
 * Main routine.
 * Connect services and setup routes.
 */
(async () => {
  // make redis client awaitable
  bluebird.promisifyAll(redis.RedisClient.prototype, { suffix: '_' })
  bluebird.promisifyAll(redis.Multi.prototype, { suffix: '_' })

  // rethink connection loop
  const openRethink = async () => {
    for (;;)
      try {
        console.log('Connecting realtime db..')
        return await r.connect(RETHINK_HOST, RETHINK_PORT)
      } catch(err) {
        await sleep(1000)
      }
  }

  // redis connection loop
  const newRedis = () => new Promise((resolve) => {
    console.log('Connecting key-value store..')
    const client = redis.createClient(REDIS_PORT, REDIS_HOST)
    client.on('connect', resolve.bind(null, client))
    client.on('error', () => console.log('Connecting key-value store..'))
  })

  // perform connection loops in parallel
  const work = [ openRethink(), newRedis(), newRedis() ]
  const [ c, client, sub ] = await Promise.all(work)

  console.log('Did connect.')
  console.log('Will setup db.')

  // create database if not exists
  try {
    await r.dbCreate('hyker').run(c)
  } catch(err) {}

  // use database
  c.use('hyker')

  // create table queue if not exists
  try {
    await r.tableCreate('queue').run(c)
  } catch(err) {}

  // create table count with indexes if not exists
  try {
    await r.tableCreate('count').run(c)
    await r
      .table('queue')
      .indexCreate('order', [ r.row('uid'), r.row('seq') ])
      .run(c)
  } catch(err) {}

  console.log('Did setup db.')

  // error layer to catch and handle exceptions
  const errLayer = (f) => async (res, rep, next) => {
    try {
      await f(res, rep)
    } catch (err) {
      next(err) 
    }
  }

  // setup routes
  const app = express()
  app.use(cors())
  app.use(bodyParser.urlencoded({ extended: true }))
  app.get('/add/:channel/:id', add)
  app.get('/del/:channel/:id', del)
  app.get('/get/:id', get)
  app.post('/reg', errLayer(reg.bind(null, client)))  
  app.get('/verify/:code', errLayer(verify.bind(null, client)))  
  app.get('/show/:mail', errLayer(show.bind(null, client)))  
	app.use((err, req, res, next) => {
		res.status(400).send(err)
	})

  // start server
  const server = http.createServer(app)
  new WebSocket.Server({ server }).on('connection', (ws, req) => {
    const route = url.parse(req.url).pathname
		if (route.startsWith('/wait')) {
			const [ mail, id ] = route.split('/').slice(-2)
			wait(client, ws, id, mail)
		} else
			pull(c, ws)
  })

  await sleep(5000)

  await server.listen(1337)

  console.log(`listening on ${server.address().port}`)

  // listen for changes at rethink
  await listen(c)
})()

/**
 * Auxiliary get channels of member.
 */
const getInfo = (identity) => {
  const result = {}
  for (const channel in channels)
    if (~channels[channel].indexOf(identity))
      result[channel] = channels[channel]
  return result
}

/**
 * Auxiliary send mail function.
 * Performs REST api call to mail gun.
 */
const sendMail = async (to, code) => {
  const url = MAIL_VERIFY_URL.replace('`code`', code)
  const html = mailTmpl.replace('`location`', url)
  const form = { from: MAIL_FROM, to, subject: MAIL_SUBJ, html }
  await request.post(MAIL_MG_URL).auth('api', MAIL_MG_KEY).form(form)
}

/**
 * Auxiliary sleep function.
 */
const sleep = (ms) => new Promise(ok => setTimeout(ok, ms))
