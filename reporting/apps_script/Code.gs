/**
 * AM Report + LTV Report — pull from GitHub, overwrite fixed Drive files.
 *
 * Every Monday 16:00 WIB GitHub Actions builds:
 *   - artifact "am-report-pptx" -> report.pptx                       (AM report)
 *   - artifact "ltv-report"     -> ltv_report.pptx + ltv_report.xlsx (Customer LTV & KebunPRO cross-sell)
 * This script runs Monday 17:00–18:00 WIB, downloads the newest artifact of each
 * report and overwrites FIXED Drive files, so the shared links never change
 * (Drive keeps previous weeks as version history). No web app deployment needed.
 *
 * Setup:
 *  1. Services (+) -> add "Drive API" (v3).
 *  2. Project Settings -> Script Properties -> add GITHUB_TOKEN
 *     (fine-grained token, only repo analisa-claude, permission Actions: Read-only).
 *  3. Upload one .pptx and one .xlsx for the LTV report to Drive once (any content),
 *     and paste their file IDs into the LTV entry of REPORTS below.
 *  4. Run setup() once and approve the permissions.
 *  5. Run installTrigger() once (creates the weekly Monday 17:00 WIB trigger).
 *  Optional: run pullLatestReport() (AM) / pullLtvReport() (LTV) manually any time to test.
 */

const REPO = 'wahyu-sawitpro/analisa-claude';
const MAX_AGE_HOURS = 30; // ignore artifacts older than this (e.g. workflow failed this week)

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// One entry per report. files: which file inside the artifact overwrites which Drive file.
const REPORTS = [
  {
    key: 'AM',
    artifact: 'am-report-pptx',
    lastIdProp: 'LAST_ARTIFACT_ID',                 // same property as before -> no duplicate upload
    description: 'AM Report',
    files: [{ ext: '.pptx', mime: PPTX_MIME, fileId: '1fRAnUSCcj6nZZPXbazul-w8ny_8QioKn' }],
  },
  {
    key: 'LTV',
    artifact: 'ltv-report',
    lastIdProp: 'LAST_ARTIFACT_ID_LTV',
    description: 'Customer LTV & KebunPRO Cross-sell Report',
    files: [
      { ext: '.pptx', mime: PPTX_MIME, fileId: 'PASTE_LTV_PPTX_FILE_ID' },
      { ext: '.xlsx', mime: XLSX_MIME, fileId: 'PASTE_LTV_XLSX_FILE_ID' },
    ],
  },
];

// ------------------------------------------------------------------ setup & trigger
function setup() {
  const token = getToken_();
  REPORTS.forEach(r => {
    r.files.forEach(f => {
      const d = Drive.Files.get(f.fileId, { supportsAllDrives: true, fields: 'id,name,webViewLink' });
      Logger.log('[' + r.key + '] Drive OK: ' + d.name + ' ' + d.webViewLink);
    });
    const a = latestArtifact_(token, r.artifact);
    Logger.log(a ? '[' + r.key + '] GitHub OK: latest artifact ' + a.id + ' created ' + a.created_at
                 : '[' + r.key + '] GitHub OK, but no artifact yet (run the workflow once from the Actions tab).');
  });
}

function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => ['pullLatestReport', 'pullAllReports'].includes(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('pullAllReports')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(17)
    .inTimezone('Asia/Jakarta')
    .create();
  Logger.log('Trigger installed: pullAllReports every Monday 17:00–18:00 WIB');
}

// ------------------------------------------------------------------ entry points
/** Weekly trigger: pull every report; one failing report doesn't block the others. */
function pullAllReports() {
  const errors = [];
  REPORTS.forEach(r => {
    try { pullReport_(r); } catch (e) { errors.push('[' + r.key + '] ' + e.message); }
  });
  if (errors.length) throw new Error(errors.join('\n'));   // trigger failure -> Google sends an error email
}

function pullLatestReport() { pullReport_(REPORTS.find(r => r.key === 'AM')); }   // AM only (old name kept)
function pullLtvReport()    { pullReport_(REPORTS.find(r => r.key === 'LTV')); }  // LTV only

// ------------------------------------------------------------------ core
function pullReport_(r) {
  const props = PropertiesService.getScriptProperties();
  const token = getToken_();
  const a = latestArtifact_(token, r.artifact);
  if (!a) throw new Error('No artifact "' + r.artifact + '" found.');

  const ageH = (Date.now() - new Date(a.created_at).getTime()) / 36e5;
  if (ageH > MAX_AGE_HOURS) {
    throw new Error('Latest "' + r.artifact + '" is ' + ageH.toFixed(0) +
                    'h old — this week\'s workflow probably failed. Check the Actions tab.');
  }
  if (props.getProperty(r.lastIdProp) === String(a.id)) {
    Logger.log('[' + r.key + '] Artifact ' + a.id + ' already uploaded, nothing to do.');
    return;
  }

  const blobs = Utilities.unzip(downloadArtifact_(token, a));
  r.files.forEach(f => {
    const b = blobs.find(x => x.getName().toLowerCase().endsWith(f.ext));
    if (!b) throw new Error('No ' + f.ext + ' inside artifact ' + a.id);
    const updated = Drive.Files.update(
      { description: r.description + ' — auto-updated ' + new Date().toISOString() },
      f.fileId,
      b.setContentType(f.mime),
      { supportsAllDrives: true, fields: 'id,name,modifiedTime' }
    );
    Logger.log('[' + r.key + '] Updated ' + updated.name + ' at ' + updated.modifiedTime + ' from artifact ' + a.id);
  });
  props.setProperty(r.lastIdProp, String(a.id));
}

function downloadArtifact_(token, a) {
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

function latestArtifact_(token, name) {
  const res = UrlFetchApp.fetch(
    'https://api.github.com/repos/' + REPO + '/actions/artifacts?per_page=20&name=' + name,
    { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }, muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) {
    throw new Error('GitHub API ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  }
  const list = JSON.parse(res.getContentText()).artifacts.filter(x => !x.expired);
  list.sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
  return list[0] || null;
}

function getToken_() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Add Script Property GITHUB_TOKEN first.');
  return token;
}
