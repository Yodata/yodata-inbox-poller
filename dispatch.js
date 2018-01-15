const EventEmitter = require('events').EventEmitter;
const assert = require('assert');

const defaultLogger = require('debug')('yodata');

const _logger = {
  inbox:    require('debug')('yodata:inbox'),
  serivce:  require('debug')('yodata:service'),
  message:  require('debug')('yodata:message'),
  response: require('debug')('yodata:response'),
  error:    require('debug')('yodata:error')
};

const debug = event => {
  let {type} = event;
  if (type) {
    let logName = type.substring(0, type.indexOf(':'));
    let sendToLog = _logger[logName] || defaultLogger;
    sendToLog(event);
  }
  return event;
};


class Dispatch extends EventEmitter {
  constructor() {
    super();
    this._debug = debug;
  }

  _dispatch(event) {
    if (event && event.type) {
      this.emit('dispatch', event);
      this._debug(event);
    }
    return event;
  }

  send(type, value, error) {
    assert.ok(type, 'type is required');
    let event = {type};
    if (value) event.value = value;
    if (error) event.error = error;
    return this._dispatch(event);
  }

  error(type, error, value) {
    assert.ok(type, 'type is required');
    let event = {type};
    if (error) {
      event.error = (typeof error === 'string')
          ? new Error(error)
          : error;
    }
    if (value) event.value = value;
    return this._dispatch(event);
  }

  event(event) {
    assert.ok(event, 'event is required');
    if (typeof event === 'string') {
      this.emit('dispatch', {type: event});
      return {type: event};
    }
    assert.ok(event.type, 'event.type is required');
    return this._dispatch(event);
  }
}

const dispatch = new Dispatch();

module.exports = dispatch;
