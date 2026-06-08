import mongoose from "mongoose";

let connectionPromise;

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
  }

  try {
    await connectionPromise;
    console.log("MongoDB connected");
    return mongoose.connection;
  } catch (error) {
    connectionPromise = undefined;
    console.error("MongoDB connection error", error);
    throw error;
  }
};

export default connectDB;
