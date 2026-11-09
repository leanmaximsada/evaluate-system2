# Demo data

Demo data lets you try the whole system without typing anything in. It is **disabled in production**.

## Commands

    php artisan demo:seed             # create the demo data (prints a random password once)
    php artisan demo:seed --fresh     # remove the old demo data, then create it again
    php artisan demo:reset            # remove the demo data and nothing else
    php artisan db:seed --class=DemoSeeder   # same as demo:seed

The first Super Admin is never part of the demo. Create it yourself:

    php artisan app:create-super-admin

## How demo data is marked

- Accounts end in `@demo.test`
- Event codes start with `DEMO-`
- Form names start with `[Demo] `

`demo:reset` deletes only records with these markers.

## What it contains

| Event | State | Shows |
|---|---|---|
| DEMO-ENG | Completed, published | Final ranking with a tie, sponsors, subtitle lines |
| DEMO-SCI | In progress | Provisional results, incomplete evaluations, a draft |
| DEMO-PITCH | Upcoming | An event that is ready to start |
| DEMO-HACK | Draft | Empty states |

Accounts: `demo.admin1@demo.test`, `demo.admin2@demo.test`, `demo.judge1@demo.test` to `demo.judge5@demo.test`.

## Safety

- No password is stored in the repository. A random one is generated per run, or pass `--password`.
- Passing `--password` on the command line stores it in your shell history, so prefer the random one for anything shared.
- Both commands refuse to run when `APP_ENV=production`.
- If a demo account or form is used by a record that is not demo data, `demo:reset` stops and removes nothing.
- Sponsor logos are stored in `storage/app/public/sponsors/` and need `php artisan storage:link`.