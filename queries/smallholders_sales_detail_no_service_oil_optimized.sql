SELECT
	result.*,
	-- user_type: larkbase leads first, fallback to datamart_user.user_role, else 'Unidentified'
	coalesce(
		nullIf(trimBoth(ifNull(toString(lsl.lead_user_type), '')), ''),
		nullIf(trimBoth(ifNull(toString(du.du_user_role), '')), ''),
		'Unidentified'
	) AS user_type
FROM (
WITH
-- === [GEO] Geo Equalizer — Province (sumber: geo.sql / geo_equalizer_province.csv) ===
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

-- === [OPT] parameter tanggal mulai & filter item, ditulis sekali ===
-- tanggal mulai dalam waktu Jakarta (setara dengan filter lama dates >= '2025-01-01')
toDateTime('2025-01-01 00:00:00', 'Asia/Jakarta') AS start_ts,
-- [FILTER] item layanan & minyak dikecualikan (cek nama item + kategori + tipe produk)
'(?i)minyak|layanan|jasa|dokter sawit' AS excluded_item_regex,

invoice_lark AS (
    SELECT
        upper(trimBoth(replace(replace(invoice_lark, 'INV#',''),'#',''))) AS invoice_lark,
        invoice_lark AS invoice_inputted,
        order_lark,
        notes, name_lark, team, pic_name,
        CAST(min(created_dt) AS Nullable(DateTime)) AS min_created_dt
    FROM (
        -- [OPT] toFloat64 (bukan Float32): epoch ms di Float32 kehilangan presisi beberapa menit -> urutan seqno bisa salah
        SELECT
            multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice) AS invoice_lark,
            order_no AS order_lark,
            multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice') AS notes,
            trimBoth(customer_name) AS name_lark, 'Sales' AS team, trimBoth(assignee) AS pic_name,
            toDateTime(toFloat64OrNull(created_date) / 1000, 'Asia/Jakarta') AS created_dt
        FROM default.larkbase_salesopportunities_salesteam
        WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')

        UNION ALL
        SELECT
            multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice),
            order_no,
            multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice'),
            trimBoth(customer_name), 'Mills', trimBoth(assignee),
            toDateTime(toFloat64OrNull(date_created) / 1000, 'Asia/Jakarta')
        FROM default.larkbase_salesopportunities_millsteam
        WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')

        UNION ALL
        SELECT
            multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice),
            order_no,
            multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice'),
            trimBoth(assignee), 'Suppliers', trimBoth(assignee),
            toDateTime(toFloat64OrNull(created_date) / 1000, 'Asia/Jakarta')
        FROM default.larkbase_salesopportunities_suppliersteam
        WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')

        UNION ALL
        SELECT
            multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice),
            order_no,
            multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice'),
            trimBoth(assignee), 'Smallholders', trimBoth(assignee),
            toDateTime(toFloat64OrNull(created_date) / 1000, 'Asia/Jakarta')
        FROM default.larkbase_salesopportunities_smallholdersteam
        WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')

        UNION ALL
        SELECT
            multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice),
            order_no,
            multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice'),
            trimBoth(assignee), 'DG', trimBoth(assignee),
            toDateTime(toFloat64OrNull(created_date) / 1000, 'Asia/Jakarta')
        FROM default.larkbase_salesopportunities_dg
        WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')

        UNION ALL
        SELECT
            multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice),
            order_no,
            multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice'),
            trimBoth(assignee), 'Agronomist', trimBoth(assignee),
            toDateTime(toFloat64OrNull(created_date) / 1000, 'Asia/Jakarta')
        FROM default.larkbase_salesopportunities_plantation
        WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')

        UNION ALL
        SELECT
            multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice),
            order_no,
            multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice'),
            trimBoth(assignee), 'Finance FFB BD', trimBoth(assignee),
            toDateTime(toFloat64OrNull(date_created) / 1000, 'Asia/Jakarta')
        FROM default.larkbase_salesopportunities_bdffb
        WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')

        UNION ALL
        SELECT
            multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice),
            order_no,
            multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice'),
            trimBoth(assignee), 'Product Experiment', trimBoth(assignee),
            toDateTime(toFloat64OrNull(created_date) / 1000, 'Asia/Jakarta')
        FROM default.larkbase_salesopportunities_aspekpir
        WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
    ) AS a
    WHERE invoice_lark NOT IN ('INV/20250501/SEED/114629','INV/20250506/SEED/114777','INV/20250103/RIZ04/100545','INV/20250111/SUZ45/100057')
    GROUP BY 1,2,3,4,5,6,7
),
lark_keys AS (
    SELECT DISTINCT invoice_lark FROM invoice_lark
),
-- [OPT] tabel kanan di-prefilter ke key larkbase saja, bukan full table hash join
summary AS (
    SELECT
        multiIf(de.invoice_no != '', de.invoice_no,
                so.name  != '', concat('INV/', replaceAll(so.name,  '#', ''), '/SHPFY'),
                so1.name != '', concat('INV/', replaceAll(so1.name, '#', ''), '/SHPFY'),
                so2.name != '', concat('INV/', replaceAll(so2.name, '#', ''), '/SHPFY'),
                NULL) AS invoice_no,
        il.team,
        trimBoth(il.pic_name) AS pic_name,
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
data_order_pic AS (
    SELECT
        invoice_no,
        arrayStringConcat(arraySort(groupUniqArray(team)), ';') AS pic_teams,
        arrayStringConcat(arraySort(groupUniqArray(trimBoth(pic_name))), ';') AS pic_names,
        arrayStringConcat(arraySort(groupUniqArray(multiIf(seqno = 1, team, NULL))), ';') AS pic_teams_last,
        arrayStringConcat(arraySort(groupUniqArray(multiIf(seqno = 1, trimBoth(pic_name), NULL))), ';') AS pic_names_last
    FROM summary
    GROUP BY 1
),
-- [OPT] fallback via order_no, sudah di-dedup (1 baris per order_no) -> tidak ada duplikasi baris lagi
pic_by_order AS (
    SELECT order_no, t.1 AS pic_teams, t.2 AS pic_names, t.3 AS pic_teams_last, t.4 AS pic_names_last
    FROM (
        SELECT il.order_lark AS order_no,
               any((dp.pic_teams, dp.pic_names, dp.pic_teams_last, dp.pic_names_last)) AS t
        FROM invoice_lark AS il
        INNER JOIN data_order_pic AS dp ON il.invoice_lark = dp.invoice_no
        WHERE il.order_lark != ''
        GROUP BY il.order_lark
    )
),
-- key yang (mungkin) milik Smallholders -> dipakai untuk prefilter shopify_orders
sh_keys AS (
    SELECT invoice_no AS k FROM data_order_pic WHERE has(splitByChar(';', pic_teams), 'Smallholders')
    UNION ALL
    SELECT order_no FROM pic_by_order WHERE has(splitByChar(';', pic_teams), 'Smallholders')
),

-- === [OPT] Branch Shopify: filter Smallholders + item + tanggal DI AWAL, sebelum join berat ===
d_src AS (
    SELECT
        d.*,
        coalesce(nullIf(p_inv.pic_teams, ''),      nullIf(p_ord.pic_teams, ''))      AS sh_pic_teams,
        coalesce(nullIf(p_inv.pic_names, ''),      nullIf(p_ord.pic_names, ''))      AS sh_pic_names,
        coalesce(nullIf(p_inv.pic_teams_last, ''), nullIf(p_ord.pic_teams_last, '')) AS sh_pic_teams_last,
        coalesce(nullIf(p_inv.pic_names_last, ''), nullIf(p_ord.pic_names_last, '')) AS sh_pic_names_last,
        p_inv.pic_names AS sh_pic_names_inv   -- = dop1.pic_names di query lama (dipakai app_type_prev)
    FROM sawitpro_datamart.fct_new_sale_order_shopify AS d
    ANY LEFT JOIN data_order_pic AS p_inv ON p_inv.invoice_no = d.invoice_no
    ANY LEFT JOIN pic_by_order   AS p_ord ON p_ord.order_no   = d.invoice_no
    WHERE d.sale_order_created_time >= start_ts
      AND NOT match(concat(ifNull(d.item, ''), '|', ifNull(d.product_category, ''), '|', ifNull(d.product_type, '')), excluded_item_regex)
      AND has(splitByChar(';', ifNull(sh_pic_teams, '')), 'Smallholders')
),
so_f AS (
    SELECT
        concat('INV/', replaceAll(name, '#', ''), '/SHPFY') AS inv_key,
        id, name, line_items, landing_site, tags, note_attributes, discount_codes,
        shipping_address_province, billing_address_province, customer_default_address_province,
        shipping_address_zip, billing_address_zip, customer_default_address_zip,
        shipping_address_city, shipping_address_longitude, shipping_address_latitude,
        customer_default_address_address1, customer_default_address_address2, customer_default_address_city
    FROM default.shopify_orders
    WHERE concat('INV/', replaceAll(name, '#', ''), '/SHPFY') IN (SELECT k FROM sh_keys)
),
-- [OPT] window row_number + GROUP BY 3 kolom diganti argMax, dan hanya transaksi yang relevan
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

-- === [OPT] Branch ProApp (datamart_ecommerce): filter yang sama di awal ===
e_src AS (
    SELECT
        e.*,
        coalesce(nullIf(p_inv.pic_teams, ''),      nullIf(p_ord.pic_teams, ''))      AS sh_pic_teams,
        coalesce(nullIf(p_inv.pic_names, ''),      nullIf(p_ord.pic_names, ''))      AS sh_pic_names,
        coalesce(nullIf(p_inv.pic_teams_last, ''), nullIf(p_ord.pic_teams_last, '')) AS sh_pic_teams_last,
        coalesce(nullIf(p_inv.pic_names_last, ''), nullIf(p_ord.pic_names_last, '')) AS sh_pic_names_last
    FROM sawitpro_datamart.datamart_ecommerce AS e
    ANY LEFT JOIN data_order_pic AS p_inv ON p_inv.invoice_no = e.invoice_no
    ANY LEFT JOIN pic_by_order   AS p_ord ON p_ord.order_no   = e.order_no
    WHERE ((e.invoice_status = 'PAID') OR (toString(e.sale_order_status) IN ('COMPLETED', '32')))
      AND e.sale_order_created_time >= start_ts
      AND NOT match(concat(ifNull(e.item, ''), '|', ifNull(e.product_cat, '')), excluded_item_regex)
      AND has(splitByChar(';', ifNull(sh_pic_teams, '')), 'Smallholders')
      AND e.invoice_no NOT IN (SELECT invoice_no FROM sawitpro_datamart.fct_new_sale_order_shopify)
),

-- [OPT] first_order_date dihitung dari SEMUA order user (bukan hanya yang lolos filter Smallholders),
-- supaya NEW/REPEAT tetap sama dengan definisi lama. Hanya 2 kolom -> murah.
user_first_order AS (
    SELECT user_id, min(dt) AS first_order_date
    FROM (
        SELECT user_id, toDate(toTimeZone(sale_order_created_time, 'Asia/Jakarta')) AS dt
        FROM sawitpro_datamart.fct_new_sale_order_shopify
        WHERE sale_order_created_time >= start_ts
        UNION ALL
        SELECT user_id, toDate(toTimeZone(sale_order_created_time, 'Asia/Jakarta'))
        FROM sawitpro_datamart.datamart_ecommerce
        WHERE ((invoice_status = 'PAID') OR (toString(sale_order_status) IN ('COMPLETED', '32')))
          AND sale_order_created_time >= start_ts
          AND invoice_no NOT IN (SELECT invoice_no FROM sawitpro_datamart.fct_new_sale_order_shopify)
    )
    GROUP BY user_id
),

data_ecommerce_base AS (
    SELECT
        CAST(toDate(toTimeZone(d.sale_order_created_time, 'Asia/Jakarta')) AS Nullable(Date)) AS dates,
        d.store_name AS app_type,
        d.sh_pic_teams AS pic_teams,
        d.sh_pic_names AS pic_names,
        d.sh_pic_teams_last AS pic_teams_last,
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
        so.shipping_address_province AS shipping_address_province,
        (so.shipping_address_longitude) AS shipping_address_longitude,
        (so.shipping_address_latitude) AS shipping_address_latitude,
        so.customer_default_address_address1 AS customer_default_address_address1,
        so.customer_default_address_address2 AS customer_default_address_address2,
        so.customer_default_address_city AS customer_default_address_city,
        so.customer_default_address_province AS customer_default_address_province,
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
        concat(so.customer_default_address_address1, so.customer_default_address_address2) AS delivery_address,
        so.shipping_address_city AS city,
        so.shipping_address_province AS province,
        CASE
            WHEN ifNull(toFloat64OrNull(toString(d.dp_paid_amount)), 0) = ifNull(toFloat64OrNull(toString(d.current_total_price)), 0) THEN 'TOD'
            WHEN ifNull(toFloat64OrNull(toString(d.dp_paid_amount)), 0) < ifNull(toFloat64OrNull(toString(d.current_total_price)), 0) THEN 'DP'
            ELSE ''
        END AS payment_type,
        d.dp_paid_amount AS dp_paid_amount,
        CASE WHEN ifNull(toFloat64OrNull(toString(d.shipping_cost)), 0) = 0 THEN 'Pickup' ELSE 'Delivery' END AS delivery_type,
        CAST(ifNull(toFloat64OrNull(toString(d.point_redemption_point_idr)), 0) AS Nullable(Float64)) AS point_redemption_idr,
        CAST(ifNull(toFloat64OrNull(toString(d.discount_amount_in_idr)), 0) AS Nullable(Float64)) AS discount_amount_in_idr,
        JSONExtractUInt(sl.li, 'grams')/1000 AS sku_kg,
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
        CAST(parseDateTimeBestEffortOrNull(toString(d.pickup_estimated)) AS Nullable(DateTime)) AS pickup_estimated,
        CAST(parseDateTimeBestEffortOrNull(toString(d.invoice_expired_time)) AS Nullable(DateTime)) AS invoice_expired_time,
        coalesce(nullif(d.payment_method_1, ''), nullif(d.payment_method_2, '')) AS payment_channel_raw,
        multiIf(
            payment_channel_raw ILIKE '%midtrans%', 'Midtrans',
            payment_channel_raw ILIKE '%bank transfer%', 'Bank Transfer',
            payment_channel_raw ILIKE '%manual%', 'Manual',
            payment_channel_raw ILIKE '%xendit%', 'Xendit',
            payment_channel_raw = '', 'No Payment Recorded',
            'Others'
        ) AS payment_origin,
        multiIf(
            d.product_category IN ('Dokter Sawit'), 0,
            d.product_type IN ('Dokter Sawit'), 0,
            1
        ) AS requires_physical_delivery

    FROM d_src AS d
    ANY LEFT JOIN sku_line AS sl ON (sl.invoice_no = d.invoice_no) AND (sl.item = d.item)
    ANY LEFT JOIN so_f AS so ON so.inv_key = d.invoice_no
    ANY LEFT JOIN tt_f AS tt ON (tt.app_type = replaceAll(d.store_name, '-', '')) AND (tt.transaction_id = toString(so.id))
    ANY LEFT JOIN cs_f AS cs ON (cs.order_id = toString(so.id)) AND (cs.store_name = d.store_name)

    UNION ALL

    SELECT
        CAST(toTimeZone(e.sale_order_created_time, 'Asia/Jakarta') AS Nullable(Date)) AS dates,
        so_main.app_type AS app_type,
        e.sh_pic_teams AS pic_teams,
        e.sh_pic_names AS pic_names,
        e.sh_pic_teams_last AS pic_teams_last,
        e.sh_pic_names_last AS pic_names_last,
        e.user_id AS user_id,
        e.item AS item,
        e.invoice_no AS invoice_no,
        e.invoice_status AS invoice_status,
        toString(e.sale_order_status) AS sale_order_status,
        CAST(e.potential_gmv AS Nullable(Float64)) AS potential_gmvs,
		CAST(e.potential_gmv AS Nullable(Float64))-CAST(ifNull(toFloat64OrNull(toString(e.point_redemption_idr)), 0) AS Nullable(Float64))-CAST(ifNull(toFloat64OrNull(toString(e.discount)), 0) AS Nullable(Float64)) AS original_gmv,
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
		NULL AS utm_soruce,
        u_e.email AS customer_email,
        u_e.phone_no AS customer_phone_number,
        trimBoth(e.name) AS customer_name,
        NULL AS shipping_address_city,
        NULL AS shipping_address_province,
        NULL AS shipping_address_longitude,
        NULL AS shipping_address_latitude,
        NULL AS customer_default_address_address1,
        NULL AS customer_default_address_address2,
        NULL AS customer_default_address_city,
        NULL AS customer_default_address_province,
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
        CAST(NULL AS Nullable(String)) AS delivery_address,
        CAST(NULL AS Nullable(String)) AS city,
        CAST(NULL AS Nullable(String)) AS province,
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
        CAST(NULL AS Nullable(DateTime)) AS pickup_estimated,
        CAST(NULL AS Nullable(DateTime)) AS invoice_expired_time,
        CAST(NULL AS Nullable(String)) AS payment_channel_raw,
        CAST('Others' AS String) AS payment_origin,
        multiIf(e.product_cat IN ('Dokter Sawit'), 0, 1) AS requires_physical_delivery

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
		-- zip: kandidat zip_raw, atau segmen terakhir alamat untuk marketplace
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
finale AS (
SELECT
    de.*,
	area.level_3 as district_raw,
	coalesce(nullIf(gp.geo_province_std, ''), 'UNMAPPED') AS province_std,
    trimBoth(cc.notes) AS user_groups,
    trimBoth(cc.u_name) AS u_name,
    cc.u_email,
    cc.u_phone_no,
    multiIf(
        de.pic_teams LIKE '%Smallholders%' OR de.pic_teams LIKE '%DG%' OR de.pic_teams LIKE '%Agronomist%' OR de.pic_teams LIKE '%Product Experiment%', 'B2C',
        de.pic_teams LIKE '%mallholder%', 'B2C',
        (de.pic_teams NOT LIKE '%mallholder%') AND (de.pic_teams != ''), 'B2B',
        (de.app_type IN ('MEMBER', 'TOKOTANI', 'ESTATE')) OR (de.app_type IS NULL) OR (de.app_type = ''), 'B2B',
        de.app_type IN ('PETANI', 'DUTA', 'WORKER', 'KUD'), 'B2C',
        de.app_type = 'ADMIN_WEB', 'B2B',
        'B2C'
    ) AS b2b_b2c,
    multiIf(de.dates = de.first_order_date, 'NEW', 'REPEAT') AS order_retention_status,
    trimBoth(cc.duta_name) AS duta_name,
    cc.duta_phone_no
FROM data_ecommerce AS de
ANY LEFT JOIN (
    SELECT zip_code, any(level_3) AS level_3
    FROM default.area
    GROUP BY zip_code
) AS area ON de.customer_zip = area.zip_code
ANY LEFT JOIN geo_province AS gp ON de.province_key = gp.geo_key
ANY LEFT JOIN (
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
) AS cc ON cc.u_id = de.user_id
)

SELECT
	if(concat('#', splitByChar('/', ifnull(invoice_no,''))[2]) like '%B2B%' AND app_type_prev ilike '%Draft%' AND pic_names IS NULL OR order_source = 'MITRA', 'B2B', b2b_b2c) as b2b_b2c,
	concat('#', splitByChar('/', ifnull(invoice_no,''))[2]) AS customer_ref,
	if(source_name IN ('shopee', 'tiktok', 'tokopedia'), 'Marketplace', 'Non-Marketplace') as Sales_App,
	if(source_name IN ('shopee', 'tiktok', 'tokopedia'), upper(source_name), upper(app_type_prev)) as order_source,
	trimBoth(extract(ifNull(tags, ''), 'event_code:([^,]+)')) AS event_code,
	UPPER(coalesce(
    nullif(trimBoth(extract(ifNull(tags, ''), 'sales_code:([^,]+)')), ''),
    nullif(trimBoth(JSONExtractString(ifNull(note_attributes, '[]'), 1, 'value')), '')
	)) AS sales_code,
	multiIf(
		ifNull(pic_names, '') != '', 'YES',
		(concat('#', splitByChar('/', ifnull(invoice_no,''))[2]) like '%B2B%' AND app_type_prev ilike '%Draft%' AND pic_names IS NULL) OR order_source = 'MITRA', 'Probably',
		'NO'
		) AS assisted_order,
	province_std AS customer_province,
	upper(coalesce(shipping_address_city, customer_default_address_city)) as customer_city,
	case
		when district_raw is null or district_raw = '' then trimBoth(upper(splitByChar(',', ifNull(customer_default_address_address1,''))[-4]))
		else district_raw
	end as customer_district,
	customer_zip,
	dates,
	MonthName(dates) as month_name,
	toYear(dates) as year_num,
	if(concat('#', splitByChar('/', ifnull(invoice_no,''))[2]) like '%B2B%' AND (app_type_prev ilike '%Draft%' OR order_source = 'MITRA') AND pic_names IS NULL, 'Unclaimed', pic_teams) as pic_teams,
	pic_names,
	user_id,
	item,
	case
		when item ilike ('Benih Sawit Topaz 1-3 Seri 4 (100 butir)%') then 'Benih'
		when customer_ref in ('#B2B1940') then 'Benih'
		else prod_cat
	end as product_category,
	invoice_no,
	invoice_status,
	sale_order_status,
	potential_gmvs,
	gmv,
	revenue,
	sales_amount,
	shipping_cost,
	discount_amount,
	discount_code,
	discount_amount_code,
	sales_amount + shipping_cost - discount_amount as net_sales,
	original_gmv,
	qty,
	payment_date,
	dp_payment_date,
	full_payment_date,
	completion_date,
	first_order_date,
	order_retention_status,
	payment_type,
	dp_paid_amount,
	delivery_type,
	point_redemption_idr,
	discount_amount_in_idr,
	sku_kg,
	product_id,
	sku, total_kg,
	app_type_prev,
	application_type,
	utm_source,
	customer_email,
	customer_phone_number as phone_no,
	customer_name,
	user_groups,
	u_name,
	u_email,
	u_phone_no,
	duta_name,
	duta_phone_no,
    payment_channel_raw,
    payment_origin,
    multiIf(
        order_line_state = 'cancel', 'CANCELLED',
        toString(sale_order_status) IN ('COMPLETED', '32'), 'COMPLETED',
        toString(sale_order_status) = 'NEW', 'IN PROGRESS',
        toString(sale_order_status)
    ) AS sales_status,
    multiIf(
        requires_physical_delivery = 0, 'N/A - DIGITAL/JASA',
        odoo_delivery_status = 'full', 'DELIVERED',
        odoo_delivery_status = 'pending', 'IN TRANSIT',
        odoo_delivery_status = '0' AND num_of_deliveries > 0, 'DELIVERED',
        odoo_delivery_status = '0', 'NOT YET SHIPPED',
        odoo_delivery_status IS NULL, 'NOT YET SHIPPED',
        odoo_delivery_status
    ) AS delivery_status,
    order_line_state,
    odoo_delivery_status,
    num_of_deliveries,
    pickup_delivery_no,
    delivery_scheduled_at,
    delivery_completed_scheduled_at,
    cancelled_at,
    ready_at,
    invoice_expired_time,
    dateDiff('day', toDate(dates), payment_date) AS sla_creation_to_payment,
    dateDiff('day', toDate(dates), if(payment_date IS NULL, today(), payment_date)) AS sla_creation_to_payment_running,
    dateDiff('day', payment_date, completion_date) AS sla_payment_to_delivery,
    dateDiff('day', coalesce(payment_date, toDate(dates)), if(completion_date IS NULL, today(), completion_date)) AS sla_payment_to_delivery_running,
    dateDiff('day', toDate(dates), completion_date) AS total_SLA,
    dateDiff('day', toDate(dates), if(completion_date IS NULL, today(), completion_date)) AS total_SLA_running,
	dateDiff('day', toDate(dates), today()) AS Aging
FROM finale
) AS result
ANY LEFT JOIN (
	SELECT phone_normalized AS lead_phone, any(user_type) AS lead_user_type
	FROM default.larkbase_salesopportunities_leads
	WHERE ifNull(phone_normalized, '') != '' AND trimBoth(ifNull(toString(user_type), '')) != ''
	GROUP BY phone_normalized
) AS lsl ON result.u_phone_no = lsl.lead_phone
ANY LEFT JOIN (
	SELECT
	phone_no AS du_phone_no,
	any(case
			when user_role='AMBASSADOR' and user_role_group = 'COOPERATIVE' then 'KUD'
			when user_role='OWNER' and user_role_group = 'MERCHANT' then 'TOKO TANI'
			else user_role
		end) AS du_user_role
	FROM sawitpro_datamart.datamart_user
	WHERE ifNull(phone_no, '') != '' AND trimBoth(ifNull(toString(user_role), '')) != ''
	GROUP BY phone_no
) AS du ON result.u_phone_no = du.du_phone_no
ORDER BY dates DESC;
