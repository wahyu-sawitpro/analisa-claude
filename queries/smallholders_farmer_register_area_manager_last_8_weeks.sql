-- =====================================================================
-- (2) LIST per petani dari summary
-- (smallholders_farmer_register_area_manager_summary_last_8_weeks.sql).
-- CTE & filter sama persis, jadi countDistinct(farmer_id) per
-- minggu_register + acquisition_status = angka di summary.
-- Petani (role FARMER) REGISTERED 8 minggu terakhir (Senin 7 minggu lalu
-- s/d hari ini, Asia/Jakarta). Duta = punya leads SALE/LEADS; AM = updated_by
-- KYC VERIFIED duta. Akun test (AM Fauzy / nama petani atau duta mengandung
-- 'test') dikeluarkan; hapus `WHERE NOT is_test_account` kalau mau ikut.
-- =====================================================================
WITH
    toMonday(toDate(now('Asia/Jakarta'))) - INTERVAL 7 WEEK AS period_start,
    toDate(now('Asia/Jakarta')) + 1                         AS period_end,

    farmers AS (
        SELECT id, name, phone_no, utm_source, created_at_utc7
        FROM sawitpro_datamart.datamart_user
        WHERE status = 'REGISTERED'
          AND user_role ILIKE '%FARMER%'
          AND toDate(created_at_utc7) >= period_start
          AND toDate(created_at_utc7) <  period_end
        LIMIT 1 BY id
    ),

    unique_leads AS (
        SELECT ambassador_user_id, leads_user_id, status
        FROM ambassador_leads
        WHERE status IN ('SALE', 'LEADS')
          AND leads_user_id IN (SELECT id FROM farmers)
        ORDER BY leads_user_id, updated_at_utc0 DESC
        LIMIT 1 BY leads_user_id
    ),

    unique_kyc AS (
        SELECT user_id, updated_by
        FROM ambassador_kyc
        WHERE status = 'VERIFIED'
          AND user_id IN (SELECT ambassador_user_id FROM unique_leads)
        ORDER BY user_id, created_at_utc0 ASC
        LIMIT 1 BY user_id
    ),

    base AS (
        SELECT
            f.id                                         AS farmer_id,
            f.name                                       AS farmer_name,
            f.phone_no                                   AS farmer_phone,
            f.utm_source                                 AS utm_source,
            f.created_at_utc7                            AS join_date_farmer,
            toMonday(f.created_at_utc7)                  AS join_week_farmer,
            ifNull(toString(al.leads_user_id), '') != '' AS has_duta,
            trim(ifNull(u_am.name, '')) != ''            AS has_am,
            al.status                                    AS status_under_duta,
            u_duta.id                                    AS duta_id,
            u_duta.name                                  AS duta_name,
            u_duta.phone_no                              AS duta_phone,
            u_am.name                                    AS area_manager,
            ifNull(u_am.name, '') = 'Fauzy Nurazhari Pane'
                OR f.name ILIKE '%test%'
                OR ifNull(u_duta.name, '') ILIKE '%test%' AS is_test_account
        FROM farmers AS f
        LEFT JOIN unique_leads AS al     ON al.leads_user_id = f.id
        LEFT JOIN default.user AS u_duta ON u_duta.id        = al.ambassador_user_id
        LEFT JOIN unique_kyc   AS ak     ON ak.user_id       = al.ambassador_user_id
        LEFT JOIN default.user AS u_am   ON u_am.id          = ak.updated_by
    )

SELECT DISTINCT
    join_week_farmer AS minggu_register,
    multiIf(
        has_duta AND has_am, 'Ada Duta & AM',
        has_duta,            'Ada Duta, Tanpa AM',
                             'Tanpa Duta'
    ) AS acquisition_status,
    farmer_id,
    farmer_name,
    farmer_phone,
    utm_source,
    join_date_farmer,
    if(has_duta, status_under_duta, NULL) AS status_under_duta,
    if(has_duta, duta_id, NULL)           AS duta_id,
    if(has_duta, duta_name, NULL)         AS duta_name,
    if(has_duta, duta_phone, NULL)        AS duta_phone,
    if(has_am, area_manager, NULL)        AS area_manager
FROM base
WHERE NOT is_test_account
ORDER BY join_date_farmer DESC
