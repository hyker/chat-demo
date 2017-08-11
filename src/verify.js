import {
  CHAT_URL,
  CHAT_END_REG,
  CHAT_END_SHOW,
  CHAT_END_WAIT,
} from './consts'

/**
 * Email: verify account ownership.
 */
const verifyEmailAccount = async (id, mail) => {
  const url = `http://${CHAT_URL}/${CHAT_END_SHOW}/${mail}`
  const body = await fetch(url).then(res => res.text())
  return body.includes(id) 
}

/**
 * Github: verify account ownership.
 */
const verifyGithubAccount = async (id, username) => {
  const url = `https://api.github.com/users/${username}?_=${+new Date}`
  const data = await fetch(url).then(res => res.json())
  if (!data.bio)
    throw 'no such user'
  return data.bio.includes(id)
}

/**
 * Email: register id with email address.
 */
const registerEmail = async (id, mail) => {
	const resp = await fetch(`http://${CHAT_URL}/${CHAT_END_REG}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded', 
    },
    body: [
      `id=${encodeURIComponent(id)}`,
      `mail=${encodeURIComponent(mail)}`,
    ].join('&'),
  })

  if (!resp.ok)
    throw await resp.text()
}

/**
 * Email: wait for verification.
 * Connect a web socket and wait until verification notification.
 */
const waitVerify = (id, mail) => new Promise((resolve, reject) => {
  const ws = new WebSocket(`ws://${CHAT_URL}/${CHAT_END_WAIT}/${mail}/${id}`)
  ws.onmessage = msg => {
    ws.close()
    if (msg.data == 'to')
      reject('timeout waiting for verify')
    else
      resolve()
  }
  ws.onerror = e => {
    ws.close()
    reject(e)
  }
})

/**
 * Company db registration.
 */
const register = async (id, mail) => {
  const registered = await verifyEmailAccount(id, mail)
  if (registered)
    return

  await registerEmail(id, mail)
  await waitVerify(id, mail)
}

export { register, verifyEmailAccount, verifyGithubAccount }

