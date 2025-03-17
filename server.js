const express = require("express");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const axios = require("axios"); // 📌 Pobieranie danych z Google Sheets
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;
const GOOGLE_SHEET_ID = "10XgqG_OCszYY8wqJlhpiPNgBxuEwFZOJJF2iuXTdqpY"; // 📌 Twój arkusz Google

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// 📌 **Główna strona**
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 📌 **Pobieranie listy pracowników z Google Sheets**
app.get("/employees", async (req, res) => {
    try {
        const url = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:json`;
        const response = await axios.get(url);
        
        // Oczyszczanie danych z Google Sheets
        const jsonText = response.data.match(/(?<=\().*(?=\))/s)[0];
        const jsonData = JSON.parse(jsonText);
        const rows = jsonData.table.rows;

        let employees = rows.map(row => ({
            Imię: row.c[0]?.v || "",
            Nazwisko: row.c[1]?.v || "",
            Email: row.c[2]?.v || "",
            Status: row.c[3]?.v || "Nie wysłano"
        }));

        res.json(employees);
    } catch (error) {
        console.error("❌ Błąd pobierania danych z Google Sheets:", error);
        res.status(500).json({ message: "Błąd pobierania listy pracowników" });
    }
});

// 📌 **Endpoint do generowania i wysyłania PDF**
app.post("/send-pdf", async (req, res) => {
    const { name, email, tableData } = req.body;
    
    if (!name || !email || !tableData || !Array.isArray(tableData)) {
        return res.status(400).json({ message: "❌ Brak wymaganych danych!" });
    }

    console.log("📩 Próba wysyłki e-maila na adres:", email);

    // 📌 **Tworzenie pliku PDF**
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
