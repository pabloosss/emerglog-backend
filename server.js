const express = require("express");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
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

// Strona admina
app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Lista wysłanych zgłoszeń
let sentSubmissions = [];

// Endpoint do pobierania zgłoszeń dla admina
app.get("/submissions", (req, res) => {
    res.json(sentSubmissions);
});

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

            // Zapisujemy zgłoszenie w pamięci
            sentSubmissions.push({ name, email, month, date: new Date().toISOString() });

            res.json({ message: "✅ PDF wysłany i zgłoszenie zapisane!" });

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
