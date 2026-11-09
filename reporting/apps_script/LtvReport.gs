/**
 * Customer LTV & KebunPRO Cross-sell Report — pull from GitHub, overwrite fixed Drive files.
 *
 * Runs ALONGSIDE the AM report script (Code.gs) — it does not change or replace it.
 * All names here are prefixed "ltv"/"LTV_" so this file can sit in the SAME Apps Script
 * project as Code.gs without name clashes (or in its own project — it is self-contained).
 *
 * Every Monday 16:00 WIB GitHub Actions builds the artifact "ltv-report"
 * (ltv_report.pptx + ltv_report.xlsx). This script runs Monday 17:00–18:00 WIB,
 * downloads the newest artifact and overwrites TWO fixed Drive files, so the shared
 * links never change (Drive keeps previous weeks as version history).
 *
 * Setup:
 *  1. Services (+) -> "Drive API" (v3)   (already there if you use the AM report project).
 *  2. Script Property GITHUB_TOKEN        (already there if you use the AM report project).
 *  3. Upload one .pptx and one .xlsx to Drive once (any content) and paste their
 *     file IDs into LTV_PPTX_FILE_ID / LTV_XLSX_FILE_ID below.
 *  4. Run ltvSetup() once and approve the permissions.
 *  5. Run ltvInstallTrigger() once (weekly Monday 17:00 WIB trigger for LTV only).
 *  Optional: run ltvPullLatestReport() manually any time to test.
 */

const LTV_REPO = 'wahyu-sawitpro/analisa-claude';
const LTV_ARTIFACT_NAME = 'ltv-report';
const LTV_PPTX_FILE_ID = 'PASTE_LTV_PPTX_FILE_ID';
const LTV_XLSX_FILE_ID = 'PASTE_LTV_XLSX_FILE_ID';
const LTV_MAX_AGE_HOURS = 30; // ignore artifacts older than this (e.g. workflow failed this week)
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
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(17)
    .inTimezone('Asia/Jakarta')
    .create();
  Logger.log('LTV trigger installed: every Monday 17:00–18:00 WIB');
}

function ltvPullLatestReport() {
  const props = PropertiesService.getScriptProperties();
  const token = ltvToken_();
  const a = ltvLatestArtifact_(token);
  if (!a) throw new Error('No artifact "' + LTV_ARTIFACT_NAME + '" found.');

  const ageH = (Date.now() - new Date(a.created_at).getTime()) / 36e5;
  if (ageH > LTV_MAX_AGE_HOURS) {
    throw new Error('Latest LTV artifact is ' + ageH.toFixed(0) +
                    'h old — this week\'s LTV workflow probably failed. Check the Actions tab.');
  }
  if (props.getProperty(LTV_LAST_ID_PROP) === String(a.id)) {
    Logger.log('LTV artifact ' + a.id + ' already uploaded, nothing to do.');
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
