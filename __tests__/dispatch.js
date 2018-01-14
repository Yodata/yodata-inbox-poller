const dispatch = require('../dispatch');
const expect = require("expect");

describe('dispatch', () => {
  let type, event, error, onDispatch;

  beforeEach(() => {
    type = 'something';
    event = {
      type:      'something:completed',
      startTime: Date.now(),
      endTime:   Date.now(),
      result:    {type: 'something:else:completed'}
    };
    error = {type: 'error-type', message: 'error-message'};
    onDispatch = jest.fn().mockName('onDispatch');
    dispatch.on('dispatch', onDispatch);
  });

  afterEach(() => {
    dispatch.removeAllListeners();
  });

  describe('.send', () => {

    test(`.send() => throws type is required`, () => {
      expect(() => dispatch.send()).toThrow('type is required');
    });

    test(`.send(type) => {type}`, () => {
      let response = dispatch.send(type);
      expect(response).toMatchObject({type});
      expect(onDispatch).toHaveBeenCalledTimes(1);
      expect(onDispatch).toHaveBeenCalledWith({type});
    });

    test(`.send(type) emits ('dispatch', {type})`, () => {
      dispatch.send(type);
      expect(onDispatch).toHaveBeenCalledWith({type});
    });

    test(`.send(type, 'string-value') => {type, value: string-value}`, () => {
      let value = 'string-value';
      let result = dispatch.send(type, value);
      expect(result).toMatchObject({type, value});
      expect(onDispatch).toHaveBeenCalledWith({type, value});
    });

    test(`.send(type, array) => {type, value: array}`, () => {
      let arrayValue = [1, 2, 3];
      let expected = {type, value: arrayValue};
      let response = dispatch.send(type, arrayValue);
      expect(response).toMatchObject(expected);
      expect(onDispatch).toHaveBeenCalledWith(expected);
    });


  });

  describe('.error', () => {
    let error, value, type, expected;

    beforeEach(() => {
      type = 'some:error:type';
      error = new Error('error-message');
      value = 'something:failed';
      expected = expect.objectContaining({
        type: expect.any(String),
        error: expect.any(Error)
      })
    });

    test(`.error(type, error, value)`, () => {
      let received = dispatch.error(type, error);
      expect(received).toMatchObject(expected);
      expect(onDispatch).toHaveBeenCalledWith(expected);
    });

    test(`.error type, auto creates error if string value is passed`, () => {
      expect(dispatch.error(type, 'error-type')).toMatchObject(expected);
    });

    test(`.error optional value property`, () => {
      expected = expect.objectContaining({type, value});
      expect(dispatch.error(type,undefined,value)).toMatchObject(expected);
    });
  });

  describe('.event', () => {

    test(`.event required arguments`, () => {
      expect(() => dispatch.event()).toThrow('event is required');
      expect(()=>dispatch.event({})).toThrow('event.type is required');
    });

    test(`.event(string) - dispatches/returns {type: string}`, () => {
      expect(dispatch.event(type)).toMatchObject({type});
      return expect(onDispatch).toHaveBeenCalledWith({type});
    });

    test(`dispatches event.type`, done =>  {
      let event = {type: 'foo'};
      dispatch.on('dispatch', value => {
        expect(value).toMatchObject(event);
        done();
      });
      dispatch.event(event);
    });

  })

});
