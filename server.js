const express = require("express");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const { GoogleSpreadsheet } = require("google-spreadsheet"); // 📌 Importujemy bibliotekę do obsługi Google Sheets
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

// 📌 ID Arkusza Google Sheets (skopiuj z adresu URL swojego arkusza)
const SPREADSHEET_ID = "10XgqG_OCszYY8wqJlhpiPNgBxuEwFZOJJF2iuXTdqpY";

// 📌 Klucz API Google z pliku JSON (musisz pobrać plik i podać jego ścieżkę)
const SERVICE_ACCOUNT_KEY = require("./google-key.json"); // Plik JSON z Google Cloud

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// 📌 **Główna strona**
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 📌 **Testowy endpoint**
app.get("/test", (req, res) => {
    res.json({ message: "✅ Serwer działa poprawnie!" });
});

// 📌 **Lista wysłanych zgłoszeń**
let sentEmails = [];

// 📌 **Funkcja aktualizująca Google Sheets**
async function updateGoogleSheet(name, email) {
    try {
        const doc = new GoogleSpreadsheet(SPREADSHEET_ID);
        await doc.useServiceAccountAuth(SERVICE_ACCOUNT_KEY);
        await doc.loadInfo();
        
        const sheet = doc.sheetsByIndex[0]; // Pierwsza zakładka w arkuszu
        const rows = await sheet.getRows(); // Pobieramy wszystkie wiersze

        let userRow = rows.find(row => row._rawData.includes(name));

        if (userRow) {
            // Jeśli użytkownik istnieje, oznaczamy go jako "Wysłane"
            userRow.Wysłał = "TAK";
            await userRow.save();
            console.log(`✅ Zaktualizowano Google Sheets dla ${name}`);
        } else {
            // Jeśli użytkownika nie ma, dodajemy nowy wiersz
            await sheet.addRow({ Imię: name, Email: email, Wysłał: "TAK" });
            console.log(`✅ Dodano nowy wpis w Google Sheets: ${name}`);
        }
    } catch (error) {
        console.error("❌ Błąd podczas aktualizacji Google Sheets:", error);
    }
}

// 📌 **Endpoint do generowania i wysyłania PDF**
app.post("/send-pdf", async (req, res) => {
    const { name, email, tableData } = req.body;

    if (!name || !email || !tableData || !Array.isArray(tableData)) {
        return res.status(400).json({ message: "❌ Brak wymaganych danych!" });
    }

    console.log("📩 Próba wysyłki e-maila na adres:", email);

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
            sentEmails.push({ name, email, date: new Date().toISOString() });

            // 📌 Zaktualizuj Google Sheets
            await updateGoogleSheet(name, email);

            res.json({ message: "✅ PDF wysłany!" });

            // Usuwanie pliku po wysłaniu
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

// 📌 **Start serwera**
app.listen(PORT, () => console.log(`✅ Serwer działa na porcie ${PORT}`));
