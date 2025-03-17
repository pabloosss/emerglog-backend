const express = require("express");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const { GoogleSpreadsheet } = require("google-spreadsheet");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serwowanie plików statycznych (Frontend)
app.use(express.static(path.join(__dirname, "public")));

// Główna strona
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Testowy endpoint
app.get("/test", (req, res) => {
    res.json({ message: "✅ Serwer działa poprawnie!" });
});

// Konfiguracja Google Sheets
const SPREADSHEET_ID = "10XgqG_OCszYY8wqJlhpiPNgBxuEwFZOJJF2iuXTdqpY"; // ID twojego arkusza
const doc = new GoogleSpreadsheet(SPREADSHEET_ID);

// Funkcja aktualizacji arkusza Google Sheets
async function updateSpreadsheet(name, month) {
    try {
        console.log("📊 Aktualizacja arkusza dla:", name, "Miesiąc:", month);

        await doc.useServiceAccountAuth({
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        });

        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0];

        const rows = await sheet.getRows();
        let found = false;

        for (let row of rows) {
            if (row._rawData[0] === name) {
                const colIndex = sheet.headerValues.indexOf(month);
                if (colIndex !== -1) {
                    row[month] = "✅ Wysłano";
                    await row.save();
                    console.log(`✅ Zaktualizowano ${name} dla ${month}`);
                    found = true;
                } else {
                    console.error(`❌ Nie znaleziono kolumny dla miesiąca: ${month}`);
                }
            }
        }

        if (!found) {
            console.error(`❌ Nie znaleziono osoby: ${name}`);
        }
    } catch (error) {
        console.error("❌ Błąd aktualizacji arkusza:", error);
    }
}

// Endpoint do generowania i wysyłania PDF
app.post("/send-pdf", async (req, res) => {
    console.log("📩 Otrzymano żądanie:", req.body);

    const { name, email, month, tableData } = req.body;

    if (!name || !email || !month || !tableData || !Array.isArray(tableData)) {
        console.error("❌ Brak wymaganych danych!", req.body);
        return res.status(400).json({ message: "❌ Brak wymaganych danych!", received: req.body });
    }

    console.log(`📩 Próba wysyłki e-maila do: ${email}`);

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

// Start serwera
app.listen(PORT, () => console.log(`✅ Serwer działa na porcie ${PORT}`));
