-- Distribusi jarak input catat panen (created_at - harvest_date) khusus Bulan 1
-- Day 0 = dicatat di hari yang sama dengan panen, Day +1 = H+1, ... sampai Day +30
-- Catatan: selisih dihitung signed (bukan abs). Input dengan harvest_date di masa depan
-- (selisih negatif) tidak masuk Day 0-30.

WITH user_info AS (
    SELECT DISTINCT id
    FROM sawitpro_datamart.datamart_user
    WHERE status = 'REGISTERED'
      AND user_role ILIKE '%farmer%'
)

, active_farm_owner AS (
    SELECT DISTINCT owner_id
    FROM sawitpro_datamart.dim_farm
    WHERE is_active = TRUE
)

, data AS (
    SELECT
        fsp.id AS id,
        a.owner_id AS user_id,
        toInt32(dateDiff(
            'day',
            toDate(toDateTime(intDiv(fsp.harvest_date_utc0, 1000), 'Asia/Jakarta')),
            toDate(toDateTime(intDiv(fsp.created_at_utc0, 1000), 'Asia/Jakarta'))
        )) AS selisih_hari
    FROM default.ffb_sell_price fsp
    JOIN default.farm fm ON fm.id = fsp.farm_id
    JOIN default.asset a ON a.id = fm.asset_id
    WHERE a.owner_id IN (SELECT id FROM user_info)
      AND a.owner_id IN (SELECT owner_id FROM active_farm_owner)
      -- sama seperti INNER JOIN dim_date di query segmentasi bulan
      AND toDate(toDateTime(intDiv(fsp.created_at_utc0, 1000), 'Asia/Jakarta'))
          IN (SELECT date_series FROM sawitpro_datamart.dim_date)
)

, bulan_1 AS (
    SELECT *
    FROM data
    WHERE selisih_hari BETWEEN 0 AND 30
)

, total AS (
    SELECT
        count() AS total_catat_bulan_1,
        uniqExact(user_id) AS total_farmer_bulan_1
    FROM bulan_1
)

, per_hari AS (
    SELECT
        selisih_hari,
        count() AS total_catat_panen,
        uniqExact(user_id) AS total_farmer
    FROM bulan_1
    GROUP BY selisih_hari
)

-- semua hari 0..30 tetap muncul walau tidak ada data
, days AS (
    SELECT toInt32(number) AS selisih_hari
    FROM numbers(31)
)

SELECT
    d.selisih_hari AS selisih_hari,
    if(d.selisih_hari = 0, 'Day 0 (hari yang sama)', concat('Day +', toString(d.selisih_hari))) AS label_hari,
    ph.total_catat_panen AS total_catat_panen,
    ph.total_farmer AS total_farmer_catat_panen,
    round(100 * ph.total_catat_panen / t.total_catat_bulan_1, 2) AS pct_catat_panen,
    round(100 * sum(ph.total_catat_panen) OVER (ORDER BY d.selisih_hari ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
          / t.total_catat_bulan_1, 2) AS cum_pct_catat_panen,
    round(100 * ph.total_farmer / t.total_farmer_bulan_1, 2) AS pct_farmer, -- 1 farmer bisa muncul di beberapa hari, jadi tidak dijumlah 100%
    t.total_farmer_bulan_1 AS total_farmer_unik_bulan_1 -- angka ini yang dibandingkan dengan query segmentasi, BUKAN sum(total_farmer_catat_panen)
FROM days d
LEFT JOIN per_hari ph ON ph.selisih_hari = d.selisih_hari
CROSS JOIN total t
ORDER BY d.selisih_hari
