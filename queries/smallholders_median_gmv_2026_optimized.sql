-- [FIX ongkir] sales_amount (potential_gmv / total_price_idr + porsi ongkir) sudah termasuk ongkir;
-- shipping_cost tidak ditambahkan lagi ke GMV / nett sales (dulu ongkir terhitung 2x).
-- =====================================================================
-- Median GMV per baris final_result, tim Smallholders (sale_order_date >= 2026)
-- Optimasi sama dengan smallholders_gmv_2026_optimized.sql, bedanya median
-- butuh GROUP BY final_result tetap ada:
--
--  - Key GROUP BY yang merupakan fungsi dari invoice/customer dibuang karena
--    tidak memecah grup: pic_name & pic_team (dari ss, per invoice) dan
--    cfo.min_sale_order_date (per customer_id) -> join ss & customer_first_order
--    tidak perlu, combined_sales tidak dihitung 2x.
--  - province, city, sales_code: di branch datamart_ecommerce konstan,
--    di branch shopify fungsi dari invoice (via join shopify_orders) ->
--    diganti penanda branch `src` (geo mapping & tags tidak perlu dihitung).
--  - Fokus Smallholders: hanya larkbase_salesopportunities_smallholdersteam;
--    invoice yang juga di-claim tim lain ikut dihitung.
--  - Catatan: median() di ClickHouse adalah perkiraan (sampling) jika jumlah
--    grup > 8192, sama seperti query asli. Pakai medianExact() kalau perlu
--    angka pasti.
-- =====================================================================
SELECT
  `source`.`total_sales` AS `total_sales`
FROM
  (
    WITH
    -- ------------------------------------------------------------------
    -- (A) Invoice yang di-claim tim Smallholders
    --     (pengganti subquery `ss` di final_result)
    -- ------------------------------------------------------------------
    lark_ss AS (
      SELECT
        replaceAll(replaceAll(upper(trim(invoice_lark)), 'INV#', ''), '#', '') AS invoice_lark,
        replaceAll(replaceAll(replaceAll(replaceAll(upper(trim(invoice_lark)), 'INV#', ''), '#', ''), 'INV/', ''), '/SHPFY', '') AS clean_invoice_key,
        team
      FROM
        (
          SELECT multiIf(parent_invoice <> '', parent_invoice, invoice_no <> '', invoice_no, order_no <> '', order_no, parent_invoice) AS invoice_lark, 'Smallholders' AS team
          FROM default.larkbase_salesopportunities_smallholdersteam
          WHERE parent_invoice <> '' OR invoice_no <> '' OR order_no <> ''
          -- tim lain tidak dipakai (fokus Smallholders)
          -- UNION ALL
          -- SELECT multiIf(parent_invoice <> '', parent_invoice, invoice_no <> '', invoice_no, order_no <> '', order_no, parent_invoice) AS invoice_lark, 'Sales' AS team
          -- FROM default.larkbase_salesopportunities_salesteam
          -- WHERE parent_invoice <> '' OR invoice_no <> '' OR order_no <> ''
          -- UNION ALL
          -- SELECT multiIf(parent_invoice <> '', parent_invoice, invoice_no <> '', invoice_no, order_no <> '', order_no, parent_invoice), 'Mills'
          -- FROM default.larkbase_salesopportunities_millsteam
          -- WHERE parent_invoice <> '' OR invoice_no <> '' OR order_no <> ''
          -- UNION ALL
          -- SELECT multiIf(parent_invoice <> '', parent_invoice, invoice_no <> '', invoice_no, order_no <> '', order_no, parent_invoice), 'Suppliers'
          -- FROM default.larkbase_salesopportunities_suppliersteam
          -- WHERE parent_invoice <> '' OR invoice_no <> '' OR order_no <> ''
          -- UNION ALL
          -- SELECT multiIf(parent_invoice <> '', parent_invoice, invoice_no <> '', invoice_no, order_no <> '', order_no, parent_invoice), 'DG'
          -- FROM default.larkbase_salesopportunities_dg
          -- WHERE parent_invoice <> '' OR invoice_no <> '' OR order_no <> ''
          -- UNION ALL
          -- SELECT multiIf(parent_invoice <> '', parent_invoice, invoice_no <> '', invoice_no, order_no <> '', order_no, parent_invoice), 'Plantation'
          -- FROM default.larkbase_salesopportunities_plantation
          -- WHERE parent_invoice <> '' OR invoice_no <> '' OR order_no <> ''
          -- UNION ALL
          -- SELECT multiIf(parent_invoice <> '', parent_invoice, invoice_no <> '', invoice_no, order_no <> '', order_no, parent_invoice), 'Product Experiment'
          -- FROM default.larkbase_salesopportunities_aspekpir
          -- WHERE parent_invoice <> '' OR invoice_no <> '' OR order_no <> ''
          -- UNION ALL
          -- SELECT multiIf(parent_invoice <> '', parent_invoice, invoice_no <> '', invoice_no, order_no <> '', order_no, parent_invoice), 'FFB BD'
          -- FROM default.larkbase_salesopportunities_bdffb
          -- WHERE parent_invoice <> '' OR invoice_no <> '' OR order_no <> ''
        ) a
      WHERE
        invoice_lark NOT IN (
          'INV/20250501/SEED/114629',
          'INV/20250506/SEED/114777',
          'INV/20250103/RIZ04/100545',
          'INV/20250111/SUZ45/100057'
        )
      GROUP BY
        invoice_lark,
        clean_invoice_key,
        team
    ),
    summary_ss AS (
      SELECT
        multiIf(
          de.invoice_no <> '', de.invoice_no,
          so.name <> '', concat('INV/', replaceAll(so.name, '#', ''), '/SHPFY'),
          so1.name <> '', concat('INV/', replaceAll(so1.name, '#', ''), '/SHPFY'),
          startsWith(il.invoice_lark, 'INV/'), il.invoice_lark,
          concat('INV/', il.invoice_lark, '/SHPFY')
        ) AS invoice_no,
        il.team AS team
      FROM
        lark_ss il
        LEFT JOIN (
          SELECT DISTINCT invoice_no
          FROM sawitpro_datamart.datamart_ecommerce
          WHERE invoice_status IN ('PAID', 'PARTIAL_PAID')
            AND sale_order_status NOT IN ('CANCELLED', 'CANCELED', 'DRAFT')
            AND invoice_no IN (SELECT invoice_lark FROM lark_ss)
        ) de ON il.invoice_lark = de.invoice_no
        LEFT JOIN (
          SELECT DISTINCT replaceAll(name, '#', '') AS clean_so_name, name
          FROM default.shopify_orders
          WHERE replaceAll(name, '#', '') IN (SELECT clean_invoice_key FROM lark_ss)
        ) so ON il.clean_invoice_key = so.clean_so_name
        LEFT JOIN (
          SELECT DISTINCT upper(trim(name)) AS name, replaceAll(upper(trim(ref)), '#', '') AS clean_ref
          FROM odoo_database.account_move
          WHERE upper(trim(name)) IN (SELECT invoice_lark FROM lark_ss)
        ) am ON am.name = il.invoice_lark
        LEFT JOIN (
          SELECT DISTINCT replaceAll(upper(trim(name)), '#', '') AS clean_so_name, name
          FROM default.shopify_orders
          WHERE replaceAll(upper(trim(name)), '#', '') IN (
            SELECT replaceAll(upper(trim(ref)), '#', '')
            FROM odoo_database.account_move
            WHERE upper(trim(name)) IN (SELECT invoice_lark FROM lark_ss)
          )
            -- key '' tetap ikut: baris lark tanpa match account_move join ke clean_ref ''
            OR replaceAll(upper(trim(name)), '#', '') = ''
        ) so1 ON so1.clean_so_name = am.clean_ref
    ),
    smallholder_invoices AS (
      SELECT DISTINCT invoice_no
      FROM summary_ss
      -- GROUP BY invoice_no
      -- HAVING arrayStringConcat(arraySort(groupUniqArray(team)), ';') = 'Smallholders'
    ),
    -- ------------------------------------------------------------------
    -- (B) PIC lookup versi `sh` (dipakai dop1 & dop_fallback)
    -- ------------------------------------------------------------------
    lark_sh AS (
      -- 7 kolom GROUP BY dipertahankan: jumlah barisnya menentukan
      -- multiplikasi baris di join dop_fallback.
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
                 trimBoth(assignee) AS name_lark, 'Smallholders' AS team, trimBoth(assignee) AS pic_name
          FROM default.larkbase_salesopportunities_smallholdersteam
          WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          -- tim lain tidak dipakai (fokus Smallholders)
          -- UNION ALL
          -- SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice) AS invoice_lark,
          --        order_no AS order_lark,
          --        multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice') AS notes,
          --        trimBoth(customer_name) AS name_lark, 'Sales' AS team, trimBoth(assignee) AS pic_name
          -- FROM default.larkbase_salesopportunities_salesteam
          -- WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          -- UNION ALL
          -- SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice),
          --        order_no,
          --        multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice'),
          --        trimBoth(customer_name), 'Mills', trimBoth(assignee)
          -- FROM default.larkbase_salesopportunities_millsteam
          -- WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          -- UNION ALL
          -- SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice),
          --        order_no,
          --        multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice'),
          --        trimBoth(assignee), 'Suppliers', trimBoth(assignee)
          -- FROM default.larkbase_salesopportunities_suppliersteam
          -- WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          -- UNION ALL
          -- SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice),
          --        order_no,
          --        multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice'),
          --        trimBoth(assignee), 'DG', trimBoth(assignee)
          -- FROM default.larkbase_salesopportunities_dg
          -- WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          -- UNION ALL
          -- SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice),
          --        order_no,
          --        multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice'),
          --        trimBoth(assignee), 'Agronomist', trimBoth(assignee)
          -- FROM default.larkbase_salesopportunities_plantation
          -- WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          -- UNION ALL
          -- SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice),
          --        order_no,
          --        multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice'),
          --        trimBoth(assignee), 'Finance FFB BD', trimBoth(assignee)
          -- FROM default.larkbase_salesopportunities_bdffb
          -- WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          -- UNION ALL
          -- SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice),
          --        order_no,
          --        multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', order_no != '', 'order_no', 'parent_invoice'),
          --        trimBoth(assignee), 'Product Experiment', trimBoth(assignee)
          -- FROM default.larkbase_salesopportunities_aspekpir
          -- WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
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
    summary_sh AS (
      SELECT
        multiIf(
          de.invoice_no != '', de.invoice_no,
          so.name != '', concat('INV/', replaceAll(so.name, '#', ''), '/SHPFY'),
          so1.name != '', concat('INV/', replaceAll(so1.name, '#', ''), '/SHPFY'),
          so2.name != '', concat('INV/', replaceAll(so2.name, '#', ''), '/SHPFY'),
          NULL
        ) AS invoice_no,
        il.team,
        trimBoth(il.pic_name) AS pic_name
      FROM
        lark_sh AS il
        -- sisi kanan dipre-filter ke key yang ada di lark (kandidat match per key
        -- tidak berubah, jadi hasil ANY JOIN tetap sama)
        ANY LEFT JOIN (
          SELECT invoice_no, order_no, invoice_status, sale_order_status
          FROM sawitpro_datamart.datamart_ecommerce
          WHERE invoice_no IN (SELECT invoice_lark FROM lark_sh)
        ) AS de
          ON (il.invoice_lark = de.invoice_no)
          AND (de.invoice_status IN ('PAID', 'PARTIAL_PAID'))
          AND (toString(de.sale_order_status) NOT IN ('CANCELLED', 'CANCELED', 'DRAFT'))
        ANY LEFT JOIN (
          SELECT name FROM default.shopify_orders
          WHERE replace(name, '#', '') IN (SELECT invoice_lark FROM lark_sh)
        ) AS so
          ON (il.invoice_lark = replace(so.name, '#', ''))
        ANY LEFT JOIN (
          SELECT name FROM default.shopify_orders
          WHERE concat('INV/', replace(trimBoth(name), '#', ''), '/SHPFY') IN (SELECT invoice_lark FROM lark_sh)
        ) AS so2
          ON (il.invoice_lark = concat('INV/', replace(trimBoth(so2.name), '#', ''), '/SHPFY'))
        ANY LEFT JOIN (
          SELECT name, ref FROM odoo_database.account_move
          WHERE name IN (SELECT invoice_lark FROM lark_sh)
        ) AS am
          ON am.name = il.invoice_lark
        ANY LEFT JOIN (
          SELECT name FROM default.shopify_orders
          WHERE upper(name) IN (
            SELECT upper(ref) FROM odoo_database.account_move
            WHERE name IN (SELECT invoice_lark FROM lark_sh)
          )
        ) AS so1
          ON upper(so1.name) = upper(am.ref)
      WHERE
        (de.order_no != '') OR (so.name != '') OR (am.name != '') OR (so2.name != '')
    ),
    pic_sh AS (
      SELECT
        invoice_no,
        arrayStringConcat(arraySort(groupUniqArray(team)), ';') AS pic_teams,
        arrayStringConcat(arraySort(groupUniqArray(trimBoth(pic_name))), ';') AS pic_names
      FROM summary_sh
      GROUP BY 1
    ),
    -- id shopify order milik invoice relevan (untuk pre-filter tt & cs)
    relevant_so_ids AS (
      SELECT CAST(id, 'String') AS so_id
      FROM default.shopify_orders
      WHERE concat('INV/', replaceAll(name, '#', ''), '/SHPFY') IN (SELECT invoice_no FROM smallholder_invoices)
    ),
    -- ------------------------------------------------------------------
    -- (C) Baris sumber penjualan (pengganti combined_sales)
    -- ------------------------------------------------------------------
    combined_sales AS (
      -- branch 1: datamart_ecommerce. Window count() per invoice harus
      -- dihitung sebelum filter tahun & item -> filter itu di luar.
      SELECT *
      FROM
        (
          SELECT
            1 AS src,
            CAST(dm.user_id AS Nullable(String)) AS user_id,
            CAST(dm.name AS Nullable(String)) AS user_name,
            CAST(dm.phone_number AS Nullable(String)) AS phone_number,
            CAST(dm.invoice_no AS Nullable(String)) AS invoice_no,
            CAST(dm.order_no AS Nullable(String)) AS order_no,
            CAST(toDate(dm.sale_order_created_time) AS Nullable(Date)) AS sale_order_date,
            CAST(dm.product_cat AS Nullable(String)) AS product_cat,
            CAST(
              ifNull(
                dm.total_price_idr + ifNull(
                  dm.total_shipping_cost / nullIf(count(dm.item) OVER (PARTITION BY dm.invoice_no), 0),
                  0
                ),
                0
              ) AS Int64
            ) AS sales_amount,
            CAST(ifNull(dm.total_shipping_cost, 0) AS Int64) AS shipping_cost,
            CAST(dm.item AS Nullable(String)) AS item_name,
            CAST(dm.invoice_status AS Nullable(String)) AS invoice_status,
            CAST(dm.sale_order_status AS Nullable(String)) AS sale_order_status,
            CAST(dm.commerce_channel AS Nullable(String)) AS source_name,
            CAST(so.app_type AS Nullable(String)) AS app_type
          FROM
            sawitpro_datamart.datamart_ecommerce dm
            INNER JOIN default.sale_order so ON so.id = dm.sale_order_id
          WHERE
            dm.invoice_status IN ('PAID', 'PARTIAL_PAID')
            AND dm.sale_order_status NOT IN ('CANCELLED', 'CANCELED', 'DRAFT')
            -- filter level-invoice (= PARTITION BY) -> window tidak berubah
            AND dm.invoice_no IN (SELECT invoice_no FROM smallholder_invoices)
        )
      WHERE
        toYear(sale_order_date) >= 2026
      UNION ALL
      -- branch 2: `sh` (hanya bagian fct_new_sale_order_shopify yang bisa lolos)
      SELECT
        2 AS src,
        CAST(user_id AS Nullable(String)) AS user_id,
        CAST(customer_name AS Nullable(String)) AS user_name,
        CAST(phone_no AS Nullable(String)) AS phone_number,
        CAST(invoice_no AS Nullable(String)) AS invoice_no,
        CAST(customer_ref AS Nullable(String)) AS order_no,
        CAST(toDate(dates) AS Nullable(Date)) AS sale_order_date,
        CAST(product_category AS Nullable(String)) AS product_cat,
        CAST(ifNull(potential_gmvs, 0) AS Int64) AS sales_amount,
        CAST(ifNull(shipping_cost, 0) AS Int64) AS shipping_cost,
        CAST(item AS Nullable(String)) AS item_name,
        CAST(upper(invoice_status) AS Nullable(String)) AS invoice_status,
        CAST(upper(sale_order_status) AS Nullable(String)) AS sale_order_status,
        CAST(app_type_prev AS Nullable(String)) AS source_name,
        CAST(application_type AS Nullable(String)) AS app_type
      FROM
        (
          SELECT
            CAST(toDate(toTimeZone(d.sale_order_created_time, 'Asia/Jakarta')) AS Nullable(Date)) AS dates,
            d.user_id AS user_id,
            trimBoth(d.name) AS customer_name,
            d.customer_phone_number AS phone_no,
            d.invoice_no AS invoice_no,
            concat('#', splitByChar('/', ifnull(invoice_no, '')) [2]) AS customer_ref,
            d.item AS item,
            CAST(multiIf(match(d.item, '(?i)herb'), 'Herbisida', d.product_category) AS Nullable(String)) AS prod_cat,
            case
              when item ilike ('Benih Sawit Topaz 1-3 Seri 4 (100 butir)%') then 'Benih'
              when customer_ref in ('#B2B1940') then 'Benih'
              else prod_cat
            end AS product_category,
            d.invoice_status AS invoice_status,
            toString(d.sale_order_status) AS sale_order_status,
            d.order_line_state AS order_line_state,
            d.source_name AS source_name,
            CAST(d.potential_gmv AS Nullable(Float64)) AS potential_gmvs,
            CAST(ifNull(toFloat64OrNull(toString(d.shipping_cost)), 0) AS Nullable(Float64)) AS shipping_cost,
            COALESCE(NULLIF(dop1.pic_teams, ''), NULLIF(dop_fallback.pic_teams, '')) AS pic_teams_raw,
            COALESCE(NULLIF(dop1.pic_names, ''), NULLIF(dop_fallback.pic_names, '')) AS pic_names,
            multiIf(
              d.source_name = 'shopify_draft_order', 'DRAFT ORDER',
              dop1.pic_names != '', 'DRAFT ORDER',
              cs.utm_medium != '', replaceAll(UPPER(cs.utm_medium), 'PROAPP', ''),
              tt.app_type_tokosawit = 'MEMBER', 'AGEN',
              tt.app_type_tokosawit != '', tt.app_type_tokosawit,
              'WEB'
            ) AS app_type_prev,
            multiIf(
              cs.utm_medium != '', replaceAll(UPPER(cs.utm_medium), 'PROAPP', ''),
              tt.app_type_tokosawit = 'MEMBER', 'AGEN',
              tt.app_type_tokosawit != '', tt.app_type_tokosawit,
              'WEB'
            ) AS application_type,
            if(source_name IN ('shopee', 'tiktok', 'tokopedia'), 'Marketplace', 'Non-Marketplace') AS Sales_App,
            if(source_name IN ('shopee', 'tiktok', 'tokopedia'), upper(source_name), upper(app_type_prev)) AS order_source,
            if(
              customer_ref like '%B2B%'
              AND (app_type_prev ilike '%Draft%' OR order_source = 'MITRA')
              AND pic_names IS NULL,
              'Unclaimed',
              pic_teams_raw
            ) AS pic_teams
          FROM
            sawitpro_datamart.fct_new_sale_order_shopify AS d
            LEFT JOIN pic_sh AS dop1 ON dop1.invoice_no = d.invoice_no
            -- ALL join: bisa menggandakan baris -> wajib dipertahankan
            LEFT JOIN (
              SELECT il.order_lark AS order_no, dp.pic_teams, dp.pic_names
              FROM lark_sh AS il
              INNER JOIN pic_sh AS dp ON il.invoice_lark = dp.invoice_no
              WHERE il.order_lark != ''
                AND il.order_lark IN (SELECT invoice_no FROM smallholder_invoices)
            ) AS dop_fallback ON dop_fallback.order_no = d.invoice_no
            ANY LEFT JOIN (
              SELECT id, name
              FROM default.shopify_orders
              WHERE concat('INV/', replaceAll(name, '#', ''), '/SHPFY') IN (SELECT invoice_no FROM smallholder_invoices)
            ) AS so ON concat('INV/', replaceAll(so.name, '#', ''), '/SHPFY') = d.invoice_no
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
                AND (transaction_id IN (SELECT so_id FROM relevant_so_ids) OR transaction_id = '0')
              GROUP BY 1, 2, 3
            ) AS tt ON (tt.app_type = replaceAll(d.store_name, '-', ''))
              AND (CAST(so.id, 'String') = tt.transaction_id)
              AND (tt.seqno = 1)
            ANY LEFT JOIN (
              SELECT order_id, store_name, utm_medium
              FROM default.shopify_campaign_sales
              WHERE order_id IN (SELECT so_id FROM relevant_so_ids) OR order_id = '0'
            ) AS cs ON (cs.order_id = CAST(so.id, 'String'))
              AND (cs.store_name = d.store_name)
          WHERE
            d.invoice_no IN (SELECT invoice_no FROM smallholder_invoices)
            AND dates >= '2026-01-01'
        )
      WHERE
        upper(invoice_status) IN ('PAID', 'PARTIAL_PAID')
        AND upper(sale_order_status) NOT IN ('CANCELLED', 'CANCELED', 'DRAFT')
        AND ifNull(order_line_state, '') <> 'cancel'  -- NULL bukan cancel, tetap dihitung
        AND Sales_App <> 'Marketplace'
        AND pic_teams = 'Smallholders'
        AND item NOT IN ('Biaya Layanan', 'Minyak Goreng 1 Liter - Minyak Hemat Petani Hebat')
    ),
    final_result AS (
      SELECT
        CAST(sum(cs.sales_amount) AS Int64) AS gmv
      FROM
        combined_sales cs
      WHERE
        toYear(cs.sale_order_date) >= 2026
        AND ifNull(cs.item_name, '') != 'Biaya Layanan'
        AND notILike(ifNull(cs.item_name, ''), '%minyak%')
      GROUP BY
        cs.src,
        trimBoth(cs.user_id),
        trimBoth(cs.user_name),
        trimBoth(cs.phone_number),
        cs.invoice_no,
        cs.order_no,
        cs.app_type,
        cs.sale_order_date,
        trimBoth(cs.item_name),
        cs.product_cat,
        cs.sale_order_status,
        cs.invoice_status,
        cs.source_name
    )
    SELECT
      median(gmv) AS total_sales
    FROM
      final_result
  ) AS `source`
LIMIT
  1048575
