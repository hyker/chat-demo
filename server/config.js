module.exports = {
  MAIL_VERIFY_URL: 'http://localhost:1337/verify/`code`',
  MAIL_MG_KEY: 'key-b98179aee2561cbc6c6d19cd14c3461a',
  MAIL_MG_URL: 'https://api.mailgun.net/v3/mail.hyker.io/messages',
  MAIL_FROM: 'HYKER <bot@mail.hyker.io>',
  MAIL_SUBJ: 'Paradocs id verification',
  MAIL_TMPL: 'template.html',
  RETHINK_HOST: 'rethink',
  RETHINK_PORT: 28015,
  REDIS_HOST: 'redis',
  REDIS_PORT: 6379,
}
