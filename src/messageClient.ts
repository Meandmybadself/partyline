import { Document } from 'mongoose'
import { ObjectId } from 'mongodb'
import { Request, Response } from 'express'

import moment from 'moment'
import mongoose from 'mongoose'
import Twilio from 'twilio'

const twilio = Twilio(process.env.ACCOUNT_SID, process.env.ACCOUNT_TOKEN)

interface IUser extends Document {
  phonenumber: string
  enabledUntil: Date
  role: string
}

interface IMessage extends Document {
  body: string
  authorId: ObjectId
  createdAt: Date
}

const getUserModel = () => mongoose.model('User')
const getMessageModel = () => mongoose.model('Message')

const getActiveUserNumbers = async (userToExclude: IUser): Promise<IUser[]> =>
  getUserModel()
    .find({ _id: { $ne: userToExclude._id }, enabledUntil: { $lt: moment().endOf('day') } }, { phonenumber: 1 })
    .lean<IUser>()

const broadcastMessage = async (body: string, authorId: IUser) => {
  const activeUsers: IUser[] = await getActiveUserNumbers(authorId)

  // Persist this message.
  await getMessageModel().create({ body, authorId })

  await Promise.all(activeUsers.map(({ phonenumber }) => sendMessage(body, phonenumber)))
}

const catchEmUp = async (user: IUser) => {
  const messages: IMessage[] = await getMessageModel()
    .find({
      createdAt: {
        $gte: moment()
          .startOf('day')
          .toDate(),
      },
      authorId: {
        $ne: user._id,
      },
    })
    .sort({
      createdAt: 1,
    })
    .lean<IMessage>()

  return Promise.all(messages.map((message: IMessage) => sendMessage(message.body, user.phonenumber)))
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

export const receiveMessage = async (req: Request, res: Response) => {
  const From: string = req.body.From
  const Body: string = req.body.Body.trim()

  // Load user
  const user: IUser = await getUserModel()
    .findOneAndUpdate({ phonenumber: From }, {}, { upsert: true, new: true })
    .lean<IUser>()

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
      await getUserModel().findOneAndUpdate(
        { _id: user._id },
        {
          $set: {
            enabledUntil: moment()
              .endOf('year')
              .toDate(),
          },
        }
      )
      await catchEmUp(user)
      break
    case 'stop':
    case 'off':
    case 'mute':
    case '0':
      await sendMessage(STOP_MESSAGE, From)
      break
    case 'day':
      await sendMessage(START_MESSAGE, From)
      await getUserModel().findOneAndUpdate(
        { _id: user._id },
        {
          $set: {
            enabledUntil: moment()
              .endOf('day')
              .toDate(),
          },
        }
      )
      // Send any messages from the start of the day.`
      await catchEmUp(user)
      break
    default:
      // Store & propagate.
      if (normalizedMessage.length > 5) {
        broadcastMessage(Body, user)
      }
      await sendMessage(SENT_MESSAGE, user.phonenumber)
      break
  }

  res.status(200).json({ msg: 'ok' })
}
