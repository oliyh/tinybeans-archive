# tinybeans-archive

Create an archive of a tinybeans journal.

## Usage

```bash
lein archive <api-key> <journal-id> <archive-dir>
```

To obtain the `api-key` and `journal-id`, log in to Tinybeans on the web:
- `journal-id` is in the URL, e.g. here it is `123456` https://tinybeans.com/app/#/main/journals/123456/2022/12
- `api-key` is in a cookie called `accessToken`

`archive-dir` is optional and defaults to `./archive`.

Alongside the existing static pages, archiving also generates a richer
browsing app at `<archive-dir>/app/index.html`, with:

- a calendar you can drill into (year &rarr; month &rarr; day)
- a date-jump and caption keyword search
- "The Wall" - a lazy-loaded masonry view of every photo
- a self-refreshing gallery wall of a handful of photos at a time
- filtering any of the above by which child(ren) are tagged in a photo

It's a static, dependency-free page (no server, no build step) that reuses
the images already downloaded by the archiver, linking back to the classic
per-entry pages for comments.

If you just want to regenerate the app (e.g. after tweaking its styling)
without re-fetching anything from Tinybeans, run:

```bash
lein archive resite <archive-dir>
```

## License

Copyright © 2018 oliyh

Distributed under the Eclipse Public License either version 1.0 or (at
your option) any later version.
