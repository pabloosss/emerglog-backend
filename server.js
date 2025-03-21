//////////////// server.js ////////////////
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const fs = require("fs");
const PDFDocument = require("pdfkit");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "2mb" }));
app.use(express.static("public"));

// Dane do logowania do Gmaila – w pliku .env
// EMAIL_USER=testemerlog2@gmail.com
// EMAIL_PASS=abcdefgh
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// Endpoint testowy (strona główna z formularzem)
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Endpoint do generowania PDF i wysyłania
app.post("/send-pdf", async (req, res) => {
  try {
    const { name, hours } = req.body;
    if (!name || !hours) {
      return res.status(400).json({ message: "Brak wymaganych danych: name/hours" });
    }

    // Nazwa pliku PDF
    const pdfName = `${name.replace(/\s+/g, "_")}_harmonogram.pdf`;

    // 1) Generujemy PDF w Node (pdfkit)
    await createPdfFile(pdfName, { name, hours });

    // 2) Wysyłamy mailem
    await sendMailWithPdf(pdfName);

    // 3) Usuwamy plik
    fs.unlinkSync(pdfName);

    res.json({ message: "PDF wygenerowano i wysłano do Pawła!" });
  } catch (err) {
    console.error("Błąd /send-pdf:", err);
    res.status(500).json({ message: "Błąd serwera", error: String(err) });
  }
});

// Funkcja generująca PDF
function createPdfFile(filePath, data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    doc.fontSize(20).text("Harmonogram Godzin", { align: "center" });
    doc.moveDown();
    doc.fontSize(14).text(`Imię i nazwisko: ${data.name}`);
    doc.text(`Liczba godzin: ${data.hours}`, { underline: true });
    doc.moveDown();

    doc.fontSize(12).text("Przykładowa tabela (pdfkit, layout prosty):");
    doc.moveDown();

    // Twórzmy „pseudo-tabelę”:
    for (let i = 1; i <= 5; i++) {
      doc.text(`Dzień ${i} – 8:00 - 16:00 (8h)`);
    }

    doc.end();
    writeStream.on("finish", () => resolve());
    writeStream.on("error", (e) => reject(e));
  });
}

// Funkcja wysyłająca mail
async function sendMailWithPdf(pdfPath) {
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: EMAIL_USER,
    to: "pawel.ruchlicki@emerlog.eu",
    subject: "Twój harmonogram godzin (pdfkit)",
    text: "W załączniku znajdziesz swój harmonogram godzin (wygenerowany pdfkit).",
    attachments: [
      {
        filename: pdfPath,
        path: "./" + pdfPath,
      },
    ],
  };

  await transporter.sendMail(mailOptions);
  console.log("Mail wysłano do pawel.ruchlicki@emerlog.eu z załącznikiem =>", pdfPath);
}

// Start
app.listen(PORT, () => {
  console.log("Serwer działa na porcie", PORT);
});
