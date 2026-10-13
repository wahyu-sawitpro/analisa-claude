-- =====================================================================
-- Cek selisih jumlah invoice unik 2026:
--   ours : smallholders_invoice_count_monthly_2026 / query uniqExact (553)
--   orig : query "GMV & total_order per customer_province" (finale asli,
--          semua tim lark) dengan filter Metabase:
--            dates >= 2026-01-01, Sales_App != 'Marketplace',
--            ifNull(order_line_state,'') != 'cancel', pic_teams = 'Smallholders',
--            product_category != 'Minyak Hemat', item != 'Biaya Layanan'  (565)
-- Output: satu baris per invoice yang HANYA ada di salah satu versi, plus
-- kolom bantu untuk melihat penyebabnya. Kolom total_ours / total_orig
-- harus sama dengan 553 / 565 (kalau tidak, logika pembanding ini belum pas).
-- Perbedaan definisi yang dicek:
--   1. Status  : ours hanya PAID/PARTIAL_PAID & bukan CANCELLED/DRAFT;
--                orig TIDAK memfilter invoice_status / sale_order_status.
--   2. Tim     : ours hitung invoice yang di-claim Smallholders walau juga
--                di-claim tim lain; orig hanya pic_teams = 'Smallholders' persis.
--   3. Item    : ours buang semua item ILIKE '%minyak%';
--                orig buang product_category 'Minyak Hemat' (dan baris
--                dengan product_category NULL ikut terbuang).
--   4. Datamart: ours pakai branch 1 (datamart + sale_order, PAID/PARTIAL_PAID);
--                orig pakai branch `e` (PAID atau COMPLETED, user non-fraud,
--                invoice yang tidak ada di fct, wajib di-claim).
-- Kolom cust_province tidak ikut (tidak mempengaruhi jumlah invoice).
-- TANPA pembungkus `SELECT ... FROM (...) AS source` (gagal di ClickHouse 24.4).
-- =====================================================================
WITH
    -- tahun 2026
    toDate('2026-01-01') AS period_start,
    toDate('2027-01-01') AS period_end,
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
    -- (B) PIC lookup SEMUA tim (sama dengan invoice_lark/summary/
    --     data_order_pic di query asli) -> dipakai untuk kedua versi
    -- ------------------------------------------------------------------
    lark_all AS (
      SELECT
        upper(trimBoth(replace(replace(invoice_lark, 'INV#', ''), '#', ''))) AS invoice_lark,
        order_lark,
        team
      FROM
        (
          SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice) AS invoice_lark, order_no AS order_lark, 'Sales' AS team
          FROM default.larkbase_salesopportunities_salesteam
          WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          UNION ALL
          SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice), order_no, 'Mills'
          FROM default.larkbase_salesopportunities_millsteam
          WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          UNION ALL
          SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice), order_no, 'Suppliers'
          FROM default.larkbase_salesopportunities_suppliersteam
          WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          UNION ALL
          SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice), order_no, 'Smallholders'
          FROM default.larkbase_salesopportunities_smallholdersteam
          WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          UNION ALL
          SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice), order_no, 'DG'
          FROM default.larkbase_salesopportunities_dg
          WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          UNION ALL
          SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice), order_no, 'Agronomist'
          FROM default.larkbase_salesopportunities_plantation
          WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          UNION ALL
          SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice), order_no, 'Finance FFB BD'
          FROM default.larkbase_salesopportunities_bdffb
          WHERE (parent_invoice != '') OR (invoice_no != '') OR (order_no != '')
          UNION ALL
          SELECT multiIf(parent_invoice != '', parent_invoice, invoice_no != '', invoice_no, order_no != '', order_no, parent_invoice), order_no, 'Product Experiment'
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
      GROUP BY 1, 2, 3
    ),
    summary_all AS (
      SELECT
        multiIf(
          de.invoice_no != '', de.invoice_no,
          so.name != '', concat('INV/', replaceAll(so.name, '#', ''), '/SHPFY'),
          so1.name != '', concat('INV/', replaceAll(so1.name, '#', ''), '/SHPFY'),
          so2.name != '', concat('INV/', replaceAll(so2.name, '#', ''), '/SHPFY'),
          NULL
        ) AS invoice_no,
        il.team
      FROM
        lark_all AS il
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
    pic_all AS (
      SELECT
        invoice_no,
        arrayStringConcat(arraySort(groupUniqArray(team)), ';') AS pic_teams
      FROM summary_all
      GROUP BY 1
    ),
    fallback_all AS (
      SELECT il.order_lark AS order_no, dp.pic_teams
      FROM lark_all AS il
      INNER JOIN pic_all AS dp ON il.invoice_lark = dp.invoice_no
      WHERE il.order_lark != ''
    ),
    -- ------------------------------------------------------------------
    -- (C) Baris per sumber
    -- ------------------------------------------------------------------
    -- ours, branch 1: datamart_ecommerce (tanpa filter pic)
    ours_dm AS (
      SELECT DISTINCT dm.invoice_no AS invoice_no
      FROM
        sawitpro_datamart.datamart_ecommerce dm
        INNER JOIN default.sale_order so ON so.id = dm.sale_order_id
      WHERE
        dm.invoice_status IN ('PAID', 'PARTIAL_PAID')
        AND dm.sale_order_status NOT IN ('CANCELLED', 'CANCELED', 'DRAFT')
        AND dm.invoice_no IN (SELECT invoice_no FROM smallholder_invoices)
        AND toDate(dm.sale_order_created_time) >= period_start
        AND toDate(dm.sale_order_created_time) < period_end
        AND ifNull(dm.item, '') != 'Biaya Layanan'
        AND notILike(ifNull(dm.item, ''), '%minyak%')
    ),
    -- fct_new_sale_order_shopify, dipakai kedua versi
    fct_rows AS (
      SELECT
        d.invoice_no AS invoice_no,
        d.item AS item,
        multiIf(
          d.item ILIKE 'Benih Sawit Topaz 1-3 Seri 4 (100 butir)%', 'Benih',
          concat('#', splitByChar('/', ifNull(d.invoice_no, ''))[2]) = '#B2B1940', 'Benih',
          match(d.item, '(?i)herb'), 'Herbisida',
          d.product_category
        ) AS product_category,
        upper(d.invoice_status) AS inv_status,
        upper(toString(d.sale_order_status)) AS so_status,
        d.order_line_state AS order_line_state,
        d.source_name AS source_name,
        COALESCE(NULLIF(dop1.pic_teams, ''), NULLIF(fb.pic_teams, '')) AS pic_teams_orig,
        -- ours hanya baca lark Smallholders: claimed kalau Smallholders ada
        -- di dop1 atau di fallback
        has(splitByChar(';', ifNull(dop1.pic_teams, '')), 'Smallholders')
          OR has(splitByChar(';', ifNull(fb.pic_teams, '')), 'Smallholders') AS claimed_sh
      FROM
        sawitpro_datamart.fct_new_sale_order_shopify AS d
        LEFT JOIN pic_all AS dop1 ON dop1.invoice_no = d.invoice_no
        LEFT JOIN fallback_all AS fb ON fb.order_no = d.invoice_no
      WHERE
        toDate(toTimeZone(d.sale_order_created_time, 'Asia/Jakarta')) >= period_start
        AND toDate(toTimeZone(d.sale_order_created_time, 'Asia/Jakarta')) < period_end
        AND (
          d.invoice_no IN (SELECT invoice_no FROM smallholder_invoices)
          OR d.invoice_no IN (SELECT order_lark FROM lark_all WHERE team = 'Smallholders')
        )
    ),
    -- orig, branch e: datamart_ecommerce yang tidak ada di fct
    orig_dm_rows AS (
      SELECT
        e.invoice_no AS invoice_no,
        e.item AS item,
        multiIf(
          e.item ILIKE 'Benih Sawit Topaz 1-3 Seri 4 (100 butir)%', 'Benih',
          concat('#', splitByChar('/', ifNull(e.invoice_no, ''))[2]) = '#B2B1940', 'Benih',
          match(e.item, '(?i)herb'), 'Herbisida',
          e.product_cat
        ) AS product_category,
        upper(e.invoice_status) AS inv_status,
        upper(toString(e.sale_order_status)) AS so_status,
        COALESCE(NULLIF(dop.pic_teams, ''), NULLIF(fb.pic_teams, '')) AS pic_teams_orig
      FROM
        sawitpro_datamart.datamart_ecommerce AS e
        INNER JOIN default.sale_order AS so_main ON e.sale_order_id = so_main.id
        INNER JOIN (SELECT id FROM default.user WHERE fraud_flag != 5) AS u_e ON u_e.id = e.user_id
        LEFT JOIN pic_all AS dop ON dop.invoice_no = e.invoice_no
        LEFT JOIN fallback_all AS fb ON fb.order_no = e.order_no
      WHERE
        ((e.invoice_status = 'PAID') OR (toString(e.sale_order_status) IN ('COMPLETED', '32')))
        AND e.invoice_no NOT IN (SELECT invoice_no FROM sawitpro_datamart.fct_new_sale_order_shopify)
        AND toDate(toTimeZone(e.sale_order_created_time, 'Asia/Jakarta')) >= period_start
        AND toDate(toTimeZone(e.sale_order_created_time, 'Asia/Jakarta')) < period_end
    ),
    -- ------------------------------------------------------------------
    -- (D) Himpunan invoice per versi
    -- ------------------------------------------------------------------
    ours_set AS (
      SELECT invoice_no FROM ours_dm
      UNION DISTINCT
      SELECT invoice_no FROM fct_rows
      WHERE inv_status IN ('PAID', 'PARTIAL_PAID')
        AND so_status NOT IN ('CANCELLED', 'CANCELED', 'DRAFT')
        AND ifNull(order_line_state, '') <> 'cancel'
        AND source_name NOT IN ('shopee', 'tiktok', 'tokopedia')
        AND claimed_sh
        AND item NOT IN ('Biaya Layanan', 'Minyak Goreng 1 Liter - Minyak Hemat Petani Hebat')
        AND notILike(ifNull(item, ''), '%minyak%')
    ),
    orig_set AS (
      SELECT invoice_no FROM fct_rows
      WHERE ifNull(order_line_state, '') != 'cancel'
        AND source_name NOT IN ('shopee', 'tiktok', 'tokopedia')
        AND pic_teams_orig = 'Smallholders'
        AND product_category != 'Minyak Hemat'
        AND item != 'Biaya Layanan'
      UNION DISTINCT
      SELECT invoice_no FROM orig_dm_rows
      WHERE pic_teams_orig = 'Smallholders'
        AND product_category != 'Minyak Hemat'
        AND item != 'Biaya Layanan'
    ),
    -- info bantu per invoice (dari fct dan datamart)
    info AS (
      SELECT
        invoice_no,
        arrayStringConcat(groupUniqArray(src), ';') AS sources,
        arrayStringConcat(groupUniqArray(inv_status), ';') AS invoice_statuses,
        arrayStringConcat(groupUniqArray(so_status), ';') AS sale_order_statuses,
        arrayStringConcat(groupUniqArray(ifNull(pic_teams_orig, '(none)')), ';') AS pic_teams_all,
        arrayStringConcat(groupUniqArray(ifNull(product_category, '(NULL)')), ';') AS product_categories,
        arrayStringConcat(groupUniqArray(ifNull(item, '')), ' | ') AS items
      FROM
        (
          SELECT 'fct' AS src, invoice_no, item, product_category, inv_status, so_status, pic_teams_orig FROM fct_rows
          UNION ALL
          SELECT 'datamart' AS src, invoice_no, item, product_category, inv_status, so_status, pic_teams_orig FROM orig_dm_rows
        )
      GROUP BY invoice_no
    )
SELECT
  if(ifNull(o.invoice_no, '') != '', o.invoice_no, g.invoice_no) AS invoice,
  if(ifNull(o.invoice_no, '') != '', 'ONLY_OURS', 'ONLY_ORIG') AS side,
  i.sources,
  i.invoice_statuses,
  i.sale_order_statuses,
  i.pic_teams_all,
  i.product_categories,
  i.items,
  (SELECT count() FROM ours_set) AS total_ours,
  (SELECT count() FROM orig_set) AS total_orig
FROM
  ours_set AS o
  FULL OUTER JOIN orig_set AS g ON o.invoice_no = g.invoice_no
  LEFT JOIN info AS i ON i.invoice_no = if(ifNull(o.invoice_no, '') != '', o.invoice_no, g.invoice_no)
WHERE
  ifNull(o.invoice_no, '') = '' OR ifNull(g.invoice_no, '') = ''
ORDER BY
  side,
  invoice
