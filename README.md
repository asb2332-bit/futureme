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
- Node.js 18 or newer for the draft storage tests

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
node --test test/drafts_test.js
```

Unfinished capsules are saved automatically in the current browser. Resume them from **Your drafts** on the home page, or use **Discard draft** to remove one. Drafts include the message, unlock date, and poster design; they are stored on this device and are not sealed until you submit the capsule.

## Stop the database

```sh
docker compose down
```
