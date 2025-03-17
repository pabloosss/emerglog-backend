const express = require("express");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const creds = require("./keys.json");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Główna strona
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Endpoint do testowania
app.get("/test", (req, res) => {
    res.json({ message: "✅ Serwer działa poprawnie!" });
});

// Lista wysłanych e-maili
let sentEmails = [];

// Konfiguracja Google Sheets
const SHEET_ID = "10XgqG_OCszYY8wqJlhpiPNgBxuEwFZOJJF2iuXTdqpY"; // Twój ID arkusza
const doc = new GoogleSpreadsheet(SHEET_ID);

async function updateSpreadsheet(name, monthYear) {
    try {
        await doc.useServiceAccountAuth(creds);
        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0]; // Pierwsza karta w arkuszu
        await sheet.loadCells("A1:Z100"); // Załaduj dane

        let nameRow = null;
        let monthCol = null;

        for (let row = 0; row < sheet.rowCount; row++) {
            const cell = sheet.getCell(row, 0);
            if (cell.value && cell.value.toLowerCase() === name.toLowerCase()) {
                nameRow = row;
                break;
            }
        }

        for (let col = 0; col < sheet.columnCount; col++) {
            const cell = sheet.getCell(0, col);
            if (cell.value && cell.value === monthYear) {
                monthCol = col;
                break;
            }
        }

        if (nameRow !== null && monthCol !== null) {
            sheet.getCell(nameRow, monthCol).value = "Wysłano";
            await sheet.saveUpdatedCells();
        } else {
            console.error("❌ Nie znaleziono odpowiedniej kolumny lub wiersza w arkuszu!");
        }
    } catch (error) {
        console.error("❌ Błąd aktualizacji arkusza:", error);
    }
}

// Endpoint do generowania i wysyłania PDF
app.post("/send-pdf", async (req, res) => {
    const { name, email, monthYear, tableData } = req.body;
    if (!name || !email || !tableData || !Array.isArray(tableData)) {
        return res.status(400).json({ message: "❌ Brak wymaganych danych!" });
    }

    console.log("📩 Próba wysyłki e-maila na adres:", email);
    const docPdf = new PDFDocument();
    const filePath = `./${name.replace(/\s+/g, "_")}_schedule.pdf`;
    const writeStream = fs.createWriteStream(filePath);
    docPdf.pipe(writeStream);

    docPdf.fontSize(20).text(`Harmonogram godzinowy dla: ${name}`, { align: "center" });
    docPdf.moveDown();

    tableData.forEach((row, index) => {
        docPdf.fontSize(12).text(`${index + 1}. ${row}`, { indent: 10 });
    });

    docPdf.end();

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
            console.log("✅ Email wysłany do:", email);
            sentEmails.push({ name, email, date: new Date().toISOString() });
            res.json({ message: "✅ PDF wysłany!" });

            // Aktualizacja arkusza Google Sheets
            await updateSpreadsheet(name, monthYear);

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

// Endpoint do sprawdzania wysłanych e-maili
app.get("/sent-emails", (req, res) => {
    res.json(sentEmails);
});

// Start serwera
app.listen(PORT, () => console.log(`✅ Serwer działa na porcie ${PORT}`));
