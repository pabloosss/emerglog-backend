const express = require("express");
const fs = require("fs");
const bodyParser = require("body-parser");
const cors = require("cors");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

app.post("/send-pdf", async (req, res) => {
    const { name, hours } = req.body;
    if (!name || !hours) {
        return res.status(400).json({ message: "Brak wymaganych danych!" });
    }

    const filename = `${name.replace(/\s+/g, "_")}_schedule.pdf`;
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(filename));

    doc.fontSize(16).text("Harmonogram Pracy", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Imię i Nazwisko: ${name}`);
    doc.text(`Liczba godzin: ${hours}`);
    doc.text(`Miesiąc: ${new Date().toLocaleString("pl-PL", { month: "long", year: "numeric" })}`);
    doc.moveDown();
    
    doc.text("Podpis:", { continued: true }).text(" ________________________", { align: "right" });
    doc.end();

    sendEmail(name, filename)
        .then(() => res.json({ message: "Wysłano e-mail z harmonogramem!" }))
        .catch(error => res.status(500).json({ message: "Błąd wysyłania e-maila", error }));
});

async function sendEmail(name, filename) {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: EMAIL_USER, pass: EMAIL_PASS }
    });

    const mailOptions = {
        from: EMAIL_USER,
        to: "pawel.ruchlicki@emerlog.eu",
        subject: "Harmonogram Pracy",
        text: `Witaj,\n\nZałączam harmonogram dla ${name}.\n\nPozdrawiam,\nEmerlog`,
        attachments: [{ filename, path: `./${filename}` }]
    };

    await transporter.sendMail(mailOptions);
    fs.unlinkSync(filename); // Usunięcie pliku po wysłaniu
}

app.listen(PORT, () => console.log(`✅ Serwer działa na porcie ${PORT}`));
