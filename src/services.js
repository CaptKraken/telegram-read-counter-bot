require("dotenv").config();
const axios = require("axios");
const { TOKEN, COLLECTION_ID, CONNECTION_STRING, ADMIN_ID, CHAT_ID } =
  process.env;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const { MongoClient, ObjectId } = require("mongodb");
const uri = CONNECTION_STRING;

let cache = {};

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
    throw new Error(`DATABASE CONNECTION ERROR\n${new Date.now().toString()}`);
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
  }
};

const setCache = async () => {
  try {
    await client.connect();
    const col = await findOneDocument(COLLECTION_ID);
    cache = { ...col };
  } catch (err) {
    console.log(err);
    throw new Error(err);
  } finally {
    await client.close();
  }
};

const isAdmin = async (chatId) => {
  const admins = cache.admins;
  if (admins) {
    for (n in admins) {
      if (Number(admins[n]) === Number(chatId)) {
        return true;
      }
    }
    return false;
  }

  try {
    console.log("no cache");
    await setCache();
    await isAdmin(chatId);
  } catch (err) {
    throw new Error(err);
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
    throw new Error(
      `function: updateOrCreate\nreaderName: ${readerName}\ncount: ${count}\nmessage id: ${messageId}\nerror: ${err}`
    );
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
    throw new Error(`function: increaseReportCount\nerror: ${err}`);
  }
};

/**
 * removes a reader from the read count data
 * @param {string} readerName
 * @returns void
 */
const removeReader = async (readerName) => {
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
    await sendMessageToAdmin(`reader ${readerName} removed.`);
  } catch (err) {
    throw new Error(
      `function: removeReader\nreaderName: ${readerName}\nerror: ${err}`
    );
  }
};

/**
 * find all admins
 * @returns admin object
 */
const findAllAdmins = async () => {
  try {
    const res = await findOneDocument(COLLECTION_ID);
    return res.admins;
  } catch (err) {
    throw new Error(`function: findAllAdmins\nerror: ${err}`);
  }
};

/**
 * send the admin list to the provided chat id
 * @param {number|string} chatId
 * @returns void
 */
const sendAdminList = async (chatId) => {
  if (!chatId) return;
  try {
    const admins = await findAllAdmins();
    if (!admins) return;
    let message = "ADMINS:";
    const sortedAdmins = Object.fromEntries(
      Object.entries(admins).sort(([, a], [, b]) => a - b)
    );
    Object.keys(sortedAdmins).forEach((key, i) => {
      message += `\n${(i + 1).toString().padStart(2, "0")} - ${key}: ${
        admins[key]
      }`;
    });
    await sendMessage(chatId, message);
  } catch (err) {
    throw new Error(`function: sendAdminList\nerror: ${err}`);
  }
};

/**
 * add the provided user to the admin list
 * @param {string} username
 * @param {number|string} userId
 */
const addAdmin = async (username, userId) => {
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
    await setCache();
  } catch (err) {
    message = `function: add\nusername: ${username}\nuser_id: ${userId}\nerror: ${err}`;
  } finally {
    throw new Error(message);
  }
};

/**
 * remove the given username from the admin list
 * @param {string} username
 */
const removeAdmin = async (username) => {
  if (!username) {
    throw new Error(
      `function: removeAdmin\nerror: no admin username was given.`
    );
  }

  try {
    if (!cache.admins) await setCache();
    if (Object.keys(cache.admins).length > 1) {
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
      await sendMessageToAdmin(`user ${username} removed from admin list.`);

      await setCache();
    } else {
      await sendMessageToAdmin(
        `function: removeAdmin\nerror: there has to be at least one user on the admin list.`
      );
    }
  } catch (err) {
    throw new Error(
      `function: removeAdmin\nusername: ${username}\nerror: ${err}`
    );
  }
};

/**
 * find on document with the given id
 * @param {string} collection_id
 * @returns
 */
const findOneDocument = async (collection_id) => {
  try {
    const collection = await client
      .db("news-read-count-db")
      .collection("data")
      .findOne({ _id: ObjectId(collection_id) });
    return collection;
  } catch (err) {
    throw new Error(
      `function: "findOneDocument"\ncollection_id: ${collection_id}\nerror: ${err},`
    );
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
    throw new Error(`function: "sendReport"\nerror: ${err}`);
  }
};

/**
 * sends a message to every admin
 * @param {string} message
 * @returns void
 */
const sendMessageToAdmin = async (message) => {
  try {
    if (!cache.admins) await setCache();
    Object.values(cache.admins).forEach(async (userId) => {
      await sendMessage(userId, message);
    });
  } catch (err) {
    console.error(`sendMessageToAdmin Error\n${message}`);
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
    throw new Error(
      `function: "sendMessage"\nchat_id: ${chat_id}\nmessage: ${message}`
    );
  }
};

module.exports = {
  client: client,
  addAdmin: addAdmin,
  removeAdmin: removeAdmin,
  findAllAdmins: findAllAdmins,
  sendAdminList: sendAdminList,
  removeAdmin: removeAdmin,
  dbConnectionTest: dbConnectionTest,
  findOneDocument: findOneDocument,
  increaseReportCount: increaseReportCount,
  updateOrCreate: updateOrCreate,
  removeReader: removeReader,
  sendMessage: sendMessage,
  sendMessageToAdmin: sendMessageToAdmin,
  sendReport: sendReport,
  cache: cache,
  setCache: setCache,
  isAdmin: isAdmin,
};
