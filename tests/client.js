const Ubre = require('../lib')
const WS = require('ws')
const Pws = require('pws')

// Establish a reconnecting websocket.
const ws = new Pws('ws://localhost:3000', WS)

const ubre = Ubre({
  // Ubre will call send to have you forward it over your connection
  send: message => ws.send(message)
})

// When a message is received pass it on to ubre for handling
ws.onmessage = ({ target, data }) => ubre.message(data, target)

// Call open when a connection is established to send
ws.onopen = ubre.open

// Clean up pending requests and mark subscriptions as pending
ws.onclose = ubre.close

//
ubre.handle('authenticate', () => ({
  user: 'agge',
  password: 'mam'
}))

// Subscribe to the news topic
ubre.subscribe('news', news => {
  // Do things with the news
})

// Request /users
ubre.request('users').then(users => {
  // Do something with the users
})


/*
                                              ###
                                              ###
                                              ###
#####     ###       ###     ###########       ###    ###########      #############    #####
#   #     ###       ###     #############     ###    ############     #############    #   #
#####     ###       ###     ###        ###    ###    ###       ###    ###              #   #
#         ###       ###     ###       ###     ###    ###       ###    ###              #  ##
#         ###       ###     ##########        ###    ##########       #############    #### #
 ####     ###       ###     ##########        ###    #########        #############     ####
#         ###       ###     ###       ###     ###    ###   ###        ###              #
 ###      ###       ###     ###        ###    ###    ###     ###      ###               ###
    #      #############    #############     ###    ###       ###    #############        #
####        ########  ###   ###########       ###    ###        ###   #############    ####
                                              ###
                                              ###
                                              ###

*/
