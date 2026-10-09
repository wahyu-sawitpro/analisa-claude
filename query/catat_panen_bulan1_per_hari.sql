-- Breakdown Bulan 1 (0-30 hari) per hari, definisi sama persis dengan query segmentasi bulan:
-- join, filter, dan selisih_hari pakai abs() seperti query 1.
-- Day 0 = dicatat di hari yang sama dengan panen, Day +1 = selisih 1 hari, ... sampai Day +30

WITH user_info AS (
    SELECT DISTINCT
        id,
        name,
        phone_no,
        user_role
    FROM sawitpro_datamart.datamart_user
    WHERE status = 'REGISTERED'
      AND user_role ILIKE '%farmer%'
)

, data_farm AS (
    SELECT
        f.owner_id
    FROM sawitpro_datamart.dim_farm f
    WHERE f.is_active = TRUE
    GROUP BY f.owner_id
)

, data AS (
    SELECT
        fsp.id AS id,
        ui.id AS user_id,
        abs(dateDiff(
            'day',
            date(toTimeZone(toDateTime(fsp.harvest_date_utc0 / 1000), 'Asia/Jakarta')),
            date(toTimeZone(toDateTime(fsp.created_at_utc0 / 1000), 'Asia/Jakarta'))
        )) AS selisih_hari
    FROM default.ffb_sell_price fsp
    INNER JOIN sawitpro_datamart.dim_date dd ON dd.date_series = date(toTimeZone(toDateTime(fsp.created_at_utc0 / 1000), 'Asia/Jakarta'))
    JOIN default.farm fm ON fm.id = fsp.farm_id
    JOIN default.asset a ON a.id = fm.asset_id
    JOIN user_info ui ON a.owner_id = ui.id
    JOIN data_farm df ON ui.id = df.owner_id
    LEFT JOIN default.ffb_buyer ON fsp.buyer_id = ffb_buyer.id
    WHERE 1=1
)

, bulan_1 AS (
    SELECT *
    FROM data
    WHERE selisih_hari BETWEEN 0 AND 30
)

-- tiap farmer hanya masuk ke 1 hari: hari yang paling sering dia pakai
-- (kalau seri, ambil hari yang paling kecil), jadi jumlah Day 0..30 = total farmer Bulan 1
, farmer_day AS (
    SELECT
        user_id,
        argMax(selisih_hari, (cnt, -selisih_hari)) AS selisih_hari
    FROM (
        SELECT user_id, toInt64(selisih_hari) AS selisih_hari, count(id) AS cnt
        FROM bulan_1
        GROUP BY user_id, selisih_hari
    )
    GROUP BY user_id
)

, per_hari AS (
    SELECT selisih_hari, count() AS total_farmer
    FROM farmer_day
    GROUP BY selisih_hari
)

-- semua hari 0..30 tetap muncul walau tidak ada data
, days AS (
    SELECT toInt64(number) AS selisih_hari
    FROM numbers(31)
)

SELECT
    d.selisih_hari AS selisih_hari,
    if(d.selisih_hari = 0, 'Day 0 (hari yang sama)', concat('Day +', toString(d.selisih_hari))) AS label_hari,
    ph.total_farmer AS total_farmer
FROM days d
LEFT JOIN per_hari ph ON ph.selisih_hari = d.selisih_hari
ORDER BY d.selisih_hari
