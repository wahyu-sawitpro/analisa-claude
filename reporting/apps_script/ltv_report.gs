/**
 * Ambil hasil workflow "LTV & Upsell / Cross-sell Report Smallholder" dari GitHub Actions
 * (artifact "ltv-report" berisi ltv_report.pptx + ltv_report.xlsx) lalu simpan ke Google Drive.
 *
 * Setup (sekali):
 *   1. Project Settings > Script Properties, isi:
 *        GITHUB_TOKEN   = fine-grained PAT, repo wahyu-sawitpro/analisa-claude, permission "Actions: Read"
 *                         (boleh pakai token yang sama dengan AM report)
 *        LTV_FOLDER_ID  = ID folder Google Drive tujuan
 *        LTV_EMAIL_TO   = (opsional) email penerima, pisahkan dengan koma
 *   2. Jalankan fetchLtvReport() sekali manual untuk memberi izin.
 *   3. Jalankan createLtvTrigger() sekali -> otomatis tiap Senin ~17:00 WIB.
 */
const LTV_REPO = 'wahyu-sawitpro/analisa-claude';
const LTV_ARTIFACT = 'ltv-report';

function fetchLtvReport() {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('GITHUB_TOKEN');
  const folder = DriveApp.getFolderById(props.getProperty('LTV_FOLDER_ID'));
  const headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' };

  // 1. artifact terbaru dengan nama "ltv-report"
  const list = JSON.parse(UrlFetchApp.fetch(
    'https://api.github.com/repos/' + LTV_REPO + '/actions/artifacts?name=' + LTV_ARTIFACT + '&per_page=1',
    { headers: headers }).getContentText());
  const art = (list.artifacts || []).filter(a => !a.expired)[0];
  if (!art) throw new Error('Artifact "' + LTV_ARTIFACT + '" belum ada / sudah expired. Cek tab Actions.');

  // jangan proses artifact yang sama dua kali
  if (props.getProperty('LTV_LAST_ARTIFACT_ID') === String(art.id)) {
    Logger.log('Artifact ' + art.id + ' sudah diambil sebelumnya, skip.');
    return;
  }

  // 2. download zip & ekstrak
  const zip = UrlFetchApp.fetch(art.archive_download_url, { headers: headers }).getBlob();
  zip.setContentType('application/zip');
  const files = Utilities.unzip(zip);

  // 3. simpan ke Drive dengan nama bertanggal
  const tz = 'Asia/Jakarta';
  const stamp = Utilities.formatDate(new Date(art.created_at), tz, 'yyyy-MM-dd');
  const saved = files.map(b => {
    const ext = b.getName().split('.').pop();
    b.setName('LTV_Report_Smallholder_' + stamp + '.' + ext);
    return folder.createFile(b);
  });
  props.setProperty('LTV_LAST_ARTIFACT_ID', String(art.id));

  // 4. (opsional) kirim email berisi link
  const to = props.getProperty('LTV_EMAIL_TO');
  if (to) {
    MailApp.sendEmail({
      to: to,
      subject: 'LTV & KebunPRO Cross-sell Report Smallholder — ' + stamp,
      htmlBody: 'Report mingguan sudah tersedia:<br>' +
        saved.map(f => '• <a href="' + f.getUrl() + '">' + f.getName() + '</a>').join('<br>'),
    });
  }
  Logger.log('Saved: ' + saved.map(f => f.getName()).join(', '));
}

function createLtvTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'fetchLtvReport')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('fetchLtvReport')
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(17).nearMinute(15)
    .inTimezone('Asia/Jakarta').create();
}
