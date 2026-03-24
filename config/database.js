const { mongoose } = require("mongoose");

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/chat-app";

    await mongoose.connect(uri);

    // Legacy cleanup: remove username index if present.
    // This app no longer uses username.
    try {
      await mongoose.connection.db.collection("users").dropIndex("username_1");
      console.log("ℹ Removed legacy users.username_1 index");
    } catch (error) {
      // Ignore "index not found" and continue startup
    }

    console.log("✔ MongoDB Connected");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    throw error;
  }
};

module.exports = connectDB;
