const SHEET_NAME = "Website Leads";
const HEADERS = ["Submitted At","Source","Name","Phone","Email","Requirement","Location","Property Type / Configuration","Budget","Page","Follow-up Status"];

function doPost(e) {
  try {
    const lead = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (!String(lead.name || "").trim()) {
      return json_({ ok: false, error: "Name is required." });
    }
    if (!/^[6-9][0-9]{9}$/.test(String(lead.phone || "").trim())) {
      return json_({ ok: false, error: "Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9." });
    }
    const props = PropertiesService.getScriptProperties();
    let spreadsheetId = props.getProperty("LEADS_SPREADSHEET_ID");
    let spreadsheet;
    if (spreadsheetId) {
      spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    } else {
      spreadsheet = SpreadsheetApp.create("The NXT Realty — Website Leads");
      props.setProperty("LEADS_SPREADSHEET_ID", spreadsheet.getId());
    }
    let sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = spreadsheet.getSheets()[0].setName(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.setFrozenRows(1);
      sheet.getRange(1,1,1,HEADERS.length).setFontWeight("bold");
    }
    sheet.appendRow([
      new Date(), String(lead.source || "Website Form"), clean_(lead.name), clean_(lead.phone),
      clean_(lead.email), clean_(lead.requirement), clean_(lead.location),
      clean_(lead.propertyType), clean_(lead.budget), clean_(lead.page), "New"
    ]);
    return json_({ ok: true, spreadsheetUrl: spreadsheet.getUrl() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
function clean_(value) {
  const s = String(value || "").trim().slice(0, 2000);
  return /^[=+@]/.test(s) ? "'" + s : s;
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
