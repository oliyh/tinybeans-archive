(ns tinybeans-archive.core
  (:require [muuntaja.core :as m]
            [clj-http.client :as http]
            [clojure.java.io :as io]
            [hiccup.page :refer [html5]])
  (:import [java.io File]
           [java.time LocalDate Instant]
           [java.time.format DateTimeFormatter]))

;; todo
;; 3. CSS
;; 4. Make it faster
;; 5. Nav links - e.g. to next/prev day, next/prev month without having to come back up and out
;; 6. Built in search? Would be some JS involved

(def date-format (DateTimeFormatter/ofPattern "EEEE dd MMMM yyyy"))
(def month-year-format (DateTimeFormatter/ofPattern "MMMM yyyy"))
(def month-format (DateTimeFormatter/ofPattern "MMMM"))
(def iso-date-format (DateTimeFormatter/ofPattern "YYYY-MM-dd"))

(def m (m/create))

(defn- fetch-journal [api-key journal-id]
  (->>
   (http/get "https://tinybeans.com/api/1/journals"
             {:headers {"Authorization" api-key
                        "Accept" "application/json"}})
   :body
   (m/decode m "application/json")
   :journals
   (filter #(= journal-id (:id %)))
   first))

(defn- journal-shards [journal]
  (let [birth-month ^LocalDate (.withDayOfMonth (->> journal :children first :dob LocalDate/parse) 1)
        now (LocalDate/now)]
    (->> (iterate (fn [d] (.plusMonths d 1)) birth-month)
         (take-while (fn [d] (.isAfter now d)))
         (map (fn [d] {:year (.getYear d)
                       :month (.getMonthValue d)})))))

(defn- fetch-entries [api-key journal-id {:keys [year month]}]
  (println (format "Fetching %s-%s" year month))
  (->>
   (http/get (format "https://tinybeans.com/api/1/journals/%s/entries?month=%s&year=%s&idsOnly=true"
                     journal-id
                     month
                     year)
             {:headers {"Authorization" api-key
                        "Accept" "application/json"}})
   :body
   (m/decode m "application/json")
   :entries))

(defn- archive-image [target-dir id url suffix]
  (when url
    (let [target (io/file target-dir (format "%s%s.jpg" id suffix))]
      (when-not (.exists target)
        (let [img (-> (http/get url {:as :byte-array}) :body)]
          (io/make-parents target)
          (with-open [os (io/output-stream target)]
            (.write os img))))
      target)))

(defn- archive-video [target-dir id url]
  (when url
    (let [target (io/file target-dir (format "%s.mp4" id))]
      (when-not (.exists target)
        (let [vid (-> (http/get url {:as :byte-array}) :body)]
          (io/make-parents target)
          (with-open [os (io/output-stream target)]
            (.write os vid))))
      target)))

(defn- archive-page [target-dir id ^String content]
  (let [target (io/file target-dir (format "%s.html" id))]
    (io/make-parents target)
    (with-open [os (io/output-stream target)]
      (.write os (.getBytes content)))
    target))

(defn- archive-json [target-dir id json]
  (let [target (io/file target-dir (format "%s.json" id))]
    (io/make-parents target)
    (with-open [os (io/output-stream target)]
      (io/copy (m/encode m "application/json" json) os))
    target))

(defn- entry-page [id caption comments year month day ^File image ^File video]
  (html5
   [:div.entry-page
    [:a.back {:href "../index.html"} (.format (LocalDate/of year month day) date-format)]
    [:h1.date (.format (LocalDate/of year month day) date-format)]
    [:p.caption caption]
    (if video
      [:video (merge {:controls true
                      :preload "none"
                      :width "100%"}
                     (when image
                       {:poster (.getName image)}))
       [:source {:type "video/mp4"
                 :src (.getName video)}]]
      (when image [:img.photo {:src (.getName image)}]))
    [:div.comments
     (for [{:keys [details user]} comments]
       [:div.comment
        [:p details]
        [:span (:firstName user)]])]]))

(defn- archive-entry [target-dir {:keys [id caption comments day month year blobs attachmentUrl_mp4] :as entry}]
  (try
    (let [target-dir (io/file target-dir (str id))]
      (let [original-image (archive-image target-dir id (:p blobs) "")
            large-image (archive-image target-dir id (:l blobs) "_large")
            thumb-image (archive-image target-dir id (:s2 blobs) "_thumb")
            video (archive-video target-dir id attachmentUrl_mp4)
            page (archive-page target-dir id (entry-page id caption comments year month day original-image video))]

        (merge
         (select-keys entry [:id :year :month :day :caption :comments])
         {:page page
          :original-image original-image
          :thumb-image thumb-image
          :large-image large-image}
         (when video
           {:video video}))))
    (catch Exception e
      (println "Unable to archive entry" entry e))))

(defn- day-page [relative year month day entries]
  (html5
   [:div.day-page
    [:a.back {:href "../index.html"} (.format (LocalDate/of year month day) month-format)]
    [:h1.date (.format (LocalDate/of year month day) date-format)]
    [:div.entries
     (for [{:keys [page caption comments large-image video]} entries]
       [:div.entry
        [:a {:href (relative page)}
         [:h3 caption]
         (if video
           [:video (merge {:controls true
                           :preload "none"
                           :width "100%"}
                          (when large-image
                            {:poster (relative large-image)}))
            [:source {:type "video/mp4"
                      :src (relative video)}]]
           (when large-image
             [:img.photo {:src (relative large-image)}]))
         [:div.comments
          (for [{:keys [details user]} comments]
            [:div.comment
             [:p details]
             [:span (:firstName user)]])]]])]]))

(defn- relative [^File target-dir ^File target-file]
  (.relativize (.toPath target-dir) (.toPath target-file)))

(defn- archive-day [target-dir entries]
  (let [{:keys [year month day]} (first entries)
        target-dir (io/file target-dir (str day))
        archived-entries (remove nil? (pmap (partial archive-entry target-dir) (sort-by :timestamp entries)))]
    {:day day
     :page (archive-page target-dir "index" (day-page (partial relative target-dir) year month day archived-entries))
     :entries archived-entries}))

(defn- month-page [relative year month days]
  (html5
   [:div.month-page
    [:a.back {:href "../index.html"} year]
    [:h1.date (.format (LocalDate/of year month 1) month-year-format)]
    [:div.entries
     (for [{:keys [day page entries]} (sort-by :day days)
           :let [{:keys [thumb-image]} (first entries)]]
       [:div.entry
        [:a {:href (relative page)}
         [:span.date (str day)]
         (when thumb-image
           [:img.photo {:src (relative thumb-image)}])
         [:span.entry-count (count entries) " moments"]]])]]))

(defn- archive-month [target-dir entries]
  (let [{:keys [year month]} (first entries)
        target-dir (io/file target-dir (str month))
        archived-days (pmap (partial archive-day target-dir) (->> entries
                                                                  (group-by :day)
                                                                  (sort-by first)
                                                                  vals))]

    {:month month
     :page (archive-page target-dir "index" (month-page (partial relative target-dir) year month archived-days))
     :days archived-days}))

(defn- year-page [relative year months]
  (html5
   [:div.year-page
    [:a.back {:href "../index.html"} "Home"]
    [:h1.date year]
    [:div.entries
     (for [{:keys [month page days]} (sort-by :month months)
           :let [{:keys [thumb-image]} (-> days first :entries first)]]
       [:div.entry
        [:a {:href (relative page)}
         [:span.date (.format (LocalDate/of year month 1) month-format)]
         (when thumb-image
           [:img.photo {:src (relative thumb-image)}])]])]]))

(defn- archive-year [target-dir entries]
  (let [{:keys [year]} (first entries)
        target-dir (io/file target-dir (str year))
        archived-months (map (partial archive-month target-dir) (->> entries
                                                                     (group-by :month)
                                                                     (sort-by first)
                                                                     vals))]

    {:year year
     :page (archive-page target-dir "index" (year-page (partial relative target-dir) year archived-months))
     :months archived-months}))

(defn- home-page [relative baby-name dob years]
  (html5
   [:div.home-page
    [:h1 baby-name]
    [:h3 dob]
    [:div.entries
     (for [{:keys [year page months]} (sort-by :year years)
           :let [{:keys [thumb-image]} (-> months first :days first :entries first)]]
       [:div.entry
        [:a {:href (relative page)}
         [:span.date (str year)]
         (when thumb-image
           [:img.photo {:src (relative thumb-image)}])]])]]))

(defn archive
  ([target-dir api-key journal-id]
   (let [journal (fetch-journal api-key journal-id)
         child (->> journal :children first)]
     (archive
      target-dir
      (:firstName child)
      (:dob child)
      (->> (journal-shards journal)
           (mapcat (fn [entry]
                     (fetch-entries api-key journal-id entry)))
           (map (fn [{:keys [timestamp] :as entry}]
                  (assoc entry :iso-date
                         (.format (.toLocalDate (.atZone (Instant/ofEpochMilli timestamp)
                                                         (java.time.ZoneId/of "UTC")))
                                  iso-date-format))))))))
  ([target-dir baby-name dob entries]
   (println (format "Found %s entries for %s" (count entries) baby-name))
   (let [archived-years (map (partial archive-year target-dir) (->> entries
                                                                    (group-by :year)
                                                                    (sort-by first)
                                                                    vals))]

     (archive-json target-dir "source" entries)

     {:page (archive-page target-dir "index" (home-page (partial relative target-dir) baby-name dob archived-years))
      :years archived-years})))

(defn uber-page [json-path target-dir]
  (let [json (m/decode m "application/json" (slurp (io/file json-path)))
        html (html5
              [:div.uber-page
               [:div.entries
                (for [[[year month day] entries] (->> (group-by (juxt :year :month :day) json)
                                                      (sort-by first))]
                  [:div
                   [:h6 (.format (LocalDate/of year month day) iso-date-format)]
                   (for [{:keys [thumb-image id]} (sort-by :timestamp entries)]
                     [:span.entry {:style "margin: 2px;"}
                      [:a {:href (format "%s/%s/%s/%s/%s.html" year month day id id)}
                       [:img.photo {:src (format "%s/%s/%s/%s/%s_thumb.jpg" year month day id id)}]]])])]])]
    (spit (io/file target-dir "uber-page.html") html)))
