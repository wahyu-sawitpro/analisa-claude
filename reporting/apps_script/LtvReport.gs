/**
 * Customer LTV & KebunPRO Cross-sell Report — pull from GitHub, overwrite fixed Drive files.
 *
 * Runs in its OWN Apps Script project (separate from the AM and SLA projects).
 *
 * Every Monday GitHub Actions builds the artifact "ltv-report" (ltv_report.pptx +
 * ltv_report.xlsx). GitHub often starts scheduled runs hours late (e.g. 02:00 WIB on
 * Tuesday instead of 16:00 WIB on Monday), so this script does NOT wait for a fixed time:
 * it checks every hour and, as soon as a NEW artifact exists, overwrites TWO fixed Drive
 * files, so the shared links never change (Drive keeps previous weeks as version history).
 * When there is nothing new it just logs and exits (no error, no email).
 *
 * Setup:
 *  1. Services (+) -> "Drive API".
 *  2. Project Settings -> Script Properties -> GITHUB_TOKEN.
 *  3. Upload one .pptx and one .xlsx to Drive once (any content) and paste their
 *     file IDs into LTV_PPTX_FILE_ID / LTV_XLSX_FILE_ID below.
 *  4. Run ltvSetup() once and approve the permissions.
 *  5. Run ltvInstallTrigger() once (hourly check; replaces the old Monday 19:00 trigger).
 *  Optional: run ltvPullLatestReport() manually any time to test.
 */

const LTV_REPO = 'wahyu-sawitpro/analisa-claude';
const LTV_ARTIFACT_NAME = 'ltv-report';
const LTV_PPTX_FILE_ID = '1VIO1pjQJQkd5TIwwJKV2v7YIk7OSTbQc';
const LTV_XLSX_FILE_ID = '1qlsD9_NgZxtcZwUsYRtrnREUGWx7U6wx';
const LTV_STALE_DAYS = 8;      // newest artifact older than this = the weekly workflow did not run
const LTV_LAST_ID_PROP = 'LAST_ARTIFACT_ID_LTV'; // separate from the AM report's LAST_ARTIFACT_ID

const LTV_TARGETS = [
  { ext: '.pptx', fileId: LTV_PPTX_FILE_ID,
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  { ext: '.xlsx', fileId: LTV_XLSX_FILE_ID,
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
];

function ltvSetup() {
  const token = ltvToken_();
  LTV_TARGETS.forEach(t => {
    const f = Drive.Files.get(t.fileId, { supportsAllDrives: true, fields: 'id,name,webViewLink' });
    Logger.log('Drive OK (' + t.ext + '): ' + f.name + ' ' + f.webViewLink);
  });
  const a = ltvLatestArtifact_(token);
  Logger.log(a ? 'GitHub OK: latest artifact ' + a.id + ' created ' + a.created_at
               : 'GitHub OK, but no artifact yet (run the LTV workflow once from the Actions tab).');
}

function ltvInstallTrigger() {
  // only touches the LTV trigger — the AM report trigger (pullLatestReport) is left as is
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'ltvPullLatestReport')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('ltvPullLatestReport')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log('LTV trigger installed: checks GitHub every hour, updates Drive only when a new report exists');
}

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
  const zip = UrlFetchApp.fetch(location, { followRedirects: true }).getBlob().setContentType('application/zip');
  const blobs = Utilities.unzip(zip);

  LTV_TARGETS.forEach(t => {
    const b = blobs.find(x => x.getName().toLowerCase().endsWith(t.ext));
    if (!b) throw new Error('No ' + t.ext + ' inside artifact ' + a.id);
    const updated = Drive.Files.update(
      { description: 'Customer LTV & KebunPRO Report — auto-updated ' + new Date().toISOString() },
      t.fileId,
      b.setContentType(t.mime),
      { supportsAllDrives: true, fields: 'id,name,modifiedTime' }
    );
    Logger.log('Updated ' + updated.name + ' at ' + updated.modifiedTime + ' from artifact ' + a.id);
  });
  props.setProperty(LTV_LAST_ID_PROP, String(a.id));
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
