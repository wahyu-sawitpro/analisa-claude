-- =====================================================================
-- List farmer per tahapan funnel onboarding PetaniApp (1 baris per farmer).
-- Turunan dari petaniapp_farmer_onboarding_funnel.sql (filter & catatan di
-- file itu tetap berlaku); bedanya di sini ditampilkan per user.
-- Kolom tahapan (Yes/No) = status masing-masing tahap apa adanya, TIDAK
-- kumulatif, supaya kelihatan misalnya sudah KYC tapi belum geotag.
-- Kolom tahap_terakhir_funnel = tahap terjauh secara kumulatif; jumlah user
-- per nilai kolom ini konsisten dengan angka di query funnel.
-- order_no = nomor setelah '#' di page_title halaman pesanan
--   ('Pesanan #B2C26328 – Toko Sawit untuk Petani' -> 'B2C26328');
--   kalau lebih dari 1 order di periode, digabung dengan koma.
-- total_order / total_sales = jumlah order & sum(potential_gmvs) dari
--   Customer 360 (question #2992), join by order_no = customer_ref tanpa '#'.
--   Hanya order valid (bukan Marketplace / cancel / draft, kategori
--   'Khusus Petani', sejak 2026-01-01) yang dihitung.
-- {{time_range}} = field filter Metabase ke sawitpro_datamart.dim_date.date_series.
-- TANPA pembungkus `SELECT ... FROM (...) AS source` (gagal di ClickHouse 24.4).
-- =====================================================================
WITH
    data_farm AS (
        SELECT
            f.owner_id,
            ceil(sum(f.area_hectare)) AS total_area_hectare,
            max(
                concat(toString(f.farm_lat), ', ', toString(f.farm_long)) NOT IN ('', ', ', '0, 0', '0.0, 0.0')
            ) AS has_geotag
        FROM sawitpro_datamart.dim_farm f
        WHERE f.is_active = TRUE
        GROUP BY f.owner_id
    ),

    user_kyc AS (
        SELECT DISTINCT
            user_id,
            1 AS is_kyc_verified
        FROM user_kyc_documents
        WHERE user_id IS NOT NULL
          AND user_id != ''
          AND status = 'VERIFIED'
    ),

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

    -- user yang buka halaman keranjang di periode terpilih
    -- contoh page_title: 'Keranjang Belanja – Toko Sawit untuk Petani'
    keranjang_user AS (
        SELECT DISTINCT
            fe.user_id,
            1 AS is_keranjang
        FROM default.flatten_eventapp_raw fe
        INNER JOIN sawitpro_datamart.dim_date dd ON dd.date_series = toDate(fe.event_time)
        WHERE fe.app_type = 'sawitproretail'
          AND fe.user_id IS NOT NULL
          AND fe.user_id <> 'Guest'
          AND fe.page_title ILIKE '%keranjang%'
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
    du.id AS user_id,
    du.name AS name,
    du.phone_no AS phone_no,
    'Yes' AS buka_home,
    if(df.total_area_hectare > 0, 'Yes', 'No') AS input_kebun,
    if(df.has_geotag = 1, 'Yes', 'No') AS input_geotag,
    if(uk.is_kyc_verified = 1, 'Yes', 'No') AS kyc_verified,
    if(ku.is_keranjang = 1, 'Yes', 'No') AS keranjang,
    if(cu.is_checkout = 1, 'Yes', 'No') AS checkout,
    cu.order_no AS order_no,
    cu.total_order AS total_order,
    cu.total_sales AS total_sales,
    multiIf(
        df.total_area_hectare > 0 AND df.has_geotag = 1 AND uk.is_kyc_verified = 1
            AND ku.is_keranjang = 1 AND cu.is_checkout = 1, '6. Checkout',
        df.total_area_hectare > 0 AND df.has_geotag = 1 AND uk.is_kyc_verified = 1
            AND ku.is_keranjang = 1, '5. Keranjang',
        df.total_area_hectare > 0 AND df.has_geotag = 1 AND uk.is_kyc_verified = 1, '4. KYC Verified',
        df.total_area_hectare > 0 AND df.has_geotag = 1, '3. Input Geotag',
        df.total_area_hectare > 0, '2. Input Kebun',
        '1. Buka Home'
    ) AS tahap_terakhir_funnel
FROM data_user du
INNER JOIN home_user hu
    ON du.id = hu.user_id
LEFT JOIN data_farm df
    ON du.id = df.owner_id
LEFT JOIN user_kyc uk
    ON du.id = uk.user_id
LEFT JOIN keranjang_user ku
    ON du.id = ku.user_id
LEFT JOIN checkout_user cu
    ON du.id = cu.user_id
ORDER BY tahap_terakhir_funnel DESC, du.name
