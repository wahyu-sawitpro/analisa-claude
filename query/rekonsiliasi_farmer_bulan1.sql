-- Cek kenapa jumlah farmer Bulan 1 beda antara query segmentasi bulan dan query per hari
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
        a.owner_id AS user_id,
        toDate(toDateTime(intDiv(fsp.created_at_utc0, 1000), 'Asia/Jakarta')) AS created_date,
        toInt32(dateDiff(
            'day',
            toDate(toDateTime(intDiv(fsp.harvest_date_utc0, 1000), 'Asia/Jakarta')),
            created_date
        )) AS selisih_hari
    FROM default.ffb_sell_price fsp
    JOIN default.farm fm ON fm.id = fsp.farm_id
    JOIN default.asset a ON a.id = fm.asset_id
    WHERE a.owner_id IN (SELECT id FROM user_info)
      AND a.owner_id IN (SELECT owner_id FROM active_farm_owner)
)

, per_hari AS (
    SELECT selisih_hari, uniqExact(user_id) AS farmer
    FROM data
    WHERE selisih_hari BETWEEN 0 AND 30
      AND created_date IN (SELECT date_series FROM sawitpro_datamart.dim_date)
    GROUP BY selisih_hari
)

SELECT
    -- 1. definisi query segmentasi bulan (abs + filter dim_date) -> harusnya = 30414
    (SELECT uniqExact(user_id) FROM data
     WHERE abs(selisih_hari) BETWEEN 0 AND 30
       AND created_date IN (SELECT date_series FROM sawitpro_datamart.dim_date)) AS farmer_abs_dimdate,
    -- 2. definisi query per hari (signed, Day 0..30) + filter dim_date
    (SELECT uniqExact(user_id) FROM data
     WHERE selisih_hari BETWEEN 0 AND 30
       AND created_date IN (SELECT date_series FROM sawitpro_datamart.dim_date)) AS farmer_signed_dimdate,
    -- 3. sama dengan no.2 tapi tanpa filter dim_date
    (SELECT uniqExact(user_id) FROM data
     WHERE selisih_hari BETWEEN 0 AND 30) AS farmer_signed_tanpa_dimdate,
    -- 4. kalau total_farmer per hari dijumlah (SALAH: farmer terhitung berkali-kali)
    (SELECT sum(farmer) FROM per_hari) AS sum_farmer_per_hari
