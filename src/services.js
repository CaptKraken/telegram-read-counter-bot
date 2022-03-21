require("dotenv").config();
const axios = require("axios");
const { TOKEN, COLLECTION_ID, CONNECTION_STRING, ADMIN_ID, CHAT_ID } =
  process.env;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const { MongoClient, ObjectId } = require("mongodb");
const uri = CONNECTION_STRING;

/**
 * the database client
 * @returns MongoClient
 */
const client = new MongoClient(uri);

/**
 * checks database connection
 * @returns void
 */
const dbConnectionTest = async () => {
  try {
    // Connect the client to the server
    await client.connect();
    // Establish and verify connection
    await client.db("admin").command({ ping: 1 });
    console.log("Connected successfully to server");
  } catch (err) {
    await sendMessageToAdmin("DATABASE CONNECTION ERROR ", new Date.now());
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
};

/**
 * updates or creates read count of a reader
 * @param {string} readerName
 * @param {number} count
 * @param {number} messageId
 * @returns void
 */
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

/**
 * increases the report count
 * @returns void
 */
const increaseReportCount = async () => {
  try {
    await client
      .db("news-read-count-db")
      .collection("data")
      .findOneAndUpdate(
        { _id: ObjectId(COLLECTION_ID) },
        { $inc: { report_count: 1 } }
      );
  } catch (err) {
    await sendMessageToAdmin(err);
  }
};

/**
 * removes a reader from the read count data
 * @param {string} readerName
 * @returns void
 */
const removeReader = async (readerName) => {
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

const findAllAdmins = async () => {
  try {
    const res = await findOneDocument(COLLECTION_ID);
    return res.admins;
  } catch (err) {
    sendMessageToAdmin("findAllAdmins Error", err);
  }
};
const sendsAdminList = async () => {
  try {
    const admins = await findAllAdmins();
    if (!admins) return res.send();
    let message = "ADMINS:";
    const sortedAdmins = Object.fromEntries(
      Object.entries(admins).sort(([, a], [, b]) => a - b)
    );
    Object.keys(sortedAdmins).forEach((key, i) => {
      message += `\n${(i + 1).toString().padStart(2, "0")} - ${key}: ${
        admins[key]
      }`;
    });
    await sendMessageToAdmin(message);
  } catch (err) {
    sendMessageToAdmin("sendAdminList Error", err);
  }
};
const addAsAdmin = async (username, userId) => {
  let message = "";
  try {
    await client
      .db("news-read-count-db")
      .collection("data")
      .updateOne(
        { _id: ObjectId(COLLECTION_ID) },
        {
          $set: {
            [`admins.${username}`]: Number(userId),
          },
        }
      );
    message = `user ${username} with id ${userId} added as admin.`;
  } catch (err) {
    message = err;
  } finally {
    await sendMessageToAdmin(message);
  }
};
const removeAdmin = async (username) => {
  if (!username) {
    await sendMessageToAdmin("no admin username was required.");
    return;
  }
  let message = "";
  try {
    const admins = await findAllAdmins();
    if (admins.length > 1) {
      await client
        .db("news-read-count-db")
        .collection("data")
        .updateOne(
          { _id: ObjectId(COLLECTION_ID) },
          {
            $unset: {
              [`admins.${username}`]: null,
            },
          }
        );
      message = `user ${username} removed from admin list.`;
    } else {
      message = `there has to be at least one user on the admin list.`;
    }
  } catch (err) {
    message = err;
  } finally {
    await sendMessageToAdmin(message);
  }
};

const findOneDocument = async (collection_id) => {
  try {
    const collection = await client
      .db("news-read-count-db")
      .collection("data")
      .findOne({ _id: ObjectId(collection_id) });
    return collection;
  } catch (err) {
    await sendMessageToAdmin(err);
    throw new Error(err);
  }
};

/**
 * sends the read count report to the group
 * @returns void
 */
const sendReport = async () => {
  try {
    const collection = await findOneDocument(COLLECTION_ID);

    // prepare the message
    let report = `#${collection.report_count} អានប្រចាំថ្ងៃ 7AM:`;
    const countData = Object.fromEntries(
      Object.entries(collection.data).sort(([, a], [, b]) => b.count - a.count)
    );
    Object.keys(countData).forEach((key, i) => {
      report += `\n${(i + 1).toString().padStart(2, "0")} - ${key}: ${
        countData[key].count
      }`;
    });

    await sendMessage(CHAT_ID, report);
  } catch (err) {
    await sendMessageToAdmin(err);
  }
};

/**
 * sends a message to the admin
 * @param {string} message
 * @returns void
 */
const sendMessageToAdmin = async (message) => {
  try {
    await sendMessage(ADMIN_ID, message);
  } catch (err) {
    console.error(err);
  }
};

/**
 * sends a message to the provided chat id
 * @param {number} chat_id
 * @param {string} message
 * @returns void
 */
const sendMessage = async (chat_id, message) => {
  if (!chat_id || !message) return;
  try {
    await axios
      .post(`${TELEGRAM_API}/sendMessage`, {
        chat_id,
        text: message,
      })
      .catch(function (error) {
        console.log(error);
      });
  } catch (err) {
    console.error(err);
  }
};

module.exports = {
  client: client,
  addAsAdmin: addAsAdmin,
  removeAdmin: removeAdmin,
  findAllAdmins: findAllAdmins,
  sendsAdminList: sendsAdminList,
  removeAdmin: removeAdmin,
  dbConnectionTest: dbConnectionTest,
  findOneDocument: findOneDocument,
  increaseReportCount: increaseReportCount,
  updateOrCreate: updateOrCreate,
  removeReader: removeReader,
  sendMessage: sendMessage,
  sendMessageToAdmin: sendMessageToAdmin,
  sendReport: sendReport,
};
