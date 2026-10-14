-- =====================================================================
-- Funnel onboarding farmer PetaniApp:
--   1. Buka Home      -> farmer REGISTERED yang punya event home_open /
--                        home_success di periode {{time_range}}
--   2. Input Kebun    -> dari step 1, yang punya kebun aktif (luas > 0)
--   3. Input Geotag   -> dari step 2, yang kebunnya punya geotag valid
--   4. KYC Verified   -> dari step 3, yang dokumen KYC-nya VERIFIED
-- Setiap step adalah subset step sebelumnya (kumulatif), jadi angkanya
-- selalu turun. Status kebun / geotag / KYC = kondisi saat ini (snapshot),
-- yang dibatasi {{time_range}} hanya event buka home.
-- {{time_range}} = field filter Metabase ke sawitpro_datamart.dim_date.date_series.
-- Output per baris step (siap dipakai visualisasi Funnel di Metabase).
-- TANPA pembungkus `SELECT ... FROM (...) AS source` (gagal di ClickHouse 24.4).
-- =====================================================================
WITH
    data_farm AS (
        SELECT
            f.owner_id,
            ceil(sum(f.area_hectare)) AS total_area_hectare,
            max(
                concat(toString(f.farm_lat), ', ', toString(f.farm_long)) NOT IN ('', ', ', '0, 0', '0.0, 0.0')
            ) AS has_geotag
        FROM sawitpro_datamart.dim_farm f
        WHERE f.is_active = TRUE
        GROUP BY f.owner_id
    ),

    user_kyc AS (
        SELECT DISTINCT
            user_id,
            1 AS is_kyc_verified
        FROM user_kyc_documents
        WHERE user_id IS NOT NULL
          AND user_id != ''
          AND status = 'VERIFIED'
    ),

    data_user AS (
        SELECT id
        FROM sawitpro_datamart.datamart_user
        WHERE status = 'REGISTERED'
          AND user_role ILIKE '%farmer%'
    ),

    -- user yang buka home PetaniApp di periode terpilih (1 baris per user)
    home_user AS (
        SELECT DISTINCT fe.user_id
        FROM default.flatten_eventapp_raw fe
        INNER JOIN sawitpro_datamart.dim_date dd ON dd.date_series = toDate(fe.event_time)
        WHERE fe.app_type = 'petaniapp'
          AND fe.user_id IS NOT NULL
          AND fe.user_id <> 'Guest'
          AND fe.event_name IN ('home_open', 'home_success')
          AND {{time_range}}
    ),

    funnel_agg AS (
        SELECT
            uniqExact(du.id) AS step1_buka_home,
            uniqExactIf(du.id, df.total_area_hectare > 0) AS step2_input_kebun,
            uniqExactIf(du.id, df.total_area_hectare > 0 AND df.has_geotag = 1) AS step3_input_geotag,
            uniqExactIf(du.id, df.total_area_hectare > 0 AND df.has_geotag = 1 AND uk.is_kyc_verified = 1) AS step4_kyc_verified
        FROM data_user du
        INNER JOIN home_user hu
            ON du.id = hu.user_id
        LEFT JOIN data_farm df
            ON du.id = df.owner_id
        LEFT JOIN user_kyc uk
            ON du.id = uk.user_id
    )

SELECT
    tupleElement(s, 1) AS step_order,
    tupleElement(s, 2) AS step,
    tupleElement(s, 3) AS total_farmer,
    round(100 * tupleElement(s, 3) / nullIf(step1_buka_home, 0), 2) AS pct_dari_buka_home,
    round(100 * tupleElement(s, 3) / nullIf(tupleElement(s, 4), 0), 2) AS pct_dari_step_sebelumnya
FROM funnel_agg
ARRAY JOIN [
    (1, '1. Buka Home',    step1_buka_home,    step1_buka_home),
    (2, '2. Input Kebun',  step2_input_kebun,  step1_buka_home),
    (3, '3. Input Geotag', step3_input_geotag, step2_input_kebun),
    (4, '4. KYC Verified', step4_kyc_verified, step3_input_geotag)
] AS s
ORDER BY step_order
