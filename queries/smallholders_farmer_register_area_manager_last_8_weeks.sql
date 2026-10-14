-- =====================================================================
-- Farmer REGISTERED 8 minggu terakhir + Area Manager (AM)-nya
-- Tujuan: memisahkan farmer register yang ada AM vs yang tidak ada AM.
--
-- Rentang: Senin 8 minggu lalu s/d sekarang (Asia/Jakarta), termasuk
-- minggu berjalan. Kalau hanya mau minggu yang sudah selesai, ganti
-- `period_end` dengan toMonday(toDate(now('Asia/Jakarta'))).
--
-- Alur AM:
--   farmer -> ambassador_leads (SALE/LEADS) -> duta
--          -> ambassador_kyc VERIFIED duta -> updated_by = AM
--   Kalau farmer tidak punya duta tapi dirinya sendiri duta (self KYC),
--   AM diambil dari KYC farmer itu sendiri.
--
-- Catatan:
--   * Cek "ada / tidak ada join" pakai ifNull(toString(..), '') != ''
--     supaya benar baik join_use_nulls = 0 (default value '') maupun 1
--     (NULL). Versi lama pakai `self_kyc.user_id IS NOT NULL` yang selalu
--     TRUE kalau join_use_nulls = 0.
--   * CTE farm_data / catat_panen / catat_rawat dihapus karena tidak
--     dipakai di output.
-- =====================================================================
WITH
    toMonday(toDate(now('Asia/Jakarta'))) - INTERVAL 7 WEEK AS period_start,
    toDate(now('Asia/Jakarta')) + 1                         AS period_end,

    -- Farmer REGISTERED dalam periode (filter tanggal ditaruh di sini
    -- supaya join di bawah hanya memproses farmer 8 minggu terakhir)
    target_farmers AS (
        SELECT
            id,
            name,
            phone_no,
            status,
            utm_source,
            created_at_utc7 AS created_date
        FROM sawitpro_datamart.datamart_user
        WHERE status = 'REGISTERED'
          AND toDate(created_at_utc7) >= period_start
          AND toDate(created_at_utc7) <  period_end
    ),

    -- 1 baris terbaru per lead (status SALE / LEADS)
    unique_leads AS (
        SELECT
            ambassador_user_id,
            leads_user_id,
            status
        FROM ambassador_leads
        WHERE status IN ('SALE', 'LEADS')
          AND leads_user_id IN (SELECT id FROM target_farmers)
        ORDER BY leads_user_id, updated_at_utc0 DESC
        LIMIT 1 BY leads_user_id
    ),

    -- KYC VERIFIED pertama per user (dipakai untuk duta & self-duta)
    unique_kyc AS (
        SELECT
            user_id,
            updated_by,
            toDateTime(toInt64(created_at_utc0) / 1000, 'Asia/Jakarta') AS join_date_duta
        FROM ambassador_kyc
        WHERE status = 'VERIFIED'
        ORDER BY user_id, created_at_utc0 ASC
        LIMIT 1 BY user_id
    )

SELECT DISTINCT
    -- Duta: dari leads, fallback ke farmer sendiri kalau dia self-duta
    ifNull(toString(u_duta.id), '')     != '' AS has_duta,
    ifNull(toString(self_kyc.user_id), '') != '' AS is_self_duta,

    multiIf(has_duta, u_duta.id,       is_self_duta, u_farmer.id,       NULL) AS duta_id,
    multiIf(has_duta, u_duta.name,     is_self_duta, u_farmer.name,     NULL) AS duta_name,
    multiIf(has_duta, u_duta.phone_no, is_self_duta, u_farmer.phone_no, NULL) AS duta_phone,
    multiIf(has_duta, ak.join_date_duta, is_self_duta, self_kyc.join_date_duta, NULL) AS join_date_duta,

    -- AM: dari KYC duta, fallback ke KYC self-duta
    nullIf(trim(ifNull(if(has_duta, u_am.name, self_am.name), '')), '') AS am_name,

    multiIf(
        ifNull(u_am.name, '') = 'Fauzy Nurazhari Pane'
            OR ifNull(self_am.name, '') = 'Fauzy Nurazhari Pane', 'Fauzy Nur Azhari Pane Test',
        ifNull(duta_name, u_farmer.name) ILIKE '%test%',            ifNull(duta_name, u_farmer.name),
        am_name
    ) AS area_manager,

    if(area_manager IS NULL, 'Tanpa Area Manager', 'Ada Area Manager') AS am_status,

    u_farmer.id          AS farmer_id,
    u_farmer.name        AS farmer_name,
    u_farmer.phone_no    AS farmer_phone,
    u_farmer.status      AS farmer_status,
    u_farmer.utm_source  AS utm_source,
    u_farmer.created_date AS join_date_farmer,
    toMonday(u_farmer.created_date) AS join_week_farmer,
    al.status            AS status_under_duta

FROM target_farmers AS u_farmer
-- INNER JOIN: farmer wajib punya leads SALE / LEADS
INNER JOIN unique_leads   AS al       ON al.leads_user_id   = u_farmer.id
LEFT JOIN  default.user   AS u_duta   ON u_duta.id          = al.ambassador_user_id
LEFT JOIN  unique_kyc     AS ak       ON ak.user_id         = al.ambassador_user_id
LEFT JOIN  default.user   AS u_am     ON u_am.id            = ak.updated_by
LEFT JOIN  unique_kyc     AS self_kyc ON self_kyc.user_id   = u_farmer.id
LEFT JOIN  default.user   AS self_am  ON self_am.id         = self_kyc.updated_by

ORDER BY join_date_farmer DESC;


-- ---------------------------------------------------------------------
-- (Opsional) Ringkasan per minggu: jumlah farmer ada AM vs tanpa AM.
-- Bungkus query di atas (tanpa ORDER BY & titik koma) sebagai `detail`:
--
-- SELECT
--     join_week_farmer,
--     countDistinctIf(farmer_id, am_status = 'Ada Area Manager')   AS farmer_ada_am,
--     countDistinctIf(farmer_id, am_status = 'Tanpa Area Manager') AS farmer_tanpa_am,
--     countDistinct(farmer_id)                                     AS total_farmer
-- FROM ( ...query detail di atas... ) AS detail
-- GROUP BY join_week_farmer
-- ORDER BY join_week_farmer DESC
-- ---------------------------------------------------------------------
