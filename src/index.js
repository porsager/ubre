import Ubre from './ubre.js'
import { client, server } from './websocket.js'

Ubre.ws = client
Ubre.wss = server

export default Ubre
