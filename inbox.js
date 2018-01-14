const axios = require('axios');
const defaultHeaders = {'x-api-key': process.env.YODATA_API_KEY};

class Inbox {
  constructor(options) {
    this.inboxURL = options.inboxURL;
    this.headers = Object.assign({}, defaultHeaders, options.headers);
    this._inbox = options.inbox || axios.create({
      baseURL: this.inboxURL,
      timeout: 6000,
      headers: this.headers
    });
  }

  async get(url) {
    try {
      let {status, statusText, data} = await this._inbox.get(url);
      let messages = data && data.contains;
      if (messages) {
        return {status, statusText, messages}
      } else {
        return {status, statusText, error: new Error(`inbox response did not include data.contains`)}
      }
    }
    catch (error) {
      if (error.response) {
        let {status, statusText} = error.response;
        return {status, statusText, error}
      }
      else {
        return {error, statusText: error.message}
      }
    }
  }
}

module.exports = Inbox;
