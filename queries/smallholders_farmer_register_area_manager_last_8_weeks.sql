-- =====================================================================
-- (2) LIST per farmer dari summary
-- (smallholders_farmer_register_area_manager_summary_last_8_weeks.sql).
-- CTE sama persis, jadi jumlah baris per minggu_register = akuisisi_farmer.
-- Definisi (mengikuti 2 query panduan):
--   * Akuisisi farmer  = datamart_user REGISTERED, is_active, role FARMER
--                        (sama dengan query target akuisisi farmer)
--   * Under duta       = leads TERBARU farmer di ambassador_leads
--                        berstatus SALE / LEADS (sama dengan query track
--                        akuisisi farmer by duta)
--   * Area manager     = CASE area_manager dari query track by duta
--   * Periode          = Senin 7 minggu lalu s/d hari ini (8 minggu,
--                        Asia/Jakarta), berdasar tanggal register farmer
--   * Akun test TIDAK dibuang (versi sebelumnya membuang, ini salah satu
--     penyebab farmer hilang); ditandai lewat is_test_duta / kolom test.
-- =====================================================================
WITH
    toMonday(toDate(now('Asia/Jakarta'))) - INTERVAL 7 WEEK AS period_start,
    toDate(now('Asia/Jakarta')) + 1                         AS period_end,

    -- Akuisisi farmer: definisi sama dengan query target akuisisi
    -- (datamart_user REGISTERED + is_active + role FARMER)
    farmers AS (
        SELECT id, name, phone_no, created_at_utc7, referral_utm, utm_source, user_role
        FROM sawitpro_datamart.datamart_user
        WHERE status = 'REGISTERED'
          AND is_active = TRUE
          AND user_role ILIKE '%FARMER%'
          AND user_role ILIKE '%estate%'
          AND toDate(created_at_utc7) >= period_start
          AND toDate(created_at_utc7) <  period_end
        LIMIT 1 BY id
    ),

    -- Leads TERBARU per farmer (apa pun statusnya), baru setelah itu
    -- dicek SALE/LEADS -- sama dengan query track akuisisi by duta
    latest_leads AS (
        SELECT ambassador_user_id, leads_user_id, status
        FROM ambassador_leads
        WHERE leads_user_id IN (SELECT id FROM farmers)
        ORDER BY leads_user_id, updated_at_utc0 DESC
        LIMIT 1 BY leads_user_id
    ),

    -- UTM dari event app. Tabel event = banyak baris per user, jadi
    -- diringkas 1 baris per user (ambil nilai yang tidak kosong) supaya
    -- farmer tidak dobel.
    event_utm AS (
        SELECT
            user_id,
            anyIf(utm_source_name,           ifNull(utm_source_name, '') != '')           AS utm_source_name,
            anyIf(stslc_utm_campaign,        ifNull(stslc_utm_campaign, '') != '')        AS stslc_utm_campaign,
            anyIf(stslc_utm_source_platform, ifNull(stslc_utm_source_platform, '') != '') AS stslc_utm_source_platform
        FROM flatten_eventapp_raw
        WHERE user_id IN (SELECT id FROM farmers)
        GROUP BY user_id
    ),

    unique_kyc AS (
        SELECT user_id, updated_by,
               toDateTime(toInt64(created_at_utc0) / 1000) + INTERVAL 7 HOUR AS join_date_duta
        FROM ambassador_kyc
        WHERE status = 'VERIFIED'
        ORDER BY user_id, created_at_utc0 ASC
        LIMIT 1 BY user_id
    ),

    base AS (
        SELECT
            f.id                         AS farmer_id,
            f.name                       AS farmer_name,
            f.phone_no                   AS farmer_phone,
            f.created_at_utc7            AS join_date_farmer,
            f.referral_utm               AS referral_utm,
            f.utm_source                 AS utm_source,
            ev.utm_source_name           AS utm_source_name,
            ev.stslc_utm_campaign        AS stslc_utm_campaign,
            ev.stslc_utm_source_platform AS stslc_utm_source_platform,
            toMonday(f.created_at_utc7)  AS join_week_farmer,
            ifNull(al.status, '')        AS status_under_duta,
            status_under_duta IN ('SALE', 'LEADS') AS under_duta,
            u_duta.id                    AS duta_id,
            u_duta.name                  AS duta_name,
            u_duta.phone_no              AS duta_phone,
            ak.join_date_duta            AS join_date_duta,
            f.user_role                  AS user_role,
            -- sama dengan CASE area_manager di query track akuisisi by duta
            multiIf(
                ifNull(u_am.name, '') = 'Fauzy Nurazhari Pane', 'Fauzy Nur Azhari Pane Test',
                ifNull(u_duta.name, '') ILIKE '%test%',          u_duta.name,
                ifNull(trim(u_am.name), '') != '',               u_am.name,
                NULL
            ) AS area_manager,
            ifNull(u_am.name, '') = 'Fauzy Nurazhari Pane'
                OR ifNull(u_duta.name, '') ILIKE '%test%' AS is_test_duta
        FROM farmers AS f
        LEFT JOIN latest_leads AS al     ON al.leads_user_id = f.id
        LEFT JOIN event_utm    AS ev     ON ev.user_id       = f.id
        LEFT JOIN default.user AS u_duta ON u_duta.id        = al.ambassador_user_id
        LEFT JOIN unique_kyc   AS ak     ON ak.user_id       = al.ambassador_user_id
        LEFT JOIN default.user AS u_am   ON u_am.id          = ak.updated_by
    )

SELECT DISTINCT
    join_week_farmer AS minggu_register,
    if(under_duta, 'Under Duta', 'Non Duta') AS akuisisi_type,
    farmer_id,
    farmer_name,
    farmer_phone,
    join_date_farmer,
    user_role,
    referral_utm,
    utm_source,
    nullIf(utm_source_name, '')           AS utm_source_name,
    nullIf(stslc_utm_campaign, '')        AS stslc_utm_campaign,
    nullIf(stslc_utm_source_platform, '') AS stslc_utm_source_platform,
    nullIf(status_under_duta, '')   AS status_under_duta,
    if(under_duta, duta_id, NULL)   AS duta_id,
    if(under_duta, duta_name, NULL) AS duta_name,
    if(under_duta, duta_phone, NULL) AS duta_phone,
    if(under_duta, join_date_duta, NULL) AS join_date_duta,
    if(under_duta, area_manager, NULL)   AS area_manager,
    under_duta AND is_test_duta     AS is_test_duta
FROM base
ORDER BY join_date_farmer DESC
