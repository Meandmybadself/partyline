import mongoose from 'mongoose'
import { ObjectId } from 'mongodb'

const { Schema } = mongoose

const schema = new Schema(
  {
    body: { type: String, required: true, index: true },
    authorId: { type: ObjectId, required: true, ref: 'User' },
  },
  { timestamps: true }
)

const Message = mongoose.model('Message', schema)

export default Message
