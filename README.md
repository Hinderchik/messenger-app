# Messenger App

A web messenger built as an installable PWA: Node.js/Express backend, plain HTML/JS frontend, email verification, password reset and offline support.

**Live demo:** https://messenger-app-roan-two.vercel.app

## Features

- **Registration with email verification** — 6-digit code sent by email (SMTP via nodemailer)
- **Password reset** — request a link by email and set a new password
- **PWA support** — installable, service worker for offline mode and push notifications
- **Settings page** — profile and app preferences
- **Russian UI** — all pages and error messages localized
- **Custom 404 page** with animations

## Tech stack

| Layer | Technology |
| --- | --- |
| Runtime | Node.js |
| Server | Express |
| Email | Nodemailer (SMTP) |
| Auth | Session-based, HMAC password hashing |
| Frontend | Static HTML + vanilla JS |
| Hosting | Vercel |

## Project structure

```
messenger-app/
├── api/                # serverless API endpoints
├── lib/                # shared helpers
├── middleware/         # auth and access middleware
├── public/             # static assets
├── server.js           # Express server
├── app.js              # client-side app logic
├── sw.js               # service worker
├── manifest.json       # PWA manifest
├── chat.html           # chat UI
├── login.html          # sign in
├── register.html       # sign up
├── verify-email.html   # email verification
├── verify-code.html    # 6-digit code entry
├── reset-password.html # password reset
├── settings.html       # user settings
└── vercel.json         # deployment config
```

## Local setup

```bash
git clone https://github.com/Hinderchik/messenger-app.git
cd messenger-app
npm install
node server.js
```

The app starts on the port from `process.env.PORT` (default 3000).

### Environment variables

Create a `.env` file with your SMTP credentials and a secret for token signing. Never commit this file — it is already listed in `.gitignore`.

## Deployment

The project is configured for Vercel: `vercel.json` handles routing for static files, and `api/` contains the serverless endpoints. Import the repository in Vercel and set the environment variables there.

## Notes

This is a learning/experimental project. Before using it in production, harden the auth flow, move sessions to a proper store and add rate limiting to the email endpoints.
