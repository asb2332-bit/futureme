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
