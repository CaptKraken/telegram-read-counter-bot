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

const { TOKEN, SERVER_URL, ADMIN_ID, CHAT_ID, COLLECTION_ID } = process.env;

const {
  client,
  sendReport,
  sendMessageToAdmin,
  removeReader,
  updateOrCreate,
  removeAdmin,
  findOneDocument,
  sendAdminList,
  increaseReportCount,
  sendMessage,
  addAdmin,
  cache,
  setCache,
  isAdmin,
} = require("./services");

const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const URI = `/webhook/${TOKEN}`;
const WEBHOOK_URL = SERVER_URL + URI;

// let cache = {};

const app = express();
app.use(bodyParser.json());

// IDEA: increase by one every valid message? build if update how?

// set webhook for bot
const init = async () => {
  try {
    const res = await axios.get(
      `${TELEGRAM_API}/setWebhook?url=${WEBHOOK_URL}`
    );
    if (Object.keys(cache).length > 0) return;
    await setCache();
  } catch (err) {
    await sendMessageToAdmin(`INIT FAILED\n${err}`);
  }
};

// keep the heroku app alive
setInterval(function () {
  axios.get(SERVER_URL);
}, 600000); // every 10 minutes

// cron job to send report to the group everyday at 7 am
cron.schedule(
  "00 07 * * *",
  async function () {
    try {
      await client.connect();
      await increaseReportCount();
      await sendReport();
    } catch (err) {
      await sendMessageToAdmin(`Cron Job Error\nerror: ${err}`);
    } finally {
      await client.close();
    }
  },
  {
    timezone: "Asia/Phnom_Penh",
  }
);

app.get("/", (req, res) => {
  res.json({
    alive: true,
  });
});

app.post(URI, async (req, res) => {
  const message = req.body.message || req.body.edited_message;
  if (!message) return res.send();

  const text = message.text;
  if (!text) return res.send();

  const messageId = message.message_id;
  const chatId = message.chat.id;
  if (!chatId) return res.send();

  const senderId = message.from.id;
  const isSenderAdmin = await isAdmin(senderId);
  const isFromReadingGroup = chatId.toString() === CHAT_ID.toString();

  try {
    await client.connect();

    if (text.substring(0, 3).startsWith("/me")) {
      await sendMessage(
        chatId,
        `id: ${senderId}\nusername: ${message.from.username ?? ""}`
      );
      return res.send();
    }
    if (isSenderAdmin) {
      if (text.startsWith("/admins")) {
        await sendAdminList(chatId);
        return res.send();
      }

      if (text.startsWith("/addAdmin")) {
        let addAdminCommandText = text.includes("/addAdmin@read_count_bot")
          ? "/addAdmin@read_count_bot"
          : "/addAdmin";
        const [username, id] = text
          .replace(`${addAdminCommandText} `, "")
          .split(" ");
        if (!username || !id) return res.send();

        await addAdmin(username, id);

        return res.send();
      }

      if (text.startsWith("/removeAdmin")) {
        let removeCommandText = text.includes("/removeAdmin@read_count_bot")
          ? "/removeAdmin@read_count_bot"
          : "/removeAdmin";
        const adminName = text.replace(`${removeCommandText} `, "");
        if (adminName) {
          await removeAdmin(adminName);
        }
        return res.send();
      }

      if (text.startsWith("/remove")) {
        let removeCommandText = text.includes("/remove@read_count_bot")
          ? "/remove@read_count_bot"
          : "/remove";
        const readerName = text.replace(`${removeCommandText} `, "");
        if (readerName) {
          if (Number(message.from.id) === Number(ADMIN_ID)) {
            await removeReader(readerName);
          }
        }
        return res.send();
      }

      if (text.startsWith("/report")) {
        await sendReport();
        return res.send();
      }
    }

    if (isFromReadingGroup || isSenderAdmin) {
      if (!text.trim().startsWith("#")) return res.send();

      const result = text
        .trim() // removes empty spaces front & back
        .split(" ") // splits into an array
        .filter((n) => n.length > 0); // removes empty items from array

      if (result.length === 4) {
        const count = result[0].replace("#", "");
        const user = result[1];
        const duration = result[2];
        const times = result[3];

        if (
          isNumber(count) === false ||
          isDurationString(duration) === false ||
          isTimesString(times) === false
        ) {
          return res.send();
        }

        await updateOrCreate(
          user,
          Number(convertKhmerToArabicNumerals(count)),
          messageId
        );
      }
    }
  } catch (err) {
    await sendMessageToAdmin(`ERROR:\nmessage:\n${message}\nerr:\n${err}`);
  } finally {
    await client.close();
    return res.send();
  }
});

app.listen(process.env.PORT || 5000, async () => {
  console.log(`app running on port `, process.env.PORT || 5000);
  await init();
});
