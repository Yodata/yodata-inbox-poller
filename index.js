"use strict";
const {
  SERVICE_START,
  SERVICE_PROCESS_START,
  INBOX_FETCH_FAILED,
  INBOX_EMPTY,
  INBOX_FETCH_COMPLETED,
  MESSAGE_PROCESS_FAILED,
  MESSAGE_PROCESS_COMPLETED,
  SERVICE_PROCESS_FAILED,
  SERVICE_PROCESS_COMPLETED,
  SERVICE_STOP,
  SERVICE_STOP_COMPLETED,
  RESPONSE_PROCESS_FAILED,
  RESPONSE_PROCESS_COMPLETED
} = require("./constants");

const EventEmitter = require("events").EventEmitter;
const Inbox = require("./inbox");
const forever = require("async/forever");
const auto = require("auto-bind");
const assert = require("assert");
const dispatch = require("./dispatch");

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
    dispatch.on("dispatch", event => this._handleDispatch(event));
    auto(this);
  }

  static create(inboxURL, handleMessage, options) {
    return new Poller({inboxURL, handleMessage, ...options});
  }

  stop(error, value) {
    if (!this.stopped) {
      this.stopped = true;
      dispatch.event({
        type:      SERVICE_STOP,
        startTime: Date.now(),
        error,
        value
      });
    }
    return this;
  }

  start() {
    if (this.stopped) {
      this.stopped = false;
      dispatch.event({type: SERVICE_START, startTime: Date.now()});
      forever(this.run, this._exit);
    }
    return this;
  }

  run(next) {
    if (this.stopped) {
      next(new Error(SERVICE_STOP));
    } else {
      let startEvent = dispatch.event({
        type:      SERVICE_PROCESS_START,
        startTime: Date.now()
      });
      this._poll()
          .then(this._processResponse)
          .then(result => {
            let nextEvent = dispatch.event({
              ...startEvent,
              type:    SERVICE_PROCESS_COMPLETED,
              endTime: Date.now(),
              result:  result
            });
            if (result && result.type === RESPONSE_PROCESS_COMPLETED) {
              next(null, nextEvent);
            } else {
              this._wait(next, nextEvent);
            }
          })
          .catch(error => {
            let errorEvent = dispatch.event({
              type:    SERVICE_PROCESS_FAILED,
              endTime: Date.now(),
              error:   error
            });
            this.stop(error, errorEvent);
            next(error, errorEvent);
          });
    }
  }

  _handleDispatch(event) {
    if (event && event.type) {
      this.emit(event.type, event);
    }
  }

  /**
   * Fetches messages from inboxURL
   * @returns {Promise<void>}
   * @private
   */
  async _poll(url) {
    try {
      let response = await this.inbox.get(url);
      if (response.error) {
        let error = new Error(response.statusText);
        return dispatch.event({
          type:   INBOX_FETCH_FAILED,
          error:  error,
          result: response
        });
      } else {
        return dispatch.event({
          type: INBOX_FETCH_COMPLETED,
          result: response
        });
      }
    } catch (error) {
      return dispatch.event({
        type:  INBOX_FETCH_FAILED,
        error: error
      });
    }
  }

  async _processMessage(message) {
    try {
      let response = await this.handleMessage(message);
      return dispatch.event({
        type:   MESSAGE_PROCESS_COMPLETED,
        object: message,
        result: response
      });
    } catch (error) {
      return dispatch.event({
        type:   MESSAGE_PROCESS_FAILED,
        object: message,
        error:  error,
      });
    }
  }

  /**
   * Processes all messages found in response.value.messages
   * @param response
   * @returns {Promise<*>}
   * @private
   * @event Poller#inbox:fetch:completed
   * @event Poller#inbox:fetch:failed
   * @event Poller
   *
   */
  async _processResponse(response) {
    const processMessage = this._processMessage;
    if (response && response.type === INBOX_FETCH_COMPLETED) {
      const {messages} = response.result;
      if (Array.isArray(messages)) {
        if (messages.length === 0) {
          return dispatch.event({type: INBOX_EMPTY});
        } else {
          messages.forEach(processMessage);
          return dispatch.event({
            type:   RESPONSE_PROCESS_COMPLETED,
            result: {
              messagesProcessed: messages.length
            }
          });
        }
      } else {
        let error = new Error(
            "an unexpected error occurred while processing messages"
        );
        this.stop(dispatch.error(RESPONSE_PROCESS_FAILED, error, {messages}));
        throw error;
      }
    } else {
      return response;
    }
  }

  _wait(callback, data) {
    let waitTime = this.waitTimeSeconds * 1000;
    dispatch.send("service:wait", {waitTime});
    setTimeout(() => callback(null, data), waitTime);
  }

  _exit(error, value) {
    console.log("EXIT CALLED");
    dispatch.send(SERVICE_STOP_COMPLETED, value, error);
  }
}

module.exports = Poller;
