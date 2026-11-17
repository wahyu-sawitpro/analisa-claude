WITH base AS (
    SELECT
        toDate(event_time)                                                AS day,
        user_id,
        max(CAST(event_timestamp AS Int64)) - min(CAST(event_timestamp AS Int64)) AS gap,
        groupUniqArrayIf(note, note != '')                                AS notes
    FROM
    (
        SELECT
            event_time,
            event_timestamp,
            user_id,
            event_name AS ev,
            multiIf(
                ev LIKE '%user_engagement%', '',

                multiSearchAnyCaseInsensitive(ev, ['home_farm_card_add_clicked','increaseincome_card_add_clicked','prdtivity_card_add_clicked','home_addfarm_btn_clicked','farmlist_farm_exist_adding_btn_clicked','farmlist_farm_empty_adding_btn_clicked','aaas_tds_farm_empty_adding_btn_clicked','aaas_tds_farm_exist_adding_btn_clicked','aaas_uds_farm_empty_adding_btn_clicked','aaas_uds_farm_exist_card_clicked','slsrec_farm_exist_adding_btn_clicked','slsrec_farm_empty_adding_btn_clicked']), 'Kebun Saya',
                multiSearchAnyCaseInsensitive(ev, ['card_view_open_clicked','home_slsrec_btn_clicked','slsrec_newsale_btn_clicked','slsrec_ffb_open']), 'Panen',
                multiSearchAnyCaseInsensitive(ev, ['home_upkeep_btn_clicked','add_upkeep']), 'Rawat',
                positionCaseInsensitive(ev, 'drswt') > 0 AND ev NOT IN ('drswt_open','drswt_back_icon_clicked'), 'Dokter Sawit',
                positionCaseInsensitive(ev, 'ds_card_clicked') > 0, 'Sewa Agronomis',
                positionCaseInsensitive(ev, 'chat_send_btn_clicked') > 0, 'Dokter Sawitina',
                positionCaseInsensitive(ev, 'fertcalc_main_calculate_btn_clicked') > 0, 'Kalkulator Pupuk',
                multiSearchAnyCaseInsensitive(ev, ['ecommerce_biller_pulsa_card_clicked','ecommerce_biller_pln_card_clicked','ecommerce_coupon_clicked','home_ecommerce_catalogue_clicked','item_clicked','shopify_open']), 'Toko Sawit',
                positionCaseInsensitive(ev, 'quiz_') > 0 AND ev NOT IN ('quiz_main_open','quiz_main_back_icon_clicked'), 'Gamification (Kuis Sawit)',
                ev LIKE 'tts%', 'Gamification (TTS)',
                multiSearchAnyCaseInsensitive(ev, ['ninja_sawit_open','tanam_sawit_open','truk_tbs_open','domino_sawit_open']), 'Gamification (Experiences)',
                positionCaseInsensitive(ev, 'tv_open') > 0, 'SawitTV',
                positionCaseInsensitive(ev, 'ffbpriceshare_open') > 0, 'FFB Share Price',
                positionCaseInsensitive(ev, 'banpuk_banner_clicked') > 0
                    OR (positionCaseInsensitive(ev, 'banpuk') > 0 AND ev LIKE '%landing_open%')
                    OR (positionCaseInsensitive(ev, 'login_home_menu_business_btn_clicked') > 0
                        AND replaceRegexpAll(splitByChar(',', arrayReduce('min', event_params_arr))[2], '[(\']', '')
                            IN (SELECT toString(id) FROM default.app_shortcut WHERE title = 'Bantu Pupuk')),
                    'Bantuan Pupuk',
                positionCaseInsensitive(ev, 'pnd_') > 0, 'Pest and Disease',
                ev LIKE '%report_open%', 'Report Open',
                positionCaseInsensitive(ev, 'ffbprice_district_open') > 0, 'FFB Pricing Intelligence',
                positionCaseInsensitive(ev, 'ramp_') > 0, 'Lapak Sawit',
                positionCaseInsensitive(ev, 'svy_') > 0, 'Survey Harga Pupuk',
                positionCaseInsensitive(ev, 'petani_juara') > 0, 'Petani Juara',
                positionCaseInsensitive(ev, 'sticker') > 0, 'Sticker',
                ''
            ) AS note
        FROM default.flatten_eventapp
        WHERE app_type = 'petaniapp'
          AND user_id <> 'Guest'
          AND user_id IS NOT NULL
          AND {{time_range}}
    )
    GROUP BY day, user_id
),

user_note_day AS (
    SELECT day, user_id, note
    FROM base
    ARRAY JOIN arrayConcat(notes, if(gap > 30000000, ['all'], [])) AS note
),

daily AS (
    SELECT
        day,
        note,
        count()                 AS dau,
        uniqExactState(user_id) AS u_state
    FROM user_note_day
    GROUP BY day, note
),

rolling AS (
    SELECT
        day,
        note,
        dau,
        uniqExactMerge(u_state) OVER (PARTITION BY note ORDER BY toUInt32(day)
                                      RANGE BETWEEN 6  PRECEDING AND CURRENT ROW) AS wau,
        uniqExactMerge(u_state) OVER (PARTITION BY note ORDER BY toUInt32(day)
                                      RANGE BETWEEN 29 PRECEDING AND CURRENT ROW) AS mau
    FROM daily
),

ret AS (
    SELECT
        day,
        note,
        countIf(prev_day > toDate(0) AND dateDiff('day', prev_day, day) <= 7) AS returning_7d,
        countIf(prev_day > toDate(0))                                         AS returning_any
    FROM
    (
        SELECT
            day, note, user_id,
            lagInFrame(day, 1, toDate(0)) OVER (
                PARTITION BY user_id, note ORDER BY day
                ROWS BETWEEN 1 PRECEDING AND CURRENT ROW
            ) AS prev_day
        FROM user_note_day
    )
    GROUP BY day, note
),

note_list AS (
    SELECT arrayJoin(['all','Kebun Saya','Panen','Rawat','Dokter Sawit','Sewa Agronomis',
        'Dokter Sawitina','Kalkulator Pupuk','Toko Sawit','Gamification (Kuis Sawit)',
        'Gamification (TTS)','Gamification (Experiences)','SawitTV','FFB Share Price',
        'Bantuan Pupuk','Pest and Disease','Report Open','FFB Pricing Intelligence',
        'Lapak Sawit','Survey Harga Pupuk','Petani Juara','Sticker']) AS note
),

date_list AS (SELECT DISTINCT day FROM daily)

SELECT
    g.day                                                   AS dates,
    g.note                                                  AS note,
    r.dau                                                   AS dau,
    r.wau                                                   AS wau,
    r.mau                                                   AS mau,
    round(ifNotFinite(r.dau / r.mau, 0) * 100, 2)           AS stickiness_dau_mau_pct,
    round(ifNotFinite(r.dau / r.wau, 0) * 100, 2)           AS stickiness_dau_wau_pct,
    t.returning_7d                                          AS returning_7d,
    t.returning_any                                         AS returning_any,
    r.dau - t.returning_any                                 AS new_to_feature,
    round(ifNotFinite(t.returning_7d / r.dau, 0) * 100, 2)  AS return_rate_7d_pct
FROM (SELECT d.day, n.note FROM date_list AS d CROSS JOIN note_list AS n) AS g
LEFT JOIN rolling AS r ON r.day = g.day AND r.note = g.note
LEFT JOIN ret     AS t ON t.day = g.day AND t.note = g.note
ORDER BY dates DESC, dau DESC
