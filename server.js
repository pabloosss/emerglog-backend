const { google } = require("googleapis");
const dotenv = require("dotenv");
dotenv.config();

const GOOGLE_SHEET_ID = "10XgqG_OCszYY8wqJlhpiPNgBxuEwFZOJJF2iuXTdqpY"; // ID Twojego arkusza Google

// ✅ Konstruowanie pełnego obiektu klucza na podstawie zmiennych .env
const googleAuth = {
    type: "service_account",
    project_id: "emerlog-api",
    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"), // Ważne: usuwa podwójne '\n'!
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.GOOGLE_CLIENT_EMAIL}`
};

const auth = new google.auth.JWT(
    googleAuth.client_email,
    null,
    googleAuth.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"]
);

const sheets = google.sheets({ version: "v4", auth });

// ✅ **Funkcja aktualizacji arkusza**
async function updateSpreadsheet(name, monthYear) {
    try {
        const range = "A1:Z100"; // Zakres do pobrania
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: range,
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.error("❌ Brak danych w arkuszu.");
            return;
        }

        // 🔹 Znalezienie kolumny dla danego miesiąca
        const headerRow = rows[0];
        const monthColumnIndex = headerRow.indexOf(monthYear);
        if (monthColumnIndex === -1) {
            console.error(`❌ Nie znaleziono kolumny dla miesiąca: ${monthYear}`);
            return;
        }

        // 🔹 Znalezienie wiersza z imieniem i nazwiskiem
        const rowIndex = rows.findIndex(row => row[0] === name);
        if (rowIndex === -1) {
            console.error(`❌ Nie znaleziono osoby: ${name}`);
            return;
        }

        // 🔹 Aktualizacja komórki w arkuszu Google
        await sheets.spreadsheets.values.update({
            spreadsheetId: GOOGLE_SHEET_ID,
            range: `R${rowIndex + 1}C${monthColumnIndex + 1}`,
            valueInputOption: "RAW",
            resource: { values: [["✔️ Wysłano"]] },
        });

        console.log(`✅ Zaktualizowano arkusz: ${name} - ${monthYear}`);
    } catch (error) {
        console.error("❌ Błąd aktualizacji arkusza:", error);
    }
}

module.exports = { updateSpreadsheet };
