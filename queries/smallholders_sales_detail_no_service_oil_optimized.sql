-- =====================================================================
-- Detail sales Smallholders (dates >= 2025-01-01), TANPA item layanan
-- & minyak — versi optimasi.
-- Pola Smallholders sama dengan file *_optimized.sql lain:
--   * hanya tabel lark Smallholders yang dibaca (7 tabel lark tim lain
--     dihapus) -> pic_teams selalu 'Smallholders';
--   * invoice yang juga di-claim tim lain IKUT ditampilkan;
--   * filter Smallholders (semi-join `invoice_no IN sh_keys`), item &
--     tanggal didorong ke tabel sumber sebelum join berat;
--   * sisi kanan join berat (shopify_orders, flatten_eventapp_raw,
--     shopify_campaign_sales, sale_order, user, account_move,
--     datamart_ecommerce) dipre-filter ke key yang relevan saja;
--   * TANPA pembungkus `SELECT ... FROM (...) AS result` — lookup
--     user_type jadi CTE biasa.
--
-- Kolom yang jadi konstan karena hanya Smallholders (logika lama dibuang):
--   pic_teams = 'Smallholders', assisted_order = 'YES',
--   b2b_b2c = 'B2B' hanya untuk order_source MITRA, selain itu 'B2C'.
--
-- Item yang dikecualikan: nama item / kategori / product_type cocok
-- regex excluded_item_regex (minyak, layanan, jasa, Dokter Sawit).
--
-- first_order_date (NEW/REPEAT) tetap dari SEMUA order customer sejak
-- 2025 (tim mana pun), dibatasi ke customer yang punya order Smallholders.
-- =====================================================================
WITH
    toDateTime('2025-01-01 00:00:00', 'Asia/Jakarta') AS start_ts,
    '(?i)minyak|layanan|jasa|dokter sawit' AS excluded_item_regex,

-- === [GEO] Geo Equalizer — Province (idealnya jadi tabel/dictionary) ===
geo_province AS (
    SELECT
        upper(trimBoth(province_raw)) AS geo_key,
        any(province_std)  AS geo_province_std,
        any(province_kind) AS geo_province_kind
    FROM (
    SELECT 'ACEH' AS province_raw, 'ACEH' AS province_std, 'GEO' AS province_kind
    UNION ALL SELECT 'NAD', 'ACEH', 'GEO'
    UNION ALL SELECT 'NANGGROE ACEH DARUSSALAM', 'ACEH', 'GEO'
    UNION ALL SELECT 'NANGGROE ACEH DARUSSALAM (NAD)', 'ACEH', 'GEO'
    UNION ALL SELECT 'BALI', 'BALI', 'GEO'
    UNION ALL SELECT 'BANTEN', 'BANTEN', 'GEO'
    UNION ALL SELECT 'BENGKULU', 'BENGKULU', 'GEO'
    UNION ALL SELECT 'DAERAH ISTIMEWA YOGYAKARTA', 'DI YOGYAKARTA', 'GEO'
    UNION ALL SELECT 'DI YOGYAKARTA', 'DI YOGYAKARTA', 'GEO'
    UNION ALL SELECT 'DIY', 'DI YOGYAKARTA', 'GEO'
    UNION ALL SELECT 'SPECIAL REGION OF YOGYAKARTA', 'DI YOGYAKARTA', 'GEO'
    UNION ALL SELECT 'YOGYA', 'DI YOGYAKARTA', 'GEO'
    UNION ALL SELECT 'YOGYAKARTA', 'DI YOGYAKARTA', 'GEO'
    UNION ALL SELECT 'DAERAH KHUSUS IBUKOTA JAKARTA', 'DKI JAKARTA', 'GEO'
    UNION ALL SELECT 'DKI', 'DKI JAKARTA', 'GEO'
    UNION ALL SELECT 'DKI JAKARTA', 'DKI JAKARTA', 'GEO'
    UNION ALL SELECT 'JAKARTA', 'DKI JAKARTA', 'GEO'
    UNION ALL SELECT 'JKT', 'DKI JAKARTA', 'GEO'
    UNION ALL SELECT 'GORONTALO', 'GORONTALO', 'GEO'
    UNION ALL SELECT 'BIL', 'INDONESIA', 'NON_GEO'
    UNION ALL SELECT 'BILL', 'INDONESIA', 'NON_GEO'
    UNION ALL SELECT 'DSP', 'INDONESIA', 'NON_GEO'
    UNION ALL SELECT 'IDZ', 'INDONESIA', 'NON_GEO'
    UNION ALL SELECT 'IDZ01', 'INDONESIA', 'NON_GEO'
    UNION ALL SELECT 'IDZ99', 'INDONESIA', 'NON_GEO'
    UNION ALL SELECT 'INDONESIA', 'INDONESIA', 'NON_GEO'
    UNION ALL SELECT 'SEE', 'INDONESIA', 'NON_GEO'
    UNION ALL SELECT 'SEED', 'INDONESIA', 'NON_GEO'
    UNION ALL SELECT 'SHPFY', 'INDONESIA', 'NON_GEO'
    UNION ALL SELECT 'JAMBI', 'JAMBI', 'GEO'
    UNION ALL SELECT 'JAZ', 'JAMBI', 'STORE_CODE'
    UNION ALL SELECT 'JABAR', 'JAWA BARAT', 'GEO'
    UNION ALL SELECT 'JAWA BARAT', 'JAWA BARAT', 'GEO'
    UNION ALL SELECT 'WEST JAVA', 'JAWA BARAT', 'GEO'
    UNION ALL SELECT 'CENTRAL JAVA', 'JAWA TENGAH', 'GEO'
    UNION ALL SELECT 'JATENG', 'JAWA TENGAH', 'GEO'
    UNION ALL SELECT 'JAWA TENGAH', 'JAWA TENGAH', 'GEO'
    UNION ALL SELECT 'EAST JAVA', 'JAWA TIMUR', 'GEO'
    UNION ALL SELECT 'JATIM', 'JAWA TIMUR', 'GEO'
    UNION ALL SELECT 'JAWA TIMUR', 'JAWA TIMUR', 'GEO'
    UNION ALL SELECT 'KALBAR', 'KALIMANTAN BARAT', 'GEO'
    UNION ALL SELECT 'KALIMANTAN BARAT', 'KALIMANTAN BARAT', 'GEO'
    UNION ALL SELECT 'WEST KALIMANTAN', 'KALIMANTAN BARAT', 'GEO'
    UNION ALL SELECT 'KALIMANTAN SELATAN', 'KALIMANTAN SELATAN', 'GEO'
    UNION ALL SELECT 'KALSEL', 'KALIMANTAN SELATAN', 'GEO'
    UNION ALL SELECT 'SOUTH KALIMANTAN', 'KALIMANTAN SELATAN', 'GEO'
    UNION ALL SELECT 'CENTRAL KALIMANTAN', 'KALIMANTAN TENGAH', 'GEO'
    UNION ALL SELECT 'KALIMANTAN TENGAH', 'KALIMANTAN TENGAH', 'GEO'
    UNION ALL SELECT 'KALTENG', 'KALIMANTAN TENGAH', 'GEO'
    UNION ALL SELECT 'EAST KALIMANTAN', 'KALIMANTAN TIMUR', 'GEO'
    UNION ALL SELECT 'KALIMANTAN TIMUR', 'KALIMANTAN TIMUR', 'GEO'
    UNION ALL SELECT 'KALTIM', 'KALIMANTAN TIMUR', 'GEO'
    UNION ALL SELECT 'KEC. KAUBUN', 'KALIMANTAN TIMUR', 'MISPLACED'
    UNION ALL SELECT 'KALIMANTAN UTARA', 'KALIMANTAN UTARA', 'GEO'
    UNION ALL SELECT 'KALTARA', 'KALIMANTAN UTARA', 'GEO'
    UNION ALL SELECT 'NORTH KALIMANTAN', 'KALIMANTAN UTARA', 'GEO'
    UNION ALL SELECT 'BABEL', 'KEPULAUAN BANGKA BELITUNG', 'GEO'
    UNION ALL SELECT 'BANGKA BELITUNG', 'KEPULAUAN BANGKA BELITUNG', 'GEO'
    UNION ALL SELECT 'BANGKA BELITUNG ISLANDS', 'KEPULAUAN BANGKA BELITUNG', 'GEO'
    UNION ALL SELECT 'KEPULAUAN BANGKA BELITUNG', 'KEPULAUAN BANGKA BELITUNG', 'GEO'
    UNION ALL SELECT 'KEPRI', 'KEPULAUAN RIAU', 'GEO'
    UNION ALL SELECT 'KEPULAUAN RIAU', 'KEPULAUAN RIAU', 'GEO'
    UNION ALL SELECT 'RIAU ISLANDS', 'KEPULAUAN RIAU', 'GEO'
    UNION ALL SELECT 'JALAN LINTAS RAWAJITU', 'LAMPUNG', 'MISPLACED'
    UNION ALL SELECT 'LAMPUNG', 'LAMPUNG', 'GEO'
    UNION ALL SELECT 'LAZ', 'LAMPUNG', 'STORE_CODE'
    UNION ALL SELECT 'MALUKU', 'MALUKU', 'GEO'
    UNION ALL SELECT 'MALUKU UTARA', 'MALUKU UTARA', 'GEO'
    UNION ALL SELECT 'MALUT', 'MALUKU UTARA', 'GEO'
    UNION ALL SELECT 'NORTH MALUKU', 'MALUKU UTARA', 'GEO'
    UNION ALL SELECT 'NTB', 'NUSA TENGGARA BARAT', 'GEO'
    UNION ALL SELECT 'NUSA TENGGARA BARAT', 'NUSA TENGGARA BARAT', 'GEO'
    UNION ALL SELECT 'NUSA TENGGARA BARAT (NTB)', 'NUSA TENGGARA BARAT', 'GEO'
    UNION ALL SELECT 'WEST NUSA TENGGARA', 'NUSA TENGGARA BARAT', 'GEO'
    UNION ALL SELECT 'EAST NUSA TENGGARA', 'NUSA TENGGARA TIMUR', 'GEO'
    UNION ALL SELECT 'NTT', 'NUSA TENGGARA TIMUR', 'GEO'
    UNION ALL SELECT 'NUSA TENGGARA TIMUR', 'NUSA TENGGARA TIMUR', 'GEO'
    UNION ALL SELECT 'PAPUA', 'PAPUA', 'GEO'
    UNION ALL SELECT 'PAPUA BARAT', 'PAPUA BARAT', 'GEO'
    UNION ALL SELECT 'WEST PAPUA', 'PAPUA BARAT', 'GEO'
    UNION ALL SELECT 'PAPUA BARAT DAYA', 'PAPUA BARAT DAYA', 'GEO'
    UNION ALL SELECT 'SOUTHWEST PAPUA', 'PAPUA BARAT DAYA', 'GEO'
    UNION ALL SELECT 'HIGHLAND PAPUA', 'PAPUA PEGUNUNGAN', 'GEO'
    UNION ALL SELECT 'PAPUA PEGUNUNGAN', 'PAPUA PEGUNUNGAN', 'GEO'
    UNION ALL SELECT 'PAPUA SELATAN', 'PAPUA SELATAN', 'GEO'
    UNION ALL SELECT 'SOUTH PAPUA', 'PAPUA SELATAN', 'GEO'
    UNION ALL SELECT 'CENTRAL PAPUA', 'PAPUA TENGAH', 'GEO'
    UNION ALL SELECT 'PAPUA TENGAH', 'PAPUA TENGAH', 'GEO'
    UNION ALL SELECT 'RIAU', 'RIAU', 'GEO'
    UNION ALL SELECT 'RIZ', 'RIAU', 'STORE_CODE'
    UNION ALL SELECT 'SULAWESI BARAT', 'SULAWESI BARAT', 'GEO'
    UNION ALL SELECT 'SULBAR', 'SULAWESI BARAT', 'GEO'
    UNION ALL SELECT 'WEST SULAWESI', 'SULAWESI BARAT', 'GEO'
    UNION ALL SELECT 'SOUTH SULAWESI', 'SULAWESI SELATAN', 'GEO'
    UNION ALL SELECT 'SULAWESI SELATAN', 'SULAWESI SELATAN', 'GEO'
    UNION ALL SELECT 'SULSEL', 'SULAWESI SELATAN', 'GEO'
    UNION ALL SELECT 'CENTRAL SULAWESI', 'SULAWESI TENGAH', 'GEO'
    UNION ALL SELECT 'SULAWESI TENGAH', 'SULAWESI TENGAH', 'GEO'
    UNION ALL SELECT 'SULTENG', 'SULAWESI TENGAH', 'GEO'
    UNION ALL SELECT 'SOUTHEAST SULAWESI', 'SULAWESI TENGGARA', 'GEO'
    UNION ALL SELECT 'SULAWESI TENGGARA', 'SULAWESI TENGGARA', 'GEO'
    UNION ALL SELECT 'SULTRA', 'SULAWESI TENGGARA', 'GEO'
    UNION ALL SELECT 'NORTH SULAWESI', 'SULAWESI UTARA', 'GEO'
    UNION ALL SELECT 'SULAWESI UTARA', 'SULAWESI UTARA', 'GEO'
    UNION ALL SELECT 'SULUT', 'SULAWESI UTARA', 'GEO'
    UNION ALL SELECT 'SUMATERA BARAT', 'SUMATERA BARAT', 'GEO'
    UNION ALL SELECT 'SUMATRA BARAT', 'SUMATERA BARAT', 'GEO'
    UNION ALL SELECT 'SUMBAR', 'SUMATERA BARAT', 'GEO'
    UNION ALL SELECT 'WEST SUMATRA', 'SUMATERA BARAT', 'GEO'
    UNION ALL SELECT 'SOUTH SUMATRA', 'SUMATERA SELATAN', 'GEO'
    UNION ALL SELECT 'SUMATERA SELATAN', 'SUMATERA SELATAN', 'GEO'
    UNION ALL SELECT 'SUMATRA SELATAN', 'SUMATERA SELATAN', 'GEO'
    UNION ALL SELECT 'SUMSEL', 'SUMATERA SELATAN', 'GEO'
    UNION ALL SELECT 'NORTH SUMATRA', 'SUMATERA UTARA', 'GEO'
    UNION ALL SELECT 'SUMATERA UTARA', 'SUMATERA UTARA', 'GEO'
    UNION ALL SELECT 'SUMATRA UTARA', 'SUMATERA UTARA', 'GEO'
    UNION ALL SELECT 'SUMUT', 'SUMATERA UTARA', 'GEO'
    UNION ALL SELECT 'SUZ', 'SUMATERA UTARA', 'STORE_CODE'
    UNION ALL SELECT '', 'UNIDENTIFIED', 'UNKNOWN'
    UNION ALL SELECT 'UNIDENTIFIED', 'UNIDENTIFIED', 'UNKNOWN'
    )
    GROUP BY geo_key
),

-- ------------------------------------------------------------------
-- (A) Claim Smallholders dari larkbase
-- ------------------------------------------------------------------
invoice_lark AS (
    SELECT
        upper(trimBoth(replace(replace(invoice_lark, 'INV#', ''), '#', ''))) AS invoice_lark,
        order_lark,
        trimBoth(pic_name) AS pic_name,
        min(created_dt) AS min_created_dt
    FROM (
        SELECT
            multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice) AS invoice_lark,
            order_no AS order_lark,
            assignee AS pic_name,
            toDateTime(toFloat64OrNull(created_date) / 1000, 'Asia/Jakarta') AS created_dt
        FROM default.larkbase_salesopportunities_smallholdersteam
        WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
        -- tim lain tidak dipakai (fokus Smallholders): salesteam, millsteam,
        -- suppliersteam, dg, plantation, bdffb, aspekpir
    ) AS a
    WHERE invoice_lark NOT IN ('INV/20250501/SEED/114629','INV/20250506/SEED/114777','INV/20250103/RIZ04/100545','INV/20250111/SUZ45/100057')
    GROUP BY 1, 2, 3
),
lark_keys AS (
    SELECT DISTINCT invoice_lark FROM invoice_lark
),
summary AS (
    SELECT
        multiIf(de.invoice_no != '', de.invoice_no,
                so.name  != '', concat('INV/', replaceAll(so.name,  '#', ''), '/SHPFY'),
                so1.name != '', concat('INV/', replaceAll(so1.name, '#', ''), '/SHPFY'),
                so2.name != '', concat('INV/', replaceAll(so2.name, '#', ''), '/SHPFY'),
                NULL) AS invoice_no,
        il.pic_name AS pic_name,
        row_number() OVER (PARTITION BY il.invoice_lark ORDER BY il.min_created_dt DESC) AS seqno
    FROM invoice_lark AS il
    ANY LEFT JOIN (
        SELECT invoice_no, order_no
        FROM sawitpro_datamart.datamart_ecommerce
        WHERE invoice_status IN ('PAID', 'PARTIAL_PAID')
          AND toString(sale_order_status) NOT IN ('CANCELLED', 'CANCELED', 'DRAFT')
          AND invoice_no IN (SELECT invoice_lark FROM lark_keys)
    ) AS de ON il.invoice_lark = de.invoice_no
    ANY LEFT JOIN (
        SELECT name FROM default.shopify_orders
        WHERE replace(name, '#', '') IN (SELECT invoice_lark FROM lark_keys)
    ) AS so ON il.invoice_lark = replace(so.name, '#', '')
    ANY LEFT JOIN (
        SELECT name FROM default.shopify_orders
        WHERE concat('INV/', replace(trimBoth(name), '#', ''), '/SHPFY') IN (SELECT invoice_lark FROM lark_keys)
    ) AS so2 ON il.invoice_lark = concat('INV/', replace(trimBoth(so2.name), '#', ''), '/SHPFY')
    ANY LEFT JOIN (
        SELECT name, ref FROM odoo_database.account_move
        WHERE name IN (SELECT invoice_lark FROM lark_keys)
    ) AS am ON am.name = il.invoice_lark
    ANY LEFT JOIN (
        SELECT name FROM default.shopify_orders
        WHERE upper(name) IN (
            SELECT upper(ref) FROM odoo_database.account_move
            WHERE name IN (SELECT invoice_lark FROM lark_keys) AND ref != ''
        )
    ) AS so1 ON upper(so1.name) = upper(am.ref)
    WHERE (de.order_no != '') OR (so.name != '') OR (am.name != '') OR (so2.name != '')
),
-- PIC Smallholders per invoice
data_order_pic AS (
    SELECT
        invoice_no,
        arrayStringConcat(arraySort(groupUniqArray(pic_name)), ';') AS pic_names,
        arrayStringConcat(arraySort(groupUniqArray(multiIf(seqno = 1, pic_name, NULL))), ';') AS pic_names_last
    FROM summary
    WHERE invoice_no IS NOT NULL
    GROUP BY invoice_no
),
-- fallback via order_no (1 baris per order_no)
pic_by_order AS (
    SELECT il.order_lark AS order_no,
           any(dp.pic_names) AS pic_names,
           any(dp.pic_names_last) AS pic_names_last
    FROM invoice_lark AS il
    INNER JOIN data_order_pic AS dp ON il.invoice_lark = dp.invoice_no
    WHERE il.order_lark != ''
    GROUP BY il.order_lark
),
sh_keys AS (
    SELECT invoice_no AS k FROM data_order_pic
    UNION ALL
    SELECT order_no FROM pic_by_order
),

-- ------------------------------------------------------------------
-- (B) Branch Shopify — hanya invoice Smallholders, tanpa layanan/minyak
-- ------------------------------------------------------------------
d_src AS (
    SELECT
        d.*,
        coalesce(nullIf(p_inv.pic_names, ''),      nullIf(p_ord.pic_names, ''))      AS sh_pic_names,
        coalesce(nullIf(p_inv.pic_names_last, ''), nullIf(p_ord.pic_names_last, '')) AS sh_pic_names_last,
        p_inv.pic_names AS sh_pic_names_inv
    FROM sawitpro_datamart.fct_new_sale_order_shopify AS d
    ANY LEFT JOIN data_order_pic AS p_inv ON p_inv.invoice_no = d.invoice_no
    ANY LEFT JOIN pic_by_order   AS p_ord ON p_ord.order_no   = d.invoice_no
    WHERE d.invoice_no IN (SELECT k FROM sh_keys)
      AND d.sale_order_created_time >= start_ts
      AND NOT match(concat(ifNull(d.item, ''), '|', ifNull(d.product_category, ''), '|', ifNull(d.product_type, '')), excluded_item_regex)
),
so_f AS (
    SELECT
        concat('INV/', replaceAll(name, '#', ''), '/SHPFY') AS inv_key,
        id, line_items, landing_site, tags, note_attributes, discount_codes,
        shipping_address_province, billing_address_province, customer_default_address_province,
        shipping_address_zip, billing_address_zip, customer_default_address_zip,
        shipping_address_city, shipping_address_longitude, shipping_address_latitude,
        customer_default_address_address1, customer_default_address_address2, customer_default_address_city
    FROM default.shopify_orders
    WHERE concat('INV/', replaceAll(name, '#', ''), '/SHPFY') IN (SELECT k FROM sh_keys)
),
tt_f AS (
    SELECT app_type, transaction_id, argMax(app_type_tokosawit, event_time) AS app_type_tokosawit
    FROM default.flatten_eventapp_raw
    WHERE transaction_id != '' AND app_type LIKE 'sawitpro%'
      AND transaction_id IN (SELECT toString(id) FROM so_f)
    GROUP BY app_type, transaction_id
),
cs_f AS (
    SELECT order_id, store_name, utm_medium
    FROM default.shopify_campaign_sales
    WHERE order_id IN (SELECT toString(id) FROM so_f)
),
sku_line AS (
    SELECT
        invoice_no, item,
        --   1) exact real_item_name match  2) name-prefix match  3) first line item
        multiIf(li_exact != '', li_exact, li_prefix != '', li_prefix, li_arr[1]) AS li
    FROM (
        SELECT
            d.invoice_no AS invoice_no,
            d.item AS item,
            JSONExtractArrayRaw(ifNull(so.line_items, '[]')) AS li_arr,
            arrayFirst(x -> JSONExtractString(x, 'name') = d.real_item_name, li_arr) AS li_exact,
            arrayFirst(x -> startsWith(JSONExtractString(x, 'name'), d.item) OR startsWith(d.item, JSONExtractString(x, 'name')), li_arr) AS li_prefix
        FROM d_src AS d
        ANY LEFT JOIN so_f AS so ON so.inv_key = d.invoice_no
    )
),

-- ------------------------------------------------------------------
-- (C) Branch ProApp (datamart_ecommerce) — filter yang sama
-- ------------------------------------------------------------------
e_src AS (
    SELECT
        e.*,
        coalesce(nullIf(p_inv.pic_names, ''),      nullIf(p_ord.pic_names, ''))      AS sh_pic_names,
        coalesce(nullIf(p_inv.pic_names_last, ''), nullIf(p_ord.pic_names_last, '')) AS sh_pic_names_last
    FROM sawitpro_datamart.datamart_ecommerce AS e
    ANY LEFT JOIN data_order_pic AS p_inv ON p_inv.invoice_no = e.invoice_no
    ANY LEFT JOIN pic_by_order   AS p_ord ON p_ord.order_no   = e.order_no
    WHERE (e.invoice_no IN (SELECT k FROM sh_keys) OR e.order_no IN (SELECT k FROM sh_keys))
      AND ((e.invoice_status = 'PAID') OR (toString(e.sale_order_status) IN ('COMPLETED', '32')))
      AND e.sale_order_created_time >= start_ts
      AND NOT match(concat(ifNull(e.item, ''), '|', ifNull(e.product_cat, '')), excluded_item_regex)
      AND e.invoice_no NOT IN (SELECT invoice_no FROM sawitpro_datamart.fct_new_sale_order_shopify)
),
target_users AS (
    SELECT user_id FROM d_src
    UNION ALL
    SELECT user_id FROM e_src
),
-- order pertama customer dari SEMUA order sejak 2025 (tim mana pun)
user_first_order AS (
    SELECT user_id, min(dt) AS first_order_date
    FROM (
        SELECT user_id, toDate(toTimeZone(sale_order_created_time, 'Asia/Jakarta')) AS dt
        FROM sawitpro_datamart.fct_new_sale_order_shopify
        WHERE sale_order_created_time >= start_ts
          AND user_id IN (SELECT user_id FROM target_users)
        UNION ALL
        SELECT user_id, toDate(toTimeZone(sale_order_created_time, 'Asia/Jakarta'))
        FROM sawitpro_datamart.datamart_ecommerce
        WHERE ((invoice_status = 'PAID') OR (toString(sale_order_status) IN ('COMPLETED', '32')))
          AND sale_order_created_time >= start_ts
          AND user_id IN (SELECT user_id FROM target_users)
          AND invoice_no NOT IN (SELECT invoice_no FROM sawitpro_datamart.fct_new_sale_order_shopify)
    )
    GROUP BY user_id
),

data_ecommerce_base AS (
    SELECT
        CAST(toDate(toTimeZone(d.sale_order_created_time, 'Asia/Jakarta')) AS Nullable(Date)) AS dates,
        d.store_name AS app_type,
        d.sh_pic_names AS pic_names,
        d.sh_pic_names_last AS pic_names_last,
        d.user_id AS user_id,
        d.item AS item,
        d.invoice_no AS invoice_no,
        d.invoice_status AS invoice_status,
        toString(d.sale_order_status) AS sale_order_status,
        CAST(d.potential_gmv AS Nullable(Float64)) AS potential_gmvs,
        CAST(d.original_gmv AS Nullable(Float64)) AS original_gmv,
        CAST(multiIf(toString(d.sale_order_status) IN ('COMPLETED', '32'), d.potential_gmv, NULL) AS Nullable(Float64)) AS gmv,
        CAST(d.paid_with_bank_idr AS Nullable(Float64)) AS revenue,
        CAST(ifNull(d.total_price, 0) AS Nullable(Float64)) AS sales_amount,
        CAST(d.qty AS Nullable(Float64)) AS qty,
        CAST(ifNull(toFloat64OrNull(toString(d.shipping_cost)), 0) AS Nullable(Float64)) AS shipping_cost,
        CAST(ifNull(toFloat64OrNull(toString(d.discount_amount_in_idr)), 0) AS Nullable(Float64)) AS discount_amount,
        d.source_name AS source_name,
        multiIf(so.shipping_address_province != '', so.shipping_address_province, so.billing_address_province != '', so.billing_address_province, so.customer_default_address_province) AS province_raw,
        multiIf(so.shipping_address_zip != '', so.shipping_address_zip, so.billing_address_zip != '', so.billing_address_zip, so.customer_default_address_zip) AS zip_raw,
        CAST(multiIf(match(d.item, '(?i)herb'), 'Herbisida', d.product_category) AS Nullable(String)) AS prod_cat,
        multiIf(d.source_name = 'shopify_draft_order', 'DRAFT ORDER', d.sh_pic_names_inv != '', 'DRAFT ORDER', cs.utm_medium != '', replaceAll(UPPER(cs.utm_medium), 'PROAPP', ''), tt.app_type_tokosawit = 'MEMBER', 'AGEN', tt.app_type_tokosawit != '', tt.app_type_tokosawit, 'WEB') AS app_type_prev,
        multiIf(cs.utm_medium != '', replaceAll(UPPER(cs.utm_medium), 'PROAPP', ''), tt.app_type_tokosawit = 'MEMBER', 'AGEN', tt.app_type_tokosawit != '', tt.app_type_tokosawit, 'WEB') AS application_type,
        extractURLParameter(so.landing_site, 'utm_source') AS utm_source,
        d.customer_email AS customer_email,
        d.customer_phone_number AS customer_phone_number,
        trimBoth(d.name) AS customer_name,
        so.shipping_address_city AS shipping_address_city,
        so.customer_default_address_address1 AS customer_default_address_address1,
        so.customer_default_address_city AS customer_default_address_city,
        so.tags AS tags,
        so.note_attributes AS note_attributes,
        JSONExtractString(so.discount_codes, '0', 'code') AS discount_code,
        toFloat64OrNull(JSONExtractString(so.discount_codes, '0', 'amount')) AS discount_amount_code,
        CAST(
            COALESCE(
                toDateOrNull(toString(toTimeZone(parseDateTimeBestEffortOrNull(toString(d.paid_with_bank_time)), 'Asia/Jakarta'))),
                toDateOrNull(toString(toTimeZone(parseDateTimeBestEffortOrNull(toString(d.max_payment_at)), 'Asia/Jakarta')))
            ) AS Nullable(Date)
        ) AS payment_date,
        CAST(toDateOrNull(toString(toTimeZone(parseDateTimeBestEffortOrNull(toString(d.min_payment_at)), 'Asia/Jakarta'))) AS Nullable(Date)) AS dp_payment_date,
        CAST(toDateOrNull(toString(toTimeZone(parseDateTimeBestEffortOrNull(toString(d.max_payment_at)), 'Asia/Jakarta'))) AS Nullable(Date)) AS full_payment_date,
        CAST(toDateOrNull(toString(toTimeZone(parseDateTimeBestEffortOrNull(toString(d.completed_at)), 'Asia/Jakarta'))) AS Nullable(Date)) AS completion_date,
        CASE
            WHEN ifNull(toFloat64OrNull(toString(d.dp_paid_amount)), 0) = ifNull(toFloat64OrNull(toString(d.current_total_price)), 0) THEN 'TOD'
            WHEN ifNull(toFloat64OrNull(toString(d.dp_paid_amount)), 0) < ifNull(toFloat64OrNull(toString(d.current_total_price)), 0) THEN 'DP'
            ELSE ''
        END AS payment_type,
        d.dp_paid_amount AS dp_paid_amount,
        CASE WHEN ifNull(toFloat64OrNull(toString(d.shipping_cost)), 0) = 0 THEN 'Pickup' ELSE 'Delivery' END AS delivery_type,
        CAST(ifNull(toFloat64OrNull(toString(d.point_redemption_point_idr)), 0) AS Nullable(Float64)) AS point_redemption_idr,
        CAST(ifNull(toFloat64OrNull(toString(d.discount_amount_in_idr)), 0) AS Nullable(Float64)) AS discount_amount_in_idr,
        JSONExtractUInt(sl.li, 'grams') / 1000 AS sku_kg,
        JSONExtractUInt(sl.li, 'product_id') AS product_id,
        JSONExtractString(sl.li, 'sku') AS sku,
        d.order_line_state AS order_line_state,
        d.odoo_delivery_status AS odoo_delivery_status,
        CAST(ifNull(toFloat64OrNull(toString(d.num_of_deliveries)), 0) AS Nullable(Float64)) AS num_of_deliveries,
        toString(d.pickup_delivery_no) AS pickup_delivery_no,
        CAST(parseDateTimeBestEffortOrNull(toString(d.min_schedule_date)) AS Nullable(DateTime)) AS delivery_scheduled_at,
        CAST(parseDateTimeBestEffortOrNull(toString(d.max_schedule_date)) AS Nullable(DateTime)) AS delivery_completed_scheduled_at,
        CAST(parseDateTimeBestEffortOrNull(toString(d.cancelled_at)) AS Nullable(DateTime)) AS cancelled_at,
        CAST(parseDateTimeBestEffortOrNull(toString(d.ready_at)) AS Nullable(DateTime)) AS ready_at,
        CAST(parseDateTimeBestEffortOrNull(toString(d.invoice_expired_time)) AS Nullable(DateTime)) AS invoice_expired_time,
        coalesce(nullif(d.payment_method_1, ''), nullif(d.payment_method_2, '')) AS payment_channel_raw,
        multiIf(
            payment_channel_raw ILIKE '%midtrans%', 'Midtrans',
            payment_channel_raw ILIKE '%bank transfer%', 'Bank Transfer',
            payment_channel_raw ILIKE '%manual%', 'Manual',
            payment_channel_raw ILIKE '%xendit%', 'Xendit',
            payment_channel_raw = '', 'No Payment Recorded',
            'Others'
        ) AS payment_origin

    FROM d_src AS d
    ANY LEFT JOIN sku_line AS sl ON (sl.invoice_no = d.invoice_no) AND (sl.item = d.item)
    ANY LEFT JOIN so_f AS so ON so.inv_key = d.invoice_no
    ANY LEFT JOIN tt_f AS tt ON (tt.app_type = replaceAll(d.store_name, '-', '')) AND (tt.transaction_id = toString(so.id))
    ANY LEFT JOIN cs_f AS cs ON (cs.order_id = toString(so.id)) AND (cs.store_name = d.store_name)

    UNION ALL

    SELECT
        CAST(toTimeZone(e.sale_order_created_time, 'Asia/Jakarta') AS Nullable(Date)) AS dates,
        so_main.app_type AS app_type,
        e.sh_pic_names AS pic_names,
        e.sh_pic_names_last AS pic_names_last,
        e.user_id AS user_id,
        e.item AS item,
        e.invoice_no AS invoice_no,
        e.invoice_status AS invoice_status,
        toString(e.sale_order_status) AS sale_order_status,
        CAST(e.potential_gmv AS Nullable(Float64)) AS potential_gmvs,
        CAST(e.potential_gmv AS Nullable(Float64)) - CAST(ifNull(toFloat64OrNull(toString(e.point_redemption_idr)), 0) AS Nullable(Float64)) - CAST(ifNull(toFloat64OrNull(toString(e.discount)), 0) AS Nullable(Float64)) AS original_gmv,
        CAST(multiIf(toString(e.sale_order_status) IN ('COMPLETED', '32'), e.potential_gmv, NULL) AS Nullable(Float64)) AS gmv,
        CAST(e.paid_with_bank AS Nullable(Float64)) AS revenue,
        CAST(ifNull(e.total_price_idr, 0) AS Nullable(Float64)) AS sales_amount,
        CAST(e.quantity AS Nullable(Float64)) AS qty,
        CAST(ifNull(toFloat64OrNull(toString(e.total_shipping_cost)), 0) AS Nullable(Float64)) AS shipping_cost,
        CAST(ifNull(toFloat64OrNull(toString(e.point_redemption_idr)), 0) AS Nullable(Float64)) AS discount_amount,
        multiIf(so_main.app_type = 'ADMIN_WEB', 'shopify_draft_order', 'PRO-APP') AS source_name,
        substring(e.invoice_no, 14, 3) AS province_raw,
        NULL AS zip_raw,
        CAST(multiIf(match(e.item, '(?i)herb'), 'Herbisida', e.product_cat) AS Nullable(String)) AS prod_cat,
        multiIf(so_main.app_type = '', 'OTHERS', so_main.app_type = 'ADMIN_WEB', 'DRAFT ORDER', so_main.app_type = 'MEMBER', 'AGEN', so_main.app_type) AS app_type_prev,
        multiIf(so_main.app_type = '', 'OTHERS', so_main.app_type = 'MEMBER', 'AGEN', so_main.app_type) AS application_type,
        NULL AS utm_source,
        u_e.email AS customer_email,
        u_e.phone_no AS customer_phone_number,
        trimBoth(e.name) AS customer_name,
        NULL AS shipping_address_city,
        NULL AS customer_default_address_address1,
        NULL AS customer_default_address_city,
        NULL AS tags,
        NULL AS note_attributes,
        NULL AS discount_code,
        NULL AS discount_amount_code,
        CAST(
            COALESCE(
                toDateOrNull(toString(toTimeZone(parseDateTimeBestEffortOrNull(toString(e.dp_paid_at)), 'Asia/Jakarta'))),
                toDateOrNull(toString(toTimeZone(parseDateTimeBestEffortOrNull(toString(e.paid_with_bank_time)), 'Asia/Jakarta')))
            ) AS Nullable(Date)
        ) AS payment_date,
        CAST(toDateOrNull(toString(toTimeZone(parseDateTimeBestEffortOrNull(toString(e.dp_paid_at)), 'Asia/Jakarta'))) AS Nullable(Date)) AS dp_payment_date,
        CAST(toDateOrNull(toString(toTimeZone(parseDateTimeBestEffortOrNull(toString(e.paid_with_bank_time)), 'Asia/Jakarta'))) AS Nullable(Date)) AS full_payment_date,
        CAST(
            multiIf(
                toString(e.sale_order_status) IN ('COMPLETED', '32'),
                toDate(toTimeZone(parseDateTimeBestEffortOrNull(toString(e.completed_at)), 'Asia/Jakarta')),
                NULL
            ) AS Nullable(Date)
        ) AS completion_date,
        CASE
            WHEN e.dp_paid_amount IS NULL OR toString(e.dp_paid_amount) = '' OR toString(e.dp_paid_amount) = '0' THEN 'TOD'
            ELSE 'DP'
        END AS payment_type,
        e.dp_paid_amount AS dp_paid_amount,
        CASE WHEN ifNull(toFloat64OrNull(toString(e.total_shipping_cost)), 0) = 0 THEN 'Pickup' ELSE 'Delivery' END AS delivery_type,
        CAST(ifNull(toFloat64OrNull(toString(e.point_redemption_idr)), 0) AS Nullable(Float64)) AS point_redemption_idr,
        CAST(ifNull(toFloat64OrNull(toString(e.discount)), 0) AS Nullable(Float64)) AS discount_amount_in_idr,
        NULL AS sku_kg,
        NULL AS product_id,
        NULL AS sku,
        CAST(NULL AS Nullable(String)) AS order_line_state,
        CAST(NULL AS Nullable(String)) AS odoo_delivery_status,
        CAST(NULL AS Nullable(Float64)) AS num_of_deliveries,
        CAST(NULL AS Nullable(String)) AS pickup_delivery_no,
        CAST(NULL AS Nullable(DateTime)) AS delivery_scheduled_at,
        CAST(NULL AS Nullable(DateTime)) AS delivery_completed_scheduled_at,
        CAST(NULL AS Nullable(DateTime)) AS cancelled_at,
        CAST(NULL AS Nullable(DateTime)) AS ready_at,
        CAST(NULL AS Nullable(DateTime)) AS invoice_expired_time,
        CAST(NULL AS Nullable(String)) AS payment_channel_raw,
        CAST('Others' AS String) AS payment_origin

    FROM e_src AS e
    INNER JOIN (
        SELECT id, app_type FROM default.sale_order
        WHERE id IN (SELECT sale_order_id FROM e_src)
    ) AS so_main ON e.sale_order_id = so_main.id
    INNER JOIN (
        SELECT id, email, phone_no FROM default.user
        WHERE fraud_flag != 5 AND id IN (SELECT user_id FROM e_src)
    ) AS u_e ON u_e.id = e.user_id
),
data_ecommerce AS (
    SELECT
        b.*,
        b.sku_kg * b.qty AS total_kg,
        ufo.first_order_date AS first_order_date,
        trimBoth(upper(ifNull(if(zip_raw IS NOT NULL, zip_raw,
            if(source_name IN ('shopee', 'tiktok', 'tokopedia'),
               trimBoth(splitByChar(',', ifNull(customer_default_address_address1, ''))[-1]),
               zip_raw)), ''))) AS zip_cand,
        multiIf(
            position(zip_cand, '*') > 0, 'Unidentified',
            zip_cand = '', 'Unidentified',
            NOT match(zip_cand, '^[0-9]+$'), 'Unidentified',
            zip_cand
        ) AS customer_zip,
        arrayFirst(x -> x != '' AND position(x, '*') = 0, [
            trimBoth(ifNull(province_raw, '')),
            if(source_name IN ('shopee', 'tiktok', 'tokopedia'),
               trimBoth(splitByChar(',', ifNull(customer_default_address_address1, ''))[-3]),
               '')
        ]) AS province_src,
        trimBoth(replaceRegexpAll(upper(province_src), '\\s+', ' ')) AS province_key
    FROM data_ecommerce_base AS b
    ANY LEFT JOIN user_first_order AS ufo ON ufo.user_id = b.user_id
),
-- lookup tambahan hanya untuk user / zip / phone yang ada di hasil
cc AS (
    SELECT
        u.id AS u_id,
        trimBoth(u.name) AS u_name,
        u.email AS u_email,
        u.phone_no AS u_phone_no,
        trimBoth(u2.name) AS duta_name,
        u2.phone_no AS duta_phone_no,
        multiIf((ak.profession LIKE 'ASPEK%') OR (ak.profession LIKE '%KUD%') OR (al.created_by IN ('samuel-kant', 'data-pisifera', 'data-mesocarp')), 'ASPEKPIR', ak.profession LIKE '%KUD%', 'KUD', (al.id IS NOT NULL) AND (al.id != ''), 'DUTA PROGRAM', 'Others') AS notes
    FROM default.user AS u
    ANY LEFT JOIN default.ambassador_leads AS al ON al.leads_user_id = u.id
    ANY LEFT JOIN default.ambassador_kyc AS ak ON al.ambassador_user_id = ak.user_id
    ANY LEFT JOIN default.user AS u2 ON ak.user_id = u2.id
    WHERE u.fraud_flag != 5
      AND u.id IN (SELECT user_id FROM target_users)
),
area_f AS (
    SELECT zip_code, any(level_3) AS level_3
    FROM default.area
    GROUP BY zip_code
),
lsl AS (
    SELECT phone_normalized AS lead_phone, any(user_type) AS lead_user_type
    FROM default.larkbase_salesopportunities_leads
    WHERE ifNull(phone_normalized, '') != '' AND trimBoth(ifNull(toString(user_type), '')) != ''
      AND phone_normalized IN (SELECT u_phone_no FROM cc)
    GROUP BY phone_normalized
),
du AS (
    SELECT
        phone_no AS du_phone_no,
        any(multiIf(
            user_role = 'AMBASSADOR' AND user_role_group = 'COOPERATIVE', 'KUD',
            user_role = 'OWNER' AND user_role_group = 'MERCHANT', 'TOKO TANI',
            user_role
        )) AS du_user_role
    FROM sawitpro_datamart.datamart_user
    WHERE ifNull(phone_no, '') != '' AND trimBoth(ifNull(toString(user_role), '')) != ''
      AND phone_no IN (SELECT u_phone_no FROM cc)
    GROUP BY phone_no
)

SELECT
    if(order_source = 'MITRA', 'B2B', 'B2C') AS b2b_b2c,
    concat('#', splitByChar('/', ifNull(de.invoice_no, ''))[2]) AS customer_ref,
    if(de.source_name IN ('shopee', 'tiktok', 'tokopedia'), 'Marketplace', 'Non-Marketplace') AS Sales_App,
    if(de.source_name IN ('shopee', 'tiktok', 'tokopedia'), upper(de.source_name), upper(de.app_type_prev)) AS order_source,
    trimBoth(extract(ifNull(de.tags, ''), 'event_code:([^,]+)')) AS event_code,
    UPPER(coalesce(
        nullif(trimBoth(extract(ifNull(de.tags, ''), 'sales_code:([^,]+)')), ''),
        nullif(trimBoth(JSONExtractString(ifNull(de.note_attributes, '[]'), 1, 'value')), '')
    )) AS sales_code,
    'YES' AS assisted_order,
    coalesce(nullIf(gp.geo_province_std, ''), 'UNMAPPED') AS customer_province,
    upper(coalesce(de.shipping_address_city, de.customer_default_address_city)) AS customer_city,
    if(ifNull(area_f.level_3, '') = '',
       trimBoth(upper(splitByChar(',', ifNull(de.customer_default_address_address1, ''))[-4])),
       area_f.level_3) AS customer_district,
    de.customer_zip AS customer_zip,
    de.dates AS dates,
    MonthName(de.dates) AS month_name,
    toYear(de.dates) AS year_num,
    'Smallholders' AS pic_teams,
    de.pic_names AS pic_names,
    de.user_id AS user_id,
    de.item AS item,
    multiIf(
        de.item ILIKE 'Benih Sawit Topaz 1-3 Seri 4 (100 butir)%', 'Benih',
        customer_ref = '#B2B1940', 'Benih',
        de.prod_cat
    ) AS product_category,
    de.invoice_no AS invoice_no,
    de.invoice_status AS invoice_status,
    de.sale_order_status AS sale_order_status,
    de.potential_gmvs AS potential_gmvs,
    de.gmv AS gmv,
    de.revenue AS revenue,
    de.sales_amount AS sales_amount,
    de.shipping_cost AS shipping_cost,
    de.discount_amount AS discount_amount,
    de.discount_code AS discount_code,
    de.discount_amount_code AS discount_amount_code,
    de.sales_amount + de.shipping_cost - de.discount_amount AS net_sales,
    de.original_gmv AS original_gmv,
    de.qty AS qty,
    de.payment_date AS payment_date,
    de.dp_payment_date AS dp_payment_date,
    de.full_payment_date AS full_payment_date,
    de.completion_date AS completion_date,
    de.first_order_date AS first_order_date,
    if(de.dates = de.first_order_date, 'NEW', 'REPEAT') AS order_retention_status,
    de.payment_type AS payment_type,
    de.dp_paid_amount AS dp_paid_amount,
    de.delivery_type AS delivery_type,
    de.point_redemption_idr AS point_redemption_idr,
    de.discount_amount_in_idr AS discount_amount_in_idr,
    de.sku_kg AS sku_kg,
    de.product_id AS product_id,
    de.sku AS sku,
    de.total_kg AS total_kg,
    de.app_type_prev AS app_type_prev,
    de.application_type AS application_type,
    de.utm_source AS utm_source,
    de.customer_email AS customer_email,
    de.customer_phone_number AS phone_no,
    de.customer_name AS customer_name,
    trimBoth(cc.notes) AS user_groups,
    cc.u_name AS u_name,
    cc.u_email AS u_email,
    cc.u_phone_no AS u_phone_no,
    cc.duta_name AS duta_name,
    cc.duta_phone_no AS duta_phone_no,
    de.payment_channel_raw AS payment_channel_raw,
    de.payment_origin AS payment_origin,
    multiIf(
        de.order_line_state = 'cancel', 'CANCELLED',
        de.sale_order_status IN ('COMPLETED', '32'), 'COMPLETED',
        de.sale_order_status = 'NEW', 'IN PROGRESS',
        de.sale_order_status
    ) AS sales_status,
    -- item layanan (Dokter Sawit) sudah dikecualikan -> semua butuh pengiriman fisik
    multiIf(
        de.odoo_delivery_status = 'full', 'DELIVERED',
        de.odoo_delivery_status = 'pending', 'IN TRANSIT',
        de.odoo_delivery_status = '0' AND de.num_of_deliveries > 0, 'DELIVERED',
        de.odoo_delivery_status = '0', 'NOT YET SHIPPED',
        de.odoo_delivery_status IS NULL, 'NOT YET SHIPPED',
        de.odoo_delivery_status
    ) AS delivery_status,
    de.order_line_state AS order_line_state,
    de.odoo_delivery_status AS odoo_delivery_status,
    de.num_of_deliveries AS num_of_deliveries,
    de.pickup_delivery_no AS pickup_delivery_no,
    de.delivery_scheduled_at AS delivery_scheduled_at,
    de.delivery_completed_scheduled_at AS delivery_completed_scheduled_at,
    de.cancelled_at AS cancelled_at,
    de.ready_at AS ready_at,
    de.invoice_expired_time AS invoice_expired_time,
    dateDiff('day', toDate(de.dates), de.payment_date) AS sla_creation_to_payment,
    dateDiff('day', toDate(de.dates), ifNull(de.payment_date, today())) AS sla_creation_to_payment_running,
    dateDiff('day', de.payment_date, de.completion_date) AS sla_payment_to_delivery,
    dateDiff('day', coalesce(de.payment_date, toDate(de.dates)), ifNull(de.completion_date, today())) AS sla_payment_to_delivery_running,
    dateDiff('day', toDate(de.dates), de.completion_date) AS total_SLA,
    dateDiff('day', toDate(de.dates), ifNull(de.completion_date, today())) AS total_SLA_running,
    dateDiff('day', toDate(de.dates), today()) AS Aging,
    coalesce(
        nullIf(trimBoth(ifNull(toString(lsl.lead_user_type), '')), ''),
        nullIf(trimBoth(ifNull(toString(du.du_user_role), '')), ''),
        'Unidentified'
    ) AS user_type
FROM data_ecommerce AS de
ANY LEFT JOIN area_f ON de.customer_zip = area_f.zip_code
ANY LEFT JOIN geo_province AS gp ON de.province_key = gp.geo_key
ANY LEFT JOIN cc ON cc.u_id = de.user_id
ANY LEFT JOIN lsl ON cc.u_phone_no = lsl.lead_phone
ANY LEFT JOIN du ON cc.u_phone_no = du.du_phone_no
ORDER BY dates DESC;
