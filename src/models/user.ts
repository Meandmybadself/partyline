import mongoose from 'mongoose'

const { Schema } = mongoose

const schema = new Schema(
  {
    phonenumber: { type: String, required: true, index: true },
    enabledUntil: { type: Date, required: true, default: Date.now },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true }
)

const User = mongoose.model('User', schema)

export default User
