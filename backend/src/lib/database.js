import mongoose from 'mongoose'

export async function connectDatabase() {
  const databaseUri = process.env.MONGODB_URI

  if (!databaseUri) {
    throw new Error('MONGODB_URI is required')
  }

  await mongoose.connect(databaseUri, {
    dbName: process.env.MONGODB_DB || undefined,
  })
}