/**
 * Delivery SLA / Aging Report (B2C Smallholder) — pull from GitHub, overwrite fixed Drive files.
 *
 * Same pattern as the AM and LTV reports — no email.
 * Runs in its OWN Apps Script project (separate from the AM and LTV projects).
 *
 * Every Wednesday ~11:17 WIB GitHub Actions (sla-report-weekly.yml) reads
 * "pending and aging more than 14 days from smallholder team customer.csv" and builds the
 * artifact "sla-report" (sla_report.pptx). This script runs Wednesday 13:00–14:00 WIB,
 * downloads the newest artifact and overwrites ONE fixed Drive .pptx file, so the shared link
 * never changes (Drive keeps previous weeks as version history). Same as the AM report: PPT only.
 *
 * Setup:
 *  1. Services (+) -> "Drive API".
 *  2. Project Settings -> Script Properties -> GITHUB_TOKEN.
 *  3. SLA_PPTX_FILE_ID below = the Drive .pptx file that is overwritten every week
 *     (a real .pptx upload, not a Google Slides file).
 *  4. Run slaSetup() once and approve the permissions.
 *  5. Run slaInstallTrigger() once (weekly Wednesday 13:00 WIB trigger for this report only).
 *  Optional: run slaPullLatestReport() manually any time to test.
 */

const SLA_REPO = 'wahyu-sawitpro/analisa-claude';
const SLA_ARTIFACT_NAME = 'sla-report';
const SLA_PPTX_FILE_ID = '1Q9Z_iE15N4xt_rOP-lKVyLykjRDBRQzA'; // Drive: Pending Aging.pptx
const SLA_MAX_AGE_HOURS = 30; // ignore artifacts older than this (e.g. workflow failed this week)
const SLA_LAST_ID_PROP = 'LAST_ARTIFACT_ID_SLA'; // separate from the AM / LTV report's last-artifact property

const SLA_TARGETS = [
  { ext: '.pptx', fileId: SLA_PPTX_FILE_ID,
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
];

function slaSetup() {
  slaCheckFileIds_();
  const token = slaToken_();
  SLA_TARGETS.forEach(t => {
    const f = Drive.Files.get(t.fileId, { supportsAllDrives: true, fields: 'id,name,webViewLink' });
    Logger.log('Drive OK (' + t.ext + '): ' + f.name + ' ' + f.webViewLink);
  });
  const a = slaLatestArtifact_(token);
  Logger.log(a ? 'GitHub OK: latest artifact ' + a.id + ' created ' + a.created_at
               : 'GitHub OK, but no artifact yet (run the SLA workflow once from the Actions tab).');
}

function slaInstallTrigger() {
  // only touches the SLA trigger — the AM / LTV triggers are left as is
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'slaPullLatestReport')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('slaPullLatestReport')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.WEDNESDAY)
    .atHour(13)
    .inTimezone('Asia/Jakarta')
    .create();
  Logger.log('SLA trigger installed: every Wednesday 13:00–14:00 WIB');
}

function slaPullLatestReport() {
  slaCheckFileIds_();
  const props = PropertiesService.getScriptProperties();
  const token = slaToken_();
  const a = slaLatestArtifact_(token);
  if (!a) throw new Error('No artifact "' + SLA_ARTIFACT_NAME + '" found.');

  const ageH = (Date.now() - new Date(a.created_at).getTime()) / 36e5;
  if (ageH > SLA_MAX_AGE_HOURS) {
    throw new Error('Latest SLA artifact is ' + ageH.toFixed(0) +
                    'h old — this week\'s SLA workflow probably failed. Check the Actions tab.');
  }
  if (props.getProperty(SLA_LAST_ID_PROP) === String(a.id)) {
    Logger.log('SLA artifact ' + a.id + ' already uploaded, nothing to do.');
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

  SLA_TARGETS.forEach(t => {
    const b = blobs.find(x => x.getName().toLowerCase().endsWith(t.ext));
    if (!b) throw new Error('No ' + t.ext + ' inside artifact ' + a.id);
    const updated = Drive.Files.update(
      { description: 'Delivery SLA / Aging Report — auto-updated ' + new Date().toISOString() },
      t.fileId,
      b.setContentType(t.mime),
      { supportsAllDrives: true, fields: 'id,name,modifiedTime' }
    );
    Logger.log('Updated ' + updated.name + ' at ' + updated.modifiedTime + ' from artifact ' + a.id);
  });
  props.setProperty(SLA_LAST_ID_PROP, String(a.id));
}

function slaLatestArtifact_(token) {
  const res = UrlFetchApp.fetch(
    'https://api.github.com/repos/' + SLA_REPO + '/actions/artifacts?per_page=20&name=' + SLA_ARTIFACT_NAME,
    { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }, muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) {
    throw new Error('GitHub API ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  }
  const list = JSON.parse(res.getContentText()).artifacts.filter(x => !x.expired);
  list.sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
  return list[0] || null;
}

function slaToken_() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Add Script Property GITHUB_TOKEN first.');
  return token;
}

function slaCheckFileIds_() {
  SLA_TARGETS.forEach(t => {
    if (!t.fileId || t.fileId.indexOf('PASTE_') === 0) {
      throw new Error('Fill in SLA_PPTX_FILE_ID at the top of the script first.');
    }
  });
}
