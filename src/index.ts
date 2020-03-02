import express from 'express'
import { config } from 'dotenv'
import { receiveMessage } from './messageClient'

config({ path: './.env' })

import Message from './models/message'
import User from './models/user'

const initializeModels = () => {
  new Message()
  new User()
}

export default initializeModels

const app = express()
app.get('/', (req, res) => res.send('Partyline'))
app.post('/')

app.listen(process.env.PORT)
console.log('')
console.log('=============================')
console.log('🥳 partyline')
console.log('-----------------------------')
console.log(`${process.env.APP_URL}:${process.env.APP_PORT}/`)
console.log('')
