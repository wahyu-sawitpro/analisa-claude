/**
 * AM Report Smallholder — pull from GitHub, overwrite a fixed Drive file.
 * Runs in its OWN Apps Script project (separate from the LTV and SLA projects).
 *
 * Every Monday 16:00 WIB GitHub Actions (am-report-weekly.yml) builds the artifact
 * "am-report-pptx" (report.pptx). This script runs Monday 17:00–18:00 WIB, downloads the
 * newest artifact and overwrites ONE fixed Drive file, so the shared link never changes
 * (Drive keeps previous weeks as version history).
 *
 * Setup (see reporting/apps_script/SETUP.md):
 *  1. Services (+) -> "Drive API".
 *  2. Project Settings -> Script Properties -> GITHUB_TOKEN.
 *  3. AM_PPTX_FILE_ID below = the Drive file that is overwritten every week.
 *  4. Run amSetup() once and approve the permissions.
 *  5. Run amInstallTrigger() once (weekly Monday 17:00 WIB).
 *  Optional: run amPullLatestReport() manually any time to test.
 */

const AM_REPO = 'wahyu-sawitpro/analisa-claude';
const AM_ARTIFACT_NAME = 'am-report-pptx';
const AM_PPTX_FILE_ID = '1fRAnUSCcj6nZZPXbazul-w8ny_8QioKn';
const AM_MAX_AGE_HOURS = 30; // ignore artifacts older than this (e.g. workflow failed this week)
const AM_LAST_ID_PROP = 'LAST_ARTIFACT_ID_AM';

const AM_TARGETS = [
  { ext: '.pptx', fileId: AM_PPTX_FILE_ID,
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
];

function amSetup() {
  const token = amToken_();
  AM_TARGETS.forEach(t => {
    const f = Drive.Files.get(t.fileId, { supportsAllDrives: true, fields: 'id,name,webViewLink' });
    Logger.log('Drive OK (' + t.ext + '): ' + f.name + ' ' + f.webViewLink);
  });
  const a = amLatestArtifact_(token);
  Logger.log(a ? 'GitHub OK: latest artifact ' + a.id + ' created ' + a.created_at
               : 'GitHub OK, but no artifact yet (run the AM workflow once from the Actions tab).');
}

function amInstallTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'amPullLatestReport')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('amPullLatestReport')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(17)
    .inTimezone('Asia/Jakarta')
    .create();
  Logger.log('AM trigger installed: every Monday 17:00–18:00 WIB');
}

function amPullLatestReport() {
  const props = PropertiesService.getScriptProperties();
  const token = amToken_();
  const a = amLatestArtifact_(token);
  if (!a) throw new Error('No artifact "' + AM_ARTIFACT_NAME + '" found.');

  const ageH = (Date.now() - new Date(a.created_at).getTime()) / 36e5;
  if (ageH > AM_MAX_AGE_HOURS) {
    throw new Error('Latest AM artifact is ' + ageH.toFixed(0) +
                    'h old — this week\'s AM workflow probably failed. Check the Actions tab.');
  }
  if (props.getProperty(AM_LAST_ID_PROP) === String(a.id)) {
    Logger.log('AM artifact ' + a.id + ' already uploaded, nothing to do.');
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

  AM_TARGETS.forEach(t => {
    const b = blobs.find(x => x.getName().toLowerCase().endsWith(t.ext));
    if (!b) throw new Error('No ' + t.ext + ' inside artifact ' + a.id);
    const updated = Drive.Files.update(
      { description: 'AM Report Smallholder — auto-updated ' + new Date().toISOString() },
      t.fileId,
      b.setContentType(t.mime),
      { supportsAllDrives: true, fields: 'id,name,modifiedTime' }
    );
    Logger.log('Updated ' + updated.name + ' at ' + updated.modifiedTime + ' from artifact ' + a.id);
  });
  props.setProperty(AM_LAST_ID_PROP, String(a.id));
}

function amLatestArtifact_(token) {
  const res = UrlFetchApp.fetch(
    'https://api.github.com/repos/' + AM_REPO + '/actions/artifacts?per_page=20&name=' + AM_ARTIFACT_NAME,
    { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }, muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) {
    throw new Error('GitHub API ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  }
  const list = JSON.parse(res.getContentText()).artifacts.filter(x => !x.expired);
  list.sort((x, y) => new Date(y.created_at) - new Date(x.created_at));
  return list[0] || null;
}

function amToken_() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Add Script Property GITHUB_TOKEN first.');
  return token;
}
