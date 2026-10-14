-- =====================================================================
-- (3) DEBUG: cek kenapa 1 user tidak muncul di query summary / list.
-- Ganti nilai `target_user_id`. Tiap kolom = 1 syarat; yang bernilai 0
-- adalah filter yang membuang user tsb.
-- =====================================================================
WITH
    'ISI_USER_ID_DI_SINI' AS target_user_id,
    toMonday(toDate(now('Asia/Jakarta'))) - INTERVAL 7 WEEK AS period_start

SELECT
    u.id,
    u.name,
    toDateTime(toInt64(u.created_at_utc0) / 1000) + INTERVAL 7 HOUR AS created_date_default_user,
    du.created_at_utc7                       AS created_date_datamart,
    du.status, du.is_active, du.user_role,
    du.id != ''                              AS ada_di_datamart_user,
    du.status = 'REGISTERED'                 AS lolos_status,
    du.is_active = TRUE                      AS lolos_is_active,
    du.user_role ILIKE '%FARMER%'            AS lolos_role,
    toDate(du.created_at_utc7) >= period_start AS lolos_periode,
    (SELECT argMax(status, updated_at_utc0) FROM ambassador_leads
      WHERE leads_user_id = target_user_id)  AS status_leads_terbaru
FROM default.user AS u
LEFT JOIN sawitpro_datamart.datamart_user AS du ON du.id = u.id
WHERE u.id = target_user_id
