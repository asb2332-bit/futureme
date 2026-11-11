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

## Search and filter

On the home page, search your capsule titles, filter by locked or unlocked status, and sort by creation time or unlock date; reset the controls to see your full library again.

Search only uses titles from your account and never searches sealed messages or poster notes.

## Requirements

- Ruby 3.3.8
- Bundler
- Docker Desktop (for local PostgreSQL)

## Run locally

```sh
git clone https://github.com/asb2332-bit/futureme.git
cd futureme
docker compose up -d db
bundle install
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

Cloudinary is required to persist uploaded media outside the local process. Google OAuth is optional; email/password accounts work without it. For local Google sign-in, add this authorized redirect URI in Google Cloud Console:

```text
http://localhost:3000/auth/google_oauth2/callback
```

Stop the local database with:

```sh
docker compose down
```

## Calendar reminders

Open a locked capsule and choose **Download calendar reminder**, then import the `.ics` file into your calendar app to add an alert at the unlock time and a link back to the capsule. Calendar downloads require your account and never include the private message or media; your calendar app controls alert delivery.

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

