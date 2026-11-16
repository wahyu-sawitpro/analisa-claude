/**
 * B2C Smallholder — Delivery SLA Failure Report + Lessons Learned (Google Apps Script)
 *
 * SLA: an order must be DELIVERED within 14 days of sale_order_date AND be fully PAID.
 * Any order that is still not delivered after 14 days counts as an SLA failure.
 *
 * Input  : the export "pending and aging more than 14 days from smallholder team customer"
 *          (columns: sale_order_date, item, customer_ref, product_category, customer_name,
 *           pic_names, full_payment_date, invoice_status, sale_order_status, sales,
 *           odoo_delivery_status, delivery_scheduled_at, Aging)
 *          Read from (first that exists):
 *            a) the newest CSV in Drive whose name contains SLA_CSV_NAME, or
 *            b) the tab SLA_RAW_SHEET in the report spreadsheet (paste/import the CSV there).
 * Output : tab "SLA Report"  — summary, root cause per order, lessons learned & actions
 *          tab "SLA History" — one row per order per run (to track repeat offenders / trend)
 *          HTML email to SLA_RECIPIENTS (skipped if the list is empty)
 *
 * All names are prefixed "sla"/"SLA_" so this file can live in the same Apps Script
 * project as Code.gs / LtvReport.gs without clashes.
 *
 * Setup:
 *  1. Create (or reuse) a Google Sheet; paste its ID into SLA_SPREADSHEET_ID
 *     (leave '' if this script is bound to that sheet).
 *  2. Fill SLA_RECIPIENTS.
 *  3. Run slaRunReport() once and approve the permissions (Sheets, Drive, Gmail).
 *  4. Run slaInstallTrigger() once (daily 08:00 WIB).
 */

const SLA_SPREADSHEET_ID = '';                // '' = the spreadsheet this script is bound to
const SLA_CSV_NAME = 'pending and aging more than 14 days';
const SLA_RAW_SHEET = 'SLA_RAW';
const SLA_REPORT_SHEET = 'SLA Report';
const SLA_HISTORY_SHEET = 'SLA History';
const SLA_RECIPIENTS = [];                    // e.g. ['ops@sawitpro.com', 'smallholder-lead@sawitpro.com']
const SLA_DAYS = 14;                          // delivery SLA in days from order date
const SLA_PAY_DAYS = 3;                       // target: full payment within N days of order
const SLA_DISPATCH_DAYS = 3;                  // target: dispatch within N days after full payment
const SLA_TZ = 'Asia/Jakarta';
const SLA_TRIGGER_HOUR = 8;

const SLA_DELIVERED = ['done', 'delivered', 'completed', 'received'];

/* ------------------------------------------------------------------ entry points */

function slaRunReport() {
  const ss = slaSpreadsheet_();
  const rows = slaReadSource_(ss);
  const today = slaToday_();
  const orders = rows.map(r => slaAnalyzeRow_(r, today)).filter(o => o && o.failed);
  orders.sort((a, b) => b.aging - a.aging);
  const lessons = slaBuildLessons_(orders);

  slaWriteReport_(ss, orders, lessons, today);
  slaAppendHistory_(ss, orders, today);
  if (SLA_RECIPIENTS.length) slaSendEmail_(orders, lessons, today, ss.getUrl());
  Logger.log(orders.length + ' order(s) failed SLA.');
}

function slaInstallTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'slaRunReport')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('slaRunReport').timeBased().everyDays(1)
    .atHour(SLA_TRIGGER_HOUR).inTimezone(SLA_TZ).create();
  Logger.log('SLA trigger installed: daily ' + SLA_TRIGGER_HOUR + ':00 WIB');
}

/* ------------------------------------------------------------------ source */

function slaSpreadsheet_() {
  return SLA_SPREADSHEET_ID ? SpreadsheetApp.openById(SLA_SPREADSHEET_ID)
                            : SpreadsheetApp.getActiveSpreadsheet();
}

function slaReadSource_(ss) {
  let values = null;
  const files = DriveApp.searchFiles(
    "title contains '" + SLA_CSV_NAME.replace(/'/g, "\\'") + "' and trashed = false");
  let newest = null;
  while (files.hasNext()) {
    const f = files.next();
    if (!/\.csv$/i.test(f.getName()) && f.getMimeType() !== 'text/csv') continue;
    if (!newest || f.getLastUpdated() > newest.getLastUpdated()) newest = f;
  }
  if (newest) {
    values = Utilities.parseCsv(newest.getBlob().getDataAsString('UTF-8'));
    Logger.log('Source: Drive CSV "' + newest.getName() + '" (' + newest.getLastUpdated() + ')');
  } else {
    const sh = ss.getSheetByName(SLA_RAW_SHEET);
    if (!sh) throw new Error('No Drive CSV matching "' + SLA_CSV_NAME +
                             '" and no tab "' + SLA_RAW_SHEET + '".');
    values = sh.getDataRange().getValues();
    Logger.log('Source: tab ' + SLA_RAW_SHEET);
  }
  return slaRowsToObjects_(values);
}

function slaRowsToObjects_(values) {
  if (!values || values.length < 2) return [];
  const head = values[0].map(h => String(h).replace(/^﻿/, '').trim().toLowerCase());
  return values.slice(1)
    .filter(r => r.some(c => String(c).trim() !== ''))
    .map(r => { const o = {}; head.forEach((h, i) => o[h] = r[i]); return o; });
}

/* ------------------------------------------------------------------ analysis (pure) */

/** Accepts Date objects, "d/m/yyyy", "d/m/yyyy, HH:MM" or "yyyy-mm-dd". Returns Date at 00:00 or null. */
function slaParseDate_(v) {
  if (v instanceof Date) return isNaN(v) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
  const s = String(v || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  return null;
}

function slaNum_(v) {
  if (typeof v === 'number') return v;
  const n = Number(String(v || '').replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function slaDays_(from, to) {
  return (from && to) ? Math.round((to - from) / 864e5) : null;
}

function slaAddDays_(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

/** Turns one raw row into an analysed order, or null if the row has no order date. */
function slaAnalyzeRow_(r, today) {
  const orderDate = slaParseDate_(r.sale_order_date);
  if (!orderDate) return null;
  const paidDate = slaParseDate_(r.full_payment_date);
  const schedDate = slaParseDate_(r.delivery_scheduled_at);
  const inv = String(r.invoice_status || '').trim().toUpperCase();
  const so = String(r.sale_order_status || '').trim().toUpperCase();
  const delivery = String(r.odoo_delivery_status || '').trim().toLowerCase();
  const delivered = SLA_DELIVERED.indexOf(delivery) >= 0;
  const aging = slaDays_(orderDate, today);
  const deadline = slaAddDays_(orderDate, SLA_DAYS);
  const isPaid = inv === 'PAID' && !!paidDate;
  const daysToPay = isPaid ? slaDays_(orderDate, paidDate) : null;
  const daysSincePaid = isPaid ? slaDays_(paidDate, today) : null;

  const o = {
    ref: String(r.customer_ref || '').trim(),
    customer: String(r.customer_name || '').trim(),
    pic: String(r.pic_names || '').trim() || '(no PIC)',
    item: String(r.item || '').trim(),
    category: String(r.product_category || '').trim(),
    sales: slaNum_(r.sales),
    orderDate, paidDate, schedDate, deadline, inv, so, delivery,
    aging, daysToPay, daysSincePaid,
    daysLate: aging - SLA_DAYS,
    failed: !delivered && aging > SLA_DAYS,
    flags: [],
  };

  // Root cause: who "owns" the breach?
  if (!isPaid) {
    o.rootCause = 'Payment not complete';
    o.owner = 'Sales PIC (collection)';
  } else if (daysToPay > SLA_DAYS) {
    o.rootCause = 'Late payment — paid after SLA deadline';
    o.owner = 'Sales PIC (collection)';
  } else if (daysToPay > SLA_PAY_DAYS) {
    o.rootCause = 'Slow payment + fulfilment delay';
    o.owner = 'Sales PIC + Ops / Logistics';
  } else {
    o.rootCause = 'Fulfilment delay — paid on time, not shipped';
    o.owner = 'Ops / Logistics';
  }

  // Process flags (the "why" behind the root cause)
  if (isPaid && daysSincePaid > SLA_DISPATCH_DAYS)
    o.flags.push('Paid ' + daysSincePaid + 'd ago, still not dispatched');
  if (isPaid && so === 'NEW')
    o.flags.push('SO still NEW after full payment (not confirmed in Odoo)');
  if (schedDate && paidDate && schedDate < paidDate)
    o.flags.push('Delivery scheduled before payment was complete');
  if (schedDate && schedDate > deadline)
    o.flags.push('Delivery scheduled after the SLA deadline');
  if (schedDate && schedDate.getTime() === deadline.getTime())
    o.flags.push('Delivery scheduled on day ' + SLA_DAYS + ' — zero buffer');
  if (schedDate && schedDate < today && !delivered)
    o.flags.push('Missed scheduled date by ' + slaDays_(schedDate, today) + 'd');
  if (!schedDate) o.flags.push('No delivery schedule set');
  if (o.daysLate >= SLA_DAYS) o.flags.push('Critical: late ≥ ' + SLA_DAYS + 'd beyond SLA');
  return o;
}

/** Rule-based lessons learned + actions, derived from the failed orders. */
function slaBuildLessons_(orders) {
  const L = [];
  if (!orders.length) return L;
  const n = orders.length;
  const cnt = re => orders.filter(o => o.flags.some(f => re.test(f))).length;
  const cntRc = re => orders.filter(o => re.test(o.rootCause)).length;
  const refs = f => orders.filter(f).map(o => o.ref).join(', ');

  const ops = cntRc(/^Fulfilment/);
  if (ops) L.push({
    lesson: ops + '/' + n + ' order(s) were fully paid on time but never shipped — the breach is internal (Ops), not the customer.',
    action: 'Ops dashboard: any PAID order not dispatched within ' + SLA_DISPATCH_DAYS +
            ' days auto-escalates to Ops lead. Refs: ' + refs(o => /^Fulfilment/.test(o.rootCause)) });

  const late = cntRc(/payment/i);
  if (late) L.push({
    lesson: late + '/' + n + ' order(s) breached because full payment arrived late — the SLA clock ran out on collection.',
    action: 'PIC reminders on D+1 / D+3 / D+7 after order; orders unpaid at D+7 are re-dated or cancelled so they do not sit in the queue. Refs: ' +
            refs(o => /payment/i.test(o.rootCause)) });

  const sNew = cnt(/SO still NEW/);
  if (sNew) L.push({
    lesson: sNew + '/' + n + ' order(s) are PAID but the Sale Order is still NEW — payment did not trigger SO confirmation, so the warehouse never received a picking task.',
    action: 'Auto-confirm SO when invoice becomes PAID (Odoo automation) or a daily check "PAID & SO=NEW" sent to Ops.' });

  const before = cnt(/scheduled before payment/);
  if (before) L.push({
    lesson: before + '/' + n + ' delivery schedule(s) were set before payment was complete — the slot expired and was never re-planned.',
    action: 'Only schedule delivery after PAID; when payment lands, re-schedule within ' + SLA_DISPATCH_DAYS + ' days.' });

  const edge = cnt(/zero buffer|after the SLA deadline/);
  if (edge) L.push({
    lesson: edge + '/' + n + ' order(s) were scheduled on or after day ' + SLA_DAYS + ' — any slip guarantees a breach.',
    action: 'Planning rule: schedule delivery ≤ day 7–10 after order to keep a buffer.' });

  const missed = cnt(/Missed scheduled date/);
  if (missed) L.push({
    lesson: missed + '/' + n + ' order(s) passed their scheduled date with no update — nobody owned the miss.',
    action: 'When the scheduled date passes without delivery, Ops must log a reason + new date within 24h.' });

  const crit = cnt(/Critical/);
  if (crit) L.push({
    lesson: crit + '/' + n + ' order(s) are ≥ ' + SLA_DAYS + ' days beyond SLA (aging ≥ ' + 2 * SLA_DAYS + 'd) — high risk of refund / churn.',
    action: 'PIC calls the customer this week with a firm date; consider goodwill (free shipping / voucher) for repeat buyers.' });

  const byPic = {};
  orders.forEach(o => byPic[o.pic] = (byPic[o.pic] || 0) + 1);
  L.push({
    lesson: 'Breaches by PIC: ' + Object.keys(byPic).map(p => p + ' (' + byPic[p] + ')').join(', ') + '.',
    action: 'Review in weekly Smallholder sync; PIC must update the customer on every pending order > 7 days.' });
  return L;
}

/* ------------------------------------------------------------------ output */

function slaFmtDate_(d) { return d ? Utilities.formatDate(d, SLA_TZ, 'dd MMM yyyy') : '-'; }
function slaFmtIdr_(n) { return 'Rp ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function slaToday_() {
  const s = Utilities.formatDate(new Date(), SLA_TZ, 'yyyy-MM-dd');
  return slaParseDate_(s);
}

function slaSummary_(orders) {
  const total = orders.reduce((s, o) => s + o.sales, 0);
  const avg = orders.length ? orders.reduce((s, o) => s + o.aging, 0) / orders.length : 0;
  const byRc = {};
  orders.forEach(o => byRc[o.rootCause] = (byRc[o.rootCause] || 0) + 1);
  return { count: orders.length, total, avg, max: orders.length ? orders[0].aging : 0, byRc };
}

function slaWriteReport_(ss, orders, lessons, today) {
  const sh = ss.getSheetByName(SLA_REPORT_SHEET) || ss.insertSheet(SLA_REPORT_SHEET);
  sh.clear();
  const s = slaSummary_(orders);
  let r = 1;
  sh.getRange(r, 1).setValue('B2C Smallholder — Delivery SLA Failure Report (SLA ' + SLA_DAYS + ' days, fully paid)')
    .setFontWeight('bold').setFontSize(14);
  r++;
  sh.getRange(r, 1).setValue('Generated ' + slaFmtDate_(today)); r += 2;

  const kpi = [
    ['Orders failing SLA', s.count],
    ['Sales value at risk', slaFmtIdr_(s.total)],
    ['Average aging (days)', s.avg.toFixed(1)],
    ['Oldest order aging (days)', s.max],
  ].concat(Object.keys(s.byRc).map(k => ['Root cause: ' + k, s.byRc[k]]));
  sh.getRange(r, 1, kpi.length, 2).setValues(kpi);
  sh.getRange(r, 1, kpi.length, 1).setFontWeight('bold');
  r += kpi.length + 1;

  const head = ['Order ref', 'Customer', 'PIC', 'Item', 'Sales (IDR)', 'Order date', 'SLA deadline',
                'Full payment', 'Days to pay', 'Scheduled', 'Aging (d)', 'Days late', 'SO status',
                'Delivery status', 'Root cause', 'Owner', 'Flags'];
  sh.getRange(r, 1, 1, head.length).setValues([head]).setFontWeight('bold')
    .setBackground('#1f4e3d').setFontColor('#ffffff');
  r++;
  if (orders.length) {
    const body = orders.map(o => [o.ref, o.customer, o.pic, o.item, o.sales, slaFmtDate_(o.orderDate),
      slaFmtDate_(o.deadline), slaFmtDate_(o.paidDate), o.daysToPay == null ? '-' : o.daysToPay,
      slaFmtDate_(o.schedDate), o.aging, o.daysLate, o.so, o.delivery, o.rootCause, o.owner,
      o.flags.join('\n')]);
    sh.getRange(r, 1, body.length, head.length).setValues(body).setVerticalAlignment('top');
    sh.getRange(r, 5, body.length, 1).setNumberFormat('#,##0');
    sh.getRange(r, 17, body.length, 1).setWrap(true);
    r += body.length;
  } else {
    sh.getRange(r, 1).setValue('No order is breaching the SLA. 🎉'); r++;
  }
  r++;

  sh.getRange(r, 1).setValue('Lessons learned & actions').setFontWeight('bold').setFontSize(12); r++;
  if (lessons.length) {
    sh.getRange(r, 1, 1, 3).setValues([['#', 'Lesson learned', 'Action / owner']])
      .setFontWeight('bold').setBackground('#e8f0ec');
    r++;
    sh.getRange(r, 1, lessons.length, 3)
      .setValues(lessons.map((l, i) => [i + 1, l.lesson, l.action])).setWrap(true).setVerticalAlignment('top');
  }
  sh.setColumnWidth(2, 380); sh.setColumnWidth(3, 380); sh.setColumnWidth(17, 320);
  sh.setFrozenRows(0);
}

function slaAppendHistory_(ss, orders, today) {
  let sh = ss.getSheetByName(SLA_HISTORY_SHEET);
  if (!sh) {
    sh = ss.insertSheet(SLA_HISTORY_SHEET);
    sh.appendRow(['run_date', 'customer_ref', 'customer', 'pic', 'sales', 'aging', 'days_late',
                  'root_cause', 'flags']);
    sh.getRange(1, 1, 1, 9).setFontWeight('bold');
  }
  const runDate = slaFmtDate_(today);
  const last = sh.getLastRow();
  if (last > 1 && sh.getRange(2, 1, last - 1, 1).getDisplayValues().some(v => v[0] === runDate)) return;
  if (!orders.length) return;
  sh.getRange(last + 1, 1, orders.length, 9).setValues(orders.map(o =>
    [runDate, o.ref, o.customer, o.pic, o.sales, o.aging, o.daysLate, o.rootCause, o.flags.join('; ')]));
}

function slaHtml_(orders, lessons, today, url) {
  const s = slaSummary_(orders);
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const td = 'style="border:1px solid #ccc;padding:6px;vertical-align:top"';
  let h = '<div style="font-family:Arial,sans-serif;font-size:13px">' +
    '<h2 style="color:#1f4e3d">B2C Smallholder — Delivery SLA Failures (' + slaFmtDate_(today) + ')</h2>' +
    '<p>SLA: delivered within ' + SLA_DAYS + ' days of order and fully paid.</p>' +
    '<p><b>' + s.count + '</b> order(s) failing SLA · <b>' + slaFmtIdr_(s.total) +
    '</b> at risk · avg aging <b>' + s.avg.toFixed(1) + 'd</b> · oldest <b>' + s.max + 'd</b></p>';
  if (orders.length) {
    h += '<table style="border-collapse:collapse"><tr style="background:#1f4e3d;color:#fff">' +
      ['Order', 'Customer', 'PIC', 'Item', 'Sales', 'Aging', 'Root cause', 'Flags']
        .map(x => '<th ' + td + '>' + x + '</th>').join('') + '</tr>';
    orders.forEach(o => {
      h += '<tr>' + [o.ref, o.customer, o.pic, o.item, slaFmtIdr_(o.sales),
        o.aging + 'd (+' + o.daysLate + ')', o.rootCause, o.flags.map(esc).join('<br>')]
        .map((x, i) => '<td ' + td + '>' + (i === 7 ? x : esc(x)) + '</td>').join('') + '</tr>';
    });
    h += '</table>';
  }
  if (lessons.length) {
    h += '<h3>Lessons learned & actions</h3><ol>' + lessons.map(l =>
      '<li><b>' + esc(l.lesson) + '</b><br>→ ' + esc(l.action) + '</li>').join('') + '</ol>';
  }
  return h + '<p><a href="' + url + '">Open full report</a></p></div>';
}

function slaSendEmail_(orders, lessons, today, url) {
  MailApp.sendEmail({
    to: SLA_RECIPIENTS.join(','),
    subject: '[SLA] ' + orders.length + ' B2C Smallholder order(s) > ' + SLA_DAYS +
             ' days undelivered — ' + slaFmtDate_(today),
    htmlBody: slaHtml_(orders, lessons, today, url),
  });
}
