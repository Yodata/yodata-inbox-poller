const Inbox = require('../inbox');

const inboxURL = 'some-url';
const message1 = {
  id:         'a',
  type:       'Notification',
  instrument: 'message-instrument',
  target:     'message-target',
  object:     {
    type: 'action-type'
  }
};
const message2 = {
  id:         'b',
  type:       'Notification',
  instrument: 'message-instrument',
  target:     'message-target',
  object:     {
    type: 'action-type'
  }
};

const axiosGetOutput = {
  status:     200,
  statusText: 'OK',
  request:    {
    url: inboxURL
  },
  response:   {
    headers: {}
  },
  data:       {
    id:       inboxURL,
    contains: [message1, message2]
  }
};
const axiosPostOutput = {
  status:     200,
  statusText: 'accepted'
};
const axiosDeleteOutput = {
  status:     200,
  statusText: 'accepted'
};
const mockInbox = {
  get:    jest.fn()
              .mockName('_inbox:get')
              .mockReturnValue(Promise.resolve(axiosGetOutput)),
  post:   jest.fn()
              .mockName('_inbox:post')
              .mockReturnValue(Promise.resolve(axiosPostOutput)),
  delete: jest.fn()
              .mockName('_inbox:delete')
              .mockReturnValue(Promise.resolve(axiosDeleteOutput))
};
module.exports = options => new Inbox({...options, inbox: mockInbox});
