-- =====================================================================
-- SUMMARY: dari petani (role FARMER) yang REGISTERED 8 minggu terakhir,
-- berapa yang diakuisisi duta & berapa yang duta-nya punya Area Manager.
-- Per minggu register + baris TOTAL. Detail per petani:
-- smallholders_farmer_register_area_manager_last_8_weeks.sql
--
-- CTE & definisi sama dengan file detail. Akun test (AM Fauzy / nama
-- petani atau duta mengandung 'test') dikeluarkan; hapus baris
-- `WHERE NOT is_test_account` kalau mau ikut dihitung.
-- =====================================================================
WITH
    toMonday(toDate(now('Asia/Jakarta'))) - INTERVAL 7 WEEK AS period_start,
    toDate(now('Asia/Jakarta')) + 1                         AS period_end,

    farmers AS (
        SELECT
            id,
            name,
            created_at_utc7
        FROM sawitpro_datamart.datamart_user
        WHERE status = 'REGISTERED'
          AND user_role ILIKE '%FARMER%'
          AND toDate(created_at_utc7) >= period_start
          AND toDate(created_at_utc7) <  period_end
        LIMIT 1 BY id
    ),

    unique_leads AS (
        SELECT
            ambassador_user_id,
            leads_user_id
        FROM ambassador_leads
        WHERE status IN ('SALE', 'LEADS')
          AND leads_user_id IN (SELECT id FROM farmers)
        ORDER BY leads_user_id, updated_at_utc0 DESC
        LIMIT 1 BY leads_user_id
    ),

    unique_kyc AS (
        SELECT
            user_id,
            updated_by
        FROM ambassador_kyc
        WHERE status = 'VERIFIED'
          AND user_id IN (SELECT ambassador_user_id FROM unique_leads)
        ORDER BY user_id, created_at_utc0 ASC
        LIMIT 1 BY user_id
    ),

    base AS (
        SELECT
            f.id                                         AS farmer_id,
            toMonday(f.created_at_utc7)                  AS join_week_farmer,
            ifNull(toString(al.leads_user_id), '') != '' AS has_duta,
            trim(ifNull(u_am.name, '')) != ''            AS has_am,
            ifNull(u_am.name, '') = 'Fauzy Nurazhari Pane'
                OR f.name ILIKE '%test%'
                OR ifNull(u_duta.name, '') ILIKE '%test%' AS is_test_account
        FROM farmers AS f
        LEFT JOIN unique_leads AS al     ON al.leads_user_id = f.id
        LEFT JOIN default.user AS u_duta ON u_duta.id        = al.ambassador_user_id
        LEFT JOIN unique_kyc   AS ak     ON ak.user_id       = al.ambassador_user_id
        LEFT JOIN default.user AS u_am   ON u_am.id          = ak.updated_by
    )

SELECT
    if(grouping(join_week_farmer) = 1, 'TOTAL', toString(join_week_farmer)) AS minggu_register,

    countDistinct(farmer_id)                            AS total_petani_register,
    countDistinctIf(farmer_id, has_duta)                AS petani_ada_duta,
    countDistinctIf(farmer_id, has_duta AND has_am)     AS petani_ada_duta_dan_am,
    countDistinctIf(farmer_id, has_duta AND NOT has_am) AS petani_ada_duta_tanpa_am,
    countDistinctIf(farmer_id, NOT has_duta)            AS petani_tanpa_duta,

    round(petani_ada_duta        / total_petani_register * 100, 1) AS pct_ada_duta,
    round(petani_ada_duta_dan_am / total_petani_register * 100, 1) AS pct_ada_am

FROM base
WHERE NOT is_test_account
GROUP BY ROLLUP(join_week_farmer)
ORDER BY grouping(join_week_farmer), join_week_farmer DESC
