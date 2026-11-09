FUTUREME — ITERATION 1
========================

FutureMe is a digital time-capsule app. Signed-in users can create and design
capsules with text, images, audio, and video; seal them until a future date; and
view or edit their own capsules.

TEAM MEMBERS
------------
Ibrahim — ia2629
Amit — asb2332
Sammy — sn3136
Yiyao — yz5137

LIVE SAAS PROTOTYPE
-------------------
https://calm-shore-09946-2d1c172059b3.herokuapp.com/

GITHUB REPOSITORY
-----------------
https://github.com/asb2332-bit/futureme

RUN LOCALLY
-----------
Requirements:
- Ruby 3.3.8
- Bundler
- Docker Desktop (for PostgreSQL)

Commands:

  git clone https://github.com/asb2332-bit/futureme.git
  cd futureme
  docker compose up -d db
  bundle install
  bin/rails db:prepare
  bin/rails server

Then open this address in a browser:

  http://localhost:3000

To stop the local database:

  docker compose down

RUN TESTS
---------
Run the RSpec suite:

  bundle exec rspec

Run the Cucumber user stories:

  bundle exec cucumber

TEST COVERAGE AND USER STORIES
------------------------------
Cucumber user stories are in the features directory.
RSpec tests are in the spec directory.

The tested features include:
- Account registration, login, logout, and access control
- Creating, sealing, and opening time capsules
- Viewing multiple capsules owned by one user
- A limit of five capsules per account
- Custom poster/canvas layouts and text blocks
- Image, audio, and video uploads
- Multiple audio and video files in one capsule
- Media deletion and capsule validation
- Locked capsule privacy and ownership protection

PRODUCT LIMITS
--------------
These limits keep the prototype within the Cloudinary free-tier storage allowance:
- Each account can create up to 5 capsules.
- Uploaded image, audio, and video files are limited to 2 MB total per capsule.

OPTIONAL LOCAL INTEGRATIONS
---------------------------
Email/password accounts work without extra configuration. To test Cloudinary
uploads or Google sign-in locally, create a .env file in the project root with:

  CLOUDINARY_CLOUD_NAME=your-cloud-name
  CLOUDINARY_API_KEY=your-api-key
  CLOUDINARY_API_SECRET=your-api-secret
  GOOGLE_CLIENT_ID=your-google-client-id
  GOOGLE_CLIENT_SECRET=your-google-client-secret

Do not commit the .env file. For local Google sign-in, configure this Google OAuth
redirect URI:

  http://localhost:3000/auth/google_oauth2/callback
