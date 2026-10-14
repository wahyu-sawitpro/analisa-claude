-- =====================================================================
-- DETAIL: Petani (role FARMER) yang REGISTERED 8 minggu terakhir,
-- beserta duta yang mengakuisisi & Area Manager (AM) duta tersebut.
-- Ringkasan jumlahnya: smallholders_farmer_register_area_manager_summary_last_8_weeks.sql
--
-- Rentang: Senin 7 minggu lalu s/d hari ini (8 minggu kalender,
-- termasuk minggu berjalan, Asia/Jakarta). Kalau hanya mau minggu
-- yang sudah selesai, geser keduanya 1 minggu ke belakang.
--
-- Alur:
--   petani register (base, SEMUA petani tetap muncul)
--     -> ambassador_leads SALE/LEADS  = diakuisisi duta
--     -> ambassador_kyc VERIFIED duta -> updated_by = AM
--
-- Kategori `acquisition_status`:
--   'Ada Duta & AM'      : diakuisisi duta, duta punya AM
--   'Ada Duta, Tanpa AM' : diakuisisi duta, AM duta tidak ketemu
--   'Tanpa Duta'         : register sendiri (tidak ada leads)
--
-- Catatan:
--   * Semua join LEFT JOIN supaya petani tanpa duta tetap terhitung.
--   * Cek "ada / tidak ada join" pakai ifNull(toString(..), '') != ''
--     supaya benar baik join_use_nulls = 0 (default '') maupun 1 (NULL).
--   * `is_test_account` = AM Fauzy (akun test) atau nama petani/duta
--     mengandung 'test'. Tidak dibuang di sini, difilter di summary.
-- =====================================================================
WITH
    toMonday(toDate(now('Asia/Jakarta'))) - INTERVAL 7 WEEK AS period_start,
    toDate(now('Asia/Jakarta')) + 1                         AS period_end,

    -- Petani: user REGISTERED dengan role FARMER, register dalam periode
    farmers AS (
        SELECT
            id,
            name,
            phone_no,
            utm_source,
            created_at_utc7
        FROM sawitpro_datamart.datamart_user
        WHERE status = 'REGISTERED'
          AND user_role ILIKE '%FARMER%'
          AND toDate(created_at_utc7) >= period_start
          AND toDate(created_at_utc7) <  period_end
        LIMIT 1 BY id
    ),

    -- Leads terbaru per petani (SALE / LEADS) = petani diakuisisi duta
    unique_leads AS (
        SELECT
            ambassador_user_id,
            leads_user_id,
            status
        FROM ambassador_leads
        WHERE status IN ('SALE', 'LEADS')
          AND leads_user_id IN (SELECT id FROM farmers)
        ORDER BY leads_user_id, updated_at_utc0 DESC
        LIMIT 1 BY leads_user_id
    ),

    -- KYC VERIFIED pertama per duta (updated_by = AM yang verifikasi)
    unique_kyc AS (
        SELECT
            user_id,
            updated_by,
            toDateTime(toInt64(created_at_utc0) / 1000, 'Asia/Jakarta') AS join_date_duta
        FROM ambassador_kyc
        WHERE status = 'VERIFIED'
          AND user_id IN (SELECT ambassador_user_id FROM unique_leads)
        ORDER BY user_id, created_at_utc0 ASC
        LIMIT 1 BY user_id
    )

SELECT DISTINCT
    f.id                       AS farmer_id,
    f.name                     AS farmer_name,
    f.phone_no                 AS farmer_phone,
    f.utm_source               AS utm_source,
    f.created_at_utc7          AS join_date_farmer,
    toMonday(f.created_at_utc7) AS join_week_farmer,

    ifNull(toString(al.leads_user_id), '') != '' AS has_duta,
    nullIf(trim(ifNull(u_am.name, '')), '')      AS area_manager,
    area_manager IS NOT NULL                     AS has_am,

    multiIf(
        has_duta AND has_am, 'Ada Duta & AM',
        has_duta,            'Ada Duta, Tanpa AM',
                             'Tanpa Duta'
    ) AS acquisition_status,

    if(has_duta, al.status, NULL)         AS status_under_duta,
    if(has_duta, u_duta.id, NULL)         AS duta_id,
    if(has_duta, u_duta.name, NULL)       AS duta_name,
    if(has_duta, u_duta.phone_no, NULL)   AS duta_phone,
    if(has_am,   ak.join_date_duta, NULL) AS join_date_duta,

    ifNull(u_am.name, '') = 'Fauzy Nurazhari Pane'
        OR f.name ILIKE '%test%'
        OR ifNull(duta_name, '') ILIKE '%test%' AS is_test_account

FROM farmers AS f
LEFT JOIN unique_leads AS al     ON al.leads_user_id = f.id
LEFT JOIN default.user AS u_duta ON u_duta.id        = al.ambassador_user_id
LEFT JOIN unique_kyc   AS ak     ON ak.user_id       = al.ambassador_user_id
LEFT JOIN default.user AS u_am   ON u_am.id          = ak.updated_by

ORDER BY join_date_farmer DESC
