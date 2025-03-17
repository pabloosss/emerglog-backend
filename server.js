const express = require("express");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Konfiguracja Google Sheets
const SHEET_ID = "10XgqG_OCszYY8wqJlhpiPNgBxuEwFZOJJF2iuXTdqpY";
const doc = new GoogleSpreadsheet(SHEET_ID);

// Autoryzacja Google Sheets
async function authorizeGoogleSheets() {
    try {
        await doc.useServiceAccountAuth({
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        });
        await doc.loadInfo();
        console.log("✅ Google Sheets - autoryzacja udana.");
    } catch (error) {
        console.error("❌ Błąd autoryzacji Google Sheets:", error);
    }
}

// Pobranie listy imion i nazwisk
async function getSheetData() {
    await authorizeGoogleSheets();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    return rows.map(row => row._rawData);
}

// Aktualizacja Google Sheets
async function updateSpreadsheet(name, month) {
    await authorizeGoogleSheets();
    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();
    
    let nameColumn = "A"; // Kolumna z imionami
    let monthColumn = null;

    // Pobranie indeksu kolumny na podstawie nagłówków
    const headers = sheet.headerValues;
    const monthIndex = headers.indexOf(month);
    if (monthIndex !== -1) {
        monthColumn = String.fromCharCode(66 + monthIndex - 1); // Konwersja na literę kolumny (B, C, D...)
    }

    if (!monthColumn) {
        console.error("❌ Nie znaleziono kolumny dla miesiąca:", month);
        return;
    }

    for (let row of rows) {
        if (row[nameColumn] === name) {
            row[monthColumn] = "✅ Wysłano";
            await row.save();
            console.log(`✅ Zaktualizowano arkusz dla ${name} (${month})`);
            return;
        }
    }
    console.log(`⚠️ Nie znaleziono ${name} w arkuszu.`);
}

// Endpoint do wysyłki e-maila z PDF
app.post("/send-pdf", async (req, res) => {
    const { name, email, tableData, month } = req.body;

    if (!name || !email || !tableData || !Array.isArray(tableData) || !month) {
        return res.status(400).json({ message: "❌ Brak wymaganych danych!" });
    }

    console.log(`📩 Próba wysyłki e-maila na adres: ${email}`);

    // Tworzenie pliku PDF
    const filePath = `./${name.replace(/\s+/g, "_")}_schedule.pdf`;
    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    doc.fontSize(20).text(`Harmonogram godzinowy dla: ${name}`, { align: "center" });
    doc.moveDown();

    tableData.forEach((row, index) => {
        doc.fontSize(12).text(`${index + 1}. ${row}`, { indent: 10 });
    });

    doc.end();

    writeStream.on("finish", async () => {
        let transporter = nodemailer.createTransport({
            service: "Gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        let mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: `Twój harmonogram godzin - ${name}`,
            text: "W załączniku znajdziesz swój harmonogram godzin.",
            attachments: [{ filename: `${name}_schedule.pdf`, path: filePath }],
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ Email wysłany do: ${email}`);
            await updateSpreadsheet(name, month);
            res.json({ message: "✅ PDF wysłany i arkusz zaktualizowany!" });

            setTimeout(() => {
                fs.unlinkSync(filePath);
                console.log("🗑️ Plik PDF usunięty:", filePath);
            }, 5000);
        } catch (error) {
            console.error("❌ Błąd wysyłania e-maila:", error);
            res.status(500).json({ message: "❌ Błąd wysyłania e-maila", error });
        }
    });
});

// Endpoint do pobrania danych z arkusza
app.get("/get-sheet-data", async (req, res) => {
    try {
        const data = await getSheetData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: "❌ Błąd pobierania danych z arkusza", error });
    }
});

// Start serwera
app.listen(PORT, () => console.log(`✅ Serwer działa na porcie ${PORT}`));
