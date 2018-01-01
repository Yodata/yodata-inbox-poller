'use strict';

const EventEmitter = require('events').EventEmitter;
const Inbox = require('./inbox');
const async = require('async');
const auto = require('auto-bind');
const debug = require('debug')('poller');
const requiredOptions = [
  'inboxURL',
  'handleMessage'
];

class InboxError extends Error {
  constructor() {
    super(Array.from(arguments));
    this.name = this.constructor.name;
  }
}

function validate(options) {
  requiredOptions.forEach((option) => {
    if (!options[option]) {
      throw new Error('Missing option [' + option + '].');
    }
  });
}

function isAuthenticationError(err) {
  return (err.statusCode === 403 || err.code === 'CredentialsError');
}

class Poller extends EventEmitter {
  constructor(options) {
    super();
    validate(options);

    this.inboxURL = options.inboxURL;
    this.handleMessage = options.handleMessage;
    this.stopped = true;
    this.waitTimeSeconds = options.waitTimeSeconds || 20;
    this.authenticationErrorTimeout = options.authenticationErrorTimeout || 10000;

    this.inbox = new Inbox({inboxURL: this.inboxURL});

    auto(this);
  }

  static create(options) {
    return new Poller(options);
  }

  start() {
    if (this.stopped) {
      debug('Starting poller');
      this.stopped = false;
      this._poll();
    }
  }

  stop() {
    debug('Stopping poller');
    this.stopped = true;
  }

  _poll() {
    if (!this.stopped) {
      debug('Polling for messages');
      this.inbox.get()
          .then(messages => this._handleInboxResponse(undefined, messages))
          .catch(this._handleInboxResponse);
    } else {
      this.emit('stopped');
    }
  }

  _handleInboxResponse(err, messages) {
    const poller = this;

    if (err) {
      this.emit('error', new InboxError('Get messages failed: ' + err.message));
    }

    if (messages && messages.length > 0) {
      async.each(messages, this._processMessage, () => {
        // start polling again once all of the messages have been processed
        poller.emit('response_processed');
        poller._poll();
      });
    } else if (messages && messages.length === 0) {
      this.emit('empty');
      this._poll();
    } else if (err && isAuthenticationError(err)) {
      // there was an authentication error, so wait a bit before repolling
      debug('There was an authentication error. Pausing before retrying.');
      setTimeout(this._poll.bind(this), this.authenticationErrorTimeout);
    } else {
      // there were no messages, so start polling again
      this._poll();
    }
  }

  _processMessage(message, cb) {
    const poller = this;

    this.emit('message_received', message);
    async.series([
      function handleMessage(done) {
        try {
          poller.handleMessage(message, done);
        } catch (err) {
          done(new Error('Unexpected message handler failure: ' + err.message));
        }
      },
      function deleteMessage(done) {
        poller._deleteMessage(message, done);
      }
    ], (err) => {
      if (err) {
        if (err.name === InboxError.name) {
          poller.emit('error', err, message);
        } else {
          poller.emit('processing_error', err, message);
        }
      } else {
        poller.emit('message_processed', message);
      }
      cb();
    });
  }

  _deleteMessage(message, cb) {
    cb();
  }
}

module.exports = Poller;