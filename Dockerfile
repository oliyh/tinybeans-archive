FROM clojure:lein

WORKDIR /app

COPY project.clj .
RUN lein deps

COPY . .

VOLUME /archive

ENTRYPOINT ["sh", "-c", "exec lein archive \"$TINYBEANS_API_KEY\" \"$TINYBEANS_JOURNAL_ID\" /archive"]
