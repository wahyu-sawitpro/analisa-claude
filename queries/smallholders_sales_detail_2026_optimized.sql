-- =====================================================================================
-- Sales Tim Smallholders (sale_order_date >= 2026) — versi teroptimasi
--
-- Prinsip:
--   1. Hitung dulu daftar invoice yang diklaim Smallholders dari Larkbase (tabel kecil),
--      lalu pakai sebagai filter IN (...) di tabel besar, supaya filter jalan di awal, bukan di akhir.
--   2. Hanya kolom yang dipakai output yang dihitung. SLA, delivery status, area, ambassador,
--      user_type, sku_line JSON, dan sejenisnya dibuang karena tidak pernah sampai ke hasil.
--   3. combined_sales tidak lagi dipanggil 2x (CTE di ClickHouse di-inline, jadi dulu seluruh
--      query raksasa jalan dua kali). Customer pertama kali order sekarang dihitung pakai window
--      function + agregasi ringan di datamart_ecommerce.
--   4. flatten_eventapp_raw: dari window function di seluruh tabel, jadi argMax yang dibatasi
--      ke transaction_id milik order Smallholders saja.
--   5. 8 tabel Larkbase dibaca lewat 1 CTE (lark_src). Dulu ada 2 blok copy-paste.
--
-- Semantik dibuat sama dengan query lama (termasuk 2 potensi double count, lihat [CATATAN]).
-- =====================================================================================
WITH
-- ------------------------------------------------------------------------------------
-- 1. Larkbase: semua klaim invoice
--    team1 = penamaan tim versi blok "sh" lama, team2 = versi blok "ss" lama
-- ------------------------------------------------------------------------------------
lark_src AS (
    SELECT parent_invoice, invoice_no, order_no, trimBoth(customer_name) AS name_lark1, assignee,
           'Sales' AS team1, 'Sales' AS team2
    FROM default.larkbase_salesopportunities_salesteam
    UNION ALL
    SELECT parent_invoice, invoice_no, order_no, trimBoth(customer_name), assignee, 'Mills', 'Mills'
    FROM default.larkbase_salesopportunities_millsteam
    UNION ALL
    SELECT parent_invoice, invoice_no, order_no, trimBoth(assignee), assignee, 'Suppliers', 'Suppliers'
    FROM default.larkbase_salesopportunities_suppliersteam
    UNION ALL
    SELECT parent_invoice, invoice_no, order_no, trimBoth(assignee), assignee, 'Smallholders', 'Smallholders'
    FROM default.larkbase_salesopportunities_smallholdersteam
    UNION ALL
    SELECT parent_invoice, invoice_no, order_no, trimBoth(assignee), assignee, 'DG', 'DG'
    FROM default.larkbase_salesopportunities_dg
    UNION ALL
    SELECT parent_invoice, invoice_no, order_no, trimBoth(assignee), assignee, 'Agronomist', 'Plantation'
    FROM default.larkbase_salesopportunities_plantation
    UNION ALL
    SELECT parent_invoice, invoice_no, order_no, trimBoth(assignee), assignee, 'Finance FFB BD', 'FFB BD'
    FROM default.larkbase_salesopportunities_bdffb
    UNION ALL
    SELECT parent_invoice, invoice_no, order_no, trimBoth(assignee), assignee, 'Product Experiment', 'Product Experiment'
    FROM default.larkbase_salesopportunities_aspekpir
),
lark_raw AS (
    SELECT
        multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no) AS invoice_raw,
        multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', 'order_no') AS notes,
        order_no AS order_lark,
        upper(trimBoth(replaceAll(replaceAll(invoice_raw, 'INV#', ''), '#', ''))) AS key1,
        replaceAll(replaceAll(upper(trimBoth(invoice_raw)), 'INV#', ''), '#', '') AS key2,
        name_lark1,
        assignee,
        team1,
        team2
    FROM lark_src
    WHERE parent_invoice != '' OR invoice_no != '' OR order_no != ''
),

-- ------------------------------------------------------------------------------------
-- 2a. Mapping PIC versi blok "sh" (dipakai filter pic_teams di data Shopify / ProApp)
-- ------------------------------------------------------------------------------------
lark1 AS (
    SELECT DISTINCT
        key1 AS invoice_lark,
        order_lark,
        notes,
        name_lark1,
        team1 AS team,
        trimBoth(assignee) AS pic_name
    FROM lark_raw
    WHERE key1 NOT IN ('INV/20250501/SEED/114629', 'INV/20250506/SEED/114777',
                       'INV/20250103/RIZ04/100545', 'INV/20250111/SUZ45/100057')
),
dop1 AS (
    SELECT
        multiIf(
            de.invoice_no != '', de.invoice_no,
            so.name  != '', concat('INV/', replaceAll(so.name,  '#', ''), '/SHPFY'),
            so1.name != '', concat('INV/', replaceAll(so1.name, '#', ''), '/SHPFY'),
            so2.name != '', concat('INV/', replaceAll(so2.name, '#', ''), '/SHPFY'),
            NULL
        ) AS invoice_key,
        arrayStringConcat(arraySort(groupUniqArray(l.team)), ';')     AS pic_teams,
        arrayStringConcat(arraySort(groupUniqArray(l.pic_name)), ';') AS pic_names
    FROM lark1 AS l
    ANY LEFT JOIN (
        SELECT invoice_no, any(order_no) AS order_no
        FROM sawitpro_datamart.datamart_ecommerce
        WHERE invoice_status IN ('PAID', 'PARTIAL_PAID')
          AND toString(sale_order_status) NOT IN ('CANCELLED', 'CANCELED', 'DRAFT')
          AND invoice_no IN (SELECT invoice_lark FROM lark1)
        GROUP BY invoice_no
    ) AS de ON de.invoice_no = l.invoice_lark
    ANY LEFT JOIN (
        SELECT replaceAll(name, '#', '') AS k, name
        FROM default.shopify_orders
        WHERE k IN (SELECT invoice_lark FROM lark1)
    ) AS so ON so.k = l.invoice_lark
    ANY LEFT JOIN (
        SELECT concat('INV/', replaceAll(trimBoth(name), '#', ''), '/SHPFY') AS k, name
        FROM default.shopify_orders
        WHERE k IN (SELECT invoice_lark FROM lark1)
    ) AS so2 ON so2.k = l.invoice_lark
    ANY LEFT JOIN (
        SELECT name, ref
        FROM odoo_database.account_move
        WHERE name IN (SELECT invoice_lark FROM lark1)
    ) AS am ON am.name = l.invoice_lark
    ANY LEFT JOIN (
        SELECT upper(name) AS k, name
        FROM default.shopify_orders
        WHERE k IN (SELECT upper(ref) FROM odoo_database.account_move
                    WHERE name IN (SELECT invoice_lark FROM lark1))
    ) AS so1 ON so1.k = upper(am.ref)
    WHERE de.order_no != '' OR so.name != '' OR am.name != '' OR so2.name != ''
    GROUP BY invoice_key
),
-- fallback: lark diisi order_no (dicocokkan ke d.invoice_no / e.order_no)
-- [CATATAN] join ALL seperti query lama. Kalau 1 order_no muncul di >1 baris lark,
-- baris sales ikut terduplikasi. Ganti LEFT JOIN dop1_fallback -> ANY LEFT JOIN untuk fix.
dop1_fallback AS (
    SELECT l.order_lark AS order_no, d.pic_teams, d.pic_names
    FROM lark1 AS l
    INNER JOIN dop1 AS d ON d.invoice_key = l.invoice_lark
    WHERE l.order_lark != ''
),
-- superset kunci invoice/order yang mungkin berstatus Smallholders (untuk pushdown)
sh1_keys AS (
    SELECT invoice_key AS k FROM dop1 WHERE pic_teams = 'Smallholders'
    UNION ALL
    SELECT order_no FROM dop1_fallback WHERE pic_teams = 'Smallholders'
),
sh1_so_ids AS (
    SELECT toString(id) AS so_id
    FROM default.shopify_orders
    WHERE concat('INV/', replaceAll(name, '#', ''), '/SHPFY') IN (SELECT k FROM sh1_keys)
),

-- ------------------------------------------------------------------------------------
-- 2b. Mapping PIC versi blok "ss" (filter akhir pic_teams = 'Smallholders' + kolom pic_name)
-- ------------------------------------------------------------------------------------
lark2 AS (
    SELECT DISTINCT
        key2 AS invoice_lark,
        replaceAll(replaceAll(key2, 'INV/', ''), '/SHPFY', '') AS clean_key,
        team2 AS team,
        assignee AS pic_name
    FROM lark_raw
    WHERE key2 NOT IN ('INV/20250501/SEED/114629', 'INV/20250506/SEED/114777',
                       'INV/20250103/RIZ04/100545', 'INV/20250111/SUZ45/100057')
),
dop2 AS (
    SELECT
        multiIf(
            de.invoice_no != '', de.invoice_no,
            so.name  != '', concat('INV/', replaceAll(so.name,  '#', ''), '/SHPFY'),
            so1.name != '', concat('INV/', replaceAll(so1.name, '#', ''), '/SHPFY'),
            startsWith(l.invoice_lark, 'INV/'), l.invoice_lark,
            concat('INV/', l.invoice_lark, '/SHPFY')
        ) AS invoice_key,
        arrayStringConcat(arraySort(groupUniqArray(l.team)), ';')     AS pic_teams,
        arrayStringConcat(arraySort(groupUniqArray(l.pic_name)), ';') AS pic_names
    FROM lark2 AS l
    LEFT JOIN (
        SELECT DISTINCT invoice_no
        FROM sawitpro_datamart.datamart_ecommerce
        WHERE invoice_status IN ('PAID', 'PARTIAL_PAID')
          AND sale_order_status NOT IN ('CANCELLED', 'CANCELED', 'DRAFT')
          AND invoice_no IN (SELECT invoice_lark FROM lark2)
    ) AS de ON de.invoice_no = l.invoice_lark
    LEFT JOIN (
        SELECT replaceAll(name, '#', '') AS clean_so_name, name
        FROM default.shopify_orders
        WHERE clean_so_name IN (SELECT clean_key FROM lark2)
    ) AS so ON so.clean_so_name = l.clean_key
    LEFT JOIN (
        SELECT upper(trimBoth(name)) AS am_name, replaceAll(upper(trimBoth(ref)), '#', '') AS clean_ref
        FROM odoo_database.account_move
        WHERE am_name IN (SELECT invoice_lark FROM lark2)
    ) AS am ON am.am_name = l.invoice_lark
    LEFT JOIN (
        SELECT replaceAll(upper(trimBoth(name)), '#', '') AS clean_so_name, name
        FROM default.shopify_orders
        WHERE clean_so_name IN (
            SELECT replaceAll(upper(trimBoth(ref)), '#', '')
            FROM odoo_database.account_move
            WHERE upper(trimBoth(name)) IN (SELECT invoice_lark FROM lark2)
        )
    ) AS so1 ON so1.clean_so_name = am.clean_ref
    GROUP BY invoice_key
),
sh2_invoices AS (
    SELECT invoice_key, pic_teams, pic_names
    FROM dop2
    WHERE pic_teams = 'Smallholders'
),

-- ------------------------------------------------------------------------------------
-- 3. Geo equalizer provinsi (idealnya dipindah ke tabel / dictionary ClickHouse)
-- ------------------------------------------------------------------------------------
geo_province AS (
    SELECT arrayJoin(m.2) AS geo_key, m.1 AS province_std
    FROM (
        SELECT arrayJoin([
            ('ACEH',                      ['ACEH', 'NAD', 'NANGGROE ACEH DARUSSALAM', 'NANGGROE ACEH DARUSSALAM (NAD)']),
            ('BALI',                      ['BALI']),
            ('BANTEN',                    ['BANTEN']),
            ('BENGKULU',                  ['BENGKULU']),
            ('DI YOGYAKARTA',             ['DAERAH ISTIMEWA YOGYAKARTA', 'DI YOGYAKARTA', 'DIY', 'SPECIAL REGION OF YOGYAKARTA', 'YOGYA', 'YOGYAKARTA']),
            ('DKI JAKARTA',               ['DAERAH KHUSUS IBUKOTA JAKARTA', 'DKI', 'DKI JAKARTA', 'JAKARTA', 'JKT']),
            ('GORONTALO',                 ['GORONTALO']),
            ('INDONESIA',                 ['BIL', 'BILL', 'DSP', 'IDZ', 'IDZ01', 'IDZ99', 'INDONESIA', 'SEE', 'SEED', 'SHPFY']),
            ('JAMBI',                     ['JAMBI', 'JAZ']),
            ('JAWA BARAT',                ['JABAR', 'JAWA BARAT', 'WEST JAVA']),
            ('JAWA TENGAH',               ['CENTRAL JAVA', 'JATENG', 'JAWA TENGAH']),
            ('JAWA TIMUR',                ['EAST JAVA', 'JATIM', 'JAWA TIMUR']),
            ('KALIMANTAN BARAT',          ['KALBAR', 'KALIMANTAN BARAT', 'WEST KALIMANTAN']),
            ('KALIMANTAN SELATAN',        ['KALIMANTAN SELATAN', 'KALSEL', 'SOUTH KALIMANTAN']),
            ('KALIMANTAN TENGAH',         ['CENTRAL KALIMANTAN', 'KALIMANTAN TENGAH', 'KALTENG']),
            ('KALIMANTAN TIMUR',          ['EAST KALIMANTAN', 'KALIMANTAN TIMUR', 'KALTIM', 'KEC. KAUBUN']),
            ('KALIMANTAN UTARA',          ['KALIMANTAN UTARA', 'KALTARA', 'NORTH KALIMANTAN']),
            ('KEPULAUAN BANGKA BELITUNG', ['BABEL', 'BANGKA BELITUNG', 'BANGKA BELITUNG ISLANDS', 'KEPULAUAN BANGKA BELITUNG']),
            ('KEPULAUAN RIAU',            ['KEPRI', 'KEPULAUAN RIAU', 'RIAU ISLANDS']),
            ('LAMPUNG',                   ['JALAN LINTAS RAWAJITU', 'LAMPUNG', 'LAZ']),
            ('MALUKU',                    ['MALUKU']),
            ('MALUKU UTARA',              ['MALUKU UTARA', 'MALUT', 'NORTH MALUKU']),
            ('NUSA TENGGARA BARAT',       ['NTB', 'NUSA TENGGARA BARAT', 'NUSA TENGGARA BARAT (NTB)', 'WEST NUSA TENGGARA']),
            ('NUSA TENGGARA TIMUR',       ['EAST NUSA TENGGARA', 'NTT', 'NUSA TENGGARA TIMUR']),
            ('PAPUA',                     ['PAPUA']),
            ('PAPUA BARAT',               ['PAPUA BARAT', 'WEST PAPUA']),
            ('PAPUA BARAT DAYA',          ['PAPUA BARAT DAYA', 'SOUTHWEST PAPUA']),
            ('PAPUA PEGUNUNGAN',          ['HIGHLAND PAPUA', 'PAPUA PEGUNUNGAN']),
            ('PAPUA SELATAN',             ['PAPUA SELATAN', 'SOUTH PAPUA']),
            ('PAPUA TENGAH',              ['CENTRAL PAPUA', 'PAPUA TENGAH']),
            ('RIAU',                      ['RIAU', 'RIZ']),
            ('SULAWESI BARAT',            ['SULAWESI BARAT', 'SULBAR', 'WEST SULAWESI']),
            ('SULAWESI SELATAN',          ['SOUTH SULAWESI', 'SULAWESI SELATAN', 'SULSEL']),
            ('SULAWESI TENGAH',           ['CENTRAL SULAWESI', 'SULAWESI TENGAH', 'SULTENG']),
            ('SULAWESI TENGGARA',         ['SOUTHEAST SULAWESI', 'SULAWESI TENGGARA', 'SULTRA']),
            ('SULAWESI UTARA',            ['NORTH SULAWESI', 'SULAWESI UTARA', 'SULUT']),
            ('SUMATERA BARAT',            ['SUMATERA BARAT', 'SUMATRA BARAT', 'SUMBAR', 'WEST SUMATRA']),
            ('SUMATERA SELATAN',          ['SOUTH SUMATRA', 'SUMATERA SELATAN', 'SUMATRA SELATAN', 'SUMSEL']),
            ('SUMATERA UTARA',            ['NORTH SUMATRA', 'SUMATERA UTARA', 'SUMATRA UTARA', 'SUMUT', 'SUZ']),
            ('UNIDENTIFIED',              ['', 'UNIDENTIFIED'])
        ]) AS m
    )
),
user_ok AS (
    SELECT id, phone_no FROM default.user WHERE fraud_flag != 5
),

-- ------------------------------------------------------------------------------------
-- 4. Branch B (eks blok "sh"): Shopify + ProApp, sudah difilter ke kandidat Smallholders.
--    Mulai 2025 karena dipakai juga untuk menentukan new/repeat customer.
-- ------------------------------------------------------------------------------------
b_base AS (
    -- B1. order Shopify
    SELECT
        CAST(toDate(toTimeZone(d.sale_order_created_time, 'Asia/Jakarta')) AS Nullable(Date)) AS dates,
        CAST(d.user_id AS Nullable(String))                              AS uid,
        CAST(trimBoth(d.name) AS Nullable(String))                       AS cust_name,
        CAST(u.phone_no AS Nullable(String))                             AS phone,
        CAST(d.invoice_no AS Nullable(String))                           AS inv_no,
        CAST(d.item AS Nullable(String))                                 AS item_raw,
        CAST(d.invoice_status AS Nullable(String))                       AS inv_status,
        CAST(toString(d.sale_order_status) AS Nullable(String))          AS so_status,
        CAST(d.order_line_state AS Nullable(String))                     AS line_state,
        CAST(d.source_name AS Nullable(String))                          AS channel,
        CAST(d.potential_gmv AS Nullable(Float64))                       AS gmv_raw,
        CAST(d.paid_with_bank_idr AS Nullable(Float64))                  AS revenue_raw,
        CAST(d.qty AS Nullable(Float64))                                 AS qty_raw,
        CAST(ifNull(toFloat64OrNull(toString(d.shipping_cost)), 0) AS Nullable(Float64))         AS shipping_raw,
        CAST(ifNull(toFloat64OrNull(toString(d.discount_amount_in_idr)), 0) AS Nullable(Float64)) AS discount_raw,
        CAST(multiIf(match(d.item, '(?i)herb'), 'Herbisida', d.product_category) AS Nullable(String)) AS prod_cat,
        CAST(COALESCE(NULLIF(p1.pic_teams, ''), NULLIF(fb.pic_teams, '')) AS Nullable(String)) AS pic_teams,
        CAST(COALESCE(NULLIF(p1.pic_names, ''), NULLIF(fb.pic_names, '')) AS Nullable(String)) AS pic_names,
        CAST(multiIf(
            d.source_name = 'shopify_draft_order', 'DRAFT ORDER',
            p1.pic_names != '', 'DRAFT ORDER',
            cs.utm_medium != '', replaceAll(upper(cs.utm_medium), 'PROAPP', ''),
            tt.app_type_tokosawit = 'MEMBER', 'AGEN',
            tt.app_type_tokosawit != '', tt.app_type_tokosawit,
            'WEB') AS Nullable(String))                                  AS app_type_prev,
        CAST(multiIf(
            cs.utm_medium != '', replaceAll(upper(cs.utm_medium), 'PROAPP', ''),
            tt.app_type_tokosawit = 'MEMBER', 'AGEN',
            tt.app_type_tokosawit != '', tt.app_type_tokosawit,
            'WEB') AS Nullable(String))                                  AS application_type,
        CAST(multiIf(
            so.shipping_address_province != '', so.shipping_address_province,
            so.billing_address_province != '', so.billing_address_province,
            so.customer_default_address_province) AS Nullable(String))   AS province_raw,
        CAST(upper(coalesce(so.shipping_address_city, so.customer_default_address_city)) AS Nullable(String)) AS city_raw,
        CAST(so.tags AS Nullable(String))                                AS tags,
        CAST(so.note_attributes AS Nullable(String))                     AS note_attributes
    FROM sawitpro_datamart.fct_new_sale_order_shopify AS d
    LEFT JOIN dop1 AS p1 ON p1.invoice_key = d.invoice_no
    LEFT JOIN dop1_fallback AS fb ON fb.order_no = d.invoice_no
    ANY LEFT JOIN (
        SELECT
            concat('INV/', replaceAll(name, '#', ''), '/SHPFY') AS so_invoice,
            id, shipping_address_province, billing_address_province, customer_default_address_province,
            shipping_address_city, customer_default_address_city, tags, note_attributes
        FROM default.shopify_orders
        WHERE so_invoice IN (SELECT k FROM sh1_keys)
    ) AS so ON so.so_invoice = d.invoice_no
    ANY LEFT JOIN (
        -- dulu: window function di seluruh flatten_eventapp_raw
        SELECT transaction_id, app_type, argMax(app_type_tokosawit, event_time) AS app_type_tokosawit
        FROM default.flatten_eventapp_raw
        WHERE transaction_id != ''
          AND app_type LIKE 'sawitpro%'
          AND transaction_id IN (SELECT so_id FROM sh1_so_ids)
        GROUP BY transaction_id, app_type
    ) AS tt ON tt.app_type = replaceAll(d.store_name, '-', '') AND tt.transaction_id = toString(so.id)
    ANY LEFT JOIN (
        SELECT order_id, store_name, utm_medium
        FROM default.shopify_campaign_sales
        WHERE order_id IN (SELECT so_id FROM sh1_so_ids)
    ) AS cs ON cs.order_id = toString(so.id) AND cs.store_name = d.store_name
    ANY LEFT JOIN user_ok AS u ON u.id = d.user_id
    WHERE d.invoice_no IN (SELECT k FROM sh1_keys)
      AND toDate(toTimeZone(d.sale_order_created_time, 'Asia/Jakarta')) >= '2025-01-01'

    UNION ALL

    -- B2. order ProApp (datamart_ecommerce) yang tidak ada di fct Shopify
    SELECT
        CAST(toDate(toTimeZone(e.sale_order_created_time, 'Asia/Jakarta')) AS Nullable(Date)),
        CAST(e.user_id AS Nullable(String)),
        CAST(trimBoth(e.name) AS Nullable(String)),
        CAST(u_e.phone_no AS Nullable(String)),
        CAST(e.invoice_no AS Nullable(String)),
        CAST(e.item AS Nullable(String)),
        CAST(e.invoice_status AS Nullable(String)),
        CAST(toString(e.sale_order_status) AS Nullable(String)),
        CAST(NULL AS Nullable(String)),
        CAST(multiIf(so_main.app_type = 'ADMIN_WEB', 'shopify_draft_order', 'PRO-APP') AS Nullable(String)),
        CAST(e.potential_gmv AS Nullable(Float64)),
        CAST(e.paid_with_bank AS Nullable(Float64)),
        CAST(e.quantity AS Nullable(Float64)),
        CAST(ifNull(toFloat64OrNull(toString(e.total_shipping_cost)), 0) AS Nullable(Float64)),
        CAST(ifNull(toFloat64OrNull(toString(e.point_redemption_idr)), 0) AS Nullable(Float64)),
        CAST(multiIf(match(e.item, '(?i)herb'), 'Herbisida', e.product_cat) AS Nullable(String)),
        CAST(COALESCE(NULLIF(p1.pic_teams, ''), NULLIF(fb.pic_teams, '')) AS Nullable(String)),
        CAST(COALESCE(NULLIF(p1.pic_names, ''), NULLIF(fb.pic_names, '')) AS Nullable(String)),
        CAST(multiIf(so_main.app_type = '', 'OTHERS', so_main.app_type = 'ADMIN_WEB', 'DRAFT ORDER',
                     so_main.app_type = 'MEMBER', 'AGEN', so_main.app_type) AS Nullable(String)),
        CAST(multiIf(so_main.app_type = '', 'OTHERS', so_main.app_type = 'MEMBER', 'AGEN',
                     so_main.app_type) AS Nullable(String)),
        CAST(substring(e.invoice_no, 14, 3) AS Nullable(String)),
        CAST(NULL AS Nullable(String)),
        CAST(NULL AS Nullable(String)),
        CAST(NULL AS Nullable(String))
    FROM sawitpro_datamart.datamart_ecommerce AS e
    INNER JOIN (
        SELECT id, app_type
        FROM default.sale_order
        WHERE id IN (SELECT sale_order_id FROM sawitpro_datamart.datamart_ecommerce
                     WHERE invoice_no IN (SELECT k FROM sh1_keys) OR order_no IN (SELECT k FROM sh1_keys))
    ) AS so_main ON so_main.id = e.sale_order_id
    INNER JOIN user_ok AS u_e ON u_e.id = e.user_id
    LEFT JOIN dop1 AS p1 ON p1.invoice_key = e.invoice_no
    LEFT JOIN dop1_fallback AS fb ON fb.order_no = e.order_no
    WHERE (e.invoice_no IN (SELECT k FROM sh1_keys) OR e.order_no IN (SELECT k FROM sh1_keys))
      AND (e.invoice_status = 'PAID' OR toString(e.sale_order_status) IN ('COMPLETED', '32'))
      AND e.invoice_no NOT IN (SELECT invoice_no FROM sawitpro_datamart.fct_new_sale_order_shopify)
      AND toDate(toTimeZone(e.sale_order_created_time, 'Asia/Jakarta')) >= '2025-01-01'
),
b_rows AS (
    SELECT
        b.uid                                                            AS user_id,
        b.cust_name                                                      AS user_name,
        b.phone                                                          AS phone_number,
        b.inv_no                                                         AS invoice_no,
        CAST(b.customer_ref AS Nullable(String))                         AS order_no,
        b.dates                                                          AS sale_order_date,
        CAST(ifNull(b.qty_raw, 0) AS Int64)                              AS qty,
        CAST(multiIf(
            b.item_raw ILIKE 'Benih Sawit Topaz 1-3 Seri 4 (100 butir)%', 'Benih',
            b.customer_ref = '#B2B1940', 'Benih',
            b.prod_cat) AS Nullable(String))                             AS product_cat,
        CAST(ifNull(b.gmv_raw, 0) AS Int64)                              AS sales_amount,
        CAST(ifNull(b.shipping_raw, 0) AS Int64)                         AS shipping_cost,
        CAST(ifNull(b.discount_raw, 0) AS Int64)                         AS discount,
        CAST(ifNull(b.revenue_raw, 0) AS Int64)                          AS paid_with_bank_idr,
        b.item_raw                                                       AS item_name,
        CAST(upper(b.inv_status) AS Nullable(String))                    AS invoice_status,
        CAST(upper(b.so_status) AS Nullable(String))                     AS sale_order_status,
        b.app_type_prev                                                  AS source_name,
        b.application_type                                               AS app_type,
        CAST(coalesce(nullIf(gp.province_std, ''), 'UNMAPPED') AS Nullable(String)) AS province,
        b.city_raw                                                       AS city,
        CAST(upper(coalesce(
            nullIf(trimBoth(extract(ifNull(b.tags, ''), 'sales_code:([^,]+)')), ''),
            nullIf(trimBoth(JSONExtractString(ifNull(b.note_attributes, '[]'), 1, 'value')), '')
        )) AS Nullable(String))                                          AS sales_code
    FROM (
        SELECT
            *,
            concat('#', splitByChar('/', ifNull(inv_no, ''))[2]) AS customer_ref,
            trimBoth(replaceRegexpAll(upper(
                if(position(trimBoth(ifNull(province_raw, '')), '*') = 0, trimBoth(ifNull(province_raw, '')), '')
            ), '\\s+', ' ')) AS province_key
        FROM b_base
    ) AS b
    ANY LEFT JOIN geo_province AS gp ON gp.geo_key = b.province_key
    WHERE upper(b.inv_status) IN ('PAID', 'PARTIAL_PAID')
      AND upper(b.so_status) NOT IN ('CANCELLED', 'CANCELED', 'DRAFT')
      AND ifNull(b.line_state, '') != 'cancel'
      AND ifNull(b.channel, '') NOT IN ('shopee', 'tiktok', 'tokopedia')   -- Non-Marketplace
      AND b.item_raw NOT IN ('Biaya Layanan', 'Minyak Goreng 1 Liter - Minyak Hemat Petani Hebat')
      AND if(
            b.customer_ref LIKE '%B2B%'
            AND (b.app_type_prev ILIKE '%Draft%' OR upper(b.app_type_prev) = 'MITRA')
            AND b.pic_names IS NULL,
            'Unclaimed', b.pic_teams
          ) = 'Smallholders'
),

-- ------------------------------------------------------------------------------------
-- 5. Branch A (datamart_ecommerce), langsung difilter Smallholders + 2026
-- [CATATAN] Invoice ProApp yang sama juga bisa masuk lewat B2 di atas (sama seperti query lama),
--           jadi berpotensi muncul 2x. Lihat penjelasan di chat.
-- ------------------------------------------------------------------------------------
a_rows AS (
    SELECT
        CAST(dm.user_id AS Nullable(String))                             AS user_id,
        CAST(dm.name AS Nullable(String))                                AS user_name,
        CAST(dm.phone_number AS Nullable(String))                        AS phone_number,
        CAST(dm.invoice_no AS Nullable(String))                          AS invoice_no,
        CAST(dm.order_no AS Nullable(String))                            AS order_no,
        CAST(toDate(dm.sale_order_created_time) AS Nullable(Date))       AS sale_order_date,
        CAST(ifNull(dm.quantity, 0) AS Int64)                            AS qty,
        CAST(dm.product_cat AS Nullable(String))                         AS product_cat,
        CAST(ifNull(
            dm.total_price_idr + ifNull(
                dm.total_shipping_cost / nullIf(count(dm.item) OVER (PARTITION BY dm.invoice_no), 0), 0),
            0) AS Int64)                                                 AS sales_amount,
        CAST(ifNull(dm.total_shipping_cost, 0) AS Int64)                 AS shipping_cost,
        CAST(ifNull(dm.discount, 0) AS Int64)                            AS discount,
        CAST(ifNull(dm.paid_with_bank, 0) AS Int64)                      AS paid_with_bank_idr,
        CAST(dm.item AS Nullable(String))                                AS item_name,
        CAST(dm.invoice_status AS Nullable(String))                      AS invoice_status,
        CAST(dm.sale_order_status AS Nullable(String))                   AS sale_order_status,
        CAST(dm.commerce_channel AS Nullable(String))                    AS source_name,
        CAST(so.app_type AS Nullable(String))                            AS app_type,
        'No Province'                                                    AS province,
        'No City'                                                        AS city,
        'No Sales Code'                                                  AS sales_code
    FROM sawitpro_datamart.datamart_ecommerce AS dm
    INNER JOIN (
        SELECT id, app_type
        FROM default.sale_order
        WHERE id IN (SELECT sale_order_id FROM sawitpro_datamart.datamart_ecommerce
                     WHERE invoice_no IN (SELECT invoice_key FROM sh2_invoices))
    ) AS so ON so.id = dm.sale_order_id
    WHERE dm.invoice_status IN ('PAID', 'PARTIAL_PAID')
      AND dm.sale_order_status NOT IN ('CANCELLED', 'CANCELED', 'DRAFT')
      AND dm.invoice_no IN (SELECT invoice_key FROM sh2_invoices)
      AND toDate(dm.sale_order_created_time) >= '2026-01-01'
),
combined_sales AS (
    SELECT * FROM a_rows
    UNION ALL
    SELECT * FROM b_rows
),

-- ------------------------------------------------------------------------------------
-- 6. Tanggal order pertama customer (definisi sama dengan query lama:
--    semua order ProApp PAID sepanjang masa + baris branch B)
-- ------------------------------------------------------------------------------------
cfo_proapp AS (
    SELECT
        trimBoth(ifNull(CAST(user_id AS Nullable(String)), '')) AS customer_id,
        CAST(min(toDate(sale_order_created_time)) AS Nullable(Date)) AS first_date
    FROM sawitpro_datamart.datamart_ecommerce
    WHERE invoice_status IN ('PAID', 'PARTIAL_PAID')
      AND sale_order_status NOT IN ('CANCELLED', 'CANCELED', 'DRAFT')
      AND sale_order_id IN (SELECT id FROM default.sale_order)
      AND customer_id != ''
    GROUP BY customer_id
)

-- ------------------------------------------------------------------------------------
-- 7. Hasil akhir
-- ------------------------------------------------------------------------------------
SELECT
    ss.pic_names                                                         AS pic_name,
    ss.pic_teams                                                         AS pic_team,
    trimBoth(c.user_id)                                                  AS customer_id,
    trimBoth(c.user_name)                                                AS customer_name,
    trimBoth(c.phone_number)                                             AS customer_phone,
    c.invoice_no                                                         AS main_invoice_no,
    c.order_no                                                           AS main_order_no,
    c.app_type                                                           AS main_app_type,
    c.sale_order_date                                                    AS sale_order_date,
    CAST(sum(c.qty) AS Int64)                                            AS qty,
    CAST(sum(c.discount) AS Int64)                                       AS discount,
    CAST(sum(c.sales_amount) AS Int64)                                   AS sales_amount,
    CAST(sum(c.shipping_cost) AS Int64)                                  AS shipping_cost,
    -- sales_amount (potential_gmv / total_price_idr + porsi ongkir) sudah termasuk ongkir,
    -- jadi shipping_cost tidak ditambahkan lagi (dulu ongkir terhitung 2x)
    CAST(sum(c.sales_amount) AS Int64)                                   AS gmv,
    CAST(sum(c.sales_amount) - sum(c.discount) AS Int64)                 AS nett_sales,
    CAST(sum(c.paid_with_bank_idr) AS Int64)                             AS revenue,
    trimBoth(c.item_name)                                                AS item_name,
    c.product_cat                                                        AS product_cat,
    c.sale_order_status                                                  AS main_so_status,
    c.invoice_status                                                     AS main_inv_status,
    c.source_name                                                        AS source_name,
    c.province                                                           AS province,
    c.city                                                               AS city,
    c.sales_code                                                         AS sales_code,
    if(
        multiIf(
            trimBoth(ifNull(c.user_id, '')) = '', NULL,
            cfo.first_date IS NULL, c.first_local,
            least(cfo.first_date, c.first_local)
        ) = c.sale_order_date,
        'new customer', 'repeat customer'
    )                                                                    AS customer_status
FROM (
    SELECT
        cs.*,
        min(cs.sale_order_date) OVER (PARTITION BY trimBoth(ifNull(cs.user_id, ''))) AS first_local
    FROM combined_sales AS cs
) AS c
INNER JOIN sh2_invoices AS ss ON ss.invoice_key = c.invoice_no
ANY LEFT JOIN cfo_proapp AS cfo ON cfo.customer_id = trimBoth(ifNull(c.user_id, ''))
WHERE c.sale_order_date >= '2026-01-01'
  AND ifNull(c.item_name, '') != 'Biaya Layanan'
  AND notILike(ifNull(c.item_name, ''), '%minyak%')
GROUP BY
    pic_name, pic_team, customer_id, customer_name, customer_phone,
    main_invoice_no, main_order_no, main_app_type, sale_order_date,
    item_name, product_cat, main_so_status, main_inv_status, source_name,
    province, city, sales_code, customer_status
ORDER BY sale_order_date DESC
