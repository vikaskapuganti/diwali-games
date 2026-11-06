# Diwali Quiz and Tambola

Two live games for the projector. The host runs them from a laptop, and players join on their phones by scanning a QR code. Both use the same Firebase setup.

**Quiz**
- `host.html`: the quiz host screen (open on the laptop connected to the projector)
- `index.html`: the quiz player page (what people open on their phones)
- `questions.js`: all the questions, options and answers (edit here)

**Tambola**
- `tambola-host.html`: the Tambola host screen
- `tambola.html`: the Tambola player page, where each person gets their own ticket
- `calls.js`: the fun line shown with each number (edit here)

**Shared**
- `firebase-config.js`: your Firebase connection details (step 3)

## Try it first (demo mode)

Before Firebase is set up, the quiz runs in **demo mode**, which only works inside one browser on one computer.

1. Open the folder in VS Code and start Live Server (or any local server).
2. Open `host.html` in Chrome, choose Solo or Team, and note the room code.
3. Open `index.html` in 2 or 3 more Chrome tabs, then join with the code and a different name in each tab.
4. Click **Start quiz** on the host tab, and answer in the player tabs.

## 1. Create the Firebase project (about 5 minutes)

1. Go to https://console.firebase.google.com with your own Google account.
2. Click **Create a project**, name it something like `rtih-diwali-quiz`, and turn off Google Analytics (it isn't needed).
3. In the left menu, go to **Build > Realtime Database > Create Database**.
4. Choose the location **Singapore (asia-southeast1)**, then choose **Start in locked mode**.

## 2. Set the database rules

Still on Realtime Database, open the **Rules** tab, replace everything with this, and click **Publish**:

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "rooms": {
      "$room": {
        ".read": true,
        ".write": true
      }
    },
    "tambola": {
      "$game": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

This lets players read and write only inside a game. After the event, you can set all the `true` values to `false` to close it.

## 3. Connect the quiz to Firebase

1. Go to **Project settings** (the gear icon), and under **Your apps** click the web icon `</>`.
2. Give it any nickname, leave Firebase Hosting unticked, and click **Register app**.
3. Firebase shows a `firebaseConfig` block. Copy its values into `firebase-config.js`, replacing `PASTE_HERE` and the empty fields.
4. Make sure `databaseURL` is filled in. It looks like `https://rtih-diwali-quiz-default-rtdb.asia-southeast1.firebasedatabase.app`. If it's missing, copy it from the top of the Realtime Database page.

Open `host.html` again. The badge at the top should now say **LIVE** in green.

## 4. Put it on GitHub Pages

1. On GitHub, create a new **public** repository, for example `diwali-quiz`.
2. Click **Add file > Upload files**, drag in all the files from this folder, and commit.
3. Go to **Settings > Pages**, set Source to **Deploy from a branch**, set Branch to **main** and **/(root)**, and click Save.
4. After about a minute, your quiz is live at:
   - Quiz host: `https://<your-username>.github.io/diwali-quiz/host.html`
   - Tambola host: `https://<your-username>.github.io/diwali-quiz/tambola-host.html`
   - Players: they just scan the QR code shown on the host screen.

## On the day: Quiz

- Open the host link on the laptop, and press **Full screen**.
- Pick **Solo** or **Team**, wait for people to join, then press **Start quiz**.
- Each question ends automatically after 20 seconds, or as soon as everyone has answered. You can also press **Reveal answer now**.
- Keyboard shortcuts: Right arrow or Space goes next, and Left arrow goes back.
- **Back** never restarts a timer, and scores are never counted twice.
- If the laptop browser refreshes, reopen `host.html` and press **Resume it**. If a phone refreshes, the player rejoins automatically with their score.

## On the day: Tambola

- Open the Tambola host link on the laptop, press **Full screen**, then **Start a new game**.
- People scan the QR code and get their own random ticket. Press **Start Tambola** when everyone has joined.
- Press **Next number** (or Space). The ball spins for a second, then lands on the number with its fun line, and it lights up on the 1 to 90 board.
- Players tap numbers on their ticket. A number can only be marked after it has been called.
- When a line or the full ticket is complete, the Claim button glows. The app checks the claim, and the winner pops up on the projector.
- Prizes: Top Line, Middle Line, Bottom Line, then 1st, 2nd and 3rd Full House. The game ends when the 3rd Full House is won.
- If the laptop browser refreshes, reopen the host link and press **Resume game**. If a phone refreshes, the player keeps the same ticket and marks.

## Quiz scoring

- A correct answer gets 10 points, plus up to 5 bonus points for answering fast.
- Round 4 (Vizag Rapid Fire) counts double.
- If two players have the same score, whoever answered faster overall ranks higher.

The free Firebase plan allows 100 people connected at once, which is enough for 60 to 70 players.
