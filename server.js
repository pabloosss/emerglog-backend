const express = require("express");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const { google } = require("googleapis");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Google Sheets API
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const SHEET_ID = "10XgqG_OCszYY8wqJlhpiPNgBxuEwFZOJJF2iuXTdqpY"; // ID Twojego arkusza

async function updateSpreadsheet(name, monthYear) {
    try {
        const auth = new google.auth.GoogleAuth({
            credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
            scopes: SCOPES,
        });

        const sheets = google.sheets({ version: "v4", auth });

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: "A:Z", // Pobiera cały arkusz
        });

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            console.log("❌ Arkusz jest pusty!");
            return;
        }

        let nameRow = -1;
        let columnIndex = -1;

        // Znajdź wiersz odpowiadający użytkownikowi
        rows.forEach((row, index) => {
            if (row[0]?.toLowerCase() === name.toLowerCase()) {
                nameRow = index;
            }
        });

        // Znajdź kolumnę odpowiadającą miesiącowi
        const headers = rows[0];
        columnIndex = headers.indexOf(monthYear);

        if (nameRow === -1) {
            console.log(`❌ Nie znaleziono użytkownika: ${name}`);
            return;
        }

        if (columnIndex === -1) {
            console.log(`❌ Nie znaleziono kolumny dla miesiąca: ${monthYear}`);
            return;
        }

        // Aktualizacja wartości w arkuszu
        const range = `B${nameRow + 1}`; // Przesunięcie o jeden wiersz
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: range,
            valueInputOption: "RAW",
            requestBody: {
                values: [["Wysłano"]],
            },
        });

        console.log(`✅ Arkusz zaktualizowany dla ${name} (${monthYear})`);
    } catch (error) {
        console.error("❌ Błąd aktualizacji arkusza:", error);
    }
}

// Endpoint do generowania i wysyłania PDF
app.post("/send-pdf", async (req, res) => {
    const { name, email, tableData } = req.body;

    if (!name || !email || !tableData || !Array.isArray(tableData)) {
        return res.status(400).json({ message: "❌ Brak wymaganych danych!" });
    }

    console.log("📩 Otrzymane dane:", req.body);

    // Tworzenie pliku PDF
    const doc = new PDFDocument();
    const filePath = `./${name.replace(/\s+/g, "_")}_schedule.pdf`;
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
            console.log("✅ Email wysłany do:", email);
            res.json({ message: "✅ PDF wysłany!" });

            // Aktualizacja arkusza Google
            const currentMonthYear = new Date().toISOString().slice(0, 7); // np. "2025-03"
            await updateSpreadsheet(name, currentMonthYear);

            // Usunięcie pliku po wysłaniu
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

// Start serwera
app.listen(PORT, () => console.log(`✅ Serwer działa na porcie ${PORT}`));
