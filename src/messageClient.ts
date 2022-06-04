import { Document } from 'mongoose'
import { ObjectId } from 'mongodb'
import { Request, Response } from 'express'

import moment from 'moment'
import mongoose from 'mongoose'
import Twilio from 'twilio'
import { get } from 'lodash'

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
  user: IUser
}

const getUserModel = () => mongoose.model('User')
const getMessageModel = () => mongoose.model('Message')

const getActiveUserNumbers = async (userToExclude: IUser): Promise<IUser[]> =>
  getUserModel()
    .find({ _id: { $ne: userToExclude._id }, enabledUntil: { $gte: moment().endOf('day') } }, { phonenumber: 1 })
    .lean<IUser>()

const broadcastMessage = async (body: string, author: IUser) => {
  const activeUsers: IUser[] = await getActiveUserNumbers(author)

  // Persist this message.
  await getMessageModel().create({ body, authorId: author._id })

  body = `${author.phonenumber}: ${body}`

  await Promise.all(activeUsers.map(({ phonenumber }) => sendMessage(body, phonenumber)))
}

const catchEmUp = async (user: IUser) => {
  const messages: IMessage[] = await getMessageModel()
    .aggregate()
    .match({
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
    .lookup({
      from: 'users',
      localField: 'authorId',
      foreignField: '_id',
      as: 'user',
    })

  return Promise.all(messages.map((message: IMessage) => broadcastMessage(message.body, message.user)))
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
const STOP_MESSAGE = `🔇`

const subscribe = async (user: IUser): Promise<void> => {
  await getUserModel().findOneAndUpdate(
    { _id: user._id },
    {
      $set: {
        enabledUntil: moment()
          .startOf('day')
          .toDate(),
      },
    }
  )
}

export const receiveMessage = async (req: Request, res: Response) => {
  const from: string = req.body.From
  const body: string = get(req, 'body.Body', '').trim()

  console.log(`receiveMessage - ${from}: ${body}`)

  // Load user
  const user: IUser = await getUserModel()
    .findOneAndUpdate({ phonenumber: from }, {}, { upsert: true, new: true })
    .lean<IUser>()

  // Is this a command?
  const normalizedMessage = body
    .trim()
    .toLowerCase()
    .replace(/[^\w|\s]+/g, '')

  switch (normalizedMessage) {
    case 'hi':
    case 'sup':
    case 'helpme':
    case '?':
      await sendMessage(HELP_MESSAGE, from)
      await subscribe(user)
      break
    case 'start':
    case 'on':
    case '1':
      await sendMessage(START_MESSAGE, from)
      // Send any messages from the start of the day.
      await subscribe(user)
      await catchEmUp(user)
      break
    case 'stop':
    case 'off':
    case 'mute':
    case '0':
      await sendMessage(STOP_MESSAGE, from)
      await getUserModel().findOneAndUpdate(
        { _id: user._id },
        {
          $set: {
            enabledUntil: moment()
              .startOf('day')
              .toDate(),
          },
        }
      )
      break
    case 'day':
      await sendMessage(START_MESSAGE, from)
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
      broadcastMessage(body, user)
      break
  }

  res.status(200).json({ msg: 'ok' })
}
