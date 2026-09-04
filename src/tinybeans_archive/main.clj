(ns tinybeans-archive.main
  (:require [tinybeans-archive.core :as core]
            [clojure.java.io :as io]))

(defn -main [& args]
  (if (= "resite" (first args))
    (let [target-dir (or (second args) "archive")]
      (println "Regenerating app for" target-dir "from its existing source.json")
      (core/resite! (io/file target-dir)))
    (let [[api-key journal-id target-dir] args
          target-dir (or target-dir "archive")]
      (println "Archiving tinybeans entries for journal" journal-id "into" target-dir)
      (core/archive (io/file target-dir) api-key (Long/parseLong journal-id)))))
