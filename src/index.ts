import { config } from 'dotenv'
import bodyParser from 'body-parser'
import express from 'express'
config({ path: './.env' })

import mongoose from 'mongoose'

mongoose
  .connect(process.env.DB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
    useCreateIndex: true,
  })
  .catch(error => console.log(error))

import initializeModels from './models'
initializeModels()

import { receiveMessage } from './messageClient'

const app = express()
app.use(bodyParser.urlencoded())
app.use(bodyParser.json())

app.get('/', (req, res) => res.send('Partyline'))
app.post('/', receiveMessage)
app.listen(process.env.PORT)
console.log('')
console.log('=============================')
console.log('🥳 partyline')
console.log('-----------------------------')
console.log(`${process.env.APP_URL}:${process.env.PORT}/`)
console.log('')
