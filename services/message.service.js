// const mongoose = require("mongoose");
// const Conversation = require("../models/Conversation.js");
// const Message = require("../models/Message.js");
// const { NotFoundError } = require("../utils/error/errors.js");

// const sendMessageService = async ({ conversationId, senderId, content }) => {
//   const session = await mongoose.startSession();

//   try {
//     session.startTransaction();

//     // 1️⃣ Check conversation exists
//     const conversation =
//       await Conversation.findById(conversationId).session(session);
//     if (!conversation) {
//       throw new NotFoundError("Conversation not found");
//     }

//     // 2️⃣ Check sender is a participant (via conversation participants array)
//     const isParticipant = conversation.participants.some(
//       (p) => p.toString() === senderId.toString(),
//     );
//     if (!isParticipant) {
//       throw new NotFoundError("User is not a participant of this conversation");
//     }

//     // 3️⃣ Create message
//     const message = await Message.create(
//       [
//         {
//           conversationId,
//           senderId,
//           content,
//         },
//       ],
//       { session },
//     );

//     // 4️⃣ Update conversation metadata
//     await Conversation.findByIdAndUpdate(
//       conversationId,
//       {
//         lastMessage: message[0]._id,
//         updatedAt: new Date(),
//       },
//       { session },
//     );

//     await session.commitTransaction();
//     session.endSession();

//     return message[0];
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     throw error;
//   }
// };

// module.exports = {
//   sendMessageService,
// };
