"use strict";
const EventEmitter = require("events").EventEmitter;
const assert = require("assert-plus");
const forever = require("async/forever");
const auto = require("auto-bind");
const Inbox = require("./inbox");
const {
  SERVICE_START,
  SERVICE_STOP,
  INBOX_EMPTY,
  INBOX_FETCH_COMPLETED,
  MESSAGE_PROCESS_COMPLETED,
  MESSAGE_PROCESS_FAILED,
  SERVICE_PROCESS_COMPLETED,
  SERVICE_PROCESS_START,
  SERVICE_STOP_COMPLETED,
  SERVICE_PROCESS_FAILED,
  RESPONSE_PROCESS_COMPLETED,
  RESPONSE_PROCESS_FAILED
} = require("./constants");

class Poller extends EventEmitter {
  constructor(options = {}) {
    super();
    assert.ok(options.inboxURL, "inboxURL is required");
    assert.ok(options.handleMessage, "handleMessage is required");
    this.inboxURL = options.inboxURL;
    this.handleMessage = options.handleMessage;
    this.waitTimeSeconds = options.waitTimeSeconds || 5;
    this.inbox = options.inbox || new Inbox({inboxURL: this.inboxURL});
    this.stopped = true;
    this.emitEventTypes = true;
    auto(this);
  }

  static create(inboxURL, handleMessage, options) {
    return new Poller(Object.assign({}, {inboxURL, handleMessage}, options));
  }

  dispatch(event) {
    assert.ok(event, 'dispatch.event');
    this.emit('dispatch', event);
    if (this.emitEventTypes)
      this.emit(event.type, event);
    return event;
  }

  stop(result) {
    if (!this.stopped) {
      this.stopped = true;
      this.dispatch({type: SERVICE_STOP, result})
    }
  }

  start() {
    if (this.stopped) {
      this.stopped = false;
      this.dispatch({type: SERVICE_START, startTime: Date.now()});
      forever(this.run, this._exit);
    }
  }

  _exit(error, result) {
    this.dispatch({type: SERVICE_STOP_COMPLETED, error, result});
  }

  run(next) {
    try {
      assert.ok(!this.stopped, 'service:stopped');
      this.dispatch({type: SERVICE_PROCESS_START, startTime: Date.now()});
      this.inbox.get()
          .then(inboxFetchResponse => this.dispatch(inboxFetchResponse))
          .then(this._processResponse)
          .then(this.wait(next))
          .catch(event => {
            this.dispatch({type: SERVICE_PROCESS_COMPLETED, result: event});
            this.wait(next)(event);
          });
    } catch (error) {
      error.type = error.type || SERVICE_PROCESS_FAILED;
      this.dispatch(error);
      this.stop(error);
      next(error);
    }
  }

  async _processMessage(message) {
    try {
      return this.dispatch({
        type:   MESSAGE_PROCESS_COMPLETED,
        object: message,
        result: await this.handleMessage(message)
      });
    }
    catch (error) {
      throw this.dispatch({
        type:    MESSAGE_PROCESS_FAILED,
        object:  message,
        message: error.message,
        result:  {
          error: error
        }
      });
    }
  }

  /**
   * Processes all messages found in response.value.messages
   * @param inboxFetchResponse
   * @returns {Promise<*>}
   * @private
   * @event Poller#inbox:fetch:completed
   * @event Poller#inbox:fetch:failed
   * @event Poller
   *
   */
  async _processResponse(inboxFetchResponse) {
    try {
      let response = inboxFetchResponse.result;
      let messages = response.messages;
      let hasMessages = Array.isArray(messages) && messages.length > 0;
      let result = hasMessages && await Promise.all(messages.map(this._processMessage));
      return this.dispatch({
        type:   hasMessages ? RESPONSE_PROCESS_COMPLETED : INBOX_EMPTY,
        object: inboxFetchResponse.result,
        result
      })
    } catch (error) {
      throw this.dispatch({
        type:   RESPONSE_PROCESS_FAILED,
        object: inboxFetchResponse.result,
        error:  error.message,
        result: {
          error: error
        }
      })
    }
  }

  wait(callback) {
    let service = this;
    return event => {
      if (event.type === RESPONSE_PROCESS_COMPLETED)
        callback(null, event);
      else {
        let waitTime = service.waitTimeSeconds * 1000;
        service.dispatch({type: 'service:wait', waitTime});
        setTimeout(() => callback(null, event), waitTime);
      }

    }
  }

}


module.exports = Poller;
