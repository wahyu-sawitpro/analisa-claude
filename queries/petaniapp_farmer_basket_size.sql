-- =====================================================================
-- Avg basket size farmer PetaniApp (1 baris agregat).
-- Turunan dari petaniapp_farmer_onboarding_funnel_list.sql: CTE yang dipakai
-- sama persis, bedanya hasil akhir diagregasi.
-- Populasi = farmer REGISTERED yang buka home di {{time_range}} DAN punya
-- order valid di Customer 360 (total_order > 0).
-- avg_basket_size = total sales / total order (rata-rata nilai per order,
--   bukan rata-rata dari rata-rata per user).
-- {{time_range}} = field filter Metabase ke sawitpro_datamart.dim_date.date_series.
-- TANPA pembungkus `SELECT ... FROM (...) AS source` (gagal di ClickHouse 24.4).
-- =====================================================================
WITH
    data_user AS (
        SELECT id, name, phone_no
        FROM sawitpro_datamart.datamart_user
        WHERE status = 'REGISTERED'
          AND user_role ILIKE '%farmer%'
    ),

    -- user yang buka home PetaniApp di periode terpilih (1 baris per user)
    home_user AS (
        SELECT DISTINCT fe.user_id
        FROM default.flatten_eventapp_raw fe
        INNER JOIN sawitpro_datamart.dim_date dd ON dd.date_series = toDate(fe.event_time)
        WHERE fe.app_type = 'petaniapp'
          AND fe.user_id IS NOT NULL
          AND fe.user_id <> 'Guest'
          AND fe.event_name IN ('home_open', 'home_success')
          AND {{time_range}}
    ),

    -- order yang dibuka user di halaman detail pesanan (checkout) di periode
    -- terpilih, 1 baris per (user, order)
    -- contoh page_title: 'Pesanan #B2C26328 – Toko Sawit untuk Petani' -> 'B2C26328'
    checkout_order AS (
        SELECT DISTINCT
            fe.user_id,
            regexpExtract(fe.page_title, '#([A-Za-z0-9]+)', 1) AS order_no
        FROM default.flatten_eventapp_raw fe
        INNER JOIN sawitpro_datamart.dim_date dd ON dd.date_series = toDate(fe.event_time)
        WHERE fe.app_type = 'sawitproretail'
          AND fe.user_id IS NOT NULL
          AND fe.user_id <> 'Guest'
          AND fe.page_title ILIKE '%pesanan #%'
          AND {{time_range}}
    ),

    -- sales per order dari Customer 360 (customer_ref '#B2C25172' -> 'B2C25172'),
    -- 1 baris per order
    sales_order AS (
        SELECT
            upper(replaceAll(trimBoth(c360.customer_ref), '#', '')) AS order_no,
            sum(ifNull(c360.potential_gmvs, 0)) AS sales
        FROM {{#2992-customer-360}} AS c360
        WHERE c360.dates >= '2026-01-01'
          AND c360.Sales_App != 'Marketplace'
          AND ifNull(c360.order_line_state, '') != 'cancel'
          AND c360.product_category = 'Khusus Petani'
          AND c360.sale_order_status NOT IN ('CANCELLED', 'CANCELED', 'DRAFT')
          AND ifNull(c360.customer_ref, '') != ''
        GROUP BY order_no
    ),

    -- 1 baris per user yang checkout: daftar order + total order & sales
    -- (total_order / total_sales hanya dari order yang ada di sales_order)
    checkout_user AS (
        SELECT
            co.user_id,
            1 AS is_checkout,
            arrayStringConcat(arrayFilter(x -> x != '', groupUniqArray(co.order_no)), ', ') AS order_no,
            uniqExactIf(co.order_no, so.order_no != '') AS total_order,
            sum(so.sales) AS total_sales
        FROM checkout_order co
        LEFT JOIN sales_order so
            ON upper(co.order_no) = so.order_no
        GROUP BY co.user_id
    )

SELECT
    uniqExact(du.id) AS total_user_order,
    sum(cu.total_order) AS total_order,
    sum(cu.total_sales) AS total_sales,
    round(sum(cu.total_sales) / nullIf(sum(cu.total_order), 0), 0) AS avg_basket_size,
    round(sum(cu.total_order) / nullIf(uniqExact(du.id), 0), 2) AS avg_order_per_user,
    round(sum(cu.total_sales) / nullIf(uniqExact(du.id), 0), 0) AS avg_sales_per_user
FROM data_user du
INNER JOIN home_user hu      ON du.id = hu.user_id
INNER JOIN checkout_user cu  ON du.id = cu.user_id
WHERE cu.total_order > 0
