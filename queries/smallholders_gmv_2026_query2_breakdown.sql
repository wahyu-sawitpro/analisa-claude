-- =====================================================================================
-- Breakdown GMV 2026 versi "query 2" (customer-360: SUM(potential_gmvs))
-- per invoice_status, sales_status, sumber, dan source_name.
--
-- Logika & filter sama dengan query 2:
--   Sales_App != 'Marketplace', pic_teams = 'Smallholders' (8 tim Lark, dengan override 'Unclaimed'),
--   coalesce(sales_status, '') != 'CANCELLED', item NOT ILIKE '%layanan%' / '%minyak%',
--   dates >= '2026-01-01'. TIDAK ada filter invoice_status (sama seperti query 2).
-- Kolom yang tidak memengaruhi angka (SLA, geo, area, user_type, dsb.) dibuang.
--
-- Cek: total gmv_tanpa_ongkir semua baris harus = hasil SUM(potential_gmvs) query 2.
-- =====================================================================================
WITH
lark_src AS (
    SELECT parent_invoice, invoice_no, order_no, trimBoth(customer_name) AS name_lark1, assignee, 'Sales' AS team
    FROM default.larkbase_salesopportunities_salesteam
    UNION ALL
    SELECT parent_invoice, invoice_no, order_no, trimBoth(customer_name), assignee, 'Mills'
    FROM default.larkbase_salesopportunities_millsteam
    UNION ALL
    SELECT parent_invoice, invoice_no, order_no, trimBoth(assignee), assignee, 'Suppliers'
    FROM default.larkbase_salesopportunities_suppliersteam
    UNION ALL
    SELECT parent_invoice, invoice_no, order_no, trimBoth(assignee), assignee, 'Smallholders'
    FROM default.larkbase_salesopportunities_smallholdersteam
    UNION ALL
    SELECT parent_invoice, invoice_no, order_no, trimBoth(assignee), assignee, 'DG'
    FROM default.larkbase_salesopportunities_dg
    UNION ALL
    SELECT parent_invoice, invoice_no, order_no, trimBoth(assignee), assignee, 'Agronomist'
    FROM default.larkbase_salesopportunities_plantation
    UNION ALL
    SELECT parent_invoice, invoice_no, order_no, trimBoth(assignee), assignee, 'Finance FFB BD'
    FROM default.larkbase_salesopportunities_bdffb
    UNION ALL
    SELECT parent_invoice, invoice_no, order_no, trimBoth(assignee), assignee, 'Product Experiment'
    FROM default.larkbase_salesopportunities_aspekpir
),
lark1 AS (
    SELECT DISTINCT
        upper(trimBoth(replaceAll(replaceAll(
            multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no),
            'INV#', ''), '#', ''))) AS invoice_lark,
        order_no AS order_lark,
        multiIf(parent_invoice != '', 'parent_invoice', invoice_no != '', 'invoice_no', 'order_no') AS notes,
        name_lark1,
        team,
        trimBoth(assignee) AS pic_name
    FROM lark_src
    WHERE (parent_invoice != '' OR invoice_no != '' OR order_no != '')
      AND invoice_lark NOT IN ('INV/20250501/SEED/114629', 'INV/20250506/SEED/114777',
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
-- join ALL, sama seperti query 2 (bisa menggandakan baris)
dop1_fallback AS (
    SELECT l.order_lark AS order_no, d.pic_teams, d.pic_names
    FROM lark1 AS l
    INNER JOIN dop1 AS d ON d.invoice_key = l.invoice_lark
    WHERE l.order_lark != ''
),
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
base AS (
    -- order Shopify
    SELECT
        'shopify (fct)'                                                  AS sumber,
        CAST(toDate(toTimeZone(d.sale_order_created_time, 'Asia/Jakarta')) AS Nullable(Date)) AS dates,
        CAST(d.invoice_no AS Nullable(String))                           AS invoice_no,
        CAST(d.item AS Nullable(String))                                 AS item,
        CAST(d.invoice_status AS Nullable(String))                       AS invoice_status,
        CAST(toString(d.sale_order_status) AS Nullable(String))          AS sale_order_status,
        CAST(d.order_line_state AS Nullable(String))                     AS order_line_state,
        CAST(d.source_name AS Nullable(String))                          AS source_name,
        CAST(d.potential_gmv AS Nullable(Float64))                       AS potential_gmvs,
        CAST(ifNull(toFloat64OrNull(toString(d.shipping_cost)), 0) AS Nullable(Float64)) AS shipping_cost,
        CAST(COALESCE(NULLIF(p1.pic_teams, ''), NULLIF(fb.pic_teams, '')) AS Nullable(String)) AS pic_teams_raw,
        CAST(COALESCE(NULLIF(p1.pic_names, ''), NULLIF(fb.pic_names, '')) AS Nullable(String)) AS pic_names,
        CAST(multiIf(
            d.source_name = 'shopify_draft_order', 'DRAFT ORDER',
            p1.pic_names != '', 'DRAFT ORDER',
            cs.utm_medium != '', replaceAll(upper(cs.utm_medium), 'PROAPP', ''),
            tt.app_type_tokosawit = 'MEMBER', 'AGEN',
            tt.app_type_tokosawit != '', tt.app_type_tokosawit,
            'WEB') AS Nullable(String))                                  AS app_type_prev
    FROM sawitpro_datamart.fct_new_sale_order_shopify AS d
    LEFT JOIN dop1 AS p1 ON p1.invoice_key = d.invoice_no
    LEFT JOIN dop1_fallback AS fb ON fb.order_no = d.invoice_no
    ANY LEFT JOIN (
        SELECT concat('INV/', replaceAll(name, '#', ''), '/SHPFY') AS so_invoice, id
        FROM default.shopify_orders
        WHERE so_invoice IN (SELECT k FROM sh1_keys)
    ) AS so ON so.so_invoice = d.invoice_no
    ANY LEFT JOIN (
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
    WHERE d.invoice_no IN (SELECT k FROM sh1_keys)
      AND toDate(toTimeZone(d.sale_order_created_time, 'Asia/Jakarta')) >= '2026-01-01'

    UNION ALL

    -- order ProApp (datamart_ecommerce) yang tidak ada di fct Shopify
    SELECT
        'proapp (datamart via sh)',
        CAST(toDate(toTimeZone(e.sale_order_created_time, 'Asia/Jakarta')) AS Nullable(Date)),
        CAST(e.invoice_no AS Nullable(String)),
        CAST(e.item AS Nullable(String)),
        CAST(e.invoice_status AS Nullable(String)),
        CAST(toString(e.sale_order_status) AS Nullable(String)),
        CAST(NULL AS Nullable(String)),
        CAST(multiIf(so_main.app_type = 'ADMIN_WEB', 'shopify_draft_order', 'PRO-APP') AS Nullable(String)),
        CAST(e.potential_gmv AS Nullable(Float64)),
        CAST(ifNull(toFloat64OrNull(toString(e.total_shipping_cost)), 0) AS Nullable(Float64)),
        CAST(COALESCE(NULLIF(p1.pic_teams, ''), NULLIF(fb.pic_teams, '')) AS Nullable(String)),
        CAST(COALESCE(NULLIF(p1.pic_names, ''), NULLIF(fb.pic_names, '')) AS Nullable(String)),
        CAST(multiIf(so_main.app_type = '', 'OTHERS', so_main.app_type = 'ADMIN_WEB', 'DRAFT ORDER',
                     so_main.app_type = 'MEMBER', 'AGEN', so_main.app_type) AS Nullable(String))
    FROM sawitpro_datamart.datamart_ecommerce AS e
    INNER JOIN (
        SELECT id, app_type
        FROM default.sale_order
        WHERE id IN (SELECT sale_order_id FROM sawitpro_datamart.datamart_ecommerce
                     WHERE invoice_no IN (SELECT k FROM sh1_keys) OR order_no IN (SELECT k FROM sh1_keys))
    ) AS so_main ON so_main.id = e.sale_order_id
    INNER JOIN (SELECT id FROM default.user WHERE fraud_flag != 5) AS u_e ON u_e.id = e.user_id
    LEFT JOIN dop1 AS p1 ON p1.invoice_key = e.invoice_no
    LEFT JOIN dop1_fallback AS fb ON fb.order_no = e.order_no
    WHERE (e.invoice_no IN (SELECT k FROM sh1_keys) OR e.order_no IN (SELECT k FROM sh1_keys))
      AND (e.invoice_status = 'PAID' OR toString(e.sale_order_status) IN ('COMPLETED', '32'))
      AND e.invoice_no NOT IN (SELECT invoice_no FROM sawitpro_datamart.fct_new_sale_order_shopify)
      AND toDate(toTimeZone(e.sale_order_created_time, 'Asia/Jakarta')) >= '2026-01-01'
),
q2_rows AS (
    SELECT
        *,
        concat('#', splitByChar('/', ifNull(invoice_no, ''))[2]) AS customer_ref,
        if(source_name IN ('shopee', 'tiktok', 'tokopedia'), 'Marketplace', 'Non-Marketplace') AS Sales_App,
        if(source_name IN ('shopee', 'tiktok', 'tokopedia'), upper(source_name), upper(app_type_prev)) AS order_source,
        if(
            customer_ref LIKE '%B2B%'
            AND (app_type_prev ILIKE '%Draft%' OR order_source = 'MITRA')
            AND pic_names IS NULL,
            'Unclaimed', pic_teams_raw
        ) AS pic_teams,
        multiIf(
            order_line_state = 'cancel', 'CANCELLED',
            sale_order_status IN ('COMPLETED', '32'), 'COMPLETED',
            sale_order_status = 'NEW', 'IN PROGRESS',
            sale_order_status
        ) AS sales_status
    FROM base
)
SELECT
    upper(invoice_status)                   AS inv_status,
    sales_status,
    sumber,
    source_name                             AS src,
    count()                                 AS rows,
    uniqExact(invoice_no)                   AS invoices,
    sum(potential_gmvs)                     AS gmv_tanpa_ongkir,
    sum(potential_gmvs + shipping_cost)     AS gmv_dengan_ongkir   -- ongkir terhitung 2x (potential_gmv sudah termasuk ongkir), hanya untuk diagnosa
FROM q2_rows
WHERE Sales_App != 'Marketplace'
  AND pic_teams = 'Smallholders'
  AND coalesce(sales_status, '') != 'CANCELLED'
  AND item NOT ILIKE '%layanan%'
  AND item NOT ILIKE '%minyak%'
  AND dates >= '2026-01-01'
GROUP BY inv_status, sales_status, sumber, src
ORDER BY gmv_tanpa_ongkir DESC
