# FutureMe

FutureMe is a digital time-capsule app. Signed-in users can design a capsule with text, images, audio, and video; seal it until a future date; and reopen or edit their own capsules later.

## Iteration 1 submission

- **Working SaaS prototype:** <https://calm-shore-09946-2d1c172059b3.herokuapp.com/>
- **GitHub repository:** <https://github.com/asb2332-bit/futureme>
- **Cucumber user stories:** [`features/`](features/)
- **RSpec tests:** [`spec/`](spec/)

## Team members

| Name | UNI |
| --- | --- |
| Ibrahim | ia2629 |
| Amit | asb2332 |
| Sammy | sn3136 |
| Yiyao | yz5137 |

## Requirements

- Ruby 3.3.8
- Bundler
- Node.js 18+ and npm (to build the React poster editor)
- Docker Desktop (for local PostgreSQL)

## Run locally

```sh
git clone https://github.com/asb2332-bit/futureme.git
cd futureme
docker compose up -d db
bundle install
npm ci
npm run build
bin/rails db:prepare
bin/rails server
```

Open <http://localhost:3000>.

### Optional local integrations

Create a local `.env` file for Cloudinary uploads and Google sign-in. Development automatically loads this file; never commit it.

```dotenv
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

Cloudinary is required to persist uploaded media outside the local process. Google OAuth is optional; email/password accounts work without it. When a capsule is sealed, a confirmation is sent to its owner. Without SMTP configuration, development writes these emails to `tmp/mails` instead of sending them.

To send confirmation emails, configure an SMTP provider and a verified sender in `.env` (or the production environment):

```dotenv
FUTUREME_PUBLIC_URL=https://your-futureme-domain.example
FUTUREME_MAIL_FROM=verified-sender@example.com
FUTUREME_SMTP_HOST=smtp.example.com
FUTUREME_SMTP_PORT=587
FUTUREME_SMTP_USER=your-smtp-username
FUTUREME_SMTP_PASSWORD=your-smtp-password
```

Email delivery failures are logged; they do not undo a successfully sealed capsule. Configure SMTP and the public HTTPS origin in production to deliver emails.

Recipients receive a seal notification with an unlock date and a countdown link. They must sign in or register with the invited email address. To send unlock notifications and retry failed recipient emails, schedule this command regularly (for example, with Heroku Scheduler or cron):

```sh
bin/rails capsules:notify_recipients
```

The scheduler must be configured separately in each deployment. Notification timing depends on its interval. A crash after the mail provider accepts an email but before the database records it can cause a duplicate on retry.

For local Google sign-in, add this authorized redirect URI in Google Cloud Console:

```text
http://localhost:3000/auth/google_oauth2/callback
```

Stop the local database with:

```sh
docker compose down
```

## Run tests

```sh
bundle exec rspec
bundle exec cucumber
```

The Cucumber stories cover registration/login, authorization, creating and viewing capsules, multiple capsules, custom poster layouts, and image/audio/video media. The RSpec suite covers models and authenticated API behavior.

## Product limits

These limits keep the prototype within the Cloudinary free-tier storage allowance.

- Each account can create up to **5 capsules**.
- Uploaded image, audio, and video files are limited to **2 MB total per capsule**.


### Draft invitations

The draft owner can save a draft, open **Collaborate → Share**, and send an invitation. The recipient signs in with the invited address and selects **Join draft**. Online editors can see typing previews and drag outlines while the draft is open. Use **Save draft for editing** to keep changes.

Local development writes invitation emails to `tmp/mails` unless SMTP is configured. For email delivery, set `FUTUREME_PUBLIC_URL` to the app's public HTTPS origin and set `FUTUREME_MAIL_FROM`, `FUTUREME_SMTP_HOST`, and your provider's `FUTUREME_SMTP_USER` and `FUTUREME_SMTP_PASSWORD`. The SMTP port defaults to 587 and can be set with `FUTUREME_SMTP_PORT`.
