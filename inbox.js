const assert = require('assert-plus');
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
    let response;
    try {
      response = await this._inbox.get(url);
      assert.ok(response.status < 400, 'inbox.response.status');
      assert.array(response.data.contains, 'inbox.response.contains');
      return {
        type:   'inbox:fetch:completed',
        object: url || this.inboxURL,
        result: {
          status:     response.status,
          statusText: response.statusText,
          messages:   response.data.contains
        }
      };
    }
    catch (error) {
      response = error.response || response;
      throw {
        type:   'inbox:fetch:failed',
        object: url || this.inboxURL,
        error:  error.message,
        result: {
          status:     response && response.status,
          statusText: response && response.statusText,
        }
      };
    }
  }
}

module.exports = Inbox;
