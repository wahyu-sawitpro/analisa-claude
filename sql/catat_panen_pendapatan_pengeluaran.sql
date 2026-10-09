-- Catat Panen: total & median pendapatan / pengeluaran per user
-- pendapatan  = "FFB Price"                       (ffb_price_per_kg * ffb_total_weight)
-- pengeluaran = "Harvest cost" + "Loading cost"   ((harvest + loading cost per kg) * ffb_total_weight)

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
        f.owner_id,
        ceil(sum(f.area_hectare)) AS total_area_hectare,
        1 AS has_kebun,
        max(
            concat(toString(f.farm_lat), ', ', toString(f.farm_long)) NOT IN ('', ', ', '0, 0', '0.0, 0.0')
        ) AS has_geotag
    FROM sawitpro_datamart.dim_farm f
    WHERE f.is_active = TRUE
    GROUP BY f.owner_id
)

, data AS (
    SELECT 
        fsp.id AS id, 
        ui.id AS user_id,
        fsp.created_by AS created_by,
        ui.name AS seller_name, 
        ui.phone_no AS phone_seller, 
        toTimeZone(toDateTime(fsp.created_at_utc0 / 1000), 'Asia/Jakarta') AS created_at,
        toTimeZone(toDateTime(fsp.harvest_date_utc0 / 1000), 'Asia/Jakarta') AS harvest_date,  
        ffb_buyer.type AS buyer_type, 
        ffb_buyer.name AS buyer_name, 
        ffb_buyer.phone_no AS phone_buyer,
        fsp.seller_type, 
        fsp.currency, 
        fsp.ffb_total_weight, 
        fsp.ffb_price_per_kg, 
        fsp.harvest_cost_per_kg, 
        fsp.loading_cost_per_kg, 
        fsp.other_cost, 
        fsp.other_cost_description,
        fsp.photo_url AS photo,
        fsp.farm_id,
        CASE WHEN ffb_price_per_kg > 0 AND ffb_total_weight > 0 THEN ffb_price_per_kg * ffb_total_weight END AS "FFB Price",
        CASE WHEN harvest_cost_per_kg > 0 AND ffb_total_weight > 0 THEN harvest_cost_per_kg * ffb_total_weight END AS "Harvest cost",
        CASE WHEN loading_cost_per_kg > 0 AND ffb_total_weight > 0 THEN loading_cost_per_kg * ffb_total_weight END AS "Loading cost",
        CASE WHEN other_cost > 0 AND ffb_total_weight > 0 THEN other_cost * ffb_total_weight END AS "Other cost",
        CASE WHEN ffb_price_per_kg > 0 THEN ffb_price_per_kg END AS "Weighted FFB Price per Kg",
        CASE WHEN harvest_cost_per_kg > 0 THEN harvest_cost_per_kg END AS "Weighted Harvest cost per Kg",
        CASE WHEN loading_cost_per_kg > 0 THEN loading_cost_per_kg END AS "Weighted Loading cost per Kg",
        CASE WHEN other_cost > 0 THEN other_cost END AS "Weighted Other cost",
        COUNT(fsp.id) OVER (PARTITION BY ui.id) AS count_over_users,
        CASE 
            WHEN fsp.created_at_utc0 = FIRST_VALUE(fsp.created_at_utc0) OVER (PARTITION BY ui.id ORDER BY fsp.created_at_utc0) 
            THEN 1 ELSE 0 
        END AS note_first,
        toStartOfMonth(toTimeZone(toDateTime(FIRST_VALUE(fsp.created_at_utc0) OVER (PARTITION BY ui.id ORDER BY fsp.created_at_utc0) / 1000), 'Asia/Jakarta')) AS first_month,
        (
            (toYear(toStartOfMonth(toTimeZone(toDateTime(fsp.created_at_utc0 / 1000), 'Asia/Jakarta'))) -
             toYear(toStartOfMonth(toTimeZone(toDateTime(FIRST_VALUE(fsp.created_at_utc0) OVER (PARTITION BY ui.id ORDER BY fsp.created_at_utc0) / 1000), 'Asia/Jakarta')))) * 12
            +
            (toMonth(toStartOfMonth(toTimeZone(toDateTime(fsp.created_at_utc0 / 1000), 'Asia/Jakarta'))) -
             toMonth(toStartOfMonth(toTimeZone(toDateTime(FIRST_VALUE(fsp.created_at_utc0) OVER (PARTITION BY ui.id ORDER BY fsp.created_at_utc0) / 1000), 'Asia/Jakarta'))))
        ) AS month_diff,
        ROW_NUMBER() OVER (PARTITION BY a.owner_id ORDER BY fsp.created_at_utc0) AS seqno,
        toStartOfMonth(toTimeZone(toDateTime(fsp.created_at_utc0 / 1000), 'Asia/Jakarta')) AS months,
        toStartOfYear(toTimeZone(toDateTime(fsp.created_at_utc0 / 1000), 'Asia/Jakarta')) AS years
    FROM default.ffb_sell_price fsp
    INNER JOIN sawitpro_datamart.dim_date dd ON dd.date_series = date(toTimeZone(toDateTime(fsp.created_at_utc0 / 1000), 'Asia/Jakarta'))
    JOIN default.farm fm ON fm.id = fsp.farm_id
    JOIN default.asset a ON a.id = fm.asset_id
    JOIN user_info ui ON a.owner_id = ui.id
    JOIN data_farm df ON ui.id = df.owner_id
    LEFT JOIN default.ffb_buyer ON fsp.buyer_id = ffb_buyer.id
    WHERE 1=1
)

, user_catat_panen AS (
    SELECT 
        user_id,
        1 AS has_catat_panen,
        sum(ffb_total_weight) AS user_total_ffb_weight,
        sum("FFB Price") AS user_total_pendapatan,
        -- ifNull supaya catatan yang hanya isi salah satu biaya tetap terhitung
        sum(ifNull("Harvest cost", 0) + ifNull("Loading cost", 0)) AS user_total_pengeluaran
    FROM data
    GROUP BY user_id
)

, summary_user AS (
    SELECT 
        sum(ucp.user_total_ffb_weight) AS total_ffb_weight,
        avgIf(ucp.user_total_ffb_weight, ucp.has_catat_panen = 1) AS avg_ffb_weight_per_user,
        medianExactIf(ucp.user_total_ffb_weight, ucp.has_catat_panen = 1) AS median_ffb_weight_per_user,

        sum(ucp.user_total_pendapatan) AS total_pendapatan,
        sum(ucp.user_total_pengeluaran) AS total_pengeluaran,
        medianExactIf(ucp.user_total_pendapatan, ucp.has_catat_panen = 1 AND ucp.user_total_pendapatan > 0) AS median_pendapatan_per_user,
        medianExactIf(ucp.user_total_pengeluaran, ucp.has_catat_panen = 1 AND ucp.user_total_pengeluaran > 0) AS median_pengeluaran_per_user
    FROM user_info ui
    LEFT JOIN data_farm df ON ui.id = df.owner_id
    LEFT JOIN user_catat_panen ucp ON ui.id = ucp.user_id
)

SELECT * FROM summary_user
