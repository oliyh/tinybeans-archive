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

## License

Copyright © 2018 oliyh

Distributed under the Eclipse Public License either version 1.0 or (at
your option) any later version.
