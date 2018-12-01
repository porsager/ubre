import Ubre from './ubre'
import { client, server } from './websocket'

Ubre.ws = client
Ubre.wss = server

export default Ubre
