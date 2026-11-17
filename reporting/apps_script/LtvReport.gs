/**
 * Customer LTV & KebunPRO Cross-sell Report — pull from GitHub into Google Drive.
 *
 * Runs in its OWN Apps Script project (separate from the AM and SLA projects).
 *
 * Every Monday GitHub Actions builds the artifact "ltv-report" (ltv_report.pptx +
 * ltv_report.xlsx). GitHub often starts scheduled runs hours late, so this script does
 * NOT wait for a fixed time: it checks every hour and, as soon as a NEW artifact exists:
 *
 *   1. STACKED DECK (Google Slides, link never changes):
 *      the new week's slides are inserted at the TOP, behind a divider slide
 *      "LTV Report — Week of <Monday>". Earlier weeks move down and are NOT rebuilt.
 *      Only the last LTV_KEEP_WEEKS weeks are kept; older weeks are deleted from the deck
 *      (they remain visible in the deck's Version history).
 *   2. Latest .pptx (original PowerPoint formatting) — overwrites a fixed Drive file.
 *   3. Latest .xlsx (full customer lists)            — overwrites a fixed Drive file.
 *
 * When there is nothing new it just logs and exits (no error, no email).
 *
 * SAME DATA AS LAST WEEK: the artifact carries ltv_data_hash.txt (fingerprint of the input
 * CSVs + report code). If it equals the fingerprint of the newest week already in the deck,
 * no slides are copied: only that week's divider title is renamed to the new week
 * ("Week of 23 Nov 2026 — data unchanged since 16 Nov 2026") and its slides are kept, so at
 * least the last deck always stays. The fixed .pptx / .xlsx files are left as they are.
 *
 * Every slide the script inserts carries a tag "[ltv-week:YYYY-MM-DD]" in its speaker
 * notes; that tag is how a week is found again (to replace or delete it). Don't remove it.
 *
 * Setup:
 *  1. Services (+) -> "Drive API".
 *  2. Project Settings -> Script Properties -> GITHUB_TOKEN.
 *  3. Run ltvSetup() once and approve the permissions (Drive, Slides, external requests).
 *     It checks Drive + GitHub and creates the stacked Google Slides deck (next to the
 *     .pptx file) the first time; its link is printed in the log.
 *  4. Run ltvForceUpdate() once to fill the deck with the current week (it re-processes the
 *     latest artifact even if it was already copied to Drive before).
 *  5. Run ltvInstallTrigger() once (hourly check).
 */

const LTV_REPO = 'wahyu-sawitpro/analisa-claude';
const LTV_ARTIFACT_NAME = 'ltv-report';
const LTV_PPTX_FILE_ID = '1VIO1pjQJQkd5TIwwJKV2v7YIk7OSTbQc';   // latest week, PowerPoint
const LTV_XLSX_FILE_ID = '1qlsD9_NgZxtcZwUsYRtrnREUGWx7U6wx';   // latest week, Excel
const LTV_STACK_DECK_ID = '';   // optional: an existing Google Slides file ID; empty = ltvSetup() creates one
const LTV_STACK_DECK_NAME = 'LTV Report Smallholder — Weekly (last 8 weeks)';
const LTV_KEEP_WEEKS = 8;       // weeks kept in the stacked deck
const LTV_STALE_DAYS = 8;       // newest artifact older than this = the weekly workflow did not run
const LTV_LAST_ID_PROP = 'LAST_ARTIFACT_ID_LTV';
const LTV_DECK_PROP = 'LTV_STACK_DECK_ID';
const LTV_HASH_PROP = 'LTV_LAST_DATA_HASH';   // fingerprint of the newest week in the deck
const LTV_TZ = 'Asia/Jakarta';
const LTV_TAG_RE = /\[ltv-week:(\d{4}-\d{2}-\d{2})\]/;

const LTV_PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const LTV_XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// ------------------------------------------------------------------ setup & trigger
function ltvSetup() {
  const token = ltvToken_();
  [LTV_PPTX_FILE_ID, LTV_XLSX_FILE_ID].forEach(id => {
    const f = Drive.Files.get(id, { supportsAllDrives: true, fields: 'id,name,webViewLink' });
    Logger.log('Drive OK: ' + f.name + ' ' + f.webViewLink);
  });
  const deck = SlidesApp.openById(ltvDeckId_());
  Logger.log('Stacked deck OK: ' + deck.getName() + ' ' + deck.getUrl() +
             ' (' + ltvWeeksInDeck_(deck).length + ' week(s) inside)');
  const a = ltvLatestArtifact_(token);
  Logger.log(a ? 'GitHub OK: latest artifact ' + a.id + ' created ' + a.created_at
               : 'GitHub OK, but no artifact yet (run the LTV workflow once from the Actions tab).');
}

function ltvInstallTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'ltvPullLatestReport')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('ltvPullLatestReport')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log('LTV trigger installed: checks GitHub every hour, updates Drive only when a new report exists');
}

// ------------------------------------------------------------------ main
function ltvPullLatestReport() {
  const props = PropertiesService.getScriptProperties();
  const token = ltvToken_();
  const a = ltvLatestArtifact_(token);
  if (!a) throw new Error('No artifact "' + LTV_ARTIFACT_NAME + '" found.');

  if (props.getProperty(LTV_LAST_ID_PROP) === String(a.id)) {
    const ageD = (Date.now() - new Date(a.created_at).getTime()) / 864e5;
    // Raise ONE error (Google emails it) if no new weekly report has appeared for too long.
    if (ageD > LTV_STALE_DAYS && props.getProperty('LTV_STALE_WARNED') !== String(a.id)) {
      props.setProperty('LTV_STALE_WARNED', String(a.id));
      throw new Error('No new LTV report for ' + ageD.toFixed(0) + ' days — check the Actions tab ' +
                      '(workflow failed, or the CSV was not uploaded).');
    }
    Logger.log('No new LTV report yet (latest ' + a.id + ' from ' + a.created_at + ' is already in Drive).');
    return;
  }

  const blobs = Utilities.unzip(ltvDownload_(token, a));
  const pptx = blobs.find(x => x.getName().toLowerCase().endsWith('.pptx'));
  const xlsx = blobs.find(x => x.getName().toLowerCase().endsWith('.xlsx'));
  const hashBlob = blobs.find(x => x.getName().toLowerCase().endsWith('ltv_data_hash.txt'));
  if (!pptx || !xlsx) throw new Error('Artifact ' + a.id + ' must contain one .pptx and one .xlsx');
  const hash = hashBlob ? hashBlob.getDataAsString().trim() : '';
  const week = ltvWeekOf_(a.created_at);

  // 0. same data as the newest week in the deck -> only rename that week, keep its slides
  if (hash && hash === props.getProperty(LTV_HASH_PROP) && ltvRetitleNewestWeek_(week)) {
    props.setProperty(LTV_LAST_ID_PROP, String(a.id));
    return;
  }

  // 1. stacked deck (newest week on top, keep LTV_KEEP_WEEKS)
  ltvStackWeek_(pptx.copyBlob(), week);
  if (hash) props.setProperty(LTV_HASH_PROP, hash); else props.deleteProperty(LTV_HASH_PROP);

  // 2 + 3. fixed "latest" files
  [[LTV_PPTX_FILE_ID, pptx, LTV_PPTX_MIME], [LTV_XLSX_FILE_ID, xlsx, LTV_XLSX_MIME]].forEach(([id, blob, mime]) => {
    const updated = Drive.Files.update(
      { description: 'Customer LTV & KebunPRO Report — auto-updated ' + new Date().toISOString() },
      id, blob.setContentType(mime), { supportsAllDrives: true, fields: 'id,name,modifiedTime' });
    Logger.log('Updated ' + updated.name + ' at ' + updated.modifiedTime + ' from artifact ' + a.id);
  });
  props.setProperty(LTV_LAST_ID_PROP, String(a.id));
}

/** Re-process the latest artifact even if it was already uploaded (first fill / repair).
 *  Always does a full insert of the week's slides (ignores the "data unchanged" shortcut). */
function ltvForceUpdate() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty(LTV_LAST_ID_PROP);
  props.deleteProperty(LTV_HASH_PROP);
  ltvPullLatestReport();
}

// ------------------------------------------------------------------ stacked deck
/** Insert this week's slides at the top of the stacked deck, then drop weeks beyond LTV_KEEP_WEEKS. */
function ltvStackWeek_(pptxBlob, week) {
  const deck = SlidesApp.openById(ltvDeckId_());
  const tag = '[ltv-week:' + week.key + ']';

  // same week again (e.g. workflow re-run) -> replace that week instead of adding a duplicate
  ltvDeleteWeeks_(deck, [week.key]);
  // a brand-new deck starts with one empty untagged slide -> remove it afterwards
  const placeholders = deck.getSlides().filter(s => !ltvTagOf_(s) && s.getPageElements().length === 0);

  // convert the .pptx into a temporary Google Slides file to copy slides from
  const parent = Drive.Files.get(ltvDeckId_(), { supportsAllDrives: true, fields: 'parents' }).parents;
  const tmp = Drive.Files.create(
    { name: 'tmp LTV import ' + week.key, mimeType: 'application/vnd.google-apps.presentation', parents: parent },
    pptxBlob.setContentType(LTV_PPTX_MIME), { supportsAllDrives: true, fields: 'id' });
  try {
    const src = SlidesApp.openById(tmp.id).getSlides();

    // divider slide at the very top
    const divider = deck.insertSlide(0, SlidesApp.PredefinedLayout.BLANK);
    const W = deck.getPageWidth(), H = deck.getPageHeight();
    divider.getBackground().setSolidFill('#007200');
    const t = divider.insertTextBox('LTV Report — Week of ' + week.label, W * 0.08, H * 0.36, W * 0.84, H * 0.16);
    t.getText().getTextStyle().setFontSize(32).setBold(true).setForegroundColor('#FFFFFF');
    const st = divider.insertTextBox('Generated ' + Utilities.formatDate(new Date(), LTV_TZ, 'd MMM yyyy HH:mm') +
                                     ' WIB  •  newest week on top, last ' + LTV_KEEP_WEEKS + ' weeks kept',
                                     W * 0.08, H * 0.54, W * 0.84, H * 0.08);
    st.getText().getTextStyle().setFontSize(14).setForegroundColor('#FCD102');
    ltvSetTag_(divider, tag);

    // copy the week's slides right under the divider, in order
    src.forEach((s, i) => ltvSetTag_(deck.insertSlide(1 + i, s), tag));
  } finally {
    Drive.Files.update({ trashed: true }, tmp.id, null, { supportsAllDrives: true });
  }
  placeholders.forEach(s => s.remove());
  PropertiesService.getScriptProperties().setProperty('LTV_DATA_SINCE', week.label);

  // retention: keep only the newest LTV_KEEP_WEEKS weeks
  const weeks = ltvWeeksInDeck_(deck);
  const drop = weeks.slice(LTV_KEEP_WEEKS);
  if (drop.length) ltvDeleteWeeks_(deck, drop);
  Logger.log('Stacked deck: added week of ' + week.label + '; weeks kept: ' +
             weeks.slice(0, LTV_KEEP_WEEKS).join(', ') + (drop.length ? '; deleted: ' + drop.join(', ') : ''));
}

/** Data unchanged: rename the newest week in the deck to `week` and keep its slides.
 *  Returns false when there is nothing to rename (empty deck) so the caller does a full insert. */
function ltvRetitleNewestWeek_(week) {
  const deck = SlidesApp.openById(ltvDeckId_());
  const weeks = ltvWeeksInDeck_(deck);
  if (!weeks.length) return false;
  const oldKey = weeks[0];
  if (oldKey === week.key) {
    Logger.log('Data unchanged and week of ' + week.label + ' is already on top — nothing to do.');
    return true;
  }
  const slides = deck.getSlides().filter(s => ltvTagOf_(s) === oldKey);
  // first slide of the week is the divider: replace its title and subtitle
  const boxes = slides[0].getShapes().filter(sh => sh.getShapeType() === SlidesApp.ShapeType.TEXT_BOX);
  const firstLabel = (PropertiesService.getScriptProperties().getProperty('LTV_DATA_SINCE') || ltvLabelOf_(oldKey));
  if (boxes[0]) boxes[0].getText().setText('LTV Report — Week of ' + week.label);
  if (boxes[1]) boxes[1].getText().setText('Data unchanged since the week of ' + firstLabel +
                                           ' — slides kept, only the title was updated (' +
                                           Utilities.formatDate(new Date(), LTV_TZ, 'd MMM yyyy HH:mm') + ' WIB)');
  const tag = '[ltv-week:' + week.key + ']';
  slides.forEach(s => ltvSetTag_(s, tag));
  PropertiesService.getScriptProperties().setProperty('LTV_DATA_SINCE', firstLabel);
  Logger.log('Data unchanged since week of ' + firstLabel + ': renamed week ' + oldKey + ' -> ' + week.key +
             ' (' + slides.length + ' slides kept, nothing copied).');
  return true;
}

function ltvLabelOf_(key) {
  const p = key.split('-').map(Number);
  return Utilities.formatDate(new Date(Date.UTC(p[0], p[1] - 1, p[2], 5)), LTV_TZ, 'd MMM yyyy');
}

/** Week keys present in the deck, newest first. */
function ltvWeeksInDeck_(deck) {
  const keys = {};
  deck.getSlides().forEach(s => { const k = ltvTagOf_(s); if (k) keys[k] = true; });
  return Object.keys(keys).sort().reverse();
}

function ltvDeleteWeeks_(deck, keys) {
  deck.getSlides().forEach(s => { if (keys.indexOf(ltvTagOf_(s)) >= 0) s.remove(); });
}

function ltvTagOf_(slide) {
  const m = slide.getNotesPage().getSpeakerNotesShape().getText().asString().match(LTV_TAG_RE);
  return m ? m[1] : '';
}

function ltvSetTag_(slide, tag) {
  const txt = slide.getNotesPage().getSpeakerNotesShape().getText();
  const cur = txt.asString().replace(LTV_TAG_RE, '').trim();
  txt.setText(cur ? cur + '\n' + tag : tag);
}

/** Monday of the report week (WIB) — the workflow runs on Monday but GitHub may start it on Tuesday. */
function ltvWeekOf_(createdAt) {
  const d = new Date(createdAt);
  const dow = Number(Utilities.formatDate(d, LTV_TZ, 'u'));          // 1 = Monday … 7 = Sunday
  const monday = new Date(d.getTime() - (dow - 1) * 864e5);
  return { key: Utilities.formatDate(monday, LTV_TZ, 'yyyy-MM-dd'),
           label: Utilities.formatDate(monday, LTV_TZ, 'd MMM yyyy') };
}

/** Stacked deck ID: constant if set, else Script Property, else create a new Google Slides file. */
function ltvDeckId_() {
  if (LTV_STACK_DECK_ID) return LTV_STACK_DECK_ID;
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(LTV_DECK_PROP);
  if (id) return id;
  const parents = Drive.Files.get(LTV_PPTX_FILE_ID, { supportsAllDrives: true, fields: 'parents' }).parents;
  const f = Drive.Files.create({ name: LTV_STACK_DECK_NAME, mimeType: 'application/vnd.google-apps.presentation',
                                 parents: parents }, null, { supportsAllDrives: true, fields: 'id,webViewLink' });
  props.setProperty(LTV_DECK_PROP, f.id);
  Logger.log('Created stacked deck: ' + f.webViewLink);
  return f.id;
}

// ------------------------------------------------------------------ GitHub
function ltvDownload_(token, a) {
  // GitHub answers with a 302 to a pre-signed storage URL; that URL must be
  // fetched WITHOUT the GitHub token (the storage server rejects it).
  const redirect = UrlFetchApp.fetch(a.archive_download_url, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
    followRedirects: false,
    muteHttpExceptions: true,
  });
  const headers = redirect.getAllHeaders();
  const location = headers.Location || headers.location;
  if (!location) {
    throw new Error('Download link not returned (HTTP ' + redirect.getResponseCode() + '): ' +
                    redirect.getContentText().slice(0, 300));
  }
  return UrlFetchApp.fetch(location, { followRedirects: true }).getBlob().setContentType('application/zip');
}

function ltvLatestArtifact_(token) {
  const res = UrlFetchApp.fetch(
    'https://api.github.com/repos/' + LTV_REPO + '/actions/artifacts?per_page=20&name=' + LTV_ARTIFACT_NAME,
    { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }, muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) {
    throw new Error('GitHub API ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  }
  const list = JSON.parse(res.getContentText()).artifacts.filter(x => !x.expired);
  list.sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
  return list[0] || null;
}

function ltvToken_() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Add Script Property GITHUB_TOKEN first.');
  return token;
}
