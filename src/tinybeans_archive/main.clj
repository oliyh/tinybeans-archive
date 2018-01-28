(ns tinybeans-archive.main
  (:require [tinybeans-archive.core :as core]))

(defn -main [& args]
  (let [[api-key journal-id] args]
    (println "Archiving tinybeans entries for journal" journal-id)
    (core/archive api-key (Long/parseLong journal-id))))
