# Micro project: seriously secure chat app.

![](https://media.giphy.com/media/Ag1HsRXVkcfYY/giphy.gif)

# TL;DR

* This is a end-to-end encrypted chat application.
* It uses public identites for recipient addresses.
* Its purpose is to demonstrate how to integrate HYKER functionality.

##### Launch!

    git clone git@github.com:hykersec/chat-demo.git

    cd chat-demo

    npm install
    
    docker-compose up -d
    
    npm start

## Abstract

In this micro project we will use HYKERs `RIKS` client to create a seriously secure instant messaging desktop application.

The project is more than an example of how to build an encrypted chat application, it highlights important problems and solutions e.g. _id management_ (aka how to know you talk to the _correct_ person).

> `RIKS` is an abbreviation for "Retroactive Interactive Key Sharing" and is HYKERs protocol and toolkit for implementing secure communication in systems that are distributed, dynamic and asynchronous.

## Ask a question

If you have any qestions of comments, please visit https://gitter.im/hykersec or open a [issue](https://github.com/hykersec/chat-demo/issues).

## HYKER service

This project comes pre-configured with HYKER free service. No account or other registration is needed.

## Prior knowledge

Readers that are new to the area are encouraged to look through the HYKER developer program (2 hours), or at least the included article about id management (20 min); [hyker.gitbooks.io/developer-program](https://hyker.gitbooks.io/developer-program). For introduction to RIKS, have a look at [hyker.gitbooks.io/docs/riks.html](https://hyker.gitbooks.io/docs/riks.html).

## Identities

HYKER `RIKS` makes encrypted communication in environments such as chat applications simple. RIKS also makes id management simpler by dealing with _cryptographic keys_ and _digital signatures_, and let you work with any string to represent a recipient. However, the application still has to make sure the _correct_ string representations are used.

> This will ensure that your service providers cannot access your users _information_, only handle their _data_.

There are many ways to achieve this:

* One way to ensure correct identities is to use something well-known as id, such as an email address. This is however impractical, because one would rather not _revoke_ a well-known id if e.g. a device is lost.

* Another impractical way would be to _meet_ your recipients in person and exchange identity information.

* A more practical solution might be to use a _central trusted entity_ such as a company db.

* Another practical solution would be to use _publicly verifiable identities_, using e.g. social media platforms.

###### In this project

In this project we will explore a solution combining a well-known id (representing a _user_) with a random unique id (representing a users _device_). These identities will be linked together, and the connections will be publicly verifiable. To do this, we will use GitHub as a central trusted entity. We will trust Github not to fiddle with our profiles, and to ensure that only we have access to our account. We will also build one central trusted entity ourselves, similar to a company db that contains of email addresses of employees.

That is, we will use _GitHub usernames_ and _email addresses_ as recipients in our chat app, but _decouple_ them from individual devices allowing us to revoke them should we want to (or allow a user to have multiple devices).

For each chat client, we will generate a random string and use it to identify that device. Then we ask the user to publish it on their GitHub profile page, or register it for them to the company db. The later will require authentication though a clicking a link in a verification email.

Later when someone wishes to decrypt our messages, we can grant them access (`RIKS` shares our key) after verifying their seemingly random identity using GitHub or the company db.

This can be done through a company db lookup or, a simple http request against `github.com` to find out if that id actually beings to a user account name we trust (if it's present in their profile).

This check can be done super simple yet securely since github.com uses ssl with a server certificate issued by an authority that our computers already trusts, making outsiders unable to intercept and alter our checks.

> This flow highlights an important and desirable property of HYKERs RIKS protocol, messages are distributed first and access is granted later.


This system possesses all characteristics we desire. The only ways we could get into trouble would be if _the user_ fails to remember his or hers pals github usernames or company email addresses correctly, or if github decides to become evil. A solution to the latter problem would be to use multiple trusted entities to verify the id of our pals devices, but we won’t do that in this example. There actually exists a service doing this called [keybase.io](https://keybase.io)


## Let's get to it

We will use [RethinkDB](https://www.rethinkdb.com/) for _message transport_ and [Electron](https://electron.atom.io/) as _application platform_. [React](https://facebook.github.io/react/) will be used for _view components_ and _application state_. [Redis](https://redis.io/) will power the company db.


### Prerequisites

* `node 6`
* `python # 2 or 3`
* `docker # and compose`
* `electron-forge # npm install -g electron-forge`


#### Frontend

A simple chat GUI has been put together for your convenience. (It was created with `electron-forge init my-new-project --template=react`)

```
git clone git@github.com:hykersec/chat-demo.git

cd chat-demo

npm install
```

The project contains a simple but complete chat UI with registration screen, channels and chat feed.

###### Quick overview

The GUI resides in the `src` folder in the `chat-demo` project.

| File | Type | Responsibility |
| ----------------- | ----- | ------------------------------- |
| `src/app.js` | app | entry point, app state |
| `src/login.js` | view | display login at first launch |
| `src/channels.js` | view | display channels in left column |
| `src/chat.js` | view | display chat feed and input box |
| `src/client.js` | logic | interact with backend |
| `src/verify.js` | logic | verify identities |


#### Backend

A simple chat backend powered by node _express_ and RethinkDB has been put together for your convenience. The backend handles realtime events related to chat functions as well as implements the company db.

Above project contains a simple docker setup containing all dependencies of the backed.

The backend resides in the `server/app.js` folder in the `chat-demo` project.

| Function | Type | Domain | DB | Action |
| ---------- | ---------- | ------ | ------- | ----------------------------------- |
| `add` | api route | Chat | Memory | Add member to channel |
| `del` | api route | Chat | Memory | Remove member from channel |
| `get` | api route | Chat | Memory | Get channels of member |
| `reg` | api route | Co. DB | Redis | Register id with email address |
| `verify` | api route | Co. DB | Redis | Verify mail account by code |
| `show` | api route | Co. DB | Redis | Get ids registered to email |
| `wait` | ws route | Co. DB | Redis | Wait until id and mail are verified |
| `pull` | ws route | Chat | Rethink | Incoming chat events e.g. pub & sub |
| `push` | ws push | Chat | Rethink | Push chat messages to clients |
| `notify` | ws push | Chat | Memory | Notify clients of changes |
| `insert` | logic | Chat | Rethink | Insert message into storage |
| `listen` | logic | Chat | Rethink | Listen for new messages in the db |
| `select` | logic | Chat | Rethink | Select messages from the db |
| `fetch` | logic | Chat | Rethink | Fetch messages since a given date |
| `getInfo` | util | Chat | Memory | Get channels of member |
| `sendMail` | util | Co. DB | | Send emails powered by MailGun |


#### Launch

Launch the backend:

```docker-compose up -d```

Launch the frontend:

```npm start```

Launch parallel apps by cloning the repo again in an other location.

### End-to-end encryption

Now it is time to add encrypted channels to the chat app. Before this doing this, let's look at some concepts and limitations.

In _this_ example we have chosen a design where communication is _one-to-many_, but trust is _one-to-one_ (and possibly _one-way_).

That means that a user can join any channel and start to put messages into it. All other users subscribing to that same channel will now receive those messages. However, this does not mean that they can read (decrypt) them.

###### Whitelist

For that to happen, a trust relation must be established. Luckily, with `RIKS`, this is simple; all that must be done is to put my trusted pals usernames into a _whitelist_ that is kept local in the chat app.

###### Key request and response

When some device receives my message, `RIKS` will send a _key request_ to my device. If his identity is present in my whitelist, a _key response_ will occur and he can decrypt the message.

###### Well-known user id vs. unique device id

`RIKS` operates on the device level and only knows about identities of devices. However, we would like to use well-known identities everywhere in our app since these are the ones we recognise. This means out whitelist will contain well-known user identities.

But when a key request arrives, it will reference one of those unique strings representing the device. This is why we are clever when constructing the id. We start of with the well-known identity and prepend a random unique sufix. This way, when we handle a key request we instantly know both the device id and which user it belongs to. All that is left is to verify the connection between the two using the method described earler.

###### Limitations

Limitations to this example:

* The whitelist implementation is simplistic. Entries are automatically added to the whitelist as the app becomes aware of new identities. The user may then set the value of a entry to ether `ALLOW` or `DENY`.

* `ALLOW` is the default value of a new entry if the app discovers the identity as the user explicitly adds it to a channel.
* `DENY` is the default value of a new entry if the app discovers the identity from any other way e.g. some other user adds itself to a some channel.

* In this example we will implement _reactive_ access control, meaning sharing keys upon request. However, one may easily implement _proactive_ access control which involves `preshare` of keys.

### HYKER Integration

Now we know enough to integrate HYKER into a existing data flow. With our strategy outlined above integration becomes straight forward. The app will interact with HYKER at three places:

* Whitelist
* Ecryption
* Decryption

There is one more piece of the puzzle, but technically HYKER out of scope:

* Id verification

Let's go through them one by one.

#### Id verification

Let's start with id verification, since these functions are used when defining the whitelist.

```js
const verifyEmailAccount = async (id, mail) => {
  const url = `http://${CHAT_URL}/${CHAT_END_SHOW}/${mail}`
  const body = await fetch(url).then(res => res.text())
  return body.includes(id)
}

const verifyGithubAccount = async (id, username) => {
  const url = `https://api.github.com/users/${username}?_=${+new Date}`
  const data = await fetch(url).then(res => res.json())
  if (!data.bio)
    throw 'no such user'
  return data.bio.includes(id)
}
```


#### Whitelist

Our whitelist is very simple in construction. For every incoming key request we will look through our entries.
If we find a match and the setting is `ALLOW`, we proceed to verify the id. Otherwise, we reject the key request.

The whitelist is provided to the `RiksKit` object through its constructor. Here we also construct our own id that
will be used in whitelists of other users.

```js
// construct device id from name and random id
const deviceId = '#' + btoa(name + '|' + id).replace(/=/g, '')
const password = 'password' // mock password

// init the crypto
this.crypto = new RiksKit(deviceId, password, store, (did, ns) => {

  // conveniently, the name (well-known) is part of id
  const [ name, id ] = atob(did.substring(1)).split('|')

  // deny if name not in whitelist
  if (!this.state.whitelist[name])
    return false

  // verify relation between id and name
  if (name.startsWith('gh:'))
    return verifyGithubAccount(id, name.substring(3))
  else
    return verifyEmailAccount(id, name)
})
```

#### Encryption

Encryption is super stright forward. Just pass the data through the `encrypt` method before handing it over to the WebSocket.

```js
publishMessage = async (text, channel) => {
  text = await this.crypto.encrypt(text, channel) // inject encrypt
  this.client.publish(channel, text)
}
```

#### Decryption

```js
this.client.onMessage(async ({ channel, sequence, name, text }) => {
  text = await this.crypto.decrypt(text) // inject decrypt
  this.state.messages[this.state.channel].push({ name, text })
})
```

Decryption is equally straigt forward. Just like before we pass the chiper text arriving from the WebSocket through the `decrypt` method.

Thats all folks. Now you should know how to build a seriously secure chat app.

If you have any qestions of comments, please visit https://gitter.im/hykersec or open a [issue](https://github.com/hykersec/chat-demo/issues).
