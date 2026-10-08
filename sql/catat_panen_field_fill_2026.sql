-- Catat Panen 2026: jumlah catatan unik (distinct fsp.id) yang mengisi tiap field
-- Filter: created_at (Asia/Jakarta) di tahun 2026, user aktif & fraud_flag <> '5'

WITH user_info AS (
    SELECT id
    FROM "user"
    WHERE is_active = true
      AND fraud_flag <> '5'
)

, data AS (
    SELECT
          fsp.id                            AS catat_id
        , fsp.harvest_date_utc0             AS harvest_date_utc0
        , fsp.ffb_total_weight              AS ffb_total_weight
        , fsp.ffb_count                     AS ffb_count
        , fsp.fruitlet_total_weight_in_kg   AS fruitlet_total_weight_in_kg
        , fsp.next_harvest_schedule_at_utc0 AS next_harvest_schedule_at_utc0
        , fsp.buyer_name                    AS worker_name   -- dulu page_one_buyer_name
        , fsp.ffb_price_per_kg              AS ffb_price_per_kg
        , fb.type                           AS buyer_type
        , fb.name                           AS buyer_name_master
        , fb.phone_no                       AS phone_buyer
        , fsp.photo_url                     AS photo_url
        , fsp.cost_per_ffb                  AS upah_panen
        , fsp.salary_cost                   AS upah_langsir
        , fsp.total_cost                    AS biaya_lainnya
    FROM default.ffb_sell_price fsp
    JOIN default.farm  fm ON fm.id = fsp.farm_id
    JOIN default.asset a  ON a.id  = fm.asset_id
    JOIN user_info     ui ON ui.id = a.owner_id
    LEFT JOIN default.ffb_buyer fb ON fb.id = fsp.buyer_id
    WHERE fsp.created_at_utc0 >= toUnixTimestamp(toDateTime('2026-01-01 00:00:00', 'Asia/Jakarta')) * 1000
      AND fsp.created_at_utc0 <  toUnixTimestamp(toDateTime('2027-01-01 00:00:00', 'Asia/Jakarta')) * 1000
)

, agg AS (
    SELECT
          uniqExact(catat_id)                                                     AS u_total
        , uniqExactIf(catat_id, ifNull(harvest_date_utc0, 0) > 0)                 AS u_harvest_date
        , uniqExactIf(catat_id, ifNull(ffb_total_weight, 0) > 0)                  AS u_ffb_total_weight
        , uniqExactIf(catat_id, ifNull(ffb_count, 0) > 0)                         AS u_ffb_count
        , uniqExactIf(catat_id, ifNull(fruitlet_total_weight_in_kg, 0) > 0)       AS u_fruitlet_weight
        , uniqExactIf(catat_id, ifNull(next_harvest_schedule_at_utc0, 0) > 0)     AS u_next_harvest
        , uniqExactIf(catat_id, trimBoth(ifNull(worker_name, '')) != '')          AS u_worker_name
        , uniqExactIf(catat_id, ifNull(ffb_price_per_kg, 0) > 0)                  AS u_ffb_price
        , uniqExactIf(catat_id, trimBoth(toString(ifNull(buyer_type, ''))) != '') AS u_buyer_type
        , uniqExactIf(catat_id, trimBoth(ifNull(buyer_name_master, '')) != '')    AS u_buyer_name
        , uniqExactIf(catat_id, trimBoth(ifNull(phone_buyer, '')) != '')          AS u_phone_buyer
        , uniqExactIf(catat_id, trimBoth(ifNull(photo_url, '')) != '')            AS u_photo_url
        , uniqExactIf(catat_id, ifNull(upah_panen, 0) > 0)                        AS u_upah_panen
        , uniqExactIf(catat_id, ifNull(upah_langsir, 0) > 0)                      AS u_upah_langsir
        , uniqExactIf(catat_id, ifNull(biaya_lainnya, 0) > 0)                     AS u_biaya_lainnya
    FROM data
)

SELECT
      field
    , users                             AS jumlah_catat_input
    , u_total                           AS total_catat_panen
    , round(users * 100.0 / u_total, 2) AS persen
FROM agg
ARRAY JOIN
    [ '01. harvest_date', '02. ffb_total_weight', '03. ffb_count'
    , '04. fruitlet_total_weight_in_kg', '05. next_harvest_schedule'
    , '06. worker_name', '07. ffb_price_per_kg', '08. buyer_type'
    , '09. buyer_name', '10. phone_buyer', '11. photo_url'
    , '12. upah_panen', '13. upah_langsir', '14. biaya_lainnya' ] AS field
  , [ u_harvest_date, u_ffb_total_weight, u_ffb_count
    , u_fruitlet_weight, u_next_harvest
    , u_worker_name, u_ffb_price, u_buyer_type
    , u_buyer_name, u_phone_buyer, u_photo_url
    , u_upah_panen, u_upah_langsir, u_biaya_lainnya ] AS users
ORDER BY field
