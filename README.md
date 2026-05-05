# 📊 Biometrics Dashboard

Automated biometrics report distribution system built with Next.js + TypeScript.

---

## Features

- 📁 Upload 1–3 PDFs per office via browser
- 📧 Send biometrics reports to each office's Gmail
- ⏰ Auto-sends every **15th of the month at 8:00 AM**
- 🔘 Manual "Send All Now" or per-office send
- 📋 Full send history/logs
- ✏️ Add, edit, delete offices anytime

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up Gmail credentials

Copy the example env file:
```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your credentials:
```env
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
GMAIL_FROM_NAME=Biometrics Department
```

> **Important:** Use a Gmail **App Password**, NOT your real password.
> Generate one here: https://myaccount.google.com/apppasswords
> (Requires 2FA to be enabled on your Google account)

### 3. Run in development

```bash
npm run dev
```

Visit: http://localhost:3000

### 4. Run in production (with scheduler)

```bash
npm run build
npm start
```

---

## Usage

1. **Add offices** — Click "Add Office", enter the office name and Gmail address
2. **Upload PDFs** — Click the PDF button on an office row, then "Upload PDFs"
3. **Send manually** — Click the send button per office, or "Send All Now" in the header
4. **Auto-send** — Toggle the switch in the header. It will auto-send on the 15th at 8:00 AM as long as the app is running

---

## File Structure

```
biometrics-dashboard/
├── app/
│   ├── page.tsx              ← Main dashboard UI
│   ├── layout.tsx            ← Root layout
│   ├── globals.css           ← Styles
│   └── api/
│       ├── offices/route.ts  ← CRUD offices
│       ├── send/route.ts     ← Trigger email send
│       ├── upload/route.ts   ← PDF upload/list/delete
│       └── settings/route.ts ← Auto-send toggle + logs
├── lib/
│   ├── store.ts              ← Data read/write (JSON)
│   ├── mailer.ts             ← Nodemailer / Gmail
│   ├── scheduler.ts          ← node-cron (15th every month)
│   └── data.json             ← Auto-generated, stores offices + logs
├── uploads/                  ← PDFs stored here per office
│   ├── Office_A/
│   └── Office_B/
├── server.ts                 ← Custom server (starts scheduler)
└── .env.local                ← Your Gmail credentials (not committed)
```

---

## Keep it running (Windows)

Use PM2 so the scheduler keeps running even if you close the terminal:

```bash
npm install -g pm2
pm2 start "npm start" --name biometrics
pm2 save
pm2 startup
```
