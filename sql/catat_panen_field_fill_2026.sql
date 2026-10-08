-- Catat Panen 2026: jumlah catatan (distinct fsp.id) & user (distinct user_id) yang mengisi tiap field
-- Filter: created_at (Asia/Jakarta) di tahun 2026, user aktif & fraud_flag <> '5'

WITH user_info AS (
    SELECT id
    FROM "user"
    WHERE is_active = true
      AND fraud_flag <> '5'
)

, data AS (
    SELECT
          fsp.id  AS catat_id
        , ui.id   AS user_id
        -- flag 1 = field diisi
        , ifNull(fsp.harvest_date_utc0, 0) > 0                 AS f_harvest_date
        , ifNull(fsp.ffb_total_weight, 0) > 0                  AS f_ffb_total_weight
        , ifNull(fsp.ffb_count, 0) > 0                         AS f_ffb_count
        , ifNull(fsp.fruitlet_total_weight_in_kg, 0) > 0       AS f_fruitlet_weight
        , ifNull(fsp.next_harvest_schedule_at_utc0, 0) > 0     AS f_next_harvest
        , trimBoth(ifNull(fsp.worker_name, '')) != ''          AS f_worker_name
        , ifNull(fsp.ffb_price_per_kg, 0) > 0                  AS f_ffb_price
        , trimBoth(toString(ifNull(fb.type, ''))) != ''        AS f_buyer_type
        , trimBoth(ifNull(fb.name, '')) != ''                  AS f_buyer_name
        , trimBoth(ifNull(fb.phone_no, '')) != ''              AS f_phone_buyer
        , trimBoth(ifNull(fsp.photo_url, '')) != ''            AS f_photo_url
        , ifNull(fsp.harvest_cost_per_kg, 0) > 0               AS f_upah_panen
        , ifNull(fsp.loading_cost_per_kg, 0) > 0               AS f_upah_langsir
        , ifNull(fsp.other_cost, 0) > 0                        AS f_biaya_lainnya
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
          uniqExact(catat_id)                        AS c_total
        , uniqExact(user_id)                         AS u_total

        , uniqExactIf(catat_id, f_harvest_date)      AS c_harvest_date
        , uniqExactIf(catat_id, f_ffb_total_weight)  AS c_ffb_total_weight
        , uniqExactIf(catat_id, f_ffb_count)         AS c_ffb_count
        , uniqExactIf(catat_id, f_fruitlet_weight)   AS c_fruitlet_weight
        , uniqExactIf(catat_id, f_next_harvest)      AS c_next_harvest
        , uniqExactIf(catat_id, f_worker_name)       AS c_worker_name
        , uniqExactIf(catat_id, f_ffb_price)         AS c_ffb_price
        , uniqExactIf(catat_id, f_buyer_type)        AS c_buyer_type
        , uniqExactIf(catat_id, f_buyer_name)        AS c_buyer_name
        , uniqExactIf(catat_id, f_phone_buyer)       AS c_phone_buyer
        , uniqExactIf(catat_id, f_photo_url)         AS c_photo_url
        , uniqExactIf(catat_id, f_upah_panen)        AS c_upah_panen
        , uniqExactIf(catat_id, f_upah_langsir)      AS c_upah_langsir
        , uniqExactIf(catat_id, f_biaya_lainnya)     AS c_biaya_lainnya

        , uniqExactIf(user_id, f_harvest_date)       AS u_harvest_date
        , uniqExactIf(user_id, f_ffb_total_weight)   AS u_ffb_total_weight
        , uniqExactIf(user_id, f_ffb_count)          AS u_ffb_count
        , uniqExactIf(user_id, f_fruitlet_weight)    AS u_fruitlet_weight
        , uniqExactIf(user_id, f_next_harvest)       AS u_next_harvest
        , uniqExactIf(user_id, f_worker_name)        AS u_worker_name
        , uniqExactIf(user_id, f_ffb_price)          AS u_ffb_price
        , uniqExactIf(user_id, f_buyer_type)         AS u_buyer_type
        , uniqExactIf(user_id, f_buyer_name)         AS u_buyer_name
        , uniqExactIf(user_id, f_phone_buyer)        AS u_phone_buyer
        , uniqExactIf(user_id, f_photo_url)          AS u_photo_url
        , uniqExactIf(user_id, f_upah_panen)         AS u_upah_panen
        , uniqExactIf(user_id, f_upah_langsir)       AS u_upah_langsir
        , uniqExactIf(user_id, f_biaya_lainnya)      AS u_biaya_lainnya
    FROM data
)

SELECT
      field
    , catat                                AS jumlah_catat_input
    , c_total                              AS total_catat_panen
    , round(catat * 100.0 / c_total, 2)    AS persen_catat
    , usr                                  AS jumlah_user_input
    , u_total                              AS total_user
    , round(usr * 100.0 / u_total, 2)      AS persen_user
FROM agg
ARRAY JOIN
    [ '01. harvest_date', '02. ffb_total_weight', '03. ffb_count'
    , '04. fruitlet_total_weight_in_kg', '05. next_harvest_schedule'
    , '06. worker_name', '07. ffb_price_per_kg', '08. buyer_type'
    , '09. buyer_name', '10. phone_buyer', '11. photo_url'
    , '12. upah_panen', '13. upah_langsir', '14. biaya_lainnya' ] AS field
  , [ c_harvest_date, c_ffb_total_weight, c_ffb_count
    , c_fruitlet_weight, c_next_harvest
    , c_worker_name, c_ffb_price, c_buyer_type
    , c_buyer_name, c_phone_buyer, c_photo_url
    , c_upah_panen, c_upah_langsir, c_biaya_lainnya ] AS catat
  , [ u_harvest_date, u_ffb_total_weight, u_ffb_count
    , u_fruitlet_weight, u_next_harvest
    , u_worker_name, u_ffb_price, u_buyer_type
    , u_buyer_name, u_phone_buyer, u_photo_url
    , u_upah_panen, u_upah_langsir, u_biaya_lainnya ] AS usr
ORDER BY field
