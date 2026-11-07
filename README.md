# FutureMe

Preserve the moment. Share the meaning.

FutureMe lets people create digital time capsules containing a message that remains sealed until a chosen future date.

## Team Members

| Name | UNI |
| --- | --- |
| Ibrahim | ia2629 |
| Amit | asb2332 |
| Sammy | sn3136 |
| Yiyao | yz5137 |

## Requirements

- Ruby 3.3.8 (managed by rbenv)
- Docker Desktop

## Run locally

```sh
docker compose up -d db
bundle install
bin/rails db:prepare
bin/rails server
```

Open <http://localhost:3000>.

## Test

```sh
bundle exec rspec
bundle exec cucumber
```

## Stop the database

```sh
docker compose down
```

## Accounts and permissions

Run `bundle install` and `bin/rails db:prepare` after checking out this branch.
Visit `/signup` to create an email/password account, or `/login` to sign in.
Passwords require 12–72 characters. Sign-ups always receive the `user` role.
Each account can list/create/read only its own capsules; admins cannot bypass
capsule privacy or unlock dates. Pre-existing anonymous capsules remain in the
database with no owner and are not displayed to signed-in users.

To grant admin access, first register the intended account, then run this on the
trusted application server (there are no default admin credentials):

```sh
EMAIL=you@example.com bundle exec rake accounts:promote
```

Admins can open `/admin` to view account counts and the first 100 accounts.
Role assignment is intentionally not exposed through public signup parameters.

### Google OAuth setup

Create a Web application OAuth client in Google Cloud / Google Auth Platform.
Configure the consent screen and, while in testing mode, add your team's Google
accounts as test users. Register this exact local authorized redirect URI:

```
http://localhost:3000/auth/google_oauth2/callback
```

For deployment, also register the same path on your HTTPS application domain.
Set these variables in your shell or hosting provider's secret settings before
starting Rails (a `.env` file is not automatically loaded):

```sh
export GOOGLE_CLIENT_ID='your-client-id'
export GOOGLE_CLIENT_SECRET='your-client-secret'
bin/rails server
```

Never commit these values. Google sign-in appears once both are configured.
It uses a CSRF-protected POST and OAuth state verification. New Google accounts
are regular users. Existing Google accounts are identified by Google's stable
user ID; provider access/refresh tokens are not stored. An email already used by
a password account is not automatically linked: use the original password for
that account. Account linking and password recovery are not part of this change.

Reference: https://github.com/zquestz/omniauth-google-oauth2

### Authentication tests

```sh
bundle exec rspec
bundle exec cucumber
```

Cucumber includes registration, login/logout, denied login, admin permissions,
and Google success/cancellation scenarios. Google is mocked in tests; running
these tests does not contact Google or require real credentials. A real Google
round-trip must be checked after configuring your team's OAuth client.

For local development, you can keep Google's downloaded credentials JSON at
`~/.config/futureme/google-oauth.json` (outside the repository, permissions `600`)
and start the app with `bin/dev-google`. Set `GOOGLE_OAUTH_CREDENTIALS_FILE` to use
a different path. The launcher loads credentials into the server environment;
no secrets are stored in source files or command-line arguments.
