require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const {
  isNumber,
  isDurationString,
  isTimesString,
  convertKhmerToArabicNumerals,
} = require("./utils");
const cron = require("node-cron");

const {
  TOKEN,
  SERVER_URL,
  COLLECTION_ID,
  CONNECTION_STRING,
  ADMIN_ID,
  CHAT_ID,
} = process.env;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const URI = `/webhook/${TOKEN}`;
const WEBHOOK_URL = SERVER_URL + URI;

const app = express();
app.use(bodyParser.json());

// IDEA: increase by one every valid message? build if update how?

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

const dbConnectionTest = async () => {
  try {
    // Connect the client to the server
    await client.connect();
    // Establish and verify connection
    await client.db("admin").command({ ping: 1 });
    console.log("Connected successfully to server");
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
};

const init = async () => {
  await axios.get(`${TELEGRAM_API}/setWebhook?url=${WEBHOOK_URL}`);
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

cron.schedule("0 7 * * *", async function () {
  try {
    await client.connect();
    await client
      .db("news-read-count-db")
      .collection("data")
      .findOneAndUpdate(
        { _id: ObjectId(COLLECTION_ID) },
        { $inc: { report_count: 1 } }
      );
    await sendReport();
  } catch (err) {
  } finally {
    await client.close();
  }
});

app.get("/", (req, res) => {
  res.json({
    running: true,
  });
});

app.get("/hello", (req, res) => {
  res.json({
    running: true,
  });
});

app.post(URI, async (req, res) => {
  // console.log(req.body);
  const message = req.body.message || req.body.edited_message;
  if (!message) return res.send();

  const text = message.text;
  if (!text) return res.send();

  const messageId = message.message_id;
  const chatId = message.chat.id;
  if (
    !chatId ||
    (Number(chatId) != Number(CHAT_ID) && Number(chatId) != Number(ADMIN_ID))
  ) {
    return res.send();
  }
  try {
    await client.connect();
    if (text.includes("/remove")) {
      console.log("remove");
      let removeCommandText = text.includes("/remove@read_count_bot")
        ? "/remove@read_count_bot"
        : "/remove";
      const readerName = text.replaceAll(`${removeCommandText} `, "");
      if (readerName) {
        if (Number(message.from.id) === Number(ADMIN_ID)) {
          await removeUser(readerName);
        }
      }
      return res.send();
    }

    if (text === "/report@read_count_bot" || text === "/report") {
      console.log("report");
      await sendReport();
      return res.send();
    }

    const arr = text.split(" ");
    if (arr.length === 4) {
      const count = arr[0].replaceAll("#", "");
      const user = arr[1];
      const duration = arr[2];
      const times = arr[3];

      if (
        isNumber(count) === false ||
        isDurationString(duration) === false ||
        isTimesString(times) === false
      ) {
        return res.send();
      }

      await updateOrCreate(
        user,
        convertKhmerToArabicNumerals(count),
        messageId
      );
      await sendReport();
    }
  } catch (err) {
    sendMessageToAdmin(err);
  } finally {
    await client.close();
    return res.send();
  }
});

app.listen(process.env.PORT || 5000, async () => {
  console.log(`app running on port `, process.env.PORT || 5000);
  await init();
  await dbConnectionTest().catch(console.dir);
});
