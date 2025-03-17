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

// Serwowanie plików statycznych
app.use(express.static(path.join(__dirname, "public")));

// Strona główna
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Lista wysłanych zgłoszeń (pamięciowa)
let sentEmails = [];

// Funkcja do aktualizacji Google Sheets
async function updateSpreadsheet(name, month) {
    try {
        console.log("🔹 Łączę z Google Sheets...");

        const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
        await doc.useServiceAccountAuth({
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        });

        await doc.loadInfo();
        const sheet = doc.sheetsByIndex[0]; // Pierwsza zakładka

        await sheet.loadHeaderRow();
        const rows = await sheet.getRows();

        // Znajdź kolumnę dla danego miesiąca
        const columnIndex = sheet.headerValues.indexOf(month);
        if (columnIndex === -1) {
            console.error(`❌ Nie znaleziono kolumny dla miesiąca: ${month}`);
            return { error: `Nie znaleziono kolumny dla miesiąca: ${month}` };
        }

        // Znajdź wiersz z imieniem i nazwiskiem
        const userRow = rows.find(row => row[sheet.headerValues[0]].trim().toLowerCase() === name.trim().toLowerCase());

        if (!userRow) {
            console.error(`❌ Nie znaleziono użytkownika: ${name}`);
            return { error: `Nie znaleziono użytkownika: ${name}` };
        }

        // Sprawdź, czy już oznaczono jako wysłane
        if (userRow[month] && userRow[month] === "Wysłano") {
            console.log(`✅ Już wysłano do ${name} w miesiącu ${month}`);
            return { message: `Już wysłano do ${name} w miesiącu ${month}` };
        }

        // Aktualizacja statusu w Google Sheets
        userRow[month] = "Wysłano";
        await userRow.save();
        console.log(`✅ Zaktualizowano Google Sheets dla ${name} w ${month}`);
        return { success: true };
    } catch (error) {
        console.error("❌ Błąd aktualizacji arkusza:", error);
        return { error: "Błąd podczas aktualizacji Google Sheets" };
    }
}

// Endpoint do generowania i wysyłania PDF
app.post("/send-pdf", async (req, res) => {
    const { name, email, month, tableData } = req.body;

    if (!name || !email || !month || !tableData || !Array.isArray(tableData)) {
        return res.status(400).json({ message: "❌ Brak wymaganych danych!" });
    }

    console.log(`📩 Próba wysyłki e-maila do: ${email}`);

    // Tworzenie pliku PDF
    const doc = new PDFDocument();
    const filePath = `./${name.replace(/\s+/g, "_")}_schedule.pdf`;
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    doc.fontSize(20).text(`Harmonogram dla: ${name}`, { align: "center" });
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
            subject: `Harmonogram - ${name}`,
            text: "W załączniku znajduje się harmonogram.",
            attachments: [{ filename: `${name}_schedule.pdf`, path: filePath }],
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ Email wysłany do: ${email}`);
            sentEmails.push({ name, email, date: new Date().toISOString() });

            // Aktualizacja Google Sheets
            const updateResult = await updateSpreadsheet(name, month);
            if (updateResult.error) {
                console.error(`❌ Błąd aktualizacji arkusza: ${updateResult.error}`);
            }

            res.json({ message: "✅ PDF wysłany!" });

            // Usunięcie pliku po wysyłce
            setTimeout(() => {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Plik PDF usunięty: ${filePath}`);
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
app.listen(PORT, () => {
    console.log(`✅ Serwer działa na porcie ${PORT}`);
});
