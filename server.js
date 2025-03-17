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

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// 🔹 **Serwowanie strony głównej**
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 🔹 **Autoryzacja Google Sheets**
async function authorizeGoogleSheets() {
    const auth = new google.auth.GoogleAuth({
        keyFile: "keys.json",
        scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });
    return auth.getClient();
}

// 🔹 **Funkcja zapisu do Google Sheets**
async function markAsSent(name) {
    const auth = await authorizeGoogleSheets();
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = "10XgqG_OCszYY8wqJlhpiPNgBxuEwFZOJJF2iuXTdqpY"; // ID twojego arkusza
    const range = "A:B"; // Zakres sprawdzania (np. kolumny A i B)

    // Pobieranie danych
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range
    });

    const rows = response.data.values;
    let rowIndex = -1;

    if (rows) {
        for (let i = 0; i < rows.length; i++) {
            if (rows[i][0] === name) {
                rowIndex = i + 1;
                break;
            }
        }
    }

    if (rowIndex !== -1) {
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `B${rowIndex}`,
            valueInputOption: "RAW",
            requestBody: { values: [["Wysłano"]] }
        });
        console.log(`✅ Oznaczono użytkownika ${name} jako wysłanego.`);
    }
}

// 🔹 **Endpoint do generowania i wysyłania PDF**
app.post("/send-pdf", async (req, res) => {
    const { name, email, tableData } = req.body;

    if (!name || !email || !tableData) {
        return res.status(400).json({ message: "❌ Brak wymaganych danych!" });
    }

    console.log("📩 Próba wysyłki e-maila na adres:", email);

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
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });

        let mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: `Twój harmonogram godzin - ${name}`,
            text: "W załączniku znajdziesz swój harmonogram godzin.",
            attachments: [{ filename: `${name}_schedule.pdf`, path: filePath }]
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ Email wysłany do: ${email}`);
            await markAsSent(name);
            res.json({ message: "✅ PDF wysłany!" });

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

app.listen(PORT, () => console.log(`✅ Serwer działa na porcie ${PORT}`));
