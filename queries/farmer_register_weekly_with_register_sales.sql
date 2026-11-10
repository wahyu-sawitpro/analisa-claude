-- =====================================================================
-- Farmer register (minggu ini + 7 minggu sebelumnya) + atribusi
-- Duta / UTM / farm / order Toling-Masker + total sales di hari register.
--
-- Perubahan dari versi sebelumnya:
--  * Bug diperbaiki: `sh.potential_gmvs` & `dm.*` merujuk alias yang tidak
--    ada, dan kolom sales_amount hanya ada di branch ke-2 UNION ALL
--    (jumlah kolom tidak sama) -> query tidak bisa jalan.
--  * Baris order (customer_360 + ecommerce) jadi CTE `order_lines`,
--    lalu diagregasi sekali di `order_summary` (tanggal order Toling /
--    Masker terakhir + total sales di tanggal register).
--  * Kolom baru `total_sales_register_date` = total sales SEMUA item
--    (bukan hanya Toling/Masker) yang tanggal order-nya = tanggal register
--    farmer. Farmer tanpa order di hari register -> 0.
--  * Nomor Toko Keliling dinormalisasi sekali di WITH (bukan per baris).
-- =====================================================================
WITH
    toMonday(toDate(now('Asia/Jakarta'))) - INTERVAL 7 WEEK AS period_start,
    toDate(now('Asia/Jakarta')) + 1                         AS period_end,

    -- Farmer yang utm_source-nya dipaksa jadi 'Toko Keliling'.
    -- Dinormalisasi: hanya digit, prefix 62 / 0 dibuang.
    arrayMap(
        p -> replaceRegexpOne(replaceRegexpAll(p, '[^0-9]', ''), '^(62|0)', ''),
        [
            '085266759011', '082251257231', '085271665789', '083167803438', '082381610040',
            '085356210717', '082386219380', '082172367127', '081170705599', '081343218595',
            '081268581499', '081275537972', '085265686601', '085363624016', '081269944666',
            '082237792319', '085278678787', '082296368686', '085376366252', '082285385545',
            '081276291011', '085749474043', '082170661660', '082287398406'
        ]
    ) AS toko_keliling_phones,

-- ---------------------------------------------------------------------
-- Farmer yang register di periode
-- ---------------------------------------------------------------------
farmers AS (
    SELECT id, name, phone_no, email, created_at_utc7, referral_utm, utm_source, user_role
    FROM sawitpro_datamart.datamart_user
    WHERE status = 'REGISTERED'
      AND is_active = TRUE
      AND id NOT IN ('df27bf4c-2314-4e91-a8b3-11b5ca86f3f7')
      AND (user_role ILIKE '%FARMER%' OR user_role ILIKE '%estate%')
      AND toDate(created_at_utc7) >= period_start
      AND toDate(created_at_utc7) <  period_end
    LIMIT 1 BY id
),

-- ---------------------------------------------------------------------
-- Duta: lead terakhir per farmer + KYC duta + area manager
-- ---------------------------------------------------------------------
latest_leads AS (
    SELECT ambassador_user_id, leads_user_id, status
    FROM ambassador_leads
    WHERE leads_user_id IN (SELECT id FROM farmers)
    ORDER BY leads_user_id, updated_at_utc0 DESC
    LIMIT 1 BY leads_user_id
),

unique_kyc AS (
    SELECT
        user_id,
        updated_by,
        toDateTime(toInt64(created_at_utc0) / 1000) + INTERVAL 7 HOUR AS join_date_duta
    FROM ambassador_kyc
    WHERE status = 'VERIFIED'
    ORDER BY user_id, created_at_utc0 ASC
    LIMIT 1 BY user_id
),

-- ---------------------------------------------------------------------
-- UTM dari event app
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Farm milik farmer (array diurutkan berdasarkan tanggal farm dibuat)
-- ---------------------------------------------------------------------
data_farm AS (
    SELECT
        user_id,
        count()                              AS jumlah_farm,
        sum(area_hectare)                    AS total_area_hectare,
        min(farm_created_at_utc7)            AS first_farm_created_at,
        arraySort(groupArray((
            farm_created_at_utc7, farm_id, fm_name, area_hectare,
            fm_district, fm_regency, fm_province
        )))                                  AS farms,
        arrayMap(x -> x.3, farms)            AS farm_name,
        arrayMap(x -> x.4, farms)            AS detail_hectare,
        arrayMap(x -> [x.5, x.6, x.7], farms) AS location,
        arrayMap(x -> x.7, farms)            AS province,
        arrayMap(x -> x.6, farms)            AS regency,
        arrayMap(x -> x.5, farms)            AS district
    FROM (
        SELECT
            owner_id                 AS user_id,
            farm_id,
            ifNull(farm_name, '')    AS fm_name,
            ifNull(area_hectare, 0)  AS area_hectare,
            farm_created_at_utc7,
            ifNull(district, '')     AS fm_district,
            ifNull(regency, '')      AS fm_regency,
            ifNull(province, '')     AS fm_province
        FROM sawitpro_datamart.dim_farm
        WHERE owner_id IN (SELECT id FROM farmers)
          AND `f.is_active` = TRUE
        LIMIT 1 BY farm_id
    )
    GROUP BY user_id
),

-- ---------------------------------------------------------------------
-- Baris order 2026 (customer_360 + ecommerce non-Shopify), non-cancel.
-- sales_amount per baris item.
-- ---------------------------------------------------------------------
order_lines AS (
    SELECT user_id, dates, item, prod_cat, sales_amount
    FROM (
        SELECT
            d.user_id                                  AS user_id,
            d.dates                                    AS dates,
            d.item                                     AS item,
            d.invoice_no                               AS invoice_no,
            d.product_category                         AS prod_cat,
            ifNull(d.sale_order_status, '')            AS sale_order_status,
            d.order_line_state                         AS order_line_state,
            -- ASUMSI: nama kolom GMV di datamart_customer_360 = potential_gmv
            -- (sesuaikan kalau beda, mis. potential_gmv + shipping_cost)
            CAST(ifNull(d.potential_gmv, 0) AS Int64)  AS sales_amount
        FROM sawitpro_datamart.datamart_customer_360 AS d
        WHERE d.user_id IN (SELECT id FROM farmers)
          AND d.dates >= '2026-01-01'

        UNION ALL

        SELECT
            e.user_id,
            CAST(toDate(toTimeZone(e.sale_order_created_time, 'Asia/Jakarta')) AS Nullable(Date)),
            e.item,
            e.invoice_no,
            CAST(e.product_cat AS Nullable(String)),
            toString(e.sale_order_status),
            CAST(NULL AS Nullable(String)),
            -- harga item + ongkir dibagi rata ke semua item di invoice
            CAST(ifNull(
                e.total_price_idr + ifNull(
                    e.total_shipping_cost / nullIf(count(e.item) OVER (PARTITION BY e.invoice_no), 0),
                    0),
                0) AS Int64)
        FROM sawitpro_datamart.datamart_ecommerce AS e
        WHERE (e.invoice_status = 'PAID' OR toString(e.sale_order_status) IN ('COMPLETED', '32'))
          AND e.invoice_no NOT IN (SELECT invoice_no FROM sawitpro_datamart.fct_new_sale_order_shopify)
          AND e.sale_order_id IN (SELECT id FROM default.sale_order)
          AND e.user_id IN (SELECT id FROM default.user WHERE fraud_flag != 5)
          AND e.user_id IN (SELECT id FROM farmers)
    )
    WHERE dates >= '2026-01-01'
      AND concat('#', splitByChar('/', ifNull(invoice_no, ''))[2]) != '#B2B1940'
      AND ifNull(order_line_state, '') != 'cancel'
      AND sale_order_status != 'CANCELLED'
),

-- ---------------------------------------------------------------------
-- 1 baris per farmer: tanggal order Toling / Masker TERAKHIR
-- + total sales di tanggal register
-- ---------------------------------------------------------------------
order_summary AS (
    SELECT
        o.user_id                                            AS user_id,
        maxIf(o.dates, o.order_type = 'Toling')              AS last_toling_order_date,
        maxIf(o.dates, o.order_type = 'Masker')              AS last_masker_order_date,
        maxIf(o.dates, o.order_type IN ('Toling', 'Masker')) AS last_sale_order_date,
        sumIf(o.sales_amount, o.dates = f.register_date)     AS total_sales_register_date
    FROM (
        SELECT
            user_id,
            dates,
            sales_amount,
            multiIf(
                item ILIKE '%masker%', 'Masker',
                prod_cat = 'Toling'
                    AND NOT match(item, '(?i)herb')
                    AND item NOT ILIKE 'Benih Sawit Topaz 1-3 Seri 4 (100 butir)%'
                    AND item NOT ILIKE '%layanan%'
                    AND item NOT ILIKE '%minyak%', 'Toling',
                ''
            ) AS order_type
        FROM order_lines
    ) AS o
    INNER JOIN (
        SELECT id, toDate(created_at_utc7) AS register_date FROM farmers
    ) AS f ON f.id = o.user_id
    GROUP BY o.user_id
),

-- ---------------------------------------------------------------------
-- Gabungan semua atribut per farmer
-- ---------------------------------------------------------------------
base AS (
    SELECT
        f.id                          AS farmer_id,
        f.name                        AS farmer_name,
        f.phone_no                    AS farmer_phone,
        f.email                       AS farmer_email,
        f.created_at_utc7             AS join_date_farmer,
        toMonday(f.created_at_utc7)   AS join_week_farmer,
        f.user_role                   AS user_role,
        f.referral_utm                AS referral_utm,
        f.utm_source                  AS utm_source_original,
        ev.utm_source_name            AS utm_source_name,
        ev.stslc_utm_campaign         AS stslc_utm_campaign,
        ev.stslc_utm_source_platform  AS stslc_utm_source_platform,

        ifNull(al.status, '')                  AS status_under_duta,
        status_under_duta IN ('SALE', 'LEADS') AS under_duta,
        u_duta.id                     AS duta_id,
        u_duta.name                   AS duta_name,
        u_duta.phone_no               AS duta_phone,
        ak.join_date_duta             AS join_date_duta,
        multiIf(
            ifNull(u_am.name, '') = 'Fauzy Nurazhari Pane', 'Fauzy Nur Azhari Pane Test',
            ifNull(u_duta.name, '') ILIKE '%test%',          u_duta.name,
            ifNull(trim(u_am.name), '') != '',               u_am.name,
            NULL
        )                             AS area_manager,
        ifNull(u_am.name, '') = 'Fauzy Nurazhari Pane'
            OR ifNull(u_duta.name, '') ILIKE '%test%' AS is_test_duta,

        df.jumlah_farm                AS jumlah_farm,
        df.total_area_hectare         AS total_area_hectare,
        df.detail_hectare             AS detail_hectare,
        df.farm_name                  AS farm_name,
        df.location                   AS location,
        df.province                   AS province,
        df.regency                    AS regency,
        df.district                   AS district,
        df.first_farm_created_at      AS first_farm_created_at,

        os.last_sale_order_date       AS last_sale_order_date,
        os.last_toling_order_date     AS last_toling_order_date,
        os.last_masker_order_date     AS last_masker_order_date,
        ifNull(os.total_sales_register_date, 0) AS total_sales_register_date
    FROM farmers AS f
    LEFT JOIN latest_leads  AS al     ON al.leads_user_id = f.id
    LEFT JOIN event_utm     AS ev     ON ev.user_id       = f.id
    LEFT JOIN default.user  AS u_duta ON u_duta.id        = al.ambassador_user_id
    LEFT JOIN unique_kyc    AS ak     ON ak.user_id       = al.ambassador_user_id
    LEFT JOIN default.user  AS u_am   ON u_am.id          = ak.updated_by
    LEFT JOIN data_farm     AS df     ON df.user_id       = f.id
    LEFT JOIN order_summary AS os     ON os.user_id       = f.id
)

SELECT DISTINCT
    join_week_farmer                          AS minggu_register,
    if(under_duta, 'Under Duta', 'Non Duta')  AS akuisisi_type,
    farmer_id,
    farmer_name,
    farmer_phone,
    farmer_email,
    join_date_farmer,
    user_role,

    -- farm
    jumlah_farm,
    total_area_hectare,
    detail_hectare,
    farm_name,
    location,
    province,
    regency,
    district,
    first_farm_created_at,

    -- order
    last_sale_order_date,
    last_toling_order_date,
    last_masker_order_date,
    total_sales_register_date,

    -- utm (register di tanggal order Toling / Masker terakhir -> sumbernya itu)
    referral_utm,
    multiIf(
        has(toko_keliling_phones,
            replaceRegexpOne(replaceRegexpAll(ifNull(farmer_phone, ''), '[^0-9]', ''), '^(62|0)', '')),
                                                               'Toko Keliling',
        toDate(join_date_farmer) = last_toling_order_date,     'Toling',
        toDate(join_date_farmer) = last_masker_order_date,     'Masker',
        upper(trim(ifNull(utm_source_original, ''))) = 'GADN', 'Google Ads',
        utm_source_original
    )                                         AS utm_source,
    nullIf(utm_source_name, '')               AS utm_source_name,
    nullIf(stslc_utm_campaign, '')            AS stslc_utm_campaign,
    nullIf(stslc_utm_source_platform, '')     AS stslc_utm_source_platform,

    -- duta
    nullIf(status_under_duta, '')             AS status_under_duta,
    if(under_duta, duta_id, NULL)             AS duta_id,
    if(under_duta, duta_name, NULL)           AS duta_name,
    if(under_duta, duta_phone, NULL)          AS duta_phone,
    if(under_duta, join_date_duta, NULL)      AS join_date_duta,
    if(under_duta, area_manager, NULL)        AS area_manager,
    under_duta AND is_test_duta               AS is_test_duta
FROM base
ORDER BY join_date_farmer DESC
