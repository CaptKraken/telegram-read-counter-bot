const { TOKEN, SERVER_URL, ADMIN_ID, CHAT_ID, COLLECTION_ID } = process.env;

const {
  client,
  sendReport,
  sendMessageToAdmin,
  removeReader,
  updateOrCreate,
  findOneDocument,
  increaseReportCount,
} = require("./services");

let cache = {};

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
    await setCache();
    await isAdmin(chatId);
  } catch (err) {
    throw new Error(err);
  }
};

module.exports = {
  cache: cache,
  setCache: setCache,
  isAdmin: isAdmin,
};
