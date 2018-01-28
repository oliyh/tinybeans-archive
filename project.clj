(defproject tinybeans-archive "0.1.0-SNAPSHOT"
  :description "Create an archive of a tinybeans journal"
  :url "https://github.com/oliyh/tinybeans-archive"
  :license {:name "Eclipse Public License"
            :url "http://www.eclipse.org/legal/epl-v10.html"}
  :dependencies [[org.clojure/clojure "1.9.0"]
                 [clj-http "3.7.0"]
                 [hiccup "1.0.5"]
                 [metosin/muuntaja "0.5.0"]
                 [funcool/urania "0.1.1"]
                 [funcool/promesa "1.9.0"]
                 [martian "0.1.6"]]
  :aliases {"archive" ["run" "-m" "tinybeans-archive.main"]})
