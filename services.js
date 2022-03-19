require("dotenv").config();
const axios = require("axios");

const {
  TOKEN,
  SERVER_URL,
  COLLECTION_ID,
  CONNECTION_STRING,
  ADMIN_ID,
  CHAT_ID,
} = process.env;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const { MongoClient, ObjectId } = require("mongodb");
const uri = CONNECTION_STRING;

const client = new MongoClient(uri);
const updateOrCreate = async (readerName, count, messageId) => {
  try {
    await client
      .db("news-read-count-db")
      .collection("data")
      .updateOne(
        { _id: ObjectId(COLLECTION_ID) },
        [
          {
            $set: {
              [`data.${readerName}.count`]: {
                $cond: {
                  if: {
                    $gte: [messageId, `$data.${readerName}.last_msg_id`],
                  },
                  then: count,
                  else: `$data.${readerName}.count`,
                },
              },
            },
          },
          {
            $set: {
              [`data.${readerName}.last_msg_id`]: {
                $cond: {
                  if: {
                    $gte: [messageId, `$data.${readerName}.last_msg_id`],
                  },
                  then: messageId,
                  else: `$data.${readerName}.last_msg_id`,
                },
              },
            },
          },
        ],
        {
          upsert: true,
        }
      );
  } catch (err) {
    await sendMessageToAdmin(err);
  }
};

const removeUser = async (readerName) => {
  let message = "";
  try {
    await client
      .db("news-read-count-db")
      .collection("data")
      .updateOne(
        { _id: ObjectId(COLLECTION_ID) },
        {
          $unset: {
            [`data.${readerName}`]: null,
          },
        }
      );
    message = `reader ${readerName} removed.`;
  } catch (err) {
    message = err;
  } finally {
    await sendMessageToAdmin(message);
  }
};

const sendReport = async () => {
  try {
    let collection = await client
      .db("news-read-count-db")
      .collection("data")
      .findOne({ _id: ObjectId(COLLECTION_ID) });

    // send message to telegram
    let report = `#${collection.report_count} អានប្រចាំថ្ងៃ 7AM:`;
    let countData = Object.fromEntries(
      Object.entries(collection.data).sort(([, a], [, b]) => b.count - a.count)
    );
    Object.keys(countData).forEach(
      (key, i) =>
        (report += `\n${(i + 1).toString().padStart(2, "0")} - ${key}: ${
          countData[key].count
        }`)
    );
    await sendMessage({ chat_id: CHAT_ID, message: report });
  } catch (err) {
    await sendMessageToAdmin(err);
  }
};

const sendMessageToAdmin = async (message) => {
  await sendMessage({
    chat_id: ADMIN_ID,
    message,
  });
};

const sendMessage = async ({ chat_id, message }) => {
  if (!chat_id || !message) return;
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id,
    text: message,
  });
};

module.exports = {
  client: client,
  updateOrCreate: updateOrCreate,
  removeUser: removeUser,
  sendMessage: sendMessage,
  sendMessageToAdmin: sendMessageToAdmin,
  sendReport: sendReport,
};
