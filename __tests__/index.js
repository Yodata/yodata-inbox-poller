'use strict';
const expect = require('expect');
const sinon = require('sinon');

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
  RESPONSE_PROCESS_COMPLETED,
  RESPONSE_PROCESS_FAILED
} = require('../constants');

const Poller = require('..');
const inbox = jest.genMockFromModule('../inbox');

describe('Poller', () => {
  let service,
      handleMessage,
      inboxURL,
      waitTimeSeconds,
      pollerConfig,
      handleMessageResponse,
      inboxFetchResponseEmpty,
      message,
      messagea,
      messageb,
      pollResponse,
      processResponseResponse,
      processMessageResponse,
      inboxFetchResponse,
      inboxFetchErrorResponse;

  beforeEach(() => {
    messagea = {id: 'messagea', type: 'message'};
    messageb = {id: 'messageb', type: 'message'};
    pollResponse = {
      type:   INBOX_FETCH_COMPLETED,
      object: expect.any(String),
      result: {
        status:     200,
        statusText: 'OK',
        messages:   [messagea, messageb]
      }
    };
    inboxFetchResponse = {
      type:   INBOX_FETCH_COMPLETED,
      object: expect.any(String),
      result: {
        status:     200,
        statusText: 'OK',
        messages:   [messagea, messageb]
      }
    };
    inboxFetchErrorResponse = {
      type:   INBOX_FETCH_FAILED,
      object: expect.any(String),
      error:  expect.any(String),
      result: {
        status:     expect.any(Number),
        statusText: expect.any(String)
      }
    };
    inboxFetchResponseEmpty = {
      type:   INBOX_FETCH_COMPLETED,
      object: expect.any(String),
      result: {
        status:     200,
        statusText: 'OK',
        messages:   []
      }

    };
    processResponseResponse = {
      type: RESPONSE_PROCESS_COMPLETED
    };
    processMessageResponse = {
      type: MESSAGE_PROCESS_COMPLETED
    };
    handleMessageResponse = 'handle-message-response';
    handleMessage = jest.fn().mockReturnValue(Promise.resolve(handleMessageResponse));
    inboxURL = 'some-url';
    waitTimeSeconds = 1;
    pollerConfig = {
      inboxURL,
      inbox,
      handleMessage,
      waitTimeSeconds
    };
    service = new Poller(pollerConfig);
    service.emit = jest.fn();
  });

  describe('.create', () => {

    test(`.create(inboxURL, handleMessage)`, () => {
      let inboxURL = 'create-test';
      let handleMessage = () => 'create-test';
      let poller = Poller.create(inboxURL, handleMessage);
      expect(poller).toBeInstanceOf(Poller);
      expect(poller.inboxURL).toBe(inboxURL);
      expect(poller.handleMessage).toEqual(handleMessage);
    });

    test(`.contructor inboxURL is required`, () => {
      expect(() => new Poller()).toThrow('inboxURL is required');
    });

    test(`.contructor handleMessage is required`, () => {
      expect(() => new Poller({inboxURL})).toThrow(
          'handleMessage is required'
      );
    });
  });

  describe('.dispatch(event)', () => {
    let event;

    beforeEach(() => {
      service.emit = jest.fn();
      event = {type: 'event-type'}
    });

    test(`.dispatch() throws if event is not truthy`, () => {
      return expect(() => service.dispatch()).toThrow();
    });

    test(`.dispatch(event) emits ('dispatch', event)`, () => {
      service.emit = jest.fn();
      service.dispatch({type: 'test'});
      return expect(service.emit).toHaveBeenCalledWith('dispatch', {
        type: 'test'
      });
    });

    test(`.dispatch(event) returns event`, () => {
      let event = {type: 'test'};
      return expect(service.dispatch(event)).toMatchObject(event);
    });

    test(`emits (event.type, event) if service.emitEventTypes is true`, () => {
      service.emitEventTypes = true;
      service.dispatch(event);
      return expect(service.emit).toHaveBeenCalledWith(event.type, event);
    });

    test(`does not emit (event.type, event) if service.emitEventTypes is false`, () => {
      service.emitEventTypes = false;
      service.dispatch(event);
      return expect(service.emit).not.toHaveBeenCalledWith(event.type, event);
    });
  });

  describe('._processResponse', () => {

    test(`resolves to 'response:process:completed' on completion`, () => {
      return expect(service._processResponse(inboxFetchResponse)).resolves.toMatchObject({
        type:   RESPONSE_PROCESS_COMPLETED,
        object: inboxFetchResponse.result,
        result: expect.any(Array)
      })
    });

    test(`resolves to 'inbox:empty' when no messages are found`, async () => {
      return expect(service._processResponse(inboxFetchResponseEmpty)).resolves.toMatchObject({
        type: INBOX_EMPTY
      });
    });

  });

  describe('._processMessage', () => {

    test(`._processMessage resolves to message:process:completed`, async () => {
      return expect(service._processMessage(message)).resolves.toMatchObject({
        type:   MESSAGE_PROCESS_COMPLETED,
        object: message,
        result: 'handle-message-response'
      });
    });

    test(`._processMessage rejects with message:process:failed when handler rejects`, async () => {
      service.handleMessage = sinon.stub().rejects({type: 'error-type', object: message});
      return expect(service._processMessage(message)).rejects.toMatchObject({
        type:   MESSAGE_PROCESS_FAILED,
        object: message
      });
    });

    test(`._processMessage returns/emits message:process:failed when handler throws`, async () => {
      service.handleMessage = sinon.stub().throws('unexpected error');
      return expect(service._processMessage(message)).rejects.toMatchObject({
        type:   MESSAGE_PROCESS_FAILED,
        object: message
      });
    });
  });

  describe('.run(callback)', () => {

    beforeEach(() => {
      service.stopped = false;
    });

    test(`calls back with (error, result)`, done => {
      service.inbox.get = jest.fn().mockReturnValue(Promise.resolve(inboxFetchResponse));
      service.run(function(error, result) {
        expect(result).toMatchObject({type: RESPONSE_PROCESS_COMPLETED});
        done();
      });
    });

    test(`polling error does not exit`, done => {
      service.inbox.get = jest.fn().mockReturnValue(Promise.reject({type: INBOX_FETCH_FAILED}));
      service.run(function(error, result) {
        expect(result).toMatchObject({type: INBOX_FETCH_FAILED});
        done();
      });
    });

    test(`processing errors do not exit`, done => {
      service.inbox.get = jest.fn().mockReturnValue(Promise.resolve(inboxFetchResponse));
      service._processResponse = jest.fn().mockReturnValue(Promise.reject({type: RESPONSE_PROCESS_FAILED}));
      service.run((error, result) => {
        expect(result).toMatchObject({type: RESPONSE_PROCESS_FAILED});
        done();
      });
    });

    test('.run() does not wait if messages were processed', done => {
      let onWait = jest.fn().mockName('onWait');
      service.on('service:wait', onWait);
      service._processMessages = jest
          .fn()
          .mockReturnValue(Promise.resolve({type: RESPONSE_PROCESS_COMPLETED}));
      service.run((error, result) => {
        expect(onWait).not.toBeCalled();
        done();
      });
    });

    test(`.run() stops when processResponse throws an error`, () => {
      service._processResponse = sinon.stub().throws();
      service.run(function(error) {
        expect(error).toBeTruthy();
        expect(service.stopped).toBeTruthy();
        done();
      });
    });

    test(`exits with SERVICE_PROCESS_FAILED if service.stopped`, done => {
      service.stopped = true;
      service.run(function(error){
        expect(error.type).toMatch(SERVICE_PROCESS_FAILED);
        done();
      })
    });
  });

  describe('.stop', () => {

    beforeEach(() => {
      service.stopped = false;
    });

    test('.stop stops the poller polling for messages', () => {
      service.stop();
      expect(service.stopped).toBeTruthy();
    });

    test(`dispatches 'service:stop'`, () => {
      let stoppingEvent = {type: 'unexpectedError'};
      service.emitEventTypes = false;
      service.stop(stoppingEvent);
      return expect(service.emit).toHaveBeenCalledWith('dispatch', {type: SERVICE_STOP, result: stoppingEvent});
    });

  });

  describe('.start', () => {

    test(`.start - toggles .stopped`, done => {
      expect(service.stopped).toBeTruthy();
      service.dispatch = function(event) {
        if (event.type === SERVICE_START) {
          expect(service.stopped).toBeFalsy();
          done()
        }
      };
      service.start();
    });

    test(`.start - fires service:start`, async () => {
      service.dispatch = jest.fn();
      service.start();
      service.stop();
      return expect(service.dispatch).toHaveBeenCalledWith({
        type:      SERVICE_START,
        startTime: expect.any(Number)
      });
    });

    test(`.start - does not create additional workers if start is called more than once.`, () => {
      service.run = jest.fn();
      service.start();
      service.start();
      service.start();
      expect(service.run).toHaveBeenCalledTimes(1);
    });
  });

  describe('.wait()', () => {
    test(`does not wait if event.type is INBOX_EMPTY`, () => {
      service.dispatch = jest.fn(event => event);
      let callback = jest.fn();
      let event = {type: INBOX_EMPTY};
      service.wait(callback)(event);
      return expect(service.dispatch).not.toHaveBeenCalled();
    });
  });
  
  describe('.exit(error, result)', ()=>{
    test(`dispatches 'service:stop:completed' {error, result}`, () => {
      service.dispatch = jest.fn(event => event);
      let event = {type: 'event-type'};
      service._exit(event);
      return expect(service.dispatch).toHaveBeenCalledWith({type: SERVICE_STOP_COMPLETED, error: event})

    });
  })
});
