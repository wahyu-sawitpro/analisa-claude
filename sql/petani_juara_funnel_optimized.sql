-- Petani Juara funnel (optimized)
--
-- Key changes vs. the original:
--  1. flatten_eventapp_raw is scanned ONCE (original: open_section + ot + aa1 = 3 scans,
--     and each was repeated 5x because funnel_summary was referenced 5x in UNION ALL).
--  2. Final unpivot uses ARRAY JOIN instead of 5x UNION ALL over the same CTE
--     (ClickHouse inlines CTEs, so the original ran the whole pipeline 5 times).
--  3. "First event after open_task" (minIf with a join-dependent condition) is replaced by
--     "last event in the week" (maxIf) compared to open_task afterwards. The missions only
--     check existence (time_x > open_task), and max(ts) > open_task <=> some ts > open_task,
--     so results are identical but no row-level join with ot is needed.
--  4. INNER JOIN datamart_user -> semi-join (IN), which needs no hash-table payload.
--  5. ffb_sell_price / upkeep_history are filtered on the raw column (index-friendly),
--     unioned first, then joined to farm/asset once instead of twice.
--  6. Redundant filters removed (Jakarta-date >= 2026-06-01 is implied by UTC time > 2026-06-01;
--     open_task > 2026-06-01 is always true after the WHERE).
WITH

-- One pass over the event table, one row per (user, campaign_week)
ev AS (
  SELECT
    user_id,
    campaign_week,
    countIf(ev = 'petani_juara_open' AND in_range) > 0             AS opened_section,
    countIf(ev = 'petani_juara_join_btn_clicked' AND in_range) > 0 AS joined,
    minIf(ts, ev = 'petani_juara_join_btn_clicked' AND in_range)   AS open_task,
    maxIf(ts, ev IN ('fertcalc_rslt_open', 'fertcalc2_rslt_open')) AS last_calculator,
    maxIf(ts, ev = 'pnd_diagno_rslt_open')                         AS last_pnd,
    maxIf(ts, ev = 'ffbprice_district')                            AS last_ffb_price,
    maxIf(ts, ev = 'report_open')                                  AS last_report,
    maxIf(ts, ev = 'petani_juara_social_submit_clicked')           AS last_socmed,
    maxIf(ts, is_khusus_petani)                                    AS last_khususpetani
  FROM (
    SELECT
      e.user_id                                AS user_id,
      toDateTime(e.event_time, 'Asia/Jakarta') AS ts,
      toMonday(ts)                             AS campaign_week,
      lower(e.event_name)                      AS ev,
      e.event_name = 'page_view'
        AND arrayExists(x -> position(x, 'khusus-petani') > 0, e.event_params_arr) AS is_khusus_petani,
      -- dateRange only restricts the open/join events; activity events use the full week
      ({{dateRange}})                          AS in_range
    FROM default.flatten_eventapp_raw e
    INNER JOIN sawitpro_datamart.dim_date dd
      ON dd.date_series = toDate(toDateTime(e.event_time, 'Asia/Jakarta'))
    WHERE e.user_id <> ''
      AND toDateTime(e.event_time) > '2026-06-01'
      AND lower(e.app_type) IN ('petaniapp', 'sawitproretail')
      AND e.user_id IN (SELECT id FROM sawitpro_datamart.datamart_user)
      AND (
        lower(e.event_name) IN (
          'petani_juara_open', 'petani_juara_join_btn_clicked',
          'fertcalc_rslt_open', 'fertcalc2_rslt_open', 'pnd_diagno_rslt_open',
          'ffbprice_district', 'report_open', 'petani_juara_social_submit_clicked'
        )
        OR (e.event_name = 'page_view'
            AND arrayExists(x -> position(x, 'khusus-petani') > 0, e.event_params_arr))
      )
  )
  GROUP BY user_id, campaign_week
  HAVING opened_section OR joined
),

-- Farm all time (Catat Kebun): latest farm created after 2026-06-01
fa AS (
  SELECT
    a.owner_id AS owner_id,
    toDateTime(max(f.created_at_utc0) / 1000) + INTERVAL 7 HOUR > '2026-06-01' AS has_new_farm
  FROM default.farm f
  INNER JOIN default.asset a ON a.id = f.asset_id
  GROUP BY a.owner_id
),

-- Panen & Rawat per week (last record of the week; compared to open_task later)
faa AS (
  SELECT
    owner_id,
    toMonday(toDate(ts))           AS campaign_week,
    maxIf(ts, note = 'panen')      AS last_panen,
    maxIf(ts, note = 'rawat')      AS last_rawat
  FROM (
    SELECT
      a.owner_id AS owner_id,
      x.note     AS note,
      toDateTime(x.created_at_utc0 / 1000) + INTERVAL 7 HOUR AS ts
    FROM (
      -- (toDateTime(c/1000) + 7h >= '2026-06-01')  <=>  c >= ('2026-06-01' - 7h) * 1000
      SELECT 'panen' AS note, farm_id, created_at_utc0
      FROM default.ffb_sell_price
      WHERE created_at_utc0 >= (toUnixTimestamp(toDateTime('2026-06-01 00:00:00')) - 25200) * 1000
      UNION ALL
      SELECT 'rawat' AS note, farm_id, created_at_utc0
      FROM default.upkeep_history
      WHERE created_at_utc0 >= (toUnixTimestamp(toDateTime('2026-06-01 00:00:00')) - 25200) * 1000
    ) x
    INNER JOIN default.farm f  ON f.id = x.farm_id
    INNER JOIN default.asset a ON a.id = f.asset_id
  )
  GROUP BY owner_id, campaign_week
),

-- Mission evaluation per (user, week)
scored AS (
  SELECT
    ev.user_id        AS user_id,
    ev.opened_section AS opened_section,
    ev.joined         AS joined,

    -- Mission 1
    ev.joined AND if(fa.has_new_farm, 1, 0) = 1 AS m1,

    -- Mission 2 (from week 2026-08-31: >= 2 of 3 [khususpetani, calculator, ffb_price]; before: >= 4 of 7)
    m1 AND if(
      ev.campaign_week >= toDate('2026-08-31'),
      (
        if(ev.last_khususpetani > ev.open_task, 1, 0) +
        if(ev.last_calculator   > ev.open_task, 1, 0) +
        if(ev.last_ffb_price    > ev.open_task, 1, 0)
      ) >= 2,
      (
        if(ev.last_khususpetani > ev.open_task, 1, 0) +
        if(ev.last_calculator   > ev.open_task, 1, 0) +
        if(ev.last_pnd          > ev.open_task, 1, 0) +
        if(ev.last_ffb_price    > ev.open_task, 1, 0) +
        if(ev.last_report       > ev.open_task, 1, 0) +
        if(faa.last_rawat       > ev.open_task, 1, 0) +
        if(faa.last_panen       > ev.open_task, 1, 0)
      ) >= 4
    ) AS m2,

    -- Mission 3 (M1 + M2 + submit socmed)
    m2 AND if(ev.last_socmed > ev.open_task, 1, 0) = 1 AS m3
  FROM ev
  LEFT JOIN fa  ON fa.owner_id = ev.user_id
  LEFT JOIN faa ON faa.owner_id = ev.user_id AND faa.campaign_week = ev.campaign_week
)

SELECT
  step,
  stage_name,
  total_user,
  pct_conversion_prev_step,
  pct_conversion_overall
FROM (
  SELECT
    uniqExactIf(user_id, opened_section) AS s1,
    uniqExactIf(user_id, joined)         AS s2,
    uniqExactIf(user_id, m1)             AS s3,
    uniqExactIf(user_id, m2)             AS s4,
    uniqExactIf(user_id, m3)             AS s5
  FROM scored
)
ARRAY JOIN
  [1, 2, 3, 4, 5] AS step,
  ['1. Open Section', '2. Click Join', '3. Mission 1 Done', '4. Mission 2 Done', '5. Mission 3 Done (Juara)'] AS stage_name,
  [s1, s2, s3, s4, s5] AS total_user,
  [100.00,
   round(s2 * 100.0 / nullIf(s1, 0), 2),
   round(s3 * 100.0 / nullIf(s2, 0), 2),
   round(s4 * 100.0 / nullIf(s3, 0), 2),
   round(s5 * 100.0 / nullIf(s4, 0), 2)] AS pct_conversion_prev_step,
  [100.00,
   round(s2 * 100.0 / nullIf(s1, 0), 2),
   round(s3 * 100.0 / nullIf(s1, 0), 2),
   round(s4 * 100.0 / nullIf(s1, 0), 2),
   round(s5 * 100.0 / nullIf(s1, 0), 2)] AS pct_conversion_overall
ORDER BY step ASC
