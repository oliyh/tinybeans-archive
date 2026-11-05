(ns tinybeans-archive.main
  (:require [tinybeans-archive.core :as core]
            [clojure.java.io :as io]))

(defn- quiet-cookie-warnings!
  "Tinybeans sends Set-Cookie headers with an Expires format Apache HttpClient
   rejects, logging a harmless warning on every response. Cookies are not used,
   so silence that logger."
  []
  (.setLevel (java.util.logging.Logger/getLogger "org.apache.http.client.protocol.ResponseProcessCookies")
             java.util.logging.Level/SEVERE))

(defn -main [& args]
  (quiet-cookie-warnings!)
  (if (= "resite" (first args))
    (let [target-dir (or (second args) "archive")]
      (println "Regenerating app for" target-dir "from its existing source.json")
      (core/resite! (io/file target-dir)))
    (let [[api-key journal-id target-dir] args
          target-dir (or target-dir "archive")]
      (println "Archiving tinybeans entries for journal" journal-id "into" target-dir)
      (core/archive (io/file target-dir) api-key (Long/parseLong journal-id)))))
