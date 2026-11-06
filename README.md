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

Screenshots: see [`docs/screenshots/`](docs/screenshots/) (home timeline, editor, sealed, opened, not found, mobile).

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

Optional demo data (4 capsules with photos and voice notes, matching the UI prototype):

```sh
bin/rails db:seed
```

Seeding only creates capsules that don't exist yet (matched by title); it never changes or deletes existing data.

## Uploaded photos and voice notes

Photos and voice notes are stored with Active Storage on local disk (no cloud storage):

- Development: `storage/` in the repo (git-ignored).
- Test: `tmp/storage/`, removed after each RSpec run.
- Docker (`docker compose --profile app up --build`): `/rails/storage` inside the container,
  backed by the named volume `storage_data`, so uploads survive rebuilds and redeploys.
  Export `RAILS_MASTER_KEY` (contents of `config/master.key`) or `SECRET_KEY_BASE` first,
  and keep it the same across deploys: upload ids are signed with it, so a new secret
  invalidates uploads that haven't been sealed yet. Back up the `storage_data` volume along
  with the database; `docker compose down -v` deletes it.

Uploads that are never sealed into a capsule are left behind. Remove the ones older than a day with:

```sh
bin/rails futureme:purge_unattached_uploads
```

## Test

```sh
bundle exec rspec
bundle exec cucumber
```

## Stop the database

```sh
docker compose down
```
