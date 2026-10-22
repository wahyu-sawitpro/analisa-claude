-- =====================================================================
-- Breakdown GMV 2026 versi "query 1" (smallholders_gmv_2026_optimized.sql)
-- per sumber baris: datamart_ecommerce (ecommerce_rows) vs Shopify (fct).
-- Isi CTE identik dengan smallholders_gmv_2026_optimized.sql, hanya:
--   - ditambah kolom invoice_no di ecommerce_rows & shopify_rows
--   - SELECT akhir dipecah per sumber
-- Cek: total gmv_query1 = sum(gmv) query 1.
-- Bandingkan dengan smallholders_gmv_2026_query2_breakdown.sql.
-- =====================================================================
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
ecommerce_rows AS (
  -- branch 1: datamart_ecommerce. Window count() per invoice harus
  -- dihitung sebelum filter tahun & item -> filter itu di luar.
  SELECT invoice_no, sale_order_date, item_name, sales_amount, shipping_cost
  FROM
    (
      SELECT
        CAST(dm.invoice_no AS Nullable(String)) AS invoice_no,
        CAST(toDate(dm.sale_order_created_time) AS Nullable(Date)) AS sale_order_date,
        CAST(dm.item AS Nullable(String)) AS item_name,
        CAST(
          ifNull(
            dm.total_price_idr + ifNull(
              dm.total_shipping_cost / nullIf(count(dm.item) OVER (PARTITION BY dm.invoice_no), 0),
              0
            ),
            0
          ) AS Int64
        ) AS sales_amount,
        CAST(ifNull(dm.total_shipping_cost, 0) AS Int64) AS shipping_cost
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
),
shopify_rows AS (
  -- branch 2: `sh` (hanya bagian fct_new_sale_order_shopify yang bisa lolos)
  SELECT
    invoice_no,
    CAST(toDate(dates) AS Nullable(Date)) AS sale_order_date,
    CAST(item AS Nullable(String)) AS item_name,
    CAST(ifNull(potential_gmvs, 0) AS Int64) AS sales_amount,
    CAST(ifNull(shipping_cost, 0) AS Int64) AS shipping_cost
  FROM
    (
      SELECT
        CAST(toDate(toTimeZone(d.sale_order_created_time, 'Asia/Jakarta')) AS Nullable(Date)) AS dates,
        d.invoice_no AS invoice_no,
        d.item AS item,
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
        if(source_name IN ('shopee', 'tiktok', 'tokopedia'), 'Marketplace', 'Non-Marketplace') AS Sales_App,
        if(source_name IN ('shopee', 'tiktok', 'tokopedia'), upper(source_name), upper(app_type_prev)) AS order_source,
        if(
          concat('#', splitByChar('/', ifnull(invoice_no, '')) [2]) like '%B2B%'
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
)
SELECT
  sumber,
  count()                            AS rows,
  uniqExact(invoice_no)              AS invoices,
  sum(sales_amount)                  AS total_sales_amount,    -- datamart: total_price_idr + porsi ongkir; shopify: potential_gmv
  sum(shipping_cost)                 AS ongkir,
  sum(sales_amount + shipping_cost)  AS gmv_query1
FROM
  (
    SELECT 'datamart (ecommerce_rows)' AS sumber, * FROM ecommerce_rows
    UNION ALL
    SELECT 'shopify (fct)'             AS sumber, * FROM shopify_rows
  )
WHERE
  toYear(sale_order_date) >= 2026
  AND ifNull(item_name, '') != 'Biaya Layanan'
  AND notILike(ifNull(item_name, ''), '%minyak%')
GROUP BY sumber
ORDER BY gmv_query1 DESC
