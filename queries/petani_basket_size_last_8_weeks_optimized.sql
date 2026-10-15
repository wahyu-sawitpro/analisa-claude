-- =====================================================================
-- Basket size order PETANI (pupuk per-kg), 8 minggu terakhir yang sudah
-- selesai (Senin 8 minggu lalu s/d sebelum Senin minggu ini, Asia/Jakarta).
-- Versi rapi/optimasi dari query basket asli (finale + `basket` CTE).
-- Output: 1 baris per minggu (8 baris), kolom sama dengan query asli:
--   sale_order_week  : Senin awal minggu (toMonday tanggal order)
--   total_sales      : sum(basket_gmv), basket_gmv = sum(potential_gmvs)
--   total_invoice    : jumlah basket (invoice_no + tanggal)
--   basket_size      : median(basket_gmv)  -- tahan outlier
--   mean_basket_size : avg(basket_gmv)     -- pembanding
-- Filter (sama dengan query asli):
--   Sales_App != 'Marketplace', application_type = 'PETANI',
--   sales_status != 'CANCELLED', item ILIKE '%kg%',
--   product_category NOT IN (Racun, Token, Kaos, Pulsa..., Dokter Sawit,
--   Benih, Minyak Hemat).
-- Catatan definisi (dipertahankan dari query asli):
--   * basket_gmv = sum(potential_gmvs) (bukan `gmv` yang hanya terisi untuk
--     COMPLETED), jadi semua order yang lolos filter ikut sum/median/avg.
--   * Query ini TIDAK difilter per tim (semua pic_teams), sama seperti
--     aslinya. Lark semua tim tetap dibaca hanya karena join dop_fallback
--     (ALL join) bisa menggandakan baris -> mempengaruhi sum(gmv).
-- Optimasi:
--   * Hanya kolom yang dipakai filter/hitungan yang dibangun (geo, zip,
--     sku_line, user_type, SLA, dll. dibuang: semuanya ANY JOIN / kolom
--     tambahan yang tidak mengubah jumlah baris).
--   * Filter tanggal, item, kategori, marketplace & status diterapkan
--     langsung di tabel sumber; shopify_orders / flatten_eventapp_raw /
--     shopify_campaign_sales dipre-filter ke order dalam rentang.
--   * Multiplikasi dop_fallback dihitung sebagai bobot per baris.
-- TANPA pembungkus `SELECT ... FROM (...) AS source` (gagal di ClickHouse 24.4).
-- =====================================================================
WITH
    -- 8 minggu terakhir yang sudah selesai
    toMonday(now64(9, 'Asia/Jakarta') + INTERVAL -8 week) AS week_start,
    toMonday(now64(9, 'Asia/Jakarta')) AS week_end,
    -- ------------------------------------------------------------------
    -- (A) PIC lookup semua tim (invoice_lark / summary / data_order_pic
    --     asli). Hanya dipakai untuk bobot dop_fallback.
    -- ------------------------------------------------------------------
    lark_all AS (
      -- 7 kolom GROUP BY dipertahankan: jumlah barisnya = multiplikasi
      -- baris di join dop_fallback.
      SELECT
        upper(trimBoth(replace(replace(invoice_lark, 'INV#', ''), '#', ''))) AS invoice_lark,
        invoice_lark AS invoice_inputted,
        order_lark,
        notes,
        name_lark,
        team,
        pic_name
      FROM
        (
          SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice) AS invoice_lark,
                 order_no AS order_lark,
                 multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice') AS notes,
                 trimBoth(customer_name) AS name_lark, 'Sales' AS team, trimBoth(assignee) AS pic_name
          FROM default.larkbase_salesopportunities_salesteam
          WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          UNION ALL
          SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice),
                 order_no,
                 multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice'),
                 trimBoth(customer_name), 'Mills', trimBoth(assignee)
          FROM default.larkbase_salesopportunities_millsteam
          WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          UNION ALL
          SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice),
                 order_no,
                 multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice'),
                 trimBoth(assignee), 'Suppliers', trimBoth(assignee)
          FROM default.larkbase_salesopportunities_suppliersteam
          WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          UNION ALL
          SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice),
                 order_no,
                 multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice'),
                 trimBoth(assignee), 'Smallholders', trimBoth(assignee)
          FROM default.larkbase_salesopportunities_smallholdersteam
          WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          UNION ALL
          SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice),
                 order_no,
                 multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice'),
                 trimBoth(assignee), 'DG', trimBoth(assignee)
          FROM default.larkbase_salesopportunities_dg
          WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          UNION ALL
          SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice),
                 order_no,
                 multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice'),
                 trimBoth(assignee), 'Agronomist', trimBoth(assignee)
          FROM default.larkbase_salesopportunities_plantation
          WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          UNION ALL
          SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice),
                 order_no,
                 multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice'),
                 trimBoth(assignee), 'Finance FFB BD', trimBoth(assignee)
          FROM default.larkbase_salesopportunities_bdffb
          WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          UNION ALL
          SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice),
                 order_no,
                 multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice'),
                 trimBoth(assignee), 'Product Experiment', trimBoth(assignee)
          FROM default.larkbase_salesopportunities_aspekpir
          WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
        ) AS a
      WHERE
        invoice_lark NOT IN (
          'INV/20250501/SEED/114629',
          'INV/20250506/SEED/114777',
          'INV/20250103/RIZ04/100545',
          'INV/20250111/SUZ45/100057'
        )
      GROUP BY 1, 2, 3, 4, 5, 6, 7
    ),
    summary_all AS (
      SELECT
        multiIf(
          de.invoice_no != '', de.invoice_no,
          so.name != '', concat('INV/', replaceAll(so.name, '#', ''), '/SHPFY'),
          so1.name != '', concat('INV/', replaceAll(so1.name, '#', ''), '/SHPFY'),
          so2.name != '', concat('INV/', replaceAll(so2.name, '#', ''), '/SHPFY'),
          NULL
        ) AS invoice_no
      FROM
        lark_all AS il
        -- sisi kanan dipre-filter ke key yang ada di lark (hasil ANY JOIN sama)
        ANY LEFT JOIN (
          SELECT invoice_no, order_no, invoice_status, sale_order_status
          FROM sawitpro_datamart.datamart_ecommerce
          WHERE invoice_no IN (SELECT invoice_lark FROM lark_all)
        ) AS de
          ON (il.invoice_lark = de.invoice_no)
          AND (de.invoice_status IN ('PAID', 'PARTIAL_PAID'))
          AND (toString(de.sale_order_status) NOT IN ('CANCELLED', 'CANCELED', 'DRAFT'))
        ANY LEFT JOIN (
          SELECT name FROM default.shopify_orders
          WHERE replace(name, '#', '') IN (SELECT invoice_lark FROM lark_all)
        ) AS so
          ON (il.invoice_lark = replace(so.name, '#', ''))
        ANY LEFT JOIN (
          SELECT name FROM default.shopify_orders
          WHERE concat('INV/', replace(trimBoth(name), '#', ''), '/SHPFY') IN (SELECT invoice_lark FROM lark_all)
        ) AS so2
          ON (il.invoice_lark = concat('INV/', replace(trimBoth(so2.name), '#', ''), '/SHPFY'))
        ANY LEFT JOIN (
          SELECT name, ref FROM odoo_database.account_move
          WHERE name IN (SELECT invoice_lark FROM lark_all)
        ) AS am
          ON am.name = il.invoice_lark
        ANY LEFT JOIN (
          SELECT name FROM default.shopify_orders
          WHERE upper(name) IN (
            SELECT upper(ref) FROM odoo_database.account_move
            WHERE name IN (SELECT invoice_lark FROM lark_all)
          )
        ) AS so1
          ON upper(so1.name) = upper(am.ref)
      WHERE
        (de.order_no != '') OR (so.name != '') OR (am.name != '') OR (so2.name != '')
    ),
    pic_invoices AS (
      SELECT DISTINCT invoice_no FROM summary_all
    ),
    -- jumlah baris dop_fallback per order_no (= faktor penggandaan baris)
    fallback_mult AS (
      SELECT il.order_lark AS order_no, count() AS n
      FROM lark_all AS il
      INNER JOIN pic_invoices AS dp ON il.invoice_lark = dp.invoice_no
      WHERE il.order_lark != ''
      GROUP BY il.order_lark
    ),
    -- ------------------------------------------------------------------
    -- (B) Branch d: fct_new_sale_order_shopify
    -- ------------------------------------------------------------------
    fct_base AS (
      SELECT
        d.invoice_no AS invoice_no,
        d.store_name AS store_name,
        CAST(toDate(toTimeZone(d.sale_order_created_time, 'Asia/Jakarta')) AS Nullable(Date)) AS basket_date,
        CAST(d.potential_gmv AS Nullable(Float64)) AS row_gmv
      FROM sawitpro_datamart.fct_new_sale_order_shopify AS d
      WHERE
        basket_date >= week_start
        AND basket_date < week_end
        -- Sales_App != 'Marketplace'
        AND d.source_name NOT IN ('shopee', 'tiktok', 'tokopedia')
        -- sales_status != 'CANCELLED'
        AND coalesce(
              multiIf(
                d.order_line_state = 'cancel', 'CANCELLED',
                toString(d.sale_order_status) IN ('COMPLETED', '32'), 'COMPLETED',
                toString(d.sale_order_status) = 'NEW', 'IN PROGRESS',
                toString(d.sale_order_status)
              ), ''
            ) != 'CANCELLED'
        AND d.item ILIKE '%kg%'
        AND coalesce(
              multiIf(
                d.item ILIKE 'Benih Sawit Topaz 1-3 Seri 4 (100 butir)%', 'Benih',
                concat('#', splitByChar('/', ifNull(d.invoice_no, ''))[2]) = '#B2B1940', 'Benih',
                match(d.item, '(?i)herb'), 'Herbisida',
                d.product_category
              ), ''
            ) NOT IN ('Racun', 'Token', 'Kaos', 'Pulsa Telkomsel', 'Dokter Sawit', 'Benih',
                      'Minyak Hemat', 'Pulsa Axis', 'Pulsa Indosat', 'Pulsa Tri (3)')
    ),
    fct_so AS (
      SELECT id, name
      FROM default.shopify_orders
      WHERE concat('INV/', replaceAll(name, '#', ''), '/SHPFY') IN (SELECT invoice_no FROM fct_base)
    ),
    fct_rows AS (
      SELECT
        d.invoice_no AS invoice_no,
        d.basket_date AS basket_date,
        d.row_gmv AS row_gmv,
        if(fb.n > 0, fb.n, 1) AS row_weight
      FROM
        fct_base AS d
        LEFT JOIN fallback_mult AS fb ON fb.order_no = d.invoice_no
        ANY LEFT JOIN fct_so AS so
          ON concat('INV/', replaceAll(so.name, '#', ''), '/SHPFY') = d.invoice_no
        ANY LEFT JOIN (
          SELECT
            app_type,
            transaction_id,
            app_type_tokosawit,
            row_number() OVER (PARTITION BY transaction_id, app_type ORDER BY max(event_time) DESC) AS seqno
          FROM default.flatten_eventapp_raw
          WHERE transaction_id != ''
            AND app_type LIKE 'sawitpro%'
            -- filter per transaction_id (= PARTITION BY) -> seqno tidak berubah.
            -- '0' = CAST(so.id) saat order shopify tidak ketemu (default value join)
            AND (transaction_id IN (SELECT CAST(id, 'String') FROM fct_so) OR transaction_id = '0')
          GROUP BY 1, 2, 3
        ) AS tt ON (tt.app_type = replaceAll(d.store_name, '-', ''))
          AND (CAST(so.id, 'String') = tt.transaction_id)
          AND (tt.seqno = 1)
        ANY LEFT JOIN (
          SELECT order_id, store_name, utm_medium
          FROM default.shopify_campaign_sales
          WHERE order_id IN (SELECT CAST(id, 'String') FROM fct_so) OR order_id = '0'
        ) AS cs ON (cs.order_id = CAST(so.id, 'String'))
          AND (cs.store_name = d.store_name)
      WHERE
        -- application_type = 'PETANI'
        multiIf(
          cs.utm_medium != '', replaceAll(UPPER(cs.utm_medium), 'PROAPP', ''),
          tt.app_type_tokosawit = 'MEMBER', 'AGEN',
          tt.app_type_tokosawit != '', tt.app_type_tokosawit,
          'WEB'
        ) = 'PETANI'
    ),
    -- ------------------------------------------------------------------
    -- (C) Branch e: datamart_ecommerce (invoice yang tidak ada di fct)
    -- ------------------------------------------------------------------
    ecommerce_rows AS (
      SELECT
        e.invoice_no AS invoice_no,
        CAST(toTimeZone(e.sale_order_created_time, 'Asia/Jakarta') AS Nullable(Date)) AS basket_date,
        CAST(e.potential_gmv AS Nullable(Float64)) AS row_gmv,
        if(fb.n > 0, fb.n, 1) AS row_weight
      FROM
        sawitpro_datamart.datamart_ecommerce AS e
        INNER JOIN default.sale_order AS so_main ON e.sale_order_id = so_main.id
        -- INNER join tetap: membuang user fraud (dan menjaga multiplisitas)
        INNER JOIN (SELECT id FROM default.user WHERE fraud_flag != 5) AS u_e ON u_e.id = e.user_id
        LEFT JOIN fallback_mult AS fb ON fb.order_no = e.order_no
      WHERE
        ((e.invoice_status = 'PAID') OR (toString(e.sale_order_status) IN ('COMPLETED', '32')))
        AND e.invoice_no NOT IN (SELECT invoice_no FROM sawitpro_datamart.fct_new_sale_order_shopify)
        AND basket_date >= week_start
        AND basket_date < week_end
        -- application_type = 'PETANI' (source_name branch ini selalu Non-Marketplace)
        AND so_main.app_type = 'PETANI'
        -- sales_status != 'CANCELLED' (order_line_state selalu NULL di branch ini)
        AND toString(e.sale_order_status) != 'CANCELLED'
        AND e.item ILIKE '%kg%'
        AND coalesce(
              multiIf(
                e.item ILIKE 'Benih Sawit Topaz 1-3 Seri 4 (100 butir)%', 'Benih',
                concat('#', splitByChar('/', ifNull(e.invoice_no, ''))[2]) = '#B2B1940', 'Benih',
                match(e.item, '(?i)herb'), 'Herbisida',
                e.product_cat
              ), ''
            ) NOT IN ('Racun', 'Token', 'Kaos', 'Pulsa Telkomsel', 'Dokter Sawit', 'Benih',
                      'Minyak Hemat', 'Pulsa Axis', 'Pulsa Indosat', 'Pulsa Tri (3)')
    ),
    -- ------------------------------------------------------------------
    -- (D) Basket per invoice + tanggal (sama dengan CTE `basket` asli)
    -- ------------------------------------------------------------------
    basket AS (
      SELECT
        invoice_no,
        basket_date,
        sum(row_gmv * row_weight) AS basket_gmv
      FROM
        (
          SELECT invoice_no, basket_date, row_gmv, row_weight FROM fct_rows
          UNION ALL
          SELECT invoice_no, basket_date, row_gmv, row_weight FROM ecommerce_rows
        )
      GROUP BY
        invoice_no,
        basket_date
    )
SELECT
  toMonday(basket_date) AS sale_order_week,                                -- Senin awal minggu
  CAST(round(sum(basket_gmv)) AS Nullable(Int64)) AS total_sales,
  count() AS total_invoice,
  CAST(round(median(basket_gmv)) AS Nullable(Int64)) AS basket_size,       -- median, tahan outlier
  CAST(round(avg(basket_gmv)) AS Nullable(Int64)) AS mean_basket_size      -- pembanding
FROM
  basket
GROUP BY
  sale_order_week
ORDER BY
  sale_order_week
