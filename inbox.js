const debug = require('debug')('poller');
const axios = require('axios');
const defaultHeaders = { 'x-api-key': process.env.YODATA_API_KEY };

class Inbox {
  constructor(options) {
    this.inboxURL = options.inboxURL;
    this.headers = Object.assign({}, defaultHeaders, options.headers);
    this._inbox = axios.create({
      baseURL: this.inboxURL,
      timeout: 6000,
      headers: this.headers
    });
  }

  async get() {
    let res = await this._inbox.get('/');
    let data = res && res.data;
    let messages = data && data.contains;
    if (Array.isArray(messages)) {
      // debug(`${messages.length} messages received from ${this.inboxURL}`);
      return messages;
    }
    throw new Error(res.statusText).statusCode = res.statusCode;
  }

  post(message) {
    return this._inbox.post('/', message).then(()=>{
      debug(`message posted to ${this.inboxURL}`);
      return true;
    });
  }
}

module.exports = Inbox;
