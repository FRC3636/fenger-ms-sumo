// https://share.google/aimode/Us4cv4FBBB2vbUZAy
/*
Deployment ID
AKfycbwmPKewvI1HA34cuwx9tl2YprifSiiyPXuiBrv6Orxv-xcuPk0oNSTn3VS3rHg7GKJIQA
Web app
URL
https://script.google.com/macros/s/AKfycbwmPKewvI1HA34cuwx9tl2YprifSiiyPXuiBrv6Orxv-xcuPk0oNSTn3VS3rHg7GKJIQA/exec

Library
URL
https://script.google.com/macros/library/d/1ijoFaSA-W5crHTNl1tkC5VCiln0FilMr24ZPERwL0YghwQ3GOlgE3Uu5/2
*/


const SPREADSHEET_ID = '1FtpiymbRIBXfG-knVKAafGWsGZQbd0B9My8VpR2cMOk';
const SECRET_TOKEN = 'fengermanagementsystem';

function doGet(e) {
  // Authentication check
  if (e?.parameter.token !== SECRET_TOKEN && e?.parameter) {
    return ContentService.createTextOutput("Unauthorized").setMimeType(ContentService.MimeType.TEXT);
  }

  if (e?.parameter.autoAddTeams) {
    setTeams(false)
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("All Matches")
  const onDeckSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("P8 Sumo Next Plays")

  let onDeckTeamNumCol = getColumnNrByName(onDeckSheet,"Team #") - 1
  let redOnDeckData = onDeckSheet.getRange(2, 1, 1, sheet.getLastColumn()).getValues()[0];
  let blueOnDeckData = onDeckSheet.getRange(3, 1, 1, sheet.getLastColumn()).getValues()[0];


  var lastRowIndex = getRowCountIgnoringCheckboxes(sheet)

  // If the sheet only has headers or is empty
  if (lastRowIndex <= 1) {
    return ContentService.createTextOutput(JSON.stringify({error: "No data found"}))
                         .setMimeType(ContentService.MimeType.JSON);
  }

  // Get only the last row (1 row, starting at lastRowIndex, all columns)
  const lastRowData = sheet.getRange(lastRowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];

  const result = {
    matchNumber: lastRowData[getColumnNrByName(sheet,"Match #")-1],
    redTeamNumber: lastRowData[getColumnNrByName(sheet,"Red Team #1")-1],
    redTeamName: lastRowData[getColumnNrByName(sheet,"Robot Name RT1")-1],
    redTeamMembers: lastRowData[getColumnNrByName(sheet,"Team Members RT1")-1],
    blueTeamNumber: lastRowData[getColumnNrByName(sheet,"Blue Team #1")-1],
    blueTeamName: lastRowData[getColumnNrByName(sheet,"Robot Name BT1")-1],
    blueTeamMembers: lastRowData[getColumnNrByName(sheet,"Team Members BT1")-1],
    redTeam2Number: lastRowData[getColumnNrByName(sheet,"Red Team #2")-1],
    redTeam2Name: lastRowData[getColumnNrByName(sheet,"Robot Name RT2")-1],
    redTeam2Members: lastRowData[getColumnNrByName(sheet,"Team Members RT2")-1],
    blueTeam2Number: lastRowData[getColumnNrByName(sheet,"Blue Team #2")-1],
    blueTeam2Name: lastRowData[getColumnNrByName(sheet,"Robot Name BT2")-1],
    blueTeam2Members: lastRowData[getColumnNrByName(sheet,"Team Members BT2")-1],
    redOnDeck: redOnDeckData[onDeckTeamNumCol],
    blueOnDeck: blueOnDeckData[onDeckTeamNumCol]
  };
  console.log(result)
  return ContentService.createTextOutput(JSON.stringify(result))
                       .setMimeType(ContentService.MimeType.JSON);
}


function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  if (data.token !== SECRET_TOKEN) return ContentService.createTextOutput("Unauthorized");

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("All Matches")
  const rows = sheet.getDataRange().getValues();

  // Find the row where Match Number matches
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == data.matchNumber) {
      if (data.gameMode === "rvb") {
        const row = i + 1;
        sheet.getRange(row, getColumnNrByName(sheet,"Winner")).setValue(data.redWin ? "Red" : "Blue");
        if (typeof data.blueScore === "number") {
          sheet.getRange(row, getColumnNrByName(sheet,"Blue Balls")).setValue(data.blueScore - (data.blueAutoScore || 0));
        }
        if (typeof data.redScore === "number") {
          sheet.getRange(row, getColumnNrByName(sheet,"Red Balls")).setValue(data.redScore - (data.redAutoScore || 0));
        }
        if (typeof data.blueAutoScore === "number") {
          sheet.getRange(row, getColumnNrByName(sheet,"Blue Auto Balls")).setValue(data.blueAutoScore);
        }
        if (typeof data.redAutoScore === "number") {
          sheet.getRange(row, getColumnNrByName(sheet,"Red Auto Balls")).setValue(data.redAutoScore);
        }
        if (typeof data.bluePens === "number") {
          sheet.getRange(row, getColumnNrByName(sheet,"Blue Goal Penalty")).setValue(data.bluePens);
        }
        if (typeof data.redPens === "number") {
          sheet.getRange(row, getColumnNrByName(sheet,"Red Goal Penalty")).setValue(data.redPens);
        }
      } else if (data.redWin == true) {
        sheet.getRange(i + 1, getColumnNrByName(sheet,"Red Sumo Win")).setValue("TRUE"); // Column R
      } else {
        sheet.getRange(i + 1, getColumnNrByName(sheet,"Blue Sumo Win")).setValue("TRUE"); // Column Q
      }
      SpreadsheetApp.flush();
      return ContentService.createTextOutput("Scores Updated").setMimeType(ContentService.MimeType.TEXT);
    }
  }
  return ContentService.createTextOutput("Match Not Found").setMimeType(ContentService.MimeType.TEXT);
}
