const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Konfiguracja transportera e-mail
let transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Endpoint do generowania PDF i wysyłania na e-mail
app.post("/send-pdf", async (req, res) => {
    const { name, email, tableData } = req.body;

    if (!name || !email || !tableData) {
        return res.status(400).json({ message: "Brak danych!" });
    }

    console.log(`Próba wysyłki e-maila na adres: ${email}`);

    // Generowanie PDF
    const filePath = `./${name.replace(/\s+/g, "_")}_schedule.pdf`;
    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    doc.fontSize(20).text(`Harmonogram godzinowy dla: ${name}`, { align: "center" });
    doc.moveDown();

    tableData.split("\n").forEach((row, index) => {
        doc.fontSize(12).text(`${index + 1}. ${row}`, { indent: 10 });
    });

    doc.end();

    writeStream.on("finish", async () => {
        let mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: `Twój harmonogram godzin - ${name}`,
            text: "W załączniku znajdziesz swój harmonogram godzin.",
            attachments: [{ filename: `${name}_schedule.pdf`, path: filePath }],
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ PDF wysłany na: ${email}`);
            res.json({ message: "PDF wysłany!" });
        } catch (error) {
            console.error("❌ Błąd wysyłania e-maila:", error);
            res.status(500).json({ message: "Błąd wysyłania e-maila", error });
        }

        // Usuwanie pliku po wysłaniu
        setTimeout(() => {
            fs.unlink(filePath, (err) => {
                if (err) console.error("❌ Błąd usuwania pliku:", err);
                else console.log(`🗑 Plik ${filePath} usunięty.`);
            });
        }, 60000); // Usuwa plik po 60 sekundach
    });
});

// Uruchomienie serwera
app.listen(PORT, () => console.log(`🚀 Serwer działa na porcie ${PORT}`));
