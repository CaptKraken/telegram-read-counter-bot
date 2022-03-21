# telegram-read-counter-bot

for my private team. this bot reports the news read count from our telegram group.

in my current (2022) workplace, there's a news reading group where we read the news everyday.
we usually keep track of our own count by sending the message with the format:

> "#{count} {name} {minute}នាទី {times}ដង"

there's one person who will have to report the total of everybody's counts everyday at 07:00 AM.
this time, it's my turn, so i decided to build a bot to do that for me.

this bot makes use of telegram bot api + mongodb atlas (free) running on nodejs + expressjs. it is currently deployed on heroku's free plan.

commands:

- /me - send your id and username
- /admins - [ADMIN] send the admin list
- /addAsAdmin {user_name} {user_id} - [ADMIN] add a user as admin
- /removeAdmin {user_name} - [ADMIN] remove a user from the admin list
- /report - [ADMIN] send a report to the group
- /remove {user_name} - [ADMIN] remove the reader's record from database
