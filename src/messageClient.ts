import mongoose from 'mongoose'
import { Document } from 'mongoose'
import Twilio from 'twilio'
import { Request, Response, NextFunction } from 'express'
import moment from 'moment'

const twilio = Twilio(process.env.ACCOUNT_SID, process.env.ACCOUNT_TOKEN)

const getUserModel = () => mongoose.model('User')

const getActiveUserNumbers = async (): Promise<Document[]> =>
  getUserModel().find({ enabledUntil: { $lt: moment().endOf('day') } }, { phonenumber: 1 })

const broadcastMessage = async (message: string) => {
  const activeUsers: Document[] = await getActiveUserNumbers()
  await Promise.all(activeUsers.map(({ phonenumber }) => sendMessage(message, phonenumber)))
}

const sendMessage = async (body: string, to: string) =>
  twilio.messages.create({
    body,
    to,
    from: process.env.PHONE_NUMBER,
  })

const HELP_MESSAGE = `Commands:
* help - This message
* start - Receive messages
* mute - Mute messages
* day - Receive messages until the end of the day`
const START_MESSAGE = `👂`
const STOP_MESSAGE = `🤐`
const SENT_MESSAGE = `🚀`

export const receiveMessage = async (req: Request, res: Response, next: NextFunction) => {
  const From: string = req.body.From
  const Body: string = req.body.Body.trim()

  // Load user
  const User = getUserModel().findOneAndUpdate({ phonenumber: From }, {}, { upsert: true, new: true })

  // Is this a command?
  const normalizedMessage = Body.trim()
    .toLowerCase()
    .replace(/[^\w|\s]+/g, '')

  switch (normalizedMessage) {
    case 'hi':
    case 'help':
    case '?':
      await sendMessage(HELP_MESSAGE, From)
      break
    case 'start':
    case 'on':
    case '1':
      await sendMessage(START_MESSAGE, From)
      // Send any messages from the start of the day.

      // await Promise.all()
      break
    case 'stop':
    case 'off':
    case 'mute':
    case '0':
      await sendMessage(STOP_MESSAGE, From)
      break
    case 'day':
      await sendMessage(START_MESSAGE, From)
      // Send any messages from the start of the day.
      // await Promise.all()
      break
    default:
      // Store & propagate.
      if (normalizedMessage.length > 5) {
        broadcastMessage(Body)
      }
      await sendMessage(SENT_MESSAGE, From)
      break
  }

  res.status(200).json({ msg: 'ok' })
}
