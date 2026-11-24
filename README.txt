FUTUREME
========

FutureMe is a digital time-capsule app. Signed-in users create a private poster
with text, images, audio, and video, seal it until a future date, and reopen or
edit their own capsules. Owners can also add email recipients, who receive a
link when the capsule is sealed and when it unlocks.

ITERATION 2 SUBMISSION
======================

Working SaaS prototype:
https://calm-shore-09946-2d1c172059b3.herokuapp.com/

GitHub repository:
https://github.com/asb2332-bit/futureme

Cucumber user stories: features/
RSpec tests: spec/

TEAM MEMBERS
============

Ibrahim — ia2629
Amit    — asb2332
Sammy   — sn3136
Yiyao   — yz5137

WHAT'S NEW SINCE ITERATION 1
============================

- Redesigned capsule-creation UI with a custom, draggable poster editor
- Ported the poster editor UI to React for a more responsive editing experience
- Google Drive media import
- Seal and unlock email notifications for recipients

FEATURES
========

- Email/password accounts and private capsule ownership
- Custom, draggable poster layouts with text, linked or uploaded images, audio,
  and video
- Google Drive media import when Google Picker credentials are configured
- Future unlock dates, owner editing, and recipient delivery links
- Seal and unlock email notifications for up to 20 recipients

REQUIREMENTS
============

- Ruby 3.3.8 and Bundler
- Node.js 18+ and npm
- Docker Desktop (for PostgreSQL)

RUN LOCALLY
===========

  git clone https://github.com/asb2332-bit/futureme.git
  cd futureme
  docker compose up -d db
  bundle install
  npm ci
  npm run build
  bin/rails db:prepare
  bin/rails server

Open http://localhost:3000.

Stop the local database when finished:

  docker compose down

OPTIONAL INTEGRATIONS
=====================

Development uses local storage for uploads by default. Add these values to an
uncommitted .env file to use Cloudinary and Google Drive import:

  CLOUDINARY_CLOUD_NAME=your-cloud-name
  CLOUDINARY_API_KEY=your-api-key
  CLOUDINARY_API_SECRET=your-api-secret
  GOOGLE_CLIENT_ID=your-google-client-id
  GOOGLE_PICKER_API_KEY=your-google-picker-api-key
  GOOGLE_CLOUD_PROJECT_NUMBER=your-google-project-number

Configure SMTP to send owner and recipient emails instead of writing them to
tmp/mails:

  FUTUREME_PUBLIC_URL=https://your-futureme-domain.example
  FUTUREME_MAIL_FROM=verified-sender@example.com
  FUTUREME_SMTP_HOST=smtp.example.com
  FUTUREME_SMTP_PORT=587
  FUTUREME_SMTP_USER=your-smtp-username
  FUTUREME_SMTP_PASSWORD=your-smtp-password

Recipient unlock notifications need a scheduled job. In local development, run
this in a second terminal:

  bin/notify-recipients

In production, schedule `bin/rails capsules:notify_recipients` regularly. The
job sends pending seal notices and unlock notices.

RUN TESTS
=========

  bundle exec rspec
  bundle exec cucumber

PRODUCT LIMITS
==============

- Each account can create up to 5 capsules.
- A capsule can have up to 20 recipients.
- Uploaded image, audio, and video files are limited to 2 MB total per capsule.
