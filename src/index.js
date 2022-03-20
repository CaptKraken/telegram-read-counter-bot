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

const { TOKEN, SERVER_URL, ADMIN_ID, CHAT_ID } = process.env;

const {
  client,
  sendReport,
  sendMessageToAdmin,
  removeReader,
  updateOrCreate,
  increaseReportCount,
} = require("./services");
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const URI = `/webhook/${TOKEN}`;
const WEBHOOK_URL = SERVER_URL + URI;

const app = express();
app.use(bodyParser.json());

// IDEA: increase by one every valid message? build if update how?

// set webhook for bot
const init = async () => {
  try {
    await axios.get(`${TELEGRAM_API}/setWebhook?url=${WEBHOOK_URL}`);
  } catch (err) {
    sendMessageToAdmin(err);
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
      await sendMessageToAdmin(err);
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

// webhook handler
app.post(URI, async (req, res) => {
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

    if (text === "/report@read_count_bot" || text === "/report") {
      await sendReport();
      return res.send();
    }

    const arr = text.split(" ");
    if (arr.length === 4) {
      const count = arr[0].replace("#", "");
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
        Number(convertKhmerToArabicNumerals(count)),
        messageId
      );
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
});
